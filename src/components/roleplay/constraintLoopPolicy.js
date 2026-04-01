export function resolveConstraintLoopAction({
  consecutiveBlockCloseTurns = 0,
  repeatedRepPattern = false,
  similarConstraintPrompts = 0,
  activeConcern = 'workflow',
  terminalCloseFallback = 'We can pause here for now.',
} = {}) {
  const structuredDemandByConcern = {
    monitoring: 'We are still not specific enough. Give exactly: (1) monitoring owner, (2) follow-up cadence, (3) escalation trigger for adverse events.',
    workflow: 'We are still not specific enough. Give exactly: (1) who owns the step, (2) where it fits in clinic flow, (3) what workload it replaces.',
    access: 'We are still not specific enough. Give exactly: (1) payer/workflow action, (2) responsible role, (3) same-week implementation step.',
    evidence: 'We are still not specific enough. Give exactly: (1) one clinically meaningful data point, (2) why it applies here, (3) one action it changes.',
    time: 'We are still not specific enough. Give exactly: (1) one under-60-second action, (2) owner, (3) immediate next checkpoint.',
  };

  if (repeatedRepPattern && similarConstraintPrompts >= 3) {
    return { nextHcpState: 'disengaged', nextHcpDialogue: terminalCloseFallback };
  }
  if (consecutiveBlockCloseTurns >= 3) {
    return { nextHcpState: 'disengaged', nextHcpDialogue: terminalCloseFallback };
  }
  if (repeatedRepPattern && similarConstraintPrompts >= 2) {
    return {
      nextHcpState: 'boundary-setting',
      nextHcpDialogue: 'We are looping. Give one practice-ready step with one supporting evidence point, or we should pause here.',
    };
  }
  if (consecutiveBlockCloseTurns >= 2) {
    return {
      nextHcpState: 'boundary-setting',
      nextHcpDialogue: structuredDemandByConcern[activeConcern] || structuredDemandByConcern.workflow,
    };
  }

  return null;
}
