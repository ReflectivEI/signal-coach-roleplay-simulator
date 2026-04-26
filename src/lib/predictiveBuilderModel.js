import {
  DISEASE_STATES,
  HCP_TYPES,
  INFLUENCE_DRIVERS,
  INTERACTION_PRESSURES,
  JOURNEY_STAGES,
} from "@/components/home/ScenarioFilters";

export const PREDICTIVE_SELECTOR_OPTIONS = {
  diseaseState: DISEASE_STATES.filter((opt) => opt.value !== "all"),
  hcpType: HCP_TYPES.filter((opt) => opt.value !== "all"),
  journeyStage: JOURNEY_STAGES.filter((opt) => opt.value !== "all"),
  interactionPressure: INTERACTION_PRESSURES.filter((opt) => opt.value !== "all"),
  influenceDriver: INFLUENCE_DRIVERS.filter((opt) => opt.value !== "all"),
  behaviorArchetype: [
    { value: "time_constrained_community_doctor", label: "Guarded Gatekeeper" },
    { value: "skeptical_specialist", label: "Skeptical Specialist" },
    { value: "curious_uncertain_adopter", label: "Curious Uncertain Adopter" },
    { value: "cost_focused_decision_maker", label: "Cost-Focused Decision Maker" },
  ],
};

export const scenarioPredictivePresets = {
  "The Gatekeeper Filter": {
    journeyStage: "Initial Access",
    interactionPressure: ["Time Constrained", "Operationally Constrained"],
    influenceDriver: "Practical / Workflow-Oriented",
    behaviorArchetype: "Guarded Gatekeeper",
    coreFriction: "Access + workflow burden",
  },
  "The Guideline Anchor": {
    journeyStage: "Clinical Value",
    interactionPressure: ["Skeptical / Resistant", "Competitive Bias"],
    influenceDriver: "Guideline-Anchored",
    behaviorArchetype: "Skeptical Specialist",
    coreFriction: "Guideline lock vs real-world variability",
  },
  "The Workflow Bottleneck": {
    journeyStage: "Adoption & Implementation",
    interactionPressure: ["Operationally Constrained"],
    influenceDriver: "Patient-Centric",
    behaviorArchetype: "Guarded Gatekeeper",
    coreFriction: "Workflow capacity vs clinical intent",
  },
};

const PROFILE_BY_ARCHETYPE = {
  time_constrained_community_doctor: {
    mindset: "Focused on patient flow and practical feasibility before clinical nuance.",
    likelyObjections: "This will add friction to already constrained office operations.",
    responseStyle: "Brief, direct, quickly redirects to workflow realities.",
    repApproach: "Lead with one workflow-reducing step and ask for a narrow next action.",
    resistanceTriggers: "Long data monologues, vague promises, or abstract positioning.",
  },
  skeptical_specialist: {
    mindset: "Evaluates claims through evidence quality and fit to real patient populations.",
    likelyObjections: "Data relevance, edge cases, and over-generalized value claims.",
    responseStyle: "Analytical, challenging, and selective about what is credible.",
    repApproach: "Acknowledge concern, ask precision questions, then tie evidence to this panel.",
    resistanceTriggers: "Defensive rebuttals and unsupported comparisons.",
  },
  curious_uncertain_adopter: {
    mindset: "Open to change but cautious about implementation risk.",
    likelyObjections: "Unclear first-step criteria and uncertainty about execution.",
    responseStyle: "Collaborative but non-committal without clear activation path.",
    repApproach: "Co-create explicit patient criteria and secure a time-bound micro-commitment.",
    resistanceTriggers: "Hard close before alignment on practical next steps.",
  },
  cost_focused_decision_maker: {
    mindset: "Looks for measurable patient benefit relative to financial and access burden.",
    likelyObjections: "Budget impact, payer friction, and implementation tradeoffs.",
    responseStyle: "Outcome-and-value oriented, asks for practical proof points.",
    repApproach: "Connect one outcome delta to a concrete value metric this HCP tracks.",
    resistanceTriggers: "High-level efficacy talk without cost or access context.",
  },
};

const PRESSURE_SIGNALS = {
  time_constrained: "Compressed replies, interrupting for prioritization, asks for immediate relevance.",
  operationally_constrained: "References staffing limits, process burden, and implementation fatigue.",
  skeptical_resistant: "Pushback language, challenges framing, tests credibility before engagement.",
  competitive_bias: "Compares against incumbent choice and discounts incremental differences.",
  safety_concern: "Risk-first questioning, seeks confidence boundaries and escalation paths.",
  access_barrier: "Coverage/formulary concerns dominate willingness to discuss clinical fit.",
  curious_uncertain: "Engaged questions with hesitation around execution confidence.",
};

const INFLUENCE_LENS = {
  patient_centric: "patient impact and day-to-day care practicality",
  evidence_driven: "strength of evidence and real-world applicability",
  risk_averse: "downside control and confidence in safe adoption",
  guideline_anchored: "guideline alignment and defensible decision logic",
};

export function buildPredictiveProfile(selection) {
  const archetypeProfile = PROFILE_BY_ARCHETYPE[selection.behaviorArchetype];
  const pressureSignal = PRESSURE_SIGNALS[selection.interactionPressure] || "Signals are mixed and context-dependent.";
  const influenceLens = INFLUENCE_LENS[selection.influenceDriver] || "practical decision logic";

  return {
    mindset: `${archetypeProfile.mindset} Primary lens: ${influenceLens}.`,
    likelyObjections: archetypeProfile.likelyObjections,
    pressureSignals: pressureSignal,
    redFlags: `Conversation drifts from ${selection.journeyStage.replaceAll("_", " ")} realities into generic framing that ignores ${selection.interactionPressure.replaceAll("_", " ")} pressure.`,
    languageThatWorks: `Use specific, role-fit language tied to ${selection.diseaseState.replaceAll("_", " ")} decisions for ${selection.hcpType.replaceAll("_", " ")} contexts.`,
    languageThatTriggersResistance: archetypeProfile.resistanceTriggers,
    predictedResponseStyle: archetypeProfile.responseStyle,
    recommendedRepApproach: archetypeProfile.repApproach,
  };
}
