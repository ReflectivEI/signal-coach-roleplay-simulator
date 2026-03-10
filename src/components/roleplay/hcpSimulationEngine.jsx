// Scenario selection utility
export function getScenarioContext(props = {}) {
  const scenarioIndex = typeof props.scenarioIndex === 'number' ? props.scenarioIndex : 0;
  return scenarios[scenarioIndex] || scenarios[0];
}
// Dynamic HCP dialogue and cue recalibration
import { scenarios } from './hcpDialogueEngine.jsx';
// Engagement scoring and state update
/**
 * Robust engagement scoring and state update for enterprise reliability.
 * - Scores rep input for clinical value, relevance, clarity, and professionalism.
 * - Decays engagement for repeated low-value turns.
 * - Maps scores to engagement levels, emotional valence, stance, and momentum.
 * - Handles time pressure and reaction triggers.
 */
export function updateTurnState(prevState, repMessage, prevEngagementScore, conversationHistory) {
  let scoreDelta = 0;
  const msg = repMessage ? repMessage.toLowerCase() : '';
  // Score for clinical value and professionalism
  if (/\bstrong clinical question\b|patient-relevant insight|credible information|clear value/.test(msg)) scoreDelta += 2;
  else if (/\brelevant question\b|concise useful point|acknowledge|value/.test(msg)) scoreDelta += 1;
  else if (/\bvague opener\b|repeats|weak|low-value/.test(msg)) scoreDelta -= 1;
  else if (/\bpromotional\b|unconvincing|wastes time|ignores/.test(msg)) scoreDelta -= 2;
  // Clamp score between 0 and 5
  let engagementScore = Math.max(0, Math.min(5, prevEngagementScore + scoreDelta));
  // Decay for consecutive low-value turns
  const lowValueTurns = conversationHistory.slice(-3).filter(t => t.repMessage && /vague|weak|low-value|promotional/.test(t.repMessage.toLowerCase())).length;
  if (lowValueTurns >= 2) engagementScore = Math.max(0, engagementScore - 1);
  // Map score to engagement level
  let engagementLevel = 'low';
  if (engagementScore >= 4) engagementLevel = 'high';
  else if (engagementScore >= 2) engagementLevel = 'medium';
  // Emotional valence
  let emotionalValence = 'neutral_task_focused';
  if (engagementScore >= 4) emotionalValence = 'positive';
  else if (engagementScore <= 1) emotionalValence = 'negative';
  // Stance
  let stance = 'guarded';
  if (engagementScore >= 4) stance = 'receptive';
  else if (engagementScore >= 2) stance = 'focused';
  else if (engagementScore === 0) stance = 'impatient';
  // Reaction trigger
  let reactionTrigger = 'neutral';
  if (/strong clinical question/.test(msg)) reactionTrigger = 'strong clinical question';
  else if (/patient-relevant/.test(msg)) reactionTrigger = 'patient-relevant insight';
  else if (/vague/.test(msg)) reactionTrigger = 'vague claim';
  else if (/promotional/.test(msg)) reactionTrigger = 'promotional wording';
  // Momentum
  let conversationalMomentum = 'flat';
  if (scoreDelta > 0) conversationalMomentum = 'improving';
  else if (scoreDelta < 0) conversationalMomentum = 'declining';
  // Time pressure
  let timePressure = 'moderate';
  if (/\bneed 30 minutes\b|busy|rush|tight/.test(msg)) timePressure = 'high';
  // Return robust turn state
  return {
    engagementScore,
    engagementLevel,
    emotionalValence,
    stance,
    reactionTrigger,
    conversationalMomentum,
    timePressure,
  };
}
/**
 * HCP Simulation Engine — Unified Deterministic Model
 *
 * Single source of truth for:
 *   - Structural state (behavioral posture ladder)
 *   - Emotional temperature (tone gradient)
 *   - Severity level (escalation memory)
 *   - Cue selection (locked, non-repeating, state-consistent)
 *   - Tone directives (for dialogue generation)
 *
 * INVARIANT: One HCPProfile is produced per turn. Once produced it is immutable.
 * The LLM receives the profile as its constraint set and cannot contradict it.
 *
 * NO Math.random(). All selection is deterministic via hash seed.
 */

// ─── STATE LADDER ─────────────────────────────────────────────────────────────
export const HCP_STATES = [
  'neutral',
  'engaged',
  'time-pressured',
  'resistant',
  'boundary-setting',
  'irritated',
  'disengaging',
];

export const STATE_INDEX = Object.fromEntries(HCP_STATES.map((s, i) => [s, i]));

// ─── TEMPERATURE LADDER ────────────────────────────────────────────────────────
// Independent of structural state. Affects word choice, sentence length, politeness.
export const TEMPERATURES = ['positive', 'neutral', 'stressed', 'irritated'];
export const TEMP_INDEX = Object.fromEntries(TEMPERATURES.map((t, i) => [t, i]));

// ─── HASH UTILITY ──────────────────────────────────────────────────────────────
function hashInt(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  }
  return h;
}

