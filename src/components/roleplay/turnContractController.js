// @ts-nocheck
const QUESTION_SPLIT_PATTERN = /[^?]*\?/g;

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "is",
  "are",
  "was",
  "were",
  "be",
  "this",
  "that",
  "it",
  "we",
  "you",
  "your",
  "our",
  "do",
  "does",
  "did",
  "can",
  "could",
  "would",
  "should",
  "what",
  "how",
  "why",
  "when",
  "where",
  "which",
  "who",
]);

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractQuestionTokens(question = "") {
  return normalizeText(question)
    .split(" ")
    .filter((token) => token && token.length > 2 && !STOP_WORDS.has(token));
}

function toArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function extractDirectQuestions(text = "") {
  const value = String(text || "").trim();
  if (!value || !value.includes("?")) return [];
  const matches = value.match(QUESTION_SPLIT_PATTERN) || [];
  return matches.map((q) => q.trim()).filter(Boolean);
}

export function repAddressesQuestion(repMessage = "", question = "") {
  const rep = normalizeText(repMessage);
  if (!rep) return false;
  const questionTokens = extractQuestionTokens(question);
  if (questionTokens.length === 0) return rep.length >= 14;

  const tokenHits = questionTokens.filter((token) => rep.includes(token)).length;
  const numericIntent = /\b(threshold|metric|percent|rate|copies|days|weeks|months)\b/.test(
    normalizeText(question),
  );
  const hasNumericAnchor = /\b\d+([./]\d+)?%?\b/.test(rep);

  return tokenHits >= 1 || (numericIntent && hasNumericAnchor);
}

export function deriveTurnContractState({
  previousSnapshot = {},
  latestHcpTurn = "",
  repMessage = "",
  normalizedActiveConstraints = [],
  activeOperationalConstraints = [],
  activeConcern = "workflow",
  concernFlowOutcome = "neutral",
  unresolvedConcernTurns = 0,
  loopBreakerBudget = 2,
  overrideExit = false,
  terminalDecisionMode = false,
  hardLoopBreaker = false,
} = {}) {
  const priorUnanswered = toArray(previousSnapshot.unansweredDirectQuestions);
  const newQuestions = extractDirectQuestions(latestHcpTurn).map((question, index) => ({
    id: `q_${unresolvedConcernTurns}_${index}_${question.slice(0, 24)}`,
    question,
  }));

  const openQuestions = [...priorUnanswered, ...newQuestions].filter((item) => {
    const question = typeof item === "string" ? item : item.question;
    return !repAddressesQuestion(repMessage, question);
  }).map((item) => ({
    id: typeof item === "string" ? `legacy_${item.slice(0, 24)}` : item.id,
    question: typeof item === "string" ? item : item.question,
  }));

  const acceptedOperationalConstraints = [
    ...new Set([
      ...toArray(previousSnapshot.acceptedOperationalConstraints),
      ...toArray(normalizedActiveConstraints),
      ...toArray(activeOperationalConstraints).map((item) => item?.constraintType).filter(Boolean),
    ]),
  ];

  const priorObjections = toArray(previousSnapshot.unresolvedObjections);
  const unresolvedObjections = (() => {
    if (concernFlowOutcome === "aligned" && unresolvedConcernTurns <= 1) return [];
    if (concernFlowOutcome === "aligned") return priorObjections;
    const merged = new Set(priorObjections);
    merged.add(activeConcern);
    acceptedOperationalConstraints.forEach((constraint) => merged.add(constraint));
    return [...merged].filter(Boolean);
  })();

  const closureReasons = [];
  if (overrideExit) closureReasons.push("explicit_exit_intent");
  if (terminalDecisionMode) closureReasons.push("terminal_decision_mode");
  if (hardLoopBreaker) closureReasons.push("hard_loop_breaker");
  if (unresolvedConcernTurns >= loopBreakerBudget + 1) closureReasons.push("loop_budget_exceeded");

  const closureEligibility = {
    eligible: closureReasons.length > 0,
    reasons: closureReasons,
  };

  return {
    unansweredDirectQuestions: openQuestions,
    unresolvedObjections,
    acceptedOperationalConstraints,
    closureEligibility,
  };
}

export function selectDeterministicResponseMode({
  turnContractState = {},
  concernFlowOutcome = "neutral",
  fallbackMode = "probe",
} = {}) {
  const closureEligible = Boolean(turnContractState?.closureEligibility?.eligible);
  const unansweredQuestions = toArray(turnContractState?.unansweredDirectQuestions);
  const unresolvedObjections = toArray(turnContractState?.unresolvedObjections);

  if (closureEligible) return "close";
  if (unansweredQuestions.length > 0) return "answer";
  if (unresolvedObjections.length > 0 && (concernFlowOutcome === "missed" || concernFlowOutcome === "overpivot")) {
    return "reanchor";
  }
  if (unresolvedObjections.length > 0) return "advance";
  return fallbackMode;
}

export function mapResponseModeToObjective(responseMode = "probe") {
  if (responseMode === "answer") return "answer_direct_constraint_question";
  if (responseMode === "reanchor") return "reanchor_to_constraint";
  if (responseMode === "advance") return "advance_with_constraint";
  if (responseMode === "close") return "close_or_limit_scope";
  return "continue_dialogue";
}

export function validateGeneratedTurnContract({
  responseMode = "probe",
  draftText = "",
  turnContractState = {},
} = {}) {
  const text = String(draftText || "").trim();
  if (!text) {
    return { valid: false, reason: "empty_response" };
  }

  if (responseMode === "answer") {
    const unanswered = toArray(turnContractState?.unansweredDirectQuestions);
    if (unanswered.length > 0) {
      const allQuestions = unanswered.every((item) => String(item?.question || "").includes("?"));
      const looksLikeQuestionOnly = text.includes("?") && !/[.]/.test(text);
      if (allQuestions && looksLikeQuestionOnly) {
        return { valid: false, reason: "answer_mode_generated_question_only" };
      }
    }
  }

  return { valid: true, reason: null };
}

export function buildContractRepairResponse({
  responseMode = "probe",
  activeConcern = "workflow",
} = {}) {
  if (responseMode === "close") {
    return "I need to move to my next patient now. Send one concrete next step for follow-up.";
  }
  if (responseMode === "answer") {
    return "Start with one constrained pilot step this week and measure whether burden decreases before expanding.";
  }
  if (responseMode === "reanchor") {
    return "This still misses the main operational blocker. Give one action that reduces workflow friction first.";
  }
  if (responseMode === "advance") {
    return "That can work if it remains practical in the current workflow. Give the first low-burden step to test.";
  }
  const concernLabel = activeConcern || "workflow";
  return `Keep this focused on ${concernLabel}. Give one practical next step.`;
}
