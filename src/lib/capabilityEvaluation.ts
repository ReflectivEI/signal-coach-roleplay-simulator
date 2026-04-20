/**
 * Capability Evaluation Engine (Extracted)
 * =========================================
 * Deterministic, signal-driven evaluation of 8 Signal Intelligence capabilities.
 * Imported by simulatorEngine.ts to keep file size manageable.
 */

import { BehaviorSignals, ObservationLevel } from "./simulatorEngine";

export interface CapabilityDriver {
  capability: string;
  assessment: ObservationLevel;
  influence: string;
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
      if (objectionTurns.length === 0) return "developing";
      const wellHandled = objectionTurns.filter(
        s => s.response_alignment === "strong" && s.listening_pattern !== "missed"
      ).length;
      const poorlyHandled = objectionTurns.filter(
        s => s.response_alignment === "weak" || s.listening_pattern === "missed"
      ).length;
      if (poorlyHandled > wellHandled) return "missed";
      if (wellHandled >= objectionTurns.length * 0.6) return "effective";
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
      const meaningfulApproachShift = commitmentProgression || questionShift || controlShift;

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
  focusCapabilities: string[] = []
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
  return result;
}
