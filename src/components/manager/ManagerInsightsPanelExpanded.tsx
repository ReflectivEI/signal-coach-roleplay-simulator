import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { ArrowUpRight, BrainCircuit, Loader2 } from "lucide-react";
import { ENABLE_MANAGER_INSIGHTS, PREDICTIVE_CONFIDENCE_LABEL, buildBehavioralProfileContext, buildManagerExplainabilityNote, buildStructuredInsightView, managerInsightsRequestSchema, managerInsightsResponseSchema } from "./managerInsightsShared";
import type { ManagerInsightsRequest, ManagerInsightsResponse } from "./managerInsightsTypes";
import { normalizeManagerInsightsResponse, normalizeManagerText } from "./managerMetricFormatting.js";
import BehavioralProfileGrid from "./BehavioralProfileGrid.jsx";

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
type StructuredResponse = {
  primaryFinding: string;
  whyItMatters: string;
  action: string;
  monitor: string[];
};

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

const ENTERPRISE_PANEL = "rounded-3xl border border-teal-200 bg-white shadow-sm";
const ENTERPRISE_SUBCARD = "rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors duration-200 hover:border-teal-200 hover:bg-teal-50/40";

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
  if (request.repData) return "Rep context";
  if ((request.territoryData.repIds?.length ?? 0) <= 4) return "Cluster context";
  return "Territory context";
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

