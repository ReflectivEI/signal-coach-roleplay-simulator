const SOURCE_ALLOWLIST = [
  {
    id: "who",
    organization: "World Health Organization",
    url: "https://www.who.int",
    domain: "who.int",
    type: "guideline",
    credibilityTier: "high",
  },
  {
    id: "cdc",
    organization: "US Centers for Disease Control and Prevention",
    url: "https://www.cdc.gov",
    domain: "cdc.gov",
    type: "guideline",
    credibilityTier: "high",
  },
  {
    id: "nih",
    organization: "US National Institutes of Health",
    url: "https://www.nih.gov",
    domain: "nih.gov",
    type: "guideline",
    credibilityTier: "high",
  },
  {
    id: "nice",
    organization: "National Institute for Health and Care Excellence",
    url: "https://www.nice.org.uk",
    domain: "nice.org.uk",
    type: "guideline",
    credibilityTier: "high",
  },
  {
    id: "nejm",
    organization: "New England Journal of Medicine",
    url: "https://www.nejm.org",
    domain: "nejm.org",
    type: "journal",
    credibilityTier: "high",
  },
  {
    id: "thelancet",
    organization: "The Lancet",
    url: "https://www.thelancet.com",
    domain: "thelancet.com",
    type: "journal",
    credibilityTier: "high",
  },
  {
    id: "jama",
    organization: "JAMA Network",
    url: "https://jamanetwork.com",
    domain: "jamanetwork.com",
    type: "journal",
    credibilityTier: "high",
  },
  {
    id: "bmj",
    organization: "The BMJ",
    url: "https://www.bmj.com",
    domain: "bmj.com",
    type: "journal",
    credibilityTier: "high",
  },
  {
    id: "acc",
    organization: "American College of Cardiology",
    url: "https://www.acc.org",
    domain: "acc.org",
    type: "society_guideline",
    credibilityTier: "high",
  },
  {
    id: "aha",
    organization: "American Heart Association",
    url: "https://www.heart.org",
    domain: "heart.org",
    type: "society_guideline",
    credibilityTier: "high",
  },
  {
    id: "ers",
    organization: "European Respiratory Society",
    url: "https://www.ersnet.org",
    domain: "ersnet.org",
    type: "society_guideline",
    credibilityTier: "high",
  },
  {
    id: "aan",
    organization: "American Academy of Neurology",
    url: "https://www.aan.com",
    domain: "aan.com",
    type: "society_guideline",
    credibilityTier: "high",
  },
];

const TIER_SCORE = {
  high: 1,
  medium: 0.75,
  low: 0.5,
};

function safeString(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function asIsoDate(value, fallback = new Date().toISOString()) {
  const candidate = safeString(value);
  if (!candidate) return fallback;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => safeString(value)).filter(Boolean))];
}

