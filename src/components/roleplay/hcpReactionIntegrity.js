import {
  deriveHcpEnforcementProfile,
  deriveEscalationState,
  applyEscalationPresentation,
  downgradeToAllowedOpeningState,
} from './hcpEnforcementEscalation.js';
import { evaluateScenarioDomainIntegrity, enforceDomainReanchorInDialogue } from './scenarioDomainIntegrity.js';
import { extractScenarioOwnedOpeningTurn } from './openingTurnAuthority.js';

function normalizeText(value) {
  return String(value || '').trim();
}

function classifyCueIntent(cueText = '') {
  const value = normalizeText(cueText).toLowerCase();
  if (!value) return 'neutral';
  if (/\b(ending|leave|front desk|wrap|closing|door|exchange is over)\b/.test(value)) return 'closing';
  if (/\b(clipped|skeptic|defensive|patience thinning|frustrat|impatient|irritat|resistant)\b/.test(value)) return 'resistant';
  if (/\b(engagement|leans forward|acknowledgment|relaxed|engaged|nods)\b/.test(value)) return 'engaged';
  if (/\b(clock|watch|pager|time|hurry|quick|schedule|minute)\b/.test(value)) return 'time';
  return 'neutral';
}

function classifyDialogueIntent(dialogueText = '') {
  const value = normalizeText(dialogueText).toLowerCase();
  if (!value) return 'neutral';
  if (/\b(front desk|follow-up slot|conversation is ending|wrap this up|need to move on)\b/.test(value)) return 'closing';
  if (/\b(not interested|not convinced|we are done|stop here|decline|refuse|skeptical|doubt)\b/.test(value)) return 'resistant';
  if (/\b(happy to|that helps|that works|makes sense|good point|let's do that)\b/.test(value)) return 'engaged';
  if (/\b(running late|short on time|quickly|briefly|patient waiting|clock|schedule|10-minute|one minute)\b/.test(value)) return 'time';
  return 'neutral';
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function deterministicHash(value = '') {
  const input = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `fnv1a_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

const OPENING_DIALOGUE_COLLAPSE_TRACKER = new Map();

function trackOpeningDialogueVariation({
  scenarioId = '',
  turnNumber = 0,
  repMessage = '',
  selectedDialogueText = '',
  threshold = 4,
} = {}) {
  if (Number(turnNumber) !== 1) return;
  const repKey = normalizeText(repMessage).toLowerCase();
  const scenarioKey = normalizeText(scenarioId).toLowerCase();
  const dialogueKey = normalizeText(selectedDialogueText);
  if (!repKey || !scenarioKey || !dialogueKey) return;

  if (!OPENING_DIALOGUE_COLLAPSE_TRACKER.has(repKey)) {
    OPENING_DIALOGUE_COLLAPSE_TRACKER.set(repKey, new Map());
  }
  const scenarioDialogueMap = OPENING_DIALOGUE_COLLAPSE_TRACKER.get(repKey);
  scenarioDialogueMap.set(scenarioKey, dialogueKey);

  if (scenarioDialogueMap.size < threshold) return;
  const uniqueDialogues = new Set([...scenarioDialogueMap.values()].map((line) => line.toLowerCase()));
  if (uniqueDialogues.size <= 1) {
    throw new Error('Dialogue collapse detected — check scenario binding');
  }
}

function deriveDialogueIntent({ activeConcern = 'workflow', hardDemandState = {}, dialogueText = '' } = {}) {
  if (hardDemandState?.hardDemandPriorityLock && hardDemandState?.activeHardDemand) {
    return `hard_demand_${hardDemandState.activeHardDemand}`;
  }
  const concern = String(activeConcern || 'workflow').toLowerCase();
  if (/evidence/.test(concern)) return 'evidence_interrogation';
  if (/screen|selection|candidate/.test(concern)) return 'patient_selection';
  if (/time/.test(concern)) return 'time_constrained_action';
  if (/access|workflow|operational|policy/.test(concern)) return 'operational_constraint_resolution';

  const dialogue = String(dialogueText || '').toLowerCase();
  if (/\b(which|what) patients?\b/.test(dialogue)) return 'patient_selection';
  if (/\b(study|trial|evidence|data)\b/.test(dialogue)) return 'evidence_interrogation';
  return 'practical_next_step';
}

function isGreetingOnlyRepMessage(repMessage = '') {
  const text = String(repMessage || '').trim().toLowerCase();
  if (!text) return false;
  const hasGreeting = /\b(hi|hello|hey|good morning|good afternoon|good evening|how are you|how's it going|hope you're well)\b/.test(text);
  const hasBusinessContext = /\b(workflow|clinic|practice|patient|evidence|trial|study|data|screen|selection|step|access|operational|monitor)\b/.test(text);
  const tokenCount = text.split(/\s+/).filter(Boolean).length;
  return hasGreeting && !hasBusinessContext && tokenCount <= 12;
}

const REALISM_CUE_BUCKETS = Object.freeze({
  time_pressure: Object.freeze([
    'Keeps glancing between the chart and the hallway before answering.',
    'Answers while scanning the schedule, signaling limited bandwidth.',
    'Checks the next chart and waits for the most relevant point.',
  ]),
  workflow_overload: Object.freeze([
    'Glances at stacked workflow tasks and asks for the practical next step.',
    'Keeps one hand on pending forms while narrowing the question.',
    'Multitasks through paperwork and asks for what can be used this week.',
  ]),
  clinical_evaluation: Object.freeze([
    'Reviews details briefly before asking a narrower clinical question.',
    'Pauses on the data point and asks for direct applicability.',
    'Scans the handout and asks for one decision-relevant detail.',
  ]),
  guarded_interest: Object.freeze([
    'Leans in slightly, but keeps the question tightly scoped.',
    'Nods once and asks for a concrete follow-up before moving on.',
    'Acknowledges the point while holding to a practical condition.',
  ]),
});

const REALISM_UNRESOLVED_CONCERN_LINE = Object.freeze({
  workflow: Object.freeze([
    'I still need to see how this fits our current workflow constraints.',
    'Keep this tied to what my team can operationalize this week.',
    'I need the practical implementation detail before we move forward.',
  ]),
  evidence: Object.freeze([
    'I still need the one evidence point that changes the decision in practice.',
    'Keep this anchored to a decision-relevant clinical detail.',
    'I need clearer applicability before we advance this discussion.',
  ]),
  screening: Object.freeze([
    'I still need clarity on which patients this applies to in real workflow.',
    'Keep this tied to patient selection criteria we can apply consistently.',
    'I need the qualification boundary to be clear before moving on.',
  ]),
  default: Object.freeze([
    'I still need one concrete point tied to this scenario before we continue.',
    'Keep this focused on the immediate constraint in front of us.',
    'I need a practical condition addressed before we advance.',
  ]),
});

function deterministicIndex(seed = '', modulo = 1) {
  const text = String(seed || '');
  if (!text || modulo <= 1) return 0;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0) % modulo;
}

function cueBucketFromState({ hcpState = '', activeConcern = '', concernFlowOutcome = 'aligned' } = {}) {
  const state = normalizeText(hcpState).toLowerCase();
  const concern = normalizeText(activeConcern).toLowerCase();
  if (state.includes('time') || state.includes('impatient')) return 'time_pressure';
  if (concern.includes('workflow') || concern.includes('operational') || concernFlowOutcome === 'missed') return 'workflow_overload';
  if (concern.includes('evidence')) return 'clinical_evaluation';
  return 'guarded_interest';
}

function refineCueRealism({
  cueText = '',
  scenarioId = '',
  turnNumber = 0,
  hcpState = '',
  activeConcern = '',
  concernFlowOutcome = 'aligned',
  priorCueSignature = '',
  inputCueMissing = false,
} = {}) {
  const bucket = cueBucketFromState({ hcpState, activeConcern, concernFlowOutcome });
  const pool = REALISM_CUE_BUCKETS[bucket] || REALISM_CUE_BUCKETS.guarded_interest;
  const seed = `${scenarioId}:${turnNumber}:${bucket}:${activeConcern}`;
  let idx = deterministicIndex(seed, pool.length);
  const candidate = pool[idx];
  if (priorCueSignature === deterministicHash(candidate) && pool.length > 1) {
    idx = (idx + 1) % pool.length;
  }
  const genericCue = /\b(looks uncertain|seems skeptical|appears frustrated|focused expression|posture tightens|body language is more pointed|visibly less patient|ready to disengage)\b/i.test(String(cueText || ''));
  const isMissing = !normalizeText(cueText);
  const nextCue = (inputCueMissing || genericCue || isMissing) ? pool[idx] : cueText;
  return {
    cueText: nextCue,
    cueSignature: deterministicHash(nextCue),
  };
}

function refineDialogueRealism({
  dialogueText = '',
  scenarioId = '',
  turnNumber = 0,
  activeConcern = '',
  concernFlowOutcome = 'aligned',
  alignmentScore = 3,
  priorDialogueSignature = '',
} = {}) {
  const concern = String(activeConcern || '').toLowerCase();
  const pool = REALISM_UNRESOLVED_CONCERN_LINE[concern]
    || REALISM_UNRESOLVED_CONCERN_LINE.default;
  const seed = `${scenarioId}:${turnNumber}:${concern}:${concernFlowOutcome}:${alignmentScore}`;
  let idx = deterministicIndex(seed, pool.length);
  if (priorDialogueSignature === deterministicHash(pool[idx]) && pool.length > 1) {
    idx = (idx + 1) % pool.length;
  }
  const shouldKeepFriction = concernFlowOutcome === 'missed'
    || concernFlowOutcome === 'overpivot'
    || Number(alignmentScore) <= 2;
  const isOpeningTurn = Number(turnNumber) === 1;
  const base = String(dialogueText || '').trim();
  const baseAlreadyHasPressureMove = (() => {
    const text = base.toLowerCase();
    if (!text) return false;
    const hasPressureShape = /\?/.test(text)
      || /\b(i need|i still need|i can keep going|help me understand|can you|could you|what|how|start with|keep this tied|keep this to|let'?s keep|make this about|give me|show me|focus on)\b/.test(text);
    if (!hasPressureShape) return false;
    const pressureContent = /\b(workflow|operational|practical|team|clinic|staff|step|implement|implementation|burden|feasible|access|prior|auth|coverage|payer|turnaround|friction|evidence|data|trial|endpoint|proof|clinical|patient|patients|screen|screening|selection|candidate|criteria)\b/;
    return pressureContent.test(text);
  })();
  const revised = isOpeningTurn
    ? base
    : shouldKeepFriction && base && !baseAlreadyHasPressureMove
      ? `${base} ${pool[idx]}`
      : base;
  const fallback = isOpeningTurn ? base : pool[idx];
  return {
    dialogueText: revised || fallback,
    dialogueSignature: deterministicHash(revised || fallback),
    tooIdealFlag: Boolean(!isOpeningTurn && shouldKeepFriction && base && !baseAlreadyHasPressureMove && !/still need|before we move|before we continue/i.test(base)),
  };
}

function deriveScenarioBoundHcpState({ scenario = {}, hcpState = 'neutral', turnNumber = 0 } = {}) {
  const openingState = String(
    scenario?.hcpStateModel?.startingState || scenario?.openingState || scenario?.sceneSetup?.openingState || ''
  ).trim().toLowerCase();
  if (Number(turnNumber) !== 1) return normalizeText(hcpState) || 'neutral';
  if (!openingState) return downgradeToAllowedOpeningState(hcpState);
  if (openingState === 'high_pressure') return normalizeText(hcpState || openingState) || 'neutral';
  return downgradeToAllowedOpeningState(openingState);
}

function assertValidOpeningResponse({
  scenario = {},
  turnNumber = 0,
  escalationStage = 'open',
} = {}) {
  if (Number(turnNumber) !== 1) return;
  const openingState = String(
    scenario?.hcpStateModel?.startingState || scenario?.openingState || scenario?.sceneSetup?.openingState || ''
  ).trim().toLowerCase();
  if (openingState === 'high_pressure') return;
  const disallowedStages = new Set(['high_pressure', 'disengaging']);
  if (disallowedStages.has(String(escalationStage || '').toLowerCase())) {
    throw new Error('Invalid first-turn escalation: violates conversation entry contract');
  }
}

export function enforceCueDialogueContractIntegrity({
  cueText = '',
  dialogueText = '',
  hcpState = 'neutral',
  selectedRegister = 'operational_clinical',
  activeConcern = 'workflow',
  rebuildCue,
  rewriteDialogue,
} = {}) {
  let resolvedCue = normalizeText(cueText);
  let resolvedDialogue = normalizeText(dialogueText);
  const repairs = [];

  const cueIntent = classifyCueIntent(resolvedCue);
  const dialogueIntent = classifyDialogueIntent(resolvedDialogue);
  const contradiction = (
    (cueIntent === 'engaged' && (dialogueIntent === 'resistant' || /resistant|disengaged|irritated/.test(hcpState)))
    || (cueIntent === 'resistant' && dialogueIntent === 'engaged')
    || (cueIntent === 'closing' && dialogueIntent === 'engaged')
  );

  if (contradiction && typeof rebuildCue === 'function') {
    const rebuiltCue = normalizeText(rebuildCue({ dialogueText: resolvedDialogue, hcpState, cueText: resolvedCue }));
    if (rebuiltCue && rebuiltCue !== resolvedCue) {
      resolvedCue = rebuiltCue;
      repairs.push('cue_rebuilt_for_dialogue_alignment');
    }
  }

  const registerRequiresPracticality = /workflow_implementation|resource_constraint|patient_selection_practical|operational_clinical/.test(selectedRegister);
  const tooAbstractForRegister = registerRequiresPracticality
    && /\b(conceptual|theoretical|align with (the )?(study|trial)|evidence base)\b/i.test(resolvedDialogue)
    && !/\b(workflow|practice|visit|patients?|step|this week|identify|screen|staff|time)\b/i.test(resolvedDialogue);

  if (tooAbstractForRegister && typeof rewriteDialogue === 'function') {
    const rewritten = normalizeText(rewriteDialogue({ dialogueText: resolvedDialogue, selectedRegister, activeConcern }));
    if (rewritten && rewritten !== resolvedDialogue) {
      resolvedDialogue = rewritten;
      repairs.push('dialogue_rewritten_for_register_alignment');
    }
  }

  return {
    cueText: resolvedCue,
    dialogueText: resolvedDialogue,
    cueIntent: classifyCueIntent(resolvedCue),
    dialogueIntent: classifyDialogueIntent(resolvedDialogue),
    alignmentStatus: repairs.length > 0 ? 'repaired' : 'aligned',
    repairs,
  };
}

export function buildHcpReactionContract({
  scenario = {},
  turnNumber = 0,
  hcpState = 'neutral',
  cueText = '',
  cueMeaning = '',
  dialogueText = '',
  dialogueIntent = '',
  dialogueRegister = 'operational_clinical',
  dialogueBand = '',
  hardDemandState = {},
  activeConcern = 'workflow',
  timePressureState = false,
  coachingResult = {},
  alignment = {},
  scoringContext = {},
  priorEnforcementTrace = {},
  concernFlowOutcome = 'aligned',
  repMessage = '',
} = {}) {
  const scenarioOwnedOpeningTurn = Number(turnNumber) === 1
    ? extractScenarioOwnedOpeningTurn(scenario)
    : null;
  const normalizedCue = normalizeText(scenarioOwnedOpeningTurn?.cueText || cueText);
  const turnScopedHcpState = deriveScenarioBoundHcpState({ scenario, hcpState, turnNumber });
  const normalizedDialogue = normalizeText(scenarioOwnedOpeningTurn?.dialogueText || dialogueText);
  const socialGreetingOpening = Number(turnNumber) === 1 && isGreetingOnlyRepMessage(repMessage);
  const effectiveConcernFlowOutcome = socialGreetingOpening ? 'aligned' : concernFlowOutcome;
  const effectiveAlignment = socialGreetingOpening
    ? {
      ...(alignment || {}),
      score: Math.max(3, Number(alignment?.score ?? 3)),
      misalignments: [],
      rubricAlignmentFlags: Array.isArray(alignment?.rubricAlignmentFlags) ? alignment.rubricAlignmentFlags : [],
    }
    : alignment;
  const selectedCueMeaning = cueMeaning || classifyCueIntent(normalizedCue);
  const selectedDialogueIntent = dialogueIntent || deriveDialogueIntent({
    activeConcern,
    hardDemandState,
    dialogueText: normalizedDialogue,
  });

  const hcpEnforcementProfile = deriveHcpEnforcementProfile({
    scenario,
    hcpProfile: scenario?.hcpProfile || {},
    sceneSetup: scenario?.sceneSetup || {},
    hcpState: turnScopedHcpState,
    cueMeaning: selectedCueMeaning,
    activeConcern,
    hardDemandState,
  });

  const domainAssessment = evaluateScenarioDomainIntegrity({
    scenario,
    repMessage,
    activeConcern,
    cueText: normalizedCue,
    dialogueText: normalizedDialogue,
  });

  let escalationState = deriveEscalationState({
    profile: hcpEnforcementProfile,
    turnNumber,
    hcpState: turnScopedHcpState,
    scenarioOpeningState: scenario?.openingState || scenario?.sceneSetup?.openingState || scenario?.hcpStateModel?.startingState || '',
    priorEscalationStage: priorEnforcementTrace?.escalationStage || 'open',
    priorMisalignmentCount: priorEnforcementTrace?.misalignmentCount || 0,
    priorHardDemandMissCount: priorEnforcementTrace?.hardDemandMissCount || 0,
    alignment: effectiveAlignment,
    concernFlowOutcome: effectiveConcernFlowOutcome,
    repMessage,
    hardDemandState,
    domainAssessment,
    priorDomainDriftCount: priorEnforcementTrace?.domainDriftCount || 0,
  });
  if (socialGreetingOpening) {
    escalationState = {
      ...escalationState,
      escalationStage: 'open',
      escalationReason: 'social_opening_handshake',
      repAdequacyScore: Math.max(Number(escalationState?.repAdequacyScore || 0), 0.85),
      misalignmentCount: 0,
      hardDemandMissCount: Math.max(0, priorEnforcementTrace?.hardDemandMissCount || 0),
    };
  }

  const escalatedPresentation = applyEscalationPresentation({
    cueText: normalizedCue,
    dialogueText: socialGreetingOpening ? '' : normalizedDialogue,
    escalationStage: escalationState.escalationStage,
    profile: hcpEnforcementProfile,
    domainAssessment,
    activeConcern,
    turnNumber,
    scenarioOpeningState: scenario?.openingState || scenario?.sceneSetup?.openingState || scenario?.hcpStateModel?.startingState || '',
    hcpState: turnScopedHcpState,
    scenarioId: scenario?.id || scenario?.scenario_id || scenario?.title || 'unknown_scenario',
  });

  const scenarioId = scenario?.id || scenario?.scenario_id || scenario?.title || 'unknown_scenario';
  const realismDialogue = refineDialogueRealism({
    dialogueText: escalatedPresentation.dialogueText,
    scenarioId,
    turnNumber,
    activeConcern,
    concernFlowOutcome: effectiveConcernFlowOutcome,
    alignmentScore: Number(effectiveAlignment?.score ?? 3),
    priorDialogueSignature: priorEnforcementTrace?.dialogueSignature || '',
  });
  const realismCue = refineCueRealism({
    cueText: escalatedPresentation.cueText,
    scenarioId,
    turnNumber,
    hcpState: turnScopedHcpState,
    activeConcern,
    concernFlowOutcome: effectiveConcernFlowOutcome,
    priorCueSignature: priorEnforcementTrace?.cueSignature || '',
    inputCueMissing: !normalizedCue,
  });

  const enforcedDialogue = enforceDomainReanchorInDialogue({
    dialogueText: realismDialogue.dialogueText,
    domainAssessment,
    activeConcern,
  });

  const coachingTriggerSet = [
    coachingResult?.label,
    coachingResult?.escalationLabel,
    ...(Array.isArray(alignment?.rubricAlignmentFlags) ? alignment.rubricAlignmentFlags : []),
    domainAssessment?.contextContamination ? 'context_contamination_detected' : null,
  ].filter(Boolean);

  const reactionContract = {
    activeScenarioId: scenario?.id || scenario?.scenario_id || scenario?.title || 'unknown_scenario',
    turnNumber,
    activeHcpState: turnScopedHcpState,
    selectedCueId: deterministicHash(normalizedCue),
    selectedCueText: realismCue.cueText,
    selectedCueMeaning,
    selectedDialogueIntent,
    selectedDialogueRegister: dialogueRegister,
    selectedDialogueBand: dialogueBand || `${dialogueRegister}:${String(activeConcern || 'general').toLowerCase()}`,
    selectedDialogueText: enforcedDialogue,
    hardDemandState: {
      activeHardDemand: hardDemandState?.activeHardDemand || null,
      hardDemandType: hardDemandState?.hardDemandType || null,
      hardDemandPriorityLock: Boolean(hardDemandState?.hardDemandPriorityLock),
      hardDemandUnresolved: Boolean(hardDemandState?.hardDemandUnresolved),
    },
    activeConcernSubtype: String(activeConcern || 'workflow').toLowerCase(),
    timePressureState: Boolean(timePressureState),
    coachingTriggerInputs: {
      shouldShow: Boolean(coachingResult?.shouldShow),
      severity: coachingResult?.severity || null,
      triggerSet: coachingTriggerSet,
    },
    enforcementTrace: {
      hcpEnforcementProfile,
      escalationStage: escalationState.escalationStage,
      escalationReason: escalationState.escalationReason,
      toleranceScore: escalationState.toleranceScore,
      repAdequacyScore: escalationState.repAdequacyScore,
      misalignmentCount: escalationState.misalignmentCount,
      hardDemandMissCount: escalationState.hardDemandMissCount,
      domainDriftCount: escalationState.domainDriftCount,
      forgivenessSlack: escalationState.forgivenessSlack,
      tonePressureLevel: escalationState.tonePressureLevel,
      repDomainStatus: domainAssessment.repDomainStatus,
      contextContamination: domainAssessment.contextContamination,
      scenarioDomain: domainAssessment.scenarioDomain,
      matchedDomainSignals: domainAssessment.matchedDomainSignals,
      contaminationReason: domainAssessment.contaminationReason,
      scenarioReanchorRequired: domainAssessment.scenarioReanchorRequired,
      dialogueSignature: realismDialogue.dialogueSignature,
      cueSignature: realismCue.cueSignature,
      tooIdealFlag: realismDialogue.tooIdealFlag,
      openingTurnSource: scenarioOwnedOpeningTurn?.source || null,
    },
    scoringContext: {
      ...scoringContext,
      escalationStage: escalationState.escalationStage,
      tonePressureLevel: escalationState.tonePressureLevel,
      toleranceScore: escalationState.toleranceScore,
      forgivenessSlack: escalationState.forgivenessSlack,
      repDomainStatus: domainAssessment.repDomainStatus,
      contextContamination: domainAssessment.contextContamination,
      scenarioDomain: domainAssessment.scenarioDomain,
      scenarioReanchorRequired: domainAssessment.scenarioReanchorRequired,
      openingTurnSource: scenarioOwnedOpeningTurn?.source || null,
    },
  };

  trackOpeningDialogueVariation({
    scenarioId: reactionContract.activeScenarioId,
    turnNumber,
    repMessage,
    selectedDialogueText: reactionContract.selectedDialogueText,
  });
  assertValidOpeningResponse({
    scenario,
    turnNumber,
    escalationStage: reactionContract?.enforcementTrace?.escalationStage || 'open',
  });

  const scoringContextHash = deterministicHash(stableStringify(scoringContext));
  const reactionContractHash = deterministicHash(stableStringify({
    ...reactionContract,
    scoringContextHash,
  }));

  return {
    ...reactionContract,
    repEvidenceContextHash: scoringContextHash,
    reactionContractHash,
  };
}

export { deterministicHash, stableStringify, classifyCueIntent, classifyDialogueIntent };
