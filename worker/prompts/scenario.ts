export type ScenarioPromptInput = {
    hcpProfile: string;
    journeyStage: string;
    diseaseState: string;
    interactionPressure: string;
    accessBarrierContext: string;
    repObjective: string;
    difficultyLabel: string;
    behavioralTraits: string[];
    liveTemperature: number;
    conversationMemorySummary: string;
    voiceBehaviorAdaptationSummary: string;
    /** Injected from hcpBrain.js when brain selections are present. */
    hcpBrainContext?: string;
};

// hcpBrainContext is injected from worker/rps/hcpBrain.js when brain selections are present.

export function buildScenarioPrompt(input: ScenarioPromptInput): string {
    const traits = input.behavioralTraits.join(", ");

    return [
        ...(input.hcpBrainContext ? [input.hcpBrainContext, ""] : []),
        "You are creating a synthetic pharmaceutical role-play scenario for sales coaching.",
        "",
        "Rules:",
        "- Synthetic only, no PHI, no patient identifiers.",
        "- Keep the HCP realistic and context-aware.",
        "- Include ambiguity or tension that forces strategic response.",
        "- Do not produce generic textbook wording.",
        "- Do not use obvious placeholder chatbot language.",
        "- Keep language clinically plausible: practical constraints, competing priorities, mild guardedness, conditional openness.",
        "- Include incomplete thought fragments or compressed phrasing when pressure is high.",
        "",
        "Banned phrasing (do not use):",
        "- Tell me more about your product",
        "- How is this different?",
        "- I'm skeptical",
        "- Can you provide evidence?",
        "- This seems interesting",
        "",
        "Realism guidance:",
        "- Use indirect objections, subtle dismissal, practical constraints, workflow/access friction, and conditional openness.",
        "- HCP should sound like a clinician balancing time, staff burden, and decision risk.",
        "- HCP should not become instantly convinced at any temperature.",
        "- When generating the next HCP response, incorporate the REP's delivery quality. If the REP rushed, skipped pauses, used vague confidence, or asked no diagnostic question, the HCP should become more guarded or resistant. If the REP paused appropriately, acknowledged the concern, and asked a precise diagnostic question, the HCP may soften slightly or provide more useful detail. Preserve clinical realism and do not overreact.",
        "",
        "Temperature behavior:",
        "- 1-3: open but realistic; may ask clarifying questions; may give partial agreement.",
        "- 4-7: selective; challenges vague claims; neutral unless REP earns engagement.",
        "- 8-10: resistant; compressed responses; redirects to constraints; needs high specificity before softening.",
        "",
        "Context:",
        `- HCP profile: ${input.hcpProfile}`,
        `- Journey stage: ${input.journeyStage}`,
        `- Disease state: ${input.diseaseState}`,
        `- Interaction pressure: ${input.interactionPressure}`,
        `- Access barrier context: ${input.accessBarrierContext}`,
        `- REP objective: ${input.repObjective}`,
        `- Difficulty: ${input.difficultyLabel}`,
        `- Live temperature (1-10): ${input.liveTemperature}`,
        `- Behavioral traits at this realism level: ${traits}`,
        `- Conversation memory summary: ${input.conversationMemorySummary}`,
        `- Voice adaptation summary: ${input.voiceBehaviorAdaptationSummary}`,
        "",
        "Return one concise JSON object with keys:",
        "opening_scene, hcp_statement_or_question, cue_signal, cue_signal_layered, hcp_likely_motivation,",
        "journey_stage_context, expected_rep_skill_response, si_capabilities_tested,",
        "behavioral_metrics_observed, scoring_rubric, conversation_memory",
        "",
        "cue_signal_layered must be:",
        "{ primary_cue, secondary_cue, hidden_resistance, openness_level, emotional_tone, likely_reason_for_pushback, what_the_rep_must_detect }",
        "",
        "conversation_memory must be:",
        "{ prior_rep_moves, prior_hcp_reactions, unresolved_cues, addressed_cues, resistance_trend, trust_trend, last_commitment_attempt }",
        "",
        "For scoring_rubric, return an array of objects: { metric, what_good_looks_like, common_miss }",
        "For si_capabilities_tested, return 3 to 5 capabilities.",
        "Return valid JSON only.",
    ].join("\n");
}
