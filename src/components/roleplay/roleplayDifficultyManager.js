export const DIFFICULTY_MODES = [
  'novice_support',
  'standard',
  'advanced',
  'expert_pressure',
];

export function deriveDifficultyMode({ recentAlignmentScores = [], missedCueCount = 0 } = {}) {
  const recent = recentAlignmentScores.slice(-3);
  const avg = recent.length
    ? recent.reduce((sum, score) => sum + Number(score || 0), 0) / recent.length
    : 3;

  if (missedCueCount >= 3 || avg <= 2.2) return 'novice_support';
  if (avg >= 4.3 && missedCueCount === 0) return 'expert_pressure';
  if (avg >= 3.5) return 'advanced';
  return 'standard';
}

export function nextToleranceFromDifficulty(mode = 'standard') {
  if (mode === 'novice_support') return { patienceDelta: -1, skepticismDelta: 1, explicitness: 'high' };
  if (mode === 'expert_pressure') return { patienceDelta: 0, skepticismDelta: 1, explicitness: 'low' };
  if (mode === 'advanced') return { patienceDelta: 0, skepticismDelta: 0, explicitness: 'medium' };
  return { patienceDelta: 0, skepticismDelta: 0, explicitness: 'medium' };
}