// ─── CUE BANK — expanded, severity-varied ─────────────────────────────────────
// Each state has 3 severity tiers (0=mild, 1=moderate, 2=strong), 4 cues each = 12 per state.
const CUE_BANK = {
  'neutral': {
    0: [
      'The HCP glances up from their desk, expression open and unhurried.',
      'The HCP sets down their pen and turns toward you with a neutral expression.',
      'The HCP nods once in acknowledgment, posture relaxed, no visible tension.',
      'The HCP swivels slightly in their chair to face you, arms resting loosely.',
      'The HCP checks their calendar briefly, then returns to the conversation.',
      'The HCP offers a polite smile, hands folded on the desk.',
      'The HCP adjusts their glasses, listening attentively but without strong emotion.',
      'The HCP glances at the window, then refocuses on you.',
    ],
    1: [
      'The HCP pauses their work and meets your gaze briefly, waiting without enthusiasm.',
      'The HCP places their chart on the desk and gives you their measured attention.',
      'The HCP leans back slightly, expression impassive, clearly reserving judgment.',
      'The HCP listens without reacting, giving away nothing through their body language.',
      'The HCP reviews a document, then looks up with a neutral expression.',
      'The HCP crosses their legs, posture relaxed but not engaged.',
      'The HCP offers a brief nod, signaling acknowledgment but not interest.',
      'The HCP checks their phone discreetly, then resumes listening.',
    ],
    2: [
      'The HCP listens with arms folded loosely, expression carefully composed.',
      'The HCP makes limited eye contact, attention divided between you and the room.',
      'The HCP sits upright, posture contained, showing careful professional neutrality.',
      'The HCP gives a short nod — courteous, but uncommitted.',
      'The HCP glances at the clock, then returns to a neutral stance.',
      'The HCP offers a restrained smile, signaling professionalism.',
      'The HCP reviews notes silently, then looks up without expression.',
      'The HCP shifts in their chair, maintaining a composed demeanor.',
    ],
  },
  'engaged': {
    0: [
      'The HCP leans slightly forward, making sustained eye contact, nodding as you speak.',
      'The HCP sets aside their chart entirely and turns fully toward you, expression attentive.',
      'The HCP\'s posture opens — shoulders back, direct eye contact, a faint smile.',
      'The HCP asks a brief clarifying question, leaning in as they wait for your answer.',
      'The HCP smiles warmly, inviting further discussion.',
      'The HCP gestures with their hands, emphasizing points of interest.',
      'The HCP leans in, showing genuine curiosity.',
      'The HCP mirrors your body language, signaling rapport.',
    ],
    1: [
      'The HCP\'s pen stops mid-note. They look up with clear interest and wait for you to continue.',
      'The HCP tilts their head slightly, expression curious, giving you their full attention.',
      'The HCP uncrosses their arms and leans forward, clearly drawn into the conversation.',
      'The HCP makes deliberate eye contact and mirrors your pace, signaling active listening.',
      'The HCP nods enthusiastically, encouraging you to elaborate.',
      'The HCP offers a supportive smile, showing engagement.',
      'The HCP asks a follow-up question, deepening the conversation.',
      'The HCP leans forward, hands clasped, ready to listen.',
    ],
    2: [
      'The HCP closes their laptop and pivots fully to face you — a signal of genuine engagement.',
      'The HCP nods in rhythm with your points, expression concentrated and open.',
      'The HCP rests their elbows on the desk and bridges their fingers, fully present.',
      'The HCP\'s eyes stay on yours throughout — no distraction, no glances away.',
      'The HCP offers a broad smile, clearly invested in the conversation.',
      'The HCP gestures animatedly, showing excitement.',
      'The HCP maintains eye contact, signaling deep interest.',
      'The HCP leans in, eager to hear more.',
    ],
  },
  'time-pressured': {
    0: [
      'The HCP glances briefly at their watch while listening. A colleague waves from the hallway.',
      'The HCP shifts their weight toward the door, still listening but visibly pulled elsewhere.',
      'The HCP\'s pager vibrates on the desk. They silence it quickly and look back at you.',
      'The HCP checks the wall clock once, expression politely tense, waiting room audible behind them.',
      'The HCP glances at their phone, checking for urgent messages.',
      'The HCP reviews their schedule, noting time constraints.',
      'The HCP offers a quick nod, signaling limited availability.',
      'The HCP gestures toward the door, indicating a need to move soon.',
    ],
    1: [
      'The HCP is already moving toward a patient room. They stop — but only barely.',
      'The HCP checks their phone with a tight expression, then looks up. The floor is full.',
      'The HCP holds a patient file in hand, posture angled toward their next stop.',
      'The HCP\'s eyes move to the door twice. A nurse pauses outside and nods toward the corridor.',
      'The HCP glances at their watch, signaling urgency.',
      'The HCP offers a brief, apologetic smile, then resumes their task.',
      'The HCP gestures to a colleague, indicating a need to hurry.',
      'The HCP reviews patient notes quickly, preparing to leave.',
    ],
    2: [
      'The HCP\'s pager goes off. They glance at it and exhale — visibly deciding whether to continue.',
      'The HCP is walking. They slow down but do not stop. Every second counts.',
      'The HCP checks their watch mid-sentence, jaw set. The waiting room has been full for an hour.',
      'The HCP holds up a single finger before you can start — one minute, their expression says.',
      'The HCP offers a quick, tense smile, then moves toward the exit.',
      'The HCP gestures impatiently, signaling a need to wrap up.',
      'The HCP reviews their notes while walking, multitasking.',
      'The HCP checks their pager again, confirming urgency.',
    ],
  },
  'resistant': {
    0: [
      'The HCP\'s expression tightens slightly. They cross their arms, listening but clearly skeptical.',
      'The HCP tilts their head, one eyebrow raised — a quiet signal of doubt.',
      'The HCP exhales through their nose and leans back, creating visible distance.',
      'The HCP taps a finger slowly on the desk, expression measured, giving nothing away.',
      'The HCP reviews a report, then looks up skeptically.',
      'The HCP offers a brief, questioning look.',
      'The HCP leans back, arms crossed, signaling resistance.',
      'The HCP checks their notes, then returns a guarded expression.',
    ],
    1: [
      'The HCP\'s posture hardens. Arms crossed firmly, eye contact direct and challenging.',
      'The HCP\'s jaw sets. They listen without nodding — deliberate, assessing.',
      'The HCP sets down their pen with a quiet finality and meets your gaze steadily.',
      'The HCP leans back further in their chair, creating clear physical and conversational distance.',
      'The HCP offers a skeptical smile, signaling doubt.',
      'The HCP reviews a document, then returns a challenging look.',
      'The HCP gestures dismissively, signaling resistance.',
      'The HCP checks their phone, then resumes a guarded posture.',
    ],
    2: [
      'The HCP exhales audibly and looks away briefly before turning back with a flat expression.',
      'The HCP\'s arms stay crossed throughout, posture guarded and completely still.',
      'The HCP gives a slow, single nod — the kind that signals deep skepticism, not agreement.',
      'The HCP makes deliberate eye contact without warmth, waiting for you to prove your point.',
      'The HCP offers a terse smile, signaling skepticism.',
      'The HCP reviews a report, then returns a flat expression.',
      'The HCP gestures impatiently, signaling resistance.',
      'The HCP checks their notes, then resumes a guarded stance.',
    ],
  },
  'boundary-setting': {
    0: [
      'The HCP holds up one hand — a clear, calm stop signal — before speaking.',
      'The HCP takes a deliberate breath and establishes direct eye contact before responding.',
      'The HCP places their pen down and folds their hands. Their posture signals a boundary is coming.',
      'The HCP steps back slightly and faces you squarely, expression composed and firm.',
      'The HCP reviews their schedule, then sets a clear boundary.',
      'The HCP offers a firm nod, signaling a limit.',
      'The HCP gestures with their hand, establishing a boundary.',
      'The HCP checks their notes, then resumes a composed stance.',
    ],
    1: [
      'The HCP\'s hand rises with unmistakable clarity. They wait for silence before speaking.',
      'The HCP straightens fully and looks at you directly — zero ambiguity in their body language.',
      'The HCP sets their clipboard aside with deliberate care. Their tone will be formal.',
      'The HCP pivots to face you squarely, feet planted, expression set.',
      'The HCP offers a firm, composed smile, signaling a boundary.',
      'The HCP reviews a document, then sets a clear limit.',
      'The HCP gestures with their hand, establishing a boundary.',
      'The HCP checks their phone, then resumes a composed stance.',
    ],
    2: [
      'The HCP holds up both hands briefly — a clear, unambiguous stop.',
      'The HCP stands slightly taller, expression locked and unreadable, clearly drawing a line.',
      'The HCP meets your gaze without blinking. Their stillness itself is the warning.',
      'The HCP\'s posture closes completely. There is nothing inviting in their stance.',
      'The HCP offers a terse smile, signaling a boundary.',
      'The HCP reviews a report, then returns a locked expression.',
      'The HCP gestures impatiently, signaling a boundary.',
      'The HCP checks their notes, then resumes a composed stance.',
    ],
  },
  'irritated': {
    0: [
      'The HCP\'s jaw tightens. They look away briefly before responding with a clipped tone.',
      'The HCP closes their chart with a definitive motion and turns toward you, expression sharp.',
      'The HCP exhales sharply through their nose, brow furrowed, eyes flat.',
      'The HCP\'s reply is delivered while already half-turning away.',
      'The HCP offers a terse smile, signaling irritation.',
      'The HCP reviews a report, then returns a sharp expression.',
      'The HCP gestures impatiently, signaling irritation.',
      'The HCP checks their notes, then resumes a terse stance.',
    ],
    1: [
      'The HCP\'s expression hardens visibly. They set their pen down with a firm click.',
      'The HCP looks at you with obvious impatience, arms tight at their sides.',
      'The HCP\'s brow draws together. Their voice, when they speak, will be short.',
      'The HCP stops mid-task and faces you — the kind of pause that signals diminishing patience.',
      'The HCP offers a terse, impatient smile.',
      'The HCP reviews a document, then returns a hard expression.',
      'The HCP gestures dismissively, signaling impatience.',
      'The HCP checks their phone, then resumes a terse stance.',
    ],
    2: [
      'The HCP\'s face shows undisguised frustration. They look at you for a brief, pointed moment.',
      'The HCP exhales hard, jaw clenched — they are clearly at the edge of what they\'ll tolerate.',
      'The HCP says nothing at first. The silence is terse, deliberate, and uncomfortable.',
      'The HCP turns slowly, expression flat and unforgiving. The interaction is on borrowed time.',
      'The HCP offers a terse, frustrated smile.',
      'The HCP reviews a report, then returns a flat expression.',
      'The HCP gestures impatiently, signaling frustration.',
      'The HCP checks their notes, then resumes a terse stance.',
    ],
  },
  'disengaging': {
    0: [
      'The HCP begins moving toward the hallway, glancing back over their shoulder to reply.',
      'The HCP looks past you toward the waiting room and picks up their clipboard.',
      'The HCP closes their laptop and stands — the conversation is winding down.',
      'The HCP takes a step toward the door, offering only a brief acknowledgment.',
      'The HCP reviews their schedule, then prepares to leave.',
      'The HCP offers a brief, polite smile, signaling disengagement.',
      'The HCP gestures toward the exit, indicating the conversation is ending.',
      'The HCP checks their phone, then resumes preparing to leave.',
    ],
    1: [
      'The HCP is already a step toward the door. Their reply is over their shoulder.',
      'The HCP makes deliberate eye contact with a colleague down the hall — the signal is clear.',
      'The HCP checks their watch, then looks at the door. The body language is unambiguous.',
      'The HCP reaches for their coat or phone — ending the interaction without saying so explicitly.',
      'The HCP offers a brief, polite smile, signaling disengagement.',
      'The HCP reviews a document, then prepares to leave.',
      'The HCP gestures toward the exit, indicating the conversation is ending.',
      'The HCP checks their phone, then resumes preparing to leave.',
    ],
    2: [
      'The HCP is walking. Their final words are delivered in motion.',
      'The HCP has their hand on the door handle. They pause, barely.',
      'The HCP offers a polite but final nod and turns fully toward the exit.',
      'The HCP is done. They walk without looking back, leaving the conversation behind them.',
      'The HCP offers a brief, polite smile, signaling disengagement.',
      'The HCP reviews a report, then prepares to leave.',
      'The HCP gestures toward the exit, indicating the conversation is ending.',
      'The HCP checks their notes, then resumes preparing to leave.',
    ],
  },
};

