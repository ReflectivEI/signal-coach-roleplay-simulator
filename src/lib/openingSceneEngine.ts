/**
 * Opening Scene Engine
 * ====================
 * Deterministic, label-driven opening scene generator.
 *
 * Formula (3 fixed slots, 2 sentences max):
 *   Sentence 1: [Slot 1: HCP observable action] + [Slot 2: HCP interpersonal signal on entry]
 *   Sentence 2: [Slot 3: Environmental / office cue that adds pressure, warmth, or uncertainty]
 *
 * Anti-drift guarantees:
 *   - Structure is FIXED (3 slots, always 2 sentences)
 *   - Each label maps to a controlled cue bank — labels never appear verbatim in output
 *   - All cues are physically observable by the rep (no internal states, no label language)
 *   - Deterministic: same inputs → same output, no randomness
 *
 * Four canonical reference scenes (taken directly from the SOT):
 *   1. Clinical value / evidence-driven / skeptical-resistant ("The Data That Doesn't Land"):
 *      "The HCP has the latest clinical trial open on their desk, eyes moving between the data
 *       and a marked-up printout. As you enter, they give a brief nod and raise an eyebrow just
 *       as a nurse steps in to signal the next patient is waiting, prompting a quick glance at the clock."
 *
 *   2. Initial access / closed / time-constrained ("The Gatekeeper Filter"):
 *      "The physician is seated at their desk, flipping through the day's patient schedule as you walk in.
 *       They give a polite but brief nod, then refocus as a nurse hands over a chart and quietly signals
 *       that the next room is ready."
 *
 *   3. Discovery / open / patient-centric / curious-uncertain ("The Undefined Patient Profile"):
 *      "The HCP is reviewing a patient chart, pausing over a handwritten note as you enter.
 *       They look up with a welcoming smile and motion you in, then glance back toward the doorway
 *       as a medical assistant calls the next patient."
 *
 *   4. Reserved but engaged (generic):
 *      "The HCP stands near the window with a file in hand, turning back toward the room as you arrive.
 *       They study you for a beat, then nod once as movement in the hallway pulls their attention briefly
 *       toward the clock."
 */

// ─── SLOT 1: HCP OBSERVABLE ACTION ────────────────────────────────────────────
// Influenced by: journey stage (shapes what object is in focus) + decision orientation (shapes what's on desk)
// Template fragment: "The HCP [action phrase with focal object]"

const SLOT1_ACTION_BANK: Record<string, string[]> = {
  initial_access: [
    "is seated at their desk, flipping through the day's patient schedule as you walk in",
    "stands near the front of the room, reviewing the appointment list on their screen",
    "leans against the counter, scrolling through the day's schedule on the EMR",
    "is at their desk, pen in hand, working through a stack of patient intake forms",
  ],
  early_discovery: [
    "is reviewing a patient chart, pausing over a handwritten note as you enter",
    "sits at their desk with several patient intake summaries spread out in front of them",
    "is at their workstation, cross-referencing open chart tabs with handwritten notes",
    "has a patient care-plan sheet on the desk, leaning forward to read a particular line",
  ],
  clinical_value: [
    "has the latest clinical trial open on their desk, eyes moving between the data and a marked-up printout",
    "sits with a journal article in front of them, pen resting on a highlighted passage",
    "is at their workstation with a printed study abstract and annotations visible beside the keyboard",
    "has a data slide visible on their screen alongside a pen-marked efficacy chart",
  ],
  objection_handling: [
    "stands near their desk, a prior authorization stack visible to the side, turning as you enter",
    "is seated but leaning back in their chair, expression measured, arms loosely folded",
    "sits with a coverage worksheet partially visible beside their keyboard, looking up as you arrive",
    "is at their desk, reviewing what appears to be a payer letter, and sets it aside as you enter",
  ],
  adoption_implementation: [
    "is at their desk reviewing prescribing notes, a patient selection checklist nearby",
    "stands near the window with a treatment checklist in hand, turning back toward the room as you arrive",
    "sits with a follow-up care plan visible on their screen, fingers paused over the keyboard",
    "is reviewing a patient monitoring summary, a pen tapping lightly on the desk",
  ],
  access_formulary: [
    "is at their desk with a formulary reference sheet visible alongside their notes",
    "sits reviewing what appears to be a P&T committee brief, glancing up as you enter",
    "stands near the printer, collecting what looks like a coverage summary",
    "has a formulary tier printout open beside their keyboard as you walk in",
  ],
  commitment_close: [
    "is at their desk reviewing notes from a prior visit, pen tapping lightly",
    "sits with a patient list open, glancing between it and their screen as you arrive",
    "stands near the window, file folder in hand, turning to greet you",
    "is at their desk, a follow-up action list partially visible beside their keyboard",
  ],
};

