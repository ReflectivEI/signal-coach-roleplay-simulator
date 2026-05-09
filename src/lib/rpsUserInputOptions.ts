// Canonical scenario categories and difficulties for RPS UI (moved from scenarioCatalog.js)
export const CATEGORIES = ["All", "HIV / PrEP", "Oncology", "Cardiology", "Vaccines", "COVID-19", "Neurology", "Immunology", "Rare Disease"];
export const DIFFICULTIES = ["All Levels", "beginner", "intermediate", "advanced"];
// Canonical analytics option arrays for RPS UX and reporting
export const LEARNING_PATH_MAP = {
    signal_awareness: {
        coachingModule: "Question Mastery",
        moduleDesc: "Learn to ask purposeful, context-aware questions",
        scenarios: ["HIV Prevention Gap in High-Risk Population", "Oncology KOL Introduction"],
        frameworkLink: "signal_awareness",
        tip: "Practice building questions directly from what the HCP just said. Avoid pre-scripted openers.",
    },
    signal_interpretation: {
        coachingModule: "Stakeholder Mapping",
        moduleDesc: "Understand signals from different HCP types",
        scenarios: ["Treatment Optimization in Stable HIV Patients", "Rural HF Program with CKD Safety Concerns"],
        frameworkLink: "signal_interpretation",
        tip: "After each HCP statement, pause and paraphrase before responding. This sharpens interpretation.",
    },
    value_connection: {
        coachingModule: "Clinical Evidence",
        moduleDesc: "Connect clinical data to HCP-specific priorities",
        scenarios: ["Heart Failure GDMT Optimization Challenge", "ADC Integration with IO Backbone"],
        frameworkLink: "value_connection",
        tip: "Always reference something the HCP said before presenting value. 'Because you mentioned X...'",
    },
    objection_navigation: {
        coachingModule: "Objection Handling",
        moduleDesc: "Navigate resistance with composure and evidence",
        scenarios: ["PrEP Access Barriers Despite Strong Adoption", "Cardiology Formulary Review"],
        frameworkLink: "objection_navigation",
        tip: "Acknowledge first, explore second, respond third. Never jump straight to a rebuttal.",
    },
    commitment_generation: {
        coachingModule: "Closing Techniques",
        moduleDesc: "Secure specific, voluntary next steps",
        scenarios: ["Post-COVID Clinic Antiviral Adherence", "Primary Care Vaccine Capture Improvement"],
        frameworkLink: "commitment_generation",
        tip: "Ask for a specific action with a date, not a vague 'let's keep in touch'.",
    },
    conversation_management: {
        coachingModule: "Coaching Modules",
        moduleDesc: "Guide conversations with structure and intent",
        scenarios: ["Outpatient Antiviral Optimization", "Post-MI and HF Transitions Optimization"],
        frameworkLink: "conversation_management",
        tip: "Set a brief agenda at the start of every call and summarize before closing.",
    },
    adaptive_response: {
        coachingModule: "Behavioral Mastery",
        moduleDesc: "Flex your approach in real-time",
        scenarios: ["Pathway-Driven Care with Staffing Constraints", "Adult Flu Program Optimization"],
        frameworkLink: "adaptive_response",
        tip: "If the same approach isn't working, change it deliberately — not randomly.",
    },
};

export const CAPABILITY_LABELS = {
    signal_awareness:        "Signal Awareness",
    signal_interpretation:   "Signal Interpretation",
    value_connection:        "Value Connection",
    customer_engagement:     "Customer Engagement",
    objection_navigation:    "Objection Navigation",
    commitment_generation:   "Commitment Generation",
    conversation_management: "Conv. Management",
    adaptive_response:       "Adaptive Response",
};

export const CAPABILITY_COLORS = {
    signal_awareness:        "#0f766e",
    signal_interpretation:   "#14b8a6",
    value_connection:        "#0f766e",
    customer_engagement:     "#64748b",
    objection_navigation:    "#f59e0b",
    commitment_generation:   "#14b8a6",
    conversation_management: "#475569",
    adaptive_response:       "#2dd4bf",
};

export const BENCHMARK_SCORES = {
    signal_awareness:        3.5,
    signal_interpretation:   3.4,
    value_connection:        3.2,
    customer_engagement:     3.1,
    objection_navigation:    3.0,
    commitment_generation:   3.3,
    conversation_management: 3.1,
    adaptive_response:       3.2,
};
/**
 * rpsUserInputOptions.ts
 *
 * SINGLE SOURCE OF TRUTH for all RPS user-facing and internal option arrays.
 *
 * All RPS pages must import from this file.
 * No page may define its own duplicate dropdown options for these concepts.
 *
 * Primary user-facing labels:
 *   1. HCP Profile       (maps to hcp_type internally)
 *   2. Scenario Stage    (maps to journey_stage internally)
 *   3. Challenge Context (maps to influence_driver + pressure + archetype internally)
 *
 * Realism remains a separate slider where applicable.
 *
 * Fixed contract: 4 canonical controls (3 selectors + realism).
 *
 * Advanced / internal labels (hidden by default):
 *   Journey Stage, Influence Driver, Interaction Pressure,
 *   Behavior Archetype, Access Barrier Context, REP Objective, etc.
 */

