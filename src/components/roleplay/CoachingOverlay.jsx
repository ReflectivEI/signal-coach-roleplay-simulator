import React, { useEffect, useState } from "react";
import { Lightbulb, X, TrendingDown, AlertTriangle } from "lucide-react";

export { shouldTriggerCoaching } from "./inlineCoachingDecision";

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

  const misalignmentCounts = {};
  alignedTurns.forEach(t => {
    t.alignment.misalignments.forEach(m => {
      misalignmentCounts[m] = (misalignmentCounts[m] || 0) + 1;
    });
  });

  const repeatedMisalignments = Object.entries(misalignmentCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));

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
 * CoachingOverlay - non-intrusive banner above the input.
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
