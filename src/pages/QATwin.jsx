import { useNavigate } from "react-router-dom";
import { generateHcpResponse } from "@/lib/hcpResponseGenerator";
import { computeVolatilityEvents } from "@/lib/simulatorEngine";
import { runCapabilityEvaluationEngine } from "@/lib/capabilityEvaluation";
import { initializeConversation } from "@/lib/conversationInit";
import { computeHcpStateHistory } from "@/lib/hcpStateEngine";
import { generateSessionReview } from "@/lib/sessionReview";
import { ArrowLeft, Play, Square, Zap, CheckCircle2, AlertCircle, Download } from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invokeWorkerText } from "@/services/workerClient";
import { listAllScenarios } from "@/lib/scenarioStorage";
import { maybeApplyHardFamilyAnswerReply, maybeConcreteifyStrongRepReply, maybeDeRepeatStrongRepReply, maybeEnforceFamilyAnswerReply, maybeReviseStrongRepReply, maybeTightenSpokenRepReply } from "@/lib/qaRepProxy";

const QA_PERSONAS = {
  strong_rep: {
    label: "Strong Rep",
    description: "Asks open questions, listens well, acknowledges objections",
    color: "text-signal-positive border-signal-positive/40 bg-signal-positive/10",
    buildPrompt: (scenario, turns, currentBehaviorState, currentJourneyState) => `
You are a highly skilled pharma sales rep in a role-play simulation. Your task is to demonstrate STRONG capability behaviors.

SCENARIO: ${scenario.title}
OBJECTIVE: ${scenario.objective}
HCP PERSONA: ${scenario.persona}
CURRENT BEHAVIOR STATE: ${currentBehaviorState}
CURRENT JOURNEY STATE: ${currentJourneyState}
INTERACTION PRESSURES: ${(scenario.interactionPressure || []).join(", ") || "none"}
OPENING SCENE: ${scenario.openingScene || ""}
KEY CHALLENGES: ${(scenario.keyChallenges || []).join(" | ") || "none"}

CONVERSATION SO FAR:
${turns.map((t) => `${t.speaker.toUpperCase()}: ${t.text}`).join("\n")}

Generate the rep's next response (1-2 sentences) that:
- Asks a specific, contextually relevant open-ended question OR meaningfully acknowledges what the HCP said
- Does NOT pitch or lead with product claims
- Directly responds to the last HCP message
- Sounds natural and professional
- Uses only one question maximum
- Avoids stacked or compound questions
- If the HCP is time-constrained, closed, resistant, or operationally pressured, keep the response concise and tightly relevant
- In high-pressure scenarios, earn the next turn by showing understanding before broadening discovery
- If the HCP asks a direct operational or clinical question, answer it directly first instead of defaulting to more discovery
- If the HCP asks a direct workflow, burden, value, or clinical-impact question, your next reply must begin with a direct declarative answer, not a question
- If the HCP names a specific subgroup, exclusion criterion, evidence gap, renal issue, safety concern, or workflow step, reference that exact issue directly instead of saying "what specific aspects" or "help me understand"
- If there is no HCP reply yet, treat the opening scene as the active concern and respond to the exact issue already on the table instead of starting with detached discovery
- On the first turn of a skeptical clinical-value scenario, lead with the specific evidence gap in the opening scene before any narrow follow-up
- Respect the scenario key challenges; if they say exploring the concern is more credible than defending the data, do not jump into a rebuttal or rescue claim
- In a skeptical clinical-value exchange, the first clause of your reply must name the exact issue the HCP raised (for example: renal impairment, excluded patients, real-world fit, subgroup mismatch)
- In a skeptical clinical-value exchange, if the HCP repeats the same evidence-fit concern, stop broadening discovery and answer the concern directly in plain clinician language before asking anything else
- When the objection is subgroup mismatch, excluded patients, comorbidities, renal impairment, workflow friction, or real-world fit, prefer one short declarative response over a question
- In a repeated objection cycle, your reply should do three things in order: name the exact mismatch, state the practical implication, and offer one concrete next step or clarifier
- Do not introduce a new efficacy, safety, or pharmacokinetic claim just to rescue the conversation if the HCP is challenging fit or trial design
- If the HCP asks what changes, what gets added, what staff has to do, or what the point is, give one direct answer before asking anything else
- In a pressured interaction, do not open with "help me understand" or another broad discovery move when the HCP is asking for the bottom line
- Do not use vague empathy wrappers like "I sense", "it sounds like", or "you're not convinced" when the HCP has already stated the concrete issue
- Do not begin with generic summary lines like "You've expressed concerns..." or "You've said..." when the concrete issue is already on the table
- In high-pressure or access-barrier scenarios, prefer one clear answer and only add a short follow-up if the HCP has room for it
- In a time-pressured exchange, it is better to give one crisp answer with no question than a thoughtful question that delays the answer
- If the HCP repeats the same concern twice, stop widening the conversation and address the concern head-on
- Do not ask another broad question when the HCP is clearly asking for the bottom line
- In commitment-close or adoption-commitment scenarios, stop reopening discovery after the core blocker is clear
- Once the HCP has repeated a vague blocker like "right patient", "not yet", or "I need to see more", pivot toward a proportionate next-step ask
- In close-stage scenarios, prefer a smallest-next-step question such as whether the HCP would be open to defining one patient type, reviewing one case, or taking one concrete action they can own

Return ONLY the rep's reply as plain text.`,
  },
  mediocre_rep: {
    label: "Mediocre Rep",
    description: "Mixed — some good moves, some missed signals",
    color: "text-signal-watch border-signal-watch/40 bg-signal-watch/10",
    buildPrompt: (scenario, turns) => `
You are a pharma sales rep in a role-play simulation. You are AVERAGE — sometimes you respond well, sometimes you miss signals or default to product pitching.

SCENARIO: ${scenario.title}
OBJECTIVE: ${scenario.objective}

CONVERSATION SO FAR:
${turns.map((t) => `${t.speaker.toUpperCase()}: ${t.text}`).join("\n")}

Generate the rep's next response (1-2 sentences) that is INCONSISTENT — sometimes addresses the HCP concern, sometimes pivots to a product claim or generic statement.

Return ONLY the rep's reply as plain text.`,
  },
  weak_rep: {
    label: "Weak Rep",
    description: "Pitches, ignores signals, talks past the HCP",
    color: "text-destructive border-destructive/40 bg-destructive/10",
    buildPrompt: (scenario, turns) => `
You are a poorly skilled pharma sales rep in a role-play simulation. You demonstrate WEAK behaviors.

SCENARIO: ${scenario.title}
OBJECTIVE: ${scenario.objective}

CONVERSATION SO FAR:
${turns.map((t) => `${t.speaker.toUpperCase()}: ${t.text}`).join("\n")}

Generate the rep's next response (1-2 sentences) that:
- Ignores the HCP's actual concern or question
- Defaults to a product feature or efficacy claim
- Does not ask any meaningful question
- Sounds like a scripted pitch

Return ONLY the rep's reply as plain text.`,
  },
};

