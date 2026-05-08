import React, { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw, Brain, Target, MessageSquare, TrendingUp } from "lucide-react";

const DEFAULT = {
  focus_tip: "In your next call, pause for 2 seconds after the HCP finishes speaking. That silence often reveals what they're really thinking.",
  challenge: "You might face an HCP who seems rushed or distracted. Instead of speeding up, slow down and ask one focused question about their biggest patient challenge.",
  strength: "You excel at building rapport quickly and making HCPs feel heard, even in brief interactions.",
  affirmation: "Every conversation you have today could be the one that connects a patient to the treatment that changes their life.",
};

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

      const prompt = `You are a pharmaceutical sales coach. Generate UNIQUE daily insights focused on: "${randomTopic}" (seed: ${seed}).

Return ONLY valid JSON with these 4 fields (no markdown, no code blocks):
{
  "focus_tip": "ONE specific, tactical behavior to practice today related to ${randomTopic}. Be concrete and actionable (1-2 sentences).",
  "challenge": "ONE realistic scenario they might face today related to ${randomTopic}. Acknowledge it's difficult (1-2 sentences).",
  "strength": "ONE thing they're likely already doing well in their conversations. Be specific and encouraging (1 sentence).",
  "affirmation": "A genuine reminder about patient impact. No clichés or corporate speak (1 sentence)."
}

IMPORTANT: Make each insight UNIQUE and SPECIFIC. Vary your examples and phrasing. No generic advice like "listen more" or "ask better questions" - be tactical and memorable.
Tone: Like a seasoned rep coaching a peer over coffee. Warm, direct, practical.`;

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

          setInsights({
            focus_tip: parsed.focus_tip || DEFAULT.focus_tip,
            challenge: parsed.challenge || DEFAULT.challenge,
            strength: parsed.strength || DEFAULT.strength,
            affirmation: parsed.affirmation || DEFAULT.affirmation,
          });
        } catch (err) {
          console.error('JSON parse error:', err, data.response);
          setInsights(DEFAULT);
        }
      } else {
        console.error("API error:", res.status);
        setInsights(DEFAULT);
      }
    } catch (err) {
      console.error('Daily insights generation error:', err);
      setInsights(DEFAULT);
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