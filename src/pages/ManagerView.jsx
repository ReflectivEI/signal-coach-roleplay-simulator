import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, BarChart3, GraduationCap, TrendingUp, CheckCircle2, AlertTriangle,
  MapPin, Play, BookOpen, Target, Shield, MessageSquare, Ear, Heart, GitFork, Shuffle, Search,
  Star, Trophy, ThumbsUp, ThumbsDown, Loader2, MessageCircle, CheckCircle
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend } from "recharts";
import AssignmentPanel from "@/components/manager/AssignmentPanel";
import { SIGNAL_CAPABILITIES as SOT_CAPABILITIES } from "@/components/roleplay/signalIntelligenceSOT";

// ── Mock territory data ──────────────────────────────────────────────────────
const REPS = [
  { id: 1, name: "Alex Thompson", territory: "Northeast", specialty: "Oncology", sessionsLast30: 12, avgScore: 4.1, streak: 5, modulesCompleted: 6, modulesAssigned: 8, weakCapability: "Commitment Generation", status: "active" },
  { id: 2, name: "Maria Santos", territory: "Southeast", specialty: "Cardiology", sessionsLast30: 8, avgScore: 3.6, streak: 2, modulesCompleted: 4, modulesAssigned: 8, weakCapability: "Objection Navigation", status: "active" },
  { id: 3, name: "James Park", territory: "Midwest", specialty: "Infectious Disease", sessionsLast30: 15, avgScore: 4.4, streak: 8, modulesCompleted: 8, modulesAssigned: 8, weakCapability: "Adaptive Response", status: "active" },
  { id: 4, name: "Sarah Williams", territory: "Southwest", specialty: "Neurology", sessionsLast30: 3, avgScore: 2.9, streak: 0, modulesCompleted: 2, modulesAssigned: 8, weakCapability: "Signal Awareness", status: "needs-attention" },
  { id: 5, name: "David Chen", territory: "West Coast", specialty: "Immunology", sessionsLast30: 10, avgScore: 3.8, streak: 4, modulesCompleted: 5, modulesAssigned: 8, weakCapability: "Value Connection", status: "active" },
  { id: 6, name: "Linda Nguyen", territory: "Mid-Atlantic", specialty: "Rare Disease", sessionsLast30: 0, avgScore: 0, streak: 0, modulesCompleted: 1, modulesAssigned: 8, weakCapability: "All areas", status: "inactive" },
];

// Icon mapping for capabilities
const ICON_MAP = {
  signal_awareness: Search,
  signal_interpretation: Ear,
  value_connection: Heart,
  customer_engagement: Users,
  objection_navigation: Shield,
  conversation_management: GitFork,
  adaptive_response: Shuffle,
  commitment_generation: Target,
};

const COLOR_MAP = {
  signal_awareness: "#14b8a6",
  signal_interpretation: "#0284c7",
  value_connection: "#8b5cf6",
  customer_engagement: "#f59e0b",
  objection_navigation: "#f97316",
  conversation_management: "#1A334D",
  adaptive_response: "#06b6d4",
  commitment_generation: "#10b981",
};

// Transform SOT data into manager view format with correct metric names from SOT
const SIGNAL_CAPABILITIES = SOT_CAPABILITIES.map(cap => ({
  id: cap.id,
  label: cap.label,
  subtitle: cap.measurement ? `(${cap.measurement})` : "",
  icon: ICON_MAP[cap.id] || Target,
  metrics: cap.coreMetrics.map(m => m.name),
  color: COLOR_MAP[cap.id] || "#64748b",
}));

const TRAINING_MODULES = [
  { id: 1, capability: "signal_awareness", title: "Signal Awareness Masterclass", type: "Video + Practice", duration: "45 min", level: "Intermediate" },
  { id: 2, capability: "signal_awareness", title: "Question Mastery Exercises", type: "Interactive", duration: "30 min", level: "Beginner" },
  { id: 3, capability: "signal_interpretation", title: "Listening & Responsiveness Drills", type: "Role-Play", duration: "60 min", level: "Advanced" },
  { id: 4, capability: "value_connection", title: "Clinical Evidence Framing", type: "Case Studies", duration: "40 min", level: "Intermediate" },
  { id: 5, capability: "customer_engagement", title: "HCP Engagement Signals", type: "Video", duration: "25 min", level: "Beginner" },
  { id: 6, capability: "objection_navigation", title: "Objection Handling Workshop", type: "Role-Play", duration: "50 min", level: "Advanced" },
  { id: 7, capability: "conversation_management", title: "Conversation Structure & Flow", type: "Interactive", duration: "35 min", level: "Intermediate" },
  { id: 8, capability: "adaptive_response", title: "Real-Time Adaptation Techniques", type: "Simulation", duration: "55 min", level: "Advanced" },
  { id: 9, capability: "commitment_generation", title: "Commitment Gaining Strategies", type: "Video + Practice", duration: "40 min", level: "Intermediate" },
  { id: 10, capability: "signal_interpretation", title: "Stakeholder Mapping Intensive", type: "Workshop", duration: "60 min", level: "Advanced" },
];

