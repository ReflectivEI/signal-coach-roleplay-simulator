import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildHcpReactionContract,
  enforceCueDialogueContractIntegrity,
  deterministicHash,
} from '../src/components/roleplay/hcpReactionIntegrity.js';
import { determinePreferredHcpDialogueRegister } from '../src/components/roleplay/operationalRealismEnforcer.js';
import {
  deriveHcpEnforcementProfile,
  deriveEscalationState,
  ESCALATION_STAGES,
} from '../src/components/roleplay/hcpEnforcementEscalation.js';
import { computeAlignment } from '../src/components/roleplay/alignmentEngine.jsx';

const BASE_SCORING_CONTEXT = {
  cueText: 'The HCP checks the clock and waits for one practical point.',
  hcpUtterance: 'What changes in my workflow this week?',
  selectedCueMeaning: 'time',
  selectedDialogueIntent: 'operational_constraint_resolution',
  selectedDialogueRegister: 'workflow_implementation',
};

test('cue/dialogue integrity layer repairs mismatched cue intent and abstract dialogue deterministically', () => {
  const result = enforceCueDialogueContractIntegrity({
    cueText: 'The HCP leans in with strong engagement and relaxed curiosity.',
    dialogueText: 'How does this align with the conceptual evidence base?',
    hcpState: 'time-pressured',
    selectedRegister: 'workflow_implementation',
    activeConcern: 'workflow',
    rebuildCue: () => 'The HCP checks the schedule and asks for one practical step in clinic flow.',
    rewriteDialogue: () => 'What is one workflow step we can implement this week without adding staff burden?',
  });

  assert.equal(result.alignmentStatus, 'repaired');
  assert.ok(result.repairs.includes('dialogue_rewritten_for_register_alignment'));
  assert.ok(result.repairs.length >= 1);
  assert.match(result.dialogueText, /workflow|step|week|staff/i);
});

test('reaction contract includes deterministic trace fields and stable hashes', () => {
  const payload = {
    scenario: { id: 'workflow_scenario' },
    turnNumber: 3,
    hcpState: 'time-pressured',
    cueText: 'The HCP checks the clock and asks for one practical point.',
    dialogueText: 'What do I do differently in a 10-minute visit?',
    dialogueRegister: 'resource_constraint',
    hardDemandState: { hardDemandPriorityLock: true, hardDemandUnresolved: true, activeHardDemand: 'operational_fit' },
    activeConcern: 'time',
    timePressureState: true,
    coachingResult: { shouldShow: true, label: 'Adaptive pacing', severity: 'medium' },
    alignment: { rubricAlignmentFlags: ['Response did not adapt to the HCP\'s latest cue.'] },
    scoringContext: BASE_SCORING_CONTEXT,
  };

  const a = buildHcpReactionContract(payload);
  const b = buildHcpReactionContract(payload);

  assert.equal(a.reactionContractHash, b.reactionContractHash);
  assert.equal(a.repEvidenceContextHash, b.repEvidenceContextHash);
  assert.equal(a.activeScenarioId, 'workflow_scenario');
  assert.equal(a.selectedDialogueRegister, 'resource_constraint');
  assert.equal(a.coachingTriggerInputs.shouldShow, true);
  assert.equal(a.hardDemandState.hardDemandPriorityLock, true);
});

test('register/state consistency: operational, analytical, and patient-selection contexts resolve deterministically', () => {
  const contexts = [
    {
      input: {
        scenario: {
          hcpProfile: { role: 'Community NP', specialty: 'Primary care', careSetting: 'Busy clinic', baselineCommunicationStyle: 'practical', knownConstraints: ['time pressure'] },
          sceneSetup: { timePressure: 'high', currentClinicalOperationalContext: 'workflow bottlenecks' },
        },
        runtimeState: { activeHcpState: 'impatient' },
        cueText: 'HCP checks watch and asks for one practical workflow step.',
        hcpUtterance: 'What changes this week in clinic flow?',
        activeConcern: 'workflow',
      },
      expected: ['resource_constraint', 'workflow_implementation'],
    },
    {
      input: {
        scenario: {
          hcpProfile: { role: 'Academic investigator', specialty: 'ID', careSetting: 'Academic center', baselineCommunicationStyle: 'evidence review', knownConstraints: ['protocol evidence threshold'] },
          sceneSetup: { timePressure: 'low', currentClinicalOperationalContext: 'formal trial review' },
        },
        runtimeState: { activeHcpState: 'neutral' },
        cueText: 'HCP asks for subgroup evidence details.',
        hcpUtterance: 'Which trial signal should drive protocol change?',
        activeConcern: 'evidence',
      },
      expected: ['academic_analytical', 'evidence_interrogation'],
    },
    {
      input: {
        scenario: {
          hcpProfile: { role: 'Oncology PA', specialty: 'Oncology', careSetting: 'Community oncology', baselineCommunicationStyle: 'practical', knownConstraints: ['candidate identification'] },
          sceneSetup: { timePressure: 'moderate', currentClinicalOperationalContext: 'candidacy triage pressure' },
        },
        runtimeState: { activeHcpState: 'engaged' },
        cueText: 'HCP asks how to identify missing eligible patients.',
        hcpUtterance: 'How do I identify the right patients quickly?',
        activeConcern: 'screening',
      },
      expected: ['patient_selection_practical'],
    },
  ];

  for (const fixture of contexts) {
    const a = determinePreferredHcpDialogueRegister(fixture.input);
    const b = determinePreferredHcpDialogueRegister(fixture.input);
    assert.equal(a.preferredRegister, b.preferredRegister);
    assert.ok(fixture.expected.includes(a.preferredRegister));
  }
});

