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
    hardDemandReleaseReason: null,
    pendingSecondaryConcerns: [],
    narrowingLevel: 0,
    supersessionReason: null,
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
      hardDemandReleaseReason: "terminal_exit",
    };
  }

  if (prev.hardDemandPriorityLock) {
    if (materiallyStrongerBlocker) {
      return {
        ...next,
        activeHardDemand: null,
        hardDemandType: null,
        hardDemandPriorityLock: false,
        hardDemandReleaseReason: "superseded",
        supersessionReason: supersessionReason || "materially_stronger_blocker",
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
        activeHardDemand: prev.activeHardDemand,
        hardDemandType: prev.hardDemandType,
        pendingSecondaryConcerns: nextPending,
        narrowingLevel: Math.min(4, (prev.narrowingLevel || 0) + 1),
      };
    }

    if (activeDemand?.resolvedThisTurn || activeDemand?.demandSatisfied) {
      return {
        ...next,
        activeHardDemand: null,
        hardDemandType: null,
        hardDemandPriorityLock: false,
        hardDemandReleaseReason: "satisfied",
        narrowingLevel: 0,
      };
    }

    return {
      ...next,
      activeHardDemand: null,
      hardDemandType: null,
      hardDemandPriorityLock: false,
      hardDemandReleaseReason: "downgraded",
      narrowingLevel: 0,
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
      pendingSecondaryConcerns: [],
      narrowingLevel: 1,
    };
  }

  return next;
}

export function getBufferedConcernAfterHardDemandRelease(state) {
  const snapshot = state || createInitialHardDemandPriorityState();
  if (snapshot.hardDemandPriorityLock) return null;
  return Array.isArray(snapshot.pendingSecondaryConcerns) ? snapshot.pendingSecondaryConcerns[0] || null : null;
}
