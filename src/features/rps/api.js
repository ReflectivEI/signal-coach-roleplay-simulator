import { requireRealismContract } from "@/lib/scenarioInputResolver";

const PRODUCTION_WORKER_URL = "https://reflectivai-rps-api.tonyabdelmalak.workers.dev";
const BASE_URL = (import.meta.env.VITE_ROLEPLAY_WORKER_URL?.trim() || PRODUCTION_WORKER_URL).replace(/\/$/, "");

if (!BASE_URL) {
    throw new Error("Missing required env var VITE_ROLEPLAY_WORKER_URL for runtime worker routing");
}

function rpsUrl(path) {
    return `${BASE_URL}${path}`;
}

function getPayloadRealism(path, body = {}) {
    const dropdowns = body?.selected_dropdowns || body?.dropdown_selections || {};
    const definedValues = [
        dropdowns?.realism,
        body?.live_temperature,
        body?.rep_selected_temperature,
        body?.initial_temperature,
        body?.temperature,
    ].filter((value) => value !== undefined && value !== null && value !== "");

    if (!definedValues.length) {
        return null;
    }

    const contractRealism = requireRealismContract(definedValues[0], `${path} payload realism`);
    definedValues.forEach((value) => {
        if (requireRealismContract(value, `${path} payload realism`) !== contractRealism) {
            throw new Error(`Realism contract mismatch in ${path} payload.`);
        }
    });

    return contractRealism;
}

async function request(path, body) {
    const contractRealism = getPayloadRealism(path, body || {});
    const response = await fetch(rpsUrl(path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contractRealism === null ? (body || {}) : {
            ...(body || {}),
            live_temperature: contractRealism,
            rep_selected_temperature: contractRealism,
            initial_temperature: contractRealism,
            temperature: contractRealism,
        }),
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
