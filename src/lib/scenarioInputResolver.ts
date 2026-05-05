/**
 * scenarioInputResolver.ts
 *
 * Resolves simplified user-facing RPS inputs (Scenario Context, HCP Role,
 * HCP Mindset, Realism Level) into the full internal brain schema required by:
 *   - hcpResponseGenerator.ts (scenarioRouting, runtimeTemperature)
 *   - hcpResponseSurface
 *   - QATwin / qa-matrix
 *   - Predictive Builder
 *   - Adaptive RPS
 *   - SessionSummaryModal
 *   - Voice evaluation / behavioral scoring
 *
 * Also exports deriveUserFacingInputsFromScenario() to pre-populate simplified
 * controls when loading existing scenario cards.
 *
 * resolver_version: "rps-input-resolver-v1"
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface RpsUserInputs {
    scenarioContext: string;
    hcpRole: string;
    hcpMindset: string;
    realismLevel: number;
    diseaseState?: string;
    specialty?: string;
    optionalOverrides?: Partial<ResolvedRpsFields>;
}

/** Full internal schema. Downstream consumers must not be changed. */
export interface ResolvedRpsFields {
    disease_state: string;
    specialty: string;
    hcp_type: string;
    hcp_role: string;
    journey_stage: string;
    interaction_pressure: string[];
    influence_driver: string;
    behavior_archetype: string;
    access_barrier_context: string;
    rep_objective: string;
    realism_level: number;
    runtime_temperature: number;
    scenario_language_anchors: string[];
    allowed_topic_lanes: string[];
    predictive_profile_seed: {
        diseaseState: string;
        hcpType: string;
        journeyStage: string;
        interactionPressure: string;
        influenceDriver: string;
        behaviorArchetype: string;
    };
    adaptive_behavior_seed: AdaptiveBehaviorSeed;
    qa_expected_behavior: string;
    resolved_input_model: ResolvedInputModel;
}

export interface AdaptiveBehaviorSeed {
    patience: "high" | "moderate" | "low";
    openness: "high" | "moderate" | "low";
    resistance: "low" | "moderate" | "high";
    escalation_speed: "slow" | "moderate" | "fast";
    response_length: "long" | "moderate" | "short";
    skepticism: "low" | "moderate" | "high";
    temperature_band: "low" | "moderate" | "high";
    interruption_likelihood: "low" | "moderate" | "high";
    consequence_behavior: "minimal" | "proportionate" | "escalating";
}

export interface ResolvedInputModel {
    scenarioContext: string;
    hcpRole: string;
    hcpMindset: string;
    challenge?: string;
    realismLevel: number;
    resolvedFields: Record<string, unknown>;
    optionalOverrides: Partial<ResolvedRpsFields>;
    resolverVersion: "rps-input-resolver-v1";
}

export interface UnifiedScenarioInput {
    hcpType: string;
    stage: string;
    challenge: string;
    realism?: number;
    diseaseState?: string;
    specialty?: string;
    optionalOverrides?: Partial<ResolvedRpsFields>;
}

export type ConsolidatedUiInputs = UnifiedScenarioInput;

// ── Scenario Context → internal field map ─────────────────────────────────
// Maps each Scenario Context value to derived journey_stage, interaction_pressure,
// behavior_archetype, rep_objective, access_barrier_context, anchors, topic lanes.

interface ScenarioContextEntry {
    journey_stage: string;
    interaction_pressure: string[];
    behavior_archetype: string;
    rep_objective: string;
    access_barrier_context: string;
    scenario_language_anchors: string[];
    allowed_topic_lanes: string[];
    qa_expected_behavior: string;
}

