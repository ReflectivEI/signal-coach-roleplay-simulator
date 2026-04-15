/**
 * HCP Cue Generator
 * =================
 * Generates context-aware, single-line observable HCP cues for dialogue.
 * Uses the same 3-part realism formula as opening scenes: HCP action + signal + environmental context.
 * Output: 1-line, observable, aligned with the HCP's spoken dialogue.
 *
 * Anti-drift structure:
 * - Fixed formula: [observable action/signal] + [contextual environmental anchor]
 * - Deterministic: same dialogue + behavior state → same cue structure
 * - No label language in output (no "time-constrained", "skeptical", etc.)
 * - All cues are physically visible to the rep
 */

// ─── CUE BANK BY BEHAVIOR STATE ────────────────────────────────────────────────
// Each behavior state maps to observable physical/facial signals
// Cues include optional environmental detail for realism grounding

const CUE_ACTION_BANK: Record<string, string[]> = {
  open: [
    "leans slightly forward, eyes engaged",
    "nods encouragingly and maintains direct eye contact",
    "relaxes posture, gestures toward the chair across from them",
    "settles back in their chair, genuinely listening",
  ],
  openness: [
    "leans slightly forward, eyes engaged",
    "nods encouragingly and maintains direct eye contact",
  ],
  neutral: [
    "nods thoughtfully, pen pausing mid-note",
    "glances up with steady, measured expression",
    "maintains composed posture, listening intently",
    "gives a single, brief nod of acknowledgment",
  ],
  closed: [
    "leans back slightly, arms loosely crossed",
    "glances down briefly before looking back up",
    "pauses, studying your response carefully",
    "shifts weight, expression reserved",
  ],
  resistance: [
    "raises an eyebrow, expression skeptical",
    "crosses arms, jaw tightens slightly",
    "pauses, then continues with measured tone",
    "holds steady eye contact, expression unmoved",
  ],
  frustration: [
    "jaw tightens, glances toward the clock",
    "shifts sharply in chair, expression compressed",
    "sets pen down with subtle firmness",
    "exhales, refocusing on the conversation",
  ],
  curiosity: [
    "leans forward, pen hovering over notepad",
    "eyes widen slightly, interest evident",
    "sets pen down, giving full attention",
    "nods slowly, processing your words",
  ],
  time_pressure: [
    "glances at the clock, then back to you",
    "adjusts in seat, checking the time again",
    "nods quickly, ready to move forward",
    "stands briefly, checking the doorway",
  ],
};

// ─── ENVIRONMENTAL CONTEXT ANCHORS ─────────────────────────────────────────────
// Brief office/staff cues that add realism without being intrusive
// Tied to interaction pressures where relevant

const CONTEXT_ANCHOR_BANK: Record<string, string[]> = {
  time_constrained: [
    "glancing at the clock briefly",
    "keeping one eye toward the door",
    "checking the schedule on their screen",
    "pausing as a nurse passes in the hallway",
  ],
  operationally_constrained: [
    "a chart stack visible at the edge of the desk",
    "glancing toward a knock on the door",
    "adjusting their position as someone passes nearby",
    "refocusing after a brief interruption",
  ],
  skeptical_resistant: [
    "eyes drifting briefly to the open trial data",
    "glancing at the annotated printout before responding",
    "maintaining measured eye contact",
    "tapping pen thoughtfully on the desk",
  ],
  access_barrier: [
    "prior auth stack partially visible nearby",
    "formulary reminder visible above the monitor",
    "coverage worksheet on the desk surface",
  ],
  safety_concern: [
    "referencing a recent conference abstract nearby",
    "glancing at highlighted passages before speaking",
    "hand near a medical journal on the desk",
  ],
  curious_uncertain: [
    "pausing to consider your point",
    "glancing toward a patient note momentarily",
    "leaning in slightly as if reconsidering",
  ],
  default: [
    "maintaining steady attention",
    "focused on the conversation",
    "fully present in the moment",
  ],
};

// ─── DETERMINISTIC SEED PICKER ────────────────────────────────────────────────

function pick<T>(arr: T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }
  return arr[Math.abs(hash) % arr.length];
}

// ─── CUE GENERATION ───────────────────────────────────────────────────────────

export interface HcpCueInputs {
  hcpReply: string; // The HCP's dialogue to align with
  behaviorState: string; // Current HCP behavior state
  interactionPressures?: string[]; // Pressure context (for environmental anchoring)
  scenario?: { title?: string; journeyStage?: string }; // For deterministic seeding
}

const BANNED_CUE_TERMS = [
  "skeptical",
  "resistant",
  "time-constrained",
  "time constrained",
  "behavior state",
  "journey stage",
  "interaction pressure",
  "burden",
];

const PRESSURE_DESCRIPTION_BANK: Record<string, string> = {
  time_constrained: "Their attention is split by the clock, so the next move has to stay tight and relevant.",
  operationally_constrained: "Workflow noise is competing with the conversation, so vague framing will lose momentum fast.",
  skeptical_resistant: "They are evaluating credibility in real time, so unsupported claims will harden the tone.",
  access_barrier: "Operational friction is already top of mind, so the next question should separate workflow from clinical value.",
  safety_concern: "Risk is sitting close to the surface, so the next response has to acknowledge it before moving forward.",
  curious_uncertain: "There is room to deepen the conversation here, but only if the rep keeps it specific and grounded.",
  default: "The HCP is signaling how they are receiving the conversation, so the next response should match that energy.",
};

