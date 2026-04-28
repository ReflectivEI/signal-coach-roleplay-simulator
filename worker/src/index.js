import { HCP_REALISM_LANGUAGE_PACK, pickHcpRealismExamples, validateHcpHumanRealism } from "../../src/lib/hcpRealismLanguagePack.js";
import { EVIDENCE_ALLOWLIST } from "../../src/lib/predictiveReferences.js";

const workerImportHealth = {
  hcpRealismLanguagePack: Boolean(HCP_REALISM_LANGUAGE_PACK),
  pickHcpRealismExamples: typeof pickHcpRealismExamples === "function",
  validateHcpHumanRealism: typeof validateHcpHumanRealism === "function",
};

if (Object.values(workerImportHealth).some((value) => !value)) {
  console.error("WORKER IMPORT FAILURE", workerImportHealth);
}

const allowedMethods = "GET,POST,PUT,DELETE,OPTIONS";
const allowedHeaders = "Content-Type,Authorization";
const memoryState = {
  scenarios: [],
  sessions: [],
  evidenceRecords: [],
};
const groqKeyCooldowns = new Map();

function json(data, init = {}, request) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  return withCors(new Response(JSON.stringify(data), { ...init, headers }), request);
}

function withCors(response, request) {
  const headers = response.headers;
  const origin = request?.headers?.get("Origin") || "*";
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", allowedMethods);
  headers.set("Access-Control-Allow-Headers", allowedHeaders);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Cache-Control", "no-cache, must-revalidate");
  return response;
}

function preflight(request) {
  return withCors(new Response(null, { status: 204 }), request);
}