// Decision orientation adjusts the focal object in Slot 1 when not already implied
const DECISION_OBJECT_DETAIL: Record<string, string> = {
  evidence_driven: "with a clinical trial open on the desk",
  patient_centric: "with a patient chart visible nearby",
  guideline_anchored: "with what appears to be a society guideline printout on the desk",
  risk_averse: "with a patient summary and follow-up notes open beside the keyboard",
};

// ─── SLOT 2: HCP INTERPERSONAL SIGNAL ─────────────────────────────────────────
// Influenced by: starting behavior state (shapes warmth / guardedness on entry)
// Template fragment: "they [signal phrase]"

const SLOT2_SIGNAL_BANK: Record<string, string[]> = {
  open: [
    "look up with a welcoming smile and motion you in",
    "offer a warm nod and gesture toward the chair across from them",
    "glance up and give a relaxed, open wave in your direction",
  ],
  openness: [
    "look up with a welcoming smile and motion you in",
    "offer a warm nod and gesture toward the chair across from them",
  ],
  neutral: [
    "give a brief, professional nod as you enter",
    "glance up from their work, expression measured, and nod once",
    "look up with a steady, neutral expression and wait for you to settle",
  ],
  closed: [
    "give a polite but brief nod, then refocus on the desk",
    "look up with a measured pause and offer minimal acknowledgment",
    "raise an eyebrow slightly, posture remaining guarded as you step in",
  ],
  resistance: [
    "look up with a studied expression, arms loosely crossed",
    "raise an eyebrow and hold eye contact for a beat before acknowledging you",
    "pause mid-motion and watch you enter without stepping forward",
  ],
  frustration: [
    "glance up sharply, expression tight, posture closed",
    "look up briefly with a set jaw and remain still as you enter",
  ],
  curiosity: [
    "lean slightly forward as you enter, expression open and evaluative",
    "look up with a direct, interested gaze and set their pen down",
  ],
  time_pressure: [
    "give a brief, efficient nod and check the clock in a single fluid motion",
    "briefly stand and sit again, expression signaling limited availability",
  ],
};

// ─── SLOT 3: ENVIRONMENTAL / OFFICE CUE ───────────────────────────────────────
// Influenced by: interaction pressure (shapes interruption, pace, or ambient detail)
// Template fragment: "just as [cue phrase]" OR "as [cue phrase]"
// Uses specific staff titles (Nurse, MA, receptionist) — never "staff member"

const SLOT3_ENV_BANK: Record<string, string[]> = {
  time_constrained: [
    "a nurse steps in to signal the next patient is waiting, prompting a quick glance at the clock",
    "a nurse hands over a chart and quietly signals that the next room is ready",
    "an MA knocks and calls a patient's name from the doorway, and the HCP checks the time",
    "a medical assistant leans in to confirm the next room is set",
  ],
  operationally_constrained: [
    "a receptionist knocks lightly and hands over a patient file",
    "an MA steps out briefly, calling a patient's name down the hall",
    "a nurse passes the open doorway, wheeling a chart rack",
    "a receptionist pauses at the door with a clipboard and the HCP gives a quick nod",
  ],
  skeptical_resistant: [
    "their gaze drifts once toward the open trial data before settling on you",
    "they glance briefly at the annotated printout before giving you their full attention",
    "movement in the hallway draws a brief glance before they refocus directly on you",
  ],
  access_barrier: [
    "a prior auth stack is visible on the corner of the desk",
    "a formulary reminder is pinned above the monitor in clear view",
    "a coverage worksheet sits partially visible beside the keyboard",
  ],
  safety_concern: [
    "a conference program from a recent medical meeting is open on the desk beside them",
    "a printed abstract with highlighted passages is visible near the keyboard",
  ],
  competitive_bias: [
    "a competitor's clinical summary is partially visible under their notes",
    "a branded item from another product sits in the pen holder on the desk",
  ],
  curious_uncertain: [
    "a medical assistant calls the next patient from down the hall and the HCP glances toward the doorway",
    "they glance back toward a patient note before settling their full attention on you",
  ],
  default: [
    "movement in the hallway briefly pulls their attention toward the clock",
    "a passing nurse outside the open door momentarily draws their gaze",
    "the sound of the waiting room carries through the half-open door as they refocus",
  ],
};

