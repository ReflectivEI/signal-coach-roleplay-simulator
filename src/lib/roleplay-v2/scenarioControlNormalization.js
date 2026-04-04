export const SIX_DROPDOWN_CONTROLS = Object.freeze([
  'diseaseState',
  'specialty',
  'hcpCategory',
  'influenceDriver',
  'journeyStage',
  'interactionPressure',
]);

export const DROPDOWN_DIMENSIONS = Object.freeze({
  diseaseState: ['All Disease States', 'HIV / PrEP', 'Oncology', 'Cardiology', 'Vaccines', 'COVID-19', 'Neurology', 'Immunology', 'Rare Disease'],
  specialty: ['All Specialties', 'Internal Medicine', 'Infectious Diseases', 'Hem/Onc', 'Medical Oncology', 'Cardiology', 'Family Medicine', 'Neurology', 'Pulmonology'],
  hcpCategory: ['All HCP Types', 'Prescriber / Treater', 'KOL / Thought Leader', 'Non-Prescribing Influencer'],
  influenceDriver: ['All Influence Drivers', 'Patient-Centered', 'Evidence-Based', 'Risk-Averse', 'Guideline-Anchored'],
  journeyStage: ['All Journey Stages', 'initial_access_prospecting', 'discovery_needs_assessment', 'clinical_value_detailing', 'objection_handling', 'adoption_implementation', 'commitment_next_step_close'],
  interactionPressure: ['All Interaction Pressures', 'time_pressured', 'resistant_skeptical', 'curious_uncertain', 'operationally_blocked', 'competitive_threat', 'safety_concern', 'access_prior_auth_barrier'],
});

const FAMILY_BY_CATEGORY = Object.freeze({
  'HIV / PrEP': 'hiv_prep',
  Oncology: 'oncology_io',
  Cardiology: 'cardiology_gdmt',
  Vaccines: 'vaccines_adult',
  'COVID-19': 'covid_outpatient',
  Neurology: 'neurology_specialty',
  Immunology: 'immunology_specialty',
  'Rare Disease': 'rare_disease_specialty',
});

const REALISM_SIGNAL_PATTERNS = Object.freeze({
  timePressure: /\b(time-pressured|time pressure|limited time|between patients|minutes?|rushed|urgent|quick(?:ly)?)\b/i,
  workflowBurden: /\b(workflow|operational|handoff|process|implementation|burden|throughput|clinic flow|onboarding|pathway)\b/i,
  evidenceScrutiny: /\b(evidence|trial|study|published|peer-reviewed|outcome|endpoint|data|os\/pfs|nccn)\b/i,
  accessFriction: /\b(prior[- ]?auth|coverage|payer|reimbursement|benefits|copay|insurance|access barrier)\b/i,
  staffingStrain: /\b(staff(?:ing)?|short-staffed|capacity|resource constraints?|nurse shortage|team bandwidth)\b/i,
  practicalNextStep: /\b(next step|first step|commit|schedule|follow[- ]?up|owner|timeline|this week)\b/i,
  resistantTone: /\b(skeptic|skeptical|resistan|pushback|doubt|unconvinced)\b/i,
  curiousTone: /\b(curious|uncertain|not sure|explor|learn|help me understand)\b/i,
  safetyTone: /\b(safety|toxicity|adverse|risk|ddi|contraindication)\b/i,
  competitiveTone: /\b(competitive|competitor|rival|head[- ]?to[- ]?head)\b/i,
});

export function normalizeScenarioText(scenario = {}) {
  return [
    scenario.title,
    scenario.description,
    scenario.objective,
    scenario.context,
    scenario.openingScene,
    scenario.hcpMood,
    Array.isArray(scenario.challenges) ? scenario.challenges.join(' ') : '',
    scenario.category,
    scenario.specialty,
    scenario.hcp_category,
    scenario.influence_driver,
  ].join(' ').toLowerCase();
}

