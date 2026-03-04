import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, AlertTriangle, BookOpen, Dumbbell, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function InsightsSidebar({ onSuggestedTopic, messages = [] }) {
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

  return (
    <div className="hidden xl:flex w-80 border-l border-gray-200 bg-white flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-500" />
          <h3 className="font-bold text-sm text-gray-900">Personal Insights</h3>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!insights && !isLoading && (
            <div className="text-center py-4">
              <p className="text-xs text-gray-500 mb-3">
                Analyze your chat history and role-plays to get personalized feedback on your communication patterns.
              </p>
              <Button
                size="sm"
                className="w-full bg-teal-500 hover:bg-teal-600 text-xs"
                onClick={analyzePatterns}
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Analyze My Patterns
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center py-6 gap-2 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
              <p className="text-xs">Analyzing your interactions...</p>
            </div>
          )}

          {insights?.empty && (
            <div className="text-center py-4">
              <p className="text-xs text-gray-500">
                No interaction history yet. Complete some role-plays or ask the AI Coach a few questions, then come back for personalized insights.
              </p>
            </div>
          )}

          {insights && typeof insights === 'object' && insights.proactive_tip && (
            <>
              {/* Proactive Tip */}
              {insights.proactive_tip && (
                <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                    <span className="text-xs font-semibold text-teal-700">Coaching Tip</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{insights.proactive_tip}</p>
                </div>
              )}

              {/* Communication Patterns */}
              {insights.patterns?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-700">Communication Patterns</span>
                  </div>
                  <div className="space-y-2">
                    {insights.patterns.map((p, i) => (
                      <div key={i} className={`rounded-lg p-2.5 border ${p.type === "strength" ? "bg-green-50 border-green-100" : "bg-orange-50 border-orange-100"}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Badge className={`text-xs px-1.5 py-0 ${p.type === "strength" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                            {p.type === "strength" ? "✓ Strength" : "⚠ Watch"}
                          </Badge>
                          <span className="text-xs font-medium text-gray-800">{p.title}</span>
                        </div>
                        <p className="text-xs text-gray-500">{p.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Struggle Areas */}
              {insights.struggle_areas?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-xs font-semibold text-gray-700">Potential Struggle Areas</span>
                  </div>
                  <div className="space-y-2">
                    {insights.struggle_areas.map((s, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-2.5">
                        <p className="text-xs font-medium text-gray-800 mb-0.5">{s.area}</p>
                        <p className="text-xs text-gray-500">{s.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Modules */}
              {insights.recommended_modules?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-semibold text-gray-700">Suggested Modules</span>
                  </div>
                  <div className="space-y-1.5">
                    {insights.recommended_modules.map((m, i) => (
                      <button
                        key={i}
                        onClick={() => onSuggestedTopic(`Tell me about the "${m.module}" module and how to improve`)}
                        className="w-full text-left bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg p-2.5 transition-colors"
                      >
                        <p className="text-xs font-medium text-blue-800">{m.module}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{m.reason}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Exercises */}
              {insights.recommended_exercises?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Dumbbell className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-semibold text-gray-700">Suggested Exercises</span>
                  </div>
                  <div className="space-y-1.5">
                    {insights.recommended_exercises.map((e, i) => (
                      <button
                        key={i}
                        onClick={() => onSuggestedTopic(`Create a practice exercise for me on: ${e.topic}`)}
                        className="w-full text-left bg-purple-50 hover:bg-purple-100 border border-purple-100 rounded-lg p-2.5 transition-colors"
                      >
                        <p className="text-xs font-medium text-purple-800">{e.topic}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{e.reason}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs mt-2"
                onClick={analyzePatterns}
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Refresh Analysis
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}