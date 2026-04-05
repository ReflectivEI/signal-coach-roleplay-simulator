import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildHcpReactionContract,
  enforceCueDialogueContractIntegrity,
  deterministicHash,
} from '../src/components/roleplay/hcpReactionIntegrity.js';
import { determinePreferredHcpDialogueRegister } from '../src/components/roleplay/operationalRealismEnforcer.js';
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