test('scoring-context coherence hash changes when visible cue/dialogue context changes', () => {
  const base = buildHcpReactionContract({
    scenario: { id: 'coherence_scenario' },
    cueText: 'The HCP checks the clock.',
    dialogueText: 'What is one step this week?',
    activeConcern: 'time',
    scoringContext: BASE_SCORING_CONTEXT,
  });

  const drifted = buildHcpReactionContract({
    scenario: { id: 'coherence_scenario' },
    cueText: 'The HCP looks relaxed and open-ended.',
    dialogueText: 'How does this align conceptually?',
    activeConcern: 'evidence',
    scoringContext: {
      ...BASE_SCORING_CONTEXT,
      cueText: 'The HCP looks relaxed and open-ended.',
      hcpUtterance: 'How does this align conceptually?',
    },
  });

  assert.notEqual(base.repEvidenceContextHash, drifted.repEvidenceContextHash);
  assert.notEqual(base.reactionContractHash, drifted.reactionContractHash);
});

test('replay determinism: identical simulator-side inputs produce identical reaction hash', () => {
  const input = {
    scenario: { id: 'replay_case' },
    turnNumber: 5,
    hcpState: 'resistant',
    cueText: 'The HCP folds arms and asks for one practical next step.',
    dialogueText: 'What is one workflow change that my team can start this week?',
    dialogueRegister: 'workflow_implementation',
    activeConcern: 'workflow',
    coachingResult: { shouldShow: false },
    alignment: { rubricAlignmentFlags: [] },
    scoringContext: BASE_SCORING_CONTEXT,
  };

  const first = buildHcpReactionContract(input);
  const second = buildHcpReactionContract(input);
  assert.equal(first.reactionContractHash, second.reactionContractHash);
  assert.equal(first.selectedCueId, second.selectedCueId);
});

test('live golden reaction matrix keeps aligned rep >= misaligned rep while preserving contract trace expectations', () => {
  const matrix = [
    {
      id: 'workflow_operational',
      cue: 'The HCP glances at schedule pressure and asks for one practical step.',
      hcp: 'What changes in my workflow this week?',
      alignedRep: 'Start one front-desk routing checklist this week and track same-day completion.',
      misalignedRep: 'The conceptual evidence base is compelling.',
      expectedCueMeaning: 'time',
      expectedRegister: 'workflow_implementation',
    },
    {
      id: 'analytical_evidence',
      cue: 'The HCP requests evidence details before protocol changes.',
      hcp: 'Which evidence detail should drive this decision?',
      alignedRep: 'Primary endpoint and subgroup consistency support protocol fit with clear limitations.',
      misalignedRep: 'Trust me, this is easy operationally.',
      expectedCueMeaning: 'neutral',
      expectedRegister: 'academic_analytical',
    },
    {
      id: 'patient_selection_mixed',
      cue: 'The HCP asks how to identify the right patients in clinic flow.',
      hcp: 'How would I identify appropriate patients this month?',
      alignedRep: 'Use one candidacy triage rule at intake to flag likely patients before visit close.',
      misalignedRep: 'Study methods were conceptually robust.',
      expectedCueMeaning: 'neutral',
      expectedRegister: 'patient_selection_practical',
    },
  ];

  for (const row of matrix) {
    const alignedScore = computeAlignment('engaged', row.alignedRep, { cueText: row.cue, hcpUtterance: row.hcp }, 'neutral', 'engaged').score;
    const misalignedScore = computeAlignment('engaged', row.misalignedRep, { cueText: row.cue, hcpUtterance: row.hcp }, 'neutral', 'engaged').score;

    const contract = buildHcpReactionContract({
      scenario: { id: row.id },
      cueText: row.cue,
      cueMeaning: row.expectedCueMeaning,
      dialogueText: row.hcp,
      dialogueRegister: row.expectedRegister,
      activeConcern: row.expectedRegister.includes('patient') ? 'screening' : row.expectedRegister.includes('academic') ? 'evidence' : 'workflow',
      coachingResult: { shouldShow: misalignedScore < alignedScore, label: 'Signal-response alignment' },
      alignment: { rubricAlignmentFlags: misalignedScore < alignedScore ? ['misaligned_rep_response'] : [] },
      scoringContext: BASE_SCORING_CONTEXT,
    });

    assert.ok(alignedScore >= misalignedScore, `${row.id}: aligned rep should not underperform misaligned rep`);
    assert.equal(contract.selectedDialogueRegister, row.expectedRegister);
    assert.equal(typeof contract.reactionContractHash, 'string');
    assert.ok(contract.coachingTriggerInputs.triggerSet.length >= 0);
  }
});

