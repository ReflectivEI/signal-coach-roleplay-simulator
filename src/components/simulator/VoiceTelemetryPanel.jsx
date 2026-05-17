import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  Gauge,
  MessageSquareWarning,
  Radio,
  ShieldCheck,
  TimerReset,
  TrendingDown,
  Waves,
} from "lucide-react";
import { mapVoiceEventToCoaching, useVoiceTelemetry } from "@/lib/voiceTelemetryEngine";

const severityColors = {
  low: "rgba(127, 225, 178, 0.96)",
  moderate: "rgba(255, 225, 139, 0.96)",
  high: "rgba(255, 169, 119, 0.98)",
  critical: "rgba(255, 132, 160, 0.98)",
};

const trajectoryCopy = {
  stabilizing: "Trajectory stabilizing",
  recoverable: "Recoverable pressure",
  at_risk: "Conversation at risk",
  critical: "Critical trajectory risk",
};

function latestVoicePayload(voiceEvaluation, latestVoiceAnalysis) {
  return voiceEvaluation?.voiceMetadata || latestVoiceAnalysis?.metadata || latestVoiceAnalysis || {};
}

function deriveScores(lastSignals = {}) {
  const map = (value, strong, partial) => {
    if (value === strong) return 4.2;
    if (value === partial) return 3.1;
    if (!value) return 3;
    return 2.2;
  };

  return {
    question_quality: map(lastSignals.question_type, "open_ended", "closed_ended"),
    listening_responsiveness: map(lastSignals.listening_pattern, "responsive", "partially_responsive"),
    customer_engagement_signals: map(lastSignals.engagement_level, "high", "moderate"),
    making_it_matter: map(lastSignals.response_alignment, "strong", "partial"),
    objection_navigation: lastSignals.objection_type && lastSignals.objection_type !== "none" ? 2.9 : 3.4,
    conversation_control_structure: map(lastSignals.control_pattern, "balanced", "hcp_dominant"),
    adaptability: map(lastSignals.response_alignment, "strong", "partial"),
    commitment_gaining: map(lastSignals.commitment_attempt, "clear", "weak"),
  };
}

function GaugeDial({ label, value, max = 100, tone = "cyan", icon: Icon = Gauge }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, Number(value || 0) / max));
  const stroke = tone === "amber" ? "rgba(255, 225, 139, 0.96)" : tone === "rose" ? "rgba(255, 132, 160, 0.96)" : "rgba(118, 241, 223, 0.96)";

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" style={{ color: stroke }} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: "rgba(220,236,236,0.68)" }}>
            {label}
          </span>
        </div>
        <span className="text-sm font-semibold tabular-nums" style={{ color: "rgba(247,252,252,0.96)" }}>
          {Math.round(Number(value || 0))}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-center">
        <svg width="88" height="54" viewBox="0 0 88 54" aria-hidden="true">
          <path d="M10 44a34 34 0 0 1 68 0" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" strokeLinecap="round" />
          <motion.path
            d="M10 44a34 34 0 0 1 68 0"
            fill="none"
            stroke={stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference / 2}
            initial={false}
            animate={{ strokeDashoffset: (circumference / 2) * (1 - progress) }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </svg>
      </div>
    </div>
  );
}

