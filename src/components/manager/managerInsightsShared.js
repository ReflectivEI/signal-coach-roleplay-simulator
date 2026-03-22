// @ts-check
import { z } from "zod";
import { BEHAVIORAL_METRIC_KEYS, getBehavioralMetricLabel } from "./managerPerformanceData.js";

const TREND_VALUES = {
  up: 1,
  flat: 0,
  down: -1,
};

const HIGH_RISK_THRESHOLD = 62;
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
});

const repDerivedMetricsSchema = z.object({
  strongestCapability: behavioralMetricKeyEnum,
  improvementPriority: behavioralMetricKeyEnum,
  behavioralVariance: z.number().min(0).max(5),
  engagementScore: z.number().min(0).max(100),
  readinessScore: z.number().min(0).max(100),
  coachingResponsivenessScore: z.number().min(0).max(100).optional(),
  territoryPressureScore: z.number().min(0).max(100),
  salesRiskScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(1),
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
  const rep = payload.repData;
  const territory = payload.territoryData;
  const derived = payload.derivedMetrics;
  const territoryMetricRanking = getBestMetricKeys(territory.avgBehavioralMetrics);

  const keyMetric = rep
    ? rep.behavioralMetrics[rep.improvementPriority]
    : payload.territoryData.mostCommonCapabilityGap
      ? { score: territory.avgBehavioralMetrics[payload.territoryData.mostCommonCapabilityGap], trend: territory.trend, sessionsObserved: 0 }
      : null;

  const signalCoverage = rep
    ? round(BEHAVIORAL_METRIC_KEYS.filter((key) => rep.behavioralMetrics[key].sessionsObserved > 0).length / BEHAVIORAL_METRIC_KEYS.length, 2)
    : 1;

  const confidence = rep
    ? derived?.confidenceScore ?? 0.7
    : round(clamp(0.58 + (territory.avgEngagement / 250) - (territory.territoryVolatility / 10), 0.45, 0.9), 2);

  const riskIndex = rep
    ? derived?.salesRiskScore ?? 50
    : round(
      clamp(
        (territory.riskLevel === "high" ? 70 : territory.riskLevel === "moderate" ? 52 : 28)
        + (territory.atRiskRepCount * 4)
        + (territory.territoryVolatility * 10),
        0,
        100,
      ),
      1,
    );

  return {
    subjectName: rep?.name ?? `${territory.territory} territory`,
    strongestCapability: rep?.strongestCapability ?? territory.topPerformingBehaviorPattern[0] ?? null,
    improvementPriority: rep?.improvementPriority ?? territory.mostCommonCapabilityGap,
    engagementScore: rep ? derived?.engagementScore ?? 0 : territory.avgEngagement,
    readinessScore: rep ? derived?.readinessScore ?? 0 : round((territory.avgPerformance * 20 * 0.7) + (territory.avgEngagement * 0.3), 1),
    territoryTrend: territory.trend,
    performanceTrend: rep?.salesTrend ?? territory.trend,
    riskIndex,
    confidence,
    signalCoverage,
    keyMetric,
    topBehaviorPattern: territoryMetricRanking,
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
    ? `${subject} shows ${strongestCapability} as the strongest observed capability and ${weakestCapability} as the primary improvement area, with territory context from ${territory.territory} shaping the coaching recommendation.`
    : `${subject} shows a ${territory.riskLevel} coaching risk profile, with cross-rep patterns centered on ${territory.mostCommonCapabilityGap ?? "aligned capability coverage"}.`;

  const keyDrivers = rep
    ? [
      `${rep.name} completed ${rep.sessionsCompleted30d} sessions, ${rep.coachingModulesCompleted} coaching modules, and carries an engagementScore of ${derived.engagementScore}/100.`,
      `${rep.name}'s strongestCapability is ${rep.strongestCapability} at ${strongestMetricScore}/5, while improvementPriority is ${rep.improvementPriority} at ${weakestMetricScore}/5.`,
      `${rep.name}'s salesPerformance is ${rep.salesPerformance}/5 with a ${rep.salesTrend} salesTrend, and ${territory.territory} is ${territory.trend} with avgPerformance ${territory.avgPerformance}/5.`,
    ]
    : [
      `${territory.territory} averages ${territory.avgPerformance}/5 performance and ${territory.avgEngagement}/100 engagement across ${territory.repIds.length} reps.`,
      `The mostCommonCapabilityGap is ${territory.mostCommonCapabilityGap ?? "none"}, while topPerformingBehaviorPattern is ${territory.topPerformingBehaviorPattern.join(", ") || "none"}.`,
      `${territory.atRiskRepCount} reps are at risk, with territoryVolatility at ${territory.territoryVolatility} and ${Math.round(territory.lowPerformerConcentration * 100)}% low performer concentration.`,
    ];

  const risks = rep
    ? [
      `${rep.name} carries a salesRiskScore of ${payload.derivedMetrics?.salesRiskScore ?? derived.riskIndex}/100, driven by ${rep.improvementPriority}, ${rep.salesTrend} salesTrend, and ${territory.territory} territory conditions.`,
      `${rep.name}'s territoryPressureScore is ${payload.derivedMetrics?.territoryPressureScore ?? 0}/100, indicating ${rep.territoryContext.payerPressure >= 4 ? "payer-heavy pressure" : "moderate territory pressure"} in ${territory.territory}.`,
    ]
    : [
      `${territory.territory} risk is tied to ${territory.mostCommonCapabilityGap ?? "mixed capability gaps"}, ${territory.atRiskRepCount} at-risk reps, and a ${territory.trend} territory trend.`,
      `${territory.territory} has ${Math.round(territory.lowPerformerConcentration * 100)}% low performer concentration against ${Math.round(territory.highPerformerConcentration * 100)}% high performer concentration.`,
    ];

  const recommendations = rep
    ? [
      {
        action: `Run 2 targeted coaching sessions this week focused on ${rep.improvementPriority} in ${rep.specialty.toLowerCase()} account conversations.`,
        rationale: `${rep.name}'s lowest behavioral metric is ${rep.improvementPriority} at ${weakestMetricScore}/5, and that gap aligns with ${rep.salesTrend} salesTrend plus ${territory.territory} territory pressure.`,
        expectedImpact: `Improved ${rep.improvementPriority} execution should raise close quality, support readinessScore, and strengthen conversion consistency in ${territory.territory}.`,
      },
      {
        action: `Use ${rep.strongestCapability} as the anchor behavior in the next manager review and inspect two recent sessions for transfer into ${rep.improvementPriority}.`,
        rationale: `${rep.name}'s strongestCapability is ${rep.strongestCapability}, so leveraging that strength creates a data-grounded bridge into the weakest capability without changing the canonical profile.`,
        expectedImpact: `This should improve coaching responsiveness while keeping the intervention aligned to observed evidence from the full 8-metric profile.`,
      },
    ]
    : [
      {
        action: `Launch a territory coaching sprint on ${territory.mostCommonCapabilityGap ?? "capability consistency"} for the next 14 days across ${territory.territory}.`,
        rationale: `${territory.territory} shows a shared gap in ${territory.mostCommonCapabilityGap ?? "behavioral consistency"}, with ${territory.atRiskRepCount} at-risk reps and ${territory.coachingOpportunityClusters[0] ?? "multiple cross-rep coaching opportunities"}.`,
        expectedImpact: `A territory-level intervention should reduce volatility, concentrate manager attention on the dominant gap, and improve shared execution patterns.`,
      },
      {
        action: `Review the highest-volatility reps in ${territory.territory} and rebalance scenario mix toward payer and access-heavy simulations where applicable.`,
        rationale: `${territory.territory}'s territoryVolatility is ${territory.territoryVolatility}, and the coachingOpportunityClusters indicate where cross-rep friction is accumulating.`,
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
        ? `Confidence is ${Math.round(derived.confidence * 100)}% based on confidenceScore, full 8-metric coverage, engagementScore ${derived.engagementScore}/100, and pattern strength between ${rep.improvementPriority}, ${rep.salesTrend} salesTrend, and ${territory.territory} territory conditions.`
        : `Confidence is ${Math.round(derived.confidence * 100)}% based on cross-rep completeness, territory volatility, engagement, and the concentration of shared capability gaps in ${territory.territory}.`,
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
    "value connection",
    "customer engagement",
    "objection navigation",
    "adaptive response",
    "conversation management",
    "listening & responsiveness",
  ];

  return forbiddenAliases.some((alias) => normalized.includes(alias));
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
    return `Data Source: Rep + Territory Metrics • Territory gap ${payload.territoryData.mostCommonCapabilityGap ?? "none"}`;
  }

  const weakest = payload.repData.improvementPriority;
  const strongest = payload.repData.strongestCapability;
  return `Data Source: Rep + Territory Metrics • ${payload.repData.name}: ${strongest} ${payload.repData.behavioralMetrics[strongest].score}/5 • ${weakest} ${payload.repData.behavioralMetrics[weakest].score}/5`;
}

export function getBehavioralMetricKeySet() {
  return BEHAVIORAL_KEY_SET;
}

export function formatBehavioralMetricReference(metricKey, score) {
  return `${metricKey} (${getBehavioralMetricLabel(metricKey)}): ${round(score, 1)}/5`;
}
