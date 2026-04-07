import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyConversationalRealism,
  assertLiveHcpRealismRenderInputs,
  compressByState,
  detectOverpackedSentence,
  enforceTerminalCompression,
  HCP_REALISM_STATES,
  humanizeClinicalReferences,
  reduceFormalMetaLabeling,
  validateCueDialogueLockstep,
  validateHcpRealismStateMachine,
  validateLiveHcpRealismRenderInputs,
  varyPressurePhrasing,
} from '../src/lib/roleplay/conversationalRealismEngine.js';
import { buildRoleplayScenarioExecutionContract } from '../src/lib/roleplay/scenarioExecutionContract.js';
import { ALL_SCENARIOS } from '../src/lib/roleplay-v2/scenarioCatalog.js';

function scenarioContractById(id) {
  const scenario = ALL_SCENARIOS.find((item) => item.id === id);
  assert.ok(scenario, `missing scenario fixture ${id}`);
  return buildRoleplayScenarioExecutionContract(scenario);
}

test('HCP realism state machine exposes required deterministic state contract', () => {
  const validation = validateHcpRealismStateMachine();

  assert.equal(validation.valid, true, validation.issues.join(', '));
  assert.equal(validation.stateCount, 6);
  for (const [stateName, state] of Object.entries(HCP_REALISM_STATES)) {
    assert.ok(state.behavioralIntent, `${stateName} missing behavioral intent`);
    assert.ok(state.allowedToneRange.length > 0, `${stateName} missing tone range`);
    assert.ok(Array.isArray(state.allowedNextStates), `${stateName} missing allowed next states`);
    assert.ok(Array.isArray(state.disallowedTransitions), `${stateName} missing disallowed transitions`);
    assert.ok(state.responseConstructionRules.length > 0, `${stateName} missing construction rules`);
  }
  assert.deepEqual(HCP_REALISM_STATES.OPENING_CONSTRAINT.disallowedTransitions, [
    'hard_rejection',
    'early_disengagement',
    'high_pressure_escalation',
  ]);
});

test('conversational realism keeps neutral evidence asks natural while preserving detail', () => {
  const result = applyConversationalRealism({
    text: 'Before we discuss new data, can you specifically address how the treatment options you mentioned last week impact the long-term durability for my stable patients, which was my primary concern?',
    concernFamily: 'evidence',
    cueCategory: 'neutral_attentive',
    engagementTier: 'engaged',
  });

  assert.match(result.text, /durability/i);
  assert.match(result.text, /stable patients/i);
  assert.doesNotMatch(result.text, /treatment options you mentioned last week/i);
  assert.equal(result.metadata.cueCategory, 'neutral_attentive');
});

test('conversational realism compresses focused evidence asks under pressure', () => {
  const result = applyConversationalRealism({
    text: 'Before we discuss new data, can you specifically address how the treatment options you mentioned last week impact the long-term durability for my stable patients, which was my primary concern?',
    concernFamily: 'evidence',
    cueCategory: 'focused_narrowing',
    engagementTier: 'constrained',
    interactionMode: 'directive',
  });

  assert.equal(result.text, 'Before we move on, can you tie that to durability for my stable patients?');
  assert.doesNotMatch(result.text, /primary concern/i);
  assert.equal(result.metadata.lockstep.aligned, true);
});

test('conversational realism makes workflow hard escalation shorter and directive', () => {
  const result = applyConversationalRealism({
    text: 'I can stay with this if we make it concrete. What is the first step my staff would own?',
    concernFamily: 'workflow',
    cueCategory: 'hard_escalation',
    engagementTier: 'disengaging',
    interactionMode: 'closing',
  });

  assert.equal(result.text, 'I can stay with this if we make it concrete. What would my staff own first?');
  assert.doesNotMatch(result.text, /^Then give me one step/i);
  assert.equal(result.metadata.lockstep.aligned, true);
  assert.ok(result.text.split(/\s+/).length <= 16);
});

test('conversational realism preserves access and screening ask clarity', () => {
  assert.equal(
    applyConversationalRealism({
      text: 'Given the access delays. What is one workable step?',
      concernFamily: 'access',
      cueCategory: 'time_constrained',
      timePressure: true,
    }).text,
    'Given the access delays, what is one workable step?'
  );

  assert.equal(
    applyConversationalRealism({
      text: 'From a screening perspective. How would I identify the right patients?',
      concernFamily: 'screening',
      cueCategory: 'focused_narrowing',
    }).text,
    'From a screening perspective, how would I identify the right patients?'
  );
});

