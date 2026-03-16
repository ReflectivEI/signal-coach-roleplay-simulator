import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronUp, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { SIGNAL_CAPABILITIES } from "./signalIntelligenceSOT";

const CAPABILITIES = SIGNAL_CAPABILITIES.map(c => ({
  id: c.id,
  label: c.label,
  color: c.color,
  question: c.canonicalQuestion,
  metrics: c.coreMetrics.map(m => m.name).join(", ")
}));

const FEEDBACK_SECTION_CANONICAL = {
  brief_rationale: "Brief rationale",
  specific_evidence: "Specific evidence from the transcript",
  concrete_adjustment: "One concrete behavior to adjust",
  coaching_cue: "Coaching cue for next call",
};


const OVERALL_SECTION_CANONICAL = {
  brief_rationale: "Brief rationale",
  strengths: "What the rep did well across capabilities",
  gap: "Biggest cross-capability gap to improve next",
  adjustment: "One concrete adjustment for the next role-play",
};

function normalizeOverallFeedback(rawFeedback = "") {
  const preparedText = String(rawFeedback)
    .replace(/\r/g, "")
    .replace(/(SECTION\s*\d+\s*:)/gi, "\n$1")
    .replace(/\s+(\d+[.)]\s*(?:Brief rationale|What the rep did well across capabilities|Biggest cross-capability gap to improve next|One concrete adjustment for the next role-play)\s*:)/gi, "\n$1")
    .replace(/\s+((?:Brief rationale|What the rep did well across capabilities|Biggest cross-capability gap to improve next|One concrete adjustment for the next role-play|Strengths|Improvements|Action Items)\s*:)/gi, "\n$1")
    .trim();

  const rawLines = preparedText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (rawLines.length === 0) return "";

  const sections = {
    brief_rationale: [],
    strengths: [],
    gap: [],
    adjustment: [],
  };

  let currentSection = "";

  const cleanLine = (line) => line
    .replace(/^[-*]\s*/, "")
    .replace(/^\d+[.)-]?\s*/, "")
    .replace(/^section\s*\d+\s*:\s*/i, "")
    .replace(/^[#]+\s*/, "")
    .trim();

  const detectSection = (line) => {
    const clean = cleanLine(line);

    if (/^brief\s+rationale/i.test(clean)) return "brief_rationale";
    if (/^strengths?\b/i.test(clean)) return "strengths";
    if (/^what\s+the\s+rep\s+did\s+well/i.test(clean)) return "strengths";
    if (/^improvements?\b/i.test(clean)) return "gap";
    if (/^biggest\s+cross[-\s]capability\s+gap/i.test(clean)) return "gap";
    if (/^one\s+concrete\s+adjustment/i.test(clean)) return "adjustment";
    if (/^action\s*items?\b/i.test(clean)) return "adjustment";
    return "";
  };

  rawLines.forEach((line) => {
    const section = detectSection(line);
    if (section) {
      currentSection = section;
      const body = cleanLine(line)
        .replace(/^brief\s+rationale\s*:?\s*/i, "")
        .replace(/^strengths?\s*:?\s*/i, "")
        .replace(/^what\s+the\s+rep\s+did\s+well(?:\s+across\s+capabilities)?\s*:?\s*/i, "")
        .replace(/^improvements?\s*:?\s*/i, "")
        .replace(/^biggest\s+cross[-\s]capability\s+gap\s+to\s+improve\s+next\s*:?\s*/i, "")
        .replace(/^one\s+concrete\s+adjustment\s+for\s+the\s+next\s+role[-\s]play\s*:?\s*/i, "")
        .replace(/^action\s*items?\s*:?\s*/i, "")
        .trim();
      if (body) sections[currentSection].push(body);
      return;
    }

    if (!currentSection) return;
    sections[currentSection].push(line.replace(/^[-*]\s*/, "").trim());
  });

  const structured = [
    ["brief_rationale", OVERALL_SECTION_CANONICAL.brief_rationale],
    ["strengths", OVERALL_SECTION_CANONICAL.strengths],
    ["gap", OVERALL_SECTION_CANONICAL.gap],
    ["adjustment", OVERALL_SECTION_CANONICAL.adjustment],
  ]
    .filter(([key]) => sections[key].length > 0)
    .map(([key, label]) => `### ${label}\n${sections[key].join("\n\n")}`)
    .join("\n\n");

  if (structured) return structured;

  return `### ${OVERALL_SECTION_CANONICAL.brief_rationale}\n${rawLines.join("\n\n")}`;
}

function normalizeCapabilityFeedback(rawFeedback = "") {
  const rawLines = String(rawFeedback)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const dedupedLines = rawLines.filter((line, idx, arr) => arr.indexOf(line) === idx);

  const normalized = dedupedLines.map((line) => {
    const clean = line.replace(/^[-*]\s*/, "").trim();

    if (/^(?:\d+[.)-]?\s*)?(brief\s+rationale)\s*[:\-]?/i.test(clean)) {
      const body = clean.replace(/^(?:\d+[.)-]?\s*)?(brief\s+rationale)\s*[:\-]?\s*/i, "").trim();
      return body
        ? `**${FEEDBACK_SECTION_CANONICAL.brief_rationale}:** ${body}`
        : `**${FEEDBACK_SECTION_CANONICAL.brief_rationale}:**`;
    }
    if (/^(?:\d+[.)-]?\s*)?(specific\s+evidence(?:\s+from\s+the\s+transcript)?)\s*[:\-]?/i.test(clean)) {
      const body = clean.replace(/^(?:\d+[.)-]?\s*)?(specific\s+evidence(?:\s+from\s+the\s+transcript)?)\s*[:\-]?\s*/i, "").trim();
      return body
        ? `**${FEEDBACK_SECTION_CANONICAL.specific_evidence}:** ${body}`
        : `**${FEEDBACK_SECTION_CANONICAL.specific_evidence}:**`;
    }
    if (/^(?:\d+[.)-]?\s*)?(?:one\s+)?concrete\s+behavior\s+to\s+adjust\s*[:\-]?/i.test(clean)) {
      const body = clean.replace(/^(?:\d+[.)-]?\s*)?(?:one\s+)?concrete\s+behavior\s+to\s+adjust\s*[:\-]?\s*/i, "").trim();
      return body
        ? `**${FEEDBACK_SECTION_CANONICAL.concrete_adjustment}:** ${body}`
        : `**${FEEDBACK_SECTION_CANONICAL.concrete_adjustment}:**`;
    }
    if (/^(?:\d+[.)-]?\s*)?coaching\s+cue(?:\s+for\s+next\s+call)?\s*[:\-]?/i.test(clean)) {
      const body = clean.replace(/^(?:\d+[.)-]?\s*)?coaching\s+cue(?:\s+for\s+next\s+call)?\s*[:\-]?\s*/i, "").trim();
      return body
        ? `**${FEEDBACK_SECTION_CANONICAL.coaching_cue}:** ${body}`
        : `**${FEEDBACK_SECTION_CANONICAL.coaching_cue}:**`;
    }
    return clean;
  });

  return normalized.join("\n\n");
}

