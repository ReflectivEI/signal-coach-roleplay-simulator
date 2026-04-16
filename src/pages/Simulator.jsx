import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
import { ArrowLeft, Square, Lightbulb, LightbulbOff, ChevronDown, Target } from "lucide-react";
import { JOURNEY_STATE_LABELS, PERSONA_LABELS } from "@/lib/signalIntelligence";
import { computeHcpState, computeHcpStateHistory } from "@/lib/hcpStateEngine";
import { getScenarioById, listAllScenarios } from "@/lib/scenarioStorage";
import { generateRealtimeFeedback, createWorkerSession } from "@/services/workerClient";
import { resolveObservedCue } from "@/lib/hcpCueGenerator";

function createLocalSession(scData, convInit) {
  return {
    id: crypto.randomUUID(),
    scenarioId: scData.id,
    scenarioTitle: scData.title,
    currentJourneyState: scData.journeyState,
    currentBehaviorState: convInit.initialBehaviorState,
    turnCount: 0,
    coachingNudgesEnabled: true,
    isComplete: false,
  };
}

export default function Simulator() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const scenarioId = urlParams.get("scenarioId");

  const [scenario, setScenario] = useState(null);
  const [session, setSession] = useState(null);
  const [turns, setTurns] = useState([]);
  const [activeCues, setActiveCues] = useState([]);
  const [lastSignals, setLastSignals] = useState({});
  const [lastNudge, setLastNudge] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [coachingEnabled, setCoachingEnabled] = useState(true);
  const [review, setReview] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showMobileRail, setShowMobileRail] = useState(false);
  const [allSignals, setAllSignals] = useState([]);
  const [hcpPrediction, setHcpPrediction] = useState(null);
  const [volatilityState, setVolatilityState] = useState(null);
  const [currentVolatilityProfile, setCurrentVolatilityProfile] = useState(/** @type {"stable" | "slightly_disrupted" | "disrupted"} */ ("stable"));
  const [repTurnIds, setRepTurnIds] = useState([]);
  const [conversationInit, setConversationInit] = useState(null);
  const [hasRepSpoken, setHasRepSpoken] = useState(false);
  const [realtimeFeedback, setRealtimeFeedback] = useState(null);
  const [reviewStage, setReviewStage] = useState("");

  useEffect(() => {
    if (scenarioId) void initSession();
    else navigate("/");
  }, [scenarioId]);

  const initSession = async () => {
    setIsInitializing(true);
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
    setScenario(scData);

    const convInit = await initializeConversation(scData);
    setConversationInit(convInit);

    const newSession = createLocalSession(scData, convInit);
    setSession(newSession);

    setTurns([]);
    setHasRepSpoken(false);

    const initCues = [];
    const openingCue = resolveObservedCue("", {
      hcpReply: scData.openingScene || scData.visualScene || scData.description || "",
      behaviorState: scData.startingBehaviorState || "neutral",
      interactionPressures: scData.interactionPressure || [],
      scenario: scData,
    });
    initCues.push({ id: "cue_init_1", ...openingCue });
    setActiveCues(initCues);
    setIsInitializing(false);
  };

  const handleRepMessage = useCallback(async (repText) => {
    if (!session || !scenario || isLoading) return;
    setIsLoading(true);
    setLastNudge(null);
    setHasRepSpoken(true);

    const repTurnObj = {
      id: crypto.randomUUID(),
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
    }));

    const response = await generateHcpResponse(
      scenario,
      conversationHistory,
      session.currentBehaviorState,
      session.currentJourneyState,
      coachingEnabled,
      repText,
      allSignals,
      session.turnCount,
      currentVolatilityProfile,
    );

    setTurns((prev) => {
      const updated = [...prev];
      const repIdx = updated.findLastIndex((t) => t.speaker === "rep");
      if (repIdx !== -1 && coachingEnabled && response.coachingNudge) {
        updated[repIdx] = { ...updated[repIdx], nudge: response.coachingNudge };
      }
      return [...updated, {
        id: crypto.randomUUID(),
        speaker: "hcp",
        text: response.hcpReply,
        timestamp: new Date().toISOString(),
        cues: response.activeCues || [],
        nudge: null,
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

    const prediction = computeHcpState(
      updatedSignals,
      scenario.persona,
      scenario.interactionPressure || [],
      scenario.startingBehaviorState,
    );
    setHcpPrediction(prediction);
    if (coachingEnabled && response.coachingNudge) {
      setLastNudge(response.coachingNudge);
    }

    const updatedSession = {
      ...session,
      currentJourneyState: response.nextJourneyState,
      currentBehaviorState: response.nextBehaviorState,
      turnCount: session.turnCount + 2,
    };
    setSession(updatedSession);
    setIsLoading(false);
  }, [session, scenario, turns, coachingEnabled, isLoading, allSignals, repTurnIds, currentVolatilityProfile]);

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

    const reviewData = await generateSessionReview(scenario, turns, allSignals, stateHistory, volEvents);

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
    };
    await createWorkerSession(completedSession).catch(() => null);
    setSession((current) => current ? ({
      ...current,
      isComplete: true,
      endedAt: new Date().toISOString(),
      reviewData: JSON.stringify(reviewData),
    }) : current);

    setReview(reviewData);
    setShowSummary(true);
    setIsReviewing(false);
    setReviewStage("");
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

  return (
    <div className="min-h-screen flex flex-col font-inter" style={{ background: "linear-gradient(180deg, #f7fbfc 0%, #eef5f6 38%, #f8fbfc 100%)" }}>
      <div
        className="shrink-0 z-10 backdrop-blur-xl"
        style={{
          background: "linear-gradient(92deg, hsl(224 50% 15%) 0%, hsl(214 54% 21%) 42%, hsl(186 44% 20%) 100%)",
          borderBottom: "1px solid rgba(89, 125, 175, 0.24)",
        }}
      >
        <div className="flex items-center justify-between px-5 py-3.5 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/")}
              className="transition-colors shrink-0 p-1"
              style={{ color: "rgba(244,249,249,0.92)" }}
              onMouseEnter={e => { e.currentTarget.style.color = "hsl(177 49% 62%)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "rgba(244,249,249,0.92)"; }}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-px h-5 shrink-0" style={{ background: "rgba(255,255,255,0.18)" }} />
            <div className="min-w-0">
              <h1 className="font-semibold text-sm truncate leading-snug" style={{ color: "rgba(255,255,255,0.96)" }}>{scenario?.title}</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <Target className="w-3 h-3 shrink-0" style={{ color: "rgba(220, 236, 236, 0.72)" }} />
                <span className="text-xs truncate" style={{ color: "rgba(220, 236, 236, 0.72)" }}>{PERSONA_LABELS[scenario?.persona] || scenario?.persona}</span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.24)" }}>·</span>
                <span className="text-xs" style={{ color: "rgba(220, 236, 236, 0.72)" }}>{JOURNEY_STATE_LABELS[session?.currentJourneyState]}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setCoachingEnabled(!coachingEnabled)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
              style={coachingEnabled ? {
                background: "hsl(174 30% 18%)",
                border: "1px solid hsl(174 60% 52% / 0.5)",
                color: "hsl(174 60% 72%)",
              } : {
                background: "hsl(222 30% 18%)",
                border: "1px solid hsl(222 30% 28%)",
                color: "hsl(215 20% 55%)",
              }}
            >
              {coachingEnabled ? <Lightbulb className="w-3 h-3" /> : <LightbulbOff className="w-3 h-3" />}
              <span className="hidden sm:inline">Coaching</span>
            </button>
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

      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        <div
          className="flex-1 flex flex-col overflow-hidden rounded-[28px]"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(242,248,249,0.98) 100%)",
            border: "1px solid rgba(152, 160, 171, 0.68)",
            boxShadow: "0 18px 40px rgba(14, 24, 43, 0.06)",
          }}
        >
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
              cues={activeCues}
              journeyState={session?.currentJourneyState}
              behaviorState={session?.currentBehaviorState}
              interactionPressures={scenario?.interactionPressure || []}
              hcpPrediction={repTurnIds.length >= 2 ? hcpPrediction : null}
              lastSignals={lastSignals}
              focusCapabilities={scenario?.suggestedFocusCapabilities || []}
              lastNudge={lastNudge}
              realtimeFeedback={realtimeFeedback}
              scenario={scenario}
              conversationInit={conversationInit}
              hasRepSpoken={hasRepSpoken}
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
              cues={activeCues}
              journeyState={session?.currentJourneyState}
              behaviorState={session?.currentBehaviorState}
              interactionPressures={scenario?.interactionPressure || []}
              hcpPrediction={repTurnIds.length >= 2 ? hcpPrediction : null}
              lastSignals={lastSignals}
              focusCapabilities={scenario?.suggestedFocusCapabilities || []}
              lastNudge={lastNudge}
              realtimeFeedback={realtimeFeedback}
              scenario={scenario}
              conversationInit={conversationInit}
              hasRepSpoken={hasRepSpoken}
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
          sessionTurnCount={turns.filter((t) => t.speaker === "rep").length}
          onClose={() => setShowSummary(false)}
          onExport={handleExport}
          onNewSession={() => navigate("/")}
        />
      )}
    </div>
  );
}
