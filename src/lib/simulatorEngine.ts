/**
 * Simulator Engine
 * ================
 * Shared types plus deterministic volatility/event logic for the standalone simulator.
 * Runtime generation lives in `hcpResponseGenerator.ts` and `sessionReview.ts`.
 */

import { predictHcpBehavior } from "./hcpBehaviorPrediction";

// ─── TYPE DEFINITIONS ──────────────────────────────────────────────────────

export interface HcpCue {
  id: string;
  label: string;
  description: string;
  source: "behavior_state" | "interaction_pressure" | "journey_state" | "conversation_shift" | "hcp_context";
}

export interface BehaviorSignals {
  question_type?: "open_ended" | "closed_ended" | "leading" | "none";
  response_alignment?: "strong" | "partial" | "weak";
  objection_type?: "clinical" | "access" | "budget" | "workflow" | "none";
  engagement_level?: "low" | "moderate" | "high";
  control_pattern?: "balanced" | "rep_dominant" | "hcp_dominant";
  listening_pattern?: "responsive" | "partially_responsive" | "missed";
  commitment_attempt?: "none" | "weak" | "clear";
}

export interface CoachingNudge {
  title: string;
  guidance: string;
  capabilityId: string;
  capabilityName?: string;
}

export type ObservationLevel = "effective" | "developing" | "missed";

export interface CapabilityDriver {
  capability: string;
  assessment: ObservationLevel;
  influence: string;
}

export type VolatilityProfile = "stable" | "slightly_disrupted" | "disrupted";

export interface VolatilityState {
  profile: VolatilityProfile;
  trigger: string;
  triggerSignal: string | null;
  curveballActive: boolean;
  curveballType: string | null;
  curveballTriggerSignal: string | null;
  curveballJustification: string | null;
  recoveryActive: boolean;
  recoveryFromProfile: VolatilityProfile | null;
}

export interface VolatilityEvent {
  turnId: string;
  volatilityLevel: VolatilityProfile;
  triggerSignal: string;
  hcpReactionType: string;
}

export interface SimulatorResponse {
  hcpReply: string;
  nextBehaviorState: string;
  nextJourneyState: string;
  activeCues: HcpCue[];
  behaviorSignals: BehaviorSignals;
  coachingNudge: CoachingNudge | null;
  volatilityState: VolatilityState;
  prediction?: BehaviorPrediction;
  runtimeTrace?: Record<string, any> | null;
  predictiveDebug?: Record<string, any> | null;
}

export interface BehaviorPrediction {
  openness: "closed" | "neutral" | "open";
  opennessScore: number;
  trajectory: "improving" | "stalled" | "declining";
  riskLevel: "low" | "moderate" | "high";
  nextLikelyBehavior: string;
  predictedBehaviorState: string;
  predictedResistanceLevel: "low" | "moderate" | "high";
  predictedDrivers: string[];
  predictedObjections: string[];
  predictedEngagementPattern: string;
  concernFamily: string;
  scenarioDomain: string;
  scenarioFamily: string;
  contextProfile: {
    practiceSetting: string;
    patientMixReality: string;
    accessFrictionType: string;
    staffingReality: string;
    workflowBottleneck: string;
    adoptionStyle: string;
    evidenceSensitivity: string;
  };
  assessmentSnapshot: Record<string, ObservationLevel>;
  missedRunCounts: Record<string, number>;
  capabilityDrivers: CapabilityDriver[];
}

export interface ConversationTurn {
  id: string;
  speaker: "rep" | "hcp";
  text: string;
  timestamp: string;
}

export interface SessionReview {
  briefRationale: string;
  didWell: string;
  biggestGap: string;
  nextAdjustment: string;
  capabilityInsights: any[];
  volatilityEvents: VolatilityEvent[];
  signalResponseAlignment: string[];
  overallSummary: string[];
  strengthsProse: string[];
  developProse: string[];
  actionPlanProse: string[];
  strengths: any[];
  improvementAreas: any[];
  missedOpportunities: any[];
  suggestedReframes: any[];
  overallGuidance: string[];
}

