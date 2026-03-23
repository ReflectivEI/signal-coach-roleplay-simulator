// @ts-check

import { CANONICAL_CAPABILITY_ID_BY_KEY, getBehavioralMetricLabel } from "./managerPerformanceData.js";

export const RELIABILITY_MIN_SAMPLE_THRESHOLD = 3;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function safeRatio(numerator, denominator, fallback = 0) {
  if (!Number.isFinite(Number(numerator)) || !Number.isFinite(Number(denominator)) || Number(denominator) <= 0) {
    return fallback;
  }
  return Number(numerator) / Number(denominator);
}

function buildOutcomeCounts(repHistory) {
  return [
    repHistory?.validatedPositive || 0,
    repHistory?.validatedNeutral || 0,
    repHistory?.validatedNegative || 0,
  ];
}

function getConsistencyScore(repHistory) {
  const total = repHistory?.totalInterventions || 0;
  if (total <= 1) return 0.35;
  const dominantOutcomeShare = Math.max(...buildOutcomeCounts(repHistory)) / total;
  return round(clamp(dominantOutcomeShare, 0.35, 1), 2);
}

function shrinkTowardMidpoint(rawRate, sampleCount, midpoint = 0.5, fullStrengthAt = 6) {
  const sampleFactor = clamp(safeRatio(sampleCount, fullStrengthAt, 0), 0, 1);
  return round(midpoint + ((rawRate - midpoint) * sampleFactor), 2);
}

export function hardenPredictiveCalibration(rep, derived, calibration, analytics) {
  const deterministicConfidence = clamp(Number(derived?.confidenceScore ?? derived?.predictiveConfidence ?? 0), 0, 1);
  const calibratedConfidence = clamp(Number(calibration?.predictiveConfidence ?? deterministicConfidence), 0, 1);
  const fallbackTargetCapability = CANONICAL_CAPABILITY_ID_BY_KEY[rep?.improvementPriority] || null;
  const repHistory = analytics?.repSummaries?.[rep?.id] || null;
  const targetCapability = fallbackTargetCapability;
  const targetCapabilityStats = targetCapability ? analytics?.capabilitySummaries?.[targetCapability] || null : null;
  const repSampleSize = repHistory?.totalInterventions || 0;
  const capabilitySampleSize = targetCapabilityStats?.totalInterventions || 0;
  const lowConfidenceSample = (repSampleSize > 0 && repSampleSize < RELIABILITY_MIN_SAMPLE_THRESHOLD)
    || (capabilitySampleSize > 0 && capabilitySampleSize < RELIABILITY_MIN_SAMPLE_THRESHOLD);
  const consistencyScore = getConsistencyScore(repHistory);
  const sampleFactor = clamp((safeRatio(repSampleSize, 6, 0) * 0.65) + (safeRatio(capabilitySampleSize, 6, 0) * 0.2) + (consistencyScore * 0.15), 0.18, 1);
  const adjustedEffectivenessScore = calibration?.hasHistory
    ? shrinkTowardMidpoint(Number(calibration?.interventionEffectivenessScore || 0), repSampleSize)
    : 0;
  const adjustedTargetCapabilitySuccessRate = calibration?.hasHistory
    ? shrinkTowardMidpoint(Number(calibration?.targetCapabilitySuccessRate || 0), capabilitySampleSize)
    : 0;
  const cappedCalibrationLift = clamp(calibratedConfidence - deterministicConfidence, -0.08, 0.08);
  const dampenedConfidence = deterministicConfidence + (cappedCalibrationLift * sampleFactor);
  const lowSamplePenalty = lowConfidenceSample ? 0.08 : repSampleSize > 0 && repSampleSize < 5 ? 0.04 : 0;
  const inconsistencyPenalty = repSampleSize >= RELIABILITY_MIN_SAMPLE_THRESHOLD
    ? clamp((0.62 - consistencyScore) * 0.2, 0, 0.08)
    : 0;
  const predictiveConfidence = round(clamp(dampenedConfidence - lowSamplePenalty - inconsistencyPenalty, 0, 1), 2);
  const confidenceExplanation = lowConfidenceSample
    ? "Predictive confidence reflects reliability, not certainty. Limited data — early signal."
    : inconsistencyPenalty > 0
      ? "Predictive confidence reflects reliability, not certainty. Mixed validation outcomes reduce reliability until results stabilize."
      : "Predictive confidence reflects reliability, not certainty.";
  const consistencyLabel = repSampleSize === 0
    ? null
    : consistencyScore >= 0.72
      ? "Consistent validation pattern"
      : consistencyScore >= 0.55
        ? "Some validation variation"
        : "Inconsistent validation pattern";
  const weightingExplanation = calibration?.hasHistory
    ? "Prioritized based on historical effectiveness in improving outcomes."
    : "Prioritized using deterministic signals until enough historical effectiveness data is available.";
  const crossRepSignal = targetCapabilityStats && capabilitySampleSize >= RELIABILITY_MIN_SAMPLE_THRESHOLD && adjustedTargetCapabilitySuccessRate >= 0.62
    ? `This capability has shown strong improvement across similar reps.`
    : null;

  return {
    ...calibration,
    predictiveConfidence,
    interventionEffectivenessScore: adjustedEffectivenessScore,
    targetCapabilitySuccessRate: adjustedTargetCapabilitySuccessRate,
    reliability: {
      deterministicConfidence: round(deterministicConfidence, 2),
      originalCalibratedConfidence: round(calibratedConfidence, 2),
      repSampleSize,
      capabilitySampleSize,
      consistencyScore,
      consistencyLabel,
      lowConfidenceSample,
      sampleLabel: lowConfidenceSample ? "Limited data — early signal" : null,
      confidenceExplanation,
      weightingExplanation,
      crossRepSignal,
      targetCapabilityLabel: targetCapability ? getBehavioralMetricLabel(rep?.improvementPriority) : null,
    },
  };
}