test('conversational realism compresses terminal exits without adding a new ask', () => {
  const result = applyConversationalRealism({
    text: 'I need to pause here if we cannot get to the workflow answer.',
    concernFamily: 'workflow',
    cueCategory: 'terminal_exit',
    terminalBehavior: true,
  });

  assert.equal(result.text, 'I need to pause here.');
  assert.doesNotMatch(result.text, /\?/);
  assert.equal(result.metadata.lockstep.aligned, true);
});

test('conversational realism hard-compresses formal terminal evidence expansion', () => {
  const result = applyConversationalRealism({
    text: 'To directly address your follow-up on outcomes data. Can you specifically elaborate on how that data supports the long-term durability of treatment regimens for my stable patients?',
    concernFamily: 'evidence',
    cueCategory: 'terminal_exit',
    engagementTier: 'disengaging',
    interactionMode: 'closing',
    semanticStage: 'closing',
    terminalBehavior: true,
  });

  assert.equal(result.text, "I'm about to move on. How does that affect durability for stable patients?");
  assert.doesNotMatch(result.text, /To directly address|specifically elaborate|treatment regimens/i);
  assert.ok(result.text.split(/\s+/).length <= 13);
  assert.equal(result.metadata.lockstep.aligned, true);
  assert.equal(result.metadata.terminalCompressionApplied, true);
});

test('terminal compression keeps pressured asks short by concern family', () => {
  assert.equal(
    enforceTerminalCompression({
      text: 'To address your workflow follow-up. Can you specifically elaborate on how this would support the operational implications for my staff?',
      concernFamily: 'workflow',
      cueCategory: 'terminal_exit',
    }),
    "I'm about to move on, but make it practical. What would my team do first?"
  );
});

test('conversational realism preserves rich framing for generic pressured workflow asks', () => {
  assert.equal(
    applyConversationalRealism({
      text: 'What is the first practical workflow step here?',
      concernFamily: 'workflow',
      cueCategory: 'hard_escalation',
      interactionMode: 'directive',
    }).text,
    'I can stay with this if we make it concrete. What would my team do first?'
  );

  assert.equal(
    applyConversationalRealism({
      text: 'Keep it to one workflow step we could use here.',
      concernFamily: 'workflow',
      cueCategory: 'terminal_exit',
      terminalBehavior: true,
    }).text,
    "I'm about to move on, but make it practical. What would my team do first?"
  );
});

test('conversational realism preserves concise evidence framing under time pressure', () => {
  assert.equal(
    applyConversationalRealism({
      text: 'Given the time, what is the one decision-relevant evidence point?',
      concernFamily: 'evidence',
      cueCategory: 'time_constrained',
      timePressure: true,
    }).text,
    'Given the time, what evidence point changes the decision?'
  );

  assert.equal(
    applyConversationalRealism({
      text: 'Given the time, what is the one decision-relevant evidence point?',
      concernFamily: 'evidence',
      cueCategory: 'terminal_exit',
      terminalBehavior: true,
    }).text,
    "I'm about to move on. What evidence point changes the decision?"
  );
});

test('conversational realism restores stable HIV evidence richness instead of generic workflow fallback', () => {
  const result = applyConversationalRealism({
    text: 'I can stay with this if we make it concrete. What would my team do first?',
    activeAsk: 'Before we discuss further, can you specifically address how the data you shared last week applies to the long-term durability of treatments for my stable HIV patients?',
    concernFamily: 'workflow',
    cueCategory: 'time_constrained',
    timePressure: true,
    scenarioContext: 'Michael Chen, PA-C - Academic HIV Center. Treatment Optimization in Stable HIV Patients. Reluctance to optimize stable, suppressed patients. Long-term durability is the active concern.',
  });

  assert.equal(
    result.text,
    'Given how little time we have, what specific evidence actually justifies switching stable patients?'
  );
  assert.equal(result.metadata.concernFamily, 'evidence');
  assert.equal(result.metadata.scenarioArchetype, 'stable_hiv_optimization');
  assert.doesNotMatch(result.text, /I can stay with this|make it concrete|What would my team do first/i);
});

test('state-driven realism uses active ask state over generic text without phrase-trigger routing', () => {
  const contract = scenarioContractById('hiv_pa_treat_switch_slowdown');
  const result = applyConversationalRealism({
    text: 'I can stay with this if we make it concrete. What would my team do first?',
    activeAskState: {
      source: 'explicit_live_hcp_dialogue',
      askText: 'durability threshold ask',
      concernFamily: 'evidence',
      strength: 'hard_explicit_ask',
    },
    concernFamily: 'workflow',
    cueCategory: 'time_constrained',
    timePressure: true,
    scenarioExecutionContract: contract,
  });

  assert.equal(result.text, 'Given how little time we have, what specific evidence actually justifies switching stable patients?');
  assert.equal(result.metadata.renderingSource, 'scenario_realism_profile');
  assert.equal(result.metadata.stateName, 'TIME_PRESSURE_DEFLECTION');
  assert.equal(result.metadata.concernFamily, 'evidence');
  assert.equal(result.metadata.scenarioId, 'hiv_pa_treat_switch_slowdown');
  assert.doesNotMatch(result.text, /I can stay with this|make it concrete/i);
});

