export type ReasoningEvidenceSource =
  | "transcript"
  | "voice"
  | "metric"
  | "prediction"
  | "compliance"
  | "scenario"
  | "coaching"
  | "audit";

export interface ReasoningEvidenceSignal {
  id: string;
  label: string;
  detail: string;
  source: ReasoningEvidenceSource;
  weight: number;
}

export interface TranscriptEvidence {
  speaker: "rep" | "hcp" | "system" | string;
  excerpt: string;
  turnId?: string;
  timestamp?: string;
  rationale: string;
}

export interface VoiceBehaviorEvidence {
  signal: string;
  value: string | number;
  interpretation: string;
  severity?: "low" | "moderate" | "high" | "critical";
}

export interface MetricEvidence {
  metricId: string;
  metricLabel: string;
  score?: number;
  impact: number;
  explanation: string;
}

export interface ComplianceBasis {
  ruleId: string;
  rule: string;
  basis: string;
  approvedSource?: string;
}

export interface RejectedAlternative {
  id: string;
  alternative: string;
  rejectedBecause: string;
  riskReduced: string;
}

export interface ReasoningAuditTrailEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: "system" | "model" | "rules_engine" | "user";
  detail: string;
}

export interface AIReasoningCard {
  recommendationId: string;
  recommendation: string;
  confidence: number;
  primaryReason: string;
  evidenceSignals: ReasoningEvidenceSignal[];
  transcriptEvidence: TranscriptEvidence[];
  voiceEvidence: VoiceBehaviorEvidence[];
  metricEvidence: MetricEvidence[];
  complianceBasis: ComplianceBasis[];
  rejectedAlternatives: RejectedAlternative[];
  auditTrail: ReasoningAuditTrailEntry[];
  generatedAt: string;
  modelVersion: string;
}

export interface BuildReasoningInput {
  recommendationId?: string;
  recommendation?: string;
  source?: "predictive_next_event" | "live_coaching" | "voice_telemetry" | "compliance_alert" | "post_call_summary";
  confidence?: number;
  primaryReason?: string;
  turns?: Array<{ id?: string; speaker?: string; text?: string; timestamp?: string }>;
  event?: Record<string, any> | null;
  voiceTelemetry?: Record<string, any> | null;
  lastSignals?: Record<string, any>;
  metricScores?: Record<string, number>;
  complianceRules?: string[];
  modelVersion?: string;
}

const MODEL_VERSION = "reasoning-transparency-v1";

const metricLabels: Record<string, string> = {
  question_quality: "Question Quality",
  listening_responsiveness: "Listening & Responsiveness",
  customer_engagement_signals: "Customer Engagement Cues",
  making_it_matter: "Value Framing",
  objection_navigation: "Objection Handling",
  conversation_control_structure: "Conversation Control & Structure",
  adaptability: "Adaptability",
  commitment_gaining: "Commitment Gaining",
};

const defaultComplianceRules = [
  "Use approved messaging and labeling only.",
  "Do not make unsupported comparative, safety, access, or outcomes claims.",
  "Route patient-specific medical questions to the appropriate medical resource.",
  "Keep coaching recommendations focused on observable rep behavior and transcript evidence.",
];

