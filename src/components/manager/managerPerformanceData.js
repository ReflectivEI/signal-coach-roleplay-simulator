// @ts-check

/**
 * Canonical Manager View dataset and deterministic derivation layer.
 * This module is the single source of truth for Manager View table rows,
 * rep detail panels, territory aggregation, and AI prompt inputs.
 */

export const BEHAVIORAL_METRIC_KEYS = [
  "signalAwareness",
  "signalInterpretation",
  "adaptability",
  "objectionHandling",
  "valueCommunication",
  "commitmentGeneration",
  "emotionalAttunement",
  "conversationControl",
];

export const METRIC_LABELS = {
  signalAwareness: "Signal Awareness",
  signalInterpretation: "Signal Interpretation",
  adaptability: "Adaptability",
  objectionHandling: "Objection Handling",
  valueCommunication: "Value Communication",
  commitmentGeneration: "Commitment Generation",
  emotionalAttunement: "Emotional Attunement",
  conversationControl: "Conversation Control",
};

const TREND_VALUES = { up: 1, flat: 0, down: -1 };
const STATUS_RISK_WEIGHT = { active: 0, needs_attention: 12, inactive: 24 };
const TERRITORY_BASELINE = 3.7;
const REFERENCE_DATE = "2026-03-22";

export const MANAGER_MODEL_THRESHOLDS = {
  repMetricLow: 3.5,
  engagementRisk: 60,
  territoryEngagementRisk: 55,
  territoryEngagementModerate: 68,
  salesRiskHigh: 62,
  salesRiskModerate: 48,
  volatilityHigh: 0.6,
  volatilityModerate: 0.4,
  confidenceHigh: 0.75,
  confidenceModerate: 0.6,
};

/** @typedef {typeof BEHAVIORAL_METRIC_KEYS[number]} BehavioralMetricKey */

/**
 * @typedef {{
 *   score: number;
 *   trend: "up" | "down" | "flat";
 *   sessionsObserved: number;
 * }} RepMetricProfile
 */

/**
 * @typedef {{
 *   coachingSessions30d: number;
 *   managerReviews30d: number;
 *   lastCoachingDate: string;
 * }} RecentCoachingActivity
 */

/**
 * @typedef {{
 *   liveCall: number;
 *   roleplay: number;
 *   objectionDrill: number;
 *   accessScenario: number;
 * }} ScenarioMix
 */

/**
 * @typedef {{
 *   video: number;
 *   workshop: number;
 *   simulation: number;
 *   peerPractice: number;
 * }} TrainingTypeMix
 */

/**
 * @typedef {{
 *   marketTrend: "up" | "down" | "flat";
 *   accessComplexity: number;
 *   payerPressure: number;
 *   accountComplexity: number;
 * }} TerritoryContext
 */

/**
 * @typedef {{
 *   id: string;
 *   name: string;
 *   specialty: string;
 *   territory: string;
 *   status: "active" | "needs_attention" | "inactive";
 *   sessionsCompleted30d: number;
 *   coachingModulesCompleted: number;
 *   practiceStreakDays: number;
 *   salesPerformance: number;
 *   salesTrend: "up" | "down" | "flat";
 *   behavioralMetrics: Record<BehavioralMetricKey, RepMetricProfile>;
 *   strongestCapability: BehavioralMetricKey;
 *   improvementPriority: BehavioralMetricKey;
 *   overallScore: number;
 *   recentCoachingActivity: RecentCoachingActivity;
 *   scenarioMix: ScenarioMix;
 *   trainingTypeMix: TrainingTypeMix;
 *   lastPracticeDate: string;
 *   engagementConsistency: number;
 *   observationDepth: number;
 *   territoryContext: TerritoryContext;
 * }} RepData
 */

/**
 * @typedef {{
 *   strongestCapability: BehavioralMetricKey;
 *   improvementPriority: BehavioralMetricKey;
 *   behavioralVariance: number;
 *   engagementScore: number;
 *   readinessScore: number;
 *   coachingResponsivenessScore?: number;
 *   engagementStabilityScore: number;
 *   conversionProxyScore: number;
 *   territoryPressureScore: number;
 *   salesRiskScore: number;
 *   dataConfidenceIndex: number;
 *   confidenceScore: number;
 * }} RepDerivedMetrics
 */

/**
 * @typedef {{
 *   territory: string;
 *   avgPerformance: number;
 *   avgEngagement: number;
 *   trend: "up" | "down" | "flat";
 *   riskLevel: "low" | "moderate" | "high";
 *   avgBehavioralMetrics: Record<BehavioralMetricKey, number>;
 *   mostCommonCapabilityGap: BehavioralMetricKey | null;
 *   topPerformingBehaviorPattern: BehavioralMetricKey[];
 *   territoryVolatility: number;
 *   atRiskRepCount: number;
 *   lowPerformerConcentration: number;
 *   highPerformerConcentration: number;
 *   coachingOpportunityClusters: string[];
 *   repIds: string[];
 *   aggregationWeights: Record<string, number>;
 * }} TerritoryData
 */

/**
 * @typedef {{
 *   reps: RepData[];
 *   derivedByRepId: Record<string, RepDerivedMetrics>;
 *   territories: TerritoryData[];
 *   nationalTerritory: TerritoryData;
 *   validation: { isValid: boolean; issues: string[] };
 * }} ManagerViewDataset
 */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** @param {Record<BehavioralMetricKey, RepMetricProfile>} behavioralMetrics */
