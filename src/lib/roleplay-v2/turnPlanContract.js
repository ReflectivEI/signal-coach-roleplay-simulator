const TURN_PLAN_VERSION = 'v2.0.0';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.getOwnPropertyNames(value).forEach((key) => {
    const nested = value[key];
    if (nested && (typeof nested === 'object' || typeof nested === 'function')) {
      deepFreeze(nested);
    }
  });
  return value;
}

function safeString(value) {
  return String(value || '').trim();
}

export function buildTurnPlan(input = {}) {
  const turnNumber = Number.isFinite(input.turnNumber) ? input.turnNumber : 0;
  const dialogue = safeString(input.nextDialogue || 'I can give you one focused minute—what is the most practical issue to solve first?');
  const cue = safeString(input.nextCue || 'The HCP stays attentive, waiting for one concrete and relevant point.');
  const state = safeString(input.nextState || 'neutral');

  const normalized = {
    version: TURN_PLAN_VERSION,
    turnNumber,
    nextDialogue: dialogue,
    nextCue: cue,
    nextState: state,
    constraintDecision: {
      mode: safeString(input.constraintDecision?.mode || 'none'),
      reason: safeString(input.constraintDecision?.reason || ''),
      blocking: Boolean(input.constraintDecision?.blocking),
    },
    metadata: {
      scenarioId: safeString(input.metadata?.scenarioId || ''),
      concern: safeString(input.metadata?.concern || ''),
      source: safeString(input.metadata?.source || 'roleplay_v2_scaffold'),
    },
  };

  return deepFreeze(normalized);
}

export function validateTurnPlan(plan) {
  const issues = [];
  if (!plan || typeof plan !== 'object') issues.push('plan_not_object');
  if (safeString(plan?.version) !== TURN_PLAN_VERSION) issues.push('unsupported_version');
  if (!Number.isFinite(plan?.turnNumber)) issues.push('turn_number_invalid');
  if (!safeString(plan?.nextDialogue)) issues.push('missing_next_dialogue');
  if (!safeString(plan?.nextCue)) issues.push('missing_next_cue');
  if (!safeString(plan?.nextState)) issues.push('missing_next_state');
  if (!plan?.constraintDecision || typeof plan.constraintDecision !== 'object') issues.push('missing_constraint_decision');
  if (!plan?.metadata || typeof plan.metadata !== 'object') issues.push('missing_metadata');

  return {
    valid: issues.length === 0,
    issues,
  };
}

export { TURN_PLAN_VERSION };
