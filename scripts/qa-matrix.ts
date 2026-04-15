import { ALL_SCENARIOS } from "../src/lib/scenarioCatalog.js";
import { initializeConversation } from "../src/lib/conversationInit";
import { generateHcpResponse } from "../src/lib/hcpResponseGenerator";
import { computeVolatilityEvents } from "../src/lib/simulatorEngine";
import { runCapabilityEvaluationEngine } from "../src/lib/capabilityEvaluation";
import { generateSessionReview } from "../src/lib/sessionReview";
import { computeHcpStateHistory } from "../src/lib/hcpStateEngine";
import { invokeWorkerText } from "../src/services/workerClient.js";
import { maybeConcreteifyStrongRepReply, maybeDeRepeatStrongRepReply, maybeReviseStrongRepReply, maybeTightenSpokenRepReply } from "../src/lib/qaRepProxy.js";

type PersonaKey = "strong_rep" | "mediocre_rep" | "weak_rep";
const QA_STEP_TIMEOUT_MS = 45000;

async function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = QA_STEP_TIMEOUT_MS): Promise<T> {
  let timeoutId;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function parsePersonaKey(value?: string): PersonaKey {
  switch (String(value || "").trim().toLowerCase()) {
    case "strong":
    case "strong_rep":
      return "strong_rep";
    case "mediocre":
    case "average":
    case "mediocre_rep":
      return "mediocre_rep";
    case "weak":
    case "weak_rep":
      return "weak_rep";
    default:
      return "strong_rep";
  }
}

const QA_PERSONAS: Record<PersonaKey, {
  label: string;
  buildPrompt: (scenario: any, turns: any[], currentBehaviorState: string, currentJourneyState: string) => string;
}> = {
  strong_rep: {
    label: "Strong Rep",
    buildPrompt: (scenario, turns, currentBehaviorState, currentJourneyState) => `
You are a highly skilled pharma sales rep in a role-play simulation. Your task is to demonstrate STRONG capability behaviors.

SCENARIO: ${scenario.title}
OBJECTIVE: ${scenario.objective}
HCP PERSONA: ${scenario.persona}
CURRENT BEHAVIOR STATE: ${currentBehaviorState}
CURRENT JOURNEY STATE: ${currentJourneyState}
INTERACTION PRESSURES: ${(scenario.interactionPressure || []).join(", ") || "none"}
OPENING SCENE: ${scenario.openingScene || ""}
KEY CHALLENGES: ${(scenario.keyChallenges || []).join(" | ") || "none"}

CONVERSATION SO FAR:
${turns.map((t) => `${t.speaker.toUpperCase()}: ${t.text}`).join("\n")}

Generate the rep's next response (1-2 sentences) that:
- Asks a specific, contextually relevant open-ended question OR meaningfully acknowledges what the HCP said
- Does NOT pitch or lead with product claims
- Directly responds to the last HCP message
- Sounds natural and professional
- Uses only one question maximum
- Avoids stacked or compound questions
- If the HCP is time-constrained, closed, resistant, or operationally pressured, keep the response concise and tightly relevant
- In high-pressure scenarios, earn the next turn by showing understanding before broadening discovery
- If the HCP asks a direct operational or clinical question, answer it directly first instead of defaulting to more discovery
- If the HCP asks a direct workflow, burden, value, or clinical-impact question, your next reply must begin with a direct declarative answer, not a question
- If the HCP names a specific subgroup, exclusion criterion, evidence gap, renal issue, safety concern, or workflow step, reference that exact issue directly instead of saying "what specific aspects" or "help me understand"
- If there is no HCP reply yet, treat the opening scene as the active concern and respond to the exact issue already on the table instead of starting with detached discovery
- On the first turn of a skeptical clinical-value scenario, lead with the specific evidence gap in the opening scene before any narrow follow-up
- Respect the scenario key challenges; if they say exploring the concern is more credible than defending the data, do not jump into a rebuttal or rescue claim
- In a skeptical clinical-value exchange, the first clause of your reply must name the exact issue the HCP raised (for example: renal impairment, excluded patients, real-world fit, subgroup mismatch)
- In a skeptical clinical-value exchange, if the HCP repeats the same evidence-fit concern, stop broadening discovery and answer the concern directly in plain clinician language before asking anything else
- When the objection is subgroup mismatch, excluded patients, comorbidities, renal impairment, workflow friction, or real-world fit, prefer one short declarative response over a question
- In a repeated objection cycle, your reply should do three things in order: name the exact mismatch, state the practical implication, and offer one concrete next step or clarifier
- Do not introduce a new efficacy, safety, or pharmacokinetic claim just to rescue the conversation if the HCP is challenging fit or trial design
- If the HCP asks what changes, what gets added, what staff has to do, or what the point is, give one direct answer before asking anything else
- In a pressured interaction, do not open with "help me understand" or another broad discovery move when the HCP is asking for the bottom line
- Do not use vague empathy wrappers like "I sense", "it sounds like", or "you're not convinced" when the HCP has already stated the concrete issue
- Do not begin with generic summary lines like "You've expressed concerns..." or "You've said..." when the concrete issue is already on the table
- In high-pressure or access-barrier scenarios, prefer one clear answer and only add a short follow-up if the HCP has room for it
- In a time-pressured exchange, it is better to give one crisp answer with no question than a thoughtful question that delays the answer
- If the HCP repeats the same concern twice, stop widening the conversation and address the concern head-on
- Do not ask another broad question when the HCP is clearly asking for the bottom line
- In commitment-close or adoption-commitment scenarios, stop reopening discovery after the core blocker is clear
- Once the HCP has repeated a vague blocker like "right patient", "not yet", or "I need to see more", pivot toward a proportionate next-step ask
- In close-stage scenarios, prefer a smallest-next-step question such as whether the HCP would be open to defining one patient type, reviewing one case, or taking one concrete action they can own

Return ONLY the rep's reply as plain text.`,
  },
  mediocre_rep: {
    label: "Mediocre Rep",
    buildPrompt: (scenario, turns) => `
You are a pharma sales rep in a role-play simulation. You are AVERAGE — sometimes you respond well, sometimes you miss signals or default to product pitching.

SCENARIO: ${scenario.title}
OBJECTIVE: ${scenario.objective}

CONVERSATION SO FAR:
${turns.map((t) => `${t.speaker.toUpperCase()}: ${t.text}`).join("\n")}

Generate the rep's next response (1-2 sentences) that is INCONSISTENT — sometimes addresses the HCP concern, sometimes pivots to a product claim or generic statement.

Return ONLY the rep's reply as plain text.`,
  },
  weak_rep: {
    label: "Weak Rep",
    buildPrompt: (scenario, turns) => `
You are a poorly skilled pharma sales rep in a role-play simulation. You demonstrate WEAK behaviors.

SCENARIO: ${scenario.title}
OBJECTIVE: ${scenario.objective}

CONVERSATION SO FAR:
${turns.map((t) => `${t.speaker.toUpperCase()}: ${t.text}`).join("\n")}

Generate the rep's next response (1-2 sentences) that:
- Ignores the HCP's actual concern or question
- Defaults to a product feature or efficacy claim
- Does not ask any meaningful question
- Sounds like a scripted pitch

Return ONLY the rep's reply as plain text.`,
  },
};

function summarizeAssertions(scenario: any, turns: any[], allSignals: any[], review: any) {
  const repTurns = turns.filter((t) => t.speaker === "rep");
  const hcpTurns = turns.filter((t) => t.speaker === "hcp");
  const signalsPopulated = allSignals.filter((s) => s && Object.keys(s).length > 0).length;
  const emptyHcpReplies = hcpTurns.filter((t) => !t.text || t.text.trim().length < 5).length;
  const cueCoverage = hcpTurns.filter((t) => Array.isArray(t.cues) && t.cues.length > 0).length;
  const capInsights = review?.capabilityInsights || [];
  const nudgeCount = turns.filter((t) => t.nudge).length;
  const volEvents = computeVolatilityEvents(scenario, allSignals, repTurns.map((t) => t.id));

  return {
    hcpCoveragePass: hcpTurns.length >= repTurns.length,
    signalCoveragePass: signalsPopulated === repTurns.length,
    cueCoveragePass: cueCoverage === hcpTurns.length,
    nonEmptyHcpPass: emptyHcpReplies === 0,
    reviewCoveragePass: capInsights.length === 8,
    nudgePass: nudgeCount >= 1,
    volatilityEvents: volEvents.length,
  };
}

async function retry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const rateLimitMatch = message.match(/try again in\s+(\d+(?:\.\d+)?)s/i);
      if (attempt < maxRetries - 1) {
        const delay = rateLimitMatch
          ? Math.ceil(Number(rateLimitMatch[1]) * 1000) + 1500
          : Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

async function runSession(scenario: any, personaKey: PersonaKey, maxTurns: number) {
  const persona = QA_PERSONAS[personaKey];
  const convInit = await initializeConversation(scenario);

  let turns: any[] = [];
  let allSignals: any[] = [];
  const repTurnIds: string[] = [];
  let currentBehaviorState = convInit.initialBehaviorState;
  let currentJourneyState = scenario.journeyState;
  let currentVolatilityProfile = "stable";

  for (let i = 0; i < maxTurns; i++) {
    const repPrompt = persona.buildPrompt(scenario, turns, currentBehaviorState, currentJourneyState);
    const repTextRaw = await retry(() => withTimeout(invokeWorkerText({
      prompt: repPrompt,
      max_tokens: 180,
      temperature: 0.1,
    }), `${scenario.title} rep turn ${i + 1}`));
    const repDraft = String(repTextRaw).trim().replace(/^(REP|Rep|rep)\s*:\s*/i, "").trim();
    let repText = repDraft;
    if (personaKey === "strong_rep") {
      repText = await retry(() => withTimeout(maybeReviseStrongRepReply({
        scenario,
        turns,
        currentBehaviorState,
        currentJourneyState,
        draft: repText,
      }), `${scenario.title} rep revision ${i + 1}`));
      repText = await retry(() => withTimeout(maybeConcreteifyStrongRepReply({
        scenario,
        turns,
        currentBehaviorState,
        currentJourneyState,
        draft: repText,
      }), `${scenario.title} rep concrete revision ${i + 1}`));
      repText = await retry(() => withTimeout(maybeDeRepeatStrongRepReply({
        scenario,
        turns,
        currentBehaviorState,
        currentJourneyState,
        draft: repText,
      }), `${scenario.title} rep dedupe revision ${i + 1}`));
      repText = await retry(() => withTimeout(maybeTightenSpokenRepReply({
        scenario,
        turns,
        currentBehaviorState,
        currentJourneyState,
        draft: repText,
      }), `${scenario.title} rep spoken-tightening ${i + 1}`));
    }

    const repTurnObj = {
      id: crypto.randomUUID(),
      speaker: "rep",
      text: repText,
      timestamp: new Date().toISOString(),
      cues: [],
      nudge: null,
    };
    turns = [...turns, repTurnObj];
    repTurnIds.push(repTurnObj.id);

    const conversationHistory = turns.map((turn) => ({
      id: turn.id,
      speaker: turn.speaker,
      text: turn.text,
      timestamp: turn.timestamp,
    }));

    const response = await retry(() => withTimeout(generateHcpResponse(
      scenario,
      conversationHistory,
      currentBehaviorState,
      currentJourneyState,
      true,
      repText,
      allSignals,
      i,
      currentVolatilityProfile as any,
    ), `${scenario.title} hcp turn ${i + 1}`));

    if (response.coachingNudge) {
      turns = turns.map((turn, index) => (
        index === turns.length - 1 ? { ...turn, nudge: response.coachingNudge } : turn
      ));
    }

    turns = [...turns, {
      id: crypto.randomUUID(),
      speaker: "hcp",
      text: response.hcpReply,
      timestamp: new Date().toISOString(),
      cues: response.activeCues || [],
      nudge: null,
    }];

    allSignals = [...allSignals, response.behaviorSignals || {}];
    currentBehaviorState = response.nextBehaviorState;
    currentJourneyState = response.nextJourneyState;
    if (response.volatilityState) {
      currentVolatilityProfile = response.volatilityState.profile;
    }
  }

  const stateHistory = computeHcpStateHistory(
    allSignals,
    scenario.persona,
    scenario.interactionPressure || [],
    scenario.startingBehaviorState,
  );
  const volatilityEvents = computeVolatilityEvents(scenario, allSignals, repTurnIds);
  const capabilityLevels = runCapabilityEvaluationEngine(allSignals, scenario.suggestedFocusCapabilities || []);
  const capabilityInsights = Object.entries(capabilityLevels).map(([id, level]) => ({
    capabilityId: id,
    capabilityName: id.replace(/_/g, " "),
    observationLevel: level,
  }));
  const missed = Object.entries(capabilityLevels).filter(([, level]) => level === "missed").map(([id]) => id.replace(/_/g, " "));
  const effective = Object.entries(capabilityLevels).filter(([, level]) => level === "effective").map(([id]) => id.replace(/_/g, " "));

  let review;
  try {
    review = await retry(() => withTimeout(
      generateSessionReview(scenario, turns, allSignals, stateHistory, volatilityEvents),
      `${scenario.title} session review`,
      90000,
    ));
  } catch (error) {
    review = {
      capabilityInsights,
      briefRationale: missed.length > 0
        ? `Deterministic QA fallback: missed capability signals detected in ${missed.join(", ")}. Effective signals observed in ${effective.join(", ") || "none"}.`
        : `Deterministic QA fallback: no missed capabilities detected. Effective signals observed in ${effective.join(", ") || "none"}.`,
      volatilityEvents,
      qaFallback: true,
      qaFallbackReason: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    scenario,
    personaKey,
    turns,
    allSignals,
    capabilityLevels,
    review,
    assertions: summarizeAssertions(scenario, turns, allSignals, review),
  };
}

async function main() {
  const scenarioFilter = process.argv.slice(4).join(" ").trim().toLowerCase();
  const scenarios = scenarioFilter
    ? ALL_SCENARIOS.filter((scenario) => scenario.title.toLowerCase().includes(scenarioFilter))
    : ALL_SCENARIOS;
  const personaKey = parsePersonaKey(process.argv[2]);
  const maxTurns = Number(process.argv[3] || 4);
  const results = [];

  if (scenarios.length === 0) {
    console.error(`No scenarios matched filter: "${process.argv.slice(4).join(" ")}"`);
    process.exit(1);
  }

  console.log(`Running QA matrix for ${scenarios.length} scenario(s) as ${personaKey} with ${maxTurns} rep turn(s) each...`);

  for (const scenario of scenarios) {
    console.log(`Running scenario: ${scenario.title}`);
    const result = await runSession(scenario, personaKey, maxTurns);
    results.push(result);
    const failed = Object.entries(result.assertions).filter(([key, value]) => key.endsWith("Pass") && !value);
    const summary = failed.length ? `FAIL ${failed.map(([key]) => key).join(", ")}` : "PASS";
    console.log(`${summary} :: ${scenario.title}`);
  }

  const out = {
    generatedAt: new Date().toISOString(),
    personaKey,
    maxTurns,
    scenarioCount: results.length,
    results: results.map((result) => ({
      title: result.scenario.title,
      journeyStage: result.scenario.journeyStage,
      assertions: result.assertions,
      capabilityLevels: result.capabilityLevels,
      briefRationale: result.review?.briefRationale || "",
      qaFallback: Boolean(result.review?.qaFallback),
      qaFallbackReason: result.review?.qaFallbackReason || "",
      firstCue: result.turns.find((turn) => turn.speaker === "hcp")?.cues?.[0]?.label || "",
      lastHcpReply: [...result.turns].reverse().find((turn) => turn.speaker === "hcp")?.text || "",
      transcript: results.length === 1
        ? result.turns.map((turn) => ({
            speaker: turn.speaker,
            text: turn.text,
            cue: turn.cues?.[0]?.label || "",
            cueDescription: turn.cues?.[0]?.description || "",
            nudge: turn.nudge?.guidance || "",
          }))
        : undefined,
    })),
  };

  console.log(`\nJSON_SUMMARY_START\n${JSON.stringify(out, null, 2)}\nJSON_SUMMARY_END`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
