/**
 * HCP Cue Generator
 * =================
 * Deterministic observable cue selection, aligned to:
 * - Base44 behavioral SOT opening-scene formula
 * - the stronger V2 HCP cue/state alignment path
 *
 * Goals:
 * - cue is observable, not interpretive
 * - cue aligns to the actual HCP line
 * - cue aligns to the current HCP state / pressure
 * - same inputs => same cue
 * - cue text is not duplicated from product labels
 */

import { buildGlobalFirstTurnCue, detectOpeningAnchorType } from "./hcpRealismBackbone";
import { deriveConcernFamily, deriveScenarioDomain } from "./hcpTurnDirectives";
import { deriveHcpRuntimeProfile } from "./hcpRuntimeProfiles";
import { getScenarioConcernFamily } from "./scenarioFamilyRegistry";

export interface HcpCueInputs {
  hcpReply: string;
  behaviorState: string;
  hcpTurnCount?: number;
  interactionPressures?: string[];
  recentCueLabels?: string[];
  repMessage?: string;
  allowFirstTurnCandidateCue?: boolean;
  runtimeTemperature?: number;
  escalationLevel?: number;
  scenario?: {
    id?: string;
    title?: string;
    persona?: string;
    journeyStage?: string;
    objective?: string;
    description?: string;
    openingScene?: string;
    visualScene?: string;
    keyChallenges?: string[];
  };
}

type CueCategory =
  | "receptive_attentive"
  | "neutral_attentive"
  | "focused_narrowing"
  | "time_constrained"
  | "hard_escalation"
  | "terminal_exit";

type ConcernFamily =
  | "evidence"
  | "workflow"
  | "access"
  | "screening"
  | "time"
  | "general";

const TERMINAL_DIALOGUE_PATTERN =
  /\b(need to run|have to run|got to go|we should stop|we can stop there|we are done|i have to get back|wrap this up|that is all i have time for|probably done|not ready to keep going|pause here|should pause|not useful|cannot make this specific)\b/i;

const HIGH_PRESSURE_DIALOGUE_PATTERN =
  /\b(quick|be brief|make this quick|short version|not much time|patient waiting|keep this tight|to the point)\b/i;

const DIRECT_BOUNDARY_PATTERN =
  /\b(what is this about|what exactly|be specific|get to the point|what does that change|what is the bottleneck|what is the threshold|what problem are you solving)\b/i;

const HARD_ESCALATION_PATTERN =
  /\b(not interested|this is not relevant|that is not helpful|you are not answering|this is going nowhere|i do not have patience for this)\b/i;

const OBSERVABLE_VERB_PATTERN =
  /\b(glances?|checks?|leans?|nods?|rests?|holds?|taps?|turns?|gathers?|keeps?|sets?|looks?|studies?|shifts?)\b/i;

const BANNED_CUE_TERMS = [
  "skeptical",
  "resistant",
  "time-constrained",
  "time constrained",
  "behavior state",
  "journey stage",
  "interaction pressure",
  "burden",
  "workload",
  "credibility",
  "decision relevance",
  "decision-relevant",
  "proof point",
  "current ask",
  "signaling",
  "waiting for",
  "watching for",
  "attention tightening",
  "attention narrows",
  "less patient",
];

const CONCERN_KEYWORDS: Record<ConcernFamily, string[]> = {
  evidence: ["data", "study", "trial", "evidence", "proof", "subgroup", "threshold", "guideline", "journal", "endpoint", "decision", "safety", "hepatic", "adverse", "monitoring"],
  workflow: ["workflow", "staff", "handoff", "process", "step", "clinic", "callback", "room", "flow"],
  access: ["access", "coverage", "copay", "prior auth", "formulary", "payer", "benefits", "paperwork"],
  screening: ["screen", "screening", "candidate", "eligibility", "criteria", "identify", "selection"],
  time: ["time", "clock", "schedule", "patient waiting", "brief", "quick", "minutes"],
  general: [],
};

const PRESSURE_TO_CONCERN: Record<string, ConcernFamily> = {
  time_constrained: "time",
  operationally_constrained: "workflow",
  skeptical_resistant: "evidence",
  access_barrier: "access",
  safety_concern: "evidence",
  curious_uncertain: "general",
};

const JOURNEY_TO_CONCERN: Record<string, ConcernFamily> = {
  initial_access: "time",
  discovery: "screening",
  clinical_value: "evidence",
  objection_handling: "workflow",
  adoption_implementation: "workflow",
  access_formulary: "access",
  commitment_close: "general",
};

