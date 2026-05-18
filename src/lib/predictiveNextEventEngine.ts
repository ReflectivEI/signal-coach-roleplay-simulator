import { useEffect, useMemo, useRef, useState } from "react";

export type PredictedNextEventType =
  | "next_hcp_objection"
  | "sentiment_shift"
  | "access_escalation"
  | "compliance_risk"
  | "trust_degradation"
  | "conversation_stall"
  | "competitor_challenge"
  | "safety_concern_escalation";

export type PredictedNextEventSeverity = "low" | "moderate" | "high" | "critical";
export type PredictedNextEventTrajectory = "Stable" | "Recoverable" | "Escalating";

export interface PredictedEventEvidence {
  signal: string;
  detail: string;
  source: "transcript" | "persona" | "scenario" | "metrics" | "voice" | "history" | "compliance" | "message_library";
}

export interface PredictedEventImpactAxis {
  delta: number;
  state: "positive" | "neutral" | "negative";
  rationale: string;
}

export interface PredictedNextEvent {
  id: string;
  type: PredictedNextEventType;
  label: string;
  probability: number;
  timeHorizonSeconds: number;
  severity: PredictedNextEventSeverity;
  trajectory: PredictedNextEventTrajectory;
  evidence: PredictedEventEvidence[];
  recommendedStrategy: string;
  safestResponse: string;
  expectedImpact: {
    trust: PredictedEventImpactAxis;
    compliance: PredictedEventImpactAxis;
    objectionResolution: PredictedEventImpactAxis;
    closeEffectiveness: PredictedEventImpactAxis;
  };
}

export interface PredictiveNextEventInput {
  liveTranscript?: Array<{ speaker?: string; text?: string; timestamp?: string; [key: string]: unknown }>;
  hcpPersonaProfile?: Record<string, unknown> | null;
  scenarioMode?: string;
  currentMetricScores?: Record<string, number>;
  voiceAnalyticsSignals?: Record<string, unknown> | null;
  previousObjections?: string[];
  complianceRules?: string[];
  approvedMessagingLibrary?: string[];
  historicalInteractionOutcomes?: Array<Record<string, unknown>>;
  hcpPrediction?: Record<string, unknown> | null;
  majorTranscriptEventKey?: string;
}

export const mockPredictedNextEvents: PredictedNextEvent[] = [
  {
    id: "mock-access-escalation",
    type: "access_escalation",
    label: "HCP escalates access burden into staff bandwidth objection",
    probability: 0.78,
    timeHorizonSeconds: 18,
    severity: "high",
    trajectory: "Escalating",
    evidence: [
      { signal: "Prior authorization language", detail: "Recent HCP turn referenced approval friction and staff time.", source: "transcript" },
      { signal: "Operational pressure", detail: "Scenario mode is weighted toward access and implementation pressure.", source: "scenario" },
    ],
    recommendedStrategy: "Acknowledge the workflow burden first, then narrow to one concrete access support step.",
    safestResponse: "You are right to separate the clinical decision from the staff burden. The most compliant next step is to review the approved access support process and identify which step would reduce work for your team.",
    expectedImpact: {
      trust: { delta: 6, state: "positive", rationale: "Names the HCP's operating constraint before proposing support." },
      compliance: { delta: 4, state: "positive", rationale: "Stays inside approved access support language." },
      objectionResolution: { delta: 8, state: "positive", rationale: "Turns a broad access objection into a concrete process question." },
      closeEffectiveness: { delta: 5, state: "positive", rationale: "Creates a low-risk path to a next operational step." },
    },
  },
  {
    id: "mock-safety-escalation",
    type: "safety_concern_escalation",
    label: "Safety concern becomes a medical-information boundary test",
    probability: 0.64,
    timeHorizonSeconds: 24,
    severity: "critical",
    trajectory: "Recoverable",
    evidence: [
      { signal: "Safety terminology", detail: "Transcript contains adverse-event or hepatic-signal language.", source: "transcript" },
      { signal: "Compliance boundary", detail: "Approved response must route deeper medical questions to appropriate resources.", source: "compliance" },
    ],
    recommendedStrategy: "Validate the seriousness of the safety concern and move to approved safety language without improvising.",
    safestResponse: "That is an important safety question. I can stay with the approved safety information, and if you want case-level detail I should connect you with the appropriate medical resource.",
    expectedImpact: {
      trust: { delta: 4, state: "positive", rationale: "Treats the concern as legitimate." },
      compliance: { delta: 9, state: "positive", rationale: "Avoids off-label or case-specific interpretation." },
      objectionResolution: { delta: 3, state: "neutral", rationale: "Resolves the boundary before resolving the concern." },
      closeEffectiveness: { delta: -2, state: "negative", rationale: "May slow commercial progression while protecting the conversation." },
    },
  },
];