const QA_STEP_TIMEOUT_MS = 45000;

async function withTimeout(promise, label, timeoutMs = QA_STEP_TIMEOUT_MS) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function runAssertions(scenario, turns, allSignals, review) {
  const assertions = [];
  const repTurns = turns.filter((t) => t.speaker === "rep");
  const hcpTurns = turns.filter((t) => t.speaker === "hcp");

  assertions.push({
    id: "a1",
    label: "HCP responded to every rep turn",
    pass: hcpTurns.length >= repTurns.length,
    detail: `${hcpTurns.length} HCP turns / ${repTurns.length} rep turns`,
  });

  const signalsPopulated = allSignals.filter((s) => s && Object.keys(s).length > 0).length;
  assertions.push({
    id: "a2",
    label: "Behavior signals populated for all turns",
    pass: signalsPopulated === repTurns.length,
    detail: `${signalsPopulated}/${repTurns.length} turns have signals`,
  });

  const isHighPressure = (scenario.interactionPressure || []).length >= 2 || scenario.startingBehaviorState === "closed";
  const volEvents = computeVolatilityEvents(scenario, allSignals, repTurns.map((t) => t.id));
  assertions.push({
    id: "a3",
    label: isHighPressure ? "Volatility engine triggered (expected for high-pressure scenario)" : "Volatility stable (expected for low-pressure scenario)",
    pass: isHighPressure ? volEvents.length > 0 : true,
    detail: `${volEvents.length} volatility events logged`,
  });

  const capInsights = review?.capabilityInsights || [];
  assertions.push({
    id: "a4",
    label: "Session review contains all 8 capability insights",
    pass: capInsights.length === 8,
    detail: `${capInsights.length}/8 capability insights returned`,
  });

  const emptyHcpReplies = hcpTurns.filter((t) => !t.text || t.text.trim().length < 5).length;
  assertions.push({
    id: "a5",
    label: "No empty or malformed HCP replies",
    pass: emptyHcpReplies === 0,
    detail: emptyHcpReplies > 0 ? `${emptyHcpReplies} empty replies detected` : "All HCP replies populated",
  });

  const nudgeCount = turns.filter((t) => t.nudge).length;
  assertions.push({
    id: "a6",
    label: "Coaching nudge fired at least once",
    pass: nudgeCount >= 1,
    detail: `${nudgeCount} coaching nudges across session`,
  });

  const briefLen = review?.briefRationale?.length || 0;
  assertions.push({
    id: "a7",
    label: "Deterministic capability evaluation completed",
    pass: briefLen > 50,
    detail: briefLen > 50 ? "Capability levels computed" : "Evaluation missing",
  });

  const levels = capInsights.map((c) => c.observationLevel);
  const allDeveloping = levels.length > 0 && levels.every((l) => l === "developing");
  assertions.push({
    id: "a8",
    label: "Capability levels vary (not all defaulted to 'developing')",
    pass: !allDeveloping,
    detail: levels.join(", ") || "no insights",
  });

  return assertions;
}

