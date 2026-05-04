/// <reference types="vite/client" />

/**
 * @typedef {Object} WorkerRequestJsonOptions
 * @property {string} [method]
 * @property {unknown} [body]
 */

/**
 * @typedef {Object} WorkerTextRequest
 * @property {string} [prompt]
 * @property {number} [max_tokens]
 * @property {number} [temperature]
 * @property {boolean} [roleplay]
 * @property {string} [provider]
 * @property {string} [model]
 * @property {number} [timeout_ms]
 * @property {number} [retry_count]
 */

/**
 * @typedef {WorkerTextRequest & {
 *   response_json_schema?: unknown
 * }} WorkerJsonRequest
 */

const isBrowserRuntime = typeof window !== "undefined";
const isViteDevRuntime = Boolean(import.meta?.env?.DEV);
const BASE_URL = import.meta.env.VITE_ROLEPLAY_WORKER_URL?.trim();

if (!BASE_URL) {
  throw new Error("Missing required env var VITE_ROLEPLAY_WORKER_URL for runtime worker routing");
}
const workerInvokePath = "/api/llm/invoke";
const workerHealthPath = "/health";
const workerScenariosPath = "/api/scenarios";
const workerSessionsPath = "/api/roleplay/sessions";
const roleplayStartPath = "/api/roleplay/start";
const roleplayRespondPath = "/api/roleplay/respond";
const evidenceSourcesPath = "/api/evidence/sources";
const evidenceRecordsPath = "/api/evidence/records";
const evidenceIngestPath = "/api/evidence/ingest";

const workerInvokeUrl = `${BASE_URL}${workerInvokePath}`;
const workerHealthUrl = `${BASE_URL}${workerHealthPath}`;
const workerScenariosUrl = `${BASE_URL}${workerScenariosPath}`;
const workerSessionsUrl = `${BASE_URL}${workerSessionsPath}`;
const roleplayStartUrl = `${BASE_URL}${roleplayStartPath}`;
const roleplayRespondUrl = `${BASE_URL}${roleplayRespondPath}`;
const evidenceSourcesUrl = `${BASE_URL}${evidenceSourcesPath}`;
const evidenceRecordsUrl = `${BASE_URL}${evidenceRecordsPath}`;
const evidenceIngestUrl = `${BASE_URL}${evidenceIngestPath}`;
const DEFAULT_WORKER_TIMEOUT_MS = 35000;
const HEALTH_TIMEOUT_MS = 8000;
const TRANSIENT_RETRY_DELAYS_MS = [400, 1200];

export function getWorkerRuntimeDescriptor() {
  const frontendMode = isViteDevRuntime ? "local-dev" : "production-build";
  const inferenceMode = "direct env worker";

  return {
    frontendMode,
    isBrowserRuntime,
    workerBaseUrl: BASE_URL,
    workerInvokeUrl,
    workerScenariosUrl,
    workerSessionsUrl,
    roleplayStartUrl,
    roleplayRespondUrl,
    evidenceSourcesUrl,
    evidenceRecordsUrl,
    evidenceIngestUrl,
    useBrowserProxyPaths: false,
    inferenceMode,
    hcpGenerationPath: "local directives/prompt + env worker inference + local cleanup",
  };
}

