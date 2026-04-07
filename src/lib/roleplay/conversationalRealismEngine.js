import { compressHcpDialogueForState, normalizeHcpSpokenRealism } from './dialogueGrammar.js';

export const CONVERSATIONAL_REALISM_ENGINE_VERSION = 'conversational_realism_engine_v1';

export const HCP_REALISM_STATES = Object.freeze({
  OPENING_CONSTRAINT: Object.freeze({
    behavioralIntent: 'establish_control_and_frame_scope',
    allowedToneRange: ['neutral', 'mildly_constrained'],
    allowedNextStates: ['TIME_PRESSURE_DEFLECTION', 'EVIDENCE_CHALLENGE', 'OPERATIONAL_CHALLENGE'],
    disallowedTransitions: ['hard_rejection', 'early_disengagement', 'high_pressure_escalation'],
    responseConstructionRules: Object.freeze([
      'establish_scope_without_rejection',
      'preserve_first_turn_protection',
      'include_time_or_context_pressure_without_disengagement',
    ]),
  }),
  TIME_PRESSURE_DEFLECTION: Object.freeze({
    behavioralIntent: 'limit_scope_due_to_time',
    allowedToneRange: ['efficient', 'slightly_clipped'],
    allowedNextStates: ['OPERATIONAL_CHALLENGE', 'EVIDENCE_CHALLENGE'],
    disallowedTransitions: ['broad_discovery', 'new_unbounded_topic'],
    responseConstructionRules: Object.freeze([
      'include_explicit_or_implicit_time_constraint',
      'limit_to_one_decision_relevant_or_operational_ask',
      'avoid_broad_exploration',
    ]),
  }),
  EVIDENCE_CHALLENGE: Object.freeze({
    behavioralIntent: 'demand_decision_relevant_proof',
    allowedToneRange: ['analytical', 'skeptical'],
    allowedNextStates: ['OPERATIONAL_CHALLENGE', 'PARTIAL_ENGAGEMENT'],
    disallowedTransitions: ['workflow_without_evidence_bridge', 'disengagement_without_pressure_state'],
    responseConstructionRules: Object.freeze([
      'include_evidence_threshold_question',
      'tie_proof_to_scenario_decision',
      'preserve_analytical_skepticism_without_disengagement',
    ]),
  }),
  OPERATIONAL_CHALLENGE: Object.freeze({
    behavioralIntent: 'force_practical_applicability',
    allowedToneRange: ['pragmatic', 'grounded'],
    allowedNextStates: ['PARTIAL_ENGAGEMENT', 'SOFT_RESISTANCE'],
    disallowedTransitions: ['abstract_evidence_loop', 'premature_acceptance'],
    responseConstructionRules: Object.freeze([
      'include_team_action_or_operational_owner',
      'force_practical_applicability',
      'avoid_abstract_theory_without_next_step',
    ]),
  }),
  PARTIAL_ENGAGEMENT: Object.freeze({
    behavioralIntent: 'conditional_openness',
    allowedToneRange: ['controlled', 'less_resistant'],
    allowedNextStates: ['DEEPER_EVALUATION', 'SOFT_RESISTANCE'],
    disallowedTransitions: ['full_acceptance_without_condition'],
    responseConstructionRules: Object.freeze([
      'express_conditional_openness',
      'preserve_one_unresolved_condition',
      'avoid_full_acceptance_without_rep_resolution',
    ]),
  }),
  SOFT_RESISTANCE: Object.freeze({
    behavioralIntent: 'maintain_hesitation_without_disengaging',
    allowedToneRange: ['reserved', 'cautious'],
    allowedNextStates: ['EVIDENCE_CHALLENGE', 'OPERATIONAL_CHALLENGE'],
    disallowedTransitions: ['new_broad_topic', 'generic_fallback'],
    responseConstructionRules: Object.freeze([
      'maintain_hesitation_without_terminal_exit',
      'return_to_evidence_or_operational_pressure',
      'avoid_new_broad_topic_or_generic_fallback',
    ]),
  }),
});

export function validateHcpRealismStateMachine(stateMachine = HCP_REALISM_STATES) {
  const issues = [];
  const stateNames = Object.keys(stateMachine || {});
  for (const stateName of stateNames) {
    const state = stateMachine[stateName] || {};
    if (!state.behavioralIntent) issues.push(`${stateName}:missing_behavioral_intent`);
    if (!Array.isArray(state.allowedToneRange) || state.allowedToneRange.length === 0) issues.push(`${stateName}:missing_allowed_tone_range`);
    if (!Array.isArray(state.allowedNextStates)) issues.push(`${stateName}:missing_allowed_next_states`);
    if (!Array.isArray(state.disallowedTransitions)) issues.push(`${stateName}:missing_disallowed_transitions`);
    if (!Array.isArray(state.responseConstructionRules) || state.responseConstructionRules.length === 0) issues.push(`${stateName}:missing_response_construction_rules`);
    for (const nextState of state.allowedNextStates || []) {
      if (!stateMachine[nextState] && nextState !== 'DEEPER_EVALUATION') issues.push(`${stateName}:unknown_next_state:${nextState}`);
    }
  }
  return {
    valid: issues.length === 0,
    issues,
    stateCount: stateNames.length,
  };
}