const CUE_POOLS: Record<CueCategory, Record<ConcernFamily, string[]>> = {
  receptive_attentive: {
    evidence: [
      "Leans slightly toward the study printout, pen hovering over the highlighted data.",
      "Keeps the marked-up trial page open and looks up with steady attention.",
      "Leaves the trial abstract open and studies you with measured attention.",
      "Keeps the evidence slide in view, posture open enough to hear the next point.",
    ],
    workflow: [
      "Turns back toward you with the workflow notes still open on the desk.",
      "Keeps the clinic notes nearby, posture open enough to keep listening.",
      "Leaves the callback list open and gives you a measured look to continue.",
      "Keeps one hand on the workflow sheet, leaving a small opening for the next point.",
    ],
    access: [
      "Keeps the coverage notes open, attention visibly with you.",
      "Looks up from the formulary sheet and leaves the conversation space open.",
      "Leaves the access notes open and looks back as if one useful answer could move this forward.",
      "Keeps the prior-auth sheet in view, posture open enough to keep listening.",
    ],
    screening: [
      "Leans toward the chart, giving the selection question full attention.",
      "Keeps the patient list open and looks back with measured interest.",
      "Leaves the case notes open and studies you as if the next detail matters.",
      "Keeps the chart visible and leans in just enough to stay with the selection question.",
    ],
    time: [
      "Gives a quick nod and leaves a small opening for the next point.",
      "Keeps one hand near the schedule but stays with you for the answer.",
      "Looks back briefly from the clock, leaving room for one concise answer.",
      "Keeps a hand near the chart stack but gives you a short opening to continue.",
    ],
    general: [
      "Leans in slightly, attention fully with you.",
      "Keeps a steady, receptive posture as you continue.",
    ],
  },
  neutral_attentive: {
    evidence: [
      "Keeps the study printout open, eyes moving once across the highlighted data.",
      "Leaves the journal page in view and looks back with a measured expression.",
      "Keeps the trial summary visible, eyes settling back on you without softening.",
      "Leaves the data page open and looks back with professional reserve.",
    ],
    workflow: [
      "Keeps the workflow notes nearby, looking up without losing the thread.",
      "Leaves the clinic list open and settles back into a professional posture.",
      "Keeps the intake notes in view and looks back without changing pace.",
      "Leaves the workflow sheet open, expression steady and professional.",
    ],
    access: [
      "Keeps the coverage notes in view, pen still against the page.",
      "Leaves the formulary sheet open and looks back without changing posture.",
      "Keeps the prior-auth notes visible, expression measured.",
      "Leaves the access paperwork open and looks back without giving away the answer.",
    ],
    screening: [
      "Keeps the patient list open, attention settling on the chart in front of them.",
      "Leaves the chart visible on the desk and looks up with measured focus.",
    ],
    time: [
      "Checks the schedule once, then returns attention to you.",
      "Glances toward the clock and comes back with a brief nod.",
      "Looks once at the next room, then back with a neutral expression.",
      "Checks the chart stack and returns attention to you without opening more space.",
    ],
    general: [
      "Maintains a professional posture, attention fixed on the exchange.",
      "Gives a brief nod and holds steady eye contact.",
    ],
  },
  focused_narrowing: {
    evidence: [
      "Narrows their gaze at the study printout, expression measured.",
      "Keeps a finger on the data page and looks back with a tighter expression.",
      "Looks down at the marked-up data, then back with a narrower expression.",
      "Keeps the evidence page pinned under one hand and looks back with a narrower expression.",
    ],
    workflow: [
      "Keeps a hand on the workflow notes, posture tightening.",
      "Glances at the clinic list, then looks back with a narrower focus.",
    ],
    access: [
      "Glances at the coverage notes, then looks back with a tighter expression.",
      "Keeps the formulary sheet in view, posture closed down around the question.",
      "Looks down at the prior-auth note, then back with a more exacting stare.",
      "Keeps the access paperwork under one hand, expression narrowing around the blocker.",
    ],
    screening: [
      "Keeps the patient list open, eyes narrowing at the selection question.",
      "Looks back from the chart with a more exacting expression.",
    ],
    time: [
      "Checks the clock, then looks back with a tighter expression.",
      "Keeps steady eye contact, expression more focused.",
      "Glances at the next room, then comes back with a tighter expression.",
      "Checks the schedule and looks back as if only one useful point will fit here.",
    ],
    general: [
      "Holds steady eye contact, expression narrowing.",
      "Goes still for a beat and keeps steady eye contact.",
    ],
  },
  time_constrained: {
    evidence: [
      "Checks the clock, then taps the marked-up study printout once.",
      "Glances toward the doorway, then back to the data page in front of them.",
    ],
    workflow: [
      "Checks the doorway, then rests a hand on the callback list.",
      "Looks toward the hall, clinic notes still open beneath one hand.",
    ],
    access: [
      "Checks the clock, coverage notes still in hand.",
      "Glances toward the door, formulary sheet still open on the desk.",
      "Looks toward the hallway, prior-auth notes still under one hand.",
      "Checks the schedule, access paperwork still open in front of them.",
    ],
    screening: [
      "Checks the schedule, then taps the patient list once.",
      "Glances toward the doorway, chart still open in front of them.",
    ],
    time: [
      "Checks the clock, then looks back with a tighter expression.",
      "Glances toward the next room and comes back ready for one concise point.",
      "Looks at the schedule, then back with very little space left in the exchange.",
      "Checks the next patient slot, attention returning to the practical point.",
    ],
    general: [
      "Checks the clock, then looks back with a tighter expression.",
      "Glances toward the doorway, posture still tight.",
    ],
  },
  hard_escalation: {
    evidence: [
      "Holds the study page still, jaw set.",
      "Sets the printout flat on the desk, expression clipped.",
    ],
    workflow: [
      "Sets the workflow notes flat on the desk, expression clipped.",
      "Holds still over the clinic list, jaw tightening slightly.",
    ],
    access: [
      "Keeps the coverage notes in hand, posture closed.",
      "Sets the formulary sheet down with a clipped expression.",
    ],
    screening: [
      "Holds the patient list still, expression clipped.",
      "Sets the chart flat and looks back without softening.",
    ],
    time: [
      "Goes still for a beat, jaw set, eyes already on the clock.",
      "Looks back with a clipped expression, one hand still on the schedule.",
    ],
    general: [
      "Goes still for a beat, jaw set.",
      "Holds eye contact with a clipped, closed expression.",
    ],
  },
  terminal_exit: {
    evidence: [
      "Gathers the study printout and turns back toward the next task.",
      "Closes the journal page and shifts back toward the door.",
    ],
    workflow: [
      "Gathers the workflow notes and turns back toward clinic flow.",
      "Steps back toward the desk, callback list still in hand.",
    ],
    access: [
      "Gathers the coverage notes and turns back toward the next task.",
      "Closes the formulary sheet and shifts back toward the doorway.",
    ],
    screening: [
      "Gathers the chart and turns back toward the next task.",
      "Closes the patient list and steps back toward the desk.",
    ],
    time: [
      "Turns back toward the next patient slot, conversation space closing.",
      "Steps back toward the door, eyes already on the next room.",
    ],
    general: [
      "Gathers the chart and turns back toward the next task.",
      "Steps back toward the door, conversation space clearly closing.",
    ],
  },
};

