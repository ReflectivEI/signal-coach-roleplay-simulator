import React, { useState } from "react";
import { Sparkles, Loader2, ArrowRight, Play, BookOpen, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const priorityColor = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

export default function AIActionableInsights({ avgScores = [], totalSessions = 0, overallAvg = 0, streak = 0, earnedBadges = [] }) {
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
      const weakCapString = weakCapabilities.map(c => c.label).join(', ');
      const strongCapString = topCapabilities.map(c => c.label).join(', ');
      const prompt = `Sales coaching insights for ${totalSessions} sessions.\nWeakest areas: ${weakCapString || 'none'}\nStrongest areas: ${strongCapString || 'none'}\n\nProvide 3 specific, actionable coaching recommendations (1-2 sentences each).`;

      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 600 })
      });

      if (!res.ok) throw new Error('Failed to generate insights');
      const data = await res.json();
      let insightText = data.response || data.text || data.content || 'Unable to generate insights at this time.';
      // Strip markdown code blocks for clean display
      insightText = insightText.replace(/^```[\w]*\n?|\n?```$/g, '').trim();
      setInsights(insightText);
    } catch (err) {
      console.error('Insights generation error:', err);
      setInsights('Unable to generate insights at this time.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-5 space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-teal-400" />
        <h3 className="text-sm font-bold text-white">AI Actionable Insights</h3>
      </div>
      <button
        onClick={generate}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors border border-teal-500/30 rounded-full px-3 py-1 hover:bg-teal-500/10"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        {insights ? "Refresh" : "Generate Insights"}
      </button>

      {totalSessions === 0 && !insights && (
        <p className="text-xs text-slate-400 leading-relaxed">
          Complete role-play sessions to unlock personalized AI coaching recommendations based on your actual performance data.
        </p>
      )}

      {!insights && !loading && totalSessions > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Based on your {totalSessions} sessions, click above for targeted coaching.</p>
          {weakCapabilities.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Likely Focus Areas:</p>
              <div className="flex flex-wrap gap-2">
                {weakCapabilities.map(c => (
                  <div key={c.key} className="inline-flex items-center gap-2 text-sm border border-[#1A334D] bg-[#e6f7f7] text-[#1A334D] rounded-full px-3 py-1 hover:-translate-y-0.5 hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-white transition-all">
                    <span>{c.capability}</span>
                    <span className="text-orange-500 font-bold">{c.score}/5</span>
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
            <div key={i} className="rounded-lg border border-white/10 p-4 space-y-2">
              <div className="h-3 bg-white/10 rounded animate-pulse w-2/3" />
              <div className="h-2 bg-white/10 rounded animate-pulse w-full" />
              <div className="h-2 bg-white/10 rounded animate-pulse w-4/5" />
            </div>
          ))}
        </div>
      )}

      {insights && (
        <div className="space-y-3">
          {/* Overall note */}
          {insights.overall_coaching_note && (
            <div className="rounded-lg p-3" style={{ background: "#39ACAC18", border: "1px solid #39ACAC44" }}>
              <p className="text-xs text-teal-200 leading-relaxed">{insights.overall_coaching_note}</p>
            </div>
          )}

          {/* Individual insights */}
          {(insights.insights || []).map((insight, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-white leading-tight">{insight.title}</p>
                {insight.priority && (
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${priorityColor[insight.priority] || priorityColor.medium}`}>
                    {insight.priority}
                  </span>
                )}
              </div>
              {insight.capability && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#39ACAC22", color: "#39ACAC", border: "1px solid #39ACAC44" }}>
                  {insight.capability}
                </span>
              )}

              <div className="space-y-2 pt-1">
                {insight.behavior_change && (
                  <div>
                    <p className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-0.5">Behavior Change</p>
                    <p className="text-xs text-white/80 leading-relaxed">{insight.behavior_change}</p>
                  </div>
                )}
                {insight.practice && (
                  <div className="flex items-start gap-2 bg-white/5 rounded-lg p-2.5">
                    <Play className="w-3.5 h-3.5 text-teal-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-teal-300">Practice Next</p>
                      <p className="text-xs text-white/70 leading-relaxed">{insight.practice}</p>
                    </div>
                    <Link to={createPageUrl("RolePlaySimulator")} className="ml-auto flex-shrink-0">
                      <ArrowRight className="w-3.5 h-3.5 text-teal-500 hover:text-teal-300 transition-colors" />
                    </Link>
                  </div>
                )}
                {insight.module && (
                  <div className="flex items-start gap-2 bg-white/5 rounded-lg p-2.5">
                    <BookOpen className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-blue-300">Coaching Module</p>
                      <p className="text-xs text-white/70">{insight.module}</p>
                    </div>
                    <Link to={createPageUrl("CoachingModules")} className="ml-auto flex-shrink-0">
                      <ArrowRight className="w-3.5 h-3.5 text-blue-500 hover:text-blue-300 transition-colors" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