function safeString(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function slugify(value) {
  return safeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createId(prefix, label = "") {
  return `${prefix}-${slugify(label) || Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const allowedJourneyValues = new Set([
  "initial_access",
  "early_discovery",
  "clinical_value",
  "objection_handling",
  "access_formulary",
  "adoption_implementation",
  "commitment_close",
]);

const allowedHcpRoleTypes = new Set([
  "treating_clinician",
  "influencer",
  "thought_leader",
]);

const allowedDecisionOrientations = new Set([
  "patient_centric",
  "evidence_driven",
  "risk_averse",
  "guideline_anchored",
]);

const allowedPersonas = new Set([
  "skeptical_specialist",
  "time_constrained_community_doctor",
  "cost_focused_decision_maker",
  "curious_uncertain_adopter",
]);

const allowedBehaviorStates = new Set([
  "closed",
  "neutral",
  "open",
  "openness",
  "curiosity",
  "resistance",
  "frustration",
  "time_pressure",
]);

const allowedInteractionPressures = new Set([
  "time_constrained",
  "operationally_constrained",
  "skeptical_resistant",
  "competitive_bias",
  "safety_concern",
  "access_barrier",
  "curious_uncertain",
]);

const allowedPredictiveDiseaseStates = new Set([
  "pulmonology",
  "cardiology",
  "rheumatology",
  "neurology",
  "oncology",
  "nephrology",
  "dermatology",
  "hematology",
  "gastroenterology",
  "endocrinology",
  "primary_care",
]);

const allowedPredictiveHcpTypes = new Set([
  "treating_clinician",
  "influencer",
  "thought_leader",
]);

const allowedPredictiveJourneyStages = new Set([
  "initial_access",
  "discovery",
  "clinical_value",
  "objection_handling",
  "adoption_implementation",
  "access_formulary",
  "commitment_close",
]);

const allowedPredictiveInteractionPressures = new Set([
  "time_constrained",
  "operationally_constrained",
  "skeptical_resistant",
  "competitive_bias",
  "safety_concern",
  "access_barrier",
  "curious_uncertain",
]);

const allowedPredictiveInfluenceDrivers = new Set([
  "patient_centric",
  "evidence_driven",
  "risk_averse",
  "guideline_anchored",
]);

const allowedPredictiveBehaviorArchetypes = new Set([
  "time_constrained_community_doctor",
  "skeptical_specialist",
  "curious_uncertain_adopter",
  "cost_focused_decision_maker",
]);

const allowedFocusCapabilities = new Set([
  "question_quality",
  "listening_responsiveness",
  "making_it_matter",
  "customer_engagement_signals",
  "objection_navigation",
  "conversation_control_structure",
  "adaptability",
  "commitment_gaining",
]);

const allowedTurnSpeakers = new Set([
  "rep",
  "hcp",
  "system",
]);

const MAX_SCENARIO_COUNT = 100;
const MAX_SESSION_COUNT = 200;
const MAX_EVIDENCE_RECORD_COUNT = 1000;
const MAX_TRANSCRIPT_TURNS = 60;
const MAX_SIGNAL_ITEMS = 60;

const EVIDENCE_ALLOWLIST_BY_HOST = new Map(
  EVIDENCE_ALLOWLIST.map((source) => {
    try {
      const host = new URL(source.url).hostname.replace(/^www\./, "").toLowerCase();
      return [host, source];
    } catch {
      return null;
    }
  }).filter(Boolean),
);

function safeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function asIsoDate(value, fallback = new Date().toISOString()) {
  const candidate = safeString(value);
  if (!candidate) return fallback;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function asLimitedText(value, maxLength = 600) {
  return safeString(value).slice(0, maxLength);
}

function asStringArray(value, maxItems = 12, maxLength = 240) {
  return uniqueStrings(value).map((item) => item.slice(0, maxLength)).slice(0, maxItems);
}

function asObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function parseIsoDate(value) {
  const text = safeString(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function hostFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function computeFreshnessScore(publishedAtIso) {
  const publishedDate = parseIsoDate(publishedAtIso);
  if (!publishedDate) return 45;

  const now = Date.now();
  const ageDays = Math.floor((now - publishedDate.getTime()) / (1000 * 60 * 60 * 24));

  if (ageDays <= 30) return 100;
  if (ageDays <= 90) return 92;
  if (ageDays <= 180) return 84;
  if (ageDays <= 365) return 74;
  if (ageDays <= 730) return 62;
  return 50;
}

function normalizeEvidenceRecord(raw = {}, index = 0, ingestionMeta = {}) {
  const sourceUrl = safeString(raw.sourceUrl || raw.url);
  const sourceHost = hostFromUrl(sourceUrl);
  const allowlistEntry = EVIDENCE_ALLOWLIST_BY_HOST.get(sourceHost);
  const sourceName = safeString(raw.sourceName || raw.organization || allowlistEntry?.organization);
  const publishedAt = asIsoDate(raw.publishedAt || raw.datePublished || ingestionMeta.ingestedAt);
  const domain = safeString(raw.domain || allowlistEntry?.domain || "cross-domain");
  const title = asLimitedText(raw.title, 220);

  return {
    id: safeString(raw.id || raw.externalId) || createId("evidence", `${title || sourceName || index}`),
    title,
    summary: asLimitedText(raw.summary || raw.abstract || raw.description, 1600),
    diseaseState: safeString(raw.diseaseState),
    treatmentClass: safeString(raw.treatmentClass),
    domain,
    tags: asStringArray(raw.tags, 12, 80),
    publishedAt,
    freshnessScore: computeFreshnessScore(publishedAt),
    provenance: {
      sourceName,
      sourceUrl,
      sourceHost,
      allowlisted: Boolean(allowlistEntry),
      allowlistId: allowlistEntry?.id || "",
      sourceType: allowlistEntry?.type || safeString(raw.sourceType),
      ingestedAt: ingestionMeta.ingestedAt,
      ingestedBy: safeString(ingestionMeta.ingestedBy, "pipeline"),
    },
    metadata: {
      publisher: safeString(raw.publisher),
      year: safeString(raw.year),
      confidence: Math.max(0, Math.min(1, Number(raw.confidence ?? 0.8))),
    },
    updatedAt: ingestionMeta.ingestedAt,
  };
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => safeString(value)).filter(Boolean))];
}

function normalizePredictiveSeed(rawSeed = null, existingSeed = null) {
  const seed = asObject(rawSeed, asObject(existingSeed, null));
  if (!seed) return null;

  const normalized = {
    diseaseState: asLimitedText(seed.diseaseState, 80),
    hcpType: asLimitedText(seed.hcpType, 80),
    journeyStage: asLimitedText(seed.journeyStage, 80),
    interactionPressure: asLimitedText(seed.interactionPressure, 80),
    influenceDriver: asLimitedText(seed.influenceDriver, 80),
    behaviorArchetype: asLimitedText(seed.behaviorArchetype, 80),
  };

  const allFilled = Object.values(normalized).every(Boolean);
  if (!allFilled) return null;

  if (!allowedPredictiveDiseaseStates.has(normalized.diseaseState)) return null;
  if (!allowedPredictiveHcpTypes.has(normalized.hcpType)) return null;
  if (!allowedPredictiveJourneyStages.has(normalized.journeyStage)) return null;
  if (!allowedPredictiveInteractionPressures.has(normalized.interactionPressure)) return null;
  if (!allowedPredictiveInfluenceDrivers.has(normalized.influenceDriver)) return null;
  if (!allowedPredictiveBehaviorArchetypes.has(normalized.behaviorArchetype)) return null;

  return normalized;
}

function normalizeScenarioPayload(body = {}, existingScenario = null) {
  const journeyStage = allowedJourneyValues.has(body.journeyStage)
    ? body.journeyStage
    : existingScenario?.journeyStage || "initial_access";

  const hcpRoleType = allowedHcpRoleTypes.has(body.hcpRoleType)
    ? body.hcpRoleType
    : existingScenario?.hcpRoleType || "treating_clinician";

  const decisionOrientation = allowedDecisionOrientations.has(body.decisionOrientation)
    ? body.decisionOrientation
    : existingScenario?.decisionOrientation || "patient_centric";

  const persona = allowedPersonas.has(body.persona)
    ? body.persona
    : existingScenario?.persona || "curious_uncertain_adopter";

  const startingBehaviorState = allowedBehaviorStates.has(body.startingBehaviorState)
    ? body.startingBehaviorState
    : existingScenario?.startingBehaviorState || "neutral";

  const interactionPressure = uniqueStrings(body.interactionPressure).filter((value) => allowedInteractionPressures.has(value));
  const suggestedFocusCapabilities = uniqueStrings(body.suggestedFocusCapabilities).filter((value) => allowedFocusCapabilities.has(value));
  const keyChallenges = uniqueStrings(body.keyChallenges);
  const predictiveSeed = normalizePredictiveSeed(body.predictiveSeed, existingScenario?.predictiveSeed);

  return {
    ...existingScenario,
    ...body,
    title: safeString(body.title, existingScenario?.title || "Untitled Scenario"),
    coreTension: safeString(body.coreTension, existingScenario?.coreTension || ""),
    description: safeString(body.description, existingScenario?.description || ""),
    stakeholder: safeString(body.stakeholder, existingScenario?.stakeholder || ""),
    objective: safeString(body.objective, existingScenario?.objective || ""),
    context: safeString(body.context, existingScenario?.context || ""),
    openingScene: safeString(body.openingScene, existingScenario?.openingScene || ""),
    visualScene: safeString(body.visualScene, existingScenario?.visualScene || ""),
    journeyStage,
    hcpRoleType,
    decisionOrientation,
    persona,
    startingBehaviorState,
    interactionPressure,
    suggestedFocusCapabilities,
    keyChallenges,
    predictiveSeed,
    isBuiltIn: false,
    isPublished: body?.isPublished ?? existingScenario?.isPublished ?? true,
  };
}

function normalizeTranscriptTurn(turn = {}, index = 0) {
  const speaker = allowedTurnSpeakers.has(turn?.speaker) ? turn.speaker : "system";
  const cueItems = Array.isArray(turn?.cues) ? turn.cues : [];

  return {
    id: safeString(turn?.id) || createId(`turn-${speaker}`, `${index + 1}`),
    speaker,
    text: asLimitedText(turn?.text, 1000),
    timestamp: asIsoDate(turn?.timestamp),
    cues: cueItems.slice(0, 3).map((cue, cueIndex) => ({
      id: safeString(cue?.id) || createId("cue", `${index + 1}-${cueIndex + 1}`),
      label: asLimitedText(cue?.label, 160),
      description: asLimitedText(cue?.description, 260),
      source: asLimitedText(cue?.source, 60),
    })).filter((cue) => cue.label),
    nudge: turn?.nudge && typeof turn.nudge === "object"
      ? {
        title: asLimitedText(turn.nudge?.title, 120),
        guidance: asLimitedText(turn.nudge?.guidance, 240),
        capabilityId: asLimitedText(turn.nudge?.capabilityId, 80),
        capabilityName: asLimitedText(turn.nudge?.capabilityName, 120),
      }
      : null,
  };
}

function normalizeSignalItem(signal = {}) {
  return {
    question_type: asLimitedText(signal?.question_type, 80),
    response_alignment: asLimitedText(signal?.response_alignment, 80),
    objection_type: asLimitedText(signal?.objection_type, 80),
    engagement_level: asLimitedText(signal?.engagement_level, 80),
    control_pattern: asLimitedText(signal?.control_pattern, 80),
    listening_pattern: asLimitedText(signal?.listening_pattern, 80),
    commitment_attempt: asLimitedText(signal?.commitment_attempt, 80),
  };
}

function normalizePredictiveLens(rawLens = null) {
  const lens = asObject(rawLens, null);
  if (!lens) return null;

  const selection = asObject(lens.selection, {});
  const sections = asObject(lens.sections, {});

  return {
    selection: {
      diseaseState: asLimitedText(selection.diseaseState, 80),
      hcpType: asLimitedText(selection.hcpType, 80),
      journeyStage: asLimitedText(selection.journeyStage, 80),
      interactionPressure: asLimitedText(selection.interactionPressure, 80),
      influenceDriver: asLimitedText(selection.influenceDriver, 80),
      behaviorArchetype: asLimitedText(selection.behaviorArchetype, 80),
    },
    synthesisSource: asLimitedText(lens.synthesisSource, 32),
    synthesisError: asLimitedText(lens.synthesisError, 240),
    specialistTitle: asLimitedText(lens.specialistTitle, 140),
    sections: {
      mindset: asObject(sections.mindset, {}),
      objections: asObject(sections.objections, {}),
      responseStyle: asObject(sections.responseStyle, {}),
      repApproach: asObject(sections.repApproach, {}),
    },
    hcpPerspective: asObject(lens.hcpPerspective, {}),
    repPreparation: asObject(lens.repPreparation, {}),
  };
}

function normalizeSessionPayload(body = {}, existingSession = null) {
  const transcript = (Array.isArray(body?.transcript) ? body.transcript : existingSession?.transcript || [])
    .slice(-MAX_TRANSCRIPT_TURNS)
    .map(normalizeTranscriptTurn)
    .filter((turn) => turn.text);

  const signals = (Array.isArray(body?.signals) ? body.signals : existingSession?.signals || [])
    .slice(-MAX_SIGNAL_ITEMS)
    .map((signal) => normalizeSignalItem(asObject(signal)));

  const journeyStateCandidate = safeString(
    body?.currentJourneyState,
    safeString(existingSession?.currentJourneyState),
  );
  const currentJourneyState = allowedJourneyValues.has(journeyStateCandidate)
    ? journeyStateCandidate
    : safeString(existingSession?.currentJourneyState);

  const behaviorStateCandidate = safeString(body?.currentBehaviorState || body?.behaviorState || existingSession?.currentBehaviorState);
  const currentBehaviorState = allowedBehaviorStates.has(behaviorStateCandidate)
    ? behaviorStateCandidate
    : existingSession?.currentBehaviorState || "neutral";

  const predictiveLens = normalizePredictiveLens(body?.predictiveLens || existingSession?.predictiveLens || null);

  return {
    ...existingSession,
    id: safeString(body?.id, existingSession?.id || ""),
    scenarioId: safeString(body?.scenarioId, existingSession?.scenarioId || ""),
    scenarioTitle: safeString(body?.scenarioTitle, existingSession?.scenarioTitle || "Untitled Scenario"),
    currentJourneyState,
    currentBehaviorState,
    coachingNudgesEnabled: safeBoolean(
      body?.coachingNudgesEnabled ?? body?.coachingEnabled,
      existingSession?.coachingNudgesEnabled ?? true,
    ),
    isComplete: safeBoolean(body?.isComplete, existingSession?.isComplete ?? false),
    turnCount: Math.max(
      0,
      Math.min(
        100,
        Number.isFinite(Number(body?.turnCount))
          ? Number(body.turnCount)
          : existingSession?.turnCount ?? transcript.filter((turn) => turn.speaker === "rep").length,
      ),
    ),
    transcript,
    signals,
    review: body?.review && typeof body.review === "object" ? body.review : existingSession?.review || null,
    summary: asStringArray(body?.summary || existingSession?.summary || [], 8, 240),
    predictiveLens,
    createdAt: asIsoDate(body?.createdAt || existingSession?.createdAt),
    endedAt: body?.endedAt ? asIsoDate(body.endedAt) : existingSession?.endedAt || null,
    updatedAt: new Date().toISOString(),
  };
}

function getKv(env) {
  return env?.APP_DATA_KV || null;
}

async function readCollection(env, key) {
  const kv = getKv(env);
  if (kv) {
    const raw = await kv.get(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  }
  return [...memoryState[key]];
}

async function writeCollection(env, key, value) {
  const kv = getKv(env);
  if (kv) {
    await kv.put(key, JSON.stringify(value));
    return;
  }
  memoryState[key] = Array.isArray(value) ? [...value] : [];
}

function getLlmProvider(env, requestedProvider) {
  const openaiApiKey = env?.OPENAI_API_KEY;
  const groqApiKey = env?.GROQ_API_KEY;
  const groqApiKeys = [
    env?.GROQ_API_KEY,
    env?.GROQ_API_KEY_SB_2,
    env?.GROQ_API_KEY_SB_3,
    env?.GROQ_API_KEY_SB_4,
    env?.GROQ_API_KEY_SB_5,
  ].filter(Boolean);

  const provider = requestedProvider === "openai"
    ? "openai"
    : requestedProvider === "groq"
      ? "groq"
      : groqApiKeys.length
        ? "groq"
        : openaiApiKey
          ? "openai"
          : null;

  return { provider, openaiApiKey, groqApiKey, groqApiKeys };
}

function modelForProvider(provider, requestedModel) {
  if (requestedModel) return requestedModel;
  return provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4-turbo";
}

function llmUrlForProvider(provider) {
  return provider === "groq"
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
}

function apiKeyForProvider(provider, keys) {
  return provider === "groq" ? keys.groqApiKey : keys.openaiApiKey;
}

function extractRateLimitSignal(errorText = "") {
  const text = String(errorText || "");
  if (!/rate limit|rate_limit|rate_limit_exceeded|tokens per minute|tpm/i.test(text)) {
    return null;
  }

  const retryMatch = text.match(/try again in ([0-9.]+)s/i);
  const retryAfterSeconds = retryMatch ? Number(retryMatch[1]) : null;
  return {
    rateLimited: true,
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
  };
}

function getGroqCandidateKeys(keys) {
  return Array.isArray(keys?.groqApiKeys) ? keys.groqApiKeys.filter(Boolean) : [];
}

function getGroqCooldown(key) {
  const cooldownUntil = groqKeyCooldowns.get(key);
  if (!cooldownUntil) return 0;
  if (cooldownUntil <= Date.now()) {
    groqKeyCooldowns.delete(key);
    return 0;
  }
  return cooldownUntil;
}

function setGroqCooldown(key, retryAfterSeconds) {
  const fallbackMs = 8000;
  const retryMs = Number.isFinite(Number(retryAfterSeconds))
    ? Math.max(1000, Math.ceil(Number(retryAfterSeconds) * 1000))
    : fallbackMs;
  groqKeyCooldowns.set(key, Date.now() + retryMs);
}

function rankGroqKeys(groqKeys = []) {
  const now = Date.now();
  return groqKeys
    .map((key, index) => ({
      key,
      index,
      cooldownUntil: getGroqCooldown(key),
    }))
    .sort((a, b) => {
      const aReady = a.cooldownUntil <= now ? 0 : 1;
      const bReady = b.cooldownUntil <= now ? 0 : 1;
      if (aReady !== bReady) return aReady - bReady;
      return a.cooldownUntil - b.cooldownUntil;
    });
}

async function invokeGroqWithFailover({
  llmUrl,
  payload,
  groqKeys,
  controller,
}) {
  const errors = [];
  const rankedKeys = rankGroqKeys(groqKeys);

  for (let position = 0; position < rankedKeys.length; position += 1) {
    const { key: apiKey, index } = rankedKeys[position];
    const cooldownUntil = getGroqCooldown(apiKey);
    if (cooldownUntil > Date.now()) {
      errors.push({
        status: 429,
        details: "Key is cooling down after rate limit.",
        keyIndex: index,
        rateLimited: true,
        retryAfterSeconds: Math.ceil((cooldownUntil - Date.now()) / 1000),
        skipped: true,
      });
      continue;
    }

    const response = await fetch(llmUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (response.ok) {
      groqKeyCooldowns.delete(apiKey);
      const data = await response.json();
      return { response, data, keyIndex: index };
    }

    const errorText = await response.text();
    const rateLimit = extractRateLimitSignal(errorText);
    if (response.status === 429 || rateLimit) {
      setGroqCooldown(apiKey, rateLimit?.retryAfterSeconds);
    }
    errors.push({
      status: response.status,
      details: errorText,
      keyIndex: index,
      rateLimited: Boolean(rateLimit),
      retryAfterSeconds: rateLimit?.retryAfterSeconds ?? null,
    });

    if (!(response.status === 429 || rateLimit)) {
      return {
        response,
        data: null,
        keyIndex: index,
        terminalError: {
          status: response.status,
          details: errorText,
        },
        errors,
      };
    }
  }

  return {
    response: null,
    data: null,
    keyIndex: -1,
    exhausted: true,
    errors,
  };
}

function buildMessages({ prompt, roleplay = false, response_json_schema }) {
  if (roleplay) {
    return [{ role: "system", content: prompt }];
  }

  return [
    {
      role: "system",
      content: `You are an expert sales coach helping healthcare professionals improve their sales skills.
You provide behavioral feedback, coaching insights, scenario generation, and performance analysis.
Always respond with actionable, behavior-specific feedback.${response_json_schema ? "\nFormat your response as valid JSON matching the provided schema." : ""}`,
    },
    { role: "user", content: prompt },
  ];
}

function buildMockResponse({ response_json_schema }) {
  if (response_json_schema) {
    return {
      response: {
        hcpReply: "I need something more specific to my patients before I would consider changing anything.",
        nextBehaviorState: "neutral",
        nextJourneyState: "early_discovery",
        behaviorSignals: {
          question_type: "open_ended",
          response_alignment: "partial",
          objection_type: "none",
          engagement_level: "moderate",
          control_pattern: "balanced",
          listening_pattern: "responsive",
          commitment_attempt: "none",
        },
        coachingNudge: {
          title: "Tighten relevance",
          guidance: "Anchor your next question to this HCP's patient mix before introducing product detail.",
          capabilityId: "making_it_matter",
          capabilityName: "Value Framing",
        },
      },
      model: "mock",
      usage: { prompt_tokens: 0, completion_tokens: 0 },
      isDevelopment: true,
    };
  }

  return {
    response: "Mock AI response - configure OPENAI_API_KEY or GROQ_API_KEY in worker secrets for live model output.",
    model: "mock",
    usage: { prompt_tokens: 0, completion_tokens: 0 },
    isDevelopment: true,
  };
}

async function invokeWorkerModel(env, {
  prompt,
  max_tokens = 220,
  temperature = 0.2,
  roleplay = true,
  provider: requestedProvider,
  model: requestedModel,
}) {
  const providerKeys = getLlmProvider(env, requestedProvider);
  if (!providerKeys.provider) {
    return "I need something more specific before I can react to that.";
  }

  const provider = providerKeys.provider;
  const model = modelForProvider(provider, requestedModel);
  const llmUrl = llmUrlForProvider(provider);
  const apiKey = apiKeyForProvider(provider, providerKeys);
  const groqKeys = getGroqCandidateKeys(providerKeys);
  const messages = buildMessages({ prompt, roleplay, response_json_schema: null });
  const payload = { model, messages, temperature, max_tokens };
  const controller = new AbortController();
  const timeoutMs = Math.max(5000, Number(env?.LLM_TIMEOUT_MS || 25000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let data;
    if (provider === "groq" && groqKeys.length > 1) {
      const failoverResult = await invokeGroqWithFailover({
        llmUrl,
        payload,
        groqKeys,
        controller,
      });
      if (failoverResult?.data) {
        data = failoverResult.data;
      } else {
        return "I need something more specific before I can react to that.";
      }
    } else {
      const response = await fetch(llmUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        return "I need something more specific before I can react to that.";
      }
      data = await response.json();
    }

    return safeString(data?.choices?.[0]?.message?.content, "I need something more specific before I can react to that.");
  } finally {
    clearTimeout(timeout);
  }
}

function inferHcpCueFromReply(hcpReply = "", behaviorState = "") {
  const line = safeString(hcpReply).toLowerCase();
  if (/\bminute\b|\bbetween patients\b|\bkeep it brief\b|\bkeep it short\b|\bnext patient\b/.test(line)) return "time pressured";
  if (/\bstaff\b|\boffice\b|\bworkflow\b|\bprocess\b|\bstep\b/.test(line)) return "workflow concern";
  if (/\bprior auth\b|\bapproved\b|\bcoverage\b|\baccess\b|\bstuck\b/.test(line)) return "access friction";
  if (/\bdata\b|\bstudy\b|\bevidence\b|\bguideline\b|\bsafety\b/.test(line)) return "clinical skepticism";
  if (/\bnot yet\b|\bnot interested\b|\bi'm not there\b/.test(line) || behaviorState === "closed") return "closed";
  return behaviorState || "neutral";
}

function getNextBehaviorState({
  currentBehaviorState,
  turnCount,
  scenarioId,
}) {
  const fallback = safeString(currentBehaviorState, "neutral");
  const t = Number(turnCount || 0);

  if (scenarioId === "builtin-the-warm-intro-that-turns-cold") {
    if (t <= 0) return "neutral";
    if (t <= 2) return "slightly_impatient";
    if (t <= 4) return "guarded";
    return "skeptical";
  }

  return fallback || "neutral";
}

function deriveNextJourneyState(currentJourneyState = "", scenarioContext = {}) {
  return allowedJourneyValues.has(currentJourneyState) ? currentJourneyState : "";
}

function inferTopicFromText(text = "") {
  const normalized = safeString(text).toLowerCase();
  if (!normalized) return "";
  if (/prior auth|prior authorization|approval|paperwork|callback/.test(normalized)) return "prior_auth";
  if (/formulary|non-preferred|committee|payer/.test(normalized)) return "formulary_issue";
  if (/access|coverage|approved/.test(normalized)) return "access_issue";
  if (/workflow|staff|handoff|process|operational/.test(normalized)) return "workflow_burden";
  if (/safety|risk|hepatic|adverse|side effect/.test(normalized)) return "safety_question";
  if (/study|trial|data|evidence|guideline/.test(normalized)) return "study_follow_up";
  if (/patient|fit|subgroup|renal/.test(normalized)) return "patient_fit";
  return "";
}

function inferScenarioKeyTopic(scenarioContext = {}) {
  return (
    inferTopicFromText(safeString(scenarioContext?.objective)) ||
    inferTopicFromText(safeString(scenarioContext?.description)) ||
    inferTopicFromText(safeString(scenarioContext?.openingScene)) ||
    inferTopicFromText(uniqueStrings(scenarioContext?.interactionPressure).join(" ")) ||
    ""
  );
}

function topicLabel(topic = "") {
  switch (topic) {
    case "prior_auth":
      return "prior auth";
    case "formulary_issue":
      return "formulary access";
    case "access_issue":
      return "access";
    case "workflow_burden":
      return "workflow";
    case "safety_question":
      return "safety";
    case "study_follow_up":
      return "that study";
    case "patient_fit":
      return "patient fit";
    default:
      return "that";
  }
}

function topicPattern(topic = "") {
  switch (topic) {
    case "prior_auth":
      return /\bprior auth(?:orization)?\b|\bapproval\b|\bpaperwork\b|\bcallback\b/i;
    case "formulary_issue":
      return /\bformulary\b|\bnon-preferred\b|\bcommittee\b|\bpayer\b/i;
    case "access_issue":
      return /\baccess\b|\bcoverage\b|\bapproved\b/i;
    case "workflow_burden":
      return /\bworkflow\b|\bstaff\b|\bhandoff\b|\bprocess\b|\boperational\b/i;
    case "safety_question":
      return /\bsafety\b|\brisk\b|\badverse\b|\bside effect\b|\bhepatic\b/i;
    case "study_follow_up":
      return /\bstudy\b|\btrial\b|\bdata\b|\bevidence\b|\bguideline\b/i;
    case "patient_fit":
      return /\bpatient\b|\bfit\b|\bsubgroup\b|\brenal\b/i;
    default:
      return null;
  }
}

function extractRepOpeningContext(repMessage = "", scenarioContext = {}) {
  const text = safeString(repMessage);
  const explicitTopic = inferTopicFromText(text);
  const scenarioTopic = inferScenarioKeyTopic(scenarioContext);
  const hasPriorContextSignal = /\bfollow(?:ing)? up\b|\bwe spoke\b|\bwe talked\b|\byou mentioned\b|\bas we discussed\b|\blast week\b|\bearlier\b|\bongoing\b/i.test(text);

  let intentType = "introducing";
  if (hasPriorContextSignal) intentType = "following_up";
  else if (/\bclarify|to be clear|just to confirm\b/i.test(text)) intentType = "clarifying";
  else if (/\bstudy\b|\btrial\b|\bdata\b|\bevidence\b/i.test(text)) intentType = "bringing_study";
  else if (/\bburden\b|\bchallenge\b|\bissue\b|\bstuck\b/i.test(text)) intentType = "asking_about_burden";

  return {
    explicitTopic,
    scenarioTopic,
    hasPriorContextSignal,
    intentType,
    repIncludesScenarioTopic: Boolean(explicitTopic && scenarioTopic && explicitTopic === scenarioTopic),
  };
}

function splitFirstSentence(text = "") {
  const value = safeString(text);
  if (!value) return { firstSentence: "", remainder: "" };
  const match = value.match(/^(.+?[.!?])(\s+.*)?$/);
  if (!match) return { firstSentence: value, remainder: "" };
  return {
    firstSentence: safeString(match[1]),
    remainder: safeString(match[2]),
  };
}

function buildFirstTurnAcknowledgment({ repContext = {}, scenarioContext = {}, conversationState = {} }) {
  const topic = repContext.explicitTopic || repContext.scenarioTopic || "general";
  const label = topicLabel(topic);
  const pressures = uniqueStrings(scenarioContext?.interactionPressure).map((value) => value.toLowerCase());
  const behavior = safeString(
    scenarioContext?.currentBehaviorState || conversationState?.currentBehaviorState,
    "neutral",
  ).toLowerCase();
  const operationallyConstrained = pressures.includes("operationally_constrained");
  const timeConstrained = pressures.includes("time_constrained");
  const skeptical = pressures.includes("skeptical_resistant") || /guarded|skeptical|closed/.test(behavior);

  if (repContext.repIncludesScenarioTopic || repContext.explicitTopic) {
    if (topic === "prior_auth") {
      if (operationallyConstrained || timeConstrained) return "Yes, prior auth has been one of the bigger workflow headaches for the office lately.";
      return "Yes, prior auth has definitely been an issue on our side.";
    }
    if (topic === "formulary_issue" || topic === "access_issue") {
      return skeptical
        ? `Yes, ${label} is still where we keep getting stuck.`
        : `Yes, ${label} is still one of the main sticking points for us.`;
    }
    if (topic === "study_follow_up") {
      return repContext.hasPriorContextSignal
        ? "Yes, I'm glad you followed up on that study, because I haven't had time to go back through it."
        : "Yes, that study has still been on my mind.";
    }
    if (topic === "workflow_burden") {
      return "Yes, workflow has been one of the bigger pressure points for the office.";
    }
    if (topic === "safety_question") {
      return "Yes, safety is one of the first things I need to get clear on.";
    }
    if (topic === "patient_fit") {
      return "Yes, figuring out the right patient is still one of the harder parts here.";
    }
    return "Yes, that's still one of the issues on our side.";
  }

  if (topic === "prior_auth") return "If this is about prior auth, that's been one of the bigger workflow headaches for my staff lately.";
  if (topic === "formulary_issue" || topic === "access_issue") return `If this is about ${label}, that's where we've been getting stuck.`;
  if (topic === "study_follow_up") return "If this is about that study, I haven't had time to dig back into it.";
  if (topic === "workflow_burden") return "If this is about workflow, that's been a real pressure point for the office.";
  if (topic === "safety_question") return "If this is about safety, that's the part I need to get clear on first.";
  if (topic === "patient_fit") return "If this is about patient fit, that's still one of the harder parts to sort out.";
  return "If this is about the main issue here, that's still been a real sticking point for us.";
}

function firstSentenceNeedsAlignment(firstSentence = "", repContext = {}, turnCount = 0) {
  if (turnCount > 0) return false;

  const sentence = safeString(firstSentence);
  const topic = repContext.explicitTopic || repContext.scenarioTopic;
  const pattern = topicPattern(topic);
  const acknowledgesTopic = Boolean(pattern && pattern.test(sentence));
  const hasProxyReset =
    /\bmy ma said\b|\bmy office manager said\b|\bsomeone told me\b|\byou(?:'ve| have) been trying to reach me\b|\byou(?:'ve| have) been trying to get in\b/i.test(sentence);
  const hasGenericReset =
    /\bwhat'?s this about\b|\bwhy are you here\b|\bwhat do you need from me\b/i.test(sentence);

  if (repContext.hasPriorContextSignal && hasProxyReset) return true;
  if (repContext.repIncludesScenarioTopic && !acknowledgesTopic) return true;
  if (!repContext.repIncludesScenarioTopic && !acknowledgesTopic) return true;
  if (repContext.repIncludesScenarioTopic && hasGenericReset) return true;
  return false;
}

function enforceFirstTurnRepAcknowledgment(hcpReply = "", repMessage = "", scenarioContext = {}, conversationState = {}) {
  const turnCount = Number(conversationState?.turnCount || scenarioContext?.turnCount || 0);
  if (turnCount > 0) return safeString(hcpReply);

  const repContext = extractRepOpeningContext(repMessage, scenarioContext);
  const { firstSentence, remainder } = splitFirstSentence(hcpReply);
  if (!firstSentenceNeedsAlignment(firstSentence, repContext, turnCount)) {
    return safeString(hcpReply);
  }

  const rewrittenFirstSentence = buildFirstTurnAcknowledgment({
    repContext,
    scenarioContext,
    conversationState,
  });
  const normalizedRemainder = safeString(remainder).replace(/^\s+/, "").replace(/^(and|but)\s+/i, "");
  return normalizedRemainder ? `${rewrittenFirstSentence} ${normalizedRemainder}`.trim() : rewrittenFirstSentence;
}

function selectRoleplayRealismReferences({
  scenarioContext = {},
  journeyStage = "initial_access",
  interactionPressures = [],
  behaviorState = "",
  scenarioTopic = "",
  repIntentType = "",
  turnCount = 0,
  repMessage = "",
}) {
  const stageExamples = Array.isArray(HCP_REALISM_LANGUAGE_PACK?.journeyStage?.[journeyStage])
    ? HCP_REALISM_LANGUAGE_PACK.journeyStage[journeyStage]
    : [];
  const pressureExamples = uniqueStrings(interactionPressures)
    .flatMap((pressure) => Array.isArray(HCP_REALISM_LANGUAGE_PACK?.interactionPressure?.[pressure])
      ? HCP_REALISM_LANGUAGE_PACK.interactionPressure[pressure]
      : []);
  const selectedJourneyExamples = stageExamples.slice(0, 3);
  const selectedPressureExamples = pressureExamples.slice(0, 4);
  const calibratedExamples = pickHcpRealismExamples({
    scenario: scenarioContext,
    journeyStage,
    interactionPressures,
    behaviorState,
    scenarioTopic,
    repIntentType,
    hcpTurnCount: turnCount,
    repMessage,
  });

  return [
    ...selectedJourneyExamples,
    ...selectedPressureExamples,
    ...calibratedExamples,
  ].filter((example, index, array) => example && array.indexOf(example) === index).slice(0, 10);
}

function buildRoleplayStartPrompt({ scenarioContext = {}, conversationState = {} }) {
  const title = safeString(scenarioContext?.title, "Roleplay Scenario");
  const stakeholder = safeString(scenarioContext?.stakeholder, "HCP");
  const persona = safeString(scenarioContext?.persona, "time_constrained_community_doctor");
  const journeyStage = safeString(scenarioContext?.journeyStage, "initial_access");
  const interactionPressure = uniqueStrings(scenarioContext?.interactionPressure).join(", ") || "none";
  const startingBehaviorState = safeString(scenarioContext?.startingBehaviorState, "closed");
  const realismExamples = selectRoleplayRealismReferences({
    scenario: scenarioContext,
    journeyStage,
    interactionPressures: scenarioContext?.interactionPressure || [],
    behaviorState: startingBehaviorState,
    scenarioTopic: inferScenarioKeyTopic(scenarioContext),
    turnCount: Number(conversationState?.turnCount || 0),
  });
  const realismReferenceBlock = realismExamples.length
    ? `\nJourney-stage and pressure realism references (style only -- do not copy unless it naturally fits the live exchange):\n${realismExamples.map((example) => `- "${example}"`).join("\n")}\n`
    : "";

  return `You are generating the first spoken line from a healthcare professional in a pharma role-play simulator.
Act as a realistic HCP in the room, not a coach, narrator, or feedback writer.

Return ONE realistic HCP opening line only.

Rules:
- sound like a real clinician speaking out loud
- stay concise
- no markdown
- no stage directions
- no labels
- no more than 2 sentences
- keep natural spoken cadence
- if the persona is time constrained, sound busy but professional
- if operationally constrained, mention office/staff/process friction when relevant
- do not sound like a chatbot or training script
${realismReferenceBlock}

Scenario title: ${title}
Stakeholder: ${stakeholder}
Persona: ${persona}
Journey stage: ${journeyStage}
Interaction pressures: ${interactionPressure}
Starting behavior state: ${startingBehaviorState}
Current journey state: ${safeString(conversationState?.currentJourneyState)}

Generate the HCP opening line now.`;
}

function buildRoleplayRespondPrompt({ repMessage = "", scenarioContext = {}, conversationState = {} }) {
  const title = safeString(scenarioContext?.title, "Roleplay Scenario");
  const stakeholder = safeString(scenarioContext?.stakeholder, "HCP");
  const objective = safeString(scenarioContext?.objective);
  const persona = safeString(scenarioContext?.persona, "time_constrained_community_doctor");
  const journeyStage = safeString(scenarioContext?.journeyStage, "initial_access");
  const interactionPressure = uniqueStrings(scenarioContext?.interactionPressure).join(", ") || "none";
  const currentBehaviorState = safeString(scenarioContext?.currentBehaviorState || conversationState?.currentBehaviorState, "neutral");
  const currentJourneyState = safeString(conversationState?.currentJourneyState);
  const turnCount = Number(conversationState?.turnCount || scenarioContext?.turnCount || 0);
  const signals = Array.isArray(conversationState?.signals) ? conversationState.signals.slice(-4) : [];
  const scenarioId = safeString(conversationState?.scenarioId || scenarioContext?.scenarioId, "");
  const repContext = extractRepOpeningContext(repMessage, scenarioContext);
  const realismExamples = selectRoleplayRealismReferences({
    scenario: scenarioContext,
    journeyStage,
    interactionPressures: scenarioContext?.interactionPressure || [],
    behaviorState: currentBehaviorState,
    scenarioTopic: repContext.explicitTopic || repContext.scenarioTopic,
    repIntentType: repContext.intentType,
    turnCount,
    repMessage,
  });
  const realismReferenceBlock = realismExamples.length
    ? `
Journey-stage and pressure realism references (style only -- do not copy verbatim unless they naturally fit the live exchange):
${realismExamples.map((example) => `- "${example}"`).join("\n")}
`
    : "";
  const firstTurnTopicRule = turnCount <= 0
    ? `
First HCP response contract:
- your first sentence MUST react to what the rep actually said
- if the rep did NOT explicitly mention the key topic, name the key topic in the first sentence
- if the rep DID mention the key topic, acknowledge that same topic naturally in the first sentence
- do NOT reset into generic first-access dialogue if the rep already gave context
- do NOT use proxy framing like "My MA said..." or "You've been trying to get in" when the rep already established context
- keep the acknowledgment human, brief, and pressure-aware

Rep opening context:
- explicit topic: ${repContext.explicitTopic || "none"}
- scenario key topic: ${repContext.scenarioTopic || "none"}
- prior context implied: ${repContext.hasPriorContextSignal ? "yes" : "no"}
- rep intent: ${repContext.intentType}
`
    : "";
  const warmIntroToneBlock = scenarioId === "builtin-the-warm-intro-that-turns-cold"
    ? `
Warm Intro Turns Cold tone calibration:
- Turn 1: busy but still professional and polite
- Turn 2: less warm and more selective, but not rude
- Turn 3: guarded and questioning relevance
- Turn 4+: skeptical and resistant, but still clinician-professional
- Do not snap, bark, or sound theatrically hostile early
- Avoid lines like "Look, I've got patients waiting" or "Just say it"
`
    : "";

  return `You are playing the HCP in a pharma role-play simulator.

Your task:
- reply as the HCP to the rep's most recent line
- keep it realistic, spoken, and specific
- return ONE HCP reply only
- act as the HCP, not a coach, evaluator, or assistant

Rules:
- no markdown
- no labels
- no stage directions
- no more than 2 sentences
- do not sound polished or generic
- if time constrained, sound busy or selective
- if operationally constrained, talk about staff, office, workflow, process, or what step changes
- if access constrained, mention approval, coverage, prior auth, delays, or what gets stuck
- preserve skepticism when appropriate
- do not invent clinical claims
- keep emotional temperature realistic: busy, cooling, guarded, skeptical
- sound professionally constrained, not socially rude
${realismReferenceBlock}

Scenario: ${title}
Stakeholder: ${stakeholder}
Objective: ${objective}
Persona: ${persona}
Journey stage: ${journeyStage}
Current journey state: ${currentJourneyState}
Current behavior state: ${currentBehaviorState}
Interaction pressures: ${interactionPressure}
Turn count: ${turnCount}
Recent signals: ${signals.length ? JSON.stringify(signals) : "none"}
${firstTurnTopicRule}
${warmIntroToneBlock}

Rep said:
"${repMessage}"

Return the HCP reply now.`;
}

function buildRoleplayMetadata({ hcpReply, scenarioContext, conversationState }) {
  const currentBehaviorState = safeString(
    scenarioContext?.currentBehaviorState || conversationState?.currentBehaviorState,
    "neutral",
  );
  const scenarioId = safeString(
    conversationState?.scenarioId || scenarioContext?.scenarioId,
    "",
  );
  const turnCount = Number(conversationState?.turnCount || scenarioContext?.turnCount || 0);

  const nextBehaviorState = getNextBehaviorState({
    currentBehaviorState,
    turnCount,
    scenarioId,
  });
  const nextJourneyState = deriveNextJourneyState(
    safeString(conversationState?.currentJourneyState),
    scenarioContext,
  );
  const hcpCue = inferHcpCueFromReply(hcpReply, nextBehaviorState);

  return {
    hcpCue,
    nextBehaviorState,
    nextJourneyState,
    realism: {
      rewrittenLine: hcpReply,
    },
  };
}

function normalizeRoleplayEntryTone(hcpReply = "", scenarioContext = {}, conversationState = {}) {
  const text = safeString(hcpReply);
  if (!text) return text;

  const journeyStage = safeString(scenarioContext?.journeyStage);
  const turnCount = Number(conversationState?.turnCount || scenarioContext?.turnCount || 0);
  const pressures = uniqueStrings(scenarioContext?.interactionPressure).join(" ").toLowerCase();

  let normalized = text
    .replace(
      /^you'?re following up on (?:that|the) study[^,]*,\s*i remember you dropping it off,?\s*(.*)$/i,
      (_, rest) => `I remember the study you dropped off.${rest ? ` ${safeString(rest)}` : ""}`,
    )
    .replace(
      /^you'?re following up on (?:that|the) study you dropped off last week,?\s*(.*)$/i,
      (_, rest) => `I remember the study you dropped off.${rest ? ` ${safeString(rest)}` : ""}`,
    )
    .replace(
      /^you'?re following up on (?:that|the) study you dropped off,?\s*(.*)$/i,
      (_, rest) => `I remember the study you dropped off.${rest ? ` ${safeString(rest)}` : ""}`,
    )
    .replace(
      /^you'?re following up on (?:that|the) study,?\s*(.*)$/i,
      (_, rest) => `I remember that study.${rest ? ` ${safeString(rest)}` : ""}`,
    )
    .replace(/^look,\s*/i, "")
    .replace(/\bcan you make it quick\b/i, "can you give me the short version")
    .replace(/\bmake it quick\b/i, "keep it brief");

  normalized = normalized
    .replace(
      /^(I remember[^.?!]{0,140}),\s*(I(?:'ve| have) got[^,]{3,120}),\s*(what'?s|why|how|where|when|who|can we)\b/i,
      "$1. $2, so $3",
    )
    .replace(
      /^(I(?:'ve| have) got[^.?!]{0,120}),\s*(what'?s|why|how|where|when|who|can we)\b/i,
      "$1, so $2",
    )
    .replace(/that'?s usually not where it breaks for us\.\s*But to be honest,\s*/gi, "that's usually not where we get stuck, and ")
    .replace(/\.\s*But to be honest,\s*/g, ". To be honest, ")
    .replace(/\byet,\s*what specifically\b/gi, "yet. What specifically")
    .replace(/\.\s*but\b/gi, ". But")
    .replace(/\.\s*and\b/gi, ". And");

  if (turnCount <= 0 && /^I remember that study\.?$/i.test(safeString(normalized))) {
    if (/time_constrained|operationally_constrained/.test(pressures)) {
      normalized = "I remember that study. I've only got a minute, so what's the key point that would help my staff or patients today?";
    } else {
      normalized = "I remember that study. What's the key takeaway you want me to apply for patients?";
    }
  }

  if (turnCount <= 0 && /^I remember the study you dropped off\.?$/i.test(safeString(normalized))) {
    if (/time_constrained|operationally_constrained/.test(pressures)) {
      normalized = "I remember the study you dropped off. I've only got a minute, so what's the key point that would help my staff or patients today?";
    } else {
      normalized = "I remember the study you dropped off. What's the key takeaway you want me to apply for patients?";
    }
  }

  if (journeyStage !== "initial_access" || turnCount > 1) {
    return safeString(normalized);
  }

  if (/slammed today|waiting room full of patients/i.test(normalized)) {
    normalized = "I've got a couple minutes before my next patient, so what's this about?";
  }

  if (
    /time_constrained/.test(pressures) &&
    /operationally_constrained/.test(pressures) &&
    /what's this about\??$/i.test(normalized)
  ) {
    normalized = "I've got a couple minutes before my next patient, so what's this about? We're short staffed today, so I need the short version.";
  }

  return safeString(normalized);
}

function splitRoleplaySentences(text = "") {
  return safeString(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function deterministicRoleplayPick(options = [], seed = "") {
  if (!Array.isArray(options) || !options.length) return "";
  const score = Array.from(String(seed || "")).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return options[score % options.length];
}

function enforceNonTrivialFirstTurnReply(text = "", scenarioContext = {}, conversationState = {}, repMessage = "") {
  let line = safeString(text)
    .replace(/that's usually not where it breaks for us/gi, "that's usually not where we get stuck")
    .replace(/\.\s*But to be honest,\s*/g, ". To be honest, ")
    .replace(/^I remember that study\.\s*you left with me last week,?\s*/i, "I remember the study you left with me last week. ")
    .replace(/^I remember that study\.\s*You left here last week,\s*/i, "I remember the study you left last week. ")
    .replace(/([.?!]\s+)([a-z])/g, (_, punct, char) => `${punct}${char.toUpperCase()}`);
  const turnCount = Number(conversationState?.turnCount || scenarioContext?.turnCount || 0);
  if (!line || turnCount > 0) return line;

  const pressures = uniqueStrings(scenarioContext?.interactionPressure).join(" ").toLowerCase();
  const highPressure = /time_constrained|operationally_constrained/.test(pressures);

  if (/^I remember that study\.?$/i.test(line) || /^I remember the study you dropped off\.?$/i.test(line)) {
    if (highPressure) {
      return "I remember the study you dropped off. I've only got a minute, so what's the key point that would help my staff or patients today?";
    }
    return "I remember the study you dropped off. What's the key takeaway you want me to apply for patients?";
  }

  return line;
}

export function addHcpMicroAcknowledgment(text = "", context = {}) {
  const base = safeString(text);
  if (!base) return base;
  if (/^(okay|alright|i hear you|got it|fair|sure|that's fine|look|honestly)[—-]/i.test(base)) {
    return base;
  }
  if (/^(i have|i've got|we've got|i'm|we're|this is|that's|it is|it’s)/i.test(base)) {
    return base;
  }
  if (/^(scene|system|feedback|coaching)\s*:/i.test(base)) {
    return base;
  }
  if (!/^(what|how|why|where|which|so what|tell me|walk me through)\b/i.test(base)) {
    return base;
  }

  const {
    journeyStage = "",
    activePressures = [],
    behaviorState = "",
    transcript = [],
    repMessage = "",
  } = context;

  const pressures = uniqueStrings(activePressures).map((value) => value.toLowerCase());
  const seed = `${journeyStage}|${behaviorState}|${pressures.join("|")}|${transcript.length}|${repMessage}|${base}`;

  let bridgePool = ["Okay"];
  if (pressures.includes("time_constrained")) {
    bridgePool = ["Okay", "Alright", "Got it"];
  } else if (pressures.includes("skeptical_resistant")) {
    bridgePool = ["I hear you", "Fair", "That's fine"];
  } else if (pressures.includes("operationally_constrained")) {
    bridgePool = ["Okay", "Got it", "I hear you"];
  } else if (pressures.includes("access_barrier") || journeyStage === "access_formulary") {
    bridgePool = ["Fair", "Okay", "I hear you"];
  } else if (pressures.includes("curious_uncertain")) {
    bridgePool = ["Okay", "Sure", "Alright"];
  }

  const bridge = deterministicRoleplayPick(bridgePool, seed) || "Okay";
  return `${bridge}—${base.charAt(0).toLowerCase()}${base.slice(1)}`;
}

function varyHcpSentenceStructure(text = "", context = {}) {
  const base = safeString(text);
  if (!base) return base;

  const {
    journeyStage = "",
    interactionPressures = [],
    transcript = [],
    turnCount = 0,
  } = context;

  const pressures = uniqueStrings(interactionPressures).map((value) => value.toLowerCase());
  const seed = `${journeyStage}|${pressures.join("|")}|${turnCount}|${transcript.length}|${base}`;
  const skeptical = pressures.includes("skeptical_resistant");
  const timeConstrained = pressures.includes("time_constrained");
  let sentences = splitRoleplaySentences(base);

  if (!sentences.length) return base;

  let first = sentences[0]
    .replace(/^What specifically\b/i, deterministicRoleplayPick([
      "So what actually",
      "Walk me through what",
      "Okay... what actually",
    ], `${seed}|specific`))
    .replace(/^What exactly\b/i, deterministicRoleplayPick([
      "So what exactly",
      "Okay... what exactly",
      "Walk me through what exactly",
    ], `${seed}|exactly`))
    .replace(/^What changes\b/i, deterministicRoleplayPick([
      "So what actually changes",
      "Walk me through what's different",
      "Okay... so what changes",
    ], `${seed}|changes`));

  if (skeptical && !/\bnot convinced yet\b|\bthat's usually not where it breaks\b/i.test(first)) {
    first = deterministicRoleplayPick([
      `${first} I'm not convinced yet.`,
      `${first} That's usually not where it breaks for us.`,
    ], `${seed}|skeptical`);
    sentences = splitRoleplaySentences(first).concat(sentences.slice(1));
  } else {
    sentences[0] = first;
  }

  if (timeConstrained) {
    return safeString(sentences[0]);
  }

  return safeString(sentences.join(" "));
}

