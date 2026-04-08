import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyConversationalRealism,
  assertLiveHcpRealismRenderInputs,
  compressByState,
  derivePhraseExhaustionState,
  deriveRealismMemory,
  detectOverpackedSentence,
  detectGenericOperationalCrutch,
  detectLateConversationGenericCollapse,
  detectRepeatedTerminalAskShape,
  detectRepeatedOperationalAskSkeleton,
  detectStockTransitionReuse,
  detectSyntheticShortHorizon,
  enforceTerminalCompression,
  enforcePostGenerationHcpRealism,
  HCP_REALISM_STATES,
  humanizeClinicalReferences,
  reduceFormalMetaLabeling,
  reviseForBurdenRealism,
  validateCueDialogueLockstep,
  validateHcpRealismStateMachine,
  validateLiveHcpRealismRenderInputs,
  spokenBelievabilityAudit,
  varyPressurePhrasing,
} from '../src/lib/roleplay/conversationalRealismEngine.js';
import { buildRoleplayScenarioExecutionContract } from '../src/lib/roleplay/scenarioExecutionContract.js';
import { ALL_SCENARIOS } from '../src/lib/roleplay-v2/scenarioCatalog.js';

function scenarioContractById(id) {
  const scenario = ALL_SCENARIOS.find((item) => item.id === id);
  assert.ok(scenario, `missing scenario fixture ${id}`);
  return buildRoleplayScenarioExecutionContract(scenario);
}

function wordCount(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function assertRichHcpLine(value, label = 'HCP line') {
  assert.ok(wordCount(value) >= 20, `${label} should preserve at least 20 spoken words: ${value}`);
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

  assert.equal(result.text, "I'm about to move on, but I need the durability point. What evidence actually justifies switching stable patients right now?");
  assert.doesNotMatch(result.text, /To directly address|specifically elaborate|treatment regimens/i);
  assertRichHcpLine(result.text, 'terminal evidence pressure line');
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
    'Given how little time we have, what specific evidence actually justifies switching stable patients? Tie it to the decision in front of me.'
  );
  assertRichHcpLine(result.text, 'stable HIV evidence pressure line');
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

  assert.equal(result.text, 'Before we get into new data, can you tie what you showed last week to long-term durability for stable patients and why that justifies switching?');
  assertRichHcpLine(result.text, 'state-driven active ask line');
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
  assert.equal(result.text, 'Given the time, what follow-through would my team need to absorb, and how would that fit into clinic flow over time?');
  assertRichHcpLine(result.text, 'unprofiled clinic/provider line');
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

  assert.equal(result.text, 'Given the time, I need the decision point, not a broad overview. What evidence changes the decision for this committee?');
  assertRichHcpLine(result.text, 'unprofiled committee line');
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

  assert.equal(result.text, 'Given the time, I need the process step, not a broad access discussion. What access step changes the delay in our process?');
  assertRichHcpLine(result.text, 'unprofiled access/admin line');
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

  assert.equal(result.text, 'Given the time, I need the patient boundary, not a broad screening discussion. Who would we identify first here today?');
  assertRichHcpLine(result.text, 'unprofiled screening/diagnosis line');
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
  assert.equal(result.text, 'I remember that data, but before I ask staff to shift stable-patient follow-up. What burden would they absorb over the coming weeks?');
  assertRichHcpLine(result.text, 'profiled HIV workflow line');
});

test('state-driven HCP realism preserves a 20-word spoken floor across profiled and contract-derived scenarios', () => {
  const cases = [
    {
      label: 'stable HIV profiled workflow',
      contract: scenarioContractById('hiv_pa_treat_switch_slowdown'),
      family: 'workflow',
    },
    {
      label: 'cardiology profiled evidence',
      contract: scenarioContractById('card-formulary'),
      family: 'evidence',
    },
    {
      label: 'unprofiled clinic workflow',
      contract: buildRoleplayScenarioExecutionContract({
        id: 'unprofiled-clinic-richness-floor-test',
        title: 'Clinic Workflow Capacity Review',
        specialty: 'Internal Medicine',
        stakeholder: 'Clinic Director - Primary Care Lead',
        openingScene: 'The clinic director has two minutes and asks what the team would do first.',
      }),
      family: 'workflow',
    },
    {
      label: 'unprofiled access process',
      contract: buildRoleplayScenarioExecutionContract({
        id: 'unprofiled-access-richness-floor-test',
        title: 'Access Delay Review',
        specialty: 'Access Operations',
        stakeholder: 'Access Coordinator - Reimbursement Team Lead',
        openingScene: 'The access lead asks what step reduces the delay.',
      }),
      family: 'access',
    },
  ];

  for (const item of cases) {
    const result = applyConversationalRealism({
      text: 'Generic upstream draft.',
      activeAskState: { ...item.contract.activeAsk, askText: item.contract.activeAsk.askText || 'live ask', concernFamily: item.family },
      concernFamily: item.family,
      cueCategory: 'time_constrained',
      timePressure: true,
      scenarioExecutionContract: item.contract,
      requireContractBound: true,
    });
    assertRichHcpLine(result.text, item.label);
  }
});

