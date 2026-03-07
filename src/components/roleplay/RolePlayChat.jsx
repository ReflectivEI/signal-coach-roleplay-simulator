import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, X, CheckCircle, Loader2, BarChart3, MessageSquare, Highlighter, Zap, User, Bot } from "lucide-react";
import { createPageUrl } from "@/utils";
import ReactMarkdown from "react-markdown";
import CapabilityFeedbackPanel from "./CapabilityFeedbackPanel";
import AnnotatedTranscript from "./AnnotatedTranscript";
import {
  deriveInitialState, deriveInitialTemperature,
  transitionState, transitionTemperature, transitionSeverity,
  buildHCPProfile, buildHCPDialoguePrompt,
  normalizeHcpDialoguePunctuation,
  detectHcpDisagreement, escalateForDisagreement,
  TEMPERATURES,
} from "./hcpSimulationEngine";
import { SIGNAL_CAPABILITIES, GOVERNANCE } from "./signalIntelligenceSOT";

// Compact SOT block injected into end-session LLM feedback prompt
const FEEDBACK_SOT = `SIGNAL INTELLIGENCE™ — SOURCE OF TRUTH (AUTHORITATIVE):
${GOVERNANCE.scoringRule}
Capabilities (use canonical labels only):
${SIGNAL_CAPABILITIES.map(c => `• ${c.label} [${c.id}]: ${c.canonicalQuestion} — ${c.definition}`).join("\n")}
Overlap rules: ${GOVERNANCE.overlapRules.join(" | ")}
GUARDRAIL: Never invent capabilities, sub-metrics, or scores not listed above. Observable behavior only — no intent inference.`;
import { computeAlignment } from "./alignmentEngine";
import CoachingOverlay, { shouldTriggerCoaching, analyzeSessionPatterns } from "./CoachingOverlay";
import LiveMetricsPanel from "./LiveMetricsPanel";
import { useVoice } from "./useVoice";
import VoiceControls from "./VoiceControls";

const difficultyColors = {
  beginner: "bg-slate-100 text-slate-700",
  intermediate: "bg-slate-100 text-slate-700",
  advanced: "bg-slate-100 text-slate-700",
};

const stateColors = {
  'neutral': 'bg-slate-100 text-slate-600 border-slate-200',
  'engaged': 'bg-teal-100 text-teal-700 border-teal-200',
  'time-pressured': 'bg-slate-100 text-slate-700 border-slate-200',
  'resistant': 'bg-slate-100 text-slate-700 border-slate-200',
  'boundary-setting': 'bg-slate-100 text-slate-700 border-slate-200',
  'irritated': 'bg-slate-100 text-slate-700 border-slate-200',
  'disengaging': 'bg-slate-100 text-slate-700 border-slate-200',
};

const stateLabels = {
  'neutral': '● Neutral',
  'engaged': '▲ Engaged',
  'time-pressured': '⏱ Time-Pressured',
  'resistant': '⊖ Resistant',
  'boundary-setting': '⛔ Boundary-Setting',
  'irritated': '⚠ Irritated',
  'disengaging': '↗ Disengaging',
};