const SCENARIO_CONTEXT_MAP: Record<string, ScenarioContextEntry> = {
    initial_access: {
        journey_stage: "initial_access",
        interaction_pressure: [],
        behavior_archetype: "curious_uncertain_adopter",
        rep_objective: "establish_relevance",
        access_barrier_context: "none",
        scenario_language_anchors: ["relevance", "patient fit", "introductory context"],
        allowed_topic_lanes: ["discovery", "clinical_value"],
        qa_expected_behavior: "solution_seeking",
    },
    discovery: {
        journey_stage: "discovery",
        interaction_pressure: [],
        behavior_archetype: "curious_uncertain_adopter",
        rep_objective: "uncover_primary_blocker",
        access_barrier_context: "none",
        scenario_language_anchors: ["patient population", "current workflow", "clinical priority"],
        allowed_topic_lanes: ["discovery", "clinical_value"],
        qa_expected_behavior: "solution_seeking",
    },
    clinical_value: {
        journey_stage: "clinical_value",
        interaction_pressure: ["skeptical_resistant"],
        behavior_archetype: "skeptical_specialist",
        rep_objective: "align_on_evidence",
        access_barrier_context: "none",
        scenario_language_anchors: ["clinical data", "endpoint", "real-world evidence", "patient population fit"],
        allowed_topic_lanes: ["clinical_value", "evidence"],
        qa_expected_behavior: "solution_seeking",
    },
    objection_handling: {
        journey_stage: "objection_handling",
        interaction_pressure: ["skeptical_resistant"],
        behavior_archetype: "skeptical_specialist",
        rep_objective: "validate_patient_fit",
        access_barrier_context: "none",
        scenario_language_anchors: ["concern", "objection", "barrier", "hesitation"],
        allowed_topic_lanes: ["clinical_value", "access", "discovery"],
        qa_expected_behavior: "solution_seeking",
    },
    adoption_implementation: {
        journey_stage: "adoption_implementation",
        interaction_pressure: ["operationally_constrained"],
        behavior_archetype: "time_constrained_community_doctor",
        rep_objective: "validate_patient_fit",
        access_barrier_context: "staffing_limited_follow_up",
        scenario_language_anchors: ["workflow", "staff burden", "process", "implementation step"],
        allowed_topic_lanes: ["workflow", "access", "implementation"],
        qa_expected_behavior: "solution_seeking",
    },
    access_formulary: {
        journey_stage: "access_formulary",
        interaction_pressure: ["access_barrier"],
        behavior_archetype: "cost_focused_decision_maker",
        rep_objective: "resolve_access_concern",
        access_barrier_context: "formulary_non_preferred",
        scenario_language_anchors: ["prior auth", "formulary", "coverage", "access step", "payer"],
        allowed_topic_lanes: ["access", "workflow"],
        qa_expected_behavior: "solution_seeking",
    },
    commitment_close: {
        journey_stage: "commitment_close",
        interaction_pressure: [],
        behavior_archetype: "curious_uncertain_adopter",
        rep_objective: "secure_small_next_step",
        access_barrier_context: "none",
        scenario_language_anchors: ["next step", "commitment", "move forward", "trial patient"],
        allowed_topic_lanes: ["clinical_value", "workflow", "access"],
        qa_expected_behavior: "solution_seeking",
    },
};

// ── HCP Mindset → influence_driver + behavioral modifiers ─────────────────

interface MindsetEntry {
    influence_driver: string;
    behavior_archetype_modifier?: string;
    credibility_drivers: string[];
    trust_breakers: string[];
    scenario_language_anchors_extra: string[];
}

const HCP_MINDSET_MAP: Record<string, MindsetEntry> = {
    patient_centric: {
        influence_driver: "patient_centric",
        credibility_drivers: ["patient outcomes", "real-world data", "patient benefit"],
        trust_breakers: ["untested therapies", "unproven safety"],
        scenario_language_anchors_extra: ["patient outcome", "patient benefit", "real-world fit"],
    },
    evidence_driven: {
        influence_driver: "evidence_driven",
        credibility_drivers: ["clinical trial data", "endpoints", "study population"],
        trust_breakers: ["anecdotal claims", "small sample size"],
        scenario_language_anchors_extra: ["trial data", "clinical endpoint", "study population"],
    },
    risk_averse: {
        influence_driver: "risk_averse",
        credibility_drivers: ["safety profile", "long-term tolerability", "monitoring requirements"],
        trust_breakers: ["aggressive claims", "minimized side effects"],
        scenario_language_anchors_extra: ["safety profile", "long-term tolerability", "monitoring"],
    },
    guideline_anchored: {
        influence_driver: "guideline_anchored",
        behavior_archetype_modifier: "protocol_guardian",
        credibility_drivers: ["guideline placement", "standard of care", "pathway alignment"],
        trust_breakers: ["non-guideline claims", "pathway deviation"],
        scenario_language_anchors_extra: ["guideline placement", "standard of care", "pathway"],
    },
    workflow_protective: {
        influence_driver: "patient_centric",
        behavior_archetype_modifier: "time_constrained_community_doctor",
        credibility_drivers: ["workflow simplicity", "staff burden reduction", "minimal operational steps"],
        trust_breakers: ["complex implementation", "additional staff work"],
        scenario_language_anchors_extra: ["workflow simplicity", "staff burden", "operational steps"],
    },
    skeptical: {
        influence_driver: "evidence_driven",
        behavior_archetype_modifier: "skeptical_specialist",
        credibility_drivers: ["hard data", "comparative outcomes", "real-world evidence"],
        trust_breakers: ["vague claims", "unsupported assertions"],
        scenario_language_anchors_extra: ["hard data", "comparative outcomes", "evidence gap"],
    },
};

