export type SignalIntelligenceCapabilityId =
  | "question_quality"
  | "listening_responsiveness"
  | "making_it_matter"
  | "customer_engagement_signals"
  | "objection_navigation"
  | "conversation_control_structure"
  | "adaptability"
  | "commitment_gaining";

export interface SignalIntelligenceCapability {
  id: SignalIntelligenceCapabilityId;
  capability: string;   // canonical capability name from SOT
  metric: string;       // canonical metric name from SOT
  label: string;        // short display label
  definition: string;
  blurb: string;        // coaching-oriented summary
  whatGoodLooksLike: string[];
  whatToAvoid: string[];
}

// SOT canonical order (2.2.26): Signal Sensemaking (1-3), Signal Response (4-8)
// 1. Signal Awareness → Question Quality
// 2. Signal Interpretation → Listening & Responsiveness
// 3. Customer Engagement Monitoring → Customer Engagement Cues  ← moved to #3 per SOT 2.2.26
// 4. Value Connection → Value Framing (Making It Matter)        ← moved to #4 per SOT 2.2.26
// 5. Objection Navigation → Objection Handling
// 6. Conversation Management → Conversation Control & Structure
// 7. Adaptive Response → Adaptability
// 8. Commitment Generation → Commitment Gaining
export const SIGNAL_INTELLIGENCE_CAPABILITIES: SignalIntelligenceCapability[] = [
  {
    id: "question_quality",
    capability: "Signal Awareness",
    metric: "Question Quality",
    label: "Question Quality",
    definition: "Asking questions that are timely, relevant to the customer's context, and move the conversation forward.",
    blurb: "Strong question quality reflects what the rep is noticing. Effective questions are grounded in what the customer has already revealed and help advance clarity rather than just collect information.",
    whatGoodLooksLike: [
      "Uses open-ended questions that surface real barriers",
      "Explores clinical and practical decision criteria",
      "Questions are targeted to the HCP's specific context",
      "Avoids asking questions already answered"
    ],
    whatToAvoid: [
      "Leading questions that suggest a preferred answer",
      "Surface-level fact checks with no discovery value",
      "Jumping to solution before adequate discovery",
      "Stacking multiple questions in one turn"
    ]
  },
  {
    id: "listening_responsiveness",
    capability: "Signal Interpretation",
    metric: "Listening & Responsiveness",
    label: "Listening & Responsiveness",
    definition: "Accurately understanding customer input and responding in a way that clearly reflects that understanding.",
    blurb: "This shows whether the rep is making sense of what was said and adjusting accordingly. It is not about reacting, but demonstrating understanding through response.",
    whatGoodLooksLike: [
      "Directly references what the HCP just said",
      "Adjusts direction based on HCP's signal",
      "Acknowledges concern before responding",
      "Asks follow-up that builds on HCP's answer"
    ],
    whatToAvoid: [
      "Pivoting immediately to a talking point",
      "Ignoring or minimizing what the HCP raised",
      "Repeating the same message after an objection",
      "Talking past the HCP's actual concern"
    ]
  },
  {
    // #3 per SOT 2.2.26 — formerly #4
    id: "customer_engagement_signals",
    capability: "Customer Engagement Monitoring",
    metric: "Customer Engagement Cues",
    label: "Customer Engagement Cues",
    definition: "Noticing changes in customer participation and conversational momentum.",
    blurb: "Engagement changes over time. This reflects whether the rep is tracking participation, energy, and forward movement and recognizing when something shifts.",
    whatGoodLooksLike: [
      "Notices when the HCP becomes more specific or detailed",
      "Responds when the HCP signals disengagement",
      "Adjusts pace when interest or skepticism is visible",
      "Calibrates depth based on engagement level"
    ],
    whatToAvoid: [
      "Continuing a pitch when HCP has checked out",
      "Missing a moment when the HCP leans in",
      "Failing to read a topic shift as disinterest",
      "Treating all HCP responses as equivalent"
    ]
  },
  {
    // #4 per SOT 2.2.26 — formerly #3
    id: "making_it_matter",
    capability: "Value Connection",
    metric: "Value Framing",
    label: "Value Framing",
    definition: "Connecting information to customer-specific priorities and clearly explaining why it matters to them.",
    blurb: "Value is constructed, not delivered. This reflects how well the rep connects information to what the customer has indicated matters.",
    whatGoodLooksLike: [
      "Translates data into practical patient or workflow implications",
      "Ties the message to the HCP's stated priorities",
      "Makes relevance explicit rather than assumed",
      "Uses the HCP's language to frame the value"
    ],
    whatToAvoid: [
      "Generic efficacy claims without context",
      "Assuming relevance without confirming it",
      "Data dumping without interpretation",
      "Failing to connect clinical evidence to HCP's reality"
    ]
  },
  {
    id: "objection_navigation",
    capability: "Objection Navigation",
    metric: "Objection Handling",
    label: "Objection Handling",
    definition: "Responding to resistance with composure and engaging it in a way that sustains productive dialogue.",
    blurb: "Objections are signals of concern or uncertainty. Strong responses acknowledge and explore before attempting to resolve.",
    whatGoodLooksLike: [
      "Acknowledges the concern before responding",
      "Clarifies the specific nature of the objection",
      "Responds with information matched to the objection type",
      "Separates understanding from defending"
    ],
    whatToAvoid: [
      "Jumping to defense before understanding the concern",
      "Restating the same benefit that was already rejected",
      "Treating every objection as a product question",
      "Dismissing the concern to move forward"
    ]
  },
  {
    id: "conversation_control_structure",
    capability: "Conversation Management",
    metric: "Conversation Control & Structure",
    label: "Conversation Control & Structure",
    definition: "Providing clear direction and structure while guiding the conversation toward purposeful progress.",
    blurb: "This is about clarity, not control. Strong structure helps both parties stay aligned on purpose, flow, and next steps.",
    whatGoodLooksLike: [
      "Sets a clear agenda or purpose at the start",
      "Manages transitions between topics deliberately",
      "Keeps the conversation moving without rushing",
      "Summarizes when switching direction"
    ],
    whatToAvoid: [
      "Letting the conversation drift without recovery",
      "Over-controlling and leaving no space for the HCP",
      "Jumping between topics without bridging",
      "Losing track of the original objective"
    ]
  },
  {
    id: "adaptability",
    capability: "Adaptive Response",
    metric: "Adaptability",
    label: "Adaptability",
    definition: "Making timely, appropriate adjustments to approach based on what is happening in the interaction.",
    blurb: "Adaptability reflects real-time judgment. It shows whether the rep adjusts when signals change instead of following a fixed path.",
    whatGoodLooksLike: [
      "Changes depth or topic based on the HCP's signal",
      "Shifts from explanation to exploration when needed",
      "Responds to time pressure with focus rather than compression",
      "Adjusts language to match the HCP's communication style"
    ],
    whatToAvoid: [
      "Proceeding with a fixed plan regardless of HCP reaction",
      "Ignoring cues that the approach is not landing",
      "Using clinical detail with a non-clinical stakeholder",
      "Speeding up when the HCP slows down"
    ]
  },
  {
    id: "commitment_gaining",
    capability: "Commitment Generation",
    metric: "Commitment Gaining",
    label: "Commitment Gaining",
    definition: "Establishing clear next actions that are voluntarily owned by the customer.",
    blurb: "Commitment is alignment, not pressure. This reflects whether next steps are mutually understood and owned.",
    whatGoodLooksLike: [
      "Asks for a next step that matches the HCP's readiness",
      "Makes the ask specific and easy to agree to",
      "Confirms mutual understanding of what comes next",
      "Links the next step to what the HCP said matters"
    ],
    whatToAvoid: [
      "Ending without any next step or ask",
      "Over-asking before the HCP is ready",
      "Generic asks with no personalization",
      "Assuming a commitment was made when it was not"
    ]
  }
];

