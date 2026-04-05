const TOP_LEVEL_ORDER = [
  'scenarioIdentity',
  'trainingIntent',
  'hcpProfile',
  'sceneSetup',
  'hcpStateModel',
  'deterministicCueLibrary',
  'dialogueResponseRules',
  'metricEvidenceMap',
  'feedbackContract',
  'testFixtures',
];

export const HCP_STATE_ENUM = Object.freeze([
  'neutral',
  'time_pressed',
  'skeptical',
  'engaged',
  'impatient',
  'resistant',
  'receptive',
]);

export const CUE_TYPE_ENUM = Object.freeze([
  'body_language',
  'verbal_signal',
  'conversational_signal',
  'pacing_signal',
  'resistance_signal',
  'openness_signal',
]);

export const METRIC_APPLICABILITY_ENUM = Object.freeze([
  'always_applicable',
  'conditional_on_objection',
  'conditional_on_commitment_attempt',
  'conditional_on_new_information',
  'not_applicable',
]);

export const EVIDENCE_TAG_ENUM = Object.freeze([
  'acknowledged_time_constraint',
  'asked_purposeful_question',
  'reflected_stated_concern',
  'linked_to_stakeholder_priority',
  'responded_to_engagement_shift',
  'structured_next_step',
  'adapted_approach',
  'pushed_without_evidence',
]);

function validateEnforcementCriteria(criteria = {}, path = 'enforcementCriteria') {
  const issues = [];
  if (!criteria || typeof criteria !== 'object') return issues;
  const ranged = [
    'baselineForgiveness',
    'baselinePrecisionDemand',
    'baselineEvidenceStrictness',
    'baselineWorkflowStrictness',
    'baselineEscalationSensitivity',
  ];
  for (const key of ranged) {
    if (key in criteria) {
      const value = Number(criteria[key]);
      if (!Number.isFinite(value) || value < 0 || value > 1) issues.push(`${path}.${key} must be between 0 and 1`);
    }
  }
  const modifier = ['timePressureEscalationModifier', 'engagementSlackModifier', 'skepticismEscalationModifier'];
  for (const key of modifier) {
    if (key in criteria) {
      const value = Number(criteria[key]);
      if (!Number.isFinite(value) || value < -1 || value > 1) issues.push(`${path}.${key} must be between -1 and 1`);
    }
  }
  return issues;
}


function validateDomainIntegrityPolicy(policy = {}, path = 'domainIntegrity') {
  const issues = [];
  if (!policy || typeof policy !== 'object') return issues;
  const arrayKeys = ['allowedDomains', 'allowedContextFamilies', 'disallowedCrossDomainFamilies'];
  for (const key of arrayKeys) {
    if (key in policy) {
      if (!Array.isArray(policy[key])) {
        issues.push(`${path}.${key} must be an array of strings`);
      } else if (policy[key].some((item) => typeof item !== 'string' || !item.trim())) {
        issues.push(`${path}.${key} must contain non-empty strings`);
      }
    }
  }
  if ('primaryScenarioDomain' in policy && (typeof policy.primaryScenarioDomain !== 'string' || !policy.primaryScenarioDomain.trim())) {
    issues.push(`${path}.primaryScenarioDomain must be a non-empty string`);
  }
  return issues;
}
function keyOrderIssues(obj = {}) {
  const keys = Object.keys(obj);
  const observed = keys.filter((k) => TOP_LEVEL_ORDER.includes(k));
  const expected = TOP_LEVEL_ORDER.filter((k) => k in obj);
  if (observed.join('|') === expected.join('|')) return [];
  return [`top-level sections must follow canonical order: ${TOP_LEVEL_ORDER.join(', ')}`];
}

