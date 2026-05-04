const isBrowserRuntime = typeof window !== "undefined";
const isViteDevRuntime = Boolean(import.meta?.env?.DEV);
const DEFAULT_LOCAL_WORKER_URL = "http://127.0.0.1:8787";
const STAGING_WORKER_URL = "https://reflectivai-rps-api-staging.tonyabdelmalak.workers.dev";
const PRODUCTION_WORKER_URL = "https://reflectivai-rps-api.tonyabdelmalak.workers.dev";
const configuredWorkerUrl = import.meta.env.VITE_ROLEPLAY_WORKER_URL?.trim() || "";
function resolveWorkerBaseUrl() {
    if (configuredWorkerUrl) return configuredWorkerUrl;
    if (isBrowserRuntime) {
        const { hostname } = window.location;
        if (hostname === "localhost" || hostname === "127.0.0.1") return DEFAULT_LOCAL_WORKER_URL;
        if (hostname.includes("staging")) return STAGING_WORKER_URL;
        return PRODUCTION_WORKER_URL;
    }
    return DEFAULT_LOCAL_WORKER_URL;
}
const WORKER_URL = resolveWorkerBaseUrl();
const useBrowserProxyPaths = isViteDevRuntime && isBrowserRuntime;

function rpsUrl(path) {
    return useBrowserProxyPaths ? path : `${WORKER_URL}${path}`;
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
