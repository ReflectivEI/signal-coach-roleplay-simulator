function clamp(value, min = 0, max = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase();
}

export const ESCALATION_STAGES = Object.freeze([
  'open',
  'focused',
  'narrowed',
  'firm',
  'high_pressure',
  'disengaging',
]);

function stageIndex(stage = 'open') {
  const idx = ESCALATION_STAGES.indexOf(stage);
  return idx >= 0 ? idx : 0;
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
} = {}) {
  let delta = 0;
  const reason = [];

  if (adequacy < 0.4) {
    delta += 1;
    reason.push('rep_inadequate_response');
  }
  if (concernFlowOutcome === 'missed' || concernFlowOutcome === 'overpivot') {
    delta += 1;
    reason.push('rep_topic_or_demand_miss');
  }
  if (misalignmentCount >= 2) {
    delta += 1;
    reason.push('multi_signal_misalignment');
  }
  if (hardDemandMissCount >= 1) {
    delta += 1;
    reason.push('hard_demand_not_met');
  }
  if (hardDemandMissCount >= 3) {
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

export function deriveEscalationState({
  profile,
  priorEscalationStage = 'open',
  priorMisalignmentCount = 0,
  priorHardDemandMissCount = 0,
  alignment = {},
  concernFlowOutcome = 'aligned',
  repMessage = '',
  hardDemandState = {},
  domainAssessment = {},
  priorDomainDriftCount = 0,
} = {}) {
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
  });

  const nextStageIndex = Math.max(0, Math.min(ESCALATION_STAGES.length - 1, stageIndex(priorEscalationStage) + delta));
  const nextStage = ESCALATION_STAGES[nextStageIndex];

  return {
    escalationStage: nextStage,
    escalationReason: reason,
    repAdequacyScore,
    misalignmentCount,
    hardDemandMissCount,
    domainDriftCount,
    tonePressureLevel: clamp(profile.tonePressureLevel + (nextStageIndex * 0.1)),
    forgivenessSlack: clamp(profile.forgivenessSlack - (nextStageIndex * 0.1)),
    toleranceScore: clamp(profile.toleranceScore - (nextStageIndex * 0.08)),
  };
}

const STAGE_DIRECTIVE_MAP = Object.freeze({
  open: { cue: '', operational: '', analytical: '', patient_selection: '', balanced: '' },
  focused: {
    cue: 'The HCP posture tightens slightly, signaling a more focused ask.',
    operational: "Let's keep this to one operationally specific step.",
    analytical: 'Please anchor this to a specific evidence detail.',
    patient_selection: 'Please keep this to one clear patient-selection criterion.',
    balanced: 'Please answer the specific ask directly.',
  },
  narrowed: {
    cue: 'The HCP body language is more pointed, waiting for a precise answer.',
    operational: 'That is not yet specific to workflow execution.',
    analytical: 'That is not yet specific to the evidence threshold I need.',
    patient_selection: 'That is not yet specific to who qualifies in practice.',
    balanced: 'That still misses the specific decision point.',
  },
  firm: {
    cue: 'The HCP is visibly less patient and expects a direct correction.',
    operational: 'Let us stay on the workflow blocker and answer it directly.',
    analytical: 'Let us stay on the evidence question and answer it directly.',
    patient_selection: 'Let us stay on patient selection and answer it directly.',
    balanced: 'Let us stay on this question and answer it directly.',
  },
  high_pressure: {
    cue: 'The HCP looks ready to disengage if specificity does not improve now.',
    operational: 'If this remains non-specific, it will not be usable in my workflow decisions.',
    analytical: 'If this remains non-specific, it will not be usable for my evidence judgment.',
    patient_selection: 'If this remains non-specific, it will not help patient selection.',
    balanced: 'If this remains non-specific, this will not be useful to my decision.',
  },
  disengaging: {
    cue: 'The HCP is signaling close-off unless the response immediately realigns.',
    operational: 'I need one exact operational answer now or we should pause here.',
    analytical: 'I need one exact evidence answer now or we should pause here.',
    patient_selection: 'I need one exact patient-selection answer now or we should pause here.',
    balanced: 'I need one exact answer now or we should pause here.',
  },
});

export function applyEscalationPresentation({ cueText = '', dialogueText = '', escalationStage = 'open', profile = {}, domainAssessment = {}, activeConcern = '' } = {}) {
  const stageRules = STAGE_DIRECTIVE_MAP[escalationStage] || STAGE_DIRECTIVE_MAP.open;
  if (escalationStage === 'open') return { cueText, dialogueText };

  const orientation = profile.orientation || 'balanced';
  const cueSuffix = stageRules.cue;
  const dialoguePrefix = stageRules[orientation] || stageRules.balanced;

  const updatedCue = cueText.includes(cueSuffix) || !cueSuffix
    ? cueText
    : `${cueText} ${cueSuffix}`.trim();

  const normalizedDialogue = String(dialogueText || '').trim();
  const updatedDialogue = normalizedDialogue.toLowerCase().startsWith(dialoguePrefix.toLowerCase()) || !dialoguePrefix
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
