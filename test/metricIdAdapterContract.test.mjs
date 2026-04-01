import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  SCENARIO_TO_RUNTIME_METRIC_ID_MAP,
  findUnmappedRuntimeMetricIds,
  findUnmappedScenarioMetricKeys,
} from '../src/lib/roleplay-v2/metricIdAdapter.js';

const schema = JSON.parse(fs.readFileSync(new URL('../schemas/roleplay-scenario.schema.json', import.meta.url), 'utf8'));

test('scenario schema metric keys are fully mapped to runtime SOT ids', () => {
  const keys = schema.properties.metricEvidenceMap.required;
  assert.deepEqual(findUnmappedScenarioMetricKeys(keys), []);
});

test('adapter map covers all runtime metric ids', () => {
  assert.deepEqual(findUnmappedRuntimeMetricIds(), []);
});

test('adapter map remains one-to-one for deterministic translation', () => {
  const mapped = Object.values(SCENARIO_TO_RUNTIME_METRIC_ID_MAP);
  assert.equal(new Set(mapped).size, mapped.length);
});
