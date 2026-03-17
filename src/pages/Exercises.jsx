import React, { useState } from "react";
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

/* =========================
   TOPICS
========================= */
const TOPICS = [
  { id: "objection", label: "Objection Handling", icon: MessageSquare },
  { id: "evidence", label: "Clinical Evidence", icon: FileText },
  { id: "closing", label: "Closing Techniques", icon: Target },
  { id: "rapport", label: "Rapport Building", icon: Dumbbell },
  { id: "signals", label: "Behavioral Signals", icon: Lightbulb },
];

/* =========================
   SAFE PARSE
========================= */
function safeParse(raw) {
  try {
    let str = typeof raw === "string" ? raw : String(raw);
    str = str.replace(/^```json\n?|\n?```$/g, "").trim();
    return JSON.parse(str);
  } catch {
    return [];
  }
}

/* =========================
   NORMALIZE
========================= */
function normalizeQuestions(data = []) {
  return data
    .map((q) => ({
      question: q.question,
      options: q.answers || q.options || [],
      correctIndex:
        typeof q.correctAnswerIndex === "number"
          ? q.correctAnswerIndex
          : q.correct_index,
      explanation: q.explanation || "",
    }))
    .filter((q) => q.question && q.options.length === 4);
}

/* =========================
   COMPONENT
========================= */
export default function Exercises() {
  const [questions, setQuestions] = useState([]);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);

  const [selectedTopic, setSelectedTopic] = useState(null);

  const [scenarioText, setScenarioText] = useState(null);
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);

  /* =========================
     RESET
  ========================= */
  const resetQuiz = () => {
    setQuestions([]);
    setSelectedAnswers({});
    setShowResults({});
  };

  /* =========================
     GENERATE QUIZ
  ========================= */
  const generateQuiz = async () => {
    if (!selectedTopic) return;

    setIsGenerating(true);
    resetQuiz();

    try {
      const prompt = `Generate 5 multiple-choice quiz questions about "${selectedTopic}".

Return ONLY JSON:
[
  {
    "question": "...",
    "answers": ["A","B","C","D"],
    "correctAnswerIndex": 0,
    "explanation": "..."
  }
]`;

      const res = await fetch("/api/llm/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, max_tokens: 1000 }),
      });

      const data = await res.json();
      const parsed = safeParse(data.response);
      setQuestions(normalizeQuestions(parsed));
    } catch (err) {
      console.error(err);
      setQuestions([]);
    } finally {
      setIsGenerating(false);
    }
  };

  /* =========================
     GENERATE SCENARIO
  ========================= */
  const generateScenario = async () => {
    if (!selectedTopic) return;

    setIsGeneratingScenario(true);

    try {
      const res = await fetch("/api/llm/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Generate a realistic pharma sales scenario about "${selectedTopic}".`,
          max_tokens: 1000,
        }),
      });

      const data = await res.json();
      setScenarioText(String(data.response));
    } catch {
      setScenarioText("Error generating scenario.");
    } finally {
      setIsGeneratingScenario(false);
    }
  };

  /* =========================
     SELECT ANSWER
  ========================= */
  const selectAnswer = (qIdx, aIdx) => {
    if (showResults[qIdx]) return;

    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: aIdx }));
    setShowResults((prev) => ({ ...prev, [qIdx]: true }));
  };

  /* =========================
     UI
  ========================= */
  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">

      {/* HEADER */}
      <div className="flex items-center gap-3 mb-8">
        <Dumbbell className="w-7 h-7 text-teal-500" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Practice Exercises
          </h1>
        </div>
      </div>

      {/* TOPICS */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TOPICS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedTopic(selectedTopic === t.id ? null : t.id)}
            className={`px-3 py-1.5 rounded-full text-xs border ${
              selectedTopic === t.id
                ? "bg-teal-500 text-white"
                : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex gap-4 mb-6">
        <Button
          className="w-full bg-black text-white"
          onClick={generateQuiz}
          disabled={isGenerating}
        >
          {isGenerating ? <Loader2 className="animate-spin" /> : "Generate Quiz"}
        </Button>

        <Button
          className="w-full bg-black text-white"
          onClick={generateScenario}
          disabled={isGeneratingScenario}
        >
          {isGeneratingScenario ? <Loader2 className="animate-spin" /> : "Generate Scenario"}
        </Button>
      </div>

      {/* SCENARIO */}
      {scenarioText && (
        <Card className="mb-6 border">
          <CardContent className="p-6">
            <ReactMarkdown>{scenarioText}</ReactMarkdown>
          </CardContent>
        </Card>
      )}

      {/* QUIZ */}
      <div className="space-y-5">
        {questions.map((q, qIdx) => {
          const selected = selectedAnswers[qIdx];

          return (
            <Card key={qIdx} className="border shadow-sm">
              <CardContent className="p-5">

                {/* QUESTION */}
                <p className="font-semibold text-gray-900 mb-4">
                  {qIdx + 1}. {q.question}
                </p>

                {/* ANSWERS */}
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt, aIdx) => {
                    const isCorrect = q.correctIndex === aIdx;
                    const isSelected = selected === aIdx;
                    const show = showResults[qIdx];

                    let cls =
                      "px-3 py-2 text-sm rounded-md border transition";

                    if (show && isCorrect)
                      cls += " bg-green-50 border-green-500";
                    else if (show && isSelected)
                      cls += " bg-red-50 border-red-400";
                    else
                      cls += " bg-gray-100 hover:bg-gray-200";

                    return (
                      <button
                        key={aIdx}
                        onClick={() => selectAnswer(qIdx, aIdx)}
                        className={cls}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {/* EXPLANATION */}
                {showResults[qIdx] && q.explanation && (
                  <div className="mt-4 text-sm text-gray-600">
                    {q.explanation}
                  </div>
                )}

              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* REFRESH */}
      {questions.length > 0 && (
        <div className="mt-6 text-center">
          <button
            onClick={generateQuiz}
            className="flex items-center gap-2 mx-auto text-sm text-teal-600"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Quiz
          </button>
        </div>
      )}
    </div>
  );
}