async function handleRoleplayStart(request, env) {
  const body = await request.json().catch(() => ({}));
  const scenarioContext = asObject(body?.scenarioContext);
  const conversationState = asObject(body?.conversationState);
  const sessionId = safeString(body?.sessionId, createId("roleplay-session", scenarioContext?.title || "session"));

  const rawHcpReply = await invokeWorkerModel(env, {
    prompt: buildRoleplayStartPrompt({ scenarioContext, conversationState }),
    max_tokens: 180,
    temperature: 0.2,
    roleplay: true,
    provider: "groq",
  });
  const hcpReply = validateHcpHumanRealism(
    normalizeRoleplayEntryTone(rawHcpReply, scenarioContext, conversationState),
    {
      scenario: scenarioContext,
      repMessage: "",
      interactionPressures: scenarioContext?.interactionPressure || [],
      behaviorState: scenarioContext?.startingBehaviorState || conversationState?.currentBehaviorState || "closed",
      turnCount: Number(conversationState?.turnCount || 0),
      hasPriorContextSignal: false,
    },
  ).text;
  let variedReply = validateHcpHumanRealism(
    addHcpMicroAcknowledgment(varyHcpSentenceStructure(hcpReply, {
      journeyStage: scenarioContext?.journeyStage,
      interactionPressures: scenarioContext?.interactionPressure || [],
      transcript: [],
      turnCount: Number(conversationState?.turnCount || 0),
    }), {
      journeyStage: scenarioContext?.journeyStage,
      activePressures: scenarioContext?.interactionPressure || [],
      behaviorState: scenarioContext?.startingBehaviorState || conversationState?.currentBehaviorState || "closed",
      transcript: [],
      repMessage: "",
    }),
    {
      scenario: scenarioContext,
      repMessage: "",
      interactionPressures: scenarioContext?.interactionPressure || [],
      behaviorState: scenarioContext?.startingBehaviorState || conversationState?.currentBehaviorState || "closed",
      turnCount: Number(conversationState?.turnCount || 0),
      hasPriorContextSignal: false,
    },
  ).text;
  variedReply = enforceNonTrivialFirstTurnReply(variedReply, scenarioContext, conversationState, "");
  const metadata = buildRoleplayMetadata({ hcpReply: variedReply, scenarioContext, conversationState });

  return json({
    sessionId,
    hcpReply: variedReply,
    metadata,
  }, {}, request);
}

