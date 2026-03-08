/**
 * HCP State Engine
 * Deterministic state management for role-play HCP behavior.
 * NO randomness. State transitions follow a strict ladder.
 */

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

/**
 * Derive initial HCP state from scenario metadata tags (title, description, hcp_category, difficulty).
 */
export function deriveInitialState(scenario) {
  const text = [
    scenario.title || '',
    scenario.description || '',
    scenario.details || '',
    scenario.hcp_category || '',
    scenario.influence_driver || '',
  ].join(' ').toLowerCase();

  if (/frustrat|overwhelm|busy|rush|no time|tight|slammed|hectic|pressed/.test(text)) {
    return 'time-pressured';
  }
  if (/resist|skeptic|doubt|won.t|not interested|disagree|pushback|challenge/.test(text)) {
    return 'resistant';
  }
  if (/hostile|angry|irritat|annoy|rude|dismissiv/.test(text)) {
    return 'irritated';
  }
  if (/engag|curio|interest|open|recept|enthusiast|new|innovative|data|evidence|clinical/.test(text)) {
    return 'engaged';
  }
  // Default to engaged instead of neutral — more interesting baseline for coaching
  return 'engaged';
}

/**
 * Deterministically transition state based on rep message content.
 * Returns new state string.
 */
export function transitionState(currentState, repMessage) {
  const msg = repMessage.toLowerCase();
  const idx = STATE_INDEX[currentState] ?? 0;

  // Escalate +2 for insults / competence attacks
  const hardEscalate = /bad doctor|incompetent|you don.t know|stupid|idiot|wrong about|you.re wrong|terrible|awful|you should|you must|you have to/.test(msg);
  if (hardEscalate) {
    return HCP_STATES[Math.min(idx + 2, HCP_STATES.length - 1)];
  }

  // Escalate +1 for pressure / repetition / demand language
  const softEscalate = /\bnow\b|immediately|just do it|you need to|i need you to|why won.t you|come on|seriously|stop|listen to me|i.m telling you|have you considered|don.t you think/.test(msg);
  if (softEscalate) {
    return HCP_STATES[Math.min(idx + 1, HCP_STATES.length - 1)];
  }

  // De-escalate -1 ONLY for strong acknowledgment + humility + respect of constraints
  // Much stricter threshold — don't de-escalate easily
  const strongDeEscalate = /absolutely i understand|i appreciate your time constraints|i hear your concern and that.s valid|i completely respect that|thank you for being direct with me|that.s a fair point/.test(msg);
  if (strongDeEscalate && idx > 0) {
    return HCP_STATES[Math.max(idx - 1, 0)];
  }

  // Stay in current state — don't default to dropping back
  return currentState;
}

/**
 * Get tone directives for HCP dialogue generation based on state.
 */
export function getToneDirectives(state) {
  const directives = {
    'neutral': {
      maxSentences: 3,
      tone: 'professional and composed',
      warmth: 'moderate',
      pacing: 'measured',
      instruction: 'Respond as a professional HCP would — engaged with the conversation, asking clarifying questions when needed. Professional but personable. Show genuine interest in clinical details. Reference your experience or patient outcomes.',
    },
    'engaged': {
      maxSentences: 3,
      tone: 'curious, collaborative, and professional',
      warmth: 'moderate-to-high',
      pacing: 'natural',
      instruction: 'Engage actively with the sales rep. Ask probing clinical questions. Show genuine curiosity about their evidence and clinical reasoning. Reference your patient population or practice context. Be collaborative but demanding of evidence.',
    },
    'time-pressured': {
      maxSentences: 2,
      tone: 'direct and clipped',
      warmth: 'low',
      pacing: 'fast',
      instruction: 'Be brief. Show you are busy — glance at watch, reference a patient, cut to the point. 1-2 sentences MAX. Do not elaborate.',
    },
    'resistant': {
      maxSentences: 2,
      tone: 'guarded and skeptical',
      warmth: 'low',
      pacing: 'deliberate',
      instruction: 'Push back on claims. Express doubt. Ask for evidence. Do not concede easily. Stay civil but clearly unconvinced.',
    },
    'boundary-setting': {
      maxSentences: 2,
      tone: 'firm and direct',
      warmth: 'none',
      pacing: 'deliberate',
      instruction: 'Explicitly set a limit. State what you will and will not discuss. Be unambiguous. No warmth. No apology.',
    },
    'irritated': {
      maxSentences: 1,
      tone: 'curt and visibly annoyed',
      warmth: 'none',
      pacing: 'abrupt',
      instruction: 'Respond with visible frustration. Be short and sharp. Make it clear this interaction is testing your patience. 1 sentence only.',
    },
    'disengaging': {
      maxSentences: 1,
      tone: 'withdrawn and closing',
      warmth: 'none',
      pacing: 'terminal',
      instruction: 'Signal that the conversation is ending. Reference needing to go see a patient, another meeting, or just turn and begin to leave. Make it clear you are done.',
    },
  };
  return directives[state] || directives['neutral'];
}