const DOMAIN_CUE_POOLS: Partial<Record<string, Partial<Record<CueCategory, Partial<Record<ConcernFamily, string[]>>>>>> = {};


const BEHAVIOR_DESCRIPTION_BANK: Record<CueCategory, string[]> = {
  receptive_attentive: [
    "The HCP stays oriented toward you, so the next turn should stay concrete and relevant.",
    "The HCP posture remains open, so the next turn needs to stay specific.",
    "The HCP leaves the conversation a little room, so the next turn should make good use of it.",
  ],
  neutral_attentive: [
    "The HCP keeps a measured posture, so the next turn has to earn more of their attention.",
    "The HCP is still listening, but the next turn needs to prove its relevance.",
    "The HCP has not closed down the exchange, but the next turn needs to land cleanly.",
  ],
  focused_narrowing: [
    "The HCP posture narrows around one issue, so the next response should answer that directly.",
    "The HCP is pressing on one point, so the next turn should stay on that point.",
    "The HCP posture tightens around one issue, so the next response should stay there.",
  ],
  time_constrained: [
    "Time is visibly short, so the next move has to be brief and useful.",
    "There is not much room left here, so the next turn should get to the point quickly.",
    "Time is tight, so the next move needs to be concise and immediately relevant.",
  ],
  hard_escalation: [
    "The HCP posture is tighter, so the next turn needs to stay direct.",
    "The HCP posture is tighter, so the next turn has to answer the point directly.",
    "The HCP posture is hardening, so the next move cannot afford another sidestep.",
  ],
  terminal_exit: [
    "The interaction is close to ending, so only a concise and relevant final move still fits.",
    "The exchange is closing down, so the next move has to be brief and immediately useful.",
    "There is very little room left here, so the final move needs to be concise and relevant.",
  ],
};

const CONCERN_DESCRIPTION_BANK: Record<ConcernFamily, string[]> = {
  evidence: [
    "They still need proof that applies to the patients they actually treat.",
    "They are holding on whether the evidence really fits their patients.",
    "They still need evidence that feels relevant in practice, not just strong on paper.",
  ],
  workflow: [
    "Their gaze stays on the workflow notes as the next response lands.",
    "They still need to hear what changes for staff in the real workflow.",
    "They are focused on whether this creates work or removes it for the team.",
  ],
  access: [
    "They are focused on the page.",
    "They still need to know what changes in the approval and access process.",
    "They are holding on the access barrier that keeps care from moving forward.",
  ],
  screening: [
    "They are focused on which patients truly fit, not a broad patient label.",
    "They still need a clearer patient-selection answer.",
    "They are holding on where the real patient boundary sits.",
  ],
  time: [
    "They check the schedule, so the next move needs real economy.",
    "They do not have much time here, so the next turn needs to stay lean.",
    "They are working inside a short time window, so the next move needs to stay tight.",
  ],
  general: [
    "They still need a clearer reason to stay in the conversation.",
    "They hold a professional posture while the conversation works to prove its relevance.",
    "They still need to hear why this matters in a practical way.",
  ],
};

