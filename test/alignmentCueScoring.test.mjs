import test from 'node:test';
import assert from 'node:assert/strict';

import { computeAlignment } from '../src/components/roleplay/alignmentEngine.jsx';

test('time-pressure cue without acknowledgment penalizes adaptive response', () => {
  const result = computeAlignment(
    'time_pressed',
    'Let me walk through all efficacy endpoints in detail and then we can discuss implementation.',
    {
      cueText: 'Dr. Chen glances at his schedule and says he has limited time.',
      hcpUtterance: 'Can we get to the point quickly?'
    },
    'neutral',
    'engaged'
  );

  assert.ok(
    result.metrics.adaptive_response.misalignments.some((m) => m.includes('Time-pressure cue')),
    'expected cue-based time-pressure misalignment'
  );
});

test('engagement cue with contextual follow-up improves cue responsiveness', () => {
  const result = computeAlignment(
    'engaged',
    'You mentioned operational complexity—what part of workflow integration is the biggest barrier in your setting?',
    {
      cueText: 'Dr. Chen leans in and asks to connect the dots for this setting.',
      hcpUtterance: 'Can you help me connect this to my workflow?'
    },
    'neutral',
    'neutral'
  );

  assert.ok(
    result.metrics.customer_engagement.positives.some((p) => p.includes('engagement cue')),
    'expected cue-linked engagement positive'
  );
});
