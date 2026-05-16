const ALL_TOPIC_LANES = [
    "access_formulary",
    "prior_auth",
    "workflow_implementation",
    "clinical_value",
    "evidence_quality",
    "safety_signal",
    "guideline_alignment",
    "cost_value",
    "peer_adoption",
    "patient_identification",
    "time_pressure",
    "competitive_comparison",
    "protocol_change",
    "follow_up_reversal",
];

const TOPIC_LANE_PATTERNS = {
    access_formulary: [/\bformulary\b/i, /\bpayer\b/i, /\bcoverage\b/i, /\bnon-?preferred\b/i, /\bstep (?:edit|therapy)\b/i],
    prior_auth: [/\bprior auth(?:orization)?\b/i, /\bauthorization\b/i, /\bpa\b/i],
    workflow_implementation: [/\bworkflow\b/i, /\bstaff\b/i, /\bhandoff\b/i, /\bcallbacks?\b/i, /\boperational\b/i, /\bimplementation\b/i],
    clinical_value: [/\bclinical\b/i, /\boutcome\b/i, /\befficacy\b/i, /\bdecision\b/i],
    evidence_quality: [/\bevidence\b/i, /\btrial\b/i, /\bsubgroup\b/i, /\bdata\b/i, /\bproof point\b/i],
    safety_signal: [/\bsafety\b/i, /\badverse\b/i, /\bhepatic\b/i, /\brisk\b/i],
    guideline_alignment: [/\bguideline\b/i, /\brecommended\b/i, /\bstandard of care\b/i],
    cost_value: [/\bcost\b/i, /\bafford\b/i, /\bvalue\b/i, /\bspend\b/i, /\breadmission\b/i],
    peer_adoption: [/\bothers (?:in my area|are doing)\b/i, /\bpeer\b/i, /\bfirst (?:one|mover)\b/i, /\badoption\b/i],
    patient_identification: [
        /\bwhich patients?\b/i,
        /\bpatient type\b/i,
        /\bpatient subgroup\b/i,
        /\bsubgroup\b/i,
        /\buncontrolled patients?\b/i,
        /\bstill uncontrolled\b/i,
        /\bpatients? still (?:not controlled|falling short|missing treatment goals)\b/i,
        /\bpatients?\b.{0,80}\b(current care|goals|protocol|uncontrolled|falling short)\b/i,
        /\b(current care|goals|protocol|uncontrolled|falling short)\b.{0,80}\bpatients?\b/i,
        /\bcurrent care\b/i,
        /\btreatment goals?\b/i,
        /\bcandidate\b/i,
        /\beligib/i,
        /\bright patient\b/i,
    ],
    time_pressure: [/\bminute\b/i, /\bshort version\b/i, /\bquick\b/i, /\btime\b/i],
    competitive_comparison: [/\bcompetitor\b/i, /\bswitch\b/i, /\bcurrently using\b/i, /\bcurrent option\b/i],
    protocol_change: [/\bprotocol change\b/i, /\bchange (?:the|a|your) protocol\b/i, /\bcommittee\b/i, /\bpathway\b/i],
    follow_up_reversal: [/\brough experience\b/i, /\bfirst patient\b/i, /\breversal\b/i, /\bpaused\b/i],
};

const STAGE_ALLOWED_LANES = {
    initial_access: ["time_pressure", "patient_identification"],
    early_discovery: ["patient_identification", "clinical_value"],
    discovery: ["patient_identification", "clinical_value"],
    clinical_value: ["clinical_value", "evidence_quality", "safety_signal", "guideline_alignment", "patient_identification", "cost_value"],
    objection_handling: ["clinical_value", "evidence_quality", "safety_signal", "guideline_alignment", "cost_value", "competitive_comparison", "access_formulary", "prior_auth", "workflow_implementation"],
    adoption_implementation: ["workflow_implementation", "peer_adoption", "protocol_change", "follow_up_reversal", "patient_identification"],
    access_formulary: ["access_formulary", "prior_auth", "cost_value", "workflow_implementation", "protocol_change"],
    commitment_close: ["patient_identification", "peer_adoption", "protocol_change", "clinical_value", "evidence_quality"],
};

