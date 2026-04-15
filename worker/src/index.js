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
      ...body,
      id: safeString(body.id) || createId("custom", body.title),
      isBuiltIn: false,
      isPublished: body?.isPublished ?? true,
      createdAt: body?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = [scenario, ...scenarios.filter((item) => item.id !== scenario.id)];
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
      ...scenarios[index],
      ...body,
      id: scenarios[index].id,
      isBuiltIn: false,
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
    return json({ sessions }, {}, request);
  }

  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const sessions = await readCollection(env, key);
    const session = {
      ...body,
      id: safeString(body.id) || createId("session", body.scenarioTitle || body.scenarioId),
      createdAt: body?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = [session, ...sessions.filter((item) => item.id !== session.id)].slice(0, 200);
    await writeCollection(env, key, next);
    return json({ success: true, session }, { status: 201 }, request);
  }

  return json({ error: "Method not allowed" }, { status: 405 }, request);
}

function handleHealth(env, request) {
  const { provider, openaiApiKey, groqApiKey } = getLlmProvider(env);
  return json({
    status: "ok",
    ready: true,
    timestamp: new Date().toISOString(),
    service: "signal-coach-roleplay-worker",
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
