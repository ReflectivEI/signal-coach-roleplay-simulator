export const HCP_CUE_ALIGNMENT_VERSION = "hcp_cue_state_alignment_v1";

const TERMINAL_DIALOGUE_PATTERN = /\b(pause here|should pause|probably done|not ready to keep going|not useful|get back to clinic|stop here|wrap|ending|move on|front desk|follow-up slot|cannot continue|we are done|cannot make this specific)\b/i;
const TERMINAL_CUE_PATTERN = /\b(door|leav|ending|exchange is over|wrap|front desk|turns back toward|patient room|gathers the chart)\b/i;
const SOFT_CUE_PATTERN = /\b(open|receptive|warm|relaxed|inviting|thoughtful|leans in|steady eye contact)\b/i;
const HIGH_PRESSURE_PATTERN = /\b(time|minutes|clock|schedule|busy|short-staffed|bandwidth|next patient|clinic flow|protect clinic)\b/i;
const INTERNAL_NARRATION_PATTERN = /\b(returns? to the (?:evidence|workflow|access|screening) ask|keeps the time pressure visible|decision-relevant point|usable step|proof point|current ask|directly useful point)\b/i;

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
    .replace(/\bkeeps (?:their|his|her) eyes on you for a beat,?\s*expression tightening around the ask\b/gi, "keeps steady eye contact, waiting for a more specific answer")
    .replace(/\bkeeps (?:their|his|her) eyes on you for a beat\b/gi, "keeps steady eye contact")
    .replace(/\bexpression tightening around the ask\b/gi, "expression focused on the question")
    .replace(/\bkeeps the ([a-z -]+) under one hand,?\s*expression tightening around the ([a-z -]+)\b/gi, "keeps the $1 nearby, focused on the $2")
    .replace(/\bunder one hand\b/gi, "nearby")
    .replace(/\bexpression tightening around the ([a-z -]+)\b/gi, "focused on the $1")
    .replace(/\bgoes still for a beat,?\s*leaving little room for a detour\b/gi, "pauses briefly, waiting for the answer to stay specific");

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
      "The HCP stays with the evidence thread, listening for the decision-relevant point.",
      "The HCP keeps attention on the data question, waiting for the proof point to be made practical.",
    ]),
    workflow: Object.freeze([
      "The HCP stays focused on the workflow issue, listening for one practical next step.",
      "The HCP keeps the clinic-flow concern in view, waiting for an implementable answer.",
    ]),
    access: Object.freeze([
      "The HCP keeps attention on the access barrier, listening for a practical path forward.",
      "The HCP stays with the coverage concern, waiting for a workable next step.",
    ]),
    screening: Object.freeze([
      "The HCP keeps attention on patient selection, listening for a clear screening boundary.",
      "The HCP stays with the candidacy question, waiting for a criterion they can apply.",
    ]),
    time: Object.freeze([
      "The HCP stays attentive but time-aware, listening for the shortest useful answer.",
      "The HCP keeps the schedule in view while leaving room for one focused point.",
    ]),
    general: Object.freeze([
      "The HCP stays attentive, waiting for the response to connect to the current ask.",
      "The HCP keeps a professional, focused posture while listening for the next relevant point.",
    ]),
  }),
  focused_narrowing: Object.freeze({
    evidence: Object.freeze([
      "The HCP narrows attention to the evidence ask, signaling the next answer needs to change the decision.",
      "The HCP holds on the data question, making clear that the next point needs decision relevance.",
    ]),
    workflow: Object.freeze([
      "The HCP narrows attention to the workflow ask, signaling the next answer needs to be operational.",
      "The HCP keeps the exchange focused on clinic flow, waiting for the first practical step.",
    ]),
    access: Object.freeze([
      "The HCP narrows attention to the access barrier, waiting for a concrete way through it.",
      "The HCP keeps the focus on coverage friction, signaling that the next answer needs to be actionable.",
    ]),
    screening: Object.freeze([
      "The HCP narrows attention to the screening question, waiting for a usable selection rule.",
      "The HCP keeps the focus on candidacy, signaling that the next answer needs a clear boundary.",
    ]),
    time: Object.freeze([
      "The HCP keeps the exchange tight, signaling there is only room for one directly relevant point.",
      "The HCP checks the time briefly, then narrows the opening for a concise answer.",
    ]),
    general: Object.freeze([
      "The HCP narrows attention to the current ask, waiting for a direct answer.",
      "The HCP keeps the exchange focused, signaling that the next point needs immediate relevance.",
    ]),
  }),
  non_adaptive_impatience: Object.freeze({
    evidence: Object.freeze([
      "The HCP's attention tightens around the evidence question, signaling that repeated setup language is not moving the discussion.",
      "The HCP keeps the data ask in place, less patient with another response that does not adapt.",
    ]),
    workflow: Object.freeze([
      "The HCP's attention tightens around the workflow question, signaling that repeated setup language is not helping.",
      "The HCP keeps the practical ask in place, less patient with another response that does not adapt.",
    ]),
    access: Object.freeze([
      "The HCP's attention tightens around the access barrier, signaling that repeated setup language is not enough.",
      "The HCP keeps the coverage ask in place, less patient with another response that does not adapt.",
    ]),
    screening: Object.freeze([
      "The HCP's attention tightens around the screening question, signaling that repeated setup language is not enough.",
      "The HCP keeps the candidacy ask in place, less patient with another response that does not adapt.",
    ]),
    time: Object.freeze([
      "The HCP's patience narrows as the same setup repeats without addressing the time-bound ask.",
      "The HCP keeps the opening brief, signaling that repeated setup language needs to change now.",
    ]),
    general: Object.freeze([
      "The HCP's attention narrows, signaling that repeating the same message is not moving the conversation.",
      "The HCP keeps the current ask in place, less patient with another response that does not adapt.",
    ]),
  }),
  time_constrained: Object.freeze({
    evidence: Object.freeze([
      "The HCP checks the schedule briefly, then returns to the evidence ask for one decision-relevant point.",
      "The HCP keeps the time pressure visible while waiting for the proof point.",
    ]),
    workflow: Object.freeze([
      "The HCP checks the clinic flow briefly, then returns to the workflow ask for one usable step.",
      "The HCP keeps the schedule in view while waiting for the first practical step.",
    ]),
    access: Object.freeze([
      "The HCP checks the next appointment briefly, then returns to the access ask for one workable step.",
      "The HCP keeps time pressure visible while waiting for an access answer that can be used.",
    ]),
    screening: Object.freeze([
      "The HCP checks the schedule briefly, then returns to the screening ask for one clear criterion.",
      "The HCP keeps time pressure visible while waiting for a usable selection rule.",
    ]),
    time: Object.freeze([
      "The HCP checks the schedule and waits for the shortest useful answer.",
      "The HCP keeps one eye on the next patient slot while leaving room for one concise point.",
    ]),
    general: Object.freeze([
      "The HCP checks the time briefly, then returns attention to the current ask.",
      "The HCP keeps the schedule in view while waiting for one directly useful point.",
    ]),
  }),
  hard_escalation: Object.freeze({
    evidence: Object.freeze([
      "The HCP holds the evidence ask with clipped attention, signaling that only a direct answer will keep the exchange going.",
      "The HCP stays on the proof-point question, visibly less willing to follow another detour.",
    ]),
    workflow: Object.freeze([
      "The HCP holds the workflow ask with clipped attention, signaling that only a practical step will keep the exchange going.",
      "The HCP stays on the clinic-flow question, visibly less willing to follow another detour.",
    ]),
    access: Object.freeze([
      "The HCP holds the access ask with clipped attention, signaling that only a practical answer will keep the exchange going.",
      "The HCP stays on the coverage barrier, visibly less willing to follow another detour.",
    ]),
    screening: Object.freeze([
      "The HCP holds the screening ask with clipped attention, signaling that only a clear selection rule will keep the exchange going.",
      "The HCP stays on the candidacy question, visibly less willing to follow another detour.",
    ]),
    time: Object.freeze([
      "The HCP keeps the exchange clipped and time-bound, signaling that the next point has to be directly useful.",
      "The HCP stays brief and firm, leaving room for only one relevant answer.",
    ]),
    general: Object.freeze([
      "The HCP holds the current ask with clipped attention, signaling that only a direct answer will keep the exchange going.",
      "The HCP stays on the current question, visibly less willing to follow another detour.",
    ]),
  }),
  terminal_exit: Object.freeze({
    evidence: Object.freeze([
      "The HCP gathers the chart and turns back toward the next task, signaling the evidence exchange is ending.",
      "The HCP steps toward the door, making clear there is no more room for the evidence discussion.",
    ]),
    workflow: Object.freeze([
      "The HCP gathers the workflow notes and turns back toward the clinic flow, signaling the exchange is ending.",
      "The HCP steps toward the door, making clear there is no more room for the workflow discussion.",
    ]),
    access: Object.freeze([
      "The HCP gathers the coverage notes and turns back toward the next task, signaling the exchange is ending.",
      "The HCP steps toward the door, making clear there is no more room for the access discussion.",
    ]),
    screening: Object.freeze([
      "The HCP gathers the screening notes and turns back toward the next task, signaling the exchange is ending.",
      "The HCP steps toward the door, making clear there is no more room for the screening discussion.",
    ]),
    time: Object.freeze([
      "The HCP turns back toward the next patient slot, signaling that the exchange is ending.",
      "The HCP steps toward the door, making clear the time for this exchange is over.",
    ]),
    general: Object.freeze([
      "The HCP gathers the chart and turns back toward the next task, signaling the exchange is ending.",
      "The HCP steps toward the door, making clear there is no more room for the discussion.",
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
      neutral_attentive: "The HCP keeps the chart open and watches for the data to land in the decision.",
      focused_narrowing: "The HCP taps the data page once, keeping the conversation narrowed to the decision in front of them.",
      non_adaptive_impatience: "The HCP keeps a finger on the data page, visibly less patient with another setup pass.",
      time_constrained: "The HCP checks the schedule, then rests a hand on the chart while leaving room for one concise point.",
      hard_escalation: "The HCP holds the chart still and waits, expression clipped, no longer following another detour.",
      terminal_exit: "The HCP gathers the chart and turns back toward the next task.",
    },
    workflow: {
      neutral_attentive: "The HCP keeps the clinic list nearby, watching for how the work would actually land on staff.",
      focused_narrowing: "The HCP glances at the clinic list, then waits for a practical staff-level answer.",
      non_adaptive_impatience: "The HCP keeps a hand on the clinic list, visibly less patient with another setup pass.",
      time_constrained: "The HCP checks the schedule, then rests a hand on the callback list.",
      hard_escalation: "The HCP holds the clinic list still, expression clipped, no longer following another detour.",
      terminal_exit: "The HCP gathers the workflow notes and turns back toward the clinic flow.",
    },
    access: {
      neutral_attentive: "The HCP keeps the coverage notes in view, watching for where the paperwork would actually move.",
      focused_narrowing: "The HCP glances at the coverage notes, then waits for a workable administrative step.",
      non_adaptive_impatience: "The HCP keeps the coverage notes in hand, visibly less patient with another setup pass.",
      time_constrained: "The HCP checks the next appointment, then keeps the coverage notes in hand.",
      hard_escalation: "The HCP holds the coverage notes still, expression clipped, no longer following another detour.",
      terminal_exit: "The HCP gathers the coverage notes and turns back toward the next task.",
    },
    screening: {
      neutral_attentive: "The HCP keeps the patient list nearby, watching for a boundary they could apply in clinic.",
      focused_narrowing: "The HCP glances at the patient list, then waits for a usable selection boundary.",
      non_adaptive_impatience: "The HCP keeps a hand on the patient list, visibly less patient with another setup pass.",
      time_constrained: "The HCP checks the schedule, then taps the patient list once.",
      hard_escalation: "The HCP holds the patient list still, expression clipped, no longer following another detour.",
      terminal_exit: "The HCP gathers the patient list and turns back toward the next task.",
    },
    general: {
      neutral_attentive: "The HCP keeps a professional posture, watching for the answer to connect to the conversation.",
      focused_narrowing: "The HCP narrows their gaze and waits, leaving little room for a detour.",
      non_adaptive_impatience: "The HCP keeps their posture tight, visibly less patient with another setup pass.",
      time_constrained: "The HCP checks the schedule, then looks back with a tighter expression.",
      hard_escalation: "The HCP holds still, expression clipped, no longer following another detour.",
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