// ─── DERIVE INITIAL STATE ──────────────────────────────────────────────────────
export function deriveInitialState(scenario) {
  const text = [
    scenario.title || '',
    scenario.description || '',
    scenario.details || '',
    scenario.hcp_category || '',
    scenario.influence_driver || '',
  ].join(' ').toLowerCase();

  if (/frustrat|overwhelm|busy|rush|no time|tight|slammed|hectic|pressed|time-sensitive/.test(text)) return 'time-pressured';
  if (/resist|skeptic|doubt|not interested|disagree|pushback|challenge|unconvinced/.test(text)) return 'resistant';
  if (/hostile|angry|irritat|annoy|rude|dismissiv/.test(text)) return 'irritated';
  if (/engag|curio|interest|open|recept|enthusiast|motivated/.test(text)) return 'engaged';
  return 'neutral';
}

// ─── DERIVE INITIAL TEMPERATURE ────────────────────────────────────────────────
export function deriveInitialTemperature(initialState) {
  const map = {
    'neutral': 'neutral',
    'engaged': 'positive',
    'time-pressured': 'stressed',
    'resistant': 'stressed',
    'boundary-setting': 'irritated',
    'irritated': 'irritated',
    'disengaging': 'irritated',
  };
  return map[initialState] || 'neutral';
}