test('state-driven HCP realism varies repeated lines without dropping below the richness floor', () => {
  const contract = scenarioContractById('hiv_pa_treat_switch_slowdown');
  const activeAskState = { ...contract.activeAsk, concernFamily: 'workflow', askText: 'workflow next step ask' };
  const first = applyConversationalRealism({
    text: 'Generic upstream draft.',
    activeAskState,
    concernFamily: 'workflow',
    cueCategory: 'time_constrained',
    timePressure: true,
    scenarioExecutionContract: contract,
    requireContractBound: true,
  });
  const second = applyConversationalRealism({
    text: 'Generic upstream draft.',
    activeAskState,
    concernFamily: 'workflow',
    cueCategory: 'time_constrained',
    timePressure: true,
    recentHcpTurns: [first.text],
    scenarioExecutionContract: contract,
    requireContractBound: true,
  });

  assert.notEqual(second.text, first.text);
  assert.equal(second.metadata.repeatedStateDrivenLine, true);
  assertRichHcpLine(first.text, 'first state-driven HCP line');
  assertRichHcpLine(second.text, 'repeat-varied state-driven HCP line');
});

test('post-generation realism rewrites rubric-like HCP phrases before final return', () => {
  const contract = scenarioContractById('card-formulary');
  const activeAskState = { ...contract.activeAsk, askText: 'committee evidence threshold ask', concernFamily: 'evidence' };
  const result = enforcePostGenerationHcpRealism({
    reply: 'You have covered the setup; now I need the decision-relevant evidence. Be specific about ownership.',
    scenarioExecutionContract: contract,
    activeAskState,
    concernFamily: 'evidence',
    stateName: 'TIME_PRESSURE_DEFLECTION',
    cueCategory: 'time_constrained',
    timePressure: true,
  });

  assert.equal(result.metadata.revised, true);
  assert.match(result.metadata.issues.join(' '), /rubric_language|state_label_language/);
  assertRichHcpLine(result.text, 'post-generation rewritten HCP line');
  assert.ok(wordCount(result.text) <= 25, `post-generation line should stay at or below 25 words: ${result.text}`);
  assert.doesNotMatch(result.text, /You have covered the setup|decision-relevant evidence|Be specific about ownership/i);
});

test('spoken believability audit detects stock transition and repeated ask-shape reuse', () => {
  const recent = [
    'I remember that data, but I need something actionable before I ask staff to change anything. What would my team actually do differently next week?',
    'Given the time investment required, what would staff need to absorb differently over the coming weeks if we changed follow-up now?',
    'The clinic flow is still the issue. What would my team actually own first if we tried this next week?',
  ];

  assert.deepEqual(detectStockTransitionReuse({
    reply: 'I remember that data, but I still need the practical piece for staff before I would change anything.',
    recentHcpTurns: recent,
  }), {
    reused: true,
    family: 'i remember that data',
    recentCount: 1,
  });

  const askShape = detectRepeatedTerminalAskShape({
    reply: 'If this is real, what would my team actually do differently next week?',
    recentHcpTurns: recent,
  });

  assert.equal(askShape.repeated, true);
  assert.equal(askShape.family, 'team_action_ask');
});