test('non-regression: computeAlignment metric IDs and output shape remain unchanged', () => {
  const result = computeAlignment('neutral', 'One practical workflow step this week: use an intake checklist.', { hcpUtterance: 'What changes this week?' }, 'neutral', 'neutral');
  assert.ok(result && typeof result === 'object');
  assert.equal(typeof result.score, 'number');
  assert.ok(result.metrics && typeof result.metrics === 'object');
  assert.ok(Object.prototype.hasOwnProperty.call(result.metrics, 'adaptive_response'));
  assert.equal(typeof deterministicHash('stable'), 'string');
});


test('enforcement profile derivation is deterministic and context-sensitive across scenario/HCP archetypes', () => {
  const operational = deriveHcpEnforcementProfile({
    scenario: {
      sceneSetup: { timePressure: 'high', currentClinicalOperationalContext: 'clinic throughput stress' },
      enforcementCriteria: { baselineForgiveness: 0.35, baselineEscalationSensitivity: 0.7, baselineWorkflowStrictness: 0.8 },
    },
    hcpProfile: {
      role: 'NP', specialty: 'Primary Care', careSetting: 'Busy clinic',
      baselineCommunicationStyle: 'practical operational', baselineOpennessResistance: 'skeptical', knownConstraints: ['time pressure'],
    },
    hcpState: 'impatient',
    cueMeaning: 'time',
    activeConcern: 'workflow',
    hardDemandState: { hardDemandPriorityLock: true },
  });

  const receptiveAnalytical = deriveHcpEnforcementProfile({
    scenario: {
      sceneSetup: { timePressure: 'low', currentClinicalOperationalContext: 'journal club style review' },
      enforcementCriteria: { baselineForgiveness: 0.7, baselineEscalationSensitivity: 0.35, baselineEvidenceStrictness: 0.75 },
    },
    hcpProfile: {
      role: 'Academic investigator', specialty: 'ID', careSetting: 'Academic center',
      baselineCommunicationStyle: 'analytical collaborative', baselineOpennessResistance: 'receptive', knownConstraints: ['evidence standard'],
    },
    hcpState: 'engaged',
    cueMeaning: 'neutral',
    activeConcern: 'evidence',
  });

  assert.equal(operational.orientation, 'operational');
  assert.equal(receptiveAnalytical.orientation, 'analytical');
  assert.ok(operational.tonePressureLevel > receptiveAnalytical.tonePressureLevel);
  assert.ok(operational.toleranceScore < receptiveAnalytical.toleranceScore);
});

