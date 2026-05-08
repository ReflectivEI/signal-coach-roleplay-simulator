const COACHING_TIPS = {
  'time-pressured': {
    default: {
      label: 'Shorten your response',
      tip: 'This HCP is pressed for time. Lead with your single most important point, then stop. Offer to follow up in writing.',
      suggestion: "Try: 'I know you're tight on time - one quick thing: [X]. I'll send details after.'",
    },
    'Response length did not adapt to observed time pressure': {
      label: 'Response too long',
      tip: 'Your message was too long for this time-pressured moment. Cut to the core ask immediately.',
      suggestion: 'Aim for under 2 sentences. State your ask, then offer a follow-up.',
    },
    'Multiple asks made when HCP signaled time pressure': {
      label: 'One ask only',
      tip: 'Multiple asks overwhelm a busy HCP. Pick your single most valuable ask and drop the rest.',
      suggestion: "Try: 'If there's one thing I'd love - could we schedule 10 minutes next week?'",
    },
    'Demand language used while HCP signaled urgency': {
      label: 'Avoid pressure words',
      tip: "Words like 'you need to' or 'now' backfire when HCP is already stressed.",
      suggestion: "Try: 'Whenever works for you - no rush at all.'",
    },
  },
  resistant: {
    default: {
      label: 'Acknowledge first',
      tip: 'Resistance signals the HCP feels unheard. Acknowledge their concern before advancing any agenda.',
      suggestion: "Try: 'That's a fair concern - can I ask what's driving it?'",
    },
    'Concern/objection raised but not acknowledged before moving forward': {
      label: 'You skipped the concern',
      tip: "The HCP raised a concern and it wasn't acknowledged. They noticed.",
      suggestion: "Name the concern explicitly: 'I heard your concern about [X] - let me address that directly.'",
    },
    'Repeated earlier claim without acknowledging resistance': {
      label: "Repeating doesn't work",
      tip: "Restating your position without addressing resistance signals you're not listening.",
      suggestion: 'Pause. Reflect their concern back, then offer a new angle or evidence.',
    },
    'Advanced position without addressing observed objection': {
      label: "Objection wasn't resolved",
      tip: 'You moved forward before the objection was resolved. The HCP registered that.',
      suggestion: "Try: 'Before I continue - I want to make sure I addressed your concern about [X].'",
    },
  },
  'boundary-setting': {
    default: {
      label: 'Honor the boundary',
      tip: 'A firm limit was set. Continuing past it will end the conversation.',
      suggestion: "Say: 'Understood - I won't go there. Can I ask about [alternative topic] instead?'",
    },
    'Advanced position without addressing observed objection': {
      label: 'Boundary was set',
      tip: 'The HCP drew a clear line. Acknowledging it explicitly is the only productive move.',
      suggestion: "Try: 'I hear that - I'll respect that completely. One different angle...'",
    },
  },
  irritated: {
    default: {
      label: 'De-escalate now',
      tip: 'The HCP is visibly frustrated. Reduce your ask to zero and offer a clean exit.',
      suggestion: "Try: 'I appreciate your time - I'll follow up when it's a better moment.'",
    },
    'Extended response when HCP signaled withdrawal/irritation': {
      label: "Too long - they're leaving",
      tip: 'Long responses worsen irritation. One sentence only.',
      suggestion: "Close the loop: 'Understood - I'll reach out when timing is better.'",
    },
    'Defensive response escalated when de-escalation was required': {
      label: "Don't defend yourself",
      tip: 'Defending yourself now will end the interaction. Absorb the frustration.',
      suggestion: "Try: 'You're right - I should have been more aware of your time. I apologize.'",
    },
    'Engagement dropped but approach did not adjust': {
      label: 'Approach not adjusted',
      tip: "Their engagement dropped and your approach didn't change. That gap is visible.",
      suggestion: 'Slow down. Ask a single open question and let them direct the next beat.',
    },
  },
  disengaging: {
    default: {
      label: 'Close cleanly',
      tip: "The HCP is ending the interaction. Don't introduce anything new.",
      suggestion: "One concrete next step: 'Can I send you something brief to review at your convenience?'",
    },
    'Extended response when HCP signaled withdrawal/irritation': {
      label: "They're already leaving",
      tip: 'A long response now will cost future access. Close with goodwill.',
      suggestion: "Try: 'Thanks for your time - I'll follow up via email.'",
    },
    'Engagement dropped but approach did not adjust': {
      label: 'Missed the exit signal',
      tip: "They signaled they're done and you kept going. Recognize exit signals early.",
      suggestion: "Next time: if energy drops, ask 'Is now still a good time?' - and be ready to stop.",
    },
  },
  engaged: {
    default: {
      label: 'Build on their energy',
      tip: "They're engaged - this is your highest-value moment. Go deeper, not broader.",
      suggestion: "Ask a reciprocal question: 'You mentioned [X] - what's your experience been with that?'",
    },
    "Did not leverage or build on HCP's open engagement signal": {
      label: 'Missed an open moment',
      tip: "The HCP was open and engaged - but you didn't build on it.",
      suggestion: "Try: 'You mentioned [X] - tell me more about how that plays out in your practice.'",
    },
    'Changed topic abruptly when HCP was engaged': {
      label: "Don't change the topic",
      tip: "Switching topics when they're engaged loses the momentum.",
      suggestion: "Stay with what they're interested in. Let them lead the thread.",
    },
  },
  neutral: {
    default: {
      label: 'Establish agenda',
      tip: 'Set a clear agenda before introducing any value message.',
      suggestion: "Try: 'I had a quick question about [X] - does that fit with what you're seeing in practice?'",
    },
    'Value asserted before customer priorities were established': {
      label: 'Value too early',
      tip: 'You introduced value before understanding their priorities. It lands as a pitch, not a conversation.',
      suggestion: "Ask a grounding question first: 'What's top of mind for you with [disease state] right now?'",
    },
  },
};

export function shouldTriggerCoaching(alignment, prevState, nextState) {
  if (!alignment) return { shouldShow: false };

  const HCP_STATES = ['neutral', 'engaged', 'time-pressured', 'resistant', 'boundary-setting', 'irritated', 'disengaging'];
  const prevIdx = HCP_STATES.indexOf(prevState);
  const nextIdx = HCP_STATES.indexOf(nextState);
  const escalationDelta = nextIdx - prevIdx;
  const criticalEscalation = escalationDelta >= 2;
  const anyEscalation = escalationDelta >= 1;

  const shouldShow = alignment.score <= 2
    || criticalEscalation
    || (alignment.score <= 3 && anyEscalation && alignment.misalignments.length > 0);
  if (!shouldShow) return { shouldShow: false };

  const stateBank = COACHING_TIPS[nextState] || COACHING_TIPS.neutral;
  let selected = null;

  if (alignment.misalignments.length > 0) {
    for (const misalignment of alignment.misalignments) {
      if (stateBank[misalignment]) {
        selected = stateBank[misalignment];
        break;
      }
    }
  }
  if (!selected) selected = stateBank.default;

  const severity = criticalEscalation ? 'critical' : alignment.score <= 2 ? 'warning' : 'info';

  return {
    shouldShow: true,
    label: selected.label,
    tip: selected.tip,
    suggestion: selected.suggestion,
    escalationLabel: criticalEscalation ? nextState.replace(/-/g, ' ') : null,
    severity,
  };
}
