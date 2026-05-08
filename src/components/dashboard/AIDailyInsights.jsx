import React, { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw, Brain, Target, MessageSquare, TrendingUp } from "lucide-react";
import { buildFieldCoachingGrounding } from "@/lib/fieldCoachingGuidance";

const DEFAULT = {
  focus_tip: "In your next call, pause for 2 seconds after the HCP finishes speaking. That silence often reveals what they're really thinking.",
  challenge: "You might face an HCP who seems rushed or distracted. Instead of speeding up, slow down and ask one focused question about their biggest patient challenge.",
  strength: "You excel at building rapport quickly and making HCPs feel heard, even in brief interactions.",
  affirmation: "Every conversation you have today could be the one that connects a patient to the treatment that changes their life.",
};

const INSIGHT_PACKS = [
  {
    focus_tip: "If an HCP challenges the practicality of your message, do not widen the conversation. Ask which patient type or workflow moment makes the message feel least usable, then stay on that pressure point.",
    challenge: "You may get a polite response from an HCP who has already decided not to revisit treatment choices this month. Identify the locked variable before you try to reopen the conversation.",
    strength: "You are likely already better at staying composed after pushback than most reps realize, which keeps difficult conversations recoverable.",
    affirmation: "Discipline in how you read resistance matters more than volume of information in a short clinical conversation.",
  },
  {
    focus_tip: "When the HCP gives a broad objection, narrow it before you respond. Ask whether the barrier is patient fit, workflow friction, confidence in expected outcomes, or simple timing.",
    challenge: "Expect at least one interaction where the HCP sounds interested but refuses a clear next step. Treat that as hesitation to diagnose, not a cue to repeat your pitch.",
    strength: "You are likely already using questions to slow the conversation down before it turns adversarial, which gives you room to coach the moment instead of chase it.",
    affirmation: "Strong field coaching usually comes from clean judgment in one difficult moment, not a flawless conversation from start to finish.",
  },
  {
    focus_tip: "If the HCP starts compressing their answers or checking the clock, shift from explanation to relevance. Earn one more minute by naming the pressure you think they are managing and checking whether you are right.",
    challenge: "A rushed interaction can tempt you to over-talk to preserve value. The better move is to shorten deliberately and leave with one usable signal you can act on later.",
    strength: "You are likely already adapting your tone faster than you give yourself credit for, especially when the conversation tightens unexpectedly.",
    affirmation: "Precision under time pressure is one of the clearest markers of professional selling maturity.",
  },
];

const WEAK_INSIGHT_PATTERNS = [
  /build rapport/i,
  /be confident/i,
  /listen more/i,
  /patient testimonials?/i,
  /case studies?/i,
  /real-world evidence/i,
  /critical skill that directly impacts your success/i,
  /changes their life/i,
];

function isWeakInsightText(value = "") {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length < 50) return true;
  return WEAK_INSIGHT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function pickInsightPack() {
  return INSIGHT_PACKS[Math.floor(Math.random() * INSIGHT_PACKS.length)] || DEFAULT;
}

function normalizeInsightPayload(parsed) {
  const fallback = pickInsightPack();
  const candidate = {
    focus_tip: parsed?.focus_tip || fallback.focus_tip,
    challenge: parsed?.challenge || fallback.challenge,
    strength: parsed?.strength || fallback.strength,
    affirmation: parsed?.affirmation || fallback.affirmation,
  };

  const hasWeakField = Object.values(candidate).some(isWeakInsightText);
  return hasWeakField ? fallback : candidate;
}