test('escalation stage progression is deterministic with repeated misalignment and supports recovery', () => {
  const profile = deriveHcpEnforcementProfile({
    scenario: { sceneSetup: { timePressure: 'high' }, enforcementCriteria: { baselineEscalationSensitivity: 0.75 } },
    hcpProfile: { baselineCommunicationStyle: 'operational', baselineOpennessResistance: 'skeptical' },
    hcpState: 'impatient',
    activeConcern: 'workflow',
    cueMeaning: 'time',
  });

  const miss1 = deriveEscalationState({
    profile,
    priorEscalationStage: 'open',
    alignment: { score: 1, misalignments: ['miss'], rubricAlignmentFlags: ['cue_miss'] },
    concernFlowOutcome: 'missed',
    repMessage: 'Great point.',
    hardDemandState: { hardDemandPriorityLock: true, hardDemandUnresolved: true },
  });
  const miss2 = deriveEscalationState({
    profile,
    priorEscalationStage: miss1.escalationStage,
    priorMisalignmentCount: miss1.misalignmentCount,
    priorHardDemandMissCount: miss1.hardDemandMissCount,
    alignment: { score: 1, misalignments: ['miss'], rubricAlignmentFlags: ['cue_miss'] },
    concernFlowOutcome: 'missed',
    repMessage: 'Still broad response.',
    hardDemandState: { hardDemandPriorityLock: true, hardDemandUnresolved: true },
  });
  const recovery = deriveEscalationState({
    profile,
    priorEscalationStage: miss2.escalationStage,
    priorMisalignmentCount: miss2.misalignmentCount,
    priorHardDemandMissCount: miss2.hardDemandMissCount,
    alignment: { score: 4, misalignments: [], rubricAlignmentFlags: [] },
    concernFlowOutcome: 'aligned',
    repMessage: 'One exact workflow step with owner and timing.',
    hardDemandState: { hardDemandPriorityLock: false, hardDemandUnresolved: false },
  });

  assert.ok(ESCALATION_STAGES.indexOf(miss2.escalationStage) >= ESCALATION_STAGES.indexOf(miss1.escalationStage));
  assert.ok(miss2.hardDemandMissCount >= miss1.hardDemandMissCount);
  assert.ok(ESCALATION_STAGES.indexOf(recovery.escalationStage) <= ESCALATION_STAGES.indexOf(miss2.escalationStage));
  assert.ok(recovery.repAdequacyScore > miss2.repAdequacyScore);
});

test('reaction contract binds escalation to cue/body-language/dialogue/coaching/scoring context coherently', () => {
  const priorTrace = {
    escalationStage: 'focused',
    misalignmentCount: 1,
    hardDemandMissCount: 1,
  };
  const contract = buildHcpReactionContract({
    scenario: {
      id: 'matrix_operational',
      hcpProfile: { baselineCommunicationStyle: 'operational', baselineOpennessResistance: 'skeptical', knownConstraints: ['workflow'] },
      sceneSetup: { timePressure: 'high', currentClinicalOperationalContext: 'busy clinic' },
      enforcementCriteria: { baselineEscalationSensitivity: 0.8, baselineWorkflowStrictness: 0.8, baselineForgiveness: 0.3 },
    },
    turnNumber: 4,
    hcpState: 'impatient',
    cueText: 'The HCP checks the clock.',
    dialogueText: 'What is one practical change this week?',
    dialogueRegister: 'workflow_implementation',
    activeConcern: 'workflow',
    coachingResult: { shouldShow: true, label: 'Address demand directly', severity: 'high' },
    alignment: { score: 1, misalignments: ['topic drift'], rubricAlignmentFlags: ['cue_miss'] },
    concernFlowOutcome: 'missed',
    repMessage: 'General comment only.',
    hardDemandState: { hardDemandPriorityLock: true, hardDemandUnresolved: true, activeHardDemand: 'operational_fit' },
    priorEnforcementTrace: priorTrace,
    scoringContext: BASE_SCORING_CONTEXT,
  });

  assert.ok(ESCALATION_STAGES.includes(contract.enforcementTrace.escalationStage));
  assert.ok(contract.selectedCueText.length >= 'The HCP checks the clock.'.length);
  assert.ok(contract.selectedDialogueText.length >= 'What is one practical change this week?'.length);
  assert.equal(contract.coachingTriggerInputs.shouldShow, true);
  assert.equal(contract.scoringContext.escalationStage, contract.enforcementTrace.escalationStage);
});