export default function RolePlayChat({ scenario, onClose, onSessionSaved }) {
  const navigate = useNavigate();
  const [turns, setTurns] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [activeTab, setActiveTab] = useState("chat");
  const [coachingTip, setCoachingTip] = useState(null);
  const [voiceSettings, setVoiceSettings] = useState({ ttsEnabled: true, volume: 0.9, rate: 1.0 });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  // Stable session ID for deterministic cue selection
  const sessionIdRef = useRef(`session_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
  const sid = sessionIdRef.current;
  // eslint-disable-next-line no-unused-vars
  // Mutable simulation state — NOT in React state (no re-renders on change)
  const simStateRef = useRef({ temperature: 'neutral', severity: 0 });

  const {
    isListening, isSpeaking, interim, sttSupported, ttsSupported,
    toggleListening, stopListening, speak, stopSpeaking,
  } = useVoice({
    onTranscript: (text) => setInput((prev) => prev ? prev + " " + text : text),
    voiceSettings,
  });

  useEffect(() => {
    if (activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      // Auto-focus input after each turn when not loading
      if (!isLoading && !isEnding) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, [turns, activeTab, isLoading, isEnding]);

  // ─── INIT ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const initialState = deriveInitialState(scenario);
        const initialTemp = deriveInitialTemperature(initialState);
        simStateRef.current = { temperature: initialTemp, severity: 0 };

        // Build a locked profile for turn 0 to establish initial cue and context
        const initialProfile = buildHCPProfile({
          sessionId: sid,
          turnNumber: 0,
          structuralState: initialState,
          temperature: initialTemp,
          severity: 0,
        });

        // Initialize turn 0: REP SPEAKS FIRST (not HCP)
        // No HCP dialogue needed — rep opens the interaction
        setTurns([{
          turnNumber: 0,
          hcpStateBefore: initialState,
          temperatureBefore: initialTemp,
          severityBefore: 0,
          cueBefore: initialProfile.lockedCue,
          hcpDialogueBefore: null,
          repMessage: null,
          alignment: null,
          hcpStateAfter: null,
        }]);
      } catch (err) {
        console.error('Init error:', err);
        setTurns([]);
      } finally {
        setIsLoading(false);
        // Auto-focus input on initial load
        setTimeout(() => inputRef.current?.focus(), 200);
      }
    };
    init();
  }, [scenario]);

  // ─── SEND MESSAGE ─────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const repMessage = input.trim();
    setInput("");
    setIsLoading(true);
    
    // Stop mic if it's still listening when message is sent
    if (isListening) {
      stopListening();
    }

    // The turn the rep is responding to = last turn in the array (which has a hcpDialogueBefore but no repMessage yet)
    const respondingToTurn = turns[turns.length - 1];
    const prevState = respondingToTurn.hcpStateBefore;
    const prevTemp = respondingToTurn.temperatureBefore || simStateRef.current.temperature;
    const prevSev = respondingToTurn.severityBefore ?? simStateRef.current.severity;

    // 1. Score alignment against the locked state + temperature the rep SAW
    // IMPORTANT: Score BEFORE any temperature escalation from disagreement
    // The rep responds to what they observed, not to future emotional escalation
    const prevHcpState = turns.length >= 2 ? turns[turns.length - 2].hcpStateBefore : null;
    const alignment = computeAlignment(prevState, repMessage, null, prevTemp, prevHcpState);

    // 2. Transition structural state and base temperature (deterministic)
    const nextHcpState = transitionState(prevState, repMessage, prevTemp);
    let nextTemp = transitionTemperature(prevTemp, repMessage);
    const nextSev = transitionSeverity(prevSev, alignment, prevState, nextHcpState);

    // 3. APPLY HCP DISAGREEMENT ESCALATION TO NEXT TEMPERATURE
    // If the HCP disagreed in the turn we just responded to, their emotional temperature
    // escalates for the NEXT turn (not the current alignment scoring)
    if (respondingToTurn.hcpDisagreed) {
      const escalatedIndex = escalateForDisagreement(
        TEMPERATURES.indexOf(nextTemp),
        respondingToTurn.disagreementInfo
      );
      const clampedIndex = Math.max(0, Math.min(escalatedIndex, TEMPERATURES.length - 1));
      nextTemp = TEMPERATURES[clampedIndex];
      console.log(`Applied HCP Disagreement Escalation to Next Turn | Base: ${transitionTemperature(prevTemp, repMessage)} | Escalated: ${nextTemp}`);
    }

    simStateRef.current = { temperature: nextTemp, severity: nextSev };

    // 3. Lock rep's response
    const lockedRespondingTurn = {
      ...respondingToTurn,
      repMessage,
      alignment,
      hcpStateAfter: nextHcpState,
      temperatureAfter: nextTemp,
    };

    // 4. Build locked HCP profile for the NEXT turn — SINGLE SOURCE OF TRUTH
    // This guarantees cue and dialogue ALWAYS match the same state
    const nextTurnNumber = turns.length;
    const nextProfile = buildHCPProfile({
      sessionId: sid,
      turnNumber: nextTurnNumber,
      structuralState: nextHcpState,
      temperature: nextTemp,
      severity: nextSev,
    });

    // 5. Build history for LLM context
    const prevTurns = [...turns.slice(0, turns.length - 1), lockedRespondingTurn];
    const historyText = flattenTurns(prevTurns)
      .map((m) => `${m.role === "user" ? "Sales Rep" : "HCP"}: ${m.content}`)
      .join("\n");

    // 6. Generate next HCP dialogue using buildHCPDialoguePrompt — ensures cue/state/dialogue alignment
    let nextHcpDialogue = "I see. Let me consider that.";
    try {
      const systemPrompt = buildHCPDialoguePrompt({
        scenario,
        hcpProfile: nextProfile,
        historyText,
        isOpening: false,
      });
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: systemPrompt, roleplay: true })
      });
      if (res.ok) {
        const data = await res.json();
        const raw = (data.response || data.text || data.content || '');
        const rawStr = typeof raw === 'string' ? raw : String(raw);
        // Strip any leaked stage directions (asterisks, parens, brackets)
        nextHcpDialogue = rawStr
          .replace(/\*[^*]*\*/g, '')
          .replace(/\([^)]*\)/g, '')
          .replace(/\[[^\]]*\]/g, '')
          .trim()
          .split('\n')[0];

        nextHcpDialogue = normalizeHcpDialoguePunctuation(nextHcpDialogue);
      }
    } catch (err) {
      console.error('HCP dialogue generation error:', err);
    }

    // 6.5 DETECT HCP DISAGREEMENT & RECORD FOR NEXT TURN
    // If the HCP disagreed with the rep's suggestion, flag this for the NEXT turn's temperature escalation
    const disagreementInfo = detectHcpDisagreement(nextHcpDialogue);
    if (disagreementInfo.disagrees) {
      console.log(`HCP Disagreement Detected in Turn ${turns.length} | Strong: ${disagreementInfo.strongDisagree} | Mild: ${disagreementInfo.mildDisagree}`);
    }

    // 7. Coaching overlay — driven by alignment rubric flags
    const coachingResult = shouldTriggerCoaching(alignment, prevState, nextHcpState);
    if (coachingResult.shouldShow) setCoachingTip(coachingResult);

    // 8. Lock next turn with cue from profile (guaranteed to match state)
    const nextTurn = {
      turnNumber: nextTurnNumber,
      hcpStateBefore: nextHcpState,
      temperatureBefore: nextTemp,
      severityBefore: nextSev,
      cueBefore: nextProfile.lockedCue,
      hcpDialogueBefore: nextHcpDialogue,
      repMessage: null,
      alignment: null,
      hcpStateAfter: null,
      hcpDisagreed: disagreementInfo.disagrees,
      disagreementInfo: disagreementInfo,
    };

    const updatedTurns = [...turns.slice(0, turns.length - 1), lockedRespondingTurn, nextTurn];
    setTurns(updatedTurns);

    setIsLoading(false);
    speak(nextHcpDialogue);
    
    // Auto-focus input after HCP responds
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ─── HELPERS ──────────────────────────────────────────────────────────────────
  function flattenTurns(turnList) {
    const msgs = [];
    turnList.forEach((t) => {
      if (t.hcpDialogueBefore) msgs.push({ role: "assistant", content: t.hcpDialogueBefore });
      if (t.repMessage) msgs.push({ role: "user", content: t.repMessage });
    });
    return msgs;
  }

  // Current HCP state = the state the rep is currently facing (last turn's hcpStateBefore)
  const currentHcpState = turns.length > 0 ? turns[turns.length - 1].hcpStateBefore : null;
  const repTurnsCount = turns.filter((t) => t.repMessage).length;

  // ─── END SESSION ──────────────────────────────────────────────────────────────
  const endSession = async () => {
    setIsEnding(true);
    try {
      // Build conversation transcript
      const historyText = flattenTurns(turns)
        .map((m) => `${m.role === "user" ? "Sales Rep" : "HCP"}: ${m.content}`)
        .join("\n");

      // Build turn-by-turn scoring summary (per-capability averages)
      const scoredTurns = turns.filter(t => t.alignment?.metrics);
      const capAccum = {};
      scoredTurns.forEach(t => {
        Object.entries(t.alignment.metrics).forEach(([cap, val]) => {
          if (!capAccum[cap]) capAccum[cap] = { total: 0, count: 0 };
          capAccum[cap].total += val.score;
          capAccum[cap].count += 1;
        });
      });
      const avgCapScores = Object.fromEntries(
        Object.entries(capAccum).map(([cap, v]) => [cap, (v.total / v.count).toFixed(1)])
      );
      // Build sub-metric detail for richer coaching context
      const subMetricAccum = {};
      scoredTurns.forEach(t => {
        Object.entries(t.alignment.metrics).forEach(([cap, val]) => {
          if (!val.subScores) return;
          Object.entries(val.subScores).forEach(([sub, score]) => {
            if (!subMetricAccum[cap]) subMetricAccum[cap] = {};
            if (!subMetricAccum[cap][sub]) subMetricAccum[cap][sub] = { total: 0, count: 0 };
            subMetricAccum[cap][sub].total += score;
            subMetricAccum[cap][sub].count += 1;
          });
        });
      });
      const capSummary = Object.entries(avgCapScores)
        .map(([cap, score]) => {
          const subs = subMetricAccum[cap];
          const subLine = subs
            ? Object.entries(subs).map(([s, v]) => `  ↳ ${s.replace(/_/g, ' ')}: ${(v.total / v.count).toFixed(1)}/5`).join('\n')
            : '';
          return `• ${cap.replace(/_/g, ' ')}: ${score}/5${subLine ? '\n' + subLine : ''}`;
        })
        .join('\n');

      // Collect all rubric alignment flags (Signal–Response Alignment derived checks)
      const allRubricFlags = [...new Set(scoredTurns.flatMap(t => t.alignment?.rubricAlignmentFlags || []))];
      const allMisalignments = [...new Set(scoredTurns.flatMap(t => t.alignment?.misalignments || []))];
      const allPositives = [...new Set(scoredTurns.flatMap(t => t.alignment?.positives || []))];

      const rubricSection = allRubricFlags.length > 0
        ? `\nSIGNAL–RESPONSE ALIGNMENT ISSUES (canonical feedback language — use these verbatim or closely paraphrase):\n${allRubricFlags.map(f => `• ${f}`).join('\n')}`
        : '';

      // Build feedback prompt with Signal Intelligence SOT + scoring data
      const prompt = `You are a skilled sales coach analyzing a roleplay simulation session. Ground ALL feedback in observable behavior only — never infer intent, emotion, or personality traits.

${FEEDBACK_SOT}

SESSION SCORING DATA (deterministic, turn-by-turn):
${capSummary}

POSITIVES OBSERVED (turn-by-turn):
${allPositives.length > 0 ? allPositives.slice(0, 10).map(p => `• ${p}`).join('\n') : '• None detected'}

MISALIGNMENTS OBSERVED (turn-by-turn):
${allMisalignments.length > 0 ? allMisalignments.slice(0, 10).map(m => `• ${m}`).join('\n') : '• None detected'}
${rubricSection}

Session Context:
Scenario: ${scenario.title}
HCP Type: ${scenario.hcp_category}
Difficulty: ${scenario.difficulty}

Conversation Transcript:
${historyText}

Provide comprehensive Signal Intelligence coaching feedback:
1. **Overall Alignment Score** — reference the scoring data above
2. **Capabilities Done Well** — cite specific turn behaviors, reference canonical capability labels
3. **Capabilities to Develop** — cite specific misalignments, use impact-based feedback language ("This may reduce trust / credibility / access")
4. **Signal–Response Alignment** — address any rubric flags above using the exact feedback language provided
5. **Specific Action Items** — 2-3 concrete behavioral changes for next session

GUARDRAIL: All feedback must describe observable behavior. Do NOT assess empathy, intent, emotional intelligence, or personality.`;
      
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      
      if (res.ok) {
        const data = await res.json();
        const fbRaw = data.response || data.text || data.content || '';
        setFeedback(typeof fbRaw === 'string' ? fbRaw : String(fbRaw));
      } else {
        setFeedback("Unable to generate session feedback. Please try again.");
      }
    } catch (err) {
      console.error('Session feedback generation error:', err);
      setFeedback("Unable to generate session feedback. Please try again.");
    } finally {
      setIsEnding(false);
    }
  };

  // ─── FEEDBACK VIEW ────────────────────────────────────────────────────────────
  const exportFeedbackPDF = () => {
    const content = `SESSION FEEDBACK - ${scenario.title}\nDate: ${new Date().toLocaleDateString()}\n\n${feedback}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-feedback-${scenario.title.replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (feedback) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-teal-600" />
              <h2 className="font-bold text-slate-900">Session Feedback</h2>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 prose prose-sm max-w-none">
            <ReactMarkdown>{feedback}</ReactMarkdown>
          </div>
          <div className="px-6 py-4 border-t flex justify-between items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportFeedbackPDF} className="text-xs">
              ↓ Export PDF
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-teal-400 text-teal-600 hover:bg-teal-50"
                onClick={() => {
                  // Aggregate all misalignments and positives from turns
                  const allMisalignments = [...new Set(turns.flatMap(t => t.alignment?.misalignments || []))];
                  const allPositives = [...new Set(turns.flatMap(t => t.alignment?.positives || []))];
                  const capScores = {};
                  const capCounts = {};
                  turns.forEach(t => {
                    if (!t.alignment?.metrics) return;
                    Object.entries(t.alignment.metrics).forEach(([cap, val]) => {
                      capScores[cap] = (capScores[cap] || 0) + val.score;
                      capCounts[cap] = (capCounts[cap] || 0) + 1;
                    });
                  });
                  const avgCapScores = Object.fromEntries(
                    Object.entries(capScores).map(([cap, total]) => [cap, Math.round((total / capCounts[cap]) * 10) / 10])
                  );
                  const overallScore = turns.filter(t => t.alignment).length > 0
                    ? Math.round(turns.filter(t => t.alignment).reduce((s, t) => s + t.alignment.score, 0) / turns.filter(t => t.alignment).length * 10) / 10
                    : null;

                  const ctx = encodeURIComponent(JSON.stringify({
                    scenarioTitle: scenario.title,
                    hcpCategory: scenario.hcp_category,
                    specialty: scenario.specialty,
                    misalignments: allMisalignments,
                    positives: allPositives,
                    capabilityScores: avgCapScores,
                    overallScore,
                  }));
                  navigate(createPageUrl("AICoach") + `?session_context=${ctx}`);
                }}
              >
                <Bot className="w-3 h-3 mr-1" />
                Coach on this session
              </Button>
              <Button className="bg-teal-500 hover:bg-teal-600" onClick={onClose}>Done</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const flatMessages = flattenTurns(turns);

  // ─── CHAT VIEW ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: "#f0f4f8" }}>
      {/* Left: Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0 bg-white border-r border-gray-200">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-3 border-b flex-shrink-0 bg-white">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-slate-900 text-sm leading-snug">{scenario.title}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full border border-gray-300 text-gray-600 font-medium">{scenario.difficulty}</span>
              {currentHcpState && (
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${stateColors[currentHcpState]}`}>
                  {stateLabels[currentHcpState]}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{scenario.hcp_category} · {scenario.specialty}</p>
          </div>
          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
            <button
              onClick={endSession}
              disabled={isEnding || repTurnsCount < 2}
              className="inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all duration-200 text-xs px-3 py-1.5 border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isEnding ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
              End & Get Feedback
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-gray-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Persona strip */}
        <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 text-xs text-slate-600 flex-shrink-0 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-slate-400" />
          You are the <strong>Sales Rep</strong>. The AI is playing the <strong>{scenario.hcp_category || "HCP"}</strong>.
        </div>

        {/* Tabs — NavPill style */}
        <div className="flex gap-1 px-4 py-2.5 border-b flex-shrink-0 bg-white">
          {[
            { id: "chat", label: "Live Chat", icon: MessageSquare },
            { id: "annotate", label: "Annotated Transcript", icon: Highlighter, disabled: repTurnsCount < 1 },
            { id: "capabilities", label: "Capability Feedback", icon: Zap, disabled: repTurnsCount < 1 },
          ].map(({ id, label, icon: Icon, disabled }) => (
            <button
              key={id}
              disabled={disabled}
              onClick={() => setActiveTab(id)}
              className={`inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all duration-200 text-xs px-3 py-1 ${activeTab === id
                  ? "border-[#39ACAC] text-[#39ACAC] bg-[#e6f7f7]"
                  : disabled
                    ? "border-gray-200 text-gray-300 cursor-not-allowed"
                    : "border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7]"
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">

          {/* CHAT TAB */}
          {activeTab === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

                {turns.length === 0 && isLoading && (
                  <div className="flex justify-center py-8">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "0.1s" }} />
                      <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "0.2s" }} />
                    </div>
                  </div>
                )}

                {turns.map((turn, i) => (
                  <div key={i} className="space-y-2">
                    {turn.cueBefore && (
                      <div className="flex justify-start pl-1">
                        <p className={`max-w-[85%] text-xs italic leading-relaxed px-3 py-1.5 rounded-lg border ${stateColors[turn.hcpStateBefore] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                          {turn.cueBefore}
                        </p>
                      </div>
                    )}
                    {turn.hcpDialogueBefore && (
                      <div className="flex justify-start">
                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold mr-2 flex-shrink-0 mt-1">HCP</div>
                        <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-slate-100 text-slate-800">
                          {turn.hcpDialogueBefore}
                        </div>
                      </div>
                    )}
                    {turn.repMessage && (
                      <div className="space-y-1">
                        <div className="flex justify-end">
                          <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed font-medium" style={{ background: "#39ACAC", color: "white" }}>
                            {turn.repMessage}
                          </div>
                        </div>
                        {turn.alignment && (
                          <div className="flex justify-end flex-col items-end gap-1">
                            <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs border ${turn.alignment.score >= 4 ? 'bg-teal-50 text-teal-700 border-teal-200' :
                                turn.alignment.score <= 2 ? 'bg-red-50 text-red-700 border-red-200' :
                                  'bg-slate-50 text-slate-600 border-slate-200'
                              }`}>
                              <span className="font-semibold">Signal Alignment {turn.alignment.score}/5</span>
                              <span className="opacity-50">·</span>
                              <span className="italic">{turn.alignment.ruleLabel}</span>
                              {turn.alignment.misalignments.length > 0 && (
                                <span className="truncate max-w-[260px]">⚠ {turn.alignment.misalignments[0]}</span>
                              )}
                              {turn.alignment.misalignments.length === 0 && turn.alignment.positives.length > 0 && (
                                <span className="text-green-600 truncate max-w-[260px]">✓ {turn.alignment.positives[0]}</span>
                              )}
                            </div>
                            {turn.alignment.rubricAlignmentFlags?.length > 0 && (
                              <div className="max-w-[90%] px-2.5 py-1 rounded-lg text-xs bg-amber-50 border border-amber-200 text-amber-700 italic">
                                {turn.alignment.rubricAlignmentFlags[0]}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && turns.length > 0 && (
                  <div className="flex justify-start">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold mr-2 flex-shrink-0">HCP</div>
                    <div className="bg-slate-100 rounded-2xl px-4 py-2.5 flex gap-1 items-center">
                      <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0.1s" }} />
                      <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0.2s" }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <CoachingOverlay
                tip={coachingTip?.tip}
                label={coachingTip?.label}
                suggestion={coachingTip?.suggestion}
                severity={coachingTip?.severity}
                escalationLabel={coachingTip?.escalationLabel}
                onDismiss={() => setCoachingTip(null)}
              />

              {/* Input */}
              <div className="px-5 py-3 border-t flex-shrink-0 bg-white">
                <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        // Stop mic when user starts typing manually
                        if (isListening && e.target.value.length > input.length) {
                          stopListening();
                        }
                      }}
                      onKeyDown={(e) => {
                        // Submit on Enter (without Shift)
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder={isListening ? "Listening…" : "Your response as the sales rep..."}
                      disabled={isLoading || isEnding}
                      className={`flex-1 w-full pr-2 ${isListening ? "border-red-400 ring-1 ring-red-300" : ""}`}
                    />
                    {isListening && interim && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none truncate pr-4">
                        {input ? null : <span className="italic">{interim}</span>}
                      </div>
                    )}
                  </div>
                  <VoiceControls
                    isListening={isListening}
                    isSpeaking={isSpeaking}
                    sttSupported={sttSupported}
                    ttsSupported={ttsSupported}
                    voiceSettings={voiceSettings}
                    onToggleMic={toggleListening}
                    onStopSpeaking={stopSpeaking}
                    onChangeSettings={setVoiceSettings}
                  />
                  <Button type="submit" disabled={isLoading || isEnding || (!input.trim() && !interim)} style={{ background: "#39ACAC" }} className="hover:opacity-90">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
                {isListening && interim && (
                  <p className="text-xs text-red-500 mt-1 italic">🎙 "{interim}"</p>
                )}
                <p className="text-xs text-slate-400 mt-1 italic">
                  Signal–Response Alignment evaluates observable behavioral adaptation — not empathy, intent, or personality.
                </p>
              </div>
            </>
          )}

          {activeTab === "annotate" && (
            <AnnotatedTranscript messages={flatMessages} scenario={scenario} />
          )}

          {activeTab === "capabilities" && (
            <div className="flex-1 overflow-y-auto">
              <CapabilityFeedbackPanel messages={flatMessages} turns={turns} scenario={scenario} />
            </div>
          )}
        </div>
      </div>

      {/* Right: Live Behavioral Metrics Panel */}
      <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0" style={{ background: "#1A334D" }}>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Behavioral Metrics</h3>
          <p className="text-xs mt-0.5" style={{ color: "#39ACAC" }}>Turn-by-turn Signal Intelligence scoring</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <LiveMetricsPanel turns={turns} />
        </div>
      </div>
    </div>
  );
}