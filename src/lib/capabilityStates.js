const FIVE_POINT_STATES = {
  1: "Breakdown",
  2: "Unstable",
  3: "Developing",
  4: "Effective",
  5: "Strong",
};

function clamp(value, min, max) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return min;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

export function capabilityStateFromFivePoint(score) {
  return FIVE_POINT_STATES[clamp(score, 1, 5)] || "Developing";
}

export function capabilityStateFromTenPoint(score) {
  const value = clamp(score, 1, 10);
  if (value <= 2) return "Breakdown";
  if (value <= 4) return "Unstable";
  if (value <= 6) return "Developing";
  if (value <= 8) return "Effective";
  return "Strong";
}

export function capabilityStateFromObservationLevel(level = "developing") {
  const normalized = String(level || "developing").trim().toLowerCase();
  if (normalized === "missed") return "Breakdown";
  if (normalized === "developing") return "Developing";
  if (normalized === "effective") return "Effective";
  if (normalized === "breakdown") return "Breakdown";
  if (normalized === "unstable") return "Unstable";
  if (normalized === "strong") return "Strong";
  return "Developing";
}

export function capabilityStateTone(state = "Developing") {
  const normalized = String(state || "Developing").trim().toLowerCase();
  if (normalized === "strong") return "success";
  if (normalized === "effective") return "success";
  if (normalized === "developing") return "warning";
  if (normalized === "unstable") return "danger";
  if (normalized === "breakdown") return "danger";
  return "neutral";
}