interface ChallengeContextEntry {
    hcpMindset: string;
    interactionPressure?: string[];
    behaviorArchetype?: string;
    accessBarrierContext?: string;
    repObjective?: string;
}

const DEFAULT_DISEASE_STATE = "primary_care";

const CHALLENGE_CONTEXT_MAP: Record<string, ChallengeContextEntry> = {
    workflow_friction: {
        hcpMindset: "workflow_protective",
        interactionPressure: ["operationally_constrained"],
        behaviorArchetype: "time_constrained_community_doctor",
        accessBarrierContext: "staffing_limited_follow_up",
        repObjective: "validate_patient_fit",
    },
    evidence_scrutiny: {
        hcpMindset: "evidence_driven",
        interactionPressure: ["skeptical_resistant"],
        behaviorArchetype: "skeptical_specialist",
        repObjective: "align_on_evidence",
    },
    guideline_alignment: {
        hcpMindset: "guideline_anchored",
        interactionPressure: ["skeptical_resistant"],
        behaviorArchetype: "protocol_guardian",
        repObjective: "align_on_evidence",
    },
    access_coverage: {
        hcpMindset: "patient_centric",
        interactionPressure: ["access_barrier"],
        behaviorArchetype: "cost_focused_decision_maker",
        accessBarrierContext: "formulary_non_preferred",
        repObjective: "resolve_access_concern",
    },
    safety_risk: {
        hcpMindset: "risk_averse",
        interactionPressure: ["safety_concern"],
        behaviorArchetype: "skeptical_specialist",
        repObjective: "validate_patient_fit",
    },
    cautious_commitment: {
        hcpMindset: "evidence_driven",
        interactionPressure: ["curious_uncertain"],
        behaviorArchetype: "curious_uncertain_adopter",
        repObjective: "secure_small_next_step",
    },
};

// ── Realism Level → Adaptive Behavior Seed ───────────────────────────────
// Drives visible behavioral differences at bands 1–3, 4–7, 8–10.

function deriveAdaptiveSeed(realismLevel: number): AdaptiveBehaviorSeed {
    const level = Math.max(1, Math.min(10, Math.round(realismLevel)));

    if (level <= 3) {
        return {
            patience: "high",
            openness: "high",
            resistance: "low",
            escalation_speed: "slow",
            response_length: "long",
            skepticism: "low",
            temperature_band: "low",
            interruption_likelihood: "low",
            consequence_behavior: "minimal",
        };
    }

    if (level <= 7) {
        return {
            patience: "moderate",
            openness: "moderate",
            resistance: "moderate",
            escalation_speed: "moderate",
            response_length: "moderate",
            skepticism: "moderate",
            temperature_band: "moderate",
            interruption_likelihood: "low",
            consequence_behavior: "proportionate",
        };
    }

    return {
        patience: "low",
        openness: "low",
        resistance: "high",
        escalation_speed: "fast",
        response_length: "short",
        skepticism: "high",
        temperature_band: "high",
        interruption_likelihood: "moderate",
        consequence_behavior: "escalating",
    };
}

// ── Main resolver ──────────────────────────────────────────────────────────

/**
 * resolveRpsUserInputs
 *
 * Converts simplified user-facing inputs into the full internal brain schema.
 * All downstream consumers (hcpResponseGenerator, QATwin, etc.) must receive
 * fields from this resolved output — not from the raw simplified inputs.
 *
 * Both the predictive layer and adaptive layer are populated:
 *   Predictive layer: hcp_type, influence_driver, behavior_archetype,
 *                     scenario_language_anchors, predictive_profile_seed
 *   Adaptive layer:   runtime_temperature, adaptive_behavior_seed
 */
