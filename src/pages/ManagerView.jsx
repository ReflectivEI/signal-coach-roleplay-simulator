// @ts-nocheck
import React, { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, BarChart3, GraduationCap, AlertTriangle,
  MapPin, Play, BookOpen, Target, Shield, Ear, Heart, GitFork, Shuffle, Search,
  Star, Trophy, ThumbsUp, Loader2, MessageCircle, CheckCircle
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend } from "recharts";
import AssignmentPanel from "@/components/manager/AssignmentPanel";
import ManagerInsightsPanel from "@/components/manager/ManagerInsightsPanel";
import ManagerInsightsPanelExpanded from "@/components/manager/ManagerInsightsPanelExpanded";
import { ENABLEMENT_HUB_SPOKES, ENTERPRISE_SAMPLE_CONFIG, getAdoptionBand } from "@/lib/enablementHub";
import { ENABLE_MANAGER_INSIGHTS } from "@/components/manager/managerInsightsShared";
import {
  BEHAVIORAL_METRIC_KEYS,
  MANAGER_REP_DATASET,
  MANAGER_DERIVED_BY_REP_ID,
  MANAGER_TERRITORY_DATASET,
  NATIONAL_TERRITORY_DATA,
  MANAGER_DATASET_VALIDATION,
  buildManagerInsightsRequest,
  getBehavioralMetricLabel,
} from "@/components/manager/managerPerformanceData";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createPageUrl } from "@/utils";

const REPS = MANAGER_REP_DATASET;
const TERRITORIES = MANAGER_TERRITORY_DATASET;
const NATIONAL_TERRITORY = NATIONAL_TERRITORY_DATA;

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
  subtitle: key,
  icon: ICON_MAP[key] || Target,
  metrics: ["score", "trend", "sessionsObserved"],
  color: COLOR_MAP[key] || "#64748b",
}));

const TRAINING_MODULES = [
  { id: 1, capability: "signalAwareness", title: "Signal Awareness Masterclass", type: "Video + Practice", duration: "45 min", level: "Intermediate" },
  { id: 2, capability: "signalAwareness", title: "Question Timing Exercises", type: "Interactive", duration: "30 min", level: "Beginner" },
  { id: 3, capability: "signalInterpretation", title: "Interpretation Accuracy Drills", type: "Role-Play", duration: "60 min", level: "Advanced" },
  { id: 4, capability: "valueCommunication", title: "Evidence-to-Outcome Framing", type: "Case Studies", duration: "40 min", level: "Intermediate" },
  { id: 5, capability: "emotionalAttunement", title: "Emotional Attunement Signals", type: "Video", duration: "25 min", level: "Beginner" },
  { id: 6, capability: "objectionHandling", title: "Objection Handling Workshop", type: "Role-Play", duration: "50 min", level: "Advanced" },
  { id: 7, capability: "conversationControl", title: "Conversation Control & Flow", type: "Interactive", duration: "35 min", level: "Intermediate" },
  { id: 8, capability: "adaptability", title: "Real-Time Adaptability Techniques", type: "Simulation", duration: "55 min", level: "Advanced" },
  { id: 9, capability: "commitmentGeneration", title: "Commitment Generation Strategies", type: "Video + Practice", duration: "40 min", level: "Intermediate" },
  { id: 10, capability: "signalInterpretation", title: "Stakeholder Mapping Intensive", type: "Workshop", duration: "60 min", level: "Advanced" },
];

const territoryRadarData = BEHAVIORAL_METRIC_KEYS.map((key) => ({
  capability: getBehavioralMetricLabel(key),
  team: NATIONAL_TERRITORY.avgBehavioralMetrics[key],
  benchmark: Math.max(3.2, NATIONAL_TERRITORY.avgBehavioralMetrics[key] - 0.2),
}));

const MOCK_SESSIONS = REPS.slice(0, 5).map((rep, index) => ({
  id: `s${index + 1}`,
  rep_name: rep.name,
  rep_id: rep.id,
  scenario: `${rep.specialty} scenario review`,
  date: ["Mar 21, 2026", "Mar 20, 2026", "Mar 19, 2026", "Mar 18, 2026", "Mar 17, 2026"][index],
  score: rep.overallScore,
  status: index % 2 === 0 ? "needs_feedback" : "reviewed",
}));