test('live HCP realism rendering fails closed without scenarioExecutionContract', () => {
  assert.throws(
    () => applyConversationalRealism({
      text: 'I can stay with this if we make it concrete. What would my team do first?',
      activeAskState: {
        source: 'explicit_live_hcp_dialogue',
        askText: 'evidence threshold ask',
        concernFamily: 'evidence',
      },
      concernFamily: 'evidence',
      cueCategory: 'time_constrained',
      requireContractBound: true,
    }),
    /missing_scenario_execution_contract/,
  );
});

test('live HCP realism rendering fails closed without activeAskState', () => {
  const contract = scenarioContractById('hiv_pa_treat_switch_slowdown');
  assert.throws(
    () => applyConversationalRealism({
      text: 'Given the time, what evidence point changes the decision?',
      concernFamily: 'evidence',
      cueCategory: 'time_constrained',
      scenarioExecutionContract: contract,
      requireContractBound: true,
    }),
    /missing_active_ask_state_text/,
  );
});

test('live HCP realism rendering accepts only contract-bound state-driven output', () => {
  const contract = scenarioContractById('hiv_pa_treat_switch_slowdown');
  const activeAskState = {
    source: 'explicit_live_hcp_dialogue',
    askText: 'evidence threshold ask',
    concernFamily: 'evidence',
    strength: 'hard_explicit_ask',
  };
  const result = applyConversationalRealism({
    text: 'I can stay with this if we make it concrete. What would my team do first?',
    activeAskState,
    concernFamily: 'workflow',
    cueCategory: 'time_constrained',
    timePressure: true,
    scenarioExecutionContract: contract,
    requireContractBound: true,
  });

  assert.equal(result.metadata.renderingSource, 'scenario_realism_profile');
  assert.equal(result.metadata.scenarioId, 'hiv_pa_treat_switch_slowdown');
  assert.equal(result.metadata.concernFamily, 'evidence');
  assert.equal(result.metadata.stateName, 'TIME_PRESSURE_DEFLECTION');
  assert.equal(validateLiveHcpRealismRenderInputs({
    scenarioExecutionContract: contract,
    activeAskState,
    stateDrivenResult: {
      metadata: {
        stateName: result.metadata.stateName,
      },
    },
  }).valid, true);
  assert.doesNotThrow(() => assertLiveHcpRealismRenderInputs({
    scenarioExecutionContract: contract,
    activeAskState,
    stateDrivenResult: {
      metadata: {
        stateName: result.metadata.stateName,
      },
    },
  }));
});

test('state-driven realism is deterministic and scenario-bound for identical inputs', () => {
  const input = {
    text: 'What is the first practical workflow step here?',
    activeAskState: {
      source: 'explicit_live_hcp_dialogue',
      askText: 'operational next step ask',
      concernFamily: 'workflow',
      strength: 'hard_explicit_ask',
    },
    concernFamily: 'workflow',
    cueCategory: 'hard_escalation',
    interactionMode: 'directive',
  };
  const hivContract = scenarioContractById('hiv_pa_treat_switch_slowdown');
  const covidContract = scenarioContractById('covid_pulm_np_postcovid_adherence');
  const first = applyConversationalRealism({ ...input, scenarioExecutionContract: hivContract });
  const second = applyConversationalRealism({ ...input, scenarioExecutionContract: hivContract });
  const covid = applyConversationalRealism({ ...input, scenarioExecutionContract: covidContract });

  assert.equal(first.text, second.text);
  assert.notEqual(first.text, covid.text);
  assert.equal(first.metadata.stateName, 'SOFT_RESISTANCE');
  assert.equal(covid.metadata.stateName, 'SOFT_RESISTANCE');
});

