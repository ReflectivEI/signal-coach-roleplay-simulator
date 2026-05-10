import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/components/roleplay/hcpSimulationEngine.jsx', import.meta.url), 'utf8');

test('hcp prompt includes thread continuity lock for active concern family', () => {
  assert.match(source, /THREAD CONTINUITY LOCK/);
  assert.match(source, /Respond to this thread FIRST before any adjacent reframing/);
  assert.match(source, /Do not switch to a different concern family unless the active thread has been answered/);
});