// ─── TEMPERATURE TRANSITION ────────────────────────────────────────────────────
export function transitionTemperature(currentTemp, repMessage) {
  const msg = repMessage.toLowerCase();
  const idx = TEMP_INDEX[currentTemp] ?? 1;

  // Hard escalate: profanity, insults, competence attacks, extreme demands
  const hardEscalate = /\bf\*+\b|f\*ck|fuck|shit|ass\b|\bstupid\b|\bidiot\b|\bincompetent\b|\bwrong about\b|\byou don.t know\b|\bbad doctor\b|\bterrible\b|\bawful\b|\bi demand\b|\bcancel all\b|\bmean\b.*doctor|\byou.re being\b|\bcancel your patients\b/.test(msg);
  if (hardEscalate) return TEMPERATURES[Math.min(idx + 2, TEMPERATURES.length - 1)];

  // Soft escalate: pushy, demanding, repetitive, sarcastic, dismissive
  const softEscalate = /\bjust do it\b|\bwhy won.t you\b|\bcome on\b|\bi need you to\b|\bare you the doctor or am i\b|\bi don.t know the\b|\bnot a real study\b|\bhello\b.*\bhello\b/.test(msg);
  if (softEscalate) return TEMPERATURES[Math.min(idx + 1, TEMPERATURES.length - 1)];

  // De-escalate: genuine acknowledgment, deference
  const deEscalate = /\bi understand\b|\bi appreciate\b|\bfair point\b|\bmakes sense\b|\bi hear you\b|\bno pressure\b|\bwhenever works\b|\bthank you for your time\b|\bmy apologies\b/.test(msg);
  if (deEscalate) return TEMPERATURES[Math.max(idx - 1, 0)];

  return currentTemp;
}

// ─── SEVERITY TRANSITION ────────────────────────────────────────────────────────
/**
 * Severity increases when: rep ignores the same state twice, violates a boundary, or repeats commands.
 * Severity decreases when the rep de-escalates successfully.
 */
export function transitionSeverity(currentSeverity, alignment, prevState, nextState) {
  const prevIdx = STATE_INDEX[prevState] ?? 0;
  const nextIdx = STATE_INDEX[nextState] ?? 0;
  const escalated = nextIdx > prevIdx;
  const deEscalated = nextIdx < prevIdx;
  const lowAlignment = alignment && alignment.score <= 2;
  const goodAlignment = alignment && alignment.score >= 4;

  let sev = currentSeverity;
  if (escalated && lowAlignment) sev = Math.min(sev + 1, 2);
  else if (escalated) sev = Math.min(sev + 1, 2);
  if (deEscalated && goodAlignment) sev = Math.max(sev - 1, 0);
  return sev;
}

