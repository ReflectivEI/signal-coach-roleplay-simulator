// @ts-check
import { z } from "zod";
import {
  BEHAVIORAL_METRIC_KEYS,
  MANAGER_MODEL_THRESHOLDS,
  buildCanonicalBehavioralMetrics,
  buildCanonicalTerritoryMetrics,
  evaluateRepRiskFlags,
  evaluateTerritoryRiskFlags,
  getBehavioralMetricLabel,
} from "./managerPerformanceData.js";

const HIGH_RISK_THRESHOLD = MANAGER_MODEL_THRESHOLDS.salesRiskHigh;
const IMPROVEMENT_THRESHOLD = 34;
const BEHAVIORAL_KEY_SET = new Set(BEHAVIORAL_METRIC_KEYS);
export const PREDICTIVE_CONFIDENCE_LABEL = "Prediction reliability (not a performance score)";
const behavioralMetricKeyEnum = z.enum([
  "signalAwareness",
  "signalInterpretation",
  "adaptability",
  "objectionHandling",
  "valueCommunication",
  "commitmentGeneration",
  "emotionalAttunement",
  "conversationControl",
]);

const GENERIC_PHRASES = [
  "improve communication",
  "focus on performance",
  "continue training",
  "keep it up",
  "general coaching",
];

/**
 * Shared feature flag for Manager AI Insights.
 */
export const ENABLE_MANAGER_INSIGHTS = true;

const behavioralMetricProfileSchema = z.object({
  score: z.number().min(0).max(5),
  trend: z.enum(["up", "down", "flat"]),
  sessionsObserved: z.number().int().min(0).max(200),
});

const behavioralMetricsSchema = z.object({
  signalAwareness: behavioralMetricProfileSchema,
  signalInterpretation: behavioralMetricProfileSchema,
  adaptability: behavioralMetricProfileSchema,
  objectionHandling: behavioralMetricProfileSchema,
  valueCommunication: behavioralMetricProfileSchema,
  commitmentGeneration: behavioralMetricProfileSchema,
  emotionalAttunement: behavioralMetricProfileSchema,
  conversationControl: behavioralMetricProfileSchema,
});

const repDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  specialty: z.string().min(1),
  territory: z.string().min(1),
  status: z.enum(["active", "needs_attention", "inactive"]),
  sessionsCompleted30d: z.number().int().min(0).max(1000),
  coachingModulesCompleted: z.number().int().min(0).max(1000),
  practiceStreakDays: z.number().int().min(0).max(365),
  salesPerformance: z.number().min(0).max(5),
  salesTrend: z.enum(["up", "down", "flat"]),
  behavioralMetrics: behavioralMetricsSchema,
  strongestCapability: behavioralMetricKeyEnum,
  improvementPriority: behavioralMetricKeyEnum,
  overallScore: z.number().min(0).max(5),
  recentCoachingActivity: z.object({
    coachingSessions30d: z.number().int().min(0).max(100),
    managerReviews30d: z.number().int().min(0).max(100),
    lastCoachingDate: z.string().min(1),
  }),
  scenarioMix: z.record(z.number().min(0).max(100)),
  trainingTypeMix: z.record(z.number().min(0).max(100)),
  lastPracticeDate: z.string().min(1),
  engagementConsistency: z.number().min(0).max(100),
  observationDepth: z.number().min(0).max(1000),
  territoryContext: z.object({
    marketTrend: z.enum(["up", "down", "flat"]),
    accessComplexity: z.number().min(0).max(5),
    payerPressure: z.number().min(0).max(5),
    accountComplexity: z.number().min(0).max(5),
  }),
  evidence: z.record(z.unknown()).optional(),
});

const territoryDataSchema = z.object({
  territory: z.string().min(1),
  avgPerformance: z.number().min(0).max(5),
  avgEngagement: z.number().min(0).max(100),
  trend: z.enum(["up", "down", "flat"]),
  riskLevel: z.enum(["low", "moderate", "high"]),
  avgBehavioralMetrics: z.object({
    signalAwareness: z.number().min(0).max(5),
    signalInterpretation: z.number().min(0).max(5),
    adaptability: z.number().min(0).max(5),
    objectionHandling: z.number().min(0).max(5),
    valueCommunication: z.number().min(0).max(5),
    commitmentGeneration: z.number().min(0).max(5),
    emotionalAttunement: z.number().min(0).max(5),
    conversationControl: z.number().min(0).max(5),
  }),
  mostCommonCapabilityGap: behavioralMetricKeyEnum.nullable(),
  topPerformingBehaviorPattern: z.array(behavioralMetricKeyEnum).max(8),
  territoryVolatility: z.number().min(0).max(5),
  atRiskRepCount: z.number().int().min(0).max(1000),
  lowPerformerConcentration: z.number().min(0).max(1),
  highPerformerConcentration: z.number().min(0).max(1),
  coachingOpportunityClusters: z.array(z.string().min(1)).max(8),
  repIds: z.array(z.string().min(1)).max(1000),
  aggregationWeights: z.record(z.number().min(0).max(1)),
});

