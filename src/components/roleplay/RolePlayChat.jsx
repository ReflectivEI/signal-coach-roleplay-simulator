import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, X, MessageSquare, Highlighter, Zap, Bot, ListChecks } from "lucide-react";
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
  updateTurnState,
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
import CoachingOverlay, { shouldTriggerCoaching } from "./CoachingOverlay";
import LiveMetricsPanel from "./LiveMetricsPanel";
import { useVoice } from "./useVoice";
import VoiceControls from "./VoiceControls";
import { getDifficultyVisuals } from "./difficultyStyles";
import { normalizeMessage } from "@/lib/messageNormalization";
import { normalizeTone } from "@/lib/conversationToneNormalization";

function escapeHTML(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sanitizeUserMessage(text) {
  return escapeHTML(String(text || "").trim());
}

function sanitizeRenderedMessage(text, source = "unknown") {
  const originalText = String(text || "");
  const normalizedText = normalizeMessage(originalText);
  const toneNormalizedText = normalizeTone(normalizedText);
  const hardenedText = hardenTextSurface(toneNormalizedText);
  const renderedText = escapeHTML(hardenedText);

  if (
    import.meta.env.DEV
    && originalText.includes("?")
    && !renderedText.includes("?")
  ) {
    console.warn("PUNCTUATION_INTEGRITY_VIOLATION", { source });
  }

  return renderedText;
}

function hardenTextSurface(text) {
  let value = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!value) return "";

  value = value
    .replace(/\bi\b/g, "I")
    .replace(/([.!?])\s*([a-z])/g, (_, punc, char) => `${punc} ${char.toUpperCase()}`)
    .replace(/^([a-z])/, (_, char) => char.toUpperCase());

  if (!/[.!?]$/.test(value)) {
    const looksLikeQuestion = /\b(what|how|why|when|where|who|which|do|does|did|can|could|would|will|is|are|am|should|have|has|had)\b/i.test(value);
    value += looksLikeQuestion ? "?" : ".";
  }

  return value;
}

function extractScenarioKeywords(scenario) {
  const combined = [
    scenario?.title,
    scenario?.description,
    scenario?.context,
    scenario?.opening_scene,
    scenario?.openingScene,
    scenario?.objective,
    scenario?.goal,
    ...(Array.isArray(scenario?.challenges) ? scenario.challenges : []),
  ].join(" ").toLowerCase();

  const stopWords = new Set(["that", "this", "with", "from", "into", "have", "your", "about", "there", "their", "they", "them", "what", "when", "where", "which"]);
  return [...new Set(combined.match(/[a-z][a-z-]{3,}/g) || [])].filter((word) => !stopWords.has(word));
}

function isScenarioGroundedDialogue(text, scenarioKeywords, repMessage) {
  const value = String(text || "").toLowerCase();
  const rep = String(repMessage || "").toLowerCase();
  if (!value) return false;

  const genericOnly = /^(i see\.?|thanks\.?|okay\.?|got it\.?|understood\.?|let me consider that\.?)+$/i.test(value.trim());
  if (genericOnly) return false;

  const scenarioHits = scenarioKeywords.filter((k) => value.includes(k)).length;
  const repHits = (rep.match(/[a-z][a-z-]{3,}/g) || []).filter((k) => value.includes(k)).length;
  const hasClinicalSignal = /\b(patient|patients|study|data|workflow|screening|access|prior auth|treatment|clinic|practice|protocol|follow-up|efficacy|safety|adherence)\b/.test(value);
  const asksClarifyingQuestion = value.includes("?") && value.split(/\s+/).length >= 8;
  return scenarioHits > 0 || repHits > 0 || hasClinicalSignal || asksClarifyingQuestion;
}


const GUIDANCE_PRIORITY_ORDER = [
  "signal_awareness",
  "signal_interpretation",
  "value_connection",
  "customer_engagement",
  "objection_navigation",
  "conversation_management",
  "adaptive_response",
  "commitment_generation",
];

const METRIC_GUIDANCE_LIBRARY = {
  signal_awareness: [
    "⚠ Anchor your next response to the exact operational signal the HCP named.",
    "⚠ Tie your point to this HCP's stated workflow pressure before adding new data.",
    "⚠ Reflect the specific challenge you heard so the HCP sees you are tracking their reality.",
    "⚠ Lead with the context cue the HCP gave, then connect your recommendation.",
    "⚠ Translate your opening line to the HCP's immediate clinic condition, not a generic priority.",
    "⚠ Use the HCP's own wording about constraints to frame your next statement.",
    "⚠ Show awareness first: identify the signal, then advance the conversation.",
  ],
  signal_interpretation: [
    "⚠ Confirm what the HCP meant before proposing the next step.",
    "⚠ Your next turn should test your interpretation with a brief clarifying question.",
    "⚠ Distinguish symptom from root concern before offering a recommendation.",
    "⚠ Interpret the HCP's signal into a concrete implication for care delivery.",
    "⚠ Reframe the concern in one sentence to verify shared understanding.",
    "⚠ Show how you interpreted the cue, then ask the HCP to validate it.",
    "⚠ Convert the HCP's statement into a check-back question before you advance.",
  ],
  value_connection: [
    "⚠ Information was presented; next turn should explain why it matters for this HCP's decisions.",
    "⚠ Connect the data to patient or workflow impact in this specific practice.",
    "⚠ Link your evidence to a measurable outcome the HCP already cares about.",
    "⚠ Move from feature language to practice-level consequence language.",
    "⚠ Tie your recommendation to the HCP's stated treatment objective.",
    "⚠ Clarify the value tradeoff relative to the burden the HCP described.",
    "⚠ Ground your value statement in this clinic's operating reality.",
  ],
  customer_engagement: [
    "⚠ Ask a focused follow-up that invites the HCP to expand their current concern.",
    "⚠ Increase participation by prompting the HCP to rank their top constraint.",
    "⚠ Keep momentum by turning your point into a targeted question.",
    "⚠ Pull the HCP in with a brief either-or question tied to workflow options.",
    "⚠ Encourage dialogue by asking for one concrete example from their practice.",
    "⚠ Advance engagement with a question that requires a practical response.",
    "⚠ Shift from monologue to collaboration by requesting the HCP's preference.",
  ],
  objection_navigation: [
    "⚠ Acknowledge the objection explicitly before redirecting toward options.",
    "⚠ Stay non-defensive and address the concern in the HCP's terms.",
    "⚠ Break the objection into one solvable piece and confirm agreement.",
    "⚠ Validate the concern, then offer a practical mitigation step.",
    "⚠ Respond to the resistance with clarification before persuasion.",
    "⚠ Keep objection handling constructive by testing one feasible alternative.",
    "⚠ Resolve the specific barrier first, then broaden to next steps.",
  ],
  conversation_management: [
    "⚠ Provide a clearer directional bridge so the conversation advances intentionally.",
    "⚠ Signal the next discussion step before introducing new content.",
    "⚠ Tighten your structure: acknowledge, align, then guide to action.",
    "⚠ Use a concise transition that shows where the conversation is headed.",
    "⚠ Keep the exchange focused on one decision point at a time.",
    "⚠ Add a purposeful steering question to avoid drifting into broad statements.",
    "⚠ Frame a clear path from current barrier to immediate next move.",
  ],
  adaptive_response: [
    "⚠ Adjust your approach to match the HCP's current tone and pressure level.",
    "⚠ Your next turn should flex to the cue instead of repeating a fixed script.",
    "⚠ Adapt depth and pace to the HCP's time signal before adding detail.",
    "⚠ Shift from broad messaging to situation-matched guidance.",
    "⚠ Respond to the latest cue with a tailored action option.",
    "⚠ Preserve continuity by explicitly building on the HCP's prior statement.",
    "⚠ Show adaptability by offering the smallest viable next step first.",
  ],
  commitment_generation: [
    "⚠ Close this exchange with a specific, owned next step.",
    "⚠ Convert discussion into commitment by proposing one concrete action.",
    "⚠ Ask for agreement on who will do what and by when.",
    "⚠ Strengthen closure by defining a practical follow-up checkpoint.",
    "⚠ Turn alignment into action with a clear implementation ask.",
    "⚠ Confirm commitment level with a simple next-step question.",
    "⚠ Establish ownership before ending the turn.",
  ],
};

