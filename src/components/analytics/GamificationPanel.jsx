import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Flame, Star, Target, Zap, Award, TrendingUp, CheckCircle, Play, Shield, Radio, Handshake, BarChart3 } from "lucide-react";

const BADGES = [
  { id: "first_session", Icon: Play, label: "First Steps", desc: "Completed your first role-play", threshold: 1, type: "sessions", color: "text-teal-700", bg: "bg-teal-50", border: "border-teal-200" },
  { id: "five_sessions", Icon: Flame, label: "On Fire", desc: "5 sessions completed", threshold: 5, type: "sessions", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  { id: "ten_sessions", Icon: Trophy, label: "Dedicated", desc: "10 sessions completed", threshold: 10, type: "sessions", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  { id: "high_score", Icon: Star, label: "Star Performer", desc: "Scored 4.0+ overall average", threshold: 4.0, type: "score", color: "text-teal-700", bg: "bg-teal-50", border: "border-teal-200" },
  { id: "above_benchmark", Icon: BarChart3, label: "Above Benchmark", desc: "Beat the industry benchmark", threshold: 3.3, type: "score", color: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200" },
  { id: "objection_master", Icon: Shield, label: "Objection Master", desc: "Objection Navigation score ≥ 4", threshold: 4.0, type: "capability", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", cap: "objection_navigation" },
  { id: "signal_expert", Icon: Radio, label: "Signal Expert", desc: "Signal Awareness score ≥ 4", threshold: 4.0, type: "capability", color: "text-teal-700", bg: "bg-teal-50", border: "border-teal-200", cap: "signal_awareness" },
  { id: "closer", Icon: Handshake, label: "The Closer", desc: "Commitment Generation score ≥ 4", threshold: 4.0, type: "capability", color: "text-teal-700", bg: "bg-teal-50", border: "border-teal-200", cap: "commitment_generation" },
];

function checkBadgeEarned(badge, { totalSessions, overallAvg, capabilityScores }) {
  if (badge.type === "sessions") return totalSessions >= badge.threshold;
  if (badge.type === "score") return overallAvg >= badge.threshold;
  if (badge.type === "capability") {
    const score = capabilityScores?.[badge.cap] || 0;
    return score >= badge.threshold;
  }
  return false;
}

export default function GamificationPanel({ totalSessions = 0, overallAvg = 0, capabilityScores = {}, streak = 0 }) {
  const [celebrateId, setCelebrateId] = useState(null);

  const context = { totalSessions, overallAvg, capabilityScores };
  const earned = BADGES.filter(b => checkBadgeEarned(b, context));
  const locked = BADGES.filter(b => !checkBadgeEarned(b, context));

  const xp = (totalSessions * 50) + Math.round(overallAvg * 100) + (earned.length * 75);
  const level = Math.floor(xp / 500) + 1;
  const xpInLevel = xp % 500;
  const xpForNextLevel = 500;

  const handleBadgeClick = (id) => {
    setCelebrateId(id);
    setTimeout(() => setCelebrateId(null), 1500);
  };

  if (totalSessions === 0) {
    return (
      <div className="ui-surface-card border border-slate-200 p-6">
        <div className="mb-2 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-600" />
          <h3 className="text-sm font-bold text-slate-900">Achievements</h3>
        </div>
        <p className="text-sm leading-relaxed text-slate-600">Complete role-play sessions to earn badges and track your progress.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {BADGES.slice(0, 4).map(b => (
            <div key={b.id} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 opacity-40">
              <b.Icon className="h-5 w-5 text-slate-400" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ui-surface-card space-y-5 border border-slate-200 p-5">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">Achievements</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {streak > 0 && (
              <div className="ui-pill border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">
                <Flame className="h-3.5 w-3.5 text-amber-600" />
                <span>{streak} day streak</span>
              </div>
            )}
            <div className="ui-pill border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
              <Star className="h-3.5 w-3.5 text-amber-600" />
              <span>Level {level}</span>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-500">
            <span>{xp} XP</span>
            <span>Next level: {level * 500} XP</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(xpInLevel / xpForNextLevel) * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-2 rounded-full bg-gradient-to-r from-teal-500 to-teal-600"
            />
          </div>
          <p className="text-xs text-slate-500">{xpInLevel}/{xpForNextLevel} XP to Level {level + 1}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Sessions", value: totalSessions, icon: Target, color: "text-teal-700" },
          { label: "Avg Score", value: overallAvg > 0 ? `${overallAvg}/5` : "—", icon: TrendingUp, color: "text-slate-700" },
          { label: "Badges", value: `${earned.length}/${BADGES.length}`, icon: Award, color: "text-amber-700" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
            <Icon className={`mx-auto mb-1 h-4 w-4 ${color}`} />
            <p className="text-lg font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {earned.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Earned ({earned.length})</p>
          <div className="flex flex-wrap gap-2">
            {earned.map(badge => (
              <motion.button
                key={badge.id}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleBadgeClick(badge.id)}
                title={badge.desc}
                className={`relative flex flex-col items-center gap-1 rounded-2xl border px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:shadow-sm ${badge.bg} ${badge.border}`}
              >
                <AnimatePresence>
                  {celebrateId === badge.id && (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0, y: 0 }}
                      animate={{ scale: 1.4, opacity: 1, y: -20 }}
                      exit={{ opacity: 0 }}
                      className="absolute -top-4 pointer-events-none"
                    >
                      <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                    </motion.div>
                  )}
                </AnimatePresence>
                <badge.Icon className={`h-5 w-5 ${badge.color}`} />
                <span className={`whitespace-nowrap text-xs font-semibold ${badge.color}`}>{badge.label}</span>
                <CheckCircle className={`absolute right-1 top-1 h-3 w-3 ${badge.color}`} />
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {locked.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Locked ({locked.length})</p>
          <div className="flex flex-wrap gap-2">
            {locked.map(badge => (
              <div key={badge.id} title={badge.desc} className="flex flex-col items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 opacity-45">
                <badge.Icon className="h-5 w-5 text-slate-400" />
                <span className="whitespace-nowrap text-xs font-medium text-slate-500">{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-slate-100 pt-4">
        <div className="mb-3 flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-teal-600" />
          <p className="text-xs font-semibold text-slate-600">Benchmark Comparison</p>
          <span className="text-xs text-slate-400">(anonymized)</span>
        </div>
        <div className="space-y-2">
          {[
            { rank: 1, label: "Top Performer", score: 4.6, sessions: 28 },
            { rank: 2, label: "Above Average", score: 3.9, sessions: 15 },
            { rank: 3, label: "Your Position", score: overallAvg || 3.3, sessions: totalSessions, isYou: true },
            { rank: 4, label: "Team Average", score: 3.3, sessions: 12 },
          ].map(entry => (
            <div key={entry.rank} className={`flex items-center gap-3 rounded-xl p-2.5 ${entry.isYou ? "border border-teal-200 bg-teal-50" : "bg-slate-50"}`}>
              <span className={`w-5 text-xs font-bold ${entry.isYou ? "text-teal-700" : "text-slate-400"}`}>#{entry.rank}</span>
              <span className={`flex-1 text-xs font-medium ${entry.isYou ? "text-teal-900" : "text-slate-700"}`}>{entry.label}</span>
              <span className="text-xs text-slate-400">{entry.sessions} sessions</span>
              <span className={`text-xs font-bold ${entry.isYou ? "text-teal-800" : "text-slate-700"}`}>{entry.score.toFixed(1)}/5</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
