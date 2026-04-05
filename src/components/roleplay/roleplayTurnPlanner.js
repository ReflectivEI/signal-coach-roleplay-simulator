import { detectTurnDemands, evaluateCheckpointStatus } from './roleplayCheckpointEngine';
import { deriveDifficultyMode, nextToleranceFromDifficulty } from './roleplayDifficultyManager';

export function createInitialTurnRuntimeState(seed = 'default-seed') {
  return {
    seed: String(seed || 'default-seed'),
    turnIndex: 0,
    missedCueCount: 0,
    unresolvedDemandCount: 0,
    difficultyMode: 'standard',
    activeCheckpoint: null,
    plannerHistory: [],
  };
}

export function planRoleplayTurn({
  runtimeState,
  repMessage = '',
  previousHcpDialogue = '',
  previousCue = '',
  alignmentScore = 3,
  activeConcern = 'workflow',
  activeConstraints = [],
}) {
  const demandSignals = detectTurnDemands({ previousHcpDialogue, currentHcpCue: previousCue });
  const checkpoint = evaluateCheckpointStatus({ repMessage, demandSignals });
  const missedCueCount = checkpoint.unmetHardDemand
    ? Number(runtimeState?.missedCueCount || 0) + 1
    : Math.max(0, Number(runtimeState?.missedCueCount || 0) - 1);
  const unresolvedDemandCount = checkpoint.unmetHardDemand
    ? Number(runtimeState?.unresolvedDemandCount || 0) + 1
    : 0;

  const historicalScores = [
    ...(runtimeState?.plannerHistory || []).map((item) => Number(item?.alignmentScore || 0)),
    Number(alignmentScore || 0),
  ];
  const difficultyMode = deriveDifficultyMode({
    recentAlignmentScores: historicalScores,
    missedCueCount,
  });
  const tolerance = nextToleranceFromDifficulty(difficultyMode);

  const checkpointType = demandSignals.evidenceCheckpointActive
    ? 'evidence'
    : demandSignals.directAnswerRequired
      ? 'direct_answer'
      : null;

  const plannerIntent = checkpoint.unmetHardDemand
    ? 'narrow_and_hold_demand'
    : difficultyMode === 'expert_pressure'
      ? 'increase_nuance'
      : 'progress_with_context';

  const nextRuntimeState = {
    ...runtimeState,
    turnIndex: Number(runtimeState?.turnIndex || 0) + 1,
    missedCueCount,
    unresolvedDemandCount,
    difficultyMode,
    activeCheckpoint: checkpointType,
  };

  const traceEntry = {
    turnIndex: nextRuntimeState.turnIndex,
    activeConcern,
    activeConstraints: [...activeConstraints],
    demandSignals,
    checkpoint,
    missedCueCount,
    unresolvedDemandCount,
    difficultyMode,
    plannerIntent,
    tolerance,
    alignmentScore: Number(alignmentScore || 0),
  };

  nextRuntimeState.plannerHistory = [...(runtimeState?.plannerHistory || []), traceEntry].slice(-30);

  return {
    plannerIntent,
    checkpointType,
    demandSignals,
    checkpoint,
    difficultyMode,
    tolerance,
    nextRuntimeState,
    traceEntry,
  };
}
