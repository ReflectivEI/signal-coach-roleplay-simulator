const DEFAULT_COOLDOWN_TURNS = 2;

export const INTERVENTION_DECISIONS = Object.freeze({
  NONE: "none",
  COACHING_ONLY: "coaching_only",
  REQUIRE_DIRECT_ANSWER: "require_direct_answer",
  REQUIRE_EVIDENCE_ANCHOR: "require_evidence_anchor",
  REQUIRE_REANCHOR_TO_CONSTRAINT: "require_reanchor_to_constraint",
});

export const DEMAND_TYPES = Object.freeze({
  EVIDENCE_REQUEST: "evidence_request",
  PROOF_POINT_REQUEST: "proof_point_request",
  DIRECT_ANSWER_REQUIRED: "direct_answer_required",
  OPERATIONAL_REANCHOR_REQUIRED: "operational_reanchor_required",
});

const DEMAND_PRIORITY = [
  DEMAND_TYPES.PROOF_POINT_REQUEST,
  DEMAND_TYPES.EVIDENCE_REQUEST,
  DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED,
  DEMAND_TYPES.DIRECT_ANSWER_REQUIRED,
];

const EVIDENCE_CHECKPOINT_PATTERNS = [
  { key: "evidence", pattern: /\b(evidence|data|study|trial|publication|published|proof)\b/i },
  { key: "proof_point", pattern: /\b(proof point|prove it|hard proof|decision-level)\b/i },
  { key: "metric", pattern: /\b(metric|measure|threshold|benchmark|rate|percent|kpi|outcome)\b/i },
  { key: "clinical_support", pattern: /\b(clinically meaningful|clinical relevance|patient-relevant|practice-relevant)\b/i },
  { key: "practical_next_step", pattern: /\b(practical next step|first step|single step|what should we do|what do we do next|implement)\b/i },
  { key: "workflow_feasibility", pattern: /\b(workflow|feasible|staffing|capacity|fit our clinic|without adding burden|operational(?:ly)?)\b/i },
];

function normalizeText(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value = "") {
  return normalizeText(value).split(" ").filter((token) => token.length > 2);
}

function overlapRatio(sourceA = "", sourceB = "") {
  const a = tokenize(sourceA);
  const b = tokenize(sourceB);
  if (!a.length || !b.length) return 0;
  const aSet = new Set(a);
  const bSet = new Set(b);
  let overlap = 0;
  for (const token of aSet) {
    if (bSet.has(token)) overlap += 1;
  }
  return overlap / Math.max(1, Math.min(aSet.size, bSet.size));
}

function deterministicIndex(seed = "", length = 1) {
  if (!length) return 0;
  const value = String(seed || "");
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % length;
}

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
    activeDemand: {
      type: null,
      isActive: false,
      unresolvedTurns: 0,
      lastPrompt: "",
      resolvedThisTurn: false,
      evasiveResponseDetected: false,
      longResponseClassified: false,
    },
    lastProcessedTurnNumber: null,
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

export function classifyDemandType({
  hcpPrompt = "",
  needsConstraintReanchor = false,
  hasBlockingConstraints = false,
} = {}) {
  const text = String(hcpPrompt || "");
  const hasProofPointSignal = /\b(proof point|prove it|hard proof|decision-level|what exact data point)\b/i.test(text);
  const hasEvidenceSignal = /\b(evidence|data|study|trial|publication|outcome|metric|threshold|rate|percent)\b/i.test(text);
  const hasOperationalSignal = /\b(workflow|feasible|operational|staff|capacity|implementation|burden|constraint|fit our)\b/i.test(text);
  const hasDirectQuestionSignal = /\?/.test(text) || /\b(what|which|how|when|where|who)\b/i.test(text);

  const candidates = [];
  if (hasProofPointSignal) candidates.push(DEMAND_TYPES.PROOF_POINT_REQUEST);
  if (hasEvidenceSignal) candidates.push(DEMAND_TYPES.EVIDENCE_REQUEST);
  if (needsConstraintReanchor || hasBlockingConstraints || hasOperationalSignal) candidates.push(DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED);
  if (hasDirectQuestionSignal) candidates.push(DEMAND_TYPES.DIRECT_ANSWER_REQUIRED);

  for (const demandType of DEMAND_PRIORITY) {
    if (candidates.includes(demandType)) return demandType;
  }
  return null;
}