const repDerivedMetricsSchema = z.object({
  strongestCapability: behavioralMetricKeyEnum,
  improvementPriority: behavioralMetricKeyEnum,
  behavioralVariance: z.number().min(0).max(5),
  engagementScore: z.number().min(0).max(100),
  readinessScore: z.number().min(0).max(100),
  coachingResponsivenessScore: z.number().min(0).max(100).optional(),
  engagementStabilityScore: z.number().min(0).max(100),
  conversionProxyScore: z.number().min(0).max(100),
  territoryPressureScore: z.number().min(0).max(100),
  salesRiskScore: z.number().min(0).max(100),
  dataConfidenceIndex: z.number().min(0).max(1),
  confidenceScore: z.number().min(0).max(1),
  predictiveConfidence: z.number().min(0).max(1).optional(),
});

export const managerInsightsRequestSchema = z.object({
  repId: z.string().min(1).optional(),
  territoryId: z.string().min(1).optional(),
  repData: repDataSchema.optional(),
  territoryData: territoryDataSchema,
  derivedMetrics: repDerivedMetricsSchema.optional(),
  timeframe: z.enum(["30d", "60d", "90d"]),
});

export const managerInsightsResponseSchema = z.object({
  summary: z.string().min(1),
  keyDrivers: z.array(z.string().min(1)).min(1),
  risks: z.array(z.string()),
  recommendations: z.array(z.object({
    action: z.string().min(1),
    rationale: z.string().min(1),
    expectedImpact: z.string().min(1),
  })).min(1),
  predictiveOutlook: z.object({
    performanceTrend: z.enum(["likely_improve", "at_risk", "stable"]),
    confidence: z.number().min(0).max(1),
    reasoning: z.string().min(1),
  }),
});

/**
 * @typedef {z.infer<typeof managerInsightsRequestSchema>} ManagerInsightsRequest
 * @typedef {z.infer<typeof managerInsightsResponseSchema>} ManagerInsightsResponse
 */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** @param {Record<string, number>} metrics */
function getBestMetricKeys(metrics) {
  return Object.entries(metrics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key);
}

/**
 * @param {ManagerInsightsRequest} payload
 */
export function deriveManagerInsightsFeatures(payload) {
  const rep = /** @type {import("./managerInsightsTypes").RepData | undefined} */ (payload.repData);
  const territory = /** @type {import("./managerInsightsTypes").TerritoryData} */ (payload.territoryData);
  const derived = /** @type {import("./managerInsightsTypes").RepDerivedMetrics | undefined} */ (payload.derivedMetrics);
  const territoryMetricRanking = getBestMetricKeys(territory.avgBehavioralMetrics);
  const repRiskFlags = rep && derived ? evaluateRepRiskFlags(/** @type {any} */ (rep), /** @type {any} */ (derived)).filter((flag) => flag.triggered) : [];
  const territoryRiskFlags = evaluateTerritoryRiskFlags(territory);
  const canonicalRepMetrics = rep ? buildCanonicalBehavioralMetrics(/** @type {any} */ (rep)) : [];
  const canonicalTerritoryMetrics = buildCanonicalTerritoryMetrics(territory);

  const keyMetric = rep
    ? rep.behavioralMetrics[rep.improvementPriority]
    : payload.territoryData.mostCommonCapabilityGap
      ? { score: territory.avgBehavioralMetrics[payload.territoryData.mostCommonCapabilityGap], trend: territory.trend, sessionsObserved: 0 }
      : null;

  const signalCoverage = rep
    ? round(BEHAVIORAL_METRIC_KEYS.filter((key) => rep.behavioralMetrics[key].sessionsObserved > 0).length / BEHAVIORAL_METRIC_KEYS.length, 2)
    : 1;

  const territoryWeightSpread = Object.values(territory.aggregationWeights || {});
  const territoryWeightVariance = territoryWeightSpread.length
    ? round(Math.max(...territoryWeightSpread) - Math.min(...territoryWeightSpread), 2)
    : 0;

  const territoryDataConfidence = round(
    clamp(
      0.26
      + (Math.min(territory.repIds.length, 8) / 8 * 0.18)
      + (territory.avgEngagement / 100 * 0.18)
      + ((1 - Math.min(territory.territoryVolatility / 1.2, 1)) * 0.18)
      + ((1 - Math.min(territoryWeightVariance / 0.35, 1)) * 0.1)
      + ((territory.atRiskRepCount === 0 ? 0.1 : territory.atRiskRepCount === 1 ? 0.06 : 0.02)),
      0.4,
      0.92,
    ),
    2,
  );

  const confidence = rep
    ? derived?.predictiveConfidence ?? derived?.confidenceScore ?? derived?.dataConfidenceIndex ?? 0.65
    : territoryDataConfidence;

  const riskIndex = rep
    ? derived?.salesRiskScore ?? 50
    : round(
      clamp(
        (territory.riskLevel === "high" ? 70 : territory.riskLevel === "moderate" ? 52 : 28)
        + (territory.atRiskRepCount * 4)
        + (territory.territoryVolatility * 10)
        + (territory.avgEngagement < MANAGER_MODEL_THRESHOLDS.engagementRisk ? 8 : 0),
        0,
        100,
      ),
      1,
    );

  const engagementScore = rep ? derived?.engagementScore ?? 0 : territory.avgEngagement;
  const thresholdFlags = rep
    ? repRiskFlags.map((flag) => flag.explanation)
    : territoryRiskFlags.map((flag) => flag.explanation);

  return {
    subjectName: rep?.name ?? `${territory.territory} territory`,
    strongestCapability: rep?.strongestCapability ?? territory.topPerformingBehaviorPattern[0] ?? null,
    improvementPriority: rep?.improvementPriority ?? territory.mostCommonCapabilityGap,
    engagementScore,
    readinessScore: rep ? derived?.readinessScore ?? 0 : round((territory.avgPerformance * 20 * 0.7) + (territory.avgEngagement * 0.3), 1),
    territoryTrend: territory.trend,
    performanceTrend: rep?.salesTrend ?? territory.trend,
    riskIndex,
    confidence,
    signalCoverage,
    keyMetric,
    topBehaviorPattern: territoryMetricRanking,
    thresholdFlags,
    territoryDataConfidence,
    territoryWeightVariance,
    repRiskFlags,
    territoryRiskFlags,
    canonicalRepMetrics,
    canonicalTerritoryMetrics,
    predictiveConfidence: confidence,
    dataConfidence: rep ? derived?.dataConfidenceIndex ?? territoryDataConfidence : territoryDataConfidence,
  };
}

