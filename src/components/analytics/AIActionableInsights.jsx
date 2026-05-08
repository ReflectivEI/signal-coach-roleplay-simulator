import React, { useState } from "react";
import { Sparkles, Loader2, ArrowRight, Play, BookOpen, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { buildFieldCoachingGrounding } from "@/lib/fieldCoachingGuidance";
import { describeSiScoreBand } from "@/lib/siEvaluationLanguage";

const priorityColor = {
  high: "border-amber-300 bg-amber-50 text-amber-800",
  medium: "border-teal-200 bg-teal-50 text-teal-700",
  low: "border-slate-200 bg-slate-50 text-slate-700",
};

export default function AIActionableInsights({ avgScores = [], totalSessions = 0, overallAvg = 0 }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);

  const weakCapabilities = avgScores
    .filter(c => c.score > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  const topCapabilities = avgScores
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const generate = async () => {
    setLoading(true);
    try {
      const weakCapString = weakCapabilities.map(c => `${c.label}: ${c.score}/5`).join(", ");
      const strongCapString = topCapabilities.map(c => `${c.label}: ${c.score}/5`).join(", ");
      const prompt = `Generate structured coaching insights from Signal Intelligence performance data.

${buildFieldCoachingGrounding({
        surface: "ai_actionable_insights",
        weakestAreas: weakCapabilities.map((capability) => capability.label || capability.capability),
        strongestAreas: topCapabilities.map((capability) => capability.label || capability.capability),
        customNotes: [`Total sessions: ${totalSessions}`, `Overall average: ${overallAvg}/5`],
      })}

DATA SNAPSHOT:
- Sessions analyzed: ${totalSessions}
- Overall average: ${overallAvg}/5
- Weakest areas: ${weakCapString || "none"}
- Strongest areas: ${strongCapString || "none"}

Return ONLY valid JSON with this schema:
{
  "overall_coaching_note": "1-2 sentence summary tied to the highest-priority SI pattern",
  "insights": [
    {
      "title": "Short title",
      "priority": "high" | "medium" | "low",
      "capability": "One or two canonical Signal Intelligence behavioral metrics",
      "behavior_change": "Specific behavior to change next",
      "practice": "Specific role-play or live-call practice move",
      "module": "Relevant module recommendation grounded in the observed metric"
    }
  ]
}

Rules:
- Keep all recommendations anchored in the canonical 8 behavioral metrics.
- Use the weakest areas as the primary coaching priorities unless strong-area leverage is strategically useful.
- No generic advice, filler, or invented data.
- Each insight must be directly usable in the next session or HCP interaction.`;

      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 600 })
      });

      if (!res.ok) throw new Error('Failed to generate insights');
      const data = await res.json();
      let insightText = data.response || data.text || data.content || 'Unable to generate insights at this time.';
      insightText = insightText.replace(/^```[\w]*\n?|\n?```$/g, '').trim();
      try {
        setInsights(JSON.parse(insightText));
      } catch {
        setInsights(insightText);
      }
    } catch (err) {
      console.error('Insights generation error:', err);
      setInsights('Unable to generate insights at this time.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ui-surface-card space-y-4 border border-slate-200 p-5 max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-teal-600" />
          <h3 className="text-sm font-bold text-slate-900">AI Actionable Insights</h3>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="ui-pill px-3 py-1.5 text-xs"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {insights ? 'Refresh insights' : 'Generate insights'}
        </button>
      </div>

      {totalSessions === 0 && !insights && (
        <p className="text-sm leading-relaxed text-slate-500">
          Complete role-play sessions to unlock personalized AI coaching recommendations based on your actual performance data.
        </p>
      )}

      {!insights && !loading && totalSessions > 0 && (
        <div className="space-y-2.5">
          <p className="text-sm text-slate-500">Based on your {totalSessions} sessions, generate targeted coaching recommendations.</p>
          {weakCapabilities.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Likely focus areas</p>
              <div className="flex flex-wrap gap-2">
                {weakCapabilities.map(c => (
                  <div key={c.key} className="ui-pill px-3 py-1.5">
                    <span>{c.capability}</span>
                    <span className="font-bold text-amber-700">{describeSiScoreBand(c.score).label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="h-2 w-full animate-pulse rounded bg-slate-200" />
              <div className="h-2 w-4/5 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      )}

      {insights && (
        <div className="space-y-3">
          {typeof insights === 'object' && insights.overall_coaching_note && (
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
              <p className="text-sm leading-relaxed text-teal-900">{insights.overall_coaching_note}</p>
            </div>
          )}

          {Array.isArray(insights?.insights) ? insights.insights.map((insight, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold leading-tight text-slate-900">{insight.title}</p>
                {insight.priority && (
                  <span className={`ui-pill px-2.5 py-1 text-[11px] ${priorityColor[insight.priority] || priorityColor.medium}`}>
                    {insight.priority}
                  </span>
                )}
              </div>
              {insight.capability && (
                <span className="ui-pill px-2.5 py-1 text-[11px]">{insight.capability}</span>
              )}
              <div className="space-y-2 pt-1">
                {insight.behavior_change && (
                  <div>
                    <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Behavior change</p>
                    <p className="text-sm leading-relaxed text-slate-600">{insight.behavior_change}</p>
                  </div>
                )}
                {insight.practice && (
                  <div className="flex items-start gap-2 rounded-2xl border border-teal-100 bg-teal-50/70 p-3">
                    <Play className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-teal-600" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Practice next</p>
                      <p className="text-xs leading-relaxed text-slate-600">{insight.practice}</p>
                    </div>
                    <Link to={createPageUrl("RolePlaySimulator")} className="ml-auto flex-shrink-0">
                      <ArrowRight className="h-3.5 w-3.5 text-teal-600 transition-colors hover:text-teal-700" />
                    </Link>
                  </div>
                )}
                {insight.module && (
                  <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <BookOpen className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-600" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Coaching module</p>
                      <p className="text-xs leading-relaxed text-slate-600">{insight.module}</p>
                    </div>
                    <Link to={createPageUrl("CoachingModules")} className="ml-auto flex-shrink-0">
                      <ArrowRight className="h-3.5 w-3.5 text-slate-600 transition-colors hover:text-teal-700" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4">
              <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{String(insights)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
