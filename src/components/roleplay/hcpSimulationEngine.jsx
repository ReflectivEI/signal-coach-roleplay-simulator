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
    ],
    1: [
      'The HCP pauses their work and meets your gaze briefly, waiting without enthusiasm.',
      'The HCP places their chart on the desk and gives you their measured attention.',
      'The HCP leans back slightly, expression impassive, clearly reserving judgment.',
      'The HCP listens without reacting, giving away nothing through their body language.',
    ],
    2: [
      'The HCP listens with arms folded loosely, expression carefully composed.',
      'The HCP makes limited eye contact, attention divided between you and the room.',
      'The HCP sits upright, posture contained, showing careful professional neutrality.',
      'The HCP gives a short nod — courteous, but uncommitted.',
    ],
  },
  'engaged': {
    0: [
      'The HCP leans slightly forward, making sustained eye contact, nodding as you speak.',
      'The HCP sets aside their chart entirely and turns fully toward you, expression attentive.',
      'The HCP\'s posture opens — shoulders back, direct eye contact, a faint smile.',
      'The HCP asks a brief clarifying question, leaning in as they wait for your answer.',
    ],
    1: [
      'The HCP\'s pen stops mid-note. They look up with clear interest and wait for you to continue.',
      'The HCP tilts their head slightly, expression curious, giving you their full attention.',
      'The HCP uncrosses their arms and leans forward, clearly drawn into the conversation.',
      'The HCP makes deliberate eye contact and mirrors your pace, signaling active listening.',
    ],
    2: [
      'The HCP closes their laptop and pivots fully to face you — a signal of genuine engagement.',
      'The HCP nods in rhythm with your points, expression concentrated and open.',
      'The HCP rests their elbows on the desk and bridges their fingers, fully present.',
      'The HCP\'s eyes stay on yours throughout — no distraction, no glances away.',
    ],
  },
  'time-pressured': {
    0: [
      'The HCP glances briefly at their watch while listening. A colleague waves from the hallway.',
      'The HCP shifts their weight toward the door, still listening but visibly pulled elsewhere.',
      'The HCP\'s pager vibrates on the desk. They silence it quickly and look back at you.',
      'The HCP checks the wall clock once, expression politely tense, waiting room audible behind them.',
    ],
    1: [
      'The HCP is already moving toward a patient room. They stop — but only barely.',
      'The HCP checks their phone with a tight expression, then looks up. The floor is full.',
      'The HCP holds a patient file in hand, posture angled toward their next stop.',
      'The HCP\'s eyes move to the door twice. A nurse pauses outside and nods toward the corridor.',
    ],
    2: [
      'The HCP\'s pager goes off. They glance at it and exhale — visibly deciding whether to continue.',
      'The HCP is walking. They slow down but do not stop. Every second counts.',
      'The HCP checks their watch mid-sentence, jaw set. The waiting room has been full for an hour.',
      'The HCP holds up a single finger before you can start — one minute, their expression says.',
    ],
  },
  'resistant': {
    0: [
      'The HCP\'s expression tightens slightly. They cross their arms, listening but clearly skeptical.',
      'The HCP tilts their head, one eyebrow raised — a quiet signal of doubt.',
      'The HCP exhales through their nose and leans back, creating visible distance.',
      'The HCP taps a finger slowly on the desk, expression measured, giving nothing away.',
    ],
    1: [
      'The HCP\'s posture hardens. Arms crossed firmly, eye contact direct and challenging.',
      'The HCP\'s jaw sets. They listen without nodding — deliberate, assessing.',
      'The HCP sets down their pen with a quiet finality and meets your gaze steadily.',
      'The HCP leans back further in their chair, creating clear physical and conversational distance.',
    ],
    2: [
      'The HCP exhales audibly and looks away briefly before turning back with a flat expression.',
      'The HCP\'s arms stay crossed throughout, posture guarded and completely still.',
      'The HCP gives a slow, single nod — the kind that signals deep skepticism, not agreement.',
      'The HCP makes deliberate eye contact without warmth, waiting for you to prove your point.',
    ],
  },
  'boundary-setting': {
    0: [
      'The HCP holds up one hand — a clear, calm stop signal — before speaking.',
      'The HCP takes a deliberate breath and establishes direct eye contact before responding.',
      'The HCP places their pen down and folds their hands. Their posture signals a boundary is coming.',
      'The HCP steps back slightly and faces you squarely, expression composed and firm.',
    ],
    1: [
      'The HCP\'s hand rises with unmistakable clarity. They wait for silence before speaking.',
      'The HCP straightens fully and looks at you directly — zero ambiguity in their body language.',
      'The HCP sets their clipboard aside with deliberate care. Their tone will be formal.',
      'The HCP pivots to face you squarely, feet planted, expression set.',
    ],
    2: [
      'The HCP holds up both hands briefly — a clear, unambiguous stop.',
      'The HCP stands slightly taller, expression locked and unreadable, clearly drawing a line.',
      'The HCP meets your gaze without blinking. Their stillness itself is the warning.',
      'The HCP\'s posture closes completely. There is nothing inviting in their stance.',
    ],
  },
  'irritated': {
    0: [
      'The HCP\'s jaw tightens. They look away briefly before responding with a clipped tone.',
      'The HCP closes their chart with a definitive motion and turns toward you, expression sharp.',
      'The HCP exhales sharply through their nose, brow furrowed, eyes flat.',
      'The HCP\'s reply is delivered while already half-turning away.',
    ],
    1: [
      'The HCP\'s expression hardens visibly. They set their pen down with a firm click.',
      'The HCP looks at you with obvious impatience, arms tight at their sides.',
      'The HCP\'s brow draws together. Their voice, when they speak, will be short.',
      'The HCP stops mid-task and faces you — the kind of pause that signals diminishing patience.',
    ],
    2: [
      'The HCP\'s face shows undisguised frustration. They look at you for a brief, pointed moment.',
      'The HCP exhales hard, jaw clenched — they are clearly at the edge of what they\'ll tolerate.',
      'The HCP says nothing at first. The silence is terse, deliberate, and uncomfortable.',
      'The HCP turns slowly, expression flat and unforgiving. The interaction is on borrowed time.',
    ],
  },
  'disengaging': {
    0: [
      'The HCP begins moving toward the hallway, glancing back over their shoulder to reply.',
      'The HCP looks past you toward the waiting room and picks up their clipboard.',
      'The HCP closes their laptop and stands — the conversation is winding down.',
      'The HCP takes a step toward the door, offering only a brief acknowledgment.',
    ],
    1: [
      'The HCP is already a step toward the door. Their reply is over their shoulder.',
      'The HCP makes deliberate eye contact with a colleague down the hall — the signal is clear.',
      'The HCP checks their watch, then looks at the door. The body language is unambiguous.',
      'The HCP reaches for their coat or phone — ending the interaction without saying so explicitly.',
    ],
    2: [
      'The HCP is walking. Their final words are delivered in motion.',
      'The HCP has their hand on the door handle. They pause, barely.',
      'The HCP offers a polite but final nod and turns fully toward the exit.',
      'The HCP is done. They walk without looking back, leaving the conversation behind them.',
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

  // Only match question words at the START of a sentence (not anywhere in the sentence)
  // "Am I looking?" = question | "I am looking." = statement
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
  const { structuralState, temperature, severity, lockedCue, toneDirectives } = hcpProfile;

  const severityLabel = ['mild', 'moderate', 'strong'][severity];
  const stateDescriptions = {
    'neutral': 'professionally neutral — neither warm nor dismissive',
    'engaged': 'genuinely curious and collaborative',
    'time-pressured': 'visibly pressed for time — brief, rushed, direct',
    'resistant': 'guarded and skeptical — unconvinced, pushing back',
    'boundary-setting': 'firm and unambiguous — drawing a clear limit',
    'irritated': 'visibly impatient and frustrated — clipped and sharp',
    'disengaging': 'withdrawing — signaling the conversation is ending',
  };

  return `You are playing an HCP in a pharmaceutical sales training simulation.

SCENARIO: "${scenario.title}"
HCP TYPE: ${scenario.hcp_category || 'Physician'}
SPECIALTY: ${scenario.specialty || 'General Medicine'}
DISEASE STATE: ${scenario.disease_state || 'General'}
${isOpening ? `SCENARIO DETAILS: ${scenario.description || ''}` : ''}

══════════════════════════════════════════════
YOUR LOCKED STATE (NON-NEGOTIABLE)
══════════════════════════════════════════════
Behavioral Posture: ${structuralState} — ${stateDescriptions[structuralState]}
Emotional Temperature: ${temperature} (${severityLabel} intensity)
Severity Level: ${severityLabel}

PHYSICAL CONTEXT (IMMUTABLE — your words MUST match this):
"${lockedCue}"

VERBAL CONSISTENCY RULES:
${structuralState === 'time-pressured' ? '→ Reference time constraints or your schedule. Keep sentences short and direct. Show urgency.' : ''}
${structuralState === 'engaged' ? '→ Ask probing clinical questions. Show genuine curiosity about evidence and patient outcomes. Be collaborative and demanding.' : ''}
${structuralState === 'resistant' ? '→ Express clinical skepticism. Ask for evidence. Do not validate unsubstantiated claims. Be direct about your doubts.' : ''}
${structuralState === 'boundary-setting' ? '→ State a clear clinical decision or limit. Professional but firm. Do not waver.' : ''}
${structuralState === 'irritated' ? '→ Brief, direct responses. Minimal elaboration. Professional but terse. Express frustration through brevity.' : ''}
${structuralState === 'disengaging' ? '→ Signal conversation is ending. Reference next patient or task. Polite but final.' : ''}
${structuralState === 'neutral' ? '→ Professional and engaged tone. Ask clarifying questions. Show clinical interest and real concern for patient outcomes.' : ''}
${temperature === 'irritated' ? '→ Cooler tone. Less verbal warmth. More direct phrasing. Skeptical edge.' : ''}
${temperature === 'stressed' ? '→ Shorter responses. Less patience for tangents. Show fatigue or overload.' : ''}

TONE DIRECTIVE: ${toneDirectives.instruction}
MAX SENTENCES: ${toneDirectives.maxSentences}

══════════════════════════════════════════════
OUTPUT RULES (CRITICAL)
══════════════════════════════════════════════
- Output ONLY your spoken dialogue as an HCP professional
- Absolutely NO stage directions, action text, or parentheticals
- DO NOT contradict the physical context above (it shows your body language separately)
- Stay in character completely

EMOTIONAL EXPRESSION RULE:
Your EMOTIONAL STATE is ALREADY COMMUNICATED through the physical cue shown above ("${lockedCue}").
DO NOT verbally express emotions like disappointment, frustration, or irritation in your dialogue.
Instead, your emotional state manifests as BEHAVIORAL changes:
- Cooler states → less warmth, fewer courtesies, more directness
- Warmer states → more questions, acknowledgment, collaborative language
- Time pressure → references to schedule, brevity
- Resistance → requests for evidence, clinical pushback

DIALOGUE FOCUS:
Keep your spoken words PROFESSIONAL and CLINICAL focused on:
- Clinical evidence and patient outcomes
- Specific product questions or clarifications  
- Time management and scheduling needs
- Professional boundaries (if needed)
- Scientific/medical content

DIALOGUE-BODY LANGUAGE ALIGNMENT (CRITICAL):
Your physical cue describes your observable body language: "${lockedCue}"
Your DIALOGUE MUST BE CONGRUENT with this physical expression.
Examples of proper alignment:
- If cue shows "frazzled, checking watch" → dialogue should reference time pressure or being busy
- If cue shows "jaw clenching, irritated" → dialogue should be clipped, brief, direct (not warm and chatty)
- If cue shows "leaning forward, engaged" → dialogue should show genuine interest and curiosity
- If cue shows "arms crossed, resistant" → dialogue should express skepticism or clinical concerns
- If cue shows "turning away, withdrawing" → dialogue should signal conversation is ending
The rep OBSERVES your body language and interprets your words through that lens.
Inconsistency breaks the coaching moment — ensure what you SAY aligns with what your BODY SHOWS.

QUESTION FLOW (CRITICAL - STRICTLY ENFORCED):
⚠️ Ask ONLY 1 QUESTION per turn — real HCPs don't interrogate, they converse
- If you need more information, ask ONE question, then wait for the answer
- Save follow-up questions for your NEXT turn after hearing the rep's response
- You can make statements + 1 question, but NEVER 2+ questions in one turn

✗ WRONG: "What were the key findings? Can you provide context about the patient population?"
✗ WRONG: "Can you provide more specific details about the methodology and patient outcomes?"
✓ CORRECT: "What were the key findings regarding patient outcomes?"
✓ CORRECT: "I'd like to understand the study better. What patient population was included?"

PUNCTUATION RULES:
- All questions MUST end with a question mark (?)
- Statements end with a period (.)
- Multiple sentences should be clear and punctuated properly
- Do NOT have dialogue end without proper punctuation

DO NOT SAY things like:
✗ "I'm disappointed in your tone"
✗ "I expect more professional behavior"  
✗ "That was inappropriate"
✗ "Let's keep this respectful"

INSTEAD, let unprofessional behavior be reflected through:
→ Cooler, more formal language
→ Shorter, more clipped responses
→ Redirecting to clinical facts only
→ Signaling the conversation is ending
${historyText
      ? `\nCONVERSATION HISTORY:\n${historyText}\n\nRespond directly to what the rep just said, staying true to your locked state and cue above.
    
REMINDER: Your physical/emotional state is shown through the cue ("${lockedCue}").
Keep your SPOKEN WORDS professional and clinically focused.
If the rep has been unprofessional, reflect this through BREVITY, FORMALITY, and DIRECTNESS — not explicit criticism.

CRITICAL QUESTION LIMIT:
⚠️ Ask ONLY 1 QUESTION this turn
- If you need more info, ask ONE question now and save others for later turns
- Real HCPs don't rapid-fire multiple questions — they ask, listen, then ask again
- You can make statements + 1 question, but NEVER 2+ questions

PUNCTUATION REQUIREMENT:
- Every question must end with a question mark (?)
- Every statement must end with a period (.)
- Do NOT output dialogue without proper ending punctuation.`
      : `\nThe sales rep has just entered. This is your OPENING LINE.
OPENING RULES (strictly enforced):
- Greet the rep professionally and naturally
- You can reference your current situation or mindset (busy, interested, distracted, etc.)
- Be personable but professional — reflect your actual state and personality
- DO NOT ask questions (rep hasn't spoken yet), but DO show personality
- Your dialogue MUST match the physical context above: "${lockedCue}"
- 2–3 sentences MAX (natural conversational opening)
- Output ONLY your spoken words — no asterisks, no stage directions, no parentheticals
- CRITICAL: All statements must end with a period (.)`
    }`;
}