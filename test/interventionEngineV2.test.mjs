import test from "node:test";
import assert from "node:assert/strict";

import {
  INTERVENTION_DECISIONS,
  createInitialInterventionSessionState,
  detectEvidenceCheckpoint,
  decideInterventionAction,
  updateInterventionSessionState,
} from "../src/components/roleplay/interventionEngineV2.js";

test("evidence checkpoint detector captures generic evidence and feasibility prompts", () => {
  const checkpoint = detectEvidenceCheckpoint(
    "What proof point or metric is clinically meaningful, and can this fit our workflow next week?",
  );

  assert.equal(checkpoint.triggered, true);
  assert.ok(checkpoint.matches.includes("proof_point"));
  assert.ok(checkpoint.matches.includes("metric"));
  assert.ok(checkpoint.matches.includes("clinical_support"));
  assert.ok(checkpoint.matches.includes("workflow_feasibility"));
});

test("intervention state accumulates repeated misses and low-alignment events", () => {
  let state = createInitialInterventionSessionState();

  state = updateInterventionSessionState(state, {
    turnNumber: 2,
    alignmentScore: 2,
    concernFlowOutcome: "missed",
    hcpPrompt: "Give me one practical next step.",
    hasBlockingConstraints: true,
    needsConstraintReanchor: true,
  });

  assert.equal(state.repeatedMissedCues, 1);
  assert.equal(state.repeatedLowAlignmentEvents, 1);
  assert.equal(state.needsConstraintReanchor, true);

  state = updateInterventionSessionState(state, {
    turnNumber: 3,
    alignmentScore: 2.2,
    concernFlowOutcome: "overpivot",
    hcpPrompt: "I still need a concrete next step with supporting evidence.",
    hasBlockingConstraints: true,
    needsConstraintReanchor: true,
  });

  assert.equal(state.repeatedMissedCues, 2);
  assert.equal(state.repeatedLowAlignmentEvents, 2);
  assert.equal(state.lastDecision, INTERVENTION_DECISIONS.NONE);
  state = updateInterventionSessionState(state, {
    turnNumber: 4,
    alignmentScore: 2.1,
    concernFlowOutcome: "missed",
    hcpPrompt: "What specific proof point supports this in real workflow?",
    hasBlockingConstraints: true,
    needsConstraintReanchor: true,
  });
  assert.equal(state.lastDecision, INTERVENTION_DECISIONS.REQUIRE_REANCHOR_TO_CONSTRAINT);
  assert.ok(state.evidenceCheckpoints.length >= 1);
});

test("intervention decision outputs stay in supported enum and respect cooldown", () => {
  assert.equal(
    decideInterventionAction({ unresolvedConstraintReanchor: true }),
    INTERVENTION_DECISIONS.REQUIRE_REANCHOR_TO_CONSTRAINT,
  );
  assert.equal(
    decideInterventionAction({ evidenceCheckpointTriggered: true }),
    INTERVENTION_DECISIONS.REQUIRE_EVIDENCE_ANCHOR,
  );
  assert.equal(
    decideInterventionAction({ directQuestionPending: true }),
    INTERVENTION_DECISIONS.REQUIRE_DIRECT_ANSWER,
  );
  assert.equal(
    decideInterventionAction({ repeatedMissedCues: 2 }),
    INTERVENTION_DECISIONS.COACHING_ONLY,
  );
  assert.equal(
    decideInterventionAction({ repeatedMissedCues: 3, cooldownTurnsRemaining: 1 }),
    INTERVENTION_DECISIONS.NONE,
  );
});
