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

function startsWithSameFrame(a = "", b = ""): boolean {
  const aHead = meaningfulContinuityTokens(a).slice(0, 4).join(" ");
  const bHead = meaningfulContinuityTokens(b).slice(0, 4).join(" ");
  return Boolean(aHead && bHead && aHead === bHead);
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
  if (/cost|spend|readmissions|hospitalizations|metrics|outcomes|value/.test(normalized)) tags.push("cost_value");
  if (/prior auth|prior authorization|coverage|copay|formulary|payer|benefits|approval/.test(normalized)) tags.push("access");
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

function inferResponseAlignment(repMessage: string, latestConcern: string): BehaviorSignals["response_alignment"] {
  if (repAddressesPremiseChallenge(repMessage, latestConcern)) {
    return "strong";
  }
  const repTags = inferConcernTags(repMessage);
  const concernTags = inferConcernTags(latestConcern);
  const shared = concernTags.filter((tag) => repTags.includes(tag));
  if (shared.length >= 1) {
    return "strong";
  }
  if (/you'?re saying|you'?re right|when you say|what would you need to see|which patient type|where does .* decision|what outcome carries/i.test(repMessage)) {
    return "partial";
  }
  return "weak";
}

function inferListeningPattern(repMessage: string, latestConcern: string): BehaviorSignals["listening_pattern"] {
  const alignment = inferResponseAlignment(repMessage, latestConcern);
  if (alignment === "strong") return "responsive";
  if (alignment === "partial") return "partially_responsive";
  return "missed";
}

function isHesitationToCommitmentScenario(scenario: any, latestConcern: string): boolean {
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

function inferObjectionType(latestConcern: string, scenario?: any): BehaviorSignals["objection_type"] {
  if (isHesitationToCommitmentScenario(scenario, latestConcern)) return "none";
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
  const latestConcern = getLatestHcpConcern(transcript, scenario);
  const premiseCorrected = repAddressesRecentPremiseChallenge(repMessage, transcript);
  const inferredQuestionType = detectQuestionType(repMessage);
  const inferredAlignment = inferResponseAlignment(repMessage, latestConcern);
  const inferredListening = inferListeningPattern(repMessage, latestConcern);
  const inferredObjectionType = inferObjectionType(latestConcern, scenario);
  const inferredEngagement = inferEngagementLevel(hcpReply);
  const inferredCommitmentAttempt = inferCommitmentAttempt(repMessage, transcript, scenario);
  const genericPitch = isGenericProductPitch(repMessage);
  const talkedPastConcern = ignoredDirectConcern(repMessage, latestConcern);
  const forceWeakAlignment = !premiseCorrected && (genericPitch || talkedPastConcern);
  const forceRepDominant = genericPitch;
  const forceHesitationFamily = isHesitationToCommitmentScenario(scenario, latestConcern);

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
      : rawSignals?.response_alignment === "strong"
        ? "strong"
        : inferredAlignment,
    objection_type: forceHesitationFamily
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
): Promise<SimulatorResponse> {
  const transcriptText = transcript
    .map(t => `${t.speaker.toUpperCase()}: ${t.text}`)
    .join("\n");

  const focusCaps = (scenario.suggestedFocusCapabilities || []).join(", ");

  const windowSignals = allPriorSignals.length > 0 ? allPriorSignals : [];
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

  const predictionBlock = `
CAPABILITY-DRIVEN BEHAVIOR PREDICTION (PRIMARY — follow this, do not contradict it):
Predicted HCP State: ${prediction.predictedBehaviorState}
Predicted Resistance: ${prediction.predictedResistanceLevel}
Predicted Engagement Pattern: ${prediction.predictedEngagementPattern}
${prediction.predictedDrivers.length ? `Predicted Drivers:\n${prediction.predictedDrivers.map(d => `  - ${d}`).join("\n")}` : ""}
${prediction.predictedObjections.length ? `Predicted Objection Themes:\n${prediction.predictedObjections.map(o => `  - ${o}`).join("\n")}` : ""}
`;

  const runtimeProfileBlock = `
${buildRuntimeProfilePrompt(runtimeProfile)}
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

${dialogueDirectiveBlock}

${buildTurnDirectivePrompt(turnDirectives)}

${volatilityBlock}

${continuityBlock}

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
    temperature: 0.2,
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

  let hcpReply = result.hcpReply || "";
  if (needsNaturalnessRewrite(hcpReply)) {
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
  }
  if (needsSpokenStyleRewrite({ hcpReply, scenario })) {
    try {
      hcpReply = await rewriteForSpokenStyle({
        hcpReply,
        scenario,
        behaviorState: result.nextBehaviorState || currentBehaviorState,
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
      });
    } catch {
      // Fall back to the original line if the refinement call fails.
    }
  }
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
  hcpReply = applyHcpResponseSurface({
    hcpReply,
    scenario,
    turn: turnDirectives,
    profile: runtimeProfile,
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
      });
      continuityAdjusted = true;
      hcpReply = applyHcpResponseSurface({
        hcpReply,
        scenario,
        turn: turnDirectives,
        profile: runtimeProfile,
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
      });
    }
  }

  const recentCueLabels = transcript
    .filter((turn: any) => turn?.speaker === "hcp")
    .flatMap((turn: any) => Array.isArray(turn?.cues) ? turn.cues : [])
    .map((cue: any) => cue?.label)
    .filter(Boolean)
    .slice(-8);
  const cue = resolveObservedCue(result.hcpCue || "", {
    hcpReply,
    behaviorState: result.nextBehaviorState || currentBehaviorState,
    interactionPressures: scenario.interactionPressure || [],
    recentCueLabels,
    scenario: {
      id: scenario.id,
      title: scenario.title,
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
    volatilityState: volatility
  };
}
