import { deriveVoiceBehaviorAdaptation, evaluateRepResponse, buildScenarioContract } from "../worker/rps/engine.js";

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

function baseScenario(temp = 8) {
    return buildScenarioContract({
        disease_state: "Cardiology",
        journey_stage: "objection_handling",
        interaction_pressure: "operationally_constrained",
        access_barrier_context: "Prior auth overhead and staffing constraints",
        rep_objective: "Advance a concrete next step",
        rep_selected_temperature: temp,
        live_temperature: temp,
    });
}

test("fast + no pause + no question -> harden", () => {
    const adaptation = deriveVoiceBehaviorAdaptation(
        {
            words_per_minute: 195,
            pause_count: 0,
            avg_pause_duration_ms: 120,
            filler_word_rate: 0.09,
            question_count: 0,
            speech_confidence_score: 0.82,
        },
        "We have strong data and broad value for many patients.",
        {},
        8,
    );

    assert(adaptation.hcp_reaction_modifier === "harden", "Expected harden modifier");
    assert(adaptation.resistance_delta >= 1, "Expected positive resistance delta");
    assert(adaptation.trust_delta <= -1, "Expected trust decline");
});

test("optimal pace + strategic pause + diagnostic question -> soften", () => {
    const adaptation = deriveVoiceBehaviorAdaptation(
        {
            words_per_minute: 138,
            pause_count: 2,
            avg_pause_duration_ms: 520,
            filler_word_rate: 0.01,
            question_count: 1,
            speech_confidence_score: 0.8,
        },
        "I hear the workflow burden. Which step in prior auth is generating the most callbacks for your staff?",
        {},
        8,
    );

    assert(adaptation.hcp_reaction_modifier === "soften", "Expected soften modifier");
    assert(adaptation.resistance_delta <= 0, "Expected non-positive resistance delta");
    assert(adaptation.trust_delta >= 1, "Expected trust improvement");
});

test("mixed signals -> hold", () => {
    const adaptation = deriveVoiceBehaviorAdaptation(
        {
            words_per_minute: 150,
            pause_count: 1,
            avg_pause_duration_ms: 300,
            filler_word_rate: 0.03,
            question_count: 1,
            speech_confidence_score: 0.78,
        },
        "This may help. Would you be open to hearing one point?",
        {},
        6,
    );

    assert(["hold", "soften", "harden"].includes(adaptation.hcp_reaction_modifier), "Adaptation modifier should be valid");
});

test("high temperature amplifies poor delivery compared with low temperature", () => {
    const transcript = "This is definitely the right option and you should use it.";
    const voice = {
        words_per_minute: 192,
        pause_count: 0,
        avg_pause_duration_ms: 140,
        filler_word_rate: 0.07,
        question_count: 0,
        speech_confidence_score: 0.86,
    };

    const high = deriveVoiceBehaviorAdaptation(voice, transcript, {}, 9);
    const low = deriveVoiceBehaviorAdaptation(voice, transcript, {}, 2);

    assert(high.resistance_delta >= low.resistance_delta, "High temp should not reduce poor-delivery resistance impact");
    assert(high.cue_intensity_delta >= low.cue_intensity_delta, "High temp should not reduce cue intensity impact");
});

test("harden adaptation drives more resistant next-turn preview", () => {
    const scenario = baseScenario(9);
    const result = evaluateRepResponse({
        repResponseTranscript: "We have strong outcomes and broad value.",
        voiceMetadata: {
            words_per_minute: 194,
            pause_count: 0,
            avg_pause_duration_ms: 120,
            filler_word_rate: 0.08,
            question_count: 0,
            speech_confidence_score: 0.82,
        },
        cueSignal: scenario.cue_signal,
        repSelectedTemperature: 9,
        scenarioContext: scenario,
        conversationMemory: scenario.conversation_memory,
    });

    assert(result.voice_behavior_adaptation.hcp_reaction_modifier === "harden", "Expected harden adaptation for weak rushed delivery");
    assert(/broad|guarded|exactly/.test(String(result.simulated_hcp_next_response || "").toLowerCase()), "Expected resistant next-turn phrasing");
});

test("conversation memory records voice adaptation history and trend shifts", () => {
    const scenario = baseScenario(9);

    const first = evaluateRepResponse({
        repResponseTranscript: "We should definitely move forward quickly with this approach.",
        voiceMetadata: {
            words_per_minute: 190,
            pause_count: 0,
            avg_pause_duration_ms: 100,
            filler_word_rate: 0.07,
            question_count: 0,
            speech_confidence_score: 0.82,
        },
        cueSignal: scenario.cue_signal,
        repSelectedTemperature: 9,
        scenarioContext: scenario,
        conversationMemory: scenario.conversation_memory,
    });

    const second = evaluateRepResponse({
        repResponseTranscript: "This definitely works and you should use it broadly.",
        voiceMetadata: {
            words_per_minute: 188,
            pause_count: 0,
            avg_pause_duration_ms: 120,
            filler_word_rate: 0.08,
            question_count: 0,
            speech_confidence_score: 0.8,
        },
        cueSignal: scenario.cue_signal,
        repSelectedTemperature: 9,
        scenarioContext: scenario,
        conversationMemory: first.conversation_memory,
    });

    assert(Array.isArray(second.conversation_memory.voice_adaptation_history), "voice_adaptation_history should be present");
    assert(second.conversation_memory.voice_adaptation_history.length >= 2, "voice_adaptation_history should accumulate");
    assert(["rising", "stable", "softening"].includes(second.conversation_memory.resistance_trend), "resistance trend should be valid");
    assert(["improving", "neutral", "declining"].includes(second.conversation_memory.trust_trend), "trust trend should be valid");
});

test("evaluation payload includes delivery impact and delivery coaching", () => {
    const scenario = baseScenario(7);
    const result = evaluateRepResponse({
        repResponseTranscript: "I hear the access burden. Which step in workflow is slowing decisions most?",
        voiceMetadata: {
            words_per_minute: 136,
            pause_count: 2,
            avg_pause_duration_ms: 460,
            filler_word_rate: 0.01,
            question_count: 1,
            speech_confidence_score: 0.83,
        },
        cueSignal: scenario.cue_signal,
        repSelectedTemperature: 7,
        scenarioContext: scenario,
        conversationMemory: scenario.conversation_memory,
    });

    assert(Boolean(result.voice_behavior_adaptation), "voice_behavior_adaptation missing");
    assert(Boolean(result.delivery_impact_on_hcp?.coaching_implication), "delivery_impact_on_hcp.coaching_implication missing");
    assert(Boolean(result.delivery_coaching?.recommended_delivery_adjustment), "delivery_coaching.recommended_delivery_adjustment missing");
});

const passed = results.filter((r) => r.passed).length;
const total = results.length;
console.log(`\nVoice Adaptation Tests: ${passed}/${total} passed`);

if (passed !== total) {
    for (const result of results.filter((r) => !r.passed)) {
        console.error(` - ${result.name}: ${result.error}`);
    }
    process.exit(1);
}

console.log("All voice adaptation tests passed.");
