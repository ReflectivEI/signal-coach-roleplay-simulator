import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  GitBranch,
  ListChecks,
  Scale,
  ShieldCheck,
  X,
} from "lucide-react";
import { logReasoningAuditEvent } from "@/lib/recommendationReasoning";

const sourceColors = {
  transcript: "rgba(118,241,223,0.92)",
  voice: "rgba(160,202,255,0.94)",
  metric: "rgba(255,225,139,0.94)",
  prediction: "rgba(190,170,255,0.94)",
  compliance: "rgba(127,225,178,0.94)",
  scenario: "rgba(255,180,135,0.94)",
  coaching: "rgba(255,132,160,0.94)",
  audit: "rgba(220,236,236,0.82)",
};

export function EvidenceChip({ signal }) {
  const color = sourceColors[signal?.source] || sourceColors.audit;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-semibold" style={{ color: "rgba(247,252,252,0.96)" }}>
          {signal.label}
        </p>
        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.13em]" style={{ color }}>
          {signal.source}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "rgba(220,236,236,0.68)" }}>
        {signal.detail}
      </p>
    </div>
  );
}

export function AuditTrail({ entries = [] }) {
  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div key={entry.id} className="flex gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2">
          <div className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: "rgba(118,241,223,0.86)" }} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold capitalize" style={{ color: "rgba(247,252,252,0.94)" }}>
                {entry.action.replace(/_/g, " ")}
              </p>
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(220,236,236,0.50)" }}>
                {entry.actor}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "rgba(220,236,236,0.66)" }}>
              {entry.detail}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RejectedAlternatives({ alternatives = [] }) {
  return (
    <div className="space-y-2">
      {alternatives.map((item) => (
        <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
          <p className="text-[11px] font-semibold" style={{ color: "rgba(247,252,252,0.94)" }}>
            {item.alternative}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "rgba(255,210,170,0.82)" }}>
            {item.rejectedBecause}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.12em]" style={{ color: "rgba(127,225,178,0.76)" }}>
            {item.riskReduced}
          </p>
        </div>
      ))}
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: "rgba(118,241,223,0.88)" }} />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "rgba(220,236,236,0.76)" }}>
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

function ConfidenceRing({ value = 0 }) {
  const percent = Math.round(Number(value || 0) * 100);
  const circumference = 2 * Math.PI * 28;
  const offset = circumference * (1 - Number(value || 0));

  return (
    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
      <svg className="absolute inset-0" viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
        <motion.circle
          cx="36"
          cy="36"
          r="28"
          fill="none"
          stroke="rgba(118,241,223,0.94)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          transform="rotate(-90 36 36)"
        />
      </svg>
      <span className="text-lg font-semibold tabular-nums" style={{ color: "rgba(247,252,252,0.98)" }}>
        {percent}%
      </span>
    </div>
  );
}

