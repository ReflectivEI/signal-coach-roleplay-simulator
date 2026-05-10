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
import { computeAlignment, END_SESSION_EVALUATION_BASELINE } from "./alignmentEngine";
import { getBaselineAlignedInlineGuidance } from "./inlineCoachingCalibration";
import CoachingOverlay, { shouldTriggerCoaching } from "./CoachingOverlay";
import LiveMetricsPanel from "./LiveMetricsPanel";
import { useVoice } from "./useVoice";
import VoiceControls from "./VoiceControls";

// Voice session state management
function useVoiceSessionControl() {
  const [voiceSessionActive, setVoiceSessionActive] = useState(false);
  const [voiceSessionEnded, setVoiceSessionEnded] = useState(false);
  // Only the rep can end the voice session
  const startVoiceSession = () => {
    setVoiceSessionActive(true);
    setVoiceSessionEnded(false);
  };
  const endVoiceSession = (byRep = false) => {
    if (byRep) {
      setVoiceSessionActive(false);
      setVoiceSessionEnded(true);
    }
  };
  return { voiceSessionActive, voiceSessionEnded, startVoiceSession, endVoiceSession };
}
import { getDifficultyVisuals } from "./difficultyStyles";
import { normalizeMessage } from "@/lib/messageNormalization";
import { normalizeTone } from "@/lib/conversationToneNormalization";
import {
  applyMetricApplicabilityGating,
  enforceFeedbackEvidenceRules,
  enforceProhibitedStateTransition,
  validateScenarioRuntimeContract,
} from "@/lib/scenarioNormalization";
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
  computeAuxiliaryProgressionScore,
  detectDiminishingReturns,
  resolveConstraintLoopAction,
} from "./constraintLoopPolicy";
import {
  extractConstraintCandidatesFromText,
  buildConstraintGrounding,
  detectConstraintDraftViolations,
  buildConstraintSafeRegeneratedResponse,
  selectLateTurnConstraintResponseMode,
  buildLateTurnConstraintResponse,
  detectOperationalConstraintTypes,
  detectRepClarificationRequest,
  detectUnsupportedScenarioFactIntroduction,
  buildScenarioFactSafeClarification,
} from "./operationalConstraintGuardrails";
import { buildDeterministicGenerationKey } from "./generationKey";
import { buildCoachingFeedbackMarkdown, parseStructuredFeedback } from "./sessionFeedbackFormatter";
import {
  createInitialInterventionSessionState,
  buildDemandHoldDirective,
  updateInterventionSessionState,
} from "./interventionEngineV2";
import { shouldAllowDemandHoldOverride } from "./demandHoldContinuity";
import {
  createInitialHardDemandPriorityState,
  updateHardDemandPriorityState,
  getBufferedConcernAfterHardDemandRelease,
  buildHardDemandLockedObjective,
} from "./hardDemandPriorityLock";
import { buildSafeReferenceLeadIn } from "./hcpReferenceSafety";
import { resolveCanonicalHcpIdentity } from "./hcpIdentity";
import {
  determinePreferredHcpDialogueRegister,
  enforceOperationalRealismPreference,
} from "./operationalRealismEnforcer";
import {
  buildHcpReactionContract,
  enforceCueDialogueContractIntegrity,
} from "./hcpReactionIntegrity";
import {
  evaluateScenarioDomainIntegrity,
  enforceDomainReanchorInDialogue,
} from "./scenarioDomainIntegrity";
import {
  buildLatestAskProgressionDialogue,
  classifyLatestAskProgression,
} from "./latestAskProgression";
import { detectOpeningSceneDialogueReplay, extractScenarioOwnedOpeningTurn } from "./openingTurnAuthority";
import { validateRoleplayRepTurn } from "@/lib/roleplay/roleplayTurnValidation";
import {
  buildConversationIntelligenceTelemetryEvent,
  deriveConversationIntelligenceState,
} from "@/lib/roleplay/conversationIntelligence";
import { detectStructuredScenarioContentLeak, repairStructuredScenarioContentLeak } from "@/lib/roleplay/structuredScenarioLeakGuard";
import { resolveActiveHcpAskState } from "@/lib/roleplay/activeHcpAskState";
import { buildRoleplayScenarioExecutionContract } from "@/lib/roleplay/scenarioExecutionContract";
import { selectStateAlignedHcpCue } from "@/lib/roleplay/hcpCueStateAlignment";
import { applyConversationalRealism } from "@/lib/roleplay/conversationalRealismEngine";
import { recordSimulatorTelemetry } from "@/lib/roleplay-v2/simulatorTelemetry";

function buildRuntimeScenarioView(scenario = {}, runtimeContract = {}) {
  return {
    ...scenario,
    hcpProfile: runtimeContract?.hcpProfile || scenario?.hcpProfile,
    sceneSetup: runtimeContract?.sceneSetup || scenario?.sceneSetup,
    hcpStateModel: runtimeContract?.hcpStateModel || scenario?.hcpStateModel,
    enforcementCriteria:
      runtimeContract?.sceneSetup?.enforcementCriteria
      || scenario?.enforcementCriteria,
    metricApplicabilityMap:
      runtimeContract?.metricApplicabilityMap
      || scenario?.metricApplicabilityMap,
    runtimeBehaviorTags:
      runtimeContract?.runtimeBehaviorTags
      || scenario?.runtimeBehaviorTags,
  };
}

function resolveScenarioOpeningState(scenario = {}, runtimeContract = {}) {
  return runtimeContract?.hcpStateModel?.startingState
    || runtimeContract?.runtimeBehaviorTags?.startingState
    || scenario?.hcpStateModel?.startingState
    || scenario?.openingState
    || scenario?.sceneSetup?.openingState
    || null;
}

