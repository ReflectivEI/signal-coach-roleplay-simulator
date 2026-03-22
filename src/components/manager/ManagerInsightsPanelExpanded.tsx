import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { AlertTriangle, ArrowUpRight, BrainCircuit, Loader2, Radar, ShieldAlert } from "lucide-react";
import { ENABLE_MANAGER_INSIGHTS, buildManagerExplainabilityNote, managerInsightsRequestSchema, managerInsightsResponseSchema } from "./managerInsightsShared";
import type { ManagerInsightsRequest, ManagerInsightsResponse } from "./managerInsightsTypes";
import { MANAGER_MODEL_THRESHOLDS, getBehavioralMetricLabel } from "./managerPerformanceData.js";
import { formatMetricLabel, normalizeManagerInsightsResponse, normalizeManagerText } from "./managerMetricFormatting.js";

const FILTERS = ["All", "Performance", "Behavior", "Engagement", "Territory"] as const;
const CONTEXT_CHIPS = [
  "New Rep",
  "Low Access Territory",
  "High Performer",
  "Inconsistent Performance",
  "Payer Heavy Region",
] as const;

type ManagerInsightsPanelExpandedProps = {
  data: ManagerInsightsRequest;
};

type InsightFilter = (typeof FILTERS)[number];
type Recommendation = ManagerInsightsResponse["recommendations"][number];

const outlookTone: Record<ManagerInsightsResponse["predictiveOutlook"]["performanceTrend"], { badge: string; label: string }> = {
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

function sanitizeResponseContent(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getOutlookTone(trend: unknown) {
  return outlookTone[(typeof trend === "string" ? trend : "") as keyof typeof outlookTone] ?? outlookTone.stable;
}

function normalizeInsightsPayload(payload: unknown): ManagerInsightsResponse | null {
  const parsed = managerInsightsResponseSchema.safeParse(payload);
  return parsed.success ? (normalizeManagerInsightsResponse(parsed.data as ManagerInsightsResponse) as ManagerInsightsResponse) : null;
}

function classifyInsight(text: string): Exclude<InsightFilter, "All">[] {
  const normalized = text.toLowerCase();
  const matches = new Set<Exclude<InsightFilter, "All">>();

  if (/(performance|score|trend|sales|delta|improv|declin)/.test(normalized)) matches.add("Performance");
  if (/(behavior|signal|objection|capability|coaching|execution|adapt|skill)/.test(normalized)) matches.add("Behavior");
  if (/(engagement|session|practice|module|completion|streak|activity)/.test(normalized)) matches.add("Engagement");
  if (/(territory|region|payer|access|market|geograph)/.test(normalized)) matches.add("Territory");
  if (!matches.size) matches.add("Behavior");

  return Array.from(matches);
}

function matchesFilter(text: string, filter: InsightFilter) {
  return filter === "All" || classifyInsight(text).includes(filter);
}

function getScopeLabel(request: ManagerInsightsRequest) {
  if (request.repData) return "Rep-specific";
  if ((request.territoryData.repIds?.length ?? 0) <= 4) return "Cluster-specific";
  return "Territory-wide";
}

function buildMonitoringTargets(request: ManagerInsightsRequest) {
  if (request.repData && request.derivedMetrics) {
    return [
      `${getBehavioralMetricLabel(request.repData.improvementPriority)} ${request.repData.behavioralMetrics[request.repData.improvementPriority].score}/5 vs ${MANAGER_MODEL_THRESHOLDS.repMetricLow}/5 threshold`,
      `${formatMetricLabel("engagementScore")} ${request.derivedMetrics.engagementScore}/100 vs ${MANAGER_MODEL_THRESHOLDS.engagementRisk}/100 monitoring threshold`,
      `${formatMetricLabel("salesRiskScore")} ${request.derivedMetrics.salesRiskScore}/100 vs ${MANAGER_MODEL_THRESHOLDS.salesRiskHigh}/100 threshold`,
      `${formatMetricLabel("confidenceScore")} ${Math.round(request.derivedMetrics.confidenceScore * 100)}%`,
    ];
  }

  return [
    `${formatMetricLabel("avgEngagement")} ${request.territoryData.avgEngagement}/100 vs ${MANAGER_MODEL_THRESHOLDS.territoryEngagementRisk}/100 risk threshold`,
    `${request.territoryData.mostCommonCapabilityGap ? getBehavioralMetricLabel(request.territoryData.mostCommonCapabilityGap) : "capability coverage"} gap`,
    `${formatMetricLabel("territoryVolatility")} ${request.territoryData.territoryVolatility} vs ${MANAGER_MODEL_THRESHOLDS.volatilityModerate} threshold`,
    `${formatMetricLabel("atRiskRepCount")} ${request.territoryData.atRiskRepCount}`,
  ];
}

function containsInvalidInsightText(text: string) {
  if (/(signalAwareness|signalInterpretation|valueCommunication|emotionalAttunement|conversationControl|commitmentGeneration|engagementStabilityScore|coachingResponsivenessScore|avgEngagement|territoryVolatility|salesRiskScore|confidenceScore|dataConfidenceIndex)/.test(text)) {
    return true;
  }

  return Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*\/?\d*\s*(?:is\s*)?(below|under|above|over|at or above|at least)\s+(?:the\s+)?(\d+(?:\.\d+)?)/gi)).some((match) => {
    const current = Number(match[1]);
    const operator = match[2].toLowerCase();
    const threshold = Number(match[3]);
    if ((operator === "below" || operator === "under") && !(current < threshold)) return true;
    if ((operator === "above" || operator === "over" || operator === "at or above" || operator === "at least") && !(current >= threshold)) return true;
    return false;
  });
}

