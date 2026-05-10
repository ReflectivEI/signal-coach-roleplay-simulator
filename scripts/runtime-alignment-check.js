/**
 * Runtime alignment validation against the configured Worker endpoint.
 *
 * Usage:
 *   VITE_ROLEPLAY_WORKER_URL="https://<worker-url>" npm run test:runtime-alignment
 */

export { };

const DEFAULT_LOCAL_WORKER_URL = "http://127.0.0.1:8787";
const WORKER_URL = (
    process.env.VITE_ROLEPLAY_WORKER_URL
    || process.env.RPS_WORKER_URL
    || DEFAULT_LOCAL_WORKER_URL
).replace(/\/$/, "");

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
];

const REQUIRED_LAYERED_FIELDS = [
    "primary_cue",
    "secondary_cue",
    "hidden_resistance",
    "openness_level",
    "emotional_tone",
    "likely_reason_for_pushback",
    "what_the_rep_must_detect",
];

const REQUIRED_METRIC_KEYS = [
    "context_awareness",
    "cue_recognition",
    "empathy_acknowledgment",
    "strategic_questioning",
    "evidence_framing",
    "objection_handling",
    "conversational_control",
    "tone_pace_confidence",
];

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
];

const REQUIRED_VOICE_ADAPTATION_FIELDS = [
    "pacing_signal",
    "pause_signal",
    "filler_signal",
    "confidence_signal",
    "question_delivery_signal",
    "perceived_listening_signal",
    "delivery_pressure_signal",
    "hcp_reaction_modifier",
    "resistance_delta",
    "openness_delta",
    "trust_delta",
    "cue_intensity_delta",
    "next_turn_guidance",
];

const REQUIRED_DELIVERY_IMPACT_FIELDS = [
    "perceived_by_hcp",
    "likely_hcp_reaction",
    "impact_on_resistance",
    "impact_on_trust",
    "coaching_implication",
];

