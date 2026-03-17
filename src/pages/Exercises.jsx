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
   SAFE JSON PARSER
========================= */
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

/* =========================
   NORMALIZE QUIZ
========================= */
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
        if (letterMatch) {
          correctIndex = letterMatch[0].toUpperCase().charCodeAt(0) - 65;
        } else {
          correctIndex = options.findIndex(
            (o) => o.toLowerCase() === clean.toLowerCase()
          );
        }
      }

      if (!question || options.length < 4 || correctIndex == null) return null;

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

/* =========================
   🔥 FIXED NORMALIZER (CRITICAL)
========================= */
function normalizeLLMText(data = {}) {
  let raw =
    data?.response ||
    data?.text ||
    data?.content ||
    data?.choices?.[0]?.message?.content ||
    "";

  // Handle nested object responses
  if (typeof raw === "object" && raw !== null) {
    if (typeof raw.scenario === "string") return raw.scenario.trim();
    if (typeof raw.content === "string") return raw.content.trim();
    return JSON.stringify(raw, null, 2);
  }

  return String(raw)
    .replace(/^```[\w]*\n?|\n?```$/g, "")
    .trim();
}

/* =========================
   COMPONENT
========================= */
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
    () =>
      TOPICS.find((t) => t.id === selectedTopic)?.label ||
      "Signal Intelligence and Life Sciences Sales",
    [selectedTopic]
  );

  /* =========================
     GENERATE QUIZ
  ========================= */
  const generateQuiz = async () => {
    setIsGenerating(true);
    setSelectedAnswers({});
    setShowResults({});

    try {
      const prompt = `Generate exactly 5 multiple-choice quiz questions for pharmaceutical sales reps on "${selectedTopicLabel}".

Return ONLY JSON array.`;

      const res = await fetch("/api/llm/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, max_tokens: 1200 }),
      });

      if (!res.ok) {
        setQuestions([]);
        return;
      }

      const data = await res.json();

      const raw =
        data.response ||
        data.text ||
        data.content ||
        data.choices?.[0]?.message?.content ||
        "";

      const parsed = safeParseJsonArray(raw);
      const normalized = normalizeQuizQuestions(parsed);

      setQuestions(normalized);
    } catch (err) {
      console.error("Quiz error:", err);
      setQuestions([]);
    } finally {
      setIsGenerating(false);
    }
  };

  /* =========================
     GENERATE SCENARIO (FIXED)
  ========================= */
  const generateScenario = async () => {
    setIsGeneratingScenario(true);
    setScenarioText(null);

    try {
      const prompt = `Write a detailed pharmaceutical sales training scenario about "${selectedTopicLabel}".

Use markdown headings:

## Situation
## Behavioral Signals
## HCP Opening Statement
## Rep Strategy
## Common Mistakes
## Best Approach

Do NOT return JSON. Only markdown.`;

      const res = await fetch("/api/llm/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, max_tokens: 1000 }),
      });

      if (!res.ok) {
        setScenarioText("Unable to generate scenario.");
        return;
      }

      const data = await res.json();
      const scenario = normalizeLLMText(data);

      if (!scenario || scenario.length < 100) {
        setScenarioText("Scenario incomplete. Please regenerate.");
      } else {
        setScenarioText(scenario);
      }
    } catch (err) {
      console.error("Scenario error:", err);
      setScenarioText("Unable to generate scenario.");
    } finally {
      setIsGeneratingScenario(false);
    }
  };

  /* =========================
     SELECT ANSWER
  ========================= */
  const selectAnswer = (qIdx, aIdx) => {
    if (showResults[qIdx] !== undefined) return;

    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: aIdx }));
    setShowResults((prev) => ({ ...prev, [qIdx]: true }));
  };

  /* =========================
     UI
  ========================= */
  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">

      <div className="flex items-center justify-between mb-7">
        <div className="flex items-center gap-3">
          <Dumbbell className="w-7 h-7 text-teal-500" />
          <div>
            <h1 className="text-3xl font-bold">Practice Exercises</h1>
            <p className="text-sm text-gray-500">
              Interactive AI-generated quiz and scenarios
            </p>
          </div>
        </div>

        <button onClick={resetGeneratedContent}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ACTIONS */}
      <div className="grid grid-cols-2 gap-4 mb-7">
        <Button onClick={generateQuiz}>
          {isGenerating ? "Generating..." : "Generate Quiz"}
        </Button>
        <Button onClick={generateScenario}>
          {isGeneratingScenario ? "Generating..." : "Generate Scenario"}
        </Button>
      </div>

      {/* SCENARIO */}
      {scenarioText && (
        <Card className="mb-7">
          <CardContent className="p-6">
            <ReactMarkdown className="prose">
              {formatScenarioText(scenarioText)}
            </ReactMarkdown>
          </CardContent>
        </Card>
      )}

      {/* QUIZ */}
      {questions.map((q, qIdx) => {
        const selectedIdx = selectedAnswers[qIdx];
        const isCorrect = selectedIdx === q.correctIndex;

        return (
          <Card key={qIdx} className="mb-4">
            <CardContent className="p-5">
              <p className="font-semibold mb-4">
                {qIdx + 1}. {q.question}
              </p>

              {q.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => selectAnswer(qIdx, i)}
                  className="block w-full text-left p-2 border rounded mb-2"
                >
                  {opt}
                </button>
              ))}

              {showResults[qIdx] && (
                <div className="mt-3 text-sm">
                  {isCorrect ? "Correct" : "Incorrect"} — {q.explanation}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