export function detectEvasiveRepResponse({ repMessage = "", hcpPrompt = "" } = {}) {
  const rep = String(repMessage || "").trim();
  const repLower = rep.toLowerCase();
  const questionOverlap = overlapRatio(rep, hcpPrompt);

  const genericPrincipleOnly = /\b(important|key|in general|generally|best practice|holistic|value based|strategic|principle)\b/i.test(rep)
    && !/\b(\d+|percent|%|study|trial|data|step|first|owner|timeline|by\s+\w+)\b/i.test(rep);
  const vagueDeferral = /\b(follow up|circle back|later|next time|send something|get back to you|we can discuss)\b/i.test(repLower)
    && !/\b(today|tomorrow|this week|by\s+(monday|tuesday|wednesday|thursday|friday)|within\s+\d+)\b/i.test(repLower);
  const unsupportedSummary = /\b(this should help|this will work|it addresses that|we are aligned|that covers it)\b/i.test(repLower)
    && !/\b(because|data|study|step|metric|threshold|owner|timeline)\b/i.test(repLower);
  const parroting = questionOverlap >= 0.7 && rep.length < 180;
  const pivotAway = /\b(anyway|separately|zoom out|overall|big picture|in broader terms)\b/i.test(repLower);
  const longResponse = rep.length >= 320;

  const evasive = genericPrincipleOnly || vagueDeferral || unsupportedSummary || parroting || pivotAway;

  return {
    evasive,
    genericPrincipleOnly,
    vagueDeferral,
    unsupportedSummary,
    parroting,
    pivotAway,
    longResponse,
    questionOverlap,
  };
}

