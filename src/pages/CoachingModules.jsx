// @ts-nocheck
import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, MessageCircle, Users, FileText, ShieldAlert, CheckCircle2, Brain, BookOpen, Lightbulb, Target, ArrowRight, Sparkles, Loader2, Wand2, GraduationCap, Layers3 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import ReactMarkdown from "react-markdown";
import { SIGNAL_CAPABILITIES } from "@/components/roleplay/signalIntelligenceSOT";

const ALL_CAPABILITY_IDS = SIGNAL_CAPABILITIES.map((c) => c.id);
const CAPABILITY_LABELS = Object.fromEntries(SIGNAL_CAPABILITIES.map((capability) => [capability.id, capability.label || capability.name || capability.id.replace(/_/g, " ")]));

const modules = [
  {
    id: "question_mastery",
    title: "Question Mastery",
    icon: MessageCircle,
    iconBg: "bg-slate-100 text-slate-700",
    category: "Discovery",
    tagline: "Signal Awareness — Question Quality",
    capabilities: ["signal_awareness"],
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
    relatedCapabilities: ["signal_awareness", "signal_interpretation", "customer_engagement"],
  },
  {
    id: "stakeholder_mapping",
    title: "Stakeholder Mapping",
    icon: Users,
    iconBg: "bg-teal-100 text-teal-600",
    category: "Stakeholder",
    tagline: "Customer Engagement — Engagement Cues",
    capabilities: ["customer_engagement", "signal_interpretation"],
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
    relatedCapabilities: ["customer_engagement", "signal_interpretation", "adaptive_response"],
  },
  {
    id: "clinical_evidence",
    title: "Clinical Evidence",
    icon: FileText,
    iconBg: "bg-teal-50 text-teal-700",
    category: "Clinical",
    tagline: "Value Connection — Value Framing",
    capabilities: ["value_connection"],
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
    relatedCapabilities: ["value_connection", "signal_awareness", "signal_interpretation"],
  },
  {
    id: "objection_handling",
    title: "Objection Handling",
    icon: ShieldAlert,
    iconBg: "bg-amber-50 text-amber-700",
    category: "Objection",
    tagline: "Objection Navigation — Objection Handling",
    capabilities: ["objection_navigation"],
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
    relatedCapabilities: ["objection_navigation", "signal_interpretation", "adaptive_response"],
  },
  {
    id: "closing_techniques",
    title: "Closing Techniques",
    icon: CheckCircle2,
    iconBg: "bg-green-100 text-green-600",
    category: "Closing",
    tagline: "Commitment Generation — Commitment Gaining",
    capabilities: ["commitment_generation"],
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
    relatedCapabilities: ["commitment_generation", "conversation_management", "signal_interpretation"],
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
  },
];

function capabilityLabel(capabilityId) {
  return CAPABILITY_LABELS[capabilityId] || capabilityId.replace(/_/g, " ");
}

const markdownComponents = {
  ul: ({ children }) => <ul className="ui-bullet-list">{children}</ul>,
  ol: ({ children }) => <ol className="ui-bullet-list ui-bullet-list-ordered">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  p: ({ children }) => <p className="leading-relaxed text-gray-700">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
};

function SectionHeader({ icon: Icon, iconClassName, title }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className={`h-4 w-4 ${iconClassName}`} />
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
    </div>
  );
}

