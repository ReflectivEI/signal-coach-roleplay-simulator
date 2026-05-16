import { useState, useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { X, MapPin, Send, Loader2, Zap, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { generateHcpResponse } from "@/lib/hcpResponseGenerator";
import { initializeConversation } from "@/lib/conversationInit";
import { buildPredictiveProfile, PREDICTIVE_SELECTOR_OPTIONS } from "@/lib/predictiveBuilderModel";
import { buildPredictiveSeedFromScenario } from "@/lib/predictiveSeedResolver";
import {
  CHALLENGE_CONTEXT_OPTIONS,
  CONVERSATION_STAGE_OPTIONS,
  HCP_ROLE_OPTIONS,
} from "@/lib/rpsUserInputOptions";
import { deriveUISelectionFromBrain, requireRealismContract } from "@/lib/scenarioInputResolver";
import {
  SIGNAL_INTELLIGENCE_CAPABILITIES,
} from "@/lib/signalIntelligence";

function deriveContractTemperature(scenario) {
  return requireRealismContract(scenario?.runtimeTemperature, "scenario detail realism");
}

function buildPredictiveContract(scenario) {
  const selection = buildPredictiveSeedFromScenario(scenario || {});
  const profile = buildPredictiveProfile(selection);
  const predictiveProfile = {
    type: String(selection?.behaviorArchetype || scenario?.persona || "").trim(),
    source: "deterministic",
    specialistTitle: scenario?.stakeholder || "Clinical Specialist",
  };
  const sections = /** @type {any} */ (profile?.sections || {});
  const predictivePromptContext = [
    "PREDICTIVE HCP LENS (runtime, scenario-derived):",
    "- Source: deterministic",
    `- Specialist frame: ${predictiveProfile.specialistTitle}`,
    `- Seed disease state: ${selection?.diseaseState || ""}`,
    `- Seed HCP role: ${selection?.hcpType || ""}`,
    `- Seed conversation moment: ${selection?.journeyStage || ""}`,
    `- Seed interaction pressure: ${selection?.interactionPressure || ""}`,
    `- Seed influence driver: ${selection?.influenceDriver || ""}`,
    `- Seed behavior archetype: ${selection?.behaviorArchetype || ""}`,
    `- Mindset headline: ${sections?.mindset?.headline || ""}`,
    `- Objection headline: ${sections?.objections?.headline || ""}`,
    `- Response style headline: ${sections?.responseStyle?.headline || ""}`,
    `- Rep approach headline: ${sections?.repApproach?.headline || ""}`,
  ].join("\n");

  return {
    predictiveProfile: predictiveProfile.type ? predictiveProfile : null,
    predictivePromptContext,
  };
}

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

function BriefSection({ eyebrow, title, children, tone = "light", className = "" }) {
  const isDark = tone === "dark";
  return (
    <section
      className={`rounded-2xl p-4 ${className}`}
      style={{
        background: isDark
          ? "linear-gradient(135deg, hsl(223 45% 17%) 0%, hsl(188 43% 20%) 100%)"
          : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(241,249,248,0.98) 100%)",
        border: isDark ? "1px solid rgba(120, 220, 203, 0.18)" : "1px solid rgba(114, 190, 178, 0.34)",
        boxShadow: isDark ? "none" : "0 10px 24px rgba(14, 24, 43, 0.04)",
      }}
    >
      <p
        className="text-[11px] font-bold uppercase tracking-[0.18em]"
        style={{ color: isDark ? "hsl(174 62% 74%)" : "hsl(176 52% 30%)" }}
      >
        {eyebrow}
      </p>
      {title ? (
        <p
          className="mt-2 text-sm font-semibold leading-snug"
          style={{ color: isDark ? "rgba(255,255,255,0.98)" : "hsl(222 44% 20%)" }}
        >
          {title}
        </p>
      ) : null}
      <div
        className="mt-2 text-sm leading-relaxed"
        style={{ color: isDark ? "rgba(235,248,248,0.84)" : "hsl(213 20% 33%)" }}
      >
        {children}
      </div>
    </section>
  );
}

function BriefMetric({ label, value }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border px-3 py-2" style={{ background: "rgba(255,255,255,0.72)", borderColor: "rgba(114, 190, 178, 0.30)" }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "hsl(176 48% 31%)" }}>{label}</p>
      <p className="mt-1 text-sm font-semibold leading-snug" style={{ color: "hsl(222 42% 22%)" }}>{value}</p>
    </div>
  );
}

