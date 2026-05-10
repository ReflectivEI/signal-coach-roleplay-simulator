import {
  DISEASE_STATES,
  HCP_TYPES,
  INFLUENCE_DRIVERS,
  INTERACTION_PRESSURES,
  JOURNEY_STAGES,
} from "@/lib/rpsUserInputOptions";

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
    canonical: {
      journeyStage: "initial_access",
      interactionPressure: ["time_constrained", "operationally_constrained"],
      influenceDriver: "patient_centric",
      behaviorArchetype: "time_constrained_community_doctor",
    },
  },
  "The Guideline Anchor": {
    journeyStage: "Clinical Value",
    interactionPressure: ["Skeptical / Resistant", "Competitive Bias"],
    influenceDriver: "Guideline-Anchored",
    behaviorArchetype: "Skeptical Specialist",
    coreFriction: "Guideline lock vs real-world variability",
    canonical: {
      journeyStage: "clinical_value",
      interactionPressure: ["skeptical_resistant", "competitive_bias"],
      influenceDriver: "guideline_anchored",
      behaviorArchetype: "skeptical_specialist",
    },
  },
  "The Workflow Bottleneck": {
    journeyStage: "Adoption & Implementation",
    interactionPressure: ["Operationally Constrained"],
    influenceDriver: "Patient-Centric",
    behaviorArchetype: "Guarded Gatekeeper",
    coreFriction: "Workflow capacity vs clinical intent",
    canonical: {
      journeyStage: "adoption_implementation",
      interactionPressure: ["operationally_constrained"],
      influenceDriver: "patient_centric",
      behaviorArchetype: "time_constrained_community_doctor",
    },
  },
};

const DISEASE_INTELLIGENCE = {
  pulmonology: {
    decisionRealities: [
      "Escalation choices are often constrained by prior exacerbation history, inhaler technique, and adherence uncertainty.",
      "Clinical confidence increases when real-world outcomes align with symptom control and exacerbation reduction in similar populations.",
      "Workflow burden rises quickly when therapy changes require extra coaching, follow-up calls, or payer documentation.",
    ],
    publicationThemes: [
      "GOLD strategy updates and practical implementation discussions in respiratory societies.",
      "Real-world outcome publications around exacerbation control, persistence, and healthcare utilization.",
      "Safety and tolerability narratives in long-term respiratory cohorts.",
    ],
    sourceSignals: [
      { name: "GOLD Reports", url: "https://goldcopd.org/" },
      { name: "American Thoracic Society", url: "https://www.thoracic.org/" },
      { name: "European Respiratory Society", url: "https://www.ersnet.org/" },
      { name: "NEJM", url: "https://www.nejm.org/" },
    ],
  },
  cardiology: {
    decisionRealities: [
      "Risk stratification and sequence-of-therapy logic dominate cardiology decisions.",
      "Guideline alignment and endpoint relevance are key to changing established prescribing habits.",
      "Coverage and affordability frequently determine whether intended therapy is clinically actionable.",
    ],
    publicationThemes: [
      "AHA/ACC updates and implementation commentary in major journals.",
      "Comparative effectiveness and outcomes in real-world cardiovascular populations.",
      "Safety and persistence trends across high-risk cohorts.",
    ],
    sourceSignals: [
      { name: "American Heart Association", url: "https://www.heart.org/" },
      { name: "American College of Cardiology", url: "https://www.acc.org/" },
      { name: "JACC", url: "https://www.jacc.org/" },
      { name: "Circulation", url: "https://www.ahajournals.org/journal/circ" },
    ],
  },
  oncology: {
    decisionRealities: [
      "Treatment choices are heavily protocol-driven with high sensitivity to biomarker fit and line-of-therapy context.",
      "Evidence credibility depends on subgroup relevance, durability, and tolerability in complex patients.",
      "Competitive alternatives are usually top-of-mind and can anchor initial resistance.",
    ],
    publicationThemes: [
      "NCCN and ASCO practice updates that shape sequencing and treatment standards.",
      "Real-world evidence and observational outcomes by tumor subtype.",
      "Safety and quality-of-life narratives that influence adoption confidence.",
    ],
    sourceSignals: [
      { name: "NCCN", url: "https://www.nccn.org/" },
      { name: "ASCO", url: "https://www.asco.org/" },
      { name: "ESMO", url: "https://www.esmo.org/" },
      { name: "Journal of Clinical Oncology", url: "https://ascopubs.org/journal/jco" },
    ],
  },
  primary_care: {
    decisionRealities: [
      "Primary care choices balance broad population fit, practical workflow, and follow-up feasibility.",
      "Simple initiation criteria and low implementation friction increase prescribing confidence.",
      "Payer and pharmacy realities can outweigh theoretical clinical preference.",
    ],
    publicationThemes: [
      "Implementation-focused guidance from primary care associations.",
      "Real-world adherence and persistence insights in broad patient populations.",
      "Practice workflow and care-path optimization commentary.",
    ],
    sourceSignals: [
      { name: "American Academy of Family Physicians", url: "https://www.aafp.org/" },
      { name: "ACP", url: "https://www.acponline.org/" },
      { name: "JAMA", url: "https://jamanetwork.com/journals/jama" },
    ],
  },
};

