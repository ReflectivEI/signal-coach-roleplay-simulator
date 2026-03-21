// @ts-nocheck
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Lightbulb, Heart, Users, ShieldAlert, GitFork, Target, Shuffle, ChevronDown, ChevronUp } from "lucide-react";
import { SIGNAL_CAPABILITIES } from "@/components/roleplay/signalIntelligenceSOT";

const iconMap = {
  signal_awareness: { icon: MessageSquare, iconBg: "bg-slate-100 text-slate-700" },
  signal_interpretation: { icon: Lightbulb, iconBg: "bg-amber-50 text-amber-700" },
  value_connection: { icon: Heart, iconBg: "bg-teal-50 text-teal-700" },
  customer_engagement: { icon: Users, iconBg: "bg-teal-50 text-teal-700" },
  objection_navigation: { icon: ShieldAlert, iconBg: "bg-amber-50 text-amber-700" },
  conversation_management: { icon: GitFork, iconBg: "bg-slate-100 text-slate-700" },
  adaptive_response: { icon: Shuffle, iconBg: "bg-teal-50 text-teal-700" },
  commitment_generation: { icon: Target, iconBg: "bg-teal-50 text-teal-700" },
};

const metrics = SIGNAL_CAPABILITIES.map(cap => ({
  id: cap.id,
  title: cap.label,
  measurement: cap.measurement,
  canonicalQuestion: cap.canonicalQuestion,
  description: cap.definition,
  icon: iconMap[cap.id]?.icon || Target,
  iconBg: iconMap[cap.id]?.iconBg || "bg-slate-100 text-slate-700",
  submetrics: cap.coreMetrics.map(m => ({ name: m.name, question: m.question })),
  optional: cap.optionalMetrics.map(m => ({ name: m.name, question: m.question })),
  coaching: cap.coaching,
  canonical: cap.canonical,
}));

export default function BehavioralMetrics() {
  const [selected, setSelected] = useState(null);
  const selectedMetric = metrics.find((m) => m.id === selected);

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <div className="enterprise-hero-light mb-6 p-7 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Behavioral metrics reference</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight text-slate-900 md:text-4xl">Signal Intelligence Capabilities</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 md:text-[15px]">
              Behavioral measurement definitions and source-of-truth criteria for the eight canonical Signal Intelligence capabilities.
            </p>
          </div>
          <div className="ui-teal-surface w-full max-w-sm rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Measurement guardrails</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Each capability is anchored to a diagnostic question and observable metrics scored from 1–5, where 3 indicates effective and acceptable performance.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-[52%] xl:max-w-[54%]">
          {metrics.map((metric) => {
            const isSelected = selected === metric.id;
            return (
              <Card
                key={metric.title}
                className={`ui-surface-card ui-surface-card-interactive min-h-[196px] cursor-pointer border ${isSelected ? "border-teal-300 bg-teal-50/80 shadow-[0_18px_36px_rgba(15,118,110,0.12)]" : "border-teal-200 bg-white"}`}
                onClick={() => setSelected(isSelected ? null : metric.id)}
              >
                <CardContent className="flex h-full flex-col p-6">
                  <div className="flex h-full flex-col justify-between gap-4">
                    <div className="flex items-start gap-4 pt-1">
                      <div className="flex min-w-[92px] flex-col items-start gap-3 pt-2">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${metric.iconBg}`}>
                          <metric.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Measured by</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600">{metric.measurement}</p>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold leading-snug text-slate-900">{metric.title}</h3>
                        <p className="mt-3 text-sm leading-relaxed text-slate-600">“{metric.canonicalQuestion}”</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className={`ui-pill px-2.5 py-1 text-[11px] ${isSelected ? "ui-pill-active" : ""}`}>{isSelected ? "Expanded" : "View details"}</span>
                      {isSelected ? (
                        <ChevronUp className="h-4 w-4 text-teal-600" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex-1">
          {!selectedMetric ? (
            <div className="flex min-h-[320px] h-full items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center">
              <div className="max-w-sm">
                <p className="text-base font-semibold text-slate-700">Select a capability to inspect its measurement framework.</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">Definitions, core metrics, optional expansions, and coaching diagnostics will appear here.</p>
              </div>
            </div>
          ) : (
            <div className="ui-surface-card sticky top-4 space-y-5 border border-slate-200 p-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${selectedMetric.iconBg}`}>
                  <selectedMetric.icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold leading-tight text-slate-900">{selectedMetric.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">Measured by {selectedMetric.measurement}</p>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-slate-700">{selectedMetric.description}</p>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Core metrics</span>
                  <span className="ui-pill ui-pill-active px-2.5 py-1 text-[11px]">Required</span>
                </div>
                <div className="space-y-2.5">
                  {selectedMetric.submetrics.map((s, i) => (
                    <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold leading-snug text-slate-800">{s.name}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{s.question}</p>
                    </div>
                  ))}
                </div>
              </section>

              {selectedMetric.optional?.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Optional expansion</span>
                    <span className="ui-pill px-2.5 py-1 text-[11px]">Supplemental</span>
                  </div>
                  <div className="space-y-2.5">
                    {selectedMetric.optional.map((s, i) => (
                      <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-sm font-semibold leading-snug text-slate-700">{s.name}</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{s.question}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <span className="mb-3 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Coaching diagnostics</span>
                <ul className="ui-bullet-list text-sm leading-relaxed text-slate-600">
                  {selectedMetric.coaching.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </section>

              <div className="ui-teal-surface rounded-2xl p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Canonical definition</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">“{selectedMetric.canonical}”</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
