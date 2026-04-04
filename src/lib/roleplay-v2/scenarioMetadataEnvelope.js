export const SCENARIO_METADATA_VERSION = '1.0.0';
import {
  CHAPTER_STAGE_BY_JOURNEY_STAGE,
  INTERACTION_SKILL_BY_PRESSURE,
  deriveScenarioFamily,
  inferJourneyAndPressureFromSignals,
  normalizeScenarioText,
} from './scenarioControlNormalization.js';

export const SCENARIO_FAMILIES = Object.freeze([
  'hiv_prep',
  'oncology_io',
  'cardiology_gdmt',
  'vaccines_adult',
  'covid_outpatient',
  'neurology_specialty',
  'immunology_specialty',
  'rare_disease_specialty',
]);

export const CHAPTER_STAGES = Object.freeze([
  'prospecting_initial_call',
  'discovery_needs_assessment',
  'clinical_value_detailing',
  'objection_navigation',
  'adoption_implementation',
  'commitment_close',
]);

export const PERSONA_PRIMARY = Object.freeze([
  'skeptical_specialist',
  'busy_prescriber',
  'administrator_economic_buyer',
  'nurse_clinical_user',
]);

export const INTERACTION_SKILLS = Object.freeze([
  'objection_handling',
  'transition_interruption',
  'virtual_hybrid_meeting',
  'competitive_threat',
  'safety_concern',
  'formulary_procurement',
  'no_time_physician',
  'workflow_implementation',
]);

export const DIFFICULTY_LEVELS = Object.freeze([
  'foundational',
  'intermediate',
  'advanced',
]);

export const COMPLIANCE_MODES_ENVELOPE = Object.freeze([
  'on_label_clinical_only',
  'access_discussion',
  'safety_clarification',
  'virtual_hybrid_constraints',
]);