export function resolveRpsUserInputs(inputs: RpsUserInputs): ResolvedRpsFields {
    const {
        scenarioContext = "discovery",
        hcpRole = "treating_clinician",
        hcpMindset = "patient_centric",
        realismLevel = 5,
        diseaseState = "",
        specialty = "",
        optionalOverrides = {},
    } = inputs;

    const contextEntry = SCENARIO_CONTEXT_MAP[scenarioContext] ?? SCENARIO_CONTEXT_MAP.discovery;
    const mindsetEntry = HCP_MINDSET_MAP[hcpMindset] ?? HCP_MINDSET_MAP.patient_centric;
    const adaptiveSeed = deriveAdaptiveSeed(realismLevel);

    // Merge anchors from context + mindset
    const mergedAnchors = [
        ...(contextEntry.scenario_language_anchors ?? []),
        ...(mindsetEntry.scenario_language_anchors_extra ?? []),
    ];

    // Behavior archetype: mindset modifier takes precedence if set
    const behaviorArchetype =
        mindsetEntry.behavior_archetype_modifier ?? contextEntry.behavior_archetype;

    const normalizedHcpRole = hcpRole === "all" ? "treating_clinician" : hcpRole;
    const normalizedMindset = hcpMindset === "all" ? "patient_centric" : hcpMindset;

    const resolvedFields: Omit<ResolvedRpsFields, "resolved_input_model"> = {
        disease_state: diseaseState || "",
        specialty: specialty || "",
        hcp_type: normalizedHcpRole,
        hcp_role: normalizedHcpRole,
        journey_stage: contextEntry.journey_stage,
        interaction_pressure: contextEntry.interaction_pressure,
        influence_driver: mindsetEntry.influence_driver,
        behavior_archetype: behaviorArchetype,
        access_barrier_context: contextEntry.access_barrier_context,
        rep_objective: contextEntry.rep_objective,
        realism_level: realismLevel,
        runtime_temperature: realismLevel,
        scenario_language_anchors: mergedAnchors,
        allowed_topic_lanes: contextEntry.allowed_topic_lanes,
        predictive_profile_seed: {
            diseaseState: diseaseState || "",
            hcpType: normalizedHcpRole,
            journeyStage: contextEntry.journey_stage,
            interactionPressure: contextEntry.interaction_pressure[0] ?? "",
            influenceDriver: mindsetEntry.influence_driver,
            behaviorArchetype: behaviorArchetype,
        },
        adaptive_behavior_seed: adaptiveSeed,
        qa_expected_behavior: contextEntry.qa_expected_behavior,
    };

    const resolved: ResolvedRpsFields = {
        ...resolvedFields,
        ...optionalOverrides,
        resolved_input_model: {
            scenarioContext,
            hcpRole: normalizedHcpRole,
            hcpMindset: normalizedMindset,
            realismLevel,
            resolvedFields: {
                journey_stage: contextEntry.journey_stage,
                influence_driver: mindsetEntry.influence_driver,
                behavior_archetype: behaviorArchetype,
                interaction_pressure: contextEntry.interaction_pressure,
                access_barrier_context: contextEntry.access_barrier_context,
                rep_objective: contextEntry.rep_objective,
                credibility_drivers: mindsetEntry.credibility_drivers,
                trust_breakers: mindsetEntry.trust_breakers,
                adaptive_behavior: adaptiveSeed.temperature_band,
            },
            optionalOverrides,
            resolverVersion: "rps-input-resolver-v1",
        },
    };

    return resolved;
}

function normalizeUnifiedScenarioInput(inputs: UnifiedScenarioInput & {
    conversationStage?: string;
    challengeContext?: string;
    realismLevel?: number;
}) {
    return {
        hcpType: inputs?.hcpType || "treating_clinician",
        stage: inputs?.stage || inputs?.conversationStage || "discovery",
        challenge: inputs?.challenge || inputs?.challengeContext || "evidence_scrutiny",
        realism: inputs?.realism ?? inputs?.realismLevel ?? 5,
        diseaseState: inputs?.diseaseState,
        specialty: inputs?.specialty,
        optionalOverrides: inputs?.optionalOverrides,
    };
}

