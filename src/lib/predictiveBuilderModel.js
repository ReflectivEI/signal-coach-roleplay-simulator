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
  "Gatekeeper Filter": {
    diseaseState: "primary_care",
    hcpType: "treating_clinician",
    journeyStage: "initial_access",
    interactionPressure: "operationally_constrained",
    influenceDriver: "patient_centric",
    behaviorArchetype: "time_constrained_community_doctor",
  },
};

const LABEL_LOOKUP = {
  diseaseState: Object.fromEntries(DISEASE_STATES.map((opt) => [opt.value, opt.label])),
  hcpType: Object.fromEntries(HCP_TYPES.map((opt) => [opt.value, opt.label])),
  journeyStage: Object.fromEntries(JOURNEY_STAGES.map((opt) => [opt.value, opt.label])),
  interactionPressure: Object.fromEntries(INTERACTION_PRESSURES.map((opt) => [opt.value, opt.label])),
  influenceDriver: Object.fromEntries(INFLUENCE_DRIVERS.map((opt) => [opt.value, opt.label])),
  behaviorArchetype: Object.fromEntries(PREDICTIVE_SELECTOR_OPTIONS.behaviorArchetype.map((opt) => [opt.value, opt.label])),
};

const DISEASE_SIGNAL = {
  pulmonology: "Respiratory management usually increases the need for tight protocol fit and clear next-step planning.",
  cardiology: "Cardiovascular decisions often demand measurable outcomes and crisp risk framing.",
  rheumatology: "Autoimmune care tends to raise questions about long-horizon control and office workflow.",
  neurology: "Neurologic care usually pushes for careful sequencing, patient selection, and follow-up clarity.",
  oncology: "Oncology care brings high cognitive load, coordination burden, and careful patient-by-patient evaluation.",
  nephrology: "Renal care often adds monitoring complexity and tighter safety boundaries.",
  dermatology: "Dermatology decisions usually focus on straightforward workflow fit and visible patient benefit.",
  hematology: "Hematology often needs precision, monitoring discipline, and a clearly defensible path forward.",
  gastroenterology: "GI care can bring administrative friction, multi-step workups, and practical access questions.",
  endocrinology: "Endocrine care often balances chronic follow-up, patient adherence, and efficient office routines.",
  primary_care: "Primary care tends to amplify time pressure, broad patient panels, and the need for low-friction action.",
};

function normalizeSelection(selection = {}) {
  return {
    diseaseState: selection.diseaseState || "primary_care",
    hcpType: selection.hcpType || "treating_clinician",
    journeyStage: selection.journeyStage || "initial_access",
    interactionPressure: selection.interactionPressure || "time_constrained",
    influenceDriver: selection.influenceDriver || "patient_centric",
    behaviorArchetype: selection.behaviorArchetype || "time_constrained_community_doctor",
  };
}

function labelFor(type, value) {
  return LABEL_LOOKUP[type]?.[value] || value;
}

function joinBullets(items = []) {
  return items.filter(Boolean);
}

function diseaseSignal(selection) {
  return DISEASE_SIGNAL[selection.diseaseState] || "This setting rewards practical, role-fit, and scenario-specific reasoning.";
}

function stageSignal(selection) {
  const stage = selection.journeyStage;
  if (stage === "access_formulary") {
    return "The conversation is likely to surface payer friction, pathway questions, and approval hurdles early.";
  }
  if (stage === "adoption_implementation") {
    return "The conversation will likely hinge on who owns the next workflow step and how that fits the office.";
  }
  if (stage === "commitment_close") {
    return "The HCP is likely deciding whether the rep has earned a clear next action.";
  }
  if (stage === "objection_handling") {
    return "The HCP is likely to narrow in on a specific objection and expect a direct response.";
  }
  return "The HCP will likely test whether the rep can make the issue concrete quickly.";
}

function pressureTone(selection) {
  const pressure = selection.interactionPressure;
  if (pressure === "time_constrained") return "High";
  if (pressure === "operationally_constrained") return "High";
  if (pressure === "access_barrier") return "High";
  if (pressure === "skeptical_resistant") return "High";
  if (pressure === "safety_concern") return "Moderate to high";
  if (pressure === "competitive_bias") return "Moderate";
  return "Moderate";
}

