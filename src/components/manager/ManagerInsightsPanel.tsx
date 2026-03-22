import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BrainCircuit, Loader2 } from "lucide-react";
import { ENABLE_MANAGER_INSIGHTS, PREDICTIVE_CONFIDENCE_LABEL, buildBehavioralProfileContext, buildManagerExplainabilityNote, buildStructuredInsightView, managerInsightsRequestSchema } from "./managerInsightsShared";
import type { ManagerInsightsRequest, ManagerInsightsResponse } from "./managerInsightsTypes";
import { normalizeManagerInsightsResponse, normalizeManagerText } from "./managerMetricFormatting.js";
import BehavioralProfileGrid from "./BehavioralProfileGrid.jsx";

type ManagerInsightsPanelProps = {
  analyticsData: ManagerInsightsRequest;
  title: string;
  subtitle: string;
};

const outlookTone = {
  likely_improve: {
    badge: "bg-teal-50 text-teal-700 border-teal-200",
    label: "Likely improve",
  },
  at_risk: {
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    label: "At risk",
  },
  stable: {
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    label: "Stable",
  },
};

export default function ManagerInsightsPanel({ analyticsData, title, subtitle }: ManagerInsightsPanelProps) {
  const [data, setData] = useState<ManagerInsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const requestBody = useMemo(() => {
    const parsed = managerInsightsRequestSchema.safeParse(analyticsData);
    return parsed.success ? (parsed.data as ManagerInsightsRequest) : null;
  }, [analyticsData]);

  const requestSignature = useMemo(() => (requestBody ? JSON.stringify(requestBody) : ""), [requestBody]);
  const structuredInsight = useMemo(() => (requestBody ? buildStructuredInsightView(requestBody) : null), [requestBody]);
  const profileContext = useMemo(() => (requestBody ? buildBehavioralProfileContext(requestBody) : null), [requestBody]);

  useEffect(() => {
    if (!ENABLE_MANAGER_INSIGHTS || !requestBody || !requestSignature) {
      setData(null);
      setUnavailable(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setUnavailable(false);

    fetch("/manager-insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestSignature,
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`manager_insights_${response.status}`);
        }
        return response.json();
      })
      .then((payload: ManagerInsightsResponse) => {
        setData(normalizeManagerInsightsResponse(payload));
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          console.error("Manager insights unavailable:", error);
          setUnavailable(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [requestBody, requestSignature]);

  if (!ENABLE_MANAGER_INSIGHTS) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-slate-900 p-2 text-white">
              <BrainCircuit className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">Manager AI Insights</p>
              <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-500">{normalizeManagerText(subtitle)}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">{requestBody ? buildManagerExplainabilityNote(requestBody) : "Data Source: Rep + Territory Metrics"}</p>
        </div>
        {data && (
          <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${outlookTone[data.predictiveOutlook.performanceTrend].badge}`}>
            <ArrowUpRight className="mr-1 h-3.5 w-3.5" />
            {outlookTone[data.predictiveOutlook.performanceTrend].label} · {Math.round(data.predictiveOutlook.confidence * 100)}/100 {PREDICTIVE_CONFIDENCE_LABEL.toLowerCase()}
          </div>
        )}
      </div>

      {loading && !data ? (
        <div className="flex min-h-[160px] items-center justify-center text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating explainable coaching insights…
        </div>
      ) : unavailable && !data ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          Manager insights are temporarily unavailable. The rest of Manager View remains fully usable.
        </div>
      ) : data && requestBody ? (
        <div className="mt-5 space-y-4">
          {profileContext ? (
            <BehavioralProfileGrid
              metricSource={profileContext.metricSource}
              strongestKey={profileContext.strongestKey}
              weakestKey={profileContext.weakestKey}
              title={profileContext.title}
              subtitle={profileContext.subtitle}
            />
          ) : null}

          {structuredInsight ? (
            <div className="rounded-2xl border border-teal-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">AI insight</p>
                  <p className="mt-1 text-sm text-slate-500">One canonical coaching block per context with required thresholds and scales.</p>
                </div>
                <div className="space-y-2 text-right">
                  <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${outlookTone[data.predictiveOutlook.performanceTrend].badge}`}>
                    <ArrowUpRight className="mr-1 h-3.5 w-3.5" />
                    {outlookTone[data.predictiveOutlook.performanceTrend].label}
                  </div>
                  <p className="text-xs font-semibold text-slate-500">Predictive Confidence {Math.round(data.predictiveOutlook.confidence * 100)}/100 scale</p>
                  <p className="text-[11px] text-slate-500">{PREDICTIVE_CONFIDENCE_LABEL}</p>
                </div>
              </div>

              <div className="space-y-4 text-sm text-slate-700">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primary finding</p>
                  <p className="mt-1 font-medium text-slate-900">{normalizeManagerText(structuredInsight.primaryFinding)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why it matters</p>
                  <p className="mt-1">{normalizeManagerText(structuredInsight.whyItMatters)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Action</p>
                  <p className="mt-1 font-medium text-slate-900">{normalizeManagerText(structuredInsight.action)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monitor</p>
                  <ul className="mt-2 space-y-2">
                    {structuredInsight.monitor.map((item) => (
                      <li key={item} className="rounded-xl bg-slate-50 px-3 py-2">
                        {normalizeManagerText(item)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
