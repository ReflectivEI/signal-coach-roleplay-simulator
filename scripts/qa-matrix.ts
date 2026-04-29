import { ALL_SCENARIOS } from "../src/lib/scenarioCatalog.js";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { initializeConversation } from "../src/lib/conversationInit";
import { generateHcpResponse } from "../src/lib/hcpResponseGenerator";
import { computeVolatilityEvents } from "../src/lib/simulatorEngine";
import { runCapabilityEvaluationEngine } from "../src/lib/capabilityEvaluation";
import { buildDeterministicSessionReview, generateSessionReview } from "../src/lib/sessionReview";
import { computeHcpStateHistory } from "../src/lib/hcpStateEngine";
import { predictHcpBehavior } from "../src/lib/hcpBehaviorPrediction";
import { invokeWorkerText } from "../src/services/workerClient.js";
import { buildDeterministicQaRepReply, enforceRepAnswerFirstContract } from "../src/lib/qaRepProxy.js";
import { getScenarioConcernFamily } from "../src/lib/scenarioFamilyRegistry";

type PersonaKey = "strong_rep" | "mediocre_rep" | "weak_rep";
const QA_STEP_TIMEOUT_MS = 45000;
const QA_REVIEW_TIMEOUT_MS = 20000;
const QA_HCP_TOKEN_CAP = 260;
const QA_CACHE_PATH = path.resolve(".qa-matrix-cache.json");
const QA_RUN_HISTORY_PATH = path.resolve("artifacts/qa-matrix/run-history.json");
const QA_FINGERPRINT_FILES = [
  "src/lib/qaRepProxy.js",
  "src/lib/hcpResponseGenerator.ts",
  "src/lib/hcpCueGenerator.ts",
  "src/lib/hcpResponseSurface.ts",
  "src/lib/hcpRealismBackbone.ts",
  "src/lib/hcpRealismMemory.ts",
  "src/lib/hcpBehaviorPrediction.ts",
  "src/lib/hcpDialogueDirectives.ts",
  "src/lib/hcpTurnDirectives.ts",
  "src/lib/scenarioFamilyRegistry.ts",
  "src/lib/sessionReview.ts",
  "scripts/qa-matrix.ts",
];

async function computeQaFingerprint() {
  const hash = crypto.createHash("sha256");
  for (const relPath of QA_FINGERPRINT_FILES) {
    try {
      const content = await fs.readFile(path.resolve(relPath), "utf8");
      hash.update(relPath);
      hash.update("\n");
      hash.update(content);
      hash.update("\n");
    } catch {
      hash.update(`${relPath}:missing\n`);
    }
  }
  return hash.digest("hex");
}

