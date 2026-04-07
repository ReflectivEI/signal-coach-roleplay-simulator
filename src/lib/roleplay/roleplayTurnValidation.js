import { classifyLatestAskProgression } from "../../components/roleplay/latestAskProgression.js";

const VALIDATION_VERSION = "roleplay_turn_validation_v1";

const OPENING_CONTEXT_STATUS = {
  RESPONSIVE: "responsive",
  PARTIALLY_RESPONSIVE: "partially_responsive",
  NON_RESPONSIVE: "non_responsive",
};

const OPENING_STOP_WORDS = new Set([
  "about", "after", "again", "also", "and", "are", "because", "been", "before", "being", "can",
  "could", "did", "does", "for", "from", "have", "here", "how", "into", "just", "last", "like",
  "more", "need", "not", "our", "out", "over", "rep", "said", "say", "that", "the", "their",
  "them", "there", "this", "those", "through", "time", "today", "turn", "want", "was", "we", "what",
  "when", "where", "which", "with", "would", "you", "your",
]);

function normalizeForFingerprint(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeMeaningful(value = "") {
  return normalizeForFingerprint(value)
    .split(" ")
    .filter((token) => token.length > 2 && !OPENING_STOP_WORDS.has(token));
}

function tokenOverlapCount(a = "", b = "") {
  const tokensA = new Set(tokenizeMeaningful(a));
  const tokensB = new Set(tokenizeMeaningful(b));
  if (!tokensA.size || !tokensB.size) return 0;
  let overlap = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) overlap += 1;
  });
  return overlap;
}

function inferOpeningConcernFamily(openingContext = "") {
  const value = String(openingContext || "").toLowerCase();
  if (/\b(screen|screening|candidacy|candidate|eligible|eligibility|patient selection|resistance|adherence|missed[-\s]?dose|long[-\s]?acting|injectable|cabotegravir)\b/.test(value)) return "screening";
  if (/\b(access|coverage|payer|prior[-\s]?auth|pa\b|authorization|approval|denial|reimbursement|copay|affordability|hub|enrollment|paperwork)\b/.test(value)) return "access";
  if (/\b(workflow|staff|staffing|burden|overwhelm|clinic flow|handoff|process|refill gap|administrative|monitoring|follow[-\s]?up)\b/.test(value)) return "workflow";
  if (/\b(evidence|data|study|trial|outcome|endpoint|formulary|p&t|committee|budget|request|requests|decision|clinically meaningful|practice)\b/.test(value)) return "evidence";
  return "general";
}