const BEHAVIOR_DESCRIPTION_BANK: Record<string, string> = {
  open: "The HCP is visibly receptive, so a specific question can deepen the exchange without forcing it.",
  openness: "The HCP is visibly receptive, so a specific question can deepen the exchange without forcing it.",
  neutral: "The HCP is still deciding how much to give you, so relevance has to be earned in the next turn.",
  closed: "The HCP is holding distance, so the next move needs to show understanding before trying to advance.",
  resistance: "The HCP is signaling pushback, so the next response should explore the concern instead of arguing with it.",
  frustration: "The HCP is showing strain, so the next move should lower friction rather than add more explanation.",
  curiosity: "The HCP is leaning in, so a focused follow-up can build useful momentum.",
  time_pressure: "The HCP is visibly managing time, so the next response should be concise and purposeful.",
};

function cleanCueText(text: string): string {
  return String(text || "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^◆\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isValidObservedCue(text: string): boolean {
  const cue = cleanCueText(text).toLowerCase();
  if (!cue || cue.length < 8) return false;
  if (cue.split(" ").length > 12) return false;
  if (BANNED_CUE_TERMS.some((term) => cue.includes(term))) return false;
  return true;
}

export function buildCueDescription(
  behaviorState: string,
  interactionPressures: string[] = [],
  cueLabel = ""
): string {
  const normalizedCue = cueLabel.toLowerCase();
  const behaviorDescription = BEHAVIOR_DESCRIPTION_BANK[behaviorState];
  const pressureDescription = interactionPressures
    .map((pressure) => PRESSURE_DESCRIPTION_BANK[pressure])
    .find(Boolean);

  if (/(cross|narrow|tighten|unmoved|glance at watch|clock|jaw|reserved|skeptical)/i.test(normalizedCue)) {
    return pressureDescription || BEHAVIOR_DESCRIPTION_BANK.resistance || PRESSURE_DESCRIPTION_BANK.default;
  }

  if (/(leans forward|pen hovering|full attention|welcoming|motion you in|encouragingly)/i.test(normalizedCue)) {
    return BEHAVIOR_DESCRIPTION_BANK.curiosity || behaviorDescription || PRESSURE_DESCRIPTION_BANK.default;
  }

  if (["open", "openness", "curiosity"].includes(behaviorState)) {
    return behaviorDescription || pressureDescription || PRESSURE_DESCRIPTION_BANK.default;
  }

  if (["closed", "resistance", "frustration", "time_pressure"].includes(behaviorState)) {
    return pressureDescription || behaviorDescription || PRESSURE_DESCRIPTION_BANK.default;
  }

  if (behaviorDescription && pressureDescription) {
    return `${behaviorDescription} ${pressureDescription}`;
  }

  return behaviorDescription || pressureDescription || PRESSURE_DESCRIPTION_BANK.default;
}

/**
 * generateHcpCue
 *
 * Creates a single-line observable cue aligned with the HCP's dialogue.
 * Formula: [Observable action/signal] + [optional contextual anchor]
 *
 * Rules:
 * - 1 sentence only
 * - Observable by the rep
 * - No label language (no "closed", "frustrated", etc.)
 * - Deterministic: same inputs → same cue
 * - Contextual to the dialogue and behavior state
 */
export function generateHcpCue(inputs: HcpCueInputs): string {
  const {
    hcpReply,
    behaviorState,
    interactionPressures = [],
    scenario = {},
  } = inputs;

  // ── Select action/signal from behavior state bank ──
  const actionBank = CUE_ACTION_BANK[behaviorState] || CUE_ACTION_BANK["neutral"];
  const seed = scenario?.title || hcpReply;
  const action = pick(actionBank, seed + "_action");

  // ── Select contextual anchor if pressures exist ──
  let anchor = "";
  for (const p of interactionPressures) {
    const anchorBank = CONTEXT_ANCHOR_BANK[p];
    if (anchorBank) {
      anchor = pick(anchorBank, seed + "_" + p);
      break;
    }
  }
  if (!anchor) {
    anchor = pick(CONTEXT_ANCHOR_BANK["default"], seed + "_default");
  }

  // ── Assembly: [action], [anchor] ──
  if (anchor.toLowerCase().includes("visible") || anchor.toLowerCase().includes("stack")) {
    // Anchor is a visual detail — use comma
    return `${action}, ${anchor}.`;
  } else {
    // Anchor is an action — use "as"
    return `${action}, ${anchor && anchor.length > 0 ? "as they are " + anchor : "maintaining focus"}.`;
  }
}

export function resolveObservedCue(
  candidateCue: string,
  inputs: HcpCueInputs
): { label: string; description: string; source: "hcp_context" } {
  const fallback = generateHcpCue(inputs);
  const label = isValidObservedCue(candidateCue) ? cleanCueText(candidateCue) : fallback;

  return {
    label,
    description: buildCueDescription(inputs.behaviorState, inputs.interactionPressures, label),
    source: "hcp_context",
  };
}
