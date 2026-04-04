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
    .split(/\n|•|\u2022|;|(?<=[.!?])\s+(?=[A-Z0-9])/)
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
    .replace(/^[:\-–]+\s*/, "")
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

function normalizeMetricApplicability(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  return DEFAULT_ALLOWED_METRICS.reduce((acc, metric) => {
    const status = String(source[metric] || "always_applicable").toLowerCase();
    acc[metric] = status;
    return acc;
  }, {});
}

export function normalizeScenarioRuntimeContract(scenario = {}) {
  const identity = {
    scenarioId: String(scenario?.id || "runtime_scenario"),
    title: String(scenario?.title || "Role Play Scenario"),
    difficulty: String(scenario?.difficulty || "intermediate"),
    version: String(scenario?.version || "1.0.0"),
  };

  const trainingIntent = {
    primaryCapabilityFocus: normalizeList(scenario?.focus_capabilities),
    allowedEvaluatedMetrics: normalizeList(scenario?.allowedEvaluatedMetrics).length > 0
      ? normalizeList(scenario?.allowedEvaluatedMetrics)
      : [...DEFAULT_ALLOWED_METRICS],
  };

  const hcpProfile = {
    role: String(scenario?.stakeholder || "HCP"),
    specialty: String(scenario?.specialty || "general"),
    careSetting: String(scenario?.context || scenario?.description || "clinical setting"),
  };

  const sceneSetup = {
    openingLine: String(scenario?.opening_scene || scenario?.openingScene || ""),
    currentContext: String(scenario?.context || scenario?.description || ""),
  };

  const hcpStateModel = {
    startingState: String(scenario?.startingState || "neutral"),
    allowedTransitions: scenario?.allowedTransitions && typeof scenario.allowedTransitions === "object"
      ? scenario.allowedTransitions
      : {},
    prohibitedTransitions: Array.isArray(scenario?.prohibitedTransitions) ? scenario.prohibitedTransitions : [],
  };

  const deterministicCueLibrary = Array.isArray(scenario?.deterministicCueLibrary)
    ? scenario.deterministicCueLibrary
    : [];

  const dialogueResponseRules = scenario?.dialogueResponseRules && typeof scenario.dialogueResponseRules === "object"
    ? scenario.dialogueResponseRules
    : {};

  const metricEvidenceMap = scenario?.metricEvidenceMap && typeof scenario.metricEvidenceMap === "object"
    ? scenario.metricEvidenceMap
    : {};

  const metricApplicabilityMap = normalizeMetricApplicability(
    scenario?.metricApplicabilityMap || scenario?.trainingIntent?.metricApplicability || {}
  );

  const feedbackContract = {
    whatFeedbackCanReference: normalizeList(
      scenario?.feedbackContract?.whatFeedbackCanReference
    ).length > 0
      ? normalizeList(scenario?.feedbackContract?.whatFeedbackCanReference)
      : [...DEFAULT_FEEDBACK_EVIDENCE],
    whatFeedbackCannotInfer: normalizeList(
      scenario?.feedbackContract?.whatFeedbackCannotInfer
    ).length > 0
      ? normalizeList(scenario?.feedbackContract?.whatFeedbackCannotInfer)
      : [...DEFAULT_PROHIBITED_FEEDBACK_INFERENCE],
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
    feedbackContract,
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
