import { runCapabilityEvaluationEngine } from "./capabilityEvaluation";
import { BehaviorSignals } from "./simulatorEngine";

export type SharedConcernFamily =
  | "evidence"
  | "workflow"
  | "access"
  | "hesitation"
  | "screening"
  | "time"
  | "general";

export type ResponseShape =
  | "brief_invitation"
  | "answer_pull"
  | "partial_agreement"
  | "constraint_probe"
  | "decision_probe"
  | "pushback"
  | "compressed_probe"
  | "conditional_close";

export interface HcpTurnDirectiveSet {
  domain: string;
  concernFamily: SharedConcernFamily;
  phase: string;
  responseShape: ResponseShape;
  escalationStage: "baseline" | "focused" | "firm" | "high_pressure" | "disengaging";
  repeatedMisses: string[];
  objectionMode: boolean;
  closeMode: boolean;
  targetWordBudget: number;
  directives: string[];
}

export function deriveScenarioDomain(scenario: any = {}): string {
  const text = [
    scenario.title,
    scenario.stakeholder,
    scenario.context,
    scenario.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("oncolog")) return "oncology";
  if (text.includes("cardio")) return "cardiology";
  if (text.includes("infectious") || text.includes("hiv")) return "hiv";
  if (text.includes("neuro")) return "neurology";
  if (text.includes("immun")) return "immunology";
  if (text.includes("endocrin")) return "endocrinology";
  if (text.includes("nephro")) return "nephrology";
  if (text.includes("dermat")) return "dermatology";
  if (text.includes("hemat")) return "hematology";
  if (text.includes("rheumat")) return "rheumatology";
  if (text.includes("rare")) return "rare";
  if (text.includes("rheumat")) return "immunology";
  if (text.includes("pulmon")) return "pulmonology";
  return "general";
}

