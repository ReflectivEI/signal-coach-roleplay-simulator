import test from "node:test";
import assert from "node:assert/strict";
import fixtures from "./fixtures/roleplay-runtime-fixtures.json" with { type: "json" };

import { computeAlignment } from "../src/components/roleplay/alignmentEngine.jsx";
import {
  deriveInitialState,
  deriveInitialTemperature,
  evaluateHcpTerminationPolicy,
  transitionSeverity,
  transitionState,
  transitionTemperature,
} from "../src/components/roleplay/hcpSimulationEngine.jsx";

const EXPECTED_METRIC_KEYS = [
  "signal_awareness",
  "signal_interpretation",
  "value_connection",
  "customer_engagement",
  "objection_navigation",
  "conversation_management",
  "adaptive_response",
  "commitment_generation",
];

test("computeAlignment returns 8-capability rubric output", () => {
  const alignment = computeAlignment("neutral", "Thanks for your time—what matters most for your workflow today?");
  const metricKeys = Object.keys(alignment.metrics).sort();
  assert.deepEqual(metricKeys, [...EXPECTED_METRIC_KEYS].sort());
  assert.equal(typeof alignment.score, "number");
  assert.ok(alignment.score >= 1 && alignment.score <= 5);
});

test("runtime replay fixtures execute deterministically across scoring and transitions", () => {
  for (const fixture of fixtures) {
    const firstAlignment = computeAlignment(
      fixture.prevState,
      fixture.repMessage,
      null,
      fixture.prevTemp,
      fixture.prevHcpState,
    );
    const secondAlignment = computeAlignment(
      fixture.prevState,
      fixture.repMessage,
      null,
      fixture.prevTemp,
      fixture.prevHcpState,
    );

    assert.equal(firstAlignment.score, secondAlignment.score, `${fixture.name}: score should be deterministic`);
    assert.deepEqual(firstAlignment.metrics, secondAlignment.metrics, `${fixture.name}: metrics should be deterministic`);

    const nextStateA = transitionState(fixture.prevState, fixture.repMessage, fixture.prevTemp);
    const nextStateB = transitionState(fixture.prevState, fixture.repMessage, fixture.prevTemp);
    assert.equal(nextStateA, nextStateB, `${fixture.name}: next state should be deterministic`);

    const nextTempA = transitionTemperature(fixture.prevTemp, fixture.repMessage);
    const nextTempB = transitionTemperature(fixture.prevTemp, fixture.repMessage);
    assert.equal(nextTempA, nextTempB, `${fixture.name}: next temperature should be deterministic`);

    const nextSeverity = transitionSeverity(
      fixture.prevSeverity,
      firstAlignment,
      fixture.prevState,
      nextStateA,
    );
    assert.ok(nextSeverity >= 0 && nextSeverity <= 2, `${fixture.name}: severity should stay in [0,2]`);
  }
});

test("deriveInitialState/deriveInitialTemperature remain stable for same scenario text", () => {
  const scenario = {
    title: "Busy clinic with low staffing and heavy schedule pressure",
    description: "HCP says there is no time for long discussions right now.",
    details: "Workflow bottleneck and rushed appointments.",
  };

  const stateA = deriveInitialState(scenario);
  const stateB = deriveInitialState(scenario);
  assert.equal(stateA, stateB);

  const tempA = deriveInitialTemperature(stateA);
  const tempB = deriveInitialTemperature(stateB);
  assert.equal(tempA, tempB);
});

