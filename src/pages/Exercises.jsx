import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell, Sparkles, Target, Info, Loader2, Wand2, MessageSquare, FileText, Lightbulb, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { formatScenarioText } from "../lib/utils";

const TOPICS = [
  { id: "objection", label: "Objection Handling", icon: MessageSquare },
  { id: "evidence", label: "Clinical Evidence", icon: FileText },
  { id: "closing", label: "Closing Techniques", icon: Target },
  { id: "rapport", label: "Rapport Building", icon: Dumbbell },
  { id: "signals", label: "Behavioral Signals", icon: Lightbulb },
];

export default function Exercises() {
  const [questions, setQuestions] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState({});
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [scenarioText, setScenarioText] = useState(null);
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);

  /* =========================
     RESET (GLOBAL)
  ========================= */
  const resetAll = () => { // ✅ NEW
    setQuestions([]);
    setSelectedAnswers({});
    setShowResults({});
    setScenarioText(null);
  };

  const resetQuiz = () => { // ✅ NEW
    setQuestions([]);
    setSelectedAnswers({});
    setShowResults({});
  };

  /* =========================
     SAFE PARSE + NORMALIZE
  ========================= */
  const parseQuiz = (raw) => { // ✅ NEW
    try {
      let str = typeof raw === "string" ? raw : String(raw);
      str = str.replace(/^```json\n?|\n?```$/g, "").trim();
      const parsed = JSON.parse(str);

      return (parsed || []).map(q => ({
        question: q.question,
        options: q.answers || q.options || [],
        correct_index:
          typeof q.correctAnswerIndex === "number"
            ? q.correctAnswerIndex
            : q.correct_index,
        explanation: q.explanation || ""
      })).filter(q => q.options.length === 4);
    } catch {
      return [];
    }
  };

  /* =========================
     GENERATE QUIZ
  ========================= */
  const generateQuiz = async () => {
    if (!selectedTopic) {
      resetQuiz();
      return;
    }

    setIsGenerating(true);
    resetQuiz(); // ✅ ensures clean state

    try {
      const prompt = `Generate 5 multiple-choice quiz questions about "${selectedTopic}" for pharmaceutical sales professionals.

Return ONLY JSON:
[
  {
    "question": "...",
    "answers": ["A","B","C","D"],
    "correctAnswerIndex": 0,
    "explanation": "..."
  }
]`;

      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 1000 })
      });

      if (res.ok) {
        const data = await res.json();
        setQuestions(parseQuiz(data.response)); // ✅ normalized
      } else {
        setQuestions([]);
      }
    } catch {
      setQuestions([]);
    } finally {
      setIsGenerating(false);
    }
  };

  /* =========================
     GENERATE SCENARIO
  ========================= */
  const generateScenario = async () => {
    if (!selectedTopic) {
      setScenarioText(null);
      return;
    }

    setIsGeneratingScenario(true);

    try {
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Generate a realistic pharma sales scenario about "${selectedTopic}" with behavioral signals, objections, and best response strategy.`,
          max_tokens: 1000
        })
      });

      if (res.ok) {
        const data = await res.json();
        setScenarioText(String(data.response));
      } else {
        setScenarioText("Unable to generate scenario.");
      }
    } catch {
      setScenarioText("Unable to generate scenario.");
    } finally {
      setIsGeneratingScenario(false);
    }
  };

  /* =========================
     SELECT ANSWER
  ========================= */
  const selectAnswer = (qIdx, aIdx) => {
    if (showResults[qIdx]) return;
    setSelectedAnswers(prev => ({ ...prev, [qIdx]: aIdx }));
    setShowResults(prev => ({ ...prev, [qIdx]: true }));
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Dumbbell className="w-7 h-7 text-teal-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Practice Exercises</h1>
            <p className="text-sm text-gray-500">Test your sales communication skills</p>
          </div>
        </div>

        {/* RESET BUTTON */}
        <button onClick={resetAll} className="text-sm text-gray-500 hover:text-teal-600 flex items-center gap-1"> {/* ✅ NEW */}
          <RefreshCw className="w-4 h-4" />
          Reset
        </button>
      </div>

      {/* TOPICS */}
      <div className="mb-8">
        <p className="text-sm font-medium text-gray-700 mb-3">Focus Topic (optional)</p>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTopic(selectedTopic === t.id ? null : t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                selectedTopic === t.id
                  ? "bg-teal-500 text-white border-teal-500"
                  : "bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:bg-teal-50"
              }`}
            >
              <t.icon className="w-3 h-3" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* GENERATE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">

        <Card className="border-teal-100">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-500" />
              AI Quiz Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-teal-500 hover:bg-teal-600" onClick={generateQuiz}>
              {isGenerating ? <Loader2 className="animate-spin" /> : "Generate Quiz"}
            </Button>

            {/* REFRESH QUIZ */}
            {questions.length > 0 && ( // ✅ NEW
              <button onClick={generateQuiz} className="mt-3 text-xs text-teal-600">
                Refresh Quiz
              </button>
            )}
          </CardContent>
        </Card>

        <Card className="border-teal-100">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-teal-500" />
              Practice Scenario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-teal-500 hover:bg-teal-600" onClick={generateScenario}>
              {isGeneratingScenario ? <Loader2 className="animate-spin" /> : "Generate Scenario"}
            </Button>
          </CardContent>
        </Card>

      </div>

      {/* SCENARIO */}
      {scenarioText && (
        <Card className="mb-8 border-teal-100">
          <CardContent className="p-6">
            <ReactMarkdown>{formatScenarioText(scenarioText)}</ReactMarkdown>
          </CardContent>
        </Card>
      )}

      {/* QUESTIONS */}
      <div className="space-y-5">
        {questions.map((q, qIdx) => (
          <Card key={qIdx}>
            <CardContent className="p-5">
              <p className="font-medium mb-4">{qIdx + 1}. {q.question}</p>

              <div className="space-y-2">
                {q.options.map((opt, aIdx) => {
                  const isSelected = selectedAnswers[qIdx] === aIdx;
                  const isCorrect = q.correct_index === aIdx;
                  const show = showResults[qIdx];

                  let cls = "border p-3 rounded-lg text-sm";

                  if (show && isCorrect) cls += " bg-green-50 border-green-400";
                  else if (show && isSelected) cls += " bg-red-50 border-red-400";
                  else cls += " bg-white hover:bg-teal-50";

                  return (
                    <button key={aIdx} onClick={() => selectAnswer(qIdx, aIdx)} className={cls}>
                      {opt}
                    </button>
                  );
                })}
              </div>

              {showResults[qIdx] && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
                  <strong>Explanation:</strong> {q.explanation}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  );
}
