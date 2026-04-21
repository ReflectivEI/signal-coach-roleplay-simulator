/**
 * HCP Behavior Prediction Engine
 * ==============================
 * Shared predictive contract used by HCP generation, simulator UI, QA inspection,
 * and review writing. This file is the predictive source of truth for Standalone.
 */

import { computeHcpState } from "./hcpStateEngine";
import { deriveFamilyTemperamentControls } from "./hcpFamilyProfiles";
import { deriveConcernFamily, deriveScenarioDomain } from "./hcpTurnDirectives";
import { BehaviorSignals, CapabilityDriver, BehaviorPrediction, ObservationLevel } from "./simulatorEngine";
import { runCapabilityEvaluationEngine } from "./capabilityEvaluation";
import { SIGNAL_INTELLIGENCE_CAPABILITIES } from "./signalIntelligence";

type CapabilityId = typeof SIGNAL_INTELLIGENCE_CAPABILITIES[number]["id"];

const CAPABILITY_IDS = SIGNAL_INTELLIGENCE_CAPABILITIES.map((capability) => capability.id);

function buildAssessmentHistory(
  signals: BehaviorSignals[],
  scenario: any,
): Record<CapabilityId, ObservationLevel>[] {
  return signals.map((_, index) =>
    runCapabilityEvaluationEngine(signals.slice(0, index + 1), [], scenario) as Record<CapabilityId, ObservationLevel>,
  );
}

