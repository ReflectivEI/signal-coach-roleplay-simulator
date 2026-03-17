import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Lightbulb, Heart, Users, ShieldAlert, GitFork, Target, Shuffle, ChevronDown, ChevronUp } from "lucide-react";
import { SIGNAL_CAPABILITIES } from "@/components/roleplay/signalIntelligenceSOT";

const iconMap = {
  signal_awareness: { icon: MessageSquare, iconBg: "bg-blue-50 text-blue-500" },
  signal_interpretation: { icon: Lightbulb, iconBg: "bg-yellow-50 text-yellow-600" },
  value_connection: { icon: Heart, iconBg: "bg-pink-50 text-pink-500" },
  customer_engagement: { icon: Users, iconBg: "bg-teal-50 text-teal-500" },
  objection_navigation: { icon: ShieldAlert, iconBg: "bg-orange-50 text-orange-500" },
  conversation_management: { icon: GitFork, iconBg: "bg-purple-50 text-purple-500" },
  adaptive_response: { icon: Shuffle, iconBg: "bg-cyan-50 text-cyan-500" },
  commitment_generation: { icon: Target, iconBg: "bg-green-50 text-green-500" },
};

const metrics = SIGNAL_CAPABILITIES.map(cap => ({
  id: cap.id,
  title: cap.label,
  measurement: cap.measurement,
  canonicalQuestion: cap.canonicalQuestion,
  description: cap.definition,
  icon: iconMap[cap.id]?.icon || Target,
  iconBg: iconMap[cap.id]?.iconBg || "bg-gray-50 text-gray-500",
  submetrics: cap.coreMetrics.map(m => ({ name: m.name, question: m.question })),
  optional: cap.optionalMetrics.map(m => ({ name: m.name, question: m.question })),
  coaching: cap.coaching,
  canonical: cap.canonical,
}));

export default function BehavioralMetrics() {
  const [selected, setSelected] = useState(null);
  const selectedMetric = metrics.find((m) => m.id === selected);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-50 to-teal-50/30 rounded-2xl p-8 mb-8 border border-gray-100">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Signal Intelligence Capabilities</h1>
        <p className="text-gray-500 mb-4">Behavioral Measurement Definitions & Source of Truth</p>
        <p className="text-sm text-gray-600 leading-relaxed max-w-3xl">
          8 canonical capabilities. Each is defined by a <strong>diagnostic question</strong>, measured by <strong>observable behavioral metrics</strong> scored 1–5 (where 3 = effective / acceptable). No metric infers intent, emotion, or outcome.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Metrics Grid */}
        <div className="lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {metrics.map((metric) => (
            <Card
              key={metric.title}
              className={`cursor-pointer transition-all duration-300 hover:shadow-md ${
                metric.highlight ? "border-teal-300 ring-1 ring-teal-100" : "hover:border-teal-200"
              } ${selected === metric.id ? "border-teal-500 shadow-lg ring-2 ring-teal-100" : ""}`}
              onClick={() => setSelected(selected === metric.id ? null : metric.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${metric.iconBg}`}>
                    <metric.icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-gray-900 leading-tight">{metric.title}</h3>
                    <p className="text-xs text-gray-400 truncate">{metric.measurement}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 italic leading-relaxed">"{metric.canonicalQuestion}"</p>
                {selected === metric.id ? (
                  <ChevronUp className="w-3.5 h-3.5 text-teal-400 mt-2 ml-auto" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-300 mt-2 ml-auto" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detail Panel */}
        <div className="lg:w-1/2">
          {!selectedMetric ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] border-2 border-dashed border-gray-200 rounded-2xl text-center p-8">
              <p className="text-sm text-gray-400">Select a capability to view its full definition, sub-metrics, scoring guidance, and coaching diagnostics.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5 sticky top-4">
              {/* Title */}
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedMetric.iconBg}`}>
                  <selectedMetric.icon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">{selectedMetric.title}</h2>
                  <p className="text-xs text-gray-500">Measured by: {selectedMetric.measurement}</p>
                </div>
              </div>

              {/* Definition */}
              <div>
                <p className="text-sm text-gray-700 leading-relaxed">{selectedMetric.description}</p>
              </div>

              {/* Core Sub-metrics */}
              <div>
                <div className="mb-2">
                  <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Core Metrics (Required)</span>
                </div>
                <div className="space-y-2">
                  {selectedMetric.submetrics.map((s, i) => (
                    <div key={i} className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-1 rounded-full bg-teal-500 text-white font-medium">Core</span>
                      </div>
                      <p className="text-xs font-semibold text-gray-800 mb-0.5">{s.name}</p>
                      <p className="text-xs text-gray-500 italic">{s.question}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Optional metrics */}
              {selectedMetric.optional?.length > 0 && (
                <div>
                  <div className="mb-2">
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Optional Expansion</span>
                  </div>
                  <div className="space-y-2">
                    {selectedMetric.optional.map((s, i) => (
                      <div key={i} className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-1 rounded-full bg-teal-50 text-teal-700 font-medium border border-teal-200">Optional</span>
                        </div>
                        <p className="text-xs font-semibold text-gray-600 mb-0.5">{s.name}</p>
                        <p className="text-xs text-gray-400 italic">{s.question}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coaching Diagnostics */}
              <div>
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide block mb-2">Coaching Diagnostics</span>
                <div className="space-y-1">
                  {selectedMetric.coaching.map((c, i) => (
                    <p key={i} className="text-xs text-gray-500 leading-relaxed">• {c}</p>
                  ))}
                </div>
              </div>

              {/* Canonical statement */}
              <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-teal-700 mb-1">Canonical Definition</p>
                <p className="text-xs text-gray-600 italic leading-relaxed">"{selectedMetric.canonical}"</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}