async function readQaCache() {
  try {
    const raw = await fs.readFile(QA_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeQaCache(cache) {
  await fs.writeFile(QA_CACHE_PATH, JSON.stringify(cache, null, 2));
}

type QaRunHistoryEntry = {
  timestamp: string;
  personaKey: PersonaKey;
  maxTurns: number;
  scenarioKey: string;
  title: string;
  riskLevel: string;
  opennessScore: number;
};

async function readQaRunHistory(): Promise<QaRunHistoryEntry[]> {
  try {
    const raw = await fs.readFile(QA_RUN_HISTORY_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQaRunHistory(entries: QaRunHistoryEntry[]) {
  await fs.mkdir(path.dirname(QA_RUN_HISTORY_PATH), { recursive: true });
  await fs.writeFile(QA_RUN_HISTORY_PATH, JSON.stringify(entries, null, 2));
}

function isHighRiskLowOpenness(prediction: any) {
  return (
    String(prediction?.riskLevel || "").toLowerCase() === "high" &&
    Number(prediction?.opennessScore || 0) <= 2
  );
}

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
- In initial-access scenarios, if the HCP asks "what's this about?" or signals they only have a minute, answer that directly in one sentence before asking anything
- In referral or expectation-mismatch openings, acknowledge the mismatch directly and state why this conversation matters before asking anything
- In access/formulary scenarios, if the HCP asks what would change, what would move the review, or what they could take back, answer that exact process question before broadening
- In adoption/implementation scenarios, if the HCP asks what staff would have to do or who would own the next step, answer that workflow question first instead of reopening discovery
- If the HCP clearly wants the short version, do not greet, reset, or ask a polite opener first
- In commitment-close or adoption-commitment scenarios, stop reopening discovery after the core blocker is clear
- Once the HCP has repeated a vague blocker like "right patient", "not yet", or "I need to see more", pivot toward a proportionate next-step ask
- In close-stage scenarios, prefer a smallest-next-step question such as whether the HCP would be open to defining one patient type, reviewing one case, or taking one concrete action they can own
- In close-stage scenarios, if the HCP asks for one concrete proof point, offer one plausible proof-point category first instead of asking the HCP to invent it from scratch

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
      const cooldownMatch = message.match(/"retryAfterSeconds":\s*(\d+)/i);
      const coolingDown = /cooling down after rate limit/i.test(message);
      if (attempt < maxRetries - 1) {
        const delay = rateLimitMatch
          ? Math.ceil(Number(rateLimitMatch[1]) * 1000) + 1500
          : cooldownMatch
            ? Math.ceil(Number(cooldownMatch[1]) * 1000) + 1500
            : coolingDown
              ? 25000
              : Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

function buildSafeRepFallback({
  scenario,
  turns,
  isQAMode = true,
}: {
  scenario: any;
  turns: any[];
  isQAMode?: boolean;
}) {
  const repProxyOutput = buildDeterministicQaRepReply({ turns, draft: "" });
  const finalRepReply = enforceRepAnswerFirstContract({ scenario, turns, draft: repProxyOutput });
  if (isQAMode) {
    console.log("REP_FALLBACK_USED", finalRepReply.concept || repProxyOutput.concept || "unknown");
  }
  return finalRepReply;
}

async function generateQaRepReply({
  scenario,
  turns,
  currentBehaviorState,
  currentJourneyState,
  persona,
  turnIndex,
  maxTurns,
  isQAMode = true,
}: {
  scenario: any;
  turns: any[];
  currentBehaviorState: string;
  currentJourneyState: string;
  persona: {
    buildPrompt: (scenario: any, turns: any[], currentBehaviorState: string, currentJourneyState: string) => string;
  };
  turnIndex: number;
  maxTurns: number;
  isQAMode?: boolean;
}) {
  const enforceCommitmentCloseSafeguard = (rawText: string) => {
    const text = String(rawText || "").trim();
    if (!text) return text;

    const closeStages = new Set(["adoption_implementation", "commitment_close", "access_formulary"]);
    const stage = String(scenario?.journeyStage || "").toLowerCase();
    const isCloseStage = closeStages.has(stage);
    if (!isCloseStage) return text;

    const lateTurnThreshold = Math.max(3, maxTurns - 4);
    if (turnIndex < lateTurnThreshold) return text;

    const lastHcpText = [...turns].reverse().find((t) => t?.speaker === "hcp" && typeof t?.text === "string")?.text || "";
    const hcp = String(lastHcpText || "").toLowerCase();
    const draft = text.toLowerCase();

    const readinessSignal = /safe enough|low-risk step|one low-risk|i can look at it|i'?d consider|would consider|show me (that )?case|one concrete|one proof point|one data point|what one step|next step/.test(hcp);
    if (!readinessSignal) return text;

    const hasCommitmentAsk = /would you be open|can we|let'?s|next step|schedule|pilot|start with|review one|take one/.test(draft);
    const overDiscoveryLoop = /can you (tell|walk|elaborate)|what specific|what would need|what would be|what aspect|help me understand/.test(draft);

    if (hasCommitmentAsk && !overDiscoveryLoop) return text;

    const lowRiskStep = /case|proof point|data point|evidence/.test(hcp)
      ? "A low-risk first step is to review one comparable patient case together and agree on one safety-check criterion before any broader use."
      : "A low-risk first step is to trial this in one clearly defined patient profile with one agreed safety checkpoint and staff owner.";

    return `${lowRiskStep} Would you be open to setting that one-patient step now so your team can test it without broad workflow disruption?`;
  };

  const repPrompt = persona.buildPrompt(scenario, turns, currentBehaviorState, currentJourneyState);

  try {
    const repTextRaw = await withTimeout(invokeWorkerText({
      prompt: repPrompt,
      max_tokens: 180,
      temperature: 0.1,
      timeout_ms: 7000,
      retry_count: 0,
    }), `${scenario.title} rep turn ${turnIndex + 1}`);

    const repDraft = String(repTextRaw).trim().replace(/^(REP|Rep|rep)\s*:\s*/i, "").trim();
    if (repDraft) {
      const finalReply = enforceRepAnswerFirstContract({ scenario, turns, draft: { text: repDraft, concept: null } });
      return {
        ...finalReply,
        text: enforceCommitmentCloseSafeguard(finalReply.text || ""),
      };
    }

    const repProxyOutput = buildDeterministicQaRepReply({ turns, draft: "" });
    const finalReply = enforceRepAnswerFirstContract({ scenario, turns, draft: repProxyOutput });
    return {
      ...finalReply,
      text: enforceCommitmentCloseSafeguard(finalReply.text || ""),
    };
  } catch {
    return buildSafeRepFallback({ scenario, turns, isQAMode });
  }
}

async function runSession(scenario: any, personaKey: PersonaKey, maxTurns: number) {
  const persona = QA_PERSONAS[personaKey];
  const convInit = await initializeConversation(scenario);

  let turns: any[] = [];
  let allSignals: any[] = [];
  const predictionTrace: any[] = [];
  const repTurnIds: string[] = [];
  let currentBehaviorState = convInit.initialBehaviorState;
  let currentJourneyState = scenario.journeyState;
  let currentVolatilityProfile = "stable";

  for (let i = 0; i < maxTurns; i++) {
    const turnBadge = `Turn ${i + 1}`;
    console.log(`[${scenario.title}] ${turnBadge}`);
    const finalRepReply = await generateQaRepReply({
      scenario,
      turns,
      currentBehaviorState,
      currentJourneyState,
      persona,
      turnIndex: i,
      maxTurns,
      isQAMode: true,
    });

    const repTurnObj = {
      id: crypto.randomUUID(),
      speaker: "rep",
      text: finalRepReply.text || "",
      concept: finalRepReply.concept || null,
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
      cues: turn.cues || [],
    }));

    const response = await retry(() => withTimeout(generateHcpResponse(
      scenario,
      conversationHistory,
      currentBehaviorState,
      currentJourneyState,
      true,
      finalRepReply.text || "",
      allSignals,
      i,
      currentVolatilityProfile as any,
      QA_HCP_TOKEN_CAP,
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
    predictionTrace.push({
      turn: i + 1,
      repTurnId: repTurnObj.id,
      prediction: response.prediction || predictHcpBehavior(allSignals, allSignals, scenario),
    });
  }

  const stateHistory = computeHcpStateHistory(
    allSignals,
    scenario.persona,
    scenario.interactionPressure || [],
    scenario.startingBehaviorState,
  );
  const volatilityEvents = computeVolatilityEvents(scenario, allSignals, repTurnIds);
  const capabilityLevels = runCapabilityEvaluationEngine(allSignals, scenario.suggestedFocusCapabilities || [], scenario);
  const capabilityInsights = Object.entries(capabilityLevels).map(([id, level]) => ({
    capabilityId: id,
    capabilityName: id.replace(/_/g, " "),
    observationLevel: level,
  }));
  const missed = Object.entries(capabilityLevels).filter(([, level]) => level === "missed").map(([id]) => id.replace(/_/g, " "));
  const effective = Object.entries(capabilityLevels).filter(([, level]) => level === "effective").map(([id]) => id.replace(/_/g, " "));

  let review;
  if (process.env.QA_LLM_REVIEW === "1") {
    try {
      console.log(`[${scenario.title}] Generating session review`);
      review = await retry(() => withTimeout(
        generateSessionReview(scenario, turns, allSignals, stateHistory, volatilityEvents),
        `${scenario.title} session review`,
        QA_REVIEW_TIMEOUT_MS,
      ));
    } catch (error) {
      review = {
        ...buildDeterministicSessionReview(capabilityLevels, volatilityEvents),
        qaFallback: true,
        qaFallbackReason: error instanceof Error ? error.message : String(error),
      };
    }
  } else {
    console.log(`[${scenario.title}] Generating deterministic session review`);
    review = {
      ...buildDeterministicSessionReview(capabilityLevels, volatilityEvents),
      qaFallback: false,
      qaFallbackReason: "",
    };
  }

  return {
    scenario,
    personaKey,
    turns,
    allSignals,
    predictionTrace,
    finalPrediction: predictionTrace[predictionTrace.length - 1]?.prediction || predictHcpBehavior(allSignals, allSignals, scenario),
    capabilityLevels,
    review,
    assertions: summarizeAssertions(scenario, turns, allSignals, review),
  };
}

async function main() {
  const scenarioFilter = process.argv.slice(4).join(" ").trim().toLowerCase();
  const familyAliasMap: Record<string, string[]> = {
    "cost/value": ["evidence"],
    cost: ["evidence"],
    value: ["evidence"],
    "access/workflow": ["access", "workflow"],
    access: ["access"],
    workflow: ["workflow"],
    "skeptical evidence-fit": ["evidence"],
    skeptical: ["evidence"],
    "time-pressured gatekeeping": ["time"],
    time: ["time"],
    gatekeeping: ["time"],
    "patient-selection ambiguity": ["screening"],
    screening: ["screening"],
  };
  const requestedFamilies = familyAliasMap[scenarioFilter] || [];
  const scenarios = scenarioFilter
    ? ALL_SCENARIOS.filter((scenario) => {
      const concernFamily = getScenarioConcernFamily(scenario) || "";
      return scenario.title.toLowerCase().includes(scenarioFilter) ||
        scenario.journeyStage.toLowerCase().includes(scenarioFilter) ||
        concernFamily.includes(scenarioFilter) ||
        requestedFamilies.includes(concernFamily);
    })
    : ALL_SCENARIOS;
  const personaKey = parsePersonaKey(process.argv[2]);
  const maxTurns = Number(process.argv[3] || 4);
  const results = [];
  const fingerprint = await computeQaFingerprint();
  const cache = await readQaCache();
  const priorRunHistory = await readQaRunHistory();

  if (scenarios.length === 0) {
    console.error(`No scenarios matched filter: "${process.argv.slice(4).join(" ")}"`);
    process.exit(1);
  }

  console.log(`Running QA matrix for ${scenarios.length} scenario(s) as ${personaKey} with ${maxTurns} rep turn(s) each...`);

  for (const scenario of scenarios) {
    const cacheKey = `${fingerprint}::${personaKey}::${maxTurns}::${scenario.id || scenario.title}`;
    const cachedResult = cache[cacheKey];
    if (cachedResult) {
      console.log(`Running scenario: ${scenario.title}`);
      console.log(`CACHE HIT :: ${scenario.title}`);
      results.push(cachedResult);
      const failed = Object.entries(cachedResult.assertions).filter(([key, value]) => key.endsWith("Pass") && !value);
      const summary = failed.length ? `FAIL ${failed.map(([key]) => key).join(", ")}` : "PASS";
      console.log(`${summary} :: ${scenario.title}`);
      continue;
    }

    console.log(`Running scenario: ${scenario.title}`);
    const result = await runSession(scenario, personaKey, maxTurns);
    results.push(result);
    cache[cacheKey] = result;
    await writeQaCache(cache);
    const failed = Object.entries(result.assertions).filter(([key, value]) => key.endsWith("Pass") && !value);
    const summary = failed.length ? `FAIL ${failed.map(([key]) => key).join(", ")}` : "PASS";
    console.log(`${summary} :: ${scenario.title}`);
  }

  const coreCapabilities = [
    "listening_responsiveness",
    "customer_engagement_signals",
    "adaptability",
    "commitment_gaining",
  ];
  const repeatedMissThreshold = Math.max(7, maxTurns - 1);
  const releaseBlockers = results
    .map((result) => {
      const finalPrediction = result.finalPrediction || {};
      const missedRunCounts = finalPrediction.missedRunCounts || {};
      const repeatedCoreMisses = coreCapabilities.filter(
        (capabilityId) => Number(missedRunCounts[capabilityId] || 0) >= repeatedMissThreshold,
      );
      const trigger =
        String(finalPrediction.riskLevel || "").toLowerCase() === "high" &&
        Number(finalPrediction.opennessScore || 0) === 0 &&
        repeatedCoreMisses.length >= 2;

      if (!trigger) return null;
      return {
        title: result.scenario.title,
        journeyStage: result.scenario.journeyStage,
        concernFamily: getScenarioConcernFamily(result.scenario) || "general",
        opennessScore: Number(finalPrediction.opennessScore || 0),
        riskLevel: String(finalPrediction.riskLevel || ""),
        repeatedMissThreshold,
        repeatedCoreMisses,
      };
    })
    .filter(Boolean);

  const releaseBlockerRule = {
    enabled: maxTurns >= 10,
    description: "zero scenarios with high-risk + openness 0 + repeated missed core capabilities over long runs",
    repeatedMissThreshold,
    coreCapabilities,
    blockersDetected: releaseBlockers.length,
    pass: releaseBlockers.length === 0,
  };

  const previousByScenarioKey = new Map<string, QaRunHistoryEntry>();
  for (let i = priorRunHistory.length - 1; i >= 0; i -= 1) {
    const entry = priorRunHistory[i];
    if (!entry) continue;
    if (entry.personaKey !== personaKey || Number(entry.maxTurns) !== maxTurns) continue;
    if (!previousByScenarioKey.has(entry.scenarioKey)) {
      previousByScenarioKey.set(entry.scenarioKey, entry);
    }
  }

  const softWarnings = results
    .map((result) => {
      const scenarioKey = String(result.scenario.id || result.scenario.title);
      const currentPrediction = result.finalPrediction || {};
      const previous = previousByScenarioKey.get(scenarioKey);
      const previousTriggered = previous
        ? String(previous.riskLevel || "").toLowerCase() === "high" && Number(previous.opennessScore || 0) <= 2
        : false;
      const currentTriggered = isHighRiskLowOpenness(currentPrediction);

      if (!previousTriggered || !currentTriggered) return null;

      return {
        title: result.scenario.title,
        scenarioKey,
        journeyStage: result.scenario.journeyStage,
        concernFamily: getScenarioConcernFamily(result.scenario) || "general",
        current: {
          riskLevel: String(currentPrediction.riskLevel || ""),
          opennessScore: Number(currentPrediction.opennessScore || 0),
        },
        previous: {
          timestamp: previous?.timestamp || "",
          riskLevel: String(previous?.riskLevel || ""),
          opennessScore: Number(previous?.opennessScore || 0),
        },
      };
    })
    .filter(Boolean);

  const softWarningRule = {
    enabled: true,
    description: "flag scenarios with riskLevel=high and opennessScore<=2 for 2 consecutive runs",
    riskLevel: "high",
    opennessScoreThreshold: 2,
    consecutiveRunsRequired: 2,
    nonBlocking: true,
    warningsDetected: softWarnings.length,
    pass: true,
  };

  const out = {
    generatedAt: new Date().toISOString(),
    personaKey,
    maxTurns,
    scenarioCount: results.length,
    releaseBlockerRule,
    releaseBlockers,
    softWarningRule,
    softWarnings,
    results: results.map((result) => ({
      title: result.scenario.title,
      journeyStage: result.scenario.journeyStage,
      concernFamily: getScenarioConcernFamily(result.scenario) || "general",
      assertions: result.assertions,
      capabilityLevels: result.capabilityLevels,
      finalPrediction: result.finalPrediction,
      briefRationale: result.review?.briefRationale || "",
      qaFallback: Boolean(result.review?.qaFallback),
      qaFallbackReason: result.review?.qaFallbackReason || "",
      firstCue: result.turns.find((turn) => turn.speaker === "hcp")?.cues?.[0]?.label || "",
      lastHcpReply: [...result.turns].reverse().find((turn) => turn.speaker === "hcp")?.text || "",
      transcript: results.length === 1
        ? result.turns.map((turn) => ({
          speaker: turn.speaker,
          text: turn.text,
          concept: turn.concept || null,
          cue: turn.cues?.[0]?.label || "",
          cueDescription: turn.cues?.[0]?.description || "",
          nudge: turn.nudge?.guidance || "",
        }))
        : undefined,
      predictionTrace: results.length === 1
        ? result.predictionTrace?.map((entry) => ({
          turn: entry.turn,
          predictedBehaviorState: entry.prediction?.predictedBehaviorState || "",
          riskLevel: entry.prediction?.riskLevel || "",
          trajectory: entry.prediction?.trajectory || "",
          concernFamily: entry.prediction?.concernFamily || "",
          predictedDrivers: entry.prediction?.predictedDrivers || [],
          predictedObjections: entry.prediction?.predictedObjections || [],
        }))
        : undefined,
    })),
  };

  const historyToAppend: QaRunHistoryEntry[] = results.map((result) => {
    const scenarioKey = String(result.scenario.id || result.scenario.title);
    const prediction = result.finalPrediction || {};
    return {
      timestamp: out.generatedAt,
      personaKey,
      maxTurns,
      scenarioKey,
      title: result.scenario.title,
      riskLevel: String(prediction.riskLevel || ""),
      opennessScore: Number(prediction.opennessScore || 0),
    };
  });

  const updatedHistory = [...priorRunHistory, ...historyToAppend].slice(-5000);
  await writeQaRunHistory(updatedHistory);

  const finalExitCode = releaseBlockerRule.enabled && !releaseBlockerRule.pass ? 2 : 0;
  console.log(`\nJSON_SUMMARY_START\n${JSON.stringify(out, null, 2)}\nJSON_SUMMARY_END | SOFT_WARNINGS: ${softWarnings.length} | EXIT: ${finalExitCode}`);

  if (releaseBlockerRule.enabled && !releaseBlockerRule.pass) {
    console.error(
      `\nRELEASE_BLOCKER_FAIL: ${releaseBlockers.length} scenario(s) matched the blocker rule. ` +
      `Blockers: ${releaseBlockers.map((blocker) => blocker.title).join(", ")}`,
    );
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
