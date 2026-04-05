const DIRECT_QUESTION_PATTERN = /\?/;
const EVIDENCE_DEMAND_PATTERN = /\b(evidence|data|study|proof|published|metric|outcome|clinically meaningful|real[-\s]?world|endpoint)\b/i;
const CONCRETE_EVIDENCE_PATTERN = /(\b\d+(?:\.\d+)?\s?(?:%|patients?|days?|weeks?|months?|copies\/mL|mg|ml)\b|\bphase\s?[1-4]\b|\brandomized\b|\bcohort\b|\bmeta-analysis\b)/i;
const PRACTICE_RELEVANCE_PATTERN = /\b(clinic|workflow|practice|patients?|screening|follow-?up|prior auth|access|team|this month|this week|implementation)\b/i;

export function detectTurnDemands({ previousHcpDialogue = '', currentHcpCue = '' } = {}) {
  const source = `${previousHcpDialogue} ${currentHcpCue}`.trim();
  const directAnswerRequired = DIRECT_QUESTION_PATTERN.test(source);
  const evidenceCheckpointActive = EVIDENCE_DEMAND_PATTERN.test(source);
  return {
    directAnswerRequired,
    evidenceCheckpointActive,
    demandText: source,
  };
}

export function validateEvidenceCheckpoint(repMessage = '', demandText = '') {
  const rep = String(repMessage || '');
  const demand = String(demandText || '');
  const acknowledgesConcern = demand
    ? rep.toLowerCase().includes(demand.toLowerCase().split(/\s+/).slice(0, 3).join(' '))
      || /\b(you asked|your concern|to your question|specifically)\b/i.test(rep)
    : /\b(specifically|you asked|your concern)\b/i.test(rep);
  const hasConcreteEvidencePoint = CONCRETE_EVIDENCE_PATTERN.test(rep);
  const hasPracticeImplication = PRACTICE_RELEVANCE_PATTERN.test(rep);

  const passed = acknowledgesConcern && hasConcreteEvidencePoint && hasPracticeImplication;
  return {
    passed,
    acknowledgesConcern,
    hasConcreteEvidencePoint,
    hasPracticeImplication,
  };
}

export function validateDirectAnswer(repMessage = '') {
  const rep = String(repMessage || '').trim();
  const tooVague = rep.length < 20 || /\b(great question|it depends|we can discuss|let me follow up|absolutely|totally)\b/i.test(rep);
  const hasConcreteAnchor = /\b(first|second|step|start|use|track|check|by\s+\w+day|\d+|specific)\b/i.test(rep);
  return {
    passed: !tooVague && hasConcreteAnchor,
    tooVague,
    hasConcreteAnchor,
  };
}

export function evaluateCheckpointStatus({ repMessage = '', demandSignals } = {}) {
  const direct = demandSignals?.directAnswerRequired ? validateDirectAnswer(repMessage) : null;
  const evidence = demandSignals?.evidenceCheckpointActive
    ? validateEvidenceCheckpoint(repMessage, demandSignals?.demandText)
    : null;

  return {
    direct,
    evidence,
    unmetHardDemand: Boolean(
      (direct && !direct.passed) || (evidence && !evidence.passed)
    ),
  };
}
