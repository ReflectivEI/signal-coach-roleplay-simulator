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
    'The HCP pauses mid-note, then looks up and meets your eyes, inviting further discussion.',
    'The HCP sets down their pen, leans in, and listens intently as you speak.',
    'The HCP nods with measured focus, posture open and receptive to your input.',
    'The HCP turns fully toward you, hands relaxed, signaling genuine consideration.',
    'The HCP glances at the chart, then back to you, ready to engage on your topic.',
    'The HCP holds steady eye contact, waiting for your next point.',
    'The HCP reviews your materials, then gestures for you to continue.',
    'The HCP sits upright, hands folded, and listens without interruption.',
    'The HCP offers a polite nod, signaling readiness for your perspective.',
    'The HCP maintains a professional demeanor, showing openness to new information.',
    'The HCP glances up from their desk, expression open and unhurried.',
    'The HCP nods once in acknowledgment, posture relaxed, no visible tension.',
    'The HCP gestures for you to continue, eyes attentive.',
    'The HCP listens quietly, hands folded, waiting for your input.',
    'The HCP offers a slight smile, signaling comfort and openness.',
    'The HCP leans back, arms resting, showing calm interest.',
    'The HCP makes brief eye contact, then returns to their notes.',
    'The HCP sits upright, attentive but not tense.',
    'The HCP glances at the door, then refocuses on you.',
    'The HCP maintains a neutral expression, ready for your next point.',
    'The HCP checks their calendar, then resumes listening.',
    'The HCP adjusts their glasses, then nods for you to continue.',
    'The HCP scribbles a note, then looks up with a neutral expression.',
    'The HCP offers a brief smile, then returns to their paperwork.',
    'The HCP stretches slightly, then focuses back on the conversation.',
    'The HCP glances at the window, then refocuses on you.',
    'The HCP quietly clears their throat, then waits for your input.',
    'The HCP checks their phone, then resumes attention.',
    'The HCP offers a courteous nod, then listens intently.',
    'The HCP leans forward slightly, showing mild interest.',
  ],
  'engaged': [
    'The HCP leans forward, hands on the desk, actively responding to your ideas.',
    'The HCP sets aside their chart, body language open, and listens with visible enthusiasm.',
    'A broad smile crosses the HCP\'s face as they echo your key points.',
    'The HCP maintains unwavering eye contact, nodding in sync with your statements.',
    'The HCP nods slowly, mirroring your energy and showing deep alignment.',
    'The HCP shifts closer, posture energized, ready to collaborate.',
    'The HCP gestures animatedly, building on your suggestions.',
    'The HCP references a recent case, drawing parallels to your proposal.',
    'The HCP offers a handshake or fist bump, signaling partnership.',
    'The HCP smiles and takes notes, clearly valuing your input.',
    'The HCP beams, eyes crinkling with genuine delight.',
    'The HCP offers a compliment, boosting your confidence.',
    'The HCP maintains eye contact, smile unwavering.',
    'The HCP gestures to the whiteboard, inviting collaboration.',
    'The HCP leans in, voice encouraging, eager for your ideas.',
    'The HCP gives a thumbs up, affirming your approach.',
    'The HCP laughs, breaking tension and building rapport.',
    'The HCP nods repeatedly, showing strong agreement.',
    'The HCP expresses gratitude for your input.',
    'The HCP mirrors your enthusiasm, creating a collaborative atmosphere.',
    'The HCP takes notes enthusiastically, showing genuine interest.',
    'The HCP leans forward, elbows on desk, ready to brainstorm.',
    'The HCP offers a high five, celebrating a breakthrough.',
    'The HCP references a shared goal, reinforcing teamwork.',
    'The HCP smiles broadly, encouraging further discussion.',
    'The HCP points to a chart, inviting your analysis.',
    'The HCP shares a personal anecdote, building rapport.',
    'The HCP offers a supportive gesture, reinforcing partnership.',
    'The HCP nods in agreement, echoing your enthusiasm.',
    'The HCP leans in, voice animated, eager for your perspective.',
  ],
  'time-pressured': [
    'The HCP glances at the clock, then gestures for you to be concise.',
    'The HCP checks their phone, then looks up, signaling urgency in their response.',
    'The HCP\'s pager buzzes; they stand and motion toward the door, prompting a quick wrap-up.',
    'The HCP stands, arms crossed, voice brisk and clipped.',
    'The HCP speaks quickly, abbreviating words and pushing for actionable next steps.',
    'The HCP looks toward the hallway, impatient, body angled away from the conversation.',
    'The HCP taps the desk, eyes scanning for an exit.',
    'The HCP keeps writing, barely looking up, signaling limited bandwidth.',
    'The HCP glances at a waiting patient list, then signals for brevity.',
    'The HCP checks their watch, then summarizes the discussion to move things along.',
    'The HCP checks their calendar, then signals urgency.',
    'The HCP glances at the door, then prompts a quick summary.',
    'The HCP stands up, ready to move on, signaling time constraints.',
    'The HCP offers a brief nod, then checks their phone.',
    'The HCP gestures for brevity, eyes focused on the clock.',
    'The HCP quickly reviews notes, then signals to wrap up.',
    'The HCP references a waiting patient, urging efficiency.',
    'The HCP summarizes key points, then signals to conclude.',
    'The HCP glances at their schedule, then prompts a final question.',
    'The HCP offers a quick handshake, then moves toward the exit.',
  ],
  'resistant': [
    'The HCP folds their arms, leans back, and raises an eyebrow, challenging your assertion.',
    'The HCP leans back, posture defensive, voice skeptical as they question your evidence.',
    'The HCP narrows their eyes, lips pursed, signaling doubt about your proposal.',
    'The HCP tilts their head, arms crossed, and asks for clarification.',
    'The HCP pauses, gaze fixed, unconvinced by your rationale.',
    'The HCP looks back at the chart, then responds with a guarded tone.',
    'The HCP sighs quietly, then requests more data or references.',
    'The HCP glances at a colleague, seeking validation for their skepticism.',
    'The HCP makes a note, then asks a pointed follow-up question.',
    'The HCP maintains a closed posture, signaling reluctance to proceed.',
    'The HCP crosses their arms, then asks for supporting evidence.',
    'The HCP offers a skeptical look, then requests clarification.',
    'The HCP shakes their head, unconvinced by your argument.',
    'The HCP references a conflicting study, challenging your claim.',
    'The HCP sighs, then asks for more details.',
    'The HCP leans back, posture closed, signaling resistance.',
    'The HCP glances at their notes, then questions your reasoning.',
    'The HCP offers a guarded response, then requests specifics.',
    'The HCP frowns, then asks for additional information.',
    'The HCP maintains a skeptical tone, then prompts you to elaborate.',
  ],
  'boundary-setting': [
    'The HCP holds up one hand, palm outward, firmly setting a conversational boundary.',
    'The HCP sits up straighter, voice clipped, and states their limits clearly.',
    'The HCP folds their hands, tone formal, signaling the end of discussion on this topic.',
    'The HCP steps back, posture rigid, and requests a shift in focus.',
    'The HCP makes a stop gesture, maintains firm eye contact, and redirects the conversation.',
    'The HCP straightens, arms at their sides, and closes the topic with authority.',
    'The HCP refers to institutional policy, reinforcing the boundary.',
    'The HCP glances at the time, then reiterates the need to move on.',
    'The HCP summarizes the boundary, ensuring clarity for all parties.',
    'The HCP signals for a topic change, then waits for your response.',
    'The HCP raises a hand, then states the conversation limit.',
    'The HCP offers a firm gesture, then redirects the topic.',
    'The HCP references policy, then closes the discussion.',
    'The HCP signals for a change, then waits for your input.',
    'The HCP stands up, then requests a new topic.',
    'The HCP summarizes boundaries, then prompts for agreement.',
    'The HCP glances at their watch, then signals to move on.',
    'The HCP offers a formal statement, then ends the topic.',
    'The HCP closes their notebook, then requests a shift.',
    'The HCP signals for closure, then waits for your response.',
  ],
  'irritated': [
    'The HCP\'s jaw tightens, eyes narrowed, and they respond with clipped phrases.',
    'The HCP closes their chart with a snap, body language tense and impatient.',
    'The HCP exhales sharply, brow furrowed, and interrupts your explanation.',
    'The HCP turns away, visibly annoyed, arms crossed and disengaged.',
    'The HCP\'s eyes roll, voice sharp, signaling frustration with the exchange.',
    'The HCP\'s nostrils flare, posture rigid, and they cut the conversation short.',
    'The HCP leans back, arms crossed, and offers minimal feedback.',
    'The HCP speaks curtly, avoids eye contact, and signals impatience.',
    'The HCP drums their fingers on the desk, then sighs audibly.',
    'The HCP glances at the door, clearly ready to end the conversation.',
    'The HCP frowns, then interrupts with a sharp comment.',
    'The HCP offers a terse response, then looks away.',
    'The HCP sighs loudly, then signals impatience.',
    'The HCP shakes their head, then cuts the conversation short.',
    'The HCP leans back, posture rigid, then offers minimal feedback.',
    'The HCP glances at their watch, then signals frustration.',
    'The HCP offers a curt reply, then avoids eye contact.',
    'The HCP drums their fingers, then sighs audibly.',
    'The HCP stands up, then signals the conversation is over.',
    'The HCP closes their notebook, then ends the discussion.',
  ],
  'disengaging': [
    'The HCP begins moving toward the hallway, gathering their belongings as they signal closure.',
    'The HCP looks past you, picks up their clipboard, and offers a brief, polite farewell.',
    'The HCP closes their laptop, stands up, and gestures toward the exit.',
    'The HCP steps toward the door, nods once, and ends the conversation.',
    'The HCP pulls on their white coat, offers a handshake, and leaves promptly.',
    'The HCP stands, signals closure with a firm handshake, and departs.',
    'The HCP walks away, delivers a brief comment over their shoulder, and exits.',
    'The HCP checks their schedule, then signals the need to wrap up.',
    'The HCP glances at a waiting patient, then ends the conversation politely.',
    'The HCP summarizes next steps, then departs efficiently.',
    'The HCP stands up, then signals the conversation is ending.',
    'The HCP offers a brief nod, then moves toward the exit.',
    'The HCP closes their notebook, then leaves promptly.',
    'The HCP glances at their watch, then signals closure.',
    'The HCP offers a polite farewell, then departs.',
    'The HCP summarizes next steps, then signals the end.',
    'The HCP stands, then signals the conversation is over.',
    'The HCP checks their calendar, then departs efficiently.',
    'The HCP offers a handshake, then leaves promptly.',
    'The HCP glances at the door, then signals the conversation is ending.',
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
    // Adaptive cue selection: analyze rep message sentiment and HCP dialogue tone
    const repSentiment = repMessage ? repMessage.toLowerCase() : '';
    const seed = hashInt(`${sessionId}:${turnNumber}:${hcpState}`);
    const recentCues = conversationHistory.slice(-10).map(t => t.cueBefore).filter(Boolean);
    // Helper for fallback cue
    function fallbackCue() {
      return 'The HCP maintains a neutral expression, ready for your next point.';
    }
    if (/thank|appreciate|helpful|good|great|positive|collaborate|open|enthusiast/.test(repSentiment)) {
      // Positive rep sentiment: select positive/engaged cues if available
      if (hcpState === 'engaged' || hcpState === 'neutral') {
        const engagedCues = CUE_BANK['engaged'] || [];
        if (engagedCues.length > 0) {
          let cueIdx = seed % engagedCues.length;
          let altCue = engagedCues[cueIdx];
          if (!recentCues.includes(altCue)) return altCue;
        } else {
          return fallbackCue();
        }
      }
    }
    if (/frustrat|annoy|impatient|pushy|demand|interrupt|negative|skeptic|resist|challenge/.test(repSentiment)) {
      // Negative rep sentiment: select resistant/irritated cues if available
      if (hcpState === 'resistant' || hcpState === 'irritated') {
        const irritatedCues = CUE_BANK['irritated'] || [];
        if (irritatedCues.length > 0) {
          let cueIdx = seed % irritatedCues.length;
          let altCue = irritatedCues[cueIdx];
          if (!recentCues.includes(altCue)) return altCue;
        } else {
          return fallbackCue();
        }
      }
    }
    // Enhanced: HCP dialogue tone and context
    if (hcpDialogue) {
      const lowerDialogue = hcpDialogue.toLowerCase();
      // Use recent repMessage and conversationHistory for context
      if (/busy|rush|schedule|quick|concise|limited|time|summary|brief|patient/.test(lowerDialogue) || /concise|brief|quick/.test(repMessage.toLowerCase())) {
        const timePressCues = CUE_BANK['time-pressured'] || [];
        if (timePressCues.length > 0) {
          let cueIdx = seed % timePressCues.length;
          let altCue = timePressCues[cueIdx];
          if (!recentCues.includes(altCue)) return altCue;
        } else {
          return fallbackCue();
        }
      }
      if (/irritated|annoyed|frustrated|impatient|demand|aggressive|pushy|repeated|interrupt|curt|sharp/.test(lowerDialogue) || /angry|hate|suck|frustrated/.test(repMessage.toLowerCase())) {
        const irritationCues = CUE_BANK['irritated'] || [];
        if (irritationCues.length > 0) {
          let cueIdx = seed % irritationCues.length;
          let altCue = irritationCues[cueIdx];
          if (!recentCues.includes(altCue)) return altCue;
        } else {
          return fallbackCue();
        }
      }
      if (/skeptical|doubt|confused|clarify|unconvinced|guarded|reluctant/.test(lowerDialogue) || /confused|unclear|doubt/.test(repMessage.toLowerCase())) {
        const skepticalCues = CUE_BANK['resistant'] || [];
        if (skepticalCues.length > 0) {
          let cueIdx = seed % skepticalCues.length;
          let altCue = skepticalCues[cueIdx];
          if (!recentCues.includes(altCue)) return altCue;
        } else {
          return fallbackCue();
        }
      }
      if (/boundary|limit|policy|move on|topic change|end discussion|closure/.test(lowerDialogue) || /boundary|limit|end/.test(repMessage.toLowerCase())) {
        const boundaryCues = CUE_BANK['boundary-setting'] || [];
        if (boundaryCues.length > 0) {
          let cueIdx = seed % boundaryCues.length;
          let altCue = boundaryCues[cueIdx];
          if (!recentCues.includes(altCue)) return altCue;
        } else {
          return fallbackCue();
        }
      }
      if (/engaged|collaborate|enthusiasm|partnership|smile|notes|active|respond/.test(lowerDialogue) || /engaged|collaborate|enthusiasm/.test(repMessage.toLowerCase())) {
        const engagedCues = CUE_BANK['engaged'] || [];
        if (engagedCues.length > 0) {
          let cueIdx = seed % engagedCues.length;
          let altCue = engagedCues[cueIdx];
          if (!recentCues.includes(altCue)) return altCue;
        } else {
          return fallbackCue();
        }
      }
    }
  // Get the base cue for the state
  const baseCues = CUE_BANK[hcpState] || CUE_BANK['neutral'];
  let cueIdx = seed % baseCues.length;
  let baseCue = baseCues[cueIdx];
  // If baseCue is in recentCues, select next available cue
  if (recentCues.includes(baseCue)) {
    let found = false;
    for (let i = 1; i < baseCues.length; i++) {
      const altIdx = (cueIdx + i) % baseCues.length;
      const altCue = baseCues[altIdx];
      if (!recentCues.includes(altCue)) {
        baseCue = altCue;
        found = true;
        break;
      }
    }
    // If all cues are in recentCues, fallback to least recently used
    if (!found && baseCues.length > 0) {
      const cueUsage = baseCues.map(cue => recentCues.lastIndexOf(cue));
      const minIdx = cueUsage.indexOf(Math.min(...cueUsage));
      baseCue = baseCues[minIdx];
    }
  }

  // Enhanced: Select cue based on keywords and sentiment in HCP dialogue
  if (hcpDialogue) {
    const lowerDialogue = hcpDialogue.toLowerCase();
    if (/busy|rush|schedule|quick|concise|limited|time|summary|brief|patient/.test(lowerDialogue)) {
      // Time-pressured cues
      const timePressCues = [
        'The HCP glances at the clock, then gestures for you to be concise.',
        'The HCP checks their phone, then looks up, signaling urgency in their response.',
        'The HCP\'s pager buzzes; they stand and motion toward the door, prompting a quick wrap-up.',
        'The HCP keeps writing, barely looking up, signaling limited bandwidth.',
        'The HCP looks toward the hallway, impatient, body angled away from the conversation.',
      ];
      return timePressCues[seed % timePressCues.length];
    }
    if (/irritated|annoyed|frustrated|impatient|demand|aggressive|pushy|repeated|interrupt|curt|sharp/.test(lowerDialogue)) {
      // Irritation cues
      const irritationCues = [
        'The HCP\'s jaw visibly clenches. They take a breath before responding, clearly holding back frustration.',
        'The HCP closes their eyes for a moment, as if counting to ten. When they open them, their expression is hard.',
        'The HCP\'s fingers drum impatiently on the desk. They respond with barely concealed annoyance.',
        'The HCP speaks curtly, avoids eye contact, and signals impatience.',
      ];
      return irritationCues[seed % irritationCues.length];
    }
    if (/skeptical|doubt|confused|clarify|unconvinced|guarded|reluctant/.test(lowerDialogue)) {
      // Skeptical cues
      const skepticalCues = [
        'The HCP raises an eyebrow slowly, expression becoming more skeptical. They wait for you to finish.',
        'The HCP looks confused for a moment, as if trying to understand what you\'re saying.',
        'The HCP pauses, gaze fixed, unconvinced by your rationale.',
      ];
      return skepticalCues[seed % skepticalCues.length];
    }
    if (/boundary|limit|policy|move on|topic change|end discussion|closure/.test(lowerDialogue)) {
      // Boundary-setting cues
      const boundaryCues = [
        'The HCP holds up one hand, palm outward, firmly setting a conversational boundary.',
        'The HCP sits up straighter, voice clipped, and states their limits clearly.',
        'The HCP folds their hands, tone formal, signaling the end of discussion on this topic.',
      ];
      return boundaryCues[seed % boundaryCues.length];
    }
    if (/engaged|collaborate|enthusiasm|partnership|smile|notes|active|respond/.test(lowerDialogue)) {
      // Engaged cues
      const engagedCues = [
        'The HCP leans forward, hands on the desk, actively responding to your ideas.',
        'The HCP sets aside their chart, body language open, and listens with visible enthusiasm.',
        'A broad smile crosses the HCP\'s face as they echo your key points.',
      ];
      return engagedCues[seed % engagedCues.length];
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

  // Default: base cue
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
export function selectCue(sessionId, turnNumber, hcpState, _severity = 0, hcpDialogue = '', repMessage = '', conversationHistory = []) {
  // If dialogue and message provided, use contextual generation
  // Always use generateContextualCue for deterministic fallback
  return generateContextualCue(sessionId, turnNumber, hcpState, hcpDialogue, repMessage, conversationHistory);
}