import test from "node:test";
import assert from "node:assert/strict";

import {
  applyTransformSafetyHarness,
  buildReplayHarnessMetrics,
} from "../src/components/roleplay/transformSafetyHarness.js";

test("natural-flow: punctuation continuity blocks question loss", () => {
  const originalDialogue = "What is the first workflow step we can run this week?";
  const transformedDialogue = "The first workflow step is to pilot intake routing for one week.";

  const result = applyTransformSafetyHarness({
    originalDialogue,
    transformedDialogue,
    activeConcern: "workflow",
    scenarioKeywords: ["workflow", "pilot", "week"],
  });

  assert.equal(result.checks.questionContinuity, false);
  assert.equal(result.accepted, false);
  assert.equal(result.dialogue, originalDialogue);
});

test("natural-flow: sentence variety metric differentiates repetitive vs varied text", () => {
  const repetitive = buildReplayHarnessMetrics({
    transformedDialogue: "Workflow workflow workflow workflow workflow.",
    activeConcern: "workflow",
    scenarioKeywords: ["workflow"],
  });

  const varied = buildReplayHarnessMetrics({
    transformedDialogue: "Pilot one intake checklist this week, then review handoff delays with the nurse lead.",
    activeConcern: "workflow",
    scenarioKeywords: ["workflow", "pilot", "handoff"],
  });

  assert.ok(repetitive.repetitionRatio > varied.repetitionRatio);
});