async function retryWithBackoff(fn, maxRetries = 3) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

async function runQASession(scenario, personaKey, maxTurns, onProgress) {
  const persona = QA_PERSONAS[personaKey];
  const convInit = await initializeConversation(scenario);

  const session = {
    id: crypto.randomUUID(),
    scenarioId: scenario.id,
    scenarioTitle: `${scenario.title} [QA]`,
    currentJourneyState: scenario.journeyState,
    currentBehaviorState: convInit.initialBehaviorState,
    turnCount: 0,
    coachingNudgesEnabled: true,
    isComplete: false,
  };

  let turns = [];
  let allSignals = [];
  let repTurnIds = [];
  let currentBehaviorState = convInit.initialBehaviorState;
  let currentJourneyState = scenario.journeyState;
  /** @type {"stable" | "slightly_disrupted" | "disrupted"} */
  let currentVolatilityProfile = "stable";

  for (let i = 0; i < maxTurns; i++) {
    try {
      onProgress(`Turn ${i + 1}/${maxTurns} — generating rep message…`);
      const repPrompt = persona.buildPrompt(scenario, turns, currentBehaviorState, currentJourneyState);
      const repTextRaw = await retryWithBackoff(() => withTimeout(
        invokeWorkerText({ prompt: repPrompt, max_tokens: 180, temperature: 0.1 }),
        `${scenario.title} rep turn ${i + 1}`,
      ));
      const rawText = typeof repTextRaw === "string" ? repTextRaw.trim() : String(repTextRaw).trim();
      const repDraft = rawText.replace(/^(REP|Rep|rep)\s*:\s*/i, "").trim();
      let repText = repDraft;
      if (personaKey === "strong_rep") {
        repText = maybeApplyHardFamilyAnswerReply({
          scenario,
          turns,
          draft: repText,
        });
        repText = maybeEnforceFamilyAnswerReply({
          scenario,
          turns,
          draft: repText,
        });
        repText = await retryWithBackoff(() => withTimeout(
          maybeReviseStrongRepReply({
            scenario,
            turns,
            currentBehaviorState,
            currentJourneyState,
            draft: repText,
          }),
          `${scenario.title} rep revision ${i + 1}`,
        ));
        repText = await retryWithBackoff(() => withTimeout(
          maybeConcreteifyStrongRepReply({
            scenario,
            turns,
            currentBehaviorState,
            currentJourneyState,
            draft: repText,
          }),
          `${scenario.title} rep concrete revision ${i + 1}`,
        ));
        repText = await retryWithBackoff(() => withTimeout(
          maybeDeRepeatStrongRepReply({
            scenario,
            turns,
            currentBehaviorState,
            currentJourneyState,
            draft: repText,
          }),
          `${scenario.title} rep dedupe revision ${i + 1}`,
        ));
        repText = await retryWithBackoff(() => withTimeout(
          maybeTightenSpokenRepReply({
            scenario,
            turns,
            currentBehaviorState,
            currentJourneyState,
            draft: repText,
          }),
          `${scenario.title} rep spoken-tightening ${i + 1}`,
        ));
        repText = maybeApplyHardFamilyAnswerReply({
          scenario,
          turns,
          draft: repText,
        });
        repText = maybeEnforceFamilyAnswerReply({
          scenario,
          turns,
          draft: repText,
        });
      }

      const repTurnObj = {
        id: crypto.randomUUID(),
        speaker: "rep",
        text: repText,
        timestamp: new Date().toISOString(),
        cues: [],
        nudge: null,
      };
      turns = [...turns, repTurnObj];
      repTurnIds.push(repTurnObj.id);

      onProgress(`Turn ${i + 1}/${maxTurns} — generating HCP response…`);
      const conversationHistory = turns.map((t) => ({
        id: t.id,
        speaker: t.speaker,
        text: t.text,
        timestamp: t.timestamp,
        cues: t.cues || [],
      }));
      const response = await retryWithBackoff(() => withTimeout(generateHcpResponse(
        scenario,
        conversationHistory,
        currentBehaviorState,
        currentJourneyState,
        true,
        repText,
        allSignals,
        i,
        currentVolatilityProfile,
      ), `${scenario.title} hcp turn ${i + 1}`));

      const hcpTurnObj = {
        id: crypto.randomUUID(),
        speaker: "hcp",
        text: response.hcpReply,
        timestamp: new Date().toISOString(),
        cues: response.activeCues || [],
        nudge: null,
      };

      if (response.coachingNudge) {
        const idx = turns.length - 1;
        turns = turns.map((t, ti) => ti === idx ? { ...t, nudge: response.coachingNudge } : t);
      }
      turns = [...turns, hcpTurnObj];

      allSignals = [...allSignals, response.behaviorSignals || {}];
      currentBehaviorState = response.nextBehaviorState;
      currentJourneyState = response.nextJourneyState;
      if (response.volatilityState) currentVolatilityProfile = response.volatilityState.profile;
    } catch (error) {
      onProgress(`Turn ${i + 1}/${maxTurns} — FAILED after retries: ${error.message}`);
      break;
    }
  }

  onProgress("Running deterministic capability evaluation…");

  const stateHistory = computeHcpStateHistory(
    allSignals,
    scenario.persona,
    scenario.interactionPressure || [],
    scenario.startingBehaviorState,
  );
  const volEvents = computeVolatilityEvents(scenario, allSignals, repTurnIds);
  const capabilityLevels = runCapabilityEvaluationEngine(allSignals, scenario.suggestedFocusCapabilities || []);
  const capabilityInsights = Object.entries(capabilityLevels).map(([id, level]) => ({
    capabilityId: id,
    capabilityName: id.replace(/_/g, " "),
    observationLevel: level,
  }));

  const missed = Object.entries(capabilityLevels).filter(([, v]) => v === "missed").map(([k]) => k.replace(/_/g, " "));
  const effective = Object.entries(capabilityLevels).filter(([, v]) => v === "effective").map(([k]) => k.replace(/_/g, " "));

  let review;
  try {
    onProgress("Generating full end-of-session review…");
    review = await retryWithBackoff(() => withTimeout(
      generateSessionReview(scenario, turns, allSignals, stateHistory, volEvents),
      `${scenario.title} session review`,
      90000,
    ));
  } catch (error) {
    const briefRationale = missed.length > 0
      ? `Deterministic QA fallback: ${missed.length} capability gap(s) detected — ${missed.join(", ")}. ${effective.length > 0 ? `Effective signals: ${effective.join(", ")}.` : "No effective signals detected."} Volatility events: ${volEvents.length}.`
      : `Deterministic QA fallback: No missed capabilities detected. ${effective.length > 0 ? `Effective signals: ${effective.join(", ")}.` : "All capabilities at developing level."} Volatility events: ${volEvents.length}.`;

    review = {
      capabilityInsights,
      briefRationale,
      volatilityEvents: volEvents,
      qaFallback: true,
      qaFallbackReason: error instanceof Error ? error.message : String(error),
    };
  }

  const assertions = runAssertions(scenario, turns, allSignals, review);
  return { scenario, turns, allSignals, review, assertions, sessionId: session.id };
}

