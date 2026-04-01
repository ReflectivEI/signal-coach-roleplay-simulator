export const SCENARIO_TO_RUNTIME_METRIC_ID_MAP = Object.freeze({
  question_quality: 'signal_awareness',
  listening_responsiveness: 'signal_interpretation',
  making_it_matter: 'value_connection',
  customer_engagement_signals: 'customer_engagement',
  objection_navigation: 'objection_navigation',
  conversation_control_structure: 'conversation_management',
  adaptability: 'adaptive_response',
  commitment_gaining: 'commitment_generation',
});

export const RUNTIME_METRIC_IDS = Object.freeze([
  'signal_awareness',
  'signal_interpretation',
  'adaptive_response',
  'objection_navigation',
  'value_connection',
  'commitment_generation',
  'customer_engagement',
  'conversation_management',
]);

export function findUnmappedScenarioMetricKeys(scenarioMetricKeys = []) {
  return [...new Set((scenarioMetricKeys || []).filter((key) => !SCENARIO_TO_RUNTIME_METRIC_ID_MAP[key]))];
}

export function findUnmappedRuntimeMetricIds() {
  const mappedRuntimeIds = new Set(Object.values(SCENARIO_TO_RUNTIME_METRIC_ID_MAP));
  return RUNTIME_METRIC_IDS.filter((id) => !mappedRuntimeIds.has(id));
}