function AnimatedWaveform({ points = [], stressLoad = 0 }) {
  const color = stressLoad >= 70 ? "rgba(255, 132, 160, 0.92)" : "rgba(115, 242, 224, 0.90)";

  return (
    <div className="relative h-24 overflow-hidden rounded-xl border border-white/10 bg-black/20 px-3 py-3">
      <div className="absolute inset-x-3 top-1/2 h-px bg-cyan-100/10" />
      <div className="flex h-full items-center gap-1">
        {points.map((point, index) => (
          <motion.div
            key={`${index}-${Math.round(point)}`}
            className="w-1 rounded-full"
            style={{ background: color, boxShadow: `0 0 14px ${color}` }}
            initial={false}
            animate={{ height: `${Math.max(8, point)}%`, opacity: 0.52 + (point / 210) }}
            transition={{ duration: 0.38, ease: "easeOut" }}
          />
        ))}
      </div>
      <motion.div
        className="absolute inset-y-0 w-16"
        style={{ background: "linear-gradient(90deg, transparent, rgba(116,227,206,0.12), transparent)" }}
        animate={{ x: ["-30%", "245%"] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

function ConfidenceDriftChart({ drift = [] }) {
  const path = drift.map((point, index) => {
    const x = (index / Math.max(1, drift.length - 1)) * 100;
    const y = 44 - (Number(point.value || 0) / 100) * 38;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: "rgba(220,236,236,0.68)" }}>
          Confidence Drift
        </p>
        <TrendingDown className="h-3.5 w-3.5" style={{ color: "rgba(255,225,139,0.86)" }} />
      </div>
      <svg viewBox="0 0 100 46" className="mt-2 h-16 w-full overflow-visible" aria-hidden="true">
        {[12, 24, 36].map((y) => (
          <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="0.7" />
        ))}
        <motion.path
          d={path}
          fill="none"
          stroke="rgba(118,241,223,0.94)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        />
      </svg>
    </div>
  );
}

function InterruptionTimeline({ events = [] }) {
  const notable = events.filter((event) => [
    "interruption_detected",
    "hesitation_spike",
    "pacing_acceleration",
    "confidence_drop",
    "filler_word_cluster",
  ].includes(event.type)).slice(0, 5);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
      <div className="flex items-center gap-2">
        <MessageSquareWarning className="h-3.5 w-3.5" style={{ color: "rgba(118,241,223,0.86)" }} />
        <p className="text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: "rgba(220,236,236,0.68)" }}>
          Interruption Timeline
        </p>
      </div>
      <div className="relative mt-4 h-9">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-white/12" />
        {notable.map((event, index) => {
          const left = notable.length <= 1 ? 50 : 8 + (index / (notable.length - 1)) * 84;
          const color = severityColors[event.severity] || severityColors.moderate;
          return (
            <div key={event.id} className="absolute top-1/2 -translate-y-1/2" style={{ left: `${left}%` }}>
              <motion.div
                className="h-3 w-3 rounded-full border"
                style={{ background: color, borderColor: "rgba(255,255,255,0.36)", boxShadow: `0 0 18px ${color}` }}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                title={event.type.replace(/_/g, " ")}
              />
            </div>
          );
        })}
      </div>
      <p className="text-[11px] leading-relaxed" style={{ color: "rgba(220,236,236,0.62)" }}>
        {notable[0]?.insight || "No interruption pressure detected in the current telemetry window."}
      </p>
    </div>
  );
}

function EventRow({ event }) {
  const color = severityColors[event.severity] || severityColors.moderate;
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-semibold capitalize" style={{ color: "rgba(247,252,252,0.94)" }}>
          {event.type.replace(/_/g, " ")}
        </p>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color }}>
          {event.severity}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "rgba(220,236,236,0.70)" }}>
        {event.insight}
      </p>
    </div>
  );
}