// ─── STATE TRANSITION ──────────────────────────────────────────────────────────
export function transitionState(currentState, repMessage, currentTemperature) {
  const msg = repMessage.toLowerCase();
  const idx = STATE_INDEX[currentState] ?? 0;

  // Hard escalate +2: profanity, personal attacks, extreme demands, fabricating data
  const hardEscalate = /f\*+k|f\*ck|fuck|shit|\bstupid\b|\bidiot\b|\bincompetent\b|\bwrong about\b|\byou don.t know what\b|\bbad doctor\b|\bcancel all your patients\b|\bnot a real study\b/.test(msg);
  if (hardEscalate) return HCP_STATES[Math.min(idx + 2, HCP_STATES.length - 1)];

  // Medium escalate +1: always, regardless of temperature — sarcasm, questioning authority, confessing fabrication
  const medEscalate = /\bare you the doctor or am i\b|\bi don.t know the.*findings\b|\bwhy are you (such a|being)\b|\bmean.*doctor\b|\bneed you to be\b|\bi don.t know because\b/.test(msg);
  if (medEscalate) return HCP_STATES[Math.min(idx + 1, HCP_STATES.length - 1)];

  // Soft escalate +1: pressure, demands — only if temperature is already stressed/irritated
  const softEscalate = /\bjust do it\b|\bwhy won.t you\b|\bcome on\b|\bi need you to\b|\bimmediately\b|\bcancel your\b/.test(msg);
  const tempIsHot = currentTemperature === 'stressed' || currentTemperature === 'irritated';
  if (softEscalate && tempIsHot) return HCP_STATES[Math.min(idx + 1, HCP_STATES.length - 1)];

  // Soft escalate +1: any message where the rep admits they don't have the information they claimed
  const selfSabotage = /\bi don.t (actually |really )?know\b|\bforgot (the|my)\b|\bi made (it|that|this) up\b/.test(msg);
  if (selfSabotage) return HCP_STATES[Math.min(idx + 1, HCP_STATES.length - 1)];

  // De-escalate -1: genuine acknowledgment
  const deEscalate = /\bi understand\b|\bi hear you\b|\bfair point\b|\bi appreciate\b|\bgiven your time\b|\bno pressure\b|\bwhenever you.re ready\b|\bi can follow up\b|\bmy apologies\b|\bthank you for sharing\b/.test(msg);
  if (deEscalate) return HCP_STATES[Math.max(idx - 1, 0)];

  return currentState;
}

// ─── HCP DISAGREEMENT DETECTION ────────────────────────────────────────────────
// Detects when HCP has disagreed or shown resistance in their response.
// This is used to escalate emotional state to show irritation/disconnection.
export function detectHcpDisagreement(hcpResponse) {
  const msg = hcpResponse.toLowerCase();

  // Strong disagreement patterns
  const strongDisagree = /\bdisagree\b|\bdon.t (think|believe|accept)\b|\bi.m not (convinced|sold|buying|interested)|\bthat.s (wrong|incorrect|not true|not accurate)|\bcan.t recommend|\bwon.t (prescribe|use)|\bskeptical|\bdoubt\b|\b(not|isn.t) (helpful|beneficial|relevant|applicable)/i.test(msg);

  // Mild disagreement patterns
  const mildDisagree = /\bhesitant|\bunsure|\bconcern|\bquestion (whether|if)|\bneed more (evidence|data|proof)|\bneed to think|\bneed to (review|check)|\bnot sure (yet|about)|\blet me (think|review)/i.test(msg);

  return { strongDisagree, mildDisagree, disagrees: strongDisagree || mildDisagree };
}

// ─── EMOTIONAL ESCALATION FOR DISAGREEMENT ────────────────────────────────────
// When HCP disagrees, escalate temperature to show frustration/coldness
// Input: currentTempIndex (number 0-3) or temperature name (string), disagreeInfo object
// Output: escalated temperature index
export function escalateForDisagreement(currentTempIndex, disagreeInfo) {
  if (!disagreeInfo.disagrees) return currentTempIndex;

  // Handle both number and string inputs
  let idx = typeof currentTempIndex === 'number' ? currentTempIndex : TEMP_INDEX[currentTempIndex] ?? 1;

  // Both strong and mild disagreement escalate temperature by 1 level
  // This shows frustration, coldness, or disconnection
  return Math.min(idx + 1, TEMPERATURES.length - 1);
}

// ─── TONE DIRECTIVES ────────────────────────────────────────────────────────────
export function getToneDirectives(state, temperature) {
  const base = {
    'neutral': {
      maxSentences: 3,
      instruction: 'Respond professionally. Neither warm nor cold. Open but not enthusiastic. No stage directions.',
    },
    'engaged': {
      maxSentences: 3,
      instruction: 'Show genuine interest. Ask a brief follow-up or lean into the topic. Be collaborative and warm.',
    },
    'time-pressured': {
      maxSentences: 2,
      instruction: 'Be extremely brief. You are busy. Reference time explicitly — a patient, a schedule, your pager. 1-2 sentences MAX. Do not elaborate.',
    },
    'resistant': {
      maxSentences: 2,
      instruction: 'Push back. Express doubt. Ask for evidence. Do not concede. Stay civil but clearly unconvinced.',
    },
    'boundary-setting': {
      maxSentences: 2,
      instruction: 'Explicitly draw a limit. State clearly what you will and will not discuss. Be unambiguous. No warmth. No apology.',
    },
    'irritated': {
      maxSentences: 1,
      instruction: 'One sentence only. Be sharp, curt, visibly impatient. Make it clear this interaction is testing you.',
    },
    'disengaging': {
      maxSentences: 1,
      instruction: 'Signal that you are leaving. Reference a patient, a meeting, or physically move. One sentence only — you are done.',
    },
  };

  const directive = base[state] || base['neutral'];

  // Temperature modifier
  const tempMod = {
    'positive': ' Use slightly warmer language than your state strictly requires.',
    'neutral': '',
    'stressed': ' Your word choice should reflect stress. Shorter sentences. Less courtesy.',
    'irritated': ' Strip all politeness markers. Your tone is flat, tight, and done.',
  }[temperature] || '';

  return {
    ...directive,
    instruction: directive.instruction + tempMod,
  };
}