const HCP_TYPE_INTELLIGENCE = {
  treating_clinician: {
    topDrivers: [
      "Immediate patient-fit clarity.",
      "Low-friction implementation path in current clinic workflow.",
      "Clear confidence boundaries for safety, access, and follow-up.",
    ],
  },
  influencer: {
    topDrivers: [
      "Cross-team relevance and transferability of outcomes.",
      "Decision logic that can be defended in peer conversations.",
      "Evidence and value framing usable beyond a single case.",
    ],
  },
  thought_leader: {
    topDrivers: [
      "Methodological rigor and subgroup validity.",
      "Consistency with evolving standards and expert discourse.",
      "Nuanced interpretation over simplified positioning claims.",
    ],
  },
};

const JOURNEY_STAGE_INTELLIGENCE = {
  initial_access: {
    predictivePriority: "Earn relevance in under one minute before discussing data depth.",
    failureMode: "Opening with broad positioning before clarifying what this HCP actually prioritizes.",
  },
  discovery: {
    predictivePriority: "Surface practical decision criteria before introducing treatment claims.",
    failureMode: "Assuming priorities instead of discovering clinical and workflow constraints.",
  },
  clinical_value: {
    predictivePriority: "Link outcomes to this HCP's exact patient segments and decision thresholds.",
    failureMode: "Presenting generalized efficacy without subgroup relevance.",
  },
  objection_handling: {
    predictivePriority: "De-escalate defensiveness by naming the concern and testing understanding first.",
    failureMode: "Counter-arguing before exploring the underlying risk or access blocker.",
  },
  adoption_implementation: {
    predictivePriority: "Translate value into a low-risk first-use plan the team can actually run.",
    failureMode: "High-level enthusiasm without practical execution steps.",
  },
  access_formulary: {
    predictivePriority: "Isolate the exact gate and provide process-ready support language.",
    failureMode: "Treating access as generic rather than gate-specific.",
  },
  commitment_close: {
    predictivePriority: "Secure one concrete owned next step with clear patient criteria.",
    failureMode: "Asking for broad commitment without practical ownership.",
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

function dedupe(values = []) {
  const seen = new Set();
  return values.filter((value) => {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) return false;
    seen.add(text);
    return true;
  });
}

function take(values = [], count = 4) {
  return dedupe(values).slice(0, count);
}

function buildSection(headline, factors, predictiveSignals, repMoves) {
  return {
    headline,
    keyFactors: take(factors, 5),
    predictiveSignals: take(predictiveSignals, 4),
    repMoves: take(repMoves, 4),
  };
}

function getDomainIntel(selection) {
  const diseaseIntel = DISEASE_INTELLIGENCE[selection.diseaseState] || {
    decisionRealities: [
      "Clinical adoption depends on role-fit evidence, implementation feasibility, and confidence boundaries.",
    ],
    publicationThemes: [
      "Guideline updates, real-world outcomes, and safety trend monitoring in specialty publications.",
    ],
    sourceSignals: [
      { name: "FDA Drug Safety Communications", url: "https://www.fda.gov/drugs/drug-safety-and-availability/drug-safety-communications" },
      { name: "PubMed", url: "https://pubmed.ncbi.nlm.nih.gov/" },
    ],
  };

  const hcpIntel = HCP_TYPE_INTELLIGENCE[selection.hcpType] || {
    topDrivers: [
      "Relevant outcomes and practical implementation confidence.",
      "Clarity on risk, access, and patient-fit boundaries.",
    ],
  };

  const stageIntel = JOURNEY_STAGE_INTELLIGENCE[selection.journeyStage] || {
    predictivePriority: "Keep the conversation decision-relevant and practically actionable.",
    failureMode: "Staying generic when the HCP needs specific application guidance.",
  };

  return { diseaseIntel, hcpIntel, stageIntel };
}

export function buildPredictiveProfile(selection) {
  const archetypeProfile = PROFILE_BY_ARCHETYPE[selection.behaviorArchetype] || PROFILE_BY_ARCHETYPE.skeptical_specialist;
  const pressureSignal = PRESSURE_SIGNALS[selection.interactionPressure] || "Signals are mixed and context-dependent.";
  const influenceLens = INFLUENCE_LENS[selection.influenceDriver] || "practical decision logic";
  const { diseaseIntel, hcpIntel, stageIntel } = getDomainIntel(selection);

  const mindsetSection = buildSection(
    "How this HCP is most likely framing decisions",
    [
      archetypeProfile.mindset,
      ...hcpIntel.topDrivers,
      ...diseaseIntel.decisionRealities,
    ],
    [
      `Primary lens is ${influenceLens}.`,
      `At ${selection.journeyStage.replaceAll("_", " ")} stage, this HCP prioritizes ${stageIntel.predictivePriority.toLowerCase()}`,
      "Expect skepticism to increase when claims are not tied to patient-selection logic.",
    ],
    [
      "Lead with one role-specific patient profile before broad clinical framing.",
      "Anchor to what this HCP already tracks in daily decisions.",
      "Confirm practical constraints before introducing additional data.",
    ],
  );

  const objectionsSection = buildSection(
    "Most probable objections you should anticipate",
    [
      archetypeProfile.likelyObjections,
      "Requests for subgroup relevance instead of average population claims.",
      "Pushback if implementation burden is unclear.",
      "Questions about comparative fit versus incumbent options.",
    ],
    [
      "Objections will usually sharpen after any generic efficacy statement.",
      "If access or workflow is implied but not addressed, resistance rises quickly.",
      "HCP is likely to test your precision before agreeing to next steps.",
    ],
    [
      "Acknowledge concern and ask one precision question before responding.",
      "Respond with patient-fit and workflow-fit in the same answer.",
      "Close each objection loop with a concrete, low-risk next step.",
    ],
  );

  const pressureSection = buildSection(
    "Behavioral pressure pattern to read in real time",
    [
      pressureSignal,
      "Time pressure often appears as shorter turns, not always explicit rejection.",
      "Engagement drops when the rep does not mirror the HCP's decision pace.",
      "Operational friction concerns can mask clinical openness.",
    ],
    [
      "Likely response style: " + archetypeProfile.responseStyle,
      "When pressured, this HCP favors bottom-line utility over full narrative detail.",
      "Sustained relevance improves probability of specific follow-up questions.",
    ],
    [
      "Use shorter turns with explicit 'why this matters now' framing.",
      "Offer one optional deeper-data path instead of forcing full detail.",
      "Check for agreement on one decision variable at a time.",
    ],
  );

  const redFlagsSection = buildSection(
    "Conversation red flags that predict outcome risk",
    [
      `Conversation drifts from ${selection.journeyStage.replaceAll("_", " ")} realities into generic framing that ignores ${selection.interactionPressure.replaceAll("_", " ")} pressure.`,
      stageIntel.failureMode,
      "Defensive tone after objections predicts reduced next-step ownership.",
      "Product-first monologues increase disengagement and competitive fallback.",
    ],
    [
      "Risk of stalled conversation rises when no patient-selection criteria are discussed.",
      "Risk escalates if access and workflow blockers are acknowledged but not operationalized.",
      "Low specificity often leads to polite but non-committal closure.",
    ],
    [
      "If red flags appear, reset with one clarifying question tied to current patient mix.",
      "Reframe using concrete next-step ownership instead of broader claims.",
      "Prioritize accuracy and relevance over completeness.",
    ],
  );

  const languageWorksSection = buildSection(
    "Language patterns that usually increase receptivity",
    [
      `Use specific, role-fit language tied to ${selection.diseaseState.replaceAll("_", " ")} decisions for ${selection.hcpType.replaceAll("_", " ")} contexts.`,
      "Patient-segment phrasing with clear inclusion boundaries.",
      "Workflow-specific wording that identifies who does what next.",
      "Evidence phrasing that links trial signal to local clinical reality.",
    ],
    [
      "Receptivity improves when value is translated into one practical decision consequence.",
      "Credibility rises when uncertainty boundaries are named directly.",
      "This HCP responds best to concise, decision-ready language.",
    ],
    [
      "Use: 'For the patients you described, the practical difference is ...'",
      "Use: 'The first step most teams try is ...'",
      "Use: 'The evidence is strongest in ... and less certain in ...'",
    ],
  );

  const languageResistanceSection = buildSection(
    "Language patterns that usually trigger resistance",
    [
      archetypeProfile.resistanceTriggers,
      "Unqualified superlatives without context.",
      "Abstract value claims disconnected from this clinic's workflow.",
      "Comparative claims without clear patient-fit qualifiers.",
    ],
    [
      "Resistance signals often appear as requests for narrowing scope.",
      "HCP may pivot to access or safety as a control response if messaging feels broad.",
      "Tone hardens when rep language sounds scripted or defensive.",
    ],
    [
      "Avoid over-claiming; use bounded language with clear qualifiers.",
      "Replace generic value statements with one specific care-path implication.",
      "If challenged, restate concern before offering data.",
    ],
  );

  const responseStyleSection = buildSection(
    "Predicted conversational behavior in the next interaction",
    [
      archetypeProfile.responseStyle,
      "Will test practical relevance before allowing deeper conversation.",
      "Will likely narrow to one concern family if messaging is too broad.",
      "Decision momentum increases after role-specific evidence translation.",
    ],
    [
      "Most likely next move is probing for fit, risk boundary, or implementation burden.",
      "If you stay specific, expected trajectory shifts from resistance to cautious curiosity.",
      "If you stay generic, expected trajectory shifts to polite deferral.",
    ],
    [
      "Prepare one concise objection-ready response for the dominant pressure signal.",
      "Offer a micro-commitment rather than a broad adoption ask.",
      "Confirm interpretation before moving to your next claim.",
    ],
  );

  const repApproachSection = buildSection(
    "Recommended REP strategy for this exact profile",
    [
      archetypeProfile.repApproach,
      stageIntel.predictivePriority,
      "Balance clinical confidence with operational feasibility in every key answer.",
      "Sequence responses as: acknowledge -> clarify -> apply -> next step.",
    ],
    [
      "High-probability win condition is one owned, low-risk next action.",
      "Best predictor of success is role-fit relevance delivered early.",
      "Sustained precision lowers competitive and access-based deferral behavior.",
    ],
    [
      "Use a two-part answer: patient-fit evidence + implementation step.",
      "Close with a specific trial condition the HCP can evaluate.",
      "Document objection pattern for next territory touchpoint.",
    ],
  );

  const sourceSignals = take(diseaseIntel.sourceSignals, 5);

  return {
    mindset: `${archetypeProfile.mindset} Primary lens: ${influenceLens}.`,
    likelyObjections: archetypeProfile.likelyObjections,
    pressureSignals: pressureSignal,
    redFlags: `Conversation drifts from ${selection.journeyStage.replaceAll("_", " ")} realities into generic framing that ignores ${selection.interactionPressure.replaceAll("_", " ")} pressure.`,
    languageThatWorks: `Use specific, role-fit language tied to ${selection.diseaseState.replaceAll("_", " ")} decisions for ${selection.hcpType.replaceAll("_", " ")} contexts.`,
    languageThatTriggersResistance: archetypeProfile.resistanceTriggers,
    predictedResponseStyle: archetypeProfile.responseStyle,
    recommendedRepApproach: archetypeProfile.repApproach,
    sections: {
      mindset: mindsetSection,
      objections: objectionsSection,
      pressure: pressureSection,
      redFlags: redFlagsSection,
      languageWorks: languageWorksSection,
      languageResistance: languageResistanceSection,
      responseStyle: responseStyleSection,
      repApproach: repApproachSection,
    },
    evidenceIntel: {
      publicationThemes: take(diseaseIntel.publicationThemes, 4),
      sourceSignals,
      strategicNotes: [
        "Use publication signals to validate conversation framing, not to overwhelm the HCP with volume.",
        "Prioritize the 1-2 sources most aligned to this HCP's decision orientation.",
        "Translate evidence into actionable patient-selection and implementation implications.",
      ],
    },
  };
}
