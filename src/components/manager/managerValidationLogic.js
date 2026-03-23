// @ts-check

import { CANONICAL_BEHAVIORAL_METRICS, CANONICAL_CAPABILITY_ID_BY_KEY, getBehavioralMetricLabel } from "./managerPerformanceData.js";

export const MANAGER_VALIDATION_THRESHOLDS = {
  targetCapabilityMeaningfulDelta: 0.2,
  engagementMeaningfulDelta: 3,
  riskMeaningfulDelta: 3,
  conversionMeaningfulDelta: 4,
  minimumSessionDelta: 1,
  minimumModuleDelta: 1,
  minimumObservationDepth: 6,
  defaultObservationWindowDays: 14,
};

export const VALIDATION_STATUS_LABELS = {
  pending: "Pending",
  insufficient_data: "Insufficient Data",
  validated_positive: "Positive Validation",
  validated_neutral: "Neutral Validation",
  validated_negative: "Negative Validation",
};

const CANONICAL_SCORE_KEY_BY_ID = Object.fromEntries(
  Object.entries(CANONICAL_CAPABILITY_ID_BY_KEY).map(([managerKey, canonicalId]) => [canonicalId, managerKey]),
);

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function clampNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function daysBetween(fromIso, toIso) {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, Math.floor((to - from) / 86400000));
}

function normalizeBehavioralMetrics(rep) {
  return Object.fromEntries(
    CANONICAL_BEHAVIORAL_METRICS.map(({ canonicalId, key }) => [canonicalId, round(rep?.behavioralMetrics?.[key]?.score, 1)]),
  );
}

export function buildValidationSnapshot(rep, derived) {
  return {
    overallScore: round(rep?.overallScore, 1),
    behavioralMetrics: normalizeBehavioralMetrics(rep),
    learningEngagementScore: round(derived?.engagementScore, 1),
    readiness: round(derived?.readinessScore, 1),
    conversionProxy: round(derived?.conversionProxyScore, 1),
    salesRisk: round(derived?.salesRiskScore, 1),
    predictiveConfidence: round((derived?.predictiveConfidence ?? 0) * 100, 1),
    sessions30d: clampNumber(rep?.sessionsCompleted30d),
    modulesCompleted: clampNumber(rep?.coachingModulesCompleted),
    salesOutcomeScore: round(rep?.salesPerformance, 1),
    salesTrend: rep?.salesTrend || "flat",
    observationDepth: clampNumber(rep?.observationDepth),
  };
}

export function buildValidationRecommendation(rep, derived) {
  const targetCapability = CANONICAL_CAPABILITY_ID_BY_KEY[rep?.improvementPriority] || CANONICAL_BEHAVIORAL_METRICS[0]?.canonicalId;
  const linkedCapability = CANONICAL_CAPABILITY_ID_BY_KEY[rep?.strongestCapability];
  const capabilityLabel = getBehavioralMetricLabel(rep?.improvementPriority);
  const strongestLabel = getBehavioralMetricLabel(rep?.strongestCapability);
  const risk = round(derived?.salesRiskScore, 1);
  const engagement = round(derived?.engagementScore, 1);

  return {
    source: "ai_recommendation",
    createdBy: "manager",
    recommendationType: "coaching_session",
    recommendationTitle: `${capabilityLabel} intervention`,
    recommendationSummary: `${rep?.name} is currently below the manager target in ${capabilityLabel}. Use ${strongestLabel} as the coaching anchor and track whether the next targeted intervention improves the target capability without increasing sales risk.`,
    targetCapability,
    linkedCapabilities: linkedCapability ? [linkedCapability] : [],
    expectedMovement: {
      targetCapabilityDelta: MANAGER_VALIDATION_THRESHOLDS.targetCapabilityMeaningfulDelta,
      engagementDelta: MANAGER_VALIDATION_THRESHOLDS.engagementMeaningfulDelta,
      riskDirection: "down",
      observationWindowDays: MANAGER_VALIDATION_THRESHOLDS.defaultObservationWindowDays,
    },
    managerContext: {
      currentSalesRisk: risk,
      currentLearningEngagement: engagement,
    },
  };
}

export function getCapabilityLabelFromCanonicalId(canonicalId) {
  return CANONICAL_BEHAVIORAL_METRICS.find((metric) => metric.canonicalId === canonicalId)?.label || canonicalId;
}

export function getCapabilityScoreFromSnapshot(snapshot, canonicalId) {
  return clampNumber(snapshot?.behavioralMetrics?.[canonicalId]);
}

