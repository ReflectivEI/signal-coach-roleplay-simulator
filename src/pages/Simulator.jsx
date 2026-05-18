import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "@/components/layout/AppHeader";
import { computeVolatilityEvents } from "@/lib/simulatorEngine";
import { generateHcpResponse } from "@/lib/hcpResponseGenerator";
import { generateSessionReview } from "@/lib/sessionReview";
import { initializeConversation } from "@/lib/conversationInit";
import { generateOpeningScene } from "@/lib/openingSceneEngine";
import MessageList from "@/components/simulator/MessageList";
import MessageInput from "@/components/simulator/MessageInput";
import SimulatorRightPanel from "@/components/simulator/SimulatorRightPanel";
import SessionSummaryModal from "@/components/simulator/SessionSummaryModal";
import { motion } from "framer-motion";
import { Square, ChevronDown, PanelRightClose, PanelRightOpen, BrainCircuit } from "lucide-react";
import { BEHAVIOR_STATE_LABELS, JOURNEY_STATE_LABELS, PRESSURE_LABELS } from "@/lib/signalIntelligence";
import { computeHcpStateHistory } from "@/lib/hcpStateEngine";
import { predictHcpBehavior } from "@/lib/hcpBehaviorPrediction";
import { getScenarioById, listAllScenarios } from "@/lib/scenarioStorage";
import { generateRealtimeFeedback, createWorkerSession } from "@/services/workerClient";
import { resolveObservedCue } from "@/lib/hcpCueGenerator";
import { buildPredictiveSeedFromScenario } from "@/lib/predictiveSeedResolver";
import { buildPredictivePromptContext, buildPredictiveRuntimeLens } from "@/lib/predictiveRuntimeService";
import { requireRealismContract } from "@/lib/scenarioInputResolver";
import { evaluateAdaptiveResponse, generatePredictiveHcpResponse } from "@/features/rps/api";
import { toast } from "@/components/ui/use-toast";

function createSafeId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createLocalSession(scData, convInit) {
  const initialRealism = requireRealismContract(scData?.runtimeTemperature, "scenario.runtimeTemperature");
  return {
    id: createSafeId(),
    scenarioId: scData.id,
    scenarioTitle: scData.title,
    currentJourneyState: scData.journeyState,
    currentBehaviorState: convInit.initialBehaviorState,
    turnCount: 0,
    realism: initialRealism,
    temperature: initialRealism,
    predictiveProfile: null,
    hcpPersona: null,
    hcpState: {
      resistance: 5,
      skepticism: 5,
      openness: 5,
      emotion: "guarded",
      behaviorState: convInit.initialBehaviorState,
      concernFamily: "",
      realism: initialRealism,
      temperature: initialRealism,
      temperaturePersonaTraits: temperatureTraits(initialRealism),
      updatedAt: new Date().toISOString(),
    },
    sessionMemory: [],
    previousInteraction: "",
    interactionHistory: [],
    lastConcernFamily: "",
    escalationLevel: 0,
    coachingNudgesEnabled: true,
    isComplete: false,
  };
}

function buildPredictiveProfileFromRuntime(runtimeLens, scenario) {
  const selection = runtimeLens?.selection;
  const type = String(selection?.behaviorArchetype || scenario?.persona || "").trim();
  if (!type) return null;
  return {
    type,
    source: runtimeLens?.synthesisSource || "deterministic",
    specialistTitle: runtimeLens?.specialistTitle || scenario?.stakeholder || "Clinical Specialist",
  };
}

function buildSimulatorPredictiveHcpPayload({
  repText = "",
  scenario = {},
  session = {},
  predictiveRuntimeData = null,
  predictiveContext = "",
  temperature = 5,
  turns = [],
  voiceMetadata = null,
}) {
  const selection = predictiveRuntimeData?.selection || scenario?.predictiveSeed || {};
  const lastHcpTurn = getLastHcpTurn(turns);
  const currentHcpState = session?.hcpState || {};
  const hcpState = {
    ...currentHcpState,
    hcp_position: currentHcpState?.hcp_position || session?.currentBehaviorState || scenario?.startingBehaviorState || "neutral",
    conversation_stage: currentHcpState?.conversation_stage || session?.currentJourneyState || scenario?.journeyState || "",
    current_primary_barrier: currentHcpState?.current_primary_barrier || session?.lastConcernFamily || "",
    last_hcp_response_text: lastHcpTurn?.text || currentHcpState?.last_hcp_response_text || "",
    hcp_response_history: turns
      .filter((turn) => turn?.speaker === "hcp")
      .map((turn) => String(turn?.text || "").trim())
      .filter(Boolean)
      .slice(-8),
  };

  return {
    scenario_id: scenario?.id,
    scenario_context: {
      ...scenario,
      currentBehaviorState: session?.currentBehaviorState,
      currentJourneyState: session?.currentJourneyState,
      predictiveProfile: session?.predictiveProfile,
      predictiveLens: predictiveRuntimeData || null,
      predictive_hcp_brain_context: predictiveContext,
      hcp_state: hcpState,
      cue_signal: hcpState.current_primary_barrier || scenario?.challengeContext || scenario?.objective || "",
    },
    rep_response_transcript: repText,
    voice_metadata: voiceMetadata || null,
    selected_dropdowns: {
      disease_state: selection.diseaseState || scenario?.disease_state || "",
      specialty_hcp_type: selection.specialtyHcpType || selection.hcpType || scenario?.specialty_hcp_type || scenario?.specialty || "",
      hcp_type: selection.hcpType || scenario?.persona || scenario?.stakeholder || "",
      journey_stage: selection.journeyStage || session?.currentJourneyState || scenario?.journeyStage || "",
      interaction_pressure: selection.interactionPressure || (scenario?.interactionPressure || []).join(", "),
      influence_driver: selection.influenceDriver || scenario?.influenceDriver || "",
      behavior_archetype: selection.behaviorArchetype || session?.predictiveProfile?.type || scenario?.persona || "",
      realism: temperature,
    },
    rep_selected_temperature: temperature,
    live_temperature: temperature,
    initial_temperature: temperature,
    hcp_state: hcpState,
    conversation_memory: {
      hcp_state: hcpState,
      interaction_history: session?.interactionHistory || [],
      session_memory: session?.sessionMemory || [],
      hcp_brain_context: predictiveContext,
    },
  };
}