function hasGenericCannedOpening(repMessage = "") {
  const value = String(repMessage || "").toLowerCase();
  return /\b(follow up|last conversation|dropped off|shared with you last week|high risk patients|thanks for your time|i'?m here to discuss)\b/.test(value);
}

function hasCannedAgendaOpening(repMessage = "") {
  const value = String(repMessage || "").toLowerCase();
  return /\b(follow up|last conversation|dropped off|shared with you last week|high risk patients|i'?m here to discuss)\b/.test(value);
}

function hasNonsenseOrEvasiveOpening(repMessage = "") {
  const value = normalizeForFingerprint(repMessage);
  const tokenCount = value.split(" ").filter(Boolean).length;
  if (tokenCount <= 1) return true;
  return /^(hello|hi|hey|you tell me|you tell|what decision|i don t understand|i do not understand|rephrase your question|rephrase|clarify|what do you mean)$/i.test(value);
}

function hasFamilyResponsiveSignal(repMessage = "", family = "general") {
  const value = String(repMessage || "").toLowerCase();
  const checks = {
    workflow: /\b(workflow|staff|team|step|process|handoff|pilot|implement|start|standardize|standardise|checklist|protocol|clinic flow|run|own|owner)\b/,
    screening: /\b(screen|screening|candidacy|candidate|eligible|eligibility|criteria|resistance|adherence|missed[-\s]?dose|checkpoint|monitoring|cabotegravir|long[-\s]?acting)\b/,
    evidence: /\b(evidence|data|study|trial|outcome|endpoint|formulary|p&t|committee|budget|decision|practice|relevant|focus|proof|clinically meaningful)\b/,
    access: /\b(access|coverage|payer|prior[-\s]?auth|pa\b|authorization|approval|reimbursement|copay|affordability|hub|enrollment|benefits verification|paperwork|bottleneck)\b/,
    general: /\b(question|concern|constraint|focus|step|directly|understand|sounds like)\b/,
  };
  return (checks[family] || checks.general).test(value);
}

function hasOpeningCheckBack(repMessage = "", openingContext = "") {
  const value = String(repMessage || "").trim();
  if (!value.includes("?")) return false;
  return tokenOverlapCount(value, openingContext) >= 1 || /\b(do you mean|are you asking|should i focus|would it help if|is your priority)\b/i.test(value);
}

function classifyFirstTurnOpeningContext({ openingContext = "", repMessage = "" } = {}) {
  const context = String(openingContext || "").trim();
  const rep = String(repMessage || "").trim();
  if (!context || !rep) return null;

  const family = inferOpeningConcernFamily(context);
  const overlap = tokenOverlapCount(rep, context);
  const familySignal = hasFamilyResponsiveSignal(rep, family);
  const checkBack = hasOpeningCheckBack(rep, context);
  const genericCanned = hasGenericCannedOpening(rep);
  const cannedAgenda = hasCannedAgendaOpening(rep);
  const evasive = hasNonsenseOrEvasiveOpening(rep);

  if (evasive || (cannedAgenda && overlap < 2 && !checkBack) || (genericCanned && overlap < 2 && !familySignal && !checkBack)) {
    return {
      status: OPENING_CONTEXT_STATUS.NON_RESPONSIVE,
      family,
      severity: "hard_block",
      overlap,
      genericCanned,
      cannedAgenda,
      evasive,
    };
  }

  if (checkBack || overlap >= 2 || (familySignal && !genericCanned)) {
    return {
      status: OPENING_CONTEXT_STATUS.RESPONSIVE,
      family,
      severity: "none",
      overlap,
      genericCanned,
      cannedAgenda,
      evasive,
    };
  }

  if (genericCanned || familySignal || overlap === 1) {
    return {
      status: OPENING_CONTEXT_STATUS.PARTIALLY_RESPONSIVE,
      family,
      severity: "soft_coach",
      overlap,
      genericCanned,
      cannedAgenda,
      evasive,
    };
  }

  return {
    status: OPENING_CONTEXT_STATUS.NON_RESPONSIVE,
    family,
    severity: "hard_block",
    overlap,
    genericCanned,
    cannedAgenda,
    evasive,
  };
}

function buildTextFingerprint(value = "") {
  const normalized = normalizeForFingerprint(value);
  if (!normalized) return null;
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return `fnv1a_${hash.toString(16).padStart(8, "0")}`;
}

export function buildInvalidTurnCoaching(latestAskProgression = {}) {
  const family = latestAskProgression.family || "general";
  const labelByFamily = {
    workflow: "Answer the workflow ask",
    screening: "Answer the screening ask",
    evidence: "Answer the evidence ask",
    access: "Answer the access ask",
    general: "Answer the HCP ask",
  };
  const suggestionByFamily = {
    workflow: "Give one concrete workflow step tied to the HCP's constraint before introducing anything new.",
    screening: "Name the first screening or candidacy checkpoint you would use before moving forward.",
    evidence: "Give the decision-relevant evidence point the HCP asked for before adding context.",
    access: "Give the first access or prior-auth step that reduces the bottleneck before adding context.",
    general: "Answer the HCP's latest question directly before moving forward.",
  };

  return {
    shouldShow: true,
    label: labelByFamily[family] || labelByFamily.general,
    tip: "That turn repeated prior language without answering the HCP's latest ask, so it was not advanced.",
    suggestion: suggestionByFamily[family] || suggestionByFamily.general,
    severity: latestAskProgression.status === "repeated_missed_close" ? "high" : "medium",
    escalationLabel: "Turn blocked",
  };
}

function buildOpeningContextCoaching(openingContextProgression = {}, { invalid = false } = {}) {
  const family = openingContextProgression.family || "general";
  const suggestionByFamily = {
    workflow: "Start by naming the workflow or staffing constraint the HCP opened with, then give one practical direction.",
    screening: "Start by acknowledging the screening or candidacy concern before introducing your recommendation.",
    evidence: "Start by tying your first sentence to the opening time, formulary, or evidence decision the HCP put on the table.",
    access: "Start by acknowledging the access or prior-auth burden before introducing your recommendation.",
    general: "Start by acknowledging the HCP's opening concern before moving into your agenda.",
  };

  return {
    shouldShow: true,
    label: "Address the opening context",
    tip: invalid
      ? "That first turn did not address the HCP's opening setup, so it was not advanced."
      : "Your first turn should connect more directly to the HCP's opening setup.",
    suggestion: suggestionByFamily[family] || suggestionByFamily.general,
    severity: invalid ? "high" : "low",
    escalationLabel: invalid ? "Turn blocked" : "First-turn context note",
  };
}

export function shouldBlockRepTurnForLatestAsk(latestAskProgression = {}) {
  return ["repeated_missed", "repeated_missed_close"].includes(latestAskProgression.status);
}

function buildReasonCodes({ invalid, latestAskProgression = {}, coachingRequirementMet = true } = {}) {
  const reasonCodes = [];
  if (invalid) reasonCodes.push("invalid_turn_blocked");
  if (["repeated_missed", "repeated_missed_close"].includes(latestAskProgression.status)) {
    reasonCodes.push("repeated_non_answer_blocked");
  }
  if (["missed", "repeated_missed", "repeated_missed_close"].includes(latestAskProgression.status)) {
    reasonCodes.push("latest_ask_ignored");
  }
  if (!coachingRequirementMet) reasonCodes.push("coaching_requirement_not_met");
  if (!invalid && !reasonCodes.includes("latest_ask_ignored")) reasonCodes.push("valid_turn_progressed");
  return reasonCodes;
}

function mergeUniqueReasonCodes(reasonCodes = [], extra = []) {
  const merged = [...reasonCodes];
  extra.forEach((code) => {
    if (code && !merged.includes(code)) merged.push(code);
  });
  return merged;
}

export function buildTurnValidationTelemetryEvents({
  latestAskProgression = {},
  openingContextProgression = null,
  invalid = false,
  latestHcpAsk = "",
  firstTurnOpeningContext = "",
  repMessage = "",
  previousRepMessages = [],
  coachingRequirement = null,
  coachingRequirementMet = true,
} = {}) {
  const openingReasonCodes = openingContextProgression
    ? [
        "first_turn_opening_context_checked",
        openingContextProgression.status === OPENING_CONTEXT_STATUS.NON_RESPONSIVE ? "first_turn_opening_context_ignored" : null,
        openingContextProgression.status === OPENING_CONTEXT_STATUS.PARTIALLY_RESPONSIVE ? "first_turn_opening_context_partial" : null,
      ].filter(Boolean)
    : [];
  const reasonCodes = mergeUniqueReasonCodes(
    buildReasonCodes({ invalid, latestAskProgression, coachingRequirementMet }),
    openingReasonCodes,
  );
  const basePayload = {
    validationVersion: VALIDATION_VERSION,
    status: latestAskProgression.status || "none",
    family: latestAskProgression.family || "general",
    reasonCodes,
    blockHcpGeneration: invalid,
    blockScoring: invalid,
    blockStateAdvance: invalid,
    repeatedRepCount: latestAskProgression.repeatedRepCount || 0,
    loopChallenge: Boolean(latestAskProgression.loopChallenge),
    coachingRequirementType: coachingRequirement?.behavior || null,
    coachingRequirementMet: Boolean(coachingRequirementMet),
    firstTurnOpeningStatus: openingContextProgression?.status || null,
    firstTurnOpeningFamily: openingContextProgression?.family || null,
    latestHcpAskFingerprint: buildTextFingerprint(latestHcpAsk),
    firstTurnOpeningFingerprint: buildTextFingerprint(firstTurnOpeningContext),
    repMessageFingerprint: buildTextFingerprint(repMessage),
    previousRepCount: Array.isArray(previousRepMessages) ? previousRepMessages.length : 0,
  };

  if (invalid) {
    const events = [{ eventType: "invalid_turn_blocked", payload: basePayload }];
    if (reasonCodes.includes("repeated_non_answer_blocked")) {
      events.push({ eventType: "repeated_non_answer_blocked", payload: basePayload });
    }
    if (reasonCodes.includes("latest_ask_ignored")) {
      events.push({ eventType: "latest_ask_ignored", payload: basePayload });
    }
    if (reasonCodes.includes("coaching_requirement_not_met")) {
      events.push({ eventType: "coaching_requirement_not_met", payload: basePayload });
    }
    return events;
  }

  if (reasonCodes.includes("latest_ask_ignored")) {
    return [{ eventType: "latest_ask_ignored", payload: basePayload }];
  }

  return [{ eventType: "valid_turn_progressed", payload: basePayload }];
}

export function validateRoleplayRepTurn({
  latestHcpAsk = "",
  firstTurnOpeningContext = "",
  repMessage = "",
  previousRepMessages = [],
  coachingRequirement = null,
  coachingRequirementMet = true,
} = {}) {
  const openingContextProgression = firstTurnOpeningContext
    ? classifyFirstTurnOpeningContext({ openingContext: firstTurnOpeningContext, repMessage })
    : null;
  const latestAskProgression = classifyLatestAskProgression({
    latestHcpAsk,
    repMessage,
    previousRepMessages,
  });
  const openingInvalid = openingContextProgression?.status === OPENING_CONTEXT_STATUS.NON_RESPONSIVE;
  const openingSoftCoach = openingContextProgression?.status === OPENING_CONTEXT_STATUS.PARTIALLY_RESPONSIVE;
  const invalid = openingInvalid || shouldBlockRepTurnForLatestAsk(latestAskProgression) || Boolean(coachingRequirement && !coachingRequirementMet);
  const telemetryEvents = buildTurnValidationTelemetryEvents({
    latestAskProgression,
    openingContextProgression,
    invalid,
    latestHcpAsk,
    firstTurnOpeningContext,
    repMessage,
    previousRepMessages,
    coachingRequirement,
    coachingRequirementMet,
  });

  return {
    valid: !invalid,
    invalid,
    blockHcpGeneration: invalid,
    blockScoring: invalid,
    blockStateAdvance: invalid,
    latestAskProgression,
    openingContextProgression,
    coaching: openingInvalid || openingSoftCoach
      ? buildOpeningContextCoaching(openingContextProgression, { invalid: openingInvalid })
      : invalid
        ? buildInvalidTurnCoaching(latestAskProgression)
        : null,
    telemetryEvents,
  };
}