// ─── DETERMINISTIC SEED PICKER ────────────────────────────────────────────────

function pick<T>(arr: T[], seed: string): T {
  // Deterministic pick — same seed always returns same index
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }
  return arr[Math.abs(hash) % arr.length];
}

// ─── SCENE INPUTS / OUTPUT ────────────────────────────────────────────────────

export interface SceneInputs {
  title: string;
  journeyStage: string;
  startingBehaviorState: string;
  decisionOrientation?: string;
  interactionPressure?: string[];
}

/**
 * generateOpeningScene
 *
 * Assembles a 2-sentence observational opening scene from the fixed 3-slot formula.
 *
 * Sentence 1: The HCP is [Slot 1 action]. As you enter, they [Slot 2 signal],
 * Sentence 2: just as / as [Slot 3 environmental cue].
 *
 * Rules enforced:
 * - 2 sentences max
 * - No scenario labels verbatim in output
 * - All content is physically observable by the rep
 * - Deterministic: same inputs → same output
 */
export function generateOpeningScene(inputs: SceneInputs): string {
  const {
    title,
    journeyStage,
    startingBehaviorState,
    decisionOrientation,
    interactionPressure = [],
  } = inputs;

  // ── Slot 1: HCP observable action ──
  const actionBank = SLOT1_ACTION_BANK[journeyStage] || SLOT1_ACTION_BANK["initial_access"];
  let slot1 = pick(actionBank, title + "s1");

  // Overlay decision orientation object if the slot doesn't already reference data/charts
  if (decisionOrientation && DECISION_OBJECT_DETAIL[decisionOrientation]) {
    const hasRef =
      slot1.includes("trial") ||
      slot1.includes("chart") ||
      slot1.includes("guideline") ||
      slot1.includes("abstract") ||
      slot1.includes("printout") ||
      slot1.includes("data");
    if (!hasRef) {
      slot1 = `${slot1}, ${DECISION_OBJECT_DETAIL[decisionOrientation]}`;
    }
  }

  // ── Slot 2: HCP interpersonal signal ──
  const sigBank =
    SLOT2_SIGNAL_BANK[startingBehaviorState] || SLOT2_SIGNAL_BANK["neutral"];
  const slot2 = pick(sigBank, title + "s2");

  // ── Slot 3: Environmental / office cue ──
  let slot3: string | null = null;
  for (const p of interactionPressure) {
    const bank = SLOT3_ENV_BANK[p];
    if (bank) {
      slot3 = pick(bank, title + p + "s3");
      break;
    }
  }
  if (!slot3) slot3 = pick(SLOT3_ENV_BANK["default"], title + "s3");

  // ── Assembly ──
  // Sentence 1: action + entry signal
  // Sentence 2: environmental cue
  return `The HCP ${slot1}. As you enter, they ${slot2}, just as ${slot3}.`;
}

/**
 * buildHcpProfile
 * Returns: "[Role / Stakeholder Title] — [clinical background detail]"
 * The stakeholder is the role label; context is the background sentence.
 */
export function buildHcpProfile(stakeholder: string, context: string): string {
  if (!context) return stakeholder;
  // If context already starts with the stakeholder name, don't double-prefix
  if (context.startsWith(stakeholder)) return context;
  return `${stakeholder} — ${context}`;
}