import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronRight, FileText, Settings, Info, MessageSquare, Lightbulb, Heart,
  Users, ShieldAlert, GitFork, Shuffle, Target, Send, Loader2, Search, Ear,
  BarChart3, Brain, RefreshCw, BarChart2, Play,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import { SIGNAL_CAPABILITIES } from "@/components/roleplay/signalIntelligenceSOT";

const ICON_MAP = {
  signal_awareness: Search,
  signal_interpretation: Ear,
  value_connection: Heart,
  customer_engagement: Users,
  objection_navigation: ShieldAlert,
  conversation_management: GitFork,
  adaptive_response: Shuffle,
  commitment_generation: Target,
};

// Transform SOT data into frameworks format for UI display
const signalFrameworks = SIGNAL_CAPABILITIES.map(cap => ({
  id: cap.id,
  title: cap.label,
  subtitle: cap.measurement ? `(${cap.measurement})` : "",
  description: cap.definition,
  principles: [
    "Ask open-ended questions that encourage detailed responses",
    "Focus questions on customer priorities, not product features",
    "Use questions to uncover underlying needs and concerns",
    "Adapt questions based on customer responses and context",
  ],
  techniques: [
    { name: "Discovery Questions", desc: "Ask about current challenges, goals, and decision criteria", example: '"What are your biggest challenges with your current treatment approach?"' },
    { name: "Implication Questions", desc: "Explore the consequences of current problems", example: '"How does this impact your patient outcomes and practice efficiency?"' },
    { name: "Need-Payoff Questions", desc: "Help customers articulate the value of solving their problems", example: '"If we could address this, what would that mean for your practice?"' },
  ],
}));

const discModel = {
  title: "DISC Communication Styles",
  description: "An optional behavioral communication lens that helps adapt your approach to different stakeholder preferences. Note: DISC describes observable communication preferences, not behavioral capabilities.",
  styles: [
    { letter: "D", name: "Dominance", desc: "Direct, results-oriented, decisive. Wants bottom-line information, minimal small talk, clear outcomes." },
    { letter: "I", name: "Influence", desc: "Enthusiastic, collaborative, optimistic. Responds to relationships, stories, and shared excitement." },
    { letter: "S", name: "Steadiness", desc: "Patient, reliable, team-oriented. Prefers consistency, low-pressure, personal connection." },
    { letter: "C", name: "Conscientiousness", desc: "Analytical, precise, systematic. Wants data, detail, and time to process decisions carefully." },
  ],
};

