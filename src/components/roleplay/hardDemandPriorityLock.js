import { DEMAND_TYPES } from "./interventionEngineV2.js";
import { isExplicitOperationalBlockerPrompt } from "./operationalConstraintGuardrails.js";

const HARD_DEMAND_TYPES = new Set([
  DEMAND_TYPES.EVIDENCE_REQUEST,
  DEMAND_TYPES.PROOF_POINT_REQUEST,
  DEMAND_TYPES.DIRECT_ANSWER_REQUIRED,
  DEMAND_TYPES.SINGLE_POINT_REQUIRED,
  DEMAND_TYPES.ONE_STEP_REQUIRED,
  DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED,
]);

function normalizeText(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function createInitialHardDemandPriorityState() {
  return {
    activeHardDemand: null,
    hardDemandType: null,
    hardDemandSourceTurn: null,
    hardDemandPriorityLock: false,
    hardDemandUnresolved: false,
    hardDemandReleaseReason: null,
    pendingSecondaryConcerns: [],
    narrowingLevel: 0,
    supersessionReason: null,
    lockedPlannerObjective: null,
    objectiveOverrideBlocked: false,
  };
}

export function isHardDemandType(demandType = "") {
  return HARD_DEMAND_TYPES.has(demandType);
}

export function detectOperationalDirectBlocker(text = "") {
  const normalized = normalizeText(text);
  return isExplicitOperationalBlockerPrompt(normalized);
}

function withBufferedSecondary(previous = [], nextConcern = "") {
  const concern = String(nextConcern || "").trim();
  if (!concern) return previous;
  if (previous.includes(concern)) return previous;
  return [...previous, concern].slice(-8);
}

export function updateHardDemandPriorityState(previousState, {
  activeDemand = null,
  hcpPrompt = "",
  activeConcern = "",
  turnNumber = null,
  terminalExit = false,
  materiallyStrongerBlocker = false,
  supersessionReason = null,
} = {}) {
  const prev = previousState || createInitialHardDemandPriorityState();
  const demandType = activeDemand?.type || null;
  const unresolved = Boolean(activeDemand?.isActive);
  const hardDemandDetected = (demandType && isHardDemandType(demandType)) || detectOperationalDirectBlocker(hcpPrompt);

  let next = {
    ...prev,
    hardDemandReleaseReason: null,
    supersessionReason: null,
  };

  if (terminalExit && prev.hardDemandPriorityLock) {
    return {
      ...next,
      activeHardDemand: null,
      hardDemandType: null,
      hardDemandPriorityLock: false,
      hardDemandUnresolved: false,
      hardDemandReleaseReason: "terminal_exit",
      lockedPlannerObjective: null,
      objectiveOverrideBlocked: false,
    };
  }

  if (prev.hardDemandPriorityLock) {
    if (materiallyStrongerBlocker) {
      return {
        ...next,
        activeHardDemand: null,
        hardDemandType: null,
        hardDemandPriorityLock: false,
        hardDemandUnresolved: false,
        hardDemandReleaseReason: "superseded",
        supersessionReason: supersessionReason || "materially_stronger_blocker",
        lockedPlannerObjective: null,
        objectiveOverrideBlocked: false,
      };
    }

    const sameDemandFamily = !demandType || !prev.hardDemandType || demandType === prev.hardDemandType;
    if (sameDemandFamily && unresolved) {
      const nextPending = activeConcern && activeConcern !== prev.activeHardDemand
        ? withBufferedSecondary(prev.pendingSecondaryConcerns, activeConcern)
        : prev.pendingSecondaryConcerns;
      return {
        ...next,
        hardDemandPriorityLock: true,
        hardDemandUnresolved: true,
        activeHardDemand: prev.activeHardDemand,
        hardDemandType: prev.hardDemandType,
        pendingSecondaryConcerns: nextPending,
        narrowingLevel: Math.min(4, (prev.narrowingLevel || 0) + 1),
        objectiveOverrideBlocked: true,
      };
    }

    if (activeDemand?.resolvedThisTurn || activeDemand?.demandSatisfied) {
      return {
        ...next,
        activeHardDemand: null,
        hardDemandType: null,
        hardDemandPriorityLock: false,
        hardDemandUnresolved: false,
        hardDemandReleaseReason: "satisfied",
        narrowingLevel: 0,
        lockedPlannerObjective: null,
        objectiveOverrideBlocked: false,
      };
    }

    return {
      ...next,
      activeHardDemand: null,
      hardDemandType: null,
      hardDemandPriorityLock: false,
      hardDemandUnresolved: false,
      hardDemandReleaseReason: "downgraded",
      narrowingLevel: 0,
      lockedPlannerObjective: null,
      objectiveOverrideBlocked: false,
    };
  }

  if (hardDemandDetected && unresolved) {
    const concernAnchor = activeConcern || "constraint";
    return {
      ...next,
      activeHardDemand: concernAnchor,
      hardDemandType: demandType || "operational_constraint_required",
      hardDemandSourceTurn: Number.isFinite(turnNumber) ? turnNumber : prev.hardDemandSourceTurn,
      hardDemandPriorityLock: true,
      hardDemandUnresolved: true,
      pendingSecondaryConcerns: [],
      narrowingLevel: 1,
      objectiveOverrideBlocked: true,
    };
  }

  return next;
}

export function buildHardDemandLockedObjective(hardDemandState = {}, fallbackConcern = "constraint") {
  const lockActive = Boolean(hardDemandState?.hardDemandPriorityLock && hardDemandState?.hardDemandUnresolved);
  if (!lockActive) return null;
  const concern = String(hardDemandState?.activeHardDemand || fallbackConcern || "constraint").trim();
  return `continue_hard_demand_lock[${concern || "constraint"}]`;
}

export function getBufferedConcernAfterHardDemandRelease(state) {
  const snapshot = state || createInitialHardDemandPriorityState();
  if (snapshot.hardDemandPriorityLock) return null;
  return Array.isArray(snapshot.pendingSecondaryConcerns) ? snapshot.pendingSecondaryConcerns[0] || null : null;
}
