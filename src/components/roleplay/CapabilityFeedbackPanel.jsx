// @ts-nocheck
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronUp, Zap } from "lucide-react";
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

const cleanFeedbackLine = (line = "") => String(line)
  .replace(/\*\*/g, "")
  .replace(/^[-*•]+\s*/, "")
  .replace(/^\d+[.)-]?\s*/, "")
  .replace(/^section\s*\d+\s*:\s*/i, "")
  .replace(/^[#]+\s*/, "")
  .replace(/^"|"$/g, "")
  .replace(/\s+/g, " ")
  .trim();

function parseFeedbackSections(rawFeedback = "", sectionDefs = [], fallbackKey) {
  const dividerPattern = sectionDefs
    .flatMap((def) => def.matchers)
    .map((matcher) => matcher.source)
    .join("|");

  const preparedText = String(rawFeedback)
    .replace(/\r/g, "")
    .replace(/\*\*/g, "")
    .replace(new RegExp(`\\s+((?:${dividerPattern})\\s*[:\-])`, "gi"), "\n$1")
    .trim();

  const rawLines = preparedText
    .split("\n")
    .map(cleanFeedbackLine)
    .filter(Boolean)
    .filter((line) => line !== ".." && line !== "." && line !== ":");

  const sections = Object.fromEntries(sectionDefs.map((def) => [def.key, []]));
  let currentKey = "";

  rawLines.forEach((line) => {
    const matched = sectionDefs.find((def) => def.matchers.some((matcher) => matcher.test(line)));

    if (matched) {
      currentKey = matched.key;
      const body = cleanFeedbackLine(line.replace(matched.strip, ""));
      if (body) sections[currentKey].push(body);
      return;
    }

    if (currentKey) sections[currentKey].push(line);
  });

  const hasStructuredContent = sectionDefs.some((def) => sections[def.key].length > 0);
  if (!hasStructuredContent) {
    const fallbackLines = rawLines.join(" ").trim();
    if (fallbackLines) sections[fallbackKey].push(fallbackLines);
  }

  return sectionDefs
    .map((def) => ({
      key: def.key,
      label: def.label,
      text: cleanFeedbackLine(sections[def.key].join(" ")),
    }))
    .filter((section) => section.text);
}

const OVERALL_SECTION_DEFS = [
  {
    key: "brief_rationale",
    label: OVERALL_SECTION_CANONICAL.brief_rationale,
    matchers: [/^brief\s+rationale\b/i],
    strip: /^brief\s+rationale\s*[:\-]?\s*/i,
  },
  {
    key: "strengths",
    label: OVERALL_SECTION_CANONICAL.strengths,
    matchers: [/^what\s+the\s+rep\s+did\s+well\b/i, /^strengths?\b/i],
    strip: /^(?:what\s+the\s+rep\s+did\s+well(?:\s+across\s+capabilities)?|strengths?)\s*[:\-]?\s*/i,
  },
  {
    key: "gap",
    label: OVERALL_SECTION_CANONICAL.gap,
    matchers: [/^biggest\s+cross[-\s]capability\s+gap\b/i, /^improvements?\b/i],
    strip: /^(?:biggest\s+cross[-\s]capability\s+gap\s+to\s+improve\s+next|improvements?)\s*[:\-]?\s*/i,
  },
  {
    key: "adjustment",
    label: OVERALL_SECTION_CANONICAL.adjustment,
    matchers: [/^one\s+concrete\s+adjustment\b/i, /^action\s*items?\b/i],
    strip: /^(?:one\s+concrete\s+adjustment\s+for\s+the\s+next\s+role[-\s]play|action\s*items?)\s*[:\-]?\s*/i,
  },
];

const CAPABILITY_SECTION_DEFS = [
  {
    key: "brief_rationale",
    label: FEEDBACK_SECTION_CANONICAL.brief_rationale,
    matchers: [/^brief\s+rationale\b/i],
    strip: /^brief\s+rationale\s*[:\-]?\s*/i,
  },
  {
    key: "specific_evidence",
    label: FEEDBACK_SECTION_CANONICAL.specific_evidence,
    matchers: [/^specific\s+evidence(?:\s+from\s+the\s+transcript)?\b/i],
    strip: /^specific\s+evidence(?:\s+from\s+the\s+transcript)?\s*[:\-]?\s*/i,
  },
  {
    key: "concrete_adjustment",
    label: FEEDBACK_SECTION_CANONICAL.concrete_adjustment,
    matchers: [/^(?:one\s+)?concrete\s+behavior\s+to\s+adjust\b/i],
    strip: /^(?:one\s+)?concrete\s+behavior\s+to\s+adjust\s*[:\-]?\s*/i,
  },
  {
    key: "coaching_cue",
    label: FEEDBACK_SECTION_CANONICAL.coaching_cue,
    matchers: [/^coaching\s+cue(?:\s+for\s+next\s+call)?\b/i],
    strip: /^coaching\s+cue(?:\s+for\s+next\s+call)?\s*[:\-]?\s*/i,
  },
];

const StructuredFeedbackBody = ({ sections }) => (
  <div className="space-y-1.5">
    {sections.map((section) => (
      <p key={section.key} className="text-[13px] leading-[1.45] text-slate-800">
        <span className="font-semibold text-slate-900">{section.label}:</span> {section.text}
      </p>
    ))}
  </div>
);

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
  const [overallFeedback, setOverallFeedback] = useState([]);
  const [overallLoading, setOverallLoading] = useState(false);
  const [overallExpanded, setOverallExpanded] = useState(false);

  const transcript = messages
    .map((m) => `${m.role === "user" ? "Sales Rep" : "HCP"}: ${m.content}`)
    .join("\n");

  const scoredTurns = turns.filter((t) => t.alignment?.metrics);
  const getCapabilityAverage = (capId) => {
    const scores = scoredTurns
      .map((t) => t.alignment?.metrics?.[capId]?.score)
      .filter((score) => typeof score === "number");
    if (scores.length === 0) return null;
    return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
  };

  const overallScore = (() => {
    const capIds = CAPABILITIES.map(c => c.id);
    const scores = capIds.map(id => getCapabilityAverage(id)).filter(s => typeof s === "number");
    if (scores.length === 0) return null;
    return Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10;
  })();

  const requestCapabilityFeedback = async (cap) => {
    setLoading((prev) => ({ ...prev, [cap.id]: true }));
    setExpanded((prev) => ({ ...prev, [cap.id]: true }));
    try {
      const clipTrans = transcript.substring(0, 2000);
      const deterministicScore = getCapabilityAverage(cap.id);
      const scoreLine = deterministicScore !== null
        ? `Deterministic Score (locked, do not change): ${deterministicScore}/5`
        : `Deterministic Score: not available yet`;
      const prompt = `As a sales coach, analyze this capability using the fixed deterministic score below (do NOT rescore).\nCapability: ${cap.label}\nMetric: ${cap.question}\n${scoreLine}\n\nTranscript excerpt:\n${clipTrans}\n\nProvide:\n1) Brief rationale that explains this fixed score using observable behavior\n2) Specific evidence from the transcript\n3) One concrete behavior to adjust\n4) Coaching cue for next call\n\nIMPORTANT: Do NOT output a new numeric score. Use the fixed score above.`;

      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 500 })
      });

      if (!res.ok) throw new Error('Failed to get feedback');
      const data = await res.json();
      const feedbackText = data.response || data.text || data.content || '';
      const normalizedFeedback = parseFeedbackSections(feedbackText, CAPABILITY_SECTION_DEFS, "brief_rationale");
      setCapFeedback((prev) => ({ ...prev, [cap.id]: normalizedFeedback }));
    } catch (err) {
      console.error('Capability feedback error:', err);
      setCapFeedback((prev) => ({
        ...prev,
        [cap.id]: [{ key: "brief_rationale", label: FEEDBACK_SECTION_CANONICAL.brief_rationale, text: "Unable to generate feedback. Please try again." }],
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [cap.id]: false }));
    }
  };

  const requestOverallFeedback = async () => {
    setOverallLoading(true);
    setOverallExpanded(true);
    try {
      const clipTrans = transcript.substring(0, 3000);
      const scoreLine = overallScore !== null
        ? `Overall deterministic score (locked, do not change): ${overallScore}/5`
        : "Overall deterministic score: not available yet";
      const capabilityScoreLines = CAPABILITIES
        .map((cap) => {
          const score = getCapabilityAverage(cap.id);
          return `${cap.label}: ${score !== null ? `${score}/5` : "N/A"}`;
        })
        .join("\n");
      const prompt = `As a sales coach, provide an overall session analysis using the fixed deterministic scoring summary below (do NOT rescore).\n${scoreLine}\n\nCapability score breakdown:\n${capabilityScoreLines}\n\nTranscript excerpt:\n${clipTrans}\n\nProvide:\n1) Brief rationale for the overall score using observable behavior\n2) What the rep did well across capabilities\n3) Biggest cross-capability gap to improve next\n4) One concrete adjustment for the next role-play\n\nIMPORTANT: Do NOT output a new numeric score. Use the fixed deterministic scores above.`;

      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 650 })
      });

      if (!res.ok) throw new Error('Failed to get overall feedback');
      const data = await res.json();
      const feedbackText = data.response || data.text || data.content || '';
      const normalizedFeedback = parseFeedbackSections(feedbackText, OVERALL_SECTION_DEFS, "brief_rationale");
      setOverallFeedback(
        normalizedFeedback.length > 0
          ? normalizedFeedback
          : [{ key: "brief_rationale", label: OVERALL_SECTION_CANONICAL.brief_rationale, text: "Unable to generate overall analysis. Please try again." }]
      );
    } catch (err) {
      console.error('Overall feedback error:', err);
      setOverallFeedback([{ key: "brief_rationale", label: OVERALL_SECTION_CANONICAL.brief_rationale, text: "Unable to generate overall analysis. Please try again." }]);
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
          <p className="text-xs text-gray-700">Capability feedback analysis by behavioral metric — click any metric below to analyze.</p>
          <div className="flex items-center justify-center gap-1">
            {overallFeedback.length === 0 && !overallLoading && (
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
            {overallFeedback.length > 0 && !overallLoading && (
              <button onClick={() => setOverallExpanded((prev) => !prev)} className="text-gray-500 hover:text-gray-700">
                {overallExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
        {overallFeedback.length > 0 && overallExpanded && (
          <div className="mt-2 border-t border-slate-200 pt-2.5 rounded-lg bg-white/80 px-3 py-3">
            <StructuredFeedbackBody sections={overallFeedback} />
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
        const hasFeedback = Array.isArray(capFeedback[cap.id]) && capFeedback[cap.id].length > 0;
        const isExpanded = expanded[cap.id];

        return (
          <div key={cap.id} className={`rounded-xl border ${hasFeedback ? colors.result : "border-gray-300 bg-white"} overflow-hidden shadow-sm`}>
            <div className="grid grid-cols-[1fr_110px] items-center gap-2 px-3 py-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>{cap.label}</span>
                {focusCaps.includes(cap.id) && <span className="text-yellow-500 text-xs">⭐</span>}
                {getCapabilityAverage(cap.id) !== null && (
                  <span className="text-xs font-semibold text-gray-500">Score {getCapabilityAverage(cap.id)}/5</span>
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
              <div className="px-3 pb-3 border-t border-gray-100 pt-2.5 bg-white/70">
                <StructuredFeedbackBody sections={capFeedback[cap.id]} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
