import { detectHcpQuestionType, semanticallyAnswersHcpAsk } from "./qaRepProxy.js";
import {
  buildScenarioRouting,
  detectTopicLanes,
  summarizeRoutingAlignment,
} from "./scenarioRouting";

export const QA_FAILURE_TAXONOMY = [
  "chatbot_phrasing",
  "over_precise",
  "over_written",
  "over_explained",
  "weak_skepticism",
  "wrong_emotional_temperature",
  "poor_persona_fit",
  "poor_specialty_fit",
  "workflow_implausible",
  "access_implausible",
  "clinical_implausible",
  "continuity_break",
  "question_obligation_failure",
  "weak_answer",
  "repetition_or_looping",
  "conversation_stagnation",
  "journey_stage_mismatch",
  "interaction_pressure_mismatch",
  "abrupt_rudeness_without_basis",
  "unearned_tone_shift",
];

const QA_FAILURE_SEVERITY = {
  question_obligation_failure: "blocking",
  continuity_break: "blocking",
  conversation_stagnation: "blocking",
  repetition_or_looping: "major",
  journey_stage_mismatch: "major",
  interaction_pressure_mismatch: "major",
  weak_answer: "major",
  workflow_implausible: "major",
  access_implausible: "major",
  clinical_implausible: "major",
  poor_persona_fit: "major",
  poor_specialty_fit: "major",
  weak_skepticism: "major",
  abrupt_rudeness_without_basis: "major",
  unearned_tone_shift: "major",
  chatbot_phrasing: "minor",
  over_precise: "minor",
  over_written: "minor",
  over_explained: "minor",
  wrong_emotional_temperature: "minor",
};

const ROOT_CAUSE_BY_FAILURE = {
  interaction_pressure_mismatch: "interaction_pressure_mismatch",
  weak_skepticism: "interaction_pressure_mismatch",
  journey_stage_mismatch: "journey_stage_mismatch",
  workflow_implausible: "workflow_implausible",
  access_implausible: "workflow_implausible",
  poor_persona_fit: "poor_persona_fit",
  poor_specialty_fit: "poor_persona_fit",
  question_obligation_failure: "question_obligation_failure",
  weak_answer: "question_obligation_failure",
  repetition_or_looping: "repetition_or_looping",
  conversation_stagnation: "repetition_or_looping",
};

const JOURNEY_STAGE_ORDER = [
  "initial_access",
  "early_discovery",
  "clinical_value",
  "objection_handling",
  "adoption_implementation",
  "access_formulary",
  "commitment_close",
];

const CHATBOT_PATTERNS = [
  /\bi understand your concern\b/i,
  /\bi appreciate your willingness\b/i,
  /\bwhat specific aspects\b/i,
  /\bhelp me understand\b/i,
  /\badministrative burden\b/i,
  /\bsignificant impact on\b/i,
  /\bthe real question is\b/i,
  /\bmy question is always the same\b/i,
  /\bwalk me through\b/i,
];

const HUMAN_CLINICIAN_PATTERNS = [
  /\bmy staff\b/i,
  /\bmy ma\b/i,
  /\bnext patient\b/i,
  /\bformulary\b/i,
  /\bprior auth\b/i,
  /\bworkflow\b/i,
  /\bpatients\b/i,
  /\bwhat'?s this about\b/i,
  /\bwhat are you looking to discuss\b/i,
  /\bwhat specifically are you looking to go over\b/i,
];

