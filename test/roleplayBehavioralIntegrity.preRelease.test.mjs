import test from "node:test";
import assert from "node:assert/strict";

import { computeAlignment } from "../src/components/roleplay/alignmentEngine.jsx";
import {
  DEMAND_TYPES,
  buildDemandHoldDirective,
  createInitialInterventionSessionState,
  detectEvasiveRepResponse,
  updateInterventionSessionState,
} from "../src/components/roleplay/interventionEngineV2.js";
import {
  applyMetricApplicabilityGating,
  enforceFeedbackEvidenceRules,
  enforceProhibitedStateTransition,
  normalizeScenarioRuntimeContract,
} from "../src/lib/scenarioNormalization.js";

function runUnresolvedDemandSequence({ hcpPrompt, repMessage, turns = 4, activeConcern = "workflow" }) {
  let state = createInitialInterventionSessionState();
  const stages = [];
  for (let turn = 1; turn <= turns; turn += 1) {
    state = updateInterventionSessionState(state, {
      turnNumber: turn,
      hcpPrompt,
      repMessage,
      activeConcern,
      concernFlowOutcome: "aligned",
    });
    const directive = buildDemandHoldDirective({
      demandType: state.activeDemand.type,
      unresolvedTurns: state.activeDemand.unresolvedTurns,
      activeConcern,
      seed: `pre-release:${turn}`,
    });
    stages.push({ unresolvedTurns: state.activeDemand.unresolvedTurns, stage: directive.stage, directive });
  }
  return { state, stages };
}

test("Demand-Hold integrity: evidence/applicability/operational unresolved responses escalate deterministically to stage 4", () => {
  const cases = [
    { prompt: "What evidence supports this recommendation?", concern: "evidence" },
    { prompt: "How does this apply in our clinic setting?", concern: "workflow" },
    { prompt: "How does this fit our staffing and workflow constraints?", concern: "workflow" },
  ];

  cases.forEach(({ prompt, concern }) => {
    const run = runUnresolvedDemandSequence({
      hcpPrompt: prompt,
      repMessage: "This is generally important and we can discuss details later.",
      activeConcern: concern,
    });
    assert.equal(run.state.activeDemand.isActive, true);
    assert.deepEqual(run.stages.map((s) => s.stage), [1, 2, 3, 4]);
    assert.equal(run.stages[3].directive.disengagementTrajectory, true);
  });
});

test("Drift resistance: topic switching / partial redirect / verbose irrelevant reply remain unresolved", () => {
  const evasive = detectEvasiveRepResponse({
    hcpPrompt: "What evidence supports this?",
    repMessage: "Broadly this matters strategically. Anyway, separately, the big picture is growth and we'll circle back.",
  });
  assert.equal(evasive.evasive, true);

  const run = runUnresolvedDemandSequence({
    hcpPrompt: "What evidence supports this?",
    repMessage: "I hear your concern, and overall this is valuable in many settings without getting into specifics.",
    activeConcern: "evidence",
  });
  assert.equal(run.state.activeDemand.type, DEMAND_TYPES.EVIDENCE_REQUEST);
  assert.equal(run.state.activeDemand.isActive, true);
  assert.equal(run.stages[3].directive.disengagementTrajectory, true);
});

test("Transition enforcement blocks illegal state changes with deterministic fallback", () => {
  const contract = normalizeScenarioRuntimeContract({
    prohibitedTransitions: [
      { from: "resistant", to: "receptive", reason: "missing required trigger" },
      { from: "time-pressured", to: "open", reason: "time constraint not acknowledged" },
    ],
  });

  const blockedA = enforceProhibitedStateTransition({
    fromState: "resistant",
    proposedState: "receptive",
    runtimeContract: contract,
  });
  const blockedB = enforceProhibitedStateTransition({
    fromState: "time-pressured",
    proposedState: "open",
    runtimeContract: contract,
  });
  assert.equal(blockedA.blocked, true);
  assert.equal(blockedA.nextState, "resistant");
  assert.equal(blockedB.blocked, true);
  assert.equal(blockedB.nextState, "time-pressured");
});

