const DEFAULT_COOLDOWN_TURNS = 2;

export const INTERVENTION_DECISIONS = Object.freeze({
  NONE: "none",
  COACHING_ONLY: "coaching_only",
  REQUIRE_DIRECT_ANSWER: "require_direct_answer",
  REQUIRE_EVIDENCE_ANCHOR: "require_evidence_anchor",
  REQUIRE_REANCHOR_TO_CONSTRAINT: "require_reanchor_to_constraint",
});

const EVIDENCE_CHECKPOINT_PATTERNS = [
  { key: "evidence", pattern: /\b(evidence|data|study|trial|publication|published|proof)\b/i },
  { key: "proof_point", pattern: /\b(proof point|prove it|hard proof|decision-level)\b/i },
  { key: "metric", pattern: /\b(metric|measure|threshold|benchmark|rate|percent|kpi|outcome)\b/i },
  { key: "clinical_support", pattern: /\b(clinically meaningful|clinical relevance|patient-relevant|practice-relevant)\b/i },
  { key: "practical_next_step", pattern: /\b(practical next step|first step|single step|what should we do|what do we do next|implement)\b/i },
  { key: "workflow_feasibility", pattern: /\b(workflow|feasible|staffing|capacity|fit our clinic|without adding burden|operational(?:ly)?)\b/i },
];

export function createInitialInterventionSessionState() {
  return {
    repeatedMissedCues: 0,
    repeatedLowAlignmentEvents: 0,
    evidenceCheckpoints: [],
    cooldownTurnsRemaining: 0,
    escalationRisk: "low",
    needsConstraintReanchor: false,
    surfacedInterventionCount: 0,
    silentInterventionCount: 0,
    lastDecision: INTERVENTION_DECISIONS.NONE,
    lastDecisionTurn: null,
  };
}

export function detectEvidenceCheckpoint(text = "") {
  const source = String(text || "").trim();
  const matches = EVIDENCE_CHECKPOINT_PATTERNS
    .filter(({ pattern }) => pattern.test(source))
    .map(({ key }) => key);

  return {
    triggered: matches.length > 0,
    matches,
    sourceText: source,
  };
}

export function decideInterventionAction({
  repeatedMissedCues = 0,
  repeatedLowAlignmentEvents = 0,
  evidenceCheckpointTriggered = false,
  unresolvedConstraintReanchor = false,
  directQuestionPending = false,
  cooldownTurnsRemaining = 0,
  escalationRisk = "low",
} = {}) {
  if (cooldownTurnsRemaining > 0) return INTERVENTION_DECISIONS.NONE;
  if (unresolvedConstraintReanchor) return INTERVENTION_DECISIONS.REQUIRE_REANCHOR_TO_CONSTRAINT;
  if (evidenceCheckpointTriggered) return INTERVENTION_DECISIONS.REQUIRE_EVIDENCE_ANCHOR;
  if (directQuestionPending) return INTERVENTION_DECISIONS.REQUIRE_DIRECT_ANSWER;

  const elevatedRisk = escalationRisk === "high" || escalationRisk === "elevated";
  if (repeatedMissedCues >= 2 || repeatedLowAlignmentEvents >= 2 || elevatedRisk) {
    return INTERVENTION_DECISIONS.COACHING_ONLY;
  }

  return INTERVENTION_DECISIONS.NONE;
}

function computeEscalationRisk({ repeatedMissedCues, repeatedLowAlignmentEvents, hasBlockingConstraints }) {
  if (repeatedMissedCues >= 3 || repeatedLowAlignmentEvents >= 3) return "high";
  if (repeatedMissedCues >= 2 || repeatedLowAlignmentEvents >= 2 || hasBlockingConstraints) return "elevated";
  return "low";
}

export function updateInterventionSessionState(previousState, {
  turnNumber,
  alignmentScore,
  concernFlowOutcome,
  hcpPrompt = "",
  hasBlockingConstraints = false,
  needsConstraintReanchor = false,
} = {}) {
  const prior = previousState || createInitialInterventionSessionState();
  const missedCue = concernFlowOutcome === "missed" || concernFlowOutcome === "overpivot";
  const lowAlignment = Number.isFinite(alignmentScore) && alignmentScore <= 2.5;
  const evidenceCheckpoint = detectEvidenceCheckpoint(hcpPrompt);

  const repeatedMissedCues = missedCue ? prior.repeatedMissedCues + 1 : 0;
  const repeatedLowAlignmentEvents = lowAlignment ? prior.repeatedLowAlignmentEvents + 1 : 0;
  const cooldownTurnsRemaining = Math.max(0, Number(prior.cooldownTurnsRemaining || 0) - 1);
  const escalationRisk = computeEscalationRisk({
    repeatedMissedCues,
    repeatedLowAlignmentEvents,
    hasBlockingConstraints,
  });

  const directQuestionPending = /\?/.test(String(hcpPrompt || ""));
  const decision = decideInterventionAction({
    repeatedMissedCues,
    repeatedLowAlignmentEvents,
    evidenceCheckpointTriggered: evidenceCheckpoint.triggered,
    unresolvedConstraintReanchor: needsConstraintReanchor,
    directQuestionPending,
    cooldownTurnsRemaining,
    escalationRisk,
  });

  const evidenceCheckpoints = evidenceCheckpoint.triggered
    ? [...prior.evidenceCheckpoints, {
        turnNumber,
        matches: evidenceCheckpoint.matches,
        sourceText: evidenceCheckpoint.sourceText,
      }].slice(-10)
    : prior.evidenceCheckpoints;

  return {
    ...prior,
    repeatedMissedCues,
    repeatedLowAlignmentEvents,
    evidenceCheckpoints,
    escalationRisk,
    needsConstraintReanchor,
    cooldownTurnsRemaining: decision === INTERVENTION_DECISIONS.NONE ? cooldownTurnsRemaining : DEFAULT_COOLDOWN_TURNS,
    lastDecision: decision,
    lastDecisionTurn: turnNumber,
  };
}
