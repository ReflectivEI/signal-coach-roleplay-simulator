import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { X, MapPin, Send, Loader2, Brain, Zap, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import TermTooltip from "./TermTooltip";
import { invokeWorkerText } from "@/services/workerClient";
import {
  SIGNAL_INTELLIGENCE_CAPABILITIES,
  JOURNEY_STAGE_LABELS,
  BEHAVIOR_STATE_SIMPLE_LABELS,
  HCP_ROLE_LABELS,
  DECISION_ORIENTATION_LABELS,
  PRESSURE_LABELS,
} from "@/lib/signalIntelligence";

// ── Field label ───────────────────────────────────────────────────────────────
function FieldLabel({ children }) {
  return (
    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1.5">{children}</p>
  );
}

// ── Variable pill with tooltip ───────────────────────────────────────────
const TOOLTIP_DESCRIPTIONS = {
  "Discovery": "Early-stage conversation where rep learns about HCP's patient population and clinical priorities.",
  "Open": "HCP is receptive and engaged; showing genuine interest in the conversation.",
  "Treating Clinician": "Physician directly responsible for patient care and clinical decisions.",
  "Patient-Centric": "HCP prioritizes patient outcomes and benefits as the primary decision driver."
};

function VarPill({ children }) {
  const DESCRIPTIONS = {
    // Journey Stages (display labels)
    "Initial Access": "Getting into the conversation and establishing enough credibility to earn a real dialogue.",
    "Discovery": "Early-stage conversation where the rep learns about the HCP's patient population, clinical priorities, and current workflows.",
    "Clinical Value": "HCP evaluates whether the product delivers clinical value for their patient population.",
    "Objection Handling": "Responding to HCP resistance, concerns, or barriers to progression.",
    "Adoption & Implementation": "HCP commits to using the product and implements it into their practice.",
    "Access & Formulary": "Navigating insurance, formulary, or access barriers to patient care.",
    "Commitment & Close": "Securing a clear, owned commitment from the HCP to move forward.",
    // Journey Stages (raw enum values fallback)
    "initial_access": "Getting into the conversation and establishing enough credibility to earn a real dialogue.",
    "discovery": "Early-stage conversation where the rep learns about the HCP's patient population, clinical priorities, and current workflows.",
    "clinical_value": "HCP evaluates whether the product delivers clinical value for their patient population.",
    "objection_handling": "Responding to HCP resistance, concerns, or barriers to progression.",
    "adoption_implementation": "HCP commits to using the product and implements it into their practice.",
    "access_formulary": "Navigating insurance, formulary, or access barriers to patient care.",
    "commitment_close": "Securing a clear, owned commitment from the HCP to move forward.",
    // Behavior States
    "Closed": "HCP is defensive, reluctant, or actively resistant to engagement.",
    "Neutral": "HCP is neither openly receptive nor resistant; willing to listen without clear commitment.",
    "Open": "HCP is receptive and engaged; showing genuine interest in the conversation and willing to explore the topic.",
    "Time Pressure": "HCP is constrained by time; rushing through the conversation.",
    "Frustration": "HCP shows irritation or impatience with the interaction.",
    "Curiosity": "HCP is interested and asking questions; seeking deeper understanding.",
    "Resistance": "HCP is actively opposing or questioning the proposal.",
    "Openness": "HCP is willing and favorable toward new ideas or approaches.",
    // HCP Roles
    "Treating Clinician": "Physician directly responsible for patient care and clinical decision-making in their practice.",
    "Influencer": "Physician with authority to shape prescribing decisions or clinical protocols within their organization.",
    "Thought Leader": "Nationally recognized or highly respected specialist with influence on broader clinical practice.",
    // Decision Orientations
    "Patient-Centric": "HCP prioritizes patient outcomes and benefits as the primary decision driver.",
    "Evidence-Driven": "HCP relies on clinical trial data and published evidence to guide decisions.",
    "Risk-Averse": "HCP prefers proven, established approaches and is cautious about adopting new therapies.",
    "Guideline-Anchored": "HCP follows published clinical guidelines strictly and rarely prescribes outside them."
  };

  const description = DESCRIPTIONS[children];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <p className="text-sm text-slate-700 font-semibold leading-snug hover:opacity-80 transition-opacity">
          {children}
        </p>
      </TooltipTrigger>
      {description && (
        <TooltipContent className="max-w-xs bg-white text-slate-900 border border-slate-200 text-sm font-normal rounded-lg p-3 shadow-lg">
          {description}
        </TooltipContent>
      )}
    </Tooltip>
  );
}

