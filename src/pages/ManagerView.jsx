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
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Activity,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend } from "recharts";
import AssignmentPanel from "@/components/manager/AssignmentPanel";
import InterventionValidationPanel from "@/components/manager/InterventionValidationPanel";
import ManagerInsightsPanelExpanded from "@/components/manager/ManagerInsightsPanelExpanded";
import { ENABLEMENT_HUB_SPOKES, getAdoptionBand } from "@/lib/enablementHub";
import { ENABLE_MANAGER_INSIGHTS } from "@/components/manager/managerInsightsShared";
import { formatMetricLabel, normalizeExplanation, normalizeManagerText } from "@/components/manager/managerMetricFormatting";
import {
  BEHAVIORAL_METRIC_KEYS,
  buildManagerInsightsRequest,
  getBehavioralMetricDefinition,
  getBehavioralMetricLabel,
} from "@/components/manager/managerPerformanceData";
import { buildManagerViewState, getContributorSet } from "@/components/manager/managerViewModel";
import { buildPredictiveCalibration, buildValidationInsight, getCapabilityLabelFromCanonicalId, selectHistoricalPriorityCapability } from "@/components/manager/managerValidationLogic";
import { hardenPredictiveCalibration } from "@/components/manager/managerReliability";
import { captureValidationFollowUp, fetchValidationRecords, fetchValidationSummary, startValidationRecord } from "@/components/manager/managerValidationService";
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

const DERIVED_METRIC_GLOSSARY = [
  {
    label: "Sales Outcome Score",
    definition: "Manager-facing 5-point score used as the outcome anchor for rep and territory performance. It can be translated to percent of scale by dividing the score by 5.",
    formula: "Scale-equivalent percent = (Sales Outcome Score ÷ 5) × 100",
  },
  {
    label: "Overall Score",
    definition: "Derived score that blends the Average of 8 Behavioral Metrics with the Sales Outcome Score.",
    formula: "(Average of 8 Behavioral Metrics × 0.65) + (Sales Outcome Score × 0.35)",
    derivedFrom: "Signal Awareness, Signal Interpretation, Adaptive Response, Objection Navigation, Value Connection, Commitment Generation, Customer Engagement Monitoring, Conversation Management",
  },
  {
    label: "Learning Engagement Score",
    definition: "Derived activity score built from sessions, module completion, practice streak, engagement consistency, and coaching cadence.",
    formula: "(Session volume × 0.34) + (Module completion × 0.22) + (Practice streak × 0.18) + (Engagement consistency × 0.16) + coaching bonus",
    derivedFrom: "Signal Awareness, Signal Interpretation, Adaptive Response, Objection Navigation, Value Connection, Commitment Generation, Customer Engagement Monitoring, Conversation Management",
  },
  {
    label: "Sales Risk",
    definition: "Derived risk score that combines sales outcome, average behavioral execution, learning engagement, trend, status, and commitment generation threshold checks.",
    formula: "58 - (Sales Outcome Score × 9) - (Average of 8 Behavioral Metrics × 6) - (Learning Engagement Score × 0.16) + adjustments",
    derivedFrom: "Sales Outcome Score, Commitment Generation, Learning Engagement Score",
  },
  {
    label: "Territory Volatility",
    definition: "Derived territory spread showing how far rep sales outcome scores sit from the territory average.",
    formula: "Weighted average of |rep sales outcome score - territory average sales outcome score|",
    derivedFrom: "Sales Outcome Score",
  },
  {
    label: "Predictive Confidence",
    definition: "Prediction reliability (not a performance score) for the predictive outlook.",
    formula: "Weighted confidence model using data confidence, variance, stability, coverage, coaching responsiveness, conversion proxy, intervention effectiveness, and target-capability validation success",
    derivedFrom: "Data Confidence, Behavioral Variance, Engagement Stability, Validation History",
  },
  {
    label: "Data Confidence",
    definition: "Reliability score for the observed rep or territory dataset before predictive weighting is applied.",
    formula: "Observation depth, recent activity coverage, recency, and variance checks normalized to a 0-to-100 equivalent",
    derivedFrom: "Observation Depth, Sessions, Practice Recency, Behavioral Variance",
  },
  {
    label: "Behavioral Variance",
    definition: "Spread between stronger and weaker canonical capability scores inside the current profile.",
    formula: "Standardized variance across the 8 canonical capability scores",
    derivedFrom: "Signal Awareness, Signal Interpretation, Adaptive Response, Objection Navigation, Value Connection, Commitment Generation, Customer Engagement Monitoring, Conversation Management",
  },
  {
    label: "Conversion Proxy",
    definition: "Derived 100-point signal estimating whether current capability execution is translating into forward movement.",
    formula: "Commitment Generation and Value Connection weighted into a 100-point execution proxy",
    derivedFrom: "Commitment Generation, Value Connection",
  },
];

const THRESHOLD_GLOSSARY = [
  {
    label: "Capability baseline: 3.5/5",
    definition: "Minimum acceptable capability score used in deterministic rep risk rules.",
    source: "Rule-based manager configuration",
  },
  {
    label: "Learning engagement watch: 60/100",
    definition: "Below this point, the rep is flagged for monitoring because activity and practice behavior are trailing expectations.",
    source: "Rule-based manager configuration",
  },
  {
    label: "Territory engagement risk: 55/100",
    definition: "Below this point, the territory is treated as elevated risk because the aggregated learning engagement score is low.",
    source: "Rule-based manager configuration",
  },
  {
    label: "Territory volatility watch: 0.4",
    definition: "Above this point, sales outcome scores are spread enough to require manager attention.",
    source: "Rule-based manager configuration",
  },
  {
    label: "Distribution cap: 30% of reps",
    definition: "No single capability should be assigned as the capability requiring improvement for more than 30% of reps unless no near-tied alternative exists.",
    source: "Manager View balancing rule",
  },
];

const VALIDATION_GLOSSARY = [
  {
    label: "Validation Status",
    definition: "The deterministic outcome assigned to a tracked intervention after baseline and follow-up evidence are compared.",
    howItIsDetermined: "Set to Pending, Insufficient Data, Positive Validation, Neutral Validation, or Negative Validation using rule-based thresholds for capability movement, engagement, risk, and observation depth.",
    whyItMatters: "It tells managers whether an intervention is too early to judge, showing positive movement, mixed movement, or signaling deterioration.",
  },
  {
    label: "Baseline Snapshot",
    definition: "The rep's current canonical capability scores and supporting manager metrics captured when outcome tracking begins.",
    howItIsDetermined: "Stored from the current Manager View rep state at the moment a manager starts validation.",
    whyItMatters: "It creates the fixed before-state needed for an auditable intervention review.",
  },
  {
    label: "Follow-up Snapshot",
    definition: "A later capture of the same canonical capability and supporting manager metrics after additional coaching activity occurs.",
    howItIsDetermined: "Captured manually from the latest rep state when a manager clicks Capture Follow-up Snapshot.",
    whyItMatters: "It gives managers explicit after-state evidence without relying on background automation.",
  },
  {
    label: "Evidence Summary",
    definition: "A compact comparison of the target capability delta plus supporting movement in engagement, risk, conversion proxy, sessions, and modules.",
    howItIsDetermined: "Calculated by subtracting the baseline values from the most recent follow-up snapshot and preserving the exact deltas on the validation record.",
    whyItMatters: "It lets managers inspect why a validation status was assigned instead of trusting a black-box label.",
  },
  {
    label: "Coaching Effectiveness",
    definition: "The share of tracked interventions that resulted in positive validation for a rep or the overall team.",
    howItIsDetermined: "Calculated as validated_positive divided by total tracked interventions, using only the existing closed-loop validation records.",
    whyItMatters: "It helps managers prioritize capabilities and reps where historical interventions have produced measurable movement.",
  },
  {
    label: "Observation Window",
    definition: "The review period in days used to judge whether enough time and activity have passed to interpret an intervention responsibly.",
    howItIsDetermined: "Stored on each validation record with the expected movement configuration and used by insufficient-data checks.",
    whyItMatters: "It prevents managers from treating an immediate or low-activity follow-up as proof of impact.",
  },
  {
    label: "Positive Validation",
    definition: "A tracked intervention where the target capability improved by a meaningful amount and at least one supporting signal also improved.",
    howItIsDetermined: "Requires a target capability improvement of at least 0.2 points and at least one supporting improvement in engagement, risk, conversion proxy, or fresh activity.",
    whyItMatters: "It highlights interventions worth repeating because measurable movement was observed.",
  },
  {
    label: "Neutral Validation",
    definition: "A tracked intervention showing limited or mixed movement versus baseline.",
    howItIsDetermined: "Assigned when follow-up evidence is sufficient but neither the positive nor negative rule set is met.",
    whyItMatters: "It signals that managers may need more time, more activity, or a sharper intervention design before drawing a conclusion.",
  },
  {
    label: "Negative Validation",
    definition: "A tracked intervention where the target capability stayed flat or declined while supporting indicators worsened.",
    howItIsDetermined: "Assigned when the target capability does not improve and at least one supporting signal deteriorates beyond the conservative rule thresholds.",
    whyItMatters: "It warns managers that the current intervention may be ineffective or misaligned.",
  },
];