export default function ManagerInsightsPanelExpanded({ data }: ManagerInsightsPanelExpandedProps) {
  const [insights, setInsights] = useState<ManagerInsightsResponse | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsUnavailable, setInsightsUnavailable] = useState(false);
  const [input, setInput] = useState("");
  const [response, setResponse] = useState<StructuredResponse | null>(null);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<InsightFilter>("All");

  const requestBody = useMemo(() => {
    const parsed = managerInsightsRequestSchema.safeParse(data);
    return parsed.success ? (parsed.data as ManagerInsightsRequest) : null;
  }, [data]);

  const requestSignature = useMemo(() => (requestBody ? JSON.stringify(requestBody) : ""), [requestBody]);
  const profileContext = useMemo(() => (requestBody ? buildBehavioralProfileContext(requestBody) : null), [requestBody]);
  const structuredInsight = useMemo(() => (requestBody ? buildStructuredInsightView(requestBody) : null), [requestBody]);

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
  const insightFilterSeed = useMemo(() => structuredInsight ? `${structuredInsight.primaryFinding} ${structuredInsight.whyItMatters} ${structuredInsight.action} ${structuredInsight.monitor.join(" ")}` : "", [structuredInsight]);
  const showStructuredInsight = useMemo(() => Boolean(structuredInsight && matchesFilter(insightFilterSeed, activeFilter)), [activeFilter, insightFilterSeed, structuredInsight]);

  const toggleChip = (chip: string) => {
    setSelectedChips((current) => current.includes(chip) ? current.filter((item) => item !== chip) : [...current, chip]);
  };

  const handleSubmit = async () => {
    if (!input.trim() || !requestBody) return;
    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch("/api/llm/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: JSON.stringify({
            messages: [
              {
                role: "system",
                content: "You are a data-grounded sales coaching assistant. Use only the provided rep, territory, canonical metric, threshold, and deterministic risk data. Use only these exact canonical Signal Intelligence capability names: Signal Awareness, Signal Interpretation, Adaptive Response, Objection Navigation, Value Connection, Commitment Generation, Customer Engagement Monitoring, Conversation Management. Reject and regenerate if any non-canonical term, synonym, or alternate label appears. Do not invent thresholds, scores, labels, contributors, or non-canonical metrics. Return exactly four sections in this order: Primary finding, Why it matters, Action, Monitor. Every section must include exact metric values, threshold comparisons, directionality, and the correct 5-point or 100-point scale whenever a metric is referenced. Every insight must make the causal chain explicit as capability → behavior impact → business outcome. Highlight the single most urgent metric in Primary finding or Monitor based on the largest gap or threshold breach severity. Predictive Confidence must always be described as prediction reliability (not a performance score). Primary finding must be one sentence with one strength and one gap. Why it matters must be one sentence. Action must be one sentence. Monitor must contain at most 3 bullet items and every item must include a score, threshold comparison, and scale.",
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
      if (content) {
        containsInvalidInsightText(normalizeManagerText(content));
      }
      const deterministicResponse = buildStructuredInsightView(requestBody);
      setResponse({
        primaryFinding: deterministicResponse.primaryFinding,
        whyItMatters: deterministicResponse.whyItMatters,
        action: deterministicResponse.action,
        monitor: deterministicResponse.monitor,
      });
    } catch {
      const deterministicResponse = buildStructuredInsightView(requestBody);
      setResponse({
        primaryFinding: deterministicResponse.primaryFinding,
        whyItMatters: deterministicResponse.whyItMatters,
        action: deterministicResponse.action,
        monitor: deterministicResponse.monitor,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  if (!ENABLE_MANAGER_INSIGHTS) return null;

  return (
    <section className={`manager-insights-panel-expanded ${ENTERPRISE_PANEL} p-5 md:p-6`}>
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
            <p className="text-sm font-semibold text-slate-700">Predictive Confidence {Math.round(insights.predictiveOutlook.confidence * 100)}/100</p>
            <p className="text-[11px] text-slate-500">{PREDICTIVE_CONFIDENCE_LABEL}</p>
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
          {profileContext ? (
            <BehavioralProfileGrid
              metricSource={profileContext.metricSource}
              strongestKey={profileContext.strongestKey}
              weakestKey={profileContext.weakestKey}
              title={profileContext.title}
              subtitle={profileContext.subtitle}
            />
          ) : null}

          <div className={ENTERPRISE_SUBCARD}>
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

          {showStructuredInsight && structuredInsight ? (
            <div className="rounded-2xl border border-teal-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">AI insight</p>
                  <p className="mt-1 text-sm text-slate-500">{getScopeLabel(requestBody as ManagerInsightsRequest)} structured for concise enterprise review.</p>
                </div>
                {insights?.predictiveOutlook ? (
                  <div className="space-y-2 text-right">
                    <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getOutlookTone(insights.predictiveOutlook.performanceTrend).badge}`}>
                      <ArrowUpRight className="mr-1 h-3.5 w-3.5" />
                      {getOutlookTone(insights.predictiveOutlook.performanceTrend).label}
                    </div>
                    <p className="text-xs font-semibold text-slate-500">Predictive Confidence {Math.round(insights.predictiveOutlook.confidence * 100)}/100 scale</p>
                    <p className="text-[11px] text-slate-500">{PREDICTIVE_CONFIDENCE_LABEL}</p>
                  </div>
                ) : null}
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
                      <li key={item} className="rounded-xl bg-slate-50 px-3 py-2">{normalizeManagerText(item)}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {(filteredKeyDrivers.length || filteredRisks.length) ? (
                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Supporting context</p>
                  <ul className="mt-2 space-y-2 text-sm text-slate-700">
                    {[...filteredKeyDrivers, ...filteredRisks].slice(0, 3).map((item) => (
                      <li key={item} className="rounded-xl bg-white px-3 py-2">{normalizeManagerText(item)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
              No AI insight block matches the current filter.
            </div>
          )}

          <div className={ENTERPRISE_SUBCARD}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Interactive AI coaching</p>
            <div className="mt-3 space-y-3">
              <textarea
                value={input}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question or request deeper insight..."
                className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">Selected context: {selectedChips.length ? selectedChips.join(", ") : "None"}</p>
                <button type="button" onClick={handleSubmit} disabled={loading} className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Ask AI
                </button>
              </div>
            </div>
          </div>

          {response ? (
            <div className="ai-followup-response rounded-2xl border border-teal-100 bg-teal-50 p-4">
              <h4 className="text-sm font-semibold text-slate-900">AI Coaching Response</h4>
              <div className="mt-3 space-y-4 text-sm text-slate-700">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primary finding</p>
                  <p className="mt-1 font-medium text-slate-900">{normalizeManagerText(response.primaryFinding)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why it matters</p>
                  <p className="mt-1">{normalizeManagerText(response.whyItMatters)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Action</p>
                  <p className="mt-1 font-medium text-slate-900">{normalizeManagerText(response.action)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monitor</p>
                  <ul className="mt-2 space-y-2">
                    {response.monitor.slice(0, 3).map((item) => (
                      <li key={item} className="rounded-xl bg-white px-3 py-2">{normalizeManagerText(item)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
