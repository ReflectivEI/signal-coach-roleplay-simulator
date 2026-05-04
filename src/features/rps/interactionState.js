const REQUIRED_KEYS = [
    "hcp_profile",
    "journey_stage",
    "disease_state",
    "interaction_pressure",
    "access_barrier_context",
    "rep_objective",
];

export function isGenerateDisabled(form, busy) {
    if (busy) return true;
    if (!form || typeof form !== "object") return true;
    return REQUIRED_KEYS.some((key) => !String(form[key] ?? "").trim());
}

export function clampTemperature(value) {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return 5;
    return Math.max(1, Math.min(10, Math.round(numeric)));
}

export function extractEightBehavioralMetricRows(evaluation) {
    const metrics = evaluation?.metric_scores || {};
    const expectedOrder = [
        "context_awareness",
        "cue_recognition",
        "empathy_acknowledgment",
        "strategic_questioning",
        "evidence_framing",
        "objection_handling",
        "conversational_control",
        "tone_pace_confidence",
    ];

    return expectedOrder.map((key) => ({
        key,
        score: metrics?.[key]?.score_1_to_10 ?? null,
        rationale: metrics?.[key]?.rationale ?? "",
    }));
}
