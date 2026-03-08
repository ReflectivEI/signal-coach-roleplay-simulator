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
  if (/engag|curio|interest|open|recept|enthusiast/.test(text)) {
    return 'engaged';
  }
  return 'neutral';
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
  const softEscalate = /\bnow\b|immediately|just do it|you need to|i need you to|why won.t you|come on|seriously|stop|listen to me|i.m telling you/.test(msg);
  if (softEscalate) {
    return HCP_STATES[Math.min(idx + 1, HCP_STATES.length - 1)];
  }

  // De-escalate -1 for acknowledgment / constraint recognition / alternative offer
  const deEscalate = /i understand|i hear you|makes sense|fair point|i appreciate|given your time|briefly|just one thing|when works for you|no pressure|whenever you.re ready|i can follow up|that.s helpful|thank you for sharing/.test(msg);
  if (deEscalate) {
    return HCP_STATES[Math.max(idx - 1, 0)];
  }

  return currentState;
}

/**
 * Get tone directives for HCP dialogue generation based on state.
 */
export function getToneDirectives(state) {
  const directives = {
    'neutral': {
      maxSentences: 3,
      tone: 'professional and measured',
      warmth: 'moderate',
      pacing: 'relaxed',
      instruction: 'Respond professionally. Neither warm nor cold. Open but not enthusiastic.',
    },
    'engaged': {
      maxSentences: 3,
      tone: 'curious and collaborative',
      warmth: 'high',
      pacing: 'comfortable',
      instruction: 'Show genuine interest. Ask a follow-up question or lean into the topic. Be collaborative.',
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
    'The HCP pauses mid-note and looks up.',
    'The HCP sets down their pen and listens.',
    'The HCP nods once, focused now.',
    'The HCP turns slightly toward you, considering.',
    'The HCP glances at the chart, then back to you.',
    'The HCP holds eye contact for a beat.',
  ],
  'engaged': [
    'The HCP leans forward slightly, interested.',
    'The HCP sets down their pen and listens.',
    'A brief smile crosses the HCP\'s face.',
    'The HCP maintains steady eye contact.',
    'The HCP nods slowly, considering your point.',
    'The HCP shifts closer, focused now.',
  ],
  'time-pressured': [
    'The HCP glances at the clock.',
    'The HCP checks their phone, then looks up.',
    'The HCP\'s pager buzzes; they shift toward the door.',
    'The HCP stands, ready to move.',
    'The HCP speaks quickly, abbreviating words.',
    'The HCP looks toward the hallway, impatient.',
    'The HCP taps the desk once, anxious.',
    'The HCP keeps writing, barely looking up.',
  ],
  'resistant': [
    'The HCP folds their arms, unconvinced.',
    'The HCP leans back slightly, skeptical.',
    'The HCP narrows their eyes.',
    'The HCP tilts their head, doubtful.',
    'The HCP pauses, unconvinced.',
    'The HCP looks back at the chart before answering.',
  ],
  'boundary-setting': [
    'The HCP holds up one hand, signaling stop.',
    'The HCP sits up straighter, voice clipped.',
    'The HCP folds their hands, tone formal.',
    'The HCP steps back, signaling a limit.',
    'The HCP makes a stop gesture, firm eye contact.',
    'The HCP straightens, posture rigid.',
  ],
  'irritated': [
    'The HCP\'s jaw tightens.',
    'The HCP closes their chart with a snap.',
    'The HCP exhales sharply, brow furrowed.',
    'The HCP turns away, visibly annoyed.',
    'The HCP\'s eyes roll briefly.',
    'The HCP\'s nostrils flare.',
    'The HCP leans back, arms crossed.',
    'The HCP speaks curtly, not looking at you.',
  ],
  'disengaging': [
    'The HCP begins moving toward the hallway.',
    'The HCP looks past you, picks up their clipboard.',
    'The HCP closes their laptop and stands up.',
    'The HCP steps toward the door, brief acknowledgment.',
    'The HCP pulls on their white coat, nods.',
    'The HCP stands, handshake signals closure.',
    'The HCP walks away, brief comment over shoulder.',
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