export const getCapability = (id: SignalIntelligenceCapabilityId): SignalIntelligenceCapability => {
  return SIGNAL_INTELLIGENCE_CAPABILITIES.find(c => c.id === id)!;
};

export const JOURNEY_STATE_LABELS: Record<string, string> = {
  initial_access: "Initial Access",
  early_discovery: "Early Discovery",
  clinical_value: "Clinical Value",
  objection_handling: "Objection Handling",
  access_formulary: "Access & Formulary",
  adoption_implementation: "Adoption & Implementation",
  commitment_close: "Commitment & Close",
};

export const BEHAVIOR_STATE_LABELS: Record<string, string> = {
  closed: "Closed",
  neutral: "Neutral",
  open: "Open",
  openness: "Openness",
  curiosity: "Curiosity",
  resistance: "Resistance",
  frustration: "Frustration",
  time_pressure: "Time Pressure",
};

export const PERSONA_LABELS: Record<string, string> = {
  skeptical_specialist: "Skeptical Specialist",
  time_constrained_community_doctor: "Time-Constrained Community Doctor",
  cost_focused_decision_maker: "Cost-Focused Decision Maker",
  curious_uncertain_adopter: "Curious but Uncertain Adopter"
};

export const PRESSURE_LABELS: Record<string, string> = {
  limited_time: "Limited Time",
  competing_priorities: "Competing Priorities",
  prior_auth_barriers: "Prior Auth Barriers",
  budget_constraints: "Budget Constraints",
  time_constrained: "Time Constrained",
  skeptical_resistant: "Skeptical / Resistant",
  curious_uncertain: "Curious / Uncertain",
  operationally_constrained: "Operationally Constrained",
  competitive_bias: "Competitive Bias",
  safety_concern: "Safety Concern",
  access_barrier: "Access Barrier"
};

export const HCP_ROLE_LABELS: Record<string, string> = {
  treating_clinician: "Treating Clinician",
  influencer: "Influencer",
  thought_leader: "Thought Leader"
};

export const DECISION_ORIENTATION_LABELS: Record<string, string> = {
  patient_centric: "Patient-Centric",
  evidence_driven: "Evidence-Driven",
  risk_averse: "Risk-Averse",
  guideline_anchored: "Guideline-Anchored"
};

export const JOURNEY_STAGE_LABELS: Record<string, string> = {
  initial_access: "Initial Access",
  early_discovery: "Early Discovery",
  clinical_value: "Clinical Value",
  objection_handling: "Objection Handling",
  adoption_implementation: "Adoption & Implementation",
  access_formulary: "Access & Formulary",
  commitment_close: "Commitment & Close"
};

export const BEHAVIOR_STATE_SIMPLE_LABELS: Record<string, string> = {
  closed: "Closed",
  neutral: "Neutral",
  open: "Open"
};
