const RESPONSE_MODES = Object.freeze({
  ANSWER: "ANSWER",
  RESOLVE_OBJECTION: "RESOLVE_OBJECTION",
  CLOSE: "CLOSE",
  PROBE: "PROBE",
});

const QUESTION_START_RE = /^(what|why|how|when|where|who|which|can|could|would|will|do|does|did|is|are|am|should|have|has|had)\b/i;
const OBJECTION_RE = /\b(concern|worried|worry|skeptic|skeptical|not convinced|pushback|issue|problem|barrier|burden|friction|too much|doesn't work|does not work|not feasible|unrealistic|cost|coverage|prior auth|authorization|staff|staffing|workflow|time|bandwidth|resources?)\b/i;
const CLOSE_CUE_RE = /\b(wrap up|have to run|need to go|got to go|let's close|lets close|we're done|we are done|goodbye|thanks for your time|end this|final point)\b/i;
const CONSTRAINT_RE = /\b(staff|staffing|workflow|time|bandwidth|resource|capacity|prior auth|authorization|coverage|cost|practical|implementation|operations?)\b/gi;

function toId(prefix, value, fallback = "item") {
  const seed = String(value || fallback).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32);
  return `${prefix}-${seed || fallback}`;
}

function extractQuestions(text = "") {
  const value = String(text || "").trim();
  if (!value) return [];
  const questionChunks = value
    .split(/(?<=[?])/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk && (chunk.includes("?") || QUESTION_START_RE.test(chunk)));

  if (questionChunks.length) {
    return questionChunks.map((q) => ({ id: toId("q", q), text: q, source: "counterpart_turn" }));
  }

  if (QUESTION_START_RE.test(value)) {
    return [{ id: toId("q", value), text: value, source: "counterpart_turn" }];
  }

  return [];
}

function extractObjections(text = "") {
  const value = String(text || "").trim();
  if (!value || !OBJECTION_RE.test(value)) return [];
  return [{ id: toId("obj", value), text: value, source: "counterpart_turn", resolved: false }];
}

function extractConstraints(text = "") {
  const value = String(text || "").toLowerCase();
  const hits = [...value.matchAll(CONSTRAINT_RE)].map((m) => m[0]);
  return [...new Set(hits)].map((constraint) => ({
    id: toId("constraint", constraint),
    constraint,
    source: "counterpart_turn",
  }));
}

function hasCloseCue(text = "") {
  return CLOSE_CUE_RE.test(String(text || "").toLowerCase());
}

