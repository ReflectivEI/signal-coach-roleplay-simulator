import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveConstraintLoopAction } from '../src/components/roleplay/constraintLoopPolicy.js';

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
