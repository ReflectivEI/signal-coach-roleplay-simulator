const DISPLAY_METRIC_LABELS = {
  signalAwareness: "Signal Awareness",
  signalInterpretation: "Signal Interpretation",
  adaptability: "Adaptive Response",
  objectionHandling: "Objection Navigation",
  valueCommunication: "Value Connection",
  commitmentGeneration: "Commitment Generation",
  emotionalAttunement: "Customer Engagement Monitoring",
  conversationControl: "Conversation Management",
  avgEngagement: "Average Learning Engagement Score",
  avgPerformance: "Average Sales Outcome Score",
  territoryVolatility: "Territory Volatility",
  mostCommonCapabilityGap: "Primary Capability Gap",
  avgBehavioralMetrics: "Average of 8 Behavioral Metrics",
  strongestCapability: "Strongest Capability",
  improvementPriority: "Improvement Priority",
  engagementScore: "Learning Engagement Score",
  readinessScore: "Readiness",
  coachingResponsivenessScore: "Coaching Responsiveness",
  engagementStabilityScore: "Engagement Stability",
  conversionProxyScore: "Conversion Proxy",
  territoryPressureScore: "Territory Pressure",
  salesRiskScore: "Sales Risk",
  dataConfidenceIndex: "Data Confidence",
  confidenceScore: "Predictive Confidence",
  predictiveConfidence: "Predictive Confidence",
  behavioralVariance: "Behavioral Variance",
  observationDepth: "Observation Depth",
  sessionsCompleted30d: "Sessions (30 Days)",
  coachingModulesCompleted: "Modules Completed",
  practiceStreakDays: "Practice Streak",
  salesPerformance: "Sales Outcome Score",
  salesTrend: "Sales Trend",
  riskLevel: "Risk Level",
  atRiskRepCount: "At-Risk Rep Count",
  lowPerformerConcentration: "Low Performer Concentration",
  highPerformerConcentration: "High Performer Concentration",
  aggregationWeights: "Territory Contribution Weights",
  coachingOpportunityClusters: "Coaching Opportunity Clusters",
  repIds: "Included Reps",
  moduleCompletion: "Module Completion",
  adoptionHealth: "Adoption Health",
  avgTeamScore: "Team Average Score",
  needsAttention: "Needs Attention",
  interventionQueue: "Intervention Queue",
  territoryAverage: "Average Sales Outcome Score",
};

