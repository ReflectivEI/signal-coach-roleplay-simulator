import { useState } from "react";
import AppHeader from "@/components/layout/AppHeader";
import { SIGNAL_INTELLIGENCE_CAPABILITIES } from "@/lib/signalIntelligence";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, MessageSquare, Ear, Heart, Users, Shield, BarChart2, RefreshCw, Target } from "lucide-react";

// Icon map per capability
const CAP_ICONS = {
  question_quality: MessageSquare,
  listening_responsiveness: Ear,
  making_it_matter: Heart,
  customer_engagement_signals: Users,
  objection_navigation: Shield,
  conversation_control_structure: BarChart2,
  adaptability: RefreshCw,
  commitment_gaining: Target,
};

function CapabilityCard({ cap, index }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = CAP_ICONS[cap.id] || MessageSquare;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="rounded-2xl border transition-all duration-200 overflow-hidden hover:translate-y-[-6px] h-full flex flex-col"
      style={{
        background: expanded ? "hsl(174 40% 97%)" : "#fff",
        borderColor: "hsl(174 45% 32%)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
      }}
    >
      {/* Card header */}
      <div className="p-5 flex-1 min-h-[176px]">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "hsl(174 40% 93%)" }}>
            <Icon className="w-4 h-4" style={{ color: "hsl(174 55% 38%)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-800 leading-snug text-sm">{cap.capability}</h3>
            <p className="text-xs font-medium uppercase tracking-widest mt-0.5" style={{ color: "hsl(174 55% 42%)" }}>
              Measured by {cap.metric}
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-500 italic leading-relaxed">"{cap.blurb}"</p>
      </div>

      {/* Expand / collapse toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-2.5 border-t text-xs font-medium transition-colors mt-auto"
        style={{
          borderColor: expanded ? "hsl(174 40% 88%)" : "hsl(215 20% 93%)",
          color: expanded ? "hsl(174 55% 38%)" : "hsl(215 16% 47%)",
          background: expanded ? "hsl(174 40% 88%)" : "hsl(162 60% 92%)"
        }}
      >
        <span>{expanded ? "Collapse" : "View details"}</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {/* Expanded detail panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 py-5 border-t space-y-5" style={{ borderColor: "hsl(174 40% 88%)" }}>

              {/* Definition */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1.5 text-slate-500">Canonical Definition</p>
                <p className="text-sm text-slate-700 leading-relaxed">{cap.definition}</p>
              </div>

              {/* Effective + Watch signals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2 text-slate-600">Effective Signals</p>
                  <ul className="space-y-1.5">
                    {cap.whatGoodLooksLike.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "hsl(174 55% 42%)" }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2 text-amber-700">Signals to Watch</p>
                  <ul className="space-y-1.5">
                    {cap.whatToAvoid.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Capabilities() {
  return (
    <div className="min-h-screen font-inter" style={{ background: "#f8fafb" }}>
      <AppHeader maxWidthClassName="max-w-5xl" />

      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Page header — matches your reference site layout */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "hsl(174 55% 42%)" }}>
              Behavioral Metrics Reference
            </p>
            <h1 className="text-3xl font-bold text-slate-800 leading-tight mb-3">
              Signal Intelligence Capabilities
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Behavioral measurement definitions and source-of-truth criteria for the eight canonical Signal Intelligence capabilities.
            </p>
          </div>

          {/* Measurement guardrails card */}
          <div className="rounded-xl border-2 bg-white px-5 py-4 max-w-xs shrink-0" style={{ borderColor: "hsl(215 16% 47%)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1.5 text-slate-600">Measurement Guardrails</p>
            <p className="text-xs text-slate-700 leading-relaxed">
              Each capability is anchored to a diagnostic question and observable behaviors only. No scores, no rankings — behavior-based coaching only.
            </p>
          </div>
        </div>

        {/* Capabilities grid — 2 columns on md+ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SIGNAL_INTELLIGENCE_CAPABILITIES.map((cap, i) => (
            <CapabilityCard key={cap.id} cap={cap} index={i} />
          ))}
        </div>

      </div>
    </div>
  );
}