export const mockReasoningCard: AIReasoningCard = {
  recommendationId: "mock-reasoning-access-response",
  recommendation: "Acknowledge the access burden and narrow to one approved support step.",
  confidence: 0.82,
  primaryReason: "Risk increased because the transcript contains access friction and the current delivery pattern could make the response sound too broad.",
  evidenceSignals: [
    {
      id: "signal-access",
      label: "Access pressure",
      detail: "The recent HCP language referenced coverage, prior authorization, or staff burden.",
      source: "transcript",
      weight: 0.32,
    },
    {
      id: "signal-control",
      label: "Conversation control",
      detail: "Current signals indicate the conversation needs a narrower next step.",
      source: "metric",
      weight: 0.24,
    },
    {
      id: "signal-compliance",
      label: "Approved access boundary",
      detail: "The recommendation avoids guarantees about payer decisions or patient outcomes.",
      source: "compliance",
      weight: 0.2,
    },
  ],
  transcriptEvidence: [
    {
      speaker: "hcp",
      excerpt: "If this still needs prior auth, tell me what actually changes for my staff.",
      rationale: "This is the stated objection the recommendation is designed to address.",
    },
  ],
  voiceEvidence: [
    {
      signal: "Pacing",
      value: "176 wpm",
      interpretation: "Pace is above the calibrated range, increasing the risk of sounding defensive.",
      severity: "high",
    },
  ],
  metricEvidence: [
    {
      metricId: "objection_navigation",
      metricLabel: "Objection Handling",
      score: 2.8,
      impact: -2,
      explanation: "The next response needs to explore the access concern before explaining support.",
    },
  ],
  complianceBasis: [
    {
      ruleId: "access-no-guarantee",
      rule: "Do not guarantee access, coverage, or payer outcomes.",
      basis: "The recommended response stays with approved process language.",
      approvedSource: "Approved access support messaging library",
    },
  ],
  rejectedAlternatives: [
    {
      id: "alt-efficacy",
      alternative: "Lead with another efficacy point.",
      rejectedBecause: "Alternative rejected because the HCP objection is operational, not clinical efficacy.",
      riskReduced: "Reduces risk of talking past the HCP.",
    },
  ],
  auditTrail: [
    {
      id: "audit-1",
      timestamp: new Date().toISOString(),
      action: "recommendation_generated",
      actor: "rules_engine",
      detail: "Generated from transcript, voice, metric, and compliance evidence.",
    },
  ],
  generatedAt: new Date().toISOString(),
  modelVersion: MODEL_VERSION,
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function safeId(prefix: string, value = ""): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function latestTurns(turns: BuildReasoningInput["turns"] = [], speaker?: string, count = 2): TranscriptEvidence[] {
  return turns
    .filter((turn) => !speaker || turn.speaker === speaker)
    .slice(-count)
    .map((turn) => ({
      speaker: turn.speaker || "system",
      excerpt: String(turn.text || "").trim(),
      turnId: turn.id,
      timestamp: turn.timestamp,
      rationale: turn.speaker === "hcp"
        ? "This HCP excerpt identifies the concern or pressure the recommendation is responding to."
        : "This rep excerpt provides the behavior context used to shape the recommendation.",
    }))
    .filter((item) => item.excerpt);
}

function metricSignal(lastSignals: Record<string, any> = {}, metricId: string, value: unknown): ReasoningEvidenceSignal {
  return {
    id: safeId("signal", `${metricId}-${String(value)}`),
    label: metricLabels[metricId] || metricId.replace(/_/g, " "),
    detail: `${metricLabels[metricId] || metricId} evidence is currently "${String(value || "not observed")}".`,
    source: "metric",
    weight: value ? 0.18 : 0.08,
  };
}

export function mapSignalsToExplanation(input: BuildReasoningInput = {}): ReasoningEvidenceSignal[] {
  const signals = input.lastSignals || {};
  const event = input.event || {};
  const output: ReasoningEvidenceSignal[] = [];

  if (event.label || event.type) {
    output.push({
      id: safeId("signal-prediction", `${event.type || ""}-${event.label || ""}`),
      label: event.label || String(event.type || "Predicted event").replace(/_/g, " "),
      detail: `Risk increased because the active event is ${event.label || String(event.type || "").replace(/_/g, " ")}.`,
      source: input.source === "voice_telemetry" ? "voice" : "prediction",
      weight: Number(event.probability || 0.6),
    });
  }

  if (signals.listening_pattern) output.push(metricSignal(signals, "listening_responsiveness", signals.listening_pattern));
  if (signals.response_alignment) output.push(metricSignal(signals, "adaptability", signals.response_alignment));
  if (signals.objection_type && signals.objection_type !== "none") {
    output.push({
      id: safeId("signal-objection", String(signals.objection_type)),
      label: "Objection pressure",
      detail: `The current objection family is ${String(signals.objection_type).replace(/_/g, " ")}.`,
      source: "transcript",
      weight: 0.22,
    });
  }

  output.push({
    id: "signal-compliance-approved-language",
    label: "Compliance boundary",
    detail: "This recommendation was generated from approved-language constraints and avoids unsupported claims.",
    source: "compliance",
    weight: 0.2,
  });

  return output.sort((a, b) => b.weight - a.weight).slice(0, 6);
}

function buildVoiceEvidence(input: BuildReasoningInput = {}): VoiceBehaviorEvidence[] {
  const voice = input.voiceTelemetry || input.event || {};
  const values = [
    ["Pacing", voice.pacingWordsPerMinute, "Pacing affects whether the answer sounds measured or rushed."],
    ["Confidence", voice.confidence, "Confidence affects credibility during objection handling."],
    ["Stress load", voice.stressLoad, "Stress load affects the likelihood of defensive delivery."],
    ["Composure", voice.composureUnderPressure, "Composure affects the HCP's willingness to keep engaging."],
  ];

  return values
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([signal, value, interpretation]) => ({
      signal: String(signal),
      value: Number.isFinite(Number(value)) ? Math.round(Number(value)) : String(value),
      interpretation: String(interpretation),
      severity: Number(value) >= 75 && ["Pacing", "Stress load"].includes(String(signal)) ? "high" : "moderate",
    }));
}

