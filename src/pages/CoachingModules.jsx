import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, MessageCircle, Users, FileText, ShieldAlert, CheckCircle2, Brain, BookOpen, Lightbulb, Target, ArrowRight, Sparkles, Loader2, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
// ...existing code...
import ReactMarkdown from "react-markdown";
import { SIGNAL_CAPABILITIES } from "@/components/roleplay/signalIntelligenceSOT";

// Extract all capability IDs from SOT (Single Source of Truth)
const ALL_CAPABILITY_IDS = SIGNAL_CAPABILITIES.map(c => c.id);

const modules = [
  {
    id: "question_mastery",
    title: "Question Mastery",
    icon: MessageCircle,
    iconBg: "bg-blue-100 text-blue-600",
    category: "Discovery",
    tagline: "Signal Awareness — Question Quality",
    capabilities: ["question_quality"],
    definition: "The ability to ask questions that are contextually grounded and move the conversation forward. Effective questions demonstrate that the rep is listening to what is happening right now, not reciting a script.",
    keyBehaviors: [
      { label: "Contextual Relevance", desc: "Ask questions that directly reflect what is happening in the current conversation — not generic discovery templates." },
      { label: "Forward Value", desc: "Every question should move the conversation toward something useful for the customer or the rep's understanding." },
      { label: "Avoid Premature Assumption", desc: "Do not ask leading questions that embed conclusions before the customer has shared their perspective." },
      { label: "Signal-Triggered Questions", desc: "Notice a shift in tone, engagement, or content — then ask a question that addresses that signal directly." },
    ],
    scoringAnchors: [
      { score: "5", desc: "Question directly addresses a live signal in the conversation and opens a productive path forward." },
      { score: "3", desc: "Question is relevant to the topic but not clearly tied to what just happened." },
      { score: "1", desc: "Question is scripted, off-topic, or ignores an obvious cue from the customer." },
    ],
    exercises: ["Practice identifying contextual cues before asking your next question", "Record a call and audit: did each question follow a signal?"],
    relatedCapabilities: ["question_quality", "listening_responsiveness", "customer_engagement_cues"],
    aiCoachPrompt: "Provide personalized advice for applying Signal Awareness (Question Quality) in pharma sales. Focus on how to craft contextual, signal-triggered questions that move conversations forward.",
  },
  {
    id: "stakeholder_mapping",
    title: "Stakeholder Mapping",
    icon: Users,
    iconBg: "bg-teal-100 text-teal-600",
    category: "Stakeholder",
    tagline: "Customer Engagement — Engagement Cues",
    capabilities: ["customer_engagement_cues", "listening_responsiveness"],
    definition: "Understanding the full healthcare decision ecosystem — identifying who influences prescribing behavior, who holds authority, and how to calibrate your approach based on the HCP category and influence driver.",
    keyBehaviors: [
      { label: "HCP Category Identification", desc: "Distinguish between KOL/Thought Leaders, Prescribers/Treaters, Non-Prescribing Influencers, and Low-Engagement HCPs." },
      { label: "Influence Driver Awareness", desc: "Recognize whether the stakeholder is Evidence-Based, Patient-Centered, Risk-Averse, or Guideline-Anchored, and adapt accordingly." },
      { label: "Engagement Cue Reading", desc: "Monitor verbal participation, responsiveness, and momentum continuity to gauge stakeholder engagement levels." },
      { label: "Signal Amplification", desc: "When a stakeholder shows interest or engagement, actively amplify that signal — lean in, ask deeper, acknowledge their input." },
    ],
    scoringAnchors: [
      { score: "5", desc: "Rep identifies the stakeholder type and influence driver, and adjusts approach in real time based on engagement signals." },
      { score: "3", desc: "Rep treats all stakeholders similarly but engages professionally without clear misalignment." },
      { score: "1", desc: "Rep ignores engagement cues or applies a one-size-fits-all approach to a clearly differentiated stakeholder." },
    ],
    exercises: ["Map the decision-making unit for a current territory account", "Identify the influence driver of your next 3 HCP calls before entering the office"],
    relatedCapabilities: ["customer_engagement_cues", "listening_responsiveness", "adaptability"],
    aiCoachPrompt: "Provide personalized advice for applying Stakeholder Mapping in pharma sales. Focus on identifying HCP types and influence drivers, and tailoring your engagement approach.",
  },
  {
    id: "clinical_evidence",
    title: "Clinical Evidence",
    icon: FileText,
    iconBg: "bg-cyan-100 text-cyan-600",
    category: "Clinical",
    tagline: "Value Connection — Value Framing",
    capabilities: ["making_it_matter"],
    definition: "The ability to present clinical data in a way that is directly relevant to what the customer cares about and translates into a clear patient or practice outcome — not just reciting study results.",
    keyBehaviors: [
      { label: "Customer Relevance Alignment", desc: "Connect the clinical data to the specific priorities the HCP has already expressed — not generic efficacy messages." },
      { label: "Outcome Translation", desc: "Go beyond data points: explain why the information matters for this patient population or this practice context." },
      { label: "Evidence Calibration", desc: "Match depth of evidence to the stakeholder — KOLs may want mechanistic detail; general practitioners may need patient-level outcomes." },
      { label: "Avoid Value Assertion Before Priority Establishment", desc: "Never present clinical value before understanding what the HCP prioritizes — this is a Signal–Response misalignment." },
    ],
    scoringAnchors: [
      { score: "5", desc: "Clinical data is tied explicitly to a priority the customer already stated, and the 'why it matters' is clearly articulated." },
      { score: "3", desc: "Data is accurate and relevant to the disease state but not personalized to this customer's expressed needs." },
      { score: "1", desc: "Data is delivered without connection to any customer priority; feels like a product monologue." },
    ],
    exercises: ["Reframe a clinical data point into an outcome statement for three different HCP profiles", "Practice the 'So what for your patients?' bridge after every efficacy claim"],
    relatedCapabilities: ["making_it_matter", "question_quality", "listening_responsiveness"],
    aiCoachPrompt: "Provide personalized advice for applying Clinical Evidence (Value Framing) in pharma sales. Focus on connecting clinical data to customer priorities and translating evidence into patient outcomes.",
  },
  {
    id: "objection_handling",
    title: "Objection Handling",
    icon: ShieldAlert,
    iconBg: "bg-orange-100 text-orange-600",
    category: "Objection",
    tagline: "Objection Navigation — Objection Handling",
    capabilities: ["objection_handling"],
    definition: "Responding to resistance or concerns in a way that keeps the conversation productive. Effective objection handling is non-defensive, demonstrates that the concern was heard, and engages the content of the objection constructively.",
    keyBehaviors: [
      { label: "Non-Defensive Response", desc: "When resistance appears, remain open and composed — do not become defensive or dismissive. Acknowledge before responding." },
      { label: "Constructive Engagement", desc: "Engage the objection's substance directly — do not deflect, minimize, or route around it without addressing it." },
      { label: "Acknowledge Before Advancing", desc: "A concern raised but not acknowledged before moving forward is a Signal–Response misalignment. Always confirm the concern has been heard." },
      { label: "Distinguish Objection Types", desc: "Identify whether resistance is informational (needs clarification), attitudinal (needs empathy first), or experiential (needs a different approach)." },
    ],
    scoringAnchors: [
      { score: "5", desc: "Rep acknowledges the concern explicitly, engages its substance, and redirects the conversation productively without defensiveness." },
      { score: "3", desc: "Rep acknowledges the concern but response is generic or does not fully address the content." },
      { score: "1", desc: "Rep skips over the concern, becomes defensive, or pivots immediately without acknowledgment." },
    ],
    exercises: ["Role-play with a colleague who raises three different objection types — practice the acknowledge-engage-redirect sequence", "Audit your last 5 objection moments: did you acknowledge before advancing?"],
    relatedCapabilities: ["objection_handling", "listening_responsiveness", "adaptability"],
    aiCoachPrompt: "Provide personalized advice for applying Objection Handling in pharma sales. Focus on non-defensive responses, acknowledging concerns, and redirecting conversations productively.",
  },
  {
    id: "closing_techniques",
    title: "Closing Techniques",
    icon: CheckCircle2,
    iconBg: "bg-green-100 text-green-600",
    category: "Closing",
    tagline: "Commitment Generation — Commitment Gaining",
    capabilities: ["commitment_gaining"],
    definition: "Guiding the conversation toward a clear, voluntary next step owned by the customer. Effective closing is not about pressure — it is about ensuring Next-Step Clarity and Customer Ownership emerge naturally from the conversation.",
    keyBehaviors: [
      { label: "Next-Step Clarity", desc: "The next action should be specific and actionable — not vague ('I'll think about it') but concrete ('I'll try it with my next eligible patient')." },
      { label: "Customer Ownership", desc: "The customer should voluntarily own the next step — not feel pushed into it. Commitment generated through pressure does not count as Signal Intelligence success." },
      { label: "Readiness Signal Recognition", desc: "When a readiness signal appears (tone shift, direct question, forward-looking statement), align immediately — do not miss the window." },
      { label: "Avoid Premature Close", desc: "Closing before engagement is established or value has been connected is a Signal–Response misalignment. Read readiness before asking for commitment." },
    ],
    scoringAnchors: [
      { score: "5", desc: "A clear, specific next step is established and the customer expresses voluntary ownership of it." },
      { score: "3", desc: "A next step is mentioned but lacks specificity or customer confirmation of ownership." },
      { score: "1", desc: "No next step is established, or close is attempted before value/readiness is present." },
    ],
    exercises: ["Practice summarizing the conversation into a 'natural next step' at the end of each role-play", "Identify the readiness signal in a past transcript — where was the window, and did you take it?"],
    relatedCapabilities: ["commitment_gaining", "conversation_control", "listening_responsiveness"],
    aiCoachPrompt: "Provide personalized advice for applying Closing Techniques (Commitment Generation) in pharma sales. Focus on creating specific next steps, recognizing readiness signals, and ensuring customer ownership.",
  },
  {
    id: "behavioral_mastery",
    title: "Behavioral Mastery",
    icon: Brain,
    iconBg: "bg-purple-100 text-purple-600",
    category: "Signal Intelligence",
    tagline: "All 8 Signal Intelligence Capabilities",
    capabilities: ALL_CAPABILITY_IDS,
    definition: "The integration of all Signal Intelligence capabilities into a coherent, adaptive, and observable behavioral repertoire. Behavioral Mastery means the rep is not following a script — they are reading and responding to what is actually happening.",
    keyBehaviors: [
      { label: "Adaptive Steering", desc: "Adjust conversation direction in real time based on what the customer signals — maintain Directional Clarity while being responsive." },
      { label: "Situational Responsiveness", desc: "Recognize when the situation has changed and shift approach accordingly — not mid-sentence pivots, but deliberate recalibration." },
      { label: "Signal–Response Alignment", desc: "Every rep action should be traceable to a customer signal. If you cannot identify the signal that prompted your action, recalibrate." },
      { label: "Approach Adjustment Quality", desc: "When you adjust, the new approach should be clearly better-suited to the current state of the conversation — not a random change." },
    ],
    scoringAnchors: [
      { score: "5", desc: "Rep demonstrates consistent, observable signal-reading across all capabilities — actions are traceable to customer cues throughout." },
      { score: "3", desc: "Rep is competent across most capabilities but shows gaps in one or two areas, particularly under pressure." },
      { score: "1", desc: "Rep applies a fixed script regardless of customer signals — no observable adaptation across the conversation." },
    ],
    exercises: ["Complete a full role-play with annotation enabled — review every highlighted moment and ask 'what signal did I respond to?'", "Select one capability per week for deliberate practice focus"],
    relatedCapabilities: ALL_CAPABILITY_IDS,
    aiCoachPrompt: "Provide personalized advice for achieving Behavioral Mastery across all Signal Intelligence Capabilities in pharma sales. Focus on integrating all capabilities into adaptive, responsive conversations.",
  },
];

