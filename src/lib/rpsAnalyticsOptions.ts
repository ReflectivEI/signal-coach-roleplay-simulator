// Canonical analytics option arrays for RPS UX and reporting
export const LEARNING_PATH_MAP = {
  signal_awareness: {
    coachingModule: "Question Mastery",
    moduleDesc: "Learn to ask purposeful, context-aware questions",
    scenarios: ["HIV Prevention Gap in High-Risk Population", "Oncology KOL Introduction"],
    frameworkLink: "signal_awareness",
    tip: "Practice building questions directly from what the HCP just said. Avoid pre-scripted openers.",
  },
  signal_interpretation: {
    coachingModule: "Stakeholder Mapping",
    moduleDesc: "Understand signals from different HCP types",
    scenarios: ["Treatment Optimization in Stable HIV Patients", "Rural HF Program with CKD Safety Concerns"],
    frameworkLink: "signal_interpretation",
    tip: "After each HCP statement, pause and paraphrase before responding. This sharpens interpretation.",
  },
  value_connection: {
    coachingModule: "Clinical Evidence",
    moduleDesc: "Connect clinical data to HCP-specific priorities",
    scenarios: ["Heart Failure GDMT Optimization Challenge", "ADC Integration with IO Backbone"],
    frameworkLink: "value_connection",
    tip: "Always reference something the HCP said before presenting value. 'Because you mentioned X...'",
  },
  objection_navigation: {
    coachingModule: "Objection Handling",
    moduleDesc: "Navigate resistance with composure and evidence",
    scenarios: ["PrEP Access Barriers Despite Strong Adoption", "Cardiology Formulary Review"],
    frameworkLink: "objection_navigation",
    tip: "Acknowledge first, explore second, respond third. Never jump straight to a rebuttal.",
  },
  commitment_generation: {
    coachingModule: "Closing Techniques",
    moduleDesc: "Secure specific, voluntary next steps",
    scenarios: ["Post-COVID Clinic Antiviral Adherence", "Primary Care Vaccine Capture Improvement"],
    frameworkLink: "commitment_generation",
    tip: "Ask for a specific action with a date, not a vague 'let's keep in touch'.",
  },
  conversation_management: {
    coachingModule: "Coaching Modules",
    moduleDesc: "Guide conversations with structure and intent",
    scenarios: ["Outpatient Antiviral Optimization", "Post-MI and HF Transitions Optimization"],
    frameworkLink: "conversation_management",
    tip: "Set a brief agenda at the start of every call and summarize before closing.",
  },
  adaptive_response: {
    coachingModule: "Behavioral Mastery",
    moduleDesc: "Flex your approach in real-time",
    scenarios: ["Pathway-Driven Care with Staffing Constraints", "Adult Flu Program Optimization"],
    frameworkLink: "adaptive_response",
    tip: "If the same approach isn't working, change it deliberately — not randomly.",
  },
};

export const CAPABILITY_LABELS = {
  signal_awareness:        "Signal Awareness",
  signal_interpretation:   "Signal Interpretation",
  value_connection:        "Value Connection",
  customer_engagement:     "Customer Engagement",
  objection_navigation:    "Objection Navigation",
  commitment_generation:   "Commitment Generation",
  conversation_management: "Conv. Management",
  adaptive_response:       "Adaptive Response",
};

export const CAPABILITY_COLORS = {
  signal_awareness:        "#0f766e",
  signal_interpretation:   "#14b8a6",
  value_connection:        "#0f766e",
  customer_engagement:     "#64748b",
  objection_navigation:    "#f59e0b",
  commitment_generation:   "#14b8a6",
  conversation_management: "#475569",
  adaptive_response:       "#2dd4bf",
};

export const BENCHMARK_SCORES = {
  signal_awareness:        3.5,
  signal_interpretation:   3.4,
  value_connection:        3.2,
  customer_engagement:     3.1,
  objection_navigation:    3.0,
  commitment_generation:   3.3,
  conversation_management: 3.1,
  adaptive_response:       3.2,
};
