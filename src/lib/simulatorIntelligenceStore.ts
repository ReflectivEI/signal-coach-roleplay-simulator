import { useEffect, useMemo, useReducer } from "react";

export type TrajectoryState =
  | "stable"
  | "recoverable"
  | "fragile"
  | "escalating"
  | "stabilizing"
  | "deteriorating"
  | "trust_recovery"
  | "compliance_sensitive"
  | "disengaging"
  | "improving";

export type TrajectoryDirection = "improving" | "worsening" | "holding" | "compliance_boundary" | "recovery";

export type TransitionCause =
  | "rep_acknowledged_pressure"
  | "rep_missed_signal"
  | "voice_pressure_changed"
  | "compliance_boundary_near"
  | "hcp_objection_sharpened"
  | "specificity_improved"
  | "engagement_weakened"
  | "realism_pressure_changed";

export interface TrajectoryTransition {
  id: string;
  previousState: TrajectoryState;
  currentState: TrajectoryState;
  direction: TrajectoryDirection;
  cause: TransitionCause;
  explanation: string;
  confidenceLanguage: "early signal" | "moderate confidence" | "strong signal";
  detectedAt: string;
}

export interface PredictiveChainStep {
  label: string;
  eventType: string;
  probabilityBand: "low" | "moderate" | "high" | "very_high";
  expectedTimeframe: string;
  riskLevel: "low" | "moderate" | "high" | "critical";
  whyLikely: string;
  suggestedPreparation: string;
}

export interface ChainIntervention {
  label: string;
  rationale: string;
  safestResponse: string;
}

export type ChainRisk = "contained" | "watch" | "elevated" | "critical";
export type ChainTrigger = "access_pressure" | "evidence_scrutiny" | "voice_pressure" | "compliance_boundary" | "competitor_anchor" | "conversation_stall";

export interface PredictiveChain {
  id: string;
  trajectoryContext: TrajectoryState;
  chainLabel: string;
  trigger: ChainTrigger;
  risk: ChainRisk;
  confidenceLanguage: "emerging" | "likely" | "strongly indicated";
  steps: PredictiveChainStep[];
  intervention: ChainIntervention;
  whyThisChain: string;
}

export interface HCPPostureSignal {
  label: string;
  evidence: string;
  source: "transcript" | "voice" | "metric" | "scenario" | "prediction";
}

export interface HCPPosture {
  id: string;
  label: string;
  description: string;
  observableSignals: HCPPostureSignal[];
  riskImplication: string;
  recommendedRepBehavior: string;
  prohibitedRepBehavior: string;
  complianceSensitivity: "low" | "moderate" | "high" | "critical";
  reallyTesting: string;
}

export interface HCPPostureShift {
  previousPosture: string;
  currentPosture: string;
  explanation: string;
  detectedAt: string;
}

export type PressureLevel = "low" | "moderate" | "high" | "critical";

export interface PressureSignal {
  id: string;
  label: string;
  level: PressureLevel;
  source: "voice" | "transcript" | "prediction" | "compliance" | "scenario";
  explanation: string;
}

export interface PressureVisualizationState {
  pulseIntensity: "calm" | "active" | "tense" | "critical";
  waveformInstability: "steady" | "variable" | "unstable";
  responseWindow: "open" | "narrowing" | "compressed";
  ambientState: "neutral" | "pressure" | "boundary";
  timelineTicks: PressureSignal[];
}

export interface RealismDimension {
  id: string;
  label: string;
  qualitativeState: "low" | "moderate" | "elevated" | "intense";
  driver: string;
  repFacingSignal: string;
  adminValue: number;
}

export type RealismMode = "balanced_resistance" | "clinical_scrutiny" | "access_pressure" | "time_compressed" | "competitive_defense";

export interface RealismProfile {
  mode: RealismMode;
  modeLabel: string;
  activeDimensions: RealismDimension[];
  behaviorDriver: string;
  adaptationSummary: string;
  interpretation: string;
}

export interface RealismAdjustment {
  dimensionId: string;
  previousState: string;
  currentState: string;
  reason: string;
}

export type SimulatorIntelligenceEventType =
  | "transcript_updated"
  | "rep_response_submitted"
  | "hcp_response_generated"
  | "voice_signal_detected"
  | "compliance_boundary_detected"
  | "posture_shift_detected"
  | "trajectory_transition_detected"
  | "pressure_signal_updated"
  | "predictive_chain_updated"
  | "realism_profile_updated";

