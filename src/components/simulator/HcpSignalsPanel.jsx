import { motion, AnimatePresence } from "framer-motion";
import { Eye, Zap, TrendingUp, TrendingDown, Minus, AlertTriangle, Activity } from "lucide-react";
import { JOURNEY_STATE_LABELS, BEHAVIOR_STATE_LABELS, PRESSURE_LABELS } from "@/lib/signalIntelligence";

const sourceColors = {
  behavior_state: "bg-signal-watch/10 border-signal-watch/30 text-signal-watch",
  interaction_pressure: "bg-destructive/10 border-destructive/30 text-destructive",
  journey_state: "bg-primary/10 border-primary/30 text-primary",
  conversation_shift: "bg-signal-positive/10 border-signal-positive/30 text-signal-positive"
};

const behaviorStateStyles = {
  time_pressure: "text-signal-watch bg-signal-watch/10 border-signal-watch/20",
  frustration:   "text-destructive bg-destructive/10 border-destructive/20",
  curiosity:     "text-signal-positive bg-signal-positive/10 border-signal-positive/20",
  resistance:    "text-destructive bg-destructive/10 border-destructive/20",
  openness:      "text-signal-positive bg-signal-positive/10 border-signal-positive/20"
};

const opennessStyles = {
  closed:  "text-destructive bg-destructive/10 border-destructive/20",
  neutral: "text-signal-watch bg-signal-watch/10 border-signal-watch/20",
  open:    "text-signal-positive bg-signal-positive/10 border-signal-positive/20"
};

const riskStyles = {
  low:      "text-signal-positive",
  moderate: "text-signal-watch",
  high:     "text-destructive"
};

const trajectoryConfig = {
  improving: { Icon: TrendingUp,   color: "text-signal-positive", label: "Improving" },
  stalled:   { Icon: Minus,        color: "text-signal-watch",    label: "Stalled" },
  declining: { Icon: TrendingDown, color: "text-destructive",     label: "Declining" }
};

const volatilityConfig = {
  stable:             { label: "Stable",      color: "text-signal-positive bg-signal-positive/10 border-signal-positive/20" },
  slightly_disrupted: { label: "Elevated",    color: "text-signal-watch bg-signal-watch/10 border-signal-watch/20" },
  disrupted:          { label: "Disrupted",   color: "text-destructive bg-destructive/10 border-destructive/20" },
};

const curveballLabels = {
  unexpected_objection: "New objection surfacing",
  priority_shift:       "Priority shift active",
  skepticism_spike:     "Skepticism spike",
};

export default function HcpSignalsPanel({
  cues,
  journeyState,
  behaviorState,
  interactionPressures = [],
  hcpPrediction = null,
  volatilityState = null
}) {
  const traj = hcpPrediction?.trajectory ? trajectoryConfig[hcpPrediction.trajectory] : null;

  return (
    <div className="space-y-4">
      {/* State indicators */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 mb-2">
          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">HCP State</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Journey</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary">
              {JOURNEY_STATE_LABELS[journeyState] || journeyState}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Behavior</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${behaviorStateStyles[behaviorState] || "bg-accent border-border text-foreground"}`}>
              {BEHAVIOR_STATE_LABELS[behaviorState] || behaviorState}
            </span>
          </div>
          {interactionPressures.length > 0 && (
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-muted-foreground shrink-0">Pressures</span>
              <div className="flex flex-wrap gap-1 justify-end">
                {interactionPressures.map(p => (
                  <span key={p} className="text-xs px-1.5 py-0.5 rounded bg-destructive/10 border border-destructive/20 text-destructive">
                    {PRESSURE_LABELS[p] || p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Predictive layer */}
      {hcpPrediction && (
        <div className="border-t border-border/40 pt-3 space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prediction</span>
          </div>

          {/* Openness */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Openness</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-md border capitalize ${opennessStyles[hcpPrediction.openness] || "bg-accent border-border text-foreground"}`}>
              {hcpPrediction.openness}
            </span>
          </div>

          {/* Trajectory */}
          {traj && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Trajectory</span>
              <div className={`flex items-center gap-1 text-xs font-medium ${traj.color}`}>
                <traj.Icon className="w-3 h-3" />
                <span>{traj.label}</span>
              </div>
            </div>
          )}

          {/* Risk level */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Risk</span>
            <span className={`text-xs font-medium capitalize ${riskStyles[hcpPrediction.riskLevel] || "text-foreground"}`}>
              {hcpPrediction.riskLevel}
            </span>
          </div>

          {/* Next likely behavior */}
          <div className="mt-2 p-2.5 rounded-lg bg-surface border border-border/50">
            <p className="text-xs text-muted-foreground leading-relaxed">{hcpPrediction.nextLikelyBehavior}</p>
          </div>
        </div>
      )}

      {/* Volatility layer */}
      {volatilityState && (
        <div className="border-t border-border/40 pt-3 space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Volatility</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Behavior</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-md border capitalize ${volatilityConfig[volatilityState.profile]?.color || "bg-accent border-border text-foreground"}`}>
              {volatilityConfig[volatilityState.profile]?.label || volatilityState.profile}
            </span>
          </div>

          {volatilityState.curveballActive && volatilityState.curveballType && (
            <div className="mt-1 px-2.5 py-1.5 rounded-lg bg-destructive/8 border border-destructive/25">
              <p className="text-xs text-destructive font-medium">
                ⚡ {curveballLabels[volatilityState.curveballType] || volatilityState.curveballType}
              </p>
            </div>
          )}

          {volatilityState.profile !== "stable" && (
            <div className="mt-1 p-2.5 rounded-lg bg-surface border border-border/50">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {volatilityState.trigger}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Active cues */}
      {cues && cues.length > 0 && (
        <div className="border-t border-border/40 pt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Signals</span>
          </div>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {cues.map((cue, i) => (
                <motion.div
                  key={cue.id || i}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.25, delay: i * 0.05 }}
                  className={`p-2.5 rounded-lg border text-xs ${sourceColors[cue.source] || "bg-accent border-border text-foreground"}`}
                >
                  <div className="font-medium mb-0.5">{cue.label}</div>
                  <div className="opacity-80 leading-relaxed">{cue.description}</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}