import {
  compressHcpDialogueForState,
  detectClauseStitchFailure,
  normalizeHcpSpokenRealism,
  reviseForSentenceIntegrity,
} from './dialogueGrammar.js';

export const CONVERSATIONAL_REALISM_ENGINE_VERSION = 'conversational_realism_engine_v1';

const HCP_DIALOGUE_MIN_WORDS = 8;
const HCP_REALISM_MEMORY_TURN_LIMIT = 80;
const HCP_PHRASE_EXHAUSTION_THRESHOLD = 2;

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
        evidence: 'Before we discuss new data, can you tie what you showed last week to long-term durability for stable patients and why that justifies switching?',
        workflow: 'I remember that data, but before I ask staff to shift stable-patient follow-up, what burden would they absorb over the coming weeks?',
      }),
      EVIDENCE_CHALLENGE: Object.freeze({
        evidence: "I remember that data, but let me be direct: if I'm changing anything for stable patients, what evidence actually justifies the switch?",
        workflow: 'The practical piece still matters before I change clinic flow; who on staff ends up carrying this over the coming weeks?',
      }),
      OPERATIONAL_CHALLENGE: Object.freeze({
        evidence: 'Before we move on, connect the data to durability for my stable patients in a way that changes the decision. What actually changes?',
        workflow: 'I remember that data, but before I ask staff to shift stable-patient follow-up, what burden would they absorb over the coming weeks?',
      }),
      SOFT_RESISTANCE: Object.freeze({
        evidence: "I'm still not hearing what changes for stable patients, and I do not want a broader data recap. What evidence justifies switching them?",
        workflow: 'Stable patients are not a quick switch; if we changed course, what extra lift would nurses or staff carry afterward?',
      }),
      PARTIAL_ENGAGEMENT: Object.freeze({
        evidence: 'If the data are strong enough, tie it to durability for stable patients and the decision in front of me. What is the proof point?',
        workflow: 'If we considered this, I am trying to picture the staff day: who handles the extra work once patients are already stable?',
      }),
    }),
  }),
  covid_pulm_np_postcovid_adherence: Object.freeze({
    defaultConcernFamily: 'workflow',
    lines: Object.freeze({
      TIME_PRESSURE_DEFLECTION: Object.freeze({
        workflow: 'Patients are already close to missing the window, so who on staff catches this, and what extra step lands during callbacks?',
        evidence: 'I need this tied to the antiviral window, not a general outcomes story. What proof point changes what we do before day four?',
      }),
      OPERATIONAL_CHALLENGE: Object.freeze({
        workflow: 'I need to picture the callback handoff: who picks up the patient, and what slows the antiviral decision before day four?',
        evidence: 'Keep it tied to the antiviral window and the clinic process. What evidence changes the workflow before patients miss it?',
      }),
      EVIDENCE_CHALLENGE: Object.freeze({
        workflow: 'Patients are already close to missing the window, so who on staff catches this, and what extra step lands during callbacks?',
        evidence: 'Keep it tied to the antiviral window and the clinic process. What evidence changes the workflow before patients miss it?',
      }),
      SOFT_RESISTANCE: Object.freeze({
        workflow: 'If this adds another clinic step, who carries it when patients are near day four, and what gets dropped first?',
        evidence: 'I am not asking for more theory while patients are missing the window. What proof changes what we do before day four?',
      }),
      PARTIAL_ENGAGEMENT: Object.freeze({
        workflow: 'If we tried this, I need to know which staff member catches the delay and what changes during the callback rush.',
        evidence: 'If the evidence supports it, what changes before day four, and how would my team act on that in clinic?',
      }),
    }),
  }),
  'card-formulary': Object.freeze({
    defaultConcernFamily: 'evidence',
    lines: Object.freeze({
      TIME_PRESSURE_DEFLECTION: Object.freeze({
        evidence: 'Let me stop you there: this comes down to evidence and time. What single data point should actually influence this committee decision?',
        workflow: 'This should not go anywhere until we know who on the committee carries the added review work and what slows decisions.',
      }),
      EVIDENCE_CHALLENGE: Object.freeze({
        evidence: 'Let me stop you there: this comes down to evidence and time. What single data point should actually influence this committee decision?',
        workflow: 'If the committee moves forward, which staff member carries the review work, and what slows the decision process down here?',
      }),
      OPERATIONAL_CHALLENGE: Object.freeze({
        evidence: 'Given the time constraints, what single data point should actually influence this decision, not just support a broader review?',
        workflow: 'This should not go anywhere until we know who on the committee carries the added review work and what slows decisions.',
      }),
      SOFT_RESISTANCE: Object.freeze({
        evidence: 'I need one decision-relevant data point, not a broader review or summary. What should actually influence this committee decision today?',
        workflow: 'If this moves forward, who carries the extra review work, and where does it slow the committee down first today?',
      }),
      PARTIAL_ENGAGEMENT: Object.freeze({
        evidence: 'If we consider it, what single data point should influence the committee decision, and why should we trust that threshold?',
        workflow: 'If the committee considers it, I need to know who carries the review work and what changes before the vote.',
      }),
    }),
  }),
});

function deriveContractProfileBucket(contract = {}) {
  const context = [
    contract?.scenarioIdentity?.scenarioId,
    contract?.scenarioIdentity?.title,
    contract?.scenarioIdentity?.category,
    contract?.scenarioIdentity?.specialty,
    contract?.hcpPersona?.stakeholder,
    contract?.hcpPersona?.personaPrimary,
    contract?.hcpPersona?.influenceDriver,
    contract?.managerIntegration?.scenarioFamily,
    contract?.managerIntegration?.interactionSkill,
    contract?.activeAsk?.concernFamily,
    contract?.openingState?.primaryConcernFamily,
    ...(Array.isArray(contract?.constraints?.challenges) ? contract.constraints.challenges : []),
  ].filter(Boolean).join(' ').toLowerCase();

  if (/\b(committee|formulary|p&t|budget|agenda)\b/.test(context)) return 'committee';
  if (/\b(access|prior auth|prior-auth|authorization|coverage|payer|reimbursement|copay|admin|administrative)\b/.test(context)) return 'access_process';
  if (/\b(screening|screen|diagnos|eligib|candidate|patient selection|identify|identification)\b/.test(context)) return 'screening_evaluation';
  if (/\b(clinic|provider|patient|care|nurse|staff|workflow|implementation|operational|specialty|internal medicine|cardiology|oncology|pulm|infectious)\b/.test(context)) return 'clinic_team';
  return 'clinic_team';
}

function contractProfileSettingForBucket(bucket = 'clinic_team') {
  if (bucket === 'committee') return 'for this committee';
  if (bucket === 'access_process') return 'in our process';
  return 'here';
}

function contractProfileWorkflowAskForBucket(bucket = 'clinic_team') {
  if (bucket === 'committee') return 'what should this committee do first, and what would that change operationally';
  if (bucket === 'access_process') return 'what would we change first in our process, and how would it reduce the delay';
  if (bucket === 'screening_evaluation') return 'what would we do first here, and which patients would that help us identify';
  return 'who on my team would handle the added work, and what changes in their day over time';
}

