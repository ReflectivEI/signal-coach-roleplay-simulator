import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { BEHAVIORAL_METRIC_KEYS, MANAGER_MODEL_THRESHOLDS, getBehavioralMetricLabel } from "./managerPerformanceData.js";

function getTone({ isStrongest, isWeakest, isBelowThreshold }) {
  if (isStrongest) {
    return "border-teal-200 bg-teal-50 text-teal-900";
  }

  if (isWeakest || isBelowThreshold) {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  return "border-slate-200 bg-white text-slate-900";
}

export function buildBehavioralProfileItems(metricSource) {
  return BEHAVIORAL_METRIC_KEYS.map((key) => {
    const metric = metricSource[key];
    return {
      key,
      label: getBehavioralMetricLabel(key),
      score: metric?.score ?? metric ?? 0,
      trend: typeof metric?.trend === "string" ? metric.trend : null,
      sessionsObserved: typeof metric?.sessionsObserved === "number" ? metric.sessionsObserved : null,
    };
  });
}

export function getBehavioralProfileExtremes(metricSource) {
  return BEHAVIORAL_METRIC_KEYS.reduce(
    (acc, key) => {
      const metric = metricSource[key];
      const score = metric?.score ?? metric ?? 0;

      if (score > acc.strongestScore) {
        acc.strongest = key;
        acc.strongestScore = score;
      }

      if (score < acc.weakestScore) {
        acc.weakest = key;
        acc.weakestScore = score;
      }

      return acc;
    },
    {
      strongest: BEHAVIORAL_METRIC_KEYS[0],
      strongestScore: Number.NEGATIVE_INFINITY,
      weakest: BEHAVIORAL_METRIC_KEYS[0],
      weakestScore: Number.POSITIVE_INFINITY,
    },
  );
}

export default function BehavioralProfileGrid({
  metricSource,
  strongestKey,
  weakestKey,
  title = "Behavioral Profile (8 Metrics)",
  subtitle = null,
  compact = false,
  showMeta = true,
}) {
  const items = buildBehavioralProfileItems(metricSource);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</p>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        <span className="inline-flex max-w-full self-start rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">Canonical order · 8 capabilities</span>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"}`}>
        {items.map((item) => {
          const isStrongest = item.key === strongestKey;
          const isWeakest = item.key === weakestKey;
          const isBelowThreshold = item.score < MANAGER_MODEL_THRESHOLDS.repMetricLow;

          return (
            <div key={item.key} className={`min-w-0 overflow-hidden rounded-xl border px-3 py-3 ${getTone({ isStrongest, isWeakest, isBelowThreshold })}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-xs font-semibold leading-5">{item.label}</p>
                {isStrongest ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-teal-700" /> : null}
                {!isStrongest && isWeakest ? <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-700" /> : null}
              </div>
              <p className="mt-2 text-lg font-bold">{item.score}/5</p>
              {showMeta ? (
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  {item.trend ? `Trend ${item.trend}` : "Territory aggregate"}{item.sessionsObserved !== null ? ` · Observed ${item.sessionsObserved}` : ""}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2 overflow-hidden">
                {isStrongest ? <span className="inline-flex max-w-full rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-teal-700">Strongest</span> : null}
                {isWeakest ? <span className="inline-flex max-w-full rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-amber-700">Weakest</span> : null}
                {!isWeakest && !isStrongest && isBelowThreshold ? <span className="inline-flex max-w-full rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-amber-700">Below 3.5/5 threshold</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
