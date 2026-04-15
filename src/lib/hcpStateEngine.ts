/**
 * HCP Predictive State Engine — deterministic, signal-driven, no randomness.
 *
 * State model:    closed → neutral → open
 * Driven by:      BehaviorSignals (evaluated against capability rules)
 * Modified by:    persona + interaction pressure
 * Output:         currentState, trajectory, nextLikelyBehavior, riskLevel
 */

import { BehaviorSignals } from "./simulatorEngine";

// ─── TYPES ─────────────────────────────────────────────────────────────────────

export type HcpOpenness = "closed" | "neutral" | "open";
export type Trajectory = "improving" | "stalled" | "declining";
export type RiskLevel = "low" | "moderate" | "high";

export interface HcpStateSnapshot {
  openness: HcpOpenness;           // current position on closed→neutral→open axis
  opennessScore: number;           // internal integer score: 0 (closed) – 10 (open)
  trajectory: Trajectory;
  nextLikelyBehavior: string;      // plain-language prediction
  riskLevel: RiskLevel;
}

// ─── HELPERS ───────────────────────────────────────────────────────────────────

/** Convert opennessScore to categorical label */
function scoreToOpenness(score: number): HcpOpenness {
  if (score <= 3) return "closed";
  if (score <= 6) return "neutral";
  return "open";
}

/**
 * Score a single BehaviorSignals turn.
 * Returns a delta: positive = moving toward open, negative = toward closed.
 * All rules are deterministic — same inputs always produce the same delta.
 */
function scoreTurnDelta(signals: BehaviorSignals): number {
  let delta = 0;

  // response_alignment: primary driver (was the rep actually responding to what the HCP said?)
  if (signals.response_alignment === "strong") delta += 2;
  else if (signals.response_alignment === "partial") delta += 0;
  else if (signals.response_alignment === "weak") delta -= 2;

  // listening_pattern: secondary driver (did the rep build on HCP input?)
  if (signals.listening_pattern === "responsive") delta += 1;
  else if (signals.listening_pattern === "partially_responsive") delta += 0;
  else if (signals.listening_pattern === "missed") delta -= 2;

  // question_type: open questions increase engagement; leading questions erode trust
  if (signals.question_type === "open_ended") delta += 1;
  else if (signals.question_type === "leading") delta -= 1;

  // engagement_level: HCP response to the exchange (observable output of the above)
  if (signals.engagement_level === "high") delta += 1;
  else if (signals.engagement_level === "low") delta -= 1;

  // control_pattern: rep-dominated conversation reduces HCP openness
  if (signals.control_pattern === "rep_dominant") delta -= 1;
  else if (signals.control_pattern === "balanced") delta += 1;

  return delta;
}

/**
 * Apply persona and pressure modifiers to a raw delta.
 * Modifiers scale the delta — they do not override it.
 */
function applyModifiers(delta: number, persona: string, pressures: string[]): number {
  let modified = delta;

  // Persona modifiers
  if (persona === "skeptical_specialist") {
    // Harder to move upward; negative moves are amplified
    if (modified > 0) modified = Math.floor(modified * 0.6);
    else modified = Math.floor(modified * 1.4);
  }
  if (persona === "curious_uncertain_adopter") {
    // Positive moves are amplified; negative moves are softened
    if (modified > 0) modified = Math.ceil(modified * 1.4);
    else modified = Math.ceil(modified * 0.7);
  }

  // Pressure modifiers
  if (pressures.includes("time_constrained")) {
    // Any negative delta is magnified — less patience
    if (modified < 0) modified = Math.floor(modified * 1.5);
  }
  if (pressures.includes("skeptical_resistant")) {
    // Upward movement is harder
    if (modified > 0) modified = Math.floor(modified * 0.7);
  }
  if (pressures.includes("curious_uncertain")) {
    // Upward movement is easier
    if (modified > 0) modified = Math.ceil(modified * 1.2);
  }

  return modified;
}

// ─── TRAJECTORY ENGINE ─────────────────────────────────────────────────────────

/**
 * Determine trajectory from the last 3 opennessScores.
 * Requires at least 2 data points. Returns "stalled" with fewer points.
 */
function computeTrajectory(recentScores: number[]): Trajectory {
  if (recentScores.length < 2) return "stalled";
  const window = recentScores.slice(-3); // last 3 turns
  const first = window[0];
  const last = window[window.length - 1];
  const diff = last - first;

  if (diff >= 2) return "improving";
  if (diff <= -2) return "declining";
  return "stalled";
}

