import { HcpRuntimeProfile } from "./hcpRuntimeProfiles";
import { HcpTurnDirectiveSet } from "./hcpTurnDirectives";

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

  return normalizeText(output);
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
      .replace(/\bwho owns the next practical step\b/gi, "who owns the next step");
  }

  if (domain === "cardiology") {
    output = output
      .replace(/\bwhat changes in routine care\b/gi, "what changes")
      .replace(/\bwhat changes before the patient leaves\b/gi, "what changes before discharge");
  }

  if (domain === "rare" && concernFamily === "screening") {
    output = output
      .replace(/\bwhat would actually identify the right patient\b/gi, "what would actually identify the right patient")
      .replace(/\bpractical workup relevance\b/gi, "practical workup value");
  }

  return normalizeText(output);
}

function applyShapeCompression(text: string, turn: HcpTurnDirectiveSet, profile: HcpRuntimeProfile): string {
  let output = normalizeText(text);
  const maxSentences =
    turn.responseShape === "compressed_probe" || turn.responseShape === "conditional_close"
      ? 1
      : turn.responseShape === "pushback" || profile.brevity === "tight"
        ? 1
        : 2;
  output = trimToSentences(output, maxSentences);

  const words = output.split(/\s+/).filter(Boolean);
  if (words.length > turn.targetWordBudget) {
    output = `${words.slice(0, turn.targetWordBudget).join(" ").replace(/[,:;]+$/, "")}.`;
  }

  return ensureTerminalPunctuation(output);
}

function applyLateStageNarrowing(text: string, turn: HcpTurnDirectiveSet): string {
  let output = text;

  if (turn.closeMode && !/next step|one step|one patient|one case|one action|open to|would you be open/i.test(output)) {
    if (turn.concernFamily === "evidence") {
      output = `${output.replace(/[.?!]+$/, "")} What single data point would change that?`;
    } else if (turn.concernFamily === "workflow" || turn.concernFamily === "access") {
      output = `${output.replace(/[.?!]+$/, "")} What first step would actually make this workable?`;
    }
  }

  if (turn.objectionMode && turn.repeatedMisses.includes("objection_navigation") && !/still|again|same issue|that part/i.test(output)) {
    output = `That still doesn't answer it. ${output}`;
  }

  return normalizeText(output);
}

export function applyHcpResponseSurface({
  hcpReply,
  scenario,
  turn,
  profile,
}: {
  hcpReply: string;
  scenario: any;
  turn: HcpTurnDirectiveSet;
  profile: HcpRuntimeProfile;
}): string {
  let output = normalizeText(hcpReply);
  if (!output) return "";

  output = applyGlobalSpokenRewrites(output);
  output = applyDomainCadence(output, turn.domain, turn.concernFamily);
  output = applyLateStageNarrowing(output, turn);
  output = applyShapeCompression(output, turn, profile);

  if (
    scenario?.interactionPressure?.includes("time_constrained") &&
    !/clock|time|quick|brief|tight|patient|schedule|doorway|room/i.test(output) &&
    turn.escalationStage !== "baseline"
  ) {
    output = trimToSentences(`${output.replace(/[.?!]+$/, "")} Keep it brief.`, 1);
  }

  return ensureTerminalPunctuation(output);
}
