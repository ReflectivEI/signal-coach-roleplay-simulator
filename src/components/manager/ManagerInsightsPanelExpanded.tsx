import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { ArrowUpRight, BrainCircuit, Loader2 } from "lucide-react";
import { ENABLE_MANAGER_INSIGHTS, PREDICTIVE_CONFIDENCE_LABEL, buildBehavioralProfileContext, buildInteractiveCoachingResponse, buildManagerExplainabilityNote, buildStructuredInsightView, managerInsightsRequestSchema, managerInsightsResponseSchema } from "./managerInsightsShared";
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
type CoachingResponseMode = "structured" | "free_form";
type StructuredResponse = {
  mode: CoachingResponseMode;
  primaryFinding: string;
  whyItMatters: string;
  action: string;
  monitor: string[];
  answer?: string;
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
const ASK_AI_PILL_CLASSNAME = "inline-flex min-w-[92px] shrink-0 items-center justify-center rounded-full border border-[#166534] bg-[#1A334D] px-3 py-1.5 text-center text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#39ACAC] hover:bg-[#dff5f2] hover:text-[#166534] hover:shadow-md";
const SECTION_ACTION_ROW_CLASSNAME = "grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start";

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

function getWorkspaceTitle(request: ManagerInsightsRequest) {
  return request.repData ? `${request.repData.name} coaching workspace` : "Territory predictive coaching workspace";
}

function classifyCoachingInput(text: string): CoachingResponseMode {
  const normalized = text.trim().toLowerCase();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const hasQuestionIndicator = /\b(how|why|what|when|does|should)\b/.test(normalized);

  return wordCount >= 9 && hasQuestionIndicator ? "free_form" : "structured";
}

function buildRepContext(
  requestBody: ManagerInsightsRequest,
  structuredInsight: ReturnType<typeof buildStructuredInsightView> | null,
  selectedChips: string[],
  insights: ManagerInsightsResponse | null,
) {
  const chipContext = selectedChips.length ? `Selected manager context: ${selectedChips.join(", ")}.` : "Selected manager context: None.";

  if (requestBody.repData && requestBody.derivedMetrics) {
    const { repData, derivedMetrics, territoryData } = requestBody;
    const strongestMetric = repData.behavioralMetrics[repData.strongestCapability];
    const weakestMetric = repData.behavioralMetrics[repData.improvementPriority];

    return [
      `Rep: ${repData.name}`,
      `Specialty/Territory: ${repData.specialty} in ${repData.territory}`,
      `Strongest capability: ${normalizeManagerText(repData.strongestCapability)} at ${strongestMetric?.score ?? "N/A"}/5 with ${strongestMetric?.trend ?? "flat"} directionality`,
      `Priority capability: ${normalizeManagerText(repData.improvementPriority)} at ${weakestMetric?.score ?? "N/A"}/5 with ${weakestMetric?.trend ?? "flat"} directionality`,
      `Learning Engagement Score: ${derivedMetrics.engagementScore}/100`,
      `Readiness Score: ${derivedMetrics.readinessScore}/100`,
      `Conversion Proxy: ${derivedMetrics.conversionProxyScore}/100`,
      `Sales Risk: ${derivedMetrics.salesRiskScore}/100`,
      `Predictive Confidence: ${Math.round(derivedMetrics.confidenceScore * 100)}/100`,
      structuredInsight ? `Current structured recommendation: ${structuredInsight.primaryFinding} | ${structuredInsight.whyItMatters} | ${structuredInsight.action}` : "",
      insights?.keyDrivers?.length ? `Supporting drivers: ${insights.keyDrivers.slice(0, 3).join(" | ")}` : "",
      insights?.risks?.length ? `Active risks: ${insights.risks.slice(0, 3).join(" | ")}` : "",
      `Territory benchmark: ${territoryData.territory}, avg engagement ${territoryData.avgEngagement}/100, avg performance ${territoryData.avgPerformance}/5`,
      chipContext,
    ].filter(Boolean).join("\n");
  }

  const territory = requestBody.territoryData;
  return [
    `Territory: ${territory.territory}`,
    `Average performance: ${territory.avgPerformance}/5`,
    `Average engagement: ${territory.avgEngagement}/100`,
    `Most common capability gap: ${normalizeManagerText(territory.mostCommonCapabilityGap ?? "Not specified")}`,
    `Territory volatility: ${territory.territoryVolatility}`,
    `At-risk reps: ${territory.atRiskRepCount}`,
    structuredInsight ? `Current structured recommendation: ${structuredInsight.primaryFinding} | ${structuredInsight.whyItMatters} | ${structuredInsight.action}` : "",
    insights?.keyDrivers?.length ? `Supporting drivers: ${insights.keyDrivers.slice(0, 3).join(" | ")}` : "",
    insights?.risks?.length ? `Active risks: ${insights.risks.slice(0, 3).join(" | ")}` : "",
    chipContext,
  ].filter(Boolean).join("\n");
}

function buildFreeFormMessages(userInput: string, repContext: string) {
  return [
    {
      role: "system",
      content: "You are an AI coaching assistant. Answer immediately using the provided rep context. Do NOT restate or quote the user's question. Start with the answer, use concise executive-friendly language, avoid unnecessary repetition of metrics, lead with a clear estimate or recommendation when possible, and do NOT repeat structured coaching templates unless explicitly asked.",
    },
    {
      role: "user",
      content: `
User Question:
${userInput}

Rep Context:
${repContext}

Instructions:
- Start with the answer immediately
- Do NOT restate or quote the question
- Be concise, specific, and executive-friendly
- Use rep data where relevant
- Limit unnecessary repetition of metrics
- Lead with a clear estimate or recommendation when possible
- Do NOT restate full coaching framework
`.trim(),
    },
  ];
}

function stripStructuredSections(text: string) {
  return text
    .replace(/\bPRIMARY FINDING\b[:\s-]*/gi, "")
    .replace(/\bWHY IT MATTERS\b[:\s-]*/gi, "")
    .replace(/\bACTION\b[:\s-]*/gi, "")
    .replace(/\bMONITOR\b[:\s-]*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ensureDirectAnswer(answer: string, _question: string) {
  const cleanedAnswer = stripStructuredSections(answer).trim();

  if (!cleanedAnswer) {
    return "I need a bit more detail to answer precisely. Based on the available rep context, focus first on the current priority metric and the most recent session trend.";
  }

  return cleanedAnswer;
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
  const [askAiContext, setAskAiContext] = useState("Current recommendation");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const coachingSectionRef = useRef<HTMLDivElement | null>(null);

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

  const queueFollowUp = (prompt: string, contextLabel = "Current recommendation") => {
    setInput(prompt);
    setAskAiContext(contextLabel);
    setTimeout(() => {
      coachingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      inputRef.current?.focus();
      const valueLength = inputRef.current?.value.length ?? 0;
      inputRef.current?.setSelectionRange(valueLength, valueLength);
    }, 0);
  };

  const handleSubmit = async () => {
    if (!input.trim() || !requestBody) return;
    setLoading(true);
    setResponse(null);

    try {
      const responseMode = classifyCoachingInput(input);

      if (responseMode === "free_form") {
        const repContext = buildRepContext(requestBody, structuredInsight, selectedChips, insights);
        const messages = buildFreeFormMessages(input.trim(), repContext);
        const prompt = messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join("\n\n");
        const res = await fetch("/api/llm/invoke", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, max_tokens: 500, temperature: 0.3 }),
        });

        if (!res.ok) {
          throw new Error(`interactive_ai_${res.status}`);
        }

        const payload = await res.json();
        const rawAnswer = typeof payload?.response === "string"
          ? payload.response
          : typeof payload?.text === "string"
            ? payload.text
            : typeof payload?.content === "string"
              ? payload.content
              : "";

        const finalAnswer = ensureDirectAnswer(rawAnswer, input.trim());
        setResponse({
          mode: "free_form",
          primaryFinding: "",
          whyItMatters: "",
          action: "",
          monitor: [],
          answer: finalAnswer,
        });
        return;
      }

      const deterministicResponse = buildInteractiveCoachingResponse(requestBody, input, selectedChips);
      setResponse({
        mode: "structured",
        primaryFinding: deterministicResponse.primaryFinding,
        whyItMatters: deterministicResponse.whyItMatters,
        action: deterministicResponse.action,
        monitor: deterministicResponse.monitor,
      });
    } catch (error) {
      console.error("Interactive AI coaching failed:", error);
      const fallbackAnswer = ensureDirectAnswer("", input.trim());
      setResponse({
        mode: classifyCoachingInput(input),
        primaryFinding: classifyCoachingInput(input) === "structured" ? fallbackAnswer : "",
        whyItMatters: classifyCoachingInput(input) === "structured" ? "The interactive response fallback was used because live generation was unavailable." : "",
        action: classifyCoachingInput(input) === "structured" ? "Retry the question or refine it with a more specific coaching ask." : "",
        monitor: classifyCoachingInput(input) === "structured" ? ["Watch the current priority metric and recent session evidence while retrying the request."] : [],
        answer: classifyCoachingInput(input) === "free_form" ? fallbackAnswer : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.key === "Enter" && !event.shiftKey) || ((event.metaKey || event.ctrlKey) && event.key === "Enter")) {
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
              <h3 className="text-lg font-bold text-slate-900">{requestBody ? getWorkspaceTitle(requestBody) : "Manager coaching workspace"}</h3>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-700">Advisory coaching guidance built from canonical rep data, territory aggregation, and deterministic derived metrics.</p>
          <p className="mt-2 text-xs font-medium text-slate-700">{requestBody ? buildManagerExplainabilityNote(requestBody) : "Data Source: Rep + Territory Metrics"}</p>
        </div>

        {insights?.predictiveOutlook ? (
          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getOutlookTone(insights.predictiveOutlook.performanceTrend).badge}`}>
              <ArrowUpRight className="mr-1 h-3.5 w-3.5" />
              {getOutlookTone(insights.predictiveOutlook.performanceTrend).label}
            </div>
            <p className="text-sm font-semibold text-slate-800">Predictive Confidence {Math.round(insights.predictiveOutlook.confidence * 100)}/100</p>
            <p className="text-[11px] text-slate-700">{PREDICTIVE_CONFIDENCE_LABEL}</p>
          </div>
        ) : null}
      </div>

      {loadingInsights && !insights ? (
        <div className="flex min-h-[180px] items-center justify-center text-sm text-slate-700">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating explainable coaching insights…
        </div>
      ) : insightsUnavailable && !insights ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
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

          <div className={`${ENTERPRISE_SUBCARD} grid gap-5 xl:grid-cols-2`}>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Filter insights</p>
              <p className="mt-1 text-xs leading-5 text-slate-700">Filters refine which dimensions of performance and behavior are displayed. They do not change the underlying dataset.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {FILTERS.map((filter) => {
                  const active = activeFilter === filter;
                  return (
                    <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-teal-300 hover:text-teal-700"}`}>
                      {filter}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Context chips</p>
              <p className="mt-1 text-xs leading-5 text-slate-700">Context chips refine how insights and recommendations are interpreted, based on real-world scenarios such as new reps, inconsistent performance, or territory dynamics.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {CONTEXT_CHIPS.map((chip) => {
                  const active = selectedChips.includes(chip);
                  return (
                    <button key={chip} type="button" onClick={() => toggleChip(chip)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900"}`}>
                      {chip}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {showStructuredInsight && structuredInsight ? (
            <div className="rounded-2xl border border-teal-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">AI insight</p>
                  <p className="mt-1 text-sm text-slate-700">{getScopeLabel(requestBody as ManagerInsightsRequest)} structured for concise enterprise review.</p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <button
                    type="button"
                    onClick={() => queueFollowUp(`Explain the AI insight for this ${getScopeLabel(requestBody as ManagerInsightsRequest).toLowerCase()} and tell me what to ask the rep next.`, "AI insight")}
                    className={ASK_AI_PILL_CLASSNAME}
                  >
                    Ask AI a Question
                  </button>
                {insights?.predictiveOutlook ? (
                  <div className="space-y-2 text-left sm:text-right">
                    <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getOutlookTone(insights.predictiveOutlook.performanceTrend).badge}`}>
                      <ArrowUpRight className="mr-1 h-3.5 w-3.5" />
                      {getOutlookTone(insights.predictiveOutlook.performanceTrend).label}
                    </div>
                    <p className="text-xs font-semibold text-slate-700">Predictive Confidence {Math.round(insights.predictiveOutlook.confidence * 100)}/100 scale</p>
                    <p className="text-[11px] text-slate-700">{PREDICTIVE_CONFIDENCE_LABEL}</p>
                  </div>
                ) : null}
                </div>
              </div>

              <div className="space-y-4 text-sm text-slate-700">
                <div>
                  <div className={SECTION_ACTION_ROW_CLASSNAME}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Primary finding</p>
                    <button
                      type="button"
                      onClick={() => queueFollowUp(`Explain this primary finding in more detail: ${normalizeManagerText(structuredInsight.primaryFinding)}`, "Primary finding")}
                      className={ASK_AI_PILL_CLASSNAME}
                    >
                      Ask AI
                    </button>
                  </div>
                  <p className="mt-1 font-medium text-slate-900">{normalizeManagerText(structuredInsight.primaryFinding)}</p>
                </div>
                <div>
                  <div className={SECTION_ACTION_ROW_CLASSNAME}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Why it matters</p>
                    <button
                      type="button"
                      onClick={() => queueFollowUp(`Why does this matter and what business risk should I watch for? ${normalizeManagerText(structuredInsight.whyItMatters)}`, "Why it matters")}
                      className={ASK_AI_PILL_CLASSNAME}
                    >
                      Ask AI
                    </button>
                  </div>
                  <p className="mt-1">{normalizeManagerText(structuredInsight.whyItMatters)}</p>
                </div>
                <div>
                  <div className={SECTION_ACTION_ROW_CLASSNAME}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Action</p>
                    <button
                      type="button"
                      onClick={() => queueFollowUp(`Turn this recommended action into a coaching plan: ${normalizeManagerText(structuredInsight.action)}`, "Action")}
                      className={ASK_AI_PILL_CLASSNAME}
                    >
                      Ask AI
                    </button>
                  </div>
                  <p className="mt-1 font-medium text-slate-900">{normalizeManagerText(structuredInsight.action)}</p>
                </div>
                <div>
                  <div className={SECTION_ACTION_ROW_CLASSNAME}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Monitor</p>
                    <button
                      type="button"
                      onClick={() => queueFollowUp(`Explain what I should monitor next based on these signals: ${structuredInsight.monitor.map((item) => normalizeManagerText(item)).join(" | ")}`, "Monitor")}
                      className={ASK_AI_PILL_CLASSNAME}
                    >
                      Ask AI
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {structuredInsight.monitor.map((item) => (
                      <li key={item} className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-slate-700">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-700" />
                        <span>{normalizeManagerText(item)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {(filteredKeyDrivers.length || filteredRisks.length) ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className={SECTION_ACTION_ROW_CLASSNAME}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Supporting context</p>
                    <button
                      type="button"
                      onClick={() => queueFollowUp(`Use this supporting context to elaborate on the recommendation: ${[...filteredKeyDrivers, ...filteredRisks].slice(0, 3).map((item) => normalizeManagerText(item)).join(" | ")}`, "Supporting context")}
                      className={ASK_AI_PILL_CLASSNAME}
                    >
                      Ask AI
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1.5 pl-0 text-sm text-slate-700">
                    {[...filteredKeyDrivers, ...filteredRisks].slice(0, 3).map((item) => (
                      <li key={item} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-700" />
                        <span>{normalizeManagerText(item)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-700">
              No AI insight block matches the current filter.
            </div>
          )}

          <div ref={coachingSectionRef} className={ENTERPRISE_SUBCARD}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Interactive AI coaching</p>
            <div className="mt-3 space-y-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question or request deeper insight..."
                className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              />
              <p className="text-xs text-slate-700">Ask AI to explain or elaborate on the recommendation above. Press Enter to submit, or use Cmd/Ctrl + Enter.</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-slate-700">Ask AI context: {askAiContext}</p>
                  <p className="text-xs text-slate-700">Applied chips: {selectedChips.length ? selectedChips.join(", ") : "None"}</p>
                </div>
                <button type="button" onClick={handleSubmit} disabled={loading} className={`${ASK_AI_PILL_CLASSNAME} px-4 py-2 text-sm disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:text-white disabled:shadow-none disabled:hover:translate-y-0`}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Ask AI
                </button>
              </div>
            </div>
          </div>

          {response ? (
            <div className="ai-followup-response rounded-2xl border border-teal-100 bg-teal-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold text-slate-900">AI Coaching Response</h4><span className="rounded-full border border-teal-200 bg-white px-3 py-1 text-[11px] font-semibold text-teal-700">{askAiContext}</span></div>
              <div className="mt-3 space-y-4 text-sm text-slate-700">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{response.mode === "free_form" ? "AI Answer" : "Primary finding"}</p>
                  <p className="mt-1 font-medium text-slate-900">{normalizeManagerText(response.mode === "free_form" ? response.answer ?? "" : response.primaryFinding)}</p>
                </div>
                {response.mode === "structured" ? (
                  <>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Why it matters</p>
                      <p className="mt-1">{normalizeManagerText(response.whyItMatters)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Action</p>
                      <p className="mt-1 font-medium text-slate-900">{normalizeManagerText(response.action)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Monitor</p>
                      <ul className="mt-2 space-y-2">
                        {response.monitor.slice(0, 3).map((item) => (
                          <li key={item} className="rounded-xl bg-white px-3 py-2 text-slate-700">{normalizeManagerText(item)}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
