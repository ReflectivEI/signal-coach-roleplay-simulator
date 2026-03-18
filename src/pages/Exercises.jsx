import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dumbbell,
  Sparkles,
  Target,
  Loader2,
  Wand2,
  MessageSquare,
  FileText,
  Lightbulb,
  RefreshCw,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { formatScenarioText } from "../lib/utils";

const TOPICS = [
  { id: "objection", label: "Objection Handling", icon: MessageSquare },
  { id: "evidence", label: "Clinical Evidence", icon: FileText },
  { id: "closing", label: "Closing Techniques", icon: Target },
  { id: "rapport", label: "Rapport Building", icon: Dumbbell },
  { id: "signals", label: "Behavioral Signals", icon: Lightbulb },
];

function safeParseJsonArray(raw) {
  const text = String(raw || "")
    .replace(/^```json\n?|\n?```$/g, "")
    .trim();

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const firstBracket = text.indexOf("[");
    const lastBracket = text.lastIndexOf("]");

    if (firstBracket >= 0 && lastBracket > firstBracket) {
      try {
        const parsed = JSON.parse(text.slice(firstBracket, lastBracket + 1));
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    return [];
  }
}

function normalizeQuizQuestions(rawQuestions = []) {
  return rawQuestions
    .map((question) => {
      const prompt = String(question?.question || question?.prompt || "").trim();
      const options = (question?.answers || question?.options || question?.choices || [])
        .map((option) => String(option || "").replace(/^[A-Da-d][.)]\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 4);

      let correctIndex = Number.isInteger(question?.correctAnswerIndex)
        ? question.correctAnswerIndex
        : Number.isInteger(question?.correct_index)
          ? question.correct_index
          : Number.isInteger(question?.correctIndex)
            ? question.correctIndex
            : null;

      if (correctIndex === null && typeof question?.correctAnswer === "string") {
        const cleanAnswer = question.correctAnswer.trim();
        const letterMatch = cleanAnswer.match(/^[A-Da-d]$/);

        if (letterMatch) {
          correctIndex = letterMatch[0].toUpperCase().charCodeAt(0) - 65;
        } else {
          correctIndex = options.findIndex(
            (option) => option.toLowerCase() === cleanAnswer.toLowerCase(),
          );
        }
      }

      if (!prompt || options.length !== 4 || correctIndex == null || correctIndex < 0 || correctIndex > 3) {
        return null;
      }

      return {
        question: prompt,
        options,
        correctIndex,
        explanation: String(question?.explanation || question?.rationale || "").trim(),
      };
    })
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeLLMText(data = {}) {
  const raw = data?.response ?? data?.text ?? data?.content ?? "";

  if (typeof raw === "string") {
    return raw.replace(/^```[\w-]*\n?|\n?```$/g, "").trim();
  }

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

  const selectedTopicLabel = useMemo(
    () => TOPICS.find((topic) => topic.id === selectedTopic)?.label || "Signal Intelligence™ framework",
    [selectedTopic],
  );

  const resetExercises = () => {
    setQuestions([]);
    setSelectedAnswers({});
    setShowResults({});
    setScenarioText(null);
    setSelectedTopic(null);
  };

  const generateQuiz = async () => {
    if (!selectedTopic) {
      setQuestions([]);
      return;
    }

    setIsGenerating(true);
    setQuestions([]);
    setSelectedAnswers({});
    setShowResults({});

    try {
      const prompt = `Generate 4 or 5 multiple-choice quiz questions for pharmaceutical sales professionals about "${selectedTopicLabel}".

Every question must be grounded in Reflectiv AI's Signal Intelligence™ framework and meaningful HCP interactions. Distribute the questions across the 8 behavioral metrics when relevant, including items such as noticing behavioral signals, adapting communication style, asking purposeful follow-up questions, handling objections, building rapport, using clinical evidence appropriately, advancing the conversation, and reinforcing next-step commitments.

Requirements:
- Each question must be scenario-based and realistic for pharma field conversations with HCPs.
- Provide exactly 4 answer choices per question.
- Choices should be plausible and closely related so the learner has to think critically.
- Use concise, professional wording.
- Include one clearly correct answer.
- Include a short explanation describing why the answer is best within the Signal Intelligence™ framework.

Return ONLY valid JSON using this exact structure:
[
  {
    "question": "Question text",
    "answers": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswerIndex": 0,
    "explanation": "Why this answer is correct"
  }
]`;

      const response = await fetch("/api/llm/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, max_tokens: 1400 }),
      });

      if (!response.ok) {
        setQuestions([]);
        return;
      }

      const data = await response.json();
      const parsedQuestions = normalizeQuizQuestions(safeParseJsonArray(data?.response));
      setQuestions(parsedQuestions);
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
    setScenarioText(null);

    try {
      const prompt = `Generate a realistic sales scenario for pharmaceutical representatives learning about "${selectedTopicLabel}". The scenario should include:

1. Situation setup (HCP type, time constraint, context)
2. HCP behavioral signals (what the rep should notice)
3. The HCP's opening statement or concern
4. 2-3 follow-up questions the REP should ask
5. Common mistakes to avoid
6. Best approach and expected outcome

Make it practical, specific, and grounded in real pharma sales situations. Include real-world details like disease state, patient population, or clinical considerations where relevant.`;

      const response = await fetch("/api/llm/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, max_tokens: 1000 }),
      });

      if (response.ok) {
        const data = await response.json();
        setScenarioText(normalizeLLMText(data));
      } else {
        setScenarioText("Unable to generate scenario. Please try again.");
      }
    } catch (err) {
      console.error("Scenario generation error:", err);
      setScenarioText("Unable to generate scenario. Please try again.");
    } finally {
      setIsGeneratingScenario(false);
    }
  };

  const selectAnswer = (questionIndex, answerIndex) => {
    if (showResults[questionIndex] !== undefined) return;

    setSelectedAnswers((current) => ({ ...current, [questionIndex]: answerIndex }));
    setShowResults((current) => ({ ...current, [questionIndex]: true }));
  };

  const hasGeneratedContent = questions.length > 0 || scenarioText || selectedTopic;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Dumbbell className="w-7 h-7 text-teal-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Practice Exercises</h1>
            <p className="text-sm text-gray-500">
              Test your sales communication skills with AI-generated quiz questions and scenarios
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={resetExercises}
          disabled={!hasGeneratedContent || isGenerating || isGeneratingScenario}
          className="sm:self-center"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Reset Exercises
        </Button>
      </div>

      <div className="mb-8 rounded-xl border border-teal-100 bg-teal-50/50 p-4">
        <p className="text-sm font-medium text-gray-700 mb-3">Focus Topic</p>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((topic) => (
            <button
              key={topic.id}
              type="button"
              onClick={() => setSelectedTopic((current) => (current === topic.id ? null : topic.id))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selectedTopic === topic.id
                ? "bg-teal-500 text-white border-teal-500"
                : "bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:bg-teal-50"
                }`}
            >
              <topic.icon className="w-3 h-3" />
              {topic.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Quiz questions are tailored to the 8 behavioral metrics, Signal Intelligence™, and meaningful HCP interactions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card className="border-teal-100">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-500" />
              <CardTitle className="text-base">AI Quiz Questions</CardTitle>
            </div>
            <p className="text-sm text-gray-500">
              4-5 multiple-choice questions with A-D answers and instant coaching feedback
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full bg-teal-500 hover:bg-teal-600"
              onClick={generateQuiz}
              disabled={!selectedTopic || isGenerating || isGeneratingScenario}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" /> Generate Quiz
                </>
              )}
            </Button>
            <p className="text-xs text-gray-500">
              Best for practicing applied judgment across behavioral metrics and framework-based field conversations.
            </p>
          </CardContent>
        </Card>

        <Card className="border-teal-100">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-teal-500" />
              <CardTitle className="text-base">Practice Scenario</CardTitle>
            </div>
            <p className="text-sm text-gray-500">
              AI-written role-play setup focused on what to notice, ask, and do next
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full bg-teal-500 hover:bg-teal-600"
              onClick={generateScenario}
              disabled={!selectedTopic || isGenerating || isGeneratingScenario}
            >
              {isGeneratingScenario ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" /> Generate Scenario
                </>
              )}
            </Button>
            <p className="text-xs text-gray-500">
              Best for applying observation, questioning, and next-step planning in a live-style scenario.
            </p>
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
              <ReactMarkdown>{formatScenarioText(scenarioText)}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {questions.length === 0 && !isGenerating && !scenarioText && !isGeneratingScenario ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl">
          <Target className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Practice</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Choose a focus topic, then generate a framework-based quiz or a practice scenario.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {questions.map((question, questionIndex) => {
            const selectedAnswer = selectedAnswers[questionIndex];
            const revealResult = showResults[questionIndex];
            const answeredCorrectly = selectedAnswer === question.correctIndex;

            return (
              <Card key={`${question.question}-${questionIndex}`} className="overflow-hidden border-gray-200">
                <CardContent className="p-5">
                  <p className="font-medium text-gray-900 mb-4">
                    {questionIndex + 1}. {question.question}
                  </p>

                  <div className="space-y-2">
                    {question.options.map((option, answerIndex) => {
                      const letter = String.fromCharCode(65 + answerIndex);
                      const isSelected = selectedAnswer === answerIndex;
                      const isCorrect = question.correctIndex === answerIndex;

                      let rowClassName = "border-gray-200 bg-white hover:border-teal-300 hover:bg-teal-50 cursor-pointer";
                      let badgeClassName = "bg-slate-100 text-slate-600";

                      if (revealResult && isCorrect) {
                        rowClassName = "border-emerald-300 bg-emerald-50";
                        badgeClassName = "bg-emerald-500 text-white";
                      } else if (revealResult && isSelected && !isCorrect) {
                        rowClassName = "border-red-300 bg-red-50";
                        badgeClassName = "bg-red-500 text-white";
                      } else if (isSelected) {
                        rowClassName = "border-slate-300 bg-slate-50";
                        badgeClassName = "bg-slate-700 text-white";
                      }

                      return (
                        <button
                          key={`${questionIndex}-${answerIndex}`}
                          type="button"
                          onClick={() => selectAnswer(questionIndex, answerIndex)}
                          className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border text-sm transition-all ${rowClassName}`}
                        >
                          <span
                            className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold transition-all ${badgeClassName}`}
                          >
                            {letter}
                          </span>
                          <span className="text-gray-800">{option}</span>
                        </button>
                      );
                    })}
                  </div>

                  {revealResult && question.explanation && (
                    <div
                      className={`mt-4 rounded-lg border px-4 py-3 text-sm italic ${answeredCorrectly
                        ? "border-emerald-100 bg-emerald-50/70 text-emerald-800"
                        : "border-amber-100 bg-amber-50/80 text-amber-800"
                        }`}
                    >
                      <span className="font-medium not-italic mr-1">Explanation:</span>
                      {question.explanation}
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