function formatStatus(status) {
  return status === "needs_attention" ? "Needs Attention" : status.charAt(0).toUpperCase() + status.slice(1);
}

function StatusBadge({ status }) {
  return <span className={`text-xs font-medium ${status === 'active' ? 'text-green-700' : status === 'inactive' ? 'text-red-700' : 'text-amber-700'}`}>{formatStatus(status)}</span>;
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
      <span className="ml-1 font-mono text-[10px] text-slate-500">{metricKey}</span>
    </span>
  );
}

function RepRow({ rep, derived, onSelect, selected }) {
  return (
    <tr
      onClick={() => onSelect(rep)}
      className={`cursor-pointer transition-colors ${selected ? "bg-teal-50" : "hover:bg-gray-50"}`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0" style={{ background: "#1A334D" }}>
            {rep.name.split(" ").map(w => w[0]).join("")}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{rep.name}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-gray-600">{rep.specialty}</td>
      <td className="px-4 py-3 text-xs text-gray-600"><MapPin className="w-3 h-3 inline mr-1 text-gray-500" />{rep.territory}</td>
      <td className="px-4 py-3 text-center">
        <span className={`text-sm font-bold ${rep.overallScore >= 4 ? "text-teal-600" : rep.overallScore >= 3.3 ? "text-blue-600" : "text-amber-600"}`}>
          {rep.overallScore}/5
        </span>
      </td>
      <td className="px-4 py-3"><CapabilityPill metricKey={rep.strongestCapability} tone="teal" /></td>
      <td className="px-4 py-3"><CapabilityPill metricKey={rep.improvementPriority} tone="amber" /></td>
      <td className="px-4 py-3 text-center text-sm font-bold text-slate-700">{rep.sessionsCompleted30d}</td>
      <td className="px-4 py-3 text-center text-sm text-slate-700">{rep.coachingModulesCompleted}</td>
      <td className="px-4 py-3"><TrendBadge trend={rep.salesTrend} /></td>
      <td className="px-4 py-3">
        <StatusBadge status={rep.status} />
        <p className="mt-1 text-[11px] text-slate-500">Risk {derived.salesRiskScore}/100</p>
      </td>
    </tr>
  );
}

export default function ManagerView() {
  const [selectedRep, setSelectedRep] = useState(null);
  const [selectedCapabilityFilter, setSelectedCapabilityFilter] = useState("all");
  const [assignments, setAssignments] = useState([]);
  const [snippets, setSnippets] = useState([]);
  const [sessions, setSessions] = useState(MOCK_SESSIONS);
  const [feedbackDraft, setFeedbackDraft] = useState({});
  const [feedbackSaving, setFeedbackSaving] = useState({});
  const [feedbackSaved, setFeedbackSaved] = useState({});
  const [curating, setCurating] = useState({});

  useEffect(() => {
    // Load assignments and snippets on mount
    loadAssignments();
    loadSnippets();
  }, []);

  const loadAssignments = async () => {
    try {
      const res = await fetch('/api/assignments', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments || []);
      }
    } catch (err) {
      console.error('Load assignments error:', err);
      setAssignments([]);
    }
  };

  const loadSnippets = async () => {
    try {
      const res = await fetch('/api/snippets', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setSnippets(data.snippets || []);
      }
    } catch (err) {
      console.error('Load snippets error:', err);
      setSnippets([]);
    }
  };

  const saveSessionFeedback = async (sessionId) => {
    const text = feedbackDraft[sessionId]?.trim();
    if (!text) return;
    setFeedbackSaving(prev => ({ ...prev, [sessionId]: true }));
    try {
      // Store feedback in session (in real implementation would POST to backend)
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: "reviewed", managerFeedback: text } : s));
      setFeedbackSaved(prev => ({ ...prev, [sessionId]: true }));
      setTimeout(() => setFeedbackSaved(prev => ({ ...prev, [sessionId]: false })), 3000);
    } catch (err) {
      console.error('Save feedback error:', err);
    } finally {
      setFeedbackSaving(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  const toggleCurate = async (snippet) => {
    setCurating(prev => ({ ...prev, [snippet.id]: true }));
    try {
      setSnippets(prev => prev.map(s => s.id === snippet.id ? { ...s, curated: !s.curated } : s));
    } catch (err) {
      console.error('Curate snippet error:', err);
    } finally {
      setCurating(prev => ({ ...prev, [snippet.id]: false }));
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      const res = await fetch('/api/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      if (res.ok) {
        loadAssignments();
      }
    } catch (err) {
      console.error('Status change error:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      // In real implementation would DELETE to backend
      setAssignments(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
      loadAssignments();
    }
  };

  const totalSessions = REPS.reduce((sum, rep) => sum + rep.sessionsCompleted30d, 0);
  const avgTeamScore = Math.round((REPS.reduce((sum, rep) => sum + rep.overallScore, 0) / REPS.length) * 10) / 10;
  const atRisk = REPS.filter(rep => rep.status !== "active").length;

  const filteredModules = selectedCapabilityFilter === "all"
    ? TRAINING_MODULES
    : TRAINING_MODULES.filter(m => m.capability === selectedCapabilityFilter);
  const adoptionRate = Math.round((REPS.filter(rep => rep.sessionsCompleted30d >= 8).length / REPS.length) * 100);
  const moduleCompletionRate = Math.round((REPS.reduce((sum, rep) => sum + (rep.coachingModulesCompleted / 8), 0) / REPS.length) * 100);
  const interventionQueue = REPS.filter(rep => rep.status !== "active" || MANAGER_DERIVED_BY_REP_ID[rep.id].salesRiskScore >= 55 || rep.overallScore < 3.4);
  const coachingPriority = interventionQueue.slice().sort((a, b) => MANAGER_DERIVED_BY_REP_ID[b.id].salesRiskScore - MANAGER_DERIVED_BY_REP_ID[a.id].salesRiskScore);
  const adoptionBand = getAdoptionBand(adoptionRate);
  const selectedTerritoryData = (selectedRep && TERRITORIES.find((territory) => territory.territory === selectedRep.territory)) || NATIONAL_TERRITORY;

  const selectedRepInsightsData = selectedRep ? buildManagerInsightsRequest(selectedRep, selectedTerritoryData) : null;
  const territoryInsightsData = buildManagerInsightsRequest(null, NATIONAL_TERRITORY);
  const managerMetricsPayload = selectedRepInsightsData || territoryInsightsData;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto bg-slate-50/60 rounded-2xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#1A334D" }}>
            <Users className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Manager View</h1>
        </div>
        <p className="text-sm text-gray-500">Territory performance, rep activity, and training alignment across your team.</p>
        <div className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
          Data integrity {MANAGER_DATASET_VALIDATION.isValid ? "verified" : "needs review"} · 14 reps · full 8-metric canonical model
        </div>
      </div>

      <div className="mb-8 rounded-[28px] border border-slate-200 bg-gradient-to-r from-white to-slate-100 p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-600">Team intervention hub</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Manager View is now the intervention spoke for enterprise enablement.</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              This layer translates platform intelligence into manager actions: who needs support, what should be assigned, and where training adoption is drifting from performance outcomes.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: 'Adoption health', value: `${adoptionRate}%`, sub: adoptionBand },
                { label: 'Module completion', value: `${moduleCompletionRate}%`, sub: 'teamwide training completion' },
                { label: 'Intervention queue', value: interventionQueue.length, sub: 'reps requiring action' },
                { label: 'Reference panel', value: `${ENTERPRISE_SAMPLE_CONFIG.reps} reps`, sub: ENTERPRISE_SAMPLE_CONFIG.timeWindow },
              ].map((item) => (
                <div key={item.label} className="grid h-full min-h-[132px] grid-rows-[auto_1fr_auto] rounded-2xl border border-slate-200 bg-white p-4 pt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide leading-relaxed text-slate-500">{item.label}</p>
                  <p className="mt-3 self-center text-2xl font-bold text-slate-900">{item.value}</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">Hub and spoke routing</p>
            <div className="mt-4 space-y-3">
              {ENABLEMENT_HUB_SPOKES.filter(spoke => spoke.id !== 'manager').map((spoke) => (
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
              <div key={rep.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{index + 1}. {rep.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{rep.territory} · {getBehavioralMetricLabel(rep.improvementPriority)} · {rep.sessionsCompleted30d} sessions in 30d</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{rep.overallScore}/5</p>
                  <StatusBadge status={rep.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Manager operating standard</p>
          <h3 className="mt-1 text-lg font-bold text-slate-900">Intervention guidance</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">Escalate low-adoption, low-score reps into mandatory remediation sequences within Learning Paths.</div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">Use scenario-level weakness to assign a targeted module before asking for additional simulator volume.</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">Package monthly territory summaries into Data and Reports for leadership visibility.</div>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Active Reps", value: REPS.filter(r => r.status === "active").length, total: REPS.length, icon: Users, tone: "teal" },
          { label: "Team Sessions (30d)", value: totalSessions, sub: "across all reps", icon: Play, tone: "navy" },
          { label: "Team Avg Score", value: `${avgTeamScore}/5`, sub: "vs 3.3 benchmark", icon: BarChart3, tone: "teal" },
          { label: "Needs Attention", value: atRisk, sub: "reps below threshold", icon: AlertTriangle, tone: "amber" },
        ].map(({ label, value, sub, icon: Icon, tone }) => {
          const toneMap = {
            teal: { icon: "text-teal-700", card: "bg-teal-50 border-teal-200", value: "text-teal-800" },
            navy: { icon: "text-[#1A334D]", card: "bg-slate-100 border-slate-300", value: "text-[#1A334D]" },
            amber: { icon: "text-amber-700", card: "bg-amber-50 border-amber-200", value: "text-amber-800" },
          };
          const t = toneMap[tone] || toneMap.navy;
          return (
            <div key={label} className={`rounded-xl border p-4 ${t.card}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${t.icon}`} />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
              </div>
              <p className={`text-2xl font-bold ${t.value}`}>{value}</p>
              {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="reps">
        <TabsList className="mb-6 bg-transparent flex-wrap h-auto gap-2 p-0">
          <TabsTrigger value="reps" className="text-sm px-4 py-2 rounded-full border border-[#1A334D] hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] data-[state=active]:bg-[#39ACAC] data-[state=active]:text-white data-[state=active]:border-[#1A334D] flex items-center gap-1.5 transition-all"><Users className="w-3.5 h-3.5" /> Rep Overview</TabsTrigger>
          <TabsTrigger value="territory" className="text-sm px-4 py-2 rounded-full border border-[#1A334D] hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] data-[state=active]:bg-[#39ACAC] data-[state=active]:text-white data-[state=active]:border-[#1A334D] flex items-center gap-1.5 transition-all"><BarChart3 className="w-3.5 h-3.5" /> Territory Analytics</TabsTrigger>
          <TabsTrigger value="modules" className="text-sm px-4 py-2 rounded-full border border-[#1A334D] hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] data-[state=active]:bg-[#39ACAC] data-[state=active]:text-white data-[state=active]:border-[#1A334D] flex items-center gap-1.5 transition-all"><GraduationCap className="w-3.5 h-3.5" /> Training Modules</TabsTrigger>
          <TabsTrigger value="sessions" className="text-sm px-4 py-2 rounded-full border border-[#1A334D] hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] data-[state=active]:bg-[#39ACAC] data-[state=active]:text-white data-[state=active]:border-[#1A334D] flex items-center gap-1.5 transition-all"><MessageCircle className="w-3.5 h-3.5" /> Session Feedback</TabsTrigger>
          <TabsTrigger value="snippets" className="text-sm px-4 py-2 rounded-full border border-[#1A334D] hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] data-[state=active]:bg-[#39ACAC] data-[state=active]:text-white data-[state=active]:border-[#1A334D] flex items-center gap-1.5 transition-all"><Star className="w-3.5 h-3.5" /> Curate Snippets</TabsTrigger>
        </TabsList>

        {/* ── REP OVERVIEW TAB ── */}
        <TabsContent value="reps">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_360px] xl:items-start">
              <div className="sales-rep-container self-start overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-bold text-gray-900">Sales Representatives</h2>
                  <p className="text-xs text-gray-500">Click a rep to view their detailed profile</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Rep</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Specialty</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Territory</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Overall</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Strongest</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Needs Improvement</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Sessions</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Modules</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sales Trend</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {REPS.map(rep => (
                        <RepRow key={rep.id} rep={rep} derived={MANAGER_DERIVED_BY_REP_ID[rep.id]} onSelect={setSelectedRep} selected={selectedRep?.id === rep.id} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4 self-start xl:sticky xl:top-4">
                {selectedRep ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full text-white text-sm font-bold flex items-center justify-center flex-shrink-0" style={{ background: "#1A334D" }}>
                        {selectedRep.name.split(" ").map(w => w[0]).join("")}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{selectedRep.name}</h3>
                        <p className="text-xs text-gray-500">{selectedRep.specialty} · {selectedRep.territory}</p>
                        <StatusBadge status={selectedRep.status} />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {[
                        { label: "Sessions (30d)", value: selectedRep.sessionsCompleted30d },
                        { label: "Overall Score", value: `${selectedRep.overallScore}/5` },
                        { label: "Practice Streak", value: selectedRep.practiceStreakDays > 0 ? `${selectedRep.practiceStreakDays} days` : "None" },
                        { label: "Modules Done", value: `${selectedRep.coachingModulesCompleted}/8` },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500">{label}</p>
                          <p className="text-lg font-bold text-gray-900">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-teal-800 mb-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Strongest Capability
                        </p>
                        <p className="text-sm font-bold text-teal-900">{getBehavioralMetricLabel(selectedRep.strongestCapability)} <span className="font-mono text-xs text-teal-700">({selectedRep.strongestCapability})</span></p>
                        <p className="text-xs text-teal-700 mt-1">Score {selectedRep.behavioralMetrics[selectedRep.strongestCapability].score}/5 · Trend {selectedRep.behavioralMetrics[selectedRep.strongestCapability].trend}</p>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Capability Requiring Improvement
                        </p>
                        <p className="text-sm font-bold text-amber-900">{getBehavioralMetricLabel(selectedRep.improvementPriority)} <span className="font-mono text-xs text-amber-700">({selectedRep.improvementPriority})</span></p>
                        <p className="text-xs text-amber-700 mt-1">Score {selectedRep.behavioralMetrics[selectedRep.improvementPriority].score}/5 · Trend {selectedRep.behavioralMetrics[selectedRep.improvementPriority].trend}</p>
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
                                <p className="text-[11px] font-mono text-slate-500">{metricKey}</p>
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
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Deterministic derived metrics</p>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        {[
                          { label: 'Engagement', value: `${MANAGER_DERIVED_BY_REP_ID[selectedRep.id].engagementScore}/100` },
                          { label: 'Readiness', value: `${MANAGER_DERIVED_BY_REP_ID[selectedRep.id].readinessScore}/100` },
                          { label: 'Sales Risk', value: `${MANAGER_DERIVED_BY_REP_ID[selectedRep.id].salesRiskScore}/100` },
                          { label: 'Confidence', value: `${Math.round(MANAGER_DERIVED_BY_REP_ID[selectedRep.id].confidenceScore * 100)}%` },
                        ].map(({ label, value }) => (
                          <div key={label} className="rounded-lg bg-white p-3 shadow-sm">
                            <p className="text-xs text-slate-500">{label}</p>
                            <p className="text-lg font-bold text-slate-900">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Module Completion</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{
                              width: `${(selectedRep.coachingModulesCompleted / 8) * 100}%`,
                              background: selectedRep.coachingModulesCompleted === 8 ? "#14b8a6" : "#f59e0b"
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 font-medium">{Math.round((selectedRep.coachingModulesCompleted / 8) * 100)}%</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center shadow-sm">
                    <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Select a rep to view their detailed profile</p>
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

            {ENABLE_MANAGER_INSIGHTS && managerMetricsPayload ? (
              <div className="manager-insights-container">
                <ManagerInsightsPanelExpanded data={managerMetricsPayload} />
              </div>
            ) : null}
          </div>
        </TabsContent>

        {/* ── TERRITORY ANALYTICS TAB ── */}
        <TabsContent value="territory">
          <div className="space-y-6">
            <ManagerInsightsPanel
              analyticsData={territoryInsightsData}
              title="Territory predictive coaching layer"
              subtitle="Advisory outlook built from team engagement, territory performance, and behavior-level capability signals."
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {TERRITORIES.map((territory) => (
                <div key={territory.territory} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{territory.territory}</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">{territory.avgPerformance}/5</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${territory.riskLevel === 'high' ? 'bg-amber-50 text-amber-700' : territory.riskLevel === 'moderate' ? 'bg-slate-100 text-slate-700' : 'bg-teal-50 text-teal-700'}`}>
                      {territory.riskLevel} risk
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Gap {territory.mostCommonCapabilityGap ? getBehavioralMetricLabel(territory.mostCommonCapabilityGap) : 'None'} · Engagement {territory.avgEngagement}/100</p>
                  <p className="mt-2 text-xs text-slate-500">Top pattern {territory.topPerformingBehaviorPattern.map(getBehavioralMetricLabel).join(', ') || 'None'}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Radar */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 pt-6">
              <h3 className="text-sm font-bold text-gray-900 mb-1">Team Signal Intelligence Profile</h3>
              <p className="text-xs text-gray-500 mb-4">Team average vs. industry benchmark across all 8 capabilities</p>
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

            {/* Sessions per rep bar */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 pt-6">
              <h3 className="text-sm font-bold text-gray-900 mb-1">Sessions per Rep (Last 30 Days)</h3>
              <p className="text-xs text-gray-500 mb-4">Platform engagement across the territory</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={REPS.map(r => ({ name: r.name.split(" ")[0], sessions: r.sessionsCompleted30d, score: r.overallScore }))} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} width={70} />
                  <Tooltip formatter={(v, n) => [v, n === "sessions" ? "Sessions" : "Overall Score"]} />
                  <Bar dataKey="sessions" fill="#14b8a6" radius={[0, 4, 4, 0]} name="Sessions" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Rep performance table */}
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5 pt-6">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Performance Snapshot</h3>
              <div className="space-y-3">
                {[...REPS].sort((a, b) => b.overallScore - a.overallScore).map(rep => (
                  <div key={rep.id} className="flex items-center gap-4">
                    <div className="w-28 text-xs font-medium text-gray-700 truncate">{rep.name.split(" ")[0]}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full" style={{ width: `${(rep.overallScore / 5) * 100}%`, background: rep.overallScore >= 4 ? "#14b8a6" : rep.overallScore >= 3.3 ? "#3b82f6" : "#f97316" }} />
                        </div>
                        <span className="text-xs font-bold text-gray-700 w-10">{rep.overallScore}/5</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 w-16 text-right">{rep.sessionsCompleted30d} sessions</span>
                    <StatusBadge status={rep.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>
        </TabsContent>

        {/* ── TRAINING MODULES TAB ── */}
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
                  {SIGNAL_CAPABILITIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Capability cards with modules */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {SIGNAL_CAPABILITIES.filter(cap => selectedCapabilityFilter === "all" || selectedCapabilityFilter === cap.id).map(cap => {
                const capModules = filteredModules.filter(m => m.capability === cap.id);
                const Icon = cap.icon;
                // Find reps weak in this area
                const weakReps = REPS.filter(r => r.improvementPriority === cap.id);
                return (
                  <div key={cap.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-teal-200 hover:shadow-md transition-all">
                    {/* Cap header */}
                    <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3" style={{ background: `${cap.color}0d` }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cap.color }}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-sm">{cap.label} <span className="text-gray-500 font-normal text-xs">{cap.subtitle}</span></h3>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {cap.metrics.map(m => (
                            <span key={m} className="text-xs text-gray-500">{m}</span>
                          ))}
                        </div>
                      </div>
                      {weakReps.length > 0 && (
                        <span className="text-xs text-amber-700 font-semibold flex-shrink-0">
                          {weakReps.length} rep{weakReps.length > 1 ? "s" : ""} need focus
                        </span>
                      )}
                    </div>

                    {/* Modules */}
                    <div className="p-4 space-y-2">
                      {capModules.length === 0 ? (
                        <p className="text-xs text-gray-500 italic text-center py-3">No modules for this capability yet</p>
                      ) : capModules.map(mod => (
                        <div key={mod.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 hover:bg-teal-50 hover:border-teal-100 border border-transparent transition-all cursor-pointer">
                          <BookOpen className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{mod.title}</p>
                            <p className="text-xs text-gray-500">{mod.type} · {mod.duration}</p>
                          </div>
                          <span className={`text-xs flex-shrink-0 font-semibold ${mod.level === "Advanced" ? "text-rose-600" : mod.level === "Intermediate" ? "text-amber-600" : "text-green-600"}`}>{mod.level}</span>
                        </div>
                      ))}
                    </div>

                    {/* Weak reps */}
                    {weakReps.length > 0 && (
                      <div className="px-4 pb-4">
                        <p className="text-xs font-semibold text-amber-700 mb-1.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Reps to prioritize:
                        </p>
                        <div className="flex gap-1 flex-wrap">
                          {weakReps.map(r => (
                            <span key={r.id} className="text-xs text-amber-800 font-medium">{r.name.split(" ")[0]}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>
        {/* ── SESSION FEEDBACK TAB ── */}
        <TabsContent value="sessions">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Rep Session Feedback</h2>
              <p className="text-sm text-gray-600">Review recent role-play sessions and leave direct coaching feedback for your reps.</p>
            </div>
            {sessions.map(session => (
              <div key={session.id} className={`bg-white border rounded-xl p-5 pt-6 space-y-3 ${session.status === "needs_feedback" ? "border-amber-200" : "border-gray-200"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0" style={{ background: "#1A334D" }}>
                      {session.rep_name.split(" ").map(w => w[0]).join("")}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{session.rep_name}</p>
                      <p className="text-xs text-gray-500">{session.scenario}</p>
                      <p className="text-xs text-gray-500">{session.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${session.score >= 4 ? "bg-teal-50 text-teal-700" : session.score >= 3.3 ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}>{session.score}/5</span>
                    {session.status === "reviewed" ? (
                      <span className="text-xs text-green-700 font-semibold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Reviewed</span>
                    ) : (
                      <span className="text-xs text-amber-700 font-semibold">Needs Feedback</span>
                    )}
                  </div>
                </div>
                {session.managerFeedback ? (
                  <div className="bg-teal-50 border border-teal-100 rounded-lg px-4 py-3">
                    <p className="text-xs font-semibold text-teal-700 mb-1 flex items-center gap-1"><MessageCircle className="w-3 h-3" /> Your Feedback</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{session.managerFeedback}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      value={feedbackDraft[session.id] || ""}
                      onChange={e => setFeedbackDraft(prev => ({ ...prev, [session.id]: e.target.value }))}
                      placeholder={`Leave coaching feedback for ${session.rep_name.split(" ")[0]}...`}
                      className="text-sm min-h-[80px]"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        className="bg-teal-500 hover:bg-teal-600 text-white"
                        disabled={!feedbackDraft[session.id]?.trim() || feedbackSaving[session.id]}
                        onClick={() => saveSessionFeedback(session.id)}
                      >
                        {feedbackSaving[session.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : feedbackSaved[session.id] ? <CheckCircle className="w-3.5 h-3.5 mr-1" /> : <MessageCircle className="w-3.5 h-3.5 mr-1" />}
                        {feedbackSaved[session.id] ? "Saved!" : "Save Feedback"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── CURATE SNIPPETS TAB ── */}
        <TabsContent value="snippets">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Curate Peer Best Practices</h2>
              <p className="text-sm text-gray-600">Review and feature top communication snippets shared by your team. Curated snippets appear highlighted in the Knowledge Base.</p>
            </div>
            {snippets.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Star className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-600">No shared snippets yet</p>
                <p className="text-xs text-gray-500 mt-1">Reps can share snippets via the Knowledge Base → Peer Best Practices tab</p>
              </div>
            ) : (
              <div className="space-y-3">
                {snippets.map(snippet => (
                  <div key={snippet.id} className={`bg-white border rounded-xl p-5 pt-6 transition-all ${snippet.curated ? "border-amber-300 bg-amber-50/30" : "border-gray-200 hover:border-teal-200"}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-sm text-gray-900">{snippet.title}</h4>
                          {snippet.curated && <span className="text-xs text-amber-700 font-semibold flex items-center gap-1"><Trophy className="w-2.5 h-2.5" /> Featured</span>}
                          {snippet.capability && <span className="text-xs text-[#1A334D] font-medium">{snippet.capability.replace(/_/g, " ")}</span>}
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed bg-white border border-gray-100 rounded-lg p-3">{snippet.content}</p>
                        {snippet.context && <p className="text-xs text-gray-500 italic">{snippet.context}</p>}
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">{snippet.shared_by_role || "Anonymous Rep"}</span>
                          <span className="text-xs text-gray-500">·</span>
                          <span className="text-xs text-gray-500 flex items-center gap-0.5"><ThumbsUp className="w-3 h-3" /> {snippet.upvotes || 0} upvotes</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={snippet.curated ? "default" : "outline"}
                        className={snippet.curated ? "bg-amber-500 hover:bg-amber-600 text-white flex-shrink-0" : "flex-shrink-0 border-amber-300 text-amber-700 hover:bg-amber-50"}
                        disabled={curating[snippet.id]}
                        onClick={() => toggleCurate(snippet)}
                      >
                        {curating[snippet.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5 mr-1" />}
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