test('live-path scenario matrix validates context-sensitive escalation style across three archetypes', () => {
  const scenarios = [
    {
      id: 'time_pressured_operational',
      scenario: {
        hcpProfile: { baselineCommunicationStyle: 'operational practical', baselineOpennessResistance: 'skeptical', careSetting: 'busy clinic', knownConstraints: ['staffing'] },
        sceneSetup: { timePressure: 'high', currentClinicalOperationalContext: 'throughput' },
        enforcementCriteria: { baselineForgiveness: 0.3, baselineWorkflowStrictness: 0.85, baselineEscalationSensitivity: 0.8 },
      },
      concern: 'workflow',
      expectedOrientation: 'operational',
    },
    {
      id: 'analytical_evidence_driven',
      scenario: {
        hcpProfile: { baselineCommunicationStyle: 'analytical evidence review', baselineOpennessResistance: 'neutral', careSetting: 'academic center', knownConstraints: ['evidence standards'] },
        sceneSetup: { timePressure: 'low', currentClinicalOperationalContext: 'evidence committee' },
        enforcementCriteria: { baselineForgiveness: 0.62, baselineEvidenceStrictness: 0.85, baselineEscalationSensitivity: 0.45 },
      },
      concern: 'evidence',
      expectedOrientation: 'analytical',
    },
    {
      id: 'mixed_patient_selection',
      scenario: {
        hcpProfile: { baselineCommunicationStyle: 'practical collaborative', baselineOpennessResistance: 'engaged', careSetting: 'community oncology', knownConstraints: ['candidate triage'] },
        sceneSetup: { timePressure: 'medium', currentClinicalOperationalContext: 'candidacy triage' },
        enforcementCriteria: { baselineForgiveness: 0.55, baselinePrecisionDemand: 0.72, baselineEscalationSensitivity: 0.52 },
      },
      concern: 'patient_selection',
      expectedOrientation: 'patient_selection',
    },
  ];

  for (const row of scenarios) {
    const aligned = buildHcpReactionContract({
      scenario: { id: row.id, ...row.scenario },
      cueText: 'The HCP asks a focused question.',
      dialogueText: 'Please answer the active question directly.',
      activeConcern: row.concern,
      alignment: { score: 4, misalignments: [], rubricAlignmentFlags: [] },
      concernFlowOutcome: 'aligned',
      repMessage: 'Direct answer with specifics.',
    });

    const mildMiss = buildHcpReactionContract({
      scenario: { id: row.id, ...row.scenario },
      cueText: aligned.selectedCueText,
      dialogueText: aligned.selectedDialogueText,
      activeConcern: row.concern,
      alignment: { score: 2, misalignments: ['mild drift'], rubricAlignmentFlags: [] },
      concernFlowOutcome: 'overpivot',
      repMessage: 'Partially relevant answer.',
      priorEnforcementTrace: aligned.enforcementTrace,
      hardDemandState: { hardDemandPriorityLock: true, hardDemandUnresolved: true, activeHardDemand: 'active_constraint' },
    });

    const repeatedMiss = buildHcpReactionContract({
      scenario: { id: row.id, ...row.scenario },
      cueText: mildMiss.selectedCueText,
      dialogueText: mildMiss.selectedDialogueText,
      activeConcern: row.concern,
      alignment: { score: 1, misalignments: ['drift', 'cue miss'], rubricAlignmentFlags: ['cue_miss'] },
      concernFlowOutcome: 'missed',
      repMessage: 'Generic tangent response only.',
      priorEnforcementTrace: mildMiss.enforcementTrace,
      hardDemandState: { hardDemandPriorityLock: true, hardDemandUnresolved: true, activeHardDemand: 'active_constraint' },
    });

    const openIdx = ESCALATION_STAGES.indexOf(aligned.enforcementTrace.escalationStage);
    const mildIdx = ESCALATION_STAGES.indexOf(mildMiss.enforcementTrace.escalationStage);
    const repeatIdx = ESCALATION_STAGES.indexOf(repeatedMiss.enforcementTrace.escalationStage);

    assert.equal(aligned.enforcementTrace.hcpEnforcementProfile.orientation, row.expectedOrientation);
    assert.ok(mildIdx >= openIdx);
    assert.ok(repeatIdx >= mildIdx);
    assert.ok(repeatedMiss.selectedDialogueText.length >= mildMiss.selectedDialogueText.length);
  }
});

test('opening exchange remains deterministic but persona/scenario-aware for identical rep opener', () => {
  const repOpener = 'Hi Dr, can we discuss the JAMA study I dropped off last week?';
  const scenarios = [
    {
      id: 'opening_time_pressed',
      scenario: {
        hcpProfile: { baselineCommunicationStyle: 'practical', baselineOpennessResistance: 'neutral' },
        sceneSetup: { timePressure: 'high' },
      },
      hcpState: 'impatient',
      activeConcern: 'workflow',
      expected: /minute|key takeaway|single|briefly|prioritize/i,
    },
    {
      id: 'opening_engaged',
      scenario: {
        hcpProfile: { baselineCommunicationStyle: 'collaborative', baselineOpennessResistance: 'receptive' },
        sceneSetup: { timePressure: 'low' },
      },
      hcpState: 'engaged',
      activeConcern: 'evidence',
      expected: /reviewed part|stood out/i,
    },
    {
      id: 'opening_skeptical',
      scenario: {
        hcpProfile: { baselineCommunicationStyle: 'analytical', baselineOpennessResistance: 'skeptical' },
        sceneSetup: { timePressure: 'medium' },
      },
      hcpState: 'skeptical',
      activeConcern: 'evidence',
      expected: /many studies|different|concrete reason|anchor/i,
    },
    {
      id: 'opening_workflow',
      scenario: {
        hcpProfile: { baselineCommunicationStyle: 'operational practical', baselineOpennessResistance: 'neutral' },
        sceneSetup: { timePressure: 'medium' },
      },
      hcpState: 'neutral',
      activeConcern: 'workflow',
      expected: /workflow step|team can use this week|implementation|changes tomorrow/i,
    },
  ];

  const outputs = scenarios.map((fixture) => buildHcpReactionContract({
    scenario: { id: fixture.id, ...fixture.scenario },
    turnNumber: 1,
    hcpState: fixture.hcpState,
    cueText: '',
    dialogueText: '',
    activeConcern: fixture.activeConcern,
    repMessage: repOpener,
    alignment: { score: 1, misalignments: ['initial_drift'], rubricAlignmentFlags: ['cue_miss'] },
    concernFlowOutcome: 'missed',
    hardDemandState: { hardDemandPriorityLock: true, hardDemandUnresolved: true, activeHardDemand: 'operational_fit' },
  }));

  for (let i = 0; i < outputs.length; i += 1) {
    assert.match(outputs[i].selectedDialogueText.toLowerCase(), scenarios[i].expected);
    assert.ok(!/one exact operational answer|pause here/i.test(outputs[i].selectedDialogueText));
    assert.ok(['open', 'focused'].includes(outputs[i].enforcementTrace.escalationStage));
  }

  const uniqueOutputs = new Set(outputs.map((row) => row.selectedDialogueText.toLowerCase()));
  assert.equal(uniqueOutputs.size, outputs.length);
});