// ─── PREDICTION ENGINE ─────────────────────────────────────────────────────────

function buildPrediction(
  openness: HcpOpenness,
  trajectory: Trajectory,
  pressures: string[]
): { nextLikelyBehavior: string; riskLevel: RiskLevel } {
  // Risk is determined by openness + trajectory direction
  let riskLevel: RiskLevel;
  if (openness === "closed" && trajectory === "declining") riskLevel = "high";
  else if (openness === "closed" || trajectory === "declining") riskLevel = "high";
  else if (openness === "neutral" && trajectory === "stalled") riskLevel = "moderate";
  else if (openness === "neutral" && trajectory === "improving") riskLevel = "low";
  else if (openness === "open" && trajectory !== "declining") riskLevel = "low";
  else riskLevel = "moderate";

  // Time pressure amplifies risk
  if (pressures.includes("time_constrained") && riskLevel === "moderate") riskLevel = "high";

  // Next likely behavior (deterministic lookup table)
  const key = `${openness}:${trajectory}`;
  const behaviors: Record<string, string> = {
    "closed:declining":  "Likely to disengage, increase pushback, or end conversation early",
    "closed:stalled":    "Likely to repeat objections and withhold specific information",
    "closed:improving":  "May shift to cautious probing — skepticism still present",
    "neutral:declining": "Risk of conversation stagnation — HCP pulling back",
    "neutral:stalled":   "Likely continued surface-level engagement without forward movement",
    "neutral:improving": "Likely to ask more specific questions and share context",
    "open:declining":    "Likely to retract earlier openness — previous concern resurfacing",
    "open:stalled":      "Engagement is present but not deepening — commitment is unlikely",
    "open:improving":    "Likely to engage collaboratively and move toward a next step",
  };

  return {
    nextLikelyBehavior: behaviors[key] || "Behavior pattern unclear — signals are mixed",
    riskLevel
  };
}

// ─── MAIN ENGINE FUNCTION ──────────────────────────────────────────────────────

/**
 * Compute the current HCP state snapshot from the full signal history.
 * Deterministic: same signal history always produces the same output.
 *
 * @param allSignals   All BehaviorSignals objects from the session (one per rep turn)
 * @param persona      HCP persona from scenario
 * @param pressures    Interaction pressures from scenario
 * @param startingBehaviorState  Scenario's starting behavior state
 */
export function computeHcpState(
  allSignals: BehaviorSignals[],
  persona: string,
  pressures: string[],
  startingBehaviorState: string
): HcpStateSnapshot {
  // Seed starting score from scenario's starting behavior state
  const startingScores: Record<string, number> = {
    closed:       2,
    resistance:   2,
    frustration:  2,
    neutral:      5,
    time_pressure: 4,
    open:         7,
    openness:     7,
    curiosity:    6,
  };
  let score = startingScores[startingBehaviorState] ?? 5;
  const scoreHistory: number[] = [score];

  // Apply each turn's signals deterministically
  for (const signals of allSignals) {
    const rawDelta = scoreTurnDelta(signals);
    const modifiedDelta = applyModifiers(rawDelta, persona, pressures);
    score = Math.max(0, Math.min(10, score + modifiedDelta));
    scoreHistory.push(score);
  }

  const openness = scoreToOpenness(score);
  const trajectory = computeTrajectory(scoreHistory);
  const { nextLikelyBehavior, riskLevel } = buildPrediction(openness, trajectory, pressures);

  return { openness, opennessScore: score, trajectory, nextLikelyBehavior, riskLevel };
}

/**
 * Get the score history across all turns — used for Section 4 feedback narrative.
 */
export function computeHcpStateHistory(
  allSignals: BehaviorSignals[],
  persona: string,
  pressures: string[],
  startingBehaviorState: string
): { turn: number; score: number; openness: HcpOpenness }[] {
  const startingScores: Record<string, number> = {
    closed: 2, resistance: 2, frustration: 2,
    neutral: 5, time_pressure: 4,
    open: 7, openness: 7, curiosity: 6,
  };
  let score = startingScores[startingBehaviorState] ?? 5;
  const history: { turn: number; score: number; openness: HcpOpenness }[] = [
    { turn: 0, score, openness: scoreToOpenness(score) }
  ];

  allSignals.forEach((signals, i) => {
    const rawDelta = scoreTurnDelta(signals);
    const modifiedDelta = applyModifiers(rawDelta, persona, pressures);
    score = Math.max(0, Math.min(10, score + modifiedDelta));
    history.push({ turn: i + 1, score, openness: scoreToOpenness(score) });
  });

  return history;
}