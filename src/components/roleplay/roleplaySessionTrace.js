export function createRoleplaySessionTrace(seed = 'trace-seed') {
  return {
    seed: String(seed || 'trace-seed'),
    turns: [],
  };
}

export function appendSessionTrace(traceState, entry) {
  const nextTurns = [...(traceState?.turns || []), {
    timestamp: new Date().toISOString(),
    ...entry,
  }].slice(-100);

  return {
    ...traceState,
    turns: nextTurns,
  };
}
