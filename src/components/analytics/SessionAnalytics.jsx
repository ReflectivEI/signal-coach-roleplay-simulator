import React, { useMemo, useState } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LineChart, Line, CartesianGrid, Legend,
  ReferenceLine,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, AlertTriangle, Target, Activity, Calendar, Lightbulb, CheckCircle2, BookOpen, Play, GraduationCap, ArrowRight } from "lucide-react";
import { subDays, isAfter, parseISO, format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import StateTransitionFlow from "./StateTransitionFlow";
import GamificationPanel from "./GamificationPanel";
import AIActionableInsights from "./AIActionableInsights";

const BadgeField = /** @type {any} */ (Badge);
const SelectField = /** @type {any} */ (Select);
const SelectTriggerField = /** @type {any} */ (SelectTrigger);
const SelectValueField = /** @type {any} */ (SelectValue);
const SelectContentField = /** @type {any} */ (SelectContent);
const SelectItemField = /** @type {any} */ (SelectItem);
const TabsField = /** @type {any} */ (Tabs);
const TabsListField = /** @type {any} */ (TabsList);
const TabsTriggerField = /** @type {any} */ (TabsTrigger);
const GamificationPanelField = /** @type {any} */ (GamificationPanel);
const AIActionableInsightsField = /** @type {any} */ (AIActionableInsights);

// Mapping from capability key → coaching module + scenarios to recommend
const LEARNING_PATH_MAP = {
  signal_awareness: {
    coachingModule: "Question Mastery",
    moduleDesc: "Learn to ask purposeful, context-aware questions",
    scenarios: ["HIV Prevention Gap in High-Risk Population", "Oncology KOL Introduction"],
    frameworkLink: "signal_awareness",
    tip: "Practice building questions directly from what the HCP just said. Avoid pre-scripted openers.",
  },
  signal_interpretation: {
    coachingModule: "Stakeholder Mapping",
    moduleDesc: "Understand signals from different HCP types",
    scenarios: ["Treatment Optimization in Stable HIV Patients", "Rural HF Program with CKD Safety Concerns"],
    frameworkLink: "signal_interpretation",
    tip: "After each HCP statement, pause and paraphrase before responding. This sharpens interpretation.",
  },
  value_connection: {
    coachingModule: "Clinical Evidence",
    moduleDesc: "Connect clinical data to HCP-specific priorities",
    scenarios: ["Heart Failure GDMT Optimization Challenge", "ADC Integration with IO Backbone"],
    frameworkLink: "value_connection",
    tip: "Always reference something the HCP said before presenting value. 'Because you mentioned X...'",
  },
  objection_navigation: {
    coachingModule: "Objection Handling",
    moduleDesc: "Navigate resistance with composure and evidence",
    scenarios: ["PrEP Access Barriers Despite Strong Adoption", "Cardiology Formulary Review"],
    frameworkLink: "objection_navigation",
    tip: "Acknowledge first, explore second, respond third. Never jump straight to a rebuttal.",
  },
  commitment_generation: {
    coachingModule: "Closing Techniques",
    moduleDesc: "Secure specific, voluntary next steps",
    scenarios: ["Post-COVID Clinic Antiviral Adherence", "Primary Care Vaccine Capture Improvement"],
    frameworkLink: "commitment_generation",
    tip: "Ask for a specific action with a date, not a vague 'let's keep in touch'.",
  },
  conversation_management: {
    coachingModule: "Coaching Modules",
    moduleDesc: "Guide conversations with structure and intent",
    scenarios: ["Outpatient Antiviral Optimization", "Post-MI and HF Transitions Optimization"],
    frameworkLink: "conversation_management",
    tip: "Set a brief agenda at the start of every call and summarize before closing.",
  },
  adaptive_response: {
    coachingModule: "Behavioral Mastery",
    moduleDesc: "Flex your approach in real-time",
    scenarios: ["Pathway-Driven Care with Staffing Constraints", "Adult Flu Program Optimization"],
    frameworkLink: "adaptive_response",
    tip: "If the same approach isn't working, change it deliberately — not randomly.",
  },
};

function LearningPath({ weakCapability }) {
  const path = LEARNING_PATH_MAP[weakCapability.key];
  if (!path) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Step 1: Coaching Module */}
      <Link to={createPageUrl("CoachingModules")} className="group bg-white border border-teal-100 rounded-xl p-4 hover:border-teal-300 hover:shadow-sm transition-all">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center font-bold">1</div>
          <GraduationCap className="w-4 h-4 text-teal-500" />
          <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Coaching Module</span>
        </div>
        <p className="text-sm font-bold text-gray-900 mb-1">{path.coachingModule}</p>
        <p className="text-xs text-gray-500 leading-relaxed mb-3">{path.moduleDesc}</p>
        <span className="text-xs text-teal-600 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">Open Module <ArrowRight className="w-3 h-3" /></span>
      </Link>

      {/* Step 2: Practice Scenarios */}
      <Link to={createPageUrl("RolePlaySimulator")} className="group bg-white border border-teal-100 rounded-xl p-4 hover:border-teal-300 hover:shadow-sm transition-all">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center font-bold">2</div>
          <Play className="w-4 h-4 text-teal-500" />
          <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Practice Scenarios</span>
        </div>
        <p className="text-sm font-bold text-gray-900 mb-1">Recommended for you</p>
        <div className="space-y-1 mb-3">
          {path.scenarios.map((s, i) => (
            <p key={i} className="text-xs text-gray-600 flex items-start gap-1">
              <span className="text-teal-400 flex-shrink-0 mt-0.5">›</span> {s}
            </p>
          ))}
        </div>
        <span className="text-xs text-teal-600 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">Go to Simulator <ArrowRight className="w-3 h-3" /></span>
      </Link>

      {/* Step 3: Framework Deep Dive */}
      <Link to={createPageUrl("Frameworks")} className="group bg-white border border-teal-100 rounded-xl p-4 hover:border-teal-300 hover:shadow-sm transition-all">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center font-bold">3</div>
          <BookOpen className="w-4 h-4 text-teal-500" />
          <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Framework Study</span>
        </div>
        <p className="text-sm font-bold text-gray-900 mb-1">Deep Dive</p>
        <p className="text-xs text-gray-500 leading-relaxed mb-3">{path.tip}</p>
        <span className="text-xs text-teal-600 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">View Framework <ArrowRight className="w-3 h-3" /></span>
      </Link>
    </div>
  );
}