function buildMetricEvidence(input: BuildReasoningInput = {}): MetricEvidence[] {
  const scores = input.metricScores || {};
  const explicitImpact = Array.isArray(input.event?.metricImpact) ? input.event.metricImpact : [];
  const mapped = explicitImpact.map((item: any) => ({
    metricId: item.metricId || "objection_navigation",
    metricLabel: item.metricLabel || metricLabels[item.metricId] || "Objection Handling",
    score: scores[item.metricId],
    impact: Number(item.delta || item.impact || 0),
    explanation: item.rationale || item.explanation || "This metric is directly affected by the recommendation.",
  }));

  const fallback = Object.entries(scores).slice(0, 4).map(([metricId, score]) => ({
    metricId,
    metricLabel: metricLabels[metricId] || metricId.replace(/_/g, " "),
    score: Number(score),
    impact: Number(score) < 3 ? -1 : 1,
    explanation: Number(score) < 3
      ? "Current score indicates this capability may constrain the next response."
      : "Current score indicates this capability can support the recommendation.",
  }));

  return (mapped.length ? mapped : fallback).slice(0, 8);
}

function buildRejectedAlternatives(input: BuildReasoningInput = {}): RejectedAlternative[] {
  const source = input.source || "live_coaching";
  const eventType = String(input.event?.type || "");
  const alternatives: RejectedAlternative[] = [
    {
      id: "alt-generic-reassurance",
      alternative: "Give a broad reassurance without evidence.",
      rejectedBecause: "Alternative rejected because it does not address the observable HCP concern or metric signal.",
      riskReduced: "Reduces black-box coaching and unsupported claim risk.",
    },
    {
      id: "alt-product-pitch",
      alternative: "Pivot immediately to product value.",
      rejectedBecause: "Alternative rejected because the transcript evidence requires acknowledgment before value framing.",
      riskReduced: "Reduces risk of talking past the HCP.",
    },
  ];

  if (source === "voice_telemetry" || eventType.includes("tone") || eventType.includes("confidence")) {
    alternatives.push({
      id: "alt-ignore-delivery",
      alternative: "Ignore delivery and only coach message content.",
      rejectedBecause: "Alternative rejected because voice behavior is affecting perceived credibility.",
      riskReduced: "Reduces risk that the right words land with the wrong tone.",
    });
  }

  if (source === "compliance_alert" || eventType.includes("safety") || eventType.includes("compliance")) {
    alternatives.push({
      id: "alt-answer-medical-specific",
      alternative: "Answer the medical or safety question beyond approved material.",
      rejectedBecause: "Alternative rejected because the compliant path is approved language or routing to the proper resource.",
      riskReduced: "Reduces medical, legal, and regulatory exposure.",
    });
  }

  return alternatives.slice(0, 4);
}