test('opening guardrail enforces stage-based turn-1 safety unless scenario explicitly sets high pressure', () => {
  const guardedDefault = buildHcpReactionContract({
    scenario: { id: 'opening_guardrail_default' },
    turnNumber: 1,
    hcpState: 'neutral',
    cueText: 'The HCP asks for one concise point.',
    dialogueText: 'I can keep going if you make this about one practical workflow step.',
    activeConcern: 'workflow',
    repMessage: 'Can we discuss the practical implementation?',
    priorEnforcementTrace: { escalationStage: 'high_pressure' },
  });
  assert.ok(['open', 'focused'].includes(guardedDefault.enforcementTrace.escalationStage));

  const allowedInExplicitHighPressure = buildHcpReactionContract({
    scenario: { id: 'opening_guardrail_exception', openingState: 'high_pressure' },
    turnNumber: 1,
    hcpState: 'neutral',
    cueText: 'The HCP asks for one concise point.',
    dialogueText: 'I can keep going if you make this about one practical workflow step.',
    activeConcern: 'workflow',
    repMessage: 'Can we discuss the practical implementation?',
    priorEnforcementTrace: { escalationStage: 'high_pressure' },
  });
  assert.ok(['high_pressure', 'disengaging', 'firm', 'narrowed', 'focused', 'open'].includes(allowedInExplicitHighPressure.enforcementTrace.escalationStage));
  assert.match(allowedInExplicitHighPressure.selectedDialogueText, /practical workflow step/i);
});

test('turn-1 state gating is topic-agnostic and never emits hard-demand escalation for generic opener', () => {
  const openers = [
    'Can we talk about your clinic throughput workflow?',
    'Can we discuss last week\'s publication?',
    'Could we review patient onboarding blockers?',
  ];

  const outputs = openers.map((repMessage, idx) => buildHcpReactionContract({
    scenario: {
      id: `topic_agnostic_${idx}`,
      hcpProfile: { baselineCommunicationStyle: 'operational practical', baselineOpennessResistance: 'skeptical' },
      sceneSetup: { timePressure: 'high' },
    },
    turnNumber: 1,
    hcpState: 'hard_demand',
    cueText: '',
    dialogueText: '',
    activeConcern: idx === 1 ? 'evidence' : 'workflow',
    repMessage,
    alignment: { score: 1, misalignments: ['opening_miss'], rubricAlignmentFlags: ['cue_miss'] },
    concernFlowOutcome: 'missed',
    hardDemandState: { hardDemandPriorityLock: true, hardDemandUnresolved: true, activeHardDemand: 'operational_fit' },
  }));

  for (const contract of outputs) {
    assert.ok(['open', 'focused'].includes(contract.enforcementTrace.escalationStage));
    assert.ok(!/or we should pause here|do this now or|now or we stop/i.test(contract.selectedDialogueText));
    assert.notEqual(contract.activeHcpState, 'hard_demand');
  }
});

