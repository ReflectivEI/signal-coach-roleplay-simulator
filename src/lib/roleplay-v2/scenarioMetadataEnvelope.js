export const SCENARIO_METADATA_VERSION = '1.0.0';

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

const AUTHORITATIVE_METADATA_BY_ID = Object.freeze({
  hiv_im_prep_lowshare: {
    family: 'hiv_prep',
    chapter_stage: 'discovery_needs_assessment',
    persona_primary: 'busy_prescriber',
    interaction_skill: 'no_time_physician',
    compliance_mode: 'access_discussion',
  },
  onc_md_io_adc_pathways: {
    family: 'oncology_io',
    chapter_stage: 'clinical_value_detailing',
    persona_primary: 'skeptical_specialist',
    interaction_skill: 'formulary_procurement',
    compliance_mode: 'on_label_clinical_only',
  },
  cv_card_md_hf_gdmt_uptake: {
    family: 'cardiology_gdmt',
    chapter_stage: 'adoption_implementation',
    persona_primary: 'skeptical_specialist',
    interaction_skill: 'workflow_implementation',
    compliance_mode: 'access_discussion',
  },
});

function normalizeText(scenario = {}) {
  return [
    scenario.title,
    scenario.description,
    scenario.objective,
    scenario.context,
    scenario.openingScene,
    scenario.hcpMood,
    scenario.category,
    scenario.specialty,
    scenario.hcp_category,
    scenario.influence_driver,
  ].join(' ').toLowerCase();
}

function inferFamily(text = '') {
  if (/hiv|prep|cabotegravir|sti/.test(text)) return 'hiv_prep';
  if (/oncology|tumor|kol|adc|io\b|hem\/onc/.test(text)) return 'oncology_io';
  if (/cardio|heart failure|gdmt|post-mi|myocardial/.test(text)) return 'cardiology_gdmt';
  if (/vaccine|immunization|flu/.test(text)) return 'vaccines_adult';
  if (/covid|remdesivir|paxlovid/.test(text)) return 'covid_outpatient';
  if (/neurology/.test(text)) return 'neurology_specialty';
  if (/immunology/.test(text)) return 'immunology_specialty';
  return 'rare_disease_specialty';
}

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

function inferChapterStage(text = '', taxonomy = {}) {
  const stage = taxonomy.journeyStage || '';
  if (stage === 'commitment_next_step_close') return 'commitment_close';
  if (stage === 'adoption_implementation') return 'adoption_implementation';
  if (stage === 'objection_handling') return 'objection_navigation';
  if (stage === 'clinical_value_detailing') return 'clinical_value_detailing';
  if (stage === 'discovery_needs_assessment') return 'discovery_needs_assessment';
  return 'prospecting_initial_call';
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

  const text = normalizeText(scenario);
  return {
    family: inferFamily(text),
    chapter_stage: inferChapterStage(text, taxonomy),
    persona_primary: inferPersona(text),
    interaction_skill: inferInteractionSkill(text),
    difficulty_level: inferDifficultyLevel(scenario),
    compliance_mode: inferComplianceMode(text, taxonomy),
    metadata_version: SCENARIO_METADATA_VERSION,
    metadata_source: 'deterministic_inference',
  };
}
