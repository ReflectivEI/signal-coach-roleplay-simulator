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

test('direct evidence question answered with threshold should not trigger readiness-signal misalignment', () => {
  const result = computeAlignment(
    'engaged',
    '42 weeks.',
    {
      cueText: 'HCP narrows focus and asks for proof tied to this setting.',
      hcpUtterance: "I'd like to know more about the study methodology. What was the duration of the study?"
    },
    'neutral',
    'engaged'
  );

  assert.ok(
    !result.rubricAlignmentFlags.some((flag) => flag.includes('A readiness signal appeared')),
    'readiness-signal misalignment should not fire for direct answered evidence question'
  );
  assert.ok(
    result.metrics.signal_interpretation.positives.some((p) => p.includes('Direct HCP question was answered')),
    'expected direct-question answered positive'
  );
});

test('greeting-only opener is penalized when cue/dialogue demand immediate context-aware response', () => {
  const result = computeAlignment(
    'time-pressured',
    'Hi Lisa.',
    {
      cueText: 'HCP taps the chart and signals urgency due to limited time.',
      hcpUtterance: 'Given our workflow constraints, what is the first operational step you recommend?'
    },
    'neutral',
    'engaged'
  );

  assert.ok(
    result.metrics.signal_awareness.misalignments.some((m) => m.includes('Greeting-only opener ignored')),
    'expected greeting-only misalignment when direct demand is present'
  );
});

test('reflection without substantive answer is explicitly flagged as unanswered', () => {
  const result = computeAlignment(
    'neutral',
    'I hear you. You are asking what first step to run this week.',
    {
      cueText: 'HCP asks for an immediate operational recommendation.',
      hcpUtterance: 'Given workflow constraints, what is the first step we should run this week?'
    },
    'neutral',
    'neutral'
  );

  assert.ok(
    result.misalignments.some((m) => m.includes('did not answer the question')),
    'expected explicit unanswered-question misalignment'
  );
  assert.ok(
    result.misalignments.some((m) => m.includes('mirrored/reflected')),
    'expected reflection-vs-answer distinction in misalignments'
  );
});
