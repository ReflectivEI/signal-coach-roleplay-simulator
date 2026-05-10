function hasBehavioralEvidence(metric = {}) {
  const positives = Array.isArray(metric?.positives) ? metric.positives.length : 0;
  const misalignments = Array.isArray(metric?.misalignments) ? metric.misalignments.length : 0;
  return positives > 0 || misalignments > 0;
}

function readEvaluated(metric = {}) {
  if (metric?.isEvaluated === true) return true;
  if (metric?.evaluated === true) return true;
  if (metric?.evaluation?.isEvaluated === true) return true;
  return false;
}

function readTriggered(metric = {}) {
  if (metric?.isTriggered === true) return true;
  if (metric?.triggered === true) return true;
  if (metric?.wasTriggered === true) return true;
  if (metric?.evaluation?.wasTriggered === true) return true;
  return false;
}

export function shouldIncludeMetricScore(metric = {}) {
  const score = metric?.score;
  if (typeof score !== "number" || Number.isNaN(score)) return false;

  const explicitEvaluated = readEvaluated(metric);
  const explicitTriggered = readTriggered(metric);

  // Strict path: explicit flags must both be true if present.
  if (explicitEvaluated || explicitTriggered) {
    return explicitEvaluated && explicitTriggered;
  }

  // Compatibility fallback for metric payloads without explicit flags.
  // Observable evidence indicates the capability was behaviorally present.
  return hasBehavioralEvidence(metric);
}

export function computeSessionOverallScoreFromTurns(turns = [], capabilityIds = []) {
  if (!Array.isArray(turns) || !Array.isArray(capabilityIds) || capabilityIds.length === 0) {
    return null;
  }

  const evaluatedAverages = capabilityIds
    .map((capabilityId) => {
      const scores = turns
        .map((turn) => turn?.alignment?.metrics?.[capabilityId])
        .filter((metric) => shouldIncludeMetricScore(metric))
        .map((metric) => metric.score);

      if (scores.length === 0) return null;
      const avg = scores.reduce((sum, value) => sum + value, 0) / scores.length;
      return avg;
    })
    .filter((value) => typeof value === "number" && !Number.isNaN(value));

  if (evaluatedAverages.length === 0) return null;
  const preciseAverage =
    evaluatedAverages.reduce((sum, value) => sum + value, 0) / evaluatedAverages.length;

  // Round only at final output.
  return Math.round(preciseAverage * 10) / 10;
}
