/**
 * Session Review Generator
 * =========================
 * Full forensic coaching debrief — restored from simulatorEngine.ts original.
 * Uses the worker's configured review-capable model. Do not simplify the prompt.
 */

import { invokeWorkerJson } from "@/services/workerClient";
import {
  BehaviorSignals,
  SessionReview,
  VolatilityEvent,
  ConversationTurn,
} from "./simulatorEngine";
import { runCapabilityEvaluationEngine } from "./capabilityEvaluation";
import { predictHcpBehavior } from "./hcpBehaviorPrediction";
import { SIGNAL_INTELLIGENCE_CAPABILITIES } from "./signalIntelligence";
import { getScenarioCapabilityProfile } from "./scenarioFamilyRegistry";

// Compact capability reference with full definition slice
const capabilityCompactRef = SIGNAL_INTELLIGENCE_CAPABILITIES.map(c =>
  `[${c.id}] ${c.metric} — ${c.definition.slice(0, 120)}`
).join("\n");

// Deterministic capability rules injected into prompt
const CAPABILITY_RULES = `
CAPABILITY EVALUATION RULES (deterministic — apply strictly using canonical metric names):

1. question_quality — Metric: Question Quality (Signal Awareness)
   Measured by: Contextual Relevance + Forward Value
   effective: questions reflect current HCP context and move conversation toward decision/clarification/next step
   developing: questions have some value but are generic, closed, or not fully targeted to HCP's stated context
   missed: questions are absent, leading, redundant, or fail to advance understanding in any direction

2. listening_responsiveness — Metric: Listening & Responsiveness (Signal Interpretation)
   Measured by: Accuracy of Interpretation + Responsiveness of Action
   effective: rep correctly interprets what HCP communicated AND responds in a way that clearly reflects that understanding
   developing: interpretation is partial or response is only loosely aligned with what HCP actually said
   missed: rep misinterprets, ignores, or talks past HCP's actual input — response does not reflect what was communicated

3. customer_engagement_signals — Metric: Customer Engagement Cues (Customer Engagement Monitoring)
   Measured by: Customer Verbal Participation Ratio + Responsiveness to Customer Cues + Momentum Continuity + Customer Signal Amplification
   effective: rep notices shifts in HCP participation and conversational momentum and adjusts accordingly
   developing: rep partially notices engagement shifts but does not consistently adjust
   missed: rep continues without adjustment despite observable changes in HCP participation or momentum

4. making_it_matter — Metric: Value Framing (Value Connection)
   Measured by: Customer Relevance Alignment + Outcome Translation
   effective: rep connects information to HCP's stated priorities AND translates into clear customer outcomes
   developing: rep attempts relevance but stays abstract or incomplete — does not clearly articulate outcome implication
   missed: rep stays generic, product-led, or disconnected from HCP's real-world context — no explicit relevance established

5. objection_navigation — Metric: Objection Handling (Objection Navigation)
   Measured by: Non-Defensive Response + Constructive Engagement
   effective: rep maintains composure AND explores objection before responding — sustaining productive dialogue
   developing: rep acknowledges objection but moves too quickly to justification or resolution
   missed: rep becomes defensive, dismissive, or fails to engage the underlying concern constructively

6. conversation_control_structure — Metric: Conversation Control & Structure (Conversation Management)
   Measured by: Directional Clarity + Adaptive Steering
   effective: rep provides clear directional intent and adjusts structure appropriately as conversation evolves
   developing: structure exists but is inconsistent, uneven, or insufficiently adaptive to new input
   missed: conversation drifts without recovery, becomes rep-dominated, or loses coherent purpose

7. adaptability — Metric: Adaptability (Adaptive Response)
   Measured by: Situational Responsiveness + Approach Adjustment Quality
   effective: rep recognizes changes in interaction AND makes timely, appropriate adjustments to approach
   developing: some adjustment occurs but is either insufficiently responsive or not well-calibrated to situation
   missed: rep repeats same approach despite observable changes in conditions, constraints, or HCP direction

8. commitment_gaining — Metric: Commitment Gaining (Commitment Generation)
   Measured by: Next-Step Clarity + Customer Ownership
   effective: rep establishes specific, concrete next action that HCP voluntarily owns
   developing: rep hints at or suggests next steps but does not clearly secure customer ownership
   missed: no meaningful next-step attempt — conversation ends without clarity or customer commitment
`;