function deriveAnchorAwareConcernDescription({
  scenario,
  concernFamily,
}: {
  scenario?: HcpCueInputs["scenario"];
  concernFamily: ConcernFamily;
}): string {
  const scenarioText = normalizeText(
    scenario?.title,
    scenario?.journeyStage,
    scenario?.objective,
    scenario?.description,
    scenario?.openingScene,
    scenario?.visualScene,
    Array.isArray(scenario?.keyChallenges) ? scenario?.keyChallenges.join(" ") : ""
  );
  const anchor = detectOpeningAnchorType(
    scenarioText
  );

  if (
    concernFamily === "general" &&
    String(scenario?.journeyStage || "").toLowerCase() === "commitment_close" &&
    /\bright patient\b|\bfit(s|ting)? perfectly\b|\bpatient\b.*\bfit\b/i.test(scenarioText)
  ) {
    return "They are still trying to pin down which patient would make this feel real enough to act on.";
  }
  if (
    concernFamily === "general" &&
    /\bsafe enough\b|\blow-risk\b|\bfirst mover\b|\bfirst use\b|\bfirst\b/i.test(scenarioText)
  ) {
    return "They are still deciding what low-risk first step would feel safe enough to try.";
  }

  if (anchor === "cost_value" && concernFamily === "evidence") {
    return "They still need a clear understanding of the total cost before they can judge whether it is worth it.";
  }
  if (anchor === "workflow" && concernFamily === "workflow") {
    return "They are trying to understand exactly what changes for staff in the real workflow.";
  }
  if ((anchor === "guideline" || anchor === "safety_flag") && concernFamily === "evidence") {
    return "They are still deciding whether the evidence really applies to the patients they actually treat.";
  }

  return pick(
    CONCERN_DESCRIPTION_BANK[concernFamily],
    normalizeText(
      scenario?.title,
      scenario?.journeyStage,
      scenario?.objective,
      concernFamily
    )
  );
}

