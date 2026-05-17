import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Gauge,
  GitBranch,
  RadioTower,
  SlidersHorizontal,
  Sparkles,
  TimerReset,
  Waves,
} from "lucide-react";
import { useSimulatorIntelligenceStore } from "@/lib/simulatorIntelligenceStore";

const stateLabels = {
  stable: "Stable",
  recoverable: "Recoverable",
  fragile: "Fragile",
  escalating: "Escalating",
  stabilizing: "Stabilizing",
  deteriorating: "Deteriorating",
  trust_recovery: "Trust recovery",
  compliance_sensitive: "Compliance sensitive",
  disengaging: "Disengaging",
  improving: "Improving",
};

const levelColor = {
  low: "rgba(127,225,178,0.92)",
  moderate: "rgba(255,225,139,0.92)",
  high: "rgba(255,169,119,0.94)",
  critical: "rgba(255,132,160,0.96)",
  elevated: "rgba(255,225,139,0.92)",
  intense: "rgba(255,132,160,0.96)",
};

function qualitativePressureLabel(level) {
  if (level === "critical") return "critical boundary";
  if (level === "high") return "rising";
  if (level === "moderate") return "active";
  return "contained";
}

export function DynamicTrajectoryBanner({ transition }) {
  const color = transition.direction === "worsening"
    ? "rgba(255,169,119,0.96)"
    : transition.direction === "compliance_boundary"
      ? "rgba(255,132,160,0.96)"
      : "rgba(118,241,223,0.94)";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <motion.div
        className="absolute inset-0"
        style={{ background: `radial-gradient(circle at 16% 10%, ${color.replace("0.96", "0.12").replace("0.94", "0.12")}, transparent 42%)` }}
        animate={{ opacity: [0.45, 0.72, 0.45] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <RadioTower className="h-4 w-4" style={{ color }} />
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "rgba(220,236,236,0.70)" }}>
            Dynamic Trajectory
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 text-sm font-semibold" style={{ color: "rgba(247,252,252,0.92)" }}>
            {stateLabels[transition.previousState]}
          </span>
          <motion.span
            animate={{ x: [0, 3, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ color }}
          >
            <ArrowRight className="h-4 w-4" />
          </motion.span>
          <span className="rounded-xl border px-3 py-1.5 text-sm font-semibold" style={{ color, borderColor: color, background: "rgba(255,255,255,0.05)" }}>
            {stateLabels[transition.currentState]}
          </span>
        </div>
        <p className="mt-3 text-xs leading-relaxed" style={{ color: "rgba(238,247,248,0.84)" }}>
          {transition.explanation}
        </p>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: "rgba(220,236,236,0.54)" }}>
          {transition.confidenceLanguage}
        </p>
      </div>
    </section>
  );
}

export function PredictiveChainPanel({ chain, coachShadow, onApplyIntervention }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" style={{ color: "rgba(118,241,223,0.88)" }} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "rgba(220,236,236,0.70)" }}>
              {chain.chainLabel}
            </p>
          </div>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "rgba(220,236,236,0.72)" }}>
            Current trajectory context: {stateLabels[chain.trajectoryContext]}. Chain confidence is {chain.confidenceLanguage}.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: levelColor[chain.risk === "critical" ? "critical" : chain.risk === "elevated" ? "high" : "moderate"] }}>
          {chain.risk}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {chain.steps.slice(0, 3).map((step, index) => (
          <div key={`${step.eventType}-${index}`} className="rounded-xl border border-white/10 bg-black/15 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-cyan-100/20 text-[10px] font-semibold" style={{ color: "rgba(118,241,223,0.92)" }}>
                  {index + 1}
                </span>
                <p className="text-[11px] font-semibold" style={{ color: "rgba(247,252,252,0.94)" }}>{step.label}</p>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: levelColor[step.riskLevel] }}>
                {step.probabilityBand.replace("_", " ")}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "rgba(220,236,236,0.62)" }}>
              {step.expectedTimeframe}. {step.suggestedPreparation}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-cyan-100/15 bg-cyan-100/[0.045] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: "rgba(118,241,223,0.82)" }}>
          Recommended intervention point
        </p>
        <p className="mt-1 text-xs font-semibold" style={{ color: "rgba(247,252,252,0.94)" }}>{chain.intervention.label}</p>
        <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "rgba(220,236,236,0.66)" }}>{chain.intervention.rationale}</p>
        {coachShadow?.bestMove && (
          <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "rgba(255,225,139,0.78)" }}>
            Coach shadow alignment: {coachShadow.bestMove}
          </p>
        )}
        <button
          type="button"
          onClick={() => onApplyIntervention?.(chain.intervention.safestResponse)}
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl border px-3 py-2 text-[11px] font-semibold transition-all hover:-translate-y-0.5"
          style={{ borderColor: "rgba(118,241,223,0.28)", background: "rgba(118,241,223,0.12)", color: "rgba(220,255,250,0.98)" }}
        >
          Apply intervention to next response
        </button>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="mt-3 inline-flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold"
        style={{ color: "rgba(238,247,248,0.82)" }}
      >
        <span>Why this chain?</span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden pt-2 text-xs leading-relaxed"
            style={{ color: "rgba(220,236,236,0.68)" }}
          >
            {chain.whyThisChain}
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}