/**
 * @param {ManagerInsightsRequest} payload
 * @param {ReturnType<typeof deriveManagerInsightsFeatures>} derived
 * @returns {ManagerInsightsResponse}
 */
export function createFallbackManagerInsights(payload, derived) {
  const rep = payload.repData;
  const territory = payload.territoryData;
  const weakestCapability = derived.improvementPriority;
  const strongestCapability = derived.strongestCapability;
  const weakestCapabilityLabel = weakestCapability ? getBehavioralMetricLabel(weakestCapability) : null;
  const strongestCapabilityLabel = strongestCapability ? getBehavioralMetricLabel(strongestCapability) : null;
  const weakestMetricScore = weakestCapability && rep ? rep.behavioralMetrics[weakestCapability].score : null;
  const strongestMetricScore = strongestCapability && rep ? rep.behavioralMetrics[strongestCapability].score : null;

  /** @type {"likely_improve" | "at_risk" | "stable"} */
  const performanceTrend = derived.riskIndex >= HIGH_RISK_THRESHOLD
    ? "at_risk"
    : derived.riskIndex <= IMPROVEMENT_THRESHOLD && derived.performanceTrend === "up"
      ? "likely_improve"
      : "stable";

  const subject = rep ? rep.name : `${territory.territory} territory`;
  const formatScalePercent = (score) => `${score}/5 (${Math.round((score / 5) * 1000) / 10}% of 5-point scale)`;
  const predictiveConfidencePercent = Math.round(derived.confidence * 100);

  const summary = rep
    ? `${subject} is evaluated on the canonical Signal Intelligence metrics. Strongest capability is ${strongestCapabilityLabel} and the capability requiring improvement is ${weakestCapabilityLabel}, with deterministic threshold flags ${derived.thresholdFlags.join("; ") || "none"} in ${territory.territory}.`
    : `${subject} is computed from weighted rep aggregates and shows a ${territory.riskLevel} coaching risk profile, with threshold flags ${derived.thresholdFlags.join("; ") || "none"}.`;

  const keyDrivers = rep
    ? [
      `${rep.name} completed ${rep.sessionsCompleted30d} sessions, ${rep.coachingModulesCompleted} coaching modules, and has a learning engagement score of ${derived.engagementScore}/100 against the ${MANAGER_MODEL_THRESHOLDS.engagementRisk}/100 monitoring threshold.`,
      `${rep.name}'s strongest capability is ${strongestCapabilityLabel} at ${strongestMetricScore}/5, while ${weakestCapabilityLabel} is ${weakestMetricScore}/5 against the ${MANAGER_MODEL_THRESHOLDS.repMetricLow}/5 threshold.`,
      `${rep.name}'s sales outcome score is ${formatScalePercent(rep.salesPerformance)} with a ${rep.salesTrend} trend, sales risk ${payload.derivedMetrics?.salesRiskScore ?? derived.riskIndex}/100, and ${territory.territory} average sales outcome score ${formatScalePercent(territory.avgPerformance)}.`,
    ]
    : [
      `${territory.territory} averages ${formatScalePercent(territory.avgPerformance)} on sales outcome score and ${territory.avgEngagement}/100 on learning engagement across ${territory.repIds.length} weighted reps.`,
      `The primary capability gap is ${territory.mostCommonCapabilityGap ? getBehavioralMetricLabel(territory.mostCommonCapabilityGap) : "none"}, and the top capability pattern is ${territory.topPerformingBehaviorPattern.map(getBehavioralMetricLabel).join(", ") || "none"}.`,
      `${territory.atRiskRepCount} reps are at risk, territory volatility is ${territory.territoryVolatility} against the ${MANAGER_MODEL_THRESHOLDS.volatilityModerate} watch threshold, and low performer concentration is ${Math.round(territory.lowPerformerConcentration * 100)}%.`,
    ];

  const risks = rep
    ? [
      `${rep.name} carries sales risk ${payload.derivedMetrics?.salesRiskScore ?? derived.riskIndex}/100; this is ${(payload.derivedMetrics?.salesRiskScore ?? derived.riskIndex) >= MANAGER_MODEL_THRESHOLDS.salesRiskHigh ? "at or above" : "below"} the ${MANAGER_MODEL_THRESHOLDS.salesRiskHigh}/100 high-risk threshold and is most sensitive to ${weakestCapabilityLabel}.`,
      `${rep.name}'s territory pressure is ${payload.derivedMetrics?.territoryPressureScore ?? 0}/100 and data confidence is ${Math.round((payload.derivedMetrics?.dataConfidenceIndex ?? 0) * 100)}%, indicating ${rep.territoryContext.payerPressure >= 4 ? "payer-heavy pressure" : "moderate territory pressure"} in ${territory.territory}.`,
    ]
    : [
      `${territory.territory} risk is tied to ${territory.mostCommonCapabilityGap ? getBehavioralMetricLabel(territory.mostCommonCapabilityGap) : "mixed capability gaps"}, ${territory.atRiskRepCount} at-risk reps, and a ${territory.trend} territory trend with data confidence ${Math.round(derived.territoryDataConfidence * 100)}%.`,
      `${territory.territory} has ${Math.round(territory.lowPerformerConcentration * 100)}% low performer concentration against ${Math.round(territory.highPerformerConcentration * 100)}% high performer concentration and weight variance ${derived.territoryWeightVariance}.`,
    ];

  const recommendations = rep
    ? [
      {
        action: `Run 2 targeted coaching sessions this week focused on ${weakestCapabilityLabel} because ${rep.name} is at ${weakestMetricScore}/5 versus the ${MANAGER_MODEL_THRESHOLDS.repMetricLow}/5 threshold.`,
        rationale: `${rep.name}'s lowest behavioral metric is ${weakestCapabilityLabel} at ${weakestMetricScore}/5, learning engagement score is ${derived.engagementScore}/100, and sales risk is ${payload.derivedMetrics?.salesRiskScore ?? derived.riskIndex}/100 in ${territory.territory}.`,
        expectedImpact: `Improving ${weakestCapabilityLabel} above ${MANAGER_MODEL_THRESHOLDS.repMetricLow}/5 should lift the conversion proxy and reduce risk in ${territory.territory}.`,
      },
      {
        action: `Use ${strongestCapabilityLabel} as the anchor behavior in the next manager review and inspect two recent sessions for transfer into ${weakestCapabilityLabel}.`,
        rationale: `${rep.name}'s strongest capability is ${strongestCapabilityLabel} at ${strongestMetricScore}/5, which is the best observed bridge into ${weakestCapabilityLabel} without inventing new signals.`,
        expectedImpact: `This should improve coaching responsiveness and engagement stability while keeping the intervention tied to the observed 8-metric profile.`,
      },
    ]
    : [
      {
        action: `Launch a territory coaching sprint on ${territory.mostCommonCapabilityGap ? getBehavioralMetricLabel(territory.mostCommonCapabilityGap) : "capability consistency"} for the next 14 days across ${territory.territory}.`,
        rationale: `${territory.territory} shows a weighted gap in ${territory.mostCommonCapabilityGap ? getBehavioralMetricLabel(territory.mostCommonCapabilityGap) : "behavioral consistency"}, with ${territory.atRiskRepCount} at-risk reps, average learning engagement ${territory.avgEngagement}/100, and ${territory.coachingOpportunityClusters[0] ?? "multiple cross-rep coaching opportunities"}.`,
        expectedImpact: `A territory-level intervention should reduce weighted volatility and move the territory above the monitored thresholds.`,
      },
      {
        action: `Review the highest-volatility reps in ${territory.territory} and rebalance scenario mix toward payer and access-heavy simulations where applicable.`,
        rationale: `${territory.territory}'s territory volatility is ${territory.territoryVolatility} versus the ${MANAGER_MODEL_THRESHOLDS.volatilityModerate} watch threshold, and the contributor view shows which reps drive the movement.`,
        expectedImpact: `This should improve consistency across the territory rather than treating territory coaching as rep data multiplied.`,
      },
    ];

  return {
    summary,
    keyDrivers,
    risks,
    recommendations,
    predictiveOutlook: {
      performanceTrend,
      confidence: derived.confidence,
      reasoning: rep
        ? `${PREDICTIVE_CONFIDENCE_LABEL}: ${predictiveConfidencePercent}/100. Sales Outcome Score is ${formatScalePercent(rep.salesPerformance)} on the 5-point scale, while prediction reliability is derived from Data Confidence ${Math.round((payload.derivedMetrics?.dataConfidenceIndex ?? 0) * 100)}/100, Behavioral Variance ${payload.derivedMetrics?.behavioralVariance}, Engagement Stability ${payload.derivedMetrics?.engagementStabilityScore}/100, and ${formatTrendLabel(rep.salesTrend)} sales directionality.`
        : `${PREDICTIVE_CONFIDENCE_LABEL}: ${predictiveConfidencePercent}/100. Territory Sales Outcome Score is ${formatScalePercent(territory.avgPerformance)} on the 5-point scale, while prediction reliability is derived from weighted rep coverage, Territory Volatility ${territory.territoryVolatility}, Learning Engagement Score ${territory.avgEngagement}/100, and contribution-weight variance ${derived.territoryWeightVariance} in ${territory.territory}.`,
    },
  };
}