function isDemandSatisfied({ demandType, repMessage = "", hcpPrompt = "", activeConcern = "" } = {}) {
  const rep = String(repMessage || "").toLowerCase();
  const concern = String(activeConcern || "").toLowerCase();
  const hasEvidence = /\b(study|trial|data|published|outcome|endpoint|cohort|metric|threshold|percent|rate|sample)\b/.test(rep);
  const hasSpecificAction = /\b(first step|step 1|do this|start with|assign|owner|timeline|within|today|this week|by\s+\w+)\b/.test(rep);
  const hasPracticalAnchor = /\b(workflow|staff|capacity|handoff|process|clinic|setting|operational|feasible)\b/.test(rep);
  const acknowledgesLimitation = /\b(i don'?t have|i can'?t confirm|unknown right now|limitation|not available yet|what we can do now)\b/.test(rep);
  const respondsToQuestion = overlapRatio(rep, hcpPrompt) >= 0.35;
  const touchesConcern = concern ? rep.includes(concern) : true;

  if (demandType === DEMAND_TYPES.PROOF_POINT_REQUEST) {
    return (hasEvidence && /\b(\d+|percent|%|rate|threshold)\b/.test(rep) && respondsToQuestion)
      || (acknowledgesLimitation && hasSpecificAction);
  }

  if (demandType === DEMAND_TYPES.EVIDENCE_REQUEST) {
    return (hasEvidence && (respondsToQuestion || hasPracticalAnchor || hasSpecificAction))
      || (acknowledgesLimitation && hasSpecificAction);
  }

  if (demandType === DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED) {
    return (hasSpecificAction && hasPracticalAnchor && touchesConcern)
      || (acknowledgesLimitation && hasPracticalAnchor);
  }

  if (demandType === DEMAND_TYPES.DIRECT_ANSWER_REQUIRED) {
    return (hasSpecificAction || (respondsToQuestion && (hasEvidence || hasPracticalAnchor)))
      || (acknowledgesLimitation && hasSpecificAction);
  }

  return true;
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

export function buildDemandHoldMessage({
  demandType,
  activeConcern = "workflow",
  unresolvedTurns = 1,
  seed = "",
  avoidLine = "",
} = {}) {
  const concern = String(activeConcern || "workflow").toLowerCase();
  const demandMessages = {
    [DEMAND_TYPES.EVIDENCE_REQUEST]: {
      stage1: [
        `I still need one concrete evidence anchor tied to ${concern} before we move on.`,
        `Keep this on the evidence request and give one practice-relevant data point for ${concern}.`,
      ],
      stage2: [
        `Your previous answer did not resolve the evidence request—name one specific data point relevant to ${concern}.`,
        `Narrow this to one evidence detail I can use in ${concern} right now.`,
      ],
      stage3: [
        `Final clarification: provide one decision-level evidence point for ${concern}, or state the limitation and next practical action.`,
      ],
    },
    [DEMAND_TYPES.PROOF_POINT_REQUEST]: {
      stage1: [
        `I asked for a proof point—give one specific metric or threshold that supports your recommendation.`,
        `Stay with the proof-point request and provide one concrete, decision-level data point.`,
      ],
      stage2: [
        `That still reads as general guidance. Give one exact proof point with a measurable threshold.`,
        `Tighten this to one metric-backed proof point that directly answers the question.`,
      ],
      stage3: [
        `Last pass: one explicit proof point with measurable support, or acknowledge the gap and give a practical next step.`,
      ],
    },
    [DEMAND_TYPES.DIRECT_ANSWER_REQUIRED]: {
      stage1: [
        `Please answer the direct question with one concrete next step.`,
        `You still have not answered directly—give a specific, usable answer now.`,
      ],
      stage2: [
        `The question is still unresolved. Provide one direct action with owner and timing.`,
        `Keep this focused: answer directly with a concrete, immediately usable step.`,
      ],
      stage3: [
        `Final clarification: direct answer only—one specific action, or clearly state the limitation and immediate fallback.`,
      ],
    },
    [DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED]: {
      stage1: [
        `Re-anchor to the operational constraint and give one feasible step we can run now.`,
        `Stay on the operational constraint and provide a workflow-fit action with ownership and timing.`,
      ],
      stage2: [
        `This still misses the operational constraint. Give one feasible workflow action with minimal burden.`,
        `Narrow to one operationally feasible step tied to staffing/capacity reality.`,
      ],
      stage3: [
        `Final re-anchor: provide one operationally feasible action now, or explicitly acknowledge the limit and immediate mitigation.`,
      ],
    },
  };

  const bundles = demandMessages[demandType] || demandMessages[DEMAND_TYPES.DIRECT_ANSWER_REQUIRED];
  const stageKey = unresolvedTurns >= 3 ? "stage3" : unresolvedTurns >= 2 ? "stage2" : "stage1";
  const pool = bundles[stageKey];
  const idx = deterministicIndex(`${demandType}:${concern}:${stageKey}:${seed}`, pool.length);
  const normalizedAvoid = normalizeText(avoidLine);
  let selected = pool[idx];
  if (normalizedAvoid && pool.length > 1 && normalizeText(selected) === normalizedAvoid) {
    selected = pool[(idx + 1) % pool.length];
  }
  return selected;
}

export function updateInterventionSessionState(previousState, {
  turnNumber,
  alignmentScore,
  concernFlowOutcome,
  hcpPrompt = "",
  repMessage = "",
  activeConcern = "",
  hasBlockingConstraints = false,
  needsConstraintReanchor = false,
} = {}) {
  const prior = previousState || createInitialInterventionSessionState();
  if (Number.isFinite(turnNumber) && prior.lastProcessedTurnNumber === turnNumber) {
    return prior;
  }
  const missedCue = concernFlowOutcome === "missed" || concernFlowOutcome === "overpivot";
  const lowAlignment = Number.isFinite(alignmentScore) && alignmentScore <= 2.5;
  const evidenceCheckpoint = detectEvidenceCheckpoint(hcpPrompt);
  const demandType = classifyDemandType({
    hcpPrompt,
    needsConstraintReanchor,
    hasBlockingConstraints,
  });

  const repeatedMissedCues = missedCue ? prior.repeatedMissedCues + 1 : 0;
  const repeatedLowAlignmentEvents = lowAlignment ? prior.repeatedLowAlignmentEvents + 1 : 0;
  const cooldownTurnsRemaining = Math.max(0, Number(prior.cooldownTurnsRemaining || 0) - 1);
  const escalationRisk = computeEscalationRisk({
    repeatedMissedCues,
    repeatedLowAlignmentEvents,
    hasBlockingConstraints,
  });

  const evasiveSignals = detectEvasiveRepResponse({ repMessage, hcpPrompt });
  const demandSatisfied = demandType
    ? isDemandSatisfied({ demandType, repMessage, hcpPrompt, activeConcern })
    : true;
  const unresolvedDemand = Boolean(demandType) && (!demandSatisfied || evasiveSignals.evasive);

  const priorUnresolvedTurns = prior?.activeDemand?.isActive && prior?.activeDemand?.type === demandType
    ? Number(prior?.activeDemand?.unresolvedTurns || 0)
    : 0;

  const activeDemand = {
    type: demandType,
    isActive: unresolvedDemand,
    unresolvedTurns: unresolvedDemand ? priorUnresolvedTurns + 1 : 0,
    lastPrompt: hcpPrompt,
    resolvedThisTurn: Boolean(demandType) && !unresolvedDemand,
    evasiveResponseDetected: unresolvedDemand && evasiveSignals.evasive,
    longResponseClassified: Boolean(demandType) && evasiveSignals.longResponse,
  };

  const directQuestionPending = demandType === DEMAND_TYPES.DIRECT_ANSWER_REQUIRED && unresolvedDemand;
  const decision = decideInterventionAction({
    repeatedMissedCues,
    repeatedLowAlignmentEvents,
    evidenceCheckpointTriggered: evidenceCheckpoint.triggered && unresolvedDemand,
    unresolvedConstraintReanchor: demandType === DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED && unresolvedDemand,
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
    activeDemand,
    lastProcessedTurnNumber: Number.isFinite(turnNumber) ? turnNumber : prior.lastProcessedTurnNumber,
    cooldownTurnsRemaining: decision === INTERVENTION_DECISIONS.NONE ? cooldownTurnsRemaining : DEFAULT_COOLDOWN_TURNS,
    lastDecision: decision,
    lastDecisionTurn: turnNumber,
  };
}
