import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { verifyRpsIdentity, EXPECTED_WORKER_NAME } from "./rpsIdentity";

import { ALL_SCENARIOS } from "../src/lib/scenarioCatalog.js";
import { initializeConversation } from "../src/lib/conversationInit";
import { generateHcpResponse } from "../src/lib/hcpResponseGenerator";
import { invokeWorkerText } from "../src/services/workerClient.js";
import {
  buildDeterministicQaRepReply,
  buildRepAnswerFirstPromptConstraint,
  detectHcpQuestionType,
  enforceRepAnswerFirstContract,
  normalizeDialoguePunctuation,
} from "../src/lib/qaRepProxy.js";
import { buildMatrixAuditSummary, buildTranscriptAudit, runInternalAuditCalibrationCases } from "../src/lib/qaTwinAudit.js";

const execFileAsync = promisify(execFile);

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const ARTIFACT_DIR = path.resolve(REPO_ROOT, "artifacts");
const ARTIFACT_PATH = path.resolve(ARTIFACT_DIR, "predeploy-verify.json");
const APP_BASE_URL = "http://127.0.0.1:5173";
const ROLEPLAY_START_URL = `${APP_BASE_URL}/api/roleplay/start`;
const ROLEPLAY_RESPOND_URL = `${APP_BASE_URL}/api/roleplay/respond`;
const HEALTH_URL = `${APP_BASE_URL}/health`;
const QA_STEP_TIMEOUT_MS = 45000;
const QA_HCP_TOKEN_CAP = 260;

const CANONICAL_JOURNEYS = new Set([
  "initial_access",
  "early_discovery",
  "clinical_value",
  "objection_handling",
  "adoption_implementation",
  "access_formulary",
  "commitment_close",
]);

const QA_PERSONAS = {
  strong_rep: {
    label: "Strong Rep",
    buildPrompt: (scenario: any, turns: any[], currentBehaviorState: string, currentJourneyState: string) => `
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
- If the HCP asks a direct operational or clinical question, answer it directly first instead of defaulting to more discovery
- If the HCP asks what changes, what gets added, what staff has to do, or what the point is, give one direct answer before asking anything else
- In a time-pressured exchange, it is better to give one crisp answer with no question than a thoughtful question that delays the answer
- If the HCP repeats the same concern twice, stop widening the conversation and address the concern head-on

Return ONLY the rep's reply as plain text.`,
  },
  mediocre_rep: {
    label: "Mediocre Rep",
    buildPrompt: (scenario: any, turns: any[]) => `
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
    buildPrompt: (scenario: any, turns: any[]) => `
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
} as const;

type PersonaKey = keyof typeof QA_PERSONAS;

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeBuiltInScenario(scenario: any, index: number) {
  return {
    ...scenario,
    id: scenario.id || `builtin-${slugify(scenario.title || `scenario-${index + 1}`)}`,
  };
}

const BUILT_IN_SCENARIOS = ALL_SCENARIOS.map(normalizeBuiltInScenario);

function getScenario(id: string) {
  const scenario = BUILT_IN_SCENARIOS.find((item) => item.id === id);
  if (!scenario) throw new Error(`Scenario not found: ${id}`);
  return scenario;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = QA_STEP_TIMEOUT_MS): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function retry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }
  throw lastError;
}

function buildScenarioContext(scenario: any, currentBehaviorState: string, currentJourneyState: string, turnCount: number) {
  return {
    title: scenario.title || "",
    stakeholder: scenario.stakeholder || "",
    objective: scenario.objective || "",
    persona: scenario.persona || "time_constrained_community_doctor",
    journeyStage: scenario.journeyStage || null,
    interactionPressure: Array.isArray(scenario.interactionPressure) ? scenario.interactionPressure : [],
    startingBehaviorState: scenario.startingBehaviorState || currentBehaviorState || "neutral",
    currentBehaviorState,
    currentJourneyState,
    turnCount,
    volatilityProfile: "stable",
  };
}

