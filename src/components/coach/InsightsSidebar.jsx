import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// ...existing code...
import { Sparkles, TrendingUp, AlertTriangle, BookOpen, Dumbbell, Loader2, ChevronDown, ChevronUp } from "lucide-react";

export default function InsightsSidebar({ onSuggestedTopic, messages = [], skillLevel = "", scenarioDescriptor = "" }) {
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
          {/* ...existing code... */}
        </div>
      )}
    </div>
  );
}