// ─── VOLATILITY ENGINE ────────────────────────────────────────────────────

const CAPABILITY_VOLATILITY_WEIGHTS: Record<string, { weight: number; tier: "high" | "medium" | "low" }> = {
  listening_responsiveness: { weight: 3, tier: "high" },
  objection_navigation: { weight: 3, tier: "high" },
  adaptability: { weight: 3, tier: "high" },
  question_quality: { weight: 2, tier: "medium" },
  making_it_matter: { weight: 2, tier: "medium" },
  conversation_control_structure: { weight: 1, tier: "low" },
  customer_engagement_signals: { weight: 1, tier: "low" },
  commitment_gaining: { weight: 1, tier: "low" },
};

function classifySignalPerCapability(s: BehaviorSignals): Record<string, ObservationLevel> {
  return {
    listening_responsiveness: (s.response_alignment === "strong" || s.listening_pattern === "responsive")
      ? "effective" : (s.response_alignment === "weak" || s.listening_pattern === "missed") ? "missed" : "developing",
    objection_navigation: (s.objection_type && s.objection_type !== "none")
      ? ((s.response_alignment === "strong" && s.listening_pattern !== "missed") ? "effective"
        : (s.response_alignment === "weak" || s.listening_pattern === "missed") ? "missed" : "developing")
      : "developing",
    adaptability: (s.response_alignment === "strong") ? "effective"
      : (s.response_alignment === "weak" && s.listening_pattern === "missed") ? "missed" : "developing",
    question_quality: (s.question_type === "open_ended") ? "effective"
      : (s.question_type === "none" || s.question_type === "leading") ? "missed" : "developing",
    making_it_matter: (s.response_alignment === "strong" && s.engagement_level === "high") ? "effective"
      : (s.response_alignment === "weak") ? "missed" : "developing",
    conversation_control_structure: (s.control_pattern === "balanced") ? "effective"
      : (s.control_pattern === "rep_dominant") ? "missed" : "developing",
    customer_engagement_signals: (s.engagement_level === "high" && s.listening_pattern === "responsive") ? "effective"
      : (s.engagement_level === "low" && s.listening_pattern === "missed") ? "missed" : "developing",
    commitment_gaining: (s.commitment_attempt === "clear") ? "effective"
      : (s.commitment_attempt === "none") ? "missed" : "developing",
  };
}

function detectRecovery(allSignals: BehaviorSignals[]): { recovering: boolean; recoveringFrom: string | null } {
  if (allSignals.length < 2) return { recovering: false, recoveringFrom: null };
  const recent = allSignals.slice(-2);
  const prior = allSignals.slice(0, -2);
  if (prior.length === 0) return { recovering: false, recoveringFrom: null };
  for (const [capId, cfg] of Object.entries(CAPABILITY_VOLATILITY_WEIGHTS)) {
    if (cfg.tier === "low") continue;
    const priorMissed = prior.filter(s => classifySignalPerCapability(s)[capId] === "missed").length;
    const recentEffective = recent.filter(s => classifySignalPerCapability(s)[capId] === "effective").length;
    if (priorMissed >= 1 && recentEffective >= 1) {
      return { recovering: true, recoveringFrom: capId };
    }
  }
  return { recovering: false, recoveringFrom: null };
}

