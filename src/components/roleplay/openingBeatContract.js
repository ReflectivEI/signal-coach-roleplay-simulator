const CONCERN_FAMILY_PATTERNS = {
  workflow: /\b(workflow|staff|capacity|process|implementation|operations?)\b/i,
  evidence: /\b(evidence|study|trial|data|outcome|endpoint)\b/i,
  access: /\b(access|prior auth|authorization|coverage|payer|reimbursement)\b/i,
  time: /\b(time|schedule|busy|minute|quick)\b/i,
};

const TONE_PATTERNS = {
  resistant: /\b(not convinced|skeptical|concerned|still unsure|hesitant)\b/i,
  neutral: /\b(understood|okay|walk me through|help me understand)\b/i,
  engaged: /\b(that helps|makes sense|useful|good point|open to)\b/i,
};

function classifyConcernFamily(text = '') {
  const value = String(text || '');
  for (const [family, pattern] of Object.entries(CONCERN_FAMILY_PATTERNS)) {
    if (pattern.test(value)) return family;
  }
  return 'unknown';
}

function classifyTone(text = '') {
  const value = String(text || '');
  for (const [tone, pattern] of Object.entries(TONE_PATTERNS)) {
    if (pattern.test(value)) return tone;
  }
  return 'neutral';
}

export function evaluateOpeningBeatConsistency({ openingScene = '', firstHcpTurn = '' } = {}) {
  const sceneConcern = classifyConcernFamily(openingScene);
  const turnConcern = classifyConcernFamily(firstHcpTurn);
  const sceneTone = classifyTone(openingScene);
  const turnTone = classifyTone(firstHcpTurn);

  return {
    consistentConcernFamily: sceneConcern !== 'unknown' && sceneConcern === turnConcern,
    consistentTone: sceneTone === turnTone,
    sceneConcern,
    turnConcern,
    sceneTone,
    turnTone,
  };
}