function buildMissedRunCounts(
  assessmentHistory: Record<CapabilityId, ObservationLevel>[],
): Record<string, number> {
  const missedRunCounts: Record<string, number> = {};

  for (const capabilityId of CAPABILITY_IDS) {
    let run = 0;
    for (let index = assessmentHistory.length - 1; index >= 0; index -= 1) {
      if (assessmentHistory[index]?.[capabilityId] === "missed") run += 1;
      else break;
    }
    missedRunCounts[capabilityId] = run;
  }

  return missedRunCounts;
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function deriveScenarioPredictiveContext(scenario: any = {}, concernFamily = "general", domain = "general") {
  const contextText = String(scenario?.context || scenario?.description || scenario?.openingScene || "").trim();
  const pressures = Array.isArray(scenario?.interactionPressure) ? scenario.interactionPressure : [];
  const persona = String(scenario?.persona || "").toLowerCase();
  const familyControls = deriveFamilyTemperamentControls(scenario);

  const practiceSetting = contextText
    ? contextText.split(".")[0].trim()
    : `${scenario?.stakeholder || "HCP"} in a ${domain === "general" ? "real-world practice" : `${domain} practice`}`;

  const patientMixReality =
    concernFamily === "evidence"
      ? "Decision pressure is tied to whether the evidence fits the higher-complexity patients the HCP actually manages."
      : concernFamily === "workflow"
        ? "The relevant patients are the ones whose care path creates extra operational work for staff."
        : concernFamily === "access"
          ? "The real patient mix is filtered through coverage, prior auth, and who can realistically get access."
          : concernFamily === "screening"
            ? "The HCP needs a usable patient-selection boundary, not a broad description."
            : concernFamily === "adoption_caution"
              ? "The HCP is thinking about which patients are safe enough for an early, low-risk first use."
              : "The HCP is evaluating whether this applies to the patients who actually drive decisions in practice.";

  const accessFrictionType =
    pressures.includes("access_barrier")
      ? /formulary|p&t|coverage|payer/i.test(contextText)
        ? "Formulary and payer review remain the main gate."
        : "Prior auth and access friction are still active in the decision path."
      : "Access is not the dominant blocker unless the rep makes it one.";

  const staffingReality =
    pressures.includes("operationally_constrained")
      ? "Staff capacity is limited, so any extra monitoring, callbacks, or paperwork will be judged immediately."
      : "Staffing is workable, but ownership of extra steps still matters.";

  const workflowBottleneck =
    concernFamily === "workflow"
      ? "The HCP is deciding whether this adds a real staff step, handoff, or monitoring burden."
      : concernFamily === "access"
        ? "The bottleneck is the step where access work stalls or gets pushed back to the practice."
        : "Workflow matters only if it changes who has to do what next.";

  const adoptionStyle =
    persona.includes("curious")
      ? "Open to learning, but still wants a safe and practical first move."
      : persona.includes("cost_focused")
        ? "Will move only when value is explicit and decision-level."
        : persona.includes("skeptical")
          ? "Requires proof that feels decision-relevant before moving."
          : familyControls.familyKey === "initial_access"
            ? "Protects time first, then relevance."
            : "Will engage if the rep stays specific and useful.";

  const evidenceSensitivity =
    concernFamily === "evidence"
      ? "Sensitive to subgroup fit, trial design, and whether the data changes a real decision."
      : scenario?.decisionOrientation === "guideline_anchored"
        ? "Sensitive to guideline fit and whether the evidence clears a conservative bar."
        : scenario?.decisionOrientation === "risk_averse"
          ? "Sensitive to unresolved safety or implementation risk."
          : "Sensitive to whether the evidence matters in practice, not just on paper.";

  return {
    practiceSetting,
    patientMixReality,
    accessFrictionType,
    staffingReality,
    workflowBottleneck,
    adoptionStyle,
    evidenceSensitivity,
  };
}

function maxRiskLevel(
  left: "low" | "moderate" | "high",
  right: "low" | "moderate" | "high",
): "low" | "moderate" | "high" {
  const rank = { low: 0, moderate: 1, high: 2 };
  return rank[left] >= rank[right] ? left : right;
}

function buildNextLikelyBehavior(
  predictedBehaviorState: string,
  concernFamily: string,
  hcpState: ReturnType<typeof computeHcpState>,
  scenario: any,
): string {
  const pressures = Array.isArray(scenario?.interactionPressure) ? scenario.interactionPressure : [];
  const timeSensitive = pressures.includes("time_constrained") || pressures.includes("operationally_constrained");

  if (predictedBehaviorState === "resistance") {
    if (concernFamily === "access") return "Likely to repeat the exact access blocker and demand a concrete change in the process.";
    if (concernFamily === "workflow") return "Likely to push for one concrete workflow answer and reject anything that sounds abstract.";
    if (concernFamily === "evidence") return "Likely to sharpen the evidence-fit objection and stay unconvinced by broader claims.";
    return "Likely to repeat the blocker more firmly until the rep answers it directly.";
  }

  if (predictedBehaviorState === "frustration") {
    return timeSensitive
      ? "Likely to shorten replies and press for the bottom line immediately."
      : "Likely to narrow the conversation and make the next question more specific.";
  }

  if (predictedBehaviorState === "curiosity") {
    if (concernFamily === "screening") return "Likely to ask for a more usable patient-selection rule.";
    if (concernFamily === "adoption_caution") return "Likely to explore one smaller, lower-risk next step.";
    return "Likely to stay engaged if the next answer is specific and practical.";
  }

  if (predictedBehaviorState === "openness") {
    return "Likely to engage constructively and define a more concrete next step if the rep stays relevant.";
  }

  return hcpState.nextLikelyBehavior;
}

export function predictHcpBehavior(
  signals: BehaviorSignals[],
  latestSignals: BehaviorSignals[],
  scenario: any,
): BehaviorPrediction {
  const assessmentHistory = buildAssessmentHistory(signals, scenario);
  const assessment = latestSignals.length > 0
    ? (runCapabilityEvaluationEngine(latestSignals, [], scenario) as Record<CapabilityId, ObservationLevel>)
    : assessmentHistory[assessmentHistory.length - 1] || ({} as Record<CapabilityId, ObservationLevel>);
  const missedRunCounts = buildMissedRunCounts(assessmentHistory);

  const capabilityDrivers: CapabilityDriver[] = [];
  let resistanceVotes = 0;
  let engagementVotes = 0;
  let objectionEscalation = false;
  const predictedObjections: string[] = [];
  const predictedDrivers: string[] = [];

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
        predictedDrivers.push("HCP is becoming dismissive because concerns have been talked past repeatedly.");
      } else {
        predictedDrivers.push("HCP concern was not addressed, so mild frustration is building.");
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
      capabilityDrivers.push({ capability: "objection_navigation", assessment: a, influence: "Objections were acknowledged but the rep moved to justification too quickly — objections persist." });
    } else {
      resistanceVotes += 2;
      objectionEscalation = true;
      if (missedRunCounts["objection_navigation"] >= 2) {
        resistanceVotes += 2;
        predictedDrivers.push("Repeated failure to navigate objections is escalating resistance and causing the HCP to restate the blocker more sharply.");
      } else {
        predictedDrivers.push("The objection was not genuinely engaged, so the HCP will likely repeat or sharpen it.");
      }
      const pressures = scenario.interactionPressure || [];
      if (pressures.includes("access_barrier") || pressures.includes("operationally_constrained")) predictedObjections.push("Access or workflow burden concerns");
      if (pressures.includes("safety_concern")) predictedObjections.push("Safety or risk concerns");
      if (pressures.includes("competitive_bias")) predictedObjections.push("Loyalty to current therapy");
      if (pressures.includes("skeptical_resistant")) predictedObjections.push("Evidence or relevance skepticism");
      capabilityDrivers.push({ capability: "objection_navigation", assessment: a, influence: "Objections were not genuinely navigated — the HCP will escalate or repeat concerns." });
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
        predictedDrivers.push("Rep is repeating the same approach, so the HCP is becoming rigid and resistant.");
      }
      capabilityDrivers.push({ capability: "adaptability", assessment: a, influence: "Rep repeated the same approach despite changing conditions — HCP is becoming rigid." });
    }
  }

  {
    const a = assessment["commitment_gaining"];
    if (a === "effective") {
      capabilityDrivers.push({ capability: "commitment_gaining", assessment: a, influence: "A clear next-step ask was made — HCP is moving toward next-step readiness." });
    } else if (a === "developing") {
      predictedDrivers.push("Next-step intent was signaled but not clearly asked, so the HCP may offer passive agreement without action.");
      capabilityDrivers.push({ capability: "commitment_gaining", assessment: a, influence: "Rep hinted at next steps without securing a specific commitment — passive agreement is likely." });
    } else {
      predictedDrivers.push("No meaningful next-step attempt was made, so the HCP will likely deflect or delay.");
      capabilityDrivers.push({ capability: "commitment_gaining", assessment: a, influence: "No commitment attempt was made — HCP will deflect or end without a clear path forward." });
    }
  }

  const pressures = scenario.interactionPressure || [];
  if (pressures.includes("time_constrained")) {
    resistanceVotes += 1;
    predictedDrivers.push("Time pressure is still active, so HCP tolerance for extended exchanges is low.");
  }
  if (pressures.includes("skeptical_resistant") && resistanceVotes > 0) resistanceVotes += 1;
  if (pressures.includes("curious_uncertain") && engagementVotes > 0) engagementVotes += 1;

  const persona = scenario.persona || "";
  if (persona === "skeptical_specialist" && resistanceVotes > 1) resistanceVotes += 1;
  if (persona === "time_constrained_community_doctor") {
    predictedDrivers.push("This HCP pattern quickly converts frustration into disengagement.");
  }
  if (persona === "curious_uncertain_adopter" && engagementVotes > 0) engagementVotes += 1;

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
  if (journeyState === "objection_phase" && assessment["objection_navigation"] !== "effective" && predictedBehaviorState === "openness") {
    predictedBehaviorState = "curiosity";
  }

  const predictedEngagementPattern =
    engagementVotes >= 3 ? "HCP is actively participating and building on rep input." :
    engagementVotes >= 1 ? "HCP is moderately engaged but not initiating." :
    resistanceVotes >= 3 ? "HCP is pulling back and giving minimal responses." :
    "HCP is present but passive and waiting for a reason to engage.";

  const hcpState = computeHcpState(
    signals,
    scenario?.persona || "",
    scenario?.interactionPressure || [],
    scenario?.startingBehaviorState || "neutral",
  );
  const concernFamily = deriveConcernFamily(scenario);
  const scenarioDomain = deriveScenarioDomain(scenario);
  const scenarioFamily = deriveFamilyTemperamentControls(scenario).familyKey;
  const contextProfile = deriveScenarioPredictiveContext(scenario, concernFamily, scenarioDomain);
  const riskLevel = maxRiskLevel(hcpState.riskLevel, predictedResistanceLevel);
  const nextLikelyBehavior = buildNextLikelyBehavior(predictedBehaviorState, concernFamily, hcpState, scenario);

  return {
    openness: hcpState.openness,
    opennessScore: hcpState.opennessScore,
    trajectory: hcpState.trajectory,
    riskLevel,
    nextLikelyBehavior,
    predictedBehaviorState,
    predictedResistanceLevel,
    predictedDrivers: dedupeStrings(predictedDrivers),
    predictedObjections: dedupeStrings(predictedObjections),
    predictedEngagementPattern,
    concernFamily,
    scenarioDomain,
    scenarioFamily,
    contextProfile,
    assessmentSnapshot: assessment,
    missedRunCounts,
    capabilityDrivers,
  };
}
