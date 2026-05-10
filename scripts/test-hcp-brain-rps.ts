/**
 * Predictive HCP Brain + RPS integration checks.
 *
 * Usage:
 *   VITE_ROLEPLAY_WORKER_URL="https://<worker-url>" npm run test:hcp-brain-rps
 */

type Dict = Record<string, unknown>;

import {
    buildHcpBrain,
    buildHcpBrainPersonaContext,
    buildHcpBrainSummary,
    evaluateRepAgainstBrain,
} from "../worker/rps/hcpBrain.js";

const DEFAULT_LOCAL_WORKER_URL = "http://127.0.0.1:8787";
const WORKER_URL = (
    process.env.VITE_ROLEPLAY_WORKER_URL
    || process.env.RPS_WORKER_URL
    || DEFAULT_LOCAL_WORKER_URL
).replace(/\/$/, "");

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function asObject(value: unknown): Dict {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Dict) : {};
}

async function post(path: string, payload: Dict): Promise<Dict> {
    const response = await fetch(`${WORKER_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`${path} failed (${response.status}): ${text}`);
    }

    return (await response.json()) as Dict;
}

function testBuildHcpBrainSmoke() {
    const archetypes = [
        "time_constrained_community_doctor",
        "skeptical_specialist",
        "curious_uncertain_adopter",
        "cost_focused_decision_maker",
    ];

    for (const archetype of archetypes) {
        const brain = buildHcpBrain({
            disease_state: "cardiology",
            journey_stage: "objection_handling",
            interaction_pressure: "operationally_constrained",
            hcp_type: "treating_clinician",
            influence_driver: "evidence_driven",
            behavior_archetype: archetype,
            live_temperature: 7,
        });

        assert(Boolean(brain?.hcp_brain_id), `missing hcp_brain_id for ${archetype}`);
        assert(brain?.source === "predictive_hcp_brain_engine", `invalid source for ${archetype}`);
        assert(typeof brain?.clinician_perspective === "object", `missing clinician_perspective for ${archetype}`);
        assert(typeof brain?.decision_filter === "object", `missing decision_filter for ${archetype}`);
        assert(typeof brain?.dialogue_rules === "object", `missing dialogue_rules for ${archetype}`);
    }
}

function testBuildHcpBrainSummary() {
    const brain = buildHcpBrain({
        disease_state: "oncology",
        journey_stage: "clinical_value",
        interaction_pressure: "skeptical_resistant",
        hcp_type: "thought_leader",
        influence_driver: "guideline_anchored",
        behavior_archetype: "skeptical_specialist",
        live_temperature: 8,
    });

    const summary = buildHcpBrainSummary(brain);
    const required = [
        "archetype",
        "journey_stage",
        "influence_driver",
        "mindset_summary",
        "quality_test_question",
        "primary_trust_breaker",
        "primary_credibility_driver",
        "likely_objection",
        "recommended_rep_approach",
        "minimum_bar_for_progression",
        "internal_monologue",
    ];

    for (const key of required) {
        assert(Boolean(String((summary as Dict)[key] || "").trim()), `summary missing ${key}`);
    }
}

function testEvaluateRepAgainstBrain() {
    const brain = buildHcpBrain({
        disease_state: "cardiology",
        journey_stage: "objection_handling",
        interaction_pressure: "operationally_constrained",
        hcp_type: "treating_clinician",
        influence_driver: "evidence_driven",
        behavior_archetype: "skeptical_specialist",
        live_temperature: 8,
    });

    const weak = "This is a great product and everyone should use it now.";
    const strong = "I hear your concern on evidence quality. Would it be most useful to review subgroup outcomes relevant to your patient mix and then decide if a pilot is justified?";

    const weakResult = evaluateRepAgainstBrain(weak, brain);
    const strongResult = evaluateRepAgainstBrain(strong, brain);

    assert(typeof weakResult.quality_test_satisfied === "boolean", "weakResult missing quality_test_satisfied");
    assert(typeof strongResult.quality_test_satisfied === "boolean", "strongResult missing quality_test_satisfied");
    assert(Array.isArray(weakResult.trust_breakers_triggered), "weakResult trust_breakers_triggered should be array");
    assert(Array.isArray(strongResult.credibility_drivers_demonstrated), "strongResult credibility_drivers_demonstrated should be array");
}

function testPersonaContextContainsArchetypeCue() {
    const brain = buildHcpBrain({
        disease_state: "cardiology",
        journey_stage: "objection_handling",
        interaction_pressure: "operationally_constrained",
        hcp_type: "treating_clinician",
        influence_driver: "evidence_driven",
        behavior_archetype: "skeptical_specialist",
        live_temperature: 8,
    });

    const context = buildHcpBrainPersonaContext(brain);
    assert(context.includes("HCP Brain Persona Context"), "persona context heading missing");
    assert(context.toLowerCase().includes("skeptical_specialist"), "persona context missing archetype");
    assert(context.toLowerCase().includes("trust breaker"), "persona context missing trust breaker guidance");
}

async function testScenarioGenerationWithBrain() {
    const scenario = await post("/api/rps/generate-scenario", {
        disease_state: "Cardiology",
        hcp_profile: "Time-constrained community cardiologist",
        hcp_type: "treating_clinician",
        behavior_archetype: "skeptical_specialist",
        influence_driver: "evidence_driven",
        journey_stage: "objection_handling",
        interaction_pressure: "operationally_constrained",
        access_barrier_context: "Prior auth overhead and staffing constraints",
        rep_objective: "Advance a concrete next step",
        rep_selected_temperature: 8,
        live_temperature: 8,
    });

    const brain = asObject(scenario.hcp_brain);
    const summary = asObject(scenario.hcp_brain_summary);

    assert(Object.keys(brain).length > 0, "scenario missing hcp_brain");
    assert(Object.keys(summary).length > 0, "scenario missing hcp_brain_summary");
    assert(typeof brain.clinician_perspective === "object", "scenario hcp_brain.clinician_perspective missing");
    assert(Boolean(String(summary.quality_test_question || "").trim()), "scenario hcp_brain_summary.quality_test_question missing");

    return scenario;
}

async function testEvaluationWithBrain(scenario: Dict) {
    const evaluation = await post("/api/rps/evaluate-response", {
        scenario_id: scenario.scenario_id,
        scenario_context: scenario,
        hcp_brain: scenario.hcp_brain,
        rep_response_transcript:
            "I hear the concern about evidence quality and workflow burden. Would a focused subgroup review tied to your highest-risk cohort help you decide whether this is worth trialing?",
        voice_metadata: {
            words_per_minute: 130,
            pause_count: 2,
            avg_pause_duration_ms: 390,
            filler_word_rate: 0.01,
            speech_confidence_score: 0.87,
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
        rep_selected_temperature: 8,
        live_temperature: 8,
        conversation_memory: scenario.conversation_memory || {},
    });

    const alignment = asObject(evaluation.hcp_brain_alignment);
    const coaching = asObject(evaluation.hcp_brain_coaching);

    assert(Object.keys(alignment).length > 0, "evaluation missing hcp_brain_alignment");
    assert(Object.keys(coaching).length > 0, "evaluation missing hcp_brain_coaching");
    assert(typeof alignment.quality_test_satisfied === "boolean", "alignment.quality_test_satisfied must be boolean");
    assert(Boolean(String(alignment.alignment_rationale || "").trim()), "alignment.alignment_rationale missing");
    assert(Boolean(String(coaching.quality_test_feedback || "").trim()), "coaching.quality_test_feedback missing");
}

async function run() {
    console.log(`Running HCP Brain RPS tests against ${WORKER_URL}`);

    testBuildHcpBrainSmoke();
    testBuildHcpBrainSummary();
    testEvaluateRepAgainstBrain();
    testPersonaContextContainsArchetypeCue();

    const scenario = await testScenarioGenerationWithBrain();
    await testEvaluationWithBrain(scenario);

    console.log("HCP Brain RPS tests passed.");
}

run().catch((error) => {
    console.error(`HCP Brain RPS tests failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
