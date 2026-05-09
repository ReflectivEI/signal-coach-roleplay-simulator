import { useState, useEffect, useCallback, useRef } from "react";
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
import { Square, ChevronDown } from "lucide-react";
import { BEHAVIOR_STATE_LABELS, JOURNEY_STATE_LABELS, PRESSURE_LABELS } from "@/lib/signalIntelligence";
import { computeHcpStateHistory } from "@/lib/hcpStateEngine";
import { predictHcpBehavior } from "@/lib/hcpBehaviorPrediction";
import { getScenarioById, listAllScenarios } from "@/lib/scenarioStorage";
import { generateRealtimeFeedback, createWorkerSession } from "@/services/workerClient";
import { resolveObservedCue } from "@/lib/hcpCueGenerator";
import { buildPredictiveSeedFromScenario } from "@/lib/predictiveSeedResolver";
import { buildPredictivePromptContext, buildPredictiveRuntimeLens } from "@/lib/predictiveRuntimeService";
import { requireRealismContract } from "@/lib/scenarioInputResolver";
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
  const [allSignals, setAllSignals] = useState([]);
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

  const handleRepMessage = useCallback(async (repText) => {
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

    setHasRepSpoken(true);

    const repTurnObj = {
      id: createSafeId(),
      speaker: "rep",
      text: repText,
      timestamp: new Date().toISOString(),
      cues: [],
      nudge: null,
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
          predictiveDebug: response.predictiveDebug || null,
        }];
      });

      setActiveCues(response.activeCues || []);
      setLastSignals(response.behaviorSignals || {});
      const updatedSignals = [...allSignals, response.behaviorSignals || {}];
      setAllSignals(updatedSignals);

      const updatedRepTurnIds = [...repTurnIds, repTurnObj.id];
      setRepTurnIds(updatedRepTurnIds);

      if (response.volatilityState) {
        setVolatilityState(response.volatilityState);
        setCurrentVolatilityProfile(response.volatilityState.profile);
      }

      const prediction = response.prediction || predictHcpBehavior(updatedSignals, updatedSignals, scenario);
      setHcpPrediction(prediction);
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
            behaviorSignals: response?.behaviorSignals || {},
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
  }, [session, scenario, turns, coachingEnabled, isLoading, allSignals, repTurnIds, currentVolatilityProfile, hasRepSpoken]);

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

  const showCurrentJourneyState = session?.currentJourneyState;
  const showActivePressures = Array.isArray(scenario?.interactionPressure) ? scenario.interactionPressure : [];

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
          <MessageList turns={turns} isLoading={isLoading} realtimeFeedback={realtimeFeedback} />

          <MessageInput
            onSend={handleRepMessage}
            disabled={isLoading || isReviewing || session?.isComplete}
            placeholder={conversationInit?.inputPlaceholder}
          />
        </div>

        <div
          className="hidden lg:flex w-80 xl:w-96 flex-col overflow-y-auto rounded-[28px]"
          style={{
            background: "linear-gradient(180deg, hsl(224 41% 14%) 0%, hsl(214 43% 18%) 52%, hsl(184 37% 21%) 100%)",
            border: "1px solid rgba(80, 143, 149, 0.28)",
            boxShadow: "0 18px 40px rgba(14, 24, 43, 0.14)",
          }}
        >
          <div className="p-5 space-y-4">
            <SimulatorRightPanel
              hcpPrediction={repTurnIds.length >= 2 ? hcpPrediction : null}
              lastSignals={lastSignals}
              focusCapabilities={scenario?.suggestedFocusCapabilities || []}
              lastNudge={lastNudge}
              realtimeFeedback={realtimeFeedback}
              scenario={scenario}
              conversationInit={conversationInit}
              hasRepSpoken={hasRepSpoken}
              predictiveLens={predictiveLens}
              realism={session?.realism}
            />
          </div>
        </div>

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
              hcpPrediction={repTurnIds.length >= 2 ? hcpPrediction : null}
              lastSignals={lastSignals}
              focusCapabilities={scenario?.suggestedFocusCapabilities || []}
              lastNudge={lastNudge}
              realtimeFeedback={realtimeFeedback}
              scenario={scenario}
              conversationInit={conversationInit}
              hasRepSpoken={hasRepSpoken}
              predictiveLens={predictiveLens}
              realism={session?.realism}
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
        />
      )}
    </div>
  );
}