function mapTimePressure(selection) {
  const archetype = selection.behaviorArchetype;
  const pressure = selection.interactionPressure;
  const stage = selection.journeyStage;
  if (pressure === "time_constrained" || archetype === "time_constrained_community_doctor") {
    return `High: the HCP wants one concrete point, not a long build. ${stage === "commitment_close" ? "They are especially impatient for a decision." : "They will prune anything that sounds optional."}`;
  }
  if (pressure === "operationally_constrained") {
    return `High: the HCP is measuring every minute against staff load and task switching. ${stageSignal(selection)}`;
  }
  if (pressure === "access_barrier") {
    return `Moderate to high: the HCP is willing to listen only if the access path is explicit and realistic.`;
  }
  return `Moderate: the HCP can engage, but only if the rep stays concrete and relevant.`;
}

function mapWorkflowBurden(selection) {
  const stage = selection.journeyStage;
  const pressure = selection.interactionPressure;
  const hcpType = selection.hcpType;
  if (pressure === "operationally_constrained") {
    return `High: ${labelFor("hcpType", hcpType).toLowerCase()}s in ${labelFor("journeyStage", stage).toLowerCase()} mode will challenge any added step that is not obviously light.`;
  }
  if (stage === "adoption_implementation") {
    return "Moderate to high: the HCP will ask who owns the step, what gets added, and what disappears.";
  }
  if (hcpType === "thought_leader") {
    return "Moderate: the HCP still wants practicality, but will tolerate more structure if the end-state is defensible.";
  }
  return "Moderate: workflow burden matters, but it may not be the only thing they ask about.";
}

function mapCognitiveLoad(selection) {
  const disease = selection.diseaseState;
  const pressure = selection.interactionPressure;
  if (disease === "oncology" || disease === "hematology" || disease === "neurology") {
    return `High: the disease state itself creates more moving parts, so the HCP will prefer sharper, more organized answers.`;
  }
  if (pressure === "skeptical_resistant" || pressure === "safety_concern") {
    return "High: the HCP is likely to filter every claim through more than one lens before moving forward.";
  }
  if (disease === "primary_care" || disease === "gastroenterology") {
    return "Moderate to high: the HCP is balancing multiple priorities, so generic framing will get dropped fast.";
  }
  return "Moderate: the HCP is attentive, but only if the rep keeps the structure simple and specific.";
}

function generateMindset(selection) {
  const archetype = labelFor("behaviorArchetype", selection.behaviorArchetype);
  const driver = labelFor("influenceDriver", selection.influenceDriver);
  const stage = labelFor("journeyStage", selection.journeyStage);
  const pressure = selection.interactionPressure;

  if (pressure === "operationally_constrained" && driver === "Patient-Centric") {
    return `${archetype} that wants the plan to improve patient care without creating visible office friction.`;
  }
  if (pressure === "skeptical_resistant" && driver === "Evidence-Driven") {
    return `${archetype} that wants one clinically relevant reason to listen before it spends more attention.`;
  }
  if (pressure === "access_barrier" || stage === "access_formulary") {
    return `${archetype} that is weighing whether the access path is real enough to justify further discussion.`;
  }
  if (selection.diseaseState === "oncology" || selection.diseaseState === "hematology") {
    return `${archetype} that is cautious because the care path is complex and the margin for vague advice is low.`;
  }
  return `${archetype} that is willing to engage if the rep can make the next step practical, relevant, and easy to evaluate.`;
}

function generateDecisionStyle(selection) {
  const pressure = selection.interactionPressure;
  const stage = selection.journeyStage;
  const driver = selection.influenceDriver;
  if (pressure === "time_constrained" || stage === "commitment_close") {
    return "Fast, narrow, and threshold-based: one clear answer, then a decision about whether to keep going.";
  }
  if (pressure === "skeptical_resistant" || driver === "evidence_driven") {
    return "Evidence-gated: the HCP decides only after the rep proves relevance to this setting.";
  }
  if (pressure === "operationally_constrained") {
    return "Workflow-gated: the HCP decides after the rep shows what gets easier for staff.";
  }
  return "Conditional: the HCP will keep moving only if every step stays concrete and earned.";
}

