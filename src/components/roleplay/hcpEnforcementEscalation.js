function clamp(value, min = 0, max = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase();
}

function canonicalizeHashInput(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalizeHashInput(entry)).sort().join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${key}:${canonicalizeHashInput(value[key])}`).join(',')}}`;
  }
  return String(value ?? '');
}

export function stableHash(input = '') {
  const serialized = canonicalizeHashInput(input);
  const value = String(serialized || '');
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function deterministicVariant(seed = '', options = []) {
  if (!Array.isArray(options) || options.length === 0) return '';
  const canonicalTemplate = String(options[0] || '');
  if (options.length === 1) return canonicalTemplate;
  const turnOffset = seed && typeof seed === 'object' ? Math.max(0, Number(seed.turnNumber || 0)) : 0;
  const index = (stableHash(seed) + turnOffset) % options.length;
  return String(options[index] || canonicalTemplate);
}

export const ESCALATION_STAGES = Object.freeze([
  'open',
  'focused',
  'narrowed',
  'firm',
  'high_pressure',
  'disengaging',
]);
const OPENING_STAGE_CAP_BY_PERSONA = Object.freeze({
  engaged: 'open',
  collaborative: 'open',
  receptive: 'open',
  neutral: 'focused',
  skeptical: 'focused',
  resistant: 'focused',
  impatient: 'focused',
  time_pressed: 'focused',
  time: 'focused',
});
const OPENING_ALLOWED_STAGES = Object.freeze(['open', 'focused']);
const OPENING_DISALLOWED_STATE_ALIASES = Object.freeze({
  hard_demand: Object.freeze(['hard_demand', 'hard-demand', 'hard constraint']),
  ultimatum: Object.freeze(['ultimatum', 'final_warning']),
  disengage: Object.freeze(['disengage', 'disengaging', 'close_off']),
  high_pressure_constraint: Object.freeze(['high_pressure_constraint', 'high_pressure']),
});
const DISALLOWED_OPENING_STATE_DOWNGRADE = Object.freeze({
  hard_demand: 'focused',
  ultimatum: 'time_constrained',
  disengage: 'polite_redirect',
  high_pressure_constraint: 'mild_focus',
});

function stageIndex(stage = 'open') {
  const idx = ESCALATION_STAGES.indexOf(stage);
  return idx >= 0 ? idx : 0;
}

function deterministicIndex(seed = '', modulo = 1) {
  const normalized = String(seed || '');
  if (!normalized || modulo <= 1) return 0;
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0) % modulo;
}