function timeoutError(label, timeoutMs) {
  return new Error(`${label} timed out after ${timeoutMs}ms`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientWorkerError(error) {
  const message = String(error?.message || "");
  const code = String(error?.cause?.code || error?.code || "");
  return (
    error?.name === "AbortError" ||
    message.includes("timed out after") ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT"
  );
}

function stripJsonCodeFence(text = "") {
  const line = String(text || "").trim();
  const match = line.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : line;
}

function extractFirstBalancedJson(text = "") {
  const input = String(text || "");
  const starts = ["{", "["].map((char) => input.indexOf(char)).filter((idx) => idx >= 0);
  if (!starts.length) return null;

  const start = Math.min(...starts);
  const open = input[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < input.length; i += 1) {
    const ch = input[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === open) depth += 1;
    if (ch === close) depth -= 1;

    if (depth === 0) {
      return input.slice(start, i + 1).trim();
    }
  }

  return null;
}

function parseStructuredPayload(payload) {
  const line = stripJsonCodeFence(String(payload || ""));

  try {
    return JSON.parse(line);
  } catch {
    const extracted = extractFirstBalancedJson(line);
    if (extracted) {
      return JSON.parse(extracted);
    }

    const preview = line.slice(0, 120).replace(/\s+/g, " ");
    console.warn("[workerClient] Structured payload parse failed", { preview });
    throw new Error("Worker returned non-JSON structured payload");
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_WORKER_TIMEOUT_MS, label = "Worker request", maxRetries = TRANSIENT_RETRY_DELAYS_MS.length) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } catch (error) {
      lastError = error?.name === "AbortError" ? timeoutError(label, timeoutMs) : error;
      if (!isTransientWorkerError(lastError) || attempt === maxRetries) {
        throw lastError;
      }
      await sleep(TRANSIENT_RETRY_DELAYS_MS[attempt]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

async function parseWorkerResponse(response) {
  if (!response.ok) {
    throw new Error(await response.text().catch(() => `Worker request failed with ${response.status}`));
  }
  return response.json();
}

export async function generateRealtimeFeedback(payload) {
  const prompt = [
    `You are a sales coaching expert analyzing a pharmaceutical rep's response during a role-play simulation.`,
    ``,
    `CONTEXT:`,
    `- Rep's response: "${payload.repResponse}"`,
    `- HCP's last reply: "${payload.hcpLastReply || "Unknown"}"`,
    `- Active HCP cue: ${payload.hcpCue || "None provided"}`,
    `- HCP current behavior: ${payload.hcpBehavior}`,
    `- Journey stage: ${payload.journeyState}`,
    `- Scenario: ${payload.scenario?.title || "Unknown"}`,
    `- Predicted HCP state: ${payload.prediction?.predictedBehaviorState || "Unknown"}`,
    `- Concern family: ${payload.prediction?.concernFamily || "Unknown"}`,
    `- Predicted risk: ${payload.prediction?.riskLevel || "Unknown"}`,
    `- Predicted next move: ${payload.prediction?.nextLikelyBehavior || "Unknown"}`,
    ``,
    `SCORING / COACHING BOUNDARY:`,
    `- Evaluate rep behavior only.`,
    `- Use the HCP cue, behavior, and dialogue only as context for what the rep should do next.`,
    `- Do not infer psychology or score the HCP.`,
    ``,
    `SIGNAL INTELLIGENCE CAPABILITIES to evaluate against:`,
    `1. Question Quality — timely, relevant questions that move the conversation forward.`,
    `2. Listening & Responsiveness — accurate understanding of HCP input and a response that clearly reflects it.`,
    `3. Customer Engagement Cues — noticing changes in participation and conversational momentum.`,
    `4. Value Framing — connecting the point to the HCP's specific priorities and why it matters.`,
    `5. Objection Handling — engaging resistance constructively without defensiveness.`,
    `6. Conversation Control & Structure — guiding the exchange with clear direction and purpose.`,
    `7. Adaptability — adjusting approach based on what is happening in the interaction.`,
    `8. Commitment Gaining — creating a clear next action the HCP can own.`,
    ``,
    `Provide ONE specific, actionable coaching tip that would improve this response.`,
    `Hard rules:`,
    `- under 22 words total`,
    `- one sentence only`,
    `- specific to what the rep just said`,
    `- specific to the HCP's current state`,
    `- no generic praise`,
    `- no summary`,
    `- no filler words like "consider" or "try to"`,
    `Format: "[what to do next], because [specific HCP signal or risk]."`,
  ].join("\n");

  return invokeWorkerText({ prompt, max_tokens: 60, temperature: 0.1 });
}

/**
 * @param {string} url
 * @param {WorkerRequestJsonOptions} [options]
 */
async function requestWorkerJson(url, { method = "GET", body } = {}) {
  const response = await fetchWithTimeout(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, DEFAULT_WORKER_TIMEOUT_MS, `${method} ${url}`);
  return parseWorkerResponse(response);
}

/**
 * @param {WorkerTextRequest} [options]
 */
export async function invokeWorkerText({ prompt, max_tokens = 900, temperature = 0.2, roleplay = false, provider, model, timeout_ms, retry_count } = {}) {
  const response = await fetchWithTimeout(workerInvokeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, max_tokens, temperature, roleplay, provider, model }),
  }, timeout_ms || DEFAULT_WORKER_TIMEOUT_MS, "Worker text invoke", typeof retry_count === "number" ? retry_count : TRANSIENT_RETRY_DELAYS_MS.length);

  const data = await parseWorkerResponse(response);
  const text = typeof data?.response === "string"
    ? data.response
    : typeof data?.response?.text === "string"
      ? data.response.text
      : JSON.stringify(data?.response ?? "");

  return text.trim();
}

/**
 * Invoke worker and return RAW string payload (no parsing).
 * Used by invokeWorkerJsonWithRetry to apply custom extraction logic.
 * @param {WorkerJsonRequest} [options]
 * @returns {Promise<string>} Raw response payload as string
 */
export async function invokeWorkerJsonRawPayload({ prompt, response_json_schema, max_tokens = 1200, temperature = 0.2, roleplay = false, provider, model, timeout_ms, retry_count } = {}) {
  const response = await fetchWithTimeout(workerInvokeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, response_json_schema, max_tokens, temperature, roleplay, provider, model }),
  }, timeout_ms || DEFAULT_WORKER_TIMEOUT_MS, "Worker JSON invoke", typeof retry_count === "number" ? retry_count : TRANSIENT_RETRY_DELAYS_MS.length);

  const data = await parseWorkerResponse(response);
  const payload = data?.response;

  if (!payload) {
    throw new Error("Worker returned no response payload");
  }

  // Return as string (may have formatting issues, which retry handler will fix)
  if (typeof payload === "string") {
    return payload;
  }

  if (typeof payload === "object") {
    return JSON.stringify(payload);
  }

  return String(payload || "");
}