export function mapUIToBrain(inputs: UnifiedScenarioInput & {
    conversationStage?: string;
    challengeContext?: string;
    realismLevel?: number;
}) {
    const {
        hcpType = "treating_clinician",
        stage = "discovery",
        challenge = "evidence_scrutiny",
        realism = 5,
        diseaseState = DEFAULT_DISEASE_STATE,
        specialty = "",
        optionalOverrides = {},
    } = normalizeUnifiedScenarioInput(inputs);

    const challengeEntry = CHALLENGE_CONTEXT_MAP[challenge] ?? CHALLENGE_CONTEXT_MAP.evidence_scrutiny;
    const baseResolved = resolveRpsUserInputs({
        scenarioContext: stage,
        hcpRole: hcpType,
        hcpMindset: challengeEntry.hcpMindset,
        realismLevel: realism,
        diseaseState,
        specialty,
        optionalOverrides,
    });

    const interactionPressure = challengeEntry.interactionPressure ?? baseResolved.interaction_pressure;
    const behaviorArchetype = challengeEntry.behaviorArchetype ?? baseResolved.behavior_archetype;
    const accessBarrierContext = challengeEntry.accessBarrierContext ?? baseResolved.access_barrier_context;
    const repObjective = challengeEntry.repObjective ?? baseResolved.rep_objective;

    const resolvedFields: ResolvedRpsFields = {
        ...baseResolved,
        interaction_pressure: interactionPressure,
        behavior_archetype: behaviorArchetype,
        access_barrier_context: accessBarrierContext,
        rep_objective: repObjective,
        predictive_profile_seed: {
            diseaseState,
            hcpType: baseResolved.hcp_type,
            journeyStage: baseResolved.journey_stage,
            interactionPressure: interactionPressure[0] ?? "",
            influenceDriver: baseResolved.influence_driver,
            behaviorArchetype: behaviorArchetype,
        },
        resolved_input_model: {
            ...baseResolved.resolved_input_model,
            challenge,
            resolvedFields: {
                ...baseResolved.resolved_input_model.resolvedFields,
                interaction_pressure: interactionPressure,
                behavior_archetype: behaviorArchetype,
                access_barrier_context: accessBarrierContext,
                rep_objective: repObjective,
            },
        },
    };

    return {
        uiSelection: {
            hcpType: baseResolved.hcp_type,
            stage: baseResolved.journey_stage,
            challenge,
        },
        predictiveSelection: resolvedFields.predictive_profile_seed,
        resolvedFields,
        legacyAdaptivePayload: {
            disease_state: resolvedFields.disease_state,
            specialty: resolvedFields.specialty,
            hcp_type: resolvedFields.hcp_type,
            hcp_role: resolvedFields.hcp_role,
            journey_stage: resolvedFields.journey_stage,
            interaction_pressure: resolvedFields.interaction_pressure[0] ?? "",
            interaction_pressure_full: resolvedFields.interaction_pressure,
            influence_driver: resolvedFields.influence_driver,
            behavior_archetype: resolvedFields.behavior_archetype,
            access_barrier_context: resolvedFields.access_barrier_context,
            rep_objective: resolvedFields.rep_objective,
            predictive_profile_seed: resolvedFields.predictive_profile_seed,
        },
    };
}

// ── Reverse: derive simplified inputs from an existing scenario object ─────

/**
 * deriveUserFacingInputsFromScenario
 *
 * Pre-populates simplified controls when loading an existing scenario card.
 * Reads journey_stage, influence_driver, runtimeTemperature, and hcp_type
 * from the stored scenario and maps them back to simplified labels.
 */
export function deriveUserFacingInputsFromScenario(
    scenario: Record<string, unknown>,
): {
    scenarioContext: string;
    hcpRole: string;
    hcpMindset: string;
    realismLevel: number;
    diseaseState: string;
} {
    const journeyStage = String(
        scenario?.journeyStage ?? scenario?.journey_stage ?? "discovery",
    );
    const influenceDriver = String(
        scenario?.decisionOrientation ??
        scenario?.influenceDriver ??
        scenario?.influence_driver ??
        "patient_centric",
    );
    const realismLevel = Math.max(
        1,
        Math.min(
            10,
            Math.round(
                Number(
                    scenario?.runtimeTemperature ??
                    scenario?.runtime_temperature ??
                    scenario?.defaultTemperature ??
                    5,
                ),
            ),
        ),
    );
    const hcpRole = String(
        scenario?.hcpRoleType ??
        scenario?.hcp_type ??
        scenario?.hcp_role ??
        "treating_clinician",
    );
    const diseaseState = String(
        (scenario?.predictiveSeed as Record<string, unknown>)?.diseaseState ??
        scenario?.disease_state ??
        "",
    );

    // Scenario context: map journeyStage back to the simplified label value
    // (values are the same since SCENARIO_CONTEXT_OPTIONS uses journey_stage values)
    const validContextValues = new Set([
        "initial_access",
        "discovery",
        "clinical_value",
        "objection_handling",
        "adoption_implementation",
        "access_formulary",
        "commitment_close",
    ]);
    const scenarioContext = validContextValues.has(journeyStage) ? journeyStage : "discovery";

    // HCP Mindset: map influence_driver back to mindset key
    const driverToMindset: Record<string, string> = {
        patient_centric: "patient_centric",
        evidence_driven: "evidence_driven",
        risk_averse: "risk_averse",
        guideline_anchored: "guideline_anchored",
    };
    const hcpMindset = driverToMindset[influenceDriver] ?? "patient_centric";

    const normalizedHcpRole =
        hcpRole === "all" ? "treating_clinician" : hcpRole;

    return {
        scenarioContext,
        hcpRole: normalizedHcpRole,
        hcpMindset,
        realismLevel,
        diseaseState,
    };
}