export function computeValidationEvidence(record, snapshot) {
  const baseline = record?.baselineSnapshot || {};
  const targetCapability = record?.targetCapability;
  const capabilityDelta = round(
    getCapabilityScoreFromSnapshot(snapshot, targetCapability) - getCapabilityScoreFromSnapshot(baseline, targetCapability),
    2,
  );
  const engagementDelta = round(clampNumber(snapshot?.learningEngagementScore) - clampNumber(baseline?.learningEngagementScore), 1);
  const salesRiskDelta = round(clampNumber(baseline?.salesRisk) - clampNumber(snapshot?.salesRisk), 1);
  const conversionProxyDelta = round(clampNumber(snapshot?.conversionProxy) - clampNumber(baseline?.conversionProxy), 1);
  const sessionsDelta = clampNumber(snapshot?.sessions30d) - clampNumber(baseline?.sessions30d);
  const modulesDelta = clampNumber(snapshot?.modulesCompleted) - clampNumber(baseline?.modulesCompleted);

  return {
    capabilityDelta,
    engagementDelta,
    salesRiskDelta,
    conversionProxyDelta,
    sessionsDelta,
    modulesDelta,
  };
}

export function determineValidationOutcome(record, latestSnapshot) {
  if (!latestSnapshot) {
    return {
      validationStatus: "pending",
      validationSummary: "Baseline captured. Capture a follow-up snapshot to evaluate movement.",
      evidence: {
        capabilityDelta: 0,
        engagementDelta: 0,
        salesRiskDelta: 0,
        conversionProxyDelta: 0,
        sessionsDelta: 0,
        modulesDelta: 0,
      },
      nextObservationGuidance: "Capture a follow-up snapshot after new coaching activity or module completion is observed.",
    };
  }

  const evidence = computeValidationEvidence(record, latestSnapshot);
  const windowDays = clampNumber(record?.expectedMovement?.observationWindowDays, MANAGER_VALIDATION_THRESHOLDS.defaultObservationWindowDays);
  const elapsedDays = daysBetween(record?.createdAt, latestSnapshot?.capturedAt);
  const observationReady = clampNumber(latestSnapshot?.observationDepth) >= Math.max(MANAGER_VALIDATION_THRESHOLDS.minimumObservationDepth, clampNumber(record?.baselineSnapshot?.observationDepth));
  const newActivityObserved = evidence.sessionsDelta >= MANAGER_VALIDATION_THRESHOLDS.minimumSessionDelta || evidence.modulesDelta >= MANAGER_VALIDATION_THRESHOLDS.minimumModuleDelta;

  // Keep validation conservative: a follow-up is only reviewable once we either
  // observe fresh activity or the full configured observation window has elapsed.
  if (!observationReady || (!newActivityObserved && elapsedDays < windowDays)) {
    return {
      validationStatus: "insufficient_data",
      validationSummary: `Follow-up data is still too thin to validate impact. Observation depth and fresh activity have not yet met the conservative review threshold.`,
      evidence,
      nextObservationGuidance: `Wait for at least ${MANAGER_VALIDATION_THRESHOLDS.minimumSessionDelta} new session or ${MANAGER_VALIDATION_THRESHOLDS.minimumModuleDelta} additional completed module before re-evaluating this intervention.`,
    };
  }

  const positiveSignals = [
    evidence.engagementDelta >= MANAGER_VALIDATION_THRESHOLDS.engagementMeaningfulDelta,
    evidence.salesRiskDelta >= MANAGER_VALIDATION_THRESHOLDS.riskMeaningfulDelta,
    evidence.conversionProxyDelta >= MANAGER_VALIDATION_THRESHOLDS.conversionMeaningfulDelta,
    evidence.sessionsDelta >= MANAGER_VALIDATION_THRESHOLDS.minimumSessionDelta,
  ].filter(Boolean).length;

  if (evidence.capabilityDelta >= MANAGER_VALIDATION_THRESHOLDS.targetCapabilityMeaningfulDelta && positiveSignals >= 1) {
    return {
      validationStatus: "validated_positive",
      validationSummary: `${getCapabilityLabelFromCanonicalId(record?.targetCapability)} improved by ${evidence.capabilityDelta.toFixed(2)} and at least one supporting signal also improved.`,
      evidence,
      nextObservationGuidance: `Maintain the current intervention long enough to confirm the movement persists through the ${windowDays}-day observation window.`,
    };
  }

  const supportingWorsened = evidence.engagementDelta <= -MANAGER_VALIDATION_THRESHOLDS.engagementMeaningfulDelta
    || evidence.salesRiskDelta <= -MANAGER_VALIDATION_THRESHOLDS.riskMeaningfulDelta
    || evidence.conversionProxyDelta <= -MANAGER_VALIDATION_THRESHOLDS.conversionMeaningfulDelta;

  if (evidence.capabilityDelta <= 0 && supportingWorsened) {
    return {
      validationStatus: "validated_negative",
      validationSummary: `${getCapabilityLabelFromCanonicalId(record?.targetCapability)} has not improved and one or more supporting indicators worsened.`,
      evidence,
      nextObservationGuidance: "Reassess the intervention design, intensity, or target capability before assigning additional activity.",
    };
  }

  return {
    validationStatus: "validated_neutral",
    validationSummary: `${getCapabilityLabelFromCanonicalId(record?.targetCapability)} showed limited or mixed movement versus baseline.`,
    evidence,
    nextObservationGuidance: `Continue observing through the ${windowDays}-day window before deciding whether to reinforce or replace this intervention.`,
  };
}