function normalizeShadowText(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function getLastHcpTurn(turns = []) {
  return [...turns].reverse().find((turn) => turn.speaker === "hcp") || null;
}

function cleanConcernFamily(value = "") {
  return String(value || "current concern").replace(/_/g, " ").trim().toLowerCase();
}

function buildConcernSpecificRepMove({ concern = "", lastHcpTurn = null, pressure = "", repApproach = "" } = {}) {
  const normalizedConcern = cleanConcernFamily(concern || pressure);
  const lastQuestion = normalizeShadowText(lastHcpTurn?.text || "");
  const answerFirst = lastQuestion.includes("?")
    ? "Answer the HCP's question first"
    : "Start with the HCP's current concern";

  if (/workflow|operational|staff|burden|admin|prior auth|access/.test(normalizedConcern)) {
    return `${answerFirst}: name the office step that changes, then ask whether that is the workflow burden they want solved.`;
  }

  if (/screening|patient|fit|selection|adherence|therapy|drop/.test(normalizedConcern)) {
    return `${answerFirst}: identify the patient group affected, then ask what patient-fit threshold would make this worth continuing.`;
  }

  if (/evidence|data|clinical|outcome|safety|efficacy|trial/.test(normalizedConcern)) {
    return `${answerFirst}: give one outcome or evidence point in plain clinical language, then ask if that addresses their decision standard.`;
  }

  if (/cost|coverage|access|formulary|authorization/.test(normalizedConcern)) {
    return `${answerFirst}: connect the point to access friction, then ask what barrier most often stops the patient from moving forward.`;
  }

  if (repApproach && !/recommended rep strategy/i.test(repApproach)) {
    return repApproach;
  }

  return `${answerFirst}: reflect the concern in one sentence, answer it directly, then ask one narrow follow-up.`;
}

function buildCoachShadowMode({
  draftText = "",
  hcpPrediction = null,
  predictiveLensData = null,
  session = null,
  scenario = null,
  lastSignals = {},
  activeCues = [],
  lastHcpTurn = null,
  afterAction = null,
} = {}) {
  const draft = normalizeShadowText(draftText);
  const lowerDraft = draft.toLowerCase();
  const sections = predictiveLensData?.lens?.sections || {};
  const pressure = String(scenario?.interactionPressure?.[0] || predictiveLensData?.selection?.interactionPressure || "").replace(/_/g, " ");
  const concern = String(hcpPrediction?.concernFamily || lastSignals?.concern_family || pressure || "current concern").replace(/_/g, " ");
  const hcpState = hcpPrediction?.predictedBehaviorState || session?.currentBehaviorState || scenario?.startingBehaviorState || "neutral";
  const cue = activeCues?.[0]?.label || activeCues?.[0]?.text || "";
  const profileMove = buildConcernSpecificRepMove({
    concern,
    lastHcpTurn,
    pressure,
    repApproach: sections.repApproach?.headline || sections.repApproach?.repMoves?.[0] || "",
  });

  const isPitch = /\b(study|data|efficacy|product|treatment|dose|trial|new)\b/i.test(draft);
  const isAcknowledging = /\b(hear|understand|sounds like|you'?re looking|workflow|burden|staff|time|practical|concern|before)\b/i.test(draft);
  const isQuestion = /\?|\bwhat\b|\bhow\b|\bwhich\b|\bwhere\b|\bwhen\b|\bcould\b|\bcan\b/i.test(draft);
  const isVague = draft.length > 0 && draft.split(/\s+/).length < 5;

  let likelyReaction = "HCP likely stays neutral until the rep connects to the current concern.";
  let bestMove = profileMove;
  let risk = "Risk: the rep may answer with content before confirming what the HCP is actually testing.";

  if (!draft) {
    likelyReaction = lastHcpTurn?.text
      ? "HCP is waiting to see whether the next rep move addresses the last concern."
      : "HCP is forming an early relevance judgment from the opening move.";
  } else if (isVague) {
    likelyReaction = "HCP likely asks for a more specific reason this matters.";
    bestMove = `${profileMove} Keep it to one sentence before asking the follow-up.`;
    risk = "Risk: a vague opener makes the HCP tighten the time gate.";
  } else if (isPitch && !isAcknowledging) {
    likelyReaction = "If you pitch now, HCP likely closes down or redirects to the practical barrier.";
    bestMove = `Acknowledge the ${cleanConcernFamily(concern)} concern before adding content; then give one specific point tied to it.`;
    risk = `Risk: rep is about to answer product interest instead of the ${concern} concern.`;
  } else if (isAcknowledging && isQuestion) {
    likelyReaction = "If you acknowledge the burden first, openness likely improves.";
    bestMove = "Ask a narrowing question that lets this HCP define the decision threshold, then stay with that answer.";
    risk = "Risk is lower if the rep keeps the question concise and tied to the HCP's context.";
  } else if (isQuestion) {
    likelyReaction = "HCP likely gives a more useful constraint if the question is specific enough.";
    bestMove = profileMove;
    risk = "Risk: a broad question may keep the conversation generic.";
  } else if (isAcknowledging) {
    likelyReaction = "HCP likely stays engaged if the next sentence makes the practical payoff clear.";
    bestMove = `${profileMove} Do not add a second topic yet.`;
    risk = "Risk: acknowledgement without a next move can stall momentum.";
  }

  return {
    isReady: Boolean(predictiveLensData || hcpPrediction || session || scenario),
    draft,
    avatarState: hcpPrediction?.riskLevel === "high" ? "watch" : hcpState === "openness" ? "clear" : "thinking",
    likelyReaction,
    bestMove,
    risk,
    cue,
    hcpWasTesting: sections.objections?.headline || sections.mindset?.headline || hcpPrediction?.nextLikelyBehavior || "Whether the rep can make the next move relevant and practical.",
    afterAction,
  };
}

function compareCoachShadowPrediction(shadow, response) {
  if (!shadow || !response) return null;
  const actualPrediction = response.prediction || {};
  const actualState = response.nextBehaviorState || actualPrediction.predictedBehaviorState || "unknown";
  const actualRisk = actualPrediction.riskLevel || "unknown";
  const expectedCloseDown = /closes down|tighten|risk/i.test(shadow.likelyReaction || shadow.risk || "");
  const improved = ["curiosity", "openness", "neutral"].includes(String(actualState).toLowerCase())
    && actualRisk !== "high";
  const matched = expectedCloseDown
    ? ["resistance", "frustration", "closed", "time_pressure"].includes(String(actualState).toLowerCase()) || actualRisk === "high"
    : improved;

  return {
    label: matched ? "Prediction tracked" : "Prediction updated",
    detail: matched
      ? `The HCP response followed the shadow read: ${String(actualState).replace(/_/g, " ")} with ${actualRisk} risk.`
      : `The HCP moved differently than expected: ${String(actualState).replace(/_/g, " ")} with ${actualRisk} risk.`,
    actualMove: response.hcpReply || "",
  };
}

function getTemperatureBandLabel(value) {
  const temperature = Number(value);
  if (!Number.isFinite(temperature)) return "unknown";
  if (temperature <= 3) return "low";
  if (temperature <= 7) return "medium";
  return "high";
}

function logReviewError(stage, error, extras = {}) {
  const message = error instanceof Error ? error.message : String(error || "unknown_error");
  console.error("[Simulator] review_error", {
    stage,
    message,
    stack: error instanceof Error ? error.stack : undefined,
    ...extras,
  });
}

function temperatureTraits(temperature) {
  const temp = Math.max(1, Math.min(10, Number(temperature) || 5));
  if (temp <= 4) {
    return {
      challengeStyle: "collaborative",
      patience: 8,
      directness: 4,
      interruptionLikelihood: 2,
    };
  }
  if (temp <= 7) {
    return {
      challengeStyle: "proof-seeking",
      patience: 6,
      directness: 6,
      interruptionLikelihood: 4,
    };
  }
  return {
    challengeStyle: "challenging",
    patience: 3,
    directness: 8,
    interruptionLikelihood: 8,
  };
}

function analyzeVoiceDelivery(metadata = null) {
  if (!metadata) return null;
  const wpm = Number(metadata.words_per_minute || 0);
  const fillerRate = Number(metadata.filler_word_rate || 0);
  const pauses = Number(metadata.pause_count || 0);
  const duration = Number(metadata.response_duration_seconds || 0);
  const issues = [];
  const strengths = [];

  if (wpm > 175) issues.push("Pace may feel rushed.");
  else if (wpm > 0 && wpm < 95) issues.push("Pace may feel overly slow.");
  else if (wpm > 0) strengths.push("Pace stayed in a conversational range.");

  if (fillerRate >= 0.08) issues.push("Filler words may weaken confidence.");
  else if (metadata.filler_word_count > 0) strengths.push("Filler use stayed low.");

  if (pauses >= 3) strengths.push("Used pauses to create space.");
  else if (duration >= 12) issues.push("Few pauses detected for a longer response.");

  const label = issues.length ? "Needs calibration" : strengths.length ? "Steady delivery" : "Captured";
  return {
    label,
    metadata,
    issues,
    strengths,
    coaching: issues[0] || strengths[0] || "Delivery metadata captured for this turn.",
  };
}

function deriveHcpStateSnapshot({
  priorState,
  behaviorState,
  prediction,
  behaviorSignals,
  temperature,
}) {
  const prior = priorState || {
    resistance: 5,
    skepticism: 5,
    openness: 5,
    emotion: "guarded",
  };

  const nextBehavior = String(behaviorState || "neutral").toLowerCase();
  const risk = String(prediction?.riskLevel || "").toLowerCase();
  const alignment = String(behaviorSignals?.response_alignment || "weak").toLowerCase();
  const listening = String(behaviorSignals?.listening_pattern || "missed").toLowerCase();
  const concernFamily = String(prediction?.concernFamily || "").toLowerCase();
  const traits = temperatureTraits(temperature);

  const ignoredOrDismissed = alignment === "weak" || listening === "missed";
  const matchedConcern = ["strong", "partial"].includes(alignment);

  const resistanceBump =
    (ignoredOrDismissed ? 2 : 0) +
    (["resistance", "closed", "frustration", "time_pressure"].includes(nextBehavior) ? 1 : 0) +
    (risk === "high" ? 1 : 0) +
    (traits.challengeStyle === "challenging" ? 1 : 0);
  const resistanceDrop = matchedConcern ? 1 : 0;

  const skepticismBump =
    (traits.challengeStyle === "challenging" ? 2 : traits.challengeStyle === "proof-seeking" ? 1 : 0) +
    (concernFamily === "evidence" || concernFamily === "patient_fit" ? 1 : 0) +
    (ignoredOrDismissed ? 1 : 0);
  const skepticismDrop = matchedConcern ? 1 : 0;

  const opennessDrop = ignoredOrDismissed ? 2 : 0;
  const opennessBump =
    (matchedConcern ? 1 : 0) +
    (traits.challengeStyle === "collaborative" ? 2 : 0) +
    (nextBehavior === "open" ? 1 : 0);

  const resistance = Math.max(1, Math.min(10, Number(prior.resistance || 5) + resistanceBump - resistanceDrop));
  const skepticism = Math.max(1, Math.min(10, Number(prior.skepticism || 5) + skepticismBump - skepticismDrop));
  const openness = Math.max(1, Math.min(10, Number(prior.openness || 5) + opennessBump - opennessDrop));

  const emotion = resistance >= 8
    ? "frustrated"
    : skepticism >= 7
      ? "skeptical"
      : openness >= 7
        ? "engaged"
        : "guarded";

  return {
    resistance,
    skepticism,
    openness,
    emotion,
    behaviorState: nextBehavior,
    concernFamily,
    temperature,
    temperaturePersonaTraits: traits,
    updatedAt: new Date().toISOString(),
  };
}

export default function Simulator() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const scenarioId = urlParams.get("scenarioId");
  const realismOverrideRaw = urlParams.get("realism") ?? urlParams.get("runtimeTemperature");
  const realismOverride = Number(realismOverrideRaw);
  const hasRealismOverride = Number.isInteger(realismOverride) && realismOverride >= 1 && realismOverride <= 10;

  const [scenario, setScenario] = useState(null);
  const [session, setSession] = useState(null);
  const [turns, setTurns] = useState([]);
  const [activeCues, setActiveCues] = useState([]);
  const [lastSignals, setLastSignals] = useState({});
  const [lastNudge, setLastNudge] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [review, setReview] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showMobileRail, setShowMobileRail] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [allSignals, setAllSignals] = useState([]);
  const [latestVoiceAnalysis, setLatestVoiceAnalysis] = useState(null);
  const [voiceEvaluation, setVoiceEvaluation] = useState(null);
  const [isVoiceEvaluating, setIsVoiceEvaluating] = useState(false);
  const [repDraftForAnalysis, setRepDraftForAnalysis] = useState({ text: "", inputMode: "typed", voiceMetadata: null });
  const [recommendedResponseDraft, setRecommendedResponseDraft] = useState(null);
  const [coachShadowAfterAction, setCoachShadowAfterAction] = useState(null);
  const [highlightedTurnId, setHighlightedTurnId] = useState("");
  const [hcpPrediction, setHcpPrediction] = useState(null);
  const [volatilityState, setVolatilityState] = useState(null);
  const [currentVolatilityProfile, setCurrentVolatilityProfile] = useState(/** @type {"stable" | "slightly_disrupted" | "disrupted"} */("stable"));
  const [repTurnIds, setRepTurnIds] = useState([]);
  const [conversationInit, setConversationInit] = useState(null);
  const [hasRepSpoken, setHasRepSpoken] = useState(false);
  const [realtimeFeedback, setRealtimeFeedback] = useState(null);
  const [reviewStage, setReviewStage] = useState("");
  const regenerateToastRef = useRef(null);
  const [lastRuntimeError, setLastRuntimeError] = useState("");
  const [predictiveLens, setPredictiveLens] = useState({ isLoading: false, data: null });
  const predictiveLensRef = useRef({ isLoading: false, data: null });
  const predictiveLensReadyPromiseRef = useRef(Promise.resolve(null));
  const pendingCoachShadowRef = useRef(null);
  const coachingEnabled = true;

  const setPredictiveLensState = useCallback((nextLens) => {
    predictiveLensRef.current = nextLens;
    setPredictiveLens(nextLens);
  }, []);

  useEffect(() => {
    if (scenarioId) void initSession();
    else navigate("/");
  }, [navigate, scenarioId, realismOverrideRaw]);

  const initSession = async () => {
    setIsInitializing(true);
    try {
      const allScenarios = await listAllScenarios();
      let scData = await getScenarioById(scenarioId) || allScenarios[0];

      if (!scData) {
        navigate("/");
        return;
      }

      if (!scData.visualScene) {
        scData = {
          ...scData,
          visualScene: generateOpeningScene({
            title: scData.title,
            journeyStage: scData.journeyStage || "initial_access",
            startingBehaviorState: scData.startingBehaviorState || "neutral",
            decisionOrientation: scData.decisionOrientation,
            interactionPressure: scData.interactionPressure || [],
          }),
        };
      }
      const resolvedSeed = buildPredictiveSeedFromScenario(scData);
      const scenarioWithSeed = {
        ...scData,
        runtimeTemperature: hasRealismOverride ? realismOverride : scData.runtimeTemperature,
        predictiveSeed: {
          ...resolvedSeed,
          ...(scData.predictiveSeed || {}),
        },
      };
      setScenario(scenarioWithSeed);
      setPredictiveLensState({ isLoading: true, data: null });

      const runtimeLensPromise = buildPredictiveRuntimeLens({
        selection: scenarioWithSeed.predictiveSeed,
        scenarioTitle: scenarioWithSeed.title,
      });
      predictiveLensReadyPromiseRef.current = runtimeLensPromise;

      void runtimeLensPromise.then((runtimeData) => {
        const predictiveProfile = buildPredictiveProfileFromRuntime(runtimeData, scenarioWithSeed);
        setPredictiveLensState({ isLoading: false, data: runtimeData });
        setSession((current) => current ? { ...current, predictiveProfile, hcpPersona: predictiveProfile } : current);
      }).catch(() => {
        setPredictiveLensState({ isLoading: false, data: null });
        setSession((current) => current ? { ...current, predictiveProfile: null, hcpPersona: null } : current);
      });

      const convInit = await initializeConversation(scenarioWithSeed);
      setConversationInit(convInit);

      let newSession;
      try {
        newSession = createLocalSession(scenarioWithSeed, convInit);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Missing temperature";
        setLastRuntimeError(message);
        toast({
          title: "Simulator initialization failed",
          description: message,
          variant: "destructive",
        });
        return;
      }
      setSession(newSession);

      setTurns([]);
      setHasRepSpoken(false);
      setCoachShadowAfterAction(null);

      const initCues = [];
      const openingCue = resolveObservedCue("", {
        hcpReply: scenarioWithSeed.openingScene || scenarioWithSeed.visualScene || scenarioWithSeed.description || "",
        behaviorState: scenarioWithSeed.startingBehaviorState || "neutral",
        interactionPressures: scenarioWithSeed.interactionPressure || [],
        scenario: scenarioWithSeed,
      });
      initCues.push({ id: "cue_init_1", ...openingCue });
      setActiveCues(initCues);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to initialize scenario";
      setLastRuntimeError(message);
      toast({
        title: "Simulator initialization failed",
        description: message,
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setIsInitializing(false);
    }
  };

  const handleEvaluateRep = useCallback(async (repText, inputMeta = {}) => {
    if (!session || !scenario || isVoiceEvaluating) return;
    const trimmed = String(repText || "").trim();
    if (!trimmed) return;

    let temperature;
    try {
      temperature = requireRealismContract(session?.realism, "session.realism");
    } catch {
      toast({
        title: "Evaluation unavailable",
        description: "Missing session realism setting.",
        variant: "destructive",
      });
      return;
    }

    const voiceAnalysis = analyzeVoiceDelivery(inputMeta?.voiceMetadata || null);
    setLatestVoiceAnalysis(voiceAnalysis);
    setIsVoiceEvaluating(true);
    setVoiceEvaluation((current) => current ? { ...current, isLoading: true } : { isLoading: true });

    try {
      const selection = predictiveLensRef.current?.data?.selection || {};
      const result = await evaluateAdaptiveResponse({
        scenario_id: scenario.id,
        scenario_context: {
          ...scenario,
          currentBehaviorState: session.currentBehaviorState,
          currentJourneyState: session.currentJourneyState,
          predictiveProfile: session.predictiveProfile,
          predictiveLens: predictiveLensRef.current?.data || null,
        },
        rep_response_transcript: trimmed,
        voice_metadata: inputMeta?.voiceMetadata || null,
        selected_dropdowns: {
          hcpType: selection.hcpType || scenario.persona || scenario.stakeholder || "",
          stage: selection.stage || selection.conversationStage || scenario.journeyState || "",
          challenge: selection.challenge || selection.challengeContext || scenario.challengeContext || "",
          realism: temperature,
        },
        rep_selected_temperature: temperature,
        live_temperature: temperature,
        initial_temperature: temperature,
        hcp_state: session.hcpState || null,
        conversation_memory: {
          hcp_state: session.hcpState || null,
          interaction_history: session.interactionHistory || [],
          session_memory: session.sessionMemory || [],
        },
      });
      setVoiceEvaluation({
        isLoading: false,
        transcript: trimmed,
        inputMode: inputMeta?.inputMode || "typed",
        voiceMetadata: inputMeta?.voiceMetadata || null,
        voiceAnalysis,
        result,
        evaluatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to evaluate rep response.";
      setVoiceEvaluation({
        isLoading: false,
        transcript: trimmed,
        inputMode: inputMeta?.inputMode || "typed",
        voiceMetadata: inputMeta?.voiceMetadata || null,
        voiceAnalysis,
        error: message,
        evaluatedAt: new Date().toISOString(),
      });
      toast({
        title: "Rep evaluation failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsVoiceEvaluating(false);
    }
  }, [session, scenario, isVoiceEvaluating, toast]);

  const handleRepDraftChange = useCallback((draft) => {
    setRepDraftForAnalysis({
      text: draft?.text || "",
      inputMode: draft?.inputMode || "typed",
      voiceMetadata: draft?.voiceMetadata || null,
    });
    if (draft?.text) {
      setCoachShadowAfterAction(null);
    }
  }, []);

  const handleVoiceAnalysisRequest = useCallback(() => {
    handleEvaluateRep(repDraftForAnalysis.text, {
      inputMode: repDraftForAnalysis.inputMode,
      voiceMetadata: repDraftForAnalysis.voiceMetadata,
    });
  }, [handleEvaluateRep, repDraftForAnalysis]);

  const handleUseRecommendedResponse = useCallback((text) => {
    const response = String(text || "").trim();
    if (!response) return;
    setRecommendedResponseDraft({ id: createSafeId(), text: response });
    setCoachShadowAfterAction(null);
    toast({
      title: "Recommended response loaded",
      description: "The safest compliant response is ready in the rep input.",
    });
  }, [toast]);

  const handleCriticalVoiceEvent = useCallback((event, guidance) => {
    if (!event || !guidance) return;
    setRealtimeFeedback({
      repTurnId: "voice-" + event.id,
      guidance,
      timestamp: new Date(),
      source: "voice_telemetry",
      eventType: event.type,
    });
    if (event.severity === "critical") {
      toast({
        title: "Critical voice telemetry event",
        description: event.coachingRecommendation,
      });
    }
  }, [toast]);

  const handleJumpToTurn = useCallback((turnId) => {
    if (!turnId) return;
    setShowSummary(false);
    setHighlightedTurnId(turnId);
    window.setTimeout(() => setHighlightedTurnId(""), 3200);
  }, []);

  const handleRepMessage = useCallback(async (repText, inputMeta = {}) => {
    if (!session || !scenario || isLoading) return;
    setIsLoading(true);
    setLastNudge(null);
    setLastRuntimeError("");

    const isFirstRepTurn = !hasRepSpoken;
    if (isFirstRepTurn && predictiveLensRef.current.isLoading) {
      await predictiveLensReadyPromiseRef.current.catch(() => null);
    }

    const predictiveRuntimeData = predictiveLensRef.current.data;
    const predictiveProfile = session?.predictiveProfile || buildPredictiveProfileFromRuntime(predictiveRuntimeData, scenario);
    if (!predictiveProfile) {
      const message = "Error: HCP context not initialized";
      setLastRuntimeError(message);
      toast({
        title: "HCP context missing",
        description: message,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    let temperature;
    try {
      temperature = requireRealismContract(session?.realism, "session.realism");
    } catch {
      const message = "Missing temperature";
      setLastRuntimeError(message);
      toast({
        title: "Temperature missing",
        description: message,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    console.log("predictive_profile_attached", {
      hasProfile: !!predictiveProfile,
      personaType: predictiveProfile?.type,
    });

    console.log("temperature_applied", {
      value: temperature,
      band: temperature <= 3 ? "low" : temperature <= 7 ? "medium" : "high",
    });

    pendingCoachShadowRef.current = buildCoachShadowMode({
      draftText: repText,
      hcpPrediction,
      predictiveLensData: predictiveRuntimeData,
      session,
      scenario,
      lastSignals,
      activeCues,
      lastHcpTurn: getLastHcpTurn(turns),
    });

    setHasRepSpoken(true);

    const voiceAnalysis = analyzeVoiceDelivery(inputMeta?.voiceMetadata || null);
    setLatestVoiceAnalysis(voiceAnalysis);

    const repTurnObj = {
      id: createSafeId(),
      speaker: "rep",
      text: repText,
      timestamp: new Date().toISOString(),
      cues: [],
      nudge: null,
      inputMode: inputMeta?.inputMode || "typed",
      voiceMetadata: inputMeta?.voiceMetadata || null,
      voiceAnalysis,
    };
    setTurns((prev) => [...prev, repTurnObj]);

    if (coachingEnabled) {
      try {
        const lastHcpTurn = [...turns].reverse().find((turn) => turn.speaker === "hcp");
        const guidance = await generateRealtimeFeedback({
          repResponse: repText,
          hcpLastReply: lastHcpTurn?.text || "",
          hcpCue: activeCues?.[0]?.label || "",
          hcpBehavior: session?.currentBehaviorState,
          journeyState: session?.currentJourneyState,
          prediction: hcpPrediction ? {
            predictedBehaviorState: hcpPrediction.predictedBehaviorState,
            concernFamily: hcpPrediction.concernFamily,
            riskLevel: hcpPrediction.riskLevel,
            nextLikelyBehavior: hcpPrediction.nextLikelyBehavior,
          } : null,
          scenario,
        });
        setRealtimeFeedback({
          repTurnId: repTurnObj.id,
          guidance,
          timestamp: new Date(),
        });
      } catch (err) {
        console.log("Feedback generation skipped:", err.message);
      }
    }

    const conversationHistory = [...turns, repTurnObj].map((t) => ({
      id: t.id,
      speaker: t.speaker,
      text: t.text,
      timestamp: t.timestamp,
      cues: t.cues || [],
    }));

    try {
      const scenarioWithTemperature = {
        ...scenario,
        runtimeTemperature: temperature,
      };

      const predictiveContext = buildPredictivePromptContext(predictiveRuntimeData);
      if (!predictiveContext.trim()) {
        throw new Error("Error: HCP context not initialized");
      }

      let authoritativePredictiveRoute = null;
      try {
        const predictiveRouteResult = await generatePredictiveHcpResponse(buildSimulatorPredictiveHcpPayload({
          repText,
          scenario: scenarioWithTemperature,
          session: {
            ...session,
            predictiveProfile,
            hcpPersona: session?.hcpPersona || predictiveProfile,
          },
          predictiveRuntimeData,
          predictiveContext,
          temperature,
          turns,
          voiceMetadata: inputMeta?.voiceMetadata || null,
        }));
        const predictiveLine = String(predictiveRouteResult?.simulated_hcp_next_response || "").trim();
        const predictiveSource = String(predictiveRouteResult?.predictive_hcp_response_source || "").trim();
        if (!predictiveLine || predictiveSource !== "predictive_builder_test_hcp_response") {
          throw new Error("Predictive Builder HCP voice route did not return an authoritative HCP line.");
        }
        authoritativePredictiveRoute = {
          line: predictiveLine,
          source: predictiveSource,
          responseType: predictiveRouteResult?.hcp_response_type || null,
          stateDelta: predictiveRouteResult?.hcp_state_delta || null,
          hcpState: predictiveRouteResult?.hcp_state || null,
          intentBucket: predictiveRouteResult?.intent_bucket || null,
          antiLoopTriggered: Boolean(predictiveRouteResult?.anti_loop_intervention_triggered),
          semanticSimilarityMax: predictiveRouteResult?.semantic_similarity_max ?? null,
        };
      } catch (predictiveRouteError) {
        console.warn("SIMULATOR_PREDICTIVE_HCP_ROUTE_FAILED", predictiveRouteError);
        throw new Error("Predictive Brain HCP route failed; deterministic HCP fallback authoring is disabled.");
      }

      const response = await generateHcpResponse(
        scenarioWithTemperature,
        conversationHistory,
        session.currentBehaviorState,
        session.currentJourneyState,
        coachingEnabled,
        repText,
        allSignals,
        session.turnCount,
        currentVolatilityProfile,
        undefined,
        predictiveProfile,
        predictiveContext,
        {
          hcpPersona: session?.hcpPersona || predictiveProfile,
          temperature,
          previousInteraction: repText,
          interactionHistory: session?.interactionHistory || [],
          previousConcernFamily: session?.lastConcernFamily || "",
          escalationLevel: Number(session?.escalationLevel || 0),
          authoritativePredictiveRoute,
        },
      );

      setTurns((prev) => {
        const updated = [...prev];
        const repIdx = updated.findLastIndex((t) => t.speaker === "rep");
        if (repIdx !== -1 && coachingEnabled && response.coachingNudge) {
          updated[repIdx] = { ...updated[repIdx], nudge: response.coachingNudge };
        }
        return [...updated, {
          id: createSafeId(),
          speaker: "hcp",
          text: response.hcpReply,
          timestamp: new Date().toISOString(),
          cues: response.activeCues || [],
          nudge: null,
          prediction: response.prediction || null,
          predictiveDebug: response.predictiveDebug || null,
        }];
      });

      setActiveCues(response.activeCues || []);
      const enrichedBehaviorSignals = {
        ...(response.behaviorSignals || {}),
        input_mode: inputMeta?.inputMode || "typed",
        voice_metadata: inputMeta?.voiceMetadata || null,
        voice_delivery_analysis: voiceAnalysis,
      };
      setLastSignals(enrichedBehaviorSignals);
      const updatedSignals = [...allSignals, enrichedBehaviorSignals];
      setAllSignals(updatedSignals);

      const updatedRepTurnIds = [...repTurnIds, repTurnObj.id];
      setRepTurnIds(updatedRepTurnIds);

      if (response.volatilityState) {
        setVolatilityState(response.volatilityState);
        setCurrentVolatilityProfile(response.volatilityState.profile);
      }

      const prediction = response.prediction || predictHcpBehavior(updatedSignals, updatedSignals, scenario);
      setHcpPrediction(prediction);
      setCoachShadowAfterAction(compareCoachShadowPrediction(pendingCoachShadowRef.current, response));
      if (coachingEnabled && response.coachingNudge) {
        setLastNudge(response.coachingNudge);
      }

      const updatedSession = {
        ...session,
        realism: temperature,
        predictiveProfile,
        hcpPersona: predictiveProfile,
        previousInteraction: repText,
        interactionHistory: [
          ...(session?.interactionHistory || []),
          {
            rep: repText,
            hcp: response.hcpReply,
            concernFamily: response?.prediction?.concernFamily || session?.lastConcernFamily || "",
            behaviorState: response.nextBehaviorState,
          },
        ].slice(-8),
        lastConcernFamily: response?.prediction?.concernFamily || session?.lastConcernFamily || "",
        escalationLevel: (() => {
          const prior = Number(session?.escalationLevel || 0);
          const escalates = ["closed", "resistance", "frustration", "time_pressure"].includes(String(response.nextBehaviorState || "").toLowerCase())
            || String(response?.prediction?.riskLevel || "").toLowerCase() === "high";
          if (escalates) return Math.min(3, prior + 1);
          return Math.max(0, prior - 1);
        })(),
        currentJourneyState: response.nextJourneyState,
        currentBehaviorState: response.nextBehaviorState,
        turnCount: session.turnCount + 2,
        hcpState: deriveHcpStateSnapshot({
          priorState: session?.hcpState,
          behaviorState: response.nextBehaviorState,
          prediction: response?.prediction,
          behaviorSignals: response?.behaviorSignals,
          temperature,
        }),
        sessionMemory: [
          ...(session?.sessionMemory || []),
          {
            hcpResponse: response.hcpReply,
            hcpState: deriveHcpStateSnapshot({
              priorState: session?.hcpState,
              behaviorState: response.nextBehaviorState,
              prediction: response?.prediction,
              behaviorSignals: response?.behaviorSignals,
              temperature,
            }),
            realism: temperature,
            temperature,
            concernFamily: response?.prediction?.concernFamily || session?.lastConcernFamily || "",
            repMessage: repText,
            behaviorSignals: enrichedBehaviorSignals,
            voiceMetadata: inputMeta?.voiceMetadata || null,
            voiceDeliveryAnalysis: voiceAnalysis,
            timestamp: new Date().toISOString(),
          },
        ].slice(-10),
      };
      setSession(updatedSession);
    } catch (error) {
      const message = error instanceof Error ? error.message : "HCP response failed.";
      setLastRuntimeError(message);
      toast({
        title: "HCP response failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [session, scenario, turns, coachingEnabled, isLoading, allSignals, repTurnIds, currentVolatilityProfile, hasRepSpoken, hcpPrediction, lastSignals, activeCues]);

  const handleEndSession = async () => {
    if (!session || isReviewing) return;
    setIsReviewing(true);
    setReviewStage("Analysing conversation signals…");

    const stateHistory = computeHcpStateHistory(
      allSignals,
      scenario.persona,
      scenario.interactionPressure || [],
      scenario.startingBehaviorState,
    );
    const volEvents = computeVolatilityEvents(scenario, allSignals, repTurnIds);

    setReviewStage("Generating coaching feedback (15–30 s)…");

    try {
      let reviewData;
      try {
        reviewData = await generateSessionReview(scenario, turns, allSignals, stateHistory, volEvents);
      } catch (error) {
        logReviewError("generate", error, {
          scenarioId: scenario?.id || null,
          turnCount: turns.length,
          signalCount: allSignals.length,
        });
        throw error;
      }
      console.debug("[Simulator] Session review payload:", reviewData);

      setReviewStage("Saving session…");
      const completedSession = {
        ...session,
        scenarioId: scenario?.id,
        scenarioTitle: scenario?.title,
        endedAt: new Date().toISOString(),
        turnCount: turns.filter((turn) => turn.speaker === "rep").length,
        transcript: turns,
        review: reviewData,
        signals: allSignals,
        predictiveLens: predictiveLens?.data ? {
          selection: predictiveLens.data.selection,
          synthesisSource: predictiveLens.data.synthesisSource,
          synthesisError: predictiveLens.data.synthesisError,
          specialistTitle: predictiveLens.data.specialistTitle,
          evidenceRecords: predictiveLens.data.evidenceRecords || [],
          sections: predictiveLens.data.lens?.sections || null,
          hcpPerspective: predictiveLens.data.lens?.hcpPerspective || null,
          repPreparation: predictiveLens.data.lens?.repPreparation || null,
          runtimeSignals: {
            predictive_profile_attached: {
              hasProfile: Boolean(session?.predictiveProfile),
              personaType: session?.predictiveProfile?.type || null,
            },
            temperature_applied: {
              value: session?.realism ?? session?.temperature ?? null,
              band: getTemperatureBandLabel(session?.realism ?? session?.temperature),
            },
          },
        } : null,
      };
      console.debug("[Simulator] Save session payload:", completedSession);
      await createWorkerSession(completedSession).catch(() => null);
      setSession({
        ...completedSession,
        isComplete: true,
        reviewData: JSON.stringify(reviewData),
      });

      setReview(reviewData);
      setShowSummary(true);
    } catch (error) {
      logReviewError("end_session", error, {
        scenarioId: scenario?.id || null,
        turnCount: turns.length,
        signalCount: allSignals.length,
      });
      toast({
        title: "Session review failed",
        description: error instanceof Error ? error.message : "Unable to generate feedback. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsReviewing(false);
      setReviewStage("");
    }
  };

  const handleRegenerateReview = async () => {
    if (!session || !scenario || isReviewing) return;

    setIsReviewing(true);
    setReviewStage("Regenerating feedback sections…");

    const stateHistory = computeHcpStateHistory(
      allSignals,
      scenario.persona,
      scenario.interactionPressure || [],
      scenario.startingBehaviorState,
    );
    const volEvents = computeVolatilityEvents(scenario, allSignals, repTurnIds);

    try {
      const regenerated = await generateSessionReview(scenario, turns, allSignals, stateHistory, volEvents);
      const nextReview = !review ? regenerated : {
        ...regenerated,
        // Keep section 1 stable when user regenerates coaching sections.
        briefRationale: review.briefRationale || regenerated.briefRationale,
        overallSummary: Array.isArray(review.overallSummary) && review.overallSummary.length
          ? review.overallSummary
          : regenerated.overallSummary,
        signalResponseAlignment: Array.isArray(review.signalResponseAlignment) && review.signalResponseAlignment.length
          ? review.signalResponseAlignment
          : regenerated.signalResponseAlignment,
      };

      setReview(nextReview);
      setSession((current) => current ? {
        ...current,
        review: nextReview,
        reviewData: JSON.stringify(nextReview),
      } : current);

      regenerateToastRef.current?.dismiss?.();
      regenerateToastRef.current = toast({
        title: "Feedback regenerated",
        description: "Updated coaching sections are ready.",
      });
    } catch (error) {
      regenerateToastRef.current?.dismiss?.();
      logReviewError("regenerate", error, {
        scenarioId: scenario?.id || null,
        turnCount: turns.length,
        signalCount: allSignals.length,
      });
      toast({
        title: "Regeneration failed",
        description: error instanceof Error ? error.message : "Unable to regenerate coaching feedback.",
        variant: "destructive",
      });
    } finally {
      setIsReviewing(false);
      setReviewStage("");
    }
  };

  const handleExport = () => {
    if (!review || !session) return;
    const lines = [
      "SIGNAL INTELLIGENCE COACHING SIMULATOR",
      "End & Get Feedback",
      `Scenario: ${scenario?.title || ""}`,
      `Turns: ${session.turnCount}`,
      `Date: ${new Date().toLocaleDateString()}`,
      "",
      "--- 01. OVERALL SUMMARY ---",
      ...(review.overallSummary || review.overallGuidance || []).map((g) => `• ${g}`),
      "",
      "--- 02. CAPABILITIES DONE WELL ---",
      ...(review.strengths || []).flatMap((s) => [`[${s.capabilityId}] ${s.title}`, s.guidance, ""]),
      "--- 03. CAPABILITIES TO DEVELOP ---",
      ...[...(review.improvementAreas || []), ...(review.missedOpportunities || [])].flatMap((s) => [`[${s.capabilityId}] ${s.title}`, s.guidance, s.exampleRewrite ? `Try: "${s.exampleRewrite}"` : "", ""]),
      "--- 04. SIGNAL-RESPONSE ALIGNMENT ---",
      ...(review.signalResponseAlignment || []).map((g) => `• ${g}`),
      "",
      "--- 05. ACTION PLAN ---",
      ...(review.suggestedReframes || []).flatMap((s) => [`[${s.capabilityId}] ${s.title}`, s.guidance, s.exampleRewrite ? `Try: "${s.exampleRewrite}"` : "", ""]),
      "",
      review.overallGuidance?.[0] || "",
      "",
      "--- TRANSCRIPT ---",
      ...turns.map((t) => `${t.speaker.toUpperCase()}: ${t.text}`),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-review-${session.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const showCurrentJourneyState = session?.currentJourneyState;
  const showActivePressures = Array.isArray(scenario?.interactionPressure) ? scenario.interactionPressure : [];
  const coachShadow = useMemo(() => buildCoachShadowMode({
    draftText: repDraftForAnalysis.text,
    hcpPrediction,
    predictiveLensData: predictiveLens?.data,
    session,
    scenario,
    lastSignals,
    activeCues,
    lastHcpTurn: getLastHcpTurn(turns),
    afterAction: coachShadowAfterAction,
  }), [
    repDraftForAnalysis.text,
    hcpPrediction,
    predictiveLens?.data,
    session,
    scenario,
    lastSignals,
    activeCues,
    turns,
    coachShadowAfterAction,
  ]);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(180deg, #f7fbfc 0%, #eef5f6 38%, #f8fbfc 100%)" }}>
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Initializing scenario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col font-inter" style={{ background: "linear-gradient(180deg, #f7fbfc 0%, #eef5f6 38%, #f8fbfc 100%)" }}>
      <AppHeader maxWidthClassName="max-w-none" />

      <div
        className="shrink-0 z-10 backdrop-blur-xl"
        style={{
          background: "linear-gradient(92deg, hsl(224 50% 15%) 0%, hsl(214 54% 21%) 42%, hsl(186 44% 20%) 100%)",
          borderBottom: "1px solid rgba(89, 125, 175, 0.24)",
        }}
      >
        <div className="grid grid-cols-[minmax(240px,auto)_1fr_auto] items-center px-5 py-3.5 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="font-semibold text-base leading-none truncate max-w-[320px]" style={{ color: "rgba(255,255,255,0.96)" }}>
              {scenario?.title}
            </h1>
          </div>

          <div className="hidden lg:flex items-center gap-3 min-w-0 justify-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] whitespace-nowrap" style={{ color: "rgba(255,255,255,0.96)" }}>
              HCP State
            </span>
            <div className="flex items-center gap-3 min-w-0 justify-center">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(173, 240, 231, 0.88)" }}>
                  Journey
                </span>
                <span className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border whitespace-nowrap" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.96)", borderColor: "rgba(37, 124, 123, 0.55)" }}>
                  {JOURNEY_STATE_LABELS[showCurrentJourneyState] || showCurrentJourneyState}
                </span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(173, 240, 231, 0.88)" }}>
                  Behavior
                </span>
                <span className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border whitespace-nowrap" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.96)", borderColor: "rgba(37, 124, 123, 0.55)" }}>
                  {BEHAVIOR_STATE_LABELS[session?.currentBehaviorState] || session?.currentBehaviorState}
                </span>
              </div>
              {showActivePressures.length > 0 && (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(173, 240, 231, 0.88)" }}>
                    Pressures
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 max-w-[320px]">
                    {showActivePressures.map((pressure) => (
                      <span
                        key={pressure}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border whitespace-nowrap"
                        style={{
                          background: "rgba(255,255,255,0.08)",
                          borderColor: "rgba(37, 124, 123, 0.55)",
                          color: "rgba(255,255,255,0.96)",
                        }}
                      >
                        {PRESSURE_LABELS[pressure] || pressure}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 justify-end">
            <button
              onClick={handleEndSession}
              disabled={isReviewing || turns.filter((t) => t.speaker === "rep").length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:cursor-not-allowed"
              style={{
                background: turns.filter((t) => t.speaker === "rep").length === 0 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.08)",
                border: turns.filter((t) => t.speaker === "rep").length === 0 ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(255,255,255,0.18)",
                color: turns.filter((t) => t.speaker === "rep").length === 0 ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.92)",
              }}
            >
              {isReviewing ? (
                <div className="w-3 h-3 border border-current/60 border-t-current rounded-full animate-spin" />
              ) : (
                <Square className="w-3 h-3" />
              )}
              <span className="hidden sm:inline">{isReviewing ? "Generating Feedback..." : "End Session & Get Feedback"}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden p-4 gap-4">
        <div
          className="relative flex-1 min-h-0 flex flex-col overflow-hidden rounded-[28px]"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(242,248,249,0.98) 100%)",
            border: "1px solid rgba(152, 160, 171, 0.68)",
            boxShadow: "0 18px 40px rgba(14, 24, 43, 0.06)",
          }}
        >
          {lastRuntimeError ? (
            <div
              className="mx-6 mt-4 rounded-2xl border px-4 py-3 text-sm"
              style={{
                background: "rgba(255, 244, 244, 0.92)",
                borderColor: "rgba(191, 132, 145, 0.46)",
                color: "hsl(356 32% 34%)",
              }}
            >
              {lastRuntimeError}
            </div>
          ) : null}
          <MessageList
            turns={turns}
            isLoading={isLoading}
            realtimeFeedback={realtimeFeedback}
            highlightedTurnId={highlightedTurnId}
          />

          <MessageInput
            onSend={handleRepMessage}
            onDraftChange={handleRepDraftChange}
            draftToApply={recommendedResponseDraft}
            disabled={isLoading || isReviewing || session?.isComplete}
            placeholder={conversationInit?.inputPlaceholder}
          />
        </div>

        <motion.aside
          initial={false}
          animate={{ width: rightPanelCollapsed ? 76 : 384 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="hidden lg:flex relative shrink-0 flex-col overflow-hidden rounded-[28px]"
          style={{
            background: "linear-gradient(180deg, hsl(224 41% 14%) 0%, hsl(214 43% 18%) 52%, hsl(184 37% 21%) 100%)",
            border: "1px solid rgba(80, 143, 149, 0.28)",
            boxShadow: "0 18px 40px rgba(14, 24, 43, 0.14)",
          }}
        >
          <button
            type="button"
            onClick={() => setRightPanelCollapsed((current) => !current)}
            aria-expanded={!rightPanelCollapsed}
            aria-label={rightPanelCollapsed ? "Expand intelligence panel" : "Collapse intelligence panel"}
            title={rightPanelCollapsed ? "Expand panel" : "Collapse panel"}
            className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: "rgba(255,255,255,0.10)",
              borderColor: "rgba(125, 173, 190, 0.28)",
              color: "hsl(174 60% 72%)",
              boxShadow: "0 10px 24px rgba(0,0,0,0.16)",
            }}
          >
            {rightPanelCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
          </button>

          {rightPanelCollapsed ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl border"
                style={{
                  background: "rgba(37,124,123,0.16)",
                  borderColor: "rgba(116,227,206,0.26)",
                  color: "hsl(174 60% 72%)",
                }}
              >
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div
                className="rotate-180 text-[10px] font-semibold uppercase tracking-[0.26em]"
                style={{
                  color: "rgba(204,238,244,0.78)",
                  writingMode: "vertical-rl",
                }}
              >
                Intelligence
              </div>
            </div>
          ) : (
            <motion.div
              key="right-panel-content"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="h-full overflow-y-auto p-5 pt-14 space-y-4"
            >
              <SimulatorRightPanel
                turns={turns}
                hcpPrediction={repTurnIds.length >= 2 ? hcpPrediction : null}
                lastSignals={lastSignals}
                latestVoiceAnalysis={latestVoiceAnalysis}
                voiceEvaluation={voiceEvaluation}
                coachShadow={coachShadow}
                onAnalyzeVoice={handleVoiceAnalysisRequest}
                isVoiceEvaluating={isVoiceEvaluating}
                canAnalyzeVoice={Boolean(repDraftForAnalysis.text?.trim()) && !isLoading && !isReviewing && !session?.isComplete}
                focusCapabilities={scenario?.suggestedFocusCapabilities || []}
                lastNudge={lastNudge}
                realtimeFeedback={realtimeFeedback}
                scenario={scenario}
                conversationInit={conversationInit}
                hasRepSpoken={hasRepSpoken}
                predictiveLens={predictiveLens}
                realism={session?.realism}
                onUseRecommendedResponse={handleUseRecommendedResponse}
                onCriticalVoiceEvent={handleCriticalVoiceEvent}
                adminIntelligenceMode={urlParams.get("intelligenceAdmin") === "true" || urlParams.get("admin") === "true"}
              />
            </motion.div>
          )}
        </motion.aside>

        <button
          onClick={() => setShowMobileRail(!showMobileRail)}
          className="lg:hidden fixed bottom-24 right-4 z-20 w-10 h-10 rounded-full bg-surface-elevated border border-border/40 flex items-center justify-center shadow-lg"
        >
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showMobileRail ? "rotate-180" : ""}`} />
        </button>

        {showMobileRail && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-surface border-t border-border/30 rounded-t-2xl p-5 max-h-[60vh] overflow-y-auto"
          >
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
            <SimulatorRightPanel
              turns={turns}
              hcpPrediction={repTurnIds.length >= 2 ? hcpPrediction : null}
              lastSignals={lastSignals}
              latestVoiceAnalysis={latestVoiceAnalysis}
              voiceEvaluation={voiceEvaluation}
              coachShadow={coachShadow}
              onAnalyzeVoice={handleVoiceAnalysisRequest}
              isVoiceEvaluating={isVoiceEvaluating}
              canAnalyzeVoice={Boolean(repDraftForAnalysis.text?.trim()) && !isLoading && !isReviewing && !session?.isComplete}
              focusCapabilities={scenario?.suggestedFocusCapabilities || []}
              lastNudge={lastNudge}
              realtimeFeedback={realtimeFeedback}
              scenario={scenario}
              conversationInit={conversationInit}
              hasRepSpoken={hasRepSpoken}
              predictiveLens={predictiveLens}
              realism={session?.realism}
              onUseRecommendedResponse={handleUseRecommendedResponse}
              onCriticalVoiceEvent={handleCriticalVoiceEvent}
              adminIntelligenceMode={urlParams.get("intelligenceAdmin") === "true" || urlParams.get("admin") === "true"}
            />
          </motion.div>
        )}
      </div>

      {isReviewing && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center gap-6">
          <div className="w-12 h-12 border-2 border-border border-t-primary rounded-full animate-spin" />
          <div className="text-center space-y-2 max-w-sm px-6">
            <p className="font-semibold text-foreground text-lg">Generating Session Review</p>
            <p className="text-sm text-primary leading-relaxed">{reviewStage}</p>
            <p className="text-xs text-muted-foreground/60 mt-4 border-t border-border/40 pt-4">
              Analysing {turns.filter((t) => t.speaker === "rep").length} rep turn{turns.filter((t) => t.speaker === "rep").length !== 1 ? "s" : ""} across 8 Signal Intelligence dimensions.<br />
              This typically takes 15–30 seconds.
            </p>
          </div>
        </div>
      )}

      {showSummary && review && (
        <SessionSummaryModal
          review={review}
          scenario={scenario}
          session={session}
          sessionTurnCount={turns.filter((t) => t.speaker === "rep").length}
          onClose={() => setShowSummary(false)}
          onExport={handleExport}
          onNewSession={() => navigate("/")}
          onRegenerate={handleRegenerateReview}
          onJumpToTurn={handleJumpToTurn}
        />
      )}
    </div>
  );
}
