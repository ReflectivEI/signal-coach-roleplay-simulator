/**
 * Capability Evaluation Engine (Extracted)
 * =========================================
 * Deterministic, signal-driven evaluation of 8 Signal Intelligence capabilities.
 * Imported by simulatorEngine.ts to keep file size manageable.
 */

import { BehaviorSignals, ObservationLevel } from "./simulatorEngine";
import { getScenarioCapabilityProfile, scenarioMatchesConcernFamily } from "./scenarioFamilyRegistry";

export interface CapabilityDriver {
  capability: string;
  assessment: ObservationLevel;
  influence: string;
}

interface EvaluationContext {
  focusCapabilities?: string[];
  scenario?: any;
}

function isEarlyDiscoveryScenario(context: EvaluationContext = {}): boolean {
  const scenario = context.scenario || {};
  const stage = String(scenario?.journeyStage || "").toLowerCase();
  const state = String(scenario?.journeyState || "").toLowerCase();
  return stage === "initial_access" || stage === "discovery" || state === "early_discovery";
}

function isScreeningScenario(context: EvaluationContext = {}): boolean {
  const scenario = context.scenario || {};
  if (scenarioMatchesConcernFamily(scenario, "screening")) return true;
  return String(scenario?.journeyStage || "").toLowerCase() === "discovery";
}

function isHesitationToCommitmentScenario(context: EvaluationContext = {}): boolean {
  const scenario = context.scenario || {};
  const focusCapabilities = context.focusCapabilities || [];
  if (scenarioMatchesConcernFamily(scenario, "hesitation")) return true;
  const title = String(scenario?.title || "").toLowerCase();
  const stage = String(scenario?.journeyStage || "").toLowerCase();
  const state = String(scenario?.journeyState || "").toLowerCase();
  const pressures = String((scenario?.interactionPressure || []).join(" ")).toLowerCase();

  return (
    title === "the perpetual maybe" ||
    (stage === "commitment_close" &&
      (focusCapabilities.includes("commitment_gaining") || state.includes("commitment")) &&
      /curious_uncertain|waiting for the right patient|passive agreement|not ready/.test(
        `${scenario?.persona || ""} ${scenario?.objective || ""} ${pressures}`
      ))
  );
}

function isAdoptionCautionScenario(context: EvaluationContext = {}): boolean {
  const scenario = context.scenario || {};
  const focusCapabilities = context.focusCapabilities || [];
  if (scenarioMatchesConcernFamily(scenario, "adoption_caution")) return true;
  const title = String(scenario?.title || "").toLowerCase();
  const stage = String(scenario?.journeyStage || "").toLowerCase();
  const state = String(scenario?.journeyState || "").toLowerCase();
  const pressures = String((scenario?.interactionPressure || []).join(" ")).toLowerCase();
  const objective = String(scenario?.objective || "").toLowerCase();

  return (
    title === "the reluctant early adopter" ||
    (stage === "adoption_implementation" &&
      (focusCapabilities.includes("commitment_gaining") || state.includes("adoption")) &&
      /first one|others in my area|peer adoption|decision readiness|not ready to be first/.test(
        `${objective} ${scenario?.description || ""} ${pressures}`
      ))
  );
}

function hasHardObjectionSignals(signals: BehaviorSignals[]): boolean {
  return signals.some((signal) =>
    signal.objection_type === "clinical" ||
    signal.objection_type === "access" ||
    signal.objection_type === "workflow" ||
    signal.objection_type === "budget"
  );
}

function hasDiscoveryQuestionPattern(signals: BehaviorSignals[]): boolean {
  const openCount = signals.filter((signal) => signal.question_type === "open_ended").length;
  const strongOrPartialCount = signals.filter(
    (signal) => signal.response_alignment === "strong" || signal.response_alignment === "partial"
  ).length;
  return openCount >= Math.max(2, Math.ceil(signals.length * 0.4)) &&
    strongOrPartialCount >= Math.max(2, Math.ceil(signals.length * 0.5));
}

// ─── CORE EVALUATION FUNCTION ──────────────────────────────────────────────