const DEFAULT_OVERALL_GUIDANCE = "This analysis is based on observable behaviors during the interaction and is intended to support development, not scoring.";

function asNonEmptyString(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function asStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function normalizeCapabilityInsights(
  rawInsights: any[],
  deterministicAssessment: Record<string, string>
) {
  const rawById = new Map(
    (Array.isArray(rawInsights) ? rawInsights : [])
      .filter((item) => item?.capabilityId)
      .map((item) => [item.capabilityId, item])
  );

  return SIGNAL_INTELLIGENCE_CAPABILITIES.map((capability) => {
    const raw = rawById.get(capability.id) || {};
    return {
      capabilityId: capability.id,
      capabilityName: capability.metric,
      observationLevel: deterministicAssessment[capability.id] || raw.observationLevel || "developing",
      whatHappened: asNonEmptyString(raw.whatHappened),
      transcriptEvidence: asNonEmptyString(raw.transcriptEvidence),
      whyItMattered: asNonEmptyString(raw.whyItMattered),
      pattern: asNonEmptyString(raw.pattern),
      whatGoodLooksLike: asNonEmptyString(raw.whatGoodLooksLike),
      exampleRewrite: asNonEmptyString(raw.exampleRewrite),
      nextTimeAction: asNonEmptyString(raw.nextTimeAction),
      relatedTurnIds: asStringArray(raw.relatedTurnIds, []),
    };
  });
}

function normalizeGuidanceItems(rawItems: any[], normalizedInsights: any[], targetLevel: string) {
  const insightById = new Map(normalizedInsights.map((item) => [item.capabilityId, item]));
  const items = Array.isArray(rawItems) ? rawItems : [];

  return items
    .filter((item) => item?.capabilityId)
    .map((item) => {
      const insight = insightById.get(item.capabilityId) || {};
      return {
        capabilityId: item.capabilityId,
        capabilityName: insight.capabilityName || item.capabilityName || item.capabilityId,
        observationLevel: targetLevel,
        title: asNonEmptyString(item.title, insight.capabilityName || item.capabilityId),
        guidance: asNonEmptyString(item.guidance, insight.nextTimeAction || insight.whyItMattered),
        relatedTurnIds: asStringArray(item.relatedTurnIds, insight.relatedTurnIds || []),
        exampleRewrite: asNonEmptyString(item.exampleRewrite, insight.exampleRewrite || ""),
      };
    });
}

function normalizeSessionReviewShape(
  result: any,
  deterministicAssessment: Record<string, string>,
  volatilityEvents: VolatilityEvent[]
): SessionReview {
  const normalizedInsights = normalizeCapabilityInsights(result?.capabilityInsights || [], deterministicAssessment);

  return {
    briefRationale: asNonEmptyString(result?.briefRationale),
    didWell: asNonEmptyString(result?.didWell),
    biggestGap: asNonEmptyString(result?.biggestGap),
    nextAdjustment: asNonEmptyString(result?.nextAdjustment),
    capabilityInsights: normalizedInsights,
    volatilityEvents,
    signalResponseAlignment: asStringArray(result?.signalResponseAlignment),
    overallSummary: asStringArray(result?.overallSummary),
    strengthsProse: asStringArray(result?.strengthsProse),
    developProse: asStringArray(result?.developProse),
    actionPlanProse: asStringArray(result?.actionPlanProse),
    strengths: normalizeGuidanceItems(result?.strengths || [], normalizedInsights, "effective"),
    improvementAreas: normalizeGuidanceItems(result?.improvementAreas || [], normalizedInsights, "developing"),
    missedOpportunities: normalizeGuidanceItems(result?.missedOpportunities || [], normalizedInsights, "missed"),
    suggestedReframes: normalizeGuidanceItems(result?.suggestedReframes || [], normalizedInsights, "developing"),
    overallGuidance: asStringArray(result?.overallGuidance, [DEFAULT_OVERALL_GUIDANCE]).length
      ? asStringArray(result?.overallGuidance, [DEFAULT_OVERALL_GUIDANCE])
      : [DEFAULT_OVERALL_GUIDANCE],
  };
}

export function buildDeterministicSessionReview(
  deterministicAssessment: Record<string, string>,
  volatilityEvents: VolatilityEvent[] = []
): SessionReview {
  const normalizedInsights = normalizeCapabilityInsights([], deterministicAssessment);
  const missed = normalizedInsights.filter((item) => item.observationLevel === "missed").map((item) => item.capabilityName);
  const developing = normalizedInsights.filter((item) => item.observationLevel === "developing").map((item) => item.capabilityName);
  const effective = normalizedInsights.filter((item) => item.observationLevel === "effective").map((item) => item.capabilityName);

  const briefRationale = missed.length > 0
    ? `Deterministic QA review: missed capability signals detected in ${missed.join(", ")}. ${effective.length > 0 ? `Effective signals observed in ${effective.join(", ")}.` : "No capabilities reached the effective band in this run."}`
    : `Deterministic QA review: no missed capability signals detected. ${effective.length > 0 ? `Effective signals observed in ${effective.join(", ")}.` : "Capabilities remained in the developing band."}`;

  const didWell = effective.length > 0
    ? `The strongest observable capabilities in this run were ${effective.join(", ")}.`
    : "No capability reached the effective band in this run.";

  const biggestGap = missed.length > 0
    ? `The largest observable gaps were in ${missed.join(", ")}.`
    : developing.length > 0
      ? `The remaining work is concentrated in ${developing.join(", ")}.`
      : "No major observable gap was detected in this run.";

  const nextAdjustment = missed.length > 0
    ? `Tighten the next pass around ${missed[0]} before widening validation again.`
    : developing.length > 0
      ? `Move the strongest developing capability, ${developing[0]}, into the effective band on the next pass.`
      : "Hold the current behavior pattern and widen validation coverage.";

  return {
    briefRationale,
    didWell,
    biggestGap,
    nextAdjustment,
    capabilityInsights: normalizedInsights,
    volatilityEvents,
    signalResponseAlignment: [briefRationale],
    overallSummary: [briefRationale],
    strengthsProse: effective.length > 0 ? [didWell] : [],
    developProse: developing.length > 0 ? [`Capabilities still developing: ${developing.join(", ")}.`] : [],
    actionPlanProse: [nextAdjustment],
    strengths: normalizeGuidanceItems(
      normalizedInsights.filter((item) => item.observationLevel === "effective").map((item) => ({
        capabilityId: item.capabilityId,
        title: item.capabilityName,
        guidance: `Repeat the observable behavior pattern that lifted ${item.capabilityName} into the effective band.`,
        relatedTurnIds: [],
        exampleRewrite: "",
      })),
      normalizedInsights,
      "effective",
    ),
    improvementAreas: normalizeGuidanceItems(
      normalizedInsights.filter((item) => item.observationLevel === "developing").map((item) => ({
        capabilityId: item.capabilityId,
        title: item.capabilityName,
        guidance: `Tighten the response pattern in ${item.capabilityName} so it becomes more specific and more adaptive to the HCP's exact concern.`,
        relatedTurnIds: [],
        exampleRewrite: "",
      })),
      normalizedInsights,
      "developing",
    ),
    missedOpportunities: normalizeGuidanceItems(
      normalizedInsights.filter((item) => item.observationLevel === "missed").map((item) => ({
        capabilityId: item.capabilityId,
        title: item.capabilityName,
        guidance: `Address ${item.capabilityName} directly in the next iteration instead of broadening the exchange.`,
        relatedTurnIds: [],
        exampleRewrite: "",
      })),
      normalizedInsights,
      "missed",
    ),
    suggestedReframes: normalizeGuidanceItems(
      normalizedInsights.filter((item) => item.observationLevel !== "effective").map((item) => ({
        capabilityId: item.capabilityId,
        title: item.capabilityName,
        guidance: `Respond to the exact HCP concern first, then add only one narrower next-step or clarifier for ${item.capabilityName}.`,
        relatedTurnIds: [],
        exampleRewrite: "",
      })),
      normalizedInsights,
      "developing",
    ),
    overallGuidance: [DEFAULT_OVERALL_GUIDANCE],
  };
}

export async function generateSessionReview(
  scenario: any,
  transcript: ConversationTurn[],
  allSignals: BehaviorSignals[],
  stateHistory: { turn: number; score: number; openness: string }[] = [],
  volatilityEvents: VolatilityEvent[] = []
): Promise<SessionReview> {
  const repTurns = transcript.filter(t => t.speaker === "rep");
  const hcpTurns = transcript.filter(t => t.speaker === "hcp");

  if (repTurns.length === 0) {
    return {
      briefRationale: "No rep turns were recorded in this session.",
      didWell: "",
      biggestGap: "The session ended before the rep spoke.",
      nextAdjustment: "Open with a question that references the HCP's specific context.",
      capabilityInsights: [],
      volatilityEvents: [],
      signalResponseAlignment: ["No rep turns to analyze."],
      overallSummary: ["No rep turns were recorded."],
      strengthsProse: [],
      developProse: [],
      actionPlanProse: [],
      strengths: [],
      improvementAreas: [],
      missedOpportunities: [],
      suggestedReframes: [],
      overallGuidance: [DEFAULT_OVERALL_GUIDANCE]
    };
  }

  const transcriptText = transcript
    .map((t) => `[${t.id}] ${t.speaker.toUpperCase()}: ${t.text}`)
    .join("\n");

  const signalsSummary = allSignals.map((s, i) => `Rep Turn ${i + 1}: ${JSON.stringify(s)}`).join("\n");

  // Deterministic pre-evaluation — LLM MUST NOT contradict these
  const deterministicAssessment = runCapabilityEvaluationEngine(
    allSignals,
    scenario.suggestedFocusCapabilities,
    scenario,
  );
  const assessmentSummary = Object.entries(deterministicAssessment)
    .map(([id, level]) => `${id}: ${level}`)
    .join("\n");

  // Final prediction for Signal-Response Alignment
  const finalPrediction = predictHcpBehavior(allSignals, allSignals, scenario);
  const signalResponseAlignmentBlock = finalPrediction.capabilityDrivers
    .map(d => `[${d.capability}] (${d.assessment}): ${d.influence}`)
    .join("\n");

  const focusCaps = (scenario.suggestedFocusCapabilities || []);
  const focusCapsFormatted = focusCaps.length
    ? `Focus capabilities for this scenario (surface these FIRST, give deeper narrative): ${focusCaps.join(", ")}`
    : "No specific focus capabilities — evaluate all 8 with equal depth.";
  const capabilityProfile = getScenarioCapabilityProfile(scenario);
  const capabilityProfileBlock = capabilityProfile
    ? `SCENARIO CAPABILITY PROFILE:
- Primary capabilities: ${capabilityProfile.primary.join(", ")}
- Secondary capabilities: ${capabilityProfile.secondary.join(", ")}
- Non-blocking capabilities: ${capabilityProfile.nonBlocking.join(", ")}
- Important: non-blocking capabilities should not be framed as the dominant success or failure story unless the transcript makes them clearly decisive.`
    : "No scenario-specific capability profile provided.";

  const volatilityLog = volatilityEvents.length > 0
    ? volatilityEvents.map(e =>
        `Turn ID ${e.turnId}: ${e.volatilityLevel} — trigger signal: ${e.triggerSignal} — HCP reaction type: ${e.hcpReactionType}`
      ).join("\n")
    : "No volatility events logged — interaction remained stable throughout.";

  const stateTrajectoryBlock = stateHistory.length > 0
    ? stateHistory.map(s => `Turn ${s.turn}: score=${s.score} (${s.openness})`).join(" → ")
    : "State history unavailable — use capability patterns below.";

  const stateTransitions = stateHistory.length > 1 ? (() => {
    const transitions: string[] = [];
    for (let i = 1; i < stateHistory.length; i++) {
      const prev = stateHistory[i - 1];
      const curr = stateHistory[i];
      if (prev.openness !== curr.openness) {
        transitions.push(`Turn ${prev.turn}→${curr.turn}: ${prev.openness} → ${curr.openness}`);
      }
    }
    return transitions.length ? transitions.join(", ") : "No categorical state transitions — stable trajectory throughout.";
  })() : "Not enough data.";

  const prompt = `You are generating a rigorous, structured coaching debrief for a Signal Intelligence pharma rep training simulator.

Write like a real manager giving a high-quality coaching session — specific, behavior-grounded, causally consistent. Every observation must reference what actually happened in this conversation. Zero generic feedback.

=== SIGNAL INTELLIGENCE CAPABILITIES (8 metrics — use canonical IDs/names exactly) ===
${capabilityCompactRef}

Observation levels: effective = behavior clearly demonstrated | developing = partially present | missed = absent or counterproductive

=== SCENARIO ===
Title: ${scenario.title}
Objective: ${scenario.objective}
Core Tension: ${scenario.coreTension || "not specified"}
Persona: ${scenario.persona}
Journey Stage: ${scenario.journeyStage}
Journey State: ${scenario.journeyStage}
Starting Behavior: ${scenario.startingBehaviorState}
Pressures: ${(scenario.interactionPressure || []).join(", ") || "none"}
Key Challenges: ${(scenario.keyChallenges || []).join(", ")}
${focusCapsFormatted}

${capabilityProfileBlock}

=== DETERMINISTIC CAPABILITY PRE-ASSESSMENT (DO NOT CONTRADICT) ===
${assessmentSummary}

=== DETERMINISTIC HCP STATE TRAJECTORY ===
${stateTrajectoryBlock}
State transitions: ${stateTransitions}

=== CAPABILITY-DRIVEN HCP BEHAVIOR PATTERNS ===
These are confirmed causal links — how rep capability patterns drove specific HCP behavior.
Use these as evidence anchors for Section 4 (Signal-Response Alignment):
${signalResponseAlignmentBlock}
Predicted final HCP state: ${finalPrediction.predictedBehaviorState} (resistance: ${finalPrediction.predictedResistanceLevel})
Predicted engagement pattern: ${finalPrediction.predictedEngagementPattern}
${finalPrediction.predictedDrivers.length ? `Observed behavioral drivers:\n${finalPrediction.predictedDrivers.map(d => `  - ${d}`).join("\n")}` : ""}

=== FULL TRANSCRIPT (${repTurns.length} rep turns, ${hcpTurns.length} HCP turns) ===
${transcriptText}

=== OBSERVED BEHAVIOR SIGNALS PER REP TURN ===
${signalsSummary}

${CAPABILITY_RULES}

=== FORENSIC FEEDBACK CONTRACT ===

You MUST produce ALL of the following. Do not omit any field. Do not summarize generically.

─── BLOCK A: BRIEF RATIONALE ───
Field: briefRationale (single string)

This is a BEHAVIORAL DIAGNOSIS, not a summary. It must identify what mechanistically drove this interaction.
Must answer ALL THREE of:
  1. What dominant behavioral PATTERN drove this interaction? (not "the rep did well at X" — name the pattern)
  2. Why did the HCP react the way they did? (explicit cause → HCP reaction, not description of what happened)
  3. What was the decisive behavioral breakdown or inflection point that changed the arc?

REQUIRED format: "The dominant pattern in this interaction was [behavioral pattern]. This drove [HCP reaction] because [causal mechanism]. The decisive [breakdown/inflection] occurred when [specific moment with transcript reference]."

REJECT if it reads like a summary. MUST name at least one inter-capability dependency.

─── BLOCK B: WHAT THE REP DID WELL ───
Field: didWell (single string, 3-5 sentences)

Cross-capability synthesis. For each effective capability:
- Name the behavior performed (not the capability label)
- Cite a specific transcript moment or quote
- State the HCP reaction it produced
- Show the DOWNSTREAM EFFECT on conversation flow
Format: "[Behavior observed]. This caused the HCP to [specific reaction]. Because [causal link], this [downstream effect on conversation arc]."

REJECT if it praises without citing a specific exchange.

─── BLOCK C: BIGGEST CROSS-CAPABILITY GAP ───
Field: biggestGap (single string, 3-4 sentences)

This must be a CAUSAL CHAIN, not a list of weaknesses.
Required structure:
  [Primary capability failure] → [Secondary capability impacted] → [HCP behavioral consequence] → [Conversation outcome]

The chain MUST:
  - Name at least two capabilities explicitly by their canonical metric name
  - Reference a specific HCP behavior or quote as the consequence
  - Describe the cumulative outcome (stall, resistance escalation, topic deflection, etc.)

REJECT if it lists weaknesses without connecting them causally.

─── BLOCK D: ONE CONCRETE NEXT ADJUSTMENT ───
Field: nextAdjustment (single string, 3-4 sentences)

Single highest-leverage improvement with:
- The situation trigger (when does this apply)
- The behavior change (what to do instead)
- A quoted natural example phrase
- The expected HCP impact
Format: "When [situation trigger], rather than [what happened], pivot to [behavior change]. For example: '[exact quoted phrase].' This would have [HCP impact]."

─── CAPABILITY DEEP INSIGHTS (ALL 8) ───
Field: capabilityInsights[] — one object per capability, ALL 8 required

For EACH capability (effective, developing, OR missed — include all 8):

capabilityId: canonical ID
capabilityName: canonical metric name
observationLevel: must match deterministic pre-assessment above — DO NOT CONTRADICT

whatHappened: 2-3 sentences. Specific observable behaviors from this transcript.
Must include what the rep did OR did not do. Reference the actual exchange.
Example: "The rep did not ask any follow-up question after the HCP stated [paraphrase]. Instead, the rep continued presenting [general topic]."

transcriptEvidence: DIRECT QUOTE or precise paraphrase from the transcript.
This must be traceable to a specific turn. Use the most impactful instance.
Example: "I need to understand how this impacts workflow" / Rep: "Our data shows a 40% reduction…"

whyItMattered: 2-3 sentences. Explicit cause → HCP reaction chain.
"Because [X], the HCP [reaction]. This [cumulative consequence]."

pattern: 1-2 sentences. Was this behavior repeated across turns?
"This pattern appeared in turns [N] and [N+1], where the rep defaulted to [behavior] each time the HCP [signal]."
If not repeated: "This was an isolated moment."

whatGoodLooksLike: 2-3 sentences describing the behavior replacement — specific to THIS HCP's persona (${scenario.persona}) and pressures (${(scenario.interactionPressure || []).join(", ") || "none"}).
NOT abstract best practice. NOT applicable to any other scenario unchanged.

exampleRewrite: A natural, quoted phrase the rep could have said. Must sound like a real person talking, not a training script.
Example: "Can you walk me through where prior auth typically slows things down in your process?"

nextTimeAction: 2-4 sentences of real-world actionable instruction.
"When [specific trigger from this scenario]: [concrete behavior]. For example: '[phrase].' This [why it works]."

relatedTurnIds: Array of transcript turn IDs (from the [id] prefix in the transcript) that this insight is based on.
CRITICAL: Every insight MUST reference at least one turn ID. Match each turn ID to the [id] prefix in the transcript.

─── SIGNAL-RESPONSE ALIGNMENT ───
Field: signalResponseAlignment[] — EXACTLY 3 entries

ENTRY 1 — "Turn-Level Volatility Analysis":
For EACH volatility event in the log above, produce one structured block:
---
Turn [X]: Rep behavior: [what rep said/did not say — direct transcript reference] | Missed signal: [capability ID] | Volatility shift: [stable→slightly_disrupted etc] | HCP reaction: [what HCP said next] | Conversation impact: [one causal sentence]
---
If a turn shows recovery: "Turn [X] (Recovery): Rep behavior: [effective behavior] | Signal demonstrated: [capability] | Volatility shift: [prior→stable] | HCP reaction: [less resistant response] | Impact: [how this shifted trajectory]"
If no volatility events: "The interaction maintained stable volatility throughout. No escalation events or curveballs were triggered."

ENTRY 2 — "Cross-Capability Interaction":
"[Capability A failure] cascaded into [Capability B failure] because [mechanism]. The HCP response to this chain was [specific behavior from transcript]. This pattern [persisted/resolved] across [N] turns."

ENTRY 3 — "Trajectory and Predicted Continuation":
Based on the state trajectory and volatility log above:
- Direction of HCP openness: improving / stable / declining
- The specific turn where the most significant state shift occurred
- For each curveball: name the turn, causal signal, and how rep responded
- What the trajectory predicts would have happened next

─── LEGACY FIELDS ───
Also populate: overallSummary[], strengths[], strengthsProse[], improvementAreas[], missedOpportunities[], developProse[], suggestedReframes[], actionPlanProse[], overallGuidance[]
These must be consistent with the above analysis.

=== ABSOLUTE RULES ===

── SCORE / GRADING PROHIBITION ──
- ZERO numeric scores, percentages, grades, rankings, pass/fail language
- observationLevel values (effective / developing / missed) are behavioral signal classifications, NOT grades

── ANTI-GENERIC ENFORCEMENT ──
Every insight field MUST be rejected internally if it contains:
  ✗ "ask better questions"
  ✗ "improve your listening"
  ✗ "be more relevant"
  ✗ "address the concern"
  ✗ "adapt better"
  ✗ "try to be more..."
  ✗ Any advice that could apply to ANY session with ANY HCP

── SPECIFICITY TEST ──
Before finalizing any insight, ask: "Could this exact sentence appear in a coaching debrief for a different scenario?"
If YES → it is too generic. Rewrite it with reference to THIS HCP's specific words, persona, or pressures.

── EVERY INSIGHT MUST INCLUDE ALL FIVE ──
  1. Specific rep behavior (what was said or not said — reference the actual exchange)
  2. Specific HCP reaction (what the HCP did or said NEXT, traceable to a turn)
  3. Causal link: "Because the rep [X], the HCP [Y]"
  4. Session-specific anchor (this HCP's persona: ${scenario.persona}, pressures: ${(scenario.interactionPressure || []).join(", ") || "none"}, or exact transcript words)
  5. Direct transcript quote or paraphrase with matching relatedTurnIds

── INTER-CAPABILITY CHAIN ENFORCEMENT ──
Known chains — if active in this session, BOTH capabilities must reference the chain in whyItMattered:
  - listening_responsiveness missed → objection_navigation typically degrades
  - question_quality missed → making_it_matter typically degrades
  - conversation_control_structure missed → commitment_gaining typically degrades
  - adaptability missed → customer_engagement_signals typically degrades

── STAGE-AWARE NARRATIVE GUARDRAILS ──
- In initial_access or early_discovery scenarios, do NOT frame commitment_gaining as a major success unless the HCP explicitly owned a next step.
- In early_discovery scenarios without a true objection signal, do NOT describe objection_navigation as the dominant failure.
- Prioritize primary capabilities in the scenario capability profile when writing briefRationale, didWell, biggestGap, and nextAdjustment.

── TRACEABILITY ──
- transcriptEvidence must be a direct quote or precise paraphrase — find the exact turn
- relatedTurnIds must reference turns that CONTAIN the evidence
- observationLevel MUST match pre-assessment: ${assessmentSummary.split("\n").join(" | ")}

── LANGUAGE RULES ──
- Use: "The rep [specific behavior]. This caused the HCP to [specific reaction]."
- Use: "Because [X was absent], the HCP [Y]."
- Do NOT use: "could", "should", "might want to", "consider", "it would be beneficial"
- Do NOT infer intent, emotion, or internal states
- END overallGuidance[0] with this exact string: "This analysis is based on observable behaviors during the interaction and is intended to support development, not scoring."

Return ONLY valid JSON with this exact structure:
{
  "briefRationale": "string",
  "didWell": "string",
  "biggestGap": "string",
  "nextAdjustment": "string",
  "capabilityInsights": [
    {
      "capabilityId": "string",
      "capabilityName": "string",
      "observationLevel": "effective|developing|missed",
      "whatHappened": "string",
      "transcriptEvidence": "string",
      "whyItMattered": "string",
      "pattern": "string",
      "whatGoodLooksLike": "string",
      "exampleRewrite": "string",
      "nextTimeAction": "string",
      "relatedTurnIds": ["string"]
    }
  ],
  "signalResponseAlignment": ["paragraph1", "paragraph2", "paragraph3"],
  "overallSummary": ["paragraph1", "paragraph2", "paragraph3"],
  "strengthsProse": ["string"],
  "developProse": ["string"],
  "actionPlanProse": ["string"],
  "strengths": [{ "capabilityId": "string", "capabilityName": "string", "observationLevel": "effective", "title": "string", "guidance": "string", "relatedTurnIds": ["string"], "exampleRewrite": null }],
  "improvementAreas": [{ "capabilityId": "string", "capabilityName": "string", "observationLevel": "developing", "title": "string", "guidance": "string", "relatedTurnIds": ["string"], "exampleRewrite": "string" }],
  "missedOpportunities": [{ "capabilityId": "string", "capabilityName": "string", "observationLevel": "missed", "title": "string", "guidance": "string", "relatedTurnIds": ["string"], "exampleRewrite": "string" }],
  "suggestedReframes": [{ "capabilityId": "string", "capabilityName": "string", "observationLevel": "developing", "title": "string", "guidance": "string", "relatedTurnIds": ["string"], "exampleRewrite": "string" }],
  "overallGuidance": ["This analysis is based on observable behaviors during the interaction and is intended to support development, not scoring."]
}`;

  const result = await invokeWorkerJson({
    prompt,
    max_tokens: 1600,
    temperature: 0.2,
    timeout_ms: 45000,
    response_json_schema: {
      type: "object",
      properties: {
        briefRationale: { type: "string" },
        didWell: { type: "string" },
        biggestGap: { type: "string" },
        nextAdjustment: { type: "string" },
        capabilityInsights: { type: "array", items: { type: "object" } },
        signalResponseAlignment: { type: "array", items: { type: "string" } },
        overallSummary: { type: "array", items: { type: "string" } },
        strengthsProse: { type: "array", items: { type: "string" } },
        developProse: { type: "array", items: { type: "string" } },
        actionPlanProse: { type: "array", items: { type: "string" } },
        strengths: { type: "array", items: { type: "object" } },
        improvementAreas: { type: "array", items: { type: "object" } },
        missedOpportunities: { type: "array", items: { type: "object" } },
        suggestedReframes: { type: "array", items: { type: "object" } },
        overallGuidance: { type: "array", items: { type: "string" } }
      }
    }
  });

  return normalizeSessionReviewShape(result, deterministicAssessment, volatilityEvents);
}
