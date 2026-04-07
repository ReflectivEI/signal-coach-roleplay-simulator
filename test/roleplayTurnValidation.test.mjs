import test from 'node:test';
import assert from 'node:assert/strict';

import { validateRoleplayRepTurn } from '../src/lib/roleplay/roleplayTurnValidation.js';

test('shared roleplay turn validation blocks repeated non-responsive latest-ask turns before generation', () => {
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: "We're drowning in prior-auth paperwork. Can you help with that?",
    repMessage: "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.",
    previousRepMessages: [
      "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.",
    ],
  });

  assert.equal(validation.valid, false);
  assert.equal(validation.invalid, true);
  assert.equal(validation.blockHcpGeneration, true);
  assert.equal(validation.blockScoring, true);
  assert.equal(validation.blockStateAdvance, true);
  assert.equal(validation.latestAskProgression.status, 'repeated_missed');
  assert.equal(validation.latestAskProgression.family, 'workflow');
  assert.equal(validation.coaching.escalationLabel, 'Turn blocked');
  assert.match(validation.coaching.suggestion, /workflow step/i);
});

test('shared roleplay turn validation allows concrete progress through the same interface', () => {
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: "We're drowning in prior-auth paperwork. Can you help with that?",
    repMessage: 'Start benefits verification before the refill window, with the care coordinator owning the checklist.',
    previousRepMessages: [
      "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.",
    ],
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.invalid, false);
  assert.equal(validation.blockHcpGeneration, false);
  assert.equal(validation.blockScoring, false);
  assert.equal(validation.blockStateAdvance, false);
  assert.equal(validation.coaching, null);
});
