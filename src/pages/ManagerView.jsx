// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  BarChart3,
  GraduationCap,
  AlertTriangle,
  Play,
  BookOpen,
  Target,
  Shield,
  Ear,
  Heart,
  GitFork,
  Shuffle,
  Search,
  Star,
  Trophy,
  ThumbsUp,
  Loader2,
  MessageCircle,
  CheckCircle,
  RefreshCw,
  RotateCcw,
  Info,
  ChevronRight,
  Activity,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend } from "recharts";
import AssignmentPanel from "@/components/manager/AssignmentPanel";
import ManagerInsightsPanel from "@/components/manager/ManagerInsightsPanel";
import ManagerInsightsPanelExpanded from "@/components/manager/ManagerInsightsPanelExpanded";
import { ENABLEMENT_HUB_SPOKES, getAdoptionBand } from "@/lib/enablementHub";
import { ENABLE_MANAGER_INSIGHTS } from "@/components/manager/managerInsightsShared";
import {
  BEHAVIORAL_METRIC_KEYS,
  buildManagerInsightsRequest,
  getBehavioralMetricDefinition,
  getBehavioralMetricLabel,
} from "@/components/manager/managerPerformanceData";
import { buildManagerViewState, getContributorSet } from "@/components/manager/managerViewModel";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createPageUrl } from "@/utils";

const INITIAL_VIEW_STATE = buildManagerViewState(0);

const ICON_MAP = {
  signalAwareness: Search,
  signalInterpretation: Ear,
  adaptability: Shuffle,
  objectionHandling: Shield,
  valueCommunication: Heart,
  commitmentGeneration: Target,
  emotionalAttunement: Users,
  conversationControl: GitFork,
};

const COLOR_MAP = {
  signalAwareness: "#14b8a6",
  signalInterpretation: "#0284c7",
  adaptability: "#06b6d4",
  objectionHandling: "#f97316",
  valueCommunication: "#8b5cf6",
  commitmentGeneration: "#10b981",
  emotionalAttunement: "#f59e0b",
  conversationControl: "#1A334D",
};

const SIGNAL_CAPABILITIES = BEHAVIORAL_METRIC_KEYS.map((key) => ({
  id: key,
  label: getBehavioralMetricLabel(key),
  subtitle: getBehavioralMetricDefinition(key).measurement || "Canonical Signal Intelligence capability",
  icon: ICON_MAP[key] || Target,
  metrics: ["score", "trend", "sessionsObserved"],
  color: COLOR_MAP[key] || "#64748b",
}));

const TRAINING_MODULES = [
  { id: 1, capability: "signalAwareness", title: "Signal Awareness Masterclass", type: "Video + Practice", duration: "45 min", level: "Intermediate" },
  { id: 2, capability: "signalAwareness", title: "Question Timing Exercises", type: "Interactive", duration: "30 min", level: "Beginner" },
  { id: 3, capability: "signalInterpretation", title: "Interpretation Accuracy Drills", type: "Role-Play", duration: "60 min", level: "Advanced" },
  { id: 4, capability: "valueCommunication", title: "Value Connection Framing", type: "Case Studies", duration: "40 min", level: "Intermediate" },
  { id: 5, capability: "emotionalAttunement", title: "Customer Engagement Monitoring Signals", type: "Video", duration: "25 min", level: "Beginner" },
  { id: 6, capability: "objectionHandling", title: "Objection Navigation Workshop", type: "Role-Play", duration: "50 min", level: "Advanced" },
  { id: 7, capability: "conversationControl", title: "Conversation Management Flow", type: "Interactive", duration: "35 min", level: "Intermediate" },
  { id: 8, capability: "adaptability", title: "Adaptive Response Techniques", type: "Simulation", duration: "55 min", level: "Advanced" },
  { id: 9, capability: "commitmentGeneration", title: "Commitment Generation Strategies", type: "Video + Practice", duration: "40 min", level: "Intermediate" },
  { id: 10, capability: "signalInterpretation", title: "Stakeholder Mapping Intensive", type: "Workshop", duration: "60 min", level: "Advanced" },
];

function buildMockSessions(reps) {
  return reps.slice(0, 5).map((rep, index) => ({
    id: `s${index + 1}`,
    rep_name: rep.name,
    rep_id: rep.id,
    scenario: `${rep.specialty} scenario review`,
    date: ["Mar 21, 2026", "Mar 20, 2026", "Mar 19, 2026", "Mar 18, 2026", "Mar 17, 2026"][index],
    score: rep.overallScore,
    status: index % 2 === 0 ? "needs_feedback" : "reviewed",
  }));
}

function formatStatus(status) {
  return status === "needs_attention" ? "Needs Attention" : status.charAt(0).toUpperCase() + status.slice(1);
}

function formatRefreshTimestamp(isoValue) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(isoValue));
}

function StatusBadge({ status }) {
  return <span className={`text-xs font-medium ${status === "active" ? "text-green-700" : status === "inactive" ? "text-red-700" : "text-amber-700"}`}>{formatStatus(status)}</span>;
}

function TrendBadge({ trend }) {
  const tone = trend === "up" ? "bg-teal-50 text-teal-700" : trend === "down" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{trend}</span>;
}

function CapabilityPill({ metricKey, tone = "slate" }) {
  const toneClasses = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    teal: "bg-teal-50 text-teal-700 border-teal-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses[tone] || toneClasses.slate}`}>
      {getBehavioralMetricLabel(metricKey)}
    </span>
  );
}