test('realism calibration layer preserves friction, cue variation, and professional tone across multi-turn behaviors', () => {
  const scenario = {
    id: 'realism_calibration_matrix',
    openingScene: 'The HCP is reviewing prior-auth paperwork while running behind clinic schedule.',
    sceneSetup: { timePressure: 'high' },
    hcpProfile: {
      baselineCommunicationStyle: 'practical skeptical',
      baselineOpennessResistance: 'skeptical',
      knownConstraints: ['prior auth burden', 'staffing constraints'],
    },
  };

  const turn1 = buildHcpReactionContract({
    scenario,
    turnNumber: 1,
    hcpState: 'time-pressured skeptical',
    cueText: '',
    dialogueText: 'Can we discuss the new data package?',
    activeConcern: 'workflow',
    repMessage: 'The efficacy results were strong overall.',
    alignment: { score: 1, misalignments: ['missed_workflow'], rubricAlignmentFlags: ['cue_miss'] },
    concernFlowOutcome: 'missed',
  });
  assert.match(turn1.selectedDialogueText.toLowerCase(), /workflow|operational|practical|still need/);
  assert.match(turn1.selectedCueText.toLowerCase(), /chart|schedule|forms|workflow|paperwork|multitask/);

  const turn2 = buildHcpReactionContract({
    scenario,
    turnNumber: 2,
    hcpState: 'time-pressured skeptical',
    cueText: '',
    dialogueText: 'That is better, but I still need specifics.',
    activeConcern: 'workflow',
    repMessage: 'We can route PAs to one owner and review weekly backlog.',
    alignment: { score: 3, misalignments: [], rubricAlignmentFlags: [] },
    concernFlowOutcome: 'aligned',
    priorEnforcementTrace: turn1.enforcementTrace,
  });
  assert.ok(turn2.selectedDialogueText.length > 0);
  assert.notEqual(turn2.enforcementTrace.cueSignature, turn1.enforcementTrace.cueSignature);

  const turn3 = buildHcpReactionContract({
    scenario,
    turnNumber: 3,
    hcpState: 'skeptical',
    cueText: '',
    dialogueText: 'Can this apply in our clinic constraints?',
    activeConcern: 'workflow',
    repMessage: 'Great point, this should work generally.',
    alignment: { score: 1, misalignments: ['generic'], rubricAlignmentFlags: ['cue_miss'] },
    concernFlowOutcome: 'overpivot',
    priorEnforcementTrace: turn2.enforcementTrace,
  });
  assert.equal(turn3.enforcementTrace.tooIdealFlag, true);
  assert.match(turn3.selectedDialogueText.toLowerCase(), /still need|before we move|before we continue/);
  assert.ok(!/\b(hostile|ridiculous|nonsense|waste of time)\b/i.test(turn3.selectedDialogueText));
});


test('domain integrity hook keeps in-domain and adjacent responses distinct from true contamination', () => {
  const scenario = {
    id: 'domain_matrix',
    domainIntegrity: {
      primaryScenarioDomain: 'oncology',
      allowedDomains: ['oncology', 'operational_workflow', 'patient_selection'],
      allowedContextFamilies: ['operational_workflow', 'evidence_review', 'patient_selection'],
      disallowedCrossDomainFamilies: ['hiv', 'cardiology'],
    },
    sceneSetup: { timePressure: 'medium' },
    hcpProfile: { baselineCommunicationStyle: 'operational', baselineOpennessResistance: 'skeptical', knownConstraints: ['staffing'] },
  };

  const inDomain = buildHcpReactionContract({
    scenario,
    activeConcern: 'workflow',
    cueText: 'The HCP asks about staffing impact.',
    dialogueText: 'How does this affect oncology infusion staffing?',
    repMessage: 'In oncology infusion, we can rebalance nurse assignment by visit blocks this week.',
    alignment: { score: 3, misalignments: [], rubricAlignmentFlags: [] },
  });

  const adjacent = buildHcpReactionContract({
    scenario,
    activeConcern: 'workflow',
    cueText: 'The HCP asks for one practical step.',
    dialogueText: 'What is one practical operational step?',
    repMessage: 'Use a workflow checklist with an owner and weekly cadence to prevent backlog.',
    alignment: { score: 2, misalignments: ['incomplete'], rubricAlignmentFlags: [] },
  });

  const crossDomain = buildHcpReactionContract({
    scenario,
    activeConcern: 'workflow',
    cueText: 'The HCP asks about infusion staffing.',
    dialogueText: 'How do we handle oncology staffing constraints?',
    repMessage: 'For HIV cabotegravir screening, I would prioritize resistance profiling first.',
    alignment: { score: 1, misalignments: ['topic drift'], rubricAlignmentFlags: ['cue_miss'] },
    concernFlowOutcome: 'missed',
  });

  assert.equal(inDomain.enforcementTrace.repDomainStatus, 'in_domain');
  assert.equal(inDomain.enforcementTrace.contextContamination, false);
  assert.ok(['adjacent_but_recoverable', 'in_domain'].includes(adjacent.enforcementTrace.repDomainStatus));
  assert.equal(crossDomain.enforcementTrace.repDomainStatus, 'cross_domain_contamination');
  assert.equal(crossDomain.enforcementTrace.contextContamination, true);
  assert.equal(crossDomain.enforcementTrace.scenarioReanchorRequired, true);
});