export function deriveConcernFamily(scenario: any = {}): SharedConcernFamily {
  const journeyStage = String(scenario.journeyStage || "").toLowerCase();
  const pressures = scenario.interactionPressure || [];
  const text = [
    journeyStage,
    scenario.decisionOrientation,
    scenario.objective,
    scenario.description,
    scenario.context,
    ...pressures,
    ...(scenario.keyChallenges || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (journeyStage === "initial_access") {
    if (/\b(access|coverage|copay|prior auth|formulary|payer|benefits)\b/.test(text)) return "access";
    if (/\b(workflow|staff|handoff|process|clinic|operational|implementation|callback)\b/.test(text)) return "workflow";
    if (/\b(time|minutes|schedule|patient waiting|quick|brief)\b/.test(text) || pressures.includes("time_constrained")) return "time";
    if (/\b(screen|screening|candidate|eligibility|identify|selection|criteria)\b/.test(text)) return "screening";
    return "general";
  }

  if (
    journeyStage === "commitment_close" &&
    /\b(right patient|ideal patient|perfect fit|not ready|still maybe|passive agreement|specific next step|time-bound|easy to say yes|trial patients?)\b/.test(text)
  ) return "hesitation";
  if (/\b(access|coverage|copay|prior auth|formulary|payer|benefits)\b/.test(text)) return "access";
  if (/\b(workflow|staff|handoff|process|clinic|operational|implementation|callback)\b/.test(text)) return "workflow";
  if (/\b(screen|screening|candidate|eligibility|identify|selection|criteria)\b/.test(text)) return "screening";
  if (/\b(evidence|trial|study|guideline|data|proof|subgroup|threshold|hazard ratio)\b/.test(text)) return "evidence";
  if (/\b(time|minutes|schedule|patient waiting|quick|brief)\b/.test(text)) return "time";
  return "general";
}

function recentWindow(signals: BehaviorSignals[], count = 3): BehaviorSignals[] {
  return signals.slice(-count);
}

function countConsecutiveMisses(signals: BehaviorSignals[], selector: (signal: BehaviorSignals) => boolean): number {
  let count = 0;
  for (let index = signals.length - 1; index >= 0; index -= 1) {
    if (selector(signals[index])) count += 1;
    else break;
  }
  return count;
}

function derivePhase(scenario: any = {}, currentJourneyState = ""): string {
  const state = String(currentJourneyState || scenario?.journeyState || "").toLowerCase();
  const stage = String(scenario?.journeyStage || "").toLowerCase();

  if (state.includes("objection") || stage === "objection_handling") return "objection_resolution";
  if (state.includes("clinical") || stage === "clinical_value") return "decision_change";
  if (state.includes("access") || stage === "access_formulary") return "access_resolution";
  if (state.includes("adoption") || stage === "adoption_implementation") return "implementation_commitment";
  if (state.includes("commitment") || stage === "commitment_close") return "close";
  if (state.includes("early") || stage === "initial_access" || stage === "discovery") return "clarify";
  return "clarify";
}

function deriveEscalationStage({
  scenario,
  currentBehaviorState,
  predictionState,
  repeatedMisses,
}: {
  scenario: any;
  currentBehaviorState: string;
  predictionState: string;
  repeatedMisses: string[];
}): HcpTurnDirectiveSet["escalationStage"] {
  const pressures = scenario?.interactionPressure || [];
  const state = String(predictionState || currentBehaviorState || "").toLowerCase();
  const highPressure =
    pressures.includes("time_constrained") ||
    pressures.includes("operationally_constrained") ||
    pressures.includes("skeptical_resistant") ||
    pressures.includes("safety_concern");

  if (repeatedMisses.length >= 2 && (highPressure || ["frustration", "resistance", "closed"].includes(state))) {
    return "disengaging";
  }
  if (repeatedMisses.length >= 1 && (highPressure || ["frustration", "resistance", "closed"].includes(state))) {
    return "high_pressure";
  }
  if (repeatedMisses.length >= 1 || ["resistance", "closed", "time_pressure"].includes(state)) return "firm";
  if (["curiosity", "openness", "open"].includes(state)) return "focused";
  return "baseline";
}

function inferResponseShape({
  phase,
  concernFamily,
  escalationStage,
  closeMode,
  objectionMode,
  turnCount,
}: {
  phase: string;
  concernFamily: SharedConcernFamily;
  escalationStage: HcpTurnDirectiveSet["escalationStage"];
  closeMode: boolean;
  objectionMode: boolean;
  turnCount: number;
}): ResponseShape {
  if (escalationStage === "disengaging") return closeMode ? "conditional_close" : "compressed_probe";
  if (escalationStage === "high_pressure") return objectionMode ? "pushback" : "compressed_probe";
  if (closeMode && concernFamily === "hesitation") return escalationStage === "firm" ? "constraint_probe" : "partial_agreement";
  if (closeMode) return escalationStage === "firm" ? "constraint_probe" : "partial_agreement";
  if (objectionMode) return escalationStage === "firm" ? "pushback" : "constraint_probe";
  if (turnCount <= 1) return "brief_invitation";
  if (phase === "decision_change" && concernFamily === "evidence") return "decision_probe";
  if (phase === "access_resolution" || concernFamily === "access") return "constraint_probe";
  if (phase === "implementation_commitment" || concernFamily === "workflow") return "constraint_probe";
  if (phase === "clarify" && concernFamily === "screening") return "answer_pull";
  return escalationStage === "focused" ? "partial_agreement" : "constraint_probe";
}

function buildDirectiveLines({
  domain,
  concernFamily,
  phase,
  responseShape,
  escalationStage,
  repeatedMisses,
  objectionMode,
  closeMode,
}: {
  domain: string;
  concernFamily: SharedConcernFamily;
  phase: string;
  responseShape: ResponseShape;
  escalationStage: HcpTurnDirectiveSet["escalationStage"];
  repeatedMisses: string[];
  objectionMode: boolean;
  closeMode: boolean;
}): string[] {
  const lines = [
    `- Domain: ${domain}`,
    `- Concern family: ${concernFamily}`,
    `- Phase: ${phase}`,
    `- Response shape: ${responseShape}`,
    `- Escalation stage: ${escalationStage}`,
  ];

  if (closeMode) {
    lines.push("- This is a close-stage interaction: keep the blocker narrow and move toward one smallest next-step frame.");
    lines.push("- If the HCP shows any openness, it should sound conditional and earned, not suddenly warm or broadly collaborative.");
  }
  if (objectionMode) {
    lines.push("- This is an objection-stage interaction: repeat or sharpen the SAME objection instead of introducing a new one.");
  }

  if (repeatedMisses.includes("listening_responsiveness")) {
    lines.push("- The rep has repeatedly talked past the HCP: make the HCP explicitly narrow the conversation back to the unanswered concern.");
  }
  if (repeatedMisses.includes("objection_navigation")) {
    lines.push("- The rep has repeatedly failed to navigate the objection: sharpen the same concern in shorter, more decisive language.");
  }
  if (repeatedMisses.includes("adaptability")) {
    lines.push("- The rep is repeating the same approach: the HCP should sound less patient with repetition and less willing to reopen the topic broadly.");
  }
  if (repeatedMisses.includes("question_quality")) {
    lines.push("- Question quality is weak: the HCP should volunteer less and make the rep earn any additional specificity.");
  }

  if (responseShape === "compressed_probe") {
    lines.push("- Use one compressed, high-utility sentence or two very short sentences max.");
  } else if (responseShape === "pushback") {
    lines.push("- Lead with direct pushback tied to the exact concern already on the table.");
  } else if (responseShape === "decision_probe") {
    lines.push("- Ask for the exact threshold, proof point, subgroup fit, or decision-changing evidence.");
  } else if (responseShape === "constraint_probe") {
    lines.push("- Force the discussion onto the practical bottleneck, owner, handoff, or next operational step.");
  } else if (responseShape === "conditional_close") {
    lines.push("- Signal the conversation window is closing and allow only one final concise, relevant move.");
  } else if (responseShape === "partial_agreement") {
    lines.push("- Allow conditional openness, but keep one unresolved condition active and make the openness sound earned, not generous.");
  }

  if (concernFamily === "hesitation") {
    lines.push("- Treat this as hesitation-to-commitment, not a hard objection. Keep the HCP focused on what concrete condition would make one next step feel safe.");
  }

  if (domain === "oncology" && concernFamily === "evidence") {
    lines.push("- In oncology evidence mode, sound threshold-aware and exacting about subgroup fit or decision relevance.");
  }
  if (domain === "hiv" && concernFamily === "workflow") {
    lines.push("- In HIV workflow mode, stay grounded in callbacks, refill gaps, clinic flow, and who owns the next step.");
  }
  if (domain === "cardiology" && (concernFamily === "access" || concernFamily === "workflow")) {
    lines.push("- In cardiology operational mode, stay grounded in discharge flow, formulary burden, and what changes before the patient leaves.");
  }
  if (domain === "rheumatology" && (concernFamily === "access" || concernFamily === "workflow")) {
    lines.push("- In rheumatology access/workflow mode, stay grounded in prior auth workload, staff strain, and what step actually lands on the team.");
  }
  if (domain === "dermatology" && concernFamily === "workflow") {
    lines.push("- In dermatology workflow mode, stay grounded in monitoring burden, staff ownership, and what a smaller practice can realistically absorb.");
  }
  if (domain === "nephrology" && concernFamily === "general") {
    lines.push("- In nephrology adoption mode, sound cautious about who goes first and what threshold would justify changing course.");
  }
  if (domain === "neurology" && concernFamily === "evidence") {
    lines.push("- In neurology safety/evidence mode, stay exacting about unresolved risk signals and what would need verification before moving on.");
  }
  if (domain === "hematology" && concernFamily === "workflow") {
    lines.push("- In hematology post-adoption mode, stay focused on the difficult first case, what happened, and why confidence has narrowed.");
  }
  if (domain === "endocrinology" && concernFamily === "screening") {
    lines.push("- In endocrinology discovery mode, stay practical about which patients actually stay on therapy and where current thinking breaks down.");
  }
  if (domain === "general" && concernFamily === "hesitation") {
    lines.push("- In hesitation mode, stay anchored to passive agreement, what has delayed action so far, and the smallest next owned move.");
  }

  return lines;
}

export function deriveHcpTurnDirectives({
  scenario,
  currentBehaviorState,
  currentJourneyState,
  predictionState,
  allPriorSignals = [],
  turnCount = 0,
}: {
  scenario: any;
  currentBehaviorState: string;
  currentJourneyState: string;
  predictionState: string;
  allPriorSignals?: BehaviorSignals[];
  turnCount?: number;
}): HcpTurnDirectiveSet {
  const domain = deriveScenarioDomain(scenario);
  const concernFamily = deriveConcernFamily(scenario);
  const phase = derivePhase(scenario, currentJourneyState);
  const objectionMode = phase === "objection_resolution" || phase === "access_resolution";
  const closeMode = phase === "close" || phase === "implementation_commitment";

  const recentSignals = recentWindow(allPriorSignals, 4);
  const assessment = runCapabilityEvaluationEngine(recentSignals, scenario?.suggestedFocusCapabilities || [], scenario);
  const repeatedMisses = [
    assessment.listening_responsiveness === "missed" &&
    countConsecutiveMisses(allPriorSignals, (signal) =>
      signal.response_alignment === "weak" || signal.listening_pattern === "missed"
    ) >= 2
      ? "listening_responsiveness"
      : null,
    assessment.objection_navigation === "missed" &&
    countConsecutiveMisses(allPriorSignals, (signal) =>
      !!signal.objection_type && signal.objection_type !== "none" &&
      (signal.response_alignment === "weak" || signal.listening_pattern === "missed")
    ) >= 2
      ? "objection_navigation"
      : null,
    assessment.adaptability === "missed" &&
    countConsecutiveMisses(allPriorSignals, (signal) =>
      signal.response_alignment === "weak" && signal.control_pattern === "rep_dominant"
    ) >= 2
      ? "adaptability"
      : null,
    assessment.question_quality === "missed" &&
    countConsecutiveMisses(allPriorSignals, (signal) =>
      signal.question_type === "none" || signal.question_type === "leading"
    ) >= 2
      ? "question_quality"
      : null,
  ].filter(Boolean) as string[];

  const escalationStage = deriveEscalationStage({
    scenario,
    currentBehaviorState,
    predictionState,
    repeatedMisses,
  });
  const responseShape = inferResponseShape({
    phase,
    concernFamily,
    escalationStage,
    closeMode,
    objectionMode,
    turnCount,
  });

  const targetWordBudget =
    responseShape === "compressed_probe" || responseShape === "conditional_close"
      ? 22
      : responseShape === "pushback"
        ? 28
        : responseShape === "decision_probe" || responseShape === "constraint_probe"
          ? 34
          : 42;

  return {
    domain,
    concernFamily,
    phase,
    responseShape,
    escalationStage,
    repeatedMisses,
    objectionMode,
    closeMode,
    targetWordBudget,
    directives: buildDirectiveLines({
      domain,
      concernFamily,
      phase,
      responseShape,
      escalationStage,
      repeatedMisses,
      objectionMode,
      closeMode,
    }),
  };
}

export function buildTurnDirectivePrompt(turn: HcpTurnDirectiveSet): string {
  return ["TURN-SHAPE AND PHASE DIRECTIVES:", ...turn.directives].join("\n");
}