const territoryRadarData = [
  { capability: "Signal Awareness", team: 3.8, benchmark: 3.5 },
  { capability: "Signal Interpretation", team: 3.5, benchmark: 3.4 },
  { capability: "Value Connection", team: 3.6, benchmark: 3.2 },
  { capability: "Customer Engagement", team: 3.4, benchmark: 3.1 },
  { capability: "Objection Navigation", team: 3.2, benchmark: 3.0 },
  { capability: "Commitment Generation", team: 3.4, benchmark: 3.3 },
  { capability: "Conv. Management", team: 3.7, benchmark: 3.1 },
  { capability: "Adaptive Response", team: 3.3, benchmark: 3.2 },
];

// Mock recent role-play sessions for manager feedback
const MOCK_SESSIONS = [
  { id: "s1", rep_name: "Alex Thompson", rep_id: 1, scenario: "PrEP Access Barriers Despite Strong Adoption", date: "Feb 21, 2026", score: 4.1, status: "needs_feedback" },
  { id: "s2", rep_name: "Maria Santos", rep_id: 2, scenario: "Heart Failure GDMT Optimization Challenge", date: "Feb 20, 2026", score: 3.6, status: "needs_feedback" },
  { id: "s3", rep_name: "James Park", rep_id: 3, scenario: "HIV Prevention Gap in High-Risk Population", date: "Feb 19, 2026", score: 4.4, status: "reviewed" },
  { id: "s4", rep_name: "Sarah Williams", rep_id: 4, scenario: "Oncology KOL Introduction", date: "Feb 18, 2026", score: 2.9, status: "needs_feedback" },
  { id: "s5", rep_name: "David Chen", rep_id: 5, scenario: "Cardiology Formulary Review", date: "Feb 17, 2026", score: 3.8, status: "reviewed" },
];

// ...existing code...