export function deriveScenarioFamily(scenario = {}) {
  const category = String(scenario.category || '').trim();
  if (FAMILY_BY_CATEGORY[category]) return FAMILY_BY_CATEGORY[category];

  const text = normalizeScenarioText(scenario);
  if (/hiv|prep|cabotegravir|sti/.test(text)) return 'hiv_prep';
  if (/oncology|tumor|adc|io\b|hem\/onc/.test(text)) return 'oncology_io';
  if (/cardio|heart failure|gdmt|post-mi|myocardial/.test(text)) return 'cardiology_gdmt';
  if (/vaccine|immunization|flu/.test(text)) return 'vaccines_adult';
  if (/covid|remdesivir|paxlovid/.test(text)) return 'covid_outpatient';
  if (/neurology/.test(text)) return 'neurology_specialty';
  if (/immunology/.test(text)) return 'immunology_specialty';
  return 'rare_disease_specialty';
}

export function deriveRuntimeRealismSignals(scenario = {}) {
  const text = normalizeScenarioText(scenario);
  return Object.fromEntries(
    Object.entries(REALISM_SIGNAL_PATTERNS).map(([signal, pattern]) => [signal, pattern.test(text)])
  );
}

export function inferJourneyAndPressureFromSignals(scenario = {}) {
  const signals = deriveRuntimeRealismSignals(scenario);

  const journeyStage = (() => {
    if (signals.practicalNextStep) return 'commitment_next_step_close';
    if (signals.workflowBurden || signals.staffingStrain) return 'adoption_implementation';
    if (signals.resistantTone) return 'objection_handling';
    if (signals.evidenceScrutiny) return 'clinical_value_detailing';
    if (signals.curiousTone || signals.accessFriction) return 'discovery_needs_assessment';
    return 'initial_access_prospecting';
  })();

  const interactionPressure = (() => {
    if (signals.accessFriction) return 'access_prior_auth_barrier';
    if (signals.safetyTone) return 'safety_concern';
    if (signals.workflowBurden || signals.staffingStrain) return 'operationally_blocked';
    if (signals.competitiveTone) return 'competitive_threat';
    if (signals.curiousTone) return 'curious_uncertain';
    if (signals.resistantTone) return 'resistant_skeptical';
    if (signals.timePressure) return 'time_pressured';
    return 'time_pressured';
  })();

  return { journeyStage, interactionPressure, signals };
}

function normalizeDropdownValue(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

export function normalizeScenarioDropdownControls(scenario = {}, taxonomy = {}) {
  const inferred = inferJourneyAndPressureFromSignals(scenario);
  return {
    diseaseState: normalizeDropdownValue(scenario.category, DROPDOWN_DIMENSIONS.diseaseState, 'All Disease States'),
    specialty: normalizeDropdownValue(scenario.specialty, DROPDOWN_DIMENSIONS.specialty, 'All Specialties'),
    hcpCategory: normalizeDropdownValue(scenario.hcp_category, DROPDOWN_DIMENSIONS.hcpCategory, 'All HCP Types'),
    influenceDriver: normalizeDropdownValue(scenario.influence_driver, DROPDOWN_DIMENSIONS.influenceDriver, 'All Influence Drivers'),
    journeyStage: normalizeDropdownValue(taxonomy.journeyStage || inferred.journeyStage, DROPDOWN_DIMENSIONS.journeyStage, 'initial_access_prospecting'),
    interactionPressure: normalizeDropdownValue(taxonomy.interactionPressure || inferred.interactionPressure, DROPDOWN_DIMENSIONS.interactionPressure, 'time_pressured'),
    scenarioFamily: deriveScenarioFamily(scenario),
    realismSignals: inferred.signals,
  };
}

export const CHAPTER_STAGE_BY_JOURNEY_STAGE = Object.freeze({
  commitment_next_step_close: 'commitment_close',
  adoption_implementation: 'adoption_implementation',
  objection_handling: 'objection_navigation',
  clinical_value_detailing: 'clinical_value_detailing',
  discovery_needs_assessment: 'discovery_needs_assessment',
  initial_access_prospecting: 'prospecting_initial_call',
});

export const INTERACTION_SKILL_BY_PRESSURE = Object.freeze({
  access_prior_auth_barrier: 'formulary_procurement',
  safety_concern: 'safety_concern',
  operationally_blocked: 'workflow_implementation',
  competitive_threat: 'competitive_threat',
  curious_uncertain: 'objection_handling',
  resistant_skeptical: 'objection_handling',
  time_pressured: 'no_time_physician',
});
