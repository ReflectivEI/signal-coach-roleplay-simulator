import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell, Sparkles, Target, Loader2, Wand2, MessageSquare, FileText, Lightbulb } from "lucide-react";
import ReactMarkdown from "react-markdown";

const TOPICS = [
  { id: "objection", label: "Objection Handling", icon: MessageSquare },
  { id: "evidence", label: "Clinical Evidence", icon: FileText },
  { id: "closing", label: "Closing Techniques", icon: Target },
  { id: "rapport", label: "Rapport Building", icon: Dumbbell },
  { id: "signals", label: "Behavioral Signals", icon: Lightbulb },
];

/* =========================
   SAFE PARSER (minimal)
========================= */
function safeParse(raw) {
  try {
    let str = typeof raw === "string" ? raw : String(raw);

    // remove ```json blocks
    str = str.replace(/^```json\n?|\n?```$/g, "").trim();

    return JSON.parse(str);
  } catch {
    return [];
  }
}

/* =========================
   NORMALIZE (minimal)
========================= */
function normalizeQuestions(data = []) {
  return data.map((q) => ({
    question: q.question,
    options: q.answers || q.options || [],
    correctIndex:
      typeof q.correctAnswerIndex === "number"
        ? q.correctAnswerIndex
        : q.correct_index,
    explanation: q.explanation || "",
  }));
}

export default function Exercises() {
  const [questions, setQuestions] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState({});
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [scenarioText, setScenarioText] = useState(null);
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);

  /* =========================
     QUIZ
  ========================= */
  const generateQuiz = async () => {
    if (!selectedTopic) return;

    setIsGenerating(true);
    setSelectedAnswers({});
    setShowResults({});

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
      const normalized = normalizeQuestions(parsed);

      setQuestions(Array.isArray(normalized) ? normalized : []);
    } catch (err) {
      console.error(err);
      setQuestions([]);
    } finally {
      setIsGenerating(false);
    }
  };

  /* =========================
     SCENARIO
  ========================= */
  const generateScenario = async () => {
    if (!selectedTopic) return;

    setIsGeneratingScenario(true);

    try {
      const prompt = `Generate a realistic pharma sales scenario about "${selectedTopic}".`;

      const res = await fetch("/api/llm/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, max_tokens: 1000 }),
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
     ANSWER SELECT
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
    <div className="p-6 max-w-4xl mx-auto">

      {/* HEADER */}
      <div className="flex items-center gap-3 mb-6">
        <Dumbbell className="text-teal-500" />
        <h1 className="text-2xl font-bold">Practice Exercises</h1>
      </div>

      {/* TOPICS */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TOPICS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedTopic(selectedTopic === t.id ? null : t.id)}
            className={`px-3 py-1 rounded-full text-xs border ${
              selectedTopic === t.id
                ? "bg-teal-500 text-white"
                : "bg-white text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ACTIONS */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Button onClick={generateQuiz} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="animate-spin" /> : "Generate Quiz"}
        </Button>

        <Button onClick={generateScenario} disabled={isGeneratingScenario}>
          {isGeneratingScenario ? <Loader2 className="animate-spin" /> : "Generate Scenario"}
        </Button>
      </div>

      {/* SCENARIO */}
      {scenarioText && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <ReactMarkdown>{scenarioText}</ReactMarkdown>
          </CardContent>
        </Card>
      )}

      {/* QUIZ */}
      {questions.map((q, qIdx) => {
        const selected = selectedAnswers[qIdx];

        return (
          <Card key={qIdx} className="mb-4">
            <CardContent className="p-4">

              <p className="font-semibold mb-3">
                {qIdx + 1}. {q.question}
              </p>

              {q.options?.map((opt, aIdx) => {
                const isCorrect = q.correctIndex === aIdx;
                const isSelected = selected === aIdx;
                const show = showResults[qIdx];

                let cls = "border p-2 rounded mb-2";

                if (show && isCorrect) cls += " bg-green-50 border-green-500";
                else if (show && isSelected) cls += " bg-red-50 border-red-400";

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

              {showResults[qIdx] && q.explanation && (
                <div className="text-sm text-gray-600 mt-2">
                  {q.explanation}
                </div>
              )}

            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