/**
 * @param {WorkerJsonRequest} [options]
 */
export async function invokeWorkerJson({ prompt, response_json_schema, max_tokens = 1200, temperature = 0.2, roleplay = false, provider, model, timeout_ms, retry_count } = {}) {
  const response = await fetchWithTimeout(workerInvokeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, response_json_schema, max_tokens, temperature, roleplay, provider, model }),
  }, timeout_ms || DEFAULT_WORKER_TIMEOUT_MS, "Worker JSON invoke", typeof retry_count === "number" ? retry_count : TRANSIENT_RETRY_DELAYS_MS.length);

  const data = await parseWorkerResponse(response);
  const payload = data?.response;

  if (payload && typeof payload === "object") {
    return payload;
  }

  if (typeof payload === "string") {
    return parseStructuredPayload(payload);
  }

  throw new Error("Worker returned no structured response");
}

export async function requestHcpOpening(payload = {}) {
  const response = await fetchWithTimeout(roleplayStartUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: payload.sessionId,
      scenarioContext: {
        title: payload.title ?? "",
        stakeholder: payload.stakeholder ?? "",
        objective: payload.objective ?? "",
        persona: payload.persona ?? "time_constrained_community_doctor",
        journeyStage: payload.journeyStage ?? "initial_access",
        interactionPressure: payload.interactionPressure ?? [],
        startingBehaviorState: payload.startingBehaviorState ?? "closed",
      },
      conversationState: {
        sessionId: payload.sessionId,
        scenarioId: payload.scenarioId ?? "",
        scenarioTitle: payload.title ?? "",
        currentBehaviorState: payload.currentBehaviorState ?? "closed",
        currentJourneyState: payload.currentJourneyState,
        turnCount: 0,
        volatilityProfile: "stable",
        signals: [],
      },
    }),
  }, DEFAULT_WORKER_TIMEOUT_MS, "Roleplay start");

  const data = await parseWorkerResponse(response);

  return {
    rewrittenLine: data?.hcpReply ?? "",
  };
}

