import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RESPONSE_ARBITRATION_STAGE_ORDER,
  evaluateRepToHcpContinuity,
  hasNextTurnAlready,
  isStaleAsyncResponse,
  selectRewriteAuthority,
  shouldApplyConstraintDraftGuardrail,
  shouldEndSessionAfterTurn,
} from '../src/components/roleplay/runtimeResponseArbitration.js';

test('response-arbitration stage ordering stays deterministic and unchanged', () => {
  assert.deepEqual(RESPONSE_ARBITRATION_STAGE_ORDER, [
    'terminal_policy_probe',
    'constraint_block_close',
    'partial_progress_soften',
    'late_turn_constraint_override',
    'rewrite_authority_resolution',
    'constraint_draft_guardrail',
    'deterministic_punctuation_contract',
    'session_finalization_gate',
  ]);
});

test('rewrite authority prioritizes anti-repeat over continuity repair and suppresses on terminal', () => {
  assert.equal(selectRewriteAuthority({ repetitiveCandidate: 'same line', continuityNeedsRepair: true }), 'anti_repeat');
  assert.equal(selectRewriteAuthority({ repetitiveCandidate: '', continuityNeedsRepair: true }), 'continuity_repair');
  assert.equal(selectRewriteAuthority({ overrideExit: true, repetitiveCandidate: 'same line' }), 'none');
  assert.equal(selectRewriteAuthority({ nextHcpState: 'disengaged', continuityNeedsRepair: true }), 'none');
});

test('stale async response protection rejects superseded or inactive requests', () => {
  assert.equal(isStaleAsyncResponse({ requestId: 1, activeRequestId: 2, sessionActive: true }), true);
  assert.equal(isStaleAsyncResponse({ requestId: 2, activeRequestId: 2, sessionActive: false }), true);
  assert.equal(isStaleAsyncResponse({ requestId: 2, activeRequestId: 2, sessionActive: true }), false);
});

test('duplicate generation protection detects existing generated next turn by turn or generation key', () => {
  const prevTurnsState = [
    { turnNumber: 3, repMessage: 'rep', hcpDialogueBefore: null },
    { turnNumber: 4, repMessage: null, hcpDialogueBefore: 'next hcp line', generationKey: 'g-4' },
  ];
  assert.equal(hasNextTurnAlready({ prevTurnsState, nextTurn: { turnNumber: 4 }, generationKey: 'other' }), true);
  assert.equal(hasNextTurnAlready({ prevTurnsState: [{ turnNumber: 3, repMessage: 'rep' }], nextTurn: { turnNumber: 4 }, generationKey: 'g-4' }), false);
  assert.equal(hasNextTurnAlready({ prevTurnsState, nextTurn: { turnNumber: 6 }, generationKey: 'g-4' }), true);
});

test('exact-repeat fallback continuity detector flags evidence drift and preserves happy path', () => {
  const drift = evaluateRepToHcpContinuity({
    repMessage: 'The study duration and endpoint details were clear in the trial evidence.',
    priorHcpDialogue: 'Can you clarify study methodology and duration?',
    hcpDialogue: 'Let us talk about staffing and scheduling instead.',
    activeConcern: 'workflow',
  });
  assert.equal(drift.needsRepair, true);
  assert.equal(drift.evidenceDriftGap, true);

  const aligned = evaluateRepToHcpContinuity({
    repMessage: 'The study endpoint showed evidence in this population.',
    priorHcpDialogue: 'Can you clarify study methodology and duration?',
    hcpDialogue: 'Thanks, that study endpoint and methodology detail is helpful.',
    activeConcern: 'evidence',
  });
  assert.equal(aligned.needsRepair, false);
});

test('final response write/finalization gating preserves close and block-close behavior', () => {
  assert.equal(shouldEndSessionAfterTurn({ blockClose: true, overrideExit: true, isTerminalClosureDialogue: () => true }), false);
  assert.equal(shouldEndSessionAfterTurn({ overrideExit: true, isTerminalClosureDialogue: () => false }), true);
  assert.equal(shouldEndSessionAfterTurn({ nextHcpState: 'disengaged', nextHcpDialogue: 'wrap this up', terminalPolicyAction: 'continue', isTerminalClosureDialogue: () => true }), true);
  assert.equal(shouldEndSessionAfterTurn({ nextHcpState: 'engaged', terminalPolicyAction: 'close', isTerminalClosureDialogue: () => false }), true);
  assert.equal(shouldEndSessionAfterTurn({ nextHcpState: 'engaged', terminalPolicyAction: 'continue', isTerminalClosureDialogue: () => false }), false);
});

test('constraint draft guardrail remains disabled for opening turn and enabled after turn zero', () => {
  assert.equal(shouldApplyConstraintDraftGuardrail(0), false);
  assert.equal(shouldApplyConstraintDraftGuardrail(1), true);
});