export function deriveUISelectionFromBrain(
    scenario: Record<string, unknown>,
): {
    hcpType: string;
    stage: string;
    challenge: string;
} {
    const base = deriveUserFacingInputsFromScenario(scenario);
    const interactionPressure = Array.isArray(scenario?.interactionPressure)
        ? scenario.interactionPressure.map((value) => String(value || ""))
        : Array.isArray(scenario?.interaction_pressure)
            ? scenario.interaction_pressure.map((value) => String(value || ""))
            : [String(scenario?.interactionPressure || scenario?.interaction_pressure || "")].filter(Boolean);
    const behaviorArchetype = String(
        scenario?.persona ??
        scenario?.behaviorArchetype ??
        scenario?.behavior_archetype ??
        (scenario?.predictiveSeed as Record<string, unknown>)?.behaviorArchetype ??
        "",
    );
    const accessBarrierContext = String(
        scenario?.access_barrier_context ?? scenario?.accessBarrierContext ?? "",
    );
    const repObjective = String(
        scenario?.rep_objective ?? scenario?.repObjective ?? "",
    );

    let challenge = "evidence_scrutiny";
    if (interactionPressure.includes("access_barrier") || accessBarrierContext === "formulary_non_preferred") {
        challenge = "access_coverage";
    } else if (base.hcpMindset === "guideline_anchored" || behaviorArchetype === "protocol_guardian") {
        challenge = "guideline_alignment";
    } else if (base.hcpMindset === "risk_averse" || interactionPressure.includes("safety_concern")) {
        challenge = "safety_risk";
    } else if (
        interactionPressure.includes("operationally_constrained") ||
        accessBarrierContext === "staffing_limited_follow_up" ||
        behaviorArchetype === "time_constrained_community_doctor"
    ) {
        challenge = "workflow_friction";
    } else if (
        interactionPressure.includes("curious_uncertain") ||
        behaviorArchetype === "curious_uncertain_adopter" ||
        repObjective === "secure_small_next_step"
    ) {
        challenge = "cautious_commitment";
    }

    return {
        hcpType: base.hcpRole,
        stage: base.scenarioContext,
        challenge,
    };
}

// ── Mapping tables (exported for PART 16 documentation) ───────────────────

/** Scenario Context → internal field summary. */
export const SCENARIO_CONTEXT_FIELD_MAP = Object.fromEntries(
    Object.entries(SCENARIO_CONTEXT_MAP).map(([ctx, entry]) => [
        ctx,
        {
            journey_stage: entry.journey_stage,
            interaction_pressure: entry.interaction_pressure,
            behavior_archetype: entry.behavior_archetype,
            rep_objective: entry.rep_objective,
            access_barrier_context: entry.access_barrier_context,
        },
    ]),
);

/** HCP Mindset → internal field summary. */
export const HCP_MINDSET_FIELD_MAP = Object.fromEntries(
    Object.entries(HCP_MINDSET_MAP).map(([mindset, entry]) => [
        mindset,
        {
            influence_driver: entry.influence_driver,
            behavior_archetype_modifier: entry.behavior_archetype_modifier ?? null,
            credibility_drivers: entry.credibility_drivers,
            trust_breakers: entry.trust_breakers,
        },
    ]),
);

/** Realism Level → adaptive modifier summary. */
export function getRealismLevelSummary(realismLevel: number) {
    const seed = deriveAdaptiveSeed(realismLevel);
    return {
        realismLevel,
        runtime_temperature: realismLevel,
        ...seed,
    };
}
