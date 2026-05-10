function deterministicIndex(seedText = '', total = 0) {
  const size = Number(total) || 0;
  if (size <= 0) return 0;
  const input = String(seedText || '');
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % size;
}

function normalizeCueText(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function selectContextualCue({
  generationKey = 'session',
  nextTurnNumber = 0,
  nextHcpState = 'neutral',
  activeConcern = 'workflow',
  nextProfileLockedCue = '',
  recentCueText = [],
  responseText = '',
  engagementTier = 'engaged',
  noRepeatWindowTurns = 20,
  cueFactory,
  scenarioBoundFallbackPool = [],
} = {}) {
  const generatedCue = typeof cueFactory === 'function' ? cueFactory() : nextProfileLockedCue;
  const candidateCue = String(generatedCue || nextProfileLockedCue || '').trim();
  if (!candidateCue) return '';

  const fallbackPool = [
    nextProfileLockedCue,
    ...(Array.isArray(scenarioBoundFallbackPool) ? scenarioBoundFallbackPool : []),
  ]
    .map((cue) => String(cue || '').trim())
    .filter(Boolean);

  return enforceNoRecentCueRepeat({
    candidateCue,
    recentCueText,
    noRepeatWindowTurns,
    fallbackPool,
    seed: `${generationKey}:${nextTurnNumber}:${nextHcpState}:${activeConcern}:${engagementTier}:${responseText}`,
  });
}

export function enforceNoRecentCueRepeat({
  candidateCue = '',
  recentCueText = [],
  noRepeatWindowTurns = 20,
  fallbackPool = [],
  seed = '',
} = {}) {
  const normalizedCandidate = normalizeCueText(candidateCue);
  if (!normalizedCandidate) return '';

  const recent = (Array.isArray(recentCueText) ? recentCueText : [])
    .slice(-Math.max(1, Number(noRepeatWindowTurns) || 20))
    .map(normalizeCueText)
    .filter(Boolean);

  if (!recent.includes(normalizedCandidate)) {
    return String(candidateCue).trim();
  }

  const pool = (Array.isArray(fallbackPool) ? fallbackPool : [])
    .map((cue) => String(cue || '').trim())
    .filter(Boolean);

  if (pool.length === 0) {
    return String(candidateCue).trim();
  }

  const startIndex = deterministicIndex(`${seed}:cue-fallback`, pool.length);
  for (let i = 0; i < pool.length; i += 1) {
    const cue = pool[(startIndex + i) % pool.length];
    if (!recent.includes(normalizeCueText(cue))) {
      return cue;
    }
  }

  return String(candidateCue).trim();
}
