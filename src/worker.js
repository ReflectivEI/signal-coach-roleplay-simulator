// ============================================================================
// Cloudflare Worker - ReflectivAI Backend
// ============================================================================

import { getAssetFromKV } from "@cloudflare/kv-asset-handler";
import manifestJSON from "__STATIC_CONTENT_MANIFEST";
import {
    managerInsightsRequestSchema,
    deriveManagerInsightsFeatures,
    createFallbackManagerInsights,
    normalizeManagerInsightsResponse
} from "./components/manager/managerInsightsShared.js";
import { appendFollowUpSnapshot, buildValidationSummary, createValidationRecord, listCanonicalCapabilities } from "./components/manager/managerValidationLogic.js";
import { listRoleplaySessions, persistRoleplaySession } from "./lib/roleplaySessionStore.js";
import { validateRoleplayRepTurn } from "./lib/roleplay/roleplayTurnValidation.js";
const assetManifest = JSON.parse(manifestJSON);

// ────────────────────────────────────────────────────────────────────────────
// CORS (UPDATED FOR reflectiv-ai.com)
// ────────────────────────────────────────────────────────────────────────────

const PRIMARY_ORIGIN = "https://reflectiv-ai.com";

function resolveAllowedOrigin(request) {
    const origin = request.headers.get("Origin");

    if (!origin) return PRIMARY_ORIGIN;
    if (origin === PRIMARY_ORIGIN) return origin;
    if (/^https:\/\/([a-z0-9-]+\.)?reflect-ai-now\.pages\.dev$/i.test(origin)) return origin;
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;

    return PRIMARY_ORIGIN;
}

function setCorsHeaders(request, response) {
    response.headers.set("Access-Control-Allow-Origin", resolveAllowedOrigin(request));
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Vary", "Origin");
    response.headers.set("Cache-Control", "no-cache, must-revalidate");
    return response;
}

function handlePreflight(request) {
    return setCorsHeaders(request, new Response(null, { status: 204 }));
}