function normalizeText(...values: unknown[]): string {
  return values
    .flat()
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCueText(text: string): string {
  return String(text || "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^◆\s*/, "")
    .replace(/\bglances at watch\b/gi, "glances at the watch")
    .replace(/\bglances at clock\b/gi, "glances at the clock")
    .replace(/\bglances at schedule\b/gi, "glances at the schedule")
    .replace(/\bglances at patient intake forms\b/gi, "glances at the patient intake forms")
    .replace(/\bglances at chart\b/gi, "glances at the chart")
    .replace(/\bglances at notes\b/gi, "glances at the notes")
    .replace(/\bkeeps (?:their|his|her) eyes on you for a beat,?\s*expression more focused\b/gi, "keeps steady eye contact, expression more focused")
    .replace(/\bkeeps (?:their|his|her) eyes on you for a beat\b/gi, "keeps steady eye contact")
    .replace(/\bexpression more focused\b/gi, "expression focused on the page")
    .replace(/\bkeeps the ([a-z -]+) under one hand,?\s*expression tightening around the ([a-z -]+)\b/gi, "keeps the $1 nearby, focused on the $2")
    .replace(/\bunder one hand\b/gi, "nearby")
    .replace(/\bexpression tightening around the ([a-z -]+)\b/gi, "focused on the $1")
    .replace(/\bgoes still for a beat,?\s*leaving little room for a detour\b/gi, "pauses briefly, keeps steady eye contact")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCueSentence(text: string): string {
  let cleaned = cleanCueText(text).replace(/[.?!]+$/g, "").trim();
  if (!cleaned) return "";
  if (/^(glances|checks|looks|leans|nods|pauses|scans|reviews|shifts|gestures|rereads|folds|gathers|taps|closes)\b/i.test(cleaned)) {
    cleaned = `The HCP ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
  }
  return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}.`;
}

function normalizeCueFingerprint(text: string): string {
  return normalizeCueSentence(text).toLowerCase();
}

function cueSequenceSignature(text: string): string {
  const cue = normalizeCueFingerprint(text);
  if (!cue) return "generic";
  if (/\bclock|schedule|patient slot|brief|quick|next room\b/.test(cue)) return "time_window";
  if (/\bdoor|doorway|hall|hallway\b/.test(cue)) return "doorway_pull";
  if (/\bstudy|trial|data|printout|journal\b/.test(cue)) return "evidence_anchor";
  if (/\bworkflow|callback|clinic list|notes\b/.test(cue)) return "workflow_anchor";
  if (/\bcoverage|formulary|prior-auth|prior auth\b/.test(cue)) return "access_anchor";
  if (/\bchart|patient list|case file|patient notes\b/.test(cue)) return "chart_anchor";
  if (/\bjaw|clipped|holds eye contact|holds still\b/.test(cue)) return "hard_boundary";
  if (/\bnod|leans|open|receptive\b/.test(cue)) return "receptive_space";
  if (/\bgaze|looks back|expression narrowing|narrowing\b/.test(cue)) return "narrow_focus";
  return cue.split(/\s+/).slice(0, 3).join("_");
}

function cueFrameSignature(text: string): string {
  const cue = normalizeCueFingerprint(text);
  if (!cue) return "generic_frame";
  if (/\bchecks? the clock|schedule|next room|patient slot\b/.test(cue)) return "time_frame";
  if (/\bglances? toward the door|doorway|hall|hallway\b/.test(cue)) return "door_frame";
  if (/\blooks down at|keeps .* open|leaves .* open|keeps one hand on\b/.test(cue)) return "anchor_frame";
  if (/\bexpression tightening|narrowing|more exacting\b/.test(cue)) return "narrow_frame";
  if (/\blooks back\b/.test(cue)) return "lookback_frame";
  return cueSequenceSignature(cue);
}

function deterministicIndex(seed = "", modulo = 1): number {
  const text = String(seed || "");
  if (!text || modulo <= 1) return 0;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0) % modulo;
}

function pick<T>(arr: T[], seed: string): T {
  return arr[deterministicIndex(seed, arr.length)];
}

function hasAny(text: string, patterns: string[]): boolean {
  const value = text.toLowerCase();
  return patterns.some((pattern) => value.includes(pattern));
}

function deriveCurrentTurnConcernFamily(text = ""): ConcernFamily | null {
  const value = normalizeText(text).toLowerCase();
  if (!value) return null;
  if (/\b(safety|hepatic|renal|adverse|warning|side effect|monitoring|medical resource|case-level)\b/.test(value)) return "evidence";
  if (/\b(endpoint|subgroup|evidence|trial|study|data|proof|guideline|treatment decision|patient decision|decision that changes|clinically useful|applies to my patients)\b/.test(value)) return "evidence";
  if (/\b(access|coverage|prior auth|authorization|formulary|payer|approval|reimbursement|covered|support pathway)\b/.test(value)) return "access";
  if (/\b(workflow|staff|ma|front desk|nurse|team|handoff|clinic flow|task|process|practical step)\b/.test(value)) return "workflow";
  if (/\b(screen|screening|candidate|eligibility|criteria|patient fit|which patients|patient profile|selection)\b/.test(value)) return "screening";
  if (/\b(time|minutes|clock|schedule|next patient|brief|quick)\b/.test(value)) return "time";
  return null;
}

function isSafetyFocusedTurn(text = ""): boolean {
  return /\b(safety|hepatic|renal|adverse|warning|side effect|monitoring|medical resource|case-level)\b/i.test(normalizeText(text));
}

const SAFETY_EVIDENCE_CUE_POOLS: Partial<Record<CueCategory, string[]>> = {
  receptive_attentive: [
    "Keeps the safety section open, eyes moving back to the patient context.",
    "Leaves the adverse-event notes visible and looks back for the approved safety boundary.",
  ],
  neutral_attentive: [
    "Keeps the safety section open, expression measured.",
    "Leaves the hepatic-signal note visible and looks back with professional reserve.",
  ],
  focused_narrowing: [
    "Keeps a finger on the hepatic-signal note and looks back with a narrower expression.",
    "Looks from the safety section back to you with a narrower expression.",
  ],
  time_constrained: [
    "Checks the schedule, then taps the safety section once.",
    "Glances toward the doorway, safety notes still open beneath one hand.",
  ],
  hard_escalation: [
    "Sets the safety section flat on the desk, expression measured.",
    "Holds the hepatic-signal note still and waits for a direct answer.",
  ],
  terminal_exit: [
    "Closes the safety notes and turns back toward the next task.",
    "Gathers the safety section and shifts back toward the door.",
  ],
};

function deriveCueConcernFamily(inputs: HcpCueInputs): ConcernFamily {
  const reply = normalizeText(inputs.hcpReply).toLowerCase();
  const currentTurnConcern = deriveCurrentTurnConcernFamily(reply);
  if (currentTurnConcern) return currentTurnConcern;

  const registeredConcern = getScenarioConcernFamily({
    title: inputs.scenario?.title,
  });
  if (registeredConcern === "adoption_caution" || registeredConcern === "hesitation") return "general";
  if (registeredConcern) return registeredConcern;

  const journeyStage = String(inputs.scenario?.journeyStage || "").toLowerCase();
  const scenarioConcern = deriveConcernFamily({
    title: inputs.scenario?.title,
    journeyStage,
    objective: inputs.scenario?.objective,
    description: inputs.scenario?.description,
    openingScene: inputs.scenario?.openingScene,
    visualScene: inputs.scenario?.visualScene,
    interactionPressure: inputs.interactionPressures || [],
    keyChallenges: inputs.scenario?.keyChallenges || [],
  }) as ConcernFamily;
  if ((scenarioConcern as unknown as string) === "adoption_caution" || (scenarioConcern as unknown as string) === "hesitation") return "general";
  if (scenarioConcern && scenarioConcern !== "general") return scenarioConcern;

  const scenarioText = normalizeText(
    inputs.scenario?.title,
    journeyStage,
    inputs.scenario?.objective,
    inputs.scenario?.description,
    inputs.scenario?.openingScene,
    inputs.scenario?.visualScene,
    Array.isArray(inputs.scenario?.keyChallenges) ? inputs.scenario?.keyChallenges.join(" ") : ""
  ).toLowerCase();

  if (journeyStage === "initial_access") {
    const initialAccessText = `${reply} ${scenarioText}`;
    if (/\b(form|intake|schedule|clock|patient waiting|brief|quick|minutes)\b/.test(initialAccessText)) return "time";
    if (/\b(workflow|staff|callback|handoff|clinic|room turnover|front desk|process)\b/.test(initialAccessText)) return "workflow";
    if (/\b(access|coverage|copay|prior auth|formulary|payer|benefits)\b/.test(initialAccessText)) return "access";
    if (/\b(chart|patient list|case file|selection|screen|screening|identify)\b/.test(initialAccessText)) return "screening";
    return "general";
  }

  for (const pressure of inputs.interactionPressures || []) {
    const mapped = PRESSURE_TO_CONCERN[pressure];
    if (mapped) return mapped;
  }

  const combined = `${reply} ${scenarioText}`;
  for (const family of Object.keys(CONCERN_KEYWORDS) as ConcernFamily[]) {
    if (family === "general") continue;
    if (hasAny(combined, CONCERN_KEYWORDS[family])) return family;
  }

  const journeyMapped = JOURNEY_TO_CONCERN[String(inputs.scenario?.journeyStage || "").toLowerCase()];
  return journeyMapped || "general";
}

function deriveCueCategory(inputs: HcpCueInputs): CueCategory {
  const reply = normalizeText(inputs.hcpReply).toLowerCase();
  const behavior = String(inputs.behaviorState || "").toLowerCase();
  const pressures = inputs.interactionPressures || [];
  const runtimeTemperature = Number(inputs.runtimeTemperature || 0);
  const escalationLevel = Number(inputs.escalationLevel || 0);
  const skepticalOrClosed =
    pressures.includes("skeptical_resistant") ||
    ["closed", "resistance", "frustration", "time_pressure"].includes(behavior);

  if (TERMINAL_DIALOGUE_PATTERN.test(reply)) return "terminal_exit";
  if (runtimeTemperature >= 8 && (escalationLevel >= 1 || skepticalOrClosed)) return "hard_escalation";
  if (runtimeTemperature >= 4 && runtimeTemperature <= 7 && (escalationLevel >= 1 || skepticalOrClosed)) return "focused_narrowing";
  if (runtimeTemperature <= 3 && !pressures.includes("time_constrained") && escalationLevel < 2 && !TERMINAL_DIALOGUE_PATTERN.test(reply)) {
    return ["open", "openness", "curiosity"].includes(behavior) ? "receptive_attentive" : "neutral_attentive";
  }
  if (HARD_ESCALATION_PATTERN.test(reply) || ["frustration"].includes(behavior)) return "hard_escalation";
  if (
    pressures.includes("time_constrained") ||
    behavior === "time_pressure" ||
    HIGH_PRESSURE_DIALOGUE_PATTERN.test(reply)
  ) {
    return "time_constrained";
  }
  if (
    ["closed", "resistance"].includes(behavior) ||
    pressures.includes("skeptical_resistant") ||
    DIRECT_BOUNDARY_PATTERN.test(reply)
  ) {
    return "focused_narrowing";
  }
  if (["open", "openness", "curiosity"].includes(behavior)) return "receptive_attentive";
  return "neutral_attentive";
}

function inferConcernFamilyFromCueLabel(cueLabel = ""): ConcernFamily | null {
  const cue = normalizeCueFingerprint(cueLabel);
  if (!cue) return null;
  if (/\b(clock|schedule|door|doorway|next room|patient slot|brief)\b/.test(cue)) return "time";
  if (/\b(formulary|coverage|prior-auth|prior auth|access paperwork)\b/.test(cue)) return "access";
  if (/\b(forms|intake|workflow|callback|clinic list|notes|chart stack)\b/.test(cue)) return "workflow";
  if (/\b(chart|patient list|case file|patient notes)\b/.test(cue)) return "screening";
  if (/\b(study|trial|data|printout|journal)\b/.test(cue)) return "evidence";
  return null;
}

function cueContradictsCategory(cueText: string, cueCategory: CueCategory): boolean {
  const cue = cleanCueText(cueText).toLowerCase();
  if (!cue) return true;
  if (cueCategory === "terminal_exit") return !/\b(gathers|turns back|steps back|closes the|door)\b/i.test(cue);
  if (cueCategory === "time_constrained") return !/\b(clock|schedule|door|doorway|hall|next room|patient slot)\b/i.test(cue);
  if (cueCategory === "hard_escalation") return !/\b(jaw|clipped|holds still|sets|still)\b/i.test(cue);
  return false;
}

function softenCueLabel(text = ""): string {
  return normalizeText(text)
    .replace(/\bjaw set\b/gi, "expression measured")
    .replace(/\bjaw tightening slightly\b/gi, "expression tightening slightly")
    .replace(/\bclipped, closed expression\b/gi, "measured, closed expression")
    .replace(/\bclipped expression\b/gi, "measured expression")
    .replace(/\bexpression clipped around the ask\b/gi, "expression more focused")
    .replace(/\bvisibly\s+less\s+patient\s+with\s+another\s+setup\s+pass\b/gi, "exhales quietly")
    .replace(/\bholding steady eye contact\b/gi, "keeps steady eye contact")
    .replace(/\bsignaling\s+that\s+only\b/gi, "leaving room for only")
    .replace(/\bwill keep the exchange going\b/gi, "to keep the exchange focused");
}

export function isValidObservedCue(text: string): boolean {
  const cue = cleanCueText(text);
  const lower = cue.toLowerCase();
  if (!cue || cue.length < 14) return false;
  if (cue.split(/\s+/).length > 20) return false;
  if (!OBSERVABLE_VERB_PATTERN.test(cue)) return false;
  if (BANNED_CUE_TERMS.some((term) => lower.includes(term))) return false;
  return true;
}

function selectStateAlignedCue(inputs: HcpCueInputs, candidateCue = ""): { cueCategory: CueCategory; concernFamily: ConcernFamily; label: string } {
  const cueCategory = deriveCueCategory(inputs);
  const concernFamily = deriveCueConcernFamily(inputs);
  const registeredConcern = getScenarioConcernFamily({
    title: inputs.scenario?.title,
  });
  const domain = deriveScenarioDomain({
    title: inputs.scenario?.title,
    stakeholder: inputs.scenario?.objective,
    context: inputs.scenario?.description,
    description: normalizeText(inputs.scenario?.openingScene, inputs.scenario?.visualScene),
  });
  if ((inputs.hcpTurnCount || 0) === 0 && inputs.scenario?.title) {
    if (inputs.allowFirstTurnCandidateCue && isValidObservedCue(candidateCue)) {
      return {
        cueCategory,
        concernFamily,
        label: normalizeCueSentence(candidateCue),
      };
    }

    const runtimeProfile = deriveHcpRuntimeProfile({
      scenario: {
        title: inputs.scenario?.title,
        journeyStage: inputs.scenario?.journeyStage,
        interactionPressure: inputs.interactionPressures || [],
        persona: inputs.scenario?.persona || "",
      },
      behaviorState: inputs.behaviorState,
    });
    const firstTurnCue = buildGlobalFirstTurnCue({
      scenario: {
        title: inputs.scenario?.title,
        journeyStage: inputs.scenario?.journeyStage,
        openingScene: inputs.scenario?.openingScene,
        visualScene: inputs.scenario?.visualScene,
        interactionPressure: inputs.interactionPressures || [],
      },
      concernFamily: registeredConcern || concernFamily,
      profile: runtimeProfile,
    });
    if (firstTurnCue && isValidObservedCue(firstTurnCue)) {
      return {
        cueCategory,
        concernFamily,
        label: normalizeCueSentence(firstTurnCue),
      };
    }
  }
  const domainPool =
    DOMAIN_CUE_POOLS[domain]?.[cueCategory]?.[concernFamily]
    || DOMAIN_CUE_POOLS[domain]?.[cueCategory]?.general
    || [];
  const safetyPool = isSafetyFocusedTurn(inputs.hcpReply) && concernFamily === "evidence"
    ? SAFETY_EVIDENCE_CUE_POOLS[cueCategory] || []
    : [];
  const pool = [...safetyPool, ...domainPool, ...(CUE_POOLS[cueCategory]?.[concernFamily] || CUE_POOLS[cueCategory].general)];
  const seed = [
    inputs.scenario?.id || inputs.scenario?.title || "scenario",
    inputs.scenario?.journeyStage || "",
    cueCategory,
    concernFamily,
    inputs.behaviorState,
    normalizeText(inputs.hcpReply),
    String(inputs.hcpTurnCount || 0),
  ].join(":");

  const recentCueFingerprints = new Set(
    (inputs.recentCueLabels || []).map((label) => normalizeCueFingerprint(label)).filter(Boolean)
  );
  const recentCueSignatures = (inputs.recentCueLabels || [])
    .map((label) => cueSequenceSignature(label))
    .filter(Boolean)
    .slice(-4);
  const recentCueFrames = (inputs.recentCueLabels || [])
    .map((label) => cueFrameSignature(label))
    .filter(Boolean)
    .slice(-6);
  const recentSignatureSet = new Set(recentCueSignatures);
  const recentFrameSet = new Set(recentCueFrames);
  const lastSignature = recentCueSignatures[recentCueSignatures.length - 1] || "";
  const secondToLastSignature = recentCueSignatures[recentCueSignatures.length - 2] || "";
  const lastFrame = recentCueFrames[recentCueFrames.length - 1] || "";
  const secondToLastFrame = recentCueFrames[recentCueFrames.length - 2] || "";
  const rotationOffset = (inputs.recentCueLabels || []).length % Math.max(1, pool.length);
  const seedIndex = (deterministicIndex(seed, pool.length) + rotationOffset) % Math.max(1, pool.length);
  let derived = pool[seedIndex] || pool[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (let offset = 0; offset < pool.length; offset += 1) {
    const nextCue = pool[(seedIndex + offset) % pool.length];
    const fingerprint = normalizeCueFingerprint(nextCue);
    const signature = cueSequenceSignature(nextCue);
    const frame = cueFrameSignature(nextCue);
    let score = 0;

    if (recentCueFingerprints.has(fingerprint)) score += 100;
    if (signature === lastSignature) score += 40;
    if (signature === secondToLastSignature) score += 20;
    if (recentSignatureSet.has(signature)) score += 10;
    if (frame === lastFrame) score += 35;
    if (frame === secondToLastFrame) score += 15;
    if (recentFrameSet.has(frame)) score += 8;

    if (score < bestScore) {
      bestScore = score;
      derived = nextCue;
    }
  }
  const cleanedCandidate = cleanCueText(candidateCue);
  const candidateConcern = inferConcernFamilyFromCueLabel(cleanedCandidate);
  const candidateMatchesCurrentConcern = !candidateConcern || candidateConcern === concernFamily;
  const canUseCandidateAfterOpening = (inputs.hcpTurnCount || 0) <= 0 || Boolean(inputs.allowFirstTurnCandidateCue && candidateMatchesCurrentConcern && !isSafetyFocusedTurn(inputs.hcpReply));
  const useCandidate =
    canUseCandidateAfterOpening &&
    isValidObservedCue(cleanedCandidate) &&
    candidateMatchesCurrentConcern &&
    !cueContradictsCategory(cleanedCandidate, cueCategory) &&
    !recentCueFingerprints.has(normalizeCueFingerprint(cleanedCandidate)) &&
    cueSequenceSignature(cleanedCandidate) !== lastSignature &&
    cueSequenceSignature(cleanedCandidate) !== secondToLastSignature &&
    cueFrameSignature(cleanedCandidate) !== lastFrame;

  return {
    cueCategory,
    concernFamily,
    label: normalizeCueSentence(useCandidate ? cleanedCandidate : derived),
  };
}

export function generateHcpCue(inputs: HcpCueInputs): string {
  return selectStateAlignedCue(inputs).label;
}

export function buildCueDescription(
  behaviorState: string,
  interactionPressures: string[] = [],
  cueLabel = "",
  category?: CueCategory,
  concernFamily?: ConcernFamily,
  scenario?: HcpCueInputs["scenario"]
): string {
  const journeyStage = String(scenario?.journeyStage || "").toLowerCase();
  const scenarioText = normalizeText(
    scenario?.title,
    scenario?.journeyStage,
    scenario?.objective,
    scenario?.description,
    scenario?.openingScene,
    scenario?.visualScene,
    Array.isArray(scenario?.keyChallenges) ? scenario?.keyChallenges.join(" ") : ""
  );
  const preserveGeneralConcern =
    derivedScenarioNeedsGeneralConcern(scenarioText, journeyStage);
  const derivedCategory = category || deriveCueCategory({
    hcpReply: cueLabel,
    behaviorState,
    interactionPressures,
  });
  const derivedConcernFamily = concernFamily || deriveCueConcernFamily({
    hcpReply: cueLabel,
    behaviorState,
    interactionPressures,
  });
  const cueLabelConcern = inferConcernFamilyFromCueLabel(cueLabel);
  const finalConcernFamily =
    derivedConcernFamily === "evidence" && cueLabelConcern && cueLabelConcern !== "evidence"
      ? cueLabelConcern
      : preserveGeneralConcern && derivedConcernFamily === "general"
        ? derivedConcernFamily
      : cueLabelConcern && derivedConcernFamily === "general"
        ? cueLabelConcern
        : derivedConcernFamily;

  return `${pick(
    BEHAVIOR_DESCRIPTION_BANK[derivedCategory],
    normalizeText(
      scenario?.title,
      scenario?.journeyStage,
      derivedCategory,
      finalConcernFamily,
      cueLabel
    )
  )} ${deriveAnchorAwareConcernDescription({
    scenario,
    concernFamily: finalConcernFamily,
  })}`.trim();
}

function derivedScenarioNeedsGeneralConcern(scenarioText = "", journeyStage = ""): boolean {
  if (journeyStage === "commitment_close") return true;
  return /\bright patient\b|\bfit(s|ting)? perfectly\b|\bfirst one\b|\bnot ready to be the first\b|\blow-risk\b|\bsafe enough\b|\bfirst move\b/i.test(scenarioText);
}

export function resolveObservedCue(
  candidateCue: string,
  inputs: HcpCueInputs
): { label: string; description: string; source: "hcp_context" } {
  const selected = selectStateAlignedCue(inputs, candidateCue);
  const label = softenCueLabel(selected.label);

  return {
    label,
    description: buildCueDescription(
      inputs.behaviorState,
      inputs.interactionPressures || [],
      label,
      selected.cueCategory,
      selected.concernFamily,
      inputs.scenario
    ),
    source: "hcp_context",
  };
}
