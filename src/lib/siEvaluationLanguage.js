export function describeSiScoreBand(score) {
  const numericScore = Number(score);

  if (!Number.isFinite(numericScore)) {
    return {
      label: "Signal still forming",
      coaching: "insufficient evidence to call this pattern reliably",
    };
  }

  if (numericScore < 2) {
    return {
      label: "Needs immediate rebuild",
      coaching: "the behavior is not yet usable in live field conversations",
    };
  }

  if (numericScore < 3) {
    return {
      label: "Early-stage pattern",
      coaching: "the behavior appears inconsistently and needs direct coaching",
    };
  }

  if (numericScore < 3.5) {
    return {
      label: "Developing pattern",
      coaching: "the behavior is present but not yet dependable under pressure",
    };
  }

  if (numericScore < 4.25) {
    return {
      label: "Established pattern",
      coaching: "the behavior is usable and generally repeatable in field execution",
    };
  }

  return {
    label: "Advanced pattern",
    coaching: "the behavior is a clear strength and can be used to reinforce weaker areas",
  };
}

export function describeConfidenceBand(confidence) {
  const numericConfidence = Number(confidence);

  if (!Number.isFinite(numericConfidence)) {
    return {
      label: "Limited reliability",
      coaching: "use this as an early directional read, not a firm forecast",
    };
  }

  if (numericConfidence < 0.6) {
    return {
      label: "Limited reliability",
      coaching: "the signal is directional and should be validated with fresh observation",
    };
  }

  if (numericConfidence < 0.75) {
    return {
      label: "Moderate reliability",
      coaching: "the pattern is credible but still benefits from another observation window",
    };
  }

  if (numericConfidence < 0.9) {
    return {
      label: "High reliability",
      coaching: "the pattern is stable enough to coach against with confidence",
    };
  }

  return {
    label: "Very high reliability",
    coaching: "the pattern is unusually stable and suitable for decisive coaching action",
  };
}

export function describeTrendLanguage(trend) {
  if (trend === "up") return "improving";
  if (trend === "down") return "under pressure";
  return "holding steady";
}

export function buildMetricNarrative(metricLabel, score, trend) {
  const band = describeSiScoreBand(score);
  const trendLabel = describeTrendLanguage(trend);
  return `${metricLabel} is an ${band.label.toLowerCase()} and is currently ${trendLabel}.`;
}