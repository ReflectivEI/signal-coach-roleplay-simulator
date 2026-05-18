import legacyWorker from "./src/index.js";
import { buildScenarioPrompt } from "./prompts/scenario";
import { buildEvaluationPrompt } from "./prompts/evaluation";
import {
    buildScenarioContract,
    detectCommitment,
    evaluateRepResponse,
    mapTemperatureToBehavior,
} from "./rps/engine.js";
import {
    buildHcpBrain,
    buildHcpBrainCoaching,
    buildHcpBrainPersonaContext,
    buildHcpBrainSummary,
    evaluateRepAgainstBrain,
} from "./rps/hcpBrain.js";
import {
    buildInitialHcpState,
    computeHcpStateProgression,
} from "./rps/hcpState.js";

type KvLike = {
    get: (key: string) => Promise<string | null>;
    put: (key: string, value: string) => Promise<void>;
};

type Env = {
    APP_DATA_KV?: KvLike;
    GROQ_API_KEY?: string;
    GROQ_API_KEY_SB_2?: string;
    GROQ_API_KEY_SB_3?: string;
    GROQ_API_KEY_SB_4?: string;
    GROQ_API_KEY_SB_5?: string;
    LLM_TIMEOUT_MS?: string;
};

const SESSION_KEY = "rps_adaptive_sessions_v1";
const allowedMethods = "GET,POST,OPTIONS";
const allowedHeaders = "Content-Type,Authorization";
const memoryStore: { sessions: unknown[] } = { sessions: [] };

const REQUIRED_SCENARIO_FIELDS = [
    "scenario_id",
    "opening_scene",
    "hcp_statement_or_question",
    "cue_signal",
    "cue_signal_layered",
    "hcp_likely_motivation",
    "journey_stage_context",
    "expected_rep_skill_response",
    "si_capabilities_tested",
    "behavioral_metrics_observed",
    "difficulty_level",
    "scoring_rubric",
    "temperature_behavior_modifiers",
    "conversation_memory",
    "hcp_brain",
    "hcp_brain_summary",
    "hcp_state",
] as const;

const REQUIRED_METRIC_KEYS = [
    "context_awareness",
    "cue_recognition",
    "empathy_acknowledgment",
    "strategic_questioning",
    "evidence_framing",
    "objection_handling",
    "conversational_control",
    "tone_pace_confidence",
] as const;

const REQUIRED_OUTCOME_FIELDS = [
    "commitment_attempted",
    "commitment_type",
    "commitment_strength",
    "hcp_progression",
    "conversation_advanced",
    "outcome_rationale",
    "expected_outcome_for_temperature",
    "actual_outcome",
    "outcome_quality",
    "gap_between_expected_and_actual",
    "commitment_attempt_quality",
    "progression_rationale",
    "temperature_adjusted_outcome_assessment",
    "expected_commitment_level_for_temperature",
    "actual_commitment_level",
    "outcome_alignment_to_temperature",
] as const;

const PREDICTIVE_BRAIN_BANNED_PHRASES = [
    "what's concretely different for me after this",
    "the practical answer has to stay tied",
    "what changes in practice if this is worth continuing",
    "i hear that a lot",
    "keep this brief",
    "keep it tight",
    "i need it kept focused",
    "before this feels relevant in practice",
    "before this feels actionable in practice",
    "this is closer, but i still need a clearer answer",
    "i'm not convinced yet",
] as const;

function withCors(response: Response, request: Request): Response {
    const headers = response.headers;
    const origin = request.headers.get("Origin") || "*";
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", allowedMethods);
    headers.set("Access-Control-Allow-Headers", allowedHeaders);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Cache-Control", "no-cache");
    return response;
}

function json(request: Request, payload: unknown, status = 200): Response {
    return withCors(
        new Response(JSON.stringify(payload), {
            status,
            headers: { "Content-Type": "application/json" },
        }),
        request,
    );
}

function preflight(request: Request): Response {
    return withCors(new Response(null, { status: 204 }), request);
}

function text(value: unknown, fallback = ""): string {
    const out = String(value ?? "").trim();
    return out || fallback;
}

function asObject<T extends Record<string, unknown>>(value: unknown, fallback: T): T {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as T;
    }
    return fallback;
}

function clampScore(value: unknown, fallback = 5): number {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(1, Math.min(10, Math.round(parsed)));
}

function requireRealismContract(value: unknown, source: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
        throw new Error(`Missing or invalid ${source}; expected integer realism 1-10.`);
    }
    return parsed;
}

function requireAdaptiveRealismContract(
    body: Record<string, unknown>,
    route: string,
    options: { includeInitialTemperature?: boolean } = {},
): number {
    const dropdowns = asObject(
        (body.selected_dropdowns || body.dropdown_selections) as Record<string, unknown>,
        {} as Record<string, unknown>,
    );
    const values = [
        dropdowns.realism,
        body.live_temperature,
        body.rep_selected_temperature,
        body.temperature,
    ].filter((value) => value !== undefined && value !== null && value !== "");

    if (options.includeInitialTemperature && body.initial_temperature !== undefined && body.initial_temperature !== null && body.initial_temperature !== "") {
        values.push(body.initial_temperature);
    }

    if (!values.length) {
        throw new Error(`Missing realism contract for ${route}.`);
    }

    const contractRealism = requireRealismContract(values[0], `${route} realism`);
    values.forEach((value) => {
        if (requireRealismContract(value, `${route} realism`) !== contractRealism) {
            throw new Error(`Realism contract mismatch for ${route}.`);
        }
    });

    return contractRealism;
}

function safeStructuredLog(route: string, missingFields: string[], normalizationApplied: boolean): void {
    if (!missingFields.length && !normalizationApplied) return;
    console.warn(JSON.stringify({
        route,
        missing_fields: missingFields,
        normalization_applied: normalizationApplied,
        timestamp: new Date().toISOString(),
    }));
}

function parseJsonObject(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start >= 0 && end > start) {
            return JSON.parse(raw.slice(start, end + 1));
        }
        throw new Error("invalid_json");
    }
}

let groqRoundRobinCursor = 0;

function getGroqKeyPool(env: Env): string[] {
    return [
        text(env.GROQ_API_KEY),
        text(env.GROQ_API_KEY_SB_2),
        text(env.GROQ_API_KEY_SB_3),
        text(env.GROQ_API_KEY_SB_4),
        text(env.GROQ_API_KEY_SB_5),
    ].filter(Boolean);
}

function rankGroqKeyPool(pool: string[]): string[] {
    if (pool.length <= 1) return [...pool];
    const offset = groqRoundRobinCursor % pool.length;
    const ranked = [...pool.slice(offset), ...pool.slice(0, offset)];
    groqRoundRobinCursor = (groqRoundRobinCursor + 1) % pool.length;
    return ranked;
}

function isGroqRateLimitResponse(responseText: string): boolean {
    return /rate limit|rate_limit|rate_limit_exceeded|tokens per minute|tpm|too many requests/i.test(responseText);
}

async function callGroq(env: Env, prompt: string, maxTokens: number): Promise<string> {
    const keyPool = getGroqKeyPool(env);
    if (!keyPool.length) return "";
    const rankedKeys = rankGroqKeyPool(keyPool);

    const timeoutMs = Math.max(8000, Number(env.LLM_TIMEOUT_MS || 25000));
    for (let index = 0; index < rankedKeys.length; index += 1) {
        const key = rankedKeys[index];
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${key}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    temperature: 0.2,
                    max_tokens: maxTokens,
                    messages: [{ role: "user", content: prompt }],
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                const retryable = response.status === 429 || response.status >= 500 || isGroqRateLimitResponse(errorText);
                if (retryable && index < rankedKeys.length - 1) {
                    continue;
                }
                return "";
            }

            const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
            return text(data?.choices?.[0]?.message?.content);
        } catch {
            if (index >= rankedKeys.length - 1) {
                return "";
            }
        } finally {
            clearTimeout(timeout);
        }
    }

    return "";
}

function sanitizeNoPhi(input: unknown): unknown {
    if (typeof input === "string") {
        return input
            .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
            .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[redacted-phone]")
            .replace(/\b\d{1,5}\s+[A-Za-z0-9.\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln)\b/gi, "[redacted-address]");
    }

    if (Array.isArray(input)) {
        return input.map(sanitizeNoPhi);
    }

    if (input && typeof input === "object") {
        const out: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
            out[key] = sanitizeNoPhi(value);
        }
        return out;
    }

    return input;
}

