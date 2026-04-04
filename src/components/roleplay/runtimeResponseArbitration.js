export const RESPONSE_ARBITRATION_STAGE_ORDER = Object.freeze([
  "terminal_policy_probe",
  "constraint_block_close",
  "partial_progress_soften",
  "late_turn_constraint_override",
  "rewrite_authority_resolution",
  "constraint_draft_guardrail",
  "deterministic_punctuation_contract",
  "session_finalization_gate",
]);

function extractContinuityTokens(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4)
    .filter((token) => !["with", "that", "this", "your", "from", "have", "what", "when", "where", "which", "would"].includes(token));
}

export function evaluateRepToHcpContinuity({
  repMessage = "",
  hcpDialogue = "",
  priorHcpDialogue = "",
  activeConcern = "workflow",
} = {}) {
  const repTokens = new Set(extractContinuityTokens(repMessage));
  const hcpTokens = new Set(extractContinuityTokens(hcpDialogue));
  const priorTokens = new Set(extractContinuityTokens(priorHcpDialogue));
  const overlapWithRep = [...repTokens].filter((token) => hcpTokens.has(token)).length;
  const overlapWithPrior = [...priorTokens].filter((token) => hcpTokens.has(token)).length;

  const repMentionsEvidence = /\b(study|trial|evidence|methodology|duration|jama|published|endpoint)\b/i.test(repMessage);
  const priorAskedEvidence = /\b(study|methodology|duration|evidence|data|endpoint)\b/i.test(priorHcpDialogue);
  const hcpMentionsEvidence = /\b(study|methodology|duration|evidence|data|endpoint)\b/i.test(hcpDialogue);
  const hcpMentionsConcern = new RegExp(`\\b${String(activeConcern || "workflow").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(hcpDialogue);

  const directContinuityGap =
    (repTokens.size >= 3 && overlapWithRep === 0)
    || (priorTokens.size >= 3 && overlapWithPrior === 0);
  const evidenceDriftGap = repMentionsEvidence && priorAskedEvidence && !hcpMentionsEvidence && !hcpMentionsConcern;

  return {
    needsRepair: directContinuityGap || evidenceDriftGap,
    overlapWithRep,
    overlapWithPrior,
    evidenceDriftGap,
  };
}

export function selectRewriteAuthority({
  overrideExit = false,
  nextHcpState = "engaged",
  repetitiveCandidate = "",
  continuityNeedsRepair = false,
} = {}) {
  if (overrideExit || nextHcpState === "disengaged") return "none";
  if (repetitiveCandidate) return "anti_repeat";
  if (continuityNeedsRepair) return "continuity_repair";
  return "none";
}

export function shouldApplyConstraintDraftGuardrail(turnNumber = 0) {
  return Number(turnNumber) > 0;
}

export function shouldEndSessionAfterTurn({
  blockClose = false,
  overrideExit = false,
  nextHcpState = "engaged",
  nextHcpDialogue = "",
  terminalPolicyAction = "continue",
  isTerminalClosureDialogue,
} = {}) {
  if (blockClose) return false;
  if (overrideExit) return true;
  return (
    (nextHcpState === "disengaged" && isTerminalClosureDialogue(nextHcpDialogue))
    || terminalPolicyAction === "close"
  );
}

export function isStaleAsyncResponse({ requestId, activeRequestId, sessionActive }) {
  return requestId !== activeRequestId || !sessionActive;
}

export function hasNextTurnAlready({ prevTurnsState = [], nextTurn = {}, generationKey = "" } = {}) {
  return prevTurnsState.some(
    (t) => (
      t.turnNumber === nextTurn.turnNumber
      && !t.repMessage
      && t.hcpDialogueBefore
    ) || (t.generationKey && t.generationKey === generationKey)
  );
}
