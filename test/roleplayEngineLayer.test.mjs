import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveTurnContractState,
  buildTurnContractController,
  validateGeneratedTurnContract,
  buildContractRepairResponse,
} from "../src/components/roleplay/turnContractController.js";
import {
  selectContextualCue,
  enforceNoRecentCueRepeat,
} from "../src/components/roleplay/cueSelector.js";
import { validateTurnWithRetry } from "../src/components/roleplay/turnValidator.js";

test("unanswered question enforcement uses validator retry and deterministic repair", async () => {
  const turnContractState = deriveTurnContractState({
    latestHcpTurn: "What exact first step should we pilot this week?",
    repMessage: "Maybe we can discuss later.",
    activeConcern: "workflow",
    concernFlowOutcome: "missed",
    unresolvedConcernTurns: 2,
  });

  const controller = buildTurnContractController({
    turnContractState,
    concernFlowOutcome: "missed",
    fallbackMode: "probe",
  });

  assert.equal(controller.responseMode, "answer");

  const validated = await validateTurnWithRetry({
    initialDraft: "What should we do?",
    responseMode: controller.responseMode,
    turnContractState,
    activeConcern: "workflow",
    maxRetries: 1,
    validateTurnContract: validateGeneratedTurnContract,
    buildContractRepairResponse,
  });

  assert.equal(validated.valid, true);
  assert.match(validated.draftText, /practical answer/i);
});

test("cue selector enforces 20-turn anti-repetition", () => {
  const repeatedCue = "The HCP glances at the clock, patience thinning.";
  const recentCueText = Array.from({ length: 20 }, (_, idx) =>
    idx === 19 ? repeatedCue : `Recent cue ${idx}`,
  );

  const selectedCue = selectContextualCue({
    generationKey: "session-1",
    nextTurnNumber: 21,
    nextHcpState: "time-pressured",
    activeConcern: "workflow",
    nextProfileLockedCue: repeatedCue,
    recentCueText,
    responseText: "Please keep this practical.",
    engagementTier: "constrained",
    noRepeatWindowTurns: 20,
    cueFactory: () => repeatedCue,
  });

  const safeCue = enforceNoRecentCueRepeat({
    candidateCue: selectedCue,
    recentCueText,
    noRepeatWindowTurns: 20,
    fallbackPool: [
      repeatedCue,
      "The HCP pauses, clearly expecting something more useful.",
      "The HCP shifts posture slightly, less engaged.",
    ],
    seed: "session-1:21:cue-fallback",
  });

  assert.notEqual(safeCue, repeatedCue);
});

test("cross-scenario consistency keeps response mode deterministic for same turn contract inputs", () => {
  const scenarioFamilies = ["hiv_prep", "oncology_access", "cardiometabolic", "general_access"];

  const outputs = scenarioFamilies.map(() => {
    const turnContractState = {
      unansweredDirectQuestions: [{ question: "What first step should we take this week?" }],
      unresolvedObjections: ["workflow"],
      closureEligibility: { eligible: false, reasons: [] },
    };

    return buildTurnContractController({
      turnContractState,
      concernFlowOutcome: "missed",
      fallbackMode: "probe",
    });
  });

  for (const result of outputs) {
    assert.equal(result.responseMode, "answer");
    assert.equal(result.objective, "answer_direct_constraint_question");
  }
});

test("closure gating only permits close mode when eligibility triggers are present", () => {
  const gatedState = deriveTurnContractState({
    latestHcpTurn: "Keep this quick.",
    repMessage: "Thanks.",
    activeConcern: "workflow",
    concernFlowOutcome: "aligned",
    unresolvedConcernTurns: 0,
    loopBreakerBudget: 2,
    overrideExit: false,
    terminalDecisionMode: false,
    hardLoopBreaker: false,
  });

  const gatedDecision = buildTurnContractController({
    turnContractState: gatedState,
    concernFlowOutcome: "aligned",
    fallbackMode: "probe",
  });

  assert.equal(gatedState.closureEligibility.eligible, false);
  assert.notEqual(gatedDecision.responseMode, "close");

  const closureState = deriveTurnContractState({
    latestHcpTurn: "I need to leave now.",
    repMessage: "Understood.",
    activeConcern: "workflow",
    concernFlowOutcome: "missed",
    unresolvedConcernTurns: 4,
    loopBreakerBudget: 2,
    terminalDecisionMode: true,
    hardLoopBreaker: true,
  });

  const closureDecision = buildTurnContractController({
    turnContractState: closureState,
    concernFlowOutcome: "missed",
    fallbackMode: "probe",
  });

  assert.equal(closureState.closureEligibility.eligible, true);
  assert.equal(closureDecision.responseMode, "close");
});