test('state-driven realism changes output when state changes within the same scenario', () => {
  const contract = scenarioContractById('card-formulary');
  const base = {
    text: 'Given the time, what is the one decision-relevant evidence point?',
    activeAskState: {
      source: 'explicit_live_hcp_dialogue',
      askText: 'evidence threshold ask',
      concernFamily: 'evidence',
      strength: 'hard_explicit_ask',
    },
    concernFamily: 'evidence',
    scenarioExecutionContract: contract,
  };
  const timePressed = applyConversationalRealism({ ...base, cueCategory: 'time_constrained', timePressure: true });
  const resistant = applyConversationalRealism({ ...base, cueCategory: 'hard_escalation', interactionMode: 'directive' });

  assert.notEqual(timePressed.text, resistant.text);
  assert.equal(timePressed.metadata.stateName, 'TIME_PRESSURE_DEFLECTION');
  assert.equal(resistant.metadata.stateName, 'SOFT_RESISTANCE');
});

test('contract-derived realism sanitizes unprofiled clinic stakeholder phrasing', () => {
  const contract = buildRoleplayScenarioExecutionContract({
    id: 'unprofiled-clinic-provider-test',
    title: 'HIV Prevention Gap in High-Risk Population',
    specialty: 'Internal Medicine',
    stakeholder: 'Dr. Maya Patel - Internal Medicine MD, Urban Clinic',
    openingScene: "Dr. Patel is between patients and asks what the team would do first.",
  });
  const result = applyConversationalRealism({
    text: 'Generic upstream draft.',
    activeAskState: { ...contract.activeAsk, concernFamily: 'workflow' },
    concernFamily: 'workflow',
    cueCategory: 'time_constrained',
    timePressure: true,
    scenarioExecutionContract: contract,
    requireContractBound: true,
  });

  assert.equal(result.metadata.renderingSource, 'contract_derived_realism_profile');
  assert.equal(result.text, 'Given the time, what would my team actually do first here?');
  assert.doesNotMatch(result.text, /Dr\.|Maya|Patel|Internal Medicine|Urban Clinic/i);
});

test('contract-derived realism uses committee bucket for unprofiled formulary contexts', () => {
  const contract = buildRoleplayScenarioExecutionContract({
    id: 'unprofiled-formulary-committee-test',
    title: 'Regional Formulary Review',
    specialty: 'P&T Committee',
    stakeholder: 'Pharmacy Director - Committee Chair',
    openingScene: "The committee chair says there are three requests and asks what evidence should influence the decision.",
  });
  const result = applyConversationalRealism({
    text: 'Generic upstream draft.',
    activeAskState: { ...contract.activeAsk, concernFamily: 'evidence' },
    concernFamily: 'evidence',
    cueCategory: 'time_constrained',
    timePressure: true,
    scenarioExecutionContract: contract,
    requireContractBound: true,
  });

  assert.equal(result.text, 'Given the time, what evidence changes the decision for this committee?');
  assert.doesNotMatch(result.text, /Pharmacy Director|Committee Chair|Regional Formulary Review/i);
});

test('contract-derived realism uses process bucket for unprofiled access/admin contexts', () => {
  const contract = buildRoleplayScenarioExecutionContract({
    id: 'unprofiled-access-admin-test',
    title: 'Prior Authorization Delay Review',
    specialty: 'Access Operations',
    stakeholder: 'Access Coordinator - Reimbursement Team Lead',
    openingScene: "The access lead asks what step would reduce prior authorization delays.",
  });
  const result = applyConversationalRealism({
    text: 'Generic upstream draft.',
    activeAskState: { ...contract.activeAsk, concernFamily: 'access' },
    concernFamily: 'access',
    cueCategory: 'time_constrained',
    timePressure: true,
    scenarioExecutionContract: contract,
    requireContractBound: true,
  });

  assert.equal(result.text, 'Given the time, what access step changes the delay in our process?');
  assert.doesNotMatch(result.text, /Access Coordinator|Reimbursement Team Lead|Prior Authorization Delay Review/i);
});

test('contract-derived realism uses evaluation bucket for unprofiled screening and diagnosis contexts', () => {
  const contract = buildRoleplayScenarioExecutionContract({
    id: 'unprofiled-screening-diagnosis-test',
    title: 'Rare Disease Diagnosis Journey',
    specialty: 'Genetics Clinic',
    stakeholder: 'Genetics NP - Diagnostic Intake Lead',
    openingScene: "The NP asks who would be identified first for screening.",
  });
  const result = applyConversationalRealism({
    text: 'Generic upstream draft.',
    activeAskState: { ...contract.activeAsk, concernFamily: 'screening' },
    concernFamily: 'screening',
    cueCategory: 'time_constrained',
    timePressure: true,
    scenarioExecutionContract: contract,
    requireContractBound: true,
  });

  assert.equal(result.text, 'Given the time, who would we identify first here?');
  assert.doesNotMatch(result.text, /Genetics NP|Diagnostic Intake Lead|Rare Disease Diagnosis Journey/i);
});