async function handleRoleplayRespond(request, env) {
  const body = await request.json().catch(() => ({}));
  const scenarioContext = asObject(body?.scenarioContext);
  const conversationState = asObject(body?.conversationState);
  const repMessage = asLimitedText(body?.repMessage, 2000);
  const sessionId = safeString(body?.sessionId, createId("roleplay-session", scenarioContext?.title || "session"));

  if (!repMessage) {
    return json({ error: "repMessage is required" }, { status: 400 }, request);
  }

  const rawHcpReply = await invokeWorkerModel(env, {
    prompt: buildRoleplayRespondPrompt({ repMessage, scenarioContext, conversationState }),
    max_tokens: 220,
    temperature: 0.2,
    roleplay: true,
    provider: "groq",
  });
  const hcpReply = normalizeRoleplayEntryTone(
    enforceFirstTurnRepAcknowledgment(rawHcpReply, repMessage, scenarioContext, conversationState),
    scenarioContext,
    conversationState,
  );
  const validatedReply = validateHcpHumanRealism(hcpReply, {
    scenario: scenarioContext,
    repMessage,
    interactionPressures: scenarioContext?.interactionPressure || [],
    behaviorState: scenarioContext?.currentBehaviorState || conversationState?.currentBehaviorState || "neutral",
    turnCount: Number(conversationState?.turnCount || 0),
    hasPriorContextSignal: extractRepOpeningContext(repMessage, scenarioContext).hasPriorContextSignal,
  }).text;
  let variedReply = validateHcpHumanRealism(
    addHcpMicroAcknowledgment(varyHcpSentenceStructure(validatedReply, {
      journeyStage: scenarioContext?.journeyStage,
      interactionPressures: scenarioContext?.interactionPressure || [],
      transcript: conversationState?.transcript || [],
      turnCount: Number(conversationState?.turnCount || 0),
    }), {
      journeyStage: scenarioContext?.journeyStage,
      activePressures: scenarioContext?.interactionPressure || [],
      behaviorState: scenarioContext?.currentBehaviorState || conversationState?.currentBehaviorState || "neutral",
      transcript: conversationState?.transcript || [],
      repMessage,
    }),
    {
      scenario: scenarioContext,
      repMessage,
      interactionPressures: scenarioContext?.interactionPressure || [],
      behaviorState: scenarioContext?.currentBehaviorState || conversationState?.currentBehaviorState || "neutral",
      turnCount: Number(conversationState?.turnCount || 0),
      hasPriorContextSignal: extractRepOpeningContext(repMessage, scenarioContext).hasPriorContextSignal,
    },
  ).text;
  variedReply = enforceNonTrivialFirstTurnReply(variedReply, scenarioContext, conversationState, repMessage);
  const metadata = buildRoleplayMetadata({ hcpReply: variedReply, scenarioContext, conversationState });

  return json({
    sessionId,
    hcpReply: variedReply,
    metadata,
  }, {}, request);
}