export const AUTHORITATIVE_METADATA_BY_ID = Object.freeze({
  hiv_im_prep_lowshare: {
    family: 'hiv_prep',
    chapter_stage: 'discovery_needs_assessment',
    persona_primary: 'busy_prescriber',
    interaction_skill: 'no_time_physician',
    compliance_mode: 'access_discussion',
  },
  hiv_np_highshare_access: {
    family: 'hiv_prep',
    chapter_stage: 'adoption_implementation',
    persona_primary: 'nurse_clinical_user',
    interaction_skill: 'formulary_procurement',
    compliance_mode: 'access_discussion',
  },
  hiv_pa_treat_switch_slowdown: {
    family: 'hiv_prep',
    chapter_stage: 'clinical_value_detailing',
    persona_primary: 'nurse_clinical_user',
    interaction_skill: 'objection_handling',
    compliance_mode: 'on_label_clinical_only',
  },
  hiv_np_cab_growth: {
    family: 'hiv_prep',
    chapter_stage: 'discovery_needs_assessment',
    persona_primary: 'nurse_clinical_user',
    interaction_skill: 'objection_handling',
    compliance_mode: 'on_label_clinical_only',
  },
  onc_md_io_adc_pathways: {
    family: 'oncology_io',
    chapter_stage: 'clinical_value_detailing',
    persona_primary: 'skeptical_specialist',
    interaction_skill: 'formulary_procurement',
    compliance_mode: 'on_label_clinical_only',
  },
  onc_np_pathway_ops: {
    family: 'oncology_io',
    chapter_stage: 'adoption_implementation',
    persona_primary: 'nurse_clinical_user',
    interaction_skill: 'workflow_implementation',
    compliance_mode: 'on_label_clinical_only',
  },
  onc_pa_gu_oral_onc_tminus7: {
    family: 'oncology_io',
    chapter_stage: 'adoption_implementation',
    persona_primary: 'nurse_clinical_user',
    interaction_skill: 'workflow_implementation',
    compliance_mode: 'access_discussion',
  },
  'onc-kol': {
    family: 'oncology_io',
    chapter_stage: 'prospecting_initial_call',
    persona_primary: 'skeptical_specialist',
    interaction_skill: 'no_time_physician',
    compliance_mode: 'on_label_clinical_only',
  },
  cv_card_md_hf_gdmt_uptake: {
    family: 'cardiology_gdmt',
    chapter_stage: 'adoption_implementation',
    persona_primary: 'skeptical_specialist',
    interaction_skill: 'workflow_implementation',
    compliance_mode: 'access_discussion',
  },
  cv_np_ckd_sglt2_calendar: {
    family: 'cardiology_gdmt',
    chapter_stage: 'objection_navigation',
    persona_primary: 'nurse_clinical_user',
    interaction_skill: 'safety_concern',
    compliance_mode: 'safety_clarification',
  },
  cv_pa_postmi_transitions: {
    family: 'cardiology_gdmt',
    chapter_stage: 'adoption_implementation',
    persona_primary: 'nurse_clinical_user',
    interaction_skill: 'workflow_implementation',
    compliance_mode: 'on_label_clinical_only',
  },
  'card-formulary': {
    family: 'cardiology_gdmt',
    chapter_stage: 'clinical_value_detailing',
    persona_primary: 'administrator_economic_buyer',
    interaction_skill: 'formulary_procurement',
    compliance_mode: 'access_discussion',
  },
  vac_id_adult_flu_playbook: {
    family: 'vaccines_adult',
    chapter_stage: 'adoption_implementation',
    persona_primary: 'skeptical_specialist',
    interaction_skill: 'workflow_implementation',
    compliance_mode: 'on_label_clinical_only',
  },
  vac_np_primary_care_capture: {
    family: 'vaccines_adult',
    chapter_stage: 'discovery_needs_assessment',
    persona_primary: 'nurse_clinical_user',
    interaction_skill: 'workflow_implementation',
    compliance_mode: 'on_label_clinical_only',
  },
  covid_pulm_md_antiviral_ddi_path: {
    family: 'covid_outpatient',
    chapter_stage: 'objection_navigation',
    persona_primary: 'busy_prescriber',
    interaction_skill: 'safety_concern',
    compliance_mode: 'safety_clarification',
  },
  covid_pulm_np_postcovid_adherence: {
    family: 'covid_outpatient',
    chapter_stage: 'adoption_implementation',
    persona_primary: 'nurse_clinical_user',
    interaction_skill: 'workflow_implementation',
    compliance_mode: 'on_label_clinical_only',
  },
  'neuro-access': {
    family: 'neurology_specialty',
    chapter_stage: 'objection_navigation',
    persona_primary: 'administrator_economic_buyer',
    interaction_skill: 'formulary_procurement',
    compliance_mode: 'access_discussion',
  },
  'immuno-launch': {
    family: 'immunology_specialty',
    chapter_stage: 'clinical_value_detailing',
    persona_primary: 'skeptical_specialist',
    interaction_skill: 'competitive_threat',
    compliance_mode: 'on_label_clinical_only',
  },
  'rare-diagnosis': {
    family: 'rare_disease_specialty',
    chapter_stage: 'discovery_needs_assessment',
    persona_primary: 'skeptical_specialist',
    interaction_skill: 'workflow_implementation',
    compliance_mode: 'on_label_clinical_only',
  },
});

function inferPersona(text = '') {
  if (/np|pa-c|pa\b|nurse|technician/.test(text)) return 'nurse_clinical_user';
  if (/administrator|economic buyer|committee|formulary|p&t|procurement/.test(text)) return 'administrator_economic_buyer';
  if (/skeptic|kol|thought leader|specialist/.test(text)) return 'skeptical_specialist';
  return 'busy_prescriber';
}

