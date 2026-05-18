export const HCP_CUE_ALIGNMENT_VERSION = "hcp_cue_state_alignment_v1";

const TERMINAL_DIALOGUE_PATTERN = /\b(pause here|should pause|probably done|not ready to keep going|not useful|get back to clinic|stop here|wrap|ending|move on|front desk|follow-up slot|cannot continue|we are done|cannot make this specific)\b/i;
const TERMINAL_CUE_PATTERN = /\b(door|leav|ending|exchange is over|wrap|front desk|turns back toward|patient room|gathers the chart)\b/i;
const SOFT_CUE_PATTERN = /\b(open|receptive|warm|relaxed|inviting|thoughtful|leans in|steady eye contact)\b/i;
const HIGH_PRESSURE_PATTERN = /\b(time|minutes|clock|schedule|busy|short-staffed|bandwidth|next patient|clinic flow|protect clinic)\b/i;
const INTERNAL_NARRATION_PATTERN = /\b(returns? to the (?:evidence|workflow|access|screening) ask|keeps the time pressure visible|decision-relevant point|usable step|proof point|current ask|directly useful point|signaling|waiting for the|watching for|attention tightens|attention narrows|less patient with another setup pass|not moving the discussion|not helping|not enough|not moving the conversation)\b/i;

function normalizeText(value = "") {
  return String(value || "").trim();
}

function repairCueSurface(cueText = "") {
  let cue = normalizeText(cueText).replace(/\s+/g, " ");
  if (!cue) return "";

  cue = cue
    .replace(/\bglances at watch\b/gi, "glances at the watch")
    .replace(/\bglances at clock\b/gi, "glances at the clock")
    .replace(/\bglances at schedule\b/gi, "glances at the schedule")
    .replace(/\bglances at patient intake forms\b/gi, "glances at the patient intake forms")
    .replace(/\bglances at chart\b/gi, "glances at the chart")
    .replace(/\bglances at notes\b/gi, "glances at the notes")
    .replace(/\bkeeps (?:their|his|her) eyes on you for a beat,?\s*expression tightening around the ask\b/gi, "keeps steady eye contact, expression more focused")
    .replace(/\bkeeps (?:their|his|her) eyes on you for a beat\b/gi, "keeps steady eye contact")
    .replace(/\bexpression tightening around the ask\b/gi, "expression focused on the question")
    .replace(/\bkeeps the ([a-z -]+) under one hand,?\s*expression tightening around the ([a-z -]+)\b/gi, "keeps the $1 nearby, focused on the $2")
    .replace(/\bunder one hand\b/gi, "nearby")
    .replace(/\bexpression tightening around the ([a-z -]+)\b/gi, "focused on the $1")
    .replace(/\bgoes still for a beat,?\s*leaving little room for a detour\b/gi, "pauses briefly and keeps steady eye contact");

  if (/^(glances|checks|looks|leans|nods|pauses|scans|reviews|shifts|gestures|rereads|folds|gathers|taps|closes)\b/i.test(cue)) {
    cue = `The HCP ${cue.charAt(0).toLowerCase()}${cue.slice(1)}`;
  }

  return cue.replace(/\s+/g, " ").trim();
}

function normalizeConcernFamily(value = "general") {
  const text = String(value || "").toLowerCase();
  if (/evidence|data|proof|decision|durability|endpoint|subgroup|safety|hepatic|adverse|monitor|formulary/.test(text)) return "evidence";
  if (/screen|selection|candidate|criteria|resistance|adherence|injectable/.test(text)) return "screening";
  if (/access|coverage|payer|prior|auth|copay|benefits|hub/.test(text)) return "access";
  if (/workflow|process|team|staff|step|clinic|monitor|implementation|practical/.test(text)) return "workflow";
  if (/time|minutes|schedule|bandwidth/.test(text)) return "time";
  return "general";
}

function deterministicIndex(seed = "", modulo = 1) {
  const text = String(seed || "");
  if (!text || modulo <= 1) return 0;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0) % modulo;
}

