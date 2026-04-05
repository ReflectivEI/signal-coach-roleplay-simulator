function normalize(value = '') {
  return String(value || '').trim().toLowerCase();
}

function uniq(values = []) {
  return [...new Set(values.map((v) => normalize(v)).filter(Boolean))];
}

const GENERIC_CONTEXT_FAMILIES = new Set(['operational_workflow', 'evidence_review', 'patient_selection']);

const DOMAIN_FAMILY_SIGNALS = Object.freeze({
  oncology: ['oncology', 'tumor', 'cancer', 'chemo', 'infusion', 'metastatic', 'radiation'],
  cardiology: ['cardiology', 'cardiac', 'heart failure', 'post-mi', 'arni', 'sglt2'],
  infectious_disease: ['infectious disease', 'viral', 'antiviral', 'id clinic', 'pathogen'],
  hiv: ['hiv', 'prep', 'cabotegravir', 'viral load', 'cd4'],
  pulmonology: ['pulmonary', 'copd', 'ild', 'respiratory'],
  immunology: ['immunology', 'biologic', 'autoimmune', 'ra'],
  neurology: ['neurology', 'ms', 'relapse', 'neuro'],
  vaccines: ['vaccine', 'vaccination', 'immunization', 'flu clinic', 'vis'],
  diabetes: ['diabetes', 'a1c', 'glycemic', 'insulin'],
  operational_workflow: ['workflow', 'staffing', 'throughput', 'clinic flow', 'implementation', 'visit cadence'],
  evidence_review: ['evidence', 'trial', 'endpoint', 'subgroup', 'study', 'data quality'],
  patient_selection: ['patient selection', 'candidate', 'eligibility', 'screening', 'triage'],
});

function inferDomainFamily(text = '') {
  const haystack = normalize(text);
  const matched = [];
  for (const [family, signals] of Object.entries(DOMAIN_FAMILY_SIGNALS)) {
    if (signals.some((signal) => haystack.includes(signal))) matched.push(family);
  }
  return matched;
}

function inferScenarioDomainPolicy({ scenario = {}, activeConcern = '' } = {}) {
  const explicitPolicy = scenario?.domainIntegrity || {};
  const inferredPrimary = normalize(explicitPolicy.primaryScenarioDomain)
    || inferDomainFamily([
      scenario?.primaryScenarioDomain,
      scenario?.category,
      scenario?.specialty,
      scenario?.therapeuticArea,
      scenario?.context,
      scenario?.objective,
      scenario?.openingScene,
      activeConcern,
    ].filter(Boolean).join(' '))[0]
    || 'general_clinical';

  const inferredAllowed = uniq([
    inferredPrimary,
    ...(explicitPolicy.allowedDomains || []),
    ...inferDomainFamily(`${scenario?.context || ''} ${scenario?.openingScene || ''} ${scenario?.objective || ''}`),
    ...(String(activeConcern || '').toLowerCase().includes('workflow') ? ['operational_workflow'] : []),
    ...(String(activeConcern || '').toLowerCase().includes('evidence') ? ['evidence_review'] : []),
    ...(String(activeConcern || '').toLowerCase().includes('selection') ? ['patient_selection'] : []),
  ]);

  const inferredAllowedFamilies = uniq([
    ...(explicitPolicy.allowedContextFamilies || []),
    'operational_workflow',
    'evidence_review',
    'patient_selection',
  ]);

  const explicitDisallowed = uniq(explicitPolicy.disallowedCrossDomainFamilies || []);
  const inferredDisallowed = explicitDisallowed.length > 0
    ? explicitDisallowed
    : Object.keys(DOMAIN_FAMILY_SIGNALS)
      .filter((family) => !inferredAllowed.includes(family) && !inferredAllowedFamilies.includes(family));

  return {
    scenarioDomain: inferredPrimary,
    primaryScenarioDomain: inferredPrimary,
    allowedDomains: inferredAllowed,
    allowedContextFamilies: inferredAllowedFamilies,
    disallowedCrossDomainFamilies: inferredDisallowed,
  };
}

