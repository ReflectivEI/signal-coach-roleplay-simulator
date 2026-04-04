import { extractBaselineObservableEvidence } from './alignmentEngine';

function hasConcernAckFalseNegative(alignment = {}, evidence = {}) {
  const misalignments = [...(alignment?.misalignments || []), ...(alignment?.rubricAlignmentFlags || [])]
    .map((line) => String(line || '').toLowerCase());
  const concernMissFlag = misalignments.some((line) => line.includes('concern not acknowledged') || line.includes('firm boundary not acknowledged'));
  return concernMissFlag && (evidence.acknowledgesConcern || evidence.concernReflection);
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

  if (hasConcernAckFalseNegative(alignment, evidence)) {
    return '✅ You acknowledged the concern. Next, tighten to one concrete, setting-specific action.';
  }

  if (hasAdaptationFalseNegative(alignment, evidence)) {
    return '✅ You adapted to the latest constraint. Keep it concise and anchor one practical next step.';
  }

  return null;
}