export function computeVolatility(
  scenario: any,
  allSignals: BehaviorSignals[],
  turnCount: number,
  previousProfile: VolatilityProfile = "stable"
): VolatilityState {
  const pressures = scenario.interactionPressure || [];
  const persona = scenario.persona || "";
  const journeyStage = scenario.journeyStage || "";

  let volatilityScore = 0;
  const triggerReasons: string[] = [];
  let primaryTriggerSignal: string | null = null;

  // HIGH-PRESSURE SCENARIOS: Lower volatility threshold (1 missed = trigger)
  const isHighPressure = (pressures.includes("time_constrained") || 
                          pressures.includes("skeptical_resistant") ||
                          pressures.includes("safety_concern") ||
                          scenario.startingBehaviorState === "closed" ||
                          (pressures.length >= 2));

  if (allSignals.length > 0) {
    const recentWindow = allSignals.slice(-3);
    for (const [capId, cfg] of Object.entries(CAPABILITY_VOLATILITY_WEIGHTS)) {
      if (cfg.tier === "low") continue;
      const missCount = recentWindow.filter(s => classifySignalPerCapability(s)[capId] === "missed").length;
      const developCount = recentWindow.filter(s => classifySignalPerCapability(s)[capId] === "developing").length;

      if (missCount >= 2) {
        volatilityScore += cfg.weight * 2;
        triggerReasons.push(`sustained missed ${capId} (×${missCount})`);
        if (!primaryTriggerSignal || cfg.weight > CAPABILITY_VOLATILITY_WEIGHTS[primaryTriggerSignal]?.weight) {
          primaryTriggerSignal = capId;
        }
      } else if (missCount === 1) {
        // In high-pressure scenarios, any single miss triggers; otherwise need 2
        const triggerThreshold = isHighPressure ? 1 : 2;
        if (missCount >= triggerThreshold) {
          volatilityScore += cfg.weight;
          triggerReasons.push(`missed ${capId}`);
          if (!primaryTriggerSignal || cfg.weight > CAPABILITY_VOLATILITY_WEIGHTS[primaryTriggerSignal]?.weight) {
            primaryTriggerSignal = capId;
          }
        }
      } else if (isHighPressure && missCount === 0 && developCount >= 2) {
        // High-pressure: 2+ developing signals also trigger slight volatility
        volatilityScore += Math.max(0, cfg.weight - 1);
        triggerReasons.push(`developing ${capId} under high pressure`);
      }
    }
    const allSameWeak = recentWindow.length >= 3 &&
      recentWindow.every(s => s.response_alignment === recentWindow[0].response_alignment) &&
      recentWindow[0].response_alignment !== "strong";
    if (allSameWeak && volatilityScore > 0) {
      volatilityScore += 1;
      triggerReasons.push("rep applying same approach without adjustment");
    }
  }

  const { recovering, recoveringFrom } = detectRecovery(allSignals);
  let recoveryActive = false;
  let recoveryFromProfile: VolatilityProfile | null = null;

  if (recovering && previousProfile !== "stable") {
    const deescalationAmount = previousProfile === "disrupted" ? 3 : 2;
    volatilityScore = Math.max(0, volatilityScore - deescalationAmount);
    recoveryActive = true;
    recoveryFromProfile = previousProfile;
    triggerReasons.push(`recovery: effective ${recoveringFrom} signal after prior spike`);
  }

  let pressureScore = 0;
  if (pressures.includes("time_constrained")) { pressureScore += 1; triggerReasons.push("active time pressure"); }
  if (pressures.includes("operationally_constrained")) { pressureScore += 1; triggerReasons.push("operational constraints"); }
  if (pressures.includes("skeptical_resistant")) { pressureScore += 1; triggerReasons.push("baseline skepticism"); }
  if (pressures.includes("safety_concern")) { pressureScore += 1; triggerReasons.push("active safety concern"); }
  if (volatilityScore > 0) volatilityScore += Math.min(pressureScore, 2);

  if (persona === "skeptical_specialist" && volatilityScore >= 3) {
    volatilityScore += 1;
    triggerReasons.push("skeptical specialist amplification");
  }
  if (persona === "time_constrained_community_doctor" && pressures.includes("time_constrained") && volatilityScore > 0) {
    volatilityScore += 1;
    triggerReasons.push("time-constrained persona under pressure");
  }
  if (persona === "curious_uncertain_adopter") {
    volatilityScore = Math.max(0, volatilityScore - 1);
  }

  if ((journeyStage === "objection_handling" || journeyStage === "commitment_close") && volatilityScore > 0) {
    volatilityScore += 1;
    triggerReasons.push(`high-stakes stage: ${journeyStage}`);
  }

  let profile: VolatilityProfile;
  if (volatilityScore >= 6) profile = "disrupted";
  else if (volatilityScore >= 3) profile = "slightly_disrupted";
  else profile = "stable";

  const curveballWindow = 3;
  const curveballEligible =
    profile !== "stable" &&
    primaryTriggerSignal !== null &&
    CAPABILITY_VOLATILITY_WEIGHTS[primaryTriggerSignal]?.tier !== "low" &&
    (turnCount % curveballWindow === 0) &&
    turnCount > 0;

  let curveballType: string | null = null;
  let curveballTriggerSignal: string | null = null;
  let curveballJustification: string | null = null;

  if (curveballEligible && primaryTriggerSignal) {
    curveballTriggerSignal = primaryTriggerSignal;
    if (primaryTriggerSignal === "listening_responsiveness" || primaryTriggerSignal === "adaptability") {
      curveballType = "unexpected_objection";
      curveballJustification = `HCP's prior concern (${primaryTriggerSignal} missed) was not acknowledged — HCP is injecting a new concern to test whether the rep is actually listening.`;
    } else if (primaryTriggerSignal === "objection_navigation") {
      if (pressures.includes("safety_concern") || pressures.includes("skeptical_resistant")) {
        curveballType = "skepticism_spike";
        curveballJustification = `Objection (${primaryTriggerSignal}) was not explored — combined with ${pressures.includes("safety_concern") ? "safety concern pressure" : "baseline skepticism"}, HCP sharpens existing challenge.`;
      } else {
        curveballType = "unexpected_objection";
        curveballJustification = `${primaryTriggerSignal} missed — HCP restates concern in sharper terms because the previous objection was not genuinely explored.`;
      }
    } else if (primaryTriggerSignal === "question_quality") {
      if (pressures.includes("time_constrained") || pressures.includes("operationally_constrained")) {
        curveballType = "priority_shift";
        curveballJustification = `No discovery questions (${primaryTriggerSignal} missed) — HCP is time-pressed and refocuses on what actually matters to them since the rep hasn't surfaced it.`;
      } else {
        curveballType = "unexpected_objection";
        curveballJustification = `${primaryTriggerSignal} missed — without relevant discovery, HCP fills the void with an unaddressed concern.`;
      }
    } else if (primaryTriggerSignal === "making_it_matter") {
      curveballType = "priority_shift";
      curveballJustification = `${primaryTriggerSignal} missed — rep stayed generic, so HCP redirects conversation to what actually applies to their practice.`;
    }
  }

  return {
    profile,
    trigger: triggerReasons.length > 0 ? triggerReasons.join("; ") : "baseline — no elevated pressure",
    triggerSignal: primaryTriggerSignal,
    curveballActive: curveballType !== null,
    curveballType,
    curveballTriggerSignal,
    curveballJustification,
    recoveryActive,
    recoveryFromProfile,
  };
}

export function computeVolatilityEvents(
  scenario: any,
  allSignals: BehaviorSignals[],
  repTurnIds: string[]
): VolatilityEvent[] {
  const events: VolatilityEvent[] = [];
  let previousProfile: VolatilityProfile = "stable";

  for (let i = 0; i < allSignals.length; i++) {
    const signalsUpToTurn = allSignals.slice(0, i + 1);
    const state = computeVolatility(scenario, signalsUpToTurn, i + 1, previousProfile);

    if (state.profile !== previousProfile || state.curveballActive) {
      const hcpReactionType =
        state.recoveryActive ? "recovery_de_escalation" :
        state.curveballActive ? (state.curveballType || "curveball") :
        state.profile === "disrupted" ? "resistance_escalation" :
        state.profile === "slightly_disrupted" ? "disengagement" :
        "stabilization";

      events.push({
        turnId: repTurnIds[i] || `turn_${i + 1}`,
        volatilityLevel: state.profile,
        triggerSignal: state.triggerSignal || "unknown",
        hcpReactionType,
      });
    }

    previousProfile = state.profile;
  }

  return events;
}