export function RealTimeHCPPostureCard({ posture, shift }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4" style={{ color: "rgba(118,241,223,0.88)" }} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "rgba(220,236,236,0.70)" }}>
              Real-time HCP Posture
            </p>
          </div>
          <h3 className="mt-2 text-sm font-semibold" style={{ color: "rgba(247,252,252,0.96)" }}>{posture.label}</h3>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: levelColor[posture.complianceSensitivity] }}>
          {posture.complianceSensitivity} sensitivity
        </span>
      </div>
      <p className="mt-3 text-xs leading-relaxed" style={{ color: "rgba(220,236,236,0.72)" }}>{posture.description}</p>
      {shift && (
        <div className="mt-3 rounded-xl border border-cyan-100/15 bg-cyan-100/[0.045] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: "rgba(118,241,223,0.80)" }}>Posture shift detected</p>
          <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "rgba(220,236,236,0.72)" }}>{shift.explanation}</p>
        </div>
      )}
      <div className="mt-3 space-y-2">
        <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: "rgba(255,225,139,0.82)" }}>What the HCP is really testing</p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "rgba(247,252,252,0.90)" }}>{posture.reallyTesting}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: "rgba(127,225,178,0.82)" }}>Recommended adjustment</p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "rgba(247,252,252,0.90)" }}>{posture.recommendedRepBehavior}</p>
        </div>
      </div>
    </section>
  );
}

export function PressurePulseRing({ state }) {
  const color = state.pulseIntensity === "critical"
    ? "rgba(255,132,160,0.96)"
    : state.pulseIntensity === "tense"
      ? "rgba(255,169,119,0.94)"
      : "rgba(118,241,223,0.90)";

  return (
    <div className="relative flex h-24 items-center justify-center rounded-xl border border-white/10 bg-black/15">
      <motion.div
        className="absolute h-16 w-16 rounded-full border"
        style={{ borderColor: color }}
        animate={{ scale: [1, state.pulseIntensity === "calm" ? 1.05 : 1.18, 1], opacity: [0.48, 0.88, 0.48] }}
        transition={{ duration: state.pulseIntensity === "critical" ? 1.4 : 2.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative text-center">
        <Activity className="mx-auto h-4 w-4" style={{ color }} />
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color }}>
          {state.pulseIntensity}
        </p>
      </div>
    </div>
  );
}

export function ResponseWindowIndicator({ state }) {
  const width = state.responseWindow === "open" ? "92%" : state.responseWindow === "narrowing" ? "62%" : "36%";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center gap-2">
        <TimerReset className="h-3.5 w-3.5" style={{ color: "rgba(118,241,223,0.86)" }} />
        <p className="text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: "rgba(220,236,236,0.66)" }}>
          {state.responseWindow === "open" ? "Response window open" : state.responseWindow === "narrowing" ? "Response window narrowing" : "Response window compressed"}
        </p>
      </div>
      <div className="mt-3 h-2 rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "rgba(118,241,223,0.88)" }}
          initial={false}
          animate={{ width }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export function PressureTimeline({ state }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: "rgba(220,236,236,0.66)" }}>Pressure timeline</p>
      <div className="mt-3 space-y-2">
        {state.timelineTicks.slice(0, 4).map((signal) => (
          <div key={signal.id} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: levelColor[signal.level] }} />
            <span className="text-[11px] leading-snug" style={{ color: "rgba(238,247,248,0.82)" }}>
              {signal.label}: {qualitativePressureLabel(signal.level)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WaveformInstabilityOverlay({ state }) {
  const bars = state.waveformInstability === "unstable" ? [44, 78, 32, 84, 38, 70, 28, 76] : state.waveformInstability === "variable" ? [42, 58, 48, 66, 44, 60, 40, 54] : [42, 46, 44, 48, 43, 45, 42, 46];
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 p-3">
      <div className="flex h-12 items-center gap-1">
        {bars.map((height, index) => (
          <motion.div
            key={`${height}-${index}`}
            className="w-2 rounded-full"
            style={{ background: state.waveformInstability === "unstable" ? "rgba(255,169,119,0.84)" : "rgba(118,241,223,0.78)" }}
            animate={{ height: `${height}%` }}
            transition={{ duration: 0.4 }}
          />
        ))}
      </div>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: "rgba(220,236,236,0.58)" }}>
        Waveform {state.waveformInstability}
      </p>
    </div>
  );
}

