import test from "node:test";
import assert from "node:assert/strict";

import fixtures from "./fixtures/roleplay-regression-baseline-fixtures.json" with { type: "json" };

import { computeAlignment } from "../src/components/roleplay/alignmentEngine.jsx";
import {
  transitionState,
  transitionTemperature,
  transitionSeverity,
  selectCue,
} from "../src/components/roleplay/hcpSimulationEngine.jsx";
import {
  selectLateTurnConstraintResponseMode,
  buildLateTurnConstraintResponse,
} from "../src/components/roleplay/operationalConstraintGuardrails.js";
import {
  computeSessionOverallScoreFromTurns,
  shouldIncludeMetricScore,
} from "../src/components/roleplay/sessionScoreAggregation.js";

const CAPABILITY_IDS = [
  "signal_awareness",
  "signal_interpretation",
  "value_connection",
  "customer_engagement",
  "objection_navigation",
  "conversation_management",
  "adaptive_response",
  "commitment_generation",
];

function buildFinalFeedbackSnapshot(turns = []) {
  const capabilityBreakdown = Object.fromEntries(
    CAPABILITY_IDS.map((capabilityId) => {
      const scores = turns
        .map((turn) => turn?.alignment?.metrics?.[capabilityId])
        .filter((metric) => shouldIncludeMetricScore(metric))
        .map((metric) => metric.score);

      if (scores.length === 0) return [capabilityId, null];
      const avg = scores.reduce((sum, value) => sum + value, 0) / scores.length;
      return [capabilityId, Math.round(avg * 10) / 10];
    }),
  );

  const observations = [];
  const coaching = [];
  turns.forEach((turn) => {
    const positives = Array.isArray(turn?.alignment?.positives) ? turn.alignment.positives : [];
    const misalignments = Array.isArray(turn?.alignment?.misalignments) ? turn.alignment.misalignments : [];

    positives.forEach((p) => observations.push(`Observed: ${p}`));
    misalignments.forEach((m) => {
      observations.push(`Observed gap: ${m}`);
      coaching.push(`Coach on behavior: ${m}`);
    });
  });

  const uniqueObservations = [...new Set(observations)].slice(0, 8);
  const uniqueCoaching = [...new Set(coaching)].slice(0, 6);

  return {
    capabilityBreakdown,
    behavioralObservations: uniqueObservations,
    coachingInsights: uniqueCoaching,
  };
}

test("deterministic baseline fixtures lock 3 representative roleplay scenarios", () => {
  for (const scenario of fixtures.scenarios) {
    let state = scenario.initial.prevState;
    let temp = scenario.initial.prevTemp;
    let severity = scenario.initial.prevSeverity;
    let hcpState = scenario.initial.prevHcpState;

    const turns = [];

    scenario.repResponses.forEach((repResponse, index) => {
      const alignment = computeAlignment(
        state,
        repResponse,
        { hcpUtterance: scenario.hcpUtterance },
        temp,
        hcpState,
      );

      const nextState = transitionState(state, repResponse, temp);
      const nextTemp = transitionTemperature(temp, repResponse);
      const nextSeverity = transitionSeverity(severity, alignment, state, nextState);
      const cue = selectCue(
        scenario.scenarioId,
        index + 1,
        nextState,
        nextSeverity,
        { temperature: nextTemp, history: [] },
      );

      assert.equal(nextState, scenario.expected.nextStates[index], `${scenario.scenarioId}: state drift at turn ${index + 1}`);
      assert.equal(nextTemp, scenario.expected.nextTemperatures[index], `${scenario.scenarioId}: temp drift at turn ${index + 1}`);
      assert.equal(nextSeverity, scenario.expected.nextSeverities[index], `${scenario.scenarioId}: severity drift at turn ${index + 1}`);
      assert.equal(alignment.score, scenario.expected.alignmentScores[index], `${scenario.scenarioId}: alignment score drift at turn ${index + 1}`);
      assert.match(cue.cue, new RegExp(scenario.expected.cueSnippets[index], "i"), `${scenario.scenarioId}: cue drift at turn ${index + 1}`);

      const evidenceTags = [];
      Object.entries(alignment.metrics).forEach(([metricId, metric]) => {
        const positives = Array.isArray(metric?.positives) ? metric.positives : [];
        const misalignments = Array.isArray(metric?.misalignments) ? metric.misalignments : [];
        if (positives.length > 0 || misalignments.length > 0) {
          evidenceTags.push(metricId);
        }
      });

      turns.push({
        alignment,
        cue,
        nextState,
        nextTemp,
        nextSeverity,
        activeConstraint: scenario.expected.activeConstraintEvolution[index],
        activeRequirement: scenario.expected.activeRequirementEvolution[index],
        evidenceTags,
      });

      state = nextState;
      temp = nextTemp;
      severity = nextSeverity;
      hcpState = nextState;
    });

    // Late-turn baseline progression: restate_once -> boundary -> close.
    const modeA = selectLateTurnConstraintResponseMode({
      hasActiveConstraint: true,
      hasActiveRequirement: true,
      inLateTurnState: true,
      requirementAddressed: false,
      boundaryLevel: "normal",
      requirementRestatedCount: 0,
    });
    const modeB = selectLateTurnConstraintResponseMode({
      hasActiveConstraint: true,
      hasActiveRequirement: true,
      inLateTurnState: true,
      requirementAddressed: false,
      boundaryLevel: "normal",
      requirementRestatedCount: 1,
    });
    const modeC = selectLateTurnConstraintResponseMode({
      hasActiveConstraint: true,
      hasActiveRequirement: true,
      inLateTurnState: true,
      requirementAddressed: false,
      boundaryLevel: "closing",
      requirementRestatedCount: 1,
    });

    assert.deepEqual(
      [modeA.mode, modeB.mode, modeC.mode],
      scenario.expected.lateTurnModes,
      `${scenario.scenarioId}: late-turn mode ordering changed`,
    );

    const closeDraft = buildLateTurnConstraintResponse({
      concern: scenario.initial.activeRequirement,
      mode: modeC.mode,
      includeConstraintSignal: true,
    });
    assert.doesNotMatch(closeDraft, /new concern|different issue|another blocker/i, `${scenario.scenarioId}: late close broadened objection`);

    const overallScore = computeSessionOverallScoreFromTurns(turns, CAPABILITY_IDS);
    assert.equal(overallScore, scenario.expected.overallScore, `${scenario.scenarioId}: aggregated score changed`);

    const feedbackSnapshot = buildFinalFeedbackSnapshot(turns);
    assert.ok(Object.keys(feedbackSnapshot.capabilityBreakdown).length === CAPABILITY_IDS.length, `${scenario.scenarioId}: capability breakdown missing keys`);
    const combinedFeedback = [
      ...feedbackSnapshot.behavioralObservations,
      ...feedbackSnapshot.coachingInsights,
    ].join(" ");
    assert.doesNotMatch(
      combinedFeedback,
      /\b(feels|feeling|intent|intends|angry|upset|frustrated|personality|motivation)\b/i,
      `${scenario.scenarioId}: feedback inferred intent/emotion`,
    );

    // Metrics activate only when behavior evidence exists.
    turns.forEach((turn, idx) => {
      Object.values(turn.alignment.metrics).forEach((metric) => {
        const hasEvidence = (metric?.positives?.length || 0) > 0 || (metric?.misalignments?.length || 0) > 0;
        if (!hasEvidence) {
          assert.equal(
            shouldIncludeMetricScore(metric),
            false,
            `${scenario.scenarioId}: turn ${idx + 1} metric should be inactive without evidence`,
          );
        }
      });
    });

    // Response boundedness: no infinite objection loops in compact 3-turn baselines.
    const allStates = turns.map((turn) => turn.nextState);
    assert.ok(allStates.length <= 5, `${scenario.scenarioId}: fixture exceeds bounded turn window`);
  }
});

