// @ts-check

import {
  BEHAVIORAL_METRIC_KEYS,
  MANAGER_REP_DATASET,
  deriveRepMetrics,
  buildTerritoryDataset,
  getBehavioralMetricLabel,
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

function buildMetricExplanation({ label, definition, formula, inputs, output, notes = undefined }) {
  return { label, definition, formula, inputs, output, notes };
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
      formula: "(reps with sessionsCompleted30d >= 8 / total reps) x 100",
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
      formula: "average(coachingModulesCompleted / 8) x 100",
      inputs: {
        totalRepCount: overviewMetrics.repCount,
        modulePathSize: 8,
      },
      output: `${overviewMetrics.moduleCompletion}%`,
    }),
    interventionQueue: buildMetricExplanation({
      label: "Intervention Queue",
      definition: "Number of reps meeting the active intervention rule set in the current dataset.",
      formula: "count(status != active OR salesRiskScore >= 55 OR overallScore < 3.4)",
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
    }),
    territoryAverage: buildMetricExplanation({
      label: "Territory Average",
      definition: "Average sales performance across all reps in the current Manager View dataset.",
      formula: "average(rep salesPerformance)",
      inputs: { repCount: overviewMetrics.repCount },
      output: `${overviewMetrics.territoryAverage}/5`,
    }),
    needsAttention: buildMetricExplanation({
      label: "Needs Attention",
      definition: "Count of reps with status set to needs_attention or inactive in the current dataset.",
      formula: "count(status != active)",
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
  const confidencePercent = Math.round(derived.confidenceScore * 100);

  return {
    overallScore: buildMetricExplanation({
      label: "Overall Score",
      definition: "Weighted summary of behavioral execution and sales performance.",
      formula: "(averageBehavior x 0.65) + (salesPerformance x 0.35)",
      inputs: {
        averageBehavior,
        salesPerformance: rep.salesPerformance,
      },
      output: `${rep.overallScore}/5`,
    }),
    moduleCompletion: buildMetricExplanation({
      label: "Module Completion",
      definition: "Completion percentage of the standard eight-module coaching path.",
      formula: "(coachingModulesCompleted / 8) x 100",
      inputs: {
        coachingModulesCompleted: rep.coachingModulesCompleted,
        modulePathSize: 8,
      },
      output: `${Math.round((rep.coachingModulesCompleted / 8) * 100)}%`,
    }),
    engagementScore: buildMetricExplanation({
      label: "Engagement Score",
      definition: "Weighted activity score combining recent sessions, module completion, practice streak, engagement consistency, and coaching cadence.",
      formula: "(sessionsScore x 0.34) + (modulesScore x 0.22) + (streakScore x 0.18) + (engagementConsistency x 0.16) + coachingFrequencyBonus",
      inputs: {
        sessionsScore,
        modulesScore,
        streakScore,
        engagementConsistency: rep.engagementConsistency,
        coachingFrequencyBonus,
      },
      output: `${derived.engagementScore}/100`,
    }),
    readinessScore: buildMetricExplanation({
      label: "Readiness Score",
      definition: "Weighted readiness estimate combining behavioral execution, sales performance, and engagement quality.",
      formula: "(averageBehavior x 20 x 0.45) + (salesPerformance x 20 x 0.35) + (engagementScore x 0.2)",
      inputs: {
        averageBehavior,
        salesPerformance: rep.salesPerformance,
        engagementScore: derived.engagementScore,
      },
      output: `${derived.readinessScore}/100`,
    }),
    salesRiskScore: buildMetricExplanation({
      label: "Sales Risk",
      definition: "Deterministic risk score combining performance, behavior, engagement, sales trend, and status.",
      formula: "58 - (salesPerformance x 9) - (averageBehavior x 6) - (engagementScore x 0.16) + trendAdjustment + statusWeight",
      inputs: {
        salesPerformance: rep.salesPerformance,
        averageBehavior,
        engagementScore: derived.engagementScore,
        salesTrend: rep.salesTrend,
        status: rep.status,
      },
      output: `${derived.salesRiskScore}/100`,
    }),
    confidenceScore: buildMetricExplanation({
      label: "Confidence",
      definition: "Confidence in the derived signal based on 8-metric completeness, observation depth, and engagement consistency.",
      formula: "(completeness x 0.4) + (observationDepthRatio x 0.35) + (engagementConsistencyRatio x 0.25)",
      inputs: {
        completeMetricCoverage: BEHAVIORAL_METRIC_KEYS.every((key) => rep.behavioralMetrics[key].sessionsObserved > 0) ? 1 : 0.8,
        observationDepthRatio: round(clamp(rep.observationDepth / 18, 0, 1), 2),
        engagementConsistencyRatio: round(clamp(rep.engagementConsistency / 100, 0, 1), 2),
      },
      output: `${confidencePercent}%`,
      notes: "Confidence is rounded for display but preserved as a decimal in the derivation layer.",
    }),
    strongestCapability: buildMetricExplanation({
      label: "Strongest Capability",
      definition: "Highest scoring capability in the current 8-metric profile.",
      formula: "max(behavioralMetrics.score)",
      inputs: { capability: getBehavioralMetricLabel(rep.strongestCapability), score: rep.behavioralMetrics[rep.strongestCapability].score },
      output: `${getBehavioralMetricLabel(rep.strongestCapability)} (${rep.behavioralMetrics[rep.strongestCapability].score}/5)`,
    }),
    improvementPriority: buildMetricExplanation({
      label: "Capability Requiring Improvement",
      definition: "Lowest scoring capability in the current 8-metric profile.",
      formula: "min(behavioralMetrics.score)",
      inputs: { capability: getBehavioralMetricLabel(rep.improvementPriority), score: rep.behavioralMetrics[rep.improvementPriority].score },
      output: `${getBehavioralMetricLabel(rep.improvementPriority)} (${rep.behavioralMetrics[rep.improvementPriority].score}/5)`,
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
        why: `${rep.name} is below the territory average in ${getBehavioralMetricLabel(gapMetric)} at ${rep.behavioralMetrics[gapMetric].score}/5.`,
      }))
    : [];

  const engagementContributors = territoryReps
    .slice()
    .sort((a, b) => derivedByRepId[a.id].engagementScore - derivedByRepId[b.id].engagementScore)
    .slice(0, 4)
    .map((rep) => ({
      repId: rep.id,
      name: rep.name,
      metricLabel: "Engagement Score",
      metricValue: derivedByRepId[rep.id].engagementScore,
      why: `${rep.name} is pulling the territory engagement average down at ${derivedByRepId[rep.id].engagementScore}/100.`,
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
      metricLabel: "Sales Performance Delta",
      metricValue: round(delta, 2),
      why: `${rep.name} sits ${round(delta, 2)} points away from the territory average sales performance of ${territory.avgPerformance}/5.`,
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
      label: `${territory.territory} Average Performance`,
      definition: "Average sales performance for reps included in this territory aggregate.",
      formula: "average(rep salesPerformance)",
      inputs: { repCount: territoryReps.length },
      output: `${territory.avgPerformance}/5`,
    }),
    avgEngagement: buildMetricExplanation({
      label: `${territory.territory} Engagement`,
      definition: "Average engagement score for reps in this territory aggregate.",
      formula: "average(rep engagementScore)",
      inputs: { repCount: territoryReps.length },
      output: `${territory.avgEngagement}/100`,
    }),
    territoryVolatility: buildMetricExplanation({
      label: `${territory.territory} Volatility`,
      definition: "Average absolute distance between each rep sales performance and the territory average.",
      formula: "average(abs(rep salesPerformance - territory avgPerformance))",
      inputs: { repCount: territoryReps.length, avgPerformance: territory.avgPerformance },
      output: territory.territoryVolatility,
    }),
    riskLevel: buildMetricExplanation({
      label: `${territory.territory} Risk Level`,
      definition: "Rule-based territory risk category driven by at-risk reps, performance, and engagement.",
      formula: "high if atRiskRepCount >= 2 OR avgPerformance < 3.4 OR avgEngagement < 55; moderate if atRiskRepCount >= 1 OR avgPerformance < 3.8 OR avgEngagement < 68; else low",
      inputs: {
        atRiskRepCount: territory.atRiskRepCount,
        avgPerformance: territory.avgPerformance,
        avgEngagement: territory.avgEngagement,
      },
      output: territory.riskLevel,
    }),
    mostCommonCapabilityGap: territory.mostCommonCapabilityGap
      ? buildMetricExplanation({
        label: `${territory.territory} Capability Gap`,
        definition: "Most common lowest-scoring capability among reps in this territory aggregate.",
        formula: "mode(rep improvementPriority)",
        inputs: {
          territoryRepCount: territoryReps.length,
          contributingReps: contributors.gapContributors.map((item) => item.name).join(", "),
        },
        output: getBehavioralMetricLabel(territory.mostCommonCapabilityGap),
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
  });

  dataset.territories.forEach((territory) => {
    const territoryReps = dataset.reps.filter((rep) => territory.repIds.includes(rep.id));
    if (territoryReps.length !== territory.repIds.length) {
      issues.push(`${territory.territory}: repIds mismatch`);
    }
    const actualAvgPerformance = round(territoryReps.reduce((sum, rep) => sum + rep.salesPerformance, 0) / territoryReps.length, 2);
    if (actualAvgPerformance !== territory.avgPerformance) {
      issues.push(`${territory.territory}: avgPerformance mismatch`);
    }
    if (!dataset.explanations.territory[territory.territory]?.avgEngagement) {
      issues.push(`${territory.territory}: missing territory explanation metadata`);
    }
  });

  return {
    isValid: issues.length === 0,
    issues,
  };
}

export function buildManagerViewState(version = 0) {
  const reps = MANAGER_REP_DATASET.map((rep) => finalizeRepVariant(buildVariantRep(rep, version)));
  const derivedByRepId = Object.fromEntries(reps.map((rep) => [rep.id, deriveRepMetrics(rep)]));
  const territories = buildTerritoryDataset(reps);
  const nationalTerritory = buildNationalTerritory(reps);
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
    validation,
  };
}

export function getMetricExplanation(explanations, section, id, metricKey) {
  return explanations?.[section]?.[id]?.[metricKey] ?? null;
}

export function getContributorSet(contributors, territoryName) {
  return contributors?.[territoryName] ?? { gapContributors: [], engagementContributors: [], volatilityContributors: [] };
}
