import { HcpRuntimeProfile } from "./hcpRuntimeProfiles";
import { HcpTurnDirectiveSet } from "./hcpTurnDirectives";

function normalizeText(value = ""): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function splitSentences(text = ""): string[] {
  return normalizeText(text)
    .replace(/\bDr\./g, "Dr<abbr>")
    .replace(/\bMr\./g, "Mr<abbr>")
    .replace(/\bMs\./g, "Ms<abbr>")
    .replace(/\bMrs\./g, "Mrs<abbr>")
    .split(/(?<=[.!?])\s+/)
    .map((line) => line
      .replace(/Dr<abbr>/g, "Dr.")
      .replace(/Mr<abbr>/g, "Mr.")
      .replace(/Ms<abbr>/g, "Ms.")
      .replace(/Mrs<abbr>/g, "Mrs.")
      .trim())
    .filter(Boolean);
}

function trimToSentences(text = "", maxSentences = 1): string {
  const sentences = splitSentences(text);
  if (!sentences.length) return normalizeText(text);
  if (
    maxSentences <= 1 &&
    sentences.length > 1 &&
    sentences[0].split(/\s+/).length <= 8 &&
    (
      (!/[?]$/.test(sentences[0]) && /[?]$/.test(sentences[1])) ||
      /^(I'm doing alright|I am doing alright|Hi|Hello|Good morning|Good afternoon|Good evening)\b/i.test(sentences[0])
    )
  ) {
    return normalizeText(sentences.slice(0, 2).join(" "));
  }
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
    .replace(/([a-z0-9])\s+(What|How|Why|Who|When|Where|Can|Could|Would|Should|Do|Does|Did|Is|Are|That|This|It)\b/g, "$1. $2")
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

function repairCommaSplices(text = ""): string {
  return normalizeText(text)
    .replace(/,\s+(What|How|Why|Who|When|Where|Can|Could|Would|Should|Do|Does|Did|Is|Are)\b/g, ". $1")
    .replace(/,\s+(what|how|why|who|when|where|which|do|does|did|is|are)\b/g, ". $1")
    .replace(/\b(before my next patient|patients waiting|patient waiting|I have patients waiting),\s+(can you|could you|would you|what|how|why|which|give me|tell me)\b/gi, "$1. $2")
    .replace(/\b(I(?:'ve| have) (?:only )?got (?:a minute|a few minutes|limited time|patients waiting)),\s+(can you|could you|what|give me|tell me)\b/gi, "$1. $2")
    .replace(/\b(I(?:'m| am) between patients),\s+(can you|could you|what|give me|tell me)\b/gi, "$1. $2");
}

function repairQuestionPunctuation(text = ""): string {
  let output = normalizeText(text);
  if (!output) return "";

  output = output
    .replace(/\?\s*\?/g, "?")
    .replace(/\.\?$/g, "?")
    .replace(/\b(What|How|Why|Who|When|Where|Which|Can|Could|Would|Should|Do|Does|Did|Is|Are)([^.?!]*)\.$/, "$1$2?");

  return normalizeText(output);
}

function repairIncompleteOperationalAsks(text = ""): string {
  return normalizeText(text)
    .replace(/\bwho owns that step\.$/i, "Who owns that step?")
    .replace(/\bwhat happens next\.$/i, "What happens next?")
    .replace(/\bwhat changes for staff\.$/i, "What changes for staff?")
    .replace(/\bwhat changes in the access step\.$/i, "What changes in the access step?");
}

function dedupeSentences(text = ""): string {
  const seen = new Set<string>();
  const kept = splitSentences(text).filter((sentence) => {
    const normalized = sentence.toLowerCase().replace(/[.?!]+$/g, "").trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
  return normalizeText(kept.join(" "));
}

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
  /eyes narrowing/i,
  /attention tightening/i,
];

const BANNED_STOCK_PHRASE_PATTERNS = [
  /\bwhat'?s concretely different for me after this\b/i,
  /\bthe practical answer has to stay tied\b/i,
  /\bwhat changes in practice if this is worth continuing\b/i,
  /\bi hear that a lot\b/i,
  /\bkeep this brief\b/i,
  /\bkeep it brief\b/i,
  /\bkeep it tight\b/i,
  /\bi'?m not convinced yet\b/i,
  /\bi'?m not convinced this needs time yet\b/i,
  /\bwhat'?s the specific reason it matters for my patients\b/i,
];

function stripNarrationLeakage(text = ""): string {
  const sentences = splitSentences(text);
  if (!sentences.length) return "";

  const spoken = sentences.filter((sentence) => !NARRATION_PATTERNS.some((pattern) => pattern.test(sentence)));
  if (spoken.length) return normalizeText(spoken.join(" "));
  return "";
}

function stripBannedStockPhrases(text = ""): string {
  const scrub = (value = "") => normalizeText(
    BANNED_STOCK_PHRASE_PATTERNS.reduce((result, pattern) => result.replace(pattern, ""), value)
      .replace(/\s+([,.;?!])/g, "$1")
      .replace(/([.?!])\s*[.?!]+/g, "$1")
  );

  const sentences = splitSentences(text);
  if (!sentences.length) return scrub(text);

  const kept = sentences
    .map((sentence) => scrub(sentence))
    .filter((sentence) => sentence && !BANNED_STOCK_PHRASE_PATTERNS.some((pattern) => pattern.test(sentence)));

  return normalizeText(kept.join(" "));
}

function compressContractions(text = ""): string {
  return normalizeText(text)
    .replace(/\bI am\b/g, "I'm")
    .replace(/\bdo not\b/gi, "don't")
    .replace(/\bcan not\b/gi, "can't")
    .replace(/\bit is\b/gi, "it's");
}

function softenHostileTone(text = ""): string {
  return normalizeText(text)
    .replace(/\bwhat makes you think this is relevant to my practice\b/gi, "can you help me understand why this is relevant to my practice")
    .replace(/\bwhat makes you think this matters to my practice\b/gi, "can you help me understand why this matters to my practice")
    .replace(/\bwhat makes you think this is relevant\b/gi, "can you help me understand why this is relevant")
    .replace(/\bmake it relevant to my patients\b/gi, "can you connect this to my patients")
    .replace(/\bgive me one (?:concrete|practical|useful|clear) point\b/gi, "help me understand the most relevant point")
    .replace(/\bgive me one reason\b/gi, "help me understand the reason")
    .replace(/\bgive me the short version\b/gi, "walk me through the short version")
    .replace(/\bgive me the practical\b/gi, "help me understand the practical")
    .replace(/\bbe quick\b/gi, "we can be brief")
    .replace(/\bmake this quick\b/gi, "we can keep this brief")
    .replace(/^look,\s*/i, "")
    .replace(/\bwhat'?s the point of\b/gi, "what is the clinical point of")
    .replace(/\bwhat'?s the point\b/gi, "what is the clinical point")
    .replace(/\bwhat is the clinical point of this visit\b/gi, "what were you hoping to talk through")
    .replace(/\bwhat is the clinical point of\b/gi, "what should I understand about")
    .replace(/\bwhat is the clinical point\b/gi, "what should I understand first")
    .replace(/\bget to the point\b/gi, "keep it focused")
    .replace(/\bskip the pleasantries\b/gi, "keep it focused")
    .replace(/\byou are not answering\b/gi, "that does not answer")
    .replace(/\byou'?re not answering\b/gi, "that does not answer")
    .replace(/\byou are staying too broad\b/gi, "that is still too broad")
    .replace(/\bi do not have patience for this\b/gi, "I do not have much time for this")
    .replace(/\bi don't have patience for this\b/gi, "I don't have much time for this")
    .replace(/\bnot interested\b/gi, "not ready to keep going")
    .replace(/\bthis is going nowhere\b/gi, "this is not getting specific enough");
}

function determineMaxSentences(
  turn: HcpTurnDirectiveSet,
  profile: HcpRuntimeProfile,
  hcpTurnCount = 0,
  liveRepAlignmentActive = false,
): number {
  if (hcpTurnCount === 0 && !liveRepAlignmentActive) {
    return Math.max(1, Math.min(2, turn.responseShape === "pushback" ? 1 : 2));
  }
  if (turn.responseShape === "compressed_probe" || turn.responseShape === "conditional_close") return 1;
  if (turn.responseShape === "pushback" || profile.brevity === "tight") return 1;
  return 2;
}

function clipToWordBudget(text = "", budget = 24): string {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  if (words.length <= budget) return normalizeText(text);
  return `${words.slice(0, budget).join(" ").replace(/[,:;]+$/, "")}.`;
}

function hasNaturalTimePressureDirective(text = ""): boolean {
  return /\b(keep it short|give me the short version|keep it quick|briefly|one quick point|one practical point|short version)\b/i.test(text);
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

  output = stripNarrationLeakage(output);
  if (!output) return "";

  // Remove exact stock phrases so validator cleanup does not leak canned trainer language.
  output = stripBannedStockPhrases(output);
  if (!output) return "";

  output = compressContractions(output);
  output = softenHostileTone(output);
  output = enforceSentenceBoundaries(output);
  output = repairCommaSplices(output);
  output = dedupeSentences(output);
  output = enforceSentenceCase(output);
  output = repairQuestionPunctuation(output);
  output = repairIncompleteOperationalAsks(output);

  const maxSentences = determineMaxSentences(turn, profile, hcpTurnCount, liveRepAlignmentActive);
  output = trimToSentences(output, maxSentences);
  output = clipToWordBudget(output, Math.max(12, Number(turn.targetWordBudget || 24)));

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

  output = stripBannedStockPhrases(output);
  return ensureTerminalPunctuation(output);
}