const ENTERPRISE_PARENT_CARD = "min-w-0 rounded-2xl border border-teal-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md";
const ENTERPRISE_SUBCARD = "min-w-0 rounded-xl border border-slate-200 bg-slate-50 transition-colors duration-200 hover:border-teal-200 hover:bg-teal-50/40";
const ENTERPRISE_SUBCARD_WHITE = "min-w-0 rounded-xl border border-slate-200 bg-white transition-colors duration-200 hover:border-teal-200 hover:bg-teal-50/25";
const METRIC_PILL_CLASSNAME = "mx-auto inline-flex max-w-full items-center justify-center gap-1 rounded-full border border-[#1A334D] bg-white px-2.5 py-1 text-center text-[11px] font-semibold text-[#1A334D] transition-colors hover:border-[#39ACAC] hover:bg-[#39ACAC] hover:text-white";
const MANAGER_TAB_TRIGGER_CLASSNAME = "flex items-center gap-1.5 rounded-full border border-[#1A334D] bg-white px-4 py-2 text-sm font-semibold text-[#1A334D] transition-all hover:border-[#39ACAC] hover:bg-[#e6f7f7] hover:text-[#39ACAC] data-[state=active]:border-[#1A334D] data-[state=active]:bg-[#39ACAC] data-[state=active]:text-white";

const TIME_RANGE_OPTIONS = [
  { value: "this_week", label: "This Week" },
  { value: "last_2_weeks", label: "Last 2 Weeks" },
  { value: "this_month", label: "This Month" },
  { value: "quarter_to_date", label: "Quarter to Date" },
  { value: "custom", label: "Custom" },
];

const INSIGHT_FOCUS_OPTIONS = [
  { value: "performance", label: "Performance" },
  { value: "pipeline_health", label: "Pipeline Health" },
  { value: "risk_signals", label: "Risk Signals" },
  { value: "forecast_confidence", label: "Forecast Confidence" },
  { value: "coaching_priorities", label: "Coaching Priorities" },
];

const DETAIL_LEVEL_OPTIONS = [
  { value: "quick_summary", label: "Quick Summary" },
  { value: "balanced", label: "Balanced" },
  { value: "deep_dive", label: "Deep Dive" },
];

const SEGMENT_OPTIONS = [
  { value: "all", label: "All" },
  { value: "territory", label: "Territory" },
  { value: "deal_stage", label: "Deal Stage" },
  { value: "lead_source", label: "Lead Source" },
  { value: "product_line", label: "Product Line" },
];