function cleanPredictiveHighlight(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^how this hcp is most likely framing decisions$/i.test(text)) return "";
  if (/^most probable objections you should anticipate$/i.test(text)) return "";
  if (/^predicted conversational behavior in the next interaction$/i.test(text)) return "";
  if (/^recommended rep strategy/i.test(text)) return "";
  return text;
}

// ── Opening Scene ─────────────────────────────────────────────────────────────
function OpeningSceneBlock({ scenario }) {
  const sceneText = scenario.visualScene || scenario.context || "";
  return (
    <div className="rounded-2xl p-4 border" style={{ background: "hsl(174 40% 97%)", borderColor: "hsl(162 50% 80%)" }}>
      <div className="flex items-center gap-2 mb-2.5">
        <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: "hsl(162 55% 38%)" }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(162 55% 38%)" }}>
          Opening Scene
        </span>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed">{sceneText}</p>
    </div>
  );
}

// ── AI Coach ──────────────────────────────────────────────────────────────────
function AiCoachSection({ scenario }) {
  const [hcpMessages, setHcpMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hcpState, setHcpState] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [hcpMessages, loading]);

  useEffect(() => {
    let cancelled = false;

    async function initHcpMode() {
      const convInit = await initializeConversation(scenario);
      if (cancelled) return;
      setHcpState({
        currentBehaviorState: convInit.initialBehaviorState,
        currentJourneyState: scenario.journeyState,
        currentVolatilityProfile: convInit.initialVolatilityProfile,
        allSignals: [],
      });
    }

    void initHcpMode();
    return () => {
      cancelled = true;
    };
  }, [scenario]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput("");
    setLoading(true);

    const repMsg = { role: "user", text: trimmed };
    const nextMessages = [...hcpMessages, repMsg];
    setHcpMessages(nextMessages);

    try {
      const transcript = nextMessages.map((m, index) => ({
        id: `practice_${index + 1}`,
        speaker: m.role === "user" ? /** @type {"rep"} */ ("rep") : /** @type {"hcp"} */ ("hcp"),
        text: m.text,
        timestamp: new Date().toISOString(),
      }));

      const { predictiveProfile, predictivePromptContext } = buildPredictiveContract(scenario);
      if (!predictiveProfile || !predictivePromptContext.trim()) {
        throw new Error("Error: HCP context not initialized");
      }

      const contractTemperature = deriveContractTemperature(scenario);
      const scenarioWithRuntime = {
        ...scenario,
        runtimeTemperature: contractTemperature,
      };

      const response = await generateHcpResponse(
        scenarioWithRuntime,
        transcript,
        hcpState?.currentBehaviorState || scenario.startingBehaviorState || "neutral",
        hcpState?.currentJourneyState || scenario.journeyState,
        false,
        trimmed,
        hcpState?.allSignals || [],
        transcript.filter((turn) => turn.speaker === "rep").length,
        hcpState?.currentVolatilityProfile || "stable",
        undefined,
        predictiveProfile,
        predictivePromptContext,
        {
          hcpPersona: predictiveProfile,
          temperature: contractTemperature,
          previousInteraction: trimmed,
          previousConcernFamily: "",
          escalationLevel: 0,
          interactionHistory: transcript.slice(-6).map((turn) => ({
            rep: turn?.speaker === "rep" ? turn?.text : "",
            hcp: turn?.speaker === "hcp" ? turn?.text : "",
            concernFamily: "",
            behaviorState: hcpState?.currentBehaviorState || scenario.startingBehaviorState || "neutral",
          })),
        },
      );

      setHcpMessages(prev => [...prev, { role: "assistant", text: response.hcpReply }]);
      setHcpState(prev => ({
        currentBehaviorState: response.nextBehaviorState,
        currentJourneyState: response.nextJourneyState,
        currentVolatilityProfile: response.volatilityState?.profile || prev?.currentVolatilityProfile || "stable",
        allSignals: [...(prev?.allSignals || []), response.behaviorSignals],
      }));
    } catch (error) {
      setHcpMessages(prev => [...prev, {
        role: "assistant",
        text: error instanceof Error ? error.message : "Error: HCP context not initialized",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const messages = hcpMessages;
  const emptyStateText = "Practice directly with the scenario HCP. Type exactly what you'd say to open or advance the conversation.";
  const headerLabel = "Practice With This HCP";
  const inputPlaceholder = "Type your rep message…";

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "hsl(222 30% 20%)", border: "1px solid hsl(174 60% 52% / 0.35)" }}>
      <div className="px-4 py-3 border-b border-border/30" style={{ background: "hsl(174 30% 18% / 0.5)" }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(174 60% 52%)" }}>
          {headerLabel}
        </span>
      </div>
      <div className="min-h-[96px] max-h-48 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 ? (
          <p className="text-xs leading-relaxed" style={{ color: "rgba(229, 238, 239, 0.92)" }}>
            {emptyStateText}
          </p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] text-xs leading-relaxed px-3 py-2 rounded-lg ${m.role === "user"
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
      <div
        className="border-t px-3 py-3 flex items-center gap-2"
        style={{
          borderColor: "rgba(148, 163, 184, 0.26)",
          background: "rgba(221, 226, 234, 0.96)",
        }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={inputPlaceholder}
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-slate-500"
          style={{ color: "hsl(222 30% 24%)" }}
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
  const navigate = useNavigate();
  // Recompute difficulty using light palette labels
  const getDiff = () => {
    const stage = scenario.journeyStage || "";
    const state = scenario.startingBehaviorState || "";
    const pressures = scenario.interactionPressure || [];
    let score = 0;
    if (["objection_handling", "commitment_close", "access_formulary"].includes(stage)) score += 2;
    else if (["adoption_implementation", "clinical_value"].includes(stage)) score += 1;
    if (["closed", "resistance", "frustration"].includes(state)) score += 2;
    if (pressures.some(p => ["skeptical_resistant", "safety_concern", "competitive_bias"].includes(p))) score += 1;
    if (pressures.length >= 2) score += 1;
    if (score >= 4) return { label: "Advanced", color: "text-red-600 border-red-200 bg-red-50" };
    if (score >= 2) return { label: "Intermediate", color: "text-amber-600 border-amber-200 bg-amber-50" };
    return { label: "Foundational", color: "text-emerald-600 border-emerald-200 bg-emerald-50" };
  };
  const difficulty = getDiff();
  const focusCaps = scenario.suggestedFocusCapabilities || [];
  const challenges = (scenario.keyChallenges || []).slice(0, 3);
  const predictiveSeed = useMemo(() => buildPredictiveSeedFromScenario(scenario), [scenario]);
  const predictiveProfile = useMemo(() => buildPredictiveProfile(predictiveSeed), [predictiveSeed]);
  const controlSelection = useMemo(() => deriveUISelectionFromBrain(scenario), [scenario]);
  const realismValue = deriveContractTemperature(scenario);
  const predictiveHighlights = [
    { label: "Mindset", value: cleanPredictiveHighlight(predictiveProfile?.sections?.mindset?.headline) },
    { label: "Likely blocker", value: cleanPredictiveHighlight(predictiveProfile?.sections?.objections?.headline) },
    { label: "Best next move", value: cleanPredictiveHighlight(predictiveProfile?.sections?.repApproach?.headline) },
  ].filter((item) => item.value);

  const openAdvancedBuilder = () => {
    const params = new URLSearchParams();
    Object.entries(predictiveSeed).forEach(([key, value]) => {
      if (value) params.set(key, String(value));
    });
    const suffix = params.toString();
    navigate(`/predictive-builder${suffix ? `?${suffix}` : ""}`);
  };

  // Strip "Role — " prefix from context
  const contextDetail = (() => {
    const raw = scenario.context || "";
    const sep = raw.indexOf(" — ");
    return sep !== -1 ? raw.slice(sep + 3) : raw;
  })();

  const getControlLabel = (options, value) => options.find((option) => option.value === value)?.label || value;

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
          className="relative w-full sm:max-w-[1080px] max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-[28px] bg-white shadow-2xl"
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
            className="px-6 py-6 space-y-5"
            style={{ background: "linear-gradient(180deg, #f9fbfc 0%, #eef7f7 100%)" }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
              <BriefSection eyebrow="HCP profile" title={scenario.stakeholder} tone="dark">
                {contextDetail || "Scenario-specific HCP context will appear here."}
              </BriefSection>
              <BriefSection eyebrow="Objective" title="What the rep is trying to accomplish" tone="dark">
                {scenario.objective}
              </BriefSection>
            </div>

            <OpeningSceneBlock scenario={scenario} />

            <div className="rounded-2xl border p-4" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(241,249,248,0.98) 100%)", borderColor: "rgba(114, 190, 178, 0.34)" }}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "hsl(176 52% 30%)" }}>
                    Predictive Read
                  </p>
                  <p className="mt-1 text-sm leading-relaxed" style={{ color: "hsl(213 20% 33%)" }}>
                    What the HCP is likely testing before they give the rep more time.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAdvancedBuilder}
                  className="shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors"
                  style={{
                    color: "hsl(176 45% 14%)",
                    background: "rgba(227, 247, 243, 0.96)",
                    border: "1px solid rgba(89, 175, 164, 0.45)",
                  }}
                >
                  Open Advanced Builder
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                {predictiveHighlights.map((item) => (
                  <BriefMetric key={item.label} label={item.label} value={item.value} />
                ))}
              </div>

              <div className="flex flex-wrap gap-2 mt-4 border-t pt-4" style={{ borderColor: "rgba(114, 190, 178, 0.20)" }}>
                {[
                  ["HCP", getControlLabel(HCP_ROLE_OPTIONS, controlSelection.hcpType)],
                  ["Stage", getControlLabel(CONVERSATION_STAGE_OPTIONS, controlSelection.stage)],
                  ["Pressure", getControlLabel(CHALLENGE_CONTEXT_OPTIONS, controlSelection.challenge)],
                  ["Realism", `${realismValue}/10`],
                ].map(([field, value]) => (
                  <span
                    key={field}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    style={{
                      color: "hsl(213 32% 29%)",
                      background: "rgba(231, 242, 243, 0.95)",
                      border: "1px solid rgba(114, 190, 178, 0.32)",
                    }}
                  >
                    {field}: {value}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
              <BriefSection eyebrow="Tactical focus" title="What matters in this scenario">
                {scenario.description}
              </BriefSection>
              <BriefSection eyebrow="Key challenges" title="Watch for these blockers">
                <ul className="space-y-2">
                  {challenges.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 leading-relaxed">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "hsl(176 52% 36%)" }} />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </BriefSection>
            </div>

            <div className="grid grid-cols-1 gap-4">
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
                    <div className="grid sm:grid-cols-3 gap-2">
                      {SIGNAL_INTELLIGENCE_CAPABILITIES
                        .filter(cap => focusCaps.includes(cap.id))
                        .map(cap => (
                          <CapPill key={cap.id}>{cap.metric}</CapPill>
                        ))
                      }
                    </div>
                  </div>
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
              <button
                type="button"
                onClick={openAdvancedBuilder}
                className="py-2 px-5 rounded-lg border text-sm font-semibold transition-colors"
                style={{
                  borderColor: "rgba(34, 123, 118, 0.24)",
                  color: "hsl(176 42% 28%)",
                  background: "rgba(227, 247, 243, 0.92)",
                }}
              >
                Advanced Builder
              </button>
              <button onClick={onStart}
                className="py-2 px-6 rounded-lg text-sm font-semibold text-white transition-colors"
                style={{ background: "hsl(174 40% 14%)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "hsl(174 40% 20%)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "hsl(174 40% 14%)"; }}
              >
                Start Roleplay →
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </TooltipProvider>
  );
}
