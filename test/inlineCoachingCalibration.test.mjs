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

test('inline coaching suppresses false concern-miss when rep acknowledges and gives direct evidence answer', () => {
  const turn = {
    turnNumber: 11,
    repMessage: "That's exactly the right question. A decision-level evidence point is a 62% reduction at week 48 in the studied cohort.",
    hcpStateBefore: 'resistant',
    hcpDialogueBefore: 'I need evidence I can trust before making this call.',
    cueBefore: 'HCP requests evidence before proceeding.',
  };
  const alignment = {
    misalignments: ['Resistance signal not reflected in response — concern not acknowledged'],
    rubricAlignmentFlags: [],
  };

  const guidance = getBaselineAlignedInlineGuidance({ turn, alignment });
  assert.match(guidance || '', /acknowledged the concern/i);
});

test('inline coaching recognizes paraphrased acknowledgment for concern language shifts', () => {
  const turn = {
    turnNumber: 12,
    repMessage: "What I'm hearing is you need this to fit your workflow without adding staffing burden. Start with one MA-owned handoff checklist this week.",
    hcpStateBefore: 'boundary-setting',
    hcpDialogueBefore: 'This feels operationally heavy for our team right now.',
    cueBefore: 'HCP sets a practical workflow boundary.',
  };
  const alignment = {
    misalignments: ['Resistance signal not reflected in response — concern not acknowledged'],
    rubricAlignmentFlags: [],
  };

  const guidance = getBaselineAlignedInlineGuidance({ turn, alignment });
  assert.match(guidance || '', /acknowledged the concern/i);
});

test('inline coaching keeps true-miss warning behavior when rep moves forward without acknowledgment', () => {
  const turn = {
    turnNumber: 13,
    repMessage: 'Great, anyway let me walk through broader brand differentiators.',
    hcpStateBefore: 'resistant',
    hcpDialogueBefore: 'I am worried this creates more operational burden and may not last long enough.',
    cueBefore: 'HCP signals concern and resistance.',
  };
  const alignment = {
    misalignments: ['Resistance signal not reflected in response — concern not acknowledged'],
    rubricAlignmentFlags: [],
  };

  const guidance = getBaselineAlignedInlineGuidance({ turn, alignment });
  assert.equal(guidance, null);
});

test('inline coaching concern recovery is shared/global across evidence, burden, durability, and workflow-fit shapes', () => {
  const shapes = [
    {
      repMessage: "That's a fair concern. One evidence point is sustained benefit at 48 weeks.",
      hcpDialogueBefore: 'I need stronger evidence before changing practice.',
    },
    {
      repMessage: "You're right to focus on burden. Start with a one-step staffing handoff owned by the MA.",
      hcpDialogueBefore: 'This is too much operational burden for our staff.',
    },
    {
      repMessage: "That's reasonable. On durability, outcomes stayed stable through long-term follow-up.",
      hcpDialogueBefore: 'I am not convinced the durability is strong enough.',
    },
    {
      repMessage: "What I'm hearing is you need this to fit your clinic workflow. First step is a practical intake trigger in your setting.",
      hcpDialogueBefore: 'Show me how this is actually feasible in our clinic workflow.',
    },
  ];

  for (const [index, shape] of shapes.entries()) {
    const guidance = getBaselineAlignedInlineGuidance({
      turn: {
        turnNumber: 20 + index,
        repMessage: shape.repMessage,
        hcpStateBefore: 'resistant',
        hcpDialogueBefore: shape.hcpDialogueBefore,
        cueBefore: 'HCP raises concern.',
      },
      alignment: {
        misalignments: ['Resistance signal not reflected in response — concern not acknowledged'],
        rubricAlignmentFlags: [],
      },
    });
    assert.match(guidance || '', /acknowledged the concern/i);
  }
});

test('inline coaching recognizes explicit access concern acknowledgment', () => {
  const turn = {
    turnNumber: 30,
    repMessage: "That's a fair access concern. We can start with one prior-authorization support step that reduces coverage delays this week.",
    hcpStateBefore: 'resistant',
    hcpDialogueBefore: 'Access and prior authorization delays are my main concern.',
    cueBefore: 'HCP raises access and payer friction.',
  };
  const alignment = {
    misalignments: ['Resistance signal not reflected in response — concern not acknowledged'],
    rubricAlignmentFlags: [],
  };

  const guidance = getBaselineAlignedInlineGuidance({ turn, alignment });
  assert.match(guidance || '', /acknowledged the concern/i);
});

test('inline coaching still recognizes staffing concern acknowledgment explicitly', () => {
  const turn = {
    turnNumber: 31,
    repMessage: "You're right to focus on staffing burden. We can assign one MA-owned handoff step to reduce team overload.",
    hcpStateBefore: 'resistant',
    hcpDialogueBefore: 'My staff capacity is the limiting factor right now.',
    cueBefore: 'HCP highlights staffing constraints.',
  };
  const alignment = {
    misalignments: ['Resistance signal not reflected in response — concern not acknowledged'],
    rubricAlignmentFlags: [],
  };

  const guidance = getBaselineAlignedInlineGuidance({ turn, alignment });
  assert.match(guidance || '', /acknowledged the concern/i);
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
