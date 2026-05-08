export const SCENARIO_SCHEMA_VERSION = '1.0.0';

export enum ScenarioStage {
  INITIAL_ACCESS = 'initial_access',
  DISCOVERY = 'discovery',
  CLINICAL_VALUE_DETAILING = 'clinical_value_detailing',
  OBJECTION_HANDLING = 'objection_handling',
  ADOPTION_IMPLEMENTATION = 'adoption_implementation',
  COMMITMENT_CLOSE = 'commitment_close',
}

export enum ScenarioPersona {
  SKEPTICAL_SPECIALIST = 'skeptical_specialist',
  BUSY_PRESCRIBER = 'busy_prescriber',
  ADMINISTRATOR = 'administrator',
  NURSE_CLINICAL_USER = 'nurse_clinical_user',
  FORMULARY_STAKEHOLDER = 'formulary_stakeholder',
  EXISTING_ADOPTER = 'existing_adopter',
}

export enum PressureType {
  TIME_PRESSURE = 'time_pressure',
  SAFETY_CONCERN = 'safety_concern',
  ACCESS_BARRIER = 'access_barrier',
  OPERATIONAL_BLOCK = 'operational_block',
  COMPETITIVE_THREAT = 'competitive_threat',
  UNCERTAINTY = 'uncertainty',
}

export enum ScenarioDifficulty {
  FOUNDATIONAL = 'foundational',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  ADVERSE_STRESS_TEST = 'adverse_stress_test',
}

export enum ComplianceMode {
  ON_LABEL_ONLY = 'on_label_only',
  SAFETY_CLARIFICATION = 'safety_clarification',
  ACCESS_DISCUSSION = 'access_discussion',
  VIRTUAL_HYBRID_CONSTRAINTS = 'virtual_hybrid_constraints',
}

export enum HcpState {
  NEUTRAL = 'neutral',
  TIME_PRESSED = 'time_pressed',
  SKEPTICAL = 'skeptical',
  ENGAGED = 'engaged',
  IMPATIENT = 'impatient',
  RESISTANT = 'resistant',
  RECEPTIVE = 'receptive',
}

export enum CueType {
  BODY_LANGUAGE = 'body_language',
  VERBAL_SIGNAL = 'verbal_signal',
  CONVERSATIONAL_SIGNAL = 'conversational_signal',
  PACING_SIGNAL = 'pacing_signal',
  RESISTANCE_SIGNAL = 'resistance_signal',
  OPENNESS_SIGNAL = 'openness_signal',
}

export enum MetricId {
  QUESTION_QUALITY = 'question_quality',
  LISTENING_RESPONSIVENESS = 'listening_responsiveness',
  MAKING_IT_MATTER = 'making_it_matter',
  CUSTOMER_ENGAGEMENT_SIGNALS = 'customer_engagement_signals',
  OBJECTION_NAVIGATION = 'objection_navigation',
  CONVERSATION_CONTROL_STRUCTURE = 'conversation_control_structure',
  ADAPTABILITY = 'adaptability',
  COMMITMENT_GAINING = 'commitment_gaining',
}

export enum MetricApplicability {
  ALWAYS = 'always_applicable',
  CONDITIONAL_ON_OBJECTION = 'conditional_on_objection',
  CONDITIONAL_ON_COMMITMENT_ATTEMPT = 'conditional_on_commitment_attempt',
  CONDITIONAL_ON_NEW_INFORMATION = 'conditional_on_new_information',
  NOT_APPLICABLE = 'not_applicable',
}

export enum EvidenceTag {
  ACKNOWLEDGED_TIME_CONSTRAINT = 'acknowledged_time_constraint',
  ASKED_PURPOSEFUL_QUESTION = 'asked_purposeful_question',
  REFLECTED_STATED_CONCERN = 'reflected_stated_concern',
  LINKED_TO_STAKEHOLDER_PRIORITY = 'linked_to_stakeholder_priority',
  RESPONDED_TO_ENGAGEMENT_SHIFT = 'responded_to_engagement_shift',
  STRUCTURED_NEXT_STEP = 'structured_next_step',
  ADAPTED_APPROACH = 'adapted_approach',
  PUSHED_WITHOUT_EVIDENCE = 'pushed_without_evidence',
}

export interface ScenarioIdentity {
  scenarioId: string;
  version: string;
  title: string;
  therapeuticArea: string;
  difficulty: ScenarioDifficulty;
  status: 'draft' | 'active' | 'deprecated';
}

