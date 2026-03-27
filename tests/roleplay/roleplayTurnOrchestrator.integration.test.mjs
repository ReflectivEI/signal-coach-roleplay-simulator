import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialObligationLedger,
  updateObligationLedger,
  buildTurnContractBlock,
  RESPONSE_MODES,
} from '../../src/components/roleplay/turnContractController.js';
import { runObligationAwareGeneration } from '../../src/components/roleplay/roleplayTurnOrchestrator.js';

function makeScenario(overrides = {}) {
  return {
    id: 'generic-scenario',
    title: 'Generic operational discussion',
    description: 'Discuss practical workflow implementation in a busy clinic.',
    opening_scene: 'A brief hallway discussion between appointments.',
    hcp_category: 'Physician',
    specialty: 'Internal Medicine',
    disease_state: 'General',
    ...overrides,
  };
}

function makeProfile(overrides = {}) {
  return {
    structuralState: 'neutral',
    temperature: 'neutral',
    severity: 0,
    lockedCue: 'The HCP pauses and waits for a practical answer.',
    toneDirectives: { instruction: 'Be concise and practical.', maxSentences: 2 },
    personality: null,
    conversationQuality: 0,
    repBehavior: {},
    memory: {},
    turnNumber: 1,
    ...overrides,
  };
}

function makeDecayState(overrides = {}) {
  return {
    tier: 'constrained',
    concernAddressed: false,
    repeatedEvidence: false,
    ...overrides,
  };
}

async function runWithResponses({ repMessage, responses, ledgerSeed, historyText = 'Sales Rep: prior context' }) {
  const scenario = makeScenario();
  const nextProfile = makeProfile();
  const obligationLedgerBeforeGeneration = updateObligationLedger(
    ledgerSeed || createInitialObligationLedger(),
    repMessage,
  );
  const selectedResponseMode = obligationLedgerBeforeGeneration.active_response_mode;
  const turnContractBlock = buildTurnContractBlock({
    ledger: obligationLedgerBeforeGeneration,
    latestCounterpartIntent: 'workflow',
    selectedMode: selectedResponseMode,
  });

  let idx = 0;
  const usedResponses = [];
  const result = await runObligationAwareGeneration({
    scenario,
    nextProfile,
    historyText,
    isFirstHcpResponse: false,
    decayState: makeDecayState(),
    activeConcern: 'workflow',
    suppressCoachingHints: selectedResponseMode !== RESPONSE_MODES.PROBE,
    tierGuidance: {
      engaged: 'Stay open.',
      constrained: 'Be brief.',
      impatient: 'Be direct.',
      disengaging: 'Be minimal.',
    },
    tierSentenceMax: {
      engaged: 4,
      constrained: 3,
      impatient: 2,
      disengaging: 2,
    },
    turnContractBlock,
    selectedResponseMode,
    obligationLedgerBeforeGeneration,
    repMessage,
    forceTerminalDisengagement: false,
    terminalCloseFallback: 'I need to get back to patients. Take care.',
    buildFirstTurnScenarioFallback: () => 'Opening fallback response.',
    buildFollowUpScenarioFallback: () => 'Follow-up fallback response.',
    latestCounterpartIntent: 'workflow',
    buildPrompt: ({ turnContractBlock, historyText }) => `PROMPT\n${turnContractBlock}\n${historyText}`,
    normalizeGeneratedDialogue: (text) => String(text || '').trim(),
    invokeRoleplayModel: async () => {
      const response = responses[idx];
      idx += 1;
      usedResponses.push(response);
      if (response instanceof Error) throw response;
      return response;
    },
    debugEnabled: false,
    logger: console,
  });

  return {
    result,
    selectedResponseMode,
    obligationLedgerBeforeGeneration,
    usedResponses,
  };
}

