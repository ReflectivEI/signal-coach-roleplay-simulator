const CANONICAL_METRICS_VERSION = 'SI-v2-locked-2026';

const CANONICAL_METRIC_IDS = [
  'question_quality',
  'listening_responsiveness',
  'making_it_matter',
  'customer_engagement_cues',
  'objection_handling',
  'conversation_control',
  'adaptability',
  'commitment_gaining',
];

const LEGACY_METRIC_IDS = [
  'signal_awareness',
  'signal_interpretation',
  'value_connection',
  'customer_engagement',
  'objection_navigation',
  'conversation_management',
  'adaptive_response',
  'commitment_generation',
];

function toMetricList(metricResults) {
  if (Array.isArray(metricResults)) return metricResults;
  if (metricResults && typeof metricResults === 'object') {
    return Object.entries(metricResults).map(([id, metric]) => ({ id, ...(metric || {}) }));
  }
  return [];
}

export function validateMetricIntegrity(metricResults) {
  const metrics = toMetricList(metricResults);
  const issues = [];

  if (metrics.length !== 8) {
    issues.push({ type: 'metric_count', expected: 8, actual: metrics.length });
  }

  const metricIds = metrics.map((m) => m.id);
  const missingIds = CANONICAL_METRIC_IDS.filter((id) => !metricIds.includes(id));
  if (missingIds.length > 0) {
    issues.push({ type: 'missing_metric_ids', missingIds });
  }

  const extraIds = metricIds.filter((id) => !CANONICAL_METRIC_IDS.includes(id));
  if (extraIds.length > 0) {
    issues.push({ type: 'extra_metric_ids', extraIds });
  }

  metrics.forEach((metric) => {
    const score = metric?.score;
    if (typeof score !== 'number' || score < 1 || score > 5) {
      issues.push({ type: 'score_out_of_range', id: metric?.id, score });
    }

    const components = metric?.components;
    if (!components || typeof components !== 'object' || Array.isArray(components) || Object.keys(components).length === 0) {
      issues.push({ type: 'components_missing', id: metric?.id });
    }
  });

  return {
    isValid: issues.length === 0,
    issues,
    metricIds,
  };
}

export function detectMetricDrift(metricResults) {
  const metrics = toMetricList(metricResults);
  const metricIds = metrics.map((m) => m.id);
  const versions = [...new Set(metrics.map((m) => m?.metricsVersion).filter(Boolean))];
  const legacyIds = metricIds.filter((id) => LEGACY_METRIC_IDS.includes(id));

  const issues = [];

  if (legacyIds.length > 0) {
    issues.push({ type: 'legacy_ids_detected', legacyIds });
  }

  if (versions.length !== 1 || versions[0] !== CANONICAL_METRICS_VERSION) {
    issues.push({ type: 'metrics_version_mismatch', versions, expected: CANONICAL_METRICS_VERSION });
  }

  if (issues.length > 0) {
    console.warn('SCORING_DRIFT_DETECTED', { issues });
  }

  return {
    hasDrift: issues.length > 0,
    issues,
  };
}

export function logScoringExecution({ scenarioId, turnIndex, metricsVersion, metricResults, durationMs }) {
  const metrics = toMetricList(metricResults);
  const compactMetrics = metrics.map((m) => ({ id: m.id, score: m.score }));

  console.info('SCORING_EXECUTION', {
    scenarioId: scenarioId ?? 'unknown',
    turnIndex: typeof turnIndex === 'number' ? turnIndex : null,
    metricsVersion,
    metricIds: compactMetrics.map((m) => m.id),
    scores: compactMetrics,
    durationMs,
  });

  if (typeof durationMs === 'number' && durationMs > 50) {
    console.warn('SCORING_PERFORMANCE_WARNING', durationMs);
  }
}
