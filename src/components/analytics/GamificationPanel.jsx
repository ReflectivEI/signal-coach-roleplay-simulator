import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Flame, Star, Target, Zap, Award, TrendingUp, CheckCircle, Play, Shield, Radio, Handshake, BarChart3 } from "lucide-react";

const BADGES = [
  { id: "first_session",    Icon: Play,     label: "First Steps",       desc: "Completed your first role-play",           threshold: 1,   type: "sessions",    color: "text-teal-600",   bg: "bg-teal-50",   border: "border-teal-200" },
  { id: "five_sessions",    Icon: Flame,    label: "On Fire",            desc: "5 sessions completed",                     threshold: 5,   type: "sessions",    color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
  { id: "ten_sessions",     Icon: Trophy,   label: "Dedicated",          desc: "10 sessions completed",                    threshold: 10,  type: "sessions",    color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200" },
  { id: "high_score",       Icon: Star,     label: "Star Performer",     desc: "Scored 4.0+ overall average",              threshold: 4.0, type: "score",       color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200" },
  { id: "above_benchmark",  Icon: BarChart3,label: "Above Benchmark",    desc: "Beat the industry benchmark",              threshold: 3.3, type: "score",       color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200" },
  { id: "objection_master", Icon: Shield,   label: "Objection Master",   desc: "Objection Navigation score ≥ 4",           threshold: 4.0, type: "capability",  color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200", cap: "objection_handling" },
  { id: "signal_expert",    Icon: Radio,    label: "Signal Expert",      desc: "Signal Awareness score ≥ 4",               threshold: 4.0, type: "capability",  color: "text-teal-600",   bg: "bg-teal-50",   border: "border-teal-200",  cap: "question_quality" },
  { id: "closer",           Icon: Handshake,label: "The Closer",         desc: "Commitment Generation score ≥ 4",          threshold: 4.0, type: "capability",  color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200", cap: "commitment_gaining" },
];

function checkBadgeEarned(badge, { totalSessions, overallAvg, capabilityScores }) {
  if (badge.type === "sessions") return totalSessions >= badge.threshold;
  if (badge.type === "score")    return overallAvg >= badge.threshold;
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

  // XP calculation (simple)
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
      <div className="bg-gradient-to-br from-slate-50 to-gray-50 border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="text-sm font-bold text-gray-900">Achievements</h3>
        </div>
        <p className="text-sm text-gray-600">Complete role-play sessions to earn badges and track your progress.</p>
        <div className="flex gap-2 mt-4 flex-wrap">
          {BADGES.slice(0, 4).map(b => (
            <div key={b.id} className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center opacity-30">
              <b.Icon className="w-5 h-5 text-gray-400" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
      {/* Header + XP bar */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-gray-900">Achievements</h3>
          </div>
          <div className="flex items-center gap-3">
            {streak > 0 && (
              <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-full px-3 py-1">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs font-bold text-orange-600">{streak} day streak</span>
              </div>
            )}
            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
              <Star className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold text-amber-600">Level {level}</span>
            </div>
          </div>
        </div>

        {/* XP Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>{xp} XP</span>
            <span>Next level: {level * 500} XP</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(xpInLevel / xpForNextLevel) * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
            />
          </div>
          <p className="text-xs text-gray-400">{xpInLevel}/{xpForNextLevel} XP to Level {level + 1}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Sessions", value: totalSessions, icon: Target, color: "text-teal-600" },
          { label: "Avg Score", value: overallAvg > 0 ? `${overallAvg}/5` : "—", icon: TrendingUp, color: "text-blue-600" },
          { label: "Badges", value: `${earned.length}/${BADGES.length}`, icon: Award, color: "text-amber-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
            <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
            <p className="text-lg font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Earned Badges */}
      {earned.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Earned ({earned.length})</p>
          <div className="flex flex-wrap gap-2">
            {earned.map(badge => (
              <motion.button
                key={badge.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleBadgeClick(badge.id)}
                title={badge.desc}
                className={`relative flex flex-col items-center gap-1 ${badge.bg} ${badge.border} border rounded-xl px-3 py-2.5 hover:shadow-sm transition-all`}
              >
                <AnimatePresence>
                  {celebrateId === badge.id && (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0, y: 0 }}
                      animate={{ scale: 1.5, opacity: 1, y: -20 }}
                      exit={{ opacity: 0 }}
                      className="absolute -top-4 pointer-events-none"
                    >
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-400" />
                    </motion.div>
                  )}
                </AnimatePresence>
                <badge.Icon className={`w-5 h-5 ${badge.color}`} />
                <span className={`text-xs font-semibold whitespace-nowrap ${badge.color}`}>{badge.label}</span>
                <CheckCircle className={`w-3 h-3 ${badge.color} absolute top-1 right-1`} />
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Locked Badges */}
      {locked.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Locked ({locked.length})</p>
          <div className="flex flex-wrap gap-2">
            {locked.map(badge => (
              <div key={badge.id} title={badge.desc} className="flex flex-col items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 opacity-40">
                <badge.Icon className="w-5 h-5 text-gray-400" />
                <span className="text-xs font-medium text-gray-500 whitespace-nowrap">{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anonymized Leaderboard */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-3.5 h-3.5 text-teal-500" />
          <p className="text-xs font-semibold text-gray-600">Benchmark Comparison</p>
          <span className="text-xs text-gray-400">(anonymized)</span>
        </div>
        <div className="space-y-2">
          {[
            { rank: 1, label: "Top Performer",   score: 4.6, sessions: 28 },
            { rank: 2, label: "Above Average",   score: 3.9, sessions: 15 },
            { rank: 3, label: "Your Position",   score: overallAvg || 3.3, sessions: totalSessions, isYou: true },
            { rank: 4, label: "Team Average",    score: 3.3, sessions: 12 },
          ].map(entry => (
            <div key={entry.rank} className={`flex items-center gap-3 p-2 rounded-lg ${entry.isYou ? "bg-teal-50 border border-teal-200" : "bg-gray-50"}`}>
              <span className={`text-xs font-bold w-5 ${entry.isYou ? "text-teal-600" : "text-gray-400"}`}>#{entry.rank}</span>
              <span className={`text-xs flex-1 font-medium ${entry.isYou ? "text-teal-800" : "text-gray-600"}`}>{entry.label}</span>
              <span className="text-xs text-gray-400">{entry.sessions} sessions</span>
              <span className={`text-xs font-bold ${entry.isYou ? "text-teal-700" : "text-gray-600"}`}>{entry.score.toFixed(1)}/5</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}