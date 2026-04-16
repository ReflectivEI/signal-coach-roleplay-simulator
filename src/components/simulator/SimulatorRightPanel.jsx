import { motion } from "framer-motion";
import { Eye, Zap, TrendingUp, TrendingDown, Minus, AlertTriangle, Activity, BookOpen, MapPin, Lightbulb } from "lucide-react";
import { JOURNEY_STATE_LABELS, BEHAVIOR_STATE_LABELS, PRESSURE_LABELS, SIGNAL_INTELLIGENCE_CAPABILITIES } from "@/lib/signalIntelligence";

// ── Section wrapper (dark) ────────────────────────────────────────────────────

function DarkSection({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(180deg, rgba(18,28,49,0.94) 0%, rgba(20,39,53,0.94) 100%)", border: "1px solid rgba(83, 148, 155, 0.24)" }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "rgba(83, 148, 155, 0.16)" }}>
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "hsl(174 60% 68%)" }} />}
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "hsl(174 60% 68%)" }}>{title}</span>
      </div>
      <div className="px-4 py-4 space-y-3">
        {children}
      </div>
    </div>);

}

// ── Section wrapper (light outlined) ───────────────────────────────────────────

function LightSection({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(180deg, rgba(18,28,49,0.94) 0%, rgba(20,39,53,0.94) 100%)", border: "1px solid rgba(83, 148, 155, 0.24)" }}>
      <div className="px-4 py-3 flex items-center gap-2 border-b" style={{ borderColor: "rgba(83, 148, 155, 0.16)" }}>
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "hsl(174 60% 68%)" }} />}
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "hsl(174 60% 68%)" }}>{title}</span>
      </div>
      <div className="px-4 py-4 space-y-3" style={{ background: "transparent" }}>
        {children}
      </div>
    </div>);

}

// ── Row inside a section ──────────────────────────────────────────────────────

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium uppercase tracking-wider shrink-0" style={{ color: "rgba(236, 245, 245, 0.82)" }}>{label}</span>
      <div className="flex items-center justify-end">{children}</div>
    </div>);

}

// ── Pill badge ────────────────────────────────────────────────────────────────

function Pill({ className, children }) {
  return (
    <span className="px-2.5 py-1 text-xs font-semibold rounded-md border" style={{ background: "rgba(255,255,255,0.10)", color: "rgba(244,249,249,0.96)", borderColor: "rgba(125, 173, 190, 0.24)" }}>
      {children}
    </span>);

}

// ── State color maps ──────────────────────────────────────────────────────────

const behaviorPill = {
  time_pressure: "text-signal-watch bg-signal-watch/15 border border-signal-watch/30",
  frustration: "text-destructive bg-destructive/15 border border-destructive/30",
  curiosity: "text-signal-positive bg-signal-positive/15 border border-signal-positive/30",
  resistance: "text-destructive bg-destructive/15 border border-destructive/30",
  openness: "text-signal-positive bg-signal-positive/15 border border-signal-positive/30",
  neutral: "text-primary bg-primary/15 border border-primary/30",
  closed: "text-destructive bg-destructive/15 border border-destructive/30",
  open: "text-signal-positive bg-signal-positive/15 border border-signal-positive/30"
};

const opennessPill = {
  closed: "text-destructive bg-destructive/15 border border-destructive/30",
  neutral: "text-signal-watch bg-signal-watch/15 border border-signal-watch/30",
  open: "text-signal-positive bg-signal-positive/15 border border-signal-positive/30"
};

const trajectoryConfig = {
  improving: { Icon: TrendingUp, color: "text-signal-positive", label: "Improving" },
  stalled: { Icon: Minus, color: "text-signal-watch", label: "Stalled" },
  declining: { Icon: TrendingDown, color: "text-destructive", label: "Declining" }
};

const riskColor = {
  low: "text-signal-positive",
  moderate: "text-signal-watch",
  high: "text-destructive"
};

const curveballLabels = {
  unexpected_objection: "New objection surfacing",
  priority_shift: "Priority shift active",
  skepticism_spike: "Skepticism spike"
};