export interface SimulatorIntelligenceEvent {
  id: string;
  type: SimulatorIntelligenceEventType;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface SimulatorIntelligenceInput {
  turns?: Array<{ id?: string; speaker?: string; text?: string; timestamp?: string }>;
  lastSignals?: Record<string, unknown>;
  hcpPrediction?: Record<string, unknown> | null;
  voiceMetadata?: Record<string, unknown> | null;
  voiceTelemetry?: Record<string, unknown> | null;
  coachShadow?: Record<string, unknown> | null;
  realism?: number;
  adminMode?: boolean;
}

export interface SimulatorIntelligenceState {
  events: SimulatorIntelligenceEvent[];
  trajectoryTransition: TrajectoryTransition;
  predictiveChain: PredictiveChain;
  hcpPosture: HCPPosture;
  postureShift: HCPPostureShift | null;
  pressureState: PressureVisualizationState;
  realismProfile: RealismProfile;
}

function now(): string {
  return new Date().toISOString();
}

function hashId(prefix: string, value = ""): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function textFromTurns(turns: SimulatorIntelligenceInput["turns"] = []): string {
  return turns.map((turn) => `${turn.speaker || ""}: ${turn.text || ""}`).join("\n").toLowerCase();
}

function latestHcpText(turns: SimulatorIntelligenceInput["turns"] = []): string {
  return [...turns].reverse().find((turn) => turn.speaker === "hcp")?.text?.toLowerCase() || "";
}

function latestRepText(turns: SimulatorIntelligenceInput["turns"] = []): string {
  return [...turns].reverse().find((turn) => turn.speaker === "rep")?.text?.toLowerCase() || "";
}

function activeExchangeText(turns: SimulatorIntelligenceInput["turns"] = []): string {
  const latestHcp = latestHcpText(turns);
  const latestRep = latestRepText(turns);
  return `${latestHcp} ${latestRep}`.toLowerCase();
}

function hasSafetyTopic(text = ""): boolean {
  return /\b(safety|adverse|hepatic|renal|warning|side effect|medical|monitoring|case-level)\b/.test(text);
}

function hasEvidenceTopic(text = ""): boolean {
  return /\b(data|evidence|trial|study|guideline|hazard ratio|subgroup|endpoint|treatment decision|patient decision|decision that changes|clinically useful|applies to my patients)\b/.test(text);
}

function hasAccessTopic(text = ""): boolean {
  return /\b(prior auth|authorization|coverage|formulary|payer|access|approval|reimbursement|covered)\b/.test(text);
}

function hasTimeTopic(text = ""): boolean {
  return /\b(few minutes|quick|brief|next patient|short on time)\b/.test(text);
}

function hasSpecificityBoundary(text = ""): boolean {
  return /\b(specific|what exactly|not my question|generic|prove|show me|not useful|probably done|pause here|not ready|cannot make this specific|we should pause|still waiting|same issue|stuck|narrow this)\b/.test(text);
}

function compactWords(value = ""): string[] {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4);
}

function textSimilarity(a = "", b = ""): number {
  const wordsA = new Set(compactWords(a));
  const wordsB = new Set(compactWords(b));
  if (!wordsA.size || !wordsB.size) return 0;
  let overlap = 0;
  wordsA.forEach((word) => {
    if (wordsB.has(word)) overlap += 1;
  });
  return overlap / Math.max(wordsA.size, wordsB.size);
}

const SAFETY_BOUNDARY_RESPONSE = "That is an important safety question. I can stay with the approved safety information, and if you want case-level detail I should connect you with the appropriate medical resource.";
const COMPLIANCE_BOUNDARY_RESPONSE = "I want to keep this accurate and within approved information. I can speak to what is in the approved materials and route anything more specific to the appropriate resource.";

function latestRepRepeatedBoundary(turns: SimulatorIntelligenceInput["turns"] = []): boolean {
  const latestRep = latestRepText(turns);
  return textSimilarity(latestRep, SAFETY_BOUNDARY_RESPONSE) >= 0.72
    || textSimilarity(latestRep, COMPLIANCE_BOUNDARY_RESPONSE) >= 0.72;
}

