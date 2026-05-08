import { CANONICAL_BEHAVIORAL_METRICS } from "@/components/manager/managerPerformanceData.js";

function uniqueItems(items = []) {
  return Array.from(new Set(items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean)));
}

export const SI_BEHAVIORAL_METRIC_LABELS = CANONICAL_BEHAVIORAL_METRICS.map((metric) => metric.label);

export function buildSiFoundationBlock() {
  return [
    "SIGNAL INTELLIGENCE FOUNDATION:",
    "- Every coaching output must stay grounded in ReflectivAI's Signal Intelligence framework.",
    `- The 8 canonical behavioral metrics are: ${SI_BEHAVIORAL_METRIC_LABELS.join(", ")}.`,
    "- If you identify a strength, gap, or recommendation, map it to one or more of those canonical metrics.",
    "- Do not invent substitute frameworks, renamed competencies, or generic sales traits that are outside the Signal Intelligence model.",
    "- Prefer behavior-level language tied to the rep's questions, interpretation, value framing, engagement reading, objection handling, commitment creation, empathy, and conversation control.",
  ].join("\n");
}

export function buildFieldCoachingGrounding({
  surface = "field_coaching",
  hcpType = "",
  specialty = "",
  diseaseState = "",
  challenge = "",
  skillLevel = "",
  scenarioDescriptor = "",
  weakestAreas = [],
  strongestAreas = [],
  customNotes = [],
} = {}) {
  const lines = [
    `SURFACE: ${surface}`,
    buildSiFoundationBlock(),
    "RESEARCH-BACKED FIELD RULES:",
    "- Lead with scientific or workflow value before promotional framing.",
    "- Tailor the conversation to specialty, practice pressure, and the immediate decision moment.",
    "- Treat the exchange as two-way dialogue: diagnose the real barrier before answering it.",
    "- Respect time pressure by narrowing to one relevant point and one forward-driving question.",
    "- Use only observable behaviors, explicit context, and prompt-provided facts. Never fabricate evidence or claims.",
    "MANAGER COACHING RULES:",
    "- Coach the specific behavior, not the person's personality or intent.",
    "- State impact in terms of HCP trust, relevance, momentum, or next-step clarity.",
    "- Include inquiry: diagnose the pressure point or blind spot before prescribing a fix.",
    "- Finish with a future-focused next move the rep can use in the next interaction.",
  ];

  if (hcpType) lines.push(`HCP TYPE: ${hcpType}`);
  if (specialty) lines.push(`SPECIALTY: ${specialty}`);
  if (diseaseState) lines.push(`DISEASE STATE: ${diseaseState}`);
  if (challenge) lines.push(`PRIMARY CHALLENGE: ${challenge}`);
  if (skillLevel) lines.push(`CURRENT SKILL LEVEL: ${skillLevel}`);
  if (scenarioDescriptor) lines.push(`SCENARIO CONTEXT: ${scenarioDescriptor}`);

  const normalizedWeakAreas = uniqueItems(weakestAreas);
  if (normalizedWeakAreas.length) {
    lines.push(`FOCUS GAPS: ${normalizedWeakAreas.join(" | ")}`);
  }

  const normalizedStrongAreas = uniqueItems(strongestAreas);
  if (normalizedStrongAreas.length) {
    lines.push(`EXISTING STRENGTHS: ${normalizedStrongAreas.join(" | ")}`);
  }

  const normalizedCustomNotes = uniqueItems(customNotes);
  if (normalizedCustomNotes.length) {
    lines.push(`ADDITIONAL CONTEXT: ${normalizedCustomNotes.join(" | ")}`);
  }

  return lines.join("\n");
}