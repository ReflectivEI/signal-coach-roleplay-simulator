import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeAuxiliaryProgressionScore,
  detectDiminishingReturns,
  resolveConstraintLoopAction,
} from '../src/components/roleplay/constraintLoopPolicy.js';

test('returns structured boundary-setting prompt after consecutive blockClose turns', () => {
  const result = resolveConstraintLoopAction({
    consecutiveBlockCloseTurns: 2,
    activeConcern: 'monitoring',
    terminalCloseFallback: 'terminal-close',
  });

  assert.equal(result?.nextHcpState, 'boundary-setting');
  assert.match(result?.nextHcpDialogue || '', /monitoring owner/i);
});

test('forces disengaged closure on persistent repeated loop', () => {
  const result = resolveConstraintLoopAction({
    consecutiveBlockCloseTurns: 3,
    repeatedRepPattern: true,
    similarConstraintPrompts: 3,
    activeConcern: 'workflow',
    terminalCloseFallback: 'terminal-close',
  });

  assert.deepEqual(result, {
    nextHcpState: 'disengaged',
    nextHcpDialogue: 'terminal-close',
  });
});

test('engaged evidence progression does not map loop policy to boundary/terminal close', () => {
  const result = resolveConstraintLoopAction({
    consecutiveBlockCloseTurns: 3,
    repeatedRepPattern: true,
    similarConstraintPrompts: 3,
    activeConcern: 'evidence',
    terminalCloseFallback: 'terminal-close',
    hasMaterialProgression: true,
  });

  assert.equal(result, null);
});

test('auxiliary progression score rewards concrete, contextual, non-repetitive answers', () => {
  const strongScore = computeAuxiliaryProgressionScore({
    constraintType: 'request_for_operational_fit',
    repMessage: 'Fair point. First step this week: assign one pharmacist owner to submit prior auth within 24 hours at discharge and track delays.',
    hcpPrompt: 'How does this fit our workflow and prior auth delays?',
    previousRepMessage: 'We can discuss this later.',
  });
  const weakScore = computeAuxiliaryProgressionScore({
    constraintType: 'request_for_operational_fit',
    repMessage: 'This is important in general.',
    hcpPrompt: 'How does this fit our workflow and prior auth delays?',
    previousRepMessage: 'This is important in general.',
  });

  assert.ok(strongScore >= 0.6, `expected strong score >= 0.6, got ${strongScore}`);
  assert.ok(weakScore < strongScore, `expected weak < strong (${weakScore} < ${strongScore})`);
});

test('diminishing returns detection triggers on plateau + repetition', () => {
  const diminishing = detectDiminishingReturns({
    progressionScoreHistory: [0.62, 0.64, 0.63],
    repeatedRepPattern: true,
    similarConstraintPrompts: 2,
    recentRepMessages: [
      'Use one practical checklist with the same owner and timeline.',
      'Use one practical checklist with the same owner and timeline.',
      'Use one practical checklist with the same owner and timeline.',
    ],
  });

  assert.equal(diminishing, true);
});

test('functional resolution keeps loop policy from forcing boundary/disengage', () => {
  const result = resolveConstraintLoopAction({
    consecutiveBlockCloseTurns: 4,
    repeatedRepPattern: true,
    similarConstraintPrompts: 4,
    activeConcern: 'workflow',
    terminalCloseFallback: 'terminal-close',
    hasFunctionalResolution: true,
    diminishingReturnsDetected: true,
  });

  assert.equal(result, null);
});
