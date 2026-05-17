import { useMemo, useState } from "react";
import { AnimatePresence, motion, useSpring, useTransform } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Crosshair,
  Gauge,
  RadioTower,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { usePredictiveNextEventEngine } from "@/lib/predictiveNextEventEngine";

const complianceRules = [
  "Use approved labeling and messaging only.",
  "Do not make comparative superiority claims without approved head-to-head support.",
  "Route patient-specific safety or adverse-event questions to the appropriate medical resource.",
  "Do not guarantee access, coverage, outcomes, or formulary decisions.",
];

const approvedMessagingLibrary = [
  "Acknowledge the HCP concern before introducing product information.",
  "Use approved access support descriptions without promising payer outcomes.",
  "Frame clinical information around labeled evidence and appropriate patient fit.",
  "Use fair-balance language when safety or tolerability enters the conversation.",
];

const severityStyles = {
  low: {
    color: "rgba(170, 236, 206, 0.96)",
    background: "rgba(72, 187, 120, 0.12)",
    border: "rgba(72, 187, 120, 0.28)",
  },
  moderate: {
    color: "rgba(255, 232, 156, 0.98)",
    background: "rgba(231, 196, 83, 0.13)",
    border: "rgba(231, 196, 83, 0.30)",
  },
  high: {
    color: "rgba(255, 186, 136, 0.98)",
    background: "rgba(255, 139, 76, 0.14)",
    border: "rgba(255, 139, 76, 0.32)",
  },
  critical: {
    color: "rgba(255, 187, 201, 0.98)",
    background: "rgba(225, 72, 105, 0.16)",
    border: "rgba(225, 72, 105, 0.34)",
  },
};

const trajectoryStyles = {
  Stable: { color: "rgba(172, 236, 204, 0.98)", line: "rgba(72, 187, 120, 0.88)" },
  Recoverable: { color: "rgba(255, 232, 156, 0.98)", line: "rgba(231, 196, 83, 0.90)" },
  Escalating: { color: "rgba(255, 187, 201, 0.98)", line: "rgba(225, 72, 105, 0.92)" },
};

function formatEventType(type = "") {
  return String(type || "").replace(/_/g, " ");
}

function probabilityToPercent(value = 0) {
  return Math.round(Number(value || 0) * 100);
}

function AnimatedProbability({ value }) {
  const spring = useSpring(Number(value || 0), { stiffness: 110, damping: 18, mass: 0.6 });
  const display = useTransform(spring, (latest) => `${Math.round(latest * 100)}%`);
  spring.set(Number(value || 0));

  return <motion.span>{display}</motion.span>;
}

function deriveMetricScores(lastSignals = {}) {
  const mapThreeState = (value, strong, partial) => {
    if (value === strong) return 4.3;
    if (value === partial) return 3.1;
    if (!value) return 3;
    return 2.1;
  };

  return {
    listening_responsiveness: mapThreeState(lastSignals.listening_pattern, "responsive", "partially_responsive"),
    objection_navigation: lastSignals.objection_type && lastSignals.objection_type !== "none" ? 2.8 : 3.4,
    customer_engagement_signals: mapThreeState(lastSignals.engagement_level, "high", "moderate"),
    conversation_control_structure: mapThreeState(lastSignals.control_pattern, "balanced", "hcp_dominant"),
    commitment_gaining: mapThreeState(lastSignals.commitment_attempt, "clear", "weak"),
    question_quality: mapThreeState(lastSignals.question_type, "open_ended", "closed_ended"),
    adaptability: mapThreeState(lastSignals.response_alignment, "strong", "partial"),
    making_it_matter: mapThreeState(lastSignals.response_alignment, "strong", "partial"),
  };
}

function extractPreviousObjections(turns = [], hcpPrediction = null) {
  const objectionText = turns
    .filter((turn) => turn?.speaker === "hcp")
    .map((turn) => turn.text || "")
    .filter((text) => /\b(access|prior auth|workflow|staff|cost|safety|evidence|data|competitor|switch|formulary|guideline)\b/i.test(text))
    .slice(-5);

  if (hcpPrediction?.concernFamily) {
    objectionText.push(String(hcpPrediction.concernFamily).replace(/_/g, " "));
  }

  return objectionText;
}

function buildHistoricalOutcomes(turns = [], realtimeFeedback = null) {
  return turns
    .filter((turn) => turn?.speaker === "rep" || turn?.speaker === "hcp")
    .slice(-8)
    .map((turn, index) => ({
      turn: index + 1,
      speaker: turn.speaker,
      text: turn.text,
      feedback: realtimeFeedback?.repTurnId === turn.id ? realtimeFeedback.guidance : "",
    }));
}

function ImpactAxis({ label, impact }) {
  const delta = Number(impact?.delta || 0);
  const width = Math.min(100, Math.max(8, Math.abs(delta) * 9));
  const isPositive = delta > 1;
  const isNegative = delta < -1;
  const color = isPositive ? "rgba(99, 230, 190, 0.92)" : isNegative ? "rgba(255, 139, 167, 0.92)" : "rgba(157, 177, 195, 0.72)";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: "rgba(220,236,236,0.70)" }}>
          {label}
        </span>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>
          {delta > 0 ? "+" : ""}{delta}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  );
}

