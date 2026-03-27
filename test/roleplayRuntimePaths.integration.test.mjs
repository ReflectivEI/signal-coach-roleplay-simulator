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
import {
  classifyScenarioFamily,
  getScenarioPolicyOverrides,
} from "../src/components/roleplay/scenarioPolicyProfiles.js";

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

test("family policy fixtures keep deterministic scoring and stronger replies outperform weak replies", () => {
  const familyFixtures = [
    {
      family: "hiv_prep",
      scenarioTitle: "HIV Prevention Gap : High-Risk Population",
      scenarioDescription: "Urban clinic managing PrEP adherence and payer barriers.",
      hcpUtterance: "What specific evidence should change my current PrEP approach?",
      weakReply: "To share data.",
      strongReply: "In high-risk patients, week-12 retention improved by 18%, and we can pilot one eligibility checklist this week.",
    },
    {
      family: "oncology_access",
      scenarioTitle: "Biomarker Access Delay in Metastatic Care",
      scenarioDescription: "Tumor board debating pathway fit and reimbursement denials.",
      hcpUtterance: "What practical change improves biomarker turnaround without delaying treatment starts?",
      weakReply: "We can follow up.",
      strongReply: "Use same-day reflex ordering; centers cut biomarker turnaround by 4 days and reduced treatment-start delays.",
    },
    {
      family: "cardiometabolic",
      scenarioTitle: "Cardiometabolic Adherence Bottleneck",
      scenarioDescription: "Formulary restrictions and refill gaps in diabetes clinic.",
      hcpUtterance: "How do we reduce refill drop-off in the next month?",
      weakReply: "Schedule time.",
      strongReply: "Start a refill-outreach queue: one nurse call at day 21 reduced 30-day refill gaps by 12% in a similar clinic.",
    },
    {
      family: "general_access",
      scenarioTitle: "Workflow Integration Pilot",
      scenarioDescription: "Staff burden and operational bottlenecks in a general clinic.",
      hcpUtterance: "What first workflow step can we test this week?",
      weakReply: "We should discuss.",
      strongReply: "Pilot a front-desk routing checklist for one week and track same-day completion rate.",
    },
  ];

  for (const fixture of familyFixtures) {
    const detected = classifyScenarioFamily(`${fixture.scenarioTitle} ${fixture.scenarioDescription}`);
    assert.equal(detected, fixture.family, `${fixture.family}: should classify into expected family`);

    const overrides = getScenarioPolicyOverrides({
      scenarioFamily: detected,
      scenarioTitle: fixture.scenarioTitle,
      scenarioDescription: fixture.scenarioDescription,
    });
    assert.ok(overrides.loopBreakerBudget >= 1, `${fixture.family}: loop breaker budget should exist`);
    assert.ok(overrides.minMeaningfulRepTokens >= 2, `${fixture.family}: minimum token threshold should exist`);

    const weak = computeAlignment(
      "time-pressured",
      fixture.weakReply,
      { hcpUtterance: fixture.hcpUtterance },
      "neutral",
      "time-pressured",
    );
    const strong = computeAlignment(
      "time-pressured",
      fixture.strongReply,
      { hcpUtterance: fixture.hcpUtterance },
      "neutral",
      "time-pressured",
    );

    assert.ok(
      strong.score >= weak.score,
      `${fixture.family}: stronger response should not score lower than weak response`,
    );
  }
});