test("Applicability gating: objection/commitment metrics do not activate when triggers are absent", () => {
  const alignment = computeAlignment("neutral", "Here is a general overview.", {
    hcpUtterance: "Can you walk me through this?",
    cueText: "HCP remains neutral.",
  });
  const contract = normalizeScenarioRuntimeContract({
    metricApplicabilityMap: {
      objection_navigation: "conditional_on_objection",
      commitment_generation: "conditional_on_commitment_attempt",
    },
  });
  const gated = applyMetricApplicabilityGating(alignment, contract, {
    hcpUtterance: "Can you walk me through this?",
    repMessage: "Here is a general overview.",
  });

  assert.equal(gated.metrics.objection_navigation.gatedByApplicability, true);
  assert.equal(gated.metrics.commitment_generation.gatedByApplicability, true);
  assert.equal(gated.metrics.objection_navigation.score, 3);
  assert.equal(gated.metrics.commitment_generation.score, 3);
});

test("Feedback integrity: enforced feedback excludes inferred intent/emotion/personality labels", () => {
  const contract = normalizeScenarioRuntimeContract({
    feedbackContract: {
      whatFeedbackCanReference: ["explicit_hcp_statement", "rep_language_pattern"],
      whatFeedbackCannotInfer: ["inferred_intent", "inferred_emotion_without_signal", "personality_labels"],
    },
  });
  const rawFeedback = "You intended to dodge the question, and the HCP felt frustrated. You are pushy.";
  const cleaned = enforceFeedbackEvidenceRules(rawFeedback, contract);
  assert.ok(!/intended to dodge/i.test(cleaned));
  assert.ok(!/hcp felt frustrated/i.test(cleaned));
  assert.ok(!/you are pushy/i.test(cleaned));
});

test("Determinism: identical input sequence yields identical demand stages and directives across 3 runs", () => {
  const run = () => runUnresolvedDemandSequence({
    hcpPrompt: "How does this apply in our clinic setting?",
    repMessage: "This is broadly useful and we can discuss specifics later.",
    activeConcern: "workflow",
  }).stages.map((s) => ({ stage: s.stage, line: s.directive.line }));

  const one = run();
  const two = run();
  const three = run();

  assert.deepEqual(one, two);
  assert.deepEqual(two, three);
});

test("Response variety / anti-loop: repeated unresolved evidence demand does not overuse one hold sentence", () => {
  const run = runUnresolvedDemandSequence({
    hcpPrompt: "What evidence supports this recommendation?",
    repMessage: "This is useful generally and we can revisit details later.",
    activeConcern: "evidence",
    turns: 6,
  });
  const lines = run.stages.map((s) => s.directive.line);
  const uniqueCount = new Set(lines).size;
  assert.ok(uniqueCount >= 4);
});

test("Escalation stages produce distinct hold-language bands", () => {
  const run = runUnresolvedDemandSequence({
    hcpPrompt: "How does this apply in our clinic setting?",
    repMessage: "Broadly helpful across many settings.",
    activeConcern: "workflow",
    turns: 4,
  });
  assert.match(run.stages[0].directive.line.toLowerCase(), /still need|give one concrete|before we move on|stays general/);
  assert.match(run.stages[1].directive.line.toLowerCase(), /narrow|specific|context-specific|did not resolve/);
  assert.match(run.stages[2].directive.line.toLowerCase(), /final|direct applicability|limitation/);
  assert.match(run.stages[3].directive.line.toLowerCase(), /hard to continue|do not see value|ready to end/);
});

test("Applicability/evidence hold lines stay semantically correct while varied", () => {
  const evidence = runUnresolvedDemandSequence({
    hcpPrompt: "What evidence supports this recommendation?",
    repMessage: "General value applies broadly.",
    activeConcern: "evidence",
    turns: 5,
  }).stages.map((s) => s.directive.line.toLowerCase());
  const applicability = runUnresolvedDemandSequence({
    hcpPrompt: "How does this apply in our clinic setting?",
    repMessage: "This should be relevant broadly.",
    activeConcern: "workflow",
    turns: 5,
  }).stages.map((s) => s.directive.line.toLowerCase());

  assert.ok(evidence.every((line) => /evidence|data point|proof/.test(line)));
  assert.ok(applicability.every((line) => /apply|applicability|setting|clinic|example/.test(line)));
  assert.ok(new Set(evidence).size > 1);
  assert.ok(new Set(applicability).size > 1);
});