function buildOperationalCards(insights: ManagerInsightsResponse, request: ManagerInsightsRequest) {
  const scopeLabel = getScopeLabel(request);
  const monitoringTargets = buildMonitoringTargets(request);

  return insights.recommendations.map((recommendation, index) => ({
    id: `${scopeLabel}-${index}-${recommendation.action}`,
    scopeLabel,
    primaryFinding: index === 0 ? insights.summary : insights.keyDrivers[index - 1] ?? insights.summary,
    dataBasis: insights.keyDrivers[index] ?? insights.risks[index] ?? insights.keyDrivers[0] ?? "No additional data basis available.",
    recommendedAction: recommendation.action,
    expectedImpact: recommendation.expectedImpact,
    monitorNext: monitoringTargets[index] ?? monitoringTargets[monitoringTargets.length - 1] ?? "Monitor the next scheduled metric refresh.",
  }));
}

export default function ManagerInsightsPanelExpanded({ data }: ManagerInsightsPanelExpandedProps) {
  const [insights, setInsights] = useState<ManagerInsightsResponse | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsUnavailable, setInsightsUnavailable] = useState(false);
  const [input, setInput] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<InsightFilter>("All");
  const [explainingAction, setExplainingAction] = useState<string | null>(null);

  const requestBody = useMemo(() => {
    const parsed = managerInsightsRequestSchema.safeParse(data);
    return parsed.success ? (parsed.data as ManagerInsightsRequest) : null;
  }, [data]);

  const requestSignature = useMemo(() => (requestBody ? JSON.stringify(requestBody) : ""), [requestBody]);

  useEffect(() => {
    if (!ENABLE_MANAGER_INSIGHTS || !requestBody || !requestSignature) {
      setInsights(null);
      setInsightsUnavailable(false);
      return;
    }

    const controller = new AbortController();
    setLoadingInsights(true);
    setInsightsUnavailable(false);

    fetch("/manager-insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestSignature,
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`manager_insights_${res.status}`);
        return res.json();
      })
      .then((payload: ManagerInsightsResponse) => {
        const normalizedPayload = normalizeInsightsPayload(payload);
        if (!normalizedPayload) throw new Error("manager_insights_invalid_payload");
        setInsights(normalizedPayload);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          console.error("Expanded manager insights unavailable:", error);
          setInsights(null);
          setInsightsUnavailable(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingInsights(false);
      });

    return () => controller.abort();
  }, [requestBody, requestSignature]);

  const filteredKeyDrivers = useMemo(() => (insights?.keyDrivers ?? []).filter((item) => matchesFilter(item, activeFilter)), [activeFilter, insights?.keyDrivers]);
  const filteredRisks = useMemo(() => (insights?.risks ?? []).filter((item) => matchesFilter(item, activeFilter)), [activeFilter, insights?.risks]);
  const filteredRecommendations = useMemo(() => (insights?.recommendations ?? []).filter((item) => matchesFilter(`${item.action} ${item.rationale} ${item.expectedImpact}`, activeFilter)), [activeFilter, insights?.recommendations]);
  const operationalCards = useMemo(() => (insights && requestBody ? buildOperationalCards(insights, requestBody) : []), [insights, requestBody]);
  const filteredOperationalCards = useMemo(() => operationalCards.filter((item) => matchesFilter(`${item.primaryFinding} ${item.dataBasis} ${item.recommendedAction} ${item.expectedImpact} ${item.monitorNext}`, activeFilter)), [activeFilter, operationalCards]);

  const toggleChip = (chip: string) => {
    setSelectedChips((current) => current.includes(chip) ? current.filter((item) => item !== chip) : [...current, chip]);
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/llm/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: JSON.stringify({
            messages: [
              {
                role: "system",
                content: "You are a data-grounded sales coaching assistant. Use only the provided rep, territory, canonical metric, threshold, and deterministic risk data. Use only canonical Signal Intelligence metric names. Do not invent thresholds, scores, labels, or contributors. Do not contradict deterministic outputs. Reference the rep name when rep-specific and use exact values in every claim. Return five labeled sections in this exact order: Primary finding, Data basis, Recommended action, Expected impact, What to monitor next.",
              },
              {
                role: "user",
                content: `Rep Data: ${JSON.stringify(data.repData ?? null)}
Territory Data: ${JSON.stringify(data.territoryData)}
Derived Metrics: ${JSON.stringify(data.derivedMetrics ?? null)}
Deterministic Risk Flags: ${JSON.stringify(data.repData?.evidence?.deterministicRiskFlags ?? [])}
Canonical Metrics: ${JSON.stringify(data.repData?.evidence?.canonicalBehavioralMetrics ?? [])}
Selected Context: ${JSON.stringify(selectedChips)}
Manager Question: ${input}`,
              },
            ],
          }),
          temperature: 0.2,
          max_tokens: 800,
        }),
      });

      if (!res.ok) return;
      const json = await res.json();
      const content = sanitizeResponseContent(json?.response) || sanitizeResponseContent(json?.content);
      const normalizedContent = normalizeManagerText(content);
      setResponse(normalizedContent && !containsInvalidInsightText(normalizedContent) ? normalizedContent : "Insight hidden because the generated response used an unsupported internal metric label or unsupported phrasing.");
    } catch {
      // Fail silently to preserve surrounding workflow.
    } finally {
      setLoading(false);
    }
  };

  const explainRecommendation = async (recommendation: Recommendation) => {
    setExplainingAction(recommendation.action);
    setLoading(true);

    try {
      const res = await fetch("/api/llm/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: JSON.stringify({
            messages: [
              {
                role: "system",
                content: "You are a data-grounded sales coaching assistant. Explain recommendations using only the supplied rep, territory, canonical metric, threshold, and deterministic risk data. Use only canonical Signal Intelligence metric names. Do not invent thresholds, scores, or contradictions. Return five labeled sections in this exact order: Primary finding, Data basis, Recommended action, Expected impact, What to monitor next. Keep it concise, auditable, and explicit about thresholds.",
              },
              {
                role: "user",
                content: `Rep Data: ${JSON.stringify(data.repData ?? null)}
Territory Data: ${JSON.stringify(data.territoryData)}
Derived Metrics: ${JSON.stringify(data.derivedMetrics ?? null)}
Deterministic Risk Flags: ${JSON.stringify(data.repData?.evidence?.deterministicRiskFlags ?? [])}
Canonical Metrics: ${JSON.stringify(data.repData?.evidence?.canonicalBehavioralMetrics ?? [])}
Recommendation: ${JSON.stringify(recommendation)}`,
              },
            ],
          }),
          temperature: 0.2,
          max_tokens: 600,
        }),
      });

      if (!res.ok) return;
      const json = await res.json();
      const content = sanitizeResponseContent(json?.response) || sanitizeResponseContent(json?.content);
      const normalizedContent = normalizeManagerText(content);
      setResponse(normalizedContent && !containsInvalidInsightText(normalizedContent) ? normalizedContent : "Insight hidden because the generated response used an unsupported internal metric label or unsupported phrasing.");
    } catch {
      // Fail silently to preserve surrounding workflow.
    } finally {
      setExplainingAction(null);
      setLoading(false);
    }
  };

  if (!ENABLE_MANAGER_INSIGHTS) return null;

  return (
    <section className="manager-insights-panel-expanded rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-900 p-2 text-white">
              <BrainCircuit className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">Manager AI Insights</p>
              <h3 className="text-lg font-bold text-slate-900">Territory predictive coaching layer</h3>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-500">Advisory coaching guidance built from canonical rep data, territory aggregation, and deterministic derived metrics.</p>
          <p className="mt-2 text-xs font-medium text-slate-500">{requestBody ? buildManagerExplainabilityNote(requestBody) : "Data Source: Rep + Territory Metrics"}</p>
        </div>

        {insights?.predictiveOutlook ? (
          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getOutlookTone(insights.predictiveOutlook.performanceTrend).badge}`}>
              <ArrowUpRight className="mr-1 h-3.5 w-3.5" />
              {getOutlookTone(insights.predictiveOutlook.performanceTrend).label}
            </div>
            <p className="text-sm font-semibold text-slate-700">Predictive confidence {Math.round(insights.predictiveOutlook.confidence * 100)}%</p>
          </div>
        ) : null}
      </div>

      {loadingInsights && !insights ? (
        <div className="flex min-h-[180px] items-center justify-center text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating explainable coaching insights…
        </div>
      ) : insightsUnavailable && !insights ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          Manager AI insights are temporarily unavailable. Rep summaries and assignment actions remain fully usable.
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Primary finding</p>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-800">{normalizeManagerText(insights?.summary || "Select a rep to load predictive coaching context for this territory.")}</p>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Filter insights</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Filters refine which dimensions of performance and behavior are displayed. They do not change the underlying dataset.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {FILTERS.map((filter) => {
                  const active = activeFilter === filter;
                  return (
                    <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? "border-teal-600 bg-teal-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700"}`}>
                      {filter}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Context chips</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Context chips refine how insights and recommendations are interpreted, based on real-world scenarios such as new reps, inconsistent performance, or territory dynamics.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {CONTEXT_CHIPS.map((chip) => {
                  const active = selectedChips.includes(chip);
                  return (
                    <button key={chip} type="button" onClick={() => toggleChip(chip)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900"}`}>
                      {chip}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Radar className="h-4 w-4 text-slate-600" />
                  <h4 className="text-sm font-semibold text-slate-900">Data Basis</h4>
                </div>
                <ul className="space-y-2 text-sm text-slate-700">
                  {filteredKeyDrivers.length ? filteredKeyDrivers.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-teal-500" />
                      <span>{normalizeManagerText(item)}</span>
                    </li>
                  )) : <li className="text-slate-500">No data basis items match the current filter.</li>}
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-slate-600" />
                  <h4 className="text-sm font-semibold text-slate-900">Risk Signals</h4>
                </div>
                <ul className="space-y-2 text-sm text-slate-700">
                  {filteredRisks.length ? filteredRisks.map((item) => (
                    <li key={item} className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                      <span>{normalizeManagerText(item)}</span>
                    </li>
                  )) : <li className="text-slate-500">No risk signals match the current filter.</li>}
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-slate-600" />
                  <h4 className="text-sm font-semibold text-slate-900">Predictive Outlook</h4>
                </div>

                {insights?.predictiveOutlook ? (
                  <div className="space-y-3 text-sm text-slate-700">
                    <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getOutlookTone(insights.predictiveOutlook.performanceTrend).badge}`}>
                      {getOutlookTone(insights.predictiveOutlook.performanceTrend).label}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Confidence</p>
                      <p className="text-lg font-bold text-slate-900">{Math.round(insights.predictiveOutlook.confidence * 100)}%</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Reasoning</p>
                      <p className="text-sm leading-6 text-slate-700">{normalizeManagerText(insights.predictiveOutlook.reasoning)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Predictive outlook will appear when manager insights are available.</p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-slate-600" />
                  <h4 className="text-sm font-semibold text-slate-900">Recommended Action</h4>
                </div>
                <div className="space-y-3">
                  {filteredOperationalCards.length ? filteredOperationalCards.map((card) => {
                    const sourceRecommendation = filteredRecommendations.find((item) => item.action === card.recommendedAction);
                    return (
                      <div key={card.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">{card.scopeLabel}</span>
                          {sourceRecommendation ? (
                            <button type="button" onClick={() => explainRecommendation(sourceRecommendation)} className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-teal-300 hover:text-teal-700" disabled={loading && explainingAction === sourceRecommendation.action}>
                              {loading && explainingAction === sourceRecommendation.action ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Explaining</> : "Explain"}
                            </button>
                          ) : null}
                        </div>
                        <div className="space-y-3 text-sm text-slate-700">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primary finding</p>
                            <p>{normalizeManagerText(card.primaryFinding)}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data basis</p>
                            <p>{normalizeManagerText(card.dataBasis)}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended action</p>
                            <p className="font-semibold text-slate-900">{normalizeManagerText(card.recommendedAction)}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expected impact</p>
                            <p>{normalizeManagerText(card.expectedImpact)}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What to monitor next</p>
                            <p>{normalizeManagerText(card.monitorNext)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  }) : <p className="text-sm text-slate-500">No recommendations match the current filter.</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Interactive AI coaching</p>
            <div className="mt-3 space-y-3">
              <textarea
                value={input}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setInput(event.target.value)}
                placeholder="Ask a follow-up or add context about this rep or territory..."
                className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">Selected context: {selectedChips.length ? selectedChips.join(", ") : "None"}</p>
                <button type="button" onClick={handleSubmit} disabled={loading} className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                  {loading && !explainingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Refine Insights
                </button>
              </div>
            </div>
          </div>

          {response ? (
            <div className="ai-followup-response rounded-2xl border border-teal-100 bg-teal-50 p-4">
              <h4 className="text-sm font-semibold text-slate-900">AI Coaching Response</h4>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{response}</p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