test('contract-derived bucket hardening does not alter scenario-specific profiles', () => {
  const contract = scenarioContractById('hiv_pa_treat_switch_slowdown');
  const result = applyConversationalRealism({
    text: 'Generic upstream draft.',
    activeAskState: { ...contract.activeAsk, concernFamily: 'workflow' },
    concernFamily: 'workflow',
    cueCategory: 'time_constrained',
    timePressure: true,
    scenarioExecutionContract: contract,
    requireContractBound: true,
  });

  assert.equal(result.metadata.renderingSource, 'scenario_realism_profile');
  assert.equal(result.text, 'I remember that data, but I need something actionable. What would my team actually do differently next week?');
});

test('conversational realism uses scenario-bound rich phrasing for workflow pressure', () => {
  const hiv = applyConversationalRealism({
    text: 'What is the first practical workflow step here?',
    activeAsk: 'What would my team actually do differently starting next week?',
    concernFamily: 'workflow',
    cueCategory: 'hard_escalation',
    scenarioContext: 'Michael Chen. Treatment Optimization in Stable HIV Patients. Stable suppressed patients and optimization inertia.',
  }).text;
  const covid = applyConversationalRealism({
    text: 'What is the first practical workflow step here?',
    activeAsk: 'What would this look like in practice on day one?',
    concernFamily: 'workflow',
    cueCategory: 'hard_escalation',
    scenarioContext: 'Post-COVID clinic antiviral adherence. Callback list. Patients are showing up on day 4 or 5, almost too late for antivirals.',
  }).text;
  const formulary = applyConversationalRealism({
    text: 'What is the first practical workflow step here?',
    activeAsk: 'If we move forward, what would that mean for the formulary team?',
    concernFamily: 'workflow',
    cueCategory: 'hard_escalation',
    scenarioContext: 'Cardiology Formulary Review. P&T committee with three formulary requests and 20 minutes.',
  }).text;

  assert.equal(hiv, 'I remember that data, but I need something actionable. What would my team actually do differently next week?');
  assert.equal(covid, 'That\'s exactly the issue, but I do not have bandwidth for theory. What would this look like in practice on day one?');
  assert.equal(formulary, 'What is the realistic first step for my team?');
  assert.notEqual(hiv, covid);
  assert.notEqual(covid, formulary);
  assert.doesNotMatch(`${hiv} ${covid} ${formulary}`, /I can stay with this if we make it concrete/i);
});

test('conversational realism reports cue-dialogue lockstep mismatches', () => {
  assert.deepEqual(
    validateCueDialogueLockstep({ cueCategory: 'hard_escalation', finalText: 'I can stay with this if we make it concrete.' }).mismatchReasons,
    ['hard_escalation_with_soft_framing']
  );
  assert.deepEqual(
    validateCueDialogueLockstep({ cueCategory: 'terminal_exit', finalText: 'What data should we discuss next?' }).mismatchReasons,
    ['terminal_cue_without_terminal_dialogue']
  );
});

test('conversational realism exposes deterministic phrase-family anti-repetition metadata', () => {
  const first = varyPressurePhrasing({
    text: 'Can you tie that to durability for my stable patients?',
    concernFamily: 'evidence',
    recentHcpTurns: [
      'What proof point changes the decision?',
      'Can you connect last week’s data to durability for my stable patients?',
    ],
    cueCategory: 'hard_escalation',
  });
  const second = varyPressurePhrasing({
    text: 'Can you tie that to durability for my stable patients?',
    concernFamily: 'evidence',
    recentHcpTurns: [
      'What proof point changes the decision?',
      'Can you connect last week’s data to durability for my stable patients?',
    ],
    cueCategory: 'hard_escalation',
  });

  assert.equal(first.phraseFamily, 'evidenceAsk');
  assert.equal(first.repeatedFamilyCount, 2);
  assert.deepEqual(second, first);
});

test('conversational realism helpers remain deterministic and bounded', () => {
  assert.equal(
    humanizeClinicalReferences({ text: 'Can you explain the operational implications for my staff?' }),
    'Can you explain what my staff would actually do?'
  );
  assert.equal(
    reduceFormalMetaLabeling({ text: 'How does this affect durability, which was my primary concern?' }),
    'How does this affect durability?'
  );
  assert.equal(detectOverpackedSentence({ text: 'Can you tie that to durability?' }).overpacked, false);
  assert.equal(
    compressByState({ text: 'I need to pause here if we cannot get to the workflow answer.', cueCategory: 'terminal_exit', concernFamily: 'workflow' }),
    'I need to pause here.'
  );
});
