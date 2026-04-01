function detectConcernFamily(text = '') {
  const value = String(text || '').toLowerCase();
  if (/access|coverage|payer|prior auth|authorization/.test(value)) return 'access';
  if (/workflow|staff|capacity|burden|process|implementation/.test(value)) return 'workflow';
  if (/evidence|study|trial|data|methodology|duration/.test(value)) return 'evidence';
  if (/screening|eligibility|candidacy|resistance|monitoring/.test(value)) return 'screening';
  if (/time|busy|minutes|schedule|running late/.test(value)) return 'time';
  return 'general';
}

function detectToneBand(text = '') {
  const value = String(text || '').toLowerCase();
  if (/frustrat|overwhelm|buried|impatient|urgent/.test(value)) return 'pressured';
  if (/skeptic|doubt|not convinced|proof/.test(value)) return 'skeptical';
  if (/warm|glad|good to see|thank you/.test(value)) return 'warm';
  return 'neutral';
}

export function enforceOpeningBeatConsistency({ openingScene = '', candidate = '', activeConcern = 'workflow' } = {}) {
  const openingConcern = detectConcernFamily(openingScene);
  const candidateConcern = detectConcernFamily(candidate);
  const openingTone = detectToneBand(openingScene);
  const candidateTone = detectToneBand(candidate);

  const concernMismatch = openingConcern !== 'general' && candidateConcern !== openingConcern;
  const toneMismatch = openingTone === 'pressured' && candidateTone === 'warm';

  if (!concernMismatch && !toneMismatch) {
    return {
      dialogue: String(candidate || '').trim(),
      preserved: true,
      concernFamily: openingConcern,
      toneBand: openingTone,
    };
  }

  const concernPrompt = openingConcern !== 'general' ? openingConcern : activeConcern;
  const repaired = openingTone === 'pressured'
    ? `Given our ${concernPrompt} pressure, keep this practical and concise—what is the single next step?`
    : `Let's stay focused on ${concernPrompt}. What is the most practical next step in this setting?`;

  return {
    dialogue: repaired,
    preserved: false,
    concernFamily: openingConcern,
    toneBand: openingTone,
  };
}
