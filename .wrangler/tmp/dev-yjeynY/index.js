var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-6udBFm/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// worker/src/index.js
var allowedMethods = "GET,POST,PUT,DELETE,OPTIONS";
var allowedHeaders = "Content-Type,Authorization";
var memoryState = {
  scenarios: [],
  sessions: []
};
function json(data, init = {}, request) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  return withCors(new Response(JSON.stringify(data), { ...init, headers }), request);
}
__name(json, "json");
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
__name(withCors, "withCors");
function preflight(request) {
  return withCors(new Response(null, { status: 204 }), request);
}
__name(preflight, "preflight");
function safeString(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}
__name(safeString, "safeString");
function slugify(value) {
  return safeString(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
__name(slugify, "slugify");
function createId(prefix, label = "") {
  return `${prefix}-${slugify(label) || Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
__name(createId, "createId");
function getKv(env) {
  return env?.APP_DATA_KV || null;
}
__name(getKv, "getKv");
async function readCollection(env, key) {
  const kv = getKv(env);
  if (kv) {
    const raw = await kv.get(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  }
  return [...memoryState[key]];
}
__name(readCollection, "readCollection");
async function writeCollection(env, key, value) {
  const kv = getKv(env);
  if (kv) {
    await kv.put(key, JSON.stringify(value));
    return;
  }
  memoryState[key] = Array.isArray(value) ? [...value] : [];
}
__name(writeCollection, "writeCollection");
function getLlmProvider(env, requestedProvider) {
  const openaiApiKey = env?.OPENAI_API_KEY;
  const groqApiKey = env?.GROQ_API_KEY;
  const provider = requestedProvider === "openai" ? "openai" : requestedProvider === "groq" ? "groq" : groqApiKey ? "groq" : openaiApiKey ? "openai" : null;
  return { provider, openaiApiKey, groqApiKey };
}
__name(getLlmProvider, "getLlmProvider");
function modelForProvider(provider, requestedModel) {
  if (requestedModel) return requestedModel;
  return provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4-turbo";
}
__name(modelForProvider, "modelForProvider");
function llmUrlForProvider(provider) {
  return provider === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
}
__name(llmUrlForProvider, "llmUrlForProvider");
function apiKeyForProvider(provider, keys) {
  return provider === "groq" ? keys.groqApiKey : keys.openaiApiKey;
}
__name(apiKeyForProvider, "apiKeyForProvider");
function buildMessages({ prompt, roleplay = false, response_json_schema }) {
  if (roleplay) {
    return [{ role: "system", content: prompt }];
  }
  return [
    {
      role: "system",
      content: `You are an expert sales coach helping healthcare professionals improve their sales skills.
You provide behavioral feedback, coaching insights, scenario generation, and performance analysis.
Always respond with actionable, behavior-specific feedback.${response_json_schema ? "\nFormat your response as valid JSON matching the provided schema." : ""}`
    },
    { role: "user", content: prompt }
  ];
}
__name(buildMessages, "buildMessages");
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
          commitment_attempt: "none"
        },
        coachingNudge: {
          title: "Tighten relevance",
          guidance: "Anchor your next question to this HCP's patient mix before introducing product detail.",
          capabilityId: "making_it_matter",
          capabilityName: "Value Framing"
        }
      },
      model: "mock",
      usage: { prompt_tokens: 0, completion_tokens: 0 },
      isDevelopment: true
    };
  }
  return {
    response: "Mock AI response - configure OPENAI_API_KEY or GROQ_API_KEY in worker secrets for live model output.",
    model: "mock",
    usage: { prompt_tokens: 0, completion_tokens: 0 },
    isDevelopment: true
  };
}
__name(buildMockResponse, "buildMockResponse");
async function handleLlmInvoke(request, env) {
  const body = await request.json().catch(() => ({}));
  const {
    prompt,
    response_json_schema,
    max_tokens = 2e3,
    temperature = 0.2,
    roleplay = false,
    provider: requestedProvider,
    model: requestedModel
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
  const timeoutMs = Math.max(5e3, Number(env?.LLM_TIMEOUT_MS || 25e3));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(llmUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) {
      const errorText = await response.text();
      return json({
        error: "LLM_SERVICE_UNAVAILABLE",
        details: errorText,
        provider,
        model
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
      usage: data?.usage || { prompt_tokens: 0, completion_tokens: 0 }
    }, {}, request);
  } catch (error) {
    const details = error?.name === "AbortError" ? "Request timed out." : safeString(error?.message, "fetch_failed");
    return json({
      error: "LLM_SERVICE_UNAVAILABLE",
      details,
      provider,
      model
    }, { status: 503 }, request);
  } finally {
    clearTimeout(timeout);
  }
}
__name(handleLlmInvoke, "handleLlmInvoke");
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
      createdAt: body?.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
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
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
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
__name(handleScenarios, "handleScenarios");
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
      createdAt: body?.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const next = [session, ...sessions.filter((item) => item.id !== session.id)].slice(0, 200);
    await writeCollection(env, key, next);
    return json({ success: true, session }, { status: 201 }, request);
  }
  return json({ error: "Method not allowed" }, { status: 405 }, request);
}
__name(handleSessions, "handleSessions");
function handleHealth(env, request) {
  const { provider, openaiApiKey, groqApiKey } = getLlmProvider(env);
  return json({
    status: "ok",
    ready: true,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    service: "signal-coach-roleplay-worker",
    provider: provider || "mock",
    storage: {
      provider: getKv(env) ? "cloudflare_kv" : "memory_fallback"
    },
    providersConfigured: {
      openai: Boolean(openaiApiKey),
      groq: Boolean(groqApiKey)
    },
    endpoints: ["/health", "/api/llm/invoke", "/api/scenarios", "/api/roleplay/sessions"]
  }, {}, request);
}
__name(handleHealth, "handleHealth");
var src_default = {
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
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-6udBFm/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-6udBFm/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
