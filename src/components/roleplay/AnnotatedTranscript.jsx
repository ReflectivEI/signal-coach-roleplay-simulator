// @ts-nocheck
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Highlighter } from "lucide-react";
import { SIGNAL_CAPABILITIES } from "./signalIntelligenceSOT";

/**
 * @typedef {{ role: string, content: string, hidden?: boolean }} TranscriptMessage
 * @typedef {{ index?: number, capability?: string, type?: string, note?: string }} TranscriptAnnotation
 */

// Color coding per capability - dynamically built from SOT
const CAP_COLORS = Object.fromEntries(
  SIGNAL_CAPABILITIES.map(c => [
    c.id,
    {
      bg: `bg-${c.color}-100`,
      border: `border-${c.color}-300`,
      text: `text-${c.color}-800`,
      label: c.label,
      dot: `bg-${c.color}-400`
    }
  ])
);

/** @param {{ messages: TranscriptMessage[], scenario?: any }} props */
export default function AnnotatedTranscript({ messages, scenario }) {
  const [annotations, setAnnotations] = useState(null); // { [messageIndex]: { capability, type, note } }
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const runAnnotation = async () => {
    setIsAnalyzing(true);
    const userMessages = messages
      .map((m, i) => ({ index: i, role: m.role, content: m.content }))
      .filter((m) => m.role === "user");

    if (userMessages.length === 0) { setIsAnalyzing(false); return; }

    try {
      const messageText = userMessages.map(m => `[${m.index}] ${m.content}`).join('\n');
      const capabilityIds = SIGNAL_CAPABILITIES.map(c => c.id).join(', ');
      const prompt = `Annotate these sales rep messages for behavioral signals. Identify the primary capability demonstrated (${capabilityIds}) and whether it's a strength or concern.\n\n${messageText}\n\nReturn JSON with array: [{index, capability, type: "strength"|"concern", note: "short phrase"}]`;

      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!res.ok) throw new Error('Failed to annotate');
      const result = await res.json();
      const map = {};
      const rawText = result.response || result.text || result.content || '';
      let parsed = [];
      try {
        const jsonStr = typeof rawText === 'string' ? rawText : String(rawText);
        const match = jsonStr.match(/\[[\s\S]*\]/);
        if (match) parsed = JSON.parse(match[0]);
      } catch { parsed = []; }
      (parsed || []).forEach((a) => { if (a?.index !== undefined) map[a.index] = a; });
      // Deduplicate repeated notes for same capability/type
      const deduped = {};
      Object.values(map).forEach((ann) => {
        const key = `${ann.capability}-${ann.type}-${ann.note}`;
        if (!Object.values(deduped).some(d => `${d.capability}-${d.type}-${d.note}` === key)) {
          deduped[ann.index] = ann;
        }
      });
      setAnnotations(deduped);
    } catch (err) {
      console.error('Annotation error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const hasUserMessages = messages.filter((m) => m.role === "user").length >= 2;

  return (
    <div className="flex flex-col h-full">
      {/* Annotate button */}
      {!annotations && hasUserMessages && (
        <div className="px-4 pt-2 pb-1">
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs border-teal-200 text-teal-600 hover:bg-teal-50"
            onClick={runAnnotation}
            disabled={isAnalyzing}
          >
            {isAnalyzing
              ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Annotating transcript...</>
              : <><Highlighter className="w-3 h-3 mr-1" />Highlight Signal Intelligence moments</>
            }
          </Button>
        </div>
      )}

      {/* Legend */}
      {annotations && (
        <div className="px-4 pt-2 pb-1 flex flex-wrap gap-1.5">
          {Object.entries(CAP_COLORS).map(([id, c]) => (
            <span key={id} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
              {c.label}
            </span>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => {
          const annotation = annotations?.[i];
          const capStyle = annotation ? CAP_COLORS[annotation.capability] : null;

          return (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold mr-2 flex-shrink-0 mt-1">
                  HCP
                </div>
              )}
              <div className="max-w-[82%] flex flex-col gap-1">
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed transition-all ${msg.role === "user"
                    ? annotation
                      ? `border-2 ${capStyle.border} ${capStyle.bg} ${capStyle.text} font-medium`
                      : "bg-teal-500 text-white"
                    : "bg-gray-100 text-gray-800"
                    }`}
                >
                  {msg.content}
                </div>
                {annotation && (
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${capStyle.bg} ${capStyle.text} self-end`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${capStyle.dot} ${annotation.type === "strength" ? "" : "opacity-60"}`} />
                    <span className="text-xs font-semibold">{capStyle.label}</span>
                    <span className={`text-xs px-1 py-0 rounded font-medium ${annotation.type === "strength" ? "bg-green-200 text-green-800" : "bg-red-200 text-red-800"}`}>
                      {annotation.type === "strength" ? "✓" : "⚠"}
                    </span>
                    <span className="text-xs opacity-75">{annotation.note}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}