function getCapabilityExtremes(behavioralMetrics) {
  return BEHAVIORAL_METRIC_KEYS.reduce(
    (acc, key) => {
      const score = behavioralMetrics[key].score;
      if (score > behavioralMetrics[acc.strongest].score) {
        acc.strongest = key;
      }
      if (score < behavioralMetrics[acc.improvement].score) {
        acc.improvement = key;
      }
      return acc;
    },
    /** @type {{ strongest: BehavioralMetricKey; improvement: BehavioralMetricKey }} */ ({
      strongest: BEHAVIORAL_METRIC_KEYS[0],
      improvement: BEHAVIORAL_METRIC_KEYS[0],
    }),
  );
}

/** @param {Record<BehavioralMetricKey, RepMetricProfile>} behavioralMetrics */
function averageBehavioralScore(behavioralMetrics) {
  const total = BEHAVIORAL_METRIC_KEYS.reduce((sum, key) => sum + behavioralMetrics[key].score, 0);
  return round(total / BEHAVIORAL_METRIC_KEYS.length, 2);
}

function getDaysSinceReference(dateString) {
  const reference = new Date(`${REFERENCE_DATE}T12:00:00.000Z`);
  const value = new Date(`${dateString}T12:00:00.000Z`);
  return Math.max(0, Math.round((reference.getTime() - value.getTime()) / 86400000));
}

function getDominantTrendShare(behavioralMetrics) {
  const trendCounts = BEHAVIORAL_METRIC_KEYS.reduce((acc, key) => {
    const trend = behavioralMetrics[key].trend;
    acc[trend] = (acc[trend] || 0) + 1;
    return acc;
  }, {});
  return Math.max(...Object.values(trendCounts)) / BEHAVIORAL_METRIC_KEYS.length;
}

function getRecencyWeight(dateString) {
  return clamp(1 - (getDaysSinceReference(dateString) / 30), 0.2, 1);
}

/** @param {RepData} rep */
export function deriveRepMetrics(rep) {
  const averageBehavior = averageBehavioralScore(rep.behavioralMetrics);
  const strongestCapability = getCapabilityExtremes(rep.behavioralMetrics).strongest;
  const improvementPriority = getCapabilityExtremes(rep.behavioralMetrics).improvement;
  const scores = BEHAVIORAL_METRIC_KEYS.map((key) => rep.behavioralMetrics[key].score);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const behavioralVariance = round(maxScore - minScore, 2);

  const sessionsScore = clamp((rep.sessionsCompleted30d / 16) * 100, 0, 100);
  const modulesScore = clamp((rep.coachingModulesCompleted / 8) * 100, 0, 100);
  const streakScore = clamp((rep.practiceStreakDays / 14) * 100, 0, 100);
  const engagementConsistencyScore = clamp(rep.engagementConsistency, 0, 100);
  const coachingFrequencyBonus = clamp(rep.recentCoachingActivity.coachingSessions30d / 4, 0, 1) * 10;
  const engagementScore = round(
    (sessionsScore * 0.34)
      + (modulesScore * 0.22)
      + (streakScore * 0.18)
      + (engagementConsistencyScore * 0.16)
      + coachingFrequencyBonus,
    1,
  );

  const engagementStabilityScore = round(
    clamp(
      (engagementConsistencyScore * 0.7)
      + (clamp(1 - (behavioralVariance / 2.5), 0, 1) * 20)
      + (clamp(1 - (getDaysSinceReference(rep.lastPracticeDate) / 30), 0, 1) * 10),
      0,
      100,
    ),
    1,
  );

  const readinessScore = round(
    (averageBehavior * 20 * 0.45)
      + (rep.salesPerformance * 20 * 0.35)
      + (engagementScore * 0.2),
    1,
  );

  const coachingResponsivenessScore = rep.recentCoachingActivity.coachingSessions30d > 0
    ? round(
      clamp(
        (modulesScore * 0.25)
        + (streakScore * 0.15)
        + ((TREND_VALUES[rep.salesTrend] + 1) * 20)
        + ((rep.salesPerformance - averageBehavior + 2) * 10)
        + (rep.recentCoachingActivity.managerReviews30d * 3),
        0,
        100,
      ),
      1,
    )
    : undefined;

  const conversionProxyScore = round(
    clamp(
      (rep.behavioralMetrics.commitmentGeneration.score * 20 * 0.55)
      + (rep.behavioralMetrics.valueCommunication.score * 20 * 0.45),
      0,
      100,
    ),
    1,
  );

  const territoryPressureScore = round(
    clamp(
      ((rep.territoryContext.accessComplexity + rep.territoryContext.payerPressure + rep.territoryContext.accountComplexity) / 15) * 100
      + (rep.territoryContext.marketTrend === "down" ? 10 : rep.territoryContext.marketTrend === "up" ? -6 : 0),
      0,
      100,
    ),
    1,
  );

  const salesRiskScore = round(
    clamp(
      58
      - (rep.salesPerformance * 9)
      - (averageBehavior * 6)
      - (engagementScore * 0.16)
      + (rep.salesTrend === "down" ? 18 : rep.salesTrend === "flat" ? 7 : -8)
      + STATUS_RISK_WEIGHT[rep.status]
      + (rep.behavioralMetrics.commitmentGeneration.score < MANAGER_MODEL_THRESHOLDS.repMetricLow ? 7 : 0),
      0,
      100,
    ),
    1,
  );

  const metricCoverageRatio = round(
    BEHAVIORAL_METRIC_KEYS.filter((key) => rep.behavioralMetrics[key].sessionsObserved > 0).length / BEHAVIORAL_METRIC_KEYS.length,
    2,
  );
  const avgObservedSessions = BEHAVIORAL_METRIC_KEYS.reduce((sum, key) => sum + rep.behavioralMetrics[key].sessionsObserved, 0) / BEHAVIORAL_METRIC_KEYS.length;
  const sampleSizeRatio = round(clamp(((avgObservedSessions / 14) * 0.6) + ((rep.sessionsCompleted30d / 16) * 0.4), 0, 1), 2);
  const variancePenaltyRatio = round(clamp(1 - (behavioralVariance / 2.5), 0, 1), 2);
  const trendStabilityRatio = round(clamp((getDominantTrendShare(rep.behavioralMetrics) * 0.6) + (rep.salesTrend === "flat" ? 0.2 : 0.1), 0, 1), 2);
  const engagementConsistencyRatio = round(clamp(engagementStabilityScore / 100, 0, 1), 2);
  const recencyRatio = round(getRecencyWeight(rep.lastPracticeDate), 2);
  const dataConfidenceIndex = round(
    clamp(
      (metricCoverageRatio * 0.28)
      + (sampleSizeRatio * 0.24)
      + (recencyRatio * 0.18)
      + (engagementConsistencyRatio * 0.18)
      + (clamp(rep.observationDepth / 18, 0, 1) * 0.12),
      0,
      1,
    ),
    2,
  );
  const confidenceScore = round(
    clamp(
      (dataConfidenceIndex * 0.52)
      + (variancePenaltyRatio * 0.18)
      + (trendStabilityRatio * 0.18)
      + (metricCoverageRatio * 0.12),
      0,
      1,
    ),
    2,
  );

  return {
    strongestCapability,
    improvementPriority,
    behavioralVariance,
    engagementScore,
    readinessScore,
    coachingResponsivenessScore,
    engagementStabilityScore,
    conversionProxyScore,
    territoryPressureScore,
    salesRiskScore,
    dataConfidenceIndex,
    confidenceScore,
  };
}