const SCENARIO_REALISM_PROFILES = Object.freeze({
  hiv_pa_treat_switch_slowdown: Object.freeze({
    defaultConcernFamily: 'evidence',
    lines: Object.freeze({
      TIME_PRESSURE_DEFLECTION: Object.freeze({
        evidence: 'Given how little time we have, what specific evidence actually justifies switching stable patients?',
        workflow: 'I remember that data, but I need something actionable. What would my team actually do differently next week?',
      }),
      EVIDENCE_CHALLENGE: Object.freeze({
        evidence: "I remember that data, but let me be direct: if I'm changing anything for stable patients, what evidence justifies the switch?",
        workflow: 'I remember that data, but the practical piece still matters. What would my team actually do differently next week?',
      }),
      OPERATIONAL_CHALLENGE: Object.freeze({
        evidence: 'Before we move on, connect the data to durability for my stable patients. What actually changes?',
        workflow: 'I remember that data, but I need something actionable. What would my team actually do differently next week?',
      }),
      SOFT_RESISTANCE: Object.freeze({
        evidence: "I'm still not hearing what changes for stable patients. What evidence justifies switching them?",
        workflow: 'I am still not hearing the operational step. What would my team do differently next week?',
      }),
      PARTIAL_ENGAGEMENT: Object.freeze({
        evidence: 'If the data are strong enough, tie it to durability for stable patients. What is the proof point?',
        workflow: 'If we did consider this, what would my team do differently next week?',
      }),
    }),
  }),
  covid_pulm_np_postcovid_adherence: Object.freeze({
    defaultConcernFamily: 'workflow',
    lines: Object.freeze({
      TIME_PRESSURE_DEFLECTION: Object.freeze({
        workflow: "That's exactly the issue, but I do not have bandwidth for theory. What would this look like in practice on day one?",
        evidence: 'I need this tied to the antiviral window. What proof point changes what we do before day four?',
      }),
      OPERATIONAL_CHALLENGE: Object.freeze({
        workflow: "That's exactly the issue, but I do not have bandwidth for theory. What would this look like in practice on day one?",
        evidence: 'Keep it tied to the antiviral window. What evidence changes the workflow before patients miss it?',
      }),
      SOFT_RESISTANCE: Object.freeze({
        workflow: "If it is not simple to operationalize, it is not happening. What does my team do first?",
        evidence: 'I am not asking for more theory. What proof changes what we do before day four?',
      }),
      PARTIAL_ENGAGEMENT: Object.freeze({
        workflow: 'If we tried this, what would my team do first on day one?',
        evidence: 'If the evidence supports it, what changes before day four?',
      }),
    }),
  }),
  'card-formulary': Object.freeze({
    defaultConcernFamily: 'evidence',
    lines: Object.freeze({
      TIME_PRESSURE_DEFLECTION: Object.freeze({
        evidence: 'Let me stop you there: this comes down to evidence. What single data point should influence this decision?',
        workflow: 'If we move forward, what is the realistic first step for my team?',
      }),
      EVIDENCE_CHALLENGE: Object.freeze({
        evidence: 'Let me stop you there: this comes down to evidence. What single data point should influence this decision?',
        workflow: 'If the committee moves forward, what is the realistic first step for my team?',
      }),
      OPERATIONAL_CHALLENGE: Object.freeze({
        evidence: 'Given the time constraints, what single data point should actually influence this decision?',
        workflow: 'If we move forward, what is the realistic first step for my team?',
      }),
      SOFT_RESISTANCE: Object.freeze({
        evidence: 'I need one decision-relevant data point, not a broader review. What should influence this decision?',
        workflow: 'If this is moving forward, what is the first step my team would actually take?',
      }),
      PARTIAL_ENGAGEMENT: Object.freeze({
        evidence: 'If we consider it, what single data point should influence the committee decision?',
        workflow: 'If the committee considers it, what would the first operational step be?',
      }),
    }),
  }),
});