const EVENT_BASELINES: Record<PredictedNextEventType, Omit<PredictedNextEvent, "id" | "probability" | "timeHorizonSeconds" | "severity" | "trajectory" | "evidence" | "expectedImpact">> = {
  next_hcp_objection: {
    type: "next_hcp_objection",
    label: "HCP raises a sharper objection to the practical value claim",
    recommendedStrategy: "Reflect the objection, ask for the decision threshold, then answer with one approved proof point.",
    safestResponse: "That is a fair concern. Before I answer too broadly, what specific threshold would make this clinically useful for the patients you are thinking about?",
  },
  sentiment_shift: {
    type: "sentiment_shift",
    label: "HCP sentiment shifts from guarded to resistant",
    recommendedStrategy: "Slow down, acknowledge the shift, and reduce the ask to one clarifying question.",
    safestResponse: "I may be moving faster than this conversation allows. Let me pause and ask what part feels least useful right now.",
  },
  access_escalation: {
    type: "access_escalation",
    label: "Access concern escalates into formulary or prior authorization friction",
    recommendedStrategy: "Move from clinical value to approved access pathway clarification.",
    safestResponse: "Access is a real constraint. The safest next step is to stay with the approved access process and clarify what your team would need to know before considering it.",
  },
  compliance_risk: {
    type: "compliance_risk",
    label: "Conversation approaches a compliance-sensitive boundary",
    recommendedStrategy: "Return to approved language, avoid claims outside the messaging library, and offer the right resource.",
    safestResponse: "I want to keep this accurate and within approved information. I can speak to what is in the approved materials and route anything more specific to the appropriate resource.",
  },
  trust_degradation: {
    type: "trust_degradation",
    label: "Trust degrades because the rep is not addressing the stated concern",
    recommendedStrategy: "Name the missed concern and answer it directly before introducing any new point.",
    safestResponse: "You asked a more specific question than I answered. Let me address that directly before adding anything else.",
  },
  conversation_stall: {
    type: "conversation_stall",
    label: "Conversation stalls without a clear next step",
    recommendedStrategy: "Compress the conversation to the smallest useful next decision.",
    safestResponse: "To make this useful, we can narrow it to one next step: should we focus on patient fit, access process, or workflow impact?",
  },
  competitor_challenge: {
    type: "competitor_challenge",
    label: "HCP challenges differentiation against a familiar competitor",
    recommendedStrategy: "Avoid disparagement; ask what comparison matters and use approved differentiating language.",
    safestResponse: "I would not want to oversimplify that comparison. What matters most in your decision: patient fit, workflow, access, or the evidence you already trust?",
  },
  safety_concern_escalation: {
    type: "safety_concern_escalation",
    label: "Safety concern escalates and requires a careful medical boundary",
    recommendedStrategy: "Validate the safety concern and stay inside approved safety language.",
    safestResponse: "That is an important safety question. I can stay with the approved safety information, and if you want case-level detail I should connect you with the appropriate medical resource.",
  },
};