function sanitizeText(text, fallback) {
  if (typeof text !== "string") return fallback;
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed || fallback;
}

function sanitizeBulletList(items, fallbackItems) {
  const sanitized = Array.isArray(items)
    ? items
      .map((item) => sanitizeText(item, ""))
      .filter(Boolean)
      .filter((item) => !GENERIC_PHRASES.some((phrase) => item.toLowerCase().includes(phrase)))
    : [];

  return sanitized.length ? sanitized.slice(0, 4) : fallbackItems;
}

function containsInvalidCapabilityReference(text) {
  const normalized = text.toLowerCase();
  if (GENERIC_PHRASES.some((phrase) => normalized.includes(phrase))) {
    return true;
  }

  const forbiddenAliases = [
    "signalawareness",
    "signalinterpretation",
    "adaptability",
    "objectionhandling",
    "valuecommunication",
    "commitmentgeneration",
    "emotionalattunement",
    "conversationcontrol",
    "adaptability",
    "objection handling",
    "value communication",
    "emotional attunement",
    "conversation control",
  ];

  return forbiddenAliases.some((alias) => normalized.includes(alias));
}

function containsInvalidThresholdMath(text) {
  const matches = text.matchAll(/(\d+(?:\.\d+)?)\s*\/?\d*\s*(?:is\s*)?(below|under|above|over|at or above|at least)\s+(?:the\s+)?(\d+(?:\.\d+)?)/gi);
  for (const match of matches) {
    const current = Number(match[1]);
    const operator = match[2].toLowerCase();
    const threshold = Number(match[3]);
    if ((operator === "below" || operator === "under") && !(current < threshold)) return true;
    if ((operator === "above" || operator === "over" || operator === "at or above" || operator === "at least") && !(current >= threshold)) return true;
  }
  return false;
}

