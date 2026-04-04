import test from "node:test";
import assert from "node:assert/strict";

import {
  detectEvidenceArtifacts,
  satisfiesEvidenceDemandBinding,
} from "../src/components/roleplay/repDemandBinding.js";
import {
  DEMAND_TYPES,
  createInitialInterventionSessionState,
  updateInterventionSessionState,
} from "../src/components/roleplay/interventionEngineV2.js";

test("evidence demand requires concrete evidence artifacts instead of conceptual framing", () => {
  let state = createInitialInterventionSessionState();

  state = updateInterventionSessionState(state, {
    turnNumber: 1,
    hcpPrompt: "What evidence supports this recommendation in our setting?",
    repMessage: "Conceptually this pathway improves care flow and should help outcomes overall.",
    activeConcern: "evidence",
  });

  assert.equal(state.activeDemand.type, DEMAND_TYPES.EVIDENCE_REQUEST);
  assert.equal(state.activeDemand.isActive, true);

  state = updateInterventionSessionState(state, {
    turnNumber: 2,
    hcpPrompt: "What evidence supports this recommendation in our setting?",
    repMessage: "In the ATLAS trial, suppression improved by 14% versus baseline, and this applies in your clinic workflow this week.",
    activeConcern: "evidence",
  });

  assert.equal(state.activeDemand.isActive, false);
});

test("non-evidence operational demand behavior remains unchanged", () => {
  let state = createInitialInterventionSessionState();

  state = updateInterventionSessionState(state, {
    turnNumber: 3,
    hcpPrompt: "How does this fit our staffing and workflow constraints?",
    repMessage: "Use one MA to start intake, hand off to RN in the same workflow block, and keep staffing load stable this week.",
    activeConcern: "workflow",
    hasBlockingConstraints: true,
    needsConstraintReanchor: true,
  });

  assert.equal(state.activeDemand.type, DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED);
  assert.equal(state.activeDemand.isActive, false);
});

test("evidence artifact detection is shared/global and not scenario-specific", () => {
  const artifacts = detectEvidenceArtifacts(
    "CDC guidance plus a 12% reduction versus baseline supports this approach in your clinic.",
  );

  assert.equal(artifacts.guidelineReference, true);
  assert.equal(artifacts.numericOutcome, true);
  assert.equal(artifacts.comparativeClaim, true);
  assert.equal(artifacts.hasConcreteEvidenceArtifact, true);

  assert.equal(
    satisfiesEvidenceDemandBinding({
      repMessage: "CDC guidance plus a 12% reduction versus baseline supports this approach in your clinic.",
      hcpPrompt: "What evidence supports this in our clinic?",
    }),
    true,
  );
});
