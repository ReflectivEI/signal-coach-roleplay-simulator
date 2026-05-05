/**
 * rpsUserInputOptions.ts
 *
 * SINGLE SOURCE OF TRUTH for all RPS user-facing and internal option arrays.
 *
 * All RPS pages must import from this file.
 * No page may define its own duplicate dropdown options for these concepts.
 *
 * Primary user-facing labels:
 *   1. HCP Type           (maps to hcp_type internally)
 *   2. Conversation Stage (maps to journey_stage internally)
 *   3. Challenge Context  (maps to influence_driver + pressure + archetype internally)
 *
 * Realism Level remains a separate slider where applicable.
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

// ── Primary user-facing controls ──────────────────────────────────────────

/**
 * Scenario Context — the high-level conversation context the rep is navigating.
 * Replaces "Journey Stage" as the primary visible label.
 * Values map 1:1 to journey_stage internally via SCENARIO_CONTEXT_TO_JOURNEY_STAGE.
 */
export const SCENARIO_CONTEXT_OPTIONS = [
    { value: "all", label: "All Scenario Contexts" },
    { value: "initial_access", label: "Initial Meeting" },
    { value: "discovery", label: "Discovery" },
    { value: "clinical_value", label: "Clinical Evidence Review" },
    { value: "objection_handling", label: "Objection Handling" },
    { value: "adoption_implementation", label: "Workflow Barrier" },
    { value: "access_formulary", label: "Access / Coverage" },
    { value: "commitment_close", label: "Commitment & Close" },
];

export const CONVERSATION_STAGE_OPTIONS = SCENARIO_CONTEXT_OPTIONS;

/**
 * Scenario Context Display Hints — shown in Advanced Controls to explain
 * which Journey Stage value the context maps to.
 */
export const SCENARIO_CONTEXT_HINTS: Record<string, string> = {
    initial_access: "Journey Stage: Initial Access",
    discovery: "Journey Stage: Discovery",
    clinical_value: "Journey Stage: Clinical Value",
    objection_handling: "Journey Stage: Objection Handling",
    adoption_implementation: "Journey Stage: Adoption & Implementation",
    access_formulary: "Journey Stage: Access & Formulary",
    commitment_close: "Journey Stage: Commitment & Close",
};

/**
 * HCP Role — replaces "HCP Type" / "Specialty / HCP Type" as the primary visible label.
 * Maps directly to hcp_type internally.
 */
export const HCP_ROLE_OPTIONS = [
    { value: "all", label: "All HCP Roles" },
    { value: "treating_clinician", label: "Treating Clinician" },
    { value: "influencer", label: "Influencer" },
    { value: "thought_leader", label: "Thought Leader" },
];

export const CHALLENGE_CONTEXT_OPTIONS = [
    { value: "all", label: "All Challenge Contexts" },
    { value: "workflow_friction", label: "Workflow / Staff Friction" },
    { value: "evidence_scrutiny", label: "Evidence Scrutiny" },
    { value: "guideline_alignment", label: "Guideline Alignment" },
    { value: "access_coverage", label: "Access / Coverage Barrier" },
    { value: "safety_risk", label: "Safety / Risk Concern" },
    { value: "cautious_commitment", label: "Commitment Hesitation" },
];

/**
 * HCP Mindset — replaces "Influence Driver" as the primary visible label.
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
    "Advanced overrides may change scenario behavior. These fields are derived automatically under normal use.";