async function handleLlmInvoke(request, env) {
  const body = await request.json().catch(() => ({}));
  const {
    prompt,
    response_json_schema,
    max_tokens = 2000,
    temperature = 0.2,
    roleplay = false,
    provider: requestedProvider,
    model: requestedModel,
  } = body;

  if (!safeString(prompt)) {
    return json({ error: "Missing prompt field" }, { status: 400 }, request);
  }

  const providerKeys = getLlmProvider(env, requestedProvider);
  if (!providerKeys.provider) {
    return json(buildMockResponse({ response_json_schema }), {}, request);
  }

  const provider = providerKeys.provider;
  const model = modelForProvider(provider, requestedModel);
  const llmUrl = llmUrlForProvider(provider);
  const apiKey = apiKeyForProvider(provider, providerKeys);
  const groqKeys = getGroqCandidateKeys(providerKeys);
  const messages = buildMessages({ prompt, roleplay, response_json_schema });

  const payload = { model, messages, temperature, max_tokens };
  if (response_json_schema) payload.response_format = { type: "json_object" };

  const controller = new AbortController();
  const timeoutMs = Math.max(5000, Number(env?.LLM_TIMEOUT_MS || 25000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let data;
    let usedKeyIndex = 0;

    if (provider === "groq" && groqKeys.length > 1) {
      const failoverResult = await invokeGroqWithFailover({
        llmUrl,
        payload,
        groqKeys,
        controller,
      });

      if (failoverResult?.terminalError) {
        return json({
          error: "LLM_SERVICE_UNAVAILABLE",
          details: failoverResult.terminalError.details,
          provider,
          model,
          keyIndex: failoverResult.keyIndex,
          keyPoolSize: groqKeys.length,
        }, { status: failoverResult.terminalError.status }, request);
      }

      if (failoverResult?.exhausted) {
        const lastError = failoverResult.errors[failoverResult.errors.length - 1];
        return json({
          error: "LLM_SERVICE_UNAVAILABLE",
          details: lastError?.details || "All Groq keys exhausted by rate limits.",
          provider,
          model,
          keyIndex: lastError?.keyIndex ?? -1,
          keyPoolSize: groqKeys.length,
          failoverExhausted: true,
          keyErrors: failoverResult.errors.map((entry) => ({
            status: entry.status,
            keyIndex: entry.keyIndex,
            rateLimited: entry.rateLimited,
            retryAfterSeconds: entry.retryAfterSeconds,
          })),
        }, { status: lastError?.status || 429 }, request);
      }

      data = failoverResult.data;
      usedKeyIndex = failoverResult.keyIndex;
    } else {
      const response = await fetch(llmUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return json({
          error: "LLM_SERVICE_UNAVAILABLE",
          details: errorText,
          provider,
          model,
          keyIndex: provider === "groq" ? 0 : null,
          keyPoolSize: provider === "groq" ? groqKeys.length || 1 : null,
        }, { status: response.status }, request);
      }

      data = await response.json();
    }

    const content = data?.choices?.[0]?.message?.content ?? "";
    let parsedResponse = content;

    if (response_json_schema) {
      try {
        parsedResponse = JSON.parse(content);
      } catch {
        parsedResponse = content;
      }
    }

    return json({
      response: parsedResponse,
      provider,
      model,
      keyIndex: provider === "groq" ? usedKeyIndex : null,
      keyPoolSize: provider === "groq" ? groqKeys.length || 1 : null,
      usage: data?.usage || { prompt_tokens: 0, completion_tokens: 0 },
    }, {}, request);
  } catch (error) {
    const details = error?.name === "AbortError" ? "Request timed out." : safeString(error?.message, "fetch_failed");
    return json({
      error: "LLM_SERVICE_UNAVAILABLE",
      details,
      provider,
      model,
    }, { status: 503 }, request);
  } finally {
    clearTimeout(timeout);
  }
}

async function handleScenarios(request, env) {
  const key = "scenarios";

  if (request.method === "GET") {
    const scenarios = await readCollection(env, key);
    return json({ scenarios }, {}, request);
  }

  const body = await request.json().catch(() => ({}));

  if (request.method === "POST") {
    const scenarios = await readCollection(env, key);
    const scenario = {
      ...normalizeScenarioPayload(body),
      id: safeString(body.id) || createId("custom", body.title),
      createdAt: body?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = [scenario, ...scenarios.filter((item) => item.id !== scenario.id)].slice(0, MAX_SCENARIO_COUNT);
    await writeCollection(env, key, next);
    return json({ success: true, scenario }, { status: 201 }, request);
  }

  if (request.method === "PUT") {
    const scenarios = await readCollection(env, key);
    const index = scenarios.findIndex((item) => item.id === body.id);
    if (index < 0) {
      return json({ error: "Scenario not found" }, { status: 404 }, request);
    }
    const scenario = {
      ...normalizeScenarioPayload(body, scenarios[index]),
      id: scenarios[index].id,
      updatedAt: new Date().toISOString(),
    };
    scenarios[index] = scenario;
    await writeCollection(env, key, scenarios);
    return json({ success: true, scenario }, {}, request);
  }

  if (request.method === "DELETE") {
    const scenarios = await readCollection(env, key);
    const next = scenarios.filter((item) => item.id !== body.id);
    await writeCollection(env, key, next);
    return json({ success: true }, {}, request);
  }

  return json({ error: "Method not allowed" }, { status: 405 }, request);
}

async function handleSessions(request, env) {
  const key = "sessions";

  if (request.method === "GET") {
    const sessions = await readCollection(env, key);
    const url = new URL(request.url);
    const requestedId = safeString(url.searchParams.get("id"));
    if (requestedId) {
      const session = sessions.find((item) => item.id === requestedId) || null;
      return json({ session }, {}, request);
    }
    return json({ sessions }, {}, request);
  }

  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const sessions = await readCollection(env, key);
    const existingSession = sessions.find((item) => item.id === body?.id) || null;
    const session = normalizeSessionPayload({
      ...body,
      id: safeString(body.id) || createId("session", body.scenarioTitle || body.scenarioId),
      createdAt: body?.createdAt || existingSession?.createdAt || new Date().toISOString(),
    }, existingSession);
    const next = [session, ...sessions.filter((item) => item.id !== session.id)].slice(0, MAX_SESSION_COUNT);
    await writeCollection(env, key, next);
    return json({ success: true, session }, { status: 201 }, request);
  }

  if (request.method === "PUT") {
    const body = await request.json().catch(() => ({}));
    const sessions = await readCollection(env, key);
    const index = sessions.findIndex((item) => item.id === body.id);
    if (index < 0) {
      return json({ error: "Session not found" }, { status: 404 }, request);
    }

    const session = normalizeSessionPayload(body, sessions[index]);
    sessions[index] = session;
    await writeCollection(env, key, sessions);
    return json({ success: true, session }, {}, request);
  }

  if (request.method === "DELETE") {
    const body = await request.json().catch(() => ({}));
    const sessions = await readCollection(env, key);
    const next = sessions.filter((item) => item.id !== body.id);
    await writeCollection(env, key, next);
    return json({ success: true }, {}, request);
  }

  return json({ error: "Method not allowed" }, { status: 405 }, request);
}

async function handleEvidenceSources(request) {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, { status: 405 }, request);
  }

  return json({
    sources: EVIDENCE_ALLOWLIST,
    total: EVIDENCE_ALLOWLIST.length,
  }, {}, request);
}