function evaluateCapability(
  capabilityId: string,
  signals: BehaviorSignals[]
): ObservationLevel {
  if (!signals.length) return "missed";

  switch (capabilityId) {

    case "question_quality": {
      const counts = { open: 0, closed: 0, leading: 0, none: 0 };
      let strongAlign = 0;
      for (const s of signals) {
        if (s.question_type === "open_ended") counts.open++;
        else if (s.question_type === "closed_ended") counts.closed++;
        else if (s.question_type === "leading") counts.leading++;
        else counts.none++;
        if (s.response_alignment === "strong") strongAlign++;
      }
      if (counts.leading > 0 && counts.open === 0) return "missed";
      if (counts.open === 0 && counts.none + counts.closed === signals.length) return "missed";
      const openRatio = counts.open / signals.length;
      // Effective: 50%+ open questions AND they elicit strong response alignment (evidence of relevance)
      if (openRatio >= 0.5 && strongAlign >= signals.length * 0.4) return "effective";
      // Developing: open questions present but weak follow-up alignment
      if (openRatio >= 0.3) return "developing";
      return "developing";
    }

    case "listening_responsiveness": {
      let strongCount = 0, partialCount = 0, weakCount = 0;
      for (const s of signals) {
        if (s.response_alignment === "strong" || s.listening_pattern === "responsive") strongCount++;
        else if (s.response_alignment === "partial" || s.listening_pattern === "partially_responsive") partialCount++;
        else if (s.response_alignment === "weak" || s.listening_pattern === "missed") weakCount++;
      }
      if (weakCount > strongCount + partialCount) return "missed";
      if (strongCount >= partialCount + weakCount) return "effective";
      return "developing";
    }

    case "making_it_matter": {
      let strongAlignCount = 0, weakAlignCount = 0, partialAlignCount = 0;
      let highEngageCount = 0, moderateEngageCount = 0;
      for (const s of signals) {
        if (s.response_alignment === "strong") strongAlignCount++;
        else if (s.response_alignment === "weak") weakAlignCount++;
        else if (s.response_alignment === "partial") partialAlignCount++;
        if (s.engagement_level === "high") highEngageCount++;
        else if (s.engagement_level === "moderate") moderateEngageCount++;
      }
      const total = signals.length;
      // Missed: weak alignment overwhelms strong
      if (weakAlignCount > strongAlignCount + partialAlignCount) return "missed";
      // Effective: strong alignment + solid engagement
      if (strongAlignCount >= total * 0.5 && (highEngageCount + moderateEngageCount) >= total * 0.4) return "effective";
      // Developing: any attempts at alignment or engagement signals present
      if (strongAlignCount + partialAlignCount >= total * 0.3 || (highEngageCount + moderateEngageCount) >= total * 0.3) return "developing";
      return "developing"; // Default to developing unless clearly weak
    }

    case "customer_engagement_signals": {
      let highCount = 0, lowCount = 0, moderateCount = 0;
      let responsiveCount = 0, unresponsiveCount = 0, partiallyResponsiveCount = 0;
      for (const s of signals) {
        if (s.engagement_level === "high") highCount++;
        else if (s.engagement_level === "moderate") moderateCount++;
        else if (s.engagement_level === "low") lowCount++;
        if (s.listening_pattern === "responsive") responsiveCount++;
        else if (s.listening_pattern === "partially_responsive") partiallyResponsiveCount++;
        else if (s.listening_pattern === "missed") unresponsiveCount++;
      }
      const total = signals.length;
      // Missed ONLY if: severe engagement drop AND poor listening
      const engagementDropMissed = lowCount >= total * 0.6 && unresponsiveCount > responsiveCount + partiallyResponsiveCount;
      if (engagementDropMissed) return "missed";
      
      // Effective: high engagement maintained + good listening
      const positiveEngagement = (highCount + moderateCount) >= total * 0.5 && (responsiveCount + partiallyResponsiveCount) >= total * 0.4;
      if (positiveEngagement && highCount >= total * 0.3) return "effective";
      
      // Developing: any positive signals or moderate engagement present
      if ((highCount + moderateCount) >= total * 0.3 || responsiveCount >= total * 0.25) return "developing";
      
      return "developing"; // Default to developing unless clearly missed
    }

    case "objection_navigation": {
      const objectionTurns = signals.filter(s => s.objection_type && s.objection_type !== "none");
      const strongAcrossSession =
        signals.filter((s) => s.response_alignment === "strong").length >= Math.ceil(signals.length * 0.6) &&
        signals.filter((s) => s.listening_pattern === "responsive").length >= Math.ceil(signals.length * 0.5);
      const clearClosePresent = signals.some((s) => s.commitment_attempt === "clear");
      const balancedMajority = signals.filter((s) => s.control_pattern === "balanced").length >= Math.ceil(signals.length * 0.5);
      const engagementHeld =
        signals.filter((s) => s.engagement_level === "high" || s.engagement_level === "moderate").length >= Math.ceil(signals.length * 0.6);
      const strongClosePattern = strongAcrossSession && clearClosePresent && balancedMajority && engagementHeld;

      if (objectionTurns.length === 0) {
        return strongClosePattern ? "effective" : "developing";
      }
      const wellHandled = objectionTurns.filter(
        s => s.response_alignment === "strong" && s.listening_pattern !== "missed"
      ).length;
      const partiallyHandled = objectionTurns.filter(
        s => s.response_alignment === "partial" || s.listening_pattern === "partially_responsive"
      ).length;
      const poorlyHandled = objectionTurns.filter(
        s => s.response_alignment === "weak" || s.listening_pattern === "missed"
      ).length;
      const closeRecoveryPattern =
        clearClosePresent &&
        balancedMajority &&
        wellHandled >= 1 &&
        signals.slice(-3).filter((s) => s.response_alignment === "strong").length >= 2 &&
        signals.slice(-3).filter((s) => s.listening_pattern === "responsive").length >= 2;
      if (poorlyHandled > wellHandled && !(strongClosePattern && poorlyHandled <= 1)) return "missed";
      if (
        wellHandled >= objectionTurns.length * 0.6 ||
        (poorlyHandled === 0 && wellHandled >= Math.max(1, Math.ceil(objectionTurns.length * 0.5)) && partiallyHandled <= 1) ||
        (strongClosePattern && poorlyHandled <= 1) ||
        (closeRecoveryPattern && poorlyHandled <= 1)
      ) return "effective";
      return "developing";
    }

    case "conversation_control_structure": {
      let balanced = 0, repDom = 0, openQuestions = 0;
      for (const s of signals) {
        if (s.control_pattern === "balanced") balanced++;
        else if (s.control_pattern === "rep_dominant") repDom++;
        if (s.question_type === "open_ended") openQuestions++;
      }
      // Rep-dominant + no discovery = missed
      if (repDom >= signals.length * 0.6) return "missed";
      // Balanced structure = effective
      if (balanced >= signals.length * 0.5) return "effective";
      // If asking open questions, implies some directional intent = developing (not missed)
      if (openQuestions >= signals.length * 0.3) return "developing";
      return "developing";
    }

    case "adaptability": {
      if (signals.length < 2) return "developing";
      const mid = Math.floor(signals.length / 2);
      const firstHalf = signals.slice(0, mid);
      const secondHalf = signals.slice(mid);
      const alignScore = (arr: BehaviorSignals[]) =>
        arr.reduce((sum, s) => sum + (s.response_alignment === "strong" ? 2 : s.response_alignment === "partial" ? 1 : 0), 0) / (arr.length || 1);
      const engageScore = (arr: BehaviorSignals[]) =>
        arr.reduce((sum, s) => sum + (s.engagement_level === "high" ? 2 : s.engagement_level === "moderate" ? 1 : 0), 0) / (arr.length || 1);
      const improved = alignScore(secondHalf) > alignScore(firstHalf) || engageScore(secondHalf) > engageScore(firstHalf);
      const consistent = alignScore(secondHalf) >= 1.2 && engageScore(secondHalf) >= 1.0;
      const strongAcrossSession =
        alignScore(signals) >= 1.3 &&
        engageScore(signals) >= 1.0;
      const clearCommitLate = secondHalf.some((s) => s.commitment_attempt === "clear");
      const clearCommitEarly = firstHalf.some((s) => s.commitment_attempt === "clear");
      const commitmentProgression = clearCommitLate && !clearCommitEarly;
      const questionShift =
        new Set(signals.map((s) => s.question_type).filter((value) => value && value !== "none")).size >= 2;
      const controlShift =
        new Set(signals.map((s) => s.control_pattern).filter(Boolean)).size >= 2;
      const strongClinicalHandling =
        signals.filter((s) => s.objection_type === "clinical" && s.response_alignment === "strong").length >= 2;
      const sustainedStrongClose =
        strongAcrossSession &&
        signals.some((s) => s.commitment_attempt === "clear") &&
        signals.filter((s) => s.control_pattern === "balanced").length >= Math.ceil(signals.length * 0.5);
      const closeTransitionPattern =
        signals.some((s) => s.commitment_attempt === "clear") &&
        signals.filter((s) => s.response_alignment === "strong").length >= Math.ceil(signals.length * 0.6) &&
        signals.filter((s) => s.listening_pattern === "responsive").length >= Math.ceil(signals.length * 0.5);
      const lateStageRecovery =
        signals.slice(-3).filter((s) => s.response_alignment === "strong").length >= 2 &&
        signals.slice(-3).filter((s) => s.listening_pattern === "responsive").length >= 2 &&
        signals.some((s) => s.commitment_attempt === "clear");
      const hesitationToCommitmentPattern =
        signals.some((s) => s.commitment_attempt === "clear") &&
        signals.filter((s) => s.response_alignment === "strong").length >= Math.ceil(signals.length * 0.6) &&
        signals.filter((s) => s.control_pattern === "balanced").length >= Math.ceil(signals.length * 0.5) &&
        signals.filter((s) => s.engagement_level === "high" || s.engagement_level === "moderate").length >= Math.ceil(signals.length * 0.6);
      const meaningfulApproachShift =
        commitmentProgression ||
        questionShift ||
        controlShift ||
        strongClinicalHandling ||
        sustainedStrongClose ||
        closeTransitionPattern ||
        lateStageRecovery ||
        hesitationToCommitmentPattern;

      if ((improved && consistent) || (consistent && strongAcrossSession && meaningfulApproachShift)) return "effective";
      if (!improved && alignScore(secondHalf) < 0.5) return "missed";
      return "developing";
    }

    case "commitment_gaining": {
      const clearCount = signals.filter(s => s.commitment_attempt === "clear").length;
      const weakCount = signals.filter(s => s.commitment_attempt === "weak").length;
      const noneCount = signals.filter(s => s.commitment_attempt === "none").length;
      
      // Effective: at least one clear commitment
      if (clearCount >= 1) return "effective";
      
      // Developing: at least one weak attempt, OR weak attempts + some engagement signals
      if (weakCount >= 1) {
        const hasEngagement = signals.some(s => s.engagement_level === "high" || s.engagement_level === "moderate");
        return "developing";
      }
      
      // Missed: zero attempts AND low/declining engagement OR all turns are "none"
      if (noneCount === signals.length) return "missed";
      
      return "developing"; // Default to developing for mixed/uncertain signals
    }

    default:
      return "developing";
  }
}