/**
 * @param {ManagerInsightsResponse} candidate
 * @param {ManagerInsightsResponse} fallback
 */
function validateAlignedInsight(candidate, fallback) {
  const textBlocks = [
    candidate.summary,
    ...candidate.keyDrivers,
    ...candidate.risks,
    ...candidate.recommendations.flatMap((item) => [item.action, item.rationale, item.expectedImpact]),
    candidate.predictiveOutlook.reasoning,
  ];

  if (textBlocks.some((text) => containsInvalidCapabilityReference(text))) {
    return fallback;
  }

  if (textBlocks.some((text) => containsInvalidThresholdMath(text))) {
    return fallback;
  }

  return candidate;
}

/**
 * @param {unknown} candidate
 * @param {ManagerInsightsResponse} fallback
 * @returns {ManagerInsightsResponse}
 */
export function normalizeManagerInsightsResponse(candidate, fallback) {
  const base = typeof candidate === "object" && candidate !== null ? /** @type {Record<string, unknown>} */ (candidate) : {};

  const predictiveOutlook = base.predictiveOutlook && typeof base.predictiveOutlook === "object"
    ? /** @type {Record<string, unknown>} */ (base.predictiveOutlook)
    : null;

  const normalized = {
    summary: sanitizeText(base.summary, fallback.summary),
    keyDrivers: sanitizeBulletList(base.keyDrivers, fallback.keyDrivers),
    risks: sanitizeBulletList(base.risks, fallback.risks),
    recommendations: Array.isArray(base.recommendations)
      ? base.recommendations
        .map((item) => {
          const recommendation = typeof item === "object" && item !== null ? /** @type {Record<string, unknown>} */ (item) : {};
          return {
            action: sanitizeText(recommendation.action, ""),
            rationale: sanitizeText(recommendation.rationale, ""),
            expectedImpact: sanitizeText(recommendation.expectedImpact, ""),
          };
        })
        .filter((item) => item.action && item.rationale && item.expectedImpact)
        .slice(0, 3)
      : fallback.recommendations,
    predictiveOutlook: {
      performanceTrend: predictiveOutlook && typeof predictiveOutlook.performanceTrend === "string"
        ? /** @type {"likely_improve" | "at_risk" | "stable"} */ (predictiveOutlook.performanceTrend)
        : fallback.predictiveOutlook.performanceTrend,
      confidence: predictiveOutlook && typeof predictiveOutlook.confidence === "number"
        ? clamp(predictiveOutlook.confidence, 0, 1)
        : fallback.predictiveOutlook.confidence,
      reasoning: predictiveOutlook
        ? sanitizeText(predictiveOutlook.reasoning, fallback.predictiveOutlook.reasoning)
        : fallback.predictiveOutlook.reasoning,
    },
  };

  const parsed = managerInsightsResponseSchema.safeParse(normalized);
  if (!parsed.success) {
    return fallback;
  }

  return validateAlignedInsight(parsed.data, fallback);
}