function buildConversationState(scenario: any, sessionId: string, currentBehaviorState: string, currentJourneyState: string, turnCount: number) {
  return {
    sessionId,
    scenarioId: scenario.id,
    scenarioTitle: scenario.title || "",
    currentBehaviorState,
    currentJourneyState,
    turnCount,
    volatilityProfile: "stable",
    signals: [],
  };
}

async function postJson(url: string, body: any) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: response.status, ok: response.ok, json };
}

async function runBuild() {
  try {
    const { stdout, stderr } = await execFileAsync("npm", ["run", "build"], {
      cwd: REPO_ROOT,
      maxBuffer: 1024 * 1024 * 20,
    });
    return { pass: true, stdout, stderr };
  } catch (error: any) {
    return {
      pass: false,
      stdout: error?.stdout || "",
      stderr: error?.stderr || error?.message || String(error),
    };
  }
}

async function runStartupIntegrityChecks() {
  const messageListSource = await fs.readFile(path.resolve(REPO_ROOT, "src/components/simulator/MessageList.jsx"), "utf8");
  const emptyStatePresent = messageListSource.includes("The HCP is in the room. You go first.");
  const scenarioIds = [
    "builtin-the-gatekeeper-filter",
    "builtin-the-assumed-priority",
    "builtin-the-competitive-defender",
    "builtin-the-formulary-firewall",
  ];

  const scenarios = [];
  for (const id of scenarioIds) {
    const scenario = getScenario(id);
    const init = await initializeConversation(scenario);
    scenarios.push({
      scenarioId: id,
      startType: init.startType,
      hcpOpeningText: init.hcpOpeningText,
      placeholder: init.inputPlaceholder,
      pass:
        init.startType === "rep_initiated" &&
        init.hcpOpeningText === null &&
        /open the conversation/i.test(init.inputPlaceholder),
    });
  }

  return {
    emptyStatePresent,
    scenarios,
    pass: emptyStatePresent && scenarios.every((item) => item.pass),
  };
}

async function runRuntimeSanityChecks() {
  const rootResponse = await fetch(APP_BASE_URL);
  const simulatorResponse = await fetch(`${APP_BASE_URL}/simulator?scenarioId=builtin-the-gatekeeper-filter`);
  const healthResponse = await fetch(HEALTH_URL);
  const healthJson = await healthResponse.json().catch(() => null);
  const healthEndpoints = Array.isArray(healthJson?.endpoints) ? healthJson.endpoints : [];
  const healthService = String(healthJson?.service || "");

  const gatekeeper = getScenario("builtin-the-gatekeeper-filter");
  const sessionId = crypto.randomUUID();
  const currentBehaviorState = gatekeeper.startingBehaviorState || "closed";
  const currentJourneyState = gatekeeper.journeyStage;
  const startResponse = await postJson(ROLEPLAY_START_URL, {
    sessionId,
    scenarioContext: buildScenarioContext(gatekeeper, currentBehaviorState, currentJourneyState, 0),
    conversationState: buildConversationState(gatekeeper, sessionId, currentBehaviorState, currentJourneyState, 0),
  });
  const respondResponse = await postJson(ROLEPLAY_RESPOND_URL, {
    sessionId,
    repMessage: "hi dr how are you? can we speak for a few minutes?",
    scenarioContext: buildScenarioContext(gatekeeper, currentBehaviorState, currentJourneyState, 0),
    conversationState: buildConversationState(gatekeeper, sessionId, currentBehaviorState, currentJourneyState, 0),
  });

  return {
    rootStatus: rootResponse.status,
    simulatorStatus: simulatorResponse.status,
    healthStatus: healthResponse.status,
    healthJson,
    healthService,
    healthEndpoints,
    startStatus: startResponse.status,
    startBody: startResponse.json,
    respondStatus: respondResponse.status,
    respondReply: respondResponse.json?.hcpReply || "",
    respondBody: respondResponse.json,
    pass:
      rootResponse.ok &&
      simulatorResponse.ok &&
      healthResponse.ok &&
      healthService === EXPECTED_WORKER_NAME &&
      healthEndpoints.includes("/api/roleplay/start") &&
      healthEndpoints.includes("/api/roleplay/respond") &&
      startResponse.ok &&
      respondResponse.ok &&
      typeof respondResponse.json?.hcpReply === "string" &&
      respondResponse.json.hcpReply.trim().length > 0,
  };
}

