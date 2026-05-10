import { buildScenarioContract, evaluateRepResponse, mapTemperatureToBehavior } from "../worker/rps/engine.js";

type Result = { name: string; passed: boolean; error?: string };

const results: Result[] = [];

function assert(condition: boolean, message: string): void {
    if (!condition) throw new Error(message);
}

function test(name: string, fn: () => void): void {
    try {
        fn();
        results.push({ name, passed: true });
        console.log(`✓ ${name}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ name, passed: false, error: message });
        console.error(`✗ ${name}: ${message}`);
    }
}

function baseScenarioPayload(temp = 6) {
    return {
        disease_state: "Cardiology",
        journey_stage: "initial_access",
        interaction_pressure: "time_constrained",
        access_barrier_context: "Prior Authorization Burden",
        rep_objective: "Advance practical next step",
        live_temperature: temp,
        rep_selected_temperature: temp,
    };
}

function baseLayeredContext(temp = 6) {
    return buildScenarioContract(baseScenarioPayload(temp));
}

// 1) Scenario realism and layered cue schema
test("Scenario realism includes layered cue fields", () => {
    const scenario = buildScenarioContract(baseScenarioPayload(6));
    const layered = (scenario as any).cue_signal_layered || {};

    assert(Boolean(layered.primary_cue), "primary_cue missing");
    assert(Boolean(layered.secondary_cue), "secondary_cue missing");
    assert(Boolean(layered.hidden_resistance), "hidden_resistance missing");
    assert(Boolean(layered.openness_level), "openness_level missing");
    assert(Boolean(layered.emotional_tone), "emotional_tone missing");
    assert(Boolean(layered.likely_reason_for_pushback), "likely_reason_for_pushback missing");
    assert(Boolean(layered.what_the_rep_must_detect), "what_the_rep_must_detect missing");
});

test("HCP statement avoids banned generic phrases", () => {
    const scenario = buildScenarioContract(baseScenarioPayload(6));
    const line = String(scenario.hcp_statement_or_question || "").toLowerCase();
    const banned = [
        "tell me more about your product",
        "how is this different",
        "i'm skeptical",
        "can you provide evidence",
        "this seems interesting",
    ];
    assert(!banned.some((term) => line.includes(term)), "HCP line contains banned generic phrasing");
});

test("Temperature changes cue intensity", () => {
    const low = mapTemperatureToBehavior(2);
    const high = mapTemperatureToBehavior(9);
    assert(low.cueIntensity !== high.cueIntensity, "cueIntensity should differ by temperature");
    assert(low.resistanceDepth !== high.resistanceDepth, "resistanceDepth should differ by temperature");
});

// 2) Conversation memory adaptation
test("Missed cue increases resistance trend", () => {
    const scenarioContext = baseLayeredContext(8);
    const evalResult = evaluateRepResponse({
        repResponseTranscript: "This is an innovative option with strong results across many settings.",
        cueSignal: scenarioContext.cue_signal,
        repSelectedTemperature: 8,
        scenarioContext,
        conversationMemory: { resistance_trend: "stable", trust_trend: "neutral" },
    });

    assert(evalResult.conversation_memory.resistance_trend === "rising", "resistance trend should rise when cue is missed");
});

test("Acknowledgment and strong question can soften resistance", () => {
    const scenarioContext = baseLayeredContext(7);
    const evalResult = evaluateRepResponse({
        repResponseTranscript:
            "I hear the prior-auth burden. Which part of that process is creating the most callbacks for your team right now?",
        cueSignal: scenarioContext.cue_signal,
        repSelectedTemperature: 7,
        scenarioContext,
        conversationMemory: { resistance_trend: "rising", trust_trend: "neutral" },
    });

    assert(evalResult.conversation_memory.resistance_trend !== "rising", "resistance should not keep rising after cue-aligned acknowledgment");
});

// 3) Scoring calibration
test("Generic polished response is not over-scored", () => {
    const scenarioContext = baseLayeredContext(6);
    const evalResult = evaluateRepResponse({
        repResponseTranscript: "This is a best-in-class option with compelling data and broad value.",
        cueSignal: scenarioContext.cue_signal,
        repSelectedTemperature: 6,
        scenarioContext,
    });

    assert(evalResult.overall_score <= 5, "generic polished response should score <= 5");
});

test("Cue-aligned response scores higher than generic response", () => {
    const scenarioContext = baseLayeredContext(6);

    const generic = evaluateRepResponse({
        repResponseTranscript: "This is an exciting product with strong outcomes.",
        cueSignal: scenarioContext.cue_signal,
        repSelectedTemperature: 6,
        scenarioContext,
    });

    const aligned = evaluateRepResponse({
        repResponseTranscript:
            "I hear the workflow pressure. If we focus on prior-auth callbacks, which step is slowing decisions most for your staff today?",
        cueSignal: scenarioContext.cue_signal,
        repSelectedTemperature: 6,
        scenarioContext,
    });

    assert(aligned.overall_score > generic.overall_score, "cue-aligned response should score higher");
});

test("No commitment attempt is reflected in outcome analysis", () => {
    const scenarioContext = baseLayeredContext(6);
    const evalResult = evaluateRepResponse({
        repResponseTranscript: "I hear the burden and can share one relevant data point tied to that barrier.",
        cueSignal: scenarioContext.cue_signal,
        repSelectedTemperature: 6,
        scenarioContext,
    });

    assert(evalResult.outcome_analysis.commitment_attempted === false, "commitment_attempted should be false");
});

test("Scores use broader range than 7-9", () => {
    const scenarioContext = baseLayeredContext(6);

    const low = evaluateRepResponse({
        repResponseTranscript: "Great product, very innovative.",
        cueSignal: scenarioContext.cue_signal,
        repSelectedTemperature: 6,
        scenarioContext,
    }).overall_score;

    const high = evaluateRepResponse({
        repResponseTranscript:
            "I hear the access burden. In your clinic, is the bottleneck mainly missing fields, callback volume, or handoff delays?",
        cueSignal: scenarioContext.cue_signal,
        repSelectedTemperature: 6,
        scenarioContext,
    }).overall_score;

    assert(low <= 5, "low response should be in low-mid range");
    assert(high >= 7, "strong response should be at least upper-mid/high");
});

// 4) Outcome calibration
test("High temperature can score well via reduced resistance without immediate commitment", () => {
    const scenarioContext = baseLayeredContext(9);
    const evalResult = evaluateRepResponse({
        repResponseTranscript:
            "I hear your concern about adding burden. If we keep this to one barrier, I can focus only on the prior-auth callback step.",
        cueSignal: scenarioContext.cue_signal,
        repSelectedTemperature: 9,
        scenarioContext,
    });

    assert(
        ["good", "strong"].includes(evalResult.outcome_analysis.outcome_quality),
        "high-temperature reduced resistance should count as meaningful outcome"
    );
});

test("Low temperature expects stronger next-step movement", () => {
    const scenarioContext = baseLayeredContext(2);
    const evalResult = evaluateRepResponse({
        repResponseTranscript: "Thanks, that is helpful context.",
        cueSignal: scenarioContext.cue_signal,
        repSelectedTemperature: 2,
        scenarioContext,
    });

    assert(Boolean(evalResult.outcome_analysis.expected_outcome_for_temperature), "expected_outcome_for_temperature missing");
    assert(Boolean(evalResult.outcome_analysis.gap_between_expected_and_actual), "gap_between_expected_and_actual missing");
    assert(Boolean((evalResult.outcome_analysis as any).temperature_adjusted_outcome_assessment), "temperature_adjusted_outcome_assessment missing");
    assert(Boolean((evalResult.outcome_analysis as any).expected_commitment_level_for_temperature), "expected_commitment_level_for_temperature missing");
    assert(Boolean((evalResult.outcome_analysis as any).actual_commitment_level), "actual_commitment_level missing");
    assert(Boolean((evalResult.outcome_analysis as any).outcome_alignment_to_temperature), "outcome_alignment_to_temperature missing");
});

test("Evaluation contract includes all 8 metric score blocks", () => {
    const scenarioContext = baseLayeredContext(6);
    const evalResult = evaluateRepResponse({
        repResponseTranscript:
            "I hear the access burden. Which step in prior-auth workflow is causing the most callbacks for your team right now?",
        cueSignal: scenarioContext.cue_signal,
        repSelectedTemperature: 6,
        scenarioContext,
    });

    const required = [
        "context_awareness",
        "cue_recognition",
        "empathy_acknowledgment",
        "strategic_questioning",
        "evidence_framing",
        "objection_handling",
        "conversational_control",
        "tone_pace_confidence",
    ];

    for (const key of required) {
        const metric = (evalResult.metric_scores as any)?.[key];
        assert(Boolean(metric), `missing metric ${key}`);
        assert(typeof metric.score_1_to_10 === "number", `${key}.score_1_to_10 should be numeric`);
        assert(Boolean(metric.rationale), `${key}.rationale missing`);
    }
});

// 5) Coaching quality
test("Coaching references exact REP phrase when transcript exists", () => {
    const scenarioContext = baseLayeredContext(6);
    const transcript = "I think this could help and we have good data overall.";
    const evalResult = evaluateRepResponse({
        repResponseTranscript: transcript,
        cueSignal: scenarioContext.cue_signal,
        repSelectedTemperature: 6,
        scenarioContext,
    });

    const joined = (evalResult.coaching_feedback || []).join(" ");
    assert(joined.includes("When you said \"I think this could help"), "coaching should reference exact rep phrase");
});

test("Coaching includes improved phrase and next-best question", () => {
    const scenarioContext = baseLayeredContext(6);
    const evalResult = evaluateRepResponse({
        repResponseTranscript: "We have strong data and broad value.",
        cueSignal: scenarioContext.cue_signal,
        repSelectedTemperature: 6,
        scenarioContext,
    });

    assert(Boolean(evalResult.better_phrasing), "better_phrasing should be present");
    assert(Boolean(evalResult.next_best_question), "next_best_question should be present");
});

const passed = results.filter((item) => item.passed).length;
const total = results.length;
console.log(`\nCalibration Tests: ${passed}/${total} passed`);

if (passed !== total) {
    for (const result of results.filter((item) => !item.passed)) {
        console.error(` - ${result.name}: ${result.error}`);
    }
    process.exit(1);
}

console.log("All adaptive realism calibration tests passed.");
