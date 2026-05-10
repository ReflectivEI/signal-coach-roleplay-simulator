import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialHardDemandPriorityState,
  updateHardDemandPriorityState,
  getBufferedConcernAfterHardDemandRelease,
  buildHardDemandLockedObjective,
} from '../src/components/roleplay/hardDemandPriorityLock.js';
import { DEMAND_TYPES } from '../src/components/roleplay/interventionEngineV2.js';

function unresolvedDemand(type) {
  return {
    type,
    isActive: true,
    demandSatisfied: false,
    resolvedThisTurn: false,
  };
}

test('evidence lock remains dominant and buffers secondary concerns while unresolved', () => {
  const initial = createInitialHardDemandPriorityState();
  const acquired = updateHardDemandPriorityState(initial, {
    activeDemand: unresolvedDemand(DEMAND_TYPES.SINGLE_POINT_REQUIRED),
    hcpPrompt: 'Give me one concrete evidence point with one number.',
    activeConcern: 'evidence',
    turnNumber: 2,
  });

  const continued = updateHardDemandPriorityState(acquired, {
    activeDemand: unresolvedDemand(DEMAND_TYPES.SINGLE_POINT_REQUIRED),
    hcpPrompt: 'I still need one number.',
    activeConcern: 'workflow',
    turnNumber: 3,
  });

  assert.equal(continued.hardDemandPriorityLock, true);
  assert.equal(continued.hardDemandUnresolved, true);
  assert.equal(continued.hardDemandType, DEMAND_TYPES.SINGLE_POINT_REQUIRED);
  assert.equal(continued.activeHardDemand, 'evidence');
  assert.deepEqual(continued.pendingSecondaryConcerns, ['workflow']);
  assert.equal(continued.objectiveOverrideBlocked, true);
  assert.equal(buildHardDemandLockedObjective(continued), 'continue_hard_demand_lock[evidence]');
});

test('direct-answer lock continues with deterministic narrowing progression on miss', async () => {
  const { resolveConstraintLoopAction } = await import('../src/components/roleplay/constraintLoopPolicy.js');
  const action = resolveConstraintLoopAction({
    hardDemandContinuation: true,
    hardDemandNarrowingLevel: 2,
    repeatingNonAnswer: true,
    hasMaterialProgression: false,
    activeConcern: 'workflow',
  });

  assert.equal(action?.nextHcpState, 'boundary-setting');
  assert.match(action?.nextHcpDialogue || '', /one concrete answer|one data point/i);
  assert.ok((action?.nextNarrowingLevel || 0) >= 3);
});

test('buffered secondary concern can drive after hard demand satisfied', () => {
  const initial = createInitialHardDemandPriorityState();
  const acquired = updateHardDemandPriorityState(initial, {
    activeDemand: unresolvedDemand(DEMAND_TYPES.EVIDENCE_REQUEST),
    hcpPrompt: 'I need one clinically meaningful data point.',
    activeConcern: 'evidence',
    turnNumber: 1,
  });
  const continued = updateHardDemandPriorityState(acquired, {
    activeDemand: unresolvedDemand(DEMAND_TYPES.EVIDENCE_REQUEST),
    hcpPrompt: 'Still unresolved.',
    activeConcern: 'staffing',
    turnNumber: 2,
  });

  const released = updateHardDemandPriorityState(continued, {
    activeDemand: {
      type: DEMAND_TYPES.EVIDENCE_REQUEST,
      isActive: false,
      demandSatisfied: true,
      resolvedThisTurn: true,
    },
    hcpPrompt: 'That answers it.',
    activeConcern: 'evidence',
    turnNumber: 3,
  });

  assert.equal(released.hardDemandPriorityLock, false);
  assert.equal(released.hardDemandUnresolved, false);
  assert.equal(released.hardDemandReleaseReason, 'satisfied');
  assert.equal(getBufferedConcernAfterHardDemandRelease(released), 'staffing');
  assert.equal(released.objectiveOverrideBlocked, false);
});

test('no silent unlock: release reason is explicit when lock clears without satisfaction', () => {
  const initial = createInitialHardDemandPriorityState();
  const acquired = updateHardDemandPriorityState(initial, {
    activeDemand: unresolvedDemand(DEMAND_TYPES.DIRECT_ANSWER_REQUIRED),
    hcpPrompt: 'What should we do this month?',
    activeConcern: 'workflow',
    turnNumber: 4,
  });

  const downgraded = updateHardDemandPriorityState(acquired, {
    activeDemand: {
      type: null,
      isActive: false,
      demandSatisfied: false,
      resolvedThisTurn: false,
    },
    hcpPrompt: 'Moving on.',
    activeConcern: 'workflow',
    turnNumber: 5,
  });

  assert.equal(downgraded.hardDemandPriorityLock, false);
  assert.equal(downgraded.hardDemandUnresolved, false);
  assert.equal(downgraded.hardDemandReleaseReason, 'downgraded');
  assert.equal(buildHardDemandLockedObjective(downgraded), null);
});

test('cross-scenario hard-demand detection is generic across evidence and operational families', () => {
  const scenarioA = updateHardDemandPriorityState(createInitialHardDemandPriorityState(), {
    activeDemand: unresolvedDemand(DEMAND_TYPES.PROOF_POINT_REQUEST),
    hcpPrompt: 'Give me one study point for this HIV prevention clinic.',
    activeConcern: 'evidence',
    turnNumber: 1,
  });
  const scenarioB = updateHardDemandPriorityState(createInitialHardDemandPriorityState(), {
    activeDemand: unresolvedDemand(DEMAND_TYPES.ONE_STEP_REQUIRED),
    hcpPrompt: 'In this oncology workflow, what is one step we run this week?',
    activeConcern: 'workflow',
    turnNumber: 1,
  });

  assert.equal(scenarioA.hardDemandPriorityLock, true);
  assert.equal(scenarioB.hardDemandPriorityLock, true);
});