function pressureFromSignals(input: SimulatorIntelligenceInput): PressureSignal[] {
  const text = textFromTurns(input.turns);
  const hcp = latestHcpText(input.turns);
  const rep = latestRepText(input.turns);
  const voice = input.voiceMetadata || input.voiceTelemetry || {};
  const prediction = input.hcpPrediction || {};
  const signals: PressureSignal[] = [];

  const active = activeExchangeText(input.turns);
  const activeSafety = hasSafetyTopic(active);
  const activeEvidence = hasEvidenceTopic(active);
  const activeAccess = hasAccessTopic(active);

  if (activeAccess || (hasAccessTopic(text) && !activeSafety && !activeEvidence)) {
    signals.push({
      id: "pressure-access",
      label: "Access objection pressure",
      level: "high",
      source: activeAccess ? "transcript" : "scenario",
      explanation: activeAccess
        ? "Access language is active in the current exchange, so the HCP may test operational practicality before accepting value claims."
        : "Access language appeared earlier, but it is not the dominant current ask.",
    });
  }

  if (activeSafety || (hasSafetyTopic(text) && !activeAccess && !activeEvidence)) {
    signals.push({
      id: "pressure-compliance",
      label: "Compliance boundary pressure active",
      level: "critical",
      source: "compliance",
      explanation: "Safety or medical-detail language requires approved information or appropriate resource routing.",
    });
  }

  if (/\b(no|not convinced|generic|show me|specific|what exactly|prove|data)\b/.test(hcp)) {
    signals.push({
      id: "pressure-skepticism",
      label: "Skepticism pressure rising",
      level: "high",
      source: "prediction",
      explanation: "The HCP is asking for specificity or proof, which narrows tolerance for broad claims.",
    });
  }

  if (hasTimeTopic(active) || hasTimeTopic(text)) {
    signals.push({
      id: "pressure-time",
      label: "Response window narrowing",
      level: "moderate",
      source: "scenario",
      explanation: "Time-constrained language means the next response must be concise and practical.",
    });
  }

  const wpm = Number(voice.words_per_minute || voice.pacingWordsPerMinute || 0);
  const fillers = Number(voice.filler_word_count || voice.fillerWordCount || 0);
  if (wpm > 175 || fillers >= 3 || /\b(um|uh|like|you know)\b/.test(rep)) {
    signals.push({
      id: "pressure-voice",
      label: "Hesitation pressure detected",
      level: wpm > 195 ? "critical" : "moderate",
      source: "voice",
      explanation: "Voice behavior suggests delivery pressure that may affect credibility.",
    });
  }

  if (String(prediction.riskLevel || "").toLowerCase() === "high") {
    signals.push({
      id: "pressure-prediction",
      label: "Engagement tension increasing",
      level: "high",
      source: "prediction",
      explanation: "The predictive layer indicates elevated HCP resistance or reduced openness.",
    });
  }

  return signals.length ? signals : [{
    id: "pressure-calm",
    label: "Engagement pressure contained",
    level: "low",
    source: "prediction",
    explanation: "No major pressure signal is dominating the current exchange.",
  }];
}

export function buildPressureVisualizationState(input: SimulatorIntelligenceInput): PressureVisualizationState {
  const signals = pressureFromSignals(input);
  const hasCritical = signals.some((signal) => signal.level === "critical");
  const hasHigh = signals.some((signal) => signal.level === "high");
  const pressureCount = signals.filter((signal) => signal.level !== "low").length;

  return {
    pulseIntensity: hasCritical ? "critical" : hasHigh ? "tense" : pressureCount ? "active" : "calm",
    waveformInstability: hasCritical || pressureCount >= 3 ? "unstable" : pressureCount >= 1 ? "variable" : "steady",
    responseWindow: hasCritical || pressureCount >= 3 ? "compressed" : pressureCount >= 1 ? "narrowing" : "open",
    ambientState: hasCritical ? "boundary" : pressureCount ? "pressure" : "neutral",
    timelineTicks: signals.slice(0, 5),
  };
}

