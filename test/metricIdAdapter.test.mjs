import test from 'node:test';
import assert from 'node:assert/strict';

import {
  adaptScenarioMetricIdToRuntimeCapabilityId,
  validateScenarioMetricIdsMapped,
} from '../src/lib/roleplay-v2/metricIdAdapter.js';

test('adapter maps canonical scenario metric IDs to runtime SOT capability IDs', () => {
  assert.equal(adaptScenarioMetricIdToRuntimeCapabilityId('question_quality'), 'signal_awareness');
  assert.equal(adaptScenarioMetricIdToRuntimeCapabilityId('making_it_matter'), 'value_connection');
  assert.equal(adaptScenarioMetricIdToRuntimeCapabilityId('commitment_gaining'), 'commitment_generation');
});

test('adapter validator fails on unmapped metric IDs', () => {
  const result = validateScenarioMetricIdsMapped(['question_quality', 'unknown_metric']);
  assert.equal(result.valid, false);
  assert.deepEqual(result.unmapped, ['unknown_metric']);
});