export default function VoiceTelemetryPanel({
  turns = [],
  lastSignals = {},
  latestVoiceAnalysis = null,
  voiceEvaluation = null,
  hcpPrediction = null,
  onCriticalVoiceEvent = null,
  onOpenReasoning = null,
}) {
  const lastCriticalIdRef = useRef("");
  const voiceMetadata = latestVoicePayload(voiceEvaluation, latestVoiceAnalysis);
  const currentMetricScores = useMemo(() => deriveScores(lastSignals), [lastSignals]);
  const telemetryInput = useMemo(() => ({
    voiceMetadata,
    voiceAnalysis: latestVoiceAnalysis || voiceEvaluation?.result || {},
    turns,
    lastSignals,
    hcpPrediction,
    currentMetricScores,
    pressureLevel: String(hcpPrediction?.riskLevel || "").toLowerCase() === "high" ? 76 : 44,
  }), [currentMetricScores, hcpPrediction, lastSignals, latestVoiceAnalysis, turns, voiceEvaluation, voiceMetadata]);
  const { telemetry, criticalEvent } = useVoiceTelemetry(telemetryInput);
  const primaryEvent = telemetry.events[0];
  const trajectoryColor = telemetry.trajectoryImpact === "critical"
    ? "rgba(255,132,160,0.98)"
    : telemetry.trajectoryImpact === "at_risk"
      ? "rgba(255,225,139,0.98)"
      : "rgba(118,241,223,0.94)";

  useEffect(() => {
    if (!criticalEvent || lastCriticalIdRef.current === criticalEvent.id) return;
    lastCriticalIdRef.current = criticalEvent.id;
    onCriticalVoiceEvent?.(criticalEvent, mapVoiceEventToCoaching(criticalEvent));
  }, [criticalEvent, onCriticalVoiceEvent]);

  return (
    <section
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(160deg, rgba(7,13,28,0.98) 0%, rgba(13,31,47,0.98) 50%, rgba(20,48,58,0.96) 100%)",
        border: "1px solid rgba(94, 221, 211, 0.22)",
        boxShadow: "0 22px 48px rgba(0,0,0,0.20)",
      }}
    >
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(118,241,223,0.82), transparent)" }} />
      <div className="absolute -left-20 top-10 h-40 w-40 rounded-full border border-cyan-100/10" />

      <div className="relative space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <div
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
              style={{
                background: "rgba(72, 187, 205, 0.13)",
                borderColor: "rgba(118,241,223,0.28)",
                color: "rgba(118,241,223,0.96)",
              }}
            >
              <Waves className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(118,241,223,0.86)" }}>
                Voice & Behavioral Telemetry
              </p>
              <h3 className="mt-1 text-sm font-semibold leading-snug" style={{ color: "rgba(247,252,252,0.98)" }}>
                How the rep is handling pressure in real time
              </h3>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.055] px-2.5 py-1.5 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: "rgba(220,236,236,0.62)" }}>
              Composure
            </p>
            <p className="text-2xl font-semibold tabular-nums leading-none" style={{ color: "rgba(247,252,252,0.98)" }}>
              {telemetry.composureUnderPressure}
            </p>
          </div>
        </div>

        <AnimatedWaveform points={telemetry.waveform} stressLoad={telemetry.stressLoad} />

        <div className="grid grid-cols-2 gap-2">
          <GaugeDial label="Pacing" value={telemetry.pacingWordsPerMinute} max={220} tone={telemetry.pacingWordsPerMinute > 175 ? "rose" : "cyan"} icon={TimerReset} />
          <GaugeDial label="Composure" value={telemetry.composureUnderPressure} tone={telemetry.composureUnderPressure < 48 ? "rose" : "cyan"} icon={ShieldCheck} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: "rgba(220,236,236,0.68)" }}>
                Stress Load
              </p>
              <AlertTriangle className="h-3.5 w-3.5" style={{ color: telemetry.stressLoad >= 70 ? "rgba(255,132,160,0.96)" : "rgba(255,225,139,0.86)" }} />
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full"
                style={{ background: telemetry.stressLoad >= 70 ? "rgba(255,132,160,0.94)" : "rgba(255,225,139,0.90)" }}
                initial={false}
                animate={{ width: `${telemetry.stressLoad}%` }}
                transition={{ duration: 0.45, ease: "easeOut" }}
              />
            </div>
            <p className="mt-2 text-lg font-semibold tabular-nums" style={{ color: "rgba(247,252,252,0.96)" }}>{telemetry.stressLoad}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: "rgba(220,236,236,0.68)" }}>
                Latency
              </p>
              <Radio className="h-3.5 w-3.5" style={{ color: "rgba(118,241,223,0.86)" }} />
            </div>
            <p className="mt-3 text-lg font-semibold tabular-nums" style={{ color: "rgba(247,252,252,0.96)" }}>
              {telemetry.responseLatencyMs}ms
            </p>
            <p className="mt-1 text-[11px]" style={{ color: "rgba(220,236,236,0.62)" }}>
              Hesitation index {telemetry.hesitationIndex}
            </p>
          </div>
        </div>

        <ConfidenceDriftChart drift={telemetry.confidenceDrift} />
        <InterruptionTimeline events={telemetry.events} />

        <div className="rounded-xl border p-3" style={{ borderColor: "rgba(118,241,223,0.22)", background: "rgba(33,91,87,0.16)" }}>
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-3.5 w-3.5" style={{ color: "rgba(118,241,223,0.90)" }} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(118,241,223,0.86)" }}>
              Real-time Coaching Insight
            </p>
          </div>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "rgba(238,247,248,0.94)" }}>
            {primaryEvent.coachingRecommendation}
          </p>
          <button
            type="button"
            onClick={() => onOpenReasoning?.({
              source: "voice_telemetry",
              event: primaryEvent,
              voiceTelemetry: telemetry,
              recommendation: primaryEvent.coachingRecommendation,
              confidence: Math.max(0.52, Math.min(0.94, telemetry.confidence / 100)),
              primaryReason: `${primaryEvent.insight} This recommendation was generated from voice behavior, transcript context, and metric impact evidence.`,
              metricScores: currentMetricScores,
            })}
            className="mt-3 inline-flex w-full items-center justify-center rounded-xl border px-3 py-2 text-[11px] font-semibold transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: "rgba(255,255,255,0.055)",
              borderColor: "rgba(255,255,255,0.14)",
              color: "rgba(238,247,248,0.92)",
            }}
          >
            Why this recommendation?
          </button>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: "rgba(220,236,236,0.58)" }}>
              Impact on conversation trajectory
            </span>
            <span className="text-[11px] font-semibold" style={{ color: trajectoryColor }}>
              {trajectoryCopy[telemetry.trajectoryImpact]}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            ["Fillers", telemetry.fillerWordCount],
            ["Interruptions", telemetry.interruptionFrequency],
            ["Dominance", telemetry.conversationalDominance],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.045] px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(220,236,236,0.56)" }}>{label}</p>
              <p className="mt-1 text-sm font-semibold tabular-nums" style={{ color: "rgba(247,252,252,0.94)" }}>{value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" style={{ color: "rgba(118,241,223,0.82)" }} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(220,236,236,0.68)" }}>
              Voice Event Stream
            </p>
          </div>
          {telemetry.events.slice(0, 3).map((event) => <EventRow key={event.id} event={event} />)}
        </div>
      </div>
    </section>
  );
}