function classifyFromSignals({
  repMessage = '',
  policy,
  activeConcern = '',
  cueText = '',
  dialogueText = '',
} = {}) {
  const messageSignals = inferDomainFamily(repMessage);
  const contextSignals = inferDomainFamily(`${activeConcern} ${cueText} ${dialogueText}`);

  const matchedAllowedSignals = messageSignals.filter((signal) => (
    policy.allowedDomains.includes(signal)
    || policy.allowedContextFamilies.includes(signal)
    || signal === policy.primaryScenarioDomain
  ));

  const matchedDisallowedSignals = messageSignals.filter((signal) => policy.disallowedCrossDomainFamilies.includes(signal));

  const allowedTherapeuticSignals = matchedAllowedSignals.filter((signal) => !GENERIC_CONTEXT_FAMILIES.has(signal));
  const hasPrimarySignal = messageSignals.includes(policy.primaryScenarioDomain);

  const strongCrossDomain = matchedDisallowedSignals.length > 0
    && !hasPrimarySignal
    && allowedTherapeuticSignals.length === 0
    && messageSignals.length > 0;

  const hasRecoverableAdjacency = matchedAllowedSignals.length > 0
    && !policy.allowedDomains.includes(matchedAllowedSignals[0]);

  const hasScenarioDomain = hasPrimarySignal
    || allowedTherapeuticSignals.some((signal) => policy.allowedDomains.includes(signal));

  if (strongCrossDomain) {
    return {
      repDomainStatus: 'cross_domain_contamination',
      contextContamination: true,
      scenarioReanchorRequired: true,
      matchedDomainSignals: messageSignals,
      contaminationReason: `rep_mentions_disallowed_domain:${matchedDisallowedSignals.join('|')}`,
      matchedAllowedSignals,
      matchedDisallowedSignals,
      contextSignals,
    };
  }

  if (hasRecoverableAdjacency || (messageSignals.length === 0 && contextSignals.length > 0)) {
    return {
      repDomainStatus: 'adjacent_but_recoverable',
      contextContamination: false,
      scenarioReanchorRequired: false,
      matchedDomainSignals: messageSignals,
      contaminationReason: hasRecoverableAdjacency ? 'adjacent_domain_family_detected' : 'domain_not_explicit_but_context_consistent',
      matchedAllowedSignals,
      matchedDisallowedSignals,
      contextSignals,
    };
  }

  return {
    repDomainStatus: hasScenarioDomain ? 'in_domain' : 'adjacent_but_recoverable',
    contextContamination: false,
    scenarioReanchorRequired: false,
    matchedDomainSignals: messageSignals,
    contaminationReason: hasScenarioDomain ? 'in_domain_signals_present' : 'no_explicit_domain_mismatch',
    matchedAllowedSignals,
    matchedDisallowedSignals,
    contextSignals,
  };
}

export function evaluateScenarioDomainIntegrity({
  scenario = {},
  repMessage = '',
  activeConcern = '',
  cueText = '',
  dialogueText = '',
} = {}) {
  const policy = inferScenarioDomainPolicy({ scenario, activeConcern });
  const classification = classifyFromSignals({ repMessage, policy, activeConcern, cueText, dialogueText });
  return {
    ...policy,
    ...classification,
  };
}

export function buildRequiredDomainReanchorStatement({ domainAssessment = {}, activeConcern = '' } = {}) {
  if (!(domainAssessment?.contextContamination && domainAssessment?.repDomainStatus === 'cross_domain_contamination')) return '';
  const scenarioDomain = String(domainAssessment?.scenarioDomain || 'the current scenario').replace(/_/g, ' ');
  const concernLabel = String(activeConcern || 'the active concern').replace(/_/g, ' ');
  const repDomain = Array.isArray(domainAssessment?.matchedDisallowedSignals) && domainAssessment.matchedDisallowedSignals.length > 0
    ? String(domainAssessment.matchedDisallowedSignals[0]).replace(/_/g, ' ')
    : 'an unrelated domain';
  return `That is not the context I am asking about. Let's stay focused on ${scenarioDomain}. I am asking about ${concernLabel}, not ${repDomain}.`;
}

export function enforceDomainReanchorInDialogue({ dialogueText = '', domainAssessment = {}, activeConcern = '' } = {}) {
  const required = buildRequiredDomainReanchorStatement({ domainAssessment, activeConcern });
  if (!required) return String(dialogueText || '').trim();
  const normalized = String(dialogueText || '').trim();
  if (!normalized) return required;
  const hasReanchor = /not the context i am asking about|let'?s stay focused on|i am asking about/i.test(normalized);
  if (hasReanchor) return normalized;
  return `${required} ${normalized}`.trim();
}
