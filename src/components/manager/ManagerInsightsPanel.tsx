import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, BrainCircuit, Loader2, Radar, ShieldAlert } from "lucide-react";
import { ENABLE_MANAGER_INSIGHTS, buildManagerExplainabilityNote, managerInsightsRequestSchema } from "./managerInsightsShared";
import type { ManagerInsightsRequest, ManagerInsightsResponse } from "./managerInsightsTypes";
import { MANAGER_MODEL_THRESHOLDS, getBehavioralMetricLabel } from "./managerPerformanceData.js";
import { formatMetricLabel, normalizeManagerInsightsResponse, normalizeManagerText } from "./managerMetricFormatting.js";

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

function Section({ icon: Icon, title, children }: { icon: typeof BrainCircuit; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-600" />
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function getScopeLabel(request: ManagerInsightsRequest) {
  if (request.repData) {
    return "Rep-specific";
  }

  if ((request.territoryData.repIds?.length ?? 0) <= 4) {
    return "Cluster-specific";
  }

  return "Territory-wide";
}

function buildMonitoringTargets(request: ManagerInsightsRequest) {
  if (request.repData && request.derivedMetrics) {
    return [
      `${getBehavioralMetricLabel(request.repData.improvementPriority)} ${request.repData.behavioralMetrics[request.repData.improvementPriority].score}/5 vs ${MANAGER_MODEL_THRESHOLDS.repMetricLow}/5 threshold`,
      `${formatMetricLabel("engagementScore")} ${request.derivedMetrics.engagementScore}/100 vs ${MANAGER_MODEL_THRESHOLDS.engagementRisk}/100 monitoring threshold`,
      `${formatMetricLabel("salesRiskScore")} ${request.derivedMetrics.salesRiskScore}/100 vs ${MANAGER_MODEL_THRESHOLDS.salesRiskHigh}/100 threshold`,
    ];
  }

  return [
    `${formatMetricLabel("avgEngagement")} ${request.territoryData.avgEngagement}/100 vs ${MANAGER_MODEL_THRESHOLDS.territoryEngagementRisk}/100 risk threshold`,
    `${request.territoryData.mostCommonCapabilityGap ? getBehavioralMetricLabel(request.territoryData.mostCommonCapabilityGap) : "capability coverage"} gap`,
    `${formatMetricLabel("territoryVolatility")} ${request.territoryData.territoryVolatility} vs ${MANAGER_MODEL_THRESHOLDS.volatilityModerate} threshold`,
  ];
}

function buildActionCards(data: ManagerInsightsResponse, request: ManagerInsightsRequest) {
  const monitoringTargets = buildMonitoringTargets(request);
  const scopeLabel = getScopeLabel(request);

  return data.recommendations.map((recommendation, index) => ({
    id: `${scopeLabel}-${index}-${recommendation.action}`,
    scopeLabel,
    primaryFinding: index === 0 ? data.summary : data.keyDrivers[index - 1] ?? data.keyDrivers[0] ?? data.summary,
    dataBasis: data.keyDrivers[index] ?? data.risks[index] ?? data.keyDrivers[0] ?? "No additional data basis available.",
    recommendedAction: recommendation.action,
    expectedImpact: recommendation.expectedImpact,
    monitorNext: monitoringTargets[index] ?? monitoringTargets[monitoringTargets.length - 1] ?? "Monitor the next scheduled metric refresh.",
  }));
}

export default function ManagerInsightsPanel({ analyticsData, title, subtitle }: ManagerInsightsPanelProps) {
  const [data, setData] = useState<ManagerInsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const requestBody = useMemo(() => {
    const parsed = managerInsightsRequestSchema.safeParse(analyticsData);
    return parsed.success ? (parsed.data as ManagerInsightsRequest) : null;
  }, [analyticsData]);

  const requestSignature = useMemo(() => (requestBody ? JSON.stringify(requestBody) : ""), [requestBody]);
  const actionCards = useMemo(() => (data && requestBody ? buildActionCards(data, requestBody) : []), [data, requestBody]);

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
            {outlookTone[data.predictiveOutlook.performanceTrend].label} · {Math.round(data.predictiveOutlook.confidence * 100)}% predictive confidence
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
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="xl:col-span-2 rounded-2xl border border-teal-100 bg-teal-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Primary finding</p>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-800">{normalizeManagerText(data.summary)}</p>
          </div>

          <Section icon={Radar} title="Data basis">
            <ul className="space-y-2 text-sm text-slate-700">
              {data.keyDrivers.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-teal-500" />
                  <span>{normalizeManagerText(item)}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section icon={ShieldAlert} title="What to monitor next">
            <ul className="space-y-2 text-sm text-slate-700">
              {buildMonitoringTargets(requestBody).map((item) => (
                <li key={item} className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                  <span>{normalizeManagerText(item)}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section icon={BrainCircuit} title="Recommended action">
            <div className="space-y-3">
              {actionCards.map((card) => (
                <div key={card.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{card.scopeLabel}</p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">Operational view</span>
                  </div>
                  <div className="space-y-3 text-sm text-slate-700">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Primary finding</p>
                      <p>{normalizeManagerText(card.primaryFinding)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Data basis</p>
                      <p>{normalizeManagerText(card.dataBasis)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Recommended action</p>
                      <p className="font-semibold text-slate-900">{normalizeManagerText(card.recommendedAction)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Expected impact</p>
                      <p>{normalizeManagerText(card.expectedImpact)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">What to monitor next</p>
                      <p>{normalizeManagerText(card.monitorNext)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section icon={ArrowUpRight} title="Predictive outlook">
            <div className="space-y-3 text-sm text-slate-700">
              <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${outlookTone[data.predictiveOutlook.performanceTrend].badge}`}>
                {outlookTone[data.predictiveOutlook.performanceTrend].label}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Predictive confidence</p>
                <p className="text-lg font-bold text-slate-900">{Math.round(data.predictiveOutlook.confidence * 100)}%</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Reasoning</p>
                <p className="text-sm leading-6 text-slate-700">{normalizeManagerText(data.predictiveOutlook.reasoning)}</p>
              </div>
            </div>
          </Section>
        </div>
      ) : null}
    </section>
  );
}
