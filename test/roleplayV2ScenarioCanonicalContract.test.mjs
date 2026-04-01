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
