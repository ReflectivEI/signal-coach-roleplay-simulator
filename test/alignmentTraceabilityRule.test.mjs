import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/components/roleplay/alignmentEngine.jsx', import.meta.url), 'utf8');

test('alignment engine enforces traceability guardrail for rep topic drift', () => {
  assert.match(source, /function evaluateTopicTraceability\(/);
  assert.match(source, /not traceable to active HCP cue\/dialogue signals/);
  assert.match(source, /alignmentClassification/);
  assert.match(source, /over_pivot/);
});
