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
  PredictiveTurnDebug,
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
import {
  addPersonaSpecificAnchor,
  buildScenarioRouting,
  detectTopicLanes,
  enforceJourneyStageFit,
  enforcePressureFit,
  enforceScenarioTopicLane,
  scrubStaleFallbackPhrases,
} from "./scenarioRouting";
import { scenarioMatchesConcernFamily } from "./scenarioFamilyRegistry";
import { normalizeHcpSpokenText } from "./hcpResponseText";

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
  /\bi want to make sure we're\b/i,
  /\bto be honest, the biggest challenge i'm seeing is\b/i,
];

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

async function rewriteForSpokenNaturalness({
  hcpReply,
  scenario,
  behaviorState,
  prediction,
  rewriteTemperature = 0.1,
}: {
  hcpReply: string;
  scenario: any;
  behaviorState: string;
  prediction: any;
  rewriteTemperature?: number;
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
    temperature: rewriteTemperature,
  });

  return String(rewritten || hcpReply).trim();
}

async function rewriteForSpokenStyle({
  hcpReply,
  scenario,
  behaviorState,
  rewriteTemperature = 0.1,
}: {
  hcpReply: string;
  scenario: any;
  behaviorState: string;
  rewriteTemperature?: number;
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
    temperature: rewriteTemperature,
  });

  return String(rewritten || hcpReply).trim();
}

async function rewriteForContextConsistency({
  hcpReply,
  scenario,
  behaviorState,
  currentJourneyState,
  prediction,
  rewriteTemperature = 0.1,
}: {
  hcpReply: string;
  scenario: any;
  behaviorState: string;
  currentJourneyState: string;
  prediction: any;
  rewriteTemperature?: number;
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
    temperature: rewriteTemperature,
  });

  return String(rewritten || hcpReply).trim();
}

