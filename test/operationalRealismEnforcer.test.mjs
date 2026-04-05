import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RESPONSE_REGISTERS,
  determinePreferredHcpDialogueRegister,
  enforceOperationalRealismPreference,
} from '../src/components/roleplay/operationalRealismEnforcer.js';
import { computeAlignment } from '../src/components/roleplay/alignmentEngine.jsx';

const ACADEMIC_LINE = 'How does this align with the study findings and the conceptual evidence base?';

test('operational realism preference rewrites academic phrasing in workflow-constrained time-pressured clinic context', () => {
  const scenario = {
    hcpProfile: {
      role: 'Nurse practitioner',
      specialty: 'Primary care',
      careSetting: 'Busy outpatient clinic',
      baselineCommunicationStyle: 'Direct and practical',
      knownConstraints: ['short staffed', 'limited visit time', 'workflow burden'],
    },
    sceneSetup: {
      timePressure: '10-minute visits and full waiting room',
      currentClinicalOperationalContext: 'Clinic team is overloaded and needs practical implementation steps now',
    },
  };

  const selected = determinePreferredHcpDialogueRegister({
    scenario,
    runtimeState: { activeHcpState: 'time-pressured', startingState: 'constrained' },
    cueText: 'HCP glances at the schedule and asks for one practical workflow step.',
    hcpUtterance: 'What changes in my workflow this week?',
    activeConcern: 'workflow',
  });

  assert.ok(['workflow_implementation', 'resource_constraint', 'operational_clinical'].includes(selected.preferredRegister));

  const enforced = enforceOperationalRealismPreference({
    dialogue: ACADEMIC_LINE,
    preferredRegister: selected.preferredRegister,
    activeConcern: 'workflow',
    flags: selected.flags,
  });

  assert.equal(enforced.applied, true);
  assert.match(enforced.dialogue, /workflow|step|week|practice|visit|time|staff/i);
  assert.doesNotMatch(enforced.dialogue, /conceptual evidence base/i);
});

test('register selection differentiates operational, patient-selection, and academic evidence contexts deterministically', () => {
  const contexts = [
    {
      label: 'workflow clinic pressure',
      input: {
        scenario: {
          hcpProfile: { role: 'PA', specialty: 'Community cardiology', careSetting: 'Community clinic', baselineCommunicationStyle: 'concise', knownConstraints: ['staff bandwidth'] },
          sceneSetup: { timePressure: 'running behind schedule', currentClinicalOperationalContext: 'workflow handoff delays' },
        },
        runtimeState: { activeHcpState: 'impatient' },
        cueText: 'HCP checks clock and asks what changes in clinic flow.',
        hcpUtterance: 'What do I do differently during a standard visit?',
        activeConcern: 'workflow',
      },
      expected: ['resource_constraint', 'workflow_implementation', 'operational_clinical'],
    },
    {
      label: 'patient selection focus',
      input: {
        scenario: {
          hcpProfile: { role: 'Oncology NP', specialty: 'Oncology', careSetting: 'Hospital clinic', baselineCommunicationStyle: 'practical', knownConstraints: ['selection uncertainty'] },
          sceneSetup: { timePressure: 'moderate', currentClinicalOperationalContext: 'need reliable candidacy screening' },
        },
        runtimeState: { activeHcpState: 'engaged' },
        cueText: 'HCP asks which patients are candidates and how to identify them quickly.',
        hcpUtterance: 'How would I identify patients I am missing?',
        activeConcern: 'screening',
      },
      expected: ['patient_selection_practical'],
    },
    {
      label: 'legitimate academic evidence posture',
      input: {
        scenario: {
          hcpProfile: { role: 'Academic ID specialist investigator', specialty: 'Infectious Disease', careSetting: 'Academic medical center', baselineCommunicationStyle: 'evidence review', knownConstraints: ['journal club evidence review'] },
          sceneSetup: { timePressure: 'low', currentClinicalOperationalContext: 'formal evidence appraisal meeting' },
        },
        runtimeState: { activeHcpState: 'neutral' },
        cueText: 'HCP requests subgroup analysis detail before changing protocol.',
        hcpUtterance: 'How do the trial findings support this decision?',
        activeConcern: 'evidence',
      },
      expected: ['academic_analytical', 'evidence_interrogation'],
    },
  ];

  for (const context of contexts) {
    const resultA = determinePreferredHcpDialogueRegister(context.input);
    const resultB = determinePreferredHcpDialogueRegister(context.input);
    assert.equal(resultA.preferredRegister, resultB.preferredRegister, `${context.label}: deterministic preferred register`);
    assert.ok(context.expected.includes(resultA.preferredRegister), `${context.label}: expected register family`);
  }
});

