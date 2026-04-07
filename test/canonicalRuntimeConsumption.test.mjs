import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeScenarioRuntimeContract,
  validateScenarioRuntimeContract,
} from '../src/lib/scenarioNormalization.js';
import { applyEscalationPresentation } from '../src/components/roleplay/hcpEnforcementEscalation.js';
import { buildHcpReactionContract } from '../src/components/roleplay/hcpReactionIntegrity.js';

test('normalizeScenarioRuntimeContract preserves canonical scene anchors and starting state', () => {
  const scenario = {
    scenarioIdentity: {
      scenarioId: 'canon_001',
      title: 'Canonical Runtime Scenario',
      therapeuticArea: 'oncology',
      topic: 'workflow adoption',
      difficulty: 'advanced',
      version: '2.0.0',
      status: 'active',
    },
    trainingIntent: {
      primaryCapabilityFocus: ['signal_awareness'],
      metricApplicability: {
        signal_awareness: 'active',
        objection_navigation: 'conditional_on_objection',
      },
    },
    hcpProfile: {
      name: 'Dr. Chen',
      role: 'Medical Oncologist',
      specialty: 'Oncology',
      careSetting: 'Academic infusion center',
      baselineCommunicationStyle: 'concise_analytical',
      baselineOpennessResistance: 'skeptical',
      knownConstraints: ['chair_time_pressure'],
    },
    sceneSetup: {
      openingEnvironment: 'Infusion suite between patient visits',
      timePressure: 'high',
      currentClinicalOperationalContext: 'ADC sequencing decisions with chair-time pressure',
      visitObjective: 'Test one operational adoption barrier',
      openingLine: 'Operational complexity is my immediate concern.',
      openingCueSet: ['glances_at_schedule', 'clipped_tone'],
    },
    hcpStateModel: {
      startingState: 'skeptical',
      allowedTransitions: {
        skeptical: [{ to: 'engaged', when: ['acknowledged_operational_concern'] }],
      },
      prohibitedTransitions: [],
    },
    feedbackContract: {
      allowedReferences: ['explicit_hcp_statement'],
      prohibitedReferences: ['inferred_intent'],
    },
  };

  const contract = normalizeScenarioRuntimeContract(scenario);
  const validation = validateScenarioRuntimeContract(scenario);

  assert.equal(contract.scenarioIdentity.scenarioId, 'canon_001');
  assert.equal(contract.sceneSetup.timePressure, 'high');
  assert.deepEqual(contract.sceneSetup.openingCueSet, ['glances_at_schedule', 'clipped_tone']);
  assert.equal(contract.sceneSetup.currentClinicalOperationalContext, 'ADC sequencing decisions with chair-time pressure');
  assert.equal(contract.hcpStateModel.startingState, 'skeptical');
  assert.equal(contract.metricApplicabilityMap.signal_awareness, 'always_applicable');
  assert.equal(contract.metricApplicabilityMap.objection_navigation, 'conditional_on_objection');
  assert.equal(validation.valid, true, validation.issues.join('; '));
});

test('validateScenarioRuntimeContract surfaces missing canonical scene anchors for legacy runtime inputs', () => {
  const validation = validateScenarioRuntimeContract({
    id: 'legacy_001',
    title: 'Legacy Scenario',
    context: 'Busy clinic',
    openingScene: 'We have a lot going on.',
  });

  assert.equal(validation.valid, false);
  assert.ok(validation.issues.includes('missing_scene_time_pressure_anchor'));
  assert.ok(validation.issues.includes('missing_scene_opening_cues'));
  assert.ok(validation.issues.includes('missing_hcp_communication_style'));
});

test('applyEscalationPresentation does not prepend generic directive templates on turn 1', () => {
  const openingDialogue = 'What evidence do you have that this changes practice for my patients this month?';
  const presentation = applyEscalationPresentation({
    cueText: 'Jennifer highlights screening fields on a form.',
    dialogueText: openingDialogue,
    escalationStage: 'focused',
    profile: { orientation: 'analytical', drivers: { hcpState: 'skeptical' } },
    activeConcern: 'evidence',
    turnNumber: 1,
    scenarioOpeningState: 'skeptical',
    hcpState: 'skeptical',
    scenarioId: 'scenario_opening_guardrail',
  });

  assert.equal(presentation.dialogueText, openingDialogue);
  assert.equal(presentation.cueText, 'Jennifer highlights screening fields on a form.');
});

test('buildHcpReactionContract keeps first-turn missed responses single-voice and uses canonical starting state', () => {
  const scenario = {
    id: 'turn1_guardrail',
    hcpProfile: {
      role: 'HCP',
      specialty: 'Oncology',
      careSetting: 'Clinic',
      baselineCommunicationStyle: 'concise_analytical',
      baselineOpennessResistance: 'skeptical',
      knownConstraints: ['time_pressure'],
    },
    sceneSetup: {
      timePressure: 'high',
      currentClinicalOperationalContext: 'Operational bottlenecks around biomarker testing',
      openingLine: 'Testing turnaround is my concern.',
      openingCueSet: ['checks_schedule'],
    },
    hcpStateModel: {
      startingState: 'skeptical',
      allowedTransitions: {},
      prohibitedTransitions: [],
    },
  };

  const contract = buildHcpReactionContract({
    scenario,
    turnNumber: 1,
    hcpState: 'neutral',
    cueText: 'Dr. Chen reviews the tracker and looks up.',
    dialogueText: 'That is interesting, but my biggest issue is testing turnaround in clinic, not outcomes.',
    activeConcern: 'workflow',
    alignment: { score: 1, misalignments: ['miss'], rubricAlignmentFlags: [] },
    concernFlowOutcome: 'missed',
    repMessage: "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.",
  });

  assert.equal(contract.activeHcpState, 'skeptical');
  assert.equal(
    contract.selectedDialogueText,
    'That is interesting, but my biggest issue is testing turnaround in clinic, not outcomes.'
  );
  assert.ok(!/I still need|Keep this focused on the immediate constraint/i.test(contract.selectedDialogueText));
});
