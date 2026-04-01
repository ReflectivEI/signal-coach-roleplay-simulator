export const SCENARIO_METRIC_TO_RUNTIME_CAPABILITY = Object.freeze({
  question_quality: 'signal_awareness',
  listening_responsiveness: 'signal_interpretation',
  making_it_matter: 'value_connection',
  customer_engagement_signals: 'customer_engagement',
  objection_navigation: 'objection_navigation',
  conversation_control_structure: 'conversation_management',
  commitment_gaining: 'commitment_generation',
  adaptability: 'adaptive_response',
});

export function adaptScenarioMetricIdToRuntimeCapabilityId(metricId = '') {
  return SCENARIO_METRIC_TO_RUNTIME_CAPABILITY[String(metricId || '').trim()] || null;
}

export function validateScenarioMetricIdsMapped(metricIds = []) {
  const ids = Array.isArray(metricIds) ? metricIds : [];
  const unmapped = ids.filter((id) => !adaptScenarioMetricIdToRuntimeCapabilityId(id));
  return {
    valid: unmapped.length === 0,
    unmapped,
  };
}