const BANNED_FALLBACK_PHRASES = [
    /fewer rework touchpoints/i,
    /first submission is complete/i,
    /one complete pass/i,
    /staff can move to the next office task/i,
    /callback cleanup step/i,
    /\bwhat['’]?s concretely different for me after this\b/i,
    /\bthe practical answer has to stay tied\b/i,
    /\bwhat changes in practice if this is worth continuing\b/i,
    /\bi hear that a lot\b/i,
    /\bkeep this brief\b/i,
    /\bi['’]?m not convinced yet\b/i,
];

const DISALLOWED_TERM_PATTERNS = {
    prior_auth: [/\bprior auth(?:orization)?\b/gi, /\bauthorization\b/gi, /\bpa\b/gi],
    workflow_implementation: [/\bworkflow\b/gi, /\bstaff\b/gi, /\bhandoff(?:s)?\b/gi, /\bcallback(?:s)?\b/gi],
    access_formulary: [/\bformulary\b/gi, /\bpayer\b/gi, /\bcoverage\b/gi, /\bstep therapy\b/gi],
};

/**
 * @typedef {{
 *   journey_stage?: string,
 *   allowed_topic_lanes?: string[],
 *   disallowed_topic_lanes?: string[],
 *   stage_behavior_rules?: string[],
 *   concern_family?: string
 * }} ScenarioRoutingLike
 */

function normalizeText(value = "") {
    return String(value || "").replace(/\s+/g, " ").trim();
}

function collapsePunctuation(value = "") {
    return normalizeText(String(value || "").replace(/\s+([,.!?])/g, "$1"));
}

export function detectTopicLanes(text = "") {
    const value = normalizeText(text);
    if (!value) return [];

    return ALL_TOPIC_LANES.filter((lane) => {
        const patterns = TOPIC_LANE_PATTERNS[lane] || [];
        return patterns.some((pattern) => pattern.test(value));
    });
}

function pickConcernFamily(scenario = {}) {
    const text = [
        scenario?.title,
        scenario?.objective,
        scenario?.description,
        scenario?.context,
        scenario?.journeyStage,
        ...(scenario?.interactionPressure || []),
    ].filter(Boolean).join(" ").toLowerCase();

    if (/formulary|prior auth|coverage|payer|access/.test(text)) return "access";
    if (/workflow|staff|handoff|callback|monitoring|implementation/.test(text)) return "workflow";
    if (/hepatic|safety|adverse|risk/.test(text)) return "safety";
    if (/guideline/.test(text)) return "guideline";
    if (/cost|value|spend|readmission/.test(text)) return "cost";
    if (/peer|first one|first mover|others in my area|adoption/.test(text)) return "adoption_caution";
    if (/screen|candidate|patient type|eligib|right patient/.test(text)) return "screening";
    if (/patient population|subgroup|fit|real-?world/.test(text)) return "patient_fit";
    if (/minute|quick|short version|time/.test(text)) return "time";
    if (/competitor|switch|current therapy/.test(text)) return "competitive";
    if (/evidence|trial|data|proof/.test(text)) return "evidence";
    return "general";
}

function concernFamilyToLanes(concernFamily = "general") {
    switch (concernFamily) {
        case "access":
            return ["access_formulary", "prior_auth", "cost_value"];
        case "workflow":
            return ["workflow_implementation", "protocol_change"];
        case "evidence":
            return ["clinical_value", "evidence_quality", "patient_identification"];
        case "safety":
            return ["safety_signal", "evidence_quality", "clinical_value"];
        case "guideline":
            return ["guideline_alignment", "evidence_quality", "clinical_value"];
        case "cost":
            return ["cost_value", "clinical_value"];
        case "adoption_caution":
            return ["peer_adoption", "protocol_change", "patient_identification"];
        case "screening":
            return ["patient_identification"];
        case "patient_fit":
            return ["patient_identification", "clinical_value", "evidence_quality"];
        case "time":
            return ["time_pressure", "patient_identification"];
        case "competitive":
            return ["competitive_comparison", "clinical_value", "evidence_quality"];
        default:
            return ["clinical_value", "patient_identification"];
    }
}

function deriveStageRules(journeyStage = "") {
    const stage = String(journeyStage || "").toLowerCase();
    switch (stage) {
        case "initial_access":
            return ["test_relevance_before_content", "no_deep_operational_mechanics_without_earned_context"];
        case "early_discovery":
        case "discovery":
            return ["clarify_patient_type_and_decision_criteria", "avoid_late_stage_commitment_language"];
        case "clinical_value":
            return ["evidence_patient_guideline_alignment_required", "avoid_unprompted_workflow_drilldown"];
        case "access_formulary":
            return ["access_process_specificity_required", "no_untethered_clinical_debate"];
        case "objection_handling":
            return ["stay_on_stated_objection", "no_unrelated_lane_drift"];
        case "adoption_implementation":
            return ["implementation_owner_and_step_clarity", "low_risk_step_focus"];
        case "commitment_close":
            return ["smallest_next_step_when_earned", "no_reset_to_broad_discovery"];
        default:
            return ["maintain_lane_consistency"];
    }
}

function derivePressureRules(interactionPressure = []) {
    const values = Array.isArray(interactionPressure) ? interactionPressure : [];
    return values.map((pressure) => {
        switch (pressure) {
            case "time_constrained":
                return "short_direct_single_question_max";
            case "operationally_constrained":
                return "workflow_language_only_when_lane_allowed";
            case "skeptical_resistant":
                return "challenge_assumptions_keep_guarded";
            case "safety_concern":
                return "risk_signal_should_remain_foreground";
            default:
                return "pressure_consistent_expression";
        }
    });
}

export function buildScenarioRouting(scenario = {}) {
    const journeyStage = String(scenario?.journeyStage || "").toLowerCase();
    const concernFamily = pickConcernFamily(scenario);
    const stageAllowed = STAGE_ALLOWED_LANES[journeyStage] || ["clinical_value", "patient_identification"];
    const familyAllowed = concernFamilyToLanes(concernFamily);
    const pressures = Array.isArray(scenario?.interactionPressure) ? scenario.interactionPressure : [];

    let mergedAllowed = [...new Set([...stageAllowed, ...familyAllowed])];
    if (journeyStage === "clinical_value") {
        if (pressures.includes("access_barrier")) {
            mergedAllowed.push("access_formulary", "prior_auth");
        }
        if (pressures.includes("operationally_constrained")) {
            mergedAllowed.push("workflow_implementation");
        }
        mergedAllowed = [...new Set(mergedAllowed)];
    }
    if (journeyStage === "initial_access") {
        const explicitWorkflowLane = pressures.includes("operationally_constrained");
        mergedAllowed = [...stageAllowed];
        if (explicitWorkflowLane) mergedAllowed.push("workflow_implementation");
        mergedAllowed = [...new Set(mergedAllowed)];
    }
    const disallowed = ALL_TOPIC_LANES.filter((lane) => !mergedAllowed.includes(lane));

    const requiredSignalMarkers = mergedAllowed.slice(0, 4);
    const prohibitedSignalMarkers = disallowed.slice(0, 8);

    return {
        scenario_id: scenario?.id || scenario?.title || "unknown",
        journey_stage: journeyStage || "unknown",
        interaction_pressure: Array.isArray(scenario?.interactionPressure) ? scenario.interactionPressure : [],
        specialty_hcp_type: scenario?.hcpRoleType || scenario?.stakeholder || "unknown",
        disease_state: scenario?.predictiveSeed?.diseaseState || "unknown",
        behavior_archetype: scenario?.persona || scenario?.predictiveSeed?.behaviorArchetype || "unknown",
        concern_family: concernFamily,
        active_barrier_type: concernFamily,
        allowed_topic_lanes: mergedAllowed,
        disallowed_topic_lanes: disallowed,
        required_signal_markers: requiredSignalMarkers,
        prohibited_signal_markers: prohibitedSignalMarkers,
        pressure_expression_rules: derivePressureRules(scenario?.interactionPressure),
        stage_behavior_rules: deriveStageRules(journeyStage),
    };
}

function buildStageSafeFallback({ scenarioRouting, repMessage = "", hcpState = "" }) {
    const stage = scenarioRouting?.journey_stage;
    const state = String(hcpState || "").toLowerCase();
    const pressured = scenarioRouting?.interaction_pressure?.includes("time_constrained") || state === "time_pressure";
    const repLanes = detectTopicLanes(repMessage);
    const repFocus = repLanes[0] || "general";

    if (stage === "initial_access") {
        return pressured
            ? "Give me the short reason this matters today."
            : "Why is this relevant to a patient I would act on today?";
    }
    if (stage === "clinical_value") {
        return repFocus === "evidence_quality"
            ? "Show me the patient-level evidence that changes a treatment decision."
            : "Tie this to the patient decision, not a broader operational claim.";
    }
    if (stage === "access_formulary") {
        return "Name the approval step that changes first.";
    }
    if (stage === "objection_handling") {
        return "Stay on the blocker and answer that directly.";
    }
    if (stage === "adoption_implementation") {
        return "Tell me the first task, who owns it, and what work comes off the team.";
    }
    if (stage === "commitment_close") {
        return "Keep it to one low-risk next step I can actually take.";
    }

    if (repFocus === "evidence_quality" || /\bproof|data|evidence|guideline\b/i.test(repMessage)) {
        return "What evidence point changes a real decision here?";
    }
    return "Keep this tied to one practical decision.";
}

function containsBannedFallbackPhrase(text = "") {
    return BANNED_FALLBACK_PHRASES.some((pattern) => pattern.test(text));
}

function getLaneTermReplacement(lane = "", stage = "") {
    const journeyStage = String(stage || "").toLowerCase();
    if (journeyStage === "initial_access") return "relevance";
    if (journeyStage === "clinical_value") return "patient-level evidence";
    if (journeyStage === "commitment_close") return "next practical step";
    if (lane === "prior_auth" || lane === "access_formulary") return "access step";
    if (lane === "workflow_implementation") return "care step";
    return "practical decision point";
}

function rewriteDisallowedTerms({
    text = "",
    disallowedLanes = [],
    scenarioRouting = {},
}) {
    let rewritten = String(text || "");
    const detectedTerms = [];
    const stage = scenarioRouting?.journey_stage || "";

    disallowedLanes.forEach((lane) => {
        const patterns = DISALLOWED_TERM_PATTERNS[lane] || [];
        const replacement = getLaneTermReplacement(lane, stage);
        patterns.forEach((pattern) => {
            if (pattern.test(rewritten)) {
                const matches = rewritten.match(pattern) || [];
                matches.forEach((term) => detectedTerms.push(term.toLowerCase()));
                rewritten = rewritten.replace(pattern, replacement);
            }
        });
    });

    return {
        text: collapsePunctuation(rewritten),
        detected_terms: [...new Set(detectedTerms)],
    };
}

function stripBannedFallbackPhrases(text = "") {
    let cleaned = String(text || "");
    BANNED_FALLBACK_PHRASES.forEach((pattern) => {
        cleaned = cleaned.replace(pattern, "");
    });
    cleaned = cleaned
        .replace(/\s+,/g, ",")
        .replace(/\s+\./g, ".")
        .replace(/\s+\?/g, "?")
        .replace(/\s+/g, " ")
        .trim();
    return cleaned;
}

function buildValidatorRedirect(scenarioRouting = {}) {
    const stage = String(scenarioRouting?.journey_stage || "general").toLowerCase();
    const allowed = Array.isArray(scenarioRouting?.allowed_topic_lanes) ? scenarioRouting.allowed_topic_lanes : [];
    const laneHint = allowed[0] || "current scenario lane";
    return `Regenerate from the predictive HCP brain on the ${laneHint} lane for ${stage}.`;
}

export function enforceScenarioTopicLane({
    draft_hcp_response = "",
    scenario_routing = {},
    rep_message = "",
    hcp_state = "",
}) {
    const text = normalizeText(draft_hcp_response);
    const lanes = detectTopicLanes(text);
    const disallowed = lanes.filter((lane) => (scenario_routing?.disallowed_topic_lanes || []).includes(lane));

    if (!text) {
        const repaired = buildStageSafeFallback({ scenarioRouting: scenario_routing, repMessage: rep_message, hcpState: hcp_state });
        return {
            text: repaired,
            changed: true,
            matched_topic_lanes: detectTopicLanes(repaired),
            prohibited_topic_detected: [],
            detected_terms: [],
            violation_detected: true,
            action: "fallback_only",
            reason: "empty_response_repaired",
            requires_regeneration: true,
            validator_redirect: buildValidatorRedirect(scenario_routing),
        };
    }

    const rewritten = rewriteDisallowedTerms({
        text,
        disallowedLanes: disallowed,
        scenarioRouting: scenario_routing,
    });
    const cleanedText = scrubStaleFallbackPhrases(rewritten.text || text, scenario_routing);
    const rewrittenLanes = detectTopicLanes(cleanedText);
    const remainingDisallowed = rewrittenLanes.filter((lane) => (scenario_routing?.disallowed_topic_lanes || []).includes(lane));
    const bannedFallbackDetected = containsBannedFallbackPhrase(text);
    const requiresRegeneration = remainingDisallowed.length > 0 || bannedFallbackDetected;

    return {
        text: cleanedText,
        changed: cleanedText !== text,
        matched_topic_lanes: rewrittenLanes,
        prohibited_topic_detected: disallowed,
        detected_terms: rewritten.detected_terms,
        violation_detected: disallowed.length > 0 || bannedFallbackDetected,
        action: requiresRegeneration ? "validator_redirect" : (cleanedText !== text ? "rewritten" : "none"),
        reason: bannedFallbackDetected
            ? "banned_fallback_phrase"
            : disallowed.length > 0
                ? remainingDisallowed.length > 0 ? "disallowed_lane_requires_regeneration" : "disallowed_lane_rewritten"
                : "none",
        requires_regeneration: requiresRegeneration,
        validator_redirect: requiresRegeneration ? buildValidatorRedirect(scenario_routing) : "",
    };
}

export function enforceJourneyStageFit({
    draft_hcp_response = "",
    journey_stage = "",
    scenario_routing = {},
    hcp_state = "",
}) {
    const stage = String(journey_stage || scenario_routing?.journey_stage || "").toLowerCase();
    const text = normalizeText(draft_hcp_response);

    if (!text) {
        const repaired = buildStageSafeFallback({ scenarioRouting: scenario_routing, hcpState: hcp_state });
        return {
            text: repaired,
            changed: true,
            expected_stage_behavior: deriveStageRules(stage),
            actual_stage_behavior: ["empty_response"],
            requires_regeneration: true,
            validator_redirect: buildValidatorRedirect(scenario_routing),
        };
    }

    const lanes = detectTopicLanes(text);
    const allowed = scenario_routing?.allowed_topic_lanes || [];
    const hasAllowedLane = lanes.some((lane) => allowed.includes(lane));
    const hasDisallowedLane = lanes.some((lane) => (scenario_routing?.disallowed_topic_lanes || []).includes(lane));

    return {
        text,
        changed: false,
        expected_stage_behavior: deriveStageRules(stage),
        actual_stage_behavior: lanes.length ? lanes : ["general"],
        requires_regeneration: !hasAllowedLane || hasDisallowedLane,
        validator_redirect: !hasAllowedLane || hasDisallowedLane ? buildValidatorRedirect(scenario_routing) : "",
    };
}

export function enforcePressureFit({
    draft_hcp_response = "",
    interaction_pressure = [],
    scenario_routing = {},
}) {
    let text = normalizeText(draft_hcp_response);
    const pressures = Array.isArray(interaction_pressure) ? interaction_pressure : [];
    let changed = false;
    let requiresRegeneration = false;

    if (!text) return { text, changed: false, requires_regeneration: false, validator_redirect: "" };

    if (pressures.includes("time_constrained")) {
        const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
        if (sentences.length > 2) {
            text = `${sentences[0]} ${sentences[1]}`.trim();
            changed = true;
        }
        const questionCount = (text.match(/\?/g) || []).length;
        if (questionCount > 1) {
            const firstQuestionIndex = text.indexOf("?");
            if (firstQuestionIndex > -1) {
                text = text.slice(0, firstQuestionIndex + 1);
                changed = true;
            }
        }
    }

    if (!scenario_routing?.allowed_topic_lanes?.includes("workflow_implementation") && /\bstaff|workflow|callback|handoff\b/i.test(text)) {
        requiresRegeneration = true;
    }

    const cleanedText = scrubStaleFallbackPhrases(text, scenario_routing);
    if (cleanedText !== text) {
        text = cleanedText;
        changed = true;
    }

    return {
        text: normalizeText(text),
        changed,
        requires_regeneration: requiresRegeneration || containsBannedFallbackPhrase(draft_hcp_response),
        validator_redirect: requiresRegeneration || containsBannedFallbackPhrase(draft_hcp_response)
            ? buildValidatorRedirect(scenario_routing)
            : "",
    };
}

export function addPersonaSpecificAnchor({
    draft_hcp_response = "",
    scenario_routing = {},
}) {
    let text = normalizeText(draft_hcp_response);
    if (!text) return { text, changed: false };

    const hasAnchor = /\bpatients?|clinic|practice|decision|guideline|evidence|safety|coverage|payer|workflow|staff\b/i.test(text);
    if (hasAnchor) return { text, changed: false };

    const family = scenario_routing?.concern_family;
    let anchor = "in my practice";
    if (family === "evidence" || family === "guideline" || family === "safety") anchor = "for the patients I treat";
    if (family === "access") anchor = "for coverage decisions";
    if (family === "workflow") anchor = "for clinic workflow";
    if (family === "adoption_caution") anchor = "before my group adopts this";

    text = `${text.replace(/[.?!]+$/, "")}, ${anchor}.`;
    return { text, changed: true };
}

export function summarizeRoutingAlignment({ text = "", scenarioRouting = {} }) {
    const matched = detectTopicLanes(text);
    const prohibited = matched.filter((lane) => (scenarioRouting?.disallowed_topic_lanes || []).includes(lane));
    return {
        matched_topic_lane: matched[0] || "general",
        matched_topic_lanes: matched,
        prohibited_topic_detected: prohibited,
        expected_topic_lanes: scenarioRouting?.allowed_topic_lanes || [],
        expected_stage_behavior: scenarioRouting?.stage_behavior_rules || [],
        actual_stage_behavior: matched.length ? matched : ["general"],
        recommended_fix: prohibited.length ? "Regenerate using allowed topic lanes for this scenario stage and pressure." : "No routing fix required.",
    };
}

export function scrubStaleFallbackPhrases(text = "", scenarioRouting = {}) {
    const input = normalizeText(text);
    if (!input) return input;

    const stripped = stripBannedFallbackPhrases(input);
    if (stripped) return stripped;

    return buildStageSafeFallback({ scenarioRouting, repMessage: "", hcpState: "" });
}