function FrameworkDetailModal({ fw, onClose }) {
  const [situation, setSituation] = useState("");
  const [advice, setAdvice] = useState("");
  const [loading, setLoading] = useState(false);
  const Icon = ICON_MAP[fw.id] || MessageSquare;

  const getAdvice = async () => {
    if (!situation.trim()) return;
    setLoading(true);
    try {
      const prompt = `You are an expert sales coach specializing in the DISC framework and sales effectiveness. The user has described the following situation: "${situation}"\n\nBased on this context and the ${fw.name} framework, provide specific, actionable advice for handling this situation. Include:\n1. Key principles from the ${fw.name} framework that apply\n2. Specific actions they should take\n3. What to avoid\n4. Expected outcomes if they follow this advice`;
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 600 })
      });
      if (res.ok) {
        const data = await res.json();
        setAdvice(typeof data.response === 'string' ? data.response : String(data.response));
      } else {
        setAdvice("Unable to generate advice. Please try again.");
      }
    } catch (err) {
      console.error('Framework advice error:', err);
      setAdvice("Unable to generate advice. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#39ACAC" }}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{fw.title} {fw.subtitle}</h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{fw.description}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* AI Coach */}
          <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-100 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-teal-800">✦ AI Coach</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">Describe your situation and get personalized advice on applying {fw.title} {fw.subtitle}</p>
            <Textarea
              value={situation}
              onChange={e => setSituation(e.target.value)}
              placeholder={`Describe your sales situation... e.g., 'I'm meeting with a skeptical oncologist who prefers data-driven discussions'`}
              rows={3}
              className="text-sm mb-3 bg-white"
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); getAdvice(); } }}
            />
            <Button onClick={getAdvice} disabled={!situation.trim() || loading} className="w-full text-white" style={{ background: "#39ACAC" }}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Getting advice...</> : <><Send className="w-4 h-4 mr-2" /> Get AI Advice</>}
            </Button>
            {advice && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-teal-100">
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                  <ReactMarkdown>{advice}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* Key Principles + Quick Tips */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-teal-500" />
                <span className="text-sm font-semibold text-gray-800">Key Principles</span>
              </div>
              <ol className="space-y-2">
                {fw.principles.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-xs font-bold text-gray-400 w-4 flex-shrink-0 mt-0.5">{i + 1}</span>
                    {p}
                  </li>
                ))}
              </ol>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-teal-500" />
                <span className="text-sm font-semibold text-gray-800">Quick Tips</span>
              </div>
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-1">In pharma sales contexts:</p>
                  <p className="text-xs text-gray-500 leading-relaxed">Apply this framework when meeting with healthcare providers to build stronger relationships and understand their unique prescribing motivations.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Practice daily:</p>
                  <p className="text-xs text-gray-500 leading-relaxed">Use the role-play simulator to practice applying this framework in realistic pharma scenarios.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Techniques */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Techniques & Examples</h3>
            <p className="text-xs text-gray-500 mb-4">Practical techniques with real-world pharma sales examples</p>
            <div className="space-y-4">
              {fw.techniques.map((t, i) => (
                <div key={i} className="border-l-2 border-teal-400 pl-4">
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500 mb-2">{t.desc}</p>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">Example:</p>
                    <p className="text-xs text-gray-700 italic">{t.example}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Link to={createPageUrl("RolePlaySimulator")} className="flex-1">
              <Button variant="outline" className="w-full text-sm">Practice in Role-Play Simulator</Button>
            </Link>
            <Button onClick={onClose} className="flex-1 text-white text-sm" style={{ background: "#1A334D" }}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const COACHING_TOOLS = [
  { id: "reflective", icon: Search, title: "Reflective Practice", desc: "Structured self-assessment after sales interactions to identify strengths and growth areas.", items: ["Post-call reflection templates", "Behavioral pattern identification", "Improvement action planning"], aiPrompt: "Generate 3 specific, thought-provoking post-call reflection prompts for a pharmaceutical sales representative who just completed an HCP visit. Focus on Signal Intelligence behaviors: what signals did they receive, how did they respond, and what could they improve?" },
  { id: "roleplay", icon: Play, title: "Role-Play Simulator", desc: "Practice with AI-simulated HCPs across diverse disease states and stakeholder profiles.", items: ["18+ clinical scenarios", "Real-time Signal Intelligence scoring", "Detailed post-session feedback"], aiPrompt: "Generate a realistic 3-turn role-play scenario excerpt between a pharma sales rep and a skeptical cardiologist. Include coaching notes on what Signal Intelligence signals appear and how the rep should respond." },
  { id: "analytics", icon: BarChart2, title: "Performance Analytics", desc: "Track capability scores over time and identify patterns in your communication.", items: ["Capability trend charts", "Benchmark comparisons", "Personalized learning paths"], aiPrompt: "Generate 3 specific, actionable coaching insights for a pharma sales rep based on performance data showing strong Signal Awareness but weaker Commitment Generation scores. What should they focus on to improve?" },
  { id: "ai_modules", icon: Brain, title: "AI Coaching Modules", desc: "Deep-dive coaching on each Signal Intelligence capability with AI-powered advice.", items: ["Framework-specific guidance", "Situation-based AI advice", "Technique libraries"], aiPrompt: "Generate a practical tip of the day for a pharma sales rep focused on mastering one Signal Intelligence capability. Choose a specific capability and provide a concrete, observable behavior they can practice today." },
];

function CoachingToolsTab() {
  const [aiContent, setAiContent] = useState({});
  const [aiLoading, setAiLoading] = useState({});

  const generateAI = async (tool) => {
    setAiLoading(prev => ({ ...prev, [tool.id]: true }));
    try {
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: tool.aiPrompt, max_tokens: 800 })
      });
      if (res.ok) {
        const data = await res.json();
        setAiContent(prev => ({ ...prev, [tool.id]: typeof data.response === 'string' ? data.response : String(data.response) }));
      } else {
        setAiContent(prev => ({ ...prev, [tool.id]: "Unable to generate content. Please try again." }));
      }
    } catch (err) {
      console.error('Coaching tool generation error:', err);
      setAiContent(prev => ({ ...prev, [tool.id]: "Unable to generate content. Please try again." }));
    } finally {
      setAiLoading(prev => ({ ...prev, [tool.id]: false }));
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {COACHING_TOOLS.map(t => {
        const Icon = t.icon;
        const isLoading = aiLoading[t.id];
        const content = aiContent[t.id];
        return (
          <Card key={t.id}>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#e6f7f7" }}>
                  <Icon className="w-5 h-5" style={{ color: "#39ACAC" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900">{t.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t.desc}</p>
                </div>
              </div>
              <ul className="space-y-1.5">
                {t.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <ChevronRight className="w-3.5 h-3.5 text-teal-400 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="pt-2">
                <button
                  onClick={() => generateAI(t)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all duration-200 text-xs px-3 py-1 border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {content ? "Refresh AI Insight" : "Get AI Insight"}
                </button>
                {content && (
                  <div className="mt-3 bg-teal-50 border border-teal-100 rounded-lg p-4">
                    <div className="prose prose-sm max-w-none text-gray-700 text-xs leading-relaxed">
                      <ReactMarkdown>{content}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function Frameworks() {
  const [activeTab, setActiveTab] = useState("Signal Intelligence Frameworks");
  const [selectedFw, setSelectedFw] = useState(null);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Selling and Coaching Frameworks</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-3xl leading-relaxed">
          ReflectivAI is powered by Signal Intelligence — the ability to notice, interpret, and respond appropriately to observable signals during professional interactions.
        </p>
        <p className="text-sm text-gray-500 mt-1.5 max-w-3xl leading-relaxed">
          Our AI highlights meaningful behavioral signals. Sales professionals apply judgment using demonstrated behavioral capabilities, communication models, and coaching tools that work in real conversations.
        </p>
      </div>

      {/* Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { num: 1, title: "Signal Intelligence", desc: "Core measurement layer — what we measure and optimize" },
          { num: 2, title: "Behavioral Models", desc: "Supporting insight layer — how to adapt communication" },
          { num: 3, title: "Coaching Tools", desc: "Action layer — how improvement happens" },
        ].map(p => (
          <div key={p.num} className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-5 border border-teal-100">
            <div className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-sm mb-3" style={{ background: "#39ACAC" }}>{p.num}</div>
            <h3 className="font-semibold text-gray-900 mb-1">{p.title}</h3>
            <p className="text-xs text-gray-500">{p.desc}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 bg-gray-100">
          <TabsTrigger value="Behavioral Models" className="flex items-center gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" /> Behavioral Models
          </TabsTrigger>
          <TabsTrigger value="Signal Intelligence Frameworks" className="flex items-center gap-1.5 text-xs">
            <Heart className="w-3.5 h-3.5" /> Signal Intelligence Frameworks
          </TabsTrigger>
          <TabsTrigger value="Coaching Tools" className="flex items-center gap-1.5 text-xs">
            <Settings className="w-3.5 h-3.5" /> Coaching Tools
          </TabsTrigger>
        </TabsList>

        {/* Signal Intelligence Frameworks tab — matches screenshots exactly */}
        <TabsContent value="Signal Intelligence Frameworks">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {signalFrameworks.map(fw => {
              const Icon = ICON_MAP[fw.id] || MessageSquare;
              return (
                <div key={fw.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:border-teal-200 hover:shadow-md transition-all">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#39ACAC" }}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm leading-snug">{fw.title} {fw.subtitle}</h3>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{fw.description}</p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Key Principles:</p>
                    <ul className="space-y-1">
                      {fw.principles.slice(0, 3).map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                          <ChevronRight className="w-3 h-3 text-teal-500 flex-shrink-0 mt-0.5" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex gap-2">
                      <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">{fw.techniques.length} techniques</span>
                      <span className="text-xs text-teal-600 bg-teal-50 rounded-full px-2.5 py-1 flex items-center gap-1">✦ AI Coach</span>
                    </div>
                    <button onClick={() => setSelectedFw(fw)} className="flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-teal-600 transition-colors">
                      Learn More <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Behavioral Models tab */}
        <TabsContent value="Behavioral Models">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 mb-5">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm text-blue-900 mb-1">Important Distinction</p>
              <p className="text-xs text-gray-600">DISC is an optional behavioral communication lens that can support signal-intelligent interactions—but it is not a signal intelligence framework. It describes communication preferences, not demonstrated capabilities.</p>
            </div>
          </div>
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-1">{discModel.title}</h3>
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">{discModel.description}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {discModel.styles.map(s => (
                  <div key={s.letter} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: "#1A334D" }}>{s.letter}</span>
                      <p className="font-semibold text-gray-800 text-sm">{s.name}</p>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coaching Tools tab */}
        <TabsContent value="Coaching Tools">
          <CoachingToolsTab />
        </TabsContent>
      </Tabs>

      {/* Framework Detail Modal */}
      {selectedFw && <FrameworkDetailModal fw={selectedFw} onClose={() => setSelectedFw(null)} />}
    </div>
  );
}