async function handleEvidenceRecords(request, env) {
  const key = "evidenceRecords";

  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, { status: 405 }, request);
  }

  const records = await readCollection(env, key);
  const url = new URL(request.url);
  const requestedDomain = safeString(url.searchParams.get("domain"));
  const requestedDisease = safeString(url.searchParams.get("diseaseState"));
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));

  const filtered = records
    .filter((record) => (requestedDomain ? record?.domain === requestedDomain : true))
    .filter((record) => (requestedDisease ? record?.diseaseState === requestedDisease : true))
    .sort((left, right) => {
      const leftScore = Number(left?.freshnessScore || 0);
      const rightScore = Number(right?.freshnessScore || 0);
      return rightScore - leftScore;
    })
    .slice(0, limit);

  return json({
    records: filtered,
    total: filtered.length,
  }, {}, request);
}

async function handleEvidenceIngest(request, env) {
  const key = "evidenceRecords";

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 }, request);
  }

  const body = await request.json().catch(() => ({}));
  const recordsInput = Array.isArray(body?.records) ? body.records : [];

  if (!recordsInput.length) {
    return json({ error: "No evidence records provided" }, { status: 400 }, request);
  }

  const existing = await readCollection(env, key);
  const ingestedAt = new Date().toISOString();
  const ingestionMeta = {
    ingestedAt,
    ingestedBy: safeString(body?.ingestedBy, "pipeline"),
  };

  const rejected = [];
  const accepted = [];

  for (let index = 0; index < recordsInput.length; index += 1) {
    const normalized = normalizeEvidenceRecord(asObject(recordsInput[index]), index, ingestionMeta);
    if (!normalized.provenance.allowlisted) {
      rejected.push({
        index,
        reason: "source_not_allowlisted",
        sourceUrl: normalized.provenance.sourceUrl,
      });
      continue;
    }

    if (!normalized.title || !normalized.summary) {
      rejected.push({
        index,
        reason: "missing_required_fields",
      });
      continue;
    }

    accepted.push(normalized);
  }

  const byId = new Map(existing.map((record) => [record.id, record]));
  for (const record of accepted) {
    byId.set(record.id, {
      ...byId.get(record.id),
      ...record,
    });
  }

  const next = [...byId.values()]
    .sort((left, right) => String(right?.updatedAt || "").localeCompare(String(left?.updatedAt || "")))
    .slice(0, MAX_EVIDENCE_RECORD_COUNT);

  await writeCollection(env, key, next);

  return json({
    success: true,
    ingestedCount: accepted.length,
    records: accepted,
    rejected,
    totalStored: next.length,
  }, { status: 201 }, request);
}

