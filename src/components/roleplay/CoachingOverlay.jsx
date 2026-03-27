import React, { useEffect, useState } from "react";
import { Lightbulb, X, TrendingDown, AlertTriangle } from "lucide-react";

/**
 * Deterministic coaching tips keyed by [hcpState][misalignmentType].
 * Each tip includes a short label + actionable suggestion.
 * No AI call — fully deterministic.
 */
const COACHING_TIPS = {
  'time-pressured': {
    default: {
      label: "Shorten your response",
      tip: "This HCP is pressed for time. Lead with your single most important point, then stop. Offer to follow up in writing.",
      suggestion: "Try: 'I know you're tight on time — one quick thing: [X]. I'll send details after.'",
    },
    'Response length did not adapt to observed time pressure': {
      label: "Response too long",
      tip: "Your message was too long for this time-pressured moment. Cut to the core ask immediately.",
      suggestion: "Aim for under 2 sentences. State your ask, then offer a follow-up.",
    },
    'Multiple asks made when HCP signaled time pressure': {
      label: "One ask only",
      tip: "Multiple asks overwhelm a busy HCP. Pick your single most valuable ask and drop the rest.",
      suggestion: "Try: 'If there's one thing I'd love — could we schedule 10 minutes next week?'",
    },
    'Demand language used while HCP signaled urgency': {
      label: "Avoid pressure words",
      tip: "Words like 'you need to' or 'now' backfire when HCP is already stressed.",
      suggestion: "Try: 'Whenever works for you — no rush at all.'",
    },
  },
  'resistant': {
    default: {
      label: "Acknowledge first",
      tip: "Resistance signals the HCP feels unheard. Acknowledge their concern before advancing any agenda.",
      suggestion: "Try: 'That's a fair concern — can I ask what's driving it?'",
    },
    'Concern/objection raised but not acknowledged before moving forward': {
      label: "You skipped the concern",
      tip: "The HCP raised a concern and it wasn't acknowledged. They noticed.",
      suggestion: "Name the concern explicitly: 'I heard your concern about [X] — let me address that directly.'",
    },
    'Repeated earlier claim without acknowledging resistance': {
      label: "Repeating doesn't work",
      tip: "Restating your position without addressing resistance signals you're not listening.",
      suggestion: "Pause. Reflect their concern back, then offer a new angle or evidence.",
    },
    'Advanced position without addressing observed objection': {
      label: "Objection wasn't resolved",
      tip: "You moved forward before the objection was resolved. The HCP registered that.",
      suggestion: "Try: 'Before I continue — I want to make sure I addressed your concern about [X].'",
    },
  },
  'boundary-setting': {
    default: {
      label: "Honor the boundary",
      tip: "A firm limit was set. Continuing past it will end the conversation.",
      suggestion: "Say: 'Understood — I won't go there. Can I ask about [alternative topic] instead?'",
    },
    'Advanced position without addressing observed objection': {
      label: "Boundary was set",
      tip: "The HCP drew a clear line. Acknowledging it explicitly is the only productive move.",
      suggestion: "Try: 'I hear that — I'll respect that completely. One different angle...'",
    },
  },
  'irritated': {
    default: {
      label: "De-escalate now",
      tip: "The HCP is visibly frustrated. Reduce your ask to zero and offer a clean exit.",
      suggestion: "Try: 'I appreciate your time — I'll follow up when it's a better moment.'",
    },
    'Extended response when HCP signaled withdrawal/irritation': {
      label: "Too long — they're leaving",
      tip: "Long responses worsen irritation. One sentence only.",
      suggestion: "Close the loop: 'Understood — I'll reach out when timing is better.'",
    },
    'Defensive response escalated when de-escalation was required': {
      label: "Don't defend yourself",
      tip: "Defending yourself now will end the interaction. Absorb the frustration.",
      suggestion: "Try: 'You're right — I should have been more aware of your time. I apologize.'",
    },
    'Engagement dropped but approach did not adjust': {
      label: "Approach not adjusted",
      tip: "Their engagement dropped and your approach didn't change. That gap is visible.",
      suggestion: "Slow down. Ask a single open question and let them direct the next beat.",
    },
  },
  'disengaging': {
    default: {
      label: "Close cleanly",
      tip: "The HCP is ending the interaction. Don't introduce anything new.",
      suggestion: "One concrete next step: 'Can I send you something brief to review at your convenience?'",
    },
    'Extended response when HCP signaled withdrawal/irritation': {
      label: "They're already leaving",
      tip: "A long response now will cost future access. Close with goodwill.",
      suggestion: "Try: 'Thanks for your time — I'll follow up via email.'",
    },
    'Engagement dropped but approach did not adjust': {
      label: "Missed the exit signal",
      tip: "They signaled they're done and you kept going. Recognize exit signals early.",
      suggestion: "Next time: if energy drops, ask 'Is now still a good time?' — and be ready to stop.",
    },
  },
  'engaged': {
    default: {
      label: "Build on their energy",
      tip: "They're engaged — this is your highest-value moment. Go deeper, not broader.",
      suggestion: "Ask a reciprocal question: 'You mentioned [X] — what's your experience been with that?'",
    },
    "Did not leverage or build on HCP's open engagement signal": {
      label: "Missed an open moment",
      tip: "The HCP was open and engaged — but you didn't build on it.",
      suggestion: "Try: 'You mentioned [X] — tell me more about how that plays out in your practice.'",
    },
    'Changed topic abruptly when HCP was engaged': {
      label: "Don't change the topic",
      tip: "Switching topics when they're engaged loses the momentum.",
      suggestion: "Stay with what they're interested in. Let them lead the thread.",
    },
  },
  'neutral': {
    default: {
      label: "Establish agenda",
      tip: "Set a clear agenda before introducing any value message.",
      suggestion: "Try: 'I had a quick question about [X] — does that fit with what you're seeing in practice?'",
    },
    'Value asserted before customer priorities were established': {
      label: "Value too early",
      tip: "You introduced value before understanding their priorities. It lands as a pitch, not a conversation.",
      suggestion: "Ask a grounding question first: 'What's top of mind for you with [disease state] right now?'",
    },
  },
};

