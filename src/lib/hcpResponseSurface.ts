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
    .replace(/,\s*what'?s\.$/i, ".")
    .replace(/\s+what'?s\.$/i, ".")
    .replace(/\s+(what|how|why|who|when|where)\.$/i, ".")
    .replace(/\s+(what|how|why|who|when|where)\?$/i, ".")
    .replace(/\s+\byou\.$/i, ".")
    .replace(/\s+\b(and|or|to|for|with|of|the|a|an|that|this|they|them|we|i)\.$/i, ".")
    .replace(/\s+\b(can you [^.?!]*?)\s+\byou\./i, " $1.")
    .replace(/\s+\b(what [^.?!]*?)\s+\bfor\./i, " $1?")
    .replace(/\s+\b(what [^.?!]*?)\s+\bto\./i, " $1?")
    .replace(/\bkeep it to\.$/i, "keep it to one point.");

  output = output.replace(/\.\./g, ".");
  return normalizeText(output);
}

function repairQuestionPunctuation(text = ""): string {
  const parts = normalizeText(text)
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.map((part) => {
    const cleaned = part.replace(/\s+([.?!])$/, "$1");
    if (/^(what|how|why|who|when|where|can|would|should|do|does|did|is|are|am|will|could)\b/i.test(cleaned) && /\.$/.test(cleaned)) {
      return cleaned.replace(/\.$/, "?");
    }
    if (/,\s*(what|how|why|who|when|where|can|would|should|do|does|did|is|are|am|will|could)\b/i.test(cleaned) && /\.$/.test(cleaned)) {
      return cleaned.replace(/\.$/, "?");
    }
    return cleaned;
  }).join(" ");
}

function repairCommaSplices(text = ""): string {
  let output = normalizeText(text);
  if (!output) return "";

  output = output
    .replace(/(\bqueue to get through),\s+(what's|what is)\b/gi, "$1. $2")
    .replace(/(\bpaperwork to get through),\s+(what's|what is)\b/gi, "$1. $2")
    .replace(/(\bstaff already buried),\s+(what's|what is)\b/gi, "$1. $2")
    .replace(/(\bI've got [^,.?!]+),\s+(what's|what is|tell me|show me|give me)\b/gi, "$1. $2");

  return normalizeText(output);
}

function inferMissingObject(text = ""): string {
  const value = normalizeText(text).toLowerCase();
  if (/prior auth queue|approval queue/.test(value)) return "it";
  if (/prior auth/.test(value)) return "that";
  if (/queue/.test(value)) return "it";
  if (/workflow|staff step|handoff|monitoring/.test(value)) return "that";
  if (/cost|spend|testing|monitoring/.test(value)) return "that";
  return "that";
}

function repairIncompleteOperationalAsks(text = ""): string {
  let output = normalizeText(text);
  if (!output) return "";

  const object = inferMissingObject(output);

  output = output
    .replace(/\b(help me reduce)\?$/i, `$1 ${object}?`)
    .replace(/\b(help reduce)\?$/i, `$1 ${object}?`)
    .replace(/\b(what's the one thing you can do to help me reduce)\?$/i, `$1 ${object}?`)
    .replace(/\b(what is the one thing you can do to help me reduce)\?$/i, `$1 ${object}?`)
    .replace(/\b(what's the one thing you can do to help reduce)\?$/i, `$1 ${object}?`)
    .replace(/\b(what is the one thing you can do to help reduce)\?$/i, `$1 ${object}?`)
    .replace(/\b(what's the one thing you can do to change)\?$/i, `$1 ${object}?`)
    .replace(/\b(what is the one thing you can do to change)\?$/i, `$1 ${object}?`)
    .replace(/\b(what specific action can you take to address)\.$/i, `$1 ${object}?`)
    .replace(/\b(what specific step can you take to address)\.$/i, `$1 ${object}?`)
    .replace(/\b(what can you do to address)\.$/i, `$1 ${object}?`);

  output = output
    .replace(/\bhelp me reduce that\?$/i, "help me reduce that burden on my staff?")
    .replace(/\bhelp me reduce it\?$/i, /prior auth queue|approval queue/i.test(output) ? "help me reduce it?" : "help me reduce that?")
    .replace(/\bwhat's the one thing you can do to help me reduce that\?$/i, "What's the one thing you can do to help reduce that?")
    .replace(/\bwhat is the one thing you can do to help me reduce that\?$/i, "What is the one thing you can do to help reduce that?");

  if (/prior auth queue/i.test(output)) {
    output = output
      .replace(/\bwhat's the one thing you can do to help reduce it\?$/i, "What's the one thing you can do to help reduce it?")
      .replace(/\bwhat's the one thing you can do to help reduce that\?$/i, "What's the one thing you can do to help reduce that queue?")
      .replace(/\bwhat is the one thing you can do to help reduce that\?$/i, "What is the one thing you can do to help reduce that queue?");
  }

  return normalizeText(output);
}

function dedupeLateStageQuestions(text = ""): string {
  let output = normalizeText(text);
  if (!output) return "";

  output = output
    .replace(
      /\b(What's the first step to get past prior auth\?)\s+(What first step would actually make this workable\?)/i,
      "$1"
    )
    .replace(
      /\b(What specific patient subgroup would I use this for to justify a formulary change\?)\s+(What next step would make this real\?)/i,
      "$1"
    )
    .replace(
      /\b(What one proof point would actually change the decision\?)\s+(What one data point would actually change treatment choice\?)/i,
      "$1"
    )
    .replace(
      /\b(What one data point would actually change treatment choice\?)\s+(What evidence would actually move this from discussion to decision\?)/i,
      "$1"
    )
    .replace(
      /\b(What's the smallest change I can make to test this without fully changing our protocol\?)\s+(What one low-risk step would make this feel safe enough to try\?)/i,
      "$1"
    )
    .replace(
      /\b(What's the smallest step I can take to test this without changing our entire workflow\?)\s+(What one low-risk step would make this feel safe enough to try\?)/i,
      "$1"
    )
    .replace(
      /\b(What one next step would make this real enough to actually do\?)\s+(What next step would make this real\?)/i,
      "$1"
    );

  return normalizeText(output);
}

function hasNaturalTimePressureDirective(text = ""): boolean {
  const value = normalizeText(text);
  return /\b(get to the point|short version|bottom line|one thing|only got a minute|only have a minute|few minutes|give me the short version|brief version|quick version)\b/i.test(value);
}

function pickDeterministicTimeTail(seed = ""): string {
  const options = [
    "Give me the short version.",
    "Get to the point.",
    "Just give me the short version.",
  ];
  const key = normalizeText(seed);
  const score = Array.from(key).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return options[score % options.length];
}

function enforceSentenceBoundaries(text = ""): string {
  let output = normalizeText(text);
  if (!output) return "";

  output = output.replace(
    /\b(I can look at it|I can stay with it|I can keep looking at it|I can keep looking)\s+(What|How|Why|Who|When|Where)\b/g,
    "$1. $2"
  );
  output = output.replace(
    /\b(point|version|now|room|practice|patients|staff|workflow|today)\s+(Keep it brief|Keep this brief|Keep it tight|Give me the short version|Get to the point|Make it quick)\b/gi,
    "$1. $2"
  );
  output = output.replace(
    /\b(point|version|now|room|practice|patients|staff|workflow|today)\s+(What|How|Why|Who|When|Where|Can|Would|Should|Tell|Show|Give|Keep|Stay)\b/g,
    "$1. $2"
  );
  output = output.replace(
    /\b(it|this|that|again|therapy|decision|care|treatment|cost|workflow|queue|staff)\s+(What|How|Why|Who|When|Where|Can|Would|Should|Tell|Show|Give|Keep|Stay)\b/g,
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
    firstHcpTurn
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
      output = `If there's a real way through that access step, I can look at it. ${output.replace(/[.?!]+$/, "")}`;
    } else if (turn.concernFamily === "workflow") {
      output = `${deterministicPick([
        "If this does not add another staff step, I can look at it.",
        "If this stays inside the current workflow, I can look at it.",
        "If staff does not inherit another step, I can stay with it.",
        "If this does not create another handoff for the team, I can keep looking at it.",
      ], `${turn.phase}|${turn.concernFamily}|partial_agreement|${hcpTurnCount}|${output}`)} ${output.replace(/[.?!]+$/, "")}`;
    } else if (turn.concernFamily === "hesitation") {
      output = `If you can make the next step concrete enough to actually do, I can look at it. ${output.replace(/[.?!]+$/, "")}`;
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
      output = `If there's a real path through that access step, I can stay with it. ${output.replace(/[.?!]+$/, "")}`;
    } else if (turn.concernFamily === "workflow") {
      output = `${deterministicPick([
        "If this stays workable for staff, I can stay with it.",
        "If this stays inside the current workflow, I can stay with it.",
        "If this does not add another staff step, I can stay with it.",
        "If the team does not inherit another handoff, I can stay with it.",
      ], `${turn.phase}|${turn.concernFamily}|close_mode|${hcpTurnCount}|${output}`)} ${output.replace(/[.?!]+$/, "")}`;
    } else if (turn.concernFamily === "hesitation") {
      output = `If this gets concrete enough to act on, I can stay with it. ${output.replace(/[.?!]+$/, "")}`;
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
      .replace(/\bLet me step back\b/gi, "No, stay with it")
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



function sanitizeNarrationLeak(text: string): string {
  let output = normalizeText(text);
  if (!output) return output;
  output = output
    .replace(/\bthe hcp\b[^.?!]*[.?!]?/gi, "")
    .replace(/\b(?:keeps?|looks?|glances?|checks?|leans?|nods?|eyes narrowing|attention tightening|posture closed down)\b[^.?!]*[.?!]?/gi, "")
    .replace(/\bwith very little space left in the exchange\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return normalizeText(output);
}

export function applyHcpResponseSurface({
  hcpReply,
  scenario,
  turn,
  profile,
  hcpTurnCount = 0,
}: {
  hcpReply: string;
  scenario: any;
  turn: HcpTurnDirectiveSet;
  profile: HcpRuntimeProfile;
  hcpTurnCount?: number;
}): string {
  let output = normalizeText(hcpReply);
  if (!output) return "";
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
  output = applyShapeCompression(output, turn, profile, scenario, hcpTurnCount);
  output = sanitizeNarrationLeak(output);

  if (
    hcpTurnCount > 0 &&
    scenario?.interactionPressure?.includes("time_constrained") &&
    !/clock|time|quick|brief|tight|patient|schedule|doorway|room/i.test(output) &&
    !hasNaturalTimePressureDirective(output) &&
    turn.escalationStage !== "baseline"
  ) {
    output = ensureTerminalPunctuation(output.replace(/[.?!]+$/, ""));
    output = `${output} ${pickDeterministicTimeTail(`${turn.phase}|${turn.concernFamily}|${turn.domain}|${output}`)}`;
    output = trimToSentences(enforceSentenceBoundaries(output), 2);
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
