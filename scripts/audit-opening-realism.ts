import { ALL_SCENARIOS } from "../src/lib/scenarioCatalog.js";
import { deriveHcpRuntimeProfile } from "../src/lib/hcpRuntimeProfiles";
import { deriveHcpTurnDirectives } from "../src/lib/hcpTurnDirectives";
import {
  buildGlobalFirstTurnCue,
  enforceSourceBackedRealismSurface,
} from "../src/lib/hcpRealismBackbone";

function words(text: string): number {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function findFlags(line: string): string[] {
  const flags: string[] = [];
  const lower = line.toLowerCase();
  if (/\byou've got a few minutes\b/.test(lower)) flags.push("second-person time phrasing");
  if (/\bstaff (setup|support) a bigger practice has\b/.test(lower)) flags.push("awkward staff phrasing");
  if (/\bworth stopping for\b/.test(lower)) flags.push("slightly synthetic access ask");
  if (/\bother people in my area\b/.test(lower)) flags.push("could be more spoken");
  if (words(line) > 55) flags.push("long opener");
  return flags;
}

let flaggedCount = 0;

for (const scenario of ALL_SCENARIOS) {
  const profile = deriveHcpRuntimeProfile({
    scenario,
    behaviorState: scenario.startingBehaviorState,
  });
  const turn = deriveHcpTurnDirectives({
    scenario,
    allPriorSignals: [],
    currentBehaviorState: scenario.startingBehaviorState,
    currentJourneyState: scenario.journeyStage,
    predictionState: scenario.startingBehaviorState,
    turnCount: 0,
  });

  const cue = buildGlobalFirstTurnCue({
    scenario,
    concernFamily: turn.concernFamily,
    profile,
  });

  const line = enforceSourceBackedRealismSurface({
    hcpReply: "placeholder",
    scenario,
    turn,
    profile,
    hcpTurnCount: 0,
  });

  const flags = findFlags(line);

  console.log(JSON.stringify({
    title: scenario.title,
    family: turn.concernFamily,
    cue,
    line,
    flags,
  }));

  if (flags.length) flaggedCount += 1;
}

if (flaggedCount > 0) {
  process.exitCode = 1;
}