function normalizeQuestion(value: unknown): string {
    return text(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function isGenericHcpLine(value: unknown): boolean {
    const line = text(value).toLowerCase();
    return [
        "tell me more about your product",
        "how is this different",
        "i'm skeptical",
        "can you provide evidence",
        "this seems interesting",
    ].some((phrase) => line.includes(phrase));
}

function hasPredictiveBrainBannedPhrase(value: unknown): boolean {
    const normalized = text(value).toLowerCase();
    return PREDICTIVE_BRAIN_BANNED_PHRASES.some((phrase) => normalized.includes(phrase));
}

function naturalizePredictiveHcpLine(value: unknown): string {
    let line = text(value);
    if (!line) return "";

    const replacements: Array<[RegExp, string]> = [
        [/\bkeep it tight\b/gi, "Please keep this focused"],
        [/\bkeep this brief\b/gi, "Please keep this concise"],
        [/\bi need it kept focused\b/gi, "I need this to stay focused"],
        [/\bbefore this feels relevant in practice\b/gi, "before this is useful in my practice"],
        [/\bbefore this feels actionable in practice\b/gi, "before I can use this in practice"],
        [/\bthe practical answer has to stay tied\b/gi, "the answer has to connect directly to my clinical workflow"],
        [/\bwhat's concretely different for me after this\b/gi, "what specifically changes for my team after this"],
        [/\bwhat changes in practice if this is worth continuing\b/gi, "what specifically changes in my clinic if we continue this conversation"],
        [/\bi hear that a lot\b/gi, "I hear this claim often"],
    ];

    for (const [pattern, next] of replacements) {
        line = line.replace(pattern, next);
    }

    // De-template common synthetic opener.
    line = line.replace(
        /^this is closer,\s*but\s*i still need a clearer answer on\s*/i,
        "You're closer, but I still need a clear answer on ",
    );

    return line
        .replace(/\s+/g, " ")
        .trim();
}

function sanitizePredictiveHcpLine(value: unknown): string {
    const cleaned = naturalizePredictiveHcpLine(value)
        .replace(/^['"`\s]+|['"`\s]+$/g, "")
        .replace(/\s+/g, " ")
        .trim();
    if (!cleaned) return "";
    const sentences = cleaned.match(/[^.!?]+[.!?]?/g) || [cleaned];
    const sliced = sentences.slice(0, 2).join(" ").trim();
    if (hasPredictiveBrainBannedPhrase(sliced)) return "";
    return sliced;
}

function replaceLastHistoryLine(list: unknown, nextLine: string): string[] {
    const history = Array.isArray(list)
        ? list.map((item) => text(item)).filter(Boolean).slice(-8)
        : [];
    if (!nextLine) return history;
    if (!history.length) return [nextLine];
    history[history.length - 1] = nextLine;
    return history.slice(-8);
}

function summarizeConversationMemory(memory: Record<string, unknown>): string {
    const unresolved = Array.isArray(memory.unresolved_cues) ? memory.unresolved_cues.length : 0;
    const addressed = Array.isArray(memory.addressed_cues) ? memory.addressed_cues.length : 0;
    const resistanceTrend = text(memory.resistance_trend, "stable");
    const trustTrend = text(memory.trust_trend, "neutral");
    const opennessTrend = text(memory.openness_trend, "neutral");
    const deliveryTrend = text(memory.delivery_trend, "neutral");
    const perceivedListeningTrend = text(memory.perceived_listening_trend, "neutral");
    const lastCommitment = text(memory.last_commitment_attempt, "none");
    return `resistance_trend=${resistanceTrend}; trust_trend=${trustTrend}; openness_trend=${opennessTrend}; delivery_trend=${deliveryTrend}; perceived_listening_trend=${perceivedListeningTrend}; unresolved_cues=${unresolved}; addressed_cues=${addressed}; last_commitment_attempt=${lastCommitment}`;
}

function summarizeVoiceAdaptation(memory: Record<string, unknown>): string {
    const last = asObject(memory.last_voice_adaptation as Record<string, unknown>, {} as Record<string, unknown>);
    if (!Object.keys(last).length) return "none";
    return [
        `modifier=${text(last.hcp_reaction_modifier, "hold")}`,
        `pacing=${text(last.pacing_signal, "unknown")}`,
        `pause=${text(last.pause_signal, "unknown")}`,
        `question_delivery=${text(last.question_delivery_signal, "unknown")}`,
        `resistance_delta=${Number(last.resistance_delta ?? 0)}`,
        `trust_delta=${Number(last.trust_delta ?? 0)}`,
    ].join("; ");
}

function defaultLayeredCue(cueSignal: string, temp: ReturnType<typeof mapTemperatureToBehavior>) {
    const primary = cueSignal.replace(/_/g, " ") || "Practical decision relevance under constraints";
    return {
        primary_cue: primary,
        secondary_cue: "Workflow/access burden",
        hidden_resistance: "Prior low-value claim fatigue",
        openness_level: temp.band === "low" ? "Conditional" : temp.band === "mid" ? "Guarded" : "Minimal",
        emotional_tone: temp.band === "high" ? "Compressed, skeptical" : temp.band === "mid" ? "Professional but selective" : "Open but practical",
        likely_reason_for_pushback: "HCP needs practical impact, not broad feature framing.",
        what_the_rep_must_detect: "The HCP is testing real decision impact under time/workflow constraints.",
    };
}

function defaultConversationMemory(base: Record<string, unknown> = {}) {
    return {
        prior_rep_moves: Array.isArray(base.prior_rep_moves) ? base.prior_rep_moves : [],
        prior_hcp_reactions: Array.isArray(base.prior_hcp_reactions) ? base.prior_hcp_reactions : [],
        hcp_response_history: Array.isArray(base.hcp_response_history) ? base.hcp_response_history : [],
        intent_bucket_history: Array.isArray(base.intent_bucket_history) ? base.intent_bucket_history : [],
        unresolved_cues: Array.isArray(base.unresolved_cues) ? base.unresolved_cues : [],
        addressed_cues: Array.isArray(base.addressed_cues) ? base.addressed_cues : [],
        delivery_trend: text(base.delivery_trend, "neutral"),
        perceived_listening_trend: text(base.perceived_listening_trend, "neutral"),
        resistance_trend: text(base.resistance_trend, "stable"),
        trust_trend: text(base.trust_trend, "neutral"),
        openness_trend: text(base.openness_trend, "neutral"),
        voice_adaptation_history: Array.isArray(base.voice_adaptation_history) ? base.voice_adaptation_history : [],
        last_voice_adaptation: base.last_voice_adaptation || null,
        last_commitment_attempt: text(base.last_commitment_attempt, "none"),
    };
}

function normalizeMetric(metricValue: unknown, fallbackScore: number, fallbackRationale: string) {
    const metricObj = asObject(metricValue as Record<string, unknown>, {} as Record<string, unknown>);
    const rawScore = clampScore(metricObj.score_1_to_10 ?? metricObj.score ?? fallbackScore, fallbackScore);
    const score = rawScore <= 2 ? 2 : rawScore <= 4 ? 4 : rawScore <= 7 ? 8 : 10;
    return {
        score_1_to_10: score,
        rationale: text(metricObj.rationale, fallbackRationale),
    };
}

function computeDecisiveOverallScore(metrics: Record<string, unknown>): number {
    const weights: Record<string, number> = {
        context_awareness: 1.25,
        cue_recognition: 1.35,
        empathy_acknowledgment: 1.05,
        strategic_questioning: 1.2,
        evidence_framing: 1.1,
        objection_handling: 1.2,
        conversational_control: 1,
        tone_pace_confidence: 0.85,
    };

    const fiveScale = REQUIRED_METRIC_KEYS.map((key) => {
        const metric = asObject(metrics[key] as Record<string, unknown>, {} as Record<string, unknown>);
        const score10 = Number(metric.score_1_to_10 || 2);
        const score5 = score10 <= 2 ? 1 : score10 <= 4 ? 2 : score10 <= 8 ? 4 : 5;
        return { key, score5, weight: Number(weights[key] || 1) };
    });

    const weightedSum = fiveScale.reduce((sum, item) => sum + item.score5 * item.weight, 0);
    const totalWeight = fiveScale.reduce((sum, item) => sum + item.weight, 0) || 1;
    let overall5 = weightedSum / totalWeight;

    const criticalFailures = fiveScale.filter((item) => item.score5 === 1).length;
    const majorFailures = fiveScale.filter((item) => item.score5 <= 2).length;

    if (criticalFailures >= 1) {
        overall5 -= 0.85;
    }

    if (majorFailures >= 1) {
        overall5 = Math.min(overall5, 2.5);
    }

    if (criticalFailures >= 2) {
        overall5 = Math.min(overall5, 1.9);
    }

    const clamped5 = Math.max(1, Math.min(5, overall5));
    const scaled10 = Math.max(1, Math.min(10, Math.round(clamped5 * 2)));
    return scaled10;
}

function normalizeHcpBrainAlignment(value: unknown, fallback: Record<string, unknown> = {}) {
    const obj = asObject(value as Record<string, unknown>, fallback);
    return {
        quality_test_satisfied: Boolean(obj.quality_test_satisfied),
        credibility_drivers_demonstrated: Array.isArray(obj.credibility_drivers_demonstrated)
            ? obj.credibility_drivers_demonstrated
            : [],
        trust_breakers_triggered: Array.isArray(obj.trust_breakers_triggered)
            ? obj.trust_breakers_triggered
            : [],
        likely_objections_addressed: Boolean(obj.likely_objections_addressed),
        pressure_signals_detected: Boolean(obj.pressure_signals_detected),
        recommended_rep_approach_used: Boolean(obj.recommended_rep_approach_used),
        language_that_worked_used: Boolean(obj.language_that_worked_used),
        resistance_language_triggered: Boolean(obj.resistance_language_triggered),
        alignment_rationale: text(obj.alignment_rationale, "Alignment evaluated against Predictive HCP Brain."),
    };
}

function normalizeHcpBrainCoaching(value: unknown, fallback: Record<string, unknown> = {}) {
    const obj = asObject(value as Record<string, unknown>, fallback);
    return {
        quality_test_feedback: text(obj.quality_test_feedback, "Quality test not yet evaluated."),
        credibility_driver_feedback: text(obj.credibility_driver_feedback, "No explicit credibility driver feedback available."),
        trust_breaker_feedback: text(obj.trust_breaker_feedback, "No explicit trust breaker feedback available."),
        objection_alignment_feedback: text(obj.objection_alignment_feedback, "No objection alignment feedback available."),
        recommended_rep_move_feedback: text(obj.recommended_rep_move_feedback, "No recommended move feedback available."),
        improved_response_grounded_in_hcp_brain: text(
            obj.improved_response_grounded_in_hcp_brain,
            "Address the HCP's highest-priority concern first, then ask one precise diagnostic question.",
        ),
    };
}

function isGenericCoachingText(line: string): boolean {
    const normalized = line.toLowerCase();
    return [
        "ask more open-ended questions",
        "be more empathetic",
        "provide more evidence",
        "use better framing",
        "anchor to the cue",
    ].some((pattern) => normalized.includes(pattern));
}

function representativeRepPhrase(transcript: string): string {
    const sentence = text(transcript)
        .split(/[.!?]/)
        .map((part) => part.trim())
        .find(Boolean);
    if (!sentence) return "(no representative phrase)";
    return sentence.length > 130 ? `${sentence.slice(0, 127)}...` : sentence;
}

function ensureSpecificCoaching(evaluation: Record<string, unknown>, transcript: string, scenarioContext: Record<string, unknown>) {
    const currentFeedback = Array.isArray(evaluation.coaching_feedback)
        ? (evaluation.coaching_feedback as unknown[]).map((item) => text(item))
        : [];
    const phrase = representativeRepPhrase(transcript);
    const layered = asObject(scenarioContext.cue_signal_layered as Record<string, unknown>, {} as Record<string, unknown>);
    const cueHint = text(layered.what_the_rep_must_detect, "The HCP wants practical decision impact under constraints.");
    const existingIsSpecific = currentFeedback.some((item) => item.includes("When you said") && item.includes("\""));
    const existingIsGeneric = currentFeedback.length === 0 || currentFeedback.every((item) => isGenericCoachingText(item));

    if (!existingIsSpecific || existingIsGeneric) {
        evaluation.coaching_feedback = [
            `When you said \"${phrase}\", the HCP likely heard a broad claim instead of a response to their practical barrier.`,
            `Behavioral impact: resistance stays elevated because the core cue was not narrowed.`,
            `Stronger phrasing: \"When you say this may not change what you do Monday morning, is the bigger blocker prior authorization friction, staff burden, or fit uncertainty?\"`,
        ];
    }

    evaluation.better_phrasing = text(
        evaluation.better_phrasing,
        "When you say this may not change what you do Monday morning, is the bigger blocker prior authorization friction, staff burden, or fit uncertainty?",
    );
    evaluation.next_best_question = text(
        evaluation.next_best_question,
        "If we focus on one practical barrier first, which step would need to improve for this to be worth discussing further?",
    );
    evaluation.what_hcp_likely_heard = text(
        evaluation.what_hcp_likely_heard,
        `I heard a broad claim, not yet a practical response to my operating constraint. I need relevance to real workflow decisions. (${cueHint})`,
    );
    evaluation.improved_response_example = text(
        evaluation.improved_response_example,
        "I hear your workflow concern. Before we go further, is the larger issue prior-auth callbacks, staff time, or uncertainty on patient fit?",
    );

    const hcpBrain = asObject(scenarioContext.hcp_brain as Record<string, unknown>, {} as Record<string, unknown>);
    const qualityTest = text(
        asObject(hcpBrain.clinician_perspective as Record<string, unknown>, {} as Record<string, unknown>).quality_test_question,
    );
    if (qualityTest) {
        const coaching = Array.isArray(evaluation.coaching_feedback)
            ? (evaluation.coaching_feedback as string[])
            : [];
        const alreadyHasQualityTest = coaching.some((line) => line.toLowerCase().includes("quality test"));
        if (!alreadyHasQualityTest) {
            coaching.push(`HCP Brain quality test: ${qualityTest}`);
            evaluation.coaching_feedback = coaching;
        }
    }

    const deliveryCoaching = asObject(evaluation.delivery_coaching as Record<string, unknown>, {} as Record<string, unknown>);
    evaluation.delivery_coaching = {
        pacing_feedback: text(deliveryCoaching.pacing_feedback, "After acknowledgment, moderate your pace to avoid sounding like a pitch transition."),
        pause_feedback: text(deliveryCoaching.pause_feedback, "Insert a short pause after acknowledging the concern before asking a diagnostic question."),
        confidence_feedback: text(deliveryCoaching.confidence_feedback, "Use confident but non-absolute language to reduce perceived pressure."),
        question_delivery_feedback: text(deliveryCoaching.question_delivery_feedback, "Ask one diagnostic question tied to workflow, access, or fit criteria."),
        perceived_listening_feedback: text(deliveryCoaching.perceived_listening_feedback, "The HCP should feel you listened before you advanced."),
        recommended_delivery_adjustment: text(deliveryCoaching.recommended_delivery_adjustment, "Acknowledge, pause, then ask one narrow diagnostic question."),
        example_rephrasing_with_delivery_note: text(deliveryCoaching.example_rephrasing_with_delivery_note, "Pause after acknowledgment, then ask: \"When this stalls care, is the bigger issue prior auth friction, callback load, or patient-fit uncertainty?\""),
    };

    const deliveryImpact = asObject(evaluation.delivery_impact_on_hcp as Record<string, unknown>, {} as Record<string, unknown>);
    evaluation.delivery_impact_on_hcp = {
        perceived_by_hcp: text(deliveryImpact.perceived_by_hcp, "The HCP likely interpreted delivery as mixed listening signal."),
        likely_hcp_reaction: text(deliveryImpact.likely_hcp_reaction, "The HCP remains selective and probes for practical relevance."),
        impact_on_resistance: Number(deliveryImpact.impact_on_resistance ?? 0),
        impact_on_trust: Number(deliveryImpact.impact_on_trust ?? 0),
        coaching_implication: text(deliveryImpact.coaching_implication, "Delivery quality likely affected HCP receptivity and should be corrected before advancing claims."),
    };

    return evaluation;
}

export function normalizeScenarioResponse(
    raw: unknown,
    context: {
        baseScenario: Record<string, unknown>;
        temp: ReturnType<typeof mapTemperatureToBehavior>;
        liveTemperature: number;
        route: string;
    },
) {
    const parsed = asObject(raw as Record<string, unknown>, {} as Record<string, unknown>);
    const merged: Record<string, unknown> = {
        ...context.baseScenario,
        ...parsed,
    };

    const cueSignal = text(merged.cue_signal, text(context.baseScenario.cue_signal, "operationally_constrained"));
    const layeredCue = asObject(merged.cue_signal_layered as Record<string, unknown>, defaultLayeredCue(cueSignal, context.temp));
    const memory = asObject(merged.conversation_memory as Record<string, unknown>, defaultConversationMemory(asObject(context.baseScenario.conversation_memory as Record<string, unknown>, {} as Record<string, unknown>)));

    merged.scenario_id = text(merged.scenario_id, text(context.baseScenario.scenario_id, `rps-${Date.now()}`));
    merged.opening_scene = text(merged.opening_scene, text(context.baseScenario.opening_scene, "The HCP is balancing practical constraints and needs relevance quickly."));
    merged.hcp_statement_or_question = text(merged.hcp_statement_or_question, text(context.baseScenario.hcp_statement_or_question, "What concrete change would matter most in your workflow?"));
    merged.cue_signal = cueSignal;
    merged.cue_signal_layered = {
        ...defaultLayeredCue(cueSignal, context.temp),
        ...layeredCue,
    };
    merged.hcp_likely_motivation = text(merged.hcp_likely_motivation, text(context.baseScenario.hcp_likely_motivation, "Protect patient care quality while minimizing operational burden."));
    merged.journey_stage_context = text(merged.journey_stage_context, text(context.baseScenario.journey_stage_context, "Early decision stage under practical constraints."));
    merged.expected_rep_skill_response = text(merged.expected_rep_skill_response, text(context.baseScenario.expected_rep_skill_response, "Acknowledge cue, connect practical relevance, ask one diagnostic next-step question."));
    merged.si_capabilities_tested = Array.isArray(merged.si_capabilities_tested) ? merged.si_capabilities_tested : (context.baseScenario.si_capabilities_tested || []);
    merged.behavioral_metrics_observed = Array.isArray(merged.behavioral_metrics_observed) ? merged.behavioral_metrics_observed : (context.baseScenario.behavioral_metrics_observed || []);
    merged.difficulty_level = text(merged.difficulty_level, context.temp.band);
    merged.scoring_rubric = Array.isArray(merged.scoring_rubric) ? merged.scoring_rubric : (context.baseScenario.scoring_rubric || []);
    merged.temperature_behavior_modifiers = {
        ...context.temp,
    };
    merged.initial_temperature = Number(merged.initial_temperature ?? context.liveTemperature);
    merged.live_temperature = Number(merged.live_temperature ?? context.liveTemperature);
    merged.temperature_shift_history = Array.isArray(merged.temperature_shift_history)
        ? merged.temperature_shift_history
        : [];
    merged.hcp_brain = asObject(merged.hcp_brain as Record<string, unknown>, asObject(context.baseScenario.hcp_brain as Record<string, unknown>, {} as Record<string, unknown>));
    merged.hcp_brain_summary = asObject(merged.hcp_brain_summary as Record<string, unknown>, asObject(context.baseScenario.hcp_brain_summary as Record<string, unknown>, {} as Record<string, unknown>));
    merged.conversation_memory = {
        ...defaultConversationMemory(memory),
        ...memory,
    };

    if (!merged.hcp_state) {
        merged.hcp_state = buildInitialHcpState(
            merged.hcp_brain as Record<string, unknown>,
            context.liveTemperature,
        );
    }

    if (isGenericHcpLine(merged.hcp_statement_or_question)) {
        merged.hcp_statement_or_question = text(context.baseScenario.hcp_statement_or_question, "What practical barrier would need to change first for this to feel relevant?");
    }

    const missing = REQUIRED_SCENARIO_FIELDS.filter((field) => merged[field] === undefined || merged[field] === null || merged[field] === "");
    safeStructuredLog(context.route, [...missing], missing.length > 0);

    return merged;
}

function normalizeOutcomeAnalysis(
    rawOutcome: unknown,
    deterministicOutcome: Record<string, unknown>,
    transcript: string,
    liveTemperature: number,
) {
    const out = {
        ...deterministicOutcome,
        ...asObject(rawOutcome as Record<string, unknown>, {} as Record<string, unknown>),
    } as Record<string, unknown>;

    const lower = text(transcript).toLowerCase();
    const hasDiagnosticQuestion = /\b(what|how|which|where|when|is|can|would|could)\b/.test(lower) && lower.includes("?");
    const hasContext = /\b(prior auth|workflow|access|staff|barrier|patient type|fit)\b/.test(lower);
    const highTemp = liveTemperature >= 8;

    if (highTemp && !out.commitment_attempted && hasDiagnosticQuestion && hasContext) {
        out.commitment_attempted = true;
        out.commitment_type = text(out.commitment_type) === "none" ? "permission_to_continue" : text(out.commitment_type, "permission_to_continue");
        out.commitment_strength = text(out.commitment_strength) === "none" ? "moderate" : text(out.commitment_strength, "moderate");
        out.hcp_progression = text(out.hcp_progression, "slightly_advanced");
        out.conversation_advanced = true;
        out.outcome_quality = text(out.outcome_quality, "good");
    }

    if (highTemp && !out.commitment_attempted && ["good", "strong"].includes(text(out.outcome_quality))) {
        out.commitment_attempted = true;
        out.commitment_type = text(out.commitment_type) === "none" ? "permission_to_continue" : text(out.commitment_type, "permission_to_continue");
        out.commitment_strength = text(out.commitment_strength) === "none" ? "weak" : text(out.commitment_strength, "weak");
        out.conversation_advanced = true;
    }

    out.commitment_attempted = Boolean(out.commitment_attempted);
    out.commitment_type = text(out.commitment_type, out.commitment_attempted ? "agreement_to_consider" : "none");
    out.commitment_strength = text(out.commitment_strength, out.commitment_attempted ? "weak" : "none");
    out.hcp_progression = text(out.hcp_progression, out.conversation_advanced ? "slightly_advanced" : "unchanged");
    out.conversation_advanced = Boolean(out.conversation_advanced);
    out.outcome_rationale = text(out.outcome_rationale, "Outcome determined from cue alignment, questioning quality, and resistance level.");
    out.expected_outcome_for_temperature = text(out.expected_outcome_for_temperature, highTemp
        ? "Reduced resistance or permission to continue counts as meaningful progress."
        : liveTemperature <= 3
            ? "Expect clearer next-step commitment or specific follow-up movement."
            : "Expect barrier clarification or fit exploration movement.");
    out.actual_outcome = text(out.actual_outcome, out.conversation_advanced ? "progressed" : "no_clear_progression");
    out.outcome_quality = text(out.outcome_quality, out.conversation_advanced ? "good" : "limited");
    out.gap_between_expected_and_actual = text(out.gap_between_expected_and_actual, out.conversation_advanced ? "moderate" : "high");
    out.commitment_attempt_quality = text(out.commitment_attempt_quality, out.commitment_attempted ? (text(out.commitment_strength) || "moderate") : "none");
    out.progression_rationale = text(out.progression_rationale, out.outcome_rationale);
    out.temperature_adjusted_outcome_assessment = text(out.temperature_adjusted_outcome_assessment, highTemp
        ? "High-temperature context evaluated with reduced-resistance threshold."
        : "Outcome evaluated against standard progression expectations for current temperature.");
    out.expected_commitment_level_for_temperature = text(out.expected_commitment_level_for_temperature, highTemp ? "moderate_or_permission" : liveTemperature <= 3 ? "moderate_to_strong" : "moderate");
    out.actual_commitment_level = text(out.actual_commitment_level, out.commitment_strength);
    out.outcome_alignment_to_temperature = text(out.outcome_alignment_to_temperature, out.conversation_advanced ? "aligned" : "underperformed");

    return out;
}

export function normalizeEvaluationResponse(
    raw: unknown,
    context: {
        deterministic: Record<string, unknown>;
        transcript: string;
        scenarioContext: Record<string, unknown>;
        liveTemperature: number;
        route: string;
    },
) {
    const parsed = asObject(raw as Record<string, unknown>, {} as Record<string, unknown>);
    const deterministic = asObject(context.deterministic, {} as Record<string, unknown>);
    const merged: Record<string, unknown> = {
        ...deterministic,
        ...parsed,
    };

    const deterministicMetrics = asObject(deterministic.metric_scores as Record<string, unknown>, {} as Record<string, unknown>);
    const rawMetrics = asObject(merged.metric_scores as Record<string, unknown>, {} as Record<string, unknown>);
    const metrics: Record<string, unknown> = {};

    for (const key of REQUIRED_METRIC_KEYS) {
        metrics[key] = normalizeMetric(
            rawMetrics[key],
            asObject(deterministicMetrics[key] as Record<string, unknown>, {} as Record<string, unknown>).score_1_to_10 as number || 5,
            text(asObject(deterministicMetrics[key] as Record<string, unknown>, {} as Record<string, unknown>).rationale, "No rationale provided."),
        );
    }

    const computedOverall = computeDecisiveOverallScore(metrics);
    let overall = clampScore(merged.overall_score, computedOverall);
    const transcriptLower = text(context.transcript).toLowerCase();
    const lacksCueAlignment = !/\b(prior auth|workflow|access|staff|barrier|fit)\b/.test(transcriptLower);
    const noQuestion = !context.transcript.includes("?");
    const noAck = !/\b(i hear|i understand|that makes sense|fair point|you'?re right)\b/i.test(context.transcript);
    const strongDiagnostic = /\b(what|how|which|where|when|is|can|would|could)\b/i.test(context.transcript) && context.transcript.includes("?") && /\b(prior auth|workflow|access|staff|barrier|fit)\b/i.test(context.transcript);

    if ((noQuestion && lacksCueAlignment) || (noAck && lacksCueAlignment)) {
        overall = Math.min(overall, 5);
    }
    if (strongDiagnostic && overall < 7) {
        overall = 7;
    }

    const outcome = normalizeOutcomeAnalysis(
        merged.outcome_analysis,
        asObject(deterministic.outcome_analysis as Record<string, unknown>, {} as Record<string, unknown>),
        context.transcript,
        context.liveTemperature,
    );

    merged.overall_score = overall;
    merged.metric_scores = metrics;
    merged.score_rationale = {
        ...asObject(deterministic.score_rationale as Record<string, unknown>, {} as Record<string, unknown>),
        ...asObject(merged.score_rationale as Record<string, unknown>, {} as Record<string, unknown>),
        runtime_guardrails_applied: {
            cue_alignment_cap_applied: (noQuestion && lacksCueAlignment) || (noAck && lacksCueAlignment),
            strong_diagnostic_floor_applied: strongDiagnostic,
        },
    };
    merged.observed_strengths = Array.isArray(merged.observed_strengths) ? merged.observed_strengths : [];
    merged.missed_cues = Array.isArray(merged.missed_cues) ? merged.missed_cues : [];
    merged.delivery_issues = Array.isArray(merged.delivery_issues) ? merged.delivery_issues : [];
    merged.outcome_analysis = outcome;
    merged.hcp_brain_alignment = normalizeHcpBrainAlignment(
        merged.hcp_brain_alignment,
        asObject(deterministic.hcp_brain_alignment as Record<string, unknown>, {} as Record<string, unknown>),
    );
    merged.hcp_brain_coaching = normalizeHcpBrainCoaching(
        merged.hcp_brain_coaching,
        asObject(deterministic.hcp_brain_coaching as Record<string, unknown>, {} as Record<string, unknown>),
    );

    const rawHcpState = asObject(merged.hcp_state as Record<string, unknown>, {} as Record<string, unknown>);
    merged.hcp_state = Object.keys(rawHcpState).length > 0 ? rawHcpState : null;
    const rawHcpStateDelta = asObject(merged.hcp_state_delta as Record<string, unknown>, {} as Record<string, unknown>);
    merged.hcp_state_delta = Object.keys(rawHcpStateDelta).length > 0 ? rawHcpStateDelta : null;
    merged.hcp_response_type = text(merged.hcp_response_type as string, "restate_surface_concern");
    merged.response_type_reason = text(
        merged.response_type_reason as string,
        "Response type selected from HCP state, REP quality, temperature, and delivery signals.",
    );
    merged.previous_response_types = Array.isArray(merged.previous_response_types)
        ? merged.previous_response_types
        : (Array.isArray(rawHcpState.previous_response_types) ? rawHcpState.previous_response_types.slice(-6) : []);
    merged.response_type_transition_explanation = text(
        merged.response_type_transition_explanation as string,
        "Initial response type selection.",
    );
    merged.hcp_progression_explanation = text(merged.hcp_progression_explanation as string, "No significant HCP state change this turn.");

    merged.conversation_memory = {
        ...defaultConversationMemory(asObject(context.scenarioContext.conversation_memory as Record<string, unknown>, {} as Record<string, unknown>)),
        ...asObject(merged.conversation_memory as Record<string, unknown>, {} as Record<string, unknown>),
    };

    const adaptation = asObject(merged.voice_behavior_adaptation as Record<string, unknown>, {} as Record<string, unknown>);
    merged.voice_behavior_adaptation = {
        pacing_signal: text(adaptation.pacing_signal, "unknown"),
        pause_signal: text(adaptation.pause_signal, "unknown"),
        filler_signal: text(adaptation.filler_signal, "unknown"),
        confidence_signal: text(adaptation.confidence_signal, "unknown"),
        question_delivery_signal: text(adaptation.question_delivery_signal, "no_question"),
        perceived_listening_signal: text(adaptation.perceived_listening_signal, "moderate"),
        delivery_pressure_signal: text(adaptation.delivery_pressure_signal, "neutral"),
        hcp_reaction_modifier: text(adaptation.hcp_reaction_modifier, "hold"),
        resistance_delta: Number(adaptation.resistance_delta ?? 0),
        openness_delta: Number(adaptation.openness_delta ?? 0),
        trust_delta: Number(adaptation.trust_delta ?? 0),
        cue_intensity_delta: Number(adaptation.cue_intensity_delta ?? 0),
        next_turn_guidance: text(adaptation.next_turn_guidance, "Maintain neutral-selective HCP stance with practical relevance checks."),
    };

    ensureSpecificCoaching(merged, context.transcript, context.scenarioContext);

    if (context.liveTemperature >= 8) {
        const coaching = Array.isArray(merged.coaching_feedback)
            ? (merged.coaching_feedback as unknown[]).map((item) => text(item)).filter(Boolean)
            : [];
        const mentionsHighTemp = coaching.some((line) => /high realism pressure|high temperature|high-resistance|high resistance/i.test(line));
        if (!mentionsHighTemp) {
            coaching.push("High realism pressure guidance: at high resistance, prioritize reduced resistance and permission-to-continue over immediate hard commitment.");
            merged.coaching_feedback = coaching;
        }
    }

    const missing = [
        ...(merged.overall_score ? [] : ["overall_score"]),
        ...REQUIRED_METRIC_KEYS.filter((key) => !asObject(merged.metric_scores as Record<string, unknown>, {} as Record<string, unknown>)[key]),
        ...REQUIRED_OUTCOME_FIELDS.filter((field) => (asObject(merged.outcome_analysis as Record<string, unknown>, {} as Record<string, unknown>)[field] === undefined)),
    ];
    safeStructuredLog(context.route, missing.map((item) => String(item)), missing.length > 0);

    return merged;
}

function pickRegeneratedQuestion(previous: string, baseFallback: string): string {
    const variants = [
        "What concrete change would your team need to see before this feels worth trying?",
        "If we tested this for one week, what outcome would matter most to you?",
        "What concern should we solve first so this feels practical for your workflow?",
        "Which barrier would need to move first for you to consider a pilot?",
        "What would make this feel low-risk enough to discuss with your team?",
    ];

    const previousNormalized = normalizeQuestion(previous);
    const next = variants.find((item) => normalizeQuestion(item) !== previousNormalized);
    return next || baseFallback;
}

function stripAuthoredHcpStateForPredictivePrompt(hcpState: Record<string, unknown>): Record<string, unknown> {
    const next = { ...hcpState };
    delete next.last_hcp_response_text;
    delete next.hcp_response_history;
    return next;
}

function buildScenarioSpecificFallbackLine({
    hcpState,
    scenarioContext,
    responseType,
    liveTemperature,
}: {
    hcpState: Record<string, unknown>;
    scenarioContext: Record<string, unknown>;
    responseType: string;
    liveTemperature: number;
}): string {
    const barrier = text(
        hcpState.current_primary_barrier,
        text(hcpState.current_secondary_barrier, text(scenarioContext.cue_signal, "the practical barrier")),
    ).replace(/\s+/g, " ").replace(/[.,;:\s]+$/g, "").trim() || "the practical barrier";

    if (responseType === "disengage") {
        return sanitizePredictiveHcpLine(
            `We are short on time, and I still do not have a clear answer on ${barrier}.`,
        );
    }

    if (["soft_next_step", "permission_to_continue", "conditionally_open"].includes(responseType)) {
        return sanitizePredictiveHcpLine(
            liveTemperature >= 8
                ? `This is closer, but I still need a clearer answer on ${barrier} before I move it forward.`
                : `This is closer, but I still need a clearer answer on ${barrier} before this feels actionable in practice.`,
        );
    }

    return sanitizePredictiveHcpLine(
        liveTemperature >= 8
            ? `I still need a clearer answer on ${barrier}, and I need it kept focused.`
            : `I still need a clearer answer on ${barrier} before this feels relevant in practice.`,
    );
}

function isUsablePredictiveCandidate(candidate: string, previousHcpLine: string): boolean {
    if (!candidate) return false;
    if (hasPredictiveBrainBannedPhrase(candidate) || isGenericHcpLine(candidate)) return false;
    if (/^keep it tight\b/i.test(candidate)) return false;
    if (previousHcpLine && normalizeQuestion(candidate) === normalizeQuestion(previousHcpLine)) return false;
    return true;
}

async function authorPredictiveHcpResponse({
    env,
    transcript,
    scenarioContext,
    conversationMemory,
    hcpBrain,
    hcpBrainContext,
    liveTemperature,
    deterministicLine,
    hcpState,
    hcpStateDelta,
    responseType,
    responseTypeReason,
    progressionExplanation,
    intentBucket,
}: {
    env: Env;
    transcript: string;
    scenarioContext: Record<string, unknown>;
    conversationMemory: Record<string, unknown>;
    hcpBrain: Record<string, unknown>;
    hcpBrainContext: string;
    liveTemperature: number;
    deterministicLine: string;
    hcpState: Record<string, unknown>;
    hcpStateDelta: Record<string, unknown>;
    responseType: string;
    responseTypeReason: string;
    progressionExplanation: string;
    intentBucket: string;
}): Promise<string> {
    const previousHcpLine = text(
        conversationMemory.last_hcp_response_text,
        text((Array.isArray(conversationMemory.hcp_response_history)
            ? conversationMemory.hcp_response_history[conversationMemory.hcp_response_history.length - 1]
            : ""), ""),
    );
    const lastResponseType = text(
        Array.isArray(conversationMemory.response_type_history)
            ? conversationMemory.response_type_history[conversationMemory.response_type_history.length - 1]
            : "",
        "unknown",
    );
    const addressedPriorAsk = ["concern_partially_addressed", "deeper_barrier_revealed"].includes(
        text(hcpStateDelta.concern_movement),
    );
    const unresolvedConcern = [
        text(hcpState.current_primary_barrier),
        text(hcpState.current_secondary_barrier),
        ...(Array.isArray(hcpState.unresolved_concerns) ? hcpState.unresolved_concerns.map((item) => text(item)).filter(Boolean) : []),
        ...(Array.isArray(hcpState.revealed_concerns) ? hcpState.revealed_concerns.map((item) => text(item)).filter(Boolean) : []),
    ].filter(Boolean).slice(0, 3).join(" | ");

    const buildPrompt = (retryReason = "") => `You are authoring the next HCP spoken line for a pharma role-play simulator.

Use the Predictive HCP Brain as the source of truth.
Deterministic state progression, response type, temperature, and anti-loop metadata are validator constraints, not canned copy sources.
Match the quality bar of the Predictive Builder Test HCP Response: concrete, context-aware, adaptive, realistic, and continuous with the prior turn.

Predictive HCP Brain:
${hcpBrainContext || JSON.stringify(hcpBrain)}

Current turn context:
- Latest REP message: ${transcript}
- Previous HCP line: ${previousHcpLine || "none"}
- Previous HCP response type: ${lastResponseType}
- REP addressed prior ask: ${addressedPriorAsk ? "yes" : "no"}
- Journey stage: ${text(scenarioContext.journey_stage || scenarioContext.journeyStage, "unknown")}
- Current HCP state: ${JSON.stringify(hcpState)}
- State delta: ${JSON.stringify(hcpStateDelta)}
- Response type constraint: ${responseType}
- Response type reason: ${responseTypeReason}
- Progression explanation: ${progressionExplanation}
- Intent bucket: ${intentBucket || "unknown"}
- Live temperature: ${liveTemperature}/10
- Unresolved concern: ${unresolvedConcern || "not provided"}
- Scenario opening: ${text(scenarioContext.opening_scene || scenarioContext.openingScene, "not provided")}
- Scenario cue: ${text(scenarioContext.cue_signal, "not provided")}
- Deterministic state output is validator metadata only and must not be copied into HCP dialogue.
${retryReason ? `- Retry guidance: ${retryReason}` : ""}

Hard rules:
- Speak as this specific HCP, not as a guardrail or simulator.
- Respond to the latest REP message first, then preserve the HCP's predictive/adaptive state.
- Keep the same clinical or operational concern family without routing the line into canned access/workflow/evidence menu language.
- The line must feel like a real clinician speaking in the moment.
- 1-2 sentences maximum.
- Do not repeat the previous HCP sentence.
- Do not use global stock phrases or generic training language.
- Do not use any of these phrases: ${PREDICTIVE_BRAIN_BANNED_PHRASES.join("; ")}.
- Use the deterministic response type only as a behavioral target, not as wording.
- If the prior REP answer was generic or evasive, sharpen or restate the blocker in new words.
- If the prior REP answer earned progress, acknowledge that progress without sounding scripted.
- Do not copy the validator-only fallback, right-panel recommendation text, or generic menu labels as the HCP dialogue.

Return ONLY the final HCP line.`;

    const aiText = await callGroq(env, buildPrompt(), 180);
    const candidate = sanitizePredictiveHcpLine(aiText);
    if (isUsablePredictiveCandidate(candidate, previousHcpLine)) return candidate;

    const retryReason = !candidate
        ? "The prior draft was empty. Regenerate with a natural clinician line grounded in the Predictive HCP Brain."
        : previousHcpLine && normalizeQuestion(candidate) === normalizeQuestion(previousHcpLine)
            ? "The prior draft repeated the last HCP line. Regenerate with new wording and forward continuity."
            : "The prior draft sounded generic or reused stock phrasing. Regenerate with scenario-specific wording.";

    const retryText = await callGroq(env, buildPrompt(retryReason), 180);
    const retryCandidate = sanitizePredictiveHcpLine(retryText);
    if (isUsablePredictiveCandidate(retryCandidate, previousHcpLine)) return retryCandidate;

    return "";
}

async function readSessions(env: Env): Promise<unknown[]> {
    if (env.APP_DATA_KV) {
        const raw = await env.APP_DATA_KV.get(SESSION_KEY);
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw) as unknown[];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return memoryStore.sessions;
}

async function writeSessions(env: Env, sessions: unknown[]): Promise<void> {
    if (env.APP_DATA_KV) {
        await env.APP_DATA_KV.put(SESSION_KEY, JSON.stringify(sessions.slice(0, 300)));
        return;
    }
    memoryStore.sessions = sessions.slice(0, 300);
}

async function handleGenerateScenario(request: Request, env: Env): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const wantsRegenerate = Boolean(body.regenerate_question);
    const previousQuestion = text(body.previous_hcp_statement_or_question);
    const baseScenario = buildScenarioContract(body);
    const liveTemperature = requireAdaptiveRealismContract(body, "/api/rps/generate-scenario");
    const temp = mapTemperatureToBehavior(liveTemperature);
    const conversationMemory = ((body.conversation_memory || body.scenario_memory || {}) as Record<string, unknown>);
    const hcpBrain = buildHcpBrain({
        disease_state: body.disease_state,
        specialty_hcp_type: body.specialty_hcp_type,
        hcp_type: body.hcp_type,
        journey_stage: body.journey_stage,
        interaction_pressure: body.interaction_pressure,
        influence_driver: body.influence_driver,
        behavior_archetype: body.behavior_archetype,
        initial_temperature: liveTemperature,
        live_temperature: liveTemperature,
    });
    const hcpBrainSummary = buildHcpBrainSummary(hcpBrain);
    const hcpBrainContext = buildHcpBrainPersonaContext(hcpBrain);

    (baseScenario as Record<string, unknown>).hcp_brain = hcpBrain;
    (baseScenario as Record<string, unknown>).hcp_brain_summary = hcpBrainSummary;

    const prompt = buildScenarioPrompt({
        hcpProfile: text(body.hcp_profile, "Treating clinician"),
        journeyStage: text(body.journey_stage, "discovery"),
        diseaseState: text(body.disease_state, "general"),
        interactionPressure: text(body.interaction_pressure, "operationally_constrained"),
        accessBarrierContext: text(body.access_barrier_context, "Access complexity exists."),
        repObjective: text(body.rep_objective, "Advance a realistic next step."),
        difficultyLabel: temp.band,
        behavioralTraits: temp.traits,
        liveTemperature,
        conversationMemorySummary: summarizeConversationMemory(conversationMemory),
        voiceBehaviorAdaptationSummary: summarizeVoiceAdaptation(conversationMemory),
        hcpBrainContext,
    });

    const context = { baseScenario: baseScenario as Record<string, unknown>, temp, liveTemperature, route: "/api/rps/generate-scenario" };
    const aiText = await callGroq(env, prompt, 700);
    if (!aiText) {
        const normalized = normalizeScenarioResponse(baseScenario, context);
        if (wantsRegenerate && previousQuestion) {
            const generatedQuestion = text(normalized.hcp_statement_or_question, text(baseScenario.hcp_statement_or_question));
            if (normalizeQuestion(generatedQuestion) === normalizeQuestion(previousQuestion)) {
                normalized.hcp_statement_or_question = pickRegeneratedQuestion(previousQuestion, generatedQuestion);
            }
        }
        return json(request, normalized);
    }

    try {
        const parsed = parseJsonObject(aiText) as Record<string, unknown>;
        const merged = normalizeScenarioResponse({ ...baseScenario, ...parsed }, context);

        if (wantsRegenerate && previousQuestion) {
            const generatedQuestion = text(merged.hcp_statement_or_question, baseScenario.hcp_statement_or_question);
            if (normalizeQuestion(generatedQuestion) === normalizeQuestion(previousQuestion)) {
                merged.hcp_statement_or_question = pickRegeneratedQuestion(previousQuestion, generatedQuestion);
            }
        }

        return json(request, merged);
    } catch {
        if (wantsRegenerate && previousQuestion) {
            return json(request, normalizeScenarioResponse({
                ...baseScenario,
                hcp_statement_or_question: pickRegeneratedQuestion(previousQuestion, text(baseScenario.hcp_statement_or_question)),
            }, context));
        }
        return json(request, normalizeScenarioResponse(baseScenario, context));
    }
}

async function handleEvaluateResponse(request: Request, env: Env): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const transcript = text(body.rep_response_transcript);
    if (!transcript) {
        return json(request, { error: "rep_response_transcript is required" }, 400);
    }

    const scenarioContext = (body.scenario_context || {}) as Record<string, unknown>;
    const cueSignal = text(scenarioContext.cue_signal, "cue");
    const repSelectedTemperature = requireAdaptiveRealismContract(body, "/api/rps/evaluate-response");
    const conversationMemory = (body.conversation_memory || scenarioContext.conversation_memory || {}) as Record<string, unknown>;
    const selectedDropdowns = asObject(body.selected_dropdowns as Record<string, unknown>, {} as Record<string, unknown>);
    const hcpBrain = asObject(
        (body.hcp_brain || scenarioContext.hcp_brain) as Record<string, unknown>,
        buildHcpBrain({
            disease_state: selectedDropdowns.disease_state || body.disease_state,
            specialty_hcp_type: selectedDropdowns.specialty_hcp_type || selectedDropdowns.hcp_type || body.hcp_type,
            hcp_type: selectedDropdowns.hcp_type || body.hcp_type,
            journey_stage: selectedDropdowns.journey_stage || body.journey_stage,
            interaction_pressure: selectedDropdowns.interaction_pressure || body.interaction_pressure,
            influence_driver: selectedDropdowns.influence_driver || body.influence_driver,
            behavior_archetype: selectedDropdowns.behavior_archetype || body.behavior_archetype,
            initial_temperature: repSelectedTemperature,
            live_temperature: repSelectedTemperature,
        }) as Record<string, unknown>,
    );
    const hcpBrainAlignment = evaluateRepAgainstBrain(transcript, hcpBrain);
    const hcpBrainCoaching = buildHcpBrainCoaching(hcpBrainAlignment, hcpBrain, representativeRepPhrase(transcript));
    const hcpBrainContext = buildHcpBrainPersonaContext(hcpBrain);

    const deterministic = evaluateRepResponse({
        repResponseTranscript: transcript,
        voiceMetadata: body.voice_metadata || {},
        cueSignal,
        repSelectedTemperature,
        scenarioContext,
        conversationMemory,
        hcpBrain,
        previousHcpState: (conversationMemory.hcp_state || scenarioContext.hcp_state) as Record<string, unknown> || null,
    });
    const deterministicWithBrain = {
        ...(deterministic as Record<string, unknown>),
        hcp_brain_alignment: hcpBrainAlignment,
        hcp_brain_coaching: hcpBrainCoaching,
    };

    const fullEvalForState = {
        overall_score: Number((deterministic as Record<string, unknown>).overall_score || 0),
        outcome_analysis: (deterministic as Record<string, unknown>).outcome_analysis,
        hcp_brain_alignment: hcpBrainAlignment,
    };
    const voiceAdaptationForState = asObject(
        (deterministic as Record<string, unknown>).voice_behavior_adaptation as Record<string, unknown>,
        {} as Record<string, unknown>,
    );
    const previousHcpStateForFull = (conversationMemory.hcp_state || scenarioContext.hcp_state) as Record<string, unknown> || null;
    const fullStateProgression = computeHcpStateProgression({
        hcpBrain,
        previousHcpState: previousHcpStateForFull,
        repResponseTranscript: transcript,
        evaluation: fullEvalForState,
        voiceBehaviorAdaptation: voiceAdaptationForState,
        liveTemperature: repSelectedTemperature,
        conversationMemory,
        scenarioContext,
    });

    const deterministicSimulatedResponse = text(fullStateProgression.simulated_hcp_next_response);
    const predictivePromptState = stripAuthoredHcpStateForPredictivePrompt(
        asObject(fullStateProgression.hcp_state as Record<string, unknown>, {} as Record<string, unknown>),
    );
    const predictiveAuthoredResponse = sanitizePredictiveHcpLine(await authorPredictiveHcpResponse({
        env,
        transcript,
        scenarioContext,
        conversationMemory,
        hcpBrain,
        hcpBrainContext,
        liveTemperature: repSelectedTemperature,
        deterministicLine: deterministicSimulatedResponse,
        hcpState: predictivePromptState,
        hcpStateDelta: asObject(fullStateProgression.hcp_state_delta as Record<string, unknown>, {} as Record<string, unknown>),
        responseType: text(fullStateProgression.hcp_response_type),
        responseTypeReason: text(fullStateProgression.response_type_reason),
        progressionExplanation: text(fullStateProgression.hcp_progression_explanation),
        intentBucket: text(fullStateProgression.intent_bucket),
    }));
    if (!predictiveAuthoredResponse) {
        return json(request, {
            error: "predictive_hcp_authoring_failed",
            details: "Predictive Brain did not return a usable HCP line. Deterministic HCP fallback authoring is disabled by contract.",
            predictive_hcp_response_source: "predictive_brain_unavailable",
            hcp_authoring_contract: "predictive_brain_required",
            hcp_response_type: fullStateProgression.hcp_response_type,
            intent_bucket: fullStateProgression.intent_bucket,
            anti_loop_intervention_triggered: Boolean(fullStateProgression.anti_loop_intervention_triggered),
            semantic_similarity_max: fullStateProgression.semantic_similarity_max,
        }, 502);
    }
    const predictiveSimulatedResponse = predictiveAuthoredResponse;

    const enrichedHcpState = {
        ...asObject(fullStateProgression.hcp_state as Record<string, unknown>, {} as Record<string, unknown>),
        last_hcp_response_text: predictiveSimulatedResponse,
        hcp_response_history: replaceLastHistoryLine(
            asObject(fullStateProgression.hcp_state as Record<string, unknown>, {} as Record<string, unknown>).hcp_response_history,
            predictiveSimulatedResponse,
        ),
    };

    (deterministicWithBrain as Record<string, unknown>).hcp_state = enrichedHcpState;
    (deterministicWithBrain as Record<string, unknown>).hcp_state_delta = fullStateProgression.hcp_state_delta;
    (deterministicWithBrain as Record<string, unknown>).hcp_response_type = fullStateProgression.hcp_response_type;
    (deterministicWithBrain as Record<string, unknown>).response_type_reason = fullStateProgression.response_type_reason;
    (deterministicWithBrain as Record<string, unknown>).previous_response_types = fullStateProgression.previous_response_types;
    (deterministicWithBrain as Record<string, unknown>).response_type_transition_explanation = fullStateProgression.response_type_transition_explanation;
    (deterministicWithBrain as Record<string, unknown>).hcp_progression_explanation = fullStateProgression.hcp_progression_explanation;
    (deterministicWithBrain as Record<string, unknown>).simulated_hcp_next_response = predictiveSimulatedResponse;
    (deterministicWithBrain as Record<string, unknown>).predictive_hcp_response_source = "predictive_brain";
    (deterministicWithBrain as Record<string, unknown>).hcp_authoring_contract = "predictive_brain_required";
    (deterministicWithBrain as Record<string, unknown>).anti_loop_intervention_triggered = Boolean(fullStateProgression.anti_loop_intervention_triggered);
    (deterministicWithBrain as Record<string, unknown>).anti_loop_intervention_reason = fullStateProgression.anti_loop_intervention_reason;
    (deterministicWithBrain as Record<string, unknown>).intent_bucket = fullStateProgression.intent_bucket;
    (deterministicWithBrain as Record<string, unknown>).semantic_similarity_max = fullStateProgression.semantic_similarity_max;
    (deterministicWithBrain as Record<string, unknown>).trailing_bucket_run = fullStateProgression.trailing_bucket_run;
    (deterministicWithBrain as Record<string, unknown>).conversation_memory = {
        ...asObject((deterministic as Record<string, unknown>).conversation_memory as Record<string, unknown>, {} as Record<string, unknown>),
        hcp_state: enrichedHcpState,
        last_hcp_response_text: predictiveSimulatedResponse,
        response_type_history: Array.isArray((conversationMemory as Record<string, unknown>)?.response_type_history)
            ? [
                ...((conversationMemory as Record<string, unknown>).response_type_history as unknown[]),
                fullStateProgression.hcp_response_type,
            ].filter(Boolean).slice(-8)
            : [fullStateProgression.hcp_response_type],
        hcp_response_history: Array.isArray((conversationMemory as Record<string, unknown>)?.hcp_response_history)
            ? [
                ...((conversationMemory as Record<string, unknown>).hcp_response_history as unknown[]),
                predictiveSimulatedResponse,
            ].filter(Boolean).slice(-8)
            : [predictiveSimulatedResponse].filter(Boolean),
        intent_bucket_history: Array.isArray((conversationMemory as Record<string, unknown>)?.intent_bucket_history)
            ? [
                ...((conversationMemory as Record<string, unknown>).intent_bucket_history as unknown[]),
                fullStateProgression.intent_bucket,
            ].filter(Boolean).slice(-8)
            : [fullStateProgression.intent_bucket].filter(Boolean),
    };

    const evalPrompt = buildEvaluationPrompt({
        scenarioContext: JSON.stringify(scenarioContext),
        transcript,
        voiceSummary: JSON.stringify(body.voice_metadata || {}),
        selectedDropdowns: JSON.stringify(body.selected_dropdowns || {}),
        repTemperature: repSelectedTemperature,
        hcpBrainContext,
    });

    const aiText = await callGroq(env, evalPrompt, 1200);
    const context = {
        deterministic: deterministicWithBrain as Record<string, unknown>,
        transcript,
        scenarioContext,
        liveTemperature: repSelectedTemperature,
        route: "/api/rps/evaluate-response",
    };
    if (!aiText) {
        return json(request, normalizeEvaluationResponse(deterministicWithBrain, context));
    }

    try {
        const parsed = parseJsonObject(aiText) as Record<string, unknown>;
        const merged = normalizeEvaluationResponse({
            ...deterministicWithBrain,
            ...parsed,
            simulated_hcp_next_response: (deterministicWithBrain as Record<string, unknown>).simulated_hcp_next_response,
            hcp_state: (deterministicWithBrain as Record<string, unknown>).hcp_state,
            hcp_state_delta: (deterministicWithBrain as Record<string, unknown>).hcp_state_delta,
            hcp_response_type: (deterministicWithBrain as Record<string, unknown>).hcp_response_type,
            response_type_reason: (deterministicWithBrain as Record<string, unknown>).response_type_reason,
            previous_response_types: (deterministicWithBrain as Record<string, unknown>).previous_response_types,
            response_type_transition_explanation: (deterministicWithBrain as Record<string, unknown>).response_type_transition_explanation,
            hcp_progression_explanation: (deterministicWithBrain as Record<string, unknown>).hcp_progression_explanation,
            anti_loop_intervention_triggered: (deterministicWithBrain as Record<string, unknown>).anti_loop_intervention_triggered,
            anti_loop_intervention_reason: (deterministicWithBrain as Record<string, unknown>).anti_loop_intervention_reason,
            intent_bucket: (deterministicWithBrain as Record<string, unknown>).intent_bucket,
            semantic_similarity_max: (deterministicWithBrain as Record<string, unknown>).semantic_similarity_max,
            trailing_bucket_run: (deterministicWithBrain as Record<string, unknown>).trailing_bucket_run,
            conversation_memory: (deterministicWithBrain as Record<string, unknown>).conversation_memory,
            metric_scores: {
                ...(asObject(deterministicWithBrain.metric_scores as Record<string, unknown>, {} as Record<string, unknown>)),
                ...((asObject(parsed.metric_scores as Record<string, unknown>, {} as Record<string, unknown>))),
            },
            outcome_analysis: {
                ...(asObject(deterministicWithBrain.outcome_analysis as Record<string, unknown>, {} as Record<string, unknown>)),
                ...((asObject(parsed.outcome_analysis as Record<string, unknown>, {} as Record<string, unknown>))),
                ...detectCommitment(transcript),
            },
            hcp_brain_alignment: {
                ...asObject(hcpBrainAlignment as Record<string, unknown>, {} as Record<string, unknown>),
                ...asObject(parsed.hcp_brain_alignment as Record<string, unknown>, {} as Record<string, unknown>),
            },
            hcp_brain_coaching: {
                ...asObject(hcpBrainCoaching as Record<string, unknown>, {} as Record<string, unknown>),
                ...asObject(parsed.hcp_brain_coaching as Record<string, unknown>, {} as Record<string, unknown>),
            },
        }, context);

        return json(request, merged);
    } catch {
        return json(request, normalizeEvaluationResponse(deterministicWithBrain, context));
    }
}

async function handleSaveSession(request: Request, env: Env): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const clean = sanitizeNoPhi(body) as Record<string, unknown>;

    const sessionId = text(clean.session_id, `adaptive-session-${Date.now()}`);
    const liveTemperature = requireAdaptiveRealismContract(clean, "/api/rps/save-session");
    const initialTemperature = clean.initial_temperature === undefined || clean.initial_temperature === null || clean.initial_temperature === ""
        ? liveTemperature
        : requireRealismContract(clean.initial_temperature, "/api/rps/save-session initial_temperature");
    const record = {
        id: sessionId,
        created_at: new Date().toISOString(),
        dropdown_selections: clean.dropdown_selections || {},
        temperature: liveTemperature,
        initial_temperature: initialTemperature,
        live_temperature: liveTemperature,
        shift_history: clean.shift_history || [],
        behavior_modifiers: clean.behavior_modifiers || {},
        scenario: clean.scenario || {},
        transcript: clean.transcript || "",
        voice_metadata: clean.voice_metadata || {},
        scores: clean.scores || {},
        score_rationale: clean.score_rationale || {},
        outcome_analysis: clean.outcome_analysis || {},
        metric_scores: clean.metric_scores || clean.scores || {},
        overall_score: clean.overall_score ?? null,
        temperature_behavior_modifiers: clean.temperature_behavior_modifiers || clean.behavior_modifiers || {},
        temperature_shift_history: clean.temperature_shift_history || clean.shift_history || [],
        conversation_memory: clean.conversation_memory || {},
        hcp_brain_summary: clean.hcp_brain_summary || asObject(clean.scenario as Record<string, unknown>, {} as Record<string, unknown>).hcp_brain_summary || null,
        hcp_state: clean.hcp_state || null,
        coaching_feedback: clean.coaching_feedback || [],
        better_phrasing: clean.better_phrasing || "",
        next_best_question: clean.next_best_question || "",
        what_hcp_likely_heard: clean.what_hcp_likely_heard || "",
        improved_response_example: clean.improved_response_example || "",
    };

    const previous = await readSessions(env);
    const next = [record, ...previous].slice(0, 300);
    await writeSessions(env, next);

    return json(request, { success: true, session_id: sessionId });
}

async function handlePredictNextEvent(request: Request): Promise<Response> {
    if (request.method !== "POST") {
        return json(request, { error: "Method not allowed" }, 405);
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const transcript = Array.isArray(body.liveTranscript) ? body.liveTranscript : [];
    const text = JSON.stringify(transcript).toLowerCase();
    const safety = /safety|adverse|hepatic|renal|side effect|warning/.test(text);
    const access = /access|prior auth|authorization|coverage|formulary|payer/.test(text);
    const type = safety ? "safety_concern_escalation" : access ? "access_escalation" : "next_hcp_objection";
    const label = safety
        ? "Safety concern escalation likely in the next exchange"
        : access
            ? "Access friction likely to become the next HCP objection"
            : "HCP likely to sharpen the next practical objection";
    const probability = safety ? 0.72 : access ? 0.68 : 0.56;

    return json(request, {
        predictions: [{
            id: `api-${type}`,
            type,
            label,
            probability,
            timeHorizonSeconds: safety ? 14 : 22,
            severity: safety ? "critical" : probability >= 0.65 ? "high" : "moderate",
            trajectory: probability >= 0.65 ? "Escalating" : "Recoverable",
            evidence: [{
                signal: "Server placeholder route",
                detail: "Deterministic placeholder until the promoted prediction service is connected.",
                source: "transcript",
            }],
            recommendedStrategy: "Acknowledge the concern, narrow to the decision threshold, and stay within approved messaging.",
            safestResponse: "That is a fair concern. Let me keep this grounded in the approved information and clarify the specific point that would help you decide.",
            expectedImpact: {
                trust: { delta: 3, state: "positive", rationale: "Acknowledges the HCP concern before answering." },
                compliance: { delta: safety ? 8 : 4, state: "positive", rationale: "Keeps the response inside approved language." },
                objectionResolution: { delta: 4, state: "positive", rationale: "Narrows the next objection into an answerable issue." },
                closeEffectiveness: { delta: 2, state: "positive", rationale: "Protects momentum without forcing a premature close." },
            },
        }],
        transport: { sse: "/api/predict-next-event/stream", websocket: "/api/predict-next-event/ws" },
    });
}

async function handleVoiceTelemetry(request: Request): Promise<Response> {
    if (request.method !== "POST") {
        return json(request, { error: "Method not allowed" }, 405);
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const voice = (body.voiceMetadata || body.voice_metadata || {}) as Record<string, unknown>;
    const wpm = Number(voice.words_per_minute || 0);
    const fillers = Number(voice.filler_word_count || 0);
    const pauses = Number(voice.pause_count || 0);
    const stressLoad = Math.min(100, Math.max(0, Math.round(Math.max(0, wpm - 135) * 0.35 + fillers * 9 + pauses * 6)));
    const confidence = Math.min(100, Math.max(0, Math.round(78 - Math.max(0, wpm - 165) * 0.24 - fillers * 4 - stressLoad * 0.16)));
    const critical = stressLoad >= 72 || confidence <= 42;

    return json(request, {
        id: "api-voice-telemetry-" + Date.now(),
        capturedAt: new Date().toISOString(),
        pacingWordsPerMinute: wpm || 142,
        confidence,
        hesitationIndex: Math.min(100, Math.round(pauses * 14 + fillers * 5)),
        fillerWordCount: fillers,
        interruptionFrequency: Number(voice.recognition_chunk_count || 1) > 3 ? 2 : 0,
        stressLoad,
        emotionalCalibration: critical ? 48 : 68,
        tonalStability: critical ? 44 : 74,
        responseLatencyMs: Math.round(Number(voice.response_duration_seconds || 2) * 1000),
        composureUnderPressure: critical ? 38 : 72,
        conversationalDominance: wpm > 175 ? 72 : 48,
        confidenceDrift: [],
        waveform: [],
        events: [{
            id: critical ? "api-confidence-drop" : "api-composure-recovery",
            timestamp: new Date().toISOString(),
            type: critical ? "confidence_drop" : "composure_recovery",
            severity: critical ? "critical" : "low",
            metricImpact: [{
                metricId: critical ? "objection_navigation" : "conversation_control_structure",
                metricLabel: critical ? "Objection Handling" : "Conversation Control & Structure",
                delta: critical ? -3 : 2,
                rationale: critical ? "Voice pressure may make objection handling sound defensive." : "Stable delivery supports structured objection handling.",
            }],
            insight: critical ? "Voice telemetry indicates elevated pressure during objection handling." : "Voice telemetry is stable in the current window.",
            coachingRecommendation: critical ? "Slow down, acknowledge the HCP concern, and answer with one approved point." : "Maintain the current pace and keep the response tied to the HCP concern.",
        }],
        trajectoryImpact: critical ? "critical" : "stabilizing",
        transport: { sse: "/api/voice-telemetry/stream", websocket: "/api/voice-telemetry/ws" },
    });
}

async function handleRecommendationReasoning(request: Request): Promise<Response> {
    if (request.method !== "POST") {
        return json(request, { error: "Method not allowed" }, 405);
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const recommendation = String(body.recommendation || "Use the safest compliant response tied to the current HCP signal.");
    const now = new Date().toISOString();

    return json(request, {
        recommendationId: String(body.recommendationId || "api-reasoning-" + Date.now()),
        recommendation,
        confidence: Number(body.confidence || 0.74),
        primaryReason: String(body.primaryReason || "This recommendation was generated from transcript, voice, metric, and compliance evidence."),
        evidenceSignals: [
            {
                id: "api-signal-transcript",
                label: "Transcript signal",
                detail: "Recent conversation context was used to identify the active HCP concern.",
                source: "transcript",
                weight: 0.32,
            },
            {
                id: "api-signal-metric",
                label: "Execution metric signal",
                detail: "Current 8-metric behavior evidence was used to select the safest coaching move.",
                source: "metric",
                weight: 0.24,
            },
            {
                id: "api-signal-compliance",
                label: "Compliance basis",
                detail: "Approved-language constraints were applied before returning the recommendation.",
                source: "compliance",
                weight: 0.2,
            },
        ],
        transcriptEvidence: [],
        voiceEvidence: [],
        metricEvidence: [],
        complianceBasis: [{
            ruleId: "approved-language",
            rule: "Use approved messaging and observable behavior evidence.",
            basis: "The recommendation avoids unsupported claims and explains the evidence path.",
            approvedSource: "ReflectivAI commercial compliance guardrail",
        }],
        rejectedAlternatives: [{
            id: "api-alt-generic",
            alternative: "Provide a generic coaching recommendation without evidence.",
            rejectedBecause: "Alternative rejected because enterprise users need auditable evidence and compliance basis.",
            riskReduced: "Reduces black-box AI and compliance-review risk.",
        }],
        auditTrail: [
            {
                id: "api-audit-ingest",
                timestamp: now,
                action: "reasoning_request_received",
                actor: "system",
                detail: "Recommendation reasoning request received by placeholder API route.",
            },
            {
                id: "api-audit-response",
                timestamp: now,
                action: "reasoning_response_generated",
                actor: "rules_engine",
                detail: "Placeholder reasoning response generated for frontend integration.",
            },
        ],
        generatedAt: now,
        modelVersion: "reasoning-transparency-v1",
    });
}

function routeAdaptiveRps(pathname: string, request: Request, env: Env): Promise<Response> | null {
    if (pathname === "/api/rps/generate-scenario" && request.method === "POST") {
        return handleGenerateScenario(request, env);
    }
    if (pathname === "/api/rps/evaluate-response" && request.method === "POST") {
        return handleEvaluateResponse(request, env);
    }
    if (pathname === "/api/rps/save-session" && request.method === "POST") {
        return handleSaveSession(request, env);
    }
    if (pathname === "/api/predict-next-event") {
        return handlePredictNextEvent(request);
    }
    if (pathname === "/api/voice-telemetry") {
        return handleVoiceTelemetry(request);
    }
    if (pathname === "/api/recommendation-reasoning") {
        return handleRecommendationReasoning(request);
    }
    return null;
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return preflight(request);
        }

        const adaptiveResponse = routeAdaptiveRps(url.pathname, request, env);
        if (adaptiveResponse) {
            try {
                return await adaptiveResponse;
            } catch (error) {
                return json(request, { error: "rps_route_failed", details: String(error) }, 500);
            }
        }

        const legacyResponse = await legacyWorker.fetch(request, env, ctx);
        return withCors(legacyResponse, request);
    },
};