async function runApiConversation(scenario: any, repMessages: string[]) {
  const sessionId = crypto.randomUUID();
  let currentBehaviorState = scenario.startingBehaviorState || "neutral";
  let currentJourneyState = scenario.journeyStage;
  const transcript: Array<{ speaker: string; text: string; turnNumber: number }> = [];

  const startResponse = await postJson(ROLEPLAY_START_URL, {
    sessionId,
    scenarioContext: buildScenarioContext(scenario, currentBehaviorState, currentJourneyState, 0),
    conversationState: buildConversationState(scenario, sessionId, currentBehaviorState, currentJourneyState, 0),
  });
  if (!startResponse.ok) {
    return {
      transcript,
      currentBehaviorState,
      currentJourneyState,
      qaAudit: null,
      error: {
        stage: "start",
        status: startResponse.status,
        body: startResponse.json,
      },
    };
  }

  for (let i = 0; i < repMessages.length; i += 1) {
    const repMessage = repMessages[i];
    transcript.push({ speaker: "rep", text: repMessage, turnNumber: transcript.length + 1 });

    const response = await postJson(ROLEPLAY_RESPOND_URL, {
      sessionId,
      repMessage,
      scenarioContext: buildScenarioContext(scenario, currentBehaviorState, currentJourneyState, i * 2),
      conversationState: buildConversationState(scenario, sessionId, currentBehaviorState, currentJourneyState, i * 2),
    });

    if (!response.ok) {
      return {
        transcript,
        currentBehaviorState,
        currentJourneyState,
        qaAudit: null,
        error: {
          stage: "respond",
          turn: i + 1,
          status: response.status,
          body: response.json,
        },
      };
    }

    const hcpReply = String(response.json?.hcpReply || "").trim();
    transcript.push({ speaker: "hcp", text: hcpReply, turnNumber: transcript.length + 1 });
    currentBehaviorState = response.json?.metadata?.nextBehaviorState || currentBehaviorState;
    currentJourneyState = response.json?.metadata?.nextJourneyState || currentJourneyState;
  }

  return {
    transcript,
    currentBehaviorState,
    currentJourneyState,
    qaAudit: buildTranscriptAudit({ scenario, turns: transcript, personaKey: "manual_check" }),
    error: null,
  };
}

function hasAbruptOpener(text = "") {
  return /^look,/i.test(text) || /\bmake it quick\b/i.test(text);
}