function buildComplianceBasis(input: BuildReasoningInput = {}): ComplianceBasis[] {
  return (input.complianceRules?.length ? input.complianceRules : defaultComplianceRules).slice(0, 4).map((rule, index) => ({
    ruleId: `rule-${index + 1}`,
    rule,
    basis: "This recommendation stays within observable behavior, approved messaging, and compliant escalation boundaries.",
    approvedSource: index === 0 ? "ReflectivAI approved messaging guardrail" : "Commercial execution compliance policy",
  }));
}

function buildAuditTrail(input: BuildReasoningInput = {}, generatedAt: string): ReasoningAuditTrailEntry[] {
  const source = input.source || "live_coaching";
  return [
    {
      id: "audit-ingest",
      timestamp: generatedAt,
      action: "signals_ingested",
      actor: "system",
      detail: "Transcript, voice, metric, prediction, and compliance signals were assembled for reasoning.",
    },
    {
      id: "audit-map",
      timestamp: generatedAt,
      action: "evidence_mapped",
      actor: "rules_engine",
      detail: `Evidence was mapped for ${source.replace(/_/g, " ")}.`,
    },
    {
      id: "audit-generate",
      timestamp: generatedAt,
      action: "reasoning_card_generated",
      actor: "model",
      detail: "Recommendation explanation was generated with evidence, rejected alternatives, and compliance basis.",
    },
  ];
}

export function buildReasoningCard(input: BuildReasoningInput = {}): AIReasoningCard {
  const generatedAt = new Date().toISOString();
  const recommendation =
    input.recommendation
    || input.event?.coachingRecommendation
    || input.event?.recommendedStrategy
    || input.event?.safestResponse
    || "Use the recommendation that best addresses the current HCP signal while staying within approved messaging.";
  const evidenceSignals = mapSignalsToExplanation(input);
  const confidence = clamp(
    input.confidence
    ?? Number(input.event?.probability || 0)
    ?? (evidenceSignals.reduce((sum, item) => sum + item.weight, 0) / Math.max(1, evidenceSignals.length)),
  );

  return {
    recommendationId: input.recommendationId || safeId("rec", `${recommendation}-${generatedAt}`),
    recommendation,
    confidence,
    primaryReason:
      input.primaryReason
      || evidenceSignals[0]?.detail
      || "This recommendation was generated from current transcript, metric, voice, and compliance evidence.",
    evidenceSignals,
    transcriptEvidence: [
      ...latestTurns(input.turns, "hcp", 2),
      ...latestTurns(input.turns, "rep", 1),
    ].slice(0, 4),
    voiceEvidence: buildVoiceEvidence(input),
    metricEvidence: buildMetricEvidence(input),
    complianceBasis: buildComplianceBasis(input),
    rejectedAlternatives: buildRejectedAlternatives(input),
    auditTrail: buildAuditTrail(input, generatedAt),
    generatedAt,
    modelVersion: input.modelVersion || MODEL_VERSION,
  };
}

export function logReasoningAuditEvent(card: AIReasoningCard, action = "reasoning_viewed") {
  const event = {
    action,
    recommendationId: card.recommendationId,
    generatedAt: card.generatedAt,
    modelVersion: card.modelVersion,
    loggedAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("reflectivai:reasoning-audit", { detail: event }));
  }

  return event;
}