test('live path enforces ANSWER mode with retry and commits only validated output', async () => {
  const repMessage = 'Can you give me the first practical step we should take this week?';
  const firstInvalid = 'What barriers are you seeing before we answer that?';
  const secondValid = 'The first practical step is assigning one owner and running a one-week workflow pilot with a follow-up checkpoint.';

  const { result, selectedResponseMode } = await runWithResponses({
    repMessage,
    responses: [firstInvalid, secondValid],
  });

  assert.equal(selectedResponseMode, RESPONSE_MODES.ANSWER);
  assert.equal(result.retryTriggered, true);
  assert.equal(result.attemptCount, 2);
  assert.equal(result.obligationValidation.satisfied, true);
  assert.equal(result.obligationValidation.hardFields.direct_question_satisfied, true);
  assert.equal(result.nextHcpDialogue, secondValid);
  assert.notEqual(result.nextHcpDialogue, firstInvalid);
  assert.equal(result.obligationLedgerAfter.obligation_satisfaction_status.satisfied, true);
});

test('live path gates objection resolution until a valid resolving response is produced', async () => {
  const repMessage = 'I am worried this will add staffing burden and disrupt workflow.';
  const firstInvalid = 'I hear you. What else are you concerned about?';
  const secondValid = 'You are right to raise staffing burden. We can address it by assigning one owner, reducing handoffs, and reviewing impact after one week.';

  const { result, selectedResponseMode } = await runWithResponses({
    repMessage,
    responses: [firstInvalid, secondValid],
  });

  assert.equal(selectedResponseMode, RESPONSE_MODES.RESOLVE_OBJECTION);
  assert.equal(result.retryTriggered, true);
  assert.equal(result.obligationValidation.satisfied, true);
  assert.equal(result.obligationValidation.hardFields.objection_resolved_this_turn, true);
  assert.equal(result.nextHcpDialogue, secondValid);
  assert.notEqual(result.nextHcpDialogue, firstInvalid);
  assert.equal(result.obligationLedgerAfter.unresolved_objections.length, 0);
});

test('live path rejects premature close and gates state advance until compliant non-close response', async () => {
  const repMessage = 'Can you answer what to do first?';
  const firstInvalidClose = 'Thanks for your time, goodbye.';
  const secondValidAnswer = 'Start with one concrete operational step: assign an owner and run a one-week implementation check-in.';

  const { result, selectedResponseMode } = await runWithResponses({
    repMessage,
    responses: [firstInvalidClose, secondValidAnswer],
  });

  assert.equal(selectedResponseMode, RESPONSE_MODES.ANSWER);
  assert.equal(result.retryTriggered, true);
  assert.equal(result.obligationValidation.satisfied, true);
  assert.equal(result.obligationValidation.hardFields.closure_correctness, true);
  assert.equal(result.nextHcpDialogue, secondValidAnswer);
  assert.notEqual(result.nextHcpDialogue, firstInvalidClose);
});

test('live path accepts eligible CLOSE without unnecessary retry', async () => {
  const ledgerSeed = {
    ...createInitialObligationLedger(),
    open_questions: [],
    unresolved_objections: [],
  };
  const repMessage = 'Thanks, this is clear. Let us wrap up.';
  const closeResponse = "Thanks for the discussion. Let\'s wrap up here, and I will follow up with a concise summary.";

  const { result, selectedResponseMode, obligationLedgerBeforeGeneration } = await runWithResponses({
    repMessage,
    responses: [closeResponse],
    ledgerSeed,
  });

  assert.equal(obligationLedgerBeforeGeneration.closure_preconditions.eligible, true);
  assert.equal(selectedResponseMode, RESPONSE_MODES.CLOSE);
  assert.equal(result.retryTriggered, false);
  assert.equal(result.attemptCount, 1);
  assert.equal(result.obligationValidation.satisfied, true);
  assert.equal(result.obligationValidation.hardFields.closure_correctness, true);
  assert.equal(result.nextHcpDialogue, closeResponse);
});
