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

const BUCKET_MAPPING = {
  foundation: [
    'question_quality',
    'listening_responsiveness',
    'customer_engagement_cues',
  ],
  interaction: [
    'making_it_matter',
    'objection_handling',
    'adaptability',
  ],
  advancement: [
    'conversation_control',
    'commitment_gaining',
  ],
};

function roundHalfUp(value, decimals = 1) {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function assertValidMetricResults(metricResults) {
  if (!Array.isArray(metricResults)) {
    throw new Error('Invalid metricResults for EQ aggregation');
  }

  if (metricResults.length !== 8) {
    throw new Error('Invalid metricResults for EQ aggregation');
  }

  const ids = metricResults.map((m) => m?.id);
  const uniqueIds = new Set(ids);

  if (uniqueIds.size !== 8) {
    throw new Error('Invalid metricResults for EQ aggregation');
  }

  const hasAllCanonical = CANONICAL_METRIC_IDS.every((id) => uniqueIds.has(id));
  if (!hasAllCanonical) {
    throw new Error('Invalid metricResults for EQ aggregation');
  }

  const hasInvalidScore = metricResults.some((metric) => {
    const score = metric?.score;
    if (score === null || score === undefined) return false;
    return typeof score !== 'number' || Number.isNaN(score);
  });

  if (hasInvalidScore) {
    throw new Error('Invalid metricResults for EQ aggregation');
  }
}

function asMetricMap(metricResults) {
  return Object.fromEntries(metricResults.map((m) => [m.id, m]));
}

export function computeSessionStrengths(metricResults, threshold = 4.0) {
  assertValidMetricResults(metricResults);
  return metricResults
    .filter((m) => typeof m.score === 'number' && m.score >= threshold)
    .map((m) => m.id);
}

export function computeSessionGaps(metricResults, threshold = 3.0) {
  assertValidMetricResults(metricResults);
  return metricResults
    .filter((m) => typeof m.score === 'number' && m.score < threshold)
    .map((m) => m.id);
}

export function buildCapabilityBuckets(metricResults) {
  assertValidMetricResults(metricResults);
  const metricMap = asMetricMap(metricResults);

  return {
    foundation: BUCKET_MAPPING.foundation.map((id) => metricMap[id]).filter(Boolean),
    interaction: BUCKET_MAPPING.interaction.map((id) => metricMap[id]).filter(Boolean),
    advancement: BUCKET_MAPPING.advancement.map((id) => metricMap[id]).filter(Boolean),
  };
}

export function summarizeSessionMetrics(metricResults) {
  assertValidMetricResults(metricResults);

  const scored = metricResults.filter((m) => typeof m.score === 'number');
  const averageRaw = scored.length > 0
    ? scored.reduce((sum, m) => sum + m.score, 0) / scored.length
    : null;

  const strongestMetric = scored.length > 0
    ? scored.reduce((best, m) => (best === null || m.score > best.score ? m : best), null)
    : null;

  const weakestMetric = scored.length > 0
    ? scored.reduce((worst, m) => (worst === null || m.score < worst.score ? m : worst), null)
    : null;

  const versions = [...new Set(metricResults.map((m) => m?.metricsVersion).filter(Boolean))];
  const metricsVersion = versions.length === 1 ? versions[0] : (versions[0] || CANONICAL_METRICS_VERSION);

  return {
    metricsVersion,
    overallAverage: averageRaw === null ? null : roundHalfUp(averageRaw, 1),
    strongestMetric: strongestMetric ? strongestMetric.id : null,
    weakestMetric: weakestMetric ? weakestMetric.id : null,
    strengths: computeSessionStrengths(metricResults),
    gaps: computeSessionGaps(metricResults),
  };
}

export function buildTrendSnapshot(sessionHistory) {
  if (!Array.isArray(sessionHistory)) {
    throw new Error('Invalid metricResults for EQ aggregation');
  }

  if (sessionHistory.length === 0) {
    return {
      sessionCount: 0,
      averageOverallScore: null,
      improvingMetrics: [],
      decliningMetrics: [],
      stableMetrics: [],
    };
  }

  const first = sessionHistory[0] || {};
  const last = sessionHistory[sessionHistory.length - 1] || {};

  const improvingMetrics = [];
  const decliningMetrics = [];
  const stableMetrics = [];

  CANONICAL_METRIC_IDS.forEach((id) => {
    const firstVal = first[id];
    const lastVal = last[id];

    if (typeof firstVal !== 'number' || typeof lastVal !== 'number') {
      stableMetrics.push(id);
      return;
    }

    const delta = lastVal - firstVal;
    if (delta >= 0.3) {
      improvingMetrics.push(id);
    } else if (delta <= -0.3) {
      decliningMetrics.push(id);
    } else {
      stableMetrics.push(id);
    }
  });

  const overalls = sessionHistory
    .map((s) => s?.overallAverage)
    .filter((v) => typeof v === 'number');

  const averageOverallScore = overalls.length > 0
    ? roundHalfUp(overalls.reduce((sum, v) => sum + v, 0) / overalls.length, 1)
    : null;

  return {
    sessionCount: sessionHistory.length,
    averageOverallScore,
    improvingMetrics,
    decliningMetrics,
    stableMetrics,
  };
}