export function validateCanonicalScenarioSpec(spec = {}) {
  const issues = [];
  if (!spec || typeof spec !== 'object') {
    return { valid: false, issues: ['spec must be an object'] };
  }

  for (const section of TOP_LEVEL_ORDER) {
    if (!(section in spec)) issues.push(`missing section: ${section}`);
  }

  issues.push(...keyOrderIssues(spec));

  const states = spec.hcpStateModel?.states || [];
  for (const state of states) {
    if (!HCP_STATE_ENUM.includes(state)) issues.push(`invalid HCP state enum: ${state}`);
  }

  const cues = spec.deterministicCueLibrary || [];
  for (const cue of cues) {
    if (!CUE_TYPE_ENUM.includes(cue.cueType)) issues.push(`invalid cue type enum: ${cue.cueType}`);
  }

  const applicability = spec.trainingIntent?.metricApplicability || {};
  for (const [metric, status] of Object.entries(applicability)) {
    if (!METRIC_APPLICABILITY_ENUM.includes(status)) {
      issues.push(`invalid metric applicability for ${metric}: ${status}`);
    }
  }

  const evidenceMap = spec.metricEvidenceMap || {};
  issues.push(...validateEnforcementCriteria(spec.enforcementCriteria, 'enforcementCriteria'));
  issues.push(...validateEnforcementCriteria(spec.sceneSetup?.enforcementCriteria, 'sceneSetup.enforcementCriteria'));
  issues.push(...validateEnforcementCriteria(spec.hcpProfile?.enforcementCriteria, 'hcpProfile.enforcementCriteria'));
  issues.push(...validateDomainIntegrityPolicy(spec.domainIntegrity, 'domainIntegrity'));
  issues.push(...validateDomainIntegrityPolicy(spec.sceneSetup?.domainIntegrity, 'sceneSetup.domainIntegrity'));
  issues.push(...validateDomainIntegrityPolicy(spec.hcpProfile?.domainIntegrity, 'hcpProfile.domainIntegrity'));
  for (const [metric, cfg] of Object.entries(evidenceMap)) {
    const required = cfg?.observableEvidenceRequired || [];
    for (const tag of required) {
      if (!EVIDENCE_TAG_ENUM.includes(tag)) issues.push(`invalid evidence tag for ${metric}: ${tag}`);
    }
  }

  return { valid: issues.length === 0, issues };
}