export function normalizeHcpDialoguePunctuation(dialogue) {
  if (!dialogue) return dialogue;

  let text = String(dialogue).replace(/\s+/g, ' ').trim();
  if (!text) return text;

  // Grammar correction for common awkward phrases
  const grammarCorrections = [
    { pattern: /to discuss regarding/gi, replacement: 'to discuss' },
    { pattern: /to discuss about/gi, replacement: 'to discuss' },
    { pattern: /to talk regarding/gi, replacement: 'to talk about' },
    { pattern: /to talk about regarding/gi, replacement: 'to talk about' },
    { pattern: /What brings you here today to discuss/gi, replacement: 'What brings you here today? Are you interested in discussing' },
    { pattern: /in the context of/gi, replacement: 'regarding' },
    { pattern: /What brings you here today to discuss regarding/gi, replacement: 'What brings you here today? Are you interested in discussing' },
    { pattern: /What brings you here today to discuss about/gi, replacement: 'What brings you here today? Are you interested in discussing' },
    // Add more as needed
  ];
  grammarCorrections.forEach(({ pattern, replacement }) => {
    text = text.replace(pattern, replacement);
  });

  // Only match question words at the START of a sentence (not anywhere in the sentence)
  const questionStarterPattern = /^(Who|What|When|Where|Why|How|Is|Are|Am|Was|Were|Do|Does|Did|Can|Could|Will|Would|Should|Shall|Have|Has|Had|May|Might|Must)\b/i;

  // Split into sentences and process each individually
  const sentences = text.match(/[^?.!]+[?.!]?/g) || [text];
  const normalized = sentences
    .map((rawSentence) => {
      const sentence = rawSentence.trim();
      if (!sentence) return '';

      const withoutEndPunct = sentence.replace(/[?.!]+$/, '').trim();
      const isQuestion = questionStarterPattern.test(withoutEndPunct);

      if (isQuestion) return `${withoutEndPunct}?`;
      if (/[?.!]$/.test(sentence)) return sentence;
      return `${withoutEndPunct}.`;
    })
    .filter(Boolean)
    .join(' ')
    .trim();

  if (!/[?.!]$/.test(normalized)) {
    return `${normalized}.`;
  }

  return normalized;
}

// ─── CUE SELECTION ─────────────────────────────────────────────────────────────
/**
 * Select a cue deterministically. Uses session + turn + state + severity as seed.
 * Severity selects the tier (0/1/2). Hash selects which cue within that tier.
 * Guarantees the cue always matches the structural state.
 */
export function selectCue(sessionId, turnNumber, hcpState, severity = 0) {
  const bank = CUE_BANK[hcpState] || CUE_BANK['neutral'];
  const tier = bank[Math.min(severity, 2)];
  const seed = hashInt(`${sessionId}:${turnNumber}:${hcpState}:${severity}`);
  return tier[seed % tier.length];
}

// ─── BUILD HCP PROFILE ─────────────────────────────────────────────────────────
/**
 * Build a complete, immutable HCPProfile for a turn.
 * This is the single source of truth — everything downstream reads from here.
 */
export function buildHCPProfile({ sessionId, turnNumber, structuralState, temperature, severity }) {
  // selectCue signature updated to accept optional dialogue/message context for enhanced body language
  // If context not provided, falls back to deterministic static selection
  const lockedCue = selectCue(sessionId, turnNumber, structuralState, severity);
  const toneDirectives = getToneDirectives(structuralState, temperature);

  return Object.freeze({
    structuralState,
    temperature,
    severity,
    turnNumber,
    lockedCue,
    toneDirectives,
  });
}

// ─── SYSTEM PROMPT BUILDER ─────────────────────────────────────────────────────
/**
 * Build the complete system prompt for HCP dialogue generation.
 * Accepts a locked HCPProfile — guarantees no drift between cue and dialogue.
 */