export function buildManagerExplainabilityNote(payload) {
  if (!payload.repData) {
    return `Data Source: Rep + Territory Metrics • Territory gap ${payload.territoryData.mostCommonCapabilityGap ? getBehavioralMetricLabel(payload.territoryData.mostCommonCapabilityGap) : "none"}`;
  }

  const weakest = payload.repData.improvementPriority;
  const strongest = payload.repData.strongestCapability;
  return `Data Source: Rep + Territory Metrics • ${payload.repData.name}: ${getBehavioralMetricLabel(strongest)} ${payload.repData.behavioralMetrics[strongest].score}/5 • ${getBehavioralMetricLabel(weakest)} ${payload.repData.behavioralMetrics[weakest].score}/5`;
}

export function getBehavioralMetricKeySet() {
  return BEHAVIORAL_KEY_SET;
}

export function formatBehavioralMetricReference(metricKey, score) {
  return `${metricKey} (${getBehavioralMetricLabel(metricKey)}): ${round(score, 1)}/5`;
}

function trimSentence(text, fallback) {
  const sanitized = sanitizeText(text, fallback);
  return /[.!?]$/.test(sanitized) ? sanitized : `${sanitized}.`;
}

function formatTrendLabel(trend) {
  return trend === "up" ? "up" : trend === "down" ? "down" : "flat";
}

function formatFivePointComparison(score, threshold) {
  const delta = round(score - threshold, 1);
  const comparator = delta >= 0 ? `${delta}/5 above` : `${Math.abs(delta)}/5 below`;
  return `${score}/5 (${comparator} the ${threshold}/5 threshold)`;
}

function formatHundredPointComparison(score, threshold) {
  const delta = round(score - threshold, 1);
  const comparator = delta >= 0 ? `${delta}/100 above` : `${Math.abs(delta)}/100 below`;
  return `${score}/100 (${comparator} the ${threshold}/100 threshold)`;
}

function pickUrgentRepMetric(rep, derived) {
  const weakestScore = rep.behavioralMetrics[rep.improvementPriority].score;
  const weakestLabel = getBehavioralMetricLabel(rep.improvementPriority);

  return [
    {
      label: weakestLabel,
      severity: Math.max(0, MANAGER_MODEL_THRESHOLDS.repMetricLow - weakestScore),
      summary: `${weakestLabel} is ${formatFivePointComparison(weakestScore, MANAGER_MODEL_THRESHOLDS.repMetricLow)} on the 5-point scale with ${formatTrendLabel(rep.behavioralMetrics[rep.improvementPriority].trend)} directionality`,
    },
    {
      label: "Sales Risk",
      severity: Math.max(0, (derived.salesRiskScore - MANAGER_MODEL_THRESHOLDS.salesRiskHigh) / 20),
      summary: `Sales Risk is ${formatHundredPointComparison(derived.salesRiskScore, MANAGER_MODEL_THRESHOLDS.salesRiskHigh)} on the 100-point scale with ${formatTrendLabel(rep.salesTrend)} sales directionality`,
    },
    {
      label: "Learning Engagement Score",
      severity: Math.max(0, (MANAGER_MODEL_THRESHOLDS.engagementRisk - derived.engagementScore) / 20),
      summary: `Learning Engagement Score is ${formatHundredPointComparison(derived.engagementScore, MANAGER_MODEL_THRESHOLDS.engagementRisk)} on the 100-point scale with ${rep.sessionsCompleted30d} sessions completed in the last 30 days`,
    },
  ].sort((a, b) => b.severity - a.severity)[0];
}