function hasProxyFraming(text = "") {
  return /\bmy ma said\b/i.test(text) || /\bmy office manager said\b/i.test(text) || /\byou(?:'ve| have) been trying to reach me\b/i.test(text);
}

function hasRoboticMinimalism(text = "") {
  const normalized = String(text || "").trim().toLowerCase();
  return normalized === "what's this about?"
    || normalized === "what is this about?"
    || normalized === "i've got a minute—what's this about?"
    || normalized === "i've got a minute - what's this about?"
    || normalized.split(/\s+/).filter(Boolean).length <= 5;
}

function hasIncompleteAccessLine(text = "") {
  return /\babout\.?$/i.test(text) || /\bwith\.?$/i.test(text) || /\bfor\.?$/i.test(text);
}

async function runRealismChecks() {
  const checks = [];

  const gatekeeper = await runApiConversation(getScenario("builtin-the-gatekeeper-filter"), [
    "hi dr how are you? can we speak for a few minutes?",
  ]);
  const gatekeeperFirstLine = gatekeeper.transcript.find((turn) => turn.speaker === "hcp")?.text || "";
  checks.push({
    scenarioId: "builtin-the-gatekeeper-filter",
    pass: !gatekeeper.error && !hasAbruptOpener(gatekeeperFirstLine) && !hasRoboticMinimalism(gatekeeperFirstLine),
    firstHcpLine: gatekeeperFirstLine,
    error: gatekeeper.error,
    note: "Initial-access opener should be busy but professional, not rude or flattened.",
    qaVerdict: gatekeeper.qaAudit?.verdict || null,
  });

  const assumed = await runApiConversation(getScenario("builtin-the-assumed-priority"), [
    "following up on the stay-on-therapy issue you mentioned last week",
    "what specifically are you seeing when patients fall off therapy?",
  ]);
  const assumedFirstLine = assumed.transcript.find((turn) => turn.speaker === "hcp")?.text || "";
  checks.push({
    scenarioId: "builtin-the-assumed-priority",
    pass: !assumed.error && !hasProxyFraming(assumedFirstLine) && !/my ma said|you've been trying to get in/i.test(assumedFirstLine),
    firstHcpLine: assumedFirstLine,
    error: assumed.error,
    note: "Follow-up framing should not reset to proxy or first-access language.",
    qaVerdict: assumed.qaAudit?.verdict || null,
  });

  const competitive = await runApiConversation(getScenario("builtin-the-competitive-defender"), [
    "I wanted to understand what matters most to you in the patients doing well on your current option",
    "what specifically would have to change for a switch to even feel worth discussing?",
    "if there were one patient type where the current option is less reliable, what would that look like?",
  ]);
  const competitiveFirstLine = competitive.transcript.find((turn) => turn.speaker === "hcp")?.text || "";
  checks.push({
    scenarioId: "builtin-the-competitive-defender",
    pass: !competitive.error && !hasAbruptOpener(competitiveFirstLine) && competitive.qaAudit!.failures.every((failure: any) => failure.type !== "chatbot_phrasing"),
    firstHcpLine: competitiveFirstLine,
    error: competitive.error,
    note: "Skeptical objections should sound grounded, not templated or theatrically rude.",
    qaVerdict: competitive.qaAudit?.verdict || null,
  });

  const formulary = await runApiConversation(getScenario("builtin-the-formulary-firewall"), [
    "wanted to follow up on the formulary access issue and see what options you actually have there",
    "what part of the review process tends to stall things most often?",
  ]);
  const formularyFirstLine = formulary.transcript.find((turn) => turn.speaker === "hcp")?.text || "";
  checks.push({
    scenarioId: "builtin-the-formulary-firewall",
    pass: !formulary.error &&
      !hasIncompleteAccessLine(formularyFirstLine) &&
      /\bformulary\b|\bnon-preferred\b|\bprocess\b|\bsteps?\b/i.test(formularyFirstLine),
    firstHcpLine: formularyFirstLine,
    error: formulary.error,
    note: "Access/formulary responses should be complete, process-aware clinician language.",
    qaVerdict: formulary.qaAudit?.verdict || null,
  });

  return {
    checks,
    pass: checks.every((item) => item.pass),
  };
}

function findForbiddenPatterns(contents: string) {
  const hits: string[] = [];
  if (/currentJourneyState\s*\|\|/.test(contents)) hits.push("currentJourneyState fallback via ||");
  if (/currentJourneyState\s*\?\?\s*.*journeyStage/.test(contents)) hits.push("currentJourneyState fallback via ?? journeyStage");
  if (/activePressures\s*\|\|/.test(contents)) hits.push("activePressures fallback via ||");
  if (/activePressures\s*\?\?\s*.*interactionPressure/.test(contents)) hits.push("activePressures fallback via ?? interactionPressure");
  if (/\?\?\s*["']early_discovery["']/.test(contents)) hits.push("early_discovery fallback");
  return hits;
}

async function runStateMappingChecks() {
  const simulatorSource = await fs.readFile(path.resolve(REPO_ROOT, "src/pages/Simulator.jsx"), "utf8");
  const workerClientSource = await fs.readFile(path.resolve(REPO_ROOT, "src/services/workerClient.js"), "utf8");
  const workerSource = await fs.readFile(path.resolve(REPO_ROOT, "worker/src/index.js"), "utf8");
  const scenarioCatalogSource = await fs.readFile(path.resolve(REPO_ROOT, "src/lib/scenarioCatalog.js"), "utf8");

  const journeyValues = BUILT_IN_SCENARIOS.map((scenario) => scenario.journeyStage).filter(Boolean);
  const nonCanonicalJourneyValues = [...new Set(journeyValues.filter((value) => !CANONICAL_JOURNEYS.has(String(value))))];

  const forbiddenHits = {
    simulator: findForbiddenPatterns(simulatorSource),
    workerClient: findForbiddenPatterns(workerClientSource),
    worker: findForbiddenPatterns(workerSource),
  };

  const simulatorPass =
    /showCurrentJourneyState/.test(simulatorSource) &&
    /showActivePressures/.test(simulatorSource) &&
    !forbiddenHits.simulator.length;

  const workerClientPass = !forbiddenHits.workerClient.length;
  const workerPass = !forbiddenHits.worker.length;

  return {
    nonCanonicalJourneyValues,
    forbiddenHits,
    simulatorPass,
    workerClientPass,
    workerPass,
    scenarioHasJourneyStateDuplication: /\bjourneyState:/.test(scenarioCatalogSource),
    pass: !nonCanonicalJourneyValues.length && simulatorPass && workerClientPass && workerPass,
  };
}

async function runPersonaSession(scenario: any, personaKey: PersonaKey, maxTurns: number) {
  const persona = QA_PERSONAS[personaKey];
  const convInit = await initializeConversation(scenario);

  let turns: any[] = [];
  let allSignals: any[] = [];
  let currentBehaviorState = convInit.initialBehaviorState;
  let currentJourneyState = scenario.journeyStage;
  let currentVolatilityProfile = "stable";

  for (let i = 0; i < maxTurns; i += 1) {
    const lastHcpMessage = [...turns].reverse().find((turn) => turn?.speaker === "hcp" && typeof turn?.text === "string")?.text || "";
    const lastHcpQuestionType = detectHcpQuestionType(lastHcpMessage);
    const repPrompt = `${persona.buildPrompt(scenario, turns, currentBehaviorState, currentJourneyState)}${buildRepAnswerFirstPromptConstraint(lastHcpMessage)}`;
    const repTextRaw = await retry(() => withTimeout(
      invokeWorkerText({ prompt: repPrompt, max_tokens: 180, temperature: 0.1, timeout_ms: 15000 }),
      `${scenario.title} rep turn ${i + 1}`,
    ));

    const repDraft = String(repTextRaw).trim().replace(/^(REP|Rep|rep)\s*:\s*/i, "").trim();
    let repText = buildDeterministicQaRepReply({ turns, draft: repDraft });

    if (lastHcpQuestionType === "solution_seeking") {
      repText = enforceRepAnswerFirstContract({ scenario, turns, draft: repText });
    }
    repText = normalizeDialoguePunctuation(repText);

    turns = [...turns, {
      id: crypto.randomUUID(),
      speaker: "rep",
      text: repText,
      timestamp: new Date().toISOString(),
      cues: [],
      nudge: null,
    }];

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
      repText,
      allSignals,
      i,
      currentVolatilityProfile as any,
      QA_HCP_TOKEN_CAP,
    ), `${scenario.title} hcp turn ${i + 1}`));

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

  const qaAudit = buildTranscriptAudit({ scenario, turns, personaKey });
  return { scenario, personaKey, turns, qaAudit, maxTurns };
}

async function runQaValidation() {
  const singleScenario = getScenario("builtin-the-gatekeeper-filter");
  const singleRun = await runPersonaSession(singleScenario, "strong_rep", 6);

  const matrixPlan = [
    { scenarioId: "builtin-the-gatekeeper-filter", maxTurns: 6 },
    { scenarioId: "builtin-the-assumed-priority", maxTurns: 8 },
    { scenarioId: "builtin-the-competitive-defender", maxTurns: 10 },
    { scenarioId: "builtin-the-formulary-firewall", maxTurns: 6 },
  ];

  const matrixResults = [];
  for (const plan of matrixPlan) {
    const scenario = getScenario(plan.scenarioId);
    for (const personaKey of Object.keys(QA_PERSONAS) as PersonaKey[]) {
      matrixResults.push(await runPersonaSession(scenario, personaKey, plan.maxTurns));
    }
  }

  const matrixSummary = buildMatrixAuditSummary(matrixResults);

  const badScenario = getScenario("builtin-the-gatekeeper-filter");
  const knownBadTranscript = [
    { speaker: "rep", text: "What is the biggest roadblock right now with the prior auth process?" },
    { speaker: "hcp", text: "What's the one thing that would make prior auth easier for my staff?" },
    { speaker: "rep", text: "What is the biggest roadblock or challenge right now with prior auth?" },
  ];
  const knownBadAudit = buildTranscriptAudit({
    scenario: badScenario,
    turns: knownBadTranscript,
    personaKey: "known_bad_case",
  });
  const knownBadCaught =
    knownBadAudit.verdict === "FAIL" &&
    knownBadAudit.failures.some((failure: any) =>
      ["question_obligation_failure", "conversation_stagnation", "repetition_or_looping", "continuity_break"].includes(failure.type)
    );

  const calibrationCases = runInternalAuditCalibrationCases();

  return {
    single: {
      scenarioId: singleRun.scenario.id,
      personaKey: singleRun.personaKey,
      verdict: singleRun.qaAudit.verdict,
      failures: singleRun.qaAudit.failures,
      transcript: singleRun.qaAudit.transcript,
      topCorrections: singleRun.qaAudit.topCorrections,
    },
    matrix: {
      results: matrixResults.map((result) => ({
        scenarioId: result.scenario.id,
        scenarioTitle: result.scenario.title,
        personaKey: result.personaKey,
        maxTurns: result.maxTurns,
        verdict: result.qaAudit.verdict,
        failures: result.qaAudit.failures,
      })),
      summary: matrixSummary,
    },
    knownBadCase: {
      verdict: knownBadAudit.verdict,
      caught: knownBadCaught,
      failures: knownBadAudit.failures,
      transcript: knownBadAudit.transcript,
    },
    calibrationCases,
    pass:
      Boolean(singleRun.qaAudit.transcript?.length) &&
      matrixResults.length === matrixPlan.length * Object.keys(QA_PERSONAS).length &&
      knownBadCaught &&
      calibrationCases.every((item) => item.expected === item.actual),
  };
}

function summarizeBlockingFailures(report: any) {
  const failures: string[] = [];
  if (!report.build.pass) failures.push("build failed");
  if (!report.runtime.pass) {
    failures.push("runtime endpoint sanity failed");
    if (report.runtime.healthService && report.runtime.healthService !== EXPECTED_WORKER_NAME) {
      failures.push(`wrong health service on localhost: ${report.runtime.healthService}`);
    }
    if (report.runtime.startStatus !== 200) {
      failures.push(`/api/roleplay/start returned ${report.runtime.startStatus}`);
    }
    if (report.runtime.respondStatus !== 200) {
      failures.push(`/api/roleplay/respond returned ${report.runtime.respondStatus}`);
    }
  }
  if (!report.startup.pass) failures.push("startup-mode integrity failed");
  if (!report.realism.pass) failures.push("realism regression detected");
  if (!report.stateMapping.pass) failures.push("state/mapping integrity failed");
  if (!report.qa?.pass) failures.push("QA Twin safeguard validation failed");
  if (report.realism?.fatalError) failures.push(`realism validation aborted: ${report.realism.fatalError}`);
  if (report.qa?.fatalError) failures.push(`QA validation aborted: ${report.qa.fatalError}`);

  const singleHighFailures = (report.qa?.single?.failures || []).filter((failure: any) => failure.confidence === "high");
  if (singleHighFailures.length) {
    failures.push(`single QA run has high-confidence failures: ${singleHighFailures.map((item: any) => item.type).join(", ")}`);
  }

  if (!report.qa?.knownBadCase?.caught) {
    failures.push("QA Twin missed the intentional bad transcript");
  }

  return failures;
}

async function main() {
  const report: any = {
    timestamp: new Date().toISOString(),
    appBaseUrl: APP_BASE_URL,
    identity: null,
    build: null,
    runtime: null,
    startup: null,
    realism: null,
    stateMapping: null,
    qa: null,
    finalVerdict: "NOT SAFE TO DEPLOY",
    blockingFailures: [],
  };

  report.identity = await verifyRpsIdentity();
  if (!report.identity.pass) {
    report.blockingFailures = report.identity.failures;
    report.finalVerdict = "NOT SAFE TO DEPLOY";
    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    await fs.writeFile(ARTIFACT_PATH, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({
      artifact: ARTIFACT_PATH,
      finalVerdict: report.finalVerdict,
      blockingFailures: report.blockingFailures,
      identityPass: false,
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  report.build = await runBuild();
  report.runtime = await runRuntimeSanityChecks();
  report.startup = await runStartupIntegrityChecks();
  try {
    report.realism = await runRealismChecks();
  } catch (error) {
    report.realism = {
      pass: false,
      checks: [],
      fatalError: error instanceof Error ? error.message : String(error),
    };
  }
  report.stateMapping = await runStateMappingChecks();
  try {
    report.qa = await runQaValidation();
  } catch (error) {
    report.qa = {
      pass: false,
      single: null,
      matrix: null,
      knownBadCase: { caught: false },
      calibrationCases: [],
      fatalError: error instanceof Error ? error.message : String(error),
    };
  }

  report.blockingFailures = summarizeBlockingFailures(report);
  report.finalVerdict = report.blockingFailures.length === 0 ? "SAFE TO DEPLOY" : "NOT SAFE TO DEPLOY";

  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  await fs.writeFile(ARTIFACT_PATH, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({
    artifact: ARTIFACT_PATH,
    finalVerdict: report.finalVerdict,
    blockingFailures: report.blockingFailures,
    identityPass: report.identity?.pass || false,
    buildPass: report.build.pass,
    runtimePass: report.runtime.pass,
    startupPass: report.startup.pass,
    realismPass: report.realism.pass,
    stateMappingPass: report.stateMapping.pass,
    qaPass: report.qa?.pass || false,
    knownBadCaught: report.qa?.knownBadCase?.caught || false,
  }, null, 2));

  if (report.finalVerdict !== "SAFE TO DEPLOY") {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  const fallback = {
    timestamp: new Date().toISOString(),
    finalVerdict: "NOT SAFE TO DEPLOY",
    fatalError: error instanceof Error ? error.message : String(error),
  };
  await fs.mkdir(ARTIFACT_DIR, { recursive: true }).catch(() => {});
  await fs.writeFile(ARTIFACT_PATH, JSON.stringify(fallback, null, 2)).catch(() => {});
  console.error(JSON.stringify(fallback, null, 2));
  process.exitCode = 1;
});
