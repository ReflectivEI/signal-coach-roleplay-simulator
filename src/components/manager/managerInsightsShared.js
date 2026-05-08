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
import { buildMetricNarrative, describeConfidenceBand, describeSiScoreBand, describeTrendLanguage } from "@/lib/siEvaluationLanguage";

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
  const derivedCalibration = /** @type {any} */ (payload.derivedMetrics)?.calibration;

  const summary = rep
    ? `${subject} is evaluated on the canonical Signal Intelligence metrics. ${strongestCapabilityLabel} is the most established pattern, while ${weakestCapabilityLabel} is the clearest coaching priority. The current risk picture shows ${derived.thresholdFlags.join("; ") || "no acute signal breaks"} in ${territory.territory}.`
    : `${subject} is computed from weighted rep aggregates and shows a ${territory.riskLevel} coaching risk profile. The current risk picture shows ${derived.thresholdFlags.join("; ") || "no acute signal breaks"}.`;

  const keyDrivers = rep
    ? [
      `${rep.name} is showing ${describeSiScoreBand(derived.engagementScore / 20).label.toLowerCase()} learning engagement based on recent practice volume and coaching follow-through.`,
      `${buildMetricNarrative(strongestCapabilityLabel, strongestMetricScore, rep.behavioralMetrics[rep.strongestCapability].trend)} ${buildMetricNarrative(weakestCapabilityLabel, weakestMetricScore, rep.behavioralMetrics[rep.improvementPriority].trend)}`,
      `${rep.name}'s sales execution is ${describeSiScoreBand(rep.salesPerformance).label.toLowerCase()} and ${describeTrendLanguage(rep.salesTrend)}, while ${territory.territory} is ${describeSiScoreBand(territory.avgPerformance).label.toLowerCase()} overall.`,
    ]
    : [
      `${territory.territory} is ${describeSiScoreBand(territory.avgPerformance).label.toLowerCase()} in sales execution and ${describeSiScoreBand(territory.avgEngagement / 20).label.toLowerCase()} in learning engagement across the weighted rep group.`,
      `The primary capability gap is ${territory.mostCommonCapabilityGap ? getBehavioralMetricLabel(territory.mostCommonCapabilityGap) : "none"}, and the top capability pattern is ${territory.topPerformingBehaviorPattern.map(getBehavioralMetricLabel).join(", ") || "none"}.`,
      `${territory.atRiskRepCount > 1 ? "Several reps" : territory.atRiskRepCount === 1 ? "One rep" : "No reps"} are currently driving the risk picture, and territory volatility suggests ${describeVolatilityLanguage(territory.territoryVolatility)}.`,
    ];

  const risks = rep
    ? [
      `${rep.name}'s risk picture shows that ${weakestCapabilityLabel} remains the most fragile behavior and ${describeSalesRiskLanguage(payload.derivedMetrics?.salesRiskScore ?? derived.riskIndex)}.`,
      `${rep.name} is working in ${rep.territoryContext.payerPressure >= 4 ? "payer-heavy territory pressure" : "moderate territory pressure"}, so coaching should stay practical and execution-focused rather than purely informational.`,
    ]
    : [
      `${territory.territory} risk is tied to ${territory.mostCommonCapabilityGap ? getBehavioralMetricLabel(territory.mostCommonCapabilityGap) : "mixed capability gaps"}, an ${describeTrendLanguage(territory.trend)} territory trend, and ${describeConfidenceBand(derived.territoryDataConfidence).label.toLowerCase()} visibility into the current pattern.`,
      `${territory.territory} shows an uneven performance mix, so the territory coaching plan should focus first on stabilizing the weakest shared behavior before scaling best practices.`,
    ];

  const recommendations = rep
    ? [
      {
        action: `Run 2 targeted coaching sessions this week focused on ${weakestCapabilityLabel} because it remains below the dependable field standard for ${rep.name}.`,
        rationale: `${rep.name}'s lowest behavioral pattern is ${weakestCapabilityLabel}, learning engagement is ${describeSiScoreBand(derived.engagementScore / 20).label.toLowerCase()}, and the overall risk picture still needs active coaching in ${territory.territory}.`,
        expectedImpact: `Strengthening ${weakestCapabilityLabel} should make the rep's next-step execution more dependable and lower the risk profile in ${territory.territory}.`,
      },
      {
        action: `Use ${strongestCapabilityLabel} as the anchor behavior in the next manager review and inspect two recent sessions for transfer into ${weakestCapabilityLabel}.`,
        rationale: `${rep.name}'s strongest capability is ${strongestCapabilityLabel}, which is the best observed bridge into ${weakestCapabilityLabel} without inventing new signals.`,
        expectedImpact: `This should improve coaching responsiveness and engagement stability while keeping the intervention tied to the observed 8-metric profile.`,
      },
    ]
    : [
      {
        action: `Launch a territory coaching sprint on ${territory.mostCommonCapabilityGap ? getBehavioralMetricLabel(territory.mostCommonCapabilityGap) : "capability consistency"} for the next 14 days across ${territory.territory}.`,
        rationale: `${territory.territory} shows a weighted gap in ${territory.mostCommonCapabilityGap ? getBehavioralMetricLabel(territory.mostCommonCapabilityGap) : "behavioral consistency"}, with ${territory.atRiskRepCount > 1 ? "multiple reps needing intervention" : "a concentrated coaching opportunity"} and ${describeSiScoreBand(territory.avgEngagement / 20).label.toLowerCase()} learning engagement.`,
        expectedImpact: `A territory-level intervention should reduce execution volatility and make the weakest shared behavior more dependable.`,
      },
      {
        action: `Review the highest-volatility reps in ${territory.territory} and rebalance scenario mix toward payer and access-heavy simulations where applicable.`,
        rationale: `${territory.territory}'s volatility profile shows that execution is not transferring consistently, and the contributor view shows which reps drive the movement.`,
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
        ? `${describeConfidenceBand(derived.confidence).label}. Reliability is based on ${describeConfidenceBand(payload.derivedMetrics?.dataConfidenceIndex ?? derived.dataConfidence).label.toLowerCase()} source coverage, ${describeSiScoreBand(rep.salesPerformance).label.toLowerCase()} sales execution, ${describeTrendLanguage(rep.salesTrend)} sales directionality, and ${derivedCalibration?.hasHistory ? "validated intervention history" : "a shorter historical observation window"}.`
        : `${describeConfidenceBand(derived.confidence).label}. Reliability is based on weighted rep coverage, ${describeVolatilityLanguage(territory.territoryVolatility)}, ${describeSiScoreBand(territory.avgEngagement / 20).label.toLowerCase()} learning engagement, and contribution stability in ${territory.territory}.`,
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
  return `Data Source: Rep + Territory Metrics • ${payload.repData.name}: ${getBehavioralMetricLabel(strongest)} is an ${describeSiScoreBand(payload.repData.behavioralMetrics[strongest].score).label.toLowerCase()} • ${getBehavioralMetricLabel(weakest)} is the clearest coaching priority`;
}

export function getBehavioralMetricKeySet() {
  return BEHAVIORAL_KEY_SET;
}

export function formatBehavioralMetricReference(metricKey, score) {
  return `${metricKey} (${getBehavioralMetricLabel(metricKey)}): ${describeSiScoreBand(score).label}`;
}

function trimSentence(text, fallback) {
  const sanitized = sanitizeText(text, fallback);
  return /[.!?]$/.test(sanitized) ? sanitized : `${sanitized}.`;
}

function formatTrendLabel(trend) {
  return trend === "up" ? "up" : trend === "down" ? "down" : "flat";
}

function describeSalesRiskLanguage(score) {
  if (!Number.isFinite(score)) return "risk visibility is still limited";
  if (score >= MANAGER_MODEL_THRESHOLDS.salesRiskHigh) return "risk is elevated enough to justify active intervention";
  if (score >= MANAGER_MODEL_THRESHOLDS.salesRiskModerate) return "risk is present and should be monitored closely";
  return "risk is contained for now";
}

function describeVolatilityLanguage(value) {
  if (!Number.isFinite(value)) return "stability is still being established";
  if (value >= MANAGER_MODEL_THRESHOLDS.volatilityHigh) return "execution is unstable across the territory";
  if (value >= MANAGER_MODEL_THRESHOLDS.volatilityModerate) return "execution consistency needs active attention";
  return "execution consistency is broadly stable";
}

function describeThresholdGap(score, threshold) {
  if (!Number.isFinite(score)) return "signal is still forming";
  if (score < threshold) return "sits below the dependable coaching standard";
  if (score < threshold + 0.5) return "is just above the dependable coaching standard but still needs reinforcement";
  return "is clearly beyond the dependable coaching standard";
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

function findCapabilityFromQuestion(question) {
  const normalized = typeof question === "string" ? question.toLowerCase() : "";
  if (!normalized) return null;

  /** @type {Array<[string, string[]]>} */
  const capabilityMatchers = [
    ["signalAwareness", ["signal awareness", "awareness", "discovery", "question timing", "questioning"]],
    ["signalInterpretation", ["signal interpretation", "interpretation", "read the room", "read signals", "stakeholder"]],
    ["adaptability", ["adaptive response", "adapt", "adaptability", "pivot", "flexibility"]],
    ["objectionHandling", ["objection navigation", "objection", "resistance", "pushback"]],
    ["valueCommunication", ["value connection", "value", "business case", "roi", "impact"]],
    ["commitmentGeneration", ["commitment generation", "commitment", "close", "next step", "advance"]],
    ["emotionalAttunement", ["customer engagement monitoring", "engagement", "buying signal", "attention", "motivat", "emotion"]],
    ["conversationControl", ["conversation management", "conversation", "control", "meeting flow", "agenda"]],
  ];

  const match = capabilityMatchers.find(([, aliases]) => aliases.some((alias) => normalized.includes(alias)));
  return match ? match[0] : null;
}

function buildRepQuestionFocus(rep, derived, question) {
  const normalized = question.toLowerCase();
  const explicitCapability = findCapabilityFromQuestion(question);
  const focusKey = explicitCapability
    ?? (/motivat|encourage|engage/.test(normalized) ? "emotionalAttunement" : null)
    ?? (/close|commit|next step/.test(normalized) ? "commitmentGeneration" : null)
    ?? (/objection|resistance|pushback/.test(normalized) ? "objectionHandling" : null)
    ?? rep.improvementPriority;

  const focusLabel = getBehavioralMetricLabel(focusKey);
  const focusMetric = rep.behavioralMetrics[focusKey];
  const strongestMetric = rep.behavioralMetrics[rep.strongestCapability];
  const belowThreshold = focusMetric.score < MANAGER_MODEL_THRESHOLDS.repMetricLow;
  const thresholdGap = round(Math.abs(focusMetric.score - MANAGER_MODEL_THRESHOLDS.repMetricLow), 1);
  const coachingAnchor = focusKey === rep.strongestCapability ? rep.strongestCapability : rep.strongestCapability;
  const coachingAnchorLabel = getBehavioralMetricLabel(coachingAnchor);
  const motivationVector = rep.practiceStreakDays > 0
    ? `${rep.practiceStreakDays}-day practice streak`
    : `${rep.coachingModulesCompleted}/8 modules completed`;

  return {
    focusKey,
    focusLabel,
    focusMetric,
    strongestMetric,
    strongestLabel: getBehavioralMetricLabel(rep.strongestCapability),
    coachingAnchorLabel,
    belowThreshold,
    thresholdGap,
    motivationVector,
    questionTheme: /motivat|encourage|engage/.test(normalized)
      ? "motivation"
      : /objection|resistance|pushback/.test(normalized)
        ? "objection"
        : /close|commit|next step/.test(normalized)
          ? "commitment"
          : "coaching",
    confidencePercent: Math.round(derived.confidenceScore * 100),
  };
}

export function buildInteractiveCoachingResponse(payload, question, selectedContext = []) {
  const prompt = sanitizeText(question, "Explain the current recommendation.");
  const contextNote = selectedContext.length ? ` Context chips applied: ${selectedContext.join(", ")}.` : "";

  if (payload.repData && payload.derivedMetrics) {
    const rep = payload.repData;
    const derived = payload.derivedMetrics;
    const focus = buildRepQuestionFocus(rep, derived, prompt);
    const focusComparison = `${focus.focusLabel} ${describeThresholdGap(focus.focusMetric.score, MANAGER_MODEL_THRESHOLDS.repMetricLow)} and is ${describeTrendLanguage(focus.focusMetric.trend)}.`;
    const strongestComparison = buildMetricNarrative(focus.strongestLabel, rep.behavioralMetrics[rep.strongestCapability].score, rep.behavioralMetrics[rep.strongestCapability].trend);
    const questionLead = /\?$/.test(prompt) ? prompt : `${prompt}?`;

    return {
      primaryFinding: trimSentence(
        `${questionLead} For ${rep.name}, the direct coaching focus is ${focusComparison} ${strongestComparison} Overall, ${describeSalesRiskLanguage(derived.salesRiskScore)}.`,
        `${rep.name} should focus on ${focus.focusLabel} next.`
      ),
      whyItMatters: trimSentence(
        `${focus.focusLabel} changes live-call behavior first, and in ${rep.name}'s data that behavior link is visible in commitment quality, readiness for the next call, and the current risk picture. Prediction reliability is ${describeConfidenceBand(derived.confidenceScore).label.toLowerCase()}, which guides how decisively you should coach the pattern.${contextNote}`,
        `${focus.focusLabel} is the clearest lever for business outcomes right now.`
      ),
      action: trimSentence(
        focus.questionTheme === "motivation"
          ? `Use ${focus.coachingAnchorLabel} as the entry point, show ${rep.name} two recent wins, then set one observable behavior target for ${focus.focusLabel} in the next 2 sessions because ${focus.focusLabel} ${describeThresholdGap(focus.focusMetric.score, MANAGER_MODEL_THRESHOLDS.repMetricLow)} and ${focus.motivationVector} shows the best current reinforcement path`
          : focus.questionTheme === "objection"
            ? `Coach one objection sequence at a time: start with ${focus.coachingAnchorLabel}, script the exact resistance moment, require a clear next-step ask, and review the next 2 sessions until ${focus.focusLabel} becomes dependable in live execution and the risk picture softens`
            : focus.questionTheme === "commitment"
              ? `Run a next-step coaching drill that connects ${focus.coachingAnchorLabel} to a stronger commitment ask, inspect two recent sessions for missed advance moments, and keep the intervention active until ${focus.focusLabel} looks dependable and readiness holds up under pressure`
              : `Anchor the next manager coaching review in ${focus.coachingAnchorLabel}, then isolate one behavior within ${focus.focusLabel} for deliberate practice in the next 2 sessions so the rep improves the weakest transferable skill without changing the scoring model`,
        `Coach ${rep.name} on ${focus.focusLabel} in the next two sessions.`
      ),
      monitor: [
        `${focus.focusLabel} ${describeThresholdGap(focus.focusMetric.score, MANAGER_MODEL_THRESHOLDS.repMetricLow)} and is currently ${describeTrendLanguage(focus.focusMetric.trend)}.`,
        `Learning engagement is ${describeSiScoreBand(derived.engagementScore / 20).label.toLowerCase()} with ${rep.sessionsCompleted30d} recent sessions and ${rep.coachingModulesCompleted} completed modules supporting the coaching plan.`,
        `Prediction reliability is ${describeConfidenceBand(derived.confidenceScore).label.toLowerCase()}, based on data confidence, behavioral stability, and engagement consistency.`,
      ],
    };
  }

  const territory = payload.territoryData;
  const gapKey = findCapabilityFromQuestion(prompt) ?? territory.mostCommonCapabilityGap ?? BEHAVIORAL_METRIC_KEYS[0];
  const gapLabel = getBehavioralMetricLabel(gapKey);
  const gapScore = territory.avgBehavioralMetrics[gapKey];
  return {
    primaryFinding: trimSentence(
      `${prompt} In ${territory.territory}, the most relevant territory answer centers on ${gapLabel}, which ${describeThresholdGap(gapScore, MANAGER_MODEL_THRESHOLDS.repMetricLow)}. Learning engagement is ${describeSiScoreBand(territory.avgEngagement / 20).label.toLowerCase()} and the territory is showing ${describeVolatilityLanguage(territory.territoryVolatility)}.`,
      `${territory.territory} should focus on ${gapLabel}.`
    ),
    whyItMatters: trimSentence(
      `${gapLabel} is the shared territory gap, and that pattern is weakening execution consistency, learning engagement, and the number of reps who can operate independently without intervention.${contextNote}`,
      `${gapLabel} is the strongest territory coaching lever right now.`
    ),
    action: trimSentence(
      `Use territory coaching time to benchmark the strongest reps against ${gapLabel}, review contributor reps first, and keep the sprint open until ${gapLabel} becomes dependable and territory volatility settles`,
      `Run a territory sprint on ${gapLabel}.`
    ),
    monitor: [
      `${gapLabel} ${describeThresholdGap(gapScore, MANAGER_MODEL_THRESHOLDS.repMetricLow)} and is currently ${describeTrendLanguage(territory.trend)} across the territory.`,
      `Learning engagement is ${describeSiScoreBand(territory.avgEngagement / 20).label.toLowerCase()} across ${territory.repIds.length} weighted reps.`,
      `Territory volatility indicates that ${describeVolatilityLanguage(territory.territoryVolatility)}.`,
    ],
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
        `Most urgent metric: ${urgentMetric.label}. ${buildMetricNarrative(strongestLabel, strongestScore, rep.behavioralMetrics[rep.strongestCapability].trend)} ${buildMetricNarrative(weakestLabel, weakestScore, rep.behavioralMetrics[rep.improvementPriority].trend)} That gap is now affecting execution quality and the current risk picture.`,
        `Most urgent metric: ${urgentMetric.label}. ${rep.name} is strongest in ${strongestLabel}, but ${weakestLabel} is the clearest coaching priority.`,
      ),
      whyItMatters: trimSentence(
        `${weakestLabel} is the capability gap. It weakens resistance handling in live calls, reduces next-step quality, and leaves ${rep.name} in a risk pattern that still needs active coaching attention.`,
        `${weakestLabel} is the capability gap and is dragging business outcomes.`,
      ),
      action: trimSentence(
        `Run 2 targeted coaching sessions that start from ${strongestLabel} examples, then rehearse the exact objection moments where ${weakestLabel} still breaks down so the next review can make that behavior dependable and pull risk down`,
        `Run 2 targeted coaching sessions tied to recent sessions where ${strongestLabel} was effective, then rehearse the same scenarios for ${weakestLabel}.`,
      ),
      monitor: [
        `Most urgent metric: ${urgentMetric.summary}.`,
        `${nextWeakestLabel} ${describeThresholdGap(nextWeakestScore, MANAGER_MODEL_THRESHOLDS.repMetricLow)} and is ${describeTrendLanguage(rep.behavioralMetrics[nextWeakest].trend)}.`,
        `Prediction reliability is ${describeConfidenceBand(derived.confidenceScore).label.toLowerCase()}, based on source coverage, behavioral stability, and engagement consistency.`,
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
      `Most urgent metric: ${urgentMetric.label}. ${buildMetricNarrative(strongestLabel, strongestScore, territory.trend)} ${buildMetricNarrative(weakestLabel, weakestScore, territory.trend)} That gap is now affecting territory consistency and the current risk profile.`,
      `Most urgent metric: ${urgentMetric.label}. ${territory.territory} is strongest in ${strongestLabel}, but the primary gap is ${weakestLabel}.`,
    ),
    whyItMatters: trimSentence(
      `${weakestLabel} is the shared capability gap. It weakens execution consistency across reps and keeps the territory from becoming dependable under pressure.`,
      `${weakestLabel} is limiting territory consistency.`,
    ),
    action: trimSentence(
      `Launch a focused coaching sprint on ${weakestLabel}, benchmark the stronger ${strongestLabel} pattern, and review weighted reps until ${weakestLabel} becomes dependable and territory volatility stops rising`,
      `Launch a focused coaching sprint on ${weakestLabel} and use recent sessions with stronger ${strongestLabel} behaviors as the benchmark pattern.`,
    ),
    monitor: [
      `Most urgent metric: ${urgentMetric.summary}.`,
      `${nextWeakestLabel} ${describeThresholdGap(nextWeakestScore, MANAGER_MODEL_THRESHOLDS.repMetricLow)} and is ${describeTrendLanguage(territory.trend)} across the territory.`,
      `Learning engagement is ${describeSiScoreBand(territory.avgEngagement / 20).label.toLowerCase()}, and territory volatility shows that ${describeVolatilityLanguage(territory.territoryVolatility)}.`,
    ],
  };
}
