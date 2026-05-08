import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getTopicGuardResponse, sanitizeAiText } from "@/lib/aiTopicGuard";

const FAQ = [
  {
    question: "What is Signal Intelligence™?",
    answer: "Signal Intelligence™ is a behavioral framework for pharmaceutical sales professionals that defines 8 core capabilities: Signal Awareness, Signal Interpretation, Value Connection, Customer Engagement, Objection Navigation, Conversation Management, Adaptive Response, and Commitment Generation. Each capability is measured through observable behaviors during HCP interactions.",
  },
  {
    question: "How does the Role-Play Simulator work?",
    answer: "The simulator pairs you with an AI-driven HCP persona. As you respond, the system measures your alignment across all 8 Signal Intelligence™ capabilities in real time, providing a live score and post-session feedback report. The HCP's state evolves based on your conversational choices.",
  },
  {
    question: "How is my performance scored?",
    answer: "Each message you send is evaluated by a deterministic alignment engine against the current HCP state. Scores are calculated per capability on a 1–5 scale and rolled up into an overall session score. The system tracks patterns across the session, not just individual messages.",
  },
  {
    question: "What is the AI Coach used for?",
    answer: "The AI Coach provides open-ended coaching assistance — drafting call openings, handling objections, refining messaging, and generating pre-call plans. It is always available from the sidebar and within the Help Center below.",
  },
  {
    question: "How do I use the Pre-Call Planning tool?",
    answer: "Navigate to Pre-Call Planning, enter the HCP's name, specialty, and disease state. Use the AI generation button to auto-populate objectives, key messages, and anticipated objections based on context. Plans can be saved and revisited before any call.",
  },
  {
    question: "Can I create my own scenarios?",
    answer: "Yes. Use the Scenario Builder to define a custom HCP persona, set the disease state, specialty, difficulty, and focus capabilities. Your scenario will be available immediately in the Role-Play Simulator.",
  },
  {
    question: "What does 'Adaptive Response' measure?",
    answer: "Adaptive Response measures whether you meaningfully adjust your approach in response to HCP feedback, new information, or shifts in tone. It penalizes repetitive phrasing, failure to acknowledge the HCP's position, and missed pivots after resistance.",
  },
  {
    question: "How do I interpret behavioral metrics?",
    answer: "Navigate to Behavioral Metrics to see a full breakdown of all 8 capabilities, each with its definition, observable sub-metrics, coaching diagnostics, and canonical question. Select any capability card to view its full detail panel.",
  },
];

const SECTIONS = [
  { id: "platform", label: "Platform Overview" },
  { id: "roleplay", label: "Role-Play Simulator" },
  { id: "scoring", label: "Scoring & Metrics" },
  { id: "coaching", label: "AI Coaching Tools" },
  { id: "faq", label: "FAQ" },
  { id: "chat", label: "Ask AI Coach" },
];

const RESOURCE_LINKS = [
  { title: "Market Insights — McKinsey Life Sciences", href: "https://www.mckinsey.com/industries/life-sciences/our-insights", description: "Customer and market trends shaping biotech and pharma strategy." },
  { title: "Life Sciences Commercial Insights", href: "https://www.fiercepharma.com", description: "Recent biotech and pharma market developments." },
  { title: "FDA Newsroom", href: "https://www.fda.gov/news-events", description: "Regulatory announcements and policy updates." },
];