function generateRisk(selection) {
  const pressure = selection.interactionPressure;
  const driver = selection.influenceDriver;
  const stage = selection.journeyStage;
  if (pressure === "safety_concern" || driver === "risk_averse") {
    return "Low tolerance for uncertainty; the HCP will want guardrails and boundaries before moving.";
  }
  if (pressure === "access_barrier" || stage === "access_formulary") {
    return "Moderate to low tolerance for change unless the access burden is clearly reduced.";
  }
  if (selection.behaviorArchetype === "curious_uncertain_adopter") {
    return "Moderate tolerance: willing to consider the idea, but easy to lose if the next step is vague.";
  }
  return "Moderate: the HCP will move, but only if the rep earns trust with concrete detail.";
}

function deriveOpenness(selection) {
  const pressure = selection.interactionPressure;
  const archetype = selection.behaviorArchetype;
  const stage = selection.journeyStage;
  if (pressure === "time_constrained" || pressure === "operationally_constrained") return "Guarded but open to one practical point.";
  if (pressure === "skeptical_resistant") return "Selective openness; the HCP opens only when the rep stays clinically tight.";
  if (archetype === "curious_uncertain_adopter") return "Moderately open, but only with a clear implementation path.";
  if (stage === "commitment_close") return "Narrowly open; the HCP wants a last convincing reason.";
  return "Open enough to continue, but not enough to carry the rep.";
}

function deriveSkepticism(selection) {
  const driver = selection.influenceDriver;
  const pressure = selection.interactionPressure;
  const archetype = selection.behaviorArchetype;
  if (driver === "evidence_driven" && pressure === "skeptical_resistant") {
    return "Very high — requires clinically relevant proof, not generic value claims.";
  }
  if (driver === "guideline_anchored" && selection.journeyStage === "access_formulary") {
    return "High — wants the rep to show defensible fit to current practice standards.";
  }
  if (archetype === "time_constrained_community_doctor") {
    return "Moderate to high — skeptical of anything that does not clearly save time.";
  }
  return "Moderate — the HCP is asking questions, not granting trust.";
}

function deriveEngagement(selection) {
  const pressure = selection.interactionPressure;
  const stage = selection.journeyStage;
  const archetype = selection.behaviorArchetype;
  if (pressure === "time_constrained" || stage === "initial_access") return "Clipped but attentive; one good move can hold attention.";
  if (pressure === "operationally_constrained") return "Measured and constrained; the HCP rewards brevity and practical relevance.";
  if (pressure === "skeptical_resistant") return "Engaged only when the rep earns it; otherwise the HCP narrows quickly.";
  if (archetype === "cost_focused_decision_maker") return "Decision-focused; engagement rises only when value is concrete.";
  return "Stable but selective; the HCP stays in the conversation while it remains useful.";
}

function derivePrimaryObjection(selection) {
  const pressure = selection.interactionPressure;
  const stage = selection.journeyStage;
  if (pressure === "operationally_constrained") {
    return "This looks like another step that could slow the office down.";
  }
  if (pressure === "access_barrier" || stage === "access_formulary") {
    return "I need to know what happens on the access side before this matters.";
  }
  if (pressure === "skeptical_resistant") {
    return "I’m not hearing a strong enough reason to change what we already do.";
  }
  if (selection.behaviorArchetype === "curious_uncertain_adopter") {
    return "I need a clearer starting point before I can say yes.";
  }
  return "I need a concrete reason this is worth my time.";
}

function deriveSecondaryObjections(selection) {
  const secondary = [];
  if (selection.diseaseState === "oncology" || selection.diseaseState === "hematology") {
    secondary.push("This feels complex enough that any extra step could multiply quickly.");
  } else if (selection.diseaseState === "primary_care") {
    secondary.push("My panel is already busy, so this has to be very easy to own.");
  } else {
    secondary.push("I’m not sure the current workflow has room for extra noise.");
  }

  if (selection.influenceDriver === "evidence_driven") {
    secondary.push("I want to see that this is relevant to the patients in front of me.");
  } else if (selection.influenceDriver === "risk_averse") {
    secondary.push("I need to know the risk boundaries before I lean in.");
  } else {
    secondary.push("I want the next step to be practical, not theoretical.");
  }

  return joinBullets(secondary);
}

