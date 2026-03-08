import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, RefreshCw, ClipboardList, Sparkles, Copy, ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import ReactMarkdown from "react-markdown";
import InsightsSidebar from "@/components/coach/InsightsSidebar";
import SessionSummaryPill from "@/components/coach/SessionSummaryPill";

const suggestedQuestions = [
  "How can I better understand what motivates healthcare providers in my territory?",
  "What are effective ways to handle objections about clinical evidence?",
  "Help me prepare for a conversation with a skeptical physician",
  "Draft me an opening statement for a first call with an oncologist",
  "Suggest improvements to this message: 'Our drug is the best option for your patients'",
];

const contentTools = [
  { 
    label: "Draft Opening", 
    examplePrompt: "Draft me a compelling opening statement for a first HCP visit. Make it signal-intelligence focused and non-product-first.",
    followUpPrompt: "Now, please share your specific situation (HCP type, territory, context) so I can draft a more tailored opening for your needs."
  },
  { 
    label: "Objection Responses", 
    examplePrompt: "Generate 3 different response options for this common objection: 'I already have a preferred treatment and I'm not looking to change.'",
    followUpPrompt: "Now, please share the specific objection you're facing so I can generate tailored response options for you."
  },
  { 
    label: "Follow-up Email", 
    examplePrompt: "Write a professional follow-up email to send after a productive HCP meeting. Keep it brief, value-focused, and referencing the Signal Intelligence framework.",
    followUpPrompt: "Now, please share details about your meeting (HCP type, what was discussed, key points) so I can draft a customized follow-up email."
  },
  { 
    label: "Improve My Message", 
    examplePrompt: "I can help you improve your message using Signal Intelligence principles. Please share the message you'd like me to review.",
    followUpPrompt: null // This one goes straight to user input
  },
  { 
    label: "Content Ideas", 
    examplePrompt: "Here are 5 creative ways you can add value to your next HCP conversation beyond just presenting product data: [example ideas]",
    followUpPrompt: "Now, please share your specific situation (HCP type, therapeutic area, relationship stage) so I can suggest more targeted value-add ideas."
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
      const intro = buildSessionContextMessage(sessionContext);
      sendMessage(intro, true);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const [copiedIdx, setCopiedIdx] = useState(null);
  const [reactions, setReactions] = useState({});

  // Build a rich context message from roleplay alignment data
  function buildSessionContextMessage(ctx) {
    const { scenarioTitle, hcpCategory, specialty, misalignments = [], positives = [], capabilityScores = {}, overallScore, situation } = ctx;
    const misStr = misalignments.length > 0 ? misalignments.map(m => `• ${m}`).join("\n") : "None detected";
    const posStr = positives.length > 0 ? positives.map(p => `• ${p}`).join("\n") : "None noted";
    const capStr = Object.entries(capabilityScores).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}/5`).join(" | ");

    return `I just completed a roleplay session and need context-aware feedback.

**Scenario:** ${scenarioTitle || "Unknown"}
**HCP:** ${hcpCategory || "HCP"} — ${specialty || "General"}
**Overall Alignment Score:** ${overallScore || "?"}/5
${capStr ? `**Capability Scores:** ${capStr}` : ""}

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

  const sendMessage = async (text, silent = false, isContentToolExample = false) => {
    const userMsg = text || input;
    if (!userMsg.trim()) return;

    const newMessages = silent
      ? [...messages, { role: "user", content: userMsg, hidden: true }]
      : [...messages, { role: "user", content: userMsg }];

    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const conversationHistory = newMessages
      .filter(m => !m.hidden)
      .map((m) => `${m.role === "user" ? "User" : "AI Coach"}: ${m.content}`)
      .join("\n");

    // Build session context injection for the system prompt
    const sessionCtxBlock = sessionContext ? `
ACTIVE ROLEPLAY SESSION CONTEXT (inject as primary coaching lens):
- Scenario: "${sessionContext.scenarioTitle}"
- HCP: ${sessionContext.hcpCategory}, ${sessionContext.specialty}
- Overall Alignment Score: ${sessionContext.overallScore}/5
- Detected Misalignments: ${(sessionContext.misalignments || []).join(" | ") || "None"}
- Positives: ${(sessionContext.positives || []).join(" | ") || "None"}
- Capability Scores: ${Object.entries(sessionContext.capabilityScores || {}).map(([k, v]) => `${k.replace(/_/g, ' ')}=${v}/5`).join(", ")}

COACHING MANDATE: When the user asks for feedback, directly reference these specific misalignments and positives. Quote behaviors, not traits. Provide concrete alternative language or actions for each misalignment.
` : "";

    // Call LLM endpoint with conversation and context
    try {
      const systemPrompt = `You are an expert sales coach and pharmaceutical industry knowledge expert specializing in Sales Intelligence behaviors. You help reps in two ways:

1. ANSWER KNOWLEDGE QUESTIONS: When the user asks for information, knowledge, or insights about pharmaceutical sales, HCP considerations, frameworks, strategies, cultural factors, clinical evidence, or industry topics—provide comprehensive, factual answers with relevant statistics and examples.

2. PROVIDE COACHING FEEDBACK: When the user explicitly asks for feedback on their approach, their questions, or shares a message/approach they'd like reviewed—provide personalized coaching feedback grounded in Signal Intelligence™ principles.

IMPORTANT GUIDELINES:
- ONLY discuss this current conversation. DO NOT reference "previous sessions", "former conversations", or "past roleplays"
- Distinguish between info questions and coaching requests. Answer info questions directly without treating them as sales practice.
- NEVER offer to do roleplay practice with the user. Instead, if relevant, recommend "I recommend practicing this in the Role Play Simulator to test it out with an HCP"
- When providing coaching, keep feedback specific and actionable
- Ground all advice in Signal Intelligence™ principles
- Be encouraging but honest

${sessionCtxBlock}

Conversation so far:
${conversationHistory}

Respond as the AI Coach. If this is a knowledge/info question, provide a comprehensive answer. If this is a coaching request, provide helpful feedback grounded in observable patterns and behaviors.`;

      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: systemPrompt })
      });
      if (res.ok) {
        const data = await res.json();
        const coachResponse = (data.response || data.text || data.content || '');
        const coachText = typeof coachResponse === 'string' ? coachResponse : String(coachResponse);
        
        let finalResponse = coachText;
        // Add "Example:" prefix if this is a content tool example
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
        let summaryText = (data.response || data.text || data.content || '').trim();
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

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500 text-white flex items-center justify-center font-semibold">
              R
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">AI Coach</h1>
              <p className="text-xs text-gray-500">Your personal pharma sales coaching assistant</p>
            </div>
          </div>
          <div className="flex gap-2">
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
            <Link to={createPageUrl("PreCallPlanning")}>
              <Button variant="outline" size="sm" className="text-xs">
                <ClipboardList className="w-3 h-3 mr-1" />
                Pre-Call Plan
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="bg-teal-500 text-white hover:bg-teal-600 text-xs"
              onClick={() => setMessages([])}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              New Chat
            </Button>
          </div>
        </div>

        {/* Content Tools Toolbar */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mr-1">
              <Sparkles className="w-3.5 h-3.5 text-teal-500" />
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
                className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-full hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 transition-all disabled:opacity-50"
              >
                {tool.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {messages.filter(m => !m.hidden).length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageSquare className="w-16 h-16 text-gray-200 mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Start a Conversation</h2>
              <p className="text-sm text-gray-500 max-w-md mb-8">
                Ask me anything about pharma sales, signal intelligence frameworks, objection handling, or clinical evidence communication.
              </p>
              <div className="w-full max-w-lg space-y-3">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="w-full p-3 text-sm text-left text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-teal-300 hover:bg-teal-50 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-5">
              {/* Session context banner */}
              {sessionContext && (
                <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-700">
                    <Sparkles className="w-3.5 h-3.5" />
                    Coaching session loaded from: <span className="italic">{sessionContext.scenarioTitle}</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {sessionContext.misalignments?.length > 0 && (
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-red-600 flex items-center gap-1 mb-1"><AlertTriangle className="w-3 h-3" /> Misalignments</p>
                        {sessionContext.misalignments.slice(0, 3).map((m, i) => (
                          <p key={i} className="text-xs text-gray-600">• {m}</p>
                        ))}
                      </div>
                    )}
                    {sessionContext.positives?.length > 0 && (
                      <div className="flex-1 min-w-0">
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
                  <div className={`max-w-[80%] ${msg.role === "user" ? "" : "w-full"}`}>
                    <div
                      className={`rounded-2xl px-5 py-4 text-sm ${msg.role === "user"
                        ? "bg-teal-500 text-white"
                        : "bg-white border border-gray-200 text-gray-700"
                        }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none text-gray-700 space-y-3">
                          <ReactMarkdown
                            components={{
                              p: ({ children, ...props }) => {
                                const text = String(children ?? "").trim();
                                if (!text) return null;
                                return <p className="leading-relaxed mb-2" {...props}>{children}</p>;
                              },
                              ul: ({ ...props }) => <ul className="list-disc pl-5 space-y-1.5 my-2" {...props} />,
                              ol: ({ ...props }) => <ol className="list-decimal pl-5 space-y-1.5 my-2" {...props} />,
                              li: ({ children, ...props }) => {
                                const text = String(children ?? "").trim();
                                if (!text) return null;
                                return <li className="text-sm text-gray-700 leading-relaxed" {...props}>{children}</li>;
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
                          className="inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all duration-200 text-xs px-2.5 py-0.5 border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7]"
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
                  <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
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

        {/* Input */}
        <div className="px-6 py-4 border-t border-gray-200 bg-white">
          {contentToolMode && (
            <div className="mb-3 flex items-center gap-2 text-xs bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
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
                // In content tool mode: send follow-up with user's specific context
                const tool = contentTools.find(t => t.label === contentToolMode);
                if (tool) {
                  const followUpText = `${tool.followUpPrompt}\n\nUser's situation: ${input}`;
                  setContentToolMode(null); // Exit tool mode
                  sendMessage(followUpText);
                }
              } else if (!contentToolMode) {
                // Normal conversation mode
                sendMessage();
              }
            }}
            className="flex gap-3 max-w-3xl mx-auto"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={contentToolMode ? `Share your specific situation for ${contentToolMode}...` : "Type your message..."}
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()} className="bg-teal-500 hover:bg-teal-600">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>

      <InsightsSidebar onSuggestedTopic={(topic) => sendMessage(topic)} messages={messages} />
    </div>
  );
}