import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  detectInternalNarrationLeak,
  reviseCueForObservableBehavior,
  selectStateAlignedHcpCue,
} from "../src/lib/roleplay/hcpCueStateAlignment.js";

const cueGeneratorSource = fs.readFileSync(
  new URL("../src/lib/hcpCueGenerator.ts", import.meta.url),
  "utf8",
);

const INTERNAL_OUTPUT_PATTERNS = [
  /attention tightening/i,
  /waiting for the proof point/i,
  /watching for/i,
  /signaling that/i,
  /decision-relevant point/i,
  /current ask/i,
  /less patient with another setup pass/i,
  /not moving the conversation/i,
];

test("global cue generator does not use specialty-specific cue pools", () => {
  assert.match(cueGeneratorSource, /const DOMAIN_CUE_POOLS:[\s\S]*=\s*\{\};/);
  assert.doesNotMatch(cueGeneratorSource, /oncology:\s*\{/);
  assert.doesNotMatch(cueGeneratorSource, /cardiology:\s*\{/);
  assert.doesNotMatch(cueGeneratorSource, /hiv:\s*\{/);
});

test("global cue source has no specialty overrides or internal narration output strings", () => {
  const outputSource = cueGeneratorSource
    .replace(/const BANNED_CUE_TERMS = \[[\s\S]*?\];/, "")
    .replace(/const DOMAIN_CUE_POOLS:[\s\S]*?= \{\};/, "");

  for (const pattern of INTERNAL_OUTPUT_PATTERNS) {
    assert.doesNotMatch(outputSource, pattern);
  }
});

test("state-aligned cue selector repairs internal narration into observable behavior", () => {
  const aligned = selectStateAlignedHcpCue({
    existingCueText: "The HCP keeps attention on the access barrier, waiting for a practical path forward.",
    preferStateDerived: false,
    activeHcpAsk: "What changes in the access step?",
    concernFamily: "access",
    hcpState: "engaged",
    decayTier: "constrained",
    dialogueText: "What changes in the access step?",
    scenarioId: "global-observable-repair",
    turnNumber: 3,
  });

  assert.equal(detectInternalNarrationLeak(aligned.cueText), false);
  for (const pattern of INTERNAL_OUTPUT_PATTERNS) {
    assert.doesNotMatch(aligned.cueText, pattern);
  }
  assert.match(aligned.cueText, /HCP/);
});

test("cue repair separates observable behavior from interpretation text", () => {
  const resolved = reviseCueForObservableBehavior({
    cueText: "The HCP stays with the evidence thread, listening for the decision-relevant point.",
    cueCategory: "focused_narrowing",
    concernFamily: "evidence",
  });

  for (const pattern of INTERNAL_OUTPUT_PATTERNS) {
    assert.doesNotMatch(resolved, pattern);
  }
  assert.match(resolved, /HCP/);
});
