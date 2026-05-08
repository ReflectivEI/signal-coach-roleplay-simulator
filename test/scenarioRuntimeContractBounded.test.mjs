import test from "node:test";
import assert from "node:assert/strict";

import {
  applyMetricApplicabilityGating,
  enforceFeedbackEvidenceRules,
  enforceProhibitedStateTransition,
  normalizeGeneratedScenario,
  normalizeScenarioRuntimeContract,
  validateScenarioRuntimeContract,
} from "../src/lib/scenarioNormalization.js";

test("backward compatibility: existing normalized scenario adapts to runtime canonical contract", () => {
  const migratedInput = normalizeGeneratedScenario({
    title: "Migrated Scenario",
    content: "Opening Scene: Busy clinic hallway.\nObjective: Secure one practical next step.",
    specialty: "Cardiology",
  });
  const contract = normalizeScenarioRuntimeContract(migratedInput);
  const result = validateScenarioRuntimeContract(contract);
  assert.equal(result.valid, true);
  assert.equal(contract.scenarioIdentity.title, "Migrated Scenario");
  assert.equal(typeof contract.metricApplicabilityMap.signal_awareness, "string");
});

test("metric applicability gating is explicit and contract-driven", () => {
  const alignment = {
    score: 3,
    metrics: {
      objection_navigation: { score: 1 },
      signal_awareness: { score: 4 },
    },
  };
  const contract = normalizeScenarioRuntimeContract({
    metricApplicabilityMap: {
      objection_navigation: "not_applicable",
      signal_awareness: "always_applicable",
    },
  });
  const gated = applyMetricApplicabilityGating(alignment, contract);
  assert.equal(gated.metricApplicability.objection_navigation, "not_applicable");
  assert.equal(gated.metricApplicability.signal_awareness, "always_applicable");
});

test("prohibited transition enforcement blocks disallowed HCP transitions deterministically", () => {
  const contract = normalizeScenarioRuntimeContract({
    prohibitedTransitions: [{ from: "skeptical", to: "receptive", reason: "missing intermediate evidence state" }],
  });
  const blocked = enforceProhibitedStateTransition({
    fromState: "skeptical",
    proposedState: "receptive",
    runtimeContract: contract,
  });
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.nextState, "skeptical");
  assert.match(blocked.reason, /intermediate evidence/i);
});

test("cue text does not directly alter metric applicability gating output", () => {
  const alignment = { metrics: { customer_engagement: { score: 5 } } };
  const contract = normalizeScenarioRuntimeContract({});
  const gatedA = applyMetricApplicabilityGating(alignment, contract);
  const gatedB = applyMetricApplicabilityGating(alignment, contract);
  assert.deepEqual(gatedA.metricApplicability, gatedB.metricApplicability);
});

test("feedback evidence rule enforcement removes prohibited inference language", () => {
  const contract = normalizeScenarioRuntimeContract({
    feedbackContract: {
      whatFeedbackCanReference: ["explicit_hcp_statement"],
      whatFeedbackCannotInfer: ["inferred_intent", "inferred_emotion_without_signal", "personality_labels"],
    },
  });
  const raw = "You intended to rush and the HCP felt dismissed.\nYou are pushy in your tone.";
  const cleaned = enforceFeedbackEvidenceRules(raw, contract);
  assert.ok(!/intended to rush/i.test(cleaned));
  assert.ok(!/hcp felt/i.test(cleaned));
  assert.ok(!/you are pushy/i.test(cleaned));
});

test("runtime behavior tags calibrate migrated scenarios into explicit tone/state inputs", () => {
  const contract = normalizeScenarioRuntimeContract({
    id: "migrated_time_pressed_workflow",
    title: "Workflow-constrained access visit",
    specialty: "Infectious Diseases",
    hcpMood: "frustrated, overwhelmed",
    context: "Short-staffed clinic with heavy prior-auth paperwork and workflow friction.",
    openingScene: "Sarah is reviewing prior-auth paperwork between patient visits. 'Hi. We're tight on staff today. What did you want to focus on?'",
    challenges: ["Limited staffing resources", "Prior-auth processing burden"],
  });

  assert.equal(contract.runtimeBehaviorTags.timePressure, "high");
  assert.equal(contract.runtimeBehaviorTags.engagementLevel, "guarded");
  assert.equal(contract.runtimeBehaviorTags.orientation, "operational");
  assert.equal(contract.runtimeBehaviorTags.communicationPace, "curt");
  assert.equal(contract.sceneSetup.timePressure, "high");
  assert.equal(contract.hcpStateModel.startingState, "time-pressured");
  assert.match(contract.hcpProfile.baselineCommunicationStyle, /frustrated|overwhelmed/i);
});

test("canonical behavior tags override migrated prose when provided explicitly", () => {
  const contract = normalizeScenarioRuntimeContract({
    title: "Engaged evidence review",
    context: "The clinic is busy and operationally blocked.",
    hcpMood: "frustrated, overwhelmed",
    hcpProfile: {
      baselineCommunicationStyle: "collaborative analytical",
      baselineOpennessResistance: "engaged",
    },
    sceneSetup: {
      timePressure: "low",
      currentClinicalOperationalContext: "evidence review",
    },
    hcpStateModel: { startingState: "engaged" },
  });

  assert.equal(contract.runtimeBehaviorTags.timePressure, "low");
  assert.equal(contract.runtimeBehaviorTags.engagementLevel, "engaged");
  assert.equal(contract.hcpStateModel.startingState, "engaged");
  assert.equal(contract.sceneSetup.timePressure, "low");
});
