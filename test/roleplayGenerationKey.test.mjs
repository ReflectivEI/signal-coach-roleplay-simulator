import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDeterministicGenerationKey,
  normalizeGenerationText,
} from '../src/components/roleplay/generationKey.js';

test('normalizeGenerationText lowercases and collapses whitespace deterministically', () => {
  assert.equal(
    normalizeGenerationText('  Hello   THERE  Team  '),
    'hello there team',
  );
});

test('buildDeterministicGenerationKey is stable for same inputs', () => {
  const input = {
    sessionId: 'session_abc123',
    turnNumber: 4,
    repMessage: 'Can we align on one workflow step?',
  };

  const first = buildDeterministicGenerationKey(input);
  const second = buildDeterministicGenerationKey(input);
  assert.equal(first, second);
});

test('buildDeterministicGenerationKey varies by session id for same turn/message', () => {
  const shared = {
    turnNumber: 2,
    repMessage: 'What is the first actionable step this week?',
  };

  const sessionA = buildDeterministicGenerationKey({ ...shared, sessionId: 'session_A' });
  const sessionB = buildDeterministicGenerationKey({ ...shared, sessionId: 'session_B' });

  assert.notEqual(sessionA, sessionB);
});