function inferInteractionSkill(text = '') {
  if (/safety|toxicity|adverse|risk/.test(text)) return 'safety_concern';
  if (/formulary|p&t|procurement|committee|coverage policy/.test(text)) return 'formulary_procurement';
  if (/competitive|rival|competitor/.test(text)) return 'competitive_threat';
  if (/virtual|hybrid|remote/.test(text)) return 'virtual_hybrid_meeting';
  if (/interrupt|abrupt|transition|handoff/.test(text)) return 'transition_interruption';
  if (/objection|skeptic|resistan|pushback|doubt/.test(text)) return 'objection_handling';
  if (/time|busy|minutes|running late|between patients/.test(text)) return 'no_time_physician';
  return 'workflow_implementation';
}

function inferChapterStage(_text = '', taxonomy = {}, scenario = {}) {
  const stage = taxonomy.journeyStage || inferJourneyAndPressureFromSignals(scenario).journeyStage;
  return CHAPTER_STAGE_BY_JOURNEY_STAGE[stage] || 'prospecting_initial_call';
}

function inferDifficultyLevel(scenario = {}) {
  const value = String(scenario.difficulty || '').toLowerCase();
  if (value === 'advanced') return 'advanced';
  if (value === 'intermediate') return 'intermediate';
  return 'foundational';
}

function inferComplianceMode(text = '', taxonomy = {}) {
  if (taxonomy.complianceMode && COMPLIANCE_MODES_ENVELOPE.includes(taxonomy.complianceMode)) {
    return taxonomy.complianceMode;
  }
  if (/safety|adverse|toxicity/.test(text)) return 'safety_clarification';
  if (/access|prior-auth|coverage|payer|insurance/.test(text)) return 'access_discussion';
  if (/virtual|hybrid|remote/.test(text)) return 'virtual_hybrid_constraints';
  return 'on_label_clinical_only';
}

export function validateScenarioMetadataEnvelope(envelope = {}) {
  const issues = [];
  if (!SCENARIO_FAMILIES.includes(envelope.family)) issues.push('invalid_family');
  if (!CHAPTER_STAGES.includes(envelope.chapter_stage)) issues.push('invalid_chapter_stage');
  if (!PERSONA_PRIMARY.includes(envelope.persona_primary)) issues.push('invalid_persona_primary');
  if (!INTERACTION_SKILLS.includes(envelope.interaction_skill)) issues.push('invalid_interaction_skill');
  if (!DIFFICULTY_LEVELS.includes(envelope.difficulty_level)) issues.push('invalid_difficulty_level');
  if (!COMPLIANCE_MODES_ENVELOPE.includes(envelope.compliance_mode)) issues.push('invalid_compliance_mode');

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function deriveScenarioMetadataEnvelope(scenario = {}, taxonomy = {}) {
  const embedded = scenario.metadataEnvelope;
  if (embedded && typeof embedded === 'object') {
    const embeddedValidation = validateScenarioMetadataEnvelope(embedded);
    if (embeddedValidation.valid) {
      return {
        ...embedded,
        metadata_version: SCENARIO_METADATA_VERSION,
        metadata_source: 'scenario_embedded',
      };
    }
  }

  const byId = AUTHORITATIVE_METADATA_BY_ID[String(scenario.id || '')];
  if (byId) {
    return {
      ...byId,
      difficulty_level: inferDifficultyLevel(scenario),
      metadata_version: SCENARIO_METADATA_VERSION,
      metadata_source: 'authoritative_id_map',
    };
  }

  const text = normalizeScenarioText(scenario);
  const normalizedSignals = inferJourneyAndPressureFromSignals(scenario);
  const normalizedPressure = taxonomy.interactionPressure || normalizedSignals.interactionPressure;
  return {
    family: deriveScenarioFamily(scenario),
    chapter_stage: inferChapterStage(text, taxonomy, scenario),
    persona_primary: inferPersona(text),
    interaction_skill: INTERACTION_SKILL_BY_PRESSURE[normalizedPressure] || inferInteractionSkill(text),
    difficulty_level: inferDifficultyLevel(scenario),
    compliance_mode: inferComplianceMode(text, taxonomy),
    metadata_version: SCENARIO_METADATA_VERSION,
    metadata_source: 'deterministic_inference',
  };
}
