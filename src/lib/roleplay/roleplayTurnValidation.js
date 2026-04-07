import { classifyLatestAskProgression } from "../../components/roleplay/latestAskProgression.js";

const VALIDATION_VERSION = "roleplay_turn_validation_v1";

const OPENING_CONTEXT_STATUS = {
  RESPONSIVE: "responsive",
  PARTIALLY_RESPONSIVE: "partially_responsive",
  NON_RESPONSIVE: "non_responsive",
};

const OPENING_ASK_STRENGTH = {
  HARD: "hard_explicit_ask",
  SOFT: "soft_implied_ask",
  CONTEXT: "context_only",
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

function computeMeaningfulSimilarity(a = "", b = "") {
  const tokensA = new Set(tokenizeMeaningful(a));
  const tokensB = new Set(tokenizeMeaningful(b));
  if (!tokensA.size || !tokensB.size) return 0;
  let overlap = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) overlap += 1;
  });
  return overlap / Math.max(tokensA.size, tokensB.size);
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

function classifyOpeningAskStrength(openingContext = "") {
  const value = String(openingContext || "").toLowerCase();
  if (!value.trim()) return OPENING_ASK_STRENGTH.CONTEXT;

  if (/\?/.test(value) || /\b(what|how|which|who|when)\b[^.?!]*(\?|should|would|could|can|do|does|is|are)\b/.test(value)) {
    return OPENING_ASK_STRENGTH.HARD;
  }

  if (/\b(give me|show me|tell me|help me|keep it to|start with|focus on|answer|recommend|recommendation|concrete step|practical step|one step|single point|proof point|first step|what should change)\b/.test(value)) {
    return OPENING_ASK_STRENGTH.HARD;
  }

  if (/\b(asks?|asked|asking|signals for|expects|looking for|needs?|wants?|concern|concerned|constraint|barrier|pressure|issue|problem|struggling|frustrated|short-staffed|workflow|screening|access|evidence|formulary|time|minutes)\b/.test(value)) {
    return OPENING_ASK_STRENGTH.SOFT;
  }

  return OPENING_ASK_STRENGTH.CONTEXT;
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

const SHORT_SPOKEN_ACKNOWLEDGEMENT_PATTERN = /^(absolutely|yes|yeah|yep|sure|understood|got it|that makes sense|fair point|i hear you|i understand|okay|ok)([.!?]*)$/i;
const SPOKEN_SENTENCE_SIGNAL_PATTERN = /\b(i|we|you|your|our|let'?s|that|this|it|they|my|the team|hcp|doctor)\b/i;
const FINITE_OR_IMPERATIVE_VERB_PATTERN = /\b(am|is|are|was|were|be|being|been|have|has|had|do|does|did|can|could|will|would|should|may|might|must|need|needs|needed|want|wants|wanted|think|thinks|thought|hear|heard|understand|understood|see|seeing|saw|show|shows|showed|support|supports|supported|change|changes|changed|matter|matters|apply|applies|applied|start|starts|started|assign|assigns|assigned|own|owns|owned|run|runs|ran|pilot|pilots|piloted|implement|implements|implemented|standardize|standardizes|standardized|standardise|standardises|standardised|check|checks|checked|verify|verifies|verified|route|routes|routed|submit|submits|submitted|schedule|schedules|scheduled|review|reviews|reviewed|use|uses|used|build|builds|built|track|tracks|tracked|focus|focuses|focused|connect|connects|connected|answer|answers|answered|ask|asks|asked|address|addresses|addressed|give|gives|gave|tell|tells|told|walk|walks|walked)\b/i;
const NOTE_HEADING_VERB_PATTERN = /\b(am|is|are|was|were|have|has|had|do|does|did|can|could|will|would|should|need|needs|needed|want|wants|wanted|think|thinks|hear|heard|understand|understood|show|shows|showed|support|supports|supported|change|changes|changed|matter|matters|apply|applies|applied|start|starts|started|assign|assigns|assigned|own|owns|owned|run|runs|ran|pilot|pilots|piloted|implement|implements|implemented|standardize|standardizes|standardized|standardise|standardises|standardised|check|checks|checked|verify|verifies|verified|route|routes|routed|submit|submits|submitted|schedule|schedules|scheduled|review|reviews|reviewed|use|uses|used|build|builds|built|track|tracks|tracked|focus|focuses|focused|connect|connects|connected|answer|answers|answered|ask|asks|asked|address|addresses|addressed|give|gives|gave|tell|tells|told|walk|walks|walked)\b/i;
const NOTE_FRAGMENT_NOUN_PATTERN = /\b(benefits?|durability|convenience|reluctance|awareness|perception|priorities|barriers?|criteria|candidacy|resistance|workflow|process|optimization|patients?|data|evidence|outcomes?|objective|challenge|focus|recommendation|coverage|access|adherence|screening|monitoring)\b/i;

function splitNoteLikeSegments(value = "") {
  return String(value || "")
    .split(/[;•\n]+|(?:\s+-\s+)|(?:,\s+)|(?:\.\s+)/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function normalizeNoteSegmentForSpeech(segment = "") {
  return String(segment || "")
    .replace(/^(?:[-*•]|\d+[.)])\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "")
    .replace(/^([A-Z])/, (match) => match.toLowerCase());
}

function startsWithActionVerb(segment = "") {
  return /^(define|implement|start|use|review|check|verify|route|submit|schedule|track|focus|connect|answer|address|give|walk|assign|pilot|standardize|standardise|build)\b/i.test(String(segment || "").trim());
}

function convertActionFragmentToGerund(segment = "") {
  return String(segment || "").trim()
    .replace(/^define\b/i, "defining")
    .replace(/^implement\b/i, "implementing")
    .replace(/^start\b/i, "starting")
    .replace(/^use\b/i, "using")
    .replace(/^review\b/i, "reviewing")
    .replace(/^check\b/i, "checking")
    .replace(/^verify\b/i, "verifying")
    .replace(/^route\b/i, "routing")
    .replace(/^submit\b/i, "submitting")
    .replace(/^schedule\b/i, "scheduling")
    .replace(/^track\b/i, "tracking")
    .replace(/^focus\b/i, "focusing")
    .replace(/^connect\b/i, "connecting")
    .replace(/^answer\b/i, "answering")
    .replace(/^address\b/i, "addressing")
    .replace(/^give\b/i, "giving")
    .replace(/^walk\b/i, "walking")
    .replace(/^assign\b/i, "assigning")
    .replace(/^pilot\b/i, "piloting")
    .replace(/^standardize\b/i, "standardizing")
    .replace(/^standardise\b/i, "standardising")
    .replace(/^build\b/i, "building")
    .replace(/\band implement\b/i, "and implementing")
    .replace(/\band define\b/i, "and defining")
    .replace(/\band start\b/i, "and starting")
    .replace(/\band review\b/i, "and reviewing");
}

function buildSpokenRewriteSuggestion(repMessage = "") {
  const segments = splitNoteLikeSegments(repMessage)
    .map(normalizeNoteSegmentForSpeech)
    .filter(Boolean)
    .slice(0, 3);
  if (!segments.length) return "Respond in a complete sentence as you would say it to the HCP.";

  const [first, second] = segments;
  if (second && startsWithActionVerb(second)) {
    return `Try saying it as: "I think the point is ${first}, and I would make it practical by ${convertActionFragmentToGerund(second)}."`;
  }
  if (second) {
    return `Try saying it as: "I think the key issue is ${first}, and I would connect it to ${second}."`;
  }
  return `Try saying it as: "I think the key issue is ${first}, and I would connect that to one practical next step."`;
}

function detectNonConversationalShape(repMessage = "") {
  const raw = String(repMessage || "").trim();
  const normalized = normalizeForFingerprint(raw);
  const tokens = normalized.split(" ").filter(Boolean);
  if (!raw || tokens.length < 3 || SHORT_SPOKEN_ACKNOWLEDGEMENT_PATTERN.test(raw)) {
    return { detected: false, reasons: [] };
  }

  const reasons = [];
  const bulletLike = /^(?:[-*•]|\d+[.)])\s+/.test(raw) || /(?:^|\n)\s*(?:[-*•]|\d+[.)])\s+/.test(raw);
  if (bulletLike) reasons.push("bullet_or_list_marker");

  const segments = splitNoteLikeSegments(raw);
  const shortSegmentCount = segments.filter((segment) => tokenizeMeaningful(segment).length > 0 && tokenizeMeaningful(segment).length <= 5).length;

  const hasSpokenSignal = SPOKEN_SENTENCE_SIGNAL_PATTERN.test(raw) || /[?]/.test(raw);
  const startsWithImperative = /^(start|assign|pilot|use|review|check|verify|route|submit|schedule|track|focus|connect|answer|address|give|tell|walk)\b/i.test(raw);
  const hasFiniteVerb = FINITE_OR_IMPERATIVE_VERB_PATTERN.test(raw) && !/^\w+\s+to\s+\w+/i.test(raw);
  const hasMultipleShortPhrases = segments.length >= 2 && shortSegmentCount >= 2 && !hasSpokenSignal && !startsWithImperative && !hasFiniteVerb;
  if (hasMultipleShortPhrases) reasons.push("multiple_short_note_phrases");
  const firstSegment = segments[0] || "";
  const nounHeadingWithActionTail = segments.length >= 2
    && tokenizeMeaningful(firstSegment).length <= 6
    && segments.slice(1).some((segment) => tokenizeMeaningful(segment).length <= 9)
    && !hasSpokenSignal
    && NOTE_FRAGMENT_NOUN_PATTERN.test(firstSegment)
    && !NOTE_HEADING_VERB_PATTERN.test(firstSegment)
    && segments.slice(1).some(startsWithActionVerb);
  if (nounHeadingWithActionTail) reasons.push("note_heading_with_action_tail");
  const lacksSentenceStructure = tokens.length >= 4 && !hasSpokenSignal && !startsWithImperative && !hasFiniteVerb;
  if (lacksSentenceStructure) reasons.push("lacks_spoken_sentence_structure");

  const noteStyleTitle = tokens.length >= 4
    && !hasSpokenSignal
    && NOTE_FRAGMENT_NOUN_PATTERN.test(raw)
    && !/[?]/.test(raw)
    && !startsWithImperative
    && !hasFiniteVerb;
  if (noteStyleTitle) reasons.push("note_style_fragment");

  return {
    detected: reasons.length > 0,
    reasons: [...new Set(reasons)],
  };
}

function detectNonConversationalInput({ repMessage = "", allPreviousRepMessages = [] } = {}) {
  const current = detectNonConversationalShape(repMessage);
  if (!current.detected) {
    return { detected: false, repeatCount: 0, stage: "none", reasons: [], spokenRewriteSuggestion: "" };
  }

  const previousMessages = Array.isArray(allPreviousRepMessages) ? allPreviousRepMessages : [];
  const repeatCount = previousMessages.reduce((count, previousMessage) => {
    return detectNonConversationalShape(previousMessage).detected ? count + 1 : count;
  }, 0);
  const stage = repeatCount >= 1 ? "hard_block" : "soft_coach";
  return {
    detected: true,
    repeatCount,
    stage,
    reasons: current.reasons,
    spokenRewriteSuggestion: buildSpokenRewriteSuggestion(repMessage),
  };
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
  const askStrength = classifyOpeningAskStrength(context);
  const checkBack = hasOpeningCheckBack(rep, context);
  const genericCanned = hasGenericCannedOpening(rep);
  const cannedAgenda = hasCannedAgendaOpening(rep);
  const evasive = hasNonsenseOrEvasiveOpening(rep);

  if (evasive) {
    return {
      status: OPENING_CONTEXT_STATUS.NON_RESPONSIVE,
      family,
      askStrength,
      severity: "hard_block",
      overlap,
      genericCanned,
      cannedAgenda,
      evasive,
    };
  }

  if (askStrength === OPENING_ASK_STRENGTH.HARD && ((cannedAgenda && overlap < 2 && !checkBack) || (genericCanned && overlap < 2 && !familySignal && !checkBack))) {
    return {
      status: OPENING_CONTEXT_STATUS.NON_RESPONSIVE,
      family,
      askStrength,
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
      askStrength,
      severity: "none",
      overlap,
      genericCanned,
      cannedAgenda,
      evasive,
    };
  }

  if (genericCanned || familySignal || overlap === 1 || askStrength !== OPENING_ASK_STRENGTH.HARD) {
    return {
      status: OPENING_CONTEXT_STATUS.PARTIALLY_RESPONSIVE,
      family,
      askStrength,
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
    askStrength,
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

function detectNonAdaptiveRepetition({
  latestHcpAsk = "",
  repMessage = "",
  allPreviousRepMessages = [],
  previousHcpAsks = [],
  latestAskProgression = {},
} = {}) {
  const previousReps = Array.isArray(allPreviousRepMessages) ? allPreviousRepMessages.filter(Boolean) : [];
  const previousAsks = Array.isArray(previousHcpAsks) ? previousHcpAsks.filter(Boolean) : [];
  const rep = String(repMessage || "").trim();
  const latestAskUnresolved = ["missed", "repeated_missed", "repeated_missed_close"].includes(latestAskProgression.status);
  if (!rep || !previousReps.length || !latestAskUnresolved) {
    return { detected: false, repeatCount: 0, stage: "none", latestAskChanged: false, latestAskEscalating: false };
  }

  const repFingerprint = buildTextFingerprint(rep);
  let repeatCount = 0;
  for (let i = previousReps.length - 1; i >= 0; i -= 1) {
    const previousRep = String(previousReps[i] || "").trim();
    const exactRepeat = repFingerprint && repFingerprint === buildTextFingerprint(previousRep);
    const nearRepeat = computeMeaningfulSimilarity(rep, previousRep) >= 0.92;
    if (!exactRepeat && !nearRepeat) break;
    repeatCount += 1;
  }

  if (!repeatCount) {
    return { detected: false, repeatCount: 0, stage: "none", latestAskChanged: false, latestAskEscalating: false };
  }

  const lastAsk = String(previousAsks.at(-1) || "").trim();
  const currentAsk = String(latestHcpAsk || "").trim();
  const latestAskChanged = Boolean(lastAsk && currentAsk && computeMeaningfulSimilarity(lastAsk, currentAsk) < 0.92);
  const latestAskEscalating = ["missed", "repeated_missed", "repeated_missed_close"].includes(latestAskProgression.status)
    || /\b(still|directly|again|same|pause|concrete|first|practical|answer)\b/i.test(currentAsk);
  const detected = latestAskChanged || latestAskEscalating;
  const stage = !detected
    ? "none"
    : repeatCount >= 3
      ? "hard_block"
      : repeatCount >= 2
        ? "escalated_soft_coach"
        : "soft_coach";

  return {
    detected,
    repeatCount,
    stage,
    latestAskChanged,
    latestAskEscalating,
  };
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

function buildNonAdaptiveRepetitionCoaching(nonAdaptiveRepetition = {}) {
  return {
    shouldShow: true,
    label: "Adapt to the HCP's response",
    tip: "You're repeating the same message without adapting to the HCP's question.",
    suggestion: "Adjust your response to what they just asked before continuing your original point.",
    severity: nonAdaptiveRepetition.stage === "escalated_soft_coach" ? "medium" : "low",
    escalationLabel: nonAdaptiveRepetition.stage === "hard_block" ? "Turn blocked" : "Adaptation note",
  };
}

function buildNonConversationalInputCoaching(nonConversationalInput = {}) {
  const baseSuggestion = "Respond in a complete sentence as you would say it to the HCP.";
  const spokenRewrite = String(nonConversationalInput.spokenRewriteSuggestion || "").trim();
  return {
    shouldShow: true,
    label: "Use spoken language",
    tip: "This reads like notes, not a conversation.",
    suggestion: spokenRewrite ? `${baseSuggestion} ${spokenRewrite}` : baseSuggestion,
    severity: nonConversationalInput.stage === "hard_block" ? "high" : "medium",
    escalationLabel: nonConversationalInput.stage === "hard_block" ? "Turn blocked" : "Conversation note",
  };
}

export function shouldBlockRepTurnForLatestAsk(latestAskProgression = {}) {
  return ["repeated_missed", "repeated_missed_close"].includes(latestAskProgression.status);
}

function buildReasonCodes({ invalid, softInvalid = false, latestAskProgression = {}, nonAdaptiveRepetition = {}, nonConversationalInput = {}, coachingRequirementMet = true } = {}) {
  const reasonCodes = [];
  if (invalid) reasonCodes.push("invalid_turn_blocked");
  if (softInvalid) reasonCodes.push("soft_invalid_turn_allowed");
  if (nonAdaptiveRepetition.detected) reasonCodes.push("non_adaptive_repetition_detected");
  if (nonConversationalInput.detected) reasonCodes.push("non_conversational_input_detected");
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
  softInvalid = false,
  nonAdaptiveRepetition = {},
  nonConversationalInput = {},
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
    buildReasonCodes({ invalid, softInvalid, latestAskProgression, nonAdaptiveRepetition, nonConversationalInput, coachingRequirementMet }),
    openingReasonCodes,
  );
  const basePayload = {
    validationVersion: VALIDATION_VERSION,
    status: latestAskProgression.status || "none",
    family: latestAskProgression.family || "general",
    reasonCodes,
    softInvalid: Boolean(softInvalid),
    hardInvalid: Boolean(invalid),
    blockHcpGeneration: invalid,
    blockScoring: invalid,
    blockStateAdvance: invalid,
    repeatedRepCount: latestAskProgression.repeatedRepCount || 0,
    nonAdaptiveRepetition: Boolean(nonAdaptiveRepetition.detected),
    nonAdaptiveRepeatCount: nonAdaptiveRepetition.repeatCount || 0,
    nonAdaptiveStage: nonAdaptiveRepetition.stage || "none",
    nonConversationalInput: Boolean(nonConversationalInput.detected),
    nonConversationalInputStage: nonConversationalInput.stage || "none",
    nonConversationalInputRepeatCount: nonConversationalInput.repeatCount || 0,
    nonConversationalInputReasons: Array.isArray(nonConversationalInput.reasons) ? nonConversationalInput.reasons : [],
    loopChallenge: Boolean(latestAskProgression.loopChallenge),
    coachingRequirementType: coachingRequirement?.behavior || null,
    coachingRequirementMet: Boolean(coachingRequirementMet),
    firstTurnOpeningStatus: openingContextProgression?.status || null,
    firstTurnOpeningFamily: openingContextProgression?.family || null,
    firstTurnOpeningAskStrength: openingContextProgression?.askStrength || null,
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
    if (reasonCodes.includes("non_adaptive_repetition_detected")) {
      events.push({ eventType: "non_adaptive_repetition_detected", payload: basePayload });
    }
    if (reasonCodes.includes("non_conversational_input_detected")) {
      events.push({ eventType: "non_conversational_input_detected", payload: basePayload });
    }
    return events;
  }

  if (softInvalid) {
    const events = [{ eventType: "soft_invalid_turn_allowed", payload: basePayload }];
    if (reasonCodes.includes("non_adaptive_repetition_detected")) {
      events.push({ eventType: "non_adaptive_repetition_detected", payload: basePayload });
    }
    if (reasonCodes.includes("latest_ask_ignored")) {
      events.push({ eventType: "latest_ask_ignored", payload: basePayload });
    }
    if (reasonCodes.includes("non_conversational_input_detected")) {
      events.push({ eventType: "non_conversational_input_detected", payload: basePayload });
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
  allPreviousRepMessages = previousRepMessages,
  previousHcpAsks = [],
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
  const openingInvalid = openingContextProgression?.status === OPENING_CONTEXT_STATUS.NON_RESPONSIVE
    && openingContextProgression?.severity === "hard_block";
  const openingSoftCoach = openingContextProgression?.status === OPENING_CONTEXT_STATUS.PARTIALLY_RESPONSIVE;
  const latestAskSoftMiss = latestAskProgression.status === "missed";
  const nonAdaptiveRepetition = detectNonAdaptiveRepetition({
    latestHcpAsk,
    repMessage,
    allPreviousRepMessages,
    previousHcpAsks,
    latestAskProgression,
  });
  const nonConversationalInput = detectNonConversationalInput({
    repMessage,
    allPreviousRepMessages,
  });
  const nonAdaptiveHardBlock = nonAdaptiveRepetition.stage === "hard_block";
  const nonAdaptiveSoftCoach = ["soft_coach", "escalated_soft_coach"].includes(nonAdaptiveRepetition.stage);
  const nonConversationalHardBlock = nonConversationalInput.stage === "hard_block";
  const nonConversationalSoftCoach = nonConversationalInput.stage === "soft_coach";
  const hardInvalid = openingInvalid
    || nonConversationalHardBlock
    || nonAdaptiveHardBlock
    || (!nonAdaptiveRepetition.detected && shouldBlockRepTurnForLatestAsk(latestAskProgression))
    || Boolean(coachingRequirement && !coachingRequirementMet);
  const softInvalid = !hardInvalid && (openingSoftCoach || latestAskSoftMiss || nonAdaptiveSoftCoach || nonConversationalSoftCoach);
  const telemetryEvents = buildTurnValidationTelemetryEvents({
    latestAskProgression,
    openingContextProgression,
    invalid: hardInvalid,
    softInvalid,
    nonAdaptiveRepetition,
    nonConversationalInput,
    latestHcpAsk,
    firstTurnOpeningContext,
    repMessage,
    previousRepMessages,
    coachingRequirement,
    coachingRequirementMet,
  });

  return {
    valid: !hardInvalid,
    invalid: hardInvalid,
    softInvalid,
    hardInvalid,
    blockHcpGeneration: hardInvalid,
    blockScoring: hardInvalid,
    blockStateAdvance: hardInvalid,
    latestAskProgression,
    openingContextProgression,
    nonAdaptiveRepetition: {
      detected: Boolean(nonAdaptiveRepetition.detected),
      repeatCount: nonAdaptiveRepetition.repeatCount || 0,
      stage: nonAdaptiveRepetition.stage || "none",
      latestAskChanged: Boolean(nonAdaptiveRepetition.latestAskChanged),
      latestAskEscalating: Boolean(nonAdaptiveRepetition.latestAskEscalating),
    },
    nonConversationalInput: {
      detected: Boolean(nonConversationalInput.detected),
      repeatCount: nonConversationalInput.repeatCount || 0,
      stage: nonConversationalInput.stage || "none",
      reasons: Array.isArray(nonConversationalInput.reasons) ? nonConversationalInput.reasons : [],
      spokenRewriteSuggestion: nonConversationalInput.spokenRewriteSuggestion || "",
    },
    coaching: nonConversationalInput.detected
        ? buildNonConversationalInputCoaching(nonConversationalInput)
      : openingInvalid || openingSoftCoach
        ? buildOpeningContextCoaching(openingContextProgression, { invalid: openingInvalid })
      : nonAdaptiveRepetition.detected
        ? buildNonAdaptiveRepetitionCoaching(nonAdaptiveRepetition)
      : hardInvalid
        ? buildInvalidTurnCoaching(latestAskProgression)
        : null,
    telemetryEvents,
  };
}
