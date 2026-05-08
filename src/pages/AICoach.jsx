// @ts-nocheck
// Tab definitions
const TABS = {
  OPENING: "Opening",
  OBJECTION_HANDLING: "Objection Handling",
  CLOSING: "Closing / Next Steps",
  PRODUCT_KNOWLEDGE: "Product Knowledge",
  DISEASE_KNOWLEDGE: "Disease Knowledge",
  MARKET_KNOWLEDGE: "Market / Market Conditions",
  GENERAL_COACHING: "General Coaching",
};

// Function to detect question topic
function detectTopic(question) {
  const topics = {
    "objection": TABS.OBJECTION_HANDLING,
    "closing": TABS.CLOSING,
    "product": TABS.PRODUCT_KNOWLEDGE,
    "disease": TABS.DISEASE_KNOWLEDGE,
    "market": TABS.MARKET_KNOWLEDGE,
    "general": TABS.GENERAL_COACHING,
  };
  for (const [key, tab] of Object.entries(topics)) {
    if (question.toLowerCase().includes(key)) {
      return tab;
    }
  }
  return TABS.GENERAL_COACHING;
}

// Function to respond based on current tab and detected topic
function respondToQuestion(question, currentTab) {
  const detectedTopic = detectTopic(question);
  // Skip clarification response for anticipated objections and answer directly
  if (detectedTopic === TABS.OBJECTION_HANDLING && question.toLowerCase().includes("objection")) {
    return ""; // No clarification, let LLM answer directly
  }
  if (detectedTopic === currentTab) {
    return `That’s a great question. Since you're in the ${currentTab} section, here's a quick response to help you: [brief answer].`;
  }
  if (detectedTopic === TABS.GENERAL_COACHING || detectedTopic === currentTab) {
    return `That’s a valuable question. It relates most closely to ${detectedTopic}. Since this section focuses on ${currentTab}, you’ll get more structured coaching in the ${detectedTopic}. I can give you a quick perspective here, or you can explore it more deeply there.`;
  } else {
    return `That’s a valuable question. It relates most closely to ${detectedTopic}. Since this section focuses on ${currentTab}, you’ll get more structured coaching in the ${detectedTopic}. For deeper coaching and examples, explore the ${detectedTopic} section. [Go to ${detectedTopic} →]`;
  }
}
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, RefreshCw, ClipboardList, Sparkles, Copy, ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import ReactMarkdown from "react-markdown";
import InsightsSidebar from "@/components/coach/InsightsSidebar";
import SessionSummaryPill from "@/components/coach/SessionSummaryPill";
import TodaysTipCard from "@/components/shared/TodaysTipCard";
import { getTopicGuardResponse, sanitizeAiText } from "@/lib/aiTopicGuard";
import { buildFieldCoachingGrounding } from "@/lib/fieldCoachingGuidance";
import { normalizeInvokeResponseText } from "@/lib/roleplayUiFormatting";
import { describeSiScoreBand } from "@/lib/siEvaluationLanguage";

const suggestedQuestions = [
  "How can I better understand what motivates healthcare providers in my territory?",
  "What are effective ways to handle objections about clinical evidence?",
  "Help me prepare for a conversation with a skeptical physician",
  "Draft me an opening statement for a first call with an oncologist",
  "Suggest improvements to this message: 'Our drug is the best option for your patients'",
];

const contentTools = [
  {
    label: "Opening",
    examplePrompt: "Draft 3 opening statements for a first HCP visit, tailored to the rep's context.",
    followUpPrompt: "Please share your HCP context (type, specialty, area, relationship). I'll create a specific opening for you."
  },
  {
    label: "Objection Responses",
    examplePrompt: "Generate 3 different response options for this common objection: 'I already have a preferred treatment and I'm not looking to change.'",
    followUpPrompt: "Please share the objection or concern you need to address. I'll generate response options for you."
  },
  {
    label: "Follow-up Email",
    examplePrompt: "Write a professional follow-up email to send after a productive HCP meeting. Keep it brief, value-focused, and referencing the Signal Intelligence framework.",
    followUpPrompt: "Share your meeting details (HCP type, key points, outcomes). I'll draft a follow-up email for you."
  },
  {
    label: "Improve My Message",
    examplePrompt: "I can help you improve your message using Signal Intelligence principles. Please share the message you'd like me to review.",
    followUpPrompt: "Paste the message you'd like to improve. I'll provide feedback and suggestions."
  },
  {
    label: "Content Ideas",
    examplePrompt: "Here are 5 creative ways you can add value to your next HCP conversation beyond just presenting product data: [example ideas]",
    followUpPrompt: "Share your situation (HCP type, area, relationship stage). I'll suggest value-add ideas for your context."
  },
];

