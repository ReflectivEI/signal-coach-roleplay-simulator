const baseUrl = process.env.RPS_WORKER_URL || process.env.VITE_ROLEPLAY_WORKER_URL || 'http://127.0.0.1:8787';

async function post(path, payload) {
    const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!res.ok) throw new Error(`${path} ${res.status}: ${text}`);
    return json;
}

const selections = {
    disease_state: 'Cardiology',
    specialty_hcp_type: 'Treating Clinician',
    hcp_type: 'Treating Clinician',
    journey_stage: 'Initial Access',
    interaction_pressure: 'Time Constrained',
    influence_driver: 'Patient-Centric',
    behavior_archetype: 'Guarded Gatekeeper',
    access_barrier_context: 'Prior authorization burden and staff callback overload',
    rep_objective: 'Earn permission for one concrete next step'
};

const turnVoice = {
    neutral: { words_per_minute: 136, pause_count: 2, avg_pause_duration_ms: 420, filler_word_rate: 0.015, question_count: 0, speech_confidence_score: 0.82 },
    poor: { words_per_minute: 196, pause_count: 0, avg_pause_duration_ms: 140, filler_word_rate: 0.08, question_count: 0, speech_confidence_score: 0.80 },
    improved: { words_per_minute: 142, pause_count: 3, avg_pause_duration_ms: 560, filler_word_rate: 0.02, question_count: 1, speech_confidence_score: 0.83 },
    strong: { words_per_minute: 132, pause_count: 3, avg_pause_duration_ms: 620, filler_word_rate: 0.01, question_count: 1, speech_confidence_score: 0.87 }
};

const repTurns = [
    'Thanks for your time. I wanted to share some information about our therapy and how it may help patients overall.',
    'I hear things are busy, and I understand there are pressures. We have strong outcomes and broad value that could be relevant here.',
    'This product has excellent efficacy and you should consider it quickly because it can make a major difference across many patients.',
    'At this level of pressure we should move now because the value is clear and it is a strong option for your population.',
    'I hear the workflow concern, especially around prior-auth callbacks, and I want to stay focused on the practical bottleneck first.',
    'Which specific step is creating the most repeated staff work right now: missing documentation, callback loops, or patient-fit uncertainty?',
    'For the cardiology patients you are screening now, if we reduce callback loops at that first decision point, does that address the barrier that is slowing treatment decisions?',
    'If that aligns, would you be open to one short follow-up to review one patient-profile criterion and one access step your team could test this week?'
];

function compactEval(e) {
    return {
        overall_score: e.overall_score,
        metric_scores: e.metric_scores,
        hcp_brain_alignment: e.hcp_brain_alignment,
        outcome_analysis: e.outcome_analysis,
        delivery_impact_on_hcp: e.delivery_impact_on_hcp,
        coaching_feedback: e.coaching_feedback,
        delivery_coaching: e.delivery_coaching,
        voice_behavior_adaptation: e.voice_behavior_adaptation,
        simulated_hcp_next_response: e.simulated_hcp_next_response,
        conversation_memory: e.conversation_memory
    };
}

(async () => {
    const startTemp = 6;
    const scenario = await post('/api/rps/generate-scenario', {
        ...selections,
        hcp_default_temperature: startTemp,
        rep_selected_temperature: startTemp,
        live_temperature: startTemp,
        initial_temperature: startTemp,
        conversation_memory: {}
    });

    let memory = scenario.conversation_memory || {};
    let scenarioContext = scenario;
    const turns = [];

    for (let i = 0; i < repTurns.length; i++) {
        const turn = i + 1;
        const temperature = turn >= 4 ? 9 : 6;
        const voice = turn <= 2 ? turnVoice.neutral : (turn <= 4 ? turnVoice.poor : (turn <= 6 ? turnVoice.improved : turnVoice.strong));

        const evalRes = await post('/api/rps/evaluate-response', {
            scenario_id: scenario.scenario_id,
            scenario_context: scenarioContext,
            rep_response_transcript: repTurns[i],
            voice_metadata: voice,
            selected_dropdowns: {
                disease_state: selections.disease_state,
                hcp_profile: selections.specialty_hcp_type,
                hcp_type: selections.specialty_hcp_type,
                behavior_archetype: selections.behavior_archetype,
                influence_driver: selections.influence_driver,
                journey_stage: selections.journey_stage,
                interaction_pressure: selections.interaction_pressure
            },
            rep_selected_temperature: temperature,
            live_temperature: temperature,
            conversation_memory: memory,
            hcp_brain: scenario.hcp_brain
        });

        turns.push({
            turn,
            rep_input: repTurns[i],
            voice_metadata: voice,
            hcp_response: evalRes.simulated_hcp_next_response || null,
            cue_signal: scenario.cue_signal,
            temperature,
            evaluation: compactEval(evalRes)
        });

        memory = evalRes.conversation_memory || memory;
        scenarioContext = {
            ...scenarioContext,
            conversation_memory: memory,
            hcp_statement_or_question: evalRes.simulated_hcp_next_response || scenarioContext.hcp_statement_or_question
        };
    }

    const out = {
        baseUrl,
        selections,
        scenario_summary: {
            scenario_id: scenario.scenario_id,
            opening_scene: scenario.opening_scene,
            initial_hcp_statement: scenario.hcp_statement_or_question,
            cue_signal: scenario.cue_signal,
            hcp_brain: scenario.hcp_brain,
            hcp_brain_summary: scenario.hcp_brain_summary
        },
        turns,
        final_memory: memory
    };

    console.log(JSON.stringify(out, null, 2));
})();
