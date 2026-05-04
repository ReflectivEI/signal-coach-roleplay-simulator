export type RpsScenarioRequest = {
    hcp_profile: string;
    journey_stage: string;
    disease_state: string;
    interaction_pressure: string;
    access_barrier_context: string;
    rep_objective: string;
    hcp_default_temperature: number;
    rep_selected_temperature: number;
};

export type RpsVoiceMetadata = {
    response_duration_seconds: number;
    words_per_minute: number;
    pause_count: number;
    avg_pause_duration_ms: number;
    filler_word_count: number;
    filler_word_rate: number;
    question_count: number;
    speech_confidence_score: number;
};

export type RpsEvaluationOutcome = {
    commitment_attempted: boolean;
    commitment_type: string;
    commitment_strength: "none" | "weak" | "moderate" | "strong";
    hcp_progression: "regressed" | "unchanged" | "slightly_advanced" | "meaningfully_advanced";
    conversation_advanced: boolean;
    outcome_rationale: string;
};
