import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

const DEFAULT_TIP = "When engaging with healthcare professionals, prioritize building trust by actively listening to their concerns and responding thoughtfully.";

const TIP_FALLBACKS = [
  DEFAULT_TIP,
  "Mirror the HCP's pace: if they are time-pressed, lead with one clear value point before asking anything.",
  "When you hear skepticism, acknowledge it first — then offer one concrete data point tied to patient impact.",
  "Ask one forward-driving question after every objection to keep momentum and uncover next-step intent.",
  "Close each conversation with a specific commitment: who will do what by when.",
  "Before framing value, confirm the HCP's priority — relevance you haven't verified is noise.",
];

export default function TodaysTipCard({ className = "" }) {
  const [tip, setTip] = useState(DEFAULT_TIP);
  const [tipLoading, setTipLoading] = useState(false);

  const refreshTip = useCallback(async () => {
    setTipLoading(true);
    try {
      const timestamp = Date.now();
      const seed = Math.random().toString(36).substring(7) + timestamp;
      const sessionId = Math.random().toString(36).substring(2, 10);

      const themes = [
        "crafting questions that make HCPs pause and think, not just answer on autopilot",
        "picking up on the subtle cues when someone's interest level shifts mid-conversation",
        "translating clinical evidence into language that connects with their specific practice challenges",
        "responding to objections in a way that deepens trust rather than triggers defensiveness",
        "ending every interaction with crystal-clear next steps that both parties actually remember",
        "establishing credibility quickly with a skeptical or time-pressed HCP",
        "pivoting smoothly when the conversation goes off-track without being awkward",
        "demonstrating value in under 90 seconds when you have limited face time",
        "using data to support your message without overwhelming the conversation",
        "reading body language to know when to push forward vs. when to pause and listen",
        "turning a brief hallway encounter into a meaningful touchpoint",
        "following up in a way that feels helpful rather than pushy",
      ];

      const theme = themes[Math.floor(Math.random() * themes.length)];
      const prompt = `You are a top pharmaceutical sales coach. Generate ONE practical, specific "Today's Tip" for a pharma sales rep focused on ${theme}.
Constraints:
- 1-2 sentences max
- Actionable and concrete
- No fluff, no hashtags, no bullet points
- No quotation marks around the whole tip
- Vary wording/style each time (seed: ${seed}, session: ${sessionId})`;

      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 120 })
      });

      if (res.ok) {
        const data = await res.json();
        const raw = (data.response || data.text || data.content || "").trim();
        const tipText = raw
          .replace(/^[-•\d.\s]+/, "")
          .replace(/^"|"$/g, "")
          .split("\n")
          .filter(Boolean)[0]
          ?.trim();

        setTip(tipText || TIP_FALLBACKS[Math.floor(Math.random() * TIP_FALLBACKS.length)]);
      } else {
        setTip(TIP_FALLBACKS[Math.floor(Math.random() * TIP_FALLBACKS.length)]);
      }
    } catch {
      setTip(TIP_FALLBACKS[Math.floor(Math.random() * TIP_FALLBACKS.length)]);
    } finally {
      setTipLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshTip();
  }, [refreshTip]);

  return (
    <div className={`rounded-lg border p-3 ${className}`} style={{ background: "#fef9c3", borderColor: "#eab308" }}>
      <div className="flex items-center gap-2 text-xs font-bold mb-1.5" style={{ color: "#1A334D" }}>
        <span className="w-4 h-4 rounded-full border-2 border-yellow-500"></span>
        <span className="flex-1">Today's Tip</span>
        <button
          onClick={refreshTip}
          disabled={tipLoading}
          className="rounded p-0.5 hover:bg-yellow-200/80 transition-colors"
          title="Refresh tip"
          type="button"
        >
          <RefreshCw className={`w-3 h-3 ${tipLoading ? "animate-spin" : ""}`} style={{ color: "#1A334D" }} />
        </button>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>
        {tipLoading ? "Generating tip…" : tip}
      </p>
    </div>
  );
}