const ABRUPT_OPENING_PATTERNS = [/^look,/i, /^just\b/i, /^so\b/i, /^alright\b/i];
const SHARP_PHRASE_PATTERNS = [/\bmake it quick\b/i, /\bjust say it\b/i];
const CLINICAL_PATTERNS = [/\btrial\b/i, /\bguideline\b/i, /\brenal\b/i, /\befficacy\b/i, /\bsafety\b/i, /\bsubgroup\b/i];
const ACCESS_PATTERNS = [/\bformulary\b/i, /\bnon-preferred\b/i, /\bprior auth\b/i, /\bcommittee\b/i, /\baccess\b/i, /\bpayer\b/i];
const WORKFLOW_PATTERNS = [/\bstaff\b/i, /\bworkflow\b/i, /\bhandoff\b/i, /\bcallback\b/i, /\bextra steps?\b/i, /\bprocess\b/i];
const JOURNEY_SIGNAL_PATTERNS = {
  initial_access: [/\bwhat'?s this about\b/i, /\bwhy are you here\b/i, /\bfew minutes\b/i, /\bshort version\b/i],
  early_discovery: [/\bwhich patients?\b/i, /\bwhat are you seeing\b/i, /\bgo over today\b/i, /\bstay on therapy\b/i],
  clinical_value: [/\befficacy\b/i, /\bguideline\b/i, /\bsubgroup\b/i, /\bcost per patient\b/i, /\boutcome\b/i],
  objection_handling: [/\bnot interested\b/i, /\bswitching\b/i, /\bwhat would change\b/i, /\bwhat specifically would change\b/i],
  adoption_implementation: [/\bworkflow\b/i, /\bmonitoring\b/i, /\bwho owns\b/i, /\bwhat happens next\b/i],
  access_formulary: ACCESS_PATTERNS,
  commitment_close: [/\bnext step\b/i, /\bwould you be open\b/i, /\bbring it up\b/i, /\bflag the chart\b/i],
};

const PRESSURE_PATTERNS = {
  time_constrained: [/\bminute\b/i, /\bnext patient\b/i, /\bfew minutes\b/i, /\bshort version\b/i, /\bquick\b/i],
  operationally_constrained: WORKFLOW_PATTERNS,
  skeptical_resistant: [/\bnot interested\b/i, /\bnot convinced\b/i, /\bwhat makes you think\b/i, /\bwhy should i\b/i],
  curious_uncertain: [/\bnot sure\b/i, /\bhelp me think through\b/i, /\bwhich patients?\b/i],
  safety_concern: [/\bsafety\b/i, /\bhepatic\b/i, /\brisk\b/i, /\badverse\b/i],
  access_barrier: ACCESS_PATTERNS,
  competitive_bias: [/\bcurrent options\b/i, /\bwhat i'm already using\b/i, /\bswitching\b/i],
};

function normalize(text = "") {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function normalizePressureList(scenario = {}) {
  return asArray(scenario?.interactionPressure)
    .map((item) => normalize(item).toLowerCase())
    .filter(Boolean);
}

function classifyFailureSeverity(type, confidence = "medium") {
  const base = QA_FAILURE_SEVERITY[type] || "minor";
  if (base === "major" && confidence === "high") return "blocking";
  if (base === "minor" && confidence === "high") return "major";
  return base;
}

function buildRootCauseClassification(failures = []) {
  const baseline = {
    interaction_pressure_mismatch: 0,
    journey_stage_mismatch: 0,
    workflow_implausible: 0,
    poor_persona_fit: 0,
    question_obligation_failure: 0,
    repetition_or_looping: 0,
  };

  failures.forEach((failure) => {
    const bucket = ROOT_CAUSE_BY_FAILURE[failure?.type];
    if (bucket && Object.prototype.hasOwnProperty.call(baseline, bucket)) {
      baseline[bucket] += 1;
    }
  });

  return baseline;
}

function isAdjacentJourneyStage(expected, detected) {
  const expectedIdx = JOURNEY_STAGE_ORDER.indexOf(String(expected || "").toLowerCase());
  const detectedIdx = JOURNEY_STAGE_ORDER.indexOf(String(detected || "").toLowerCase());
  if (expectedIdx < 0 || detectedIdx < 0) return false;
  return Math.abs(expectedIdx - detectedIdx) <= 1;
}

function buildEvidenceSnippet(text = "", max = 180) {
  const value = normalize(text);
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function tokenize(text = "") {
  return normalize(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function overlapScore(a = "", b = "") {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  if (!aTokens.size || !bTokens.size) return 0;
  let shared = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) shared += 1;
  });
  return shared / Math.max(aTokens.size, bTokens.size);
}

function inferConcernFamily(text = "") {
  const value = normalize(text).toLowerCase();
  if (ACCESS_PATTERNS.some((pattern) => pattern.test(value))) return "access";
  if (WORKFLOW_PATTERNS.some((pattern) => pattern.test(value))) return "workflow";
  if (CLINICAL_PATTERNS.some((pattern) => pattern.test(value))) return "clinical";
  if (/patient|subgroup|fit|therapy|outcome|respond/.test(value)) return "patient_fit";
  return "general";
}

function hasDomainAnchoring(text = "") {
  const value = normalize(text);
  return HUMAN_CLINICIAN_PATTERNS.some((pattern) => pattern.test(value))
    || ACCESS_PATTERNS.some((pattern) => pattern.test(value))
    || WORKFLOW_PATTERNS.some((pattern) => pattern.test(value))
    || CLINICAL_PATTERNS.some((pattern) => pattern.test(value));
}

function hasDecisionLogic(text = "") {
  const t = normalize(text).toLowerCase();
  return (
    t.includes("if this doesn't") ||
    t.includes("i'm not going to") ||
    t.includes("it doesn't move") ||
    t.includes("i'm not using") ||
    t.includes("it won't work") ||
    t.includes("i need to know if") ||
    t.includes("unless it")
  );
}

function hasPersonaDecisionCadence(text = "") {
  const value = normalize(text).toLowerCase();
  if (!value) return false;

  return (
    hasDecisionLogic(value) ||
    /\bpractical version\b/.test(value) ||
    /\bpractical access version\b/.test(value) ||
    /\bproof point\b/.test(value) ||
    /\bevidence point\b/.test(value) ||
    /\bworth the cost\b/.test(value) ||
    /\bjustify the cost\b/.test(value) ||
    /\bcost value\b/.test(value) ||
    /\bpatient-relevant\b/.test(value) ||
    /\bconcrete change\b/.test(value) ||
    /\bactual office impact\b/.test(value) ||
    /\bchanges for my staff\b/.test(value) ||
    /\bchanges outcomes\b/.test(value) ||
    /\bi need the (?:access|cost|evidence|workflow|safety|competitive|practical) version\b/.test(value) ||
    /\bi need the actual office impact\b/.test(value) ||
    /\bwe should stop here for now\b/.test(value) ||
    /\bi need to stop here\b/.test(value) ||
    /\bi'?m going to leave it there\b/.test(value) ||
    /\bsend the .* over\b/.test(value) ||
    /\bwalk me through that a bit more\b/.test(value) ||
    /\bwhat'?s the concrete change\b/.test(value) ||
    /\bwhat changes for my staff\b/.test(value) ||
    /\bwhat proof point would make this usable\b/.test(value)
  );
}

function hasConcreteAnswerSignal(text = "") {
  const value = normalize(text).toLowerCase();
  const hasDomain =
    /\bstaff\b|\bworkflow\b|\bprocess\b|\bpatients?\b|\baccess\b|\bprior auth\b|\bpa\b|\bformulary\b|\bcommittee\b|\bhandoff\b|\bcallbacks?\b|\bsteps?\b|\bpayer\b|\bpaperwork\b|\bdocumentation\b|\bauthorization\b|\bform\b|\bma\b/.test(value);
  const hasChange =
    /\bfix\b|\bcomplete\b|\bsubmit\b|\bsend\b|\breduce\b|\bremove\b|\bavoid\b|\bstop\b|\bless\b|\bfewer\b|\bno more\b|\bnot have to\b|\bdoesn't have to\b|\bgoes through\b|\bmove forward\b|\bcleaner\b|\bright first time\b|\bcuts out\b|\bdrops off\b/.test(value);
  const hasSpecificity =
    /\bresubmission\b|\bmissing info\b|\bmissing information\b|\bcallback\b|\bkicked back\b|\bdenied\b|\breopened\b|\bpayer\b|\bdocumentation\b|\bicd\b|\bstep therapy\b|\bchart notes\b|\bform\b|\bfront desk\b|\bma\b|\boffice staff\b|\bapproval\b|\bclean first time\b|\bsame authorization\b|\bsame pa\b|\bsame prior auth\b/.test(value);
  const shortDirect =
    /\bno resubmissions\b|\bit goes through clean the first time\b|\bstaff not doing same pa twice\b|\bma no chase missing info\b|\bless callback\b|\bless fixing same authorization\b/.test(value);
  return (((hasDomain && hasChange && hasSpecificity) || shortDirect) && !/\?$/.test(value));
}

function startsWithQuestion(text = "") {
  const value = normalize(text);
  return /\?$/.test(value) || /^(what|how|why|where|when|who|can|could|would|should|is|are|do|does|did)\b/i.test(value);
}

function firstSentence(text = "") {
  const value = normalize(text);
  if (!value) return "";
  const match = value.match(/^(.+?[.?!])(?:\s|$)/);
  return match ? match[1].trim() : value;
}

function isBroadRepDiscoveryQuestion(text = "") {
  return /\bhelp me understand\b|\bcan you elaborate\b|\bwalk me through\b|\bwhat specific aspects\b|\bwhat's the biggest\b|\bwhere is the biggest\b/i.test(normalize(text));
}

function isVagueRepAnswer(text = "") {
  const value = normalize(text).toLowerCase();
  const wordCount = value.split(/\s+/).filter(Boolean).length;
  if (!value) return true;
  return (
    wordCount < 8 &&
    !hasDomainAnchoring(value) &&
    !hasConcreteAnswerSignal(value)
  ) || /\bit depends\b|\bmaybe\b|\bsomething that could help\b|\bwe can talk more about that\b/.test(value);
}

function hasForwardProgression(currentText = "", previousText = "") {
  const current = normalize(currentText).toLowerCase();
  const previous = normalize(previousText).toLowerCase();
  if (!current) return false;
  if (hasConcreteAnswerSignal(current)) return true;
  if (inferConcernFamily(current) !== inferConcernFamily(previous)) return true;
  return overlapScore(current, previous) < 0.65;
}

function classifyRepIntent(text = "") {
  const value = normalize(text).toLowerCase();
  if (!value) return "none";
  if (/\bwould you be open\b|\bnext step\b|\bflag the chart\b|\breview it together\b/.test(value)) return "commitment";
  if (/\?$/.test(value)) return "question";
  if (/\bwe're seeing\b|\bthe biggest impact\b|\bfor example\b|\bthat means\b/.test(value)) return "answer";
  if (/\bour product\b|\befficacy\b|\bmechanism\b/.test(value)) return "pitch";
  return "statement";
}

export function detectChatbotPhrasing(text = "") {
  const value = normalize(text);
  const matches = CHATBOT_PATTERNS.filter((pattern) => pattern.test(value)).map((pattern) => pattern.source);
  const overWritten = value.split(/\s+/).filter(Boolean).length > 32;
  const overExplained = /, and\b/i.test(value) && (value.match(/,/g) || []).length >= 2;
  const grounded = hasDomainAnchoring(value);
  const confidence =
    matches.length >= 2 || (matches.length >= 1 && !grounded) || (overWritten && !grounded)
      ? "high"
      : (matches.length === 1 || overExplained || overWritten)
        ? "medium"
        : "low";
  return {
    flagged: (matches.length >= 1 && !grounded) || (matches.length >= 2) || (overWritten && !grounded) || (overExplained && !grounded),
    matches,
    overWritten,
    overExplained,
    grounded,
    confidence,
  };
}

export function detectHumanClinicianCadence(text = "") {
  const value = normalize(text);
  const matches = HUMAN_CLINICIAN_PATTERNS.filter((pattern) => pattern.test(value)).length;
  return {
    score: matches,
    grounded: matches >= 1,
  };
}

export function detectJourneyStageSignal(text = "", scenario = {}) {
  const value = normalize(text);
  const entries = Object.entries(JOURNEY_SIGNAL_PATTERNS);
  let best = null;
  let bestScore = 0;
  for (const [stage, patterns] of entries) {
    const score = patterns.reduce((sum, pattern) => sum + (pattern.test(value) ? 1 : 0), 0);
    if (score > bestScore) {
      best = stage;
      bestScore = score;
    }
  }
  return best || scenario?.journeyStage || null;
}

export function detectInteractionPressureSignal(text = "", scenario = {}) {
  const value = normalize(text);
  const detected = Object.entries(PRESSURE_PATTERNS)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(value)))
    .map(([key]) => key);
  return detected.length ? detected : Array.isArray(scenario?.interactionPressure) ? scenario.interactionPressure : [];
}

export function detectEmotionalTemperature(text = "", speaker = "hcp") {
  const value = normalize(text).toLowerCase();
  if (!value) return "neutral";
  if (speaker === "rep") {
    if (/\bwould you be open\b|\bfor example\b|\bright now\b/.test(value)) return "composed";
    if (/\bwhat\b|\bhow\b|\bcan you\b/.test(value)) return "inquiring";
    return "neutral";
  }
  if (/\bnot interested\b|\bnot convinced\b|\bwhy should i\b/.test(value)) return "skeptical";
  if (/\bminute\b|\bnext patient\b|\bshort version\b/.test(value)) return "time_pressured";
  if (/\bnot sure\b|\bhelp me think through\b/.test(value)) return "guarded";
  if (/\bwould like to use\b|\bi can see it\b/.test(value)) return "open";
  return "neutral";
}

export function detectDialogueContinuityBreak({
  currentTurn,
  previousTurn,
  scenario,
  turnNumber,
  allTurns = [],
}) {
  const failures = [];
  const notes = [];
  const currentText = normalize(currentTurn?.text);
  const previousText = normalize(previousTurn?.text);
  if (!currentText) return { failures, notes };

  if (
    currentTurn?.speaker === "hcp" &&
    /you(?:'ve| have)? already|you mentioned|as you explained|like you told me/i.test(currentText) &&
    (!previousTurn || previousTurn.speaker !== "rep" || !/\befficacy\b|\bstudy\b|\bdata\b|\btrial\b/i.test(previousText))
  ) {
    failures.push({ type: "continuity_break", confidence: "high" });
    notes.push("HCP referenced prior rep content that does not appear in the immediate transcript.");
  }

  if (previousTurn && currentTurn?.speaker === previousTurn.speaker) {
    failures.push({ type: "continuity_break", confidence: "high" });
    notes.push("Speaker alternation broke unexpectedly.");
  }

  if (
    currentTurn?.speaker === "hcp" &&
    turnNumber > 2 &&
    /^\bwhat'?s this about\b/i.test(currentText)
  ) {
    failures.push({ type: "continuity_break", confidence: "medium" });
    notes.push("HCP reset to opening-stage phrasing after the conversation had already advanced.");
  }

  if (currentTurn?.speaker === "rep" && previousTurn?.speaker === "hcp") {
    const questionType = detectHcpQuestionType(previousText);
    const concernFamily = inferConcernFamily(previousText);
    const recentRepTurns = allTurns
      .filter((turn) => turn?.speaker === "rep" && turn !== currentTurn)
      .slice(-2);
    const repeatedRepQuestion = currentTurn?.concept
      ? recentRepTurns.some((turn) => turn?.concept && turn.concept === currentTurn.concept)
      : recentRepTurns.some((turn) => overlapScore(turn.text, currentText) >= 0.78);
    const repIntent = classifyRepIntent(currentText);
    const firstQuestionIndex = currentText.indexOf("?");
    const leadingClause = firstQuestionIndex >= 0 ? currentText.slice(0, firstQuestionIndex).trim() : currentText;
    const hasForwardProgress =
      hasConcreteAnswerSignal(currentText) ||
      hasConcreteAnswerSignal(leadingClause) ||
      semanticallyAnswersHcpAsk(previousText, leadingClause) ||
      (repIntent !== "question" && hasForwardProgression(currentText, previousText));
    const repeatedQuestionWithoutProgress =
      repeatedRepQuestion &&
      repIntent === "question" &&
      !hasForwardProgress;

    if (repeatedQuestionWithoutProgress) {
      failures.push({ type: "repetition_or_looping", confidence: "high" });
      notes.push("REP repeated a prior discovery path instead of advancing the exchange.");
    }

    if (
      questionType === "solution_seeking" &&
      !hasConcreteAnswerSignal(currentText) &&
      inferConcernFamily(currentText) !== concernFamily
    ) {
      failures.push({ type: "continuity_break", confidence: "high" });
      notes.push("REP shifted away from the HCP's core ask instead of staying on topic.");
    }
  }

  return { failures, notes };
}

export function detectConversationStagnation({ turns = [], currentIndex }) {
  if (currentIndex < 2) return null;
  const window = turns.slice(Math.max(0, currentIndex - 2), currentIndex + 1);
  const messages = window.map((turn) => normalize(turn?.text));
  if (messages.some((message) => !message)) return null;

  const [firstTurn, middleTurn, currentTurn] = window;

  const overlaps = [
    overlapScore(messages[0], messages[1]),
    overlapScore(messages[1], messages[2]),
  ];
  const highOverlap = overlaps.every((score) => score > 0.68);
  const noConcreteAnswer = !window.some((turn) => turn?.speaker === "rep" && hasConcreteAnswerSignal(turn?.text));
  const noForwardMove = !hasForwardProgression(messages[2], messages[1]);

  if (highOverlap && noConcreteAnswer && noForwardMove) {
    return {
      type: "conversation_stagnation",
      confidence: "high",
      note: "The last three turns looped without introducing a concrete answer or directional shift.",
    };
  }

  if (
    firstTurn?.speaker === "rep" &&
    middleTurn?.speaker === "hcp" &&
    currentTurn?.speaker === "rep" &&
    detectHcpQuestionType(middleTurn?.text || "") === "solution_seeking" &&
    overlapScore(firstTurn?.text, currentTurn?.text) > 0.62 &&
    !hasConcreteAnswerSignal(currentTurn?.text)
  ) {
    return {
      type: "conversation_stagnation",
      confidence: "high",
      note: "REP looped back to the same discovery path after a solution-seeking HCP question instead of advancing the exchange.",
    };
  }

  return null;
}

export function detectQuestionObligationFailure({ previousTurn, currentTurn }) {
  if (!previousTurn || !currentTurn) return null;
  if (previousTurn.speaker !== "hcp" || currentTurn.speaker !== "rep") return null;
  const questionType = detectHcpQuestionType(previousTurn.text || "");
  const currentText = normalize(currentTurn.text);
  const openingSentence = firstSentence(currentText);
  const firstQuestionIndex = currentText.indexOf("?");
  const leadingClause = firstQuestionIndex >= 0 ? currentText.slice(0, firstQuestionIndex).trim() : openingSentence;
  const answeredBeforeQuestion =
    Boolean(leadingClause) &&
    !startsWithQuestion(leadingClause) &&
    (semanticallyAnswersHcpAsk(previousTurn.text || "", leadingClause) || hasConcreteAnswerSignal(leadingClause));
  const repAskedAnotherQuestion = startsWithQuestion(openingSentence) && !answeredBeforeQuestion;
  const answeredFirst =
    !startsWithQuestion(openingSentence) &&
    (
      semanticallyAnswersHcpAsk(previousTurn.text || "", openingSentence) ||
      semanticallyAnswersHcpAsk(previousTurn.text || "", currentText)
    );
  const vagueAnswer = isVagueRepAnswer(currentText);
  const shiftedTopic = inferConcernFamily(previousTurn.text || "") !== "general" && inferConcernFamily(currentText) !== inferConcernFamily(previousTurn.text || "");

  if (questionType !== "solution_seeking") return null;
  if (answeredFirst || answeredBeforeQuestion) return null;

  if (repAskedAnotherQuestion) {
    return {
      type: "question_obligation_failure",
      note: "REP answered a solution-seeking HCP question with another question.",
      confidence: "high",
    };
  }
  if (!semanticallyAnswersHcpAsk(previousTurn.text || "", currentText) || vagueAnswer || shiftedTopic || isBroadRepDiscoveryQuestion(currentText)) {
    return {
      type: "question_obligation_failure",
      note: vagueAnswer
        ? "REP gave a weak answer instead of a concrete response to the HCP's solution-seeking question."
        : "REP did not provide a direct, concrete answer to the HCP's solution-seeking question.",
      confidence: vagueAnswer || shiftedTopic ? "high" : "medium",
    };
  }
  return null;
}

export function validateTurnAgainstScenarioState({
  turn,
  scenario,
  scenarioRouting,
  detectedJourneyStage,
  detectedPressures,
  tone,
}) {
  const failures = [];
  const notes = [];
  if (turn.speaker === "hcp") {
    const routing = summarizeRoutingAlignment({
      text: turn?.text || "",
      scenarioRouting,
    });

    if (routing.prohibited_topic_detected.length > 0) {
      failures.push({
        type: "journey_stage_mismatch",
        confidence: "high",
        matched_topic_lane: routing.matched_topic_lane,
        expected_topic_lanes: routing.expected_topic_lanes,
        prohibited_topic_detected: routing.prohibited_topic_detected,
        expected_stage_behavior: routing.expected_stage_behavior,
        actual_stage_behavior: routing.actual_stage_behavior,
        recommended_fix: routing.recommended_fix,
      });
      notes.push("Detected disallowed topic lane for this scenario stage.");
    }

    const journeyCheck = enforceJourneyStageBehavior({
      turn,
      scenario,
      scenarioRouting,
      matchedTopicLanes: routing.matched_topic_lanes,
      detectedJourneyStage,
    });
    if (!journeyCheck.pass) {
      failures.push({
        type: "journey_stage_mismatch",
        confidence: "medium",
        evidenceDetails: journeyCheck.evidenceDetails,
        matched_topic_lane: routing.matched_topic_lane,
        expected_topic_lanes: routing.expected_topic_lanes,
        prohibited_topic_detected: routing.prohibited_topic_detected,
        expected_stage_behavior: routing.expected_stage_behavior,
        actual_stage_behavior: routing.actual_stage_behavior,
        recommended_fix: routing.recommended_fix,
      });
      notes.push(journeyCheck.note);
    }

    const pressureCheck = enforcePressureBehavior({
      turn,
      scenario,
      detectedPressures,
      tone,
    });
    failures.push(...pressureCheck.failures);
    notes.push(...pressureCheck.notes);

    const workflowCheck = validateWorkflowPlausibility({ turn, scenario, detectedPressures });
    if (!workflowCheck.pass) {
      failures.push({ type: workflowCheck.type, confidence: workflowCheck.confidence, evidenceDetails: workflowCheck.evidenceDetails });
      notes.push(workflowCheck.note);
    }
  }
  return { failures, notes };
}

function enforceJourneyStageBehaviorWithRouting({ turn, scenario, scenarioRouting, matchedTopicLanes = [], detectedJourneyStage }) {
  const expectedJourney = normalize(scenario?.journeyStage).toLowerCase();
  const detected = normalize(detectedJourneyStage).toLowerCase();
  const allowedTopicLanes = scenarioRouting?.allowed_topic_lanes || [];
  const matchedAllowedLane = matchedTopicLanes.find((lane) => allowedTopicLanes.includes(lane));

  if (matchedAllowedLane) {
    return {
      pass: true,
      note: "",
      evidenceDetails: {
        expectedJourney,
        detectedJourney: detected,
        matchedAllowedLane,
      },
    };
  }

  if (!expectedJourney || !detected) {
    return { pass: true, note: "", evidenceDetails: {} };
  }

  if (expectedJourney === detected || isAdjacentJourneyStage(expectedJourney, detected)) {
    return {
      pass: true,
      note: "",
      evidenceDetails: {
        expectedJourney,
        detectedJourney: detected,
        toleratedAdjacency: expectedJourney !== detected,
      },
    };
  }

  return {
    pass: false,
    note: `Turn sounds like ${detected} language, but scenario is ${expectedJourney}.`,
    evidenceDetails: {
      expectedJourney,
      detectedJourney: detected,
      toleratedAdjacency: false,
    },
  };
}

export function enforceJourneyStageBehavior({ turn, scenario, scenarioRouting, matchedTopicLanes = [], detectedJourneyStage }) {
  return enforceJourneyStageBehaviorWithRouting({
    turn,
    scenario,
    scenarioRouting,
    matchedTopicLanes,
    detectedJourneyStage,
  });
}

export function enforcePressureBehavior({ turn, scenario, detectedPressures = [], tone = "neutral" }) {
  const failures = [];
  const notes = [];
  const configuredPressures = normalizePressureList(scenario);
  const detected = detectedPressures.map((pressure) => normalize(pressure).toLowerCase()).filter(Boolean);
  const message = normalize(turn?.text).toLowerCase();
  const decisionDriven = hasDecisionLogic(message);
  const subtleTimePressure = /\bshort\b|\bquick\b|\btight\b|\bbrief\b|\bmove this along\b/.test(message);

  if (configuredPressures.length && detected.length && !detected.some((pressure) => configuredPressures.includes(pressure))) {
    failures.push({
      type: "interaction_pressure_mismatch",
      confidence: "medium",
      evidenceDetails: {
        configuredPressures,
        detectedPressures: detected,
      },
    });
    notes.push("Turn pressure signal does not match configured scenario pressure.");
  }

  if (configuredPressures.includes("skeptical_resistant") && tone === "open") {
    failures.push({
      type: "weak_skepticism",
      confidence: "medium",
      evidenceDetails: { configuredPressures, detectedTone: tone },
    });
    notes.push("HCP sounds too open for a skeptical/resistant exchange.");
  }

  if (
    configuredPressures.includes("time_constrained") &&
    !detected.includes("time_constrained") &&
    !decisionDriven &&
    !subtleTimePressure
  ) {
    failures.push({
      type: "interaction_pressure_mismatch",
      confidence: "medium",
      evidenceDetails: {
        configuredPressures,
        detectedPressures: detected,
        subtleTimePressure,
      },
    });
    notes.push("Time-constrained scenario lost time-pressure language.");
  }

  return { failures, notes };
}

export function validateWorkflowPlausibility({ turn, scenario, detectedPressures = [] }) {
  const configuredPressures = normalizePressureList(scenario);
  const detected = detectedPressures.map((pressure) => normalize(pressure).toLowerCase());
  const text = normalize(turn?.text || "");
  const hasWorkflowAnchor = WORKFLOW_PATTERNS.some((pattern) => pattern.test(text));
  const hasAccessAnchor = ACCESS_PATTERNS.some((pattern) => pattern.test(text));

  if (configuredPressures.includes("operationally_constrained") && !hasWorkflowAnchor) {
    return {
      pass: false,
      type: "workflow_implausible",
      confidence: "medium",
      note: "Operationally constrained HCP did not sound staff/workflow aware.",
      evidenceDetails: { configuredPressures, detectedPressures: detected, hasWorkflowAnchor },
    };
  }

  if (configuredPressures.includes("access_barrier") && !hasAccessAnchor) {
    return {
      pass: false,
      type: "access_implausible",
      confidence: "medium",
      note: "Access-barrier scenario did not surface access/formulary language.",
      evidenceDetails: { configuredPressures, detectedPressures: detected, hasAccessAnchor },
    };
  }

  return { pass: true, type: null, confidence: "low", note: "", evidenceDetails: { hasWorkflowAnchor, hasAccessAnchor } };
}

export function validatePersonaFit({ turn, scenario, humanCadence, decisionDriven = false, personaCadence = false }) {
  const rawMessage = normalize(turn?.text || "");
  const persona = String(scenario?.persona || "").toLowerCase();
  const grounded = Boolean(humanCadence?.grounded) || decisionDriven || personaCadence;

  if (!grounded) {
    return {
      pass: false,
      type: "poor_persona_fit",
      confidence: "high",
      note: "Line lacks clinician/workflow/context anchors.",
      evidenceDetails: { grounded, persona },
    };
  }

  if (persona.includes("community") && !/practice|patients|staff|office|workflow|formulary|prior auth|guideline/i.test(rawMessage)) {
    return {
      pass: false,
      type: "poor_specialty_fit",
      confidence: "medium",
      note: "Line lacks the concrete practice framing expected for this persona.",
      evidenceDetails: { persona },
    };
  }

  return { pass: true, type: null, confidence: "low", note: "", evidenceDetails: { persona } };
}

export function validateTransitionBetweenTurns({ previousTurn, currentTurn }) {
  const failures = [];
  const notes = [];
  if (!previousTurn || !currentTurn) return { failures, notes };

  if (
    previousTurn.speaker === "hcp" &&
    currentTurn.speaker === "hcp"
  ) {
    failures.push("continuity_break");
    notes.push("Two HCP turns occurred without a REP response.");
  }

  if (
    previousTurn.speaker === "hcp" &&
    currentTurn.speaker === "rep" &&
    normalize(previousTurn.text) === normalize(currentTurn.text)
  ) {
    failures.push("repetition_or_looping");
    notes.push("REP repeated the HCP wording instead of advancing the exchange.");
  }

  if (
    previousTurn.speaker === "hcp" &&
    currentTurn.speaker === "hcp"
  ) {
    failures.push("unearned_tone_shift");
    notes.push("HCP tone shifted without a REP turn to earn it.");
  }

  return { failures, notes };
}

function collectFailure(failures, turnNumber, type, evidence, note) {
  failures.push({
    turnNumber,
    type,
    evidence,
    note,
    confidence: "medium",
  });
}

function addCounts(counts, type) {
  counts[type] = (counts[type] || 0) + 1;
}

function deriveTopCorrections(failureCounts = {}) {
  return Object.entries(failureCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => type.replace(/_/g, " "));
}

export function buildTranscriptAudit({ scenario, turns = [], personaKey = "" }) {
  const transcript = [];
  const failureCounts = {};
  const failures = [];
  const scenarioRouting = buildScenarioRouting(scenario);

  turns.forEach((turn, index) => {
    const previousTurn = index > 0 ? turns[index - 1] : null;
    const turnNumber = index + 1;
    const rawMessage = normalize(turn.text);
    const detectedIntent =
      turn.speaker === "hcp"
        ? detectHcpQuestionType(rawMessage)
        : classifyRepIntent(rawMessage);
    const detectedTone = detectEmotionalTemperature(rawMessage, turn.speaker);
    const detectedJourneyStage = detectJourneyStageSignal(rawMessage, scenario);
    const detectedPressures = detectInteractionPressureSignal(rawMessage, scenario);
    const matchedTopicLanes = detectTopicLanes(rawMessage);

    const continuity = detectDialogueContinuityBreak({
      currentTurn: turn,
      previousTurn,
      scenario,
      turnNumber,
      allTurns: turns.slice(0, index + 1),
    });
    const stateValidation = validateTurnAgainstScenarioState({
      turn,
      scenario,
      scenarioRouting,
      detectedJourneyStage,
      detectedPressures,
      tone: detectedTone,
    });
    const transitionValidation = validateTransitionBetweenTurns({ previousTurn, currentTurn: turn });
    const chatbot = detectChatbotPhrasing(rawMessage);
    const humanCadence = detectHumanClinicianCadence(rawMessage);
    const obligationFailure = detectQuestionObligationFailure({ previousTurn, currentTurn: turn });
    const stagnationFailure = detectConversationStagnation({ turns, currentIndex: index });

    const realismNotes = [];
    const continuityNotes = [...continuity.notes, ...stateValidation.notes, ...transitionValidation.notes];
    const turnFailures = [];

    if (turn.speaker === "hcp") {
      if (chatbot.flagged) {
        if (chatbot.matches.length) {
          turnFailures.push("chatbot_phrasing");
          realismNotes.push(`Chatbot-like markers: ${chatbot.matches.join(", ")}`);
        }
        if (chatbot.overWritten) {
          turnFailures.push("over_written");
          realismNotes.push("Line is overly long or written for natural spoken cadence.");
        }
        if (chatbot.overExplained) {
          turnFailures.push("over_explained");
          realismNotes.push("Line is overly balanced or over-explained.");
        }
      }
      const decisionDriven = hasDecisionLogic(rawMessage);
      const personaCadence = hasPersonaDecisionCadence(rawMessage);
      const personaFit = validatePersonaFit({
        turn,
        scenario,
        humanCadence,
        decisionDriven,
        personaCadence,
      });
      if (!personaFit.pass && personaFit.type) {
        turnFailures.push(personaFit.type);
        realismNotes.push(personaFit.note);
      }
      if (ABRUPT_OPENING_PATTERNS.some((pattern) => pattern.test(rawMessage)) || SHARP_PHRASE_PATTERNS.some((pattern) => pattern.test(rawMessage))) {
        turnFailures.push("abrupt_rudeness_without_basis");
        realismNotes.push("Opening tone is too abrupt for a professional clinician entry.");
      }
      if (scenario?.journeyStage === "clinical_value" && !CLINICAL_PATTERNS.some((pattern) => pattern.test(rawMessage))) {
        turnFailures.push("clinical_implausible");
        realismNotes.push("Clinical-value turn lacks evidence/clinical decision language.");
      }
    } else {
      if (obligationFailure) {
        turnFailures.push(obligationFailure.type);
        continuityNotes.push(obligationFailure.note);
        if (/weak answer/i.test(obligationFailure.note)) {
          turnFailures.push("weak_answer");
        }
      }
      if (
        previousTurn?.speaker === "hcp" &&
        detectHcpQuestionType(previousTurn.text || "") === "solution_seeking" &&
        classifyRepIntent(rawMessage) === "question"
      ) {
        turnFailures.push("question_obligation_failure");
      }
      if (/\bhelp me understand\b|\bwhat specific aspects\b|\bcan you elaborate\b/i.test(rawMessage)) {
        turnFailures.push("over_written");
        realismNotes.push("REP fell back to broad discovery language instead of a concrete response.");
      }
    }

    if (stagnationFailure) {
      turnFailures.push(stagnationFailure.type);
      continuityNotes.push(stagnationFailure.note);
    }

    [
      ...continuity.failures,
      ...stateValidation.failures.map((failure) => (typeof failure === "string" ? { type: failure, confidence: "medium" } : failure)),
      ...transitionValidation.failures.map((failure) => (typeof failure === "string" ? { type: failure, confidence: "medium" } : failure)),
    ].forEach((failure) => {
      turnFailures.push(typeof failure === "string" ? failure : failure.type);
    });

    const uniqueTurnFailures = [...new Set(turnFailures)];
    uniqueTurnFailures.forEach((type) => {
      addCounts(failureCounts, type);
      const confidence =
        obligationFailure?.type === type ? obligationFailure.confidence :
          stagnationFailure?.type === type ? stagnationFailure.confidence :
            continuity.failures.find((item) => item.type === type)?.confidence ||
            (type === "chatbot_phrasing" ? chatbot.confidence : "medium");
      const severity = classifyFailureSeverity(type, confidence);
      failures.push({
        turnNumber,
        type,
        evidence: buildEvidenceSnippet(rawMessage),
        failure_type: type,
        evidenceDetails: {
          detectedIntent,
          detectedTone,
          detectedJourneyStage,
          detectedPressures,
          matchedTopicLanes,
          expectedTopicLanes: scenarioRouting.allowed_topic_lanes,
          disallowedTopicLanes: scenarioRouting.disallowed_topic_lanes,
          scenarioJourneyStage: scenario?.journeyStage || null,
          scenarioInteractionPressure: normalizePressureList(scenario),
        },
        matched_topic_lane: matchedTopicLanes[0] || "general",
        expected_topic_lanes: scenarioRouting.allowed_topic_lanes,
        prohibited_topic_detected: matchedTopicLanes.filter((lane) => scenarioRouting.disallowed_topic_lanes.includes(lane)),
        expected_stage_behavior: scenarioRouting.stage_behavior_rules,
        actual_stage_behavior: matchedTopicLanes.length ? matchedTopicLanes : ["general"],
        recommended_fix: "Keep the next turn in an allowed topic lane for the configured stage and pressure.",
        note: [...realismNotes, ...continuityNotes].join(" "),
        confidence,
        severity,
      });
    });

    transcript.push({
      turnNumber,
      speaker: turn.speaker,
      rawMessage,
      detectedIntent,
      detectedTone,
      detectedJourneyStage,
      detectedPressures,
      continuityNotes,
      realismNotes,
      failures: uniqueTurnFailures,
      personaKey,
    });
  });

  const highConfidenceFailures = failures.filter((failure) => failure.confidence === "high");
  const severityCounts = failures.reduce((acc, failure) => {
    const severity = failure.severity || "minor";
    acc[severity] = (acc[severity] || 0) + 1;
    return acc;
  }, { blocking: 0, major: 0, minor: 0 });
  const hardStopFailureTypes = new Set(["question_obligation_failure", "continuity_break", "conversation_stagnation"]);
  const hasBlockingFailure = failures.some((failure) => failure.severity === "blocking");
  const hasHardStopFailure = hasBlockingFailure || highConfidenceFailures.some((failure) => hardStopFailureTypes.has(failure.type));
  const hasConcreteRepAnswer = turns.some((turn) => turn?.speaker === "rep" && hasConcreteAnswerSignal(turn?.text));
  const hasForwardProgressionObserved = turns.some((turn, index) =>
    index > 0 &&
    turn?.speaker === "rep" &&
    hasForwardProgression(turn?.text, turns[index - 1]?.text)
  );
  const hasHcpEvolution = turns.some((turn, index) =>
    index > 1 &&
    turn?.speaker === "hcp" &&
    detectEmotionalTemperature(turn?.text, "hcp") !== detectEmotionalTemperature(turns[index - 2]?.text, "hcp")
  );
  const pass = !hasHardStopFailure && highConfidenceFailures.length === 0 && (hasConcreteRepAnswer || hasForwardProgressionObserved || hasHcpEvolution);
  const realismFailures = failures.filter((failure) =>
    ["chatbot_phrasing", "over_written", "over_explained", "weak_skepticism", "wrong_emotional_temperature", "poor_persona_fit", "poor_specialty_fit", "workflow_implausible", "access_implausible", "clinical_implausible", "abrupt_rudeness_without_basis"].includes(failure.type)
  );
  const continuityFailures = failures.filter((failure) =>
    ["continuity_break", "question_obligation_failure", "repetition_or_looping", "unearned_tone_shift"].includes(failure.type)
  );

  return {
    verdict: pass ? "PASS" : "FAIL",
    transcript,
    failures,
    highConfidenceFailures,
    failureCounts,
    severityCounts,
    rootCauseClassification: buildRootCauseClassification(failures),
    realismSummary: realismFailures.length
      ? `${realismFailures.length} realism issue(s) flagged with transcript evidence.`
      : "No realism failures detected in the transcript.",
    continuitySummary: continuityFailures.length
      ? `${continuityFailures.length} continuity/dialogue-flow issue(s) flagged with transcript evidence.`
      : "No continuity failures detected in the transcript.",
    stateAlignmentSummary: failures.some((failure) =>
      ["journey_stage_mismatch", "interaction_pressure_mismatch", "wrong_emotional_temperature"].includes(failure.type)
    )
      ? "Turn-level state alignment drift was detected."
      : "Journey, pressure, and tone alignment remained within expected bounds.",
    topCorrections: deriveTopCorrections(failureCounts),
    calibrationCases: runInternalAuditCalibrationCases(),
  };
}

export function runInternalAuditCalibrationCases() {
  const case1 = detectQuestionObligationFailure({
    previousTurn: { speaker: "hcp", text: "What specifically would cut down paperwork?" },
    currentTurn: { speaker: "rep", text: "Where is the biggest roadblock right now?" },
  });

  const case2 = detectQuestionObligationFailure({
    previousTurn: { speaker: "hcp", text: "What specifically would cut down paperwork?" },
    currentTurn: { speaker: "rep", text: "Right now, the clearest gain is fewer callback loops for your staff. For example, that means a cleaner prior auth handoff before the case gets recycled." },
  });

  const case3 = detectQuestionObligationFailure({
    previousTurn: { speaker: "hcp", text: "Which patients are the hardest to keep on therapy right now?" },
    currentTurn: { speaker: "rep", text: "Which patients are falling off first in your practice?" },
  });

  const case4 = detectQuestionObligationFailure({
    previousTurn: { speaker: "hcp", text: "What specifically would cut down paperwork?" },
    currentTurn: { speaker: "rep", text: "Right now, the clearest gain is fewer callback loops for your staff. For example, that means a cleaner prior auth handoff before the case gets recycled. Which part of the process is heaviest today?" },
  });

  const case5 = detectConversationStagnation({
    turns: [
      { speaker: "rep", text: "What is the biggest roadblock right now with the prior auth process?" },
      { speaker: "hcp", text: "What's the one thing that would make prior auth easier for my staff?" },
      { speaker: "rep", text: "What is the biggest roadblock or challenge right now with prior auth?" },
    ],
    currentIndex: 2,
  });

  const case6 = detectConversationStagnation({
    turns: [
      { speaker: "rep", text: "What is the biggest roadblock right now with the prior auth process?" },
      { speaker: "hcp", text: "What's the one thing that would make prior auth easier for my staff?" },
      { speaker: "rep", text: "Right now, the clearest gain is fewer callback loops for your staff. For example, that means a cleaner prior auth handoff before the case gets recycled." },
    ],
    currentIndex: 2,
  });

  return [
    {
      id: "case_1",
      label: "solution-seeking HCP question + REP asks another question",
      expected: "FAIL",
      actual: case1?.type === "question_obligation_failure" && case1?.confidence === "high" ? "FAIL" : "PASS",
    },
    {
      id: "case_2",
      label: "solution-seeking HCP question + REP gives direct concrete answer",
      expected: "PASS",
      actual: case2 ? "FAIL" : "PASS",
    },
    {
      id: "case_3",
      label: "neutral discovery HCP question + REP asks appropriate discovery question",
      expected: "PASS",
      actual: case3 ? "FAIL" : "PASS",
    },
    {
      id: "case_4",
      label: "solution-seeking HCP question + REP answers concretely then narrows",
      expected: "PASS",
      actual: case4 ? "FAIL" : "PASS",
    },
    {
      id: "case_5",
      label: "REP repeats discovery question twice",
      expected: "FAIL",
      actual: case5?.type === "conversation_stagnation" && case5?.confidence === "high" ? "FAIL" : "PASS",
    },
    {
      id: "case_6",
      label: "conversation advances with a concrete answer",
      expected: "PASS",
      actual: case6 ? "FAIL" : "PASS",
    },
  ];
}

export function buildMatrixAuditSummary(results = []) {
  const failureCounts = {};
  const perScenario = [];
  const perPersona = {};

  results.forEach((result) => {
    const qa = result.qaAudit;
    perScenario.push({
      scenarioId: result.scenario.id,
      scenarioTitle: result.scenario.title,
      personaKey: result.personaKey,
      verdict: qa?.verdict || "FAIL",
      topFailures: Object.entries(qa?.failureCounts || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key]) => key),
    });

    const personaBucket = perPersona[result.personaKey] || { pass: 0, fail: 0 };
    if ((qa?.verdict || "FAIL") === "PASS") personaBucket.pass += 1;
    else personaBucket.fail += 1;
    perPersona[result.personaKey] = personaBucket;

    Object.entries(qa?.failureCounts || {}).forEach(([type, count]) => {
      failureCounts[type] = (failureCounts[type] || 0) + count;
    });
  });

  return {
    failureCounts,
    perScenario,
    perPersona,
    topRecurringRealismFailures: Object.entries(failureCounts)
      .filter(([type]) => ["chatbot_phrasing", "over_written", "over_explained", "weak_skepticism", "poor_persona_fit", "poor_specialty_fit", "workflow_implausible", "access_implausible", "clinical_implausible", "abrupt_rudeness_without_basis"].includes(type))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    topRecurringContinuityFailures: Object.entries(failureCounts)
      .filter(([type]) => ["continuity_break", "question_obligation_failure", "repetition_or_looping", "unearned_tone_shift", "journey_stage_mismatch", "interaction_pressure_mismatch"].includes(type))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
  };
}