const cueColors = {
  behavior_state: { background: "rgba(143,80,92,0.10)", borderColor: "rgba(143,80,92,0.28)", color: "white" },
  interaction_pressure: { background: "rgba(25,92,122,0.12)", borderColor: "rgba(25,92,122,0.28)", color: "white" },
  journey_state: { background: "rgba(37,124,123,0.12)", borderColor: "rgba(37,124,123,0.28)", color: "white" },
  conversation_shift: { background: "rgba(37,124,123,0.12)", borderColor: "rgba(37,124,123,0.28)", color: "white" }
};

// ── Main component ────────────────────────────────────────────────────────────

export default function SimulatorRightPanel({
  cues = [],
  journeyState,
  behaviorState,
  interactionPressures = [],
  hcpPrediction = null,
  lastSignals = {},
  focusCapabilities = [],
  lastNudge = null,
  realtimeFeedback = null,
  scenario = null,
  conversationInit = null,
  hasRepSpoken = false,
}) {
  const traj = hcpPrediction?.trajectory ? trajectoryConfig[hcpPrediction.trajectory] : null;
  const liveCoaching = lastNudge || (realtimeFeedback?.guidance ? {
    title: "Live coaching",
    capabilityName: "Live coaching",
    guidance: realtimeFeedback.guidance,
  } : null);
  const sceneDescription = scenario?.visualScene || scenario?.description || "";
  const openingGuidance = !hasRepSpoken ? (conversationInit?.openingGuidance || []) : [];

  return (
    <div className="space-y-4">

      {scenario && sceneDescription && (
        <DarkSection icon={MapPin} title="Scene">
          <p className="text-xs leading-relaxed" style={{ color: "rgba(244,249,249,0.92)" }}>
            {sceneDescription}
          </p>
          {openingGuidance.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-3.5 h-3.5 shrink-0" style={{ color: "hsl(174 60% 68%)" }} />
                <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "hsl(174 60% 68%)" }}>
                  Opening Tips
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {openingGuidance.map((hint, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2 py-0.5 rounded-md"
                    style={{
                      background: "rgba(37,124,123,0.12)",
                      border: "1px solid rgba(37,124,123,0.24)",
                      color: "rgba(244,249,249,0.96)",
                    }}
                  >
                    {hint}
                  </span>
                ))}
              </div>
            </div>
          )}
        </DarkSection>
      )}

      {/* Live Coaching */}
      {liveCoaching &&
      <LightSection icon={Zap} title="Live Coaching">
          <div className="space-y-3">
            <div className="p-3 rounded-lg" style={{ background: "rgba(37,124,123,0.12)", border: "1px solid rgba(37,124,123,0.24)" }}>
              <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "rgba(244,249,249,0.96)" }}>
                {liveCoaching.capabilityName || liveCoaching.title || "Live coaching"}
              </p>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: "rgba(236,245,245,0.90)" }}>
                {liveCoaching.guidance}
              </p>
            </div>
            {realtimeFeedback?.timestamp &&
            <p className="text-[11px]" style={{ color: "rgba(220, 236, 236, 0.64)" }}>
                Updated {new Date(realtimeFeedback.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            }
          </div>
        </LightSection>
      }

      {/* HCP State */}
       <DarkSection icon={Eye} title="HCP State">
        <Row label="Journey">
          <Pill className="bg-primary/10 border-primary/20 text-primary">
            {JOURNEY_STATE_LABELS[journeyState] || journeyState}
          </Pill>
        </Row>
        <Row label="Behavior">
          <Pill className={behaviorPill[behaviorState] || "bg-accent border-border text-foreground"}>
            {BEHAVIOR_STATE_LABELS[behaviorState] || behaviorState}
          </Pill>
        </Row>
        {interactionPressures.length > 0 &&
        <div className="pt-1">
            <span className="text-xs block mb-1.5" style={{ color: "rgba(236, 245, 245, 0.82)" }}>Pressures</span>
            <div className="flex flex-wrap gap-1">
              {interactionPressures.map((p) =>
            <span key={p} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(37, 124, 123, 0.12)", border: "1px solid rgba(37, 124, 123, 0.24)", color: "rgba(244,249,249,0.96)" }}>
                  {PRESSURE_LABELS[p] || p}
                </span>
            )}
            </div>
          </div>
        }
      </DarkSection>

      {/* Predictive Layer */}
      {hcpPrediction &&
      <LightSection icon={AlertTriangle} title="Predictive Layer">
          <Row label="Openness">
            <Pill className={opennessPill[hcpPrediction.openness] || "bg-accent border-border text-foreground capitalize"}>
              {hcpPrediction.openness}
            </Pill>
          </Row>
          {traj &&
        <Row label="Trajectory">
              <div className={`flex items-center gap-1 text-xs font-medium ${traj.color}`}>
                <traj.Icon className="w-3 h-3" />
                <span>{traj.label}</span>
              </div>
            </Row>
        }
          <Row label="Risk">
            <span className={`text-xs font-medium capitalize ${riskColor[hcpPrediction.riskLevel] || ""}`} style={{ color: hcpPrediction.riskLevel === "high" ? "rgba(255,207,214,0.94)" : hcpPrediction.riskLevel === "moderate" ? "rgba(255,233,176,0.94)" : "rgba(199,244,214,0.94)" }}>
              {hcpPrediction.riskLevel}
            </span>
          </Row>
          {hcpPrediction.nextLikelyBehavior &&
        <div className="mt-2 p-3 rounded-lg" style={{ background: "rgba(37,124,123,0.10)", border: "1px solid rgba(37,124,123,0.20)" }}>
               <p className="text-xs leading-relaxed" style={{ color: "rgba(236,245,245,0.90)" }}>{hcpPrediction.nextLikelyBehavior}</p>
             </div>
        }
           </LightSection>
      }

          {/* Observable Signals */}
          {lastSignals && Object.keys(lastSignals).length > 0 &&
      <DarkSection icon={Activity} title="Observable Signals">
          {[
        { key: "question_type", label: "Question Form", values: { open_ended: { label: "Open-ended", color: "text-signal-positive" }, closed_ended: { label: "Closed-ended", color: "text-muted-foreground" }, leading: { label: "Leading", color: "text-signal-watch" }, none: { label: "None used", color: "text-muted-foreground/60" } } },
        { key: "response_alignment", label: "Response to HCP", values: { strong: { label: "Directly addressed", color: "text-signal-positive" }, partial: { label: "Partially addressed", color: "text-signal-watch" }, weak: { label: "Did not address", color: "text-destructive" } } },
        { key: "listening_pattern", label: "Listening", values: { responsive: { label: "Built on HCP input", color: "text-signal-positive" }, partially_responsive: { label: "Partially built on", color: "text-signal-watch" }, missed: { label: "Did not connect", color: "text-destructive" } } },
        { key: "engagement_level", label: "HCP Participation", values: { low: { label: "Disengaged", color: "text-destructive" }, moderate: { label: "Present", color: "text-signal-watch" }, high: { label: "Active", color: "text-signal-positive" } } },
        { key: "commitment_attempt", label: "Next Step", values: { none: { label: "No next step", color: "text-muted-foreground/60" }, weak: { label: "Unclear ask", color: "text-signal-watch" }, clear: { label: "Specific ask made", color: "text-signal-positive" } } }].
        map(({ key, label, values }) => {
          const val = lastSignals[key];
          if (!val) return null;
          const cfg = values[val];
          return (
            <Row key={key} label={label}>
                <span className="text-xs font-medium" style={{ color: "rgba(244,249,249,0.96)" }}>{cfg?.label || val}</span>
              </Row>);

        })}
          </DarkSection>
      }

          {/* Focus Capabilities */}
          {focusCapabilities.length > 0 &&
      <DarkSection icon={BookOpen} title="Focus Capabilities">
          <div className="space-y-1.5">
            {focusCapabilities.map((capId) => {
            const cap = SIGNAL_INTELLIGENCE_CAPABILITIES.find((c) => c.id === capId);
            if (!cap) return null;
            return (
              <div key={capId} className="p-3 rounded-lg bg-primary/8 border border-primary/25">
                   <div className="text-xs font-semibold" style={{ color: "rgba(244,249,249,0.96)" }}>{cap.label}</div>
                   <div className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(236, 245, 245, 0.86)" }}>{cap.definition}</div>
                 </div>);

          })}
          </div>
          </DarkSection>
      }

          </div>);

}