export function inferHcpPosture(input: SimulatorIntelligenceInput): HCPPosture {
  const text = textFromTurns(input.turns);
  const hcp = latestHcpText(input.turns);
  const active = activeExchangeText(input.turns);
  const prediction = input.hcpPrediction || {};

  const base = {
    observableSignals: [] as HCPPostureSignal[],
    complianceSensitivity: "moderate" as HCPPosture["complianceSensitivity"],
  };

  if (hasSafetyTopic(hcp) || hasSafetyTopic(active)) {
    return {
      id: "safety-evidence-boundary",
      label: "Safety evidence boundary",
      description: "The HCP is testing whether the rep can stay within approved safety information while making the evidence relevant to a patient decision.",
      observableSignals: [
        { label: "Safety signal", evidence: "The current HCP ask contains safety, hepatic, adverse-event, monitoring, or medical-detail language.", source: "transcript" },
      ],
      riskImplication: "Improvised case-level interpretation can create compliance risk and reduce trust.",
      recommendedRepBehavior: "Acknowledge the safety concern, stay with approved safety information, and connect case-level detail to the appropriate medical resource.",
      prohibitedRepBehavior: "Do not interpret patient-specific safety risk, add off-label monitoring advice, or expand beyond approved materials.",
      complianceSensitivity: "critical",
      reallyTesting: "Whether the rep can handle a safety-specific evidence question without overstepping.",
    };
  }

  if (hasEvidenceTopic(hcp) || (hasEvidenceTopic(active) && !hasAccessTopic(hcp))) {
    return {
      id: "evidence-scrutiny",
      label: "Evidence scrutiny",
      description: "The HCP is testing whether the rep can connect evidence to a specific clinical decision threshold.",
      observableSignals: [
        { label: "Evidence challenge", evidence: "The current HCP ask contains data, study, endpoint, subgroup, or treatment-decision language.", source: "transcript" },
      ],
      riskImplication: "Generalized value language will likely increase skepticism.",
      recommendedRepBehavior: "Answer the exact evidence threshold or ask which approved proof point would change the decision.",
      prohibitedRepBehavior: "Do not overstate evidence, extrapolate beyond label, or imply unsupported superiority.",
      complianceSensitivity: "high",
      reallyTesting: "Whether the rep can be precise without expanding claims.",
    };
  }

  if (hasAccessTopic(hcp) || (hasAccessTopic(active) && !hasEvidenceTopic(hcp))) {
    return {
      id: "access-frustrated",
      label: "Access-frustrated",
      description: "The HCP is evaluating whether the conversation solves a practical access or reimbursement burden.",
      observableSignals: [
        { label: "Access language", evidence: "The current HCP ask contains coverage, prior authorization, payer, approval, or formulary language.", source: "transcript" },
      ],
      riskImplication: "Broad clinical claims may miss the actual barrier.",
      recommendedRepBehavior: "Acknowledge access burden, then clarify one approved support pathway.",
      prohibitedRepBehavior: "Do not promise coverage, speed, payer outcomes, or guaranteed patient access.",
      complianceSensitivity: "high",
      reallyTesting: "Whether the rep understands operational access friction without overpromising.",
    };
  }

  if (/\b(competitor|switch|already using|current therapy|standard of care|patients do well)\b/.test(hcp) || /\b(competitor|switch|already using|current therapy|standard of care|patients do well)\b/.test(active)) {
    return {
      id: "competitor-anchored",
      label: "Competitor anchored",
      description: "The HCP is anchored to an incumbent option and is testing differentiated relevance.",
      observableSignals: [
        { label: "Incumbent preference", evidence: "Competitor, switching, or current-therapy language is active in the current exchange.", source: "transcript" },
      ],
      riskImplication: "Comparative claims can create compliance and credibility risk.",
      recommendedRepBehavior: "Ask what comparison matters and stay with approved differentiating language.",
      prohibitedRepBehavior: "Do not disparage competitor products or make unsupported head-to-head claims.",
      complianceSensitivity: "high",
      reallyTesting: "Whether the rep can differentiate without sounding promotional or unsupported.",
    };
  }

  if (hasTimeTopic(hcp) || hasTimeTopic(active)) {
    return {
      id: "time-constrained-skepticism",
      label: "Time-constrained skepticism",
      description: "The HCP is limiting the response window and testing whether the rep can be immediately relevant.",
      observableSignals: [
        { label: "Time constraint", evidence: "The current exchange includes brief-visit or next-patient pressure.", source: "transcript" },
      ],
      riskImplication: "Long setup language may cause disengagement.",
      recommendedRepBehavior: "Use one concise acknowledgment and one practical point.",
      prohibitedRepBehavior: "Do not use long preambles or broad educational framing.",
      complianceSensitivity: "moderate",
      reallyTesting: "Whether the rep can be useful within a compressed window.",
    };
  }

  if (hasSpecificityBoundary(hcp)) {
    return {
      id: "waiting-for-specificity",
      label: "Waiting for specificity",
      description: "The HCP is withholding progress until the rep answers the exact concern.",
      observableSignals: [
        { label: "Specificity demand", evidence: "The latest HCP turn asks for exactness or rejects generalization.", source: "transcript" },
      ],
      riskImplication: "Additional broad messaging may degrade trust.",
      recommendedRepBehavior: "Answer the exact concern before introducing any new point.",
      prohibitedRepBehavior: "Do not pivot to another product point before resolving the stated concern.",
      complianceSensitivity: "moderate",
      reallyTesting: "Whether the rep can listen and adapt instead of continuing the planned message.",
    };
  }

  return {
    id: String(prediction.concernFamily || "testing-relevance"),
    label: "Testing relevance",
    description: "The HCP is evaluating whether the rep can connect the discussion to their actual prescribing context rather than deliver generalized value claims.",
    observableSignals: [
      { label: "Predictive concern", evidence: String(prediction.concernFamily || "Current concern is still forming."), source: "prediction" },
      ...base.observableSignals,
    ],
    riskImplication: "The conversation can remain productive if the rep earns relevance quickly.",
    recommendedRepBehavior: "Ask one clarifying question before offering product-specific information.",
    prohibitedRepBehavior: "Do not lead with generic value claims or broad promotional framing.",
    complianceSensitivity: base.complianceSensitivity,
    reallyTesting: "Whether the rep can make the next move relevant and specific.",
  };
}

