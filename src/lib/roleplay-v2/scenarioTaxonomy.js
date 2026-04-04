import { deriveScenarioMetadataEnvelope } from './scenarioMetadataEnvelope.js';
import { inferJourneyAndPressureFromSignals } from './scenarioControlNormalization.js';

export const CUSTOMER_JOURNEY_STAGES = Object.freeze([
  'initial_access_prospecting',
  'discovery_needs_assessment',
  'clinical_value_detailing',
  'objection_handling',
  'adoption_implementation',
  'commitment_next_step_close',
]);

export const HCP_PERSONAS = Object.freeze([
  'skeptical_specialist',
  'busy_community_prescriber',
  'administrator_economic_buyer',
  'nurse_clinical_user',
  'pathway_formulary_stakeholder',
  'existing_adopter_low_share_prescriber',
]);

export const INTERACTION_PRESSURES = Object.freeze([
  'time_pressured',
  'resistant_skeptical',
  'curious_uncertain',
  'operationally_blocked',
  'competitive_threat',
  'safety_concern',
  'access_prior_auth_barrier',
]);

export const COMPLIANCE_MODES = Object.freeze([
  'on_label_clinical_only',
  'access_discussion',
  'safety_clarification',
  'virtual_hybrid_constraints',
]);

/**
 * Global deterministic taxonomy mapping keyed by scenario id.
 * This avoids brittle keyword-only inference for core browsing filters.
 */
export const SCENARIO_TAXONOMY_OVERRIDES = Object.freeze({
  hiv_im_prep_lowshare: { journeyStage: 'initial_access_prospecting', interactionPressure: 'resistant_skeptical' },
  hiv_np_highshare_access: { journeyStage: 'adoption_implementation', interactionPressure: 'access_prior_auth_barrier' },
  hiv_pa_treat_switch_slowdown: { journeyStage: 'clinical_value_detailing', interactionPressure: 'resistant_skeptical' },
  hiv_np_cab_growth: { journeyStage: 'discovery_needs_assessment', interactionPressure: 'curious_uncertain' },
  onc_md_io_adc_pathways: { journeyStage: 'clinical_value_detailing', interactionPressure: 'competitive_threat' },
  onc_np_pathway_ops: { journeyStage: 'adoption_implementation', interactionPressure: 'operationally_blocked' },
  onc_pa_gu_oral_onc_tminus7: { journeyStage: 'adoption_implementation', interactionPressure: 'operationally_blocked' },
  'onc-kol': { journeyStage: 'initial_access_prospecting', interactionPressure: 'time_pressured' },
  cv_card_md_hf_gdmt_uptake: { journeyStage: 'adoption_implementation', interactionPressure: 'access_prior_auth_barrier' },
  cv_np_ckd_sglt2_calendar: { journeyStage: 'objection_handling', interactionPressure: 'safety_concern' },
  cv_pa_postmi_transitions: { journeyStage: 'adoption_implementation', interactionPressure: 'operationally_blocked' },
  'card-formulary': { journeyStage: 'clinical_value_detailing', interactionPressure: 'competitive_threat' },
  vac_id_adult_flu_playbook: { journeyStage: 'adoption_implementation', interactionPressure: 'operationally_blocked' },
  vac_np_primary_care_capture: { journeyStage: 'discovery_needs_assessment', interactionPressure: 'curious_uncertain' },
  covid_pulm_md_antiviral_ddi_path: { journeyStage: 'objection_handling', interactionPressure: 'safety_concern' },
  covid_pulm_np_postcovid_adherence: { journeyStage: 'adoption_implementation', interactionPressure: 'operationally_blocked' },
  'neuro-access': { journeyStage: 'objection_handling', interactionPressure: 'access_prior_auth_barrier' },
  'immuno-launch': { journeyStage: 'clinical_value_detailing', interactionPressure: 'competitive_threat' },
  'rare-diagnosis': { journeyStage: 'discovery_needs_assessment', interactionPressure: 'curious_uncertain' },
});

export function classifyScenarioTaxonomy(scenario = {}) {
  const text = [
    scenario.title,
    scenario.description,
    scenario.objective,
    scenario.context,
    scenario.openingScene,
    scenario.hcpMood,
    Array.isArray(scenario.challenges) ? scenario.challenges.join(' ') : '',
    scenario.hcp_category,
    scenario.specialty,
    scenario.influence_driver,
  ].join(' ').toLowerCase();
  const globalOverride = SCENARIO_TAXONOMY_OVERRIDES[scenario.id] || {};
  const inferred = inferJourneyAndPressureFromSignals(scenario);

  const hcpPersona = (() => {
    if (/np|nurse|pa-c|pa\b/.test(text)) return 'nurse_clinical_user';
    if (/formulary|p&t|pathway|committee|economic buyer|administrator/.test(text)) return 'pathway_formulary_stakeholder';
    if (/skeptic|skeptical|kol|thought leader|specialist/.test(text)) return 'skeptical_specialist';
    if (/community|busy|time-pressured|between patients/.test(text)) return 'busy_community_prescriber';
    if (/high-performing|strong adoption|existing/.test(text)) return 'existing_adopter_low_share_prescriber';
    return 'busy_community_prescriber';
  })();

  const complianceMode = (() => {
    if (inferred.signals.safetyTone) return 'safety_clarification';
    if (inferred.signals.accessFriction) return 'access_discussion';
    if (/virtual|hybrid|remote/.test(text)) return 'virtual_hybrid_constraints';
    return 'on_label_clinical_only';
  })();

  return {
    journeyStage: globalOverride.journeyStage || inferred.journeyStage,
    hcpPersona,
    interactionPressure: globalOverride.interactionPressure || inferred.interactionPressure,
    difficultyTier: String(scenario.difficulty || 'foundational').toLowerCase(),
    complianceMode,
  };
}

export function enrichScenarioWithTaxonomy(scenario = {}) {
  const taxonomy = classifyScenarioTaxonomy(scenario);
  const metadataEnvelope = deriveScenarioMetadataEnvelope(scenario, taxonomy);
  return {
    ...scenario,
    taxonomy,
    metadataEnvelope,
  };
}
