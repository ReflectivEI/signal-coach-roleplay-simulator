const DEFAULT_NO_REPEAT_WINDOW_TURNS = 20;

function deterministicIndex(seedText, total) {
  if (!Number.isFinite(total) || total <= 0) return 0;
  const seed = String(seedText || "cue-seed");
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % total;
}

function normalizeCue(cue = "") {
  return String(cue || "").trim().toLowerCase();
}

function selectFirstNonRepeating(pool = [], startIndex = 0, recentCues = []) {
  if (!Array.isArray(pool) || pool.length === 0) return "";
  const normalizedRecent = new Set((recentCues || []).map(normalizeCue).filter(Boolean));

  let selected = pool[startIndex] || pool[0];
  for (let i = 0; i < pool.length; i += 1) {
    const candidate = String(pool[(startIndex + i) % pool.length] || "").trim();
    if (!candidate) continue;
    if (!normalizedRecent.has(normalizeCue(candidate))) {
      selected = candidate;
      break;
    }
  }

  return selected;
}

export function selectContextualCue({
  terminalDecisionMode = false,
  generationKey = "",
  nextTurnNumber = 1,
  nextHcpState = "neutral",
  activeConcern = "workflow",
  nextProfileLockedCue = "",
  recentCueText = [],
  responseText = "",
  engagementTier = "engaged",
  noRepeatWindowTurns = DEFAULT_NO_REPEAT_WINDOW_TURNS,
  terminalDecisionCues = [],
  decayCueBuckets = {},
  cueFactory,
} = {}) {
  const boundedRecentCueText = (recentCueText || []).slice(-noRepeatWindowTurns);

  if (terminalDecisionMode && terminalDecisionCues.length > 0) {
    const terminalIndex = deterministicIndex(
      `${generationKey}:${nextTurnNumber}:${activeConcern}:terminal-cue`,
      terminalDecisionCues.length,
    );
    const rawTerminalCue = terminalDecisionCues[terminalIndex] || terminalDecisionCues[0];

    if (!boundedRecentCueText.includes(rawTerminalCue)) {
      return rawTerminalCue;
    }
  }

  let baseCue = "";
  if (typeof cueFactory === "function") {
    baseCue = cueFactory({
      responseText,
      engagementTier,
      recentCueText: boundedRecentCueText,
    });
  }

  const fallbackPool = [
    baseCue,
    nextProfileLockedCue,
    "The HCP pauses, clearly expecting something more useful.",
    "The HCP glances at the clock, patience thinning.",
    "The HCP shifts posture slightly, less engaged.",
    "The HCP waits with clipped attention for one practical answer.",
    ...((decayCueBuckets?.[engagementTier] || []).slice(0, 3)),
  ].map((cue) => String(cue || "").trim()).filter(Boolean);

  if (fallbackPool.length === 0) return "";

  const startIndex = deterministicIndex(
    `${generationKey}:${nextTurnNumber}:${nextHcpState}:${engagementTier}:${responseText.slice(0, 120)}`,
    fallbackPool.length,
  );

  return selectFirstNonRepeating(fallbackPool, startIndex, boundedRecentCueText);
}

export function enforceNoRecentCueRepeat({
  candidateCue = "",
  recentCueText = [],
  noRepeatWindowTurns = DEFAULT_NO_REPEAT_WINDOW_TURNS,
  fallbackPool = [],
  seed = "",
} = {}) {
  const normalizedCandidate = normalizeCue(candidateCue);
  const boundedRecentCueText = (recentCueText || []).slice(-noRepeatWindowTurns);
  const normalizedRecent = boundedRecentCueText.map(normalizeCue).filter(Boolean);

  if (normalizedCandidate && !normalizedRecent.includes(normalizedCandidate)) {
    return String(candidateCue || "").trim();
  }

  const cleanedFallbackPool = fallbackPool
    .map((cue) => String(cue || "").trim())
    .filter(Boolean);

  if (cleanedFallbackPool.length === 0) {
    return String(candidateCue || "").trim();
  }

  const startIndex = deterministicIndex(seed || "cue-fallback", cleanedFallbackPool.length);
  return selectFirstNonRepeating(cleanedFallbackPool, startIndex, boundedRecentCueText);
}