function MetricExplanationDialog({ explanation, children }) {
  if (!explanation) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{explanation.label}</DialogTitle>
          <DialogDescription>{explanation.definition}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm text-slate-700">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Formula</p>
            <p className="mt-2 font-mono text-xs leading-6 text-slate-700">{explanation.formula}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Current inputs</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.entries(explanation.inputs || {}).map(([key, value]) => (
                <div key={key} className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">{key}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Current output</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{String(explanation.output)}</p>
            {explanation.notes ? <p className="mt-2 text-xs leading-5 text-slate-600">{explanation.notes}</p> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetricPill({ explanation, label = "How calculated" }) {
  if (!explanation) {
    return null;
  }

  return (
    <MetricExplanationDialog explanation={explanation}>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-teal-300 hover:text-teal-700"
      >
        <Info className="h-3 w-3" />
        {label}
      </button>
    </MetricExplanationDialog>
  );
}

function RepRow({ rep, derived, explanations, onSelect, selected }) {
  return (
    <tr onClick={() => onSelect(rep)} className={`cursor-pointer transition-colors ${selected ? "bg-teal-50" : "hover:bg-gray-50"}`}>
      <td className="px-4 py-3 align-top">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "#1A334D" }}>
            {rep.name.split(" ").map((word) => word[0]).join("")}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{rep.name}</p>
            <p className="mt-0.5 text-xs text-gray-500">{rep.specialty} · {rep.territory}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-top text-center">
        <div className="flex flex-col items-center gap-1">
          <span className={`text-sm font-bold ${rep.overallScore >= 4 ? "text-teal-600" : rep.overallScore >= 3.3 ? "text-blue-600" : "text-amber-600"}`}>{rep.overallScore}/5</span>
          <MetricPill explanation={explanations.overallScore} label="Formula" />
        </div>
      </td>
      <td className="px-4 py-3 align-top text-center">
        <p className="text-sm font-bold text-slate-700">{rep.sessionsCompleted30d}</p>
        <p className="mt-1 text-[11px] text-slate-500">current 30d</p>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="space-y-2">
          <CapabilityPill metricKey={rep.strongestCapability} tone="teal" />
          <MetricPill explanation={explanations.strongestCapability} label="Source" />
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="space-y-2">
          <CapabilityPill metricKey={rep.improvementPriority} tone="amber" />
          <MetricPill explanation={explanations.improvementPriority} label="Source" />
        </div>
      </td>
      <td className="px-4 py-3 align-top text-left">
        <TrendBadge trend={rep.salesTrend} />
      </td>
      <td className="px-4 py-3 align-top">
        <StatusBadge status={rep.status} />
        <div className="mt-2 flex items-center gap-2">
          <p className="text-[11px] text-slate-500">Risk {derived.salesRiskScore}/100</p>
          <MetricPill explanation={explanations.salesRiskScore} label="Formula" />
        </div>
      </td>
      <td className="px-4 py-3 align-top text-center">
        <p className="text-sm font-semibold text-slate-700">{rep.coachingModulesCompleted}</p>
        <MetricPill explanation={explanations.moduleCompletion} label="%" />
      </td>
    </tr>
  );
}

function ContributorDialog({ territory, contributors, territoryExplanations, onSelectRep }) {
  const sections = [
    {
      key: "gapContributors",
      title: territory.mostCommonCapabilityGap ? `${getBehavioralMetricLabel(territory.mostCommonCapabilityGap)} gap contributors` : "Capability gap contributors",
      items: contributors.gapContributors,
      explanation: territoryExplanations.mostCommonCapabilityGap,
    },
    {
      key: "engagementContributors",
      title: "Engagement detractors",
      items: contributors.engagementContributors,
      explanation: territoryExplanations.avgEngagement,
    },
    {
      key: "volatilityContributors",
      title: "Volatility drivers",
      items: contributors.volatilityContributors,
      explanation: territoryExplanations.territoryVolatility,
    },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-teal-300 hover:text-teal-700">
          View contributors
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{territory.territory} contributor traceability</DialogTitle>
          <DialogDescription>Inspect which reps drive the current territory patterns, their weighted contribution to the aggregate, then jump directly to rep-specific coaching context.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-900">{section.title}</h4>
                <MetricPill explanation={section.explanation} label="Formula" />
              </div>
              {section.items.length ? (
                <div className="mt-3 space-y-3">
                  {section.items.map((item) => (
                    <div key={`${section.key}-${item.repId}`} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.metricLabel}: {item.metricValue} · Weight {Math.round((item.weight || 0) * 100)}%</p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">{item.why}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => onSelectRep(item.repId)}>
                          Open rep
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No contributors are available for this territory pattern.</p>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ManagerView() {
  const [activeTab, setActiveTab] = useState("reps");
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [selectedRepId, setSelectedRepId] = useState(null);
  const [selectedCapabilityFilter, setSelectedCapabilityFilter] = useState("all");
  const [assignments, setAssignments] = useState([]);
  const [snippets, setSnippets] = useState([]);
  const [sessions, setSessions] = useState(() => buildMockSessions(INITIAL_VIEW_STATE.reps));
  const [feedbackDraft, setFeedbackDraft] = useState({});
  const [feedbackSaving, setFeedbackSaving] = useState({});
  const [feedbackSaved, setFeedbackSaved] = useState({});
  const [curating, setCurating] = useState({});

  const reps = viewState.reps;
  const selectedRep = useMemo(() => reps.find((rep) => rep.id === selectedRepId) ?? null, [reps, selectedRepId]);

  useEffect(() => {
    loadAssignments();
    loadSnippets();
  }, []);

  useEffect(() => {
    if (selectedRepId && !reps.some((rep) => rep.id === selectedRepId)) {
      setSelectedRepId(null);
    }
  }, [reps, selectedRepId]);

  const loadAssignments = async () => {
    try {
      const res = await fetch("/api/assignments", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments || []);
      }
    } catch (err) {
      console.error("Load assignments error:", err);
      setAssignments([]);
    }
  };

  const loadSnippets = async () => {
    try {
      const res = await fetch("/api/snippets", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setSnippets(data.snippets || []);
      }
    } catch (err) {
      console.error("Load snippets error:", err);
      setSnippets([]);
    }
  };

  const saveSessionFeedback = async (sessionId) => {
    const text = feedbackDraft[sessionId]?.trim();
    if (!text) return;
    setFeedbackSaving((prev) => ({ ...prev, [sessionId]: true }));
    try {
      setSessions((prev) => prev.map((session) => (session.id === sessionId ? { ...session, status: "reviewed", managerFeedback: text } : session)));
      setFeedbackSaved((prev) => ({ ...prev, [sessionId]: true }));
      setTimeout(() => setFeedbackSaved((prev) => ({ ...prev, [sessionId]: false })), 3000);
    } catch (err) {
      console.error("Save feedback error:", err);
    } finally {
      setFeedbackSaving((prev) => ({ ...prev, [sessionId]: false }));
    }
  };

  const toggleCurate = async (snippet) => {
    setCurating((prev) => ({ ...prev, [snippet.id]: true }));
    try {
      setSnippets((prev) => prev.map((item) => (item.id === snippet.id ? { ...item, curated: !item.curated } : item)));
    } catch (err) {
      console.error("Curate snippet error:", err);
    } finally {
      setCurating((prev) => ({ ...prev, [snippet.id]: false }));
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      const res = await fetch("/api/assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        loadAssignments();
      }
    } catch (err) {
      console.error("Status change error:", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      setAssignments((prev) => prev.filter((assignment) => assignment.id !== id));
    } catch (err) {
      console.error("Delete error:", err);
      loadAssignments();
    }
  };

  const applyViewState = (nextState) => {
    setViewState(nextState);
    setSessions(buildMockSessions(nextState.reps));
    setFeedbackDraft({});
    setFeedbackSaving({});
    setFeedbackSaved({});
    setSelectedRepId((current) => (nextState.reps.some((rep) => rep.id === current) ? current : null));
  };

  const handleRefreshDataset = () => {
    applyViewState(buildManagerViewState(viewState.version + 1));
  };

  const handleResetDataset = () => {
    applyViewState(buildManagerViewState(0));
  };

  const handleSelectRepFromContributor = (repId) => {
    setSelectedRepId(repId);
    setActiveTab("reps");
  };

  const filteredModules = selectedCapabilityFilter === "all"
    ? TRAINING_MODULES
    : TRAINING_MODULES.filter((module) => module.capability === selectedCapabilityFilter);

  const adoptionBand = getAdoptionBand(viewState.overviewMetrics.adoptionHealth);
  const interventionQueue = viewState.overviewMetrics.interventionQueue;
  const coachingPriority = interventionQueue.slice().sort((a, b) => viewState.derivedByRepId[b.id].salesRiskScore - viewState.derivedByRepId[a.id].salesRiskScore);
  const selectedTerritoryData = (selectedRep && viewState.territories.find((territory) => territory.territory === selectedRep.territory)) || viewState.nationalTerritory;
  const selectedRepInsightsData = selectedRep ? buildManagerInsightsRequest(selectedRep, selectedTerritoryData, viewState.derivedByRepId[selectedRep.id]) : null;
  const territoryInsightsData = buildManagerInsightsRequest(null, viewState.nationalTerritory);
  const managerMetricsPayload = selectedRepInsightsData || territoryInsightsData;

  const territoryRadarData = BEHAVIORAL_METRIC_KEYS.map((key) => ({
    capability: getBehavioralMetricLabel(key),
    team: viewState.nationalTerritory.avgBehavioralMetrics[key],
    benchmark: Math.max(3.2, viewState.nationalTerritory.avgBehavioralMetrics[key] - 0.2),
  }));

  const overviewCards = [
    {
      label: "Adoption health",
      value: `${viewState.overviewMetrics.adoptionHealth}%`,
      sub: adoptionBand,
      explanation: viewState.explanations.overview.adoptionHealth,
    },
    {
      label: "Module completion",
      value: `${viewState.overviewMetrics.moduleCompletion}%`,
      sub: "current 14-rep team average",
      explanation: viewState.explanations.overview.moduleCompletion,
    },
    {
      label: "Intervention queue",
      value: interventionQueue.length,
      sub: "current reps requiring action",
      explanation: viewState.explanations.overview.interventionQueue,
    },
    {
      label: "Dataset scope",
      value: `${viewState.datasetScope.repCount} reps`,
      sub: viewState.datasetScope.timeWindow,
      explanation: null,
    },
  ];

  const kpiCards = [
    {
      label: "Active Reps",
      value: viewState.overviewMetrics.activeRepCount,
      sub: `${viewState.datasetScope.repCount} reps in scope`,
      icon: Users,
      tone: "teal",
      explanation: null,
    },
    {
      label: "Team Sessions (30d)",
      value: viewState.overviewMetrics.totalSessions,
      sub: "summed across current dataset",
      icon: Play,
      tone: "navy",
      explanation: null,
    },
    {
      label: "Team Avg Score",
      value: `${viewState.overviewMetrics.avgTeamScore}/5`,
      sub: "canonical demo aggregate",
      icon: BarChart3,
      tone: "teal",
      explanation: viewState.explanations.overview.avgTeamScore,
    },
    {
      label: "Needs Attention",
      value: viewState.overviewMetrics.attentionCount,
      sub: "status-driven count",
      icon: AlertTriangle,
      tone: "amber",
      explanation: viewState.explanations.overview.needsAttention,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl rounded-2xl bg-slate-50/60 p-6 md:p-8">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#1A334D" }}>
            <Users className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Manager View</h1>
        </div>
        <p className="text-sm text-gray-500">Territory performance, rep activity, and training alignment across the current Manager View demo dataset.</p>
        <div className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
          Data integrity {viewState.validation.isValid ? "verified" : "needs review"} · {viewState.datasetScope.detail} · full 8-metric canonical model
        </div>
        {!viewState.validation.isValid ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Validation blocked one or more inconsistent values. Manager View is hiding any card without trusted metadata until the demo state is valid again.
          </div>
        ) : null}
      </div>

      <div className="mb-8 rounded-[28px] border border-slate-200 bg-gradient-to-r from-white to-slate-100 p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-600">Team intervention hub</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Manager View is now the intervention spoke for enterprise enablement.</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              This layer translates platform intelligence into manager actions: who needs support, what should be assigned, and where training adoption is drifting from performance outcomes.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700">Current scope: {viewState.datasetScope.detail}</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700">Last refreshed: {formatRefreshTimestamp(viewState.refreshedAt)}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {overviewCards.filter((card) => card.explanation || card.label === "Dataset scope").map((card) => (
                <div key={card.label} className="grid min-h-[132px] grid-rows-[auto_1fr_auto] rounded-2xl border border-slate-200 bg-white p-4 pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide leading-relaxed text-slate-500">{card.label}</p>
                    <MetricPill explanation={card.explanation} label="Formula" />
                  </div>
                  <p className="mt-3 self-center text-2xl font-bold text-slate-900">{card.value}</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{card.sub}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">Hub and spoke routing</p>
                <p className="mt-1 text-xs text-slate-300">Current dataset refresh and reset actions re-run derived metrics, territory aggregates, insights, and recommendation mapping across the page.</p>
              </div>
              <div className="flex gap-2">
                <Button size="icon" variant="secondary" className="h-10 w-10 rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/20" onClick={handleRefreshDataset}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="secondary" className="h-10 w-10 rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/20" onClick={handleResetDataset}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {ENABLEMENT_HUB_SPOKES.filter((spoke) => spoke.id !== "manager").map((spoke) => (
                <Link key={spoke.id} to={createPageUrl(spoke.page)} className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:border-teal-300/60 hover:bg-white/10">
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-200">{spoke.label}</p>
                  <p className="text-sm font-semibold text-white">{spoke.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">{spoke.summary}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Priority queue</p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">Who managers should coach next</h3>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{interventionQueue.length} active interventions</span>
          </div>
          <div className="mt-4 space-y-3">
            {coachingPriority.slice(0, 4).map((rep, index) => (
              <button key={rep.id} type="button" onClick={() => { setSelectedRepId(rep.id); setActiveTab("reps"); }} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:border-teal-200 hover:bg-teal-50/50">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{index + 1}. {rep.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{rep.territory} · {getBehavioralMetricLabel(rep.improvementPriority)} · {rep.sessionsCompleted30d} sessions in 30d</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{rep.overallScore}/5</p>
                  <StatusBadge status={rep.status} />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Manager operating standard</p>
          <h3 className="mt-1 text-lg font-bold text-slate-900">Intervention guidance</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">Escalate low-adoption, low-score reps into mandatory remediation sequences within Learning Paths.</div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">Use scenario-level weakness to assign a targeted module before asking for additional simulator volume.</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">Package current territory summaries into Data and Reports for leadership visibility with auditable metric pills attached.</div>
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpiCards.filter((card) => card.explanation || card.label === "Active Reps" || card.label === "Team Sessions (30d)").map(({ label, value, sub, icon: Icon, tone, explanation }) => {
          const toneMap = {
            teal: { icon: "text-teal-700", card: "bg-teal-50 border-teal-200", value: "text-teal-800" },
            navy: { icon: "text-[#1A334D]", card: "bg-slate-100 border-slate-300", value: "text-[#1A334D]" },
            amber: { icon: "text-amber-700", card: "bg-amber-50 border-amber-200", value: "text-amber-800" },
          };
          const selectedTone = toneMap[tone] || toneMap.navy;
          return (
            <div key={label} className={`rounded-xl border p-4 ${selectedTone.card}`}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${selectedTone.icon}`} />
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
                </div>
                <MetricPill explanation={explanation} label="Formula" />
              </div>
              <p className={`text-2xl font-bold ${selectedTone.value}`}>{value}</p>
              {sub ? <p className="mt-0.5 text-xs text-gray-500">{sub}</p> : null}
            </div>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 h-auto flex-wrap gap-2 bg-transparent p-0">
          <TabsTrigger value="reps" className="flex items-center gap-1.5 rounded-full border border-[#1A334D] px-4 py-2 text-sm transition-all hover:border-[#39ACAC] hover:bg-[#e6f7f7] hover:text-[#39ACAC] data-[state=active]:border-[#1A334D] data-[state=active]:bg-[#39ACAC] data-[state=active]:text-white"><Users className="h-3.5 w-3.5" /> Rep Overview</TabsTrigger>
          <TabsTrigger value="territory" className="flex items-center gap-1.5 rounded-full border border-[#1A334D] px-4 py-2 text-sm transition-all hover:border-[#39ACAC] hover:bg-[#e6f7f7] hover:text-[#39ACAC] data-[state=active]:border-[#1A334D] data-[state=active]:bg-[#39ACAC] data-[state=active]:text-white"><BarChart3 className="h-3.5 w-3.5" /> Territory Analytics</TabsTrigger>
          <TabsTrigger value="modules" className="flex items-center gap-1.5 rounded-full border border-[#1A334D] px-4 py-2 text-sm transition-all hover:border-[#39ACAC] hover:bg-[#e6f7f7] hover:text-[#39ACAC] data-[state=active]:border-[#1A334D] data-[state=active]:bg-[#39ACAC] data-[state=active]:text-white"><GraduationCap className="h-3.5 w-3.5" /> Training Modules</TabsTrigger>
          <TabsTrigger value="sessions" className="flex items-center gap-1.5 rounded-full border border-[#1A334D] px-4 py-2 text-sm transition-all hover:border-[#39ACAC] hover:bg-[#e6f7f7] hover:text-[#39ACAC] data-[state=active]:border-[#1A334D] data-[state=active]:bg-[#39ACAC] data-[state=active]:text-white"><MessageCircle className="h-3.5 w-3.5" /> Session Feedback</TabsTrigger>
          <TabsTrigger value="snippets" className="flex items-center gap-1.5 rounded-full border border-[#1A334D] px-4 py-2 text-sm transition-all hover:border-[#39ACAC] hover:bg-[#e6f7f7] hover:text-[#39ACAC] data-[state=active]:border-[#1A334D] data-[state=active]:bg-[#39ACAC] data-[state=active]:text-white"><Star className="h-3.5 w-3.5" /> Curate Snippets</TabsTrigger>
        </TabsList>

        <TabsContent value="reps">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_380px] xl:items-start">
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-5 py-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-gray-900">Rep performance snapshot</h2>
                      <p className="text-xs text-gray-500">Aligned to the current 14-rep Manager View dataset. No rep is selected by default; click a row to open rep-level detail and coaching context.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">{viewState.datasetScope.detail}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">Last refreshed {formatRefreshTimestamp(viewState.refreshedAt)}</span>
                      <span className={`rounded-full border px-2.5 py-1 font-semibold ${selectedRep ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-600"}`}>{selectedRep ? `${selectedRep.name} selected` : "No rep selected"}</span>
                      <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={handleRefreshDataset}>
                        <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={() => setSelectedRepId(null)}>
                        <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset selection
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="max-h-[780px] overflow-auto">
                  <table className="w-full min-w-[1120px] table-fixed text-sm">
                    <colgroup>
                      <col className="w-[240px]" />
                      <col className="w-[120px]" />
                      <col className="w-[120px]" />
                      <col className="w-[180px]" />
                      <col className="w-[210px]" />
                      <col className="w-[110px]" />
                      <col className="w-[170px]" />
                      <col className="w-[130px]" />
                    </colgroup>
                    <thead className="sticky top-0 z-10 bg-gray-50">
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Rep</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Overall Score</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Sessions (30d)</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Strongest Capability</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Capability Requiring Improvement</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Sales Trend</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Modules Completed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {reps.map((rep) => (
                        <RepRow
                          key={rep.id}
                          rep={rep}
                          derived={viewState.derivedByRepId[rep.id]}
                          explanations={viewState.explanations.rep[rep.id]}
                          onSelect={(selected) => setSelectedRepId(selected.id)}
                          selected={selectedRep?.id === rep.id}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4 self-start xl:sticky xl:top-4">
                {selectedRep ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: "#1A334D" }}>
                        {selectedRep.name.split(" ").map((word) => word[0]).join("")}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{selectedRep.name}</h3>
                        <p className="text-xs text-gray-500">{selectedRep.specialty} · {selectedRep.territory}</p>
                        <StatusBadge status={selectedRep.status} />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {[
                        { label: "Sessions (30d)", value: selectedRep.sessionsCompleted30d, explanation: null },
                        { label: "Overall Score", value: `${selectedRep.overallScore}/5`, explanation: viewState.explanations.rep[selectedRep.id].overallScore },
                        { label: "Practice Streak", value: selectedRep.practiceStreakDays > 0 ? `${selectedRep.practiceStreakDays} days` : "None", explanation: null },
                        { label: "Modules Done", value: `${selectedRep.coachingModulesCompleted}/8`, explanation: viewState.explanations.rep[selectedRep.id].moduleCompletion },
                      ].map(({ label, value, explanation }) => (
                        <div key={label} className="rounded-lg bg-gray-50 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-gray-500">{label}</p>
                            <MetricPill explanation={explanation} label="Formula" />
                          </div>
                          <p className="text-lg font-bold text-gray-900">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
                        <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-teal-800"><CheckCircle className="h-3 w-3" /> Strongest Capability</p>
                        <p className="text-sm font-bold text-teal-900">{getBehavioralMetricLabel(selectedRep.strongestCapability)}</p>
                        <p className="mt-1 text-xs text-teal-700">Score {selectedRep.behavioralMetrics[selectedRep.strongestCapability].score}/5 · Trend {selectedRep.behavioralMetrics[selectedRep.strongestCapability].trend}</p>
                        <div className="mt-2"><MetricPill explanation={viewState.explanations.rep[selectedRep.id].strongestCapability} label="Source" /></div>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-amber-800"><AlertTriangle className="h-3 w-3" /> Capability Requiring Improvement</p>
                        <p className="text-sm font-bold text-amber-900">{getBehavioralMetricLabel(selectedRep.improvementPriority)}</p>
                        <p className="mt-1 text-xs text-amber-700">Score {selectedRep.behavioralMetrics[selectedRep.improvementPriority].score}/5 · Trend {selectedRep.behavioralMetrics[selectedRep.improvementPriority].trend}</p>
                        <div className="mt-2"><MetricPill explanation={viewState.explanations.rep[selectedRep.id].improvementPriority} label="Source" /></div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Behavioral Metrics</p>
                          <p className="mt-1 text-xs text-slate-500">Data Source: Rep + Territory Metrics · Full 8-metric profile for explainability and auditability.</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">Observation depth {selectedRep.observationDepth}</span>
                      </div>
                      <div className="mt-4 grid gap-3">
                        {BEHAVIORAL_METRIC_KEYS.map((metricKey) => {
                          const metric = selectedRep.behavioralMetrics[metricKey];
                          return (
                            <div key={metricKey} className="grid grid-cols-[minmax(0,1.4fr)_80px_72px_96px] items-center gap-3 rounded-xl border border-white bg-white px-3 py-2 shadow-sm">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{getBehavioralMetricLabel(metricKey)}</p>
                                <p className="text-[11px] text-slate-500">{selectedRep.territory} rep metric</p>
                              </div>
                              <p className="text-sm font-bold text-slate-900">{metric.score}/5</p>
                              <TrendBadge trend={metric.trend} />
                              <p className="text-xs text-slate-500">Observed {metric.sessionsObserved}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Deterministic derived metrics</p>
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">Current demo calculation logic</span>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {[
                          { label: "Engagement", value: `${viewState.derivedByRepId[selectedRep.id].engagementScore}/100`, explanation: viewState.explanations.rep[selectedRep.id].engagementScore },
                          { label: "Readiness", value: `${viewState.derivedByRepId[selectedRep.id].readinessScore}/100`, explanation: viewState.explanations.rep[selectedRep.id].readinessScore },
                          { label: "Engagement Stability", value: `${viewState.derivedByRepId[selectedRep.id].engagementStabilityScore}/100`, explanation: viewState.explanations.rep[selectedRep.id].engagementStabilityScore },
                          { label: "Conversion Proxy", value: `${viewState.derivedByRepId[selectedRep.id].conversionProxyScore}/100`, explanation: viewState.explanations.rep[selectedRep.id].conversionProxyScore },
                          { label: "Sales Risk", value: `${viewState.derivedByRepId[selectedRep.id].salesRiskScore}/100`, explanation: viewState.explanations.rep[selectedRep.id].salesRiskScore },
                          { label: "Data Confidence", value: `${Math.round(viewState.derivedByRepId[selectedRep.id].dataConfidenceIndex * 100)}%`, explanation: viewState.explanations.rep[selectedRep.id].dataConfidenceIndex },
                          { label: "Predictive Confidence", value: `${Math.round(viewState.derivedByRepId[selectedRep.id].confidenceScore * 100)}%`, explanation: viewState.explanations.rep[selectedRep.id].confidenceScore },
                        ].map(({ label, value, explanation }) => (
                          <div key={label} className="rounded-lg bg-white p-3 shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs text-slate-500">{label}</p>
                              <MetricPill explanation={explanation} label="Formula" />
                            </div>
                            <p className="text-lg font-bold text-slate-900">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Deterministic risk signals</p>
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">{viewState.repRiskFlagsByRepId[selectedRep.id]?.length || 0} active rules</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {(viewState.repRiskFlagsByRepId[selectedRep.id] || []).length ? (
                          viewState.repRiskFlagsByRepId[selectedRep.id].map((flag) => (
                            <div key={flag.ruleId} className={`rounded-lg border px-3 py-2 text-sm ${flag.severity === "high" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-white text-slate-700"}`}>
                              <p className="font-semibold">{flag.label}</p>
                              <p className="mt-1 text-xs leading-5">{flag.explanation}</p>
                            </div>
                          ))
                        ) : (
                          <p className="rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm text-teal-700">No deterministic risk rules are currently triggered for this rep.</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Module Completion</p>
                        <MetricPill explanation={viewState.explanations.rep[selectedRep.id].moduleCompletion} label="Formula" />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{
                              width: `${(selectedRep.coachingModulesCompleted / 8) * 100}%`,
                              background: selectedRep.coachingModulesCompleted === 8 ? "#14b8a6" : "#f59e0b",
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600">{Math.round((selectedRep.coachingModulesCompleted / 8) * 100)}%</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center shadow-sm">
                    <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                    <p className="text-sm text-gray-500">No rep selected. Territory-level insights remain active, and rep-level insights will render only after an explicit selection.</p>
                    <div className="mt-4 flex justify-center">
                      <Button size="sm" variant="outline" onClick={handleRefreshDataset}>
                        <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh dataset
                      </Button>
                    </div>
                  </div>
                )}

                {selectedRep ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <AssignmentPanel
                      rep={{ ...selectedRep, weakCapability: getBehavioralMetricLabel(selectedRep.improvementPriority) }}
                      assignments={assignments}
                      onAssigned={loadAssignments}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            {ENABLE_MANAGER_INSIGHTS && managerMetricsPayload && viewState.validation.isValid ? (
              <div className="manager-insights-container">
                <ManagerInsightsPanelExpanded key={`${selectedRep?.id ?? "territory"}-${viewState.version}`} data={managerMetricsPayload} />
              </div>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="territory">
          <div className="space-y-6">
            {viewState.validation.isValid ? (
              <ManagerInsightsPanel
                key={`territory-${viewState.version}`}
                analyticsData={territoryInsightsData}
                title="National Team Aggregate predictive coaching layer"
                subtitle="Advisory outlook built from the current 14-rep Manager View dataset, territory performance, and deterministic behavior-level signals."
              />
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
                Territory AI insights are hidden until metric validation passes. Deterministic territory aggregates remain available below.
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[viewState.nationalTerritory, ...viewState.territories].map((territory) => {
                const territoryExplanations = viewState.explanations.territory[territory.territory];
                const territoryContributors = getContributorSet(viewState.contributors, territory.territory);
                const territoryRiskFlags = viewState.territoryRiskFlagsByName[territory.territory] || [];
                return (
                  <div key={territory.territory} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{territory.territory}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <p className="text-lg font-bold text-slate-900">{territory.avgPerformance}/5</p>
                          <MetricPill explanation={territoryExplanations.avgPerformance} label="Formula" />
                        </div>
                      </div>
                      <div className="space-y-2 text-right">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${territory.riskLevel === "high" ? "bg-amber-50 text-amber-700" : territory.riskLevel === "moderate" ? "bg-slate-100 text-slate-700" : "bg-teal-50 text-teal-700"}`}>
                          {territory.riskLevel} risk
                        </span>
                        <div className="flex justify-end">
                          <MetricPill explanation={territoryExplanations.riskLevel} label="Rule" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-slate-500">
                      <div className="flex items-center justify-between gap-2">
                        <span>Gap {territory.mostCommonCapabilityGap ? getBehavioralMetricLabel(territory.mostCommonCapabilityGap) : "None"}</span>
                        <MetricPill explanation={territoryExplanations.mostCommonCapabilityGap} label="Source" />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>Engagement {territory.avgEngagement}/100</span>
                        <MetricPill explanation={territoryExplanations.avgEngagement} label="Formula" />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>Volatility {territory.territoryVolatility}</span>
                        <MetricPill explanation={territoryExplanations.territoryVolatility} label="Formula" />
                      </div>
                      {territoryRiskFlags.length ? (
                        <p>Risk rules {territoryRiskFlags.map((flag) => flag.explanation).join(" · ")}</p>
                      ) : (
                        <p>Risk rules None triggered</p>
                      )}
                      <p>Top pattern {territory.topPerformingBehaviorPattern.map(getBehavioralMetricLabel).join(", ") || "None"}</p>
                      <p>Weighted aggregation {Object.entries(territory.aggregationWeights).map(([repId, weight]) => `${reps.find((rep) => rep.id === repId)?.name.split(" ")[0] || repId} ${Math.round(weight * 100)}%`).join(", ")}</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                        <Activity className="h-3 w-3" />
                        {territory.repIds.length} reps in aggregate
                      </span>
                      <ContributorDialog
                        territory={territory}
                        contributors={territoryContributors}
                        territoryExplanations={territoryExplanations}
                        onSelectRep={handleSelectRepFromContributor}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-5 pt-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Team Signal Intelligence Profile</h3>
                    <p className="text-xs text-gray-500">National Team Aggregate average vs. benchmark across all 8 capabilities</p>
                  </div>
                  <MetricPill explanation={viewState.explanations.overview.territoryAverage} label="Aggregate" />
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={territoryRadarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="capability" tick={{ fontSize: 9, fill: "#475569" }} />
                    <Radar name="Team Avg" dataKey="team" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.2} strokeWidth={2} />
                    <Radar name="Benchmark" dataKey="benchmark" stroke="#94a3b8" fill="none" strokeWidth={1.5} strokeDasharray="4 4" />
                    <Legend iconType="line" wrapperStyle={{ fontSize: 10 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 pt-6">
                <h3 className="mb-1 text-sm font-bold text-gray-900">Sessions per Rep (Last 30 Days)</h3>
                <p className="mb-4 text-xs text-gray-500">Platform engagement across the current Manager View dataset</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reps.map((rep) => ({ name: rep.name.split(" ")[0], sessions: rep.sessionsCompleted30d, score: rep.overallScore }))} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} width={70} />
                    <Tooltip formatter={(value, name) => [value, name === "sessions" ? "Sessions" : "Overall Score"]} />
                    <Bar dataKey="sessions" fill="#14b8a6" radius={[0, 4, 4, 0]} name="Sessions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 pt-6 lg:col-span-2">
                <h3 className="mb-4 text-sm font-bold text-gray-900">Performance Snapshot</h3>
                <div className="space-y-3">
                  {[...reps].sort((a, b) => b.overallScore - a.overallScore).map((rep) => (
                    <button key={rep.id} type="button" onClick={() => { setSelectedRepId(rep.id); setActiveTab("reps"); }} className="flex w-full items-center gap-4 text-left">
                      <div className="w-28 truncate text-xs font-medium text-gray-700">{rep.name.split(" ")[0]}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-gray-100">
                            <div className="h-2 rounded-full" style={{ width: `${(rep.overallScore / 5) * 100}%`, background: rep.overallScore >= 4 ? "#14b8a6" : rep.overallScore >= 3.3 ? "#3b82f6" : "#f97316" }} />
                          </div>
                          <span className="w-10 text-xs font-bold text-gray-700">{rep.overallScore}/5</span>
                        </div>
                      </div>
                      <span className="w-16 text-right text-xs text-gray-500">{rep.sessionsCompleted30d} sessions</span>
                      <StatusBadge status={rep.status} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="modules">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Training Modules by Signal Intelligence Capability</h2>
                <p className="text-sm text-gray-500">All 8 capabilities with aligned coaching content your reps are evaluated on</p>
              </div>
              <Select value={selectedCapabilityFilter} onValueChange={setSelectedCapabilityFilter}>
                <SelectTrigger className="w-56 text-sm">
                  <SelectValue placeholder="Filter by capability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Capabilities</SelectItem>
                  {SIGNAL_CAPABILITIES.map((capability) => <SelectItem key={capability.id} value={capability.id}>{capability.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {SIGNAL_CAPABILITIES.filter((capability) => selectedCapabilityFilter === "all" || selectedCapabilityFilter === capability.id).map((capability) => {
                const capabilityModules = filteredModules.filter((module) => module.capability === capability.id);
                const Icon = capability.icon;
                const weakReps = reps.filter((rep) => rep.improvementPriority === capability.id);
                return (
                  <div key={capability.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:border-teal-200 hover:shadow-md">
                    <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-4" style={{ background: `${capability.color}0d` }}>
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: capability.color }}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-gray-900">{capability.label} <span className="text-xs font-normal text-gray-500">{capability.subtitle}</span></h3>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {capability.metrics.map((metric) => (
                            <span key={metric} className="text-xs text-gray-500">{metric}</span>
                          ))}
                        </div>
                      </div>
                      {weakReps.length > 0 ? <span className="flex-shrink-0 text-xs font-semibold text-amber-700">{weakReps.length} rep{weakReps.length > 1 ? "s" : ""} need focus</span> : null}
                    </div>

                    <div className="space-y-2 p-4">
                      {capabilityModules.length === 0 ? (
                        <p className="py-3 text-center text-xs italic text-gray-500">No modules for this capability yet</p>
                      ) : capabilityModules.map((module) => (
                        <div key={module.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent bg-gray-50 p-2.5 transition-all hover:border-teal-100 hover:bg-teal-50">
                          <BookOpen className="h-4 w-4 flex-shrink-0 text-gray-500" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-gray-800">{module.title}</p>
                            <p className="text-xs text-gray-500">{module.type} · {module.duration}</p>
                          </div>
                          <span className={`flex-shrink-0 text-xs font-semibold ${module.level === "Advanced" ? "text-rose-600" : module.level === "Intermediate" ? "text-amber-600" : "text-green-600"}`}>{module.level}</span>
                        </div>
                      ))}
                    </div>

                    {weakReps.length > 0 ? (
                      <div className="px-4 pb-4">
                        <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-amber-700"><AlertTriangle className="h-3 w-3" /> Reps to prioritize:</p>
                        <div className="flex flex-wrap gap-1">
                          {weakReps.map((rep) => (
                            <span key={rep.id} className="text-xs font-medium text-amber-800">{rep.name.split(" ")[0]}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sessions">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Rep Session Feedback</h2>
              <p className="text-sm text-gray-600">Review recent role-play sessions and leave direct coaching feedback for your reps.</p>
            </div>
            {sessions.map((session) => (
              <div key={session.id} className={`space-y-3 rounded-xl border bg-white p-5 pt-6 ${session.status === "needs_feedback" ? "border-amber-200" : "border-gray-200"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "#1A334D" }}>
                      {session.rep_name.split(" ").map((word) => word[0]).join("")}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{session.rep_name}</p>
                      <p className="text-xs text-gray-500">{session.scenario}</p>
                      <p className="text-xs text-gray-500">{session.date}</p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <span className={`rounded-lg px-2 py-0.5 text-sm font-bold ${session.score >= 4 ? "bg-teal-50 text-teal-700" : session.score >= 3.3 ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}>{session.score}/5</span>
                    {session.status === "reviewed" ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-green-700"><CheckCircle className="h-3 w-3" /> Reviewed</span>
                    ) : (
                      <span className="text-xs font-semibold text-amber-700">Needs Feedback</span>
                    )}
                  </div>
                </div>
                {session.managerFeedback ? (
                  <div className="rounded-lg border border-teal-100 bg-teal-50 px-4 py-3">
                    <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-teal-700"><MessageCircle className="h-3 w-3" /> Your Feedback</p>
                    <p className="text-sm leading-relaxed text-gray-700">{session.managerFeedback}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      value={feedbackDraft[session.id] || ""}
                      onChange={(event) => setFeedbackDraft((prev) => ({ ...prev, [session.id]: event.target.value }))}
                      placeholder={`Leave coaching feedback for ${session.rep_name.split(" ")[0]}...`}
                      className="min-h-[80px] text-sm"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        className="bg-teal-500 text-white hover:bg-teal-600"
                        disabled={!feedbackDraft[session.id]?.trim() || feedbackSaving[session.id]}
                        onClick={() => saveSessionFeedback(session.id)}
                      >
                        {feedbackSaving[session.id] ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : feedbackSaved[session.id] ? <CheckCircle className="mr-1 h-3.5 w-3.5" /> : <MessageCircle className="mr-1 h-3.5 w-3.5" />}
                        {feedbackSaved[session.id] ? "Saved!" : "Save Feedback"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="snippets">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Curate Peer Best Practices</h2>
              <p className="text-sm text-gray-600">Review and feature top communication snippets shared by your team. Curated snippets appear highlighted in the Knowledge Base.</p>
            </div>
            {snippets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
                <Star className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm font-semibold text-gray-600">No shared snippets yet</p>
                <p className="mt-1 text-xs text-gray-500">Reps can share snippets via the Knowledge Base → Peer Best Practices tab</p>
              </div>
            ) : (
              <div className="space-y-3">
                {snippets.map((snippet) => (
                  <div key={snippet.id} className={`rounded-xl border bg-white p-5 pt-6 transition-all ${snippet.curated ? "border-amber-300 bg-amber-50/30" : "border-gray-200 hover:border-teal-200"}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-semibold text-gray-900">{snippet.title}</h4>
                          {snippet.curated ? <span className="flex items-center gap-1 text-xs font-semibold text-amber-700"><Trophy className="h-2.5 w-2.5" /> Featured</span> : null}
                          {snippet.capability ? <span className="text-xs font-medium text-[#1A334D]">{snippet.capability.replace(/_/g, " ")}</span> : null}
                        </div>
                        <p className="rounded-lg border border-gray-100 bg-white p-3 text-sm leading-relaxed text-gray-700">{snippet.content}</p>
                        {snippet.context ? <p className="text-xs italic text-gray-500">{snippet.context}</p> : null}
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">{snippet.shared_by_role || "Anonymous Rep"}</span>
                          <span className="text-xs text-gray-500">·</span>
                          <span className="flex items-center gap-0.5 text-xs text-gray-500"><ThumbsUp className="h-3 w-3" /> {snippet.upvotes || 0} upvotes</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={snippet.curated ? "default" : "outline"}
                        className={snippet.curated ? "flex-shrink-0 bg-amber-500 text-white hover:bg-amber-600" : "flex-shrink-0 border-amber-300 text-amber-700 hover:bg-amber-50"}
                        disabled={curating[snippet.id]}
                        onClick={() => toggleCurate(snippet)}
                      >
                        {curating[snippet.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="mr-1 h-3.5 w-3.5" />}
                        {snippet.curated ? "Unfeature" : "Feature"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