export default function ReasoningDrawer({ open, card, onClose }) {
  useEffect(() => {
    if (open && card) logReasoningAuditEvent(card, "reasoning_drawer_opened");
  }, [open, card]);

  return (
    <AnimatePresence>
      {open && card && (
        <div className="fixed inset-0 z-[80]">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto"
            style={{
              background: "linear-gradient(160deg, rgba(7,13,28,0.99) 0%, rgba(13,31,47,0.99) 48%, rgba(16,45,55,0.99) 100%)",
              borderLeft: "1px solid rgba(118,241,223,0.22)",
              boxShadow: "-28px 0 60px rgba(0,0,0,0.34)",
            }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 230, damping: 28 }}
          >
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#091426]/95 px-5 py-4 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(118,241,223,0.86)" }}>
                    Why this recommendation?
                  </p>
                  <h2 className="mt-1 text-lg font-semibold leading-tight" style={{ color: "rgba(247,252,252,0.98)" }}>
                    Reasoning transparency record
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]"
                  style={{ color: "rgba(220,236,236,0.80)" }}
                  aria-label="Close reasoning drawer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <div className="flex items-start gap-4">
                  <ConfidenceRing value={card.confidence} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "rgba(220,236,236,0.58)" }}>
                      Recommendation summary
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-relaxed" style={{ color: "rgba(247,252,252,0.96)" }}>
                      {card.recommendation}
                    </p>
                    <p className="mt-3 text-xs leading-relaxed" style={{ color: "rgba(220,236,236,0.72)" }}>
                      {card.primaryReason}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-white/[0.055] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(118,241,223,0.82)" }}>
                        {card.modelVersion}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.055] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(220,236,236,0.62)" }}>
                        {new Date(card.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <Section icon={ListChecks} title="Top Evidence Signals">
                <div className="grid grid-cols-1 gap-2">
                  {card.evidenceSignals.slice(0, 3).map((signal) => <EvidenceChip key={signal.id} signal={signal} />)}
                </div>
              </Section>

              <Section icon={FileText} title="Transcript Excerpts">
                <div className="space-y-2">
                  {card.transcriptEvidence.length ? card.transcriptEvidence.map((item, index) => (
                    <blockquote key={`${item.turnId || index}-${item.speaker}`} className="rounded-xl border border-white/10 bg-black/15 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: "rgba(118,241,223,0.78)" }}>
                        {item.speaker}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed" style={{ color: "rgba(247,252,252,0.92)" }}>
                        "{item.excerpt}"
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "rgba(220,236,236,0.58)" }}>
                        {item.rationale}
                      </p>
                    </blockquote>
                  )) : (
                    <p className="text-xs" style={{ color: "rgba(220,236,236,0.62)" }}>Transcript evidence will appear after live turns are available.</p>
                  )}
                </div>
              </Section>

              <Section icon={AlertTriangle} title="Voice Behavior Signals">
                <div className="grid grid-cols-2 gap-2">
                  {card.voiceEvidence.length ? card.voiceEvidence.map((item) => (
                    <div key={item.signal} className="rounded-xl border border-white/10 bg-black/15 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(220,236,236,0.54)" }}>
                        {item.signal}
                      </p>
                      <p className="mt-1 text-sm font-semibold" style={{ color: "rgba(247,252,252,0.94)" }}>{item.value}</p>
                      <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "rgba(220,236,236,0.62)" }}>{item.interpretation}</p>
                    </div>
                  )) : (
                    <p className="col-span-2 text-xs" style={{ color: "rgba(220,236,236,0.62)" }}>No voice-specific signal was required for this recommendation.</p>
                  )}
                </div>
              </Section>

              <Section icon={GitBranch} title="Impact on the 8 Metrics">
                <div className="space-y-2">
                  {card.metricEvidence.map((metric) => (
                    <div key={`${metric.metricId}-${metric.impact}`} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold" style={{ color: "rgba(247,252,252,0.94)" }}>{metric.metricLabel}</p>
                        <span className="text-[11px] font-semibold tabular-nums" style={{ color: metric.impact < 0 ? "rgba(255,132,160,0.94)" : "rgba(127,225,178,0.94)" }}>
                          {metric.impact > 0 ? "+" : ""}{metric.impact}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "rgba(220,236,236,0.62)" }}>{metric.explanation}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section icon={Scale} title="Compliance Basis">
                <div className="space-y-2">
                  {card.complianceBasis.map((item) => (
                    <div key={item.ruleId} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5" style={{ color: "rgba(127,225,178,0.88)" }} />
                        <p className="text-[11px] font-semibold" style={{ color: "rgba(247,252,252,0.94)" }}>{item.rule}</p>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "rgba(220,236,236,0.62)" }}>{item.basis}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section icon={X} title="Rejected Alternatives">
                <RejectedAlternatives alternatives={card.rejectedAlternatives} />
              </Section>

              <Section icon={CheckCircle2} title="Audit Trail">
                <AuditTrail entries={card.auditTrail} />
              </Section>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
