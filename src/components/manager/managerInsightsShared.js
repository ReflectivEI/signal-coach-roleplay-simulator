// @ts-check
import { z } from "zod";

const TREND_VALUES = {
  up: 1,
  flat: 0,
  down: -1,
};

const LOW_SIGNAL_THRESHOLD = 3.3;
const STRONG_SIGNAL_THRESHOLD = 4;
const HIGH_RISK_THRESHOLD = 65;
const IMPROVEMENT_THRESHOLD = 35;

/**
 * Shared feature flag for Manager AI Insights.
 */
export const ENABLE_MANAGER_INSIGHTS = true;

export const managerInsightsRequestSchema = z.object({
  repId: z.string().min(1).optional(),
  territoryId: z.string().min(1).optional(),
  metrics: z.object({
    sessionsCompleted: z.number().int().min(0).max(1000),
    trainingModulesCompleted: z.number().int().min(0).max(1000),
    avgEQScore: z.number().min(0).max(5),
    recentPerformanceTrend: z.enum(["up", "down", "flat"]),
    salesPerformance: z.number().min(0).max(5),
    territoryPerformance: z.number().min(0).max(5).optional(),
  }),
  behavioralSignals: z.object({
    signalAwareness: z.number().min(0).max(5).optional(),
    signalInterpretation: z.number().min(0).max(5).optional(),
    valueConnection: z.number().min(0).max(5).optional(),
    objectionHandling: z.number().min(0).max(5).optional(),
  }).default({}),
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

const capabilityLabels = {
  signalAwareness: "signal awareness",
  signalInterpretation: "signal interpretation",
  valueConnection: "value connection",
  objectionHandling: "objection handling",
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeCount(value, benchmark) {
  if (!value || benchmark <= 0) return 0;
  return clamp(value / benchmark, 0, 1);
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * @param {ManagerInsightsRequest} payload
 */
export function deriveManagerInsightsFeatures(payload) {
  const sessionComponent = normalizeCount(payload.metrics.sessionsCompleted, payload.timeframe === "90d" ? 24 : payload.timeframe === "60d" ? 16 : 8);
  const moduleComponent = normalizeCount(payload.metrics.trainingModulesCompleted, payload.timeframe === "90d" ? 12 : payload.timeframe === "60d" ? 8 : 4);
  const engagementScore = round(((sessionComponent * 0.6) + (moduleComponent * 0.4)) * 100, 1);

  const trendValue = TREND_VALUES[payload.metrics.recentPerformanceTrend];
  const baselinePerformance = payload.metrics.salesPerformance * 20;
  const performanceDelta = round(clamp(baselinePerformance + (trendValue * 12), 0, 100), 1);

  const capabilityGaps = Object.entries(payload.behavioralSignals)
    .filter(([, value]) => typeof value === "number" && value < LOW_SIGNAL_THRESHOLD)
    .sort((a, b) => /** @type {number} */ (a[1]) - /** @type {number} */ (b[1]))
    .map(([key, value]) => ({
      capability: capabilityLabels[/** @type {keyof typeof capabilityLabels} */ (key)] || key,
      score: round(/** @type {number} */ (value), 1),
      severity: /** @type {number} */ (value) < 2.5 ? "high" : "moderate",
    }));

  const lowEngagementPenalty = engagementScore < 45 ? 28 : engagementScore < 65 ? 14 : 0;
  const trendPenalty = payload.metrics.recentPerformanceTrend === "down" ? 26 : payload.metrics.recentPerformanceTrend === "flat" ? 10 : -10;
  const gapPenalty = capabilityGaps.length * 11;
  const eqPenalty = payload.metrics.avgEQScore < LOW_SIGNAL_THRESHOLD ? 16 : payload.metrics.avgEQScore >= STRONG_SIGNAL_THRESHOLD ? -8 : 0;
  const territoryPenalty = typeof payload.metrics.territoryPerformance === "number" && payload.metrics.territoryPerformance < 3.2 ? 8 : 0;

  const riskIndex = round(clamp(25 + lowEngagementPenalty + trendPenalty + gapPenalty + eqPenalty + territoryPenalty, 0, 100), 1);
  const signalCoverage = round(
    Object.values(payload.behavioralSignals).filter((value) => typeof value === "number").length / 4,
    2,
  );

  return {
    engagementScore,
    performanceDelta,
    capabilityGaps,
    riskIndex,
    signalCoverage,
    performanceSignal: baselinePerformance,
  };
}

/**
 * @param {ManagerInsightsRequest} payload
 * @param {ReturnType<typeof deriveManagerInsightsFeatures>} derived
 * @returns {ManagerInsightsResponse}
 */
export function createFallbackManagerInsights(payload, derived) {
  const subject = payload.repId ? "This rep" : "This territory";
  const primaryGap = derived.capabilityGaps[0];
  const lowCoverage = derived.signalCoverage < 0.5;
  const isAtRisk = derived.riskIndex >= HIGH_RISK_THRESHOLD;
  const isImproving = derived.riskIndex <= IMPROVEMENT_THRESHOLD
    && payload.metrics.salesPerformance >= STRONG_SIGNAL_THRESHOLD
    && payload.metrics.avgEQScore >= STRONG_SIGNAL_THRESHOLD
    && payload.metrics.recentPerformanceTrend === "up";

  /** @type {"likely_improve" | "at_risk" | "stable"} */
  const performanceTrend = isAtRisk
    ? "at_risk"
    : isImproving
      ? "likely_improve"
      : "stable";

  const confidence = round(clamp(0.42 + (derived.signalCoverage * 0.28) + (Math.abs(TREND_VALUES[payload.metrics.recentPerformanceTrend]) * 0.12), 0.35, 0.86), 2);

  const keyDrivers = [
    `${subject} logged ${payload.metrics.sessionsCompleted} sessions and ${payload.metrics.trainingModulesCompleted} completed modules in the last ${payload.timeframe}.`,
    `Engagement score is ${derived.engagementScore}/100 with a performance signal of ${round(derived.performanceSignal, 0)}/100.`,
  ];

  if (primaryGap) {
    keyDrivers.push(`${primaryGap.capability} is the clearest capability gap at ${primaryGap.score}/5.`);
  }

  if (payload.metrics.recentPerformanceTrend === "up") {
    keyDrivers.push("Recent performance direction is improving, which supports near-term coaching lift.");
  } else if (payload.metrics.recentPerformanceTrend === "down") {
    keyDrivers.push("Recent performance direction is declining, so coaching should focus on stabilizing execution first.");
  }

  const risks = [];
  if (derived.engagementScore < 45) {
    risks.push("Low practice volume is limiting repeat exposure to signal-based coaching.");
  }
  if (payload.metrics.recentPerformanceTrend === "down") {
    risks.push("Declining recent performance increases the chance of missed coaching transfer.");
  }
  if (primaryGap) {
    risks.push(`${primaryGap.capability} is below target, which can weaken in-call adaptation.`);
  }
  if (lowCoverage) {
    risks.push("Behavioral signal coverage is incomplete, so confidence is heuristic rather than predictive.");
  }

  if (!risks.length) {
    risks.push("No acute risk signal detected; continue monitoring engagement and capability consistency.");
  }

  const recommendations = [
    {
      action: primaryGap
        ? `Assign one targeted module and one scenario focused on ${primaryGap.capability}.`
        : "Assign one targeted practice scenario tied to the current business priority.",
      rationale: primaryGap
        ? `${primaryGap.capability} is the lowest observed behavior, so a narrow intervention is more useful than general coaching.`
        : "Focused repetition is the fastest way to confirm whether the current trend is durable.",
      expectedImpact: primaryGap
        ? "Improves transfer from training into live rep behavior during the next practice cycle."
        : "Maintains current momentum while surfacing any hidden capability gap earlier.",
    },
    {
      action: derived.engagementScore < 55
        ? "Set a manager checkpoint for two additional practice sessions before the next review."
        : "Review the next two completed sessions for whether coaching points are showing up in execution.",
      rationale: derived.engagementScore < 55
        ? "Practice volume is currently too low to expect reliable behavior change without manager reinforcement."
        : "Observed activity is sufficient for inspection, so the next step is validating coaching adoption rather than adding more volume.",
      expectedImpact: derived.engagementScore < 55
        ? "Raises engagement enough to make subsequent coaching recommendations more reliable."
        : "Helps confirm whether observed strengths are consistent or isolated to a small sample.",
    },
  ];

  const summary = isAtRisk
    ? `${subject} shows combined engagement and capability risk that warrants targeted coaching, not broader remediation.`
    : isImproving
      ? `${subject} is positioned for near-term improvement if current behaviors stay consistent.`
      : `${subject} is stable, with coaching opportunity concentrated in a small number of observable behaviors.`;

  const reasoningParts = [
    `This outlook is heuristic, based on a ${derived.riskIndex}/100 risk index and ${confidence * 100}% confidence.`,
    `Recent trend is ${payload.metrics.recentPerformanceTrend} and engagement is ${derived.engagementScore}/100.`,
  ];

  if (primaryGap) {
    reasoningParts.push(`${primaryGap.capability} remains the main observable constraint.`);
  }
  if (lowCoverage) {
    reasoningParts.push("Some behavioral signals were missing, which lowers certainty.");
  }

  return {
    summary,
    keyDrivers,
    risks,
    recommendations,
    predictiveOutlook: {
      performanceTrend,
      confidence,
      reasoning: reasoningParts.join(" "),
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
      .filter((item) => !/^improve communication$/i.test(item))
    : [];

  return sanitized.length ? sanitized.slice(0, 4) : fallbackItems;
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
  return parsed.success ? parsed.data : fallback;
}
