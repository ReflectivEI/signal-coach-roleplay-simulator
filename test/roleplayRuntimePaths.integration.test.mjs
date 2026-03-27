import test from "node:test";
import assert from "node:assert/strict";
import fixtures from "./fixtures/roleplay-runtime-fixtures.json" with { type: "json" };

import { computeAlignment } from "../src/components/roleplay/alignmentEngine.jsx";
import {
  deriveInitialState,
  deriveInitialTemperature,
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

test("overall alignment score follows freeze-era aggregate math", () => {
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
  const expected = Math.max(1, Math.min(5, Math.round(metricAverage)));

  assert.equal(alignment.score, expected);
});