function normalizeProfileFocus(value = '') {
  return normalizeHcpSpokenRealism(value)
    .replace(/\bscenario\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildContractDerivedRealismProfile(contract = {}) {
  const titleFocus = normalizeProfileFocus(contract?.scenarioIdentity?.title || '');
  const specialtyFocus = normalizeProfileFocus(contract?.scenarioIdentity?.specialty || '');
  const stakeholder = normalizeProfileFocus(contract?.hcpPersona?.stakeholder || 'my team');
  const focus = titleFocus || specialtyFocus || contract?.scenarioIdentity?.scenarioId || 'this case';
  const team = /team|committee|clinic|staff|nurse|pharmac/i.test(stakeholder) ? stakeholder : 'my team';
  return Object.freeze({
    profileSource: 'contract_derived_realism_profile',
    defaultConcernFamily: contract?.activeAsk?.concernFamily || contract?.openingState?.primaryConcernFamily || 'workflow',
    lines: Object.freeze({
      TIME_PRESSURE_DEFLECTION: Object.freeze({
        evidence: `Given the time, what evidence changes the decision in ${focus}?`,
        workflow: `Given the time, what would ${team} actually do first in ${focus}?`,
        access: `Given the time, what access step changes the delay in ${focus}?`,
        screening: `Given the time, who would we identify first in ${focus}?`,
      }),
      EVIDENCE_CHALLENGE: Object.freeze({
        evidence: `What evidence changes the decision in ${focus}?`,
        workflow: `What would ${team} actually do first in ${focus}?`,
        access: `What access step changes the delay in ${focus}?`,
        screening: `Who would we identify first in ${focus}?`,
      }),
      OPERATIONAL_CHALLENGE: Object.freeze({
        evidence: `What evidence changes the practical decision in ${focus}?`,
        workflow: `What would ${team} actually do first in ${focus}?`,
        access: `What access step changes the delay in ${focus}?`,
        screening: `Who would we identify first in ${focus}?`,
      }),
      SOFT_RESISTANCE: Object.freeze({
        evidence: `I still need the decision-relevant evidence for ${focus}. What changes the decision?`,
        workflow: `I still need the practical step for ${focus}. What would ${team} do first?`,
        access: `I still need the access step for ${focus}. What changes the delay?`,
        screening: `I still need the patient boundary for ${focus}. Who would we identify first?`,
      }),
      PARTIAL_ENGAGEMENT: Object.freeze({
        evidence: `If we continue with ${focus}, what evidence changes the decision?`,
        workflow: `If we continue with ${focus}, what would ${team} do first?`,
        access: `If we continue with ${focus}, what access step changes the delay?`,
        screening: `If we continue with ${focus}, who would we identify first?`,
      }),
    }),
  });
}

function selectProfileByState(contract = {}) {
  const scenarioId = contract?.scenarioIdentity?.scenarioId || contract?.scenarioId || '';
  const scenarioProfile = SCENARIO_REALISM_PROFILES[scenarioId];
  return scenarioProfile
    ? { ...scenarioProfile, profileSource: 'scenario_realism_profile' }
    : buildContractDerivedRealismProfile(contract);
}

function deriveStateNameFromStructuredInputs({ cueCategory = '', timePressure = false, terminalBehavior = false, activeAskState = {}, concernFamily = 'general' } = {}) {
  if (terminalBehavior) return concernFamily === 'workflow' ? 'OPERATIONAL_CHALLENGE' : 'EVIDENCE_CHALLENGE';
  if (timePressure || cueCategory === 'time_constrained') return 'TIME_PRESSURE_DEFLECTION';
  if (cueCategory === 'non_adaptive_impatience' || cueCategory === 'hard_escalation') return 'SOFT_RESISTANCE';
  const family = activeAskState?.concernFamily || concernFamily;
  if (family === 'evidence') return 'EVIDENCE_CHALLENGE';
  if (family === 'workflow' || family === 'access' || family === 'screening') return 'OPERATIONAL_CHALLENGE';
  return 'OPENING_CONSTRAINT';
}

function applyStateDrivenRealism({
  text = '',
  scenarioExecutionContract = null,
  activeAskState = null,
  concernFamily = 'general',
  cueCategory = 'neutral_attentive',
  terminalBehavior = false,
  timePressure = false,
} = {}) {
  if (!scenarioExecutionContract?.scenarioIdentity?.scenarioId) return null;
  const profile = selectProfileByState(scenarioExecutionContract);
  const resolvedConcern = activeAskState?.concernFamily
    || scenarioExecutionContract?.activeAsk?.concernFamily
    || concernFamily
    || profile.defaultConcernFamily;
  const stateName = deriveStateNameFromStructuredInputs({
    cueCategory,
    timePressure,
    terminalBehavior,
    activeAskState: activeAskState || scenarioExecutionContract?.activeAsk || {},
    concernFamily: resolvedConcern,
  });
  const state = HCP_REALISM_STATES[stateName] || HCP_REALISM_STATES.OPENING_CONSTRAINT;
  const stateLines = profile.lines[stateName] || profile.lines.OPERATIONAL_CHALLENGE || profile.lines.EVIDENCE_CHALLENGE || {};
  const selected = stateLines[resolvedConcern] || stateLines[profile.defaultConcernFamily] || stateLines.workflow || stateLines.evidence;
  if (!selected) return null;
  return {
    text: selected,
    metadata: {
      stateName,
      state,
      concernFamily: resolvedConcern,
      scenarioId: scenarioExecutionContract.scenarioIdentity.scenarioId,
      source: profile.profileSource || 'scenario_realism_profile',
    },
  };
}

export function validateLiveHcpRealismRenderInputs({
  scenarioExecutionContract = null,
  activeAskState = null,
  stateDrivenResult = null,
} = {}) {
  const issues = [];
  if (!scenarioExecutionContract?.scenarioIdentity?.scenarioId) issues.push('missing_scenario_execution_contract');
  if (!activeAskState?.askText) issues.push('missing_active_ask_state_text');
  if (!activeAskState?.concernFamily) issues.push('missing_active_ask_state_family');
  const stateName = stateDrivenResult?.metadata?.stateName;
  if (!stateName || !HCP_REALISM_STATES[stateName]) issues.push('missing_valid_realism_state');
  return {
    valid: issues.length === 0,
    issues,
  };
}

export function assertLiveHcpRealismRenderInputs(inputs = {}) {
  const validation = validateLiveHcpRealismRenderInputs(inputs);
  if (!validation.valid) {
    throw new Error(`Live HCP rendering requires scenarioExecutionContract, activeAskState, and valid realism state: ${validation.issues.join(',')}`);
  }
  return validation;
}

const PRESSURE_CATEGORIES = new Set([
  'focused_narrowing',
  'non_adaptive_impatience',
  'time_constrained',
  'hard_escalation',
  'terminal_exit',
]);

const SOFT_COLLABORATIVE_PATTERN = /\b(i can stay with this|happy to|let'?s explore|we can talk through|i'?m open to discussing)\b/i;
const CONSTRAINED_DIRECT_ASK_PATTERN = /\bi can stay with this if we make it concrete\.[^.?!]*\bwhat\b/i;
const TERMINAL_PATTERN = /\b(pause here|stop here|get back to clinic|we are done|ending|wrap|one point|then show me|move on)\b/i;
const FORMAL_EXPANSION_PATTERN = /\b(to directly address|to address your follow-up|can you specifically elaborate|supports the long-term durability|treatment regimens)\b/i;

function normalizeRuntimeText(...values) {
  return values.map((value) => String(value || '').toLowerCase()).join(' ');
}

function deriveScenarioArchetype({ scenarioContext = '', activeAsk = '', text = '' } = {}) {
  const combined = normalizeRuntimeText(scenarioContext, activeAsk, text);
  if (/\b(stable hiv|stable,? suppressed|suppressed patients|michael chen)\b/.test(combined)) return 'stable_hiv_optimization';
  if (/\bdurability\b/.test(combined) && /\bstable patients?\b/.test(combined)) return 'stable_hiv_optimization';
  if (/\b(post-?covid|antiviral|day 4|day 5|callback list)\b/.test(combined)) return 'post_covid_antiviral_adherence';
  if (/\b(formulary|p&t|committee|cardiology|budget reports?)\b/.test(combined)) return 'cardiology_formulary_review';
  return 'general';
}

function deriveExpressionConcernFamily({ concernFamily = 'general', activeAsk = '', text = '', scenarioContext = '' } = {}) {
  const ask = normalizeRuntimeText(activeAsk);
  const combined = normalizeRuntimeText(activeAsk, text, scenarioContext);
  if (/\b(workflow|staff|team|operational|practice|day one|do differently|first step)\b/.test(ask)) return 'workflow';
  if (/\b(durability|evidence|proof|data point|decision-relevant|outcomes?|justify|justifies|formulary)\b/.test(ask)) return 'evidence';
  if (/\b(access|coverage|payer|prior auth|copay)\b/.test(ask)) return 'access';
  if (/\b(screen|candidate|criteria|patient selection)\b/.test(ask)) return 'screening';
  if (concernFamily && concernFamily !== 'general') return concernFamily;
  if (/\b(durability|evidence|proof|data point|decision-relevant|outcomes?|justify|justifies|formulary)\b/.test(combined)) return 'evidence';
  if (/\b(workflow|staff|team|operational|practice|day one|do differently|first step)\b/.test(combined)) return 'workflow';
  return concernFamily || 'general';
}

function isGenericCompressedAsk(text = '') {
  return /\b(make it concrete|make it practical|what would my (?:team|staff) do first|what evidence point changes the decision|how does that change the decision)\b/i.test(text);
}

function selectScenarioGroundedHcpLine({
  text = '',
  activeAsk = '',
  scenarioContext = '',
  concernFamily = 'general',
  cueCategory = 'neutral_attentive',
  terminalBehavior = false,
  timePressure = false,
} = {}) {
  const scenarioArchetype = deriveScenarioArchetype({ scenarioContext, activeAsk, text });
  const expressionConcern = deriveExpressionConcernFamily({ concernFamily, activeAsk, text, scenarioContext });
  const highPressure = /focused_narrowing|non_adaptive_impatience|time_constrained|hard_escalation|terminal_exit/i.test(cueCategory)
    || terminalBehavior
    || timePressure;
  const shouldReplace = highPressure && isGenericCompressedAsk(text);
  if (!shouldReplace) return text;

  if (scenarioArchetype === 'stable_hiv_optimization') {
    if (expressionConcern === 'evidence') {
      if (cueCategory === 'terminal_exit' || terminalBehavior) {
        return "I'm about to move on. If this changes durability for stable patients, what is the evidence point?";
      }
      if (cueCategory === 'time_constrained' || timePressure) {
        return 'Given how little time we have, what specific evidence actually justifies switching stable patients?';
      }
      return "I remember that data, but let me be direct: if I'm changing anything for stable patients, what evidence justifies the switch?";
    }
    if (expressionConcern === 'workflow') {
      if (cueCategory === 'terminal_exit' || terminalBehavior) {
        return "I'm about to move on. If this is real, what would my team do differently next week?";
      }
      return "I remember that data, but I need something actionable. What would my team actually do differently next week?";
    }
  }

  if (scenarioArchetype === 'post_covid_antiviral_adherence') {
    if (cueCategory === 'terminal_exit' || terminalBehavior) {
      return "I'm watching the clock. If this is not simple to operationalize, it's not happening.";
    }
    return "That's exactly the issue, but I do not have bandwidth for theory. What would this look like in practice on day one?";
  }

  if (scenarioArchetype === 'cardiology_formulary_review') {
    if (expressionConcern === 'evidence') {
      if (cueCategory === 'terminal_exit' || terminalBehavior) {
        return "I'm about to move on. What single data point should influence this decision?";
      }
      return 'Let me stop you there: this comes down to evidence. What single data point should influence this decision?';
    }
    if (expressionConcern === 'workflow') {
      if (cueCategory === 'terminal_exit' || terminalBehavior) {
        return "I'm about to move on. If we move forward, what is the first step for my team?";
      }
      return 'What is the realistic first step for my team?';
    }
  }

  return text;
}

function isHighPressureState({ cueCategory = '', interactionMode = '', engagementTier = '', semanticStage = '', terminalBehavior = false } = {}) {
  if (terminalBehavior) return true;
  return /terminal_exit|hard_escalation|time_constrained|non_adaptive_impatience|focused_narrowing|closing|disengaging|directive|hard|terminal/i
    .test(`${cueCategory} ${interactionMode} ${engagementTier} ${semanticStage}`);
}

function compressFormalQuestionToSingleAsk({ text = '', concernFamily = 'general', cueCategory = 'neutral_attentive' } = {}) {
  const value = normalizeHcpSpokenRealism(text);
  const isTerminal = cueCategory === 'terminal_exit';
  const terminalLead = isTerminal ? "I'm about to move on. " : '';

  if (concernFamily === 'workflow' || /workflow|staff|team|clinic flow|practical/i.test(value)) {
    return isTerminal
      ? "I'm about to move on, but make it practical. What would my team do first?"
      : 'I can stay with this if we make it concrete. What would my team do first?';
  }
  if (concernFamily === 'access' || /access|coverage|payer|prior auth|copay/i.test(value)) {
    return `${terminalLead}what is the access step here?`.replace(/^([a-z])/, (_match, c) => c.toUpperCase());
  }
  if (concernFamily === 'screening' || /screen|candidacy|criteria|resistance|patient selection/i.test(value)) {
    return `${terminalLead}who would you screen first?`.replace(/^([a-z])/, (_match, c) => c.toUpperCase());
  }
  if (concernFamily === 'evidence' || /durability|evidence|proof|data|decision|regimen/i.test(value)) {
    if (/stable/i.test(value)) return `${terminalLead}how does that affect durability for stable patients?`.replace(/^([a-z])/, (_match, c) => c.toUpperCase());
    return `${terminalLead}how does that change the decision?`.replace(/^([a-z])/, (_match, c) => c.toUpperCase());
  }
  return isTerminal ? 'One point: what changes here?' : 'Then give me the practical point.';
}

export function enforceTerminalCompression({ text, concernFamily = 'general', cueCategory = 'terminal_exit' } = {}) {
  let value = normalizeHcpSpokenRealism(text)
    .replace(/^To directly address[^.?!]*[.?!]\s*/i, '')
    .replace(/^To address[^.?!]*[.?!]\s*/i, '')
    .replace(/\bCan you specifically elaborate on how\b/gi, 'How does')
    .replace(/\bcan you specifically elaborate on how\b/g, 'how does')
    .replace(/\bsupports the long-term durability of treatment regimens for\b/gi, 'affect durability for')
    .replace(/\bsupport the long-term durability of treatment regimens for\b/gi, 'affect durability for')
    .replace(/\bsupports long-term durability of treatment regimens for\b/gi, 'affect durability for')
    .replace(/\btreatment regimens\b/gi, 'treatments')
    .replace(/\s{2,}/g, ' ')
    .trim();

  value = normalizeHcpSpokenRealism(value);
  if (concernFamily === 'workflow' || /workflow|staff|team|clinic flow|practical/i.test(value)) {
    value = value
      .replace(/^What is the first practical workflow step here\?$/i, 'I can stay with this if we make it concrete. What would my team do first?')
      .replace(/^Start with one practical workflow step my team could actually use\.?$/i, 'I can stay with this if we make it concrete. What would my team do first?')
      .replace(/^Keep it to one workflow step we could use here\.?$/i, 'I can stay with this if we make it concrete. What would my team do first?')
      .replace(/^Tell me the first practical workflow step you would recommend\.?$/i, 'I can stay with this if we make it concrete. What would my team do first?');
    if (cueCategory === 'terminal_exit') {
      value = value.replace(/^I can stay with this if we make it concrete\. What would my team do first\?$/i, "I'm about to move on, but make it practical. What would my team do first?");
    }
  }
  if (concernFamily === 'evidence' || /evidence|proof|data|decision|durability|formulary/i.test(value)) {
    value = value
      .replace(/^Given the time, what is the one decision-relevant evidence point\?$/i, 'Given the time, what evidence point changes the decision?')
      .replace(/^How does that change the decision\?$/i, 'Can you tie that to the decision?')
      .replace(/^Before we move on, can you tie that to durability for my stable patients\?$/i, 'Before we move on, can you tie that to durability for my stable patients?');
    if (cueCategory === 'terminal_exit') {
      value = value.replace(/^Given the time, what evidence point changes the decision\?$/i, "I'm about to move on. What evidence point changes the decision?");
    }
  }
  const overpacked = detectOverpackedSentence({ text: value });
  if (FORMAL_EXPANSION_PATTERN.test(text) || overpacked.overpacked || overpacked.wordCount > 16) {
    return compressFormalQuestionToSingleAsk({ text: value, concernFamily, cueCategory });
  }
  return value;
}

function normalizeRecentTurns(recentHcpTurns = []) {
  return (Array.isArray(recentHcpTurns) ? recentHcpTurns : [])
    .map((turn) => String(turn?.hcpDialogueBefore || turn?.hcpDialogue || turn || '').trim())
    .filter(Boolean)
    .slice(-4);
}

function phraseFamilyForText(text = '', concernFamily = 'general') {
  const value = String(text || '').toLowerCase();
  if (/durability|evidence|proof|data|decision/.test(value)) return 'evidenceAsk';
  if (/workflow|staff|team|practical|own first|do first/.test(value)) return 'workflowAsk';
  if (/access|coverage|payer|prior|auth|copay/.test(value)) return 'accessAsk';
  if (/screen|candidacy|criteria|patient selection|resistance/.test(value)) return 'screeningAsk';
  if (/pause here|stop here|wrap|get back/.test(value)) return 'closingThreshold';
  return `${concernFamily || 'general'}Ask`;
}

export function detectOverpackedSentence({ text } = {}) {
  const value = String(text || '').trim();
  if (!value) return { overpacked: false, wordCount: 0, clauseCount: 0, reasons: [] };
  const wordCount = value.split(/\s+/).filter(Boolean).length;
  const clauseCount = (value.match(/[,;:—-]/g) || []).length + 1;
  const reasons = [];
  if (wordCount > 26) reasons.push('too_many_words');
  if (clauseCount > 3) reasons.push('too_many_clauses');
  if (/\bwhich (?:was|is)|\bas that (?:is|was)|\bin the context of\b/i.test(value)) reasons.push('formal_meta_labeling');
  return { overpacked: reasons.length > 0, wordCount, clauseCount, reasons };
}

export function humanizeClinicalReferences({ text, concernFamily = 'general', scenarioContext = '' } = {}) {
  return normalizeHcpSpokenRealism(text)
    .replace(/\bthe treatment options you mentioned last week\b/gi, 'what you showed last week')
    .replace(/\bthe outcomes data you shared last week\b/gi, 'that data you shared last week')
    .replace(/\bthe evidence you referenced previously\b/gi, 'that evidence')
    .replace(/\bthe operational implications for my staff\b/gi, 'what my staff would actually do')
    .replace(/\bin the context of our current standard of care\b/gi, 'for the patients we are actually treating')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function reduceFormalMetaLabeling({ text } = {}) {
  const reduced = String(text || '')
    .replace(/,?\s+which was my primary concern\??/gi, '')
    .replace(/,?\s+which is my primary concern\??/gi, '')
    .replace(/,?\s+as that (?:is|was) the key factor in my decision\.?/gi, '. That is what matters here.')
    .replace(/,?\s+which is the most important consideration\??/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return normalizeHcpSpokenRealism(reduced);
}

export function enforceSpokenLanguage({ text, interactionMode = '', engagementTier = '' } = {}) {
  let value = normalizeHcpSpokenRealism(text);
  value = reduceFormalMetaLabeling({ text: value });

  if (/directive|closing|constrained|impatient|hard|terminal/i.test(`${interactionMode} ${engagementTier}`)) {
    value = value
      .replace(/^I can stay with this if we make it concrete\./i, 'Okay, make it concrete.')
      .replace(/^Before we get into new data, can you tie that data to/i, 'Before we move on, can you tie that to')
      .replace(/^Before we get into new data, can you tie that to/i, 'Before we move on, can you tie that to')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  return normalizeHcpSpokenRealism(value);
}

export function compressByState({ text, concernFamily = 'general', cueCategory = 'neutral_attentive' } = {}) {
  return compressHcpDialogueForState(text, { cueCategory, concernFamily });
}

export function splitOrCompressSentence({ text, interactionMode = '', cueCategory = 'neutral_attentive', concernFamily = 'general' } = {}) {
  const compressed = compressByState({ text, cueCategory, concernFamily });
  const overpacked = detectOverpackedSentence({ text: compressed });
  if (!overpacked.overpacked || cueCategory === 'neutral_attentive') return compressed;
  if (/hard_escalation|terminal_exit/.test(cueCategory)) return compressByState({ text: compressed, cueCategory, concernFamily });
  return enforceSpokenLanguage({ text: compressed, interactionMode, engagementTier: cueCategory });
}

export function varyPressurePhrasing({ text, concernFamily = 'general', recentHcpTurns = [], interactionMode = '', cueCategory = 'neutral_attentive' } = {}) {
  const currentFamily = phraseFamilyForText(text, concernFamily);
  const recent = normalizeRecentTurns(recentHcpTurns);
  const repeatedFamilyCount = recent.filter((turn) => phraseFamilyForText(turn, concernFamily) === currentFamily).length;
  if (repeatedFamilyCount < 2) {
    return { text, phraseFamily: currentFamily, repeatedFamilyCount, changed: false };
  }

  const tightened = compressByState({ text, concernFamily, cueCategory: PRESSURE_CATEGORIES.has(cueCategory) ? cueCategory : 'focused_narrowing' });
  return {
    text: tightened,
    phraseFamily: currentFamily,
    repeatedFamilyCount,
    changed: tightened !== text,
  };
}

export function validateCueDialogueLockstep({ cueCategory = 'neutral_attentive', interactionMode = '', engagementTier = '', semanticStage = '', finalText = '' } = {}) {
  const text = String(finalText || '').trim();
  const mismatchReasons = [];
  if (cueCategory === 'terminal_exit' && !TERMINAL_PATTERN.test(text)) mismatchReasons.push('terminal_cue_without_terminal_dialogue');
  if (cueCategory === 'time_constrained' && detectOverpackedSentence({ text }).wordCount > 22) mismatchReasons.push('time_constrained_dialogue_too_long');
  if (cueCategory === 'hard_escalation' && SOFT_COLLABORATIVE_PATTERN.test(text) && !CONSTRAINED_DIRECT_ASK_PATTERN.test(text)) {
    mismatchReasons.push('hard_escalation_with_soft_framing');
  }
  return {
    aligned: mismatchReasons.length === 0,
    mismatchReasons,
  };
}

export function applyConversationalRealism({
  text,
  activeAsk = '',
  activeAskState = null,
  concernFamily = 'general',
  engagementTier = '',
  interactionMode = '',
  semanticStage = '',
  terminalBehavior = false,
  timePressure = false,
  cueCategory = 'neutral_attentive',
  conversationIntelligence = null,
  recentHcpTurns = [],
  scenarioContext = '',
  scenarioExecutionContract = null,
  requireContractBound = false,
} = {}) {
  const resolvedCueCategory = terminalBehavior
    ? 'terminal_exit'
    : (timePressure && cueCategory === 'neutral_attentive' ? 'time_constrained' : cueCategory || 'neutral_attentive');

  const stateDriven = applyStateDrivenRealism({
    text,
    scenarioExecutionContract,
    activeAskState,
    concernFamily,
    cueCategory: resolvedCueCategory,
    terminalBehavior,
    timePressure,
  });
  if (stateDriven) {
    if (requireContractBound) {
      assertLiveHcpRealismRenderInputs({
        scenarioExecutionContract,
        activeAskState,
        stateDrivenResult: stateDriven,
      });
    }
    const finalStateText = normalizeHcpSpokenRealism(stateDriven.text);
    return {
      text: finalStateText,
      metadata: {
        version: CONVERSATIONAL_REALISM_ENGINE_VERSION,
        cueCategory: resolvedCueCategory,
        concernFamily: stateDriven.metadata.concernFamily,
        stateName: stateDriven.metadata.stateName,
        stateBehavioralIntent: stateDriven.metadata.state.behavioralIntent,
        scenarioId: stateDriven.metadata.scenarioId,
        phraseFamily: phraseFamilyForText(finalStateText, stateDriven.metadata.concernFamily),
        repeatedFamilyCount: 0,
        lockstep: validateCueDialogueLockstep({
          cueCategory: resolvedCueCategory,
          interactionMode,
          engagementTier,
          semanticStage,
          finalText: finalStateText,
        }),
        overpacked: detectOverpackedSentence({ text: finalStateText }),
        activeAskPresent: Boolean(String(activeAsk || activeAskState?.askText || '').trim()),
        terminalCompressionApplied: false,
        conversationIntelligenceProgression: conversationIntelligence?.turnInterpretation?.progression || null,
        renderingSource: stateDriven.metadata.source,
      },
    };
  }

  if (requireContractBound) {
    assertLiveHcpRealismRenderInputs({
      scenarioExecutionContract,
      activeAskState,
      stateDrivenResult: stateDriven,
    });
  }

  const expressionConcernFamily = deriveExpressionConcernFamily({ concernFamily, activeAsk, text, scenarioContext });

  const grammarNormalized = normalizeHcpSpokenRealism(text);
  const humanized = humanizeClinicalReferences({ text: grammarNormalized, concernFamily: expressionConcernFamily, scenarioContext });
  const spoken = enforceSpokenLanguage({ text: humanized, interactionMode, engagementTier });
  const terminalCompressed = isHighPressureState({
    cueCategory: resolvedCueCategory,
    interactionMode,
    engagementTier,
    semanticStage,
    terminalBehavior,
  })
    ? enforceTerminalCompression({ text: spoken, concernFamily: expressionConcernFamily, cueCategory: resolvedCueCategory })
    : spoken;
  const compressed = splitOrCompressSentence({ text: terminalCompressed, interactionMode, cueCategory: resolvedCueCategory, concernFamily: expressionConcernFamily });
  const scenarioGrounded = selectScenarioGroundedHcpLine({
    text: compressed,
    activeAsk,
    scenarioContext,
    concernFamily: expressionConcernFamily,
    cueCategory: resolvedCueCategory,
    terminalBehavior,
    timePressure,
  });
  const varied = varyPressurePhrasing({ text: scenarioGrounded, concernFamily: expressionConcernFamily, recentHcpTurns, interactionMode, cueCategory: resolvedCueCategory });
  const lockstep = validateCueDialogueLockstep({
    cueCategory: resolvedCueCategory,
    interactionMode,
    engagementTier,
    semanticStage,
    finalText: varied.text,
  });
  const finalText = lockstep.aligned
    ? varied.text
    : enforceTerminalCompression({
      text: compressByState({ text: varied.text, concernFamily: expressionConcernFamily, cueCategory: resolvedCueCategory }),
      concernFamily: expressionConcernFamily,
      cueCategory: resolvedCueCategory,
    });

  return {
    text: normalizeHcpSpokenRealism(finalText),
    metadata: {
      version: CONVERSATIONAL_REALISM_ENGINE_VERSION,
      cueCategory: resolvedCueCategory,
      concernFamily: expressionConcernFamily,
      scenarioArchetype: deriveScenarioArchetype({ scenarioContext, activeAsk, text }),
      phraseFamily: varied.phraseFamily,
      repeatedFamilyCount: varied.repeatedFamilyCount,
      lockstep,
      overpacked: detectOverpackedSentence({ text: finalText }),
      activeAskPresent: Boolean(String(activeAsk || '').trim()),
      terminalCompressionApplied: terminalCompressed !== spoken || finalText !== varied.text,
      conversationIntelligenceProgression: conversationIntelligence?.turnInterpretation?.progression || null,
    },
  };
}