function normalizeHostname(url = "") {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function resolveSource({ sourceId = "", sourceUrl = "" }) {
  const id = safeString(sourceId).toLowerCase();
  if (id) {
    const byId = SOURCE_ALLOWLIST.find((item) => item.id === id);
    if (byId) return byId;
  }

  const hostname = normalizeHostname(sourceUrl);
  if (!hostname) return null;

  return SOURCE_ALLOWLIST.find((item) => hostname === item.domain || hostname.endsWith(`.${item.domain}`)) || null;
}

function recencyScore(publicationYear, nowYear = new Date().getUTCFullYear()) {
  const year = Number(publicationYear);
  if (!Number.isInteger(year)) return 0.45;
  const age = Math.max(0, nowYear - year);
  if (age <= 1) return 1;
  if (age <= 3) return 0.9;
  if (age <= 5) return 0.8;
  if (age <= 8) return 0.65;
  if (age <= 12) return 0.5;
  return 0.35;
}

function claimStrengthScore(record) {
  const summary = safeString(record.summary || record.abstract || "").toLowerCase();
  const hasPopulation = /\bpatients?\b|\bcohort\b|\bsubgroup\b/.test(summary);
  const hasComparator = /\bversus\b|\bcompared with\b|\bcomparator\b/.test(summary);
  const hasOutcome = /\boutcome\b|\bendpoint\b|\bhazard ratio\b|\babsolute risk\b/.test(summary);

  let score = 0.45;
  if (hasPopulation) score += 0.15;
  if (hasComparator) score += 0.2;
  if (hasOutcome) score += 0.2;

  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

function topicKey(record) {
  const disease = safeString(record.diseaseState || record.domain || "general").toLowerCase();
  const topic = safeString(record.topic || record.claimTopic || record.title || "general").toLowerCase();
  return `${disease}::${topic}`;
}

function normalizeClaimDirection(value) {
  const normalized = safeString(value, "neutral").toLowerCase();
  if (["supports", "challenge", "challenges", "neutral"].includes(normalized)) {
    if (normalized === "challenge") return "challenges";
    return normalized;
  }
  return "neutral";
}

function buildGovernanceScore(record, sourceMeta) {
  const sourceScore = TIER_SCORE[sourceMeta?.credibilityTier] || 0.5;
  const recency = recencyScore(record.publicationYear);
  const claimStrength = claimStrengthScore(record);

  const weighted = (sourceScore * 0.5) + (recency * 0.3) + (claimStrength * 0.2);
  return {
    sourceScore,
    recencyScore: recency,
    claimStrength,
    overallScore: Number(weighted.toFixed(3)),
  };
}

function detectContradictions(records = []) {
  const grouped = new Map();
  for (const record of records) {
    const key = topicKey(record);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(record);
  }

  const contradictionById = new Map();
  let contradictionCount = 0;

  for (const [key, group] of grouped.entries()) {
    const directions = new Set(group.map((item) => normalizeClaimDirection(item.claimDirection)));
    const hasContradiction = directions.has("supports") && directions.has("challenges");
    if (!hasContradiction) continue;

    contradictionCount += 1;
    for (const item of group) {
      contradictionById.set(item.id, {
        contradictionKey: key,
        conflictingDirections: Array.from(directions),
      });
    }
  }

  return {
    contradictionCount,
    contradictionById,
  };
}

function normalizeRecord(raw = {}, sourceMeta) {
  const publicationYear = Number.parseInt(String(raw.publicationYear || raw.year || ""), 10);
  const id = safeString(raw.id) || `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sourceUrl = safeString(raw.sourceUrl || raw.url || sourceMeta?.url || "");

  return {
    id,
    sourceId: safeString(raw.sourceId || sourceMeta?.id || ""),
    sourceOrganization: safeString(raw.sourceOrganization || sourceMeta?.organization || "Unknown Source"),
    sourceUrl,
    title: safeString(raw.title || raw.claimTopic || "Untitled evidence record"),
    summary: safeString(raw.summary || raw.abstract || ""),
    diseaseState: safeString(raw.diseaseState || raw.domain || "general").toLowerCase(),
    topic: safeString(raw.topic || raw.claimTopic || "general").toLowerCase(),
    claimDirection: normalizeClaimDirection(raw.claimDirection),
    publicationYear: Number.isInteger(publicationYear) ? publicationYear : null,
    publishedAt: asIsoDate(raw.publishedAt || raw.publicationDate || undefined),
    tags: uniqueStrings(raw.tags || []),
    ingestedAt: new Date().toISOString(),
  };
}

export function listGovernedSources() {
  return SOURCE_ALLOWLIST.map((item) => ({ ...item }));
}

export function queryGovernedEvidenceRecords(records = [], filters = {}) {
  const domain = safeString(filters.domain || filters.diseaseState).toLowerCase();
  const limit = Math.max(1, Math.min(200, Number(filters.limit || 25)));

  const filtered = records
    .filter((item) => {
      if (!domain) return true;
      return item.diseaseState === domain || item.topic.includes(domain);
    })
    .sort((a, b) => Number(b.governance?.overallScore || 0) - Number(a.governance?.overallScore || 0))
    .slice(0, limit);

  return filtered;
}

export function ingestGovernedEvidenceRecords(existingRecords = [], payloadRecords = []) {
  const rejections = [];
  const accepted = [];

  for (const raw of Array.isArray(payloadRecords) ? payloadRecords : []) {
    const sourceMeta = resolveSource({
      sourceId: raw?.sourceId,
      sourceUrl: raw?.sourceUrl || raw?.url,
    });

    if (!sourceMeta) {
      rejections.push({
        sourceId: safeString(raw?.sourceId || "unknown"),
        title: safeString(raw?.title || "untitled"),
        reason: "source_not_allowlisted",
      });
      continue;
    }

    const normalized = normalizeRecord(raw, sourceMeta);
    const governance = buildGovernanceScore(normalized, sourceMeta);
    accepted.push({
      ...normalized,
      governance,
    });
  }

  const mergedMap = new Map();
  [...existingRecords, ...accepted].forEach((record) => {
    const dedupeKey = `${safeString(record.sourceId).toLowerCase()}::${safeString(record.title).toLowerCase()}::${record.publicationYear || "unknown"}`;
    if (!mergedMap.has(dedupeKey)) {
      mergedMap.set(dedupeKey, record);
      return;
    }

    const prev = mergedMap.get(dedupeKey);
    const prevScore = Number(prev?.governance?.overallScore || 0);
    const nextScore = Number(record?.governance?.overallScore || 0);
    if (nextScore >= prevScore) {
      mergedMap.set(dedupeKey, record);
    }
  });

  const merged = Array.from(mergedMap.values());
  const contradiction = detectContradictions(merged);

  const finalized = merged.map((record) => {
    const contradictionFlag = contradiction.contradictionById.get(record.id) || null;
    return {
      ...record,
      contradictionFlag,
    };
  });

  return {
    records: finalized,
    ingestedCount: accepted.length,
    rejectedCount: rejections.length,
    rejections,
    contradictionCount: contradiction.contradictionCount,
  };
}
