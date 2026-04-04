import { extractBaselineObservableEvidence } from './alignmentEngine.jsx';

function normalizeText(value = '') {
  return String(value || '').toLowerCase();
}

function detectConcernShape(text = '') {
  const source = normalizeText(text);
  return {
    evidence: /\b(evidence|data|study|trial|published|proof|endpoint|metric|threshold)\b/.test(source),
    operationalBurden: /\b(workflow|operational|practical|burden|staff(?:ing)?|capacity|admin|administrative|implementation)\b/.test(source),
    access: /\b(access|coverage|covered|payer|prior auth(?:orization)?|reimbursement|affordab(?:le|ility)|out[-\s]?of[-\s]?pocket|co-?pay)\b/.test(source),
    durability: /\b(durability|duration|long[-\s]?term|persistence|sustain(?:ed|ability)?|waning)\b/.test(source),
    workflowFit: /\b(fit|feasible|apply|applicable|in our clinic|in this setting|for our practice|for my patients)\b/.test(source),
  };
}

function hasConcernShapeMatch(repMessage = '', hcpUtterance = '') {
  const repShape = detectConcernShape(repMessage);
  const hcpShape = detectConcernShape(hcpUtterance);
  return (
    (hcpShape.evidence && repShape.evidence)
    || (hcpShape.operationalBurden && repShape.operationalBurden)
    || (hcpShape.access && repShape.access)
    || (hcpShape.durability && repShape.durability)
    || (hcpShape.workflowFit && repShape.workflowFit)
  );
}

function hasAcknowledgmentLanguage(repMessage = '') {
  const rep = normalizeText(repMessage);
  return /\b(i understand|i hear|fair concern|fair point|makes sense|valid concern|that'?s a fair concern|that'?s fair|that'?s reasonable|you'?re right to focus on|you'?re right to raise|that'?s exactly the right question|legitimate concern|i appreciate that concern|i respect that concern|good question)\b/i.test(rep);
}

function hasParaphraseLanguage(repMessage = '') {
  const rep = normalizeText(repMessage);
  return /\b(what i'?m hearing|if i'?m hearing you|it sounds like|you'?re saying|you'?re concerned about|your concern is|you need this to fit|you need practical|you need durable)\b/i.test(rep);
}

function hasDirectConcernAnswer(turn = {}, evidence = {}) {
  const rep = normalizeText(turn?.repMessage || '');
  const directAlignment = Boolean(evidence.directResponseAlignment);
  if (!directAlignment) return false;

  const concernMatched = hasConcernShapeMatch(turn?.repMessage || '', turn?.hcpDialogueBefore || '');
  const recommendationProvided = /\b(recommend|start with|first step|we can|i suggest|use|implement|monitor|threshold|data point|evidence)\b/.test(rep);
  return concernMatched && recommendationProvided;
}

function hasConcernAckFalseNegative(alignment = {}, evidence = {}) {
  const misalignments = [...(alignment?.misalignments || []), ...(alignment?.rubricAlignmentFlags || [])]
    .map((line) => String(line || '').toLowerCase());
  const concernMissFlag = misalignments.some((line) => line.includes('concern not acknowledged') || line.includes('firm boundary not acknowledged'));
  return concernMissFlag && (
    evidence.acknowledgesConcern
    || evidence.concernReflection
    || evidence.directResponseAlignment
    || evidence.workflowPracticalAdaptation
  );
}

function hasConcernAckCoachingRecovery(turn = {}, evidence = {}) {
  const repMessage = turn?.repMessage || '';
  const explicitAck = hasAcknowledgmentLanguage(repMessage);
  const paraphraseAck = hasParaphraseLanguage(repMessage);
  const concernAnswer = hasDirectConcernAnswer(turn, evidence);
  return explicitAck || paraphraseAck || concernAnswer;
}

function hasAdaptationFalseNegative(alignment = {}, evidence = {}) {
  const misalignments = [...(alignment?.misalignments || []), ...(alignment?.rubricAlignmentFlags || [])]
    .map((line) => String(line || '').toLowerCase());
  const adaptationMissFlag = misalignments.some((line) =>
    line.includes('did not adapt')
    || line.includes('time constraint not acknowledged')
    || line.includes('structure not adapted')
    || line.includes('response did not adapt')
  );
  const adapted = evidence.timePressureAdaptation || evidence.workflowPracticalAdaptation || (evidence.directResponseAlignment && evidence.concernReflection);
  return adaptationMissFlag && adapted;
}

export function getBaselineAlignedInlineGuidance({ turn = {}, alignment = {} } = {}) {
  const evidence = extractBaselineObservableEvidence({
    repMessage: turn?.repMessage || '',
    hcpState: turn?.hcpStateBefore || 'neutral',
    hcpUtterance: turn?.hcpDialogueBefore || '',
    cueText: turn?.cueBefore || '',
  });

  if (hasConcernAckFalseNegative(alignment, evidence) && hasConcernAckCoachingRecovery(turn, evidence)) {
    return '✅ You acknowledged the concern. Next, tighten to one concrete, setting-specific action.';
  }

  if (hasAdaptationFalseNegative(alignment, evidence)) {
    return '✅ You adapted to the latest constraint. Keep it concise and anchor one practical next step.';
  }

  return null;
}
