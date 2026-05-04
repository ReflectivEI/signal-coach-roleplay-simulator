import { invokeWorkerText } from "./../services/workerClient.js";
import { humanizeRepResponse } from "./repHumanizer.js";
import {
  buildScenarioRouting,
  detectTopicLanes,
  scrubStaleFallbackPhrases,
} from "./scenarioRouting";

const DIRECT_ANSWER_TRIGGER = /show me data|need data|specific data|evidence|moderate renal impairment|renal impairment|renal dosing|egfr|multiple comorbidit|subgroup|excluded patient|real-world fit|workflow|what changes|what gets added|what staff|what does that add|what's the point|bottom line|operational|guideline|what am i missing|cost savings|justify the cost|readmissions|metrics|prior auth|prior authorization|specific outcomes|what outcomes|own patient population|my own population|what exactly|exact guideline language|one proof point|one key point|what specifically changes|what caused|what step gets added|biomarker|threshold|analysis|comorbidit|total cost per patient|cost per patient|what's included|what is included|what does that include|break down/i;
const INITIAL_ACCESS_DIRECT_ASK_PATTERN = /what'?s this about|what is this about|why are we talking|why are you here|make this quick|can you make this quick|short version|few minutes|what do you need from me|what'?s the one thing you need to know|one thing you need to know|what's the relevance|what is the relevance|relevant to my practice|relevant to my clinic|what makes this relevant|what sets your product apart|what's the one thing that could slow care|one thing that could slow care|what specific barrier|what barrier are you looking for|what makes you think|what specific access step|what specific change/i;
const EXPECTATION_MISMATCH_PATTERN = /dr\.|patel|case discussion|case consult|referral|thought this was|was going to be|was supposed to be/i;
const INITIAL_ACCESS_OPERATIONAL_HELP_PATTERN = /prior auth|prior authorization|streamline|staff|workflow|paperwork|callbacks|extra step|operational/i;
const INITIAL_ACCESS_REDISCOVERY_PATTERN = /want to make sure i understand|help me understand|what'?s specifically frustrating|what is specifically frustrating|what'?s frustrating|what is frustrating|walk me through the workflow|where does it break|what part slows you down/i;
const ACCESS_PROCESS_DEMAND_PATTERN = /formulary|committee|review process|step therapy|non-preferred|what would move|what would change|take back|carry forward|prior auth|prior authorization|what staff|what gets added|what step/i;
const WORKFLOW_DEMAND_PATTERN = /workflow|staff|monitoring|follow-up|what happens next|who picks that up|who owns that|extra step|what does that add/i;
const WORKFLOW_REDISCOVERY_PATTERN = /what's a typical day|how do you currently|where do you think we could make the biggest impact|fit into your existing workflow|what part of the follow-up|what part of the monitoring|what would actually land on your team/i;
const CLOSE_PROOF_POINT_PATTERN = /proof point|concrete outcome|single data point|patient outcome|concrete|metric|what changes my patient outcome|what changes for my patients|changes practice|specific analysis|what analysis|most vulnerable patients|hospitalization rates|actual reduction|tangible impact/i;
const EVIDENCE_PROOF_ASK_PATTERN = /proof point|single data point|what data point|one data point|single metric|one metric|one number|specific evidence|what evidence|what analysis|subgroup|change treatment choice|change treatment|real decision|what outcome would|convince me/i;
const DISCOVERY_DIRECT_ASK_PATTERN = /what patient characteristics|what patient type|which patients|good fit|ideal patient profile|define a good fit|what are you using to define|who are you actually talking about|what kind of patient|relevant to my patients|relevance to my patients|what makes you think your treatment is relevant|non-responders|not responding to current therapy|responding to current therapy|what specifically would change|patients i'm actually struggling with|not just theoretically eligible|patient profile that would make me switch|make me switch|specific patient subgroup|what subgroup|which subgroup|subgroup would actually benefit|specific subgroup|clinical gain|what benefit|what's distinct|what makes it distinct|what specific outcome would change|what outcome would change|change my treatment approach|what makes this patient different|this patient would be any different|change this patient'?s treatment|make me change this patient'?s treatment/i;
const BROAD_DISCOVERY_PATTERN = /\?|^can you\b|^could you\b|^would you\b|help me understand|elaborate on|tell me more about|what specific/i;
const ABSTRACT_QA_LANGUAGE_PATTERN = /critical consideration|significant limitation|primary concern|specific patient population|discussion should focus|treatment landscape|clinical outcomes|align with your concerns|economic concerns|consideration in treatment decisions/i;
const OVER_EXPLANATORY_PATTERN = /would be|which can be|ensure they'?re on track|minimal disruption|incorporated into your existing workflow|in order to|would likely be|that would help/i;
const DISCOVERY_LOOP_PATTERN = /^(can i ask|tell me more|how are you thinking about|what would you need to see|help me understand|walk me through|can you share|how do you currently|where do you think)/i;

const DIRECT_ASK_TYPES = {
  asks_for_concrete_difference: /what(?:'s| is)? (?:concretely )?different|what changes|bottom line|what's the point|what does that actually change|what would actually be different/i,
  asks_for_workflow_impact: /workflow|staff|team|ma\b|what gets added|what does that add|tomorrow|operational|handoff|callback|process/i,
  asks_for_access_step: /access|coverage|prior auth|prior authorization|formulary|approval|payer|step therapy|committee|pathway step|need.{0,20}\baccess step\b|\baccess step\b|what.{0,15}step|specific.{0,15}step/i,
  asks_for_evidence_relevance: /evidence|data|real-?world|subgroup|excluded|patient population|relevant to my patients|own population|analysis/i,
  asks_for_guideline_fit: /guideline|pathway|standard of care|protocol|fits in guideline/i,
  asks_for_safety_clarity: /safety|risk|adverse|hepatic|contraind|monitoring concern|tolerability/i,
  asks_for_next_step: /what happens next|next step|who owns|would you be open|what do i do next|what should we do now/i,
  disengagement_boundary: /stop here|pause here|not discussing this now|leave it there|send (?:the|it) over|no further|not moving this forward/i,
};

function mapAskToAnswerMode(askType = "") {
  switch (askType) {
    case "asks_for_workflow_impact":
      return "workflow_specific_answer";
    case "asks_for_access_step":
      return "access_step_answer";
    case "asks_for_evidence_relevance":
      return "evidence_fit_answer";
    case "asks_for_guideline_fit":
      return "guideline_fit_answer";
    case "asks_for_safety_clarity":
      return "safety_clarity_answer";
    case "asks_for_next_step":
      return "next_step_answer";
    case "disengagement_boundary":
      return "boundary_acknowledgment";
    default:
      return "direct_difference_answer";
  }
}

function mapAskToAnchor(askType = "") {
  switch (askType) {
    case "asks_for_workflow_impact":
      return "workflow";
    case "asks_for_access_step":
      return "access";
    case "asks_for_evidence_relevance":
      return "evidence";
    case "asks_for_guideline_fit":
      return "guideline";
    case "asks_for_safety_clarity":
      return "safety";
    case "asks_for_next_step":
      return "next_step";
    case "disengagement_boundary":
      return "boundary";
    default:
      return "concrete_difference";
  }
}

function getLastHcpText(turns = []) {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (turns[i]?.speaker === "hcp" && typeof turns[i]?.text === "string") {
      return turns[i].text.trim();
    }
  }
  return "";
}

function getActiveConcernText(turns = [], scenario = {}) {
  return getLastHcpText(turns) || String(scenario?.openingScene || "").trim();
}

function getLastRepText(turns = []) {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (turns[i]?.speaker === "rep" && typeof turns[i]?.text === "string") {
      return turns[i].text.trim();
    }
  }
  return "";
}

export function detectHcpQuestionType(lastHcpMessage = "") {
  const text = normalizeForMatch(lastHcpMessage);
  if (!text || !text.includes("?")) return "none";

  if (
    /what would|what specifically|what'?s the one thing|how would|what can you do|give me|what does your product|what changes|what gets added|what step|what would actually|what does that actually|what does this actually|what is the actual process|what's the actual process/.test(text)
  ) {
    return "solution_seeking";
  }

  if (
    /what do you mean|when you say|can you clarify|clarify|what are you referring to|which one do you mean/.test(text)
  ) {
    return "clarification";
  }

  if (
    /which patients|what kind of patient|what are you seeing|how do you decide|where do you draw the line|tell me more about/.test(text)
  ) {
    return "discovery";
  }

  return "none";
}

export function detectHcpDirectAsk(hcpText = "") {
  const text = normalizeForMatch(hcpText);
  if (!text) {
    return {
      hasDirectAsk: false,
      askType: "none",
      requiredAnswerMode: "none",
      requiredAnchor: "none",
    };
  }

  const hasQuestionSignal = text.includes("?")
    || /(?:^|[.!?]\s+)(show|tell|name|give|walk me through|explain|be specific)\b/.test(text)
    || /\b(need to know|need to understand|need the|need a)\b/.test(text);
  let askType = "none";
  for (const [type, pattern] of Object.entries(DIRECT_ASK_TYPES)) {
    if (pattern.test(text)) {
      askType = type;
      break;
    }
  }

  if (askType === "none" || (!hasQuestionSignal && askType !== "disengagement_boundary")) {
    return {
      hasDirectAsk: false,
      askType: "none",
      requiredAnswerMode: "none",
      requiredAnchor: "none",
    };
  }

  return {
    hasDirectAsk: true,
    askType,
    requiredAnswerMode: mapAskToAnswerMode(askType),
    requiredAnchor: mapAskToAnchor(askType),
  };
}

export function evaluateRepAnswerToHcpAsk({
  hcpAsk,
  repResponse,
  scenarioRouting,
  scenarioAnchors = [],
}) {
  const ask = typeof hcpAsk === "object" && hcpAsk !== null
    ? hcpAsk
    : detectHcpDirectAsk(String(hcpAsk || ""));
  const hcpText = typeof hcpAsk === "object" && hcpAsk !== null
    ? String(hcpAsk?.text || "")
    : String(hcpAsk || "");
  const response = String(repResponse || "").trim();
  const normalized = normalizeForMatch(response);
  const openingSentence = response.match(/^(.+?[.?!])(?:\s|$)/)?.[1]?.trim() || response;
  const responseStartsWithQuestion = /^(what|how|why|where|when|who|can|could|would|should|is|are|do|does|did)\b/i.test(openingSentence) || /^.+\?$/.test(openingSentence);
  const loopedBackToDiscovery = DISCOVERY_LOOP_PATTERN.test(openingSentence);
  const semAnswer = semanticallyAnswersHcpAsk(hcpText, openingSentence || response);

  const concernPatterns = {
    workflow: /workflow|staff|ma\b|handoff|callback|step|process|team|office/i,
    access: /access|coverage|prior auth|prior authorization|formulary|approval|payer|committee|pathway/i,
    evidence: /evidence|data|subgroup|analysis|population|real-?world|outcome/i,
    guideline: /guideline|pathway|standard of care|protocol/i,
    safety: /safety|risk|adverse|hepatic|monitoring|tolerability/i,
    next_step: /next step|would you be open|who owns|move forward|pilot|review one/i,
    boundary: /understood|we can pause|we can stop|send over|revisit later/i,
    concrete_difference: /changes|different|instead of|main change|practical change|specific difference/i,
  };
  const requiredPattern = concernPatterns[ask.requiredAnchor] || concernPatterns.concrete_difference;
  const matchedLanes = Array.isArray(scenarioRouting?.allowed_topic_lanes)
    ? detectTopicLanes(response).filter((lane) => scenarioRouting.allowed_topic_lanes.includes(lane))
    : [];
  const anchorMatched = requiredPattern.test(response)
    || (Array.isArray(scenarioAnchors) && scenarioAnchors.some((anchor) => {
      const anchorText = normalizeForMatch(anchor);
      if (!anchorText) return false;
      return anchorText.split(" ").some((token) => token.length >= 4 && normalized.includes(token));
    }));

  const stayedOnConcern = anchorMatched || matchedLanes.length > 0;
  const answeredDirectly = !responseStartsWithQuestion
    && semAnswer
    && (stayedOnConcern || hasSemanticSpecificitySignal(openingSentence || response));
  const includedConcreteSpecificity = hasSemanticSpecificitySignal(response)
    || hasShortDirectOperationalResolution(response)
    || /(specifically|exactly|one step|first step|owner|for your staff|for this patient|for guideline placement)/i.test(response);
  const advancedExchange = /(next step|would you be open|if that is true|then the step is|so we can|to move this forward|decision threshold|what would change your mind)/i.test(response)
    || (answeredDirectly && includedConcreteSpecificity)
    || ask.askType === "disengagement_boundary";

  let failureReason = "none";
  if (loopedBackToDiscovery && !answeredDirectly) failureReason = "looped_back_to_discovery";
  else if (!answeredDirectly) failureReason = "did_not_answer_directly";
  else if (!stayedOnConcern) failureReason = "shifted_off_concern";
  else if (!includedConcreteSpecificity) failureReason = "missing_specificity";
  else if (!advancedExchange) failureReason = "did_not_advance_exchange";

  return {
    answeredDirectly,
    stayedOnConcern,
    includedConcreteSpecificity,
    advancedExchange,
    loopedBackToDiscovery,
    failureReason,
  };
}

export function buildRepAnswerFirstPromptConstraint(lastHcpMessage = "") {
  const questionType = detectHcpQuestionType(lastHcpMessage);
  if (questionType !== "solution_seeking") return "";

  return `\nADDITIONAL REP CONTRACT:\nYou MUST directly answer the HCP's question with a concrete, specific response before asking anything else. Do NOT ask another discovery question.`;
}

