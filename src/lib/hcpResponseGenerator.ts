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

export async function generateHcpResponse(
  scenario: any,
  transcript: ConversationTurn[],
  currentBehaviorState: string,
  currentJourneyState: string,
  coachingEnabled: boolean,
  repMessage: string,
  allPriorSignals: BehaviorSignals[] = [],
  turnCount: number = 0,
  previousVolatilityProfile: VolatilityProfile = "stable"
): Promise<SimulatorResponse> {
  const transcriptText = transcript
    .map(t => `${t.speaker.toUpperCase()}: ${t.text}`)
    .join("\n");

  const focusCaps = (scenario.suggestedFocusCapabilities || []).join(", ");

  const windowSignals = allPriorSignals.length > 0 ? allPriorSignals : [];
  const prediction = predictHcpBehavior(windowSignals, windowSignals, scenario);
  const volatility = computeVolatility(scenario, windowSignals, turnCount, previousVolatilityProfile);
  const interactionPressures = scenario.interactionPressure || [];
  const isHighPressureTurn =
    interactionPressures.includes("time_constrained") ||
    interactionPressures.includes("operationally_constrained") ||
    interactionPressures.includes("skeptical_resistant") ||
    interactionPressures.includes("safety_concern") ||
    ["closed", "resistance", "frustration", "time_pressure"].includes(currentBehaviorState) ||
    volatility.profile !== "stable";
  const responseTokenBudget = isHighPressureTurn ? 420 : 560;

  const predictionBlock = `
CAPABILITY-DRIVEN BEHAVIOR PREDICTION (PRIMARY — follow this, do not contradict it):
Predicted HCP State: ${prediction.predictedBehaviorState}
Predicted Resistance: ${prediction.predictedResistanceLevel}
Predicted Engagement Pattern: ${prediction.predictedEngagementPattern}
${prediction.predictedDrivers.length ? `Predicted Drivers:\n${prediction.predictedDrivers.map(d => `  - ${d}`).join("\n")}` : ""}
${prediction.predictedObjections.length ? `Predicted Objection Themes:\n${prediction.predictedObjections.map(o => `  - ${o}`).join("\n")}` : ""}
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

${volatilityBlock}

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
16. If pressure is high, target under 30 spoken words
17. If pressure is moderate or low, target under 45 spoken words

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
    max_tokens: responseTokenBudget,
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
  const cue = resolveObservedCue(result.hcpCue || "", {
    hcpReply,
    behaviorState: result.nextBehaviorState || currentBehaviorState,
    interactionPressures: scenario.interactionPressure || [],
    scenario: { title: scenario.title, journeyStage: scenario.journeyStage },
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
    behaviorSignals: result.behaviorSignals || {},
    coachingNudge: result.coachingNudge || null,
    volatilityState: volatility
  };
}
