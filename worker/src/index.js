const allowedMethods = "GET,POST,PUT,DELETE,OPTIONS";
const allowedHeaders = "Content-Type,Authorization";
const memoryState = {
  scenarios: [],
  sessions: [],
};

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

const allowedJourneyStages = new Set([
  "initial_access",
  "discovery",
  "clinical_value",
  "objection_handling",
  "access_formulary",
  "adoption_implementation",
  "commitment_close",
]);

const journeyStateForStage = {
  initial_access: "early_discovery",
  discovery: "early_discovery",
  clinical_value: "clinical_evaluation",
  objection_handling: "objection_phase",
  access_formulary: "access_formulary",
  adoption_implementation: "adoption_commitment",
  commitment_close: "adoption_commitment",
};

const allowedJourneyStates = new Set([
  "early_discovery",
  "clinical_evaluation",
  "objection_phase",
  "access_formulary",
  "adoption_commitment",
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
const MAX_TRANSCRIPT_TURNS = 60;
const MAX_SIGNAL_ITEMS = 60;

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

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => safeString(value)).filter(Boolean))];
}

function normalizeScenarioPayload(body = {}, existingScenario = null) {
  const journeyStage = allowedJourneyStages.has(body.journeyStage)
    ? body.journeyStage
    : existingScenario?.journeyStage || "discovery";

  const journeyStateCandidate = safeString(body.journeyState) || journeyStateForStage[journeyStage];
  const journeyState = allowedJourneyStates.has(journeyStateCandidate)
    ? journeyStateCandidate
    : journeyStateForStage[journeyStage];

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
    journeyState,
    hcpRoleType,
    decisionOrientation,
    persona,
    startingBehaviorState,
    interactionPressure,
    suggestedFocusCapabilities,
    keyChallenges,
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

function normalizeSessionPayload(body = {}, existingSession = null) {
  const transcript = (Array.isArray(body?.transcript) ? body.transcript : existingSession?.transcript || [])
    .slice(-MAX_TRANSCRIPT_TURNS)
    .map(normalizeTranscriptTurn)
    .filter((turn) => turn.text);

  const signals = (Array.isArray(body?.signals) ? body.signals : existingSession?.signals || [])
    .slice(-MAX_SIGNAL_ITEMS)
    .map((signal) => normalizeSignalItem(asObject(signal)));

  const journeyStateCandidate = safeString(body?.currentJourneyState || body?.journeyState || existingSession?.currentJourneyState);
  const currentJourneyState = allowedJourneyStates.has(journeyStateCandidate)
    ? journeyStateCandidate
    : existingSession?.currentJourneyState || "early_discovery";

  const behaviorStateCandidate = safeString(body?.currentBehaviorState || body?.behaviorState || existingSession?.currentBehaviorState);
  const currentBehaviorState = allowedBehaviorStates.has(behaviorStateCandidate)
    ? behaviorStateCandidate
    : existingSession?.currentBehaviorState || "neutral";

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

  const provider = requestedProvider === "openai"
    ? "openai"
    : requestedProvider === "groq"
      ? "groq"
      : groqApiKey
        ? "groq"
        : openaiApiKey
          ? "openai"
          : null;

  return { provider, openaiApiKey, groqApiKey };
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
  const messages = buildMessages({ prompt, roleplay, response_json_schema });

  const payload = { model, messages, temperature, max_tokens };
  if (response_json_schema) payload.response_format = { type: "json_object" };

  const controller = new AbortController();
  const timeoutMs = Math.max(5000, Number(env?.LLM_TIMEOUT_MS || 25000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
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
      }, { status: response.status }, request);
    }

    const data = await response.json();
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

function handleHealth(env, request) {
  const { provider, openaiApiKey, groqApiKey } = getLlmProvider(env);
  return json({
    status: "ok",
    ready: true,
    timestamp: new Date().toISOString(),
    service: "reflectivai-api-parity-v2",
    provider: provider || "mock",
    storage: {
      provider: getKv(env) ? "cloudflare_kv" : "memory_fallback",
    },
    providersConfigured: {
      openai: Boolean(openaiApiKey),
      groq: Boolean(groqApiKey),
    },
    endpoints: ["/health", "/api/llm/invoke", "/api/scenarios", "/api/roleplay/sessions"],
  }, {}, request);
}

export default {
  async fetch(request, env) {
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

    return json({ error: "Not found" }, { status: 404 }, request);
  },
};