function tokenizeState(rawValue = '') {
  return String(rawValue || '')
    .toLowerCase()
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function resolveStateToken(rawValue = '', candidateMap = {}) {
  const tokens = tokenizeState(rawValue);
  for (const [state, aliases] of Object.entries(candidateMap)) {
    if (aliases.some((alias) => tokens.includes(alias))) {
      return state;
    }
  }
  return null;
}

function deriveTimePressure(sceneSetup = {}, hcpState = '') {
  const sceneTime = normalizeText(sceneSetup?.timePressure);
  if (sceneTime === 'high') return 1;
  if (sceneTime === 'medium' || sceneTime === 'moderate') return 0.6;
  if (sceneTime === 'low') return 0.2;
  if (/time|impatient|rushed/.test(normalizeText(hcpState))) return 0.7;
  return 0.4;
}

function deriveEngagementModifier(hcpState = '', baselineStyle = '') {
  const state = normalizeText(hcpState);
  const style = normalizeText(baselineStyle);
  if (/receptive|engaged|collaborative/.test(`${state} ${style}`)) return 0.2;
  if (/resistant|skeptic|impatient/.test(`${state} ${style}`)) return -0.15;
  return 0;
}

function deriveSkepticismModifier(hcpState = '', baselineOpennessResistance = '') {
  const text = `${normalizeText(hcpState)} ${normalizeText(baselineOpennessResistance)}`;
  if (/skeptic|resistant/.test(text)) return 0.2;
  if (/receptive|engaged/.test(text)) return -0.05;
  return 0;
}

function deriveOrientation({ baselineCommunicationStyle = '', activeConcern = '', cueMeaning = '', careSetting = '', knownConstraints = [] } = {}) {
  const joined = [
    baselineCommunicationStyle,
    activeConcern,
    cueMeaning,
    careSetting,
    ...(Array.isArray(knownConstraints) ? knownConstraints : []),
  ].map(normalizeText).join(' ');

  if (/evidence|trial|data|analytic|analytical|subgroup|endpoint/.test(joined)) return 'analytical';
  if (/selection|screen|candidate|triage|eligib/.test(joined)) return 'patient_selection';
  if (/workflow|operational|clinic|resource|time|implementation|practical|access/.test(joined)) return 'operational';
  return 'balanced';
}

function baselineFromScenario(scenario = {}) {
  const fromScenario = scenario?.enforcementCriteria || scenario?.sceneSetup?.enforcementCriteria || {};
  return {
    baselineForgiveness: clamp(fromScenario.baselineForgiveness ?? 0.55),
    baselinePrecisionDemand: clamp(fromScenario.baselinePrecisionDemand ?? 0.5),
    baselineEvidenceStrictness: clamp(fromScenario.baselineEvidenceStrictness ?? 0.5),
    baselineWorkflowStrictness: clamp(fromScenario.baselineWorkflowStrictness ?? 0.5),
    baselineEscalationSensitivity: clamp(fromScenario.baselineEscalationSensitivity ?? 0.5),
    timePressureEscalationModifier: clamp(fromScenario.timePressureEscalationModifier ?? 0.25, -1, 1),
    engagementSlackModifier: clamp(fromScenario.engagementSlackModifier ?? 0.2, -1, 1),
    skepticismEscalationModifier: clamp(fromScenario.skepticismEscalationModifier ?? 0.25, -1, 1),
  };
}

export function deriveHcpEnforcementProfile({
  scenario = {},
  hcpProfile = {},
  sceneSetup = {},
  hcpState = 'neutral',
  cueMeaning = 'neutral',
  activeConcern = 'workflow',
  hardDemandState = {},
  domainAssessment = {},
  priorDomainDriftCount = 0,
} = {}) {
  const baseline = baselineFromScenario(scenario);
  const orientation = deriveOrientation({
    baselineCommunicationStyle: hcpProfile?.baselineCommunicationStyle,
    activeConcern,
    cueMeaning,
    careSetting: hcpProfile?.careSetting,
    knownConstraints: hcpProfile?.knownConstraints,
  });

  const timePressure = deriveTimePressure(sceneSetup, hcpState);
  const engagementModifier = deriveEngagementModifier(hcpState, hcpProfile?.baselineCommunicationStyle);
  const skepticismModifier = deriveSkepticismModifier(hcpState, hcpProfile?.baselineOpennessResistance);
  const hardDemandModifier = hardDemandState?.hardDemandPriorityLock ? 0.18 : 0;

  const toleranceScore = clamp(
    baseline.baselineForgiveness
      + engagementModifier
      - (timePressure * baseline.timePressureEscalationModifier)
      - (skepticismModifier * baseline.skepticismEscalationModifier)
      - hardDemandModifier,
  );

  const escalationVelocity = clamp(
    baseline.baselineEscalationSensitivity
      + (timePressure * baseline.timePressureEscalationModifier)
      + (skepticismModifier * baseline.skepticismEscalationModifier)
      - (engagementModifier * baseline.engagementSlackModifier)
      + hardDemandModifier,
  );

  const tonePressureLevel = clamp(
    (1 - toleranceScore) * 0.45
      + escalationVelocity * 0.35
      + baseline.baselinePrecisionDemand * 0.2,
  );

  const narrowingBias = clamp(
    baseline.baselinePrecisionDemand * 0.4
      + baseline.baselineWorkflowStrictness * (orientation === 'operational' ? 0.35 : 0.15)
      + baseline.baselineEvidenceStrictness * (orientation === 'analytical' ? 0.35 : 0.15)
      + hardDemandModifier,
  );

  return {
    baseline,
    orientation,
    toleranceScore,
    escalationVelocity,
    forgivenessSlack: clamp(toleranceScore * (1 - baseline.baselinePrecisionDemand * 0.5)),
    tonePressureLevel,
    narrowingBias,
    styleVector: {
      evidenceStrictness: clamp(baseline.baselineEvidenceStrictness + (orientation === 'analytical' ? 0.2 : 0)),
      workflowStrictness: clamp(baseline.baselineWorkflowStrictness + (orientation === 'operational' ? 0.2 : 0)),
      precisionDemand: clamp(baseline.baselinePrecisionDemand + (orientation === 'balanced' ? 0.05 : 0.12)),
      directness: clamp(tonePressureLevel),
    },
    drivers: {
      role: hcpProfile?.role || null,
      specialty: hcpProfile?.specialty || null,
      careSetting: hcpProfile?.careSetting || null,
      baselineCommunicationStyle: hcpProfile?.baselineCommunicationStyle || null,
      knownConstraints: Array.isArray(hcpProfile?.knownConstraints) ? hcpProfile.knownConstraints : [],
      timePressure: sceneSetup?.timePressure || null,
      currentClinicalOperationalContext: sceneSetup?.currentClinicalOperationalContext || sceneSetup?.currentContext || null,
      hcpState,
      cueMeaning,
      activeConcern,
    },
  };
}

function deriveRepAdequacyScore({ alignment = {}, concernFlowOutcome = 'aligned', repMessage = '', domainAssessment = {} } = {}) {
  const alignmentScore = Number(alignment?.score);
  const normalizedAlignment = Number.isFinite(alignmentScore)
    ? clamp((alignmentScore - 1) / 3)
    : 0.5;
  const misalignments = Array.isArray(alignment?.misalignments) ? alignment.misalignments.length : 0;
  const rubricFlags = Array.isArray(alignment?.rubricAlignmentFlags) ? alignment.rubricAlignmentFlags.length : 0;
  const driftPenalty = concernFlowOutcome === 'missed' || concernFlowOutcome === 'overpivot' ? 0.2 : 0;
  const vaguePenalty = /\b(great|interesting|thanks|good point)\b/i.test(String(repMessage || '')) && String(repMessage || '').length < 90
    ? 0.08
    : 0;
  const domainPenalty = domainAssessment?.repDomainStatus === 'cross_domain_contamination'
    ? 0.45
    : domainAssessment?.repDomainStatus === 'adjacent_but_recoverable'
      ? 0.08
      : 0;
  return clamp(normalizedAlignment - (misalignments * 0.12) - (rubricFlags * 0.05) - driftPenalty - vaguePenalty - domainPenalty);
}

function escalationDelta({
  profile,
  adequacy,
  misalignmentCount = 0,
  hardDemandMissCount = 0,
  concernFlowOutcome = 'aligned',
  domainAssessment = {},
  domainDriftCount = 0,
  openingExchange = false,
} = {}) {
  let delta = 0;
  const reason = [];

  if (adequacy < 0.4) {
    delta += 1;
    reason.push('rep_inadequate_response');
  }
  if (!openingExchange && (concernFlowOutcome === 'missed' || concernFlowOutcome === 'overpivot')) {
    delta += 1;
    reason.push('rep_topic_or_demand_miss');
  }
  if (misalignmentCount >= 2) {
    delta += 1;
    reason.push('multi_signal_misalignment');
  }
  if (!openingExchange && hardDemandMissCount >= 1) {
    delta += 1;
    reason.push('hard_demand_not_met');
  }
  if (!openingExchange && hardDemandMissCount >= 3) {
    delta += 1;
    reason.push('repeated_hard_demand_miss');
  }
  if (domainAssessment?.repDomainStatus === 'cross_domain_contamination') {
    delta += 2;
    reason.push('cross_domain_contamination');
  } else if (domainAssessment?.repDomainStatus === 'adjacent_but_recoverable') {
    delta += 1;
    reason.push('adjacent_domain_drift');
  }
  if (domainDriftCount >= 2) {
    delta += 1;
    reason.push('repeated_domain_drift');
  }

  if (adequacy > 0.74 && misalignmentCount === 0 && !domainAssessment?.contextContamination) {
    delta -= 1;
    reason.push('direct_recovery_alignment');
  }

  const scaled = delta > 0
    ? Math.max(1, Math.round(delta * (0.8 + profile.escalationVelocity)))
    : delta;

  return { delta: scaled, reason: reason.length > 0 ? reason.join('|') : 'stable' };
}

function deriveOpeningStageCap({ hcpState = '', profile = {} } = {}) {
  const normalizedState = normalizeText(hcpState);
  const matchedPersona = Object.keys(OPENING_STAGE_CAP_BY_PERSONA).find((key) => normalizedState.includes(key));
  if (matchedPersona) return OPENING_STAGE_CAP_BY_PERSONA[matchedPersona];
  if (profile?.drivers?.timePressure === 'high') return 'focused';
  return 'focused';
}

export function downgradeToAllowedOpeningState(hcpState = '') {
  const normalized = normalizeText(hcpState);
  const resolvedDisallowed = resolveStateToken(normalized, OPENING_DISALLOWED_STATE_ALIASES);
  if (!resolvedDisallowed) return normalized || 'neutral';
  return DISALLOWED_OPENING_STATE_DOWNGRADE[resolvedDisallowed] || 'mild_focus';
}

function deriveTurnScopedOpeningStage({
  requestedStage = 'open',
  turnNumber = 0,
  scenarioOpeningState = '',
  hcpState = '',
  profile = {},
} = {}) {
  const isExplicitHighPressureOpening = normalizeText(scenarioOpeningState) === 'high_pressure';
  if (Number(turnNumber) !== 1 || isExplicitHighPressureOpening) return requestedStage;

  const openingCap = deriveOpeningStageCap({ hcpState, profile });
  const boundedStage = ESCALATION_STAGES[Math.min(stageIndex(requestedStage), stageIndex(openingCap))];
  if (OPENING_ALLOWED_STAGES.includes(boundedStage)) return boundedStage;
  return 'focused';
}

const OPENING_DIALOGUE_MAP = Object.freeze({
  time_pressed: Object.freeze({
    neutral: 'I have a minute, so what is the point that matters for today?',
    polite_redirect: 'I am short on time, so connect this to one practical step.',
    mild_focus: 'Keep it focused: what is the single takeaway for this setting?',
    light_time_constraint: 'I have a short window, so what should I prioritize first?',
    curious: 'Quickly, what did you want to highlight first?',
    skeptical_low_intensity: 'I only have a moment, so what is the strongest point?',
  }),
  engaged: Object.freeze({
    neutral: 'Sure—what did you want to discuss first?',
    polite_redirect: 'Happy to discuss this; keep it tied to my current patients.',
    mild_focus: 'Let us focus on the key point you want me to consider.',
    light_time_constraint: 'I can review this briefly—what should I look at first?',
    curious: 'I am interested—what stood out most to you?',
    skeptical_low_intensity: 'I am open to it, but what is your clearest takeaway?',
  }),
  skeptical: Object.freeze({
    neutral: 'I hear this often—what specifically should I take away?',
    polite_redirect: 'Before we go wide, anchor this to one concrete point.',
    mild_focus: 'Focus me on the strongest reason this matters in practice.',
    light_time_constraint: 'Given limited time, what is the most credible point?',
    curious: 'What makes this different from what I already know?',
    skeptical_low_intensity: 'I need one concrete reason to keep going.',
  }),
  operational: Object.freeze({
    neutral: 'What is one workflow step my team could actually use this week?',
    polite_redirect: 'Keep this practical: what is the next operational move?',
    mild_focus: 'Focus on implementation: what changes tomorrow?',
    light_time_constraint: 'In one minute, what is the practical priority?',
    curious: 'How would this fit into current clinic flow?',
    skeptical_low_intensity: 'What operationally changes if we do this?',
  }),
  analytical: Object.freeze({
    neutral: 'What is the key evidence point I should weigh first?',
    polite_redirect: 'Anchor this to one evidence detail before we expand.',
    mild_focus: 'Focus on the single data point that drives the decision.',
    light_time_constraint: 'Given limited time, which evidence signal matters most?',
    curious: 'Which finding do you think is most decision-relevant?',
    skeptical_low_intensity: 'What makes the evidence here more convincing?',
  }),
  balanced: Object.freeze({
    neutral: 'What is the specific point you want me to respond to?',
    polite_redirect: 'Let’s keep this tied to the current context.',
    mild_focus: 'Please focus on the main takeaway first.',
    light_time_constraint: 'Briefly, what should I prioritize?',
    curious: 'What do you think is most relevant right now?',
    skeptical_low_intensity: 'What is the strongest reason this applies here?',
  }),
});
const OPENING_VARIANT_SUFFIXES = Object.freeze({
  neutral: Object.freeze([
    '',
    'Keep it practical for today.',
    'Tie it to what is happening in clinic.',
  ]),
  polite_redirect: Object.freeze([
    '',
    'Start with what is actionable now.',
    'Anchor it to the immediate decision.',
  ]),
  mild_focus: Object.freeze([
    '',
    'Then we can expand if needed.',
    'We can go deeper after the core point.',
  ]),
  light_time_constraint: Object.freeze([
    '',
    'My next patient is waiting.',
    'I only have a short window.',
  ]),
  curious: Object.freeze([
    'I can explore details after that.',
    'Then we can discuss specifics.',
    'We can unpack it further once clear.',
  ]),
  skeptical_low_intensity: Object.freeze([
    'I need it to be concrete.',
    'I need it to be defensible.',
    'I need a clear reason to proceed.',
  ]),
});

function deriveOpeningDialogueState({ hcpState = '', scenarioOpeningState = '', activeConcern = '' } = {}) {
  const normalizedScenarioState = normalizeText(scenarioOpeningState);
  if (normalizedScenarioState && normalizedScenarioState !== 'high_pressure') return normalizedScenarioState;

  const stateTokens = new Set(tokenizeState(hcpState));
  if (stateTokens.has('skeptical') || stateTokens.has('resistant')) return 'skeptical_low_intensity';
  if (stateTokens.has('engaged') || stateTokens.has('receptive') || stateTokens.has('collaborative')) return 'curious';
  if (stateTokens.has('time-pressured') || stateTokens.has('time_pressured') || stateTokens.has('impatient') || stateTokens.has('rushed')) return 'light_time_constraint';

  const concern = normalizeText(activeConcern);
  if (concern.includes('workflow') || concern.includes('operational')) return 'mild_focus';
  return 'neutral';
}

function deriveOpeningPersonaClass({ profile = {}, hcpState = '', activeConcern = '' } = {}) {
  const stateTokens = new Set(tokenizeState(hcpState));
  if (stateTokens.has('time-pressured') || stateTokens.has('time_pressured') || stateTokens.has('impatient') || stateTokens.has('rushed')) return 'time_pressed';
  if (stateTokens.has('engaged') || stateTokens.has('receptive') || stateTokens.has('collaborative')) return 'engaged';
  if (stateTokens.has('skeptical') || stateTokens.has('resistant')) return 'skeptical';
  if (profile?.orientation === 'operational') return 'operational';
  if (profile?.orientation === 'analytical') return 'analytical';
  const concern = normalizeText(activeConcern);
  if (concern.includes('workflow') || concern.includes('operational')) return 'operational';
  if (concern.includes('evidence')) return 'analytical';
  return 'balanced';
}

function selectScenarioBoundOpeningDialogue({
  profile = {},
  activeConcern = '',
  hcpState = '',
  scenarioOpeningState = '',
  scenarioId = '',
  turnNumber = 0,
} = {}) {
  const personaClass = deriveOpeningPersonaClass({ profile, hcpState, activeConcern });
  const dialogueState = deriveOpeningDialogueState({ hcpState, scenarioOpeningState, activeConcern });
  const personaMap = OPENING_DIALOGUE_MAP[personaClass] || OPENING_DIALOGUE_MAP.balanced;
  const baseLine = personaMap[dialogueState] || personaMap.neutral || OPENING_DIALOGUE_MAP.balanced.neutral;
  const suffixPool = OPENING_VARIANT_SUFFIXES[dialogueState] || OPENING_VARIANT_SUFFIXES.neutral;
  const suffix = suffixPool[deterministicIndex(`${scenarioId}:${turnNumber}:${personaClass}:${dialogueState}:${activeConcern}`, suffixPool.length)];
  return `${baseLine} ${suffix}`.trim();
}

export function deriveEscalationState({
  profile,
  turnNumber = 0,
  hcpState = '',
  scenarioOpeningState = '',
  priorEscalationStage = 'open',
  priorMisalignmentCount = 0,
  priorHardDemandMissCount = 0,
  alignment = {},
  concernFlowOutcome = 'aligned',
  repMessage = '',
  hardDemandState = {},
  domainAssessment = {},
  priorDomainDriftCount = 0,
  allowImmediateHighPressure = false,
} = {}) {
  const openingExchange = Number(turnNumber) === 1 && stageIndex(priorEscalationStage) <= stageIndex('open');
  const repAdequacyScore = deriveRepAdequacyScore({ alignment, concernFlowOutcome, repMessage, domainAssessment });
  const currentMisalignmentCount = Array.isArray(alignment?.misalignments) ? alignment.misalignments.length : 0;
  const misalignmentCount = repAdequacyScore < 0.55
    ? priorMisalignmentCount + Math.max(1, currentMisalignmentCount)
    : Math.max(0, priorMisalignmentCount - 1);

  const hardDemandMissCount = hardDemandState?.hardDemandPriorityLock && hardDemandState?.hardDemandUnresolved
    ? priorHardDemandMissCount + 1
    : Math.max(0, priorHardDemandMissCount - 1);

  const domainDriftCount = domainAssessment?.contextContamination
    ? priorDomainDriftCount + 1
    : Math.max(0, priorDomainDriftCount - (domainAssessment?.repDomainStatus === 'in_domain' ? 1 : 0));

  const { delta, reason } = escalationDelta({
    profile,
    adequacy: repAdequacyScore,
    misalignmentCount,
    hardDemandMissCount,
    concernFlowOutcome,
    domainAssessment,
    domainDriftCount,
    openingExchange,
  });

  const uncappedStageIndex = Math.max(0, Math.min(ESCALATION_STAGES.length - 1, stageIndex(priorEscalationStage) + delta));
  const openingStageCap = openingExchange ? deriveOpeningStageCap({ hcpState, profile }) : null;
  const capIndex = openingStageCap ? stageIndex(openingStageCap) : ESCALATION_STAGES.length - 1;
  const nextStageIndex = Math.min(uncappedStageIndex, capIndex);
  const requestedStage = ESCALATION_STAGES[nextStageIndex];
  let nextStage = deriveTurnScopedOpeningStage({
    requestedStage,
    turnNumber,
    scenarioOpeningState,
    hcpState,
    profile,
  });
  const noEscalationHistory = stageIndex(priorEscalationStage) === 0
    && priorMisalignmentCount <= 0
    && priorHardDemandMissCount <= 0
    && priorDomainDriftCount <= 0;
  if (!allowImmediateHighPressure && noEscalationHistory && (nextStage === 'high_pressure' || nextStage === 'disengaging')) {
    nextStage = 'firm';
  }
  const resolvedStageIndex = stageIndex(nextStage);

  return {
    escalationStage: nextStage,
    escalationReason: reason,
    repAdequacyScore,
    misalignmentCount,
    hardDemandMissCount,
    domainDriftCount,
    tonePressureLevel: clamp(profile.tonePressureLevel + (resolvedStageIndex * 0.1)),
    forgivenessSlack: clamp(profile.forgivenessSlack - (resolvedStageIndex * 0.1)),
    toleranceScore: clamp(profile.toleranceScore - (resolvedStageIndex * 0.08)),
  };
}

const STAGE_DIRECTIVE_TEMPLATE_MAP = Object.freeze({
  open: { cue: [''], operational: [''], analytical: [''], patient_selection: [''], balanced: [''] },
  focused: {
    cue: [
      'The HCP posture tightens slightly, signaling a more focused ask.',
      'The HCP leans in with a tighter posture, signaling a focused ask.',
      'The HCP narrows posture and signals a more focused ask.',
    ],
    operational: [
      'Start with one operationally specific step.',
      'Keep this to one concrete workflow step.',
      'Stay with one workflow-specific next step.',
    ],
    analytical: [
      'Please anchor this to a specific evidence detail.',
      'Please tie this to one concrete evidence detail.',
      'Ground this in one specific piece of evidence.',
    ],
    patient_selection: [
      'Please keep this to one clear patient-selection criterion.',
      'Please provide one explicit patient-selection criterion.',
      'Keep this to one precise criterion for patient selection.',
    ],
    balanced: [
      'Please answer the specific ask directly.',
      'Please respond directly to the specific ask.',
      'Address the exact ask directly.',
    ],
  },
  narrowed: {
    cue: [
      'The HCP body language is more pointed, waiting for a precise answer.',
      'The HCP body language sharpens, waiting for a precise answer.',
      'The HCP posture becomes more pointed, expecting a precise answer.',
    ],
    operational: [
      'That is not yet specific to workflow execution.',
      'That is still not specific enough for workflow execution.',
      'That remains too broad for workflow execution.',
    ],
    analytical: [
      'That is not yet specific to the evidence threshold I need.',
      'That is still not specific to the evidence threshold I need.',
      'That remains too broad for the evidence threshold I need.',
    ],
    patient_selection: [
      'That is not yet specific to who qualifies in practice.',
      'That is still not specific to who qualifies in practice.',
      'That remains too broad for who qualifies in practice.',
    ],
    balanced: [
      'That still misses the specific decision point.',
      'That remains short of the specific decision point.',
      'That does not yet address the specific decision point.',
    ],
  },
  firm: {
    cue: [
      'The HCP is visibly less patient and expects a direct correction.',
      'The HCP shows less patience and expects a direct correction.',
      'The HCP appears less patient, expecting a direct correction.',
    ],
    operational: [
      'Let us stay on the workflow blocker and answer it directly.',
      'Stay on the workflow blocker and answer it directly.',
      'Keep focus on the workflow blocker and answer directly.',
    ],
    analytical: [
      'Let us stay on the evidence question and answer it directly.',
      'Stay on the evidence question and answer it directly.',
      'Keep focus on the evidence question and answer directly.',
    ],
    patient_selection: [
      'Let us stay on patient selection and answer it directly.',
      'Stay on patient selection and answer it directly.',
      'Keep focus on patient selection and answer directly.',
    ],
    balanced: [
      'Let us stay on this question and answer it directly.',
      'Stay on this question and answer it directly.',
      'Keep focus on this question and answer directly.',
    ],
  },
  high_pressure: {
    cue: [
      'The HCP looks ready to disengage if specificity does not improve now.',
      'The HCP appears ready to disengage unless specificity improves now.',
      'The HCP looks close to disengaging if specificity does not improve now.',
    ],
    operational: [
      'I still need to hear how this would work in our clinic.',
      'I need this tied to the actual workflow before we go further.',
      'Help me understand the practical step my team would use.',
    ],
    analytical: [
      'I still need the evidence point that would change my read on this.',
      'I need this tied to the data before we go further.',
      'Help me understand the specific evidence you want me to consider.',
    ],
    patient_selection: [
      'I still need to know which patients you mean.',
      'I need this tied to patient selection before we go further.',
      'Help me understand the specific patient type you are talking about.',
    ],
    balanced: [
      'I still need a more specific point before this is useful.',
      'I need this tied to the actual decision before we go further.',
      'Help me understand the specific point you want me to consider.',
    ],
  },
  disengaging: {
    cue: [
      'The HCP is signaling close-off unless the response immediately realigns.',
      'The HCP signals close-off unless the response realigns immediately.',
      'The HCP is preparing to close off unless the response realigns now.',
    ],
    operational: [
      'Start with one practical workflow step my team could actually use.',
      'Keep it to one workflow step we could use here.',
      'Tell me the first practical workflow step you would recommend.',
    ],
    analytical: [
      'Start with the evidence point that would matter most for this decision.',
      'Keep it to one evidence point I can evaluate here.',
      'Tell me the evidence point you think changes the decision.',
    ],
    patient_selection: [
      'Start with the patient type you mean.',
      'Keep it to one patient-selection point I can use here.',
      'Tell me which patient profile you are talking about.',
    ],
    balanced: [
      'Start with the specific point you want me to respond to.',
      'Keep it to one specific point I can use here.',
      'Tell me the point you want me to consider first.',
    ],
  },
});

const TEMPLATE_VARIANT_MAX = 5;

const STAGE_INTENT_REQUIREMENTS = Object.freeze({
  focused: {
    cue: 'focused_cue',
    dialogue: 'specific_directive',
  },
  narrowed: {
    cue: 'narrowing_cue',
    dialogue: 'specificity_gap',
  },
  firm: {
    cue: 'firm_pressure_cue',
    dialogue: 'direct_correction',
  },
  high_pressure: {
    cue: 'high_pressure_cue',
    dialogue: 'immediate_utility_risk',
  },
  disengaging: {
    cue: 'disengaging_cue',
    dialogue: 'final_exact_or_pause',
  },
});

export function assertTemplateEquivalence(stage, templates) {
  const requirement = STAGE_INTENT_REQUIREMENTS[stage];
  if (!requirement) return;

  Object.entries(templates || {}).forEach(([channel, channelTemplates]) => {
    if (!Array.isArray(channelTemplates) || channelTemplates.length === 0) return;
    if (channelTemplates.length > TEMPLATE_VARIANT_MAX) {
      throw new Error(`Template variant cap exceeded for ${stage}.${channel}`);
    }
    const intentTag = requirement[channel === 'cue' ? 'cue' : 'dialogue'];
    if (!intentTag) return;
    channelTemplates.forEach((template, index) => {
      if (typeof template !== 'string' || !template.trim()) {
        throw new Error(`Template semantic divergence detected at ${stage}.${channel}[${index}] empty_template`);
      }
      const storedIntentTag = `${stage}:${channel === 'cue' ? 'cue' : 'dialogue'}:${intentTag}`;
      if (!storedIntentTag) {
        throw new Error(`Template semantic divergence detected at ${stage}.${channel}[${index}] missing intent tag`);
      }
    });
  });
}

const shouldAssertTemplates = typeof process !== 'undefined'
  && process?.env
  && process.env.NODE_ENV !== 'production';

if (shouldAssertTemplates) {
  Object.entries(STAGE_DIRECTIVE_TEMPLATE_MAP).forEach(([stage, templates]) => {
    assertTemplateEquivalence(stage, templates);
  });
}

function hasConcernBoundPressureMove(dialogueText = '', activeConcern = '') {
  const text = String(dialogueText || '').toLowerCase();
  if (!text.trim()) return false;

  const hasPressureShape = /\?/.test(text)
    || /\b(i need|i still need|i can keep going|help me understand|can you|could you|what|how|start with|keep it to|keep this tied|keep this to|let'?s keep|make this about|give me|tell me|show me|focus on)\b/.test(text);
  if (!hasPressureShape) return false;

  const pressureContent = /\b(workflow|operational|practical|team|clinic|staff|step|implement|implementation|burden|feasible|access|prior|auth|coverage|payer|turnaround|friction|evidence|data|trial|endpoint|proof|clinical|patient|patients|screen|screening|selection|candidate|criteria)\b/;
  return pressureContent.test(text);
}

export function applyEscalationPresentation({
  cueText = '',
  dialogueText = '',
  escalationStage = 'open',
  profile = {},
  domainAssessment = {},
  activeConcern = '',
  turnNumber = 0,
  scenarioOpeningState = '',
  hcpState = '',
  scenarioId = '',
} = {}) {
  const stageRules = STAGE_DIRECTIVE_TEMPLATE_MAP[escalationStage] || STAGE_DIRECTIVE_TEMPLATE_MAP.open;
  const providedDialogue = String(dialogueText || '').trim();
  const normalizedDialogue = providedDialogue || (
    Number(turnNumber) === 1 || escalationStage === 'open'
      ? selectScenarioBoundOpeningDialogue({
        profile,
        activeConcern,
        hcpState: hcpState || profile?.drivers?.hcpState || '',
        scenarioOpeningState,
        scenarioId,
        turnNumber,
      })
      : ''
  );
  if (escalationStage === 'open') return { cueText, dialogueText: normalizedDialogue };
  if (Number(turnNumber) === 1) {
    return { cueText, dialogueText: normalizedDialogue };
  }

  const orientation = profile.orientation || 'balanced';
  const styleSeed = {
    escalationStage,
    orientation,
    activeConcern: normalizeText(activeConcern),
    scenarioDomain: normalizeText(domainAssessment?.scenarioDomain),
    turnNumber: Number(turnNumber) || 0,
  };
  const cueSuffix = deterministicVariant({ ...styleSeed, channel: 'cue' }, stageRules.cue);
  const dialoguePrefix = deterministicVariant({ ...styleSeed, channel: 'dialogue' }, stageRules[orientation] || stageRules.balanced);

  const updatedCue = cueText.includes(cueSuffix) || !cueSuffix
    ? cueText
    : `${cueText} ${cueSuffix}`.trim();

  const shouldPreserveHumanMove = hasConcernBoundPressureMove(normalizedDialogue, activeConcern);
  const updatedDialogue = shouldPreserveHumanMove
    || normalizedDialogue.toLowerCase().startsWith(dialoguePrefix.toLowerCase())
    || !dialoguePrefix
    ? normalizedDialogue
    : `${dialoguePrefix} ${normalizedDialogue}`.trim();

  const scenarioDomainLabel = String(domainAssessment?.scenarioDomain || 'current scenario').replace(/_/g, ' ');
  const concernLabel = String(activeConcern || 'active issue').replace(/_/g, ' ');
  const reanchorPrefix = domainAssessment?.scenarioReanchorRequired
    ? `That is outside the ${scenarioDomainLabel} context. Let's stay on ${concernLabel}.`
    : '';
  const reanchoredDialogue = reanchorPrefix && !updatedDialogue.toLowerCase().includes('outside the')
    ? `${reanchorPrefix} ${updatedDialogue}`
    : updatedDialogue;

  return {
    cueText: updatedCue,
    dialogueText: reanchoredDialogue,
  };
}
