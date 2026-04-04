import { classifyDemandType, DEMAND_TYPES } from "./interventionEngineV2.js";

const DEMAND_FAMILIES = {
  [DEMAND_TYPES.PROOF_POINT_REQUEST]: "evidence",
  [DEMAND_TYPES.EVIDENCE_REQUEST]: "evidence",
  [DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED]: "operational",
  [DEMAND_TYPES.APPLICABILITY_REQUEST]: "operational",
  [DEMAND_TYPES.DIRECT_ANSWER_REQUIRED]: "direct",
};

function getDemandFamily(demandType) {
  return DEMAND_FAMILIES[demandType] || null;
}

export function shouldAllowDemandHoldOverride({
  activeDemandType = null,
  candidateHcpDialogue = "",
} = {}) {
  if (!activeDemandType) return false;

  const candidateDemandType = classifyDemandType({
    hcpPrompt: candidateHcpDialogue,
    needsConstraintReanchor: false,
    hasBlockingConstraints: false,
  });

  if (!candidateDemandType) return true;

  const activeFamily = getDemandFamily(activeDemandType);
  const candidateFamily = getDemandFamily(candidateDemandType);

  if (!activeFamily || !candidateFamily) return true;
  return activeFamily === candidateFamily;
}
