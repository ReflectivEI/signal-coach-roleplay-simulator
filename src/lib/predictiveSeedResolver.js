import { PREDICTIVE_SELECTOR_OPTIONS } from "@/lib/predictiveBuilderModel";

const VALID = {
    diseaseState: new Set((PREDICTIVE_SELECTOR_OPTIONS.diseaseState || []).map((item) => item.value)),
    hcpType: new Set((PREDICTIVE_SELECTOR_OPTIONS.hcpType || []).map((item) => item.value)),
    journeyStage: new Set((PREDICTIVE_SELECTOR_OPTIONS.journeyStage || []).map((item) => item.value)),
    interactionPressure: new Set((PREDICTIVE_SELECTOR_OPTIONS.interactionPressure || []).map((item) => item.value)),
    influenceDriver: new Set((PREDICTIVE_SELECTOR_OPTIONS.influenceDriver || []).map((item) => item.value)),
    behaviorArchetype: new Set((PREDICTIVE_SELECTOR_OPTIONS.behaviorArchetype || []).map((item) => item.value)),
};

const PERSONA_TO_ARCHETYPE = {
    time_constrained_community_doctor: "time_constrained_community_doctor",
    skeptical_specialist: "skeptical_specialist",
    curious_uncertain_adopter: "curious_uncertain_adopter",
    cost_focused_decision_maker: "cost_focused_decision_maker",
};

const DISEASE_KEYWORDS = {
    pulmonology: ["pulmon", "respir", "copd", "asthma", "lung"],
    cardiology: ["cardio", "heart", "hf", "hfr", "hfpef", "cv", "mace"],
    oncology: ["onco", "cancer", "tumor", "biomarker", "line of therapy"],
    nephrology: ["renal", "kidney", "nephro"],
    endocrinology: ["diabetes", "endocrin", "thyroid"],
    primary_care: ["primary care", "internal medicine", "hospitalist", "community"],
};

function inferDiseaseState(scenario = {}) {
    const seedDisease = scenario?.predictiveSeed?.diseaseState;
    if (VALID.diseaseState.has(seedDisease)) return seedDisease;

    const text = `${scenario?.title || ""} ${scenario?.stakeholder || ""} ${scenario?.context || ""} ${scenario?.description || ""}`.toLowerCase();
    for (const [diseaseState, terms] of Object.entries(DISEASE_KEYWORDS)) {
        if (terms.some((term) => text.includes(term))) {
            return diseaseState;
        }
    }

    return "primary_care";
}

function normalizeFirstValid(list = [], validator, fallback) {
    for (const item of list) {
        if (validator.has(item)) return item;
    }
    return fallback;
}

function inferBehaviorArchetype(scenario = {}, hcpType = "treating_clinician") {
    const seedArchetype = scenario?.predictiveSeed?.behaviorArchetype;
    if (VALID.behaviorArchetype.has(seedArchetype)) return seedArchetype;

    const mapped = PERSONA_TO_ARCHETYPE[scenario?.persona];
    if (VALID.behaviorArchetype.has(mapped)) return mapped;

    if (hcpType === "thought_leader") return "skeptical_specialist";
    if (hcpType === "influencer") return "cost_focused_decision_maker";
    return "time_constrained_community_doctor";
}

export function buildPredictiveSeedFromScenario(scenario = {}) {
    const seed = scenario?.predictiveSeed || {};

    const hcpType = VALID.hcpType.has(seed.hcpType)
        ? seed.hcpType
        : (VALID.hcpType.has(scenario?.hcpRoleType) ? scenario.hcpRoleType : "treating_clinician");

    const journeyStage = VALID.journeyStage.has(seed.journeyStage)
        ? seed.journeyStage
        : (VALID.journeyStage.has(scenario?.journeyStage) ? scenario.journeyStage : "discovery");

    const interactionPressure = VALID.interactionPressure.has(seed.interactionPressure)
        ? seed.interactionPressure
        : normalizeFirstValid(scenario?.interactionPressure || [], VALID.interactionPressure, "curious_uncertain");

    const influenceDriver = VALID.influenceDriver.has(seed.influenceDriver)
        ? seed.influenceDriver
        : (VALID.influenceDriver.has(scenario?.decisionOrientation) ? scenario.decisionOrientation : "patient_centric");

    return {
        diseaseState: inferDiseaseState(scenario),
        hcpType,
        journeyStage,
        interactionPressure,
        influenceDriver,
        behaviorArchetype: inferBehaviorArchetype(scenario, hcpType),
    };
}
