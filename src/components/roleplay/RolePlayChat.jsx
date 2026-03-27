// @ts-nocheck
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send,
  X,
  MessageSquare,
  Highlighter,
  Zap,
  Bot,
  CircleUserRound,
  Target,
  Clapperboard,
  TriangleAlert,
  CornerRightUp,
} from "lucide-react";
import { createPageUrl } from "@/utils";
import ReactMarkdown from "react-markdown";
import CapabilityFeedbackPanel from "./CapabilityFeedbackPanel";
import AnnotatedTranscript from "./AnnotatedTranscript";
import {
  deriveInitialState, deriveInitialTemperature,
  transitionState, transitionTemperature, transitionSeverity,
  buildHCPProfile, buildHCPDialoguePrompt,
  normalizeHcpDialoguePunctuation,
  detectHcpDisagreement, escalateForDisagreement,
  TEMPERATURES,
  updateTurnState,
  detectLowValueRepResponse,
  countRecentLowValueRepTurns,
  getDeterministicTerminalClose,
  shouldForceTerminalDisengagement,
  shouldReplaceWithTerminalDisengagement,
} from "./hcpSimulationEngine";
import { SIGNAL_CAPABILITIES, GOVERNANCE } from "./signalIntelligenceSOT";

// Compact SOT block injected into end-session LLM feedback prompt
const FEEDBACK_SOT = `SIGNAL INTELLIGENCE™ — SOURCE OF TRUTH (AUTHORITATIVE):
${GOVERNANCE.scoringRule}
Capabilities (use canonical labels only):
${SIGNAL_CAPABILITIES.map(c => `• ${c.label} [${c.id}]: ${c.canonicalQuestion} — ${c.definition}`).join("\n")}
Overlap rules: ${GOVERNANCE.overlapRules.join(" | ")}
GUARDRAIL: Never invent capabilities, sub-metrics, or scores not listed above. Observable behavior only — no intent inference.`;
import { computeAlignment } from "./alignmentEngine";
import CoachingOverlay, { shouldTriggerCoaching } from "./CoachingOverlay";
import LiveMetricsPanel from "./LiveMetricsPanel";
import { useVoice } from "./useVoice";
import VoiceControls from "./VoiceControls";
import { getDifficultyVisuals } from "./difficultyStyles";
import { normalizeMessage } from "@/lib/messageNormalization";
import { normalizeTone } from "@/lib/conversationToneNormalization";
import {
  ENABLE_INFERENCE_LAYER,
  createInitialRepInferenceState,
  getRecentRepTurns,
  updateRepInferenceState,
  selectInferenceInfluence,
  applyInferenceBias,
} from "./behavioralInferenceLayer";
import { applyTransformSafetyHarness } from "./transformSafetyHarness";
import {
  extractConstraintCandidatesFromText,
  buildConstraintGrounding,
  detectConstraintDraftViolations,
  buildConstraintSafeRegeneratedResponse,
  detectOperationalConstraintTypes,
} from "./operationalConstraintGuardrails";

function escapeHTML(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sanitizeUserMessage(text) {
  return escapeHTML(String(text || "").trim());
}

function isLowSubstanceAck(text = "") {
  const normalized = String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;

  const shortAcks = new Set([
    "ok",
    "okay",
    "sure",
    "yep",
    "yeah",
    "ya",
    "k",
    "kk",
    "got it",
    "sounds good",
    "understood",
    "fine",
  ]);

  if (shortAcks.has(normalized)) return true;
  return normalized.split(" ").length <= 2 && /^(ok|okay|sure|yep|yeah|k)\b/.test(normalized);
}

function sanitizeRenderedMessage(text, source = "unknown") {
  const originalText = String(text || "");

  try {
    const normalizedText = normalizeMessage(originalText);
    const toneNormalizedText = normalizeTone(normalizedText);
    const hardenedText = hardenTextSurface(toneNormalizedText);
    logPunctuationDelta({
      stage: "render_pipeline",
      source,
      before: originalText,
      after: hardenedText,
    });
    const renderedText = escapeHTML(hardenedText);

    if (
      import.meta.env.DEV
      && originalText.includes("?")
      && !renderedText.includes("?")
    ) {
      console.warn("PUNCTUATION_INTEGRITY_VIOLATION", { source });
    }

    return renderedText;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("ROLEPLAY_MESSAGE_SANITIZE_FAILED", { source, error, text: originalText });
    }
    return escapeHTML(originalText);
  }
}

function hardenTextSurface(text) {
  let value = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!value) return "";

  value = value
    .replace(/\bi\b/g, "I")
    .replace(/([.!?])\s*([a-z])/g, (_, punc, char) => `${punc} ${char.toUpperCase()}`)
    .replace(/^([a-z])/, (_, char) => char.toUpperCase());

  if (!/[.!?]$/.test(value)) {
    const looksLikeQuestion = /^(what|how|why|when|where|who|which|do|does|did|can|could|would|will|is|are|am|should|have|has|had)\b/i.test(value);
    value += looksLikeQuestion ? "?" : ".";
  }

  return value;
}

function extractScenarioKeywords(scenario) {
  const combined = [
    scenario?.title,
    scenario?.description,
    scenario?.context,
    scenario?.opening_scene,
    scenario?.openingScene,
    scenario?.objective,
    scenario?.goal,
    ...(Array.isArray(scenario?.challenges) ? scenario.challenges : []),
  ].join(" ").toLowerCase();

  const stopWords = new Set(["that", "this", "with", "from", "into", "have", "your", "about", "there", "their", "they", "them", "what", "when", "where", "which"]);
  return [...new Set(combined.match(/[a-z][a-z-]{3,}/g) || [])].filter((word) => !stopWords.has(word));
}

function isScenarioGroundedDialogue(text, scenarioKeywords, repMessage) {
  const value = String(text || "").toLowerCase();
  const rep = String(repMessage || "").toLowerCase();
  if (!value) return false;

  const genericOnly = /^(i see\.?|thanks\.?|okay\.?|got it\.?|understood\.?|let me consider that\.?)+$/i.test(value.trim());
  if (genericOnly) return false;

  const scenarioHits = scenarioKeywords.filter((k) => value.includes(k)).length;
  const repHits = (rep.match(/[a-z][a-z-]{3,}/g) || []).filter((k) => value.includes(k)).length;
  const hasClinicalSignal = /\b(patient|patients|study|data|workflow|screening|access|prior auth|treatment|clinic|practice|protocol|follow-up|efficacy|safety|adherence)\b/.test(value);
  const asksClarifyingQuestion = value.includes("?") && value.split(/\s+/).length >= 8;
  return scenarioHits > 0 || repHits > 0 || hasClinicalSignal || asksClarifyingQuestion;
}

const REALISM_CONCERN_PATTERNS = {
  workflow: /\b(workflow|staff|staffing|nurse|team|throughput|burden|operational|implementation|process|capacity)\b/i,
  evidence: /\b(evidence|study|trial|endpoint|head-to-head|methodology|duration|confidence interval|data|proof)\b/i,
  access: /\b(access|prior auth|authorization|coverage|payer|insurance|formular|cost|reimbursement|paperwork)\b/i,
  time: /\b(time|busy|schedule|clinic|today|quick|minutes|rush|back-to-back)\b/i,
  policy: /\b(policy|protocol|guideline|committee|pathway|institution|restriction)\b/i,
  screening: /\b(screening|eligibility|candidacy|contraindication|resistance|monitoring)\b/i,
};

const PLANNER_TRACE_FLAG_KEY = "roleplay.debug.planner_trace";
const TEXT_SURFACE_CANARY_FLAG_KEY = "roleplay.debug.text_surface_canary";
const OPERATIONAL_CONSTRAINT_PRIORITY = ["staffing", "capacity", "workflow", "prior_auth", "scheduling", "handoff", "callback", "throughput", "time", "access", "policy", "screening", "evidence"];

function readDebugFlag(flagKey) {
  if (typeof window === "undefined") return false;
  try {
    const value = window.localStorage?.getItem(flagKey);
    return value === "1" || value === "true";
  } catch (_error) {
    return false;
  }
}

function isPlannerTraceEnabled() {
  return readDebugFlag(PLANNER_TRACE_FLAG_KEY);
}

function isTextSurfaceCanaryEnabled() {
  return import.meta.env.DEV && (isPlannerTraceEnabled() || readDebugFlag(TEXT_SURFACE_CANARY_FLAG_KEY));
}

function punctuationProfile(text = "") {
  const value = String(text || "");
  return {
    length: value.length,
    questionMarks: (value.match(/\?/g) || []).length,
    periods: (value.match(/\./g) || []).length,
    exclamations: (value.match(/!/g) || []).length,
    commas: (value.match(/,/g) || []).length,
  };
}

function logPunctuationDelta({ stage = "unknown", source = "unknown", before = "", after = "" } = {}) {
  if (!isTextSurfaceCanaryEnabled()) return;
  const beforeProfile = punctuationProfile(before);
  const afterProfile = punctuationProfile(after);
  const delta = {
    questionMarks: afterProfile.questionMarks - beforeProfile.questionMarks,
    periods: afterProfile.periods - beforeProfile.periods,
    exclamations: afterProfile.exclamations - beforeProfile.exclamations,
    commas: afterProfile.commas - beforeProfile.commas,
    length: afterProfile.length - beforeProfile.length,
  };
  const changed = Object.values(delta).some((value) => value !== 0);
  if (!changed) return;

  console.info("ROLEPLAY_PUNCTUATION_CANARY", {
    stage,
    source,
    delta,
    before: String(before || "").slice(0, 240),
    after: String(after || "").slice(0, 240),
  });
}

function extractConstraintCandidatesFromTurns(turns = [], recentWindow = 3) {
  if (!Array.isArray(turns) || turns.length === 0) return [];
  return turns
    .slice(-Math.max(1, recentWindow))
    .flatMap((turn) => {
      const sourceTurnNumber = Number.isFinite(turn?.turnNumber) ? turn.turnNumber : 0;
      return extractConstraintCandidatesFromText(turn?.hcpDialogueBefore || "").map((candidate) => ({
        ...candidate,
        constraintSourceTurn: sourceTurnNumber,
      }));
    });
}

function normalizeConstraintPriority(type = "") {
  const idx = OPERATIONAL_CONSTRAINT_PRIORITY.indexOf(type);
  return idx === -1 ? OPERATIONAL_CONSTRAINT_PRIORITY.length + 1 : idx;
}

function resolveConstraintTypeToConcern(type = "") {
  const map = {
    staffing: "workflow",
    workflow: "workflow",
    capacity: "workflow",
    prior_auth: "access",
    scheduling: "time",
    handoff: "workflow",
    callback: "time",
    throughput: "workflow",
    time: "time",
    access: "access",
    policy: "policy",
    screening: "screening",
    evidence: "evidence",
  };
  return map[type] || "workflow";
}

function inferConstraintResolvedInTurn(text = "") {
  const value = String(text || "").toLowerCase();
  if (!value) return [];
  const resolvedSignal = /\b(resolved|fixed|handled|already covered|no longer an issue|not a blocker anymore|closed out|we addressed)\b/.test(value);
  if (!resolvedSignal) return [];
  return detectOperationalConstraintTypes(value);
}