test('post-generation realism revises reused transition shapes into evolved scenario-bound pressure', () => {
  const contract = scenarioContractById('hiv_pa_treat_switch_slowdown');
  const activeAskState = { ...contract.activeAsk, askText: 'workflow next step ask', concernFamily: 'workflow' };
  const recent = ['Given the time investment required, what would staff need to absorb differently over the coming weeks if we changed follow-up now?'];
  const result = enforcePostGenerationHcpRealism({
    reply: 'Given the time investment required, what would staff need to absorb differently over the coming weeks if we changed follow-up now?',
    scenarioExecutionContract: contract,
    activeAskState,
    concernFamily: 'workflow',
    stateName: 'TIME_PRESSURE_DEFLECTION',
    cueCategory: 'time_constrained',
    recentHcpTurns: recent,
  });

  const audit = spokenBelievabilityAudit({
    reply: recent[0],
    scenarioExecutionContract: contract,
    activeAskState,
    concernFamily: 'workflow',
    cueCategory: 'time_constrained',
    recentHcpTurns: recent,
  });

  assert.equal(audit.stockTransition.reused, true);
  assert.equal(result.metadata.revised, true);
  assert.match(result.metadata.issues.join(' '), /stock_transition_reuse|recent_pattern_reuse|repeated_terminal_ask_shape/);
  assert.notEqual(result.text, recent[0]);
  assertRichHcpLine(result.text, 'post-generation reused transition rewrite');
  assert.ok(wordCount(result.text) <= 25, `post-generation rewrite should stay at or below 25 words: ${result.text}`);
  assert.doesNotMatch(result.text, /^Given the time investment required/i);
});

test('state-driven realism evolves repeated pressure across four turns without ask-shape loops', () => {
  const cases = [
    { id: 'hiv_pa_treat_switch_slowdown', family: 'workflow' },
    { id: 'covid_pulm_np_postcovid_adherence', family: 'workflow' },
    { id: 'card-formulary', family: 'evidence' },
  ];

  for (const item of cases) {
    const contract = scenarioContractById(item.id);
    const activeAskState = { ...contract.activeAsk, askText: contract.activeAsk.askText || 'live ask', concernFamily: item.family };
    const turns = [];
    for (let index = 0; index < 4; index += 1) {
      const result = applyConversationalRealism({
        text: 'Generic upstream draft.',
        activeAskState,
        concernFamily: item.family,
        cueCategory: 'time_constrained',
        timePressure: true,
        recentHcpTurns: turns,
        scenarioExecutionContract: contract,
        requireContractBound: true,
      });
      assertRichHcpLine(result.text, `${item.id} turn ${index + 1}`);
      assert.ok(wordCount(result.text) <= 25, `${item.id} turn ${index + 1} should stay at or below 25 words: ${result.text}`);
      assert.ok(!turns.includes(result.text), `${item.id} repeated an HCP line on turn ${index + 1}: ${result.text}`);
      turns.push(result.text);
    }
  }
});

test('realism memory tracks medium-range phrasing exhaustion beyond the last few turns', () => {
  const recent = Array.from({ length: 30 }, (_item, index) => (
    index % 2 === 0
      ? 'Given the time, what would my team actually do differently next week?'
      : 'I am still not hearing the operational step, and I cannot hand my team a concept. What would they do differently next week?'
  ));

  const memory = deriveRealismMemory({ recentHcpTurns: recent, concernFamily: 'workflow' });
  const exhaustion = derivePhraseExhaustionState({ recentHcpTurns: recent, concernFamily: 'workflow' });
  const collapse = detectLateConversationGenericCollapse({
    reply: 'Given the time, I need one practical point. What would my team actually do differently?',
    recentHcpTurns: recent,
    concernFamily: 'workflow',
  });

  assert.equal(memory.turnCount, 30);
  assert.ok(memory.exhausted.openingStructures.includes('given_time_opening'));
  assert.ok(memory.exhausted.askStructures.includes('team_action_ask'));
  assert.ok(exhaustion.exhausted.openingStructures.includes('still_not_hearing_opening'));
  assert.equal(collapse.collapsed, true);
  assert.match(collapse.reasons.join(' '), /late_generic_repair_crutch|late_repeated_ask_shape|late_repeated_opening_shape/);
});

test('post-generation realism re-anchors late collapsed workflow lines to scenario memory', () => {
  const contract = scenarioContractById('hiv_pa_treat_switch_slowdown');
  const activeAskState = { ...contract.activeAsk, askText: 'workflow next step ask', concernFamily: 'workflow' };
  const recent = Array.from({ length: 28 }, (_item, index) => (
    index % 2 === 0
      ? 'Given the time, what would my team actually do differently next week?'
      : 'I am still not hearing the operational step, and I cannot hand my team a concept. What would they do differently next week?'
  ));
  const result = enforcePostGenerationHcpRealism({
    reply: 'Given the time, I need one practical point. What would my team actually do differently?',
    scenarioExecutionContract: contract,
    activeAskState,
    concernFamily: 'workflow',
    stateName: 'SOFT_RESISTANCE',
    cueCategory: 'time_constrained',
    recentHcpTurns: recent,
  });

  assert.equal(result.metadata.lateCollapse.collapsed, true);
  assert.equal(result.metadata.lateCollapse.memoryTurnCount, 28);
  assertRichHcpLine(result.text, 'late collapsed workflow rewrite');
  assert.ok(wordCount(result.text) <= 25, `late collapsed rewrite should stay at or below 25 words: ${result.text}`);
  assert.match(result.text, /stable-patient|clinic|staff|patients|follow-through|burden/i);
  assert.doesNotMatch(result.text, /^Given the time|I am still not hearing|something actionable|What would my team actually do differently/i);
});

