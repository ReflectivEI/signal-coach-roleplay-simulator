import {
  deriveHcpEnforcementProfile,
  deriveEscalationState,
  applyEscalationPresentation,
} from './hcpEnforcementEscalation.js';
import { evaluateScenarioDomainIntegrity, enforceDomainReanchorInDialogue } from './scenarioDomainIntegrity.js';

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
  const normalizedCue = normalizeText(cueText);
  const normalizedDialogue = normalizeText(dialogueText);
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
    hcpState,
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

  const escalationState = deriveEscalationState({
    profile: hcpEnforcementProfile,
    priorEscalationStage: priorEnforcementTrace?.escalationStage || 'open',
    priorMisalignmentCount: priorEnforcementTrace?.misalignmentCount || 0,
    priorHardDemandMissCount: priorEnforcementTrace?.hardDemandMissCount || 0,
    alignment,
    concernFlowOutcome,
    repMessage,
    hardDemandState,
    domainAssessment,
    priorDomainDriftCount: priorEnforcementTrace?.domainDriftCount || 0,
  });

  const escalatedPresentation = applyEscalationPresentation({
    cueText: normalizedCue,
    dialogueText: normalizedDialogue,
    escalationStage: escalationState.escalationStage,
    profile: hcpEnforcementProfile,
    domainAssessment,
    activeConcern,
  });

  const enforcedDialogue = enforceDomainReanchorInDialogue({
    dialogueText: escalatedPresentation.dialogueText,
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
    activeHcpState: hcpState,
    selectedCueId: deterministicHash(normalizedCue),
    selectedCueText: escalatedPresentation.cueText,
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
    },
  };

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
