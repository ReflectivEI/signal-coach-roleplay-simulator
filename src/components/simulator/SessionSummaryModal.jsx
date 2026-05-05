import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, ChevronDown, ChevronUp, RefreshCw, MessageSquare, FileText, Target, AlertTriangle, CheckCircle2, AlertCircle, XCircle, Maximize2, Minimize2 } from "lucide-react";
import { SIGNAL_INTELLIGENCE_CAPABILITIES, PRESSURE_LABELS } from "@/lib/signalIntelligence";

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
  signal: { border: "rgba(64, 112, 150, 0.34)", bg: "linear-gradient(180deg, rgba(247,251,255,0.98) 0%, rgba(241,247,252,0.98) 100%)" },
  coaching: { border: "rgba(47, 132, 128, 0.34)", bg: "linear-gradient(180deg, rgba(246,252,251,0.98) 0%, rgba(239,248,247,0.98) 100%)" },
  evidence: { border: "rgba(99, 111, 150, 0.34)", bg: "linear-gradient(180deg, rgba(248,249,254,0.98) 0%, rgba(241,243,251,0.98) 100%)" },
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
const REVIEW_EVIDENCE_BG = "linear-gradient(180deg, hsl(222 37% 17%) 0%, hsl(222 34% 14%) 100%)";
const REVIEW_EVIDENCE_BORDER = "rgba(120, 156, 208, 0.42)";
const REVIEW_EVIDENCE_TEXT = "hsl(210 100% 96%)";

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
    .replace(/\b(?:in\s+)?turn\s*#?\d+\b/gi, "early in the conversation")
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
    .replace(/\b(as seen in|for example:?)\s*[.]+/gi, "")
    .replace(/\bearly in the conversation\s+early in the conversation\b/gi, "early in the conversation")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function tightenSentences(text = "", maxWords = 22) {
  if (!text) return "";
  const fragments = String(text).split(/(?<=[.!?])\s+/).filter(Boolean);

  const completeFragments = [];
  let totalWords = 0;

  for (const fragment of fragments) {
    const trimmed = fragment.trim();
    if (!trimmed) continue;

    const words = trimmed.split(/\s+/).filter(Boolean);
    if (completeFragments.length > 0 && totalWords + words.length > maxWords) {
      break;
    }

    completeFragments.push(trimmed);
    totalWords += words.length;

    if (totalWords >= maxWords) {
      break;
    }
  }

  return (completeFragments[0] || "")
    ? completeFragments.join(" ").replace(/\s+/g, " ").trim()
    : String(text).replace(/\s+/g, " ").trim();
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

function cleanCoachingCopyExpanded(text = "", maxWords = 44) {
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

  return tightenSentences(normalized, maxWords);
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

function buildRobustImprovementPoint(insight) {
  if (!insight) return "";

  const action = cleanCoachingCopyExpanded(insight.nextTimeAction || insight.whatGoodLooksLike || "");
  const why = cleanCoachingCopyExpanded(insight.whyItMattered || "");
  const evidence = cleanCoachingCopyExpanded(insight.transcriptEvidence || "", 20);
  const behavior = cleanCoachingCopyExpanded(insight.whatHappened || "");

  if (!action && !why && !evidence && !behavior) return "";

  const parts = [
    action,
    why ? `Why this matters: ${why}` : "",
    evidence ? `Anchor it to moments like: "${evidence}".` : "",
    !action && behavior ? `Observed pattern to fix: ${behavior}` : "",
  ].filter(Boolean);

  return parts.join(" ").trim();
}

function formatUiPressureLabel(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return PRESSURE_LABELS[raw] || raw.replace(/_/g, " ");
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

function SectionCard({ label, surface, children }) {
  return (
    <div className="rounded-xl border px-5 py-5" style={{ borderColor: surface.border, background: surface.bg }}>
      <OverallBlock label={label}>{children}</OverallBlock>
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
                    <div className="mt-2 p-3 rounded-lg border-l-2" style={{ background: REVIEW_EVIDENCE_BG, borderColor: REVIEW_EVIDENCE_BORDER }}>
                      <p className="text-xs font-mono leading-relaxed italic" style={{ color: REVIEW_EVIDENCE_TEXT }}>
                        "{cleanCoachingCopy(insight.transcriptEvidence)}"
                      </p>
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
 *   session?: any;
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
  session = null,
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
    .map(buildRobustImprovementPoint)
    .filter(Boolean)
    .slice(0, 3);
  const actionItemFallback = uniqCoachingPoints(legacyCoaching.map((item) => cleanCoachingCopyExpanded(item, 44)));

  const outcomeText = [briefRationale, cleanCoachingCopy(splitParagraphs(review.signalResponseAlignment)?.[2] || "")]
    .filter(Boolean)
    .slice(0, 2);

  const strengthsList = uniqCoachingPoints((didWellParagraphs.length > 0 ? didWellParagraphs : didWellFallback).map(cleanCoachingCopy)).slice(0, 3);
  const limitationsList = uniqCoachingPoints((biggestGapParagraphs.length > 0 ? biggestGapParagraphs : biggestGapFallback).map(cleanCoachingCopy)).slice(0, 3);
  const improvementText = uniqCoachingPoints((actionItemParagraphs.length > 0 ? actionItemParagraphs : actionItemFallback).map((item) => cleanCoachingCopyExpanded(item, 44))).slice(0, 3);

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
      ? `Pressure signals: ${scenario.interactionPressure.map(formatUiPressureLabel).join(", ")}`
      : "",
    Array.isArray(scenario?.keyChallenges) && scenario.keyChallenges.length > 0
      ? `Critical challenge: ${scenario.keyChallenges[0]}`
      : "",
  ].filter(Boolean);

  const patternInsight = scenario?.rep_profile || scenario?.patternInsight || "";
  const signalAlignmentParagraphs = uniqCoachingPoints([
    briefRationale,
    ...splitParagraphs(review.signalResponseAlignment),
    ...splitParagraphs(review.overallSummary).slice(1, 3),
  ].map((item) => cleanCoachingCopyExpanded(item, 38))).slice(0, 4);
  const temperatureValue = Number(session?.realism ?? session?.temperature);
  const temperatureBand = !Number.isFinite(temperatureValue)
    ? "unknown"
    : temperatureValue <= 3
      ? "low"
      : temperatureValue <= 7
        ? "medium"
        : "high";
  const runtimeSignalItems = uniqCoachingPoints([
    session?.predictiveLens?.runtimeSignals?.predictive_profile_attached?.hasProfile || session?.predictiveProfile?.type
      ? `Predictive profile attached: ${(session?.predictiveLens?.runtimeSignals?.predictive_profile_attached?.personaType || session?.predictiveProfile?.type || "active").replaceAll("_", " ")}.`
      : "",
    Number.isFinite(temperatureValue)
      ? `Temperature applied: ${temperatureValue}/10 (${temperatureBand} realism).`
      : "",
    session?.predictiveLens?.sections?.mindset?.headline
      ? `Mindset signal: ${cleanCoachingCopyExpanded(session.predictiveLens.sections.mindset.headline, 20)}`
      : "",
    session?.predictiveLens?.sections?.responseStyle?.headline
      ? `Expected response style: ${cleanCoachingCopyExpanded(session.predictiveLens.sections.responseStyle.headline, 20)}`
      : "",
  ]).slice(0, 4);
  const transcriptEvidenceItems = uniqCoachingPoints(
    (review.capabilityInsights || [])
      .filter((insight) => insight?.transcriptEvidence || insight?.whyItMattered)
      .map((insight) => {
        const evidence = cleanCoachingCopyExpanded(insight?.transcriptEvidence || "", 24);
        const impact = cleanCoachingCopyExpanded(insight?.whyItMattered || "", 24);
        if (!evidence && !impact) return "";
        return `${insight?.capabilityName || insight?.title || "Observed signal"}: ${evidence || impact}${evidence && impact ? ` Why it mattered: ${impact}` : ""}`;
      })
      .filter(Boolean),
  ).slice(0, 4);
  const evidenceRecords = Array.isArray(session?.predictiveLens?.evidenceRecords) ? session.predictiveLens.evidenceRecords : [];
  const evidenceReferenceItems = evidenceRecords
    .map((record, index) => ({
      id: record?.id || `evidence-${index}`,
      title: record?.title || record?.headline || record?.sourceTitle || record?.organization || "Reference",
      detail: cleanCoachingCopyExpanded(record?.summary || record?.snippet || record?.finding || record?.description || "", 32),
      url: record?.url || record?.sourceUrl || "",
    }))
    .filter((item) => item.title || item.detail)
    .slice(0, 4);
  const showEvidenceSection = transcriptEvidenceItems.length > 0 || evidenceReferenceItems.length > 0 || Boolean(session?.predictiveLens?.synthesisError);

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
              <SectionCard label="1) Signal Intelligence Summary" surface={sectionSurface.signal}>
                {signalAlignmentParagraphs.length > 0
                  ? signalAlignmentParagraphs.map((paragraph, index) => (
                    <p key={`signal-${index}`} style={{ color: index === 0 ? REVIEW_TEXT : REVIEW_MUTED }}>{paragraph}</p>
                  ))
                  : <NotObservedMarker />}

                {runtimeSignalItems.length > 0 && (
                  <div className="pt-3 mt-3 border-t space-y-2" style={{ borderColor: "rgba(152, 160, 171, 0.18)" }}>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: REVIEW_FAINT }}>
                      Runtime signals
                    </p>
                    {runtimeSignalItems.map((item, index) => (
                      <p key={`runtime-${index}`} className="flex items-start gap-2">
                        <span style={{ color: "hsl(208 48% 42%)" }}>•</span>
                        <span>{item}</span>
                      </p>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard label="2) Interaction Outcome" surface={sectionSurface.coaching}>
                {outcomeText.length > 0
                  ? outcomeText.map((item, index) => <p key={`outcome-${index}`}>{item}</p>)
                  : <NotObservedMarker />}
              </SectionCard>

              <SectionCard label="3) What You Did Well" surface={sectionSurface.coaching}>
                {strengthsList.length > 0
                  ? strengthsList.map((item, index) => <p key={`strength-${index}`}>{item}</p>)
                  : <NotObservedMarker />}
              </SectionCard>

              <SectionCard label="4) What Limited the Interaction" surface={sectionSurface.coaching}>
                {limitationsList.length > 0
                  ? limitationsList.map((item, index) => (
                    <p key={`limit-${index}`} className="flex items-start gap-2">
                      <span style={{ color: "hsl(8 56% 44%)" }}>•</span>
                      <span>{item}</span>
                    </p>
                  ))
                  : <NotObservedMarker />}
              </SectionCard>

              <SectionCard label="5) What the HCP Was Testing" surface={sectionSurface.coaching}>
                {hcpWasTesting.length > 0
                  ? hcpWasTesting.map((item, index) => <p key={`hcp-test-${index}`}>{item}</p>)
                  : <NotObservedMarker />}
                {patternInsight ? <p style={{ color: REVIEW_MUTED }}>Pattern insight: {patternInsight}</p> : null}
              </SectionCard>

              <SectionCard label="6) How to Improve" surface={sectionSurface.coaching}>
                {improvementText.length > 0
                  ? improvementText.map((item, index) => (
                    <p key={`improve-${index}`} className="flex items-start gap-2">
                      <span style={{ color: "hsl(313 45% 40%)" }}>•</span>
                      <span>{item}</span>
                    </p>
                  ))
                  : <NotObservedMarker />}
                {cleanedBestRewrite && (
                  <div className="rounded-lg border px-4 py-3 mt-1" style={{ borderColor: "rgba(5,150,105,0.28)", background: "rgba(5,150,105,0.06)", color: REVIEW_TEXT }}>
                    Better way to say it: "{cleanedBestRewrite}"
                  </div>
                )}
              </SectionCard>

              {showEvidenceSection && (
                <SectionCard label="7) Evidence / References" surface={sectionSurface.evidence}>
                  {transcriptEvidenceItems.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: REVIEW_FAINT }}>Conversation evidence</p>
                      {transcriptEvidenceItems.map((item, index) => (
                        <div key={`evidence-${index}`} className="rounded-lg border px-4 py-3" style={{ borderColor: "rgba(120, 156, 208, 0.34)", background: "rgba(255,255,255,0.68)" }}>
                          <p style={{ color: REVIEW_TEXT }}>{item}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {evidenceReferenceItems.length > 0 && (
                    <div className="space-y-2 pt-3 mt-3 border-t" style={{ borderColor: "rgba(152, 160, 171, 0.18)" }}>
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: REVIEW_FAINT }}>Supporting references</p>
                      {evidenceReferenceItems.map((item) => (
                        <div key={item.id} className="rounded-lg border px-4 py-3" style={{ borderColor: "rgba(120, 156, 208, 0.34)", background: "rgba(255,255,255,0.68)" }}>
                          <p className="font-semibold" style={{ color: REVIEW_TEXT }}>{item.title}</p>
                          {item.detail ? <p className="mt-1" style={{ color: REVIEW_MUTED }}>{item.detail}</p> : null}
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold underline mt-2 inline-block"
                              style={{ color: "hsl(198 57% 35%)" }}
                            >
                              Open reference
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}

                  {session?.predictiveLens?.synthesisError ? (
                    <div className="rounded-lg border px-4 py-3 mt-3" style={{ borderColor: "rgba(180, 120, 20, 0.28)", background: "rgba(180, 120, 20, 0.08)", color: "hsl(38 62% 34%)" }}>
                      {session.predictiveLens.synthesisError}
                    </div>
                  ) : null}

                  {!transcriptEvidenceItems.length && !evidenceReferenceItems.length && !session?.predictiveLens?.synthesisError
                    ? <NotObservedMarker />
                    : null}
                </SectionCard>
              )}

              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(152, 160, 171, 0.30)", background: "rgba(255,255,255,0.72)" }}>
                <button
                  type="button"
                  onClick={() => setShowSkillBreakdown((current) => !current)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                  style={{ background: "linear-gradient(180deg, rgba(248,251,252,0.98) 0%, rgba(240,246,247,0.98) 100%)" }}
                >
                  <div className="flex-1 min-w-0 text-left">
                    <p
                      className="text-[11px] font-bold uppercase tracking-[0.16em]"
                      style={{ color: "hsl(214 28% 28%)" }}
                    >
                      Skill Breakdown
                    </p>
                    <p className="text-sm font-bold mt-0.5" style={{ color: "hsl(215 34% 22%)" }}>
                      Overall {overallScore}/5
                    </p>
                    <p className="text-xs mt-0.5 font-medium" style={{ color: "hsl(215 16% 40%)" }}>
                      All 8 behavioral metrics with score-led analysis.
                    </p>
                  </div>
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-md border ml-4"
                    style={{ color: "hsl(215 24% 30%)", background: "rgba(255,255,255,0.92)", borderColor: "rgba(140, 152, 168, 0.42)" }}
                  >
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
