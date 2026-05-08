import { CANONICAL_BEHAVIORAL_METRICS } from "@/components/manager/managerPerformanceData.js";

function uniqueItems(items = []) {
  return Array.from(new Set(items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean)));
}

export const SI_BEHAVIORAL_METRIC_LABELS = CANONICAL_BEHAVIORAL_METRICS.map((metric) => metric.label);

export const EXTERNAL_EVIDENCE_SOURCES = [
  {
    id: "ahrq-teach-back-2024",
    shortLabel: "AHRQ Teach-Back Toolkit (2024)",
    citation: "Agency for Healthcare Research and Quality. Health Literacy Universal Precautions Toolkit, 3rd Edition: Use the Teach-Back Method: Tool 5. Updated 2024.",
  },
  {
    id: "nice-shared-decision-making-2021",
    shortLabel: "NICE Shared Decision Making NG197 (2021)",
    citation: "National Institute for Health and Care Excellence. Shared decision making (NG197). Published June 17, 2021.",
  },
  {
    id: "evans-lut-icdf-2019",
    shortLabel: "Evans 2019 decision-model simulation",
    citation: "Evans NJ. A method, framework, and tutorial for efficiently simulating models of decision-making. Behavior Research Methods. 2019;51(5):2390-2404. doi:10.3758/s13428-019-01219-z.",
  },
  {
    id: "devlin-replication-variation-2016",
    shortLabel: "Devlin et al. 2016 replication-linked switching",
    citation: "Devlin R, Marques CA, Prorocic M, et al. Mapping replication dynamics in Trypanosoma brucei reveals a link with telomere transcription and antigenic variation. eLife. 2016;5:e12765. doi:10.7554/eLife.12765.",
  },
];

export const INTERNAL_SYSTEM_ANCHORS = [
  {
    id: "standalone-canonical-sot",
    shortLabel: "Current Canonical SOT For Standalone",
    citation: "signal-coach-core/docs/CURRENT_CANONICAL_SOT_STANDALONE.md",
  },
  {
    id: "rps-architecture-map",
    shortLabel: "RPS Architecture Map",
    citation: "signal-coach-core/docs/RPS_ARCHITECTURE_MAP.md",
  },
];

function formatSourceList(items = []) {
  return items.map((item) => `${item.shortLabel}: ${item.citation}`).join(" | ");
}

export function buildSiFoundationBlock() {
  return [
    "SIGNAL INTELLIGENCE FOUNDATION:",
    "- Every coaching output must stay grounded in ReflectivAI's Signal Intelligence framework.",
    `- The 8 canonical behavioral metrics are: ${SI_BEHAVIORAL_METRIC_LABELS.join(", ")}.`,
    "- If you identify a strength, gap, or recommendation, map it to one or more of those canonical metrics.",
    "- Do not invent substitute frameworks, renamed competencies, or generic sales traits that are outside the Signal Intelligence model.",
    "- Prefer behavior-level language tied to the rep's questions, interpretation, value framing, engagement reading, objection handling, commitment creation, empathy, and conversation control.",
    "- Do not lead with numeric scores, grade-like language, or confidence percentages in user-facing coaching copy unless a hidden/internal field explicitly requires the raw value.",
  ].join("\n");
}

export function buildEvidenceAndArchitectureBlock() {
  return [
    "EVIDENCE AND SYSTEM ANCHORS:",
    "- Communication quality should use chunk-and-check, teach-back, and non-shaming understanding checks instead of yes/no confirmation.",
    "- Guidance should surface options, align to what matters to the HCP, and end with a shared next step or review point.",
    "- Coaching should stay behavior-specific, context-specific, and future-focused rather than personality-based or generic.",
    "- Predictive behavior should be framed as adaptation to changing evidence, observed cues, and pressure shifts, not as a fixed script.",
    "- For ReflectivAI architecture, treat the new Predictive Builder as the behavioral brain and the system engine / standalone SOT as the governing source of truth.",
    `- External evidence references: ${formatSourceList(EXTERNAL_EVIDENCE_SOURCES)}`,
    `- Internal system references: ${formatSourceList(INTERNAL_SYSTEM_ANCHORS)}`,
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
    buildEvidenceAndArchitectureBlock(),
    "RESEARCH-BACKED FIELD RULES:",
    "- Lead with scientific or workflow value before promotional framing.",
    "- Tailor the conversation to specialty, practice pressure, prior context, and the immediate decision moment.",
    "- Treat the exchange as two-way dialogue: diagnose the real barrier before answering it.",
    "- Respect time pressure by narrowing to one relevant point and one forward-driving question.",
    "- Use chunk-and-check when introducing dense material and confirm understanding with reflective or teach-back style phrasing when appropriate.",
    "- End recommendations with a clear shared next step, owner, or review point whenever the context supports it.",
    "- Use only observable behaviors, explicit context, and prompt-provided facts. Never fabricate evidence or claims.",
    "MANAGER COACHING RULES:",
    "- Coach the specific behavior, not the person's personality or intent.",
    "- State impact in terms of HCP trust, relevance, momentum, or next-step clarity.",
    "- Include inquiry: diagnose the pressure point or blind spot before prescribing a fix.",
    "- Finish with a future-focused next move the rep can use in the next interaction.",
    "PREDICTIVE BUILDER / SYSTEM ENGINE RULES:",
    "- Reference the Predictive Builder as the active reasoning layer that adapts to observable cues, state shifts, and changing evidence.",
    "- Reference the standalone system engine and canonical SOT as the governing contract for capability definitions, evaluation ownership, and architecture boundaries.",
    "- Do not describe the predictive layer as magic, intuition, personality reading, or unsupported intent inference.",
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