import { HcpRuntimeProfile } from "./hcpRuntimeProfiles";
import { HcpTurnDirectiveSet } from "./hcpTurnDirectives";
import { detectOpeningAnchorType, enforceSourceBackedRealismSurface } from "./hcpRealismBackbone";

function normalizeText(value = ""): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function splitSentences(text = ""): string[] {
  return normalizeText(text)
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function trimToSentences(text = "", maxSentences = 1): string {
  const sentences = splitSentences(text);
  if (!sentences.length) return normalizeText(text);
  return normalizeText(sentences.slice(0, Math.max(1, maxSentences)).join(" "));
}

function ensureTerminalPunctuation(text = ""): string {
  const value = normalizeText(text).replace(/\s+[.?!]+$/, "");
  if (!value) return "";
  return /[.?!]$/.test(value) ? value : `${value}.`;
}

function enforceSentenceBoundaries(text = ""): string {
  let output = normalizeText(text);
  if (!output) return "";

  output = output
    .replace(/([a-z0-9])\s+(What|How|Why|Who|When|Where|Can|Could|Would|Should|Do|Does|Did|Is|Are|That|This|It|Keep|Stay|Show|Tell|Give)\b/g, "$1. $2")
    .replace(/([.?!])\s*([a-z])/g, (_, boundary, letter) => `${boundary} ${letter.toUpperCase()}`)
    .replace(/\s{2,}/g, " ");

  return normalizeText(output);
}

function enforceSentenceCase(text = ""): string {
  let output = normalizeText(text);
  if (!output) return "";
  output = output.replace(/^([a-z])/, (_, letter) => letter.toUpperCase());
  output = output.replace(/([.!?]\s+)([a-z])/g, (_, boundary, letter) => `${boundary}${letter.toUpperCase()}`);
  return output;
}

function repairDanglingTail(text = ""): string {
  let output = normalizeText(text);
  if (!output) return "";

  output = output
    .replace(/,\s*what specific (?:change|adjustment|step) would\s+(?=(That|This|I|We|What|How|Who)\b)/gi, ". ")
    .replace(/,\s*what'?s\.$/i, ".")
    .replace(/\s+what'?s\.$/i, ".")
    .replace(/\s+(what|how|why|who|when|where)\.$/i, ".")
    .replace(/\s+(what|how|why|who|when|where)\?$/i, ".")
    .replace(/\s+\byou\.$/i, ".")
    .replace(/\s+\b(and|or|to|for|with|of|the|a|an|that|this|they|them|we|i)\.$/i, ".")
    .replace(/\s+\b(can you [^.?!]*?)\s+\byou\./i, " $1.");
  output = output.replace(
    /\b(it|this|that|again|therapy|decision|care|treatment|cost|workflow|queue|staff|patients|population|subgroup|trial|data|outcome)\s+(What|How|Why|Who|When|Where|Can|Would|Should|That|This|It|Tell|Show|Give|Keep|Stay)\b/g,
    "$1. $2"
  );
  output = output.replace(
    /([a-z0-9])\s+(What single data point would change that\?|What first step would actually make this workable\?|What one next step would make this real enough to actually do\?|What one low-risk step would make this feel safe enough to try\?|What next step would make this real\?)/g,
    "$1. $2"
  );
  output = output.replace(
    /,\s+so\s+(what's|what is|how|why|who|when|where|can|would|should)\b/gi,
    ". $1"
  );

  return normalizeText(output);
}

function repairCommaSplices(text = ""): string {
  let output = normalizeText(text);
  if (!output) return "";

  output = output
    .replace(/,\s+(What|How|Why|Who|When|Where|Can|Could|Would|Should|Do|Does|Did|Is|Are)\b/g, ". $1")
    .replace(/,\s+(Keep|Stay|Show|Tell|Give)\b/g, ". $1");

  return normalizeText(output);
}

function repairQuestionPunctuation(text = ""): string {
  let output = normalizeText(text);
  if (!output) return "";

  output = output
    .replace(/\.\s*(What|How|Why|Who|When|Where|Can|Could|Would|Should|Do|Does|Did|Is|Are)\b/g, "? $1")
    .replace(/\?\s*\?/g, "?")
    .replace(/\.\?$/g, "?");

  return normalizeText(output);
}

function repairIncompleteOperationalAsks(text = ""): string {
  let output = normalizeText(text);
  if (!output) return "";

  output = output
    .replace(/\bwho owns that step\.$/i, "Who owns that step?")
    .replace(/\bwhat happens next\.$/i, "What happens next?")
    .replace(/\bwhat changes for staff\.$/i, "What changes for staff?")
    .replace(/\bwhat changes in the access step\.$/i, "What changes in the access step?")
    .replace(/\bwhat's the point\.$/i, "What's the point?");

  return normalizeText(output);
}

function dedupeLateStageQuestions(text = ""): string {
  const sentences = splitSentences(text);
  if (!sentences.length) return normalizeText(text);

  const seen = new Set<string>();
  const retained: string[] = [];
  const tokenSet = (value = "") => new Set(
    value
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 3)
  );
  const overlapRatio = (a = "", b = "") => {
    const aTokens = tokenSet(a);
    const bTokens = tokenSet(b);
    if (!aTokens.size || !bTokens.size) return 0;
    let shared = 0;
    aTokens.forEach((token) => {
      if (bTokens.has(token)) shared += 1;
    });
    return shared / Math.min(aTokens.size, bTokens.size);
  };

  const kept = sentences.filter((sentence) => {
    const normalized = sentence.toLowerCase().replace(/[.?!]+$/g, "").trim();
    if (!normalized) return false;
    if (seen.has(normalized)) return false;
    if (retained.some((prior) => overlapRatio(prior, sentence) >= 0.84)) return false;
    seen.add(normalized);
    retained.push(sentence);
    return true;
  });

  return normalizeText(kept.join(" "));
}

function hasConcreteOperationalAsk(text = ""): boolean {
  return /\b(what|which|who|how)\b.{0,44}\b(access step|next step|first step|staff|team|owner|owns|workflow|implementation|process change|specific change|specific adjustment|practical)\b/i.test(text)
    || /\b(access step|next step|first step|staff|team|owner|owns|workflow|implementation|process change|specific change|specific adjustment|practical)\b.{0,44}\b(what|which|who|how)\b/i.test(text);
}

function buildConditionalBridge(turn: HcpTurnDirectiveSet, scenario: any, hcpTurnCount = 0, mode = "partial_agreement"): string {
  const seed = `${scenario?.id || scenario?.title || "scenario"}|${turn.phase}|${turn.concernFamily}|${mode}|${hcpTurnCount}`;
  if (turn.concernFamily === "access") {
    return deterministicPick([
      "If this reduces rework in the access step, I can look at it.",
      "If there is a practical path through access, I can stay with it.",
      "If this changes the access work my staff actually does, I can look at it.",
      "If that makes the approval path cleaner for the team, I can keep going.",
    ], seed);
  }
  if (turn.concernFamily === "hesitation") {
    return deterministicPick([
      "If you can make the next step concrete enough to act on, I can look at it.",
      "If this becomes operationally clear, I can stay with it.",
      "If the implementation step is specific, I can keep looking at it.",
      "If this gives my team one practical move, I can stay with it.",
    ], seed);
  }
  return deterministicPick([
    "If you can keep this practical, I can stay with it.",
    "If this gets specific enough to act on, I can stay with it.",
    "If there is one concrete next step, I can keep looking at it.",
  ], seed);
}

function hasNaturalTimePressureDirective(text = ""): boolean {
  return /\b(keep it short|give me the short version|keep it quick|briefly|one quick point|one practical point|short version)\b/i.test(String(text || ""));
}

function pickDeterministicTimeTail(seed = ""): string {
  return deterministicPick([
    "Keep it short.",
    "Give me the short version.",
    "One quick point.",
    "One practical point.",
  ], seed || "time-tail");
}

function applyGlobalSpokenRewrites(text = ""): string {
  let output = normalizeText(text);
  const rewrites: Array<[RegExp, string]> = [
    [/\bI would want a closer look\b/gi, "I'd want a closer look"],
    [/\bI would want to see the data\b/gi, "I'd want to see the data"],
    [/\bwhat specific aspects of\b/gi, "what about"],
    [/\bwhat specific data do you have on\b/gi, "what data do you have on"],
    [/\bwhat specific biomarkers are you looking for\b/gi, "what biomarkers are you looking for"],
    [/\bwhat specific subgroup outcomes\b/gi, "what subgroup outcomes"],
    [/\bwhat specific patient characteristics\b/gi, "what patient characteristics"],
    [/\bthat is still broad\b/gi, "That's still broad"],
    [/\bthat is still too broad\b/gi, "That's still too broad"],
    [/\bthat is helpful, but\b/gi, "That's helpful, but"],
    [/\bit is worth a look\b/gi, "it's worth a look"],
    [/\bit is practical\b/gi, "it's practical"],
    [/\bit is that contained\b/gi, "it's that contained"],
    [/\bI am\b/gi, "I'm"],
    [/\bdo not\b/gi, "don't"],
    [/\bcan not\b/gi, "can't"],
  ];

  rewrites.forEach(([pattern, replacement]) => {
    output = output.replace(pattern, replacement);
  });

  output = output
    .replace(/\bMy question is always the same\.\s+For the\b/gi, "For the")
    .replace(/\bI keep coming back to the same question\.\s+For the\b/gi, "For the")
    .replace(/\bI still need to understand\s+for the patients who would actually use this,\s*/gi, "For the patients who would actually use this, ")
    .replace(/\bMy question is always the same\b/gi, "I still need to understand")
    .replace(/\bI keep coming back to the same question\b/gi, "I still need to understand")
    .replace(/\bI still need to understand:\s*/gi, "I still need to understand ")
    .replace(/\bThe practical test is whether\b/gi, "I need to see whether")
    .replace(/\bThe useful answer is whether\b/gi, "I need to know whether")
    .replace(/\bThe useful answer is the\b/gi, "The")
    .replace(/\bThe useful answer is an\b/gi, "An")
    .replace(/\bThe useful answer is\b/gi, "What matters is")
    .replace(/\bThe direct answer is that\b/gi, "")
    .replace(/\bThe direct answer is\b/gi, "")
    .replace(/\bThe real question is\b/gi, "I still need to understand")
    .replace(/\bIf the real blocker is\b/gi, "If that's really the sticking point,")
    .replace(/\bIf the blocker is\b/gi, "If that's the sticking point,")
    .replace(/\bThe one thing to know is whether\b/gi, "What I need to know is whether")
    .replace(/\bThe one thing that usually slows care is\b/gi, "What usually slows care is")
    .replace(/\bThe one step that should save time is\b/gi, "The step that should save time is")
    .replace(/\bcan you make this quick\b/gi, "keep it short")
    .replace(/\bmake this quick\b/gi, "keep it short")
    .replace(/\bI need to see whether:\s*/gi, "I need to see whether ")
    .replace(/\bI need to know whether:\s*/gi, "I need to know whether ")
    .replace(/\b(Then the real question is|The real question is|The practical test is|The useful answer is|The direct answer is|The one thing is|The one change is|That is the gap)\s*:\s*/g, "$1. ")
    .replace(/,\s*then\s+/gi, ", ")
    .replace(/\s+:\s+/g, ". ");

  output = output
    .replace(/\bKeep it brief\b/gi, "Give me the short version")
    .replace(/\bKeep this brief\b/gi, "Give me the short version")
    .replace(/\bKeep it tight\b/gi, "Give me the short version")
    .replace(/\bMake it quick\b/gi, "Keep it short")
    .replace(/\bover the access\b/gi, "through that access step")
    .replace(/\bnot just the product\s+(What single data point would change that\?)/gi, "not just the product. $1");

  output = output.replace(
    /([a-z0-9])\s+(What|How|Why|Who|When|Where|If|Can|Would|Should|Keep|Stay|Show|Tell|Give)\b/g,
    "$1. $2"
  );
  output = output.replace(/\b(now|here|there)\s+(Keep|Stay|Show|Tell|Give)\b/g, "$1. $2");
  output = output.replace(/,\s*(now|here|there)\.\s*(Keep|Stay|Show|Tell|Give)\b/g, ". $2");
  output = output.replace(/\b(now|here|there)\s+(Keep it brief|Keep this brief|Keep it tight)\b/gi, "$1. $2");
  output = output.replace(/,\s*now\s+(Keep it brief|Keep this brief|Keep it tight)\.?$/gi, ". $1.");

  return enforceSentenceBoundaries(output);
}

function applyDomainCadence(text: string, domain: string, concernFamily: string): string {
  let output = text;

  if (domain === "oncology" && concernFamily === "evidence") {
    output = output
      .replace(/\bwhat changes treatment choice in practice\b/gi, "what changes treatment choice")
      .replace(/\bwhat changes for me in practice\b/gi, "what changes for me")
      .replace(/\bdecision-relevant implication\b/gi, "decision point");
  }

  if (domain === "hiv") {
    output = output
      .replace(/\bwhat access bottleneck are you actually trying to solve\b/gi, "what bottleneck are you solving")
      .replace(/\bwho owns the next practical step\b/gi, "who owns the next step")
      .replace(/\bwhat extra steps does that actually add\b/gi, "what extra step does that add")
      .replace(/\bwhat happens after that\b/gi, "what happens next");
  }

  if (domain === "cardiology") {
    output = output
      .replace(/\bwhat changes in routine care\b/gi, "what changes")
      .replace(/\bwhat changes before the patient leaves\b/gi, "what changes before discharge")
      .replace(/\bwhat slows things down for staff\b/gi, "what slows things down")
      .replace(/\bwhat does that add for the team\b/gi, "what does that add");
  }

  if (domain === "rare" && concernFamily === "screening") {
    output = output
      .replace(/\bwhat would actually identify the right patient\b/gi, "what would actually identify the right patient")
      .replace(/\bpractical workup relevance\b/gi, "practical workup value");
  }

  if (domain === "immunology") {
    output = output
      .replace(/\bwhat patient type are you actually talking about\b/gi, "which patient type are you talking about")
      .replace(/\bwhat changes in day-to-day practice\b/gi, "what changes in practice");
  }

  if (domain === "pulmonology") {
    output = output
      .replace(/\bwhat changes in follow-up\b/gi, "what changes in follow-up")
      .replace(/\bwhat gets added for staff\b/gi, "what gets added");
  }

  if (domain === "rheumatology") {
    output = output
      .replace(/\bwhat does that add for the team\b/gi, "what does that add for staff")
      .replace(/\bwhat extra step does that add\b/gi, "what extra step does that add for staff")
      .replace(/\bwhat happens next\b/gi, "what happens after that")
      .replace(/\bwho owns that step\b/gi, "who picks that up");
  }

  if (domain === "dermatology") {
    output = output
      .replace(/\bwhat extra step does that add\b/gi, "what step does that add")
      .replace(/\bwhat happens next\b/gi, "what happens after that")
      .replace(/\bwho picks that up\b/gi, "who would own that");
  }

  if (domain === "nephrology") {
    output = output
      .replace(/\bwhat would change your mind\b/gi, "what would move you")
      .replace(/\bwhat one next step would make this real\b/gi, "what one step would make this real");
  }

  if (domain === "neurology") {
    output = output
      .replace(/\bwhat proof point would change that\b/gi, "what would settle that")
      .replace(/\bwhat changes practice\b/gi, "what actually changes practice");
  }

  if (domain === "hematology") {
    output = output
      .replace(/\bwhat happens next\b/gi, "what happens with the next case")
      .replace(/\bwhat one next step would make this real\b/gi, "what one next step would make you comfortable trying again");
  }

  if (domain === "endocrinology") {
    output = output
      .replace(/\bwhich patient type are you talking about\b/gi, "which patients are you talking about")
      .replace(/\bwhat changes in practice\b/gi, "what changes once they leave the office");
  }

  return normalizeText(output);
}

function buildExplicitFollowUpForConcern(concernFamily = "general"): string {
  switch (String(concernFamily || "").toLowerCase()) {
    case "evidence":
      return "What makes that apply to the patients you actually treat?";
    case "workflow":
      return "What actually changes for staff?";
    case "access":
      return "What actually changes in the access step?";
    case "screening":
      return "Which patients are you actually talking about?";
    case "time":
      return "What's the short version that matters here?";
    default:
      return "Why does that matter in practice?";
  }
}

function replaceVagueFollowUpClosers(text: string, concernFamily: string): string {
  const explicit = buildExplicitFollowUpForConcern(concernFamily);
  return normalizeText(text)
    .replace(/\bHow are you thinking about that\b[.?!]*/gi, explicit)
    .replace(/\bHow do you think about that\b[.?!]*/gi, explicit)
    .replace(/\bHow do you see it\b[.?!]*/gi, explicit)
    .replace(/\bHow do you see that\b[.?!]*/gi, explicit)
    .replace(/\bWalk me through that\b[.?!]*/gi, explicit)
    .replace(/\bWalk me through\b[.?!]*/gi, explicit);
}

function deterministicPick<T>(items: T[], seed = ""): T {
  if (!items.length) throw new Error("deterministicPick requires at least one item");
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return items[(hash >>> 0) % items.length];
}

function buildCostValueSpecificLine({
  turn,
  scenario,
  original,
}: {
  turn: HcpTurnDirectiveSet;
  scenario: any;
  original: string;
}): string {
  const seed = `${scenario?.title || "scenario"}|${turn.phase}|${turn.responseShape}|${turn.escalationStage}|${original}`;

  if (turn.escalationStage === "disengaging" || turn.responseShape === "conditional_close") {
    return deterministicPick([
      "If the cost side is still unclear, I still don't have enough information to evaluate its value.",
      "If you can't make the total-cost picture clear, I still don't have enough to judge whether it's worth it.",
      "At this point, if the spend still isn't clear, I still don't have enough information to make a value call.",
    ], seed);
  }

  if (
    turn.responseShape === "constraint_probe" ||
    turn.responseShape === "decision_probe" ||
    turn.escalationStage === "high_pressure"
  ) {
    return deterministicPick([
      "If you can't give me a clear total cost per patient, I still don't have enough information to evaluate its value.",
      "I don't need another efficacy point. I need the total cost picture, including any testing or monitoring this adds.",
      "If the cost side is unclear, I still don't have enough information to evaluate its value.",
    ], seed);
  }

  return deterministicPick([
    "If we're talking value, I need the total cost picture, not just the efficacy result.",
    "The clinical result is only part of it. I still need to understand what we'd actually spend for the patients who'd use this.",
    "Before this becomes a value discussion for me, I need the full cost picture for the patients who would actually be on it.",
  ], seed);
}

function applyCostValueSpokenTightening(
  text: string,
  turn: HcpTurnDirectiveSet,
  scenario: any,
  hcpTurnCount: number,
): string {
  const output = normalizeText(text);
  if (!output || hcpTurnCount === 0) return output;
  const openingAnchorType = detectOpeningAnchorType(scenario?.openingScene || "");
  if (openingAnchorType !== "cost_value") return output;

  const normalized = output.toLowerCase();
  const wordCount = output.split(/\s+/).filter(Boolean).length;
  const tooFormal =
    wordCount > 18 &&
    /\bhow do you factor in\b|\bhow do you justify\b|\bhow do you expect me to reconcile\b|\bwhen calculating the overall cost\b|\boverall cost equation\b|\bdiagnostic workups\b|\bongoing management\b|\badditional expenditures\b|\badditional expenses\b|\bancillary tests\b|\bassociated with\b|\bintensified diagnostic\b|\bfollow-up regimen\b|\badditional expense per patient\b/i.test(output);

  if (!tooFormal) return output;

  const seed = `${scenario?.title || "scenario"}|${turn.phase}|${turn.responseShape}|${turn.escalationStage}|${hcpTurnCount}|${output}`;

  if (turn.escalationStage === "disengaging" || turn.responseShape === "conditional_close") {
    return deterministicPick([
      "If the all-in cost still isn't clear, I still don't have enough information to decide if it's worth it.",
      "If you still can't break out the full spend, I still can't make a real value judgment on it.",
      "If the total-cost picture is still fuzzy, I still don't have enough to evaluate it properly.",
    ], seed);
  }

  return deterministicPick([
    "What am I supposed to do with the added testing and follow-up costs in that number?",
    "Then give me the full spend, including the added testing and monitoring.",
    "What does the all-in cost look like once you add the extra testing and follow-up?",
    "If I'm counting the monitoring and added workups too, what does that cost per patient actually become?",
  ], seed);
}

function buildWorkflowConditionalLine({
  turn,
  scenario,
  original,
  hcpTurnCount,
}: {
  turn: HcpTurnDirectiveSet;
  scenario: any;
  original: string;
  hcpTurnCount: number;
}): string {
  const seed = `${scenario?.title || "scenario"}|${turn.phase}|${turn.responseShape}|${turn.escalationStage}|${hcpTurnCount}|${original}`;
  return deterministicPick([
    "If this stays inside the current workflow, I can look at it.",
    "If staff does not inherit another step, I can stay with it.",
    "If this does not create another handoff for the team, I can keep looking at it.",
    "If this does not turn into one more task for staff, I can stay with the discussion.",
  ], seed);
}

function buildEvidenceConditionalLine({
  turn,
  scenario,
  original,
  hcpTurnCount,
}: {
  turn: HcpTurnDirectiveSet;
  scenario: any;
  original: string;
  hcpTurnCount: number;
}): string {
  const seed = `${scenario?.title || "scenario"}|${turn.phase}|${turn.responseShape}|${turn.escalationStage}|${hcpTurnCount}|${original}`;

  if (turn.phase === "objection_resolution") {
    return deterministicPick([
      "If you can show me the exact evidence that answers that concern, I can stay with it.",
      "If you can keep this to the proof point that actually answers the concern, I can stay with it.",
      "If there is evidence that directly answers that risk, keep it to that.",
    ], seed);
  }

  if (turn.phase === "implementation_commitment") {
    return deterministicPick([
      "If you can show me the one proof point that would justify trying this again, I can stay with it.",
      "If there is one data point that would make this usable again, keep it to that.",
      "If the evidence is strong enough to reopen this in practice, keep it to the one point that proves it.",
    ], seed);
  }

  return deterministicPick([
    "If you can show me the one proof point that would actually change the decision, I can stay with this.",
    "If there is one data point that would really change treatment choice, keep it to that.",
    "If you can make the evidence specific enough to change a real decision, I can stay with it.",
  ], seed);
}

function buildEvidenceCloseQuestion({
  turn,
  scenario,
  original,
  hcpTurnCount,
}: {
  turn: HcpTurnDirectiveSet;
  scenario: any;
  original: string;
  hcpTurnCount: number;
}): string {
  const seed = `${scenario?.title || "scenario"}|${turn.phase}|${turn.responseShape}|${turn.escalationStage}|question|${hcpTurnCount}|${original}`;

  if (turn.phase === "objection_resolution") {
    return deterministicPick([
      "What evidence would actually answer that concern?",
      "What proof point would actually settle that?",
      "What data would actually close that gap for you?",
    ], seed);
  }

  if (turn.phase === "implementation_commitment") {
    return deterministicPick([
      "What proof point would make this usable again?",
      "What data would make you comfortable trying this again?",
      "What evidence would reopen this in practice?",
    ], seed);
  }

  return deterministicPick([
    "What one proof point would actually change the decision?",
    "What one data point would actually change treatment choice?",
    "What evidence would actually move this from discussion to decision?",
  ], seed);
}

function applyAnchorSpecificProgression(
  text: string,
  turn: HcpTurnDirectiveSet,
  scenario: any,
  hcpTurnCount = 0,
): string {
  const output = normalizeText(text);
  if (!output || hcpTurnCount === 0) return output;

  const openingAnchorType = detectOpeningAnchorType(scenario?.openingScene || "");

  if (openingAnchorType === "cost_value") {
    const genericValueLoop =
      /\bhow can i assess the value\b|\bevaluate value\b|\bjustify the cost\b|\bworth the spend\b|\bwhat changes for my patients'? care\b|\bwhat changes practice\b/i.test(output);
    const missingCostSpecificity =
      !/\btotal cost\b|\bper patient\b|\btesting\b|\bmonitoring\b|\bformulary\b|\bbudget\b|\bwhat we'd spend\b|\bspend\b/i.test(output);

    if (genericValueLoop || (turn.concernFamily === "evidence" && missingCostSpecificity)) {
      return buildCostValueSpecificLine({
        turn,
        scenario,
        original: output,
      });
    }
  }

  if (openingAnchorType === "workflow" || turn.concernFamily === "workflow") {
    const repeatedWorkflowConditional =
      /\bif this does not add another staff step, i can look at it\b|\bif this stays workable for staff, i can stay with it\b/i.test(output);
    if (repeatedWorkflowConditional && hcpTurnCount > 1) {
      return buildWorkflowConditionalLine({
        turn,
        scenario,
        original: output,
        hcpTurnCount,
      });
    }
  }

  return output;
}

function applyShapeCompression(
  text: string,
  turn: HcpTurnDirectiveSet,
  profile: HcpRuntimeProfile,
  scenario: any,
  hcpTurnCount = 0,
  liveRepAlignmentActive = false,
): string {
  let output = normalizeText(text);
  const firstHcpTurn = hcpTurnCount === 0;
  const journeyStage = String(scenario?.journeyStage || "").toLowerCase();
  const authoredOpeningScene = normalizeText(scenario?.openingScene || "");
  const authoredOpeningSentenceCount =
    authoredOpeningScene
      .split(/[.?!]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .length;
  const preserveOpeningSentenceCount =
    firstHcpTurn && !liveRepAlignmentActive
      ? Math.min(
          3,
          Math.max(
            ["initial_access", "discovery", "clinical_value", "adoption_implementation", "commitment_close"].includes(journeyStage)
              ? 2
              : 1,
            authoredOpeningSentenceCount || 1,
          ),
        )
      : 0;
  const maxSentences =
    preserveOpeningSentenceCount > 0
      ? preserveOpeningSentenceCount
      : turn.responseShape === "compressed_probe" || turn.responseShape === "conditional_close"
      ? 1
      : turn.responseShape === "pushback" || profile.brevity === "tight"
        ? 1
        : 2;
  output = trimToSentences(output, maxSentences);

  const words = output.split(/\s+/).filter(Boolean);
  const effectiveWordBudget =
    preserveOpeningSentenceCount > 0
      ? Math.max(turn.targetWordBudget, preserveOpeningSentenceCount >= 3 ? 52 : 38)
      : turn.targetWordBudget;
  if (words.length > effectiveWordBudget) {
    output = `${words.slice(0, effectiveWordBudget).join(" ").replace(/[,:;]+$/, "")}.`;
  }

  return ensureTerminalPunctuation(output);
}

function applyLateStageNarrowing(
  text: string,
  turn: HcpTurnDirectiveSet,
  scenario: any,
  hcpTurnCount = 0,
): string {
  let output = text;
  if (hcpTurnCount === 0) return normalizeText(output);

  if (turn.closeMode && turn.responseShape === "partial_agreement" && !/\bif you can|if that can|if this can|i could look at|i can look at|i’d look at|i'd look at|i'm open to\b/i.test(output)) {
    if (turn.concernFamily === "evidence") {
      output = `${buildEvidenceConditionalLine({
        turn,
        scenario,
        original: output,
        hcpTurnCount,
      })} ${output.replace(/[.?!]+$/, "")}`;
    } else if (turn.concernFamily === "access") {
      output = hasConcreteOperationalAsk(output)
        ? output
        : `${buildConditionalBridge(turn, scenario, hcpTurnCount, "partial_agreement")} ${output.replace(/[.?!]+$/, "")}`;
    } else if (turn.concernFamily === "workflow") {
      output = `${deterministicPick([
        "If this does not add another staff step, I can look at it.",
        "If this stays inside the current workflow, I can look at it.",
        "If staff does not inherit another step, I can stay with it.",
        "If this does not create another handoff for the team, I can keep looking at it.",
      ], `${turn.phase}|${turn.concernFamily}|partial_agreement|${hcpTurnCount}|${output}`)} ${output.replace(/[.?!]+$/, "")}`;
    } else if (turn.concernFamily === "hesitation") {
      output = hasConcreteOperationalAsk(output)
        ? output
        : `${buildConditionalBridge(turn, scenario, hcpTurnCount, "partial_agreement")} ${output.replace(/[.?!]+$/, "")}`;
    } else if (turn.concernFamily === "adoption_caution") {
      output = `If this feels safe enough not to be first, I can look at it. ${output.replace(/[.?!]+$/, "")}`;
    } else {
      output = `If you can keep this practical, I can stay with it. ${output.replace(/[.?!]+$/, "")}`;
    }
  }

  if (turn.closeMode && turn.escalationStage !== "disengaging" && !/\bif\b.*\bcan\b|\bif\b.*\bshow\b|\bif\b.*\bkeep\b|\bif\b.*\bworkable\b/i.test(output)) {
    if (turn.concernFamily === "evidence") {
      output = `${buildEvidenceConditionalLine({
        turn,
        scenario,
        original: output,
        hcpTurnCount,
      })} ${output.replace(/[.?!]+$/, "")}`;
    } else if (turn.concernFamily === "access") {
      output = hasConcreteOperationalAsk(output)
        ? output
        : `${buildConditionalBridge(turn, scenario, hcpTurnCount, "close_mode")} ${output.replace(/[.?!]+$/, "")}`;
    } else if (turn.concernFamily === "workflow") {
      output = `${deterministicPick([
        "If this stays workable for staff, I can stay with it.",
        "If this stays inside the current workflow, I can stay with it.",
        "If this does not add another staff step, I can stay with it.",
        "If the team does not inherit another handoff, I can stay with it.",
      ], `${turn.phase}|${turn.concernFamily}|close_mode|${hcpTurnCount}|${output}`)} ${output.replace(/[.?!]+$/, "")}`;
    } else if (turn.concernFamily === "hesitation") {
      output = hasConcreteOperationalAsk(output)
        ? output
        : `${buildConditionalBridge(turn, scenario, hcpTurnCount, "close_mode")} ${output.replace(/[.?!]+$/, "")}`;
    } else if (turn.concernFamily === "adoption_caution") {
      output = `If this feels safe enough to trial without being first, I can stay with it. ${output.replace(/[.?!]+$/, "")}`;
    }
  }

  if (turn.closeMode && !/next step|one step|one patient|one case|one action|open to|would you be open/i.test(output)) {
    if (turn.concernFamily === "evidence") {
      output = `${output.replace(/[.?!]+$/, "")} ${buildEvidenceCloseQuestion({
        turn,
        scenario,
        original: output,
        hcpTurnCount,
      })}`;
    } else if (turn.concernFamily === "workflow" || turn.concernFamily === "access") {
      output = `${output.replace(/[.?!]+$/, "")} What first step would actually make this workable?`;
    } else if (turn.concernFamily === "hesitation") {
      output = `${output.replace(/[.?!]+$/, "")} What one next step would make this real enough to actually do?`;
    } else if (turn.concernFamily === "adoption_caution") {
      output = `${output.replace(/[.?!]+$/, "")} What one low-risk step would make this feel safe enough to try?`;
    } else {
      output = `${output.replace(/[.?!]+$/, "")} What next step would make this real?`;
    }
  }

  if (turn.objectionMode && turn.repeatedMisses.includes("objection_navigation") && !/still|again|same issue|that part/i.test(output)) {
    output = `That still doesn't answer it. ${output}`;
  }

  if (turn.closeMode && turn.escalationStage !== "disengaging") {
    output = output
      .replace(/\bI'?m open to hearing more\b/gi, "I can hear one more practical point")
      .replace(/\bI'?m willing to keep talking\b/gi, "I can stay with this if it stays concrete")
      .replace(/\bI'?m interested\b/gi, "I'm interested if it stays usable");
  }

  return normalizeText(output);
}

function applyContinuityPressure(
  text: string,
  turn: HcpTurnDirectiveSet,
  profile: HcpRuntimeProfile,
  hcpTurnCount = 0,
): string {
  let output = normalizeText(text);
  if (hcpTurnCount === 0) return output;

  if (turn.escalationStage === "high_pressure" || turn.escalationStage === "disengaging") {
    output = output
      .replace(/\bLet me step back\b/gi, "Let's stay on the point")
      .replace(/\bBefore we get ahead of ourselves\b/gi, "Before we go further")
      .replace(/\bI'm trying to understand\b/gi, "I'm looking at")
      .replace(/\bI'm still trying to understand\b/gi, "I'm still looking at");
  }

  if (profile.directness === "high" && turn.concernFamily === "time") {
    output = output
      .replace(/\bWhat would you want me to focus on\b/gi, "What do you want me to focus on");
  }

  return normalizeText(output);
}

function applyProfessionalBoundaryBalance(
  text: string,
  turn: HcpTurnDirectiveSet,
  profile: HcpRuntimeProfile,
  scenario: any,
  hcpTurnCount = 0,
): string {
  let output = normalizeText(text);
  if (!output) return "";

  // Keep pressure professional: remove abrupt phrasing that reads as hostile.
  output = output
    .replace(/\bNo, stay with it\b/gi, "Let's stay on the point")
    .replace(/\bNo\. Stay with it\b/gi, "Let's stay on the point")
    .replace(/\bI don't have time for this\b/gi, "I don't have time for a long loop here")
    .replace(/\bThis is a waste of time\b/gi, "This isn't useful if it stays this broad")
    .replace(/\bYou're not listening\b/gi, "We're not aligned on the concern yet");

  // Avoid over-accommodating language in guarded/high-pressure states.
  if (
    profile.warmth === "guarded" ||
    profile.patienceThreshold === "low" ||
    turn.escalationStage === "high_pressure" ||
    turn.escalationStage === "disengaging"
  ) {
    output = output
      .replace(/\bI can stay with this if it stays concrete\b/gi, "Keep this concrete or we should pause here")
      .replace(/\bI can stay with it\b/gi, "Keep it concrete")
      .replace(/\bI can keep looking at it\b/gi, "Keep it decision-relevant")
      .replace(/\bI can look at it\b/gi, "Make it practical")
      .replace(/\bI can hear one more practical point\b/gi, "Give me one practical point");
  }

  // Deterministic polite wrap-up when repeated misses + low patience indicate low value.
  const sustainedMisses = Array.isArray(turn.repeatedMisses) && turn.repeatedMisses.length >= 2;
  const shouldWrap =
    hcpTurnCount >= 2 &&
    sustainedMisses &&
    (turn.escalationStage === "disengaging" || profile.patienceThreshold === "low");

  if (shouldWrap && !/pause here|circle back|send me the one point|come back better prepared|send me one concrete point/i.test(output)) {
    const wrapSeed = `${scenario?.title || "scenario"}|${turn.phase}|${turn.concernFamily}|${hcpTurnCount}`;
    const wrapLine = deterministicPick([
      "Let's pause here. If you can send one concrete point that addresses this blocker, we can revisit.",
      "I need to get back to patients. Send one decision-relevant point on this exact concern and we'll circle back.",
      "Let's stop here for now. If you come back with one concrete answer to this blocker, we can continue.",
    ], wrapSeed);
    output = trimToSentences(`${output.replace(/[.?!]+$/, "")}. ${wrapLine}`, 2);
  }
  return normalizeText(output);
}

export function applyHcpResponseSurface({
  hcpReply,
  scenario,
  turn,
  profile,
  hcpTurnCount = 0,
  liveRepAlignmentActive = false,
}: {
  hcpReply: string;
  scenario: any;
  turn: HcpTurnDirectiveSet;
  profile: HcpRuntimeProfile;
  hcpTurnCount?: number;
  liveRepAlignmentActive?: boolean;
}): string {
  let output = normalizeText(hcpReply);
  if (!output) return "";
  // === BEGIN PILOT PATCH: Narration/Cue Leakage Guard ===
  output = guardAndRepairNarrationLeakage(output, { scenario, turn, profile, hcpTurnCount });
  // === END PILOT PATCH ===
  output = enforceSourceBackedRealismSurface({
    hcpReply: output,
    scenario,
    turn,
    profile,
    hcpTurnCount,
  });

  output = applyGlobalSpokenRewrites(output);
  output = replaceVagueFollowUpClosers(output, turn.concernFamily);
  output = applyAnchorSpecificProgression(output, turn, scenario, hcpTurnCount);
  output = applyCostValueSpokenTightening(output, turn, scenario, hcpTurnCount);
  output = applyDomainCadence(output, turn.domain, turn.concernFamily);
  output = applyLateStageNarrowing(output, turn, scenario, hcpTurnCount);
  output = applyContinuityPressure(output, turn, profile, hcpTurnCount);
  output = applyProfessionalBoundaryBalance(output, turn, profile, scenario, hcpTurnCount);
  output = applyShapeCompression(output, turn, profile, scenario, hcpTurnCount, liveRepAlignmentActive);

  if (
    hcpTurnCount > 0 &&
    scenario?.interactionPressure?.includes("time_constrained") &&
    !/clock|time|quick|brief|tight|patient|schedule|doorway|room/i.test(output) &&
    !hasNaturalTimePressureDirective(output) &&
    turn.escalationStage !== "baseline"
  ) {
    output = trimToSentences(enforceSentenceBoundaries(output), 1);
  }

  if (turn.phase === "objection_resolution" && turn.concernFamily === "access") {
    output = output
      .replace(/\bwhat are you solving here\b/gi, "what are you solving")
      .replace(/\bwho exactly owns that step\b/gi, "who owns that step");
  }

  if (turn.phase === "implementation_commitment" && turn.concernFamily === "workflow") {
    output = output
      .replace(/\bwhat happens after that\b/gi, "what happens next")
      .replace(/\bwho carries that forward\b/gi, "who picks that up");
  }

  if (turn.closeMode && turn.responseShape === "conditional_close") {
    output = output
      .replace(/\bwhat next step would make this real\b/gi, "what one next step would make this real")
      .replace(/\bwhat first step would actually make this workable\b/gi, "what one step would actually make this workable");
  }

  return ensureTerminalPunctuation(
    repairQuestionPunctuation(
      repairIncompleteOperationalAsks(
        repairDanglingTail(
          enforceSentenceCase(
            dedupeLateStageQuestions(
              repairCommaSplices(
                enforceSentenceBoundaries(output)
              )
            )
          )
        )
      )
    )
  );
}

// === BEGIN PILOT PATCH: Narration/Cue Leakage Guard ===
const NARRATION_PATTERNS = [
  /^The HCP\b/i,
  /^Keeps\b/i,
  /^Looks\b/i,
  /^Glances\b/i,
  /^Leans\b/i,
  /^Checks\b/i,
  /looks back/i,
  /glances at/i,
  /keeps the/i,
  /posture/i,
  /expression/i,
  /with very little space/i,
  /under one hand/i,
  /eyes narrowing/i,
  /attention tightening/i,
];

function guardAndRepairNarrationLeakage(text: string, context: { scenario: any, turn: any, profile: any, hcpTurnCount: number }): string {
  const sentences = splitSentences(text);
  if (sentences.length > 1 && NARRATION_PATTERNS.some((pat) => pat.test(sentences[0] || ""))) {
    const spokenTail = sentences.slice(1).join(" ").trim();
    if (spokenTail && !NARRATION_PATTERNS.some((pat) => pat.test(spokenTail))) {
      return spokenTail;
    }
  }

  const isNarration = NARRATION_PATTERNS.some((pat) => pat.test(text));
  if (!isNarration) return text;
  // If the text is only narration, replace with a natural HCP line based on context
  return repairNarrationToNaturalLine(text, context);
}

function repairNarrationToNaturalLine(text: string, { scenario, turn, profile, hcpTurnCount }: { scenario: any, turn: any, profile: any, hcpTurnCount: number }): string {
  // Use concernFamily, pressure, and phase to select a natural line
  const concern = (turn && turn.concernFamily) || "general";
  const phase = (turn && turn.phase) || "general";
  const pressure = (turn && turn.escalationStage) || "baseline";
  // Map some common narration to natural lines
  const narrationMap: Array<{ pat: RegExp, line: string }> = [
    [/Keeps the study page in view/i, "Show me which patient this evidence actually changes."],
    [/Looks at the schedule/i, "I have a minute, so give me the part that matters."],
    [/Glances at the patient summary/i, "Which patient does this actually apply to?"],
    [/Keeps the coverage notes in view/i, "If this still needs prior auth, tell me what changes for my staff."],
    [/Glances at watch/i, "Give me the specific point."],
    [/Keeps the formulary sheet/i, "That still does not answer the access issue."],
    [/posture closed/i, "Name the specific issue you want me to reconsider."],
    [/very little space left/i, "Stay with the decision in front of me."],
  ];
  for (const { pat, line } of narrationMap) {
    if (pat.test(text)) return line;
  }
  // Fallback: use concern/pressure/phase to generate a short, natural line
  if (concern === "access") {
    return "If this still needs prior auth, tell me what changes for my staff.";
  }
  if (concern === "evidence") {
    return "Show me the endpoint that changes the decision.";
  }
  if (concern === "safety") {
    return "Start with the safety signal I should care about.";
  }
  if (pressure === "high_pressure" || pressure === "disengaging") {
    return "I have a minute, so give me the decision point.";
  }
  if (phase === "implementation_commitment") {
    return "Who actually owns the next step?";
  }
  // Default fallback
  return "Name the specific issue you want me to reconsider.";
}
// === END PILOT PATCH ===