test("negative: ignored constraints escalate and constrain without reopening generic objections", () => {
  const hcpConcern = "I need operational feasibility and concise evidence now; I am out of time.";

  const weakTurns = [
    "Our brand has strong clinical data across broad populations.",
    "Let me walk through more background before we get practical.",
    "I can send slides later, but this is very compelling overall.",
  ];

  const decisions = [
    selectLateTurnConstraintResponseMode({
      hasActiveConstraint: true,
      hasActiveRequirement: true,
      inLateTurnState: true,
      requirementAddressed: false,
      boundaryLevel: "normal",
      requirementRestatedCount: 0,
    }),
    selectLateTurnConstraintResponseMode({
      hasActiveConstraint: true,
      hasActiveRequirement: true,
      inLateTurnState: true,
      requirementAddressed: false,
      boundaryLevel: "normal",
      requirementRestatedCount: 1,
    }),
    selectLateTurnConstraintResponseMode({
      hasActiveConstraint: true,
      hasActiveRequirement: true,
      inLateTurnState: true,
      requirementAddressed: false,
      boundaryLevel: "closing",
      requirementRestatedCount: 1,
    }),
  ];

  assert.deepEqual(decisions.map((d) => d.mode), ["restate_once", "boundary", "close"]);

  const constrainedReplies = decisions.map((decision) =>
    buildLateTurnConstraintResponse({ concern: "evidence", mode: decision.mode, includeConstraintSignal: true }),
  );

  assert.match(constrainedReplies[2], /pause here/i, "late reply should close decisively");
  assert.doesNotMatch(constrainedReplies[2], /\?/i, "late close should avoid reopening with extra questions");
  constrainedReplies.forEach((reply) => {
    assert.doesNotMatch(reply, /pricing|formulary|new objection|different objection/i, "must not reopen generic objections");
  });

  const simulatedStates = weakTurns.reduce((acc, repMessage) => {
    const lastState = acc.length === 0 ? "time-pressured" : acc[acc.length - 1];
    const next = transitionState(lastState, repMessage, "stressed");
    return [...acc, next];
  }, []);

  assert.ok(simulatedStates.length === 3, "negative scenario must remain bounded");
  assert.ok(new Set(simulatedStates).size <= 3, "negative scenario should escalate, not loop through broad state churn");
  assert.match(hcpConcern, /operational feasibility|concise evidence|out of time/i);
});

test("control: concise direct requirement handling keeps constructive progression", () => {
  const directRepTurns = [
    "You need one practical step: same-day reflex ordering for eligible patients and track 7-day turnaround.",
    "Evidence threshold: maintain suppression under 200 copies/mL with no new grade 3 toxicity.",
    "If this fits, we can align on one pilot unit this week.",
  ];

  const decisions = directRepTurns.map(() =>
    selectLateTurnConstraintResponseMode({
      hasActiveConstraint: true,
      hasActiveRequirement: true,
      inLateTurnState: true,
      requirementAddressed: true,
      boundaryLevel: "constrained",
      requirementRestatedCount: 1,
    }),
  );

  decisions.forEach((decision) => {
    assert.equal(decision.forced, false);
    assert.equal(decision.mode, null);
  });

  let state = "resistant";
  let temp = "neutral";
  directRepTurns.forEach((repMessage) => {
    const next = transitionState(state, repMessage, temp);
    assert.notEqual(next, "disengaged", "constructive handling should not force closure");
    state = next;
    temp = transitionTemperature(temp, repMessage);
  });
});
