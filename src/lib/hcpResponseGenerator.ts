// ⚠️ LOCKED BASELINE — CONVERSATIONAL REALISM ANCHOR
// Restored from commit 3b5aafa
// Requirements:
// 1) First-turn must acknowledge REP opener
// 2) Preserve conversational bridges (Okay—, I hear you—, etc.)
// 3) DO NOT allow domain/decision layers to override first sentence
// Any changes must pass manual first-turn test before commit
/**
 * HCP Response Generator
 * =====================
 * Generates HCP replies, behavior signals, and coaching nudges via LLM.
 * Full prompt with global behavior maps, capability rules, volatility, curveballs.
 */

import { invokeWorkerJson, invokeWorkerText } from "@/services/workerClient";
import {
  BehaviorSignals,
  SimulatorResponse,
  ConversationTurn,
  VolatilityProfile,
  VolatilityState,
  CoachingNudge,
} from "./simulatorEngine";
import { computeVolatility } from "./simulatorEngine";
import { predictHcpBehavior } from "./hcpBehaviorPrediction";
import { resolveObservedCue } from "./hcpCueGenerator";
import { SIGNAL_INTELLIGENCE_CAPABILITIES } from "./signalIntelligence";
import { buildDialogueDirectivePrompt } from "./hcpDialogueDirectives";
import { buildRuntimeProfilePrompt, deriveHcpRuntimeProfile } from "./hcpRuntimeProfiles";
import { buildTurnDirectivePrompt, deriveHcpTurnDirectives } from "./hcpTurnDirectives";
import { applyHcpResponseSurface } from "./hcpResponseSurface";
import { buildRealismBackbonePrompt } from "./hcpRealismBackbone";
import { scenarioMatchesConcernFamily } from "./scenarioFamilyRegistry";
import { deriveUISelectionFromBrain, mapUIToBrain, requireRealismContract } from "./scenarioInputResolver";

export const HCP_GENERATOR_VERSION = "runtime-contract-v2";
const HCP_PRIMARY_TIMEOUT_MS = 18000;
const HCP_REWRITE_TIMEOUT_MS = 6000;

type RuntimeTemperatureBand = "low" | "medium" | "high";
type PostLlmRewriteKind = "naturalness" | "spoken_style" | "context_consistency";

type EscalationMemory = {
  repeatedRepPatternCount: number;
  unansweredQuestionCount: number;
  genericAfterSpecificityCount: number;
  lastRepIntent: string;
  escalationLevel: number;
  shouldEscalateThisTurn: boolean;
  action: "restate" | "sharpen" | "reveal_barrier" | "acknowledge_progress" | "move_next_step" | "disengage";
  reasons: string[];
};

