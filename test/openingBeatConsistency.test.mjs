import test from 'node:test';
import assert from 'node:assert/strict';

import { enforceOpeningBeatConsistency } from '../src/components/roleplay/openingBeatConsistency.js';

test('opening beat consistency preserves concern family and pressured tone', () => {
  const result = enforceOpeningBeatConsistency({
    openingScene: 'Dr. Patel glances at her watch and says she only has a few minutes due to prior auth backlog.',
    candidate: 'I\'m glad to chat socially before clinical details.',
    activeConcern: 'workflow',
  });

  assert.equal(result.preserved, false);
  assert.match(result.dialogue, /practical|concise|single next step/i);
});

test('opening beat consistency keeps valid candidate unchanged', () => {
  const result = enforceOpeningBeatConsistency({
    openingScene: 'The HCP asks for one workflow step she can implement this week.',
    candidate: 'Given our workflow pressure, what is the single step we should start this week?',
    activeConcern: 'workflow',
  });

  assert.equal(result.preserved, true);
  assert.equal(result.dialogue, 'Given our workflow pressure, what is the single step we should start this week?');
});