function RepRow({ rep, onSelect, selected }) {
  const completionPct = Math.round((rep.modulesCompleted / rep.modulesAssigned) * 100);
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
            <p className="text-xs text-gray-500">{rep.specialty}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-gray-600"><MapPin className="w-3 h-3 inline mr-1 text-gray-400" />{rep.territory}</td>
      <td className="px-4 py-3 text-center">
        <span className={`text-sm font-bold ${rep.sessionsLast30 >= 8 ? "text-teal-600" : rep.sessionsLast30 >= 4 ? "text-amber-600" : "text-red-500"}`}>{rep.sessionsLast30}</span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`text-sm font-bold ${rep.avgScore >= 4 ? "text-teal-600" : rep.avgScore >= 3.3 ? "text-blue-600" : rep.avgScore > 0 ? "text-amber-600" : "text-gray-400"}`}>
          {rep.avgScore > 0 ? `${rep.avgScore}/5` : "—"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[60px]">
            <div className="rounded-full h-1.5" style={{ width: `${completionPct}%`, background: completionPct === 100 ? "#14b8a6" : "#f59e0b" }} />
          </div>
          <span className="text-xs text-gray-500">{rep.modulesCompleted}/{rep.modulesAssigned}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-amber-700 bg-amber-50 rounded">{rep.weakCapability}</td>
      <td className="px-4 py-3"><StatusBadge status={rep.status} /></td>
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

  useEffect(() => { loadAssignments(); loadSnippets(); }, []);

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

  const totalSessions = REPS.reduce((s, r) => s + r.sessionsLast30, 0);
  const avgTeamScore = Math.round(REPS.filter(r => r.avgScore > 0).reduce((s, r) => s + r.avgScore, 0) / REPS.filter(r => r.avgScore > 0).length * 10) / 10;
  const atRisk = REPS.filter(r => r.status !== "active").length;
  const topPerformer = [...REPS].sort((a, b) => b.avgScore - a.avgScore)[0];

  const filteredModules = selectedCapabilityFilter === "all"
    ? TRAINING_MODULES
    : TRAINING_MODULES.filter(m => m.capability === selectedCapabilityFilter);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#1A334D" }}>
            <Users className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Manager View</h1>
          <span className="text-xs bg-amber-100 text-amber-800 border border-amber-200 rounded-full px-2.5 py-0.5 font-medium">Manager Only</span>
        </div>
        <p className="text-sm text-gray-500">Territory performance, rep activity, and training alignment across your team.</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Active Reps", value: REPS.filter(r => r.status === "active").length, total: REPS.length, icon: Users, color: "text-teal-600 bg-teal-50 border-teal-200" },
          { label: "Team Sessions (30d)", value: totalSessions, sub: "across all reps", icon: Play, color: "text-blue-600 bg-blue-50 border-blue-200" },
          { label: "Team Avg Score", value: `${avgTeamScore}/5`, sub: "vs 3.3 benchmark", icon: BarChart3, color: "text-purple-600 bg-purple-50 border-purple-200" },
          { label: "Needs Attention", value: atRisk, sub: "reps below threshold", icon: AlertTriangle, color: "text-amber-600 bg-amber-50 border-amber-200" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className={`rounded-xl border p-4 ${color.split(" ").slice(1).join(" ")}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color.split(" ")[0]}`} />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
            </div>
            <p className={`text-2xl font-bold ${color.split(" ")[0]}`}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      <Tabs defaultValue="reps">
        <TabsList className="mb-6 bg-gray-100 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="reps" className="text-xs flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Rep Overview</TabsTrigger>
          <TabsTrigger value="territory" className="text-xs flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Territory Analytics</TabsTrigger>
          <TabsTrigger value="modules" className="text-xs flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> Training Modules</TabsTrigger>
          <TabsTrigger value="sessions" className="text-xs flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Session Feedback</TabsTrigger>
          <TabsTrigger value="snippets" className="text-xs flex items-center gap-1.5"><Star className="w-3.5 h-3.5" /> Curate Snippets</TabsTrigger>
        </TabsList>

        {/* ── REP OVERVIEW TAB ── */}
        <TabsContent value="reps">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Table */}
            <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-900">Sales Representatives</h2>
                <p className="text-xs text-gray-500">Click a rep to view their detailed profile</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Rep</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Territory</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Sessions</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Modules</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Weak Area</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {REPS.map(rep => (
                      <RepRow key={rep.id} rep={rep} onSelect={setSelectedRep} selected={selectedRep?.id === rep.id} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rep Detail Card */}
            <div>
              {selectedRep ? (
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 sticky top-4">
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

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Sessions (30d)", value: selectedRep.sessionsLast30 },
                      { label: "Avg Score", value: selectedRep.avgScore > 0 ? `${selectedRep.avgScore}/5` : "—" },
                      { label: "Practice Streak", value: selectedRep.streak > 0 ? `${selectedRep.streak} days` : "None" },
                      { label: "Modules Done", value: `${selectedRep.modulesCompleted}/${selectedRep.modulesAssigned}` },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="text-lg font-bold text-gray-900">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Focus Area
                    </p>
                    <p className="text-sm font-bold text-amber-900">{selectedRep.weakCapability}</p>
                    <p className="text-xs text-amber-700 mt-1">Assign relevant coaching modules to address this gap.</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Module Completion</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${(selectedRep.modulesCompleted / selectedRep.modulesAssigned) * 100}%`,
                            background: selectedRep.modulesCompleted === selectedRep.modulesAssigned ? "#14b8a6" : "#f59e0b"
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 font-medium">{Math.round((selectedRep.modulesCompleted / selectedRep.modulesAssigned) * 100)}%</span>
                    </div>
                  </div>

                  {/* Assignment Panel */}
                  <div className="border-t border-gray-100 pt-4">
                    <AssignmentPanel
                      rep={selectedRep}
                      assignments={assignments}
                      onAssigned={loadAssignments}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Select a rep to view their detailed profile</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── TERRITORY ANALYTICS TAB ── */}
        <TabsContent value="territory">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Radar */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
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
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-1">Sessions per Rep (Last 30 Days)</h3>
              <p className="text-xs text-gray-500 mb-4">Platform engagement across the territory</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={REPS.map(r => ({ name: r.name.split(" ")[0], sessions: r.sessionsLast30, score: r.avgScore }))} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} width={70} />
                  <Tooltip formatter={(v, n) => [v, n === "sessions" ? "Sessions" : "Avg Score"]} />
                  <Bar dataKey="sessions" fill="#14b8a6" radius={[0, 4, 4, 0]} name="Sessions" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Rep performance table */}
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Performance Snapshot</h3>
              <div className="space-y-3">
                {[...REPS].sort((a, b) => b.avgScore - a.avgScore).map(rep => (
                  <div key={rep.id} className="flex items-center gap-4">
                    <div className="w-28 text-xs font-medium text-gray-700 truncate">{rep.name.split(" ")[0]}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full" style={{ width: `${(rep.avgScore / 5) * 100}%`, background: rep.avgScore >= 4 ? "#14b8a6" : rep.avgScore >= 3.3 ? "#3b82f6" : rep.avgScore > 0 ? "#f97316" : "#e5e7eb" }} />
                        </div>
                        <span className="text-xs font-bold text-gray-700 w-10">{rep.avgScore > 0 ? `${rep.avgScore}/5` : "—"}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 w-16 text-right">{rep.sessionsLast30} sessions</span>
                    <StatusBadge status={rep.status} />
                  </div>
                ))}
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
                const weakReps = REPS.filter(r => r.weakCapability.toLowerCase().includes(cap.label.toLowerCase().split(" ")[0].toLowerCase()));
                return (
                  <div key={cap.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-teal-200 hover:shadow-md transition-all">
                    {/* Cap header */}
                    <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3" style={{ background: `${cap.color}0d` }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cap.color }}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-sm">{cap.label} <span className="text-gray-400 font-normal text-xs">{cap.subtitle}</span></h3>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {cap.metrics.map(m => (
                            <span key={m} className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{m}</span>
                          ))}
                        </div>
                      </div>
                      {weakReps.length > 0 && (
                        <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 flex-shrink-0">
                          {weakReps.length} rep{weakReps.length > 1 ? "s" : ""} need focus
                        </span>
                      )}
                    </div>

                    {/* Modules */}
                    <div className="p-4 space-y-2">
                      {capModules.length === 0 ? (
                        <p className="text-xs text-gray-400 italic text-center py-3">No modules for this capability yet</p>
                      ) : capModules.map(mod => (
                        <div key={mod.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 hover:bg-teal-50 hover:border-teal-100 border border-transparent transition-all cursor-pointer">
                          <BookOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{mod.title}</p>
                            <p className="text-xs text-gray-400">{mod.type} · {mod.duration}</p>
                          </div>
                          <span className={`text-xs flex-shrink-0 rounded-full px-2 py-0.5 border font-medium ${mod.level === "Advanced" ? "border-rose-200 text-rose-600 bg-rose-50" : mod.level === "Intermediate" ? "border-amber-200 text-amber-600 bg-amber-50" : "border-green-200 text-green-600 bg-green-50"}`}>
                            {mod.level}
                          </span>
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
                            <span key={r.id} className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-full px-2 py-0.5">{r.name.split(" ")[0]}</span>
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
              <div key={session.id} className={`bg-white border rounded-xl p-5 space-y-3 ${session.status === "needs_feedback" ? "border-amber-200" : "border-gray-200"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0" style={{ background: "#1A334D" }}>
                      {session.rep_name.split(" ").map(w => w[0]).join("")}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{session.rep_name}</p>
                      <p className="text-xs text-gray-500">{session.scenario}</p>
                      <p className="text-xs text-gray-400">{session.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${session.score >= 4 ? "bg-teal-50 text-teal-700" : session.score >= 3.3 ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}>{session.score}/5</span>
                    {session.status === "reviewed" ? (
                      <span className="text-xs bg-green-100 text-green-700 border border-green-200 rounded-full px-2 py-0.5 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Reviewed</span>
                    ) : (
                      <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">Needs Feedback</span>
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
                  <div key={snippet.id} className={`bg-white border rounded-xl p-5 transition-all ${snippet.curated ? "border-amber-300 bg-amber-50/30" : "border-gray-200 hover:border-teal-200"}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-sm text-gray-900">{snippet.title}</h4>
                          {snippet.curated && <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 flex items-center gap-1"><Trophy className="w-2.5 h-2.5" /> Featured</span>}
                          {snippet.capability && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#e6f7f7", color: "#1A334D", border: "1px solid #b2e4e4" }}>{snippet.capability.replace(/_/g, " ")}</span>}
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed bg-white border border-gray-100 rounded-lg p-3">{snippet.content}</p>
                        {snippet.context && <p className="text-xs text-gray-500 italic">{snippet.context}</p>}
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{snippet.shared_by_role || "Anonymous Rep"}</span>
                          <span className="text-xs text-gray-400">·</span>
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