function normalize(value = "") {
  return String(value || "").trim();
}

function collectTokens(text = "") {
  return normalize(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4);
}

function lexicalOverlapCount(sourceA = "", sourceB = "") {
  const a = new Set(collectTokens(sourceA));
  const b = new Set(collectTokens(sourceB));
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  return overlap;
}

export function detectEvidenceArtifacts(repMessage = "") {
  const source = normalize(repMessage);
  const lower = source.toLowerCase();

  const namedStudy = /\b(?:[A-Z]{3,}[0-9-]*|phase\s+[2-4]|randomized|meta-analysis)\b/.test(source)
    || /\b(study|trial|cohort|registry)\s+(?:called|named)\s+[A-Z][A-Za-z0-9-]+\b/.test(source);
  const numericOutcome = /\b\d+(?:\.\d+)?\s*(?:%|percent|copies\/?ml|events?\s*per|per\s*1000|hr|hazard ratio|rr|risk ratio|or|odds ratio|nnt|rate)\b|(?:\b\d+(?:\.\d+)?%)/i.test(source);
  const guidelineReference = /\b(CDC|NCCN|IDSA|USPSTF|AHA|ACC|ASCO|WHO|DHHS|FDA\s+label)\b/i.test(source);
  const comparativeClaim = /\b(reduc(?:e|ed|es|tion)|improv(?:e|ed|es|ement)|increase(?:d|s)?|lower(?:ed)?|higher|vs\.?|versus|compared\s+to)\b/.test(lower);

  return {
    namedStudy,
    numericOutcome,
    guidelineReference,
    comparativeClaim,
    hasConcreteEvidenceArtifact: namedStudy || numericOutcome || guidelineReference || comparativeClaim,
  };
}

export function satisfiesEvidenceDemandBinding({ repMessage = "", hcpPrompt = "" } = {}) {
  const evidence = detectEvidenceArtifacts(repMessage);
  if (!evidence.hasConcreteEvidenceArtifact) return false;

  const contextualTie = /\b(your\s+(?:clinic|practice|patients|setting)|in\s+this\s+(?:clinic|setting|practice)|for\s+your\s+(?:patients|team|clinic)|for\s+this\s+(?:clinic|setting|practice))\b/i.test(repMessage)
    || lexicalOverlapCount(repMessage, hcpPrompt) >= 1;

  return contextualTie;
}