const REQUIRED_DELIVERY_COACHING_FIELDS = [
    "pacing_feedback",
    "pause_feedback",
    "confidence_feedback",
    "question_delivery_feedback",
    "perceived_listening_feedback",
    "recommended_delivery_adjustment",
    "example_rephrasing_with_delivery_note",
];

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function post(path, payload) {
    const response = await fetch(`${WORKER_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`${path} failed (${response.status}): ${text}`);
    }

    return response.json();
}

function baseScenarioPayload(temp) {
    return {
        disease_state: "Cardiology",
        hcp_profile: "Time-constrained community cardiologist",
        hcp_type: "treating_clinician",
        behavior_archetype: "skeptical_specialist",
        influence_driver: "evidence_driven",
        journey_stage: "objection_handling",
        interaction_pressure: "operationally_constrained",
        access_barrier_context: "Prior auth overhead and staffing constraints",
        rep_objective: "Advance a concrete next step",
        hcp_default_temperature: 5,
        rep_selected_temperature: temp,
        live_temperature: temp,
    };
}

function assertScenarioContract(scenario, label) {
    for (const key of REQUIRED_SCENARIO_FIELDS) {
        assert(scenario[key] !== undefined && scenario[key] !== null && scenario[key] !== "", `${label}: missing required scenario field ${key}`);
    }

    assert(typeof scenario.cue_signal_layered === "object" && !Array.isArray(scenario.cue_signal_layered), `${label}: cue_signal_layered must be object`);
    for (const key of REQUIRED_LAYERED_FIELDS) {
        assert(Boolean(String(scenario.cue_signal_layered[key] || "").trim()), `${label}: cue_signal_layered.${key} missing`);
    }

    assert(typeof scenario.temperature_behavior_modifiers === "object" && !Array.isArray(scenario.temperature_behavior_modifiers), `${label}: temperature_behavior_modifiers must be object`);
    assert(typeof scenario.conversation_memory === "object" && !Array.isArray(scenario.conversation_memory), `${label}: conversation_memory must be object`);
    assert(typeof scenario.hcp_brain === "object" && scenario.hcp_brain !== null && !Array.isArray(scenario.hcp_brain), `${label}: hcp_brain must be object`);
    assert(typeof scenario.hcp_brain_summary === "object" && scenario.hcp_brain_summary !== null && !Array.isArray(scenario.hcp_brain_summary), `${label}: hcp_brain_summary must be object`);
    assert(Boolean(String(scenario.hcp_brain.hcp_brain_id || "").trim()), `${label}: hcp_brain.hcp_brain_id missing`);
    assert(scenario.hcp_brain.source === "predictive_hcp_brain_engine", `${label}: hcp_brain.source must be predictive_hcp_brain_engine`);
    assert(typeof scenario.hcp_brain.clinician_perspective === "object", `${label}: hcp_brain.clinician_perspective missing`);
    assert(typeof scenario.hcp_brain.selections === "object", `${label}: hcp_brain.selections missing`);
    assert(Boolean(String(scenario.hcp_brain_summary.quality_test_question || "").trim()), `${label}: hcp_brain_summary.quality_test_question missing`);
}

function assertEvaluationContract(evaluation, label) {
    assert(typeof evaluation.overall_score === "number", `${label}: overall_score must be number`);
    assert(evaluation.overall_score >= 1 && evaluation.overall_score <= 10, `${label}: overall_score out of range`);

    assert(typeof evaluation.metric_scores === "object" && !Array.isArray(evaluation.metric_scores), `${label}: metric_scores must be object`);
    for (const key of REQUIRED_METRIC_KEYS) {
        const metric = evaluation.metric_scores[key];
        assert(metric && typeof metric === "object", `${label}: missing metric ${key}`);
        assert(typeof metric.score_1_to_10 === "number", `${label}: ${key}.score_1_to_10 must be number`);
        assert(metric.score_1_to_10 >= 1 && metric.score_1_to_10 <= 10, `${label}: ${key}.score_1_to_10 out of range`);
        assert(Boolean(String(metric.rationale || "").trim()), `${label}: ${key}.rationale missing`);
    }

    assert(typeof evaluation.outcome_analysis === "object" && !Array.isArray(evaluation.outcome_analysis), `${label}: outcome_analysis must be object`);
    for (const key of REQUIRED_OUTCOME_FIELDS) {
        assert(evaluation.outcome_analysis[key] !== undefined && evaluation.outcome_analysis[key] !== null, `${label}: missing outcome_analysis.${key}`);
    }

    assert(Array.isArray(evaluation.coaching_feedback), `${label}: coaching_feedback must be an array`);
    assert(Boolean(String(evaluation.better_phrasing || "").trim()), `${label}: better_phrasing missing`);
    assert(Boolean(String(evaluation.next_best_question || "").trim()), `${label}: next_best_question missing`);
    assert(Boolean(String(evaluation.what_hcp_likely_heard || "").trim()), `${label}: what_hcp_likely_heard missing`);
    assert(Boolean(String(evaluation.improved_response_example || "").trim()), `${label}: improved_response_example missing`);

    assert(typeof evaluation.voice_behavior_adaptation === "object" && !Array.isArray(evaluation.voice_behavior_adaptation), `${label}: voice_behavior_adaptation must be object`);
    for (const key of REQUIRED_VOICE_ADAPTATION_FIELDS) {
        assert(evaluation.voice_behavior_adaptation[key] !== undefined && evaluation.voice_behavior_adaptation[key] !== null, `${label}: missing voice_behavior_adaptation.${key}`);
    }

    assert(typeof evaluation.delivery_impact_on_hcp === "object" && !Array.isArray(evaluation.delivery_impact_on_hcp), `${label}: delivery_impact_on_hcp must be object`);
    for (const key of REQUIRED_DELIVERY_IMPACT_FIELDS) {
        assert(evaluation.delivery_impact_on_hcp[key] !== undefined && evaluation.delivery_impact_on_hcp[key] !== null, `${label}: missing delivery_impact_on_hcp.${key}`);
    }

    assert(typeof evaluation.delivery_coaching === "object" && !Array.isArray(evaluation.delivery_coaching), `${label}: delivery_coaching must be object`);
    for (const key of REQUIRED_DELIVERY_COACHING_FIELDS) {
        assert(evaluation.delivery_coaching[key] !== undefined && evaluation.delivery_coaching[key] !== null, `${label}: missing delivery_coaching.${key}`);
    }

    assert(typeof evaluation.hcp_brain_alignment === "object" && evaluation.hcp_brain_alignment !== null && !Array.isArray(evaluation.hcp_brain_alignment), `${label}: hcp_brain_alignment must be object`);
    assert(typeof evaluation.hcp_brain_coaching === "object" && evaluation.hcp_brain_coaching !== null && !Array.isArray(evaluation.hcp_brain_coaching), `${label}: hcp_brain_coaching must be object`);
    assert(typeof evaluation.hcp_brain_alignment.quality_test_satisfied === "boolean", `${label}: hcp_brain_alignment.quality_test_satisfied must be boolean`);
    assert(Boolean(String(evaluation.hcp_brain_alignment.alignment_rationale || "").trim()), `${label}: hcp_brain_alignment.alignment_rationale missing`);
    assert(Boolean(String(evaluation.hcp_brain_coaching.quality_test_feedback || "").trim()), `${label}: hcp_brain_coaching.quality_test_feedback missing`);

    assert(Boolean(String(evaluation.simulated_hcp_next_response || "").trim()), `${label}: simulated_hcp_next_response missing`);

    // HCP State Progression assertions
    assert(typeof evaluation.hcp_state === "object" && evaluation.hcp_state !== null && !Array.isArray(evaluation.hcp_state), `${label}: hcp_state must be object`);
    assert(typeof evaluation.hcp_state.resistance_level === "number", `${label}: hcp_state.resistance_level must be number`);
    assert(typeof evaluation.hcp_state.trust_level === "number", `${label}: hcp_state.trust_level must be number`);
    assert(typeof evaluation.hcp_state.conversation_stage === "string" && evaluation.hcp_state.conversation_stage.trim(), `${label}: hcp_state.conversation_stage missing`);
    assert(typeof evaluation.hcp_state.hcp_position === "string" && evaluation.hcp_state.hcp_position.trim(), `${label}: hcp_state.hcp_position missing`);
    assert(typeof evaluation.hcp_state_delta === "object" && evaluation.hcp_state_delta !== null && !Array.isArray(evaluation.hcp_state_delta), `${label}: hcp_state_delta must be object`);
    assert(typeof evaluation.hcp_state_delta.resistance_change === "number", `${label}: hcp_state_delta.resistance_change must be number`);
    assert(typeof evaluation.hcp_response_type === "string" && evaluation.hcp_response_type.trim(), `${label}: hcp_response_type missing`);
    assert(typeof evaluation.response_type_reason === "string" && evaluation.response_type_reason.trim(), `${label}: response_type_reason missing`);
    assert(Array.isArray(evaluation.previous_response_types), `${label}: previous_response_types must be array`);
    assert(typeof evaluation.response_type_transition_explanation === "string" && evaluation.response_type_transition_explanation.trim(), `${label}: response_type_transition_explanation missing`);
    assert(typeof evaluation.hcp_progression_explanation === "string" && evaluation.hcp_progression_explanation.trim(), `${label}: hcp_progression_explanation missing`);

    assert(typeof evaluation.conversation_memory === "object" && !Array.isArray(evaluation.conversation_memory), `${label}: conversation_memory must be object`);
    assert(Boolean(String(evaluation.conversation_memory.delivery_trend || "").trim()), `${label}: conversation_memory.delivery_trend missing`);
    assert(Boolean(String(evaluation.conversation_memory.perceived_listening_trend || "").trim()), `${label}: conversation_memory.perceived_listening_trend missing`);
    assert(Boolean(String(evaluation.conversation_memory.resistance_trend || "").trim()), `${label}: conversation_memory.resistance_trend missing`);
    assert(Boolean(String(evaluation.conversation_memory.trust_trend || "").trim()), `${label}: conversation_memory.trust_trend missing`);
    assert(Array.isArray(evaluation.conversation_memory.voice_adaptation_history), `${label}: conversation_memory.voice_adaptation_history must be array`);
}

function assertCoachingSpecificity(evaluation, transcript, label) {
    const phrase = String(transcript || "").split(/[.!?]/).map((s) => s.trim()).find(Boolean) || "";
    const joined = (evaluation.coaching_feedback || []).join(" ");

    assert(joined.includes("When you said") && joined.includes("\""), `${label}: coaching feedback must reference exact REP phrase`);
    if (phrase) {
        assert(joined.toLowerCase().includes(phrase.slice(0, Math.min(20, phrase.length)).toLowerCase()), `${label}: coaching feedback must include transcript-linked phrasing`);
    }
}

async function run() {
    console.log(`Running runtime alignment check against ${WORKER_URL}`);

    const lowScenario = await post("/api/rps/generate-scenario", baseScenarioPayload(2));
    const highScenario = await post("/api/rps/generate-scenario", baseScenarioPayload(9));

    assertScenarioContract(lowScenario, "low-temp scenario");
    assertScenarioContract(highScenario, "high-temp scenario");

    const weakTranscript = "This is a strong product with good outcomes overall for many patients.";
    const strongTranscript = "I hear the prior auth burden and want to keep this practical. Is the bigger blocker callback volume, staff bandwidth, or patient fit uncertainty?";

    const evalBasePayload = {
        scenario_id: highScenario.scenario_id,
        scenario_context: highScenario,
        voice_metadata: {
            words_per_minute: 128,
            pause_count: 2,
            avg_pause_duration_ms: 420,
            filler_word_rate: 0.01,
            speech_confidence_score: 0.86,
        },
        selected_dropdowns: {
            disease_state: "Cardiology",
            hcp_profile: "Time-constrained community cardiologist",
            hcp_type: "treating_clinician",
            behavior_archetype: "skeptical_specialist",
            influence_driver: "evidence_driven",
            journey_stage: "objection_handling",
            interaction_pressure: "operationally_constrained",
        },
        rep_selected_temperature: 9,
        live_temperature: 9,
        conversation_memory: highScenario.conversation_memory || {},
    };

    const weakEval = await post("/api/rps/evaluate-response", {
        ...evalBasePayload,
        rep_response_transcript: weakTranscript,
    });

    const strongEval = await post("/api/rps/evaluate-response", {
        ...evalBasePayload,
        rep_response_transcript: strongTranscript,
    });

    assertEvaluationContract(weakEval, "weak evaluation");
    assertEvaluationContract(strongEval, "strong evaluation");

    assert(weakEval.overall_score <= 5, `weak evaluation expected <=5, got ${weakEval.overall_score}`);
    assert(strongEval.overall_score >= 7, `strong evaluation expected >=7, got ${strongEval.overall_score}`);
    assert(strongEval.overall_score > weakEval.overall_score, "strong evaluation should score higher than weak evaluation");

    assertCoachingSpecificity(weakEval, weakTranscript, "weak evaluation");
    assertCoachingSpecificity(strongEval, strongTranscript, "strong evaluation");

    assert(Boolean(strongEval.outcome_analysis.conversation_advanced), "strong evaluation should advance conversation");
    assert(["weak", "moderate", "strong"].includes(String(strongEval.outcome_analysis.commitment_strength)), "strong evaluation should have non-none commitment strength");

    const saveResponse = await post("/api/rps/save-session", {
        session_id: `runtime-alignment-${Date.now()}`,
        dropdown_selections: evalBasePayload.selected_dropdowns,
        temperature: 9,
        initial_temperature: 5,
        live_temperature: 9,
        shift_history: [
            { from: 5, to: 7, timestamp: new Date().toISOString() },
            { from: 7, to: 9, timestamp: new Date().toISOString() },
        ],
        behavior_modifiers: highScenario.temperature_behavior_modifiers || {},
        scenario: highScenario,
        transcript: strongTranscript,
        metric_scores: strongEval.metric_scores,
        overall_score: strongEval.overall_score,
        score_rationale: strongEval.score_rationale,
        outcome_analysis: strongEval.outcome_analysis,
        conversation_memory: strongEval.conversation_memory,
        coaching_feedback: strongEval.coaching_feedback,
        better_phrasing: strongEval.better_phrasing,
        next_best_question: strongEval.next_best_question,
        what_hcp_likely_heard: strongEval.what_hcp_likely_heard,
        improved_response_example: strongEval.improved_response_example,
    });

    assert(saveResponse.success === true, "save-session should return success=true");
    assert(Boolean(saveResponse.session_id), "save-session should return session_id");

    console.log("Runtime alignment checks passed.");
}

run().catch((error) => {
    console.error(`Runtime alignment failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
