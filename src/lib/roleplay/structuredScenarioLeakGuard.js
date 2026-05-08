const METADATA_FIELD_KEYS = [
  "objective",
  "goal",
  "tacticalFocus",
  "tactical_focus",
  "stakeholder",
  "hcp",
  "hcpName",
  "hcp_name",
  "hcp_category",
  "hcpMood",
  "specialty",
  "disease_state",
  "diseaseState",
  "influence_driver",
  "keyMessages",
  "challenges",
  "impact",
  "suggestedPhrasing",
];

const CONTRACT_METADATA_SECTION_KEYS = [
  "coachingHooks",
  "predictivePrep",
  "metadataEnvelope",
  "managerIntegration",
  "scenarioIdentity",
  "hcpPersona",
  "constraints",
  "repEvaluationTargets",
];

const STRUCTURED_LABEL_PATTERN = /\b(objective|tactical focus|stakeholder|hcp category|specialty|disease state|key messages?|challenges?|impact|suggested phrasing|persona|runtime behavior tags?)\b/i;
const CREDENTIAL_OR_DESCRIPTOR_PATTERN = /\b(pa-c|pharmd|md|d\.o\.|do|np|rn|oncology practice|medical oncology|gu oncology|process-focused|process focused|patient-centered|patient centered)\b/i;

function normalizeLeakText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function flattenMetadataValue(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((item) => flattenMetadataValue(item));
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([key]) => METADATA_FIELD_KEYS.includes(key))
      .flatMap(([, nested]) => flattenMetadataValue(nested));
  }
  return [String(value)];
}

function flattenAllPrimitiveValues(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((item) => flattenAllPrimitiveValues(item));
  if (typeof value === "object") return Object.values(value).flatMap((nested) => flattenAllPrimitiveValues(nested));
  return [String(value)];
}

function splitMetadataAnchor(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return [];

  const chunks = raw
    .split(/[.;|]+|\s+-\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return [raw, ...chunks]
    .map((chunk) => chunk.replace(/\s+/g, " ").trim())
    .filter((chunk) => chunk.length >= 10 && chunk.length <= 180);
}

export function collectScenarioMetadataLeakAnchors(scenario = {}, runtimeContract = {}) {
  const sources = [];

  for (const key of METADATA_FIELD_KEYS) {
    sources.push(...flattenMetadataValue(scenario?.[key]));
  }

  sources.push(...flattenMetadataValue(runtimeContract?.hiddenAuthoringContextText));
  sources.push(...flattenMetadataValue(runtimeContract?.hiddenAuthoringContext));
  for (const key of CONTRACT_METADATA_SECTION_KEYS) {
    sources.push(...flattenAllPrimitiveValues(runtimeContract?.[key]));
  }

  const anchors = sources
    .flatMap(splitMetadataAnchor)
    .map((anchor) => ({
      raw: anchor,
      normalized: normalizeLeakText(anchor),
    }))
    .filter((anchor) => anchor.normalized.length >= 10);

  const seen = new Set();
  return anchors.filter((anchor) => {
    if (seen.has(anchor.normalized)) return false;
    seen.add(anchor.normalized);
    return true;
  });
}

function findFirstAnchorIndex(dialogueText = "", anchorHits = []) {
  const lowerDialogue = String(dialogueText || "").toLowerCase();
  let earliest = -1;
  for (const anchor of anchorHits) {
    const raw = String(anchor || "").trim();
    if (!raw) continue;
    const directIndex = lowerDialogue.indexOf(raw.toLowerCase());
    if (directIndex >= 0 && (earliest < 0 || directIndex < earliest)) earliest = directIndex;
  }
  return earliest;
}

function cleanDialoguePrefix(prefix = "") {
  return String(prefix || "")
    .replace(/[\s'"“”‘’,:;|-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function repairStructuredScenarioContentLeak({
  dialogueText = "",
  scenario = {},
  runtimeContract = {},
  fallbackDialogue = "",
} = {}) {
  const leakCheck = detectStructuredScenarioContentLeak({ dialogueText, scenario, runtimeContract });
  if (!leakCheck.leaked) return String(dialogueText || "").trim();

  const anchorIndex = findFirstAnchorIndex(dialogueText, leakCheck.anchorHits);
  if (anchorIndex > 0) {
    const prefix = cleanDialoguePrefix(String(dialogueText || "").slice(0, anchorIndex));
    if (prefix.split(/\s+/).filter(Boolean).length >= 4) return prefix;
  }

  const labelSplit = String(dialogueText || "").split(STRUCTURED_LABEL_PATTERN)[0];
  const cleanedLabelPrefix = cleanDialoguePrefix(labelSplit);
  if (cleanedLabelPrefix.split(/\s+/).filter(Boolean).length >= 4) return cleanedLabelPrefix;

  return String(fallbackDialogue || "I need one concrete answer tied to the point in front of us.").trim();
}

export function detectStructuredScenarioContentLeak({
  dialogueText = "",
  scenario = {},
  runtimeContract = {},
} = {}) {
  const normalizedDialogue = normalizeLeakText(dialogueText);
  if (!normalizedDialogue) {
    return {
      leaked: false,
      anchorHits: [],
      structuredLabelLeak: false,
      descriptorLeak: false,
    };
  }

  const anchors = collectScenarioMetadataLeakAnchors(scenario, runtimeContract);
  const anchorHits = anchors.filter((anchor) => normalizedDialogue.includes(anchor.normalized));
  const longAnchorHit = anchorHits.some((anchor) => anchor.normalized.length >= 42);
  const structuredLabelLeak = STRUCTURED_LABEL_PATTERN.test(dialogueText);
  const descriptorLeak = CREDENTIAL_OR_DESCRIPTOR_PATTERN.test(dialogueText);
  const metadataClusterLeak = anchorHits.length >= 2;
  const singleMetadataFragmentLeak = longAnchorHit && (descriptorLeak || structuredLabelLeak || /\b(challenges?|key messages?|impact)\b/i.test(dialogueText));

  return {
    leaked: metadataClusterLeak || singleMetadataFragmentLeak,
    anchorHits: anchorHits.map((anchor) => anchor.raw),
    structuredLabelLeak,
    descriptorLeak,
  };
}
