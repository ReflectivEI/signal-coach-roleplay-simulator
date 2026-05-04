import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, ChevronDown, ChevronUp, RefreshCw, MessageSquare, FileText, Target, AlertTriangle, CheckCircle2, AlertCircle, XCircle, Maximize2, Minimize2 } from "lucide-react";
import { SIGNAL_INTELLIGENCE_CAPABILITIES } from "@/lib/signalIntelligence";

const metricColorTokens = {
  success: {
    bg: "bg-[hsl(165_57%_96%)]",
    border: "border-[hsl(165_42%_76%)]",
    text: "text-[hsl(163_59%_24%)]",
  },
  warning: {
    bg: "bg-[hsl(40_100%_96%)]",
    border: "border-[hsl(39_74%_78%)]",
    text: "text-[hsl(32_80%_31%)]",
  },
  danger: {
    bg: "bg-[hsl(0_86%_96%)]",
    border: "border-[hsl(0_72%_83%)]",
    text: "text-[hsl(356_62%_36%)]",
  },
  neutral: {
    bg: "bg-[hsl(214_33%_96%)]",
    border: "border-[hsl(213_27%_83%)]",
    text: "text-[hsl(216_34%_33%)]",
  },
};

const sectionSurface = {
  outcome: { border: "rgba(64, 112, 150, 0.34)", bg: "linear-gradient(180deg, rgba(247,251,255,0.98) 0%, rgba(241,247,252,0.98) 100%)" },
  well: { border: "rgba(47, 132, 128, 0.34)", bg: "linear-gradient(180deg, rgba(246,252,251,0.98) 0%, rgba(239,248,247,0.98) 100%)" },
  limits: { border: "rgba(152, 95, 74, 0.34)", bg: "linear-gradient(180deg, rgba(253,249,246,0.98) 0%, rgba(248,242,238,0.98) 100%)" },
  testing: { border: "rgba(99, 111, 150, 0.34)", bg: "linear-gradient(180deg, rgba(248,249,254,0.98) 0%, rgba(241,243,251,0.98) 100%)" },
  improve: { border: "rgba(138, 93, 125, 0.34)", bg: "linear-gradient(180deg, rgba(252,248,252,0.98) 0%, rgba(246,240,247,0.98) 100%)" },
  rewrite: { border: "rgba(56, 123, 110, 0.34)", bg: "linear-gradient(180deg, rgba(246,252,249,0.98) 0%, rgba(240,248,244,0.98) 100%)" },
};

function getMetricColor(score) {
  if (score >= 4) return metricColorTokens.success;
  if (score === 3) return metricColorTokens.warning;
  if (score <= 2) return metricColorTokens.danger;
  return metricColorTokens.neutral;
}

function getMetricSignal(score) {
  if (score >= 4) return { Icon: CheckCircle2, tone: "text-emerald-500" };
  if (score === 3) return { Icon: AlertCircle, tone: "text-amber-500" };
  if (score <= 2) return { Icon: XCircle, tone: "text-red-500" };
  return { Icon: AlertCircle, tone: "text-slate-500" };
}

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

const REVIEW_TEXT = "hsl(222 44% 17%)";
const REVIEW_MUTED = "hsl(215 18% 39%)";
const REVIEW_FAINT = "hsl(215 14% 52%)";
const REVIEW_PANEL = "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,250,251,0.98) 100%)";

function splitParagraphs(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => cleanCoachingCopy(String(item || "").trim())).filter(Boolean);
  }
  return String(value)
    .split(/\n\s*\n/)
    .map((item) => cleanCoachingCopy(item.trim()))
    .filter(Boolean);
}

function stripSystemReferences(text = "") {
  if (!text) return "";

  return String(text)
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "")
    .replace(/\bturn\s*\[[^\]]+\]/gi, "early in the conversation")
    .replace(/\bas seen in turn[^.,;:!?]*/gi, "early in the conversation")
    .replace(/\bas evidenced by\b/gi, "for example")
    .replace(/\bobserved behavior\b/gi, "what you did")
    .replace(/\bpattern\s*\(if repeated\)\b/gi, "if this continues")
    .replace(/\bpattern if repeated\b/gi, "if this continues")
    .replace(/\bthe rep demonstrated\b/gi, "you")
    .replace(/\bthe interaction exhibited\b/gi, "the conversation showed")
    .replace(/\bthis pattern indicates\b/gi, "this means")
    .replace(/\bthe conversation failed to advance\b/gi, "the conversation stalled")
    .replace(/\bthe hcp remained somewhat disengaged\b/gi, "the HCP disengaged")
    .replace(/\s+/g, " ")
    .trim();
}

