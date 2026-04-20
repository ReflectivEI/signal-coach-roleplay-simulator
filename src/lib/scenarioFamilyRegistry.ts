export type CanonicalConcernFamily =
  | "evidence"
  | "workflow"
  | "access"
  | "hesitation"
  | "adoption_caution"
  | "screening"
  | "time"
  | "general";

export type CapabilityId =
  | "question_quality"
  | "listening_responsiveness"
  | "making_it_matter"
  | "customer_engagement_signals"
  | "objection_navigation"
  | "conversation_control_structure"
  | "adaptability"
  | "commitment_gaining";

export interface ScenarioCapabilityProfile {
  primary: CapabilityId[];
  secondary: CapabilityId[];
  nonBlocking: CapabilityId[];
}

const BUILT_IN_SCENARIO_FAMILIES: Record<string, CanonicalConcernFamily> = {
  "the gatekeeper filter": "time",
  "the warm intro that turns cold": "general",
  "the no-show follow-up": "time",
  "the undefined patient profile": "screening",
  "the assumed priority": "screening",
  "the protocol lock": "general",
  "the data that doesn't land": "evidence",
  "the guideline anchor": "evidence",
  "the cost-effectiveness filter": "evidence",
  "the prior auth reflex": "access",
  "the unexpected safety flag": "evidence",
  "the competitive defender": "evidence",
  "the reluctant early adopter": "adoption_caution",
  "the workflow bottleneck": "workflow",
  "the reversal after first patient": "evidence",
  "the formulary firewall": "access",
  "the perpetual maybe": "hesitation",
  "the handoff risk": "access",
  "the split decision": "evidence",
};