/**
 * Get the observable cue description for a given state.
 * These are varied, locked per turn, and derived deterministically.
 * seed = simple hash of sessionId + turnNumber + state.
 * 
 * ENHANCED: Cues now include specific body language that matches dialogue themes
 * (e.g., busy/frazzled, irritation, etc.) to provide observable signals rep can respond to.
 */

// Extended cue bank with more specific, contextualized body language
const CUE_BANK = {
  'neutral': [
    'The HCP pauses at their desk, making brief eye contact, posture relaxed.',
    'The HCP sets down their pen and turns to face you, expression neutral.',
    'The HCP nods once in acknowledgment, showing no particular urgency or resistance.',
    'The HCP crosses their arms loosely, listening without visible enthusiasm or pushback.',
    'The HCP leans back slightly in their chair, waiting for you to continue. Attentive but measured.',
    'The HCP\'s gaze is steady but unfocused — they\'re listening but reserving judgment.',
  ],
  'engaged': [
    'The HCP leans slightly forward, making sustained eye contact and nodding as you speak.',
    'The HCP sets aside their chart and turns fully toward you, expression attentive.',
    'The HCP asks a clarifying question mid-sentence, showing active interest in the topic.',
    'The HCP\'s body language opens — shoulders back, direct eye contact, a slight smile.',
    'The HCP leans forward with genuine interest, eyebrows slightly raised as they listen.',
    'The HCP nods actively and says "Tell me more" or similar, showing they\'re engaged.',
  ],
  'time-pressured': [
    'The HCP glances at their watch mid-sentence. A nurse approaches with a patient file.',
    'The HCP is already walking toward a patient room. They slow down but don\'t stop.',
    'The HCP checks their phone, then looks up with a tight expression. The waiting room is full.',
    'The HCP\'s pager buzzes. They acknowledge you with a glance but their weight shifts toward the door.',
    'The HCP looks frazzled — hair slightly disheveled, expression tense. They keep one eye on their computer screen.',
    'The HCP stands while speaking with you, clearly pressed for time. They shift their weight, ready to move at any moment.',
    'The HCP glances at the clock on the wall, then back at you with a tightness around their mouth.',
    'The HCP\'s shoulders are raised slightly with tension. They speak quickly, abbreviating words.',
  ],
  'resistant': [
    'The HCP\'s expression tightens. They cross their arms and make limited eye contact.',
    'The HCP tilts their head, expression skeptical. They tap a finger on the desk slowly.',
    'The HCP exhales audibly and leans back in their chair, creating visible distance.',
    'The HCP\'s tone flattens. They give a short, noncommittal response and wait.',
    'The HCP\'s jaw visibly tightens. They look away, then back at you with doubt in their eyes.',
    'The HCP maintains steady, challenging eye contact. Their mouth is set in a thin line.',
    'The HCP narrows their eyes slightly, expression hardening. They don\'t nod — they just listen.',
  ],
  'boundary-setting': [
    'The HCP holds up one hand briefly — a clear physical stop signal — before speaking.',
    'The HCP takes a deliberate breath, straightens up, and establishes direct eye contact before responding.',
    'The HCP places their pen down and folds their hands. Their tone shifts to formal and measured.',
    'The HCP steps back slightly and faces you squarely, signaling a firm limit is being communicated.',
    'The HCP sits up straighter, their posture now rigid. Their voice becomes clipped and precise.',
    'The HCP makes a subtle "stop" gesture with their hand while maintaining firm eye contact.',
  ],
  'irritated': [
    'The HCP\'s jaw tightens. They look away briefly before responding with a clipped tone.',
    'The HCP closes their chart with a snap and turns to face you, expression sharp.',
    'The HCP exhales sharply through their nose, brow furrowed, eyes flat.',
    'The HCP\'s response is delivered while already turning away — the interaction is clearly wearing on them.',
    'The HCP\'s eyes roll briefly before they answer. Their tone is visibly strained.',
    'The HCP\'s nostrils flare slightly. Their response comes faster, clipped. Clearly annoyed.',
    'The HCP leans back and crosses their arms tightly. Their expression is closed off and irritated.',
    'The HCP speaks while looking at their desk, not at you. Their tone is curt and dismissive.',
  ],
  'disengaging': [
    'The HCP begins moving toward the hallway, glancing back over their shoulder to respond.',
    'The HCP looks past you to the waiting room and picks up their clipboard. The conversation is ending.',
    'The HCP closes their laptop and stands up. Their body language signals the interaction is over.',
    'The HCP takes a step toward the door, offering only a brief acknowledgment before reaching for the handle.',
    'The HCP is already pulling on their white coat. They give you a polite but final nod.',
    'The HCP stands and extends their hand for a handshake that signals closure. They\'re done.',
    'The HCP begins walking away mid-conversation, offering a brief comment over their shoulder.',
  ],
};