const CAPABILITY_LABELS = {
  signal_awareness:        "Signal Awareness",
  signal_interpretation:   "Signal Interpretation",
  value_connection:        "Value Connection",
  customer_engagement:     "Customer Engagement",
  objection_navigation:    "Objection Navigation",
  commitment_generation:   "Commitment Generation",
  conversation_management: "Conv. Management",
  adaptive_response:       "Adaptive Response",
};

const CAPABILITY_COLORS = {
  signal_awareness:        "#14b8a6",
  signal_interpretation:   "#0284c7",
  value_connection:        "#8b5cf6",
  customer_engagement:     "#f59e0b",
  objection_navigation:    "#f97316",
  commitment_generation:   "#10b981",
  conversation_management: "#1A334D",
  adaptive_response:       "#06b6d4",
};

// Industry / benchmark scores for context (1-5 scale)
const BENCHMARK_SCORES = {
  signal_awareness:        3.5,
  signal_interpretation:   3.4,
  value_connection:        3.2,
  customer_engagement:     3.1,
  objection_navigation:    3.0,
  commitment_generation:   3.3,
  conversation_management: 3.1,
  adaptive_response:       3.2,
};

function extractScores(feedback) {
  if (!feedback) return null;
  const scores = {};
  const patterns = [
    [/signal awareness[^\d]*(\d)/i,        "signal_awareness"],
    [/signal interpretation[^\d]*(\d)/i,   "signal_interpretation"],
    [/value connection[^\d]*(\d)/i,        "value_connection"],
    [/customer engagement[^\d]*(\d)/i,     "customer_engagement"],
    [/objection navigation[^\d]*(\d)/i,    "objection_navigation"],
    [/commitment generation[^\d]*(\d)/i,   "commitment_generation"],
    [/conversation management[^\d]*(\d)/i, "conversation_management"],
    [/adaptive response[^\d]*(\d)/i,       "adaptive_response"],
  ];
  patterns.forEach(([regex, key]) => {
    const m = feedback.match(regex);
    if (m) scores[key] = parseInt(m[1]);
  });
  return Object.keys(scores).length > 0 ? scores : null;
}