function pickUrgentTerritoryMetric(territory) {
  const gapKey = territory.mostCommonCapabilityGap ?? BEHAVIORAL_METRIC_KEYS[0];
  const gapScore = territory.avgBehavioralMetrics[gapKey];
  const gapLabel = getBehavioralMetricLabel(gapKey);

  return [
    {
      label: gapLabel,
      severity: Math.max(0, MANAGER_MODEL_THRESHOLDS.repMetricLow - gapScore),
      summary: `${gapLabel} is ${formatFivePointComparison(gapScore, MANAGER_MODEL_THRESHOLDS.repMetricLow)} on the 5-point scale with ${formatTrendLabel(territory.trend)} territory directionality`,
    },
    {
      label: "Learning Engagement Score",
      severity: Math.max(0, (MANAGER_MODEL_THRESHOLDS.territoryEngagementRisk - territory.avgEngagement) / 20),
      summary: `Learning Engagement Score is ${formatHundredPointComparison(territory.avgEngagement, MANAGER_MODEL_THRESHOLDS.territoryEngagementRisk)} on the 100-point scale across the weighted territory`,
    },
    {
      label: "Territory Volatility",
      severity: Math.max(0, territory.territoryVolatility - MANAGER_MODEL_THRESHOLDS.volatilityModerate),
      summary: `Territory Volatility is ${territory.territoryVolatility}, which is ${territory.territoryVolatility >= MANAGER_MODEL_THRESHOLDS.volatilityModerate ? "above" : "below"} the ${MANAGER_MODEL_THRESHOLDS.volatilityModerate} watch threshold`,
    },
  ].sort((a, b) => b.severity - a.severity)[0];
}

export function buildBehavioralProfileContext(payload) {
  if (payload.repData) {
    const rep = payload.repData;
    return {
      title: "Behavioral Profile (8 Metrics)",
      subtitle: `${rep.name}'s canonical Signal Intelligence profile in the required 8-capability order.`,
      metricSource: rep.behavioralMetrics,
      strongestKey: rep.strongestCapability,
      weakestKey: rep.improvementPriority,
    };
  }

  const territoryMetrics = payload.territoryData.avgBehavioralMetrics;
  const strongestKey = BEHAVIORAL_METRIC_KEYS.reduce((best, key) => territoryMetrics[key] > territoryMetrics[best] ? key : best, BEHAVIORAL_METRIC_KEYS[0]);
  const weakestKey = BEHAVIORAL_METRIC_KEYS.reduce((worst, key) => territoryMetrics[key] < territoryMetrics[worst] ? key : worst, BEHAVIORAL_METRIC_KEYS[0]);

  return {
    title: "Behavioral Profile (8 Metrics)",
    subtitle: `${payload.territoryData.territory} territory averages aligned to the same canonical 8-capability order.`,
    metricSource: territoryMetrics,
    strongestKey,
    weakestKey,
  };
}

