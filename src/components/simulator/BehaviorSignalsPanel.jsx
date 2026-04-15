import { Activity } from "lucide-react";

// All labels describe observable behavior — not evaluations
const signalConfig = {
  question_type: {
    label: "Question Form",
    values: {
      open_ended: { label: "Open-ended", color: "text-signal-positive" },
      closed_ended: { label: "Closed-ended", color: "text-signal-neutral" },
      leading: { label: "Leading", color: "text-signal-watch" },
      none: { label: "No question used", color: "text-muted-foreground" }
    }
  },
  response_alignment: {
    label: "Response to HCP",
    values: {
      strong: { label: "Directly addressed", color: "text-signal-positive" },
      partial: { label: "Partially addressed", color: "text-signal-watch" },
      weak: { label: "Did not address", color: "text-destructive" }
    }
  },
  listening_pattern: {
    label: "Listening Observable",
    values: {
      responsive: { label: "Built on HCP input", color: "text-signal-positive" },
      partially_responsive: { label: "Partially built on", color: "text-signal-watch" },
      missed: { label: "Did not connect", color: "text-destructive" }
    }
  },
  engagement_level: {
    label: "HCP Participation",
    values: {
      low: { label: "Disengaged", color: "text-destructive" },
      moderate: { label: "Present", color: "text-signal-watch" },
      high: { label: "Active", color: "text-signal-positive" }
    }
  },
  control_pattern: {
    label: "Conversation Pattern",
    values: {
      balanced: { label: "Balanced exchange", color: "text-signal-positive" },
      rep_dominant: { label: "Rep-led", color: "text-signal-watch" },
      hcp_dominant: { label: "HCP-led", color: "text-signal-neutral" }
    }
  },
  commitment_attempt: {
    label: "Next Step Attempt",
    values: {
      none: { label: "No next step", color: "text-muted-foreground" },
      weak: { label: "Unclear ask", color: "text-signal-watch" },
      clear: { label: "Specific ask made", color: "text-signal-positive" }
    }
  }
};

export default function BehaviorSignalsPanel({ signals }) {
  if (!signals || Object.keys(signals).length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Activity className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Observable Signals</span>
      </div>
      <div className="space-y-1.5">
        {Object.entries(signalConfig).map(([key, config]) => {
          const value = signals[key];
          if (!value) return null;
          const valueConfig = config.values[value];
          return (
            <div key={key} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
              <span className="text-xs text-muted-foreground">{config.label}</span>
              <span className={`text-xs font-medium ${valueConfig?.color || "text-foreground"}`}>
                {valueConfig?.label || value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}