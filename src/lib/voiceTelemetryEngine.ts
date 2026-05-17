import { useEffect, useMemo, useRef, useState } from "react";

export type VoiceTelemetryEventType =
  | "hesitation_spike"
  | "pacing_acceleration"
  | "confidence_drop"
  | "interruption_detected"
  | "filler_word_cluster"
  | "defensive_tone"
  | "empathy_improvement"
  | "composure_recovery";

export type VoiceTelemetrySeverity = "low" | "moderate" | "high" | "critical";

export interface VoiceMetricImpact {
  metricId: string;
  metricLabel: string;
  delta: number;
  rationale: string;
}

export interface VoiceTelemetryEvent {
  id: string;
  timestamp: string;
  type: VoiceTelemetryEventType;
  severity: VoiceTelemetrySeverity;
  metricImpact: VoiceMetricImpact[];
  insight: string;
  coachingRecommendation: string;
}

export interface VoiceTelemetry {
  id: string;
  capturedAt: string;
  pacingWordsPerMinute: number;
  confidence: number;
  hesitationIndex: number;
  fillerWordCount: number;
  interruptionFrequency: number;
  stressLoad: number;
  emotionalCalibration: number;
  tonalStability: number;
  responseLatencyMs: number;
  composureUnderPressure: number;
  conversationalDominance: number;
  confidenceDrift: Array<{ timestamp: string; value: number }>;
  waveform: number[];
  events: VoiceTelemetryEvent[];
  trajectoryImpact: "stabilizing" | "recoverable" | "at_risk" | "critical";
}

export interface VoiceTelemetryInput {
  voiceMetadata?: Record<string, unknown> | null;
  voiceAnalysis?: Record<string, unknown> | null;
  turns?: Array<{ id?: string; speaker?: string; text?: string; timestamp?: string }>;
  lastSignals?: Record<string, unknown>;
  hcpPrediction?: Record<string, unknown> | null;
  currentMetricScores?: Record<string, number>;
  pressureLevel?: number;
}

