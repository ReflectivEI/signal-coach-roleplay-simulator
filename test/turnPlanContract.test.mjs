import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTurnPlan, validateTurnPlan, TURN_PLAN_VERSION } from '../src/lib/roleplay-v2/turnPlanContract.js';

test('buildTurnPlan returns immutable normalized shape', () => {
  const plan = buildTurnPlan({
    turnNumber: 2,
    nextDialogue: '  hello  ',
    nextCue: ' cue ',
    nextState: ' engaged ',
    constraintDecision: { mode: 'none', reason: 'ok', blocking: false },
    metadata: { scenarioId: 'abc', concern: 'workflow', source: 'test' },
  });

  assert.equal(plan.version, TURN_PLAN_VERSION);
  assert.equal(plan.turnNumber, 2);
  assert.equal(plan.nextDialogue, 'hello');
  assert.equal(plan.nextCue, 'cue');
  assert.equal(plan.nextState, 'engaged');
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.constraintDecision));
  assert.ok(Object.isFrozen(plan.metadata));
});

test('validateTurnPlan accepts valid plan and rejects malformed plan', () => {
  const validPlan = buildTurnPlan({ turnNumber: 1 });
  const valid = validateTurnPlan(validPlan);
  assert.equal(valid.valid, true);

  const invalid = validateTurnPlan({});
  assert.equal(invalid.valid, false);
  assert.ok(invalid.issues.length > 0);
});
