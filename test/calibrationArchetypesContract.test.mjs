import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path = new URL('../docs/CODEX_CALIBRATION_ARCHETYPES_2026-04-01.json', import.meta.url);

test('calibration package includes required deterministic archetype coverage', () => {
  const raw = fs.readFileSync(path, 'utf8');
  const doc = JSON.parse(raw);

  assert.equal(doc.determinism, true);
  assert.equal(doc.scoring_scope, 'rep_only_observable_behavior');
  assert.deepEqual(doc.state_machine.ordered_states, ['engaged', 'constrained', 'impatient', 'disengaging']);
  assert.equal(doc.archetypes.length, 4);
  assert.ok(doc.edge_cases.length >= 3);
  assert.ok(doc.hard_rules.includes('rep_cannot_introduce_new_topic_without_traceable_active_signal'));

  doc.archetypes.forEach((archetype) => {
    assert.ok(archetype.id);
    assert.ok(Array.isArray(archetype.pass_conditions) && archetype.pass_conditions.length >= 3);
    assert.ok(Array.isArray(archetype.fail_conditions) && archetype.fail_conditions.length >= 3);
  });
});