function handleHealth(env, request) {
  const { provider, openaiApiKey, groqApiKey, groqApiKeys } = getLlmProvider(env);
  return json({
    status: "ok",
    ready: true,
    timestamp: new Date().toISOString(),
    service: "reflectivai-rps-api",
    provider: provider || "mock",
    storage: {
      provider: getKv(env) ? "cloudflare_kv" : "memory_fallback",
    },
    providersConfigured: {
      openai: Boolean(openaiApiKey),
      groq: Boolean(groqApiKey),
    },
    keyPools: {
      groq: groqApiKeys?.length || 0,
    },
    endpoints: [
      "/health",
      "/api/llm/invoke",
      "/api/scenarios",
      "/api/roleplay/sessions",
      "/api/roleplay/start",
      "/api/roleplay/respond",
      "/api/evidence/sources",
      "/api/evidence/records",
      "/api/evidence/ingest",
    ],
  }, {}, request);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (request.method === "OPTIONS") {
        return preflight(request);
      }

      if (url.pathname === "/health" && request.method === "GET") {
        return handleHealth(env, request);
      }

      if (url.pathname === "/api/llm/invoke" && request.method === "POST") {
        return handleLlmInvoke(request, env);
      }

      if (url.pathname === "/api/scenarios") {
        return handleScenarios(request, env);
      }

      if (url.pathname === "/api/roleplay/sessions") {
        return handleSessions(request, env);
      }

      if (url.pathname === "/api/roleplay/start" && request.method === "POST") {
        try {
          return await handleRoleplayStart(request, env);
        } catch (error) {
          return json({ error: "fallback", details: String(error?.message || error || "unknown") }, { status: 200 }, request);
        }
      }

      if (url.pathname === "/api/roleplay/respond" && request.method === "POST") {
        try {
          return await handleRoleplayRespond(request, env);
        } catch (error) {
          return json({ error: "fallback", details: String(error?.message || error || "unknown") }, { status: 200 }, request);
        }
      }

      if (url.pathname === "/api/evidence/sources") {
        return handleEvidenceSources(request);
      }

      if (url.pathname === "/api/evidence/records") {
        return handleEvidenceRecords(request, env);
      }

      if (url.pathname === "/api/evidence/ingest") {
        return handleEvidenceIngest(request, env);
      }

      return json({ error: "Not found" }, { status: 404 }, request);
    } catch (error) {
      return withCors(
        new Response(JSON.stringify({ error: "fallback", details: String(error?.message || error || "unknown") }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
        request,
      );
    }
  },
};