export function createCanonicalScenarioSpec(overrides = {}) {
  return {
    scenarioIdentity: {
      scenarioId: 'adc_io_001',
      title: 'ADC Integration with IO Backbone',
      therapeuticArea: 'Oncology',
      difficulty: 'advanced',
      version: '1.0.0',
      status: 'active',
    },
    trainingIntent: {
      primaryCapabilityFocus: ['signal_awareness', 'listening_responsiveness'],
      secondaryCapabilityFocus: ['making_it_matter', 'adaptability'],
      allowedEvaluatedMetrics: [
        'question_quality',
        'listening_responsiveness',
        'making_it_matter',
        'customer_engagement_signals',
        'conversation_control_structure',
        'objection_navigation',
        'commitment_gaining',
        'adaptability',
      ],
      excludedMetrics: [],
      rubricNotes: 'Rep-side evidence only. No intent/emotion inference.',
      metricApplicability: {
        question_quality: 'always_applicable',
        listening_responsiveness: 'always_applicable',
        making_it_matter: 'always_applicable',
        customer_engagement_signals: 'always_applicable',
        conversation_control_structure: 'always_applicable',
        objection_navigation: 'conditional_on_objection',
        commitment_gaining: 'conditional_on_commitment_attempt',
        adaptability: 'conditional_on_new_information',
      },
    },
    hcpProfile: {
      role: 'Physician',
      specialty: 'Oncology',
      careSetting: 'Solid tumor center',
      baselineCommunicationStyle: 'concise_analytical',
      baselineOpennessResistance: 'skeptical',
      knownConstraints: ['chair_time_pressure', 'p_and_t_scrutiny', 'reimbursement_variability'],
      enforcementCriteria: {
        baselineForgiveness: 0.45,
        baselinePrecisionDemand: 0.72,
        baselineEvidenceStrictness: 0.68,
        baselineWorkflowStrictness: 0.6,
        baselineEscalationSensitivity: 0.62,
      },
      domainIntegrity: {
        allowedContextFamilies: ['operational_workflow', 'evidence_review'],
      },
    },
    sceneSetup: {
      openingEnvironment: 'Clinic hallway between patients',
      timePressure: 'high',
      currentClinicalOperationalContext: 'Operational complexity and pathway fit concerns.',
      visitObjective: 'Clarify barriers without overselling.',
      repKnowsAtStart: ['HCP is evaluating options'],
      repDoesNotKnowAtStart: ['Which barrier is primary today'],
      enforcementCriteria: {
        timePressureEscalationModifier: 0.32,
        engagementSlackModifier: 0.16,
        skepticismEscalationModifier: 0.28,
      },
      domainIntegrity: {
        primaryScenarioDomain: 'oncology',
        allowedDomains: ['oncology', 'operational_workflow'],
        allowedContextFamilies: ['operational_workflow', 'evidence_review'],
        disallowedCrossDomainFamilies: ['hiv', 'cardiology', 'neurology'],
      },
    },
    hcpStateModel: {
      startingState: 'skeptical',
      states: ['skeptical', 'time_pressed', 'engaged', 'impatient'],
      possibleStateTransitions: {
        skeptical: [{ to: 'engaged', trigger: 'acknowledged_time_constraint_and_specific_question' }],
      },
      transitionTriggers: ['acknowledged_time_constraint_and_specific_question', 'generic_claim_ignoring_concern'],
      prohibitedTransitions: [{ from: 'skeptical', to: 'receptive', reason: 'requires intermediate evidence-based shift' }],
    },
    deterministicCueLibrary: [
      {
        visibleCue: 'glances_at_schedule',
        cueType: 'body_language',
        meaningForSimulation: 'time_constraint_salient',
        triggerCondition: 'state == time_pressed',
        allowedDialoguePatterns: ['one-minute framing', 'concise clarification request'],
      },
    ],
    dialogueResponseRules: {
      maySayByState: { skeptical: ['operational concern-first language'] },
      mustNeverSay: ['unbounded efficacy claim without context'],
      escalationRules: ['repeated generic claims -> impatient'],
      deEscalationRules: ['explicit concern acknowledgment + focused question -> engaged'],
      repetitionHandling: ['repeat concern once, then require new rep evidence'],
      contradictionGuardrails: ['cannot claim both no-time and deep-discussion simultaneously'],
    },
    metricEvidenceMap: {
      listening_responsiveness: {
        observableEvidenceRequired: ['reflected_stated_concern'],
        disqualifyingEvidence: ['pushed_without_evidence'],
        minimumThreshold: 1,
        examples: ['rep paraphrases explicit HCP operational concern'],
      },
    },
    enforcementCriteria: {
      baselineForgiveness: 0.5,
      baselinePrecisionDemand: 0.6,
      baselineEvidenceStrictness: 0.55,
      baselineWorkflowStrictness: 0.58,
      baselineEscalationSensitivity: 0.56,
      timePressureEscalationModifier: 0.25,
      engagementSlackModifier: 0.2,
      skepticismEscalationModifier: 0.24,
    },
    domainIntegrity: {
      primaryScenarioDomain: 'oncology',
      allowedDomains: ['oncology', 'operational_workflow'],
      allowedContextFamilies: ['operational_workflow', 'evidence_review', 'patient_selection'],
      disallowedCrossDomainFamilies: ['hiv', 'cardiology', 'neurology'],
    },
    feedbackContract: {
      whatFeedbackCanReference: ['explicit_hcp_statement', 'visible_hcp_cue', 'rep_language_pattern', 'missing_expected_behavior'],
      whatFeedbackCannotInfer: ['inferred_intent', 'inferred_emotion_without_signal', 'personality_labels'],
      requiredEvidenceLanguage: ['cite observed cue or rep utterance pattern'],
      prohibitedLanguage: ['mind-reading claims', 'emotion inference without explicit cue'],
    },
    testFixtures: {
      goldenPathRepResponses: ['Acknowledge time, ask focused operational question, propose specific next step.'],
      poorRepResponses: ['Generic efficacy claim, ignores operational concern, pushes commitment.'],
      expectedHcpReactions: ['engaged_after_acknowledgment'],
      expectedMetricOutputs: ['listening_responsiveness_active'],
    },
    ...overrides,
  };
}
