/**
 * Staging regression checks for Adaptive RPS temperature flow.
 *
 * Usage:
 *   RPS_WORKER_URL="https://reflectivai-rps-api-staging.tonyabdelmalak.workers.dev" npm run test:rps-regression
 */

export { };

type JsonRecord = Record<string, any>;

const WORKER_URL = (process.env.VITE_ROLEPLAY_WORKER_URL || process.env.RPS_WORKER_URL || "https://reflectivai-rps-api-staging.tonyabdelmalak.workers.dev").replace(/\/$/, "");

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

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

async function post(path: string, body: JsonRecord): Promise<JsonRecord> {
    const response = await fetch(`${WORKER_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`${path} failed (${response.status}): ${text}`);
    }

    return response.json();
}

function scenarioPayload(temp: number): JsonRecord {
    return {
        disease_state: "Cardiology",
        hcp_profile: "Time-constrained community cardiologist",
        journey_stage: "objection_handling",
        interaction_pressure: "operationally_constrained",
        access_barrier_context: "Prior auth overhead and staffing constraints",
        rep_objective: "Advance a concrete next step",
        rep_selected_temperature: temp,
    };
}

async function run(): Promise<void> {
    console.log(`Running RPS staging regression against ${WORKER_URL}`);

    const lowScenario = await post("/api/rps/generate-scenario", scenarioPayload(2));
    assert(Boolean(lowScenario.scenario_id), "generate-scenario should return scenario_id");
    assert(Boolean(lowScenario.hcp_statement_or_question), "generate-scenario should return hcp question");
    assert(Boolean(lowScenario.cue_signal_layered?.primary_cue), "generate-scenario should return layered cue schema");
    assert(Boolean(lowScenario.temperature_behavior_modifiers?.band), "generate-scenario should return temperature behavior modifiers");
    assert(Boolean(lowScenario.conversation_memory?.resistance_trend), "generate-scenario should return conversation memory");
    assert(lowScenario.difficulty_level === "low" || lowScenario.difficulty_level === "mid" || lowScenario.difficulty_level === "high", "difficulty_level should be low/mid/high");

    const highScenario = await post("/api/rps/generate-scenario", scenarioPayload(9));
    assert(Boolean(highScenario.hcp_statement_or_question), "high-temp scenario should return hcp question");

    const regenerated = await post("/api/rps/generate-scenario", {
        ...scenarioPayload(9),
        regenerate_question: true,
        previous_hcp_statement_or_question: String(highScenario.hcp_statement_or_question || ""),
    });

    const previousQuestion = String(highScenario.hcp_statement_or_question || "").trim().toLowerCase();
    const regeneratedQuestion = String(regenerated.hcp_statement_or_question || "").trim().toLowerCase();
    assert(previousQuestion.length > 0, "previous question should not be empty");
    assert(regeneratedQuestion.length > 0, "regenerated question should not be empty");
    assert(previousQuestion !== regeneratedQuestion, "regenerate should return a different HCP question");

    const baseEvalPayload: JsonRecord = {
        scenario_context: highScenario,
        voice_metadata: {
            words_per_minute: 132,
            pause_count: 2,
            avg_pause_duration_ms: 420,
            filler_word_rate: 0.01,
            speech_confidence_score: 0.84,
        },
        selected_dropdowns: {
            disease_state: "Cardiology",
            hcp_profile: "Time-constrained community cardiologist",
            journey_stage: "objection_handling",
            interaction_pressure: "operationally_constrained",
        },
    };

    const lowEval = await post("/api/rps/evaluate-response", {
        ...baseEvalPayload,
        rep_selected_temperature: 2,
        live_temperature: 2,
        rep_response_transcript:
            "I hear your workflow concern. Would you be open to reviewing one short outcomes summary with your team this week?",
    });

    const highEval = await post("/api/rps/evaluate-response", {
        ...baseEvalPayload,
        rep_selected_temperature: 9,
        live_temperature: 9,
        rep_response_transcript:
            "I hear the access burden and want to keep this focused. Would you review one targeted data point if it directly reduces first-step friction?",
    });

    assert(Array.isArray(lowEval.coaching_feedback), "low-temp evaluation should include coaching_feedback array");
    assert(Array.isArray(highEval.coaching_feedback), "high-temp evaluation should include coaching_feedback array");
    assert(typeof lowEval.overall_score === "number", "low-temp evaluation should include numeric overall_score");
    assert(typeof highEval.overall_score === "number", "high-temp evaluation should include numeric overall_score");
    for (const metricKey of REQUIRED_METRIC_KEYS) {
        assert(Boolean(lowEval.metric_scores?.[metricKey]), `low-temp evaluation missing metric_scores.${metricKey}`);
        assert(Boolean(highEval.metric_scores?.[metricKey]), `high-temp evaluation missing metric_scores.${metricKey}`);
    }
    assert(Boolean(highEval.outcome_analysis?.temperature_adjusted_outcome_assessment), "high-temp evaluation missing temperature-adjusted outcome assessment");
    assert(Boolean(highEval.outcome_analysis?.expected_commitment_level_for_temperature), "high-temp evaluation missing expected commitment level for temperature");
    assert(Boolean(highEval.outcome_analysis?.actual_commitment_level), "high-temp evaluation missing actual commitment level");
    assert(Boolean(highEval.outcome_analysis?.outcome_alignment_to_temperature), "high-temp evaluation missing outcome alignment to temperature");
    assert(Boolean(highEval.voice_behavior_adaptation?.hcp_reaction_modifier), "high-temp evaluation missing voice behavior adaptation modifier");
    assert(typeof highEval.voice_behavior_adaptation?.resistance_delta === "number", "high-temp evaluation missing voice behavior adaptation resistance_delta");
    assert(Boolean(highEval.delivery_impact_on_hcp?.likely_hcp_reaction), "high-temp evaluation missing delivery impact likely reaction");
    assert(Boolean(highEval.delivery_impact_on_hcp?.coaching_implication), "high-temp evaluation missing delivery impact coaching implication");
    assert(Boolean(highEval.delivery_coaching?.recommended_delivery_adjustment), "high-temp evaluation missing delivery coaching adjustment");
    assert(Boolean(String(highEval.simulated_hcp_next_response || "").trim()), "high-temp evaluation missing simulated_hcp_next_response");
    assert(Boolean(highEval.conversation_memory?.delivery_trend), "high-temp evaluation missing conversation_memory.delivery_trend");
    assert(Array.isArray(highEval.conversation_memory?.voice_adaptation_history), "high-temp evaluation missing conversation_memory.voice_adaptation_history");
    assert(
        highEval.overall_score >= lowEval.overall_score,
        "high-temp, cue-aware response should not score below lower-temperature response",
    );

    const highFeedbackJoined = (highEval.coaching_feedback || []).join(" ").toLowerCase();
    assert(
        highFeedbackJoined.includes("high realism pressure") || highFeedbackJoined.includes("high"),
        "high-temp coaching should include temperature-aware guidance"
    );

    const saveResponse = await post("/api/rps/save-session", {
        session_id: `regression-${Date.now()}`,
        dropdown_selections: baseEvalPayload.selected_dropdowns,
        temperature: 9,
        initial_temperature: 5,
        live_temperature: 9,
        shift_history: [
            { from: 5, to: 7, timestamp: new Date().toISOString() },
            { from: 7, to: 9, timestamp: new Date().toISOString() },
        ],
        behavior_modifiers: {
            skepticism_level: "high",
            emotional_intensity: "heightened",
        },
        scenario: highScenario,
        transcript: "Regression validation transcript",
        outcome_analysis: highEval.outcome_analysis || {},
        coaching_feedback: highEval.coaching_feedback || [],
    });

    assert(saveResponse.success === true, "save-session should return success=true");
    assert(Boolean(saveResponse.session_id), "save-session should return session_id");

    console.log("All staging regression checks passed.");
}

run().catch((error) => {
    console.error(`Regression failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