export default function PredictedNextEventPanel({
  turns = [],
  scenario = null,
  predictiveLens = null,
  hcpPrediction = null,
  lastSignals = {},
  latestVoiceAnalysis = null,
  voiceEvaluation = null,
  realtimeFeedback = null,
  onUseRecommendedResponse = null,
  onOpenReasoning = null,
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const liveTranscript = useMemo(() => turns.map((turn) => ({
    speaker: turn.speaker,
    text: turn.text,
    timestamp: turn.timestamp,
  })), [turns]);
  const currentMetricScores = useMemo(() => deriveMetricScores(lastSignals), [lastSignals]);
  const engineInput = useMemo(() => ({
    liveTranscript,
    hcpPersonaProfile: predictiveLens?.data?.lens || predictiveLens?.data || scenario?.hcpPersona || null,
    scenarioMode: [
      scenario?.journeyStage,
      scenario?.journeyState,
      scenario?.difficulty,
      scenario?.title,
      ...(scenario?.interactionPressure || []),
    ].filter(Boolean).join(" "),
    currentMetricScores,
    voiceAnalyticsSignals: voiceEvaluation?.voiceMetadata || latestVoiceAnalysis?.metadata || latestVoiceAnalysis || {},
    previousObjections: extractPreviousObjections(turns, hcpPrediction),
    complianceRules,
    approvedMessagingLibrary,
    historicalInteractionOutcomes: buildHistoricalOutcomes(turns, realtimeFeedback),
    hcpPrediction,
    majorTranscriptEventKey: `${turns.length}-${turns.at(-1)?.id || ""}-${realtimeFeedback?.timestamp || ""}`,
  }), [
    currentMetricScores,
    hcpPrediction,
    latestVoiceAnalysis,
    liveTranscript,
    predictiveLens,
    realtimeFeedback,
    scenario,
    turns,
    voiceEvaluation,
  ]);
  const { predictions, primaryPrediction } = usePredictiveNextEventEngine(engineInput);
  const primary = primaryPrediction;
  const severity = severityStyles[primary?.severity] || severityStyles.moderate;
  const trajectory = trajectoryStyles[primary?.trajectory] || trajectoryStyles.Recoverable;

  if (!primary) return null;

  return (
    <section
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(160deg, rgba(8,16,32,0.98) 0%, rgba(15,34,50,0.98) 48%, rgba(14,55,59,0.96) 100%)",
        border: "1px solid rgba(99, 230, 214, 0.24)",
        boxShadow: "0 22px 48px rgba(0,0,0,0.22)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(114,245,221,0.88), transparent)" }}
      />
      <div className="absolute -right-16 -top-20 h-44 w-44 rounded-full border border-cyan-200/10" />
      <div className="absolute right-6 top-8 h-20 w-20 rounded-full border border-cyan-200/10" />

      <div className="relative p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
              style={{
                background: "rgba(72, 187, 205, 0.14)",
                borderColor: "rgba(114, 245, 221, 0.30)",
                color: "rgba(138, 246, 229, 0.96)",
              }}
            >
              <RadioTower className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(138, 246, 229, 0.88)" }}>
                Predicted Next Event
              </p>
              <h3 className="mt-1 text-sm font-semibold leading-snug" style={{ color: "rgba(246,251,252,0.98)" }}>
                {primary.label}
              </h3>
            </div>
          </div>
          <div
            className="rounded-xl border px-2.5 py-1 text-right"
            style={{
              background: "rgba(255,255,255,0.07)",
              borderColor: "rgba(125, 173, 190, 0.22)",
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "rgba(220,236,236,0.62)" }}>
              Probability
            </p>
            <p className="text-2xl font-semibold tabular-nums leading-none" style={{ color: "rgba(246,251,252,0.98)" }}>
              <AnimatedProbability value={primary.probability} />
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.055] px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(220,236,236,0.64)" }}>
              <Clock3 className="h-3 w-3" />
              Horizon
            </div>
            <p className="mt-1 text-sm font-semibold tabular-nums" style={{ color: "rgba(246,251,252,0.95)" }}>
              {primary.timeHorizonSeconds}s
            </p>
          </div>
          <div className="rounded-xl border px-2.5 py-2" style={{ borderColor: severity.border, background: severity.background }}>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(220,236,236,0.68)" }}>
              <AlertTriangle className="h-3 w-3" />
              Severity
            </div>
            <p className="mt-1 text-sm font-semibold capitalize" style={{ color: severity.color }}>
              {primary.severity}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.055] px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(220,236,236,0.64)" }}>
              <Gauge className="h-3 w-3" />
              Trajectory
            </div>
            <p className="mt-1 text-sm font-semibold" style={{ color: trajectory.color }}>
              {primary.trajectory}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            {["Stable", "Recoverable", "Escalating"].map((label) => (
              <span
                key={label}
                className="text-[9px] font-semibold uppercase tracking-[0.11em]"
                style={{ color: primary.trajectory === label ? trajectory.color : "rgba(220,236,236,0.44)" }}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="relative h-1.5 rounded-full bg-white/10">
            <motion.div
              className="absolute top-0 h-full rounded-full"
              initial={false}
              animate={{
                left: primary.trajectory === "Stable" ? "0%" : primary.trajectory === "Recoverable" ? "33%" : "66%",
                width: primary.trajectory === "Stable" ? "33%" : primary.trajectory === "Recoverable" ? "34%" : "34%",
              }}
              transition={{ type: "spring", stiffness: 180, damping: 22 }}
              style={{ background: trajectory.line }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.055] p-3">
          <div className="flex items-center gap-2">
            <Crosshair className="h-3.5 w-3.5" style={{ color: "rgba(138, 246, 229, 0.88)" }} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(138, 246, 229, 0.88)" }}>
              Recommended Strategy
            </p>
          </div>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "rgba(238,247,248,0.92)" }}>
            {primary.recommendedStrategy}
          </p>
        </div>

        <div className="rounded-xl border p-3" style={{ background: "rgba(33, 91, 87, 0.18)", borderColor: "rgba(114, 245, 221, 0.22)" }}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: "rgba(138, 246, 229, 0.90)" }} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(138, 246, 229, 0.88)" }}>
              Safest Compliant Response
            </p>
          </div>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "rgba(238,247,248,0.94)" }}>
            {primary.safestResponse}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => onUseRecommendedResponse?.(primary.safestResponse)}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: "rgba(138, 246, 229, 0.14)",
                borderColor: "rgba(138, 246, 229, 0.30)",
                color: "rgba(220,255,250,0.98)",
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Use recommended response
            </button>
            <button
              type="button"
              onClick={() => onOpenReasoning?.({
                source: "predictive_next_event",
                event: primary,
                recommendation: primary.safestResponse || primary.recommendedStrategy,
                confidence: primary.probability,
                primaryReason: `Risk increased because ${primary.label.toLowerCase()}.`,
                metricScores: currentMetricScores,
              })}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: "rgba(255,255,255,0.055)",
                borderColor: "rgba(255,255,255,0.14)",
                color: "rgba(238,247,248,0.92)",
              }}
            >
              Why this recommendation?
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" style={{ color: "rgba(255, 232, 156, 0.92)" }} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(255, 232, 156, 0.88)" }}>
              Expected Impact
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ImpactAxis label="Trust" impact={primary.expectedImpact.trust} />
            <ImpactAxis label="Compliance" impact={primary.expectedImpact.compliance} />
            <ImpactAxis label="Objection Resolution" impact={primary.expectedImpact.objectionResolution} />
            <ImpactAxis label="Close Effectiveness" impact={primary.expectedImpact.closeEffectiveness} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setWhyOpen((current) => !current)}
            className="inline-flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-left text-[11px] font-semibold"
            style={{ color: "rgba(238,247,248,0.92)" }}
          >
            <span>Why this prediction?</span>
            {whyOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          <AnimatePresence initial={false}>
            {whyOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.045] p-3">
                  {primary.evidence.map((item) => (
                    <div key={`${item.source}-${item.signal}`} className="flex gap-2">
                      <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" style={{ color: "rgba(138, 246, 229, 0.78)" }} />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold" style={{ color: "rgba(246,251,252,0.94)" }}>
                          {item.signal}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: "rgba(220,236,236,0.70)" }}>
                          {item.detail} <span className="uppercase tracking-[0.12em] text-cyan-200/60">{item.source}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={() => setSecondaryOpen((current) => !current)}
            className="inline-flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-left text-[11px] font-semibold"
            style={{ color: "rgba(220,236,236,0.72)" }}
          >
            <span>Secondary event watchlist</span>
            {secondaryOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          <AnimatePresence initial={false}>
            {secondaryOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-2">
                  {predictions.slice(1, 4).map((event) => (
                    <div key={event.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold" style={{ color: "rgba(246,251,252,0.88)" }}>
                          {event.label}
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.13em]" style={{ color: "rgba(220,236,236,0.52)" }}>
                          {formatEventType(event.type)}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums" style={{ color: "rgba(138, 246, 229, 0.90)" }}>
                        {probabilityToPercent(event.probability)}%
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2 border-t border-white/10 pt-3">
          <BrainCircuit className="h-3.5 w-3.5" style={{ color: "rgba(138, 246, 229, 0.72)" }} />
          <p className="text-[10px] leading-relaxed" style={{ color: "rgba(220,236,236,0.58)" }}>
            Stream-ready architecture: local simulation now, `/api/predict-next-event`, SSE, or WebSocket transport when backend scoring is promoted.
          </p>
        </div>
      </div>
    </section>
  );
}
