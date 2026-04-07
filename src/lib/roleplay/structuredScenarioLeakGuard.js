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