export default function AIDailyInsights() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  const generate = useCallback(async () => {
    setLoading(true);
    setLoadingMessage("🔄 Generating insights...");

    try {
      const timestamp = Date.now();
      const seed = Math.random().toString(36).substring(7) + timestamp;

      const topics = [
        "asking questions that uncover the HCP's real priorities",
        "reading subtle signals when an HCP's attention shifts",
        "connecting clinical data to the HCP's specific practice challenges",
        "responding to concerns without becoming defensive",
        "securing clear next steps that both parties commit to",
        "building credibility quickly with a skeptical HCP",
        "demonstrating value when you only have 2-3 minutes",
        "using patient stories ethically to illustrate impact"
      ];
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];

      const prompt = `You are ReflectivAI's enterprise coaching brief generator.

    ${buildFieldCoachingGrounding({
        surface: "ai_daily_insights",
        challenge: randomTopic,
        customNotes: ["Keep each field grounded in one or more Signal Intelligence behavioral metrics."],
      })}

Generate daily insights focused on: "${randomTopic}".

Return ONLY valid JSON with these exact 4 fields and no markdown:
{
  "focus_tip": "1-2 sentences. One concrete behavior to practice today in a live HCP interaction.",
  "challenge": "1-2 sentences. One realistic HCP or workflow situation the rep may face today.",
  "strength": "1 sentence. A specific behavior the rep is likely already demonstrating effectively.",
  "affirmation": "1 sentence. A grounded professional reminder with no sentimentality or clichés."
}

Enterprise rules:
- Be specific, field-usable, and behavior-based
- Use observable HCP cues, rep behaviors, workflow constraints, or decision moments
- No generic advice like "listen more", "be confident", or "build rapport"
- No fabricated statistics, studies, references, or product claims
- No inspirational slogans, patient-life clichés, or corporate motivational language
- No invented platform features or internal tools
- Write like a strong enablement leader coaching a high-performing rep
- Use Signal Intelligence capability language where it improves clarity

Quality bar by field:
- focus_tip: should tell the rep exactly what to do when a specific signal appears
- challenge: should feel like a realistic field moment, not a vague obstacle
- strength: should reinforce a real conversational behavior, not a personality trait
- affirmation: should sound grounded, disciplined, and professional

Variation seed: ${seed}`;

      const timeoutWarning = setTimeout(() => {
        if (loading) setLoadingMessage("⏳ Still processing... this may take a moment");
      }, 5000);

      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 400, temperature: 0.9 })
      });

      clearTimeout(timeoutWarning);

      if (res.ok) {
        const data = await res.json();
        try {
          let jsonStr = typeof data.response === 'string' ? data.response : String(data.response);
          // Strip markdown code block if present
          jsonStr = jsonStr.replace(/^```[\w]*\n?|\n?```$/g, '').trim();
          const parsed = JSON.parse(jsonStr);

          setInsights(normalizeInsightPayload(parsed));
        } catch (err) {
          console.error('JSON parse error:', err, data.response);
          setInsights(pickInsightPack());
        }
      } else {
        console.error("API error:", res.status);
        setInsights(pickInsightPack());
      }
    } catch (err) {
      console.error('Daily insights generation error:', err);
      setInsights(pickInsightPack());
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }, [loading]);

  // Auto-generate insights on mount
  useEffect(() => {
    if (!insights) generate();
  }, []);

  const data = insights || DEFAULT;

  return (
    <div className="rounded-xl p-6 mb-8" style={{ background: "#1A334D" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" style={{ color: "#39ACAC" }} />
          <h2 className="text-lg font-bold text-white">AI Daily Insights</h2>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
          title="Refresh insights"
        >
          <RefreshCw className={`w-4 h-4 text-white/50 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <p className="text-xs mb-5" style={{ color: "#39ACAC" }}>
        {loadingMessage || "Personalized recommendations powered by AI"}
      </p>

      <div className="space-y-3">
        {/* Today's Focus Tip */}
        <div
          className="rounded-xl p-4"
          style={{ border: "1px solid #39ACAC55", background: "#39ACAC11" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4" style={{ color: "#39ACAC" }} />
            <span className="text-sm font-bold text-white">Today's Focus</span>
          </div>
          {loading ? (
            <div className="space-y-2">
              <div className="h-3 bg-white/10 rounded animate-pulse w-full" />
              <div className="h-3 bg-white/10 rounded animate-pulse w-5/6" />
            </div>
          ) : (
            <p className="text-sm text-white/90 leading-relaxed">{data.focus_tip}</p>
          )}
        </div>

        {/* Challenge to Watch For */}
        <div
          className="rounded-xl p-4"
          style={{ border: "1px solid #39ACAC33", background: "#ffffff08" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4" style={{ color: "#39ACAC" }} />
            <span className="text-sm font-bold text-white">Challenge to Watch For</span>
          </div>
          {loading ? (
            <div className="space-y-2">
              <div className="h-3 bg-white/10 rounded animate-pulse w-full" />
              <div className="h-3 bg-white/10 rounded animate-pulse w-4/5" />
            </div>
          ) : (
            <p className="text-sm text-white/80 leading-relaxed">{data.challenge}</p>
          )}
        </div>

        {/* Your Strength */}
        <div
          className="rounded-xl p-4"
          style={{ border: "1px solid #39ACAC22", background: "#ffffff05" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4" style={{ color: "#39ACAC" }} />
            <span className="text-sm font-bold text-white">Your Strength</span>
          </div>
          {loading ? (
            <div className="h-3 bg-white/10 rounded animate-pulse w-3/4" />
          ) : (
            <p className="text-sm text-white/80 leading-relaxed">{data.strength}</p>
          )}
        </div>

        {/* Daily Affirmation */}
        <div
          className="rounded-xl p-4"
          style={{ border: "1px solid #39ACAC22", background: "#ffffff05" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4" style={{ color: "#39ACAC" }} />
            <span className="text-sm font-bold text-white">Daily Affirmation</span>
          </div>
          {loading ? (
            <div className="h-3 bg-white/10 rounded animate-pulse w-5/6" />
          ) : (
            <p className="text-sm italic text-white/70 leading-relaxed">{data.affirmation}</p>
          )}
        </div>
      </div>
    </div>
  );
}