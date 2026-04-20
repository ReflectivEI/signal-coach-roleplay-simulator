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
    .replace(/\s+\b(and|or|to|for|with|of|the|a|an|that|this|it|they|them|we|i)\.$/i, ".")
    .replace(/\s+\b(can you [^.?!]*?)\s+\byou\./i, " $1.")
    .replace(/\s+\b(what [^.?!]*?)\s+\bfor\./i, " $1?")
    .replace(/\s+\b(what [^.?!]*?)\s+\bto\./i, " $1?");

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
    return cleaned;
  }).join(" ");
}

function hasNaturalTimePressureDirective(text = ""): boolean {
  const value = normalizeText(text);
  return /\b(get to the point|short version|bottom line|one thing|only got a minute|only have a minute|few minutes|make this quick|keep this tight|brief version|quick version)\b/i.test(value);
}

function pickDeterministicTimeTail(seed = ""): string {
  const options = [
    "Give me the short version.",
    "Get to the point.",
    "Make it quick.",
  ];
  const key = normalizeText(seed);
  const score = Array.from(key).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return options[score % options.length];
}

function enforceSentenceBoundaries(text = ""): string {
  let output = normalizeText(text);
  if (!output) return "";

  output = output.replace(
    /\b(point|version|now|room|practice|patients|staff|workflow|today)\s+(Keep it brief|Keep this brief|Keep it tight|Give me the short version|Get to the point|Make it quick)\b/gi,
    "$1. $2"
  );
  output = output.replace(
    /\b(point|version|now|room|practice|patients|staff|workflow|today)\s+(What|How|Why|Who|When|Where|Can|Would|Should|Tell|Show|Give|Keep|Stay)\b/g,
    "$1. $2"
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
    .replace(/\bKeep it brief\b/gi, "Give me the short version")
    .replace(/\bKeep this brief\b/gi, "Give me the short version")
    .replace(/\bKeep it tight\b/gi, "Make it quick");

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

  if (turn.closeMode && turn.responseShape === "partial_agreement" && !/\bif you can|if that can|if this can|i could look at|i can look at|i’d look at|i'd look at|i'm open to\b/i.test(output)) {
    if (turn.concernFamily === "evidence") {
      output = `If you can show me what changes practice, I can look at it. ${output.replace(/[.?!]+$/, "")}`;
    } else if (turn.concernFamily === "access") {
      output = `If there's a real way through that access step, I can look at it. ${output.replace(/[.?!]+$/, "")}`;
    } else if (turn.concernFamily === "workflow") {
      output = `If this does not add another staff step, I can look at it. ${output.replace(/[.?!]+$/, "")}`;
    } else if (turn.concernFamily === "hesitation") {
      output = `If you can make the next step concrete enough to actually do, I can look at it. ${output.replace(/[.?!]+$/, "")}`;
    } else {
      output = `If you can keep this practical, I can stay with it. ${output.replace(/[.?!]+$/, "")}`;
    }
  }

  if (turn.closeMode && turn.escalationStage !== "disengaging" && !/\bif\b.*\bcan\b|\bif\b.*\bshow\b|\bif\b.*\bkeep\b|\bif\b.*\bworkable\b/i.test(output)) {
    if (turn.concernFamily === "evidence") {
      output = `If you can make the proof point concrete, I can stay with it. ${output.replace(/[.?!]+$/, "")}`;
    } else if (turn.concernFamily === "access") {
      output = `If there's a real path through that access step, I can stay with it. ${output.replace(/[.?!]+$/, "")}`;
    } else if (turn.concernFamily === "workflow") {
      output = `If this stays workable for staff, I can stay with it. ${output.replace(/[.?!]+$/, "")}`;
    } else if (turn.concernFamily === "hesitation") {
      output = `If this gets concrete enough to act on, I can stay with it. ${output.replace(/[.?!]+$/, "")}`;
    }
  }

  if (turn.closeMode && !/next step|one step|one patient|one case|one action|open to|would you be open/i.test(output)) {
    if (turn.concernFamily === "evidence") {
      output = `${output.replace(/[.?!]+$/, "")} What single data point would change that?`;
    } else if (turn.concernFamily === "workflow" || turn.concernFamily === "access") {
      output = `${output.replace(/[.?!]+$/, "")} What first step would actually make this workable?`;
    } else if (turn.concernFamily === "hesitation") {
      output = `${output.replace(/[.?!]+$/, "")} What one next step would make this real enough to actually do?`;
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

function applyContinuityPressure(text: string, turn: HcpTurnDirectiveSet, profile: HcpRuntimeProfile): string {
  let output = normalizeText(text);

  if (turn.escalationStage === "high_pressure" || turn.escalationStage === "disengaging") {
    output = output
      .replace(/\bLet me step back\b/gi, "No, stay with it")
      .replace(/\bBefore we get ahead of ourselves\b/gi, "Before we go further")
      .replace(/\bI'm trying to understand\b/gi, "I'm looking at")
      .replace(/\bI'm still trying to understand\b/gi, "I'm still looking at");
  }

  if (profile.directness === "high" && turn.concernFamily === "time") {
    output = output
      .replace(/\bWhat would you want me to focus on\b/gi, "What do you want me to focus on")
      .replace(/\bCan you tell me\b/gi, "Tell me");
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
  output = applyContinuityPressure(output, turn, profile);
  output = applyShapeCompression(output, turn, profile);

  if (
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
      repairDanglingTail(
        enforceSentenceCase(
          enforceSentenceBoundaries(output)
        )
      )
    )
  );
}