const ACCESS_INTERVENTION_RESPONSE = "You are right to separate the clinical decision from the staff burden. Let me keep this practical and stay with the approved access support process.";
const RECOVER_ACCESS_RESPONSES = [
  "You are right; I repeated the access-process frame without naming the step. The first approved support step to clarify is the coverage or benefits check, then we can map who on your team would handle that handoff.",
  "You are right; I kept access too broad. Let me make it concrete: start with the coverage or benefits check, then clarify who owns the handoff on your team.",
  "Let me correct that. The first approved access-support step is to verify coverage or benefits, then we can map the staff handoff instead of staying at a general process level.",
];

const severityWeight: Record<PredictedNextEventSeverity, number> = {
  low: 0.05,
  moderate: 0.12,
  high: 0.2,
  critical: 0.28,
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function scoreFromMetrics(metrics: Record<string, number> = {}, keys: string[], fallback = 3): number {
  const values = keys.map((key) => Number(metrics[key])).filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeText(value: unknown): string {
  return String(value || "").toLowerCase();
}

function transcriptText(input: PredictiveNextEventInput): string {
  return (input.liveTranscript || []).map((turn) => `${turn.speaker || ""}: ${turn.text || ""}`).join("\n");
}

function latestSpeakerText(input: PredictiveNextEventInput, speaker: string): string {
  const target = speaker.toLowerCase();
  const turns = input.liveTranscript || [];
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (normalizeText(turn?.speaker) === target) return String(turn?.text || "");
  }
  return "";
}

function recentSpeakerText(input: PredictiveNextEventInput, speaker: string, count = 3): string {
  const target = speaker.toLowerCase();
  return (input.liveTranscript || [])
    .filter((turn) => normalizeText(turn?.speaker) === target)
    .slice(-count)
    .map((turn) => String(turn?.text || ""))
    .join("\n");
}

function compactWords(value: string): string[] {
  return normalizeText(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4);
}

function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(compactWords(a));
  const wordsB = new Set(compactWords(b));
  if (!wordsA.size || !wordsB.size) return 0;
  let overlap = 0;
  wordsA.forEach((word) => {
    if (wordsB.has(word)) overlap += 1;
  });
  return overlap / Math.max(wordsA.size, wordsB.size);
}

function countRecentRecommendedUses(input: PredictiveNextEventInput, safestResponse: string): number {
  return (input.liveTranscript || [])
    .filter((turn) => normalizeText(turn?.speaker) === "rep")
    .slice(-3)
    .filter((turn) => textSimilarity(String(turn?.text || ""), safestResponse) >= 0.72)
    .length;
}

function selectRecoveryAccessResponse(input: PredictiveNextEventInput): string {
  const recentUses = (input.liveTranscript || [])
    .filter((turn) => normalizeText(turn?.speaker) === "rep")
    .slice(-8)
    .filter((turn) => RECOVER_ACCESS_RESPONSES.some((variant) => textSimilarity(String(turn?.text || ""), variant) >= 0.66))
    .length;
  return RECOVER_ACCESS_RESPONSES[recentUses % RECOVER_ACCESS_RESPONSES.length] || RECOVER_ACCESS_RESPONSES[0];
}

