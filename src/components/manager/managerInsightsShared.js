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

  const summary = rep
    ? `${subject} is evaluated on the canonical Signal Intelligence metrics. Strongest capability is ${strongestCapabilityLabel} and the capability requiring improvement is ${weakestCapabilityLabel}, with deterministic threshold flags ${derived.thresholdFlags.join("; ") || "none"} in ${territory.territory}.`
    : `${subject} is computed from weighted rep aggregates and shows a ${territory.riskLevel} coaching risk profile, with threshold flags ${derived.thresholdFlags.join("; ") || "none"}.`;

  const keyDrivers = rep
    ? [
      `${rep.name} completed ${rep.sessionsCompleted30d} sessions, ${rep.coachingModulesCompleted} coaching modules, and has a learning engagement score of ${derived.engagementScore}/100 against the ${MANAGER_MODEL_THRESHOLDS.engagementRisk}/100 monitoring threshold.`,
      `${rep.name}'s strongest capability is ${strongestCapabilityLabel} at ${strongestMetricScore}/5, while ${weakestCapabilityLabel} is ${weakestMetricScore}/5 against the ${MANAGER_MODEL_THRESHOLDS.repMetricLow}/5 threshold.`,
      `${rep.name}'s sales outcome score is ${rep.salesPerformance}/5 with a ${rep.salesTrend} trend, sales risk ${payload.derivedMetrics?.salesRiskScore ?? derived.riskIndex}/100, and ${territory.territory} average sales outcome score ${territory.avgPerformance}/5.`,
    ]
    : [
      `${territory.territory} averages ${territory.avgPerformance}/5 on sales outcome score and ${territory.avgEngagement}/100 on learning engagement across ${territory.repIds.length} weighted reps.`,
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
        ? `Predictive confidence is ${Math.round(derived.confidence * 100)}% from data confidence ${Math.round((payload.derivedMetrics?.dataConfidenceIndex ?? 0) * 100)}%, sessions ${rep.sessionsCompleted30d}, behavioral variance ${payload.derivedMetrics?.behavioralVariance}, engagement stability ${payload.derivedMetrics?.engagementStabilityScore}/100, and trend stability on ${weakestCapabilityLabel}.`
        : `Confidence is ${Math.round(derived.confidence * 100)}% from weighted rep coverage, territory volatility ${territory.territoryVolatility}, average learning engagement ${territory.avgEngagement}/100, and contribution-weight variance ${derived.territoryWeightVariance} in ${territory.territory}.`,
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