function deriveCueCategory({
  dialogueText = "",
  hcpState = "",
  decayTier = "",
  conversationIntelligenceState = {},
  validationOutput = {},
  terminal = false,
  timePressure = false,
} = {}) {
  const stateText = `${hcpState} ${decayTier}`.toLowerCase();
  const ciProgression = conversationIntelligenceState?.turnInterpretation?.progression || "";
  const repeatedWithoutAdapting = Boolean(
    conversationIntelligenceState?.adaptationSignals?.repeated_without_adapting
    || validationOutput?.nonAdaptiveRepetition?.detected
  );

  if (terminal || TERMINAL_DIALOGUE_PATTERN.test(dialogueText) || /disengag|closing/.test(stateText)) return "terminal_exit";
  if (validationOutput?.hardInvalid || ciProgression === "evasive" || (ciProgression === "stalled" && /impatient|disengaging|boundary/.test(stateText))) {
    return "hard_escalation";
  }
  if (repeatedWithoutAdapting) return "non_adaptive_impatience";
  if (timePressure || HIGH_PRESSURE_PATTERN.test(dialogueText) || /time/.test(stateText)) return "time_constrained";
  if (/impatient|constrained|boundary|resistant/.test(stateText)) return "focused_narrowing";
  if (ciProgression === "partial" || validationOutput?.softInvalid) return "focused_narrowing";
  return "neutral_attentive";
}

