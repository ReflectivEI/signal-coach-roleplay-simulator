import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell, Sparkles, Target, Loader2, Wand2, MessageSquare, FileText, Lightbulb } from "lucide-react";
import ReactMarkdown from "react-markdown";

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

  const generateQuiz = async () => {
    if (!selectedTopic) {
      setQuestions([]);
      return;
    }

    setIsGenerating(true);

    try {
      const prompt = `Generate a 5-question quiz about "${selectedTopic}" for pharmaceutical sales professionals. Each question should test knowledge of Signal Intelligence™ capabilities and sales techniques.

Format the response as a JSON array with this structure:
[
  {
    "question": "Question text",
    "answers": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswerIndex": 0,
    "explanation": "Why this is correct"
  }
]

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
      }
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
      const prompt = `Generate a realistic sales scenario for pharmaceutical representatives learning about "${selectedTopic}". The scenario should include:

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
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Dumbbell className="w-7 h-7 text-teal-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Practice Exercises</h1>
          <p className="text-sm text-gray-500">Test your sales communication skills with interactive quiz questions</p>
        </div>
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
            <p className="text-sm text-gray-500">Multiple-choice questions with instant feedback</p>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full bg-teal-500 hover:bg-teal-600"
              onClick={generateQuiz}
              disabled={isGenerating || isGeneratingScenario}
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Generate Quiz</>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-teal-100">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-teal-500" />
              <CardTitle className="text-base">Practice Scenario</CardTitle>
            </div>
            <p className="text-sm text-gray-500">AI-written role-play scenario with response options</p>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full bg-teal-500 hover:bg-teal-600"
              onClick={generateScenario}
              disabled={isGenerating || isGeneratingScenario}
            >
              {isGeneratingScenario ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Wand2 className="w-4 h-4 mr-2" /> Generate Scenario</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {scenarioText && (
        <Card className="mb-8 border-teal-100">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-teal-500" />
              <h3 className="font-semibold text-gray-900">Practice Scenario</h3>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed space-y-3">
              <ReactMarkdown>{scenarioText}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {questions.length === 0 && !isGenerating && !scenarioText && !isGeneratingScenario ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl">
          <Target className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Practice</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Select an optional topic above, then generate a quiz or a practice scenario.
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
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