export default function CoachingModules() {
  const [activeModule, setActiveModule] = useState(modules[0]?.id ?? null);
  const [aiContent, setAiContent] = useState({});
  const [aiLoading, setAiLoading] = useState(null);
  const [selectedAiType, setSelectedAiType] = useState({});

  const open = useMemo(() => modules.find((m) => m.id === activeModule), [activeModule]);

  const generateAIContent = async (moduleId, type) => {
    const key = `${moduleId}_${type}`;
    setSelectedAiType((prev) => ({ ...prev, [moduleId]: type }));
    if (aiContent[key]) return;
    setAiLoading(key);
    const module = modules.find((m) => m.id === moduleId);
    const prompts = {
      tips: `You are a pharma sales coach. Provide 5 advanced, actionable tips for mastering "${module.title}" based on Signal Intelligence™. Focus on observable behaviors and real-world application.`,
      example: `Write a realistic example conversation between a sales rep and HCP, where the rep demonstrates excellent "${module.title}". Include dialogue and brief coaching notes on what made each exchange effective.`,
      checklist: `Create a pre-call checklist for "${module.title}" that a sales rep can use before any HCP interaction. Format as a bulleted list of 8-10 specific, observable actions.`,
    };
    try {
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompts[type] })
      });
      const data = await res.json();
      let content = data.response || data.text || data.content || '';
      content = content.replace(/^```[\w]*\n?|\n?```$/g, '').trim();
      setAiContent((prev) => ({ ...prev, [key]: content }));
    } catch {
      setAiContent((prev) => ({ ...prev, [key]: 'AI service unavailable.' }));
    }
    setAiLoading(null);
  };

  const activeAiType = open ? selectedAiType[open.id] : null;
  const activeAiKey = open && activeAiType ? `${open.id}_${activeAiType}` : null;
  const activeAiCopy = activeAiKey ? aiContent[activeAiKey] : null;
  const aiOptions = [
    { type: "tips", label: "Advanced Tips" },
    { type: "example", label: "Example Conversation" },
    { type: "checklist", label: "Pre-Call Checklist" },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8">
      <div className="enterprise-hero mb-6 overflow-hidden p-6 md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 shadow-inner">
                <GraduationCap className="h-6 w-6 text-teal-200" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-200">Enterprise learning hub</p>
                <h1 className="mt-1 text-3xl font-bold text-white">Coaching Modules</h1>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200">
              Develop Signal Intelligence capabilities through structured learning paths.
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
              Coaching Modules group related Signal Intelligence capabilities into focused learning paths.
            </p>
          </div>
          <div className="enterprise-hero-panel w-full max-w-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">Module coverage</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-300">Learning paths</p>
                <p className="mt-2 text-2xl font-bold text-white">{modules.length}</p>
                <p className="mt-1 text-xs text-slate-300">focused modules</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-300">Capabilities</p>
                <p className="mt-2 text-2xl font-bold text-white">{SIGNAL_CAPABILITIES.length}</p>
                <p className="mt-1 text-xs text-slate-300">behavioral metrics covered</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-2xl font-bold leading-tight text-gray-900">Coaching Modules</h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">Signal Intelligence™ learning paths — definitions, key behaviors, scoring anchors, and guided AI support.</p>
        <div className="mt-3 inline-flex max-w-3xl items-start gap-2 rounded-2xl border border-teal-100 bg-teal-50/80 px-4 py-3 text-sm leading-relaxed text-slate-700">
          <Layers3 className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-700" />
          <span>Coaching Modules group related Signal Intelligence capabilities into focused learning paths.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-2.5 lg:col-span-1">
          {modules.map((mod) => {
            const isSelected = activeModule === mod.id;
            return (
              <button
                key={mod.id}
                onClick={() => setActiveModule(mod.id)}
                className={`ui-surface-card ui-surface-card-interactive w-full rounded-2xl border p-4 text-left transition-all ${isSelected ? "border-teal-300 bg-teal-50/90 shadow-[0_18px_32px_rgba(15,118,110,0.12)] ring-1 ring-teal-100" : "border-teal-200 bg-white hover:border-teal-300 hover:bg-teal-50/80 hover:shadow-[0_16px_30px_rgba(15,118,110,0.10)] hover:-translate-y-0.5"}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${mod.iconBg}`}>
                    <mod.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold leading-snug text-gray-900">{mod.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{mod.tagline}</p>
                      </div>
                      <ChevronRight className={`mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${isSelected ? "rotate-90 text-teal-600" : ""}`} />
                    </div>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Covers</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {mod.capabilities.slice(0, 2).map((capability) => (
                        <span key={capability} className="ui-pill px-2.5 py-1 text-[11px]">
                          {capabilityLabel(capability)}
                        </span>
                      ))}
                      {mod.capabilities.length > 2 && (
                        <span className="ui-pill px-2.5 py-1 text-[11px]">+{mod.capabilities.length - 2} more</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-2">
          {!open ? (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-gray-200 py-20 text-center text-gray-400">
              <div>
                <BookOpen className="mx-auto mb-3 h-8 w-8 opacity-40" />
                <p className="font-medium text-gray-500">Select a module to view its content</p>
                <p className="mt-1 text-sm">Definitions, key behaviors, scoring anchors, and exercises</p>
              </div>
            </div>
          ) : (
            <div className="ui-surface-card overflow-hidden rounded-[26px] border border-teal-100">
              <div className={`border-b px-6 py-5 ${open.iconBg.replace("text-", "border-").replace("bg-", "bg-").replace("100", "50")} border-opacity-50`}>
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${open.iconBg}`}>
                    <open.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-bold text-gray-900">{open.title}</h2>
                    <p className="text-xs text-gray-500">{open.tagline}</p>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Covers</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {open.capabilities.map((capability) => (
                        <span key={capability} className="ui-pill px-3 py-1.5 text-xs">
                          {capabilityLabel(capability)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="max-h-[70vh] space-y-6 overflow-y-auto p-6">
                <section>
                  <SectionHeader icon={Lightbulb} iconClassName="text-yellow-500" title="Definition" />
                  <p className="rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm leading-relaxed text-gray-600">{open.definition}</p>
                </section>

                <section>
                  <SectionHeader icon={Target} iconClassName="text-teal-500" title="Key Behaviors" />
                  <div className="space-y-2.5">
                    {open.keyBehaviors.map((behavior, index) => (
                      <div key={index} className="flex gap-3 rounded-xl border border-teal-100 bg-teal-50 p-3.5">
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-500" />
                        <div className="text-sm leading-relaxed text-gray-600">
                          <span className="font-semibold text-gray-800">{behavior.label}: </span>
                          <span>{behavior.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <SectionHeader icon={BookOpen} iconClassName="text-teal-600" title="Scoring Anchors (Signal Intelligence™ 1–5)" />
                  <div className="space-y-2.5">
                    {open.scoringAnchors.map((anchor, index) => {
                      const colors = {
                        "5": "bg-green-50 border-green-200 text-green-800",
                        "3": "bg-yellow-50 border-yellow-200 text-yellow-800",
                        "1": "bg-red-50 border-red-200 text-red-800",
                      };
                      return (
                        <div key={index} className={`flex items-start gap-3 rounded-xl border p-3.5 ${colors[anchor.score]}`}>
                          <span className="w-12 flex-shrink-0 text-sm font-bold">{anchor.score}/5</span>
                          <span className="text-sm leading-relaxed">{anchor.desc}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <SectionHeader icon={ArrowRight} iconClassName="text-purple-500" title="Practice Exercises" />
                  <div className="space-y-2.5">
                    {open.exercises.map((exercise, index) => (
                      <div key={index} className="flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50 p-3.5">
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-teal-700 shadow-sm">{index + 1}</span>
                        <p className="text-sm leading-relaxed text-gray-600">{exercise}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="border-t border-gray-100 pt-5">
                  <SectionHeader icon={Sparkles} iconClassName="text-teal-500" title="AI-Generated Content" />
                  <div className="mb-3 flex flex-wrap gap-2">
                    {aiOptions.map(({ type, label }) => {
                      const key = `${open.id}_${type}`;
                      const isLoading = aiLoading === key;
                      const isActive = activeAiType === type;
                      const hasContent = Boolean(aiContent[key]);
                      return (
                        <Button
                          key={type}
                          size="sm"
                          variant="outline"
                          className={`ui-pill rounded-full px-3 py-2 text-xs shadow-none ${isActive ? "ui-pill-active" : ""} ${hasContent ? "border-teal-300" : ""}`}
                          onClick={() => generateAIContent(open.id, type)}
                          disabled={isLoading || (aiLoading !== null && aiLoading !== key)}
                        >
                          {isLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Wand2 className="mr-1 h-3 w-3" />}
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                  {activeAiCopy ? (
                    <div className="space-y-3 rounded-xl border border-teal-100 bg-teal-50 p-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                        {aiOptions.find((option) => option.type === activeAiType)?.label}
                      </p>
                      <div className="ui-markdown prose prose-sm max-w-none text-gray-700">
                        <ReactMarkdown components={markdownComponents}>{activeAiCopy}</ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-teal-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                      Select an AI content pill to load module-specific tips, examples, or a checklist.
                    </div>
                  )}
                </section>

                <section className="border-t border-gray-100 pt-5">
                  <SectionHeader icon={Brain} iconClassName="text-teal-500" title="AI Coach" />
                  <p className="mb-4 text-sm leading-relaxed text-gray-600">Describe your sales situation and get personalized advice based on {open.title}.</p>
                  <CoachInputPanel moduleName={open.title} moduleTagline={open.tagline} />
                </section>

                <section className="flex gap-3 border-t border-gray-100 pt-4">
                  <Link to={createPageUrl("RolePlaySimulator")} className="flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700">
                    <ArrowRight className="h-3.5 w-3.5" /> Practice in Role Play
                  </Link>
                  <Link to={createPageUrl("Exercises")} className="flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700">
                    <ArrowRight className="h-3.5 w-3.5" /> Try an Exercise
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

function CoachInputPanel({ moduleName, moduleTagline }) {
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
    <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-slate-50 p-5 space-y-4">
      <textarea
        placeholder="E.g., 'I'm meeting with a skeptical cardiologist who prefers data-driven conversations...'"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="w-full resize-none rounded-lg border border-teal-200 bg-white p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-400"
        rows="3"
      />
      <Button
        onClick={handleGetAdvice}
        disabled={isLoading || !input.trim()}
        className="w-full bg-teal-500 text-xs font-medium text-white hover:bg-teal-600"
      >
        {isLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
        {isLoading ? "Getting Advice..." : "Get AI Advice"}
      </Button>
      {response && (
        <div className="ui-markdown rounded-lg border border-teal-100 bg-white p-5 text-sm leading-relaxed text-gray-700">
          <ReactMarkdown components={markdownComponents}>{response}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
