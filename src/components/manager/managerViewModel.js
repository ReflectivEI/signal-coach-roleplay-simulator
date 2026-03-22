// @ts-check

import {
  BEHAVIORAL_METRIC_KEYS,
  MANAGER_REP_DATASET,
  deriveRepMetrics,
  buildTerritoryDataset,
  buildCanonicalTerritoryMetrics,
  evaluateRepRiskFlags,
  evaluateTerritoryRiskFlags,
  getBehavioralMetricLabel,
  MANAGER_MODEL_THRESHOLDS,
  validateManagerDataset,
} from "./managerPerformanceData.js";

const METRIC_DIRECTIONS = [
  "up",
  "flat",
  "up",
  "flat",
  "down",
  "up",
  "flat",
  "down",
  "up",
  "flat",
  "up",
  "down",
  "flat",
  "up",
];

const DEMO_REFERENCE_DATE = "2026-03-22T09:00:00.000Z";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function shiftDate(isoDate, days) {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getTrendForDelta(delta) {
  if (delta >= 1) return "up";
  if (delta <= -1) return "down";
  return "flat";
}

function calculateMetricAverage(behavioralMetrics) {
  return round(
    BEHAVIORAL_METRIC_KEYS.reduce((sum, key) => sum + behavioralMetrics[key].score, 0) / BEHAVIORAL_METRIC_KEYS.length,
    2,
  );
}

function toScalePercent(score) {
  return round((score / 5) * 100, 1);
}

function formatScoreWithPercent(score) {
  return `${score}/5 (${toScalePercent(score)}% of 5-point scale)`;
}

function buildMetricExplanation({
  label,
  definition,
  formula,
  inputs,
  output,
  notes = undefined,
  dataSource = "Manager View deterministic demo dataset",
  timeWindow = "Last 30 days",
  thresholds = [],
}) {
  return {
    label,
    definition,
    formula,
    inputs,
    output,
    notes,
    dataSource,
    timeWindow,
    thresholds,
  };
}

function buildNationalTerritory(reps) {
  const aggregate = buildTerritoryDataset(reps.map((rep) => ({ ...rep, territory: "National Team Aggregate" })))[0];
  return {
    ...aggregate,
    territory: "National Team Aggregate",
  };
}

function buildVariantRep(rep, version) {
  if (!version) {
    return {
      ...rep,
      behavioralMetrics: Object.fromEntries(
        BEHAVIORAL_METRIC_KEYS.map((key) => [key, { ...rep.behavioralMetrics[key] }]),
      ),
      recentCoachingActivity: { ...rep.recentCoachingActivity },
      scenarioMix: { ...rep.scenarioMix },
      trainingTypeMix: { ...rep.trainingTypeMix },
      territoryContext: { ...rep.territoryContext },
    };
  }

  const offset = ((version + Number(rep.id.replace("rep-", ""))) % 3) - 1;
  const metricBias = METRIC_DIRECTIONS[(version + Number(rep.id.replace("rep-", ""))) % METRIC_DIRECTIONS.length] === "up" ? 1 : -1;

  const behavioralMetrics = Object.fromEntries(
    BEHAVIORAL_METRIC_KEYS.map((key, index) => {
      const metric = rep.behavioralMetrics[key];
      const directionalDelta = ((version + index + Number(rep.id.replace("rep-", ""))) % 4 === 0 ? 0.1 : 0) * metricBias;
      const score = round(clamp(metric.score + (offset * 0.1) + directionalDelta, 2.4, 4.8), 1);
      const sessionsObserved = clamp(metric.sessionsObserved + offset + (index % 2 === 0 ? version % 2 : 0), 1, 20);
      return [
        key,
        {
          score,
          trend: getTrendForDelta(offset + (directionalDelta > 0 ? 1 : directionalDelta < 0 ? -1 : 0)),
          sessionsObserved,
        },
      ];
    }),
  );

  return {
    ...rep,
    sessionsCompleted30d: clamp(rep.sessionsCompleted30d + offset, 1, 16),
    coachingModulesCompleted: clamp(rep.coachingModulesCompleted + (offset > 0 ? 1 : 0), 1, 8),
    practiceStreakDays: clamp(rep.practiceStreakDays + offset, 0, 14),
    salesPerformance: round(clamp(rep.salesPerformance + (offset * 0.1), 2.6, 4.7), 1),
    salesTrend: getTrendForDelta(offset),
    behavioralMetrics,
    recentCoachingActivity: {
      ...rep.recentCoachingActivity,
      coachingSessions30d: clamp(rep.recentCoachingActivity.coachingSessions30d + (offset > 0 ? 1 : 0), 1, 4),
      managerReviews30d: clamp(rep.recentCoachingActivity.managerReviews30d + (offset < 0 ? 0 : 1), 0, 4),
      lastCoachingDate: shiftDate(rep.recentCoachingActivity.lastCoachingDate, offset),
    },
    scenarioMix: { ...rep.scenarioMix },
    trainingTypeMix: { ...rep.trainingTypeMix },
    lastPracticeDate: shiftDate(rep.lastPracticeDate, offset),
    engagementConsistency: clamp(rep.engagementConsistency + (offset * 4), 18, 94),
    observationDepth: clamp(rep.observationDepth + offset, 3, 18),
    territoryContext: { ...rep.territoryContext },
  };
}

function finalizeRepVariant(rep) {
  const metricAverage = calculateMetricAverage(rep.behavioralMetrics);
  const strongestCapability = BEHAVIORAL_METRIC_KEYS.reduce((best, key) => (
    rep.behavioralMetrics[key].score > rep.behavioralMetrics[best].score ? key : best
  ), BEHAVIORAL_METRIC_KEYS[0]);
  const improvementPriority = BEHAVIORAL_METRIC_KEYS.reduce((worst, key) => (
    rep.behavioralMetrics[key].score < rep.behavioralMetrics[worst].score ? key : worst
  ), BEHAVIORAL_METRIC_KEYS[0]);

  return {
    ...rep,
    strongestCapability,
    improvementPriority,
    overallScore: round((metricAverage * 0.65) + (rep.salesPerformance * 0.35), 1),
  };
}

function rebalanceImprovementPriorityAcrossDataset(reps) {
  if (!reps.length) return reps;
  const perCapabilityCap = Math.max(1, Math.floor(reps.length * 0.3));
  const counts = Object.fromEntries(BEHAVIORAL_METRIC_KEYS.map((key) => [key, 0]));

  const rankedReps = reps
    .map((rep) => {
      const rankedWeaknesses = BEHAVIORAL_METRIC_KEYS
        .map((key) => ({ key, score: rep.behavioralMetrics[key].score }))
        .sort((a, b) => a.score - b.score);
      return {
        rep,
        rankedWeaknesses,
        floor: rankedWeaknesses[0]?.score ?? 5,
      };
    })
    .sort((a, b) => (a.floor - b.floor) || a.rep.name.localeCompare(b.rep.name));

  const assignments = new Map();
  rankedReps.forEach(({ rep, rankedWeaknesses, floor }) => {
    const deltas = [0, 0.15, 0.3, 0.45];
    let selected = rankedWeaknesses[0]?.key ?? rep.improvementPriority;

    for (const delta of deltas) {
      const eligible = rankedWeaknesses.filter((item) => item.score <= floor + delta);
      const underCap = eligible.filter((item) => counts[item.key] < perCapabilityCap);
      if (underCap.length) {
        selected = underCap
          .slice()
          .sort((a, b) => (counts[a.key] - counts[b.key]) || (a.score - b.score))[0].key;
        break;
      }
    }

    assignments.set(rep.id, selected);
    counts[selected] += 1;
  });

  return reps.map((rep) => ({ ...rep, improvementPriority: assignments.get(rep.id) ?? rep.improvementPriority }));
}

function summarizeTerritoryWeighting(territory, reps) {
  return territory.repIds
    .map((repId) => {
      const rep = reps.find((item) => item.id === repId);
      return rep ? `${rep.name.split(" ")[0]} ${Math.round((territory.aggregationWeights[rep.id] || 0) * 100)}%` : null;
    })
    .filter(Boolean)
    .join(", ");
}

function buildOverviewMetrics(reps, derivedByRepId) {
  const totalSessions = reps.reduce((sum, rep) => sum + rep.sessionsCompleted30d, 0);
  const activeRepCount = reps.filter((rep) => rep.status === "active").length;
  const avgTeamScore = round(reps.reduce((sum, rep) => sum + rep.overallScore, 0) / reps.length, 1);
  const attentionCount = reps.filter((rep) => rep.status !== "active").length;
  const adoptionHealth = Math.round((reps.filter((rep) => rep.sessionsCompleted30d >= 8).length / reps.length) * 100);
  const moduleCompletion = Math.round((reps.reduce((sum, rep) => sum + (rep.coachingModulesCompleted / 8), 0) / reps.length) * 100);
  const interventionQueue = reps.filter((rep) => rep.status !== "active" || derivedByRepId[rep.id].salesRiskScore >= 55 || rep.overallScore < 3.4);
  const territoryAverage = round(reps.reduce((sum, rep) => sum + rep.salesPerformance, 0) / reps.length, 2);

  return {
    repCount: reps.length,
    activeRepCount,
    totalSessions,
    avgTeamScore,
    attentionCount,
    adoptionHealth,
    moduleCompletion,
    interventionQueue,
    territoryAverage,
  };
}

function buildOverviewExplanations(overviewMetrics) {
  const interventionThreshold = "status != active OR salesRiskScore >= 55 OR overallScore < 3.4";

  return {
    adoptionHealth: buildMetricExplanation({
      label: "Adoption Health",
      definition: "Share of reps completing at least eight sessions in the current 30-day demo scope.",
      formula: "(reps with at least 8 sessions in the last 30 days / total reps) x 100",
      inputs: {
        repsMeetingThreshold: overviewMetrics.repCount ? Math.round((overviewMetrics.adoptionHealth / 100) * overviewMetrics.repCount) : 0,
        totalReps: overviewMetrics.repCount,
      },
      output: `${overviewMetrics.adoptionHealth}%`,
      notes: "Current Manager View demo logic uses the 14-rep active dataset only.",
    }),
    moduleCompletion: buildMetricExplanation({
      label: "Module Completion",
      definition: "Average completion percentage across the eight-module coaching path for all active demo reps.",
      formula: "average(module completion across the 8-module coaching path) x 100",
      inputs: {
        totalRepCount: overviewMetrics.repCount,
        modulePathSize: 8,
      },
      output: `${overviewMetrics.moduleCompletion}%`,
    }),
    interventionQueue: buildMetricExplanation({
      label: "Intervention Queue",
      definition: "Number of reps meeting the active intervention rule set in the current dataset.",
      formula: "count(reps with inactive or needs-attention status, or sales risk at or above 55, or overall score below 3.4)",
      inputs: {
        thresholdRule: interventionThreshold,
        queueSize: overviewMetrics.interventionQueue.length,
      },
      output: overviewMetrics.interventionQueue.length,
    }),
    avgTeamScore: buildMetricExplanation({
      label: "Team Average Score",
      definition: "Average of rep overall scores for the active 14-rep Manager View dataset.",
      formula: "average(rep overallScore)",
      inputs: { repCount: overviewMetrics.repCount },
      output: `${overviewMetrics.avgTeamScore}/5`,
      dataSource: "Rep overall score cards across the active Manager View dataset",
      timeWindow: "Last 30 days",
    }),
    territoryAverage: buildMetricExplanation({
      label: "Average Sales Outcome Score",
      definition: "Average sales outcome score across all reps in the current Manager View dataset.",
      formula: "average(rep salesOutcomeScore)",
      inputs: { repCount: overviewMetrics.repCount },
      output: `${overviewMetrics.territoryAverage}/5`,
      notes: `Sales outcome score is the existing rep salesPerformance field displayed with manager-friendly language only. ${overviewMetrics.territoryAverage}/5 equals ${toScalePercent(overviewMetrics.territoryAverage)}% of the 5-point scale.`,
    }),
    needsAttention: buildMetricExplanation({
      label: "Needs Attention",
      definition: "Count of reps with status set to needs_attention or inactive in the current dataset.",
      formula: "count(reps with inactive or needs-attention status)",
      inputs: {
        activeReps: overviewMetrics.activeRepCount,
        totalReps: overviewMetrics.repCount,
      },
      output: overviewMetrics.attentionCount,
    }),
  };
}

function buildRepExplanations(rep, derivedByRepId) {
  const derived = derivedByRepId[rep.id];
  const averageBehavior = calculateMetricAverage(rep.behavioralMetrics);
  const sessionsScore = round(clamp((rep.sessionsCompleted30d / 16) * 100, 0, 100), 1);
  const modulesScore = round(clamp((rep.coachingModulesCompleted / 8) * 100, 0, 100), 1);
  const streakScore = round(clamp((rep.practiceStreakDays / 14) * 100, 0, 100), 1);
  const coachingFrequencyBonus = round(clamp(rep.recentCoachingActivity.coachingSessions30d / 4, 0, 1) * 10, 1);
  const metricCoverageRatio = round(BEHAVIORAL_METRIC_KEYS.filter((key) => rep.behavioralMetrics[key].sessionsObserved > 0).length / BEHAVIORAL_METRIC_KEYS.length, 2);
  const avgObservedSessions = round(BEHAVIORAL_METRIC_KEYS.reduce((sum, key) => sum + rep.behavioralMetrics[key].sessionsObserved, 0) / BEHAVIORAL_METRIC_KEYS.length, 2);
  const sampleSizeRatio = round(clamp(((avgObservedSessions / 14) * 0.6) + ((rep.sessionsCompleted30d / 16) * 0.4), 0, 1), 2);
  const variancePenaltyRatio = round(clamp(1 - (derived.behavioralVariance / 2.5), 0, 1), 2);
  const confidencePercent = Math.round(derived.confidenceScore * 100);

  return {
    overallScore: buildMetricExplanation({
      label: "Overall Score",
      definition: "Weighted summary of the canonical behavioral profile and the derived sales outcome score.",
      formula: "(average of 8 behavioral metrics x 0.65) + (sales outcome score x 0.35)",
      inputs: {
        "Average of 8 Behavioral Metrics": formatScoreWithPercent(averageBehavior),
        "Sales Outcome Score": formatScoreWithPercent(rep.salesPerformance),
      },
      output: `${rep.overallScore}/5`,
      notes: `The behavioral portion uses the eight canonical Signal Intelligence capabilities only. ${rep.overallScore}/5 equals ${toScalePercent(rep.overallScore)}% of the 5-point scale.`,
      thresholds: [
        "Priority queue review starts below 3.4/5 overall score (rule-based manager configuration).",
      ],
    }),
    moduleCompletion: buildMetricExplanation({
      label: "Module Completion",
      definition: "Completion percentage of the standard eight-module coaching path.",
      formula: "(completed modules / 8 total modules) x 100",
      inputs: {
        coachingModulesCompleted: rep.coachingModulesCompleted,
        modulePathSize: 8,
      },
      output: `${Math.round((rep.coachingModulesCompleted / 8) * 100)}%`,
    }),
    engagementScore: buildMetricExplanation({
      label: "Learning Engagement Score",
      definition: "Derived activity score showing how consistently the rep is engaging with coaching and practice over the last 30 days.",
      formula: "(session volume score x 0.34) + (module completion score x 0.22) + (practice streak score x 0.18) + (engagement consistency x 0.16) + coaching cadence bonus",
      inputs: {
        "Session volume score": sessionsScore,
        "Module completion score": modulesScore,
        "Practice streak score": streakScore,
        "Engagement consistency": rep.engagementConsistency,
        "Coaching cadence bonus": coachingFrequencyBonus,
      },
      output: `${derived.engagementScore}/100`,
      thresholds: [
        `${MANAGER_MODEL_THRESHOLDS.engagementRisk}/100 = monitoring threshold from rule-based manager configuration.`,
      ],
    }),
    engagementStabilityScore: buildMetricExplanation({
      label: "Engagement Stability",
      definition: "Consistency score combining engagement consistency, behavioral variance, and data recency.",
      formula: "(engagement consistency x 0.7) + ((1 - behavioral variance / 2.5) x 20) + recent practice bonus",
      inputs: {
        engagementConsistency: rep.engagementConsistency,
        behavioralVariance: derived.behavioralVariance,
        lastPracticeDate: rep.lastPracticeDate,
      },
      output: `${derived.engagementStabilityScore}/100`,
    }),
    readinessScore: buildMetricExplanation({
      label: "Readiness Score",
      definition: "Weighted readiness estimate combining behavioral execution, sales outcome score, and learning engagement quality.",
      formula: "(average of 8 behavioral metrics x 20 x 0.45) + (sales outcome score x 20 x 0.35) + (learning engagement score x 0.2)",
      inputs: {
        "Average of 8 Behavioral Metrics": formatScoreWithPercent(averageBehavior),
        "Sales Outcome Score": formatScoreWithPercent(rep.salesPerformance),
        "Learning Engagement Score": `${derived.engagementScore}/100`,
      },
      output: `${derived.readinessScore}/100`,
    }),
    conversionProxyScore: buildMetricExplanation({
      label: "Conversion Proxy",
      definition: "Weighted proxy for moving a conversation to the next step based on Commitment Generation and Value Connection.",
      formula: "(Commitment Generation x 20 x 0.55) + (Value Connection x 20 x 0.45)",
      inputs: {
        commitmentGeneration: rep.behavioralMetrics.commitmentGeneration.score,
        valueConnection: rep.behavioralMetrics.valueCommunication.score,
      },
      output: `${derived.conversionProxyScore}/100`,
    }),
    salesRiskScore: buildMetricExplanation({
      label: "Sales Risk",
      definition: "Derived risk score combining sales outcome score, the average of 8 behavioral metrics, learning engagement, trend, status, and commitment generation threshold checks.",
      formula: "58 - (sales outcome score x 9) - (average of 8 behavioral metrics x 6) - (learning engagement score x 0.16) + trend adjustment + status weight + commitment penalty",
      inputs: {
        "Sales Outcome Score": formatScoreWithPercent(rep.salesPerformance),
        "Average of 8 Behavioral Metrics": formatScoreWithPercent(averageBehavior),
        "Learning Engagement Score": `${derived.engagementScore}/100`,
        "Sales trend": rep.salesTrend,
        Status: rep.status,
        "Commitment Generation": `${rep.behavioralMetrics.commitmentGeneration.score}/5`,
      },
      output: `${derived.salesRiskScore}/100`,
      thresholds: [
        `${MANAGER_MODEL_THRESHOLDS.salesRiskHigh}/100 = high-risk threshold from rule-based manager configuration.`,
      ],
    }),
    dataConfidenceIndex: buildMetricExplanation({
      label: "Data Confidence Index",
      definition: "Reliability of the underlying rep dataset before predictive interpretation is applied.",
      formula: "(metric coverage x 0.28) + (sample size x 0.24) + (recency x 0.18) + (engagement stability x 0.18) + (observation depth x 0.12)",
      inputs: {
        metricCoverageRatio,
        sampleSizeRatio,
        observationDepthRatio: round(clamp(rep.observationDepth / 18, 0, 1), 2),
        engagementStabilityRatio: round(derived.engagementStabilityScore / 100, 2),
      },
      output: `${Math.round(derived.dataConfidenceIndex * 100)}%`,
    }),
    confidenceScore: buildMetricExplanation({
      label: "Predictive Confidence",
      definition: "Predictive confidence derived from auditable inputs only: data confidence, variance, trend stability, engagement stability, coaching responsiveness, and conversion proxy.",
      formula: "(data confidence x 0.34) + (variance penalty x 0.14) + (trend stability x 0.12) + (metric coverage x 0.10) + (engagement stability x 0.12) + (coaching responsiveness x 0.10) + (conversion proxy x 0.08)",
      inputs: {
        dataConfidenceIndex: round(derived.dataConfidenceIndex, 2),
        metricCoverageRatio,
        sampleSizeRatio,
        variancePenaltyRatio,
        engagementStabilityScore: derived.engagementStabilityScore,
        coachingResponsivenessScore: derived.coachingResponsivenessScore ?? "not enough coaching observations",
        conversionProxyScore: derived.conversionProxyScore,
      },
      output: `${confidencePercent}%`,
      notes: `High confidence is monitored at ${Math.round(MANAGER_MODEL_THRESHOLDS.confidenceHigh * 100)}% or above. This is a reliability signal, not the percent conversion of a 5-point performance score.`,
    }),
    strongestCapability: buildMetricExplanation({
      label: "Strongest Capability",
      definition: "Highest scoring capability in the current 8-metric profile.",
      formula: "highest score across the 8 canonical behavioral metrics",
      inputs: { capability: getBehavioralMetricLabel(rep.strongestCapability), score: rep.behavioralMetrics[rep.strongestCapability].score },
      output: `${getBehavioralMetricLabel(rep.strongestCapability)} (${rep.behavioralMetrics[rep.strongestCapability].score}/5)`,
    }),
    improvementPriority: buildMetricExplanation({
      label: "Capability Requiring Improvement",
      definition: "Selected from the rep's lowest-scoring capability band so managers see the most actionable gap without over-clustering the team on one capability.",
      formula: "choose the lowest-scoring capability; if multiple capabilities are within 0.3 points of the minimum, select the lowest-scoring option that keeps no capability above 30% of reps",
      inputs: {
        "Assigned capability": getBehavioralMetricLabel(rep.improvementPriority),
        "Assigned capability score": `${rep.behavioralMetrics[rep.improvementPriority].score}/5`,
        "Minimum acceptable capability score": `${MANAGER_MODEL_THRESHOLDS.repMetricLow}/5`,
      },
      output: `${getBehavioralMetricLabel(rep.improvementPriority)} (${rep.behavioralMetrics[rep.improvementPriority].score}/5)`,
      thresholds: [
        `${MANAGER_MODEL_THRESHOLDS.repMetricLow}/5 = capability baseline used in deterministic risk flags.`,
        "No capability is assigned to more than 30% of reps unless no near-tied alternative exists.",
      ],
    }),
  };
}

function buildTerritoryContributors(territory, reps, derivedByRepId) {
  const territoryReps = reps.filter((rep) => territory.repIds.includes(rep.id));
  const gapMetric = territory.mostCommonCapabilityGap;
  const gapContributors = gapMetric
    ? territoryReps
      .slice()
      .sort((a, b) => a.behavioralMetrics[gapMetric].score - b.behavioralMetrics[gapMetric].score)
      .slice(0, 4)
      .map((rep) => ({
        repId: rep.id,
        name: rep.name,
        metricLabel: getBehavioralMetricLabel(gapMetric),
        metricValue: rep.behavioralMetrics[gapMetric].score,
        weight: territory.aggregationWeights[rep.id],
        why: `${rep.name} is below the weighted territory average in ${getBehavioralMetricLabel(gapMetric)} at ${rep.behavioralMetrics[gapMetric].score}/5 and contributes ${Math.round((territory.aggregationWeights[rep.id] || 0) * 100)}% of the territory weighting.`,
      }))
    : [];

  const engagementContributors = territoryReps
    .slice()
    .sort((a, b) => derivedByRepId[a.id].engagementScore - derivedByRepId[b.id].engagementScore)
    .slice(0, 4)
    .map((rep) => ({
      repId: rep.id,
      name: rep.name,
      metricLabel: "Learning Engagement Score",
      metricValue: derivedByRepId[rep.id].engagementScore,
      weight: territory.aggregationWeights[rep.id],
      why: `${rep.name} is lowering the weighted territory learning engagement average at ${derivedByRepId[rep.id].engagementScore}/100 and contributes ${Math.round((territory.aggregationWeights[rep.id] || 0) * 100)}% of the territory weighting.`,
    }));

  const volatilityContributors = territoryReps
    .slice()
    .map((rep) => ({
      rep,
      delta: Math.abs(rep.salesPerformance - territory.avgPerformance),
    }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 4)
    .map(({ rep, delta }) => ({
      repId: rep.id,
      name: rep.name,
      metricLabel: "Sales Outcome Score Delta",
      metricValue: round(delta, 2),
      weight: territory.aggregationWeights[rep.id],
      why: `${rep.name} is ${round(delta, 2)} points away from the weighted territory average sales outcome score of ${territory.avgPerformance}/5 and contributes ${Math.round((territory.aggregationWeights[rep.id] || 0) * 100)}% of the territory weighting.`,
    }));

  return {
    gapContributors,
    engagementContributors,
    volatilityContributors,
  };
}

function buildTerritoryExplanations(territory, reps, derivedByRepId) {
  const territoryReps = reps.filter((rep) => territory.repIds.includes(rep.id));
  const contributors = buildTerritoryContributors(territory, reps, derivedByRepId);
  return {
    avgPerformance: buildMetricExplanation({
      label: `${territory.territory} Average Sales Outcome Score`,
      definition: "Weighted average sales outcome score for reps included in this territory aggregate.",
      formula: "weighted average(rep sales outcome score, weight = 70% recent session volume + 30% recency of practice)",
      inputs: {
        "Included reps": territoryReps.length,
        "Contribution weighting": summarizeTerritoryWeighting(territory, reps),
      },
      output: `${territory.avgPerformance}/5`,
      notes: "Each rep's contribution weight is based on recent activity and practice recency, then normalized to 100% within the territory.",
    }),
    avgEngagement: buildMetricExplanation({
      label: `${territory.territory} Learning Engagement`,
      definition: "Weighted average learning engagement score for reps in this territory aggregate.",
      formula: "weighted average(rep learning engagement score, weight = 70% recent session volume + 30% recency of practice)",
      inputs: {
        "Included reps": territoryReps.length,
        "Contribution weighting": summarizeTerritoryWeighting(territory, reps),
      },
      output: `${territory.avgEngagement}/100`,
      thresholds: [
        `${MANAGER_MODEL_THRESHOLDS.territoryEngagementRisk}/100 = territory risk threshold from rule-based manager configuration.`,
        `${MANAGER_MODEL_THRESHOLDS.territoryEngagementModerate}/100 = watch threshold from rule-based manager configuration.`,
      ],
    }),
    territoryVolatility: buildMetricExplanation({
      label: `${territory.territory} Volatility`,
      definition: "Weighted average absolute distance between each rep's sales outcome score and the territory average.",
      formula: "weighted average(abs(rep sales outcome score - territory average sales outcome score), contribution weight)",
      inputs: {
        "Included reps": territoryReps.length,
        "Territory average sales outcome score": `${territory.avgPerformance}/5`,
      },
      output: territory.territoryVolatility,
      thresholds: [
        `${MANAGER_MODEL_THRESHOLDS.volatilityModerate} = volatility watch threshold from rule-based manager configuration.`,
      ],
    }),
    riskLevel: buildMetricExplanation({
      label: `${territory.territory} Risk Level`,
      definition: "Rule-based territory risk category driven by at-risk reps, weighted performance, and weighted engagement.",
      formula: `high if at-risk reps >= 2 OR average sales outcome score < 3.4 OR learning engagement < ${MANAGER_MODEL_THRESHOLDS.territoryEngagementRisk}; moderate if at-risk reps >= 1 OR average sales outcome score < 3.8 OR learning engagement < ${MANAGER_MODEL_THRESHOLDS.territoryEngagementModerate}; else low`,
      inputs: {
        "At-risk reps": territory.atRiskRepCount,
        "Average sales outcome score": `${territory.avgPerformance}/5`,
        "Learning engagement": `${territory.avgEngagement}/100`,
      },
      output: territory.riskLevel,
      thresholds: [
        "High risk = two or more at-risk reps, or weak average sales outcome score, or weak territory engagement.",
        "Moderate risk = one at-risk rep, or mid-range sales outcome score, or watch-level engagement.",
      ],
    }),
    mostCommonCapabilityGap: territory.mostCommonCapabilityGap
      ? buildMetricExplanation({
        label: `${territory.territory} Capability Gap`,
        definition: "Weighted mode of each rep's improvementPriority in this territory aggregate.",
        formula: "most common rep capability requiring improvement after applying territory contribution weights",
        inputs: {
          "Included reps": territoryReps.length,
          "Lowest contributors": contributors.gapContributors.map((item) => `${item.name} (${Math.round((item.weight || 0) * 100)}%)`).join(", "),
        },
        output: getBehavioralMetricLabel(territory.mostCommonCapabilityGap),
        notes: "This territory gap comes from the balanced rep-level improvement priorities, not from raw debug weighting output.",
      })
      : null,
  };
}

function validateRuntimeState(dataset) {
  const issues = [...dataset.validation.issues];

  dataset.reps.forEach((rep) => {
    const strongestScore = rep.behavioralMetrics[rep.strongestCapability]?.score;
    const weakestScore = rep.behavioralMetrics[rep.improvementPriority]?.score;
    if (strongestScore == null || weakestScore == null) {
      issues.push(`${rep.name}: missing strongest/improvement metric references`);
    }
    if (!dataset.explanations.rep[rep.id]?.overallScore || !dataset.explanations.rep[rep.id]?.engagementScore) {
      issues.push(`${rep.name}: missing metric explanation metadata`);
    }
    const invalidRiskFlag = (dataset.repRiskFlagsByRepId?.[rep.id] || []).find((flag) => {
      if (!flag.triggered) return false;
      if (flag.metricKey && getBehavioralMetricLabel(flag.metricKey) === flag.metricKey) return true;
      return false;
    });
    if (invalidRiskFlag) {
      issues.push(`${rep.name}: non-canonical risk flag label`);
    }
  });

  dataset.territories.forEach((territory) => {
    const territoryReps = dataset.reps.filter((rep) => territory.repIds.includes(rep.id));
    if (territoryReps.length !== territory.repIds.length) {
      issues.push(`${territory.territory}: repIds mismatch`);
    }
    const actualAvgPerformance = round(territoryReps.reduce((sum, rep) => sum + (rep.salesPerformance * territory.aggregationWeights[rep.id]), 0), 2);
    if (actualAvgPerformance !== territory.avgPerformance) {
      issues.push(`${territory.territory}: avgPerformance mismatch`);
    }
    if (!dataset.explanations.territory[territory.territory]?.avgEngagement) {
      issues.push(`${territory.territory}: missing territory explanation metadata`);
    }
    const missingTerritoryTrace = buildCanonicalTerritoryMetrics(territory).some((metric) => typeof metric.score !== "number");
    if (missingTerritoryTrace) {
      issues.push(`${territory.territory}: territory metric traceability failed`);
    }
  });

  return {
    isValid: issues.length === 0,
    issues,
  };
}

export function buildManagerViewState(version = 0) {
  const reps = rebalanceImprovementPriorityAcrossDataset(
    MANAGER_REP_DATASET.map((rep) => finalizeRepVariant(buildVariantRep(rep, version))),
  );
  const derivedByRepId = Object.fromEntries(reps.map((rep) => [rep.id, deriveRepMetrics(rep)]));
  const territories = buildTerritoryDataset(reps);
  const nationalTerritory = buildNationalTerritory(reps);
  const repRiskFlagsByRepId = Object.fromEntries(reps.map((rep) => [rep.id, evaluateRepRiskFlags(rep, derivedByRepId[rep.id]).filter((flag) => flag.triggered)]));
  const territoryRiskFlagsByName = Object.fromEntries(
    [...territories, nationalTerritory].map((territory) => [territory.territory, evaluateTerritoryRiskFlags(/** @type {any} */ (territory))]),
  );
  const overviewMetrics = buildOverviewMetrics(reps, derivedByRepId);
  const explanations = {
    overview: buildOverviewExplanations(overviewMetrics),
    rep: Object.fromEntries(reps.map((rep) => [rep.id, buildRepExplanations(rep, derivedByRepId)])),
    territory: Object.fromEntries(
      [...territories, nationalTerritory].map((territory) => [territory.territory, buildTerritoryExplanations(territory, reps, derivedByRepId)]),
    ),
  };
  const contributors = Object.fromEntries(
    [...territories, nationalTerritory].map((territory) => [territory.territory, buildTerritoryContributors(territory, reps, derivedByRepId)]),
  );
  const validation = validateRuntimeState({
    reps,
    territories,
    nationalTerritory,
    validation: validateManagerDataset(reps),
    explanations,
    repRiskFlagsByRepId,
    territoryRiskFlagsByName,
  });

  return {
    version,
    refreshedAt: new Date(new Date(DEMO_REFERENCE_DATE).getTime() + (version * 60_000)).toISOString(),
    datasetScope: {
      label: "Current Manager View dataset",
      detail: `${reps.length} active demo reps in the current 30-day Manager View scope`,
      repCount: reps.length,
      timeWindow: "30-day current demo scope",
    },
    reps,
    derivedByRepId,
    territories,
    nationalTerritory,
    overviewMetrics,
    explanations,
    contributors,
    repRiskFlagsByRepId,
    territoryRiskFlagsByName,
    validation,
  };
}

export function getMetricExplanation(explanations, section, id, metricKey) {
  return explanations?.[section]?.[id]?.[metricKey] ?? null;
}

export function getContributorSet(contributors, territoryName) {
  return contributors?.[territoryName] ?? { gapContributors: [], engagementContributors: [], volatilityContributors: [] };
}
