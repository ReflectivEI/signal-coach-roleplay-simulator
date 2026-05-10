import { selectHcpResponseType } from "../worker/rps/hcpState.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed += 1;
        console.log(`  ✅ ${message}`);
    } else {
        failed += 1;
        console.error(`  ❌ FAIL: ${message}`);
    }
}

function summarize() {
    if (failed > 0) {
        console.error(`\n${failed} assertion(s) failed out of ${passed + failed} total.`);
        process.exit(1);
    }
    console.log(`\n✅ All ${passed} assertions passed.`);
}

function buildState(overrides = {}) {
    return {
        resistance_level: 6,
        trust_level: 4,
        openness_level: 3,
        patience_level: 4,
        cue_intensity: 6,
        conversation_stage: "concern_clarification",
        hcp_position: "guarded",
        last_hcp_response_type: null,
        previous_response_types: [],
        previous_rep_qualities: [],
        rep_has_diagnostic_question: false,
        rep_uses_vague_product_language: false,
        ...overrides,
    };
}

function runMixedFlowTest() {
    console.log("\n▶ Mixed-flow diversity test");

    const repQualities = ["weak", "generic", "improving", "partial", "strong", "strong", "improving", "strong"];
    const temperatureBands = [8, 8, 6, 6, 4, 3, 5, 4];
    const history = [];
    let state = buildState();

    for (let i = 0; i < repQualities.length; i++) {
        const repQuality = repQualities[i];
        const liveTemperature = temperatureBands[i];

        state = {
            ...state,
            last_hcp_response_type: history[history.length - 1] || null,
            previous_response_types: history.slice(-6),
            previous_rep_qualities: [...state.previous_rep_qualities, repQuality].slice(-6),
            rep_has_diagnostic_question: i >= 2,
            rep_uses_vague_product_language: i < 2,
            conversation_stage: i >= 4 ? "conditional_openness" : "concern_clarification",
        };

        const selection = selectHcpResponseType(/** @type {any} */({
            hcp_state: state,
            previous_response_types: history,
            rep_quality: repQuality,
            voice_behavior_adaptation: {
                hcp_reaction_modifier: i < 2 ? "harden" : "soften",
                perceived_listening_signal: i < 2 ? "low" : "high",
            },
            live_temperature: liveTemperature,
            evaluation: {
                hcp_brain_alignment: {
                    trust_breakers_triggered: i < 2 ? ["generic_pitch"] : [],
                    credibility_drivers_demonstrated: i >= 4 ? ["specificity"] : [],
                },
            },
        }));

        history.push(selection.responseType);

        assert(Boolean(selection.responseTypeReason), `Turn ${i + 1}: includes responseTypeReason`);
        assert(Boolean(selection.responseTypeTransitionExplanation), `Turn ${i + 1}: includes transition explanation`);
    }

    const counts = history.reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});
    const dominant = Object.values(counts).sort((a, b) => b - a)[0] || 0;
    const dominantRatio = dominant / history.length;

    let maxRun = 1;
    let run = 1;
    for (let i = 1; i < history.length; i++) {
        run = history[i] === history[i - 1] ? run + 1 : 1;
        maxRun = Math.max(maxRun, run);
    }

    const uniqueTypes = new Set(history).size;
    assert(uniqueTypes >= 3, `Mixed flow uses at least 3 response types (got ${uniqueTypes})`);
    assert(maxRun <= 2, `Mixed flow prevents >2 consecutive same type (max run ${maxRun})`);
    assert(dominantRatio <= 0.5, `Mixed flow keeps type dominance <=50% (ratio ${dominantRatio.toFixed(2)})`);
}

function runWeakEscalationTest() {
    console.log("\n▶ Weak-streak escalation test");

    const history = ["restate_surface_concern", "sharpen_objection"];
    const state = buildState({
        last_hcp_response_type: "sharpen_objection",
        previous_response_types: history,
        previous_rep_qualities: ["weak", "generic", "weak"],
        conversation_stage: "resistance_surface",
        hcp_position: "resistant",
        resistance_level: 8,
        trust_level: 2,
        patience_level: 2,
        rep_uses_vague_product_language: true,
    });

    const selection = selectHcpResponseType(/** @type {any} */({
        hcp_state: state,
        previous_response_types: history,
        rep_quality: "weak",
        voice_behavior_adaptation: {
            hcp_reaction_modifier: "harden",
            perceived_listening_signal: "low",
            delivery_pressure_signal: "pressure_increasing",
        },
        live_temperature: 9,
        evaluation: {
            hcp_brain_alignment: {
                trust_breakers_triggered: ["vague_claim"],
                credibility_drivers_demonstrated: [],
            },
        },
    }));

    assert(["challenge_assumption", "disengage"].includes(selection.responseType), `Weak streak escalates response type (got ${selection.responseType})`);
    assert(selection.responseTypeTransitionExplanation.includes("->"), "Weak streak emits transition explanation");
}

runMixedFlowTest();
runWeakEscalationTest();
summarize();