const GLOBAL_STOCK_PHRASE_PATTERNS = [
  /\bwhat['’]?s concretely different for me after this\b/i,
  /\bthe practical answer has to stay tied\b/i,
  /\bwhat changes in practice if this is worth continuing\b/i,
  /\bi hear that a lot\b/i,
  /\bkeep this brief\b/i,
  /\bi['’]?m not convinced yet\b/i,
];

const capabilityCompactRef = SIGNAL_INTELLIGENCE_CAPABILITIES.map(c =>
  `[${c.id}] ${c.metric} — ${c.definition.slice(0, 120)}`
).join("\n");

const CAPABILITY_RULES = `
CAPABILITY EVALUATION RULES (deterministic — apply strictly using canonical metric names):

1. question_quality — Metric: Question Quality (Signal Awareness)
   effective: questions reflect current HCP context and move conversation toward decision/clarification/next step
   developing: questions have some value but are generic, closed, or not fully targeted to HCP's stated context
   missed: questions are absent, leading, redundant, or fail to advance understanding in any direction

2. listening_responsiveness — Metric: Listening & Responsiveness (Signal Interpretation)
   effective: rep correctly interprets what HCP communicated AND responds in a way that clearly reflects that understanding
   developing: interpretation is partial or response is only loosely aligned with what HCP actually said
   missed: rep misinterprets, ignores, or talks past HCP's actual input — response does not reflect what was communicated

3. customer_engagement_signals — Metric: Customer Engagement Cues (Customer Engagement Monitoring)
   effective: rep notices shifts in HCP participation and conversational momentum and adjusts accordingly
   developing: rep partially notices engagement shifts but does not consistently adjust
   missed: rep continues without adjustment despite observable changes in HCP participation or momentum

4. making_it_matter — Metric: Value Framing (Value Connection)
   effective: rep connects information to HCP's stated priorities AND translates into clear customer outcomes
   developing: rep attempts relevance but stays abstract or incomplete — does not clearly articulate outcome implication
   missed: rep stays generic, product-led, or disconnected from HCP's real-world context — no explicit relevance established

5. objection_navigation — Metric: Objection Handling (Objection Navigation)
   effective: rep maintains composure AND explores objection before responding — sustaining productive dialogue
   developing: rep acknowledges objection but moves too quickly to justification or resolution
   missed: rep becomes defensive, dismissive, or fails to engage the underlying concern constructively

6. conversation_control_structure — Metric: Conversation Control & Structure (Conversation Management)
   effective: rep provides clear directional intent and adjusts structure appropriately as conversation evolves
   developing: structure exists but is inconsistent, uneven, or insufficiently adaptive to new input
   missed: conversation drifts without recovery, becomes rep-dominated, or loses coherent purpose

7. adaptability — Metric: Adaptability (Adaptive Response)
   effective: rep recognizes changes in interaction AND makes timely, appropriate adjustments to approach
   developing: some adjustment occurs but is either insufficiently responsive or not well-calibrated to situation
   missed: rep repeats same approach despite observable changes in conditions, constraints, or HCP direction

8. commitment_gaining — Metric: Commitment Gaining (Commitment Generation)
   effective: rep establishes specific, concrete next action that HCP voluntarily owns
   developing: rep hints at or suggests next steps but does not clearly secure customer ownership
   missed: no meaningful next-step attempt — conversation ends without clarity or customer commitment
`;

const ABSTRACT_BURDEN_PATTERNS = [
  /\babsorb(?:ing|ed)?\b/i,
  /\bcarry(?:ing|ies)?\b/i,
  /\bhandle(?:ing|d)?\b/i,
  /\bchanges? in (?:their|our|my) day\b/i,
  /\bover time\b/i,
  /\bburden\b/i,
  /\bworkload\b/i,
];

const CASUAL_DRIFT_PATTERNS = [
  /\bat a bar\b/i,
  /\bon vacation\b/i,
  /\bno worries\b/i,
  /\bno problem at all\b/i,
  /\bhappy to chat\b/i,
  /\blove to\b/i,
  /\bsounds good\b/i,
];

const CHATBOT_STYLE_PATTERNS = [
  /\bi appreciate your willingness\b/i,
  /\bi understand your concern, and\b/i,
  /\bi'm not sure i'm comfortable with the potential risks\b/i,
  /\bparticularly in patients with\b/i,
  /\bi(?:'d| would) like to confirm\b/i,
  /\bsignificant impact on (?:your|our|my) (?:daily )?workflow\b/i,
  /\bcan you tell me what specific\b/i,
  /\bwhat specific steps?(?: or processes)?\b/i,
  /\badministrative burden\b/i,
  /\bcan you show me some real-world examples of how this treatment has been used safely\b/i,
  /\bwhat specific aspects of\b/i,
  /\bhow would you like to see\b/i,
  /\bthis will help me better understand\b/i,
  /\bi want to make sure i understand\b/i,
  /\bto be honest, the biggest challenge i'm seeing is\b/i,
];

type HcpEngagementState = "Resistant" | "Neutral" | "Selectively Engaged" | "Engaged";
type HcpTrustLevel = "Low" | "Medium" | "High";
type HcpIntent = "Deflect" | "Test" | "Clarify" | "Advance";

type TurnConstraintResolution = {
  engagementState: HcpEngagementState;
  trustLevel: HcpTrustLevel;
  resolvedIntent: HcpIntent;
  allowedIntents: HcpIntent[];
  blockedIntents: HcpIntent[];
  allowedTone: string[];
  progressionGuardrails: string[];
  reasoning: string[];
};

type FirstTurnRepTopic = "study_follow_up" | "access" | "workflow" | "screening" | "evidence" | "clinical_value" | "general";

type FirstTurnAlignmentResult = {
  applied: boolean;
  hcpReply: string;
  cueOverride: string;
};

function stepWithin<T>(ordered: readonly T[], current: T, delta: number): T {
  const index = ordered.indexOf(current);
  const safeIndex = index < 0 ? 0 : index;
  const next = Math.max(0, Math.min(ordered.length - 1, safeIndex + delta));
  return ordered[next];
}

function deriveBaseEngagementState(currentBehaviorState: string, predictedBehaviorState: string): HcpEngagementState {
  const behavior = String(currentBehaviorState || "").toLowerCase();
  const predicted = String(predictedBehaviorState || "").toLowerCase();

  if (["resistance", "closed", "time_pressure", "frustration"].includes(behavior) || ["resistance", "frustration"].includes(predicted)) {
    return "Resistant";
  }
  if (predicted === "openness") return "Engaged";
  if (predicted === "curiosity") return "Selectively Engaged";
  return "Neutral";
}

function deriveBaseTrustLevel(currentBehaviorState: string, predictedResistanceLevel: string): HcpTrustLevel {
  const behavior = String(currentBehaviorState || "").toLowerCase();
  const resistance = String(predictedResistanceLevel || "").toLowerCase();

  if (["closed", "resistance", "frustration", "time_pressure"].includes(behavior) || resistance === "high") {
    return "Low";
  }
  if (resistance === "low") return "High";
  return "Medium";
}

function latestHcpQuestion(transcript: ConversationTurn[]): string {
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    if (transcript[i]?.speaker !== "hcp") continue;
    const text = String(transcript[i]?.text || "").trim();
    if (text.includes("?")) return text;
  }
  return "";
}

function repAcknowledgesConcern(repMessage: string): boolean {
  return /\b(i hear|i understand|that makes sense|you'?re right|fair point|i get that|you raised|you mentioned)\b/i.test(String(repMessage || ""));
}

function repProvidesRelevantValue(repMessage: string, latestConcern: string): boolean {
  const repText = String(repMessage || "");
  const repTags = inferConcernTags(repText);
  const concernTags = inferConcernTags(latestConcern);
  const shared = concernTags.filter((tag) => repTags.includes(tag));
  if (shared.length > 0) return true;
  return /\b(outcome|evidence|data|workflow|prior auth|approval|staff|patient profile|subgroup|decision)\b/i.test(repText);
}

function countRecentMissedCues(allPriorSignals: BehaviorSignals[]): number {
  const window = allPriorSignals.slice(-3);
  return window.filter((signal) =>
    signal?.response_alignment === "weak" || signal?.listening_pattern === "missed"
  ).length;
}

function repAnsweredDirectQuestion(repMessage: string, transcript: ConversationTurn[], latestConcern: string): boolean {
  const hcpQuestion = latestHcpQuestion(transcript);
  if (!hcpQuestion) return false;

  const repTags = inferConcernTags(repMessage);
  const questionTags = inferConcernTags(hcpQuestion);
  const concernTags = inferConcernTags(latestConcern);
  const sharedWithQuestion = questionTags.filter((tag) => repTags.includes(tag));
  const sharedWithConcern = concernTags.filter((tag) => repTags.includes(tag));
  const genericLoop = isGenericDiscoveryLoop(repMessage, latestConcern);

  return !genericLoop && (sharedWithQuestion.length > 0 || sharedWithConcern.length > 0);
}

function isGenericDiscoveryLoop(repMessage: string, latestConcern: string): boolean {
  const text = String(repMessage || "").toLowerCase();
  const concernTags = inferConcernTags(latestConcern);
  const repTags = inferConcernTags(text);
  const shared = concernTags.filter((tag) => repTags.includes(tag));

  const genericDiscovery = /\b(can you tell me more|tell me more|what are your challenges|what else concerns you|what are your thoughts|help me understand)\b/i.test(text);
  return genericDiscovery && shared.length === 0;
}

function resolveAllowedIntent(engagementState: HcpEngagementState, trustLevel: HcpTrustLevel): {
  resolvedIntent: HcpIntent;
  allowedIntents: HcpIntent[];
  blockedIntents: HcpIntent[];
  allowedTone: string[];
} {
  if (engagementState === "Resistant" && trustLevel === "Low") {
    return {
      resolvedIntent: "Test",
      allowedIntents: ["Deflect", "Test", "Clarify"],
      blockedIntents: ["Advance"],
      allowedTone: ["guarded", "skeptical", "direct"],
    };
  }

  if (engagementState === "Resistant") {
    return {
      resolvedIntent: "Test",
      allowedIntents: ["Test", "Clarify"],
      blockedIntents: ["Advance", "Deflect"],
      allowedTone: ["skeptical", "constrained", "professional"],
    };
  }

  if (engagementState === "Neutral") {
    return {
      resolvedIntent: "Clarify",
      allowedIntents: ["Test", "Clarify"],
      blockedIntents: ["Advance"],
      allowedTone: ["neutral", "selective", "professional"],
    };
  }

  if (engagementState === "Selectively Engaged") {
    return {
      resolvedIntent: "Clarify",
      allowedIntents: ["Test", "Clarify"],
      blockedIntents: ["Advance"],
      allowedTone: ["conditionally open", "probing", "practical"],
    };
  }

  return {
    resolvedIntent: "Advance",
    allowedIntents: ["Clarify", "Advance"],
    blockedIntents: ["Deflect"],
    allowedTone: ["collaborative", "specific", "decision-oriented"],
  };
}

function resolveTurnConstraintState({
  transcript,
  repMessage,
  latestConcern,
  allPriorSignals,
  currentBehaviorState,
  prediction,
}: {
  transcript: ConversationTurn[];
  repMessage: string;
  latestConcern: string;
  allPriorSignals: BehaviorSignals[];
  currentBehaviorState: string;
  prediction: any;
}): TurnConstraintResolution {
  const engagementOrder: readonly HcpEngagementState[] = ["Resistant", "Neutral", "Selectively Engaged", "Engaged"];
  const trustOrder: readonly HcpTrustLevel[] = ["Low", "Medium", "High"];

  let engagementState = deriveBaseEngagementState(currentBehaviorState, prediction?.predictedBehaviorState || "");
  let trustLevel = deriveBaseTrustLevel(currentBehaviorState, prediction?.predictedResistanceLevel || "moderate");

  const acknowledgement = repAcknowledgesConcern(repMessage);
  const relevantValue = repProvidesRelevantValue(repMessage, latestConcern);
  const missedCue = ignoredDirectConcern(repMessage, latestConcern);
  const repeatedMissedCues = countRecentMissedCues(allPriorSignals);
  const answeredQuestion = repAnsweredDirectQuestion(repMessage, transcript, latestConcern);
  const genericLoop = isGenericDiscoveryLoop(repMessage, latestConcern);
  const reasoning: string[] = [];

  if (acknowledgement && relevantValue && !missedCue) {
    engagementState = stepWithin(engagementOrder, engagementState, 1);
    reasoning.push("Acknowledgement + relevant value + no missed cue allowed one-step engagement increase.");
  }

  if (repeatedMissedCues >= 2 || missedCue) {
    engagementState = stepWithin(engagementOrder, engagementState, -1);
    trustLevel = stepWithin(trustOrder, trustLevel, -1);
    reasoning.push("Repeated missed cues degraded engagement/trust by one level.");
  }

  if (answeredQuestion && !genericLoop) {
    trustLevel = stepWithin(trustOrder, trustLevel, 1);
    reasoning.push("Direct answer to HCP question increased trust by one level.");
  }

  if (genericLoop) {
    trustLevel = stepWithin(trustOrder, trustLevel, 0);
    reasoning.push("Generic discovery loop cannot increase trust.");
  }

  const intent = resolveAllowedIntent(engagementState, trustLevel);

  return {
    engagementState,
    trustLevel,
    resolvedIntent: intent.resolvedIntent,
    allowedIntents: intent.allowedIntents,
    blockedIntents: intent.blockedIntents,
    allowedTone: intent.allowedTone,
    progressionGuardrails: [
      "No engagement jump greater than one level in a single turn.",
      "Resistant to Engaged requires acknowledged concern + relevant value + no missed cue.",
      "Generic discovery without specificity cannot increase trust.",
    ],
    reasoning,
  };
}

function buildTurnConstraintPromptBlock(constraint: TurnConstraintResolution): string {
  return [
    "TURN-LEVEL HCP CONSTRAINTS (deterministic - must obey):",
    `- Engagement State: ${constraint.engagementState}`,
    `- Trust Level: ${constraint.trustLevel}`,
    `- Required Intent: ${constraint.resolvedIntent}`,
    `- Allowed Intents: ${constraint.allowedIntents.join(", ")}`,
    `- Blocked Intents: ${constraint.blockedIntents.join(", ")}`,
    `- Allowed Tone: ${constraint.allowedTone.join(", ")}`,
    ...constraint.progressionGuardrails.map((line) => `- ${line}`),
    ...constraint.reasoning.map((line) => `- Reasoning: ${line}`),
    "- Do not emit agreement, commitment, or cooperative exploration when blocked above.",
    "- If state is Selectively Engaged, keep response conditional/probing rather than fully cooperative.",
  ].join("\n");
}

function inferIntentFromReply(hcpReply: string): HcpIntent {
  const text = String(hcpReply || "").toLowerCase();
  if (/\b(i'?m open to|let'?s move forward|we can proceed|i can move ahead|i'll do that|i can start)\b/.test(text)) {
    return "Advance";
  }
  if (/\b(not now|not interested|no time|we'?re done|leave it there|not the right time)\b/.test(text)) {
    return "Deflect";
  }
  if (/\b(what evidence|show me|why should|what makes you think|convince me|what specifically)\b|\?/.test(text)) {
    return "Test";
  }
  return "Clarify";
}

function containsForwardCommitment(hcpReply: string): boolean {
  return /\b(let'?s do it|i'?ll start|i'?m ready|i can commit|go ahead and set it up|move forward with this)\b/i.test(String(hcpReply || ""));
}

function violatesTurnConstraint(hcpReply: string, constraint: TurnConstraintResolution): boolean {
  const intent = inferIntentFromReply(hcpReply);
  if (!constraint.allowedIntents.includes(intent)) return true;
  if (constraint.blockedIntents.includes("Advance") && containsForwardCommitment(hcpReply)) return true;
  if (constraint.engagementState === "Selectively Engaged" && containsForwardCommitment(hcpReply)) return true;
  return false;
}

async function rewriteForConstraintCompliance({
  hcpReply,
  constraint,
  scenario,
}: {
  hcpReply: string;
  constraint: TurnConstraintResolution;
  scenario: any;
}): Promise<string> {
  const prompt = `You are correcting one HCP reply line to match deterministic behavioral constraints.

Current line:
${hcpReply}

Required constraints:
- Engagement State: ${constraint.engagementState}
- Trust Level: ${constraint.trustLevel}
- Allowed Intents: ${constraint.allowedIntents.join(", ")}
- Blocked Intents: ${constraint.blockedIntents.join(", ")}
- Allowed Tone: ${constraint.allowedTone.join(", ")}

Hard rules:
- Keep same concern family and scenario context
- Keep natural spoken clinician style
- 1-2 sentences only
- Remove any blocked intent (especially premature agreement/commitment)
- Keep conditional/probing stance unless Advance is allowed

Scenario: ${scenario?.title || ""}

Return ONLY the corrected HCP line.`;

  const rewritten = await invokeWorkerText({
    prompt,
    max_tokens: 110,
    temperature: 0.1,
  });

  return String(rewritten || hcpReply).trim();
}

function deterministicConstraintFallback(hcpReply: string, constraint: TurnConstraintResolution): string {
  const base = String(hcpReply || "").replace(/\s+/g, " ").trim().replace(/[.?!]+$/, "");
  if (constraint.blockedIntents.includes("Advance") && containsForwardCommitment(base)) {
    if (constraint.engagementState === "Resistant") {
      return `${base}. I'm not ready to move this forward yet.`;
    }
    if (constraint.engagementState === "Selectively Engaged") {
      return `${base}. I'm open to clarifying one point first before any next step.`;
    }
    return `${base}. I need one concrete clarification before we discuss next steps.`;
  }
  return `${base}.`;
}

async function regenerateWithPredictiveBrain({
  currentLine,
  reason,
  predictiveContext,
  scenario,
  repMessage,
  transcript,
  escalationMemory,
  missingPressures = [],
  behaviorState,
  currentJourneyState,
}: {
  currentLine: string;
  reason: string;
  predictiveContext: string;
  scenario: any;
  repMessage: string;
  transcript: ConversationTurn[];
  escalationMemory: EscalationMemory;
  missingPressures?: string[];
  behaviorState: string;
  currentJourneyState: string;
}): Promise<string> {
  const previousHcpLine = getLastHcpReplyText(transcript);
  const prompt = `Rewrite one HCP spoken line. The Predictive HCP Brain is the source of truth.

Reason this line needs regeneration:
${reason}

Predictive HCP Brain:
${predictiveContext || "Not provided; use scenario metadata only."}

Scenario:
- Title: ${scenario?.title || ""}
- Stakeholder: ${scenario?.stakeholder || ""}
- Persona: ${scenario?.persona || ""}
- Journey Stage: ${scenario?.journeyStage || ""}
- Current Journey State: ${currentJourneyState}
- Behavior State: ${behaviorState}
- Interaction Pressures: ${(scenario?.interactionPressure || []).join(", ") || "none"}
- Opening Scene: ${scenario?.visualScene || scenario?.openingScene || "not provided"}

Turn memory:
- Previous HCP line: ${previousHcpLine || "none"}
- Latest REP message: ${repMessage}
- Escalation Level: ${escalationMemory.escalationLevel}/3
- Escalation Action: ${escalationMemory.action}
- Escalation Reasons: ${escalationMemory.reasons.join(", ") || "none"}
- Missing pressure anchors to restore naturally: ${missingPressures.join(", ") || "none"}

Current line:
${currentLine}

Hard rules:
- Author as this specific HCP, not as a simulator guardrail.
- Do not use global stock phrases or training-language scaffolding.
- Do not repeat the previous HCP sentence.
- Do not concatenate old and new lines.
- Keep the same scenario topic lane and the same unresolved concern.
- If escalation is level 2 or 3, show the consequence in this HCP's own words.
- 1-2 sentences maximum, natural spoken clinician English.

Return ONLY the corrected HCP line.`;

  const rewritten = await invokeWorkerText({
    prompt,
    max_tokens: 130,
    temperature: 0.16,
    timeout_ms: HCP_REWRITE_TIMEOUT_MS,
    retry_count: 1,
  });

  return String(rewritten || currentLine).trim();
}

function buildBrainGroundedScenarioFallback({
  scenario,
  repMessage,
  escalationMemory,
  missingPressures = [],
}: {
  scenario: any;
  repMessage: string;
  escalationMemory: EscalationMemory;
  missingPressures?: string[];
}): string {
  const pressures = new Set([
    ...(Array.isArray(scenario?.interactionPressure) ? scenario.interactionPressure : []),
    ...missingPressures,
  ].map((value) => String(value || "").toLowerCase()));
  const intent = inferRepIntent(repMessage);
  const domain = String(scenario?.predictiveSeed?.diseaseState || scenario?.disease_state || scenario?.specialty || "").replace(/_/g, " ");
  const role = String(scenario?.stakeholder || scenario?.hcpRoleType || "clinician");
  const prefix = pressures.has("time_constrained")
    ? "I have a narrow window here."
    : pressures.has("skeptical_resistant")
      ? "I need this tied to the patients I actually manage."
      : `From where I sit as the ${role}, I need this to stay practical.`;

  const concern =
    intent === "access" || pressures.has("access_barrier")
      ? "Tell me which part of the approval path moves and who handles it."
      : intent === "workflow" || pressures.has("operationally_constrained") || pressures.has("workflow_pressure")
        ? "Tell me which staff step gets easier before I add another task."
        : intent === "evidence"
          ? `Show me the evidence that applies to this ${domain || "patient"} population.`
          : intent === "safety"
            ? "Start with the safety tradeoff for the patients with comorbidities."
            : "Narrow this to the specific patient decision you want me to reconsider.";

  if (escalationMemory.escalationLevel >= 3) {
    return `${prefix} ${concern} Otherwise, this probably is not worth continuing today.`;
  }
  if (escalationMemory.escalationLevel >= 2) {
    return `${prefix} ${concern}`;
  }
  return `${prefix} ${concern}`;
}

function deriveRealismConcernFamily(scenario: any, hcpReply = ""): "evidence" | "workflow" | "access" | "time" | "screening" | "general" {
  const text = [
    scenario?.title,
    scenario?.journeyStage,
    scenario?.objective,
    scenario?.description,
    scenario?.openingScene,
    hcpReply,
    ...(Array.isArray(scenario?.interactionPressure) ? scenario.interactionPressure : []),
  ].filter(Boolean).join(" ").toLowerCase();
  if (/\bprior auth|coverage|formulary|payer|approval|access\b/.test(text)) return "access";
  if (/\bstaff|workflow|handoff|callback|process|clinic|ma\b/.test(text)) return "workflow";
  if (/\btime|minute|schedule|waiting|brief|quick\b/.test(text)) return "time";
  if (/\bpatient fit|which patient|screen|selection|candidate|profile\b/.test(text)) return "screening";
  if (/\btrial|study|data|evidence|guideline|subgroup|endpoint|outcome|hazard ratio|renal\b/.test(text)) return "evidence";
  return "general";
}

function buildRealismSpecificAsk(scenario: any, hcpReply = ""): string {
  const family = deriveRealismConcernFamily(scenario, hcpReply);
  const scenarioText = `${scenario?.openingScene || ""} ${scenario?.description || ""}`.toLowerCase();
  const renal = /\brenal|kidney|ckd|impairment\b/.test(scenarioText);
  const pressures = Array.isArray(scenario?.interactionPressure)
    ? scenario.interactionPressure.map((value: string) => String(value).toLowerCase())
    : [];
  if (isInitialAccessStage(scenario)) {
    if (pressures.includes("time_constrained") && pressures.includes("operationally_constrained")) {
      return "the short version before my next patient and what changes for my staff";
    }
    if (pressures.includes("time_constrained")) return "the short version before my next patient";
    if (pressures.includes("operationally_constrained")) return "what changes for my staff in practical terms";
    return "why this is worth opening a conversation";
  }
  if (isEarlyDiscoveryStage(scenario)) {
    return "the patient profile you actually want me to think about";
  }
  if (family === "access") return "the exact approval path and what changes for staff";
  if (family === "workflow") return "the staff step that changes and who owns it";
  if (family === "time") return "the one point that matters before I get back to patients";
  if (family === "screening") return "the patient profile that changes the decision";
  if (family === "evidence") {
    return renal
      ? "the renal subgroup, endpoint, and treatment-decision threshold"
      : "the trial subgroup, endpoint, and treatment-decision threshold";
  }
  return "the specific decision you want me to reconsider";
}

function lineAlreadyShowsRealism({ hcpReply, temperatureBand, escalationMemory }: {
  hcpReply: string;
  temperatureBand: RuntimeTemperatureBand;
  escalationMemory: EscalationMemory;
}): boolean {
  const text = String(hcpReply || "").toLowerCase();
  if (temperatureBand === "low") {
    return !/\byou'?re not answering|we can stop|not worth continuing|same point again|stop here\b/i.test(text);
  }
  if (temperatureBand === "medium") {
    if (escalationMemory.escalationLevel === 0) return true;
    return /\btoo broad|specific|still need|doesn'?t answer|threshold|subgroup|endpoint|step|staff|approval\b/i.test(text);
  }
  if (escalationMemory.escalationLevel === 0) {
    return /\bnot convinced|broad|threshold|subgroup|endpoint|specific|approval|staff\b/i.test(text);
  }
  return /\byou'?re not answering|too broad|already|stop|not worth continuing|same point|specific|threshold|subgroup|endpoint|approval|staff\b/i.test(text);
}

function buildStageBoundRealismReply({
  scenario,
  temperatureBand,
  escalationMemory,
  ask,
  transcript,
  currentLine,
}: {
  scenario: any;
  temperatureBand: RuntimeTemperatureBand;
  escalationMemory: EscalationMemory;
  ask: string;
  transcript: ConversationTurn[];
  currentLine: string;
}): string {
  const pressures = Array.isArray(scenario?.interactionPressure)
    ? scenario.interactionPressure.map((value: string) => String(value).toLowerCase())
    : [];
  const timeConstrained = pressures.includes("time_constrained");
  const operational = pressures.includes("operationally_constrained");
  const repeatCount = Math.max(0, Number(escalationMemory.repeatedRepPatternCount || 0));
  const choose = (variants: string[], suffix: string) => {
    const recent = getRecentVisibleHcpReplies(transcript, 8);
    const seed = `${scenario?.id || scenario?.title || "scenario"}|${temperatureBand}|${escalationMemory.escalationLevel}|${repeatCount}|${transcript.length}|${currentLine}|${suffix}`;
    const start = deterministicIndex(seed, variants.length);
    for (let offset = 0; offset < variants.length; offset += 1) {
      const candidate = variants[(start + offset) % variants.length];
      const repeated = recent.some((line) =>
        normalizeLineForContinuity(line) === normalizeLineForContinuity(candidate) ||
        continuityOverlapScore(line, candidate) >= 0.82 ||
        continuityContainmentScore(line, candidate) >= 0.86
      );
      if (!repeated) return candidate;
    }
    const fallbackVariants = (() => {
      if (isInitialAccessStage(scenario)) {
        if (timeConstrained && operational) {
          return [
            "We have covered the setup. Before I get back to patients, name the staff change.",
            "I am going to stop here unless you give me the staff change.",
            "One last pass before I move on: what changes for my staff?",
          ];
        }
        if (timeConstrained) {
          return [
            "We have covered the setup. Give me one useful point before I get back to patients.",
            "I am going to stop here unless you make the short point clear.",
            "One last pass before I move on: what is the point?",
          ];
        }
        return [
          "We have covered the broad point. Make the practical change concrete.",
          "I am going to stop here unless there is a concrete office reason.",
          "One last pass: what actually changes?",
        ];
      }
      if (isEarlyDiscoveryStage(scenario)) {
        return [
          "We have covered the broad point. Name the patient profile or we should pause.",
          "I am going to pause here unless you can narrow the patient type.",
          "One last pass: which patients are we actually talking about?",
        ];
      }
      return variants;
    })();
    for (let offset = 0; offset < fallbackVariants.length; offset += 1) {
      const candidate = fallbackVariants[(start + offset) % fallbackVariants.length];
      const repeated = recent.some((line) =>
        normalizeLineForContinuity(line) === normalizeLineForContinuity(candidate) ||
        continuityOverlapScore(line, candidate) >= 0.82 ||
        continuityContainmentScore(line, candidate) >= 0.86
      );
      if (!repeated) return candidate;
    }
    if (isInitialAccessStage(scenario)) {
      if (timeConstrained && operational) {
        return "This is the last pass: give me the staff change or send it over.";
      }
      if (timeConstrained) {
        return "This is the last pass: give me the short point or send it over.";
      }
      return "This is the last pass: make the practical change concrete.";
    }
    if (isEarlyDiscoveryStage(scenario)) {
      return "This is the last pass: name the patient profile or we should pause.";
    }
    return variants[start] || "";
  };

  if (isInitialAccessStage(scenario)) {
    if (temperatureBand === "low") {
      if (timeConstrained && operational) {
        return choose(repeatCount >= 2
          ? [
            "I have a few minutes, and we are circling the same point. What changes for my staff before my next patient?",
            "Okay, keep it to the short version now: what does my staff do differently before this gets more time?",
            "I am still between patients. Give me the practical staff change in one sentence.",
          ]
          : [
            "I have a few minutes. Give me the short version before my next patient, including what changes for my staff.",
            "I'm between patients. Keep this to the practical staff change.",
            "Give me the short version now: what changes for my staff?",
          ], "initial-low-time-ops");
      }
      if (timeConstrained) {
        return choose(repeatCount >= 2
          ? [
            "I have a patient waiting, and this is starting to repeat. Give me the short version.",
            "I can stay another moment, but only if you narrow this to the point.",
            "Keep it to one useful point before I get back to patients.",
          ]
          : [
            "I have a few minutes. Give me the short version before my next patient.",
            "I am between patients. What is the short version?",
            "Keep this quick. What is the practical reason to keep talking?",
          ], "initial-low-time");
      }
      if (operational) {
        return choose(repeatCount >= 2
          ? [
            "I am still hearing the same broad point. What changes for the office?",
            "Keep this practical for the office. What actually changes?",
            "I can keep listening if you make the office impact concrete.",
          ]
          : [
            "I can listen, but keep this practical for the office.",
            "Make this practical for the office first.",
            "What is the office-level reason to keep this open?",
          ], "initial-low-ops");
      }
      return choose([
        "I can listen briefly. What's this about for my patients?",
        "Before we go further, what is the reason this matters for my patients?",
        "Give me the practical reason to keep the conversation open.",
      ], "initial-low-general");
    }
    if (temperatureBand === "medium") {
      if (escalationMemory.escalationLevel >= 2) {
        return choose(timeConstrained
          ? [
            "You're getting too broad. I have a patient waiting, so give me the short version now.",
            "That is still too general. I need the quick practical point before I move on.",
            "We are repeating the setup. What changes for my staff right now?",
          ]
          : [
            `You're getting too broad. I need ${ask}.`,
            "That is still too general. Make the practical change clear.",
            "We are repeating the setup. Narrow this to what changes.",
          ], "initial-medium-escalated");
      }
      return choose(timeConstrained
        ? operational
          ? [
            "Keep it tight. What changes for my staff before my next patient?",
            "I have limited time. Give me the practical staff version.",
            "Short version only: what changes in the office enough for this to matter?",
          ]
          : [
            "Keep it tight. What's the short version for my patients before my next appointment?",
            "I have limited time. Give me the practical patient version.",
            "Short version only: what changes enough for my patients to matter?",
          ]
        : [
          `Keep this practical. I need ${ask}.`,
          "Stay practical. What changes for the office here?",
          "Make the patient or office impact concrete before we go further.",
        ], "initial-medium");
    }
    if (escalationMemory.escalationLevel >= 3) {
      return choose(timeConstrained
        ? [
          "I have to get back to patients. If there isn't a short practical point, send it over.",
          "We have covered this enough. Send me the practical details if there is no new point.",
          "I need to stop here unless you have one concrete staff change.",
        ]
        : [
          "If there isn't a practical reason to continue, send the details over.",
          "We have covered the broad point. Send me the specific office detail.",
          "Let's stop here unless there is a concrete change to discuss.",
        ], "initial-high-stop");
    }
    return choose(timeConstrained
      ? operational
        ? [
          "I have a patient waiting. Give me the staff change or let's stop here.",
          "This is still too broad for the time I have. One practical office point.",
          "I am out of room for a broad answer. What changes for my staff?",
        ]
        : [
          "I have a patient waiting. Give me the patient point or let's stop here.",
          "This is still too broad for the time I have. One practical patient point.",
          "I am out of room for a broad answer. What changes for my patients?",
        ]
      : [
        `You're still not making this practical. Give me ${ask}.`,
        "You are repeating the broad point. Make the practical change concrete.",
        "If this stays general, we should stop here.",
      ], "initial-high");
  }

  if (isEarlyDiscoveryStage(scenario)) {
    if (temperatureBand === "low") return choose([
      `I can stay with you, but I need ${ask}.`,
      "I can keep going, but narrow this to the patient profile.",
      "Which patients are we actually talking about first?",
    ], "early-low");
    if (temperatureBand === "medium") {
      return choose(escalationMemory.escalationLevel >= 2
        ? [
          "That is still too broad. Which patient profile are you actually talking about?",
          "You still have not narrowed the patient type. Who is this for?",
          "We are not moving until the patient profile is clear.",
        ]
        : [
          `You are staying too broad. I need ${ask}.`,
          "That is still broad. Which patients should I picture?",
          "Give me the patient profile before we go further.",
        ], "early-medium");
    }
    if (escalationMemory.escalationLevel >= 3) {
      return choose([
        "We have circled the same broad point. If you cannot narrow the patient profile, we should stop here.",
        "This is not getting more specific. Send the patient-profile detail if you have it.",
        "I am going to stop here unless you can name the patient type.",
      ], "early-high-stop");
    }
    return choose([
      "You are still not narrowing this. Which patients are we actually talking about?",
      "That is still broad. Name the patient profile.",
      "I need the patient type, not another broad setup.",
    ], "early-high");
  }

  const stage = String(scenario?.journeyStage || "").toLowerCase();
  const family = deriveRealismConcernFamily(scenario, currentLine);
  const clinicalAsk = /\brenal|kidney|ckd|impairment\b/i.test(`${scenario?.openingScene || ""} ${scenario?.description || ""} ${scenario?.objective || ""}`)
    ? "the renal subgroup, endpoint, and treatment decision"
    : "the patient subgroup, endpoint, and treatment decision";
  const stopSuffix = timeConstrained
    ? "before I get back to patients"
    : "before we spend more time on this";

  if (stage === "clinical_value") {
    if (operational || pressures.includes("access_barrier")) {
      return choose(escalationMemory.escalationLevel >= 2
        ? [
          "That is still too broad for a value decision. Give me the patient subgroup, the endpoint, the coverage path, and what work comes off my staff.",
          "I need the full value equation: clinical endpoint, access path, and the staff step that changes.",
          "The evidence alone is not enough here. Which patients benefit, how does coverage clear, and what changes for my team?",
        ]
        : [
          "Before I call that value, I need the subgroup, endpoint, coverage path, and staff impact together.",
          "For value to matter, show me the patient outcome, the access pathway, and what staff work changes.",
          "Tie the evidence to the office reality: patient subgroup, endpoint, approval path, and staff workload.",
        ], "clinical-pressure-combined");
    }
    if (temperatureBand === "low") {
      return choose(repeatCount >= 2
        ? [
          `I can keep going, but we are circling. Give me ${clinicalAsk}.`,
          `I still need the clinical bridge: ${clinicalAsk}.`,
          "Stay with the evidence. Which patient group and endpoint change what I do?",
        ]
        : [
          `Tie this to the evidence for my patients: ${clinicalAsk}.`,
          "Value is only useful if it changes a real treatment decision. Which subgroup and endpoint are you pointing to?",
          "I can consider the data, but make it patient-specific and decision-specific.",
        ], "clinical-low");
    }
    if (temperatureBand === "medium") {
      return choose(escalationMemory.escalationLevel >= 2
        ? [
          `That is still too broad clinically. Give me ${clinicalAsk}.`,
          "You are not connecting the evidence to my treatment threshold. Which subgroup and endpoint matter?",
          "The headline result is not enough. Show me the patient group and the outcome that changes care.",
        ]
        : [
          `Keep this on the evidence. I need ${clinicalAsk}.`,
          "Which patients in the trial look like mine, and what outcome changes the decision?",
          "Before I call that value, I need the subgroup and endpoint that apply here.",
        ], "clinical-medium");
    }
    return choose(escalationMemory.escalationLevel >= 3
      ? [
        "We have covered the broad data. If you cannot tie it to a subgroup and endpoint, send the evidence over.",
        `I am not moving on the headline claim. Give me ${clinicalAsk} or we should stop here.`,
        "This is still not clinically specific. Send the patient-level evidence if you have it.",
      ]
      : [
        `The broad claim is not enough. Give me ${clinicalAsk}.`,
        "You are still not tying this to a treatment decision. Which subgroup and endpoint change care?",
        "I need patient-level evidence now, not another general value statement.",
      ], "clinical-high");
  }

  if (stage === "access_formulary" || family === "access") {
    if (temperatureBand === "low") {
      return choose([
        "I can stay with it, but I need the actual coverage path and what my staff has to do.",
        "Make the access piece concrete: payer step, prior-auth requirement, and who owns the work.",
        `Before we go further, tell me the approval path ${stopSuffix}.`,
      ], "access-low");
    }
    if (temperatureBand === "medium") {
      return choose(escalationMemory.escalationLevel >= 2
        ? [
          "That still does not answer the access barrier. What approval step changes for my team?",
          "You are staying too general on coverage. Name the pathway and what work comes off staff.",
          `I need the prior-auth path and staff impact ${stopSuffix}.`,
        ]
        : [
          "What changes in the approval path, and what does my staff do differently?",
          "Before this is usable, I need the coverage pathway and the staff step.",
          "Tie this to access: payer step, prior auth, and office workload.",
        ], "access-medium");
    }
    return choose(escalationMemory.escalationLevel >= 3
      ? [
        "We have covered the access concern. If you cannot name the approval path, send the details over.",
        "I am not adding work for staff on a vague coverage answer. Give me the path or we stop here.",
        "Without a clear prior-auth pathway, this is not something I can move forward today.",
      ]
      : [
        "The access answer is still too vague. What approval path changes for my staff?",
        "Name the payer step and the office work, or this does not move.",
        "I need the exact access path now, not another broad assurance.",
      ], "access-high");
  }

  if (stage === "adoption_implementation" || family === "workflow") {
    if (temperatureBand === "low") {
      return choose([
        "I can consider it if the workflow is clear. Who owns the first staff step?",
        "Make the implementation practical: what changes in the office on day one?",
        "Before this goes anywhere, I need the handoff and staff workload spelled out.",
      ], "implementation-low");
    }
    if (temperatureBand === "medium") {
      return choose(escalationMemory.escalationLevel >= 2
        ? [
          "That still leaves the work on my team. What staff step changes and who owns it?",
          "You are not answering the implementation issue. What happens in the office first?",
          "The workflow is still vague. Name the handoff, owner, and staff impact.",
        ]
        : [
          "What happens in the workflow first, and who owns that step?",
          "Implementation only works if my staff knows what changes. Spell out the first handoff.",
          "I need the office process, not just the concept.",
        ], "implementation-medium");
    }
    return choose(escalationMemory.escalationLevel >= 3
      ? [
        "We have gone over the concept. If the workflow is not concrete, we should stop here.",
        "I am not taking this back to my team without the first step and owner.",
        "Send the implementation detail over if you have it. This is too vague to keep discussing.",
      ]
      : [
        "The workflow answer is still too broad. What changes for staff on day one?",
        "You are still not naming the owner or the handoff. That is the blocker.",
        "Make the implementation real: first step, owner, and staff impact.",
      ], "implementation-high");
  }

  if (stage === "commitment_close") {
    const decisionAsk = family === "evidence"
      ? "the evidence threshold and the patient profile"
      : family === "access"
        ? "the access path and the first patient it applies to"
        : family === "workflow"
          ? "the staff step and owner"
          : "the specific next step you are asking me to take";
    if (temperatureBand === "low") {
      return choose([
        `I can consider a next step, but make it specific: ${decisionAsk}.`,
        "Before I agree to anything, define the patient and the action.",
        `If you want a commitment, tie it to ${decisionAsk}.`,
      ], "close-low");
    }
    if (temperatureBand === "medium") {
      return choose([
        `Do not ask for a vague next step. Give me ${decisionAsk}.`,
        "What exactly are you asking me to do after this conversation?",
        `I need the next action, owner, and patient fit before I commit.`,
      ], "close-medium");
    }
    return choose(escalationMemory.escalationLevel >= 3
      ? [
        "We are past the point for a broad ask. Send the exact next step if there is one.",
        "I am not committing to a vague action. We can stop here unless you make it specific.",
        `No commitment from me without ${decisionAsk}.`,
      ]
      : [
        `The ask is still vague. Give me ${decisionAsk}.`,
        "You are still not making the next step concrete.",
        "If there is an action here, name it now.",
      ], "close-high");
  }

  if (stage === "objection_handling") {
    if (temperatureBand === "low") {
      return choose([
        `I can hear the point, but you need to answer the objection directly: ${ask}.`,
        "Stay on the objection. What changes my current concern?",
        "I can keep listening if you address the actual blocker.",
      ], "objection-low");
    }
    if (temperatureBand === "medium") {
      return choose([
        `That does not answer the objection yet. I need ${ask}.`,
        "You are talking around the blocker. What specifically changes?",
        "Address the concern directly before adding another point.",
      ], "objection-medium");
    }
    return choose(escalationMemory.escalationLevel >= 3
      ? [
        "We have covered the objection. If you cannot answer it directly, we should stop here.",
        "This is not moving past the blocker. Send the specific answer over.",
        "I am not continuing unless you address the objection directly.",
      ]
      : [
        `You are still not answering the objection. Give me ${ask}.`,
        "The blocker is unchanged. What specifically changes?",
        "I need a direct answer to the objection now.",
      ], "objection-high");
  }

  return "";
}

function enforceRealismLeverDialogue({
  hcpReply,
  scenario,
  temperatureBand,
  escalationMemory,
  transcript,
}: {
  hcpReply: string;
  scenario: any;
  temperatureBand: RuntimeTemperatureBand;
  escalationMemory: EscalationMemory;
  transcript: ConversationTurn[];
}): string {
  const line = String(hcpReply || "").trim();
  if (!line) return line;

  const ask = buildRealismSpecificAsk(scenario, line);
  const stageBoundReply = buildStageBoundRealismReply({
    scenario,
    temperatureBand,
    escalationMemory,
    ask,
    transcript,
    currentLine: line,
  });
  const stageDrift =
    (isInitialAccessStage(scenario) && /\bworkflow\b|\baccess step\b|\bapproval path\b|\bapproval workflow\b|\bimplementation\b|\bwho owns\b|\bformulary\b|\bpayer\b/i.test(line)) ||
    (isEarlyDiscoveryStage(scenario) && /\bapproval\b|\baccess step\b|\bformulary\b|\bpayer\b|\bdecision threshold\b|\bendpoint\b|\bhazard ratio\b/i.test(line));
  const pressures = Array.isArray(scenario?.interactionPressure)
    ? scenario.interactionPressure.map((value: string) => String(value || "").toLowerCase())
    : [];
  const pressureGap =
    (pressures.includes("time_constrained") && !/\b(time|minute|brief|quick|short|schedule|patient|room|waiting|clinic|between patients)\b/i.test(line)) ||
    ((pressures.includes("operationally_constrained") || pressures.includes("workflow_pressure")) && !/\b(staff|workflow|process|handoff|callback|queue|MA|nurse|portal|step|office)\b/i.test(line)) ||
    (pressures.includes("access_barrier") && !/\b(access|coverage|prior auth|authorization|approval|payer|formulary|pathway)\b/i.test(line));
  const malformedEnding = /\b(?:our|your|their|the|a|an|to|for|with|and|or|make|change|because|so)\.?$/i.test(line);
  const repeatedRecentHcpLine = transcript
    .filter((turn) => turn?.speaker === "hcp" && typeof turn?.text === "string")
    .slice(-8)
    .some((turn) => {
      const prior = String(turn.text || "");
      return normalizeLineForContinuity(prior) === normalizeLineForContinuity(line) ||
        continuityOverlapScore(prior, line) >= 0.82 ||
        continuityContainmentScore(prior, line) >= 0.86;
    });
  if (stageBoundReply && stageDrift) {
    return stageBoundReply;
  }
  if (stageBoundReply && repeatedRecentHcpLine) {
    return stageBoundReply;
  }
  if (stageBoundReply && pressureGap) {
    return stageBoundReply;
  }
  if (stageBoundReply && malformedEnding) {
    return stageBoundReply;
  }

  if (lineAlreadyShowsRealism({ hcpReply: line, temperatureBand, escalationMemory })) {
    if (temperatureBand !== "low") return line;
    return line
      .replace(/\bYou'?re not answering\b/gi, "I still need you to answer")
      .replace(/\bwe can stop here\b/gi, "we may need to pause here")
      .replace(/\bnot worth continuing\b/gi, "hard to continue");
  }

  if (stageBoundReply) return stageBoundReply;
  if (temperatureBand === "low") {
    return `I can stay with you on this, but I still need ${ask}.`;
  }
  if (temperatureBand === "medium") {
    return escalationMemory.escalationLevel >= 2
      ? `That still does not answer the issue. I need ${ask}.`
      : `You are staying too broad. I need ${ask}.`;
  }
  if (escalationMemory.escalationLevel >= 3) {
    return `We have already covered the broad case. If you cannot give me ${ask}, we should stop here.`;
  }
  return escalationMemory.escalationLevel >= 1
    ? `You are still not answering the point. Give me ${ask}.`
    : `I am not moving on a broad answer. Give me ${ask}.`;
}

function deriveRealismCueCandidate({
  scenario,
  temperatureBand,
  escalationMemory,
  hcpReply,
}: {
  scenario: any;
  temperatureBand: RuntimeTemperatureBand;
  escalationMemory: EscalationMemory;
  hcpReply: string;
}): string {
  const family = deriveRealismConcernFamily(scenario, hcpReply);
  if (temperatureBand === "low") {
    if (family === "access") return "Keeps the coverage notes open and gives a measured nod.";
    if (family === "workflow") return "Keeps the workflow notes open and looks back with measured attention.";
    if (family === "time") return "Checks the schedule once, then gives a small opening to continue.";
    if (family === "screening") return "Keeps the patient list open and looks back with measured attention.";
    if (family === "evidence") return "Keeps the study page open and gives a measured nod.";
    return "Maintains a steady posture and gives the conversation a little room.";
  }
  if (temperatureBand === "medium") {
    if (family === "access") return "Keeps the coverage notes under one hand, expression tightening around the approval step.";
    if (family === "workflow") return "Keeps one hand on the workflow notes, posture tightening around the staff step.";
    if (family === "time") return "Checks the clock, then looks back with very little room for a detour.";
    if (family === "screening") return "Keeps the patient list open, eyes narrowing at the selection boundary.";
    if (family === "evidence") return "Keeps one finger on the study page, expression tightening around the endpoint.";
    return "Holds steady eye contact, expression narrowing around the ask.";
  }
  if (escalationMemory.escalationLevel >= 3) {
    if (family === "access") return "Gathers the coverage notes and turns back toward the next task.";
    if (family === "workflow") return "Gathers the workflow notes and turns back toward clinic flow.";
    if (family === "time") return "Turns back toward the next patient slot, conversation space closing.";
    if (family === "screening") return "Closes the patient list and steps back toward the desk.";
    if (family === "evidence") return "Closes the journal page and shifts back toward the door.";
    return "Steps back toward the door, conversation space clearly closing.";
  }
  if (family === "access") return "Sets the formulary sheet down with a clipped expression.";
  if (family === "workflow") return "Sets the workflow notes flat on the desk, expression clipped.";
  if (family === "time") return "Looks back with a clipped expression, one hand still on the schedule.";
  if (family === "screening") return "Sets the chart flat and looks back without softening.";
  if (family === "evidence") return "Sets the study page flat, jaw set, and holds the question there.";
  return "Goes still for a beat, jaw set.";
}

function adjustBehaviorStateForRealism({
  behaviorState,
  temperatureBand,
  escalationMemory,
  scenario,
}: {
  behaviorState: string;
  temperatureBand: RuntimeTemperatureBand;
  escalationMemory: EscalationMemory;
  scenario: any;
}): string {
  const base = String(behaviorState || "neutral").toLowerCase();
  const pressures = Array.isArray(scenario?.interactionPressure)
    ? scenario.interactionPressure.map((value: string) => String(value).toLowerCase())
    : [];
  if (temperatureBand === "high") {
    if (escalationMemory.escalationLevel >= 3) return "closed";
    if (escalationMemory.escalationLevel >= 1 || pressures.includes("skeptical_resistant")) return "frustration";
    return ["openness", "curiosity"].includes(base) ? "neutral" : (base || "resistance");
  }
  if (temperatureBand === "medium") {
    if (escalationMemory.escalationLevel >= 2) return "resistance";
    if (escalationMemory.escalationLevel >= 1 && base === "openness") return "curiosity";
    return base || "neutral";
  }
  if (escalationMemory.escalationLevel >= 3) return "resistance";
  if (["closed", "frustration", "time_pressure"].includes(base)) return "neutral";
  return base || "neutral";
}

function buildDeterministicLiveCoachingNudge({
  repMessage,
  hcpReply,
  scenario,
}: {
  repMessage: string;
  hcpReply: string;
  scenario: any;
}) {
  const repText = String(repMessage || "").toLowerCase();
  const hcpText = String(hcpReply || "").toLowerCase();
  const pressure = Array.isArray(scenario?.interactionPressure)
    ? scenario.interactionPressure.map((value: string) => String(value).toLowerCase())
    : [];
  if (/\?/.test(hcpText) && !/\b(the change is|the first change is|it means|that means|in practice|right now)\b/i.test(repText)) {
    return {
      title: "Listening & Responsiveness",
      guidance: "Answer the HCP's current ask directly before adding another question or broader point.",
      capabilityId: "listening_responsiveness",
      capabilityName: "Listening & Responsiveness",
    };
  }
  if (pressure.includes("time_constrained")) {
    return {
      title: "Conversation Control & Structure",
      guidance: "Keep the next move to one concrete point that respects the HCP's limited time.",
      capabilityId: "conversation_control_structure",
      capabilityName: "Conversation Control & Structure",
    };
  }
  return {
    title: "Value Framing",
    guidance: "Tie the next response to the HCP's stated practice reality instead of staying broad.",
    capabilityId: "making_it_matter",
    capabilityName: "Value Framing",
  };
}

function mapEngagementStateToBehaviorState(state: HcpEngagementState, currentBehaviorState: string): string {
  if (state === "Resistant") {
    return ["time_pressure", "frustration", "closed"].includes(String(currentBehaviorState || ""))
      ? String(currentBehaviorState)
      : "resistance";
  }
  if (state === "Neutral") return "neutral";
  if (state === "Selectively Engaged") return "curiosity";
  return "openness";
}

function buildDerivedScenarioContext(scenario: any) {
  const uiSelection = deriveUISelectionFromBrain(scenario || {});
  if (!uiSelection?.hcpType || !uiSelection?.stage || !uiSelection?.challenge) {
    return scenario;
  }
  const contractRealism = requireRealismContract(scenario?.runtimeTemperature, "scenario.runtimeTemperature");

  const mapped = mapUIToBrain({
    hcpType: uiSelection.hcpType,
    stage: uiSelection.stage,
    challenge: uiSelection.challenge,
    realism: contractRealism,
    diseaseState: scenario?.predictiveSeed?.diseaseState || scenario?.disease_state || "primary_care",
    specialty: scenario?.specialty || scenario?.specialty_type || "",
  });

  return {
    ...scenario,
    runtimeTemperature: contractRealism,
    persona: scenario?.persona || mapped.resolvedFields.behavior_archetype,
    interactionPressure: Array.isArray(scenario?.interactionPressure) && scenario.interactionPressure.length
      ? scenario.interactionPressure
      : mapped.resolvedFields.interaction_pressure,
    decisionOrientation: scenario?.decisionOrientation || mapped.resolvedFields.influence_driver,
    repObjective: scenario?.repObjective || mapped.resolvedFields.rep_objective,
    accessBarrierContext: scenario?.accessBarrierContext || mapped.resolvedFields.access_barrier_context,
    startingBehaviorState: scenario?.startingBehaviorState || "neutral",
    hcpRoleType: scenario?.hcpRoleType || mapped.resolvedFields.hcp_type,
    journeyStage: scenario?.journeyStage || mapped.resolvedFields.journey_stage,
  };
}

function deriveSamplingTemperatureFromRealism(realism: number, opts?: { highPressure?: boolean; profileBrevity?: string }): number {
  const contractRealism = requireRealismContract(realism, "scenario.runtimeTemperature");
  let base = 0.24;
  if (contractRealism <= 3) base = 0.16;
  else if (contractRealism <= 6) base = 0.24;
  else if (contractRealism <= 8) base = 0.34;
  else base = 0.42;

  if (opts?.highPressure) {
    base = Math.max(0.14, base - 0.04);
  }
  if (opts?.profileBrevity === "tight") {
    base = Math.max(0.14, base - 0.02);
  }

  return Number(base.toFixed(2));
}

function deriveTemperatureBand(realism: number): RuntimeTemperatureBand {
  const value = requireRealismContract(realism, "scenario.runtimeTemperature");
  if (value <= 3) return "low";
  if (value <= 7) return "medium";
  return "high";
}

function normalizeIntentText(value = ""): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferRepIntent(value = ""): string {
  const text = normalizeIntentText(value);
  if (!text) return "none";
  if (/\b(prior auth|authorization|coverage|payer|formulary|access|approval)\b/.test(text)) return "access";
  if (/\b(workflow|staff|ma|nurse|process|handoff|callback|queue|portal|ehr|emr)\b/.test(text)) return "workflow";
  if (/\b(data|trial|study|evidence|endpoint|hazard ratio|subgroup|real world|outcome)\b/.test(text)) return "evidence";
  if (/\b(safety|side effect|adverse|risk|tolerability|renal|kidney|hepatic)\b/.test(text)) return "safety";
  if (/\b(cost|value|budget|affordability|copay|economic)\b/.test(text)) return "cost_value";
  if (/\b(patient|population|profile|subgroup|who fits|candidate)\b/.test(text)) return "patient_fit";
  if (/\b(next step|try|pilot|start|commit|follow up|schedule|send|bring)\b/.test(text)) return "commitment";
  if (/\b(help|support|better|benefit|improve|solution|valuable|important)\b/.test(text)) return "generic_value";
  return text.split(" ").slice(0, 4).join("_") || "general";
}

function repAnsweredPriorHcpQuestion(repMessage = "", transcript: ConversationTurn[] = [], latestConcern = ""): boolean {
  const previousHcp = getLastHcpReplyText(transcript);
  if (!/\?/.test(previousHcp)) return true;
  const rep = normalizeIntentText(repMessage);
  if (!rep) return false;
  const concern = inferRepIntent(`${previousHcp} ${latestConcern}`);
  if (concern === "access") return /\b(prior auth|authorization|coverage|payer|formulary|approval|access|step|pathway)\b/.test(rep);
  if (concern === "workflow") return /\b(staff|ma|nurse|workflow|process|handoff|callback|queue|owns|step)\b/.test(rep);
  if (concern === "evidence") return /\b(data|trial|study|endpoint|subgroup|outcome|evidence|real world|number)\b/.test(rep);
  if (concern === "safety") return /\b(safety|side effect|adverse|risk|renal|hepatic|tolerability)\b/.test(rep);
  if (concern === "patient_fit") return /\b(patient|subgroup|population|profile|candidate|fits|appropriate)\b/.test(rep);
  return !/\b(great|help|valuable|solution|better|important|innovative|support)\b/.test(rep) || /\b(specific|because|means|would|step|data|patient|staff|coverage)\b/.test(rep);
}

function askedForSpecificityRecently(transcript: ConversationTurn[] = []): boolean {
  const previousHcp = getLastHcpReplyText(transcript).toLowerCase();
  return /\b(specific|concrete|which patient|what outcome|what step|what data|what proof|who owns|what changes)\b/.test(previousHcp);
}

function repStayedGeneric(repMessage = ""): boolean {
  const rep = normalizeIntentText(repMessage);
  if (!rep) return false;
  const hasConcreteAnchor = /\b(prior auth|authorization|coverage|formulary|staff|ma|nurse|endpoint|trial|subgroup|outcome|patient|renal|safety|copay|next step|owner|timeline|specific)\b/.test(rep);
  const genericValue = /\b(help|support|improve|better|valuable|benefit|solution|streamline|optimize|important)\b/.test(rep);
  return genericValue && !hasConcreteAnchor;
}

function deriveEscalationMemory({
  transcript,
  repMessage,
  latestConcern,
  temperatureBand,
  priorEscalationLevel,
}: {
  transcript: ConversationTurn[];
  repMessage: string;
  latestConcern: string;
  temperatureBand: RuntimeTemperatureBand;
  priorEscalationLevel?: number;
}): EscalationMemory {
  const recentRepIntents = transcript
    .filter((turn) => turn?.speaker === "rep")
    .slice(-3)
    .map((turn) => inferRepIntent(turn?.text || ""));
  const lastRepIntent = inferRepIntent(repMessage);
  const repeatedRepPatternCount = recentRepIntents.filter((intent) => intent === lastRepIntent).length;
  const unansweredQuestionCount = repAnsweredPriorHcpQuestion(repMessage, transcript, latestConcern) ? 0 : 1;
  const genericAfterSpecificityCount = askedForSpecificityRecently(transcript) && repStayedGeneric(repMessage) ? 1 : 0;
  const hardTriggers = [
    repeatedRepPatternCount >= 2,
    unansweredQuestionCount > 0,
    genericAfterSpecificityCount > 0,
  ].filter(Boolean).length;
  const prior = Number.isFinite(Number(priorEscalationLevel)) ? Number(priorEscalationLevel) : 0;
  const bandStep = temperatureBand === "high" ? hardTriggers : temperatureBand === "medium" ? Math.min(1, hardTriggers) : hardTriggers >= 2 ? 1 : 0;
  const escalationLevel = Math.max(0, Math.min(3, prior + bandStep));
  const shouldEscalateThisTurn = escalationLevel > prior || hardTriggers > 0;
  const action: EscalationMemory["action"] =
    escalationLevel >= 3 ? "disengage"
      : escalationLevel === 2 ? "reveal_barrier"
        : escalationLevel === 1 ? "sharpen"
          : "restate";
  const reasons: string[] = [];
  if (repeatedRepPatternCount >= 2) reasons.push("rep repeated same intent");
  if (unansweredQuestionCount > 0) reasons.push("rep did not answer prior HCP question");
  if (genericAfterSpecificityCount > 0) reasons.push("rep stayed generic after specificity request");

  return {
    repeatedRepPatternCount,
    unansweredQuestionCount,
    genericAfterSpecificityCount,
    lastRepIntent,
    escalationLevel,
    shouldEscalateThisTurn,
    action,
    reasons,
  };
}

function applyEscalationBehavior({
  temperatureBand,
  escalationLevel,
  repeatedRepPatternCount,
  unansweredQuestionCount,
  scenarioPressure,
}: {
  temperatureBand: RuntimeTemperatureBand;
  escalationLevel: number;
  repeatedRepPatternCount: number;
  unansweredQuestionCount: number;
  scenarioPressure: string[];
}): string {
  const pressureText = scenarioPressure.length ? scenarioPressure.join(", ") : "none";
  const bandRule = temperatureBand === "low"
    ? "LOW realism: preserve cooperation; restate the concern politely and avoid shutdown unless the rep repeatedly ignores direct questions."
    : temperatureBand === "medium"
      ? "MEDIUM realism: show visible impatience as misses accumulate; shorten the line and push for specificity."
      : "HIGH realism: escalate quickly when the rep repeats or evades; challenge directly and consider ending the exchange at level 3.";

  return [
    "ESCALATION MEMORY (runtime only - use as behavior, not canned copy):",
    `- Temperature Band: ${temperatureBand}`,
    `- Scenario Pressure: ${pressureText}`,
    `- Repeated Rep Pattern Count: ${repeatedRepPatternCount}`,
    `- Unanswered HCP Question Count: ${unansweredQuestionCount}`,
    `- Escalation Level: ${escalationLevel}/3`,
    `- ${bandRule}`,
    "- Level 0: continue normally while staying scenario-specific.",
    "- Level 1: tighten the response and make the ask more direct.",
    "- Level 2: introduce friction in this HCP's own words; make clear the rep has not addressed the actual concern.",
    "- Level 3: introduce consequence in this HCP's own words; the HCP may disengage or stop the conversation.",
    "- Do not use global stock phrases to express escalation. Use the Predictive HCP Brain, current state, and scenario pressure to author the line.",
  ].join("\n");
}

function buildPressurePersistenceBlock(scenario: any): string {
  const pressures = Array.isArray(scenario?.interactionPressure)
    ? scenario.interactionPressure.map((value: string) => String(value || "").toLowerCase())
    : [];
  const required: string[] = [];
  if (pressures.includes("time_constrained")) {
    required.push("time_constrained: time/schedule pressure must remain visible every 1-2 HCP turns, but phrase it naturally for this scenario.");
  }
  if (pressures.includes("operationally_constrained") || pressures.includes("workflow_pressure")) {
    required.push("workflow_pressure: staff/process impact must remain part of the decision filter when workflow is the blocker.");
  }
  if (pressures.includes("access_barrier")) {
    required.push("access_barrier: approval, coverage, or pathway friction must remain part of the decision filter when access is the blocker.");
  }
  if (!required.length) return "";
  return [
    "PRESSURE PERSISTENCE (validator constraint - do not use stock phrases):",
    ...required.map((line) => `- ${line}`),
    "- If pressure is missing from a response that should carry it, regenerate from the Predictive HCP Brain with the missing pressure constraint.",
  ].join("\n");
}

function missingPersistentPressure(hcpReply: string, scenario: any, hcpTurnCount: number): string[] {
  const text = String(hcpReply || "");
  const pressures = Array.isArray(scenario?.interactionPressure)
    ? scenario.interactionPressure.map((value: string) => String(value || "").toLowerCase())
    : [];
  const missing: string[] = [];
  const shouldCarryRecurringPressure = hcpTurnCount === 0 || hcpTurnCount % 2 === 1;
  if (shouldCarryRecurringPressure && pressures.includes("time_constrained") && !/\b(time|minute|brief|quick|short|schedule|patient|room|waiting|clinic)\b/i.test(text)) {
    missing.push("time_constrained");
  }
  if ((pressures.includes("operationally_constrained") || pressures.includes("workflow_pressure")) && !/\b(staff|workflow|process|handoff|callback|queue|MA|nurse|portal|step)\b/i.test(text)) {
    missing.push("workflow_pressure");
  }
  if (pressures.includes("access_barrier") && !/\b(access|coverage|prior auth|authorization|approval|payer|formulary|pathway)\b/i.test(text)) {
    missing.push("access_barrier");
  }
  return missing;
}

function hasGlobalStockPhrase(text = ""): boolean {
  return GLOBAL_STOCK_PHRASE_PATTERNS.some((pattern) => pattern.test(String(text || "")));
}

function needsNaturalnessRewrite(text: string): boolean {
  const line = String(text || "").trim();
  return ABSTRACT_BURDEN_PATTERNS.some((pattern) => pattern.test(line));
}

function needsSpokenStyleRewrite({
  hcpReply,
  scenario,
}: {
  hcpReply: string;
  scenario: any;
}): boolean {
  const line = String(hcpReply || "").trim();
  const wordCount = line.split(/\s+/).filter(Boolean).length;
  const tooLong = wordCount > 34;
  const tooBalanced = /, and\b/i.test(line) && /, /g.test(line);
  const tooFormalUnderPressure = /\bwould\b/i.test(line) && wordCount > 18;
  const chatbotMarker = CHATBOT_STYLE_PATTERNS.some((pattern) => pattern.test(line));
  const hasPressure = (scenario.interactionPressure || []).some((value: string) =>
    ["time_constrained", "skeptical_resistant", "operationally_constrained", "safety_concern"].includes(value)
  );

  return chatbotMarker || (hasPressure && (tooLong || tooBalanced || tooFormalUnderPressure));
}

function needsContextConsistencyRewrite({
  hcpReply,
  scenario,
  behaviorState,
}: {
  hcpReply: string;
  scenario: any;
  behaviorState: string;
}): boolean {
  const line = String(hcpReply || "").trim();
  const pressure = scenario.interactionPressure || [];
  const highPressure =
    pressure.includes("time_constrained") ||
    pressure.includes("skeptical_resistant") ||
    pressure.includes("safety_concern") ||
    behaviorState === "closed" ||
    behaviorState === "resistance" ||
    behaviorState === "time_pressure";

  const overlyLongHighPressureReply = highPressure && line.split(/\s+/).filter(Boolean).length > 42;
  const casualDrift = CASUAL_DRIFT_PATTERNS.some((pattern) => pattern.test(line));

  return overlyLongHighPressureReply || casualDrift;
}

function enforceAdaptiveNaturalCompression({
  hcpReply,
  scenario,
  behaviorState,
  prediction,
}: {
  hcpReply: string;
  scenario: any;
  behaviorState: string;
  prediction: any;
}): string {
  const line = String(hcpReply || "").trim();
  if (!line) return line;

  const pressures = new Set(
    (Array.isArray(scenario?.interactionPressure) ? scenario.interactionPressure : [])
      .map((value: unknown) => String(value || "").toLowerCase())
  );
  const currentState = String(behaviorState || "").toLowerCase();
  const predictedState = String(prediction?.predictedBehaviorState || "").toLowerCase();
  const highPressure =
    pressures.has("time_constrained")
    || pressures.has("skeptical_resistant")
    || pressures.has("operationally_constrained")
    || pressures.has("safety_concern")
    || currentState === "closed"
    || currentState === "resistance"
    || currentState === "time_pressure"
    || predictedState === "closed"
    || predictedState === "resistance"
    || predictedState === "time_pressure";

  if (!highPressure) return line;

  let compressed = line
    .replace(/^If you can show me\b/i, "Show me")
    .replace(/\bthat would justify trying this again\b/gi, "for trying this again")
    .replace(/\bI would need\b/gi, "I need")
    .replace(/\bwhat I need is\b/gi, "I need")
    .replace(/,\s*(keep|be)\b/gi, ". $1")
    .replace(/\s{2,}/g, " ")
    .trim();

  const words = compressed.split(/\s+/).filter(Boolean);
  if (words.length > 20) {
    const parts = compressed.split(/[.?!]/).map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) {
      compressed = `${parts[0]}. ${parts[1]}.`.replace(/\s{2,}/g, " ").trim();
    }
  }

  return compressed;
}

async function rewriteForSpokenNaturalness({
  hcpReply,
  scenario,
  behaviorState,
  prediction,
}: {
  hcpReply: string;
  scenario: any;
  behaviorState: string;
  prediction: any;
}): Promise<string> {
  const runtimeProfile = deriveHcpRuntimeProfile({
    scenario,
    behaviorState,
    predictedBehaviorState: prediction?.predictedBehaviorState,
  });
  const prompt = `You are refining one HCP line in a pharma role-play simulator.

Your job:
- preserve the same meaning
- preserve the same stance and resistance level
- preserve the same scenario context
- make it sound like natural spoken language from a real clinician under pressure

Do NOT:
- make it longer
- make it more polished
- introduce product claims
- use abstract workload phrasing like "burden", "workload", "absorb", "carry", "handle" in an abstract way, "changes in their day", or generic "over time"

Prefer:
- concrete task language
- what staff has to do
- what step gets added
- what slows them down
- what happens next in the workflow

Scenario: ${scenario.title}
Persona: ${scenario.persona}
Journey Stage: ${scenario.journeyStage}
Behavior State: ${behaviorState}
Predicted HCP State: ${prediction.predictedBehaviorState}
Interaction Pressures: ${(scenario.interactionPressure || []).join(", ") || "none"}
${buildRuntimeProfilePrompt(runtimeProfile)}
${buildDialogueDirectivePrompt(scenario, behaviorState, prediction?.predictedBehaviorState)}

Original line:
${hcpReply}

Return ONLY the rewritten spoken line.`;

  const rewritten = await invokeWorkerText({
    prompt,
    max_tokens: 120,
    temperature: 0.1,
    timeout_ms: HCP_REWRITE_TIMEOUT_MS,
    retry_count: 1,
  });

  return String(rewritten || hcpReply).trim();
}

async function rewriteForSpokenStyle({
  hcpReply,
  scenario,
  behaviorState,
}: {
  hcpReply: string;
  scenario: any;
  behaviorState: string;
}): Promise<string> {
  const runtimeProfile = deriveHcpRuntimeProfile({
    scenario,
    behaviorState,
  });
  const prompt = `You are rewriting one HCP line in a pharma role-play simulator so it sounds less like a chatbot and more like a real clinician.

Keep:
- the same meaning
- the same concern
- the same pressure level
- the same clinical context

Improve:
- spoken naturalness
- directness
- human rhythm
- realism

Avoid:
- overly balanced written sentences
- polished explanatory phrasing
- generic LLM language
- abstract or formal constructions a real clinician would not usually say out loud in the moment
- phrases like "I'd like to confirm", "significant impact", "what specific aspects", or "administrative burden"

Prefer:
- shorter spoken rhythm
- natural interruption-style phrasing when pressure is high
- concrete phrasing
- direct clinical realism
- simple spoken words over polished wording

Scenario: ${scenario.title}
Opening Scene: ${scenario.visualScene || scenario.openingScene || "not provided"}
Persona: ${scenario.persona}
Behavior State: ${behaviorState}
Interaction Pressures: ${(scenario.interactionPressure || []).join(", ") || "none"}
${buildRuntimeProfilePrompt(runtimeProfile)}
${buildDialogueDirectivePrompt(scenario, behaviorState, behaviorState)}

Original line:
${hcpReply}

Return ONLY the rewritten HCP line.`;

  const rewritten = await invokeWorkerText({
    prompt,
    max_tokens: 120,
    temperature: 0.1,
    timeout_ms: HCP_REWRITE_TIMEOUT_MS,
    retry_count: 1,
  });

  return String(rewritten || hcpReply).trim();
}

async function rewriteForContextConsistency({
  hcpReply,
  scenario,
  behaviorState,
  currentJourneyState,
  prediction,
}: {
  hcpReply: string;
  scenario: any;
  behaviorState: string;
  currentJourneyState: string;
  prediction: any;
}): Promise<string> {
  const runtimeProfile = deriveHcpRuntimeProfile({
    scenario,
    behaviorState,
    predictedBehaviorState: prediction?.predictedBehaviorState,
  });
  const prompt = `You are recalibrating one HCP line in a pharma role-play simulator.

Your job:
- preserve the same core meaning and stance
- preserve the same objection or concern
- preserve the same HCP profile
- make the line consistent with the scenario's opening-scene reality, pressure, and cue logic

Hard constraints:
- the HCP is in a clinical setting, not casual social conversation
- do not sound relaxed if the scenario is time-pressured, skeptical, closed, or operationally constrained
- keep the line aligned with what the rep could realistically hear from this HCP in this room
- if the HCP is under pressure, make the line tighter and more direct
- do not introduce friendliness or ease that the scenario has not earned

Scenario: ${scenario.title}
Opening Scene: ${scenario.visualScene || scenario.openingScene || "not provided"}
Persona: ${scenario.persona}
Journey Stage: ${scenario.journeyStage}
Journey State: ${currentJourneyState}
Behavior State: ${behaviorState}
Predicted HCP State: ${prediction.predictedBehaviorState}
Interaction Pressures: ${(scenario.interactionPressure || []).join(", ") || "none"}
${buildRuntimeProfilePrompt(runtimeProfile)}
${buildDialogueDirectivePrompt(scenario, behaviorState, prediction?.predictedBehaviorState)}

Original line:
${hcpReply}

Return ONLY the recalibrated HCP line.`;

  const rewritten = await invokeWorkerText({
    prompt,
    max_tokens: 120,
    temperature: 0.1,
    timeout_ms: HCP_REWRITE_TIMEOUT_MS,
    retry_count: 1,
  });

  return String(rewritten || hcpReply).trim();
}

async function rewriteForContinuityVariation({
  hcpReply,
  transcript,
  scenario,
  behaviorState,
  currentJourneyState,
}: {
  hcpReply: string;
  transcript: ConversationTurn[];
  scenario: any;
  behaviorState: string;
  currentJourneyState: string;
}): Promise<string> {
  const previousHcpLine = getLastHcpReplyText(transcript);
  const prompt = `You are rewriting one HCP line in a pharma role-play simulator.

Goal:
- keep the SAME blocker, pressure, and stance
- do NOT repeat the same HCP line verbatim
- restate the same unresolved concern in a fresh but still natural way

Hard constraints:
- one sentence preferred
- stay spoken and clinician-realistic
- do not soften the objection
- do not introduce a new concern family
- stay aligned with the opening-scene reality

Scenario: ${scenario.title}
Opening Scene: ${scenario.visualScene || scenario.openingScene || "not provided"}
Journey Stage: ${scenario.journeyStage}
Journey State: ${currentJourneyState}
Behavior State: ${behaviorState}
Previous HCP line:
${previousHcpLine}

Current repeated line:
${hcpReply}

Return ONLY the rewritten HCP line.`;

  const rewritten = await invokeWorkerText({
    prompt,
    max_tokens: 90,
    temperature: 0.1,
  });

  return String(rewritten || hcpReply).trim();
}

function normalizeLineForContinuity(text = ""): string {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulContinuityTokens(text = ""): string[] {
  const stopwords = new Set([
    "the", "a", "an", "and", "or", "but", "if", "is", "it", "this", "that", "to", "of", "for", "in",
    "on", "at", "we", "you", "your", "my", "me", "i", "am", "are", "was", "were", "be", "been",
    "with", "do", "does", "did", "have", "has", "had", "can", "could", "would", "should", "will",
    "still", "just", "not", "one", "more", "what", "how", "why", "where", "when", "who"
  ]);

  return normalizeLineForContinuity(text)
    .split(" ")
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function continuityOverlapScore(a = "", b = ""): number {
  const aTokens = new Set(meaningfulContinuityTokens(a));
  const bTokens = new Set(meaningfulContinuityTokens(b));
  if (!aTokens.size || !bTokens.size) return 0;
  let shared = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) shared += 1;
  });
  return shared / Math.max(aTokens.size, bTokens.size);
}

function continuityContainmentScore(a = "", b = ""): number {
  const aTokens = new Set(meaningfulContinuityTokens(a));
  const bTokens = new Set(meaningfulContinuityTokens(b));
  if (!aTokens.size || !bTokens.size) return 0;
  let shared = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) shared += 1;
  });
  return shared / Math.min(aTokens.size, bTokens.size);
}

function startsWithSameFrame(a = "", b = ""): boolean {
  const aHead = meaningfulContinuityTokens(a).slice(0, 4).join(" ");
  const bHead = meaningfulContinuityTokens(b).slice(0, 4).join(" ");
  return Boolean(aHead && bHead && aHead === bHead);
}

function deterministicIndex(seed = "", length = 1): number {
  if (length <= 1) return 0;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % length;
}

function buildImplementationAdaptiveReply({
  repMessage,
  hcpReply,
  transcript,
  scenario,
}: {
  repMessage: string;
  hcpReply: string;
  transcript: ConversationTurn[];
  scenario: any;
}): string {
  const variants = [
    "A system change only helps if the handoff is clear. Who owns the first implementation step, and what work comes off my staff?",
    "Implementation is where these ideas usually stall. What changes first for my team, and who is accountable for it?",
    "If this is a new system, I need the operating detail. Where does it fit in the workflow without adding another handoff?",
    "That could be relevant, but implementation has to be concrete. What is the first step my staff would actually see?",
    "I can evaluate an implementation path, but not as a vague promise. What changes in the approval workflow on day one?",
  ];
  const recent = getRecentVisibleHcpReplies(transcript, 6).map((line) => normalizeLineForContinuity(line));
  const seed = `${scenario?.id || scenario?.title || "scenario"}|${repMessage}|${hcpReply}|${transcript.length}`;
  const start = deterministicIndex(seed, variants.length);
  for (let offset = 0; offset < variants.length; offset += 1) {
    const candidate = variants[(start + offset) % variants.length];
    const normalizedCandidate = normalizeLineForContinuity(candidate);
    if (!recent.includes(normalizedCandidate)) return candidate;
  }
  return variants[start];
}

function needsImplementationTurnRepair({
  repMessage,
  hcpReply,
}: {
  repMessage: string;
  hcpReply: string;
}): boolean {
  const rep = String(repMessage || "").toLowerCase();
  if (!/\b(system implementation|implementation|implement|rollout|roll out|deploy|deployment|integrat|ehr|emr)\b/.test(rep)) {
    return false;
  }
  const reply = String(hcpReply || "").toLowerCase();
  const acknowledgesImplementation = /\b(implementation|implement|system|workflow|owner|owns|handoff|deploy|rollout|approval workflow)\b/.test(reply);
  const stuckOnAccessOnly = /\b(access step|prior auth|prior authorization|access process)\b/.test(reply)
    && !acknowledgesImplementation;
  return !acknowledgesImplementation || stuckOnAccessOnly;
}

function deterministicContinuityVariation({
  hcpReply,
  transcript,
  scenario,
}: {
  hcpReply: string;
  transcript: ConversationTurn[];
  scenario: any;
}): string {
  const latestConcern = getLatestHcpConcern(transcript, scenario);
  const concernTags = inferConcernTags(`${hcpReply} ${latestConcern}`);
  const text = String(hcpReply || "").trim().replace(/[.?!]+$/, "");
  const normalizedText = text.toLowerCase();

  if (!text) return hcpReply;
  if (/that still does not change the decision threshold/i.test(text)) {
    if (isEarlyDiscoveryStage(scenario)) {
      return "I still need the specific patient profile before this goes any further.";
    }
    return `${text}.`;
  }

  if (isInitialAccessStage(scenario)) {
    const pressures = Array.isArray(scenario?.interactionPressure)
      ? scenario.interactionPressure.map((value: string) => String(value).toLowerCase())
      : [];
    if (pressures.includes("time_constrained")) {
      return pressures.includes("operationally_constrained")
        ? "I have a few minutes. Give me the short version before my next patient, including what changes for my staff."
        : "I have a few minutes. Give me the short version before my next patient.";
    }
    return "Keep this practical. What's the reason to open the conversation?";
  }

  if (isEarlyDiscoveryStage(scenario)) {
    return concernTags.includes("screening") || concernTags.includes("patient_fit")
      ? "Which patient profile are you actually trying to help me identify?"
      : "I need the patient profile first, not a broader value claim.";
  }

  const concernFollowUp = (family: string): string => {
    switch (family) {
      case "workflow":
        return "Name the first staff step that changes.";
      case "access":
        return "Name the first access step that changes.";
      case "guideline":
      case "patient_fit":
        return "Which patient group does that affect first?";
      case "cost_value":
        return "Show me where the outcome justifies the cost.";
      case "evidence":
        return "Show me the proof that changes the decision.";
      default:
        return "Narrow this to the specific decision in front of me.";
    }
  };

  if (concernTags.includes("implementation")) {
    return buildImplementationAdaptiveReply({
      repMessage: text,
      hcpReply,
      transcript,
      scenario,
    });
  }

  if (concernTags.includes("workflow")) {
    if (/prior auth|prior authorization/i.test(text)) {
      return `${text.replace(/\bprior auth(?:orization)?\b/gi, "approval step")}. Name the first staff step that changes.`;
    }
    if (/staff|team|workflow|handoff|callback/i.test(text)) {
      return `${text}. ${concernFollowUp("workflow")}`;
    }
    return `${text}. ${concernFollowUp("workflow")}`;
  }

  if (concernTags.includes("access")) {
    return `${text}. ${concernFollowUp("access")}`;
  }

  if (concernTags.includes("guideline") || concernTags.includes("patient_fit")) {
    return `${text}. ${concernFollowUp("patient_fit")}`;
  }

  if (concernTags.includes("cost_value")) {
    return `${text}. ${concernFollowUp("cost_value")}`;
  }

  if (concernTags.includes("renal")) {
    if (
      /renal (?:impairment|function|patients?)/i.test(text) &&
      /(still does not address|still doesn't address|still does not tell me|still doesn't tell me|does not apply cleanly|doesn't apply cleanly|not enough for my patients)/i.test(text)
    ) {
      return "That still doesn't address what this means for the renal patients I manage.";
    }
    if (/what (?:that|this) means in the renal patients i manage|renal patients i manage/i.test(normalizedText)) {
      return `${text}.`;
    }
    return `${text} I still do not know what that means in the renal patients I manage.`;
  }

  return `${text}. ${concernFollowUp(concernTags[0] || "general")}`;
}

function needsContinuityVariationRewrite({
  hcpReply,
  transcript,
}: {
  hcpReply: string;
  transcript: ConversationTurn[];
}): boolean {
  const previousHcpLine = getLastHcpReplyText(transcript);
  const current = String(hcpReply || "").replace(/\s+/g, " ").trim().toLowerCase();
  const previous = String(previousHcpLine || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!current || !previous) return false;

  if (current === previous) return true;

  const currentTags = inferConcernTags(current);
  const previousTags = inferConcernTags(previous);
  const sharedTags = currentTags.filter((tag) => previousTags.includes(tag));
  const overlap = continuityOverlapScore(current, previous);

  if (sharedTags.length >= 1 && overlap >= 0.72) return true;
  if (sharedTags.length >= 1 && startsWithSameFrame(current, previous)) return true;

  return false;
}

function getLatestHcpConcern(transcript: ConversationTurn[], scenario: any): string {
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    if (transcript[i]?.speaker === "hcp" && transcript[i]?.text) {
      return String(transcript[i].text).toLowerCase();
    }
  }
  return String(scenario?.openingScene || "").toLowerCase();
}

function hasPriorHcpTurns(transcript: ConversationTurn[]): boolean {
  return transcript.some((turn) => turn?.speaker === "hcp" && typeof turn?.text === "string" && turn.text.trim().length > 0);
}

function deriveFirstTurnRepTopic(repMessage: string, scenario?: any): FirstTurnRepTopic {
  const text = String(repMessage || "").toLowerCase();
  const stageText = String(scenario?.journeyStage || "").toLowerCase();
  const scenarioText = `${scenario?.objective || ""} ${scenario?.description || ""} ${scenario?.openingScene || ""}`.toLowerCase();
  const accessPressured = Array.isArray(scenario?.interactionPressure)
    ? scenario.interactionPressure.map((value: string) => String(value).toLowerCase()).includes("access_barrier")
    : false;

  if (/clinical_value/.test(stageText)) {
    if (/\bvalue\b|\bcost\b|\bspend\b|\boutcome\b|\btreatment decision\b|\bpatients you would actually put on it\b/.test(text)) {
      return "clinical_value";
    }
    if (accessPressured && /\bapproval\b|\bprior auth\b|\bcoverage\b|\bformulary\b|\bpayer\b/.test(`${text} ${scenarioText}`)) {
      return "access";
    }
    if (/\bevidence\b|\bguideline\b|\boutcome\b|\bsafety\b|\btrial\b|\bstudy\b|\bdata\b/.test(text)) {
      return "evidence";
    }
    return "clinical_value";
  }
  if (/\bjama\b|\bstudy\b|\btrial\b|\bdata\b|\bjournal\b|\bpaper\b/.test(text)) return "study_follow_up";
  if (/\bpatient profile\b|\bright patient\b|\bwhich patients\b|\bwho fits\b|\bpatient type\b|\bsubgroup\b/.test(text)) return "screening";
  if (/\bprior auth\b|\bprior authorization\b|\bcoverage\b|\bformulary\b|\bpayer\b|\bapproval\b|\baccess\b/.test(text)) return "access";
  if (/\bstaff\b|\bworkflow\b|\bprocess\b|\bcallback\b|\brework\b/.test(text)) return "workflow";
  if (/\bevidence\b|\bguideline\b|\boutcome\b|\bsafety\b/.test(text)) return "evidence";
  return "general";
}

function extractRepFocusPhrase(repMessage: string): string {
  const text = String(repMessage || "").replace(/\s+/g, " ").trim();
  if (!text) return "";

  const patterns = [
    /\b(?:discuss|talk about|talk through|review|revisit|follow up on|following up on|go over|ask about|ask you about|come back to|circle back to|bring up|check in on)\s+(.+?)(?:[?.!]|$)/i,
    /\b(?:about|regarding|on)\s+(.+?)(?:[?.!]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = String(match?.[1] || "")
      .replace(/^the\s+/i, "")
      .replace(/^(a|an)\s+/i, "")
      .replace(/\b(i dropped off|you asked for|last week|earlier)\b/gi, (value) => value.toLowerCase())
      .replace(/\s+/g, " ")
      .trim();
    if (candidate && candidate.split(/\s+/).length <= 12) {
      return candidate;
    }
  }

  return "";
}

function tokenizeFocusPhrase(text: string): string[] {
  const stopwords = new Set([
    "about", "with", "that", "this", "have", "been", "your", "their", "from", "into", "what", "which", "would", "could", "should", "there", "here", "where", "when", "them", "they", "were", "late", "line"
  ]);

  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !stopwords.has(token));
}

function buildGenericLiveAdaptiveReply(repMessage: string, scenario: any): string {
  const focusPhrase = extractRepFocusPhrase(repMessage);
  const practicalAsk = deriveFirstTurnPracticalAsk(deriveFirstTurnRepTopic(repMessage, scenario), scenario);
  const pressures = Array.isArray(scenario?.interactionPressure)
    ? scenario.interactionPressure.map((value: string) => String(value).toLowerCase())
    : [];
  const timeConstrained = pressures.includes("time_constrained");

  if (focusPhrase) {
    return timeConstrained
      ? `If we're talking about ${focusPhrase}, keep it tight. ${practicalAsk}`
      : `If we're talking about ${focusPhrase}, be specific. ${practicalAsk}`;
  }

  return timeConstrained
    ? `I can give you a minute, but skip the pleasantries. ${practicalAsk}`
    : `I can listen, but make it specific. ${practicalAsk}`;
}

function buildFirstTurnRepAcknowledgement(repMessage: string, scenario: any): string {
  const repText = String(repMessage || "").trim();
  if (!repText) return "";

  const normalized = repText.toLowerCase();
  const pressures = Array.isArray(scenario?.interactionPressure)
    ? scenario.interactionPressure.map((value: string) => String(value).toLowerCase())
    : [];
  const timeConstrained = pressures.includes("time_constrained");

  if (/\bjama\b|\bstudy\b|\btrial\b|\bdata\b|\bpaper\b|\bevidence\b/.test(normalized)) {
    return "";
  }
  if (/\bprior auth|prior authorization|coverage|formulary|payer|approval|access\b/.test(normalized)) {
    if (/\bstaff|workflow|office|callback|handoff|process\b/.test(normalized)) {
      return timeConstrained ? "I have a few minutes. What changes in access for my staff?" : "What changes in access or workflow for my staff?";
    }
    return timeConstrained ? "I have a few minutes. What changes in the access step?" : "What changes in the access step?";
  }
  if (/\bstaff|workflow|office|callback|handoff|process\b/.test(normalized)) {
    return timeConstrained ? "I have a few minutes. What changes for my staff?" : "What changes for my staff?";
  }
  if (/\bwhich patient|which patients|patient subgroup|right fit|patient fit|patient profile|selection\b/.test(normalized)) {
    return timeConstrained ? "I hear the patient-fit question, but keep it brief." : "I hear the patient-fit question.";
  }
  if (/\bhow are you|how's it going|how are things\b/.test(normalized)) {
    return "";
  }
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(normalized)) {
    return "";
  }
  if (/\bcan we speak|can we talk|do you have a minute|can i speak with you|can i talk with you\b/.test(normalized)) {
    return timeConstrained ? "Briefly." : "I can talk briefly.";
  }
  if (/\bnot sure|just checking in|wanted to check in|quick question\b/.test(normalized)) {
    return timeConstrained ? "Keep the question tight." : "I hear you, but make the question concrete.";
  }

  return "";
}

function withFirstTurnRepAcknowledgement(reply: string, repMessage: string, scenario: any): string {
  const value = String(reply || "").trim();
  const acknowledgement = buildFirstTurnRepAcknowledgement(repMessage, scenario);
  if (!acknowledgement || !value) return value;

  const normalized = value.toLowerCase();
  const ackNormalized = acknowledgement.toLowerCase().replace(/[.?!]+$/, "");
  if (normalized.startsWith(ackNormalized) || /^(hi\.|i'm fine|briefly\.|i can talk briefly|i hear you)/i.test(value)) {
    return value;
  }

  return `${acknowledgement} ${value}`;
}

function deriveLiveConversationConcern(transcript: ConversationTurn[], scenario: any, repMessage: string): string {
  if (hasPriorHcpTurns(transcript)) {
    const latestConcern = getLatestHcpConcern(transcript, scenario);
    if (repAddressesPremiseChallenge(repMessage, latestConcern) || repAddressesRecentPremiseChallenge(repMessage, transcript)) {
      return [String(repMessage || "").trim().toLowerCase(), latestConcern].filter(Boolean).join(" | ");
    }

    const repTags = inferConcernTags(repMessage);
    const concernTags = inferConcernTags(latestConcern);
    const sharedTags = repTags.filter((tag) => concernTags.includes(tag));
    if (sharedTags.length > 0) {
      return [latestConcern, String(repMessage || "").trim().toLowerCase()].filter(Boolean).join(" | ");
    }

    return latestConcern;
  }

  const repText = String(repMessage || "").trim().toLowerCase();
  const scenarioText = String(scenario?.objective || scenario?.description || scenario?.openingScene || "").trim().toLowerCase();
  return [repText, scenarioText].filter(Boolean).join(" | ");
}

function deriveFirstTurnPracticalAsk(topic: FirstTurnRepTopic, scenario: any): string {
  const scenarioText = `${scenario?.objective || ""} ${scenario?.description || ""} ${scenario?.openingScene || ""}`.toLowerCase();
  const accessTagged = /\bprior auth\b|\bcoverage\b|\bformulary\b|\bapproval\b|\baccess\b/.test(scenarioText);
  const workflowTagged = /\bstaff\b|\bworkflow\b|\bprocess\b|\boffice\b|\bclinic\b|\bcallback\b/.test(scenarioText);
  const screeningTagged = /\bpatient\b|\bsubgroup\b|\bfit\b|\bselection\b/.test(scenarioText);
  const clinicalValueStage = String(scenario?.journeyStage || "").toLowerCase() === "clinical_value";
  const initialAccessStage = isInitialAccessStage(scenario);
  const renalTagged = /\brenal\b|\bkidney\b|\bckd\b|\bimpairment\b/.test(scenarioText);
  const pressures = Array.isArray(scenario?.interactionPressure)
    ? scenario.interactionPressure.map((value: string) => String(value).toLowerCase())
    : [];

  if (initialAccessStage) {
    if (topic === "study_follow_up") {
      return "Give me the patient decision it changes before my next room.";
    }
    if (topic === "evidence") {
      return "Give me the evidence point that changes a patient decision before my next room.";
    }
    if (topic === "screening") {
      return "Give me the patient group this changes before my next room.";
    }
    if (topic === "access") {
      return "Give me the access step that changes before my next room.";
    }
    if (topic === "workflow") {
      return "Give me the staff step that changes before my next room.";
    }
    if (pressures.includes("time_constrained") && pressures.includes("operationally_constrained")) {
      return "Give me the short version before my next patient: what changes for my staff?";
    }
    if (pressures.includes("time_constrained")) {
      return "Give me the short version before my next patient.";
    }
    if (pressures.includes("operationally_constrained")) {
      return "Keep it practical for the office.";
    }
    return "What's this about for my patients?";
  }

  const clinicalValueEvidenceAsk = () => (
    renalTagged
      ? "Which renal-impairment subgroup in the trial maps to the patients I actually see, and what outcome would change a treatment decision?"
      : "Which trial subgroup maps to the patients I actually treat, and what outcome would change a treatment decision?"
  );

  if (topic === "clinical_value") {
    if (accessTagged) {
      return "What outcome still justifies treatment after total cost per patient, and what changes in the approval path so my MA is not reopening the case?";
    }
    if (workflowTagged) {
      return "What patient-level outcome is strong enough to justify total cost, and which concrete staff step actually comes off the workflow?";
    }
    return "What patient-level outcome actually changes a treatment decision enough to justify the spend in real practice?";
  }
  if (topic === "study_follow_up") {
    if (clinicalValueStage) {
      return clinicalValueEvidenceAsk();
    }
    return "What in that study do you think should change a real treatment decision for me?";
  }
  if (topic === "access" || accessTagged) {
    return "What changes in the access step or for my staff if this actually matters?";
  }
  if (topic === "workflow" || workflowTagged) {
    return "Which staff step changes first if this is worth discussing?";
  }
  if (clinicalValueStage && (topic === "screening" || topic === "evidence" || screeningTagged)) {
    return clinicalValueEvidenceAsk();
  }
  if (topic === "screening" || screeningTagged) {
    return "Which patient subgroup are you actually trying to change care for?";
  }
  if (topic === "evidence") {
    return "What do you think the evidence changes for how I treat patients?";
  }
  return "What do you think this changes for me or for my patients?";
}

function selectNonRepeatingFallbackVariant({
  variants,
  transcript,
  seed,
}: {
  variants: string[];
  transcript: ConversationTurn[];
  seed: string;
}): string {
  if (!Array.isArray(variants) || variants.length === 0) return "";
  const recent = getRecentVisibleHcpReplies(transcript, 6);
  const start = deterministicIndex(seed, variants.length);

  for (let offset = 0; offset < variants.length; offset += 1) {
    const candidate = variants[(start + offset) % variants.length];
    const nearDuplicate = recent.some((line) => {
      const overlap = continuityOverlapScore(candidate, line);
      const containment = continuityContainmentScore(candidate, line);
      return startsWithSameFrame(candidate, line) || overlap >= 0.72 || containment >= 0.8;
    });
    if (!nearDuplicate) return candidate;
  }

  return variants[start];
}

function buildClinicalValueReplyVariants({
  practicalAsk,
  timeConstrained,
  accessTagged,
  workflowTagged,
}: {
  practicalAsk: string;
  timeConstrained: boolean;
  accessTagged: boolean;
  workflowTagged: boolean;
}): string[] {
  const variants: string[] = [];

  if (accessTagged || workflowTagged) {
    variants.push(
      timeConstrained
        ? `I have a narrow window. ${practicalAsk}`
        : `Before we talk broad value, ${practicalAsk.charAt(0).toLowerCase()}${practicalAsk.slice(1)}`
    );
  }

  variants.push(
    timeConstrained
      ? `I have time for the practical threshold. ${practicalAsk}`
      : `Value only matters if it changes a real patient decision. ${practicalAsk}`
  );

  if (accessTagged) {
    variants.push(
      timeConstrained
        ? "I need the short version: what changes in prior auth for staff, and what outcome still justifies cost per patient?"
        : "I need the operational answer: what changes in prior auth for my staff, and what outcome still justifies cost per patient?"
    );
  }

  if (workflowTagged) {
    variants.push(
      timeConstrained
        ? "Keep this practical: what staff step comes off first, and what outcome still justifies the total spend?"
        : "Keep this practical: which staff step comes off first, and what patient outcome still justifies the total spend?"
    );
  }

  return variants.filter(Boolean);
}

function isClinicalValueStage(scenario: any): boolean {
  return String(scenario?.journeyStage || "").toLowerCase() === "clinical_value";
}

function isEarlyDiscoveryStage(scenario: any): boolean {
  return ["early_discovery", "discovery"].includes(String(scenario?.journeyStage || "").toLowerCase());
}

function buildClinicalValueAccessWorkflowReply(repMessage: string, scenario: any, transcript: ConversationTurn[] = []): string {
  const seed = `${scenario?.id || scenario?.title || "scenario"}|${repMessage}|${transcript.length}|clinical_value_access_workflow`;
  const variants = [
    "The efficacy data is fine, but for the subgroup who can actually get through prior auth, what outcome justifies the cost and what work still lands on my MA?",
    "Before I call that value, I need the trial outcome for the patients likely to clear coverage, and whether my staff avoids another callback.",
    "The clinical question is not cost alone. It is whether the efficacy holds for the right patients and whether the access process keeps my staff out of a second repair cycle.",
    "If this is value, tie it to the treated subgroup, the prior-auth path, and the workflow burden. Otherwise I cannot tell if it changes a real decision.",
    "Show me the patient-level outcome, then tell me whether coverage can clear without another staff handoff. That is the only value equation that matters here.",
  ];

  return selectNonRepeatingFallbackVariant({
    variants,
    transcript,
    seed,
  });
}

function enforceClinicalValueAccessWorkflowSurface({
  hcpReply,
  repMessage,
  scenario,
  transcript,
}: {
  hcpReply: string;
  repMessage: string;
  scenario: any;
  transcript: ConversationTurn[];
}): string {
  if (!isClinicalValueStage(scenario)) return hcpReply;

  const pressures = Array.isArray(scenario?.interactionPressure)
    ? scenario.interactionPressure.map((value: string) => String(value).toLowerCase())
    : [];
  const requiresAccess = pressures.includes("access_barrier");
  const requiresWorkflow = pressures.includes("operationally_constrained");
  if (!requiresAccess && !requiresWorkflow) return hcpReply;

  const value = String(hcpReply || "").trim();
  const hasClinicalAnchor = /\btrial|guideline|renal|efficacy|safety|subgroup\b/i.test(value);
  const hasAccessAnchor = /\bformulary|non-preferred|prior auth|prior authorization|committee|access|payer|coverage\b/i.test(value);
  const hasWorkflowAnchor = /\bstaff|workflow|handoff|callback|extra step|extra steps|process|MA\b/i.test(value);
  const costOnlyLoop = /\btotal cost per patient\b|\badded cost per patient\b|\bcost side is unclear\b/i.test(value)
    && (!hasAccessAnchor || !hasWorkflowAnchor || !hasClinicalAnchor);

  if (
    (!requiresAccess || hasAccessAnchor) &&
    (!requiresWorkflow || hasWorkflowAnchor) &&
    hasClinicalAnchor &&
    !costOnlyLoop
  ) {
    return hcpReply;
  }

  const repaired = buildClinicalValueAccessWorkflowReply(repMessage, scenario, transcript);
  return hasPriorHcpTurns(transcript)
    ? repaired
    : withFirstTurnRepAcknowledgement(repaired, repMessage, scenario);
}

function buildClinicalValueEvidenceSurfaceReply(repMessage: string, scenario: any, transcript: ConversationTurn[] = []): string {
  const scenarioText = `${scenario?.objective || ""} ${scenario?.description || ""} ${scenario?.openingScene || ""}`.toLowerCase();
  const renalTagged = /\brenal\b|\bkidney\b|\bckd\b|\bimpairment\b/.test(scenarioText);
  const seed = `${scenario?.id || scenario?.title || "scenario"}|${repMessage}|${transcript.length}|clinical_value_evidence_surface`;
  const variants = renalTagged
    ? [
      "I am not convinced by the broad trial average. Which renal-impairment subgroup maps to my patients, and what outcome changes the treatment decision?",
      "For this to land clinically, I need the renal subgroup, the endpoint, and why that changes what I do with the patients excluded from the headline result.",
      "The hazard ratio is not enough for me. Show me the subgroup that resembles my moderate renal-impairment patients and the outcome that changes treatment.",
    ]
    : [
      "I am not convinced by the broad trial average. Which subgroup maps to my patients, and what outcome changes the treatment decision?",
      "For this to land clinically, I need the subgroup, the endpoint, and why that changes what I do with the patients I actually treat.",
      "The headline result is not enough for me. Show me the patient group that matches my practice and the outcome that changes treatment.",
    ];

  return selectNonRepeatingFallbackVariant({
    variants,
    transcript,
    seed,
  });
}

function enforceClinicalValueEvidenceSurface({
  hcpReply,
  repMessage,
  scenario,
  transcript,
}: {
  hcpReply: string;
  repMessage: string;
  scenario: any;
  transcript: ConversationTurn[];
}): string {
  if (!isClinicalValueStage(scenario)) return hcpReply;

  const value = String(hcpReply || "").trim();
  const pressures = Array.isArray(scenario?.interactionPressure)
    ? scenario.interactionPressure.map((item: string) => String(item).toLowerCase())
    : [];
  const hasClinicalAnchor = /\btrial|guideline|renal|efficacy|safety|subgroup|outcome|endpoint|hazard ratio|treatment decision\b/i.test(value);
  const hasOperationalOrAccessAnchor = /\bprior auth|coverage|payer|approval|access|staff|workflow|MA|handoff|callback|process\b/i.test(value);
  const earlyDiscoveryLeak = /\bwhich patients do you think\b|\bwhich patients\?\b|\bwhat are you seeing\b|\bgo over today\b/i.test(value);
  const needsSkepticalPressure = pressures.includes("skeptical_resistant")
    && !hasOperationalOrAccessAnchor
    && !/\bnot convinced|broad trial average|headline result|trial design|threshold\b/i.test(value);

  if (hasClinicalAnchor && !earlyDiscoveryLeak && !needsSkepticalPressure) {
    return hcpReply;
  }

  const repaired = buildClinicalValueEvidenceSurfaceReply(repMessage, scenario, transcript);
  return !hasPriorHcpTurns(transcript)
    ? withFirstTurnRepAcknowledgement(repaired, repMessage, scenario)
    : repaired;
}

function isInitialAccessStage(scenario: any): boolean {
  return String(scenario?.journeyStage || "").toLowerCase() === "initial_access";
}

function buildInitialAccessAlignedReply(repMessage: string, scenario: any, transcript: ConversationTurn[] = []): string {
  const pressures = Array.isArray(scenario?.interactionPressure)
    ? scenario.interactionPressure.map((value: string) => String(value).toLowerCase())
    : [];
  const timeConstrained = pressures.includes("time_constrained");
  const operational = pressures.includes("operationally_constrained");
  const skeptical = pressures.includes("skeptical_resistant");
  const topic = deriveFirstTurnRepTopic(repMessage, scenario);
  const rawRepFocus = extractRepFocusPhrase(repMessage);
  const repFocus = /\bprior auth|prior authorization|approval|access|coverage|formulary|payer|workflow\b/i.test(rawRepFocus)
    ? ""
    : rawRepFocus;
  const seed = `${scenario?.id || scenario?.title || "scenario"}|${repMessage}|${transcript.length}|initial_access`;

  if (topic === "study_follow_up") {
    return selectNonRepeatingFallbackVariant({
      variants: timeConstrained
        ? [
          "If it is a new study, give me the patient decision it changes before my next room.",
          "Tie the study to one patient decision before my next room.",
          "Give me the data point and the patient decision it changes.",
        ]
        : [
          "Tie the study to one patient decision I should handle differently.",
          "What patient decision does the study change?",
          "Give me the data point that changes how I treat a patient.",
        ],
      transcript,
      seed: `${seed}|study`,
    });
  }

  if (topic === "evidence") {
    return selectNonRepeatingFallbackVariant({
      variants: timeConstrained
        ? [
          "Give me the evidence point that changes a patient decision before my next room.",
          "What proof changes what I do for a patient before my next room?",
        ]
        : [
          "What evidence point changes a real patient decision?",
          "Show me the proof that changes how I treat a patient.",
        ],
      transcript,
      seed: `${seed}|evidence`,
    });
  }

  const variants = operational
    ? [
      "I have a few minutes. Give me the short version: what does my staff have to do differently?",
      "Keep it quick. What changes for the office before this is worth a real conversation?",
      "I'm between patients. What is the practical reason my staff should pay attention?",
    ]
    : skeptical
      ? [
        "I have a few minutes. What changes for my patients if I give this time?",
        "Be concrete. What changes for the patients I actually see?",
        "Give me the short version. What patient decision changes first?",
      ]
      : [
        "I have a few minutes. What's this about for my patients?",
        "Give me the short version. What are you trying to understand today?",
        "I can listen briefly. What is the practical reason for the conversation?",
      ];

  const focusedVariants = repFocus
    ? variants.map((line) => line.replace(/\?$/, `, specifically around ${repFocus}?`))
    : variants;

  if (!timeConstrained && !skeptical && !operational) {
    focusedVariants.push("Before we get into details, what are you trying to learn from me today?");
  }

  return selectNonRepeatingFallbackVariant({
    variants: focusedVariants,
    transcript,
    seed,
  });
}

function enforceInitialAccessSurface({
  hcpReply,
  repMessage,
  scenario,
  transcript,
}: {
  hcpReply: string;
  repMessage: string;
  scenario: any;
  transcript: ConversationTurn[];
}): string {
  if (!isInitialAccessStage(scenario)) return hcpReply;

  const value = String(hcpReply || "").trim();
  const lower = value.toLowerCase();
  const repTopic = deriveFirstTurnRepTopic(repMessage, scenario);
  const topicAnchored =
    (repTopic === "study_follow_up" && /\bstudy|trial|data|paper|journal|evidence|patient decision|patients\b/i.test(value)) ||
    (repTopic === "evidence" && /\bevidence|data|trial|outcome|patient decision|patients\b/i.test(value)) ||
    (repTopic === "screening" && /\bpatient|subgroup|profile|fit|selection|group\b/i.test(value)) ||
    (repTopic === "access" && /\baccess|prior auth|prior authorization|coverage|approval|formulary|payer|staff\b/i.test(value)) ||
    (repTopic === "workflow" && /\bstaff|workflow|handoff|callback|process|office\b/i.test(value));

  if (repTopic !== "general" && topicAnchored) {
    return hcpReply;
  }

  const repeatsOpeningScene = (() => {
    const opening = String(scenario?.openingScene || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!opening) return false;
    const openingHead = opening.split(/\s+/).slice(0, 8).join(" ");
    return Boolean(openingHead && lower.includes(openingHead));
  })();

  const driftedIntoDownstreamLane =
    /\bprior auth|prior authorization|approval path|access step|formulary|coverage|payer\b/i.test(value) ||
    /\bworkflow\b/i.test(value) ||
    /^(look,|be specific\.?$|keep this practical\.?(?: one practical point\.?)?)$/i.test(value);

  const lostOpeningPressure =
    !/\bfew minutes|short version|briefly|between patients|worth the time|what'?s this about|\bquick\b/i.test(value);

  if (!repeatsOpeningScene && !driftedIntoDownstreamLane && !lostOpeningPressure) {
    return hcpReply;
  }

  return buildInitialAccessAlignedReply(repMessage, scenario, transcript);
}

function buildFirstTurnAlignedReply(repMessage: string, scenario: any): string {
  const topic = deriveFirstTurnRepTopic(repMessage, scenario);
  const text = String(repMessage || "").toLowerCase();
  const greetingOnly = /^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(text)
    || /\bhow are you|how's it going|how are things\b/.test(text);

  if (isInitialAccessStage(scenario) && topic === "general") {
    if (greetingOnly) {
      return "I have a few minutes. What are you asking me to consider?";
    }
    return withFirstTurnRepAcknowledgement(
      buildInitialAccessAlignedReply(repMessage, scenario),
      repMessage,
      scenario,
    );
  }

  const scenarioText = `${scenario?.objective || ""} ${scenario?.description || ""} ${scenario?.openingScene || ""}`.toLowerCase();
  const pressures = Array.isArray(scenario?.interactionPressure) ? scenario.interactionPressure.map((value: string) => String(value).toLowerCase()) : [];
  const timeConstrained = pressures.includes("time_constrained");
  const accessTagged = /\bprior auth\b|\bcoverage\b|\bformulary\b|\bapproval\b|\baccess\b/.test(scenarioText) || pressures.includes("access_barrier");
  const workflowTagged = /\bstaff\b|\bworkflow\b|\bprocess\b|\boffice\b|\bclinic\b|\bcallback\b/.test(scenarioText) || pressures.includes("operationally_constrained");
  const practicalAsk = deriveFirstTurnPracticalAsk(topic, scenario);
  const hasFollowUpSignal = /\bfollow(?:ing)? up\b|\blast week\b|\byou asked\b|\bdropped off\b|\bwe discussed\b|\bearlier\b/.test(text);

  if (topic === "study_follow_up") {
    if (timeConstrained && hasFollowUpSignal) return withFirstTurnRepAcknowledgement(`I remember the study. ${practicalAsk}`, repMessage, scenario);
    if (timeConstrained) return withFirstTurnRepAcknowledgement(`If this is a new study, ${practicalAsk.charAt(0).toLowerCase()}${practicalAsk.slice(1)}`, repMessage, scenario);
    if (hasFollowUpSignal) return withFirstTurnRepAcknowledgement(`I remember the study. ${practicalAsk}`, repMessage, scenario);
    return withFirstTurnRepAcknowledgement(`If this is about the study, be specific. ${practicalAsk}`, repMessage, scenario);
  }
  if (topic === "access") {
    return withFirstTurnRepAcknowledgement(timeConstrained
      ? `If this is about access, keep it tight. ${practicalAsk}`
      : `If this is about access, be specific. ${practicalAsk}`, repMessage, scenario);
  }
  if (topic === "workflow") {
    return withFirstTurnRepAcknowledgement(timeConstrained
      ? `If this is about workflow, keep it tight. ${practicalAsk}`
      : `If this is about workflow, be specific. ${practicalAsk}`, repMessage, scenario);
  }
  if (topic === "clinical_value") {
    const variants = buildClinicalValueReplyVariants({
      practicalAsk,
      timeConstrained,
      accessTagged,
      workflowTagged,
    });
    const index = deterministicIndex(`${scenario?.id || scenario?.title || "scenario"}|${repMessage}|clinical_value`, variants.length);
    return withFirstTurnRepAcknowledgement(
      variants[index] || `Value only matters if it changes a real patient decision. ${practicalAsk}`,
      repMessage,
      scenario,
    );
  }
  if (topic === "screening") {
    if (isClinicalValueStage(scenario)) {
      return withFirstTurnRepAcknowledgement(
        `If this is about patient fit, tie it to the trial subgroup and decision threshold. ${practicalAsk}`,
        repMessage,
        scenario,
      );
    }
    return withFirstTurnRepAcknowledgement(`If you're talking patient fit, be specific. ${practicalAsk}`, repMessage, scenario);
  }
  if (topic === "evidence") {
    if (isClinicalValueStage(scenario)) {
      return withFirstTurnRepAcknowledgement(
        `If this is about the evidence, broad averages will not move me. ${practicalAsk}`,
        repMessage,
        scenario,
      );
    }
    return withFirstTurnRepAcknowledgement(`If this is about the evidence, be specific. ${practicalAsk}`, repMessage, scenario);
  }
  return withFirstTurnRepAcknowledgement(buildGenericLiveAdaptiveReply(repMessage, scenario), repMessage, scenario);
}

function firstTurnReplyIgnoresRep(hcpReply: string, repMessage: string, transcript: ConversationTurn[]): boolean {
  const replyText = String(hcpReply || "").toLowerCase();
  const repText = String(repMessage || "").toLowerCase();
  const repTags = inferConcernTags(repText);
  const replyTags = inferConcernTags(replyText);
  const sharedTags = repTags.filter((tag) => replyTags.includes(tag));
  const focusTokens = tokenizeFocusPhrase(extractRepFocusPhrase(repMessage));
  const isOpeningHcpReply = !hasPriorHcpTurns(transcript);
  const hasRepInput = repText.trim().length > 0;
  const genericRepOpener = /\b(hi|hello|hey|good morning|good afternoon|good to see you|how are you|how's it going|thanks for seeing me)\b/.test(repText);

  if (/\bjama\b|\bstudy\b|\btrial\b|\bdata\b|\bjournal\b|\bpaper\b/.test(repText) && !/\bjama\b|\bstudy\b|\btrial\b|\bdata\b|\bjournal\b|\bpaper\b/.test(replyText)) {
    return true;
  }

  if (isOpeningHcpReply && hasRepInput && genericRepOpener) {
    return true;
  }

  if (sharedTags.length === 0 && repTags.length > 0) {
    return true;
  }

  if (focusTokens.length > 0 && !focusTokens.some((token) => replyText.includes(token))) {
    return true;
  }

  if (hasPriorHcpTurns(transcript) && /\bwhy are you here\b|\bwhat'?s this about\b|\bwhat is this about\b/.test(replyText)
    && (repAddressesRecentPremiseChallenge(repMessage, transcript) || repAddressesPremiseChallenge(repMessage, getLatestHcpConcern(transcript, {})))) {
    return true;
  }

  if (/\bmy patients are doing pretty well\b|\bwhat would make you think i need something different\b/.test(replyText)
    && /\bjama\b|\bstudy\b|\btrial\b|\bdata\b|\bjournal\b|\bpaper\b/.test(repText)) {
    return true;
  }

  return false;
}

function buildFirstTurnCueOverride(repMessage: string, scenario: any): string {
  const topic = deriveFirstTurnRepTopic(repMessage, scenario);
  const pressures = Array.isArray(scenario?.interactionPressure) ? scenario.interactionPressure.map((value: string) => String(value).toLowerCase()) : [];
  const timeConstrained = pressures.includes("time_constrained");

  if (topic === "study_follow_up") {
    return timeConstrained
      ? "Keeps the study page in view, checks the clock once, then looks back for the point."
      : "Keeps the study page in view and looks back like the relevance still has to be proven.";
  }
  if (topic === "access") {
    return timeConstrained
      ? "Checks the clock, prior-auth notes still in view, and looks back for one practical answer."
      : "Keeps the access notes in view and looks back for one practical answer.";
  }
  if (topic === "workflow") {
    return timeConstrained
      ? "Checks the schedule, one hand still on the clinic notes, and looks back for the point."
      : "Keeps a hand on the clinic notes and looks back like this needs to get practical quickly.";
  }
  if (topic === "screening") {
    return "Keeps the patient list in view and waits for you to get specific.";
  }
  return timeConstrained
    ? "Checks the clock, then looks back for the point."
    : "Looks back with professional reserve, waiting for you to get specific.";
}

function buildDeterministicHcpFallbackReply({
  scenario,
  transcript,
  repMessage,
  currentBehaviorState,
  prediction,
}: {
  scenario: any;
  transcript: ConversationTurn[];
  repMessage: string;
  currentBehaviorState: string;
  prediction: any;
}): string {
  const repText = String(repMessage || "").trim();
  const latestConcern = getLatestHcpConcern(transcript, scenario);
  const concernTags = inferConcernTags(`${repText} ${latestConcern}`);
  const stageText = String(scenario?.journeyStage || "").toLowerCase();
  const pressures = Array.isArray(scenario?.interactionPressure) ? scenario.interactionPressure.map((value: string) => String(value).toLowerCase()) : [];
  const clinicalValueStage = /clinical_value/.test(stageText);
  const accessPressured = pressures.includes("access_barrier");
  const workflowPressured = pressures.includes("operationally_constrained");

  if (!hasPriorHcpTurns(transcript)) {
    return buildFirstTurnAlignedReply(repMessage, scenario);
  }

  if (isInitialAccessStage(scenario)) {
    return buildInitialAccessAlignedReply(repMessage, scenario, transcript);
  }

  if (clinicalValueStage) {
    const stageSeed = `${scenario?.id || scenario?.title || "scenario"}|${repText}|${latestConcern}|${transcript.length}|clinical_value_fallback`;
    const accessWorkflowVariants = [
      "Before we continue, what changes in the approval path so my MA is not reopening the same case, and what outcome still justifies total cost per patient?",
      "If this is a value conversation, I need both parts: what access step gets cleaner for staff, and what endpoint still justifies the spend for a real patient?",
      "Keep this practical: what prior-auth step gets easier for my team, and what patient-level outcome is strong enough to justify total spend?",
    ];
    const workflowVariants = [
      "Before this becomes a value discussion, what office step actually comes off my staff, and what patient-level outcome still justifies full cost per patient?",
      "If we are talking value, be concrete: what workflow burden drops first, and what outcome changes treatment in real practice?",
      "For value to matter here, I need one staff step that gets easier and one patient outcome that justifies the spend.",
    ];
    const clinicalValueVariants = [
      "Before this becomes a value discussion, what patient-level outcome actually changes treatment enough to justify total cost?",
      "If this is about value, be specific: what endpoint changes a real decision for the patients I would actually treat?",
      "Value only matters if the outcome changes a real treatment choice. What is that change for my patient mix?",
    ];

    if (accessPressured) {
      return selectNonRepeatingFallbackVariant({
        variants: accessWorkflowVariants,
        transcript,
        seed: `${stageSeed}|access`,
      });
    }
    if (workflowPressured || concernTags.includes("cost_value")) {
      return selectNonRepeatingFallbackVariant({
        variants: workflowVariants,
        transcript,
        seed: `${stageSeed}|workflow`,
      });
    }
    return selectNonRepeatingFallbackVariant({
      variants: clinicalValueVariants,
      transcript,
      seed: `${stageSeed}|general`,
    });
  }

  if (concernTags.includes("implementation")) {
    return buildImplementationAdaptiveReply({
      repMessage,
      hcpReply: repText,
      transcript,
      scenario,
    });
  }

  if (concernTags.includes("workflow")) {
    return "Keep this practical for the office. What staff step actually gets easier first?";
  }
  if (concernTags.includes("access")) {
    return "Be specific about access. What changes in the approval path for my staff first?";
  }
  if (concernTags.includes("cost_value")) {
    return "Keep this on value. What outcome justifies the full cost per patient?";
  }
  if (concernTags.includes("patient_fit") || concernTags.includes("guideline")) {
    return "Which patients does that actually change for in practice?";
  }
  if (concernTags.includes("renal") || concernTags.includes("safety")) {
    return "What lowers the risk enough to change treatment for the patients I actually manage?";
  }
  if (prediction?.concernFamily === "evidence" || concernTags.includes("evidence")) {
    return "Keep this on the evidence. What proof changes the treatment decision for a real patient?";
  }

  if (currentBehaviorState === "closed" || currentBehaviorState === "resistance") {
    return "I can listen, but keep it specific: which patients in my clinic actually change, and what outcome changes first?";
  }

  return "Be specific for my practice. Which patient changes first, and why?";
}

function enforceFirstTurnRepAdaptation({
  hcpReply,
  repMessage,
  scenario,
  transcript,
}: {
  hcpReply: string;
  repMessage: string;
  scenario: any;
  transcript: ConversationTurn[];
}): FirstTurnAlignmentResult {
  if (!firstTurnReplyIgnoresRep(hcpReply, repMessage, transcript)) {
    return {
      applied: false,
      hcpReply,
      cueOverride: "",
    };
  }

  return {
    applied: true,
    hcpReply: hasPriorHcpTurns(transcript)
      ? buildFirstTurnAlignedReply(repMessage, scenario)
        .replace(/^I remember the study, but you'll need to keep this quick\.\s*/i, "")
        .replace(/^I remember the study\.\s*/i, "")
        .replace(/^If this is about the study, be specific\.\s*/i, "")
        .replace(/^If this is about access, keep it tight\.\s*/i, "")
        .replace(/^If this is about access, be specific\.\s*/i, "")
        .replace(/^If this is about workflow, keep it tight\.\s*/i, "")
        .replace(/^If this is about workflow, be specific\.\s*/i, "")
        .replace(/^If you're talking patient fit, be specific\.\s*/i, "")
        .replace(/^If this is about the evidence, be specific\.\s*/i, "")
        .trim()
      : buildFirstTurnAlignedReply(repMessage, scenario),
    cueOverride: buildFirstTurnCueOverride(repMessage, scenario),
  };
}

function getLastHcpReplyText(transcript: ConversationTurn[]): string {
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    if (transcript[i]?.speaker === "hcp" && transcript[i]?.text) {
      return String(transcript[i].text).trim();
    }
  }
  return "";
}

function summarizeConcernContinuity(transcript: ConversationTurn[], scenario: any, repMessage: string): string {
  const hcpTurns = transcript
    .filter((turn) => turn?.speaker === "hcp" && typeof turn?.text === "string")
    .slice(-4)
    .map((turn) => String(turn.text).trim());

  const recentConcerns = hcpTurns.map((line) => inferConcernTags(line)).flat();
  const concernCounts = recentConcerns.reduce<Record<string, number>>((acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {});
  const dominantConcern = Object.entries(concernCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "none";
  const latestConcern = deriveLiveConversationConcern(transcript, scenario, repMessage);
  const repeatedLatest = hcpTurns.filter((line) => {
    const tags = inferConcernTags(line);
    const latestTags = inferConcernTags(latestConcern);
    return latestTags.some((tag) => tags.includes(tag));
  }).length;

  const summaryLines = [
    "LONGER MEMORY CONTINUITY:",
    `- Dominant unresolved concern: ${dominantConcern}`,
    `- Latest concern text: ${latestConcern || "none"}`,
    `- Repeated latest-concern count in recent HCP turns: ${repeatedLatest}`,
  ];

  if (hcpTurns.length) {
    summaryLines.push(`- Recent HCP trajectory: ${hcpTurns.join(" | ")}`);
  }

  summaryLines.push("- Do not introduce a new blocker unless the rep clearly resolved the current one.");
  summaryLines.push("- Keep the HCP's agenda continuous across turns: same problem, sharper wording, narrower condition.");

  return summaryLines.join("\n");
}



function getRecentVisibleHcpReplies(transcript: ConversationTurn[], limit = 5): string[] {
  return transcript
    .filter((turn) => turn?.speaker === "hcp" && typeof turn?.text === "string")
    .map((turn) => String(turn.text || "").trim())
    .filter(Boolean)
    .slice(-Math.max(3, Math.min(5, limit)));
}

function inferSkeletonSignature(text = ""): string {
  const lower = String(text || "").toLowerCase();
  if (/\bwhat in that study\b/.test(lower)) return "what_in_study";
  if (/\bwhat specifically\b/.test(lower)) return "what_specifically";
  if (/\bwhat changes for my staff\b/.test(lower)) return "staff_change";
  if (/\bwhich endpoint\b/.test(lower)) return "which_endpoint";
  if (/\bwhich patients\b/.test(lower)) return "which_patients";
  if (/\bkeep it specific\b/.test(lower)) return "keep_specific";
  if (/\bwhat changes clinically\b/.test(lower)) return "clinical_change";
  if (/^(what|which|how)\b/.test(lower)) return "question_open";
  return "";
}

function applyRecentHcpLoopGuard(hcpReply: string, transcript: ConversationTurn[], scenario: any): string {
  const recent = getRecentVisibleHcpReplies(transcript, 5);
  const current = String(hcpReply || "").trim();
  if (!current || !recent.length) return hcpReply;
  const normalizedCurrent = normalizeLineForContinuity(current);
  const normalizedRecent = recent.map((line) => normalizeLineForContinuity(line));
  const exactRepeat = normalizedRecent.includes(normalizedCurrent);

  const skeleton = inferSkeletonSignature(current);
  const repeatedSkeleton = skeleton && recent.slice(-3).some((line) => inferSkeletonSignature(line) === skeleton);
  const highOverlapRepeat = recent.slice(-4).some((line) =>
    continuityOverlapScore(current, line) >= 0.68
    || continuityContainmentScore(current, line) >= 0.82
    || startsWithSameFrame(current, line)
  );

  const currentTags = inferConcernTags(current);
  const repeatedIntent = recent.slice(-3).filter((line) => {
    const tags = inferConcernTags(line);
    return currentTags.some((tag) => tags.includes(tag));
  }).length >= 2;

  if (!exactRepeat && !repeatedSkeleton && !highOverlapRepeat && !repeatedIntent) return hcpReply;

  return deterministicContinuityVariation({
    hcpReply: current,
    transcript,
    scenario,
  });
}

function detectQuestionType(repMessage: string): BehaviorSignals["question_type"] {
  const text = String(repMessage || "").trim().toLowerCase();
  if (!text) return "none";
  if (/don't you|wouldn't you|isn't it|aren't you|right\?$/i.test(text)) return "leading";
  if (!text.includes("?")) return "none";
  if (/^(what|how|where|which|walk me through|tell me about|can you walk me through|can you tell me about)/i.test(text)) {
    return "open_ended";
  }
  if (/^(can you|could you|would you)/i.test(text) && !/yes or no/.test(text)) {
    return "open_ended";
  }
  return "closed_ended";
}

function inferConcernTags(text: string): string[] {
  const normalized = String(text || "").toLowerCase();
  const tags: string[] = [];
  if (/guideline/.test(normalized)) tags.push("guideline");
  if (/renal impairment|renal function|kidney disease/.test(normalized)) tags.push("renal");
  if (/patient population|typical patient|subgroup|patients who|right patient|ideal patient|perfect fit|patient profile|matching chart|flagging the chart|flag the chart|real patient type|patient type|need more data|not convinced|not ready yet|still maybe|still a maybe|hesitation|waiting for the right patient/.test(normalized)) tags.push("patient_fit");
  if (/\bscreen(?:ing)?\b|\bcandidate\b|\beligib(?:le|ility)\b|\bcriteria\b|\bpatient selection\b|\bwhich patients?\b|\bwhat type of patient\b|\bwhat kind of patient\b|\bhow do you decide\b|\bwho tends to\b|\bwhere do you draw the line\b|\bbest results in\b/.test(normalized)) tags.push("screening");
  if (/not ready to be first|first one|first in my group|what are others doing|others in my area|peer adoption|waiting for others|someone else does first|what are others in my area doing|what are others doing first/.test(normalized)) tags.push("adoption_caution");
  if (/cost|spend|readmissions|hospitalizations|metrics|outcomes|value/.test(normalized)) tags.push("cost_value");
  if (/prior auth|prior authorization|coverage|copay|formulary|payer|benefits|approval/.test(normalized)) tags.push("access");
  if (/system implementation|implementation|implement|rollout|roll out|deploy|deployment|integrat|ehr|emr|owner|handoff/.test(normalized)) tags.push("implementation");
  if (/staff|workflow|handoff|callback|operational|monitoring|follow-up|rework/.test(normalized)) tags.push("workflow");
  if (/what'?s the point|why are you here|why are we talking|what is this about|what'?s this about|relevance|requested|asked me|follow up|follow-up|left with you|bring you a copy|study you asked/i.test(normalized)) tags.push("premise");
  return tags;
}

function isPremiseChallenge(text: string): boolean {
  return /what'?s the point|why are you here|why are we talking|what is this about|what'?s this about|what do you want me to know|relevance|what makes you think/i.test(String(text || "").toLowerCase());
}

function repAddressesPremiseChallenge(repMessage: string, latestConcern: string): boolean {
  const repText = String(repMessage || "").toLowerCase();
  const concernText = String(latestConcern || "").toLowerCase();
  if (!isPremiseChallenge(concernText)) return false;

  return /you asked|you requested|you wanted|you said yes|you told me to|you asked me to bring|you asked me to follow up|following up|follow up on|follow-up on|left with you last week|study you asked|copy you asked/i.test(repText);
}

function repAddressesRecentPremiseChallenge(repMessage: string, transcript: ConversationTurn[]): boolean {
  const recentHcpPremise = transcript
    .filter((turn) => turn?.speaker === "hcp" && typeof turn?.text === "string")
    .slice(-3)
    .some((turn) => isPremiseChallenge(String(turn.text || "")));

  if (!recentHcpPremise) return false;
  return /you asked|you requested|you wanted|you said yes|you told me to|you asked me to bring|you asked me to follow up|following up|follow up on|follow-up on|left with you last week|study you asked|copy you asked|you agreed|agreed to a brief follow-up|agreed to meet/i.test(String(repMessage || "").toLowerCase());
}

function hcpStillRepeatsPremiseChallenge(hcpReply: string): boolean {
  const text = String(hcpReply || "").toLowerCase();
  return /what'?s the point|why are you here|what is this about|what'?s this about|why are we talking|what do you want me to know/i.test(text);
}

function deterministicPremiseCorrectionRewrite({
  hcpReply,
  scenario,
  transcript,
}: {
  hcpReply: string;
  scenario: any;
  transcript: ConversationTurn[];
}): string {
  const latestConcern = getLatestHcpConcern(transcript, scenario);
  const concernTags = inferConcernTags(`${latestConcern} ${scenario?.objective || ""} ${scenario?.description || ""}`);
  const concernFamily = concernTags.includes("workflow")
    ? "workflow"
    : concernTags.includes("patient_fit") || concernTags.includes("guideline") || concernTags.includes("cost_value")
      ? "evidence"
      : "general";

  if (concernFamily === "workflow") {
    return "Fine. Then keep it to one practical point. What changes for my staff or approval flow if this actually moves?";
  }
  if (concernTags.includes("access")) {
    return "Fine. Then keep it to one practical point. What changes in the access step or approval path if this actually moves?";
  }
  if (concernFamily === "evidence") {
    return "Fine. Then keep it to one useful point. What changes for my patients or my treatment decision?";
  }
  return "Fine. Then keep it to one practical point. What changes for me if this is worth continuing?";
}

function isGenericProductPitch(repMessage: string): boolean {
  const normalized = String(repMessage || "").toLowerCase();
  if (!normalized) return false;

  const productPitchMarkers = [
    /our product/,
    /mechanism of action/,
    /clinical trial/,
    /response rate/,
    /efficacy/,
    /adverse events?/,
    /pharmacokinetics?/,
    /once-daily dosing/,
    /tolerability profile/,
    /leave you (?:some )?information/,
    /benefits? for your patients/,
    /ideal treatment option/,
    /significant reduction/,
    /latest clinical trial/,
  ];

  const productPitchCount = productPitchMarkers.filter((pattern) => pattern.test(normalized)).length;
  const hasQuestion = normalized.includes("?");

  return productPitchCount >= 2 || (productPitchCount >= 1 && !hasQuestion);
}

function ignoredDirectConcern(repMessage: string, latestConcern: string): boolean {
  const concernText = String(latestConcern || "").toLowerCase();
  const repText = String(repMessage || "").toLowerCase();
  if (repAddressesPremiseChallenge(repText, concernText)) {
    return false;
  }
  const concernTags = inferConcernTags(concernText);
  const repTags = inferConcernTags(repText);
  const sharedTags = concernTags.filter((tag) => repTags.includes(tag));
  const directOperationalAsk =
    /what'?s the one thing|what specifically|what changes|what gets added|what staff|prior auth|workflow|extra step|bottom line/.test(concernText);
  const directClinicalAsk =
    /renal|guideline|patient population|subgroup|right patient|ideal patient|perfect fit|patient profile|patient type|need more data|not convinced|not ready yet|still maybe|still a maybe|hesitation|what outcomes|cost|readmissions|justify the cost/.test(concernText);

  if ((directOperationalAsk || directClinicalAsk) && sharedTags.length === 0) {
    return true;
  }

  return false;
}

function inferResponseAlignment(
  repMessage: string,
  latestConcern: string,
  scenario?: any,
): BehaviorSignals["response_alignment"] {
  if (repAddressesPremiseChallenge(repMessage, latestConcern)) {
    return "strong";
  }
  const repTags = inferConcernTags(repMessage);
  const concernTags = inferConcernTags(latestConcern);
  const shared = concernTags.filter((tag) => repTags.includes(tag));
  if (shared.length >= 1) {
    return "strong";
  }
  if (isScreeningDiscoveryResponse(repMessage, scenario)) {
    const screeningConcern =
      concernTags.includes("screening") ||
      concernTags.includes("patient_fit") ||
      /\bwhat type of patient\b|\bbest results in\b|\bwho do you usually think of first\b|\bhow do you decide\b|\bwhere do you draw the line\b/.test(
        String(latestConcern || "").toLowerCase()
      );
    if (screeningConcern) return "strong";
  }
  if (/you'?re saying|you'?re right|when you say|what would you need to see|which patient type|where does .* decision|what outcome carries/i.test(repMessage)) {
    return "partial";
  }
  return "weak";
}

function isScreeningDiscoveryResponse(repMessage: string, scenario?: any): boolean {
  const text = String(repMessage || "").toLowerCase();
  if (!scenarioMatchesConcernFamily(scenario, "screening")) return false;
  return /\bwhich patients?\b|\bwhat type of patient\b|\bwhat kind of patient\b|\bhow do you decide\b|\bwhat criteria\b|\bwhat usually makes a patient fit\b|\bwho tends to stay on therapy\b|\bwhere do you draw the line\b/.test(text);
}

function inferListeningPattern(
  repMessage: string,
  latestConcern: string,
  scenario?: any,
): BehaviorSignals["listening_pattern"] {
  const alignment = inferResponseAlignment(repMessage, latestConcern, scenario);
  if (alignment === "strong") return "responsive";
  if (alignment === "partial") return "partially_responsive";
  return "missed";
}

function isHesitationToCommitmentScenario(scenario: any, latestConcern: string): boolean {
  if (scenarioMatchesConcernFamily(scenario, "hesitation")) return true;
  const title = String(scenario?.title || "").toLowerCase();
  const stage = String(scenario?.journeyStage || "").toLowerCase();
  const state = String(scenario?.journeyState || "").toLowerCase();
  const objective = String(scenario?.objective || "").toLowerCase();
  const pressures = String((scenario?.interactionPressure || []).join(" ")).toLowerCase();
  const concernText = String(latestConcern || "").toLowerCase();

  return (
    title === "the perpetual maybe" ||
    (stage === "commitment_close" &&
      (state.includes("commitment") || /specific next step|passive agreement|right patient/.test(objective)) &&
      (/right patient|ideal patient|perfect fit|patient profile|need more data|not convinced|not ready yet|still maybe|hesitation|waiting for the right patient/.test(
        concernText
      ) ||
        /curious_uncertain/.test(pressures)))
  );
}

function isAdoptionCautionScenario(scenario: any, latestConcern: string): boolean {
  if (scenarioMatchesConcernFamily(scenario, "adoption_caution")) return true;
  const title = String(scenario?.title || "").toLowerCase();
  const stage = String(scenario?.journeyStage || "").toLowerCase();
  const state = String(scenario?.journeyState || "").toLowerCase();
  const objective = String(scenario?.objective || "").toLowerCase();
  const concernText = String(latestConcern || "").toLowerCase();

  return (
    title === "the reluctant early adopter" ||
    (stage === "adoption_implementation" &&
      (state.includes("adoption") || /decision readiness|first one|peer adoption|others in my area/.test(objective)) &&
      /not ready to be first|first one|what are others doing|others in my area|peer adoption|waiting for others|someone else does first/.test(
        concernText
      ))
  );
}

function inferObjectionType(latestConcern: string, scenario?: any): BehaviorSignals["objection_type"] {
  if (isHesitationToCommitmentScenario(scenario, latestConcern)) return "none";
  if (isAdoptionCautionScenario(scenario, latestConcern)) return "none";
  if (/prior auth|prior authorization|coverage|copay|formulary|payer|benefits|approval/.test(latestConcern)) return "access";
  if (/workflow|staff|operational|handoff|callback|monitoring|follow-up|form/.test(latestConcern)) return "workflow";
  if (/cost|spend|readmissions|hospitalizations|metrics|value/.test(latestConcern)) return "budget";
  if (/guideline|renal|patient population|subgroup|study|data|evidence|trial|readout/.test(latestConcern)) return "clinical";
  return "none";
}

function inferEngagementLevel(hcpReply: string): BehaviorSignals["engagement_level"] {
  const text = String(hcpReply || "").toLowerCase();
  if (/\?$/.test(text) || /\bwhat\b|\bhow\b|\bwhich\b|\bwhere\b/.test(text)) return "high";
  if (/that's a start|i need to see|i've got a patient|that was a tough case|that still/i.test(text)) return "moderate";
  return "low";
}

function inferCommitmentAttempt(
  repMessage: string,
  transcript: ConversationTurn[],
  scenario: any
): BehaviorSignals["commitment_attempt"] {
  const text = String(repMessage || "").toLowerCase();
  const repTurns = transcript.filter((turn) => turn?.speaker === "rep").length;
  const lateEnoughForAsk =
    repTurns >= 2 ||
    ["commitment_close", "access_formulary", "adoption_implementation"].includes(String(scenario?.journeyStage || "")) ||
    String(scenario?.journeyState || "").includes("commitment");

  if (/\bcan we\b|\bwould you be open to\b|\bnext step\b|\bset up\b|\bfollow-up\b|\breview together\b|\bbring this to\b|\bpilot\b|\btry this with\b|\bidentify a patient\b|\bflagging that chart\b|\bbring to the next formulary discussion\b|\bconcrete step you could take\b|\bwhat one thing could you take back\b|\bmake a strong case\b/.test(text)) {
    return "clear";
  }

  if (
    lateEnoughForAsk &&
    /\bwhat would you need to see\b|\bwhich patient type\b|\bwhat outcome carries the most weight\b|\bwhere does .* break down\b|\bwhat specifically would you need to see\b|\bwhat would make this feel usable\b|\bwhat would it take for you to feel confident\b|\bwhat's the next formulary committee meeting\b|\bwhat's the one workflow requirement\b|\bwhat's one concrete step\b|\bwhat's the one data point\b|\bwhat specific info do you need(?: to see)?\b|\bwhat kind of data\b|\bmove the needle with the formulary team\b/.test(text)
  ) {
    return "weak";
  }

  return "none";
}

function normalizeBehaviorSignals(
  rawSignals: BehaviorSignals,
  repMessage: string,
  transcript: ConversationTurn[],
  scenario: any,
  hcpReply: string
): BehaviorSignals {
  const latestConcern = deriveLiveConversationConcern(transcript, scenario, repMessage);
  const premiseCorrected = repAddressesRecentPremiseChallenge(repMessage, transcript);
  const inferredQuestionType = detectQuestionType(repMessage);
  const inferredAlignment = inferResponseAlignment(repMessage, latestConcern, scenario);
  const inferredListening = inferListeningPattern(repMessage, latestConcern, scenario);
  const inferredObjectionType = inferObjectionType(latestConcern, scenario);
  const inferredEngagement = inferEngagementLevel(hcpReply);
  const inferredCommitmentAttempt = inferCommitmentAttempt(repMessage, transcript, scenario);
  const genericPitch = isGenericProductPitch(repMessage);
  const talkedPastConcern = ignoredDirectConcern(repMessage, latestConcern);
  const forceWeakAlignment = !premiseCorrected && (genericPitch || talkedPastConcern);
  const forceRepDominant = genericPitch;
  const forceHesitationFamily = isHesitationToCommitmentScenario(scenario, latestConcern);
  const forceAdoptionCautionFamily = isAdoptionCautionScenario(scenario, latestConcern);
  const screeningResponsive = isScreeningDiscoveryResponse(repMessage, scenario);

  return {
    question_type: forceRepDominant
      ? inferredQuestionType
      : rawSignals?.question_type && rawSignals.question_type !== "none"
        ? rawSignals.question_type
        : inferredQuestionType,
    response_alignment: forceWeakAlignment
      ? "weak"
      : premiseCorrected
        ? "strong"
        : screeningResponsive
          ? "strong"
          : rawSignals?.response_alignment === "strong"
            ? "strong"
            : inferredAlignment,
    objection_type: (forceHesitationFamily || forceAdoptionCautionFamily)
      ? "none"
      : rawSignals?.objection_type && rawSignals.objection_type !== "none"
        ? rawSignals.objection_type
        : inferredObjectionType,
    engagement_level: rawSignals?.engagement_level && rawSignals.engagement_level !== "low"
      ? rawSignals.engagement_level
      : inferredEngagement,
    control_pattern: forceRepDominant
      ? "rep_dominant"
      : rawSignals?.control_pattern || (inferredQuestionType === "open_ended" ? "balanced" : "hcp_dominant"),
    listening_pattern: forceWeakAlignment
      ? "missed"
      : premiseCorrected
        ? "responsive"
        : screeningResponsive
          ? "responsive"
          : rawSignals?.listening_pattern === "responsive"
            ? "responsive"
            : inferredListening,
    commitment_attempt: rawSignals?.commitment_attempt && rawSignals.commitment_attempt !== "none"
      ? rawSignals.commitment_attempt
      : inferredCommitmentAttempt,
  };
}

export async function generateHcpResponse(
  scenario: any,
  transcript: ConversationTurn[],
  currentBehaviorState: string,
  currentJourneyState: string,
  coachingEnabled: boolean,
  repMessage: string,
  allPriorSignals: BehaviorSignals[] = [],
  turnCount: number = 0,
  previousVolatilityProfile: VolatilityProfile = "stable",
  responseTokenCap?: number,
  ..._legacyCompatibilityArgs: any[]
): Promise<SimulatorResponse> {
  scenario = buildDerivedScenarioContext(scenario);
  const predictiveProfileArg = _legacyCompatibilityArgs[0] || null;
  const predictivePromptContext = typeof _legacyCompatibilityArgs[1] === "string"
    ? _legacyCompatibilityArgs[1]
    : "";
  const runtimeMemoryArg = _legacyCompatibilityArgs[2] && typeof _legacyCompatibilityArgs[2] === "object"
    ? _legacyCompatibilityArgs[2]
    : {};
  const contractRealism = requireRealismContract(scenario?.runtimeTemperature, "scenario.runtimeTemperature");
  const temperatureBand = deriveTemperatureBand(contractRealism);
  const transcriptText = transcript
    .map(t => `${t.speaker.toUpperCase()}: ${t.text}`)
    .join("\n");

  const focusCaps = (scenario.suggestedFocusCapabilities || []).join(", ");
  const latestConcern = deriveLiveConversationConcern(transcript, scenario, repMessage);

  const windowSignals = allPriorSignals.length > 0 ? allPriorSignals : [];
  const prediction = predictHcpBehavior(windowSignals, windowSignals, scenario);
  const turnConstraint = resolveTurnConstraintState({
    transcript,
    repMessage,
    latestConcern,
    allPriorSignals,
    currentBehaviorState,
    prediction,
  });
  const turnDirectives = deriveHcpTurnDirectives({
    scenario,
    currentBehaviorState,
    currentJourneyState,
    predictionState: prediction.predictedBehaviorState,
    allPriorSignals,
    turnCount,
  });
  const runtimeProfile = deriveHcpRuntimeProfile({
    scenario,
    behaviorState: currentBehaviorState,
    predictedBehaviorState: prediction.predictedBehaviorState,
  });
  const volatility = computeVolatility(scenario, windowSignals, turnCount, previousVolatilityProfile);
  const interactionPressures = scenario.interactionPressure || [];
  const isHighPressureTurn =
    interactionPressures.includes("time_constrained") ||
    interactionPressures.includes("operationally_constrained") ||
    interactionPressures.includes("skeptical_resistant") ||
    interactionPressures.includes("safety_concern") ||
    ["closed", "resistance", "frustration", "time_pressure"].includes(currentBehaviorState) ||
    volatility.profile !== "stable";
  const responseTokenBudget =
    turnDirectives.targetWordBudget <= 22 ? 300
      : turnDirectives.targetWordBudget <= 28 ? 340
        : runtimeProfile.brevity === "tight" ? 380
          : isHighPressureTurn ? 420
            : runtimeProfile.brevity === "moderate" ? 600
              : 560;
  const finalResponseTokenBudget = typeof responseTokenCap === "number"
    ? Math.min(responseTokenBudget, responseTokenCap)
    : responseTokenBudget;
  const generationTemperature = deriveSamplingTemperatureFromRealism(contractRealism, {
    highPressure: isHighPressureTurn,
    profileBrevity: runtimeProfile?.brevity,
  });
  const escalationMemory = deriveEscalationMemory({
    transcript,
    repMessage,
    latestConcern,
    temperatureBand,
    priorEscalationLevel: Number(runtimeMemoryArg?.escalationLevel || 0),
  });
  const escalationBlock = applyEscalationBehavior({
    temperatureBand,
    escalationLevel: escalationMemory.escalationLevel,
    repeatedRepPatternCount: escalationMemory.repeatedRepPatternCount,
    unansweredQuestionCount: escalationMemory.unansweredQuestionCount,
    scenarioPressure: interactionPressures,
  });
  const pressurePersistenceBlock = buildPressurePersistenceBlock(scenario);
  const predictiveBrainBlock = predictivePromptContext.trim()
    ? `
PREDICTIVE HCP BRAIN (AUTHORITATIVE SOURCE OF TRUTH FOR HCP DIALOGUE):
${predictivePromptContext.trim()}

Predictive Profile Snapshot:
- Behavior Archetype: ${predictiveProfileArg?.type || scenario?.predictiveSeed?.behaviorArchetype || scenario?.persona || "unknown"}
- Specialist Title: ${predictiveProfileArg?.specialistTitle || scenario?.stakeholder || "unknown"}

Authority rules:
- Use the Predictive HCP Brain as the source of truth.
- Do not use generic training simulator language.
- Speak as this specific HCP, with this specific mindset, decision filter, credibility drivers, trust breakers, and current state.
- Guardrails may constrain or request regeneration, but they must not become the voice of the HCP.
`
    : `
PREDICTIVE HCP BRAIN (FALLBACK MODE):
- No external predictive synthesis was provided; use scenario metadata, predictiveSeed, current HCP state, and transcript memory as the source of truth.
- Do not use generic training simulator language.
`;

  const predictionBlock = `
CAPABILITY-DRIVEN BEHAVIOR PREDICTION (PRIMARY — follow this, do not contradict it):
Predicted HCP State: ${prediction.predictedBehaviorState}
Predicted Resistance: ${prediction.predictedResistanceLevel}
Predicted Engagement Pattern: ${prediction.predictedEngagementPattern}
Predicted Openness: ${prediction.openness} (${prediction.opennessScore}/10)
Predicted Trajectory: ${prediction.trajectory}
Predicted Risk: ${prediction.riskLevel}
Concern Family: ${prediction.concernFamily}
Scenario Domain: ${prediction.scenarioDomain}
Scenario Family: ${prediction.scenarioFamily}
${prediction.predictedDrivers.length ? `Predicted Drivers:\n${prediction.predictedDrivers.map(d => `  - ${d}`).join("\n")}` : ""}
${prediction.predictedObjections.length ? `Predicted Objection Themes:\n${prediction.predictedObjections.map(o => `  - ${o}`).join("\n")}` : ""}
Scenario Reality Profile:
  - Practice setting: ${prediction.contextProfile.practiceSetting}
  - Patient mix reality: ${prediction.contextProfile.patientMixReality}
  - Access friction: ${prediction.contextProfile.accessFrictionType}
  - Staffing reality: ${prediction.contextProfile.staffingReality}
  - Workflow bottleneck: ${prediction.contextProfile.workflowBottleneck}
  - Adoption style: ${prediction.contextProfile.adoptionStyle}
  - Evidence sensitivity: ${prediction.contextProfile.evidenceSensitivity}
`;

  const runtimeProfileBlock = `
${buildRuntimeProfilePrompt(runtimeProfile)}
`;
  const hcpTurnCount = transcript.filter((turn) => turn?.speaker === "hcp").length;
  const realismBackboneBlock = `
${buildRealismBackbonePrompt({
    scenario,
    turn: turnDirectives,
    profile: runtimeProfile,
    hcpTurnCount,
  })}
`;
  const dialogueDirectiveBlock = `
${buildDialogueDirectivePrompt(
    scenario,
    currentBehaviorState,
    prediction.predictedBehaviorState,
  )}
`;

  const volatilityBlock = `
BEHAVIORAL VOLATILITY LAYER (deterministic — weighted by signal importance, NOT random):
Volatility Profile: ${volatility.profile}
Primary Trigger Signal: ${volatility.triggerSignal || "none"}
Triggered by: ${volatility.trigger}
Curveball Active This Turn: ${volatility.curveballActive}
${volatility.curveballType ? `Curveball Type: ${volatility.curveballType}` : ""}
${volatility.curveballTriggerSignal ? `Curveball Cause (missed signal): ${volatility.curveballTriggerSignal}` : ""}
`;
  const continuityBlock = `
${summarizeConcernContinuity(transcript, scenario, repMessage)}
`;

  const prompt = `You are a Signal Intelligence Coaching Simulator engine. Return a JSON object.

SCENARIO: ${scenario.title}
Stakeholder: ${scenario.stakeholder}
Objective: ${scenario.objective}
HCP Persona: ${scenario.persona}
Journey Stage: ${scenario.journeyStage}
Current Journey State: ${currentJourneyState}
Opening Scene Reality: ${scenario.visualScene || scenario.openingScene || "not provided"}
Opening HCP Setup: ${scenario.openingScene || "not provided"}
Starting Behavior State: ${scenario.startingBehaviorState}
Current Behavior State: ${currentBehaviorState}
Interaction Pressures: ${(scenario.interactionPressure || []).join(", ")}

TRANSCRIPT:
${transcriptText}

REP'S LATEST MESSAGE:
${repMessage}

${predictionBlock}

${runtimeProfileBlock}

${realismBackboneBlock}

${dialogueDirectiveBlock}

${buildTurnDirectivePrompt(turnDirectives)}

${volatilityBlock}

${continuityBlock}

${buildTurnConstraintPromptBlock(turnConstraint)}

${predictiveBrainBlock}

${escalationBlock}

${pressurePersistenceBlock}

${CAPABILITY_RULES}

SPOKEN REALISM GUARDRAILS:
- The HCP must sound like a real clinician in a real room, not a chatbot or polished assistant
- Prefer direct, spoken, compressed phrasing over balanced written phrasing
- Under pressure, the HCP can be clipped, skeptical, impatient, guarded, or specific
- The HCP should sound clinically grounded, not theatrically hostile and not socially casual
- Keep the line rooted in what this HCP would realistically say in this scenario

GOOD STYLE EXAMPLES:
- "Look, I don't have time for a long discussion."
- "This data doesn't capture what I actually see."
- "My staff is already buried in prior auths."
- "If that's the subgroup you're talking about, that's not who I'm worried about."

BAD STYLE EXAMPLES:
- overly polished explanatory language
- balanced consultant-style phrasing
- generic chatbot empathy
- casual/social phrasing that ignores clinical pressure
- abstract workload language with no concrete task reality

INSTRUCTIONS:
1. Reflect the predicted HCP state — your tone and body language MUST align with predictedBehaviorState and predicted engagement
2. If volatility = slightly_disrupted or disrupted, shorten responses and increase sharpness
3. Classify rep's observable behavior (question_type, response_alignment, etc.)
4. Generate natural HCP reply with ONE aligned context-aware cue (physical/behavioral signal that matches the HCP's emotional/cognitive state and response)
5. Cue MUST be a single observable signal (e.g., "glances at watch", "leans forward", "nods slowly", "crosses arms")
6. Cue MUST logically connect to what the HCP is saying and their internal state
7. Final spoken dialogue must sound like a real clinician speaking out loud, not a system summarizing workload or reasoning
8. Strongly avoid abstract burden phrasing in final dialogue such as: "absorb", "carry" when abstract, "handle" when abstract, "changes in their day", generic "over time", or standalone "burden"
9. When describing workflow, prefer concrete task language such as what gets added, what step this creates, who picks it up, what happens next, what slows things down, or what falls to staff
10. If a line is grammatically correct but still sounds written, abstract, or conceptually compressed rather than spoken, revise it again before returning
11. The HCP must stay inside the opening-scene reality unless the rep has plausibly changed the tone through the exchange
12. Cue, dialogue, and emotional tone must align on the same turn
13. Never let a pressured or guarded HCP suddenly sound casual, socially loose, or unconstrained
14. In time-pressured or operationally constrained scenarios, brevity and directness matter more than polish
15. Keep the HCP reply to 1-2 sentences maximum
16. If pressure is high, target under ${Math.min(30, turnDirectives.targetWordBudget)} spoken words
17. If pressure is moderate or low, target under ${Math.max(32, turnDirectives.targetWordBudget)} spoken words
18. Respect the runtime HCP profile above for warmth, directness, patience, and response mode
19. If the runtime profile says directive, answer in a direct clinician voice rather than exploratory language
20. If the runtime profile says guarded, keep the tone professional but with visible constraint
21. Follow the turn-shape directive above exactly; do not drift into a different conversation shape
22. If repeated misses are active, do not introduce a new concern family — stay on the same blocker and sharpen it
23. In objection-stage and close-stage scenarios, transitions must be deterministic and narrow, not open-ended by default
24. Across 5-8 exchanges, preserve continuity of the HCP's agenda; the wording may change, but the unresolved blocker should remain recognizable until it is actually addressed
25. If the HCP has repeated the same concern family recently, sharpen or narrow that same concern instead of inventing a new one
26. If the HCP questioned why the rep is there and the rep directly corrected that premise (for example: requested follow-up, requested study, agreed conversation), you MUST absorb that correction on the next turn and move to a narrower practical or decision-relevant condition. Do NOT keep asking why the rep is there after the premise has been directly answered.
27. Every HCP question must stand alone semantically. Never ask to reduce, change, fix, improve, justify, or help with something unless the object is explicit.
28. Do not end an HCP line on an incomplete ask such as "reduce?", "change?", "help with?", or any question missing what is actually being asked about.
29. Avoid comma splices in HCP dialogue. If there are two complete thoughts, split them into separate sentences.
30. In operational or access questions, explicitly name the object of the ask such as the queue, the prior auth step, the approval path, the callback burden, the monitoring step, or the staff task.
31. Obey the TURN-LEVEL HCP CONSTRAINTS exactly. Do not output blocked intents.
32. If blocked intent includes Advance, avoid agreement language and avoid commitment-forward phrases.
33. If engagement is Selectively Engaged, keep the response conditional/probing and do not leap to full cooperation.
34. The Predictive HCP Brain authors the HCP line. Routing, pressure, temperature, and continuity rules are validators and intensity controls, not canned copy sources.
35. If the REP repeats, evades, or stays generic, progress the HCP stance using escalation memory: restate in new words, sharpen, reveal the deeper barrier, or disengage. Do not concatenate prior HCP phrasing.
36. Never use these global stock phrases in final HCP dialogue: "What's concretely different for me after this?", "The practical answer has to stay tied...", "I hear that a lot", "Keep this brief", "I'm not convinced yet", or "What changes in practice if this is worth continuing?"

${coachingEnabled ? `COACHING NUDGE:
Evaluate the rep's turn against the 8 capabilities above.
Select ONE most actionable capability (the primary miss or breakthrough).
capabilityId must match canonical IDs.
capabilityName must match canonical metric names.` : ""}

Return ONLY valid JSON:
{
  "hcpReply": "string",
  "hcpCue": "string (single observable behavioral signal aligned with this response)",
  "nextBehaviorState": "string",
  "nextJourneyState": "string",
  "behaviorSignals": {
    "question_type": "open_ended|closed_ended|leading|none",
    "response_alignment": "strong|partial|weak",
    "objection_type": "clinical|access|budget|workflow|none",
    "engagement_level": "low|moderate|high",
    "control_pattern": "balanced|rep_dominant|hcp_dominant",
    "listening_pattern": "responsive|partially_responsive|missed",
    "commitment_attempt": "none|weak|clear"
  }${coachingEnabled ? `,
  "coachingNudge": {
    "title": "string",
    "guidance": "string",
    "capabilityId": "string",
    "capabilityName": "string"
  }` : ""}
}`;

  let result;
  try {
    result = await invokeWorkerJson({
      prompt,
      max_tokens: finalResponseTokenBudget,
      temperature: generationTemperature,
      timeout_ms: HCP_PRIMARY_TIMEOUT_MS,
      retry_count: 1,
      response_json_schema: {
        type: "object",
        properties: {
          hcpReply: { type: "string" },
          hcpCue: { type: "string" },
          nextBehaviorState: { type: "string" },
          nextJourneyState: { type: "string" },
          behaviorSignals: { type: "object" },
          coachingNudge: { type: "object" }
        }
      }
    });
  } catch {
    result = {
      hcpReply: buildDeterministicHcpFallbackReply({
        scenario,
        transcript,
        repMessage,
        currentBehaviorState,
        prediction,
      }),
      hcpCue: buildFirstTurnCueOverride(repMessage, scenario),
      nextBehaviorState: currentBehaviorState,
      nextJourneyState: currentJourneyState,
      behaviorSignals: {},
      coachingNudge: null,
    };
  }

  let hcpReply = result.hcpReply || "";
  let postLlmRewriteKind: PostLlmRewriteKind | null = null;
  if (needsNaturalnessRewrite(hcpReply)) {
    postLlmRewriteKind = "naturalness";
  } else if (needsSpokenStyleRewrite({ hcpReply, scenario })) {
    postLlmRewriteKind = "spoken_style";
  } else if (needsContextConsistencyRewrite({
    hcpReply,
    scenario,
    behaviorState: result.nextBehaviorState || currentBehaviorState,
  })) {
    postLlmRewriteKind = "context_consistency";
  }

  if (postLlmRewriteKind === "naturalness") {
    try {
      hcpReply = await rewriteForSpokenNaturalness({
        hcpReply,
        scenario,
        behaviorState: result.nextBehaviorState || currentBehaviorState,
        prediction,
      });
    } catch {
      // Fall back to the original line if the refinement call fails.
    }
  } else if (postLlmRewriteKind === "spoken_style") {
    try {
      hcpReply = await rewriteForSpokenStyle({
        hcpReply,
        scenario,
        behaviorState: result.nextBehaviorState || currentBehaviorState,
      });
    } catch {
      // Fall back to the original line if the refinement call fails.
    }
  } else if (postLlmRewriteKind === "context_consistency") {
    try {
      hcpReply = await rewriteForContextConsistency({
        hcpReply,
        scenario,
        behaviorState: result.nextBehaviorState || currentBehaviorState,
        currentJourneyState: result.nextJourneyState || currentJourneyState,
        prediction,
      });
    } catch {
      // Fall back to the original line if the refinement call fails.
    }
  }
  let continuityAdjusted = false;
  const firstTurnAlignment = enforceFirstTurnRepAdaptation({
    hcpReply,
    repMessage,
    scenario,
    transcript,
  });
  let cueOverride = firstTurnAlignment.cueOverride;
  if (firstTurnAlignment.applied) {
    hcpReply = firstTurnAlignment.hcpReply;
  }

  if (needsContinuityVariationRewrite({
    hcpReply,
    transcript,
  })) {
    try {
      hcpReply = await rewriteForContinuityVariation({
        hcpReply,
        transcript,
        scenario,
        behaviorState: result.nextBehaviorState || currentBehaviorState,
        currentJourneyState: result.nextJourneyState || currentJourneyState,
      });
      continuityAdjusted = true;
    } catch {
      hcpReply = deterministicContinuityVariation({
        hcpReply,
        transcript,
        scenario,
      });
      continuityAdjusted = true;
    }
  }
  if (repAddressesPremiseChallenge(repMessage, getLatestHcpConcern(transcript, scenario)) && hcpStillRepeatsPremiseChallenge(hcpReply)) {
    hcpReply = deterministicPremiseCorrectionRewrite({
      hcpReply,
      scenario,
      transcript,
    });
  }

  if (violatesTurnConstraint(hcpReply, turnConstraint)) {
    try {
      const corrected = await rewriteForConstraintCompliance({
        hcpReply,
        constraint: turnConstraint,
        scenario,
      });
      if (violatesTurnConstraint(corrected, turnConstraint)) {
        hcpReply = await regenerateWithPredictiveBrain({
          currentLine: corrected,
          reason: "The line still violates turn-level behavioral constraints. Regenerate from the Predictive HCP Brain without blocked intent.",
          predictiveContext: predictivePromptContext,
          scenario,
          repMessage,
          transcript,
          escalationMemory,
          behaviorState: result.nextBehaviorState || currentBehaviorState,
          currentJourneyState: result.nextJourneyState || currentJourneyState,
        });
      } else {
        hcpReply = corrected;
      }
    } catch {
      hcpReply = buildBrainGroundedScenarioFallback({
        scenario,
        repMessage,
        escalationMemory,
      });
    }
  }

  hcpReply = enforceAdaptiveNaturalCompression({
    hcpReply,
    scenario,
    behaviorState: result.nextBehaviorState || currentBehaviorState,
    prediction,
  });

  hcpReply = applyHcpResponseSurface({
    hcpReply,
    scenario,
    turn: turnDirectives,
    profile: runtimeProfile,
    hcpTurnCount,
    liveRepAlignmentActive: firstTurnAlignment.applied,
  });

  hcpReply = applyRecentHcpLoopGuard(hcpReply, transcript, scenario);
  if (!continuityAdjusted && needsContinuityVariationRewrite({
    hcpReply,
    transcript,
  })) {
    try {
      hcpReply = await rewriteForContinuityVariation({
        hcpReply,
        transcript,
        scenario,
        behaviorState: result.nextBehaviorState || currentBehaviorState,
        currentJourneyState: result.nextJourneyState || currentJourneyState,
      });
      continuityAdjusted = true;
      hcpReply = applyHcpResponseSurface({
        hcpReply,
        scenario,
        turn: turnDirectives,
        profile: runtimeProfile,
        hcpTurnCount,
        liveRepAlignmentActive: firstTurnAlignment.applied,
      });
      hcpReply = applyRecentHcpLoopGuard(hcpReply, transcript, scenario);
    } catch {
      continuityAdjusted = true;
      hcpReply = applyRecentHcpLoopGuard(applyHcpResponseSurface({
        hcpReply: deterministicContinuityVariation({
          hcpReply,
          transcript,
          scenario,
        }),
        scenario,
        turn: turnDirectives,
        profile: runtimeProfile,
        hcpTurnCount,
        liveRepAlignmentActive: firstTurnAlignment.applied,
      }), transcript, scenario);
    }
  }

  const finalLiveAlignment = enforceFirstTurnRepAdaptation({
    hcpReply,
    repMessage,
    scenario,
    transcript,
  });
  if (finalLiveAlignment.applied) {
    hcpReply = finalLiveAlignment.hcpReply;
    cueOverride = finalLiveAlignment.cueOverride;
  }

  if (needsImplementationTurnRepair({ repMessage, hcpReply })) {
    hcpReply = buildImplementationAdaptiveReply({
      repMessage,
      hcpReply,
      transcript,
      scenario,
    });
  }

  hcpReply = enforceInitialAccessSurface({
    hcpReply,
    repMessage,
    scenario,
    transcript,
  });

  hcpReply = enforceClinicalValueAccessWorkflowSurface({
    hcpReply,
    repMessage,
    scenario,
    transcript,
  });

  hcpReply = enforceClinicalValueEvidenceSurface({
    hcpReply,
    repMessage,
    scenario,
    transcript,
  });

  hcpReply = enforceRealismLeverDialogue({
    hcpReply,
    scenario,
    temperatureBand,
    escalationMemory,
    transcript,
  });

  if (!hasPriorHcpTurns(transcript)) {
    hcpReply = withFirstTurnRepAcknowledgement(hcpReply, repMessage, scenario);
  }

  const finalMissingPressures = missingPersistentPressure(hcpReply, scenario, hcpTurnCount);
  if (hasGlobalStockPhrase(hcpReply) || finalMissingPressures.length > 0) {
    try {
      hcpReply = await regenerateWithPredictiveBrain({
        currentLine: hcpReply,
        reason: hasGlobalStockPhrase(hcpReply)
          ? "The line used a banned global stock phrase. Regenerate without canned simulator language."
          : "The line dropped scenario pressure persistence. Regenerate with the missing pressure anchor in this HCP's own words.",
        predictiveContext: predictivePromptContext,
        scenario,
        repMessage,
        transcript,
        escalationMemory,
        missingPressures: finalMissingPressures,
        behaviorState: result.nextBehaviorState || currentBehaviorState,
        currentJourneyState: result.nextJourneyState || currentJourneyState,
      });
    } catch {
      hcpReply = buildBrainGroundedScenarioFallback({
        scenario,
        repMessage,
        escalationMemory,
        missingPressures: finalMissingPressures,
      });
    }

    hcpReply = applyRecentHcpLoopGuard(applyHcpResponseSurface({
      hcpReply,
      scenario,
      turn: turnDirectives,
      profile: runtimeProfile,
      hcpTurnCount,
      liveRepAlignmentActive: firstTurnAlignment.applied || finalLiveAlignment.applied,
    }), transcript, scenario);
  }

  hcpReply = enforceRealismLeverDialogue({
    hcpReply,
    scenario,
    temperatureBand,
    escalationMemory,
    transcript,
  });

  const postRegenerationFirstTurnAlignment = enforceFirstTurnRepAdaptation({
    hcpReply,
    repMessage,
    scenario,
    transcript,
  });
  if (postRegenerationFirstTurnAlignment.applied) {
    hcpReply = postRegenerationFirstTurnAlignment.hcpReply;
    cueOverride = postRegenerationFirstTurnAlignment.cueOverride;
  }

  const constrainedNextBehaviorState = mapEngagementStateToBehaviorState(
    turnConstraint.engagementState,
    result.nextBehaviorState || currentBehaviorState,
  );
  const realismAdjustedBehaviorState = adjustBehaviorStateForRealism({
    behaviorState: constrainedNextBehaviorState,
    temperatureBand,
    escalationMemory,
    scenario,
  });
  const realismCueCandidate = deriveRealismCueCandidate({
    scenario,
    temperatureBand,
    escalationMemory,
    hcpReply,
  });

  const recentCueLabels = transcript
    .filter((turn: any) => turn?.speaker === "hcp")
    .flatMap((turn: any) => Array.isArray(turn?.cues) ? turn.cues : [])
    .map((cue: any) => cue?.label)
    .filter(Boolean)
    .slice(-8);
  const cue = resolveObservedCue(realismCueCandidate || cueOverride || result.hcpCue || "", {
    hcpReply,
    behaviorState: realismAdjustedBehaviorState,
    hcpTurnCount,
    interactionPressures: scenario.interactionPressure || [],
    recentCueLabels,
    repMessage,
    allowFirstTurnCandidateCue: true,
    runtimeTemperature: contractRealism,
    escalationLevel: escalationMemory.escalationLevel,
    scenario: {
      id: scenario.id,
      title: scenario.title,
      persona: scenario.persona,
      journeyStage: scenario.journeyStage,
      objective: scenario.objective,
      description: scenario.description,
      openingScene: scenario.openingScene,
      visualScene: scenario.visualScene,
      keyChallenges: scenario.keyChallenges,
    },
  });
  const activeCues = cue.label ? [{
    id: `cue_${Date.now()}`,
    ...cue,
  }] : [];
  const coachingNudge = result.coachingNudge && typeof result.coachingNudge === "object" && Object.keys(result.coachingNudge).length
    ? result.coachingNudge
    : coachingEnabled
      ? buildDeterministicLiveCoachingNudge({
        repMessage,
        hcpReply,
        scenario,
      })
      : null;

  return {
    hcpReply,
    nextBehaviorState: realismAdjustedBehaviorState,
    nextJourneyState: result.nextJourneyState || currentJourneyState,
    activeCues,
    behaviorSignals: normalizeBehaviorSignals(
      result.behaviorSignals || {},
      repMessage,
      transcript,
      scenario,
      hcpReply,
    ),
    coachingNudge,
    volatilityState: volatility,
    prediction,
    runtimeTrace: {
      generator_version: HCP_GENERATOR_VERSION,
      realism_level: contractRealism,
      sampling_temperature: generationTemperature,
      scenario_grounding_applied: true,
      banned_phrase_filter_applied: true,
      scenario_anchors_used: [scenario?.id, scenario?.title, scenario?.journeyStage].filter(Boolean),
      turn_constraint_state: {
        engagement_state: turnConstraint.engagementState,
        trust_level: turnConstraint.trustLevel,
        resolved_intent: turnConstraint.resolvedIntent,
        allowed_intents: turnConstraint.allowedIntents,
      },
      escalation_applied: {
        type: "escalation_applied",
        escalationLevel: escalationMemory.escalationLevel,
        repeatedRepPatternCount: escalationMemory.repeatedRepPatternCount,
        unansweredQuestionCount: escalationMemory.unansweredQuestionCount,
        temperatureBand,
        action: escalationMemory.action,
        reasons: escalationMemory.reasons,
      },
      realism_lever_alignment: {
        temperatureBand,
        final_behavior_state: realismAdjustedBehaviorState,
        cue_candidate: realismCueCandidate,
        final_cue: cue.label,
        dialogue_enforced: true,
      },
      predictive_brain_authority: {
        predictive_context_received: Boolean(predictivePromptContext.trim()),
        guardrails_demoted_to_validators: true,
        final_stock_phrase_detected: hasGlobalStockPhrase(hcpReply),
        final_missing_pressure: missingPersistentPressure(hcpReply, scenario, hcpTurnCount),
      },
    },
  };
}
