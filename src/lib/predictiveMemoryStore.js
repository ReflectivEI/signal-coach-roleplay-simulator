const STORAGE_KEY = "predictive_builder_profile_memory_v1";
const MAX_PROFILE_ENTRIES = 40;
const MAX_INTERACTIONS_PER_PROFILE = 20;

function safeParse(jsonText, fallback) {
    try {
        const parsed = JSON.parse(jsonText);
        return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
        return fallback;
    }
}

function canUseStorage() {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getStore() {
    if (!canUseStorage()) return {};
    return safeParse(window.localStorage.getItem(STORAGE_KEY) || "{}", {});
}

function saveStore(store) {
    if (!canUseStorage()) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function normalizeText(text) {
    return String(text || "")
        .replace(/\s+/g, " ")
        .trim();
}

function extractSignals(text = "") {
    const lower = normalizeText(text).toLowerCase();
    const signals = [];

    const signalPatterns = [
        { id: "workflow_burden", pattern: /workflow|staff|bandwidth|capacity|process|paperwork|monitoring/ },
        { id: "evidence_fit", pattern: /evidence|subgroup|trial|endpoint|real-world|guideline|publication/ },
        { id: "safety_boundary", pattern: /safety|risk|adverse|tolerability|contraindication/ },
        { id: "access_friction", pattern: /prior auth|coverage|payer|formulary|access|cost/ },
        { id: "competitive_anchor", pattern: /competitor|current therapy|incumbent|switch/ },
    ];

    for (const candidate of signalPatterns) {
        if (candidate.pattern.test(lower)) signals.push(candidate.id);
    }

    return signals;
}

export function getProfileKey(selection = {}) {
    const fields = [
        selection.diseaseState,
        selection.hcpType,
        selection.journeyStage,
        selection.interactionPressure,
        selection.influenceDriver,
        selection.behaviorArchetype,
    ];
    return fields.map((field) => String(field || "na")).join("|");
}

function clampProfiles(store = {}) {
    const entries = Object.entries(store);
    if (entries.length <= MAX_PROFILE_ENTRIES) return store;

    entries.sort((a, b) => {
        const left = Number(a[1]?.updatedAt || 0);
        const right = Number(b[1]?.updatedAt || 0);
        return right - left;
    });

    const trimmed = entries.slice(0, MAX_PROFILE_ENTRIES);
    return Object.fromEntries(trimmed);
}

export function getProfileMemory(selection = {}) {
    const store = getStore();
    const key = getProfileKey(selection);
    const entry = store[key];
    if (!entry) {
        return {
            key,
            interactionCount: 0,
            recentInteractions: [],
            recurringSignals: [],
            lastUpdatedAt: null,
        };
    }

    return {
        key,
        interactionCount: Array.isArray(entry.interactions) ? entry.interactions.length : 0,
        recentInteractions: Array.isArray(entry.interactions) ? entry.interactions.slice(-5).reverse() : [],
        recurringSignals: Array.isArray(entry.recurringSignals) ? entry.recurringSignals : [],
        lastUpdatedAt: entry.updatedAt || null,
    };
}

export function recordProfileInteraction(selection = {}, interaction = {}) {
    const store = getStore();
    const key = getProfileKey(selection);
    const existing = store[key] || { interactions: [], recurringSignals: [], updatedAt: null };

    const repMessage = normalizeText(interaction.repMessage);
    const hcpReply = normalizeText(interaction.hcpReply);

    const nextInteraction = {
        timestamp: Date.now(),
        repMessage,
        hcpReply,
        signals: extractSignals(`${repMessage} ${hcpReply}`),
    };

    const nextInteractions = [...(existing.interactions || []), nextInteraction].slice(-MAX_INTERACTIONS_PER_PROFILE);
    const signalCounts = {};

    for (const item of nextInteractions) {
        for (const signal of item.signals || []) {
            signalCounts[signal] = (signalCounts[signal] || 0) + 1;
        }
    }

    const recurringSignals = Object.entries(signalCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([signal, count]) => `${signal.replaceAll("_", " ")} (${count})`);

    store[key] = {
        interactions: nextInteractions,
        recurringSignals,
        updatedAt: Date.now(),
    };

    saveStore(clampProfiles(store));
}
