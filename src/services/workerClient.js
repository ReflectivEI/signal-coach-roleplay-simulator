const workerBaseUrl = (import.meta.env.VITE_ROLEPLAY_WORKER_URL ?? "").replace(/\/+$/, "");
const workerInvokePath = "/api/llm/invoke";
const workerHealthPath = "/health";
const workerScenariosPath = "/api/scenarios";
const workerSessionsPath = "/api/roleplay/sessions";

const workerInvokeUrl = import.meta.env.DEV && workerBaseUrl ? workerInvokePath : `${workerBaseUrl}${workerInvokePath}`;
const workerHealthUrl = import.meta.env.DEV && workerBaseUrl ? workerHealthPath : `${workerBaseUrl}${workerHealthPath}`;
const workerScenariosUrl = import.meta.env.DEV && workerBaseUrl ? workerScenariosPath : `${workerBaseUrl}${workerScenariosPath}`;
const workerSessionsUrl = import.meta.env.DEV && workerBaseUrl ? workerSessionsPath : `${workerBaseUrl}${workerSessionsPath}`;

async function parseWorkerResponse(response) {
  if (!response.ok) {
    throw new Error(await response.text().catch(() => `Worker request failed with ${response.status}`));
  }
  return response.json();
}

async function requestWorkerJson(url, { method = "GET", body } = {}) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseWorkerResponse(response);
}

export async function invokeWorkerText({ prompt, max_tokens = 900, temperature = 0.2, roleplay = false, provider } = {}) {
  const response = await fetch(workerInvokeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, max_tokens, temperature, roleplay, provider }),
  });

  const data = await parseWorkerResponse(response);
  const text = typeof data?.response === "string"
    ? data.response
    : typeof data?.response?.text === "string"
      ? data.response.text
      : JSON.stringify(data?.response ?? "");

  return text.trim();
}

export async function invokeWorkerJson({ prompt, response_json_schema, max_tokens = 1200, temperature = 0.2, roleplay = false, provider } = {}) {
  const response = await fetch(workerInvokeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, response_json_schema, max_tokens, temperature, roleplay, provider }),
  });

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
    `Provide ONE specific, actionable coaching tip (one sentence max) that would improve this response. Focus on what the rep did well first, then what to improve.`,
    `Format: "Strength: [what they did well]. Next: [specific action to improve]."`,
  ].join("\n");

  return invokeWorkerText({ prompt, max_tokens: 120, temperature: 0.2 });
}

export async function checkWorkerHealth() {
  try {
    const response = await fetch(workerHealthUrl, { method: "GET" });
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

export async function createWorkerSession(payload) {
  const data = await requestWorkerJson(workerSessionsUrl, { method: "POST", body: payload });
  return data?.session ?? null;
}