/** @param {Omit<RepData, "strongestCapability" | "improvementPriority" | "overallScore">} rep */
function finalizeRep(rep) {
  const extremes = getCapabilityExtremes(rep.behavioralMetrics);
  const averageBehavior = averageBehavioralScore(rep.behavioralMetrics);
  const overallScore = round((averageBehavior * 0.65) + (rep.salesPerformance * 0.35), 1);

  return {
    ...rep,
    strongestCapability: extremes.strongest,
    improvementPriority: extremes.improvement,
    overallScore,
  };
}

function getAggregationWeight(rep) {
  const sessionWeight = clamp(rep.sessionsCompleted30d / 16, 0.2, 1);
  const recencyWeight = getRecencyWeight(rep.lastPracticeDate);
  return round((sessionWeight * 0.7) + (recencyWeight * 0.3), 4);
}

/** @param {RepData[]} reps */
export function buildTerritoryDataset(reps) {
  const grouped = reps.reduce((acc, rep) => {
    if (!acc[rep.territory]) acc[rep.territory] = [];
    acc[rep.territory].push(rep);
    return acc;
  }, /** @type {Record<string, RepData[]>} */ ({}));

  return Object.entries(grouped).map(([territory, territoryReps]) => {
    const derived = territoryReps.map((rep) => deriveRepMetrics(rep));
    const rawWeights = Object.fromEntries(territoryReps.map((rep) => [rep.id, getAggregationWeight(rep)]));
    const totalWeight = Object.values(rawWeights).reduce((sum, value) => sum + value, 0) || 1;
    const aggregationWeights = Object.fromEntries(Object.entries(rawWeights).map(([repId, value]) => [repId, round(value / totalWeight, 4)]));
    const weightedAverage = (resolver) => round(territoryReps.reduce((sum, rep) => sum + (resolver(rep) * aggregationWeights[rep.id]), 0), 2);

    const avgPerformance = weightedAverage((rep) => rep.salesPerformance);
    const avgEngagement = round(territoryReps.reduce((sum, rep, index) => sum + (derived[index].engagementScore * aggregationWeights[rep.id]), 0), 1);
    const avgBehavioralMetrics = /** @type {Record<BehavioralMetricKey, number>} */ (
      Object.fromEntries(
        BEHAVIORAL_METRIC_KEYS.map((key) => [
          key,
          weightedAverage((rep) => rep.behavioralMetrics[key].score),
        ]),
      )
    );

    const gapCounts = territoryReps.reduce((acc, rep) => {
      acc[rep.improvementPriority] = (acc[rep.improvementPriority] || 0) + aggregationWeights[rep.id];
      return acc;
    }, /** @type {Record<string, number>} */ ({}));

    const mostCommonCapabilityGap = /** @type {BehavioralMetricKey | null} */ (
      Object.entries(gapCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null
    );

    const topPerformingBehaviorPattern = BEHAVIORAL_METRIC_KEYS
      .filter((key) => avgBehavioralMetrics[key] >= TERRITORY_BASELINE)
      .sort((a, b) => avgBehavioralMetrics[b] - avgBehavioralMetrics[a])
      .slice(0, 3);

    const volatility = round(
      territoryReps.reduce((sum, rep) => sum + (Math.abs(rep.salesPerformance - avgPerformance) * aggregationWeights[rep.id]), 0),
      2,
    );

    const atRiskRepCount = territoryReps.filter((rep, index) => rep.status !== "active" || derived[index].salesRiskScore >= 55).length;
    const lowPerformerConcentration = round(territoryReps.reduce((sum, rep) => sum + (rep.salesPerformance < 3.3 ? aggregationWeights[rep.id] : 0), 0), 2);
    const highPerformerConcentration = round(territoryReps.reduce((sum, rep) => sum + (rep.salesPerformance >= 4.2 ? aggregationWeights[rep.id] : 0), 0), 2);
    const avgTrend = territoryReps.reduce((sum, rep) => sum + (TREND_VALUES[rep.salesTrend] * aggregationWeights[rep.id]), 0);
    const trend = avgTrend > 0.2 ? "up" : avgTrend < -0.2 ? "down" : "flat";

    const riskLevel = atRiskRepCount >= 2 || avgPerformance < 3.4 || avgEngagement < MANAGER_MODEL_THRESHOLDS.territoryEngagementRisk
      ? "high"
      : atRiskRepCount >= 1 || avgPerformance < 3.8 || avgEngagement < MANAGER_MODEL_THRESHOLDS.territoryEngagementModerate
        ? "moderate"
        : "low";

    const coachingOpportunityClusters = [
      mostCommonCapabilityGap ? `Cluster on ${mostCommonCapabilityGap} coaching in ${territory}` : null,
      avgEngagement < MANAGER_MODEL_THRESHOLDS.engagementRisk ? `Increase guided practice frequency because weighted engagement is ${avgEngagement}/100 below the ${MANAGER_MODEL_THRESHOLDS.engagementRisk} threshold` : null,
      volatility > MANAGER_MODEL_THRESHOLDS.volatilityModerate ? `Stabilize performance transfer because weighted volatility is ${volatility} against the ${MANAGER_MODEL_THRESHOLDS.volatilityModerate} threshold` : null,
      territoryReps.some((rep) => rep.territoryContext.payerPressure >= 4) ? "Add payer-heavy access scenarios to scenario mix" : null,
    ].filter(Boolean);

    return {
      territory,
      avgPerformance,
      avgEngagement,
      trend,
      riskLevel,
      avgBehavioralMetrics,
      mostCommonCapabilityGap,
      topPerformingBehaviorPattern,
      territoryVolatility: volatility,
      atRiskRepCount,
      lowPerformerConcentration,
      highPerformerConcentration,
      coachingOpportunityClusters,
      repIds: territoryReps.map((rep) => rep.id),
      aggregationWeights,
    };
  });
}

const rawRepSeed = [
  {
    id: "rep-01",
    name: "Alex Thompson",
    specialty: "Oncology",
    territory: "Northeast",
    status: "active",
    sessionsCompleted30d: 14,
    coachingModulesCompleted: 7,
    practiceStreakDays: 9,
    salesPerformance: 4.3,
    salesTrend: "up",
    behavioralMetrics: {
      signalAwareness: { score: 4.5, trend: "up", sessionsObserved: 16 },
      signalInterpretation: { score: 4.2, trend: "up", sessionsObserved: 16 },
      adaptability: { score: 4.1, trend: "flat", sessionsObserved: 14 },
      objectionHandling: { score: 3.9, trend: "up", sessionsObserved: 13 },
      valueCommunication: { score: 4.4, trend: "up", sessionsObserved: 15 },
      commitmentGeneration: { score: 3.6, trend: "up", sessionsObserved: 14 },
      emotionalAttunement: { score: 4.3, trend: "up", sessionsObserved: 15 },
      conversationControl: { score: 4.0, trend: "flat", sessionsObserved: 15 },
    },
    recentCoachingActivity: { coachingSessions30d: 3, managerReviews30d: 2, lastCoachingDate: "2026-03-18" },
    scenarioMix: { liveCall: 5, roleplay: 4, objectionDrill: 2, accessScenario: 3 },
    trainingTypeMix: { video: 2, workshop: 2, simulation: 2, peerPractice: 1 },
    lastPracticeDate: "2026-03-21",
    engagementConsistency: 86,
    observationDepth: 16,
    territoryContext: { marketTrend: "up", accessComplexity: 3, payerPressure: 3, accountComplexity: 4 },
  },
  {
    id: "rep-02",
    name: "Maria Santos",
    specialty: "Cardiology",
    territory: "Southeast",
    status: "active",
    sessionsCompleted30d: 10,
    coachingModulesCompleted: 5,
    practiceStreakDays: 4,
    salesPerformance: 3.7,
    salesTrend: "flat",
    behavioralMetrics: {
      signalAwareness: { score: 3.8, trend: "flat", sessionsObserved: 12 },
      signalInterpretation: { score: 3.6, trend: "flat", sessionsObserved: 11 },
      adaptability: { score: 3.5, trend: "up", sessionsObserved: 11 },
      objectionHandling: { score: 3.1, trend: "down", sessionsObserved: 10 },
      valueCommunication: { score: 3.9, trend: "flat", sessionsObserved: 11 },
      commitmentGeneration: { score: 3.3, trend: "flat", sessionsObserved: 10 },
      emotionalAttunement: { score: 3.7, trend: "up", sessionsObserved: 11 },
      conversationControl: { score: 3.4, trend: "flat", sessionsObserved: 11 },
    },
    recentCoachingActivity: { coachingSessions30d: 2, managerReviews30d: 1, lastCoachingDate: "2026-03-15" },
    scenarioMix: { liveCall: 3, roleplay: 3, objectionDrill: 2, accessScenario: 2 },
    trainingTypeMix: { video: 2, workshop: 1, simulation: 1, peerPractice: 1 },
    lastPracticeDate: "2026-03-20",
    engagementConsistency: 68,
    observationDepth: 12,
    territoryContext: { marketTrend: "flat", accessComplexity: 3, payerPressure: 4, accountComplexity: 3 },
  },
  {
    id: "rep-03",
    name: "James Park",
    specialty: "Infectious Disease",
    territory: "Midwest",
    status: "active",
    sessionsCompleted30d: 16,
    coachingModulesCompleted: 8,
    practiceStreakDays: 12,
    salesPerformance: 4.5,
    salesTrend: "up",
    behavioralMetrics: {
      signalAwareness: { score: 4.4, trend: "up", sessionsObserved: 18 },
      signalInterpretation: { score: 4.6, trend: "up", sessionsObserved: 18 },
      adaptability: { score: 3.8, trend: "flat", sessionsObserved: 17 },
      objectionHandling: { score: 4.2, trend: "up", sessionsObserved: 16 },
      valueCommunication: { score: 4.5, trend: "up", sessionsObserved: 18 },
      commitmentGeneration: { score: 4.1, trend: "up", sessionsObserved: 16 },
      emotionalAttunement: { score: 4.3, trend: "up", sessionsObserved: 17 },
      conversationControl: { score: 4.4, trend: "up", sessionsObserved: 17 },
    },
    recentCoachingActivity: { coachingSessions30d: 4, managerReviews30d: 3, lastCoachingDate: "2026-03-19" },
    scenarioMix: { liveCall: 5, roleplay: 4, objectionDrill: 3, accessScenario: 4 },
    trainingTypeMix: { video: 2, workshop: 2, simulation: 3, peerPractice: 1 },
    lastPracticeDate: "2026-03-22",
    engagementConsistency: 92,
    observationDepth: 18,
    territoryContext: { marketTrend: "up", accessComplexity: 2, payerPressure: 2, accountComplexity: 3 },
  },
  {
    id: "rep-04",
    name: "Sarah Williams",
    specialty: "Neurology",
    territory: "Southwest",
    status: "needs_attention",
    sessionsCompleted30d: 4,
    coachingModulesCompleted: 2,
    practiceStreakDays: 1,
    salesPerformance: 3.0,
    salesTrend: "down",
    behavioralMetrics: {
      signalAwareness: { score: 2.7, trend: "down", sessionsObserved: 6 },
      signalInterpretation: { score: 3.0, trend: "flat", sessionsObserved: 6 },
      adaptability: { score: 3.1, trend: "flat", sessionsObserved: 6 },
      objectionHandling: { score: 3.2, trend: "flat", sessionsObserved: 5 },
      valueCommunication: { score: 3.0, trend: "down", sessionsObserved: 6 },
      commitmentGeneration: { score: 2.9, trend: "down", sessionsObserved: 5 },
      emotionalAttunement: { score: 3.3, trend: "flat", sessionsObserved: 6 },
      conversationControl: { score: 3.1, trend: "flat", sessionsObserved: 5 },
    },
    recentCoachingActivity: { coachingSessions30d: 1, managerReviews30d: 1, lastCoachingDate: "2026-03-12" },
    scenarioMix: { liveCall: 1, roleplay: 2, objectionDrill: 0, accessScenario: 1 },
    trainingTypeMix: { video: 1, workshop: 0, simulation: 1, peerPractice: 0 },
    lastPracticeDate: "2026-03-14",
    engagementConsistency: 42,
    observationDepth: 6,
    territoryContext: { marketTrend: "down", accessComplexity: 4, payerPressure: 3, accountComplexity: 4 },
  },
  {
    id: "rep-05",
    name: "David Chen",
    specialty: "Immunology",
    territory: "West Coast",
    status: "active",
    sessionsCompleted30d: 11,
    coachingModulesCompleted: 5,
    practiceStreakDays: 6,
    salesPerformance: 3.9,
    salesTrend: "up",
    behavioralMetrics: {
      signalAwareness: { score: 3.9, trend: "up", sessionsObserved: 12 },
      signalInterpretation: { score: 3.8, trend: "flat", sessionsObserved: 12 },
      adaptability: { score: 3.7, trend: "up", sessionsObserved: 11 },
      objectionHandling: { score: 3.6, trend: "flat", sessionsObserved: 11 },
      valueCommunication: { score: 3.2, trend: "down", sessionsObserved: 11 },
      commitmentGeneration: { score: 3.5, trend: "up", sessionsObserved: 10 },
      emotionalAttunement: { score: 4.0, trend: "up", sessionsObserved: 12 },
      conversationControl: { score: 3.8, trend: "flat", sessionsObserved: 11 },
    },
    recentCoachingActivity: { coachingSessions30d: 2, managerReviews30d: 2, lastCoachingDate: "2026-03-17" },
    scenarioMix: { liveCall: 4, roleplay: 3, objectionDrill: 1, accessScenario: 3 },
    trainingTypeMix: { video: 2, workshop: 1, simulation: 1, peerPractice: 1 },
    lastPracticeDate: "2026-03-21",
    engagementConsistency: 74,
    observationDepth: 12,
    territoryContext: { marketTrend: "up", accessComplexity: 4, payerPressure: 3, accountComplexity: 4 },
  },
  {
    id: "rep-06",
    name: "Linda Nguyen",
    specialty: "Rare Disease",
    territory: "Mid-Atlantic",
    status: "inactive",
    sessionsCompleted30d: 1,
    coachingModulesCompleted: 1,
    practiceStreakDays: 0,
    salesPerformance: 2.8,
    salesTrend: "down",
    behavioralMetrics: {
      signalAwareness: { score: 2.9, trend: "down", sessionsObserved: 3 },
      signalInterpretation: { score: 2.8, trend: "down", sessionsObserved: 3 },
      adaptability: { score: 2.7, trend: "down", sessionsObserved: 2 },
      objectionHandling: { score: 3.0, trend: "flat", sessionsObserved: 2 },
      valueCommunication: { score: 3.1, trend: "flat", sessionsObserved: 3 },
      commitmentGeneration: { score: 2.6, trend: "down", sessionsObserved: 2 },
      emotionalAttunement: { score: 3.2, trend: "flat", sessionsObserved: 3 },
      conversationControl: { score: 2.8, trend: "down", sessionsObserved: 2 },
    },
    recentCoachingActivity: { coachingSessions30d: 1, managerReviews30d: 0, lastCoachingDate: "2026-03-08" },
    scenarioMix: { liveCall: 0, roleplay: 1, objectionDrill: 0, accessScenario: 0 },
    trainingTypeMix: { video: 1, workshop: 0, simulation: 0, peerPractice: 0 },
    lastPracticeDate: "2026-03-09",
    engagementConsistency: 18,
    observationDepth: 3,
    territoryContext: { marketTrend: "down", accessComplexity: 4, payerPressure: 4, accountComplexity: 3 },
  },
  {
    id: "rep-07",
    name: "Priya Patel",
    specialty: "Endocrinology",
    territory: "Northeast",
    status: "active",
    sessionsCompleted30d: 13,
    coachingModulesCompleted: 6,
    practiceStreakDays: 8,
    salesPerformance: 4.1,
    salesTrend: "up",
    behavioralMetrics: {
      signalAwareness: { score: 4.0, trend: "up", sessionsObserved: 14 },
      signalInterpretation: { score: 4.1, trend: "up", sessionsObserved: 14 },
      adaptability: { score: 3.7, trend: "flat", sessionsObserved: 13 },
      objectionHandling: { score: 3.8, trend: "up", sessionsObserved: 13 },
      valueCommunication: { score: 4.2, trend: "up", sessionsObserved: 14 },
      commitmentGeneration: { score: 3.9, trend: "up", sessionsObserved: 12 },
      emotionalAttunement: { score: 4.3, trend: "up", sessionsObserved: 13 },
      conversationControl: { score: 3.6, trend: "flat", sessionsObserved: 13 },
    },
    recentCoachingActivity: { coachingSessions30d: 3, managerReviews30d: 2, lastCoachingDate: "2026-03-16" },
    scenarioMix: { liveCall: 4, roleplay: 4, objectionDrill: 2, accessScenario: 3 },
    trainingTypeMix: { video: 2, workshop: 2, simulation: 1, peerPractice: 1 },
    lastPracticeDate: "2026-03-22",
    engagementConsistency: 84,
    observationDepth: 14,
    territoryContext: { marketTrend: "up", accessComplexity: 3, payerPressure: 3, accountComplexity: 4 },
  },
  {
    id: "rep-08",
    name: "Marcus Reed",
    specialty: "Pulmonology",
    territory: "Southeast",
    status: "needs_attention",
    sessionsCompleted30d: 6,
    coachingModulesCompleted: 3,
    practiceStreakDays: 2,
    salesPerformance: 3.2,
    salesTrend: "down",
    behavioralMetrics: {
      signalAwareness: { score: 3.2, trend: "flat", sessionsObserved: 7 },
      signalInterpretation: { score: 3.1, trend: "down", sessionsObserved: 7 },
      adaptability: { score: 2.9, trend: "down", sessionsObserved: 6 },
      objectionHandling: { score: 3.4, trend: "flat", sessionsObserved: 6 },
      valueCommunication: { score: 3.3, trend: "flat", sessionsObserved: 7 },
      commitmentGeneration: { score: 3.0, trend: "down", sessionsObserved: 6 },
      emotionalAttunement: { score: 3.5, trend: "flat", sessionsObserved: 7 },
      conversationControl: { score: 3.1, trend: "flat", sessionsObserved: 6 },
    },
    recentCoachingActivity: { coachingSessions30d: 2, managerReviews30d: 1, lastCoachingDate: "2026-03-13" },
    scenarioMix: { liveCall: 2, roleplay: 2, objectionDrill: 1, accessScenario: 1 },
    trainingTypeMix: { video: 1, workshop: 1, simulation: 1, peerPractice: 0 },
    lastPracticeDate: "2026-03-18",
    engagementConsistency: 49,
    observationDepth: 7,
    territoryContext: { marketTrend: "flat", accessComplexity: 4, payerPressure: 4, accountComplexity: 3 },
  },
  {
    id: "rep-09",
    name: "Olivia Brooks",
    specialty: "Dermatology",
    territory: "Midwest",
    status: "active",
    sessionsCompleted30d: 9,
    coachingModulesCompleted: 4,
    practiceStreakDays: 5,
    salesPerformance: 3.8,
    salesTrend: "flat",
    behavioralMetrics: {
      signalAwareness: { score: 3.7, trend: "flat", sessionsObserved: 10 },
      signalInterpretation: { score: 3.8, trend: "up", sessionsObserved: 9 },
      adaptability: { score: 3.6, trend: "flat", sessionsObserved: 9 },
      objectionHandling: { score: 3.5, trend: "flat", sessionsObserved: 9 },
      valueCommunication: { score: 3.9, trend: "up", sessionsObserved: 10 },
      commitmentGeneration: { score: 3.4, trend: "flat", sessionsObserved: 9 },
      emotionalAttunement: { score: 4.0, trend: "up", sessionsObserved: 10 },
      conversationControl: { score: 3.7, trend: "flat", sessionsObserved: 9 },
    },
    recentCoachingActivity: { coachingSessions30d: 2, managerReviews30d: 1, lastCoachingDate: "2026-03-14" },
    scenarioMix: { liveCall: 3, roleplay: 3, objectionDrill: 1, accessScenario: 2 },
    trainingTypeMix: { video: 1, workshop: 1, simulation: 1, peerPractice: 1 },
    lastPracticeDate: "2026-03-21",
    engagementConsistency: 71,
    observationDepth: 10,
    territoryContext: { marketTrend: "flat", accessComplexity: 2, payerPressure: 2, accountComplexity: 3 },
  },
  {
    id: "rep-10",
    name: "Ethan Clarke",
    specialty: "Gastroenterology",
    territory: "Southwest",
    status: "active",
    sessionsCompleted30d: 12,
    coachingModulesCompleted: 6,
    practiceStreakDays: 7,
    salesPerformance: 4.0,
    salesTrend: "up",
    behavioralMetrics: {
      signalAwareness: { score: 4.0, trend: "up", sessionsObserved: 13 },
      signalInterpretation: { score: 3.9, trend: "up", sessionsObserved: 13 },
      adaptability: { score: 3.8, trend: "up", sessionsObserved: 12 },
      objectionHandling: { score: 3.7, trend: "flat", sessionsObserved: 12 },
      valueCommunication: { score: 4.1, trend: "up", sessionsObserved: 13 },
      commitmentGeneration: { score: 3.5, trend: "flat", sessionsObserved: 11 },
      emotionalAttunement: { score: 3.9, trend: "up", sessionsObserved: 12 },
      conversationControl: { score: 4.2, trend: "up", sessionsObserved: 12 },
    },
    recentCoachingActivity: { coachingSessions30d: 3, managerReviews30d: 2, lastCoachingDate: "2026-03-18" },
    scenarioMix: { liveCall: 4, roleplay: 3, objectionDrill: 2, accessScenario: 3 },
    trainingTypeMix: { video: 2, workshop: 1, simulation: 2, peerPractice: 1 },
    lastPracticeDate: "2026-03-22",
    engagementConsistency: 79,
    observationDepth: 13,
    territoryContext: { marketTrend: "flat", accessComplexity: 4, payerPressure: 3, accountComplexity: 4 },
  },
  {
    id: "rep-11",
    name: "Jasmine Rivera",
    specialty: "Women’s Health",
    territory: "West Coast",
    status: "active",
    sessionsCompleted30d: 15,
    coachingModulesCompleted: 7,
    practiceStreakDays: 10,
    salesPerformance: 4.4,
    salesTrend: "up",
    behavioralMetrics: {
      signalAwareness: { score: 4.3, trend: "up", sessionsObserved: 16 },
      signalInterpretation: { score: 4.4, trend: "up", sessionsObserved: 16 },
      adaptability: { score: 4.2, trend: "up", sessionsObserved: 15 },
      objectionHandling: { score: 4.0, trend: "up", sessionsObserved: 15 },
      valueCommunication: { score: 4.1, trend: "up", sessionsObserved: 16 },
      commitmentGeneration: { score: 3.9, trend: "up", sessionsObserved: 14 },
      emotionalAttunement: { score: 4.5, trend: "up", sessionsObserved: 15 },
      conversationControl: { score: 4.2, trend: "up", sessionsObserved: 15 },
    },
    recentCoachingActivity: { coachingSessions30d: 4, managerReviews30d: 3, lastCoachingDate: "2026-03-20" },
    scenarioMix: { liveCall: 5, roleplay: 4, objectionDrill: 2, accessScenario: 4 },
    trainingTypeMix: { video: 2, workshop: 2, simulation: 2, peerPractice: 1 },
    lastPracticeDate: "2026-03-22",
    engagementConsistency: 90,
    observationDepth: 16,
    territoryContext: { marketTrend: "up", accessComplexity: 3, payerPressure: 2, accountComplexity: 4 },
  },
  {
    id: "rep-12",
    name: "Noah Kim",
    specialty: "Urology",
    territory: "Mid-Atlantic",
    status: "needs_attention",
    sessionsCompleted30d: 5,
    coachingModulesCompleted: 3,
    practiceStreakDays: 2,
    salesPerformance: 3.1,
    salesTrend: "down",
    behavioralMetrics: {
      signalAwareness: { score: 3.0, trend: "down", sessionsObserved: 6 },
      signalInterpretation: { score: 3.2, trend: "flat", sessionsObserved: 6 },
      adaptability: { score: 3.1, trend: "flat", sessionsObserved: 5 },
      objectionHandling: { score: 3.4, trend: "flat", sessionsObserved: 5 },
      valueCommunication: { score: 3.3, trend: "flat", sessionsObserved: 6 },
      commitmentGeneration: { score: 2.8, trend: "down", sessionsObserved: 5 },
      emotionalAttunement: { score: 3.5, trend: "up", sessionsObserved: 6 },
      conversationControl: { score: 3.0, trend: "down", sessionsObserved: 5 },
    },
    recentCoachingActivity: { coachingSessions30d: 2, managerReviews30d: 1, lastCoachingDate: "2026-03-11" },
    scenarioMix: { liveCall: 1, roleplay: 2, objectionDrill: 1, accessScenario: 1 },
    trainingTypeMix: { video: 1, workshop: 1, simulation: 1, peerPractice: 0 },
    lastPracticeDate: "2026-03-16",
    engagementConsistency: 44,
    observationDepth: 6,
    territoryContext: { marketTrend: "down", accessComplexity: 4, payerPressure: 4, accountComplexity: 3 },
  },
  {
    id: "rep-13",
    name: "Grace O'Malley",
    specialty: "Rheumatology",
    territory: "Great Lakes",
    status: "active",
    sessionsCompleted30d: 8,
    coachingModulesCompleted: 4,
    practiceStreakDays: 4,
    salesPerformance: 3.6,
    salesTrend: "flat",
    behavioralMetrics: {
      signalAwareness: { score: 3.5, trend: "flat", sessionsObserved: 9 },
      signalInterpretation: { score: 3.7, trend: "up", sessionsObserved: 9 },
      adaptability: { score: 3.3, trend: "flat", sessionsObserved: 8 },
      objectionHandling: { score: 3.2, trend: "flat", sessionsObserved: 8 },
      valueCommunication: { score: 3.8, trend: "up", sessionsObserved: 9 },
      commitmentGeneration: { score: 3.1, trend: "flat", sessionsObserved: 8 },
      emotionalAttunement: { score: 3.9, trend: "up", sessionsObserved: 9 },
      conversationControl: { score: 3.6, trend: "flat", sessionsObserved: 8 },
    },
    recentCoachingActivity: { coachingSessions30d: 2, managerReviews30d: 1, lastCoachingDate: "2026-03-15" },
    scenarioMix: { liveCall: 2, roleplay: 3, objectionDrill: 1, accessScenario: 2 },
    trainingTypeMix: { video: 1, workshop: 1, simulation: 1, peerPractice: 1 },
    lastPracticeDate: "2026-03-20",
    engagementConsistency: 63,
    observationDepth: 9,
    territoryContext: { marketTrend: "flat", accessComplexity: 3, payerPressure: 3, accountComplexity: 3 },
  },
  {
    id: "rep-14",
    name: "Tyler Benson",
    specialty: "Primary Care",
    territory: "Mountain West",
    status: "active",
    sessionsCompleted30d: 7,
    coachingModulesCompleted: 4,
    practiceStreakDays: 3,
    salesPerformance: 3.5,
    salesTrend: "flat",
    behavioralMetrics: {
      signalAwareness: { score: 3.6, trend: "flat", sessionsObserved: 8 },
      signalInterpretation: { score: 3.4, trend: "flat", sessionsObserved: 8 },
      adaptability: { score: 3.5, trend: "up", sessionsObserved: 7 },
      objectionHandling: { score: 3.3, trend: "flat", sessionsObserved: 7 },
      valueCommunication: { score: 3.7, trend: "up", sessionsObserved: 8 },
      commitmentGeneration: { score: 3.2, trend: "flat", sessionsObserved: 7 },
      emotionalAttunement: { score: 3.8, trend: "up", sessionsObserved: 8 },
      conversationControl: { score: 3.4, trend: "flat", sessionsObserved: 7 },
    },
    recentCoachingActivity: { coachingSessions30d: 2, managerReviews30d: 1, lastCoachingDate: "2026-03-14" },
    scenarioMix: { liveCall: 2, roleplay: 2, objectionDrill: 1, accessScenario: 2 },
    trainingTypeMix: { video: 1, workshop: 1, simulation: 1, peerPractice: 1 },
    lastPracticeDate: "2026-03-19",
    engagementConsistency: 58,
    observationDepth: 8,
    territoryContext: { marketTrend: "flat", accessComplexity: 3, payerPressure: 3, accountComplexity: 4 },
  },
];

const rawReps = /** @type {RepData[]} */ (rawRepSeed.map((rep) => finalizeRep(/** @type {any} */ (rep))));

/** @param {RepData[]} reps */
export function validateManagerDataset(reps) {
  const issues = [];

  reps.forEach((rep) => {
    const extremes = getCapabilityExtremes(rep.behavioralMetrics);
    if (rep.strongestCapability !== extremes.strongest) {
      issues.push(`${rep.name}: strongestCapability mismatch`);
    }
    if (rep.improvementPriority !== extremes.improvement) {
      issues.push(`${rep.name}: improvementPriority mismatch`);
    }
    if (BEHAVIORAL_METRIC_KEYS.some((key) => typeof rep.behavioralMetrics[key]?.score !== "number")) {
      issues.push(`${rep.name}: incomplete 8-metric profile`);
    }
  });

  return {
    isValid: issues.length === 0,
    issues,
  };
}

export const MANAGER_REP_DATASET = rawReps;
export const MANAGER_DERIVED_BY_REP_ID = Object.fromEntries(rawReps.map((rep) => [rep.id, deriveRepMetrics(rep)]));
export const MANAGER_TERRITORY_DATASET = buildTerritoryDataset(rawReps);
export const NATIONAL_TERRITORY_DATA = {
  ...buildTerritoryDataset(rawReps.map((rep) => ({ ...rep, territory: "National" })))[0],
  territory: "National Team Aggregate",
};
export const MANAGER_DATASET_VALIDATION = validateManagerDataset(rawReps);

export function getManagerViewDataset() {
  return {
    reps: MANAGER_REP_DATASET,
    derivedByRepId: MANAGER_DERIVED_BY_REP_ID,
    territories: MANAGER_TERRITORY_DATASET,
    nationalTerritory: NATIONAL_TERRITORY_DATA,
    validation: MANAGER_DATASET_VALIDATION,
  };
}

/** @param {BehavioralMetricKey} key */
export function getBehavioralMetricLabel(key) {
  return METRIC_LABELS[key] ?? key;
}

/** @param {RepData} rep */
export function getRepEvidenceSummary(rep) {
  return {
    sessionsCompleted30d: rep.sessionsCompleted30d,
    coachingModulesCompleted: rep.coachingModulesCompleted,
    practiceStreakDays: rep.practiceStreakDays,
    recentCoachingActivity: rep.recentCoachingActivity,
    scenarioMix: rep.scenarioMix,
    trainingTypeMix: rep.trainingTypeMix,
    lastPracticeDate: rep.lastPracticeDate,
    observationDepth: rep.observationDepth,
  };
}

/**
 * @param {RepData | null} rep
 * @param {TerritoryData} territoryData
 */
export function buildManagerInsightsRequest(rep, territoryData, derivedMetrics = undefined) {
  return {
    repId: rep?.id,
    territoryId: territoryData.territory,
    repData: rep ? { ...rep, evidence: getRepEvidenceSummary(rep) } : undefined,
    territoryData,
    derivedMetrics: rep ? (derivedMetrics ?? MANAGER_DERIVED_BY_REP_ID[rep.id]) : undefined,
    timeframe: "30d",
  };
}