// Parse roleplay session context from URL if navigated from a session
function parseSessionContext() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("session_context");
  if (!raw) return null;
  try { return JSON.parse(decodeURIComponent(raw)); } catch { return null; }
}

export default function AICoach() {
  const [activeTab] = useState(TABS.GENERAL_COACHING);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionContext] = useState(() => parseSessionContext());
  const [sessionSummary, setSessionSummary] = useState(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [contentToolMode, setContentToolMode] = useState(null); // Track which content tool is active
  const messagesEndRef = useRef(null);

  // Auto-open with session context if navigated from a roleplay
  useEffect(() => {
    if (sessionContext && messages.length === 0) {
      generateAutoSessionCoaching(sessionContext);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const [copiedIdx, setCopiedIdx] = useState(null);
  const [reactions, setReactions] = useState({});
  const [chatResetKey, setChatResetKey] = useState(0);

  function buildEnterpriseCoachPrompt({ conversationHistory, sessionCtxBlock = "", currentTab }) {
    const groundingBlock = buildFieldCoachingGrounding({
      surface: "ai_coach",
      hcpType: sessionContext?.hcpCategory || "",
      specialty: sessionContext?.specialty || "",
      challenge: currentTab,
      weakestAreas: sessionContext?.misalignments || [],
      strongestAreas: sessionContext?.positives || [],
      customNotes: Object.entries(sessionContext?.capabilityScores || {}).map(([key, value]) => `${key.replace(/_/g, " ")}: ${value}/5`),
    });

    return `You are ReflectivAI's enterprise AI Coach for pharmaceutical sales enablement.

Your job is to produce executive-ready coaching that is concrete, concise, and behavior-specific.

RESPONSE DECISION RULE:
- If the user is asking for information or guidance, answer directly in the enterprise coaching format below.
- If the user is asking for feedback on wording, approach, or call execution, respond as a coach using the same format but with sharper behavior-level recommendations.

MANDATORY FORMAT:
## Direct Answer
2-4 sentences. State the answer plainly with no preamble.

## Signal Intelligence Lens
2-4 bullets tied to observable rep behaviors, HCP signals, or practical field dynamics.

## Recommended Move
2-4 bullets with specific next actions, phrasing, or coaching moves.

## Next Best Action
One short paragraph or 2 bullets describing what the rep should do next in ReflectivAI or in the next HCP interaction.

ENTERPRISE RULES:
- Sound like an enterprise sales coach, not a general chatbot.
- No fabricated citations, journals, studies, percentages, survey results, or references unless they were explicitly provided in the conversation context.
- Do not invent clinical claims, product facts, or market statistics.
- Do not invent ReflectivAI modules, pages, datasets, content libraries, or internal tools that were not explicitly mentioned in the conversation or visible context.
- Do not give generic pharma boilerplate or motivational filler.
- Prefer short bullets, clear business language, and field-usable phrasing.
- When useful, include one example phrase the rep can say next.
- Only discuss this current conversation. Never mention previous sessions, prior conversations, or other unseen history.
- Never offer to roleplay in chat. If practice is appropriate, say to use the Role Play Simulator.
- If you recommend a platform action, only mention features already present in the current context. Otherwise recommend a next HCP action, a coaching step, or the Role Play Simulator.
- Anchor every coaching point in Signal Intelligence capabilities and the 8 behavioral metrics when possible.

${groundingBlock}

${sessionCtxBlock}

CURRENT SECTION: ${currentTab}

Conversation so far:
${conversationHistory}`;
  }

  // Build a rich context message from roleplay alignment data
  function buildSessionContextMessage(ctx) {
    const { scenarioTitle, hcpCategory, specialty, misalignments = [], positives = [], capabilityScores = {}, overallScore, situation } = ctx;
    const misStr = misalignments.length > 0 ? misalignments.map(m => `• ${m}`).join("\n") : "None detected";
    const posStr = positives.length > 0 ? positives.map(p => `• ${p}`).join("\n") : "None noted";
    const capStr = Object.entries(capabilityScores)
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${describeSiScoreBand(v).label}`)
      .join(" | ");
    const overallNarrative = overallScore ? describeSiScoreBand(overallScore).label : "Signal still forming";

    return `I just completed a roleplay session and need context-aware feedback.

**Scenario:** ${scenarioTitle || "Unknown"}
**HCP:** ${hcpCategory || "HCP"} — ${specialty || "General"}
**Overall Session Evaluation:** ${overallNarrative}
${capStr ? `**Capability Evaluation Summary:** ${capStr}` : ""}

**What I Did Well:**
${posStr}

**Misalignments Detected:**
${misStr}

${situation ? `**My situation / what I was trying to do:** ${situation}` : ""}

Please give me specific, actionable feedback that directly addresses these misalignments and how to improve them, grounded in Signal Intelligence™ principles.`;
  }

  const addRolePlayLinks = (text) => {
    // Convert recommendation text to markdown link to Role Play Simulator
    const rpsUrl = createPageUrl("RolePlaySimulator");
    return text
      .replace(
        /I recommend practicing this in the Role Play Simulator/g,
        `[I recommend practicing this in the Role Play Simulator](${rpsUrl})`
      )
      .replace(
        /visit the Role Play Simulator/g,
        `[visit the Role Play Simulator](${rpsUrl})`
      )
      .replace(
        /the Role Play Simulator page/g,
        `[the Role Play Simulator page](${rpsUrl})`
      );
  };

  const generateAutoSessionCoaching = async (ctx) => {
    setIsLoading(true);
    try {
      const contextMessage = buildSessionContextMessage(ctx);
      const groundingBlock = buildFieldCoachingGrounding({
        surface: "ai_coach_session_synopsis",
        hcpType: ctx?.hcpCategory || "",
        specialty: ctx?.specialty || "",
        challenge: ctx?.scenarioTitle || "",
        weakestAreas: ctx?.misalignments || [],
        strongestAreas: ctx?.positives || [],
        customNotes: Object.entries(ctx?.capabilityScores || {}).map(([key, value]) => `${key.replace(/_/g, " ")}: ${value}/5`),
      });
      const prompt = `You are an expert AI Coach using Signal Intelligence™ source-of-truth behaviors.

${groundingBlock}

Session context:
${contextMessage}

Produce a concise coaching synopsis with EXACTLY these section headers:
## Session Snapshot
## Strengths to Keep
## Gaps to Fix
## Next-call Playbook

Rules:
- Use only observable behavior from provided context
- Tie recommendations to Signal Intelligence capabilities
- Keep it practical and specific
- No filler preamble`; 

      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (res.ok) {
        const data = await res.json();
        const coachResponse = sanitizeAiText(data.response || data.text || data.content || '');
        const coachText = typeof coachResponse === 'string' ? coachResponse : String(coachResponse);
        const finalResponse = addRolePlayLinks(coachText);
        const updatedMessages = [{ role: "assistant", content: finalResponse }];
        setMessages(updatedMessages);
        generateSessionSummary(updatedMessages);
      } else {
        setMessages([{ role: "assistant", content: "I encountered an issue generating coaching for this session. Please try again." }]);
      }
    } catch (err) {
      console.error('Auto session coaching error:', err);
      setMessages([{ role: "assistant", content: "I encountered an issue generating coaching for this session. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (text, silent = false, isContentToolExample = false) => {
    // Tab-aware topic guidance logic
    const userMsg = text || input;
    const currentTab = activeTab;
    respondToQuestion(userMsg, currentTab);
    if (!userMsg.trim()) return;

    const newMessages = silent
      ? [...messages, { role: "user", content: userMsg, hidden: true }]
      : [...messages, { role: "user", content: userMsg }];

    setMessages(newMessages);
    setInput("");

    const guardrailReply = getTopicGuardResponse(userMsg, "coach");
    if (guardrailReply) {
      const guardedMessages = [...newMessages, { role: "assistant", content: guardrailReply }];
      setMessages(guardedMessages);
      generateSessionSummary(guardedMessages);
      return;
    }

    setIsLoading(true);

    const conversationHistory = newMessages
      .filter(m => !m.hidden)
      .map((m) => `${m.role === "user" ? "User" : "AI Coach"}: ${m.content}`)
      .join("\n");

    const capabilitySummary = Object.entries(sessionContext?.capabilityScores || {})
      .map(([key, value]) => `${key.replace(/_/g, ' ')}=${describeSiScoreBand(value).label}`)
      .join(", ");

    // Build session context injection for the system prompt
    const sessionCtxBlock = sessionContext ? `
ACTIVE ROLEPLAY SESSION CONTEXT (inject as primary coaching lens):
- Scenario: "${sessionContext.scenarioTitle}"
- HCP: ${sessionContext.hcpCategory}, ${sessionContext.specialty}
- Overall Session Evaluation: ${sessionContext.overallScore ? describeSiScoreBand(sessionContext.overallScore).label : "Signal still forming"}
- Detected Misalignments: ${(sessionContext.misalignments || []).join(" | ") || "None"}
- Positives: ${(sessionContext.positives || []).join(" | ") || "None"}
- Capability Evaluation Summary: ${capabilitySummary || "None"}

COACHING MANDATE: When the user asks for feedback, directly reference these specific misalignments and positives. Quote behaviors, not traits. Provide concrete alternative language or actions for each misalignment.
` : "";

    // Call LLM endpoint with conversation and context
    try {
      const systemPrompt = buildEnterpriseCoachPrompt({
        conversationHistory,
        sessionCtxBlock,
        currentTab,
      });

      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: systemPrompt })
      });
      if (res.ok) {
        const data = await res.json();
        const coachResponse = sanitizeAiText(data.response || data.text || data.content || '');
        const coachText = typeof coachResponse === 'string' ? coachResponse : String(coachResponse);

        let finalResponse = coachText;
        // Add "Example Answer:" prefix if this is a content tool example
        if (isContentToolExample) {
          finalResponse = `Example:\n\n${coachText}`;
        }

        // Add Role Play Simulator links
        finalResponse = addRolePlayLinks(finalResponse);

        const updatedMessages = [...newMessages, { role: "assistant", content: finalResponse }];
        setMessages(updatedMessages);

        // If this was a content tool example, also show the follow-up prompt
        if (isContentToolExample && contentToolMode) {
          const toolData = contentTools.find(t => t.label === contentToolMode);
          if (toolData?.followUpPrompt) {
            setTimeout(() => {
              const followUpMsg = {
                role: "assistant",
                content: `\n\n${toolData.followUpPrompt}`
              };
              setMessages([...updatedMessages, followUpMsg]);
            }, 500);
          }
        } else {
          generateSessionSummary(updatedMessages);
        }
      } else {
        setMessages([...newMessages, { role: "assistant", content: "I encountered an issue generating feedback. Please try again." }]);
      }
    } catch (err) {
      console.error('AI Coach error:', err);
      setMessages([...newMessages, { role: "assistant", content: "I encountered an issue generating feedback. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSessionSummary = async (msgHistory) => {
    const visibleMessages = msgHistory.filter(m => !m.hidden);
    if (visibleMessages.length < 2) return;
    setGeneratingSummary(true);
    try {
      const conversationText = visibleMessages
        .map((m) => `${m.role === "user" ? "User" : "AI Coach"}: ${m.content}`)
        .join("\n");
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Analyze this AI Coach conversation and provide a brief 2-3 sentence summary of the key coaching insights and action items discussed. Be conversational and focused on practical takeaways:\n\n${conversationText}`,
        })
      });
      if (res.ok) {
        const data = await res.json();
        let summaryText = normalizeInvokeResponseText(data);
        // Strip markdown code blocks if present
        summaryText = summaryText.replace(/^```[\w]*\n?|\n?```$/g, '').trim();
        if (summaryText) setSessionSummary(summaryText);
      }
    } catch (err) {
      console.error('Summary generation error:', err);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const react = (idx, type) => {
    setReactions(prev => ({ ...prev, [idx]: prev[idx] === type ? null : type }));
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    setSessionSummary(null);
    setGeneratingSummary(false);
    setContentToolMode(null);
    setReactions({});
    setCopiedIdx(null);
    setIsLoading(false);
    setChatResetKey((k) => k + 1);
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-slate-100/70 xl:h-[calc(100vh-3.5rem)] xl:flex-row">
      {/* Main Chat Area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
        {/* Header */}
        <div className="w-full border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur-sm sm:px-6">
          <div className="enterprise-hero-light mx-auto flex w-full max-w-5xl flex-col gap-3 px-5 py-5 md:flex-row md:items-start md:justify-between sm:px-6">
            <div className="flex w-full min-w-0 items-start gap-3">
              <div className="hidden h-11 w-11 flex-shrink-0 sm:block" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-[28px]">AI Coach</h1>
                <div className="mt-2 w-full max-w-none space-y-1 text-sm leading-6 text-slate-600">
                  <p className="max-w-none break-words [word-break:normal] [overflow-wrap:break-word]">Work through real conversation challenges and refine your messaging with clarity and precision.</p>
                  <p className="max-w-none break-words [word-break:normal] [overflow-wrap:break-word]">Improve how you approach complex discussions through structured guidance and coaching.</p>
                </div>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap md:w-auto md:justify-end">
              <SessionSummaryPill
                sessionData={
                  messages.filter(m => !m.hidden).length > 0
                    ? {
                      title: "AI Coach Session",
                      duration: `${messages.filter(m => !m.hidden).length} messages`,
                      summary: sessionSummary || "Generating summary…",
                    }
                    : null
                }
                onRefresh={() => generateSessionSummary(messages)}
                isRefreshing={generatingSummary}
              />
              <Link to={createPageUrl("PreCallPlanning")} className="w-full sm:w-auto">
                <Button variant="outline" size="sm" className="w-full justify-center text-xs">
                  <ClipboardList className="mr-1 h-3 w-3" />
                  Pre-Call Plan
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center bg-teal-500 text-xs text-white hover:bg-teal-600 sm:w-auto"
                onClick={handleNewChat}
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                New Chat
              </Button>
            </div>
          </div>
        </div>

        {/* Content Tools Toolbar */}
        <div className="border-b border-slate-200 bg-slate-50/90 px-4 py-3 sm:px-6">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-start gap-2 overflow-hidden">
            <div className="mr-1 flex w-full items-center gap-1.5 text-xs font-semibold text-slate-500 sm:w-auto">
              <Sparkles className="h-3.5 w-3.5 text-teal-500" />
              Content Tools:
            </div>
            {contentTools.map((tool) => (
              <button
                key={tool.label}
                onClick={() => {
                  if (contentToolMode === null) {
                    // Enter tool mode: show example
                    setContentToolMode(tool.label);
                    sendMessage(tool.examplePrompt, false, true);
                  }
                }}
                disabled={isLoading || contentToolMode !== null}
                className="ui-pill max-w-full flex-shrink-0 px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {tool.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.9)_0%,rgba(241,245,249,0.7)_100%)] px-4 py-4 sm:px-5">
          <div className="mx-auto w-full max-w-4xl space-y-4">
            <div className="mx-auto w-full max-w-[56rem]">
              <TodaysTipCard />
            </div>
            {messages.filter(m => !m.hidden).length === 0 && !isLoading ? (
              <div className="enterprise-hero mx-auto w-full max-w-[56rem] px-4 py-6 text-center sm:px-10 sm:py-7">
                <div className="mx-auto mb-5 flex flex-col items-center justify-center gap-3 text-white sm:flex-row">
                  <h2 className="text-3xl font-bold leading-[1.05] sm:text-[44px]">Start a Conversation</h2>
                  <MessageSquare className="w-10 h-10 text-teal-200" />
                </div>
                <p className="mb-5 px-1 text-sm font-bold leading-6 text-slate-200/85">
                  What would you like to improve or learn about today?
                </p>
                <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-3">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="ui-pill ui-pill-ghost w-full justify-center rounded-2xl px-5 py-3 text-center text-[15px] leading-[1.35] font-medium shadow-sm"
                      title={q}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto w-full max-w-[58rem] space-y-5 overflow-x-hidden">
                {/* Session context banner */}
                {sessionContext && (
                  <div className="ui-surface-card space-y-3 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-teal-700">
                      <Sparkles className="w-3.5 h-3.5" />
                      Coaching session loaded from: <span className="italic">{sessionContext.scenarioTitle}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 overflow-hidden">
                      {sessionContext.misalignments?.length > 0 && (
                        <div className="flex-1 min-w-0 rounded-xl bg-rose-50 px-3 py-2">
                          <p className="text-xs font-semibold text-red-600 flex items-center gap-1 mb-1"><AlertTriangle className="w-3 h-3" /> Misalignments</p>
                          {sessionContext.misalignments.slice(0, 3).map((m, i) => (
                            <p key={i} className="text-xs text-gray-600">• {m}</p>
                          ))}
                        </div>
                      )}
                      {sessionContext.positives?.length > 0 && (
                        <div className="flex-1 min-w-0 rounded-xl bg-emerald-50 px-3 py-2">
                          <p className="text-xs font-semibold text-green-600 flex items-center gap-1 mb-1"><CheckCircle className="w-3 h-3" /> Positives</p>
                          {sessionContext.positives.slice(0, 3).map((p, i) => (
                            <p key={i} className="text-xs text-gray-600">• {p}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {messages.filter(m => !m.hidden).map((msg, visIdx) => (
                  <div
                    key={visIdx}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`w-full max-w-full sm:max-w-[88%] ${msg.role === "user" ? "sm:w-auto" : ""}`}>
                      <div
                        className={`overflow-hidden rounded-2xl px-4 py-4 text-sm shadow-sm sm:px-5 ${msg.role === "user"
                          ? "bg-teal-500 text-white"
                          : "bg-white border border-gray-200 text-gray-700"
                          }`}
                      >
                        {msg.role === "assistant" ? (
                          <div className="ui-markdown prose prose-sm max-w-none break-words text-gray-700 space-y-3 overflow-hidden">
                            <ReactMarkdown
                              components={{
                                p: ({ children, ...props }) => {
                                  const text = String(children ?? "").trim();
                                  if (!text) return null;
                                  return <p className="mb-2 whitespace-pre-wrap break-words leading-relaxed" {...props}>{children}</p>;
                                },
                                ul: ({ ...props }) => <ul className="list-disc pl-5 space-y-1.5 my-2" {...props} />,
                                ol: ({ ...props }) => <ol className="list-decimal pl-5 space-y-1.5 my-2" {...props} />,
                                li: ({ children, ...props }) => {
                                  const text = String(children ?? "").trim();
                                  if (!text) return null;
                                  return <li className="break-words text-sm leading-relaxed text-gray-700" {...props}>{children}</li>;
                                },
                                h1: ({ ...props }) => <h1 className="text-base font-bold mt-4 mb-2" {...props} />,
                                h2: ({ ...props }) => <h2 className="text-sm font-bold mt-3 mb-1.5" {...props} />,
                                h3: ({ ...props }) => <h3 className="text-sm font-semibold mt-3 mb-1" {...props} />,
                                strong: ({ ...props }) => <strong className="font-semibold text-gray-900" {...props} />,
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          msg.content
                        )}
                      </div>
                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-2 mt-1.5 px-1">
                          <button
                            onClick={() => copyToClipboard(msg.content, visIdx)}
                            className="ui-pill px-2.5 py-1 text-xs"
                          >
                            <Copy className="w-3 h-3" />
                            {copiedIdx === visIdx ? "Copied!" : "Copy"}
                          </button>
                          <button
                            onClick={() => react(visIdx, "up")}
                            className={`p-1 rounded transition-colors ${reactions[visIdx] === "up" ? "text-green-500" : "text-gray-300 hover:text-gray-500"}`}
                          >
                            <ThumbsUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => react(visIdx, "down")}
                            className={`p-1 rounded transition-colors ${reactions[visIdx] === "down" ? "text-red-400" : "text-gray-300 hover:text-gray-500"}`}
                          >
                            <ThumbsDown className="w-3 h-3" />
                          </button>
                          {reactions[visIdx] === "down" && (
                            <button
                              onClick={() => sendMessage("Can you try a different approach for your last response?")}
                              className="text-xs text-teal-600 hover:text-teal-700"
                            >
                              Regenerate
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" />
                        <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "0.1s" }} />
                        <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "0.2s" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.04)] sm:px-6 sm:py-4">
          {contentToolMode && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span className="text-teal-700 font-medium">Using: {contentToolMode}</span>
              <button
                type="button"
                onClick={() => setContentToolMode(null)}
                className="ml-auto text-teal-600 hover:text-teal-700 font-semibold"
              >
                Cancel
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (contentToolMode && input.trim()) {
                // In content tool mode: send user input as message, then exit tool mode
                setContentToolMode(null);
                sendMessage(input);
              } else if (!contentToolMode) {
                // Normal conversation mode
                sendMessage();
              }
            }}
            className="mx-auto flex w-full max-w-3xl flex-col gap-3 sm:flex-row"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={contentToolMode ? `Share your specific situation for ${contentToolMode}...` : "Type your message..."}
              className="min-h-[48px] w-full flex-1"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()} className="w-full bg-teal-500 hover:bg-teal-600 sm:w-auto">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      <div className="order-2 hidden xl:flex">
        <InsightsSidebar key={`insights-${chatResetKey}`} onSuggestedTopic={(topic) => sendMessage(topic)} messages={messages} />
      </div>
    </div>
  );
}
