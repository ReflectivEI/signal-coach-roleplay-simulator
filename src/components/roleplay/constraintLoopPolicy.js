function normalizeText(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(value = '') {
  return normalizeText(value).split(' ').filter((token) => token.length > 2);
}

function overlapRatio(a = '', b = '') {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  return overlap / Math.max(aTokens.size, bTokens.size);
}

export function computeAuxiliaryProgressionScore({
  constraintType = '',
  repMessage = '',
  hcpPrompt = '',
  previousRepMessage = '',
} = {}) {
  const rep = normalizeText(repMessage);
  if (!rep) return 0;

  const constraint = String(constraintType || '').toLowerCase();
  const repWordCount = rep.split(' ').filter(Boolean).length;
  const specificitySignal = /\b(one|first|step|owner|timeline|week|day|percent|%|rate|threshold|checklist|protocol)\b/.test(rep);
  const operationalSignal = /\b(workflow|staff|capacity|handoff|prior auth|discharge|clinic|setting|implementation|process)\b/.test(rep);
  const acknowledgmentSignal = /\b(i hear|you raised|you mentioned|fair point|you are right|that concern)\b/.test(rep);
  const evidenceSignal = /\b(study|trial|data|outcome|published|cohort|endpoint|benchmark)\b/.test(rep);
  const contextualSignal = overlapRatio(rep, hcpPrompt) >= 0.28;
  const noveltySignal = previousRepMessage ? overlapRatio(rep, previousRepMessage) < 0.86 : true;

  const typeRelevance = (() => {
    if (constraint === 'request_for_evidence') return evidenceSignal || specificitySignal;
    if (constraint === 'request_for_operational_fit') return operationalSignal || specificitySignal;
    if (constraint === 'request_for_applicability') return /\b(your|this|our)\s+(clinic|setting|team|patients|practice)\b/.test(rep);
    if (constraint === 'request_for_specificity') return specificitySignal;
    if (constraint === 'request_for_clarification') return /\b(clarify|in other words|meaning|step by step)\b/.test(rep) || specificitySignal;
    return specificitySignal || operationalSignal || evidenceSignal;
  })();

  let score = 0;
  if (specificitySignal) score += 0.24;
  if (contextualSignal) score += 0.2;
  if (acknowledgmentSignal) score += 0.12;
  if (operationalSignal || evidenceSignal) score += 0.2;
  if (typeRelevance) score += 0.16;
  if (noveltySignal) score += 0.12;
  if (repWordCount > 180) score -= 0.05;
  if (repWordCount < 8) score -= 0.08;
  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

export function detectDiminishingReturns({
  progressionScoreHistory = [],
  repeatedRepPattern = false,
  similarConstraintPrompts = 0,
  recentRepMessages = [],
} = {}) {
  const history = Array.isArray(progressionScoreHistory) ? progressionScoreHistory.slice(-3) : [];
  const avgHistory = history.length ? history.reduce((sum, value) => sum + Number(value || 0), 0) / history.length : 0;
  const plateauingProgress = history.length >= 2 && Math.abs(history[history.length - 1] - history[0]) <= 0.08;
  const lowNoveltyReps = Array.isArray(recentRepMessages)
    && recentRepMessages.length >= 3
    && overlapRatio(recentRepMessages[recentRepMessages.length - 1], recentRepMessages[recentRepMessages.length - 2]) >= 0.82
    && overlapRatio(recentRepMessages[recentRepMessages.length - 2], recentRepMessages[recentRepMessages.length - 3]) >= 0.82;

  return Boolean(
    (repeatedRepPattern && similarConstraintPrompts >= 2)
    || (plateauingProgress && avgHistory >= 0.5 && similarConstraintPrompts >= 2)
    || (lowNoveltyReps && avgHistory >= 0.55)
  );
}

export function resolveConstraintLoopAction({
  consecutiveBlockCloseTurns = 0,
  repeatedRepPattern = false,
  similarConstraintPrompts = 0,
  activeConcern = 'workflow',
  terminalCloseFallback = 'We can pause here for now.',
  hasMaterialProgression = false,
  hasFunctionalResolution = false,
  diminishingReturnsDetected = false,
} = {}) {
  const structuredDemandByConcern = {
    monitoring: 'We are still not specific enough. Give exactly: (1) monitoring owner, (2) follow-up cadence, (3) escalation trigger for adverse events.',
    workflow: 'We are still not specific enough. Give exactly: (1) who owns the step, (2) where it fits in clinic flow, (3) what workload it replaces.',
    access: 'We are still not specific enough. Give exactly: (1) payer/workflow action, (2) responsible role, (3) same-week implementation step.',
    evidence: 'We are still not specific enough. Give exactly: (1) one clinically meaningful data point, (2) why it applies here, (3) one action it changes.',
    time: 'We are still not specific enough. Give exactly: (1) one under-60-second action, (2) owner, (3) immediate next checkpoint.',
  };

  if (hasFunctionalResolution) return null;

  const effectiveSimilarity = diminishingReturnsDetected
    ? Math.max(similarConstraintPrompts, 2)
    : similarConstraintPrompts;

  if (!hasMaterialProgression && repeatedRepPattern && effectiveSimilarity >= 3) {
    return { nextHcpState: 'disengaged', nextHcpDialogue: terminalCloseFallback };
  }
  if (!hasMaterialProgression && consecutiveBlockCloseTurns >= 3) {
    return { nextHcpState: 'disengaged', nextHcpDialogue: terminalCloseFallback };
  }
  if (!hasMaterialProgression && repeatedRepPattern && effectiveSimilarity >= 2) {
    return {
      nextHcpState: 'boundary-setting',
      nextHcpDialogue: 'We are looping. Give one practice-ready step with one supporting evidence point, or we should pause here.',
    };
  }
  if (!hasMaterialProgression && consecutiveBlockCloseTurns >= 2) {
    return {
      nextHcpState: 'boundary-setting',
      nextHcpDialogue: structuredDemandByConcern[activeConcern] || structuredDemandByConcern.workflow,
    };
  }

  return null;
}
