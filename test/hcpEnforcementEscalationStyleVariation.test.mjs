import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyEscalationPresentation,
  assertTemplateEquivalence,
  deriveEscalationState,
  deriveHcpEnforcementProfile,
  stableHash,
} from '../src/components/roleplay/hcpEnforcementEscalation.js';
import {
  classifyDemandType,
  decideInterventionAction,
  INTERVENTION_DECISIONS,
} from '../src/components/roleplay/interventionEngineV2.js';

function snapshotContractState() {
  const classification = classifyDemandType({
    hcpPrompt: 'How do we monitor this week and fit it into staffing workflow?',
    hasBlockingConstraints: true,
    needsConstraintReanchor: true,
  });

  const profile = deriveHcpEnforcementProfile({
    scenario: {},
    hcpProfile: { baselineCommunicationStyle: 'focused practical' },
    sceneSetup: { timePressure: 'high' },
    hcpState: 'impatient',
    activeConcern: 'workflow',
    cueMeaning: 'skeptical',
    hardDemandState: { hardDemandPriorityLock: true },
  });

  const escalation = deriveEscalationState({
    profile,
    priorEscalationStage: 'focused',
    priorMisalignmentCount: 1,
    priorHardDemandMissCount: 1,
    alignment: { score: 2.4, misalignments: ['a', 'b'] },
    concernFlowOutcome: 'missed',
    repMessage: 'General value is important.',
    hardDemandState: { hardDemandPriorityLock: true, hardDemandUnresolved: true },
    domainAssessment: { repDomainStatus: 'in_domain', contextContamination: false },
  });

  const coaching = decideInterventionAction({
    repeatedMissedCues: 1,
    repeatedLowAlignmentEvents: 1,
    evidenceCheckpointTriggered: false,
    unresolvedConstraintReanchor: true,
    directQuestionPending: true,
    cooldownTurnsRemaining: 0,
    escalationRisk: 'elevated',
  });

  return { classification, escalationStage: escalation.escalationStage, coaching };
}

test('stableHash is deterministic and order-independent for logical object inputs', () => {
  const left = { stage: 'firm', orientation: 'operational', concern: 'workflow', domain: 'oncology' };
  const right = { domain: 'oncology', concern: 'workflow', orientation: 'operational', stage: 'firm' };
  assert.equal(stableHash(left), stableHash(right));
  assert.equal(stableHash(left), stableHash(left));
});

test('presentation variant seed ignores irrelevant fields and stays deterministic', () => {
  const baseArgs = {
    cueText: 'HCP folds arms.',
    dialogueText: 'Need a direct answer.',
    escalationStage: 'firm',
    profile: { orientation: 'operational' },
    activeConcern: 'workflow',
  };

  const baseline = applyEscalationPresentation({
    ...baseArgs,
    domainAssessment: { scenarioDomain: 'oncology' },
  });
  const sameWithIrrelevantField = applyEscalationPresentation({
    ...baseArgs,
    domainAssessment: { scenarioDomain: 'oncology', irrelevantTelemetryField: 'ignored-for-seed' },
  });

  assert.deepEqual(sameWithIrrelevantField, baseline);
});

test('style variation remains presentation-only: classification/escalation/coaching contracts are unchanged', () => {
  const before = snapshotContractState();
  const after = snapshotContractState();
  assert.deepEqual(after, before);

  const presentationA = applyEscalationPresentation({
    cueText: 'HCP expression hardens.',
    dialogueText: 'Please answer now.',
    escalationStage: 'high_pressure',
    profile: { orientation: 'analytical' },
    domainAssessment: { scenarioDomain: 'oncology' },
    activeConcern: 'workflow',
  });
  const presentationB = applyEscalationPresentation({
    cueText: 'HCP expression hardens.',
    dialogueText: 'Please answer now.',
    escalationStage: 'high_pressure',
    profile: { orientation: 'analytical' },
    domainAssessment: { scenarioDomain: 'oncology' },
    activeConcern: 'evidence',
  });

  assert.equal(before.classification, 'operational_reanchor_required');
  assert.equal(before.coaching, INTERVENTION_DECISIONS.REQUIRE_REANCHOR_TO_CONSTRAINT);
  assert.equal(typeof presentationA.dialogueText, 'string');
  assert.equal(typeof presentationB.dialogueText, 'string');
  assert.match(presentationA.dialogueText.toLowerCase(), /(non-specific|without specificity)/);
  assert.match(presentationB.dialogueText.toLowerCase(), /(non-specific|without specificity)/);
});

test('assertTemplateEquivalence throws on semantic divergence and variant-cap violations', () => {
  assert.throws(() => {
    assertTemplateEquivalence('disengaging', {
      balanced: [
        'I need one exact answer now or we should pause here.',
        '',
      ],
    });
  }, /empty_template/);

  assert.throws(() => {
    assertTemplateEquivalence('focused', {
      balanced: ['a', 'b', 'c', 'd', 'e', 'f'],
    });
  }, /Template variant cap exceeded/);
});

test('first-turn escalation is bounded below high-pressure unless explicitly allowed', () => {
  const profile = deriveHcpEnforcementProfile({
    scenario: {},
    hcpProfile: { baselineCommunicationStyle: 'skeptical directive' },
    sceneSetup: { timePressure: 'high' },
    hcpState: 'impatient',
    cueMeaning: 'skeptical',
    activeConcern: 'workflow',
    hardDemandState: { hardDemandPriorityLock: true },
  });

  const unbounded = deriveEscalationState({
    profile,
    priorEscalationStage: 'open',
    priorMisalignmentCount: 0,
    priorHardDemandMissCount: 0,
    priorDomainDriftCount: 0,
    alignment: { score: 1.8, misalignments: ['miss', 'miss2'] },
    concernFlowOutcome: 'missed',
    repMessage: 'General answer.',
    hardDemandState: { hardDemandPriorityLock: true, hardDemandUnresolved: true },
    domainAssessment: { repDomainStatus: 'cross_domain_contamination', contextContamination: true },
    allowImmediateHighPressure: false,
  });
  assert.notEqual(unbounded.escalationStage, 'high_pressure');
  assert.notEqual(unbounded.escalationStage, 'disengaging');

  const explicit = deriveEscalationState({
    profile,
    priorEscalationStage: 'open',
    priorMisalignmentCount: 0,
    priorHardDemandMissCount: 0,
    priorDomainDriftCount: 0,
    alignment: { score: 1.8, misalignments: ['miss', 'miss2'] },
    concernFlowOutcome: 'missed',
    repMessage: 'General answer.',
    hardDemandState: { hardDemandPriorityLock: true, hardDemandUnresolved: true },
    domainAssessment: { repDomainStatus: 'cross_domain_contamination', contextContamination: true },
    allowImmediateHighPressure: true,
  });
  assert.equal(['high_pressure', 'disengaging'].includes(explicit.escalationStage), true);
});