export default function CoachingModules() {
  const [activeModule, setActiveModule] = useState(null);
  const [aiContent, setAiContent] = useState({});
  const [aiLoading, setAiLoading] = useState(null);

  const open = modules.find((m) => m.id === activeModule);

  const generateAIContent = async (moduleId, type) => {
    const key = `${moduleId}_${type}`;
    setAiLoading(key);
    const module = modules.find(m => m.id === moduleId);
    const prompts = {
      tips: `You are a pharma sales coach. Provide 5 advanced, actionable tips for mastering "${module.title}" based on Signal Intelligence™. Focus on observable behaviors and real-world application.`,
      example: `Write a realistic example conversation between a sales rep and HCP, where the rep demonstrates excellent "${module.title}". Include dialogue and brief coaching notes on what made each exchange effective.`,
      checklist: `Create a pre-call checklist for "${module.title}" that a sales rep can use before any HCP interaction. Format as a bulleted list of 8-10 specific, observable actions.`
    };
    try {
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompts[type] })
      });
      const data = await res.json();
      let content = data.response || data.text || data.content || '';
      // Strip markdown code blocks for clean display
      content = content.replace(/^```[\w]*\n?|\n?```$/g, '').trim();
      setAiContent(prev => ({ ...prev, [key]: content }));
    } catch {
      setAiContent(prev => ({ ...prev, [key]: 'AI service unavailable.' }));
    }
    setAiLoading(null);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Coaching Modules</h1>
        <p className="text-sm text-gray-500 mt-1">Signal Intelligence™ learning paths — definitions, key behaviors, and scoring anchors</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Module List */}
        <div className="lg:col-span-1 space-y-2">
          {modules.map((mod) => (
            <button
              key={mod.id}
              onClick={() => setActiveModule(activeModule === mod.id ? null : mod.id)}
              className={`w-full text-left rounded-xl border p-4 transition-all ${activeModule === mod.id
                ? "border-teal-400 bg-teal-50 shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300"
                }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${mod.iconBg}`}>
                  <mod.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900">{mod.title}</p>
                  <p className="text-xs text-gray-400 truncate">{mod.tagline}</p>
                </div>
                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${activeModule === mod.id ? "rotate-90" : ""}`} />
              </div>
              {activeModule === mod.id && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {mod.capabilities.slice(0, 3).map((c) => (
                    <span key={c} className="px-2 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800 border border-teal-200">
                      {c.replace(/_/g, " ")}
                    </span>
                  ))}
                  {mod.capabilities.length > 3 && <span className="text-xs text-gray-400">+{mod.capabilities.length - 3} more</span>}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2">
          {!open ? (
            <div className="h-full flex items-center justify-center text-center text-gray-400 border border-dashed border-gray-200 rounded-2xl py-20">
              <div>
                <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="font-medium text-gray-500">Select a module to view its content</p>
                <p className="text-sm mt-1">Definitions, key behaviors, scoring anchors, and exercises</p>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {/* Module Header */}
              <div className={`px-6 py-5 border-b ${open.iconBg.replace("text-", "border-").replace("bg-", "bg-").replace("100", "50")} border-opacity-50`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${open.iconBg}`}>
                    <open.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900">{open.title}</h2>
                    <p className="text-xs text-gray-500">{open.tagline}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {open.capabilities.map((c) => (
                    <span key={c} className="px-2.5 py-1.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 border border-teal-200">
                      {c.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-6 space-y-8 overflow-y-auto max-h-[70vh]">
                {/* Definition */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                    <h3 className="font-semibold text-sm text-gray-800">Definition</h3>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed bg-teal-50 border border-teal-100 rounded-lg p-4">{open.definition}</p>
                </section>

                {/* Key Behaviors */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-teal-500" />
                    <h3 className="font-semibold text-sm text-gray-800">Key Behaviors</h3>
                  </div>
                  <div className="space-y-3">
                    {open.keyBehaviors.map((b, i) => (
                      <div key={i} className="flex gap-3 p-4 bg-teal-50 border border-teal-100 rounded-lg">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0 mt-1" />
                        <div>
                          <span className="text-xs font-semibold text-gray-800">{b.label}: </span>
                          <span className="text-xs text-gray-600 leading-relaxed">{b.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Scoring Anchors */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-blue-500" />
                    <h3 className="font-semibold text-sm text-gray-800">Scoring Anchors (Signal Intelligence™ 1–5)</h3>
                  </div>
                  <div className="space-y-3">
                    {open.scoringAnchors.map((a, i) => {
                      const colors = { "5": "bg-green-50 border-green-200 text-green-800", "3": "bg-yellow-50 border-yellow-200 text-yellow-800", "1": "bg-red-50 border-red-200 text-red-800" };
                      return (
                        <div key={i} className={`flex gap-3 items-start p-4 rounded-lg border ${colors[a.score]}`}>
                          <span className="font-bold text-sm flex-shrink-0 w-12">{a.score}/5</span>
                          <span className="text-xs leading-relaxed">{a.desc}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Exercises */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowRight className="w-4 h-4 text-purple-500" />
                    <h3 className="font-semibold text-sm text-gray-800">Practice Exercises</h3>
                  </div>
                  <div className="space-y-3">
                    {open.exercises.map((ex, i) => (
                      <div key={i} className="flex gap-3 items-start p-3 bg-teal-50 border border-teal-100 rounded-lg">
                        <span className="text-xs font-bold text-teal-700 flex-shrink-0 w-5">{i + 1}.</span>
                        <p className="text-xs text-gray-600 leading-relaxed">{ex}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* AI-Powered Content Generation */}
                <section className="border-t border-gray-100 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-teal-500" />
                    <h3 className="font-semibold text-sm text-gray-800">AI-Generated Content</h3>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {[
                      { type: "tips", label: "Advanced Tips" },
                      { type: "example", label: "Example Conversation" },
                      { type: "checklist", label: "Pre-Call Checklist" },
                    ].map(({ type, label }) => {
                      const key = `${open.id}_${type}`;
                      const isLoading = aiLoading === key;
                      const hasContent = !!aiContent[key];
                      return (
                        <Button
                          key={type}
                          size="sm"
                          variant="outline"
                          className={`text-xs border border-slate-300 ${hasContent ? "bg-teal-500 hover:bg-teal-600 text-white border-teal-500" : "bg-white text-slate-700 hover:bg-teal-50"}`}
                          onClick={() => generateAIContent(open.id, type)}
                          disabled={isLoading || aiLoading !== null}
                        >
                          {isLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Wand2 className="w-3 h-3 mr-1" />}
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                  {["tips", "example", "checklist"].map((type) => {
                    const key = `${open.id}_${type}`;
                    if (!aiContent[key]) return null;
                    const titles = { tips: "Advanced Tips", example: "Example Conversation", checklist: "Pre-Call Checklist" };
                    return (
                      <div key={type} className="mb-4 bg-teal-50 border border-teal-100 rounded-xl p-5 space-y-3">
                        <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">{titles[type]}</p>
                        <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed space-y-2">
                          <ReactMarkdown>{aiContent[key]}</ReactMarkdown>
                        </div>
                      </div>
                    );
                  })}
                </section>

                {/* AI Coach Integration */}
                <section className="border-t border-gray-100 pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-4 h-4 text-teal-500" />
                    <h3 className="font-semibold text-sm text-gray-800">AI Coach</h3>
                  </div>
                  <p className="text-xs text-gray-600 mb-4 leading-relaxed">Describe your sales situation and get personalized advice based on {open.title}.</p>
                  <CoachInputPanel moduleId={open.id} moduleName={open.title} moduleTagline={open.tagline} />
                </section>

                {/* Links */}
                <section className="flex gap-3 pt-4 border-t border-gray-100">
                  <Link to={createPageUrl("RolePlaySimulator")} className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 font-medium">
                    <ArrowRight className="w-3.5 h-3.5" /> Practice in Role Play
                  </Link>
                  <Link to={createPageUrl("Exercises")} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
                    <ArrowRight className="w-3.5 h-3.5" /> Try an Exercise
                  </Link>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CoachInputPanel({ moduleId, moduleName, moduleTagline }) {
  const [input, setInput] = React.useState("");
  const [response, setResponse] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  const handleGetAdvice = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `You are a pharma sales coach specializing in Signal Intelligence™. A sales rep is asking for advice on applying "${moduleName}" (${moduleTagline}) to their situation. \n\nTheir situation: "${input}"\n\nProvide 2-3 specific, actionable recommendations grounded in observable behavior. Reference Signal Intelligence™ principles where relevant. Keep response concise and practical.` })
      });
      const data = await res.json();
      setResponse(data.response || data.text || data.content || '');
    } catch {
      setResponse('AI service unavailable.');
    }
    setIsLoading(false);
  };

  return (
    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg border border-teal-200 p-5 space-y-4">
      <textarea
        placeholder="E.g., 'I'm meeting with a skeptical cardiologist who prefers data-driven conversations...'"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="w-full text-sm rounded-lg border border-teal-200 bg-white p-4 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none leading-relaxed"
        rows="3"
      />
      <Button
        onClick={handleGetAdvice}
        disabled={isLoading || !input.trim()}
        className="w-full bg-teal-500 hover:bg-teal-600 text-white text-xs font-medium"
      >
        {isLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
        {isLoading ? "Getting Advice..." : "Get AI Advice"}
      </Button>
      {response && (
        <div className="bg-white rounded-lg p-5 border border-teal-100 text-xs text-gray-700 leading-relaxed space-y-3">
          <div className="prose prose-sm max-w-none text-gray-700 space-y-2">
            <ReactMarkdown>{response}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}