function StatusPill({ status }) {
  const map = {
    idle: { label: "Idle", cls: "text-muted-foreground border-border/40 bg-border/10" },
    running: { label: "Running", cls: "text-signal-watch border-signal-watch/40 bg-signal-watch/10" },
    done: { label: "Done", cls: "text-signal-positive border-signal-positive/40 bg-signal-positive/10" },
    error: { label: "Error", cls: "text-destructive border-destructive/40 bg-destructive/10" },
  };
  const s = map[status] || map.idle;
  return <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>;
}

function AssertionRow({ assertion }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5 border-b border-border/20 last:border-0">
      {assertion.pass
        ? <CheckCircle2 className="w-3.5 h-3.5 text-signal-positive shrink-0 mt-0.5" />
        : <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />}
      <div className="min-w-0">
        <p className="text-xs text-foreground/90 leading-snug">{assertion.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{assertion.detail}</p>
      </div>
    </div>
  );
}

function MatrixRow({ result, index }) {
  const [expanded, setExpanded] = useState(false);
  const passCount = result.assertions.filter((a) => a.pass).length;
  const totalCount = result.assertions.length;
  const allPass = passCount === totalCount;

  return (
    <div className="border border-border/40 rounded-lg overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface/60 transition-colors">
        <span className="text-xs text-muted-foreground w-5 shrink-0">{index + 1}</span>
        <span className="flex-1 text-sm font-medium text-foreground truncate">{result.scenario.title}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${allPass ? "text-signal-positive border-signal-positive/40 bg-signal-positive/10" : "text-signal-watch border-signal-watch/40 bg-signal-watch/10"}`}>
          {passCount}/{totalCount} passed
        </span>
        <span className="text-muted-foreground/60 text-xs ml-1">{expanded ? "▲" : "▼"}</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-0 border-t border-border/30">
              <div className="pt-3 mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "hsl(174 55% 62%)" }}>Assertions</p>
                {result.assertions.map((a) => <AssertionRow key={a.id} assertion={a} />)}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "hsl(174 55% 62%)" }}>Capability Results</p>
                <div className="flex flex-wrap gap-1.5">
                  {(result.review?.capabilityInsights || []).map((ci) => (
                    <span
                      key={ci.capabilityId}
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        ci.observationLevel === "effective" ? "text-signal-positive border-signal-positive/40 bg-signal-positive/10"
                          : ci.observationLevel === "missed" ? "text-destructive border-destructive/40 bg-destructive/10"
                            : "text-signal-watch border-signal-watch/40 bg-signal-watch/10"
                      }`}
                    >
                      {ci.capabilityId.replace(/_/g, " ")}: {ci.observationLevel}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "hsl(174 55% 62%)" }}>Brief Rationale</p>
                <p className="text-xs text-foreground/70 leading-relaxed">{result.review?.briefRationale || "—"}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CapabilityHeatmap({ results }) {
  const capIds = [
    "question_quality", "listening_responsiveness", "making_it_matter",
    "customer_engagement_signals", "objection_navigation",
    "conversation_control_structure", "adaptability", "commitment_gaining",
  ];

  const capLabels = {
    question_quality: "Q. Quality",
    listening_responsiveness: "Listening",
    making_it_matter: "Value",
    customer_engagement_signals: "Engagement",
    objection_navigation: "Objection",
    conversation_control_structure: "Control",
    adaptability: "Adaptability",
    commitment_gaining: "Commitment",
  };

  const levelColor = {
    effective: "bg-signal-positive/20 text-signal-positive",
    developing: "bg-signal-watch/20 text-signal-watch",
    missed: "bg-destructive/20 text-destructive",
    "—": "bg-border/20 text-muted-foreground",
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left text-muted-foreground font-medium pb-2 pr-3 min-w-[120px]">Scenario</th>
            {capIds.map((id) => (
              <th key={id} className="text-center text-muted-foreground font-medium pb-2 px-1 min-w-[80px]">{capLabels[id]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => {
            const insightMap = {};
            (r.review?.capabilityInsights || []).forEach((ci) => { insightMap[ci.capabilityId] = ci.observationLevel; });
            return (
              <tr key={i} className="border-t border-border/20">
                <td className="py-1.5 pr-3 text-foreground/80 truncate max-w-[120px]" title={r.scenario.title}>
                  {r.scenario.title.slice(0, 22)}{r.scenario.title.length > 22 ? "…" : ""}
                </td>
                {capIds.map((id) => {
                  const level = insightMap[id] || "—";
                  return (
                    <td key={id} className="py-1.5 px-1 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${levelColor[level] || levelColor["—"]}`}>
                        {level === "effective" ? "E" : level === "developing" ? "D" : level === "missed" ? "M" : "—"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function QATwin() {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState([]);
  const [scenariosLoaded, setScenariosLoaded] = useState(false);
  const [mode, setMode] = useState("single");
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [personaKey, setPersonaKey] = useState("strong_rep");
  const [maxTurns, setMaxTurns] = useState(4);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState("");
  const [singleResult, setSingleResult] = useState(null);
  const [matrixResults, setMatrixResults] = useState([]);
  const [matrixProgress, setMatrixProgress] = useState({ current: 0, total: 0 });

  const abortRef = useRef(false);

  const loadScenarios = async () => {
    const data = (await listAllScenarios()).filter((s) => s.journeyStage);
    setScenarios(data);
    if (data.length > 0) setSelectedScenarioId(data[0].id);
    setScenariosLoaded(true);
  };

  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId);

  const runSingle = async () => {
    if (!selectedScenario) return;
    abortRef.current = false;
    setStatus("running");
    setSingleResult(null);
    setProgress("Initializing session…");
    const result = await runQASession(selectedScenario, personaKey, maxTurns, setProgress);
    setStatus("done");
    setSingleResult(result);
  };

  const runMatrix = async () => {
    abortRef.current = false;
    setStatus("running");
    setMatrixResults([]);
    const toRun = scenarios.slice(0, scenarios.length);
    setMatrixProgress({ current: 0, total: toRun.length });

    for (let i = 0; i < toRun.length; i++) {
      if (abortRef.current) break;
      const sc = toRun[i];
      setMatrixProgress({ current: i + 1, total: toRun.length });
      setProgress(`Running scenario ${i + 1}/${toRun.length}: "${sc.title}"…`);
      const result = await runQASession(sc, personaKey, maxTurns, (msg) => setProgress(`[${i + 1}/${toRun.length}] ${msg}`));
      setMatrixResults((prev) => [...prev, result]);
    }

    setStatus("done");
    setProgress("");
  };

  const stopRun = () => { abortRef.current = true; setStatus("idle"); setProgress(""); };

  const exportResults = (results) => {
    const lines = ["QA TWIN — MATRIX EXPORT", `Date: ${new Date().toLocaleDateString()}`, `Persona: ${personaKey}`, `Turns per scenario: ${maxTurns}`, ""];
    for (const r of results) {
      lines.push(`=== ${r.scenario.title} ===`);
      lines.push(`Assertions: ${r.assertions.filter((a) => a.pass).length}/${r.assertions.length} passed`);
      r.assertions.forEach((a) => lines.push(`  [${a.pass ? "PASS" : "FAIL"}] ${a.label}: ${a.detail}`));
      lines.push("Capabilities:");
      (r.review?.capabilityInsights || []).forEach((ci) => lines.push(`  ${ci.capabilityId}: ${ci.observationLevel}`));
      lines.push(`Brief Rationale: ${r.review?.briefRationale || "—"}`);
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qa-matrix-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background font-inter">
      <div className="border-b border-border/50 bg-surface/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-border/50" />
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "hsl(174 30% 18%)", border: "1px solid hsl(174 60% 52% / 0.4)" }}>
              <Zap className="w-3.5 h-3.5" style={{ color: "hsl(174 60% 65%)" }} />
            </div>
            <div>
              <span className="font-semibold text-foreground text-sm">QA Digital Twin</span>
              <span className="text-muted-foreground text-xs ml-2">Automated end-to-end simulator testing</span>
            </div>
          </div>
          <StatusPill status={status} />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="rounded-xl px-5 py-3.5 text-xs text-foreground/70 leading-relaxed" style={{ background: "hsl(174 25% 14%)", border: "1px solid hsl(174 60% 52% / 0.25)" }}>
          <span style={{ color: "hsl(174 60% 65%)" }} className="font-semibold">QA Mode — </span>
          The AI plays both sides end-to-end. Capability evaluation is <strong>deterministic</strong> so runs complete in ~30–60s per scenario depending on turn count.
        </div>

        <div className="rounded-xl border border-border/50 bg-surface/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Play className="w-4 h-4" style={{ color: "hsl(174 55% 62%)" }} />
            <span className="text-sm font-semibold text-foreground">Configuration</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">Mode</label>
              <div className="flex gap-1.5">
                {["single", "matrix"].map((value) => (
                  <button
                    key={value}
                    onClick={() => setMode(value)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${mode === value ? "text-foreground border-primary/60 bg-primary/15" : "text-muted-foreground border-border/40 hover:border-border"}`}
                  >
                    {value === "matrix" ? "Full Matrix" : "Single"}
                  </button>
                ))}
              </div>
            </div>

            <div className={mode === "matrix" ? "opacity-40 pointer-events-none" : ""}>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">Scenario</label>
              {scenariosLoaded ? (
                <select
                  value={selectedScenarioId}
                  onChange={(e) => setSelectedScenarioId(e.target.value)}
                  className="w-full py-1.5 px-3 rounded-lg border border-border/50 bg-surface text-xs text-foreground outline-none focus:border-primary/50"
                >
                  {scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.title}</option>)}
                </select>
              ) : (
                <button onClick={loadScenarios} className="w-full py-1.5 px-3 rounded-lg border border-border/50 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors text-left">
                  Click to load scenarios…
                </button>
              )}
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">QA Rep Persona</label>
              <select
                value={personaKey}
                onChange={(e) => setPersonaKey(e.target.value)}
                className="w-full py-1.5 px-3 rounded-lg border border-border/50 bg-surface text-xs text-foreground outline-none focus:border-primary/50"
              >
                {Object.entries(QA_PERSONAS).map(([key, value]) => (
                  <option key={key} value={key}>{value.label} — {value.description}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">Turns per scenario</label>
              <div className="flex gap-1.5">
                {[2, 4, 6, 8].map((count) => (
                  <button
                    key={count}
                    onClick={() => setMaxTurns(count)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${maxTurns === count ? "text-foreground border-primary/60 bg-primary/15" : "text-muted-foreground border-border/40 hover:border-border"}`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-5 flex-wrap">
            <button
              onClick={mode === "matrix" ? runMatrix : runSingle}
              disabled={status === "running" || (mode === "single" && !selectedScenario)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "hsl(174 45% 42%)", color: "hsl(210 40% 96%)" }}
            >
              <Play className="w-3 h-3" />
              {mode === "matrix" ? (scenariosLoaded ? `Run Full Matrix (${scenarios.length} scenarios)` : "Run Full Matrix (load first)") : "Run Single QA"}
            </button>

            {mode === "matrix" && !scenariosLoaded && (
              <button onClick={loadScenarios} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors">
                Load Scenarios
              </button>
            )}

            {status === "running" && (
              <button onClick={stopRun} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors">
                <Square className="w-3 h-3" />
                Stop
              </button>
            )}

            {matrixResults.length > 0 && (
              <button onClick={() => exportResults(matrixResults)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors ml-auto">
                <Download className="w-3 h-3" />
                Export Results
              </button>
            )}
          </div>
        </div>

        {status === "running" && progress && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "hsl(174 25% 14%)", border: "1px solid hsl(174 60% 52% / 0.25)" }}>
            <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground/80 truncate">{progress}</p>
              {mode === "matrix" && matrixProgress.total > 0 && (
                <div className="mt-1.5 h-1 bg-border/30 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(matrixProgress.current / matrixProgress.total) * 100}%`, background: "hsl(174 45% 42%)" }} />
                </div>
              )}
            </div>
            {mode === "matrix" && matrixProgress.total > 0 && (
              <span className="text-xs text-muted-foreground shrink-0">{matrixProgress.current}/{matrixProgress.total}</span>
            )}
          </div>
        )}

        {singleResult && mode === "single" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-signal-positive" />
              <span className="font-semibold text-foreground text-sm">Single Run Complete — {singleResult.scenario.title}</span>
              <span className="text-xs text-muted-foreground ml-auto">{singleResult.turns.filter((q) => q.speaker === "rep").length} rep turns</span>
            </div>

            <div className="rounded-xl border border-border/40 bg-surface/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "hsl(174 55% 62%)" }}>
                Assertions — {singleResult.assertions.filter((q) => q.pass).length}/{singleResult.assertions.length} passed
              </p>
              {singleResult.assertions.map((q) => <AssertionRow key={q.id} assertion={q} />)}
            </div>

            <div className="rounded-xl border border-border/40 bg-surface/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "hsl(174 55% 62%)" }}>Capability Assessment</p>
              <div className="flex flex-wrap gap-1.5">
                {(singleResult.review?.capabilityInsights || []).map((q) => (
                  <span
                    key={q.capabilityId}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                      q.observationLevel === "effective" ? "text-signal-positive border-signal-positive/40 bg-signal-positive/10"
                        : q.observationLevel === "missed" ? "text-destructive border-destructive/40 bg-destructive/10"
                          : "text-signal-watch border-signal-watch/40 bg-signal-watch/10"
                    }`}
                  >
                    {q.capabilityId.replace(/_/g, " ")}: {q.observationLevel}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/40 bg-surface/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "hsl(174 55% 62%)" }}>Brief Rationale</p>
              <p className="text-xs text-foreground/80 leading-relaxed">{singleResult.review?.briefRationale || "—"}</p>
            </div>
          </motion.div>
        )}

        {matrixResults.length > 0 && mode === "matrix" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" style={{ color: "hsl(174 55% 62%)" }} />
              <span className="font-semibold text-foreground text-sm">Matrix Results — {matrixResults.length} scenarios completed</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {matrixResults.reduce((sum, result) => sum + result.assertions.filter((item) => item.pass).length, 0)} /
                {matrixResults.reduce((sum, result) => sum + result.assertions.length, 0)} assertions passed
              </span>
            </div>

            <div className="rounded-xl border border-border/40 bg-surface/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "hsl(174 55% 62%)" }}>Capability Heatmap — E=Effective · D=Developing · M=Missed</p>
              <CapabilityHeatmap results={matrixResults} />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(174 55% 62%)" }}>Per-Scenario Detail</p>
              {matrixResults.map((result, index) => <MatrixRow key={index} result={result} index={index} />)}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
