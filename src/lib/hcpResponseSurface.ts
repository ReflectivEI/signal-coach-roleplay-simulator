import { HcpRuntimeProfile } from "./hcpRuntimeProfiles";
import { HcpTurnDirectiveSet } from "./hcpTurnDirectives";
import { enforceSourceBackedRealismSurface } from "./hcpRealismBackbone";

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
    .replace(/,\s+(What|How|Why|Who|When|Where|Can|Could|Would|Should|Do|Does|Did|Is|Are)\b/g, ". $1");
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
  /\bi'?m not convinced yet\b/i,
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

  output = enforceSourceBackedRealismSurface({
    hcpReply: output,
    scenario,
    turn,
    profile,
    hcpTurnCount,
  });

  // Remove exact stock phrases so validator cleanup does not leak canned trainer language.
  output = stripBannedStockPhrases(output);
  if (!output) return "";

  output = compressContractions(output);
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
    output = trimToSentences(output, 1);
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