export function detectTrajectoryTransition(input: SimulatorIntelligenceInput, previousState: TrajectoryState = "recoverable"): TrajectoryTransition {
  const pressure = buildPressureVisualizationState(input);
  const posture = inferHcpPosture(input);
  const rep = latestRepText(input.turns);
  const prediction = input.hcpPrediction || {};
  const acknowledged = /\b(i hear|fair|understand|you're right|that makes sense|you asked)\b/.test(rep);
  const specific = /\b(specific|threshold|which|what would|before i answer|one step|approved)\b/.test(rep);
  const risk = String(prediction.riskLevel || "").toLowerCase();

  let currentState: TrajectoryState = "recoverable";
  let direction: TrajectoryDirection = "holding";
  let cause: TransitionCause = "realism_pressure_changed";
  let explanation = "Conversation movement is holding while the next HCP signal forms.";

  if (pressure.ambientState === "boundary") {
    currentState = "compliance_sensitive";
    direction = "compliance_boundary";
    cause = "compliance_boundary_near";
    explanation = "Compliance boundary approaching because safety, medical, or approved-claim pressure is active.";
  } else if (acknowledged && specific) {
    currentState = "stabilizing";
    direction = "recovery";
    cause = "rep_acknowledged_pressure";
    explanation = "Trust recovery detected after the rep acknowledged pressure and returned to a specific, approved path.";
  } else if (acknowledged) {
    currentState = "trust_recovery";
    direction = "improving";
    cause = "rep_acknowledged_pressure";
    explanation = "Trust recovery detected because the rep acknowledged the HCP signal before moving forward.";
  } else if (risk === "high" || pressure.pulseIntensity === "tense") {
    currentState = posture.complianceSensitivity === "high" ? "fragile" : "escalating";
    direction = "worsening";
    cause = "hcp_objection_sharpened";
    explanation = "Pressure increasing because the HCP posture is narrowing tolerance for broad or unsupported responses.";
  } else if (specific) {
    currentState = "improving";
    direction = "improving";
    cause = "specificity_improved";
    explanation = "Relevance improving because the rep is moving toward specificity instead of generalized claims.";
  } else if (pressure.responseWindow === "compressed") {
    currentState = "deteriorating";
    direction = "worsening";
    cause = "engagement_weakened";
    explanation = "Conversation destabilizing because the response window is compressed and pressure signals are accumulating.";
  }

  return {
    id: hashId("trajectory", `${previousState}-${currentState}-${explanation}`),
    previousState,
    currentState,
    direction,
    cause,
    explanation,
    confidenceLanguage: direction === "holding" ? "early signal" : direction === "compliance_boundary" ? "strong signal" : "moderate confidence",
    detectedAt: now(),
  };
}

export function generatePredictiveChain(input: SimulatorIntelligenceInput, trajectory: TrajectoryTransition): PredictiveChain {
  const text = textFromTurns(input.turns);
  const posture = inferHcpPosture(input);
  const active = activeExchangeText(input.turns);
  const activeSafety = hasSafetyTopic(active);
  const activeEvidence = hasEvidenceTopic(active);
  const activeAccess = hasAccessTopic(active);
  const access = activeAccess || (hasAccessTopic(text) && !activeSafety && !activeEvidence);
  const safety = activeSafety || (hasSafetyTopic(text) && !activeAccess && !activeEvidence);
  const competitor = /\b(competitor|switch|already using|current therapy)\b/.test(active) || /\b(competitor|switch|already using|current therapy)\b/.test(text);
  const evidence = activeEvidence || (hasEvidenceTopic(text) && !activeAccess);

  const trigger: ChainTrigger = safety
    ? "compliance_boundary"
    : access
      ? "access_pressure"
      : competitor
        ? "competitor_anchor"
        : evidence
          ? "evidence_scrutiny"
          : trajectory.currentState === "deteriorating"
            ? "conversation_stall"
            : "voice_pressure";

  const templates: Record<ChainTrigger, PredictiveChainStep[]> = {
    access_pressure: [
      { label: "Access objection", eventType: "access_escalation", probabilityBand: "high", expectedTimeframe: "next 1-2 turns", riskLevel: "high", whyLikely: "Access language is active and practical burden is likely to become the decisive barrier.", suggestedPreparation: "Prepare approved access support language without promising outcomes." },
      { label: "Skepticism escalation", eventType: "trust_degradation", probabilityBand: "moderate", expectedTimeframe: "2-3 turns", riskLevel: "moderate", whyLikely: "If the access issue is not acknowledged, the HCP may interpret clinical points as evasive.", suggestedPreparation: "Acknowledge burden before value framing." },
      { label: "Compliance-sensitive comparison request", eventType: "compliance_risk", probabilityBand: "moderate", expectedTimeframe: "3 turns", riskLevel: "high", whyLikely: "Access frustration often turns into comparison or payer-process pressure.", suggestedPreparation: "Stay within approved differentiation and process language." },
    ],
    evidence_scrutiny: [
      { label: "Evidence threshold demand", eventType: "next_hcp_objection", probabilityBand: "high", expectedTimeframe: "next turn", riskLevel: "moderate", whyLikely: "The HCP is testing whether evidence applies to their patient context.", suggestedPreparation: "Ask which proof point would change the decision." },
      { label: "Subgroup fit challenge", eventType: "competitor_challenge", probabilityBand: "moderate", expectedTimeframe: "2 turns", riskLevel: "high", whyLikely: "Evidence scrutiny often narrows into patient-fit or comparator pressure.", suggestedPreparation: "Use approved evidence boundaries and avoid extrapolation." },
      { label: "Medical detail boundary", eventType: "compliance_risk", probabilityBand: "moderate", expectedTimeframe: "2-3 turns", riskLevel: "high", whyLikely: "The HCP may request case-level or off-label interpretation.", suggestedPreparation: "Prepare medical-resource routing language." },
    ],
    compliance_boundary: [
      { label: "Safety clarification", eventType: "safety_concern_escalation", probabilityBand: "very_high", expectedTimeframe: "immediate", riskLevel: "critical", whyLikely: "Safety or medical language is already present.", suggestedPreparation: "Use approved safety language and route case-level questions." },
      { label: "Case-specific follow-up", eventType: "compliance_risk", probabilityBand: "high", expectedTimeframe: "next turn", riskLevel: "critical", whyLikely: "The HCP may ask for patient-specific interpretation.", suggestedPreparation: "Avoid improvising beyond approved material." },
      { label: "Trust test", eventType: "trust_degradation", probabilityBand: "moderate", expectedTimeframe: "2 turns", riskLevel: "high", whyLikely: "How the boundary is handled will affect credibility.", suggestedPreparation: "Be direct about what can and cannot be answered." },
    ],
    competitor_anchor: [
      { label: "Comparison challenge", eventType: "competitor_challenge", probabilityBand: "high", expectedTimeframe: "next 1-2 turns", riskLevel: "high", whyLikely: "The HCP is anchored to an incumbent option.", suggestedPreparation: "Ask what comparison matters before differentiating." },
      { label: "Evidence scrutiny", eventType: "next_hcp_objection", probabilityBand: "moderate", expectedTimeframe: "2 turns", riskLevel: "moderate", whyLikely: "Comparator pressure often becomes evidence pressure.", suggestedPreparation: "Use approved non-disparaging differentiation." },
      { label: "Switching resistance", eventType: "conversation_stall", probabilityBand: "moderate", expectedTimeframe: "3 turns", riskLevel: "moderate", whyLikely: "If differentiation is unclear, the HCP may stay with current behavior.", suggestedPreparation: "Identify the smallest patient-fit scenario." },
    ],
    voice_pressure: [
      { label: "Delivery credibility test", eventType: "confidence_drop", probabilityBand: "moderate", expectedTimeframe: "current response", riskLevel: "moderate", whyLikely: "Voice pressure may make the next response sound less composed.", suggestedPreparation: "Slow the first sentence and acknowledge the concern." },
      { label: "Objection sharpens", eventType: "next_hcp_objection", probabilityBand: "moderate", expectedTimeframe: "next turn", riskLevel: "moderate", whyLikely: "A rushed or hesitant response can invite a sharper HCP test.", suggestedPreparation: "Use one precise question." },
      { label: "Recovery path", eventType: "trust_recovery", probabilityBand: "moderate", expectedTimeframe: "2 turns", riskLevel: "low", whyLikely: "Composed acknowledgment can recover trajectory.", suggestedPreparation: "Name the pressure, then answer narrowly." },
    ],
    conversation_stall: [
      { label: "Conversation stall", eventType: "conversation_stall", probabilityBand: "high", expectedTimeframe: "next turn", riskLevel: "moderate", whyLikely: "The exchange lacks a concrete next step.", suggestedPreparation: "Offer a choice among patient fit, access, or workflow." },
      { label: "Disengagement", eventType: "trust_degradation", probabilityBand: "moderate", expectedTimeframe: "2 turns", riskLevel: "high", whyLikely: "Without a useful frame, the HCP may reduce participation.", suggestedPreparation: "Compress to the smallest useful decision." },
      { label: "Missed close", eventType: "commitment_risk", probabilityBand: "moderate", expectedTimeframe: "3 turns", riskLevel: "moderate", whyLikely: "No next step weakens commitment quality.", suggestedPreparation: "Ask for one low-friction next action." },
    ],
  };

  const boundaryLoop = latestRepRepeatedBoundary(input.turns) && hasSpecificityBoundary(latestHcpText(input.turns));
  const intervention: ChainIntervention = boundaryLoop
    ? {
      label: "Recover from repeated boundary language",
      rationale: "The HCP has already heard the compliance boundary and is now testing whether the rep can make the approved information useful without overstepping.",
      safestResponse: "You are right; I have stayed at the boundary without answering what would make this useful. I can stay with the approved safety information and point to the specific approved data we can discuss, then route case-level interpretation to medical.",
    }
    : safety
      ? {
        label: "Move to approved safety boundary",
        rationale: "The safest intervention point is before the HCP asks for case-specific interpretation.",
        safestResponse: SAFETY_BOUNDARY_RESPONSE,
      }
      : {
        label: access ? "Re-anchor discussion to approved access support" : "Re-anchor discussion to approved differentiation",
        rationale: "The best intervention point is before the HCP turns the current pressure into a broader objection chain.",
        safestResponse: access
          ? "You are right to separate the clinical decision from the staff burden. Let me keep this practical and stay with the approved access support process."
          : "Before I answer too broadly, can I clarify which part matters most for your decision: patient fit, evidence, workflow, or access?",
      };

  return {
    id: hashId("chain", `${trigger}-${trajectory.currentState}-${posture.id}`),
    trajectoryContext: trajectory.currentState,
    chainLabel: trigger === "compliance_boundary" ? "Potential escalation chain" : "Likely next sequence",
    trigger,
    risk: safety ? "critical" : trajectory.direction === "worsening" ? "elevated" : "watch",
    confidenceLanguage: safety || access ? "strongly indicated" : "likely",
    steps: templates[trigger],
    intervention,
    whyThisChain: `This chain is emerging because the current posture is ${posture.label.toLowerCase()} and trajectory is ${trajectory.currentState.replace(/_/g, " ")}.`,
  };
}

export function adaptRealismProfile(input: SimulatorIntelligenceInput): RealismProfile {
  const text = textFromTurns(input.turns);
  const active = activeExchangeText(input.turns);
  const realism = Number(input.realism || 5);
  const activeSafety = hasSafetyTopic(active);
  const activeEvidence = hasEvidenceTopic(active);
  const activeAccess = hasAccessTopic(active);
  const access = activeAccess || (hasAccessTopic(text) && !activeSafety && !activeEvidence);
  const evidence = activeSafety || activeEvidence || (hasEvidenceTopic(text) && !activeAccess);
  const competitor = /\b(competitor|switch|already using|current therapy)\b/.test(active) || /\b(competitor|switch|already using|current therapy)\b/.test(text);
  const time = hasTimeTopic(active) || hasTimeTopic(text);
  const dimensions: RealismDimension[] = [
    { id: "clinical_skepticism", label: "Clinical skepticism", qualitativeState: evidence ? "elevated" : "moderate", driver: "Evidence scrutiny and patient-fit demand", repFacingSignal: evidence ? "Evidence scrutiny elevated" : "Clinical skepticism balanced", adminValue: evidence ? 74 : 52 },
    { id: "time_pressure", label: "Time pressure", qualitativeState: time ? "elevated" : "moderate", driver: "Compressed response window", repFacingSignal: time ? "Time pressure elevated" : "Time pressure moderate", adminValue: time ? 72 : 46 },
    { id: "payer_hostility", label: "Payer hostility", qualitativeState: access ? "elevated" : "low", driver: "Access or formulary burden", repFacingSignal: access ? "Access frustration active" : "Payer hostility low", adminValue: access ? 78 : 28 },
    { id: "interruption_frequency", label: "Interruption frequency", qualitativeState: realism >= 8 ? "intense" : realism >= 6 ? "elevated" : "moderate", driver: "Adaptive realism level and HCP pressure", repFacingSignal: realism >= 8 ? "Interruption frequency increasing" : "Interruption frequency contained", adminValue: Math.min(92, realism * 10) },
    { id: "competitor_anchoring", label: "Competitor anchoring", qualitativeState: competitor ? "elevated" : "low", driver: "Incumbent treatment preference", repFacingSignal: competitor ? "Competitor anchoring active" : "Competitor anchoring low", adminValue: competitor ? 75 : 24 },
    { id: "specificity_need", label: "Need for specificity", qualitativeState: evidence || access ? "intense" : "elevated", driver: "HCP tolerance for generalization", repFacingSignal: evidence || access ? "Tolerance for generalization low" : "Specificity expected", adminValue: evidence || access ? 86 : 64 },
  ];

  const mode: RealismMode = access
    ? "access_pressure"
    : evidence
      ? "clinical_scrutiny"
      : competitor
        ? "competitive_defense"
        : time
          ? "time_compressed"
          : "balanced_resistance";

  const modeLabel: Record<RealismMode, string> = {
    balanced_resistance: "Balanced Resistance",
    clinical_scrutiny: "Clinical Scrutiny",
    access_pressure: "Access Pressure",
    time_compressed: "Time Compressed",
    competitive_defense: "Competitive Defense",
  };

  return {
    mode,
    modeLabel: modeLabel[mode],
    activeDimensions: dimensions,
    behaviorDriver: dimensions.filter((dimension) => ["elevated", "intense"].includes(dimension.qualitativeState)).map((dimension) => dimension.repFacingSignal).slice(0, 4).join("; "),
    adaptationSummary: access || evidence
      ? "Realism is adapting toward sharper specificity demands based on the rep's ability to address the active barrier."
      : "Realism is holding a balanced challenge profile while monitoring for missed signals.",
    interpretation: access
      ? "This HCP is not hostile, but will challenge access burden and reward practical specificity."
      : evidence
        ? "This HCP will challenge broad claims and reward precise evidence boundaries."
        : "This HCP is testing relevance without fully closing the conversation.",
  };
}

function reducer(state: SimulatorIntelligenceState, event: SimulatorIntelligenceEvent): SimulatorIntelligenceState {
  return {
    ...state,
    events: [...state.events, event].slice(-50),
  };
}

export function buildSimulatorIntelligenceState(input: SimulatorIntelligenceInput = {}, previousState?: TrajectoryState): SimulatorIntelligenceState {
  const trajectoryTransition = detectTrajectoryTransition(input, previousState || "recoverable");
  const predictiveChain = generatePredictiveChain(input, trajectoryTransition);
  const hcpPosture = inferHcpPosture(input);
  const pressureState = buildPressureVisualizationState(input);
  const realismProfile = adaptRealismProfile(input);
  const postureShift = previousState && trajectoryTransition.direction !== "holding"
    ? {
      previousPosture: previousState.replace(/_/g, " "),
      currentPosture: hcpPosture.label,
      explanation: `Posture shifted as trajectory moved toward ${trajectoryTransition.currentState.replace(/_/g, " ")}.`,
      detectedAt: now(),
    }
    : null;

  return {
    events: [],
    trajectoryTransition,
    predictiveChain,
    hcpPosture,
    postureShift,
    pressureState,
    realismProfile,
  };
}

export function createSimulatorIntelligenceEvent(type: SimulatorIntelligenceEventType, payload: Record<string, unknown> = {}): SimulatorIntelligenceEvent {
  return {
    id: hashId("intel-event", `${type}-${JSON.stringify(payload)}-${Date.now()}`),
    type,
    timestamp: now(),
    payload,
  };
}

export const mockSimulatorIntelligence = buildSimulatorIntelligenceState({
  turns: [
    { speaker: "hcp", text: "If this still needs prior auth, tell me what actually changes for my staff." },
    { speaker: "rep", text: "You're right to separate the clinical decision from the staff burden. Let me keep this practical." },
  ],
  hcpPrediction: { riskLevel: "high", concernFamily: "access" },
  realism: 6,
});

export function useSimulatorIntelligenceStore(input: SimulatorIntelligenceInput = {}) {
  const inputKey = useMemo(() => JSON.stringify({
    turns: input.turns?.map((turn) => [turn.speaker, turn.text]).slice(-8),
    lastSignals: input.lastSignals,
    hcpPrediction: input.hcpPrediction,
    voiceMetadata: input.voiceMetadata,
    voiceTelemetry: input.voiceTelemetry,
    realism: input.realism,
  }), [input]);
  const computed = useMemo(() => buildSimulatorIntelligenceState(input), [inputKey]);
  const [eventState, dispatch] = useReducer(reducer, computed);

  useEffect(() => {
    const events: SimulatorIntelligenceEvent[] = [
      createSimulatorIntelligenceEvent("transcript_updated", { turnCount: input.turns?.length || 0 }),
      createSimulatorIntelligenceEvent("trajectory_transition_detected", { currentState: computed.trajectoryTransition.currentState }),
      createSimulatorIntelligenceEvent("pressure_signal_updated", { pulseIntensity: computed.pressureState.pulseIntensity }),
      createSimulatorIntelligenceEvent("predictive_chain_updated", { trigger: computed.predictiveChain.trigger }),
      createSimulatorIntelligenceEvent("realism_profile_updated", { mode: computed.realismProfile.mode }),
    ];
    if (computed.postureShift) {
      events.push(createSimulatorIntelligenceEvent("posture_shift_detected", { posture: computed.hcpPosture.id }));
    }
    events.forEach(dispatch);
  }, [inputKey]);

  return {
    ...computed,
    events: eventState.events,
    dispatchIntelligenceEvent: dispatch,
  };
}