test('cross-domain contamination deterministically increases pressure and forces HCP re-anchor dialogue', () => {
  const scenario = {
    id: 'domain_reanchor',
    domainIntegrity: {
      primaryScenarioDomain: 'oncology',
      allowedDomains: ['oncology', 'operational_workflow'],
      allowedContextFamilies: ['operational_workflow', 'evidence_review'],
      disallowedCrossDomainFamilies: ['hiv', 'vaccines'],
    },
    sceneSetup: { timePressure: 'high' },
    hcpProfile: { baselineCommunicationStyle: 'operational', baselineOpennessResistance: 'skeptical', knownConstraints: ['throughput'] },
    enforcementCriteria: { baselineEscalationSensitivity: 0.8, baselineForgiveness: 0.3 },
  };

  const baseline = buildHcpReactionContract({
    scenario,
    activeConcern: 'workflow',
    cueText: 'The HCP asks one workflow question.',
    dialogueText: 'What changes in oncology workflow this week?',
    repMessage: 'One staffing huddle plus intake triage for oncology infusion visits.',
    alignment: { score: 3, misalignments: [], rubricAlignmentFlags: [] },
  });

  const contaminated = buildHcpReactionContract({
    scenario,
    activeConcern: 'workflow',
    cueText: 'The HCP asks one workflow question.',
    dialogueText: 'What changes in oncology workflow this week?',
    repMessage: 'For HIV PrEP screening, we should prioritize lab sequencing.',
    alignment: { score: 1, misalignments: ['topic drift'], rubricAlignmentFlags: ['cue_miss'] },
    concernFlowOutcome: 'missed',
    priorEnforcementTrace: baseline.enforcementTrace,
  });

  assert.equal(contaminated.enforcementTrace.contextContamination, true);
  assert.ok(contaminated.enforcementTrace.tonePressureLevel >= baseline.enforcementTrace.tonePressureLevel);
  assert.ok(contaminated.enforcementTrace.forgivenessSlack <= baseline.enforcementTrace.forgivenessSlack);
  assert.match(contaminated.selectedDialogueText.toLowerCase(), /outside the oncology context|let's stay on workflow/);
  assert.equal(contaminated.scoringContext.contextContamination, true);
});

test('greeting-only first turn remains open and scenario-aware across scenarios', () => {
  const scenarioA = {
    id: 'greeting_opening_workflow',
    sceneSetup: { timePressure: 'high' },
    hcpProfile: { baselineCommunicationStyle: 'operational practical', baselineOpennessResistance: 'skeptical' },
  };
  const scenarioB = {
    id: 'greeting_opening_evidence',
    sceneSetup: { timePressure: 'low' },
    hcpProfile: { baselineCommunicationStyle: 'analytical', baselineOpennessResistance: 'neutral' },
  };

  const responseA = buildHcpReactionContract({
    scenario: scenarioA,
    turnNumber: 1,
    hcpState: 'time-pressured skeptical',
    cueText: '',
    dialogueText: "I'm fine, thanks, but I'd appreciate it if we could keep this brief.",
    activeConcern: 'workflow',
    repMessage: 'Hi, how are you?',
    alignment: { score: 1, misalignments: ['greeting_only'] },
    concernFlowOutcome: 'missed',
  });

  const responseB = buildHcpReactionContract({
    scenario: scenarioB,
    turnNumber: 1,
    hcpState: 'engaged',
    cueText: '',
    dialogueText: "I'm fine, thanks, but I'd appreciate it if we could keep this brief.",
    activeConcern: 'evidence',
    repMessage: 'Hi, how are you?',
    alignment: { score: 1, misalignments: ['greeting_only'] },
    concernFlowOutcome: 'missed',
  });

  assert.equal(responseA.enforcementTrace.escalationStage, 'open');
  assert.equal(responseB.enforcementTrace.escalationStage, 'open');
  assert.notEqual(responseA.selectedDialogueText, responseB.selectedDialogueText);
  assert.doesNotMatch(responseA.selectedDialogueText.toLowerCase(), /please anchor this to a specific evidence detail/);
  assert.doesNotMatch(responseB.selectedDialogueText.toLowerCase(), /please anchor this to a specific evidence detail/);
});
