import test from "node:test";
import assert from "node:assert/strict";

import {
  extractDirectQuestions,
  repAddressesQuestion,
  deriveTurnContractState,
  selectDeterministicResponseMode,
  mapResponseModeToObjective,
  validateGeneratedTurnContract,
  buildContractRepairResponse,
} from "../src/components/roleplay/turnContractController.js";

test("extractDirectQuestions returns question sentences", () => {
  const questions = extractDirectQuestions("What is practical this week? Also, how does this reduce burden?");
  assert.equal(questions.length, 2);
});

test("repAddressesQuestion detects token overlap and numeric anchor", () => {
  assert.equal(
    repAddressesQuestion(
      "Start with a one-week pilot and track turnaround time.",
      "What first step can we run this week?",
    ),
    true,
  );
  assert.equal(
    repAddressesQuestion(
      "Use 200 copies/mL as the initial threshold.",
      "What threshold should we use?",
    ),
    true,
  );
});

test("deriveTurnContractState tracks unanswered question + accepted constraints", () => {
  const state = deriveTurnContractState({
    latestHcpTurn: "What practical workflow step should we try first?",
    repMessage: "Let's discuss this later.",
    normalizedActiveConstraints: ["workflow"],
    activeConcern: "workflow",
    concernFlowOutcome: "missed",
    unresolvedConcernTurns: 2,
  });

  assert.equal(state.unansweredDirectQuestions.length, 1);
  assert.deepEqual(state.acceptedOperationalConstraints, ["workflow"]);
  assert.ok(state.unresolvedObjections.includes("workflow"));
});

test("selectDeterministicResponseMode prioritizes close then answer", () => {
  const closeMode = selectDeterministicResponseMode({
    turnContractState: {
      closureEligibility: { eligible: true },
      unansweredDirectQuestions: [{ question: "What is the step?" }],
      unresolvedObjections: ["workflow"],
    },
    concernFlowOutcome: "missed",
    fallbackMode: "probe",
  });
  assert.equal(closeMode, "close");

  const answerMode = selectDeterministicResponseMode({
    turnContractState: {
      closureEligibility: { eligible: false },
      unansweredDirectQuestions: [{ question: "What is the step?" }],
      unresolvedObjections: ["workflow"],
    },
    concernFlowOutcome: "missed",
    fallbackMode: "probe",
  });
  assert.equal(answerMode, "answer");
  assert.equal(mapResponseModeToObjective(answerMode), "answer_direct_constraint_question");
});

test("validateGeneratedTurnContract catches answer-mode question-only output and repair is deterministic", () => {
  const validation = validateGeneratedTurnContract({
    responseMode: "answer",
    draftText: "What should we do?",
    turnContractState: {
      unansweredDirectQuestions: [{ question: "What should we do?" }],
    },
  });
  assert.equal(validation.valid, false);

  const repair = buildContractRepairResponse({ responseMode: "answer", activeConcern: "workflow" });
  assert.match(repair, /practical answer/i);
});