export function createValidationRecord(input) {
  const createdAt = input?.createdAt || new Date().toISOString();
  const followUpSnapshots = Array.isArray(input?.followUpSnapshots) ? input.followUpSnapshots : [];
  const latestSnapshot = followUpSnapshots[followUpSnapshots.length - 1] || null;
  const outcome = determineValidationOutcome({ ...input, createdAt, followUpSnapshots }, latestSnapshot);

  return {
    id: input?.id || `validation_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    repId: input?.repId,
    repName: input?.repName,
    territoryId: input?.territoryId || input?.territoryName || "unknown_territory",
    territoryName: input?.territoryName,
    createdAt,
    createdBy: input?.createdBy || "manager",
    source: input?.source || "manager_manual",
    recommendationType: input?.recommendationType || "coaching_session",
    recommendationTitle: input?.recommendationTitle || "Tracked intervention",
    recommendationSummary: input?.recommendationSummary || "Tracked intervention created from Manager View.",
    targetCapability: input?.targetCapability,
    linkedCapabilities: Array.isArray(input?.linkedCapabilities) ? input.linkedCapabilities : [],
    baselineSnapshot: input?.baselineSnapshot,
    expectedMovement: {
      targetCapabilityDelta: clampNumber(input?.expectedMovement?.targetCapabilityDelta, MANAGER_VALIDATION_THRESHOLDS.targetCapabilityMeaningfulDelta),
      engagementDelta: clampNumber(input?.expectedMovement?.engagementDelta, MANAGER_VALIDATION_THRESHOLDS.engagementMeaningfulDelta),
      riskDirection: input?.expectedMovement?.riskDirection || "down",
      observationWindowDays: clampNumber(input?.expectedMovement?.observationWindowDays, MANAGER_VALIDATION_THRESHOLDS.defaultObservationWindowDays),
    },
    followUpSnapshots,
    validationStatus: outcome.validationStatus,
    validationSummary: outcome.validationSummary,
    evidence: outcome.evidence,
    nextObservationGuidance: outcome.nextObservationGuidance,
  };
}

export function appendFollowUpSnapshot(record, snapshot) {
  const followUpSnapshot = {
    ...snapshot,
    capturedAt: snapshot?.capturedAt || new Date().toISOString(),
  };
  const followUpSnapshots = [...(record?.followUpSnapshots || []), followUpSnapshot];
  return createValidationRecord({ ...record, followUpSnapshots });
}

export function buildValidationSummary(records) {
  const summary = {
    trackedInterventions: records.length,
    positiveValidations: 0,
    neutralValidations: 0,
    negativeValidations: 0,
    pendingValidations: 0,
    insufficientData: 0,
  };

  records.forEach((record) => {
    if (record.validationStatus === "validated_positive") summary.positiveValidations += 1;
    else if (record.validationStatus === "validated_neutral") summary.neutralValidations += 1;
    else if (record.validationStatus === "validated_negative") summary.negativeValidations += 1;
    else if (record.validationStatus === "insufficient_data") summary.insufficientData += 1;
    else summary.pendingValidations += 1;
  });

  return summary;
}

export function buildValidationInsight(record) {
  if (!record) {
    return "No tracked intervention has been started for this rep yet.";
  }

  const targetLabel = getCapabilityLabelFromCanonicalId(record.targetCapability);
  const statusLabel = VALIDATION_STATUS_LABELS[record.validationStatus] || VALIDATION_STATUS_LABELS.pending;
  if (record.validationStatus === "validated_positive") {
    return `Last tracked intervention on ${targetLabel} showed positive movement. ${record.validationSummary}`;
  }
  if (record.validationStatus === "pending") {
    return `A ${targetLabel} intervention is being tracked, but no follow-up snapshot has been captured yet.`;
  }
  if (record.validationStatus === "insufficient_data") {
    return `A ${targetLabel} intervention is being tracked, but the current follow-up evidence is still too limited for a confident readout.`;
  }
  return `${statusLabel}: ${record.validationSummary}`;
}

export function listCanonicalCapabilities() {
  return CANONICAL_BEHAVIORAL_METRICS.map((metric) => ({
    canonicalId: metric.canonicalId,
    label: metric.label,
    managerKey: CANONICAL_SCORE_KEY_BY_ID[metric.canonicalId] || null,
  }));
}
