import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dumbbell,
  Target,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Wand2
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ReactMarkdown from "react-markdown";
import { formatScenarioText } from "@/lib/utils";

/* =========================
   SAFE PARSER (INLINE)
========================= */
function safeParseJSON(raw) {
  try {
    let text = String(raw || "")
      .replace(/^```json\n?|\n?```$/g, "")
      .trim();

    return JSON.parse(text);
  } catch {
    try {
      const first = raw.indexOf("[");
      const last = raw.lastIndexOf("]");
      if (first >= 0 && last > first) {
        return JSON.parse(raw.slice(first, last + 1));
      }
    } catch {}
    return null;
  }
}

/* =========================
   TOPICS
========================= */
const TOPICS = [
  { id: "objection", label: "Objection Handling" },
  { id: "evidence", label: "Clinical Evidence" },
  { id: "closing", label: "Closing Techniques" },
  { id: "rapport", label: "Rapport Building" },
  { id: "signals", label: "Behavioral Signals" },
];

export default function ExercisesPage() {
  const [exercises, setExercises] = useState([]);
  const [scenario, setScenario] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);
  const [error, setError] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [selectedTopic, setSelectedTopic] = useState(null);

  const selectedTopicLabel = useMemo(() => {
    const found = TOPICS.find((t) => t.id === selectedTopic);
    return found ? found.label : "Signal Intelligence and Life Sciences Sales";
  }, [selectedTopic]);

  const resetAll = () => {
    setExercises([]);
    setScenario(null);
    setSelectedAnswers({});
    setError(null);
  };

  const fallbackPool = [
    {
      question: "A customer says 'Your product is too expensive.' What's the BEST response?",
      options: [
        "Competitors cost more.",
        "Can you help me understand what you're comparing us to?",
        "We can discount.",
        "Quality speaks for itself."
      ],
      correctAnswer: 1,
      explanation: "Understanding context first prevents defensiveness."
    }
  ];

  const generateExercises = async () => {
    setIsGenerating(true);
    setError(null);
    setSelectedAnswers({});
    setExercises([]);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Return ONLY JSON.

Generate 5 multiple choice questions about "${selectedTopicLabel}".

Format:
[{
 "question":"...",
 "options":["A","B","C","D"],
 "correctAnswer":0,
 "explanation":"..."
}]`
        }),
        signal: controller.signal
      });

      const raw = await response.text();
      const parsed = safeParseJSON(raw);

      if (Array.isArray(parsed) && parsed.length > 0) {
        setExercises(parsed.slice(0, 5));
      } else {
        throw new Error("Bad AI response");
      }
    } catch (err) {
      console.warn("Fallback triggered:", err);
      setExercises(fallbackPool);
      setError("AI unstable. Showing fallback.");
    } finally {
      clearTimeout(timeout);
      setIsGenerating(false);
    }
  };

  const generateScenario = async () => {
    setIsGeneratingScenario(true);
    setScenario(null);

    try {
      const response = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Generate a pharma sales scenario about "${selectedTopicLabel}".`
        })
      });

      const raw = await response.text();
      setScenario(raw);
    } catch {
      setScenario("Unable to generate scenario.");
    } finally {
      setIsGeneratingScenario(false);
    }
  };

  const selectAnswer = (qIdx, optIdx) => {
    if (selectedAnswers[qIdx] !== undefined) return;
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Dumbbell className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Practice Exercises</h1>
        </div>

        <button onClick={resetAll} className="flex items-center gap-1 text-sm">
          <RefreshCw className="h-4 w-4" />
          Reset
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TOPICS.map((t) => (
          <Button
            key={t.id}
            variant={selectedTopic === t.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedTopic(selectedTopic === t.id ? null : t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Button onClick={generateExercises} disabled={isGenerating}>
          {isGenerating ? "Generating..." : "Generate Quiz"}
        </Button>

        <Button onClick={generateScenario} disabled={isGeneratingScenario}>
          {isGeneratingScenario ? "Generating..." : "Generate Scenario"}
        </Button>
      </div>

      {error && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {scenario && (
        <Card>
          <CardHeader>
            <CardTitle>Scenario</CardTitle>
          </CardHeader>
          <CardContent>
            <ReactMarkdown>{formatScenarioText(scenario)}</ReactMarkdown>
          </CardContent>
        </Card>
      )}

      {exercises.map((ex, idx) => {
        const selected = selectedAnswers[idx];
        const correct = selected === ex.correctAnswer;

        return (
          <Card key={idx}>
            <CardHeader>
              <CardTitle>{idx + 1}. {ex.question}</CardTitle>
            </CardHeader>

            <CardContent>
              <RadioGroup
                value={selected?.toString()}
                onValueChange={(v) => selectAnswer(idx, parseInt(v))}
              >
                {ex.options.map((opt, i) => {
                  let cls = "p-3 border rounded-lg";

                  if (selected !== undefined) {
                    if (i === ex.correctAnswer) cls += " bg-green-50";
                    else if (i === selected) cls += " bg-red-50";
                  }

                  return (
                    <div key={i} className={cls}>
                      <RadioGroupItem value={i.toString()} />
                      <Label>{opt}</Label>
                    </div>
                  );
                })}
              </RadioGroup>

              {selected !== undefined && (
                <Alert>
                  {correct ? <CheckCircle2 /> : <XCircle />}
                  <AlertDescription>{ex.explanation}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
