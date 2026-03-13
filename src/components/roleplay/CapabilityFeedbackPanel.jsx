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
      const normalizedFeedback = normalizeCapabilityFeedback(feedbackText);
      setCapFeedback((prev) => ({ ...prev, [cap.id]: normalizedFeedback }));
    } catch (err) {
      console.error('Capability feedback error:', err);
      setCapFeedback((prev) => ({ ...prev, [cap.id]: 'Unable to generate feedback. Please try again.' }));
    } finally {
      setLoading((prev) => ({ ...prev, [cap.id]: false }));
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
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center mb-2">
        <Zap className="w-3.5 h-3.5 text-teal-500 mr-2" />
        <span className="font-bold text-sm text-gray-900">Overall: {(() => {
          // Calculate overall average across all capabilities
          const capIds = CAPABILITIES.map(c => c.id);
          const scores = capIds.map(id => getCapabilityAverage(id)).filter(s => typeof s === "number");
          if (scores.length === 0) return "N/A";
          return Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10 + "/5";
        })()}</span>
        <span style={{ marginLeft: '16px' }} className="text-xs text-gray-700">Capability Feedback Analysis by Behavioral Metric - click any metric below to analyze</span>
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
          <div key={cap.id} className={`rounded-lg border ${hasFeedback ? colors.result : "border-gray-200 bg-white"} overflow-hidden`}>
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>{cap.label}</span>
                {focusCaps.includes(cap.id) && <span className="text-yellow-500 text-xs">⭐</span>}
                {getCapabilityAverage(cap.id) !== null && (
                  <span className="text-xs font-semibold text-gray-500">Score {getCapabilityAverage(cap.id)}/5</span>
                )}
                {hasFeedback && (
                  <span className="text-xs text-gray-400">{cap.question}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {!hasFeedback && !isLoading && (
                  <Button
                    size="sm"
                    variant="outline"
                    className={`text-xs h-6 px-2 border ${colors.btn}`}
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
              <div className="px-3 pb-3 text-xs prose prose-xs max-w-none border-t border-gray-100 pt-2">
                <ReactMarkdown
                  components={{
                    p: (props) => <p className="mb-2 leading-6 text-slate-700" {...props} />,
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