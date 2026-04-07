const RESPONSE_REGISTERS = Object.freeze([
  'operational_clinical',
  'evidence_interrogation',
  'academic_analytical',
  'workflow_implementation',
  'patient_selection_practical',
  'resource_constraint',
]);

const ACADEMIC_MARKERS = /\b(align with (the )?(study|trial) findings|conceptual|theoretical|methodolog|evidence base|publication|statistical significance|hazard ratio|p-?value|subgroup analysis)\b/i;
const OPERATIONAL_MARKERS = /\b(workflow|clinic flow|in practice|during a visit|this week|this month|patients? (i'?m|i am|we are) seeing|identify|screen|step|staff|time|10-?minute|resource|capacity|burden|prior auth|handoff|implementation)\b/i;
const PATIENT_SELECTION_MARKERS = /\b(which patients?|identify|candidate|selection|screening|who (is|are) appropriate|right patients?)\b/i;
const TIME_PRESSURE_MARKERS = /\b(time pressure|short on time|quick|brief|10-?minute|schedule|running late|between patients|limited time)\b/i;

function stringifyArray(value) {
  if (!Array.isArray(value)) return '';
  return value.filter(Boolean).join(' ');
}

function normalizeContextText(parts = []) {
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function scoreRegister(register, evidence = {}) {
  const {
    roleText,
    specialtyText,
    careSettingText,
    styleText,
    constraintText,
    sceneText,
    cueText,
    utteranceText,
    stateText,
    activeConcern,
  } = evidence;

  let score = 0;

  const isTimePressured = TIME_PRESSURE_MARKERS.test(sceneText) || /\btime-pressured|impatient|disengaging\b/.test(stateText);
  const isOperationallyConstrained = /\b(workflow|operational|implementation|staff|capacity|prior auth|burden|clinic flow|resource)\b/.test(
    `${constraintText} ${sceneText} ${cueText} ${stateText} ${activeConcern}`,
  );
  const patientSelectionActive = PATIENT_SELECTION_MARKERS.test(`${cueText} ${utteranceText} ${sceneText} ${activeConcern}`);
  const explicitEvidenceProbe = /\b(evidence|study|trial|data|endpoint|methodology|publication|proof)\b/.test(
    `${cueText} ${utteranceText} ${activeConcern}`,
  );
  const academicPersona = /\b(academic|research|investigator|professor|id specialist|infectious disease specialist|medical director)\b/.test(
    `${roleText} ${specialtyText} ${careSettingText} ${styleText}`,
  );

  switch (register) {
    case 'resource_constraint':
      if (isTimePressured) score += 4;
      if (isOperationallyConstrained) score += 2;
      if (/\b(urgent|running behind|tight schedule)\b/.test(sceneText)) score += 1;
      break;
    case 'workflow_implementation':
      if (isOperationallyConstrained) score += 4;
      if (/\b(clinic|outpatient|community|private practice|hospital|implementation)\b/.test(careSettingText + sceneText)) score += 2;
      if (/workflow|operational|implementation|process|handoff/.test(activeConcern)) score += 1;
      break;
    case 'patient_selection_practical':
      if (patientSelectionActive) score += 4;
      if (/\b(screen|candidate|selection|triage|panel)\b/.test(`${constraintText} ${sceneText}`)) score += 2;
      if (/screening|selection/.test(activeConcern)) score += 1;
      break;
    case 'operational_clinical':
      if (isOperationallyConstrained) score += 3;
      if (/\b(clinical|patient|care|visit|practice)\b/.test(`${roleText} ${sceneText}`)) score += 2;
      if (!academicPersona) score += 1;
      break;
    case 'evidence_interrogation':
      if (explicitEvidenceProbe) score += 3;
      if (isOperationallyConstrained) score += 1;
      if (/evidence/.test(activeConcern)) score += 2;
      break;
    case 'academic_analytical':
      if (academicPersona) score += 3;
      if (explicitEvidenceProbe) score += 2;
      if (isTimePressured || isOperationallyConstrained) score -= 2;
      break;
    default:
      break;
  }

  return score;
}

export function determinePreferredHcpDialogueRegister({
  scenario = {},
  runtimeState = {},
  cueText = '',
  hcpUtterance = '',
  activeConcern = 'workflow',
} = {}) {
  const canonicalProfile = scenario?.hcpProfile || {};
  const canonicalSceneSetup = scenario?.sceneSetup || {};
  const scenarioDescriptorText = normalizeContextText([
    scenario?.stakeholder,
    scenario?.specialty,
    scenario?.description,
    scenario?.visibleScenarioContext,
    scenario?.hcp,
  ]);

  const evidence = {
    roleText: normalizeContextText([canonicalProfile.role, scenarioDescriptorText]),
    specialtyText: normalizeContextText([canonicalProfile.specialty, scenario?.specialty]),
    careSettingText: normalizeContextText([canonicalProfile.careSetting, scenario?.visibleScenarioContext]),
    styleText: normalizeContextText([canonicalProfile.baselineCommunicationStyle]),
    constraintText: normalizeContextText([
      stringifyArray(canonicalProfile.knownConstraints),
      stringifyArray(scenario?.challenges),
    ]),
    sceneText: normalizeContextText([
      canonicalSceneSetup.timePressure,
      canonicalSceneSetup.currentClinicalOperationalContext,
      scenario?.opening_scene,
      scenario?.openingScene,
      scenario?.description,
      scenario?.visibleScenarioContext,
    ]),
    cueText: normalizeContextText([cueText]),
    utteranceText: normalizeContextText([hcpUtterance]),
    stateText: normalizeContextText([
      runtimeState.activeHcpState,
      runtimeState.startingState,
      runtimeState.hcpStateModelStartingState,
    ]),
    activeConcern: String(activeConcern || '').toLowerCase(),
  };

  const registerScores = RESPONSE_REGISTERS.reduce((acc, register) => {
    acc[register] = scoreRegister(register, evidence);
    return acc;
  }, {});

  const preferredRegister = RESPONSE_REGISTERS
    .slice()
    .sort((a, b) => {
      const scoreDiff = registerScores[b] - registerScores[a];
      if (scoreDiff !== 0) return scoreDiff;
      return RESPONSE_REGISTERS.indexOf(a) - RESPONSE_REGISTERS.indexOf(b);
    })[0];

  return {
    preferredRegister,
    registerScores,
    flags: {
      operationalPressure: /workflow|operational|constraint|clinic flow|capacity|staff|resource/.test(`${evidence.sceneText} ${evidence.constraintText}`),
      patientSelectionFocus: PATIENT_SELECTION_MARKERS.test(`${evidence.cueText} ${evidence.utteranceText}`),
      timePressure: TIME_PRESSURE_MARKERS.test(evidence.sceneText) || /time-pressured|impatient|disengaging/.test(evidence.stateText),
      academicPosture: /academic|research|investigator|professor|id specialist|evidence review/.test(`${evidence.roleText} ${evidence.styleText}`),
    },
  };
}

function templateForRegister(register, concern = 'workflow') {
  const concernToken = String(concern || 'workflow').toLowerCase();

  if (register === 'patient_selection_practical') {
    return 'How would I identify the right patients in my current panel during a standard visit?';
  }

  if (register === 'resource_constraint') {
    return 'Given our time and staffing limits, what is the one step we should do this week in clinic?';
  }

  if (register === 'workflow_implementation') {
    return concernToken === 'time'
      ? 'In a 10-minute visit, what do I do differently first so this fits our workflow?'
      : 'What changes in my workflow this week, and who on my team owns the first step?';
  }

  if (register === 'evidence_interrogation') {
    return 'Which data point should change what I do for patients I am seeing this month?';
  }

  if (register === 'academic_analytical') {
    return 'Which evidence detail should I weigh most heavily for this decision?';
  }

  return 'What does this change in practice for the patients I am actually seeing this week?';
}

function startsWithPoliteLeadIn(text = '') {
  const match = String(text || '').trim().match(/^(i (understand|hear|see)|thanks|thank you|appreciate it)[^.!?]*[.!?]\s*/i);
  return match ? match[0].trim() : '';
}

function evaluateOperationalMismatch({ dialogue = '', preferredRegister = 'operational_clinical', flags = {} } = {}) {
  const text = String(dialogue || '').trim();
  if (!text) {
    return { shouldRewrite: true, reasons: ['empty_dialogue'] };
  }

  const academicTone = ACADEMIC_MARKERS.test(text);
  const operationalTone = OPERATIONAL_MARKERS.test(text);
  const patientSelectionTone = PATIENT_SELECTION_MARKERS.test(text);

  const reasons = [];
  if ((preferredRegister === 'workflow_implementation' || preferredRegister === 'resource_constraint' || preferredRegister === 'operational_clinical') && academicTone && !operationalTone) {
    reasons.push('too_academic_for_operational_context');
  }
  if (preferredRegister === 'patient_selection_practical' && !patientSelectionTone) {
    reasons.push('missing_patient_selection_language');
  }
  if (flags.timePressure && !/\b(this week|today|10-?minute|quick|brief|one step|single step)\b/i.test(text)) {
    reasons.push('missing_time_pressure_actionability');
  }

  return {
    shouldRewrite: reasons.length > 0,
    reasons,
  };
}

export function enforceOperationalRealismPreference({
  dialogue = '',
  preferredRegister = 'operational_clinical',
  activeConcern = 'workflow',
  flags = {},
} = {}) {
  const mismatch = evaluateOperationalMismatch({ dialogue, preferredRegister, flags });
  if (!mismatch.shouldRewrite) {
    return {
      dialogue,
      applied: false,
      reasons: mismatch.reasons,
      preferredRegister,
    };
  }

  const leadIn = startsWithPoliteLeadIn(dialogue);
  const rewrittenCore = templateForRegister(preferredRegister, activeConcern);
  const rewrittenDialogue = [leadIn, rewrittenCore].filter(Boolean).join(' ');

  return {
    dialogue: rewrittenDialogue,
    applied: rewrittenDialogue !== dialogue,
    reasons: mismatch.reasons,
    preferredRegister,
  };
}

export { RESPONSE_REGISTERS };