test("direct HCP metric/threshold question is penalized when rep answer is non-specific", () => {
  const vagueAnswer = computeAlignment(
    "time-pressured",
    "Side effect profile.",
    { hcpUtterance: "What's the specific viral load threshold that would indicate this treatment is effective and worth scaling?" },
    "neutral",
    "time-pressured",
  );

  const concreteAnswer = computeAlignment(
    "time-pressured",
    "Track viral load at week 4 and consider scaling if patients stay suppressed under 200 copies/mL without new tolerability issues.",
    { hcpUtterance: "What's the specific viral load threshold that would indicate this treatment is effective and worth scaling?" },
    "neutral",
    "time-pressured",
  );

  assert.ok(
    vagueAnswer.metrics.signal_interpretation.score < concreteAnswer.metrics.signal_interpretation.score,
    "non-specific reply should score lower on signal interpretation than a concrete answer"
  );
  assert.ok(
    vagueAnswer.metrics.conversation_management.score < concreteAnswer.metrics.conversation_management.score,
    "threshold question without numeric anchor should reduce conversation management score"
  );
});

test("overall alignment score stays mathematically aligned to the 8 metric scores", () => {
  const alignment = computeAlignment(
    "time-pressured",
    "Given your time pressure, one practical next step is a 4-week pilot with week-4 viral load check under 200 copies/mL and tolerability review.",
    { hcpUtterance: "Help me understand the most clinically relevant takeaway for my stable patients." },
    "neutral",
    "time-pressured",
  );

  const metricAverage = Object.values(alignment.metrics)
    .map((metric) => metric.score)
    .reduce((sum, score) => sum + score, 0) / EXPECTED_METRIC_KEYS.length;
  const expected = Math.max(1, Math.min(5, Math.round(metricAverage * 10) / 10));

  assert.equal(alignment.score, expected);
});

test("governance termination policy closes after repeated unanswered prompts with disrespect", () => {
  const policy = evaluateHcpTerminationPolicy({
    repMessage: "Again, you are not answering my question. Make up your mind.",
    repHistoryMessages: [
      "Treatment options have nothing to do with staff limitations.",
      "You are avoiding the topic.",
      "What staffing limitations?",
    ],
    activeConstraintTypes: ["workflow", "staffing", "capacity"],
    unresolvedConcernTurns: 4,
    concernFlowOutcome: "missed",
    decayTier: "disengaging",
    explicitNarrowingPrompted: true,
    isTimePressured: true,
  });

  assert.equal(policy.shouldTerminate, true);
  assert.ok(policy.reasonCodes.includes("repeated_unanswered_direct_question"));
  assert.ok(policy.reasonCodes.includes("repeated_disrespect_or_argumentative_tone"));
  assert.ok(policy.reasonCodes.includes("time_pressure_with_no_progress"));
});

test("governance policy sets boundary before termination when budget first exceeded", () => {
  const policy = evaluateHcpTerminationPolicy({
    repMessage: "I hear you, but I am still focused on efficacy outcomes.",
    repHistoryMessages: [
      "We should keep talking about trial endpoints.",
      "Let's revisit patient outcomes.",
    ],
    activeConstraintTypes: ["workflow"],
    unresolvedConcernTurns: 3,
    concernFlowOutcome: "overpivot",
    decayTier: "impatient",
    explicitNarrowingPrompted: true,
    isTimePressured: false,
  });

  assert.equal(policy.shouldTerminate, false);
  assert.equal(policy.shouldBoundarySet, true);
  assert.ok(policy.reasonCodes.includes("repeated_unanswered_direct_question"));
});

test("governance policy does not terminate solely for time pressure without hostility", () => {
  const policy = evaluateHcpTerminationPolicy({
    repMessage: "How about implementing this with reminders and standing orders in LTC.",
    repHistoryMessages: [
      "I can help improve outreach with SMS reminders.",
      "We can tailor this for high-risk adults.",
    ],
    activeConstraintTypes: ["workflow", "time"],
    unresolvedConcernTurns: 3,
    concernFlowOutcome: "missed",
    decayTier: "disengaging",
    explicitNarrowingPrompted: false,
    isTimePressured: true,
  });

  assert.equal(policy.shouldTerminate, false);
  assert.equal(policy.shouldBoundarySet, true);
  assert.ok(policy.reasonCodes.includes("time_pressure_with_no_progress"));
});