export function buildStructuredInsightView(payload) {
  const profileContext = buildBehavioralProfileContext(payload);

  if (payload.repData && payload.derivedMetrics) {
    const rep = payload.repData;
    const derived = payload.derivedMetrics;
    const strongestLabel = getBehavioralMetricLabel(rep.strongestCapability);
    const weakestLabel = getBehavioralMetricLabel(rep.improvementPriority);
    const strongestScore = rep.behavioralMetrics[rep.strongestCapability].score;
    const weakestScore = rep.behavioralMetrics[rep.improvementPriority].score;
    const strongestTrend = formatTrendLabel(rep.behavioralMetrics[rep.strongestCapability].trend);
    const weakestTrend = formatTrendLabel(rep.behavioralMetrics[rep.improvementPriority].trend);
    const nextWeakest = BEHAVIORAL_METRIC_KEYS
      .filter((key) => key !== rep.improvementPriority)
      .sort((a, b) => rep.behavioralMetrics[a].score - rep.behavioralMetrics[b].score)[0];
    const nextWeakestLabel = getBehavioralMetricLabel(nextWeakest);
    const nextWeakestScore = rep.behavioralMetrics[nextWeakest].score;
    const urgentMetric = pickUrgentRepMetric(rep, derived);

    return {
      profileContext,
      primaryFinding: trimSentence(
        `Most urgent metric: ${urgentMetric.label}. ${rep.name} shows ${strongestLabel} at ${strongestScore}/5 on the 5-point scale with ${strongestTrend} directionality, but ${weakestLabel} is ${formatFivePointComparison(weakestScore, MANAGER_MODEL_THRESHOLDS.repMetricLow)} with ${weakestTrend} directionality, so ${weakestLabel} → handling resistance behavior → Conversion Proxy ${derived.conversionProxyScore}/100 → Sales Risk ${derived.salesRiskScore}/100`,
        `Most urgent metric: ${urgentMetric.label}. ${rep.name} shows ${strongestLabel} at ${strongestScore}/5 on the 5-point scale, but ${weakestLabel} is ${formatFivePointComparison(weakestScore, MANAGER_MODEL_THRESHOLDS.repMetricLow)}.`,
      ),
      whyItMatters: trimSentence(
        `${weakestLabel} is the capability gap, it weakens handling resistance behavior in live calls, and that behavior drag is visible in Conversion Proxy ${derived.conversionProxyScore}/100 and Sales Risk ${derived.salesRiskScore}/100, which is ${derived.salesRiskScore >= MANAGER_MODEL_THRESHOLDS.salesRiskHigh ? "at or above" : "below"} the ${MANAGER_MODEL_THRESHOLDS.salesRiskHigh}/100 threshold`,
        `${weakestLabel} is the capability gap and is dragging business outcomes.`,
      ),
      action: trimSentence(
        `Run 2 targeted coaching sessions that start from ${strongestLabel} examples, then rehearse the exact objection moments where ${weakestLabel} sits ${round(MANAGER_MODEL_THRESHOLDS.repMetricLow - weakestScore, 1)}/5 below threshold so the next review can move ${weakestLabel} up and pull Sales Risk down`,
        `Run 2 targeted coaching sessions tied to recent sessions where ${strongestLabel} was effective, then rehearse the same scenarios for ${weakestLabel}.`,
      ),
      monitor: [
        `Most urgent metric: ${urgentMetric.summary}.`,
        `${nextWeakestLabel} is ${formatFivePointComparison(nextWeakestScore, MANAGER_MODEL_THRESHOLDS.repMetricLow)} on the 5-point scale with ${formatTrendLabel(rep.behavioralMetrics[nextWeakest].trend)} directionality.`,
        `${PREDICTIVE_CONFIDENCE_LABEL}: ${Math.round(derived.confidenceScore * 100)}/100, derived from: Data Confidence ${Math.round(derived.dataConfidenceIndex * 100)}/100, Behavioral Variance ${derived.behavioralVariance}, Engagement Stability ${derived.engagementStabilityScore}/100.`,
      ],
    };
  }

  const territory = payload.territoryData;
  const gapKey = territory.mostCommonCapabilityGap ?? profileContext.weakestKey;
  const strongestKey = profileContext.strongestKey;
  const strongestLabel = getBehavioralMetricLabel(strongestKey);
  const weakestLabel = getBehavioralMetricLabel(gapKey);
  const strongestScore = territory.avgBehavioralMetrics[strongestKey];
  const weakestScore = territory.avgBehavioralMetrics[gapKey];
  const urgentMetric = pickUrgentTerritoryMetric(territory);
  const nextWeakestKey = BEHAVIORAL_METRIC_KEYS
    .filter((key) => key !== gapKey)
    .sort((a, b) => territory.avgBehavioralMetrics[a] - territory.avgBehavioralMetrics[b])[0];
  const nextWeakestLabel = getBehavioralMetricLabel(nextWeakestKey);
  const nextWeakestScore = territory.avgBehavioralMetrics[nextWeakestKey];

  return {
    profileContext,
    primaryFinding: trimSentence(
      `Most urgent metric: ${urgentMetric.label}. ${territory.territory} is strongest in ${strongestLabel} at ${strongestScore}/5 on the 5-point scale, but ${weakestLabel} is ${formatFivePointComparison(weakestScore, MANAGER_MODEL_THRESHOLDS.repMetricLow)} with ${formatTrendLabel(territory.trend)} territory directionality, so ${weakestLabel} → execution consistency → Sales Outcome Score ${territory.avgPerformance}/5 → territory risk ${territory.riskLevel}`,
      `Most urgent metric: ${urgentMetric.label}. ${territory.territory} is strongest in ${strongestLabel}, but the primary gap is ${weakestLabel}.`,
    ),
    whyItMatters: trimSentence(
      `${weakestLabel} is the shared capability gap, it weakens execution consistency across reps, and that behavior drag keeps Sales Outcome Score at ${territory.avgPerformance}/5 and Learning Engagement Score at ${territory.avgEngagement}/100, which is ${territory.avgEngagement >= MANAGER_MODEL_THRESHOLDS.territoryEngagementRisk ? "above" : "below"} the ${MANAGER_MODEL_THRESHOLDS.territoryEngagementRisk}/100 territory risk threshold`,
      `${weakestLabel} below the ${MANAGER_MODEL_THRESHOLDS.repMetricLow}/5 threshold is limiting territory consistency.`,
    ),
    action: trimSentence(
      `Launch a focused coaching sprint on ${weakestLabel}, benchmark the stronger ${strongestLabel} pattern, and review weighted reps until ${weakestLabel} closes its ${round(MANAGER_MODEL_THRESHOLDS.repMetricLow - weakestScore, 1)}/5 gap and Territory Volatility stops rising`,
      `Launch a focused coaching sprint on ${weakestLabel} and use recent sessions with stronger ${strongestLabel} behaviors as the benchmark pattern.`,
    ),
    monitor: [
      `Most urgent metric: ${urgentMetric.summary}.`,
      `${nextWeakestLabel} is ${formatFivePointComparison(nextWeakestScore, MANAGER_MODEL_THRESHOLDS.repMetricLow)} on the 5-point scale with ${formatTrendLabel(territory.trend)} territory directionality.`,
      `Learning Engagement Score is ${formatHundredPointComparison(territory.avgEngagement, MANAGER_MODEL_THRESHOLDS.territoryEngagementRisk)} on the 100-point scale, and Territory Volatility is ${territory.territoryVolatility} versus the ${MANAGER_MODEL_THRESHOLDS.volatilityModerate} watch threshold.`,
    ],
  };
}
