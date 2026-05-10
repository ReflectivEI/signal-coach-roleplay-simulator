const PLATFORM_KEYWORDS = [
  "reflectivai",
  "reflectiv ai",
  "alora",
  "signal intelligence",
  "ai coach",
  "coaching module",
  "coaching modules",
  "role play",
  "roleplay",
  "pre-call",
  "pre call",
  "exercise",
  "scenario",
  "behavioral metrics",
  "performance analytics",
  "data and reports",
  "knowledge base",
  "help center",
  "framework",
  "enablement",
  "platform",
  "dashboard",
  "learning path",
  "pharma",
  "pharmaceutical",
  "life sciences",
  "hcp",
  "healthcare provider",
  "clinical evidence",
  "objection",
  "call opening",
  "follow-up email",
  "follow up email",
  "territory",
  "prescriber",
  "rep",
  "sales coaching",
  "healthcare professional",
  "stakeholder",
  "customer engagement",
  "question mastery",
  "commitment generation",
];

const ANALYTICS_KEYWORDS = [
  "report",
  "reports",
  "data",
  "trend",
  "dashboard",
  "prescriber",
  "prescription",
  "market share",
  "territory",
  "session",
  "score",
  "adoption",
  "manager",
  "cohort",
  "capability",
  "analytics",
  "performance",
  "contacted",
  "export",
];

const COMMON_OFF_TOPIC_PATTERNS = [
  /\bham sandwich\b/i,
  /\brecipe\b/i,
  /\bcook\b/i,
  /\bweather\b/i,
  /\bsports?\b/i,
  /\bmovie\b/i,
  /\bvacation\b/i,
  /\btravel\b/i,
  /\bbitcoin\b/i,
  /\bhomework\b/i,
  /\bmath problem\b/i,
];

function normalize(value = "") {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

export function isTopicAllowed(text, scope = "general") {
  const normalized = normalize(text);
  if (!normalized) return false;
  if (COMMON_OFF_TOPIC_PATTERNS.some((pattern) => pattern.test(text))) return false;

  if (scope === "analytics") {
    return containsKeyword(normalized, ANALYTICS_KEYWORDS) || containsKeyword(normalized, PLATFORM_KEYWORDS);
  }

  return containsKeyword(normalized, PLATFORM_KEYWORDS);
}

export function buildTopicGuardMessage(scope = "general") {
  if (scope === "analytics") {
    return "I can help with ReflectivAI reporting, coaching analytics, performance trends, and sales-data questions only. Please ask about reports, prescriber trends, capability scores, territory performance, or export-ready summaries.";
  }

  if (scope === "platform") {
    return "I’m here to help with ReflectivAI platform usage, Signal Intelligence, and coaching workflows only. Please ask about navigation, tools, modules, reporting, or how to use a feature inside ReflectivAI.";
  }

  return "I can help only with ReflectivAI, Signal Intelligence, pharmaceutical sales coaching, and related platform workflows. Please reframe your question around an HCP interaction, coaching scenario, capability, module, or ReflectivAI feature.";
}

export function getTopicGuardResponse(text, scope = "general") {
  return isTopicAllowed(text, scope) ? null : buildTopicGuardMessage(scope);
}

export function sanitizeAiText(value) {
  return String(value || "")
    .replace(/^```[\w-]*\n?|\n?```$/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}
