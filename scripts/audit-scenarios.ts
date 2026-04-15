import { ALL_SCENARIOS } from "../src/lib/scenarioCatalog.js";
import { JOURNEY_STAGE_LABELS, JOURNEY_STATE_LABELS } from "../src/lib/signalIntelligence";

const allowedJourneyStages = new Set(Object.keys(JOURNEY_STAGE_LABELS));
const allowedJourneyStates = new Set(Object.keys(JOURNEY_STATE_LABELS));
const allowedHcpRoleTypes = new Set(["treating_clinician", "influencer", "thought_leader"]);
const allowedDecisionOrientations = new Set(["patient_centric", "evidence_driven", "risk_averse", "guideline_anchored"]);
const allowedPersonas = new Set(["skeptical_specialist", "time_constrained_community_doctor", "cost_focused_decision_maker", "curious_uncertain_adopter"]);
const allowedBehaviorStates = new Set(["closed", "neutral", "open", "openness", "curiosity", "resistance", "frustration", "time_pressure"]);
const allowedInteractionPressures = new Set(["time_constrained", "operationally_constrained", "skeptical_resistant", "competitive_bias", "safety_concern", "access_barrier", "curious_uncertain"]);
const allowedFocusCapabilities = new Set([
  "question_quality",
  "listening_responsiveness",
  "making_it_matter",
  "customer_engagement_signals",
  "objection_navigation",
  "conversation_control_structure",
  "adaptability",
  "commitment_gaining",
]);

const familySummary: Record<string, number> = {};
const issues: Array<{ title: string; field: string; value: string }> = [];

for (const scenario of ALL_SCENARIOS) {
  familySummary[scenario.journeyStage] = (familySummary[scenario.journeyStage] || 0) + 1;

  if (!allowedJourneyStages.has(scenario.journeyStage)) issues.push({ title: scenario.title, field: "journeyStage", value: String(scenario.journeyStage) });
  if (!allowedJourneyStates.has(scenario.journeyState)) issues.push({ title: scenario.title, field: "journeyState", value: String(scenario.journeyState) });
  if (!allowedHcpRoleTypes.has(scenario.hcpRoleType)) issues.push({ title: scenario.title, field: "hcpRoleType", value: String(scenario.hcpRoleType) });
  if (!allowedDecisionOrientations.has(scenario.decisionOrientation)) issues.push({ title: scenario.title, field: "decisionOrientation", value: String(scenario.decisionOrientation) });
  if (!allowedPersonas.has(scenario.persona)) issues.push({ title: scenario.title, field: "persona", value: String(scenario.persona) });
  if (!allowedBehaviorStates.has(scenario.startingBehaviorState)) issues.push({ title: scenario.title, field: "startingBehaviorState", value: String(scenario.startingBehaviorState) });

  for (const pressure of scenario.interactionPressure || []) {
    if (!allowedInteractionPressures.has(pressure)) {
      issues.push({ title: scenario.title, field: "interactionPressure", value: String(pressure) });
    }
  }

  for (const capability of scenario.suggestedFocusCapabilities || []) {
    if (!allowedFocusCapabilities.has(capability)) {
      issues.push({ title: scenario.title, field: "suggestedFocusCapabilities", value: String(capability) });
    }
  }

  if (!scenario.visualScene || String(scenario.visualScene).split(".").filter(Boolean).length > 3) {
    issues.push({ title: scenario.title, field: "visualScene", value: "opening scene missing or structurally long" });
  }
}

console.log(JSON.stringify({
  scenarioCount: ALL_SCENARIOS.length,
  familySummary,
  issues,
}, null, 2));