// ── Capability pill ───────────────────────────────────────────────────────────
function CapPill({ children }) {
  const CAP_DESCRIPTIONS = {
    "Question Quality": "Asking questions that are timely, relevant, and move the conversation forward.",
    "Listening & Responsiveness": "Accurately understanding customer input and responding in a way that clearly reflects understanding.",
    "Customer Engagement Cues": "Noticing changes in customer participation and conversational momentum.",
    "Value Framing": "Connecting information to customer-specific priorities and clearly explaining why it matters.",
    "Objection Handling": "Responding to resistance with composure and engaging it in a way that sustains progress.",
    "Conversation Control & Structure": "Providing clear direction and structure while guiding the conversation toward outcomes.",
    "Adaptability": "Making timely, appropriate adjustments to approach based on what is happening in the conversation.",
    "Commitment Gaining": "Establishing clear next actions that are voluntarily owned by the customer.",
    "Time Constrained": "HCP has limited time available; rep must establish relevance quickly.",
    "Operationally Constrained": "HCP is hampered by workflow, staff, or systemic barriers in their practice.",
    "Skeptical / Resistant": "HCP is actively questioning or opposing the proposal.",
    "Competitive Bias": "HCP has a strong loyalty or preference for a competing therapy.",
    "Safety Concern": "HCP has raised a specific safety worry that must be addressed.",
    "Access Barrier": "Formulary, insurance, or access policies are blocking adoption.",
    "Curious / Uncertain": "HCP is genuinely interested but not yet confident enough to commit."
  };

  const description = CAP_DESCRIPTIONS[children];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div 
          className="flex items-center gap-2 group"
          whileHover={{ x: 4 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          <p className="text-sm text-slate-700 font-semibold leading-snug group-hover:text-slate-900 transition-colors">
            {children}
          </p>
        </motion.div>
      </TooltipTrigger>
      {description && (
        <TooltipContent className="max-w-xs bg-white text-slate-900 border border-slate-200 text-sm font-normal rounded-lg p-3 shadow-lg">
          {description}
        </TooltipContent>
      )}
    </Tooltip>
  );
}

// ── Info box ──────────────────────────────────────────────────────────────────
function InfoBox({ children, className = "" }) {
  return (
    <div className={`rounded-xl p-4 border border-slate-100 bg-slate-50 ${className}`}>
      {children}
    </div>
  );
}

// ── Opening Scene ─────────────────────────────────────────────────────────────
function OpeningSceneBlock({ scenario }) {
  const sceneText = scenario.visualScene || scenario.context || "";
  return (
    <div className="rounded-xl p-4 border" style={{ background: "hsl(174 40% 97%)", borderColor: "hsl(162 50% 80%)" }}>
      <div className="flex items-center gap-2 mb-2.5">
        <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: "hsl(162 55% 38%)" }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(162 55% 38%)" }}>
          Opening Scene
        </span>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed italic">{sceneText}</p>
    </div>
  );
}

