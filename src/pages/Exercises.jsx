import { useState } from "react";
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
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { normalizeAIResponse } from "@/lib/normalizeAIResponse";

type Exercise = {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
};

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState<Record<number, boolean>>({});

  const generateExercises = async () => {
    setIsGenerating(true);
    setError(null);
    setSelectedAnswers({});
    setShowResults({});

    // Create AbortController with 12-second timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 12000);

    try {
      // Use apiRequest helper for proper base URL handling (mobile + Cloudflare Pages)
      const response = await apiRequest("POST", "/api/chat/send", {
        message: `CRITICAL: You MUST respond with ONLY a valid JSON array. No other text before or after.

Generate 3 multiple-choice quiz questions for sales communication skills training.

Respond with this EXACT JSON structure (no markdown, no explanation):
[{"question": "Question text?", "options": ["Option A", "Option B", "Option C", "Option D"], "correctAnswer": 0, "explanation": "Why this is correct"}]

JSON array only:`,
        content: "Generate practice exercises"
      }, { signal: abortController.signal });

      const rawText = await response.text();
      const normalized = normalizeAIResponse(rawText);
      
      // Extract AI message from response structure
      let aiMessage = normalized.text;
      if (normalized.json) {
        aiMessage = normalized.json.aiMessage?.content || 
                   normalized.json.messages?.find((m: any) => m.role === "assistant")?.content || 
                   normalized.text;
      }

      // P0 DIAGNOSTIC: Log what we received
      if (!import.meta.env.DEV) {
        console.log("[P0 EXERCISES] Raw response:", rawText.substring(0, 500));
        console.log("[P0 EXERCISES] Normalized:", normalized);
        console.log("[P0 EXERCISES] AI Message:", aiMessage.substring(0, 500));
      }

      // Parse the AI message for exercises array
      const exercisesNormalized = normalizeAIResponse(aiMessage);
      
      if (!import.meta.env.DEV) {
        console.log("[P0 EXERCISES] Exercises normalized:", exercisesNormalized);
      }

      if (Array.isArray(exercisesNormalized.json) && exercisesNormalized.json.length > 0) {
        setExercises(exercisesNormalized.json);
      } else if (exercisesNormalized.json && typeof exercisesNormalized.json === 'object' && !Array.isArray(exercisesNormalized.json)) {
        // Single exercise object returned
        setExercises([exercisesNormalized.json]);
      } else {
        // Worker returned prose - generate RANDOMIZED quiz questions
        console.warn("[P0 EXERCISES] Worker returned prose, generating RANDOMIZED quiz questions");
        
        // Pool of 12 sales communication quiz questions - randomly select 3
        const quizPool: Exercise[] = [
          {
            question: "A customer says 'Your product is too expensive.' What's the BEST first response?",
            options: [
              "Actually, our competitors charge even more for similar features.",
              "I understand price is a concern. Can you help me understand what you're comparing us to?",
              "We can offer you a 10% discount if you sign today.",
              "You get what you pay for - our quality speaks for itself."
            ],
            correctAnswer: 1,
            explanation: "The best response acknowledges their concern and seeks to understand their perspective before defending or discounting. This opens dialogue rather than creating defensiveness."
          },
          {
            question: "During a sales call, the customer goes silent after you present pricing. What should you do?",
            options: [
              "Immediately offer a discount to break the silence.",
              "Fill the silence by explaining more features and benefits.",
              "Wait silently and let them process the information.",
              "Ask if they need to speak with their manager."
            ],
            correctAnswer: 2,
            explanation: "Silence after pricing is normal - the customer is processing. Resist the urge to fill silence. Waiting shows confidence and gives them space to think and respond authentically."
          },
          {
            question: "A prospect says 'I need to think about it.' What's the most effective response?",
            options: [
              "No problem! I'll follow up next week.",
              "What specifically would you like to think about?",
              "Most customers who say that end up regretting the delay.",
              "I can hold this price for 24 hours only."
            ],
            correctAnswer: 1,
            explanation: "'I need to think about it' usually means there's an unspoken concern. Asking what specifically they need to consider uncovers the real objection so you can address it."
          },
          {
            question: "Which question is MOST effective for discovering a customer's true needs?",
            options: [
              "What features are you looking for in a solution?",
              "What's the biggest challenge you're facing right now?",
              "Would you like to see a demo of our product?",
              "How much are you currently spending on this?"
            ],
            correctAnswer: 1,
            explanation: "Asking about their biggest challenge gets to the emotional core of their need. Features, demos, and budget are important but secondary to understanding their pain points."
          },
          {
            question: "A customer interrupts your presentation with a concern. What should you do?",
            options: [
              "Politely ask them to hold questions until the end.",
              "Stop immediately and address their concern fully.",
              "Acknowledge it briefly and promise to cover it later.",
              "Continue presenting since you'll likely address it soon."
            ],
            correctAnswer: 1,
            explanation: "When a customer interrupts, it means that concern is blocking them from hearing anything else. Stop and address it immediately - your presentation won't land until you do."
          },
          {
            question: "What's the PRIMARY purpose of asking questions in a sales conversation?",
            options: [
              "To demonstrate your expertise and knowledge.",
              "To qualify whether they can afford your solution.",
              "To understand their situation and build trust.",
              "To guide them toward the features you want to sell."
            ],
            correctAnswer: 2,
            explanation: "Questions should primarily help you understand their world and build trust. Qualification and guidance are secondary benefits. People buy from those who understand them."
          },
          {
            question: "A customer says 'We're happy with our current solution.' How do you respond?",
            options: [
              "That's great! What do you like most about it?",
              "Have you considered the risks of staying with outdated technology?",
              "Let me show you what you're missing with our solution.",
              "Can I follow up in 6 months when your contract renews?"
            ],
            correctAnswer: 0,
            explanation: "Asking what they like about their current solution shows genuine interest and often reveals gaps or concerns they haven't articulated. It builds rapport rather than creating resistance."
          },
          {
            question: "When should you present pricing in a sales conversation?",
            options: [
              "As early as possible to qualify the prospect.",
              "After you've fully understood their needs and built value.",
              "Only when they explicitly ask for it.",
              "At the very end after covering all features."
            ],
            correctAnswer: 1,
            explanation: "Present pricing after establishing value and understanding needs. Too early and they lack context; too late and you may have lost their attention. Value must precede price."
          },
          {
            question: "A customer's body language shows discomfort during your pitch. What should you do?",
            options: [
              "Ignore it and continue with your planned presentation.",
              "Speed up to get through the uncomfortable part faster.",
              "Pause and ask 'How is this landing for you?'",
              "Make a joke to lighten the mood."
            ],
            correctAnswer: 2,
            explanation: "Body language is honest feedback. Pausing to check in shows emotional intelligence and gives them permission to voice concerns before they become deal-breakers."
          },
          {
            question: "What's the BEST way to handle a customer who talks excessively?",
            options: [
              "Let them talk as long as they want to build rapport.",
              "Interrupt politely to redirect to your agenda.",
              "Listen actively, then ask a specific question to refocus.",
              "Schedule a follow-up call when they have less time."
            ],
            correctAnswer: 2,
            explanation: "Active listening builds rapport, but you need to guide the conversation. A specific question respects their input while steering toward productive discussion."
          },
          {
            question: "A prospect says 'Send me some information and I'll review it.' What's your best move?",
            options: [
              "Send a comprehensive PDF with all product details.",
              "Ask 'What specific information would be most helpful?'",
              "Suggest a brief call to understand their needs first.",
              "Send information and follow up in a week."
            ],
            correctAnswer: 2,
            explanation: "'Send me information' is often a polite brush-off. Suggesting a brief call to understand their needs first keeps the conversation alive and positions you as consultative, not transactional."
          },
          {
            question: "How should you respond when a customer compares you to a competitor?",
            options: [
              "Point out the competitor's weaknesses and limitations.",
              "Emphasize your unique features and advantages.",
              "Ask what's important to them in making this decision.",
              "Offer a lower price to win the comparison."
            ],
            correctAnswer: 2,
            explanation: "Comparisons are opportunities to understand their priorities. Asking what matters most to them lets you position your strengths against their specific criteria, not generic features."
          }
        ];
        
        // Randomly select 3 questions from the pool
        const shuffled = [...quizPool].sort(() => Math.random() - 0.5);
        const selectedQuestions = shuffled.slice(0, 3);
        
        console.log("[P0 EXERCISES] Selected questions:", selectedQuestions.map(q => q.question.substring(0, 50)));
        setExercises(selectedQuestions);
      }
    } catch (err) {
      console.error("[P0 EXERCISES] Error in generateExercises:", err);
      
      // Mobile-friendly error message with network hint
      const errorMessage = err instanceof Error && err.message.includes('Failed to fetch')
        ? "Network error. Please check your connection and try again."
        : "Unable to generate exercises. Please try again.";
      setError(errorMessage);
      
      // Set a fallback exercise even on error
      const fallbackExercise: Exercise = {
        question: "What is the most important skill in sales communication?",
        options: [
          "Speaking clearly and confidently",
          "Active listening and understanding customer needs",
          "Knowing all product features",
          "Closing techniques"
        ],
        correctAnswer: 1,
        explanation: "Active listening and understanding customer needs is fundamental. You can't solve problems you don't understand, and customers buy from those who truly hear them."
      };
      
      setExercises([fallbackExercise]);
    } finally {
      clearTimeout(timeoutId);
      setIsGenerating(false);
    }
  };

  const handleAnswerSelect = (exerciseIdx: number, optionIdx: number) => {
    setSelectedAnswers(prev => ({ ...prev, [exerciseIdx]: optionIdx }));
  };

  const handleCheckAnswer = (exerciseIdx: number) => {
    setShowResults(prev => ({ ...prev, [exerciseIdx]: true }));
  };

  const isCorrect = (exerciseIdx: number) => {
    return selectedAnswers[exerciseIdx] === exercises[exerciseIdx]?.correctAnswer;
  };

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="container mx-auto p-6 max-w-5xl space-y-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Dumbbell className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Practice Exercises</h1>
          </div>
          <p className="text-muted-foreground">
            Test your sales communication skills with interactive quiz questions
          </p>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI-Generated Quiz Questions
            </CardTitle>
            <CardDescription>
              Generate personalized quiz questions to test your knowledge
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Generated for this session • Content clears on page refresh
              </AlertDescription>
            </Alert>

            <Button
              onClick={generateExercises}
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
                  Generating Questions...
                </>
              ) : exercises.length > 0 ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate New Questions
                </>
              ) : (
                <>
                  <Target className="h-4 w-4 mr-2" />
                  Generate Quiz Questions
                </>
              )}
            </Button>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {exercises.length > 0 && (
          <div className="space-y-6">
            {exercises.map((exercise, idx) => {
              const hasAnswered = selectedAnswers[idx] !== undefined;
              const showResult = showResults[idx];
              const correct = isCorrect(idx);

              return (
                <Card key={idx} className="hover-elevate">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <Badge variant="secondary" className="mb-2">
                          Question {idx + 1}
                        </Badge>
                        <CardTitle className="text-base leading-relaxed">
                          {exercise.question}
                        </CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RadioGroup
                      value={selectedAnswers[idx]?.toString()}
                      onValueChange={(value) => handleAnswerSelect(idx, parseInt(value))}
                      disabled={showResult}
                    >
                      {exercise.options.map((option, optionIdx) => {
                        const isSelected = selectedAnswers[idx] === optionIdx;
                        const isCorrectOption = optionIdx === exercise.correctAnswer;
                        
                        let optionClass = "flex items-start space-x-3 space-y-0 p-3 rounded-lg border-2 transition-colors";
                        
                        if (showResult) {
                          if (isCorrectOption) {
                            optionClass += " border-primary bg-primary/10";
                          } else if (isSelected && !isCorrectOption) {
                            optionClass += " border-destructive bg-destructive/10";
                          } else {
                            optionClass += " border-border opacity-50";
                          }
                        } else {
                          optionClass += isSelected 
                            ? " border-primary bg-primary/5" 
                            : " border-border hover:border-primary/50";
                        }

                        return (
                          <div key={optionIdx} className={optionClass}>
                            <RadioGroupItem value={optionIdx.toString()} id={`q${idx}-o${optionIdx}`} />
                            <Label 
                              htmlFor={`q${idx}-o${optionIdx}`} 
                              className="flex-1 cursor-pointer font-normal leading-relaxed"
                            >
                              {option}
                              {showResult && isCorrectOption && (
                                <CheckCircle2 className="inline-block ml-2 h-4 w-4 text-primary" />
                              )}
                              {showResult && isSelected && !isCorrectOption && (
                                <XCircle className="inline-block ml-2 h-4 w-4 text-destructive" />
                              )}
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>

                    {!showResult && hasAnswered && (
                      <Button 
                        onClick={() => handleCheckAnswer(idx)}
                        className="w-full"
                      >
                        Check Answer
                      </Button>
                    )}

                    {showResult && (
                      <Alert className={correct ? "border-primary bg-primary/10" : "border-muted bg-muted"}>
                        <div className="flex items-start gap-3">
                          {correct ? (
                            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="font-semibold mb-1">
                              {correct ? "Correct!" : "Not quite."}
                            </p>
                            <AlertDescription className="text-sm">
                              {exercise.explanation}
                            </AlertDescription>
                          </div>
                        </div>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!isGenerating && exercises.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Questions Yet</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Click the button above to generate personalized quiz questions to test your sales communication knowledge.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