function escapeHTML(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sanitizeUserMessage(text) {
  return escapeHTML(String(text || "").trim());
}

function sanitizeRenderedMessage(text, source = "unknown") {
  const originalText = String(text || "");

  try {
    const normalizedText = normalizeMessage(originalText);
    const toneNormalizedText = normalizeTone(normalizedText);
    const hardenedText = hardenTextSurface(toneNormalizedText);
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

function normalizeLlmInvokeText(payload) {
  const source = payload && typeof payload === "object"
    ? (payload.response ?? payload.text ?? payload.content ?? "")
    : "";

  if (typeof source === "string") return source.trim();
  if (Array.isArray(source)) return source.map((item) => String(item || "")).join(" ").trim();
  if (source && typeof source === "object") {
    if (typeof source.text === "string") return source.text.trim();
    try {
      return JSON.stringify(source).trim();
    } catch {
      return String(source).trim();
    }
  }
  return String(source || "").trim();
}

function classifyDialogueCueIntent(text = "") {
  const value = String(text || "").toLowerCase();
  if (!value) return "neutral";
  if (/\b(understood|front desk|follow-up slot|conversation is ending|wrap this up|need to move on)\b/.test(value)) return "closing";
  if (/\b(not interested|not convinced|we are done|stop here|can't recommend|won't|decline|refuse|skeptical|doubt)\b/.test(value)) return "resistant";
  if (/\b(happy to|that helps|that works|makes sense|good point|let's do that)\b/.test(value)) return "engaged";
  if (/\b(running late|short on time|quickly|briefly|patient waiting|pager|clock|schedule)\b/.test(value)) return "time";
  return "neutral";
}

function classifyCueTextIntent(cueText = "") {
  const value = String(cueText || "").toLowerCase();
  if (!value) return "neutral";
  if (/\b(ending|leave|front desk|threshold|wrap|closing)\b/.test(value)) return "closing";
  if (/\b(clipped|less engaged|skeptic|defensive|patience thinning|frustrat|impatient|irritat)\b/.test(value)) return "resistant";
  if (/\b(engagement|leans forward|acknowledgment|relaxed|engaged)\b/.test(value)) return "engaged";
  if (/\b(clock|watch|pager|time|hurry|quick)\b/.test(value)) return "time";
  return "neutral";
}

function validateCueDialogueAlignment({ cueText = "", dialogueText = "", hcpState = "neutral" } = {}) {
  const cueIntent = classifyCueTextIntent(cueText);
  const dialogueIntent = classifyDialogueCueIntent(dialogueText);
  const state = String(hcpState || "neutral");
  const contradiction = (
    (cueIntent === "engaged" && (dialogueIntent === "resistant" || state === "resistant" || state === "disengaged" || state === "irritated"))
    || (cueIntent === "resistant" && (dialogueIntent === "engaged" || state === "engaged"))
    || (cueIntent === "closing" && dialogueIntent === "engaged")
  );
  return { cueIntent, dialogueIntent, contradiction };
}

function extractContinuityTokens(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4)
    .filter((token) => !["with", "that", "this", "your", "from", "have", "what", "when", "where", "which", "would"].includes(token));
}

function evaluateRepToHcpContinuity({
  repMessage = "",
  hcpDialogue = "",
  priorHcpDialogue = "",
  activeConcern = "workflow",
} = {}) {
  const repTokens = new Set(extractContinuityTokens(repMessage));
  const hcpTokens = new Set(extractContinuityTokens(hcpDialogue));
  const priorTokens = new Set(extractContinuityTokens(priorHcpDialogue));
  const overlapWithRep = [...repTokens].filter((token) => hcpTokens.has(token)).length;
  const overlapWithPrior = [...priorTokens].filter((token) => hcpTokens.has(token)).length;

  const repMentionsEvidence = /\b(study|trial|evidence|methodology|duration|jama|published|endpoint)\b/i.test(repMessage);
  const priorAskedEvidence = /\b(study|methodology|duration|evidence|data|endpoint)\b/i.test(priorHcpDialogue);
  const hcpMentionsEvidence = /\b(study|methodology|duration|evidence|data|endpoint)\b/i.test(hcpDialogue);
  const hcpMentionsConcern = new RegExp(`\\b${String(activeConcern || "workflow").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(hcpDialogue);

  const directContinuityGap =
    (repTokens.size >= 3 && overlapWithRep === 0)
    || (priorTokens.size >= 3 && overlapWithPrior === 0);
  const evidenceDriftGap = repMentionsEvidence && priorAskedEvidence && !hcpMentionsEvidence && !hcpMentionsConcern;

  return {
    needsRepair: directContinuityGap || evidenceDriftGap,
    overlapWithRep,
    overlapWithPrior,
    evidenceDriftGap,
  };
}

function hasTurnIntegrityIssues(turn) {
  const issues = [];
  if (!Number.isFinite(turn?.turnNumber)) issues.push("missing_turn_number");
  if (typeof turn?.cueBefore !== "string" || !turn.cueBefore.trim()) issues.push("missing_cue");
  if (typeof turn?.hcpDialogueBefore !== "string" || !turn.hcpDialogueBefore.trim()) issues.push("missing_hcp_dialogue");
  if (!turn?.generationKey) issues.push("missing_generation_key");
  return issues;
}

function extractHcpConstraints(hcpMessage = "") {
  const text = String(hcpMessage || "");
  const lower = text.toLowerCase();
  if (!lower.trim()) return [];
  const found = [];
  const register = (type, description, confidenceSignals = 0) => {
    const confidence = Math.min(1, 0.4 + (confidenceSignals * 0.2));
    if (confidence < 0.6) return;
    found.push({ type, description, priority: "blocking", confidence, source: "hcp_message", turnsActive: 0 });
  };

  const evidenceSignals = [
    /\b(evidence|data|study|proof|published|head-to-head|outcome)\b/.test(lower),
    /\b(show me|what data|what evidence|which study)\b/.test(lower),
    /\b(patient population|practice-relevant|real-world)\b/.test(lower),
  ].filter(Boolean).length;
  if (evidenceSignals > 0) {
    register("request_for_evidence", "HCP requests concrete evidence", evidenceSignals);
  }
  const specificitySignals = [
    /\b(specific|exactly|concrete|one example|practical example|what specifically)\b/.test(lower),
    /\b(one step|single step|be precise|not generic)\b/.test(lower),
  ].filter(Boolean).length;
  if (specificitySignals > 0) {
    register("request_for_specificity", "HCP requests specific, concrete detail", specificitySignals);
  }
  const applicabilitySignals = [
    /\b(for my patients|in my practice|for our clinic|applicable|relevant here|in this setting)\b/.test(lower),
    /\b(how this applies here|for our setting|for my team)\b/.test(lower),
  ].filter(Boolean).length;
  if (applicabilitySignals > 0) {
    register("request_for_applicability", "HCP requests setting-specific applicability", applicabilitySignals);
  }
  const operationalSignals = [
    /\b(workflow|staff|time|capacity|operational|implementation|fit|process|prior auth|paperwork)\b/.test(lower),
    /\b(without extra burden|within our constraints|how this fits)\b/.test(lower),
  ].filter(Boolean).length;
  if (operationalSignals > 0) {
    register("request_for_operational_fit", "HCP requests operational fit", operationalSignals);
  }
  const clarificationSignals = [
    /\b(clarify|what do you mean|explain|walk me through|help me understand)\b/.test(lower),
    /\b(unclear|not clear|spell it out)\b/.test(lower),
  ].filter(Boolean).length;
  if (clarificationSignals > 0) {
    register("request_for_clarification", "HCP requests clarification", clarificationSignals);
  }

  return found;
}

function isConstraintSatisfied(constraint, repMessage = "") {
  const rep = String(repMessage || "").toLowerCase();
  if (!rep.trim()) return "not_satisfied";
  const hasEvidence = /\b(study|trial|data|outcome|published|rate|percent|cohort|population)\b/.test(rep);
  const hasSpecificity = /\b(example|specifically|exactly|for instance|one step|first step|checklist|protocol)\b/.test(rep);
  const hasApplicability = /\b(your clinic|your patients|in your setting|for your team|in practice|workflow)\b/.test(rep);
  const hasOperational = /\b(workflow|staff|capacity|time|prior auth|paperwork|implementation|handoff|process)\b/.test(rep);
  const hasClarification = /\b(meaning|to clarify|what this means|in other words|step by step)\b/.test(rep);
  const acknowledgesConstraint = /\b(i hear|you raised|you mentioned|you are right|that concern|that constraint|fair point)\b/.test(rep);
  const directAnswerSignal = /\b(so the step is|here is the step|specifically|first action|do this)\b/.test(rep);

  switch (constraint?.type) {
    case "request_for_evidence":
      if (hasEvidence && hasSpecificity && hasApplicability) return "fully_satisfied";
      if ((hasEvidence && (hasSpecificity || hasApplicability)) || acknowledgesConstraint) return "partially_satisfied";
      return "not_satisfied";
    case "request_for_specificity":
      if (hasSpecificity && directAnswerSignal) return "fully_satisfied";
      if (hasSpecificity || acknowledgesConstraint) return "partially_satisfied";
      return "not_satisfied";
    case "request_for_applicability":
      if (hasApplicability && (hasSpecificity || hasEvidence)) return "fully_satisfied";
      if (hasApplicability || acknowledgesConstraint) return "partially_satisfied";
      return "not_satisfied";
    case "request_for_operational_fit":
      if (hasOperational && hasSpecificity && hasApplicability) return "fully_satisfied";
      if (hasOperational || acknowledgesConstraint) return "partially_satisfied";
      return "not_satisfied";
    case "request_for_clarification":
      if (hasClarification && hasSpecificity) return "fully_satisfied";
      if (hasClarification || hasSpecificity || acknowledgesConstraint) return "partially_satisfied";
      return "not_satisfied";
    default:
      return "not_satisfied";
  }
}

function mergeActiveConstraints(previous = [], detected = []) {
  const merged = [];
  const seen = new Set();
  [...(Array.isArray(previous) ? previous : []), ...(Array.isArray(detected) ? detected : [])].forEach((constraint) => {
    const key = `${constraint?.type || "unknown"}::${constraint?.description || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(constraint);
  });
  return merged;
}

function validateConstraintState(constraints = [], options = {}) {
  const detailed = options?.detailed === true;
  const issues = [];

  if (!Array.isArray(constraints)) {
    issues.push("constraints_not_array");
    return detailed ? { constraints: [], issues } : [];
  }

  const normalized = constraints
    .filter((constraint, index) => {
      const valid = constraint && typeof constraint === "object" && constraint.type;
      if (!valid) {
        issues.push(`invalid_constraint_at_${index}`);
      }
      return valid;
    })
    .map((constraint) => ({
      ...constraint,
      priority: constraint.priority === "soft" ? "soft" : "blocking",
      turnsActive: Math.max(0, Number(constraint.turnsActive || 0)),
      confidence: Math.max(0, Math.min(1, Number(constraint.confidence || 0.6))),
      satisfaction: constraint.satisfaction || "not_satisfied",
      partialCount: Math.max(0, Number(constraint.partialCount || 0)),
      progressionScoreHistory: Array.isArray(constraint.progressionScoreHistory)
        ? constraint.progressionScoreHistory.slice(-6).map((score) => Math.max(0, Math.min(1, Number(score || 0))))
        : [],
      lastResolutionState: constraint.lastResolutionState || constraint.satisfaction || "not_satisfied",
      functionallyResolved: Boolean(constraint.functionallyResolved || constraint.satisfaction === "functionally_resolved"),
    }));

  return detailed ? { constraints: normalized, issues } : normalized;
}

function normalizeConstraintValidationResult(result) {
  if (Array.isArray(result)) {
    return { constraints: result, issues: ["array_shape_adapter"] };
  }
  const constraints = Array.isArray(result?.constraints) ? result.constraints : [];
  const issues = Array.isArray(result?.issues) ? result.issues : [];
  return { constraints, issues };
}

function computeSimilarity(a = "", b = "") {
  const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const tokensA = new Set(normalize(a).split(" ").filter((token) => token.length > 2));
  const tokensB = new Set(normalize(b).split(" ").filter((token) => token.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) overlap += 1;
  });
  return overlap / Math.max(tokensA.size, tokensB.size);
}

function mapDemandTypeToFamily(demandType = "") {
  const type = String(demandType || "").toLowerCase();
  if (!type) return null;
  if (type.includes("evidence") || type.includes("proof")) return "evidence";
  if (type.includes("operational") || type.includes("applicability")) return "operational";
  if (type.includes("direct")) return "direct";
  return null;
}

function mapConstraintTypeToDemandFamily(constraintType = "") {
  const type = String(constraintType || "").toLowerCase();
  if (type.includes("evidence")) return "evidence";
  if (type.includes("operational") || type.includes("applicability") || type.includes("specificity")) return "operational";
  if (type.includes("clarification")) return "direct";
  return null;
}

function hardenTextSurface(text) {
  let value = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!value) return "";

  value = value
    .replace(/\bi\b/g, "I")
    .replace(/\b(I(?:'d| would) like) on\b/gi, "$1 guidance on")
    .replace(/\b(I(?:'d| would) like) about\b/gi, "$1 to talk about")
    .replace(/\b(I(?:'d| would) like) for\s+(guidance|clarity|detail|details|help)\b/gi, "$1 $2")
    .replace(/\b(I want) on\b/gi, "$1 guidance on")
    .replace(/\b(I want) about\s+(?!\d+\b|one\b|two\b|three\b|four\b|five\b|six\b|seven\b|eight\b|nine\b|ten\b)/gi, "$1 to talk about ")
    .replace(/\b(I want) for\s+(guidance|clarity|detail|details|help)\b/gi, "$1 $2")
    .replace(/\b(Before we discuss new data)\.\s+(Can|Could|Would|What|How|Which|When|Where|Why)\b/g, "$1, $2")
    .replace(/([.!?])\s*([a-z])/g, (_, punc, char) => `${punc} ${char.toUpperCase()}`)
    .replace(/,\s+(Who|What|How|Which|When|Where|Why|Can|Could|Would|Should|Do|Does|Did|Is|Are)\b/g, (_, word) => `, ${word.toLowerCase()}`)
    .replace(/^([a-z])/, (_, char) => char.toUpperCase());

  if (!/[.!?]$/.test(value)) {
    const looksLikeQuestion = /\b(what|how|why|when|where|who|which|do|does|did|can|could|would|will|is|are|am|should|have|has|had)\b/i.test(value);
    value += looksLikeQuestion ? "?" : ".";
  }

  return value;
}

function enforceNaturalStandaloneUtterance(text = "", activeConcern = "workflow") {
  const value = hardenTextSurface(text);
  if (!value) return value;

  const concern = String(activeConcern || "workflow").toLowerCase();

  const danglingTopicMatch = value.match(/^if we're talking about\s+([^.!?]+)[.!?]$/i);
  if (danglingTopicMatch) {
    const topic = String(danglingTopicMatch[1] || "").trim();
    if (topic) {
      if (concern === "evidence" || /\bstudy|trial|data|endpoint|mortality|outcome\b/i.test(topic)) {
        return `If we're talking about ${topic}, what data are you pointing to exactly?`;
      }
      if (concern === "access") {
        return `If we're talking about ${topic}, what changes in access for my team?`;
      }
      if (concern === "workflow" || concern === "time") {
        return `If we're talking about ${topic}, be specific about the first practical step.`;
      }
      return `If we're talking about ${topic}, be specific.`;
    }
  }

  if (/\b(of|for|to|about|with|in|on|at|from|than|that|which)\.?$/i.test(value)) {
    if (concern === "evidence") {
      return `${value.replace(/[.?!]$/, "")} exactly?`;
    }
    return `${value.replace(/[.?!]$/, "")} specifically?`;
  }

  return value;
}

const SHOW_VISIBLE_HCP_CUES = true;

function formatCueValue(value = "") {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function resolveVisibleHcpCueText(turn = {}, hcpDisplayName = "HCP") {
  let cueText = String(
    turn?.cueBefore
    || turn?.hcpReactionContract?.selectedCueText
    || ""
  ).trim();

  if (!cueText && turn?.hcpDialogueBefore) {
    const alignedCue = selectStateAlignedHcpCue({
      existingCueText: "",
      preferStateDerived: true,
      activeHcpAsk: turn?.plannerStateSnapshot?.latestAskProgression?.family || turn?.activeConcern || "",
      concernFamily: turn?.plannerStateSnapshot?.activeConcern || turn?.activeConcern || "",
      escalationStage: turn?.plannerStateSnapshot?.latestAskProgression?.status || "",
      hcpState: turn?.hcpStateBefore || "",
      decayTier: turn?.plannerStateSnapshot?.engagementTier || "",
      timePressure: /time/i.test(String(turn?.plannerStateSnapshot?.activeConcern || turn?.activeConcern || "")),
      terminal: false,
      conversationIntelligenceState: {},
      validationOutput: {},
      dialogueText: turn?.hcpDialogueBefore || "",
      scenarioId: turn?.scenarioId || "scenario",
      turnNumber: Number.isFinite(turn?.turnNumber) ? turn.turnNumber : 0,
    });
    cueText = String(alignedCue?.cueText || "").trim();
  }

  if (!cueText) return "";

  const personalizedCue = sanitizeRenderedMessage(
    personalizeCueText(cueText, hcpDisplayName),
    "behavioral-cue"
  );

  if (import.meta.env.DEV && typeof window !== "undefined") {
    const hcpCueState = {
      cueText: personalizedCue,
      predictedState: String(turn?.hcpStateBefore || ""),
      openness: String(turn?.plannerStateSnapshot?.engagementTier || ""),
      trajectory: String(turn?.plannerStateSnapshot?.latestAskProgression?.status || ""),
      risk: String(turn?.plannerStateSnapshot?.activeConcern || turn?.activeConcern || ""),
      turnNumber: turn?.turnNumber ?? null,
    };
    window.hcpCueState = hcpCueState;
    globalThis.hcpCueState = hcpCueState;
    console.debug("hcpCueState", hcpCueState);
  }

  return personalizedCue;
}

function deriveVisibleCuePredictedState(turn = {}) {
  const cueState = turn?.hcpReactionContract?.cueStateAlignment;
  const source = cueState?.concernFamily || turn?.hcpStateBefore || turn?.plannerStateSnapshot?.activeConcern || "neutral";
  return formatCueValue(source) || "Neutral";
}

function deriveVisibleCueOpenness(turn = {}) {
  const state = String(turn?.hcpStateBefore || "").toLowerCase();
  const tier = String(turn?.plannerStateSnapshot?.engagementTier || "").toLowerCase();
  if (/\b(openness|open|curiosity|engaged)\b/.test(state) || tier === "engaged") return "Open";
  if (/\b(resistance|closed|frustration|disengaged|boundary)\b/.test(state) || ["impatient", "disengaging"].includes(tier)) return "Closed";
  if (tier === "constrained") return "Guarded";
  return "Neutral";
}

function deriveVisibleCueTrajectory(turn = {}) {
  const cueState = turn?.hcpReactionContract?.cueStateAlignment;
  const status = String(turn?.plannerStateSnapshot?.latestAskProgression?.status || cueState?.stateSignals?.progression || "").toLowerCase();
  const tier = String(turn?.plannerStateSnapshot?.engagementTier || "").toLowerCase();
  const state = String(turn?.hcpStateBefore || "").toLowerCase();
  if (status.includes("progress")) return "Improving";
  if (status.includes("missed") || status.includes("close")) return "Declining";
  if (["impatient", "disengaging"].includes(tier) || /\b(resistance|frustration|disengaged|boundary)\b/.test(state)) return "Declining";
  if (tier === "constrained") return "Stalled";
  return "Stable";
}

function deriveVisibleCueRisk(turn = {}) {
  const tier = String(turn?.plannerStateSnapshot?.engagementTier || "").toLowerCase();
  const concern = String(turn?.plannerStateSnapshot?.activeConcern || turn?.activeConcern || turn?.hcpReactionContract?.cueStateAlignment?.concernFamily || "").toLowerCase();
  const state = String(turn?.hcpStateBefore || "").toLowerCase();
  if (["impatient", "disengaging"].includes(tier) || /\b(resistance|frustration|disengaged|boundary)\b/.test(state)) return "High";
  if (/\b(safety|time|access)\b/.test(concern) || tier === "constrained") return "Moderate";
  if (/\b(openness|open|curiosity|engaged)\b/.test(state)) return "Low";
  return "Moderate";
}

function buildVisibleHcpCueSummary(turn = {}, hcpDisplayName = "HCP") {
  return {
    predictedState: deriveVisibleCuePredictedState(turn),
    openness: deriveVisibleCueOpenness(turn),
    trajectory: deriveVisibleCueTrajectory(turn),
    risk: deriveVisibleCueRisk(turn),
    behavioralNotes: resolveVisibleHcpCueText(turn, hcpDisplayName),
  };
}

function hasVisibleHcpCue(turn = {}) {
  return Boolean(String(
    turn?.cueBefore
    || turn?.hcpReactionContract?.selectedCueText
    || ""
  ).trim());
}

function applyDeterministicPunctuationContract(text) {
  return normalizeHcpDialoguePunctuation(String(text || "").trim()).trim();
}

function extractScenarioKeywords(scenario) {
  const combined = [
    scenario?.title,
    scenario?.description,
    scenario?.visibleScenarioContext,
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
  workflow: /\b(workflow|staff|staffing|nurse|team|throughput|burden|operational|implementation|implement|process|capacity|standardi[sz]e|training|education|monitoring|call-?tree|one-?pager|pathway|handoff|checklist|protocol|template|standing order)\b/i,
  evidence: /\b(evidence|study|trial|endpoint|head-to-head|methodology|duration|confidence interval|data|proof)\b/i,
  access: /\b(access|prior auth|authorization|coverage|payer|insurance|formular|cost|reimbursement|paperwork)\b/i,
  time: /\b(time|busy|schedule|clinic|today|quick|minutes|rush|back-to-back)\b/i,
  policy: /\b(policy|protocol|guideline|committee|pathway|institution|restriction)\b/i,
  screening: /\b(screening|eligibility|candidacy|contraindication|resistance)\b/i,
};

const PLANNER_TRACE_FLAG_KEY = "roleplay.debug.planner_trace";
const OPERATIONAL_CONSTRAINT_PRIORITY = ["staffing", "capacity", "workflow", "prior_auth", "scheduling", "handoff", "callback", "throughput", "time", "access", "policy", "screening", "evidence"];

function readDebugFlag(flagKey) {
  if (typeof window === "undefined") return false;
  try {
    const value = window.localStorage?.getItem(flagKey);
    return value === "1" || value === "true";
  } catch {
    return false;
  }
}

function isPlannerTraceEnabled() {
  return readDebugFlag(PLANNER_TRACE_FLAG_KEY);
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
      constraint?.constraintType || constraint?.type || `constraint_${idx}`,
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

function recordTurnValidationTelemetry(validation, context = {}) {
  (validation?.telemetryEvents || []).forEach((event) => {
    recordSimulatorTelemetry(event.eventType, {
      ...(event.payload || {}),
      ...context,
    });
  });
}

function recordConversationIntelligenceTelemetry(conversationIntelligenceState, context = {}) {
  const event = buildConversationIntelligenceTelemetryEvent(conversationIntelligenceState, context);
  recordSimulatorTelemetry(event.eventType, event.payload);
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
    "The HCP glances toward the hallway, then returns attention for one practical point.",
    "The HCP keeps the exchange concise, clearly trying to protect clinic flow.",
    "The HCP taps the chart once, signaling that the next point needs to be practical.",
  ],
  disengaging: [
    "The HCP shifts slightly toward the next task, waiting for immediate relevance.",
    "The HCP gathers the chart but leaves space for one useful, concrete answer.",
    "The HCP keeps attention brief, expecting one concrete point before moving on.",
  ],
};

// Feature flags (default OFF): safety harness for optional dialogue realism transforms.
const ENABLE_REALISM_TRANSFORM_HARNESS = import.meta.env.VITE_ENABLE_REALISM_TRANSFORM_HARNESS === "true";
const ENABLE_REALISM_REPLAY_METRICS = import.meta.env.VITE_ENABLE_REALISM_REPLAY_METRICS === "true";
const ENABLE_V2_INTERVENTION_RUNTIME = import.meta.env.VITE_ROLEPLAY_V2_INTERVENTION_ENABLED === "true";
const ENABLE_V2_INTERVENTION_UI = import.meta.env.VITE_ROLEPLAY_V2_INTERVENTION_UI === "true";

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
      "I hear the context, but in my clinic this comes down to workflow. What is one process change my team could use this week?",
      "I get where you're going, but I need to understand the practical lift. What is one change we could try without adding staff burden?",
      "That may be relevant, but clinic flow is the issue for me right now. What would my team actually do differently first?",
      "I can stay with this if we make it concrete. What is the first step my staff would own?",
      "I am open to the idea, but it has to be practical. What is the smallest workflow change you would recommend first?",
    ],
    access: [
      "I understand the broader point, but access is still the barrier for me. What is one payer-facing step that could reduce rework for us?",
      "That only helps if it lowers the prior-auth burden. What practical access step would you start with?",
      "For this to matter here, it has to move approvals faster. What is the first access action you would recommend?",
      "I need this tied to the admin load we actually feel. What process change would cut access delays without adding work?",
      "I can work with one specific access tactic if my team can run it this week. What would that be?",
    ],
    evidence: [
      "I hear you, but I still need the evidence tied to a real decision. Which proof point should change what I do now?",
      "Make the data practical for me. What one evidence point applies to the patients I am seeing this month?",
      "I can evaluate one strong signal here, but it has to connect to the decision. What data point should affect tomorrow's choice?",
      "Keep it tight: give me one proof point and the clinical implication for this practice.",
      "I need one evidence takeaway that connects directly to a care choice in clinic.",
    ],
    time: [
      "I have about a minute, so start with the action that matters most.",
      "Given the schedule, I need the highest-yield next step, not the whole story.",
      "Keep this to one immediate step we could start today without another meeting.",
      "If there is a quick change that helps this week, start there.",
      "I need one concise action item we could execute between patients.",
    ],
    policy: [
      "I need this to fit the protocol we actually use. What is one step we could implement quickly?",
      "Show me the pathway-compatible adjustment, not a broad recommendation.",
      "I need one protocol-compatible move we could realistically use this month.",
      "Give me one concrete recommendation that stays inside our institutional policy.",
      "What is the first compliant step that would still improve workflow?",
    ],
    screening: [
      "I hear the intent, but I still need the screening approach. What is one checkpoint we could apply consistently?",
      "Candidacy is still the question for me. What is one step we could standardize without slowing clinic flow?",
      "Make this practical for our setting: what is the first screening action you would recommend?",
      "I need one clear screening move my staff could apply consistently during a visit.",
      "Start with the candidacy workflow step we could use this week.",
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

  const explicitClosePattern = /\b(i (have|need|must) to (go|leave|head out|jump|run)|i'm (heading out|signing off)|gotta (run|go)|time to go|need to hop off|let's (stop|wrap) here|we should wrap (this )?up|can we (continue|finish) later|let's (pick this up|reconnect) later|we can pick this up (later|another time)|i have (another|my next) patient|i need to get to (my )?next patient|i have an emergency|i need to jump to another room|i need to get back to clinic|i need to get back to patients|this isn'?t productive|this is not productive)\b/i;
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
  const closurePattern = /\b(conversation is ending|exchange is over|continue speaking later|coordinate a follow-up|follow-up slot|front desk|we can continue later|wrap this up|need to move on|i need to get back to clinic|i need to get back to patients|i need to pause here|i'm going to pause us here|let's stop here|stop here for now|this isn'?t productive|this is not productive|take care|patients waiting)\b/;
  const asksNewQuestion = sample.includes("?");
  return closurePattern.test(sample) && !asksNewQuestion;
}

function isTerminalDisengagementIntent(text = "") {
  return hasExplicitExitIntent(text) || isTerminalClosureDialogue(text);
}

function hasTerminalClosedTurn(turns = []) {
  return (Array.isArray(turns) ? turns : []).some((turn) => (
    turn?.hcpDialogueBefore
    && isTerminalClosureDialogue(turn.hcpDialogueBefore)
  ));
}

function isTerminalDisengagementCue(text = "") {
  const sample = String(text || "").toLowerCase().trim();
  if (!sample) return false;
  return /\b(exchange is over|reaches for the door|door handle|turns back toward the patient room|stands and checks|conversation is ending|gestures? .* exit|signals? .* ending|readying for departure|leaving the room)\b/.test(sample);
}

function inferLatestAskFamilyForProgression(text = "") {
  const sample = String(text || "").toLowerCase();
  if (!sample) return null;
  if (/\b(evidence|data|study|trial|proof|endpoint|outcome|clinically meaningful|practice|decision)\b/.test(sample)) return "evidence";
  if (/\b(screen|screening|candidacy|candidate|eligible|eligibility|patient selection|criteria|resistance|adherence)\b/.test(sample)) return "screening";
  if (/\b(access|coverage|payer|prior[-\s]?auth|authorization|approval|reimbursement|copay|hub|enrollment|bottleneck)\b/.test(sample)) return "access";
  if (/\b(workflow|staff|team|owner|own|handoff|process|practical step|clinic flow|implementation)\b/.test(sample)) return "workflow";
  return null;
}

function collectRepMessagesForSimilarLatestAsk(turns = [], latestHcpAsk = "") {
  const ask = String(latestHcpAsk || "").trim();
  if (!ask) return [];
  const latestFamily = inferLatestAskFamilyForProgression(ask);
  const messages = [];
  const priorTurns = Array.isArray(turns) ? turns.slice(0, -1) : [];

  for (let i = priorTurns.length - 1; i >= 0; i -= 1) {
    const turn = priorTurns[i];
    const priorAsk = String(turn?.hcpDialogueBefore || "").trim();
    const rep = String(turn?.repMessage || "").trim();
    if (!priorAsk || !rep) continue;
    const priorFamily = inferLatestAskFamilyForProgression(priorAsk);
    const similarAsk = priorAsk === ask || computeSimilarity(priorAsk, ask) >= 0.78;
    const sameAskFamily = latestFamily && priorFamily && latestFamily === priorFamily;
    if (!similarAsk && !sameAskFamily) {
      if (messages.length > 0) break;
      continue;
    }
    messages.unshift(rep);
  }

  return messages;
}

function collectRecentRepMessages(turns = [], limit = 5) {
  return (Array.isArray(turns) ? turns.slice(0, -1) : [])
    .map((turn) => String(turn?.repMessage || "").trim())
    .filter(Boolean)
    .slice(-limit);
}

function collectRecentHcpAsksForValidation(turns = [], limit = 5) {
  return (Array.isArray(turns) ? turns.slice(0, -1) : [])
    .map((turn) => String(turn?.hcpDialogueBefore || "").trim())
    .filter(Boolean)
    .slice(-limit);
}

function stripFollowUpAfterTerminalClose(text = "") {
  const value = hardenTextSurface(text);
  if (!isTerminalDisengagementIntent(value)) return value;
  const parts = value.match(/[^.!?]+[.!?]/g) || [value];
  const firstTerminal = parts.find((part) => isTerminalDisengagementIntent(part)) || parts[0];
  return hardenTextSurface(firstTerminal);
}

function stripSimulatorMetaDialogue(text = "") {
  let value = hardenTextSurface(text);
  if (!value) return value;

  value = value
    .replace(/\b(?:to get back on track|to refocus|as i said earlier|as i asked earlier|as mentioned earlier|as previously stated),?\s*/gi, "")
    .replace(/\b(?:i(?:'d| would) like to )?revisit (?:my|the|that)?\s*previous question (?:about|on)?\s*/gi, "")
    .replace(/\b(?:my|the|that) previous question (?:was|is|about|on)\s*/gi, "")
    .replace(/\b(?:given|considering) our current ([^.?!]+)\.\s+(?=(?:can|how|what|who|where|when|is|are|does|do|would|could)\b)/gi, "Given our current $1, ");

  return hardenTextSurface(value);
}

const NARRATED_HCP_SURFACE_PATTERNS = [
  /^\s*the hcp\b/i,
  /^\s*(keeps|looks|glances|leans|checks|turns|steps|stands|pauses|nods|scans|reviews|shifts|gestures|rereads|folds|gathers|taps|closes)\b/i,
  /\blooks back\b/i,
  /\bglances at\b/i,
  /\bkeeps the\b/i,
  /\bposture\b/i,
  /\bexpression\b/i,
  /\bwith very little space\b/i,
  /\bunder one hand\b/i,
  /\beyes narrowing\b/i,
  /\battention tightening\b/i,
  /\bbody language\b/i,
];

function looksLikeNarratedHcpSurface(text = "") {
  const value = String(text || "").trim();
  if (!value) return false;
  return NARRATED_HCP_SURFACE_PATTERNS.some((pattern) => pattern.test(value));
}

function buildNaturalHcpRepairLine({
  text = "",
  concern = "workflow",
  repMessage = "",
  activeAsk = "",
  hcpState = "",
  timePressure = false,
} = {}) {
  const rep = String(repMessage || "").trim();
  const repLower = rep.toLowerCase();
  const ask = hardenTextSurface(String(activeAsk || "").trim());
  const concernKey = String(concern || "workflow").toLowerCase();
  const pressured = Boolean(timePressure) || /\b(time|disengaged|irritated|boundary|resistant)\b/i.test(String(hcpState || ""));

  if (/^(hi|hello|hey)\b/.test(repLower) || /\bhow are you\b|\bcan we speak\b|\bdo you have a minute\b/.test(repLower)) {
    return pressured ? "I'm fine. What's your question?" : "Doing well. What did you want to discuss?";
  }

  if (ask && !looksLikeNarratedHcpSurface(ask) && /\?/.test(ask)) {
    return enforceNaturalStandaloneUtterance(ask, concernKey);
  }

  if (concernKey === "safety") {
    return /\bhepatic|liver\b/.test(repLower)
      ? "What have you seen on the hepatic signal in your own data?"
      : "What have you seen on the safety side in your own data?";
  }

  if (concernKey === "evidence") {
    if (/\bmortality\b/.test(repLower)) return "Mortality in which patients, exactly?";
    if (/\bendpoint|data|study|trial\b/.test(repLower)) return "What data are you referring to exactly?";
    return pressured ? "Be specific. What data changes my decision?" : "What data changes a treatment decision for me?";
  }

  if (concernKey === "access") {
    return pressured
      ? "If this still needs prior auth, what changes for my staff?"
      : "What changes on access or prior auth for my team?";
  }

  if (concernKey === "time") {
    return "Keep it brief. What's the point?";
  }

  if (concernKey === "workflow") {
    return pressured
      ? "What's the first practical step?"
      : "What changes in workflow for the clinic?";
  }

  return pressured ? "Be specific. What's your point?" : "What are you asking me to do differently?";
}

function buildLiveTurnAuthorityDialogue({
  repMessage = "",
  previousHcpLine = "",
  activeConcern = "workflow",
  isFirstRepTurn = false,
  repAskedWellbeing = false,
  inPleasantryGracePeriod = false,
} = {}) {
  const rep = String(repMessage || "").trim();
  const repLower = rep.toLowerCase();
  const previous = hardenTextSurface(String(previousHcpLine || "").trim());
  const hasBusinessPayload = /\b(study|trial|data|publication|results|signal|hepatic|safety|patient|patients|tolerat|therapy|treatment|access|coverage|prior auth|workflow|staff|screening|evidence)\b/.test(repLower);
  const extractClarificationTopic = () => {
    const lower = previous.toLowerCase();
    const directMatch = lower.match(/\b(hepatic signal|safety signal|access barrier|prior auth|workflow issue|workflow burden|screening checkpoint|patient selection|evidence point|monitoring plan)\b/);
    if (directMatch?.[1]) return directMatch[1];
    if (/\bhepatic\b/.test(lower)) return "hepatic signal";
    if (/\bsafety\b/.test(lower)) return "safety signal";
    if (/\bprior auth|access|coverage\b/.test(lower)) return "access barrier";
    if (/\bworkflow|staff|handoff|process\b/.test(lower)) return "workflow issue";
    if (/\bscreen|criteria|candidate|selection\b/.test(lower)) return "patient-selection issue";
    if (/\bstudy|trial|data|evidence|endpoint\b/.test(lower)) return "evidence concern";
    return "";
  };

  if (isFirstRepTurn && (inPleasantryGracePeriod || /^(hi|hello|hey)\b/.test(repLower))) {
    if (hasBusinessPayload) {
      if (/\bhepatic|safety|signal\b/.test(repLower)) {
        return "All right. What have you seen on that safety signal?";
      }
      if (/\btolerat|can't stay on therapy|cannot stay on therapy|stopped treatment|treatment option\b/.test(repLower)) {
        return "All right. What part of tolerability is driving the issue?";
      }
      if (/\bstudy|trial|publication|results|data|cdc\b/.test(repLower)) {
        return "All right. What about the study do you want to discuss?";
      }
      if (/\baccess|coverage|prior auth\b/.test(repLower)) {
        return "All right. What access issue are you trying to solve?";
      }
      if (/\bworkflow|staff|screening\b/.test(repLower)) {
        return "All right. What's the practical issue you're seeing?";
      }
      return "All right. What's the issue you're seeing?";
    }
    if (repAskedWellbeing || /\bhow are you\b|\bhow's it going\b|\bhow have you been\b/.test(repLower)) {
      return /(?:study|trial|data|publication|results)\b/.test(repLower)
        ? "I'm doing well, thanks. What did you want to discuss about the study?"
        : "I'm doing well, thanks. What did you want to discuss?";
    }
    return "Hi. What did you want to discuss?";
  }

  if (/\b(what question|which question|what do you mean|can you clarify|clarify|rephrase|not following|don't understand|do not understand)\b/.test(repLower)) {
    const topic = extractClarificationTopic();
    if (previous) {
      const questionOnly = previous.split(/(?<=[?!])\s+/)[0].trim();
      const cleaned = questionOnly.replace(/[.?!]+$/, "").trim();
      if (cleaned) {
        if (topic) {
          return `I'm asking about ${topic} and why it matters for the patients I treat.`;
        }
        if (/^(what|how|why|who|when|where|which)\b/i.test(cleaned)) {
          return `I'm asking ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}.`;
        }
        return `I'm asking about ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}.`;
      }
    }
    return buildScenarioFactSafeClarification({
      previousHcpLine: previous,
      activeConcern,
    });
  }

  if (/\b(what exactly|what specifically|more context|provide more context|help me understand|i want to understand|so i can understand|tailor my approach)\b/.test(repLower)) {
    const topic = extractClarificationTopic();
    if (topic === "hepatic signal") {
      return "I'm talking about a hepatic signal that came up in a case discussion, and I need to know how you'd think about that risk in real patients.";
    }
    if (topic) {
      return `I'm talking about ${topic}, and whether it changes what I should do for my patients.`;
    }
    return buildScenarioFactSafeClarification({
      previousHcpLine: previous,
      activeConcern,
    });
  }

  return "";
}

function shouldBypassLatestAskAuthority({
  repMessage = "",
  latestAskProgression = {},
  isFirstRepTurn = false,
  inPleasantryGracePeriod = false,
  repClarificationRequest = false,
} = {}) {
  const status = String(latestAskProgression?.status || "");
  if (repClarificationRequest) return true;
  if (status === "clarification_request" || status === "social_opening") return true;
  if (isFirstRepTurn && inPleasantryGracePeriod) return true;
  const rep = String(repMessage || "").trim().toLowerCase();
  return isFirstRepTurn && /^(hi|hello|hey)\b/.test(rep);
}

function enforceSpokenOnlyHcpDialogue({
  text = "",
  concern = "workflow",
  repMessage = "",
  activeAsk = "",
  hcpState = "",
  timePressure = false,
} = {}) {
  const value = stripFollowUpAfterTerminalClose(stripSimulatorMetaDialogue(text));
  if (!value) {
    return buildNaturalHcpRepairLine({ text, concern, repMessage, activeAsk, hcpState, timePressure });
  }

  if (!looksLikeNarratedHcpSurface(value)) {
    return value;
  }

  return buildNaturalHcpRepairLine({ text: value, concern, repMessage, activeAsk, hcpState, timePressure });
}

function isRepeatedFinalDialogue(candidate = "", recentDialogues = []) {
  const normalizedCandidate = normalizeDialogueSignature(candidate);
  if (!normalizedCandidate) return false;
  return (Array.isArray(recentDialogues) ? recentDialogues : []).some((prior) => {
    const normalizedPrior = normalizeDialogueSignature(prior);
    if (!normalizedPrior) return false;
    return normalizedPrior === normalizedCandidate
      || calculateTokenOverlapRatio(candidate, prior) >= 0.82
      || calculateSemanticSimilarity(candidate, prior) >= 0.78;
  });
}

function isRepEchoInHcpDialogue({ dialogue = "", repMessage = "" } = {}) {
  const normalizedHcp = normalizeDialogueSignature(dialogue);
  const normalizedRep = normalizeDialogueSignature(repMessage);
  if (!normalizedHcp || !normalizedRep) return false;

  const repTokens = normalizedRep.split(/\s+/).filter(Boolean);
  const echoWindow = repTokens.slice(0, Math.min(repTokens.length, 14)).join(" ");
  return (normalizedRep.length >= 40 && normalizedHcp.includes(normalizedRep))
    || (echoWindow.split(/\s+/).length >= 8 && normalizedHcp.includes(echoWindow))
    || (calculateTokenOverlapRatio(normalizedHcp, normalizedRep) >= 0.86 && normalizedHcp.length >= 40);
}

function isEvidenceSeekingEngagement(text = "") {
  const sample = String(text || "").toLowerCase();
  if (!sample.trim()) return false;

  const evidenceIntent = /\b(evidence|proof|data|study|trial|endpoint|clinically meaningful|relevance|relevant)\b/.test(sample);
  const applicabilityIntent = /\b(applicable|applies|practice|current patients|patient selection|patient-level|for my patients|for our clinic|in this setting)\b/.test(sample);
  const specificityIntent = /\b(clearest|specific|concrete|exact|which|what is|show me|give me|how)\b/.test(sample);
  const patientContextIntent = /\b(patient|patients|practice|clinic|setting)\b/.test(sample);
  const askIntent = /\?|\b(show|give|explain|prove|what|which|how)\b/.test(sample);

  return askIntent && (
    (evidenceIntent && (applicabilityIntent || specificityIntent || patientContextIntent))
    || (applicabilityIntent && specificityIntent && patientContextIntent)
  );
}

function hasMaterialConstraintProgression(previousText = "", currentText = "") {
  const previous = String(previousText || "");
  const current = String(currentText || "");
  if (!previous.trim() || !current.trim()) return false;

  const currentEngagedEvidence = isEvidenceSeekingEngagement(current);
  if (!currentEngagedEvidence) return false;

  const evidenceSpecificityScore = (text = "") => {
    const value = String(text || "").toLowerCase();
    if (!value.trim()) return 0;
    let score = 0;
    if (/\b(evidence|data|study|trial|endpoint|proof)\b/.test(value)) score += 1;
    if (/\b(clearest|specific|concrete|exact|proof point|clinically meaningful)\b/.test(value)) score += 1;
    if (/\b(patient|patients|patient-level|patient selection|current patients|practice|clinic|setting)\b/.test(value)) score += 1;
    if (/\b(this month|this week|current|right now|today)\b/.test(value)) score += 1;
    return score;
  };

  const previousScore = evidenceSpecificityScore(previous);
  const currentScore = evidenceSpecificityScore(current);
  const similarity = computeSimilarity(previous, current);
  const currentTokens = extractContinuityTokens(current);
  const previousTokens = new Set(extractContinuityTokens(previous));
  const newlyAddedTokens = currentTokens.filter((token) => !previousTokens.has(token));

  return currentScore > previousScore || similarity < 0.86 || newlyAddedTokens.length >= 2;
}

function hasWorkflowOperationalLanguage(text = "") {
  return /\b(prior auth|prior authorization|approval|approvals|paperwork|workflow|resubmission|resubmissions|bottleneck|back-and-forth|back and forth|staff burden|clinic flow|implementation|implement|standardi[sz]e|training|education|monitoring|toxicity monitoring|call-?tree|one-?pager|pathway handouts?|feasibility|team load|epa|front desk|check-?in|order[\s-]?set|routing rule|staffing model|nurse script|ma submit|ma routing|queue|huddle script|checklist|protocol|template|standing order)\b/i.test(String(text || ""));
}

function hasEvidencePivotLanguage(text = "") {
  return /\b(jama|study|trial|data|outcomes|efficacy|disease progression|adoption|publication|findings)\b/i.test(String(text || ""));
}

const SCENARIO_FAMILY_LEXICAL_PACKS = Object.freeze({
  hiv_prep: [
    "prep", "prior auth", "coverage", "adherence", "screening", "resistance", "back-and-forth", "resubmission",
  ],
  oncology_access: [
    "regimen", "line of therapy", "biomarker", "pathway", "prior auth", "reimbursement", "denial", "infusion", "education", "toxicity", "call-tree", "one-pager", "monitoring",
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
  hardDemandState = {},
} = {}) {
  const hardDemandPriorityLock = Boolean(hardDemandState?.hardDemandPriorityLock);
  const hardDemandUnresolved = Boolean(hardDemandState?.hardDemandUnresolved);
  const activeHardDemand = hardDemandState?.activeHardDemand || null;
  const hardDemandType = hardDemandState?.hardDemandType || null;

  const hasActiveConstraint = (Array.isArray(activeConstraints) && activeConstraints.length > 0)
    || (Array.isArray(activeOperationalConstraints) && activeOperationalConstraints.length > 0);
  const primaryConstraint = hasActiveConstraint ? activeConstraints[0] : "none";
  const directOperationalQuestion = hasActiveConstraint && isDirectUserQuestion(latestUserTurn);

  if (hardDemandPriorityLock && hardDemandUnresolved) {
    return {
      selectedObjective: `continue_hard_demand_lock[${activeHardDemand || "constraint"}]`,
      primaryConstraint: activeHardDemand || primaryConstraint,
      hasActiveConstraint: true,
      directOperationalQuestion,
      selectedObjectiveAccountsForConstraint: true,
      precedenceOrder: [
        "active_unresolved_hard_demand",
        "disengagement_terminal_safety",
        "materially_stronger_new_blocker",
        "ordinary_concern_progression",
      ],
      hardDemandType,
      hardDemandPriorityLock: true,
      hardDemandUnresolved: true,
      rankedObjectives: [
        { id: "continue_hard_demand_lock", score: 1000, referencesConstraint: true },
      ],
    };
  }

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
    precedenceOrder: [
      "active_unresolved_hard_demand",
      "disengagement_terminal_safety",
      "materially_stronger_new_blocker",
      "ordinary_concern_progression",
    ],
    hardDemandType: hardDemandType || null,
    hardDemandPriorityLock,
    hardDemandUnresolved,
    rankedObjectives: candidates.map(({ id, score, referencesConstraint }) => ({ id, score, referencesConstraint })),
  };
}

function buildOperationalReanchorDialogue({ mode = "missed", unresolvedConcernTurns = 0, activeConcern = "workflow" } = {}) {
  const concern = String(activeConcern || "workflow").toLowerCase();
  const concernLabel = concern === "access"
    ? "access step"
    : concern === "time"
      ? "time-limited next step"
      : "workflow step";

  if (mode === "aligned") {
    return unresolvedConcernTurns >= 2
      ? `That could help, as long as it makes the ${concernLabel} easier to execute without adding work.`
      : `That sounds relevant, but it depends on whether the ${concernLabel} is realistic for this setting.`
  }

  if (mode === "overpivot") {
    return unresolvedConcernTurns >= 2
      ? `I understand the outcomes point, but I still need the specific ${concernLabel} that changes what happens next.`
      : `I get the data, but I need the next step tied to the ${concernLabel} in front of us.`
  }

  return unresolvedConcernTurns >= 2
    ? `I understand, but the current ${concernLabel} is still unresolved. Make the next step specific to this scenario.`
    : `Tie this to the specific ${concernLabel} in front of us before we move on.`;
}

function detectConcernAddressed(repMessage = "", concern = "workflow") {
  const concernPattern = REALISM_CONCERN_PATTERNS[concern] || REALISM_CONCERN_PATTERNS.workflow;
  return concernPattern.test(String(repMessage || ""));
}

function hasScenarioAlignedScreeningPlan(repMessage = "") {
  const value = String(repMessage || "").toLowerCase();
  if (!value.trim()) return false;
  const hasCandidacy = /\b(candidacy|candidate|eligib|screen|screening|criteria|qualification|qualify)\b/.test(value);
  const hasDurability = /\b(durability|durable|resistance|adherence|monitoring|missed-dose|missed dose|regimen)\b/.test(value);
  const hasPlanVerb = /\b(align|protect|standardi[sz]e|confirm|criteria|protocol|framework|checklist|review|screen)\b/.test(value);
  return hasPlanVerb && (hasCandidacy || hasDurability);
}

function hasConcreteOperationalMove(repMessage = "") {
  return /\b(step|plan|process|workflow|handoff|assign|pilot|start with|first action|specific|implement|standardi[sz]e|train|training|education|monitoring|call-?tree|one-?pager|pathway|protocol|checklist|template|standing order|change for your team|for your staff)\b/i.test(String(repMessage || ""));
}

function hasImplementationMove(repMessage = "") {
  return /\b(standardi[sz]e|implement|roll out|rollout|pilot|start|add|use|train|training|education|monitoring|toxicity monitoring|call-?tree|one-?pager|pathway handout|pathway|protocol|checklist|template|handoff)\b/i.test(String(repMessage || ""));
}

function hasVagueOperationalOwner(repMessage = "") {
  const value = String(repMessage || "").toLowerCase();
  if (!value.trim()) return false;
  return /\b(someone|somebody)\s+(on|from)?\s*(your|the|my)?\s*(staff|team)\b/.test(value)
    || /\b(staff|team)\s+(would|can|could|should)?\s*(own|handle|run|manage|implement|do)\b/.test(value);
}

function hasExplicitOperationalOwner(repMessage = "") {
  const value = String(repMessage || "").toLowerCase();
  if (!value.trim()) return false;
  return /\b(np|nurse|nursing|ma|medical assistant|pharmacist|pharmacy tech|care coordinator|case manager|hub coordinator|front desk|scheduler|provider|physician|clinician|app|advanced practice provider)\b/.test(value)
    && /\b(own|lead|run|handle|manage|start|implement|standardi[sz]e|education|monitoring|call-?tree|checklist|protocol|handoff)\b/.test(value);
}

function buildWorkflowProgressionFollowUp(repMessage = "") {
  if (!hasConcreteOperationalMove(repMessage) && !hasImplementationMove(repMessage)) return "";

  if (hasVagueOperationalOwner(repMessage)) {
    return "That gives me a direction, but 'someone on my staff' is too vague. Which role owns the first step?";
  }

  if (hasExplicitOperationalOwner(repMessage)) {
    return "That is more useful. What is the first handoff they would own this week?";
  }

  return "That is closer. Who owns the first step, and what changes in the workflow this week?";
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
  const scenarioScreeningPlanAddressed = hasScenarioAlignedScreeningPlan(repLower);
  const concernAddressed = detectConcernAddressed(repLower, activeConcern)
    || (["screening", "workflow", "policy"].includes(activeConcern) && scenarioScreeningPlanAddressed);
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

  const strongRecovery = concernAddressed && (hasConcreteOperationalMove(repLower) || scenarioScreeningPlanAddressed || reusedHcpLanguage || contextHits > 0);
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

  const needsRedirect = !engagement.concernAddressed && (tier === "impatient" || tier === "disengaging");
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
    calculateTokenOverlapRatio(safeCue, priorCue) >= 0.62
    || calculateSemanticSimilarity(safeCue, priorCue) >= 0.66
  );
  if (!isTooSimilar) return safeCue;

  const cueFallbackPool = [
    "The HCP keeps the exchange brief and waits for the practical detail.",
    "The HCP looks back to the chart, then returns to the implementation question.",
    "The HCP pauses for a beat, leaving room for one concrete answer.",
    "The HCP stays focused on the handoff step and waits for a realistic next action.",
    "The HCP gives a short nod, listening for feasibility rather than broad framing.",
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
  const includeAsk = false;
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

function deriveHcpDisplayName({ stakeholder, hcp, hcpCategory, canonicalHcpDisplayName }) {
  const source = String(canonicalHcpDisplayName || stakeholder || hcp || "").trim();
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

function deterministicBoolean(seedText, threshold = 0.5) {
  const bounded = Math.max(0, Math.min(1, Number(threshold) || 0));
  const scale = 1000;
  return deterministicIndex(`${seedText}:bool`, scale) < Math.floor(bounded * scale);
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
  const baselineAlignedGuidance = getBaselineAlignedInlineGuidance({ turn, alignment });
  if (baselineAlignedGuidance) return baselineAlignedGuidance;

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
  // Voice session state
  const {
    voiceSessionActive,
    voiceSessionEnded,
    startVoiceSession,
    endVoiceSession,
  } = useVoiceSessionControl();

  // Handler to allow only rep to end the voice session
  const handleEndVoiceSession = () => {
    // Add rep authentication/role check if needed
    endVoiceSession(true);
  };
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
  // Stable, non-random session seed for deterministic cue selection.
  const scenarioSeed = String(scenario?.id || scenario?.title || "scenario")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "scenario";
  const sessionIdRef = useRef(`session_${scenarioSeed}_${Date.now()}`);
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
  const lastSafeDialogueRef = useRef("I need one practical next step that fits our current workflow.");
  const lastValidConstraintsRef = useRef([]);
  const lateTurnConstraintStateRef = useRef({
    activeConstraint: null,
    activeRequirement: null,
    boundaryLevel: "normal",
    requirementRestatedCount: 0,
  });
  const hcpConstraintEngineRef = useRef({
    activeConstraints: [],
  });
  const interventionStateRef = useRef(createInitialInterventionSessionState());
  const runtimeScenarioContractRef = useRef(validateScenarioRuntimeContract(scenario).contract);
  const demandHoldHistoryRef = useRef({
    demandType: null,
    line: "",
  });
  const hardDemandPriorityRef = useRef(createInitialHardDemandPriorityState());
  const canonicalHcpIdentityRef = useRef(resolveCanonicalHcpIdentity(scenario));

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
  const descriptionText = scenario.hcp || scenario.description || scenario.visibleScenarioContext || "";
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
    context: scenario.visibleScenarioContext || scenario.description || "",
    hcpCategory: scenario.hcp_category,
    hcp: scenario.hcp,
  });
  const canonicalHcpIdentity = canonicalHcpIdentityRef.current;
  const hcpDisplayName = deriveHcpDisplayName({
    stakeholder: scenario.stakeholder,
    hcp: scenario.hcp,
    hcpCategory: scenario.hcp_category,
    canonicalHcpDisplayName: canonicalHcpIdentity.canonicalHcpDisplayName,
  });
  const difficultyVisual = getDifficultyVisuals(scenario.difficulty);
  const showScenarioContext = Boolean(descriptionText || openingScene || objectiveText || challengeItems.length > 0);
  const showOpeningSceneFallback = !openingScene && Boolean(objectiveText);
  const showScenarioSupportFallback = challengeItems.length === 0 && !openingScene && !objectiveText;
  const scenarioKeywords = extractScenarioKeywords(scenario);
  const conversationTerminalClosed = hasTerminalClosedTurn(turns)
    || sessionControllerRef.current.state === SessionState.ENDED;

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
    runtimeScenarioContractRef.current = validateScenarioRuntimeContract(scenario).contract;
    canonicalHcpIdentityRef.current = resolveCanonicalHcpIdentity(scenario);
    recentDialoguePhrasesRef.current = [];
    recentCueHistoryRef.current = [];
    lastSafeDialogueRef.current = "I need one practical next step that fits our current workflow.";
    lastSubmittedTurnKeyRef.current = "";
    loggedTurnKeysRef.current = new Set();
    processedTurnKeysRef.current = new Set();
    controller.state = SessionState.ACTIVE;
    controller.isActive = true;
    controller.isProcessingTurn = false;
    controller.pendingResponseQueue = [];
    const init = async () => {
      setIsLoading(true);
      try {
        const runtimeScenario = buildRuntimeScenarioView(scenario, runtimeScenarioContractRef.current);
        const initialState = resolveScenarioOpeningState(scenario, runtimeScenarioContractRef.current)
          || deriveInitialState(runtimeScenario);
        const initialTemp = deriveInitialTemperature(initialState);
        simStateRef.current = { temperature: initialTemp, severity: 0 };
        repInferenceStateRef.current = createInitialRepInferenceState();
        lateTurnConstraintStateRef.current = {
          activeConstraint: null,
          activeRequirement: null,
          boundaryLevel: "normal",
          requirementRestatedCount: 0,
        };
        hcpConstraintEngineRef.current = {
          activeConstraints: [],
        };
        interventionStateRef.current = createInitialInterventionSessionState();
        demandHoldHistoryRef.current = {
          demandType: null,
          line: "",
        };
        hardDemandPriorityRef.current = createInitialHardDemandPriorityState();

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
    if (hasTerminalClosedTurn(turns)) {
      controller.state = SessionState.ENDED;
      controller.pendingResponseQueue = [];
      return;
    }
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
    const isFirstRepTurn = respondingToTurn.turnNumber === 0 && !respondingToTurn?.hcpDialogueBefore;
    const openingTurnForValidation = isFirstRepTurn ? extractScenarioOwnedOpeningTurn(scenario) : null;
    const scenarioExecutionContract = buildRoleplayScenarioExecutionContract(scenario);
    const firstTurnConcernSourceText = [
      openingTurnForValidation?.cueText || "",
      openingTurnForValidation?.dialogueText || "",
      scenario?.title || "",
      scenario?.description || "",
      scenario?.visibleScenarioContext || "",
      scenario?.objective || "",
      Array.isArray(scenario?.challenges) ? scenario.challenges.join(" ") : String(scenario?.challenges || ""),
    ].join(" ");
    const firstTurnActiveAskState = isFirstRepTurn
      ? {
        source: scenarioExecutionContract?.activeAsk?.source || "fallback_concern",
        askText: scenarioExecutionContract?.activeAsk?.askText || resolveActiveHcpAskState({
          narrativeContext: openingTurnForValidation?.cueText || "",
          openingContext: openingTurnForValidation?.dialogueText || "",
          fallbackConcern: detectPrimaryConcern(firstTurnConcernSourceText),
        })?.askText || "",
        concernFamily: scenarioExecutionContract?.activeAsk?.concernFamily || detectPrimaryConcern(firstTurnConcernSourceText),
        frozen: false,
      }
      : null;
    const firstTurnOpeningContext = firstTurnActiveAskState?.askText || "";
    const previousRepMessagesForValidation = collectRepMessagesForSimilarLatestAsk(turns, respondingToTurn?.hcpDialogueBefore || "");
    const allPreviousRepMessagesForValidation = collectRecentRepMessages(turns);
    const previousHcpAsksForValidation = collectRecentHcpAsksForValidation(turns);
    const preTurnValidation = validateRoleplayRepTurn({
      latestHcpAsk: respondingToTurn?.hcpDialogueBefore || "",
      firstTurnOpeningContext,
      repMessage,
      previousRepMessages: previousRepMessagesForValidation,
      allPreviousRepMessages: allPreviousRepMessagesForValidation,
      previousHcpAsks: previousHcpAsksForValidation,
    });
    const roleplayTurnValidationContext = {
      latestHcpAsk: respondingToTurn?.hcpDialogueBefore || "",
      firstTurnOpeningContext,
      repMessage,
      previousRepMessages: previousRepMessagesForValidation,
      allPreviousRepMessages: allPreviousRepMessagesForValidation,
      previousHcpAsks: previousHcpAsksForValidation,
      scenarioId: scenario?.id || scenario?.scenarioId || scenario?.title || null,
      turnNumber: respondingToTurn.turnNumber,
      activeHcpAskState: firstTurnActiveAskState || null,
      scenarioExecutionContract: scenarioExecutionContract
        ? {
          contractVersion: scenarioExecutionContract.contractVersion,
          scenarioIdentity: scenarioExecutionContract.scenarioIdentity,
          hcpPersona: scenarioExecutionContract.hcpPersona,
          activeAsk: scenarioExecutionContract.activeAsk,
          openingState: scenarioExecutionContract.openingState,
          constraints: scenarioExecutionContract.constraints,
          stateMachine: scenarioExecutionContract.stateMachine,
          managerIntegration: scenarioExecutionContract.managerIntegration,
        }
        : null,
    };
    const conversationActiveAskState = firstTurnActiveAskState || {
      source: respondingToTurn?.hcpDialogueBefore ? "explicit_live_hcp_dialogue" : "fallback_concern",
      askText: respondingToTurn?.hcpDialogueBefore || scenarioExecutionContract?.activeAsk?.askText || "",
      concernFamily: preTurnValidation?.latestAskProgression?.family || scenarioExecutionContract?.activeAsk?.concernFamily || "general",
      strength: scenarioExecutionContract?.activeAsk?.strength || null,
      answerStatus: preTurnValidation?.latestAskProgression?.status || "unanswered",
      frozen: false,
    };
    const conversationIntelligenceState = deriveConversationIntelligenceState({
      scenarioExecutionContract,
      activeHcpAskState: conversationActiveAskState,
      latestHcpAsk: respondingToTurn?.hcpDialogueBefore || firstTurnOpeningContext || "",
      repMessage,
      validationOutput: preTurnValidation,
      recentTurnHistory: turns.slice(-5),
      turnNumber: respondingToTurn.turnNumber,
    });
    if (preTurnValidation.invalid) {
      recordTurnValidationTelemetry(preTurnValidation, {
        entryPoint: "RolePlayChat",
        sessionId: sid,
        scenarioId: scenario?.id || scenario?.scenarioId || scenario?.title || null,
        turnNumber: respondingToTurn.turnNumber,
      });
      recordConversationIntelligenceTelemetry(conversationIntelligenceState, {
        entryPoint: "RolePlayChat",
        sessionId: sid,
        scenarioId: scenario?.id || scenario?.scenarioId || scenario?.title || null,
        turnNumber: respondingToTurn.turnNumber,
      });
      setInput(repMessage);
      setCoachingTip(preTurnValidation.coaching || conversationIntelligenceState.coachingMessage);
      setIsLoading(false);
      lastSubmittedTurnKeyRef.current = null;
      emitPlannerTrace("rep_turn_blocked_for_latest_ask", {
        turnNumber: respondingToTurn.turnNumber,
        validation: preTurnValidation,
        conversationIntelligence: conversationIntelligenceState,
      });
      return;
    }
    const generationKey = buildDeterministicGenerationKey({
      sessionId: sid,
      turnNumber: respondingToTurn.turnNumber,
      repMessage,
    });
    if (processedTurnKeysRef.current.has(generationKey)) {
      setIsLoading(false);
      return;
    }
    recordTurnValidationTelemetry(preTurnValidation, {
      entryPoint: "RolePlayChat",
      sessionId: sid,
      scenarioId: scenario?.id || scenario?.scenarioId || scenario?.title || null,
      turnNumber: respondingToTurn.turnNumber,
    });
    recordConversationIntelligenceTelemetry(conversationIntelligenceState, {
      entryPoint: "RolePlayChat",
      sessionId: sid,
      scenarioId: scenario?.id || scenario?.scenarioId || scenario?.title || null,
      turnNumber: respondingToTurn.turnNumber,
    });
    if (preTurnValidation.coaching?.shouldShow) {
      setCoachingTip(preTurnValidation.coaching);
    } else if (conversationIntelligenceState.coachingMessage?.shouldShow && preTurnValidation.softInvalid) {
      setCoachingTip(conversationIntelligenceState.coachingMessage);
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
    const wellbeingCheckSignals = /\b(how are you|how's it going|hows it going|how have you been|how was your weekend|hope you're well|hope you are well)\b/;
    const businessSignals = /\b(prep|hiv|sti|cab|cabotegravir|injectable|screening|resistance|adherence|study|trial|data|results|efficacy|durability|monitoring|protocol|materials?|brochure|resource|patients?)\b/;
    const isPleasantryOnly = greetingSignals.test(repLower) && !businessSignals.test(repLower);
    const inPleasantryGracePeriod = isPleasantryOnly && priorRepTurnsCount < 2;
    const repAskedWellbeing = wellbeingCheckSignals.test(repLower);

    const visibleReactionContract = respondingToTurn?.hcpReactionContract || {};
    const scoringCueContext = visibleReactionContract?.selectedCueText || respondingToTurn?.cueBefore || "";
    const scoringDialogueContext = visibleReactionContract?.selectedDialogueText || respondingToTurn?.hcpDialogueBefore || "";
    const scoringContextInput = {
      cueText: scoringCueContext,
      hcpUtterance: scoringDialogueContext,
      selectedDialogueRegister: visibleReactionContract?.selectedDialogueRegister || "unknown",
      selectedDialogueIntent: visibleReactionContract?.selectedDialogueIntent || "unknown",
      selectedCueMeaning: visibleReactionContract?.selectedCueMeaning || "unknown",
      reactionContractHash: visibleReactionContract?.reactionContractHash || null,
    };
    if (
      visibleReactionContract?.reactionContractHash
      && (
        String(respondingToTurn?.cueBefore || "").trim() !== String(scoringCueContext || "").trim()
        || String(respondingToTurn?.hcpDialogueBefore || "").trim() !== String(scoringDialogueContext || "").trim()
      )
      && import.meta.env.DEV
    ) {
      console.warn("ROLEPLAY_SCORING_CONTEXT_DRIFT_GUARD", {
        turnNumber: respondingToTurn?.turnNumber,
        reactionContractHash: visibleReactionContract.reactionContractHash,
      });
    }

    let alignment = computeAlignment(
      prevState,
      repMessage,
      {
        hcpUtterance: scoringDialogueContext,
        cueText: scoringCueContext,
      },
      prevTemp,
      prevHcpState
    );
    alignment = applyMetricApplicabilityGating(
      alignment,
      runtimeScenarioContractRef.current,
      {
        hcpUtterance: scoringDialogueContext,
        repMessage,
        scoringContextInput,
      }
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

    const transitionBound = enforceProhibitedStateTransition({
      fromState: prevState,
      proposedState: nextHcpState,
      runtimeContract: runtimeScenarioContractRef.current,
    });
    if (transitionBound.blocked) {
      nextHcpState = transitionBound.nextState;
      emitPlannerTrace("prohibited_transition_blocked", {
        turnNumber: turns.length,
        fromState: prevState,
        proposedState: transitionBound.nextState,
        reason: transitionBound.reason,
      });
    }

    if (poorTurns >= 3 || (poorTurns >= 2 && alignment?.score <= 2)) {
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
    const concernSourceText = [
      respondingToTurn?.hcpDialogueBefore || "",
      scenario?.title || "",
      scenario?.description || "",
      scenario?.opening_scene || scenario?.openingScene || "",
      scenario?.objective || "",
      Array.isArray(scenario?.challenges) ? scenario.challenges.join(" ") : String(scenario?.challenges || ""),
    ].join(" ");
    const activeConcern = detectPrimaryConcern(concernSourceText);
    const recentUserConstraintCandidates = extractConstraintCandidatesFromTurns(turns, 3);
    const currentUserConstraintCandidates = extractConstraintCandidatesFromText(respondingToTurn?.hcpDialogueBefore || "");
    const repEchoConstraintCandidates = extractConstraintCandidatesFromText(repMessage);
    const rawUserConstraintCandidates = mergeConstraintCandidates([
      ...recentUserConstraintCandidates,
      ...currentUserConstraintCandidates,
      ...repEchoConstraintCandidates,
    ]);
    const scenarioGroundingText = [
      scenario?.title,
      scenario?.description,
      scenario?.opening_scene,
      scenario?.openingScene,
      scenario?.objective,
      Array.isArray(scenario?.challenges) ? scenario.challenges.join(" ") : "",
    ].join(" ");
    const visibleScenarioGroundingText = [
      scenario?.title,
      scenario?.description,
      scenario?.opening_scene,
      scenario?.openingScene,
      scenario?.objective,
      scenario?.hcpMood,
      scenario?.stakeholder,
      scenario?.specialty,
      Array.isArray(scenario?.challenges) ? scenario.challenges.join(" ") : "",
    ].join(" ");
    const hiddenAuthoringContextText = [
      scenario?.context,
      Array.isArray(scenario?.keyMessages) ? scenario.keyMessages.join(" ") : "",
      Array.isArray(scenario?.impact) ? scenario.impact.join(" ") : "",
      Array.isArray(scenario?.suggestedPhrasing) ? scenario.suggestedPhrasing.join(" ") : "",
    ].join(" ");
    const visibleDialogueContextText = [
      visibleScenarioGroundingText,
      ...turns.flatMap((turn) => [turn?.cueBefore || "", turn?.hcpDialogueBefore || "", turn?.repMessage || ""]),
      respondingToTurn?.cueBefore || "",
      respondingToTurn?.hcpDialogueBefore || "",
      repMessage,
    ].join(" ");
    const repClarificationRequest = detectRepClarificationRequest(repMessage);
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
    const rawConstraintValidation = validateConstraintState(
      operationalConstraintState.normalizedActiveConstraints,
      {
        detailed: true,
        previousValid: lastValidConstraintsRef.current,
        recentTurnConstraints: turns.map((turn) => turn?.activeConstraints),
      }
    );
    const constraintValidation = normalizeConstraintValidationResult(rawConstraintValidation);
    const normalizedActiveConstraints = constraintValidation.constraints;
    if (normalizedActiveConstraints.length > 0) {
      lastValidConstraintsRef.current = normalizedActiveConstraints;
    }
    if (import.meta.env.DEV && constraintValidation.issues.length > 0) {
      console.warn("ROLEPLAY_CONSTRAINT_VALIDATION_GUARD", {
        turnNumber: nextTurnNumber,
        issues: constraintValidation.issues,
        inputConstraints: operationalConstraintState.normalizedActiveConstraints,
        resolvedConstraints: normalizedActiveConstraints,
      });
    }
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
    const interventionStateAfterTurn = updateInterventionSessionState(interventionStateRef.current, {
      turnNumber: nextTurnNumber,
      alignmentScore: alignment?.score,
      concernFlowOutcome,
      hcpPrompt: respondingToTurn?.hcpDialogueBefore || "",
      repMessage,
      activeConcern,
      scenarioFamily,
      hasBlockingConstraints: normalizedActiveConstraints.length > 0,
      needsConstraintReanchor: concernFlowOutcome === "missed" || concernFlowOutcome === "overpivot",
    });
    const interventionDecision = interventionStateAfterTurn.lastDecision || "none";
    const unresolvedDemandActive = ENABLE_V2_INTERVENTION_RUNTIME
      && Boolean(interventionStateAfterTurn.activeDemand?.isActive && interventionStateAfterTurn.activeDemand?.type);
    const interventionVisible = ENABLE_V2_INTERVENTION_RUNTIME && interventionDecision !== "none";
    const interventionSnapshot = {
      decision: interventionDecision,
      surfaced: interventionVisible,
      silent: interventionDecision !== "none" && !interventionVisible,
      escalationRisk: interventionStateAfterTurn.escalationRisk,
      repeatedMissedCues: interventionStateAfterTurn.repeatedMissedCues,
      repeatedLowAlignmentEvents: interventionStateAfterTurn.repeatedLowAlignmentEvents,
      cooldownTurnsRemaining: interventionStateAfterTurn.cooldownTurnsRemaining,
      needsConstraintReanchor: interventionStateAfterTurn.needsConstraintReanchor,
      activeDemandType: interventionStateAfterTurn.activeDemand?.type || null,
      activeDemandUnresolvedTurns: interventionStateAfterTurn.activeDemand?.unresolvedTurns || 0,
      demandSatisfied: interventionStateAfterTurn.activeDemand?.demandSatisfied ?? null,
      evasiveResponseDetected: Boolean(interventionStateAfterTurn.activeDemand?.evasiveResponseDetected),
      evidenceCheckpoint: interventionStateAfterTurn.evidenceCheckpoints?.slice(-1)?.[0] || null,
    };
    interventionStateRef.current = {
      ...interventionStateAfterTurn,
      surfacedInterventionCount: interventionStateAfterTurn.surfacedInterventionCount + (interventionVisible ? 1 : 0),
      silentInterventionCount: interventionStateAfterTurn.silentInterventionCount + (interventionSnapshot.silent ? 1 : 0),
    };
    const repHasConcreteMove = hasConcreteOperationalMove(repMessage);
    const repHasFollowUpCommitment = hasSpecificFollowUpCommitment(repMessage);
    const repDefersImmediateAction = isDeferringWithoutImmediateAction(repMessage);
    const terminalDecisionTriggerActive =
      ["impatient", "disengaging"].includes(decayState.tier)
      && unresolvedConcernTurns >= 3
      && ((!repHasConcreteMove && !repHasFollowUpCommitment) || repDefersImmediateAction);
    const continueProbability = 0.65;
    const continueCurrentBehavior = unresolvedDemandActive
      ? true
      : !terminalDecisionTriggerActive
      || deterministicBoolean(`${sid}:${scenario?.id || "scenario"}:${nextTurnNumber}:${activeConcern}:${decayState.tier}`, continueProbability);
    const terminalDecisionMode = !unresolvedDemandActive && terminalDecisionTriggerActive && !continueCurrentBehavior;
    const hardLoopBreaker =
      !unresolvedDemandActive
      && (
      (decayState.tier === "disengaging" || (decayState.tier === "impatient" && repDefersImmediateAction))
      && unresolvedConcernTurns >= 5
      && ((!repHasConcreteMove && !repHasFollowUpCommitment) || repDefersImmediateAction)
      );
    const hardDemandState = updateHardDemandPriorityState(hardDemandPriorityRef.current, {
      activeDemand: interventionStateAfterTurn.activeDemand,
      hcpPrompt: respondingToTurn?.hcpDialogueBefore || "",
      activeConcern,
      turnNumber: nextTurnNumber,
      terminalExit: overrideExit || terminalDecisionMode || hardLoopBreaker,
      materiallyStrongerBlocker: false,
    });
    hardDemandPriorityRef.current = hardDemandState;
    const unresolvedHardDemandLock = Boolean(hardDemandState.hardDemandPriorityLock && hardDemandState.hardDemandUnresolved);
    const bufferedConcernCandidate = getBufferedConcernAfterHardDemandRelease(hardDemandState);
    const effectiveActiveConcern = hardDemandState.hardDemandPriorityLock
      ? (hardDemandState.activeHardDemand || activeConcern)
      : (bufferedConcernCandidate || activeConcern);
    const priorLateTurnConstraintState = lateTurnConstraintStateRef.current || {
      activeConstraint: null,
      activeRequirement: null,
      boundaryLevel: "normal",
      requirementRestatedCount: 0,
    };
    const activeConstraintForTurn =
      normalizedActiveConstraints[0]
      || priorLateTurnConstraintState.activeConstraint
      || activeConcern;
    const activeRequirementForTurn = activeConcern || priorLateTurnConstraintState.activeRequirement || "workflow";
    const priorHcpPrompt = [...turns]
      .reverse()
      .find((turn) => Number(turn?.turnNumber) < Number(respondingToTurn?.turnNumber))
      ?.hcpDialogueBefore || "";
    const engagedEvidenceSeekingRequest = isEvidenceSeekingEngagement(respondingToTurn?.hcpDialogueBefore || "");
    const materiallyProgressedConstraintRequest = hasMaterialConstraintProgression(
      priorHcpPrompt,
      respondingToTurn?.hcpDialogueBefore || ""
    );
    const inLateTurnConstraintState =
      nextTurnNumber >= 4
      || unresolvedConcernTurns >= 2
      || ["impatient", "disengaging"].includes(decayState.tier)
      || terminalDecisionMode
      || hardLoopBreaker;
    const lateTurnConstraintDecision = selectLateTurnConstraintResponseMode({
      hasActiveConstraint: normalizedActiveConstraints.length > 0 || Boolean(priorLateTurnConstraintState.activeConstraint),
      hasActiveRequirement: Boolean(activeRequirementForTurn),
      inLateTurnState: inLateTurnConstraintState,
      requirementAddressed: decayState.concernAddressed,
      boundaryLevel: priorLateTurnConstraintState.boundaryLevel,
      requirementRestatedCount: priorLateTurnConstraintState.requirementRestatedCount,
      holdAtBoundary: engagedEvidenceSeekingRequest && !overrideExit,
    });
    const objectiveRanking = rankResponseObjective({
      overrideExit,
      terminalDecisionMode,
      hardLoopBreaker,
      concernFlowOutcome,
      activeConstraints: normalizedActiveConstraints,
      activeOperationalConstraints: operationalConstraintState.activeOperationalConstraints,
      latestUserTurn: respondingToTurn?.hcpDialogueBefore || "",
      hardDemandState,
    });
    const lockedPlannerObjective = buildHardDemandLockedObjective(hardDemandState, activeConcern);
    const objectiveOverrideBlocked = Boolean(unresolvedHardDemandLock && lockedPlannerObjective);
    const chosenResponseObjective = objectiveOverrideBlocked
      ? lockedPlannerObjective
      : objectiveRanking.selectedObjective;
    hardDemandPriorityRef.current = {
      ...hardDemandPriorityRef.current,
      lockedPlannerObjective: chosenResponseObjective,
      objectiveOverrideBlocked,
    };
    const previousRepMessagesForProgression = collectRepMessagesForSimilarLatestAsk(turns, respondingToTurn?.hcpDialogueBefore || "");
    const latestAskProgression = classifyLatestAskProgression({
      latestHcpAsk: respondingToTurn?.hcpDialogueBefore || "",
      repMessage,
      previousRepMessages: previousRepMessagesForProgression,
    });
    const liveTurnAuthorityBypass = shouldBypassLatestAskAuthority({
      repMessage,
      latestAskProgression,
      isFirstRepTurn,
      inPleasantryGracePeriod,
      repClarificationRequest,
    });
    const plannerStateSnapshot = {
      activeConcern,
      effectiveActiveConcern,
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
      lateTurnConstraintDecision,
      latestAskProgression,
      activeHardDemand: hardDemandState.activeHardDemand,
      hardDemandType: hardDemandState.hardDemandType,
      hardDemandSourceTurn: hardDemandState.hardDemandSourceTurn,
      hardDemandPriorityLock: hardDemandState.hardDemandPriorityLock,
      hardDemandUnresolved: hardDemandState.hardDemandUnresolved,
      pendingSecondaryConcerns: hardDemandState.pendingSecondaryConcerns,
      hardDemandReleaseReason: hardDemandState.hardDemandReleaseReason,
      narrowingLevel: hardDemandState.narrowingLevel,
      supersessionReason: hardDemandState.supersessionReason,
      lockedPlannerObjective: chosenResponseObjective,
      objectiveOverrideBlocked,
      hardDemandKept: Boolean(hardDemandState.hardDemandPriorityLock && hardDemandState.hardDemandType),
      secondaryConcernBuffered: Boolean(
        hardDemandState.hardDemandPriorityLock
        && activeConcern
        && hardDemandState.activeHardDemand
        && hardDemandState.activeHardDemand !== activeConcern
      ),
      secondaryConcernSuppressed: Boolean(
        hardDemandState.hardDemandPriorityLock
        && activeConcern
        && hardDemandState.activeHardDemand
        && hardDemandState.activeHardDemand !== activeConcern
      ),
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
      activeHardDemand: hardDemandState.activeHardDemand,
      hardDemandPriorityLock: hardDemandState.hardDemandPriorityLock,
      hardDemandKept: plannerStateSnapshot.hardDemandKept,
      hardDemandReleaseReason: hardDemandState.hardDemandReleaseReason,
      secondaryConcernBuffered: plannerStateSnapshot.secondaryConcernBuffered,
      secondaryConcernSuppressed: plannerStateSnapshot.secondaryConcernSuppressed,
      narrowingLevel: hardDemandState.narrowingLevel,
      supersessionReason: hardDemandState.supersessionReason,
      lockedPlannerObjective: chosenResponseObjective,
      objectiveOverrideBlocked,
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
      lateTurnConstraintBoundaryLevel: lateTurnConstraintDecision.nextBoundaryLevel,
      lateTurnConstraintRestatedCount: lateTurnConstraintDecision.nextRequirementRestatedCount,
      conversationIntelligence: conversationIntelligenceState,
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

    const scenarioContext = visibleScenarioGroundingText.trim();
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

    const extractQuotedOpeningBeat = (openingText) => {
      const text = String(openingText || "");
      if (!text.trim()) return "";
      const quoteMatches = [...text.matchAll(/['"]([^'"]{12,})['"]/g)];
      if (!quoteMatches.length) return "";
      const longest = quoteMatches
        .map((m) => String(m?.[1] || "").trim())
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)[0];
      return longest || "";
    };

    const normalizeOpeningBeatToPrompt = (openingText) => {
      const raw = String(openingText || "").trim();
      if (!raw) return "";
      const quoted = extractQuotedOpeningBeat(raw);
      const candidate = quoted || raw;
      return candidate
        .replace(/\s+/g, " ")
        .replace(/\b(she|he)\s+(says|asks|replies)\b[:]?/gi, "")
        .replace(/[“”]/g, "\"")
        .trim();
    };

    const buildGlobalOpeningPrompt = () => {
      if (isFirstHcpResponse && firstTurnActiveAskState?.askText) {
        if (firstTurnActiveAskState.source === "narrative_context") {
          return `Right now, I need ${firstTurnActiveAskState.askText}.`;
        }
        if (firstTurnActiveAskState.concernFamily === "workflow") {
          return "Right now, the practical workflow issue is the priority. What is one step we could implement without adding burden?";
        }
        if (firstTurnActiveAskState.concernFamily === "screening") {
          return "Right now, I need this tied to patient selection. What is the first screening checkpoint you would use?";
        }
        if (firstTurnActiveAskState.concernFamily === "evidence") {
          return "Given the decision in front of us, what is the single most relevant evidence point I should focus on?";
        }
        if (firstTurnActiveAskState.concernFamily === "access") {
          return "Right now, the access barrier is the priority. What is the first step that reduces the bottleneck?";
        }
      }
      const openingBeat = normalizeOpeningBeatToPrompt(scenario?.opening_scene || scenario?.openingScene || "");
      if (openingBeat) return openingBeat;

      if (scenarioMonitoringFocus) {
        return "I want to make sure our follow-up approach is practical. What should we prioritize first?";
      }
      if (scenarioPathwayWorkflowFocus) {
        return "We need a workflow-fit recommendation we can actually apply this week. What's your first step?";
      }
      if (scenarioPayerFocus) {
        return "Please keep this focused on coverage and practical implementation. What's most relevant right now?";
      }

      return "Let's focus on one practical issue we can solve today. What's your recommendation?";
    };

    const buildFirstTurnScenarioFallback = () => {
      const warmGreeting = inPleasantryGracePeriod
        ? (repAskedWellbeing ? "I'm doing well, thanks for asking." : "")
        : "Thanks for checking in.";
      const withOptionalGreeting = (line) => (
        warmGreeting ? `${warmGreeting} ${line}` : line
      );
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
        return withOptionalGreeting(buildGlobalOpeningPrompt());
      }

      if (scenarioCabFocus && scenarioScreeningFocus) {
        return withOptionalGreeting(buildGlobalOpeningPrompt());
      }

      if (strictKolEvidenceContext) {
        return withOptionalGreeting("I have a tight window, and for KOL discussions I need evidence I can defend with peer-reviewed rigor. What's your strongest decision-level data point?");
      }

      if (strictOralOncOnboardingContext) {
        return withOptionalGreeting("Our oral oncolytic starts are still hitting refill gaps around day 25 to 30, so I need a concrete onboarding workflow fix. Where do you want us to intervene first?");
      }

      if (strictPostDischargeTransitionsContext) {
        return withOptionalGreeting("Our post-discharge MI/HF handoffs are where readmission risk shows up, so keep this tied to transition workflow. What's the first operational step you'd recommend?");
      }

      if (scenarioCommitteeFocus) {
        return withOptionalGreeting("We're reviewing formulary and P&T considerations this week, so let's keep this focused. What's the key update you wanted to share?");
      }

      if (scenarioPayerFocus) {
        return withOptionalGreeting("I've been focused on payer coverage and utilization criteria, so I can give you a couple minutes. What's most relevant for medical director review?");
      }

      if (scenarioPathwayWorkflowFocus) {
        return withOptionalGreeting("We're working through pathway and staffing workflow updates right now, so keep it practical. What change are you recommending?");
      }

      if (scenarioOncologyKOLFocus) {
        return withOptionalGreeting("Before we go further, I need evidence we can defend in front of our KOL group, not broad claims. What's the most decision-relevant data point?");
      }

      if (scenarioOralOncOnboardingFocus) {
        return withOptionalGreeting("Our oral oncolytic starts are losing momentum between onboarding and first refill, so I need an operational fix, not a concept. Where should we intervene first?");
      }

      if (scenarioPostMiTransitionsFocus) {
        return withOptionalGreeting("Our post-MI and heart failure discharge transitions are where readmissions creep in, so keep this tightly tied to handoffs and follow-up execution. What is your first-step recommendation?");
      }

      if (scenarioMonitoringFocus) {
        return withOptionalGreeting(buildGlobalOpeningPrompt());
      }

      if (scenarioPressured) {
        return withOptionalGreeting(buildGlobalOpeningPrompt());
      }

      return withOptionalGreeting(buildGlobalOpeningPrompt());
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

      const workflowProgressionFollowUp = ["workflow", "time", "policy", "access", "screening"].includes(activeConcern)
        ? buildWorkflowProgressionFollowUp(repMessage)
        : "";
      if (workflowProgressionFollowUp) {
        return workflowProgressionFollowUp;
      }

      if (nextHcpState === "time-pressured") {
        return "I hear you, but with our staffing, give me one practical step we could actually run.";
      }

      const studyQuestionAllowed = mentionsStudy
        && (activeConcern === "evidence" || scenarioCommitteeFocus || scenarioOncologyKOLFocus)
        && !(activeConcern === "workflow" || activeConcern === "access" || scenarioPathwayWorkflowFocus || scenarioOralOncOnboardingFocus);
      if (studyQuestionAllowed) {
        return "I'd like to know more about the study's methodology. What was the duration of the study?";
      }

      if (mentionsStudy && !studyQuestionAllowed) {
        return chooseConcernSpecificVariant({
          concern: activeConcern === "access" ? "access" : activeConcern === "screening" ? "screening" : "workflow",
          seed: `${generationKey}:${nextTurnNumber}:study-reanchor`,
          recentDialogues: collectRecentHcpDialogues(prevTurns, NO_REPEAT_WINDOW_TURNS),
        });
      }

      if (mentionsMaterials && scenarioPrepFocus) {
        return "Are the materials you'll be leaving going to help my patients understand how to gain access to PrEP without jumping through so many hoops?";
      }

      if (scenarioCabFocus && scenarioScreeningFocus) {
        const acknowledgedPlan = hasScenarioAlignedScreeningPlan(repMessage);
        if (acknowledgedPlan) {
          return "That is the right focus. Help me make it operational: which screening checkpoint would my team apply first?";
        }
        return "I need the screening approach to be concrete. Which candidacy checkpoint would you apply first for long-acting cabotegravir?";
      }

      if (scenarioMonitoringFocus) {
        return "What is the most practical monitoring plan we can apply consistently without overloading the clinic team?";
      }

      const safeLeadIn = buildSafeReferenceLeadIn(repMessage, "I hear your concern.");

      if (scenarioPrepFocus) {
        return `${safeLeadIn} Since my patients are the priority and access remains a challenge, what is the most practical recommendation you can provide to improve access to PrEP today?`;
      }

      return `${safeLeadIn} Since my patients are the priority, what is the most practical recommendation you can provide for my workflow today?`;
    };

    const buildNonRepeatingScenarioFallback = (previousDialogue = "") => {
      const base = buildFollowUpScenarioFallback();
      const prevNorm = String(previousDialogue || "").trim().toLowerCase();
      const baseNorm = String(base || "").trim().toLowerCase();
      if (!prevNorm || prevNorm !== baseNorm) return base;

      const repLower = String(repMessage || "").toLowerCase();
      const safeLeadIn = buildSafeReferenceLeadIn(repMessage, "I hear your concern.");

      if (scenarioCabFocus && scenarioScreeningFocus) {
        return `${safeLeadIn} Help me understand the exact candidacy and resistance checks we can apply consistently this week.`;
      }

      if (scenarioPrepFocus) {
        return `${safeLeadIn} Given our access bottlenecks and limited staff time, what single practical step should we start with today for PrEP patients?`;
      }

      if (scenarioMonitoringFocus) {
        return `${safeLeadIn} What is the simplest monitoring and follow-up step we can implement without adding extra burden?`;
      }

      return `${safeLeadIn} What is the most practical next step we can apply in clinic today without disrupting workflow?`;
    };

    const buildScenarioAlignedCue = (dialogue, isFirstTurn, recentCues = [], engagementTier = "engaged") => {
      const value = String(dialogue || "").toLowerCase();
      if (isFirstTurn) {
        const firstTurnCueSeed = `${scenario?.id || scenario?.title || "scenario"}:${nextTurnNumber}:${activeConcern}`;
        const scenarioFirstTurnConcern = detectPrimaryConcern([
          scenario?.title,
          scenario?.description,
          visibleScenarioGroundingText,
          scenario?.opening_scene || scenario?.openingScene || "",
          scenario?.objective,
          Array.isArray(scenario?.challenges) ? scenario.challenges.join(" ") : String(scenario?.challenges || ""),
        ].join(" "));
        if (scenarioPrepFocus && scenarioPressured) {
          const prepPressureCues = [
            "The HCP glances at a stack of prior-authorization forms, then looks up with a polite but rushed expression.",
            "The HCP checks a clinic schedule board, then turns back with focused, time-aware attention.",
            "The HCP sets a chart beside pending prior-auth packets and motions for a concise point.",
          ];
          return prepPressureCues[deterministicIndex(firstTurnCueSeed, prepPressureCues.length)];
        }
        if (scenarioCabFocus && scenarioScreeningFocus) {
          const cabScreeningCues = [
            "The HCP reviews a chart note and screening checklist, then looks up with a focused, slightly uncertain expression.",
            "The HCP pauses over candidacy criteria in the chart and nods for a specific recommendation.",
            "The HCP highlights screening fields on a form, then asks with careful, practical focus.",
          ];
          return cabScreeningCues[deterministicIndex(firstTurnCueSeed, cabScreeningCues.length)];
        }
        if (scenarioMonitoringFocus) {
          const monitoringCues = [
            "The HCP taps a follow-up list on the desk, then turns back with a practical, time-aware expression.",
            "The HCP checks upcoming follow-up slots and signals for one implementable monitoring step.",
            "The HCP scans a monitoring tracker, then looks up expecting a concrete, workflow-fit action.",
          ];
          return monitoringCues[deterministicIndex(firstTurnCueSeed, monitoringCues.length)];
        }

        const firstTurnCuePools = {
          access: [
            "The HCP glances at coverage notes and asks for one practical access step that can work in this setting.",
            "The HCP sets a payer policy printout on the desk and signals for a realistic access recommendation.",
            "The HCP checks prior-auth paperwork, then looks up expecting a practical access-first suggestion.",
          ],
          workflow: [
            "The HCP points to a clinic workflow map and asks for one concrete step that will not add burden.",
            "The HCP reviews handoff notes and signals for a process-level recommendation that is realistic this week.",
            "The HCP checks staffing assignments and asks for a workflow-fit action they can actually run now.",
          ],
          evidence: [
            "The HCP turns to outcome notes and asks for the single most practice-relevant evidence point.",
            "The HCP highlights a study summary and signals for one evidence-backed takeaway they can trust.",
            "The HCP scans trial notes and asks for a concise, clinically meaningful data point.",
          ],
          screening: [
            "The HCP reviews candidacy criteria and asks for one clear selection rule they can apply immediately.",
            "The HCP marks screening checkpoints and asks for a practical criteria-first recommendation.",
            "The HCP checks patient-selection notes and signals for one implementable screening decision rule.",
          ],
          time: [
            "The HCP checks the schedule and asks for one concise, high-yield point before moving on.",
            "The HCP glances at the clock and signals for a brief, immediately actionable takeaway.",
            "The HCP keeps one hand on the chart and asks for a single practical point in under a minute.",
          ],
        };
        const resolvedPool = firstTurnCuePools[scenarioFirstTurnConcern] || firstTurnCuePools.workflow;
        return resolvedPool[deterministicIndex(firstTurnCueSeed, resolvedPool.length)];
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

      const concern = detectPrimaryConcern(`${value} ${visibleScenarioGroundingText || scenario?.description || ""}`);
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
          scenario: {
            ...buildRuntimeScenarioView(scenario, runtimeScenarioContractRef.current),
            visibleScenarioContext: visibleScenarioGroundingText,
            hiddenAuthoringContext: hiddenAuthoringContextText,
          },
          hcpProfile: nextProfile,
          historyText,
          isOpening: isFirstHcpResponse,
        }) + `\n\nENGAGEMENT DECAY LAYER:\n- Current engagement tier: ${decayState.tier}.\n- Active concern to protect: ${effectiveActiveConcern}.\n- Concern addressed by rep this turn: ${decayState.concernAddressed ? "yes" : "no"}.\n- Repeated evidence without operational link: ${decayState.repeatedEvidence ? "yes" : "no"}.\n- Tier directive: ${ENGAGEMENT_TIER_PROMPT_GUIDANCE[decayState.tier]}\n- Keep sentence count at or below ${ENGAGEMENT_TIER_SENTENCE_MAX[decayState.tier]}.\n- Maintain professional tone. Be firm if needed, but never hostile or sarcastic.`;
        emitPlannerTrace("planner_input_assembled", {
          turnNumber: nextTurnNumber,
          plannerVisibleConstraints: normalizedActiveConstraints,
          plannerVisibleConcern: effectiveActiveConcern,
          concernFlowOutcome,
          promptPreview: {
            activeConcern: effectiveActiveConcern,
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
            roleplayTurnValidation: roleplayTurnValidationContext,
          })
        });
        if (res.ok) {
          const data = await res.json();
          const rawStr = normalizeLlmInvokeText(data);
          nextHcpDialogue = rawStr.trim().split('\n')[0];
          if (!nextHcpDialogue) {
            if (import.meta.env.DEV) {
              console.warn("ROLEPLAY_DIALOGUE_PRESENCE_GUARD", {
                turnNumber: nextTurnNumber,
                source: "llm_normalized_empty",
              });
            }
            usedDeterministicFallback = true;
            draftResponseSource = "empty_normalized_fallback";
            nextHcpDialogue = isFirstHcpResponse
              ? buildFirstTurnScenarioFallback()
              : buildFollowUpScenarioFallback();
          }

          if (
            import.meta.env.DEV
            && rawStr.includes("?")
            && !nextHcpDialogue.includes("?")
          ) {
            console.warn("PUNCTUATION_INTEGRITY_VIOLATION", { source: "hcp-message-processing" });
          }

          nextHcpDialogue = normalizeHcpDialoguePunctuation(nextHcpDialogue).trim();
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

    if (usedDeterministicFallback && !forceTerminalDisengagement) {
      try {
        const fallbackRecoveryPrompt = [
          "You are generating ONE HCP reply in a role-play simulation.",
          `Visible scenario grounding: ${visibleScenarioGroundingText}`,
          `Current HCP state: ${nextHcpState}`,
          `Active concern: ${effectiveActiveConcern}`,
          `Previous HCP line: ${respondingToTurn?.hcpDialogueBefore || ""}`,
          `Rep reply to react to: ${repMessage}`,
          "Rules:",
          "- Respond directly to the rep's last message.",
          "- Keep continuity with the previous HCP line and active concern.",
          "- Do not introduce background facts from scenario context unless they were already spoken or directly requested.",
          "- If the rep is asking what the HCP meant, clarify the previous HCP line rather than adding a new fact.",
          "- Do not drift to unrelated topics.",
          "- One sentence only.",
          "- Keep realistic clinical/workflow pressure tone.",
        ].join('\n');

        const recoveryRes = await fetch('/api/llm/invoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: fallbackRecoveryPrompt,
            max_tokens: 120,
            temperature: 0,
            roleplay: true,
            roleplayTurnValidation: roleplayTurnValidationContext,
          })
        });
        if (recoveryRes.ok) {
          const recoveryData = await recoveryRes.json();
          const recoveredLine = normalizeLlmInvokeText(recoveryData).split('\n')[0].trim();
          if (recoveredLine) {
            nextHcpDialogue = recoveredLine;
            draftResponseBeforePostProcessing = recoveredLine;
            draftResponseSource = `${draftResponseSource}_ai_recovery`;
          }
        }
      } catch (recoveryError) {
        if (import.meta.env.DEV) {
          console.warn("ROLEPLAY_AI_FALLBACK_RECOVERY_FAILED", { recoveryError });
        }
      }
    }

    if (!String(nextHcpDialogue || "").trim()) {
      const deterministicFallback = isFirstHcpResponse
        ? buildFirstTurnScenarioFallback()
        : buildFollowUpScenarioFallback();
      if (deterministicFallback) {
        usedDeterministicFallback = true;
        draftResponseSource = `${draftResponseSource}_deterministic_guard`;
        nextHcpDialogue = deterministicFallback;
      } else {
        draftResponseSource = `${draftResponseSource}_last_safe_guard`;
        nextHcpDialogue = lastSafeDialogueRef.current;
      }
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

    const latestAskBoundDialogue = liveTurnAuthorityBypass
      ? ""
      : buildLatestAskProgressionDialogue(latestAskProgression);
    if (!overrideExit && nextHcpState !== "disengaged" && latestAskBoundDialogue) {
      usedDeterministicFallback = true;
      draftResponseSource = `${draftResponseSource}_latest_ask_progression_gate`;
      nextHcpDialogue = latestAskBoundDialogue;
      if (latestAskProgression.status === "repeated_missed_close") {
        nextHcpState = "disengaged";
      } else if (["repeated_missed", "repeated_owner_progress", "repeated_missing_owner", "repeated_workflow_progress"].includes(latestAskProgression.status)) {
        nextHcpState = nextHcpState === "engaged" ? "resistant" : nextHcpState;
      }
    }

    if (!overrideExit && nextHcpState !== "disengaged" && liveTurnAuthorityBypass) {
      const liveTurnAuthorityDialogue = buildLiveTurnAuthorityDialogue({
        repMessage,
        previousHcpLine: respondingToTurn?.hcpDialogueBefore || "",
        activeConcern,
        isFirstRepTurn,
        repAskedWellbeing,
        inPleasantryGracePeriod,
      });
      if (liveTurnAuthorityDialogue) {
        usedDeterministicFallback = true;
        draftResponseSource = `${draftResponseSource}_live_turn_authority`;
        nextHcpDialogue = liveTurnAuthorityDialogue;
      }
    }

    if (
      !overrideExit
      && nextHcpState !== "disengaged"
      && ["missed", "overpivot", "aligned"].includes(concernFlowOutcome)
      && (activeConcern === "workflow" || activeConcern === "access" || activeConcern === "time")
      && !latestAskBoundDialogue
    ) {
      const needsReanchor = concernFlowOutcome === "missed" || concernFlowOutcome === "overpivot";
      const shouldNudgeConditional =
        concernFlowOutcome === "aligned"
        && !/\b(as long as|depends|without adding|if it reduces|realistic)\b/i.test(nextHcpDialogue);

      if (needsReanchor || shouldNudgeConditional) {
        nextHcpDialogue = buildOperationalReanchorDialogue({
          mode: concernFlowOutcome,
          unresolvedConcernTurns,
          activeConcern,
        });
        if (concernFlowOutcome === "aligned" && recoveryTiming === "late") {
          nextHcpDialogue = buildOperationalReanchorDialogue({
            mode: "aligned",
            unresolvedConcernTurns: Math.max(2, unresolvedConcernTurns),
            activeConcern,
          });
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
    nextHcpDialogue = stripSimulatorMetaDialogue(nextHcpDialogue);
    nextHcpDialogue = stripFollowUpAfterTerminalClose(nextHcpDialogue);

    const primaryConcern = detectPrimaryConcern(
      `${visibleScenarioGroundingText || scenario?.description || ""} ${respondingToTurn?.hcpDialogueBefore || ""} ${nextHcpDialogue}`
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

    const runtimeScenarioView = buildRuntimeScenarioView(scenario, runtimeScenarioContractRef.current);
    const registerSelection = determinePreferredHcpDialogueRegister({
      scenario: runtimeScenarioView,
      runtimeState: {
        activeHcpState: nextHcpState,
        startingState: runtimeScenarioContractRef.current?.hcpStateModel?.startingState,
      },
      cueText: respondingToTurn?.cueBefore || "",
      hcpUtterance: respondingToTurn?.hcpDialogueBefore || "",
      activeConcern: primaryConcern,
    });
    const operationalRealismResult = enforceOperationalRealismPreference({
      dialogue: nextHcpDialogue,
      preferredRegister: registerSelection.preferredRegister,
      activeConcern: primaryConcern,
      flags: registerSelection.flags,
    });
    if (operationalRealismResult.applied && !latestAskBoundDialogue) {
      nextHcpDialogue = operationalRealismResult.dialogue;
    }
    emitPlannerTrace("operational_realism_register", {
      turnNumber: nextTurnNumber,
      preferredRegister: registerSelection.preferredRegister,
      registerScores: registerSelection.registerScores,
      registerFlags: registerSelection.flags,
      rewriteApplied: operationalRealismResult.applied && !latestAskBoundDialogue,
      rewriteReasons: operationalRealismResult.reasons,
      activeConcern: primaryConcern,
    });

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
    const selectedCueLayers = [];
    if (overrideExit) {
      // Constrain HCP behavior: closure only, no questions or escalation
      nextHcpDialogue = 'Understood. Please coordinate a follow-up slot with the front desk.';
      contextualCue = 'The HCP stands and checks their calendar, signaling the conversation is ending soon.';
      selectedCueLayers.push("safeguard_override");
    } else {
      selectedCueLayers.push("locked_base");
      // Derive cue from the exact same grounded inputs as dialogue (scenario + rep message + generated response)
      const recentCueText = prevTurns.map((t) => t.cueBefore).filter(Boolean);
      if (terminalDecisionMode) {
        const cueIndex = deterministicIndex(
          `${generationKey}:${nextTurnNumber}:${activeConcern}:terminal-cue`,
          TERMINAL_DECISION_CUES.length,
        );
        contextualCue = TERMINAL_DECISION_CUES[cueIndex];
        selectedCueLayers.push("contextual_terminal");
      } else {
        contextualCue = buildScenarioAlignedCue(nextHcpDialogue, isFirstHcpResponse, recentCueText, decayState.tier);
        selectedCueLayers.push("contextual_dialogue_aligned");
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
        selectedCueLayers.push("safeguard_no_repeat");
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
      selectedCueLayers.push("safeguard_recent_memory");
    }

    if (!overrideExit && isTerminalDisengagementCue(contextualCue)) {
      nextHcpState = "disengaged";
      nextHcpDialogue = terminalCloseFallback;
      selectedCueLayers.push("safeguard_terminal_cue_close");
    }

    const cueAlignmentCheck = validateCueDialogueAlignment({
      cueText: contextualCue,
      dialogueText: nextHcpDialogue,
      hcpState: nextHcpState,
    });
    if (cueAlignmentCheck.contradiction) {
      const recentCueText = prevTurns.map((t) => t.cueBefore).filter(Boolean);
      const alignedCue = buildScenarioAlignedCue(
        `${nextHcpDialogue} ${nextHcpState}`,
        isFirstHcpResponse,
        recentCueText,
        decayState.tier
      );
      const hardenedAlignedCue = hardenTextSurface(alignedCue);
      if (hardenedAlignedCue) {
        contextualCue = hardenedAlignedCue;
        selectedCueLayers.push("safeguard_alignment");
      }
      if (import.meta.env.DEV) {
        console.warn("ROLEPLAY_CUE_ALIGNMENT_MISMATCH", {
          turnNumber: nextTurnNumber,
          hcpState: nextHcpState,
          cueIntent: cueAlignmentCheck.cueIntent,
          dialogueIntent: cueAlignmentCheck.dialogueIntent,
        });
      }
    }

    if (import.meta.env.DEV) {
      const uniqueLayers = [...new Set(selectedCueLayers)];
      if (uniqueLayers.length > 3) {
        console.warn("ROLEPLAY_CUE_THRASHING_GUARD", {
          turnNumber: nextTurnNumber,
          layers: uniqueLayers,
        });
      }
    }

    // 7. Coaching overlay — driven by alignment rubric flags
    const coachingResult = shouldTriggerCoaching(alignment, prevState, nextHcpState);
    if (coachingResult.shouldShow) setCoachingTip(coachingResult);

    const priorHcpConstraints = Array.isArray(respondingToTurn?.hcpConstraintState?.activeConstraints)
      ? respondingToTurn.hcpConstraintState.activeConstraints
      : hcpConstraintEngineRef.current.activeConstraints;
    const activeDemandSnapshot = interventionStateRef.current?.activeDemand;
    const strictDemandEscalationActive = Boolean(
      activeDemandSnapshot?.isActive
      && Number(activeDemandSnapshot?.unresolvedTurns || 0) >= 3
    );
    const activeDemandFamily = mapDemandTypeToFamily(activeDemandSnapshot?.type || "");
    const calibratedPriorConstraints = priorHcpConstraints
      .map((constraint) => {
        const satisfaction = isConstraintSatisfied(constraint, repMessage);
        const turnsActive = Number(constraint?.turnsActive || 0) + 1;
        if (turnsActive > 5) return null; // decay auto-resolve
        const priorScoreHistory = Array.isArray(constraint?.progressionScoreHistory)
          ? constraint.progressionScoreHistory.slice(-5)
          : [];
        const recentRepMsgs = prevTurns
          .map((turn) => String(turn?.repMessage || "").trim())
          .filter(Boolean)
          .slice(-2);
        const progressionScore = computeAuxiliaryProgressionScore({
          constraintType: constraint?.type,
          repMessage,
          hcpPrompt: respondingToTurn?.hcpDialogueBefore || "",
          previousRepMessage: recentRepMsgs[recentRepMsgs.length - 1] || "",
        });
        const progressionScoreHistory = [...priorScoreHistory, progressionScore].slice(-6);
        const partialCount = satisfaction === "partially_satisfied"
          ? Number(constraint?.partialCount || 0) + 1
          : Number(constraint?.partialCount || 0);
        const repeatedRepPatternInWindow = recentRepMsgs.length >= 2
          && computeSimilarity(recentRepMsgs[0], recentRepMsgs[1]) >= 0.88
          && computeSimilarity(recentRepMsgs[1], repMessage) >= 0.88;
        const recentConstraintPrompts = prevTurns
          .map((turn) => String(turn?.hcpDialogueBefore || "").trim())
          .filter(Boolean)
          .slice(-3);
        const similarConstraintPromptsInWindow = recentConstraintPrompts
          .filter((utterance) => computeSimilarity(utterance, respondingToTurn?.hcpDialogueBefore || "") >= 0.7).length;
        const diminishingReturns = detectDiminishingReturns({
          progressionScoreHistory,
          repeatedRepPattern: repeatedRepPatternInWindow,
          similarConstraintPrompts: similarConstraintPromptsInWindow,
          recentRepMessages: [...recentRepMsgs, repMessage],
        });
        const sameDemandFamily = (() => {
          const constraintDemandFamily = mapConstraintTypeToDemandFamily(constraint?.type || "");
          if (!constraintDemandFamily || !activeDemandFamily) return true;
          return constraintDemandFamily === activeDemandFamily;
        })();
        const functionallyResolved = (
          !strictDemandEscalationActive
          && sameDemandFamily
          && satisfaction !== "fully_satisfied"
          && turnsActive >= 2
          && partialCount >= 1
          && progressionScore >= 0.6
          && diminishingReturns
        );
        const nextPriority = (
          turnsActive > 3
          && (satisfaction === "partially_satisfied" || functionallyResolved)
          && String(constraint?.priority || "blocking") === "blocking"
        )
          ? "soft"
          : String(constraint?.priority || "blocking");
        if (satisfaction === "fully_satisfied") return null;
        return {
          ...constraint,
          turnsActive,
          progressionScore,
          progressionScoreHistory,
          partialCount,
          lastResolutionState: functionallyResolved ? "functionally_resolved" : satisfaction,
          functionallyResolved,
          priority: nextPriority,
          satisfaction: functionallyResolved ? "functionally_resolved" : satisfaction,
        };
      })
      .filter(Boolean);
    const priorFunctionallyResolvedByType = new Map(
      calibratedPriorConstraints
        .filter((constraint) => constraint?.functionallyResolved)
        .map((constraint) => [constraint.type, constraint])
    );
    const newlyDetectedHcpConstraints = extractHcpConstraints(nextHcpDialogue).filter((candidate) => {
      const priorResolved = priorFunctionallyResolvedByType.get(candidate?.type);
      if (!priorResolved) return true;
      const confidenceShift = Math.abs(Number(candidate?.confidence || 0) - Number(priorResolved?.confidence || 0));
      const materiallyDifferentSignal = confidenceShift >= 0.25;
      return materiallyDifferentSignal;
    });
    const activeHcpConstraints = validateConstraintState(
      mergeActiveConstraints(calibratedPriorConstraints, newlyDetectedHcpConstraints)
    );
    const blockingUnresolvedConstraints = activeHcpConstraints.filter(
      (constraint) => (
        String(constraint?.priority || "blocking") === "blocking"
        && constraint?.satisfaction !== "functionally_resolved"
      )
    );
    const hasFunctionalResolution = activeHcpConstraints.some(
      (constraint) => constraint?.satisfaction === "functionally_resolved"
    );
    const hasPartialProgress = hasFunctionalResolution || activeHcpConstraints.some(
      (constraint) => constraint?.satisfaction === "partially_satisfied"
    );
    const diminishingReturnsDetected = activeHcpConstraints.some((constraint) => {
      if (!Array.isArray(constraint?.progressionScoreHistory) || constraint.progressionScoreHistory.length < 2) return false;
      const history = constraint.progressionScoreHistory.slice(-3);
      const delta = Math.abs(Number(history[history.length - 1] || 0) - Number(history[0] || 0));
      return delta <= 0.08 && Number(history[history.length - 1] || 0) >= 0.55;
    });
    const blockClose = blockingUnresolvedConstraints.length > 0 && !hasPartialProgress;
    if (import.meta.env.DEV) {
      console.debug("ROLEPLAY_CALIBRATION", {
        turnNumber: nextTurnNumber,
        priorCount: priorHcpConstraints.length,
        unresolvedCount: calibratedPriorConstraints.length,
        detectedCount: newlyDetectedHcpConstraints.length,
        activeCount: activeHcpConstraints.length,
        confidences: newlyDetectedHcpConstraints.map((constraint) => ({
          type: constraint.type,
          confidence: constraint.confidence,
        })),
        states: activeHcpConstraints.map((constraint) => ({
          type: constraint.type,
          priority: constraint.priority,
          satisfaction: constraint.satisfaction || "not_satisfied",
          turnsActive: constraint.turnsActive || 0,
          progressionScore: Number(constraint.progressionScore || 0),
          partialCount: Number(constraint.partialCount || 0),
        })),
        hasPartialProgress,
        hasFunctionalResolution,
        diminishingReturnsDetected,
        blockClose,
      });
    }

    // 8. Lock next turn with contextual cue (matches dialogue + question quality)
    // Use contextual cue instead of base profile cue to ensure body language matches what HCP said
    const coachingTriggerInputs = {
      shouldShow: Boolean(coachingResult?.shouldShow),
      label: coachingResult?.label || null,
      severity: coachingResult?.severity || null,
      escalationLabel: coachingResult?.escalationLabel || null,
    };
    const scoringContextForReaction = {
      cueText: scoringCueContext,
      hcpUtterance: scoringDialogueContext,
      selectedCueMeaning: scoringContextInput.selectedCueMeaning,
      selectedDialogueIntent: scoringContextInput.selectedDialogueIntent,
      selectedDialogueRegister: scoringContextInput.selectedDialogueRegister,
      prevState,
      prevHcpState,
      activeConcern,
      alignmentMetricKeys: Object.keys(alignment?.metrics || {}).sort(),
    };
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
      hcpConstraintState: {
        activeConstraints: activeHcpConstraints,
        blockClose,
      },
      hcpIdentity: {
        canonicalHcpDisplayName: canonicalHcpIdentity.canonicalHcpDisplayName,
        hcpIdentitySource: canonicalHcpIdentity.hcpIdentitySource,
        hcpIdentityPreserved: true,
        hcpFallbackUsed: canonicalHcpIdentity.hcpFallbackUsed,
      },
      coachingTriggerInputs,
      scoringContextInput: scoringContextForReaction,
    };

    const turnIntegrityIssues = hasTurnIntegrityIssues(nextTurn);
    if (import.meta.env.DEV && turnIntegrityIssues.length > 0) {
      console.warn("ROLEPLAY_TURN_INTEGRITY_GUARD", {
        turnNumber: nextTurnNumber,
        issues: turnIntegrityIssues,
      });
    }

    if (overrideExit) {
      nextHcpState = "disengaged";
      nextHcpDialogue = terminalCloseFallback;
    }

    const terminalPolicyAction = determineTerminalPolicyAction({
      hcpState: decayState.tier,
      concernFlowOutcome,
      unresolvedConcernTurns,
      repHasFollowUpCommitment,
      repDefersImmediateAction,
      explicitExitOverride: overrideExit,
    });

    if (!overrideExit && terminalPolicyAction === "probe" && isTerminalClosureDialogue(nextHcpDialogue)) {
      nextHcpDialogue = "Before we close, give me one practical change we can run this week without adding burden.";
    }

    const activeDemand = interventionStateRef.current?.activeDemand;
    if (!overrideExit && blockClose && isTerminalClosureDialogue(nextHcpDialogue)) {
      const primaryBlockingConstraint = blockingUnresolvedConstraints[0]?.type || "request_for_specificity";
      const constraintPromptGroups = {
        request_for_evidence: [
          "I still need one practice-relevant evidence point tied to my patient population. Be precise.",
          "Give me one concrete data point that applies to this patient mix—no broad summary.",
          "Name one clinically meaningful evidence detail I can use in this exact setting this week.",
        ],
        request_for_specificity: [
          "I still need one concrete, specific step we can execute this week. Be exact.",
          "Give me one operational step with clear ownership and timing for this clinic.",
          "Name a single implementable action we can run now without adding process burden.",
        ],
        request_for_applicability: [
          "I still need this translated to our exact setting and patient mix before we move on.",
          "Show me how this applies to our real workflow, not a generic scenario.",
          "Tie this directly to our patient selection and visit constraints in this clinic.",
        ],
        request_for_operational_fit: [
          "I still need to hear exactly how this fits our workflow and staffing constraints.",
          "Map this to a practical clinic workflow step with minimal staffing disruption.",
          "Explain the operational handoff so this can run without adding administrative friction.",
        ],
        request_for_clarification: [
          "I still need one clear clarification in operational terms before we proceed.",
          "Clarify the key point in one concrete sentence I can act on today.",
          "Resolve the ambiguity with one precise, practical explanation for this setting.",
        ],
      };
      const constraintPool = constraintPromptGroups[primaryBlockingConstraint] || constraintPromptGroups.request_for_specificity;
      const selectedIndex = deterministicIndex(
        `${generationKey}:${nextTurnNumber}:${primaryBlockingConstraint}:constraint-prompt`,
        constraintPool.length
      );
      nextHcpDialogue = constraintPool[selectedIndex];

      const recentRepMsgs = prevTurns
        .map((turn) => String(turn?.repMessage || "").trim())
        .filter(Boolean)
        .slice(-2);
      const repeatedRepPattern = recentRepMsgs.length >= 2
        && computeSimilarity(recentRepMsgs[0], recentRepMsgs[1]) >= 0.9
        && computeSimilarity(recentRepMsgs[1], repMessage) >= 0.9;
      const similarConstraintPrompts = prevTurns
        .map((turn) => String(turn?.hcpDialogueBefore || "").trim())
        .filter(Boolean)
        .slice(-4)
        .filter((utterance) => computeSimilarity(utterance, nextHcpDialogue) >= 0.7).length;
      const consecutiveBlockCloseTurns = (() => {
        let count = 0;
        for (let i = prevTurns.length - 1; i >= 0; i -= 1) {
          if (prevTurns[i]?.hcpConstraintState?.blockClose) count += 1;
          else break;
        }
        return count;
      })();

      const loopAction = resolveConstraintLoopAction({
        consecutiveBlockCloseTurns,
        repeatedRepPattern,
        similarConstraintPrompts,
        activeConcern: effectiveActiveConcern,
        terminalCloseFallback,
        hasMaterialProgression: engagedEvidenceSeekingRequest || materiallyProgressedConstraintRequest,
        hasFunctionalResolution,
        diminishingReturnsDetected,
        hardDemandContinuation: hardDemandState.hardDemandPriorityLock,
        hardDemandNarrowingLevel: hardDemandState.narrowingLevel,
        repeatingNonAnswer: Boolean(activeDemand?.evasiveResponseDetected || activeDemand?.staleAnswerBlocked),
      });
      if (loopAction) {
        nextHcpState = loopAction.nextHcpState;
        nextHcpDialogue = loopAction.nextHcpDialogue;
        if (hardDemandState.hardDemandPriorityLock && Number.isFinite(loopAction.nextNarrowingLevel)) {
          hardDemandPriorityRef.current = {
            ...hardDemandPriorityRef.current,
            narrowingLevel: loopAction.nextNarrowingLevel,
          };
        }
      }
    }

    if (!overrideExit && !blockClose && hasPartialProgress && isTerminalClosureDialogue(nextHcpDialogue)) {
      nextHcpDialogue = "That is directionally useful. Tighten one operational detail so we can apply it without adding burden.";
    }

    if (isTerminalDisengagementIntent(nextHcpDialogue)) {
      nextHcpState = "disengaged";
      nextHcpDialogue = terminalCloseFallback;
    }

    if (!overrideExit && nextHcpState !== "disengaged" && lateTurnConstraintDecision.forced && !objectiveOverrideBlocked && !latestAskBoundDialogue) {
      nextHcpDialogue = buildLateTurnConstraintResponse({
        concern: activeRequirementForTurn,
        mode: lateTurnConstraintDecision.mode,
        includeConstraintSignal: Boolean(
          normalizedActiveConstraints.includes("time")
          || activeConstraintForTurn === "time"
        ),
        seed: `${generationKey}:${nextTurnNumber}:late-turn`,
        progressionStage: lateTurnConstraintDecision.nextRequirementRestatedCount,
      });

      if (
        lateTurnConstraintDecision.mode === "close"
        && priorLateTurnConstraintState.boundaryLevel === "closing"
      ) {
        nextHcpState = "disengaged";
        nextHcpDialogue = terminalCloseFallback;
      }
    }

    const demandHoldContinuityAllowsOverride = shouldAllowDemandHoldOverride({
      activeDemandType: activeDemand?.type || null,
      candidateHcpDialogue: nextHcpDialogue,
    });
    const demandHoldActive = ENABLE_V2_INTERVENTION_RUNTIME
      && !overrideExit
      && nextHcpState !== "disengaged"
      && hardDemandState.hardDemandPriorityLock
      && activeDemand?.isActive
      && activeDemand?.type
      && demandHoldContinuityAllowsOverride;
    let demandHoldStage = 0;
    let demandHoldOverrodeProgression = false;
    if (demandHoldActive) {
      const previousHold = demandHoldHistoryRef.current;
      const holdDirective = buildDemandHoldDirective({
        demandType: activeDemand.type,
        activeConcern: effectiveActiveConcern,
        scenarioFamily,
        unresolvedTurns: activeDemand.unresolvedTurns,
        seed: `${generationKey}:${nextTurnNumber}:${activeDemand.type}`,
        avoidLine: previousHold.demandType === activeDemand.type ? previousHold.line : "",
      });
      nextHcpDialogue = holdDirective.line;
      demandHoldStage = holdDirective.stage;
      demandHoldOverrodeProgression = true;
      demandHoldHistoryRef.current = {
        demandType: activeDemand.type,
        line: nextHcpDialogue,
      };
      if (holdDirective.disengagementTrajectory) nextHcpState = "disengaged";
      else if (holdDirective.impatientTone && nextHcpState === "engaged") nextHcpState = "resistant";
      else if (nextHcpState === "engaged") nextHcpState = "resistant";
    } else {
      demandHoldHistoryRef.current = {
        demandType: null,
        line: "",
      };
    }

    const recentHcpUtterances = prevTurns
      .map((turn) => String(turn?.hcpDialogueBefore || "").trim())
      .filter(Boolean)
      .slice(-2);
    const repetitiveCandidate = recentHcpUtterances.find((utterance) => computeSimilarity(utterance, nextHcpDialogue) >= 0.84);
    const continuity = (!overrideExit && nextHcpState !== "disengaged")
      ? evaluateRepToHcpContinuity({
        repMessage,
        hcpDialogue: nextHcpDialogue,
        priorHcpDialogue: respondingToTurn?.hcpDialogueBefore || "",
        activeConcern,
      })
      : { needsRepair: false };
    const rewriteAuthority = (!overrideExit && nextHcpState !== "disengaged" && !latestAskBoundDialogue)
      ? (repetitiveCandidate ? "anti_repeat" : continuity.needsRepair ? "continuity_repair" : "none")
      : "none";

    if (rewriteAuthority === "anti_repeat") {
      let regenerated = "";
      try {
        const antiRepeatPrompt = [
          "Rewrite the HCP line to avoid repeated phrasing while keeping meaning consistent.",
          `Visible scenario context: ${visibleScenarioGroundingText}`,
          `HCP state: ${nextHcpState}`,
          `Active concern: ${effectiveActiveConcern}`,
          `Previous repeated HCP line: ${repetitiveCandidate}`,
          `Current draft line: ${nextHcpDialogue}`,
          "Rules:",
          "- Keep one sentence only.",
          "- Preserve the same constraint/request and pressure level.",
          "- Do not add new topics.",
          "- Do not add background scenario facts that were not already in the repeated or draft line.",
          "- Use different wording from both previous and current lines.",
        ].join("\n");

        const antiRepeatRes = await fetch('/api/llm/invoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: antiRepeatPrompt,
            max_tokens: 120,
            temperature: 0,
            roleplay: true,
            roleplayTurnValidation: roleplayTurnValidationContext,
          })
        });
        if (antiRepeatRes.ok) {
          const antiRepeatData = await antiRepeatRes.json();
          regenerated = normalizeLlmInvokeText(antiRepeatData).split('\n')[0].trim();
        }
      } catch (antiRepeatError) {
        if (import.meta.env.DEV) {
          console.warn("ROLEPLAY_ANTI_REPEAT_REGEN_FAILED", { antiRepeatError });
        }
      }

      if (regenerated && computeSimilarity(regenerated, repetitiveCandidate) < 0.8) {
        nextHcpDialogue = regenerated;
      } else if (lateTurnConstraintDecision.forced) {
        nextHcpDialogue = buildLateTurnConstraintResponse({
          concern: activeRequirementForTurn,
          mode: lateTurnConstraintDecision.mode,
          includeConstraintSignal: Boolean(
            normalizedActiveConstraints.includes("time")
            || activeConstraintForTurn === "time"
          ),
          seed: `${generationKey}:${nextTurnNumber}:late-turn:anti-repeat`,
          progressionStage: lateTurnConstraintDecision.nextRequirementRestatedCount + 1,
        });
      } else {
        nextHcpDialogue = buildConstraintSafeRegeneratedResponse({
          fallbackResponse: groundedFallback,
          concern: activeConcern,
          includeWarmth: false,
          scenarioContext: visibleScenarioGroundingText,
        });
      }
    } else if (rewriteAuthority === "continuity_repair") {
      try {
        const continuityPrompt = [
          "Revise the HCP reply so it directly responds to the rep's last message and stays in-topic.",
          `Visible scenario grounding: ${visibleScenarioGroundingText}`,
          `Active concern: ${activeConcern}`,
          `Previous HCP line: ${respondingToTurn?.hcpDialogueBefore || ""}`,
          `Rep message: ${repMessage}`,
          `Current HCP draft: ${nextHcpDialogue}`,
          "Rules:",
          "- Keep one sentence only.",
          "- Preserve professional tone and current pressure level.",
          "- Keep the same concern family; do not introduce unrelated topics.",
          "- Do not introduce background scenario facts unless they were already spoken or directly requested.",
          "- If the rep is asking what the HCP meant, clarify the previous HCP line rather than adding a new fact.",
          "- If rep addressed an evidence/study question, react to that directly before redirecting.",
        ].join('\n');

        const continuityRes = await fetch('/api/llm/invoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: continuityPrompt,
            max_tokens: 120,
            temperature: 0,
            roleplay: true,
            roleplayTurnValidation: roleplayTurnValidationContext,
          })
        });
        if (continuityRes.ok) {
          const continuityData = await continuityRes.json();
          const revisedLine = normalizeLlmInvokeText(continuityData).split('\n')[0].trim();
          if (revisedLine) nextHcpDialogue = revisedLine;
        }
      } catch (continuityError) {
        if (import.meta.env.DEV) {
          console.warn("ROLEPLAY_CONTINUITY_REPAIR_FAILED", { continuityError });
        }
      }
    }

    const hiddenFactCheck = detectUnsupportedScenarioFactIntroduction({
      draftText: nextHcpDialogue,
      scenarioContext: hiddenAuthoringContextText,
      visibleContext: visibleDialogueContextText,
    });
    if (!hiddenFactCheck.valid && nextHcpState !== "disengaged") {
      usedDeterministicFallback = true;
      nextHcpDialogue = buildScenarioFactSafeClarification({
        previousHcpLine: respondingToTurn?.hcpDialogueBefore || "",
        activeConcern,
      });
      if (import.meta.env.DEV) {
        console.warn("ROLEPLAY_HIDDEN_FACT_GUARD", {
          turnNumber: nextTurnNumber,
          introducedAnchors: hiddenFactCheck.introducedAnchors,
          replacement: nextHcpDialogue,
        });
      }
    } else if (repClarificationRequest && rewriteAuthority !== "continuity_repair" && nextHcpState !== "disengaged") {
      const directContinuity = evaluateRepToHcpContinuity({
        repMessage,
        hcpDialogue: nextHcpDialogue,
        priorHcpDialogue: respondingToTurn?.hcpDialogueBefore || "",
        activeConcern,
      });
      if (directContinuity.needsRepair) {
        usedDeterministicFallback = true;
        nextHcpDialogue = buildScenarioFactSafeClarification({
          previousHcpLine: respondingToTurn?.hcpDialogueBefore || "",
          activeConcern,
        });
      }
    }

    const openingBeforeGuardrail = getOpeningSentence(nextHcpDialogue);
    const revisitRequested = /\b(again|revisit|you mentioned|earlier you said|back to|still unresolved|remind me)\b/i.test(repMessage);
    const clarificationNeeded = /\b(contradict|inconsistent|clarify|unclear|conflict)\b/i.test(repMessage);
    const changedConstraint = newConstraintTypesThisTurn.length > 0;
    const shouldApplyConstraintDraftGuardrail = respondingToTurn?.turnNumber > 0;
    let initialViolation = {
      valid: true,
      rejectionReason: null,
      ungroundedTypes: [],
      duplicateTypes: [],
    };
    let draftRejectedForConstraintRule = false;
    let finalViolationCheck = {
      valid: true,
      draftTypes: [],
    };
    if (shouldApplyConstraintDraftGuardrail && nextHcpState !== "disengaged" && !latestAskBoundDialogue) {
      initialViolation = detectConstraintDraftViolations({
        draftText: nextHcpDialogue,
        groundedTypes: groundedConstraintTypes,
        alreadySurfacedTypes: previouslySurfacedConstraintTypes,
        newlyRaisedTypes: newConstraintTypesThisTurn,
        revisitRequested,
        changedConstraint,
        clarificationNeeded,
      });
      draftRejectedForConstraintRule = !initialViolation.valid;
      if (draftRejectedForConstraintRule) {
        usedDeterministicFallback = true;
        nextHcpDialogue = buildConstraintSafeRegeneratedResponse({
          fallbackResponse: groundedFallback,
          concern: activeConcern,
          includeWarmth: false,
          scenarioContext: visibleScenarioGroundingText,
        });
      }
      finalViolationCheck = detectConstraintDraftViolations({
        draftText: nextHcpDialogue,
        groundedTypes: groundedConstraintTypes,
        alreadySurfacedTypes: previouslySurfacedConstraintTypes,
        newlyRaisedTypes: newConstraintTypesThisTurn,
        revisitRequested,
        changedConstraint,
        clarificationNeeded,
      });
      if (!finalViolationCheck.valid) {
        nextHcpDialogue = buildNonRepeatingScenarioFallback(respondingToTurn?.hcpDialogueBefore || "");
      }
    }

    const nextLateTurnConstraintState = {
      activeConstraint: activeConstraintForTurn,
      activeRequirement: activeRequirementForTurn,
      boundaryLevel: lateTurnConstraintDecision.nextBoundaryLevel,
      requirementRestatedCount: lateTurnConstraintDecision.nextRequirementRestatedCount,
    };

    const domainIntegrityAtConstruction = evaluateScenarioDomainIntegrity({
      scenario,
      repMessage,
      activeConcern: primaryConcern,
      cueText: contextualCue,
      dialogueText: nextHcpDialogue,
    });
    nextHcpDialogue = enforceDomainReanchorInDialogue({
      dialogueText: nextHcpDialogue,
      domainAssessment: domainIntegrityAtConstruction,
      activeConcern: primaryConcern,
    });

    const acceptedDialogueBeforeFinalContract = nextHcpDialogue;
    nextHcpDialogue = applyDeterministicPunctuationContract(acceptedDialogueBeforeFinalContract);
    const latestAskProtectedDialogue = latestAskBoundDialogue
      ? applyDeterministicPunctuationContract(stripFollowUpAfterTerminalClose(stripSimulatorMetaDialogue(latestAskBoundDialogue)))
      : "";
    const cueDialogueIntegrity = enforceCueDialogueContractIntegrity({
      cueText: contextualCue,
      dialogueText: nextHcpDialogue,
      hcpState: nextHcpState,
      selectedRegister: registerSelection.preferredRegister,
      activeConcern: primaryConcern,
      rebuildCue: () => {
        const recentCueText = prevTurns.map((t) => t.cueBefore).filter(Boolean);
        return buildScenarioAlignedCue(nextHcpDialogue, isFirstHcpResponse, recentCueText, decayState.tier);
      },
      rewriteDialogue: ({ dialogueText, selectedRegister, activeConcern }) => enforceOperationalRealismPreference({
        dialogue: dialogueText,
        preferredRegister: selectedRegister,
        activeConcern,
        flags: registerSelection.flags,
      }).dialogue,
    });
    contextualCue = cueDialogueIntegrity.cueText;
    nextHcpDialogue = latestAskProtectedDialogue || cueDialogueIntegrity.dialogueText;
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
      demandType: activeDemand?.type || null,
      unresolvedDemandTurns: activeDemand?.unresolvedTurns || 0,
      demandSatisfied: activeDemand?.demandSatisfied ?? null,
      demandHoldStage,
      demandHoldOverrodeProgression,
      activeHardDemand: hardDemandState.activeHardDemand,
      hardDemandPriorityLock: hardDemandState.hardDemandPriorityLock,
      hardDemandKept: plannerStateSnapshot.hardDemandKept,
      hardDemandReleaseReason: hardDemandState.hardDemandReleaseReason,
      secondaryConcernBuffered: plannerStateSnapshot.secondaryConcernBuffered,
      secondaryConcernSuppressed: plannerStateSnapshot.secondaryConcernSuppressed,
      narrowingLevel: hardDemandPriorityRef.current?.narrowingLevel || hardDemandState.narrowingLevel || 0,
      supersessionReason: hardDemandState.supersessionReason,
      lockedPlannerObjective: chosenResponseObjective,
      objectiveOverrideBlocked,
      hcpIdentitySource: canonicalHcpIdentity.hcpIdentitySource,
      hcpIdentityPreserved: true,
      hcpFallbackUsed: canonicalHcpIdentity.hcpFallbackUsed,
      cueDialogueAlignmentStatus: cueDialogueIntegrity.alignmentStatus,
      cueDialogueRepairs: cueDialogueIntegrity.repairs,
      cueIntent: cueDialogueIntegrity.cueIntent,
      dialogueIntent: cueDialogueIntegrity.dialogueIntent,
      repDomainStatus: domainIntegrityAtConstruction.repDomainStatus,
      contextContamination: domainIntegrityAtConstruction.contextContamination,
      scenarioReanchorRequired: domainIntegrityAtConstruction.scenarioReanchorRequired,
      contaminationReason: domainIntegrityAtConstruction.contaminationReason,
    });
    const verbalizedOperationalConstraintTypes = detectOperationalConstraintTypes(nextHcpDialogue);
    const previouslyVerbalizedOperationalConstraintTypes = [
      ...new Set(
        prevTurns.flatMap((turn) => Array.isArray(turn?.verbalizedOperationalConstraintTypes)
          ? turn.verbalizedOperationalConstraintTypes
          : detectOperationalConstraintTypes(turn?.hcpDialogueBefore || ""))
      ),
    ];
    const hcpReactionContract = buildHcpReactionContract({
      scenario: runtimeScenarioView,
      turnNumber: nextTurnNumber,
      hcpState: nextHcpState,
      cueText: contextualCue,
      cueMeaning: cueDialogueIntegrity.cueIntent,
      dialogueText: nextHcpDialogue,
      dialogueIntent: cueDialogueIntegrity.dialogueIntent,
      dialogueRegister: registerSelection.preferredRegister,
      dialogueBand: `${registerSelection.preferredRegister}:${primaryConcern}`,
      hardDemandState,
      activeConcern: primaryConcern,
      timePressureState: /time|impatient|disengaging|time-pressured/.test(`${nextHcpState} ${decayState.tier}`),
      coachingResult,
      alignment,
      scoringContext: scoringContextForReaction,
      priorEnforcementTrace: respondingToTurn?.hcpReactionContract?.enforcementTrace || {},
      concernFlowOutcome,
      repMessage,
      openingTurnConsumed: isFirstHcpResponse,
    });
    contextualCue = hcpReactionContract.selectedCueText || contextualCue;
    nextHcpDialogue = latestAskProtectedDialogue || hcpReactionContract.selectedDialogueText || nextHcpDialogue;
    nextHcpDialogue = stripSimulatorMetaDialogue(nextHcpDialogue);
    nextHcpDialogue = stripFollowUpAfterTerminalClose(nextHcpDialogue);

    const openingReplayCheck = detectOpeningSceneDialogueReplay({
      dialogueText: nextHcpDialogue,
      scenario,
    });
    if (
      openingReplayCheck.replayed
      && !isTerminalClosureDialogue(nextHcpDialogue)
    ) {
      usedDeterministicFallback = true;
      nextHcpDialogue = buildConstraintSafeRegeneratedResponse({
        fallbackResponse: chooseConcernSpecificVariant({
          concern: primaryConcern,
          seed: `${generationKey}:${nextTurnNumber}:${primaryConcern}:opening-replay-repair`,
          recentDialogues: recentHcpDialogues,
        }),
        concern: primaryConcern,
        includeWarmth: false,
        scenarioContext: visibleScenarioGroundingText,
      });
      nextHcpDialogue = stripFollowUpAfterTerminalClose(stripSimulatorMetaDialogue(nextHcpDialogue));
      emitPlannerTrace("opening_scene_dialogue_replay_repaired", {
        turnNumber: nextTurnNumber,
        activeConcern: primaryConcern,
        similarity: openingReplayCheck.similarity,
      });
    }

    const structuredScenarioLeakCheck = detectStructuredScenarioContentLeak({
      dialogueText: nextHcpDialogue,
      scenario,
      runtimeContract: roleplayTurnValidationContext.scenarioExecutionContract || runtimeScenarioContractRef.current,
    });
    if (
      structuredScenarioLeakCheck.leaked
      && !isTerminalClosureDialogue(nextHcpDialogue)
    ) {
      usedDeterministicFallback = true;
      nextHcpDialogue = repairStructuredScenarioContentLeak({
        dialogueText: nextHcpDialogue,
        scenario,
        runtimeContract: roleplayTurnValidationContext.scenarioExecutionContract || runtimeScenarioContractRef.current,
        fallbackDialogue: buildConstraintSafeRegeneratedResponse({
          fallbackResponse: groundedFallback,
          concern: primaryConcern,
          includeWarmth: false,
          scenarioContext: "",
        }),
      });
      nextHcpDialogue = stripFollowUpAfterTerminalClose(stripSimulatorMetaDialogue(nextHcpDialogue));
      emitPlannerTrace("structured_scenario_metadata_leak_repaired", {
        turnNumber: nextTurnNumber,
        activeConcern: primaryConcern,
        anchorHitCount: structuredScenarioLeakCheck.anchorHits.length,
        structuredLabelLeak: structuredScenarioLeakCheck.structuredLabelLeak,
        descriptorLeak: structuredScenarioLeakCheck.descriptorLeak,
      });
    }

    const finalDialogueBeforeRepeatRepair = nextHcpDialogue;
    const finalDialogueNeededRepair = !latestAskBoundDialogue
      && !isTerminalClosureDialogue(nextHcpDialogue)
      && (
        isRepeatedFinalDialogue(nextHcpDialogue, recentHcpDialogues)
        || isRepEchoInHcpDialogue({ dialogue: nextHcpDialogue, repMessage })
      );
    if (finalDialogueNeededRepair) {
      nextHcpDialogue = chooseConcernSpecificVariant({
        concern: primaryConcern,
        seed: `${generationKey}:${nextTurnNumber}:${primaryConcern}:final-repeat-repair`,
        recentDialogues: recentHcpDialogues,
      });
      nextHcpDialogue = stripFollowUpAfterTerminalClose(stripSimulatorMetaDialogue(nextHcpDialogue));
    }

    const finalStructuredScenarioLeakCheck = detectStructuredScenarioContentLeak({
      dialogueText: nextHcpDialogue,
      scenario,
      runtimeContract: roleplayTurnValidationContext.scenarioExecutionContract || runtimeScenarioContractRef.current,
    });
    if (finalStructuredScenarioLeakCheck.leaked && !isTerminalClosureDialogue(nextHcpDialogue)) {
      usedDeterministicFallback = true;
      nextHcpDialogue = repairStructuredScenarioContentLeak({
        dialogueText: nextHcpDialogue,
        scenario,
        runtimeContract: roleplayTurnValidationContext.scenarioExecutionContract || runtimeScenarioContractRef.current,
        fallbackDialogue: chooseConcernSpecificVariant({
          concern: primaryConcern,
          seed: `${generationKey}:${nextTurnNumber}:${primaryConcern}:final-structured-leak-repair`,
          recentDialogues: recentHcpDialogues,
        }),
      });
      nextHcpDialogue = stripFollowUpAfterTerminalClose(stripSimulatorMetaDialogue(nextHcpDialogue));
      emitPlannerTrace("final_structured_scenario_metadata_leak_repaired", {
        turnNumber: nextTurnNumber,
        activeConcern: primaryConcern,
        anchorHitCount: finalStructuredScenarioLeakCheck.anchorHits.length,
        structuredLabelLeak: finalStructuredScenarioLeakCheck.structuredLabelLeak,
        descriptorLeak: finalStructuredScenarioLeakCheck.descriptorLeak,
      });
    }

    let finalHcpReactionContract = nextHcpDialogue === hcpReactionContract.selectedDialogueText
      ? hcpReactionContract
      : {
          ...hcpReactionContract,
          selectedDialogueText: nextHcpDialogue,
          finalDialogueRepeatRepair: finalDialogueNeededRepair,
          finalDialogueBeforeRepeatRepair,
        };

    const hcpCueStateAlignment = selectStateAlignedHcpCue({
      existingCueText: contextualCue,
      preferStateDerived: true,
      activeHcpAsk: conversationActiveAskState?.askText || respondingToTurn?.hcpDialogueBefore || firstTurnOpeningContext || nextHcpDialogue,
      concernFamily: conversationIntelligenceState?.turnInterpretation?.concernFamily || primaryConcern,
      escalationStage: finalHcpReactionContract?.enforcementTrace?.escalationStage || nextHcpState,
      hcpState: nextHcpState,
      decayTier: decayState.tier,
      timePressure: Boolean(turnState.timePressure || scenarioPressured || /time|impatient|disengaging|time-pressured/.test(`${nextHcpState} ${decayState.tier} ${nextHcpDialogue}`)),
      terminal: Boolean(overrideExit || terminalDecisionMode || (nextHcpState === "disengaged") || (!blockClose && terminalPolicyAction === "close") || isTerminalClosureDialogue(nextHcpDialogue)),
      conversationIntelligenceState,
      validationOutput: preTurnValidation,
      dialogueText: nextHcpDialogue,
      scenarioId: scenario?.id || scenario?.scenarioId || scenario?.title || "scenario",
      turnNumber: nextTurnNumber,
    });
    const conversationalRealism = applyConversationalRealism({
      text: nextHcpDialogue,
      activeAsk: conversationActiveAskState?.askText || respondingToTurn?.hcpDialogueBefore || firstTurnOpeningContext || nextHcpDialogue,
      activeAskState: conversationActiveAskState,
      concernFamily: hcpCueStateAlignment.concernFamily || conversationIntelligenceState?.turnInterpretation?.concernFamily || primaryConcern,
      engagementTier: decayState.tier,
      interactionMode: finalHcpReactionContract?.enforcementTrace?.interactionMode || nextHcpState,
      semanticStage: finalHcpReactionContract?.enforcementTrace?.escalationStage || nextHcpState,
      terminalBehavior: Boolean(overrideExit || terminalDecisionMode || (nextHcpState === "disengaged") || (!blockClose && terminalPolicyAction === "close") || isTerminalClosureDialogue(nextHcpDialogue)),
      timePressure: Boolean(turnState.timePressure || scenarioPressured || /time|impatient|disengaging|time-pressured/.test(`${nextHcpState} ${decayState.tier} ${nextHcpDialogue}`)),
      cueCategory: hcpCueStateAlignment.cueCategory,
      conversationIntelligence: conversationIntelligenceState,
      recentHcpTurns: recentHcpDialogues,
      scenarioContext: visibleScenarioGroundingText,
      scenarioExecutionContract: roleplayTurnValidationContext.scenarioExecutionContract || null,
      requireContractBound: true,
    });
    const stateCompressedHcpDialogue = conversationalRealism?.text || nextHcpDialogue;
    if (stateCompressedHcpDialogue && stateCompressedHcpDialogue !== nextHcpDialogue) {
      finalHcpReactionContract = {
        ...finalHcpReactionContract,
        selectedDialogueText: stateCompressedHcpDialogue,
        finalDialogueBeforeStateCompression: nextHcpDialogue,
        conversationalRealism: conversationalRealism?.metadata || null,
      };
      nextHcpDialogue = stateCompressedHcpDialogue;
    } else {
      finalHcpReactionContract = {
        ...finalHcpReactionContract,
        conversationalRealism: conversationalRealism?.metadata || null,
      };
    }
    contextualCue = hardenTextSurface(hcpCueStateAlignment.cueText || contextualCue);
    finalHcpReactionContract = {
      ...finalHcpReactionContract,
      selectedCueText: contextualCue,
      cueStateAlignment: hcpCueStateAlignment,
      enforcementTrace: {
        ...(finalHcpReactionContract?.enforcementTrace || {}),
        cueStateAlignmentCategory: hcpCueStateAlignment.cueCategory,
        cueStateAlignmentConcernFamily: hcpCueStateAlignment.concernFamily,
      },
    };
    nextHcpDialogue = enforceSpokenOnlyHcpDialogue({
      text: nextHcpDialogue,
      concern: primaryConcern,
      repMessage,
      activeAsk: conversationActiveAskState?.askText || respondingToTurn?.hcpDialogueBefore || firstTurnOpeningContext || "",
      hcpState: nextHcpState,
      timePressure: Boolean(turnState.timePressure || scenarioPressured || /time|impatient|disengaging|time-pressured/.test(`${nextHcpState} ${decayState.tier}`)),
    });
    finalHcpReactionContract = {
      ...finalHcpReactionContract,
      selectedDialogueText: nextHcpDialogue,
    };
    nextTurn.cueBefore = contextualCue;
    nextTurn.hcpDialogueBefore = nextHcpDialogue;
    nextTurn.hcpReactionContract = finalHcpReactionContract;
    nextTurn.surfacedOperationalConstraintTypes = finalSurfacedConstraintTypes;
    nextTurn.plannerStateSnapshot = {
      ...nextTurn.plannerStateSnapshot,
      surfacedOperationalConstraintTypes: finalSurfacedConstraintTypes,
      groundedConstraintTypes,
      activeHardDemand: hardDemandState.activeHardDemand,
      hardDemandType: hardDemandState.hardDemandType,
      hardDemandSourceTurn: hardDemandState.hardDemandSourceTurn,
      hardDemandPriorityLock: hardDemandState.hardDemandPriorityLock,
      hardDemandUnresolved: hardDemandState.hardDemandUnresolved,
      hardDemandKept: plannerStateSnapshot.hardDemandKept,
      hardDemandReleaseReason: hardDemandState.hardDemandReleaseReason,
      pendingSecondaryConcerns: hardDemandState.pendingSecondaryConcerns,
      secondaryConcernBuffered: plannerStateSnapshot.secondaryConcernBuffered,
      secondaryConcernSuppressed: plannerStateSnapshot.secondaryConcernSuppressed,
      narrowingLevel: hardDemandPriorityRef.current?.narrowingLevel || hardDemandState.narrowingLevel || 0,
      supersessionReason: hardDemandState.supersessionReason,
      lockedPlannerObjective: chosenResponseObjective,
      objectiveOverrideBlocked,
      hcpIdentitySource: canonicalHcpIdentity.hcpIdentitySource,
      hcpIdentityPreserved: true,
      hcpFallbackUsed: canonicalHcpIdentity.hcpFallbackUsed,
      selectedDialogueRegister: registerSelection.preferredRegister,
      selectedDialogueIntent: cueDialogueIntegrity.dialogueIntent,
      cueDialogueAlignmentStatus: cueDialogueIntegrity.alignmentStatus,
      reactionContractHash: finalHcpReactionContract.reactionContractHash,
      repEvidenceContextHash: finalHcpReactionContract.repEvidenceContextHash,
      escalationStage: finalHcpReactionContract?.enforcementTrace?.escalationStage || 'open',
      escalationReason: finalHcpReactionContract?.enforcementTrace?.escalationReason || 'stable',
      toleranceScore: finalHcpReactionContract?.enforcementTrace?.toleranceScore ?? null,
      tonePressureLevel: finalHcpReactionContract?.enforcementTrace?.tonePressureLevel ?? null,
      repDomainStatus: finalHcpReactionContract?.enforcementTrace?.repDomainStatus || 'in_domain',
      contextContamination: Boolean(finalHcpReactionContract?.enforcementTrace?.contextContamination),
      scenarioDomain: finalHcpReactionContract?.enforcementTrace?.scenarioDomain || null,
      scenarioReanchorRequired: Boolean(finalHcpReactionContract?.enforcementTrace?.scenarioReanchorRequired),
    };
    nextTurn.plannerGapComparison = plannerGapComparison;

    const shouldEndSessionAfterTurn = overrideExit
      || (nextHcpState === "disengaged" && isTerminalClosureDialogue(nextHcpDialogue))
      || isTerminalDisengagementCue(contextualCue)
      || (!blockClose && terminalPolicyAction === "close");

    if (shouldEndSessionAfterTurn) {
      sessionControllerRef.current.state = SessionState.ENDED;
      sessionControllerRef.current.pendingResponseQueue = [];
    }

    if (requestId !== activeRequestIdRef.current || !sessionControllerRef.current.isActive) {
      return;
    }

    lateTurnConstraintStateRef.current = nextLateTurnConstraintState;
    hcpConstraintEngineRef.current = {
      activeConstraints: activeHcpConstraints,
    };

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
          hcpReactionContract: nextTurn.hcpReactionContract,
          conversationIntelligence: conversationIntelligenceState,
          chosenResponseObjective,
          intervention: interventionSnapshot,
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

    if (turn.hcpDialogueBefore || hasVisibleHcpCue(turn)) {
      items.push({ kind: 'hcp', key: `hcp-${turn.turnNumber}-${index}`, turn });
    }

    if (turn.repMessage) {
      items.push({ kind: 'rep', key: `rep-${turn.turnNumber}-${index}`, turn });
    }

    return items;
  });

  const repTurnsCount = turns.filter((t) => t.repMessage).length;
  // Keep live metrics calculations running for end-session scoring, but hide panel from rep view.
  const showLiveMetricsPanel = ENABLE_V2_INTERVENTION_UI;

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

      const structuredPrompt = `You are a skilled sales coach analyzing a roleplay simulation session. Ground ALL feedback in observable behavior only — never infer intent, emotion, or personality traits.\n${FEEDBACK_SOT}\n\nBASELINE EVALUATION CONTRACT:\n- Baseline ID: ${END_SESSION_EVALUATION_BASELINE.id}\n- Baseline Path: ${END_SESSION_EVALUATION_BASELINE.path}\n- Treat this end-of-session path as the canonical reference for final evaluation behavior.\n\nSESSION SCORING DATA (deterministic, turn-by-turn):\nDeterministic session alignment summary (non-numeric): use only the qualitative findings below\n${capSummary}\n\nPOSITIVES OBSERVED (turn-by-turn):\n${allPositives.length > 0 ? allPositives.slice(0, 10).map(p => `• ${p}`).join('\n') : '• None detected'}\nMISALIGNMENTS OBSERVED (turn-by-turn):\n${allMisalignments.length > 0 ? allMisalignments.slice(0, 10).map(m => `• ${m}`).join('\n') : '• None detected'}\n${rubricSection}\n\nSession Context:\nScenario: ${scenario.title}\nHCP Type: ${scenario.hcp_category}\nDifficulty: ${scenario.difficulty}\n\nConversation Transcript:\n${historyText}\n\nRespond with PLAIN TEXT (no markdown, no special formatting). Provide exactly 4 sections separated by the exact delimiter "[SECTION_END]":\nSECTION 1: STRENGTHS (observable behaviors showing strong capability performance)\n[SECTION_END]\nSECTION 2: IMPROVEMENTS (specific capability gaps and areas to develop)\n[SECTION_END]\nSECTION 3: PATTERNS (notable signal-response alignment patterns and behaviors)\n[SECTION_END]\nSECTION 4: ACTION ITEMS (2-3 specific behavioral changes for next session)\n[SECTION_END]\nCRITICAL RULES:\n- Do NOT include numeric scores\n- Each section is plain text (no markdown, no bullet points in the response text)\n- Separate sections with EXACTLY "[SECTION_END]"\n- All feedback must be observable and specific`;
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
        const rawContent = normalizeLlmInvokeText(data);
        const parsed = parseStructuredFeedback(rawContent);
        const coachingFeedback = buildCoachingFeedbackMarkdown(parsed);
        setFeedback(enforceFeedbackEvidenceRules(coachingFeedback, runtimeScenarioContractRef.current));
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
            <div className="relative flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto px-3 md:px-5 py-4 pb-28 flex flex-col gap-4">

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
                      {SHOW_VISIBLE_HCP_CUES && hasVisibleHcpCue(turn) && (() => {
                        const cueSummary = buildVisibleHcpCueSummary(turn, hcpDisplayName);
                        return (
                          <div className="pl-1 w-fit max-w-[92%] md:max-w-[82%]">
                            <div className="w-fit max-w-full text-xs leading-snug px-3 py-2 rounded-lg border whitespace-normal break-words" style={{ color: "#7B1F1F", borderColor: "#D7B7B7", background: "#F9F5F5" }}>
                              <div className="font-semibold tracking-wide uppercase text-[10px] mb-1">HCP Cues</div>
                              <div className="hcp-cue-predicted-state">- Predicted State: {cueSummary.predictedState}</div>
                              <div className="hcp-cue-openness">- Openness: {cueSummary.openness}</div>
                              <div className="hcp-cue-trajectory">- Trajectory: {cueSummary.trajectory}</div>
                              <div className="hcp-cue-risk">- Risk: {cueSummary.risk}</div>
                              <div className="hcp-cue-behavioral-notes">- Behavioral Notes: {cueSummary.behavioralNotes || "Listening for the rep's opening move."}</div>
                            </div>
                          </div>
                        );
                      })()}
                      {turn.hcpDialogueBefore && (
                        <div className="flex items-start">
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold mr-2 flex-shrink-0 mt-1" title={hcpDisplayName}>HCP</div>
                          <div className="hcp-dialogue max-w-[98%] rounded-2xl px-3 md:px-4 py-2.5 text-sm leading-relaxed bg-slate-200/90 text-slate-800 whitespace-normal break-words">
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
              <div className="absolute bottom-0 left-0 right-0 px-3 md:px-5 py-3 border-t flex-shrink-0 z-10 bg-white pb-[max(12px,env(safe-area-inset-bottom))]">
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (isLoading || isEnding || conversationTerminalClosed) return;
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
                    disabled={isLoading || isEnding || conversationTerminalClosed}
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
                  {/* Voice session controls (rep only) */}
                  {!voiceSessionActive && !voiceSessionEnded && (
                    <Button
                      type="button"
                      className="ml-2 px-3 py-1 rounded bg-teal-600 text-white hover:bg-teal-700"
                      onClick={startVoiceSession}
                    >
                      Start Voice Session
                    </Button>
                  )}
                  {voiceSessionActive && (
                    <Button
                      type="button"
                      className="ml-2 px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                      onClick={handleEndVoiceSession}
                    >
                      End Voice Session (Rep Only)
                    </Button>
                  )}
                  <Button type="submit" disabled={isLoading || isEnding || conversationTerminalClosed || (!sanitizeUserMessage(input) && !interim)} style={{ background: "#39ACAC" }} className="hover:opacity-90 text-white px-4 py-2 rounded">
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
            </div>
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
                <CapabilityFeedbackPanel
                  messages={flatMessages}
                  turns={turns}
                  scenario={scenario}
                  voiceSessionEvaluation={voiceSessionEvaluation}
                />
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