test('operational burden audit rejects generic short-horizon workflow crutches', () => {
  const contract = scenarioContractById('hiv_pa_treat_switch_slowdown');
  const recent = ['Given the time, what would my team actually do differently next week?'];
  const crutch = detectGenericOperationalCrutch({
    reply: 'Given the time, what would my team actually do differently next week?',
    concernFamily: 'workflow',
  });
  const skeleton = detectRepeatedOperationalAskSkeleton({
    reply: 'Given the time, what would my team actually do differently next week?',
    recentHcpTurns: recent,
    concernFamily: 'workflow',
  });
  const horizon = detectSyntheticShortHorizon({
    reply: 'Given the time, what would my team actually do differently next week?',
    scenarioExecutionContract: contract,
  });

  assert.equal(crutch.crutch, true);
  assert.match(crutch.issues.join(' '), /stock_time_opener|team_action_stub|generic_do_differently|short_horizon_next_week/);
  assert.equal(skeleton.repeated, true);
  assert.equal(horizon.synthetic, true);
});

test('burden realism revises operational pressure toward implementation lift over time', () => {
  const contract = scenarioContractById('hiv_pa_treat_switch_slowdown');
  const activeAskState = { ...contract.activeAsk, askText: 'workflow next step ask', concernFamily: 'workflow' };
  const revised = reviseForBurdenRealism({
    scenarioExecutionContract: contract,
    activeAskState,
    recentHcpTurns: ['Given the time, what would my team actually do differently next week?'],
  });

  assertRichHcpLine(revised, 'burden realism rewrite');
  assert.ok(wordCount(revised) <= 25, `burden realism rewrite should stay at or below 25 words: ${revised}`);
  assert.match(revised, /time investment|required|absorb|follow-through|coming weeks|current process|burden/i);
  assert.doesNotMatch(revised, /what would my team actually do differently next week/i);
});

test('long-horizon deterministic rewrite does not regress into explicit generic repair crutches', () => {
  const contract = scenarioContractById('hiv_pa_treat_switch_slowdown');
  const activeAskState = { ...contract.activeAsk, askText: 'workflow next step ask', concernFamily: 'workflow' };
  const turns = Array.from({ length: 24 }, (_item, index) => (
    index % 2 === 0
      ? 'Given the time, what would my team actually do differently next week?'
      : 'I am still not hearing the operational step, and I cannot hand my team a concept. What would they do differently next week?'
  ));

  for (let index = 0; index < 60; index += 1) {
    const result = enforcePostGenerationHcpRealism({
      reply: index % 2 === 0
        ? 'Given the time, I need one practical point. What would my team actually do differently?'
        : 'I am still not hearing the operational step. What changes next week?',
      scenarioExecutionContract: contract,
      activeAskState,
      concernFamily: 'workflow',
      stateName: 'SOFT_RESISTANCE',
      cueCategory: 'time_constrained',
      recentHcpTurns: turns,
    });

    assertRichHcpLine(result.text, `long-horizon continuation turn ${index + 1}`);
    assert.ok(wordCount(result.text) <= 25, `long-horizon continuation turn ${index + 1} should stay at or below 25 words: ${result.text}`);
    assert.match(result.text, /stable-patient|clinic|staff|patients|follow-through|burden/i);
    assert.doesNotMatch(result.text, /^(Given the time,|I am still not hearing)|\bI need something actionable\b|\bWhat changes next week\b/i);
    turns.push(result.text);
  }
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

  assert.equal(hiv, 'Given the time investment required, what would staff need to absorb differently over the coming weeks if we changed follow-up now?');
  assert.equal(covid, 'That\'s exactly the issue, but I do not have bandwidth for theory. What would this look like in practice on day one?');
  assert.equal(formulary, 'If we move forward, I need more than a broad implementation idea. What is the realistic first step for my team?');
  assertRichHcpLine(hiv, 'scenario-bound HIV line');
  assertRichHcpLine(covid, 'scenario-bound COVID line');
  assertRichHcpLine(formulary, 'scenario-bound formulary line');
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