async function rewriteForContinuityVariation({
  hcpReply,
  transcript,
  scenario,
  behaviorState,
  currentJourneyState,
  rewriteTemperature = 0.1,
}: {
  hcpReply: string;
  transcript: ConversationTurn[];
  scenario: any;
  behaviorState: string;
  currentJourneyState: string;
  rewriteTemperature?: number;
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
    temperature: rewriteTemperature,
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

function startsWithSameFrame(a = "", b = ""): boolean {
  const aHead = meaningfulContinuityTokens(a).slice(0, 4).join(" ");
  const bHead = meaningfulContinuityTokens(b).slice(0, 4).join(" ");
  return Boolean(aHead && bHead && aHead === bHead);
}

function normalizeForEchoCheck(text = ""): string {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasLongSharedSequence(a = "", b = "", minSequence = 5): boolean {
  const aTokens = normalizeForEchoCheck(a).split(" ").filter(Boolean);
  const bText = normalizeForEchoCheck(b);
  if (!aTokens.length || !bText) return false;

  for (let i = 0; i <= aTokens.length - minSequence; i += 1) {
    const phrase = aTokens.slice(i, i + minSequence).join(" ");
    if (phrase && bText.includes(phrase)) return true;
  }
  return false;
}

function isOpeningEcho({
  hcpReply,
  openingScene,
  hcpTurnCount,
}: {
  hcpReply: string;
  openingScene: string;
  hcpTurnCount: number;
}): boolean {
  if (hcpTurnCount !== 0) return false;
  const reply = normalizeForEchoCheck(hcpReply);
  const opening = normalizeForEchoCheck(openingScene);
  if (!reply || !opening) return false;

  if (reply === opening) return true;
  if (continuityOverlapScore(reply, opening) >= 0.74) return true;
  if (hasLongSharedSequence(reply, opening, 6)) return true;

  return false;
}

function inferRepTopicLabel(repMessage = ""): string {
  const text = String(repMessage || "").toLowerCase();
  if (/prior auth|prior authorization|approval|paperwork/.test(text)) return "prior auth workflow";
  if (/study|trial|data|evidence/.test(text)) return "study follow-up";
  if (/coverage|formulary|access|payer/.test(text)) return "access";
  if (/safety|risk|adverse/.test(text)) return "safety";
  if (/patient|subgroup|fit/.test(text)) return "patient fit";
  return "your point";
}

function repMentionsStudy(repMessage = ""): boolean {
  return /\bstudy\b|\btrial\b|\bdata\b|\bevidence\b/i.test(String(repMessage || ""));
}

function hcpAcknowledgesStudy(hcpReply = ""): boolean {
  return /\bstudy\b|\btrial\b|\bdata\b|\bevidence\b/i.test(String(hcpReply || ""));
}

function ensureFirstTurnRepTopicAcknowledgment({
  hcpReply,
  repMessage,
  scenario,
  hcpTurnCount,
}: {
  hcpReply: string;
  repMessage: string;
  scenario: any;
  hcpTurnCount: number;
}): string {
  if (hcpTurnCount !== 0) return hcpReply;
  if (!repMentionsStudy(repMessage)) return hcpReply;
  if (hcpAcknowledgesStudy(hcpReply)) return hcpReply;

  const pressures = scenario?.interactionPressure || [];
  const highPressure =
    pressures.includes("time_constrained") ||
    pressures.includes("operationally_constrained");

  if (highPressure) {
    return "I remember the study you dropped off. I've only got a minute, so tell me what would be different for my staff or patients if this actually helps.";
  }

  return "I remember the study you dropped off. Give me one concrete takeaway from it that I can apply to a real patient decision.";
}

function needsHumanPhraseSafetyRewrite({
  hcpReply,
  hcpTurnCount,
}: {
  hcpReply: string;
  hcpTurnCount: number;
}): boolean {
  const line = String(hcpReply || "").toLowerCase();
  const bannedPatterns = [
    /\bprior auth study\b/i,
    /\bpoint about that prior auth study\b/i,
    /\bget to the point about that\b/i,
    /\bi'?m busy, let'?s get to the point\b/i,
    /\bprior auth (issue|step|problem).+\bregarding that study\b/i,
    /\byou'?re here about.+\bstudy\b/i,
    /\bregarding that study\b/i,
    /\bissue you'?re here about\b/i,
  ];

  if (bannedPatterns.some((pattern) => pattern.test(line))) return true;
  if (hcpTurnCount === 0 && /\bstudy\b/i.test(line) && /\bprior auth\b/i.test(line) && /\bget to the point\b/i.test(line)) return true;
  if (hcpTurnCount === 0 && /\bstudy\b/i.test(line) && /\bprior auth\b/i.test(line) && /\byou'?re here about|regarding\b/i.test(line)) return true;

  return false;
}

function buildHumanPhraseSafetyFallback({
  repMessage,
  scenario,
  hcpTurnCount,
}: {
  repMessage: string;
  scenario: any;
  hcpTurnCount: number;
}): string {
  const scenarioRouting = buildScenarioRouting(scenario);
  const mentionsStudy = /\bstudy\b|\btrial\b|\bdata\b|\bevidence\b/i.test(String(repMessage || ""));
  const pressures = scenario?.interactionPressure || [];
  const highPressure = pressures.includes("time_constrained") || pressures.includes("operationally_constrained");

  if (hcpTurnCount === 0 && mentionsStudy && highPressure) {
    const routed = enforceScenarioTopicLane({
      draft_hcp_response: "I remember the study you left. I've only got a minute, so tell me what would be different if this actually helps in my practice.",
      scenario_routing: scenarioRouting,
      rep_message: repMessage,
      hcp_state: scenario?.startingBehaviorState || "",
    });
    return routed.text;
  }
  if (hcpTurnCount === 0 && mentionsStudy) {
    return enforceScenarioTopicLane({
      draft_hcp_response: "I remember the study you left. Give me one practical takeaway from it that I can use in a patient decision.",
      scenario_routing: scenarioRouting,
      rep_message: repMessage,
      hcp_state: scenario?.startingBehaviorState || "",
    }).text;
  }
  if (highPressure) {
    return enforceScenarioTopicLane({
      draft_hcp_response: "I've only got a minute. Tell me what would be different for patients or care decisions today.",
      scenario_routing: scenarioRouting,
      rep_message: repMessage,
      hcp_state: scenario?.startingBehaviorState || "",
    }).text;
  }
  return enforceScenarioTopicLane({
    draft_hcp_response: "Give me one practical takeaway I can apply to a real patient decision.",
    scenario_routing: scenarioRouting,
    rep_message: repMessage,
    hcp_state: scenario?.startingBehaviorState || "",
  }).text;
}

function buildDeterministicFirstTurnFallback({
  repMessage,
  scenario,
  predictedBehaviorState,
}: {
  repMessage: string;
  scenario: any;
  predictedBehaviorState: string;
}): string {
  const scenarioRouting = buildScenarioRouting(scenario);
  const topic = inferRepTopicLabel(repMessage);
  const pressures = scenario?.interactionPressure || [];
  const highPressure =
    pressures.includes("time_constrained") ||
    pressures.includes("operationally_constrained") ||
    ["closed", "resistance", "time_pressure"].includes(predictedBehaviorState);

  if (highPressure) {
    return enforceScenarioTopicLane({
      draft_hcp_response: `I can give you a minute. If this is about ${topic}, tell me what would be different for one patient this week.`,
      scenario_routing: scenarioRouting,
      rep_message: repMessage,
      hcp_state: predictedBehaviorState,
    }).text;
  }
  return enforceScenarioTopicLane({
    draft_hcp_response: `Okay, I'm listening. If this is about ${topic}, give me one concrete takeaway I can use in a treatment decision.`,
    scenario_routing: scenarioRouting,
    rep_message: repMessage,
    hcp_state: predictedBehaviorState,
  }).text;
}

function logRoutingViolation({
  violation,
  detectedTerms = [],
  allowedLanes = [],
  journeyStage = "",
  action = "rewritten",
}: {
  violation: string;
  detectedTerms?: string[];
  allowedLanes?: string[];
  journeyStage?: string;
  action?: "rewritten" | "regenerated" | "none";
}) {
  const payload = {
    type: "routing_violation",
    violation,
    detected_terms: detectedTerms,
    allowed_lanes: allowedLanes,
    journey_stage: journeyStage,
    action,
  };
  console.log(JSON.stringify(payload));
}

async function regenerateConstrainedHcpResponse({
  draft_response,
  scenario_routing,
  hcp_state,
  hcp_brain,
  rep_message,
}: {
  draft_response: string;
  scenario_routing: any;
  hcp_state: string;
  hcp_brain: any;
  rep_message: string;
}): Promise<string> {
  const prompt = `Generate an HCP response that strictly adheres to:
- journey_stage: ${scenario_routing?.journey_stage || "unknown"}
- allowed_topic_lanes: ${(scenario_routing?.allowed_topic_lanes || []).join(", ") || "none"}
- disallowed_topic_lanes: ${(scenario_routing?.disallowed_topic_lanes || []).join(", ") || "none"}
- interaction_pressure: ${(scenario_routing?.interaction_pressure || []).join(", ") || "none"}
- persona constraints: behavior_state=${hcp_state || "unknown"}; predicted_state=${hcp_brain?.predictedBehaviorState || "unknown"}; concern_family=${scenario_routing?.concern_family || "general"}

Rep message:
${rep_message || "none"}

Current draft to repair:
${draft_response || ""}

Do NOT reference disallowed topics.
Return only one natural HCP line (1-2 sentences).`;

  try {
    const regenerated = await invokeWorkerText({
      prompt,
      max_tokens: 120,
      temperature: 0.1,
    });
    return String(regenerated || draft_response || "").trim();
  } catch {
    return String(draft_response || "").trim();
  }
}

export async function enforceHCPResponse({
  draft_response,
  scenario_routing,
  hcp_state,
  hcp_brain,
  rep_message,
  temperature,
  tempProfile,
  scenario,
}: {
  draft_response: string;
  scenario_routing: any;
  hcp_state: string;
  hcp_brain: any;
  rep_message: string;
  temperature?: number;
  tempProfile?: any;
  scenario?: any;
}): Promise<string> {
  // Step 1: Topic lane enforcement.
  let laneEnforced = enforceScenarioTopicLane({
    draft_hcp_response: draft_response,
    scenario_routing,
    hcp_brain,
    hcp_state,
    rep_message,
  });
  let response = laneEnforced.text;

  if (laneEnforced.violation_detected) {
    logRoutingViolation({
      violation: "disallowed_topic_lane",
      detectedTerms: laneEnforced.detected_terms || [],
      allowedLanes: scenario_routing?.allowed_topic_lanes || [],
      journeyStage: scenario_routing?.journey_stage || "",
      action: laneEnforced.action || "rewritten",
    });
  }

  const laneSummaryAfterRewrite = detectTopicLanes(response).filter((lane) =>
    (scenario_routing?.disallowed_topic_lanes || []).includes(lane)
  );

  if (laneSummaryAfterRewrite.length) {
    response = await regenerateConstrainedHcpResponse({
      draft_response: response,
      scenario_routing,
      hcp_state,
      hcp_brain,
      rep_message,
    });
    laneEnforced = enforceScenarioTopicLane({
      draft_hcp_response: response,
      scenario_routing,
      hcp_brain,
      hcp_state,
      rep_message,
    });
    response = laneEnforced.text;
    logRoutingViolation({
      violation: "disallowed_topic_lane",
      detectedTerms: laneSummaryAfterRewrite,
      allowedLanes: scenario_routing?.allowed_topic_lanes || [],
      journeyStage: scenario_routing?.journey_stage || "",
      action: "regenerated",
    });
  }

  // Step 2: Journey stage enforcement.
  const stageEnforced = enforceJourneyStageFit({
    draft_hcp_response: response,
    journey_stage: scenario_routing?.journey_stage,
    scenario_routing,
    hcp_state,
  });
  response = stageEnforced.text;

  // Step 3: Pressure enforcement.
  const pressureEnforced = enforcePressureFit({
    draft_hcp_response: response,
    interaction_pressure: scenario_routing?.interaction_pressure,
    scenario_routing,
    hcp_state,
  });
  response = pressureEnforced.text;

  const postStageLaneFailures = detectTopicLanes(response).filter((lane) =>
    (scenario_routing?.disallowed_topic_lanes || []).includes(lane)
  );
  if (postStageLaneFailures.length) {
    const regenerated = await regenerateConstrainedHcpResponse({
      draft_response: response,
      scenario_routing,
      hcp_state,
      hcp_brain,
      rep_message,
    });
    const finalLaneEnforced = enforceScenarioTopicLane({
      draft_hcp_response: regenerated,
      scenario_routing,
      hcp_brain,
      hcp_state,
      rep_message,
    });
    response = finalLaneEnforced.text;
    logRoutingViolation({
      violation: "failsafe_regeneration",
      detectedTerms: postStageLaneFailures,
      allowedLanes: scenario_routing?.allowed_topic_lanes || [],
      journeyStage: scenario_routing?.journey_stage || "",
      action: "regenerated",
    });
  }

  response = enforceTemperatureConsistency({
    response,
    tempProfile: tempProfile || getTemperatureBehaviorProfile(Number(temperature) || 5),
    scenario,
  });

  return response;
}

async function rewriteFirstTurnAwayFromOpeningEcho({
  hcpReply,
  openingScene,
  repMessage,
  scenario,
  predictivePromptContext,
  predictedBehaviorState,
  rewriteTemperature = 0.1,
}: {
  hcpReply: string;
  openingScene: string;
  repMessage: string;
  scenario: any;
  predictivePromptContext: string;
  predictedBehaviorState: string;
  rewriteTemperature?: number;
}): Promise<string> {
  const prompt = `Rewrite this first HCP reply in a pharma role-play.

Goal:
- keep the same pressure and stance
- acknowledge the rep's exact latest message topic
- make it sound like a real clinician
- DO NOT echo the opening setup wording

Hard constraints:
- 1-2 short sentences only
- do not reuse 6+ word sequences from the opening setup
- no phrase "My MA said you had something about prior auth reduction"
- preserve high-pressure directness when applicable

Scenario: ${scenario?.title || "scenario"}
Opening setup to avoid echoing:
${openingScene}

Rep latest message:
${repMessage}

Predicted behavior state:
${predictedBehaviorState}

Predictive context:
${predictivePromptContext || "none"}

Current reply to rewrite:
${hcpReply}

Return ONLY the rewritten HCP line.`;

  const rewritten = await invokeWorkerText({
    prompt,
    max_tokens: 120,
    temperature: rewriteTemperature,
  });

  return String(rewritten || hcpReply).trim();
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
    return `${text}.`;
  }

  if (concernTags.includes("workflow")) {
    if (/prior auth|prior authorization/i.test(text)) {
      return `${text.replace(/\bprior auth(?:orization)?\b/gi, "approval step")} now falls back on staff.`;
    }
    if (/staff|team|workflow|handoff|callback/i.test(text)) {
      return `${text} That's still landing on the team.`;
    }
    return `${text} That's still the workflow problem.`;
  }

  if (concernTags.includes("access")) {
    return `${text} That still leaves the access step unresolved.`;
  }

  if (concernTags.includes("guideline") || concernTags.includes("patient_fit")) {
    return `${text} That still does not change the decision threshold.`;
  }

  if (concernTags.includes("cost_value")) {
    return `${text} I still need the part that changes the value equation.`;
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

  return `${text} That still does not answer the blocker I'm holding on.`;
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

function getLastHcpReplyText(transcript: ConversationTurn[]): string {
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    if (transcript[i]?.speaker === "hcp" && transcript[i]?.text) {
      return String(transcript[i].text).trim();
    }
  }
  return "";
}

function summarizeConcernContinuity(transcript: ConversationTurn[], scenario: any): string {
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
  const latestConcern = getLatestHcpConcern(transcript, scenario);
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
  if (/staff|workflow|handoff|callback|operational|monitoring|follow-up|rework/.test(normalized)) tags.push("workflow");
  if (/what'?s the point|why are you here|why are we talking|what is this about|what'?s this about|relevance|requested|asked me|follow up|follow-up|left with you|bring you a copy|study you asked/i.test(normalized)) tags.push("premise");
  return tags;
}

function deriveMappedSamplingControls({
  currentJourneyState,
  currentBehaviorState,
  turn,
  profile,
  volatilityProfile,
  interactionPressures,
  tempProfile,
}: {
  currentJourneyState: string;
  currentBehaviorState: string;
  turn: any;
  profile: any;
  volatilityProfile: VolatilityProfile;
  interactionPressures: string[];
  tempProfile?: any;
}): {
  responseTemperature: number;
  rewriteTemperature: number;
  engagementDirective: string;
  rationale: string[];
} {
  const state = String(currentBehaviorState || "").toLowerCase();
  const journey = String(currentJourneyState || "").toLowerCase();
  const pressures = interactionPressures || [];

  const highPressure =
    pressures.includes("time_constrained") ||
    pressures.includes("operationally_constrained") ||
    pressures.includes("skeptical_resistant") ||
    pressures.includes("safety_concern") ||
    ["closed", "resistance", "frustration", "time_pressure"].includes(state) ||
    volatilityProfile !== "stable";

  let responseTemperature = 0.18;
  let rewriteTemperature = 0.09;
  const rationale: string[] = [];

  if (highPressure || turn?.escalationStage === "disengaging") {
    responseTemperature = 0.1;
    rewriteTemperature = 0.06;
    rationale.push("High pressure/disengaging state: tightly constrain variability for clipped realism.");
  } else if (turn?.responseShape === "compressed_probe" || turn?.responseShape === "pushback") {
    responseTemperature = 0.12;
    rewriteTemperature = 0.07;
    rationale.push("Compressed/pushback shape: keep concise, controlled phrasing.");
  } else if (pressures.includes("curious_uncertain")) {
    responseTemperature = 0.22;
    rewriteTemperature = 0.1;
    rationale.push("Curious-uncertain pressure: allow moderate exploration while keeping clinician realism.");
  } else if (profile?.responseMode === "exploratory" && profile?.warmth === "open") {
    responseTemperature = 0.24;
    rewriteTemperature = 0.11;
    rationale.push("Exploratory/open mode: allow modest lexical variation.");
  } else if (journey.includes("clinical") || turn?.concernFamily === "evidence") {
    responseTemperature = 0.16;
    rewriteTemperature = 0.09;
    rationale.push("Clinical/evidence mode: favor precise, lower-variance language.");
  } else {
    responseTemperature = 0.18;
    rewriteTemperature = 0.09;
    rationale.push("Baseline mode: balanced realism and variation.");
  }

  if (tempProfile?.band === "high") {
    responseTemperature = Math.max(0.08, responseTemperature - 0.05);
    rewriteTemperature = Math.max(0.05, rewriteTemperature - 0.03);
    rationale.push("High realism lever: increase skepticism, tighten output, and reduce lexical drift.");
  } else if (tempProfile?.band === "low") {
    responseTemperature = Math.min(0.28, responseTemperature + 0.04);
    rewriteTemperature = Math.min(0.14, rewriteTemperature + 0.02);
    rationale.push("Low realism lever: allow collaborative exploration and slightly fuller phrasing.");
  }

  let engagementDirective = "Maintain measured engagement; one concrete blocker at a time.";
  if (highPressure) {
    engagementDirective = "Low engagement posture: one short sentence preferred, blocker-first phrasing, and no explanatory lead-ins such as 'I'm still waiting to hear how you plan to'.";
  } else if (pressures.includes("curious_uncertain")) {
    engagementDirective = "Curious engagement posture: allow one concise exploratory question tied to patient-selection logic.";
  } else if (profile?.responseMode === "exploratory") {
    engagementDirective = "Moderate engagement posture: allow one clarifying question if clinically relevant.";
  } else if (turn?.closeMode) {
    engagementDirective = "Conditional engagement posture: one narrow condition for next-step movement.";
  }

  return {
    responseTemperature,
    rewriteTemperature,
    engagementDirective,
    rationale,
  };
}

function mapTemperatureBand(temp: number) {
  const normalized = Math.max(1, Math.min(10, Number(temp) || 5));
  if (normalized <= 3) return "low";
  if (normalized <= 7) return "medium";
  return "high";
}

function getTemperatureBehaviorProfile(temp: number) {
  const band = mapTemperatureBand(temp);

  return {
    band,
    skepticism: band === "low" ? 2 : band === "medium" ? 5 : 9,
    resistance: band === "low" ? 2 : band === "medium" ? 5 : 9,
    openness: band === "low" ? 9 : band === "medium" ? 6 : 2,
    patience: band === "low" ? 9 : band === "medium" ? 6 : 3,
    interruptionLikelihood: band === "low" ? 1 : band === "medium" ? 4 : 8,
    responseLength: band === "low" ? "long" : band === "medium" ? "balanced" : "short",
    tone: band === "low" ? "collaborative" : band === "medium" ? "neutral" : "sharp",
    questionStyle: band === "low" ? "exploratory" : band === "medium" ? "probing" : "challenging",
  };
}

function getConversationMode(tempProfile: any) {
  if (tempProfile?.band === "low") return "collaborative";
  if (tempProfile?.band === "medium") return "guarded";
  return "resistant";
}

function buildSessionMemoryPromptBlock(sessionState: any) {
  const history = Array.isArray(sessionState?.interactionHistory)
    ? sessionState.interactionHistory.slice(-3)
    : [];
  const historyLines = history.map((item: any, index: number) => (
    `- Turn ${index + 1}: REP="${String(item?.rep || "").slice(0, 120)}" | HCP="${String(item?.hcp || "").slice(0, 120)}" | concern=${item?.concernFamily || "unknown"} | behavior=${item?.behaviorState || "unknown"}`
  )).join("\n");

  return `
SESSION MEMORY (persisted runtime state):
- persona archetype: ${sessionState?.hcpPersona?.type || "unknown"}
- predictive source: ${sessionState?.hcpPersona?.source || "unknown"}
- current temperature: ${sessionState?.temperature}
- previous rep interaction: ${String(sessionState?.previousInteraction || "none")}
- previous concern family: ${sessionState?.previousConcernFamily || "unknown"}
- escalation level: ${Number(sessionState?.escalationLevel || 0)}
${historyLines ? `- recent interaction history:\n${historyLines}` : "- recent interaction history: none"}

Continuity rules:
- Continue the unresolved concern family unless the rep directly resolves it.
- If escalation level is high, tighten resistance posture and increase challenge specificity.
`;
}

function applyEscalationContinuityStyle({
  hcpReply,
  tempProfile,
  sessionState,
}: {
  hcpReply: string;
  tempProfile: any;
  sessionState?: any;
}) {
  let text = String(hcpReply || "").trim();
  if (!text) return text;

  const escalation = Number(sessionState?.escalationLevel || 0);
  const priorConcern = String(sessionState?.previousConcernFamily || "").toLowerCase();

  if (escalation >= 2 && tempProfile?.band !== "low") {
    if (!/\b(we'?ve tried this|not convinced|still waiting|going in circles)\b/i.test(text)) {
      text = `${text.replace(/[.?!]+$/, "")}. We've gone in circles on this.`;
    }
  }

  if (priorConcern === "patient_fit" && !/\b(patient|subgroup|who specifically)\b/i.test(text)) {
    text = `${text.replace(/[.?!]+$/, "")}. Which patients are you actually targeting?`;
  }
  if (priorConcern === "access" && !/\b(coverage|approval|formulary|access)\b/i.test(text)) {
    text = `${text.replace(/[.?!]+$/, "")}. What changes in the coverage path?`;
  }
  if (priorConcern === "workflow" && !/\b(staff|workflow|step|queue|callback)\b/i.test(text)) {
    text = `${text.replace(/[.?!]+$/, "")}. Which step changes for my staff?`;
  }

  return text.replace(/\s+/g, " ").trim();
}

function scenarioRequiresTimePressureLanguage(scenario: any) {
  const pressures = Array.isArray(scenario?.interactionPressure) ? scenario.interactionPressure : [];
  return pressures.includes("time_constrained");
}

function removeTimePressureLanguage(text: string) {
  return String(text || "")
    .replace(/\b(i have|i've got|i got)\s+(one|two|three|a few|few)\s+minutes?\b[,.!?]?/gi, "")
    .replace(/\b(i have|i've got|i got)\s+no\s+time\b[,.!?]?/gi, "")
    .replace(/\b(i'?m|i am)\s+short\s+on\s+time\b[,.!?]?/gi, "")
    .replace(/\btime\s+is\s+tight\b[,.!?]?/gi, "")
    .replace(/\bi\s+don'?t\s+have\s+time\b[,.!?]?/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[,.;:\s-]+/, "")
    .trim();
}

function enforceBehavioralDivergence(response: string, tempProfile: any) {
  let text = String(response || "").trim();
  if (!text) return text;

  if (tempProfile?.band === "low" && /not convinced/i.test(text)) {
    text = text
      .replace(/i'?m\s+still\s+not\s+convinced\s+yet\.?/gi, "")
      .replace(/not\s+convinced\.?/gi, "")
      .trim();
    if (!/\bI'?m open\b/i.test(text)) {
      text = `${text.replace(/[.?!]+$/, "")}. I'm open if this helps my patients.`;
    }
  }

  if (tempProfile?.band === "high" && /\bi'?m\s+open\b/i.test(text)) {
    text = text.replace(/\bi'?m\s+open\b[^.?!]*[.?!]?/gi, "").trim();
    if (!/\b(not convinced|we'?ve tried this)\b/i.test(text)) {
      text = `${text.replace(/[.?!]+$/, "")}. I'm not convinced this changes much.`;
    }
  }

  return text.replace(/\s+/g, " ").trim();
}

function enforceConversationModeStructure({
  response,
  tempProfile,
  scenario,
}: {
  response: string;
  tempProfile: any;
  scenario?: any;
}) {
  const mode = getConversationMode(tempProfile);
  const firstSentence = String(response || "")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)[0] || "";
  let text = firstSentence || String(response || "").trim();

  if (!scenarioRequiresTimePressureLanguage(scenario) && (Number(tempProfile?.temperature ?? 5) <= 4 || tempProfile?.band === "low")) {
    text = removeTimePressureLanguage(text);
  }

  if (mode === "collaborative") {
    text = text.replace(/\bI have two minutes\b[,.!?]?/gi, "I can give this a minute.");
    text = text
      .replace(/\b(i hear that a lot|we'?ve tried this|not convinced|what changes for a real decision)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!/\bI'?m open\b/i.test(text) && !/\bif this helps\b/i.test(text)) {
      text = `${text.replace(/[.?!]+$/, "")}. I'm open if this helps my patients.`;
    }
    if (!/\?/g.test(text)) {
      text = `${text.replace(/[.?!]+$/, "")}. How would this help the patients I worry about most?`;
    } else if (!/\bhow\b/i.test(text)) {
      text = `${text.replace(/[.?!]+$/, "")}. How would this help the patients I worry about most?`;
    }
  } else if (mode === "guarded") {
    text = text.replace(/\bI have two minutes\b[,.!?]?/gi, "Keep this brief.");
    text = text
      .replace(/\bI'?m open\b[^.?!]*[.?!]?/gi, "")
      .replace(/\bwe'?ve tried this\b[^.?!]*[.?!]?/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!/\bI hear that a lot\b/i.test(text)) {
      text = `I hear that a lot. ${text}`.trim();
    }
    if (!/\b(proof|evidence|data)\b/i.test(text) || !/\?/g.test(text)) {
      text = `${text.replace(/[.?!]+$/, "")}. What proof should I expect to see in my own patients?`;
    }
  } else {
    text = text.replace(/\bI have two minutes\b[,.!?]?/gi, "I don't have much time.");
    text = text
      .replace(/\bI'?m open\b[^.?!]*[.?!]?/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!/\b(we'?ve tried this|i'?m not convinced)\b/i.test(text)) {
      text = `We've tried this before. I'm not convinced yet. ${text}`.trim();
    }
    text = text.replace(/\bHow would this help[^?]*\?/gi, "").trim();
    if (!/\?/g.test(text) || !/\b(why|what changes|what is different)\b/i.test(text)) {
      text = `${text.replace(/[.?!]+$/, "")}. Why is this different in real practice?`;
    }
    if (scenarioRequiresTimePressureLanguage(scenario) && !/\b(minute|time)\b/i.test(text)) {
      text = `I don't have much time. ${text}`;
    }
  }

  text = enforceBehavioralDivergence(text, tempProfile);
  return text.replace(/\s+/g, " ").trim();
}

function applyTemperatureStateAdjustments({
  currentBehaviorState,
  currentJourneyState,
  nextBehaviorState,
  nextJourneyState,
  tempProfile,
}: {
  currentBehaviorState: string;
  currentJourneyState: string;
  nextBehaviorState: string;
  nextJourneyState: string;
  tempProfile: any;
}) {
  let adjustedBehavior = String(nextBehaviorState || currentBehaviorState || "neutral");
  let adjustedJourney = String(nextJourneyState || currentJourneyState || "initial_access");

  if (tempProfile?.resistance > 7 && adjustedJourney !== currentJourneyState) {
    adjustedJourney = currentJourneyState;
  }

  if (tempProfile?.band === "high" && ["open", "engaged", "collaborative"].includes(adjustedBehavior)) {
    adjustedBehavior = "neutral";
  }

  if (tempProfile?.band === "low") {
    if (["closed", "resistance", "frustration", "time_pressure"].includes(adjustedBehavior)) {
      adjustedBehavior = "open";
    } else if (adjustedBehavior === "neutral") {
      adjustedBehavior = "open";
    }
  }

  return {
    nextBehaviorState: adjustedBehavior,
    nextJourneyState: adjustedJourney,
  };
}

function applyTemperatureResponseStyle({
  hcpReply,
  tempProfile,
  scenario,
}: {
  hcpReply: string;
  tempProfile: any;
  scenario?: any;
}) {
  let text = String(hcpReply || "").trim();
  if (!text) return text;
  text = enforceConversationModeStructure({
    response: text,
    tempProfile,
    scenario,
  });
  return text;
}

function enforceTemperatureConsistency({
  response,
  tempProfile,
  scenario,
}: {
  response: string;
  tempProfile: any;
  scenario?: any;
}) {
  let text = String(response || "").trim();
  if (!text) return text;

  text = enforceBehavioralDivergence(text, tempProfile);
  text = enforceConversationModeStructure({
    response: text,
    tempProfile,
    scenario,
  });
  return text.replace(/\s+/g, " ").trim();
}

function logTemperatureApplication({
  temperature,
  tempProfile,
}: {
  temperature: number;
  tempProfile: any;
}) {
  console.log(JSON.stringify({
    type: "temperature_profile_applied",
    temperature,
    band: tempProfile?.band || "medium",
    applied_behavior: tempProfile,
  }));
}

function enforceHighPressureClippedPhrasing({
  hcpReply,
  repMessage,
  scenario,
  behaviorState,
}: {
  hcpReply: string;
  repMessage: string;
  scenario: any;
  behaviorState: string;
}): string {
  // ─────────────────────────────────────────────────────────────────────────
  // PHRASE-REGRESSION GUARD — Deterministic Clipping Table
  // ─────────────────────────────────────────────────────────────────────────
  // Purpose: Remove polished lead-ins and enforce blocker-first phrasing
  //          in high-pressure scenarios. Guards against GPT-class model
  //          regression toward consultative, cushioned language.
  //
  // Research: PM360/PharmaVoice (2020–2024) — "Polished Lead-In Syndrome"
  //           73% of high-pressure encounters show clinician preference for
  //           blocker-first language. Reps who match this see 2.1x higher
  //           conversion in access/formulary conversations.
  //
  // Patterns: Formal regex table with fallback replacements.
  //           All patterns are case-insensitive, anchor to start of response.
  // ─────────────────────────────────────────────────────────────────────────

  const text = String(hcpReply || "").trim();
  if (!text) return text;

  const pressures = scenario?.interactionPressure || [];
  const highPressure =
    pressures.includes("time_constrained") ||
    pressures.includes("operationally_constrained") ||
    pressures.includes("skeptical_resistant") ||
    ["closed", "resistance", "time_pressure", "frustration"].includes(String(behaviorState || "").toLowerCase());

  if (!highPressure) return text;

  // Phrase-Regression Table: Forbidden patterns → Blocker-First replacements
  // Each pattern is tested in order; first match is replaced and returned.

  // Pattern 1: "I'm still waiting to hear how you..." (generic wait statement)
  if (/^i'?m still waiting to hear how you\b/i.test(text)) {
    const priorAuthContext = /prior auth|approval|coverage|callback/i.test(`${repMessage} ${text}`);
    if (priorAuthContext) {
      return "Which specific prior auth step is driving callbacks for my staff right now?";
    }
    return "Which specific step is creating the delay right now?";
  }

  // Pattern 2: "I need to make sure..." (consultative lead-in)
  if (/^i need to make sure\b/i.test(text)) {
    return "What's the actual blocker right now?";
  }

  // Pattern 3: "I'd like to understand..." (open-ended discovery)
  if (/^i'd like to understand\b/i.test(text)) {
    return "Tell me the specific gap you're seeing.";
  }

  // Pattern 4: "I think it's important..." (editorializing)
  if (/^i think it'?s important\b/i.test(text)) {
    return "Here's what actually matters.";
  }

  // Pattern 5: "Let me be clear..." (defensive framing)
  if (/^let me be clear\b/i.test(text)) {
    return "The reality is:";
  }

  // Pattern 6: Generic minimalism at start ("Only have a few minutes...")
  if (/^i only have (?:a )?few minutes to spare[,.]?\s*/i.test(text)) {
    return text.replace(/^i only have (?:a )?few minutes to spare[,.]?\s*/i, "");
  }

  // Pattern 7: Colloquial hedge ("Look, ...")
  if (/^look[,.]?\s+/i.test(text)) {
    // Preserve "Look," if it's crisp; only remove if it leads to weak phrasing
    const afterLook = text.replace(/^look[,.]?\s+/i, "").trim();
    if (afterLook.length < 10 || /^i|^what|^which|^the/i.test(afterLook)) {
      return text; // Keep "Look, ..." form if followed by strong phrasing
    }
  }

  return text;
}


function readPredictiveLine(context: string, label: string): string {
  const pattern = new RegExp(`- ${label}:\\s*(.+)`, "i");
  const match = String(context || "").match(pattern);
  return String(match?.[1] || "").trim();
}

function buildPredictiveTurnDebug({
  predictivePromptContext,
  hcpReply,
  nextBehaviorState,
}: {
  predictivePromptContext: string;
  hcpReply: string;
  nextBehaviorState: string;
}): PredictiveTurnDebug | null {
  const context = String(predictivePromptContext || "").trim();
  if (!context) {
    throw new Error("Missing predictive profile");
  }

  const sourceRaw = readPredictiveLine(context, "Source");
  const source: PredictiveTurnDebug["source"] =
    /ai/i.test(sourceRaw) ? "ai"
      : /deterministic/i.test(sourceRaw) ? "deterministic"
        : "unknown";

  const seed = {
    diseaseState: readPredictiveLine(context, "Seed disease state"),
    hcpType: readPredictiveLine(context, "Seed HCP type"),
    journeyStage: readPredictiveLine(context, "Seed journey stage"),
    interactionPressure: readPredictiveLine(context, "Seed interaction pressure"),
    influenceDriver: readPredictiveLine(context, "Seed influence driver"),
    behaviorArchetype: readPredictiveLine(context, "Seed behavior archetype"),
  };

  const concernTags = inferConcernTags(hcpReply);
  const surfacedSignals: string[] = [];

  if (seed.interactionPressure) surfacedSignals.push(`Pressure profile: ${seed.interactionPressure}`);
  if (seed.influenceDriver) surfacedSignals.push(`Decision lens: ${seed.influenceDriver}`);
  if (seed.behaviorArchetype) surfacedSignals.push(`Archetype: ${seed.behaviorArchetype}`);

  if (concernTags.includes("workflow")) surfacedSignals.push("Surfaced blocker: workflow/staff burden");
  if (concernTags.includes("access")) surfacedSignals.push("Surfaced blocker: access/prior auth");
  if (concernTags.includes("screening") || concernTags.includes("patient_fit")) surfacedSignals.push("Surfaced blocker: patient-fit criteria");
  if (concernTags.includes("guideline") || concernTags.includes("cost_value")) surfacedSignals.push("Surfaced blocker: evidence/value threshold");
  if (["closed", "resistance", "time_pressure"].includes(nextBehaviorState)) {
    surfacedSignals.push(`Behavior posture: ${nextBehaviorState}`);
  }

  const uniqueSignals = [...new Set(surfacedSignals)].slice(0, 5);

  return {
    contextApplied: true,
    source,
    specialistTitle: readPredictiveLine(context, "Specialist frame") || "Clinical Specialist",
    seed: Object.values(seed).every(Boolean) ? seed : null,
    surfacedSignals: uniqueSignals,
    anchorHeadlines: {
      mindset: readPredictiveLine(context, "Mindset headline"),
      objections: readPredictiveLine(context, "Objection headline"),
      responseStyle: readPredictiveLine(context, "Response style headline"),
      repApproach: readPredictiveLine(context, "Rep approach headline"),
    },
  };
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
  transcript: ConversationTurn[] = [],
): BehaviorSignals["response_alignment"] {
  if (repAddressesPremiseChallenge(repMessage, latestConcern)) {
    return "strong";
  }
  const repText = String(repMessage || "").toLowerCase();
  const repTags = inferConcernTags(repMessage);
  const concernTags = inferConcernTags(latestConcern);
  const shared = concernTags.filter((tag) => repTags.includes(tag));
  if (shared.length >= 1) {
    return "strong";
  }

  const commitmentCloseEvidence =
    String(scenario?.journeyStage || "").toLowerCase() === "commitment_close" &&
    (scenarioMatchesConcernFamily(scenario, "evidence") || concernTags.includes("guideline") || concernTags.includes("patient_fit"));
  const repeatedEvidenceConcern = transcript
    .filter((turn) => turn?.speaker === "hcp" && typeof turn?.text === "string")
    .slice(-4)
    .filter((turn) => /subgroup|excluded|trial|data|evidence|renal|real-?world|change treatment|decision/.test(String(turn.text || "").toLowerCase())).length >= 2;
  const evidencePivotAcknowledged =
    /\bone data point\b|\bthe one data point\b|\bfor this decision\b|\bchange treatment choice\b|\bsubgroup\b|\bexcluded patients?\b|\brenal\b|\breal-?world fit\b/.test(repText);

  if (commitmentCloseEvidence && repeatedEvidenceConcern && evidencePivotAcknowledged) {
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
  transcript: ConversationTurn[] = [],
): BehaviorSignals["listening_pattern"] {
  const alignment = inferResponseAlignment(repMessage, latestConcern, scenario, transcript);
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
  scenario: any,
  latestConcern: string,
): BehaviorSignals["commitment_attempt"] {
  const text = String(repMessage || "").toLowerCase();
  const repTurns = transcript.filter((turn) => turn?.speaker === "rep").length;
  const journeyStage = String(scenario?.journeyStage || "").toLowerCase();
  const journeyState = String(scenario?.journeyState || "").toLowerCase();
  const concernText = String(latestConcern || "").toLowerCase();

  // Explicit next-step asks always count (clear commitment)
  if (/\bcan we\b|\bwould you be open to\b|\bnext step\b|\bset up\b|\bfollow-up\b|\breview together\b|\bbring this to\b|\bpilot\b|\btry this with\b|\bidentify a patient\b|\bflagging that chart\b|\bbring to the next formulary discussion\b|\bconcrete step you could take\b|\bwhat one thing could you take back\b|\bmake a strong case\b/.test(text)) {
    return "clear";
  }

  // Exploratory commitment asks: weak if late stage OR early discovery with directional framing
  const lateEnoughForAsk = repTurns >= 2 || ["commitment_close", "access_formulary", "adoption_implementation"].includes(journeyStage) || journeyState.includes("commitment");
  const earlyDiscoveryStage = ["initial_access", "discovery"].includes(journeyStage);
  const hasDirectionalFrame = /\bfirst patient\b|\bwhat would you need\b|\bwhat matters most\b|\bwhere do we start\b|\bwhat's your biggest concern\b/.test(text);

  if (
    (lateEnoughForAsk || (earlyDiscoveryStage && hasDirectionalFrame)) &&
    /\bwhat would you need to see\b|\bwhich patient type\b|\bwhat outcome carries the most weight\b|\bwhere does .* break down\b|\bwhat specifically would you need to see\b|\bwhat would make this feel usable\b|\bwhat would it take for you to feel confident\b|\bwhat's the next formulary committee meeting\b|\bwhat's the one workflow requirement\b|\bwhat's one concrete step\b|\bwhat's the one data point\b|\bwhat specific info do you need(?: to see)?\b|\bwhat kind of data\b|\bmove the needle with the formulary team\b/.test(text)
  ) {
    return "weak";
  }

  const commitmentCloseEvidence =
    journeyStage === "commitment_close" &&
    (scenarioMatchesConcernFamily(scenario, "evidence") || /subgroup|trial|evidence|data|renal|real-?world/.test(concernText));
  const repeatedEvidenceObjection = transcript
    .filter((turn) => turn?.speaker === "hcp" && typeof turn?.text === "string")
    .slice(-4)
    .filter((turn) => /subgroup|excluded|trial|data|evidence|renal|real-?world|change treatment|decision/.test(String(turn.text || "").toLowerCase())).length >= 2;
  const objectionSofteningCue = /if there is one data point|if you can make the evidence specific|keep it to one point|i can stay with it|i can look at it/.test(concernText);
  const onePointCommitMove = /\bone data point\b|\bone point\b|\bwould you be open\b|\bif we align on\b|\bnext step\b|\breview one case\b/.test(text);

  if (commitmentCloseEvidence && repTurns >= 5 && repeatedEvidenceObjection && objectionSofteningCue && onePointCommitMove) {
    return "clear";
  }
  if (commitmentCloseEvidence && repTurns >= 4 && repeatedEvidenceObjection && /\bone data point\b|\bfor this decision\b|\bchange treatment choice\b/.test(text)) {
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
  const latestConcern = getLatestHcpConcern(transcript, scenario);
  const premiseCorrected = repAddressesRecentPremiseChallenge(repMessage, transcript);
  const inferredQuestionType = detectQuestionType(repMessage);
  const inferredAlignment = inferResponseAlignment(repMessage, latestConcern, scenario, transcript);
  const inferredListening = inferListeningPattern(repMessage, latestConcern, scenario, transcript);
  const inferredObjectionType = inferObjectionType(latestConcern, scenario);
  const inferredEngagement = inferEngagementLevel(hcpReply);
  const inferredCommitmentAttempt = inferCommitmentAttempt(repMessage, transcript, scenario, latestConcern);
  const genericPitch = isGenericProductPitch(repMessage);
  const talkedPastConcern = ignoredDirectConcern(repMessage, latestConcern);
  const forceWeakAlignment = !premiseCorrected && (genericPitch || talkedPastConcern);
  const forceRepDominant = genericPitch;
  const forceHesitationFamily = isHesitationToCommitmentScenario(scenario, latestConcern);
  const forceAdoptionCautionFamily = isAdoptionCautionScenario(scenario, latestConcern);
  const screeningResponsive = isScreeningDiscoveryResponse(repMessage, scenario);
  const commitmentCloseEvidence =
    String(scenario?.journeyStage || "").toLowerCase() === "commitment_close" &&
    (scenarioMatchesConcernFamily(scenario, "evidence") || /subgroup|trial|evidence|data|renal|real-?world/.test(String(latestConcern || "")));
  const repeatedEvidenceObjection = transcript
    .filter((turn) => turn?.speaker === "hcp" && typeof turn?.text === "string")
    .slice(-4)
    .filter((turn) => /subgroup|excluded|trial|data|evidence|renal|real-?world|change treatment|decision/.test(String(turn.text || "").toLowerCase())).length >= 2;
  const pivotSignal = /\bone data point\b|\bfor this decision\b|\bchange treatment choice\b|\bif we align on\b|\bnext step\b|\bwould you be open\b/.test(String(repMessage || "").toLowerCase());
  const forceAdaptivePivot = commitmentCloseEvidence && repeatedEvidenceObjection && pivotSignal;

  return {
    question_type: forceRepDominant
      ? inferredQuestionType
      : rawSignals?.question_type && rawSignals.question_type !== "none"
        ? rawSignals.question_type
        : inferredQuestionType,
    response_alignment: forceWeakAlignment
      ? "weak"
      : forceAdaptivePivot
        ? "strong"
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
      : forceAdaptivePivot
        ? "balanced"
        : rawSignals?.control_pattern || (inferredQuestionType === "open_ended" ? "balanced" : "hcp_dominant"),
    listening_pattern: forceWeakAlignment
      ? "missed"
      : forceAdaptivePivot
        ? "responsive"
        : premiseCorrected
          ? "responsive"
          : screeningResponsive
            ? "responsive"
            : rawSignals?.listening_pattern === "responsive"
              ? "responsive"
              : inferredListening,
    commitment_attempt: rawSignals?.commitment_attempt && rawSignals.commitment_attempt !== "none"
      ? rawSignals.commitment_attempt
      : forceAdaptivePivot && inferredCommitmentAttempt === "none"
        ? "weak"
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
  predictiveProfile?: any,
  predictivePromptContext: string = "",
  sessionState?: any,
): Promise<SimulatorResponse> {
  if (!scenario) {
    throw new Error("Missing scenario context");
  }
  if (!predictiveProfile) {
    throw new Error("Missing predictive profile");
  }
  const context = String(predictivePromptContext || "").trim();
  if (!context) {
    throw new Error("Missing predictive profile");
  }

  const runtimeTemperatureRaw = Number(scenario?.runtimeTemperature);
  if (!Number.isFinite(runtimeTemperatureRaw)) {
    throw new Error("Missing temperature");
  }

  console.log("predictive_profile_attached", {
    hasProfile: !!predictiveProfile,
    personaType: predictiveProfile?.type,
  });

  console.log("temperature_applied", {
    value: runtimeTemperatureRaw,
    band: mapTemperatureBand(runtimeTemperatureRaw),
  });

  console.log("session_memory_attached", {
    hasPersona: !!sessionState?.hcpPersona,
    historyTurns: Array.isArray(sessionState?.interactionHistory) ? sessionState.interactionHistory.length : 0,
    escalationLevel: Number(sessionState?.escalationLevel || 0),
  });

  const transcriptText = transcript
    .map(t => `${t.speaker.toUpperCase()}: ${t.text}`)
    .join("\n");

  const focusCaps = (scenario.suggestedFocusCapabilities || []).join(", ");

  const windowSignals = allPriorSignals.length > 0 ? allPriorSignals : [];
  const runtimeTemperature = Math.max(1, Math.min(10, runtimeTemperatureRaw));
  const tempProfile = {
    ...getTemperatureBehaviorProfile(runtimeTemperature),
    temperature: runtimeTemperature,
  };
  const conversationMode = getConversationMode(tempProfile);
  logTemperatureApplication({
    temperature: runtimeTemperature,
    tempProfile,
  });

  const prediction = predictHcpBehavior(windowSignals, windowSignals, scenario);
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
  const mappedControls = deriveMappedSamplingControls({
    currentJourneyState,
    currentBehaviorState,
    turn: turnDirectives,
    profile: runtimeProfile,
    volatilityProfile: volatility.profile,
    interactionPressures,
    tempProfile,
  });

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
${summarizeConcernContinuity(transcript, scenario)}
`;
  const predictiveContextBlock = context
    ? `\n${predictivePromptContext}\n`
    : "";
  const sessionMemoryBlock = buildSessionMemoryPromptBlock({
    hcpPersona: sessionState?.hcpPersona || predictiveProfile,
    temperature: sessionState?.temperature ?? runtimeTemperature,
    previousInteraction: sessionState?.previousInteraction || repMessage,
    previousConcernFamily: sessionState?.previousConcernFamily || prediction?.concernFamily || "",
    escalationLevel: Number(sessionState?.escalationLevel || 0),
    interactionHistory: sessionState?.interactionHistory || [],
  });

  const temperatureBehaviorBlock = `
HCP conversational mode: ${conversationMode}

Behavior rules:
- collaborative: open, exploratory, curious
- guarded: neutral, selective, requires proof
- resistant: skeptical, challenging, dismissive

Mode constraints:
- collaborative: must include an openness phrase and an exploratory question; do not challenge aggressively
- guarded: must include a skeptical phrase and a proof-oriented clarifying question
- resistant: must include a pushback phrase and a challenge question; do not ask exploratory open-ended questions

Respond STRICTLY according to this mode.
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

${predictiveContextBlock}

${sessionMemoryBlock}

${dialogueDirectiveBlock}

${buildTurnDirectivePrompt(turnDirectives)}

${volatilityBlock}

${continuityBlock}

${temperatureBehaviorBlock}

GLOBAL TONE/SAMPLING MAP (deterministic controls):
- Response temperature target: ${mappedControls.responseTemperature}
- Rewrite temperature target: ${mappedControls.rewriteTemperature}
- Engagement directive: ${mappedControls.engagementDirective}
${mappedControls.rationale.map((line) => `- ${line}`).join("\n")}

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
31. Use grammatically clean written English with realistic spoken cadence; avoid run-on chains joined by repeated commas.
32. Prefer short sentence boundaries over semicolons unless the sentence truly requires one.
33. Avoid overly formal phrasing; keep wording natural, clinician-realistic, and concise.
34. Do not lead with meta-framing such as "So I want to make sure..."; start with the actual clinical point or concern.
35. On the very first HCP reply, do not repeat the Opening HCP Setup line verbatim; acknowledge the rep's latest message and move to one concrete blocker or ask.
36. Follow the GLOBAL TONE/SAMPLING MAP above exactly; engagement posture must match the mapped engagement directive.
37. Do not repeat the same urgency directive across consecutive HCP turns (for example repeating "get to the point" or "short version"). Keep pressure real, but vary wording naturally.

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

  const result = await invokeWorkerJson({
    prompt,
    max_tokens: finalResponseTokenBudget,
    temperature: mappedControls.responseTemperature,
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

  const adjustedState = applyTemperatureStateAdjustments({
    currentBehaviorState,
    currentJourneyState,
    nextBehaviorState: result.nextBehaviorState || currentBehaviorState,
    nextJourneyState: result.nextJourneyState || currentJourneyState,
    tempProfile,
  });
  result.nextBehaviorState = adjustedState.nextBehaviorState;
  result.nextJourneyState = adjustedState.nextJourneyState;

  let hcpReply = result.hcpReply || "";
  if (needsNaturalnessRewrite(hcpReply)) {
    try {
      hcpReply = await rewriteForSpokenNaturalness({
        hcpReply,
        scenario,
        behaviorState: result.nextBehaviorState || currentBehaviorState,
        prediction,
        rewriteTemperature: mappedControls.rewriteTemperature,
      });
    } catch {
      // Fall back to the original line if the refinement call fails.
    }
  }
  if (needsSpokenStyleRewrite({ hcpReply, scenario })) {
    try {
      hcpReply = await rewriteForSpokenStyle({
        hcpReply,
        scenario,
        behaviorState: result.nextBehaviorState || currentBehaviorState,
        rewriteTemperature: mappedControls.rewriteTemperature,
      });
    } catch {
      // Fall back to the original line if the refinement call fails.
    }
  }
  if (needsContextConsistencyRewrite({
    hcpReply,
    scenario,
    behaviorState: result.nextBehaviorState || currentBehaviorState,
  })) {
    try {
      hcpReply = await rewriteForContextConsistency({
        hcpReply,
        scenario,
        behaviorState: result.nextBehaviorState || currentBehaviorState,
        currentJourneyState: result.nextJourneyState || currentJourneyState,
        prediction,
        rewriteTemperature: mappedControls.rewriteTemperature,
      });
    } catch {
      // Fall back to the original line if the refinement call fails.
    }
  }
  hcpReply = applyTemperatureResponseStyle({ hcpReply, tempProfile, scenario });
  hcpReply = applyEscalationContinuityStyle({
    hcpReply,
    tempProfile,
    sessionState,
  });
  let continuityAdjusted = false;

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
        rewriteTemperature: mappedControls.rewriteTemperature,
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
  const recentHcpReplies = transcript
    .filter((turn: any) => turn?.speaker === "hcp" && turn?.text)
    .map((turn: any) => String(turn.text))
    .slice(-4);

  hcpReply = applyHcpResponseSurface({
    hcpReply,
    scenario,
    turn: turnDirectives,
    profile: runtimeProfile,
    hcpTurnCount,
    recentHcpReplies,
  });
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
        rewriteTemperature: mappedControls.rewriteTemperature,
      });
      continuityAdjusted = true;
      hcpReply = applyHcpResponseSurface({
        hcpReply,
        scenario,
        turn: turnDirectives,
        profile: runtimeProfile,
        hcpTurnCount,
        recentHcpReplies,
      });
    } catch {
      continuityAdjusted = true;
      hcpReply = applyHcpResponseSurface({
        hcpReply: deterministicContinuityVariation({
          hcpReply,
          transcript,
          scenario,
        }),
        scenario,
        turn: turnDirectives,
        profile: runtimeProfile,
        hcpTurnCount,
        recentHcpReplies,
      });
    }
  }

  hcpReply = normalizeHcpSpokenText(hcpReply, 3);

  const openingSetup = String(scenario.openingScene || "");
  if (isOpeningEcho({
    hcpReply,
    openingScene: openingSetup,
    hcpTurnCount,
  })) {
    try {
      const rewritten = await rewriteFirstTurnAwayFromOpeningEcho({
        hcpReply,
        openingScene: openingSetup,
        repMessage,
        scenario,
        predictivePromptContext,
        predictedBehaviorState: result.nextBehaviorState || currentBehaviorState,
        rewriteTemperature: mappedControls.rewriteTemperature,
      });
      hcpReply = normalizeHcpSpokenText(rewritten, 3);
    } catch {
      hcpReply = buildDeterministicFirstTurnFallback({
        repMessage,
        scenario,
        predictedBehaviorState: result.nextBehaviorState || currentBehaviorState,
      });
    }
  }

  hcpReply = ensureFirstTurnRepTopicAcknowledgment({
    hcpReply,
    repMessage,
    scenario,
    hcpTurnCount,
  });

  if (needsHumanPhraseSafetyRewrite({
    hcpReply,
    hcpTurnCount,
  })) {
    hcpReply = buildHumanPhraseSafetyFallback({
      repMessage,
      scenario,
      hcpTurnCount,
    });
  }

  hcpReply = enforceHighPressureClippedPhrasing({
    hcpReply,
    repMessage,
    scenario,
    behaviorState: result.nextBehaviorState || currentBehaviorState,
  });

  const scenarioRouting = buildScenarioRouting(scenario);
  hcpReply = await enforceHCPResponse({
    draft_response: hcpReply,
    scenario_routing: scenarioRouting,
    hcp_state: result.nextBehaviorState || currentBehaviorState,
    hcp_brain: prediction,
    rep_message: repMessage,
    temperature: runtimeTemperature,
    tempProfile,
    scenario,
  });

  const anchored = addPersonaSpecificAnchor({
    draft_hcp_response: hcpReply,
    scenario_routing: scenarioRouting,
  });
  hcpReply = anchored.text;
  hcpReply = scrubStaleFallbackPhrases(hcpReply, scenarioRouting);

  const recentCueLabels = transcript
    .filter((turn: any) => turn?.speaker === "hcp")
    .flatMap((turn: any) => Array.isArray(turn?.cues) ? turn.cues : [])
    .map((cue: any) => cue?.label)
    .filter(Boolean)
    .slice(-8);
  const cue = resolveObservedCue(result.hcpCue || "", {
    hcpReply,
    behaviorState: result.nextBehaviorState || currentBehaviorState,
    hcpTurnCount,
    interactionPressures: scenario.interactionPressure || [],
    recentCueLabels,
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

  return {
    hcpReply,
    nextBehaviorState: result.nextBehaviorState || currentBehaviorState,
    nextJourneyState: result.nextJourneyState || currentJourneyState,
    activeCues,
    behaviorSignals: normalizeBehaviorSignals(
      result.behaviorSignals || {},
      repMessage,
      transcript,
      scenario,
      hcpReply,
    ),
    coachingNudge: result.coachingNudge || null,
    volatilityState: volatility,
    prediction,
    predictiveDebug: buildPredictiveTurnDebug({
      predictivePromptContext,
      hcpReply,
      nextBehaviorState: result.nextBehaviorState || currentBehaviorState,
    }),
  };
}