// ─── ASSET SERVING ──────────────────────────────────────────────────────
async function serveAsset(request, env, ctx) {
    try {
        return await getAssetFromKV(
            {
                request,
                waitUntil(promise) {
                    return ctx.waitUntil(promise);
                }
            },
            {
                ASSET_NAMESPACE: env.__STATIC_CONTENT,
                ASSET_MANIFEST: assetManifest
            }
        );
    } catch (err) {
        // If 404, try serving index.html for SPA routing
        if (err.status === 404) {
            try {
                const url = new URL(request.url);
                // For paths without extensions, serve index.html
                if (!url.pathname.includes(".")) {
                    const indexRequest = new Request(new URL("/index.html", request.url), request);
                    return await getAssetFromKV(
                        {
                            request: indexRequest,
                            waitUntil(promise) {
                                return ctx.waitUntil(promise);
                            }
                        },
                        {
                            ASSET_NAMESPACE: env.__STATIC_CONTENT,
                            ASSET_MANIFEST: assetManifest
                        }
                    );
                }
            } catch (indexErr) {
                return null;
            }
        }
        console.error("Asset serving error:", err);
        return null;
    }
}

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────
function createSessionToken() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function setCookie(response, name, value, maxAge = 86400) {
    response.headers.append(
        "Set-Cookie",
        `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
    );
    return response;
}

function getCookieValue(request, cookieName) {
    const cookieString = request.headers.get("Cookie") || "";
    const cookies = Object.fromEntries(cookieString.split("; ").map(c => c.split("=")));
    return cookies[cookieName] || null;
}

function extractRoleplayOpeningAuthority(prompt = "") {
    const source = String(prompt || "");
    if (!source.includes("ROLEPLAY_OPENING_TURN_AUTHORITY: scenario_owned")) return null;

    const readMarkerLine = (label) => {
        const prefix = `${label}:`;
        const lines = source.replaceAll(String.fromCharCode(13), "").split(String.fromCharCode(10));
        const line = lines.find((item) => String(item || "").trim().startsWith(prefix));
        return line ? line.slice(line.indexOf(prefix) + prefix.length).trim() : "";
    };

    const dialogue = readMarkerLine("ROLEPLAY_OPENING_DIALOGUE_EXACT");
    if (!dialogue) return null;

    return {
        dialogue,
        cue: readMarkerLine("ROLEPLAY_OPENING_CUE"),
        source: readMarkerLine("ROLEPLAY_OPENING_SOURCE") || "scenario_opening_scene",
    };
}

function recordWorkerTurnValidationTelemetry(validation, context = {}) {
    (validation?.telemetryEvents || []).forEach((event) => {
        console.info("[RoleplayTurnValidation]", event.eventType, {
            ...(event.payload || {}),
            ...context,
        });
    });
}

function buildRoleplayValidationRequiredResponse() {
    const validation = {
        valid: false,
        invalid: true,
        blockHcpGeneration: true,
        blockScoring: true,
        blockStateAdvance: true,
        reasonCodes: ["roleplay_turn_validation_required"],
        coaching: {
            shouldShow: true,
            label: "Turn validation required",
            tip: "Roleplay turns must be validated against the HCP's latest ask before generation.",
            suggestion: "Submit latestHcpAsk, repMessage, and previousRepMessages through the shared validation contract before invoking the provider.",
            severity: "high",
            escalationLabel: "Turn blocked",
        },
    };

    return Response.json({
        error: "ROLEPLAY_TURN_VALIDATION_REQUIRED",
        blocked: true,
        deterministic: true,
        validation,
    }, { status: 428 });
}

function enforceRoleplayTurnValidationBoundary(body = {}) {
    const contract = body?.roleplayTurnValidation;
    if (!contract) return { response: buildRoleplayValidationRequiredResponse() };

    const validation = validateRoleplayRepTurn({
        latestHcpAsk: contract.latestHcpAsk || "",
        firstTurnOpeningContext: contract.firstTurnOpeningContext || "",
        repMessage: contract.repMessage || "",
        previousRepMessages: Array.isArray(contract.previousRepMessages) ? contract.previousRepMessages : [],
        allPreviousRepMessages: Array.isArray(contract.allPreviousRepMessages) ? contract.allPreviousRepMessages : contract.previousRepMessages,
        previousHcpAsks: Array.isArray(contract.previousHcpAsks) ? contract.previousHcpAsks : [],
        coachingRequirement: contract.coachingRequirement || null,
        coachingRequirementMet: contract.coachingRequirementMet !== false,
    });

    recordWorkerTurnValidationTelemetry(validation, {
        entryPoint: "worker:/api/llm/invoke",
        scenarioId: contract.scenarioId || null,
        turnNumber: contract.turnNumber || null,
    });

    if (validation.invalid) {
        return {
            validation,
            response: Response.json({
                error: "ROLEPLAY_TURN_BLOCKED",
                blocked: true,
                deterministic: true,
                validation,
            }, { status: 422 }),
        };
    }

    return { validation, response: null };
}

// ─── IN-MEMORY SESSION STORE (Development) ──────────────────────────────
const sessions = new Map();
const logs = [];
const customScenarios = [];
const managerValidationRecords = buildDemoValidationRecords();

function buildDemoValidationMetrics(overrides = {}) {
    return {
        signal_awareness: 3.5,
        signal_interpretation: 3.5,
        adaptive_response: 3.5,
        objection_navigation: 3.5,
        value_connection: 3.5,
        commitment_generation: 3.5,
        customer_engagement: 3.5,
        conversation_management: 3.5,
        ...overrides,
    };
}

function buildDemoValidationRecords() {
    return [
        createValidationRecord({
            id: "validation_demo_rep_01",
            repId: "rep-01",
            repName: "Alex Thompson",
            territoryId: "Northeast",
            territoryName: "Northeast",
            createdAt: "2026-03-01T14:00:00.000Z",
            createdBy: "manager",
            source: "ai_recommendation",
            recommendationType: "coaching_session",
            recommendationTitle: "Commitment Generation intervention",
            recommendationSummary: "Alex improved discovery quality, but managers wanted cleaner closes that convert strong clinical dialogue into explicit next steps.",
            targetCapability: "commitment_generation",
            linkedCapabilities: ["value_connection"],
            baselineSnapshot: {
                overallScore: 4.2,
                behavioralMetrics: buildDemoValidationMetrics({ commitment_generation: 3.7, value_connection: 4.5, signal_awareness: 4.6, customer_engagement: 4.4 }),
                learningEngagementScore: 82,
                readiness: 84,
                conversionProxy: 78,
                salesRisk: 34,
                predictiveConfidence: 84,
                sessions30d: 15,
                modulesCompleted: 7,
                salesOutcomeScore: 4.4,
                salesTrend: "up",
                observationDepth: 18,
            },
            expectedMovement: { targetCapabilityDelta: 0.2, engagementDelta: 3, riskDirection: "down", observationWindowDays: 14 },
            followUpSnapshots: [{
                capturedAt: "2026-03-18T14:00:00.000Z",
                overallScore: 4.3,
                behavioralMetrics: buildDemoValidationMetrics({ commitment_generation: 4.0, value_connection: 4.5, signal_awareness: 4.6, customer_engagement: 4.4 }),
                learningEngagementScore: 86,
                readiness: 86,
                conversionProxy: 84,
                salesRisk: 30,
                predictiveConfidence: 86,
                sessions30d: 17,
                modulesCompleted: 8,
                salesOutcomeScore: 4.5,
                salesTrend: "up",
                observationDepth: 18,
            }],
        }),
        createValidationRecord({
            id: "validation_demo_rep_02",
            repId: "rep-02",
            repName: "Maria Santos",
            territoryId: "Southeast",
            territoryName: "Southeast",
            createdAt: "2026-03-04T15:00:00.000Z",
            createdBy: "manager",
            source: "manager_manual",
            recommendationType: "scenario_mix_adjustment",
            recommendationTitle: "Objection Navigation intervention",
            recommendationSummary: "Maria reads HCP intent well, but access objections still derail momentum late in the conversation.",
            targetCapability: "objection_navigation",
            linkedCapabilities: ["signal_awareness"],
            baselineSnapshot: {
                overallScore: 3.8,
                behavioralMetrics: buildDemoValidationMetrics({ objection_navigation: 3.4, signal_awareness: 4.0, value_connection: 4.1, conversation_management: 3.5 }),
                learningEngagementScore: 72,
                readiness: 70,
                conversionProxy: 64,
                salesRisk: 43,
                predictiveConfidence: 69,
                sessions30d: 9,
                modulesCompleted: 4,
                salesOutcomeScore: 3.3,
                salesTrend: "flat",
                observationDepth: 11,
            },
            expectedMovement: { targetCapabilityDelta: 0.2, engagementDelta: 3, riskDirection: "down", observationWindowDays: 16 },
            followUpSnapshots: [{
                capturedAt: "2026-03-20T15:00:00.000Z",
                overallScore: 3.8,
                behavioralMetrics: buildDemoValidationMetrics({ objection_navigation: 3.5, signal_awareness: 4.0, value_connection: 4.0, conversation_management: 3.6 }),
                learningEngagementScore: 73,
                readiness: 71,
                conversionProxy: 66,
                salesRisk: 42,
                predictiveConfidence: 70,
                sessions30d: 10,
                modulesCompleted: 5,
                salesOutcomeScore: 3.3,
                salesTrend: "flat",
                observationDepth: 12,
            }],
        }),
        createValidationRecord({
            id: "validation_demo_rep_04",
            repId: "rep-04",
            repName: "Sarah Williams",
            territoryId: "Southwest",
            territoryName: "Southwest",
            createdAt: "2026-03-04T12:00:00.000Z",
            createdBy: "manager",
            source: "ai_recommendation",
            recommendationType: "coaching_session",
            recommendationTitle: "Signal Awareness reset",
            recommendationSummary: "Sarah received targeted signal-recognition drills, but downstream indicators have continued to soften.",
            targetCapability: "signal_awareness",
            linkedCapabilities: ["adaptive_response"],
            baselineSnapshot: {
                overallScore: 3.0,
                behavioralMetrics: buildDemoValidationMetrics({ signal_awareness: 2.8, adaptive_response: 3.2, value_connection: 2.9, commitment_generation: 2.7 }),
                learningEngagementScore: 39,
                readiness: 35,
                conversionProxy: 41,
                salesRisk: 78,
                predictiveConfidence: 62,
                sessions30d: 4,
                modulesCompleted: 2,
                salesOutcomeScore: 2.9,
                salesTrend: "down",
                observationDepth: 6,
            },
            expectedMovement: { targetCapabilityDelta: 0.2, engagementDelta: 3, riskDirection: "down", observationWindowDays: 14 },
            followUpSnapshots: [{
                capturedAt: "2026-03-19T12:00:00.000Z",
                overallScore: 2.9,
                behavioralMetrics: buildDemoValidationMetrics({ signal_awareness: 2.7, adaptive_response: 3.1, value_connection: 2.8, commitment_generation: 2.6 }),
                learningEngagementScore: 34,
                readiness: 31,
                conversionProxy: 35,
                salesRisk: 84,
                predictiveConfidence: 58,
                sessions30d: 4,
                modulesCompleted: 2,
                salesOutcomeScore: 2.8,
                salesTrend: "down",
                observationDepth: 6,
            }],
        }),
        createValidationRecord({
            id: "validation_demo_rep_05",
            repId: "rep-05",
            repName: "David Chen",
            territoryId: "West Coast",
            territoryName: "West Coast",
            createdAt: "2026-03-14T09:00:00.000Z",
            createdBy: "manager",
            source: "manager_manual",
            recommendationType: "assignment_bundle",
            recommendationTitle: "Value Connection reinforcement",
            recommendationSummary: "David is experimenting with sharper value framing, but the observation window is still early and activity has not meaningfully increased.",
            targetCapability: "value_connection",
            linkedCapabilities: ["customer_engagement"],
            baselineSnapshot: {
                overallScore: 3.7,
                behavioralMetrics: buildDemoValidationMetrics({ value_connection: 3.3, customer_engagement: 4.1, signal_awareness: 4.0, commitment_generation: 3.7 }),
                learningEngagementScore: 69,
                readiness: 67,
                conversionProxy: 63,
                salesRisk: 47,
                predictiveConfidence: 66,
                sessions30d: 8,
                modulesCompleted: 4,
                salesOutcomeScore: 3.5,
                salesTrend: "down",
                observationDepth: 10,
            },
            expectedMovement: { targetCapabilityDelta: 0.2, engagementDelta: 3, riskDirection: "down", observationWindowDays: 21 },
            followUpSnapshots: [{
                capturedAt: "2026-03-20T09:00:00.000Z",
                overallScore: 3.7,
                behavioralMetrics: buildDemoValidationMetrics({ value_connection: 3.4, customer_engagement: 4.1, signal_awareness: 4.0, commitment_generation: 3.7 }),
                learningEngagementScore: 70,
                readiness: 68,
                conversionProxy: 65,
                salesRisk: 46,
                predictiveConfidence: 67,
                sessions30d: 8,
                modulesCompleted: 4,
                salesOutcomeScore: 3.5,
                salesTrend: "down",
                observationDepth: 10,
            }],
        }),
        createValidationRecord({
            id: "validation_demo_rep_07",
            repId: "rep-07",
            repName: "Priya Patel",
            territoryId: "Northeast",
            territoryName: "Northeast",
            createdAt: "2026-03-12T11:00:00.000Z",
            createdBy: "manager",
            source: "ai_recommendation",
            recommendationType: "coaching_session",
            recommendationTitle: "Conversation Management pacing drill",
            recommendationSummary: "Priya is strong overall, but managers want more consistent pacing and closure discipline in compressed live calls.",
            targetCapability: "conversation_management",
            linkedCapabilities: ["customer_engagement"],
            baselineSnapshot: {
                overallScore: 4.0,
                behavioralMetrics: buildDemoValidationMetrics({ conversation_management: 3.7, customer_engagement: 4.3, value_connection: 4.2, signal_awareness: 4.1 }),
                learningEngagementScore: 80,
                readiness: 79,
                conversionProxy: 75,
                salesRisk: 37,
                predictiveConfidence: 81,
                sessions30d: 12,
                modulesCompleted: 6,
                salesOutcomeScore: 4.0,
                salesTrend: "up",
                observationDepth: 14,
            },
            expectedMovement: { targetCapabilityDelta: 0.2, engagementDelta: 3, riskDirection: "down", observationWindowDays: 14 },
            followUpSnapshots: [],
        }),
        createValidationRecord({
            id: "validation_demo_rep_09",
            repId: "rep-09",
            repName: "Olivia Brooks",
            territoryId: "Midwest",
            territoryName: "Midwest",
            createdAt: "2026-02-28T10:30:00.000Z",
            createdBy: "manager",
            source: "manager_manual",
            recommendationType: "coaching_session",
            recommendationTitle: "Commitment Generation intervention",
            recommendationSummary: "Olivia maintains stable sales despite weaker behavior, so the team is testing whether sharper next-step language can unlock upside without raising risk.",
            targetCapability: "commitment_generation",
            linkedCapabilities: ["conversation_management"],
            baselineSnapshot: {
                overallScore: 3.5,
                behavioralMetrics: buildDemoValidationMetrics({ commitment_generation: 3.2, conversation_management: 3.4, value_connection: 3.6, adaptive_response: 3.7 }),
                learningEngagementScore: 61,
                readiness: 63,
                conversionProxy: 76,
                salesRisk: 41,
                predictiveConfidence: 64,
                sessions30d: 7,
                modulesCompleted: 3,
                salesOutcomeScore: 3.9,
                salesTrend: "flat",
                observationDepth: 8,
            },
            expectedMovement: { targetCapabilityDelta: 0.2, engagementDelta: 3, riskDirection: "down", observationWindowDays: 14 },
            followUpSnapshots: [{
                capturedAt: "2026-03-17T10:30:00.000Z",
                overallScore: 3.7,
                behavioralMetrics: buildDemoValidationMetrics({ commitment_generation: 3.5, conversation_management: 3.4, value_connection: 3.6, adaptive_response: 3.6 }),
                learningEngagementScore: 66,
                readiness: 66,
                conversionProxy: 82,
                salesRisk: 37,
                predictiveConfidence: 68,
                sessions30d: 9,
                modulesCompleted: 4,
                salesOutcomeScore: 3.9,
                salesTrend: "flat",
                observationDepth: 9,
            }],
        }),
    ];
}

const users = {
    "user1": {
        id: "user1",
        name: "Demo User",
        email: "demo@example.com",
        role: "sales_rep",
        createdAt: new Date().toISOString()
    }
};

const assignments = [
    { id: "a1", repId: "user1", title: "Cardiology Discovery Call", status: "pending", dueDate: "2025-06-25", scenario: "hcp_cardiologist" },
    { id: "a2", repId: "user1", title: "Oncology Value Messaging", status: "in_progress", dueDate: "2025-06-28", scenario: "hcp_oncologist" },
];

// Refactored learningPaths structure for module completion and analysis
const learningPaths = [
  {
    capability: "signal_awareness",
    label: "Signal Awareness",
    completed_modules: [],
    avg_score: 3.5,
    session_count: 0,
    ai_recommendation: "",
    modules: [
      { id: "sa_mod1", title: "Introduction to Signal Awareness" },
      { id: "sa_mod2", title: "Identifying Key Signals" },
      { id: "sa_mod3", title: "Signal Interpretation" },
      { id: "sa_mod4", title: "Practical Exercises" },
      { id: "sa_mod5", title: "Mastery Assessment" }
    ]
  },
  {
    capability: "value_connection",
    label: "Value Connection",
    completed_modules: [],
    avg_score: 3.2,
    session_count: 0,
    ai_recommendation: "",
    modules: [
      { id: "vc_mod1", title: "Understanding Value Drivers" },
      { id: "vc_mod2", title: "Connecting Product to Outcomes" },
      { id: "vc_mod3", title: "Value Messaging" },
      { id: "vc_mod4", title: "Practice Scenarios" }
    ]
  }
  // Add more capabilities/modules as needed
];

const knowledgeBase = [
    {
        id: "1",
        title: "Objection Handling 101",
        content: "Learn the foundational techniques for addressing customer objections effectively without becoming defensive.",
        category: "objection_handling",
        curated: true,
        source: "Sales Excellence Framework",
        tags: ["objection", "communication", "defensive"],
        createdAt: "2025-06-15",
        updatedAt: "2025-06-15"
    },
    {
        id: "2",
        title: "Value Connection: Framing ROI",
        content: "Guide customers through understanding the business value and ROI of your solution.",
        category: "value_connection",
        curated: true,
        source: "Sales Excellence Framework",
        tags: ["value", "roi", "framing"],
        createdAt: "2025-06-15",
        updatedAt: "2025-06-15"
    }
];

// ─── API HANDLERS ───────────────────────────────────────────────────────

// Authentication: Get current user
async function handleAuthMe(request) {
    const sessionToken = getCookieValue(request, "session");

    if (!sessionToken || !sessions.has(sessionToken)) {
        return new Response(
            JSON.stringify({ error: "Unauthorized", code: "NO_SESSION" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    const sessionData = sessions.get(sessionToken);
    const user = users[sessionData.userId];

    return Response.json({
        ...user,
        session: { token: sessionToken, createdAt: sessionData.createdAt }
    });
}

// Authentication: Login (creates a session)
async function handleAuthLogin(request) {
    const body = await request.json().catch(() => ({}));
    const { email = "demo@example.com" } = body;

    // Find user by email (simplified)
    let user = Object.values(users).find(u => u.email === email);

    if (!user) {
        // Create new user
        const newUserId = `user_${Date.now()}`;
        user = {
            id: newUserId,
            name: email.split("@")[0],
            email,
            role: "sales_rep",
            createdAt: new Date().toISOString()
        };
        users[newUserId] = user;
    }

    // Create session
    const sessionToken = createSessionToken();
    sessions.set(sessionToken, {
        userId: user.id,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString() // 24 hours
    });

    const response = Response.json({
        success: true,
        user,
        session: { token: sessionToken }
    });

    return setCookie(response, "session", sessionToken, 86400);
}

// Authentication: Logout
async function handleAuthLogout(request) {
    const sessionToken = getCookieValue(request, "session");

    if (sessionToken) {
        sessions.delete(sessionToken);
    }

    const response = Response.json({ success: true, message: "Logged out successfully" });
    return setCookie(response, "session", "", 0); // Delete cookie
}

// App Settings: Get public settings by app ID
async function handleAppSettings(pathname) {
    const appId = pathname.split("/by-id/")[1];

    const settings = {
        appId,
        name: "ReflectivAI",
        features: {
            roleplay_simulator: true,
            scenario_builder: true,
            coaching_insights: true,
            behavior_analytics: true,
            ai_feedback: true,
            knowledge_base: true
        },
        capabilities: [
            "signal_awareness",
            "signal_interpretation",
            "value_connection",
            "objection_navigation",
            "commitment_generation"
        ],
        scenarios: {
            specialty_count: 12,
            disease_state_count: 8,
            challenge_count: 24
        },
        settings: {
            language: "en",
            timezone: "America/New_York",
            dateFormat: "MM/DD/YYYY",
            theme: "dark"
        }
    };

    return Response.json(settings);
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

    return {
        provider,
        openaiApiKey,
        groqApiKey
    };
}

async function invokeStructuredLlm({ env, prompt, schemaHint, max_tokens = 900, temperature = 0.2, provider: requestedProvider }) {
    const { provider, openaiApiKey, groqApiKey } = getLlmProvider(env, requestedProvider);

    if (!provider) {
        return { unavailable: true };
    }

    const model = provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4-turbo";
    const llmUrl = provider === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(env?.LLM_TIMEOUT_MS || 25000));

    try {
        const response = await fetch(llmUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${provider === "groq" ? groqApiKey : openaiApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model,
                temperature,
                max_tokens,
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content: `You are a performance-focused sales coaching system. You MUST use ONLY provided structured data, avoid generic advice, tie every recommendation to a specific observed gap, and use behavior-based coaching. Return strict JSON only. Reject vague language, unsupported claims, personality judgments, and scoring changes. ${schemaHint}`
                    },
                    { role: "user", content: prompt }
                ]
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            const details = await response.text();
            console.error("Manager insights LLM error:", response.status, details);
            return { unavailable: true, status: response.status, details };
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        return {
            unavailable: false,
            model,
            provider,
            content: JSON.parse(content)
        };
    } catch (error) {
        console.error("Manager insights LLM invoke error:", error);
        return { unavailable: true, details: error.message };
    } finally {
        clearTimeout(timeout);
    }
}

function buildManagerInsightsPrompt(payload, derived) {
    return [
        "You are a performance analytics and coaching system.",
        "",
        "CRITICAL SYSTEM RULES:",
        "- Use ONLY the provided data and treat it as factual.",
        "- NEVER invent, infer, rename, or substitute values not present.",
        "- Use ONLY canonical Signal Intelligence metric labels when referring to behavioral metrics.",
        "- ALWAYS reference the rep by name when the insight is rep-specific.",
        "- NEVER let an example rep bias the output; use only the current payload.",
        "- Every finding must be traceable to a rep metric, a territory aggregation, or a deterministic calculation.",
        "- Use exact metric names, exact values, exact thresholds, and exact territory names.",
        "- If a threshold is not crossed, do not claim that it is crossed.",
        "- The deterministic truth layer owns strongest capability, capability requiring improvement, threshold flags, risk flags, engagement, readiness, confidence inputs, and territory aggregates.",
        "- The AI layer may summarize deterministic outputs and suggest coaching actions, but it must not override them.",
        "",
        "Thresholds to enforce:",
        "- metric < 3.5/5 => flagged low capability",
        "- engagement < 60/100 => engagement risk",
        "- salesRiskScore >= 62/100 => high risk",
        "- territoryVolatility > 0.4 => elevated volatility",
        "- territory engagement < 55/100 => territory risk",
        "",
        "Rep Data:",
        JSON.stringify(payload.repData ?? null),
        "",
        "Territory Data:",
        JSON.stringify(payload.territoryData),
        "",
        "Derived Metrics:",
        JSON.stringify(payload.derivedMetrics ?? derived),
        "",
        "Canonical Rep Metrics:",
        JSON.stringify(derived.canonicalRepMetrics ?? []),
        "",
        "Canonical Territory Metrics:",
        JSON.stringify(derived.canonicalTerritoryMetrics ?? []),
        "",
        "Deterministic Rep Risk Flags:",
        JSON.stringify(derived.repRiskFlags ?? []),
        "",
        "Deterministic Territory Risk Flags:",
        JSON.stringify(derived.territoryRiskFlags ?? []),
        "",
        "Rules:",
        "1. If referencing a behavioral capability, use the EXACT capability name from the dataset.",
        "2. If referencing a score, use the EXACT score tied to that capability and include the relevant threshold when possible.",
        "3. strongestCapability and improvementPriority must match the canonical dataset.",
        "4. Sales insights must align with salesPerformance, salesTrend, engagement, and behavioral profile.",
        "5. Territory insights must align with weighted averages and aggregationWeights from territoryData.",
        "6. Recommendations must be specific, behavior-based, and non-generic.",
        "7. Do not output advice that cannot be traced back to provided data.",
        "8. Predictive outlook must explain predictiveConfidence and dataConfidence using the supplied confidence inputs rather than generic wording.",
        "9. Risk items must include a root cause tied to engagement, capability gaps, territory conditions, or sales trend.",
        "10. Reject output if any capability mismatch exists, if any score is assigned to the wrong capability, if the weak area conflicts with the canonical dataset, or if generic language appears.",
        "11. If no deterministic risk flag is triggered, say that explicitly instead of inventing one.",
        "12. Do not use non-canonical labels such as Adaptability, Objection Handling, Value Communication, Emotional Attunement, or Conversation Control.",
        "",
        "Recommendation format:",
        "Action → Situation → Expected Outcome",
        JSON.stringify({
            action: "Run 2 targeted coaching sessions this week focused on the exact weakest capability only when its score is below threshold",
            rationale: "Reference the rep name, the exact metric value, the threshold crossed, and the supporting engagement or risk metric.",
            expectedImpact: "State the monitored metric that should move and keep the claim within the observed data.",
        }),
        "",
        "OUTPUT: STRICT JSON matching the schema hint only.",
    ].join("\n");
}

async function handleManagerInsights(request, env) {
    const body = await request.json().catch(() => null);
    const parsed = managerInsightsRequestSchema.safeParse(body);

    if (!parsed.success) {
        return Response.json({
            error: "Invalid manager insights payload",
            details: parsed.error.flatten()
        }, { status: 400 });
    }

    const payload = parsed.data;
    const derived = deriveManagerInsightsFeatures(payload);
    const fallback = createFallbackManagerInsights(payload, derived);

    const schemaHint = `Schema: { summary: string, keyDrivers: string[], risks: string[], recommendations: [{ action: string, rationale: string, expectedImpact: string }], predictiveOutlook: { performanceTrend: "likely_improve" | "at_risk" | "stable", confidence: number 0-1, reasoning: string } }`;
    const prompt = buildManagerInsightsPrompt(payload, derived);
    const llmResponse = await invokeStructuredLlm({ env, prompt, schemaHint, provider: body?.provider });

    if (llmResponse.unavailable) {
        return Response.json(fallback);
    }

    return Response.json(normalizeManagerInsightsResponse(llmResponse.content, fallback));
}

// LLM: Invoke AI for coaching, analysis, or generation
async function handleLlmInvoke(request, env) {
    const body = await request.json().catch(() => ({}));
    const { prompt, response_json_schema, max_tokens = 2000, temperature = 0.7, roleplay = false } = body;

    if (!prompt) {
        return new Response(
            JSON.stringify({ error: "Missing prompt field" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    const roleplayOpeningAuthority = roleplay && !body?.roleplayTurnValidation?.firstTurnOpeningContext
        ? extractRoleplayOpeningAuthority(prompt)
        : null;
    if (roleplayOpeningAuthority?.dialogue) {
        return Response.json({
            response: roleplayOpeningAuthority.dialogue,
            model: "deterministic_opening_turn",
            usage: { prompt_tokens: 0, completion_tokens: 0 },
            deterministic: true,
            roleplayOpeningAuthority,
        });
    }

    if (roleplay) {
        const boundary = enforceRoleplayTurnValidationBoundary(body);
        if (boundary.response) return boundary.response;
    }

    const requestedProvider = body?.provider;
    const { provider, openaiApiKey, groqApiKey } = getLlmProvider(env, requestedProvider);

    if (!provider) {
        console.warn("No LLM API key configured, returning mock response");
        return Response.json({
            response: "Mock AI response - Please configure OPENAI_API_KEY or GROQ_API_KEY for real LLM integration.",
            model: "mock",
            usage: { prompt_tokens: 0, completion_tokens: 0 },
            isDevelopment: true
        });
    }

    try {
        // For roleplay, use the client's prompt as-is (it contains full HCP behavioral instructions)
        // Client prompt should be treated as system instructions for roleplay
        // For other uses, add generic coaching system prompt
        const messages = roleplay
            ? [{ role: "system", content: prompt }]
            : [
                { role: "system", content: `You are ReflectivAI's enterprise coaching and enablement model.
Provide concise, behavior-specific, enterprise-grade output for pharmaceutical sales enablement use cases.

Global response rules:
- Do not fabricate citations, studies, percentages, survey data, references, product claims, or external facts that were not explicitly provided in the prompt.
- Do not invent platform features, modules, reports, datasets, pages, or internal tools that were not explicitly provided in the prompt.
- Prefer structured, practical answers over generic prose.
- Use clear business language and observable behaviors.
- Avoid filler, hype, and motivational padding.
- If the prompt asks for JSON, return valid JSON matching the requested schema only.${response_json_schema ? "\nReturn valid JSON only." : ""}` },
                { role: "user", content: prompt }
            ];

        const model = body?.model || (provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4-turbo");

        const openaiRequest = {
            model,
            messages,
            temperature,
            max_tokens,
            response_format: response_json_schema ? { type: "json_object" } : undefined
        };

        // Remove undefined fields
        Object.keys(openaiRequest).forEach(key =>
            openaiRequest[key] === undefined && delete openaiRequest[key]
        );

        const llmUrl = provider === "groq"
            ? "https://api.groq.com/openai/v1/chat/completions"
            : "https://api.openai.com/v1/chat/completions";

        const apiKey = provider === "groq" ? groqApiKey : openaiApiKey;

        // Add 25 second timeout for LLM API calls
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        const openaiResponse = await fetch(llmUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(openaiRequest),
            signal: controller.signal
        }).finally(() => clearTimeout(timeout));

        if (!openaiResponse.ok) {
            const error = await openaiResponse.text();
            console.error("LLM API error:", openaiResponse.status, error);

            // Return detailed error for debugging
            return Response.json({
                response: "Unable to reach LLM service. Please try again.",
                error: "LLM_SERVICE_UNAVAILABLE",
                details: error,
                status: openaiResponse.status,
                provider,
                model
            }, { status: 503 });
        }

        const openaiData = await openaiResponse.json();
        const content = openaiData.choices?.[0]?.message?.content || "";

        // Parse JSON if schema was requested
        let parsedResponse = content;
        if (response_json_schema) {
            try {
                parsedResponse = JSON.parse(content);
            } catch (e) {
                console.warn("Failed to parse JSON response:", e);
            }
        }

        return Response.json({
            response: parsedResponse,
            model,
            usage: openaiData.usage || { prompt_tokens: 0, completion_tokens: 0 }
        });

    } catch (error) {
        console.error("LLM invoke error:", error);
        return Response.json(
            { error: "Failed to invoke LLM", details: error.message },
            { status: 500 }
        );
    }
}

// Logs: Record user activity
async function handleUserLogs(request) {
    const body = await request.json().catch(() => ({}));
    const sessionToken = getCookieValue(request, "session");

    // In demo mode, allow logging without authentication
    let userId = "demo_user";
    if (sessionToken && sessions.has(sessionToken)) {
        const sessionData = sessions.get(sessionToken);
        userId = sessionData.userId;
    }

    const logEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        userId,
        ...body,
        timestamp: new Date().toISOString()
    };

    logs.push(logEntry);

    // Keep logs limited in memory (last 1000)
    if (logs.length > 1000) {
        logs.shift();
    }

    return Response.json({
        success: true,
        logId: logEntry.id,
        timestamp: logEntry.timestamp
    });
}

// Knowledge Base: Get snippets
async function handleSnippets(request) {
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const search = url.searchParams.get("search")?.toLowerCase();

    let results = [...knowledgeBase];

    if (category) {
        results = results.filter(s => s.category === category);
    }

    if (search) {
        results = results.filter(s =>
            s.title.toLowerCase().includes(search) ||
            s.content.toLowerCase().includes(search) ||
            s.tags?.some(tag => tag.toLowerCase().includes(search))
        );
    }

    return Response.json({
        snippets: results,
        total: results.length,
        categories: [...new Set(knowledgeBase.map(s => s.category))]
    });
}

// Assignments: Get and update assignments
async function handleAssignments(request) {
    if (request.method === "GET") {
        // Return assignments (in real deployment, filter by user)
        return Response.json({ assignments });
    }

    if (request.method === "PATCH") {
        const body = await request.json().catch(() => ({}));
        const { id, status } = body;

        const assignment = assignments.find(a => a.id === id);
        if (assignment) {
            assignment.status = status || assignment.status;
            assignment.updatedAt = new Date().toISOString();
        }

        return Response.json({ success: true, assignment });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
}

// Learning Paths: Get, analyze, and complete modules
async function handleLearningPaths(request) {
    const url = new URL(request.url);
    if (request.method === "GET") {
        return Response.json({ learningPaths });
    }
    if (request.method === "POST" && url.pathname.endsWith("/analyze")) {
        const body = await request.json().catch(() => ({}));
        const { sessions = [] } = body;
        // Deterministic analysis: aggregate scores and session count
        const analyzedPaths = learningPaths.map(path => {
            // Find sessions for this capability
            const relevantSessions = sessions.filter(s => s.capability === path.capability);
            let avg_score = null;
            let session_count = relevantSessions.length;
            if (session_count > 0) {
                // Aggregate scores if present
                let totalScore = 0;
                let scoreCount = 0;
                relevantSessions.forEach(s => {
                    if (typeof s.score === "number") {
                        totalScore += s.score;
                        scoreCount++;
                    }
                });
                avg_score = scoreCount > 0 ? (totalScore / scoreCount).toFixed(1) : null;
            }
            return {
                ...path,
                session_count,
                avg_score,
                analysis_demo: true // Label as demo
            };
        });
        return Response.json({ learningPaths: analyzedPaths, analyzed: true });
    }
    if (request.method === "PATCH" && url.pathname.endsWith("/complete")) {
        const body = await request.json().catch(() => ({}));
        const { capabilityId, moduleId } = body;
        if (!capabilityId || !moduleId) {
            return Response.json({ error: "Missing capabilityId or moduleId" }, { status: 400 });
        }
        let completed_modules = [];
        for (let path of learningPaths) {
            if (path.capability === capabilityId) {
                if (!path.completed_modules) path.completed_modules = [];
                if (path.completed_modules.includes(moduleId)) {
                    path.completed_modules = path.completed_modules.filter(m => m !== moduleId);
                } else {
                    path.completed_modules.push(moduleId);
                }
                completed_modules = path.completed_modules;
            }
        }
        return Response.json({ completed_modules });
    }
    return Response.json({ error: "Method not allowed" }, { status: 405 });
}

// RolePlay Sessions: Save and retrieve roleplay session data
async function handleRolePlaySessions(request, env) {
    if (request.method === "POST") {
        try {
            const body = await request.json();
            const result = await persistRoleplaySession(body, env);
            return Response.json({ success: true, session: result.session, durability: { durable: result.durable, provider: result.provider } });
        } catch (err) {
            return Response.json({ error: err.message }, { status: 400 });
        }
    }

    if (request.method === "GET") {
        const result = await listRoleplaySessions(env);
        return Response.json({ sessions: result.sessions, durability: { durable: result.durable, provider: result.provider } });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
}

// Custom Scenarios: Save and retrieve user-created scenarios
async function handleCustomScenarios(request) {
    if (request.method === "POST") {
        try {
            const body = await request.json();
            const scenario = {
                id: body.id || Date.now().toString(),
                title: body.title,
                description: body.description,
                specialty: body.specialty,
                disease_state: body.disease_state,
                hcp_category: body.hcp_category,
                influence_driver: body.influence_driver,
                difficulty: body.difficulty || "intermediate",
                details: body.details || "",
                focus_capabilities: body.focus_capabilities || [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            customScenarios.push(scenario);
            return Response.json({ success: true, scenario });
        } catch (err) {
            return Response.json({ error: err.message }, { status: 400 });
        }
    }

    if (request.method === "GET") {
        return Response.json({ scenarios: customScenarios });
    }

    if (request.method === "PUT") {
        try {
            const body = await request.json();
            const idx = customScenarios.findIndex(s => s.id === body.id);
            if (idx >= 0) {
                customScenarios[idx] = { ...customScenarios[idx], ...body, updatedAt: new Date().toISOString() };
                return Response.json({ success: true, scenario: customScenarios[idx] });
            }
            return Response.json({ error: "Scenario not found" }, { status: 404 });
        } catch (err) {
            return Response.json({ error: err.message }, { status: 400 });
        }
    }

    if (request.method === "DELETE") {
        try {
            const body = await request.json();
            const idx = customScenarios.findIndex(s => s.id === body.id);
            if (idx >= 0) {
                const removed = customScenarios.splice(idx, 1);
                return Response.json({ success: true, scenario: removed[0] });
            }
            return Response.json({ error: "Scenario not found" }, { status: 404 });
        } catch (err) {
            return Response.json({ error: err.message }, { status: 400 });
        }
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
}

function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateSnapshot(snapshot) {
    if (!isObject(snapshot) || !isObject(snapshot.behavioralMetrics)) {
        return "Snapshot must include behavioralMetrics.";
    }

    const metrics = listCanonicalCapabilities();
    const missingCapability = metrics.find(({ canonicalId }) => typeof snapshot.behavioralMetrics[canonicalId] !== "number");
    if (missingCapability) {
        return `Snapshot is missing canonical capability ${missingCapability.canonicalId}.`;
    }

    return null;
}

function sanitizeValidationRecord(record) {
    return createValidationRecord(record);
}

async function handleManagerValidationRep(request, repId) {
    if (request.method !== "GET") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const records = managerValidationRecords
        .filter((record) => record.repId === repId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((record) => sanitizeValidationRecord(record));

    return Response.json({ repId, records });
}

async function handleManagerValidationStart(request) {
    const body = await request.json().catch(() => ({}));
    const snapshotError = validateSnapshot(body.baselineSnapshot);
    const canonicalCapabilities = new Set(listCanonicalCapabilities().map((item) => item.canonicalId));

    if (!body.repId || !body.repName || !body.territoryName || !body.targetCapability) {
        return Response.json({ error: "Missing required validation fields." }, { status: 400 });
    }

    if (!canonicalCapabilities.has(body.targetCapability)) {
        return Response.json({ error: "targetCapability must be a canonical capability id." }, { status: 400 });
    }

    if (Array.isArray(body.linkedCapabilities) && body.linkedCapabilities.some((item) => !canonicalCapabilities.has(item))) {
        return Response.json({ error: "linkedCapabilities must use canonical capability ids only." }, { status: 400 });
    }

    if (snapshotError) {
        return Response.json({ error: snapshotError }, { status: 400 });
    }

    const record = sanitizeValidationRecord({
        repId: body.repId,
        repName: body.repName,
        territoryId: body.territoryId || body.territoryName,
        territoryName: body.territoryName,
        createdBy: body.createdBy === "system" ? "system" : "manager",
        source: body.source === "manager_manual" ? "manager_manual" : "ai_recommendation",
        recommendationType: body.recommendationType,
        recommendationTitle: body.recommendationTitle,
        recommendationSummary: body.recommendationSummary,
        targetCapability: body.targetCapability,
        linkedCapabilities: Array.isArray(body.linkedCapabilities) ? body.linkedCapabilities : [],
        baselineSnapshot: body.baselineSnapshot,
        expectedMovement: body.expectedMovement,
        followUpSnapshots: [],
    });

    managerValidationRecords.push(record);
    return Response.json({ success: true, record }, { status: 201 });
}

async function handleManagerValidationFollowUp(request, recordId) {
    const body = await request.json().catch(() => ({}));
    const snapshotError = validateSnapshot(body.followUpSnapshot);

    if (snapshotError) {
        return Response.json({ error: snapshotError }, { status: 400 });
    }

    const index = managerValidationRecords.findIndex((record) => record.id === recordId);
    if (index < 0) {
        return Response.json({ error: "Validation record not found." }, { status: 404 });
    }

    const existingRecord = managerValidationRecords[index];
    if (body.repId && body.repId !== existingRecord.repId) {
        return Response.json({ error: "Validation record rep mismatch." }, { status: 400 });
    }

    const updatedRecord = appendFollowUpSnapshot(existingRecord, body.followUpSnapshot);
    managerValidationRecords[index] = updatedRecord;
    return Response.json({ success: true, record: updatedRecord });
}

async function handleManagerValidationSummary(request) {
    if (request.method !== "GET") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    return Response.json({ summary: buildValidationSummary(managerValidationRecords.map((record) => sanitizeValidationRecord(record))) });
}

// Health Check
async function handleHealth() {
    return Response.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        endpoints: [
            "GET /api/auth/me",
            "POST /api/auth/login",
            "POST /api/auth/logout",
            "GET /api/apps/public/prod/public-settings/by-id/:appId",
            "POST /api/llm/invoke",
            "POST /api/logs/user",
            "GET /api/snippets",
            "GET /api/assignments",
            "PATCH /api/assignments",
            "GET /api/learning-paths",
            "GET /api/roleplay/sessions",
            "POST /api/roleplay/sessions",
            "GET /api/scenarios",
            "POST /api/scenarios",
            "PUT /api/scenarios",
            "DELETE /api/scenarios",
            "POST /manager-insights",
            "GET /api/manager/validation/rep/:repId",
            "POST /api/manager/validation/start",
            "POST /api/manager/validation/:id/follow-up",
            "GET /api/manager/validation/summary",
            "GET /health"
        ]
    });
}

// ─── MAIN ROUTER ────────────────────────────────────────────────────────

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const { pathname } = url;

        if (request.method === "OPTIONS") {
            return handlePreflight(request);
        }

        try {
            // ============ API ROUTES ============

            if (pathname === "/health") {
                return setCorsHeaders(request, await handleHealth());
            }

            if (pathname === "/api/auth/me" && request.method === "GET") {
                return setCorsHeaders(request, await handleAuthMe(request));
            }

            if (pathname === "/api/auth/login" && request.method === "POST") {
                return setCorsHeaders(request, await handleAuthLogin(request));
            }

            if (pathname === "/api/auth/logout" && request.method === "POST") {
                return setCorsHeaders(request, await handleAuthLogout(request));
            }

            if (pathname.startsWith("/api/apps/public/prod/public-settings/by-id/") && request.method === "GET") {
                return setCorsHeaders(request, await handleAppSettings(pathname));
            }

            if (pathname === "/api/llm/invoke" && request.method === "POST") {
                return setCorsHeaders(request, await handleLlmInvoke(request, env));
            }

            if (pathname === "/api/logs/user" && request.method === "POST") {
                return setCorsHeaders(request, await handleUserLogs(request));
            }

            if (pathname === "/api/snippets" && request.method === "GET") {
                return setCorsHeaders(request, await handleSnippets(request));
            }

            if (pathname === "/api/assignments" && (request.method === "GET" || request.method === "PATCH")) {
                return setCorsHeaders(request, await handleAssignments(request));
            }

            if (pathname === "/api/learning-paths" && request.method === "GET") {
                return setCorsHeaders(request, await handleLearningPaths(request));
            }

            if (pathname === "/api/learning-paths/analyze" && request.method === "POST") {
                return setCorsHeaders(request, await handleLearningPaths(request));
            }

            if (pathname === "/api/learning-paths/complete" && request.method === "PATCH") {
                return setCorsHeaders(request, await handleLearningPaths(request));
            }

            if (pathname === "/api/roleplay/sessions" && (request.method === "GET" || request.method === "POST")) {
                return setCorsHeaders(request, await handleRolePlaySessions(request));
            }

            if (pathname === "/api/scenarios" && (request.method === "GET" || request.method === "POST" || request.method === "PUT" || request.method === "DELETE")) {
                return setCorsHeaders(request, await handleCustomScenarios(request));
            }

            if (pathname === "/manager-insights" && request.method === "POST") {
                return setCorsHeaders(request, await handleManagerInsights(request, env));
            }

            if (pathname === "/api/manager/validation/start" && request.method === "POST") {
                return setCorsHeaders(request, await handleManagerValidationStart(request));
            }

            if (pathname === "/api/manager/validation/summary" && request.method === "GET") {
                return setCorsHeaders(request, await handleManagerValidationSummary(request));
            }

            if (pathname.startsWith("/api/manager/validation/rep/") && request.method === "GET") {
                const repId = pathname.split("/").pop();
                return setCorsHeaders(request, await handleManagerValidationRep(request, decodeURIComponent(repId || "")));
            }

            if (pathname.startsWith("/api/manager/validation/") && pathname.endsWith("/follow-up") && request.method === "POST") {
                const parts = pathname.split("/").filter(Boolean);
                const recordId = parts[3];
                return setCorsHeaders(request, await handleManagerValidationFollowUp(request, decodeURIComponent(recordId || "")));
            }

            // ============ STATIC FILES ============

            // Try to serve static assets
            const asset = await serveAsset(request, env, ctx);
            if (asset) {
                return asset;
            }

            // 404 for unknown routes
            return setCorsHeaders(request, new Response(
                JSON.stringify({ error: "Not Found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            ));

        } catch (error) {
            console.error("Worker error:", error);
            return setCorsHeaders(request, new Response(
                JSON.stringify({ error: "Internal server error", message: error.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            ));
        }
    }
};
