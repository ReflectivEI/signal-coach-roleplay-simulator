import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createInitialTurnRuntimeState, planRoleplayTurn } from '../src/components/roleplay/roleplayTurnPlanner.js';
import { arbitrateRoleplayResponse } from '../src/components/roleplay/roleplayResponseArbitrator.js';
import { finalizeRoleplayMessage } from '../src/components/roleplay/roleplayFinalizationContract.js';
import { computeAlignment } from '../src/components/roleplay/alignmentEngine.jsx';

test('planner stage is deterministic with same seed and inputs', () => {
  const stateA = createInitialTurnRuntimeState('seed-a');
  const stateB = createInitialTurnRuntimeState('seed-a');

  const input = {
    repMessage: 'We can start with one front-desk checklist this week and track completion rate.',
    previousHcpDialogue: 'What is one concrete step we can implement first?',
    previousCue: 'The HCP asks directly for one practical step.',
    alignmentScore: 4,
    activeConcern: 'workflow',
    activeConstraints: ['workflow'],
  };

  const planA = planRoleplayTurn({ runtimeState: stateA, ...input });
  const planB = planRoleplayTurn({ runtimeState: stateB, ...input });

  assert.deepEqual(planA.traceEntry, planB.traceEntry);
  assert.equal(planA.plannerIntent, planB.plannerIntent);
  assert.equal(planA.difficultyMode, planB.difficultyMode);
});

test('evidence checkpoint remains open for vague rep answer', () => {
  const state = createInitialTurnRuntimeState('seed-evidence');
  const plan = planRoleplayTurn({
    runtimeState: state,
    repMessage: 'Great question, we can discuss that later.',
    previousHcpDialogue: 'Show me one concrete data point and what it changes for this month\'s patients.',
    previousCue: 'HCP asks for evidence tied to practice impact.',
    alignmentScore: 2,
    activeConcern: 'evidence',
    activeConstraints: ['evidence'],
  });

  assert.equal(plan.checkpointType, 'evidence');
  assert.equal(plan.checkpoint.unmetHardDemand, true);
  assert.equal(plan.plannerIntent, 'narrow_and_hold_demand');
});

test('direct-question enforcement narrows final response when rep deflects', () => {
  const plan = {
    checkpointType: 'direct_answer',
    checkpoint: { unmetHardDemand: true },
  };

  const arbitration = arbitrateRoleplayResponse({
    draftResponse: 'Thanks for that perspective.',
    plannerContract: plan,
    activeConcern: 'workflow',
    recentDialogues: ['Thanks for that perspective.'],
  });

  assert.match(arbitration.finalResponse, /Please answer directly/i);
  assert.ok(arbitration.stages.includes('stage_4_final_writer'));
});

test('normalization contract is explicit for storage/display modes', () => {
  const source = '  We can start now.   ';
  assert.equal(finalizeRoleplayMessage(source, { mode: 'storage' }), 'We can start now.');
  assert.equal(finalizeRoleplayMessage(source, { mode: 'display' }), 'We can start now.');
});

test('live RolePlayChat enforces planner -> generation -> arbitration -> finalization order', () => {
  const rolePlayChatSource = fs.readFileSync(
    new URL('../src/components/roleplay/RolePlayChat.jsx', import.meta.url),
    'utf8',
  );

  assert.match(rolePlayChatSource, /const plannerContract = planRoleplayTurn\(/);
  assert.match(rolePlayChatSource, /const systemPrompt = buildHCPDialoguePrompt\(/);
  assert.match(rolePlayChatSource, /const arbitration = arbitrateRoleplayResponse\(/);
  assert.match(rolePlayChatSource, /finalizeRoleplayMessage\(acceptedDialogueBeforeFinalContract, \{ mode: "storage" \}\)/);
});

test('computeAlignment canonical metric keys and contract shape are unchanged', () => {
  const alignment = computeAlignment(
    'neutral',
    'We can pilot one checklist this week and track completion rate.',
    { hcpUtterance: 'What one step should we start with?', sessionNamespace: 'test-session' },
    'neutral',
    'neutral',
  );

  const expected = [
    'signal_awareness',
    'signal_interpretation',
    'value_connection',
    'customer_engagement',
    'objection_navigation',
    'conversation_management',
    'adaptive_response',
    'commitment_generation',
  ];

  assert.deepEqual(Object.keys(alignment.metrics).sort(), expected.sort());
  assert.equal(typeof alignment.score, 'number');
});