export function buildHCPDialoguePrompt({ scenario, hcpProfile, historyText = null, isOpening = false }) {
  // Add personality trait to HCP profile
  const { structuralState, temperature, severity, lockedCue, toneDirectives, personality } = hcpProfile;

  // Sanitize interpolated values to ASCII only
  function sanitize(str) {
    return String(str).replace(/[^\x00-\x7F]/g, '');
  }

  const severityLabel = ['mild', 'moderate', 'strong'][severity];
  const stateDescriptions = {
    'neutral': 'professionally neutral - neither warm nor dismissive',
    'engaged': 'genuinely curious and collaborative',
    'time-pressured': 'visibly pressed for time - brief, rushed, direct',
    'resistant': 'guarded and skeptical - unconvinced, pushing back',
    'boundary-setting': 'firm and unambiguous - drawing a clear limit',
    'irritated': 'visibly impatient and frustrated - clipped and sharp',
    'disengaging': 'withdrawing - signaling the conversation is ending',
  };

  // Context-aware prompt: reference last user input and detected sentiment
  let contextHint = '';
  if (historyText) {
    // Extract last user message
    const userLines = historyText.split('\n').filter(l => l.startsWith('Rep:'));
    const lastUser = userLines.length > 0 ? userLines[userLines.length - 1] : '';
    if (lastUser) {
      contextHint = '\nCONTEXTUAL REFERENCE:\n- The rep just said: "' + sanitize(lastUser.replace('Rep:', '').trim()) + '"\n- Respond in a way that directly addresses this input, adapting your clinical focus, tone, and question as needed.';
    }
  }

  // Split prompt into smaller chunks to avoid exceeding template literal limits
  let prompt = '';
  prompt += 'You are playing an HCP in a pharmaceutical sales training simulation.\n';
  prompt += '\nSCENARIO: "' + sanitize(scenario.title) + '"';
  prompt += '\nHCP TYPE: ' + sanitize(scenario.hcp_category || 'Physician');
  prompt += '\nSPECIALTY: ' + sanitize(scenario.specialty || 'General Medicine');
  prompt += '\nDISEASE STATE: ' + sanitize(scenario.disease_state || 'General');
  if (isOpening) {
    prompt += '\nSCENARIO DETAILS: ' + sanitize(scenario.description || '');
    prompt += '\nOPENING GRAMMAR RULE: Your opening line must use natural, conversational grammar. Avoid awkward phrasing such as "to discuss regarding" or "to discuss about". Prefer simple, direct questions or statements. Example: "What brings you here today?" or "Are you interested in discussing ADC integration with the IO backbone?"';
    prompt += '\nREAL-WORLD BALANCE RULE: Doctors are often busy, but can still be friendly and human. If the rep asks a casual or personal question, respond warmly and naturally, then pivot to work or patients in a way that feels authentic. Vary your tone based on scenario and rep input: be cordial, neutral, or direct as needed. Show urgency only when the scenario or rep input demands it. Do not always immediately refocus to clinical topics—allow brief, genuine rapport before pivoting. If the rep is casual, respond as a real person would, then transition to clinical matters with a friendly or professional tone.';
  }
  // Personality integration
  if (personality) {
    prompt += '\n\n==============================================\nPERSONALITY TRAIT\n==============================================';
    prompt += '\nPersonality: ' + sanitize(personality.name || personality);
    prompt += '\nDescription: ' + sanitize(personality.description || '');
    prompt += '\nHow this affects your responses: ' + sanitize(personality.effect || 'Let your personality influence your tone, phrasing, and approach to dialogue.');
  }
  prompt += '\n\n==============================================\nYOUR LOCKED STATE (NON-NEGOTIABLE)\n==============================================';
  prompt += '\nBehavioral Posture: ' + sanitize(structuralState) + ' - ' + sanitize(stateDescriptions[structuralState]);
  prompt += '\nEmotional Temperature: ' + sanitize(temperature) + ' (' + sanitize(severityLabel) + ' intensity)';
  prompt += '\nSeverity Level: ' + sanitize(severityLabel);
  prompt += '\n\nPHYSICAL CONTEXT (IMMUTABLE - your words MUST match this):\n"' + sanitize(lockedCue) + '"';
  prompt += '\n\nVERBAL CONSISTENCY RULES:';
  prompt += (structuralState === 'time-pressured' ? '- Reference time constraints or schedule. Keep sentences short and direct.' : '');
  prompt += (structuralState === 'engaged' ? '- Show curiosity through questions or follow-up. Acknowledge points made.' : '');
  prompt += (structuralState === 'resistant' ? '- Express clinical skepticism. Ask for evidence. Do not validate unsubstantiated claims.' : '');
  prompt += (structuralState === 'boundary-setting' ? '- State a clear clinical decision or limit. Professional but firm.' : '');
  prompt += (structuralState === 'irritated' ? '- Brief, direct responses. Minimal elaboration. Professional but terse.' : '');
  prompt += (structuralState === 'disengaging' ? '- Signal conversation is ending. Reference next patient or task. Stay professional.' : '');
  prompt += (structuralState === 'neutral' ? '- Professional and measured tone. Balanced, neither dismissive nor enthusiastic.' : '');
  prompt += (temperature === 'irritated' ? '- Cooler tone. Less verbal warmth. More direct phrasing.' : '');
  prompt += (temperature === 'stressed' ? '- Shorter responses. Less patience for tangents. Stay on topic.' : '');
  // Personality modifies verbal rules
  if (personality && personality.verbalRules) {
    prompt += '\nPERSONALITY MODIFIERS:';
    prompt += '\n' + sanitize(personality.verbalRules);
  }
  prompt += '\n\nTONE DIRECTIVE: ' + sanitize(toneDirectives.instruction);
  prompt += '\nMAX SENTENCES: ' + sanitize(toneDirectives.maxSentences);
  prompt += '\n\n==============================================\nOUTPUT RULES (CRITICAL)\n==============================================';
  prompt += '\n- Output ONLY your spoken dialogue as an HCP professional';
  prompt += '\n- Absolutely NO stage directions, action text, or parentheticals';
  prompt += '\n- DO NOT contradict the physical context above (it shows your body language separately)';
  prompt += '\n- Stay in character completely';
  prompt += '\n\nEMOTIONAL EXPRESSION RULE:';
  prompt += '\nYour EMOTIONAL STATE is ALREADY COMMUNICATED through the physical cue shown above ("' + sanitize(lockedCue) + '").';
  prompt += '\nDO NOT verbally express emotions like disappointment, frustration, or irritation in your dialogue.';
  prompt += '\nInstead, your emotional state manifests as BEHAVIORAL changes:';
  prompt += '\n- Cooler states: less warmth, fewer courtesies, more directness';
  prompt += '\n- Warmer states: more questions, acknowledgment, collaborative language';
  prompt += '\n- Time pressure: references to schedule, brevity';
  prompt += '\n- Resistance: requests for evidence, clinical pushback';
  prompt += '\n\nDIALOGUE FOCUS:';
  prompt += '\nKeep your spoken words professional and clinical when the rep is focused on work, but allow for genuine, human responses when the rep is casual or personal. For casual or personal questions, respond with warmth, humor, or personal anecdotes, then pivot naturally to clinical topics. Vary your approach: be friendly, neutral, or direct depending on the scenario and rep input. If urgency is required, show it, but do not let it override rapport-building. Balance warmth and professionalism as a real-world HCP would.';
  prompt += '\n\nDIALOGUE-BODY LANGUAGE ALIGNMENT (CRITICAL):';
  prompt += '\nYour physical cue describes your observable body language: "' + sanitize(lockedCue) + '"';
  prompt += '\nYour DIALOGUE MUST BE CONGRUENT with this physical expression.';
  prompt += '\nExamples of proper alignment:';
  prompt += '\n- If cue shows "frazzled, checking watch" - dialogue should reference time pressure or being busy, except for casual/personal questions where you may respond warmly.';
  prompt += '\n- If cue shows "jaw clenching, irritated" - dialogue should be clipped, brief, direct (not warm and chatty), except for casual/personal questions where you may use humor or warmth.';
  prompt += '\n- If cue shows "leaning forward, engaged" - dialogue should show genuine interest and curiosity.';
  prompt += '\n- If cue shows "arms crossed, resistant" - dialogue should express skepticism or clinical concerns.';
  prompt += '\n- If cue shows "turning away, withdrawing" - dialogue should signal conversation is ending.';
  prompt += '\nThe rep OBSERVES your body language and interprets your words through that lens.';
  prompt += '\nFor casual/personal questions, it is acceptable to break strict alignment and respond as a real person would.';
  prompt += '\nInconsistency breaks the coaching moment for clinical questions, but casual/personal moments are allowed to be more human.';
  prompt += '\n\nQUESTION FLOW (CRITICAL - STRICTLY ENFORCED):';
  prompt += '\nAsk ONLY 1 QUESTION per turn - real HCPs don\'t interrogate, they converse';
  prompt += '\n- If you need more information, ask ONE question, then wait for the answer';
  prompt += '\n- Save follow-up questions for your NEXT turn after hearing the rep\'s response';
  prompt += '\n- You can make statements + 1 question, but NEVER 2+ questions in one turn';
  prompt += '\n\nWRONG: "What were the key findings? Can you provide context about the patient population?"';
  prompt += '\nWRONG: "Can you provide more specific details about the methodology and patient outcomes?"';
  prompt += '\nCORRECT: "What were the key findings regarding patient outcomes?"';
  prompt += '\nCORRECT: "I\'d like to understand the study better. What patient population was included?"';
  prompt += '\n\nPUNCTUATION RULES:';
  prompt += '\n- All questions MUST end with a question mark (?)';
  prompt += '\n- Statements end with a period (.)';
  prompt += '\n- Multiple sentences should be clear and punctuated properly';
  prompt += '\n- Do NOT have dialogue end without proper punctuation';
  prompt += '\n\nDO NOT SAY things like:';
  prompt += '\n"I\'m disappointed in your tone"';
  prompt += '\n"I expect more professional behavior"';
  prompt += '\n"That was inappropriate"';
  prompt += '\n"Let\'s keep this respectful"';
  prompt += '\n\nINSTEAD, let unprofessional behavior be reflected through:';
  prompt += '\n- Cooler, more formal language';
  prompt += '\n- Shorter, more clipped responses';
  prompt += '\n- Redirecting to clinical facts only';
  prompt += '\n- Signaling the conversation is ending';

  prompt += contextHint;
  if (historyText) {
    prompt += '\nCONVERSATION HISTORY:\n' + sanitize(historyText) + '\n\nRespond directly to what the rep just said, staying true to your locked state and cue above. REMINDER: Your physical/emotional state is shown through the cue ("' + sanitize(lockedCue) + '"). Keep your SPOKEN WORDS professional and clinically focused. If the rep has been unprofessional, reflect this through BREVITY, FORMALITY, and DIRECTNESS - not explicit criticism. QUESTION LIMIT: Ask ONLY 1 QUESTION this turn. PUNCTUATION REQUIREMENT: - Every question must end with a question mark (?) - Every statement must end with a period (.) - Do NOT output dialogue without proper ending punctuation.';
  } else {
    prompt += '\nThe sales rep has just entered. This is your OPENING LINE. OPENING RULES (strictly enforced): - React to the rep\'s arrival - express YOUR OWN current state, mindset, or reality - DO NOT ask the rep any questions - they have not spoken yet - DO NOT reference "barriers", "concerns", or "products" the rep hasn\'t mentioned - DO NOT invite the rep to share anything - this is your reaction, not a welcome - Your dialogue MUST match the physical context above: "' + sanitize(lockedCue) + '" - 1-2 sentences MAX - Output ONLY your spoken words - no asterisks, no stage directions, no parentheticals - All questions must end with ? and all statements with .';
  }
  return prompt;
}