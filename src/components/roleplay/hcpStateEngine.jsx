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
 */
const CUE_BANK = {
  'neutral': [
    'The HCP pauses at their desk, making brief eye contact, posture relaxed.',
    'The HCP sets down their pen and turns to face you, expression neutral.',
    'The HCP nods once in acknowledgment, showing no particular urgency or resistance.',
    'The HCP crosses their arms loosely, listening without visible enthusiasm or pushback.',
  ],
  'engaged': [
    'The HCP leans slightly forward, making sustained eye contact and nodding as you speak.',
    'The HCP sets aside their chart and turns fully toward you, expression attentive.',
    'The HCP asks a clarifying question mid-sentence, showing active interest in the topic.',
    'The HCP\'s body language opens — shoulders back, direct eye contact, a slight smile.',
  ],
  'time-pressured': [
    'The HCP glances at their watch mid-sentence. A nurse approaches with a patient file.',
    'The HCP is already walking toward a patient room. They slow down but don\'t stop.',
    'The HCP checks their phone, then looks up with a tight expression. The waiting room is full.',
    'The HCP\'s pager buzzes. They acknowledge you with a glance but their weight shifts toward the door.',
  ],
  'resistant': [
    'The HCP\'s expression tightens. They cross their arms and make limited eye contact.',
    'The HCP tilts their head, expression skeptical. They tap a finger on the desk slowly.',
    'The HCP exhales audibly and leans back in their chair, creating visible distance.',
    'The HCP\'s tone flattens. They give a short, noncommittal response and wait.',
  ],
  'boundary-setting': [
    'The HCP holds up one hand briefly — a clear physical stop signal — before speaking.',
    'The HCP takes a deliberate breath, straightens up, and establishes direct eye contact before responding.',
    'The HCP places their pen down and folds their hands. Their tone shifts to formal and measured.',
    'The HCP steps back slightly and faces you squarely, signaling a firm limit is being communicated.',
  ],
  'irritated': [
    'The HCP\'s jaw tightens. They look away briefly before responding with a clipped tone.',
    'The HCP closes their chart with a snap and turns to face you, expression sharp.',
    'The HCP exhales sharply through their nose, brow furrowed, eyes flat.',
    'The HCP\'s response is delivered while already turning away — the interaction is clearly wearing on them.',
  ],
  'disengaging': [
    'The HCP begins moving toward the hallway, glancing back over their shoulder to respond.',
    'The HCP looks past you to the waiting room and picks up their clipboard. The conversation is ending.',
    'The HCP closes their laptop and stands up. Their body language signals the interaction is over.',
    'The HCP takes a step toward the door, offering only a brief acknowledgment before reaching for the handle.',
  ],
};

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

export function selectCue(sessionId, turnNumber, hcpState) {
  const cues = CUE_BANK[hcpState] || CUE_BANK['neutral'];
  const seed = hashInt(`${sessionId}:${turnNumber}:${hcpState}`);
  return cues[seed % cues.length];
}