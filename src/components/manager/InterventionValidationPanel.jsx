// @ts-nocheck
import React, { useMemo, useState } from "react";
import { Activity, ArrowRight, Clock3, FlaskConical, LineChart, Loader2, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBehavioralMetricLabel } from "@/components/manager/managerPerformanceData";
import { buildValidationInsight, getCapabilityLabelFromCanonicalId, VALIDATION_STATUS_LABELS } from "@/components/manager/managerValidationLogic";

const STATUS_TONE = {
  pending: "border-slate-200 bg-slate-50 text-slate-700",
  insufficient_data: "border-amber-200 bg-amber-50 text-amber-800",
  validated_positive: "border-teal-200 bg-teal-50 text-teal-800",
  validated_neutral: "border-sky-200 bg-sky-50 text-sky-800",
  validated_negative: "border-rose-200 bg-rose-50 text-rose-800",
};

function formatUtcDate(iso) {
  if (!iso) return "Not captured";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function MetricDelta({ label, baseline, current, unit = "", emphasizePositive = true }) {
  const safeBaseline = Number.isFinite(Number(baseline)) ? Number(baseline) : null;
  const safeCurrent = Number.isFinite(Number(current)) ? Number(current) : null;
  const delta = safeBaseline !== null && safeCurrent !== null ? safeCurrent - safeBaseline : null;
  const tone = delta === null
    ? "text-slate-500"
    : emphasizePositive
      ? delta > 0 ? "text-teal-700" : delta < 0 ? "text-rose-700" : "text-slate-700"
      : delta < 0 ? "text-teal-700" : delta > 0 ? "text-rose-700" : "text-slate-700";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span>{safeBaseline ?? "—"}{unit}</span>
        <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
        <span>{safeCurrent ?? "—"}{unit}</span>
      </div>
      <p className={`mt-1 text-xs font-semibold ${tone}`}>
        {delta === null ? "Awaiting comparison data" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}${unit} vs baseline`}
      </p>
    </div>
  );
}

function ValidationRecordCard({ record, rep, onCaptureFollowUp, followUpBusy, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const latestSnapshot = record.followUpSnapshots?.[record.followUpSnapshots.length - 1] || null;
  const targetCapabilityLabel = getCapabilityLabelFromCanonicalId(record.targetCapability);
  const baselineCapabilityScore = record.baselineSnapshot?.behavioralMetrics?.[record.targetCapability];
  const latestCapabilityScore = latestSnapshot?.behavioralMetrics?.[record.targetCapability];
  const insightText = buildValidationInsight(record);

  return (
    <div className="rounded-2xl border border-teal-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[11px] font-semibold text-teal-700">{record.recommendationType.replaceAll("_", " ")}</span>
            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${STATUS_TONE[record.validationStatus] || STATUS_TONE.pending}`}>
              {VALIDATION_STATUS_LABELS[record.validationStatus] || VALIDATION_STATUS_LABELS.pending}
            </span>
          </div>
          <h4 className="mt-3 text-base font-bold text-slate-900">{record.recommendationTitle}</h4>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{record.recommendationSummary}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-700">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">Target capability: {targetCapabilityLabel}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">Baseline captured: {formatUtcDate(record.createdAt)}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">Observation window: {record.expectedMovement?.observationWindowDays || "—"} days</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button
            type="button"
            size="sm"
            className="rounded-full bg-teal-600 text-white hover:bg-teal-700"
            onClick={() => onCaptureFollowUp(record)}
            disabled={followUpBusy}
          >
            {followUpBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            Capture Follow-up Snapshot
          </Button>
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Hide validation details" : "View validation details"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Evidence summary</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{record.validationSummary}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Target capability movement</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{baselineCapabilityScore ?? "—"} → {latestCapabilityScore ?? "Pending"}</p>
          <p className="mt-1 text-xs text-slate-700">Expected change ≥ {record.expectedMovement?.targetCapabilityDelta ?? 0.2} points</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Follow-up snapshots</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{record.followUpSnapshots?.length || 0}</p>
          <p className="mt-1 text-xs text-slate-700">Latest: {formatUtcDate(latestSnapshot?.capturedAt)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Manager insight context</p>
          <p className="mt-2 text-sm text-slate-700">{insightText}</p>
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-4 rounded-2xl border border-teal-100 bg-teal-50/40 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Intervention Validation</p>
            <h5 className="mt-1 text-sm font-bold text-slate-900">Tracked recommendation</h5>
            <p className="mt-1 text-sm text-slate-700">{record.recommendationTitle} for {rep.name} focused on {targetCapabilityLabel}.</p>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Baseline snapshot</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <MetricDelta label={targetCapabilityLabel} baseline={baselineCapabilityScore} current={latestCapabilityScore} unit="/5" />
                <MetricDelta label="Learning Engagement" baseline={record.baselineSnapshot?.learningEngagementScore} current={latestSnapshot?.learningEngagementScore} />
                <MetricDelta label="Sales Risk" baseline={record.baselineSnapshot?.salesRisk} current={latestSnapshot?.salesRisk} emphasizePositive={false} />
                <MetricDelta label="Conversion Proxy" baseline={record.baselineSnapshot?.conversionProxy} current={latestSnapshot?.conversionProxy} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Measured movement</p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p><span className="font-semibold text-slate-900">Target capability:</span> {targetCapabilityLabel} moved from {baselineCapabilityScore ?? "—"} to {latestCapabilityScore ?? "pending"}.</p>
                <p><span className="font-semibold text-slate-900">Learning engagement:</span> {record.baselineSnapshot?.learningEngagementScore ?? "—"} to {latestSnapshot?.learningEngagementScore ?? "pending"}.</p>
                <p><span className="font-semibold text-slate-900">Sales risk:</span> {record.baselineSnapshot?.salesRisk ?? "—"} to {latestSnapshot?.salesRisk ?? "pending"}.</p>
                <p><span className="font-semibold text-slate-900">Modules completed:</span> {record.baselineSnapshot?.modulesCompleted ?? 0} to {latestSnapshot?.modulesCompleted ?? "pending"}.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Validation outcome</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{VALIDATION_STATUS_LABELS[record.validationStatus] || VALIDATION_STATUS_LABELS.pending}</p>
              <p className="mt-1 text-sm text-slate-700">{record.validationSummary}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Evidence summary</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                <li>Capability delta: {record.evidence?.capabilityDelta ?? 0}</li>
                <li>Engagement delta: {record.evidence?.engagementDelta ?? 0}</li>
                <li>Sales risk delta: {record.evidence?.salesRiskDelta ?? 0}</li>
                <li>Conversion proxy delta: {record.evidence?.conversionProxyDelta ?? 0}</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Next observation guidance</p>
              <p className="mt-2 text-sm text-slate-700">{record.nextObservationGuidance}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function InterventionValidationPanel({
  rep,
  derived,
  validationRecords,
  validationLoading,
  validationError,
  startBusy,
  followUpRecordId,
  onStartValidation,
  onCaptureFollowUp,
}) {
  const latestRecord = useMemo(() => validationRecords?.[0] || null, [validationRecords]);
  const targetCapability = getBehavioralMetricLabel(rep?.improvementPriority);
  const currentRisk = derived?.salesRiskScore;
  const currentEngagement = derived?.engagementScore;

  return (
    <section className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-teal-700">
            <FlaskConical className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Coaching outcome tracking</p>
          </div>
          <h3 className="mt-2 text-lg font-bold text-slate-900">Validation Loop</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">Track whether the current manager intervention for {rep.name} creates measurable movement in the targeted canonical capability and supporting signals.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-700">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">Current target: {targetCapability}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">Sales Risk: {Number.isFinite(currentRisk) ? `${currentRisk}/100` : "Insufficient data"}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">Learning Engagement: {Number.isFinite(currentEngagement) ? `${currentEngagement}/100` : "Insufficient data"}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="rounded-full bg-teal-600 text-white hover:bg-teal-700" onClick={onStartValidation} disabled={startBusy}>
            {startBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}
            Start Validation
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">Active tracked intervention(s)</p>
          <p className="mt-2 text-2xl font-bold text-teal-900">{validationRecords?.length || 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Validation status</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{latestRecord ? VALIDATION_STATUS_LABELS[latestRecord.validationStatus] : "No tracked intervention"}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Baseline captured</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{latestRecord ? formatUtcDate(latestRecord.createdAt) : "Not started"}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Observation window</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{latestRecord?.expectedMovement?.observationWindowDays || "—"} days</p>
        </div>
      </div>

      {validationLoading ? (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading validation records…
        </div>
      ) : validationError ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Validation data is unavailable right now. Manager View is still usable and existing rep metrics remain unchanged.
        </div>
      ) : validationRecords?.length ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-2 text-slate-600"><LineChart className="h-4 w-4" /><p className="text-[11px] font-semibold uppercase tracking-wide">Baseline vs current</p></div>
                <p className="mt-2 text-sm text-slate-700">{buildValidationInsight(latestRecord)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-2 text-slate-600"><Activity className="h-4 w-4" /><p className="text-[11px] font-semibold uppercase tracking-wide">Evidence summary</p></div>
                <p className="mt-2 text-sm text-slate-700">Capability Δ {latestRecord?.evidence?.capabilityDelta ?? 0}, engagement Δ {latestRecord?.evidence?.engagementDelta ?? 0}, sales risk Δ {latestRecord?.evidence?.salesRiskDelta ?? 0}.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-2 text-slate-600"><Clock3 className="h-4 w-4" /><p className="text-[11px] font-semibold uppercase tracking-wide">Observation guidance</p></div>
                <p className="mt-2 text-sm text-slate-700">{latestRecord?.nextObservationGuidance}</p>
              </div>
            </div>
          </div>

          {validationRecords.map((record, index) => (
            <ValidationRecordCard
              key={record.id}
              record={record}
              rep={rep}
              defaultExpanded={index === 0}
              followUpBusy={followUpRecordId === record.id}
              onCaptureFollowUp={onCaptureFollowUp}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-teal-200 bg-teal-50/50 px-5 py-6 text-sm text-slate-700">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-teal-700" />
            <div>
              <p className="font-semibold text-slate-900">No tracked intervention yet</p>
              <p className="mt-1 leading-relaxed">Start validation to capture the current baseline snapshot for {rep.name}. The system will store the current 8 canonical capability scores, learning engagement, risk, outcome proxy, and observation depth without changing any existing coaching workflow.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
