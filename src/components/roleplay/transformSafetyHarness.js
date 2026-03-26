function tokenize(text = "") {
  return String(text || "")
    .toLowerCase()
    .match(/[a-z0-9']+/g) || [];
}

function uniqueTokenSet(text = "") {
  return new Set(tokenize(text));
}

function overlapRatio(a = "", b = "") {
  const aSet = uniqueTokenSet(a);
  const bSet = uniqueTokenSet(b);
  if (!aSet.size || !bSet.size) return 0;
  let overlap = 0;
  aSet.forEach((token) => {
    if (bSet.has(token)) overlap += 1;
  });
  return overlap / Math.max(1, aSet.size);
}

function hasBalancedPairs(text = "", openChar = "(", closeChar = ")") {
  let depth = 0;
  for (const char of String(text || "")) {
    if (char === openChar) depth += 1;
    if (char === closeChar) depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function hasTerminalPunctuation(text = "") {
  const value = String(text || "").trim();
  if (!value) return false;
  return /[.!?]$/.test(value);
}

function evaluateGrammarIntegrity(originalDialogue = "", transformedDialogue = "") {
  const original = String(originalDialogue || "");
  const transformed = String(transformedDialogue || "");

  return {
    hasText: transformed.trim().length > 0,
    preservesTerminalPunctuation: hasTerminalPunctuation(transformed) || !hasTerminalPunctuation(original),
    balancedParentheses: hasBalancedPairs(transformed, "(", ")"),
    balancedQuotes: (transformed.match(/"/g) || []).length % 2 === 0,
  };
}

function evaluateIntentPreservation(originalDialogue = "", transformedDialogue = "") {
  const original = String(originalDialogue || "");
  const transformed = String(transformedDialogue || "");
  return {
    lexicalOverlap: overlapRatio(original, transformed),
    minimumOverlapMet: overlapRatio(original, transformed) >= 0.4,
  };
}

function evaluateQuestionContinuity(originalDialogue = "", transformedDialogue = "") {
  const original = String(originalDialogue || "");
  const transformed = String(transformedDialogue || "");
  const originalQuestionCount = (original.match(/\?/g) || []).length;
  const transformedQuestionCount = (transformed.match(/\?/g) || []).length;
  const continuity = originalQuestionCount === 0 || transformedQuestionCount > 0;

  return {
    originalQuestionCount,
    transformedQuestionCount,
    continuity,
  };
}

function evaluateConstraintCarryover(originalDialogue = "", transformedDialogue = "") {
  const constraints = [
    "workflow",
    "evidence",
    "access",
    "prior",
    "auth",
    "time",
    "policy",
    "screening",
    "protocol",
    "staff",
    "clinic",
  ];

  const originalTokens = uniqueTokenSet(originalDialogue);
  const transformedTokens = uniqueTokenSet(transformedDialogue);
  const referencedConstraints = constraints.filter((token) => originalTokens.has(token));

  if (!referencedConstraints.length) {
    return {
      referencedConstraints,
      preservedConstraints: [],
      carryover: true,
    };
  }

  const preservedConstraints = referencedConstraints.filter((token) => transformedTokens.has(token));
  return {
    referencedConstraints,
    preservedConstraints,
    carryover: preservedConstraints.length > 0,
  };
}

function computeRepetitionRatio(text = "") {
  const tokens = tokenize(text);
  if (!tokens.length) return 0;
  const uniqueCount = new Set(tokens).size;
  return 1 - (uniqueCount / tokens.length);
}

function computeContextCarryoverAccuracy(transformedDialogue = "", scenarioKeywords = []) {
  const transformedTokens = uniqueTokenSet(transformedDialogue);
  const keywords = (Array.isArray(scenarioKeywords) ? scenarioKeywords : [])
    .map((value) => String(value || "").toLowerCase())
    .filter(Boolean);

  if (!keywords.length) return 1;
  const matched = keywords.filter((keyword) => transformedTokens.has(keyword));
  return matched.length / keywords.length;
}

export function buildReplayHarnessMetrics({
  originalDialogue = "",
  transformedDialogue = "",
  activeConcern = "",
  scenarioKeywords = [],
} = {}) {
  const questionContinuity = evaluateQuestionContinuity(originalDialogue, transformedDialogue);
  const transformedTokens = uniqueTokenSet(transformedDialogue);
  const concernAnchoringPersistence = activeConcern
    ? Number(transformedTokens.has(String(activeConcern).toLowerCase()))
    : 1;

  return {
    repetitionRatio: computeRepetitionRatio(transformedDialogue),
    questionContinuity: questionContinuity.continuity ? 1 : 0,
    concernAnchoringPersistence,
    contextCarryoverAccuracy: computeContextCarryoverAccuracy(transformedDialogue, scenarioKeywords),
  };
}

export function applyTransformSafetyHarness({
  originalDialogue = "",
  transformedDialogue = "",
  activeConcern = "",
  scenarioKeywords = [],
} = {}) {
  const grammarIntegrity = evaluateGrammarIntegrity(originalDialogue, transformedDialogue);
  const intentPreservation = evaluateIntentPreservation(originalDialogue, transformedDialogue);
  const questionContinuity = evaluateQuestionContinuity(originalDialogue, transformedDialogue);
  const constraintCarryover = evaluateConstraintCarryover(originalDialogue, transformedDialogue);

  const checks = {
    grammarIntegrity: Boolean(
      grammarIntegrity.hasText
      && grammarIntegrity.preservesTerminalPunctuation
      && grammarIntegrity.balancedParentheses
      && grammarIntegrity.balancedQuotes
    ),
    intentPreservation: Boolean(intentPreservation.minimumOverlapMet),
    questionContinuity: Boolean(questionContinuity.continuity),
    constraintCarryover: Boolean(constraintCarryover.carryover),
  };

  const accepted = Object.values(checks).every(Boolean);
  const dialogue = accepted ? transformedDialogue : originalDialogue;
  const metrics = buildReplayHarnessMetrics({
    originalDialogue,
    transformedDialogue: dialogue,
    activeConcern,
    scenarioKeywords,
  });

  return {
    dialogue,
    accepted,
    checks,
    diagnostics: {
      grammarIntegrity,
      intentPreservation,
      questionContinuity,
      constraintCarryover,
    },
    metrics,
  };
}
