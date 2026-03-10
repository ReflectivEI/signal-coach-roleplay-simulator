import React, { useState } from "react";
import { Button } from "@/components/ui/button";
// ...existing code...
import { Sparkles, TrendingUp, Loader2, ChevronDown, ChevronUp } from "lucide-react";

export default function InsightsSidebar({ messages = [], skillLevel = "", scenarioDescriptor = "" }) {
    // Pattern analysis and insights logic is already present and correct.
    // No changes needed unless you want to further clarify UI or add a button for analyzePatterns.
  const [insights, setInsights] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const analyzePatterns = async () => {
    setIsLoading(true);
    try {
      const visibleMessages = messages.filter(m => !m.hidden);
      const callData = visibleMessages.slice(0, 20).map(m => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`).join('\n---\n');
      const prompt = `Analyze this coaching conversation for behavioral patterns and provide as JSON:\n\n${callData}\n\nReturn ONLY valid JSON (no markdown) with these fields:\n{\n  "proactive_tip": "One actionable coaching tip based on their communication",\n  "patterns": [\n    { "name": "Pattern name", "description": "What you observed" }\n  ],\n  "strengths": [\n    { "strength": "What they do well", "example": "Specific example from the conversation" }\n  ],\n  "improvement_areas": [\n    { "area": "Area to improve", "suggestion": "How to improve it" }\n  ],\n  "recommended_modules": [\n    { "module": "Module name", "reason": "Why relevant" }\n  ],\n  "recommended_exercises": [\n    { "topic": "Exercise topic", "reason": "Why helpful" }\n  ]\n}`;

      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 600, temperature: 0.8 })
      });

      if (!res.ok) throw new Error('Failed to analyze');
      const data = await res.json();
      try {
        let jsonStr = typeof data.response === 'string' ? data.response : String(data.response);
        // Strip markdown code block if present
        jsonStr = jsonStr.replace(/^```json\n?|\n?```$/g, '').trim();
        const parsed = JSON.parse(jsonStr);
        setInsights(parsed);
      } catch (e) {
        console.error('Insights parse error:', e);
        setInsights('Unable to analyze patterns at this time.');
      }
    } catch (err) {
      console.error('Pattern analysis error:', err);
      setInsights('Unable to analyze patterns at this time.');
    } finally {
      setIsLoading(false);
    }
  };

  // Color mapping for skill levels
  const skillColor = {
    Beginner: "bg-blue-100 text-blue-800 border-blue-200",
    Intermediate: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Advanced: "bg-green-100 text-green-800 border-green-200",
    Expert: "bg-purple-100 text-purple-800 border-purple-200"
  }[skillLevel] || "bg-gray-100 text-gray-800 border-gray-200";

  return (
    <div className="hidden xl:flex w-80 border-l border-gray-200 bg-white flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-500" />
          <h3 className="font-bold text-sm text-gray-900">Personal Insights</h3>
          {skillLevel && (
            <span className={`ml-2 px-2 py-0.5 rounded-full border text-xs font-semibold ${skillColor}`}>{skillLevel}</span>
          )}
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      {/* Scenario descriptor below header */}
      {scenarioDescriptor && (
        <div className="px-5 pt-2 pb-0">
          <span className="text-xs font-medium text-gray-700" style={{ color: '#232323' }}>{scenarioDescriptor}</span>
        </div>
      )}
      {expanded && (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Analyze Patterns Button */}
          <Button
            className="bg-teal-500 hover:bg-teal-600 w-full mb-2"
            onClick={analyzePatterns}
            disabled={isLoading || messages.length === 0}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <TrendingUp className="w-4 h-4 mr-2" />}
            Analyze Patterns
          </Button>
          {/* Insights Display */}
          {insights && typeof insights === 'object' ? (
            <div className="space-y-3">
              {insights.proactive_tip && (
                <div className="bg-blue-50 border border-blue-100 rounded p-2 text-xs text-blue-900 font-semibold">{insights.proactive_tip}</div>
              )}
              {Array.isArray(insights.patterns) && insights.patterns.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-gray-700 mb-1">Patterns</div>
                  <ul className="list-disc pl-5 text-xs text-gray-800">
                    {insights.patterns.map((p, i) => (
                      <li key={i}><span className="font-semibold">{p.name}:</span> {p.description}</li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(insights.strengths) && insights.strengths.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-green-700 mb-1">Strengths</div>
                  <ul className="list-disc pl-5 text-xs text-green-800">
                    {insights.strengths.map((s, i) => (
                      <li key={i}><span className="font-semibold">{s.strength}:</span> {s.example}</li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(insights.improvement_areas) && insights.improvement_areas.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-red-700 mb-1">Improvement Areas</div>
                  <ul className="list-disc pl-5 text-xs text-red-800">
                    {insights.improvement_areas.map((a, i) => (
                      <li key={i}><span className="font-semibold">{a.area}:</span> {a.suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(insights.recommended_modules) && insights.recommended_modules.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-purple-700 mb-1">Recommended Modules</div>
                  <ul className="list-disc pl-5 text-xs text-purple-800">
                    {insights.recommended_modules.map((m, i) => (
                      <li key={i}><span className="font-semibold">{m.module}:</span> {m.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(insights.recommended_exercises) && insights.recommended_exercises.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-orange-700 mb-1">Recommended Exercises</div>
                  <ul className="list-disc pl-5 text-xs text-orange-800">
                    {insights.recommended_exercises.map((e, i) => (
                      <li key={i}><span className="font-semibold">{e.topic}:</span> {e.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : insights && typeof insights === 'string' ? (
            <div className="bg-red-50 border border-red-100 rounded p-2 text-xs text-red-700">{insights}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