// ── Disease / Specialty ────────────────────────────────────────────────────

export const DISEASE_STATES = [
    { value: "all", label: "All Disease Areas" },
    { value: "pulmonology", label: "Pulmonology" },
    { value: "cardiology", label: "Cardiology" },
    { value: "rheumatology", label: "Rheumatology" },
    { value: "neurology", label: "Neurology" },
    { value: "oncology", label: "Oncology" },
    { value: "nephrology", label: "Nephrology" },
    { value: "dermatology", label: "Dermatology" },
    { value: "hematology", label: "Hematology" },
    { value: "gastroenterology", label: "Gastroenterology" },
    { value: "endocrinology", label: "Endocrinology" },
    { value: "primary_care", label: "Primary Care" },
];

export const SPECIALTIES = [
    { value: "all", label: "All Specialties" },
    { value: "specialist", label: "Specialist" },
    { value: "primary_care", label: "Primary Care" },
    { value: "hospital_medicine", label: "Hospital Medicine" },
    { value: "academic", label: "Academic / KOL" },
];

export const RPS_UI_LABELS = {
    hcpType: "HCP Profile",
    stage: "Scenario Stage",
    challenge: "Challenge Context",
    realism: "Realism",
} as const;

// ── Primary user-facing controls ──────────────────────────────────────────

/**
 * Scenario Stage options for the fixed 4-control contract (3 selectors + realism).
 * Values map to journey_stage internally through mapUIToBrain().
 */
export const SCENARIO_CONTEXT_OPTIONS = [
     { value: "all", label: "All Scenario Stages" },
    { value: "first_exposure", label: "First Exposure" },
    { value: "early_exploration", label: "Early Exploration" },
    { value: "access_logistics", label: "Access / Logistics" },
    { value: "objection_resistance", label: "Objection / Resistance" },
    { value: "followup_commitment", label: "Follow-up / Commitment" },
];

export const CONVERSATION_STAGE_OPTIONS = SCENARIO_CONTEXT_OPTIONS;

/**
 * Scenario Stage display hints for derived mappings.
 * which journey-stage value the moment maps to.
 */
export const SCENARIO_CONTEXT_HINTS: Record<string, string> = {
    first_exposure: "Journey Stage: Initial Access",
    early_exploration: "Journey Stage: Discovery",
    access_logistics: "Journey Stage: Access & Formulary",
    objection_resistance: "Journey Stage: Objection Handling",
    followup_commitment: "Journey Stage: Commitment & Close",
};

/**
 * HCP Profile as the primary visible persona control.
 * Maps directly to hcp_type internally.
 */
export const HCP_ROLE_OPTIONS = [
    { value: "all", label: "All HCP Profiles" },
    { value: "treating_clinician", label: "Treating Clinician" },
    { value: "influencer", label: "Influencer" },
    { value: "thought_leader", label: "Thought Leader" },
];

export const CHALLENGE_CONTEXT_OPTIONS = [
    { value: "all", label: "All Challenge Contexts" },
    { value: "access_barrier", label: "Access Barrier" },
    { value: "time_constraint", label: "Time Constraint" },
    { value: "skepticism", label: "Skepticism" },
    { value: "prior_experience", label: "Prior Experience" },
    { value: "competing_priorities", label: "Competing Priorities" },
];

/**
 * HCP Mindset — internal mapping layer, not user-facing.
 * Maps to influence_driver internally.
 * Includes workflow_protective as a new option.
 */
export const HCP_MINDSET_OPTIONS = [
    { value: "all", label: "All Mindsets" },
    { value: "patient_centric", label: "Patient-Centric" },
    { value: "evidence_driven", label: "Evidence-Driven" },
    { value: "risk_averse", label: "Risk-Averse" },
    { value: "guideline_anchored", label: "Guideline-Anchored" },
    { value: "workflow_protective", label: "Workflow-Protective" },
];

/**
 * Realism Level labels — describes each 1–10 band for the slider UI.
 * Band behavior:
 *   1–3  → patient, cooperative, slower escalation
 *   4–7  → realistic guardedness, proof-seeking, moderate resistance
 *   8–10 → short, sharp, faster escalation, stronger consequences
 */
export const REALISM_LEVEL_LABELS: Record<number, string> = {
    1: "Very Cooperative",
    2: "Cooperative",
    3: "Mildly Guarded",
    4: "Balanced",
    5: "Moderately Guarded",
    6: "Proof-Seeking",
    7: "Resistant",
    8: "Sharply Resistant",
    9: "Highly Skeptical",
    10: "Confrontational",
};

