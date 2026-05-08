import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveHcpEnforcementProfile, deriveEscalationState } from '../src/components/roleplay/hcpEnforcementEscalation.js';
import { decideInterventionAction } from '../src/components/roleplay/interventionEngineV2.js';

const SCENARIOS = Object.freeze([
  { id: 'onc_io', state: 'impatient', concern: 'workflow', time: 'high', style: 'focused operational', cue: 'skeptical', constraint: true },
  { id: 'card_access', state: 'resistant', concern: 'access', time: 'medium', style: 'skeptical analytical', cue: 'uncertain', constraint: false },
  { id: 'id_monitor', state: 'neutral', concern: 'monitoring', time: 'low', style: 'collaborative practical', cue: 'neutral', constraint: true },
  { id: 'neuro_select', state: 'skeptical', concern: 'patient_selection', time: 'medium', style: 'data driven', cue: 'analytical', constraint: false },
  { id: 'endo_evidence', state: 'engaged', concern: 'evidence', time: 'low', style: 'analytical', cue: 'receptive', constraint: false },
  { id: 'pulm_workflow', state: 'impatient', concern: 'workflow', time: 'high', style: 'directive', cue: 'frustrated', constraint: true },
  { id: 'derm_ops', state: 'resistant', concern: 'operational', time: 'medium', style: 'pragmatic', cue: 'skeptical', constraint: true },
]);

const MESSAGE_LIBRARY = Object.freeze([
  'General value is important for outcomes.',
  'Assign one MA owner this week and review completion by Friday.',
  'A phase 3 study showed a 14 percent improvement in adherence.',
  'This may help broadly, we can follow up later.',
  'In your clinic, start with one intake checklist now.',
]);

const SEED_MATRIX = Object.freeze([11, 29, 53]);