const REPEAT_VARIATION_SUFFIXES = [
  "Use the HCP's exact wording in your first sentence.",
  "Keep your next reply to one operational point plus one follow-up question.",
  "Acknowledge first, then give one concrete clinic-level action.",
];

/**
 * Determine if a coaching overlay should trigger based on alignment + state transition.
 * Returns { shouldShow, tip, label, suggestion, severity } — fully deterministic.
 */
export function shouldTriggerCoaching(alignment, prevState, nextState) {
  if (!alignment) return { shouldShow: false };

  const HCP_STATES = ['neutral','engaged','time-pressured','resistant','boundary-setting','irritated','disengaging'];
  const prevIdx = HCP_STATES.indexOf(prevState);
  const nextIdx = HCP_STATES.indexOf(nextState);
  const escalationDelta = nextIdx - prevIdx;
  const criticalEscalation = escalationDelta >= 2;
  const anyEscalation = escalationDelta >= 1;

  const shouldShow = alignment.score <= 2 || criticalEscalation || (alignment.score <= 3 && anyEscalation && alignment.misalignments.length > 0);
  if (!shouldShow) return { shouldShow: false };

  const stateBank = COACHING_TIPS[nextState] || COACHING_TIPS['neutral'];
  let selected = null;

  // Find most specific matching tip
  if (alignment.misalignments.length > 0) {
    for (const m of alignment.misalignments) {
      if (stateBank[m]) { selected = stateBank[m]; break; }
    }
  }
  if (!selected) selected = stateBank.default;

  const severity = criticalEscalation ? 'critical' : alignment.score <= 2 ? 'warning' : 'info';
  const tipSignature = `${nextState}::${selected.label}::${selected.tip}`;
  let repeatCount = 0;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const previousSignature = window.sessionStorage.getItem('lastCoachingTipSignature') || '';
    const priorRepeatCount = Number(window.sessionStorage.getItem('lastCoachingTipRepeatCount') || 0);
    repeatCount = previousSignature === tipSignature ? priorRepeatCount + 1 : 0;
    window.sessionStorage.setItem('lastCoachingTipSignature', tipSignature);
    window.sessionStorage.setItem('lastCoachingTipRepeatCount', String(repeatCount));
  }
  const variationSuffix = repeatCount > 0
    ? REPEAT_VARIATION_SUFFIXES[(repeatCount - 1) % REPEAT_VARIATION_SUFFIXES.length]
    : null;
  const tipWithVariation = variationSuffix ? `${selected.tip} ${variationSuffix}` : selected.tip;

  return {
    shouldShow: true,
    label: selected.label,
    tip: tipWithVariation,
    suggestion: selected.suggestion,
    escalationLabel: criticalEscalation ? nextState.replace(/-/g, ' ') : null,
    severity,
  };
}