function includesAny(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

function buildEvidence(signal: string, detail: string, source: PredictedEventEvidence["source"]): PredictedEventEvidence {
  return { signal, detail, source };
}

function severityFromProbability(probability: number, complianceSensitive = false): PredictedNextEventSeverity {
  if (complianceSensitive && probability >= 0.56) return "critical";
  if (probability >= 0.76) return "high";
  if (probability >= 0.52) return "moderate";
  return "low";
}

function trajectoryFromSignals(probability: number, trustScore: number, listeningScore: number): PredictedNextEventTrajectory {
  if (probability >= 0.74 || trustScore <= 2.2 || listeningScore <= 2.2) return "Escalating";
  if (probability >= 0.52 || trustScore <= 3.2 || listeningScore <= 3.2) return "Recoverable";
  return "Stable";
}

function axis(delta: number, rationale: string): PredictedEventImpactAxis {
  return {
    delta,
    state: delta > 1 ? "positive" : delta < -1 ? "negative" : "neutral",
    rationale,
  };
}

export function calculateExpectedImpact(
  event: Pick<PredictedNextEvent, "type" | "probability" | "severity">,
  input: PredictiveNextEventInput = {},
): PredictedNextEvent["expectedImpact"] {
  const metrics = input.currentMetricScores || {};
  const listening = scoreFromMetrics(metrics, ["listening_responsiveness", "listening", "empathy_acknowledgment"]);
  const objection = scoreFromMetrics(metrics, ["objection_navigation", "objection_handling"]);
  const control = scoreFromMetrics(metrics, ["conversation_control_structure", "conversational_control"]);
  const commitment = scoreFromMetrics(metrics, ["commitment_gaining", "commitment_strength"]);
  const risk = event.severity === "critical" ? 1.35 : event.severity === "high" ? 1.15 : 1;
  const probabilityPenalty = Math.round(event.probability * 8 * risk);

  switch (event.type) {
    case "compliance_risk":
    case "safety_concern_escalation":
      return {
        trust: axis(Math.round((listening - 3) * 2), "Trust depends on acknowledging the risk without over-answering."),
        compliance: axis(9 - probabilityPenalty, "Approved language and routing protect the interaction."),
        objectionResolution: axis(Math.round((objection - 3) * 2), "The objection can progress after the boundary is handled."),
        closeEffectiveness: axis(-Math.max(2, probabilityPenalty - 3), "Commercial momentum slows while the compliant boundary is secured."),
      };
    case "trust_degradation":
    case "sentiment_shift":
      return {
        trust: axis(-probabilityPenalty, "Trust falls if the next reply misses the HCP's stated concern."),
        compliance: axis(2, "No direct compliance break, but pressure can create sloppy claims."),
        objectionResolution: axis(Math.round((objection - 3) * 2) - 3, "Resolution depends on recovering the exact concern."),
        closeEffectiveness: axis(Math.round((commitment - 3) * 2) - 4, "Close quality drops if the HCP becomes less open."),
      };
    case "conversation_stall":
      return {
        trust: axis(Math.round((listening - 3) * 2) - 1, "A stall is recoverable if the rep narrows the conversation."),
        compliance: axis(1, "Low direct compliance exposure."),
        objectionResolution: axis(Math.round((control - 3) * 2) - 2, "Structure is the main recovery lever."),
        closeEffectiveness: axis(-probabilityPenalty, "No explicit next step weakens commitment quality."),
      };
    default:
      return {
        trust: axis(Math.round((listening - 3) * 2) - 2, "Trust changes based on whether the next objection is heard accurately."),
        compliance: axis(event.type === "competitor_challenge" ? -1 : 1, "Use approved comparison language and avoid unsupported claims."),
        objectionResolution: axis(Math.round((objection - 3) * 2) - probabilityPenalty + 4, "Handling quality determines whether the objection sharpens or resolves."),
        closeEffectiveness: axis(Math.round((commitment - 3) * 2) - 2, "Clear next-step framing protects closing momentum."),
      };
  }
}

function eventScore(event: PredictedNextEvent): number {
  return event.probability + severityWeight[event.severity] + Math.max(0, 40 - event.timeHorizonSeconds) / 200;
}

export function rankPredictedEvents(events: PredictedNextEvent[]): PredictedNextEvent[] {
  return [...events].sort((a, b) => eventScore(b) - eventScore(a));
}

export function generatePredictedNextEvents(input: PredictiveNextEventInput = {}): PredictedNextEvent[] {
  const text = transcriptText(input);
  const normalized = normalizeText(text);
  const latestHcp = normalizeText(latestSpeakerText(input, "hcp"));
  const latestRep = normalizeText(latestSpeakerText(input, "rep"));
  const recentHcp = normalizeText(recentSpeakerText(input, "hcp", 3));
  const activeConcernText = [latestHcp, recentHcp].filter(Boolean).join(" ");
  const scenarioMode = normalizeText(input.scenarioMode);
  const persona = normalizeText(JSON.stringify(input.hcpPersonaProfile || {}));
  const hcpPrediction = input.hcpPrediction || {};
  const metrics = input.currentMetricScores || {};
  const voice = input.voiceAnalyticsSignals || {};
  const previousObjections = (input.previousObjections || []).join(" ").toLowerCase();
  const complianceRules = (input.complianceRules || []).join(" ").toLowerCase();
  const historyOutcomes = (input.historicalInteractionOutcomes || []).map((item) => JSON.stringify(item)).join(" ").toLowerCase();

  const listeningScore = scoreFromMetrics(metrics, ["listening_responsiveness", "listening", "empathy_acknowledgment"]);
  const objectionScore = scoreFromMetrics(metrics, ["objection_navigation", "objection_handling"]);
  const controlScore = scoreFromMetrics(metrics, ["conversation_control_structure", "conversational_control"]);
  const trustScore = scoreFromMetrics(metrics, ["customer_engagement_signals", "engagement", "context_awareness"]);
  const lowListening = listeningScore < 3;
  const lowObjection = objectionScore < 3;
  const lowControl = controlScore < 3;
  const speakingFast = Number(voice?.words_per_minute || voice?.wpm || 0) > 168;
  const fillers = Number(voice?.filler_word_count || voice?.fillers || 0);
  const concernFamily = normalizeText(hcpPrediction?.concernFamily || hcpPrediction?.concern_family);
  const riskLevel = normalizeText(hcpPrediction?.riskLevel || hcpPrediction?.risk_level);
  const activeOrPredictedConcern = [activeConcernText, concernFamily, previousObjections].join(" ");
  const transcriptContext = [normalized, scenarioMode, persona, complianceRules, historyOutcomes].join(" ");
  const activeSafety = includesAny(activeConcernText, /\b(safety|adverse|hepatic|renal|black box|warning|contraindication|side effect|ae\b|case-level|patient-specific)\b/);
  const activeAccess = includesAny(activeConcernText, /\b(access|prior auth|authorization|coverage|formulary|payer|copay|approval)\b/);
  const activeEvidence = includesAny(activeConcernText, /\b(data|evidence|trial|study|endpoint|subgroup|clinical|treatment decision|decision it changes)\b/);
  const activeStall = includesAny(latestHcp, /\b(stuck|same issue|not addressing|not answering|pause unless|stop here|still not|still waiting|does not address|didn't answer|narrow this|specific decision|not useful|first staff step|first step|point of contact|walk me through|what changes)\b/);
  const activeSpecificityDemand = includesAny(latestHcp, /\b(specific|specific data|specific decision|narrow this|patient decision|patients like mine|decision in front of me|what data|what specific|first staff step|first step|initial point|point of contact|walk me through|make a difference|alter .* workflow)\b/);
  const activeCompetitor = includesAny(activeConcernText, /\b(competitor|switch|current therapy|already using|patients do well|other option|standard of care)\b/);
  const latestRepUsedAnyRecommended = Object.values(EVENT_BASELINES).some((baseline) => textSimilarity(latestRep, baseline.safestResponse) >= 0.72);
  const latestRepRepeatedSafetyBoundary = textSimilarity(latestRep, EVENT_BASELINES.safety_concern_escalation.safestResponse) >= 0.72;
  const latestRepRepeatedComplianceBoundary = textSimilarity(latestRep, EVENT_BASELINES.compliance_risk.safestResponse) >= 0.72;
  const latestRepRepeatedAccessIntervention = textSimilarity(latestRep, ACCESS_INTERVENTION_RESPONSE) >= 0.62 || textSimilarity(latestRep, EVENT_BASELINES.access_escalation.safestResponse) >= 0.62;
  const repeatedBoundaryAfterSpecificAsk = activeStall && activeSpecificityDemand && (latestRepRepeatedSafetyBoundary || latestRepRepeatedComplianceBoundary);
  const repeatedAccessAfterSpecificAsk = activeStall && activeSpecificityDemand && latestRepRepeatedAccessIntervention;
  const repeatedInterventionAfterSpecificAsk = repeatedBoundaryAfterSpecificAsk || repeatedAccessAfterSpecificAsk;

  const staleRecommendationPenalty = (type: PredictedNextEventType, active = true): number => {
    const baseline = EVENT_BASELINES[type].safestResponse;
    const recentUses = countRecentRecommendedUses(input, baseline);
    if (!recentUses) return 0;
    const repeatedBoundaryPenalty = repeatedBoundaryAfterSpecificAsk && ["safety_concern_escalation", "compliance_risk"].includes(type) ? 0.32 : 0;
    const repeatedAccessPenalty = repeatedAccessAfterSpecificAsk && type === "access_escalation" ? 0.42 : 0;
    return (active ? 0.16 : 0.32) + Math.min(0.22, (recentUses - 1) * 0.1) + repeatedBoundaryPenalty + repeatedAccessPenalty;
  };

  const candidates: Array<{ type: PredictedNextEventType; probability: number; horizon: number; evidence: PredictedEventEvidence[]; compliance?: boolean }> = [
    {
      type: "access_escalation",
      probability: 0.31
        + (activeAccess ? 0.34 : 0)
        + (!activeAccess && /\b(access|prior auth|authorization|coverage|formulary|payer|copay)\b/.test(transcriptContext) ? 0.1 : 0)
        + (lowControl ? 0.12 : 0)
        + (riskLevel === "high" ? 0.08 : 0)
        - staleRecommendationPenalty("access_escalation", activeAccess)
        - (repeatedAccessAfterSpecificAsk ? 0.34 : 0),
      horizon: 16,
      evidence: [
        buildEvidence("Access pressure", activeAccess ? "The latest HCP concern is about access, coverage, payer, or approval friction." : "Access language is present in the broader conversation history.", "transcript"),
        buildEvidence("Control score", `Conversation control is ${controlScore.toFixed(1)} on the current metric snapshot.`, "metrics"),
      ],
    },
    {
      type: "compliance_risk",
      probability: 0.26
        + (/\b(off label|guarantee|safe for all|comparison|superior|head-to-head|case-level|unapproved)\b/.test(activeConcernText + complianceRules) ? 0.34 : 0)
        + (/\bcompetitor|switch|better than|versus|vs\.\b/.test(activeConcernText) ? 0.12 : 0)
        + (speakingFast ? 0.08 : 0)
        + (latestRepUsedAnyRecommended && activeStall ? 0.08 : 0)
        - (repeatedBoundaryAfterSpecificAsk ? 0.26 : 0),
      horizon: 12,
      compliance: true,
      evidence: [
        buildEvidence("Boundary language", "The transcript or rules contain comparison, case-level, or approved-claims boundary markers.", "compliance"),
        buildEvidence("Voice pressure", speakingFast ? "Voice pace suggests higher risk of over-answering." : "Voice pressure is currently within the expected range.", "voice"),
      ],
    },
    {
      type: "trust_degradation",
      probability: 0.28
        + (lowListening ? 0.24 : 0)
        + (riskLevel === "high" ? 0.14 : 0)
        + (activeStall ? 0.28 : 0)
        + (latestRepUsedAnyRecommended && activeStall ? 0.12 : 0)
        + (repeatedInterventionAfterSpecificAsk ? 0.28 : 0),
      horizon: 20,
      evidence: [
        buildEvidence("Listening alignment", `Listening responsiveness is ${listeningScore.toFixed(1)}.`, "metrics"),
        buildEvidence("HCP pressure", `Current HCP risk level is ${riskLevel || "not yet classified"}.`, "history"),
      ],
    },
    {
      type: "conversation_stall",
      probability: 0.25
        + (lowControl ? 0.22 : 0)
        + (/\b(maybe|later|send me|i'll think|not now|no next step|same issue|stuck)\b/.test(activeConcernText + historyOutcomes) ? 0.22 : 0)
        + (latestRepUsedAnyRecommended && activeStall ? 0.1 : 0)
        + (repeatedInterventionAfterSpecificAsk ? 0.22 : 0)
        + (fillers >= 4 ? 0.06 : 0),
      horizon: 28,
      evidence: [
        buildEvidence("Conversation control", `Control/structure score is ${controlScore.toFixed(1)}.`, "metrics"),
        buildEvidence("Commitment history", "Recent language indicates deferral or low next-step specificity.", "history"),
      ],
    },
    {
      type: "competitor_challenge",
      probability: 0.22
        + (activeCompetitor ? 0.34 : 0)
        + (!activeCompetitor && /\bcompetitor|switch|current therapy|what i'm already using|patients do well|other option|standard of care\b/.test(transcriptContext) ? 0.08 : 0)
        + (lowObjection ? 0.12 : 0),
      horizon: 24,
      evidence: [
        buildEvidence("Competitive frame", "Transcript or persona suggests loyalty to an incumbent option.", "persona"),
        buildEvidence("Objection handling", `Objection handling is ${objectionScore.toFixed(1)}.`, "metrics"),
      ],
    },
    {
      type: "safety_concern_escalation",
      probability: 0.2
        + (activeSafety ? 0.44 : 0)
        + (!activeSafety && /\b(safety|adverse|hepatic|renal|black box|warning|contraindication|side effect|ae\b|case)\b/.test(transcriptContext) ? 0.08 : 0)
        + (/\bmedical|mi|msl|case-level|patient-specific\b/.test(complianceRules + activeConcernText) ? 0.1 : 0)
        - staleRecommendationPenalty("safety_concern_escalation", activeSafety)
        - (repeatedBoundaryAfterSpecificAsk ? 0.28 : 0),
      horizon: 14,
      compliance: true,
      evidence: [
        buildEvidence("Safety marker", activeSafety ? "The latest HCP concern is still safety, adverse-event, or patient-specific wording." : "Safety wording is present in the broader conversation history but is not the latest active concern.", "transcript"),
        buildEvidence("Medical boundary", "Rules require approved safety language and medical-resource routing.", "compliance"),
      ],
    },
    {
      type: "sentiment_shift",
      probability: 0.24
        + (trustScore < 3 ? 0.2 : 0)
        + (speakingFast ? 0.08 : 0)
        + (/\bfrustrated|skeptical|not convinced|guarded|resistant|short on time\b/.test(normalized + persona + concernFamily) ? 0.22 : 0),
      horizon: 18,
      evidence: [
        buildEvidence("Engagement signal", `Customer engagement signal is ${trustScore.toFixed(1)}.`, "metrics"),
        buildEvidence("Sentiment markers", "Transcript/persona contains guarded, skeptical, or time-constrained language.", "persona"),
      ],
    },
    {
      type: "next_hcp_objection",
      probability: 0.36
        + (lowObjection ? 0.18 : 0)
        + (/\b(data|evidence|cost|workflow|access|patient fit|guideline|value|subgroup|endpoint|treatment decision)\b/.test(activeOrPredictedConcern) ? 0.24 : 0)
        + (activeEvidence ? 0.08 : 0)
        - staleRecommendationPenalty("next_hcp_objection", activeEvidence),
      horizon: 22,
      evidence: [
        buildEvidence("Open concern", "The conversation still contains unresolved value, evidence, workflow, access, or patient-fit language.", "transcript"),
        buildEvidence("Objection pattern", previousObjections || "Previous objections are still sparse, increasing uncertainty.", "history"),
      ],
    },
  ];

  return rankPredictedEvents(candidates.map((candidate, index) => {
    const probability = clamp(candidate.probability);
    const severity = severityFromProbability(probability, candidate.compliance);
    const loopRecoveryOverride = repeatedAccessAfterSpecificAsk && ["trust_degradation", "conversation_stall"].includes(candidate.type)
      ? {
        label: "HCP rejects repeated access framing and asks for the first concrete staff step",
        recommendedStrategy: "Acknowledge the repeated frame, then name the first approved access-support step instead of reusing broad process language.",
        safestResponse: selectRecoveryAccessResponse(input),
      }
      : {};
    const event = {
      ...EVENT_BASELINES[candidate.type],
      ...loopRecoveryOverride,
      id: `${candidate.type}-${index}`,
      probability,
      timeHorizonSeconds: candidate.horizon,
      severity,
      trajectory: trajectoryFromSignals(probability, trustScore, listeningScore),
      evidence: candidate.evidence,
      expectedImpact: {
        trust: axis(0, ""),
        compliance: axis(0, ""),
        objectionResolution: axis(0, ""),
        closeEffectiveness: axis(0, ""),
      },
    };
    return {
      ...event,
      expectedImpact: calculateExpectedImpact(event, input),
    };
  }));
}

export function createPredictiveNextEventTransport({
  url = "/api/predict-next-event",
  onPrediction,
  onError,
}: {
  url?: string;
  onPrediction: (events: PredictedNextEvent[]) => void;
  onError?: (error: unknown) => void;
}) {
  let eventSource: EventSource | null = null;
  let socket: WebSocket | null = null;

  return {
    connectSse() {
      if (typeof EventSource === "undefined") return false;
      eventSource = new EventSource(url);
      eventSource.onmessage = (message) => {
        try {
          const payload = JSON.parse(message.data);
          onPrediction(rankPredictedEvents(payload.predictions || payload.events || []));
        } catch (error) {
          onError?.(error);
        }
      };
      eventSource.onerror = (error) => onError?.(error);
      return true;
    },
    connectWebSocket(wsUrl = url.replace(/^http/, "ws")) {
      if (typeof WebSocket === "undefined") return false;
      socket = new WebSocket(wsUrl);
      socket.onmessage = (message) => {
        try {
          const payload = JSON.parse(String(message.data || "{}"));
          onPrediction(rankPredictedEvents(payload.predictions || payload.events || []));
        } catch (error) {
          onError?.(error);
        }
      };
      socket.onerror = (error) => onError?.(error);
      return true;
    },
    disconnect() {
      eventSource?.close();
      socket?.close();
      eventSource = null;
      socket = null;
    },
  };
}

export function createPredictiveNextEventSimulation({
  input,
  intervalMs = 3600,
  onPrediction,
}: {
  input: PredictiveNextEventInput;
  intervalMs?: number;
  onPrediction: (events: PredictedNextEvent[]) => void;
}) {
  let tick = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  const emit = () => {
    tick += 1;
    const events = generatePredictedNextEvents({
      ...input,
      majorTranscriptEventKey: `${input.majorTranscriptEventKey || "sim"}-${tick}`,
    }).map((event, index) => ({
      ...event,
      probability: clamp(event.probability + Math.sin((tick + index) / 2.4) * 0.035),
    }));
    onPrediction(rankPredictedEvents(events));
  };

  return {
    start() {
      emit();
      timer = setInterval(emit, intervalMs);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

export function usePredictiveNextEventEngine(input: PredictiveNextEventInput = {}) {
  const [events, setEvents] = useState<PredictedNextEvent[]>(() => generatePredictedNextEvents(input));
  const previousPrimaryRef = useRef<PredictedNextEvent | null>(events[0] || null);
  const serializedInput = useMemo(() => JSON.stringify({
    liveTranscript: input.liveTranscript?.map((turn) => [turn.speaker, turn.text]).slice(-8),
    scenarioMode: input.scenarioMode,
    currentMetricScores: input.currentMetricScores,
    voiceAnalyticsSignals: input.voiceAnalyticsSignals,
    previousObjections: input.previousObjections,
    hcpPrediction: input.hcpPrediction,
    majorTranscriptEventKey: input.majorTranscriptEventKey,
  }), [input]);

  useEffect(() => {
    setEvents(generatePredictedNextEvents(input));
  }, [serializedInput]);

  useEffect(() => {
    const simulation = createPredictiveNextEventSimulation({
      input,
      onPrediction: setEvents,
    });
    simulation.start();
    return () => simulation.stop();
  }, [serializedInput]);

  useEffect(() => {
    previousPrimaryRef.current = events[0] || null;
  }, [events]);

  return {
    predictions: events,
    primaryPrediction: events[0] || null,
    previousPrimaryPrediction: previousPrimaryRef.current,
    refreshPredictions: () => setEvents(generatePredictedNextEvents(input)),
  };
}
