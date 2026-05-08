const SECTION_ALIASES = {
  openingScene: ["Initial Greeting from the HCP", "Initial Greeting", "Opening Scene", "Scene"],
  hcp: ["HCP Background and Context", "HCP Background", "HCP", "Stakeholder", "HCP Persona", "Context"],
  objective: ["Success Criteria", "Objective", "Best Approach and Expected Outcome", "Expected Outcome"],
  tacticalFocus: ["Potential Objections or Resistance Points", "Objections", "Key Challenges", "Challenges"],
};

const DEFAULT_ALLOWED_METRICS = Object.freeze([
  "signal_awareness",
  "signal_interpretation",
  "value_connection",
  "customer_engagement",
  "objection_navigation",
  "conversation_management",
  "adaptive_response",
  "commitment_generation",
]);

const DEFAULT_FEEDBACK_EVIDENCE = Object.freeze([
  "explicit_hcp_statement",
  "visible_hcp_cue",
  "rep_language_pattern",
  "missing_expected_behavior",
]);

const DEFAULT_PROHIBITED_FEEDBACK_INFERENCE = Object.freeze([
  "inferred_intent",
  "inferred_emotion_without_signal",
  "personality_labels",
]);

function stripMarkdown(value = "") {
  return String(value)
    .replace(/\r\n/g, "\n")
    .replace(/```[\w-]*\n?|\n?```/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^[\t ]*[-*]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeRegex(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSection(text, labels) {
  const source = stripMarkdown(text);
  if (!source) return "";

  for (const label of labels) {
    const laterLabels = Object.values(SECTION_ALIASES)
      .flat()
      .filter((candidate) => candidate !== label)
      .map((candidate) => escapeRegex(candidate))
      .join("|");

    const pattern = new RegExp(
      `(?:^|\\n)${escapeRegex(label)}:\\s*([\\s\\S]*?)(?=\\n(?:${laterLabels}):|$)`,
      "i"
    );
    const match = source.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return "";
}

function splitIntoBullets(value, maxItems = 3) {
  const normalized = stripMarkdown(value)
    .replace(/\n+/g, "\n")
    .trim();

  if (!normalized) return [];

  const bulletCandidates = normalized
    .split(/\n|\u2022|\\u2022|;|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((item) => item.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);

  const unique = [];
  for (const item of bulletCandidates) {
    const cleaned = truncateLine(item);
    if (!cleaned) continue;
    if (!unique.some((existing) => existing.toLowerCase() === cleaned.toLowerCase())) {
      unique.push(cleaned);
    }
    if (unique.length >= maxItems) break;
  }

  return unique;
}

function truncateLine(value, maxWords = 18) {
  const cleaned = stripMarkdown(value)
    .replace(/\s+/g, " ")
    .replace(/^[:\-\u2013]+\s*/, "")
    .trim();

  if (!cleaned) return "";

  const words = cleaned.split(" ");
  if (words.length <= maxWords) return cleaned;
  return `${words.slice(0, maxWords).join(" ")}…`;
}

function buildTags({ specialty, disease_state, hcp_category, influence_driver }) {
  return [specialty, disease_state, hcp_category, influence_driver]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 4);
}

function mapCategory(diseaseState = "") {
  const value = String(diseaseState || "").trim();
  if (!value) return "Rare Disease";
  if (/prep|hiv/i.test(value)) return "HIV / PrEP";
  if (/vaccine|immunization/i.test(value)) return "Vaccines";
  return value;
}

export function normalizeGeneratedScenario({
  title,
  content,
  description,
  specialty,
  disease_state,
  hcp_category,
  influence_driver,
  difficulty,
  focus_capabilities,
}) {
  const sourceText = [content, description].filter(Boolean).join("\n\n");
  const openingScene = truncateLine(extractSection(sourceText, SECTION_ALIASES.openingScene), 28);
  const hcpSection = extractSection(sourceText, SECTION_ALIASES.hcp);
  const objectiveSection = extractSection(sourceText, SECTION_ALIASES.objective);
  const tacticalSection = extractSection(sourceText, SECTION_ALIASES.tacticalFocus);

  const objective = splitIntoBullets(objectiveSection, 3);
  const tacticalFocus = splitIntoBullets(tacticalSection, 3);
  const hcpSummary = truncateLine(hcpSection || description || content, 24);
  const descriptionSummary = truncateLine(
    objective[0] || tacticalFocus[0] || hcpSummary || "Scenario generated in Scenario Builder.",
    18
  );

  return {
    title: stripMarkdown(title) || "Generated Scenario",
    tags: buildTags({ specialty, disease_state, hcp_category, influence_driver }),
    openingScene: openingScene || "Preview the HCP’s setting and opening beat before starting.",
    hcp: hcpSummary || "Profile details are not available for this HCP.",
    objective: objective.length > 0 ? objective : ["Guide the discussion toward a clear next step."],
    tacticalFocus: tacticalFocus.length > 0 ? tacticalFocus : ["Surface resistance early and respond with relevant value."],
    difficulty: difficulty || "intermediate",
    description: descriptionSummary,
    specialty,
    disease_state,
    hcp_category,
    influence_driver,
    focus_capabilities: Array.isArray(focus_capabilities) ? focus_capabilities : [],
    sourceText: stripMarkdown(sourceText),
  };
}

export function buildSimulatorScenarioFromNormalized(normalized) {
  const scenarioId = `builder_${Date.now()}`;
  return {
    id: scenarioId,
    title: normalized.title,
    description: normalized.description,
    category: mapCategory(normalized.disease_state),
    specialty: normalized.specialty,
    hcp_category: normalized.hcp_category,
    influence_driver: normalized.influence_driver,
    stakeholder: normalized.hcp,
    difficulty: normalized.difficulty,
    objective: normalized.objective,
    challenges: normalized.tacticalFocus,
    openingScene: normalized.openingScene,
    opening_scene: normalized.openingScene,
    hcp: normalized.hcp,
    focus_capabilities: normalized.focus_capabilities,
    context: normalized.hcp,
    tags: normalized.tags,
    state: "Ready for Simulation",
    source: "scenario-builder",
    normalized: true,
  };
}

export function getScenarioStatusLabel(scenario) {
  return scenario?.state || "Draft";
}

function normalizeList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeString(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function normalizeScenarioSection(scenario = {}, ...keys) {
  for (const key of keys) {
    const value = scenario?.[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
  }
  return {};
}

function normalizeCueSet(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry?.cue || entry?.label || "").trim()))
    .filter(Boolean);
}

function normalizeCalibrationToken(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function deriveRuntimeBehaviorTags({ scenario = {}, canonicalHcpProfile = {}, canonicalSceneSetup = {}, canonicalStateModel = {} } = {}) {
  const sourceText = [
    scenario?.title,
    scenario?.description,
    scenario?.context,
    scenario?.openingScene,
    scenario?.opening_scene,
    scenario?.hcpMood,
    scenario?.hcp_category,
    scenario?.influence_driver,
    scenario?.difficulty,
    ...(Array.isArray(scenario?.challenges) ? scenario.challenges : []),
    canonicalHcpProfile?.baselineCommunicationStyle,
    canonicalHcpProfile?.baselineOpennessResistance,
    canonicalHcpProfile?.careSetting,
    canonicalSceneSetup?.timePressure,
    canonicalSceneSetup?.currentClinicalOperationalContext,
    canonicalSceneSetup?.openingEnvironment,
    canonicalStateModel?.startingState,
  ].filter(Boolean).join(" ").toLowerCase();

  const explicitTimePressure = normalizeCalibrationToken(canonicalSceneSetup?.timePressure || scenario?.timePressure);
  const timePressure = explicitTimePressure
    || (/\b(no time|tight on time|few minutes|between patients|full agenda|time-pressed|time pressured|rushed|busy|slammed|hectic|running behind|short-staffed|staffing|overwhelmed)\b/.test(sourceText)
      ? "high"
      : /\b(practical|workflow|implementation|clinic schedule|agenda|committee|between visits)\b/.test(sourceText)
        ? "medium"
        : "low");

  const explicitOpenness = normalizeCalibrationToken(
    canonicalHcpProfile?.baselineOpennessResistance || canonicalHcpProfile?.baselineState || scenario?.baselineOpennessResistance
  );
  const engagementLevel = explicitOpenness
    || (/\b(resistant|skeptical|skeptic|unconvinced|pushback|doubt|frustrated|overwhelmed|blocked|burden)\b/.test(sourceText)
      ? "guarded"
      : /\b(eager|curious|open|receptive|collaborative|glad|happy to talk|interested)\b/.test(sourceText)
        ? "engaged"
        : "neutral");

  const orientation = /\b(screen|screening|candidate|candidacy|eligib|patient selection|triage)\b/.test(sourceText)
    ? "patient_selection"
    : /\b(evidence|data|trial|endpoint|committee|formulary|pathway|analytical|cost-conscious|kol)\b/.test(sourceText)
      ? "analytical"
      : /\b(workflow|operational|implementation|staff|staffing|prior auth|access|paperwork|burden|throughput|monitoring|follow-up|refill)\b/.test(sourceText)
        ? "operational"
        : "balanced";

  const startingState = normalizeCalibrationToken(canonicalStateModel?.startingState || scenario?.startingState || scenario?.openingState)
    || (timePressure === "high"
      ? "time-pressured"
      : /\b(resistant|skeptical|skeptic|unconvinced|pushback|doubt)\b/.test(sourceText)
        ? "resistant"
        : engagementLevel === "engaged" || /\b(eager|curious|open|receptive|collaborative)\b/.test(sourceText)
          ? "engaged"
          : "neutral");

  const communicationPace = timePressure === "high"
    ? "curt"
    : timePressure === "medium" || orientation === "operational"
      ? "concise"
      : engagementLevel === "engaged"
        ? "conversational"
        : "balanced";

  const dialogueLength = communicationPace === "curt" ? "short" : communicationPace === "conversational" ? "medium" : "concise";
  const tonePressure = timePressure === "high" || engagementLevel === "guarded" ? "elevated" : engagementLevel === "engaged" ? "low" : "moderate";

  return {
    engagementLevel,
    timePressure,
    startingState,
    communicationPace,
    dialogueLength,
    tonePressure,
    orientation,
    calibrationSource: "canonical_or_migrated_scenario_fields",
  };
}

function normalizeMetricApplicability(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  return DEFAULT_ALLOWED_METRICS.reduce((acc, metric) => {
    const rawStatus = String(source[metric] || "always_applicable").toLowerCase();
    const status = rawStatus === "active"
      ? "always_applicable"
      : rawStatus === "suppressed"
        ? "not_applicable"
        : rawStatus;
    acc[metric] = status;
    return acc;
  }, {});
}

export function normalizeScenarioRuntimeContract(scenario = {}) {
  const canonicalIdentity = normalizeScenarioSection(scenario, "scenarioIdentity", "identity");
  const canonicalTrainingIntent = normalizeScenarioSection(scenario, "trainingIntent");
  const canonicalHcpProfile = normalizeScenarioSection(scenario, "hcpProfile");
  const canonicalSceneSetup = normalizeScenarioSection(scenario, "sceneSetup");
  const canonicalStateModel = normalizeScenarioSection(scenario, "hcpStateModel", "stateModel");
  const canonicalFeedbackContract = normalizeScenarioSection(scenario, "feedbackContract");
  const canonicalMetricApplicability = canonicalTrainingIntent?.metricApplicability
    || scenario?.metricApplicabilityMap
    || scenario?.metricApplicability
    || {};

  const identity = {
    scenarioId: normalizeString(
      canonicalIdentity?.scenarioId || scenario?.scenarioId || scenario?.scenario_id || scenario?.id,
      "runtime_scenario"
    ),
    title: normalizeString(canonicalIdentity?.title || scenario?.title, "Role Play Scenario"),
    therapeuticArea: normalizeString(canonicalIdentity?.therapeuticArea || scenario?.therapeuticArea || scenario?.category),
    topic: normalizeString(canonicalIdentity?.topic || scenario?.topic || scenario?.description),
    difficulty: normalizeString(canonicalIdentity?.difficulty || scenario?.difficulty, "intermediate"),
    version: normalizeString(canonicalIdentity?.version || scenario?.version, "1.0.0"),
    status: normalizeString(canonicalIdentity?.status || scenario?.status || scenario?.state, "active"),
  };

  const trainingIntent = {
    primaryCapabilityFocus: normalizeList(
      canonicalTrainingIntent?.primaryCapabilityFocus || canonicalTrainingIntent?.primaryCapabilities || scenario?.focus_capabilities
    ),
    secondaryCapabilityFocus: normalizeList(
      canonicalTrainingIntent?.secondaryCapabilityFocus || canonicalTrainingIntent?.secondaryCapabilities
    ),
    allowedEvaluatedMetrics: normalizeList(
      canonicalTrainingIntent?.allowedEvaluatedMetrics || scenario?.allowedEvaluatedMetrics
    ).length > 0
      ? normalizeList(canonicalTrainingIntent?.allowedEvaluatedMetrics || scenario?.allowedEvaluatedMetrics)
      : [...DEFAULT_ALLOWED_METRICS],
    excludedMetrics: normalizeList(canonicalTrainingIntent?.excludedMetrics),
    rubricNotes: normalizeString(canonicalTrainingIntent?.rubricNotes),
  };

  const runtimeBehaviorTags = deriveRuntimeBehaviorTags({
    scenario,
    canonicalHcpProfile,
    canonicalSceneSetup,
    canonicalStateModel,
  });

  const hcpProfile = {
    name: normalizeString(canonicalHcpProfile?.name || scenario?.hcpName),
    role: normalizeString(canonicalHcpProfile?.role || scenario?.stakeholder, "HCP"),
    specialty: normalizeString(canonicalHcpProfile?.specialty || scenario?.specialty, "general"),
    careSetting: normalizeString(
      canonicalHcpProfile?.careSetting || canonicalHcpProfile?.setting || scenario?.context || scenario?.description,
      "clinical setting"
    ),
    baselineCommunicationStyle: normalizeString(
      canonicalHcpProfile?.baselineCommunicationStyle
        || canonicalHcpProfile?.communicationStyle
        || scenario?.hcpMood
        || `${runtimeBehaviorTags.communicationPace} ${runtimeBehaviorTags.orientation}`
    ),
    baselineOpennessResistance: normalizeString(
      canonicalHcpProfile?.baselineOpennessResistance
        || canonicalHcpProfile?.baselineState
        || scenario?.baselineOpennessResistance
        || runtimeBehaviorTags.engagementLevel
    ),
    knownConstraints: normalizeList(canonicalHcpProfile?.knownConstraints || scenario?.knownConstraints || scenario?.challenges),
  };

  const explicitOpeningCueSet = normalizeCueSet(canonicalSceneSetup?.openingCueSet || scenario?.openingCueSet);
  const inferredOpeningCue = normalizeString(
    canonicalSceneSetup?.openingEnvironment
      || scenario?.openingEnvironment
      || scenario?.opening_scene
      || scenario?.openingScene
  );

  const sceneSetup = {
    openingEnvironment: normalizeString(canonicalSceneSetup?.openingEnvironment || scenario?.openingEnvironment),
    timePressure: normalizeString(canonicalSceneSetup?.timePressure || scenario?.timePressure || runtimeBehaviorTags.timePressure),
    currentClinicalOperationalContext: normalizeString(
      canonicalSceneSetup?.currentClinicalOperationalContext || canonicalSceneSetup?.currentContext || scenario?.context || scenario?.description
    ),
    currentContext: normalizeString(
      canonicalSceneSetup?.currentClinicalOperationalContext || canonicalSceneSetup?.currentContext || scenario?.context || scenario?.description
    ),
    visitObjective: normalizeString(
      canonicalSceneSetup?.visitObjective || scenario?.visitObjective || scenario?.objective?.[0] || scenario?.objective
    ),
    whatRepKnowsAtStart: normalizeList(canonicalSceneSetup?.whatRepKnowsAtStart || scenario?.whatRepKnowsAtStart),
    whatRepDoesNotKnowAtStart: normalizeList(canonicalSceneSetup?.whatRepDoesNotKnowAtStart || scenario?.whatRepDoesNotKnowAtStart),
    openingLine: normalizeString(canonicalSceneSetup?.openingLine || scenario?.opening_scene || scenario?.openingScene),
    openingCueSet: explicitOpeningCueSet.length > 0
      ? explicitOpeningCueSet
      : inferredOpeningCue
        ? [inferredOpeningCue]
        : [],
    enforcementCriteria: canonicalSceneSetup?.enforcementCriteria || scenario?.enforcementCriteria || {},
  };

  const hcpStateModel = {
    startingState: normalizeString(
      canonicalStateModel?.startingState
        || canonicalSceneSetup?.openingState
        || scenario?.startingState
        || scenario?.openingState
        || runtimeBehaviorTags.startingState,
      "neutral"
    ),
    allowedTransitions: canonicalStateModel?.allowedTransitions && typeof canonicalStateModel.allowedTransitions === "object"
      ? canonicalStateModel.allowedTransitions
      : scenario?.allowedTransitions && typeof scenario.allowedTransitions === "object"
        ? scenario.allowedTransitions
        : {},
    transitionTriggers: canonicalStateModel?.transitionTriggers && typeof canonicalStateModel.transitionTriggers === "object"
      ? canonicalStateModel.transitionTriggers
      : {},
    prohibitedTransitions: Array.isArray(canonicalStateModel?.prohibitedTransitions)
      ? canonicalStateModel.prohibitedTransitions
      : Array.isArray(scenario?.prohibitedTransitions)
        ? scenario.prohibitedTransitions
        : [],
  };

  const deterministicCueLibrary = Array.isArray(scenario?.deterministicCueLibrary)
    ? scenario.deterministicCueLibrary
    : Array.isArray(scenario?.cueLibrary)
      ? scenario.cueLibrary
      : [];

  const dialogueResponseRules = scenario?.dialogueResponseRules && typeof scenario.dialogueResponseRules === "object"
    ? scenario.dialogueResponseRules
    : {};

  const metricEvidenceMap = scenario?.metricEvidenceMap && typeof scenario.metricEvidenceMap === "object"
    ? scenario.metricEvidenceMap
    : {};

  const metricApplicabilityMap = normalizeMetricApplicability(canonicalMetricApplicability);

  const canReference = normalizeList(
    canonicalFeedbackContract?.whatFeedbackCanReference || canonicalFeedbackContract?.allowedReferences
  );
  const cannotInfer = normalizeList(
    canonicalFeedbackContract?.whatFeedbackCannotInfer || canonicalFeedbackContract?.prohibitedReferences
  );
  const feedbackContract = {
    whatFeedbackCanReference: canReference.length > 0 ? canReference : [...DEFAULT_FEEDBACK_EVIDENCE],
    whatFeedbackCannotInfer: cannotInfer.length > 0 ? cannotInfer : [...DEFAULT_PROHIBITED_FEEDBACK_INFERENCE],
    requiredEvidenceLanguage: normalizeList(canonicalFeedbackContract?.requiredEvidenceLanguage),
    prohibitedLanguage: normalizeList(canonicalFeedbackContract?.prohibitedLanguage),
  };

  const contractProvenance = {
    canonicalIdentityUsed: Boolean(canonicalIdentity?.scenarioId || canonicalIdentity?.title),
    canonicalTrainingIntentUsed: Boolean(
      canonicalTrainingIntent?.primaryCapabilityFocus || canonicalTrainingIntent?.primaryCapabilities || canonicalTrainingIntent?.metricApplicability
    ),
    canonicalHcpProfileUsed: Boolean(
      canonicalHcpProfile?.role || canonicalHcpProfile?.careSetting || canonicalHcpProfile?.baselineCommunicationStyle
    ),
    canonicalSceneSetupUsed: Boolean(
      canonicalSceneSetup?.openingLine
      || canonicalSceneSetup?.openingCueSet
      || canonicalSceneSetup?.currentClinicalOperationalContext
      || canonicalSceneSetup?.timePressure
    ),
    canonicalStateModelUsed: Boolean(canonicalStateModel?.startingState || canonicalStateModel?.allowedTransitions),
  };

  const contractCompleteness = {
    sceneAnchors: {
      openingLine: Boolean(sceneSetup.openingLine),
      openingEnvironment: Boolean(sceneSetup.openingEnvironment),
      openingCueSet: sceneSetup.openingCueSet.length > 0,
      timePressure: Boolean(sceneSetup.timePressure),
      currentClinicalOperationalContext: Boolean(sceneSetup.currentClinicalOperationalContext),
      visitObjective: Boolean(sceneSetup.visitObjective),
    },
    hcpAnchors: {
      baselineCommunicationStyle: Boolean(hcpProfile.baselineCommunicationStyle),
      baselineOpennessResistance: Boolean(hcpProfile.baselineOpennessResistance),
      knownConstraints: hcpProfile.knownConstraints.length > 0,
    },
    stateAnchors: {
      startingState: Boolean(hcpStateModel.startingState),
      allowedTransitions: Object.keys(hcpStateModel.allowedTransitions).length > 0,
    },
  };

  return {
    scenarioIdentity: identity,
    trainingIntent,
    hcpProfile,
    sceneSetup,
    hcpStateModel,
    deterministicCueLibrary,
    dialogueResponseRules,
    metricEvidenceMap,
    metricApplicabilityMap,
    runtimeBehaviorTags,
    feedbackContract,
    contractProvenance,
    contractCompleteness,
  };
}

export function validateScenarioRuntimeContract(contract = {}) {
  const normalized = normalizeScenarioRuntimeContract(contract);
  const issues = [];

  if (!normalized.scenarioIdentity.scenarioId) issues.push("missing_scenario_identity");
  if (!Array.isArray(normalized.trainingIntent.allowedEvaluatedMetrics)) issues.push("invalid_allowed_metrics");
  if (!Array.isArray(normalized.hcpStateModel.prohibitedTransitions)) issues.push("invalid_prohibited_transitions");
  if (!Array.isArray(normalized.feedbackContract.whatFeedbackCanReference)) issues.push("invalid_feedback_can_reference");
  if (!Array.isArray(normalized.feedbackContract.whatFeedbackCannotInfer)) issues.push("invalid_feedback_cannot_infer");
  if (!normalized.sceneSetup.openingLine) issues.push("missing_scene_opening_line");
  if (!normalized.sceneSetup.currentClinicalOperationalContext) issues.push("missing_scene_context_anchor");
  if (!normalized.sceneSetup.timePressure) issues.push("missing_scene_time_pressure_anchor");
  if (!Array.isArray(normalized.sceneSetup.openingCueSet) || normalized.sceneSetup.openingCueSet.length === 0) {
    issues.push("missing_scene_opening_cues");
  }
  if (!normalized.hcpProfile.baselineCommunicationStyle) issues.push("missing_hcp_communication_style");
  if (!normalized.hcpStateModel.startingState) issues.push("missing_hcp_starting_state");

  return { valid: issues.length === 0, issues, contract: normalized };
}

function detectApplicabilitySignals({ hcpUtterance = "", repMessage = "" } = {}) {
  const hcp = String(hcpUtterance || "").toLowerCase();
  const rep = String(repMessage || "").toLowerCase();
  return {
    hasExplicitObjection: /\b(not convinced|concern|concerned|hesitant|objection|skeptical|pushback|not sure)\b/.test(hcp),
    hasCommitmentAttempt: /\b(would you be open|can we schedule|can we agree|next step|commit|set up|book|follow up)\b/.test(rep),
    hasNewInformation: /\b(new|update|changed|different now|since last|now that)\b/.test(hcp),
  };
}

function isMetricApplicable(status = "always_applicable", signals = {}) {
  switch (String(status || "always_applicable")) {
    case "not_applicable":
      return false;
    case "conditional_on_objection":
      return Boolean(signals.hasExplicitObjection);
    case "conditional_on_commitment_attempt":
      return Boolean(signals.hasCommitmentAttempt);
    case "conditional_on_new_information":
      return Boolean(signals.hasNewInformation);
    default:
      return true;
  }
}

export function applyMetricApplicabilityGating(alignment = {}, runtimeContract = {}, evidenceSignals = {}) {
  const applicabilityMap = runtimeContract?.metricApplicabilityMap || {};
  const signals = detectApplicabilitySignals(evidenceSignals);
  const metricEntries = Object.entries(alignment?.metrics || {});
  const metricApplicability = {};
  const metrics = {};

  metricEntries.forEach(([metric, metricValue]) => {
    const status = applicabilityMap[metric] || "always_applicable";
    const applicable = isMetricApplicable(status, signals);
    metricApplicability[metric] = status;
    metrics[metric] = applicable
      ? metricValue
      : {
          ...metricValue,
          score: 3,
          positives: [],
          misalignments: [],
          reason: `Metric gated by applicability rule: ${status}`,
          gatedByApplicability: true,
        };
  });

  const scores = Object.values(metrics).map((metric) => Number(metric?.score || 3));
  const recalculatedScore = scores.length > 0
    ? Math.max(1, Math.min(5, Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)))
    : alignment?.score;

  return {
    ...alignment,
    score: recalculatedScore,
    metrics,
    metricApplicability,
  };
}

export function enforceProhibitedStateTransition({ fromState = "neutral", proposedState = "neutral", runtimeContract = {} } = {}) {
  const prohibited = Array.isArray(runtimeContract?.hcpStateModel?.prohibitedTransitions)
    ? runtimeContract.hcpStateModel.prohibitedTransitions
    : [];
  const blocked = prohibited.find(
    (rule) => String(rule?.from || "") === String(fromState || "")
      && String(rule?.to || "") === String(proposedState || "")
  );
  if (!blocked) return { nextState: proposedState, blocked: false, reason: "" };
  return { nextState: fromState, blocked: true, reason: String(blocked?.reason || "prohibited_transition") };
}

export function enforceFeedbackEvidenceRules(feedbackText = "", runtimeContract = {}) {
  const source = String(feedbackText || "");
  if (!source) return "";
  const prohibited = new Set(
    normalizeList(runtimeContract?.feedbackContract?.whatFeedbackCannotInfer).map((item) => String(item).toLowerCase())
  );
  const forbidIntent = prohibited.has("inferred_intent");
  const forbidEmotion = prohibited.has("inferred_emotion_without_signal");
  const forbidPersonality = prohibited.has("personality_labels");

  return source
    .split("\n")
    .map((line) => {
      let next = line;
      if (forbidIntent) {
        next = next.replace(/\b(they wanted to|they were trying to|you intended to|your intent was)\b/gi, "The observed language suggests");
      }
      if (forbidEmotion) {
        next = next.replace(/\b(the hcp felt|the hcp was feeling|you made them feel)\b/gi, "The explicit HCP statement showed");
      }
      if (forbidPersonality) {
        next = next.replace(/\b(you are (?:pushy|aggressive|weak|insecure)|the hcp is (?:stubborn|closed-minded))\b/gi, "This turn showed a language pattern that reduced alignment");
      }
      return next;
    })
    .join("\n")
    .trim();
}