function FaqItem({ item, idx: _idx }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      layout
      className="overflow-hidden rounded-xl border border-teal-200"
      whileHover={{ y: -1, boxShadow: "0 4px 16px rgba(26,51,77,0.07)" }}
      transition={{ duration: 0.15 }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900 pr-4">{item.question}</span>
        <span className="text-xs font-medium flex-shrink-0 px-2 py-0.5 rounded-full" style={{ background: open ? "#e6f7f7" : "#f1f5f9", color: open ? "#1A334D" : "#64748b" }}>
          {open ? "Close" : "View"}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-4 pb-4 pt-1 bg-white border-t border-gray-100">
              <p className="text-sm text-gray-600 leading-relaxed">{item.answer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function InfoSection({ title, children }) {
  return (
    <div className="mb-8 rounded-[24px] border border-teal-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      <h2 className="text-base font-bold text-gray-900 mb-4 pb-3 border-b border-gray-100">{title}</h2>
      {children}
    </div>
  );
}

function AIChatPanel() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello. I'm the ReflectivAI Coach. Ask me anything about the platform, Signal Intelligence™ capabilities, or how to improve your practice sessions." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    const guardrailReply = getTopicGuardResponse(userMsg.content, "platform");
    if (guardrailReply) {
      setMessages(prev => [...prev, { role: "assistant", content: guardrailReply }]);
      return;
    }

    setLoading(true);

    const history = [...messages, userMsg].map(m => `${m.role === "user" ? "User" : "Coach"}: ${m.content}`).join("\n");

    // Call LLM for help center response
    let reply = "I encountered an issue. Please try again.";
    try {
      const prompt = `You are a helpful AI assistant for ReflectivAI, a sales coaching platform focused on Signal Intelligence™ training. You help users understand the platform features, Signal Intelligence concepts, and how to effectively use the coaching tools.

User conversation history:
${history}

Respond helpfully and conversationally. If they ask about Signal Intelligence, explain it as: "Signal Intelligence™ is the ability to recognize, interpret, and respond to buyer behavioral signals during a sales conversation. It includes five core capabilities: Signal Awareness, Signal Interpretation, Value Connection, Objection Navigation, and Commitment Generation."`;
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 500 })
      });
      if (res.ok) {
        const data = await res.json();
        reply = sanitizeAiText(typeof data.response === 'string' ? data.response : String(data.response));
      }
    } catch (err) {
      console.error('Help center error:', err);
    }

    setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    setLoading(false);
  };

  return (
    <div className="flex h-[480px] flex-col overflow-hidden rounded-[24px] border border-teal-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
      <div className="px-4 py-3 border-b border-gray-100" style={{ background: "#1A334D" }}>
        <p className="text-sm font-semibold text-white">AI Coach — Help Center</p>
        <p className="text-xs" style={{ color: "#39ACAC" }}>Ask anything about the platform or Signal Intelligence™</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[82%] px-3 py-2 rounded-xl text-sm leading-relaxed ${m.role === "user"
                ? "text-white"
                : "bg-gray-50 text-gray-800 border border-gray-100"
                }`}
              style={m.role === "user" ? { background: "#39ACAC" } : {}}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-50 border border-gray-100 px-3 py-2 rounded-xl text-sm text-gray-400 italic">
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-gray-100 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Ask a question..."
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-teal-400 transition-colors"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
          style={{ background: "#39ACAC" }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default function HelpCenter() {
  const [activeSection, setActiveSection] = useState("platform");

  return (
    <div className="min-h-screen bg-slate-100/80">
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 overflow-hidden rounded-[32px] border border-[#1A334D]/10 bg-[linear-gradient(135deg,#0f172a_0%,#1A334D_55%,#2c8d89_100%)] p-6 text-white shadow-[0_26px_70px_rgba(15,23,42,0.24)] md:p-7">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-teal-200">Support + Enablement Hub</p>
            <h1 className="mt-3 text-3xl font-bold md:text-[40px] md:leading-[1.05]">Help Center</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200 md:text-base">Documentation, practical guidance, and AI-powered coaching support in one enterprise-grade reference workspace.</p>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-100">What you can do here</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-100">
              <div className="rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3">Review platform guidance and scoring methodology.</div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3">Navigate FAQs and operational best practices.</div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3">Ask the built-in AI Coach for just-in-time support.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-[28px] border border-teal-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Featured Resources</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {RESOURCE_LINKS.map((link) => (
            <a
              key={link.title}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-teal-200 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400 hover:bg-teal-50 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-[#1A334D]">{link.title}</p>
              <p className="text-xs text-gray-600 mt-1">{link.description}</p>
            </a>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Nav */}
        <aside className="lg:w-60 flex-shrink-0">
          <nav className="sticky top-6 space-y-1 rounded-[24px] border border-teal-200 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            {SECTIONS.map(s => (
              <motion.button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                whileHover={{ x: 3 }}
                transition={{ duration: 0.15 }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === s.id
                  ? "text-white"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                style={activeSection === s.id ? { background: "#1A334D" } : {}}
              >
                {s.label}
              </motion.button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {activeSection === "platform" && (
                <InfoSection title="Platform Overview">
                  <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
                    <p>ReflectivAI is a Signal Intelligence™ training platform designed for pharmaceutical sales professionals. It combines AI-driven role-play simulations, deterministic behavioral scoring, and structured coaching modules to develop observable, measurable sales skills.</p>
                    <p>The platform is organized into three areas:</p>
                    <ul className="space-y-2 pl-4">
                      {[
                        "Core Activities — Role-play, AI Coach, Pre-Call Planning, Exercises, Coaching Modules",
                        "Insights & Measurement — Behavioral Metrics, Performance Analytics, Data & Reports",
                        "Enablement — Selling Frameworks, Knowledge Base",
                      ].map(item => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#39ACAC" }} />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <p>All scoring is grounded in observable behavior — no inference about intent, emotion, or personality. This ensures consistent, defensible measurement across reps and sessions.</p>
                  </div>
                </InfoSection>
              )}

              {activeSection === "roleplay" && (
                <InfoSection title="Role-Play Simulator">
                  <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
                    <p>The Role-Play Simulator is the primary practice environment. Each scenario pairs you with an AI-driven HCP persona that evolves based on your conversational behavior.</p>
                    <div className="space-y-2 rounded-xl border border-teal-200 p-4" style={{ background: "#f8fafc" }}>
                      <p className="font-semibold text-gray-900">How a Session Works</p>
                      <ol className="space-y-2 list-decimal pl-4">
                        {[
                          "Select a scenario from the library or use the Scenario Builder to create a custom one.",
                          "The HCP opens the conversation based on their defined mood and context.",
                          "Each message you send is scored across 8 Signal Intelligence™ capabilities.",
                          "The HCP state updates in real time — engagement, openness, and resistance shift based on your responses.",
                          "End the session at any time to receive a full feedback report.",
                        ].map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                    <p>Use the Live Metrics panel on the right side of the simulator to monitor your capability scores and detected signals in real time.</p>
                  </div>
                </InfoSection>
              )}

              {activeSection === "scoring" && (
                <InfoSection title="Scoring & Metrics">
                  <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
                    <p>Scores are calculated by the Signal Intelligence™ Alignment Engine — a deterministic system that evaluates each message against the current HCP state. Scores are not AI-generated; they are computed from explicit behavioral rules.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { cap: "Signal Awareness", def: "Detecting cues, shifts, and unspoken signals in the HCP's responses." },
                        { cap: "Signal Interpretation", def: "Accurately reading the meaning and implication of detected signals." },
                        { cap: "Value Connection", def: "Linking your message to the HCP's stated or implied priorities." },
                        { cap: "Customer Engagement", def: "Monitoring and responding to changes in HCP engagement level." },
                        { cap: "Objection Navigation", def: "Addressing resistance constructively without dismissing the HCP." },
                        { cap: "Conversation Management", def: "Structuring the conversation with purpose and clear direction." },
                        { cap: "Adaptive Response", def: "Adjusting approach based on new information or HCP feedback." },
                        { cap: "Commitment Generation", def: "Securing specific, voluntary next steps from the HCP." },
                      ].map(item => (
                        <div key={item.cap} className="rounded-lg border border-teal-200 bg-white p-3">
                          <p className="font-semibold text-xs mb-0.5" style={{ color: "#1A334D" }}>{item.cap}</p>
                          <p className="text-xs text-gray-500">{item.def}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </InfoSection>
              )}

              {activeSection === "coaching" && (
                <InfoSection title="AI Coaching Tools">
                  <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
                    <p>ReflectivAI includes several AI-powered tools that can be used independently or as part of a structured session.</p>
                    {[
                      { title: "AI Coach", desc: "Open-ended conversational coaching. Use it to draft call openings, handle objections, refine messaging, or prepare for specific HCP types. Available from the left navigation under Core Activities." },
                      { title: "Pre-Call Planning", desc: "Enter an HCP's name, specialty, and disease state. The AI generates objectives, key messages, and anticipated objections. Plans are saved for reference." },
                      { title: "Coaching Modules", desc: "Structured modules aligned to each Signal Intelligence™ capability. Each module includes definitions, key behaviors, scoring anchors, and AI-generated practice tips." },
                      { title: "Exercises", desc: "Topic-based AI quizzes and micro role-plays. Use these for targeted skill-building outside of full simulation sessions." },
                      { title: "Help Center AI Coach", desc: "Available on this page. Ask questions about the platform, capabilities, or best practices and receive immediate coaching guidance." },
                    ].map(tool => (
                      <div key={tool.title} className="rounded-xl border border-teal-200 bg-white p-4">
                        <p className="font-semibold text-gray-900 mb-1">{tool.title}</p>
                        <p className="text-gray-600">{tool.desc}</p>
                      </div>
                    ))}
                  </div>
                </InfoSection>
              )}

              {activeSection === "faq" && (
                <InfoSection title="Frequently Asked Questions">
                  <div className="space-y-2">
                    {FAQ.map((item, i) => (
                      <FaqItem key={i} item={item} idx={i} />
                    ))}
                  </div>
                </InfoSection>
              )}

              {activeSection === "chat" && (
                <InfoSection title="Ask AI Coach">
                  <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                    Ask the AI Coach any question about the platform, Signal Intelligence™ framework, scoring, or coaching tools. Responses are grounded in the ReflectivAI methodology.
                  </p>
                  <AIChatPanel />
                </InfoSection>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
    </div>
  );
}