export async function requestRoleplayResponse(payload = {}) {
  const response = await fetchWithTimeout(roleplayRespondUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: payload.sessionId,
      repMessage: payload.repMessage,
      scenarioContext: payload.scenarioContext,
      conversationState: payload.conversationState,
    }),
  }, DEFAULT_WORKER_TIMEOUT_MS, "Roleplay respond");

  const data = await parseWorkerResponse(response);

  return {
    hcpReply: typeof data?.hcpReply === "string"
      ? data.hcpReply
      : typeof data?.response?.text === "string"
        ? data.response.text
        : "",
    metadata: {
      hcpCue: data?.metadata?.hcpCue ?? data?.response?.cue ?? null,
      nextBehaviorState: data?.metadata?.nextBehaviorState ?? data?.response?.nextBehaviorState ?? null,
      nextJourneyState: data?.metadata?.nextJourneyState ?? data?.response?.nextJourneyState ?? null,
      realism: data?.metadata?.realism ?? data?.response?.realism ?? null,
    },
  };
}

export async function checkWorkerHealth() {
  try {
    const response = await fetchWithTimeout(workerHealthUrl, { method: "GET" }, HEALTH_TIMEOUT_MS, "Worker health check");
    if (!response.ok) return "degraded";
    const data = await response.json().catch(() => null);
    if (data?.ready === false || data?.status === "degraded") return "degraded";
    return "healthy";
  } catch {
    return "offline";
  }
}

export async function listWorkerScenarios() {
  const data = await requestWorkerJson(workerScenariosUrl);
  return Array.isArray(data?.scenarios) ? data.scenarios : [];
}

export async function createWorkerScenario(payload) {
  const data = await requestWorkerJson(workerScenariosUrl, { method: "POST", body: payload });
  return data?.scenario ?? null;
}

export async function updateWorkerScenario(id, patch) {
  const data = await requestWorkerJson(workerScenariosUrl, { method: "PUT", body: { id, ...patch } });
  return data?.scenario ?? null;
}

export async function deleteWorkerScenario(id) {
  await requestWorkerJson(workerScenariosUrl, { method: "DELETE", body: { id } });
}

export async function listWorkerSessions() {
  const data = await requestWorkerJson(workerSessionsUrl);
  return Array.isArray(data?.sessions) ? data.sessions : [];
}

export async function getWorkerSession(id) {
  const data = await requestWorkerJson(`${workerSessionsUrl}?id=${encodeURIComponent(id)}`);
  return data?.session ?? null;
}

export async function createWorkerSession(payload) {
  const data = await requestWorkerJson(workerSessionsUrl, { method: "POST", body: payload });
  return data?.session ?? null;
}

export async function updateWorkerSession(id, patch) {
  const data = await requestWorkerJson(workerSessionsUrl, { method: "PUT", body: { id, ...patch } });
  return data?.session ?? null;
}

export async function deleteWorkerSession(id) {
  await requestWorkerJson(workerSessionsUrl, { method: "DELETE", body: { id } });
}

export async function listEvidenceSources() {
  const data = await requestWorkerJson(evidenceSourcesUrl);
  return Array.isArray(data?.sources) ? data.sources : [];
}

export async function listEvidenceRecords(filters = {}) {
  const params = new URLSearchParams();
  if (filters.domain) params.set("domain", filters.domain);
  if (filters.diseaseState) params.set("diseaseState", filters.diseaseState);
  if (filters.limit) params.set("limit", String(filters.limit));
  const url = params.toString() ? `${evidenceRecordsUrl}?${params.toString()}` : evidenceRecordsUrl;
  const data = await requestWorkerJson(url);
  return Array.isArray(data?.records) ? data.records : [];
}

export async function ingestEvidenceRecords(payload = {}) {
  const data = await requestWorkerJson(evidenceIngestUrl, {
    method: "POST",
    body: payload,
  });
  return {
    ingestedCount: Number(data?.ingestedCount || 0),
    records: Array.isArray(data?.records) ? data.records : [],
    rejected: Array.isArray(data?.rejected) ? data.rejected : [],
  };
}
