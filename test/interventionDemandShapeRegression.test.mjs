import test from "node:test";
import assert from "node:assert/strict";

import {
  DEMAND_TYPES,
  createInitialInterventionSessionState,
  updateInterventionSessionState,
} from "../src/components/roleplay/interventionEngineV2.js";

const DEMAND_SHAPE_FIXTURES = [
  {
    name: "broad_workflow_to_narrowed_next_step",
    turn1: {
      hcpPrompt: "How does this fit into clinic workflow overall?",
      repMessage: "This is generally useful across many settings and should help your team.",
      activeConcern: "workflow",
      hasBlockingConstraints: true,
      needsConstraintReanchor: true,
    },
    turn2: {
      hcpPrompt: "What is one practical next step we can run this week?",
      repMessage: "This is generally useful across many settings and should help your team.",
      activeConcern: "workflow",
      hasBlockingConstraints: true,
      needsConstraintReanchor: true,
    },
    expectedDemand: DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED,
  },
  {
    name: "evidence_to_setting_applicability",
    turn1: {
      hcpPrompt: "What evidence supports this recommendation?",
      repMessage: "The evidence base is broad and generally supportive.",
      activeConcern: "evidence",
    },
    turn2: {
      hcpPrompt: "How does that evidence apply in our clinic setting?",
      repMessage: "The evidence base is broad and generally supportive.",
      activeConcern: "workflow",
    },
    expectedDemand: DEMAND_TYPES.EVIDENCE_REQUEST,
  },
  {
    name: "operational_burden_to_realistic_this_week",
    turn1: {
      hcpPrompt: "We are short-staffed. How does this avoid operational burden?",
      repMessage: "In general, this should streamline care over time.",
      activeConcern: "workflow",
      hasBlockingConstraints: true,
      needsConstraintReanchor: true,
    },
    turn2: {
      hcpPrompt: "Given staffing limits, what is one realistic step this week?",
      repMessage: "In general, this should streamline care over time.",
      activeConcern: "workflow",
      hasBlockingConstraints: true,
      needsConstraintReanchor: true,
    },
    expectedDemand: DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED,
  },
  {
    name: "access_friction_to_owner_timeline",
    turn1: {
      hcpPrompt: "Prior auth and coverage delays are the issue. What do we do?",
      repMessage: "Coverage can be complex, but this is broadly valuable.",
      activeConcern: "access",
      hasBlockingConstraints: true,
      needsConstraintReanchor: true,
    },
    turn2: {
      hcpPrompt: "Who owns the first action and what is the timeline?",
      repMessage: "Coverage can be complex, but this is broadly valuable.",
      activeConcern: "access",
      hasBlockingConstraints: true,
      needsConstraintReanchor: true,
    },
    expectedDemand: DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED,
  },
  {
    name: "time_pressure_to_concise_clinic_relevant",
    turn1: {
      hcpPrompt: "I only have a minute. Keep this concise.",
      repMessage: "This is an important strategic topic with broad implications in many systems over time.",
      activeConcern: "time",
    },
    turn2: {
      hcpPrompt: "Give me one concise, clinic-relevant step right now.",
      repMessage: "This is an important strategic topic with broad implications in many systems over time.",
      activeConcern: "time",
    },
    expectedDemand: DEMAND_TYPES.APPLICABILITY_REQUEST,
  },
];

test("demand-shape matrix: reused broad REP replies remain unresolved across narrowed asks", () => {
  for (const fixture of DEMAND_SHAPE_FIXTURES) {
    let state = createInitialInterventionSessionState();
    state = updateInterventionSessionState(state, {
      turnNumber: 1,
      ...fixture.turn1,
    });

    state = updateInterventionSessionState(state, {
      turnNumber: 2,
      ...fixture.turn2,
    });

    assert.equal(
      state.activeDemand.type,
      fixture.expectedDemand,
      `${fixture.name}: demand type should match expected narrowed demand family`,
    );
    assert.equal(
      state.activeDemand.isActive,
      true,
      `${fixture.name}: narrowed ask must remain active when REP reuses broad answer`,
    );
    assert.equal(
      state.activeDemand.unresolvedTurns >= 1,
      true,
      `${fixture.name}: unresolved turn count should progress`,
    );
  }
});
