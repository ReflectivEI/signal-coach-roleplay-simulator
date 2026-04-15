/**
 * HCP Behavior Prediction Engine (Extracted)
 * ==========================================
 * Capability-driven behavior prediction based on signal evaluation.
 * Imported by simulatorEngine.ts to manage file size.
 */

import { BehaviorSignals, CapabilityDriver, BehaviorPrediction } from "./simulatorEngine";
import { runCapabilityEvaluationEngine } from "./capabilityEvaluation";
import { SIGNAL_INTELLIGENCE_CAPABILITIES } from "./signalIntelligence";

export function predictHcpBehavior(
  signals: BehaviorSignals[],
  latestSignals: BehaviorSignals[],
  scenario: any
): BehaviorPrediction {
  const assessment = runCapabilityEvaluationEngine(latestSignals);
  const allTimeAssessment = runCapabilityEvaluationEngine(signals);

  const missedRunCounts: Record<string, number> = {};
  for (const id of SIGNAL_INTELLIGENCE_CAPABILITIES.map(c => c.id)) {
    let run = 0;
    for (let i = signals.length - 1; i >= 0; i--) {
      const turnEval = Object.values(assessment).length > 0 ? assessment[id] || "developing" : "developing";
      if (turnEval === "missed") run++;
      else break;
    }
    missedRunCounts[id] = run;
  }

  const capabilityDrivers: CapabilityDriver[] = [];
  let resistanceVotes = 0;
  let engagementVotes = 0;
  let objectionEscalation = false;
  const predictedObjections: string[] = [];
  const predictedDrivers: string[] = [];

  // PRIMARY: capability-to-prediction mapping
  {
    const a = assessment["listening_responsiveness"];
    if (a === "effective") {
      resistanceVotes -= 2;
      engagementVotes += 2;
      capabilityDrivers.push({ capability: "listening_responsiveness", assessment: a, influence: "Rep responded directly to HCP concerns — resistance is decreasing, openness is increasing." });
    } else if (a === "developing") {
      capabilityDrivers.push({ capability: "listening_responsiveness", assessment: a, influence: "Rep partially aligned with HCP — neutrality maintained, no strong shift." });
    } else {
      resistanceVotes += 2;
      engagementVotes -= 1;
      if (missedRunCounts["listening_responsiveness"] >= 2) {
        resistanceVotes += 2;
        predictedDrivers.push("HCP is becoming dismissive — concerns have been talked past repeatedly.");
      } else {
        predictedDrivers.push("HCP concern was not addressed — mild frustration building.");
      }
      capabilityDrivers.push({ capability: "listening_responsiveness", assessment: a, influence: "Rep ignored or overrode the HCP's concern — frustration and resistance are rising." });
    }
  }

  {
    const a = assessment["question_quality"];
    if (a === "effective") {
      engagementVotes += 2;
      resistanceVotes -= 1;
      capabilityDrivers.push({ capability: "question_quality", assessment: a, influence: "Open, relevant questions are driving more specific and engaged HCP responses." });
    } else if (a === "developing") {
      capabilityDrivers.push({ capability: "question_quality", assessment: a, influence: "Questions have some value but lack targeting — HCP engagement is moderate and may stay generic." });
    } else {
      engagementVotes -= 2;
      predictedDrivers.push("Absence of meaningful questions is producing vague or dismissive HCP responses.");
      capabilityDrivers.push({ capability: "question_quality", assessment: a, influence: "Rep is not asking useful questions — HCP is providing minimal, vague responses." });
    }
  }

  {
    const a = assessment["making_it_matter"];
    if (a === "effective") {
      engagementVotes += 1;
      capabilityDrivers.push({ capability: "making_it_matter", assessment: a, influence: "Rep connected to HCP's real-world context — HCP is engaging with practice-relevant responses." });
    } else if (a === "developing") {
      capabilityDrivers.push({ capability: "making_it_matter", assessment: a, influence: "Rep is attempting relevance but staying abstract — HCP partially engaged." });
    } else {
      engagementVotes -= 2;
      resistanceVotes += 1;
      predictedDrivers.push("Generic or product-led framing is causing the HCP to disengage or redirect.");
      capabilityDrivers.push({ capability: "making_it_matter", assessment: a, influence: "Rep stayed generic and disconnected — HCP is redirecting or disengaging from the conversation." });
    }
  }

  {
    const a = assessment["objection_navigation"];
    if (a === "effective") {
      resistanceVotes -= 2;
      capabilityDrivers.push({ capability: "objection_navigation", assessment: a, influence: "Objections were acknowledged and explored — they are softening and becoming more specific." });
    } else if (a === "developing") {
      capabilityDrivers.push({ capability: "objection_navigation", assessment: a, influence: "Objections were acknowledged but rep moved to justification too quickly — objections persist." });
    } else {
      resistanceVotes += 2;
      objectionEscalation = true;
      if (missedRunCounts["objection_navigation"] >= 2) {
        resistanceVotes += 2;
        predictedDrivers.push("Repeated failure to navigate objections — HCP is escalating resistance and repeating concerns.");
      } else {
        predictedDrivers.push("Objection was not genuinely engaged — HCP will likely repeat or sharpen it.");
      }
      const pressures = scenario.interactionPressure || [];
      if (pressures.includes("access_barrier") || pressures.includes("operationally_constrained")) predictedObjections.push("Access or workflow burden concerns");
      if (pressures.includes("safety_concern")) predictedObjections.push("Safety or risk concerns");
      if (pressures.includes("competitive_bias")) predictedObjections.push("Loyalty to current therapy");
      if (pressures.includes("skeptical_resistant")) predictedObjections.push("Evidence or relevance skepticism");
      capabilityDrivers.push({ capability: "objection_navigation", assessment: a, influence: "Objections were not genuinely navigated — HCP will escalate or repeat concerns." });
    }
  }

  {
    const a = assessment["adaptability"];
    if (a === "effective") {
      resistanceVotes -= 1;
      engagementVotes += 1;
      capabilityDrivers.push({ capability: "adaptability", assessment: a, influence: "Rep adjusted approach as the conversation evolved — HCP behavior is shifting positively." });
    } else if (a === "developing") {
      capabilityDrivers.push({ capability: "adaptability", assessment: a, influence: "Rep is making some adjustments but not consistently — HCP shifts are slow or uneven." });
    } else {
      resistanceVotes += 1;
      if (missedRunCounts["adaptability"] >= 2) {
        resistanceVotes += 1;
        predictedDrivers.push("Rep is repeating the same approach — HCP is becoming rigid and resistant.");
      }
      capabilityDrivers.push({ capability: "adaptability", assessment: a, influence: "Rep repeated the same approach despite changing conditions — HCP is becoming rigid." });
    }
  }

  {
    const a = assessment["commitment_gaining"];
    if (a === "effective") {
      capabilityDrivers.push({ capability: "commitment_gaining", assessment: a, influence: "A clear next-step ask was made — HCP is moving toward next-step readiness." });
    } else if (a === "developing") {
      predictedDrivers.push("Next-step intent was signaled but not clearly asked — HCP may offer passive agreement without action.");
      capabilityDrivers.push({ capability: "commitment_gaining", assessment: a, influence: "Rep hinted at next steps without securing a specific commitment — passive agreement is likely." });
    } else {
      predictedDrivers.push("No meaningful next-step attempt — HCP will likely deflect or delay.");
      capabilityDrivers.push({ capability: "commitment_gaining", assessment: a, influence: "No commitment attempt was made — HCP will deflect or end without a clear path forward." });
    }
  }

  // SECONDARY: interaction pressure modifiers
  const pressures = scenario.interactionPressure || [];
  if (pressures.includes("time_constrained")) {
    resistanceVotes += 1;
    predictedDrivers.push("Time pressure is still active — HCP tolerance for extended exchanges is low.");
  }
  if (pressures.includes("skeptical_resistant") && resistanceVotes > 0) {
    resistanceVotes += 1;
  }
  if (pressures.includes("curious_uncertain") && engagementVotes > 0) {
    engagementVotes += 1;
  }

  // TERTIARY: persona modifiers
  const persona = scenario.persona || "";
  if (persona === "skeptical_specialist" && resistanceVotes > 1) {
    resistanceVotes += 1;
  }
  if (persona === "time_constrained_community_doctor") {
    predictedDrivers.push("This HCP pattern quickly converts frustration into disengagement.");
  }
  if (persona === "curious_uncertain_adopter" && engagementVotes > 0) {
    engagementVotes += 1;
  }

  // Determine predicted state from votes
  let predictedBehaviorState: string;
  let predictedResistanceLevel: "low" | "moderate" | "high";

  if (resistanceVotes >= 4) {
    predictedBehaviorState = objectionEscalation ? "resistance" : "frustration";
    predictedResistanceLevel = "high";
  } else if (resistanceVotes >= 2) {
    predictedBehaviorState = "neutral";
    predictedResistanceLevel = "moderate";
  } else if (engagementVotes >= 3) {
    predictedBehaviorState = "openness";
    predictedResistanceLevel = "low";
  } else if (engagementVotes >= 1) {
    predictedBehaviorState = "curiosity";
    predictedResistanceLevel = "low";
  } else {
    predictedBehaviorState = "neutral";
    predictedResistanceLevel = "moderate";
  }

  const journeyState = scenario.journeyState || "";
  if (journeyState === "objection_phase" && assessment["objection_navigation"] !== "effective") {
    if (predictedBehaviorState === "openness") predictedBehaviorState = "curiosity";
  }

  const predictedEngagementPattern =
    engagementVotes >= 3 ? "HCP is actively participating and building on rep input." :
    engagementVotes >= 1 ? "HCP is moderately engaged but not initiating." :
    resistanceVotes >= 3 ? "HCP is pulling back and giving minimal responses." :
    "HCP is present but passive — waiting for a reason to engage.";

  return {
    predictedBehaviorState,
    predictedResistanceLevel,
    predictedDrivers,
    predictedObjections,
    predictedEngagementPattern,
    capabilityDrivers
  };
}