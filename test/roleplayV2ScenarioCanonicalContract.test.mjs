import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCanonicalScenarioSpec,
  validateCanonicalScenarioSpec,
} from '../src/lib/roleplay-v2/scenarioCanonicalContract.js';

test('canonical scenario spec validates with deterministic enums and ordered sections', () => {
  const spec = createCanonicalScenarioSpec();
  const result = validateCanonicalScenarioSpec(spec);
  assert.equal(result.valid, true, result.issues.join('; '));
});

test('validator rejects invalid enum and missing section', () => {
  const spec = createCanonicalScenarioSpec({
    trainingIntent: {
      metricApplicability: { question_quality: 'sometimes' },
    },
  });
  delete spec.feedbackContract;
  const result = validateCanonicalScenarioSpec(spec);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.includes('invalid metric applicability')));
  assert.ok(result.issues.some((issue) => issue.includes('missing section: feedbackContract')));
});


test('validator rejects unmapped scenario metric ids for runtime adapter parity', () => {
  const spec = createCanonicalScenarioSpec({
    trainingIntent: {
      primaryCapabilityFocus: ['signal_awareness'],
      secondaryCapabilityFocus: [],
      allowedEvaluatedMetrics: ['question_quality', 'unknown_metric_id'],
      excludedMetrics: [],
      rubricNotes: 'Rep-side evidence only. No intent/emotion inference.',
      metricApplicability: {
        question_quality: 'always_applicable',
        listening_responsiveness: 'always_applicable',
        making_it_matter: 'always_applicable',
        customer_engagement_signals: 'always_applicable',
        objection_navigation: 'conditional_on_objection',
        conversation_control_structure: 'always_applicable',
        adaptability: 'conditional_on_new_information',
        commitment_gaining: 'conditional_on_commitment_attempt',
      },
    },
  });
  const result = validateCanonicalScenarioSpec(spec);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.includes('unmapped scenario metric id: unknown_metric_id')));
});
