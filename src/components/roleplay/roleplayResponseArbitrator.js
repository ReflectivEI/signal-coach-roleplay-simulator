function normalizeLine(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function deterministicNarrowingLine({ checkpointType, activeConcern = 'workflow' }) {
  if (checkpointType === 'evidence') {
    return 'I still need one concrete data point and what it changes in my practice this month.';
  }
  if (checkpointType === 'direct_answer') {
    return `Please answer directly: what is the single ${activeConcern} step you recommend first?`;
  }
  return 'Please give one concrete next step tied to this concern.';
}

function localDeterministicRewrite({ text, recentDialogues = [] }) {
  const normalized = normalizeLine(text);
  const normalizedRecent = recentDialogues.map((line) => normalizeLine(line).toLowerCase()).filter(Boolean);
  if (!normalized) return { rewritten: normalized, changed: false, reason: 'empty' };

  if (normalizedRecent.includes(normalized.toLowerCase())) {
    const rewritten = `${normalized.replace(/[.!?]*$/, '')}. Please keep it specific.`;
    return { rewritten, changed: true, reason: 'anti_repeat_local' };
  }

  return { rewritten: normalized, changed: false, reason: 'pass_through' };
}

export function arbitrateRoleplayResponse({
  draftResponse = '',
  plannerContract,
  activeConcern = 'workflow',
  recentDialogues = [],
}) {
  const stages = [];
  let finalResponse = normalizeLine(draftResponse);

  stages.push('stage_1_input_normalized');

  const localRewrite = localDeterministicRewrite({ text: finalResponse, recentDialogues });
  finalResponse = localRewrite.rewritten;
  stages.push(localRewrite.changed ? `stage_2_local_rewrite_${localRewrite.reason}` : 'stage_2_local_rewrite_pass');

  if (plannerContract?.checkpoint?.unmetHardDemand) {
    finalResponse = deterministicNarrowingLine({
      checkpointType: plannerContract?.checkpointType,
      activeConcern,
    });
    stages.push('stage_3_hard_demand_enforced');
  } else {
    stages.push('stage_3_hard_demand_not_needed');
  }

  finalResponse = normalizeLine(finalResponse);
  stages.push('stage_4_final_writer');

  return {
    finalResponse,
    stages,
    localRewrite,
  };
}
