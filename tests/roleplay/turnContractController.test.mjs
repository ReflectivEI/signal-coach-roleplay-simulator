import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RESPONSE_MODES,
  createInitialObligationLedger,
  updateObligationLedger,
  buildTurnContractBlock,
  validateGeneratedTurn,
  applySatisfactionToLedger,
} from '../../src/components/roleplay/turnContractController.js';

test('routes unresolved direct question to ANSWER (including paraphrase variant)', () => {
  const base = createInitialObligationLedger();
  const ledgerA = updateObligationLedger(base, 'Can you explain how this fits into our workflow today?');
  const ledgerB = updateObligationLedger(base, 'How exactly would we run this in clinic?');

  assert.equal(ledgerA.active_response_mode, RESPONSE_MODES.ANSWER);
  assert.equal(ledgerB.active_response_mode, RESPONSE_MODES.ANSWER);
  assert.ok(ledgerA.open_questions.length > 0);
  assert.ok(ledgerB.open_questions.length > 0);
});

test('routes objection without direct question to RESOLVE_OBJECTION', () => {
  const base = createInitialObligationLedger();
  const ledger = updateObligationLedger(base, 'I am worried this will add staffing burden and slow our workflow.');

  assert.equal(ledger.active_response_mode, RESPONSE_MODES.RESOLVE_OBJECTION);
  assert.ok(ledger.unresolved_objections.length > 0);
  assert.ok(ledger.accepted_constraints.some((c) => c.constraint.includes('staff')));
});

test('prevents CLOSE while ineligible and allows CLOSE when eligible + explicit close cue', () => {
  const base = createInitialObligationLedger();

  const blockedLedger = updateObligationLedger(base, 'Can you answer one more thing before we wrap up?');
  assert.notEqual(blockedLedger.active_response_mode, RESPONSE_MODES.CLOSE);
  assert.equal(blockedLedger.closure_preconditions.eligible, false);

  const eligibleLedger = {
    ...base,
    open_questions: [],
    unresolved_objections: [],
  };
  const closeLedger = updateObligationLedger(eligibleLedger, 'Thanks, that helps. Let us wrap up.');
  assert.equal(closeLedger.closure_preconditions.explicit_close_cue, true);
  assert.equal(closeLedger.closure_preconditions.eligible, true);
  assert.equal(closeLedger.active_response_mode, RESPONSE_MODES.CLOSE);
});

test('validation blocks ask-before-answer loop in ANSWER mode', () => {
  const ledger = updateObligationLedger(createInitialObligationLedger(), 'What is the practical first step?');

  const invalid = validateGeneratedTurn({
    mode: RESPONSE_MODES.ANSWER,
    generatedText: 'What are your current barriers before I answer?',
    ledger,
    latestCounterpartTurn: 'What is the practical first step?',
  });
  assert.equal(invalid.satisfied, false);
  assert.equal(invalid.hardFields.asked_before_answering, true);

  const valid = validateGeneratedTurn({
    mode: RESPONSE_MODES.ANSWER,
    generatedText: 'The practical first step is assigning one owner to run a one-week workflow pilot with a single follow-up checkpoint.',
    ledger,
    latestCounterpartTurn: 'What is the practical first step?',
  });
  assert.equal(valid.satisfied, true);
});

test('repeated objection loop can be satisfied and cleared deterministically', () => {
  let ledger = createInitialObligationLedger();
  ledger = updateObligationLedger(ledger, 'I am still concerned about workflow burden.');
  ledger = updateObligationLedger(ledger, 'This still feels impractical for staffing.');

  assert.equal(ledger.active_response_mode, RESPONSE_MODES.RESOLVE_OBJECTION);
  assert.ok(ledger.unresolved_objections.length >= 1);

  const validation = validateGeneratedTurn({
    mode: RESPONSE_MODES.RESOLVE_OBJECTION,
    generatedText: 'You are right to flag workflow burden. We can address it by assigning one nurse owner, reducing handoffs, and reviewing impact after one week.',
    ledger,
    latestCounterpartTurn: 'This still feels impractical for staffing.',
  });
  assert.equal(validation.satisfied, true);

  const settled = applySatisfactionToLedger(ledger, validation);
  assert.equal(settled.unresolved_objections.length, 0);
});

test('contract block includes hard mode instructions and closure guardrail', () => {
  const ledger = updateObligationLedger(createInitialObligationLedger(), 'Can you answer this today?');
  const contract = buildTurnContractBlock({
    ledger,
    latestCounterpartIntent: 'workflow',
    selectedMode: RESPONSE_MODES.ANSWER,
    strictness: 'strict',
  });

  assert.match(contract, /selected_response_mode: ANSWER/);
  assert.match(contract, /must_do_this_turn: Directly answer the latest question first/);
  assert.match(contract, /closure_allowed: no/);
  assert.match(contract, /forbidden_this_turn:/);
});