/**
 * Analyze patterns of misalignment across all turns in a session.
 * Returns a pattern summary for use in the end-session feedback prompt.
 */
export function analyzeSessionPatterns(turns) {
  const alignedTurns = turns.filter(t => t.alignment);
  if (alignedTurns.length === 0) return null;

  const scores = alignedTurns.map(t => t.alignment.score);
  const totalScore = scores.reduce((a, b) => a + b, 0);
  const overallAvg = Math.round((totalScore / scores.length) * 10) / 10;

  // Count misalignment frequency
  const misalignmentCounts = {};
  alignedTurns.forEach(t => {
    t.alignment.misalignments.forEach(m => {
      misalignmentCounts[m] = (misalignmentCounts[m] || 0) + 1;
    });
  });

  // Find repeated misalignments (2+ occurrences)
  const repeatedMisalignments = Object.entries(misalignmentCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));

  // Find state-specific patterns (states where alignment was consistently low)
  const stateScores = {};
  alignedTurns.forEach(t => {
    const state = t.hcpStateBefore;
    if (!stateScores[state]) stateScores[state] = [];
    stateScores[state].push(t.alignment.score);
  });

  const weakStates = Object.entries(stateScores)
    .map(([state, sc]) => ({ state, avg: sc.reduce((a,b)=>a+b,0)/sc.length, count: sc.length }))
    .filter(s => s.avg < 3 && s.count >= 1)
    .sort((a,b) => a.avg - b.avg);

  // Find turns with score <= 2 for transcript callouts
  const criticalTurns = alignedTurns
    .filter(t => t.alignment.score <= 2)
    .map(t => ({
      turnNumber: t.turnNumber,
      state: t.hcpStateBefore,
      score: t.alignment.score,
      misalignments: t.alignment.misalignments,
      repMessage: t.repMessage,
    }));

  return {
    overallAlignmentScore: overallAvg,
    totalTurns: alignedTurns.length,
    repeatedMisalignments,
    weakStates,
    criticalTurns,
    scoreDistribution: {
      high: scores.filter(s => s >= 4).length,
      mid: scores.filter(s => s === 3).length,
      low: scores.filter(s => s <= 2).length,
    },
  };
}

/**
 * CoachingOverlay — non-intrusive banner above the input.
 * Auto-dismisses after 9 seconds.
 */
export default function CoachingOverlay({ tip, label, suggestion, severity, escalationLabel, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!tip) { setVisible(false); return; }
    setVisible(true);
    const t = setTimeout(() => { setVisible(false); onDismiss?.(); }, 9000);
    return () => clearTimeout(t);
  }, [tip]);

  if (!visible || !tip) return null;

  const isCritical = severity === 'critical';
  const isWarning = severity === 'warning';

  const bgColor = isCritical ? 'bg-red-50 border-red-200' : isWarning ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200';
  const iconBg = isCritical ? 'bg-red-100' : isWarning ? 'bg-amber-100' : 'bg-blue-100';
  const iconColor = isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-blue-600';
  const titleColor = isCritical ? 'text-red-800' : isWarning ? 'text-amber-800' : 'text-blue-800';
  const textColor = isCritical ? 'text-red-700' : isWarning ? 'text-amber-700' : 'text-blue-700';
  const mutedColor = isCritical ? 'text-red-500' : isWarning ? 'text-amber-400' : 'text-blue-400';
  const Icon = isCritical ? AlertTriangle : isWarning ? TrendingDown : Lightbulb;

  return (
    <div className="mx-4 mb-2 animate-in slide-in-from-bottom-2 duration-300">
      <div className={`flex items-start gap-2.5 border rounded-xl px-3.5 py-2.5 shadow-sm ${bgColor}`}>
        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${iconBg}`}>
          <Icon className={`w-3 h-3 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-xs font-semibold ${titleColor}`}>
              {escalationLabel ? `⚡ Escalated to ${escalationLabel}` : label || 'Live Coaching'}
            </span>
          </div>
          <p className={`text-xs leading-relaxed ${textColor}`}>{tip}</p>
          {suggestion && (
            <p className={`text-xs mt-1 italic leading-relaxed opacity-80 ${textColor}`}>{suggestion}</p>
          )}
        </div>
        <button
          onClick={() => { setVisible(false); onDismiss?.(); }}
          className={`flex-shrink-0 mt-0.5 ${mutedColor} hover:opacity-80`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
