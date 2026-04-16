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

import { deriveConcernFamily, deriveScenarioDomain } from "./hcpTurnDirectives";

export interface HcpCueInputs {
  hcpReply: string;
  behaviorState: string;
  interactionPressures?: string[];
  recentCueLabels?: string[];
  scenario?: {
    id?: string;
    title?: string;
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
  /\b(need to run|have to run|got to go|we should stop|we can stop there|we are done|i have to get back|next patient|wrap this up|that is all i have time for)\b/i;

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
];

const CONCERN_KEYWORDS: Record<ConcernFamily, string[]> = {
  evidence: ["data", "study", "trial", "evidence", "proof", "subgroup", "threshold", "guideline", "journal"],
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
    ],
    workflow: [
      "Turns back toward you with the workflow notes still open on the desk.",
      "Keeps the clinic notes nearby, posture open enough to keep listening.",
    ],
    access: [
      "Keeps the coverage notes open, attention visibly with you.",
      "Looks up from the formulary sheet and leaves the conversation space open.",
    ],
    screening: [
      "Leans toward the chart, giving the selection question full attention.",
      "Keeps the patient list open and looks back with measured interest.",
    ],
    time: [
      "Gives a quick nod and leaves a small opening for the next point.",
      "Keeps one hand near the schedule but stays with you for the answer.",
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
    ],
    workflow: [
      "Keeps the workflow notes nearby, looking up without losing the thread.",
      "Leaves the clinic list open and settles back into a professional posture.",
    ],
    access: [
      "Keeps the coverage notes in view, pen still against the page.",
      "Leaves the formulary sheet open and looks back without changing posture.",
    ],
    screening: [
      "Keeps the patient list open, attention settling on the chart in front of them.",
      "Leaves the chart visible on the desk and looks up with measured focus.",
    ],
    time: [
      "Checks the schedule once, then returns attention to you.",
      "Glances toward the clock and comes back with a brief nod.",
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
    ],
    workflow: [
      "Keeps a hand on the workflow notes, posture tightening.",
      "Glances at the clinic list, then looks back with a narrower focus.",
    ],
    access: [
      "Glances at the coverage notes, then looks back with a tighter expression.",
      "Keeps the formulary sheet in view, posture closed down around the question.",
    ],
    screening: [
      "Keeps the patient list open, eyes narrowing at the selection question.",
      "Looks back from the chart with a more exacting expression.",
    ],
    time: [
      "Checks the clock, then looks back with very little room for a detour.",
      "Keeps their eyes on you for a beat, expression tightening around the ask.",
    ],
    general: [
      "Holds steady eye contact, expression narrowing.",
      "Goes still for a beat, leaving little room for a detour.",
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
    ],
    screening: [
      "Checks the schedule, then taps the patient list once.",
      "Glances toward the doorway, chart still open in front of them.",
    ],
    time: [
      "Checks the clock, then looks back with a tighter expression.",
      "Glances toward the next room and comes back ready for one concise point.",
    ],
    general: [
      "Checks the clock, then looks back with a tighter expression.",
      "Glances toward the doorway, posture still signaling limited time.",
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

const DOMAIN_CUE_POOLS: Partial<Record<string, Partial<Record<CueCategory, Partial<Record<ConcernFamily, string[]>>>>>> = {
  oncology: {
    focused_narrowing: {
      evidence: [
        "Keeps one finger on the study printout, eyes narrowing at the data.",
        "Looks from the marked-up trial page back to you without relaxing her expression.",
      ],
    },
    time_constrained: {
      evidence: [
        "Checks the clock, then taps the data page once with her pen.",
        "Glances toward the doorway, trial printout still open beneath one hand.",
      ],
    },
    hard_escalation: {
      evidence: [
        "Sets the printout flat on the desk, jaw tightening slightly.",
        "Holds the data page still, expression clipped around the ask.",
      ],
    },
  },
  hiv: {
    focused_narrowing: {
      workflow: [
        "Glances at the callback list, then looks back with a tighter expression.",
        "Keeps one hand on the workflow notes, posture narrowing around the question.",
      ],
      access: [
        "Looks down at the prior-auth note, then back at you without softening.",
        "Keeps the access paperwork in view, expression tightening around the bottleneck.",
      ],
    },
    time_constrained: {
      workflow: [
        "Checks the schedule, then rests a hand on the callback list.",
        "Glances toward the next room, workflow notes still open beneath one hand.",
      ],
    },
  },
  cardiology: {
    focused_narrowing: {
      access: [
        "Looks down at the discharge paperwork, then back with a tighter expression.",
        "Keeps the formulary notes open, posture closing down around the practical ask.",
      ],
      workflow: [
        "Glances at the discharge summary, then looks back with a narrower focus.",
        "Keeps one hand on the med list, eyes fixed on the next step.",
      ],
    },
    time_constrained: {
      access: [
        "Checks the clock, discharge paperwork still open on the desk.",
        "Glances toward the hallway, formulary notes still in front of her.",
      ],
    },
  },
  rare: {
    neutral_attentive: {
      screening: [
        "Keeps the case file open, eyes moving once over the patient notes.",
        "Leaves the chart visible on the desk and looks back with measured focus.",
      ],
    },
    focused_narrowing: {
      screening: [
        "Looks down at the case notes, then back with a more exacting expression.",
        "Keeps the patient file open, eyes narrowing at the identification question.",
      ],
    },
  },
};

const BEHAVIOR_DESCRIPTION_BANK: Record<CueCategory, string> = {
  receptive_attentive: "The HCP is leaving space for the conversation to move forward, so the next turn should stay specific and relevant.",
  neutral_attentive: "The HCP is still evaluating the exchange, so the next turn needs to earn more of their attention.",
  focused_narrowing: "The HCP is narrowing the exchange around one issue, so the next response should answer that issue directly.",
  time_constrained: "Time is visibly limiting the exchange, so the next move has to stay tight and immediately useful.",
  hard_escalation: "Patience is tightening, so another detour will harden the conversation further.",
  terminal_exit: "The interaction is closing, so only a concise, relevant final move has any room left.",
};

const CONCERN_DESCRIPTION_BANK: Record<ConcernFamily, string> = {
  evidence: "They are holding on the proof point, not general framing.",
  workflow: "They are watching for what this changes in clinic flow, not a broad concept.",
  access: "They are locked on the access step that actually slows care down.",
  screening: "They are holding on the patient-selection boundary, not a generic statement.",
  time: "They are signaling limited availability, so the next move needs real economy.",
  general: "They are signaling how tight the conversation window is right now.",
};

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
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCueSentence(text: string): string {
  const cleaned = cleanCueText(text).replace(/[.?!]+$/g, "").trim();
  if (!cleaned) return "";
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

function deriveCueConcernFamily(inputs: HcpCueInputs): ConcernFamily {
  const scenarioConcern = deriveConcernFamily({
    title: inputs.scenario?.title,
    journeyStage: inputs.scenario?.journeyStage,
    objective: inputs.scenario?.objective,
    description: inputs.scenario?.description,
    openingScene: inputs.scenario?.openingScene,
    visualScene: inputs.scenario?.visualScene,
    interactionPressure: inputs.interactionPressures || [],
    keyChallenges: inputs.scenario?.keyChallenges || [],
  }) as ConcernFamily;
  if (scenarioConcern && scenarioConcern !== "general") return scenarioConcern;

  const reply = normalizeText(inputs.hcpReply).toLowerCase();
  const scenarioText = normalizeText(
    inputs.scenario?.title,
    inputs.scenario?.journeyStage,
    inputs.scenario?.objective,
    inputs.scenario?.description,
    inputs.scenario?.openingScene,
    inputs.scenario?.visualScene,
    Array.isArray(inputs.scenario?.keyChallenges) ? inputs.scenario?.keyChallenges.join(" ") : ""
  ).toLowerCase();

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

  if (TERMINAL_DIALOGUE_PATTERN.test(reply)) return "terminal_exit";
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

function cueContradictsCategory(cueText: string, cueCategory: CueCategory): boolean {
  const cue = cleanCueText(cueText).toLowerCase();
  if (!cue) return true;
  if (cueCategory === "terminal_exit") return !/\b(gathers|turns back|steps back|closes the|door)\b/i.test(cue);
  if (cueCategory === "time_constrained") return !/\b(clock|schedule|door|doorway|hall|next room|patient slot)\b/i.test(cue);
  if (cueCategory === "hard_escalation") return !/\b(jaw|clipped|holds still|sets|still)\b/i.test(cue);
  return false;
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
  const domain = deriveScenarioDomain({
    title: inputs.scenario?.title,
    stakeholder: inputs.scenario?.objective,
    context: inputs.scenario?.description,
    description: normalizeText(inputs.scenario?.openingScene, inputs.scenario?.visualScene),
  });
  const domainPool =
    DOMAIN_CUE_POOLS[domain]?.[cueCategory]?.[concernFamily]
    || DOMAIN_CUE_POOLS[domain]?.[cueCategory]?.general
    || [];
  const pool = [...domainPool, ...(CUE_POOLS[cueCategory]?.[concernFamily] || CUE_POOLS[cueCategory].general)];
  const seed = [
    inputs.scenario?.id || inputs.scenario?.title || "scenario",
    inputs.scenario?.journeyStage || "",
    cueCategory,
    concernFamily,
    inputs.behaviorState,
    normalizeText(inputs.hcpReply),
  ].join(":");

  const recentCueFingerprints = new Set(
    (inputs.recentCueLabels || []).map((label) => normalizeCueFingerprint(label)).filter(Boolean)
  );
  const recentCueSignatures = (inputs.recentCueLabels || [])
    .map((label) => cueSequenceSignature(label))
    .filter(Boolean)
    .slice(-4);
  const recentSignatureSet = new Set(recentCueSignatures);
  const lastSignature = recentCueSignatures[recentCueSignatures.length - 1] || "";
  const secondToLastSignature = recentCueSignatures[recentCueSignatures.length - 2] || "";
  const rotationOffset = (inputs.recentCueLabels || []).length % Math.max(1, pool.length);
  const seedIndex = (deterministicIndex(seed, pool.length) + rotationOffset) % Math.max(1, pool.length);
  let derived = pool[seedIndex] || pool[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (let offset = 0; offset < pool.length; offset += 1) {
    const nextCue = pool[(seedIndex + offset) % pool.length];
    const fingerprint = normalizeCueFingerprint(nextCue);
    const signature = cueSequenceSignature(nextCue);
    let score = 0;

    if (recentCueFingerprints.has(fingerprint)) score += 100;
    if (signature === lastSignature) score += 40;
    if (signature === secondToLastSignature) score += 20;
    if (recentSignatureSet.has(signature)) score += 10;

    if (score < bestScore) {
      bestScore = score;
      derived = nextCue;
    }
  }
  const cleanedCandidate = cleanCueText(candidateCue);
  const useCandidate =
    isValidObservedCue(cleanedCandidate) &&
    !cueContradictsCategory(cleanedCandidate, cueCategory) &&
    !recentCueFingerprints.has(normalizeCueFingerprint(cleanedCandidate)) &&
    cueSequenceSignature(cleanedCandidate) !== lastSignature &&
    cueSequenceSignature(cleanedCandidate) !== secondToLastSignature;

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
  concernFamily?: ConcernFamily
): string {
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

  return `${BEHAVIOR_DESCRIPTION_BANK[derivedCategory]} ${CONCERN_DESCRIPTION_BANK[derivedConcernFamily]}`.trim();
}

export function resolveObservedCue(
  candidateCue: string,
  inputs: HcpCueInputs
): { label: string; description: string; source: "hcp_context" } {
  const selected = selectStateAlignedCue(inputs, candidateCue);

  return {
    label: selected.label,
    description: buildCueDescription(
      inputs.behaviorState,
      inputs.interactionPressures || [],
      selected.label,
      selected.cueCategory,
      selected.concernFamily
    ),
    source: "hcp_context",
  };
}
