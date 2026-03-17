import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { apiRequest } from "@/lib/queryClient";
import { normalizeAIResponse } from "@/lib/normalizeAIResponse";
import ReactMarkdown from "react-markdown";
import { formatScenarioText } from "@/lib/utils";

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

type Exercise = {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
};

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [scenario, setScenario] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const selectedTopicLabel = useMemo(
    () =>
      TOPICS.find((t) => t.id === selectedTopic)?.label ||
      "Signal Intelligence and Life Sciences Sales",
    [selectedTopic]
  );

  /* =========================
     RESET
  ========================= */
  const resetAll = () => {
    setExercises([]);
    setScenario(null);
    setSelectedAnswers({});
    setError(null);
  };

  /* =========================
     FALLBACK POOL
  ========================= */
  const fallbackPool: Exercise[] = [
    {
      question: "A customer says 'Your product is too expensive.' What's the BEST first response?",
      options: [
        "Competitors cost more.",
        "Can you help me understand what you're comparing us to?",
        "We can discount.",
        "Quality speaks for itself."
      ],
      correctAnswer: 1,
      explanation: "Understanding context first prevents defensiveness and uncovers real objections."
    },
    {
      question: "Customer goes silent after pricing. What do you do?",
      options: [
        "Offer discount",
        "Talk more",
        "Wait",
        "Escalate"
      ],
      correctAnswer: 2,
      explanation: "Silence = processing. Don't interrupt it."
    },
    {
      question: "'I need to think about it' means?",
      options: [
        "They are done",
        "They have a hidden concern",
        "They need time",
        "They want email"
      ],
      correctAnswer: 1,
      explanation: "Usually signals an unspoken objection."
    }
  ];

  /* =========================
     GENERATE QUIZ
  ========================= */
  const generateExercises = async () => {
    setIsGenerating(true);
    setError(null);
    setSelectedAnswers({});
    setExercises([]);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await apiRequest(
        "POST",
        "/api/chat/send",
        {
          message: `Return ONLY JSON.

Generate 5 multiple choice questions about "${selectedTopicLabel}".

Format:
[{
 "question":"...",
 "options":["A","B","C","D"],
 "correctAnswer":0,
 "explanation":"..."
}]`
        },
        { signal: controller.signal }
      );

      const raw = await response.text();
      const normalized = normalizeAIResponse(raw);

      let parsed = normalized.json;

      if (!Array.isArray(parsed)) {
        parsed = normalizeAIResponse(normalized.text).json;
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        setExercises(parsed.slice(0, 5));
      } else {
        throw new Error("Invalid AI response");
      }
    } catch (err) {
      console.warn("Fallback triggered:", err);
      setExercises(fallbackPool.sort(() => 0.5 - Math.random()).slice(0, 3));
      setError("AI response unstable. Showing fallback questions.");
    } finally {
      clearTimeout(timeout);
      setIsGenerating(false);
    }
  };

  /* =========================
     GENERATE SCENARIO
  ========================= */
  const generateScenario = async () => {
    setIsGeneratingScenario(true);
    setScenario(null);

    try {
      const response = await apiRequest("POST", "/api/chat/send", {
        message: `Generate a pharma sales scenario about "${selectedTopicLabel}" including:
- HCP context
- signals
- objection
- best response`
      });

      const raw = await response.text();
      const normalized = normalizeAIResponse(raw);
      setScenario(normalized.text);
    } catch {
      setScenario("Unable to generate scenario.");
    } finally {
      setIsGeneratingScenario(false);
    }
  };

  /* =========================
     SELECT ANSWER (INSTANT FEEDBACK)
  ========================= */
  const selectAnswer = (qIdx: number, optIdx: number) => {
    if (selectedAnswers[qIdx] !== undefined) return;
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  /* =========================
     UI
  ========================= */
  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Dumbbell className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Practice Exercises</h1>
        </div>

        <button onClick={resetAll} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <RefreshCw className="h-4 w-4" />
          Reset
        </button>
      </div>

      {/* TOPICS */}
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

      {/* ACTIONS */}
      <div className="grid grid-cols-2 gap-4">
        <Button onClick={generateExercises} disabled={isGenerating}>
          {isGenerating ? "Generating..." : "Generate Quiz"}
        </Button>

        <Button onClick={generateScenario} disabled={isGeneratingScenario}>
          {isGeneratingScenario ? "Generating..." : "Generate Scenario"}
        </Button>
      </div>

      {/* ERROR */}
      {error && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* SCENARIO */}
      {scenario && (
        <Card>
          <CardHeader>
            <CardTitle>Practice Scenario</CardTitle>
          </CardHeader>
          <CardContent>
            <ReactMarkdown>{formatScenarioText(scenario)}</ReactMarkdown>
          </CardContent>
        </Card>
      )}

      {/* QUIZ */}
      {exercises.map((ex, idx) => {
        const selected = selectedAnswers[idx];
        const correct = selected === ex.correctAnswer;

        return (
          <Card key={idx}>
            <CardHeader>
              <CardTitle>{idx + 1}. {ex.question}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              <RadioGroup
                value={selected?.toString()}
                onValueChange={(v) => selectAnswer(idx, parseInt(v))}
              >
                {ex.options.map((opt, i) => {
                  const isSelected = selected === i;
                  const isCorrect = ex.correctAnswer === i;

                  let cls = "p-3 border rounded-lg flex gap-2";

                  if (selected !== undefined) {
                    if (isCorrect) cls += " border-green-500 bg-green-50";
                    else if (isSelected) cls += " border-red-400 bg-red-50";
                    else cls += " opacity-50";
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
                <Alert className={correct ? "border-green-500" : ""}>
                  {correct ? <CheckCircle2 /> : <XCircle />}
                  <AlertDescription>
                    {ex.explanation}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