const METRIC_ALIAS_PATTERNS = [
  [/(?<![A-Za-z])avgEngagement(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.avgEngagement],
  [/(?<![A-Za-z])avgPerformance(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.avgPerformance],
  [/(?<![A-Za-z])territoryVolatility(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.territoryVolatility],
  [/(?<![A-Za-z])mostCommonCapabilityGap(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.mostCommonCapabilityGap],
  [/(?<![A-Za-z])engagementStabilityScore(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.engagementStabilityScore],
  [/(?<![A-Za-z])coachingResponsivenessScore(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.coachingResponsivenessScore],
  [/(?<![A-Za-z])engagementScore(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.engagementScore],
  [/(?<![A-Za-z])readinessScore(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.readinessScore],
  [/(?<![A-Za-z])conversionProxyScore(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.conversionProxyScore],
  [/(?<![A-Za-z])territoryPressureScore(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.territoryPressureScore],
  [/(?<![A-Za-z])salesRiskScore(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.salesRiskScore],
  [/(?<![A-Za-z])dataConfidenceIndex(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.dataConfidenceIndex],
  [/(?<![A-Za-z])confidenceScore(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.confidenceScore],
  [/(?<![A-Za-z])predictiveConfidence(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.predictiveConfidence],
  [/(?<![A-Za-z])behavioralVariance(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.behavioralVariance],
  [/(?<![A-Za-z])sessionsCompleted30d(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.sessionsCompleted30d],
  [/(?<![A-Za-z])coachingModulesCompleted(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.coachingModulesCompleted],
  [/(?<![A-Za-z])practiceStreakDays(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.practiceStreakDays],
  [/(?<![A-Za-z])salesPerformance(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.salesPerformance],
  [/(?<![A-Za-z])salesTrend(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.salesTrend],
  [/(?<![A-Za-z])commitmentGeneration(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.commitmentGeneration],
  [/(?<![A-Za-z])signalAwareness(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.signalAwareness],
  [/(?<![A-Za-z])signalInterpretation(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.signalInterpretation],
  [/(?<![A-Za-z])valueCommunication(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.valueCommunication],
  [/(?<![A-Za-z])emotionalAttunement(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.emotionalAttunement],
  [/(?<![A-Za-z])conversationControl(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.conversationControl],
  [/(?<![A-Za-z])objectionHandling(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.objectionHandling],
  [/(?<![A-Za-z])adaptability(?![A-Za-z])/g, DISPLAY_METRIC_LABELS.adaptability],
];

const INTERNAL_METRIC_PATTERN = /(^|[^A-Za-z])(avg[A-Z][a-zA-Z]+|[a-z]+(?:[A-Z][a-z0-9]+)+(?:Score|Index)?)(?=$|[^A-Za-z])/g;
const CAMEL_CASE_TOKEN = /^[a-z]+(?:[A-Z][a-z0-9]+)+(?:Score|Index)?$/;
const PASCAL_CASE_TOKEN = /^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+(?:Score|Index)?$/;

function titleCaseToken(token) {
  return token
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bAvg\b/g, "Average")
    .replace(/\bRep Ids\b/g, "Rep IDs")
    .replace(/\bAi\b/g, "AI");
}

function stripTechnicalSuffix(label) {
  return label
    .replace(/\s+Score$/i, "")
    .replace(/\s+Index$/i, "")
    .trim();
}

function isInternalMetricToken(token) {
  return Boolean(DISPLAY_METRIC_LABELS[token] || CAMEL_CASE_TOKEN.test(token) || PASCAL_CASE_TOKEN.test(token));
}

export function formatMetricLabel(metricKey) {
  if (typeof metricKey !== "string") {
    return "Metric unavailable";
  }

  const trimmed = metricKey.trim();
  if (!trimmed) {
    return "Metric unavailable";
  }

  if (DISPLAY_METRIC_LABELS[trimmed]) {
    return DISPLAY_METRIC_LABELS[trimmed];
  }

  if (!isInternalMetricToken(trimmed) && !/[ _-]/.test(trimmed)) {
    return trimmed;
  }

  const formatted = stripTechnicalSuffix(titleCaseToken(trimmed));
  return formatted && !CAMEL_CASE_TOKEN.test(formatted) ? formatted : "Metric unavailable";
}

export function hasInternalMetricTokens(value) {
  return typeof value === "string" && INTERNAL_METRIC_PATTERN.test(value);
}

export function normalizeManagerText(value) {
  if (typeof value !== "string") {
    return "";
  }

  let normalized = value;
  for (const patternPair of METRIC_ALIAS_PATTERNS) {
    const pattern = /** @type {RegExp} */ (patternPair[0]);
    const label = /** @type {string} */ (patternPair[1]);
    normalized = normalized.replace(pattern, label);
  }

  normalized = normalized.replace(INTERNAL_METRIC_PATTERN, (match, prefix, token) => {
    if (!token || !isInternalMetricToken(token)) {
      return match;
    }

    const label = formatMetricLabel(token);
    return `${prefix ?? ""}${label === "Metric unavailable" ? label : label}`;
  });

  return normalized;
}

export function normalizeManagerValue(value) {
  if (typeof value === "string") {
    return normalizeManagerText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeManagerValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [formatMetricLabel(key), normalizeManagerValue(item)]),
    );
  }

  return value;
}

export function normalizeExplanation(explanation) {
  if (!explanation) {
    return explanation;
  }

  return {
    ...explanation,
    label: normalizeManagerText(explanation.label),
    definition: normalizeManagerText(explanation.definition),
    formula: normalizeManagerText(explanation.formula),
    notes: normalizeManagerText(explanation.notes),
    dataSource: normalizeManagerText(explanation.dataSource),
    timeWindow: normalizeManagerText(explanation.timeWindow),
    thresholds: Array.isArray(explanation.thresholds) ? explanation.thresholds.map((item) => normalizeManagerText(item)) : explanation.thresholds,
    output: typeof explanation.output === "string" ? normalizeManagerText(explanation.output) : explanation.output,
    inputs: explanation.inputs ? normalizeManagerValue(explanation.inputs) : explanation.inputs,
  };
}

export function normalizeManagerInsightsResponse(payload) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  return {
    ...payload,
    summary: normalizeManagerText(payload.summary),
    keyDrivers: Array.isArray(payload.keyDrivers) ? payload.keyDrivers.map((item) => normalizeManagerText(item)) : payload.keyDrivers,
    risks: Array.isArray(payload.risks) ? payload.risks.map((item) => normalizeManagerText(item)) : payload.risks,
    recommendations: Array.isArray(payload.recommendations)
      ? payload.recommendations.map((item) => ({
          ...item,
          action: normalizeManagerText(item.action),
          rationale: normalizeManagerText(item.rationale),
          expectedImpact: normalizeManagerText(item.expectedImpact),
        }))
      : payload.recommendations,
    predictiveOutlook: payload.predictiveOutlook
      ? {
          ...payload.predictiveOutlook,
          reasoning: normalizeManagerText(payload.predictiveOutlook.reasoning),
        }
      : payload.predictiveOutlook,
  };
}