/**
 * ENHANCED: Analyze the rep's recent question for quality issues.
 * Returns object with detected issues: { pushy, redundant, poorlyThoughtOut, demanding }
 * These help select cues that show HCP irritation or impatience.
 */
export function analyzeQuestionQuality(repMessage, conversationHistory = []) {
  if (!repMessage) return { pushy: false, redundant: false, poorlyThoughtOut: false, demanding: false };

  const msg = repMessage.toLowerCase().trim();

  // Detect pushy/demanding language
  const pushy = /now\b|immediately|just do it|you need to|i need you to|why won.t you|come on|seriously|stop|listen to me|i.m telling you|you must|you have to|you should/.test(msg);

  // Detect redundancy (same question asked multiple times)
  const lastThreeMsgs = conversationHistory.slice(-3).map(t => (t.repMessage || '').toLowerCase());
  const currentQ = msg.split(/[?!.]/, 1)[0]; // First sentence
  const redundant = lastThreeMsgs.some(prev => {
    if (!prev) return false;
    const prevQ = prev.split(/[?!.]/, 1)[0];
    return prevQ.length > 10 && currentQ.includes(prevQ.substring(0, 15));
  });

  // Detect poorly thought-out signals (vague, incomplete, disorganized)
  const poorlyThoughtOut = /uh|um|like|basically|i guess|i think|maybe|could you|would you|uh hmm/.test(msg) && msg.length < 30;

  // Detect demanding tone
  const demanding = /^(tell me|give me|explain|prove|answer|respond|stop|don't|don.t)/.test(msg);

  return { pushy, redundant, poorlyThoughtOut, demanding };
}

/**
 * ENHANCED: Generate a contextual cue that reacts to dialogue quality.
 * If rep's question is pushy/redundant/poorly thought out, HCP shows irritation/impatience.
 */
export function generateContextualCue(sessionId, turnNumber, hcpState, hcpDialogue = '', repMessage = '', conversationHistory = []) {
  // Get the base cue for the state
  const baseCues = CUE_BANK[hcpState] || CUE_BANK['neutral'];
  const seed = hashInt(`${sessionId}:${turnNumber}:${hcpState}`);
  const baseCue = baseCues[seed % baseCues.length];

  // Analyze dialogue for business-related cues
  if (hcpDialogue && hcpState === 'time-pressured') {
    const busyIndicators = /busy|rush|patient|meeting|waiting|tight|schedule|need to go|see you soon|later|quickly/.test(hcpDialogue.toLowerCase());
    if (busyIndicators) {
      // Add more frazzled body language cues
      const timePressCues = [
        baseCue, // Keep some randomness
        'The HCP looks visibly stressed, glancing repeatedly at their watch. Their leg bounces with restlessness.',
        'The HCP\'s speech quickens. They tap their fingers on the desk in a rapid rhythm, clearly anxious to move.',
        'The HCP maintains a polite facade but their eyes keep drifting to the door.',
      ];
      return timePressCues[seed % timePressCues.length];
    }
  }

  // Analyze question quality for irritation cues
  const questionQuality = analyzeQuestionQuality(repMessage, conversationHistory);
  if (hcpState === 'irritated') {
    if (questionQuality.pushy || questionQuality.redundant || questionQuality.demanding) {
      // Use more intense irritation cues
      const irritationCues = [
        'The HCP\'s jaw visibly clenches. They take a breath before responding, clearly holding back frustration.',
        'The HCP closes their eyes for a moment, as if counting to ten. When they open them, their expression is hard.',
        'The HCP\'s fingers drum impatiently on the desk. They respond with barely concealed annoyance.',
        baseCue,
      ];
      return irritationCues[seed % irritationCues.length];
    }
  }

  // For resistant state, if question is poorly thought out, add skeptical emphasis
  if (hcpState === 'resistant' && questionQuality.poorlyThoughtOut) {
    const skepticalCues = [
      'The HCP raises an eyebrow slowly, expression becoming more skeptical. They wait for you to finish.',
      'The HCP looks confused for a moment, as if trying to understand what you\'re saying.',
      baseCue,
    ];
    return skepticalCues[seed % skepticalCues.length];
  }

  // Default to base cue
  return baseCue;
}

/**
 * Simple deterministic hash for cue selection (no Math.random).
 */
function hashInt(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(h);
}

/**
 * Enhanced selectCue that can use contextual information for better body language matching.
 * Falls back to deterministic selection if context not provided.
 */
export function selectCue(sessionId, turnNumber, hcpState, severity = 0, hcpDialogue = '', repMessage = '', conversationHistory = []) {
  // If dialogue and message provided, use contextual generation
  if (hcpDialogue || repMessage) {
    return generateContextualCue(sessionId, turnNumber, hcpState, hcpDialogue, repMessage, conversationHistory);
  }

  // Fallback: deterministic selection from base cue bank
  const cues = CUE_BANK[hcpState] || CUE_BANK['neutral'];
  const seed = hashInt(`${sessionId}:${turnNumber}:${hcpState}`);
  return cues[seed % cues.length];
}