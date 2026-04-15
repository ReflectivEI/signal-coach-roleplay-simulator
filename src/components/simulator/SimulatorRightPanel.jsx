import { motion, AnimatePresence } from "framer-motion";
import { Eye, Zap, TrendingUp, TrendingDown, Minus, AlertTriangle, Activity, BookOpen } from "lucide-react";
import { JOURNEY_STATE_LABELS, BEHAVIOR_STATE_LABELS, PRESSURE_LABELS, SIGNAL_INTELLIGENCE_CAPABILITIES } from "@/lib/signalIntelligence";

// ── Section wrapper (dark) ────────────────────────────────────────────────────

function DarkSection({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl bg-[hsl(222_30%_12%)] border-2 border-primary/40 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-primary/25">
        {Icon && <Icon className="w-3.5 h-3.5 text-primary shrink-0" />}
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">{title}</span>
      </div>
      <div className="px-4 py-4 space-y-3">
        {children}
      </div>
    </div>);

}

// ── Section wrapper (light outlined) ───────────────────────────────────────────

function LightSection({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl bg-[hsl(210_30%_95%)] border-2 border-primary/35 overflow-hidden">
      <div className="bg-[hsl(var(--background))] px-4 py-3 flex items-center gap-2 border-b border-primary/25">
        {Icon && <Icon className="w-3.5 h-3.5 text-primary shrink-0" />}
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">{title}</span>
      </div>
      <div className="bg-[hsl(var(--secondary))] px-4 py-4 space-y-3">
        {children}
      </div>
    </div>);

}

// ── Row inside a section ──────────────────────────────────────────────────────

function Row({ label, children }) {
  return (
    <div className="bg-[hsl(var(--background))] flex items-center justify-between gap-2">
      <span className="bg-[hsl(var(--background))] text-[hsl(var(--primary))] text-xs font-medium uppercase tracking-wider shrink-0">{label}</span>
      <div className="flex items-center justify-end">{children}</div>
    </div>);

}

// ── Pill badge ────────────────────────────────────────────────────────────────

function Pill({ className, children }) {
  return (
    <span className="bg-primary/10 text-[hsl(var(--card-foreground))] px-2.5 py-1 text-xs font-semibold rounded-md border border-primary/20">
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

const volatilityPill = {
  stable: "text-signal-positive bg-signal-positive/15 border border-signal-positive/30",
  slightly_disrupted: "text-signal-watch bg-signal-watch/15 border border-signal-watch/30",
  disrupted: "text-destructive bg-destructive/15 border border-destructive/30"
};

const volatilityLabel = {
  stable: "Stable",
  slightly_disrupted: "Elevated",
  disrupted: "Disrupted"
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
  behavior_state: "bg-signal-watch/8 border-signal-watch/25 text-signal-watch/90",
  interaction_pressure: "bg-primary/8 border-primary/25 text-primary/90",
  journey_state: "bg-primary/8 border-primary/25 text-primary/90",
  conversation_shift: "bg-signal-positive/8 border-signal-positive/25 text-signal-positive/90"
};

// ── Main component ────────────────────────────────────────────────────────────

export default function SimulatorRightPanel({
  cues = [],
  journeyState,
  behaviorState,
  interactionPressures = [],
  hcpPrediction = null,
  volatilityState = null,
  lastSignals = {},
  focusCapabilities = [],
  lastNudge = null,
  realtimeFeedback = null
}) {
  const traj = hcpPrediction?.trajectory ? trajectoryConfig[hcpPrediction.trajectory] : null;
  const liveCoaching = lastNudge || (realtimeFeedback?.guidance ? {
    title: "Live coaching",
    capabilityName: "Live coaching",
    guidance: realtimeFeedback.guidance,
  } : null);

  return (
    <div className="space-y-4">

      {/* Live Coaching */}
      {liveCoaching &&
      <LightSection icon={Zap} title="Live Coaching">
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-primary/8 border border-primary/25">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-primary/80">
                {liveCoaching.capabilityName || liveCoaching.title || "Live coaching"}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-foreground/90">
                {liveCoaching.guidance}
              </p>
            </div>
            {realtimeFeedback?.timestamp &&
            <p className="text-[11px] text-muted-foreground/70">
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
            <span className="text-xs text-muted-foreground block mb-1.5">Pressures</span>
            <div className="flex flex-wrap gap-1">
              {interactionPressures.map((p) =>
            <span key={p} className="text-xs px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary">
                  {PRESSURE_LABELS[p] || p}
                </span>
            )}
            </div>
          </div>
        }
      </DarkSection>

      {/* Prediction */}
      {hcpPrediction &&
      <LightSection icon={AlertTriangle} title="Prediction">
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
            <span className={`text-xs font-medium capitalize ${riskColor[hcpPrediction.riskLevel] || "text-foreground"}`}>
              {hcpPrediction.riskLevel}
            </span>
          </Row>
          {hcpPrediction.nextLikelyBehavior &&
        <div className="mt-2 p-3 rounded-lg bg-surface/50 border border-border/30">
               <p className="text-xs text-muted-foreground/80 leading-relaxed">{hcpPrediction.nextLikelyBehavior}</p>
             </div>
        }
           </LightSection>
      }

           {/* Volatility */}
           {volatilityState &&
      <DarkSection icon={Activity} title="Volatility">
           <Row label="Profile">
            <Pill className={volatilityPill[volatilityState.profile] || "bg-accent border-border text-foreground"}>
              {volatilityLabel[volatilityState.profile] || volatilityState.profile}
            </Pill>
           </Row>
           {volatilityState.curveballActive && volatilityState.curveballType &&
        <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
               <p className="text-xs text-destructive/80 font-medium">
                 ⚡ {curveballLabels[volatilityState.curveballType] || volatilityState.curveballType}
               </p>
             </div>
        }
           {volatilityState.profile !== "stable" &&
        <div className="p-3 rounded-lg bg-surface/50 border border-border/30">
               <p className="text-xs text-muted-foreground/80 leading-relaxed">{volatilityState.trigger}</p>
             </div>
        }
           </DarkSection>
      }

        {/* Active Signals (cues) */}
        {cues.length > 0 &&
      <DarkSection icon={Zap} title="Active Signals">
          <AnimatePresence mode="popLayout">
            {cues.map((cue, i) =>
          <motion.div
            key={cue.id || i}
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.25, delay: i * 0.05 }}
            className={`p-2.5 rounded-lg border text-xs ${cueColors[cue.source] || "bg-accent border-border text-foreground"}`}>
            
                <div className="font-semibold mb-0.5">{cue.label}</div>
                <div className="opacity-80 leading-relaxed">{cue.description}</div>
              </motion.div>
          )}
          </AnimatePresence>
          </DarkSection>
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
                <span className="text-[hsl(var(--destructive-foreground))] text-xs font-medium">{cfg?.label || val}</span>
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
                   <div className="text-xs font-semibold text-primary/90">{cap.label}</div>
                   <div className="text-xs text-muted-foreground/80 mt-1 leading-relaxed">{cap.definition}</div>
                 </div>);

          })}
          </div>
          </DarkSection>
      }

          </div>);

}