export function runCapabilityEvaluationEngine(
  signals: BehaviorSignals[],
  focusCapabilities: string[] = [],
  scenario?: any
): Record<string, ObservationLevel> {
  const allIds = [
    "question_quality",
    "listening_responsiveness",
    "making_it_matter",
    "customer_engagement_signals",
    "objection_navigation",
    "conversation_control_structure",
    "adaptability",
    "commitment_gaining"
  ];
  const result: Record<string, ObservationLevel> = {};
  for (const id of allIds) {
    result[id] = evaluateCapability(id, signals);
  }

  const context: EvaluationContext = { focusCapabilities, scenario };
  const earlyDiscovery = isEarlyDiscoveryScenario(context);
  if (isScreeningScenario(context)) {
    const discoveryStrong =
      hasDiscoveryQuestionPattern(signals) &&
      result.listening_responsiveness !== "missed";

    if (discoveryStrong && result.question_quality === "developing") {
      result.question_quality = "effective";
    }

    if (discoveryStrong && result.customer_engagement_signals === "developing") {
      result.customer_engagement_signals = "effective";
    }

    if (result.objection_navigation === "missed" && !hasHardObjectionSignals(signals)) {
      result.objection_navigation = "developing";
    }

    if (result.commitment_gaining === "missed") {
      result.commitment_gaining = "developing";
    }
  }

  if (isHesitationToCommitmentScenario(context)) {
    const strongClosePattern =
      result.question_quality === "effective" &&
      result.listening_responsiveness === "effective" &&
      result.making_it_matter === "effective" &&
      result.conversation_control_structure === "effective" &&
      result.commitment_gaining === "effective";

    if (strongClosePattern && !hasHardObjectionSignals(signals)) {
      result.objection_navigation = "effective";
      if (result.adaptability !== "missed") {
        result.adaptability = "effective";
      }
    } else if (!hasHardObjectionSignals(signals) && result.objection_navigation === "missed") {
      result.objection_navigation = "developing";
    }
  }

  if (isAdoptionCautionScenario(context)) {
    const strongAdoptionPattern =
      result.question_quality === "effective" &&
      result.listening_responsiveness === "effective" &&
      result.making_it_matter === "effective" &&
      (result.commitment_gaining === "effective" || result.commitment_gaining === "developing");

    if (strongAdoptionPattern && !hasHardObjectionSignals(signals)) {
      result.objection_navigation = "effective";
      if (result.adaptability !== "missed") {
        result.adaptability = "effective";
      }
    } else if (!hasHardObjectionSignals(signals) && result.objection_navigation === "missed") {
      result.objection_navigation = "developing";
    }
  }

  const profile = getScenarioCapabilityProfile(scenario);
  if (profile) {
    for (const capabilityId of profile.nonBlocking) {
      if (result[capabilityId] === "missed") {
        result[capabilityId] = "developing";
      }
    }

    const primaryEffectiveCount = profile.primary.filter((capabilityId) => result[capabilityId] === "effective").length;
    const primaryStrong = primaryEffectiveCount >= Math.max(1, profile.primary.length - 1);
    if (primaryStrong) {
      for (const capabilityId of profile.secondary) {
        if (result[capabilityId] === "missed") {
          result[capabilityId] = "developing";
        }
      }
    }
  }

  if (earlyDiscovery) {
    if (result.commitment_gaining === "effective") {
      result.commitment_gaining = "developing";
    }

    if (result.objection_navigation === "missed" && !hasHardObjectionSignals(signals)) {
      result.objection_navigation = "developing";
    }
  }

  return result;
}