const MANAGER_VIEW_FOUNDATION = [
  {
    label: "Canonical Signal Intelligence capabilities",
    definition: "The 8 behavioral metrics are the source of truth for Manager View. Every manager-facing capability, threshold, and explanation must stay aligned with these canonical definitions.",
    whyItMatters: "This keeps coaching recommendations auditable and consistent with the rest of the platform.",
  },
  {
    label: "Sales Outcome Score",
    definition: "A manager-facing 5-point score summarizing sales execution performance for the current evaluation window. It is displayed on a 1-to-5 scale and can also be translated to a scale-equivalent percent by dividing by 5.",
    formula: "scale-equivalent percent = (sales outcome score / 5) x 100",
    whyItMatters: "This score gives managers a compact outcome anchor that can be blended with the 8 canonical behavioral metrics without replacing them.",
  },
  {
    label: "Scale-equivalent percent",
    definition: "A simple conversion of any 5-point score into percent of the 5-point scale. Example: 3.7/5 = 74% of scale, 3.9/5 = 78% of scale, and 3.49/5 = 69.8% of scale.",
    formula: "(score / 5) x 100",
    whyItMatters: "This percent explains where percentages such as 74% or 78% come from when a user wants a score translated into percent-of-scale language.",
  },
  {
    label: "Predictive Confidence",
    definition: "Prediction reliability (not a performance score). It estimates how reliable the outlook is based on data quality, stability, coverage, and supporting evidence.",
    formula: "weighted confidence model using data confidence, variance, trend stability, engagement stability, coaching responsiveness, and conversion proxy",
    whyItMatters: "This separates predictive reliability from performance scoring so users do not confuse 75% confidence with 74% or 78% scale-equivalent performance.",
  },
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

function TrendBadge({ trend }) {
  const tone = trend === "up" ? "bg-teal-50 text-teal-700" : trend === "down" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700";
  const label = trend ? trend.charAt(0).toUpperCase() + trend.slice(1) : "Flat";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function StatusBadge({ status }) {
  return <span className={`text-xs font-medium ${status === "active" ? "text-green-700" : status === "inactive" ? "text-red-700" : "text-amber-700"}`}>{formatStatus(status)}</span>;
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

function BehavioralProfileSummaryCell({ rep }) {
  return (
    <div className="inline-flex min-w-0 max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
        <CapabilityPill metricKey={rep.strongestCapability} tone="teal" />
        <CapabilityPill metricKey={rep.improvementPriority} tone="amber" />
      </div>
    </div>
  );
}

function MetricSummaryCard({ labelKey, value, explanation }) {
  const normalizedExplanation = explanation ? normalizeExplanation(explanation) : null;
  return (
      <div className={`${ENTERPRISE_SUBCARD_WHITE} rounded-2xl p-3 shadow-sm`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{formatMetricLabel(labelKey)}</p>
        <MetricPill explanation={explanation} label="Details" />
      </div>
      <p className="mt-2 text-lg font-bold text-slate-900">{value}</p>
      {normalizedExplanation?.derivedFrom?.length ? (
        <p className="mt-2 text-[11px] leading-5 text-slate-700">Derived from: {normalizedExplanation.derivedFrom.join(", ")}</p>
      ) : null}
    </div>
  );
}

function MetricExplanationDialog({ explanation, children }) {
  if (!explanation) {
    return null;
  }

  const normalizedExplanation = normalizeExplanation(explanation);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{normalizedExplanation.label}</DialogTitle>
          <DialogDescription>{normalizedExplanation.definition}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm text-slate-700">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Calculation</p>
            <p className="mt-2 font-mono text-xs leading-6 text-slate-700">{normalizedExplanation.formula}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Inputs</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.entries(normalizedExplanation.inputs || {}).map(([key, value]) => (
                <div key={key} className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-700">{normalizeManagerText(key)}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Data source</p>
              <p className="mt-2 text-xs leading-6 text-slate-700">{normalizedExplanation.dataSource || "Manager View deterministic dataset"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Time window</p>
              <p className="mt-2 text-xs leading-6 text-slate-700">{normalizedExplanation.timeWindow || "Last 30 days"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Definition</p>
              <p className="mt-2 text-xs leading-6 text-slate-700">{normalizedExplanation.definition}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Thresholds and meaning</p>
            <div className="mt-2 space-y-2 text-xs leading-6 text-slate-700">
              {(normalizedExplanation.thresholds || []).length ? (
                normalizedExplanation.thresholds.map((item) => (
                  <p key={item}>• {item}</p>
                ))
              ) : (
                <p>• No threshold is used for this metric. It is descriptive only.</p>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Metric lineage</p>
            <p className="mt-2 text-xs leading-6 text-slate-700">
              {normalizedExplanation.derivedFrom?.length ? `Derived from: ${normalizedExplanation.derivedFrom.join(", ")}` : "Derived from: This metric is canonical or descriptive only."}
            </p>
          </div>
          <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Current output</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{String(normalizedExplanation.output)}</p>
            <p className="mt-2 text-xs leading-5 text-slate-700">{normalizedExplanation.notes || "This explanation is generated from auditable inputs only."}</p>
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
        className={METRIC_PILL_CLASSNAME}
      >
        {label}
      </button>
    </MetricExplanationDialog>
  );
}

function DefinitionsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="inline-flex items-center gap-2 rounded-full border border-[#1A334D] bg-white px-3 py-1.5 text-xs font-semibold text-[#1A334D] transition-colors hover:border-[#39ACAC] hover:bg-[#39ACAC] hover:text-white">
          <Info className="h-3.5 w-3.5" />
          View definitions
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Manager View glossary</DialogTitle>
          <DialogDescription>Canonical capabilities, derived metrics, and threshold definitions used throughout Manager View.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Manager View foundations</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {MANAGER_VIEW_FOUNDATION.map((item) => (
                <div key={item.label} className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4">
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-700">{item.definition}</p>
                  {item.formula ? <p className="mt-2 rounded-xl bg-white px-3 py-2 font-mono text-[11px] text-slate-700">{item.formula}</p> : null}
                  <p className="mt-2 text-[11px] leading-5 text-slate-700">{item.whyItMatters}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Canonical Signal Intelligence capabilities</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {SIGNAL_CAPABILITIES.map((capability) => (
                <div key={capability.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{capability.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-700">{capability.subtitle}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Derived metrics</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {DERIVED_METRIC_GLOSSARY.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">{metric.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-700">{metric.definition}</p>
                  <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700">{metric.formula}</p>
                  <p className="mt-2 text-[11px] leading-5 text-slate-700">Derived from: {metric.derivedFrom}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Threshold definitions</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {THRESHOLD_GLOSSARY.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-700">{item.definition}</p>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-700">Source · {item.source}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Validation loop definitions</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {VALIDATION_GLOSSARY.map((item) => (
                <div key={item.label} className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-700">{item.definition}</p>
                  <p className="mt-2 text-[11px] leading-5 text-slate-700"><span className="font-semibold uppercase tracking-wide">How it is determined · </span>{item.howItIsDetermined}</p>
                  <p className="mt-2 text-[11px] leading-5 text-slate-700"><span className="font-semibold uppercase tracking-wide">Why it matters · </span>{item.whyItMatters}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RepRow({ rep, derived, explanations, onToggle, selected, expandedContent }) {
  return (
    <>
      <tr onClick={() => onToggle(rep.id)} className={`cursor-pointer border-b border-slate-300 transition-colors ${selected ? "bg-teal-50/70" : "hover:bg-teal-50/35"}`}>
        <td className="px-4 py-3 align-middle">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "#1A334D" }}>
              {rep.name.split(" ").map((word) => word[0]).join("")}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">{rep.name}</p>
              <p className="mt-0.5 text-xs text-slate-700">{rep.specialty} · {rep.territory}</p>
              <button
                type="button"
                aria-expanded={selected}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggle(rep.id);
                }}
                className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-800 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${selected ? "rotate-180" : ""}`} />
                {selected ? "Collapse details" : "Expand details"}
              </button>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-center align-middle">
          <div className="flex flex-col items-center gap-1.5">
            <span className={`text-sm font-bold ${rep.overallScore >= 4 ? "text-teal-600" : rep.overallScore >= 3.3 ? "text-blue-600" : "text-amber-600"}`}>{rep.overallScore}/5</span>
            <MetricPill explanation={explanations.overallScore} label="Details" />
          </div>
        </td>
        <td className="px-4 py-3 text-center align-middle">
          <p className="text-sm font-bold text-slate-700">{rep.sessionsCompleted30d}</p>
        </td>
        <td className="px-4 py-3 text-center align-middle">
          <BehavioralProfileSummaryCell rep={rep} />
        </td>
        <td className="px-4 py-3 text-center align-middle">
          <div className="flex flex-col items-center gap-1.5">
            <CapabilityPill metricKey={rep.strongestCapability} tone="teal" />
            <MetricPill explanation={explanations.strongestCapability} label="Source" />
          </div>
        </td>
        <td className="px-4 py-3 text-center align-middle">
          <div className="flex flex-col items-center gap-1.5">
            <CapabilityPill metricKey={rep.improvementPriority} tone="amber" />
            <MetricPill explanation={explanations.improvementPriority} label="Source" />
          </div>
        </td>
        <td className="px-4 py-3 text-center align-middle">
          <div className="flex justify-center">
            <TrendBadge trend={rep.salesTrend} />
          </div>
        </td>
        <td className="px-4 py-3 text-center align-middle">
          <div className="flex flex-col items-center gap-1.5">
            <p className={`text-sm font-bold ${rep.status === "active" ? "text-green-700" : rep.status === "inactive" ? "text-red-700" : "text-amber-700"}`}>{derived.salesRiskScore}/100</p>
            <MetricPill explanation={explanations.salesRiskScore} label="Details" />
          </div>
        </td>
        <td className="px-4 py-3 text-center align-middle">
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-sm font-bold text-slate-700">{rep.coachingModulesCompleted}/8</p>
            <MetricPill explanation={explanations.moduleCompletion} label="Completion Details" />
          </div>
        </td>
      </tr>
      {selected ? (
        <tr className="border-b border-slate-300 bg-white">
          <td colSpan={9} className="px-4 py-4">
            {expandedContent}
          </td>
        </tr>
      ) : null}
    </>
  );
}

function RepExpandedContent({ rep, derived, viewState, assignments, loadAssignments, handleStatusChange, handleDelete, managerMetricsPayload, validationAnalytics, validationRecords, validationLoading, validationError, validationStartBusy, validationFollowUpId, onStartValidation, onCaptureFollowUp, onCollapse }) {
  const explanations = viewState.explanations.rep[rep.id];

  return (
    <div className="space-y-5">
      <div className={`${ENTERPRISE_PARENT_CARD} p-5`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: "#1A334D" }}>
              {rep.name.split(" ").map((word) => word[0]).join("")}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900">{rep.name}</h3>
              <p className="text-xs text-slate-700">{rep.specialty} · {rep.territory}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <TrendBadge trend={rep.salesTrend} />
                <span className={`text-sm font-semibold ${rep.status === "active" ? "text-green-700" : rep.status === "inactive" ? "text-red-700" : "text-amber-700"}`}>Sales Risk {derived.salesRiskScore}/100</span>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-700">Observation depth {rep.observationDepth}</span>
              </div>
            </div>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:min-w-[420px]">
            {[
              { label: "Sessions (30d)", value: rep.sessionsCompleted30d, explanation: null },
              { label: "Overall Score", value: `${rep.overallScore}/5`, explanation: explanations.overallScore },
              { label: "Practice Streak", value: rep.practiceStreakDays > 0 ? `${rep.practiceStreakDays} days` : "None", explanation: null },
              { label: "Modules Done", value: `${rep.coachingModulesCompleted}/8`, explanation: explanations.moduleCompletion, detailLabel: "Completion Details" },
            ].map(({ label, value, explanation, detailLabel }) => (
              <div key={label} className={`${ENTERPRISE_SUBCARD} min-w-0 rounded-lg p-3`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-xs text-slate-700">{label}</p>
                  <MetricPill explanation={explanation} label={detailLabel || "Details"} />
                </div>
                <p className="mt-2 text-lg font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-teal-800"><CheckCircle className="h-3 w-3" /> Strongest Capability</p>
                <p className="text-sm font-bold text-teal-900">{getBehavioralMetricLabel(rep.strongestCapability)}</p>
                <p className="mt-1 text-xs text-teal-700">Score {rep.behavioralMetrics[rep.strongestCapability].score}/5 · Trend {rep.behavioralMetrics[rep.strongestCapability].trend}</p>
              </div>
              <MetricPill explanation={explanations.strongestCapability} label="Source" />
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-amber-800"><AlertTriangle className="h-3 w-3" /> Capability Requiring Improvement</p>
                <p className="text-sm font-bold text-amber-900">{getBehavioralMetricLabel(rep.improvementPriority)}</p>
                <p className="mt-1 text-xs text-amber-700">Score {rep.behavioralMetrics[rep.improvementPriority].score}/5 · Trend {rep.behavioralMetrics[rep.improvementPriority].trend}</p>
              </div>
              <MetricPill explanation={explanations.improvementPriority} label="Source" />
            </div>
          </div>
        </div>
      </div>

      {ENABLE_MANAGER_INSIGHTS && managerMetricsPayload && viewState.validation.isValid ? (
        <div className="space-y-3 manager-insights-container">
          <ManagerInsightsPanelExpanded key={`${rep.id}-${viewState.version}`} data={managerMetricsPayload} />
          {(validationRecords || []).length ? (
            <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
              <span className="font-semibold">Validation evidence:</span> {buildValidationInsight(validationRecords[0])}
            </div>
          ) : null}
        </div>
      ) : null}

        <InterventionValidationPanel
          rep={rep}
          derived={derived}
          validationAnalytics={validationAnalytics}
          validationRecords={validationRecords}
          validationLoading={validationLoading}
          validationError={validationError}
        startBusy={validationStartBusy}
        followUpRecordId={validationFollowUpId}
        onStartValidation={() => onStartValidation(rep)}
        onCaptureFollowUp={(record) => onCaptureFollowUp(record, rep)}
      />

      <div className={`${ENTERPRISE_PARENT_CARD} p-5`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Deterministic risk signals</p>
          <span className="rounded-full bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">{viewState.repRiskFlagsByRepId[rep.id]?.length || 0} active rules</span>
        </div>
        <div className="space-y-2">
          {(viewState.repRiskFlagsByRepId[rep.id] || []).length ? (
            viewState.repRiskFlagsByRepId[rep.id].map((flag) => (
              <div key={flag.ruleId} className={`rounded-lg border px-3 py-2 text-sm transition-colors duration-200 hover:bg-teal-50/30 ${flag.severity === "high" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                <p className="font-semibold">{normalizeManagerText(flag.label)}</p>
                <p className="mt-1 text-xs leading-5">{normalizeManagerText(flag.explanation)}</p>
              </div>
            ))
          ) : (
            <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-700">No deterministic risk rules are currently triggered for this rep.</p>
          )}
        </div>
      </div>

      <div className={`${ENTERPRISE_PARENT_CARD} p-5`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Derived metrics</p>
            <p className="mt-1 text-sm text-slate-700">Consistent display labels, shared explanation patterns, and deterministic calculations preserved.</p>
          </div>
          <span className="rounded-full bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">Details · Source · Rule</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {[
            { key: "engagementScore", value: `${derived.engagementScore}/100`, explanation: explanations.engagementScore },
            { key: "readinessScore", value: `${derived.readinessScore}/100`, explanation: explanations.readinessScore },
            { key: "engagementStabilityScore", value: `${derived.engagementStabilityScore}/100`, explanation: explanations.engagementStabilityScore },
            { key: "conversionProxyScore", value: `${derived.conversionProxyScore}/100`, explanation: explanations.conversionProxyScore },
            { key: "salesRiskScore", value: `${derived.salesRiskScore}/100`, explanation: explanations.salesRiskScore },
            { key: "dataConfidenceIndex", value: `${Math.round(derived.dataConfidenceIndex * 100)}%`, explanation: explanations.dataConfidenceIndex },
            { key: "confidenceScore", value: `${Math.round(derived.confidenceScore * 100)}%`, explanation: explanations.confidenceScore },
          ].map(({ key, value, explanation }) => (
            <MetricSummaryCard key={key} labelKey={key} value={value} explanation={explanation} />
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onCollapse}
            className="inline-flex items-center gap-2 rounded-full border border-[#166534] bg-[#dff5f2] px-4 py-2 text-sm font-bold text-[#166534] transition-colors hover:bg-[#cdeeed]"
          >
            <ChevronUp className="h-4 w-4" />
            Collapse Details
          </button>
        </div>
      </div>

      <div className={`${ENTERPRISE_PARENT_CARD} p-5`}>
        <AssignmentPanel
          rep={{ ...rep, weakCapability: getBehavioralMetricLabel(rep.improvementPriority) }}
          assignments={assignments}
          onAssigned={loadAssignments}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}

function RepMobileCard({ rep, derived, explanations, onToggle, selected, viewState, assignments, loadAssignments, handleStatusChange, handleDelete, managerMetricsPayload, validationAnalytics, validationRecords, validationLoading, validationError, validationStartBusy, validationFollowUpId, onStartValidation, onCaptureFollowUp }) {
  return (
    <div
      className={`w-full rounded-2xl border p-4 text-left shadow-sm transition-all duration-200 ${
        selected ? "border-teal-300 bg-teal-50/60" : "border-slate-200 bg-white hover:border-teal-200 hover:bg-teal-50/30"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "#1A334D" }}>
              {rep.name.split(" ").map((word) => word[0]).join("")}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{rep.name}</p>
              <p className="mt-1 text-xs text-slate-700">{rep.specialty} · {rep.territory}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <TrendBadge trend={rep.salesTrend} />
                <span className={`text-sm font-semibold ${rep.status === "active" ? "text-green-700" : rep.status === "inactive" ? "text-red-700" : "text-amber-700"}`}>Sales Risk {derived.salesRiskScore}/100</span>
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-expanded={selected}
          onClick={() => onToggle(rep.id)}
          className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${selected ? "rotate-180" : ""}`} />
          {selected ? "Collapse details" : "Expand details"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Overall score</p>
            <MetricPill explanation={explanations.overallScore} label="Details" />
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900">{rep.overallScore}/5</p>
          <p className="mt-1 text-xs text-slate-700">{rep.sessionsCompleted30d} sessions · {rep.coachingModulesCompleted}/8 modules</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Capability summary</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <CapabilityPill metricKey={rep.strongestCapability} tone="teal" />
            <CapabilityPill metricKey={rep.improvementPriority} tone="amber" />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <MetricPill explanation={explanations.strongestCapability} label="Source" />
            <MetricPill explanation={explanations.improvementPriority} label="Source" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-700">{formatMetricLabel("salesRiskScore")} {derived.salesRiskScore}/100</span>
            <MetricPill explanation={explanations.salesRiskScore} label="Details" />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Snapshot summary</p>
        <BehavioralProfileSummaryCell rep={rep} />
      </div>

      {selected ? (
        <div className="mt-4" onClick={(event) => event.stopPropagation()}>
          <RepExpandedContent
            rep={rep}
            derived={derived}
            viewState={viewState}
            assignments={assignments}
            loadAssignments={loadAssignments}
            handleStatusChange={handleStatusChange}
            handleDelete={handleDelete}
            managerMetricsPayload={managerMetricsPayload}
            validationAnalytics={validationAnalytics}
            validationRecords={validationRecords}
            validationLoading={validationLoading}
            validationError={validationError}
            validationStartBusy={validationStartBusy}
            validationFollowUpId={validationFollowUpId}
            onStartValidation={onStartValidation}
            onCaptureFollowUp={onCaptureFollowUp}
            onCollapse={() => onToggle(rep.id)}
          />
        </div>
      ) : null}
    </div>
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
        <button type="button" className="inline-flex items-center gap-1 rounded-full border border-[#1A334D] px-3 py-1.5 text-xs font-semibold text-[#1A334D] transition-colors hover:border-[#39ACAC] hover:bg-[#39ACAC] hover:text-white">
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
              <div className="flex flex-wrap items-center justify-between gap-3">
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
                          <p className="mt-1 text-xs text-slate-700">{normalizeManagerText(item.metricLabel)}: {item.metricValue} · Weight {Math.round((item.weight || 0) * 100)}%</p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">{normalizeManagerText(item.why)}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => onSelectRep(item.repId)}>
                          Open rep
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-700">No contributors are available for this territory pattern.</p>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatFilterLabel(options, value, fallback = "All") {
  return options.find((option) => option.value === value)?.label || fallback;
}

function buildManagerRecap({ selectedRep, filteredReps, calibratedDerivedByRepId, viewState, insightFocus }) {
  const focusReps = filteredReps.length ? filteredReps : viewState.reps;
  if (!focusReps.length) {
    return {
      highlights: ["No reps currently match the selected filters."],
      actions: ["Adjust filters or select All Reps to restore the deterministic recap."],
    };
  }

  const avgScore = (focusReps.reduce((sum, rep) => sum + rep.overallScore, 0) / focusReps.length).toFixed(2);
  const needsAttention = focusReps.filter((rep) => rep.status !== "active").length;
  const topRep = [...focusReps].sort((a, b) => b.overallScore - a.overallScore)[0];
  const riskOrdered = [...focusReps]
    .sort((a, b) => (calibratedDerivedByRepId[b.id]?.salesRiskScore || 0) - (calibratedDerivedByRepId[a.id]?.salesRiskScore || 0))
    .slice(0, 2);
  const primaryGap = viewState.nationalTerritory?.mostCommonCapabilityGap
    ? getBehavioralMetricLabel(viewState.nationalTerritory.mostCommonCapabilityGap)
    : "No dominant capability gap";

  if (selectedRep) {
    const derived = calibratedDerivedByRepId[selectedRep.id] || {};
    const strongest = selectedRep.behavioralMetrics[selectedRep.strongestCapability];
    const weakest = selectedRep.behavioralMetrics[selectedRep.improvementPriority];
    return {
      highlights: [
        `${selectedRep.name} is currently ${selectedRep.overallScore}/5 overall with ${selectedRep.sessionsCompleted30d} sessions in the last 30 days.`,
        `Strongest capability is ${getBehavioralMetricLabel(selectedRep.strongestCapability)} (${strongest?.score || "N/A"}/5, ${strongest?.trend || "flat"} trend).`,
        `Primary risk signal is ${getBehavioralMetricLabel(selectedRep.improvementPriority)} (${weakest?.score || "N/A"}/5, ${weakest?.trend || "flat"} trend).`,
        `Sales risk is ${derived.salesRiskScore || 0}/100 with predictive confidence ${derived.predictiveConfidence || 0}/100.`,
        `Readiness is ${derived.readinessScore || 0}/100 and conversion proxy is ${derived.conversionProxyScore || 0}/100.`,
      ],
      actions: [
        `Prioritize a coaching sequence for ${getBehavioralMetricLabel(selectedRep.improvementPriority)} and re-check deterministic deltas next cycle.`,
        `Use Ask AI to pressure-test a one-week intervention plan focused on ${insightFocus}.`,
      ],
    };
  }

  return {
    highlights: [
      `${focusReps.length} reps are in scope with a team average of ${avgScore}/5 for the selected view.`,
      `${needsAttention} reps are currently flagged as needs-attention or inactive by deterministic status rules.`,
      `${topRep.name} is the strongest current performer at ${topRep.overallScore}/5.`,
      `Highest risk reps are ${riskOrdered.map((rep) => `${rep.name} (${calibratedDerivedByRepId[rep.id]?.salesRiskScore || 0}/100 risk)`).join(" and ")}.`,
      `Most common capability gap across the current deterministic aggregate is ${primaryGap}.`,
    ],
    actions: [
      `Coach the top two risk reps first, then monitor movement on ${primaryGap} before reassigning priorities.`,
      `Use Ask AI for a 30-second recap and a targeted weekly plan based on ${insightFocus}.`,
    ],
  };
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
  const [validationRecords, setValidationRecords] = useState([]);
  const [validationSummary, setValidationSummary] = useState({
    trackedInterventions: 0,
    positiveValidations: 0,
    neutralValidations: 0,
    negativeValidations: 0,
    pendingValidations: 0,
    insufficientData: 0,
    hasHistory: false,
    aggregateEffectiveness: 0,
    repSummaries: {},
    capabilitySummaries: {},
    mostResponsiveCapability: null,
    lowResponseCapability: null,
  });
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [validationStartBusy, setValidationStartBusy] = useState(false);
  const [validationFollowUpId, setValidationFollowUpId] = useState(null);
  const [repFilterId, setRepFilterId] = useState("all");
  const [timeRangeFilter, setTimeRangeFilter] = useState("this_month");
  const [insightFocusFilter, setInsightFocusFilter] = useState("coaching_priorities");
  const [detailLevelFilter, setDetailLevelFilter] = useState("quick_summary");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [quickAskPrompt, setQuickAskPrompt] = useState(null);

  const reps = viewState.reps;
  const selectedRep = useMemo(() => reps.find((rep) => rep.id === selectedRepId) ?? null, [reps, selectedRepId]);
  const validationAnalytics = useMemo(() => ({
    hasHistory: Boolean(validationSummary?.hasHistory),
    repSummaries: validationSummary?.repSummaries || {},
    capabilitySummaries: validationSummary?.capabilitySummaries || {},
    mostResponsiveCapability: validationSummary?.mostResponsiveCapability || null,
    lowResponseCapability: validationSummary?.lowResponseCapability || null,
  }), [validationSummary]);
  const calibratedDerivedByRepId = useMemo(() => Object.fromEntries(
    reps.map((rep) => {
      const derived = viewState.derivedByRepId[rep.id];
      const calibration = buildPredictiveCalibration(rep, derived, validationAnalytics);
      const hardenedCalibration = hardenPredictiveCalibration(rep, derived, calibration, validationAnalytics);
      return [
        rep.id,
        {
          ...derived,
          predictiveConfidence: hardenedCalibration.predictiveConfidence,
          calibration: hardenedCalibration,
        },
      ];
    }),
  ), [reps, validationAnalytics, viewState.derivedByRepId]);

  useEffect(() => {
    loadAssignments();
    loadSnippets();
    loadValidationSummary();
  }, []);

  useEffect(() => {
    if (selectedRepId && !reps.some((rep) => rep.id === selectedRepId)) {
      setSelectedRepId(null);
    }
  }, [reps, selectedRepId]);

  useEffect(() => {
    if (repFilterId === "all") {
      setSelectedRepId(null);
      return;
    }
    if (reps.some((rep) => rep.id === repFilterId)) {
      setSelectedRepId(repFilterId);
      if (activeTab !== "reps") setActiveTab("reps");
    }
  }, [activeTab, repFilterId, reps]);

  useEffect(() => {
    if (!selectedRepId) {
      setValidationRecords([]);
      setValidationLoading(false);
      setValidationError("");
      return;
    }
    loadValidationRecords(selectedRepId);
  }, [selectedRepId]);

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

  const loadValidationSummary = async () => {
    try {
      const data = await fetchValidationSummary();
      setValidationSummary(data.summary || {
        trackedInterventions: 0,
        positiveValidations: 0,
        neutralValidations: 0,
        negativeValidations: 0,
        pendingValidations: 0,
        insufficientData: 0,
        hasHistory: false,
        aggregateEffectiveness: 0,
        repSummaries: {},
        capabilitySummaries: {},
        mostResponsiveCapability: null,
        lowResponseCapability: null,
      });
    } catch (err) {
      console.error("Load validation summary error:", err);
      setValidationSummary({
        trackedInterventions: 0,
        positiveValidations: 0,
        neutralValidations: 0,
        negativeValidations: 0,
        pendingValidations: 0,
        insufficientData: 0,
        hasHistory: false,
        aggregateEffectiveness: 0,
        repSummaries: {},
        capabilitySummaries: {},
        mostResponsiveCapability: null,
        lowResponseCapability: null,
      });
    }
  };

  const loadValidationRecords = async (repId) => {
    if (!repId) {
      setValidationRecords([]);
      setValidationLoading(false);
      setValidationError("");
      return;
    }

    setValidationLoading(true);
    setValidationError("");
    try {
      const data = await fetchValidationRecords(repId);
      setValidationRecords(Array.isArray(data.records) ? data.records : []);
    } catch (err) {
      console.error("Load validation records error:", err);
      setValidationRecords([]);
      setValidationError(err.message || "validation_load_failed");
    } finally {
      setValidationLoading(false);
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

  const handleStartValidation = async (rep) => {
    if (!rep?.id) return;
    const derived = calibratedDerivedByRepId[rep.id];
    if (!derived) return;

    setValidationStartBusy(true);
    try {
      await startValidationRecord(rep, derived, validationAnalytics);
      setValidationError("");
      await Promise.all([loadValidationRecords(rep.id), loadValidationSummary()]);
    } catch (err) {
      console.error("Start validation error:", err);
      setValidationError(err.message || "validation_start_failed");
    } finally {
      setValidationStartBusy(false);
    }
  };

  const handleCaptureFollowUp = async (record, rep) => {
    if (!record?.id || !rep?.id) return;
    const derived = calibratedDerivedByRepId[rep.id];
    if (!derived) return;

    setValidationFollowUpId(record.id);
    try {
      await captureValidationFollowUp(record.id, rep, derived);
      setValidationError("");
      await Promise.all([loadValidationRecords(rep.id), loadValidationSummary()]);
    } catch (err) {
      console.error("Capture validation follow-up error:", err);
      setValidationError(err.message || "validation_follow_up_failed");
    } finally {
      setValidationFollowUpId(null);
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
  const coachingPriority = interventionQueue.slice().sort((a, b) => {
    const aSelection = selectHistoricalPriorityCapability(a, validationAnalytics);
    const bSelection = selectHistoricalPriorityCapability(b, validationAnalytics);
    const aWeakness = Math.max(0, 5 - (a.behavioralMetrics[a.improvementPriority]?.score || 5)) / 5;
    const bWeakness = Math.max(0, 5 - (b.behavioralMetrics[b.improvementPriority]?.score || 5)) / 5;
    const aRisk = (calibratedDerivedByRepId[a.id]?.salesRiskScore || 0) / 100;
    const bRisk = (calibratedDerivedByRepId[b.id]?.salesRiskScore || 0) / 100;
    const aScore = (aWeakness * 0.5) + ((aSelection.weightedPriorityScore || 0) * 0.35) + (aRisk * 0.15);
    const bScore = (bWeakness * 0.5) + ((bSelection.weightedPriorityScore || 0) * 0.35) + (bRisk * 0.15);
    return bScore - aScore;
  });
  const selectedTerritoryData = (selectedRep && viewState.territories.find((territory) => territory.territory === selectedRep.territory)) || viewState.nationalTerritory;
  const selectedRepInsightsData = selectedRep ? buildManagerInsightsRequest(selectedRep, selectedTerritoryData, calibratedDerivedByRepId[selectedRep.id]) : null;
  const territoryInsightsData = buildManagerInsightsRequest(null, viewState.nationalTerritory);
  const managerMetricsPayload = selectedRepInsightsData || territoryInsightsData;
  const selectedInsightFocusLabel = formatFilterLabel(INSIGHT_FOCUS_OPTIONS, insightFocusFilter, "Coaching Priorities");
  const selectedTimeRangeLabel = formatFilterLabel(TIME_RANGE_OPTIONS, timeRangeFilter, "This Month");
  const selectedDetailLevelLabel = formatFilterLabel(DETAIL_LEVEL_OPTIONS, detailLevelFilter, "Quick Summary");
  const selectedSegmentLabel = formatFilterLabel(SEGMENT_OPTIONS, segmentFilter, "All");
  const filteredReps = useMemo(
    () => (repFilterId === "all" ? reps : reps.filter((rep) => rep.id === repFilterId)),
    [repFilterId, reps],
  );
  const managerRecap = useMemo(
    () => buildManagerRecap({
      selectedRep,
      filteredReps,
      calibratedDerivedByRepId,
      viewState,
      insightFocus: selectedInsightFocusLabel,
    }),
    [selectedRep, filteredReps, calibratedDerivedByRepId, viewState, selectedInsightFocusLabel],
  );
  const quickPrompts = useMemo(() => {
    const repLabel = selectedRep?.name || "this team";
    return [
      { label: "Give me the 30-second recap", text: `Give me a 30-second recap for ${repLabel} focused on ${selectedInsightFocusLabel}.` },
      { label: "Why are these the top risks?", text: `Why are these the top deterministic risks for ${repLabel} in ${selectedTimeRangeLabel}?` },
      { label: "What should I do this week?", text: `What should I do this week for ${repLabel} based on the current manager recap?` },
      { label: "Show coaching plan for this rep", text: `Show a practical coaching plan for ${repLabel} with next steps and what to monitor.` },
    ];
  }, [selectedRep?.name, selectedInsightFocusLabel, selectedTimeRangeLabel]);

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
      sub: "Current 14-rep team average",
      explanation: viewState.explanations.overview.moduleCompletion,
    },
    {
      label: "Intervention queue",
      value: interventionQueue.length,
      sub: "Current reps requiring action",
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
    <div className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
      <div className="enterprise-hero-light mb-8 p-6 md:p-7">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#1A334D" }}>
            <Users className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Manager View</h1>
        </div>
        <p className="text-sm text-slate-700">Manager-friendly summaries built on the 8 canonical Signal Intelligence capabilities, auditable derived metrics, and the current 30-day demo dataset.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            Data integrity {viewState.validation.isValid ? "verified" : "needs review"} · {viewState.datasetScope.detail} · full 8-metric canonical model
          </div>
          <DefinitionsDialog />
        </div>
        {!viewState.validation.isValid ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Validation blocked one or more inconsistent values. Manager View is hiding any card without trusted metadata until the demo state is valid again.
          </div>
        ) : null}
      </div>

      <div className="mb-8 rounded-[28px] border border-teal-200 bg-gradient-to-r from-white to-slate-100 p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-600">Team intervention hub</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Manager View is now the intervention spoke for enterprise enablement.</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              This layer translates the canonical Signal Intelligence profile into manager actions: who needs support, which capability is weakest, and what to do next without exposing internal-only terms.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-700">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700">Current scope: {viewState.datasetScope.detail}</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700">Last refreshed: {formatRefreshTimestamp(viewState.refreshedAt)}</span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              {overviewCards.filter((card) => card.explanation || card.label === "Dataset scope").map((card) => (
                <div key={card.label} className="flex min-h-[140px] flex-col rounded-2xl border border-teal-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-50/35 hover:shadow-md">
                  <div className="flex min-w-0 items-start gap-2">
                    <p className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide leading-relaxed text-slate-700">{card.label}</p>
                  </div>
                  <p className="mt-4 text-2xl font-bold text-slate-900">{card.value}</p>
                  <div className="mt-auto flex flex-wrap items-baseline gap-2 pt-3 text-xs leading-relaxed text-slate-700">
                    <span>{card.sub}</span>
                    {card.explanation ? <MetricPill explanation={card.explanation} label="Formula" /> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full max-w-md rounded-3xl border border-teal-200 bg-slate-950 p-5 text-white shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">Hub and spoke routing</p>
                <p className="mt-1 text-xs text-slate-300">Refresh and reset actions recompute derived metrics, territory aggregates, balanced capability distribution, and auditable explanation metadata across the page.</p>
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

      <div className="mb-8 grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className={`${ENTERPRISE_PARENT_CARD} p-5`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Priority queue</p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">Who managers should coach next</h3>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{interventionQueue.length} active interventions</span>
          </div>
          <div className="mt-4 space-y-3">
            {coachingPriority.slice(0, 4).map((rep, index) => {
              const selectedCapability = selectHistoricalPriorityCapability(rep, validationAnalytics);
              const priorityLabel = getCapabilityLabelFromCanonicalId(selectedCapability.targetCapability);
              return (
              <button key={rep.id} type="button" onClick={() => { setSelectedRepId(rep.id); setActiveTab("reps"); }} className={`flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left ${ENTERPRISE_SUBCARD}`}>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{index + 1}. {rep.name}</p>
                  <p className="mt-1 text-xs text-slate-700">{rep.territory} · {getBehavioralMetricLabel(rep.improvementPriority)} weakness · {rep.sessionsCompleted30d} sessions in 30d</p>
                  <p className="mt-1 text-xs font-medium text-teal-700">Priority capability: {priorityLabel}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{rep.overallScore}/5</p>
                  <StatusBadge status={rep.status} />
                </div>
              </button>
            )})}
          </div>
        </div>

        <div className={`${ENTERPRISE_PARENT_CARD} p-5`}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Manager operating standard</p>
          <h3 className="mt-1 text-lg font-bold text-slate-900">Intervention guidance</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <div className={`${ENTERPRISE_SUBCARD} border-teal-100 bg-teal-50 p-4`}>Escalate low-adoption, low-score reps into mandatory remediation sequences within Learning Paths.</div>
            <div className={`${ENTERPRISE_SUBCARD} border-amber-100 bg-amber-50 p-4`}>Use scenario-level weakness to assign a targeted module before asking for additional simulator volume.</div>
            <div className={`${ENTERPRISE_SUBCARD} p-4`}>Package current territory summaries into Data and Reports for leadership visibility with auditable metric pills attached.</div>
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {kpiCards.filter((card) => card.explanation || card.label === "Active Reps" || card.label === "Team Sessions (30d)").map(({ label, value, sub, icon: Icon, tone, explanation }) => {
          const toneMap = {
            teal: { icon: "text-teal-700", card: "bg-teal-50 border-teal-200", value: "text-teal-800" },
            navy: { icon: "text-[#1A334D]", card: "bg-slate-100 border-slate-300", value: "text-[#1A334D]" },
            amber: { icon: "text-amber-700", card: "bg-amber-50 border-amber-200", value: "text-amber-800" },
          };
          const selectedTone = toneMap[tone] || toneMap.navy;
          return (
            <div key={label} className={`rounded-xl border border-teal-200 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-50/30 hover:shadow-md ${selectedTone.card}`}>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${selectedTone.icon}`} />
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">{label}</span>
                </div>
                <MetricPill explanation={explanation} label="Formula" />
              </div>
              <p className={`text-2xl font-bold ${selectedTone.value}`}>{value}</p>
              {sub ? <p className="mt-0.5 text-xs text-slate-700">{sub}</p> : null}
            </div>
          );
        })}
      </div>

      <div className="mb-8 rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Validation summary</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">Closed-loop intervention tracking</h3>
            <p className="mt-1 text-sm text-slate-700">Secondary evidence layer showing how many manager interventions are being tracked and how the latest deterministic outcomes are trending.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 font-semibold text-teal-800">
                Coaching Effectiveness {validationSummary.hasHistory ? `${Math.round((validationSummary.aggregateEffectiveness || 0) * 100)}%` : "Deterministic fallback"}
              </span>
              {validationSummary.mostResponsiveCapability ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">
                  Most responsive: {validationSummary.mostResponsiveCapability.capabilityLabel}
                </span>
              ) : null}
              {validationSummary.lowResponseCapability ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-semibold text-amber-800">
                  Low-response watch: {validationSummary.lowResponseCapability.capabilityLabel}
                </span>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Tracked", value: validationSummary.trackedInterventions, tone: "bg-teal-50 text-teal-800 border-teal-200" },
              { label: "Positive", value: validationSummary.positiveValidations, tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
              { label: "Neutral", value: validationSummary.neutralValidations, tone: "bg-sky-50 text-sky-800 border-sky-200" },
              { label: "Negative", value: validationSummary.negativeValidations, tone: "bg-rose-50 text-rose-800 border-rose-200" },
              { label: "Pending", value: validationSummary.pendingValidations, tone: "bg-slate-50 text-slate-800 border-slate-200" },
              { label: "Insufficient", value: validationSummary.insufficientData, tone: "bg-amber-50 text-amber-800 border-amber-200" },
            ].map((item) => (
              <div key={item.label} className={`min-w-[120px] rounded-xl border px-4 py-3 ${item.tone}`}>
                <p className="text-[11px] font-semibold uppercase tracking-wide">{item.label}</p>
                <p className="mt-1 text-2xl font-bold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-8 rounded-3xl border border-teal-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Select who/when/what to analyze</p>
        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-5">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">Rep Name</p>
            <input
              list="manager-rep-options"
              value={repFilterId === "all" ? "All Reps" : reps.find((rep) => rep.id === repFilterId)?.name || "All Reps"}
              onChange={(event) => {
                const value = event.target.value.trim();
                if (!value || value.toLowerCase() === "all reps") {
                  setRepFilterId("all");
                  return;
                }
                const matchedRep = reps.find((rep) => rep.name.toLowerCase() === value.toLowerCase());
                if (matchedRep) setRepFilterId(matchedRep.id);
              }}
              className="h-10 w-full rounded-full border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-teal-400 focus:outline-none"
              placeholder="Search rep"
            />
            <datalist id="manager-rep-options">
              <option value="All Reps" />
              {reps.map((rep) => <option key={rep.id} value={rep.name} />)}
            </datalist>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">Time Range</p>
            <Select value={timeRangeFilter} onValueChange={setTimeRangeFilter}>
              <SelectTrigger className="h-10 rounded-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">Insight Focus</p>
            <Select value={insightFocusFilter} onValueChange={setInsightFocusFilter}>
              <SelectTrigger className="h-10 rounded-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSIGHT_FOCUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">Detail Level</p>
            <Select value={detailLevelFilter} onValueChange={setDetailLevelFilter}>
              <SelectTrigger className="h-10 rounded-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DETAIL_LEVEL_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">Segment / Context</p>
            <Select value={segmentFilter} onValueChange={setSegmentFilter}>
              <SelectTrigger className="h-10 rounded-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEGMENT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-600">
          Manager View remains deterministic-first; this filter bar scopes what is displayed without changing underlying risk, mapping, and predictive logic.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="rounded-3xl border border-teal-200 bg-gradient-to-br from-white to-teal-50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Manager Recap</p>
          <p className="mt-2 text-sm text-slate-700">
            Based on {repFilterId === "all" ? "All Reps" : selectedRep?.name || "selected rep"} · {selectedTimeRangeLabel} · {selectedInsightFocusLabel}
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Predictive highlights</p>
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {managerRecap.highlights.slice(0, 6).map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-teal-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Do this next</p>
              <ul className="mt-2 space-y-2 text-sm text-teal-900">
                {managerRecap.actions.slice(0, 2).map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-teal-700" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Ask AI</p>
          <p className="mt-1 text-sm text-slate-700">High-level explanation and next-best actions.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt.label}
                type="button"
                onClick={() => setQuickAskPrompt({
                  id: Date.now(),
                  text: prompt.text,
                  contextLabel: `${selectedInsightFocusLabel} · ${selectedTimeRangeLabel}`,
                })}
                className="rounded-full border border-[#1A334D] bg-white px-3 py-1.5 text-xs font-semibold text-[#1A334D] transition-colors hover:border-teal-500 hover:bg-teal-50 hover:text-teal-700"
              >
                {prompt.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Current context: {selectedDetailLevelLabel} view · {selectedSegmentLabel} segment.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="sticky top-[4.75rem] z-20 mb-6 flex h-auto w-full flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">
          <TabsTrigger value="reps" className={MANAGER_TAB_TRIGGER_CLASSNAME}><Users className="h-3.5 w-3.5" /> Rep Overview</TabsTrigger>
          <TabsTrigger value="territory" className={MANAGER_TAB_TRIGGER_CLASSNAME}><BarChart3 className="h-3.5 w-3.5" /> Territory Analytics</TabsTrigger>
          <TabsTrigger value="modules" className={MANAGER_TAB_TRIGGER_CLASSNAME}><GraduationCap className="h-3.5 w-3.5" /> Training Modules</TabsTrigger>
          <TabsTrigger value="sessions" className={MANAGER_TAB_TRIGGER_CLASSNAME}><MessageCircle className="h-3.5 w-3.5" /> Session Feedback</TabsTrigger>
          <TabsTrigger value="snippets" className={MANAGER_TAB_TRIGGER_CLASSNAME}><Star className="h-3.5 w-3.5" /> Curate Snippets</TabsTrigger>
        </TabsList>

        <TabsContent value="reps">
          <div className="space-y-6">
            {detailLevelFilter === "balanced" ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Filtered reps</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{filteredReps.length}</p>
                  <p className="text-xs text-slate-600">In current scope</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Average score</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {(filteredReps.length ? (filteredReps.reduce((sum, rep) => sum + rep.overallScore, 0) / filteredReps.length) : 0).toFixed(2)}/5
                  </p>
                  <p className="text-xs text-slate-600">Deterministic aggregate</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Needs attention</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{filteredReps.filter((rep) => rep.status !== "active").length}</p>
                  <p className="text-xs text-slate-600">Status-based flags</p>
                </div>
              </div>
            ) : null}

            <div className={`${ENTERPRISE_PARENT_CARD} overflow-hidden rounded-xl`}>
              <div className="border-b border-gray-100 px-5 py-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Rep performance snapshot</h2>
                    <p className="text-xs text-slate-700">Each row keeps a compact 8-metric summary in view. Expand one rep at a time to inspect the full behavioral profile, risk signals, assignments, and AI context below.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-700">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">{viewState.datasetScope.detail}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">Last refreshed {formatRefreshTimestamp(viewState.refreshedAt)}</span>
                    <span className={`rounded-full border px-2.5 py-1 font-semibold ${selectedRep ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-300 bg-white text-slate-700"}`}>{selectedRep ? `${selectedRep.name} expanded` : "No rep expanded"}</span>
                    <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={handleRefreshDataset}>
                      <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={() => setSelectedRepId(null)}>
                      <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset selection
                    </Button>
                  </div>
                </div>
              </div>

              {detailLevelFilter === "quick_summary" ? (
                <div className="p-5">
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
                    Quick Summary mode is active. Use <span className="font-semibold">Balanced</span> or <span className="font-semibold">Deep Dive</span> to open supporting tables and rep-level diagnostic detail.
                  </div>
                </div>
              ) : null}

              {detailLevelFilter !== "quick_summary" ? (
              <div className="hidden overflow-x-auto 2xl:block">
                <table className="min-w-[1360px] w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[220px]" />
                    <col className="w-[92px]" />
                    <col className="w-[90px]" />
                    <col className="w-[260px]" />
                    <col className="w-[150px]" />
                    <col className="w-[170px]" />
                    <col className="w-[90px]" />
                    <col className="w-[150px]" />
                    <col className="w-[110px]" />
                  </colgroup>
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-950">Rep</th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-950">Overall Score</th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-950">Sessions (30d)</th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-950">Behavioral Profile (8 Metrics)</th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-950">Strongest Capability</th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-950">Capability Requiring Improvement</th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-950">Sales Trend</th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-950">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-950">Modules Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReps.map((rep) => (
                      <RepRow
                        key={rep.id}
                        rep={rep}
                        derived={calibratedDerivedByRepId[rep.id]}
                        explanations={viewState.explanations.rep[rep.id]}
                        onToggle={(repId) => setSelectedRepId((current) => current === repId ? null : repId)}
                        selected={selectedRep?.id === rep.id}
                        expandedContent={selectedRep?.id === rep.id ? (
                          <RepExpandedContent
                            rep={rep}
                            derived={calibratedDerivedByRepId[rep.id]}
                            viewState={viewState}
                            assignments={assignments}
                            loadAssignments={loadAssignments}
                            handleStatusChange={handleStatusChange}
                            handleDelete={handleDelete}
                            managerMetricsPayload={managerMetricsPayload}
                            validationAnalytics={validationAnalytics}
                            validationRecords={selectedRep?.id === rep.id ? validationRecords : []}
                            validationLoading={selectedRep?.id === rep.id ? validationLoading : false}
                            validationError={selectedRep?.id === rep.id ? validationError : ""}
                            validationStartBusy={validationStartBusy}
                            validationFollowUpId={validationFollowUpId}
                            onStartValidation={handleStartValidation}
                            onCaptureFollowUp={handleCaptureFollowUp}
                            onCollapse={() => setSelectedRepId(null)}
                          />
                        ) : null}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              ) : null}

              {detailLevelFilter !== "quick_summary" ? (
              <div className="space-y-4 p-4 2xl:hidden">
                {filteredReps.map((rep) => (
                  <RepMobileCard
                    key={rep.id}
                    rep={rep}
                    derived={calibratedDerivedByRepId[rep.id]}
                    explanations={viewState.explanations.rep[rep.id]}
                    onToggle={(repId) => setSelectedRepId((current) => current === repId ? null : repId)}
                    selected={selectedRep?.id === rep.id}
                    viewState={viewState}
                    assignments={assignments}
                    loadAssignments={loadAssignments}
                    handleStatusChange={handleStatusChange}
                    handleDelete={handleDelete}
                    managerMetricsPayload={managerMetricsPayload}
                    validationAnalytics={validationAnalytics}
                    validationRecords={selectedRep?.id === rep.id ? validationRecords : []}
                    validationLoading={selectedRep?.id === rep.id ? validationLoading : false}
                    validationError={selectedRep?.id === rep.id ? validationError : ""}
                    validationStartBusy={validationStartBusy}
                    validationFollowUpId={validationFollowUpId}
                    onStartValidation={handleStartValidation}
                    onCaptureFollowUp={handleCaptureFollowUp}
                  />
                ))}
              </div>
              ) : null}
            </div>

            <div className="manager-insights-container">
              <ManagerInsightsPanelExpanded
                key={`guided-panel-${selectedRep?.id || "team"}-${timeRangeFilter}-${insightFocusFilter}-${detailLevelFilter}-${segmentFilter}`}
                data={managerMetricsPayload}
                queuedPrompt={quickAskPrompt}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="territory">
          <div className="space-y-6">
            {viewState.validation.isValid ? (
              <div className="rounded-3xl border border-teal-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">Territory analytics workspace</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">National Team Aggregate predictive coaching layer</h3>
                <p className="mt-2 text-sm text-slate-700">Review territory cards first, then use the full AI workspace below for explainable predictive guidance, follow-up questions, and territory-specific coaching actions.</p>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
                Territory AI insights are hidden until metric validation passes. Deterministic territory aggregates remain available below.
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
              {[viewState.nationalTerritory, ...viewState.territories].map((territory) => {
                const territoryExplanations = viewState.explanations.territory[territory.territory];
                const territoryContributors = getContributorSet(viewState.contributors, territory.territory);
                const territoryRiskFlags = viewState.territoryRiskFlagsByName[territory.territory] || [];
                const driverBullets = territoryRiskFlags.length
                  ? territoryRiskFlags.map((flag) => normalizeManagerText(flag.explanation))
                  : [
                    territory.mostCommonCapabilityGap
                      ? `Primary gap is ${getBehavioralMetricLabel(territory.mostCommonCapabilityGap)} across the current rep mix.`
                      : "No single capability gap dominates the current territory mix.",
                    territory.topPerformingBehaviorPattern.length
                      ? `Strongest territory pattern is ${territory.topPerformingBehaviorPattern.map(getBehavioralMetricLabel).join(", ")}.`
                      : "No capability is materially above the current territory baseline.",
                  ];
                const actionBullets = territory.coachingOpportunityClusters.length
                  ? territory.coachingOpportunityClusters.slice(0, 2).map((item) => normalizeManagerText(item))
                  : ["Continue current coaching coverage and re-check the territory on the next 30-day refresh."];
                return (
                  <div key={territory.territory} className={`${ENTERPRISE_PARENT_CARD} p-5`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">{territory.territory}</p>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-700">
                          {territory.riskLevel === "high" ? "Manager attention is required." : territory.riskLevel === "moderate" ? "Manager follow-up is recommended." : "This territory is operating within the current manager guardrails."}
                        </p>
                      </div>
                      <div className="space-y-2 text-left sm:text-right">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${territory.riskLevel === "high" ? "bg-amber-50 text-amber-700" : territory.riskLevel === "moderate" ? "bg-slate-100 text-slate-700" : "bg-teal-50 text-teal-700"}`}>
                          {territory.riskLevel} risk
                        </span>
                        <div className="flex justify-start sm:justify-end">
                          <MetricPill explanation={territoryExplanations.riskLevel} label="Rule" />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-teal-200 bg-slate-50 p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Executive summary</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <div className={`${ENTERPRISE_SUBCARD_WHITE} p-3`}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs uppercase tracking-wide text-slate-700">Risk level</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{territory.riskLevel}</p>
                            </div>
                            <MetricPill explanation={territoryExplanations.riskLevel} label="Rule" />
                          </div>
                        </div>
                        <div className={`${ENTERPRISE_SUBCARD_WHITE} p-3`}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs uppercase tracking-wide text-slate-700">Primary gap</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{territory.mostCommonCapabilityGap ? getBehavioralMetricLabel(territory.mostCommonCapabilityGap) : "No dominant gap"}</p>
                            </div>
                            <MetricPill explanation={territoryExplanations.mostCommonCapabilityGap} label="Source" />
                          </div>
                        </div>
                        <div className={`${ENTERPRISE_SUBCARD_WHITE} p-3`}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs uppercase tracking-wide text-slate-700">Key metrics</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{territory.avgPerformance}/5 · {territory.avgEngagement}/100</p>
                            </div>
                            <div className="flex flex-col items-start gap-1 sm:items-end">
                              <MetricPill explanation={territoryExplanations.avgPerformance} label="Sales outcome" />
                              <MetricPill explanation={territoryExplanations.avgEngagement} label="Engagement" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                      <div className={`${ENTERPRISE_SUBCARD_WHITE} rounded-2xl p-4`}>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">What is driving this</p>
                        <ul className="mt-3 space-y-2 text-sm text-slate-700">
                          {driverBullets.slice(0, 3).map((item) => (
                            <li key={item} className="flex gap-2">
                              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className={`${ENTERPRISE_SUBCARD} rounded-2xl p-4`}>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">What to do</p>
                        <ul className="mt-3 space-y-2 text-sm text-slate-700">
                          {actionBullets.map((item) => (
                            <li key={item} className="flex gap-2">
                              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-teal-500" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                          <Activity className="h-3 w-3" />
                          {territory.repIds.length} reps in aggregate
                        </span>
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                          Territory Volatility {territory.territoryVolatility}
                        </span>
                        <MetricPill explanation={territoryExplanations.territoryVolatility} label="Threshold" />
                      </div>
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
              <div className={`${ENTERPRISE_PARENT_CARD} rounded-xl p-5 pt-6`}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Team Signal Intelligence Profile</h3>
                    <p className="text-xs text-slate-700">National Team Aggregate average vs. benchmark across all 8 capabilities</p>
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

              <div className={`${ENTERPRISE_PARENT_CARD} rounded-xl p-5 pt-6`}>
                <h3 className="mb-1 text-sm font-bold text-gray-900">Sessions per Rep (Last 30 Days)</h3>
                <p className="mb-4 text-xs text-slate-700">Platform engagement across the current Manager View dataset</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reps.map((rep) => ({ name: rep.name.split(" ")[0], sessions: rep.sessionsCompleted30d, score: rep.overallScore }))} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} width={70} />
                    <Tooltip formatter={(value, name) => [value, name === "sessions" ? "Sessions" : "Overall Score"]} />
                    <Bar dataKey="sessions" fill="#14b8a6" radius={[0, 4, 4, 0]} name="Sessions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className={`${ENTERPRISE_PARENT_CARD} rounded-xl p-5 pt-6 lg:col-span-2`}>
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
                      <span className="w-16 text-right text-xs text-slate-700">{rep.sessionsCompleted30d} sessions</span>
                      <StatusBadge status={rep.status} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {viewState.validation.isValid ? (
              <div className="manager-insights-container">
                <ManagerInsightsPanelExpanded key={`territory-expanded-${viewState.version}`} data={territoryInsightsData} />
              </div>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="modules">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Training Modules by Signal Intelligence Capability</h2>
                <p className="text-sm text-slate-700">All 8 capabilities with aligned coaching content your reps are evaluated on</p>
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
                        <h3 className="text-sm font-bold text-gray-900">{capability.label} <span className="text-xs font-normal text-slate-700">{capability.subtitle}</span></h3>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {capability.metrics.map((metric) => (
                            <span key={metric} className="text-xs text-slate-700">{metric}</span>
                          ))}
                        </div>
                      </div>
                      {weakReps.length > 0 ? <span className="flex-shrink-0 text-xs font-semibold text-amber-700">{weakReps.length} rep{weakReps.length > 1 ? "s" : ""} need focus</span> : null}
                    </div>

                    <div className="space-y-2 p-4">
                      {capabilityModules.length === 0 ? (
                        <p className="py-3 text-center text-xs italic text-slate-700">No modules for this capability yet</p>
                      ) : capabilityModules.map((module) => (
                        <div key={module.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent bg-gray-50 p-2.5 transition-all hover:border-teal-100 hover:bg-teal-50">
                          <BookOpen className="h-4 w-4 flex-shrink-0 text-slate-700" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-gray-800">{module.title}</p>
                            <p className="text-xs text-slate-700">{module.type} · {module.duration}</p>
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
              <p className="text-sm text-slate-700">Review recent role-play sessions and leave direct coaching feedback for your reps.</p>
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
                      <p className="text-xs text-slate-700">{session.scenario}</p>
                      <p className="text-xs text-slate-700">{session.date}</p>
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
              <p className="text-sm text-slate-700">Review and feature top communication snippets shared by your team. Curated snippets appear highlighted in the Knowledge Base.</p>
            </div>
            {snippets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
                <Star className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm font-semibold text-slate-700">No shared snippets yet</p>
                <p className="mt-1 text-xs text-slate-700">Reps can share snippets via the Knowledge Base → Peer Best Practices tab</p>
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
                        {snippet.context ? <p className="text-xs italic text-slate-700">{snippet.context}</p> : null}
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-700">{snippet.shared_by_role || "Anonymous Rep"}</span>
                          <span className="text-xs text-slate-700">·</span>
                          <span className="flex items-center gap-0.5 text-xs text-slate-700"><ThumbsUp className="h-3 w-3" /> {snippet.upvotes || 0} upvotes</span>
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