function normalizeConstraintSnippet(snippet = "") {
  return String(snippet || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function mergeConstraintCandidates(candidates = []) {
  const merged = [];
  const seen = new Set();
  (Array.isArray(candidates) ? candidates : []).forEach((candidate) => {
    const type = candidate?.constraintType || candidate?.type;
    if (!type) return;
    const snippet = normalizeConstraintSnippet(candidate?.snippet || "");
    const sourceTurnNumber = Number.isFinite(candidate?.constraintSourceTurn)
      ? candidate.constraintSourceTurn
      : Number.isFinite(candidate?.sourceTurnNumber)
        ? candidate.sourceTurnNumber
        : 0;
    const key = `${type}::${sourceTurnNumber}::${snippet}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({
      ...candidate,
      constraintType: type,
      snippet: candidate?.snippet || "",
      constraintSourceTurn: sourceTurnNumber,
    });
  });
  return merged;
}

function buildOperationalConstraintState({
  previousConstraints = [],
  rawCandidates = [],
  fallbackConcern = "workflow",
  sourceTurnNumber = 0,
  latestUserTurn = "",
  latestRepTurn = "",
} = {}) {
  const prior = Array.isArray(previousConstraints) ? previousConstraints : [];
  const stateByType = new Map(
    prior.map((constraint, idx) => [
      constraint?.constraintType || constraint?.type || `legacy_${idx}`,
      {
        ...constraint,
        constraintType: constraint?.constraintType || constraint?.type || "workflow",
        constraintStatus: constraint?.constraintStatus || "active",
      },
    ])
  );

  const resolvedTypes = new Set([
    ...inferConstraintResolvedInTurn(latestUserTurn),
    ...inferConstraintResolvedInTurn(latestRepTurn),
  ]);
  resolvedTypes.forEach((type) => {
    const existing = stateByType.get(type);
    if (existing && existing.constraintStatus === "active") {
      stateByType.set(type, { ...existing, constraintStatus: "resolved" });
    }
  });

  rawCandidates.forEach((candidate) => {
    const type = candidate?.constraintType || candidate?.type;
    if (!type) return;
    const candidateSnippet = normalizeConstraintSnippet(candidate?.snippet || "");
    const candidateSourceTurn = Number.isFinite(candidate?.constraintSourceTurn)
      ? candidate.constraintSourceTurn
      : Number.isFinite(candidate?.sourceTurnNumber)
        ? candidate.sourceTurnNumber
        : sourceTurnNumber;
    const priorConstraint = stateByType.get(type);
    const priorSnippet = normalizeConstraintSnippet(priorConstraint?.snippet || "");
    if (
      priorConstraint
      && priorConstraint.constraintStatus === "active"
      && priorSnippet
      && priorSnippet === candidateSnippet
    ) {
      return;
    }
    if (priorConstraint && priorConstraint.constraintStatus === "active") {
      stateByType.set(type, { ...priorConstraint, constraintStatus: "superseded" });
    }
    stateByType.set(type, {
      constraintType: type,
      constraintStatus: "active",
      constraintSourceTurn: candidateSourceTurn,
      snippet: candidate?.snippet || "",
    });
  });

  const activeOperationalConstraints = [...stateByType.values()]
    .filter((constraint) => constraint.constraintStatus === "active")
    .sort((a, b) => {
      if ((b.constraintSourceTurn || 0) !== (a.constraintSourceTurn || 0)) {
        return (b.constraintSourceTurn || 0) - (a.constraintSourceTurn || 0);
      }
      return normalizeConstraintPriority(a.constraintType) - normalizeConstraintPriority(b.constraintType);
    });

  const primaryOperationalConstraint = activeOperationalConstraints[0] || null;
  const normalizedActiveConstraints = activeOperationalConstraints.map((constraint) =>
    resolveConstraintTypeToConcern(constraint.constraintType)
  );

  return {
    activeOperationalConstraints,
    primaryOperationalConstraint,
    normalizedActiveConstraints: [...new Set(normalizedActiveConstraints)],
    allOperationalConstraints: [...stateByType.values()],
  };
}

function getOpeningSentence(text = "") {
  const value = String(text || "").trim();
  if (!value) return "";
  const firstSentence = value.match(/[^.!?]+[.!?]?/);
  return firstSentence ? firstSentence[0].trim() : value;
}

function openingAcknowledgesAnyConstraint(openingSentence = "", constraints = []) {
  const opening = String(openingSentence || "");
  if (!opening || !Array.isArray(constraints) || constraints.length === 0) return false;
  return constraints.some((constraint) => {
    const pattern = REALISM_CONCERN_PATTERNS[constraint];
    return pattern ? pattern.test(opening) : false;
  });
}

function emitPlannerTrace(stage, payload) {
  if (!isPlannerTraceEnabled()) return;
  console.debug("[ROLEPLAY_PLANNER_TRACE]", {
    stage,
    timestamp: new Date().toISOString(),
    ...payload,
  });
}

const CUE_BUCKETS = {
  timePressure: [
    "The HCP checks the next patient slot on the schedule and gestures for one concise point.",
    "The HCP keeps a hand on the chart while answering in short, time-conscious beats.",
    "The HCP scans the hallway briefly, then returns with a quick nod for you to continue.",
  ],
  workflowBurden: [
    "The HCP slides a stack of prior-auth forms aside and asks what is realistic for this clinic.",
    "The HCP toggles between notes and your comment, weighing workflow impact before replying.",
    "The HCP circles a task on the day sheet, then refocuses on practical execution details.",
  ],
  clinicalEvaluation: [
    "The HCP rereads a study detail before responding, focused on applicability to their patients.",
    "The HCP traces a line on the handout and pauses, checking how the evidence holds up in practice.",
    "The HCP reviews a chart entry and asks for the most clinically relevant takeaway.",
  ],
  guardedInterest: [
    "The HCP leans in slightly, but keeps the follow-up narrow and implementation-focused.",
    "The HCP nods once and asks for one concrete step before considering anything broader.",
    "The HCP keeps a measured tone, inviting one practical clarification.",
  ],
  conditionalOpenness: [
    "The HCP sets down their pen and allows one more point, pending relevance to clinic constraints.",
    "The HCP acknowledges your point, then asks for a condition-specific example before moving on.",
    "The HCP gives a brief nod and asks what this changes operationally this week.",
  ],
  mildSkepticism: [
    "The HCP narrows focus on your claim and asks for proof tied to this setting.",
    "The HCP pauses over a study reference, then asks where this fits in real workflow.",
    "The HCP keeps eye contact and requests a more specific link to patient selection.",
  ],
  practicalDecision: [
    "The HCP turns to the care-plan notes and asks what decision this supports right now.",
    "The HCP marks a checkbox on the visit plan, then asks for the simplest next action.",
    "The HCP folds the handout and asks what can actually be implemented this month.",
  ],
  closure: [
    "The HCP steps toward the door, signaling the conversation needs to wrap.",
    "The HCP closes the chart and offers a brief, professional nod toward next steps.",
    "The HCP gathers paperwork and indicates there is only time for one final point.",
  ],
};

const ENGAGEMENT_DECAY_TIERS = ["engaged", "constrained", "impatient", "disengaging"];
const ENGAGEMENT_TIER_SENTENCE_MAX = {
  engaged: 4,
  constrained: 3,
  impatient: 2,
  disengaging: 2,
};

const ENGAGEMENT_TIER_PROMPT_GUIDANCE = {
  engaged: "Stay open and thoughtful. You can provide context, but keep it clinically grounded and realistic.",
  constrained: "Be shorter and narrower. Redirect quickly to your active concern with less explanation.",
  impatient: "Be direct and brief. Apply time pressure and ask for one concrete operational point.",
  disengaging: "Use minimal effort. Keep it very brief, avoid coaching, and signal that relevance must be immediate.",
};

const DECAY_CUE_BUCKETS = {
  engaged: [
    "The HCP keeps steady eye contact, attentive and professionally receptive.",
    "The HCP listens with a thoughtful expression, then returns to the chart for a moment.",
    "The HCP nods once, open to the discussion but mindful of the clinic flow.",
  ],
  constrained: [
    "The HCP checks the clock briefly, then refocuses with a narrower, time-aware expression.",
    "The HCP scans a chart line and responds with concise, practical focus.",
    "The HCP keeps one hand on the notes, signaling limited bandwidth but continued cooperation.",
  ],
  impatient: [
    "The HCP glances toward the hallway and waits for one practical point.",
    "The HCP keeps a clipped posture, clearly trying to keep the conversation moving.",
    "The HCP taps the chart once, signaling urgency and limited patience for tangents.",
  ],
  disengaging: [
    "The HCP shifts toward the door and waits for immediate relevance.",
    "The HCP gathers the chart with minimal expression, signaling the exchange is close to ending.",
    "The HCP keeps attention brief, expecting one concrete point before moving on.",
  ],
};

// Feature flags (default OFF): safety harness for optional dialogue realism transforms.
const ENABLE_REALISM_TRANSFORM_HARNESS = import.meta.env.VITE_ENABLE_REALISM_TRANSFORM_HARNESS === "true";
const ENABLE_REALISM_REPLAY_METRICS = import.meta.env.VITE_ENABLE_REALISM_REPLAY_METRICS === "true";

const TERMINAL_DECISION_CUES = [
  "The HCP glances toward the door, waiting for one final relevant point.",
  "The HCP gathers the chart and waits for one final relevant point.",
  "The HCP checks the time, waiting for one final relevant point.",
  "The HCP shifts posture as if preparing to move on, waiting for one final relevant point.",
];
const NO_REPEAT_WINDOW_TURNS = 20;
const SessionState = Object.freeze({
  ACTIVE: "ACTIVE",
  PROCESSING: "PROCESSING",
  CLOSING: "CLOSING",
  ENDED: "ENDED",
});

function extractDialoguePhrases(text = "") {
  return String(text || "")
    .split(/[.!?]/)
    .map((segment) => normalizeDialogueSignature(segment))
    .filter((phrase) => phrase && phrase.split(" ").length >= 4);
}

function detectPrimaryConcern(text = "") {
  const sample = String(text || "");
  for (const [key, pattern] of Object.entries(REALISM_CONCERN_PATTERNS)) {
    if (pattern.test(sample)) return key;
  }
  return "workflow";
}

function normalizeDialogueSignature(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DIALOGUE_STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "have", "been", "what", "when", "where", "which",
  "will", "would", "could", "should", "about", "into", "they", "them", "their", "there", "here", "just", "still",
  "need", "team", "clinic", "practical", "concrete", "point", "give", "show", "tell", "look", "like", "does",
  "how", "our", "are", "but", "not", "can", "you", "one", "now", "then",
]);

function canonicalizeToken(token = "") {
  const value = String(token || "").toLowerCase();
  if (!value) return "";
  if (/^(staff|staffing|workload|burden|overwhelmed|short|capacity|bandwidth)$/.test(value)) return "staff_burden";
  if (/^(prior|auth|authorization|payer|payers|coverage|appeal|appeals|reimbursement)$/.test(value)) return "access_ops";
  if (/^(ehr|emr|integrate|integration|interop|system|systems)$/.test(value)) return "integration_ops";
  if (/^(implement|implementation|rollout|deploy|deployment|onboard|onboarding)$/.test(value)) return "implementation_ops";
  if (/^(train|training|educate|education|coaching)$/.test(value)) return "training_ops";
  if (/^(disrupt|disruption|slow|slowdown|friction|interrupt|interruption)$/.test(value)) return "disruption_ops";
  if (/^(evidence|data|trial|study|feasibility|feasible|proof|outcomes)$/.test(value)) return "evidence_ops";
  if (/^(next|step|steps|decision|decide|pilot)$/.test(value)) return "next_step_ops";
  return value;
}

function tokensFromSignature(text = "") {
  return normalizeDialogueSignature(text)
    .split(" ")
    .map((token) => canonicalizeToken(token))
    .filter((token) => token.length > 2 && !DIALOGUE_STOPWORDS.has(token));
}

function calculateTokenOverlapRatio(a = "", b = "") {
  const aTokens = new Set(tokensFromSignature(a));
  const bTokens = new Set(tokensFromSignature(b));
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) overlap += 1;
  });
  return overlap / Math.min(aTokens.size, bTokens.size);
}

function calculateSemanticSimilarity(a = "", b = "") {
  const aTokens = new Set(tokensFromSignature(a));
  const bTokens = new Set(tokensFromSignature(b));
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) overlap += 1;
  });
  return overlap / new Set([...aTokens, ...bTokens]).size;
}

function classifyDialogueAngle(text = "") {
  const sample = String(text || "").toLowerCase();
  if (/\b(overwhelmed|short-staffed|staffing|burden|buried|capacity|bandwidth)\b/.test(sample)) return "burden";
  if (/\b(ehr|emr|integrat|interoperab|existing system)\b/.test(sample)) return "integration";
  if (/\b(implement|implementation|roll out|rollout|deploy|ownership|owner)\b/.test(sample)) return "implementation";
  if (/\b(train|training|onboard|education|upskill)\b/.test(sample)) return "training";
  if (/\b(disrupt|slow|pulling staff|responsibilities|workflow hit|downtime)\b/.test(sample)) return "disruption";
  if (/\b(evidence|feasibility|next step|pilot|proof|outcome|payer requirements)\b/.test(sample)) return "evidence_next_step";
  return "general";
}

function collectRecentHcpDialogues(turns = [], limit = NO_REPEAT_WINDOW_TURNS) {
  return (Array.isArray(turns) ? turns : [])
    .map((turn) => String(turn?.hcpDialogueBefore || "").trim())
    .filter(Boolean)
    .slice(-Math.max(1, limit));
}

function chooseConcernSpecificVariant({ concern = "workflow", seed = "", recentDialogues = [] } = {}) {
  const variants = {
    workflow: [
      "I need one operational step my current team can run with this week.",
      "Give me one concrete process change we can apply without adding staff burden.",
      "What is the single workflow adjustment that saves my team time right away?",
      "If this is actionable, map one step my staff can execute in our current flow.",
      "Keep it practical: what one change should we implement first in clinic?",
    ],
    access: [
      "What is one payer-facing step that could reduce prior auth rework for us?",
      "Give me one practical way to lower prior authorization friction this week.",
      "What is one concrete action that helps us move access approvals faster?",
      "Name one process change that cuts access delays without extra admin load.",
      "I need one specific access tactic my team can run immediately.",
    ],
    evidence: [
      "Point me to the most practice-relevant proof and why it changes my decision now.",
      "Give me one evidence point that directly applies to patients I am seeing this month.",
      "What is the strongest data signal I can use in a real treatment decision tomorrow?",
      "Keep it tight: one proof point and the exact clinical implication for my practice.",
      "I need one evidence takeaway tied directly to a care choice in clinic.",
    ],
    time: [
      "I have about a minute—what is the one practical action worth doing first?",
      "Given our schedule pressure, what is your single highest-yield next step?",
      "Keep this to one immediate step we can start today without extra meetings.",
      "What is one quick change that helps this week despite limited time?",
      "I need one concise action item we can execute between patients.",
    ],
    policy: [
      "What is one step that fits our current protocol and can be implemented quickly?",
      "Show me one adjustment that aligns with our pathway constraints as written.",
      "I need one protocol-compatible move we can actually use this month.",
      "Give me one concrete recommendation that stays within institutional policy.",
      "What is the first compliant step that still improves workflow?",
    ],
    screening: [
      "What is one screening checkpoint we should add first for consistent execution?",
      "Give me one candidacy step we can standardize without slowing clinic flow.",
      "What is the first practical screening action your team recommends for our setting?",
      "I need one clear screening move that my staff can apply consistently.",
      "Name one immediate candidacy workflow step we can use this week.",
    ],
  };

  const pool = variants[concern] || variants.workflow;
  const recentNormalized = recentDialogues.map((text) => normalizeDialogueSignature(text));
  const startIndex = deterministicIndex(`${seed}:${concern}:dialogue-variant`, pool.length);

  for (let i = 0; i < pool.length; i += 1) {
    const candidate = pool[(startIndex + i) % pool.length];
    const candidateNorm = normalizeDialogueSignature(candidate);
    if (!candidateNorm) continue;
    if (!recentNormalized.includes(candidateNorm)) return candidate;
  }

  return pool[startIndex] || pool[0];
}

function enforceDialogueVariety({
  candidate = "",
  concern = "workflow",
  seed = "",
  recentDialogues = [],
  progressionStage = "burden",
} = {}) {
  const safeCandidate = hardenTextSurface(candidate);
  if (!safeCandidate) return safeCandidate;
  const candidateNorm = normalizeDialogueSignature(safeCandidate);
  const recentNormalized = recentDialogues.map((text) => normalizeDialogueSignature(text));
  const duplicateWithinWindow = recentNormalized.includes(candidateNorm);
  const highlySimilar = recentDialogues.some((prior) =>
    calculateTokenOverlapRatio(safeCandidate, prior) >= 0.78
    || calculateSemanticSimilarity(safeCandidate, prior) >= 0.72
  );
  const recentAngles = recentDialogues.slice(-4).map((line) => classifyDialogueAngle(line));
  const candidateAngle = classifyDialogueAngle(safeCandidate);
  const angleIsStuck =
    candidateAngle !== "general"
    && recentAngles.length >= 2
    && recentAngles.slice(-2).every((angle) => angle === candidateAngle)
    && candidateAngle !== progressionStage;

  if (!duplicateWithinWindow && !highlySimilar && !angleIsStuck) return safeCandidate;

  return chooseConcernSpecificVariant({
    concern,
    seed: `${seed}:${progressionStage}`,
    recentDialogues,
  });
}

function hasExplicitExitIntent(text = "") {
  const normalized = String(text || "").trim().toLowerCase();
  if (!normalized) return false;

  const explicitClosePattern = /\b(i (have|need|must) to (go|leave|head out|jump|run)|i'm (heading out|signing off)|gotta (run|go)|time to go|need to hop off|let's (stop|wrap) here|we should wrap (this )?up|can we (continue|finish) later|let's (pick this up|reconnect) later|we can pick this up (later|another time)|i have (another|my next) patient|i need to get to (my )?next patient|i have an emergency|i need to jump to another room|i need to get back to clinic)\b/i;
  if (explicitClosePattern.test(normalized)) return true;

  const hasSignoff = /\b(goodbye|good bye|bye|have a great day|see you (next week|next time)|talk soon)\b/i.test(normalized);
  if (!hasSignoff) return false;

  const signoffContext = /\b(thanks|thank you|for your time|for stopping by|for coming in|we'll reconnect|let's reconnect|let's follow up|follow up later|speak soon)\b/i;
  return signoffContext.test(normalized) || normalized.length <= 40;
}

function hasSpecificFollowUpCommitment(text = "") {
  const sample = String(text || "").toLowerCase();
  if (!sample) return false;

  const hasDeliverable = /\b(plan|workflow analysis|implementation plan|rollout plan|training plan|timeline|pilot plan|checklist|proposal)\b/.test(sample);
  const hasOwnership = /\b(i will|i'll|my team will|we will|i can send|i can deliver|i can share)\b/.test(sample);
  const hasTimebox = /\b(today|tomorrow|this week|next week|by (monday|tuesday|wednesday|thursday|friday|end of day|eod|end of week)|within \d+\s?(day|days|week|weeks)|on (monday|tuesday|wednesday|thursday|friday))\b/.test(sample);
  const notJustPromise = !/\b(trust me|i give you my word|it will be smooth|it will streamline)\b/.test(sample);

  return hasDeliverable && hasOwnership && hasTimebox && notJustPromise;
}

function isDeferringWithoutImmediateAction(text = "") {
  const sample = String(text || "").toLowerCase();
  if (!sample) return false;

  const hasDeferralLanguage = /\b(next week|later|we'll talk|we can talk|circle back|follow up|revisit|by next|by end of week|until the end of the week)\b/.test(sample);
  const hasImmediateAction = /\b(today|tomorrow|this week|start with|first step|one change|implement now|pilot now|begin with|assign)\b/.test(sample);

  return hasDeferralLanguage && !hasImmediateAction;
}

function isTerminalClosureDialogue(text = "") {
  const sample = String(text || "").toLowerCase().trim();
  if (!sample) return false;
  const closurePattern = /\b(conversation is ending|exchange is over|continue speaking later|coordinate a follow-up|follow-up slot|front desk|we can continue later|wrap this up|need to move on|take care|i have patients waiting|i need to get back to patients|this (isn't|is not) productive|not worth more time)\b/;
  const asksNewQuestion = sample.includes("?");
  return closurePattern.test(sample) && !asksNewQuestion;
}

function hasHcpSignoffCue(text = "") {
  return /\b(take care|i have patients waiting|i need to get back to patients|this (isn't|is not) productive|not worth more time|need to move on|wrapp?ing this up|we can continue later)\b/i.test(String(text || ""));
}

function hasWorkflowOperationalLanguage(text = "") {
  return /\b(prior auth|prior authorization|approval|approvals|paperwork|workflow|resubmission|resubmissions|bottleneck|back-and-forth|back and forth|staff burden|clinic flow|implementation|feasibility|team load|epa|front desk|check-?in|order[\s-]?set|routing rule|staffing model|nurse script|ma submit|ma routing|queue|huddle script)\b/i.test(String(text || ""));
}

function hasEvidencePivotLanguage(text = "") {
  return /\b(jama|study|trial|data|outcomes|efficacy|disease progression|adoption|publication|findings)\b/i.test(String(text || ""));
}

const SCENARIO_FAMILY_LEXICAL_PACKS = Object.freeze({
  hiv_prep: [
    "prep", "prior auth", "coverage", "adherence", "screening", "resistance", "back-and-forth", "resubmission",
  ],
  oncology_access: [
    "regimen", "line of therapy", "biomarker", "pathway", "prior auth", "reimbursement", "denial", "infusion",
  ],
  cardiometabolic: [
    "step therapy", "formulary", "coverage", "adherence", "refill", "prior auth", "care coordination",
  ],
  general_access: [
    "prior auth", "approval", "paperwork", "workflow", "staff burden", "clinic flow", "resubmission",
  ],
});

const RECOVERY_TIMING_THRESHOLDS = Object.freeze({
  immediate_max_misses: 1,
  partial_max_misses: 2,
});

const TERMINAL_CLOSE_POLICY_MATRIX = Object.freeze({
  engaged: { missed: "probe", overpivot: "probe", aligned: "continue", neutral: "continue" },
  constrained: { missed: "probe", overpivot: "probe", aligned: "continue", neutral: "continue" },
  impatient: { missed: "probe", overpivot: "probe", aligned: "continue", neutral: "continue" },
  disengaging: { missed: "close", overpivot: "close", aligned: "probe", neutral: "probe" },
  disengaged: { missed: "close", overpivot: "close", aligned: "close", neutral: "close" },
});

function detectScenarioFamily(scenarioText = "") {
  const value = String(scenarioText || "").toLowerCase();
  if (/\bprep|hiv|sti|cabotegravir|long-acting\b/.test(value)) return "hiv_prep";
  if (/\boncology|tumor|metastatic|biomarker|chemo|immunotherapy\b/.test(value)) return "oncology_access";
  if (/\bcardio|heart|lipid|diabetes|a1c|glp-1|hypertension\b/.test(value)) return "cardiometabolic";
  return "general_access";
}

function isOperationalFalsePositiveContext(text = "") {
  const value = String(text || "").toLowerCase();
  return /\b(data workflow|workflow analysis of study|publication workflow|research workflow|trial operations)\b/.test(value);
}

function hasScenarioOperationalLexicalMatch(text = "", scenarioFamily = "general_access") {
  const value = String(text || "").toLowerCase();
  const pack = SCENARIO_FAMILY_LEXICAL_PACKS[scenarioFamily] || SCENARIO_FAMILY_LEXICAL_PACKS.general_access;
  return pack.some((token) => value.includes(token));
}

function classifyConcernFlowOutcome({
  activeConcern = "workflow",
  repMessage = "",
  priorRepMessage = "",
  scenarioFamily = "general_access",
} = {}) {
  const rep = String(repMessage || "");
  const prior = String(priorRepMessage || "");
  const concernIsOperational = activeConcern === "workflow" || activeConcern === "access" || activeConcern === "time";
  if (!concernIsOperational) return "neutral";

  const repOperational = (
    hasWorkflowOperationalLanguage(rep)
    || hasScenarioOperationalLexicalMatch(rep, scenarioFamily)
  ) && !isOperationalFalsePositiveContext(rep);
  const repEvidence = hasEvidencePivotLanguage(rep);
  const priorOperational = (
    hasWorkflowOperationalLanguage(prior)
    || hasScenarioOperationalLexicalMatch(prior, scenarioFamily)
  ) && !isOperationalFalsePositiveContext(prior);

  if (repEvidence && !repOperational && priorOperational) return "overpivot";
  if (repEvidence && !repOperational) return "missed";
  if (repEvidence && repOperational && priorOperational) return "overpivot";
  if (repOperational) return "aligned";
  return "neutral";
}

function classifyRecoveryTiming({ recentMisses = 0 } = {}) {
  if (recentMisses <= RECOVERY_TIMING_THRESHOLDS.immediate_max_misses) return "immediate";
  if (recentMisses <= RECOVERY_TIMING_THRESHOLDS.partial_max_misses) return "partial";
  return "late";
}

function determineTerminalPolicyAction({
  hcpState = "engaged",
  concernFlowOutcome = "neutral",
  unresolvedConcernTurns = 0,
  repHasFollowUpCommitment = false,
  repDefersImmediateAction = false,
  explicitExitOverride = false,
} = {}) {
  const statePolicy = TERMINAL_CLOSE_POLICY_MATRIX[hcpState] || TERMINAL_CLOSE_POLICY_MATRIX.engaged;
  let action = statePolicy[concernFlowOutcome] || "continue";
  if (hcpState === "impatient" && unresolvedConcernTurns >= 5 && (concernFlowOutcome === "missed" || concernFlowOutcome === "overpivot")) {
    action = "close";
  }
  if (!explicitExitOverride && repHasFollowUpCommitment && !repDefersImmediateAction && action === "close") {
    action = "probe";
  }
  return explicitExitOverride ? "close" : action;
}

function isDirectUserQuestion(text = "") {
  const value = String(text || "").trim();
  if (!value) return false;
  if (value.includes("?")) return true;
  return /^(what|how|why|when|where|which|who|can|could|would|will|should|is|are|do|does|did)\b/i.test(value);
}

function rankResponseObjective({
  overrideExit = false,
  terminalDecisionMode = false,
  hardLoopBreaker = false,
  concernFlowOutcome = "neutral",
  activeConstraints = [],
  activeOperationalConstraints = [],
  latestUserTurn = "",
} = {}) {
  const hasActiveConstraint = (Array.isArray(activeConstraints) && activeConstraints.length > 0)
    || (Array.isArray(activeOperationalConstraints) && activeOperationalConstraints.length > 0);
  const primaryConstraint = hasActiveConstraint ? activeConstraints[0] : "none";
  const directOperationalQuestion = hasActiveConstraint && isDirectUserQuestion(latestUserTurn);

  const candidates = [
    {
      id: "close_or_limit_scope",
      score: (overrideExit || terminalDecisionMode || hardLoopBreaker) ? 100 : 10,
      referencesConstraint: false,
    },
    {
      id: "answer_direct_constraint_question",
      score: directOperationalQuestion ? 90 : 20,
      referencesConstraint: true,
    },
    {
      id: "reanchor_to_constraint",
      score: (concernFlowOutcome === "missed" || concernFlowOutcome === "overpivot") ? 80 : 25,
      referencesConstraint: true,
    },
    {
      id: "advance_with_constraint",
      score: concernFlowOutcome === "aligned" ? 70 : 30,
      referencesConstraint: true,
    },
    {
      id: "continue_dialogue",
      score: 40,
      referencesConstraint: false,
    },
  ];

  // Constraint-priority rule: active user constraints override generic agenda.
  if (hasActiveConstraint) {
    candidates.forEach((candidate) => {
      if (candidate.referencesConstraint) candidate.score += 30;
      else candidate.score -= 25;
    });
  }

  // Direct-question rule: answering immediate operational question takes precedence.
  if (directOperationalQuestion) {
    const directAnswerObjective = candidates.find((c) => c.id === "answer_direct_constraint_question");
    if (directAnswerObjective) directAnswerObjective.score += 25;
  }

  candidates.sort((a, b) => b.score - a.score);
  let selected = candidates[0];

  // Enforcement: if constraint exists and selected objective ignores it, downgrade and pick best constraint-aware option.
  if (hasActiveConstraint && !selected.referencesConstraint) {
    const constraintAware = candidates.find((candidate) => candidate.referencesConstraint);
    if (constraintAware) selected = constraintAware;
  }

  const selectedObjectiveAccountsForConstraint = !hasActiveConstraint || Boolean(selected.referencesConstraint);

  return {
    selectedObjective: `${selected.id}[${primaryConstraint}]`,
    primaryConstraint,
    hasActiveConstraint,
    directOperationalQuestion,
    selectedObjectiveAccountsForConstraint,
    rankedObjectives: candidates.map(({ id, score, referencesConstraint }) => ({ id, score, referencesConstraint })),
  };
}

function buildOperationalReanchorDialogue({ mode = "missed", unresolvedConcernTurns = 0 } = {}) {
  if (mode === "aligned") {
    return unresolvedConcernTurns >= 2
      ? "That could help, as long as it reduces back-and-forth without adding work for my team."
      : "That sounds relevant, but it depends on whether it is realistic for our current staffing."
  }

  if (mode === "overpivot") {
    return unresolvedConcernTurns >= 2
      ? "I understand the outcomes point, but approvals are still the bottleneck. Unless this streamlines prior auth, it is hard to act on."
      : "I get the data, but outcomes are not our blocker right now. Prior auth friction is."
  }

  return unresolvedConcernTurns >= 2
    ? "I understand, but data is not the barrier. Approvals and paperwork are what slow us down."
    : "That is interesting, but my biggest issue is prior auth delays, not outcomes.";
}

function detectConcernAddressed(repMessage = "", concern = "workflow") {
  const concernPattern = REALISM_CONCERN_PATTERNS[concern] || REALISM_CONCERN_PATTERNS.workflow;
  return concernPattern.test(String(repMessage || ""));
}

function hasConcreteOperationalMove(repMessage = "") {
  return /\b(step|plan|process|workflow|handoff|assign|pilot|start with|first action|specific|implement|change for your team|for your staff)\b/i.test(String(repMessage || ""));
}

function deriveEngagementDecay({
  previousTier = "engaged",
  previousPressure = 0,
  repMessage = "",
  activeConcern = "workflow",
  concernSourceText = "",
  scenarioKeywords = [],
}) {
  const repLower = String(repMessage || "").toLowerCase();
  const concernAddressed = detectConcernAddressed(repLower, activeConcern);
  const repeatedEvidence = /\b(study|trial|data|endpoint|publication|methodology|efficacy|p-value|hazard ratio)\b/.test(repLower)
    && !concernAddressed
    && ["workflow", "access", "time", "policy", "screening"].includes(activeConcern);
  const contextHits = (scenarioKeywords || []).slice(0, 40).filter((k) => repLower.includes(k)).length;
  const reusedHcpLanguage = String(concernSourceText || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && w.length > 4)
    .slice(0, 14)
    .some((token) => repLower.includes(token));
  const genericRep = repLower.length < 18 || /\b(great|sounds good|totally|absolutely|trust me|you know)\b/.test(repLower);

  let missWeight = 0;
  if (!concernAddressed) missWeight += 1;
  if (repeatedEvidence) missWeight += 1;
  if (!reusedHcpLanguage && contextHits === 0) missWeight += 0.5;
  if (genericRep) missWeight += 0.4;

  const strongRecovery = concernAddressed && (hasConcreteOperationalMove(repLower) || reusedHcpLanguage || contextHits > 0);
  const recoveryCredit = strongRecovery ? 1.1 : concernAddressed ? 0.5 : 0;

  const smoothedPressure = Math.max(0, Math.min(6, (previousPressure * 0.65) + missWeight - recoveryCredit));
  const inferredIndex = smoothedPressure > 3.8 ? 3 : smoothedPressure > 2.4 ? 2 : smoothedPressure > 1.2 ? 1 : 0;
  const previousIndex = Math.max(0, ENGAGEMENT_DECAY_TIERS.indexOf(previousTier));
  const boundedIndex = Math.max(previousIndex - 1, Math.min(previousIndex + 1, inferredIndex));
  const tier = ENGAGEMENT_DECAY_TIERS[boundedIndex] || "engaged";

  return {
    tier,
    pressureScore: smoothedPressure,
    concernAddressed,
    repeatedEvidence,
    recovered: strongRecovery,
    missWeight,
  };
}

function compressHcpDialogueForEngagement(dialogue = "", engagement = {}) {
  const tier = engagement.tier || "engaged";
  const concern = engagement.activeConcern || "workflow";
  const unresolvedStreak = Number(engagement.unresolvedStreak || 0);
  const burdenEstablished = Boolean(engagement.burdenEstablished);
  const maxSentences = ENGAGEMENT_TIER_SENTENCE_MAX[tier] || 3;
  const normalized = hardenTextSurface(dialogue);
  const parts = normalized.match(/[^.!?]+[.!?]/g) || [normalized];
  let compact = parts.slice(0, maxSentences).join(" ").trim();

  if (tier === "disengaging") {
    compact = compact.replace(/\b(let me|happy to|i can walk you through|we can review)\b[^.]*\./gi, "").trim() || compact;
  }

  const closureSentenceIndex = compact
    .split(/(?<=[.!?])\s+/)
    .findIndex((sentence) => hasHcpSignoffCue(sentence));
  const hasSignoffCue = closureSentenceIndex >= 0 || hasHcpSignoffCue(compact);
  if (hasSignoffCue) {
    const compactSentences = compact.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (closureSentenceIndex >= 0) {
      compact = compactSentences.slice(0, closureSentenceIndex + 1).join(" ").trim();
    } else {
      compact = compactSentences[0] || compact;
    }
  }

  const needsRedirect = !hasSignoffCue && !engagement.concernAddressed && (tier === "impatient" || tier === "disengaging");
  if (needsRedirect) {
    const progression = [
      "burden",
      "integration",
      "implementation",
      "training",
      "disruption",
      "evidence_next_step",
    ];
    const stageIndex = Math.max(0, Math.min(progression.length - 1, unresolvedStreak));
    const stage = progression[stageIndex];
    const redirectByConcern = {
      workflow: {
        burden: burdenEstablished
          ? "What would this look like in practice for us?"
          : "We're already stretched, so what changes without adding lift?",
        integration: "How does this plug into our current EHR workflow?",
        implementation: "Who would own this rollout on our side?",
        training: "How would you train staff without slowing clinic flow?",
        disruption: "How do we keep this from pulling people off core responsibilities?",
        evidence_next_step: "What is the smallest pilot step that proves this is feasible here?",
      },
      access: {
        burden: burdenEstablished
          ? "Given our existing constraints, where does this reduce friction first?"
          : "We're already managing heavy admin load, so where does this actually help?",
        integration: "How does this fit with our current prior-auth workflow?",
        implementation: "Who handles exceptions when payer rules vary?",
        training: "What training is needed for staff handling access paperwork?",
        disruption: "How do we avoid extra back-and-forth with payers?",
        evidence_next_step: "What would be a realistic first access pilot here?",
      },
      evidence: {
        burden: "I need this tied to actual decisions in a busy clinic day.",
        integration: "How does that evidence translate into our existing treatment flow?",
        implementation: "What exact practice change follows from that data?",
        training: "How would the team be trained to apply that consistently?",
        disruption: "What happens operationally when real-world patients don't match trial criteria?",
        evidence_next_step: "What evidence threshold would make this actionable next?",
      },
      time: {
        burden: "Given the pace here, what is the immediate practical takeaway?",
        integration: "Where does this fit into today's visit workflow?",
        implementation: "What is the first step we can start this week?",
        training: "How much staff time would training require up front?",
        disruption: "How do we roll it out without slowing patient throughput?",
        evidence_next_step: "What's the quickest way to test if this is worth scaling?",
      },
      policy: {
        burden: "Within our constraints, what is actually actionable?",
        integration: "How does this align with our current pathway requirements?",
        implementation: "Who needs to approve this operationally?",
        training: "What training would compliance require before launch?",
        disruption: "How do we avoid creating bottlenecks with policy checks?",
        evidence_next_step: "What next step is both compliant and feasible now?",
      },
      screening: {
        burden: "I need a practical screening step that fits real clinic flow.",
        integration: "How does this fit with our current intake and charting process?",
        implementation: "Who owns candidacy checks at each handoff point?",
        training: "How do we train staff to apply criteria consistently?",
        disruption: "What happens when screening flags conflict with time pressure?",
        evidence_next_step: "What is the first measurable checkpoint to validate this approach?",
      },
    };
    const concernRedirects = redirectByConcern[concern] || redirectByConcern.workflow;
    const redirect = concernRedirects[stage] || concernRedirects.integration;
    if (!new RegExp(String(redirect).slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(compact)) {
      compact = `${compact} ${redirect}`.trim();
    }
  }

  return hardenTextSurface(compact);
}

function rewriteTooIdealDialogue(dialogue, concern, repWasGeneric) {
  const normalized = hardenTextSurface(dialogue);
  const trimmed = normalized.replace(/\s+/g, " ").trim();
  const workflowBridgeVariants = [
    "I still need to see how this fits without adding workflow burden.",
    "I still need to understand how this fits into workflow without adding burden.",
    "I still need clarity on how this fits our workflow without creating extra burden.",
  ];
  const workflowAskVariants = [
    "Can you give one concrete step my team could actually use this week?",
    "Can you share one concrete step my team could put into practice this week?",
    "Can you give one practical step my team can apply this week?",
  ];
  const variantSeed = `${concern}:${trimmed}:${repWasGeneric ? "generic" : "specific"}`;
  const workflowBridge = workflowBridgeVariants[deterministicIndex(`${variantSeed}:workflow-bridge`, workflowBridgeVariants.length)];
  const workflowAsk = workflowAskVariants[deterministicIndex(`${variantSeed}:workflow-ask`, workflowAskVariants.length)];
  const concernBridges = {
    workflow: workflowBridge,
    evidence: "I still need evidence that feels applicable to the patients I am seeing.",
    access: "Access and prior-auth realities are still a major barrier here.",
    time: "I still have limited time, so keep this to what is immediately useful.",
    policy: "I still need this to fit our current protocol and policy constraints.",
    screening: "I still need clarity on candidacy and screening before moving ahead.",
  };
  const askByConcern = {
    workflow: workflowAsk,
    evidence: "What is the clearest proof point for my practice context?",
    access: "What would you do first when coverage or prior auth blocks progress?",
    time: "What is the single most practical point to focus on right now?",
    policy: "What part of this aligns with our current pathway requirements?",
    screening: "What is the first candidacy checkpoint you would apply in clinic?",
  };

  const unresolved = concernBridges[concern] || concernBridges.workflow;
  const targetedAsk = askByConcern[concern] || askByConcern.workflow;
  const compact = trimmed.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").trim();

  if (repWasGeneric) {
    return `${unresolved} ${targetedAsk}`;
  }

  return `${compact} ${unresolved} ${targetedAsk}`;
}

function enforceCueVariety(candidateCue = "", recentCues = [], seed = "") {
  const safeCue = hardenTextSurface(candidateCue);
  if (!safeCue) return safeCue;
  const normalizedRecent = recentCues
    .slice(-NO_REPEAT_WINDOW_TURNS)
    .map((cue) => String(cue || "").trim())
    .filter(Boolean);
  const isTooSimilar = normalizedRecent.some((priorCue) =>
    calculateTokenOverlapRatio(safeCue, priorCue) >= 0.78
    || calculateSemanticSimilarity(safeCue, priorCue) >= 0.72
  );
  if (!isTooSimilar) return safeCue;

  const cueFallbackPool = [
    "The HCP keeps their reply concise and waits for a practical operational detail.",
    "The HCP scans the chart and returns with a tighter, implementation-focused expression.",
    "The HCP pauses briefly, signaling patience is narrowing around execution details.",
    "The HCP keeps attention on the handoff steps, expecting one realistic next action.",
    "The HCP gives a short nod, focused on feasibility rather than broad framing.",
  ];
  const startIndex = deterministicIndex(`${seed}:cue-semantic-fallback`, cueFallbackPool.length);
  for (let i = 0; i < cueFallbackPool.length; i += 1) {
    const candidate = cueFallbackPool[(startIndex + i) % cueFallbackPool.length];
    const similarToRecent = normalizedRecent.some((priorCue) =>
      calculateSemanticSimilarity(candidate, priorCue) >= 0.72
    );
    if (!similarToRecent) return candidate;
  }
  return cueFallbackPool[startIndex];
}

function countUnresolvedConcernTurns(turns = [], concern = "workflow") {
  const repTurns = (Array.isArray(turns) ? turns : [])
    .filter((turn) => !!turn?.repMessage)
    .slice(-8);

  let unresolvedStreak = 0;
  for (let i = repTurns.length - 1; i >= 0; i -= 1) {
    const repText = String(repTurns[i]?.repMessage || "");
    if (detectConcernAddressed(repText, concern)) break;
    unresolvedStreak += 1;
  }
  return unresolvedStreak;
}

function buildTerminalDecisionDialogue({ concern = "workflow", seed = "" } = {}) {
  const byConcern = {
    workflow: [
      "I'm not seeing a clear operational path here.",
      "This isn't addressing the workflow constraint yet.",
      "I still need something concrete to make this actionable.",
      "If there's a specific workflow change, I need it directly.",
      "Otherwise, this may be something to revisit later.",
    ],
    access: [
      "This isn't addressing the workflow constraint yet.",
      "I still need something concrete to make this actionable.",
      "If there's a specific workflow change, I need it directly.",
      "This may not be practical for our team right now.",
    ],
    evidence: [
      "I'm not seeing a clear operational path here.",
      "This isn't addressing the workflow constraint yet.",
      "I still need something concrete to make this actionable.",
      "Otherwise, this may be something to revisit later.",
    ],
    time: [
      "I'm not seeing a clear operational path here.",
      "I still need something concrete to make this actionable.",
      "This may not be practical for our team right now.",
    ],
    policy: [
      "This isn't addressing the workflow constraint yet.",
      "I still need something concrete to make this actionable.",
      "Otherwise, this may be something to revisit later.",
    ],
    screening: [
      "I'm not seeing a clear operational path here.",
      "I still need something concrete to make this actionable.",
      "If there's a specific workflow change, I need it directly.",
      "This may not be practical for our team right now.",
    ],
  };
  const askOptions = [
    "Do you have something specific?",
    "Is there a concrete change you can point to?",
  ];

  const pool = byConcern[concern] || byConcern.workflow;
  const baseIndex = deterministicIndex(`${seed}:${concern}:terminal-statement`, pool.length);
  const askIndex = deterministicIndex(`${seed}:${concern}:terminal-ask`, askOptions.length);
  const includeAsk = (deterministicIndex(`${seed}:${concern}:terminal-include-ask`, 100) + 1) <= 45;
  const statement = pool[baseIndex];
  return includeAsk ? `${statement} ${askOptions[askIndex]}` : statement;
}

const HCP_STATE_LADDER = [
  "neutral",
  "engaged",
  "time-pressured",
  "resistant",
  "boundary-setting",
  "irritated",
  "disengaged",
];

function escalateHcpState(currentState, steps = 1) {
  const currentIndex = HCP_STATE_LADDER.indexOf(currentState);
  if (currentIndex === -1) return currentState;
  return HCP_STATE_LADDER[Math.min(currentIndex + steps, HCP_STATE_LADDER.length - 1)];
}

const GUIDANCE_PRIORITY_ORDER = [
  "signal_awareness",
  "signal_interpretation",
  "value_connection",
  "customer_engagement",
  "objection_navigation",
  "conversation_management",
  "adaptive_response",
  "commitment_generation",
];

const METRIC_GUIDANCE_LIBRARY = {
  signal_awareness: [
    "⚠ Anchor your next response to the exact operational signal the HCP named.",
    "⚠ Tie your point to this HCP's stated workflow pressure before adding new data.",
    "⚠ Reflect the specific challenge you heard so the HCP sees you are tracking their reality.",
    "⚠ Lead with the context cue the HCP gave, then connect your recommendation.",
    "⚠ Translate your opening line to the HCP's immediate clinic condition, not a generic priority.",
    "⚠ Use the HCP's own wording about constraints to frame your next statement.",
    "⚠ Show awareness first: identify the signal, then advance the conversation.",
  ],
  signal_interpretation: [
    "⚠ Confirm what the HCP meant before proposing the next step.",
    "⚠ Your next turn should test your interpretation with a brief clarifying question.",
    "⚠ Distinguish symptom from root concern before offering a recommendation.",
    "⚠ Interpret the HCP's signal into a concrete implication for care delivery.",
    "⚠ Reframe the concern in one sentence to verify shared understanding.",
    "⚠ Show how you interpreted the cue, then ask the HCP to validate it.",
    "⚠ Convert the HCP's statement into a check-back question before you advance.",
  ],
  value_connection: [
    "⚠ Information was presented; next turn should explain why it matters for this HCP's decisions.",
    "⚠ Connect the data to patient or workflow impact in this specific practice.",
    "⚠ Link your evidence to a measurable outcome the HCP already cares about.",
    "⚠ Move from feature language to practice-level consequence language.",
    "⚠ Tie your recommendation to the HCP's stated treatment objective.",
    "⚠ Clarify the value tradeoff relative to the burden the HCP described.",
    "⚠ Ground your value statement in this clinic's operating reality.",
  ],
  customer_engagement: [
    "⚠ Ask a focused follow-up that invites the HCP to expand their current concern.",
    "⚠ Increase participation by prompting the HCP to rank their top constraint.",
    "⚠ Keep momentum by turning your point into a targeted question.",
    "⚠ Pull the HCP in with a brief either-or question tied to workflow options.",
    "⚠ Encourage dialogue by asking for one concrete example from their practice.",
    "⚠ Advance engagement with a question that requires a practical response.",
    "⚠ Shift from monologue to collaboration by requesting the HCP's preference.",
  ],
  objection_navigation: [
    "⚠ Acknowledge the objection explicitly before redirecting toward options.",
    "⚠ Stay non-defensive and address the concern in the HCP's terms.",
    "⚠ Break the objection into one solvable piece and confirm agreement.",
    "⚠ Validate the concern, then offer a practical mitigation step.",
    "⚠ Respond to the resistance with clarification before persuasion.",
    "⚠ Keep objection handling constructive by testing one feasible alternative.",
    "⚠ Resolve the specific barrier first, then broaden to next steps.",
  ],
  conversation_management: [
    "⚠ Provide a clearer directional bridge so the conversation advances intentionally.",
    "⚠ Signal the next discussion step before introducing new content.",
    "⚠ Tighten your structure: acknowledge, align, then guide to action.",
    "⚠ Use a concise transition that shows where the conversation is headed.",
    "⚠ Keep the exchange focused on one decision point at a time.",
    "⚠ Add a purposeful steering question to avoid drifting into broad statements.",
    "⚠ Frame a clear path from current barrier to immediate next move.",
  ],
  adaptive_response: [
    "⚠ Adjust your approach to match the HCP's current tone and pressure level.",
    "⚠ Your next turn should flex to the cue instead of repeating a fixed script.",
    "⚠ Adapt depth and pace to the HCP's time signal before adding detail.",
    "⚠ Shift from broad messaging to situation-matched guidance.",
    "⚠ Respond to the latest cue with a tailored action option.",
    "⚠ Preserve continuity by explicitly building on the HCP's prior statement.",
    "⚠ Show adaptability by offering the smallest viable next step first.",
  ],
  commitment_generation: [
    "⚠ Close this exchange with a specific, owned next step.",
    "⚠ Convert discussion into commitment by proposing one concrete action.",
    "⚠ Ask for agreement on who will do what and by when.",
    "⚠ Strengthen closure by defining a practical follow-up checkpoint.",
    "⚠ Turn alignment into action with a clear implementation ask.",
    "⚠ Confirm commitment level with a simple next-step question.",
    "⚠ Establish ownership before ending the turn.",
  ],
};

const FALLBACK_GUIDANCE_LIBRARY = {
  misalignment_relevance: [
    "⚠ Data shared without tying it to this HCP's stated workflow burden.",
    "⚠ Missed opportunity to connect the message to this practice context.",
    "⚠ Relevance gap: link your point to the challenge the HCP just named.",
    "⚠ The response stayed informational instead of practice-specific.",
  ],
  misalignment_probe: [
    "⚠ Missed chance to probe the operational constraint the HCP just raised.",
    "⚠ Ask one clarifying question before offering another recommendation.",
    "⚠ The next turn should explore the barrier source, not just restate data.",
    "⚠ Probe the bottleneck directly to improve response precision.",
  ],
  misalignment_adaptation: [
    "⚠ Response did not adapt to the HCP's latest cue.",
    "⚠ Mirror the HCP's signal first, then tailor your next suggestion.",
    "⚠ Adaptation gap: adjust to the pressure level expressed in this turn.",
    "⚠ Use the HCP's immediate concern to shape your next message.",
  ],
  misalignment_closure: [
    "⚠ Good topic progression; now secure a concrete next step.",
    "⚠ Move from discussion to commitment with a specific action ask.",
    "⚠ Clarify ownership to prevent the conversation from stalling.",
    "⚠ Close with a defined follow-up rather than another broad statement.",
  ],
  positive_progress: [
    "✓ Direction is solid — next turn can deepen specificity around implementation.",
    "✓ Good alignment with the HCP signal — now lock in an actionable step.",
    "✓ Strong turn foundation — follow with a targeted practical question.",
    "✓ Productive response — convert this momentum into a clear next move.",
  ],
};

function ensureSentencePunctuation(text) {
  const value = String(text || "").trim();
  if (!value) return "";
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function splitDisplayLines(text, limit = 4) {
  return String(text || "")
    .split(/;|•|\.|,/)
    .map(item => ensureSentencePunctuation(item))
    .filter(Boolean)
    .slice(0, limit);
}

function getDistinctDisplayLines(text, limit = 4) {
  const seen = new Set();
  return splitDisplayLines(text, limit).filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getDetailLines(text, limit = 4) {
  return getDistinctDisplayLines(text, limit).slice(1);
}

function toDisplaySentence(text, fallback = "") {
  const normalized = hardenTextSurface(text || fallback);
  return ensureSentencePunctuation(normalized || fallback);
}

function toDisplayBullet(text, fallback = "") {
  return toDisplaySentence(String(text || "").replace(/^[-*•\s]+/, ""), fallback);
}

function combineItemsWithAnd(items = []) {
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return `${items[0]} and ${items[1].replace(/[.!?]$/, "")}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1].replace(/[.!?]$/, "")}`;
}

function normalizeChallengeSet(items = [], max = 3) {
  const normalized = items
    .map((item) => toDisplayBullet(item))
    .filter(Boolean)
    .filter((item, idx, arr) => arr.findIndex((value) => value.toLowerCase() === item.toLowerCase()) === idx);

  if (normalized.length <= max) return normalized;

  const head = normalized.slice(0, max - 1);
  const tail = normalized.slice(max - 1).map((item) => item.replace(/[.!?]$/, ""));
  return [...head, `${combineItemsWithAnd(tail)}.`];
}

function ensureMinimumItems(items = [], fallbackItems = [], count = 3) {
  const normalized = [...items];
  for (const fallback of fallbackItems) {
    if (normalized.length >= count) break;
    if (!fallback) continue;
    const candidate = toDisplayBullet(fallback);
    if (!candidate) continue;
    if (normalized.some((item) => item.toLowerCase() === candidate.toLowerCase())) continue;
    normalized.push(candidate);
  }
  return normalized.slice(0, count);
}

function buildObjectiveCoachingTip({ stakeholder, objectiveHeadline, challengeHeadline, openingScene }) {
  const stakeholderText = String(stakeholder || "this HCP").trim();
  const objectiveText = String(objectiveHeadline || "secure a practical next step").replace(/[.!?]$/, "").toLowerCase();
  const challengeText = String(challengeHeadline || "").replace(/[.!?]$/, "").toLowerCase();
  const openingCue = getDistinctDisplayLines(openingScene, 1)[0];

  if (challengeText) {
    return toDisplaySentence(`Lead with a concise value statement for ${stakeholderText}, then connect ${objectiveText} to the barrier around ${challengeText}`);
  }

  if (openingCue) {
    return toDisplaySentence(`Use the opening cue "${openingCue.replace(/[.!?]$/, "")}" to guide ${stakeholderText} toward ${objectiveText}`);
  }

  return toDisplaySentence(`Keep the conversation focused on ${objectiveText} and close with a practical commitment from ${stakeholderText}`);
}

function buildChallengeCoachingTip({ stakeholder, challengeHeadline, objectiveHeadline }) {
  const stakeholderText = String(stakeholder || "this HCP").trim();
  const challengeText = String(challengeHeadline || "the main practice barrier").replace(/[.!?]$/, "").toLowerCase();
  const objectiveText = String(objectiveHeadline || "your discussion goal").replace(/[.!?]$/, "").toLowerCase();
  return toDisplaySentence(`Prepare to acknowledge ${challengeText} early, then steer ${stakeholderText} back to ${objectiveText} with a specific follow-up question`);
}

function abbreviateSpecialty(text) {
  const value = String(text || "").trim();
  if (!value) return "";
  if (/internal medicine/i.test(value)) return "IM";
  return value;
}

function stripRedundantSpecialtyFromStakeholder(stakeholder, specialty) {
  const value = String(stakeholder || "").trim();
  const specialtyValue = String(specialty || "").trim().toLowerCase();
  if (!value || !specialtyValue || !value.includes(" - ")) return value;

  const specialtyRoleMap = {
    "internal medicine": ["internal medicine md", "internal medicine physician", "internal medicine"],
    "infectious diseases": ["infectious diseases", "infectious disease specialist", "infectious disease np", "infectious disease"],
    "medical oncology": ["medical oncologist", "medical oncology"],
    "hem/onc": ["hematology/oncology", "hem/onc", "hematologist oncologist"],
    "cardiology": ["cardiologist", "cardiology"],
    "family medicine": ["family medicine", "family physician"],
    "neurology": ["neurologist", "neurology"],
    "pulmonology": ["pulmonologist", "pulmonology"],
  };

  const [name, roleDetails] = value.split(/\s-\s(.+)/, 2);
  if (!name || !roleDetails) return value;

  const roleSegments = roleDetails.split(",").map((segment) => segment.trim()).filter(Boolean);
  const specialtyMatches = specialtyRoleMap[specialtyValue] || [specialtyValue];
  const filteredSegments = roleSegments.filter((segment, index) => {
    if (index !== 0) return true;
    const normalizedSegment = segment.toLowerCase();
    return !specialtyMatches.some((match) => normalizedSegment === match || normalizedSegment.startsWith(`${match} `));
  });

  return filteredSegments.length > 0 ? `${name} - ${filteredSegments.join(", ")}` : name;
}

function toPossessiveName(name = "") {
  const value = String(name || "").trim();
  if (!value) return "";
  return /s$/i.test(value) ? `${value}’` : `${value}’s`;
}

function deriveHcpDisplayName({ stakeholder, hcp, hcpCategory }) {
  const source = String(stakeholder || hcp || "").trim();
  const roleContext = `${source} ${String(hcpCategory || "")}`.toLowerCase();
  const base = source.split(/\s-\s/, 1)[0].split(",")[0].trim();
  const normalizedBase = base.replace(/^dr\.?\s+/i, "").trim();
  const nameTokens = normalizedBase.split(/\s+/).filter(Boolean);
  const firstName = nameTokens[0] || "";
  const lastName = nameTokens.length > 1 ? nameTokens[nameTokens.length - 1] : "";

  const isNpPaRn = /\b(np|nurse practitioner|pa-?c?|physician assistant|rn|registered nurse)\b/i.test(roleContext);
  const isMdDo = /\b(md|do|physician)\b/i.test(roleContext) || /^dr\.?\s/i.test(source);

  if (isMdDo && (lastName || firstName)) {
    return `Dr. ${lastName || firstName}`;
  }

  if (isNpPaRn && firstName) {
    return firstName;
  }

  return base || "HCP";
}

function personalizeCueText(cueText, hcpDisplayName) {
  const cue = String(cueText || "");
  const name = String(hcpDisplayName || "").trim();
  if (!cue || !name) return cue;

  return cue
    .replace(/\b[Tt]he HCP's\b/g, toPossessiveName(name))
    .replace(/\b[Tt]he HCP\b/g, name);
}

function buildHcpProfileSummary({ stakeholder, specialty, descriptionText, context, hcpCategory, hcp }) {
  const cleanedStakeholder = stripRedundantSpecialtyFromStakeholder(stakeholder || hcp, specialty);
  const summaryText = hcp || descriptionText || context || stakeholder || "Profile details are not available for this HCP.";
  return toDisplaySentence(
    specialty
      ? `${cleanedStakeholder || "HCP"} (${abbreviateSpecialty(specialty)}) — ${summaryText}`
      : `${hcpCategory ? `(${hcpCategory}) — ` : ""}${summaryText}`
  );
}

function buildBriefingHeadline(title) {
  const conciseTitle = String(title || "").replace(/\bin\s+/i, ": ").trim();
  return {
    title: conciseTitle,
    subtitle: "",
  };
}

function SimulationContextCard({
  title,
  summary,
  expandedContent,
  previewText,
  previewLabel = "Play Scene",
  fallbackPreview = "Preview the HCP's first beat before you continue the live simulation.",
  expandable = true,
  collapsedSummary,
  expandedSummary,
  icon: Icon,
  inlineTip,
  showSummaryWhenExpanded = true,
}) {
  const [expanded, setExpanded] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [typedPreview, setTypedPreview] = useState("");
  const previewTimerRef = useRef(null);
  const showToggle = expandable && Boolean(expandedContent);
  const collapsedText = collapsedSummary || summary;
  const expandedText = expandedSummary || collapsedText;
  const visibleSummary = expanded ? (showSummaryWhenExpanded ? expandedText : "") : collapsedText;

  useEffect(() => {
    if (!expanded) {
      setPreviewing(false);
      setTypedPreview("");
      if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
      return undefined;
    }

    if (!previewing || !previewText) {
      setTypedPreview("");
      if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
      return undefined;
    }

    let index = 0;
    previewTimerRef.current = window.setInterval(() => {
      index += 1;
      setTypedPreview(previewText.slice(0, index));
      if (index >= previewText.length && previewTimerRef.current) {
        window.clearInterval(previewTimerRef.current);
      }
    }, 18);

    return () => {
      if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
    };
  }, [expanded, previewText, previewing]);

  return (
    <div className={`scenario-card scenario-context-card min-w-0 rounded-[24px] border border-white/10 bg-slate-950/18 p-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_16px_36px_rgba(15,23,42,0.18)] backdrop-blur-sm transition-all duration-200 ${expanded ? "scenario-card-expanded border-teal-300/60" : "min-h-[132px]"}`}>
      <div className="flex h-full flex-col gap-2.5">
        <div className="space-y-2">
          <div
            className={`flex items-center gap-3 ${showToggle ? "cursor-pointer" : ""}`}
            onClick={showToggle ? () => setExpanded(value => !value) : undefined}
            role={showToggle ? "button" : undefined}
            tabIndex={showToggle ? 0 : undefined}
            onKeyDown={showToggle ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setExpanded(value => !value);
              }
            } : undefined}
          >
            <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              {Icon ? <Icon className="h-4.5 w-4.5 text-teal-300" /> : null}
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold uppercase tracking-[0.14em] text-teal-200">{title}</p>
            </div>
          </div>
          {showToggle ? (
            <div className="mt-1 inline-flex items-center justify-center gap-1.5 self-center rounded-full border border-teal-300/40 bg-teal-300/16 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#b7fff4] shadow-[0_0_0_1px_rgba(45,212,191,0.14)]">
              <CornerRightUp className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
              <span>{expanded ? "Tap header to collapse" : "Tap header to expand"}</span>
            </div>
          ) : null}
          {inlineTip ? <p className="text-xs italic leading-5 text-slate-300">💡 {inlineTip}</p> : null}
          {visibleSummary ? (
            <p className="text-sm leading-6 text-slate-100">{visibleSummary}</p>
          ) : null}
        </div>

        {previewText && expanded ? (
          <div className="space-y-2">
            <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 md:flex-row md:items-center md:justify-between">
              <p className="text-sm leading-5 text-slate-200">{fallbackPreview}</p>
              <button
                type="button"
                onClick={() => setPreviewing(value => !value)}
                className="inline-flex items-center justify-center rounded-full bg-teal-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                {previewing ? "Reset Preview" : previewLabel}
              </button>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/20 px-3 py-2.5">
              <p className={`text-sm leading-5 text-slate-200 ${previewing ? "typing-preview" : ""}`}>
                {previewing ? typedPreview || " " : " "}
              </p>
            </div>
          </div>
        ) : null}

        {showToggle && expanded ? (
          <div className="scenario-extra-content is-visible text-slate-200">
            {expandedContent}
          </div>
        ) : null}

      </div>
    </div>
  );
}

function RolePlayBriefingPanel({
  scenario,
  difficultyVisual,
  briefingTitle,
  hcpProfileSummary,
  objectiveText,
  objectiveDetailLines,
  openingScene,
  challengeItems,
  challengeDetailLines,
  showOpeningSceneFallback,
  showScenarioSupportFallback,
  tabPills,
}) {
  return (
    <div className="px-3 md:px-4 pt-3 pb-2 border-b bg-[linear-gradient(180deg,#f3f7fb_0%,#eef4f8_100%)]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-2xl font-bold text-[#1A334D]">{briefingTitle}</h3>
          <span className="rounded-full border px-3 py-1 text-xs font-semibold capitalize" style={difficultyVisual.style}>
            {scenario.difficulty}
          </span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/90 px-2 py-1">
          {tabPills}
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-r from-[#0f172a] via-[#10243b] to-[#123b45] p-3 text-white shadow-xl">
        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-4">
          <SimulationContextCard
            icon={CircleUserRound}
            title="HCP Profile"
            summary={hcpProfileSummary}
            collapsedSummary={hcpProfileSummary}
            expandable={false}
          />

          {objectiveText && (
            <SimulationContextCard
              icon={Target}
              title="Rep Objectives"
              summary=""
              collapsedSummary=""
              inlineTip="TIP: Acknowledge clinical workload first."
              showSummaryWhenExpanded={false}
              expandedContent={objectiveDetailLines.length > 0 ? (
                <div className="space-y-1.5">
                  {objectiveDetailLines.map((item, idx) => (
                    <div key={idx} className="flex gap-2 text-sm leading-5">
                      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-300" />
                      <span>{toDisplayBullet(item)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            />
          )}

          {openingScene ? (
            <SimulationContextCard
              icon={Clapperboard}
              title="Opening Scene"
              summary="Preview the HCP’s setting and opening beat before starting."
              collapsedSummary="Preview the HCP’s setting and opening beat before starting."
              expandedSummary=""
              inlineTip={null}
              showSummaryWhenExpanded={false}
              previewText={ensureSentencePunctuation(openingScene)}
              previewLabel="Play Scene"
              fallbackPreview="Press Play Scene to reveal the HCP’s opening beat."
              expandedContent={<div className="sr-only">Opening scene preview is available via Play Scene.</div>}
            />
          ) : showOpeningSceneFallback ? (
            <SimulationContextCard
              icon={Clapperboard}
              title="Opening Scene"
              summary="Preview the HCP’s setting and opening beat before starting."
              collapsedSummary="Preview the HCP’s setting and opening beat before starting."
              expandable={false}
            />
          ) : null}

          {challengeItems.length > 0 ? (
            <SimulationContextCard
              icon={TriangleAlert}
              title="Key Challenges"
              summary=""
              collapsedSummary=""
              inlineTip="TIP: Use a follow-up to pivot back to the gap."
              showSummaryWhenExpanded={false}
              expandedContent={challengeDetailLines.length > 0 ? (
                <ul className="list-disc pl-4 text-sm leading-5 text-slate-100 space-y-1 marker:text-teal-300">
                  {challengeDetailLines.map((challenge, idx) => (
                    <li key={idx}>{toDisplayBullet(challenge)}</li>
                  ))}
                </ul>
              ) : null}
            />
          ) : showScenarioSupportFallback ? (
            <SimulationContextCard
              icon={Bot}
              title="Scenario Support"
              summary="No scenario support details available."
              collapsedSummary="No scenario support details available."
              expandable={false}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ScenarioBriefingPanel({
  scenario,
  difficultyVisual,
  descriptionText,
  hcpProfileSummary,
  objectiveText,
  objectiveCoachingTip,
  objectiveDetailLines,
  openingScene,
  openingSceneHeadline,
  showOpeningSceneFallback,
  challengeItems,
  challengeCoachingTip,
  challengeDetailLines,
  showScenarioSupportFallback,
}) {
  return (
    <div className="px-3 md:px-4 pt-2 pb-2 border-b bg-[linear-gradient(180deg,#f3f7fb_0%,#eef4f8_100%)]">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-r from-[#0f172a] via-[#10243b] to-[#123b45] p-3.5 text-white shadow-xl">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(300px,1.12fr)_minmax(0,2.88fr)] xl:items-start">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-teal-200/90">
              <span>Role Play Intelligence Hub</span>
              <span className="rounded-full border border-white/15 px-2.5 py-1 text-[10px] tracking-[0.18em] text-white/85">Scenario Briefing</span>
              <span className="rounded-full border px-3 py-1 text-xs font-semibold capitalize" style={difficultyVisual.style}>
                {scenario.difficulty}
              </span>
            </div>
            <h3 className="mt-2 text-[18px] font-bold leading-snug text-white md:text-[22px]">{scenario.title}</h3>
            <div className="max-w-[520px] text-sm leading-6 text-slate-200">
              <span className="block">Review the HCP profile, align to the rep objectives,</span>
              <span className="block">preview the opening scene, and anticipate the three most</span>
              <span className="block">relevant challenge themes before you continue the live simulation.</span>
            </div>

            {descriptionText && (
              <SimulationContextCard
                icon={CircleUserRound}
                title="HCP Profile"
                summary={hcpProfileSummary}
                collapsedSummary={hcpProfileSummary}
                expandable={false}
              />
            )}
          </div>

          <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
            {objectiveText && (
              <SimulationContextCard
                icon={Target}
                title="Rep Objectives"
                summary={objectiveCoachingTip}
                collapsedSummary={objectiveCoachingTip}
                expandedContent={objectiveDetailLines.length > 0 ? (
                  <div className="space-y-2">
                    {objectiveDetailLines.map((item, idx) => (
                      <div key={idx} className="flex gap-2 text-sm leading-6">
                        <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-300" />
                        <span>{toDisplayBullet(item)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              />
            )}

            {openingScene && (
              <SimulationContextCard
                icon={Clapperboard}
                title="Opening Scene"
                summary={ensureSentencePunctuation(openingScene)}
                collapsedSummary={openingSceneHeadline}
                expandedSummary={openingSceneHeadline}
                previewText={ensureSentencePunctuation(openingScene)}
                previewLabel="Play Scene"
                fallbackPreview="Preview the HCP’s first beat before you continue the live simulation."
                expandedContent={<div className="sr-only">Opening scene preview is available via Play Scene.</div>}
              />
            )}

            {showOpeningSceneFallback && (
              <SimulationContextCard
                icon={Clapperboard}
                title="Opening Scene"
                summary="No opening scene provided for this scenario."
                collapsedSummary="No opening scene provided for this scenario."
                expandable={false}
              />
            )}

            {challengeItems.length > 0 && (
              <SimulationContextCard
                icon={TriangleAlert}
                title="Key Challenges"
                summary={challengeCoachingTip}
                collapsedSummary={challengeCoachingTip}
                expandedContent={challengeDetailLines.length > 0 ? (
                  <ul className="list-disc pl-4 text-sm leading-6 text-slate-100 space-y-1 marker:text-teal-300">
                    {challengeDetailLines.map((challenge, idx) => (
                      <li key={idx}>{toDisplayBullet(challenge)}</li>
                    ))}
                  </ul>
                ) : null}
              />
            )}

            {showScenarioSupportFallback && (
              <SimulationContextCard
                icon={Bot}
                title="Scenario Support"
                summary="No scenario support details available."
                collapsedSummary="No scenario support details available."
                expandable={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function deterministicIndex(seedText, total) {
  if (!total) return 0;
  const seed = String(seedText || "");
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash * 31) + seed.charCodeAt(i)) >>> 0;
  }
  return hash % total;
}

function mapIssueCategory(alignment) {
  const firstFlag = String(alignment?.rubricAlignmentFlags?.[0] || "").toLowerCase();
  const firstMisalignment = String(alignment?.misalignments?.[0] || "").toLowerCase();
  const combined = `${firstFlag} ${firstMisalignment}`;

  if (/(matter|relevance|context|why it matters|value)/.test(combined)) return "misalignment_relevance";
  if (/(probe|question|clarify|explore|understand)/.test(combined)) return "misalignment_probe";
  if (/(adapt|signal|cue|tone|responsive|responsiveness)/.test(combined)) return "misalignment_adaptation";
  if (/(next step|commit|closure|owner|follow-up|follow up)/.test(combined)) return "misalignment_closure";
  if (alignment?.positives?.length) return "positive_progress";
  return "misalignment_relevance";
}

function getLowestMetricId(metrics = {}) {
  const entries = Object.entries(metrics || {})
    .filter(([, val]) => Number.isFinite(Number(val?.score)))
    .sort((a, b) => {
      const scoreDiff = Number(a[1].score) - Number(b[1].score);
      if (scoreDiff !== 0) return scoreDiff;
      return GUIDANCE_PRIORITY_ORDER.indexOf(a[0]) - GUIDANCE_PRIORITY_ORDER.indexOf(b[0]);
    });

  return entries[0]?.[0] || null;
}

function buildGuidanceCandidate(turn) {
  const alignment = turn?.alignment;
  if (!alignment) return null;

  const lowestMetricId = getLowestMetricId(alignment.metrics || {});
  const metricGuidanceSet = lowestMetricId ? METRIC_GUIDANCE_LIBRARY[lowestMetricId] : null;
  if (metricGuidanceSet?.length) {
    const metricSignal = alignment.metrics?.[lowestMetricId]?.reason || alignment.misalignments?.[0] || alignment.rubricAlignmentFlags?.[0] || "metric";
    const index = deterministicIndex(`${turn.turnNumber}:${lowestMetricId}:${metricSignal}`, metricGuidanceSet.length);
    return metricGuidanceSet[index];
  }

  const category = mapIssueCategory(alignment);
  const fallbackSet = FALLBACK_GUIDANCE_LIBRARY[category] || FALLBACK_GUIDANCE_LIBRARY.misalignment_relevance;
  const issueSignal = alignment.rubricAlignmentFlags?.[0] || alignment.misalignments?.[0] || alignment.positives?.[0] || "fallback";
  const index = deterministicIndex(`${turn.turnNumber}:${category}:${issueSignal}`, fallbackSet.length);
  return fallbackSet[index];
}

function buildRepGuidance(turn, allTurns = []) {
  const alignment = turn?.alignment;
  if (!alignment) return null;

  const recentGuidanceWindow = allTurns
    .filter((t) => t.turnNumber < turn.turnNumber && t.repMessage)
    .slice(-15)
    .map((t) => String(buildGuidanceCandidate(t)).trim())
    .filter(Boolean);

  const lowestMetricId = getLowestMetricId(alignment.metrics || {});
  const metricGuidanceSet = lowestMetricId ? METRIC_GUIDANCE_LIBRARY[lowestMetricId] : null;

  const pickNonRepeatingGuidance = (guidanceSet, seedText) => {
    if (!guidanceSet?.length) return null;
    const baseIndex = deterministicIndex(seedText, guidanceSet.length);
    for (let offset = 0; offset < guidanceSet.length; offset += 1) {
      const candidate = guidanceSet[(baseIndex + offset) % guidanceSet.length];
      if (!recentGuidanceWindow.includes(candidate)) return candidate;
    }
    return guidanceSet[baseIndex];
  };

  if (metricGuidanceSet?.length) {
    const metricSignal = alignment.metrics?.[lowestMetricId]?.reason || alignment.misalignments?.[0] || alignment.rubricAlignmentFlags?.[0] || "metric";
    return pickNonRepeatingGuidance(metricGuidanceSet, `${turn.turnNumber}:${lowestMetricId}:${metricSignal}`);
  }

  const category = mapIssueCategory(alignment);
  const fallbackSet = FALLBACK_GUIDANCE_LIBRARY[category] || FALLBACK_GUIDANCE_LIBRARY.misalignment_relevance;
  const issueSignal = alignment.rubricAlignmentFlags?.[0] || alignment.misalignments?.[0] || alignment.positives?.[0] || "fallback";
  return pickNonRepeatingGuidance(fallbackSet, `${turn.turnNumber}:${category}:${issueSignal}`);
}

export default function RolePlayChat({ scenario, onClose, _onSessionSaved }) {
  const [turns, setTurns] = useState([]);
  // Only use unique opening scene from scenario, never fallback placeholder
  const openingScene = scenario.opening_scene || scenario.openingScene || null;
  const openingSceneNormalized = String(openingScene || "").toLowerCase().trim();
  const openingSceneSignature = openingSceneNormalized.split(/\s+/).filter(Boolean).slice(0, 8).join(" ");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [activeTab, setActiveTab] = useState("chat");
  const [coachingTip, setCoachingTip] = useState(null);
  const [voiceSettings, setVoiceSettings] = useState({ ttsEnabled: true, volume: 0.9, rate: 1.0 });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  // Stable session ID for deterministic cue selection
  const sessionIdRef = useRef(`session_${Date.now()}`);
  const sid = sessionIdRef.current;
  // Mutable simulation state — NOT in React state (no re-renders on change)
  const simStateRef = useRef({ temperature: 'neutral', severity: 0 });
  const sendInFlightRef = useRef(false);
  const activeRequestIdRef = useRef(0);
  const sessionControllerRef = useRef({
    state: SessionState.ACTIVE,
    isActive: true,
    isProcessingTurn: false,
    pendingResponseQueue: [],
  });
  const lastSubmittedTurnKeyRef = useRef("");
  const loggedTurnKeysRef = useRef(new Set());
  const processedTurnKeysRef = useRef(new Set());
  const repInferenceStateRef = useRef(createInitialRepInferenceState());
  const recentDialoguePhrasesRef = useRef([]);
  const recentCueHistoryRef = useRef([]);

  const {
    isListening, isSpeaking, interim, sttSupported, ttsSupported,
    toggleListening, stopListening, speak, stopSpeaking,
  } = useVoice({
    onTranscript: (text) => setInput((prev) => prev ? prev + " " + text : text),
    voiceSettings,
  });

  const objectiveText = Array.isArray(scenario.objective)
    ? scenario.objective.join("; ")
    : (scenario.objective || scenario.goal || "Guide this HCP interaction toward a clear, mutually agreed next step.");
  const descriptionText = scenario.hcp || scenario.description || scenario.context || "";
  const challengeItems = (Array.isArray(scenario.challenges)
    ? scenario.challenges
    : String(scenario.challenges || "")
      .split(/\n|;/)
  )
    .map((v) => String(v || "").replace(/^[-*\s]+/, "").trim())
    .filter(Boolean)
    .filter((item) => {
      const lower = item.toLowerCase();
      if (/^opening\s*scene\b/i.test(item)) return false;
      if (lower.includes("opening scene")) return false;
      if (openingSceneSignature && lower.includes(openingSceneSignature)) return false;
      return true;
    });
  const briefingHeadline = buildBriefingHeadline(scenario.title);
  const objectiveBaseItems = ensureMinimumItems(getDistinctDisplayLines(objectiveText, 6).map((item) => toDisplayBullet(item)), [
    "Open with a concise value statement.",
    "Link PrEP gaps to patient safety.",
    "Address low candidate volume bias.",
  ], 3);
  const normalizedChallengeItems = normalizeChallengeSet(challengeItems, 3);
  const objectiveItems = objectiveBaseItems;
  const objectiveDetailLines = objectiveItems.slice(0, 3);
  const challengeDetailLines = ensureMinimumItems(normalizedChallengeItems, [
    "Skepticism: Few patients are candidates.",
    "Clinical: Renal safety and monitoring load.",
    "Administrative: Prior auth and time constraints.",
  ], 3);
  const hcpProfileSummary = buildHcpProfileSummary({
    stakeholder: scenario.stakeholder,
    specialty: scenario.specialty,
    descriptionText,
    context: scenario.context,
    hcpCategory: scenario.hcp_category,
    hcp: scenario.hcp,
  });
  const hcpDisplayName = deriveHcpDisplayName({
    stakeholder: scenario.stakeholder,
    hcp: scenario.hcp,
    hcpCategory: scenario.hcp_category,
  });
  const difficultyVisual = getDifficultyVisuals(scenario.difficulty);
  const showScenarioContext = Boolean(descriptionText || openingScene || objectiveText || challengeItems.length > 0);
  const showOpeningSceneFallback = !openingScene && Boolean(objectiveText);
  const showScenarioSupportFallback = challengeItems.length === 0 && !openingScene && !objectiveText;
  const scenarioKeywords = extractScenarioKeywords(scenario);

  useEffect(() => {
    if (activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      // Auto-focus input after each turn when not loading
      if (!isLoading && !isEnding) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, [turns, activeTab, isLoading, isEnding]);

  // ─── INIT ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const controller = sessionControllerRef.current;
    controller.state = SessionState.ACTIVE;
    controller.isActive = true;
    controller.isProcessingTurn = false;
    controller.pendingResponseQueue = [];
    const init = async () => {
      setIsLoading(true);
      try {
        const initialState = deriveInitialState(scenario);
        const initialTemp = deriveInitialTemperature(initialState);
        simStateRef.current = { temperature: initialTemp, severity: 0 };
        repInferenceStateRef.current = createInitialRepInferenceState();

        // Build a locked profile for turn 0 to establish initial cue and context
        const initialProfile = buildHCPProfile({
          sessionId: sid,
          turnNumber: 0,
          structuralState: initialState,
          temperature: initialTemp,
          severity: 0,
        });

        // Initialize turn 0: REP SPEAKS FIRST (not HCP)
        // No HCP dialogue needed — rep opens the interaction
        setTurns([
          {
            turnNumber: 0,
            hcpStateBefore: initialState,
            temperatureBefore: initialTemp,
            severityBefore: 0,
            cueBefore: initialProfile.lockedCue,
            hcpDialogueBefore: null, // Rep speaks first, no HCP dialogue
            repMessage: null,
            alignment: null,
            hcpStateAfter: null,
          }
        ]);
      } catch (err) {
        console.error('Init error:', err);
        setTurns([]);
      } finally {
        setIsLoading(false);
        // Auto-focus input on initial load
        setTimeout(() => inputRef.current?.focus(), 200);
      }
    };
    init();

    return () => {
      const cleanupController = sessionControllerRef.current;
      cleanupController.isActive = false;
      cleanupController.state = SessionState.ENDED;
      cleanupController.isProcessingTurn = false;
      cleanupController.pendingResponseQueue = [];
      activeRequestIdRef.current += 1;
    };
  }, [scenario]);

  // ─── SEND MESSAGE ─────────────────────────────────────────────────────────────
  const sendMessage = async (rawInput = input) => {
    const controller = sessionControllerRef.current;
    const normalizedInput = String(rawInput || "").trim();
    if (!normalizedInput) return;
    if (!controller.isActive || controller.state === SessionState.ENDED || controller.state === SessionState.CLOSING) return;
    if (controller.isProcessingTurn || sendInFlightRef.current) {
      controller.pendingResponseQueue.push(normalizedInput);
      return;
    }

    // TURN ORDER RULE
    // Rep and HCP messages must alternate.
    // Rep → HCP → Rep → HCP
    // Multiple rep messages in a row are not allowed.
    const lastTurn = turns[turns.length - 1];
    const lastRenderedSpeakerIsRep = Boolean(lastTurn?.repMessage);
    const awaitingHcpResponse = lastTurn && !lastTurn.repMessage && Boolean(lastTurn.hcpDialogueBefore);
    const canSendOnOpeningTurn = lastTurn && lastTurn.turnNumber === 0 && !lastTurn.repMessage && !lastTurn.hcpDialogueBefore;
    if (lastRenderedSpeakerIsRep || (!awaitingHcpResponse && !canSendOnOpeningTurn)) {
      return;
    }

    const normalizedRawInput = normalizedInput.toLowerCase();
    const candidateTurnKey = `${lastTurn?.turnNumber ?? -1}::${normalizedRawInput}`;
    if (candidateTurnKey && candidateTurnKey === lastSubmittedTurnKeyRef.current) {
      return;
    }

    // Declare all variables at the top
    let nextHcpDialogue = '';
    let contextualCue = '';
    if (!sanitizeUserMessage(normalizedInput) || isLoading) return;
    if (turns.filter((t) => t.repMessage).length > 0 && isLowSubstanceAck(normalizedInput)) {
      setCoachingTip({
        tip: "⚠ Add one concrete detail before sending.",
        label: "Coaching",
        suggestion: "Name the operational barrier you heard, then ask one practical follow-up.",
        severity: "warning",
        escalationLabel: "Low-substance reply blocked",
      });
      return;
    }

    controller.isProcessingTurn = true;
    controller.state = SessionState.PROCESSING;
    sendInFlightRef.current = true;
    const requestId = ++activeRequestIdRef.current;
    lastSubmittedTurnKeyRef.current = candidateTurnKey;
    try {
      const repMessage = sanitizeUserMessage(normalizedInput);
      setInput("");
      setIsLoading(true);

    // Stop mic if it's still listening when message is sent
    if (isListening) {
      stopListening();
    }

    // The turn the rep is responding to = last turn in the array (which has a hcpDialogueBefore but no repMessage yet)
    const respondingToTurn = turns[turns.length - 1];
    if (!respondingToTurn || respondingToTurn.repMessage) {
      setIsLoading(false);
      return;
    }
    const generationKey = `${respondingToTurn.turnNumber}::${repMessage.toLowerCase()}`;
    if (processedTurnKeysRef.current.has(generationKey)) {
      setIsLoading(false);
      return;
    }
    const prevState = respondingToTurn.hcpStateBefore;
    const prevTemp = respondingToTurn.temperatureBefore || simStateRef.current.temperature;
    const prevSev = respondingToTurn.severityBefore ?? simStateRef.current.severity;

    // 1. Score alignment against the locked state + temperature the rep SAW
    // Score BEFORE any temperature escalation from disagreement
    const prevHcpState = turns.length >= 2 ? turns[turns.length - 2].hcpStateBefore : null;
    const repLower = String(repMessage || "").toLowerCase();
    const priorRepTurnsCount = turns.filter((t) => !!t.repMessage).length;
    const greetingSignals = /\b(hi|hello|hey|good morning|good afternoon|good evening|how are you|how's it going|hows it going|how was your weekend|nice to meet you|good to see you|thanks for your time)\b/;
    const businessSignals = /\b(prep|hiv|sti|cab|cabotegravir|injectable|screening|resistance|adherence|study|trial|data|results|efficacy|durability|monitoring|protocol|materials?|brochure|resource|patients?)\b/;
    const isPleasantryOnly = greetingSignals.test(repLower) && !businessSignals.test(repLower);
    const inPleasantryGracePeriod = isPleasantryOnly && priorRepTurnsCount < 2;

    let alignment = computeAlignment(
      prevState,
      repMessage,
      { hcpUtterance: respondingToTurn?.hcpDialogueBefore || "" },
      prevTemp,
      prevHcpState
    );
    if (inPleasantryGracePeriod) {
      const normalizedMetrics = Object.fromEntries(
        Object.entries(alignment?.metrics || {}).map(([cap, val]) => [
          cap,
          { ...val, score: 3, reason: "Pleasantry grace period (opening social exchange)." },
        ])
      );

      alignment = {
        ...alignment,
        score: 3,
        positives: [],
        misalignments: [],
        rubricAlignmentFlags: [],
        metrics: normalizedMetrics,
      };
    }

    // 2. Detect rep interruption/leave intent and override HCP state if needed
    let overrideExit = false;
    if (hasExplicitExitIntent(repMessage)) {
      overrideExit = true;
    }

    const lowValueResponse = detectLowValueRepResponse(repMessage);
    const priorRepTurns = turns.filter((t) => !!t.repMessage).length;
    const poorTurns = countRecentLowValueRepTurns(
      turns.filter((t) => t.repMessage).map((t) => ({ repMessage: t.repMessage })),
      repMessage,
    );

    // 3. Transition structural state and base temperature (deterministic)
    let nextHcpState = transitionState(prevState, repMessage, prevTemp);
    let nextTemp = transitionTemperature(prevTemp, repMessage);
    let nextSev = transitionSeverity(prevSev, alignment, prevState, nextHcpState);

    if (lowValueResponse) {
      nextHcpState = escalateHcpState(nextHcpState, 1);
    }

    if (poorTurns >= 2) {
      nextHcpState = "disengaged";
    }

    const nextTurnNumber = turns.length;
    const forceTerminalDisengagement = shouldForceTerminalDisengagement({
      nextHcpState,
      poorTurns,
      priorRepTurns,
    });
    const terminalCloseFallback = getDeterministicTerminalClose(
      `${generationKey}:${nextTurnNumber}:${poorTurns}:${repMessage}`,
    );

    // 4. Override HCP state for schedule_exit/closure if rep signals leave/interruption
    if (overrideExit) {
      nextHcpState = 'disengaged';
      nextTemp = 'neutral';
      nextSev = 0;
    }

    // 5. APPLY HCP DISAGREEMENT ESCALATION TO NEXT TEMPERATURE
    // Escalate temperature for the NEXT turn, not for current alignment scoring
    if (respondingToTurn.hcpDisagreed && !overrideExit) {
      const escalatedIndex = escalateForDisagreement(
        TEMPERATURES.indexOf(nextTemp),
        respondingToTurn.disagreementInfo
      );
      const clampedIndex = Math.max(0, Math.min(escalatedIndex, TEMPERATURES.length - 1));
      nextTemp = TEMPERATURES[clampedIndex];
      // This escalation is only for the next turn, not for current scoring
    }

    simStateRef.current = { temperature: nextTemp, severity: nextSev };

    // 3. Update turn-level engagement and state
    const prevEngagementScore = respondingToTurn.engagementScore ?? 2;
    const conversationHistory = turns.map(t => ({ repMessage: t.repMessage, hcpDialogue: t.hcpDialogueBefore }));
    const turnState = updateTurnState(prevState, repMessage, prevEngagementScore, conversationHistory);
    const previousDecayTier = respondingToTurn.engagementDecayTier || "engaged";
    const previousPressureScore = Number.isFinite(respondingToTurn.engagementPressureScore)
      ? respondingToTurn.engagementPressureScore
      : 0;
    const concernSourceText = `${respondingToTurn?.hcpDialogueBefore || ""} ${scenario?.description || ""} ${scenario?.context || ""}`;
    const activeConcern = detectPrimaryConcern(concernSourceText);
    const recentUserConstraintCandidates = extractConstraintCandidatesFromTurns(turns, 3);
    const currentUserConstraintCandidates = extractConstraintCandidatesFromText(respondingToTurn?.hcpDialogueBefore || "");
    const rawUserConstraintCandidates = mergeConstraintCandidates([
      ...recentUserConstraintCandidates,
      ...currentUserConstraintCandidates,
    ]);
    const scenarioGroundingText = [
      scenario?.title,
      scenario?.description,
      scenario?.context,
      scenario?.opening_scene,
      scenario?.openingScene,
      scenario?.objective,
      Array.isArray(scenario?.challenges) ? scenario.challenges.join(" ") : "",
    ].join(" ");
    const dialogueGroundingTurns = [
      ...turns.map((turn) => turn?.hcpDialogueBefore || ""),
      respondingToTurn?.hcpDialogueBefore || "",
    ].filter(Boolean);
    const groundingState = buildConstraintGrounding({
      scenarioText: scenarioGroundingText,
      dialogueTurns: dialogueGroundingTurns,
    });
    const groundedConstraintTypes = [...groundingState.groundedTypes];
    const newConstraintTypesThisTurn = detectOperationalConstraintTypes(respondingToTurn?.hcpDialogueBefore || "");
    const priorOperationalConstraints = respondingToTurn?.plannerStateSnapshot?.activeOperationalConstraints
      || respondingToTurn?.activeOperationalConstraints
      || [];
    const previouslySurfacedConstraintTypes = respondingToTurn?.plannerStateSnapshot?.surfacedOperationalConstraintTypes
      || respondingToTurn?.surfacedOperationalConstraintTypes
      || [];
    const operationalConstraintState = buildOperationalConstraintState({
      previousConstraints: priorOperationalConstraints,
      rawCandidates: rawUserConstraintCandidates,
      fallbackConcern: activeConcern,
      sourceTurnNumber: nextTurnNumber,
      latestUserTurn: respondingToTurn?.hcpDialogueBefore || "",
      latestRepTurn: repMessage,
    });
    const normalizedActiveConstraints = operationalConstraintState.normalizedActiveConstraints;
    const transcriptConstraintPresent = currentUserConstraintCandidates.length > 0 || recentUserConstraintCandidates.length > 0;
    emitPlannerTrace("constraints_extracted", {
      turnNumber: nextTurnNumber,
      rawUserConstraintCandidates,
      activeOperationalConstraints: operationalConstraintState.activeOperationalConstraints,
      operationalConstraintLedger: operationalConstraintState.allOperationalConstraints,
      primaryOperationalConstraint: operationalConstraintState.primaryOperationalConstraint,
      normalizedActiveConstraints,
      transcriptConstraintPresent,
    });
    const scenarioFamily = detectScenarioFamily(concernSourceText);
    const decayState = deriveEngagementDecay({
      previousTier: previousDecayTier,
      previousPressure: previousPressureScore,
      repMessage,
      activeConcern,
      concernSourceText,
      scenarioKeywords,
    });
    const unresolvedConcernTurns = countUnresolvedConcernTurns(
      [...turns, { repMessage }],
      activeConcern,
    );
    const priorRepMessage = [...turns]
      .slice(0, -1)
      .reverse()
      .find((t) => t?.repMessage)?.repMessage || "";
    const concernFlowOutcome = classifyConcernFlowOutcome({
      activeConcern,
      repMessage,
      priorRepMessage,
      scenarioFamily,
    });
    const recentMisses = [...turns]
      .filter((t) => t?.repMessage)
      .slice(-3)
      .reduce((count, t) => {
        const prior = [...turns]
          .slice(0, Math.max(0, turns.findIndex((x) => x.turnNumber === t.turnNumber)))
          .reverse()
          .find((x) => x?.repMessage)?.repMessage || "";
        const outcome = classifyConcernFlowOutcome({
          activeConcern,
          repMessage: t.repMessage,
          priorRepMessage: prior,
          scenarioFamily,
        });
        return (outcome === "missed" || outcome === "overpivot") ? count + 1 : count;
      }, 0);
    const recoveryTiming = classifyRecoveryTiming({ recentMisses });
    const repHasConcreteMove = hasConcreteOperationalMove(repMessage);
    const repHasFollowUpCommitment = hasSpecificFollowUpCommitment(repMessage);
    const repDefersImmediateAction = isDeferringWithoutImmediateAction(repMessage);
    const terminalDecisionTriggerActive =
      ["impatient", "disengaging"].includes(decayState.tier)
      && unresolvedConcernTurns >= 3
      && ((!repHasConcreteMove && !repHasFollowUpCommitment) || repDefersImmediateAction);
    const terminalDecisionMode = terminalDecisionTriggerActive;
    const hardLoopBreaker =
      (decayState.tier === "disengaging" || (decayState.tier === "impatient" && repDefersImmediateAction))
      && unresolvedConcernTurns >= 5
      && ((!repHasConcreteMove && !repHasFollowUpCommitment) || repDefersImmediateAction);
    const objectiveRanking = rankResponseObjective({
      overrideExit,
      terminalDecisionMode,
      hardLoopBreaker,
      concernFlowOutcome,
      activeConstraints: normalizedActiveConstraints,
      activeOperationalConstraints: operationalConstraintState.activeOperationalConstraints,
      latestUserTurn: respondingToTurn?.hcpDialogueBefore || "",
    });
    const chosenResponseObjective = objectiveRanking.selectedObjective;
    const plannerStateSnapshot = {
      activeConcern,
      normalizedActiveConstraints,
      activeOperationalConstraints: operationalConstraintState.activeOperationalConstraints,
      operationalConstraintLedger: operationalConstraintState.allOperationalConstraints,
      primaryOperationalConstraint: operationalConstraintState.primaryOperationalConstraint,
      groundedConstraintTypes,
      surfacedOperationalConstraintTypes: previouslySurfacedConstraintTypes,
      constraintSourceTurn: operationalConstraintState.primaryOperationalConstraint?.constraintSourceTurn ?? null,
      constraintStatus: operationalConstraintState.primaryOperationalConstraint?.constraintStatus ?? null,
      constraintType: operationalConstraintState.primaryOperationalConstraint?.constraintType ?? null,
      concernFlowOutcome,
      engagementTier: decayState.tier,
      unresolvedConcernTurns,
      chosenResponseObjective,
      objectiveRanking,
    };
    emitPlannerTrace("response_objective_selected", {
      turnNumber: nextTurnNumber,
      chosenResponseObjective,
      primaryConstraint: objectiveRanking.primaryConstraint,
      hasActiveConstraint: objectiveRanking.hasActiveConstraint,
      directOperationalQuestion: objectiveRanking.directOperationalQuestion,
      selectedObjectiveAccountsForConstraint: objectiveRanking.selectedObjectiveAccountsForConstraint,
      rankedObjectives: objectiveRanking.rankedObjectives,
      concernFlowOutcome,
      terminalDecisionMode,
      hardLoopBreaker,
      overrideExit,
    });

    if (hardLoopBreaker) {
      nextHcpState = "disengaged";
    }

    // 3. Lock rep's response
    const lockedRespondingTurn = {
      ...respondingToTurn,
      repMessage,
      alignment,
      hcpStateAfter: nextHcpState,
      temperatureAfter: nextTemp,
      engagementScore: turnState.engagementScore,
      engagementLevel: turnState.engagementLevel,
      emotionalValence: turnState.emotionalValence,
      stance: turnState.stance,
      reactionTrigger: turnState.reactionTrigger,
      conversationalMomentum: turnState.conversationalMomentum,
      timePressure: turnState.timePressure,
      activeConcern,
      activeConstraints: normalizedActiveConstraints,
      activeOperationalConstraints: operationalConstraintState.activeOperationalConstraints,
      operationalConstraintLedger: operationalConstraintState.allOperationalConstraints,
      primaryOperationalConstraint: operationalConstraintState.primaryOperationalConstraint,
      plannerStateSnapshot,
      engagementDecayTier: decayState.tier,
      engagementPressureScore: decayState.pressureScore,
      generationKey,
    };
    emitPlannerTrace("constraints_written_to_state", {
      turnNumber: nextTurnNumber,
      plannerStateSnapshot,
      plannerStateConstraintPresent: normalizedActiveConstraints.length > 0,
    });

    // 4. Build locked HCP profile for the NEXT turn — SINGLE SOURCE OF TRUTH
    // This guarantees cue and dialogue ALWAYS match the same state
    const nextProfile = buildHCPProfile({
      sessionId: sid,
      turnNumber: nextTurnNumber,
      structuralState: nextHcpState,
      temperature: nextTemp,
      severity: nextSev,
    });

    // 5. Build history for LLM context
    const prevTurns = [...turns.slice(0, turns.length - 1), lockedRespondingTurn];
    const historyText = flattenTurns(prevTurns)
      .map((m) => `${m.role === "user" ? "Sales Rep" : "HCP"}: ${m.content}`)
      .join("\n");

    // 6. Generate next HCP dialogue using buildHCPDialoguePrompt — ensures cue/state/dialogue alignment
    const priorHcpDialogueTurns = turns.filter((t) => !!t.hcpDialogueBefore).length;
    const isFirstHcpResponse = (
      respondingToTurn.turnNumber === 0
      && !respondingToTurn.hcpDialogueBefore
      && priorRepTurns === 0
      && priorHcpDialogueTurns === 0
    );

    const scenarioContext = [
      String(scenario.id || ""),
      String(scenario.title || ""),
      String(scenario.opening_scene || scenario.openingScene || ""),
      String(scenario.description || scenario.context || ""),
      String(scenario.objective || ""),
      Array.isArray(scenario.challenges) ? scenario.challenges.join(" ") : String(scenario.challenges || ""),
    ].join(" ").trim();
    const scenarioLower = scenarioContext.toLowerCase();
    const scenarioPressured = /\b(busy|behind|limited time|short on time|time pressure|running late|short-staffed|paperwork|drowning|prior auth|authorization|workflow friction|backlog)\b/.test(scenarioLower);
    const scenarioPrepFocus = /\bprep|hiv|sti\b/.test(scenarioLower);
    const scenarioCabFocus = /\bcab|cabotegravir|injectable|long-acting\b/.test(scenarioLower);
    const scenarioScreeningFocus = /\bscreening|resistance|adherence|candidacy|criteria\b/.test(scenarioLower);
    const scenarioMonitoringFocus = /\bmonitoring|follow-up|durability|protocol|renal|labs?\b/.test(scenarioLower);
    const scenarioPayerFocus = /\b(payer|medical director|health plan|utilization management|coverage policy|reimbursement)\b/.test(scenarioLower);
    const scenarioCommitteeFocus = /\b(committee|formulary|p&t|pharmacy and therapeutics|value analysis)\b/.test(scenarioLower);
    const scenarioPathwayWorkflowFocus = /\b(pathway|workflow|operational|operations|staffing|implementation|throughput|clinic flow)\b/.test(scenarioLower);
    const scenarioOncologyKOLFocus = /\b(kol|key opinion leader|high-scrutiny|high scrutiny|peer-to-peer|peer review|tumor board)\b/.test(scenarioLower);
    const scenarioOralOncOnboardingFocus = /\b(oral oncolytic|oncolytic onboarding|tminus7|t-?minus-?7|refill gap|start form|onboarding)\b/.test(scenarioLower);
    const scenarioPostMiTransitionsFocus = /\b(post-?mi|post mi|myocardial infarction|heart failure|hf transitions|readmission|discharge|transition of care|toc)\b/.test(scenarioLower);

    const buildFirstTurnScenarioFallback = () => {
      const warmGreeting = inPleasantryGracePeriod
        ? "I'm doing well, thanks for asking."
        : "Thanks for checking in.";
      const strictKolEvidenceContext = (
        /\bonc-kol\b|\bkey opinion leader\b|\bkol\b/.test(scenarioLower)
        && /\b(skeptic|skeptical|peer-reviewed|phase 3|overall survival|long-term data|published)\b/.test(scenarioLower)
      );
      const strictOralOncOnboardingContext = (
        /\bonc_pa_gu_oral_onc_tminus7\b|\boral oncolytic\b/.test(scenarioLower)
        && /\b(refill gap|day-25|day 25|day-30|day 30|hub enrollment|t-?7|onboarding)\b/.test(scenarioLower)
      );
      const strictPostDischargeTransitionsContext = (
        /\bcv_pa_postmi_transitions\b|\bpost-?mi\b|\bmyocardial infarction\b|\bheart failure\b/.test(scenarioLower)
        && /\b(discharge|transition|readmission|day-7|day 7|handoff|gdmt)\b/.test(scenarioLower)
      );

      if (scenarioPrepFocus && scenarioPressured) {
        return `${warmGreeting} I've been catching up on patient charts and prior authorizations, so I only have a couple minutes. What brings you in today?`;
      }

      if (scenarioCabFocus && scenarioScreeningFocus) {
        return `${warmGreeting} I've been reviewing candidacy and screening questions for long-acting cabotegravir, and I only have a couple minutes. What brings you in today?`;
      }

      if (strictKolEvidenceContext) {
        return `${warmGreeting} I have a tight window, and for KOL discussions I need evidence I can defend with peer-reviewed rigor. What's your strongest decision-level data point?`;
      }

      if (strictOralOncOnboardingContext) {
        return `${warmGreeting} Our oral oncolytic starts are still hitting refill gaps around day 25 to 30, so I need a concrete onboarding workflow fix. Where do you want us to intervene first?`;
      }

      if (strictPostDischargeTransitionsContext) {
        return `${warmGreeting} Our post-discharge MI/HF handoffs are where readmission risk shows up, so keep this tied to transition workflow. What's the first operational step you'd recommend?`;
      }

      if (scenarioCommitteeFocus) {
        return `${warmGreeting} We're reviewing formulary and P&T considerations this week, so let's keep this focused. What's the key update you wanted to share?`;
      }

      if (scenarioPayerFocus) {
        return `${warmGreeting} I've been focused on payer coverage and utilization criteria, so I can give you a couple minutes. What's most relevant for medical director review?`;
      }

      if (scenarioPathwayWorkflowFocus) {
        return `${warmGreeting} We're working through pathway and staffing workflow updates right now, so keep it practical. What change are you recommending?`;
      }

      if (scenarioOncologyKOLFocus) {
        return `${warmGreeting} Before we go further, I need evidence we can defend in front of our KOL group, not broad claims. What's the most decision-relevant data point?`;
      }

      if (scenarioOralOncOnboardingFocus) {
        return `${warmGreeting} Our oral oncolytic starts are losing momentum between onboarding and first refill, so I need an operational fix, not a concept. Where should we intervene first?`;
      }

      if (scenarioPostMiTransitionsFocus) {
        return `${warmGreeting} Our post-MI and heart failure discharge transitions are where readmissions creep in, so keep this tightly tied to handoffs and follow-up execution. What is your first-step recommendation?`;
      }

      if (scenarioMonitoringFocus) {
        return `${warmGreeting} I've been tightening our follow-up and monitoring workflow, and I only have a couple minutes. What brings you in today?`;
      }

      if (scenarioPressured) {
        return `${warmGreeting} I'm between patients and paperwork right now, so I only have a couple minutes. What brings you in today?`;
      }

      return scenarioPrepFocus
        ? `${warmGreeting} I can spare a focused minute or two. If this is about PrEP access, start with the biggest barrier you're solving.`
        : `${warmGreeting} I can spare a focused minute or two. Give me the one practical issue you're here to solve today.`;
    };

    const buildFollowUpScenarioFallback = () => {
      const repLower = String(repMessage || "").toLowerCase();
      const mentionsStudy = /\b(study|trial|data|results|evidence|jama|publication|published|findings|methodology|duration)\b/.test(repLower);
      const mentionsMaterials = /\b(material|materials|brochure|handout|leave-behind|leave behind|resource|resources|printout|one-pager|flyer)\b/.test(repLower);

      if (nextHcpState === "irritated") {
        return lowValueResponse
          ? "I'm not getting a clear answer here."
          : "I'm not getting a practical answer here.";
      }

      if (nextHcpState === "disengaged") {
        return terminalCloseFallback;
      }

      if (repHasFollowUpCommitment && ["impatient", "disengaging"].includes(decayState.tier)) {
        return "Thanks. Please include payer-specific variation handling in that workflow plan and send it by the time you committed.";
      }

      if (nextHcpState === "time-pressured") {
        return "Just give me one practical step.";
      }

      if (mentionsStudy) {
        return "I'd like to know more about the study's methodology. What was the duration of the study?";
      }

      if (mentionsMaterials && scenarioPrepFocus) {
        return "Are the materials you'll be leaving going to help my patients understand how to gain access to PrEP without jumping through so many hoops?";
      }

      if (scenarioCabFocus && scenarioScreeningFocus) {
        return "Before we move forward, what practical steps would you recommend so we can confirm candidacy and screening requirements for long-acting cabotegravir?";
      }

      if (scenarioMonitoringFocus) {
        return "What is the most practical monitoring plan we can apply consistently without overloading the clinic team?";
      }

      const repTopicTokens = repLower
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w && !new Set(["the", "and", "for", "with", "that", "this", "your", "have", "from", "what", "about", "today", "patient", "patients"]).has(w))
        .slice(0, 5);
      const repTopic = repTopicTokens.join(" ");

      if (scenarioPrepFocus) {
        return repTopic
          ? `You mentioned ${repTopic}. Since my patients are the priority and access remains a challenge, what is the most practical recommendation you can provide to improve access to PrEP today?`
          : "Since my patients are the priority, and access to treatment is a challenge, what is the most practical recommendation you can provide to improve access to PrEP today?";
      }

      return repTopic
        ? `You mentioned ${repTopic}. Since my patients are the priority, what is the most practical recommendation you can provide for my workflow today?`
        : "Since my patients are the priority, what is the most practical recommendation you can provide for my workflow today?";
    };

    const buildNonRepeatingScenarioFallback = (previousDialogue = "") => {
      const base = buildFollowUpScenarioFallback();
      const prevNorm = String(previousDialogue || "").trim().toLowerCase();
      const baseNorm = String(base || "").trim().toLowerCase();
      if (!prevNorm || prevNorm !== baseNorm) return base;

      const repLower = String(repMessage || "").toLowerCase();
      const repTopicTokens = repLower
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w && !new Set(["the", "and", "for", "with", "that", "this", "your", "have", "from", "what", "about", "today"]).has(w))
        .slice(0, 4);
      const repTopic = repTopicTokens.join(" ") || "that point";

      if (scenarioCabFocus && scenarioScreeningFocus) {
        return `On ${repTopic}, help me understand the exact candidacy and resistance checks we can apply consistently this week.`;
      }

      if (scenarioPrepFocus) {
        return `On ${repTopic}, given our access bottlenecks and limited staff time, what single practical step should we start with today for PrEP patients?`;
      }

      if (scenarioMonitoringFocus) {
        return `On ${repTopic}, what is the simplest monitoring and follow-up step we can implement without adding extra burden?`;
      }

      return `On ${repTopic}, what is the most practical next step we can apply in clinic today without disrupting workflow?`;
    };

    const buildScenarioAlignedCue = (dialogue, isFirstTurn, recentCues = [], engagementTier = "engaged") => {
      const value = String(dialogue || "").toLowerCase();
      if (isFirstTurn && scenarioPrepFocus && scenarioPressured) {
        return "The HCP glances at a stack of prior-authorization forms, then looks up with a polite but rushed expression.";
      }
      if (isFirstTurn && scenarioCabFocus && scenarioScreeningFocus) {
        return "The HCP reviews a chart note and screening checklist, then looks up with a focused, slightly uncertain expression.";
      }
      if (isFirstTurn && scenarioMonitoringFocus) {
        return "The HCP taps a follow-up list on the desk, then turns back with a practical, time-aware expression.";
      }
      if (nextHcpState === "disengaged") {
        return "The HCP turns back toward the patient room and reaches for the door, body language making clear the exchange is over.";
      }

      if (engagementTier !== "engaged") {
        const decayPool = DECAY_CUE_BUCKETS[engagementTier] || DECAY_CUE_BUCKETS.constrained;
        const cueSeed = `${generationKey}:${nextTurnNumber}:${nextHcpState}:${engagementTier}:${value.slice(0, 80)}`;
        const startIndex = deterministicIndex(cueSeed, decayPool.length);
        const normalizedRecent = recentCues.slice(-NO_REPEAT_WINDOW_TURNS).map((cue) => String(cue || "").trim().toLowerCase());
        for (let i = 0; i < decayPool.length; i += 1) {
          const candidate = decayPool[(startIndex + i) % decayPool.length];
          const normalizedCandidate = String(candidate || "").trim().toLowerCase();
          if (normalizedCandidate && !normalizedRecent.includes(normalizedCandidate)) return candidate;
        }
        return decayPool[startIndex];
      }

      const concern = detectPrimaryConcern(`${value} ${scenario?.description || ""}`);
      const bucketKey = (() => {
        if (nextHcpState === "boundary-setting" || nextHcpState === "disengaged") return "closure";
        if (nextHcpState === "resistant" || concern === "evidence") return "mildSkepticism";
        if (nextHcpState === "engaged" && /\b(if|provided|as long as|depending|once)\b/.test(value)) return "conditionalOpenness";
        if (nextHcpState === "engaged") return "guardedInterest";
        if (scenarioPressured || concern === "time") return "timePressure";
        if (concern === "access") return "workflowBurden";
        if (concern === "screening") return "clinicalEvaluation";
        if (/\b(next step|start|implement|apply|decision)\b/.test(value)) return "practicalDecision";
        return "workflowBurden";
      })();

      const pool = CUE_BUCKETS[bucketKey] || CUE_BUCKETS.practicalDecision;
      const cueSeed = `${generationKey}:${nextTurnNumber}:${nextHcpState}:${bucketKey}:${value.slice(0, 120)}`;
      const startIndex = deterministicIndex(cueSeed, pool.length);
      const normalizedRecent = recentCues.slice(-NO_REPEAT_WINDOW_TURNS).map((cue) => String(cue || "").trim().toLowerCase());

      for (let i = 0; i < pool.length; i += 1) {
        const candidate = pool[(startIndex + i) % pool.length];
        const normalizedCandidate = String(candidate || "").trim().toLowerCase();
        if (normalizedCandidate && !normalizedRecent.includes(normalizedCandidate)) {
          return candidate;
        }
      }

      return pool[startIndex] || "The HCP pauses over the details, waiting for a practical next point.";
    };

    let usedDeterministicFallback = false;
    nextHcpDialogue = "";
    let draftResponseBeforePostProcessing = "";
    let draftResponseSource = "llm";

    try {
      if (forceTerminalDisengagement) {
        usedDeterministicFallback = true;
        draftResponseSource = "terminal_forced";
        nextHcpDialogue = terminalCloseFallback;
      } else {
        const systemPrompt = buildHCPDialoguePrompt({
          scenario,
          hcpProfile: nextProfile,
          historyText,
          isOpening: isFirstHcpResponse,
        }) + `\n\nENGAGEMENT DECAY LAYER:\n- Current engagement tier: ${decayState.tier}.\n- Active concern to protect: ${activeConcern}.\n- Concern addressed by rep this turn: ${decayState.concernAddressed ? "yes" : "no"}.\n- Repeated evidence without operational link: ${decayState.repeatedEvidence ? "yes" : "no"}.\n- Tier directive: ${ENGAGEMENT_TIER_PROMPT_GUIDANCE[decayState.tier]}\n- Keep sentence count at or below ${ENGAGEMENT_TIER_SENTENCE_MAX[decayState.tier]}.\n- Maintain professional tone. Be firm if needed, but never hostile or sarcastic.`;
        emitPlannerTrace("planner_input_assembled", {
          turnNumber: nextTurnNumber,
          plannerVisibleConstraints: normalizedActiveConstraints,
          plannerVisibleConcern: activeConcern,
          concernFlowOutcome,
          promptPreview: {
            activeConcern,
            engagementTier: decayState.tier,
            concernAddressed: decayState.concernAddressed,
          },
        });
        const res = await fetch('/api/llm/invoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: systemPrompt,
            max_tokens: 220,
            temperature: 0,
            roleplay: true,
          })
        });
        if (res.ok) {
          const data = await res.json();
          const raw = (data.response || data.text || data.content || '');
          const rawStr = typeof raw === 'string' ? raw : String(raw);
          nextHcpDialogue = rawStr.trim().split('\n')[0];

          if (
            import.meta.env.DEV
            && rawStr.includes("?")
            && !nextHcpDialogue.includes("?")
          ) {
            console.warn("PUNCTUATION_INTEGRITY_VIOLATION", { source: "hcp-message-processing" });
          }

          const prePunctuationNormalization = nextHcpDialogue;
          nextHcpDialogue = normalizeHcpDialoguePunctuation(nextHcpDialogue).trim();
          logPunctuationDelta({
            stage: "hcp_dialogue_postprocess",
            source: "normalizeHcpDialoguePunctuation",
            before: prePunctuationNormalization,
            after: nextHcpDialogue,
          });
          draftResponseBeforePostProcessing = nextHcpDialogue;

          if (
            import.meta.env.DEV
            && rawStr.includes("?")
            && !nextHcpDialogue.includes("?")
          ) {
            console.warn("PUNCTUATION_INTEGRITY_VIOLATION", { source: "hcp-message-normalization" });
          }
        } else {
          usedDeterministicFallback = true;
          draftResponseSource = "fetch_non_ok_fallback";
          nextHcpDialogue = isFirstHcpResponse
            ? buildFirstTurnScenarioFallback()
            : buildFollowUpScenarioFallback();
          draftResponseBeforePostProcessing = nextHcpDialogue;
        }
      }
    } catch (err) {
      console.error('HCP dialogue generation error:', err);
      usedDeterministicFallback = true;
      draftResponseSource = "exception_fallback";
      nextHcpDialogue = isFirstHcpResponse
        ? buildFirstTurnScenarioFallback()
        : buildFollowUpScenarioFallback();
      draftResponseBeforePostProcessing = nextHcpDialogue;
    }
    if (!draftResponseBeforePostProcessing) {
      draftResponseBeforePostProcessing = nextHcpDialogue;
    }
    emitPlannerTrace("draft_response_generated", {
      turnNumber: nextTurnNumber,
      draftResponseSource,
      usedDeterministicFallback,
      draftOpening: getOpeningSentence(draftResponseBeforePostProcessing),
      draftResponse: draftResponseBeforePostProcessing,
    });

    const previousHcpDialogue = String(
      respondingToTurn?.hcpDialogueBefore
      || [...prevTurns]
        .reverse()
        .find((t) => t.hcpDialogueBefore)?.hcpDialogueBefore
      || ""
    );

    const groundedFallback = isFirstHcpResponse
      ? buildFirstTurnScenarioFallback()
      : buildNonRepeatingScenarioFallback(previousHcpDialogue);
    const allowGroundedFallbackOverride = ["neutral", "engaged"].includes(nextHcpState);
    if (
      allowGroundedFallbackOverride
      && !isScenarioGroundedDialogue(nextHcpDialogue, scenarioKeywords, repMessage)
      && String(nextHcpDialogue || "").split(/\s+/).length < 6
    ) {
      usedDeterministicFallback = true;
      nextHcpDialogue = groundedFallback;
    }

    if (!isFirstHcpResponse) {
      const nextNorm = String(nextHcpDialogue || "").trim().toLowerCase();
      const prevNorm = String(previousHcpDialogue || "").trim().toLowerCase();
      if (nextNorm && prevNorm && nextNorm === prevNorm) {
        usedDeterministicFallback = true;
        nextHcpDialogue = buildNonRepeatingScenarioFallback(previousHcpDialogue);
      }
    }

    if (
      nextHcpState === "disengaged"
      && shouldReplaceWithTerminalDisengagement(nextHcpDialogue)
    ) {
      usedDeterministicFallback = true;
      nextHcpDialogue = terminalCloseFallback;
    }

    if (repHasFollowUpCommitment && ["impatient", "disengaging"].includes(decayState.tier) && nextHcpState !== "disengaged") {
      nextHcpState = overrideExit ? "disengaged" : "boundary-setting";
      usedDeterministicFallback = true;
      nextHcpDialogue = overrideExit
        ? "Understood. Please coordinate a follow-up time with the front desk and send the workflow plan by your committed deadline."
        : "Thanks. Include payer-variation handling and owner-level rollout steps in that plan, then send it by your committed deadline.";
    }

    const recentRepTurns = getRecentRepTurns(prevTurns);
    const previousInferenceState = repInferenceStateRef.current;
    const nextInferenceState = updateRepInferenceState(previousInferenceState, recentRepTurns);
    const selectedInfluence = ENABLE_INFERENCE_LAYER
      ? selectInferenceInfluence(nextInferenceState, scenario, previousInferenceState.lastInfluence)
      : { type: 'none', strength: 'low' };

    const baseResponse = nextHcpDialogue;
    const inferenceAdjustedResponse = ENABLE_INFERENCE_LAYER
      ? applyInferenceBias({
          baseResponse,
          influence: selectedInfluence,
          lastInfluence: previousInferenceState.lastInfluence,
          turnCount: nextInferenceState.turnCount,
          lastAppliedTurn: previousInferenceState.lastAppliedTurn,
        })
      : baseResponse;

    nextHcpDialogue = normalizeTone(inferenceAdjustedResponse);

    if (
      !overrideExit
      && nextHcpState !== "disengaged"
      && ["missed", "overpivot", "aligned"].includes(concernFlowOutcome)
      && (activeConcern === "workflow" || activeConcern === "access" || activeConcern === "time")
    ) {
      const needsReanchor = concernFlowOutcome === "missed" || concernFlowOutcome === "overpivot";
      const shouldNudgeConditional =
        concernFlowOutcome === "aligned"
        && !/\b(as long as|depends|without adding|if it reduces|realistic)\b/i.test(nextHcpDialogue);

      if (needsReanchor || shouldNudgeConditional) {
        nextHcpDialogue = buildOperationalReanchorDialogue({
          mode: concernFlowOutcome,
          unresolvedConcernTurns,
        });
        if (concernFlowOutcome === "aligned" && recoveryTiming === "late") {
          nextHcpDialogue = "That may help, but we are still behind on approvals. If you want me to act on this, keep it specific and operational.";
        }
        if (needsReanchor && nextHcpState === "engaged") {
          nextHcpState = "resistant";
        }
      }
    }
    const burdenEstablished = prevTurns
      .map((t) => String(t?.hcpDialogueBefore || "").toLowerCase())
      .slice(-NO_REPEAT_WINDOW_TURNS)
      .some((line) => /\b(overwhelmed|short-staffed|buried|staffing|prior auth burden|admin burden)\b/.test(line));
    const dialogueProgression = [
      "burden",
      "integration",
      "implementation",
      "training",
      "disruption",
      "evidence_next_step",
    ];
    const progressionStage =
      dialogueProgression[Math.max(0, Math.min(dialogueProgression.length - 1, unresolvedConcernTurns))];
    nextHcpDialogue = compressHcpDialogueForEngagement(nextHcpDialogue, {
      ...decayState,
      activeConcern,
      unresolvedStreak: unresolvedConcernTurns,
      burdenEstablished,
    });
    const recentHcpDialogues = collectRecentHcpDialogues(prevTurns, NO_REPEAT_WINDOW_TURNS);
    nextHcpDialogue = enforceDialogueVariety({
      candidate: nextHcpDialogue,
      concern: activeConcern,
      seed: `${generationKey}:${nextTurnNumber}:${activeConcern}:variety`,
      recentDialogues: recentHcpDialogues,
      progressionStage,
    });
    if (terminalDecisionMode) {
      nextHcpDialogue = buildTerminalDecisionDialogue({
        concern: activeConcern,
        seed: `${generationKey}:${nextTurnNumber}:${activeConcern}`,
      });
      nextHcpDialogue = enforceDialogueVariety({
        candidate: nextHcpDialogue,
        concern: activeConcern,
        seed: `${generationKey}:${nextTurnNumber}:${activeConcern}:terminal-variety`,
        recentDialogues: recentHcpDialogues,
        progressionStage,
      });
    }

    const recentPhraseMemory = recentDialoguePhrasesRef.current.slice(-NO_REPEAT_WINDOW_TURNS);
    const candidatePhrases = extractDialoguePhrases(nextHcpDialogue);
    const hasRecentPhraseReuse = candidatePhrases.some((phrase) => recentPhraseMemory.includes(phrase));
    if (hasRecentPhraseReuse) {
      nextHcpDialogue = enforceDialogueVariety({
        candidate: nextHcpDialogue,
        concern: activeConcern,
        seed: `${generationKey}:${nextTurnNumber}:${activeConcern}:phrase-memory`,
        recentDialogues: recentHcpDialogues,
        progressionStage,
      });
    }

    const primaryConcern = detectPrimaryConcern(
      `${scenario?.description || ""} ${scenario?.context || ""} ${respondingToTurn?.hcpDialogueBefore || ""} ${nextHcpDialogue}`
    );
    const latestRepLower = String(repMessage || "").toLowerCase();
    const repWasGeneric = latestRepLower.length < 18
      || /\b(great|sounds good|makes sense|absolutely|totally|we can do that|trust me)\b/.test(latestRepLower);
    const responseLooksTooIdeal =
      /\b(great point|absolutely|perfect|that works|sounds good|happy to|let's move forward|we can proceed)\b/i.test(nextHcpDialogue)
      && !/\b(if|as long as|provided|depends|still|before|until|need|workflow|access|evidence|time|policy|screening)\b/i.test(nextHcpDialogue);
    const resolvesTooMuch =
      /\b(you answered everything|no concerns|fully aligned|all set|completely convinced)\b/i.test(nextHcpDialogue);
    const shouldCalibrateRealism =
      !isFirstHcpResponse
      && nextHcpState !== "disengaged"
      && nextHcpState !== "irritated"
      && (responseLooksTooIdeal || resolvesTooMuch || (repWasGeneric && /\b(thank you|appreciate|good question)\b/i.test(nextHcpDialogue)));

    if (shouldCalibrateRealism) {
      const transformedDialogue = rewriteTooIdealDialogue(nextHcpDialogue, primaryConcern, repWasGeneric);
      if (ENABLE_REALISM_TRANSFORM_HARNESS) {
        const harnessResult = applyTransformSafetyHarness({
          originalDialogue: nextHcpDialogue,
          transformedDialogue,
          activeConcern: primaryConcern,
          scenarioKeywords,
        });
        nextHcpDialogue = harnessResult.dialogue;

        if (ENABLE_REALISM_REPLAY_METRICS && import.meta.env.DEV) {
          console.debug("REALISM_REPLAY_HARNESS_METRICS", harnessResult.metrics);
        }
      } else {
        nextHcpDialogue = transformedDialogue;
      }
    }

    if (ENABLE_INFERENCE_LAYER && selectedInfluence.type !== 'none' && nextHcpDialogue !== baseResponse) {
      repInferenceStateRef.current = {
        ...nextInferenceState,
        lastInfluence: selectedInfluence.type,
        lastAppliedTurn: nextInferenceState.turnCount,
      };
    } else {
      repInferenceStateRef.current = {
        ...nextInferenceState,
        lastInfluence: previousInferenceState.lastInfluence,
        lastAppliedTurn: previousInferenceState.lastAppliedTurn,
      };
    }

    if (ENABLE_INFERENCE_LAYER && import.meta.env.DEV) {
      console.log('Inference State:', repInferenceStateRef.current);
      console.log('Selected Influence:', selectedInfluence);
    }

    // 6.5 DETECT HCP DISAGREEMENT & RECORD FOR NEXT TURN
    // If the HCP disagreed with the rep's suggestion, flag this for the NEXT turn's temperature escalation
    const disagreementInfo = detectHcpDisagreement(nextHcpDialogue);
    if (disagreementInfo.disagrees) {
      console.log(`HCP Disagreement Detected in Turn ${turns.length} | Strong: ${disagreementInfo.strongDisagree} | Mild: ${disagreementInfo.mildDisagree}`);
    }

    // 6.6 GENERATE CONTEXTUAL CUE — MATCHES DIALOGUE + QUESTION QUALITY
    // After dialogue is generated, create a contextual cue that matches what the HCP said
    // and responds to the quality of the rep's question (pushy, redundant, etc.)
    // Always match cue to the same state/context as the generated HCP dialogue
    // Alignment check: ensure cues, emotional state, dialogue, and context are logically consistent
    contextualCue = undefined;
    if (overrideExit) {
      // Constrain HCP behavior: closure only, no questions or escalation
      nextHcpDialogue = 'Understood. Please coordinate a follow-up slot with the front desk.';
      contextualCue = 'The HCP stands and checks their calendar, signaling the conversation is ending soon.';
    } else {
      // Derive cue from the exact same grounded inputs as dialogue (scenario + rep message + generated response)
      const recentCueText = prevTurns.map((t) => t.cueBefore).filter(Boolean);
      if (terminalDecisionMode) {
        const cueIndex = deterministicIndex(
          `${generationKey}:${nextTurnNumber}:${activeConcern}:terminal-cue`,
          TERMINAL_DECISION_CUES.length,
        );
        contextualCue = TERMINAL_DECISION_CUES[cueIndex];
      } else {
        contextualCue = buildScenarioAlignedCue(nextHcpDialogue, isFirstHcpResponse, recentCueText, decayState.tier);
      }

      const recentCues = prevTurns
        .map((t) => String(t.cueBefore || "").trim().toLowerCase())
        .filter(Boolean)
        .slice(-NO_REPEAT_WINDOW_TURNS);
      const normalizedCue = String(contextualCue || "").trim().toLowerCase();
      const previousCue = recentCues[recentCues.length - 1];

      // Hard safeguard: prevent duplicate cue reuse inside the recent no-repeat window.
      if (normalizedCue && (recentCues.includes(normalizedCue) || normalizedCue === previousCue)) {
        const deterministicFallbackPool = [
          nextProfile.lockedCue,
          "The HCP pauses, clearly expecting something more useful.",
          "The HCP glances at the clock, patience thinning.",
          "The HCP shifts posture slightly, less engaged.",
          "The HCP waits with clipped attention for one practical answer.",
        ]
          .map((cue) => String(cue || "").trim())
          .filter(Boolean);

        const startIndex = deterministicIndex(`${generationKey}:${nextTurnNumber}:${nextHcpState}:cue-fallback`, deterministicFallbackPool.length);
        let replacement = deterministicFallbackPool[startIndex] || nextProfile.lockedCue;

        for (let i = 0; i < deterministicFallbackPool.length; i += 1) {
          const candidate = deterministicFallbackPool[(startIndex + i) % deterministicFallbackPool.length];
          const normalizedCandidate = String(candidate || "").trim().toLowerCase();
          if (normalizedCandidate && !recentCues.includes(normalizedCandidate)) {
            replacement = candidate;
            break;
          }
        }

        contextualCue = replacement;
      }
    }

    contextualCue = hardenTextSurface(contextualCue);
    contextualCue = enforceCueVariety(
      contextualCue,
      prevTurns.map((t) => t.cueBefore).filter(Boolean),
      `${generationKey}:${nextTurnNumber}:${nextHcpState}`,
    );
    const recentCueMemory = recentCueHistoryRef.current.slice(-NO_REPEAT_WINDOW_TURNS);
    const contextualCueNormalized = normalizeDialogueSignature(contextualCue);
    if (contextualCueNormalized && recentCueMemory.includes(contextualCueNormalized)) {
      const recentCueText = prevTurns.map((t) => t.cueBefore).filter(Boolean);
      contextualCue = buildScenarioAlignedCue(
        `${nextHcpDialogue} ${generationKey}`,
        isFirstHcpResponse,
        recentCueText,
        decayState.tier
      );
      contextualCue = hardenTextSurface(contextualCue);
    }

    // 7. Coaching overlay — driven by alignment rubric flags
    const coachingResult = shouldTriggerCoaching(alignment, prevState, nextHcpState);
    if (coachingResult.shouldShow) setCoachingTip(coachingResult);

    // 8. Lock next turn with contextual cue (matches dialogue + question quality)
    // Use contextual cue instead of base profile cue to ensure body language matches what HCP said
    const nextTurn = {
      turnNumber: nextTurnNumber,
      hcpStateBefore: nextHcpState,
      temperatureBefore: nextTemp,
      severityBefore: nextSev,
      cueBefore: contextualCue,
      hcpDialogueBefore: nextHcpDialogue,
      repMessage: null,
      alignment: null,
      hcpStateAfter: null,
      hcpDisagreed: disagreementInfo.disagrees,
      disagreementInfo: disagreementInfo,
      engagementScore: turnState.engagementScore,
      engagementLevel: turnState.engagementLevel,
      emotionalValence: turnState.emotionalValence,
      stance: turnState.stance,
      reactionTrigger: turnState.reactionTrigger,
      conversationalMomentum: turnState.conversationalMomentum,
      timePressure: turnState.timePressure,
      activeConcern,
      activeConstraints: normalizedActiveConstraints,
      activeOperationalConstraints: operationalConstraintState.activeOperationalConstraints,
      operationalConstraintLedger: operationalConstraintState.allOperationalConstraints,
      primaryOperationalConstraint: operationalConstraintState.primaryOperationalConstraint,
      constraintSourceTurn: operationalConstraintState.primaryOperationalConstraint?.constraintSourceTurn ?? null,
      constraintStatus: operationalConstraintState.primaryOperationalConstraint?.constraintStatus ?? null,
      constraintType: operationalConstraintState.primaryOperationalConstraint?.constraintType ?? null,
      chosenResponseObjective,
      engagementDecayTier: decayState.tier,
      engagementPressureScore: decayState.pressureScore,
      generationKey,
    };

    const terminalPolicyAction = determineTerminalPolicyAction({
      hcpState: decayState.tier,
      concernFlowOutcome,
      unresolvedConcernTurns,
      repHasFollowUpCommitment,
      repDefersImmediateAction,
      explicitExitOverride: overrideExit,
    });

    if (terminalPolicyAction === "probe" && isTerminalClosureDialogue(nextHcpDialogue)) {
      nextHcpDialogue = "Before we close, give me one practical change we can run this week without adding burden.";
    }

    const openingBeforeGuardrail = getOpeningSentence(nextHcpDialogue);
    const revisitRequested = /\b(again|revisit|you mentioned|earlier you said|back to|still unresolved|remind me)\b/i.test(repMessage);
    const clarificationNeeded = /\b(contradict|inconsistent|clarify|unclear|conflict)\b/i.test(repMessage);
    const changedConstraint = newConstraintTypesThisTurn.length > 0;
    const initialViolation = detectConstraintDraftViolations({
      draftText: nextHcpDialogue,
      groundedTypes: groundedConstraintTypes,
      alreadySurfacedTypes: previouslySurfacedConstraintTypes,
      newlyRaisedTypes: newConstraintTypesThisTurn,
      revisitRequested,
      changedConstraint,
      clarificationNeeded,
    });
    const draftRejectedForConstraintRule = !initialViolation.valid;
    if (draftRejectedForConstraintRule) {
      usedDeterministicFallback = true;
      nextHcpDialogue = buildConstraintSafeRegeneratedResponse({
        fallbackResponse: groundedFallback,
        concern: activeConcern,
      });
    }
    const finalViolationCheck = detectConstraintDraftViolations({
      draftText: nextHcpDialogue,
      groundedTypes: groundedConstraintTypes,
      alreadySurfacedTypes: previouslySurfacedConstraintTypes,
      newlyRaisedTypes: newConstraintTypesThisTurn,
      revisitRequested,
      changedConstraint,
      clarificationNeeded,
    });
    if (!finalViolationCheck.valid) {
      nextHcpDialogue = buildConstraintViolationFallback({
        concern: activeConcern,
        recentDialogues: collectRecentHcpDialogues(turns, 4),
        seed: `${sid}:${nextTurnNumber}:constraint-violation`,
      });
    }

    const finalOpening = getOpeningSentence(nextHcpDialogue);
    const openingAcknowledgesConstraintBeforeGuardrail = openingAcknowledgesAnyConstraint(
      openingBeforeGuardrail,
      normalizedActiveConstraints
    );
    const openingAcknowledgesConstraint = openingAcknowledgesAnyConstraint(
      finalOpening,
      normalizedActiveConstraints
    );
    const selectedObjectiveAccountsForConstraint = Boolean(objectiveRanking.selectedObjectiveAccountsForConstraint);
    const finalAnswerReflectsConstraint = openingAcknowledgesConstraint;
    const finalSurfacedConstraintTypes = [
      ...new Set([
        ...previouslySurfacedConstraintTypes,
        ...finalViolationCheck.draftTypes.filter((type) => groundedConstraintTypes.includes(type)),
      ]),
    ];
    const plannerGapComparison = {
      transcriptConstraintPresent,
      plannerStateConstraintPresent: normalizedActiveConstraints.length > 0,
      selectedObjectiveAccountsForConstraint,
      finalAnswerReflectsConstraint,
      draftRejectedForConstraintRule,
      draftConstraintRejectionReason: initialViolation.rejectionReason,
      draftUngroundedTypes: initialViolation.ungroundedTypes,
      draftDuplicateTypes: initialViolation.duplicateTypes,
    };
    emitPlannerTrace("final_response_generated", {
      turnNumber: nextTurnNumber,
      rawUserConstraintCandidates,
      activeOperationalConstraints: operationalConstraintState.activeOperationalConstraints,
      primaryOperationalConstraint: operationalConstraintState.primaryOperationalConstraint,
      normalizedActiveConstraints,
      plannerVisibleConstraints: normalizedActiveConstraints,
      chosenResponseObjective,
      primaryConstraint: objectiveRanking.primaryConstraint,
      directOperationalQuestion: objectiveRanking.directOperationalQuestion,
      selectedObjectiveAccountsForConstraint,
      draftResponseSource,
      draftOpening: getOpeningSentence(draftResponseBeforePostProcessing),
      openingBeforeGuardrail,
      openingAcknowledgesConstraintBeforeGuardrail,
      finalOpening,
      openingAcknowledgesConstraint,
      postProcessingChangedOpening:
        getOpeningSentence(draftResponseBeforePostProcessing) !== finalOpening,
      guardrailApplied: false,
      plannerGapComparison,
      finalResponse: nextHcpDialogue,
    });
    const verbalizedOperationalConstraintTypes = detectOperationalConstraintTypes(nextHcpDialogue);
    const previouslyVerbalizedOperationalConstraintTypes = [
      ...new Set(
        prevTurns.flatMap((turn) => Array.isArray(turn?.verbalizedOperationalConstraintTypes)
          ? turn.verbalizedOperationalConstraintTypes
          : detectOperationalConstraintTypes(turn?.hcpDialogueBefore || ""))
      ),
    ];
    nextTurn.hcpDialogueBefore = nextHcpDialogue;
    nextTurn.surfacedOperationalConstraintTypes = finalSurfacedConstraintTypes;
    nextTurn.plannerStateSnapshot = {
      ...nextTurn.plannerStateSnapshot,
      surfacedOperationalConstraintTypes: finalSurfacedConstraintTypes,
      groundedConstraintTypes,
    };
    nextTurn.plannerGapComparison = plannerGapComparison;

    const shouldEndSessionAfterTurn = overrideExit || (
      (nextHcpState === "disengaged" && isTerminalClosureDialogue(nextHcpDialogue))
      || terminalPolicyAction === "close"
    );

    if (shouldEndSessionAfterTurn) {
      sessionControllerRef.current.state = SessionState.ENDED;
      sessionControllerRef.current.pendingResponseQueue = [];
    }

    if (requestId !== activeRequestIdRef.current || !sessionControllerRef.current.isActive) {
      return;
    }

    // Prevent duplicate HCP turns: only add one HCP turn after rep input
    setTurns((prevTurnsState) => {
      const currentRespondingTurn = prevTurnsState[prevTurnsState.length - 1];
      if (!currentRespondingTurn) return prevTurnsState;
      if (currentRespondingTurn.turnNumber !== respondingToTurn.turnNumber) return prevTurnsState;
      if (currentRespondingTurn.repMessage) return prevTurnsState;

      const replaced = [...prevTurnsState.slice(0, prevTurnsState.length - 1), lockedRespondingTurn];
      const hasNextTurnAlready = prevTurnsState.some(
        (t) => (
          t.turnNumber === nextTurn.turnNumber
          && !t.repMessage
          && t.hcpDialogueBefore
        ) || (t.generationKey && t.generationKey === generationKey)
      );
      if (hasNextTurnAlready) {
        return replaced;
      }
      processedTurnKeysRef.current.add(generationKey);

      const turnAuditKey = `${nextTurn.turnNumber}::${repMessage}`;
      if (!loggedTurnKeysRef.current.has(turnAuditKey)) {
        loggedTurnKeysRef.current.add(turnAuditKey);
        logAuditEvent('turn_created', {
          turnNumber: nextTurnNumber,
          hcpState: nextHcpState,
          cue: contextualCue,
          dialogue: nextHcpDialogue,
          repMessage,
          alignment,
          plannerStateSnapshot,
          plannerGapComparison: nextTurn.plannerGapComparison,
          chosenResponseObjective,
          feedback: coachingResult,
        });
      }

      return [...replaced, nextTurn];
    });

      recentDialoguePhrasesRef.current = [
        ...recentDialoguePhrasesRef.current,
        ...extractDialoguePhrases(nextHcpDialogue),
      ].slice(-40);
      recentCueHistoryRef.current = [
        ...recentCueHistoryRef.current,
        normalizeDialogueSignature(contextualCue),
      ].filter(Boolean).slice(-40);

      if (sessionControllerRef.current.isActive) {
        setIsLoading(false);
      }
      if (requestId === activeRequestIdRef.current && sessionControllerRef.current.isActive) {
        speak(nextHcpDialogue);
      }

      // Auto-focus input after HCP responds
      setTimeout(() => inputRef.current?.focus(), 100);
    } finally {
      if (sessionControllerRef.current.isActive && sessionControllerRef.current.state !== SessionState.ENDED) {
        sessionControllerRef.current.state = SessionState.ACTIVE;
      }
      sessionControllerRef.current.isProcessingTurn = false;
      sendInFlightRef.current = false;
      const queuedInput = sessionControllerRef.current.pendingResponseQueue.shift();
      if (queuedInput && sessionControllerRef.current.isActive && sessionControllerRef.current.state === SessionState.ACTIVE) {
        sendMessage(queuedInput);
      }
    }
  };

  // ─── HELPERS ──────────────────────────────────────────────────────────────────
  function flattenTurns(turnList) {
    const msgs = [];
    turnList.forEach((t) => {
      if (t.hcpDialogueBefore) msgs.push({ role: "assistant", content: t.hcpDialogueBefore });
      if (t.repMessage) msgs.push({ role: "user", content: t.repMessage });
    });
    return msgs;
  }

  // Current HCP state = the state the rep is currently facing (last turn's hcpStateBefore)

  const displayTurns = turns.filter((turn, index) => {
    if (index === 0) return true;
    const prev = turns[index - 1];
    const bothHcpOnly = !turn.repMessage && !prev.repMessage;
    if (!bothHcpOnly) return true;

    const sameDialogue = String(turn.hcpDialogueBefore || "").trim() === String(prev.hcpDialogueBefore || "").trim();
    const sameCue = String(turn.cueBefore || "").trim() === String(prev.cueBefore || "").trim();
    return !(sameDialogue && sameCue);
  });

  const displayItems = displayTurns.flatMap((turn, index) => {
    const items = [];

    if (turn.hcpDialogueBefore) {
      items.push({ kind: 'hcp', key: `hcp-${turn.turnNumber}-${index}`, turn });
    }

    if (turn.repMessage) {
      items.push({ kind: 'rep', key: `rep-${turn.turnNumber}-${index}`, turn });
    }

    return items;
  });

  const repTurnsCount = turns.filter((t) => t.repMessage).length;
  const sanitizedInput = sanitizeUserMessage(input);
  const shouldBlockLowSubstanceSubmit = Boolean(sanitizedInput) && repTurnsCount > 0 && isLowSubstanceAck(sanitizedInput);
  // Keep live metrics calculations running for end-session scoring, but hide panel from rep view.
  const showLiveMetricsPanel = false;

  const exportFeedbackPDF = () => {
    if (!feedback) return;
    const content = `SESSION FEEDBACK - ${scenario.title}\nDate: ${new Date().toLocaleDateString()}\n\n${feedback}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-feedback-${scenario.title.replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openCoachingOnSession = () => {
    const allMisalignments = [...new Set(turns.flatMap(t => t.alignment?.misalignments || []))];
    const allPositives = [...new Set(turns.flatMap(t => t.alignment?.positives || []))];
    const latestScoredTurn = [...turns].reverse().find((t) => t.alignment?.metrics);
    const capabilityScores = Object.fromEntries(
      Object.entries(latestScoredTurn?.alignment?.metrics || {}).map(([cap, val]) => [cap, val.score])
    );
    const overallScore = latestScoredTurn?.alignment?.score ?? null;

    const sessionContext = encodeURIComponent(JSON.stringify({
      scenarioTitle: scenario.title,
      hcpCategory: scenario.hcp_category,
      specialty: scenario.specialty,
      misalignments: allMisalignments,
      positives: allPositives,
      capabilityScores,
      overallScore,
      source: "roleplay_end_feedback",
    }));

    window.location.assign(createPageUrl("AICoach") + `?session_context=${sessionContext}`);
  };

  // ─── END SESSION ──────────────────────────────────────────────────────────────
  const endSession = async () => {
    setIsEnding(true);
    try {
      // Build conversation transcript
      const historyText = flattenTurns(turns)
        .map((m) => `${m.role === "user" ? "Sales Rep" : "HCP"}: ${m.content}`)
        .join("\n");

      const scoredTurns = turns.filter(t => t.alignment?.metrics);
      const latestScoredTurn = scoredTurns.length > 0 ? scoredTurns[scoredTurns.length - 1] : null;
      const capSummary = Object.entries(latestScoredTurn?.alignment?.metrics || {})
        .map(([cap, metric]) => {
          const subLine = Object.entries(metric.subScores || {})
            .map(([s, score]) => `  ↳ ${s.replace(/_/g, ' ')}: ${score}`)
            .join('\n');
          return `• ${cap.replace(/_/g, ' ')}${subLine ? '\n' + subLine : ''}`;
        })
        .join('\n');

      // Collect all rubric alignment flags (Signal–Response Alignment derived checks)
      const allRubricFlags = [...new Set(scoredTurns.flatMap(t => t.alignment?.rubricAlignmentFlags || []))];
      const allMisalignments = [...new Set(scoredTurns.flatMap(t => t.alignment?.misalignments || []))];
      const allPositives = [...new Set(scoredTurns.flatMap(t => t.alignment?.positives || []))];

      const rubricSection = allRubricFlags.length > 0
        ? `\nSIGNAL–RESPONSE ALIGNMENT ISSUES (canonical feedback language — use these verbatim or closely paraphrase):\n${allRubricFlags.map(f => `• ${f}`).join('\n')}`
        : '';

      const structuredPrompt = `You are a skilled sales coach analyzing a roleplay simulation session. Ground ALL feedback in observable behavior only — never infer intent, emotion, or personality traits.\n${FEEDBACK_SOT}\n\nSESSION SCORING DATA (deterministic, turn-by-turn):\nDeterministic session alignment summary (non-numeric): use only the qualitative findings below\n${capSummary}\n\nPOSITIVES OBSERVED (turn-by-turn):\n${allPositives.length > 0 ? allPositives.slice(0, 10).map(p => `• ${p}`).join('\n') : '• None detected'}\nMISALIGNMENTS OBSERVED (turn-by-turn):\n${allMisalignments.length > 0 ? allMisalignments.slice(0, 10).map(m => `• ${m}`).join('\n') : '• None detected'}\n${rubricSection}\n\nSession Context:\nScenario: ${scenario.title}\nHCP Type: ${scenario.hcp_category}\nDifficulty: ${scenario.difficulty}\n\nConversation Transcript:\n${historyText}\n\nRespond with PLAIN TEXT (no markdown, no special formatting). Provide exactly 4 sections separated by the exact delimiter "[SECTION_END]":\nSECTION 1: STRENGTHS (observable behaviors showing strong capability performance)\n[SECTION_END]\nSECTION 2: IMPROVEMENTS (specific capability gaps and areas to develop)\n[SECTION_END]\nSECTION 3: PATTERNS (notable signal-response alignment patterns and behaviors)\n[SECTION_END]\nSECTION 4: ACTION ITEMS (2-3 specific behavioral changes for next session)\n[SECTION_END]\nCRITICAL RULES:\n- Do NOT include numeric scores\n- Each section is plain text (no markdown, no bullet points in the response text)\n- Separate sections with EXACTLY "[SECTION_END]"\n- All feedback must be observable and specific`;
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: structuredPrompt,
          max_tokens: 900,
          temperature: 0.2,
        })
      });

      if (res.ok) {
        const data = await res.json();
        const rawContent = (data.response || data.text || data.content || '').trim();

        if (isPlannerTraceEnabled()) {
          console.log('=== RAW FEEDBACK CONTENT ===');
          console.log(rawContent.substring(0, 300));
        }

        // Strategy 1: Try delimiter-based parsing
        let sections = rawContent.split('[SECTION_END]').map(s => s.trim()).filter(Boolean);

        // If delimiter parsing didn't work well, try regex-based extraction
        if (sections.length < 4 || sections.some(s => s.length < 20)) {
          if (isPlannerTraceEnabled()) {
            console.log('Delimiter parsing failed, trying regex approach...');
          }

          // Try to extract by section headers/keywords
          const strengthsMatch = rawContent.match(/(?:STRENGTHS?|Done Well|Strong|Positive)[:\s]*\n+([\s\S]*?)(?=(?:IMPROVE|Develop|Weakness|Gap|SECTION)|$)/i);
          const improvementsMatch = rawContent.match(/(?:IMPROVE|Develop|Focus|Weakness|Gap)[:\s]*\n+([\s\S]*?)(?=(?:PATTERN|Align|SECTION|ACTION)|$)/i);
          const patternsMatch = rawContent.match(/(?:PATTERN|Align|Signal|Response)[:\s]*\n+([\s\S]*?)(?=(?:ACTION|SECTION|$))/i);
          const actionsMatch = rawContent.match(/(?:ACTION|Item|Behavioral Change|Next)[:\s]*\n+([\s\S]*?)$/i);

          sections = [
            strengthsMatch?.[1] || '',
            improvementsMatch?.[1] || '',
            patternsMatch?.[1] || '',
            actionsMatch?.[1] || ''
          ];
          if (isPlannerTraceEnabled()) {
            console.log('Regex extraction produced', sections.length, 'sections');
          }
        }

        // Fallback: if still not enough content, split by double newlines and distribute
        if (sections.length < 4 || sections.every(s => !s || s.length < 15)) {
          if (isPlannerTraceEnabled()) {
            console.log('Regex also failed, using raw content directly');
          }
          sections = [rawContent, '', '', ''];
        }

        // Extract and clean section content
        const strengthsText = (sections[0] || '')
          .replace(/^SECTION\s+1:\s+STRENGTHS\s*\n?/i, '')
          .replace(/^STRENGTHS?\s*[:—]*\s*\n?/i, '')
          .trim() || 'The HCP demonstrated solid engagement and appropriate questioning throughout the conversation.';

        const improvementsText = (sections[1] || '')
          .replace(/^SECTION\s+2:\s+IMPROVEMENTS\s*\n?/i, '')
          .replace(/^IMPROVE[A-Z]*\s*[:—]*\s*\n?/i, '')
          .trim() || 'Continue developing the ability to connect signals to specific clinical or practice outcomes.';

        const patternsText = (sections[2] || '')
          .replace(/^SECTION\s+3:\s+PATTERNS\s*\n?/i, '')
          .replace(/^PATTERN[A-Z]*\s*[:—]*\s*\n?/i, '')
          .trim() || 'The HCP showed responsive engagement, adapting questions based on the sales rep\'s input.';

        const actionText = (sections[3] || '')
          .replace(/^SECTION\s+4:\s+ACTION\s+ITEMS\s*\n?/i, '')
          .replace(/^ACTION[A-Z]*\s*[:—]*\s*\n?/i, '')
          .trim() || 'Focus on: (1) Deeper exploration of the HCP\'s current workflow, (2) Connecting study findings to practice impact, (3) Addressing objections with research-backed evidence.';

        // Reconstruct with proper markdown format
        const coachingFeedback = `## 2) Capabilities Done Well

${strengthsText}

## 3) Capabilities to Develop

${improvementsText}

## 4) Signal–Response Alignment

${patternsText}

## 5) Specific Action Items

${actionText}`;

        const fullFeedback = coachingFeedback;
        console.log('=== FEEDBACK PARSING COMPLETE ===');
        console.log('Strengths length:', strengthsText.length);
        console.log('Improvements length:', improvementsText.length);
        console.log('Patterns length:', patternsText.length);
        console.log('Actions length:', actionText.length);
        setFeedback(fullFeedback);
      } else {
        setFeedback("Unable to generate session feedback. Please try again.");
      }
    } catch (err) {
      console.error('Session feedback generation error:', err);
      setFeedback("Unable to generate session feedback. Please try again.");
    } finally {
      setIsEnding(false);
    }
  };

  // ─── FEEDBACK VIEW ────────────────────────────────────────────────────────────
  // Consolidated flow: Sections 2–5 now render inside the End & Get Feedback tab below
  // CapabilityFeedbackPanel, instead of opening a separate modal overlay.

  const flatMessages = flattenTurns(turns);

  const renderTabPills = () => (
    <div className="flex gap-1.5 flex-shrink-0 bg-transparent overflow-x-auto">
      {([
        { id: "chat", label: "Live Chat", icon: MessageSquare },
        { id: "annotate", label: "Annotated Transcript", icon: Highlighter, disabled: repTurnsCount < 1 },
        { id: "capabilities", label: "End & Get Feedback", icon: Zap, disabled: repTurnsCount < 1 },
      ]).map(({ id, label, icon: Icon, disabled }) => (
        <button
          key={id}
          disabled={disabled}
          onClick={() => {
            setActiveTab(id);
            if (id === "capabilities" && repTurnsCount >= 2 && !feedback && !isEnding) {
              endSession();
            }
          }}
          className={`inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all duration-200 text-xs px-3 py-1 ${activeTab === id
            ? "border-[#39ACAC] text-[#39ACAC] bg-[#e6f7f7]"
            : disabled
              ? "border-gray-200 text-gray-300 cursor-not-allowed"
              : "border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7]"
            }`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </div>
  );

  // ─── CHAT VIEW ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col lg:flex-row overflow-hidden" style={{ background: "#f0f4f8" }}>
      {/* Left: Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0 bg-white border-r border-gray-200">

        {/* Header */}
        <div className="flex items-center justify-end gap-2 px-3 md:px-5 py-2 border-b flex-shrink-0 bg-white">
          <div className="flex items-center gap-2 ml-1 flex-shrink-0">
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-gray-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Persona strip */}
        {/* Persona strip removed as requested */}


        {/* Scenario context summary */}
        {showScenarioContext && (
          <RolePlayBriefingPanel
            scenario={scenario}
            difficultyVisual={difficultyVisual}
            briefingTitle={briefingHeadline.title}
            hcpProfileSummary={hcpProfileSummary}
            objectiveText={objectiveText}
            objectiveDetailLines={objectiveDetailLines}
            openingScene={openingScene}
            showOpeningSceneFallback={showOpeningSceneFallback}
            challengeItems={challengeItems}
            challengeDetailLines={challengeDetailLines}
            showScenarioSupportFallback={showScenarioSupportFallback}
            tabPills={renderTabPills()}
          />
        )}

        {!showScenarioContext && (
          <div className="px-3 md:px-4 py-1 border-b bg-white flex-shrink-0">
            <div className="rounded-xl border border-slate-200 bg-white min-h-[40px] flex items-center px-2 py-1 justify-end">
              {renderTabPills()}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">

          {/* CHAT TAB */}
          {activeTab === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto px-3 md:px-5 py-4 flex flex-col gap-4">

                {turns.length === 0 && isLoading && (
                  <div className="flex justify-center py-8">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "0.1s" }} />
                      <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "0.2s" }} />
                    </div>
                  </div>
                )}


                {/*
                  DISPLAY NORMALIZATION LAYER

                  Messages may be normalized for grammar
                  and punctuation before rendering.

                  This does NOT modify the underlying
                  conversation history or scoring inputs.
                */}
                {/*
                  DISPLAY TONE NORMALIZATION

                  Tone adjustments improve realism of dialogue.

                  These transformations occur ONLY during UI rendering
                  and do not affect scoring or stored conversation data.
                */}
                {/*
                  CHAT LAYOUT STRUCTURE RULE

                  Do not modify message container hierarchy.

                  User bubble
                  → alignment badge
                  → next message

                  All layout must use flex stacking.

                  Avoid absolute positioning.
                */}
                {displayItems.map((item) => {
                  const { turn } = item;

                  if (item.kind === "rep") {
                    return (
                      <div key={item.key} className="ml-auto w-full max-w-[96%] flex flex-col items-stretch gap-1">
                        <div className="flex items-start justify-end gap-2 w-full">
                          <div className="w-8 h-8 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">REP</div>
                          <div className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed font-medium max-w-[94%]" style={{ background: "#39ACAC", color: "white" }}>
                            {sanitizeRenderedMessage(turn.repMessage, "user-message")}
                          </div>
                        </div>
                        {turn.alignment && turns.filter((t) => t.repMessage && t.turnNumber <= turn.turnNumber).length > 1 && (
                          <>
                            <div className={`ml-auto w-full max-w-[88%] px-2 py-1 rounded-lg text-xs border text-right ${turn.alignment.score >= 4 ? 'bg-teal-50 text-teal-700 border-teal-200' :
                              turn.alignment.score <= 2 ? 'bg-red-50 text-red-700 border-red-200' :
                                'bg-slate-50 text-slate-600 border-slate-200'
                              }`}>
                              <div className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap">{buildRepGuidance(turn, turns)}</div>
                            </div>
                            {turn.alignment.rubricAlignmentFlags?.length > 0 && (
                              <div className="ml-auto w-full max-w-[88%] break-words whitespace-normal px-2.5 py-1 rounded-lg text-xs bg-amber-50 border border-amber-200 text-amber-700 italic text-right">
                                {turn.alignment.rubricAlignmentFlags[0]}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div key={item.key} className="flex flex-col items-start gap-1">
                      {turn.cueBefore && (
                        <div className="pl-1 w-fit max-w-[90%] md:max-w-[80%]">
                          <p className="w-fit max-w-full text-xs italic leading-snug px-3 py-1.5 rounded-lg border whitespace-normal break-words" style={{ color: '#7B1F1F', borderColor: '#7B1F1F', background: '#F9F5F5' }}>
                            {sanitizeRenderedMessage(personalizeCueText(turn.cueBefore, hcpDisplayName), "behavioral-cue")}
                          </p>
                        </div>
                      )}
                      {turn.hcpDialogueBefore && (
                        <div className="flex items-start">
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold mr-2 flex-shrink-0 mt-1" title={hcpDisplayName}>HCP</div>
                          <div className="max-w-[98%] rounded-2xl px-3 md:px-4 py-2.5 text-sm leading-relaxed bg-slate-200/90 text-slate-800 whitespace-normal break-words">
                            {sanitizeRenderedMessage(turn.hcpDialogueBefore, "hcp-message")}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {isLoading && turns.length > 0 && (
                  <div className="flex justify-start">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold mr-2 flex-shrink-0" title={hcpDisplayName}>HCP</div>
                    <div className="bg-slate-100 rounded-2xl px-4 py-2.5 flex gap-1 items-center">
                      <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0.1s" }} />
                      <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0.2s" }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <CoachingOverlay
                tip={coachingTip?.tip}
                label={coachingTip?.label}
                suggestion={coachingTip?.suggestion}
                severity={coachingTip?.severity}
                escalationLabel={coachingTip?.escalationLabel}
                onDismiss={() => setCoachingTip(null)}
              />

              {/* Input */}
              <div className="px-3 md:px-5 py-3 border-t flex-shrink-0 bg-white pb-[max(12px,env(safe-area-inset-bottom))]">
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (isLoading || isEnding) return;
                    const message = sanitizeUserMessage(input);
                    if (!message) return;
                    sendMessage(input);
                  }}
                  className="flex gap-2 items-center"
                >
                  <div className="relative flex-1">
                    <Input
                      ref={inputRef}
                      value={input}
                      onChange={e => {
                        setInput(e.target.value);
                        if (isListening && e.target.value.length > input.length) {
                          stopListening();
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          // Single submit path: let <form onSubmit> handle send to avoid duplicate turn creation.
                          e.preventDefault();
                          e.currentTarget.form?.requestSubmit();
                        }
                      }}
                        placeholder={isListening ? "Listening…" : "Your response as the sales rep (REP)..."}
                    disabled={isLoading || isEnding}
                    className={`flex-1 w-full pr-2 ${isListening ? "border-red-400 ring-1 ring-red-300" : ""}`}
                    />
                    {isListening && interim && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none truncate pr-4">
                        {input ? null : <span className="italic">{interim}</span>}
                      </div>
                    )}
                  </div>
                  <VoiceControls
                    isListening={isListening}
                    isSpeaking={isSpeaking}
                    sttSupported={sttSupported}
                    ttsSupported={ttsSupported}
                    voiceSettings={voiceSettings}
                    onToggleMic={toggleListening}
                    onStopSpeaking={stopSpeaking}
                    onChangeSettings={setVoiceSettings}
                  />
                  <Button type="submit" disabled={isLoading || isEnding || (!sanitizeUserMessage(input) && !interim) || shouldBlockLowSubstanceSubmit} style={{ background: "#39ACAC" }} className="hover:opacity-90 text-white px-4 py-2 rounded">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
                {isListening && interim && (
                  <p className="text-xs text-red-500 mt-1 italic">🎙 "{interim}"</p>
                )}
                <p className="text-xs text-slate-400 mt-1 italic">
                  Signal–Response Alignment evaluates observable behavioral adaptation to HCP signals — not empathy, intent, or personality.
                </p>
              </div>
            </>
          )}

          {activeTab === "annotate" && (
            <AnnotatedTranscript messages={flatMessages} scenario={scenario} />
          )}

          {activeTab === "capabilities" && (
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 pt-4 pb-2">
                <button
                  onClick={endSession}
                  disabled={isEnding || repTurnsCount < 2}
                  className="inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all duration-200 text-xs px-3 py-1.5 border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isEnding ? "Generating feedback…" : feedback ? "Regenerate Sections 2-5" : "Generate Sections 2-5"}
                </button>
              </div>
              {/* Section 1: Embed CapabilityFeedbackPanel at the top of End & Get Feedback pill */}
              <div className="mb-6">
                <CapabilityFeedbackPanel messages={flatMessages} turns={turns} scenario={scenario} />
              </div>
              {/* Sections 2-5: Render feedback markdown below CapabilityFeedbackPanel */}
              {isEnding && (
                <div className="mx-4 mb-4 rounded-lg border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-800">
                  Generating final evaluation sections…
                </div>
              )}
              {feedback && (
                <div className="mx-4 mb-8 mt-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <ReactMarkdown
                    components={{
                      h2: ({ children, ...props }) => <h2 className="text-xl font-bold text-slate-900 mt-7 mb-3 first:mt-0" {...props}>{children}</h2>,
                      h3: (props) => <h3 className="text-base font-semibold text-slate-800 mt-4 mb-2" {...props} />,
                      h4: (props) => <h4 className="text-sm font-semibold text-slate-700 mt-3 mb-1" {...props} />,
                      p: (props) => <p className="mb-4 leading-7 text-slate-700" {...props} />,
                      ul: (props) => <ul className="list-disc list-inside mb-4 space-y-2 ml-1" {...props} />,
                      ol: (props) => <ol className="list-decimal list-inside mb-4 space-y-2 ml-1" {...props} />,
                      li: (props) => <li className="mb-0" {...props} />,
                      strong: (props) => <strong className="font-semibold text-slate-900" {...props} />,
                      em: (props) => <em className="italic text-slate-600" {...props} />,
                      blockquote: (props) => <blockquote className="border-l-4 border-slate-300 pl-4 italic text-slate-600 my-3" {...props} />,
                    }}
                  >{feedback}</ReactMarkdown>
                  <div className="mt-6 border-t border-slate-200 pt-4 flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportFeedbackPDF}
                      className="text-xs border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    >
                      Export to PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs border-teal-600 bg-teal-600 text-white hover:bg-teal-700 hover:border-teal-700"
                      onClick={openCoachingOnSession}
                    >
                      <Bot className="w-3.5 h-3.5 mr-1" />
                      Get Coaching on Session
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Keep metrics component mounted (for parity/diagnostics), but hidden from rep UI to prevent score-gaming. */}
      {showLiveMetricsPanel ? (
        <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0" style={{ background: "#1A334D" }}>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Behavioral Metrics</h3>
            <p className="text-xs mt-0.5" style={{ color: "#39ACAC" }}>Turn-by-turn Signal Intelligence scoring</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <LiveMetricsPanel turns={turns} scenario={scenario} />
          </div>
        </div>
      ) : (
        <div className="hidden" aria-hidden="true">
          <LiveMetricsPanel turns={turns} scenario={scenario} />
        </div>
      )}
    </div>
  );
}

// Audit logging utility
function logAuditEvent(eventType, details) {
  // Example: send to backend or local storage
  // window.fetch('/api/audit/log', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ eventType, details, timestamp: Date.now() })
  // });
  // For demo, log to console
  console.log(`[AUDIT] ${eventType}`, details);
}
