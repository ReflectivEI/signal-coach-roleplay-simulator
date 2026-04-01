import test from 'node:test';
import assert from 'node:assert/strict';

import { transitionState, HCP_STATES } from '../src/components/roleplay/hcpStateEngine.jsx';

test('state ladder includes disengaged terminal state', () => {
  assert.ok(HCP_STATES.includes('disengaged'));
});

test('disengaged stays disengaged for low-value/pushy reply', () => {
  const next = transitionState('disengaged', 'Hi, you should do this now.');
  assert.equal(next, 'disengaged');
});

test('disengaged can recover to boundary-setting on respectful concrete repair', () => {
  const next = transitionState('disengaged', 'I hear you — briefly, I can send one concrete metric threshold for your review if helpful.');
  assert.equal(next, 'boundary-setting');
});
