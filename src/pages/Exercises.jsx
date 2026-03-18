import React, { useState } from "react";
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

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   icon: React.ComponentType<{ className?: string }>,
 * }} Topic
 */

/**
 * @typedef {{
 *   question: string,
 *   options: string[],
 *   correct_index: number,
 *   explanation?: string,
 * }} QuizQuestion
 */

/**
 * @typedef {{
 *   question?: unknown,
 *   options?: unknown,
 *   answers?: unknown,
 *   correct_index?: unknown,
 *   correctAnswerIndex?: unknown,
 *   explanation?: unknown,
 * }} RawQuizQuestion
 */

/** @type {Topic[]} */
const TOPICS = [
  { id: "objection", label: "Objection Handling", icon: MessageSquare },
  { id: "evidence", label: "Clinical Evidence", icon: FileText },
  { id: "closing", label: "Closing Techniques", icon: Target },
  { id: "rapport", label: "Rapport Building", icon: Dumbbell },
  { id: "signals", label: "Behavioral Signals", icon: Lightbulb },
];

/**
 * @param {unknown} value
 * @returns {QuizQuestion[]}
 */
const normalizeQuizResponse = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const raw = /** @type {RawQuizQuestion} */ (item);
    const optionSource = Array.isArray(raw.options)
      ? raw.options
      : Array.isArray(raw.answers)
        ? raw.answers
        : [];
    const options = optionSource
      .filter((option) => typeof option === "string")
      .map((option) => option.trim())
      .filter(Boolean);
    const correctIndex = typeof raw.correct_index === "number"
      ? raw.correct_index
      : typeof raw.correctAnswerIndex === "number"
        ? raw.correctAnswerIndex
        : -1;

    if (
      typeof raw.question !== "string" ||
      !raw.question.trim() ||
      options.length === 0 ||
      correctIndex < 0 ||
      correctIndex >= options.length
    ) {
      return [];
    }

    return [{
      question: raw.question.trim(),
      options,
      correct_index: correctIndex,
      explanation: typeof raw.explanation === "string" ? raw.explanation.trim() : undefined,
    }];
  });
};

export default function Exercises() {
  const [questions, setQuestions] = useState(/** @type {QuizQuestion[]} */ ([]));
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState(/** @type {Record<number, number>} */ ({}));
  const [showResults, setShowResults] = useState(/** @type {Record<number, boolean>} */ ({}));
  const [selectedTopic, setSelectedTopic] = useState(/** @type {string | null} */ (null));
  const [scenarioText, setScenarioText] = useState(/** @type {string | null} */ (null));
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
    if (!selectedTopic) {
      setQuestions([]);
      return;
    }

    setIsGenerating(true);

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

Make questions practical and scenario-based where possible.`;
      const res = await fetch("/api/llm/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, max_tokens: 1000 }),
      });

      if (!res.ok) {
        setQuestions([]);
        return;
      }

      /** @type {{ response?: unknown }} */
      const data = await res.json();
      const jsonStr = typeof data.response === "string" ? data.response : String(data.response ?? "");

      try {
        const parsed = JSON.parse(jsonStr);
        setQuestions(normalizeQuizResponse(parsed));
      } catch {
        setQuestions([]);
        return;
      }

      const data = await res.json();
      const parsed = safeParseJsonArray(data.response || data.text || data.content || "");
      const normalized = normalizeQuizQuestions(parsed);
      setQuestions(normalized);
    } catch (err) {
      console.error("Quiz generation error:", err);
      setQuestions([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateScenario = async () => {
    if (!selectedTopic) {
      setScenarioText(null);
      return;
    }

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
      const res = await fetch("/api/llm/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, max_tokens: 1000 }),
      });

      if (!res.ok) {
        setScenarioText("Unable to generate scenario. Please try again.");
        return;
      }

      /** @type {{ response?: unknown }} */
      const data = await res.json();
      setScenarioText(typeof data.response === "string" ? data.response : String(data.response ?? ""));
    } catch (err) {
      console.error("Scenario generation error:", err);
      setScenarioText("Unable to generate scenario. Please try again.");
    } finally {
      setIsGeneratingScenario(false);
    }
  };

  /**
   * @param {number} qIdx
   * @param {number} aIdx
   */
  const selectAnswer = (qIdx, aIdx) => {
    if (showResults[qIdx] !== undefined) {
      return;
    }

    setSelectedAnswers((current) => ({ ...current, [qIdx]: aIdx }));
    setShowResults((current) => ({ ...current, [qIdx]: true }));
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-7">
        <div className="flex items-center gap-3">
          <Dumbbell className="w-7 h-7 text-teal-500" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Practice Exercises</h1>
            <p className="text-sm text-gray-500">Interactive, AI-generated quiz drills and role-play scenarios</p>
          </div>
        </div>
        <button
          type="button"
          onClick={resetGeneratedContent}
          className="rounded-full border border-[#1A334D] bg-white p-2 text-[#1A334D] hover:-translate-y-0.5 hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] transition-all"
          title="Reset generated quiz and scenario"
          disabled={isGenerating || isGeneratingScenario}
        >
          <RefreshIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="mb-8">
        <p className="text-sm font-medium text-gray-700 mb-3">Focus Topic (optional)</p>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((topic) => {
            const isSelected = selectedTopic === topic.id;
            const TopicIcon = topic.icon;

            return (
              <button
                key={topic.id}
                onClick={() => setSelectedTopic(isSelected ? null : topic.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${isSelected
                  ? "bg-teal-500 text-white border-teal-500"
                  : "bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:bg-teal-50"
                  }`}
              >
                <TopicIcon className="w-3 h-3" />
                {topic.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card className="border-teal-100">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-500" />
              <CardTitle className="text-base">AI Quiz Questions</CardTitle>
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
          {questions.map((question, qIdx) => (
            <Card key={qIdx} className="overflow-hidden">
              <CardContent className="p-5">
                <p className="font-medium text-gray-900 mb-4">{qIdx + 1}. {question.question}</p>
                <div className="space-y-2">
                  {question.options.map((option, aIdx) => {
                    const isSelected = selectedAnswers[qIdx] === aIdx;
                    const isCorrect = question.correct_index === aIdx;
                    const showResult = showResults[qIdx];
                    const letter = String.fromCharCode(65 + aIdx);
                    const cleanOption = option.replace(/^[A-Da-d][.)]\s*/, "").trim();

                    let rowCls = "border-gray-200 bg-white hover:border-teal-400 hover:bg-teal-50 cursor-pointer";
                    let labelCls = "bg-slate-100 text-slate-600";
                    if (showResult && isCorrect) {
                      rowCls = "border-teal-400 bg-teal-50";
                      labelCls = "bg-teal-500 text-white";
                    } else if (showResult && isSelected && !isCorrect) {
                      rowCls = "border-red-300 bg-red-50";
                      labelCls = "bg-red-400 text-white";
                    } else if (isSelected) {
                      rowCls = "border-navy-500 bg-slate-50";
                      labelCls = "bg-slate-700 text-white";
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
                        <span className="text-gray-800">{cleanOption}</span>
                      </button>
                    );
                  })}
                </div>
                {showResults[qIdx] && question.explanation && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-gray-600">
                    <strong>Explanation:</strong> {question.explanation}
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