// ── AI Coach ──────────────────────────────────────────────────────────────────
function AiCoachSection({ scenario }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput("");
    setLoading(true);
    const userMsg = { role: "user", text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    const history = [...messages, userMsg].map(m => `${m.role === "user" ? "Rep" : "Assistant"}: ${m.text}`).join("\n");
    const result = await invokeWorkerText({
      prompt: `You are a coaching assistant helping a pharma rep prepare for a training scenario. Answer their question specifically about this scenario. Be concise and practical (max 3 sentences).

SCENARIO:
Title: ${scenario.title}
Description: ${scenario.description}
Objective: ${scenario.objective}
Core Tension: ${scenario.coreTension || ""}
HCP: ${scenario.stakeholder}
Context: ${scenario.context || ""}
Key Challenges: ${(scenario.keyChallenges || []).join(", ")}

CONVERSATION:
${history}

Rep: ${trimmed}
Assistant:`
    });
    const reply = typeof result === "string" ? result : result?.toString() || "I'm not sure — try rephrasing.";
    setMessages(prev => [...prev, { role: "assistant", text: reply }]);
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "hsl(222 30% 20%)", border: "1px solid hsl(174 60% 52% / 0.35)" }}>
      <div className="px-4 py-3 border-b border-border/30" style={{ background: "hsl(174 30% 18% / 0.5)" }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(174 60% 52%)" }}>
          Ask About This Scenario
        </span>
      </div>
      <div className="min-h-[80px] max-h-48 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-xs text-white italic">Ask anything about the scenario before you start — strategy, objections, opening moves.</p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] text-xs leading-relaxed px-3 py-2 rounded-lg ${
                m.role === "user"
                  ? "bg-primary/15 border border-primary/20 text-foreground"
                  : "bg-surface border border-border/60 text-foreground/85"
              }`}>
                {m.text}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface border border-border/60 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-border/30 px-3 py-2.5 flex items-center gap-2 bg-surface/40">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="e.g. How should I open this conversation?"
          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none"
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-colors shrink-0"
          style={{ background: "hsl(174 45% 42%)" }}
        >
          <Send className="w-3 h-3 text-white" />
        </button>
      </div>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
export default function ScenarioDetailModal({ scenario, difficulty: _difficulty, onClose, onStart }) {
  // Wrap content in TooltipProvider for tooltips to work
  const WrappedContent = ({ children }) => {
    return <TooltipProvider>{children}</TooltipProvider>;
  };
  // Recompute difficulty using light palette labels
  const getDiff = () => {
    const stage = scenario.journeyStage || "";
    const state = scenario.startingBehaviorState || "";
    const pressures = scenario.interactionPressure || [];
    let score = 0;
    if (["objection_handling","commitment_close","access_formulary"].includes(stage)) score += 2;
    else if (["adoption_implementation","clinical_value"].includes(stage)) score += 1;
    if (["closed","resistance","frustration"].includes(state)) score += 2;
    if (pressures.some(p => ["skeptical_resistant","safety_concern","competitive_bias"].includes(p))) score += 1;
    if (pressures.length >= 2) score += 1;
    if (score >= 4) return { label: "Advanced", color: "text-red-600 border-red-200 bg-red-50" };
    if (score >= 2) return { label: "Intermediate", color: "text-amber-600 border-amber-200 bg-amber-50" };
    return { label: "Foundational", color: "text-emerald-600 border-emerald-200 bg-emerald-50" };
  };
  const difficulty = getDiff();
  const focusCaps = scenario.suggestedFocusCapabilities || [];
  const pressures = (scenario.interactionPressure || []).slice(0, 3);
  const challenges = (scenario.keyChallenges || []).slice(0, 3);

  // Strip "Role — " prefix from context
  const contextDetail = (() => {
    const raw = scenario.context || "";
    const sep = raw.indexOf(" — ");
    return sep !== -1 ? raw.slice(sep + 3) : raw;
  })();

  return (
    <TooltipProvider>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative w-full sm:max-w-[980px] max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-[28px] bg-white shadow-2xl"
          style={{
            border: "1px solid rgba(11, 58, 73, 0.16)",
            boxShadow: "0 30px 80px rgba(15, 23, 42, 0.22)",
          }}
        >
        {/* Drag pill on mobile */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-border/60 rounded-full" />
        </div>

        {/* Sticky Header */}
        <div
          className="sticky top-0 z-10 px-6 py-5 flex items-start justify-between gap-3"
          style={{
            background: "linear-gradient(135deg, hsl(223 47% 18%) 0%, hsl(214 53% 24%) 55%, hsl(176 59% 30%) 100%)",
            borderBottom: "1px solid rgba(95, 220, 197, 0.16)",
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-semibold text-white text-lg leading-snug">{scenario.title}</h2>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${difficulty.color}`}>
                {difficulty.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white transition-colors shrink-0 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className="px-6 py-6 space-y-6"
          style={{ background: "linear-gradient(180deg, #f9fbfc 0%, #f1f7f7 100%)" }}
        >

          {/* HCP Profile + Objective banners */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div
              className="rounded-2xl p-4"
              style={{
                background: "linear-gradient(180deg, hsl(223 44% 18%) 0%, hsl(219 39% 15%) 100%)",
                border: "1px solid rgba(100, 223, 201, 0.16)",
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest mb-2.5" style={{ color: "hsl(162 60% 65%)" }}>HCP Profile</p>
              <p className="text-sm text-white font-semibold leading-snug mb-1.5">{scenario.stakeholder}</p>
              {contextDetail && (
                <p className="text-xs text-white leading-relaxed">{contextDetail}</p>
              )}
            </div>
            <div
              className="rounded-2xl p-4"
              style={{
                background: "linear-gradient(135deg, hsl(223 44% 18%) 0%, hsl(176 48% 23%) 100%)",
                border: "1px solid rgba(100, 223, 201, 0.16)",
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest mb-2.5" style={{ color: "hsl(162 60% 65%)" }}>Objective</p>
              <p className="text-xs text-white leading-relaxed">{scenario.objective}</p>
            </div>
          </div>

          {/* Opening Scene — always visible */}
          <OpeningSceneBlock scenario={scenario} />

          {/* Tactical Focus + Key Challenges */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div
              className="rounded-2xl p-4"
              style={{
                background: "linear-gradient(180deg, hsl(223 35% 17%) 0%, hsl(221 33% 15%) 100%)",
                border: "1px solid rgba(39, 63, 103, 0.35)",
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "hsl(162 60% 65%)" }}>Tactical Focus</p>
              <p className="text-sm text-white leading-relaxed">{scenario.description}</p>
            </div>
            <div
              className="rounded-2xl p-4"
              style={{
                background: "linear-gradient(135deg, hsl(223 35% 17%) 0%, hsl(176 40% 23%) 100%)",
                border: "1px solid rgba(58, 123, 121, 0.30)",
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "hsl(162 60% 65%)" }}>Key Challenges</p>
              <ul className="space-y-2">
                {challenges.map((c, i) => (
                  <li key={i} className="text-sm text-white flex items-start gap-2.5 leading-relaxed">
                    <span
                      className="shrink-0"
                      style={{ width: 5, height: 5, borderRadius: "50%", background: "hsl(162 60% 55%)", marginTop: 8 }}
                    />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Scenario Variables + Signal Intelligence */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Scenario Variables */}
            <div
              className="rounded-2xl p-4"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(238, 249, 247, 0.98) 100%)",
                border: "1.5px solid rgba(134, 209, 194, 0.70)",
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-4 h-4" style={{ color: "hsl(162 55% 38%)" }} />
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "hsl(162 55% 38%)" }}>
                  Scenario Variables
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "hsl(162 55% 38%)" }}>Journey Stage</p>
                  <VarPill>{JOURNEY_STAGE_LABELS[scenario.journeyStage] || scenario.journeyStage}</VarPill>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "hsl(162 55% 38%)" }}>Behavior State</p>
                  <VarPill>{BEHAVIOR_STATE_SIMPLE_LABELS[scenario.startingBehaviorState] || scenario.startingBehaviorState}</VarPill>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "hsl(162 55% 38%)" }}>HCP Role</p>
                  <VarPill>{HCP_ROLE_LABELS[scenario.hcpRoleType] || scenario.hcpRoleType}</VarPill>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "hsl(162 55% 38%)" }}>Decision Orientation</p>
                  <VarPill>{DECISION_ORIENTATION_LABELS[scenario.decisionOrientation] || scenario.decisionOrientation}</VarPill>
                </div>
              </div>
            </div>

            {/* Signal Intelligence Focus */}
            <div
              className="rounded-2xl p-4"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(238, 249, 247, 0.98) 100%)",
                border: "1.5px solid rgba(134, 209, 194, 0.70)",
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4" style={{ color: "hsl(162 55% 38%)" }} />
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "hsl(162 55% 38%)" }}>
                  Signal Intelligence Focus
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: "hsl(162 55% 38%)" }}>Focus Capabilities</p>
                  <p className="text-xs text-slate-700 mb-2.5 leading-relaxed italic">
                    Capabilities most relevant to this scenario
                  </p>
                  <div className="space-y-2">
                    {SIGNAL_INTELLIGENCE_CAPABILITIES
                      .filter(cap => focusCaps.includes(cap.id))
                      .map(cap => (
                        <CapPill key={cap.id}>{cap.metric}</CapPill>
                      ))
                    }
                  </div>
                </div>
                {pressures.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: "hsl(162 55% 38%)" }}>Interaction Pressure</p>
                    <div className="space-y-2">
                      {pressures.map(p => (
                        <CapPill key={p}>{PRESSURE_LABELS[p] || p}</CapPill>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Coach */}
          <AiCoachSection scenario={scenario} />

          {/* Footer actions */}
          <div className="flex items-center gap-3 pt-1 pb-2">
            <button onClick={onClose}
              className="py-2 px-5 rounded-lg border border-slate-200 text-slate-500 text-sm hover:border-slate-300 hover:text-slate-700 transition-colors">
              Close
            </button>
            <button onClick={onStart}
              className="py-2 px-6 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ background: "hsl(174 40% 14%)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "hsl(174 40% 20%)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "hsl(174 40% 14%)"; }}
            >
              Start Scenario →
            </button>
          </div>
        </div>
      </motion.div>
    </div>
    </TooltipProvider>
  );
}
