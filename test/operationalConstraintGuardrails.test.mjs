import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildConstraintGrounding,
  detectConstraintDraftViolations,
  buildConstraintViolationFallback,
} from '../src/components/roleplay/operationalConstraintGuardrails.js';

test('no scenario constraint present -> no staffing/workflow injection allowed', () => {
  const grounding = buildConstraintGrounding({
    scenarioText: 'Discuss phase 3 efficacy and safety outcomes.',
    dialogueTurns: ['Can you explain the endpoint hierarchy?'],
  });

  const result = detectConstraintDraftViolations({
    draftText: 'We are short-staffed so this is hard to adopt.',
    groundedTypes: [...grounding.groundedTypes],
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.ungroundedTypes, ['staffing']);
});

test('scenario constraint present -> mention allowed once only', () => {
  const grounding = buildConstraintGrounding({
    scenarioText: 'Clinic workflow is currently constrained by referral routing.',
    dialogueTurns: [],
  });

  const firstMention = detectConstraintDraftViolations({
    draftText: 'The workflow constraint is still my main concern.',
    groundedTypes: [...grounding.groundedTypes],
    alreadySurfacedTypes: [],
  });

  assert.equal(firstMention.valid, true);

  const secondMention = detectConstraintDraftViolations({
    draftText: 'I still need this to fit into workflow.',
    groundedTypes: [...grounding.groundedTypes],
    alreadySurfacedTypes: ['workflow'],
  });

  assert.equal(secondMention.valid, false);
  assert.deepEqual(secondMention.duplicateTypes, ['workflow']);
});

test('repeated paraphrase of same known constraint -> blocked', () => {
  const result = detectConstraintDraftViolations({
    draftText: 'Bandwidth is limited, so this still feels burdensome.',
    groundedTypes: ['capacity'],
    alreadySurfacedTypes: ['capacity'],
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.duplicateTypes, ['capacity']);
});

test('explicit user revisit request -> allowed reference', () => {
  const result = detectConstraintDraftViolations({
    draftText: 'On workflow, the process still looks unclear.',
    groundedTypes: ['workflow'],
    alreadySurfacedTypes: ['workflow'],
    revisitRequested: true,
  });

  assert.equal(result.valid, true);
});

test('changed constraint -> allowed updated mention', () => {
  const result = detectConstraintDraftViolations({
    draftText: 'Scheduling is the blocker right now.',
    groundedTypes: ['workflow', 'scheduling'],
    alreadySurfacedTypes: ['workflow'],
    newlyRaisedTypes: ['scheduling'],
    changedConstraint: true,
  });

  assert.equal(result.valid, true);
});

test('constraint violation fallback rotates away from repeated recent dialogue', () => {
  const repeated = 'Help me understand the most clinically relevant takeaway for my patients.';
  const fallback = buildConstraintViolationFallback({
    concern: 'evidence',
    recentDialogues: [repeated, repeated],
    seed: 'session-1:turn-8',
  });

  assert.notEqual(fallback, repeated);
  assert.equal(typeof fallback, 'string');
  assert.ok(fallback.length > 0);
});
