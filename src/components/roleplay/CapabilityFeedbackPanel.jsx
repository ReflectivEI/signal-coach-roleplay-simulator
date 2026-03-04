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

export default function CapabilityFeedbackPanel({ messages, scenario }) {
  const focusCaps = scenario?.focus_capabilities || [];
  const [capFeedback, setCapFeedback] = useState({});
  const [loading, setLoading] = useState({});
  const [expanded, setExpanded] = useState({});

  const transcript = messages
    .map((m) => `${m.role === "user" ? "Sales Rep" : "HCP"}: ${m.content}`)
    .join("\n");

  const requestCapabilityFeedback = async (cap) => {
    setLoading((prev) => ({ ...prev, [cap.id]: true }));
    setExpanded((prev) => ({ ...prev, [cap.id]: true }));
    try {
      const clipTrans = transcript.substring(0, 2000);
      const prompt = `As a sales coach, evaluate this capability: ${cap.label}\nMetric: ${cap.question}\n\nTranscript excerpt:\n${clipTrans}\n\nProvide: 1) Score 1-5 with rationale, 2) Specific evidence from the transcript, 3) One concrete behavior to adjust, 4) Coaching cue for next call.`;

      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 500 })
      });

      if (!res.ok) throw new Error('Failed to get feedback');
      const data = await res.json();
      setCapFeedback((prev) => ({ ...prev, [cap.id]: data.response || data.text || data.content || '' }));
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
      <div className="flex items-center gap-1.5 mb-2">
        <Zap className="w-3.5 h-3.5 text-teal-500" />
        <span className="text-xs font-semibold text-gray-700">Capability Feedback</span>
        <span className="text-xs text-gray-400">— click any to analyze</span>
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
                <ReactMarkdown>{capFeedback[cap.id]}</ReactMarkdown>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}