const BUILT_IN_SCENARIO_CAPABILITY_PROFILES: Record<string, ScenarioCapabilityProfile> = {
  "the gatekeeper filter": {
    primary: ["question_quality", "customer_engagement_signals", "adaptability"],
    secondary: ["listening_responsiveness", "conversation_control_structure"],
    nonBlocking: ["making_it_matter", "objection_navigation", "commitment_gaining"],
  },
  "the warm intro that turns cold": {
    primary: ["listening_responsiveness", "question_quality", "conversation_control_structure"],
    secondary: ["customer_engagement_signals", "making_it_matter"],
    nonBlocking: ["objection_navigation", "adaptability", "commitment_gaining"],
  },
  "the no-show follow-up": {
    primary: ["question_quality", "adaptability", "customer_engagement_signals"],
    secondary: ["listening_responsiveness", "conversation_control_structure"],
    nonBlocking: ["making_it_matter", "objection_navigation", "commitment_gaining"],
  },
  "the undefined patient profile": {
    primary: ["question_quality", "listening_responsiveness", "customer_engagement_signals"],
    secondary: ["making_it_matter", "conversation_control_structure", "adaptability"],
    nonBlocking: ["objection_navigation", "commitment_gaining"],
  },
  "the assumed priority": {
    primary: ["listening_responsiveness", "question_quality", "making_it_matter"],
    secondary: ["customer_engagement_signals", "adaptability", "conversation_control_structure"],
    nonBlocking: ["objection_navigation", "commitment_gaining"],
  },
  "the protocol lock": {
    primary: ["question_quality", "customer_engagement_signals", "making_it_matter"],
    secondary: ["listening_responsiveness", "conversation_control_structure"],
    nonBlocking: ["objection_navigation", "adaptability", "commitment_gaining"],
  },
  "the data that doesn't land": {
    primary: ["listening_responsiveness", "making_it_matter", "objection_navigation"],
    secondary: ["question_quality", "adaptability", "conversation_control_structure"],
    nonBlocking: ["customer_engagement_signals", "commitment_gaining"],
  },
  "the guideline anchor": {
    primary: ["question_quality", "making_it_matter", "adaptability"],
    secondary: ["listening_responsiveness", "objection_navigation", "conversation_control_structure"],
    nonBlocking: ["customer_engagement_signals", "commitment_gaining"],
  },
  "the cost-effectiveness filter": {
    primary: ["making_it_matter", "question_quality", "adaptability"],
    secondary: ["listening_responsiveness", "conversation_control_structure"],
    nonBlocking: ["customer_engagement_signals", "objection_navigation", "commitment_gaining"],
  },
  "the prior auth reflex": {
    primary: ["objection_navigation", "conversation_control_structure", "listening_responsiveness"],
    secondary: ["question_quality", "adaptability", "making_it_matter"],
    nonBlocking: ["customer_engagement_signals", "commitment_gaining"],
  },
  "the unexpected safety flag": {
    primary: ["objection_navigation", "listening_responsiveness", "adaptability"],
    secondary: ["making_it_matter", "conversation_control_structure"],
    nonBlocking: ["question_quality", "customer_engagement_signals", "commitment_gaining"],
  },
  "the competitive defender": {
    primary: ["question_quality", "listening_responsiveness", "making_it_matter"],
    secondary: ["objection_navigation", "conversation_control_structure", "adaptability"],
    nonBlocking: ["customer_engagement_signals", "commitment_gaining"],
  },
  "the reluctant early adopter": {
    primary: ["customer_engagement_signals", "commitment_gaining", "question_quality"],
    secondary: ["listening_responsiveness", "making_it_matter", "adaptability"],
    nonBlocking: ["objection_navigation", "conversation_control_structure"],
  },
  "the workflow bottleneck": {
    primary: ["question_quality", "making_it_matter", "adaptability"],
    secondary: ["listening_responsiveness", "customer_engagement_signals", "conversation_control_structure"],
    nonBlocking: ["objection_navigation", "commitment_gaining"],
  },
  "the reversal after first patient": {
    primary: ["listening_responsiveness", "objection_navigation", "making_it_matter"],
    secondary: ["adaptability", "conversation_control_structure"],
    nonBlocking: ["question_quality", "customer_engagement_signals", "commitment_gaining"],
  },
  "the formulary firewall": {
    primary: ["commitment_gaining", "conversation_control_structure", "making_it_matter"],
    secondary: ["listening_responsiveness", "adaptability", "question_quality"],
    nonBlocking: ["customer_engagement_signals", "objection_navigation"],
  },
  "the perpetual maybe": {
    primary: ["commitment_gaining", "question_quality", "conversation_control_structure"],
    secondary: ["listening_responsiveness", "making_it_matter", "adaptability"],
    nonBlocking: ["customer_engagement_signals", "objection_navigation"],
  },
  "the handoff risk": {
    primary: ["commitment_gaining", "conversation_control_structure", "customer_engagement_signals"],
    secondary: ["listening_responsiveness", "adaptability", "making_it_matter"],
    nonBlocking: ["question_quality", "objection_navigation"],
  },
  "the split decision": {
    primary: ["conversation_control_structure", "listening_responsiveness", "commitment_gaining"],
    secondary: ["question_quality", "customer_engagement_signals", "adaptability"],
    nonBlocking: ["making_it_matter", "objection_navigation"],
  },
};

function normalizeTitle(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export function getScenarioConcernFamily(scenario: any = {}): CanonicalConcernFamily | null {
  const title = normalizeTitle(scenario?.title);
  if (!title) return null;
  return BUILT_IN_SCENARIO_FAMILIES[title] || null;
}

export function scenarioMatchesConcernFamily(
  scenario: any = {},
  family: CanonicalConcernFamily,
): boolean {
  return getScenarioConcernFamily(scenario) === family;
}

export function getScenarioCapabilityProfile(scenario: any = {}): ScenarioCapabilityProfile | null {
  const title = normalizeTitle(scenario?.title);
  if (!title) return null;
  return BUILT_IN_SCENARIO_CAPABILITY_PROFILES[title] || null;
}