function tightenSentences(text = "", maxWords = 22) {
  if (!text) return "";
  const fragments = String(text).split(/(?<=[.!?])\s+/).filter(Boolean);

  return fragments
    .map((fragment) => {
      const words = fragment.trim().split(/\s+/).filter(Boolean);
      if (words.length <= maxWords) return fragment.trim();
      return `${words.slice(0, maxWords).join(" ").replace(/[.,;:!?]+$/, "")}.`;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCoachingCopy(text = "") {
  if (!text) return "";

  const normalized = stripSystemReferences(text)
    .replace(/\bforensic\b/gi, "detailed")
    .replace(/\bdiagnostic\b/gi, "focused")
    .replace(/\bbehavioral signal\b/gi, "moment")
    .replace(/\bvolatility shift\b/gi, "tone shift")
    .replace(/\bcausal\b/gi, "clear")
    .replace(/\bremained\b/gi, "stayed")
    .replace(/\s+/g, " ")
    .trim();

  return tightenSentences(normalized, 22);
}

function uniqCoachingPoints(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").slice(0, 120);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSpecificStrengthParagraph(insight) {
  if (!insight) return "";
  const evidence = insight.transcriptEvidence ? `"${cleanCoachingCopy(insight.transcriptEvidence)}"` : "";
  const behavior = cleanCoachingCopy(insight.whatHappened || insight.whatGoodLooksLike || "");
  const impact = cleanCoachingCopy(insight.whyItMattered || "");
  if (!behavior && !impact && !evidence) return "";
  return [behavior, evidence ? `For example: ${evidence}.` : "", impact]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function buildSpecificDevelopmentParagraph(insight) {
  if (!insight) return "";
  const evidence = insight.transcriptEvidence ? `"${cleanCoachingCopy(insight.transcriptEvidence)}"` : "";
  const behavior = cleanCoachingCopy(insight.whatHappened || "");
  const impact = cleanCoachingCopy(insight.whyItMattered || "");
  const action = cleanCoachingCopy(insight.nextTimeAction || insight.whatGoodLooksLike || "");
  if (!behavior && !impact && !action && !evidence) return "";
  return [behavior, evidence ? `For example: ${evidence}.` : "", impact, action]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function buildActionItemParagraph(insight) {
  if (!insight?.nextTimeAction) return "";
  const rewrite = insight.exampleRewrite ? ` Example phrasing: "${cleanCoachingCopy(insight.exampleRewrite)}".` : "";
  return cleanCoachingCopy(`${insight.nextTimeAction}${rewrite}`);
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
      className="rounded-xl overflow-hidden flex-1 min-w-0 h-full"
      style={{
        background: "linear-gradient(180deg, rgba(16,34,58,0.98) 0%, rgba(18,42,60,0.98) 54%, rgba(19,58,67,0.98) 100%)",
        border: "1px solid rgba(68, 129, 146, 0.38)",
      }}
    >
      <button
        className="w-full px-4 py-3 text-left"
        onClick={() => !alwaysExpanded && setOpen(o => !o)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "hsl(174 60% 68%)" }} />
          <span
            className="text-xs font-semibold uppercase tracking-widest flex-1 whitespace-nowrap overflow-hidden text-ellipsis"
            style={{ color: "rgba(173, 240, 231, 0.90)" }}
          >
            {title}
          </span>
        </div>
        {!alwaysExpanded && (
          <div className="mt-2 flex">
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md border"
              style={{
                color: "rgba(236, 250, 248, 0.96)",
                background: "rgba(109, 174, 187, 0.24)",
                borderColor: "rgba(147, 216, 223, 0.42)",
              }}
            >
              {open ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {open ? "Collapse" : "Expand"}
            </span>
          </div>
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
            <div className="px-4 pb-4 space-y-2 border-t min-h-[94px]" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
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
      <p className="text-sm font-semibold" style={{ color: REVIEW_TEXT }}>{label}</p>
      <div className="text-sm leading-relaxed space-y-2" style={{ color: REVIEW_MUTED }}>{children}</div>
    </div>
  );
}

// ─── Deep-dive sub-block ──────────────────────────────────────────────────────

function DeepDiveBlock({ number, title, children }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: REVIEW_MUTED }}>
        <span className="font-mono mr-1" style={{ color: REVIEW_FAINT }}>{number})</span>{title}
      </p>
      {children}
    </div>
  );
}

// ─── Capability row ───────────────────────────────────────────────────────────

function CapabilityRow({ cap, insight }) {
  const [open, setOpen] = useState(false);
  const sublabel = CAP_SUBLABELS[cap.id];
  const score = LEVEL_TO_SCORE[insight?.observationLevel] || 0;
  const metricColor = getMetricColor(score);
  const { Icon: SignalIcon, tone } = getMetricSignal(score);
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
    <div className={`border-b border-border/30 last:border-b-0 border-l-2 ${open ? metricColor.border : "border-l-transparent"}`}>
      <button
        className={`w-full flex items-center gap-3 py-3.5 px-4 text-left transition-colors ${open ? metricColor.bg : ""}`}
        onClick={() => setOpen(o => !o)}
      >
        <SignalIcon className={`w-3.5 h-3.5 shrink-0 ${tone}`} />

        <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border shrink-0 ${metricColor.text} ${metricColor.bg} ${metricColor.border}`}>
          {cap.label}
        </span>

        <span className={`text-xs font-medium shrink-0 ${metricColor.text}`}>
          Score {score}/5
        </span>

        {sublabel && !open && (
          <span className="text-xs flex-1" style={{ color: REVIEW_FAINT }}>{sublabel}</span>
        )}
        {!sublabel && <span className="flex-1" />}

        <span className={`text-xs font-semibold px-3 py-1 rounded-md border shrink-0 transition-opacity ${metricColor.text} ${metricColor.bg} ${metricColor.border}`}>
          Analyze
        </span>

        {open
          ? <ChevronUp className="w-3.5 h-3.5 shrink-0 ml-1" style={{ color: REVIEW_FAINT }} />
          : <ChevronDown className="w-3.5 h-3.5 shrink-0 ml-1" style={{ color: REVIEW_FAINT }} />
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
            <div className={`pb-5 px-4 space-y-4 border-t border-l-2 pt-4 ${metricColor.border}`} style={{ borderTopColor: "rgba(152, 160, 171, 0.24)", background: REVIEW_PANEL }}>
              <div className={`rounded-md border px-3 py-2 ${metricColor.bg} ${metricColor.border}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide ${metricColor.text}`}>
                  Behavioral Analysis
                </p>
              </div>

              {insight.whatHappened && (
                <DeepDiveBlock number="1" title="What You Did">
                  <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: REVIEW_TEXT }}>{cleanCoachingCopy(insight.whatHappened)}</p>
                  {insight.transcriptEvidence && (
                      <div className="mt-2 p-3 rounded-lg bg-surface border-l-2 border-primary/40">
                        <p className="text-xs font-mono leading-relaxed italic" style={{ color: REVIEW_MUTED }}>"{cleanCoachingCopy(insight.transcriptEvidence)}"</p>
                    </div>
                  )}
                </DeepDiveBlock>
              )}

              {insight.whyItMattered && (
                <DeepDiveBlock number="2" title="How the HCP Reacted">
                  <p className="text-sm leading-relaxed" style={{ color: REVIEW_TEXT }}>{cleanCoachingCopy(insight.whyItMattered)}</p>
                </DeepDiveBlock>
              )}

              {insight.pattern && (
                <DeepDiveBlock number="3" title="If This Continues">
                  <p className="text-sm leading-relaxed" style={{ color: REVIEW_TEXT }}>{cleanCoachingCopy(insight.pattern)}</p>
                </DeepDiveBlock>
              )}

              {insight.whatGoodLooksLike && (
                <DeepDiveBlock number="4" title="What to Do Instead">
                  <p className="text-sm leading-relaxed" style={{ color: REVIEW_TEXT }}>{cleanCoachingCopy(insight.whatGoodLooksLike)}</p>
                  {insight.exampleRewrite && (
                    <div className="mt-2 p-3 rounded-lg bg-signal-positive/5 border border-signal-positive/20">
                      <p className="text-xs text-signal-positive font-medium mb-1">Example phrasing:</p>
                        <p className="text-xs italic" style={{ color: REVIEW_MUTED }}>"{cleanCoachingCopy(insight.exampleRewrite)}"</p>
                    </div>
                  )}
                </DeepDiveBlock>
              )}

              {insight.nextTimeAction && (
                <DeepDiveBlock number="5" title="Next Time">
                  <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: REVIEW_TEXT }}>{cleanCoachingCopy(insight.nextTimeAction)}</p>
                </DeepDiveBlock>
              )}

              {!hasStructuredContent && <NotObservedMarker />}

              {false && insight.relatedTurnIds?.length > 0 && null}
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
            <div className="pb-4 px-4 pt-3 border-t" style={{ borderColor: "rgba(152, 160, 171, 0.24)", background: REVIEW_PANEL }}>
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
  onRegenerate = null
}) {
  const [showSkillBreakdown, setShowSkillBreakdown] = useState(false);
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

  const legacyWhatWorked = splitParagraphs(review.what_worked || review.didWell || review.strengthsProse);
  const legacyWhatWasMissed = splitParagraphs(review.what_was_missed || review.biggestGap || review.developProse);
  const legacyCoaching = splitParagraphs(review.coaching_recommendations || review.nextAdjustment || review.actionPlanProse);
  const legacyImprovedResponse = splitParagraphs(review.improved_response || review.suggested_response || review.suggestedReframes?.[0]?.exampleRewrite);

  const briefRationale = cleanCoachingCopy(review.briefRationale || review.overallSummary?.[0] || "");
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
  const didWellFallback = uniqCoachingPoints(legacyWhatWorked.map(cleanCoachingCopy));

  const biggestGapParagraphs = growthInsights
    .map(buildSpecificDevelopmentParagraph)
    .filter(Boolean)
    .slice(0, 3);
  const biggestGapFallback = uniqCoachingPoints(legacyWhatWasMissed.map(cleanCoachingCopy));

  const actionItemParagraphs = growthInsights
    .map(buildActionItemParagraph)
    .filter(Boolean)
    .slice(0, 1);
  const actionItemFallback = uniqCoachingPoints(legacyCoaching.map(cleanCoachingCopy));

  const outcomeText = [briefRationale, cleanCoachingCopy(splitParagraphs(review.signalResponseAlignment)?.[2] || "")]
    .filter(Boolean)
    .slice(0, 2);

  const strengthsList = uniqCoachingPoints((didWellParagraphs.length > 0 ? didWellParagraphs : didWellFallback).map(cleanCoachingCopy)).slice(0, 3);
  const limitationsList = uniqCoachingPoints((biggestGapParagraphs.length > 0 ? biggestGapParagraphs : biggestGapFallback).map(cleanCoachingCopy)).slice(0, 3);
  const improvementText = uniqCoachingPoints((actionItemParagraphs.length > 0 ? actionItemParagraphs : actionItemFallback).map(cleanCoachingCopy)).slice(0, 1);

  const bestRewrite = insightByCapability["listening_responsiveness"]?.exampleRewrite
    || growthInsights.find((insight) => insight?.exampleRewrite)?.exampleRewrite
    || legacyImprovedResponse[0]
    || review.suggestedReframes?.[0]?.exampleRewrite
    || "";
  const cleanedBestRewrite = cleanCoachingCopy(bestRewrite);

  const hcpWasTesting = [
    scenario?.persona ? `This HCP was testing whether your response fit a ${scenario.persona.toLowerCase()} decision style.` : "",
    scenario?.coreTension ? `Core tension in this interaction: ${scenario.coreTension}` : "",
    Array.isArray(scenario?.interactionPressure) && scenario.interactionPressure.length > 0
      ? `Pressure signals: ${scenario.interactionPressure.join(", ")}`
      : "",
    Array.isArray(scenario?.keyChallenges) && scenario.keyChallenges.length > 0
      ? `Critical challenge: ${scenario.keyChallenges[0]}`
      : "",
  ].filter(Boolean);

  const patternInsight = scenario?.rep_profile || scenario?.patternInsight || "";

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
            background: "linear-gradient(94deg, hsl(223 52% 14%) 0%, hsl(213 54% 20%) 38%, hsl(187 42% 18%) 100%)",
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
                  borderColor: "rgba(122, 195, 206, 0.48)",
                  background: "rgba(70, 132, 149, 0.20)",
                  color: "rgba(204, 238, 244, 0.96)",
                }}
              >
                {scenario.journeyStage.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {typeof onRegenerate === "function" && (
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border-b items-stretch" style={{ borderColor: "rgba(152, 160, 171, 0.24)", background: "linear-gradient(90deg, hsl(224 50% 15%) 0%, hsl(214 54% 21%) 36%, hsl(186 44% 20%) 100%)" }}>
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
                  alwaysExpanded
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
                  alwaysExpanded
                  tip="Preview the HCP's setting and opening beat before starting."
                >
                  <p className="text-xs leading-relaxed italic mt-2" style={{ color: "rgba(244,249,249,0.94)" }}>"{scenario.openingScene}"</p>
                </ContextCard>
              </div>
              <div>
                <ContextCard
                  icon={AlertTriangle}
                  title="Key Challenges"
                  alwaysExpanded
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
            {typeof onRegenerate === "function" && (
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

            <div className="space-y-6">
              <div className="rounded-xl border px-5 py-5" style={{ borderColor: sectionSurface.outcome.border, background: sectionSurface.outcome.bg }}>
                <OverallBlock label="1) Interaction Outcome">
                  {outcomeText.length > 0
                    ? outcomeText.map((p, i) => <p key={i} style={{ color: i === 0 ? REVIEW_TEXT : REVIEW_MUTED }}>{p}</p>)
                    : <NotObservedMarker />}
                </OverallBlock>
              </div>

              <div className="rounded-xl border px-5 py-5" style={{ borderColor: sectionSurface.well.border, background: sectionSurface.well.bg }}>
                <OverallBlock label="2) What You Did Well">
                  {strengthsList.length > 0 ? strengthsList.map((item, i) => (
                    <p key={i} className="flex items-start gap-2">
                      <span style={{ color: "hsl(169 56% 34%)" }}>•</span>
                      <span>{item}</span>
                    </p>
                  )) : <NotObservedMarker />}
                </OverallBlock>
              </div>

              <div className="rounded-xl border px-5 py-5" style={{ borderColor: sectionSurface.limits.border, background: sectionSurface.limits.bg }}>
                <OverallBlock label="3) What Limited the Interaction">
                  {limitationsList.length > 0 ? limitationsList.map((item, i) => (
                    <p key={i} className="flex items-start gap-2">
                      <span style={{ color: "hsl(8 56% 44%)" }}>•</span>
                      <span>{item}</span>
                    </p>
                  )) : <NotObservedMarker />}
                </OverallBlock>
              </div>

              <div className="rounded-xl border px-5 py-5" style={{ borderColor: sectionSurface.testing.border, background: sectionSurface.testing.bg }}>
                <OverallBlock label="4) What the HCP Was Testing">
                  {hcpWasTesting.length > 0 ? hcpWasTesting.map((item, i) => <p key={i}>{item}</p>) : <NotObservedMarker />}
                  {patternInsight && (
                    <p className="text-xs mt-2 pt-2 border-t" style={{ color: REVIEW_FAINT, borderColor: "rgba(152, 160, 171, 0.18)" }}>
                      Pattern Insight: {patternInsight}
                    </p>
                  )}
                </OverallBlock>
              </div>

              <div className="rounded-xl border px-5 py-5" style={{ borderColor: sectionSurface.improve.border, background: sectionSurface.improve.bg }}>
                <OverallBlock label="5) How to Improve">
                  {improvementText.length > 0 ? improvementText.map((item, i) => <p key={i}>{item}</p>) : <NotObservedMarker />}
                </OverallBlock>
              </div>

              <div className="rounded-xl border px-5 py-5" style={{ borderColor: sectionSurface.rewrite.border, background: sectionSurface.rewrite.bg }}>
                <OverallBlock label="6) Better Way to Say It">
                  {cleanedBestRewrite ? (
                    <div className="rounded-lg border px-4 py-3" style={{ borderColor: "rgba(5,150,105,0.28)", background: "rgba(5,150,105,0.06)", color: REVIEW_TEXT }}>
                      "{cleanedBestRewrite}"
                    </div>
                  ) : <NotObservedMarker />}
                </OverallBlock>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(152, 160, 171, 0.30)", background: "rgba(255,255,255,0.72)" }}>
                <button
                  type="button"
                  onClick={() => setShowSkillBreakdown((current) => !current)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                  style={{ background: "linear-gradient(180deg, rgba(248,251,252,0.98) 0%, rgba(240,246,247,0.98) 100%)" }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">7) Skill Breakdown</span>
                      <span className="text-xs" style={{ color: REVIEW_MUTED }}>Overall {overallScore}/5</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: REVIEW_MUTED }}>
                      All 8 behavioral metrics with score-led analysis.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-md border" style={{ color: REVIEW_MUTED, background: "rgba(255,255,255,0.82)", borderColor: "rgba(152, 160, 171, 0.30)" }}>
                    {showSkillBreakdown ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    {showSkillBreakdown ? "Collapse" : "Expand"}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {showSkillBreakdown && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y border-t" style={{ borderColor: "rgba(152, 160, 171, 0.22)" }}>
                        {SIGNAL_INTELLIGENCE_CAPABILITIES.map(cap => (
                          <CapabilityRow
                            key={cap.id}
                            cap={cap}
                            insight={insightByCapability[cap.id]}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {review.overallGuidance?.[0] && (
                <p className="text-xs leading-relaxed pt-1" style={{ color: REVIEW_FAINT }}>
                  {cleanCoachingCopy(review.overallGuidance[0])}
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
            className="flex items-center gap-2 text-sm transition-colors"
            style={{ color: REVIEW_MUTED }}
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
