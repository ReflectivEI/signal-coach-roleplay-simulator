import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, ChevronDown, ChevronUp, RefreshCw, MessageSquare, FileText, Target, AlertTriangle } from "lucide-react";
import { SIGNAL_INTELLIGENCE_CAPABILITIES } from "@/lib/signalIntelligence";

// ─── Capability color map (matches screenshots) ───────────────────────────────
const CAP_COLORS = {
  question_quality:               { text: "text-teal-400",   bg: "bg-teal-400/10",   border: "border-teal-400/30" },
  listening_responsiveness:       { text: "text-blue-400",   bg: "bg-blue-400/10",   border: "border-blue-400/30" },
  making_it_matter:               { text: "text-violet-400", bg: "bg-violet-400/10", border: "border-violet-400/30" },
  customer_engagement_signals:    { text: "text-cyan-400",   bg: "bg-cyan-400/10",   border: "border-cyan-400/30" },
  objection_navigation:           { text: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/30" },
  conversation_control_structure: { text: "text-indigo-400", bg: "bg-indigo-400/10", border: "border-indigo-400/30" },
  adaptability:                   { text: "text-rose-400",   bg: "bg-rose-400/10",   border: "border-rose-400/30" },
  commitment_gaining:             { text: "text-emerald-400",bg: "bg-emerald-400/10",border: "border-emerald-400/30" },
};

const CAP_SUBLABELS = {
  question_quality: "Ground the exchange in what the HCP actually raised.",
  listening_responsiveness: "Show that the rep heard the real issue, not just the topic.",
  making_it_matter: "Connect the point to the HCP's real-world decision threshold.",
  customer_engagement_signals: "Track whether the HCP is leaning in, narrowing, or pulling back.",
};

const LEVEL_TO_SCORE = {
  effective: 5,
  developing: 3,
  missed: 1,
};

function splitParagraphs(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value)
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildSpecificStrengthParagraph(insight) {
  if (!insight) return "";
  const evidence = insight.transcriptEvidence ? `"${insight.transcriptEvidence}"` : "";
  const behavior = insight.whatHappened || insight.whatGoodLooksLike || "";
  const impact = insight.whyItMattered || "";
  if (!behavior && !impact && !evidence) return "";
  return [behavior, evidence ? `For example: ${evidence}.` : "", impact]
    .filter(Boolean)
    .join(" ");
}

function buildSpecificDevelopmentParagraph(insight) {
  if (!insight) return "";
  const evidence = insight.transcriptEvidence ? `"${insight.transcriptEvidence}"` : "";
  const behavior = insight.whatHappened || "";
  const impact = insight.whyItMattered || "";
  const action = insight.nextTimeAction || insight.whatGoodLooksLike || "";
  if (!behavior && !impact && !action && !evidence) return "";
  return [behavior, evidence ? `For example: ${evidence}.` : "", impact, action]
    .filter(Boolean)
    .join(" ");
}

function buildActionItemParagraph(insight) {
  if (!insight?.nextTimeAction) return "";
  const rewrite = insight.exampleRewrite ? ` Example phrasing: "${insight.exampleRewrite}".` : "";
  return `${insight.nextTimeAction}${rewrite}`;
}

function NotObservedMarker() {
  return (
    <p
      className="text-sm font-semibold italic"
      style={{ color: "hsl(222 52% 24%)" }}
    >
      Not Observed (N/O)
    </p>
  );
}

// ─── Context cards (top info bar) ────────────────────────────────────────────

/**
 * @param {{
 *   icon: any;
 *   title: string;
 *   alwaysExpanded?: boolean;
 *   children: any;
 *   tip?: string;
 * }} props
 */
function ContextCard({ icon: Icon, title, alwaysExpanded = false, children, tip = "" }) {
  const [open, setOpen] = useState(!!alwaysExpanded);
  return (
    <div
      className="rounded-xl overflow-hidden flex-1 min-w-0"
      style={{
        background: "linear-gradient(180deg, rgba(20,31,56,0.98) 0%, rgba(20,46,62,0.98) 100%)",
        border: "1px solid rgba(98, 165, 170, 0.26)",
      }}
    >
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        onClick={() => !alwaysExpanded && setOpen(o => !o)}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "hsl(174 60% 68%)" }} />
        <span className="text-xs font-semibold uppercase tracking-widest flex-1" style={{ color: "rgba(173, 240, 231, 0.90)" }}>{title}</span>
        {!alwaysExpanded && (
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] mr-1" style={{ color: "rgba(121, 214, 202, 0.78)" }}>Tap Header to Expand</span>
        )}
        {!alwaysExpanded && (
          open
            ? <ChevronUp className="w-3 h-3" style={{ color: "rgba(222, 235, 237, 0.72)" }} />
            : <ChevronDown className="w-3 h-3" style={{ color: "rgba(222, 235, 237, 0.72)" }} />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2 border-t" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
              {children}
              {tip && (
                <p className="text-xs flex items-start gap-1.5 mt-2">
                  <span className="font-bold shrink-0" style={{ color: "rgba(255, 221, 118, 0.96)" }}>💡 Tip:</span>
                  <span style={{ color: "rgba(255, 235, 169, 0.88)" }}>{tip}</span>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!open && tip && (
        <div className="px-4 pb-3 border-t pt-2" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
          <p className="text-xs flex items-start gap-1">
            <span className="font-bold shrink-0" style={{ color: "rgba(255, 221, 118, 0.96)" }}>💡 Tip:</span>
            <span style={{ color: "rgba(255, 235, 169, 0.88)" }}>{tip}</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Overall summary blocks ───────────────────────────────────────────────────

function OverallBlock({ label, children }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <div className="text-sm text-foreground/80 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

// ─── Deep-dive sub-block ──────────────────────────────────────────────────────

function DeepDiveBlock({ number, title, children }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <span className="text-muted-foreground/40 font-mono mr-1">{number})</span>{title}
      </p>
      {children}
    </div>
  );
}

// ─── Capability row ───────────────────────────────────────────────────────────

function CapabilityRow({ cap, insight }) {
  const [open, setOpen] = useState(false);
  const colors = CAP_COLORS[cap.id] || { text: "text-primary", bg: "bg-primary/10", border: "border-primary/20" };
  const sublabel = CAP_SUBLABELS[cap.id];
  const score = LEVEL_TO_SCORE[insight?.observationLevel] || 0;
  const hasStructuredContent = Boolean(
    insight?.whatHappened ||
    insight?.transcriptEvidence ||
    insight?.whyItMattered ||
    insight?.pattern ||
    insight?.whatGoodLooksLike ||
    insight?.exampleRewrite ||
    insight?.nextTimeAction
  );

  return (
    <div className="border-b border-border/30 last:border-0">
      <button
        className="w-full flex items-center gap-3 py-3.5 px-4 text-left transition-colors"
        style={{ background: open ? "rgba(37,124,123,0.06)" : "transparent" }}
        onClick={() => setOpen(o => !o)}
      >
        {/* Colored capability name pill */}
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${colors.text} ${colors.bg} border ${colors.border} shrink-0`}>
          {cap.label}
        </span>

        <span className="text-xs font-medium text-muted-foreground shrink-0">
          Score {score}/5
        </span>

        {/* Sublabel (Signal Awareness only) */}
        {sublabel && !open && (
          <span className="text-xs text-muted-foreground flex-1">{sublabel}</span>
        )}
        {!sublabel && <span className="flex-1" />}

        {/* Analyze button */}
        <span className={`text-xs font-semibold px-3 py-1 rounded-md border shrink-0 ${colors.text} ${colors.bg} ${colors.border} transition-opacity`}>
          Analyze
        </span>

        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-1" />
          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-1" />
        }
      </button>

      <AnimatePresence>
        {open && insight && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="pb-5 px-4 space-y-4 border-t pt-4" style={{ borderColor: "rgba(152, 160, 171, 0.24)", background: "linear-gradient(180deg, rgba(250,252,253,0.98) 0%, rgba(244,248,250,0.98) 100%)" }}>

              {insight.whatHappened && (
                <DeepDiveBlock number="1" title="What Happened (Observed Behavior)">
                  <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">{insight.whatHappened}</p>
                  {insight.transcriptEvidence && (
                    <div className="mt-2 p-3 rounded-lg bg-surface border-l-2 border-primary/40">
                      <p className="text-xs text-muted-foreground font-mono leading-relaxed italic">"{insight.transcriptEvidence}"</p>
                    </div>
                  )}
                </DeepDiveBlock>
              )}

              {insight.whyItMattered && (
                <DeepDiveBlock number="2" title="Why It Mattered (HCP Reaction)">
                  <p className="text-sm text-foreground/85 leading-relaxed">{insight.whyItMattered}</p>
                </DeepDiveBlock>
              )}

              {insight.pattern && (
                <DeepDiveBlock number="3" title="Pattern (If Repeated)">
                  <p className="text-sm text-foreground/85 leading-relaxed">{insight.pattern}</p>
                </DeepDiveBlock>
              )}

              {insight.whatGoodLooksLike && (
                <DeepDiveBlock number="4" title="What Good Would Have Looked Like">
                  <p className="text-sm text-foreground/85 leading-relaxed">{insight.whatGoodLooksLike}</p>
                  {insight.exampleRewrite && (
                    <div className="mt-2 p-3 rounded-lg bg-signal-positive/5 border border-signal-positive/20">
                      <p className="text-xs text-signal-positive font-medium mb-1">Example phrasing:</p>
                      <p className="text-xs text-foreground/80 italic">"{insight.exampleRewrite}"</p>
                    </div>
                  )}
                </DeepDiveBlock>
              )}

              {insight.nextTimeAction && (
                <DeepDiveBlock number="5" title="What to Do Next Time">
                  <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">{insight.nextTimeAction}</p>
                </DeepDiveBlock>
              )}

              {!hasStructuredContent && <NotObservedMarker />}

              {insight.relatedTurnIds?.length > 0 && (
                <div className="pt-2 border-t border-border/30">
                  <p className="text-xs text-muted-foreground/60 font-mono">
                    Transcript anchors: {insight.relatedTurnIds.join(", ")}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
        {open && !insight && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pb-4 px-4 pt-3 border-t" style={{ borderColor: "rgba(152, 160, 171, 0.24)", background: "linear-gradient(180deg, rgba(250,252,253,0.98) 0%, rgba(244,248,250,0.98) 100%)" }}>
              <NotObservedMarker />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Modal ────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   review: any;
 *   scenario: any;
 *   sessionTurnCount: number;
 *   onClose: () => void;
 *   onExport: () => void;
 *   onNewSession: () => void;
 *   onRegenerate?: () => void;
 * }} props
 */
export default function SessionSummaryModal({
  review,
  scenario,
  sessionTurnCount,
  onClose,
  onExport,
  onNewSession,
  onRegenerate = () => {}
}) {
  if (!review) return null;

  // Build insight lookup, preserving the full forensic capability insight as the source of truth.
  // Legacy guidance objects can fill gaps, but should never overwrite the richer review object.
  const insightByCapability = {};
  for (const insight of (review.capabilityInsights || [])) {
    if (insight?.capabilityId) {
      insightByCapability[insight.capabilityId] = insight;
    }
  }

  const legacyInsights = [
    ...(review.strengths || []),
    ...(review.improvementAreas || []),
    ...(review.missedOpportunities || []),
  ];

  for (const legacy of legacyInsights) {
    if (!legacy?.capabilityId) continue;
    const existing = insightByCapability[legacy.capabilityId] || {};
    insightByCapability[legacy.capabilityId] = {
      ...legacy,
      ...existing,
      capabilityId: existing.capabilityId || legacy.capabilityId,
      capabilityName: existing.capabilityName || legacy.capabilityName,
      observationLevel: existing.observationLevel || legacy.observationLevel,
      title: existing.title || legacy.title,
      guidance: existing.guidance || legacy.guidance,
      relatedTurnIds: existing.relatedTurnIds?.length ? existing.relatedTurnIds : legacy.relatedTurnIds,
      exampleRewrite: existing.exampleRewrite || legacy.exampleRewrite,
    };
  }

  const briefRationale = review.briefRationale || review.overallSummary?.[0] || "";
  const insights = SIGNAL_INTELLIGENCE_CAPABILITIES
    .map((cap) => insightByCapability[cap.id])
    .filter(Boolean);
  const effectiveInsights = insights.filter((insight) => insight.observationLevel === "effective");
  const growthInsights = insights.filter((insight) => insight.observationLevel !== "effective");
  const overallScore = (
    SIGNAL_INTELLIGENCE_CAPABILITIES.reduce((sum, cap) => {
      const level = insightByCapability[cap.id]?.observationLevel;
      return sum + (LEVEL_TO_SCORE[level] || 0);
    }, 0) / SIGNAL_INTELLIGENCE_CAPABILITIES.length
  ).toFixed(1);

  const didWellParagraphs = effectiveInsights
    .map(buildSpecificStrengthParagraph)
    .filter(Boolean)
    .slice(0, 3);
  const didWellFallback = splitParagraphs(review.didWell || review.strengthsProse);

  const biggestGapParagraphs = growthInsights
    .map(buildSpecificDevelopmentParagraph)
    .filter(Boolean)
    .slice(0, 3);
  const biggestGapFallback = splitParagraphs(review.biggestGap || review.developProse);

  const signalAlignmentParagraphs = splitParagraphs(review.signalResponseAlignment);
  const fallbackSignalAlignment = growthInsights
    .map((insight) => {
      if (!insight.transcriptEvidence || !insight.whyItMattered) return "";
      return `The HCP signal "${insight.transcriptEvidence}" mattered because ${insight.whyItMattered}`;
    })
    .filter(Boolean)
    .slice(0, 3);

  const actionItemParagraphs = growthInsights
    .map(buildActionItemParagraph)
    .filter(Boolean)
    .slice(0, 3);
  const actionItemFallback = splitParagraphs(review.nextAdjustment || review.actionPlanProse);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative w-full max-w-5xl rounded-2xl border shadow-2xl flex flex-col overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,248,250,0.98) 100%)",
          borderColor: "rgba(152, 160, 171, 0.40)",
        }}
      >
        {/* ── Top bar ── */}
        <div
          className="px-6 py-5 border-b flex items-center justify-between shrink-0"
          style={{
            background: "linear-gradient(92deg, hsl(224 50% 15%) 0%, hsl(214 54% 21%) 42%, hsl(186 44% 20%) 100%)",
            borderColor: "rgba(89, 125, 175, 0.24)",
          }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "rgba(173, 240, 231, 0.88)" }}>
                End & Get Feedback
              </p>
              <h2 className="text-lg font-semibold" style={{ color: "rgba(255,255,255,0.98)" }}>
                {scenario?.title || "Session Feedback"}
              </h2>
            </div>
            {scenario?.journeyStage && (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded border capitalize"
                style={{
                  borderColor: "rgba(255, 196, 122, 0.48)",
                  background: "rgba(255, 196, 122, 0.12)",
                  color: "rgba(255, 225, 181, 0.96)",
                }}
              >
                {scenario.journeyStage.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  borderColor: "rgba(255,255,255,0.18)",
                  color: "rgba(255,255,255,0.90)",
                }}
              >
                <RefreshCw className="w-3 h-3" />
                Regenerate
              </button>
            )}
            <button
              onClick={onClose}
              className="transition-colors ml-1"
              style={{ color: "rgba(255,255,255,0.78)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto">

          {/* ── Context Cards Row ── */}
          {scenario && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border-b" style={{ borderColor: "rgba(152, 160, 171, 0.24)", background: "linear-gradient(90deg, hsl(224 50% 15%) 0%, hsl(214 54% 21%) 36%, hsl(186 44% 20%) 100%)" }}>
              <div className="border-r" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                <ContextCard icon={Target} title="HCP Profile" alwaysExpanded>
                  <p className="text-xs leading-relaxed mt-2" style={{ color: "rgba(244,249,249,0.94)" }}>{scenario.stakeholder}</p>
                  {scenario.context && (
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(220,236,236,0.72)" }}>{scenario.context}</p>
                  )}
                </ContextCard>
              </div>
              <div className="border-r" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                <ContextCard
                  icon={FileText}
                  title="Rep Objectives"
                  tip={scenario.keyChallenges?.[0] ? `Acknowledge ${scenario.keyChallenges[0].toLowerCase().slice(0, 40)}…` : undefined}
                >
                  <p className="text-xs leading-relaxed mt-2" style={{ color: "rgba(244,249,249,0.94)" }}>{scenario.objective}</p>
                  {scenario.coreTension && (
                    <p className="text-xs leading-relaxed italic mt-1" style={{ color: "rgba(220,236,236,0.72)" }}>{scenario.coreTension}</p>
                  )}
                </ContextCard>
              </div>
              <div className="border-r" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                <ContextCard
                  icon={MessageSquare}
                  title="Opening Scene"
                  tip="Preview the HCP's setting and opening beat before starting."
                >
                  <p className="text-xs leading-relaxed italic mt-2" style={{ color: "rgba(244,249,249,0.94)" }}>"{scenario.openingScene}"</p>
                </ContextCard>
              </div>
              <div>
                <ContextCard
                  icon={AlertTriangle}
                  title="Key Challenges"
                  tip={scenario.keyChallenges?.length ? "Use a follow-up to pivot back to the gap." : undefined}
                >
                  <div className="mt-2 space-y-1">
                    {(scenario.keyChallenges || []).map((c, i) => (
                      <p key={i} className="text-xs leading-relaxed flex gap-1.5" style={{ color: "rgba(244,249,249,0.94)" }}>
                        <span className="shrink-0" style={{ color: "rgba(121, 214, 202, 0.78)" }}>·</span>{c}
                      </p>
                    ))}
                  </div>
                </ContextCard>
              </div>
            </div>
          )}

          <div className="px-6 py-5 space-y-0">
            {onRegenerate && (
              <div className="mb-4">
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.94)",
                    borderColor: "rgba(152, 160, 171, 0.30)",
                    color: "hsl(215 28% 26%)",
                  }}
                >
                  <RefreshCw className="w-3 h-3" />
                  Regenerate Sections 2-5
                </button>
              </div>
            )}

            {/* ── Section 1: overall + 8 metrics ── */}
            <div className="rounded-xl overflow-hidden mb-0" style={{ border: "1px solid rgba(152, 160, 171, 0.30)", background: "rgba(255,255,255,0.72)" }}>
              <div
                className="w-full flex items-center justify-between px-5 py-4 text-left"
                style={{ background: "linear-gradient(180deg, rgba(248,251,252,0.98) 0%, rgba(240,246,247,0.98) 100%)" }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm" style={{ color: "hsl(177 49% 36%)" }}>⬥</span>
                    <span className="text-sm font-semibold text-foreground">Overall: {overallScore}/5</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "hsl(215 18% 46%)" }}>
                    Capability feedback analysis by behavioral metric — click any metric below to analyze.
                  </p>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-md border shrink-0 text-slate-600 bg-white/70 border-slate-200">
                  Analyze
                </span>
              </div>

              <div className="px-5 py-5 border-t" style={{ borderColor: "rgba(152, 160, 171, 0.24)", background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,250,251,0.98) 100%)" }}>
                <OverallBlock label="1) Brief Rationale">
                  <p>{briefRationale || <span className="text-muted-foreground italic">Generating…</span>}</p>
                </OverallBlock>
              </div>

              {/* ── Capability rows — always visible below the overall header ── */}
              <div className="divide-y border-t" style={{ borderColor: "rgba(152, 160, 171, 0.22)" }}>
                {SIGNAL_INTELLIGENCE_CAPABILITIES.map(cap => (
                  <CapabilityRow
                    key={cap.id}
                    cap={cap}
                    insight={insightByCapability[cap.id]}
                  />
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-6 rounded-xl border px-5 py-5" style={{ borderColor: "rgba(152, 160, 171, 0.24)", background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,250,251,0.98) 100%)" }}>
              <OverallBlock label="2) Capabilities Done Well">
                {(didWellParagraphs.length > 0 ? didWellParagraphs : didWellFallback).length > 0
                  ? (didWellParagraphs.length > 0 ? didWellParagraphs : didWellFallback).map((p, i) => <p key={i}>{p}</p>)
                  : <NotObservedMarker />}
              </OverallBlock>

              <OverallBlock label="3) Capabilities to Develop">
                {(biggestGapParagraphs.length > 0 ? biggestGapParagraphs : biggestGapFallback).length > 0
                  ? (biggestGapParagraphs.length > 0 ? biggestGapParagraphs : biggestGapFallback).map((p, i) => <p key={i}>{p}</p>)
                  : <NotObservedMarker />}
              </OverallBlock>

              <OverallBlock label="4) Signal–Response Alignment">
                {(signalAlignmentParagraphs.length > 0 ? signalAlignmentParagraphs : fallbackSignalAlignment).length > 0
                  ? (signalAlignmentParagraphs.length > 0 ? signalAlignmentParagraphs : fallbackSignalAlignment).map((p, i) => <p key={i}>{p}</p>)
                  : <NotObservedMarker />}
              </OverallBlock>

              <OverallBlock label="5) Specific Action Items">
                {(actionItemParagraphs.length > 0 ? actionItemParagraphs : actionItemFallback).length > 0
                  ? (actionItemParagraphs.length > 0 ? actionItemParagraphs : actionItemFallback).map((p, i) => <p key={i}>{p}</p>)
                  : <NotObservedMarker />}
              </OverallBlock>

              {review.overallGuidance?.[0] && (
                <p className="text-xs leading-relaxed pt-3 border-t" style={{ color: "hsl(215 14% 58%)", borderColor: "rgba(152, 160, 171, 0.18)" }}>
                  {review.overallGuidance[0]}
                </p>
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex items-center justify-between gap-3 shrink-0"
          style={{
            borderColor: "rgba(152, 160, 171, 0.24)",
            background: "linear-gradient(180deg, rgba(248,251,252,0.98) 0%, rgba(240,246,247,0.98) 100%)",
          }}
        >
          <button
            onClick={onExport}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export Feedback PDF
          </button>
          <button
            onClick={onNewSession}
            className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/80 transition-colors"
          >
            New Session
          </button>
        </div>
      </motion.div>
    </div>
  );
}