export const REALISM_BAND_DESCRIPTIONS = [
    { range: "1–3", patience: "high", openness: "high", resistance: "low", escalation: "slow", responseLength: "longer", consequence: "minimal" },
    { range: "4–7", patience: "moderate", openness: "moderate", resistance: "moderate", escalation: "moderate", responseLength: "moderate", consequence: "proportionate" },
    { range: "8–10", patience: "low", openness: "low", resistance: "high", escalation: "fast", responseLength: "shorter", consequence: "escalating" },
];

// ── Internal / advanced option arrays (exposed only in Advanced Controls) ─

/**
 * Journey Stages — internal field. Use SCENARIO_CONTEXT_OPTIONS for new UI.
 * Kept for downstream compatibility.
 */
export const JOURNEY_STAGES = [
    { value: "all", label: "All Journey Stages" },
    { value: "initial_access", label: "Initial Access" },
    { value: "discovery", label: "Discovery" },
    { value: "clinical_value", label: "Clinical Value" },
    { value: "objection_handling", label: "Objection Handling" },
    { value: "adoption_implementation", label: "Adoption & Implementation" },
    { value: "access_formulary", label: "Access & Formulary" },
    { value: "commitment_close", label: "Commitment & Close" },
];

/**
 * Interaction Pressures — internal field. Hidden from primary UI.
 * Shown only in Advanced Controls.
 */
export const INTERACTION_PRESSURES = [
    { value: "all", label: "All Interaction Pressures" },
    { value: "time_constrained", label: "Time Constrained" },
    { value: "operationally_constrained", label: "Operationally Constrained" },
    { value: "skeptical_resistant", label: "Skeptical / Resistant" },
    { value: "competitive_bias", label: "Competitive Bias" },
    { value: "safety_concern", label: "Safety Concern" },
    { value: "access_barrier", label: "Access Barrier" },
    { value: "curious_uncertain", label: "Curious / Uncertain" },
];

/**
 * Behavior Archetypes — internal field. Hidden from primary UI.
 */
export const BEHAVIOR_ARCHETYPES = [
    { value: "time_constrained_community_doctor", label: "Guarded Gatekeeper" },
    { value: "skeptical_specialist", label: "Skeptical Specialist" },
    { value: "curious_uncertain_adopter", label: "Curious Uncertain Adopter" },
    { value: "cost_focused_decision_maker", label: "Cost-Focused Decision Maker" },
    { value: "protocol_guardian", label: "Protocol Guardian" },
];

export const ACCESS_BARRIER_CONTEXTS = [
    { value: "none", label: "No Immediate Access Barrier" },
    { value: "prior_auth_volume", label: "High Prior Authorization Volume" },
    { value: "step_therapy_restriction", label: "Step-Therapy Restriction" },
    { value: "formulary_non_preferred", label: "Non-Preferred Formulary Status" },
    { value: "payer_policy_variability", label: "Payer Policy Variability" },
    { value: "staffing_limited_follow_up", label: "Limited Staff Follow-Up Capacity" },
];

export const REP_OBJECTIVE_OPTIONS = [
    { value: "establish_relevance", label: "Establish Relevance Quickly" },
    { value: "uncover_primary_blocker", label: "Uncover Primary Blocker" },
    { value: "validate_patient_fit", label: "Validate Patient Fit" },
    { value: "align_on_evidence", label: "Align on Evidence Threshold" },
    { value: "resolve_access_concern", label: "Resolve Access Concern" },
    { value: "secure_small_next_step", label: "Secure Small Next Step" },
];

// ── Backward-compatibility aliases ────────────────────────────────────────
// Downstream consumers (predictiveBuilderModel.js, etc.) may import these.
// These alias the new primary labels so existing import paths don't break.

/** @deprecated Use HCP_ROLE_OPTIONS. Kept for downstream compatibility. */
export const HCP_TYPES = HCP_ROLE_OPTIONS;

/** @deprecated Use HCP_MINDSET_OPTIONS. Kept for downstream compatibility. */
export const INFLUENCE_DRIVERS = HCP_MINDSET_OPTIONS;

// ── Advanced Controls metadata ─────────────────────────────────────────────

export const ADVANCED_INTERNAL_FIELD_LABELS: Record<string, string> = {
    journey_stage: "Journey Stage",
    interaction_pressure: "Interaction Pressure",
    influence_driver: "Influence Driver",
    behavior_archetype: "Behavior Archetype",
    access_barrier_context: "Access Barrier Context",
    rep_objective: "REP Objective",
    scenario_anchors: "Scenario Anchors",
    allowed_topic_lanes: "Allowed Topic Lanes",
};

export const ADVANCED_CONTROLS_WARNING =
    "These fields are derived automatically under normal use.";
