const BASE = "https://reflectivai-rps-api-staging.tonyabdelmalak.workers.dev";

async function post(path, body) {
    const r = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const t = await r.text();
    let j;
    try {
        j = JSON.parse(t);
    } catch {
        j = { raw: t };
    }

    if (!r.ok) {
        throw new Error(`${path} ${r.status}: ${t}`);
    }

    return j;
}

async function main() {
    const setup = {
        hcp_profile: "Academic Specialist - Committee Driven",
        journey_stage: "clinical_value",
        disease_state: "Cardiology",
        interaction_pressure: "time_constrained",
        access_barrier_context: "Prior Authorization Burden",
        rep_objective: "Earn permission to discuss fit and next step",
        live_temperature: 9,
        rep_selected_temperature: 9,
    };

    const scenario = await post("/api/rps/generate-scenario", setup);

    const weakResp = "I understand your concern. Our product has strong data and could be a good option for your patients. I'd be happy to send you more information.";
    const strongResp = "That makes sense, especially if workflow and access have been the bigger friction points than clinical interest. When you say it may not change what you do, is that mainly because of prior authorization, staff burden, or because you haven't seen a clear enough patient type where it fits?";
    const avgResp = "I hear the concern and we do have relevant data. Would it help if I send a short summary and then we review where it might fit?";
    const badResp = "Great product. Strong data. Very innovative.";

    const evalBody = (resp, t = 9) => ({
        scenario_context: scenario,
        selected_dropdowns: { ...setup, live_temperature: t, rep_selected_temperature: t },
        rep_response_transcript: resp,
        rep_selected_temperature: t,
        live_temperature: t,
        voice_metadata: {
            words_per_minute: 136,
            pause_count: 2,
            avg_pause_duration_ms: 420,
            filler_word_rate: 0.01,
            speech_confidence_score: 0.82,
        },
    });

    const weak = await post("/api/rps/evaluate-response", evalBody(weakResp, 9));
    const strong = await post("/api/rps/evaluate-response", evalBody(strongResp, 9));
    const avg = await post("/api/rps/evaluate-response", evalBody(avgResp, 6));
    const bad = await post("/api/rps/evaluate-response", evalBody(badResp, 6));

    const out = {
        scenario: {
            opening_scene: scenario.opening_scene,
            hcp_statement_or_question: scenario.hcp_statement_or_question,
            cue_signal: scenario.cue_signal,
            cue_signal_layered: scenario.cue_signal_layered,
            bannedPhraseHit: /tell me more about your product|how is this different|i\s*'?m skeptical|can you provide evidence|this seems interesting/i.test(
                String(scenario.hcp_statement_or_question || "")
            ),
        },
        weak: {
            overall_score: weak.overall_score,
            missed_cues: weak.missed_cues,
            commitment_attempted: weak?.outcome_analysis?.commitment_attempted,
            commitment_type: weak?.outcome_analysis?.commitment_type,
            commitment_strength: weak?.outcome_analysis?.commitment_strength,
            hcp_progression: weak?.outcome_analysis?.hcp_progression,
            conversation_advanced: weak?.outcome_analysis?.conversation_advanced,
            outcome_rationale: weak?.outcome_analysis?.outcome_rationale,
            next_best_question: weak.next_best_question,
            coaching_feedback: weak.coaching_feedback,
        },
        strong: {
            overall_score: strong.overall_score,
            cue_recognition: strong?.metric_scores?.cue_recognition?.score_1_to_10,
            strategic_questioning: strong?.metric_scores?.strategic_questioning?.score_1_to_10,
            context_awareness: strong?.metric_scores?.context_awareness?.score_1_to_10,
            commitment_attempted: strong?.outcome_analysis?.commitment_attempted,
            commitment_type: strong?.outcome_analysis?.commitment_type,
            commitment_strength: strong?.outcome_analysis?.commitment_strength,
            hcp_progression: strong?.outcome_analysis?.hcp_progression,
            conversation_advanced: strong?.outcome_analysis?.conversation_advanced,
            outcome_rationale: strong?.outcome_analysis?.outcome_rationale,
        },
        outcome_fields_present: {
            weak: [
                "commitment_attempted",
                "commitment_type",
                "commitment_strength",
                "hcp_progression",
                "conversation_advanced",
                "outcome_rationale",
            ].every((k) => weak?.outcome_analysis && Object.prototype.hasOwnProperty.call(weak.outcome_analysis, k)),
            strong: [
                "commitment_attempted",
                "commitment_type",
                "commitment_strength",
                "hcp_progression",
                "conversation_advanced",
                "outcome_rationale",
            ].every((k) => strong?.outcome_analysis && Object.prototype.hasOwnProperty.call(strong.outcome_analysis, k)),
        },
        inflation_pattern: {
            bad: bad.overall_score,
            average: avg.overall_score,
            strong: strong.overall_score,
        },
    };

    console.log(JSON.stringify(out, null, 2));
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
