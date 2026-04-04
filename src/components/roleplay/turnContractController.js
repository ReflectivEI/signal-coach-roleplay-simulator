// @ts-nocheck
export function validateTurnContract(turn) {
  if (!turn) return false;

  const requiredFields = [
    "turnNumber",
    "cueBefore",
    "hcpDialogueBefore",
    "generationKey"
  ];

  for (const field of requiredFields) {
    if (!(field in turn)) {
      return false;
    }
  }

  return true;
}

function tokenize(value = "") {
  return String(value || "")
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
}

export function extractDirectQuestions(text = "") {
  return String(text || "")
    .split(/(?<=[?])/)
    .map((part) => part.trim())
    .filter((part) => part.endsWith("?") && part.length > 1);
}

export function repAddressesQuestion(repMessage = "", question = "") {
  const repTokens = new Set(tokenize(repMessage));
  const questionTokens = tokenize(question).filter((token) => token.length > 3);
  const overlap = questionTokens.filter((token) => repTokens.has(token));
  if (overlap.length > 0) return true;
  const repHasNumericAnchor = /\b\d+(?:[.,]\d+)?\b/.test(repMessage);
  const questionAsksSpecific = /\b(what|which|how|threshold|step|first)\b/i.test(question);
  return repHasNumericAnchor && questionAsksSpecific;
}

export function deriveTurnContractState({
  latestHcpTurn = "",
  repMessage = "",
  normalizedActiveConstraints = [],
  activeConcern = "workflow",
  concernFlowOutcome = "aligned",
  unresolvedConcernTurns = 0,
  loopBreakerBudget = 3,
  overrideExit = false,
  terminalDecisionMode = false,
  hardLoopBreaker = false,
} = {}) {
  const unansweredDirectQuestions = extractDirectQuestions(latestHcpTurn)
    .filter((question) => !repAddressesQuestion(repMessage, question))
    .map((question) => ({ question }));
  const acceptedOperationalConstraints = Array.isArray(normalizedActiveConstraints)
    ? [...new Set(normalizedActiveConstraints.map((value) => String(value || "").trim()).filter(Boolean))]
    : [];
  const unresolvedObjections = [...acceptedOperationalConstraints];
  if (activeConcern && !unresolvedObjections.includes(activeConcern)) unresolvedObjections.push(activeConcern);
  const unresolvedLimitReached = Number(unresolvedConcernTurns) >= Math.max(1, Number(loopBreakerBudget) || 3);
  const missedConstraintLoop = concernFlowOutcome === "missed" && unresolvedLimitReached;
  const eligible = Boolean(overrideExit || terminalDecisionMode || hardLoopBreaker || missedConstraintLoop);

  return {
    unansweredDirectQuestions,
    acceptedOperationalConstraints,
    unresolvedObjections,
    concernFlowOutcome,
    unresolvedConcernTurns,
    closureEligibility: {
      eligible,
      reasons: [
        overrideExit && "override_exit",
        terminalDecisionMode && "terminal_decision_mode",
        hardLoopBreaker && "hard_loop_breaker",
        missedConstraintLoop && "missed_constraint_loop",
      ].filter(Boolean),
    },
  };
}

export function selectDeterministicResponseMode({
  turnContractState = {},
  concernFlowOutcome = "aligned",
  fallbackMode = "probe",
} = {}) {
  const safeTurnContractState = turnContractState && typeof turnContractState === "object"
    ? turnContractState
    : {};
  const unansweredDirectQuestions = Array.isArray(safeTurnContractState.unansweredDirectQuestions)
    ? safeTurnContractState.unansweredDirectQuestions
    : [];
  if (safeTurnContractState?.closureEligibility?.eligible) return "close";
  if (unansweredDirectQuestions.length > 0) return "answer";
  if (concernFlowOutcome === "missed" || concernFlowOutcome === "overpivot") return "repair";
  return fallbackMode;
}


export function buildTurnContractController({
  turnContractState = {},
  concernFlowOutcome = "aligned",
  fallbackMode = "probe",
} = {}) {
  const responseMode = selectDeterministicResponseMode({
    turnContractState,
    concernFlowOutcome,
    fallbackMode,
  });

  return {
    responseMode,
    objective: mapResponseModeToObjective(responseMode),
  };
}

export function mapResponseModeToObjective(mode = "probe") {
  if (mode === "answer") return "answer_direct_constraint_question";
  if (mode === "close") return "close_with_next_step";
  if (mode === "repair") return "repair_alignment";
  return "probe_for_operational_detail";
}

export function validateGeneratedTurnContract({
  responseMode = "probe",
  draftText = "",
  turnContractState = {},
} = {}) {
  const safeTurnContractState = turnContractState && typeof turnContractState === "object"
    ? turnContractState
    : {};
  const unansweredDirectQuestions = Array.isArray(safeTurnContractState.unansweredDirectQuestions)
    ? safeTurnContractState.unansweredDirectQuestions
    : [];
  const normalized = String(draftText || "").trim();
  const questionOnly = normalized.endsWith("?") && !/[.!]/.test(normalized);
  const requiresAnswer = responseMode === "answer" && unansweredDirectQuestions.length > 0;
  if (requiresAnswer && questionOnly) {
    return { valid: false, reason: "question_only_answer_mode" };
  }
  return { valid: true, reason: "ok" };
}

export function buildContractRepairResponse({ responseMode = "probe", activeConcern = "workflow" } = {}) {
  if (responseMode === "answer") {
    return `Let me give one practical answer tied to ${activeConcern} before we continue.`;
  }
  if (responseMode === "close") {
    return "Thanks. Let's close with one concrete next step and owner.";
  }
  return `Let's reset on the ${activeConcern} constraint and keep this practical.`;
}