const CUE_POOLS = Object.freeze({
  neutral_attentive: Object.freeze({
    evidence: Object.freeze([
      "The HCP keeps the study page open and looks back with a measured expression.",
      "The HCP rests a pen beside the marked data and stays oriented toward the conversation.",
    ]),
    workflow: Object.freeze([
      "The HCP keeps the clinic list nearby and looks back with a measured expression.",
      "The HCP rests one hand beside the workflow notes and stays oriented toward the conversation.",
    ]),
    access: Object.freeze([
      "The HCP keeps the coverage notes in view and looks back with a measured expression.",
      "The HCP rests a pen beside the formulary page and stays oriented toward the conversation.",
    ]),
    screening: Object.freeze([
      "The HCP keeps the patient list open and looks back with a measured expression.",
      "The HCP rests one hand beside the chart and stays oriented toward the conversation.",
    ]),
    time: Object.freeze([
      "The HCP checks the schedule once, then looks back with a measured expression.",
      "The HCP glances toward the clock and returns attention to the conversation.",
    ]),
    general: Object.freeze([
      "The HCP keeps a professional posture and steady eye contact.",
      "The HCP gives a brief nod and stays oriented toward the conversation.",
    ]),
  }),
  focused_narrowing: Object.freeze({
    evidence: Object.freeze([
      "The HCP taps the marked data page once and looks back with a narrower expression.",
      "The HCP keeps a finger on the study page and holds steady eye contact.",
    ]),
    workflow: Object.freeze([
      "The HCP glances at the clinic list, then looks back with a narrower expression.",
      "The HCP keeps one hand on the workflow notes and holds steady eye contact.",
    ]),
    access: Object.freeze([
      "The HCP glances at the coverage notes, then looks back with a narrower expression.",
      "The HCP keeps the formulary page under one hand and holds steady eye contact.",
    ]),
    screening: Object.freeze([
      "The HCP glances at the patient list, then looks back with a narrower expression.",
      "The HCP keeps one finger on the chart and holds steady eye contact.",
    ]),
    time: Object.freeze([
      "The HCP checks the clock, then looks back with little room for a detour.",
      "The HCP glances toward the next room and returns with a tighter expression.",
    ]),
    general: Object.freeze([
      "The HCP holds steady eye contact, expression narrowing.",
      "The HCP pauses briefly and keeps their posture tight.",
    ]),
  }),
  non_adaptive_impatience: Object.freeze({
    evidence: Object.freeze([
      "The HCP keeps a finger on the data page and exhales quietly.",
      "The HCP sets the study page flat on the desk and looks back without softening.",
    ]),
    workflow: Object.freeze([
      "The HCP keeps a hand on the clinic list and exhales quietly.",
      "The HCP sets the workflow notes flat on the desk and looks back without softening.",
    ]),
    access: Object.freeze([
      "The HCP keeps the coverage notes in hand and exhales quietly.",
      "The HCP sets the formulary page flat on the desk and looks back without softening.",
    ]),
    screening: Object.freeze([
      "The HCP keeps a hand on the patient list and exhales quietly.",
      "The HCP sets the chart flat on the desk and looks back without softening.",
    ]),
    time: Object.freeze([
      "The HCP checks the schedule again and returns with a tighter expression.",
      "The HCP glances toward the doorway and keeps the exchange brief.",
    ]),
    general: Object.freeze([
      "The HCP goes still for a beat and keeps steady eye contact.",
      "The HCP folds their hands on the desk and looks back without softening.",
    ]),
  }),
  time_constrained: Object.freeze({
    evidence: Object.freeze([
      "The HCP checks the schedule, then taps the study page once.",
      "The HCP glances toward the doorway, study page still open beneath one hand.",
    ]),
    workflow: Object.freeze([
      "The HCP checks the schedule, then rests a hand on the callback list.",
      "The HCP glances toward the hall, clinic notes still open beneath one hand.",
    ]),
    access: Object.freeze([
      "The HCP checks the next appointment, coverage notes still in hand.",
      "The HCP glances toward the doorway, formulary page still open on the desk.",
    ]),
    screening: Object.freeze([
      "The HCP checks the schedule, then taps the patient list once.",
      "The HCP glances toward the doorway, chart still open in front of them.",
    ]),
    time: Object.freeze([
      "The HCP checks the clock, then looks back with a tighter expression.",
      "The HCP glances toward the next room and returns attention to you.",
    ]),
    general: Object.freeze([
      "The HCP checks the clock, then looks back with a tighter expression.",
      "The HCP glances toward the doorway and returns attention to you.",
    ]),
  }),
  hard_escalation: Object.freeze({
    evidence: Object.freeze([
      "The HCP holds the study page still, jaw set.",
      "The HCP sets the printout flat on the desk, expression clipped.",
    ]),
    workflow: Object.freeze([
      "The HCP holds the workflow notes still, jaw set.",
      "The HCP sets the clinic list flat on the desk, expression clipped.",
    ]),
    access: Object.freeze([
      "The HCP holds the coverage notes still, jaw set.",
      "The HCP sets the formulary sheet flat on the desk, expression clipped.",
    ]),
    screening: Object.freeze([
      "The HCP holds the patient list still, jaw set.",
      "The HCP sets the chart flat on the desk, expression clipped.",
    ]),
    time: Object.freeze([
      "The HCP goes still for a beat, jaw set, eyes on the clock.",
      "The HCP looks back with a clipped expression, one hand still on the schedule.",
    ]),
    general: Object.freeze([
      "The HCP goes still for a beat, jaw set.",
      "The HCP holds eye contact with a clipped expression.",
    ]),
  }),
  terminal_exit: Object.freeze({
    evidence: Object.freeze([
      "The HCP gathers the study printout and turns back toward the next task.",
      "The HCP closes the journal page and shifts back toward the door.",
    ]),
    workflow: Object.freeze([
      "The HCP gathers the workflow notes and turns back toward clinic flow.",
      "The HCP steps back toward the desk, callback list still in hand.",
    ]),
    access: Object.freeze([
      "The HCP gathers the coverage notes and turns back toward the next task.",
      "The HCP closes the formulary sheet and shifts back toward the doorway.",
    ]),
    screening: Object.freeze([
      "The HCP gathers the chart and turns back toward the next task.",
      "The HCP closes the patient list and steps back toward the desk.",
    ]),
    time: Object.freeze([
      "The HCP turns back toward the next patient slot.",
      "The HCP steps back toward the door, eyes already on the next room.",
    ]),
    general: Object.freeze([
      "The HCP gathers the chart and turns back toward the next task.",
      "The HCP steps back toward the door and closes the conversation space.",
    ]),
  }),
});

