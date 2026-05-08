import { buildPredictiveProfile, PREDICTIVE_SELECTOR_OPTIONS } from "./predictiveBuilderModel";
import { PREDICTIVE_REFERENCE_APPENDIX } from "./predictiveReferences";

function asTrimmedText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function uniqueNonEmpty(values = []) {
  const seen = new Set();
  return values
    .map(asTrimmedText)
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function resolveOptionLabel(optionGroup = [], value = "") {
  const normalizedValue = asTrimmedText(value);
  return optionGroup.find((option) => option.value === normalizedValue)?.label || normalizedValue || "not supplied";
}

export function buildPredictiveSelectionLabels(selection = {}) {
  return {
    diseaseState: resolveOptionLabel(PREDICTIVE_SELECTOR_OPTIONS.diseaseState, selection.diseaseState),
    hcpType: resolveOptionLabel(PREDICTIVE_SELECTOR_OPTIONS.hcpType, selection.hcpType),
    journeyStage: resolveOptionLabel(PREDICTIVE_SELECTOR_OPTIONS.journeyStage, selection.journeyStage),
    interactionPressure: resolveOptionLabel(PREDICTIVE_SELECTOR_OPTIONS.interactionPressure, selection.interactionPressure),
    influenceDriver: resolveOptionLabel(PREDICTIVE_SELECTOR_OPTIONS.influenceDriver, selection.influenceDriver),
    behaviorArchetype: resolveOptionLabel(PREDICTIVE_SELECTOR_OPTIONS.behaviorArchetype, selection.behaviorArchetype),
  };
}

function formatPredictiveSection(section, label) {
  if (!section) return [];

  const lines = [`${label}: ${asTrimmedText(section.headline || "not supplied")}`];
  const keyFactors = uniqueNonEmpty(section.keyFactors || []).slice(0, 3);
  const predictiveSignals = uniqueNonEmpty(section.predictiveSignals || []).slice(0, 2);
  const repMoves = uniqueNonEmpty(section.repMoves || []).slice(0, 2);

  if (keyFactors.length) lines.push(`  Key factors: ${keyFactors.join(" | ")}`);
  if (predictiveSignals.length) lines.push(`  Predictive signals: ${predictiveSignals.join(" | ")}`);
  if (repMoves.length) lines.push(`  Rep moves: ${repMoves.join(" | ")}`);

  return lines;
}

function formatEvidenceLine(record = {}) {
  const title = asTrimmedText(record.title || record.headline || record.sourceTitle || record.organization || "Evidence highlight");
  const summary = asTrimmedText(record.summary || record.snippet || record.finding || record.description || "");
  const url = asTrimmedText(record.url || record.sourceUrl || "");
  return `- ${title}${summary ? `: ${summary}` : ""}${url ? ` | ${url}` : ""}`;
}

function formatReferencePromptLine(reference = {}) {
  const title = asTrimmedText(reference.title || reference.organization || "Reference");
  const organization = asTrimmedText(reference.organization || reference.publisher || "Source");
  const year = asTrimmedText(reference.year || "2024");
  const url = asTrimmedText(reference.url || "");
  return `- ${organization} — ${title} (${year})${url ? ` | ${url}` : ""}`;
}

function resolveReferenceDomain(predictiveLens = {}, scenario = {}) {
  return asTrimmedText(
    predictiveLens?.selection?.diseaseState
      || predictiveLens?.evidenceRecords?.[0]?.domain
      || predictiveLens?.domain
      || scenario?.diseaseState
      || ""
  ).toLowerCase();
}

export function buildPredictiveGroundingBlock(predictiveLens = null, scenario = null, options = {}) {
  const sectionLabels = options.sectionLabels || {
    mindset: "HCP mindset",
    objections: "Likely objections",
    pressure: "Pressure signals",
    redFlags: "Red flags",
    languageWorks: "Language that works",
    languageResistance: "Language that triggers resistance",
    responseStyle: "Predicted response style",
    repApproach: "Recommended rep approach",
  };
  const heading = options.heading || "=== PREDICTIVE BUILDER GROUNDING (MANDATORY USE) ===";
  const appendixHeading = options.appendixHeading || "Reference appendix (allowed grounding only — do not invent beyond this list):";

  const hasPredictiveLens = Boolean(predictiveLens?.sections || predictiveLens?.hcpPerspective || predictiveLens?.repPreparation || predictiveLens?.selection);
  const evidenceRecords = Array.isArray(predictiveLens?.evidenceRecords) ? predictiveLens.evidenceRecords : [];
  const referenceDomain = resolveReferenceDomain(predictiveLens, scenario || {});
  const appendixReferences = PREDICTIVE_REFERENCE_APPENDIX
    .filter((reference) => {
      if (!referenceDomain) return reference.domain === "cross-domain";
      return reference.domain === referenceDomain || reference.domain === "cross-domain";
    })
    .slice(0, 6);

  if (!hasPredictiveLens && !evidenceRecords.length && !appendixReferences.length) {
    return "";
  }

  const selection = predictiveLens?.selection || {};
  const labels = buildPredictiveSelectionLabels(selection);
  const sections = predictiveLens?.sections || {};
  const sectionLines = Object.entries(sectionLabels).flatMap(([key, label]) => formatPredictiveSection(sections?.[key], label));
  const hcpPerspective = predictiveLens?.hcpPerspective || {};
  const repPreparation = predictiveLens?.repPreparation || {};
  const evidenceLines = evidenceRecords.slice(0, 5).map(formatEvidenceLine);

  return [
    heading,
    `Synthesis source: ${asTrimmedText(predictiveLens?.synthesisSource || predictiveLens?.source || "not supplied")}`,
    `Specialist frame: ${asTrimmedText(predictiveLens?.specialistTitle || predictiveLens?.specialistFrame || "not supplied")}`,
    `Seed disease state: ${labels.diseaseState}`,
    `Seed HCP type: ${labels.hcpType}`,
    `Seed journey stage: ${labels.journeyStage}`,
    `Seed interaction pressure: ${labels.interactionPressure}`,
    `Seed influence driver: ${labels.influenceDriver}`,
    `Seed behavior archetype: ${labels.behaviorArchetype}`,
    ...sectionLines,
    `HCP internal monologue: ${asTrimmedText(hcpPerspective.internalMonologue || predictiveLens?.internalMonologue || "not supplied")}`,
    `Equality test question: ${asTrimmedText(hcpPerspective.equalityTestQuestion || predictiveLens?.equalityTestQuestion || "not supplied")}`,
    `Rep conversation frame: ${asTrimmedText(repPreparation.conversationFrame || predictiveLens?.conversationFrame || "not supplied")}`,
    `Rep proof point priority: ${asTrimmedText(repPreparation.proofPointPriority || predictiveLens?.proofPointPriority || "not supplied")}`,
    ...(evidenceLines.length ? ["Evidence highlights:", ...evidenceLines] : []),
    ...(appendixReferences.length ? [appendixHeading, ...appendixReferences.map(formatReferencePromptLine)] : []),
  ].join("\n").trim();
}

export function buildScenarioPredictiveLens(selection = {}, options = {}) {
  const profile = buildPredictiveProfile(selection);
  const sections = profile?.sections || {};

  return {
    selection,
    source: options.source || "deterministic",
    synthesisSource: options.source || "deterministic",
    specialistTitle: options.specialistTitle || "Clinical Specialist",
    domain: selection?.diseaseState || "",
    sections,
    hcpPerspective: {
      internalMonologue: profile?.mindset || sections?.mindset?.hcpLens || "",
      equalityTestQuestion: sections?.mindset?.predictiveSignals?.[0] || "",
    },
    repPreparation: {
      conversationFrame: profile?.recommendedRepApproach || sections?.repApproach?.repLens || "",
      proofPointPriority: sections?.languageWorks?.keyFactors?.[0] || sections?.repApproach?.keyFactors?.[0] || "",
    },
    evidenceRecords: [],
  };
}

export function normalizePredictiveLensFromRuntime(runtimeData = null, fallbackSelection = null, fallbackSpecialistTitle = "Clinical Specialist") {
  if (!runtimeData && !fallbackSelection) return null;
  if (runtimeData?.selection || runtimeData?.lens || runtimeData?.evidenceRecords) {
    return {
      selection: runtimeData?.selection || fallbackSelection || {},
      synthesisSource: runtimeData?.synthesisSource || runtimeData?.source || "deterministic",
      source: runtimeData?.synthesisSource || runtimeData?.source || "deterministic",
      specialistTitle: runtimeData?.specialistTitle || fallbackSpecialistTitle,
      evidenceRecords: runtimeData?.evidenceRecords || [],
      sections: runtimeData?.lens?.sections || runtimeData?.sections || null,
      hcpPerspective: runtimeData?.lens?.hcpPerspective || runtimeData?.hcpPerspective || null,
      repPreparation: runtimeData?.lens?.repPreparation || runtimeData?.repPreparation || null,
    };
  }

  return buildScenarioPredictiveLens(fallbackSelection || {}, { specialistTitle: fallbackSpecialistTitle });
}