export interface TrainingIntent {
  primaryCapabilityFocus: string[];
  secondaryCapabilityFocus: string[];
  allowedEvaluatedMetrics: MetricId[];
  excludedMetrics: MetricId[];
  passFailNotes?: string;
  metricApplicability: Record<MetricId, MetricApplicability>;
}

export interface ScenarioDomainIntegrityPolicy {
  primaryScenarioDomain?: string;
  allowedDomains?: string[];
  allowedContextFamilies?: string[];
  disallowedCrossDomainFamilies?: string[];
}

export interface EnforcementCriteria {
  baselineForgiveness?: number;
  baselinePrecisionDemand?: number;
  baselineEvidenceStrictness?: number;
  baselineWorkflowStrictness?: number;
  baselineEscalationSensitivity?: number;
  timePressureEscalationModifier?: number;
  engagementSlackModifier?: number;
  skepticismEscalationModifier?: number;
}

export interface HcpProfile {
  role: string;
  specialty: string;
  careSetting: string;
  baselineCommunicationStyle: string;
  baselineOpennessResistance: HcpState;
  knownConstraints: string[];
  enforcementCriteria?: EnforcementCriteria;
  domainIntegrity?: ScenarioDomainIntegrityPolicy;
}

export interface SceneSetup {
  openingEnvironment: string;
  timePressure: 'low' | 'medium' | 'high';
  currentContext: string;
  visitObjective: string;
  repKnowsAtStart: string[];
  repDoesNotKnowAtStart: string[];
  openingLine: string;
  enforcementCriteria?: EnforcementCriteria;
  domainIntegrity?: ScenarioDomainIntegrityPolicy;
}

export interface StateTransition {
  to: HcpState;
  whenAll: EvidenceTag[];
  whenNot?: EvidenceTag[];
}

export interface HcpStateModel {
  startingState: HcpState;
  allowedTransitions: Partial<Record<HcpState, StateTransition[]>>;
  prohibitedTransitions: Array<{ from: HcpState; to: HcpState; reason: string }>;
}

export interface DeterministicCue {
  cueId: string;
  cueType: CueType;
  visibleCue: string;
  meaning: string;
  triggerCondition: string;
  allowedDialoguePatterns: string[];
}

export interface DialogueResponseRules {
  allowedByState: Partial<Record<HcpState, string[]>>;
  prohibitedPatterns: string[];
  escalationRules: string[];
  deEscalationRules: string[];
  repetitionHandling: string;
  contradictionGuardrails: string[];
}

export interface MetricEvidenceDefinition {
  observableEvidenceRequired: EvidenceTag[];
  disqualifyingEvidence: EvidenceTag[];
  minimumThreshold: number;
  examples: string[];
}

export interface FeedbackContract {
  canReference: Array<'explicit_hcp_statement' | 'visible_hcp_cue' | 'rep_language_pattern' | 'missing_expected_behavior'>;
  cannotInfer: Array<'intent' | 'emotion_without_signal' | 'personality'>;
  requiredEvidenceLanguage: string[];
  prohibitedLanguage: string[];
}

export interface ScenarioFixture {
  repResponse: string;
  expectedHcpReaction: string;
  expectedMetricActivation: MetricId[];
  expectedEvidenceTags: EvidenceTag[];
  expectedScoreBand: 'low' | 'medium' | 'high';
}

export interface CanonicalScenario {
  schemaVersion: typeof SCENARIO_SCHEMA_VERSION;
  routing: {
    stage: ScenarioStage;
    persona: ScenarioPersona;
    pressureType: PressureType;
    difficulty: ScenarioDifficulty;
    complianceMode: ComplianceMode;
  };
  identity: ScenarioIdentity;
  trainingIntent: TrainingIntent;
  hcpProfile: HcpProfile;
  sceneSetup: SceneSetup;
  hcpStateModel: HcpStateModel;
  deterministicCueLibrary: DeterministicCue[];
  dialogueResponseRules: DialogueResponseRules;
  metricEvidenceMap: Record<MetricId, MetricEvidenceDefinition>;
  feedbackContract: FeedbackContract;
  enforcementCriteria?: EnforcementCriteria;
  domainIntegrity?: ScenarioDomainIntegrityPolicy;
  testFixtures: {
    strong: [ScenarioFixture, ScenarioFixture, ScenarioFixture];
    weak: [ScenarioFixture, ScenarioFixture, ScenarioFixture];
  };
}