function selectCueFromPool({ cueCategory, concernFamily, seed }) {
  const categoryPool = CUE_POOLS[cueCategory] || CUE_POOLS.neutral_attentive;
  const familyPool = categoryPool[concernFamily] || categoryPool.general;
  return familyPool[deterministicIndex(seed, familyPool.length)] || familyPool[0] || "";
}

export function detectInternalNarrationLeak(cueText = "") {
  return INTERNAL_NARRATION_PATTERN.test(String(cueText || ""));
}

export function reviseCueForObservableBehavior({ cueText = "", cueCategory = "neutral_attentive", concernFamily = "general" } = {}) {
  const cue = repairCueSurface(cueText);
  if (!detectInternalNarrationLeak(cue)) return cue;
  const replacements = {
    evidence: {
      neutral_attentive: "The HCP keeps the chart open and looks back with a measured expression.",
      focused_narrowing: "The HCP taps the data page once, keeping the conversation narrowed to the decision in front of them.",
      non_adaptive_impatience: "The HCP keeps a finger on the data page and exhales quietly.",
      time_constrained: "The HCP checks the schedule, then rests a hand on the chart while leaving room for one concise point.",
      hard_escalation: "The HCP holds the chart still, expression clipped.",
      terminal_exit: "The HCP gathers the chart and turns back toward the next task.",
    },
    workflow: {
      neutral_attentive: "The HCP keeps the clinic list nearby and looks back with a measured expression.",
      focused_narrowing: "The HCP glances at the clinic list, then waits for a practical staff-level answer.",
      non_adaptive_impatience: "The HCP keeps a hand on the clinic list and exhales quietly.",
      time_constrained: "The HCP checks the schedule, then rests a hand on the callback list.",
      hard_escalation: "The HCP holds the clinic list still, expression clipped.",
      terminal_exit: "The HCP gathers the workflow notes and turns back toward the clinic flow.",
    },
    access: {
      neutral_attentive: "The HCP keeps the coverage notes in view and looks back with a measured expression.",
      focused_narrowing: "The HCP glances at the coverage notes, then waits for a workable administrative step.",
      non_adaptive_impatience: "The HCP keeps the coverage notes in hand and exhales quietly.",
      time_constrained: "The HCP checks the next appointment, then keeps the coverage notes in hand.",
      hard_escalation: "The HCP holds the coverage notes still, expression clipped.",
      terminal_exit: "The HCP gathers the coverage notes and turns back toward the next task.",
    },
    screening: {
      neutral_attentive: "The HCP keeps the patient list nearby and looks back with a measured expression.",
      focused_narrowing: "The HCP glances at the patient list, then waits for a usable selection boundary.",
      non_adaptive_impatience: "The HCP keeps a hand on the patient list and exhales quietly.",
      time_constrained: "The HCP checks the schedule, then taps the patient list once.",
      hard_escalation: "The HCP holds the patient list still, expression clipped.",
      terminal_exit: "The HCP gathers the patient list and turns back toward the next task.",
    },
    general: {
      neutral_attentive: "The HCP keeps a professional posture and steady eye contact.",
      focused_narrowing: "The HCP narrows their gaze and pauses briefly.",
      non_adaptive_impatience: "The HCP keeps their posture tight and exhales quietly.",
      time_constrained: "The HCP checks the schedule, then looks back with a tighter expression.",
      hard_escalation: "The HCP holds still, expression clipped.",
      terminal_exit: "The HCP gathers the chart and turns back toward the next task.",
    },
  };
  return replacements[concernFamily]?.[cueCategory] || replacements.general[cueCategory] || replacements.general.neutral_attentive;
}