function capitalizeQuestion(value = '') {
  const text = String(value || '').trim().replace(/\?*$/, '');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}?`;
}

function capitalizeSentenceStart(value = '') {
  const text = String(value || '').trim();
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function countWords(value = '') {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function normalizeDialogueSignature(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function cleanScenarioPressureFragment(value = '') {
  return String(value || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\b(limited|inconsistent|competing|need|lack of|reluctance to|perception of)\b/gi, '')
    .replace(/[^a-z0-9,\s-]/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toLowerCase();
}

function deriveScenarioPressureClause(scenarioExecutionContract = {}, bucket = 'clinic_team') {
  const challenge = cleanScenarioPressureFragment(scenarioExecutionContract?.constraints?.challenges?.[0]);
  if (/stable.*(?:suppressed|patient)|suppressed.*patient/.test(challenge)) return 'the stable-patient optimization';
  if (challenge) return `the ${challenge} issue`;
  if (bucket === 'committee') return 'this committee decision';
  if (bucket === 'access_process') return 'the access delay';
  if (bucket === 'screening_evaluation') return 'the patient identification step';
  return 'the clinic issue';
}

function buildRepeatedStateDrivenLine({ concernFamily = 'general', scenarioExecutionContract = null } = {}) {
  const bucket = deriveContractProfileBucket(scenarioExecutionContract || {});
  const pressureClause = deriveScenarioPressureClause(scenarioExecutionContract || {}, bucket);
  if (bucket === 'committee') {
    if (concernFamily === 'workflow') return `I do not need another overview; ${pressureClause} still needs an operational step. What would the team own first?`;
    return `I do not need another overview; ${pressureClause} still needs a decision point. What evidence changes the recommendation today?`;
  }
  if (bucket === 'access_process') return `I do not need another overview; ${pressureClause} still needs a process step. What would reduce the delay next?`;
  if (bucket === 'screening_evaluation') return `I do not need another setup; ${pressureClause} still needs a patient boundary. Who would we identify first today?`;
  if (concernFamily === 'evidence') return `I do not need another setup; ${pressureClause} still needs a proof point. What evidence changes the clinical decision today?`;
  return `I do not need another setup; ${pressureClause} still needs a practical step. What would my team do first?`;
}

function buildLateStageDecisionLine({ concernFamily = 'general', scenarioExecutionContract = null, recentHcpTurns = [] } = {}) {
  const bucket = deriveContractProfileBucket(scenarioExecutionContract || {});
  const pressureClause = deriveScenarioPressureClause(scenarioExecutionContract || {}, bucket);
  const pressureStart = capitalizeSentenceStart(pressureClause);
  const memory = deriveRealismMemory({ recentHcpTurns, concernFamily });
  const recentSignatures = new Set(normalizeRecentTurns(recentHcpTurns).map((turn) => normalizeDialogueSignature(turn)));
  const candidates = (() => {
    if (bucket === 'committee' || concernFamily === 'evidence') {
      return [
        `${pressureStart} is still unresolved for this decision; what evidence offsets that enough to keep the recommendation moving today?`,
        `If ${pressureClause.replace(/ issue$/i, '')} still outweighs the benefit, this may need to wait; what evidence changes that decision today?`,
        `The decision is not moving on a summary now; connect ${pressureClause.replace(/^the /i, '')} to the evidence threshold this committee can use today.`,
      ];
    }
    if (bucket === 'access_process' || concernFamily === 'access') {
      return [
        `${pressureStart} is still unresolved in our process; what changes the handoff enough to reduce the delay today?`,
        `If ${pressureClause} keeps slowing the process, this may need to wait; what handoff change reduces the delay today?`,
        `The access issue is not a concept problem now; show me the process handoff that reduces the delay without adding churn.`,
      ];
    }
    if (bucket === 'screening_evaluation' || concernFamily === 'screening') {
      return [
        `${pressureStart} is still unresolved for us; who would we identify first without adding another screening step today?`,
        `If ${pressureClause} still adds ambiguity, this may need to wait; who would we identify first without another screening step?`,
        `The screening boundary still is not usable enough; tell me which patients we would identify first without widening the workup.`,
      ];
    }
    return [
      `${pressureStart} is still unresolved for clinic flow; what changes for staff without adding another step in clinic next week?`,
      `If ${pressureClause} still adds work, this may need to wait; what would staff absorb without another clinic step next week?`,
      `The clinic issue is not solved by another overview now; show me the staff handoff that would fit without adding steps.`,
      `I am weighing whether this belongs in our current process; what changes for patients without pushing more work onto staff?`,
    ];
  })();
  return candidates.find((candidate) => {
    const signature = normalizeDialogueSignature(candidate);
    if (recentSignatures.has(signature)) return false;
    const opening = openingStructureFamily(candidate);
    const askShape = terminalAskShapeFamily(candidate);
    const angle = operationalAngleFamily(candidate);
    if (opening && memory.exhausted.openingStructures.includes(opening)) return false;
    if (askShape && memory.exhausted.askStructures.includes(askShape)) return false;
    if (angle && memory.exhausted.operationalAngles.includes(angle)) return false;
    return true;
  }) || candidates.find((candidate) => !recentSignatures.has(normalizeDialogueSignature(candidate))) || candidates[candidates.length - 1];
}

function buildStateDrivenRealismExpansion({ concernFamily = 'general', stateName = 'OPENING_CONSTRAINT', repeated = false, scenarioExecutionContract = null } = {}) {
  if (repeated) {
    return buildRepeatedStateDrivenLine({ concernFamily, scenarioExecutionContract });
  }
  if (stateName === 'TIME_PRESSURE_DEFLECTION') {
    if (concernFamily === 'evidence') return 'I need the proof point tied to the actual decision.';
    if (concernFamily === 'access') return 'I need the process change tied to the actual delay.';
    if (concernFamily === 'screening') return 'I need the patient boundary tied to action.';
    return 'I need to hear who owns it.';
  }
  if (stateName === 'SOFT_RESISTANCE') return 'That is the part I still need answered before I can stay with this.';
  if (stateName === 'PARTIAL_ENGAGEMENT') return 'That would tell me whether this is worth continuing.';
  if (concernFamily === 'evidence') return 'Tie it to the decision in front of me.';
  if (concernFamily === 'access') return 'Tie it to the actual access barrier.';
  if (concernFamily === 'screening') return 'Tie it to the patient boundary.';
  return 'Tie it to what changes in practice.';
}

function enforceStateDrivenDialogueRichness({ text = '', concernFamily = 'general', stateName = 'OPENING_CONSTRAINT', repeated = false, scenarioExecutionContract = null } = {}) {
  const normalized = normalizeHcpSpokenRealism(text);
  const withRepeatVariation = repeated ? buildStateDrivenRealismExpansion({ concernFamily, stateName, repeated: true, scenarioExecutionContract }) : normalized;
  if (countWords(withRepeatVariation) >= HCP_DIALOGUE_MIN_WORDS) return normalizeHcpSpokenRealism(withRepeatVariation);
  return normalizeHcpSpokenRealism(`${withRepeatVariation} ${buildStateDrivenRealismExpansion({ concernFamily, stateName, scenarioExecutionContract })}`);
}

function buildContractDerivedRealismProfile(contract = {}) {
  const bucket = deriveContractProfileBucket(contract);
  const setting = contractProfileSettingForBucket(bucket);
  const workflowAsk = contractProfileWorkflowAskForBucket(bucket);
  const workflowQuestion = capitalizeQuestion(workflowAsk);
  return Object.freeze({
    profileSource: 'contract_derived_realism_profile',
    bucket,
    defaultConcernFamily: contract?.activeAsk?.concernFamily || contract?.openingState?.primaryConcernFamily || 'workflow',
    lines: Object.freeze({
      TIME_PRESSURE_DEFLECTION: Object.freeze({
        evidence: `Given the time, I need the decision point, not a broad overview. What evidence changes the decision ${setting}?`,
        workflow: `Given the time, ${workflowAsk}?`,
        access: `Given the time, I need the process step, not a broad access discussion. What access step changes the delay ${setting}?`,
        screening: `Given the time, I need the patient boundary, not a broad screening discussion. Who would we identify first ${setting} today?`,
      }),
      EVIDENCE_CHALLENGE: Object.freeze({
        evidence: `I need the decision point, not a broad overview. What evidence changes the decision ${setting}?`,
        workflow: workflowQuestion,
        access: `I need the process step, not a broad access discussion. What access step changes the delay ${setting}?`,
        screening: `I need the patient boundary, not a broad screening discussion. Who would we identify first ${setting} today?`,
      }),
      OPERATIONAL_CHALLENGE: Object.freeze({
        evidence: `I need the evidence tied to an actual next step. What evidence changes the practical decision ${setting}?`,
        workflow: workflowQuestion,
        access: `I need the process step tied to the barrier. What access step changes the delay ${setting}?`,
        screening: `I need the patient boundary tied to action. Who would we identify first ${setting} today?`,
      }),
      SOFT_RESISTANCE: Object.freeze({
        evidence: `I still need the decision-relevant evidence ${setting}. What changes the decision?`,
        workflow: `I still need the practical step ${setting}. ${workflowQuestion}`,
        access: `I still need the access step ${setting}. What changes the delay?`,
        screening: `I still need the patient boundary ${setting}. Who would we identify first?`,
      }),
      PARTIAL_ENGAGEMENT: Object.freeze({
        evidence: `If we continue ${setting}, what evidence changes the decision?`,
        workflow: `If we continue ${setting}, ${workflowAsk}?`,
        access: `If we continue ${setting}, what access step changes the delay?`,
        screening: `If we continue ${setting}, who would we identify first?`,
      }),
    }),
  });
}

function selectProfileByState(contract = {}) {
  const scenarioId = contract?.scenarioIdentity?.scenarioId || contract?.scenarioId || '';
  const scenarioProfile = SCENARIO_REALISM_PROFILES[scenarioId];
  return scenarioProfile
    ? { ...scenarioProfile, profileSource: 'scenario_realism_profile', contract }
    : { ...buildContractDerivedRealismProfile(contract), contract };
}

function selectRecentSafeProfileLine({ profile, stateName, concernFamily, recentHcpTurns = [] } = {}) {
  const recentSignatures = new Set(normalizeRecentTurns(recentHcpTurns).map((turn) => normalizeDialogueSignature(turn)));
  const memory = deriveRealismMemory({ recentHcpTurns, concernFamily });
  const candidateStates = [...new Set([
    stateName,
    'SOFT_RESISTANCE',
    'OPERATIONAL_CHALLENGE',
    'EVIDENCE_CHALLENGE',
    'PARTIAL_ENGAGEMENT',
    'TIME_PRESSURE_DEFLECTION',
  ])];
  const candidates = [];
  for (const candidateState of candidateStates) {
    const lines = profile.lines[candidateState] || {};
    const line = lines[concernFamily] || lines[profile.defaultConcernFamily] || lines.workflow || lines.evidence;
    if (line && !candidates.includes(line)) candidates.push(line);
  }
  return candidates.find((line) => {
    if (recentSignatures.has(normalizeDialogueSignature(line))) return false;
    const opening = openingStructureFamily(line);
    const askShape = terminalAskShapeFamily(line);
    const angle = operationalAngleFamily(line);
    const threshold = thresholdPostureFamily(line);
    if (opening && memory.exhausted.openingStructures.includes(opening)) return false;
    if (askShape && memory.exhausted.askStructures.includes(askShape)) return false;
    if (angle && memory.exhausted.operationalAngles.includes(angle)) return false;
    if (threshold && memory.exhausted.thresholdPostures.includes(threshold)) return false;
    return true;
  })
    || candidates.find((line) => !recentSignatures.has(normalizeDialogueSignature(line)))
    || buildRepeatedStateDrivenLine({ concernFamily, scenarioExecutionContract: profile.contract })
    || candidates[0]
    || '';
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
  recentHcpTurns = [],
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
  const selectedBase = stateLines[resolvedConcern] || stateLines[profile.defaultConcernFamily] || stateLines.workflow || stateLines.evidence;
  if (!selectedBase) return null;
  const selectedSignature = normalizeDialogueSignature(selectedBase);
  const repeated = normalizeRecentTurns(recentHcpTurns).some((turn) => normalizeDialogueSignature(turn) === selectedSignature);
  const repeatBase = repeated
    ? selectRecentSafeProfileLine({ profile, stateName: 'SOFT_RESISTANCE', concernFamily: resolvedConcern, recentHcpTurns })
    : selectedBase;
  const selected = enforceStateDrivenDialogueRichness({
    text: repeated ? repeatBase : selectedBase,
    concernFamily: resolvedConcern,
    stateName,
    repeated: false,
    scenarioExecutionContract,
  });
  return {
    text: selected,
    metadata: {
      stateName,
      state,
      concernFamily: resolvedConcern,
      scenarioId: scenarioExecutionContract.scenarioIdentity.scenarioId,
      source: profile.profileSource || 'scenario_realism_profile',
      repeatedStateDrivenLine: repeated,
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
const RUBRIC_LANGUAGE_PATTERN = /\b(you have covered the setup|be specific about ownership|decision-relevant evidence|usable point before we move on|state the proof point|next turn should)\b/i;
const TOO_IDEAL_PATTERN = /\b(i can stay with this if we make it concrete|happy to keep going|let'?s explore|we can talk through)\b/i;
const STOCK_TRANSITION_PATTERN = /^(i remember that data|that'?s exactly the issue|let me stop you there|given the time|at this point i need|i am still not hearing|i do not need another)/i;
const TERMINAL_ASK_SHAPE_PATTERN = /\b(what would (?:my|the) team (?:actually )?(?:do|own)|what would actually change|what changes (?:the|this)|what single data point|what is the realistic first step)\b/i;

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
  return /\b(make it concrete|make it practical|what would my (?:team|staff) do first|what evidence point changes the decision|how does that (?:change|affect) (?:the decision|durability))\b/i.test(text);
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
        return "I'm about to move on, but I need the durability point. What evidence actually justifies switching stable patients right now?";
      }
      if (cueCategory === 'time_constrained' || timePressure) {
        return 'Given how little time we have, what specific evidence actually justifies switching stable patients? Tie it to the decision in front of me.';
      }
      return "I remember that data, but let me be direct: if I'm changing anything for stable patients, what evidence actually justifies the switch now?";
    }
    if (expressionConcern === 'workflow') {
      if (cueCategory === 'terminal_exit' || terminalBehavior) {
        return "I'm about to move on, but who on staff carries the extra work if we changed follow-up for stable patients now?";
      }
      return 'I need to picture the handoff: which staff member picks this up, and what extra step shows up during routine visits?';
    }
  }

  if (scenarioArchetype === 'post_covid_antiviral_adherence') {
    if (cueCategory === 'terminal_exit' || terminalBehavior) {
      return 'If this adds another clinic step, who carries it when patients are near day four, and what gets dropped first?';
    }
    return 'Patients are already close to missing the window, so who on staff catches this, and what extra step lands during callbacks?';
  }

  if (scenarioArchetype === 'cardiology_formulary_review') {
    if (expressionConcern === 'evidence') {
      if (cueCategory === 'terminal_exit' || terminalBehavior) {
        return "I'm about to move on, so give me the decision point. What single data point should influence this committee now?";
      }
      return 'Let me stop you there: this comes down to evidence and time. What single data point should actually influence this committee decision?';
    }
    if (expressionConcern === 'workflow') {
      if (cueCategory === 'terminal_exit' || terminalBehavior) {
        return "I'm about to move on, but if we move forward, what is the first realistic step my team would need to own?";
      }
      return 'This should not go anywhere until we know who on the committee carries the added review work and what slows decisions.';
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
    .slice(-HCP_REALISM_MEMORY_TURN_LIMIT);
}

function phraseFamilyForText(text = '', concernFamily = 'general') {
  const value = String(text || '').toLowerCase();
  if (/workflow|staff|team|nurse|ma\b|front desk|handoff|callback|extra step|added work|clinic step|committee review|formulary team|practical|own first|do first/.test(value)) return 'workflowAsk';
  if (/durability|evidence|proof|data|decision/.test(value)) return 'evidenceAsk';
  if (/access|coverage|payer|prior|auth|copay/.test(value)) return 'accessAsk';
  if (/screen|candidacy|criteria|patient selection|resistance/.test(value)) return 'screeningAsk';
  if (/pause here|stop here|wrap|get back/.test(value)) return 'closingThreshold';
  return `${concernFamily || 'general'}Ask`;
}

function countByFamily(values = [], familySelector = () => '') {
  return values.reduce((counts, value) => {
    const family = familySelector(value);
    if (!family) return counts;
    counts[family] = (counts[family] || 0) + 1;
    return counts;
  }, {});
}

function exhaustedFamiliesFromCounts(counts = {}, threshold = HCP_PHRASE_EXHAUSTION_THRESHOLD) {
  return Object.entries(counts)
    .filter(([, count]) => count >= threshold)
    .map(([family]) => family);
}

function openingStructureFamily(value = '') {
  const text = normalizeHcpSpokenRealism(value).toLowerCase();
  if (/^i remember that data/.test(text)) return 'remember_data_opening';
  if (/^that'?s exactly the issue/.test(text)) return 'exact_issue_opening';
  if (/^let me stop you there/.test(text)) return 'stop_you_there_opening';
  if (/^given the time/.test(text)) return 'given_time_opening';
  if (/^i am still not hearing/.test(text)) return 'still_not_hearing_opening';
  if (/^i do not need another/.test(text)) return 'no_more_overview_opening';
  if (/^if\b/.test(text)) return 'conditional_if_opening';
  if (/^before\b/.test(text)) return 'before_redirect_opening';
  return text.split(/\s+/).slice(0, 3).join('_');
}

function challengeVerbFamily(value = '') {
  const text = normalizeHcpSpokenRealism(value).toLowerCase();
  if (/\btie\b|\bconnect\b/.test(text)) return 'connect_challenge';
  if (/\bjustify|\boffset|\btrust\b/.test(text)) return 'threshold_challenge';
  if (/\bown|\babsorb|\bdo differently|\bdo first/.test(text)) return 'ownership_challenge';
  if (/\breduce|\bdelay|\bhandoff/.test(text)) return 'process_challenge';
  if (/\bidentify|\bscreen/.test(text)) return 'identification_challenge';
  if (/\bchange|\bchanges/.test(text)) return 'change_challenge';
  return '';
}

function operationalAngleFamily(value = '') {
  const text = normalizeHcpSpokenRealism(value).toLowerCase();
  if (/\bstable[- ]patient|stable patients|switching|durability/.test(text)) return 'stable_patient_continuity';
  if (/\bstaff|team|nurse|ma|front desk/.test(text)) return 'staff_burden';
  if (/\bclinic flow|workflow|clinic step|current clinic/.test(text)) return 'workflow_interruption';
  if (/\bown|ownership|follow-through|absorb/.test(text)) return 'ownership_followthrough';
  if (/\bday one|next week|right now|today/.test(text)) return 'immediate_applicability';
  if (/\bcoverage|payer|prior auth|authorization|admin|handoff|process delay|access delay/.test(text)) return 'payer_admin_process';
  if (/\bcommittee|formulary|recommendation|decision point|review/.test(text)) return 'committee_review';
  if (/\bidentify|screening|patient boundary|eligible|candidate/.test(text)) return 'screening_boundary';
  if (/\badds? work|adding another|burden shifts|extra step/.test(text)) return 'burden_shift';
  return '';
}

function thresholdPostureFamily(value = '') {
  const text = normalizeHcpSpokenRealism(value).toLowerCase();
  if (/\bmay need to wait|revisit|pause here|move on/.test(text)) return 'revisit_later_threshold';
  if (/\bnot happening|cannot hand|cannot ask|not moving/.test(text)) return 'implementation_threshold';
  if (/\bif\b.*\bstill\b/.test(text)) return 'conditional_threshold';
  if (/\bwhat evidence offsets|what evidence changes|what should influence/.test(text)) return 'evidence_threshold';
  return '';
}

function redirectionShapeFamily(value = '') {
  const text = normalizeHcpSpokenRealism(value).toLowerCase();
  if (/\bbut\b.*\bneed\b/.test(text)) return 'selective_acknowledgement';
  if (/\bnot\b.*\boverview|not a broader|not a general/.test(text)) return 'relevance_challenge';
  if (/\bwhat would|what should|who would/.test(text)) return 'direct_question';
  if (/\bif\b.*\bthen|\bif\b.*\bmay need/.test(text)) return 'conditional_continuation';
  if (/\bmove on|pause|wait|revisit/.test(text)) return 'wrap_up_pressure';
  return '';
}

export function detectSymmetricalOperationalStructure({ reply = '', concernFamily = 'general' } = {}) {
  const text = normalizeHcpSpokenRealism(reply).toLowerCase();
  const operational = concernFamily === 'workflow' || /workflow|clinic flow|process|implementation|operational|staff|team/.test(text);
  const issues = [];
  if (!operational) return { symmetrical: false, issues };
  if (/\bwhat (?:follow-through|implementation|operational|workflow)\b[^?]*, and how would that (?:fit|work)/i.test(text)) issues.push('balanced_abstract_fit_clause');
  if (/\bwhat .* would .* absorb[^?]*, and how would that fit into/i.test(text)) issues.push('absorb_plus_fit_clause');
  if (/\bhow would that (?:fit|work) (?:in|into) (?:clinic flow|workflow|practice|process)/i.test(text)) issues.push('abstract_fit_question');
  if (/\b(follow-through|implementation|workflow fit|process alignment|operational step)\b/i.test(text) && /\band how would\b/i.test(text)) issues.push('abstract_noun_balanced_pair');
  return {
    symmetrical: issues.length > 0,
    issues,
  };
}

export function reduceAbstractOperationalNouns({ reply = '', concernFamily = 'general' } = {}) {
  let text = normalizeHcpSpokenRealism(reply);
  if (concernFamily !== 'workflow' && !/workflow|clinic flow|staff|team|implementation|operational/i.test(text)) return text;
  text = text
    .replace(/what follow-through would my team need to absorb, and how would that fit into clinic flow over time\?/i, 'who on my team would handle the added work, and what changes in their day over time?')
    .replace(/what follow-through burden would staff carry/i, 'who on staff ends up carrying this')
    .replace(/where would the follow-through burden sit/i, 'who would end up carrying the extra work')
    .replace(/what burden would (?:they|staff|my team) absorb over the coming weeks\?/i, 'which staff member would pick this up once it reaches follow-up?')
    .replace(/what changes in their day over time\?/i, 'what extra step shows up during a normal clinic day?')
    .replace(/who on staff ends up carrying this over the coming weeks\?/i, 'who on staff picks this up once it is in motion?')
    .replace(/the follow-through burden/gi, 'the extra work')
    .replace(/operational step/gi, 'staff handoff')
    .replace(/workflow fit/gi, 'where this lands for staff')
    .replace(/process alignment/gi, 'who handles the handoff')
    .replace(/implementation burden/gi, 'extra lift')
    .replace(/how would that fit into clinic flow over time\?/i, 'where does that land for staff over time?')
    .replace(/how would that work in practice\?/i, 'who handles it when the clinic is busy?')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return normalizeHcpSpokenRealism(text);
}

export function detectSyntheticBurdenLanguage({ reply = '', concernFamily = 'general' } = {}) {
  const text = normalizeHcpSpokenRealism(reply).toLowerCase();
  const operational = concernFamily === 'workflow' || /workflow|clinic|staff|team|nurse|implementation|burden|follow-up/.test(text);
  const issues = [];
  if (!operational) return { synthetic: false, issues };
  if (/\bwhat burden would (?:they|staff|my team) absorb\b/.test(text)) issues.push('abstract_burden_absorb_question');
  if (/\bwhat changes in (?:their|my team'?s) day over time\b/.test(text)) issues.push('abstract_day_over_time_question');
  if (/\bwho on staff ends up carrying this\b/.test(text)) issues.push('abstract_carrying_this_phrase');
  if (/\badded work over time\b/.test(text)) issues.push('abstract_added_work_over_time');
  return { synthetic: issues.length > 0, issues };
}

export function scoreSpokenRealismShape({ reply = '', concernFamily = 'general' } = {}) {
  const text = normalizeHcpSpokenRealism(reply).toLowerCase();
  const actorMatches = text.match(/\b(nurses?|staff|front desk|ma\b|team member|who on my team|which staff member|who carries|who handles|patients?)\b/g) || [];
  const frictionMatches = text.match(/\b(extra steps?|slow(?:s|ed)? down|back-and-forth|replaces|simplifies|gets harder|adds lift|carry|carries|picks this up|handoff|coverage side|payer loop|busy|normal day|routine visits|during follow-up)\b/g) || [];
  const cognitionMatches = text.match(/\b(i need to picture|i am trying to picture|trying to picture|walk me through|help me understand|i need to understand|where does this land|which staff member)\b/g) || [];
  const abstractMatches = text.match(/\b(follow-through|implementation|workflow fit|process alignment|operational step|decision-relevant evidence|broad overview|realistic first step)\b/g) || [];
  const symmetry = detectSymmetricalOperationalStructure({ reply, concernFamily }).symmetrical ? 1 : 0;
  const genericCrutch = detectGenericOperationalCrutch({ reply, concernFamily }).crutch ? 1 : 0;
  const syntheticBurden = detectSyntheticBurdenLanguage({ reply, concernFamily }).synthetic ? 1 : 0;
  const wordCount = countWords(reply);
  const wordBandPenalty = wordCount < HCP_DIALOGUE_MIN_WORDS || wordCount > 25 ? 2 : 0;
  const score = (actorMatches.length * 2)
    + (frictionMatches.length * 2)
    + cognitionMatches.length
    - (abstractMatches.length * 2)
    - (symmetry * 3)
    - (genericCrutch * 3)
    - (syntheticBurden * 3)
    - wordBandPenalty;
  return {
    score,
    actorCount: actorMatches.length,
    frictionCount: frictionMatches.length,
    cognitionCount: cognitionMatches.length,
    abstractCount: abstractMatches.length,
    symmetry: Boolean(symmetry),
    genericCrutch: Boolean(genericCrutch),
    syntheticBurden: Boolean(syntheticBurden),
    wordCount,
  };
}

export function deriveRealismMemory({ recentHcpTurns = [], concernFamily = 'general' } = {}) {
  const turns = normalizeRecentTurns(recentHcpTurns);
  const openingStructures = countByFamily(turns, openingStructureFamily);
  const challengeVerbs = countByFamily(turns, challengeVerbFamily);
  const askStructures = countByFamily(turns, terminalAskShapeFamily);
  const operationalAngles = countByFamily(turns, operationalAngleFamily);
  const thresholdPostures = countByFamily(turns, thresholdPostureFamily);
  const redirectionShapes = countByFamily(turns, redirectionShapeFamily);
  const phraseFamilies = countByFamily(turns, (turn) => phraseFamilyForText(turn, concernFamily));
  return {
    turnCount: turns.length,
    turns,
    openingStructures,
    challengeVerbs,
    askStructures,
    operationalAngles,
    thresholdPostures,
    redirectionShapes,
    phraseFamilies,
    exhausted: {
      openingStructures: exhaustedFamiliesFromCounts(openingStructures),
      challengeVerbs: exhaustedFamiliesFromCounts(challengeVerbs),
      askStructures: exhaustedFamiliesFromCounts(askStructures),
      operationalAngles: exhaustedFamiliesFromCounts(operationalAngles),
      thresholdPostures: exhaustedFamiliesFromCounts(thresholdPostures),
      redirectionShapes: exhaustedFamiliesFromCounts(redirectionShapes),
      phraseFamilies: exhaustedFamiliesFromCounts(phraseFamilies),
    },
  };
}

export function derivePhraseExhaustionState({ recentHcpTurns = [], concernFamily = 'general' } = {}) {
  const memory = deriveRealismMemory({ recentHcpTurns, concernFamily });
  return {
    exhausted: memory.exhausted,
    turnCount: memory.turnCount,
  };
}

export function detectLateConversationGenericCollapse({ reply = '', recentHcpTurns = [], concernFamily = 'general' } = {}) {
  const memory = deriveRealismMemory({ recentHcpTurns, concernFamily });
  const text = normalizeHcpSpokenRealism(reply).toLowerCase();
  const reasons = [];
  if (memory.turnCount >= 20 && countWords(reply) < HCP_DIALOGUE_MIN_WORDS) reasons.push('late_short_line');
  if (memory.turnCount >= 20 && /\b(i need something actionable|what changes next week|i'?m still not hearing|given the time|if this is relevant|what would my team actually do differently)\b/i.test(text)) {
    reasons.push('late_generic_repair_crutch');
  }
  const askShape = terminalAskShapeFamily(reply);
  if (memory.turnCount >= 20 && askShape && (memory.askStructures[askShape] || 0) >= HCP_PHRASE_EXHAUSTION_THRESHOLD) reasons.push('late_repeated_ask_shape');
  const opening = openingStructureFamily(reply);
  if (memory.turnCount >= 20 && opening && (memory.openingStructures[opening] || 0) >= HCP_PHRASE_EXHAUSTION_THRESHOLD) reasons.push('late_repeated_opening_shape');
  return {
    collapsed: reasons.length > 0,
    reasons,
    memory,
  };
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

export function assessGenericness({ reply = '', scenarioExecutionContract = null, concernFamily = 'general' } = {}) {
  const text = normalizeHcpSpokenRealism(reply);
  const bucket = scenarioExecutionContract ? deriveContractProfileBucket(scenarioExecutionContract) : 'unknown';
  const issues = [];
  if (/^given the time, what would my team actually do first here\?$/i.test(text)) issues.push('portable_generic_workflow_ask');
  if (/^what evidence point changes the decision\?$/i.test(text)) issues.push('portable_generic_evidence_ask');
  if (bucket !== 'unknown' && concernFamily !== 'general' && !phraseFamilyForText(text, concernFamily).includes(concernFamily === 'evidence' ? 'evidence' : concernFamily)) {
    issues.push('weak_concern_binding');
  }
  return { generic: issues.length > 0, issues, bucket };
}

export function assessHumanPhraseQuality({ reply = '' } = {}) {
  const text = normalizeHcpSpokenRealism(reply);
  const issues = [];
  if (RUBRIC_LANGUAGE_PATTERN.test(text)) issues.push('rubric_language');
  if (/\bconcern family|semantic progression|engagement tier|decision-relevant evidence\b/i.test(text)) issues.push('state_label_language');
  return { natural: issues.length === 0, issues };
}

export function assessTooIdeal({ reply = '', cueCategory = 'neutral_attentive', interactionMode = '', engagementTier = '', semanticStage = '' } = {}) {
  const text = normalizeHcpSpokenRealism(reply);
  const pressure = isHighPressureState({ cueCategory, interactionMode, engagementTier, semanticStage });
  const issues = [];
  if (pressure && TOO_IDEAL_PATTERN.test(text) && !CONSTRAINED_DIRECT_ASK_PATTERN.test(text)) issues.push('too_cooperative_for_pressure');
  if (pressure && /\b(let'?s|happy to|we can)\b/i.test(text)) issues.push('overly_collaborative_under_pressure');
  return { tooIdeal: issues.length > 0, issues };
}

export function assessRecentPatternReuse({ reply = '', recentHcpTurns = [] } = {}) {
  const signature = normalizeDialogueSignature(reply);
  const recent = normalizeRecentTurns(recentHcpTurns).map((turn) => normalizeDialogueSignature(turn));
  const repeatedExact = Boolean(signature && recent.includes(signature));
  const currentFamily = phraseFamilyForText(reply);
  const repeatedFamilyCount = normalizeRecentTurns(recentHcpTurns).filter((turn) => phraseFamilyForText(turn) === currentFamily).length;
  return { repeated: repeatedExact || repeatedFamilyCount >= 2, repeatedExact, repeatedFamilyCount, phraseFamily: currentFamily };
}

function stockTransitionFamily(value = '') {
  const match = normalizeHcpSpokenRealism(value).match(STOCK_TRANSITION_PATTERN);
  return match?.[1]?.toLowerCase() || '';
}

export function detectStockTransitionReuse({ reply = '', recentHcpTurns = [] } = {}) {
  const current = stockTransitionFamily(reply);
  if (!current) return { reused: false, family: '', recentCount: 0 };
  const recentCount = normalizeRecentTurns(recentHcpTurns).filter((turn) => stockTransitionFamily(turn) === current).length;
  return { reused: recentCount > 0, family: current, recentCount };
}

function terminalAskShapeFamily(value = '') {
  const text = normalizeHcpSpokenRealism(value).toLowerCase();
  if (/what would (?:my|the) team (?:actually )?(?:do|own)/i.test(text)) return 'team_action_ask';
  if (/what single data point/i.test(text)) return 'single_data_point_ask';
  if (/what would actually change|what changes (?:the|this)/i.test(text)) return 'what_changes_ask';
  if (/what is the realistic first step/i.test(text)) return 'realistic_first_step_ask';
  return TERMINAL_ASK_SHAPE_PATTERN.test(text) ? 'terminal_ask_shape' : '';
}

export function detectRepeatedTerminalAskShape({ reply = '', recentHcpTurns = [] } = {}) {
  const family = terminalAskShapeFamily(reply);
  if (!family) return { repeated: false, family: '', recentCount: 0 };
  const recentCount = normalizeRecentTurns(recentHcpTurns).filter((turn) => terminalAskShapeFamily(turn) === family).length;
  return { repeated: recentCount > 0, family, recentCount };
}

export function detectGenericOperationalCrutch({ reply = '', concernFamily = 'general' } = {}) {
  const text = normalizeHcpSpokenRealism(reply).toLowerCase();
  const operational = concernFamily === 'workflow' || /workflow|staff|team|operational|implementation|clinic flow|practice/.test(text);
  const issues = [];
  if (!operational) return { crutch: false, issues, skeleton: '' };
  if (/^given the time\b/.test(text)) issues.push('stock_time_opener');
  if (/\bwhat would my team (?:actually )?(?:do|own|do differently)/.test(text)) issues.push('team_action_stub');
  if (/\bdo differently\b/.test(text)) issues.push('generic_do_differently');
  if (/\bnext week\b/.test(text)) issues.push('short_horizon_next_week');
  if (/\bin practice\b|\bday one\b/.test(text) && !/post-?covid|antiviral|day four|day 4/.test(text)) issues.push('portable_practice_horizon');
  const skeleton = [
    /^given the time\b/.test(text) ? 'time_opener' : '',
    /what would my team/.test(text) ? 'team_ask' : '',
    /do differently/.test(text) ? 'do_differently' : '',
    /next week/.test(text) ? 'short_horizon' : '',
  ].filter(Boolean).join('+');
  return {
    crutch: issues.length >= 2 || skeleton === 'time_opener+team_ask+do_differently+short_horizon',
    issues,
    skeleton,
  };
}

export function detectSyntheticShortHorizon({ reply = '', scenarioExecutionContract = null } = {}) {
  if (!scenarioExecutionContract?.scenarioIdentity?.scenarioId) return { synthetic: false, issues: [] };
  const text = normalizeHcpSpokenRealism(reply).toLowerCase();
  const context = normalizeRuntimeText(
    scenarioExecutionContract?.scenarioIdentity?.title,
    scenarioExecutionContract?.scenarioIdentity?.scenarioId,
    scenarioExecutionContract?.openingState?.openingScene,
    ...(scenarioExecutionContract?.constraints?.challenges || []),
  );
  const scenarioSupportsDayOne = /post-?covid|antiviral|day four|day 4|callback|window/.test(context);
  const issues = [];
  if (/\bnext week\b/.test(text) && !/next week|weekly|follow-up list/.test(context)) issues.push('unsupported_next_week');
  if (/\bday one\b/.test(text) && !scenarioSupportsDayOne) issues.push('unsupported_day_one');
  return { synthetic: issues.length > 0, issues };
}

export function deriveImplementationBurdenLexicon({ scenarioExecutionContract = null, activeAskState = null } = {}) {
  const bucket = deriveContractProfileBucket(scenarioExecutionContract || {});
  const pressure = deriveScenarioPressureClause(scenarioExecutionContract || {}, bucket);
  const ask = cleanScenarioPressureFragment(activeAskState?.askText || scenarioExecutionContract?.activeAsk?.askText || '');
  if (bucket === 'committee') return { bucket, burden: 'review threshold', horizon: 'during committee review', owner: 'this committee', pressure, ask };
  if (bucket === 'access_process') return { bucket, burden: 'admin back-and-forth', horizon: 'within the current process', owner: 'our process', pressure, ask };
  if (bucket === 'screening_evaluation') return { bucket, burden: 'screening lift', horizon: 'as patients are identified', owner: 'we', pressure, ask };
  if (/stable|suppressed|durability|switch/.test(`${pressure} ${ask}`)) {
    return { bucket, burden: 'follow-through burden', horizon: 'over the coming weeks', owner: 'staff', pressure, ask };
  }
  return { bucket, burden: 'extra lift', horizon: 'as this gets adopted', owner: 'staff', pressure, ask };
}

export function detectRepeatedOperationalAskSkeleton({ reply = '', recentHcpTurns = [], concernFamily = 'general' } = {}) {
  const current = detectGenericOperationalCrutch({ reply, concernFamily });
  if (!current.skeleton) return { repeated: false, skeleton: '', recentCount: 0, current };
  const recentCount = normalizeRecentTurns(recentHcpTurns)
    .filter((turn) => detectGenericOperationalCrutch({ reply: turn, concernFamily }).skeleton === current.skeleton).length;
  return {
    repeated: recentCount > 0 && current.crutch,
    skeleton: current.skeleton,
    recentCount,
    current,
  };
}

export function reviseForBurdenRealism({ scenarioExecutionContract = null, activeAskState = null, recentHcpTurns = [] } = {}) {
  const lexicon = deriveImplementationBurdenLexicon({ scenarioExecutionContract, activeAskState });
  const memory = deriveRealismMemory({ recentHcpTurns, concernFamily: activeAskState?.concernFamily || 'workflow' });
  const candidates = (() => {
    if (lexicon.bucket === 'committee') {
      return [
        `This cannot stay abstract for review; what threshold would change the recommendation without creating more committee churn today?`,
        `If the review burden shifts downstream, I need the adoption criteria, not another summary of the evidence package for this committee today.`,
      ];
    }
    if (lexicon.bucket === 'access_process') {
      return [
        `If this adds admin back-and-forth, it will stall; who carries the handoff inside our process once coverage questions start for patients?`,
        `The access issue is the downstream burden; show me what changes in our process without creating another payer loop.`,
      ];
    }
    if (lexicon.bucket === 'screening_evaluation') {
      return [
        `If this adds screening lift, it needs a clear boundary; who would we identify first once this is in workflow?`,
        `The identification step still has to fit clinic reality; which patients would we flag without widening the workup?`,
      ];
    }
    return [
      `I need to picture the handoff: which staff member picks this up, and what extra step shows up during routine visits?`,
      `If this adds lift for staff, I need to know who carries it and what gets harder during follow-up visits.`,
      `Walk me through where this lands for staff once patients are already stable and the schedule is full.`,
      `If we changed follow-up now, which staff member handles the extra work while the clinic is already full with stable patients?`,
    ];
  })();
  const recentSignatures = new Set(normalizeRecentTurns(recentHcpTurns).map((turn) => normalizeDialogueSignature(turn)));
  const viable = candidates.filter((candidate) => {
    const reduced = reduceAbstractOperationalNouns({ reply: candidate, concernFamily: activeAskState?.concernFamily || 'workflow' });
    if (recentSignatures.has(normalizeDialogueSignature(candidate)) || recentSignatures.has(normalizeDialogueSignature(reduced))) return false;
    if (detectSymmetricalOperationalStructure({ reply: reduced, concernFamily: activeAskState?.concernFamily || 'workflow' }).symmetrical) return false;
    const angle = operationalAngleFamily(candidate);
    const opening = openingStructureFamily(candidate);
    if (angle && memory.exhausted.operationalAngles.includes(angle)) return false;
    if (opening && memory.exhausted.openingStructures.includes(opening)) return false;
    return true;
  });
  const nonRecentCandidates = candidates.filter((candidate) => {
    const reduced = reduceAbstractOperationalNouns({ reply: candidate, concernFamily: activeAskState?.concernFamily || 'workflow' });
    return !recentSignatures.has(normalizeDialogueSignature(candidate)) && !recentSignatures.has(normalizeDialogueSignature(reduced));
  });
  const selectedPool = viable.length > 0 ? viable : (nonRecentCandidates.length > 0 ? nonRecentCandidates : candidates);
  const selected = selectedPool
    .map((candidate, index) => ({
      candidate,
      index,
      score: scoreSpokenRealismShape({ reply: candidate, concernFamily: activeAskState?.concernFamily || 'workflow' }).score,
    }))
    .sort((left, right) => (right.score - left.score) || (left.index - right.index))[0]?.candidate
    || candidates.find((candidate) => !recentSignatures.has(normalizeDialogueSignature(candidate)))
    || candidates[candidates.length - 1];
  return reduceAbstractOperationalNouns({ reply: selected, concernFamily: activeAskState?.concernFamily || 'workflow' });
}

export function deriveScenarioLexiconHints({ scenarioExecutionContract = null, activeAskState = null } = {}) {
  const bucket = deriveContractProfileBucket(scenarioExecutionContract || {});
  const challenges = (scenarioExecutionContract?.constraints?.challenges || []).map(cleanScenarioPressureFragment).filter(Boolean);
  const keyMessages = (scenarioExecutionContract?.constraints?.keyMessages || []).map(cleanScenarioPressureFragment).filter(Boolean);
  const ask = cleanScenarioPressureFragment(activeAskState?.askText || scenarioExecutionContract?.activeAsk?.askText || '');
  return {
    bucket,
    primaryPressure: challenges[0] || ask || '',
    actionHint: keyMessages[0] || '',
    askHint: ask,
  };
}

export function spokenBelievabilityAudit({
  reply = '',
  scenarioExecutionContract = null,
  activeAskState = null,
  concernFamily = 'general',
  cueCategory = 'neutral_attentive',
  interactionMode = '',
  engagementTier = '',
  semanticStage = '',
  recentHcpTurns = [],
} = {}) {
  const generic = assessGenericness({ reply, scenarioExecutionContract, concernFamily: activeAskState?.concernFamily || concernFamily });
  const phraseQuality = assessHumanPhraseQuality({ reply });
  const tooIdeal = assessTooIdeal({ reply, cueCategory, interactionMode, engagementTier, semanticStage });
  const repetition = assessRecentPatternReuse({ reply, recentHcpTurns });
  const stockTransition = detectStockTransitionReuse({ reply, recentHcpTurns });
  const terminalAskShape = detectRepeatedTerminalAskShape({ reply, recentHcpTurns });
  const lateCollapse = detectLateConversationGenericCollapse({ reply, recentHcpTurns, concernFamily: activeAskState?.concernFamily || concernFamily });
  const operationalCrutch = detectGenericOperationalCrutch({ reply, concernFamily: activeAskState?.concernFamily || concernFamily });
  const shortHorizon = detectSyntheticShortHorizon({ reply, scenarioExecutionContract });
  const operationalAskSkeleton = detectRepeatedOperationalAskSkeleton({ reply, recentHcpTurns, concernFamily: activeAskState?.concernFamily || concernFamily });
  const symmetry = detectSymmetricalOperationalStructure({ reply, concernFamily: activeAskState?.concernFamily || concernFamily });
  const syntheticBurden = detectSyntheticBurdenLanguage({ reply, concernFamily: activeAskState?.concernFamily || concernFamily });
  const sentenceIntegrity = detectClauseStitchFailure(reply);
  const shapeScore = scoreSpokenRealismShape({ reply, concernFamily: activeAskState?.concernFamily || concernFamily });
  const lexicon = deriveScenarioLexiconHints({ scenarioExecutionContract, activeAskState });
  const wordCountIssue = countWords(reply) < HCP_DIALOGUE_MIN_WORDS || countWords(reply) > 25;
  const portablePolish = STOCK_TRANSITION_PATTERN.test(reply) && !lexicon.primaryPressure && !lexicon.askHint;
  const issues = [
    ...generic.issues,
    ...phraseQuality.issues,
    ...tooIdeal.issues,
    ...(repetition.repeated ? ['recent_pattern_reuse'] : []),
    ...(stockTransition.reused ? ['stock_transition_reuse'] : []),
    ...(terminalAskShape.repeated ? ['repeated_terminal_ask_shape'] : []),
    ...lateCollapse.reasons,
    ...(operationalCrutch.crutch ? ['generic_operational_crutch'] : []),
    ...shortHorizon.issues,
    ...(operationalAskSkeleton.repeated ? ['repeated_operational_ask_skeleton'] : []),
    ...symmetry.issues,
    ...syntheticBurden.issues,
    ...sentenceIntegrity,
    ...((activeAskState?.concernFamily || concernFamily) === 'workflow' && shapeScore.score < 2 ? ['weak_actor_friction_shape'] : []),
    ...(portablePolish ? ['portable_professional_polish'] : []),
    ...(wordCountIssue ? ['outside_word_band'] : []),
  ];
  return {
    believable: issues.length === 0,
    issues,
    generic,
    phraseQuality,
    tooIdeal,
    repetition,
    stockTransition,
    terminalAskShape,
    lateCollapse,
    operationalCrutch,
    shortHorizon,
    operationalAskSkeleton,
    symmetry,
    syntheticBurden,
    sentenceIntegrity,
    shapeScore,
    lexicon,
    wordCountIssue,
  };
}

export function reviseForStateBoundRealism({
  reply = '',
  scenarioExecutionContract = null,
  activeAskState = null,
  concernFamily = 'general',
  stateName = 'OPENING_CONSTRAINT',
  repeated = false,
  recentHcpTurns = [],
} = {}) {
  const profile = scenarioExecutionContract ? selectProfileByState(scenarioExecutionContract) : null;
  const resolvedConcern = activeAskState?.concernFamily || scenarioExecutionContract?.activeAsk?.concernFamily || concernFamily || profile?.defaultConcernFamily || 'workflow';
  const stateLines = profile?.lines?.[stateName] || profile?.lines?.OPERATIONAL_CHALLENGE || profile?.lines?.EVIDENCE_CHALLENGE || {};
  const stateBoundLine = repeated && profile
    ? selectRecentSafeProfileLine({ profile, stateName: 'SOFT_RESISTANCE', concernFamily: resolvedConcern, recentHcpTurns })
    : (stateLines[resolvedConcern] || stateLines[profile?.defaultConcernFamily] || stateLines.workflow || stateLines.evidence || reply);
  return enforceStateDrivenDialogueRichness({
    text: stateBoundLine,
    concernFamily: resolvedConcern,
    stateName,
    repeated: false,
    scenarioExecutionContract,
  });
}

export function enforceWordBand({
  reply = '',
  min = HCP_DIALOGUE_MIN_WORDS,
  max = 25,
  scenarioExecutionContract = null,
  activeAskState = null,
  concernFamily = 'general',
  stateName = 'OPENING_CONSTRAINT',
} = {}) {
  let text = normalizeHcpSpokenRealism(reply);
  if (countWords(text) < min) {
    return text;
  }
  if (countWords(text) <= max) return text;

  const compressed = text
    .replace(/\bactually\b/gi, '')
    .replace(/\bright now\b/gi, '')
    .replace(/\bin front of me\b/gi, '')
    .replace(/\bnot a broad (?:overview|discussion|review or summary),?\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (countWords(compressed) <= max) return normalizeHcpSpokenRealism(compressed);
  return normalizeHcpSpokenRealism(compressByState({
    text: compressed,
    concernFamily: activeAskState?.concernFamily || concernFamily,
    cueCategory: 'focused_narrowing',
  }));
}

export function enforcePostGenerationHcpRealism({
  reply = '',
  scenarioExecutionContract = null,
  activeAskState = null,
  concernFamily = 'general',
  stateName = 'OPENING_CONSTRAINT',
  cueCategory = 'neutral_attentive',
  interactionMode = '',
  engagementTier = '',
  semanticStage = '',
  recentHcpTurns = [],
} = {}) {
  const audit = spokenBelievabilityAudit({
    reply,
    scenarioExecutionContract,
    activeAskState,
    concernFamily,
    cueCategory,
    interactionMode,
    engagementTier,
    semanticStage,
    recentHcpTurns,
  });
  const revised = splitOrCompressSentence({
    text: enforceSpokenLanguage({
      text: normalizeHcpSpokenRealism(reply),
      interactionMode,
      engagementTier,
    }),
    interactionMode,
    cueCategory,
    concernFamily: activeAskState?.concernFamily || concernFamily,
  });
  const finalText = enforceWordBand({
    reply: reviseForSentenceIntegrity(revised),
    scenarioExecutionContract,
    activeAskState,
    concernFamily,
    stateName,
  });
  return {
    text: finalText,
    metadata: {
      revised: finalText !== normalizeHcpSpokenRealism(reply),
      issues: audit.issues,
      wordCount: countWords(finalText),
      stockTransition: audit.stockTransition,
      terminalAskShape: audit.terminalAskShape,
      lateCollapse: {
        collapsed: audit.lateCollapse.collapsed,
        reasons: audit.lateCollapse.reasons,
        memoryTurnCount: audit.lateCollapse.memory.turnCount,
      },
      operationalCrutch: audit.operationalCrutch,
      shortHorizon: audit.shortHorizon,
      operationalAskSkeleton: audit.operationalAskSkeleton,
      symmetry: audit.symmetry,
      syntheticBurden: audit.syntheticBurden,
      sentenceIntegrity: audit.sentenceIntegrity,
      shapeScore: audit.shapeScore,
      lexicon: audit.lexicon,
    },
  };
}

export function validateCueDialogueLockstep({ cueCategory = 'neutral_attentive', interactionMode = '', engagementTier = '', semanticStage = '', finalText = '' } = {}) {
  const text = String(finalText || '').trim();
  const mismatchReasons = [];
  if (cueCategory === 'terminal_exit' && !TERMINAL_PATTERN.test(text)) mismatchReasons.push('terminal_cue_without_terminal_dialogue');
  if (cueCategory === 'time_constrained' && detectOverpackedSentence({ text }).wordCount > 25) mismatchReasons.push('time_constrained_dialogue_too_long');
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
    recentHcpTurns,
  });
  if (stateDriven) {
    if (requireContractBound) {
      assertLiveHcpRealismRenderInputs({
        scenarioExecutionContract,
        activeAskState,
        stateDrivenResult: stateDriven,
      });
    }
    const postGenerated = enforcePostGenerationHcpRealism({
      reply: normalizeHcpSpokenRealism(String(text || stateDriven.text || '')),
      scenarioExecutionContract,
      activeAskState,
      concernFamily: stateDriven.metadata.concernFamily,
      stateName: stateDriven.metadata.stateName,
      cueCategory: resolvedCueCategory,
      interactionMode,
      engagementTier,
      semanticStage,
      recentHcpTurns,
    });
    const finalStateText = normalizeHcpSpokenRealism(postGenerated.text);
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
        repeatedStateDrivenLine: stateDriven.metadata.repeatedStateDrivenLine,
        postGenerationRealism: postGenerated.metadata,
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
  const legacyStateName = deriveStateNameFromStructuredInputs({
    cueCategory: resolvedCueCategory,
    timePressure,
    terminalBehavior,
    activeAskState: activeAskState || { askText: activeAsk, concernFamily: expressionConcernFamily },
    concernFamily: expressionConcernFamily,
  });
  const shouldEnforcePostGeneration = Boolean(scenarioExecutionContract || activeAskState || activeAsk || scenarioContext);
  const postGenerated = shouldEnforcePostGeneration
    ? enforcePostGenerationHcpRealism({
      reply: finalText,
      scenarioExecutionContract,
      activeAskState,
      concernFamily: expressionConcernFamily,
      stateName: legacyStateName,
      cueCategory: resolvedCueCategory,
      interactionMode,
      engagementTier,
      semanticStage,
      recentHcpTurns,
    })
    : { text: finalText, metadata: { revised: false, issues: [], wordCount: countWords(finalText), skipped: 'no_state_binding_context' } };

  return {
    text: normalizeHcpSpokenRealism(postGenerated.text),
    metadata: {
      version: CONVERSATIONAL_REALISM_ENGINE_VERSION,
      cueCategory: resolvedCueCategory,
      concernFamily: expressionConcernFamily,
      scenarioArchetype: deriveScenarioArchetype({ scenarioContext, activeAsk, text }),
      phraseFamily: varied.phraseFamily,
      repeatedFamilyCount: varied.repeatedFamilyCount,
      lockstep: validateCueDialogueLockstep({
        cueCategory: resolvedCueCategory,
        interactionMode,
        engagementTier,
        semanticStage,
        finalText: postGenerated.text,
      }),
      overpacked: detectOverpackedSentence({ text: postGenerated.text }),
      activeAskPresent: Boolean(String(activeAsk || '').trim()),
      terminalCompressionApplied: terminalCompressed !== spoken || finalText !== varied.text,
      conversationIntelligenceProgression: conversationIntelligence?.turnInterpretation?.progression || null,
      postGenerationRealism: postGenerated.metadata,
    },
  };
}