const GOLDEN_STAGE_DECISION_SNAPSHOT = Object.freeze({
  onc_io: {
    11: ['firm:require_reanchor_to_constraint', 'firm:require_evidence_anchor', 'firm:require_reanchor_to_constraint', 'narrowed:require_direct_answer', 'disengaging:require_direct_answer'],
    29: ['open:require_direct_answer', 'open:require_direct_answer', 'firm:require_reanchor_to_constraint', 'firm:require_reanchor_to_constraint', 'disengaging:require_direct_answer'],
    53: ['open:require_evidence_anchor', 'firm:require_reanchor_to_constraint', 'disengaging:require_reanchor_to_constraint', 'disengaging:require_direct_answer', 'disengaging:require_evidence_anchor'],
  },
  card_access: {
    11: ['firm:require_evidence_anchor', 'firm:require_direct_answer', 'narrowed:require_evidence_anchor', 'disengaging:require_direct_answer', 'disengaging:require_direct_answer'],
    29: ['open:require_direct_answer', 'open:require_direct_answer', 'firm:require_direct_answer', 'disengaging:require_direct_answer', 'disengaging:require_evidence_anchor'],
    53: ['open:require_evidence_anchor', 'open:require_evidence_anchor', 'firm:require_evidence_anchor', 'disengaging:require_direct_answer', 'disengaging:require_direct_answer'],
  },
  id_monitor: {
    11: ['firm:require_reanchor_to_constraint', 'firm:require_evidence_anchor', 'firm:require_reanchor_to_constraint', 'narrowed:require_direct_answer', 'disengaging:require_direct_answer'],
    29: ['open:require_direct_answer', 'open:require_direct_answer', 'firm:require_reanchor_to_constraint', 'firm:require_reanchor_to_constraint', 'disengaging:require_direct_answer'],
    53: ['open:require_evidence_anchor', 'firm:require_reanchor_to_constraint', 'disengaging:require_reanchor_to_constraint', 'disengaging:require_direct_answer', 'disengaging:require_evidence_anchor'],
  },
  neuro_select: {
    11: ['firm:require_evidence_anchor', 'firm:require_direct_answer', 'narrowed:require_evidence_anchor', 'disengaging:require_direct_answer', 'disengaging:require_direct_answer'],
    29: ['open:require_direct_answer', 'open:require_direct_answer', 'firm:require_direct_answer', 'disengaging:require_direct_answer', 'disengaging:require_evidence_anchor'],
    53: ['open:require_evidence_anchor', 'open:require_evidence_anchor', 'firm:require_evidence_anchor', 'disengaging:require_direct_answer', 'disengaging:require_direct_answer'],
  },
  endo_evidence: {
    11: ['firm:require_evidence_anchor', 'firm:require_direct_answer', 'narrowed:require_evidence_anchor', 'disengaging:require_direct_answer', 'disengaging:require_direct_answer'],
    29: ['open:require_direct_answer', 'open:require_direct_answer', 'firm:require_direct_answer', 'disengaging:require_direct_answer', 'disengaging:require_evidence_anchor'],
    53: ['open:require_evidence_anchor', 'open:require_evidence_anchor', 'firm:require_evidence_anchor', 'disengaging:require_direct_answer', 'disengaging:require_direct_answer'],
  },
  pulm_workflow: {
    11: ['firm:require_reanchor_to_constraint', 'firm:require_evidence_anchor', 'firm:require_reanchor_to_constraint', 'narrowed:require_direct_answer', 'disengaging:require_direct_answer'],
    29: ['open:require_direct_answer', 'open:require_direct_answer', 'firm:require_reanchor_to_constraint', 'firm:require_reanchor_to_constraint', 'disengaging:require_direct_answer'],
    53: ['open:require_evidence_anchor', 'firm:require_reanchor_to_constraint', 'disengaging:require_reanchor_to_constraint', 'disengaging:require_direct_answer', 'disengaging:require_evidence_anchor'],
  },
  derm_ops: {
    11: ['firm:require_reanchor_to_constraint', 'firm:require_evidence_anchor', 'firm:require_reanchor_to_constraint', 'narrowed:require_direct_answer', 'disengaging:require_direct_answer'],
    29: ['open:require_direct_answer', 'open:require_direct_answer', 'firm:require_reanchor_to_constraint', 'firm:require_reanchor_to_constraint', 'disengaging:require_direct_answer'],
    53: ['open:require_evidence_anchor', 'firm:require_reanchor_to_constraint', 'disengaging:require_reanchor_to_constraint', 'disengaging:require_direct_answer', 'disengaging:require_evidence_anchor'],
  },
});

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildStageDecisionMatrix() {
  const matrix = {};
  for (const scenario of SCENARIOS) {
    matrix[scenario.id] = {};

    for (const seed of SEED_MATRIX) {
      const rand = mulberry32(seed);
      let stage = 'open';
      let misalignmentCount = 0;
      let hardDemandMissCount = 0;
      let domainDriftCount = 0;
      const sequence = [];

      for (let turn = 1; turn <= 5; turn += 1) {
        const repMessage = MESSAGE_LIBRARY[Math.floor(rand() * MESSAGE_LIBRARY.length)];
        const domainStatus = rand() > 0.82 ? 'adjacent_but_recoverable' : 'in_domain';
        const alignmentScore = rand() > 0.55 ? 2.4 : 4.1;
        const evidenceCheckpointTriggered = rand() > 0.58;
        const unresolvedConstraintReanchor = scenario.constraint && rand() > 0.66;

        const profile = deriveHcpEnforcementProfile({
          scenario: { enforcementCriteria: {} },
          hcpProfile: {
            baselineCommunicationStyle: scenario.style,
            baselineOpennessResistance: scenario.state,
          },
          sceneSetup: { timePressure: scenario.time },
          hcpState: scenario.state,
          cueMeaning: scenario.cue,
          activeConcern: scenario.concern,
          hardDemandState: { hardDemandPriorityLock: scenario.constraint },
        });

        const escalation = deriveEscalationState({
          profile,
          priorEscalationStage: stage,
          priorMisalignmentCount: misalignmentCount,
          priorHardDemandMissCount: hardDemandMissCount,
          priorDomainDriftCount: domainDriftCount,
          alignment: { score: alignmentScore, misalignments: alignmentScore < 3 ? ['a', 'b'] : [] },
          concernFlowOutcome: alignmentScore < 3 ? 'missed' : 'aligned',
          repMessage,
          hardDemandState: {
            hardDemandPriorityLock: scenario.constraint,
            hardDemandUnresolved: alignmentScore < 3,
          },
          domainAssessment: { repDomainStatus: domainStatus, contextContamination: false },
        });

        const decision = decideInterventionAction({
          repeatedMissedCues: alignmentScore < 3 ? 2 : 0,
          repeatedLowAlignmentEvents: alignmentScore < 3 ? 2 : 0,
          evidenceCheckpointTriggered,
          unresolvedConstraintReanchor,
          directQuestionPending: true,
          cooldownTurnsRemaining: 0,
          escalationRisk: alignmentScore < 3 ? 'elevated' : 'low',
        });

        sequence.push(`${escalation.escalationStage}:${decision}`);
        stage = escalation.escalationStage;
        misalignmentCount = escalation.misalignmentCount;
        hardDemandMissCount = escalation.hardDemandMissCount;
        domainDriftCount = escalation.domainDriftCount;
      }

      matrix[scenario.id][seed] = sequence;
    }
  }
  return matrix;
}

test('golden snapshot: escalation stage + intervention decision matrix remains exact across seed matrix', () => {
  const matrix = buildStageDecisionMatrix();
  assert.deepEqual(matrix, GOLDEN_STAGE_DECISION_SNAPSHOT);
});

test('7-scenario smoke replay remains deterministic and contract-stable across repeated runs', () => {
  const runA = buildStageDecisionMatrix();
  const runB = buildStageDecisionMatrix();
  assert.deepEqual(runA, runB);
});
