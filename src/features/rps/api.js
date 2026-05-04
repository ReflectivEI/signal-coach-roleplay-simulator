const BASE_URL = import.meta.env.VITE_ROLEPLAY_WORKER_URL?.trim();

if (!BASE_URL) {
    throw new Error("Missing required env var VITE_ROLEPLAY_WORKER_URL for runtime worker routing");
}

function rpsUrl(path) {
    return `${BASE_URL}${path}`;
}

async function request(path, body) {
    const response = await fetch(rpsUrl(path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
    });

    if (!response.ok) {
        throw new Error(await response.text());
    }

    return response.json();
}

export function generateAdaptiveScenario(payload) {
    return request("/api/rps/generate-scenario", payload);
}

export function evaluateAdaptiveResponse(payload) {
    return request("/api/rps/evaluate-response", payload);
}

export function saveAdaptiveSession(payload) {
    return request("/api/rps/save-session", payload);
}