function extractMisalignments(feedback) {
  if (!feedback) return [];
  const lines = feedback.split("\n");
  const misalignments = [];
  let inSection = false;
  for (const line of lines) {
    if (/misalignment|signal.response/i.test(line)) { inSection = true; continue; }
    if (inSection && (line.trim().startsWith("-") || line.trim().startsWith("•"))) {
      const text = line.replace(/^[-•]\s*/, "").trim();
      if (text.length > 10) misalignments.push(text);
    }
    if (inSection && /^#+\s/.test(line) && !/misalignment/i.test(line)) inSection = false;
  }
  return misalignments;
}

function extractStrategies(feedback) {
  if (!feedback) return [];
  const lines = feedback.split("\n");
  const strategies = [];
  let inSection = false;
  for (const line of lines) {
    if (/successful|strength|well done|effective/i.test(line)) { inSection = true; continue; }
    if (inSection && (line.trim().startsWith("-") || line.trim().startsWith("•"))) {
      const text = line.replace(/^[-•]\s*/, "").trim();
      if (text.length > 10) strategies.push(text);
    }
    if (inSection && /^#+\s/.test(line) && !/successful|strength/i.test(line)) inSection = false;
  }
  return strategies;
}

function StatCard({ icon: Icon, label, value, sub, color = "teal" }) {
  const styles = {
    teal:  "bg-teal-50 border-teal-200 text-teal-700",
    blue:  "bg-blue-50 border-blue-200 text-blue-700",
    navy:  "bg-slate-50 border-slate-200 text-slate-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };
  return (
    <div className={`rounded-xl p-4 border ${styles[color]} transition-all`} tabIndex={0} aria-label={label} role="region">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 opacity-70" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-wide opacity-60" id={`statcard-label-${label}`}>{label}</span>
      </div>
      <div className="text-2xl font-bold" aria-labelledby={`statcard-label-${label}`}>{value}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

export default function SessionAnalytics() {
  const [dateRange, setDateRange] = useState("30");
  const [scenarioFilter, setScenarioFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");
  // Download analytics as CSV
  function handleDownload() {
    const header = ["Session ID", "Scenario Title", "Date", "Signal Awareness", "Signal Interpretation", "Value Connection", "Customer Engagement", "Objection Navigation", "Commitment Generation", "Conversation Management", "Adaptive Response", "Successful Strategies", "Misalignments"];
    const rows = filtered.map(session => {
      const scores = extractScores(session.feedback) || {};
      const strategies = extractStrategies(session.feedback).join("; ");
      const misalignments = extractMisalignments(session.feedback).join("; ");
      return [
        session.id,
        session.scenario_title,
        session.created_date,
        scores.signal_awareness ?? "",
        scores.signal_interpretation ?? "",
        scores.value_connection ?? "",
        scores.customer_engagement ?? "",
        scores.objection_navigation ?? "",
        scores.commitment_generation ?? "",
        scores.conversation_management ?? "",
        scores.adaptive_response ?? "",
        strategies,
        misalignments
      ];
    });
    const csv = [header.join(","), ...rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "session-analytics.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Demo sessions so analytics always render meaningfully
  const DEMO_SESSIONS = [
    { id: "d1", scenario_title: "PrEP Access Barriers Despite Strong Adoption", created_date: new Date(Date.now() - 2 * 86400000).toISOString(), feedback: "Signal Awareness 4\nSignal Interpretation 3\nValue Connection 4\nCustomer Engagement 3\nObjection Navigation 2\nCommitment Generation 3\nConversation Management 4\nAdaptive Response 3\n\n## Successful Strategies\n- Opened with specific patient data point\n- Used reflective listening after objection\n\n## Misalignment / Signal-Response\n- Jumped to solution before fully acknowledging concern\n- Missed cue to pause after HCP mentioned workload" },
    { id: "d2", scenario_title: "Heart Failure GDMT Optimization Challenge", created_date: new Date(Date.now() - 5 * 86400000).toISOString(), feedback: "Signal Awareness 3\nSignal Interpretation 4\nValue Connection 5\nCustomer Engagement 4\nObjection Navigation 3\nCommitment Generation 4\nConversation Management 3\nAdaptive Response 4\n\n## Successful Strategies\n- Connected clinical evidence directly to HCP's stated priorities\n- Secured specific next-step with date\n\n## Misalignment / Signal-Response\n- Rushed past formulary concern\n- Did not adapt pace when HCP shifted tone" },
    { id: "d3", scenario_title: "HIV Prevention Gap in High-Risk Population", created_date: new Date(Date.now() - 9 * 86400000).toISOString(), feedback: "Signal Awareness 4\nSignal Interpretation 3\nValue Connection 3\nCustomer Engagement 3\nObjection Navigation 4\nCommitment Generation 3\nConversation Management 4\nAdaptive Response 3\n\n## Successful Strategies\n- Paused effectively after HCP expressed frustration\n- Bridged objection with real-world evidence\n\n## Misalignment / Signal-Response\n- Closing question was too vague\n- Missed opportunity to confirm understanding" },
    { id: "d4", scenario_title: "Oncology KOL Introduction", created_date: new Date(Date.now() - 14 * 86400000).toISOString(), feedback: "Signal Awareness 3\nSignal Interpretation 4\nValue Connection 3\nCustomer Engagement 2\nObjection Navigation 3\nCommitment Generation 2\nConversation Management 3\nAdaptive Response 4\n\n## Successful Strategies\n- Adapted quickly when KOL redirected conversation\n- Good question quality in opening\n\n## Misalignment / Signal-Response\n- Failed to generate clear next step\n- Did not connect value to KOL's published research interests" },
    { id: "d5", scenario_title: "PrEP Access Barriers Despite Strong Adoption", created_date: new Date(Date.now() - 20 * 86400000).toISOString(), feedback: "Signal Awareness 5\nSignal Interpretation 4\nValue Connection 4\nCustomer Engagement 4\nObjection Navigation 3\nCommitment Generation 4\nConversation Management 5\nAdaptive Response 4\n\n## Successful Strategies\n- Excellent structure throughout\n- Navigated objection without becoming defensive\n\n## Misalignment / Signal-Response\n- Brief momentum loss mid-conversation\n- Could have amplified HCP engagement signal earlier" },
    { id: "d6", scenario_title: "Cardiology Formulary Review", created_date: new Date(Date.now() - 25 * 86400000).toISOString(), feedback: "Signal Awareness 3\nSignal Interpretation 3\nValue Connection 4\nCustomer Engagement 3\nObjection Navigation 4\nCommitment Generation 3\nConversation Management 3\nAdaptive Response 3\n\n## Successful Strategies\n- Framed cost conversation around total cost of care\n- Used committee language effectively\n\n## Misalignment / Signal-Response\n- Missed cost-containment cue from pharmacy director\n- Jumped to solution before all objections were surfaced" },
  ];
  const sessions = DEMO_SESSIONS;
  const isLoading = false;

  const filtered = useMemo(() => {
    let s = sessions;
    const days = parseInt(dateRange);
    if (days > 0) {
      const cutoff = subDays(new Date(), days);
      s = s.filter(session => {
        const d = session.created_date ? parseISO(session.created_date) : null;
        return d && isAfter(d, cutoff);
      });
    }
    if (scenarioFilter !== "all") {
      s = s.filter(session => session.scenario_title === scenarioFilter);
    }
    return s;
  }, [sessions, dateRange, scenarioFilter]);

  const scenarioTitles = useMemo(() => [...new Set(sessions.map(s => s.scenario_title).filter(Boolean))], [sessions]);

  // Aggregated scores per capability
  const avgScores = useMemo(() => {
    const totals = {}, counts = {};
    filtered.forEach(session => {
      const scores = extractScores(session.feedback);
      if (scores) {
        Object.entries(scores).forEach(([cap, score]) => {
          totals[cap] = (totals[cap] || 0) + score;
          counts[cap] = (counts[cap] || 0) + 1;
        });
      }
    });
    return Object.keys(CAPABILITY_LABELS).map(cap => ({
      capability: CAPABILITY_LABELS[cap],
      score: counts[cap] ? Math.round((totals[cap] / counts[cap]) * 10) / 10 : 0,
      benchmark: BENCHMARK_SCORES[cap],
      color: CAPABILITY_COLORS[cap],
      key: cap,
    }));
  }, [filtered]);

  // Capability trend over time (weekly)
  const capabilityTrends = useMemo(() => {
    const weeks = {};
    filtered.forEach(session => {
      const d = session.created_date ? parseISO(session.created_date) : null;
      if (!d) return;
      const weekKey = format(subDays(d, d.getDay()), "MMM d");
      if (!weeks[weekKey]) weeks[weekKey] = { week: weekKey, counts: {}, totals: {} };
      const scores = extractScores(session.feedback);
      if (scores) {
        Object.entries(scores).forEach(([cap, score]) => {
          weeks[weekKey].totals[cap] = (weeks[weekKey].totals[cap] || 0) + score;
          weeks[weekKey].counts[cap] = (weeks[weekKey].counts[cap] || 0) + 1;
        });
      }
    });
    return Object.values(weeks).map(w => {
      const entry = { week: w.week };
      Object.keys(CAPABILITY_LABELS).forEach(cap => {
        entry[cap] = w.counts[cap] ? Math.round((w.totals[cap] / w.counts[cap]) * 10) / 10 : null;
      });
      return entry;
    }).sort((a, b) => new Date(a.week).getTime() - new Date(b.week).getTime());
  }, [filtered]);

  // Misalignment frequency
  const misalignmentCounts = useMemo(() => {
    const counts = {};
    filtered.forEach(session => {
      extractMisalignments(session.feedback).forEach(m => {
        const key = m.split(" ").slice(0, 6).join(" ") + "...";
        counts[key] = (counts[key] || 0) + 1;
      });
    });
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 6)
      .map(([label, count]) => ({ label, count }));
  }, [filtered]);

  // Successful strategies
  const successfulStrategies = useMemo(() => {
    const counts = {};
    filtered.forEach(session => {
      extractStrategies(session.feedback).forEach(s => {
        const key = s.split(" ").slice(0, 6).join(" ") + "...";
        counts[key] = (counts[key] || 0) + 1;
      });
    });
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 6)
      .map(([label, count]) => ({ label, count }));
  }, [filtered]);

  // Sessions over time
  const sessionsOverTime = useMemo(() => {
    const buckets = {};
    filtered.forEach(session => {
      const d = session.created_date ? parseISO(session.created_date) : null;
      if (!d) return;
      const weekKey = format(subDays(d, d.getDay()), "MMM d");
      buckets[weekKey] = (buckets[weekKey] || 0) + 1;
    });
    return Object.entries(buckets).map(([week, count]) => ({ week, count }));
  }, [filtered]);

  // Scores per scenario
  const scoresByScenario = useMemo(() => {
    const map = {};
    filtered.forEach(session => {
      if (!session.scenario_title) return;
      const scores = extractScores(session.feedback);
      if (!scores) return;
      if (!map[session.scenario_title]) map[session.scenario_title] = { totals: {}, count: 0 };
      map[session.scenario_title].count++;
      Object.entries(scores).forEach(([cap, score]) => {
        map[session.scenario_title].totals[cap] = (map[session.scenario_title].totals[cap] || 0) + score;
      });
    });
    return Object.entries(map).slice(0, 8).map(([title, data]) => {
      const avg = Object.values(data.totals).length
        ? Math.round(Object.values(data.totals).reduce((a, b) => a + b, 0) / (Object.values(data.totals).length * data.count) * 10) / 10
        : 0;
      return { title: title.length > 25 ? title.slice(0, 25) + "…" : title, avg, sessions: data.count };
    }).sort((a, b) => b.avg - a.avg);
  }, [filtered]);

  if (isLoading) return (
    <div className="space-y-4">{Array(4).fill(0).map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}</div>
  );

  const totalSessions = filtered.length;
  const topCapability = avgScores.reduce((best, c) => c.score > (best?.score || 0) ? c : best, null);
  const weakCapability = avgScores.filter(c => c.score > 0).reduce((worst, c) => c.score < (worst?.score || 99) ? c : worst, null);
  const overallAvg = avgScores.filter(c => c.score > 0).length
    ? Math.round(avgScores.filter(c => c.score > 0).reduce((s, c) => s + c.score, 0) / avgScores.filter(c => c.score > 0).length * 10) / 10
    : 0;
  const vsAvgBenchmark = overallAvg > 0 ? Number((overallAvg - 3.3).toFixed(1)) : null;

  return (
    <div className="space-y-6" role="main" aria-label="Session Analytics Panel">
      {/* Download Analytics Button */}
      <div className="flex justify-end mb-2">
        <button
          className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2 rounded shadow-sm transition-all"
          onClick={handleDownload}
        >
          Download Analytics
        </button>
      </div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <SelectField value={dateRange} onValueChange={setDateRange}>
            <SelectTriggerField className="w-36 h-8 text-xs"><SelectValueField /></SelectTriggerField>
            <SelectContentField>
              <SelectItemField value="7">Last 7 days</SelectItemField>
              <SelectItemField value="30">Last 30 days</SelectItemField>
              <SelectItemField value="90">Last 90 days</SelectItemField>
              <SelectItemField value="0">All time</SelectItemField>
            </SelectContentField>
          </SelectField>
        </div>
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-slate-500" />
          <SelectField value={scenarioFilter} onValueChange={setScenarioFilter}>
            <SelectTriggerField className="w-52 h-8 text-xs"><SelectValueField placeholder="All scenarios" /></SelectTriggerField>
            <SelectContentField>
              <SelectItemField value="all">All scenarios</SelectItemField>
              {scenarioTitles.map(t => <SelectItemField key={t} value={t}>{t.length > 40 ? t.slice(0, 40) + "…" : t}</SelectItemField>)}
            </SelectContentField>
          </SelectField>
        </div>
        <BadgeField variant="outline" className="text-xs text-slate-600 border-slate-200">{totalSessions} sessions</BadgeField>
      </div>

      {totalSessions === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-semibold text-slate-600 text-lg">No completed sessions yet</p>
          <p className="text-sm mt-1">Complete role-play sessions to see performance analytics here</p>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Activity} label="Sessions" value={totalSessions} sub="completed" color="teal" />
            <StatCard icon={BarChart3} label="Avg Score" value={overallAvg > 0 ? `${overallAvg}/5` : "—"} sub={vsAvgBenchmark ? `${vsAvgBenchmark > 0 ? "+" : ""}${vsAvgBenchmark} vs. benchmark` : "across all capabilities"} color="blue" />
            <StatCard icon={TrendingUp} label="Top Capability" value={topCapability?.score > 0 ? topCapability.capability.split(" ")[0] : "—"} sub={topCapability?.score > 0 ? `${topCapability.score}/5` : ""} color="teal" />
            <StatCard icon={AlertTriangle} label="Needs Work" value={weakCapability?.score > 0 ? weakCapability.capability.split(" ")[0] : "—"} sub={weakCapability?.score > 0 ? `${weakCapability.score}/5` : ""} color="amber" />
          </div>

          {/* AI Actionable Insights */}
          <AIActionableInsightsField
            avgScores={avgScores}
            totalSessions={totalSessions}
            overallAvg={overallAvg}
            streak={Math.min(totalSessions, 5)}
            earnedBadges={avgScores.filter(c => c.score >= 4).map(c => c.capability)}
          />

          {/* Gamification Panel */}
          <GamificationPanelField
            totalSessions={totalSessions}
            overallAvg={overallAvg}
            capabilityScores={Object.fromEntries(avgScores.map(c => [c.key, c.score]))}
            streak={Math.min(totalSessions, 5)}
          />

          {/* Tabs */}
          <TabsField value={activeTab} onValueChange={setActiveTab}>
            <TabsListField className="bg-transparent flex-wrap gap-2 h-auto p-0">
              <TabsTriggerField value="overview" className="text-sm px-5 py-2 rounded-full border border-[#1A334D] hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] data-[state=active]:bg-[#39ACAC] data-[state=active]:text-white data-[state=active]:border-[#1A334D] transition-all">Overview</TabsTriggerField>
              <TabsTriggerField value="trends" className="text-sm px-5 py-2 rounded-full border border-[#1A334D] hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] data-[state=active]:bg-[#39ACAC] data-[state=active]:text-white data-[state=active]:border-[#1A334D] transition-all">Capability Trends</TabsTriggerField>
              <TabsTriggerField value="patterns" className="text-sm px-5 py-2 rounded-full border border-[#1A334D] hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] data-[state=active]:bg-[#39ACAC] data-[state=active]:text-white data-[state=active]:border-[#1A334D] transition-all">Patterns & Strategies</TabsTriggerField>
              <TabsTriggerField value="scenarios" className="text-sm px-5 py-2 rounded-full border border-[#1A334D] hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] data-[state=active]:bg-[#39ACAC] data-[state=active]:text-white data-[state=active]:border-[#1A334D] transition-all">By Scenario</TabsTriggerField>
            </TabsListField>
          </TabsField>

          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Radar */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Signal Intelligence Overview</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={avgScores}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="capability" tick={{ fontSize: 10, fill: "#475569" }} />
                    <Radar name="Your Score" dataKey="score" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.15} strokeWidth={2} dot={{ fill: "#14b8a6", r: 3 }} />
                    <Radar name="Benchmark" dataKey="benchmark" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.05} strokeWidth={1.5} strokeDasharray="4 4" />
                    <Legend iconType="line" wrapperStyle={{ fontSize: 10 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Capability vs Benchmark bars */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-slate-800 mb-1">You vs. Benchmark</h3>
                <p className="text-xs text-slate-500 mb-4">Dashed line = industry benchmark</p>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={avgScores} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis type="category" dataKey="capability" tick={{ fontSize: 10, fill: "#475569" }} width={140} />
                    <Tooltip content={React.createElement(/** @type {any} */ (CustomTooltip))} />
                    <ReferenceLine x={3.3} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: "Benchmark", position: "top", fontSize: 9, fill: "#94a3b8" }} />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]} name="Your Score">
                      {avgScores.map((entry, i) => <Cell key={i} fill={entry.score >= (entry.benchmark || 3.3) ? "#14b8a6" : "#f97316"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Sessions over time */}
              {sessionsOverTime.length > 1 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2">
                  <h3 className="text-sm font-bold text-slate-800 mb-4">Sessions Over Time</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={sessionsOverTime}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#475569" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#475569" }} allowDecimals={false} />
                      <Tooltip content={React.createElement(/** @type {any} */ (CustomTooltip))} />
                      <Line type="monotone" dataKey="count" name="Sessions" stroke="#14b8a6" strokeWidth={2.5} dot={{ fill: "#14b8a6", r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {activeTab === "trends" && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-slate-800 mb-1">Capability Score Trends Over Time</h3>
                <p className="text-xs text-slate-500 mb-4">Track how each Signal Intelligence capability evolves week over week</p>
                {capabilityTrends.length < 2 ? (
                  <div className="text-center py-10 text-xs text-slate-400">Need at least 2 weeks of data to show trends</div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={capabilityTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#475569" }} />
                      <YAxis domain={[1, 5]} tick={{ fontSize: 10, fill: "#475569" }} />
                      <Tooltip content={React.createElement(/** @type {any} */ (CustomTooltip))} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      {Object.entries(CAPABILITY_LABELS).map(([key, label]) => (
                        <Line key={key} type="monotone" dataKey={key} name={label} stroke={CAPABILITY_COLORS[key]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Individual capability trend sparklines */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {avgScores.filter(c => c.score > 0).map(cap => (
                  <div key={cap.key} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs font-bold text-gray-800">{cap.capability}</p>
                        <p className="text-xs text-gray-500">Avg: {cap.score}/5 · Benchmark: {cap.benchmark}/5</p>
                      </div>
                      <span className={`text-sm font-bold px-2 py-0.5 rounded ${cap.score >= cap.benchmark ? "text-teal-600 bg-teal-50" : "text-orange-600 bg-orange-50"}`}>
                        {cap.score >= cap.benchmark ? "↑" : "↓"} {cap.score}/5
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="rounded-full h-1.5 transition-all" style={{ width: `${(cap.score / 5) * 100}%`, background: cap.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "patterns" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Common objection patterns */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  <h3 className="text-sm font-bold text-slate-800">Common Objection Patterns</h3>
                </div>
                <p className="text-xs text-slate-500 mb-4">Most frequent misalignments detected across sessions</p>
                {misalignmentCounts.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 italic">No misalignments detected yet</div>
                ) : (
                  <div className="space-y-2">
                    {misalignmentCounts.map(({ label, count }, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 truncate">{label}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-20 bg-gray-100 rounded-full h-1.5">
                            <div className="rounded-full h-1.5 bg-orange-400" style={{ width: `${(count / misalignmentCounts[0].count) * 100}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-orange-600 w-5 text-right">{count}×</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Successful strategies */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-teal-500" />
                  <h3 className="text-sm font-bold text-slate-800">Successful Communication Strategies</h3>
                </div>
                <p className="text-xs text-slate-500 mb-4">Strategies that consistently generated positive outcomes</p>
                {successfulStrategies.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 italic">No strategy patterns identified yet</div>
                ) : (
                  <div className="space-y-2">
                    {successfulStrategies.map(({ label, count }, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 truncate">{label}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-20 bg-gray-100 rounded-full h-1.5">
                            <div className="rounded-full h-1.5 bg-teal-400" style={{ width: `${(count / successfulStrategies[0].count) * 100}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-teal-600 w-5 text-right">{count}×</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Personalized Learning Path */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-teal-600" />
                    <h3 className="text-sm font-bold text-teal-900">Personalized Learning Path</h3>
                    <span className="text-xs bg-teal-100 text-teal-700 rounded-full px-2 py-0.5 font-medium">Auto-generated</span>
                  </div>
                  {weakCapability ? (
                    <div className="space-y-4">
                      <p className="text-sm text-teal-800 leading-relaxed">
                        Based on your session data, your primary growth area is <strong>{weakCapability.capability}</strong> ({weakCapability.score}/5 vs. benchmark {weakCapability.benchmark}/5). Here's your recommended learning path:
                      </p>
                      <LearningPath weakCapability={weakCapability} />
                    </div>
                  ) : (
                    <p className="text-sm text-teal-700">Complete at least one role-play session to receive a personalized learning path based on your performance data.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "scenarios" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2">
                <h3 className="text-sm font-bold text-slate-800 mb-1">Average Score by Scenario</h3>
                <p className="text-xs text-slate-500 mb-4">Compare your performance across different scenario types</p>
                {scoresByScenario.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 italic">Not enough data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(240, scoresByScenario.length * 40)}>
                    <BarChart data={scoresByScenario} layout="vertical" margin={{ left: 8, right: 32 }}>
                      <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10 }} tickLine={false} />
                      <YAxis type="category" dataKey="title" tick={{ fontSize: 10, fill: "#475569" }} width={160} />
                      <Tooltip formatter={(v, n, p) => [`${v}/5 (${p.payload.sessions} sessions)`, "Avg Score"]} />
                      <ReferenceLine x={3.3} stroke="#94a3b8" strokeDasharray="4 4" />
                      <Bar dataKey="avg" radius={[0, 4, 4, 0]} name="Avg Score">
                        {scoresByScenario.map((entry, i) => <Cell key={i} fill={entry.avg >= 3.3 ? "#14b8a6" : "#f97316"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* StateTransitionFlow */}
              <div className="lg:col-span-2">
                <StateTransitionFlow sessions={filtered} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}