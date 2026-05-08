import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCENARIO_TO_RUNTIME_METRIC_ID_MAP,
  findUnmappedRuntimeMetricIds,
  findUnmappedScenarioMetricKeys,
} from '../src/lib/roleplay-v2/metricIdAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, '../schemas/roleplay-scenario.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

const schemaMetricKeys = schema?.properties?.metricEvidenceMap?.required || [];
const unmappedScenario = findUnmappedScenarioMetricKeys(schemaMetricKeys);
const unmappedRuntime = findUnmappedRuntimeMetricIds();

if (unmappedScenario.length || unmappedRuntime.length) {
  console.error('METRIC_ID_ADAPTER_VALIDATION_FAILED');
  console.error(JSON.stringify({ unmappedScenario, unmappedRuntime, adapter: SCENARIO_TO_RUNTIME_METRIC_ID_MAP }, null, 2));
  process.exit(1);
}

console.log('METRIC_ID_ADAPTER_VALIDATION_OK');
console.log(JSON.stringify({ schemaMetricKeys, adapter: SCENARIO_TO_RUNTIME_METRIC_ID_MAP }, null, 2));