const colorMap = {
  teal: { btn: "bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200", badge: "bg-teal-100 text-teal-700", result: "border-teal-200 bg-teal-50" },
  blue: { btn: "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200", badge: "bg-blue-100 text-blue-700", result: "border-blue-200 bg-blue-50" },
  purple: { btn: "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200", badge: "bg-purple-100 text-purple-700", result: "border-purple-200 bg-purple-50" },
  cyan: { btn: "bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border-cyan-200", badge: "bg-cyan-100 text-cyan-700", result: "border-cyan-200 bg-cyan-50" },
  orange: { btn: "bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200", badge: "bg-orange-100 text-orange-700", result: "border-orange-200 bg-orange-50" },
  indigo: { btn: "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200", badge: "bg-indigo-100 text-indigo-700", result: "border-indigo-200 bg-indigo-50" },
  pink: { btn: "bg-pink-50 hover:bg-pink-100 text-pink-700 border-pink-200", badge: "bg-pink-100 text-pink-700", result: "border-pink-200 bg-pink-50" },
  green: { btn: "bg-green-50 hover:bg-green-100 text-green-700 border-green-200", badge: "bg-green-100 text-green-700", result: "border-green-200 bg-green-50" },
};

export default function CapabilityFeedbackPanel({ messages, turns = [], scenario }) {
  const focusCaps = scenario?.focus_capabilities || [];
  const [capFeedback, setCapFeedback] = useState({});
  const [loading, setLoading] = useState({});
  const [expanded, setExpanded] = useState({});
  const [overallFeedback, setOverallFeedback] = useState("");
  const [overallLoading, setOverallLoading] = useState(false);
  const [overallExpanded, setOverallExpanded] = useState(false);

  const transcript = messages
    .map((m) => `${m.role === "user" ? "Sales Rep" : "HCP"}: ${m.content}`)
    .join("\n");

  const scoredTurns = turns.filter((t) => t.alignment?.metrics);
  const latestTurn = scoredTurns.length > 0 ? scoredTurns[scoredTurns.length - 1] : null;
  const metrics = latestTurn?.alignment?.metrics || {};
  const getCapabilityScore = (capId) => {
    const score = metrics?.[capId]?.score;
    return typeof score === 'number' ? score : null;
  };

  const overallScore = typeof latestTurn?.alignment?.score === 'number' ? latestTurn.alignment.score : null;

  const requestCapabilityFeedback = async (cap) => {
    setLoading((prev) => ({ ...prev, [cap.id]: true }));
    setExpanded((prev) => ({ ...prev, [cap.id]: true }));
    try {
      const clipTrans = transcript.substring(0, 2000);
      const metricSignals = metrics?.[cap.id];
      const prompt = `As a sales coach, analyze this capability using only observable behavior from the transcript and deterministic findings (do NOT rescore).\nCapability: ${cap.label}\nMetric: ${cap.question}\nKey strengths detected: ${(metricSignals?.positives || []).slice(0, 3).join(' | ') || 'None detected'}\nKey gaps detected: ${(metricSignals?.misalignments || []).slice(0, 3).join(' | ') || 'None detected'}\n\nTranscript excerpt:\n${clipTrans}\n\nProvide:\n1) Brief rationale grounded in behavior\n2) Specific evidence from the transcript\n3) One concrete behavior to adjust\n4) Coaching cue for next call\n\nIMPORTANT: Do NOT output numeric scores.`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] })
      });

      if (!res.ok) throw new Error('Failed to get feedback');
      const data = await res.json();
      const feedbackText = data.response || data.text || data.content || '';
      const normalizedFeedback = normalizeCapabilityFeedback(feedbackText);
      setCapFeedback((prev) => ({ ...prev, [cap.id]: normalizedFeedback }));
    } catch (err) {
      console.error('Capability feedback error:', err);
      setCapFeedback((prev) => ({ ...prev, [cap.id]: 'Unable to generate feedback. Please try again.' }));
    } finally {
      setLoading((prev) => ({ ...prev, [cap.id]: false }));
    }
  };

  const requestOverallFeedback = async () => {
    setOverallLoading(true);
    setOverallExpanded(true);
    try {
      const clipTrans = transcript.substring(0, 3000);
      const capabilitySummary = CAPABILITIES
        .map((cap) => {
          const metric = metrics?.[cap.id] || {};
          return `${cap.label}: strengths= ${(metric.positives || []).slice(0, 2).join(' | ') || 'none'} ; gaps= ${(metric.misalignments || []).slice(0, 2).join(' | ') || 'none'}`;
        })
        .join("\n");
      const prompt = `As a sales coach, provide an overall session analysis using deterministic observations below (do NOT rescore).\n\nCapability findings:\n${capabilitySummary}\n\nTranscript excerpt:\n${clipTrans}\n\nProvide:\n1) Brief rationale grounded in behavior\n2) What the rep did well across capabilities\n3) Biggest cross-capability gap to improve next\n4) One concrete adjustment for the next role-play\n\nIMPORTANT: Do NOT output numeric scores.`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] })
      });

      if (!res.ok) throw new Error('Failed to get overall feedback');
      const data = await res.json();
      const feedbackText = data.response || data.text || data.content || '';
      const normalizedFeedback = normalizeOverallFeedback(feedbackText);
      setOverallFeedback(normalizedFeedback || feedbackText || 'Unable to generate overall analysis. Please try again.');
    } catch (err) {
      console.error('Overall feedback error:', err);
      setOverallFeedback('Unable to generate overall analysis. Please try again.');
    } finally {
      setOverallLoading(false);
    }
  };

  const toggleExpand = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  if (messages.filter((m) => m.role === "user").length < 2) {
    return (
      <div className="px-4 py-3 text-xs text-gray-400 italic text-center">
        Send at least 2 messages to unlock capability-specific feedback.
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-2.5">
      <div className="mb-1 rounded-xl border border-slate-300 bg-gradient-to-r from-slate-100 to-slate-50 px-3 py-2 shadow-sm">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Zap className="w-3.5 h-3.5 text-teal-500" />
          <span className="font-bold text-sm text-gray-900">Overall: {overallScore !== null ? `${overallScore}/5` : "N/A"}</span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_110px] items-center gap-x-2 mt-1">
          <p className="text-xs text-gray-700">Capability Feedback Analysis by Behavioral Metric — click any metric below to analyze. {latestTurn?.alignment?.metricsVersion ? `(${latestTurn.alignment.metricsVersion})` : ""}</p>
          <div className="flex items-center justify-center gap-1">
            {!overallFeedback && !overallLoading && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 px-4 border-2 font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                onClick={requestOverallFeedback}
              >
                Analyze
              </Button>
            )}
            {overallLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
            {overallFeedback && !overallLoading && (
              <button onClick={() => setOverallExpanded((prev) => !prev)} className="text-gray-500 hover:text-gray-700">
                {overallExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
        {overallFeedback && overallExpanded && (
          <div className="mt-2 border-t border-slate-200 pt-2.5 rounded-lg bg-white/80 px-3 py-3">
            <ReactMarkdown
              components={{
                h3: (props) => <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-1 mt-3 first:mt-0" {...props} />,
                p: (props) => <p className="mb-1.5 leading-[1.55] text-[13px] text-slate-800" {...props} />,
                ul: (props) => <ul className="list-disc pl-5 mb-1.5 text-[13px] text-slate-800 space-y-1" {...props} />,
                li: (props) => <li className="leading-[1.5]" {...props} />,
                strong: (props) => <strong className="font-semibold text-slate-900" {...props} />,
              }}
            >{overallFeedback}</ReactMarkdown>
          </div>
        )}
      </div>
      {focusCaps.length > 0 && (
        <div className="mb-3 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
          ⭐ <span className="font-semibold">Scenario focus:</span> {focusCaps.map((id) => CAPABILITIES.find((c) => c.id === id)?.label).filter(Boolean).join(", ")}
        </div>
      )}
      {[...CAPABILITIES].sort((a, b) => {
        const aFocus = focusCaps.includes(a.id) ? 0 : 1;
        const bFocus = focusCaps.includes(b.id) ? 0 : 1;
        return aFocus - bFocus;
      }).map((cap) => {
        const colors = colorMap[cap.color];
        const isLoading = loading[cap.id];
        const hasFeedback = !!capFeedback[cap.id];
        const isExpanded = expanded[cap.id];

        return (
          <div key={cap.id} className={`rounded-xl border ${hasFeedback ? colors.result : "border-gray-300 bg-white"} overflow-hidden shadow-sm`}>
            <div className="grid grid-cols-[1fr_110px] items-center gap-2 px-3 py-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>{cap.label}</span>
                {focusCaps.includes(cap.id) && <span className="text-yellow-500 text-xs">⭐</span>}
                {getCapabilityScore(cap.id) !== null && (
                  <span className="text-xs font-semibold text-gray-500">Score {getCapabilityScore(cap.id)}/5</span>
                )}
                {hasFeedback && (
                  <span className="text-xs text-gray-600">{cap.question}</span>
                )}
              </div>
              <div className="flex items-center justify-center gap-1">
                {!hasFeedback && !isLoading && (
                  <Button
                    size="sm"
                    variant="outline"
                    className={`text-xs h-8 px-4 border-2 font-bold ${colors.btn}`}
                    onClick={() => requestCapabilityFeedback(cap)}
                  >
                    Analyze
                  </Button>
                )}
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                {hasFeedback && (
                  <button onClick={() => toggleExpand(cap.id)} className="text-gray-400 hover:text-gray-600">
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
            {hasFeedback && isExpanded && (
              <div className="px-3 pb-3 prose prose-sm max-w-none border-t border-gray-100 pt-2.5 bg-white/70">
                <ReactMarkdown
                  components={{
                    p: (props) => <p className="mb-1 leading-[1.45] text-[14px] text-slate-800" {...props} />,
                    strong: (props) => <strong className="font-semibold text-slate-900" {...props} />,
                  }}
                >{capFeedback[cap.id]}</ReactMarkdown>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