export const mockVoiceTelemetryEvents: VoiceTelemetryEvent[] = [
  {
    id: "mock-pacing-acceleration",
    timestamp: new Date().toISOString(),
    type: "pacing_acceleration",
    severity: "high",
    metricImpact: [
      {
        metricId: "conversation_control_structure",
        metricLabel: "Conversation Control & Structure",
        delta: -2,
        rationale: "Fast delivery can make the response feel rep-led under objection pressure.",
      },
      {
        metricId: "listening_responsiveness",
        metricLabel: "Listening & Responsiveness",
        delta: -1,
        rationale: "Acceleration can signal that the rep is answering before fully processing the HCP concern.",
      },
    ],
    insight: "Pace is rising while the HCP is likely testing practical credibility.",
    coachingRecommendation: "Slow the first sentence, acknowledge the objection, then make one narrow point.",
  },
  {
    id: "mock-composure-recovery",
    timestamp: new Date().toISOString(),
    type: "composure_recovery",
    severity: "low",
    metricImpact: [
      {
        metricId: "objection_navigation",
        metricLabel: "Objection Handling",
        delta: 2,
        rationale: "A steadier delivery gives the rep more room to explore before defending.",
      },
    ],
    insight: "Composure is recovering after a prior stress marker.",
    coachingRecommendation: "Maintain the slower pace and ask one decision-threshold question.",
  },
];

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

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function numeric(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stableHash(value = ""): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

function eventId(type: VoiceTelemetryEventType, seed: string): string {
  return `${type}-${stableHash(`${type}|${seed}`).toString(36)}`;
}

function impact(metricId: string, delta: number, rationale: string): VoiceMetricImpact {
  return {
    metricId,
    metricLabel: metricLabels[metricId] || metricId.replace(/_/g, " "),
    delta,
    rationale,
  };
}

function severityFromStress(stressLoad: number, base: VoiceTelemetrySeverity = "moderate"): VoiceTelemetrySeverity {
  if (stressLoad >= 86) return "critical";
  if (stressLoad >= 70) return "high";
  if (stressLoad >= 45) return base;
  return "low";
}

function latestRepText(turns: VoiceTelemetryInput["turns"] = []): string {
  return [...turns].reverse().find((turn) => turn?.speaker === "rep")?.text || "";
}

function calculateWaveform(seed: string, tick = 0, stressLoad = 30): number[] {
  const hash = stableHash(seed || "voice");
  return Array.from({ length: 42 }, (_, index) => {
    const harmonic = Math.sin((index + tick) / 2.2) * 22;
    const secondary = Math.cos((index * 1.7 + hash + tick) / 5.8) * 13;
    const stress = (stressLoad / 100) * Math.sin((index + tick) / 0.95) * 12;
    return clamp(42 + harmonic + secondary + stress, 8, 94);
  });
}

function calculateConfidence({
  wpm,
  fillerRate,
  pauses,
  speechConfidence,
  stressLoad,
}: {
  wpm: number;
  fillerRate: number;
  pauses: number;
  speechConfidence: number;
  stressLoad: number;
}): number {
  const pacePenalty = wpm > 175 ? (wpm - 175) * 0.28 : wpm > 0 && wpm < 95 ? (95 - wpm) * 0.18 : 0;
  const fillerPenalty = fillerRate * 150;
  const pausePenalty = pauses > 5 ? (pauses - 5) * 4 : 0;
  return clamp((speechConfidence || 0.72) * 100 - pacePenalty - fillerPenalty - pausePenalty - stressLoad * 0.12);
}

function buildEvents(input: VoiceTelemetryInput, telemetrySeed: Omit<VoiceTelemetry, "events">): VoiceTelemetryEvent[] {
  const metadata = input.voiceMetadata || {};
  const repText = latestRepText(input.turns);
  const normalized = repText.toLowerCase();
  const seed = `${repText}|${telemetrySeed.capturedAt}|${telemetrySeed.pacingWordsPerMinute}`;
  const events: VoiceTelemetryEvent[] = [];

  if (telemetrySeed.hesitationIndex >= 64) {
    events.push({
      id: eventId("hesitation_spike", seed),
      timestamp: telemetrySeed.capturedAt,
      type: "hesitation_spike",
      severity: severityFromStress(telemetrySeed.stressLoad),
      metricImpact: [
        impact("question_quality", -1, "Hesitation can make the next question feel less deliberate."),
        impact("conversation_control_structure", -2, "Long pauses under objection pressure can weaken control of the exchange."),
      ],
      insight: "Hesitation is clustering around the objection-handling moment.",
      coachingRecommendation: "Pause intentionally, then restart with the HCP's exact concern before adding evidence.",
    });
  }

  if (telemetrySeed.pacingWordsPerMinute >= 176) {
    events.push({
      id: eventId("pacing_acceleration", seed),
      timestamp: telemetrySeed.capturedAt,
      type: "pacing_acceleration",
      severity: telemetrySeed.pacingWordsPerMinute >= 195 ? "critical" : "high",
      metricImpact: [
        impact("listening_responsiveness", -2, "Fast delivery can sound like the rep is answering before fully listening."),
        impact("objection_navigation", -2, "Acceleration under pressure can make objection handling feel defensive."),
      ],
      insight: "Pacing is accelerating during a likely HCP pressure point.",
      coachingRecommendation: "Reduce pace and use a short acknowledgment before the answer.",
    });
  }

  if (telemetrySeed.confidence <= 46) {
    events.push({
      id: eventId("confidence_drop", seed),
      timestamp: telemetrySeed.capturedAt,
      type: "confidence_drop",
      severity: telemetrySeed.confidence <= 32 ? "critical" : "high",
      metricImpact: [
        impact("making_it_matter", -2, "Lower confidence can make value framing feel less credible."),
        impact("commitment_gaining", -2, "A confidence drop reduces the likelihood of a clear next-step ask."),
      ],
      insight: "Confidence is dropping while the conversation needs a precise, credible response.",
      coachingRecommendation: "Anchor to one approved proof point and avoid over-explaining.",
    });
  }

  if (telemetrySeed.interruptionFrequency >= 2 || /\b(wait|let me finish|hold on|interrupt)\b/i.test(repText)) {
    events.push({
      id: eventId("interruption_detected", seed),
      timestamp: telemetrySeed.capturedAt,
      type: "interruption_detected",
      severity: telemetrySeed.interruptionFrequency >= 3 ? "critical" : "high",
      metricImpact: [
        impact("customer_engagement_signals", -3, "Interruption pressure can reduce HCP participation."),
        impact("listening_responsiveness", -2, "Interruptions make the rep appear less responsive to the signal."),
      ],
      insight: "Conversational dominance is moving above the HCP-safe range.",
      coachingRecommendation: "Yield conversational space and ask the HCP to finish the concern.",
    });
  }

  if (telemetrySeed.fillerWordCount >= 3 || numeric(metadata.filler_word_rate) >= 0.08) {
    events.push({
      id: eventId("filler_word_cluster", seed),
      timestamp: telemetrySeed.capturedAt,
      type: "filler_word_cluster",
      severity: telemetrySeed.fillerWordCount >= 6 ? "high" : "moderate",
      metricImpact: [
        impact("making_it_matter", -1, "Filler clusters can make value framing sound less crisp."),
        impact("objection_navigation", -1, "Filler words can soften the rep's handling of a firm objection."),
      ],
      insight: "Filler-word density is rising in the response.",
      coachingRecommendation: "Shorten the next sentence and remove setup language.",
    });
  }

  if (/\b(no|actually|that's not|you should|obviously|clearly|the point is)\b/i.test(repText) && telemetrySeed.stressLoad >= 58) {
    events.push({
      id: eventId("defensive_tone", seed),
      timestamp: telemetrySeed.capturedAt,
      type: "defensive_tone",
      severity: telemetrySeed.stressLoad >= 78 ? "critical" : "high",
      metricImpact: [
        impact("objection_navigation", -3, "Defensive tone can escalate the objection instead of exploring it."),
        impact("adaptability", -2, "The delivery suggests the rep is staying with the same approach under pressure."),
      ],
      insight: "Tone is trending defensive during objection handling.",
      coachingRecommendation: "Replace rebuttal language with acknowledgment and one clarifying question.",
    });
  }

  if (/\b(i hear|understand|fair concern|that makes sense|you're right)\b/i.test(normalized) && telemetrySeed.emotionalCalibration >= 65) {
    events.push({
      id: eventId("empathy_improvement", seed),
      timestamp: telemetrySeed.capturedAt,
      type: "empathy_improvement",
      severity: "low",
      metricImpact: [
        impact("listening_responsiveness", 2, "The rep is visibly acknowledging the HCP signal."),
        impact("customer_engagement_signals", 1, "Calibrated empathy can keep the HCP in the exchange."),
      ],
      insight: "Emotional calibration is improving around the HCP's concern.",
      coachingRecommendation: "Keep the acknowledgment brief and transition to the decision threshold.",
    });
  }

  if (telemetrySeed.composureUnderPressure >= 72 && telemetrySeed.stressLoad <= 48 && telemetrySeed.confidence >= 62) {
    events.push({
      id: eventId("composure_recovery", seed),
      timestamp: telemetrySeed.capturedAt,
      type: "composure_recovery",
      severity: "low",
      metricImpact: [
        impact("conversation_control_structure", 2, "Steadier delivery supports a cleaner next-step frame."),
        impact("objection_navigation", 2, "Composure improves the odds of exploring the objection before answering."),
      ],
      insight: "Composure is stabilizing after pressure signals.",
      coachingRecommendation: "Hold this pace and ask one precise threshold question.",
    });
  }

  return events.length ? events : [{
    id: eventId("composure_recovery", seed || telemetrySeed.id),
    timestamp: telemetrySeed.capturedAt,
    type: "composure_recovery",
    severity: "low",
    metricImpact: [
      impact("conversation_control_structure", 1, "Telemetry is stable enough to support structured next steps."),
    ],
    insight: "Voice telemetry is stable with no critical delivery marker.",
    coachingRecommendation: "Maintain steady pace and keep the response tied to the HCP's current concern.",
  }];
}

export function mapVoiceEventToCoaching(event: VoiceTelemetryEvent): string {
  const impacts = event.metricImpact
    .slice(0, 2)
    .map((item) => item.metricLabel)
    .join(" and ");
  return `${event.insight} Coaching focus: ${event.coachingRecommendation}${impacts ? ` Metric impact: ${impacts}.` : ""}`;
}

export function generateVoiceTelemetry(input: VoiceTelemetryInput = {}, tick = 0): VoiceTelemetry {
  const metadata = input.voiceMetadata || {};
  const analysis = input.voiceAnalysis || {};
  const repText = latestRepText(input.turns);
  const wpm = numeric(metadata.words_per_minute, tick % 3 === 0 ? 148 : 132);
  const pauses = numeric(metadata.pause_count, tick % 4);
  const fillerCount = numeric(metadata.filler_word_count, /\b(um|uh|like|you know)\b/i.test(repText) ? 3 : 0);
  const fillerRate = numeric(metadata.filler_word_rate, fillerCount ? 0.07 : 0.01);
  const chunks = numeric(metadata.recognition_chunk_count, 1);
  const latency = numeric(metadata.response_latency_ms, 650 + pauses * 220 + tick * 12);
  const speechConfidence = numeric(metadata.speech_confidence_score, 0.74);
  const riskHigh = String(input.hcpPrediction?.riskLevel || "").toLowerCase() === "high";
  const pressure = numeric(input.pressureLevel, riskHigh ? 72 : 42);
  const stressLoad = clamp(
    pressure * 0.32
    + Math.max(0, wpm - 145) * 0.33
    + fillerRate * 170
    + pauses * 5
    + (analysis?.issues ? 10 : 0),
  );
  const confidence = calculateConfidence({ wpm, fillerRate, pauses, speechConfidence, stressLoad });
  const hesitationIndex = clamp(pauses * 13 + latency / 80 + fillerRate * 90);
  const interruptionFrequency = Math.max(0, chunks - 2) + (/\b(interrupt|wait|hold on|let me finish)\b/i.test(repText) ? 2 : 0);
  const emotionalCalibration = clamp(64 + (/\b(i hear|fair|understand|makes sense|you're right)\b/i.test(repText) ? 18 : 0) - stressLoad * 0.22);
  const tonalStability = clamp(82 - Math.abs(wpm - 138) * 0.22 - fillerRate * 120 - pauses * 2.2);
  const composureUnderPressure = clamp((confidence * 0.42) + (tonalStability * 0.36) + (emotionalCalibration * 0.22) - stressLoad * 0.18);
  const conversationalDominance = clamp(48 + Math.max(0, wpm - 140) * 0.2 + Math.max(0, chunks - 2) * 8 - pauses * 1.8);
  const capturedAt = new Date().toISOString();
  const seed = `${repText}|${capturedAt}|${tick}`;

  const confidenceDrift = Array.from({ length: 16 }, (_, index) => ({
    timestamp: new Date(Date.now() - (15 - index) * 3000).toISOString(),
    value: clamp(confidence + Math.sin((index + tick) / 2) * 5 - Math.max(0, stressLoad - 65) * 0.12),
  }));

  const base: Omit<VoiceTelemetry, "events"> = {
    id: `voice-telemetry-${stableHash(seed).toString(36)}`,
    capturedAt,
    pacingWordsPerMinute: Math.round(wpm),
    confidence: Math.round(confidence),
    hesitationIndex: Math.round(hesitationIndex),
    fillerWordCount: fillerCount,
    interruptionFrequency,
    stressLoad: Math.round(stressLoad),
    emotionalCalibration: Math.round(emotionalCalibration),
    tonalStability: Math.round(tonalStability),
    responseLatencyMs: Math.round(latency),
    composureUnderPressure: Math.round(composureUnderPressure),
    conversationalDominance: Math.round(conversationalDominance),
    confidenceDrift,
    waveform: calculateWaveform(seed, tick, stressLoad),
    trajectoryImpact: stressLoad >= 82
      ? "critical"
      : stressLoad >= 65 || confidence < 48
        ? "at_risk"
        : composureUnderPressure >= 70
          ? "stabilizing"
          : "recoverable",
  };

  return {
    ...base,
    events: buildEvents(input, base),
  };
}

export function createVoiceTelemetryStream({
  input,
  intervalMs = 2400,
  onTelemetry,
}: {
  input: VoiceTelemetryInput;
  intervalMs?: number;
  onTelemetry: (telemetry: VoiceTelemetry) => void;
}) {
  let tick = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const emit = () => {
    tick += 1;
    onTelemetry(generateVoiceTelemetry(input, tick));
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

export function createVoiceTelemetryTransport({
  url = "/api/voice-telemetry",
  onTelemetry,
  onError,
}: {
  url?: string;
  onTelemetry: (telemetry: VoiceTelemetry) => void;
  onError?: (error: unknown) => void;
}) {
  let eventSource: EventSource | null = null;
  let socket: WebSocket | null = null;
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;

  return {
    async connectWebAudio(stream: MediaStream) {
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      return analyser;
    },
    connectSse() {
      if (typeof EventSource === "undefined") return false;
      eventSource = new EventSource(url);
      eventSource.onmessage = (message) => {
        try {
          onTelemetry(JSON.parse(message.data));
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
          onTelemetry(JSON.parse(String(message.data || "{}")));
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
      audioContext?.close();
      eventSource = null;
      socket = null;
      audioContext = null;
      analyser = null;
    },
  };
}

export function useVoiceTelemetry(input: VoiceTelemetryInput = {}) {
  const [telemetry, setTelemetry] = useState<VoiceTelemetry>(() => generateVoiceTelemetry(input));
  const previousCriticalRef = useRef<string>("");
  const inputKey = useMemo(() => JSON.stringify({
    voiceMetadata: input.voiceMetadata,
    voiceAnalysis: input.voiceAnalysis,
    lastSignals: input.lastSignals,
    hcpPrediction: input.hcpPrediction,
    turns: input.turns?.map((turn) => [turn.speaker, turn.text]).slice(-6),
  }), [input]);

  useEffect(() => {
    const stream = createVoiceTelemetryStream({
      input,
      onTelemetry: setTelemetry,
    });
    stream.start();
    return () => stream.stop();
  }, [inputKey]);

  const criticalEvent = telemetry.events.find((event) => event.severity === "critical" || event.severity === "high") || null;
  const hasNewCriticalEvent = Boolean(criticalEvent && previousCriticalRef.current !== criticalEvent.id);

  useEffect(() => {
    if (criticalEvent) previousCriticalRef.current = criticalEvent.id;
  }, [criticalEvent]);

  return {
    telemetry,
    criticalEvent,
    hasNewCriticalEvent,
  };
}