const FALLBACK_GUIDANCE_LIBRARY = {
  misalignment_relevance: [
    "⚠ Data shared without tying it to this HCP's stated workflow burden.",
    "⚠ Missed opportunity to connect the message to this practice context.",
    "⚠ Relevance gap: link your point to the challenge the HCP just named.",
    "⚠ The response stayed informational instead of practice-specific.",
  ],
  misalignment_probe: [
    "⚠ Missed chance to probe the operational constraint the HCP just raised.",
    "⚠ Ask one clarifying question before offering another recommendation.",
    "⚠ The next turn should explore the barrier source, not just restate data.",
    "⚠ Probe the bottleneck directly to improve response precision.",
  ],
  misalignment_adaptation: [
    "⚠ Response did not adapt to the HCP's latest cue.",
    "⚠ Mirror the HCP's signal first, then tailor your next suggestion.",
    "⚠ Adaptation gap: adjust to the pressure level expressed in this turn.",
    "⚠ Use the HCP's immediate concern to shape your next message.",
  ],
  misalignment_closure: [
    "⚠ Good topic progression; now secure a concrete next step.",
    "⚠ Move from discussion to commitment with a specific action ask.",
    "⚠ Clarify ownership to prevent the conversation from stalling.",
    "⚠ Close with a defined follow-up rather than another broad statement.",
  ],
  positive_progress: [
    "✓ Direction is solid — next turn can deepen specificity around implementation.",
    "✓ Good alignment with the HCP signal — now lock in an actionable step.",
    "✓ Strong turn foundation — follow with a targeted practical question.",
    "✓ Productive response — convert this momentum into a clear next move.",
  ],
};

function deterministicIndex(seedText, total) {
  if (!total) return 0;
  const seed = String(seedText || "");
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash * 31) + seed.charCodeAt(i)) >>> 0;
  }
  return hash % total;
}

function mapIssueCategory(alignment) {
  const firstFlag = String(alignment?.rubricAlignmentFlags?.[0] || "").toLowerCase();
  const firstMisalignment = String(alignment?.misalignments?.[0] || "").toLowerCase();
  const combined = `${firstFlag} ${firstMisalignment}`;

  if (/(matter|relevance|context|why it matters|value)/.test(combined)) return "misalignment_relevance";
  if (/(probe|question|clarify|explore|understand)/.test(combined)) return "misalignment_probe";
  if (/(adapt|signal|cue|tone|responsive|responsiveness)/.test(combined)) return "misalignment_adaptation";
  if (/(next step|commit|closure|owner|follow-up|follow up)/.test(combined)) return "misalignment_closure";
  if (alignment?.positives?.length) return "positive_progress";
  return "misalignment_relevance";
}

function getLowestMetricId(metrics = {}) {
  const entries = Object.entries(metrics || {})
    .filter(([, val]) => Number.isFinite(Number(val?.score)))
    .sort((a, b) => {
      const scoreDiff = Number(a[1].score) - Number(b[1].score);
      if (scoreDiff !== 0) return scoreDiff;
      return GUIDANCE_PRIORITY_ORDER.indexOf(a[0]) - GUIDANCE_PRIORITY_ORDER.indexOf(b[0]);
    });

  return entries[0]?.[0] || null;
}

function buildGuidanceCandidate(turn) {
  const alignment = turn?.alignment;
  if (!alignment) return null;

  const lowestMetricId = getLowestMetricId(alignment.metrics || {});
  const metricGuidanceSet = lowestMetricId ? METRIC_GUIDANCE_LIBRARY[lowestMetricId] : null;
  if (metricGuidanceSet?.length) {
    const metricSignal = alignment.metrics?.[lowestMetricId]?.reason || alignment.misalignments?.[0] || alignment.rubricAlignmentFlags?.[0] || "metric";
    const index = deterministicIndex(`${turn.turnNumber}:${lowestMetricId}:${metricSignal}`, metricGuidanceSet.length);
    return metricGuidanceSet[index];
  }

  const category = mapIssueCategory(alignment);
  const fallbackSet = FALLBACK_GUIDANCE_LIBRARY[category] || FALLBACK_GUIDANCE_LIBRARY.misalignment_relevance;
  const issueSignal = alignment.rubricAlignmentFlags?.[0] || alignment.misalignments?.[0] || alignment.positives?.[0] || "fallback";
  const index = deterministicIndex(`${turn.turnNumber}:${category}:${issueSignal}`, fallbackSet.length);
  return fallbackSet[index];
}

function buildRepGuidance(turn, allTurns = []) {
  const alignment = turn?.alignment;
  if (!alignment) return null;

  const recentGuidanceWindow = allTurns
    .filter((t) => t.turnNumber < turn.turnNumber && t.repMessage)
    .slice(-15)
    .map((t) => String(buildGuidanceCandidate(t)).trim())
    .filter(Boolean);

  const lowestMetricId = getLowestMetricId(alignment.metrics || {});
  const metricGuidanceSet = lowestMetricId ? METRIC_GUIDANCE_LIBRARY[lowestMetricId] : null;

  const pickNonRepeatingGuidance = (guidanceSet, seedText) => {
    if (!guidanceSet?.length) return null;
    const baseIndex = deterministicIndex(seedText, guidanceSet.length);
    for (let offset = 0; offset < guidanceSet.length; offset += 1) {
      const candidate = guidanceSet[(baseIndex + offset) % guidanceSet.length];
      if (!recentGuidanceWindow.includes(candidate)) return candidate;
    }
    return guidanceSet[baseIndex];
  };

  if (metricGuidanceSet?.length) {
    const metricSignal = alignment.metrics?.[lowestMetricId]?.reason || alignment.misalignments?.[0] || alignment.rubricAlignmentFlags?.[0] || "metric";
    return pickNonRepeatingGuidance(metricGuidanceSet, `${turn.turnNumber}:${lowestMetricId}:${metricSignal}`);
  }

  const category = mapIssueCategory(alignment);
  const fallbackSet = FALLBACK_GUIDANCE_LIBRARY[category] || FALLBACK_GUIDANCE_LIBRARY.misalignment_relevance;
  const issueSignal = alignment.rubricAlignmentFlags?.[0] || alignment.misalignments?.[0] || alignment.positives?.[0] || "fallback";
  return pickNonRepeatingGuidance(fallbackSet, `${turn.turnNumber}:${category}:${issueSignal}`);
}

function extractMeaningfulFragment(text, fallbackLabel) {
  const value = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return fallbackLabel;
  return value.length > 110 ? `${value.slice(0, 107).trimEnd()}…` : value;
}

function composeContextAwareGuidance(turn, scenario = {}, baseGuidance = "") {
  const scenarioDescription = extractMeaningfulFragment(
    scenario?.description || scenario?.context,
    "the scenario description",
  );
  const openingScene = extractMeaningfulFragment(
    scenario?.opening_scene || scenario?.openingScene,
    "the opening scene",
  );
  const hcpLine = extractMeaningfulFragment(turn?.hcpDialogueBefore, "the latest HCP line");
  const repLine = extractMeaningfulFragment(turn?.repMessage, "your latest response");

  return `${baseGuidance} Context check: In this scenario (${scenarioDescription}) and opening scene (${openingScene}), tie your next line directly to HCP signal "${hcpLine}" and refine your prior point "${repLine}".`;
}

function buildContextAwareGuidance(turn, allTurns = [], scenario = {}) {
  const baseGuidance = buildRepGuidance(turn, allTurns);
  if (!baseGuidance) return null;

  const candidate = composeContextAwareGuidance(turn, scenario, baseGuidance);
  const recentGuidanceWindow = allTurns
    .filter((t) => t.turnNumber < turn.turnNumber && t.repMessage)
    .slice(-15)
    .map((t) => {
      const priorBase = buildRepGuidance(t, allTurns);
      if (!priorBase) return "";
      return composeContextAwareGuidance(t, scenario, priorBase);
    })
    .map((tip) => String(tip).trim())
    .filter(Boolean);

  if (!recentGuidanceWindow.includes(candidate)) return candidate;

  return `${candidate} Priority now: anchor to turn ${turn.turnNumber} specifics before advancing.`;
}