function normalizeForMatch(text = "") {
  return String(text || "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeDialoguePunctuation(text = "") {
  return String(text || "")
    .replace(/\bMy question is always the same\.\s+For the\b/g, "For the")
    .replace(/\bI keep coming back to the same question\.\s+For the\b/g, "For the")
    .replace(/\bI still need to understand\s+for the patients who would actually use this,\s*/gi, "For the patients who would actually use this, ")
    .replace(/\bMy question is always the same\b/g, "I still need to understand")
    .replace(/\bI keep coming back to the same question\b/g, "I still need to understand")
    .replace(/\bI still need to understand:\s*/g, "I still need to understand ")
    .replace(/\bThe practical test is whether\b/g, "I need to see whether")
    .replace(/\bThe useful answer is whether\b/g, "I need to know whether")
    .replace(/\bThe useful answer is the\b/g, "The")
    .replace(/\bThe useful answer is an\b/g, "An")
    .replace(/\bThe useful answer is\b/g, "What matters is")
    .replace(/\bThe direct answer is that\b/g, "")
    .replace(/\bThe direct answer is\b/g, "")
    .replace(/\bThe unresolved issue is still\b/g, "What is still unresolved is")
    .replace(/\bThe unresolved issue is\b/g, "What is unresolved is")
    .replace(/\bThe unresolved piece is still\b/g, "What is still unresolved is")
    .replace(/\bThe unresolved piece is\b/g, "What is unresolved is")
    .replace(/\bWhat is still unresolved is\b/g, "I still don't have")
    .replace(/\bWhat is unresolved is\b/g, "I still don't have")
    .replace(/\bRight now the unresolved number is\b/g, "What is still missing is")
    .replace(/\bThe one change that should matter in the room is\b/g, "What should change in the room is")
    .replace(/\bThen the standard has to stay concrete\b/g, "It has to stay concrete")
    .replace(/\bThen the answer has to stay operational\b/g, "It has to stay operational")
    .replace(/\bThen the practical value has to be operational, not promotional\b/g, "This has to be operational, not promotional")
    .replace(/\bThen the decision today stays unchanged\b/g, "The decision today stays unchanged")
    .replace(/\bThen the decision today is not to treat\b/g, "The decision today is not to treat")
    .replace(/\bThen the plan has to stay on\b/g, "The plan has to stay on")
    .replace(/\bThen the one piece would have to be\b/g, "The one piece would have to be")
    .replace(/\bThen the one piece has to be\b/g, "The one piece has to be")
    .replace(/\bThen the one metric has to be\b/g, "The one metric has to be")
    .replace(/\bThen the subgroup analysis itself has to show\b/g, "The subgroup analysis itself has to show")
    .replace(/\bThen the proof point would have to be\b/g, "The proof point would have to be")
    .replace(/\bThen the proof point has to show\b/g, "The proof point has to show")
    .replace(/\bThen the threshold would have to\b/g, "The threshold would have to")
    .replace(/\bThen the concrete standard is\b/g, "The concrete standard is")
    .replace(/\bThen the practical change has to happen\b/g, "The practical change has to happen")
    .replace(/\bThe real question is\b/g, "I still need to understand")
    .replace(/\bIf the real blocker is\b/g, "If that's really the sticking point,")
    .replace(/\bIf the blocker is\b/g, "If that's the sticking point,")
    .replace(/\bThe one thing to know is whether\b/g, "What I need to know is whether")
    .replace(/\bThe one thing I need to know is whether\b/g, "What I need to know is whether")
    .replace(/\bThe one thing that usually slows care is\b/g, "What usually slows care is")
    .replace(/\bThe one step that should save time is\b/g, "The step that should save time is")
    .replace(/\bThe only reason this matters is if\b/g, "This only matters if")
    .replace(/\bThe only reason to keep talking is if\b/g, "The only reason to keep talking is if")
    .replace(/\bThe only useful next move is\b/g, "The next useful move is")
    .replace(/\bThe only useful discussion now is\b/g, "The useful discussion now is")
    .replace(/\bThe only workable version is\b/g, "The workable version is")
    .replace(/\bThe main question is whether\b/g, "What matters is whether")
    .replace(/\bI need to see whether:\s*/g, "I need to see whether ")
    .replace(/\bI need to know whether:\s*/g, "I need to know whether ")
    .replace(/\b(Then the standard has to stay concrete|Then the answer has to stay operational|Then the practical value has to be operational, not promotional|The direct answer is that|The useful answer is|The practical test is|The unresolved issue is|The unresolved piece is|Right now the unresolved number is|The one change that should matter in the room|That is the gap)\s*:\s*/g, "$1. ")
    .replace(/\b(it only helps if|the concrete change would have to be)\s*:\s*/g, "$1 ")
    .replace(/,\s*then\s+/gi, ", ")
    .replace(/\bIf ([^.!?]{10,120}?), that's the number I still need\b/g, "If $1, that's the number I still need")
    .replace(/\bIf ([^.!?]{10,140}?), I still\b/g, "If $1, I still")
    .replace(/\bIf ([^.!?]{10,160}?), it still\b/g, "If $1, it still")
    .replace(/\bIf ([^.!?]{10,160}?), this still\b/g, "If $1, this still")
    .replace(/\s+:\s+/g, ". ")
    .replace(/\bHow are you thinking about that\?/g, "Why does that matter in practice?")
    .replace(/\bHow do you think about that\?/g, "Why does that matter in practice?")
    .replace(/\bHow do you see it\?/g, "Why does that matter in practice?")
    .replace(/\bHow do you see that\?/g, "Why does that matter in practice?")
    .replace(/\bMake it quick\b/g, "Keep it short")
    .replace(/\.\s+\./g, ".")
    .replace(/\s+([.?!,])/g, "$1")
    .replace(/([.?!])([A-Za-z])/g, "$1 $2")
    .replace(/([.?!]\s+)([a-z])/g, (_, boundary, letter) => `${boundary}${letter.toUpperCase()}`)
    .replace(/\s+/g, " ")
    .trim();
}

function classifyQaTopic(lastHcpMessage = "") {
  const text = normalizeForMatch(lastHcpMessage);
  if (/formulary|non-preferred|preferred|committee|review/.test(text)) return "formulary";
  if (/renal|subgroup|evidence|guideline|efficacy|safety|outcome|patient population/.test(text)) return "clinical";
  if (/prior auth|prior authorization|workflow|staff|callback|handoff|rework|step|process|office/.test(text)) return "workflow";
  return "general";
}

function prefix(text = "") {
  return normalizeForMatch(text).slice(0, 24);
}

function getRepCoverage(turns = []) {
  const repTexts = turns
    .filter((turn) => turn?.speaker === "rep" && typeof turn?.text === "string")
    .map((turn) => normalizeForMatch(turn.text));

  const joined = repTexts.join(" ");

  return {
    answeredDirectly: /what changes is|the practical change is|the practical answer is|the direct change is|it removes|it cuts down|it keeps|it gives|it means/.test(joined),
    gaveWorkflowExample: /in practice|for example|for instance|the ma is|the case does not bounce|the front end gets|the request goes forward/.test(joined),
    explainedStaffImpact: /for your staff|for the office|cuts rework|fewer callbacks|duplicate handoffs|less back-and-forth|loose ends/.test(joined),
    providedImplementationDetail: /operationally|the real shift is|the change is|one complete intake|one complete review packet|one complete submission|handoff at the front end/.test(joined),
  };
}

function classifyQaAsk(lastHcpMessage = "") {
  const text = normalizeForMatch(lastHcpMessage);

  if (/what specifically gets removed|what gets removed|what task gets dropped|what drops off/.test(text)) {
    return "removed_work";
  }
  if (/what step falls|what step lands|what step goes to|what'?s the next step for my staff|what is the next step for my staff|after prior auth is done|after the prior auth is complete/.test(text)) {
    return "post_auth_step";
  }
  if (/what specifically changes for my staff|what changes for my staff|what changes for the staff|what changes for the office/.test(text)) {
    return "staff_change";
  }
  if (/what specifically reduces callbacks|reduce callbacks|what reduces callbacks/.test(text)) {
    return "callbacks";
  }

  return "general";
}

function classifySpecificAsk(hcpTurn = "") {
  const text = normalizeForMatch(hcpTurn);

  if (/what specifically gets removed|what gets removed|what task gets dropped|what drops off/.test(text)) {
    return "removed_work";
  }
  if (/what changes for my staff|what changes for the staff|what changes for the office|how will this impact.*staff|what specifically changes for my staff/.test(text)) {
    return "staff_change";
  }
  if (/after prior auth|what happens next|what's the next step|what is the next step|what do i do differently after|what step falls|what step lands/.test(text)) {
    return "next_step";
  }
  if (/where is the delay|what is the delay|what is the bottleneck|where is the bottleneck|where does it break|what part breaks down/.test(text)) {
    return "bottleneck";
  }
  if (/how does this work|how would this work|how do i do that|what do i do differently|how would my team do that|how is this implemented|implementation/.test(text)) {
    return "implementation";
  }
  if (/what reduces callbacks|reduce callbacks|missing info|missing information|calling the patient back/.test(text)) {
    return "removed_work";
  }

  return "general_staff_burden";
}

function responseModeForAsk(askType = "") {
  switch (askType) {
    case "removed_work":
      return "removal_explanation";
    case "staff_change":
      return "behavior_change";
    case "next_step":
      return "workflow_progression";
    case "bottleneck":
      return "root_cause";
    case "implementation":
      return "how_it_works";
    default:
      return "behavior_change";
  }
}

function resolveOperationalAsk(hcpTurn = "") {
  const text = normalizeForMatch(hcpTurn);

  if (/missing info|missing information|missing prior auth information|missing fields|missing details|calling the patient back/.test(text)) {
    return "missing_info_callback";
  }
  if (/resubmission|sending the same authorization back|sending the same prior auth back|second time|same request again|same authorization again/.test(text)) {
    return "resubmission_loop";
  }
  if (/duplicate handoff|handoff|bouncing the case back and forth|bounce the case|back and forth/.test(text)) {
    return "duplicate_handoff";
  }
  if (/status check|checking back|check back|calling to check|manual status/.test(text)) {
    return "manual_status_check";
  }
  if (/paperwork|documentation|missing fields|complete before it goes out|front end|submission/.test(text)) {
    return "paperwork_completion";
  }
  if (/after prior auth|after the prior auth is complete|next step|what happens next|move directly|scheduling|treatment prep/.test(text)) {
    return "post_auth_next_step";
  }

  return "general_staff_burden";
}

function getOperationalBucketPatterns(bucket = "") {
  switch (bucket) {
    case "missing_info_callback":
      return [
        /calling patients? back|calling the patient back|missing prior auth information|missing information/,
        /not calling patients? back|not calling the patient back|callback no longer happens/,
        /move it forward in one pass|reopening the case later|one pass/,
      ];
    case "resubmission_loop":
      return [
        /resubmission cycle|sending the same authorization back a second time|same prior auth back/,
        /not sending the same authorization back a second time|resubmission work drops off/,
        /stays in motion without dropping back into rework|does not drop back into rework/,
      ];
    case "duplicate_handoff":
      return [
        /handoff between the office and the payer|single cleaner handoff|bouncing the case back and forth/,
        /not bouncing the case back and forth|not fixing missing pieces in another handoff/,
        /moves through a single cleaner handoff|one cleaner handoff instead/,
      ];
    case "manual_status_check":
      return [
        /manual status check|calling or checking back on the same authorization repeatedly/,
        /not spending time calling or checking back repeatedly/,
        /act on a clearer next step right away|clearer next step right away/,
      ];
    case "paperwork_completion":
      return [
        /paperwork step changes at the front end|documentation is complete before it goes out|chasing missing fields/,
        /not chasing missing fields after submission/,
        /documentation is complete before it goes out|goes out complete at the front end/,
      ];
    case "post_auth_next_step":
      return [
        /after prior auth|move directly to the next office step|scheduling or treatment prep/,
        /not circling back to fix the same request again/,
        /move the patient to scheduling or treatment prep|move directly to the next office step/,
      ];
    default:
      return [
        /reopening and correcting the same authorization request|same authorization request/,
        /repeat work drops off|less time reopening/,
        /move the case forward with fewer manual touchpoints|fewer manual touchpoints/,
      ];
  }
}

function getOperationalTemplate(bucket = "", level = 0) {
  const templates = {
    missing_info_callback: [
      "The specific change is that the request is completed before it is submitted, so your MA is not calling the patient back for missing prior auth information. Instead of reopening the case later, the office can move it forward in one pass.",
      "What stops happening is the callback for missing prior auth information, because the request is complete before it goes out. Instead of patching the case after the visit, the office can keep it moving in one pass.",
      "What happens instead is that the office submits a complete request up front, so your MA is not calling the patient back later for missing information. The case can move forward without reopening it.",
    ],
    resubmission_loop: [
      "The step that changes is the resubmission cycle. Your staff is not sending the same authorization back a second time because the first request goes in complete. Instead, the case stays in motion without dropping back into rework.",
      "What stops happening is the second submission on the same authorization, because the first request goes out complete. Instead of sending it back through the queue again, the office keeps the case moving.",
      "What happens instead is one complete authorization submission the first time, so your staff is not resending the same case later. The case stays in motion instead of dropping back into rework.",
    ],
    duplicate_handoff: [
      "What changes is the handoff between the office and the payer. Your team is not bouncing the case back and forth to fix missing pieces. Instead, the case moves through a single cleaner handoff.",
      "What stops happening is the back-and-forth handoff to fix missing pieces. Instead of sending the case across twice, the office moves it through one cleaner handoff.",
      "What happens instead is one cleaner handoff with the needed information already in place, so your team is not bouncing the case back and forth later.",
    ],
    manual_status_check: [
      "The task that drops off is the manual status check. Your staff is not spending time calling or checking back on the same authorization repeatedly. Instead, they can act on a clearer next step right away.",
      "What stops happening is the repeated call or status check on the same authorization. Instead of checking back on the same case again, the office can move on a clearer next step.",
      "What happens instead is that staff gets to the next action without repeated status checks, so they are not calling back on the same authorization over and over.",
    ],
    paperwork_completion: [
      "The paperwork step changes at the front end. Your team is not chasing missing fields after submission. Instead, the documentation is complete before it goes out.",
      "What stops happening is the follow-up to fill missing paperwork fields after submission. Instead of patching the documentation later, the office sends it out complete.",
      "What happens instead is complete documentation before submission, so your team is not chasing missing fields after the case has already gone out.",
    ],
    post_auth_next_step: [
      "What changes after prior auth is that the case can move directly to the next office step instead of stalling in follow-up work. Your staff is not circling back to fix the same request again. Instead, they can move the patient to scheduling or treatment prep.",
      "What stops happening after prior auth is the follow-up work on the same request. Instead of circling back to repair it, the office can move the patient to the next step right away.",
      "What happens instead is that the patient moves from prior auth to scheduling or treatment prep without another repair step, so staff is not reopening the same request again.",
    ],
    general_staff_burden: [
      "The concrete change for your staff is that they spend less time reopening and correcting the same authorization request. The repeat work drops off, and the office can move the case forward with fewer manual touchpoints.",
      "What stops happening is the repeated correction of the same authorization request. Instead of reopening the case again, the office can move it forward with fewer manual touchpoints.",
      "What happens instead is that the case moves forward with fewer manual touchpoints, so your staff is not reopening and correcting the same authorization request again.",
    ],
  };

  const options = templates[bucket] || templates.general_staff_burden;
  return options[Math.min(level, options.length - 1)];
}

function operationalPartsForBucket(bucket = "") {
  switch (bucket) {
    case "missing_info_callback":
      return {
        step: "the request is completed before it is submitted",
        stop: "your MA is not calling the patient back for missing prior auth information",
        instead: "the office can move it forward in one pass",
      };
    case "resubmission_loop":
      return {
        step: "the first authorization request goes out complete",
        stop: "your staff is not sending the same authorization back a second time",
        instead: "the case stays in motion without dropping back into rework",
      };
    case "duplicate_handoff":
      return {
        step: "the handoff between the office and the payer is cleaned up at the front end",
        stop: "your team is not bouncing the case back and forth to fix missing pieces",
        instead: "the case moves through one cleaner handoff",
      };
    case "manual_status_check":
      return {
        step: "the office has a clearer handoff on the authorization status",
        stop: "your staff is not spending time calling or checking back on the same authorization repeatedly",
        instead: "they can act on a clearer next step right away",
      };
    case "paperwork_completion":
      return {
        step: "the paperwork is completed at the front end before submission",
        stop: "your team is not chasing missing fields after the case has already gone out",
        instead: "the documentation is complete before it leaves the office",
      };
    case "post_auth_next_step":
      return {
        step: "the case moves from prior auth into the next office step without another repair cycle",
        stop: "your staff is not circling back to fix the same request again",
        instead: "they can move the patient to scheduling or treatment prep",
      };
    default:
      return {
        step: "the authorization moves forward through one cleaner workflow step",
        stop: "your staff is not reopening and correcting the same authorization request again",
        instead: "the office can move the case forward with fewer manual touchpoints",
      };
  }
}

const CONCEPT_LAYERS = [
  "core_change",
  "operational_detail",
  "example",
  "staff_impact",
  "next_step",
];

const REP_CONCEPT_LAYERS = [
  "core_change",
  "example",
  "staff_impact",
  "operational_detail",
  "next_step",
];

const REP_CONCEPT_SEQUENCE = [
  "core_change",
  "example",
  "staff_impact",
  "operational_detail",
  "next_step",
];

function detectConceptLayer(text = "") {
  const t = normalizeForMatch(text);

  if (/(after that|next|then it moves|from there)/.test(t)) {
    return "next_step";
  }

  if (/(for example|in practice|like when)/.test(t)) {
    return "example";
  }

  if (/(your staff|they spend|they don't have to|they doesnt have to|your ma|ma spends|staff spends)/.test(t)) {
    return "staff_impact";
  }

  if (/(ma|staff|workflow|step|process|office|handoff|payer|authorization)/.test(t)) {
    return "operational_detail";
  }

  if (/(no more|removes|reduces|cuts out|less|fewer|stops|drops off)/.test(t)) {
    return "core_change";
  }

  return "core_change";
}

function detectRepConcept(text = "") {
  const t = normalizeForMatch(text);

  if (t.includes("for example") || t.includes("in practice")) return "example";
  if (t.includes("staff") || t.includes("ma")) return "staff_impact";
  if (t.includes("after") || t.includes("next")) return "next_step";
  if (t.includes("step") || t.includes("process")) return "operational_detail";

  return "core_change";
}

function getNormalizedTurnSpeaker(turn = {}) {
  return String(turn?.speaker || turn?.role || turn?.author || "").toLowerCase();
}

function getNormalizedTurnText(turn = {}) {
  return String(turn?.text || turn?.message || turn?.content || turn?.rawMessage || "");
}

function getUsedConceptLayers(turns = []) {
  const used = new Set();

  turns.forEach((turn) => {
    const speaker = getNormalizedTurnSpeaker(turn);
    const text = getNormalizedTurnText(turn);
    const isRep =
      speaker === "rep" ||
      speaker === "user" ||
      speaker.includes("rep");

    if (isRep && text.trim()) {
      used.add(detectConceptLayer(text));
    }
  });

  return used;
}

function getUsedRepConcepts(turns = []) {
  return turns
    .map((turn) => {
      const speaker = String(turn?.speaker || turn?.role || turn?.author || "").toLowerCase();

      if (!speaker.includes("rep")) return null;
      return turn?.concept || null;
    })
    .filter(Boolean);
}

function getNextLayer(usedLayers) {
  for (const layer of CONCEPT_LAYERS) {
    if (!usedLayers.has(layer)) {
      return layer;
    }
  }
  return "next_step";
}

function getNextConcept(used = []) {
  const orderedUsed = (used || []).filter(Boolean);
  const last = orderedUsed[orderedUsed.length - 1] || null;

  let next = REP_CONCEPT_SEQUENCE.find((concept) => !orderedUsed.includes(concept)) || "next_step";

  const counts = orderedUsed.reduce((acc, concept) => {
    acc[concept] = (acc[concept] || 0) + 1;
    return acc;
  }, {});

  if ((counts.operational_detail || 0) >= 1 && next === "operational_detail") {
    next = REP_CONCEPT_SEQUENCE.find((concept) => concept !== "operational_detail" && concept !== last) || "next_step";
  }

  if (next === last) {
    const rotated = REP_CONCEPT_SEQUENCE.find((concept) => concept !== last && (counts[concept] || 0) <= (counts[last] || 0));
    if (rotated) {
      next = rotated;
    }
  }

  return next;
}

function asRepReplyPayload(reply = "", concept = null, context = {}) {
  const rawText = typeof reply === "string" ? reply : String(reply?.text || "");
  const scenarioRouting = context?.scenario ? buildScenarioRouting(context.scenario) : null;
  const finalized = finalizeRepReply(rawText, context);
  const aligned = scenarioRouting
    ? enforceRepScenarioAlignment({
      rep_script: finalized,
      scenario_routing: scenarioRouting,
    })
    : finalized;
  const matched = scenarioRouting ? detectTopicLanes(aligned) : [];
  const prohibited = scenarioRouting
    ? matched.filter((lane) => (scenarioRouting.disallowed_topic_lanes || []).includes(lane))
    : [];
  const repaired = scenarioRouting && prohibited.length
    ? scrubStaleFallbackPhrases(
      String(context?.scenario?.journeyStage || "").toLowerCase() === "clinical_value"
        ? "The practical answer is whether this changes treatment decisions for patients you actually treat."
        : String(context?.scenario?.journeyStage || "").toLowerCase() === "initial_access"
          ? "The practical answer is why this matters now and what decision it should clarify in your practice."
          : String(context?.scenario?.journeyStage || "").toLowerCase() === "access_formulary"
            ? "The practical answer is the exact access step that needs to change for patients to start care."
            : "The practical answer is one concrete change tied to this scenario's blocker.",
      scenarioRouting,
    )
    : scrubStaleFallbackPhrases(aligned, scenarioRouting || {});

  return {
    text: repaired,
    concept,
  };
}

function concernFamilyRepAnchor(scenarioRouting = {}) {
  const family = String(scenarioRouting?.concern_family || "general");
  switch (family) {
    case "evidence":
      return "Keep this on the evidence gap that would actually change treatment decisions.";
    case "access":
      return "Keep this on the exact access step that blocks patient start.";
    case "workflow":
      return "Keep this on one concrete implementation step, owner, and what gets removed.";
    case "safety":
      return "Keep this on the safety signal that still blocks confidence.";
    case "cost":
      return "Keep this on one value outcome that changes a real patient decision.";
    default:
      return "Keep this on the current blocker in this scenario.";
  }
}

export function enforceRepScenarioAlignment({
  rep_script = "",
  scenario_routing = {},
}) {
  let response = String(rep_script || "").trim();
  if (!response) return concernFamilyRepAnchor(scenario_routing);

  const staleWorkflowPatterns = [
    /fewer rework touchpoints/gi,
    /first submission (?:is )?complete/gi,
    /callback cleanup step/gi,
    /one complete pass/gi,
  ];

  staleWorkflowPatterns.forEach((pattern) => {
    response = response.replace(pattern, "a concrete next-step change");
  });

  const matchedLanes = detectTopicLanes(response);
  const prohibitedLanes = matchedLanes.filter((lane) =>
    (scenario_routing?.disallowed_topic_lanes || []).includes(lane)
  );

  if (prohibitedLanes.length) {
    response = concernFamilyRepAnchor(scenario_routing);
  }

  const concernLaneMap = {
    evidence: ["clinical_value", "evidence_quality"],
    access: ["access_formulary", "prior_auth"],
    workflow: ["workflow_implementation"],
    safety: ["safety_signal", "evidence_quality"],
    cost: ["cost_value", "clinical_value"],
    guideline: ["guideline_alignment", "evidence_quality"],
    adoption_caution: ["peer_adoption", "protocol_change"],
    patient_fit: ["patient_identification", "clinical_value"],
  };

  const family = String(scenario_routing?.concern_family || "general");
  const expectedLanes = concernLaneMap[family] || [];
  if (expectedLanes.length) {
    const aligned = detectTopicLanes(response).some((lane) => expectedLanes.includes(lane));
    if (!aligned) {
      response = concernFamilyRepAnchor(scenario_routing);
    }
  }

  return normalizeDialoguePunctuation(response).trim();
}

function renderConcept(type = "core_change", context = {}) {
  const bucket = context?.bucket || "general_staff_burden";

  switch (type) {
    case "example":
      if (bucket === "post_auth_next_step") {
        return "In practice, instead of stalling after prior auth, the case moves to the next office step right away.";
      }
      return "In practice, instead of calling the patient back, the request goes in complete the first time.";
    case "staff_impact":
      if (bucket === "manual_status_check") {
        return "The main thing is your staff is not chasing the same authorization status again and again.";
      }
      return "The main thing is your staff isn't reopening and fixing the same authorization twice.";
    case "operational_detail":
      if (bucket === "paperwork_completion") {
        return "The step that changes is the submission itself - the paperwork goes out complete instead of getting kicked back.";
      }
      return "The step that changes is the initial submission - it goes in complete instead of getting kicked back.";
    case "next_step":
      if (bucket === "post_auth_next_step") {
        return "After that, the case moves straight into the next office step instead of looping back.";
      }
      return "After that, the case moves straight into scheduling instead of looping back.";
    default:
      if (bucket === "missing_info_callback") {
        return "The main difference is the request goes in complete, so the callback loop drops off.";
      }
      return "The main difference is the request goes in complete the first time.";
  }
}

function generateIsolatedLayerResponse(layer, { bucket = "general_staff_burden", context = {} } = {}) {
  const { step, stop, instead } = operationalPartsForBucket(bucket);
  const askType = context?.askType || "";

  switch (layer) {
    case "core_change":
      if (bucket === "resubmission_loop") return "It cuts out the resubmission loop.";
      if (bucket === "missing_info_callback") return "It cuts out the missing-info callback.";
      if (bucket === "duplicate_handoff") return "It cuts out the extra handoff.";
      if (bucket === "manual_status_check") return "It cuts out the repeat status-check work.";
      if (bucket === "paperwork_completion") return "It cuts out the paperwork cleanup after submission.";
      if (bucket === "post_auth_next_step") return "It cuts out the repair step after prior auth.";
      if (askType === "staff_change") return "It cuts out the repeat rework.";
      return "It cuts out the resubmission loop.";

    case "operational_detail":
      if (bucket === "missing_info_callback") return "Your MA is not calling the patient back for missing prior auth information.";
      if (bucket === "resubmission_loop") return "Your staff is not sending the same authorization back a second time.";
      if (bucket === "duplicate_handoff") return "Your team is not bouncing the case back and forth to fix missing pieces.";
      if (bucket === "manual_status_check") return "Your staff is not calling or checking back on the same authorization again.";
      if (bucket === "paperwork_completion") return "Your team is not chasing missing fields after the case goes out.";
      if (bucket === "post_auth_next_step") return "Your staff is not circling back to fix the same request again.";
      return "Your MA is not reopening and fixing the same authorization.";

    case "example":
      if (bucket === "missing_info_callback") return "For example, instead of calling the patient back, the request goes in complete the first time.";
      if (bucket === "resubmission_loop") return "For example, instead of sending the same prior auth back again, the first request goes out complete.";
      if (bucket === "duplicate_handoff") return "For example, instead of bouncing the case back to fix missing pieces, it moves through one cleaner handoff.";
      if (bucket === "manual_status_check") return "For example, instead of checking back on the same authorization, the office gets to the next action right away.";
      if (bucket === "paperwork_completion") return "For example, instead of fixing missing fields later, the documentation is complete before submission.";
      if (bucket === "post_auth_next_step") return "For example, instead of circling back after prior auth, the case moves into the next office step.";
      return "For example, instead of calling the patient back, the request goes in complete the first time.";

    case "staff_impact":
      if (bucket === "missing_info_callback") return "So your staff spends less time chasing missing information after the visit.";
      if (bucket === "resubmission_loop") return "So your staff spends less time resubmitting the same case.";
      if (bucket === "duplicate_handoff") return "So your staff spends less time fixing the same case across extra handoffs.";
      if (bucket === "manual_status_check") return "So your staff spends less time checking on the same authorization over and over.";
      if (bucket === "paperwork_completion") return "So your staff spends less time fixing paperwork after it has already gone out.";
      if (bucket === "post_auth_next_step") return "So your staff spends less time circling back on work that should already be done.";
      return "So your staff spends less time chasing missing info and resubmitting cases.";

    case "next_step":
      if (bucket === "missing_info_callback") return "After that, the case can move forward in one pass.";
      if (bucket === "resubmission_loop") return "After that, the case keeps moving instead of dropping back into rework.";
      if (bucket === "duplicate_handoff") return "After that, the case moves through one cleaner handoff.";
      if (bucket === "manual_status_check") return "After that, the office can act on the next step right away.";
      if (bucket === "paperwork_completion") return "After that, the documentation can move out without another cleanup step.";
      if (bucket === "post_auth_next_step") return "After that, the case can move straight into scheduling instead of rework.";
      return "After that, the case can move straight into scheduling instead of rework.";

    default:
      return `It cuts out the repeat rework because ${step}. ${stop.charAt(0).toUpperCase()}${stop.slice(1)}. ${instead.charAt(0).toUpperCase()}${instead.slice(1)}.`;
  }
}

function containsMultipleConcepts(text = "") {
  const matches = [
    /no more|cuts out|reduces|less|fewer/,
    /workflow|staff|process|step/,
    /for example|in practice/,
    /your staff|they spend/,
    /after that|next|then/,
  ].filter((pattern) => pattern.test(String(text || "").toLowerCase()));

  return matches.length > 1;
}

function responseLayerOrderForAsk(askType = "") {
  switch (askType) {
    case "removed_work":
      return ["core_change", "operational_detail", "example", "staff_impact", "next_step"];
    case "staff_change":
      return ["operational_detail", "staff_impact", "example", "next_step", "core_change"];
    case "next_step":
      return ["next_step", "operational_detail", "example", "staff_impact", "core_change"];
    case "bottleneck":
      return ["operational_detail", "core_change", "example", "staff_impact", "next_step"];
    case "implementation":
      return ["operational_detail", "example", "staff_impact", "next_step", "core_change"];
    default:
      return ["core_change", "operational_detail", "example", "staff_impact", "next_step"];
  }
}

function isSameConcept(previousRep = "", currentRep = "") {
  const stripFrame = (text) => normalizeForMatch(text)
    .replace(/^(the step that changes is|where this actually breaks down is|the specific change is|what stops happening is|the part that drops off is|what your staff is actually doing differently is this|the difference for your staff is this|after that first change|from there|what happens next is|the way it works is that|this works by)\b/i, "")
    .replace(/\b(instead|that means|so)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const a = stripFrame(previousRep);
  const b = stripFrame(currentRep);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function selectOperationalLayer({ turns = [], askType = "", responseMode = "" }) {
  const usedLayers = getUsedConceptLayers(turns);
  const order = responseLayerOrderForAsk(askType);
  const preferredLayer =
    responseMode === "removal_explanation" ? "core_change" :
      responseMode === "behavior_change" ? "operational_detail" :
        responseMode === "workflow_progression" ? "next_step" :
          responseMode === "root_cause" ? "operational_detail" :
            responseMode === "how_it_works" ? "example" :
              order[0];
  const candidateOrder = [preferredLayer, ...order.filter((layer) => layer !== preferredLayer)];

  for (const layer of candidateOrder) {
    if (!usedLayers.has(layer)) {
      return layer;
    }
  }

  return getNextLayer(usedLayers);
}

function renderOperationalLayer(bucket = "", layer = "") {
  const { step, stop, instead } = operationalPartsForBucket(bucket);
  switch (layer) {
    case "core_change":
      return `It cuts out the repeat rework because ${step}. ${stop.charAt(0).toUpperCase()}${stop.slice(1)}.`;
    case "operational_detail":
      return `Your staff is not getting pulled back into the same step because ${step}. ${stop.charAt(0).toUpperCase()}${stop.slice(1)}.`;
    case "example":
      return `For example, ${step}, so ${stop}. ${instead.charAt(0).toUpperCase()}${instead.slice(1)}.`;
    case "staff_impact":
      return `So your staff feels the difference here: ${stop}. ${instead.charAt(0).toUpperCase()}${instead.slice(1)}.`;
    case "next_step":
      return `After that, ${instead}. ${stop.charAt(0).toUpperCase()}${stop.slice(1)}.`;
    default:
      return `It cuts out the repeat rework because ${step}. ${stop.charAt(0).toUpperCase()}${stop.slice(1)}.`;
  }
}

function forceNextConceptLayer(usedLayers, askType = "", bucket = "general_staff_burden") {
  const orderedLayers = responseLayerOrderForAsk(askType);
  const next = orderedLayers.find((layer) => !usedLayers.has(layer)) || getNextLayer(usedLayers);
  return renderOperationalLayer(bucket, next);
}

function enforceUniqueOperationalAnswer({ turns = [], bucket = "", askType = "", candidate = "" }) {
  const usedLayers = getUsedConceptLayers(turns);
  const currentLayer = detectConceptLayer(candidate);

  if (!usedLayers.has(currentLayer) && !containsMultipleConcepts(candidate)) {
    return candidate;
  }

  const nextLayer = getNextLayer(usedLayers);
  return generateIsolatedLayerResponse(nextLayer, { bucket, context: { askType } });
}

function getOperationalResolutionLevel(turns = [], bucket = "") {
  const patterns = getOperationalBucketPatterns(bucket);
  const repTexts = turns
    .filter((turn) => turn?.speaker === "rep" && typeof turn?.text === "string")
    .map((turn) => normalizeForMatch(turn.text));

  let level = 0;
  for (const text of repTexts) {
    if (patterns[0]?.test(text)) level = Math.max(level, 1);
    if (patterns[1]?.test(text)) level = Math.max(level, 2);
    if (patterns[2]?.test(text)) level = Math.max(level, 3);
  }
  return level;
}

function nextOperationalResolution(turns = [], bucket = "") {
  const level = getOperationalResolutionLevel(turns, bucket);
  return getOperationalTemplate(bucket, level);
}

function chooseProgressionMode({ lastHcpMessage = "", turns = [] }) {
  const questionType = detectHcpQuestionType(lastHcpMessage);
  const coverage = getRepCoverage(turns);

  if (questionType === "solution_seeking") {
    return "answer";
  }

  if (!coverage.answeredDirectly) {
    return "answer";
  }

  if (!coverage.gaveWorkflowExample) return "example";
  if (!coverage.explainedStaffImpact) return "staff";
  if (!coverage.providedImplementationDetail) return "implementation";
  return "next_step";
}

function pickProgressionLine(mode, topic, previousRepText = "", lastHcpMessage = "", turns = []) {
  const previousPrefix = prefix(previousRepText);
  const askType = classifySpecificAsk(lastHcpMessage);
  const responseMode = responseModeForAsk(askType);
  const operationalBucket = resolveOperationalAsk(lastHcpMessage);
  const lines = {
    workflow: {
      answer: [
        "What changes is that the request goes in complete the first time, so your staff is not chasing missing details or reopening the case later.",
        "The practical change is one complete prior auth submission up front, so staff is not doing callbacks, resubmissions, or duplicate handoffs later.",
      ],
      example: [
        "In practice, that means the MA is not calling the patient back for missing information and the case does not bounce between the office and the payer.",
        "In practice, the front end gets the case out cleanly, so staff is not reopening it after the visit to patch missing pieces.",
      ],
      staff: [
        "For your staff, that cuts rework and keeps the case from bouncing through callbacks and duplicate handoffs.",
        "For the office, that means less back-and-forth, fewer callbacks, and fewer loose ends after the visit.",
      ],
      implementation: [
        "Operationally, the real shift is one complete intake and prior-auth step instead of patching the case after the visit.",
        "Operationally, it changes the handoff at the front end so the case is ready before staff has to chase it later.",
      ],
      next_step: [
        "The next practical step is checking which fields are usually missing now, so you can see whether one complete submission would actually remove that rework.",
        "The next practical step is pressure-testing the point where your staff usually reopens the case, so you can see whether a complete submission would actually take that step out.",
      ],
    },
    formulary: {
      answer: [
        "What changes is having one committee-ready summary instead of restarting the access discussion from scratch each time.",
        "The practical change is a review-ready formulary summary, so the request is not reopening as a series of one-off follow-ups.",
      ],
      example: [
        "In practice, that gives the team a specific patient group, outcome, and reason to revisit the restriction.",
        "In practice, it means the request goes forward with one clear rationale instead of a loose collection of follow-up questions.",
      ],
      staff: [
        "For your staff, that means fewer back-and-forth requests and a clearer process for what actually has to go to review.",
        "For the office, that reduces the extra steps that happen when the request comes back without the right review package.",
      ],
      implementation: [
        "Operationally, the change is packaging the request for review once instead of sending partial information and reopening it later.",
        "Operationally, it means one complete review packet instead of a stop-start process that keeps coming back to the office.",
      ],
      next_step: [
        "The next practical step is confirming what the committee needs in that summary so the request moves through one review path.",
        "The next practical step is narrowing the exact review requirement that keeps this from moving now, so the package is complete the first time.",
      ],
    },
    clinical: {
      answer: [
        "What changes is whether the data answers the exact evidence gap you're raising, not whether the product sounds broadly positive.",
        "The practical change is narrowing the discussion to the exact evidence question driving your decision, not to a general efficacy claim.",
      ],
      example: [
        "In practice, that means staying on the subgroup, renal issue, or outcome that is actually driving your decision.",
        "In practice, it means keeping the discussion tied to the patient group you would really change treatment for.",
      ],
      staff: [
        "For your team, that keeps the conversation tied to a real treatment decision instead of a broad value statement.",
        "For the practice, that keeps the review focused on the one evidence gap that would actually change care.",
      ],
      implementation: [
        "Operationally, the shift is narrowing the review to the exact evidence point you would need before changing course.",
        "Operationally, it means defining the one evidence question that still has to be answered before this moves.",
      ],
      next_step: [
        "The next practical step is agreeing on the one evidence question that still has to be answered before this moves.",
        "The next practical step is pressure-testing the exact subgroup or outcome you still need to see before this becomes actionable.",
      ],
    },
    general: {
      answer: [
        "What changes is the specific part of the process that's creating extra work right now, not a broad value story.",
        "The practical change is addressing the exact bottleneck on the table instead of widening the discussion.",
      ],
      example: [
        "In practice, that means staying on the step that's slowing care rather than opening a broader discussion.",
        "In practice, it means focusing on the part of the workflow or decision that is actually blocking progress.",
      ],
      staff: [
        "For your team, that keeps the conversation tied to what is actually creating burden day to day.",
        "For the office, that keeps this anchored to the practical issue instead of a general pitch.",
      ],
      implementation: [
        "Operationally, the shift is defining the exact step that has to change before this is worth carrying forward.",
        "Operationally, it means making one concrete change instead of talking around the issue.",
      ],
      next_step: [
        "The next practical step is narrowing the exact point where this is getting stuck so you can see whether the change is real.",
        "The next practical step is pressure-testing the one step that still needs to change before this becomes useful.",
      ],
    },
  };

  if (topic === "workflow" && mode === "answer") {
    const mappedBucket =
      askType === "removed_work" ? "resubmission_loop" :
        askType === "next_step" ? "post_auth_next_step" :
          askType === "staff_change" ? "general_staff_burden" :
            askType === "implementation" ? "paperwork_completion" :
              askType === "bottleneck" ? "duplicate_handoff" :
                operationalBucket;
    const usedLayers = getUsedConceptLayers(turns);
    const nextLayer = getNextLayer(usedLayers);
    let candidateResponse = generateIsolatedLayerResponse(nextLayer, {
      bucket: mappedBucket,
      context: { askType, responseMode, lastHcpMessage },
    });

    if (containsMultipleConcepts(candidateResponse)) {
      candidateResponse = generateIsolatedLayerResponse(nextLayer, {
        bucket: mappedBucket,
        context: { askType, responseMode, lastHcpMessage },
      });
    }

    if (prefix(candidateResponse) === previousPrefix) {
      candidateResponse = generateIsolatedLayerResponse(getNextLayer(new Set([...usedLayers, nextLayer])), {
        bucket: mappedBucket,
        context: { askType, responseMode, lastHcpMessage },
      });
    }

    return candidateResponse;
  }

  const options = lines[topic]?.[mode] || lines.general[mode];
  if (prefix(options[0]) === previousPrefix && options[1]) {
    return options[1];
  }
  return options[0];
}

export function buildDeterministicQaRepReply({ scenario = {}, turns = [], draft = "", personaKey = "strong_rep" }) {
  const lastHcpMessage = getLastHcpText(turns);

  if (!lastHcpMessage) {
    return asRepReplyPayload(
      "I want to keep this focused on the specific blocker that is getting in the way of the next decision.",
      "core_change",
      { hcpTurn: lastHcpMessage, transcript: turns, scenario },
    );
  }

  const directAsk = detectHcpDirectAsk(lastHcpMessage);
  if (directAsk.hasDirectAsk) {
    const tier = String(personaKey || "strong_rep").toLowerCase();
    const directReply = tier.includes("weak")
      ? buildDirectAskWeakAnswer(directAsk)
      : tier.includes("mediocre") || tier.includes("average")
        ? buildDirectAskMediocreAnswer({ askType: directAsk.askType, scenario, turns })
        : buildDirectAskStrongAnswer({ askType: directAsk.askType, scenario, turns });
    return asRepReplyPayload(
      directReply,
      "core_change",
      { hcpTurn: lastHcpMessage, transcript: turns, scenario },
    );
  }

  const topic = classifyQaTopic(lastHcpMessage);
  const mode = chooseProgressionMode({ lastHcpMessage, turns });
  const bucket = resolveOperationalAsk(lastHcpMessage);
  const previousRepText = getLastRepText(turns);
  const candidate = pickProgressionLine(mode, topic, previousRepText, lastHcpMessage, turns);
  const usedConcepts = getUsedRepConcepts(turns);
  const nextConcept = getNextConcept(usedConcepts);
  const forced = renderConcept(nextConcept, {
    bucket,
    topic,
    mode,
    hcpTurn: lastHcpMessage,
    candidate,
  });

  return asRepReplyPayload(
    forced,
    nextConcept,
    { hcpTurn: lastHcpMessage, transcript: turns, scenario },
  );
}

function extractIssueLabel(text = "") {
  const normalized = String(text).toLowerCase();
  if (/renal impairment|renal function|\brenal\b|kidney/.test(normalized)) return "renal impairment";
  if (/guideline/.test(normalized)) return "guideline fit";
  if (/cost savings|readmissions|expenditure|economic|cost-effectiveness|justify the cost|cost justification|metrics|specific outcomes|what outcomes|worth the spend|total cost per patient|cost per patient|what's included|what is included|what does that include|break down|added testing|monitoring/.test(normalized)) return "cost impact";
  if (/subgroup|patient population|excluded/.test(normalized)) return "patient-fit gap";
  if (/workflow|staff|added step|operational|prior auth|prior authorization/.test(normalized)) return "workflow burden";
  return "the gap you're pointing to";
}

function deriveProofPointCategory({ scenario, activeConcernText = "", turns = [] }) {
  const text = [
    activeConcernText,
    scenario?.objective,
    scenario?.description,
    scenario?.context,
    getLastRepText(turns),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/hospital|readmission|admission|er|ed\b|acute|discharge/.test(text)) {
    return "keeping the right patient out of the hospital";
  }
  if (/symptom|flare|control|exacerbation|disease activity|quality of life/.test(text)) {
    return "a patient-level symptom or flare reduction you would actually notice";
  }
  if (/prior auth|workflow|staff|handoff|approval|access|paperwork|callback/.test(text)) {
    return "one operational change that clearly cuts staff work or speeds approval";
  }
  if (/guideline|treatment choice|switch|decision|line of therapy|selection|subgroup/.test(text)) {
    return "one proof point that would actually change treatment choice for a real patient";
  }
  if (/screen|screening|eligible|candidate|identify/.test(text)) {
    return "one sign that helps you identify the right patient earlier";
  }
  return "one outcome you can tie to a real patient decision";
}

function deriveInitialAccessBarrier(scenario = {}, activeConcernText = "") {
  const text = [
    activeConcernText,
    scenario?.objective,
    scenario?.description,
    scenario?.context,
    scenario?.openingScene,
    ...(scenario?.interactionPressure || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/prior auth|prior authorization|coverage|access|formulary|approval/.test(text)) {
    return "prior auth work and approval delays";
  }
  if (/staff|workflow|handoff|callback|operational|follow-up/.test(text)) {
    return "the staff handoff that slows the start of care";
  }
  if (/screen|screening|identify|candidate|selection/.test(text)) {
    return "missing the right patient early enough to act";
  }
  return "the point in the workflow where staff gets pulled into rework before care can move forward";
}

function deriveInitialAccessOperationalChange(scenario = {}, activeConcernText = "") {
  const barrier = deriveInitialAccessBarrier(scenario, activeConcernText);

  if (/prior auth|approval|coverage|access/.test(barrier)) {
    return "a shorter approval path, fewer callbacks, and one cleaner handoff before staff has to chase the case again";
  }
  if (/staff handoff|workflow|handoff|callback/.test(barrier)) {
    return "one cleaner handoff, fewer back-and-forth steps, and less staff rework before the patient can move forward";
  }
  if (/patient early enough|identify/.test(barrier)) {
    return "a faster way to flag the right patient before the visit turns into another missed opportunity";
  }

  return "one cleaner operational step so the case does not bounce back through the office twice";
}

function hasConcreteSolutionSeekingAnswer(text = "") {
  const value = normalizeForMatch(text);
  if (!value) return false;

  const hasDomainAnchor = /staff|workflow|process|patients?|access|prior auth|prior authorization|\bpa\b|formulary|committee|callback|handoff|steps?|office|approval|payer|paperwork|documentation|authorization|form|ma\b|medical assistant/.test(value);
  const hasSubstance = /reduces?|remove|shorter|cleaner|fewer|less|no more|not have to|doesn't have to|goes through|move forward|submit|complete|fix|send|avoid|stop|right first time|resubmit|kicked back|missing info|missing information|reopen|reopening|denied|chart notes|step therapy/.test(value);

  return hasDomainAnchor && hasSubstance;
}

function hasEvidenceProofSignal(text = "") {
  const value = normalizeForMatch(text);
  return /proof point|data point|single metric|one metric|one number|subgroup|analysis|patient-level|patient level|treatment choice|change treatment|hospitalization|readmission|outcome/i.test(value);
}

function hasSemanticDomainSignal(text = "") {
  return /prior auth|prior authorization|\bpa\b|authorization|request|requests|form|paperwork|documentation|payer|office|staff|ma\b|medical assistant|workflow|callback|resubmit|resubmission|kicked back|kicked-back|bounce it back|bounced back|denied|clean submission|approval|chart notes|front desk|office staff|step therapy|missing info|missing information/.test(normalizeForMatch(text));
}

function hasSemanticChangeSignal(text = "") {
  return /fix|complete|submit|send|reduce|remove|avoid|stop|less|fewer|no more|not have to|doesn't have to|goes through|move forward|cleaner|right first time|cuts out|drops off|isn't reopening|not doing|doesn't bounce back|isn't fixing/.test(normalizeForMatch(text));
}

function hasSemanticSpecificitySignal(text = "") {
  return /resubmission|missing info|missing information|callback|kicked back|kicked-back|denied|reopened|payer|documentation|icd|step therapy|chart notes|form|front desk|ma\b|medical assistant|office staff|approval|clean first time|authorization|same authorization|same pa|same prior auth|bounced back|send it again|fix and send it again/.test(normalizeForMatch(text));
}

function hasOperationalAnchor(text = "") {
  return /resubmit|resubmission|missing info|missing information|fix|fixing|correcting|reopen|reopening|send again|second time|same pa|same prior auth|same authorization|kicked back|kicked-back|denied|payer bounce|bounce it back|bounced back|form complete|form completion|form is complete|documentation gap|ma chasing|calling back|callback|callbacks|back and forth/.test(normalizeForMatch(text));
}

function hasShortDirectOperationalResolution(text = "") {
  const value = normalizeForMatch(text);
  return (
    /\bno resubmissions\b/.test(value) ||
    /\bma\b.*\b(no|not|doesn't)\b.*\b(chase|calling|call|missing info|missing information)\b/.test(value) ||
    /\bstaff\b.*\b(no|not|doesn't)\b.*\b(do|doing|fix|send|same pa|same prior auth|same authorization|twice)\b/.test(value) ||
    /\bless\b.*\b(callback|callbacks|fixing|same authorization|resubmit|resubmission)\b/.test(value) ||
    /\bfewer\b.*\b(kicked back requests?|callbacks?|resubmissions?)\b/.test(value) ||
    /\bgoes through\b.*\bclean\b.*\bfirst time\b/.test(value) ||
    /\bclean\b.*\bfirst time\b/.test(value) ||
    /\bdoesn't have to\b.*\bfix\b.*\bsend it again\b/.test(value) ||
    /\bnot reopening\b.*\bsame case\b/.test(value) ||
    /\breduces?\b.*\b(callback|callbacks|resubmit|resubmission loop)\b/.test(value)
  );
}

function isBroadVagueNonAnswer(text = "") {
  const value = normalizeForMatch(text);
  return (
    /\bit reduces burden\b/.test(value) ||
    /\bit helps your office\b/.test(value) ||
    /\bit makes the process better\b/.test(value) ||
    /\bwe support your staff\b/.test(value) ||
    /\bit improves workflow\b/.test(value) ||
    /\bit makes things easier\b/.test(value) ||
    /\bit helps reduce burden\b/.test(value) ||
    /\bit improves efficiency\b/.test(value) ||
    /\bit helps your staff\b/.test(value)
  );
}

export function semanticallyAnswersHcpAsk(hcpTurn = "", repResponse = "") {
  const questionType = detectHcpQuestionType(hcpTurn);
  if (questionType !== "solution_seeking") return true;

  const response = normalizeForMatch(repResponse);
  const hcpText = normalizeForMatch(hcpTurn);
  const evidenceAsk = EVIDENCE_PROOF_ASK_PATTERN.test(hcpText);

  if (!response) {
    return false;
  }

  if (/^(what|how|why|where|when|who|can|could|would|should|is|are|do|does|did)\b/.test(response) || /\?$/.test(response)) {
    return false;
  }

  if (isBroadVagueNonAnswer(response)) {
    return false;
  }

  if (evidenceAsk) {
    return hasEvidenceProofSignal(response);
  }

  const operationalAsk =
    /prior auth|prior authorization|\bpa\b|workflow|staff|ma\b|paperwork|documentation|payer|authorization|callback|resubmit|form|approval|office/.test(hcpText);
  const requiresOperationalAnchor =
    /what changes|what specifically|what'?s different|what is different|what actually changes/.test(hcpText);

  if (operationalAsk) {
    const hasDomain = hasSemanticDomainSignal(response);
    const hasChange = hasSemanticChangeSignal(response);
    const hasSpecificity = hasSemanticSpecificitySignal(response);
    const hasAnchor = hasOperationalAnchor(response);
    if (requiresOperationalAnchor && !hasAnchor) {
      return false;
    }
    if ((hasDomain && hasChange && hasSpecificity) || hasShortDirectOperationalResolution(response)) {
      return true;
    }
    return false;
  }

  return hasConcreteSolutionSeekingAnswer(response);
}

function fullyAnswersQuestion(hcpTurn = "", repResponse = "") {
  return semanticallyAnswersHcpAsk(hcpTurn, repResponse);
}

function deriveGuidelineDirectAnswer(activeConcernText = "") {
  const text = String(activeConcernText || "").toLowerCase();
  if (/exact guideline language|guideline update|guideline recommendation/.test(text)) {
    return "There is not one clean line of guideline language that changes practice on its own here";
  }
  if (/dose-adjust|dose adjustment|dose reduction|adjustment/.test(text)) {
    return "The clinical implication is whether the reduced dose still gives enough disease control to justify staying on treatment in the renal-impaired patient, instead of trading away too much benefit just to make dosing possible";
  }
  if (/renal impairment|renal function/.test(text)) {
    return "The trial still does not answer the renal question cleanly for the patients you are thinking about";
  }
  if (/subgroup|patient population|excluded|own patient population|my patient population/.test(text)) {
    return "The subgroup that matters is the harder-to-treat patient who still is not controlled on the standard path and whose renal burden, comorbidity load, or treatment complexity makes you question whether the usual evidence still applies cleanly";
  }
  if (/cost|readmission|hospitalization|value|outcomes/.test(text)) {
    return "The value story is still too broad unless it changes a real patient or utilization decision for you";
  }
  return "The evidence is still not specific enough to clear the decision bar you use in practice";
}

function buildSolutionSeekingFallback({ scenario, turns }) {
  const lastHcpMessage = getLastHcpText(turns);
  const response = normalizeForMatch(lastHcpMessage);
  const stageText = `${scenario?.journeyStage || ""}`.toLowerCase();

  if (
    EVIDENCE_PROOF_ASK_PATTERN.test(response) ||
    (/commitment_close|adoption_implementation/.test(stageText) && /evidence|subgroup|proof point|data point/.test(response))
  ) {
    const activeConcernText = getActiveConcernText(turns, scenario);
    const proofPointCategory = deriveProofPointCategory({ scenario, activeConcernText, turns });
    return `${deriveCommitmentDirectAnswer(activeConcernText, proofPointCategory)}. The useful next step is to keep it anchored to ${proofPointCategory}.`;
  }

  if (/prior auth|prior authorization|\bpa\b|workflow|staff|ma\b|paperwork|documentation|authorization|callback|resubmit|approval|office/.test(response)) {
    const askType = classifySpecificAsk(lastHcpMessage);
    const bucket =
      askType === "removed_work" ? "resubmission_loop" :
        askType === "next_step" ? "post_auth_next_step" :
          askType === "staff_change" ? "general_staff_burden" :
            askType === "implementation" ? "paperwork_completion" :
              askType === "bottleneck" ? "duplicate_handoff" :
                resolveOperationalAsk(lastHcpMessage);
    const usedLayers = getUsedConceptLayers(turns);
    const nextLayer = getNextLayer(usedLayers);
    return generateIsolatedLayerResponse(nextLayer, {
      bucket,
      context: { askType, lastHcpMessage },
    });
  }

  if (/clinical_value|early_discovery|discovery|initial_access/.test(stageText)) {
    return "The practical answer is whether this changes a real patient decision in your setting.";
  }

  if (/access_formulary/.test(stageText)) {
    return "The practical answer is the exact access step that changes for patients to start care.";
  }

  return "The practical answer is one concrete change tied to your main blocker.";
}

function buildDirectAskStrongAnswer({ askType = "asks_for_concrete_difference", scenario = {}, turns = [] }) {
  const lastHcpMessage = getLastHcpText(turns);
  const activeConcern = getActiveConcernText(turns, scenario);

  switch (askType) {
    case "asks_for_workflow_impact":
      return "The main change for your staff is one cleaner submission step, so they stop reopening the same case for callbacks or resubmissions.";
    case "asks_for_access_step":
      return "The concrete access step is a complete prior-auth packet up front, so the case clears coverage review without a second repair cycle.";
    case "asks_for_evidence_relevance":
      return `The evidence only matters if it addresses the exact fit gap you raised, not a broad average result. The unresolved issue is ${extractIssueLabel(activeConcern)}.`;
    case "asks_for_guideline_fit":
      return "For guideline fit, the answer has to show where this sits in pathway placement versus current standard of care for your actual patient mix.";
    case "asks_for_safety_clarity":
      return "For safety clarity, the useful answer is which risk signal would make you pause and how that changes monitoring in the first weeks.";
    case "asks_for_next_step":
      return "The next step is defining one low-risk patient profile and one decision threshold before any broader change.";
    case "disengagement_boundary":
      return "Understood. We can pause here and only continue if we can stay on your specific blocker.";
    default:
      return buildSolutionSeekingFallback({ scenario, turns });
  }
}

function buildDirectAskMediocreAnswer({ askType = "asks_for_concrete_difference", scenario = {}, turns = [] }) {
  const baseline = buildDirectAskStrongAnswer({ askType, scenario, turns });
  switch (askType) {
    case "asks_for_evidence_relevance":
      return "The evidence may be directionally useful, but it still depends on how your patient mix maps to the subgroup discussion.";
    case "asks_for_guideline_fit":
      return "The fit is likely in guideline discussion, though I would still want to map where your pathway threshold sits.";
    case "asks_for_access_step":
      return "The process should be cleaner if the access packet is complete, but details can vary by payer.";
    default:
      return baseline;
  }
}

function buildDirectAskWeakAnswer({ askType = "asks_for_concrete_difference" }) {
  if (askType === "disengagement_boundary") {
    return "Can I ask what would need to change before you would continue this discussion?";
  }
  return "Can I ask how your team is currently thinking about this right now?";
}

export function deriveHcpConsequenceLine({ askType = "asks_for_concrete_difference", requiredAnchor = "concrete_difference" } = {}) {
  const anchorLabel = requiredAnchor === "next_step" ? "the next step" : requiredAnchor.replace(/_/g, " ");
  if (askType === "disengagement_boundary") {
    return "You're widening the conversation again instead of respecting the boundary I just set.";
  }
  return `You're asking another question, but you still haven't answered the ${anchorLabel} I asked about.`;
}

function getRecentRepReplies(context = {}, window = 4) {
  const transcript = Array.isArray(context?.transcript) ? context.transcript : [];
  const repTexts = transcript
    .filter((turn) => turn?.speaker === "rep" && typeof turn?.text === "string")
    .map((turn) => turn.text.trim())
    .filter(Boolean);

  if (!repTexts.length) return [];
  return repTexts.slice(-Math.max(1, window));
}

function stableIndex(key = "", size = 1) {
  const span = Math.max(1, size);
  const score = String(key || "")
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return score % span;
}

function pickVariant(variants = [], fallback = "", key = "") {
  if (!Array.isArray(variants) || !variants.length) return fallback;
  return variants[stableIndex(key, variants.length)] || variants[0] || fallback;
}

function buildOperationalLoopAlternatives(context = {}) {
  const ask = normalizeForMatch(context?.hcpTurn || "");

  if (/callback|call back/.test(ask)) {
    return [
      "The front-end request includes the needed details, so your staff is not fielding follow-up callback requests.",
      "The change is one cleaner authorization handoff, which removes repeat callback follow-up for your MA.",
      "Operationally, your team sends a cleaner prior-auth packet and can move to the next patient task.",
      "The practical difference is less callback churn because the initial request is more complete.",
    ];
  }

  if (/prior auth|prior authorization|pa\b/.test(ask)) {
    return [
      "The initial prior-auth packet is cleaner, so your staff does not have to run a second correction pass.",
      "The operational change is one clean prior auth packet instead of a follow-up fix step.",
      "Your team handles prior auth in one pass and can move directly to the next office action.",
      "The practical shift is fewer prior auth touchpoints because the required fields are complete upfront.",
    ];
  }

  return [
    "The first request is cleaner, so the team can move forward without a repeat correction cycle.",
    "The operational change is reducing avoidable back-and-forth after submission.",
    "Your team can move to the next action without repeating the same fix step.",
    "The practical difference is less repeat work after the initial request.",
  ];
}

function rotateRepeatedRepLine(text = "", context = {}) {
  const candidate = String(text || "").trim();
  if (!candidate) return candidate;

  const normalizedCandidate = normalizeForMatch(candidate);
  const baseKey = `${prefix(context?.hcpTurn || "")}:${normalizedCandidate}`;

  if (/moves straight into scheduling instead of (looping back|rework)/.test(normalizedCandidate)) {
    return pickVariant(buildOperationalLoopAlternatives(context), candidate, `${baseKey}:schedule-loop`);
  }

  if (/cuts out the resubmission loop/.test(normalizedCandidate)) {
    return pickVariant(buildOperationalLoopAlternatives(context), candidate, `${baseKey}:resubmission-loop`);
  }

  const recent = getRecentRepReplies(context, 4);
  const repeatedCount = recent.reduce(
    (count, line) => (normalizeForMatch(line) === normalizedCandidate ? count + 1 : count),
    0,
  );
  if (repeatedCount === 0) return candidate;

  const key = `${prefix(context?.hcpTurn || "")}:${repeatedCount}:${normalizedCandidate}`;

  if (/^after that,/.test(normalizedCandidate)) {
    return candidate.replace(/^After that,/i, repeatedCount % 2 === 0 ? "Then," : "From there,");
  }

  return candidate;
}

function finalizeRepReply(text = "", context = {}) {
  const humanized = humanizeRepResponse(text, context);
  const deduped = rotateRepeatedRepLine(humanized, context);
  return normalizeDialoguePunctuation(deduped);
}

export function enforceRepAnswerFirstContract({
  scenario,
  turns,
  draft,
  personaKey = "strong_rep",
  turnIndex = 0,
}) {
  const lastHcpMessage = getLastHcpText(turns);
  const questionType = detectHcpQuestionType(lastHcpMessage);
  const directAsk = detectHcpDirectAsk(lastHcpMessage);
  const scenarioRouting = buildScenarioRouting(scenario || {});
  const tier = String(personaKey || "strong_rep").toLowerCase();
  const draftPayload = typeof draft === "object" && draft !== null
    ? draft
    : { text: String(draft || "").trim(), concept: null };

  if (questionType !== "solution_seeking" && !directAsk.hasDirectAsk) {
    return asRepReplyPayload(draftPayload.text, draftPayload.concept, {
      hcpTurn: lastHcpMessage,
      transcript: turns,
      scenario,
    });
  }

  const normalizedDraft = String(draftPayload.text || "").trim();
  if (!normalizedDraft) {
    const fallback = directAsk.hasDirectAsk
      ? (tier.includes("weak")
        ? buildDirectAskWeakAnswer(directAsk)
        : tier.includes("mediocre") || tier.includes("average")
          ? buildDirectAskMediocreAnswer({ askType: directAsk.askType, scenario, turns })
          : buildDirectAskStrongAnswer({ askType: directAsk.askType, scenario, turns }))
      : buildSolutionSeekingFallback({ scenario, turns });
    return asRepReplyPayload(fallback, draftPayload.concept, {
      hcpTurn: lastHcpMessage,
      transcript: turns,
      scenario,
    });
  }

  const draftIsQuestion =
    /\?$/.test(normalizedDraft) ||
    /^(what|how|why|where|when|who|can|could|would|should|is|are|do|does|did)\b/i.test(normalizedDraft);

  if (!draftIsQuestion && fullyAnswersQuestion(lastHcpMessage, normalizedDraft)) {
    if (!directAsk.hasDirectAsk) {
      return asRepReplyPayload(normalizedDraft, draftPayload.concept, {
        hcpTurn: lastHcpMessage,
        transcript: turns,
        scenario,
      });
    }

    const quality = evaluateRepAnswerToHcpAsk({
      hcpAsk: { ...directAsk, text: lastHcpMessage },
      repResponse: normalizedDraft,
      scenarioRouting,
      scenarioAnchors: scenarioRouting?.allowed_topic_lanes || [],
    });

    if (tier.includes("weak")) {
      return asRepReplyPayload(buildDirectAskWeakAnswer(directAsk), draftPayload.concept, {
        hcpTurn: lastHcpMessage,
        transcript: turns,
        scenario,
      });
    }

    if ((tier.includes("mediocre") || tier.includes("average")) && quality.answeredDirectly && quality.stayedOnConcern) {
      return asRepReplyPayload(normalizedDraft, draftPayload.concept, {
        hcpTurn: lastHcpMessage,
        transcript: turns,
        scenario,
      });
    }

    if (!tier.includes("mediocre") && !tier.includes("average")) {
      const strongPass = quality.answeredDirectly
        && quality.stayedOnConcern
        && quality.includedConcreteSpecificity
        && quality.advancedExchange
        && !quality.loopedBackToDiscovery;
      if (strongPass) {
        return asRepReplyPayload(normalizedDraft, draftPayload.concept, {
          hcpTurn: lastHcpMessage,
          transcript: turns,
          scenario,
        });
      }
    }

    const directFallback = tier.includes("mediocre") || tier.includes("average")
      ? buildDirectAskMediocreAnswer({ askType: directAsk.askType, scenario, turns })
      : buildDirectAskStrongAnswer({ askType: directAsk.askType, scenario, turns });

    return asRepReplyPayload(directFallback, draftPayload.concept, {
      hcpTurn: lastHcpMessage,
      transcript: turns,
      scenario,
      turnIndex,
    });
  }

  if (directAsk.hasDirectAsk) {
    const directFallback = tier.includes("weak")
      ? buildDirectAskWeakAnswer(directAsk)
      : tier.includes("mediocre") || tier.includes("average")
        ? buildDirectAskMediocreAnswer({ askType: directAsk.askType, scenario, turns })
        : buildDirectAskStrongAnswer({ askType: directAsk.askType, scenario, turns });
    return asRepReplyPayload(directFallback, draftPayload.concept, {
      hcpTurn: lastHcpMessage,
      transcript: turns,
      scenario,
    });
  }

  if (
    !directAsk.hasDirectAsk &&
    Number(turnIndex || turns.filter((turn) => turn?.speaker === "rep").length) >= 2 &&
    /^(can i ask|tell me more|how are you thinking about|what would you need to see|help me understand)/i.test(normalizedDraft)
  ) {
    return asRepReplyPayload(buildSolutionSeekingFallback({ scenario, turns }), draftPayload.concept, {
      hcpTurn: lastHcpMessage,
      transcript: turns,
      scenario,
    });
  }

  return asRepReplyPayload(buildSolutionSeekingFallback({ scenario, turns }), draftPayload.concept, {
    hcpTurn: lastHcpMessage,
    transcript: turns,
    scenario,
  });
}

function deriveImplementationConcreteAnswer(activeConcernText = "", scenario = {}) {
  const text = [activeConcernText, scenario?.objective, scenario?.description, scenario?.context]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/how does that simplify handoffs|without adding more steps|without adding more clicks|how does that reduce steps|what exactly changes for staff/.test(text)) {
    return "The workable version is one in-workflow update instead of a second follow-up list, callback, or duplicate handoff for staff";
  }
  if (/who owns|who picks that up|staff member/.test(text)) {
    return "The step usually lands on the MA or prior auth support, which only helps if it removes a handoff instead of adding one";
  }
  if (/what happens next|what step gets added|extra step|what does that add/.test(text)) {
    return "The only next step worth discussing is the one that replaces rework, not another loose task for staff";
  }
  if (/monitoring|follow-up/.test(text)) {
    return "I need to see whether follow-up stays inside the current workflow instead of creating a new staff touchpoint";
  }
  return "This has to be one cleaner workflow step, not another task the team has to absorb";
}

function deriveDiscoveryPatientFitAnswer(activeConcernText = "", scenario = {}) {
  const text = [activeConcernText, scenario?.objective, scenario?.description, scenario?.context]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/what specific patient need|what patient need|what unmet need|need you'?re not already covering/.test(text)) {
    return "The fit would have to be the patient whose current disease burden or treatment gap still leaves a real unmet need, not someone who is already doing well enough on the current path";
  }
  if (/clinical gain|what benefit|what'?s distinct|what makes it distinct/.test(text)) {
    return "The gain would have to be a clearer clinical improvement in the patients who are still not doing well enough on the current path, not just a different option that sounds interesting on paper";
  }
  if (/what makes this patient different|this patient would be any different|change this patient'?s treatment|make me change this patient'?s treatment/.test(text)) {
    return "The difference would have to be a patient whose current response is still not good enough that a clearer clinical gain would justify changing treatment, not someone who looks only marginally different on paper";
  }
  if (/non-responders|not responding to current therapy|responding to current therapy/.test(text)) {
    return "The fit would have to be the patient who is still not responding well enough on the current path and where a change in treatment would have to produce a clearer clinical gain, not just a theoretical alternative";
  }
  if (/what specifically would change|what would change/.test(text)) {
    return "The fit would have to be the patient where a treatment change would lead to a clearer clinical improvement you would actually notice, not just another option that sounds reasonable on paper";
  }
  if (/what specific patient characteristic|what patient characteristic|which characteristic|what characteristic/.test(text)) {
    return "The fit would have to be the patient whose clinical profile gives you a reason to change course, not someone who is only broadly eligible on paper";
  }
  if (/renal|comorbid|excluded|subgroup/.test(text)) {
    return "The fit would have to be the patient who still sits inside the evidence base, not the one whose renal or comorbidity profile pushes them outside it";
  }
  if (/screen|identify|candidate|selection/.test(text)) {
    return "The fit would have to be the patient whose chart gives you a concrete reason to act now, not someone you have to stretch to justify";
  }
  if (/workflow|access|prior auth/.test(text)) {
    return "The fit would have to be the patient where the added workflow is still realistic for the office to carry";
  }
  if (/early career|newer attending|building prescribing patterns|curious and open to guidance/.test(text)) {
    return "The fit would have to be the patient who is still not doing well enough on the current path and gives you a real reason to change treatment, not someone who is merely eligible in theory";
  }

  return "The fit would have to be the patient who actually matches the evidence and gives you a reason to change treatment, not just someone who is broadly eligible on paper";
}

function deriveCommitmentDirectAnswer(activeConcernText = "", proofPointCategory = "") {
  const text = String(activeConcernText || "").toLowerCase();
  if (/single metric|what one metric|what metric|single data point|what data point|concrete proof point|single proof point/.test(text)) {
    if (/hospital|readmission|admission|er\b|ed\b/.test(text)) {
      return "The single metric would be a hospitalization or readmission reduction large enough that you would actually change who you treat or how urgently you move, not just a broad utilization headline";
    }
    return "The single proof point would be one patient-level outcome you would actually use to change treatment choice, not a general positive trend from the slide deck";
  }
  if (/hospital|readmission|admission|er\b|ed\b/.test(text)) {
    return "The proof point has to be a hospitalization change large enough to alter what you would do for a real patient";
  }
  if (/guideline|treatment choice|decision|line of therapy|selection/.test(text)) {
    return "The proof point has to change a treatment decision you would actually make, not just add one more favorable line to a slide";
  }
  if (/symptom|flare|control|quality of life/.test(text)) {
    return "The proof point has to show a patient-level change you would actually notice in follow-up";
  }
  if (/workflow|prior auth|staff|access|formulary/.test(text)) {
    return "The proof point has to remove a real operational barrier, not just sound directionally helpful";
  }
  return `The proof point has to change something you would actually use in practice, ideally ${proofPointCategory}`;
}

function deriveCostValueConcreteAnswer(activeConcernText = "", scenario = {}) {
  const text = [activeConcernText, scenario?.objective, scenario?.description, scenario?.context]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/what's included|what is included|what does that include|what goes into that number|break down/.test(text)) {
    return "The number has to include the drug cost, any administration cost, and any added testing or monitoring if you want a real value discussion";
  }
  if (/total cost per patient|overall cost of treatment per patient|cost per patient/.test(text)) {
    return "The all-in cost per patient has to include the drug, any administration, and any added testing or monitoring";
  }
  if (/formulary|budget|justify the spend|evaluate value|cost-benefit|cost benefit/.test(text)) {
    return "The answer has to connect total cost per patient to the patient outcome that would actually justify the spend";
  }

  return "The all-in cost per patient has to include the drug, any administration, and any added testing or monitoring";
}

function hasConcreteCostValueAnswer(text = "") {
  const normalized = String(text || "").toLowerCase();
  return /all-in cost per patient|total cost per patient|drug cost, any administration, and any added testing or monitoring|full cost picture|cost picture/i.test(normalized);
}

function hasCostValueGapAdmission(text = "") {
  const normalized = String(text || "").toLowerCase();
  return /gap i still need to close|still need to close|shouldn't pretend the value case is complete|still haven't answered the value question|still don't have a clean exact number|still need to break out/i.test(normalized);
}

function hasMonitoringCostRange(text = "") {
  const normalized = String(text || "").toLowerCase();
  return /\$500 to \$2,000|500 to 2,000|range is still too broad|monitoring costs.*per patient per year|average added monitoring cost|added cost for monitoring/i.test(normalized);
}

function isCostValueConcernText(text = "") {
  const normalized = String(text || "").toLowerCase();
  return /total cost per patient|overall cost of treatment per patient|cost per patient|what's included|what is included|what does that include|what goes into that number|break down|formulary|budget|justify the spend|evaluate value|cost-benefit|cost benefit|what am i supposed to do with|what do i do with|how am i supposed to use that|incremental cost|added cost per patient|extra testing|extra monitoring|follow-up costs|follow up costs|testing and monitoring|specific added cost per patient.*monitoring|exact added cost per patient.*monitoring|specific added cost.*monitoring|exact added cost.*monitoring|average added monitoring cost|added cost for monitoring|monitoring cost per patient|average monitoring cost|don't need another efficacy point|do not need another efficacy point|not another efficacy point|worth the spend|cost side|what we'd spend|does the outcome justify/i.test(normalized);
}

function isCostValueRedirectText(text = "") {
  const normalized = String(text || "").toLowerCase();
  return /don't need another efficacy point|do not need another efficacy point|not another efficacy point|specific lab test and monitoring schedule|lab test and monitoring schedule|monitoring schedule|lab test schedule|added testing and monitoring|testing and monitoring cost|what's the exact cost per patient for the added testing and monitoring|exact cost per patient for the added testing and monitoring/i.test(normalized);
}

function getRecentHcpTexts(turns = [], limit = 4) {
  return turns
    .filter((turn) => turn?.speaker === "hcp" && typeof turn?.text === "string")
    .slice(-limit)
    .map((turn) => turn.text.trim())
    .filter(Boolean);
}

function isCostValueThreadActive(turns = [], scenario = {}) {
  const openingContext = [
    scenario?.openingScene,
    scenario?.objective,
    scenario?.description,
    scenario?.context,
  ]
    .filter(Boolean)
    .join(" ");

  if (isCostValueConcernText(openingContext)) {
    return true;
  }

  return getRecentHcpTexts(turns, 5).some((text) => isCostValueConcernText(text));
}

function shouldHoldCostValueLane({ scenario, turns, activeConcernText = "", lastRepText = "", draft = "" }) {
  const stageText = `${scenario?.journeyStage || ""}`.toLowerCase();
  if (!/clinical_value|clinical_value/.test(stageText)) {
    return false;
  }

  const costThreadActive = isCostValueThreadActive(turns, scenario);
  const costConcern = isCostValueConcernText(activeConcernText);
  const redirectedBackToCost = costThreadActive && isCostValueRedirectText(activeConcernText);
  if (!costConcern && !redirectedBackToCost) {
    return false;
  }

  return (
    hasCostValueGapAdmission(lastRepText) ||
    hasConcreteCostValueAnswer(lastRepText) ||
    hasMonitoringCostRange(lastRepText) ||
    hasConcreteCostValueAnswer(draft) ||
    hasMonitoringCostRange(draft) ||
    redirectedBackToCost ||
    costThreadActive
  );
}

function buildCostValueFollowThroughReply({ scenario, turns, activeConcernText = "" }) {
  const repTurns = turns.filter((turn) => turn?.speaker === "rep").length;
  const normalized = String(activeConcernText || "").toLowerCase();
  const lastRepText = normalizeForMatch(getLastRepText(turns));

  if (/don't need another efficacy point|do not need another efficacy point|not another efficacy point/.test(normalized)) {
    if (/full cost per patient|total cost per patient|all-in cost|value discussion is still incomplete|haven't given you enough information/.test(lastRepText)) {
      return "Right, and that means I need to stay on the missing cost number, not circle back to efficacy. Until I can give you the full per-patient cost, including the added testing and monitoring, I still haven't answered the value question.";
    }
    return "I should stay on the cost question. If I can't break out the full cost per patient, including any added testing and monitoring, I still haven't given you enough information to judge whether it's worth it.";
  }

  if (/average added monitoring cost|added cost for monitoring|monitoring cost per patient|average monitoring cost|specific added cost per patient.*monitoring|exact added cost per patient.*monitoring|specific added cost.*monitoring|exact added cost.*monitoring/.test(normalized)) {
    if (/incremental spend per patient|added monitoring cost per patient|pin down cleanly|break out cleanly/.test(lastRepText)) {
      return "I still don't have the added monitoring cost per patient broken out cleanly enough. The next useful move is coming back with that exact number instead of stretching the answer.";
    }
    return "If the sticking point is the added monitoring cost itself, that's the number I still need to pin down. Until I can give you that cost per patient without hiding behind a broad range, I still haven't answered the cost question well enough.";
  }

  if (/what am i supposed to do with|what do i do with|how am i supposed to use that/.test(normalized)) {
    return "If the all-in number still isn't useful, I need to separate the added testing and monitoring cost on top of the base treatment. If I can't show that cleanly, I still haven't made the value discussion usable.";
  }

  if (/what's included|what is included|what does that include|what goes into that number|break down/.test(normalized)) {
    return "If you need the breakdown, it has to separate the drug, any administration, and whatever testing or monitoring gets layered on top. If I can't break that out clearly, I still haven't answered the value question.";
  }

  if (/incremental cost|added cost per patient|extra testing|extra monitoring|follow-up costs|follow up costs|testing and monitoring/.test(normalized)) {
    if (/incremental spend per patient|added monitoring cost per patient|break out cleanly/.test(lastRepText)) {
      return "I still don't have the added testing and monitoring cost per patient broken out cleanly enough. The next useful step is coming back with that cost breakout instead of broadening the value story.";
    }
    return repTurns >= 4
      ? "If the sticking point is the added testing and monitoring cost, that's the number I still need to break out clearly. Until I can show that incremental spend per patient, I still haven't answered the value question."
      : "If the sticking point is the added testing and monitoring cost, I need to separate that incremental spend from the base drug cost. Until I can show that clearly, I still haven't answered the value question.";
  }

  if (/exact cost|total cost per patient|overall cost of treatment per patient|cost per patient/.test(normalized)) {
    if (/full per-patient cost cleanly|gap i still need to close|haven't answered the value question/.test(lastRepText)) {
      return "I still don't have the exact per-patient cost broken out cleanly enough. The next useful step is coming back with the full cost picture instead of pretending the value case is settled.";
    }
    return repTurns >= 4
      ? "If you need the exact number, that's the gap I still need to close. Until I can show the full per-patient cost cleanly, I shouldn't pretend the value case is complete."
      : "If the sticking point is the exact number, I need to break out the drug cost from the added testing and monitoring cost. Until I can show that clearly, I still haven't answered the value question.";
  }

  if (/formulary|budget|justify the spend|evaluate value|cost-benefit|cost benefit/.test(normalized)) {
    return "I need to separate the drug cost, the added monitoring, and the overall budget impact. If I can't separate those cleanly, I still haven't earned a real formulary discussion.";
  }

  return "If the all-in cost is still the blocker, I need to separate the drug cost from the added testing and monitoring cost. Until I can do that cleanly, the value discussion is still incomplete.";
}

function hasConcreteOperationalAnswer(text = "") {
  const normalized = String(text || "").toLowerCase();
  return /one cleaner handoff|second callback list|duplicate entry|separate monitoring task|inside the current workflow|new staff task|new handoff|staff step|operational/i.test(normalized);
}

function buildOperationalFollowThroughReply({ activeConcernText = "", turns }) {
  const normalized = String(activeConcernText || "").toLowerCase();
  const repTurns = turns.filter((turn) => turn?.speaker === "rep").length;
  const lastRepText = normalizeForMatch(getLastRepText(turns));

  if (/if this does not add another staff step|if this doesn't add another staff step|if this stays inside the current workflow|if this does not create another handoff|if staff does not inherit another step|extra work for my team/.test(normalized)) {
    if (/new handoff|new callback|new staff task|second callback|separate follow-up task|real workflow value/.test(lastRepText)) {
      return "It has to stay concrete. No second handoff, no callback list, and no separate follow-up task for staff. If any one of those still shows up, it still does not fit your workflow.";
    }
    return "It has to stay concrete. No second handoff, no callback list, and no separate follow-up task for staff. If any one of those still shows up, it still does not fit your workflow.";
  }

  if (/reduce callbacks|callbacks|follow-up phone calls|follow up phone calls|specific step that reduces callbacks|discharge process/.test(normalized)) {
    if (/cleaner handoff|back-and-forth steps|staff rework|workflow value/.test(lastRepText)) {
      return "The step that should reduce callbacks is getting the needed information into the visit or discharge handoff before staff has to chase it later. If the team still has to make a second call to close the loop, it still is not helping the workflow.";
    }
    return "The step that should reduce callbacks is getting the needed information into the visit or discharge handoff before staff has to chase it later. If the team still has to make a second call to fix the same issue, it is not reducing rework.";
  }

  if (/how does it actually reduce|how does that actually reduce|how does this actually reduce|how does it actually get to me|point of care/.test(normalized)) {
    if (repTurns >= 4) {
      return "The only way it reduces rework is if the information reaches the visit before staff has to chase it down, re-enter it, or call back for it later. If that handoff still happens after the visit, it isn't reducing rework.";
    }
    return "I need to know whether the information reaches the visit before staff has to chase it, re-enter it, or call back for it later. If it still lands after the visit, it isn't helping the workflow.";
  }

  if (/reduce rework|staff rework|actually reduce/.test(normalized)) {
    if (repTurns >= 4) {
      return "If the question is how it cuts rework, I need to answer that directly. It only helps if it removes one repeat callback, one duplicate entry, or one back-and-forth handoff for staff. If it doesn't remove one of those, it isn't helping the workflow.";
    }
    return "If the blocker is staff rework, I need to know whether this removes a repeat callback, a duplicate entry, or a back-and-forth handoff. Which of those is the rework pain point in your clinic?";
  }

  if (/what step gets added|added step|what changes in my workflow|what specific workflow step|one step/.test(normalized)) {
    if (repTurns >= 4) {
      return "If you need the one exact step, that's the gap I still have to answer cleanly. Until I can show whether this is a handoff change, a callback change, or no added step at all, I haven't really closed the workflow question.";
    }
    return "If the blocker is the one exact step, the useful distinction is whether this changes the handoff, the callback list, or adds a separate staff task. Which of those is the part you need answered most directly?";
  }

  if (/what gets added|what staff|rework|handoff|workflow/.test(normalized)) {
    return "If this still sounds too broad, the next useful answer is whether staff picks up a new handoff, a second callback, or a separate follow-up task. If none of that changes, that's the real workflow value.";
  }

  return "If the workflow question is still open, the next useful answer is whether this creates a new handoff, a new callback, or a new staff task. If it does, it still doesn't fit.";
}

function shouldUseDeterministicEvidenceFitRewrite({ scenario, turns, currentBehaviorState, currentJourneyState, draft }) {
  const activeConcernText = getActiveConcernText(turns, scenario);
  const familyText = `${scenario?.journeyStage || ""} ${currentBehaviorState || ""} ${currentJourneyState || ""} ${(scenario?.interactionPressure || []).join(" ")}`;
  const isClinicalSkepticism = /clinical_value|skeptical|clinical_value/i.test(familyText);
  const repeatedConcern = hasRepeatedObjection(turns);
  const directDemand = DIRECT_ANSWER_TRIGGER.test(activeConcernText);
  const firstRepTurn = turns.filter((turn) => turn?.speaker === "rep").length === 0;
  const issueLabel = extractIssueLabel(activeConcernText);
  const draftTooLoose = BROAD_DISCOVERY_PATTERN.test(String(draft || "").trim()) || ABSTRACT_QA_LANGUAGE_PATTERN.test(String(draft || "").trim());
  const highValueIssue = issueLabel === "guideline fit" || issueLabel === "cost impact" || issueLabel === "renal impairment";
  if (!isClinicalSkepticism) {
    return false;
  }

  if (firstRepTurn && highValueIssue) {
    return true;
  }

  return (repeatedConcern || directDemand) && draftTooLoose;
}

function shouldUseDeterministicCommitmentRewrite({ scenario, turns, draft }) {
  const stageText = `${scenario?.journeyStage || ""}`.toLowerCase();
  const isCommitmentStage = /commitment_close|adoption_implementation|access_formulary/.test(stageText);
  if (!isCommitmentStage) {
    return false;
  }

  const activeConcernText = getActiveConcernText(turns, scenario).toLowerCase();
  const repeatedConcern = hasRepeatedObjection(turns);
  const repTurns = turns.filter((turn) => turn?.speaker === "rep").length;
  const draftText = String(draft || "").toLowerCase();

  const stillProfiling =
    /what specific patient|describe the specific|what would need to happen|better understand what you're looking for|ideal patient profile|patient profile|good fit|perfect fit|minimum criteria|example of a patient profile|what would that patient need to look like/.test(draftText) ||
    (draftText.includes("?") && /patient|fit|profile|criteria/.test(draftText));
  const passiveMaybeSignal = /right patient|ideal patient|meaning to try it|haven't had one|not ready yet|committee|bring it up|process|need more data|still not convinced|not the right fit|perfect fit/.test(activeConcernText);
  const workflowDeferralDrift =
    /show you a simpler prior auth process|reduce that burden on your staff|bare minimum reduction in prior auth steps|worthwhile for your staff|simplifies it enough|extra step for my staff|prior auth process|one thing that needs to fit with your existing workflow|fits with what you're doing now/.test(draftText);
  const workflowDeferralSignal = /prior auth|staff|workflow|extra step|burden/.test(activeConcernText);
  const accessWorkflowExplorationDrift =
    /what's the biggest|what specifically made it tough|can you walk me through|walk me through what you know|how many prior auths|what specific data point|what specifically|what part of the process|what would change the formulary|what would need to fit|understand what specific steps|what do you think is involved/.test(draftText);
  const accessWorkflowSignal =
    /prior auth|staff|workflow|extra step|burden|formulary|non-preferred|review process|process|committee|p&t|approved|patient outcomes|reconsidered|concrete/.test(activeConcernText);
  const lateEnoughForAction = repTurns >= 1;

  return isCommitmentStage && (
    ((repeatedConcern || passiveMaybeSignal) && stillProfiling) ||
    ((repeatedConcern || workflowDeferralSignal) && workflowDeferralDrift) ||
    (lateEnoughForAction && accessWorkflowSignal && accessWorkflowExplorationDrift)
  );
}

function shouldUseDeterministicFamilyAnswerRewrite({ scenario, turns, draft }) {
  const stage = String(scenario?.journeyStage || "").toLowerCase();
  const activeConcernText = getActiveConcernText(turns, scenario);
  const repeatedConcern = hasRepeatedObjection(turns);
  const draftText = String(draft || "").trim();
  const draftTooLoose = BROAD_DISCOVERY_PATTERN.test(draftText) || ABSTRACT_QA_LANGUAGE_PATTERN.test(draftText);

  if (stage === "initial_access") {
    return (
      INITIAL_ACCESS_DIRECT_ASK_PATTERN.test(activeConcernText) ||
      EXPECTATION_MISMATCH_PATTERN.test(activeConcernText) ||
      INITIAL_ACCESS_OPERATIONAL_HELP_PATTERN.test(activeConcernText) ||
      repeatedConcern
    ) && (draftTooLoose || /\?$/.test(draftText) || INITIAL_ACCESS_REDISCOVERY_PATTERN.test(draftText));
  }

  if (stage === "access_formulary") {
    return (ACCESS_PROCESS_DEMAND_PATTERN.test(activeConcernText) || repeatedConcern) && draftTooLoose;
  }

  if (stage === "adoption_implementation") {
    return (WORKFLOW_DEMAND_PATTERN.test(activeConcernText) || repeatedConcern) && (draftTooLoose || WORKFLOW_REDISCOVERY_PATTERN.test(draftText));
  }

  if (stage === "early_discovery") {
    return (DISCOVERY_DIRECT_ASK_PATTERN.test(activeConcernText) || repeatedConcern) && (draftTooLoose || /\?$/.test(draftText));
  }

  return false;
}

function buildDeterministicFamilyAnswerReply({ scenario, turns }) {
  const stage = String(scenario?.journeyStage || "").toLowerCase();
  const activeConcernText = normalizeForMatch(getActiveConcernText(turns, scenario));
  const repTurns = turns.filter((turn) => turn?.speaker === "rep").length;
  const initialAccessBarrier = deriveInitialAccessBarrier(scenario, activeConcernText);
  const initialAccessChange = deriveInitialAccessOperationalChange(scenario, activeConcernText);

  if (stage === "initial_access") {
    if (/what'?s the one thing that'?s gonna change for me in the exam room|what's the one thing that's going to change for me in the exam room|what one thing changes for me in the exam room|what single change would make a tangible difference|what one thing changes in the exam room/.test(activeConcernText)) {
      return "What should change in the room is fewer loose ends after the visit: less back-and-forth, fewer callbacks, and a cleaner handoff before staff has to chase the same issue later. If that does not change, this is not helping your workflow.";
    }
    if (/discharge process|reduce callbacks|callbacks|follow-up phone calls|follow up phone calls|specific step that reduces callbacks|extra work for my team|extra work for staff|what extra work|what extra step|what does that add for my team/.test(activeConcernText)) {
      return "The practical change has to happen before the patient leaves. The needed information or access step has to be handled in the visit or discharge handoff so staff is not calling the patient back later to fix it. If that second call still happens, it is not helping the workflow.";
    }
    if (/what makes you think .* is (still )?the issue here|why do you think .* is our problem|what makes you think .* is our problem|what makes you think staff handoff is still the issue here|what makes you think staff handoff is our problem/.test(activeConcernText)) {
      return `The reason to test ${initialAccessBarrier} first is that it is often the point where staff gets pulled into extra callbacks, rework, or handoffs before care can move forward. If that is not happening in your clinic, I am on the wrong issue.`;
    }
    if (repTurns <= 1 && /what'?s the one thing you need from me|what do you need from me|what'?s the one thing i should know|one thing i should know|what'?s the one thing that could slow care|one thing that could slow care/.test(activeConcernText)) {
      return `What I need to know is whether ${initialAccessBarrier} is the step slowing care in your clinic. If it is not, this is not worth your time.`;
    }
    if (/what'?s the one thing that could slow care|one thing that could slow care|what'?s the one thing slowing care|what thing could slow care/.test(activeConcernText)) {
      return `What usually slows care is ${initialAccessBarrier}. If that is not the bottleneck in your clinic, this is not worth another minute.`;
    }
    if (/what'?s the one thing you need from me|what do you need from me|what'?s the one thing you need to know|one thing you need to know/.test(activeConcernText)) {
      return `What I need to know is whether ${initialAccessBarrier} is still slowing care in your clinic. If it is not, we can stop there.`;
    }
    if (/what'?s the one step that saves me time|what will actually save me time|one step that makes a difference in my workflow|one thing that'?s going to make a difference in my workflow|what step will actually save me time|still not seeing the time savings|time savings here/.test(activeConcernText)) {
      return `The step that should save time is ${initialAccessChange}. If it does not reduce that handoff or callback burden in your clinic, it is not worth another minute.`;
    }
    if (/relevant to my practice|relevant to my clinic|what makes this relevant|what sets your product apart/.test(activeConcernText)) {
      return `What makes this relevant is whether it leads to ${initialAccessChange}. If it does not change that in your clinic, it is not different enough to matter.`;
    }
    if (INITIAL_ACCESS_OPERATIONAL_HELP_PATTERN.test(activeConcernText)) {
      if (repTurns >= 2) {
        return `This has to be operational, not promotional. The concrete change would have to be ${initialAccessChange}.`;
      }
      return `The only reason to keep talking is if this helps with the prior auth work itself, not if it adds to it. The concrete value would have to be ${initialAccessChange}.`;
    }
    if (EXPECTATION_MISMATCH_PATTERN.test(activeConcernText)) {
      if (repTurns >= 2) {
        return "You're right, this did not land like the case discussion you expected. The only reason I'm here is to see whether one practical barrier is getting in the way of care, and if it is not, we can stop there.";
      }
      return "You're right, this did not land like the case discussion you expected. The only reason I'm here is to see whether one practical barrier is slowing care enough to matter in your clinic.";
    }
    if (/what specific barrier|what barrier are you looking for|what makes you think/.test(activeConcernText)) {
      if (repTurns >= 2) {
        return `The barrier I'm pressure-testing is ${initialAccessBarrier}. If that is not the issue in your clinic, I'll stop there instead of forcing this wider.`;
      }
      return `The barrier I'm pressure-testing is ${initialAccessBarrier}, because that is the kind of bottleneck that can quietly slow care before anyone means for it to.`;
    }
    if (/what specific access step|what specific change/.test(activeConcernText)) {
      return `The specific change would have to be ${initialAccessChange}. If it does not do that, it is not worth another minute of your time.`;
    }
    if (/what step gets added|what gets added|what changes for my staff|what changes for staff|what changes for me in the room/.test(activeConcernText)) {
      return `This only matters if it leads to ${initialAccessChange}. If it adds another step instead of doing that, it is not useful.`;
    }
    if (/what'?s this about|what is this about|why are you here|why are we talking/.test(activeConcernText)) {
      if (repTurns >= 2) {
        return `This is still about whether ${initialAccessBarrier} is slowing care enough to matter in your clinic. If that is not the issue here, we can stop there.`;
      }
      return `This is about whether ${initialAccessBarrier} is slowing care enough to be worth your time. If that is not actually happening here, this is not worth another minute.`;
    }
    if (/make this quick|short version|few minutes|patient waiting|brief/.test(activeConcernText)) {
      if (repTurns >= 2) {
        return `The short version is I'm trying to see whether ${initialAccessBarrier} is the thing slowing care, not pitch at you. If it is not, we can stop right there.`;
      }
      return `The short version is I'm trying to see whether ${initialAccessBarrier} is getting in the way of care. If it is not, this should end quickly.`;
    }
    return `This is about whether ${initialAccessBarrier} is worth solving in your clinic, not a broad product discussion.`;
  }

  if (stage === "access_formulary") {
    if (/what('?s| is) the one concrete thing|one concrete thing|exact formulary takeaway|what can i take back|what should i take back|committee-facing|proof item|what concrete item|what exactly do i bring back/.test(activeConcernText)) {
      return "The concrete thing to take back is one committee-facing summary that shows which patient group changes, what outcome improves in that group, and why that makes the current restriction harder to defend.";
    }
    if (/formulary|committee|review process|take back|carry forward|non-preferred|step therapy/.test(activeConcernText)) {
      if (repTurns >= 2) {
        return "The next useful move is a concrete formulary takeaway: one committee-facing summary of the specific patient group, the clinical outcome that improved, and the reason that would justify revisiting the restriction.";
      }
      return "This is not about another value story. The thing worth taking back is one committee-facing proof item that names the patient group, the outcome that changed, and why that should change the formulary discussion.";
    }
    if (repTurns >= 2) {
      return "The blocker is still the access step itself, not the clinical rationale. If this moves at all, it has to change one real process condition first.";
    }
    return "The blocker is the access step itself, not whether the therapy works on paper. The only useful discussion now is which part of that process is stopping movement.";
  }

  if (stage === "adoption_implementation") {
    if (/if this does not add another staff step|if this doesn't add another staff step|i can look at it|i can stay with it/.test(activeConcernText)) {
      if (repTurns >= 3) {
        return "It has to stay operational. No second callback list, no duplicate entry, and no separate monitoring task after discharge. If staff still has to pick up a new handoff to keep this moving, it still does not fit the workflow.";
      }
      return "The concrete standard is one in-workflow update instead of a second callback list, duplicate entry, or separate monitoring step for staff. If it still creates a new staff task after the visit, it still does not solve the workflow issue.";
    }
    if (/staff|workflow|monitoring|follow-up|what happens next|who picks that up|who owns that/.test(activeConcernText)) {
      if (/how does that simplify handoffs|without adding more steps|without adding more clicks|how does that reduce steps|what exactly changes for staff/.test(activeConcernText)) {
        if (repTurns >= 3) {
          return "Concretely, the workable version is one in-workflow update instead of a separate callback list, duplicate entry, or extra handoff for staff. If staff still has to create a second task to keep this moving, it is still the wrong fit.";
        }
        return "Concretely, the workable version is one in-workflow update instead of a separate callback list, duplicate entry, or extra handoff for staff. If it still creates another step after the visit, it still does not solve the workflow issue.";
      }
      if (repTurns >= 2) {
        return `${deriveImplementationConcreteAnswer(activeConcernText, scenario)}. If that does not hold, this is still a workflow problem.`;
      }
      if (repTurns >= 1) {
        return `${deriveImplementationConcreteAnswer(activeConcernText, scenario)}. I still need to understand whether it removes a handoff or creates one.`;
      }
      return `${deriveImplementationConcreteAnswer(activeConcernText, scenario)}. If that lands on the team as extra work, it is still the wrong fit.`;
    }
    return "The main question is whether this is workable in practice, not whether the idea makes sense. The only thing worth testing is whether it reduces the staff burden instead of widening it.";
  }

  if (stage === "early_discovery") {
    if (/what specific clinical profile would make me change course|what specific clinical profile makes you think i'?d change course|what clinical profile would make me switch, not just any patient|what clinical profile would make me switch|clinical profile makes you think i'd change course/.test(activeConcernText)) {
      return "The clinical profile would have to be the patient who is still not controlled well enough on the current treatment and whose disease burden or treatment response is poor enough that staying on the same path no longer makes clinical sense.";
    }
    if (/what specific patient issues are you trying to address|what specific issues are you trying to fix|what should i care about right now|what issues are you trying to fix that i should care about|what specific issues are you trying to address/.test(activeConcernText)) {
      return "The issue to care about is the patient who is still not meeting goals on the current path and where staying put no longer makes clinical sense because the current approach is not controlling the problem well enough.";
    }
    if (/what makes this patient distinct enough to change course|what specific treatment challenges make a patient distinct enough to change course|what specific patient factor makes them distinct enough|what'?s the one thing that would make me change course for a patient|what one thing would make me change course for a patient|what patient factor would make me change course/.test(activeConcernText)) {
      return "The thing that should make you change course is a patient who is still not doing well enough on the current treatment because the current path is no longer controlling the problem well enough to justify staying with it.";
    }
    if (repTurns <= 1 && /what makes you think your treatment is relevant to my patients|what makes you think this is relevant to my patients|why is this relevant to my patients/.test(activeConcernText)) {
      return "The patient would have to be someone who is still not doing well enough on the current path that a change in treatment would be worth considering, not someone who is only technically eligible.";
    }
    if (/what specific outcome would make me change course|what specific outcome would change|what outcome would change|change my treatment approach|what clinical gain would matter|what benefit would make me switch|what'?s the specific outcome that would make me change course|what specific clinical gain|what benefit would actually make me switch/.test(activeConcernText)) {
      return "The outcome would have to be a clear enough clinical gain in the patients who are still not doing well on the current path that it would justify changing treatment, not just add another theoretical option.";
    }
    if (DISCOVERY_DIRECT_ASK_PATTERN.test(activeConcernText)) {
      if (repTurns >= 2) {
        return `${deriveDiscoveryPatientFitAnswer(activeConcernText, scenario)}. If the evidence cannot isolate that kind of patient clearly enough to change your decision, it is still too broad to be useful.`;
      }
      return `${deriveDiscoveryPatientFitAnswer(activeConcernText, scenario)}. The real test is whether that patient is distinct enough that you would actually change course instead of staying on the current path.`;
    }
    return "The first useful step is getting specific about which patient actually creates the decision, not staying broad.";
  }

  return "Let me keep this on the one practical issue that matters here. The only thing worth testing is where the current workflow still breaks down.";
}

function buildDeterministicEvidenceFitReply({ scenario, turns }) {
  const activeConcernText = getActiveConcernText(turns, scenario);
  const issueLabel = extractIssueLabel(activeConcernText);
  const lowerConcern = normalizeForMatch(activeConcernText);
  const repTurns = turns.filter((turn) => turn?.speaker === "rep").length;
  const hcpTurns = turns.filter((turn) => turn?.speaker === "hcp").length;
  const scenarioEvidenceText = normalizeForMatch([
    scenario?.objective,
    scenario?.description,
    scenario?.context,
    scenario?.openingScene,
    ...(scenario?.keyChallenges || []),
    ...(scenario?.interactionPressure || []),
  ].filter(Boolean).join(" "));

  const isRenalClinicalValueConcern = /renal|kidney|egfr|gfr|dose adjustment|dose reduction|moderate renal impairment/.test(`${lowerConcern} ${scenarioEvidenceText}`);
  if (isRenalClinicalValueConcern) {
    const renalIntent = (() => {
      if (/what'?s the plan to get that renal subgroup data|what'?s the plan to get renal subgroup data|what'?s the plan to get that subgroup data|what'?s the plan to get that subgroup analysis|what'?s the plan for getting that subgroup analysis|what'?s the plan to get that renal subgroup analysis|what'?s the plan for getting that renal subgroup analysis|what'?s the plan to get renal-specific subgroup data|what'?s the plan to get renal-specific data|what'?s the plan to get renal data|what'?s the plan to get that subgroup readout|plan to get that subgroup readout|what'?s the plan to close that evidence gap|what'?s the plan to actually close that gap|plan to close that gap|close that evidence gap|close that gap for my patients|what'?s the timeline for that subgroup analysis|what'?s the timeline for that renal subgroup analysis|what'?s the expected completion timeline for that analysis|what'?s the earliest i can expect that subgroup analysis|what'?s the earliest i can expect concrete subgroup results|what'?s the earliest i can expect to see that subgroup analysis|when can i expect subgroup results|when can i expect concrete subgroup results|still waiting for that subgroup analysis|still waiting for meaningful subgroup analysis|still no timeline/.test(lowerConcern)) {
        return "plan_timeline";
      }
      if (/renal safety threshold|what'?s the actual renal safety threshold|what'?s the renal safety threshold|safe for my renal-impaired patients|still no answer on renal safety|still doesn'?t address renal safety|renal safety in my patients|renal safety for my patients|actual renal safety data after dose adjustment|renal safety data after dose adjustment/.test(lowerConcern)) {
        return "safety_threshold";
      }
      if (/specific egfr threshold|egfr threshold|gfr threshold|dose adjustment threshold|threshold for dose reduction|what'?s the exact threshold|what'?s the renal threshold where benefit holds up|what'?s the exact renal threshold|what'?s the actual dose reduction threshold|actual threshold number/.test(lowerConcern)) {
        return "dose_threshold";
      }
      if (/actual efficacy in renal-impaired patients|renal-specific efficacy after dose adjustment|actual benefit after dose adjustment|retained efficacy after dose adjustment/.test(lowerConcern)) {
        return "efficacy_after_adjustment";
      }
      if (/how this applies to my patients with renal issues|moderate renal impairment|my renal patients|compromised renal function|patient population/.test(lowerConcern)) {
        return "applicability";
      }
      return null;
    })();

    if (renalIntent === "plan_timeline") {
      if (repTurns >= 4) {
        return "For the moderate renal-impairment subgroup, the treatment decision stays unchanged until a dedicated subgroup analysis shows acceptable renal safety, retained benefit, and a usable post-dose-adjustment threshold. I do not have a committed readout date I can defend today, and the concrete next step I can own is bringing you the formal subgroup-analysis plan or start notice once it is actually opened.";
      }
      return "The only credible plan is a dedicated renal subgroup analysis with stratified efficacy, renal-safety, and post-dose-adjustment endpoints in the moderate renal-impairment patients driving your decision. If I bring you that formal analysis plan once it is opened, would that be the right next checkpoint rather than stretching the current dataset today?";
    }

    if (renalIntent === "safety_threshold") {
      if (repTurns >= 4) {
        return "There is no validated renal safety threshold in this dataset that lets me defend changing treatment for the moderate renal-impairment subgroup today. So for those patients I would keep the treatment decision unchanged until a subgroup readout shows acceptable renal safety after dose adjustment in the same patients where retained benefit still holds.";
      }
      return "The direct answer is that I do not have a validated renal safety threshold I can give you for the moderate renal-impairment patients you manage. The missing evidence is a subgroup readout showing acceptable renal safety after dose adjustment in the same patients where retained benefit still holds; is that the bar you would need before revisiting the decision?";
    }

    if (renalIntent === "dose_threshold") {
      if (repTurns >= 4) {
        return "There is no validated renal threshold in this dataset that lets me defend changing treatment for the moderate renal-impairment subgroup today. Until a renal-specific readout shows where benefit still holds with acceptable safety after dose adjustment, the decision stays unchanged for those patients.";
      }
      return "That threshold is exactly the missing evidence. The study supports dose reduction in moderate renal impairment, but it does not give a validated renal cutoff where you can say the adjusted regimen still preserves enough benefit with acceptable safety to justify treatment.";
    }

    if (renalIntent === "efficacy_after_adjustment") {
      if (repTurns >= 4) {
        return "I cannot show renal-specific efficacy after dose adjustment strong enough to justify changing treatment for the moderate renal-impairment subgroup today. So until a subgroup readout shows retained efficacy alongside acceptable renal safety, I would keep the treatment decision unchanged for that population.";
      }
      return "The direct answer is that we do not have renal-specific efficacy after dose adjustment strong enough to change treatment for the moderate renal-impairment subgroup today. Until the subgroup readout shows retained efficacy alongside acceptable renal safety, I would keep the current decision in place.";
    }

    if (renalIntent === "applicability") {
      if (repTurns >= 4) {
        return "For the moderate renal-impairment patients you actually manage, this still is not decision-level evidence. The study does not isolate that subgroup cleanly enough to show retained benefit, acceptable renal safety, and a usable threshold after dose adjustment, so I would keep the treatment decision unchanged.";
      }
      return "The direct answer is that the study still does not isolate the moderate renal-impairment patients you actually manage well enough to show whether benefit still justifies treatment once dosing is adjusted. Until a renal-specific subgroup readout closes that gap, I would not treat this as decision-level evidence for those patients.";
    }
  }

  if (hcpTurns === 0 && repTurns === 0) {
    if (/renal|kidney|egfr|gfr|dose adjustment|dose reduction|moderate renal impairment/.test(scenarioEvidenceText)) {
      return "For the moderate renal-impairment patients you manage, the unresolved issue is that the study still does not show whether benefit holds, whether renal safety stays acceptable, or where the usable threshold sits after dose adjustment. Until a renal-specific subgroup readout answers those three questions, I would not present this as decision-level evidence for that subgroup.";
    }
    if (/guideline|subgroup|comorbid|generalizable|patient population/.test(scenarioEvidenceText)) {
      return "The issue is whether the subgroup behind the data actually matches the more complex patients who drive treatment decisions in your practice, because if it does not, the evidence still does not justify changing course.";
    }
    if (/cost|readmission|hospitalization|value|outcomes/.test(scenarioEvidenceText)) {
      return "The issue is whether the data changes a real patient or utilization decision in practice, because without that, the value story still does not justify changing what you do now.";
    }
  }

  if (/what'?s the plan to get that renal subgroup data|what'?s the plan to get renal subgroup data|what'?s the plan to get that subgroup data|what'?s the plan to get that subgroup analysis|what'?s the plan for getting that subgroup analysis|what'?s the plan to get that renal subgroup analysis|what'?s the plan for getting that renal subgroup analysis|what'?s the earliest you can get that subgroup analysis started|what'?s the earliest i can expect that subgroup analysis|what'?s the earliest i can expect to see that renal subgroup analysis|what'?s the earliest i can expect concrete subgroup results|what'?s the timeline for that renal subgroup analysis|what'?s the timeline for that subgroup analysis|when can i expect subgroup results|when can i expect those subgroup results|still waiting for that subgroup analysis|still waiting to see some meaningful subgroup analysis|still waiting for meaningful subgroup analysis|that still doesn't give me a timeline|that still does not give me a timeline/.test(lowerConcern)) {
    if (repTurns >= 4) {
      return "The concrete plan is to start a dedicated renal subgroup analysis now with stratified efficacy, renal-safety, and dose-adjusted outcome endpoints, and the honest answer is that I do not have a committed readout date I can defend yet. So the decision today stays unchanged for the moderate renal-impairment subgroup until that renal-specific readout is actually available.";
    }
    return "The concrete next step is a dedicated renal subgroup analysis started now, with predefined efficacy, renal-safety, and dose-adjusted outcome endpoints in the moderate renal-impairment subgroup. Until that readout exists, I would not change treatment for that subgroup based on the current dataset.";
  }

  if (/that still doesn'?t tell me what happens with dose adjustment in moderate renal impairment|still doesn'?t answer my renal dose adjustment question|still does not answer my renal dose adjustment question/.test(lowerConcern)) {
    return "For moderate renal impairment, the actual dose adjustment is to reduce the starting dose by 50%, but the dataset still does not tell you clearly enough whether that adjusted regimen preserves enough efficacy and acceptable renal safety to justify treatment for the subgroup driving your decision. So today I would keep the treatment decision where it is for that subgroup.";
  }

  if (/what'?s the dose adjustment threshold for moderate renal impairment|what'?s the actual dose adjustment for moderate renal impairment|what is the actual dose adjustment for moderate renal impairment|actual dose adjustment for moderate renal impairment|specific dosing recommendations for patients with moderate renal impairment|dosing recommendations for patients with moderate renal impairment|what'?s the actual dose adjustment for moderate renal impairment, not just what the study doesn'?t prove/.test(lowerConcern)) {
    return "For moderate renal impairment, the dosing recommendation is to reduce the starting dose by 50%. The unresolved question is whether that adjusted regimen still preserves enough efficacy and acceptable renal safety to justify treatment for the subgroup driving your decision.";
  }

  if (/that still doesn'?t tell me what i need for my moderate renal impairment patients|that still doesn'?t tell me what i need for my patients with moderate renal impairment|still concerned that the data doesn'?t adequately account for the renal function issues i see in my patient population|still concerned that the data doesn'?t provide sufficient reassurance for my patients with compromised renal function|renal function issues i see in my patient population|renal function issues i commonly see in my patient population/.test(lowerConcern)) {
    return "For the moderate renal-impairment patients driving your decision, I still do not have evidence strong enough to tell you the adjusted regimen keeps enough efficacy and acceptable renal safety to justify changing treatment. If you need the blocker narrowed further, is the missing piece for you retained efficacy after dose adjustment, renal safety, or the threshold where the benefit still holds?";
  }

  if (/that still doesn'?t tell me about renal safety in my patients|that still doesn'?t address renal safety for my patients|still doesn'?t address renal safety|still does not address renal safety|concerned that the data doesn'?t adequately mitigate the risks associated with renal impairment|renal safety in my patients|renal safety for my patients|mitigate the risks associated with renal impairment|if it'?s safe for my renal-impaired patients|safe for my renal-impaired patients|renal safety concern/.test(lowerConcern)) {
    if (repTurns >= 4) {
      return "Then for the moderate renal-impairment patients you manage, I would keep the treatment decision unchanged today. The missing evidence is a subgroup readout showing acceptable renal safety after dose adjustment in the same patients where retained benefit still holds, and until that paired readout exists I should not ask you to change treatment for that subgroup.";
    }
    return "The direct answer is that I do not have renal-specific safety data strong enough to support changing treatment for the moderate renal-impairment patients you manage. The missing evidence is a subgroup readout showing acceptable renal safety after dose adjustment in the same patients where retained benefit still holds; is that paired safety-and-benefit readout the bar you would need before revisiting the decision?";
  }

  if (/what'?s the renal safety profile after dose adjustment|what'?s the actual renal safety data after dose adjustment|what'?s the actual renal safety data after dose adjustment, specifically|adjusted dosing regimen'?s impact on renal function|impact on renal function.*specific subset/.test(lowerConcern)) {
    return "The direct answer is that we do not have renal-specific safety data after dose adjustment strong enough to change treatment for the moderate renal-impairment subgroup today. What would change that is a subgroup readout showing acceptable renal safety after dose adjustment in the same patients where retained efficacy still holds.";
  }

  if (/what'?s the actual renal safety data in patients with moderate impairment|what'?s the actual renal safety data you can give me for these patients|what'?s the renal safety threshold i can use in practice/.test(lowerConcern)) {
    return "The direct answer is that I cannot give you renal-specific safety data or a safety threshold you can use in practice for the moderate renal-impairment subgroup today. Until a subgroup readout shows acceptable renal safety after dose adjustment in the same patients where efficacy still holds, I would keep the treatment decision unchanged for that population.";
  }

  if (/how do you account for the renal function variability in your dosing strategy|benefits outweigh the potential risks for my patients with compromised renal function|still not convinced that the benefits outweigh the potential risks/.test(lowerConcern)) {
    return "The direct answer is that I cannot show enough renal-specific efficacy and safety together to say the benefits outweigh the renal risks for the moderate renal-impairment subgroup today. Until a subgroup readout shows retained benefit and acceptable renal safety after dose adjustment in that population, I would keep the treatment decision where it is.";
  }

  if (/what subgroup data do you have that would change my treatment decision|what specific renal data would change my treatment decision|what specific renal data would change my treatment decision for these patients|what specific renal data would make a difference for my patients|renal-specific efficacy for my patients|renal specific efficacy for my patients|plan to get renal-specific efficacy data|plan to get renal specific efficacy data|what'?s the plan to get renal-specific subgroup data|what is the plan to get renal-specific subgroup data|plan to get renal-specific subgroup data|what'?s the plan to get renal-specific data|what is the plan to get renal-specific data|plan to get renal-specific data|what'?s the plan to get renal data|what is the plan to get renal data|plan to get renal data|what'?s the plan for getting that renal data|what is the plan for getting that renal data|what'?s the plan to get that subgroup readout|what is the plan to get that subgroup readout|plan to get that subgroup readout|what'?s the plan for getting renal data now|what is the plan for getting renal data now|what'?s the plan for getting that renal data now|what is the plan for getting that renal data now|what'?s the plan to get that data now|what is the plan to get that data now|still no renal-specific efficacy data|still no renal specific efficacy data|compelling evidence.*renal impairment|effectively manages the disease in patients with renal impairment|what specific data on renal safety.*give you confidence|specific data on renal safety.*give you confidence/.test(lowerConcern)) {
    if (/plan to get renal-specific efficacy data|plan to get renal specific efficacy data|what'?s the plan to get renal-specific subgroup data|what is the plan to get renal-specific subgroup data|plan to get renal-specific subgroup data|what'?s the plan to get renal-specific data|what is the plan to get renal-specific data|plan to get renal-specific data|what'?s the plan to get renal data|what is the plan to get renal data|plan to get renal data|what'?s the plan for getting that renal data|what is the plan for getting that renal data|what'?s the plan for getting renal data now|what is the plan for getting renal data now|what'?s the plan for getting that renal data now|what is the plan for getting that renal data now|what'?s the plan to get that data now|what is the plan to get that data now|what'?s the plan to get that subgroup readout|what is the plan to get that subgroup readout|plan to get that subgroup readout/.test(lowerConcern)) {
      return "If renal-specific safety and retained benefit are the bar, the only credible plan is a dedicated renal subgroup analysis or follow-up cohort that reports both after dose adjustment in the moderate renal-impairment patients driving your decision. Until that paired renal readout exists, I would not ask you to change treatment for that subgroup.";
    }
    if (/what specific data on renal safety.*give you confidence|specific data on renal safety.*give you confidence/.test(lowerConcern)) {
      return "The renal-safety data that would justify confidence is a subgroup readout in the moderate renal-impairment patients you actually manage showing acceptable renal safety after dose adjustment alongside retained efficacy. Without that paired readout, I would not change treatment for that subgroup.";
    }
    if (/still no renal-specific efficacy data|still no renal specific efficacy data|compelling evidence.*renal impairment|effectively manages the disease in patients with renal impairment/.test(lowerConcern)) {
      return "You're right that there is still no renal-specific efficacy evidence you can use to change treatment for those patients today. The only thing that would move that decision is a renal-specific readout showing that the adjusted regimen still delivers enough disease control in the moderate renal-impairment subgroup.";
    }
    if (/what specific renal data would change my treatment decision|what specific renal data would change my treatment decision for these patients|what specific renal data would make a difference for my patients/.test(lowerConcern)) {
      return "The renal data that would change the decision is a subgroup readout showing three things in the moderate renal-impairment patients you actually treat: retained efficacy after dose adjustment, acceptable renal safety, and a usable threshold for where the benefit still holds. Without those three pieces, I would not change treatment for that subgroup.";
    }
    return "The subgroup data that would change your treatment decision is renal-specific efficacy after dose adjustment in the moderate renal-impairment patients you actually manage. We do not have that readout today, so I would not ask you to change treatment for that subgroup on the current dataset. If you need the narrower blocker named, it is whether the adjusted regimen still holds enough efficacy in that subgroup to justify treatment at all.";
  }

  if (/still no renal-specific efficacy after dose adjustment|still no renal specific efficacy after dose adjustment|that still doesn't give me renal-specific efficacy after dose adjustment|that still does not give me renal-specific efficacy after dose adjustment|i'm not seeing any improvement in renal outcomes even when we optimize the dosing regimen|im not seeing any improvement in renal outcomes even when we optimize the dosing regimen|no improvement in renal outcomes even when we optimize the dosing regimen/.test(lowerConcern)) {
    if (repTurns >= 4) {
      return "Then the decision today stays unchanged for the moderate renal-impairment subgroup. We still do not have a renal-specific readout showing that dose adjustment preserves enough efficacy and renal safety to justify treatment, and that exact subgroup evidence is the only thing that would change the decision.";
    }
    return "The direct answer is that we still do not have renal-specific efficacy after dose adjustment strong enough to justify treatment for the moderate renal-impairment subgroup today. Until a subgroup readout shows retained efficacy and acceptable renal safety after dose adjustment in that population, I would keep the current decision in place.";
  }

  if (/that subgroup analysis is still not scheduled|still no subgroup analysis scheduled|still no renal subgroup analysis scheduled|subgroup analysis is not scheduled|not scheduled, is it|still no subgroup analysis/.test(lowerConcern)) {
    return "You're right that without that subgroup analysis actually scheduled, there is still no new evidence path you can use to justify changing treatment. The honest position is to keep the current treatment decision in place for the moderate renal-impairment subgroup until that renal-specific analysis is formally underway and results are available.";
  }

  if (/timeline|earliest|when can.*subgroup|when will.*subgroup|concrete timeline|concrete plans/.test(lowerConcern) && /subgroup|renal|kidney/.test(lowerConcern)) {
    return "I do not have a committed subgroup-results date I can defend today, so for the moderate renal-impairment subgroup the treatment decision stays unchanged. The strongest concrete next step I can own is bringing you the formal renal subgroup-analysis plan or start notice once it is actually opened, and only revisiting the decision when that stratified efficacy and renal-safety readout is in hand.";
  }

  if (/that'?s not a plan, that'?s a delay|that is not a plan, that is a delay|that delay affects dosing for my renal patients now|delay affects dosing/.test(lowerConcern)) {
    return "You're right that the current gap leaves you making renal dosing decisions now without the subgroup readout you need. The responsible interim position is not to over-claim the dataset for those renal patients, and the only credible next step is a renal-specific follow-up cohort or registry that reports stratified efficacy, renal safety, and real-world outcomes after dose adjustment.";
  }

  if (/what'?s the plan to get real-world outcomes for my patients|plan to get real-world outcomes|real-world outcomes for my patients|real world outcomes for my patients/.test(lowerConcern)) {
    return "The real-world plan has to be a renal-specific follow-up cohort or registry in the moderate renal-impairment patients you actually manage, with predefined dose-adjustment, renal-safety, and retained-benefit endpoints. Until that real-world renal readout exists, I would not present the current dataset as decision-level evidence for your patients.";
  }

  if (/prior auth workflow|prior authorization workflow|workflow for this medication|prior auth process/.test(lowerConcern)) {
    return "The workflow only matters if the renal-adjusted patient still has enough expected benefit to justify pushing through prior auth at all. If the evidence still does not tell you that, the workflow argument does not rescue the decision.";
  }

  if (/plan to study renal impairment|close the renal evidence gap|knowledge gap on renal safety|through your clinical trials or post-marketing studies|plan for studying renal impairment/.test(lowerConcern)) {
    return "The plan would have to be a dedicated renal-impairment cohort or follow-up analysis that tracks dose adjustment, renal safety, and retained clinical benefit in the patients who were excluded or underrepresented in the original study. Until that reads out, the interim position is that the current dataset still leaves the renal decision open.";
  }

  if (/timeline for those dosing adjustment studies|timeline for dosing adjustment studies|interim plan for dosing adjustments|what's the interim plan for dosing adjustments|what is the interim plan for dosing adjustments|what's the timeline for those dosing adjustment studies|timeline for renal studies|timeline for the renal studies/.test(lowerConcern)) {
    return "The near-term plan would have to be a renal-specific follow-up cohort with predefined dose-adjustment and renal-safety endpoints. Until that reads out, the interim position is that the current dataset is not strong enough to treat the renal-impaired patient as if the question is settled.";
  }

  if (/plan for dosing adjustments in renal-impaired patients|dosing adjustments in renal-impaired patients|how will you handle dosing adjustments in renal-impaired patients/.test(lowerConcern)) {
    return "The credible plan would be a renal-specific dosing program with predefined adjustment rules, renal-safety tracking, and retained-benefit readouts. Until that dataset is in hand, the current evidence does not give you a clean renal-adjusted dosing answer.";
  }

  if (/actual reduction in adverse events|what'?s the actual reduction in adverse events|reduction in adverse events with that dose adjustment|actual adverse-event reduction/.test(lowerConcern)) {
    return "That exact renal-specific adverse-event reduction is not established cleanly in the current dataset. That is still part of the evidence gap, because you do not have a renal-adjusted safety readout strong enough to anchor treatment choice.";
  }

  if (/what'?s the actual renal benefit|what is the actual renal benefit|actual benefit for my moderate renal impairment patients|actual benefit for my renal patients|benefit for my moderate renal impairment patients|benefit for my renal patients|what happens with my patients who have moderate renal impairment|what happens with my moderate renal impairment patients|that still doesn'?t tell me how this applies to my patients with moderate renal impairment|that still doesn'?t address my renal-impaired patients'? needs|that still doesn'?t answer my question about moderate renal impairment|meaningfully improve outcomes for my patients who have moderate kidney function issues/.test(lowerConcern)) {
    if (repTurns >= 4) {
      return "For the moderate renal-impairment patients you actually manage, I would not use this dataset to change treatment today. We still do not have a renal-specific subgroup readout after dose adjustment showing retained benefit and acceptable safety, so it is not decision-level evidence for that population.";
    }
    return "The direct answer is that I cannot show a proven renal-specific benefit for the moderate renal-impairment patients you manage. The study does not give a renal-specific efficacy readout after dose adjustment that lets you say the benefit still clearly justifies treatment for that subgroup.";
  }

  if (/what'?s the threshold for dose adjustment in moderate renal impairment|what'?s the dosing adjustment for moderate renal impairment|threshold for dose adjustment in moderate renal impairment|actual renal impairment threshold that triggers a dose adjustment|how do you define the renal impairment threshold that triggers a dose adjustment|renal impairment threshold that triggers a dose adjustment/.test(lowerConcern)) {
    return "That threshold is still not defined cleanly in the current dataset. The study supports dose reduction in moderate renal impairment, but it does not give a validated renal cutoff that tells you exactly when the adjusted dose still preserves enough benefit to justify treatment.";
  }

  if (/what subgroup data do you have|subgroup data for patients with moderate renal impairment|subgroup analysis for moderate renal impairment|moderate renal impairment subgroup analysis|show me the renal function subgroup analysis|renal function subgroup analysis|show me the actual numbers for moderate renal impairment|actual numbers for moderate renal impairment|actual numbers for my patient population|numbers for my patient population|what numbers do you have for my patient population|show me actual numbers, not just claims|closest renal-specific data|closest renal specific data|closest renal-specific outcome|closest renal specific outcome/.test(lowerConcern)) {
    if (repTurns >= 4) {
      return "You're right to hold on the moderate renal subgroup. We still do not have renal-specific subgroup numbers for the patients you are focused on, so I cannot tell you this is proven for that subgroup yet, and the responsible position today is not to over-apply the broader dataset to your renal patients.";
    }
    return "You're right to ask for the subgroup data directly. We do not have a renal-specific subgroup readout with numbers strong enough for the moderate renal-impairment patients you are talking about, so I would not change treatment for that subgroup today. The next credible step would have to be a dedicated renal subgroup analysis or follow-up cohort, and until that exists I would not present the current dataset as decision-level evidence for your renal patients.";
  }

  if (/exacerbations in severe asthmatics|severe asthmatics|severe asthma subgroup|severe asthma data|exacerbation data/.test(lowerConcern)) {
    return "You're right to ask for the severe-asthma outcome data directly. We do not have a subgroup analysis clean enough to tell you how much exacerbation reduction holds in the severe asthmatics driving your decision, so I cannot present that as established today. The next credible step would have to be a dedicated subgroup analysis or follow-up dataset that isolates those patients and reports the exacerbation outcome cleanly.";
  }

  if (/that subgroup is exactly who i'm worried about|that subgroup is still my concern|that subgroup analysis is exactly what i need to see|that subgroup analysis is still my priority|that subgroup analysis is still missing|that subgroup analysis is crucial|that subgroup analysis is what i need to see, nothing else|that subgroup analysis is what i need to see|that subgroup analysis is what i need to change practice|that subgroup analysis is the only way i'?ll consider changing treatment for my renal patients|show me that subgroup analysis now|show me the renal subgroup data now|still waiting on that subgroup analysis|still waiting for that subgroup analysis|what's the data on those subgroups|what is the data on those subgroups|data on those subgroups|i need subgroup data to move forward|still no subgroup data|subgroup data i need|still need to see more robust subgroup analysis|robust subgroup analysis|more detailed breakdown of the patient subsets|detailed breakdown of the patient subsets|more detailed breakdown of the patient populations|detailed breakdown of the patient populations|more detailed breakdown of the patient population|detailed breakdown of the patient population|patient population details|specific insights i need|i'm still missing the specific insights i need|i need that subgroup analysis to make a decision|i still need that subgroup analysis|i still need that subgroup analysis to make a decision|that still doesn't give me the subgroup analysis i need|still no subgroup analysis for my patients|still unclear on renal subgroup benefits|still waiting for subgroup data on moderate renal impairment/.test(lowerConcern)) {
    if (/that subgroup analysis is exactly what i need to see|that subgroup analysis is still my priority|that subgroup analysis is crucial|that subgroup analysis is what i need to see, nothing else|that subgroup analysis is what i need to see|that subgroup analysis is what i need to change practice|that subgroup analysis is the only way i'?ll consider changing treatment for my renal patients|show me that subgroup analysis now|show me the renal subgroup data now/.test(lowerConcern)) {
      return "Then the plan has to stay on that subgroup analysis, not on broader claims. The next credible move is a dedicated renal subgroup analysis with stratified efficacy, renal-safety, and retained-benefit endpoints in the moderate renal-impairment patients you actually treat, because that is the readout you are telling me you would need before changing practice.";
    }
    if (/i need subgroup data to move forward|still no subgroup data|subgroup data i need|specific insights i need|specific data i need|i'm still missing the specific insights i need|particular population i see in my practice|meaningful subgroup analysis|i need that subgroup analysis to make a decision|i still need that subgroup analysis|i still need that subgroup analysis to make a decision|that still doesn't give me the subgroup analysis i need|still no subgroup analysis for my patients|still waiting for that subgroup analysis|still unclear on renal subgroup benefits|still waiting for subgroup data on moderate renal impairment|more detailed breakdown of the patient population|detailed breakdown of the patient population|patient population details/.test(lowerConcern)) {
      if (/specific insights i need|specific data i need|i'm still missing the specific insights i need|particular population i see in my practice|meaningful subgroup analysis|more detailed breakdown of the patient population|detailed breakdown of the patient population|patient population details/.test(lowerConcern)) {
        return "The specific insight still missing for your population is a renal-specific subgroup readout showing whether the dose-adjusted patients with moderate renal impairment keep enough benefit and acceptable renal safety to justify treatment. Until that subgroup readout exists, I cannot tell you the evidence applies cleanly to the population you actually manage.";
      }
      return "You're right not to move forward without that subgroup readout. The concrete plan has to be a dedicated renal subgroup analysis with stratified efficacy, renal-safety, and retained-benefit endpoints in the moderate renal-impairment patients you actually treat, and until that readout exists I would not ask you to treat that subgroup as settled. If that is the bar, I would keep the conversation on getting that analysis rather than pretending the answer is already there.";
    }
    return "You're right that the subgroup analysis is still the open issue. We do not have a renal-specific subgroup analysis with stratified efficacy and safety for the moderate renal-impairment patients you are focused on, so until that readout exists I cannot tell you this is established for the patients driving your decision.";
  }

  if (/show me the pooled dataset|pooled dataset|show me the actual numbers for that pooled dataset|actual numbers for that pooled dataset|show me the numbers now|show me the numbers, now/.test(lowerConcern)) {
    return "I can show you the broader pooled dataset, but it still would not answer the moderate renal-impairment question cleanly because it is not a renal-specific subgroup analysis with stratified efficacy and safety. That is why the pooled data still falls short for the patients you are focused on.";
  }

  if (/what'?s the data look like for that specific subgroup|what'?s the closest subgroup you have to moderate renal impairment|closest subgroup you have to moderate renal impairment|closest real-world data you have to moderate renal impairment|closest real-world outcome for moderate renal impairment|closest real-world outcome/.test(lowerConcern)) {
    if (repTurns >= 4) {
      return "The closest data still is not close enough for me to tell you this is established in moderate renal impairment. Without a renal-specific subgroup or real-world renal outcome set after dose adjustment, I would not ask you to treat that subgroup as if the evidence question were settled.";
    }
    return "The closest thing we have is a broader subgroup or pooled dataset, but not a renal-specific moderate impairment analysis with stratified efficacy and safety. That is exactly why the evidence still does not answer the renal question cleanly enough for the patients you are describing.";
  }

  if (/what'?s the plan to address it|what'?s the plan to get that subgroup data|what'?s the plan to get renal subgroup data|plan to get that subgroup data|plan to get renal subgroup data|what'?s the plan to get that subgroup analysis|what'?s the plan for getting that subgroup analysis|what'?s the plan to get that renal subgroup analysis|what'?s the plan for getting that renal subgroup analysis|what'?s the plan to get that subgroup analysis to me|what'?s the plan to get that subgroup analysis done within the next quarter|plan to get that subgroup analysis|plan for getting that subgroup analysis|plan to get that renal subgroup analysis|plan for getting that renal subgroup analysis|plan to get that subgroup analysis to me|plan to get that subgroup analysis done within the next quarter|what'?s the plan to get renal-specific data for my patients|plan to get renal-specific data for my patients|what'?s the plan to get that renal data|plan to get that renal data|still my concern, what'?s the plan to address it|plan to address the subgroup|still doesn't answer my renal question|still does not answer my renal question|expedite that analysis|plan to expedite that analysis|what'?s the plan to expedite that analysis/.test(lowerConcern)) {
    if (repTurns >= 4) {
      return "You're right that without renal-specific data the decision is still open. The only credible plan is a dedicated renal-impairment subgroup analysis or follow-up cohort that reports stratified efficacy, renal safety, and retained benefit after dose adjustment in the moderate renal-impairment patients you actually manage. The concrete step I can own is bringing you that formal subgroup-analysis plan once it is opened, and until that readout exists I would keep the current treatment decision unchanged for your renal patients.";
    }
    return "You're right that without renal-specific data the decision is still open. The only credible plan is a dedicated renal-impairment subgroup analysis or follow-up cohort that reports stratified efficacy, renal safety, and retained benefit after dose adjustment in the moderate renal-impairment patients you actually manage. If I bring you that formal subgroup-analysis plan once it is opened, would that be the right next checkpoint instead of pushing the current dataset today?";
  }

  if (/when do i get that renal subgroup analysis to make a decision|when do i get that subgroup analysis to make a decision|i need that subgroup analysis to make a decision now|i need that subgroup analysis to make a decision/.test(lowerConcern)) {
    return "You do not have a renal subgroup readout you can use for that decision today, and I do not want to pretend otherwise. The responsible answer is not to treat the renal-impaired subgroup as settled until the dedicated renal subgroup analysis is completed and reports stratified efficacy and renal-safety results.";
  }

  if (/what'?s the timeline for it|what'?s the timeline for the subgroup analysis|what'?s the timeline for that subgroup analysis|what'?s the timeline for that dedicated renal subgroup analysis|what'?s the earliest i can expect that subgroup analysis|what'?s the earliest i can expect to see that renal subgroup analysis|what'?s the earliest i can expect concrete subgroup results|what'?s the earliest you can get that subgroup analysis started|what'?s the earliest i can expect concrete subgroup data|earliest i can expect that subgroup analysis|i need that subgroup analysis now, not later|need that subgroup analysis now|how soon can i expect that subgroup analysis|when will that subgroup analysis be available|when will those subgroup results be available|when can i anticipate seeing the detailed breakdown|when can i expect subgroup results|when can i expect those subgroup results|when can we expect those renal subgroup results|concrete plans for when we can expect those renal subgroup results|concrete plans for when we can expect subgroup results|you still haven't given me a timeline|i need a timeline for that subgroup analysis now|i need a timeline now|peer-reviewed journal|peer reviewed journal|within the next quarter|how do you intend to address the knowledge gap on subgroup outcomes|knowledge gap on subgroup outcomes|still waiting to see some meaningful subgroup analysis|still waiting for meaningful subgroup analysis|still waiting for subgroup analysis|still waiting to see subgroup results|earliest i can expect concrete subgroup results|when will the renal subgroup analysis start|credible answer on renal impairment|still waiting for that renal subgroup analysis/.test(lowerConcern)) {
    if (repTurns >= 5) {
      return "You're right that without a committed subgroup-results date this still does not change the decision for the moderate renal-impairment subgroup. So for those patients I would keep the treatment decision unchanged today. The concrete next step I can own is bringing you the formal renal subgroup-analysis plan or start notice once it is actually opened, with stratified efficacy, renal-safety, and post-dose-adjustment endpoints, and I would only revisit the decision when that renal-specific readout is in hand.";
    }
    return "There is not a subgroup-analysis readout you can use today. The earliest credible next step is to start a dedicated renal-impairment subgroup analysis or follow-up cohort with stratified efficacy, renal safety, and retained-benefit endpoints. If I bring you that formal plan once it is underway, would that be the right point to revisit the decision rather than stretching the current dataset now?";
  }

  if (/that doesn'?t help my moderate renal impairment patients|that still doesn'?t address my renal patients'? needs|that still doesn'?t give me a clear answer for my renal patients|still doesn'?t address my renal patients|still does not address my renal patients|still doesn'?t address my renal patients'? needs|still does not address my renal patients'? needs|still doesn'?t address my renal patients needs|still does not address my renal patients needs/.test(lowerConcern)) {
    if (repTurns >= 4) {
      return "For your renal patients today, I would not use this study to change treatment. The practical answer is to stay with the current path for the moderate renal-impairment subgroup until there are renal-specific subgroup numbers showing retained benefit and acceptable renal safety after dose adjustment. That is the one evidence condition that would change the decision.";
    }
    return "The direct answer for your renal patients is that this study is not decision-level evidence for the moderate renal-impairment subgroup. If you need an answer you can use in practice today, it is not to change treatment for that subgroup until renal-specific subgroup results exist.";
  }

  if (/that still doesn'?t answer my question about moderate renal impairment|still doesn'?t answer my renal impairment question|still does not answer my renal impairment question|i'?m still unclear how your data accounts? for the potential risks in patients with compromised renal function|still doesn'?t address my renal impairment concerns|still does not address my renal impairment concerns|i remain unconvinced that your data adequately accounts? for the potential risks in patients with compromised renal function/.test(lowerConcern)) {
    if (repTurns >= 4) {
      return "Then the decision today is not to treat the moderate renal-impairment subgroup as proven. The reason is simple: you still do not have renal-specific subgroup numbers, a validated threshold where benefit clearly holds after dose adjustment, or renal-focused outcome data strong enough to defend the treatment decision. The only thing that changes that position is a dedicated renal subgroup readout showing retained benefit and acceptable renal safety in that subgroup.";
    }
    return "The direct answer is that the dataset still does not clear the renal decision for the moderate renal-impairment patients you actually manage. You do not have the renal-specific subgroup numbers, validated threshold, or renal-focused outcomes you would need to say the benefit still clearly justifies treatment after dose adjustment. If your blocker is narrower than that, do you need proof on retained renal efficacy, renal safety, or both in the same subgroup readout?";
  }

  if (/how this applies to my patients with renal issues|accounts? for renal impairment|accounts? for the potential risks in patients with compromised renal function|how does your data account for renal impairment|how does your data account for renal function|moderate renal impairment|moderate kidney function impairment|renal implications.*patient population|renal implications that are most relevant to my patient population/.test(lowerConcern)) {
    if (/still doesn't tell me how this applies to my patients with renal issues|still doesn't address my patients with renal issues|still doesn't address my patients with moderate renal impairment|still doesn't apply to my renal patients|doesn't apply to my renal patients|that still doesn't help my patients with moderate renal impairment|that doesn't help my moderate renal impairment patients|that's not enough for my patients with moderate renal impairment|that's still not enough for my patients|still not enough for my patients with renal issues|doesn't address my moderate renal impairment|moderate renal impairment concern|renal patients|kidney disease are a significant portion of my practice|compromised renal function|my renal patients have unique challenges/.test(lowerConcern)) {
      if (repTurns >= 4) {
        return "For the moderate renal-impairment patients you actually manage, the unresolved problem is that the current dataset still does not show renal-specific subgroup numbers, a validated post-dose-adjustment threshold, or real-world renal outcomes strong enough to justify changing treatment. Until those data exist, the decision stays unchanged for that subgroup.";
      }
      if (repTurns >= 3) {
        return "For your renal patients today, the missing piece is still a subgroup readout in the moderate renal-impairment patients you actually treat showing retained benefit, acceptable renal safety, and a usable threshold after dose adjustment. Until that exists, I would not treat this as decision-level evidence for that subgroup.";
      }
      return "The applicability gap is that the study still does not isolate the moderate renal-impairment patients you actually treat, so it leaves open whether benefit still justifies treatment once dosing is adjusted for that subgroup. Until a renal-specific subgroup readout closes that gap, I would not treat this as decision-level evidence for those patients.";
    }
    if (/that still doesn't give me the renal data i need|still no renal data|still no renal data for my patients|still no answer on renal impairment subgroup/.test(lowerConcern)) {
      if (repTurns >= 4) {
        return "There is still no renal dataset strong enough to justify changing treatment for those patients today. The only thing that changes that decision is renal-specific subgroup numbers or a renal-focused real-world outcomes set after dose adjustment, and until that exists I would keep the current treatment decision where it is.";
      }
      return "The missing renal dataset is the blocker now. Without renal-specific subgroup numbers or real-world renal outcomes after dose adjustment, I cannot tell you this is decision-level evidence for the patients you actually manage. The only credible next step is the dedicated renal subgroup analysis.";
    }
    if (/still no renal data, so i'm not convinced|still no clear renal data, so i'm not convinced|i need concrete subgroup results, not promises|i remain skeptical without seeing any outcomes related to kidney function/.test(lowerConcern)) {
      return "You're right to hold the line there. Without renal-specific subgroup numbers, threshold data, or outcomes tied to kidney function after dose adjustment, I would not change treatment for the renal-impaired subgroup today, because the evidence still is not strong enough to support that decision.";
    }
    if (repTurns >= 4) {
      return "The missing renal dataset is still the blocker. We do not have the renal-specific numbers or real-world renal readout you would need for the moderate renal-impairment patients you actually manage, so I would not change treatment for that subgroup today.";
    }
    if (repTurns >= 3) {
      return "The missing threshold and subgroup readout are the real blockers now. We still do not have a validated renal threshold or subgroup readout that tells you where the benefit clearly holds up after dose adjustment in moderate renal impairment, which is why the evidence still feels incomplete for your patients.";
    }
    return "It still does not apply cleanly enough to your renal-impaired patients, because the study does not prove how much benefit remains once dosing is adjusted for the people you actually treat.";
  }

  if (/what specific data do you have that changes my current approach|what specific data justifies deviating from current guidelines|what specific data justifies deviating from the established treatment guidelines|what specific data do you have to change my practice|what specific evidence do you have that changes my current practice/.test(lowerConcern)) {
    return "The data that would change practice is the subgroup analysis in the harder-to-treat patients who were still not controlled on the standard path, because that is the part of the study that could justify a different treatment decision instead of just supporting the usual guideline path.";
  }

  if (/real-world renal data|what real-world renal data do you have|what renal data do you have for patients like mine|renal data do you have that's relevant to my patients/.test(lowerConcern)) {
    if (repTurns >= 4) {
      return "The remaining missing piece is a renal-specific real-world dataset showing how the moderate renal-impairment patient actually does after dose adjustment in practice. Until that dataset exists, I cannot tell you this changes care confidently for those patients, and I would not present it that way.";
    }
    return "We do not have a clean real-world renal dataset that tells you how the renal-impaired patient performs after dose adjustment in practice. That missing renal-specific readout is still the reason the evidence does not clear your decision bar.";
  }

  if (/specific egfr threshold|egfr threshold|gfr threshold|threshold where dose reduction still justifies treatment|what'?s the e?gfr threshold|what'?s the gfr threshold|minimum egfr where you still see a benefit|lowest egfr where you(?:'ve)? (?:actually )?seen preserved efficacy|lowest egfr where efficacy is still preserved|at what threshold of renal function do the benefits.*diminish|at what point does the renal impairment become a limiting factor|exact threshold for switching treatments|what'?s the actual renal impairment threshold where this still works|what'?s the renal threshold where benefit holds up after dose adjustment|what'?s the exact threshold for renal impairment where the benefit still holds|what'?s the exact renal threshold|what'?s the renal dose adjustment threshold|what'?s the dose adjustment threshold for renal impairment|what is the dose adjustment threshold for renal impairment|what'?s the actual dose adjustment threshold for moderate renal impairment|what'?s the actual threshold for dose reduction in renal impairment|what is the actual threshold for dose reduction in renal impairment|what'?s the actual dose reduction threshold|what is the actual dose reduction threshold|what'?s the actual dose reduction threshold for renal impairment|what is the actual dose reduction threshold for renal impairment|exact dose adjustment threshold for moderate renal impairment|exact renal dose adjustment threshold|specific renal dose adjustment criteria|renal dose adjustment criteria|renal safety threshold|renal safety threshold for dose adjustment in moderate impairment|renal safety threshold for dose adjustment in my patients|renal safety threshold after dose adjustment|specific renal safety threshold for dose adjustment|renal safety threshold, exactly|actual number for renal safety threshold|actual threshold number for renal safety|actual threshold number|exact threshold for dose adjustment in renal impairment|what'?s the exact threshold\??|what is the exact threshold\??|at what level of kidney function does the efficacy.*drop off|at what level of renal impairment does the treatment'?s efficacy start to drop off|what'?s the exact gfr threshold where efficacy drops off|where efficacy drops off/.test(lowerConcern)) {
    if (repTurns >= 4) {
      return "There is no validated renal safety threshold in this dataset that lets me defend changing treatment for the moderate renal-impairment subgroup today. So until a renal-specific readout shows where renal safety remains acceptable and benefit still holds after dose adjustment, the treatment decision stays unchanged for those patients.";
    }
    return "That threshold is exactly the problem: the study supports dose reduction in moderate renal impairment, but it does not give a validated renal safety threshold where you can say the lower dose still preserves enough benefit with acceptable safety to justify treatment for every patient.";
  }

  if (/what specific comorbidities did the study account for|what comorbidities did this study account for|what comorbidities were included|what comorbidities were represented/.test(lowerConcern)) {
    return "It reflects the cleaner patients better than the higher-burden patients with layered renal disease, cardiovascular burden, and multi-comorbidity that usually make the treatment choice difficult in practice. That is why the results still feel incomplete for the patients you are thinking about.";
  }

  if (/that subgroup analysis still doesn't reflect my patient population|that subgroup analysis does not reflect my patient population|still doesn't reflect my patient population|doesn't reflect my patient population|still doesn't capture my patient population'?s complexity|doesn't capture my patient population'?s complexity|still doesn't capture my complex patients|doesn't capture my complex patients|my moderate renal impairment patients aren't well represented in these trials|not well represented in these trials/.test(lowerConcern)) {
    return "For the higher-complexity renal patients you actually manage, this still is not decision-level evidence. The study population is cleaner than the moderate renal-impairment subgroup driving your decision, so until a renal-specific subgroup readout shows retained benefit, acceptable renal safety, and a usable threshold after dose adjustment, I would keep the current treatment decision unchanged.";
  }

  if (/how the patient population.*reflects the complexity i see in my own practice|reflect the complexity i see in my own practice|how does the study population reflect the complexity i see in practice|generalizable/.test(lowerConcern)) {
    return "It does not reflect that complexity cleanly enough yet, because the study population still looks closer to the cleaner trial patient than to the renal-burdened, multi-comorbid patient who actually forces the harder treatment decision in practice. So for that higher-complexity renal subgroup, I would keep the current treatment decision unchanged until a subgroup readout shows retained benefit, acceptable renal safety, and a usable threshold after dose adjustment.";
  }

  if (/what('?s| is) the specific subgroup|what specific subgroup|what subgroup data|specific subgroup data|which subgroup|what specific patient subgroup|what subgroup does this data actually apply to|what subgroup does this data apply to/.test(lowerConcern)) {
    return "The subgroup that would matter is the patient who still is not controlled on the standard path and whose renal burden, comorbidity load, or treatment complexity makes you question whether the usual evidence still applies cleanly. If the data does not isolate that subgroup, it still does not change treatment choice.";
  }

  if (/what'?s the clinical implication of that threshold for my patients|clinical implication of that threshold|what does that threshold mean for my patients|what does that threshold mean in practice/.test(lowerConcern)) {
    return "The clinical implication is that without a validated renal threshold, you do not have a defensible point where you can say the dose-adjusted regimen still justifies treatment for the higher-risk renal subgroup. So in practice the treatment decision stays unchanged for those patients until a renal-specific readout shows where benefit still holds with acceptable safety.";
  }

  if (/what'?s the actual renal safety after dose adjustment|actual renal safety after dose adjustment|real-world renal safety data after dose adjustment|what'?s the real-world renal safety data after dose adjustment|actual renal safety data after dose adjustment|renal safety data after dose adjustment/.test(lowerConcern)) {
    if (repTurns >= 4) {
      return "I cannot show renal-specific safety after dose adjustment strong enough to justify changing treatment for the moderate renal-impairment subgroup today. So until a subgroup readout shows acceptable renal safety after dose adjustment in the same patients where efficacy still holds, I would keep the treatment decision unchanged for that population.";
    }
    return "The direct answer is that we do not have renal-specific safety data after dose adjustment strong enough to change treatment for the moderate renal-impairment subgroup today. Until a subgroup readout shows acceptable renal safety after dose adjustment in the same patients where efficacy still holds, I would keep the current decision in place.";
  }

  if (/actual efficacy in renal-impaired patients|efficacy in renal-impaired patients|renal-specific efficacy after dose adjustment|renal specific efficacy after dose adjustment|what'?s the actual efficacy after dose adjustment for moderate renal impairment|what'?s the actual renal efficacy after dose adjustment|what'?s the actual renal efficacy after dose adjustment, not just the threshold|how does that dosing adjustment impact efficacy|what actual efficacy/.test(lowerConcern)) {
    if (repTurns >= 4) {
      return "I cannot show renal-specific efficacy after dose adjustment strong enough to justify changing treatment for the moderate renal-impairment subgroup today. So until a subgroup readout shows retained efficacy after dose adjustment in the same patients where renal safety remains acceptable, I would keep the treatment decision unchanged for that population.";
    }
    return "The direct answer is that we do not have renal-specific efficacy after dose adjustment strong enough to change treatment for the moderate renal-impairment subgroup today. Until a subgroup readout shows retained efficacy after dose adjustment in the same patients where renal safety remains acceptable, I would keep the current decision in place.";
  }

  if (/what'?s the actual benefit after dose adjustment for my moderate renal impairment patients|actual benefit after dose adjustment for my moderate renal impairment patients|actual benefit after dose adjustment for my renal patients|actual benefit after dose adjustment/.test(lowerConcern)) {
    return "The direct answer is that we do not have renal-specific benefit data after dose adjustment strong enough to change treatment for the moderate renal-impairment subgroup today. Until a subgroup readout shows retained benefit after dose adjustment in the same patients where renal safety remains acceptable, I would keep the current decision in place.";
  }

  if (/how does that subgroup analysis account for renal function|how does renal function impact treatment in your study|what'?s the actual impact on my patients'? renal function|actual impact on my patients'? renal function|renal dosing adjustment|what'?s the dosing adjustment for renal impairment|what'?s the dose adjustment for renal impairment|actual dose adjustment for renal impairment|what'?s the actual dose reduction for renal impairment|what'?s the exact dose reduction|what'?s the exact dose reduction for renal impairment|what'?s the exact dose for moderate renal impairment|what'?s the actual dose adjustment for moderate renal impairment|what is the actual dose adjustment for moderate renal impairment|actual dose adjustment for moderate renal impairment/.test(lowerConcern) && !/what'?s the renal threshold where benefit holds up after dose adjustment|what'?s the exact threshold for renal impairment where the benefit still holds|what'?s the exact renal threshold/.test(lowerConcern)) {
    if (/what'?s the actual dose adjustment for moderate renal impairment|what is the actual dose adjustment for moderate renal impairment|actual dose adjustment for moderate renal impairment/.test(lowerConcern)) {
      return "The dose adjustment is to reduce the starting dose by 50% in moderate renal impairment, but the unresolved issue is whether that reduced dose still preserves enough benefit to justify treatment for the renal-impaired patient you actually see.";
    }
    if (/dose adjustment for renal impairment|actual dose reduction for renal impairment|exact dose reduction|exact dose reduction for renal impairment|exact dose for moderate renal impairment/.test(lowerConcern)) {
      return "For moderate renal impairment, the starting dose is reduced by 50%. The unresolved question is whether that reduced dose still preserves enough benefit to justify treatment for the renal-impaired patients driving your decision.";
    }
    if (repTurns >= 4) {
      return "The actual renal impact is still not resolved cleanly enough for me to tell you the lower dose preserves enough benefit in the moderate renal-impairment patient. That is why I would not present the renal-adjusted regimen as a settled practice answer yet.";
    }
    return "The renal issue is that the study supports a lower starting dose in moderate renal impairment, but it still does not tell you clearly enough whether the reduced dose preserves enough control to justify treating that patient rather than staying on the current path.";
  }

  if (/dose-adjust|dose adjustment|dose reduction|adjustment/.test(lowerConcern)) {
    return "You're asking whether the dose reduction still leaves enough benefit to justify treatment in the renal-impaired patient you actually see. If the lower dose protects tolerability but weakens control too much, it does not change the decision in your favor.";
  }

  if (/what specific patient outcome improvement|what specific outcome improvement|tangible benefit|patient outcomes compared to what i'm currently using|what'?s the exact threshold that changes treatment|what'?s the exact egfr threshold for that subgroup|renal threshold that changes treatment|what'?s the exact renal threshold where i need to switch treatment|what'?s the exact renal threshold where i need to switch treatments|what'?s the specific renal threshold that changes my treatment choice|what'?s the actual renal threshold where the benefit holds up|what'?s the actual renal threshold where benefit holds up|actual renal threshold where the benefit holds up|actual renal threshold where benefit holds up|what'?s the exact threshold that changes my treatment decision|at what specific point does the data suggest i should switch|at what level of renal impairment does the treatment'?s efficacy start to drop off|dose adjustment for renal impairment/.test(lowerConcern)) {
    if (repTurns >= 3) {
      return "There is not a validated renal threshold or outcome cutoff in this dataset that tells you exactly when the benefit still justifies treatment in the higher-risk renal patient. That is the unanswered piece blocking a real treatment decision.";
    }
    return "The outcome would have to change something you would actually notice in the patient, not just move a broad study average. If it does not change treatment choice or follow-up for the patient in front of you, it is still too soft.";
  }

  if (issueLabel === "renal impairment") {
    const renalConcern = normalizeForMatch(activeConcernText);
    if (/doesn'?t help me with the renal impairment subgroup|doesn'?t address my renal impairment subgroup concern|doesn'?t address renal impairment in my patients|renal function issues i see in my patient population|renal function issues i commonly see in my patient population/.test(renalConcern)) {
      if (repTurns >= 4) {
        return "For the renal-impairment subgroup in your practice, the decision today is still not to change treatment on this dataset. What would change that is a renal-specific subgroup readout showing retained benefit, acceptable renal safety, and a usable post-dose-adjustment threshold in the patients you actually manage.";
      }
      return "For the renal-impairment subgroup you are describing, I still cannot show practice-usable evidence that the adjusted dose preserves enough benefit and safety to justify changing treatment. So for that subgroup today, I would keep the current treatment decision where it is, and the only evidence that would change that is a renal-specific subgroup readout with retained efficacy, acceptable renal safety, and a usable threshold after dose adjustment.";
    }
    if (/doesn'?t tell me what i need for my moderate renal impairment patients|still doesn'?t address my renal concerns|still does not address my renal concerns|benefits outweigh the potential renal risks/.test(renalConcern)) {
      return "For your moderate renal-impairment patients, I still cannot show enough renal-specific evidence to justify changing treatment today. The missing evidence is a subgroup readout showing that efficacy still holds after dose adjustment, renal risk stays acceptable, and the same patients still have a usable threshold where benefit clearly outweighs risk.";
    }
    if (/what subgroup data do you have for dose adjustment in renal impairment|renal-specific subgroup numbers|renal-specific subgroup data|subgroup data.*renal impairment/.test(renalConcern)) {
      return "We do not have subgroup data that tells you, after dose adjustment, which moderate renal-impairment patients still keep enough benefit and safety to justify treatment. Until that renal-specific subgroup dataset exists, I would not ask you to apply the broader study to that subgroup.";
    }
    if (/what'?s the actual renal benefit in my patients with moderate impairment|renal benefit after dose adjustment|how do you expect the dosing strategy to mitigate renal risks/.test(renalConcern)) {
      return "The honest answer is that I cannot show a renal-specific benefit after dose adjustment strong enough to change treatment for those patients today. The study supports adjusting dose, but it does not prove that the adjusted regimen preserves enough benefit while adequately addressing renal risk in the subgroup you are treating.";
    }
    if (repTurns >= 5) {
      return "For the moderate renal-impairment subgroup, I would not ask you to change treatment on this dataset today. The only next conversation worth having is when there are renal-specific subgroup numbers showing retained benefit, acceptable renal safety, and a usable threshold after dose adjustment; until then I should not present this as decision-level evidence for your renal patients.";
    }
    if (repTurns >= 4) {
      return "The practical answer for your renal patients is not to change treatment based on this study today. We still do not have renal-specific subgroup numbers, a validated post-dose-adjustment threshold, or renal-focused outcomes strong enough to defend a different decision for the moderate renal-impairment subgroup.";
    }
    if (repTurns >= 3) {
      return "The missing piece for the moderate renal-impairment subgroup is a renal-specific readout showing where benefit still holds after dose adjustment and where it does not. Without that subgroup readout or threshold, I cannot tell you this study changes care for the renal patients you are focused on.";
    }
    return "For the renal-impaired patient you are asking about, the study still does not tell you clearly enough whether benefit remains strong enough after dose adjustment to justify treatment in practice. That is why I cannot present it as settled for that subgroup.";
  }

  if (issueLabel === "guideline fit") {
    if (/own patient population|my patient population|not just some study/.test(activeConcernText.toLowerCase())) {
      return `${deriveGuidelineDirectAnswer(activeConcernText)}. The gap is still the patients you actually treat, not the headline version of the evidence.`;
    }

    return `The evidence only matters if it isolates the harder-to-treat patient who actually pulls you off the usual guideline path. ${deriveGuidelineDirectAnswer(activeConcernText)}.`;
  }

  if (issueLabel === "cost impact") {
    if (/what's included|what is included|what does that include|what goes into that number|break down/.test(activeConcernText.toLowerCase())) {
      return `${deriveCostValueConcreteAnswer(activeConcernText, scenario)}. If I cannot break that out clearly, I still have not answered the value question in a way you can actually use.`;
    }
    if (/total cost per patient|overall cost of treatment per patient|cost per patient/.test(activeConcernText.toLowerCase())) {
      return `${deriveCostValueConcreteAnswer(activeConcernText, scenario)}. If that cost picture is still vague, I still have not given you what you need to evaluate value.`;
    }
    if (/formulary|budget|justify the spend|evaluate value|cost-benefit|cost benefit/.test(activeConcernText.toLowerCase())) {
      return `${deriveCostValueConcreteAnswer(activeConcernText, scenario)}. If it does not change that real spend-versus-outcome decision, it is still not enough.`;
    }
    if (/specific outcomes|what outcomes/.test(activeConcernText.toLowerCase())) {
      return "You're asking which outcomes would actually justify the spend, not for a generic value claim. The answer has to be one outcome that changes whether the therapy earns a place in practice.";
    }

    return "You're not asking for a general value story, you're asking what changes on cost and readmissions in the patients you manage. If it does not move that real value equation, it is still not enough.";
  }

  if (issueLabel === "patient-fit gap") {
    if (/renal|kidney|moderate renal impairment|egfr|gfr|dose adjustment|dose reduction/.test(activeConcernText.toLowerCase())) {
      if (/plan|get that subgroup|subgroup readout|subgroup data|timeline|earliest|when can/i.test(activeConcernText)) {
        return "For the moderate renal-impairment subgroup, the next credible move is not broader framing but a dedicated subgroup analysis with stratified efficacy, renal-safety, and post-dose-adjustment endpoints. Until that paired readout is formally underway and available, I would keep the treatment decision unchanged for those patients.";
      }
      if (repTurns >= 4) {
        return "For the moderate renal-impairment patients driving your decision, this still is not decision-level evidence. The study does not isolate that subgroup cleanly enough to show retained benefit, acceptable renal safety, and a usable threshold after dose adjustment, so I would keep the current treatment decision unchanged.";
      }
      return "For the renal-impaired patients you actually manage, the problem is still patient fit. The study population does not isolate that subgroup cleanly enough to show whether benefit still holds after dose adjustment with acceptable renal safety, so I would not treat this as decision-level evidence for those patients.";
    }
    if (/own patient population|my patient population|not just some study/.test(activeConcernText.toLowerCase())) {
      return "You're saying the study still doesn't reflect the patients who force you off the usual guideline path. The problem is still patient fit, not lack of interest in the data.";
    }

    return "You're saying the study population does not match the patients driving your decisions. If the missing patients are the ones that change treatment choice, the evidence is still incomplete.";
  }

  if (issueLabel === "workflow burden") {
    return "You're pointing to the extra work this creates for the team, not just whether the therapy works on paper. If the workflow still breaks in the same place, the idea is still too burdensome.";
  }

  return `You're pointing to a real evidence-fit gap, not a surface objection. If ${issueLabel} still blocks a real patient decision, the evidence is still not ready for practice.`;
}

function buildDeterministicCommitmentReply({ scenario, turns }) {
  const activeConcernText = normalizeForMatch(getActiveConcernText(turns, scenario));
  const repTurns = turns.filter((turn) => turn?.speaker === "rep").length;
  const hcpTurns = turns.filter((turn) => turn?.speaker === "hcp").length;
  const proofPointCategory = deriveProofPointCategory({ scenario, activeConcernText, turns });
  const hospitalFocused = /hospital|readmission|admission|ed\b|er\b/.test(activeConcernText);
  const treatmentChoiceFocused = /treatment choice|decision|switch|line of therapy|selection/.test(activeConcernText);
  const symptomFocused = /symptom|flare|control|quality of life/.test(activeConcernText);
  const specificMetricAsk = /specific hospitalization rate|what one metric|what metric|what reduction|how much of a reduction|what number/.test(activeConcernText);
  const concreteProofAsk =
    /make the proof point concrete|show me what changes practice|if you can make the proof point concrete|if that's the proof point|show me the subgroup|if you can make the proof point concrete, i can stay with|i can stay with|what one piece of evidence would be sufficient to shift|what would actually alter treatment approach|what would actually alter our current approach|more compelling reason to alter my treatment approach|one key metric|piece of evidence that would drive|show me the subgroup and the single data point|what single data point would change that|what single metric changes treatment choice|one metric that would demonstrate a significant enough reduction in complications|specific, compelling metric|one number|what'?s the one number|what one number/.test(
      activeConcernText,
    );
  const isPerpetualMaybe =
    /the perpetual maybe/i.test(String(scenario?.title || "")) ||
    /meaning to try it with the right patient|haven't had one come through that fits perfectly/i.test(
      String(scenario?.openingScene || "").toLowerCase(),
    );

  if (isPerpetualMaybe) {
    if (
      /right patient|ideal patient|perfect fit|haven't had one|meaning to try it|not the right fit|still not convinced|need more data/.test(
        activeConcernText,
      )
    ) {
      if (repTurns <= 1) {
        return "It sounds like the blocker is not interest, it is that the right patient is still too vague to act on. By right patient, I mean the patient whose current course is still not good enough that you would seriously consider changing treatment, not a perfect theoretical fit. If someone like that comes through in the next two weeks, would you be open to flagging the chart so we can pressure-test it together?";
      }
      return "It sounds like the blocker is still not evidence in the abstract, it is that the right patient is not defined tightly enough to act on. By right patient, I mean the patient whose current course is still not good enough that you would genuinely consider a change this month, not someone who only fits on paper. If that patient shows up, would you be open to flagging the next matching chart and reviewing it together so the next step is concrete?";
    }

    if (
      /proof point|concrete outcome|single data point|patient outcome|concrete|what changes practice|one key metric|piece of evidence|one number|specific, compelling metric|what single metric changes treatment choice/.test(
        activeConcernText,
      )
    ) {
      return "In this situation, the concrete move is not another broad proof point, it is getting specific enough about the right patient that you would actually act on the next real chart instead of waiting for a perfect fit. The practical next step is agreeing on that patient profile now and reviewing the next matching case when it comes through.";
    }

    if (/what would change that|what would actually alter treatment approach|what would alter our current approach/.test(activeConcernText)) {
      return "What would change it is getting specific enough that 'the right patient' becomes one real patient type you would actually flag in the next couple of weeks, not a perfect case you keep waiting for. Once that profile is concrete enough that you would pull the next matching chart and review it, the conversation has moved from maybe to a real next step.";
    }
  }

  if (hcpTurns === 0 && (hospitalFocused || /hospital|change treatment choice/.test(proofPointCategory) || specificMetricAsk || concreteProofAsk)) {
    return "The proof point has to be concrete from the start: a subgroup analysis in the patients still landing in the hospital on the current path, showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions. If the data cannot clear that bar, it still does not change treatment choice.";
  }

  if (/what'?s the one metric that proves this changes my practice|what single data point would change that|what'?s the actual reduction for my high-risk patients|what'?s the actual reduction i'?d see in my patients|what'?s the actual reduction i'?d see in my high-risk patients|specific, compelling metric|specific compelling metric|pinpoint one key metric|pinpoint the one key metric/.test(activeConcernText)) {
    if (repTurns >= 6) {
      return "For the high-risk patients you would actually treat differently, the practice-changing bar is a subgroup analysis showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up. That is the one result that would justify changing treatment instead of just acknowledging that the signal looks interesting.";
    }
    if (repTurns >= 4) {
      return "The single metric would have to be a subgroup analysis showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up in the high-risk patients still landing in the hospital on the current path. For those patients, that is the point where you would expect fewer admissions and a real reason to change treatment.";
    }
    return "The single metric would have to be a subgroup analysis showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up in the high-risk patients still landing in the hospital on the current path. If the analysis cannot show that, there is still no practice-changing proof point.";
  }

  if (/what'?s the subgroup analysis showing for my current patients|what'?s the concrete proof point for my high-risk patients|what'?s the subgroup analysis showing for my high-risk patients|what'?s the actual reduction in hospitalizations for my high-risk patients/.test(activeConcernText)) {
    if (repTurns >= 5) {
      return "For the current high-risk patients you would actually treat differently, the subgroup analysis would need to show roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up. That is the concrete proof point because it is the level where you would expect fewer admissions in that exact patient set and a real reason to change treatment.";
    }
    return "For your current high-risk patients, the subgroup analysis would have to show a hospitalization or readmission reduction strong enough to change treatment choice in that subgroup, not just a pooled result that sounds directionally positive.";
  }

  if (/exact number for high-risk patients|precise figure on the high-risk population|pinpoint the specific threshold|what'?s the exact number|specific threshold/.test(activeConcernText)) {
    return "For the high-risk subgroup, the floor would be about a 15% relative reduction in hospitalizations or readmissions before I would take it seriously, and closer to 20% is where it starts to become compelling enough to change treatment.";
  }

  if (concreteProofAsk) {
    if (repTurns >= 7) {
      return "The single data point would have to be the subgroup analysis itself showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up in the patients still landing in the hospital on the current path. That is the one piece of evidence that would justify changing treatment instead of just continuing the discussion. If the analysis cannot show that, there is no practice-changing proof point.";
    }
    if (repTurns >= 5 || hasRepeatedObjection(turns)) {
      return "The exact metric would have to be a subgroup analysis in the patients still landing in the hospital on the current path showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up. That is the point where the result stops being interesting and starts changing practice. If that threshold is not there, there is no reason to change treatment.";
    }
    if (repTurns >= 3) {
      return "The proof point has to tighten to one metric: a subgroup analysis in the patients still landing in the hospital on the current path, showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions. Anything softer than that is unlikely to change treatment choice.";
    }
    return "The concrete proof point would have to be one subgroup analysis in the patients still landing in the hospital on the current path, showing a hospitalization or readmission reduction strong enough to change treatment choice for that subgroup.";
  }

  if (/actual reduction.*high-risk patients|tangible benefit for my most vulnerable patients|most vulnerable patients|high-risk patients|smallest subgroup where this makes a difference|smallest subgroup/.test(activeConcernText)) {
    if (repTurns >= 5) {
      return "For the high-risk subgroup, that practice-changing bar means roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up, because that is the point where you would expect to keep more of those vulnerable patients out of the hospital and actually treat that subgroup differently.";
    }
    return "For the high-risk subgroup, the concrete metric would still have to be roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up in the patients still landing in the hospital on the current path. If the subgroup analysis cannot show that level of benefit in those high-risk patients, there is still no reason to change treatment.";
  }

  if (/real-world implication|real world implication|real-world impact|real impact on my high-risk patients|real impact on my patients|what does that 15% reduction mean/.test(activeConcernText)) {
    return "For your high-risk patients, that 15% to 20% reduction would mean fewer hospitalizations or readmissions in the subgroup still failing on the current path, which is the point where the result starts to justify treating those patients differently instead of leaving the current approach in place.";
  }

  if (/tangible impact on my high-risk population|what specific metric or outcome would convince me|what specific metric or outcome would convince me that|what outcome would convince me to reconsider my current approach/.test(activeConcernText)) {
    return "The concrete outcome would still have to be fewer hospitalizations or readmissions in the high-risk subgroup still failing on the current path, and the metric that would make that convincing is roughly a 15% to 20% relative reduction over follow-up in that subgroup. That is the level where the result starts to justify reconsidering the current approach.";
  }

  if (/right patient|ideal patient|meaning to try it|haven't had one/.test(activeConcernText)) {
    if (repTurns <= 1) {
      return "It sounds like the hesitation isn't interest, it's not wanting to force a fit that doesn't hold up in your real patients. If someone came close over the next couple of weeks, would you be open to flagging that chart so we can pressure-test it together?";
    }
    return "It sounds like the blocker isn't interest, it's getting from theory to one real patient you'd actually act on. Would you be open to choosing one patient type you'd realistically consider next so the follow-up is concrete instead of open-ended?";
  }

  if (/proof point|concrete outcome|single data point|patient outcome|concrete/i.test(activeConcernText)) {
    if (/what one piece of evidence would be sufficient to shift|what would actually alter treatment approach|what would actually alter our current approach|more compelling reason to alter my treatment approach|one key metric|piece of evidence that would drive/.test(activeConcernText)) {
      return "The one piece of evidence that would justify changing treatment is a subgroup analysis in the patients still landing in the hospital on the current path, showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up. That is the point where the data starts changing treatment choice instead of just extending the discussion.";
    }

    if (/what makes that 15% threshold meaningful|what makes you think 15% reduction is enough|why is 15% enough|why is that threshold enough/.test(activeConcernText)) {
      return "That 15% to 20% threshold matters only if it comes from the subgroup still landing in the hospital on the current path, because at that level the reduction is large enough to change who you escalate, who you keep on the current path, and whether the result is strong enough to alter treatment in practice.";
    }

    if (/exact practice-changing reduction threshold|exact reduction threshold|exact hospitalization threshold|exact readmission threshold|hospitalization\/readmission threshold standard|threshold standard|reduction numbers/.test(activeConcernText)) {
      if (repTurns >= 5) {
        return "A practice-changing standard would usually mean the subgroup analysis itself shows roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up in the patients you would actually treat, because that is the threshold where the number starts to justify changing treatment instead of just sounding encouraging.";
      }
      return "A practice-changing standard would usually need to look like roughly a 15% to 20% relative reduction in hospitalizations or readmissions in the subgroup you actually treat, not just a small directional improvement.";
    }

    if (/what'?s the exact reduction threshold|what reduction would change treatment choice/.test(activeConcernText)) {
      if (repTurns >= 5) {
        return "The threshold would have to be shown inside the subgroup analysis itself: roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up in the patients still failing on the current path, because that is the level where the result starts to justify changing treatment choice.";
      }
      return "The threshold would have to look more like a sustained 15% to 20% relative reduction in hospitalizations or readmissions in the subgroup you would actually treat, not a small change that never alters treatment choice.";
    }

    if (/one number|specific, compelling metric|specific compelling metric|what'?s the one number|what one number/.test(activeConcernText)) {
      return "The one number would have to look like roughly a 15% to 20% relative reduction in hospitalizations or readmissions in the subgroup you would actually treat, because that is the kind of change that can realistically shift treatment choice.";
    }

    if (/still too soft|not concrete enough|more definitive metric|what one piece|what'?s the one piece/.test(activeConcernText)) {
      return "Then the one piece would have to be a subgroup analysis limited to the patients still landing in the hospital on the current path, showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up. If it cannot show that, it still does not change practice.";
    }

    if (/specific analysis|what analysis demonstrates|what analysis shows|show me the analysis/.test(activeConcernText)) {
      return "The analysis would have to isolate the patients still landing in the hospital on the current path and show a hospitalization or readmission reduction large enough to change treatment choice for that subgroup, not just the pooled study population.";
    }

    if (/specific population|my specific population|patients like the ones i'm reviewing|applied to my specific population|applies to my specific population|toughest patients/.test(activeConcernText)) {
      return "Then the one piece has to be the subgroup analysis in the patients still landing in the hospital on the current path, showing roughly a 15% to 20% relative reduction over follow-up in the patients who actually look like the ones you are reviewing. If it cannot show that in your population, it still does not change practice.";
    }

    if (/if you can make the proof point concrete|make the proof point concrete|concrete proof point for my patients|concrete proof point for my high-risk patients|what'?s the subgroup analysis showing for my high-risk patients|what'?s the actual reduction i'?d see in my patients|what'?s the actual reduction i'?d see in my high-risk patients|actual reduction for my high-risk patients|still waiting for concrete proof points|still waiting for that concrete proof point|show me the subgroup and the single data point|what single data point would change that|what single metric changes treatment choice|one metric that would demonstrate a significant enough reduction in complications|significant enough reduction in complications|one key metric|piece of evidence that would drive|what would actually alter our current approach|what specifically would alter our current approach|what'?s the one metric that proves this changes my practice|one metric that proves this changes my practice|specific compelling metric|specific, compelling metric/.test(activeConcernText)) {
      if (repTurns >= 8) {
        return "The one piece of evidence that would justify changing treatment is a subgroup analysis in the patients still landing in the hospital on the current path, showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up, because that is the point where the result stops being interesting and actually changes practice.";
      }
      if (repTurns >= 7) {
        return "The exact metric would be the subgroup analysis showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up in the patients still failing on the current path, because that is the piece of evidence that would actually justify changing treatment instead of just keeping the discussion alive. If that is not the bar, I would not call the proof point concrete enough.";
      }
      if (repTurns >= 6) {
        return "Then the subgroup analysis itself has to show roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up in the patients still failing on the current path, because that is the one number that starts to justify treating that subgroup differently in practice. Anything less still sounds interesting without changing treatment choice.";
      }
      if (repTurns >= 5 || hasRepeatedObjection(turns)) {
        return "Then the one metric has to be tied to the subgroup analysis itself: a roughly 15% to 20% relative reduction in hospitalizations or readmissions over follow-up in the patients still landing in the hospital on the current path, because that is the number that would justify changing treatment for that subgroup.";
      }
      if (repTurns >= 4) {
        return "The one piece would have to be a subgroup analysis limited to the patients still landing in the hospital on the current path, showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up. If it cannot show that, it still does not change practice.";
      }
      if (repTurns >= 2) {
        return "The single data point would have to look like roughly a 15% to 20% relative reduction in hospitalizations or readmissions in the subgroup still landing in the hospital on the current path, because that is the kind of number that can actually change treatment choice. Is that the level where you would actually treat those patients differently?";
      }
      return "The subgroup would be the patients who are still landing in the hospital or coming back despite the current path, and the single data point would be a hospitalization or readmission reduction large enough that you would actually treat that subgroup differently.";
    }

    if (/if you can make the proof point concrete, i can stay with|make the proof point concrete|concrete proof point for my patients|concrete proof point for my high-risk patients/.test(activeConcernText)) {
      if (repTurns >= 5) {
        return "For your high-risk patients, the concrete proof point is one number inside the subgroup you actually worry about: roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up. If the analysis cannot show that in that subgroup, it still does not justify changing treatment.";
      }
      if (repTurns >= 3) {
        return "For your patients, I mean one subgroup analysis in the high-risk patients still landing in the hospital on the current path, with a hospitalization or readmission reduction large enough to change what you would do next. That is the proof point that would matter.";
      }
      return "Concrete here means one subgroup result in the high-risk patients you actually worry about, not a pooled headline. The number has to be strong enough to change treatment choice for those patients.";
    }

    if (specificMetricAsk && hospitalFocused) {
      if (repTurns >= 4) {
        return "The one piece would have to be the subgroup analysis itself, showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up in the patients still being hospitalized on the current path. Without that analysis, there is no one number strong enough to change practice.";
      }
      if (repTurns <= 2) {
        return "The one metric would have to be a hospitalization or readmission reduction large enough that you would actually intervene differently for the patient in front of you, not a utilization number that never changes treatment choice.";
      }
      return "The one data point would have to be a hospitalization or readmission reduction you would actually trust enough to change treatment choice for a real patient, not a broad number that never changes what you do.";
    }

    if (hospitalFocused) {
      if (repTurns <= 1) {
        return "Then the proof point would have to be a hospitalization or readmission signal in the patients you actually manage, not a broad headline from a slide. If that signal would not change who you treat or how urgently you act, it is not enough.";
      }
      return "Then the proof point would have to be a hospitalization or readmission signal you would actually use in practice, not a pooled efficacy claim. If it would not change treatment choice for the patient in front of you, it is still too soft.";
    }

    if (treatmentChoiceFocused) {
      return "Then the proof point has to show a real change in treatment choice for a patient you would otherwise manage differently. If it does not move that decision, it is still not concrete enough.";
    }

    if (symptomFocused) {
      return "Then the proof point has to show a symptom or flare change you would actually notice in the patient, not just a statistical win on paper. If it would not change follow-up or treatment choice, it is still not enough.";
    }

    if (repTurns <= 1) {
      return `${deriveCommitmentDirectAnswer(activeConcernText, proofPointCategory)}. The most useful place to start would be ${proofPointCategory}.`;
    }
    return `${deriveCommitmentDirectAnswer(activeConcernText, proofPointCategory)}. If we keep this concrete, the proof point should be ${proofPointCategory}, because that is what would actually justify a next step.`;
  }

  if (/need more data|still not convinced|not the right fit|perfect fit/.test(activeConcernText)) {
    return "It sounds like the hesitation is still active, even if the interest is there. Would you be open to naming the one evidence gap that has to get resolved before this moves from 'maybe' to a real next step?";
  }

  if (/formulary|non-preferred|review process|reconsidered|concrete|take back to the formulary team|exact steps/.test(activeConcernText)) {
    if (repTurns <= 1) {
      return "It sounds like the blocker isn't interest, it's needing something concrete to move the formulary conversation. If I gave you one specific item to bring back, what would make it useful enough to carry forward internally?";
    }
    return "It sounds like the path is clear enough to define a real next step now. Would you be open to agreeing on the one concrete item you can bring to the next formulary discussion so this actually moves?";
  }

  if (/committee|bring it up|process/.test(activeConcernText)) {
    return "It sounds like the issue isn't support, it's what you can actually own before the committee meets. What's one concrete step you could take this month so this doesn't just sit until the next meeting?";
  }

  if (/prior auth|staff|workflow|extra step|burden/.test(activeConcernText)) {
    if (repTurns <= 1) {
      return "It sounds like the blocker isn't interest, it's not wanting to hand your staff one more loose end. Before this goes any further, what's the one workflow condition that would have to be true for you to feel comfortable moving one case forward?";
    }
    return "It sounds like staff burden is still the real stop sign here. Would you be open to naming the one workflow requirement that has to be met before you'd take one concrete next step from your side?";
  }

  return "It sounds like the conversation is close to alignment, but the next step still isn't defined. Would you be open to naming the smallest concrete action that would move this forward from here?";
}

function hasRepeatedObjection(turns = []) {
  const hcpTurns = turns.filter((turn) => turn?.speaker === "hcp" && typeof turn?.text === "string");
  if (hcpTurns.length < 2) {
    return false;
  }

  const last = hcpTurns[hcpTurns.length - 1].text.toLowerCase();
  const prev = hcpTurns[hcpTurns.length - 2].text.toLowerCase();

  if (last === prev) {
    return true;
  }

  const sharedSignals = ["renal impairment", "subgroup", "comorbid", "workflow", "data", "real-world"];
  return sharedSignals.some((signal) => last.includes(signal) && prev.includes(signal));
}

function avoidRepeatedDeterministicReply(candidate, draft, turns = []) {
  const normalizedCandidate = normalizeForMatch(candidate);
  if (!normalizedCandidate) return String(draft || "").trim();

  const recentRepTurns = turns
    .filter((turn) => turn?.speaker === "rep" && typeof turn?.text === "string")
    .slice(-2);

  const repeated = recentRepTurns.some((turn) => normalizeForMatch(turn.text) === normalizedCandidate);
  return repeated ? String(draft || "").trim() : String(candidate || "").trim();
}

function needsAnswerFirstRevision({ scenario, turns, currentBehaviorState, currentJourneyState, draft }) {
  const activeConcernText = getActiveConcernText(turns, scenario);
  if (!activeConcernText) {
    return false;
  }

  const pressureText = `${(scenario?.interactionPressure || []).join(" ")} ${currentBehaviorState || ""} ${currentJourneyState || ""}`;
  const pressured = /time|operational|skeptical|closed|resistant|clinical_value|objection/i.test(pressureText);
  const directDemand = DIRECT_ANSWER_TRIGGER.test(activeConcernText) || hasRepeatedObjection(turns);
  const draftTooDiscoveryLed = BROAD_DISCOVERY_PATTERN.test((draft || "").trim());

  return pressured && directDemand && draftTooDiscoveryLed;
}

export async function maybeReviseStrongRepReply({
  scenario,
  turns,
  currentBehaviorState,
  currentJourneyState,
  draft,
}) {
  const stageText = `${scenario?.journeyStage || ""}`.toLowerCase();
  const activeConcernText = normalizeForMatch(getActiveConcernText(turns, scenario));
  const repeatedConcern = hasRepeatedObjection(turns);
  const lastRepText = getLastRepText(turns);

  if (shouldHoldCostValueLane({
    scenario,
    turns,
    activeConcernText,
    lastRepText,
    draft,
  })) {
    return buildCostValueFollowThroughReply({ scenario, turns, activeConcernText });
  }

  if (
    /clinical_value|clinical_value/.test(stageText) &&
    /renal|kidney|egfr|gfr|dose adjustment|dose reduction|subgroup|numbers for my patient population|real-world renal data|moderate renal impairment|threshold|closest renal-specific data|closest renal-specific outcome|detailed breakdown|patient population details|change practice|specific insights i need|show me the renal subgroup data|that'?s a delay|real-world outcomes/.test(activeConcernText)
  ) {
    return avoidRepeatedDeterministicReply(buildDeterministicEvidenceFitReply({ scenario, turns }), draft, turns);
  }

  if (
    /commitment_close|adoption_implementation/.test(stageText) &&
    (CLOSE_PROOF_POINT_PATTERN.test(activeConcernText) || repeatedConcern)
  ) {
    return avoidRepeatedDeterministicReply(buildDeterministicCommitmentReply({ scenario, turns }), draft, turns);
  }

  if (shouldUseDeterministicFamilyAnswerRewrite({
    scenario,
    turns,
    draft,
  })) {
    return avoidRepeatedDeterministicReply(buildDeterministicFamilyAnswerReply({ scenario, turns }), draft, turns);
  }

  if (shouldUseDeterministicCommitmentRewrite({
    scenario,
    turns,
    draft,
  })) {
    return avoidRepeatedDeterministicReply(buildDeterministicCommitmentReply({ scenario, turns }), draft, turns);
  }

  if (shouldUseDeterministicEvidenceFitRewrite({
    scenario,
    turns,
    currentBehaviorState,
    currentJourneyState,
    draft,
  })) {
    return avoidRepeatedDeterministicReply(buildDeterministicEvidenceFitReply({ scenario, turns }), draft, turns);
  }

  if (!needsAnswerFirstRevision({
    scenario,
    turns,
    currentBehaviorState,
    currentJourneyState,
    draft,
  })) {
    return draft;
  }

  const lastHcpText = getActiveConcernText(turns, scenario);
  const revisionPrompt = `
You are revising a pharma rep QA proxy reply inside a role-play simulation.

SCENARIO: ${scenario?.title || ""}
OBJECTIVE: ${scenario?.objective || ""}
CURRENT BEHAVIOR STATE: ${currentBehaviorState || ""}
CURRENT JOURNEY STATE: ${currentJourneyState || ""}
LAST HCP MESSAGE: ${lastHcpText}
KEY CHALLENGES: ${Array.isArray(scenario?.keyChallenges) ? scenario.keyChallenges.join(" | ") : "none"}

CURRENT DRAFT:
${draft}

Revise the draft so it behaves like a strong rep in a pressured clinical-value or objection exchange.

Rules:
- Keep it to 1-2 sentences.
- Start with a direct declarative answer that names the exact issue the HCP raised.
- Use concrete clinician-facing language, not abstract summary language.
- Do not lead with a question.
- Do not use broad discovery phrases like "help me understand," "can you elaborate," or "what specific aspects."
- If you include a second sentence, it must be a narrow next step or clarifier, not a broad discovery question.
- If the scenario's key challenge says exploring the concern is more credible than defending the data, do not rebut with a new claim; acknowledge the limitation and narrow the discussion to the exact patient-fit issue.
- Do not introduce rescue claims about efficacy, pharmacokinetics, or workflow support unless the HCP explicitly asked for that evidence.
- Do not add product hype or vague empathy wrappers.

Return ONLY the revised rep reply as plain text.`;

  const revised = await invokeWorkerText({
    prompt: revisionPrompt,
    max_tokens: 140,
    temperature: 0.1,
  });

  return String(revised || draft).trim();
}

export function maybeEnforceFamilyAnswerReply({
  scenario,
  turns,
  draft,
}) {
  const stageText = `${scenario?.journeyStage || ""}`.toLowerCase();
  const activeConcernText = normalizeForMatch(getActiveConcernText(turns, scenario));
  const lastRepText = getLastRepText(turns);

  if (shouldHoldCostValueLane({
    scenario,
    turns,
    activeConcernText,
    lastRepText,
    draft,
  })) {
    return buildCostValueFollowThroughReply({ scenario, turns, activeConcernText });
  }

  if (
    /clinical_value|clinical_value/.test(stageText) &&
    /\bcost|spend|value|monitoring|testing|diagnostic|expense|budget\b/.test(activeConcernText) &&
    hasCostValueGapAdmission(lastRepText)
  ) {
    return buildCostValueFollowThroughReply({ scenario, turns, activeConcernText });
  }

  if (
    /clinical_value|clinical_value/.test(stageText) &&
    /total cost per patient|overall cost of treatment per patient|cost per patient|what's included|what is included|what does that include|what goes into that number|break down|formulary|budget|justify the spend|evaluate value|cost-benefit|cost benefit|what am i supposed to do with|what do i do with|how am i supposed to use that|incremental cost|added cost per patient|extra testing|extra monitoring|follow-up costs|testing and monitoring|specific added cost per patient.*monitoring|exact added cost per patient.*monitoring|specific added cost.*monitoring|exact added cost.*monitoring|don't need another efficacy point|do not need another efficacy point|not another efficacy point/.test(activeConcernText) &&
    hasConcreteCostValueAnswer(lastRepText)
  ) {
    return buildCostValueFollowThroughReply({ scenario, turns, activeConcernText });
  }

  if (
    /clinical_value|clinical_value/.test(stageText) &&
    /average added monitoring cost|added cost for monitoring|monitoring cost per patient|average monitoring cost|specific added cost per patient.*monitoring|exact added cost per patient.*monitoring|specific added cost.*monitoring|exact added cost.*monitoring/.test(activeConcernText) &&
    (hasMonitoringCostRange(lastRepText) || hasCostValueGapAdmission(lastRepText) || hasConcreteCostValueAnswer(lastRepText))
  ) {
    return buildCostValueFollowThroughReply({ scenario, turns, activeConcernText });
  }

  if (
    /clinical_value|clinical_value/.test(stageText) &&
    /total cost per patient|overall cost of treatment per patient|cost per patient|what's included|what is included|what does that include|what goes into that number|break down|exact total cost|comprehensive cost breakdown|overall expense per patient/.test(activeConcernText) &&
    hasCostValueGapAdmission(lastRepText)
  ) {
    return "If you need the exact cost and I still can't break it out cleanly, I still haven't closed the value question. Until I can show the full number clearly, I shouldn't act like the cost case is settled.";
  }

  if (
    /initial_access|adoption_implementation/.test(stageText) &&
    /what step gets added|added step|what changes in my workflow|what specific workflow step|what gets added|what staff|rework|handoff|workflow|actually reduce|how does it actually reduce|how does that actually reduce|how does this actually reduce|how does it actually get to me|point of care|i can look at it|i can stay with it/.test(activeConcernText) &&
    hasConcreteOperationalAnswer(lastRepText)
  ) {
    return buildOperationalFollowThroughReply({ activeConcernText, turns });
  }

  if (
    /adoption_implementation/.test(stageText) &&
    /how does that simplify handoffs|without adding more steps|without adding more clicks|how does that reduce steps|what exactly changes for staff|what specifically changes in my workflow|what changes in my workflow|if this does not add another staff step|if this doesn't add another staff step|i can look at it|i can stay with it/.test(activeConcernText)
  ) {
    return buildDeterministicFamilyAnswerReply({ scenario, turns });
  }

  if (
    /clinical_value|clinical_value/.test(stageText) &&
    /total cost per patient|overall cost of treatment per patient|cost per patient|what's included|what is included|what does that include|what goes into that number|break down|formulary|budget|justify the spend|evaluate value|cost-benefit|cost benefit/.test(activeConcernText)
  ) {
    return buildDeterministicEvidenceFitReply({ scenario, turns });
  }

  if (
    /commitment_close|adoption_implementation/.test(stageText) &&
    /if you can make the proof point concrete|make the proof point concrete|concrete proof point for my patients|concrete proof point for my high-risk patients|what'?s the subgroup analysis showing for my high-risk patients|what'?s the actual reduction i'?d see in my patients|what'?s the actual reduction i'?d see in my high-risk patients|actual reduction for my high-risk patients|still waiting for concrete proof points|still waiting for that concrete proof point|most vulnerable patients|hospitalization rates|tangible impact/.test(activeConcernText)
  ) {
    return buildDeterministicCommitmentReply({ scenario, turns });
  }

  if (/commitment_close|adoption_implementation/.test(stageText) && CLOSE_PROOF_POINT_PATTERN.test(activeConcernText)) {
    return buildDeterministicCommitmentReply({ scenario, turns });
  }

  if (
    /clinical_value|clinical_value/.test(stageText) &&
    /what'?s the plan to get that dedicated renal subgroup analysis|what'?s the plan to actually get that subgroup analysis done|what'?s the specific plan to get that subgroup analysis done for my patients with moderate renal impairment|when do i get that renal subgroup analysis to make a decision|when do i get that subgroup analysis to make a decision|what'?s the timeline for that dedicated analysis|what'?s the earliest i can expect to see that renal subgroup analysis|still waiting for meaningful subgroup analysis|still waiting to see some meaningful subgroup analysis|that doesn'?t help my patients with moderate renal impairment|still doesn'?t address my renal patients/.test(activeConcernText)
  ) {
    return buildDeterministicEvidenceFitReply({ scenario, turns });
  }

  if (
    /clinical_value|clinical_value/.test(stageText) &&
    (DIRECT_ANSWER_TRIGGER.test(activeConcernText) ||
      /renal|kidney|egfr|gfr|dose adjustment|dose reduction|subgroup|numbers for my patient population|real-world renal data|moderate renal impairment|threshold|closest renal-specific data|closest renal-specific outcome|detailed breakdown|patient population details|change practice|specific insights i need|show me the renal subgroup data|that'?s a delay|real-world outcomes/.test(activeConcernText))
  ) {
    return buildDeterministicEvidenceFitReply({ scenario, turns });
  }

  if (shouldUseDeterministicFamilyAnswerRewrite({
    scenario,
    turns,
    draft,
  })) {
    return buildDeterministicFamilyAnswerReply({ scenario, turns });
  }

  return draft;
}

export function maybeApplyHardFamilyAnswerReply({
  scenario,
  turns,
  draft,
}) {
  const stageText = `${scenario?.journeyStage || ""}`.toLowerCase();
  const activeConcernText = normalizeForMatch(getActiveConcernText(turns, scenario));
  const lastRepText = getLastRepText(turns);
  const isPerpetualMaybe =
    /the perpetual maybe/i.test(String(scenario?.title || "")) ||
    /meaning to try it with the right patient|haven't had one come through that fits perfectly/i.test(
      String(scenario?.openingScene || "").toLowerCase(),
    );

  if (
    isPerpetualMaybe &&
    /commitment_close|adoption_implementation/.test(stageText) &&
    (
      /right patient|ideal patient|perfect fit|haven't had one|meaning to try it|not the right fit|still not convinced|need more data|what would change that|what would actually alter treatment approach|what would alter our current approach|proof point|concrete outcome|single data point|patient outcome|what changes practice|one key metric|piece of evidence|one number|specific, compelling metric|what single metric changes treatment choice/.test(
        activeConcernText,
      ) ||
      hasRepeatedObjection(turns)
    )
  ) {
    return buildDeterministicCommitmentReply({ scenario, turns });
  }

  if (shouldHoldCostValueLane({
    scenario,
    turns,
    activeConcernText,
    lastRepText,
    draft,
  })) {
    return buildCostValueFollowThroughReply({ scenario, turns, activeConcernText });
  }

  if (/clinical_value|clinical_value/.test(stageText)) {
    if (
      /\bcost|spend|value|monitoring|testing|diagnostic|expense|budget\b/.test(activeConcernText) &&
      hasCostValueGapAdmission(lastRepText)
    ) {
      return buildCostValueFollowThroughReply({ scenario, turns, activeConcernText });
    }
    if (
      /total cost per patient|overall cost of treatment per patient|cost per patient|what's included|what is included|what does that include|what goes into that number|break down|exact total cost|comprehensive cost breakdown|overall expense per patient/.test(activeConcernText) &&
      hasCostValueGapAdmission(lastRepText)
    ) {
      return "If you need the exact cost and I still can't break it out cleanly, I still haven't closed the value question. Until I can show the full number clearly, I shouldn't act like the cost case is settled.";
    }
    if (
      /total cost per patient|overall cost of treatment per patient|cost per patient|what's included|what is included|what does that include|what goes into that number|break down|formulary|budget|justify the spend|evaluate value|cost-benefit|cost benefit|what am i supposed to do with|what do i do with|how am i supposed to use that|incremental cost|added cost per patient|extra testing|extra monitoring|follow-up costs|testing and monitoring|specific added cost per patient.*monitoring|exact added cost per patient.*monitoring|specific added cost.*monitoring|exact added cost.*monitoring|don't need another efficacy point|do not need another efficacy point|not another efficacy point/.test(activeConcernText) &&
      hasConcreteCostValueAnswer(lastRepText)
    ) {
      return buildCostValueFollowThroughReply({ scenario, turns, activeConcernText });
    }
    if (
      /average added monitoring cost|added cost for monitoring|monitoring cost per patient|average monitoring cost|specific added cost per patient.*monitoring|exact added cost per patient.*monitoring|specific added cost.*monitoring|exact added cost.*monitoring/.test(activeConcernText) &&
      (hasMonitoringCostRange(lastRepText) || hasCostValueGapAdmission(lastRepText) || hasConcreteCostValueAnswer(lastRepText))
    ) {
      return buildCostValueFollowThroughReply({ scenario, turns, activeConcernText });
    }
    if (/total cost per patient|overall cost of treatment per patient|cost per patient|what's included|what is included|what does that include|what goes into that number|break down|formulary|budget|justify the spend|evaluate value|cost-benefit|cost benefit/.test(activeConcernText)) {
      return buildDeterministicEvidenceFitReply({ scenario, turns });
    }
    if (/that subgroup analysis still doesn't reflect my patient population|that subgroup analysis does not reflect my patient population|still doesn't reflect my patient population|doesn't reflect my patient population|still doesn't capture my patient population'?s complexity|doesn't capture my patient population'?s complexity|still doesn't capture my complex patients|doesn't capture my complex patients|my moderate renal impairment patients aren't well represented in these trials|not well represented in these trials/.test(activeConcernText)) {
      return buildDeterministicEvidenceFitReply({ scenario, turns });
    }
    if (/what'?s the plan to get renal-specific subgroup data|what'?s the plan to get that renal-specific data|what'?s the plan to get renal subgroup data|what'?s the plan to get that renal subgroup data|what'?s the timeline for getting that renal-specific data|what'?s the timeline for renal-specific subgroup data|what'?s the timeline for that renal subgroup analysis/.test(activeConcernText)) {
      return "The concrete plan is a dedicated renal subgroup analysis or follow-up cohort with stratified efficacy, renal-safety, and dose-adjusted outcome endpoints in the moderate renal-impairment patients driving your decision. I do not have a committed readout date I can defend today, so until that analysis is actually available I would not ask you to change treatment for that subgroup.";
    }
    if (/that subgroup analysis is still not scheduled|still no subgroup analysis scheduled|still no renal subgroup analysis scheduled|subgroup analysis is not scheduled|not scheduled, is it|still no subgroup analysis/.test(activeConcernText)) {
      return "You're right that without that subgroup analysis formally scheduled, there is still no new evidence path you can use to justify changing treatment for the moderate renal-impairment subgroup. So the decision stays unchanged until that renal-specific analysis is actually underway and results are available.";
    }
    if (/what specific subgroup does this data apply to|what subgroup does this data actually apply to/.test(activeConcernText)) {
      return "The subgroup that matters is the harder-to-treat patient who is still not controlled on the standard path and whose renal burden or comorbidity load makes you question whether the usual evidence still applies cleanly.";
    }
    if (/how this applies to my patients with renal issues|how does your data account for renal impairment|how does your data account for renal function/.test(activeConcernText)) {
      return "It does not apply cleanly enough yet, because the study still leaves unanswered how much benefit remains once you adjust dosing for the renal-impaired patients you actually treat.";
    }
    if (/what'?s the actual efficacy after dose adjustment for moderate renal impairment|what'?s the actual renal efficacy after dose adjustment|actual efficacy after dose adjustment|what'?s the actual renal safety after dose adjustment|actual renal safety after dose adjustment|what'?s the real-world renal safety data after dose adjustment|real-world renal safety data after dose adjustment|what'?s the actual benefit after dose adjustment for my moderate renal impairment patients|actual benefit after dose adjustment/.test(activeConcernText)) {
      return buildDeterministicEvidenceFitReply({ scenario, turns });
    }
    if (/real-world renal data|what real-world renal data do you have|what renal data do you have for patients like mine|renal data do you have that's relevant to my patients|what subgroup data do you have|subgroup data for patients with moderate renal impairment|subgroup analysis for moderate renal impairment|moderate renal impairment subgroup analysis|that subgroup analysis is crucial|what'?s the plan for getting that renal subgroup analysis|what'?s the plan to get that renal subgroup analysis|what'?s the plan for getting that subgroup analysis|what'?s the plan to get that subgroup analysis|what'?s the plan to get that subgroup analysis to me|what'?s the plan to get that subgroup analysis done within the next quarter|what'?s the plan to get renal-specific data|what is the plan to get renal-specific data|plan to get renal-specific data|what'?s the plan to get renal data|what is the plan to get renal data|plan to get renal data|what'?s the plan for getting that renal data|what is the plan for getting that renal data|what'?s the plan for getting renal data now|what is the plan for getting renal data now|what'?s the plan for getting that renal data now|what is the plan for getting that renal data now|what'?s the plan to get that data now|what is the plan to get that data now|what'?s the plan to get that subgroup readout|what is the plan to get that subgroup readout|plan to get that subgroup readout|what'?s the timeline for that renal subgroup analysis|what'?s the timeline for that subgroup analysis|what'?s the earliest i can expect that subgroup analysis|when can i anticipate seeing the detailed breakdown|when can i expect subgroup results|when can i expect those subgroup results|i need that subgroup analysis to make a decision|peer-reviewed journal|peer reviewed journal|actual numbers for my patient population|numbers for my patient population|what numbers do you have for my patient population|what'?s the exact threshold that changes treatment|what'?s the exact egfr threshold for that subgroup|renal threshold that changes treatment|what'?s the exact renal threshold where i need to switch treatments|what'?s the specific renal threshold that changes my treatment choice|at what specific point does the data suggest i should switch|that doesn'?t help my patients with moderate renal impairment|still doesn'?t address my renal patients|what specific data on renal safety.*give you confidence|specific data on renal safety.*give you confidence/.test(activeConcernText)) {
      return buildDeterministicEvidenceFitReply({ scenario, turns });
    }
    if (/what'?s the actual dose adjustment for a patient with moderate renal impairment|what'?s the exact dose for moderate renal impairment|how does dosing adjust for renal impairment/.test(activeConcernText)) {
      return "The study supports reducing the dose in moderate renal impairment, but it still does not give a renal-specific evidence package strong enough to tell you that the adjusted dose clearly preserves enough benefit to change practice.";
    }
    if (/timeline for those dosing adjustment studies|timeline for dosing adjustment studies|interim plan for dosing adjustments|what's the interim plan for dosing adjustments|what is the interim plan for dosing adjustments|what's the timeline for those dosing adjustment studies|timeline for renal studies|timeline for the renal studies/.test(activeConcernText)) {
      return "The only credible plan is a renal-specific follow-up cohort with predefined dosing, renal-safety, and retained-benefit endpoints. Until that reads out, the interim position is that the current dataset does not settle the renal decision.";
    }
    if (/plan for dosing adjustments in renal-impaired patients|dosing adjustments in renal-impaired patients|how will you handle dosing adjustments in renal-impaired patients|actual reduction in adverse events|what'?s the actual reduction in adverse events|reduction in adverse events with that dose adjustment/.test(activeConcernText)) {
      return buildDeterministicEvidenceFitReply({ scenario, turns });
    }
    if (/what specific comorbidities did this study account for|what comorbidities did this study account for, exactly|how the patient population in this study reflects the complexity i see in my own practice|reflects the complexity i see in my own practice/.test(activeConcernText)) {
      return "That is still the weakness in the evidence: it does not cleanly represent the higher-complexity patients with layered renal burden and comorbidities who drive your real treatment decisions, so the study population still feels cleaner than the patients you actually manage.";
    }
    if (/what'?s the exact renal threshold where i need to switch treatments|what'?s the specific renal threshold that changes my treatment choice|what'?s the renal threshold that changes treatment|gfr below 30|exact gfr threshold|minimum egfr where you still see a benefit|lowest egfr where you(?:'ve)? (?:actually )?seen preserved efficacy|lowest egfr where efficacy is still preserved|at what threshold of renal function do the benefits.*diminish|at what point does the renal impairment become a limiting factor|what'?s the renal dose adjustment threshold|renal safety threshold for dose adjustment in my patients|renal safety threshold after dose adjustment|specific renal safety threshold for dose adjustment|renal safety threshold, exactly|exact threshold for dose adjustment in renal impairment|exact renal dose adjustment threshold|what'?s the exact threshold\??|what is the exact threshold\??/.test(activeConcernText)) {
      return "There is not a validated renal threshold in this dataset that tells you exactly when to switch. That is the gap: the study does not give a clean GFR cutoff where you can say the evidence still supports treatment in the higher-risk renal patient.";
    }
    if (
      /how this applies to my patients with renal issues|accounts? for renal impairment|accounts? for the potential risks in patients with compromised renal function|how does your data account for renal impairment|what specific evidence do you have that changes my current practice|what specific data do you have that changes my current approach|what specific data justifies deviating from current guidelines|what specific subgroup does this data apply to|plan to study renal impairment|knowledge gap on renal safety|what comorbidities did the study account for|reflects the complexity i see in my own practice|generalizable|exact gfr threshold|exact threshold for switching treatments/.test(
        activeConcernText,
      )
    ) {
      return buildDeterministicEvidenceFitReply({ scenario, turns });
    }
  }

  if (
    /adoption_implementation/.test(stageText) &&
    /how does that simplify handoffs|without adding more steps|without adding more clicks|how does that reduce steps|what exactly changes for staff|what specifically changes in my workflow|what changes in my workflow|if this does not add another staff step|if this doesn't add another staff step|i can look at it|i can stay with it|reduce rework|staff rework|actually reduce|how does it actually reduce|how does that actually reduce|how does this actually reduce|how does it actually get to me|point of care/.test(activeConcernText)
  ) {
    if (hasConcreteOperationalAnswer(lastRepText)) {
      return buildOperationalFollowThroughReply({ activeConcernText, turns });
    }
    return buildDeterministicFamilyAnswerReply({ scenario, turns });
  }

  if (/commitment_close|adoption_implementation/.test(stageText)) {
    if (/what'?s the exact reduction threshold|what reduction would change treatment choice|what'?s the smallest reduction that would make a difference|what'?s the threshold for that reduction to change treatment choice/.test(activeConcernText)) {
      return "A practice-changing threshold would usually need to look like roughly a 15% to 20% relative reduction in hospitalizations or readmissions in the subgroup you would actually treat, not just a directional benefit that never changes the decision.";
    }
    if (/one number|specific, compelling metric|specific compelling metric|what'?s the one number|what one number/.test(activeConcernText)) {
      return "The one number would have to be roughly a 15% to 20% relative reduction in hospitalizations or readmissions in the subgroup you would actually treat, because that is the kind of change that can realistically alter treatment choice.";
    }
    if (/still too soft|not concrete enough|more definitive metric|what one piece|what'?s the one piece/.test(activeConcernText)) {
      return buildDeterministicCommitmentReply({ scenario, turns });
    }
    if (
      /if you can make the proof point concrete|show me what changes practice|show me the subgroup and the single data point|what single data point would change that|what single metric changes treatment choice|what's the exact reduction threshold|what reduction would change treatment choice|show me the specific analysis|what analysis demonstrates|exact practice-changing reduction threshold|exact hospitalization threshold|exact readmission threshold|threshold standard|one number|specific, compelling metric|specific compelling metric/.test(
        activeConcernText,
      )
    ) {
      return buildDeterministicCommitmentReply({ scenario, turns });
    }
  }

  return draft;
}

function needsConcreteLanguageRevision({ scenario, draft }) {
  const familyText = `${scenario?.journeyStage || ""} ${(scenario?.interactionPressure || []).join(" ")}`;
  const clinicalValueLike = /clinical_value|skeptical|evidence|access_barrier|operational/i.test(familyText);
  if (!clinicalValueLike) {
    return false;
  }

  return ABSTRACT_QA_LANGUAGE_PATTERN.test(String(draft || "").trim());
}

export async function maybeConcreteifyStrongRepReply({
  scenario,
  turns,
  currentBehaviorState,
  currentJourneyState,
  draft,
}) {
  if (!needsConcreteLanguageRevision({ scenario, draft })) {
    return draft;
  }

  const activeConcernText = getActiveConcernText(turns, scenario);
  const revisionPrompt = `
You are revising a pharma rep QA proxy reply so it sounds concrete, specific, and spoken, not abstract.

SCENARIO: ${scenario?.title || ""}
OBJECTIVE: ${scenario?.objective || ""}
CURRENT BEHAVIOR STATE: ${currentBehaviorState || ""}
CURRENT JOURNEY STATE: ${currentJourneyState || ""}
ACTIVE HCP CONCERN: ${activeConcernText}
KEY CHALLENGES: ${Array.isArray(scenario?.keyChallenges) ? scenario.keyChallenges.join(" | ") : "none"}

CURRENT DRAFT:
${draft}

Revise the draft with these rules:
- Keep it to 1-2 sentences.
- Use concrete patient-fit, workflow, or evidence-gap language.
- Name the exact issue instead of using abstract summary phrases.
- Ban phrases like "critical consideration," "significant limitation," "primary concern," "specific patient population," "treatment landscape," or "our discussion should focus."
- Make it sound like a real rep speaking to a clinician in the moment.
- If the scenario key challenges say exploring is more credible than defending, do not add a rescue claim.
- Do not add hype, broad discovery, or abstract framing.

Return ONLY the revised rep reply as plain text.`;

  const revised = await invokeWorkerText({
    prompt: revisionPrompt,
    max_tokens: 140,
    temperature: 0.1,
  });

  return String(revised || draft).trim();
}

export async function maybeDeRepeatStrongRepReply({
  scenario,
  turns,
  currentBehaviorState,
  currentJourneyState,
  draft,
}) {
  const stageText = `${scenario?.journeyStage || ""}`.toLowerCase();
  const activeConcernText = normalizeForMatch(getActiveConcernText(turns, scenario));

  if (
    /clinical_value|clinical_value/.test(stageText) &&
    /renal|kidney|egfr|gfr|dose adjustment|dose reduction|subgroup data|real-world renal data|numbers for my patient population|threshold|closest renal-specific data|closest renal-specific outcome/.test(activeConcernText)
  ) {
    return buildDeterministicEvidenceFitReply({ scenario, turns });
  }

  if (
    /clinical_value|clinical_value/.test(stageText) &&
    shouldHoldCostValueLane({
      scenario,
      turns,
      activeConcernText,
      lastRepText: getLastRepText(turns),
      draft,
    })
  ) {
    return buildCostValueFollowThroughReply({ scenario, turns, activeConcernText });
  }

  if (
    /commitment_close|adoption_implementation/.test(stageText) &&
    (CLOSE_PROOF_POINT_PATTERN.test(activeConcernText) || /one number|single data point|specific, compelling metric|what one piece|still too soft|not concrete enough/.test(activeConcernText))
  ) {
    return buildDeterministicCommitmentReply({ scenario, turns });
  }

  const lastRepText = getLastRepText(turns);
  if (!lastRepText || lastRepText !== String(draft || "").trim()) {
    return draft;
  }

  if (/initial_access/.test(stageText)) {
    const initialAccessBarrier = deriveInitialAccessBarrier(scenario, activeConcernText);
    const initialAccessChange = deriveInitialAccessOperationalChange(scenario, activeConcernText);

    if (/short version|few minutes|what'?s this about|approval path|prior auth|workflow|staff|step/i.test(activeConcernText)) {
      return `The short version is whether this leads to ${initialAccessChange}. If it does not change ${initialAccessBarrier}, it is not helping your team.`;
    }

    return `What matters is whether this changes ${initialAccessBarrier} in a way your staff would actually feel. If it does not, we should stop there.`;
  }

  const originalConcernText = getActiveConcernText(turns, scenario);
  const revisionPrompt = `
You are revising a pharma rep QA proxy reply because it repeats the exact same sentence the rep already used on the prior turn.

SCENARIO: ${scenario?.title || ""}
CURRENT BEHAVIOR STATE: ${currentBehaviorState || ""}
CURRENT JOURNEY STATE: ${currentJourneyState || ""}
ACTIVE HCP CONCERN: ${originalConcernText}
PREVIOUS REP LINE: ${lastRepText}

Revise the new reply with these rules:
- Keep it to 1-2 sentences.
- Do not repeat the previous rep line.
- Stay in the same strategy lane: specific, grounded, clinician-facing.
- Move the conversation one step forward with a narrower clarifier, practical implication, or next-step question.
- Do not become more abstract, more generic, or more salesy.

Return ONLY the revised rep reply as plain text.`;

  const revised = await invokeWorkerText({
    prompt: revisionPrompt,
    max_tokens: 120,
    temperature: 0.1,
  });

  return String(revised || draft).trim();
}

export async function maybeTightenSpokenRepReply({
  scenario,
  turns,
  currentBehaviorState,
  currentJourneyState,
  draft,
}) {
  const activeConcernText = getActiveConcernText(turns, scenario);
  const isPressureContext = /clinical_value|skeptical|operational|access_barrier|workflow/i.test(
    `${scenario?.journeyStage || ""} ${(scenario?.interactionPressure || []).join(" ")} ${currentBehaviorState || ""} ${currentJourneyState || ""}`
  );
  if (!isPressureContext) {
    return draft;
  }

  const wordCount = String(draft || "").trim().split(/\s+/).filter(Boolean).length;
  const needsTightening = OVER_EXPLANATORY_PATTERN.test(String(draft || "").trim()) || wordCount > 28;
  if (!needsTightening) {
    return draft;
  }

  const revisionPrompt = `
You are tightening one pharma rep QA proxy line so it sounds more spoken and less explanatory.

SCENARIO: ${scenario?.title || ""}
CURRENT BEHAVIOR STATE: ${currentBehaviorState || ""}
CURRENT JOURNEY STATE: ${currentJourneyState || ""}
ACTIVE HCP CONCERN: ${activeConcernText}

CURRENT DRAFT:
${draft}

Rules:
- Keep the same core meaning.
- Make it shorter, sharper, and more spoken.
- Do not sound like a slide deck, workflow memo, or polished explanation.
- Prefer one concrete answer and, if needed, one short follow-up.
- Remove phrases like "would be", "which can be", "ensure they're on track", "minimal disruption", or similar consultant phrasing.
- Keep it clinician-facing and realistic.

Return ONLY the revised rep reply as plain text.`;

  const revised = await invokeWorkerText({
    prompt: revisionPrompt,
    max_tokens: 120,
    temperature: 0.1,
  });

  return String(revised || draft).trim();
}