export function PressureVisualizationPanel({ state }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-center gap-2">
        <Waves className="h-4 w-4" style={{ color: "rgba(118,241,223,0.88)" }} />
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "rgba(220,236,236,0.70)" }}>
          Pressure Visualization
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <PressurePulseRing state={state} />
        <WaveformInstabilityOverlay state={state} />
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2">
        <ResponseWindowIndicator state={state} />
        <PressureTimeline state={state} />
      </div>
    </section>
  );
}

export function RealismEnginePanel({ profile, adminMode = false }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4" style={{ color: "rgba(118,241,223,0.88)" }} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "rgba(220,236,236,0.70)" }}>
              Realism Engine
            </p>
          </div>
          <h3 className="mt-2 text-sm font-semibold" style={{ color: "rgba(247,252,252,0.96)" }}>{profile.modeLabel}</h3>
        </div>
        {adminMode && <SlidersHorizontal className="h-4 w-4" style={{ color: "rgba(255,225,139,0.86)" }} />}
      </div>
      <p className="mt-3 text-xs leading-relaxed" style={{ color: "rgba(220,236,236,0.72)" }}>{profile.interpretation}</p>
      <div className="mt-3 space-y-2">
        {profile.activeDimensions.slice(0, adminMode ? 8 : 4).map((dimension) => (
          <div key={dimension.id} className="rounded-xl border border-white/10 bg-black/15 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold" style={{ color: "rgba(247,252,252,0.94)" }}>{adminMode ? dimension.label : dimension.repFacingSignal}</p>
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: levelColor[dimension.qualitativeState] }}>
                {dimension.qualitativeState}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "rgba(220,236,236,0.60)" }}>{dimension.driver}</p>
            {adminMode && (
              <div className="mt-2">
                <div className="h-1.5 rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "rgba(118,241,223,0.84)" }}
                    animate={{ width: `${dimension.adminValue}%` }}
                    transition={{ duration: 0.35 }}
                  />
                </div>
                <p className="mt-1 text-[10px] tabular-nums" style={{ color: "rgba(220,236,236,0.48)" }}>Admin calibration {dimension.adminValue}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-cyan-100/15 bg-cyan-100/[0.045] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: "rgba(118,241,223,0.80)" }}>Adaptive driver</p>
        <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "rgba(220,236,236,0.68)" }}>{profile.adaptationSummary}</p>
      </div>
    </section>
  );
}

export default function AdaptiveIntelligenceLayer({
  turns = [],
  lastSignals = {},
  hcpPrediction = null,
  voiceMetadata = null,
  voiceTelemetry = null,
  coachShadow = null,
  realism,
  adminMode = false,
  onApplyIntervention = null,
}) {
  const input = useMemo(() => ({
    turns,
    lastSignals,
    hcpPrediction,
    voiceMetadata,
    voiceTelemetry,
    coachShadow,
    realism,
    adminMode,
  }), [adminMode, coachShadow, hcpPrediction, lastSignals, realism, turns, voiceMetadata, voiceTelemetry]);
  const intelligence = useSimulatorIntelligenceStore(input);

  return (
    <div className="space-y-3">
      <div
        className="rounded-2xl border p-3"
        style={{
          background: "linear-gradient(160deg, rgba(7,13,28,0.98) 0%, rgba(13,31,47,0.98) 55%, rgba(16,45,55,0.96) 100%)",
          borderColor: "rgba(94,221,211,0.22)",
          boxShadow: "0 22px 48px rgba(0,0,0,0.18)",
        }}
      >
        <div className="mb-3 flex items-center gap-2 px-1">
          <Sparkles className="h-4 w-4" style={{ color: "rgba(118,241,223,0.88)" }} />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(118,241,223,0.84)" }}>
            Adaptive Engagement Intelligence
          </p>
        </div>
        <div className="space-y-3">
          <DynamicTrajectoryBanner transition={intelligence.trajectoryTransition} />
          <PredictiveChainPanel chain={intelligence.predictiveChain} coachShadow={coachShadow} onApplyIntervention={onApplyIntervention} />
          <RealTimeHCPPostureCard posture={intelligence.hcpPosture} shift={intelligence.postureShift} />
          <PressureVisualizationPanel state={intelligence.pressureState} />
          <RealismEnginePanel profile={intelligence.realismProfile} adminMode={adminMode} />
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2">
          <Crosshair className="h-3.5 w-3.5" style={{ color: "rgba(118,241,223,0.78)" }} />
          <p className="text-[10px] leading-relaxed" style={{ color: "rgba(220,236,236,0.58)" }}>
            Unified event bus active: transcript, voice, posture, pressure, predictive chain, and realism updates are consolidated into qualitative rep-facing intelligence.
          </p>
        </div>
      </div>
    </div>
  );
}