function dedupeById(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function createInitialObligationLedger() {
  return {
    open_questions: [],
    unresolved_objections: [],
    accepted_constraints: [],
    closure_preconditions: {
      explicit_close_cue: false,
      has_open_questions: false,
      has_unresolved_objections: false,
      eligible: false,
      reason: "",
    },
    active_response_mode: RESPONSE_MODES.PROBE,
    last_obligation_decision: {
      mode: RESPONSE_MODES.PROBE,
      reason: "No higher-priority obligations detected.",
      timestamp: null,
    },
    obligation_satisfaction_status: {
      mode: RESPONSE_MODES.PROBE,
      satisfied: false,
      reason: "Not evaluated yet",
      retry_used: false,
    },
  };
}

function decideResponseMode(ledger) {
  if ((ledger.open_questions || []).length > 0) {
    return {
      mode: RESPONSE_MODES.ANSWER,
      reason: "Unresolved direct question detected.",
      priority: 1,
    };
  }

  if ((ledger.unresolved_objections || []).length > 0) {
    return {
      mode: RESPONSE_MODES.RESOLVE_OBJECTION,
      reason: "Unresolved objection detected with no pending direct question.",
      priority: 2,
    };
  }

  if (ledger?.closure_preconditions?.explicit_close_cue && ledger?.closure_preconditions?.eligible) {
    return {
      mode: RESPONSE_MODES.CLOSE,
      reason: "Explicit close cue present and closure preconditions are satisfied.",
      priority: 3,
    };
  }

  return {
    mode: RESPONSE_MODES.PROBE,
    reason: "No unresolved higher-priority obligation remains.",
    priority: 4,
  };
}

function updateObligationLedger(previousLedger, latestCounterpartTurn, options = {}) {
  const prev = previousLedger || createInitialObligationLedger();
  const latestText = String(latestCounterpartTurn || "").trim();

  const newlyDetectedQuestions = extractQuestions(latestText);
  const newlyDetectedObjections = extractObjections(latestText);
  const newlyDetectedConstraints = extractConstraints(latestText);

  const mergedOpenQuestions = dedupeById([...(prev.open_questions || []), ...newlyDetectedQuestions]);
  const mergedObjections = dedupeById([...(prev.unresolved_objections || []), ...newlyDetectedObjections]);
  const mergedConstraints = dedupeById([...(prev.accepted_constraints || []), ...newlyDetectedConstraints]);

  const hasOpenQuestions = mergedOpenQuestions.length > 0;
  const hasObjections = mergedObjections.length > 0;
  const explicitCloseCue = hasCloseCue(latestText);
  const eligible = explicitCloseCue && !hasOpenQuestions && !hasObjections;

  const closure_preconditions = {
    explicit_close_cue: explicitCloseCue,
    has_open_questions: hasOpenQuestions,
    has_unresolved_objections: hasObjections,
    eligible,
    reason: eligible
      ? "Close cue present and no higher-priority unresolved obligations."
      : "Closure blocked by missing cue or unresolved higher-priority obligations.",
  };

  const decision = decideResponseMode({
    ...prev,
    open_questions: mergedOpenQuestions,
    unresolved_objections: mergedObjections,
    accepted_constraints: mergedConstraints,
    closure_preconditions,
  });

  return {
    ...prev,
    open_questions: mergedOpenQuestions,
    unresolved_objections: mergedObjections,
    accepted_constraints: mergedConstraints,
    closure_preconditions,
    active_response_mode: decision.mode,
    last_obligation_decision: {
      mode: decision.mode,
      reason: decision.reason,
      priority: decision.priority,
      timestamp: options.timestamp || new Date().toISOString(),
    },
  };
}

function buildTurnContractBlock({
  ledger,
  latestCounterpartIntent,
  selectedMode,
  strictness = "base",
}) {
  const mustDoRules = {
    [RESPONSE_MODES.ANSWER]: "Directly answer the latest question first. Only ask a follow-up after a substantive answer.",
    [RESPONSE_MODES.RESOLVE_OBJECTION]: "Address the objection materially before any probing or topic shift.",
    [RESPONSE_MODES.CLOSE]: "Close professionally with a concrete wrap-up and no new discovery questions.",
    [RESPONSE_MODES.PROBE]: "Ask one focused probe only when no unresolved question/objection exists.",
  };

  const forbiddenRules = [
    selectedMode === RESPONSE_MODES.ANSWER ? "Do not lead with a question, deflection, or coaching meta-commentary." : null,
    selectedMode === RESPONSE_MODES.RESOLVE_OBJECTION ? "Do not provide empathy-only acknowledgement without a concrete response." : null,
    !ledger?.closure_preconditions?.eligible ? "Do not close or signal conversation end this turn." : null,
    strictness === "strict" ? "Do not violate the selected response mode under any condition." : null,
  ].filter(Boolean);

  return [
    "TURN CONTRACT (HARD OBLIGATION CONTROLLER)",
    `latest_counterpart_intent: ${latestCounterpartIntent || "unspecified"}`,
    `active_constraints: ${(ledger?.accepted_constraints || []).map((c) => c.constraint).join(", ") || "none"}`,
    `must_do_this_turn: ${mustDoRules[selectedMode] || mustDoRules[RESPONSE_MODES.PROBE]}`,
    `forbidden_this_turn: ${forbiddenRules.join(" | ") || "none"}`,
    `selected_response_mode: ${selectedMode}`,
    `closure_allowed: ${ledger?.closure_preconditions?.eligible ? "yes" : "no"}`,
    `unresolved_items: questions=${(ledger?.open_questions || []).length}; objections=${(ledger?.unresolved_objections || []).length}`,
  ].join("\n");
}

function sentenceStartsWithQuestion(text = "") {
  const sentence = String(text || "").trim().split(/[.!?]/)[0] || "";
  return /^(can|could|would|will|what|why|how|when|where|who|which|do|does|did|is|are|am|should|have|has|had)\b/i.test(sentence);
}

function validateGeneratedTurn({ mode, generatedText, ledger, latestCounterpartTurn }) {
  const text = String(generatedText || "").trim();
  const lower = text.toLowerCase();
  const counterpart = String(latestCounterpartTurn || "").toLowerCase();

  const askedBeforeAnswering = sentenceStartsWithQuestion(text);
  const containsCloseLanguage = /\b(goodbye|take care|have a good day|let's wrap|we can end here|talk later)\b/i.test(lower);

  let satisfied = true;
  let reason = "Obligation satisfied.";

  if (mode === RESPONSE_MODES.ANSWER) {
    const hasSubstance = text.split(/\s+/).length >= 6;
    satisfied = hasSubstance && !askedBeforeAnswering;
    reason = satisfied
      ? "Direct answer present before probing."
      : "ANSWER mode violation: response lacked direct substantive answer or led with a question.";
  } else if (mode === RESPONSE_MODES.RESOLVE_OBJECTION) {
    const objectionTerms = (ledger?.unresolved_objections || []).map((o) => o.text.toLowerCase()).join(" ");
    const materiallyAddresses = /\b(because|so|therefore|we can|you can|this would|practical|workflow|step|option|plan|address)\b/.test(lower);
    const touchesConcern = !objectionTerms || objectionTerms.split(/\s+/).some((token) => token.length > 4 && lower.includes(token));
    satisfied = materiallyAddresses && touchesConcern && !askedBeforeAnswering;
    reason = satisfied
      ? "Objection addressed materially before probe."
      : "RESOLVE_OBJECTION mode violation: concern not materially resolved first.";
  } else if (mode === RESPONSE_MODES.CLOSE) {
    const closureAllowed = Boolean(ledger?.closure_preconditions?.eligible);
    satisfied = closureAllowed && containsCloseLanguage;
    reason = satisfied
      ? "Closure was eligible and executed correctly."
      : "CLOSE mode violation: closure not eligible or not actually closed.";
  } else if (mode === RESPONSE_MODES.PROBE) {
    const hasHigherPriorityOutstanding = (ledger?.open_questions || []).length > 0 || (ledger?.unresolved_objections || []).length > 0;
    satisfied = !hasHigherPriorityOutstanding;
    reason = satisfied
      ? "Probe allowed because no higher-priority obligations remain."
      : "PROBE mode violation: unresolved higher-priority obligations exist.";
  }

  const modeMatch = satisfied;

  return {
    satisfied,
    reason,
    hardFields: {
      direct_question_satisfied: mode === RESPONSE_MODES.ANSWER ? satisfied : null,
      objection_resolved_this_turn: mode === RESPONSE_MODES.RESOLVE_OBJECTION ? satisfied : null,
      closure_correctness: mode === RESPONSE_MODES.CLOSE ? satisfied : !containsCloseLanguage,
      mode_match: modeMatch,
      asked_before_answering: mode === RESPONSE_MODES.ANSWER ? askedBeforeAnswering : false,
      unresolved_high_priority_obligation_remaining:
        (ledger?.open_questions || []).length > 0 || (ledger?.unresolved_objections || []).length > 0,
    },
    telemetry: {
      selected_mode: mode,
      closure_allowed: Boolean(ledger?.closure_preconditions?.eligible),
      counterpart_excerpt: counterpart.slice(0, 180),
    },
  };
}

function applySatisfactionToLedger(ledger, validationResult) {
  const next = {
    ...ledger,
    obligation_satisfaction_status: {
      mode: ledger.active_response_mode,
      satisfied: Boolean(validationResult?.satisfied),
      reason: validationResult?.reason || "No validation result.",
      hard_fields: validationResult?.hardFields || {},
      retry_used: Boolean(validationResult?.retryUsed),
    },
  };

  if (validationResult?.satisfied) {
    if (next.active_response_mode === RESPONSE_MODES.ANSWER) {
      next.open_questions = [];
    }
    if (next.active_response_mode === RESPONSE_MODES.RESOLVE_OBJECTION) {
      next.unresolved_objections = [];
    }
  }

  return next;
}

function shouldSuppressCoachingForMode(mode) {
  return mode === RESPONSE_MODES.ANSWER || mode === RESPONSE_MODES.RESOLVE_OBJECTION;
}

function buildModeFallbackResponse(mode, ledger, latestCounterpartTurn) {
  const latestQuestion = (ledger?.open_questions || [])[0]?.text || latestCounterpartTurn;
  const latestObjection = (ledger?.unresolved_objections || [])[0]?.text || latestCounterpartTurn;

  if (mode === RESPONSE_MODES.ANSWER) {
    return `Direct answer: ${latestQuestion ? `On "${latestQuestion}", the practical approach is to start with one implementable step this week and validate impact quickly.` : "Here is the practical answer: start with one implementable step this week and validate impact quickly."}`;
  }

  if (mode === RESPONSE_MODES.RESOLVE_OBJECTION) {
    return `You're right to raise that concern. On "${latestObjection}", the most practical way to address it is to reduce workflow burden by using a single-owner rollout step and a short follow-up checkpoint.`;
  }

  if (mode === RESPONSE_MODES.CLOSE) {
    return "Thanks for the discussion. We'll close here, and I can follow up with one concise summary and next step.";
  }

  return "Before we continue, what is the single biggest operational barrier you want solved first?";
}

export {
  RESPONSE_MODES,
  createInitialObligationLedger,
  updateObligationLedger,
  decideResponseMode,
  buildTurnContractBlock,
  validateGeneratedTurn,
  applySatisfactionToLedger,
  shouldSuppressCoachingForMode,
  buildModeFallbackResponse,
};
