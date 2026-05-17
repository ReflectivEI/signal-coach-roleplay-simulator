export function signalStateFromFivePoint(score) {
  const value = Number(score || 0);
  if (!value) return { label: "Not observed", band: "none", tone: "slate", benchmark: "No practice evidence yet" };
  if (value >= 4.4) return { label: "Advanced", band: "strong", tone: "emerald", benchmark: "Consistent, transferable behavior" };
  if (value >= 3.6) return { label: "On track", band: "ready", tone: "teal", benchmark: "Reliable in most practice conditions" };
  if (value >= 2.8) return { label: "Developing", band: "watch", tone: "amber", benchmark: "Functional with pressure gaps" };
  if (value >= 2) return { label: "Needs focus", band: "risk", tone: "orange", benchmark: "Requires targeted remediation" };
  return { label: "Unstable", band: "critical", tone: "rose", benchmark: "Not yet reliable under pressure" };
}

export function formatDevelopmentBenchmark(score) {
  const value = Number(score || 0);
  return value ? `${value}/5 development benchmark` : "No benchmark yet";
}

export function signalStateClasses(tone = "slate") {
  const classes = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    teal: "border-teal-200 bg-teal-50 text-teal-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
  };
  return classes[tone] || classes.slate;
}

export function scoringAnchorState(score) {
  const value = String(score);
  if (value === "5") return { label: "Advanced signal control", tone: "emerald" };
  if (value === "3") return { label: "Developing signal control", tone: "amber" };
  return { label: "Unstable signal control", tone: "rose" };
}
