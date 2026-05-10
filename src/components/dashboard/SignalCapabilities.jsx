import React, { useState } from "react";
import { X, Radio, TrendingUp, Lightbulb } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";
import { SIGNAL_CAPABILITIES } from "../roleplay/signalIntelligenceSOT";

const colorDot = {
  teal:   "bg-teal-500",
  blue:   "bg-blue-500",
  purple: "bg-purple-500",
  cyan:   "bg-cyan-400",
  orange: "bg-orange-500",
  indigo: "bg-indigo-500",
  pink:   "bg-pink-500",
  green:  "bg-green-500",
};

export default function SignalCapabilities() {
  const [open, setOpen] = useState(null);
  const cap = open ? SIGNAL_CAPABILITIES.find(c => c.id === open) : null;

  return (
    <>
      <div>
        <div className="mb-1 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center">
            <div className="w-3 h-3 border-2 border-teal-500 rounded-full" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Signal Intelligence Capabilities</h2>
        </div>
        <p className="text-xs text-gray-600 mb-1">8 core capabilities for sales excellence</p>
        <p className="text-xs text-gray-500 mb-5">
          Insights are based on observable interaction patterns. AI supports interpretation; humans decide responses.
        </p>
        <div className="space-y-1">
          {SIGNAL_CAPABILITIES.map((cap) => (
            <button
              key={cap.id}
              onClick={() => setOpen(cap.id)}
              className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-left transition-all duration-150 ease-in-out hover:-translate-y-[1px] hover:border-teal-300 hover:bg-teal-50/60 hover:shadow-md"
            >
              <div className={`h-2 w-2 flex-shrink-0 rounded-full ${colorDot[cap.color] || "bg-teal-500"}`} />
              <span
                className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm font-medium leading-snug text-[#1A334D] transition-colors hover:text-teal-700 ${
                  ["customer_engagement", "conversation_management"].includes(cap.id) ? "text-[0.92em] tracking-[-0.1px]" : ""
                }`}
              >
                {cap.label}
              </span>
              <span className="ml-3 flex-shrink-0 whitespace-nowrap text-right text-xs font-medium leading-snug text-gray-600 transition-colors hover:text-teal-700">{cap.measurement}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-center">
          <Link
            to={createPageUrl("BehavioralMetrics")}
            className="inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all duration-200 text-xs px-3 py-1 border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7]"
          >
            View full Behavioral Metrics →
          </Link>
        </div>
      </div>

      {/* Detail Modal */}
      {cap && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={() => setOpen(null)}
        >
          <div
            className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl"
            style={{ background: "#1A334D", color: "white" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 pb-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "#39ACAC22", border: "1px solid #39ACAC55" }}
                >
                  <div className="w-5 h-5 border-2 rounded-full" style={{ borderColor: "#39ACAC" }} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">{cap.measurement}</h3>
                  <p className="text-sm mt-0.5" style={{ color: "#39ACAC" }}>{cap.label}</p>
                  <p className="text-xs mt-1 text-white/70 leading-snug">{cap.definition}</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-white/10 transition-colors"
                style={{ border: "1px solid #39ACAC55" }}
              >
                <X className="w-4 h-4" style={{ color: "#39ACAC" }} />
              </button>
            </div>

            <div className="px-5 pb-6 space-y-5">
              {/* Observable Sub-Metrics */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Radio className="w-4 h-4" style={{ color: "#39ACAC" }} />
                  <span className="text-sm font-bold text-white">Observable Sub-Metrics</span>
                </div>
                <div className="space-y-1.5">
                  {cap.coreMetrics.map(m => (
                    <div key={m.id} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: "#39ACAC" }} />
                      <span className="text-sm text-white/80">{m.name}</span>
                    </div>
                  ))}
                  {cap.optionalMetrics?.length > 0 && cap.optionalMetrics.map(m => (
                    <div key={m.id} className="flex items-start gap-2 opacity-70">
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 border" style={{ borderColor: "#39ACAC" }} />
                      <span className="text-sm text-white/60">{m.name} <span className="text-xs">(optional)</span></span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/10" />

              {/* Roll-Up Rule */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4" style={{ color: "#39ACAC" }} />
                  <span className="text-sm font-bold text-white">Roll-Up Rule</span>
                </div>
                <p className="text-sm text-white/75 leading-relaxed">{cap.canonical}</p>
              </div>

              <div className="border-t border-white/10" />

              {/* What It Measures */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded-full border-2 flex-shrink-0" style={{ borderColor: "#39ACAC" }} />
                  <span className="text-sm font-bold text-white">What It Measures</span>
                </div>
                <p className="text-sm text-white/75 leading-relaxed">
                  Observable sub-metrics: {cap.coreMetrics.map(m => m.name).join(", ").toLowerCase()}.
                </p>
              </div>

              <div className="border-t border-white/10" />

              {/* Coaching Insights */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4" style={{ color: "#39ACAC" }} />
                  <span className="text-sm font-bold text-white">Coaching Insights</span>
                </div>
                <div className="space-y-2">
                  {cap.coaching.map((tip, i) => (
                    <div
                      key={i}
                      className="text-sm text-white/80 rounded-lg px-4 py-3 leading-relaxed"
                      style={{ background: "#ffffff18" }}
                    >
                      {tip}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-center text-xs text-white/40 italic pt-2">
                Metrics reflect observable behaviors, not traits, intent, or personality.
              </p>

              <Link
                to={createPageUrl("BehavioralMetrics")}
                onClick={() => setOpen(null)}
                className="block text-center text-xs font-semibold py-2 rounded-lg transition-colors"
                style={{ color: "#39ACAC", border: "1px solid #39ACAC55" }}
              >
                Open full Behavioral Metrics →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