export default function RolePlayChat({ scenario, onClose, _onSessionSaved }) {
  const [turns, setTurns] = useState([]);
  // Only use unique opening scene from scenario, never fallback placeholder
  const openingScene = scenario.opening_scene || scenario.openingScene || null;
  const openingSceneNormalized = String(openingScene || "").toLowerCase().trim();
  const openingSceneSignature = openingSceneNormalized.split(/\s+/).filter(Boolean).slice(0, 8).join(" ");
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
  // Mutable simulation state — NOT in React state (no re-renders on change)
  const simStateRef = useRef({ temperature: 'neutral', severity: 0 });
  const sendInFlightRef = useRef(false);
  const activeRequestIdRef = useRef(0);
  const lastSubmittedTurnKeyRef = useRef("");
  const loggedTurnKeysRef = useRef(new Set());
  const processedTurnKeysRef = useRef(new Set());

  const {
    isListening, isSpeaking, interim, sttSupported, ttsSupported,
    toggleListening, stopListening, speak, stopSpeaking,
  } = useVoice({
    onTranscript: (text) => setInput((prev) => prev ? prev + " " + text : text),
    voiceSettings,
  });

  const objectiveText = scenario.objective || scenario.goal || "Guide this HCP interaction toward a clear, mutually agreed next step.";
  const descriptionText = scenario.description || scenario.context || "";
  const challengeItems = (Array.isArray(scenario.challenges)
    ? scenario.challenges
    : String(scenario.challenges || "")
      .split(/\n|;/)
  )
    .map((v) => String(v || "").replace(/^[-*\s]+/, "").trim())
    .filter(Boolean)
    .filter((item) => {
      const lower = item.toLowerCase();
      if (/^opening\s*scene\b/i.test(item)) return false;
      if (lower.includes("opening scene")) return false;
      if (openingSceneSignature && lower.includes(openingSceneSignature)) return false;
      return true;
    });
  const difficultyStyle = getDifficultyVisuals(scenario.difficulty).className;
  const scenarioKeywords = extractScenarioKeywords(scenario);

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
        setTurns([
          {
            turnNumber: 0,
            hcpStateBefore: initialState,
            temperatureBefore: initialTemp,
            severityBefore: 0,
            cueBefore: initialProfile.lockedCue,
            hcpDialogueBefore: null, // Rep speaks first, no HCP dialogue
            repMessage: null,
            alignment: null,
            hcpStateAfter: null,
          }
        ]);
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
  const sendMessage = async (rawInput = input) => {
    if (sendInFlightRef.current) return;

    // TURN ORDER RULE
    // Rep and HCP messages must alternate.
    // Rep → HCP → Rep → HCP
    // Multiple rep messages in a row are not allowed.
    const lastTurn = turns[turns.length - 1];
    const lastRenderedSpeakerIsRep = Boolean(lastTurn?.repMessage);
    const awaitingHcpResponse = lastTurn && !lastTurn.repMessage && Boolean(lastTurn.hcpDialogueBefore);
    const canSendOnOpeningTurn = lastTurn && lastTurn.turnNumber === 0 && !lastTurn.repMessage && !lastTurn.hcpDialogueBefore;
    if (lastRenderedSpeakerIsRep || (!awaitingHcpResponse && !canSendOnOpeningTurn)) {
      return;
    }

    const normalizedRawInput = String(rawInput || "").trim().toLowerCase();
    const candidateTurnKey = `${lastTurn?.turnNumber ?? -1}::${normalizedRawInput}`;
    if (candidateTurnKey && candidateTurnKey === lastSubmittedTurnKeyRef.current) {
      return;
    }

    // Declare all variables at the top
    let nextHcpDialogue = '';
    let contextualCue = '';
    // Only match explicit exit/scheduling phrases, not generic confirmations or product names
    const repExitIntent = /\b(emergency|have to go|need to leave|must leave|interrupt|gotta run|schedule conflict|time to go|wrap up|end early|exit|stop here|reschedule|continue later|catch up later|see you later|can we finish|can we continue|let's pick up|pick up later|follow up|another time|next time)\b/i;
    const repSchedulingIntent = /\b(come back|return|later today|this afternoon|at \d{1,2}(am|pm)?|scheduled|talk this afternoon|3pm|2pm|1pm|noon|morning|evening|night|next week|tomorrow|next time|another time|follow up|catch up)\b/i;
    let followUpTimeConfirmed = false;
    let exitOrSchedulingState = false;
    let exitStateActive = false;
    let schedulingConfirmed = false;
    // Check previous turns for exit/scheduling confirmation and rep exit
    for (let i = turns.length - 1; i >= 0; i--) {
      const t = turns[i];
      if ((t.repMessage && repSchedulingIntent.test(t.repMessage)) || (t.hcpDialogueBefore && repSchedulingIntent.test(t.hcpDialogueBefore))) {
        followUpTimeConfirmed = true;
        schedulingConfirmed = true;
        break;
      }
      if (t.repMessage && repExitIntent.test(t.repMessage)) {
        exitStateActive = true;
      }
    }
    if (repExitIntent.test(String(rawInput).trim()) || followUpTimeConfirmed) {
      exitOrSchedulingState = repExitIntent.test(String(rawInput).trim()) || followUpTimeConfirmed;
    }
    // If scheduling is confirmed, do not generate further HCP turns
    if (exitStateActive && schedulingConfirmed) {
      setIsLoading(false);
      return;
    }
    // In EXIT_OR_SCHEDULING: allowed dialogue patterns only
    if (exitOrSchedulingState) {
      // Only end session if rep explicitly signals exit intent
      if (repExitIntent.test(String(rawInput).trim())) {
        let nextHcpDialogue = 'Understood. We can continue speaking later. Schedule an appointment with Tisha in the front';
        let contextualCue = 'The HCP stands and checks their calendar, signaling the conversation is ending soon.';
        setTurns([...turns, {
          turnNumber: turns.length,
          hcpStateBefore: 'disengaging',
          temperatureBefore: 'neutral',
          severityBefore: 0,
          cueBefore: contextualCue,
          hcpDialogueBefore: nextHcpDialogue,
          repMessage: sanitizeUserMessage(rawInput),
          alignment: null,
          hcpStateAfter: null,
        }]);
        setIsLoading(false);
        return; // Ensure no further turn creation occurs
      }
    }
    if (!sanitizeUserMessage(rawInput) || isLoading) return;

    sendInFlightRef.current = true;
    const requestId = ++activeRequestIdRef.current;
    lastSubmittedTurnKeyRef.current = candidateTurnKey;
    try {
      const repMessage = sanitizeUserMessage(rawInput);
      setInput("");
      setIsLoading(true);

    // Stop mic if it's still listening when message is sent
    if (isListening) {
      stopListening();
    }

    // The turn the rep is responding to = last turn in the array (which has a hcpDialogueBefore but no repMessage yet)
    const respondingToTurn = turns[turns.length - 1];
    if (!respondingToTurn || respondingToTurn.repMessage) {
      setIsLoading(false);
      return;
    }
    const generationKey = `${respondingToTurn.turnNumber}::${repMessage.toLowerCase()}`;
    if (processedTurnKeysRef.current.has(generationKey)) {
      setIsLoading(false);
      return;
    }
    const prevState = respondingToTurn.hcpStateBefore;
    const prevTemp = respondingToTurn.temperatureBefore || simStateRef.current.temperature;
    const prevSev = respondingToTurn.severityBefore ?? simStateRef.current.severity;

    // 1. Score alignment against the locked state + temperature the rep SAW
    // Score BEFORE any temperature escalation from disagreement
    const prevHcpState = turns.length >= 2 ? turns[turns.length - 2].hcpStateBefore : null;
    const repLower = String(repMessage || "").toLowerCase();
    const priorRepTurnsCount = turns.filter((t) => !!t.repMessage).length;
    const greetingSignals = /\b(hi|hello|hey|good morning|good afternoon|good evening|how are you|how's it going|hows it going|how was your weekend|nice to meet you|good to see you|thanks for your time)\b/;
    const businessSignals = /\b(prep|hiv|sti|cab|cabotegravir|injectable|screening|resistance|adherence|study|trial|data|results|efficacy|durability|monitoring|protocol|materials?|brochure|resource|patients?)\b/;
    const isPleasantryOnly = greetingSignals.test(repLower) && !businessSignals.test(repLower);
    const inPleasantryGracePeriod = isPleasantryOnly && priorRepTurnsCount < 2;

    let alignment = computeAlignment(prevState, repMessage, null, prevTemp, prevHcpState);
    if (inPleasantryGracePeriod) {
      const normalizedMetrics = Object.fromEntries(
        Object.entries(alignment?.metrics || {}).map(([cap, val]) => [
          cap,
          { ...val, score: 3, reason: "Pleasantry grace period (opening social exchange)." },
        ])
      );

      alignment = {
        ...alignment,
        score: 3,
        positives: [],
        misalignments: [],
        rubricAlignmentFlags: [],
        metrics: normalizedMetrics,
      };
    }

    // 2. Detect rep interruption/leave intent and override HCP state if needed
    let overrideExit = false;
    const leaveIntent = /\b(emergency|have to go|need to leave|must leave|interrupt|gotta run|schedule conflict|time to go|wrap up|end early|exit|stop here|reschedule|continue later|catch up later|see you later|can we finish|can we continue|let's pick up|pick up later|follow up|another time|next time)\b/i;
    if (leaveIntent.test(repMessage)) {
      overrideExit = true;
    }

    // 3. Transition structural state and base temperature (deterministic)
    let nextHcpState = transitionState(prevState, repMessage, prevTemp);
    let nextTemp = transitionTemperature(prevTemp, repMessage);
    let nextSev = transitionSeverity(prevSev, alignment, prevState, nextHcpState);

    // 4. Override HCP state for schedule_exit/closure if rep signals leave/interruption
    if (overrideExit) {
      nextHcpState = 'disengaging';
      nextTemp = 'neutral';
      nextSev = 0;
    }

    // 5. APPLY HCP DISAGREEMENT ESCALATION TO NEXT TEMPERATURE
    // Escalate temperature for the NEXT turn, not for current alignment scoring
    if (respondingToTurn.hcpDisagreed && !overrideExit) {
      const escalatedIndex = escalateForDisagreement(
        TEMPERATURES.indexOf(nextTemp),
        respondingToTurn.disagreementInfo
      );
      const clampedIndex = Math.max(0, Math.min(escalatedIndex, TEMPERATURES.length - 1));
      nextTemp = TEMPERATURES[clampedIndex];
      // This escalation is only for the next turn, not for current scoring
    }

    simStateRef.current = { temperature: nextTemp, severity: nextSev };

    // 3. Update turn-level engagement and state
    const prevEngagementScore = respondingToTurn.engagementScore ?? 2;
    const conversationHistory = turns.map(t => ({ repMessage: t.repMessage, hcpDialogue: t.hcpDialogueBefore }));
    const turnState = updateTurnState(prevState, repMessage, prevEngagementScore, conversationHistory);

    // 3. Lock rep's response
    const lockedRespondingTurn = {
      ...respondingToTurn,
      repMessage,
      alignment,
      hcpStateAfter: nextHcpState,
      temperatureAfter: nextTemp,
      engagementScore: turnState.engagementScore,
      engagementLevel: turnState.engagementLevel,
      emotionalValence: turnState.emotionalValence,
      stance: turnState.stance,
      reactionTrigger: turnState.reactionTrigger,
      conversationalMomentum: turnState.conversationalMomentum,
      timePressure: turnState.timePressure,
      generationKey,
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
    const priorRepTurns = turns.filter((t) => !!t.repMessage).length;
    const priorHcpDialogueTurns = turns.filter((t) => !!t.hcpDialogueBefore).length;
    const isFirstHcpResponse = (
      respondingToTurn.turnNumber === 0
      && !respondingToTurn.hcpDialogueBefore
      && priorRepTurns === 0
      && priorHcpDialogueTurns === 0
    );

    const scenarioContext = `${String(scenario.opening_scene || scenario.openingScene || "")} ${String(scenario.description || scenario.context || "")}`.trim();
    const scenarioLower = scenarioContext.toLowerCase();
    const scenarioPressured = /\b(busy|behind|limited time|short on time|time pressure|running late|short-staffed|paperwork|drowning|prior auth|authorization|workflow friction|backlog)\b/.test(scenarioLower);
    const scenarioPrepFocus = /\bprep|hiv|sti\b/.test(scenarioLower);
    const scenarioCabFocus = /\bcab|cabotegravir|injectable|long-acting\b/.test(scenarioLower);
    const scenarioScreeningFocus = /\bscreening|resistance|adherence|candidacy|criteria\b/.test(scenarioLower);
    const scenarioMonitoringFocus = /\bmonitoring|follow-up|durability|protocol|renal|labs?\b/.test(scenarioLower);

    const buildFirstTurnScenarioFallback = () => {
      const warmGreeting = inPleasantryGracePeriod
        ? "I'm doing well, thanks for asking."
        : "Thanks for checking in.";

      if (scenarioPrepFocus && scenarioPressured) {
        return `${warmGreeting} I've been catching up on patient charts and prior authorizations, so I only have a couple minutes. What brings you in today?`;
      }

      if (scenarioCabFocus && scenarioScreeningFocus) {
        return `${warmGreeting} I've been reviewing candidacy and screening questions for long-acting cabotegravir, and I only have a couple minutes. What brings you in today?`;
      }

      if (scenarioMonitoringFocus) {
        return `${warmGreeting} I've been tightening our follow-up and monitoring workflow, and I only have a couple minutes. What brings you in today?`;
      }

      if (scenarioPressured) {
        return `${warmGreeting} I'm between patients and paperwork right now, so I only have a couple minutes. What brings you in today?`;
      }

      return scenarioPrepFocus
        ? `${warmGreeting} I can give you a few focused minutes before my next patient. What brings you in today regarding PrEP access for my patients?`
        : `${warmGreeting} I can give you a few focused minutes before my next patient. What brings you in today?`;
    };

    const buildFollowUpScenarioFallback = () => {
      const repLower = String(repMessage || "").toLowerCase();
      const mentionsStudy = /\b(study|trial|data|results|evidence|jama|publication|published|findings|methodology|duration)\b/.test(repLower);
      const mentionsMaterials = /\b(material|materials|brochure|handout|leave-behind|leave behind|resource|resources|printout|one-pager|flyer)\b/.test(repLower);

      if (mentionsStudy) {
        return "I'd like to know more about the study's methodology. What was the duration of the study?";
      }

      if (mentionsMaterials && scenarioPrepFocus) {
        return "Are the materials you'll be leaving going to help my patients understand how to gain access to PrEP without jumping through so many hoops?";
      }

      if (scenarioCabFocus && scenarioScreeningFocus) {
        return "Before we move forward, what practical steps would you recommend so we can confirm candidacy and screening requirements for long-acting cabotegravir?";
      }

      if (scenarioMonitoringFocus) {
        return "What is the most practical monitoring plan we can apply consistently without overloading the clinic team?";
      }

      const repTopicTokens = repLower
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w && !new Set(["the", "and", "for", "with", "that", "this", "your", "have", "from", "what", "about", "today", "patient", "patients"]).has(w))
        .slice(0, 5);
      const repTopic = repTopicTokens.join(" ");

      if (scenarioPrepFocus) {
        return repTopic
          ? `You mentioned ${repTopic}. Since my patients are the priority and access remains a challenge, what is the most practical recommendation you can provide to improve access to PrEP today?`
          : "Since my patients are the priority, and access to treatment is a challenge, what is the most practical recommendation you can provide to improve access to PrEP today?";
      }

      return repTopic
        ? `You mentioned ${repTopic}. Since my patients are the priority, what is the most practical recommendation you can provide for my workflow today?`
        : "Since my patients are the priority, what is the most practical recommendation you can provide for my workflow today?";
    };

    const buildNonRepeatingScenarioFallback = (previousDialogue = "") => {
      const base = buildFollowUpScenarioFallback();
      const prevNorm = String(previousDialogue || "").trim().toLowerCase();
      const baseNorm = String(base || "").trim().toLowerCase();
      if (!prevNorm || prevNorm !== baseNorm) return base;

      const repLower = String(repMessage || "").toLowerCase();
      const repTopicTokens = repLower
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w && !new Set(["the", "and", "for", "with", "that", "this", "your", "have", "from", "what", "about", "today"]).has(w))
        .slice(0, 4);
      const repTopic = repTopicTokens.join(" ") || "that point";

      if (scenarioCabFocus && scenarioScreeningFocus) {
        return `On ${repTopic}, help me understand the exact candidacy and resistance checks we can apply consistently this week.`;
      }

      if (scenarioPrepFocus) {
        return `On ${repTopic}, given our access bottlenecks and limited staff time, what single practical step should we start with today for PrEP patients?`;
      }

      if (scenarioMonitoringFocus) {
        return `On ${repTopic}, what is the simplest monitoring and follow-up step we can implement without adding extra burden?`;
      }

      return `On ${repTopic}, what is the most practical next step we can apply in clinic today without disrupting workflow?`;
    };

    const buildScenarioAlignedCue = (dialogue, isFirstTurn) => {
      const value = String(dialogue || "").toLowerCase();
      if (isFirstTurn && scenarioPrepFocus && scenarioPressured) {
        return "The HCP glances at a stack of prior-authorization forms, then looks up with a polite but rushed expression.";
      }
      if (isFirstTurn && scenarioCabFocus && scenarioScreeningFocus) {
        return "The HCP reviews a chart note and screening checklist, then looks up with a focused, slightly uncertain expression.";
      }
      if (isFirstTurn && scenarioMonitoringFocus) {
        return "The HCP taps a follow-up list on the desk, then turns back with a practical, time-aware expression.";
      }
      if (/methodology|duration|study/.test(value)) {
        return "The HCP leans forward, scanning the details with focused interest while keeping an eye on the clock.";
      }
      if (/materials|jumping through so many hoops|access to prep|access/.test(value)) {
        return "The HCP sets paperwork aside briefly, concern visible as they focus on practical patient access barriers.";
      }
      if (/candidacy|screening|resistance|cabotegravir|long-acting/.test(value)) {
        return "The HCP scans the screening checklist, then pauses, focused on whether this approach is safe and practical for the right patients.";
      }
      return scenarioPressured
        ? "The HCP keeps one hand on pending paperwork, attentive but clearly pressed for time."
        : "The HCP listens attentively, maintaining steady eye contact while waiting for a practical answer.";
    };

    nextHcpDialogue = "";

    try {
      const systemPrompt = buildHCPDialoguePrompt({
        scenario,
        hcpProfile: nextProfile,
        historyText,
        isOpening: isFirstHcpResponse,
      });
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: systemPrompt,
          max_tokens: 220,
          temperature: 0,
          roleplay: true,
        })
      });
      if (res.ok) {
        const data = await res.json();
        const raw = (data.response || data.text || data.content || '');
        const rawStr = typeof raw === 'string' ? raw : String(raw);
        nextHcpDialogue = rawStr.trim().split('\n')[0];

        if (
          import.meta.env.DEV
          && rawStr.includes("?")
          && !nextHcpDialogue.includes("?")
        ) {
          console.warn("PUNCTUATION_INTEGRITY_VIOLATION", { source: "hcp-message-processing" });
        }

        nextHcpDialogue = hardenTextSurface(normalizeHcpDialoguePunctuation(nextHcpDialogue).trim());

        if (
          import.meta.env.DEV
          && rawStr.includes("?")
          && !nextHcpDialogue.includes("?")
        ) {
          console.warn("PUNCTUATION_INTEGRITY_VIOLATION", { source: "hcp-message-normalization" });
        }
      } else {
        nextHcpDialogue = isFirstHcpResponse
          ? buildFirstTurnScenarioFallback()
          : buildFollowUpScenarioFallback();
      }
    } catch (err) {
      console.error('HCP dialogue generation error:', err);
      nextHcpDialogue = isFirstHcpResponse
        ? buildFirstTurnScenarioFallback()
        : buildFollowUpScenarioFallback();
    }

    const previousHcpDialogue = String(
      respondingToTurn?.hcpDialogueBefore
      || [...prevTurns]
        .reverse()
        .find((t) => t.hcpDialogueBefore)?.hcpDialogueBefore
      || ""
    );

    const groundedFallback = isFirstHcpResponse
      ? buildFirstTurnScenarioFallback()
      : buildNonRepeatingScenarioFallback(previousHcpDialogue);
    if (!isScenarioGroundedDialogue(nextHcpDialogue, scenarioKeywords, repMessage) && String(nextHcpDialogue || "").split(/\s+/).length < 6) {
      nextHcpDialogue = hardenTextSurface(groundedFallback);
    }

    if (!isFirstHcpResponse) {
      const nextNorm = String(nextHcpDialogue || "").trim().toLowerCase();
      const prevNorm = String(previousHcpDialogue || "").trim().toLowerCase();
      if (nextNorm && prevNorm && nextNorm === prevNorm) {
        nextHcpDialogue = hardenTextSurface(buildNonRepeatingScenarioFallback(previousHcpDialogue));
      }
    }

    nextHcpDialogue = hardenTextSurface(nextHcpDialogue);

    // 6.5 DETECT HCP DISAGREEMENT & RECORD FOR NEXT TURN
    // If the HCP disagreed with the rep's suggestion, flag this for the NEXT turn's temperature escalation
    const disagreementInfo = detectHcpDisagreement(nextHcpDialogue);
    if (disagreementInfo.disagrees) {
      console.log(`HCP Disagreement Detected in Turn ${turns.length} | Strong: ${disagreementInfo.strongDisagree} | Mild: ${disagreementInfo.mildDisagree}`);
    }

    // 6.6 GENERATE CONTEXTUAL CUE — MATCHES DIALOGUE + QUESTION QUALITY
    // After dialogue is generated, create a contextual cue that matches what the HCP said
    // and responds to the quality of the rep's question (pushy, redundant, etc.)
    // Always match cue to the same state/context as the generated HCP dialogue
    // Alignment check: ensure cues, emotional state, dialogue, and context are logically consistent
    contextualCue = undefined;
    if (overrideExit) {
      // Constrain HCP behavior: closure only, no questions or escalation
      nextHcpDialogue = 'I understand. We can continue speaking later. Schedule an appointment with Tisha in the front.';
      contextualCue = 'The HCP stands and checks their calendar, signaling the conversation is ending soon.';
    } else {
      // Derive cue from the exact same grounded inputs as dialogue (scenario + rep message + generated response)
      contextualCue = buildScenarioAlignedCue(nextHcpDialogue, isFirstHcpResponse);

      const recentCues = prevTurns
        .map((t) => String(t.cueBefore || "").trim().toLowerCase())
        .filter(Boolean)
        .slice(-2);
      const normalizedCue = String(contextualCue || "").trim().toLowerCase();
      if (normalizedCue && recentCues.length === 2 && recentCues.every((cue) => cue === normalizedCue)) {
        contextualCue = nextProfile.lockedCue;
      }
    }

    contextualCue = hardenTextSurface(contextualCue);

    // 7. Coaching overlay — driven by alignment rubric flags
    const coachingResult = shouldTriggerCoaching(alignment, prevState, nextHcpState);
    if (coachingResult.shouldShow) setCoachingTip(coachingResult);

    // 8. Lock next turn with contextual cue (matches dialogue + question quality)
    // Use contextual cue instead of base profile cue to ensure body language matches what HCP said
    const nextTurn = {
      turnNumber: nextTurnNumber,
      hcpStateBefore: nextHcpState,
      temperatureBefore: nextTemp,
      severityBefore: nextSev,
      cueBefore: contextualCue,
      hcpDialogueBefore: nextHcpDialogue,
      repMessage: null,
      alignment: null,
      hcpStateAfter: null,
      hcpDisagreed: disagreementInfo.disagrees,
      disagreementInfo: disagreementInfo,
      engagementScore: turnState.engagementScore,
      engagementLevel: turnState.engagementLevel,
      emotionalValence: turnState.emotionalValence,
      stance: turnState.stance,
      reactionTrigger: turnState.reactionTrigger,
      conversationalMomentum: turnState.conversationalMomentum,
      timePressure: turnState.timePressure,
      generationKey,
    };

    if (requestId !== activeRequestIdRef.current) {
      return;
    }

    // Prevent duplicate HCP turns: only add one HCP turn after rep input
    setTurns((prevTurnsState) => {
      const currentRespondingTurn = prevTurnsState[prevTurnsState.length - 1];
      if (!currentRespondingTurn) return prevTurnsState;
      if (currentRespondingTurn.turnNumber !== respondingToTurn.turnNumber) return prevTurnsState;
      if (currentRespondingTurn.repMessage) return prevTurnsState;

      const replaced = [...prevTurnsState.slice(0, prevTurnsState.length - 1), lockedRespondingTurn];
      const hasNextTurnAlready = prevTurnsState.some(
        (t) => (
          t.turnNumber === nextTurn.turnNumber
          && !t.repMessage
          && t.hcpDialogueBefore
        ) || (t.generationKey && t.generationKey === generationKey)
      );
      if (hasNextTurnAlready) {
        return replaced;
      }
      processedTurnKeysRef.current.add(generationKey);

      const turnAuditKey = `${nextTurn.turnNumber}::${repMessage}`;
      if (!loggedTurnKeysRef.current.has(turnAuditKey)) {
        loggedTurnKeysRef.current.add(turnAuditKey);
        logAuditEvent('turn_created', {
          turnNumber: nextTurnNumber,
          hcpState: nextHcpState,
          cue: contextualCue,
          dialogue: nextHcpDialogue,
          repMessage,
          alignment,
          feedback: coachingResult,
        });
      }

      return [...replaced, nextTurn];
    });

      setIsLoading(false);
      if (requestId === activeRequestIdRef.current) {
        speak(nextHcpDialogue);
      }

      // Auto-focus input after HCP responds
      setTimeout(() => inputRef.current?.focus(), 100);
    } finally {
      sendInFlightRef.current = false;
    }
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

  const displayTurns = turns.filter((turn, index) => {
    if (index === 0) return true;
    const prev = turns[index - 1];
    const bothHcpOnly = !turn.repMessage && !prev.repMessage;
    if (!bothHcpOnly) return true;

    const sameDialogue = String(turn.hcpDialogueBefore || "").trim() === String(prev.hcpDialogueBefore || "").trim();
    const sameCue = String(turn.cueBefore || "").trim() === String(prev.cueBefore || "").trim();
    return !(sameDialogue && sameCue);
  });

  const displayItems = displayTurns.flatMap((turn, index) => {
    const items = [];

    if (turn.hcpDialogueBefore) {
      items.push({ kind: 'hcp', key: `hcp-${turn.turnNumber}-${index}`, turn });
    }

    if (turn.repMessage) {
      items.push({ kind: 'rep', key: `rep-${turn.turnNumber}-${index}`, turn });
    }

    return items;
  });

  const repTurnsCount = turns.filter((t) => t.repMessage).length;
  // Keep live metrics calculations running for end-session scoring, but hide panel from rep view.
  const showLiveMetricsPanel = false;

  const exportFeedbackPDF = () => {
    if (!feedback) return;
    const content = `SESSION FEEDBACK - ${scenario.title}\nDate: ${new Date().toLocaleDateString()}\n\n${feedback}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-feedback-${scenario.title.replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openCoachingOnSession = () => {
    const allMisalignments = [...new Set(turns.flatMap(t => t.alignment?.misalignments || []))];
    const allPositives = [...new Set(turns.flatMap(t => t.alignment?.positives || []))];
    const latestScoredTurn = [...turns].reverse().find((t) => t.alignment?.metrics);
    const capabilityScores = Object.fromEntries(
      Object.entries(latestScoredTurn?.alignment?.metrics || {}).map(([cap, val]) => [cap, val.score])
    );
    const overallScore = latestScoredTurn?.alignment?.score ?? null;

    const sessionContext = encodeURIComponent(JSON.stringify({
      scenarioTitle: scenario.title,
      hcpCategory: scenario.hcp_category,
      specialty: scenario.specialty,
      misalignments: allMisalignments,
      positives: allPositives,
      capabilityScores,
      overallScore,
      source: "roleplay_end_feedback",
    }));

    window.location.assign(createPageUrl("AICoach") + `?session_context=${sessionContext}`);
  };

  // ─── END SESSION ──────────────────────────────────────────────────────────────
  const endSession = async () => {
    setIsEnding(true);
    try {
      // Build conversation transcript
      const historyText = flattenTurns(turns)
        .map((m) => `${m.role === "user" ? "Sales Rep" : "HCP"}: ${m.content}`)
        .join("\n");

      const scoredTurns = turns.filter(t => t.alignment?.metrics);
      const latestScoredTurn = scoredTurns.length > 0 ? scoredTurns[scoredTurns.length - 1] : null;
      const capSummary = Object.entries(latestScoredTurn?.alignment?.metrics || {})
        .map(([cap, metric]) => {
          const subLine = Object.entries(metric.subScores || {})
            .map(([s, score]) => `  ↳ ${s.replace(/_/g, ' ')}: ${score}`)
            .join('\n');
          return `• ${cap.replace(/_/g, ' ')}${subLine ? '\n' + subLine : ''}`;
        })
        .join('\n');

      // Collect all rubric alignment flags (Signal–Response Alignment derived checks)
      const allRubricFlags = [...new Set(scoredTurns.flatMap(t => t.alignment?.rubricAlignmentFlags || []))];
      const allMisalignments = [...new Set(scoredTurns.flatMap(t => t.alignment?.misalignments || []))];
      const allPositives = [...new Set(scoredTurns.flatMap(t => t.alignment?.positives || []))];

      const rubricSection = allRubricFlags.length > 0
        ? `\nSIGNAL–RESPONSE ALIGNMENT ISSUES (canonical feedback language — use these verbatim or closely paraphrase):\n${allRubricFlags.map(f => `• ${f}`).join('\n')}`
        : '';

      const structuredPrompt = `You are a skilled sales coach analyzing a roleplay simulation session. Ground ALL feedback in observable behavior only — never infer intent, emotion, or personality traits.\n${FEEDBACK_SOT}\n\nSESSION SCORING DATA (deterministic, turn-by-turn):\nDeterministic session alignment summary (non-numeric): use only the qualitative findings below\n${capSummary}\n\nPOSITIVES OBSERVED (turn-by-turn):\n${allPositives.length > 0 ? allPositives.slice(0, 10).map(p => `• ${p}`).join('\n') : '• None detected'}\nMISALIGNMENTS OBSERVED (turn-by-turn):\n${allMisalignments.length > 0 ? allMisalignments.slice(0, 10).map(m => `• ${m}`).join('\n') : '• None detected'}\n${rubricSection}\n\nSession Context:\nScenario: ${scenario.title}\nHCP Type: ${scenario.hcp_category}\nDifficulty: ${scenario.difficulty}\n\nConversation Transcript:\n${historyText}\n\nRespond with PLAIN TEXT (no markdown, no special formatting). Provide exactly 4 sections separated by the exact delimiter "[SECTION_END]":\nSECTION 1: STRENGTHS (observable behaviors showing strong capability performance)\n[SECTION_END]\nSECTION 2: IMPROVEMENTS (specific capability gaps and areas to develop)\n[SECTION_END]\nSECTION 3: PATTERNS (notable signal-response alignment patterns and behaviors)\n[SECTION_END]\nSECTION 4: ACTION ITEMS (2-3 specific behavioral changes for next session)\n[SECTION_END]\nCRITICAL RULES:\n- Do NOT include numeric scores\n- Each section is plain text (no markdown, no bullet points in the response text)\n- Separate sections with EXACTLY "[SECTION_END]"\n- All feedback must be observable and specific`;
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: structuredPrompt,
          max_tokens: 900,
          temperature: 0.2,
        })
      });

      if (res.ok) {
        const data = await res.json();
        const rawContent = (data.response || data.text || data.content || '').trim();

        console.log('=== RAW FEEDBACK CONTENT ===');
        console.log(rawContent.substring(0, 300));

        // Strategy 1: Try delimiter-based parsing
        let sections = rawContent.split('[SECTION_END]').map(s => s.trim()).filter(Boolean);

        // If delimiter parsing didn't work well, try regex-based extraction
        if (sections.length < 4 || sections.some(s => s.length < 20)) {
          console.log('Delimiter parsing failed, trying regex approach...');

          // Try to extract by section headers/keywords
          const strengthsMatch = rawContent.match(/(?:STRENGTHS?|Done Well|Strong|Positive)[:\s]*\n+([\s\S]*?)(?=(?:IMPROVE|Develop|Weakness|Gap|SECTION)|$)/i);
          const improvementsMatch = rawContent.match(/(?:IMPROVE|Develop|Focus|Weakness|Gap)[:\s]*\n+([\s\S]*?)(?=(?:PATTERN|Align|SECTION|ACTION)|$)/i);
          const patternsMatch = rawContent.match(/(?:PATTERN|Align|Signal|Response)[:\s]*\n+([\s\S]*?)(?=(?:ACTION|SECTION|$))/i);
          const actionsMatch = rawContent.match(/(?:ACTION|Item|Behavioral Change|Next)[:\s]*\n+([\s\S]*?)$/i);

          sections = [
            strengthsMatch?.[1] || '',
            improvementsMatch?.[1] || '',
            patternsMatch?.[1] || '',
            actionsMatch?.[1] || ''
          ];
          console.log('Regex extraction produced', sections.length, 'sections');
        }

        // Fallback: if still not enough content, split by double newlines and distribute
        if (sections.length < 4 || sections.every(s => !s || s.length < 15)) {
          console.log('Regex also failed, using raw content directly');
          sections = [rawContent, '', '', ''];
        }

        // Extract and clean section content
        const strengthsText = (sections[0] || '')
          .replace(/^SECTION\s+1:\s+STRENGTHS\s*\n?/i, '')
          .replace(/^STRENGTHS?\s*[:—]*\s*\n?/i, '')
          .trim() || 'The HCP demonstrated solid engagement and appropriate questioning throughout the conversation.';

        const improvementsText = (sections[1] || '')
          .replace(/^SECTION\s+2:\s+IMPROVEMENTS\s*\n?/i, '')
          .replace(/^IMPROVE[A-Z]*\s*[:—]*\s*\n?/i, '')
          .trim() || 'Continue developing the ability to connect signals to specific clinical or practice outcomes.';

        const patternsText = (sections[2] || '')
          .replace(/^SECTION\s+3:\s+PATTERNS\s*\n?/i, '')
          .replace(/^PATTERN[A-Z]*\s*[:—]*\s*\n?/i, '')
          .trim() || 'The HCP showed responsive engagement, adapting questions based on the sales rep\'s input.';

        const actionText = (sections[3] || '')
          .replace(/^SECTION\s+4:\s+ACTION\s+ITEMS\s*\n?/i, '')
          .replace(/^ACTION[A-Z]*\s*[:—]*\s*\n?/i, '')
          .trim() || 'Focus on: (1) Deeper exploration of the HCP\'s current workflow, (2) Connecting study findings to practice impact, (3) Addressing objections with research-backed evidence.';

        // Reconstruct with proper markdown format
        const coachingFeedback = `## 2) Capabilities Done Well

${strengthsText}

## 3) Capabilities to Develop

${improvementsText}

## 4) Signal–Response Alignment

${patternsText}

## 5) Specific Action Items

${actionText}`;

        const fullFeedback = coachingFeedback;
        console.log('=== FEEDBACK PARSING COMPLETE ===');
        console.log('Strengths length:', strengthsText.length);
        console.log('Improvements length:', improvementsText.length);
        console.log('Patterns length:', patternsText.length);
        console.log('Actions length:', actionText.length);
        setFeedback(fullFeedback);
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
  // Consolidated flow: Sections 2–5 now render inside the End & Get Feedback tab below
  // CapabilityFeedbackPanel, instead of opening a separate modal overlay.

  const flatMessages = flattenTurns(turns);

  const renderTabPills = (containerClassName = "") => (
    <div className={`flex gap-1 px-2 py-2 flex-shrink-0 bg-transparent overflow-x-auto justify-center ${containerClassName}`}>
      {([
        { id: "chat", label: "Live Chat", icon: MessageSquare },
        { id: "annotate", label: "Annotated Transcript", icon: Highlighter, disabled: repTurnsCount < 1 },
        { id: "capabilities", label: "End & Get Feedback", icon: Zap, disabled: repTurnsCount < 1 },
      ]).map(({ id, label, icon: Icon, disabled }) => (
        <button
          key={id}
          disabled={disabled}
          onClick={() => {
            setActiveTab(id);
            if (id === "capabilities" && repTurnsCount >= 2 && !feedback && !isEnding) {
              endSession();
            }
          }}
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
  );

  // ─── CHAT VIEW ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col lg:flex-row overflow-hidden" style={{ background: "#f0f4f8" }}>
      {/* Left: Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0 bg-white border-r border-gray-200">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-3 md:px-5 py-2 border-b flex-shrink-0 bg-white">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-slate-900 text-[18px] md:text-[21px] leading-snug">{scenario.title}</h2>
              <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold capitalize ${difficultyStyle}`}>{scenario.difficulty}</span>
              {/* State label removed as requested */}
            </div>
            <p className="text-xs text-slate-700 mt-0.5">{scenario.hcp_category} · {scenario.specialty}</p>
          </div>

          <div className="flex items-center gap-2 ml-1 flex-shrink-0">
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-gray-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Persona strip */}
        {/* Persona strip removed as requested */}


        {/* Scenario context summary */}
        {(descriptionText || openingScene || objectiveText || challengeItems.length > 0) && (
          <div className="px-3 md:px-4 pt-2 pb-2 border-b bg-gradient-to-b from-slate-100 via-slate-50 to-white">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-start">
              {(descriptionText || openingScene) && (
                <div className="lg:col-span-8 rounded-2xl border border-slate-300 bg-white p-2.5 shadow-sm">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-600 mb-2">Session Brief</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {descriptionText && (
                      <div className="rounded-xl border border-amber-400 bg-gradient-to-br from-amber-100 to-orange-50 px-3 py-2.5 shadow-sm min-w-0 min-h-[74px]">
                        <p className="font-bold uppercase text-[#1A334D] text-[11px] tracking-wide mb-1">Scenario Description</p>
                        <p className="text-xs text-amber-900 leading-relaxed italic whitespace-normal">{descriptionText}</p>
                      </div>
                    )}
                    <div className="rounded-xl border border-amber-400 bg-gradient-to-br from-amber-100 to-orange-50 px-3 py-2.5 shadow-sm min-w-0 min-h-[74px]">
                      <p className="font-bold uppercase text-[#1A334D] text-[11px] tracking-wide mb-1">Opening Scene</p>
                      {openingScene ? (
                        <p className="text-xs text-amber-900 leading-relaxed italic whitespace-normal">{openingScene}</p>
                      ) : (
                        <p className="text-xs text-red-600 leading-relaxed italic">No opening scene provided for this scenario.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="lg:col-span-4">
                <div className="mb-1.5 rounded-xl border border-slate-200 bg-white/90">
                  {renderTabPills("py-1")}
                </div>
                <div className="rounded-2xl border-2 border-teal-400 bg-gradient-to-br from-teal-100 via-cyan-50 to-white shadow-md px-4 py-3">
                <div className="flex items-start gap-3">
                  <ListChecks className="w-5 h-5 text-teal-700 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-teal-800">Scenario Support</p>
                    <p className="text-sm text-slate-800 leading-relaxed mt-1"><span className="font-bold text-[#1A334D]">Objective:</span> {objectiveText}</p>
                  </div>
                </div>
                {challengeItems.length > 0 && (
                  <div className="mt-2 rounded-xl border border-teal-200 bg-white px-3 py-2 shadow-sm">
                    <p className="text-xs font-bold text-[#1A334D]">Key Challenges</p>
                    <ul className="list-disc pl-4 text-xs text-slate-700 space-y-1 mt-1">
                      {challengeItems.slice(0, 3).map((challenge, idx) => (
                        <li key={idx}>{challenge}</li>
                      ))}
                    </ul>
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!(descriptionText || openingScene || objectiveText || challengeItems.length > 0) && (
          <div className="px-3 md:px-4 py-1 border-b bg-white flex-shrink-0">
            <div className="rounded-xl border border-slate-200 bg-white min-h-[42px] flex items-center">
              {renderTabPills()}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">

          {/* CHAT TAB */}
          {activeTab === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto px-3 md:px-5 py-4 flex flex-col gap-4">

                {turns.length === 0 && isLoading && (
                  <div className="flex justify-center py-8">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "0.1s" }} />
                      <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "0.2s" }} />
                    </div>
                  </div>
                )}


                {/*
                  DISPLAY NORMALIZATION LAYER

                  Messages may be normalized for grammar
                  and punctuation before rendering.

                  This does NOT modify the underlying
                  conversation history or scoring inputs.
                */}
                {/*
                  DISPLAY TONE NORMALIZATION

                  Tone adjustments improve realism of dialogue.

                  These transformations occur ONLY during UI rendering
                  and do not affect scoring or stored conversation data.
                */}
                {/*
                  CHAT LAYOUT STRUCTURE RULE

                  Do not modify message container hierarchy.

                  User bubble
                  → alignment badge
                  → next message

                  All layout must use flex stacking.

                  Avoid absolute positioning.
                */}
                {displayItems.map((item) => {
                  const { turn } = item;
                  const openingTurnGuidance = buildOpeningTurnGuidance(turn, scenario);

                  if (item.kind === "rep") {
                    return (
                      <div key={item.key} className="ml-auto w-full max-w-[96%] lg:max-w-[98%] flex flex-col items-end gap-1">
                        <div className="flex items-start justify-end w-full gap-2">
                          <div className="w-fit max-w-[min(100%,calc(100%-3rem))] rounded-2xl px-4 py-2.5 text-sm leading-relaxed font-medium" style={{ background: "#39ACAC", color: "white" }}>
                            {sanitizeRenderedMessage(turn.repMessage, "user-message")}
                          </div>
                          <div className="w-8 h-8 rounded-full bg-[#1A334D] text-white flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 mt-1">REP</div>
                        </div>
                        {turn.alignment && (
                          <>
                            <div className={`w-full px-2 py-1 rounded-lg text-xs border ${turn.alignment.score >= 4 ? 'bg-teal-50 text-teal-700 border-teal-200' :
                              turn.alignment.score <= 2 ? 'bg-red-50 text-red-700 border-red-200' :
                                'bg-slate-50 text-slate-600 border-slate-200'
                              }`}>
                              <div className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap">{buildContextAwareGuidance(turn, turns, scenario)}</div>
                            </div>
                            {turn.alignment.rubricAlignmentFlags?.length > 0 && (
                              <div className="w-full break-words whitespace-normal px-2.5 py-1 rounded-lg text-xs bg-amber-50 border border-amber-200 text-amber-700 italic">
                                {turn.alignment.rubricAlignmentFlags[0]}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div key={item.key} className="flex flex-col items-start gap-1">
                      {turn.cueBefore && (
                        <div className="pl-1 w-fit max-w-[90%] md:max-w-[80%]">
                          <p className="w-fit max-w-full text-xs italic leading-snug px-3 py-1.5 rounded-lg border whitespace-normal break-words" style={{ color: '#7B1F1F', borderColor: '#7B1F1F', background: '#F9F5F5' }}>
                            {sanitizeRenderedMessage(turn.cueBefore, "behavioral-cue")}
                          </p>
                        </div>
                      )}
                      {turn.hcpDialogueBefore && (
                        <div className="flex items-start w-full">
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold mr-2 flex-shrink-0 mt-1">HCP</div>
                          <div className="w-fit max-w-[min(100%,calc(100%-2.75rem))] rounded-2xl px-3 md:px-4 py-2.5 text-sm leading-relaxed bg-slate-200/90 text-slate-800 whitespace-normal break-words">
                            {sanitizeRenderedMessage(turn.hcpDialogueBefore, "hcp-message")}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

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
              <div className="px-3 md:px-5 py-3 border-t flex-shrink-0 bg-white pb-[max(12px,env(safe-area-inset-bottom))]">
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (isLoading || isEnding) return;
                    const message = sanitizeUserMessage(input);
                    if (!message) return;
                    sendMessage(input);
                  }}
                  className="flex gap-2 items-center"
                >
                  <div className="relative flex-1">
                    <Input
                      ref={inputRef}
                      value={input}
                      onChange={e => {
                        setInput(e.target.value);
                        if (isListening && e.target.value.length > input.length) {
                          stopListening();
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          // Single submit path: let <form onSubmit> handle send to avoid duplicate turn creation.
                          e.preventDefault();
                          e.currentTarget.form?.requestSubmit();
                        }
                      }}
                        placeholder={isListening ? "Listening…" : "Your response as the sales rep (REP)..."}
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
                  <Button type="submit" disabled={isLoading || isEnding || (!sanitizeUserMessage(input) && !interim)} style={{ background: "#39ACAC" }} className="hover:opacity-90 text-white px-4 py-2 rounded">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
                {isListening && interim && (
                  <p className="text-xs text-red-500 mt-1 italic">🎙 "{interim}"</p>
                )}
                <p className="text-xs text-slate-400 mt-1 italic">
                  Signal–Response Alignment evaluates observable behavioral adaptation to HCP signals — not empathy, intent, or personality.
                </p>
              </div>
            </>
          )}

          {activeTab === "annotate" && (
            <AnnotatedTranscript messages={flatMessages} scenario={scenario} />
          )}

          {activeTab === "capabilities" && (
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 pt-4 pb-2">
                <button
                  onClick={endSession}
                  disabled={isEnding || repTurnsCount < 2}
                  className="inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all duration-200 text-xs px-3 py-1.5 border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isEnding ? "Generating feedback…" : feedback ? "Regenerate Sections 2-5" : "Generate Sections 2-5"}
                </button>
              </div>
              {/* Section 1: Embed CapabilityFeedbackPanel at the top of End & Get Feedback pill */}
              <div className="mb-6">
                <CapabilityFeedbackPanel messages={flatMessages} turns={turns} scenario={scenario} />
              </div>
              {/* Sections 2-5: Render feedback markdown below CapabilityFeedbackPanel */}
              {isEnding && (
                <div className="mx-4 mb-4 rounded-lg border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-800">
                  Generating final evaluation sections…
                </div>
              )}
              {feedback && (
                <div className="mx-4 mb-8 mt-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <ReactMarkdown
                    components={{
                      h2: ({ children, ...props }) => <h2 className="text-xl font-bold text-slate-900 mt-7 mb-3 first:mt-0" {...props}>{children}</h2>,
                      h3: (props) => <h3 className="text-base font-semibold text-slate-800 mt-4 mb-2" {...props} />,
                      h4: (props) => <h4 className="text-sm font-semibold text-slate-700 mt-3 mb-1" {...props} />,
                      p: (props) => <p className="mb-4 leading-7 text-slate-700" {...props} />,
                      ul: (props) => <ul className="list-disc list-inside mb-4 space-y-2 ml-1" {...props} />,
                      ol: (props) => <ol className="list-decimal list-inside mb-4 space-y-2 ml-1" {...props} />,
                      li: (props) => <li className="mb-0" {...props} />,
                      strong: (props) => <strong className="font-semibold text-slate-900" {...props} />,
                      em: (props) => <em className="italic text-slate-600" {...props} />,
                      blockquote: (props) => <blockquote className="border-l-4 border-slate-300 pl-4 italic text-slate-600 my-3" {...props} />,
                    }}
                  >{feedback}</ReactMarkdown>
                  <div className="mt-6 border-t border-slate-200 pt-4 flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportFeedbackPDF}
                      className="text-xs border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    >
                      Export to PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs border-teal-600 bg-teal-600 text-white hover:bg-teal-700 hover:border-teal-700"
                      onClick={openCoachingOnSession}
                    >
                      <Bot className="w-3.5 h-3.5 mr-1" />
                      Get Coaching on Session
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Keep metrics component mounted (for parity/diagnostics), but hidden from rep UI to prevent score-gaming. */}
      {showLiveMetricsPanel ? (
        <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0" style={{ background: "#1A334D" }}>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Behavioral Metrics</h3>
            <p className="text-xs mt-0.5" style={{ color: "#39ACAC" }}>Turn-by-turn Signal Intelligence scoring</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <LiveMetricsPanel turns={turns} scenario={scenario} />
          </div>
        </div>
      ) : (
        <div className="hidden" aria-hidden="true">
          <LiveMetricsPanel turns={turns} scenario={scenario} />
        </div>
      )}
    </div>
  );
}

// Audit logging utility
function logAuditEvent(eventType, details) {
  // Example: send to backend or local storage
  // window.fetch('/api/audit/log', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ eventType, details, timestamp: Date.now() })
  // });
  // For demo, log to console
  console.log(`[AUDIT] ${eventType}`, details);
}