test('non-regression: scoring shape, metric ids, and deterministic transitions remain unchanged by realism layer', () => {
  const alignmentA = computeAlignment(
    'time-pressured',
    'We can implement one front-desk checklist this week and track completion.',
    { hcpUtterance: 'What changes in my workflow?' },
    'neutral',
    'time-pressured',
  );
  const alignmentB = computeAlignment(
    'time-pressured',
    'We can implement one front-desk checklist this week and track completion.',
    { hcpUtterance: 'What changes in my workflow?' },
    'neutral',
    'time-pressured',
  );

  assert.deepEqual(Object.keys(alignmentA.metrics).sort(), Object.keys(alignmentB.metrics).sort());
  assert.deepEqual(alignmentA.metrics, alignmentB.metrics);
  assert.equal(typeof alignmentA.score, 'number');
  assert.equal(alignmentA.score, alignmentB.score);
  assert.equal(RESPONSE_REGISTERS.length, 6);
});

test('live golden scenarios: strong/weak rep examples map to expected preferred register and phrasing bands', () => {
  const scenarios = [
    {
      id: 'golden_workflow',
      scenario: {
        hcpProfile: { role: 'Primary care NP', specialty: 'Primary care', careSetting: 'Busy clinic', baselineCommunicationStyle: 'brief practical', knownConstraints: ['short staffing', 'time pressure'] },
        sceneSetup: { timePressure: 'high', currentClinicalOperationalContext: 'visit-time constrained implementation' },
      },
      cueText: 'HCP says they have 10 minutes and asks what changes in workflow.',
      hcpUtterance: 'What do I do differently in a 10-minute visit?',
      strongRep: 'Start one MA-led checklist at intake this week and review misses in Friday huddle.',
      weakRep: 'The study aligns conceptually with improved outcomes.',
      expectedRegister: ['workflow_implementation', 'resource_constraint'],
      phraseBand: /workflow|10-minute|one step|this week|visit/i,
    },
    {
      id: 'golden_patient_selection',
      scenario: {
        hcpProfile: { role: 'Oncology PA', specialty: 'Oncology', careSetting: 'Community oncology clinic', baselineCommunicationStyle: 'focused practical', knownConstraints: ['candidate identification uncertainty'] },
        sceneSetup: { timePressure: 'moderate', currentClinicalOperationalContext: 'needs candidacy workflow clarity' },
      },
      cueText: 'HCP asks how to identify eligible patients they are missing.',
      hcpUtterance: 'How would I identify the right patients this month?',
      strongRep: 'Use one biomarker triage rule in intake to flag candidates before tumor board.',
      weakRep: 'The trial findings are theoretically supportive in subgroup analyses.',
      expectedRegister: ['patient_selection_practical'],
      phraseBand: /identify|patients|panel|candidate|selection|screen/i,
    },
    {
      id: 'golden_academic_allowed',
      scenario: {
        hcpProfile: { role: 'Academic ID specialist investigator', specialty: 'ID', careSetting: 'Academic center', baselineCommunicationStyle: 'analytical evidence-review', knownConstraints: ['protocol committee evidence threshold'] },
        sceneSetup: { timePressure: 'low', currentClinicalOperationalContext: 'protocol review meeting' },
      },
      cueText: 'HCP requests evidence hierarchy and trial design caveats.',
      hcpUtterance: 'Which evidence detail should we prioritize?',
      strongRep: 'Primary endpoint met with consistent subgroup trend and explicit protocol applicability limits.',
      weakRep: 'Trust me, this is practical.',
      expectedRegister: ['academic_analytical', 'evidence_interrogation'],
      phraseBand: /evidence|detail|data|decision/i,
    },
  ];

  for (const fixture of scenarios) {
    const registerResult = determinePreferredHcpDialogueRegister({
      scenario: fixture.scenario,
      runtimeState: { activeHcpState: 'engaged' },
      cueText: fixture.cueText,
      hcpUtterance: fixture.hcpUtterance,
      activeConcern: fixture.id.includes('patient') ? 'screening' : fixture.id.includes('academic') ? 'evidence' : 'workflow',
    });

    assert.ok(
      fixture.expectedRegister.includes(registerResult.preferredRegister),
      `${fixture.id}: expected preferred register`,
    );

    const enforcedWeak = enforceOperationalRealismPreference({
      dialogue: ACADEMIC_LINE,
      preferredRegister: registerResult.preferredRegister,
      activeConcern: fixture.id.includes('patient') ? 'screening' : fixture.id.includes('academic') ? 'evidence' : 'workflow',
      flags: registerResult.flags,
    });

    if (!fixture.id.includes('academic')) {
      assert.equal(enforcedWeak.applied, true, `${fixture.id}: weak academic phrasing should be rewritten`);
    }
    assert.match(enforcedWeak.dialogue, fixture.phraseBand, `${fixture.id}: dialogue should remain in expected phrasing band`);

    const strongScore = computeAlignment('engaged', fixture.strongRep, { hcpUtterance: fixture.hcpUtterance }, 'neutral', 'engaged').score;
    const weakScore = computeAlignment('engaged', fixture.weakRep, { hcpUtterance: fixture.hcpUtterance }, 'neutral', 'engaged').score;
    assert.ok(strongScore >= weakScore, `${fixture.id}: strong rep should not underperform weak rep`);
  }
});