function deriveTriggers(selection) {
  const triggers = [];
  if (selection.interactionPressure === "time_constrained") triggers.push("Long explanations.");
  if (selection.interactionPressure === "operationally_constrained") triggers.push("Any hint of extra staff burden.");
  if (selection.interactionPressure === "skeptical_resistant") triggers.push("Generic claims without proof.");
  if (selection.interactionPressure === "access_barrier") triggers.push("Ignoring coverage or approval steps.");
  if (selection.behaviorArchetype === "cost_focused_decision_maker") triggers.push("Value claims without measurable impact.");
  if (selection.journeyStage === "commitment_close") triggers.push("A soft close without one concrete next action.");
  if (!triggers.length) triggers.push("Anything that stays abstract for too long.");
  return joinBullets(triggers);
}

function generatePreferredLanguage(selection) {
  const driver = selection.influenceDriver;
  const stage = selection.journeyStage;
  const disease = labelFor("diseaseState", selection.diseaseState);
  const pressure = selection.interactionPressure;

  const preferred = [];
  if (driver === "evidence_driven") preferred.push("Clinical proof tied to this patient group.");
  if (driver === "patient_centric") preferred.push("Patient impact that stays rooted in daily care.");
  if (driver === "guideline_anchored") preferred.push("Language that maps cleanly to accepted practice.");
  if (pressure === "operationally_constrained") preferred.push("One-step workflow language.");
  if (stage === "access_formulary") preferred.push("Access and pathway clarity.");
  preferred.push(`Concrete ${disease} examples.`);
  return joinBullets(preferred);
}

function generateRejectedLanguage(selection) {
  const rejected = [];
  if (selection.interactionPressure === "time_constrained") rejected.push("Long pitch language.");
  if (selection.interactionPressure === "skeptical_resistant") rejected.push("Polished but unsupported claims.");
  if (selection.interactionPressure === "operationally_constrained") rejected.push("Abstract burden talk without a workflow change.");
  if (selection.influenceDriver === "risk_averse") rejected.push("Overconfident language with no boundary setting.");
  rejected.push("Anything that sounds generic across scenarios.");
  return joinBullets(rejected);
}

function generateQuestionStyle(selection) {
  const stage = selection.journeyStage;
  const pressure = selection.interactionPressure;
  const archetype = selection.behaviorArchetype;
  if (pressure === "time_constrained" || archetype === "time_constrained_community_doctor") return "Short, single-point questions that cut to the operational step.";
  if (pressure === "skeptical_resistant") return "Narrow challenge questions that ask for evidence fit and practical relevance.";
  if (stage === "commitment_close") return "Decision-threshold questions that ask for one last concrete reason to move forward.";
  if (pressure === "operationally_constrained") return "Workflow questions that ask what changes for staff, not just why the idea is good.";
  return "Selective questions that stay on the current barrier instead of drifting.";
}

function generateTurnBehavior(selection) {
  const pressure = selection.interactionPressure;
  const stage = selection.journeyStage;
  if (pressure === "time_constrained") return "Short reply, one question at most, then a direct redirect.";
  if (pressure === "skeptical_resistant") return "Push back once, then narrow toward a concrete proof point.";
  if (pressure === "operationally_constrained") return "Redirect to workflow fit and keep the conversation bounded.";
  if (stage === "commitment_close") return "Force the rep to make the next move concrete or risk losing momentum.";
  return "Keep the exchange practical, bounded, and anchored to the scenario.";
}

function generateEscalation(selection) {
  const pressure = selection.interactionPressure;
  const stage = selection.journeyStage;
  if (pressure === "skeptical_resistant" || stage === "objection_handling") {
    return "Escalates from clarification to direct challenge if the rep stays vague.";
  }
  if (pressure === "time_constrained" || stage === "commitment_close") {
    return "Escalates by narrowing the question and trimming away nonessential detail.";
  }
  if (pressure === "access_barrier") {
    return "Escalates by pressing on access path and practical feasibility.";
  }
  return "Escalates gradually: open, then narrow, then decide whether the rep earned more time.";
}

