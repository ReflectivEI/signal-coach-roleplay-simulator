import test from 'node:test';
import assert from 'node:assert/strict';

import { getBaselineAlignedInlineGuidance } from '../src/components/roleplay/inlineCoachingCalibration.js';

test('inline coaching does not flag concern-miss when rep clearly acknowledges concern', () => {
  const turn = {
    turnNumber: 7,
    repMessage: "That's a fair concern about workflow burden, and you're right to raise it.",
    hcpStateBefore: 'resistant',
    hcpDialogueBefore: 'This feels like extra burden for our team.',
    cueBefore: 'HCP appears resistant and concerned about workflow burden.',
  };
  const alignment = {
    misalignments: ['Resistance signal not reflected in response — concern not acknowledged'],
    rubricAlignmentFlags: [],
  };

  const guidance = getBaselineAlignedInlineGuidance({ turn, alignment });
  assert.match(guidance || '', /acknowledged the concern/i);
});

test('inline coaching does not flag adaptation miss when rep adapts to time/practical constraints', () => {
  const turn = {
    turnNumber: 8,
    repMessage: "You're right to raise that. I'll keep this brief: one practical step is an MA checklist today.",
    hcpStateBefore: 'time-pressured',
    hcpDialogueBefore: 'I only have a minute—keep this practical.',
    cueBefore: 'HCP checks watch and asks for brevity.',
  };
  const alignment = {
    misalignments: ['Time constraint not acknowledged — structure not adapted to context'],
    rubricAlignmentFlags: ['Response did not adapt to the HCP\'s latest cue.'],
  };

  const guidance = getBaselineAlignedInlineGuidance({ turn, alignment });
  assert.match(guidance || '', /adapted to the latest constraint/i);
});

test('inline coaching still flags genuine misses when no acknowledgment/adaptation evidence exists', () => {
  const turn = {
    turnNumber: 9,
    repMessage: 'The data are strong and support use broadly across patients.',
    hcpStateBefore: 'resistant',
    hcpDialogueBefore: 'This does not seem practical for our clinic workflow.',
    cueBefore: 'HCP expresses resistance and practicality concerns.',
  };
  const alignment = {
    misalignments: ['Resistance signal not reflected in response — concern not acknowledged'],
    rubricAlignmentFlags: [],
  };

  const guidance = getBaselineAlignedInlineGuidance({ turn, alignment });
  assert.equal(guidance, null);
});

test('inline calibration guidance is deterministic for identical input', () => {
  const turn = {
    turnNumber: 10,
    repMessage: "That's completely reasonable, and I can keep this brief with one practical next step.",
    hcpStateBefore: 'time-pressured',
    hcpDialogueBefore: 'Be concise and practical.',
    cueBefore: 'HCP is rushed.',
  };
  const alignment = {
    misalignments: ['Response did not adapt to the HCP\'s latest cue.'],
    rubricAlignmentFlags: [],
  };

  assert.equal(
    getBaselineAlignedInlineGuidance({ turn, alignment }),
    getBaselineAlignedInlineGuidance({ turn, alignment }),
  );
});
