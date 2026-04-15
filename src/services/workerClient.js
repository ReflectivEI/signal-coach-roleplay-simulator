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
 */

/**
 * @typedef {WorkerTextRequest & {
 *   response_json_schema?: unknown
 * }} WorkerJsonRequest
 */

const runtimeWorkerBaseUrl =
  import.meta.env.VITE_ROLEPLAY_WORKER_URL ??
  (typeof process !== "undefined" ? process.env.VITE_ROLEPLAY_WORKER_URL : "") ??
  "";
const workerBaseUrl = runtimeWorkerBaseUrl.replace(/\/+$/, "");
const isBrowserRuntime = typeof window !== "undefined";
const defaultNodeWorkerBaseUrl = "http://127.0.0.1:8787";
const resolvedWorkerBaseUrl = workerBaseUrl || (!isBrowserRuntime ? defaultNodeWorkerBaseUrl : "");
const workerInvokePath = "/api/llm/invoke";
const workerHealthPath = "/health";
const workerScenariosPath = "/api/scenarios";
const workerSessionsPath = "/api/roleplay/sessions";

const useBrowserProxyPaths = import.meta.env.DEV && isBrowserRuntime && !workerBaseUrl;

const workerInvokeUrl = useBrowserProxyPaths ? workerInvokePath : `${resolvedWorkerBaseUrl}${workerInvokePath}`;
const workerHealthUrl = useBrowserProxyPaths ? workerHealthPath : `${resolvedWorkerBaseUrl}${workerHealthPath}`;
const workerScenariosUrl = useBrowserProxyPaths ? workerScenariosPath : `${resolvedWorkerBaseUrl}${workerScenariosPath}`;
const workerSessionsUrl = useBrowserProxyPaths ? workerSessionsPath : `${resolvedWorkerBaseUrl}${workerSessionsPath}`;
const DEFAULT_WORKER_TIMEOUT_MS = 35000;
const HEALTH_TIMEOUT_MS = 8000;

function timeoutError(label, timeoutMs) {
  return new Error(`${label} timed out after ${timeoutMs}ms`);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_WORKER_TIMEOUT_MS, label = "Worker request") {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw timeoutError(label, timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseWorkerResponse(response) {
  if (!response.ok) {
    throw new Error(await response.text().catch(() => `Worker request failed with ${response.status}`));
  }
  return response.json();
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
export async function invokeWorkerText({ prompt, max_tokens = 900, temperature = 0.2, roleplay = false, provider, model } = {}) {
  const response = await fetchWithTimeout(workerInvokeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, max_tokens, temperature, roleplay, provider, model }),
  }, DEFAULT_WORKER_TIMEOUT_MS, "Worker text invoke");

  const data = await parseWorkerResponse(response);
  const text = typeof data?.response === "string"
    ? data.response
    : typeof data?.response?.text === "string"
      ? data.response.text
      : JSON.stringify(data?.response ?? "");

  return text.trim();
}

/**
 * @param {WorkerJsonRequest} [options]
 */
export async function invokeWorkerJson({ prompt, response_json_schema, max_tokens = 1200, temperature = 0.2, roleplay = false, provider, model } = {}) {
  const response = await fetchWithTimeout(workerInvokeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, response_json_schema, max_tokens, temperature, roleplay, provider, model }),
  }, DEFAULT_WORKER_TIMEOUT_MS, "Worker JSON invoke");

  const data = await parseWorkerResponse(response);
  const payload = data?.response;

  if (payload && typeof payload === "object") {
    return payload;
  }

  if (typeof payload === "string") {
    return JSON.parse(payload);
  }

  throw new Error("Worker returned no structured response");
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
    ``,
    `SIGNAL INTELLIGENCE PRINCIPLES to evaluate:`,
    `1. Question Quality - Are questions open-ended, diagnostic, or leading?`,
    `2. Listening Responsiveness - Does the rep build on HCP input?`,
    `3. Making It Matter - Is relevance to the HCP demonstrated?`,
    `4. Customer Engagement Signals - Is the HCP engaged or disengaged?`,
    `5. Objection Navigation - Are concerns addressed or dismissed?`,
    `6. Conversation Control - Does the rep guide toward outcomes?`,
    `7. Adaptability - Does the rep adjust to the HCP's state?`,
    `8. Commitment Gaining - Are next steps clear?`,
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