function generateDisengagement(selection) {
  const pressure = selection.interactionPressure;
  const stage = selection.journeyStage;
  const signals = [];
  if (pressure === "time_constrained") signals.push("shorter answers");
  if (pressure === "operationally_constrained") signals.push("checking the clock");
  if (pressure === "skeptical_resistant") signals.push("less patience for generic framing");
  if (stage === "commitment_close") signals.push("final threshold language");
  if (selection.behaviorArchetype === "curious_uncertain_adopter") signals.push("quietly withdrawing if the next step stays vague");
  if (!signals.length) signals.push("reduced willingness to continue if the rep stays abstract");
  return joinBullets(signals);
}

function generateRepStrategy(selection) {
  const stage = selection.journeyStage;
  const pressure = selection.interactionPressure;
  const driver = selection.influenceDriver;
  const strategy = [];
  if (pressure === "operationally_constrained") strategy.push("Lead with one workflow-reducing action.");
  if (pressure === "time_constrained") strategy.push("Answer fast, then narrow to the next step.");
  if (driver === "evidence_driven") strategy.push("Tie the point to a clinically relevant example.");
  if (driver === "guideline_anchored") strategy.push("Anchor the answer in defensible, familiar practice logic.");
  if (stage === "access_formulary") strategy.push("Address the approval path before expanding the pitch.");
  if (!strategy.length) strategy.push("Stay concrete, short, and tied to the HCP’s stated barrier.");
  return joinBullets(strategy);
}

function generateMistakes(selection) {
  const mistakes = [];
  if (selection.interactionPressure === "time_constrained") mistakes.push("Too much setup before the first concrete answer.");
  if (selection.interactionPressure === "operationally_constrained") mistakes.push("Talking benefits without reducing staff load.");
  if (selection.interactionPressure === "skeptical_resistant") mistakes.push("Generic evidence language that does not fit this setting.");
  if (selection.interactionPressure === "access_barrier") mistakes.push("Skipping the approval / coverage path.");
  if (selection.behaviorArchetype === "cost_focused_decision_maker") mistakes.push("Failing to show measurable value.");
  mistakes.push("Forcing a smooth close before the HCP has earned trust.");
  return joinBullets(mistakes);
}

export function buildPredictiveModel(selection) {
  const normalized = normalizeSelection(selection);

  return {
    persona: {
      archetype: labelFor("behaviorArchetype", normalized.behaviorArchetype),
      mindset: generateMindset(normalized),
      decisionStyle: generateDecisionStyle(normalized),
      riskTolerance: generateRisk(normalized),
    },

    pressures: {
      time: mapTimePressure(normalized),
      workflow: mapWorkflowBurden(normalized),
      cognitiveLoad: mapCognitiveLoad(normalized),
    },

    behavior: {
      openness: deriveOpenness(normalized),
      skepticism: deriveSkepticism(normalized),
      engagementPattern: deriveEngagement(normalized),
    },

    objections: {
      primary: derivePrimaryObjection(normalized),
      secondary: deriveSecondaryObjections(normalized),
      triggers: deriveTriggers(normalized),
    },

    language: {
      prefers: generatePreferredLanguage(normalized),
      rejects: generateRejectedLanguage(normalized),
      questionStyle: generateQuestionStyle(normalized),
    },

    conversationDynamics: {
      turnBehavior: generateTurnBehavior(normalized),
      escalationPattern: generateEscalation(normalized),
      disengagementSignals: generateDisengagement(normalized),
    },

    coaching: {
      repStrategy: generateRepStrategy(normalized),
      mistakesToAvoid: generateMistakes(normalized),
    },
  };
}

export function buildPredictiveProfile(selection) {
  const model = buildPredictiveModel(selection);
  return {
    mindset: model.persona.mindset,
    likelyObjections: [model.objections.primary, ...model.objections.secondary].join(" "),
    pressureSignals: [model.pressures.time, model.pressures.workflow].join(" "),
    redFlags: `The HCP will disengage if the rep ignores ${labelFor("journeyStage", normalizeSelection(selection).journeyStage)} pressure or keeps the answer generic.`,
    languageThatWorks: model.language.prefers.join(" "),
    languageThatTriggersResistance: model.language.rejects.join(" "),
    predictedResponseStyle: `${model.behavior.engagementPattern} ${model.conversationDynamics.turnBehavior}`,
    recommendedRepApproach: model.coaching.repStrategy.join(" "),
  };
}
