// @ts-nocheck

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell, Sparkles, Target, Loader2, Wand2, MessageSquare, FileText, Lightbulb } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { formatScenarioText } from "../lib/utils";


function RefreshIcon({ className = "" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 2v6h6" />
      <path d="M21 12A9 9 0 0 0 6 5.3L3 8" />
      <path d="M21 22v-6h-6" />
      <path d="M3 12a9 9 0 0 0 15 6.7L21 16" />
    </svg>
  );
}

const TOPICS = [
  { id: "objection", label: "Objection Handling", icon: MessageSquare },
  { id: "evidence", label: "Clinical Evidence", icon: FileText },
  { id: "closing", label: "Closing Techniques", icon: Target },
  { id: "rapport", label: "Rapport Building", icon: Dumbbell },
  { id: "signals", label: "Behavioral Signals", icon: Lightbulb },
];

function safeParseJsonArray(raw) {
  const text = String(raw || "").replace(/^```json\n?|\n?```$/g, "").trim();
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const first = text.indexOf("[");
    const last = text.lastIndexOf("]");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(text.slice(first, last + 1));
      } catch {
        return [];
      }
    }
    return [];
  }
}

function normalizeQuizQuestions(rawQuestions = []) {
  return rawQuestions
    .map((q) => {
      const question = q.question || q.prompt || "";
      const options = (q.answers || q.options || q.choices || [])
        .map((opt) => String(opt).replace(/^[A-Da-d][.)]\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 4);

      let correctIndex = Number.isInteger(q.correctAnswerIndex)
        ? q.correctAnswerIndex
        : Number.isInteger(q.correct_index)
          ? q.correct_index
          : null;

      if (correctIndex === null && typeof q.correctAnswer === "string") {
        const clean = q.correctAnswer.trim();
        const letterMatch = clean.match(/^[A-Da-d]$/);
        if (letterMatch) correctIndex = letterMatch[0].toUpperCase().charCodeAt(0) - 65;
        else correctIndex = options.findIndex((o) => o.toLowerCase() === clean.toLowerCase());
      }

      if (!question || options.length < 4 || correctIndex == null || correctIndex < 0 || correctIndex > 3) return null;

      return {
        question,
        options,
        correctIndex,
        explanation: q.explanation || q.rationale || "",
      };
    })
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeLLMText(data = {}) {
  const raw = data?.response ?? data?.text ?? data?.content ?? "";
  if (typeof raw === "string") return raw.replace(/^```[\w]*\n?|\n?```$/g, "").trim();
  if (raw && typeof raw === "object") {
    if (typeof raw.scenario === "string") return raw.scenario.trim();
    if (typeof raw.content === "string") return raw.content.trim();
    return JSON.stringify(raw, null, 2).trim();
  }
  return String(raw || "").trim();
}

export default function Exercises() {
  const [questions, setQuestions] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState({});
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [scenarioText, setScenarioText] = useState(null);
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);

  const resetGeneratedContent = () => {
    setQuestions([]);
    setScenarioText(null);
    setSelectedAnswers({});
    setShowResults({});
  };

  const selectedTopicLabel = useMemo(
    () => TOPICS.find((t) => t.id === selectedTopic)?.label || "Signal Intelligence and Life Sciences Sales",
    [selectedTopic]
  );

  const generateQuiz = async () => {
    setIsGenerating(true);
    setSelectedAnswers({});
    setShowResults({});
    try {
      const prompt = `Generate exactly 5 multiple-choice quiz questions for pharmaceutical sales reps on this focus topic: "${selectedTopicLabel}".

Requirements:
- AI-driven and practical, scenario-based where possible
- Aligned to Signal Intelligence capabilities and life sciences sales best practices
- 4 options per question (A/B/C/D)
- Include one correct option index (0-3)
- Include a concise 1-2 sentence explanation for learning feedback

Return ONLY valid JSON array with this exact schema:
[
  {
    "question": "...",
    "answers": ["...", "...", "...", "..."],
    "correctAnswerIndex": 0,
    "explanation": "..."
  }
]`;

      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 1400 })
      });

      if (!res.ok) {
        setQuestions([]);
        return;
      }

      const data = await res.json();
      const parsed = safeParseJsonArray(data.response || data.text || data.content || "");
      const normalized = normalizeQuizQuestions(parsed);
      setQuestions(normalized);
    } catch (err) {
      console.error('Quiz generation error:', err);
      setQuestions([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateScenario = async () => {
    setIsGeneratingScenario(true);
    try {
      const prompt = `Generate a realistic sales scenario for pharmaceutical representatives learning about "${selectedTopicLabel}". The scenario should include:

1. Situation setup (HCP type, time constraint, context)
2. HCP behavioral signals (what the rep should notice)
3. The HCP's opening statement or concern
4. 2-3 follow-up questions the REP should ask
5. Common mistakes to avoid
6. Best approach and expected outcome

Make it practical, specific, and grounded in real pharma sales situations. Include real-world details like disease state, patient population, or clinical considerations where relevant.`;
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 1000 })
      });
      if (res.ok) {
        const data = await res.json();
        const scenario = normalizeLLMText(data);
        setScenarioText(scenario || "Unable to generate scenario. Please try again.");
      } else {
        setScenarioText("Unable to generate scenario. Please try again.");
      }
    } catch (err) {
      console.error('Scenario generation error:', err);
      setScenarioText("Unable to generate scenario. Please try again.");
    } finally {
      setIsGeneratingScenario(false);
    }
  };

  const selectAnswer = (qIdx, aIdx) => {
    if (showResults[qIdx] !== undefined) return;
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: aIdx }));
    setShowResults((prev) => ({ ...prev, [qIdx]: true }));
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-7 rounded-[28px] border border-slate-200 bg-gradient-to-r from-[#0f172a] via-[#13263f] to-[#154955] p-6 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 shadow-inner">
                <Dumbbell className="w-6 h-6 text-teal-200" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-200">Practice lab</p>
                <h1 className="mt-1 text-3xl font-bold text-white">Practice Exercises</h1>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200">
              Build repetition with focused AI-generated quiz drills and role-play scenarios, now styled to match the enterprise-grade hub experience.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Field-ready drills", "Signal Intelligence aligned", "Scenario-based practice"].map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 self-start">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
              <div className="text-xl font-bold text-white">{TOPICS.length}</div>
              <div className="text-xs text-slate-300">focus lanes</div>
            </div>
            <button
              type="button"
              onClick={resetGeneratedContent}
              className="rounded-full border border-teal-200 bg-white/10 p-2.5 text-teal-100 hover:-translate-y-0.5 hover:border-white hover:bg-white/15 transition-all"
              title="Reset generated quiz and scenario"
              disabled={isGenerating || isGeneratingScenario}
            >
              <RefreshIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mb-7 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Focus Topic (optional)</p>
        <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TOPICS.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTopic(selectedTopic === t.id ? null : t.id)}
              className={`flex min-w-0 shrink-0 basis-[19%] items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold border transition-all whitespace-nowrap ${selectedTopic === t.id
                ? "bg-teal-500 text-white border-teal-500"
                : "bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:bg-teal-50"
                }`}
            >
              <t.icon className="w-3 h-3 flex-shrink-0" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-7 items-stretch">
        <Card className="border-teal-200 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-teal-500" />
                <CardTitle className="text-base">AI Quiz Questions</CardTitle>
              </div>
              <button
                type="button"
                onClick={generateQuiz}
                className="rounded-md p-1.5 border border-gray-200 hover:border-teal-300 hover:bg-teal-50"
                title="Refresh quiz"
                disabled={isGenerating}
              >
                <RefreshIcon className={`w-3.5 h-3.5 text-teal-600 ${isGenerating ? "animate-spin" : ""}`} />
              </button>
            </div>
            <p className="text-sm text-gray-500">AI-generated multiple choice questions with instant feedback</p>
          </CardHeader>
          <CardContent className="mt-auto pt-0">
            <Button className="w-full bg-teal-500 hover:bg-teal-600 border border-teal-500" onClick={generateQuiz} disabled={isGenerating}>
              {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4 mr-2" /> Generate Quiz</>}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-teal-200 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-teal-500" />
                <CardTitle className="text-base">Practice Scenario</CardTitle>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={generateScenario}
                  className="rounded-md p-1.5 border border-gray-200 hover:border-teal-300 hover:bg-teal-50"
                  title="Refresh scenario"
                  disabled={isGeneratingScenario}
                >
                  <RefreshIcon className={`w-3.5 h-3.5 text-teal-600 ${isGeneratingScenario ? "animate-spin" : ""}`} />
                </button>
                <span className="rounded-full border border-[#1A334D] px-2 py-0.5 text-[11px] font-semibold text-[#1A334D]">AI</span>
              </div>
            </div>
            <p className="text-sm text-gray-500">AI-generated role-play scenario with coaching prompts</p>
          </CardHeader>
          <CardContent className="mt-auto pt-0">
            <Button className="w-full bg-teal-500 hover:bg-teal-600 border border-teal-500" onClick={generateScenario} disabled={isGeneratingScenario}>
              {isGeneratingScenario ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : <><Wand2 className="w-4 h-4 mr-2" /> Generate Scenario</>}
            </Button>
          </CardContent>
        </Card>
      </div>

      {scenarioText && (
        <Card className="mb-7 border-teal-100 shadow-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-teal-500" />
              <h3 className="font-semibold text-gray-900">Practice Scenario</h3>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed space-y-3">
              <ReactMarkdown>{formatScenarioText(scenarioText)}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {questions.length === 0 && !isGenerating && !scenarioText && !isGeneratingScenario ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-200">
          <Target className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Practice</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Pick a focus topic (optional), then generate AI quiz questions or a tailored practice scenario.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {questions.map((q, qIdx) => {
            const selectedIdx = selectedAnswers[qIdx];
            const isCorrectSelected = selectedIdx === q.correctIndex;

            return (
              <Card key={qIdx} className="overflow-hidden border-gray-200 shadow-sm">
                <CardContent className="p-5">
                  <p className="font-semibold text-gray-900 mb-4">{qIdx + 1}. {q.question}</p>
                  <div className="space-y-2">
                    {q.options.map((opt, aIdx) => {
                      const isSelected = selectedIdx === aIdx;
                      const isCorrect = q.correctIndex === aIdx;
                      const showResult = showResults[qIdx];
                      const letter = String.fromCharCode(65 + aIdx);

                      let rowCls = "border-gray-200 bg-white hover:border-teal-400 hover:bg-teal-50 cursor-pointer";
                      let labelCls = "bg-slate-100 text-slate-600";

                      if (showResult && isCorrect) {
                        rowCls = "border-green-500 bg-green-50";
                        labelCls = "bg-green-600 text-white";
                      } else if (showResult && isSelected && !isCorrect) {
                        rowCls = "border-red-400 bg-red-50";
                        labelCls = "bg-red-500 text-white";
                      }

                      return (
                        <button
                          key={aIdx}
                          onClick={() => selectAnswer(qIdx, aIdx)}
                          className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border text-sm transition-all ${rowCls}`}
                        >
                          <span className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold transition-all ${labelCls}`}>
                            {letter}
                          </span>
                          <span className="text-gray-800">{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {showResults[qIdx] && q.explanation && (
                    <div className={`mt-4 p-3 rounded-lg border text-sm italic ${isCorrectSelected ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
                      {q.explanation}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
