const SCENARIO_POLICY_PROFILES = Object.freeze({
  hiv_prep: {
    id: "hiv_prep",
    detectionPattern: /\bprep|hiv|sti|cabotegravir|long-acting\b/i,
    operationalLexicon: [
      "prep", "prior auth", "coverage", "adherence", "screening", "resistance", "back-and-forth", "resubmission",
    ],
    constraintAliases: {
      access: ["coverage gap", "coverage barrier", "payer hurdle"],
      workflow: ["clinic process", "care pathway flow", "implementation step"],
      staffing: ["care navigator", "prep coordinator"],
    },
    defaults: {
      minMeaningfulRepTokens: 3,
      evidenceDetailRequired: true,
      loopBreakerBudget: 2,
    },
  },
  oncology_access: {
    id: "oncology_access",
    detectionPattern: /\boncology|tumor|metastatic|biomarker|chemo|immunotherapy\b/i,
    operationalLexicon: [
      "regimen", "line of therapy", "biomarker", "pathway", "prior auth", "reimbursement", "denial", "infusion",
    ],
    constraintAliases: {
      access: ["reimbursement friction", "payer restriction", "coverage denial"],
      workflow: ["tumor board workflow", "pathway alignment"],
      scheduling: ["infusion chair", "chair time", "infusion slot"],
    },
    defaults: {
      minMeaningfulRepTokens: 3,
      evidenceDetailRequired: true,
      loopBreakerBudget: 2,
    },
  },
  cardiometabolic: {
    id: "cardiometabolic",
    detectionPattern: /\bcardio|heart|lipid|diabetes|a1c|glp-1|hypertension\b/i,
    operationalLexicon: [
      "step therapy", "formulary", "coverage", "adherence", "refill", "prior auth", "care coordination",
    ],
    constraintAliases: {
      access: ["formulary restriction", "step edit", "tier restriction"],
      workflow: ["refill workflow", "care gap closure"],
      throughput: ["panel volume", "visit backlog"],
    },
    defaults: {
      minMeaningfulRepTokens: 3,
      evidenceDetailRequired: false,
      loopBreakerBudget: 2,
    },
  },
  general_access: {
    id: "general_access",
    detectionPattern: /.*/i,
    operationalLexicon: [
      "prior auth", "approval", "paperwork", "workflow", "staff burden", "clinic flow", "resubmission",
    ],
    constraintAliases: {
      access: ["coverage barrier", "benefit restriction"],
      workflow: ["operational bottleneck", "handoff delay"],
      staffing: ["team bandwidth", "short staffed"],
    },
    defaults: {
      minMeaningfulRepTokens: 2,
      evidenceDetailRequired: false,
      loopBreakerBudget: 2,
    },
  },
});

const SCENARIO_OVERRIDE_RULES = Object.freeze([
  {
    match: /\bhigh-risk population\b/i,
    overrides: {
      minMeaningfulRepTokens: 4,
      evidenceDetailRequired: true,
      loopBreakerBudget: 2,
    },
  },
  {
    match: /\bstable hiv patients\b/i,
    overrides: {
      minMeaningfulRepTokens: 3,
      evidenceDetailRequired: true,
      loopBreakerBudget: 2,
    },
  },
  {
    match: /\bworkflow integration\b/i,
    overrides: {
      minMeaningfulRepTokens: 3,
      evidenceDetailRequired: false,
      loopBreakerBudget: 2,
    },
  },
]);

export function classifyScenarioFamily(scenarioText = "") {
  const value = String(scenarioText || "");
  if (SCENARIO_POLICY_PROFILES.hiv_prep.detectionPattern.test(value)) return "hiv_prep";
  if (SCENARIO_POLICY_PROFILES.oncology_access.detectionPattern.test(value)) return "oncology_access";
  if (SCENARIO_POLICY_PROFILES.cardiometabolic.detectionPattern.test(value)) return "cardiometabolic";
  return "general_access";
}

export function getScenarioPolicyProfile(scenarioFamily = "general_access") {
  return SCENARIO_POLICY_PROFILES[scenarioFamily] || SCENARIO_POLICY_PROFILES.general_access;
}

export function getScenarioPolicyOverrides({
  scenarioFamily = "general_access",
  scenarioTitle = "",
  scenarioDescription = "",
} = {}) {
  const profile = getScenarioPolicyProfile(scenarioFamily);
  const base = profile?.defaults || {};
  const scope = `${scenarioTitle} ${scenarioDescription}`;

  const matched = SCENARIO_OVERRIDE_RULES.find((rule) => rule.match.test(scope));
  return {
    ...base,
    ...(matched?.overrides || {}),
  };
}