function cueContradictsState({ cueText = "", cueCategory = "", dialogueText = "", terminal = false } = {}) {
  const cue = String(cueText || "");
  if (!cue) return true;
  if (cueCategory === "terminal_exit") return !TERMINAL_CUE_PATTERN.test(cue);
  if (terminal || TERMINAL_DIALOGUE_PATTERN.test(dialogueText)) return !TERMINAL_CUE_PATTERN.test(cue);
  if (["hard_escalation", "non_adaptive_impatience"].includes(cueCategory)) return SOFT_CUE_PATTERN.test(cue);
  if (cueCategory === "neutral_attentive") return TERMINAL_CUE_PATTERN.test(cue);
  return false;
}

export function deriveHcpCueState({
  activeHcpAsk = "",
  concernFamily = "",
  escalationStage = "",
  hcpState = "",
  decayTier = "",
  timePressure = false,
  terminal = false,
  conversationIntelligenceState = {},
  validationOutput = {},
  dialogueText = "",
} = {}) {
  const resolvedConcernFamily = normalizeConcernFamily(
    concernFamily
    || conversationIntelligenceState?.turnInterpretation?.concernFamily
    || activeHcpAsk
    || dialogueText
  );
  const cueCategory = deriveCueCategory({
    dialogueText,
    hcpState: `${hcpState} ${escalationStage}`,
    decayTier,
    conversationIntelligenceState,
    validationOutput,
    terminal,
    timePressure,
  });

  return {
    version: HCP_CUE_ALIGNMENT_VERSION,
    cueCategory,
    concernFamily: resolvedConcernFamily,
    terminalCue: cueCategory === "terminal_exit",
    escalationStage: escalationStage || null,
    stateSignals: {
      repeatedWithoutAdapting: Boolean(
        conversationIntelligenceState?.adaptationSignals?.repeated_without_adapting
        || validationOutput?.nonAdaptiveRepetition?.detected
      ),
      progression: conversationIntelligenceState?.turnInterpretation?.progression || null,
      validationStatus: conversationIntelligenceState?.turnInterpretation?.valid || null,
      timePressure: Boolean(timePressure),
      terminal: Boolean(terminal || TERMINAL_DIALOGUE_PATTERN.test(dialogueText)),
    },
  };
}

export function selectStateAlignedHcpCue({
  existingCueText = "",
  preferStateDerived = false,
  activeHcpAsk = "",
  concernFamily = "",
  escalationStage = "",
  hcpState = "",
  decayTier = "",
  timePressure = false,
  terminal = false,
  conversationIntelligenceState = {},
  validationOutput = {},
  dialogueText = "",
  scenarioId = "",
  turnNumber = 0,
} = {}) {
  const cueState = deriveHcpCueState({
    activeHcpAsk,
    concernFamily,
    escalationStage,
    hcpState,
    decayTier,
    timePressure,
    terminal,
    conversationIntelligenceState,
    validationOutput,
    dialogueText,
  });
  const seed = [
    scenarioId || "scenario",
    turnNumber,
    cueState.cueCategory,
    cueState.concernFamily,
    cueState.stateSignals.progression || "",
    activeHcpAsk || dialogueText,
  ].join(":");
  const generatedCueText = selectCueFromPool({
    cueCategory: cueState.cueCategory,
    concernFamily: cueState.concernFamily,
    seed,
  });
  const shouldReplaceExisting = preferStateDerived || cueContradictsState({
    cueText: existingCueText,
    cueCategory: cueState.cueCategory,
    dialogueText,
    terminal: cueState.terminalCue || terminal,
  });
  const selectedCueText = reviseCueForObservableBehavior({
    cueText: normalizeText(shouldReplaceExisting ? generatedCueText : existingCueText) || generatedCueText,
    cueCategory: cueState.cueCategory,
    concernFamily: cueState.concernFamily,
  });

  return {
    ...cueState,
    cueText: selectedCueText,
    replacedExistingCue: Boolean(shouldReplaceExisting && normalizeText(existingCueText)),
    alignmentWarnings: shouldReplaceExisting ? ["cue_reselected_for_state_alignment"] : [],
  };
}
