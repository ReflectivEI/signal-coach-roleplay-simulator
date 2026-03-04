// ============================================================================
// Cloudflare Worker - ReflectivAI Backend
// ============================================================================

import { getAssetFromKV } from "@cloudflare/kv-asset-handler";
import manifestJSON from "__STATIC_CONTENT_MANIFEST";
const assetManifest = JSON.parse(manifestJSON);

// ────────────────────────────────────────────────────────────────────────────
// CORS (UPDATED FOR reflectiv-ai.com)
// ────────────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGIN = "https://reflectiv-ai.com";

function setCorsHeaders(response) {
    response.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Cache-Control", "no-cache, must-revalidate");
    return response;
}

function handlePreflight() {
    return setCorsHeaders(new Response(null, { status: 204 }));
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

// ─── IN-MEMORY SESSION STORE (Development) ──────────────────────────────
const sessions = new Map();
const logs = [];
const rolePlaySessions = [];
const customScenarios = [];

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

const learningPaths = [
    { id: "lp1", title: "Signal Awareness Mastery", desc: "Master the first pillar of Signal Intelligence", modules: 5, progress: 60 },
    { id: "lp2", title: "Value Connection Excellence", desc: "Learn to connect product benefits to customer outcomes", modules: 4, progress: 40 },
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

// LLM: Invoke AI for coaching, analysis, or generation
async function handleLlmInvoke(request, env) {
    const body = await request.json().catch(() => ({}));
    const { prompt, response_json_schema, max_tokens = 2000, temperature = 0.7 } = body;

    if (!prompt) {
        return new Response(
            JSON.stringify({ error: "Missing prompt field" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    const openaiApiKey = env?.OPENAI_API_KEY;
    const groqApiKey = env?.GROQ_API_KEY;
    const requestedProvider = body?.provider;

    const provider = requestedProvider === "openai"
        ? "openai"
        : requestedProvider === "groq"
            ? "groq"
            : groqApiKey
                ? "groq"
                : openaiApiKey
                    ? "openai"
                    : null;

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
        const systemPrompt = `You are an expert sales coach helping healthcare professionals improve their sales skills. 
You provide behavioral feedback, coaching insights, scenario generation, and performance analysis.
Always respond with actionable, behavior-specific feedback.${response_json_schema ? "\nFormat your response as valid JSON matching the provided schema." : ""
            }`;

        const messages = [
            { role: "system", content: systemPrompt },
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

    if (!sessionToken || !sessions.has(sessionToken)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionData = sessions.get(sessionToken);
    const userId = sessionData.userId;

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

// Learning Paths: Get learning paths
async function handleLearningPaths(request) {
    if (request.method === "GET") {
        return Response.json({ learningPaths });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
}

// RolePlay Sessions: Save and retrieve roleplay session data
async function handleRolePlaySessions(request) {
    if (request.method === "POST") {
        try {
            const body = await request.json();
            const session = {
                id: body.id || Date.now().toString(),
                scenarioId: body.scenarioId,
                sessionData: body.sessionData || {},
                turns: body.turns || [],
                feedback: body.feedback || "",
                scores: body.scores || {},
                transcript: body.transcript || "",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            rolePlaySessions.push(session);
            return Response.json({ success: true, session });
        } catch (err) {
            return Response.json({ error: err.message }, { status: 400 });
        }
    }

    if (request.method === "GET") {
        return Response.json({ sessions: rolePlaySessions });
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
            return handlePreflight();
        }

        try {
            // ============ API ROUTES ============

            if (pathname === "/health") {
                return setCorsHeaders(await handleHealth());
            }

            if (pathname === "/api/auth/me" && request.method === "GET") {
                return setCorsHeaders(await handleAuthMe(request));
            }

            if (pathname === "/api/auth/login" && request.method === "POST") {
                return setCorsHeaders(await handleAuthLogin(request));
            }

            if (pathname === "/api/auth/logout" && request.method === "POST") {
                return setCorsHeaders(await handleAuthLogout(request));
            }

            if (pathname.startsWith("/api/apps/public/prod/public-settings/by-id/") && request.method === "GET") {
                return setCorsHeaders(await handleAppSettings(pathname));
            }

            if (pathname === "/api/llm/invoke" && request.method === "POST") {
                return setCorsHeaders(await handleLlmInvoke(request, env));
            }

            if (pathname === "/api/logs/user" && request.method === "POST") {
                return setCorsHeaders(await handleUserLogs(request));
            }

            if (pathname === "/api/snippets" && request.method === "GET") {
                return setCorsHeaders(await handleSnippets(request));
            }

            if (pathname === "/api/assignments" && (request.method === "GET" || request.method === "PATCH")) {
                return setCorsHeaders(await handleAssignments(request));
            }

            if (pathname === "/api/learning-paths" && request.method === "GET") {
                return setCorsHeaders(await handleLearningPaths(request));
            }

            if (pathname === "/api/roleplay/sessions" && (request.method === "GET" || request.method === "POST")) {
                return setCorsHeaders(await handleRolePlaySessions(request));
            }

            if (pathname === "/api/scenarios" && (request.method === "GET" || request.method === "POST" || request.method === "PUT" || request.method === "DELETE")) {
                return setCorsHeaders(await handleCustomScenarios(request));
            }

            // ============ STATIC FILES ============

            // Try to serve static assets
            const asset = await serveAsset(request, env, ctx);
            if (asset) {
                return asset;
            }

            // 404 for unknown routes
            return setCorsHeaders(new Response(
                JSON.stringify({ error: "Not Found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            ));

        } catch (error) {
            console.error("Worker error:", error);
            return setCorsHeaders(new Response(
                JSON.stringify({ error: "Internal server error", message: error.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            ));
        }
    }
};
