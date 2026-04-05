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
  SINGLE_POINT_REQUIRED: "single_point_required",
  ONE_STEP_REQUIRED: "one_step_required",
  OPERATIONAL_REANCHOR_REQUIRED: "operational_reanchor_required",
  APPLICABILITY_REQUEST: "applicability_request",
});

const DEMAND_PRIORITY = [
  DEMAND_TYPES.PROOF_POINT_REQUEST,
  DEMAND_TYPES.SINGLE_POINT_REQUIRED,
  DEMAND_TYPES.EVIDENCE_REQUEST,
  DEMAND_TYPES.ONE_STEP_REQUIRED,
  DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED,
  DEMAND_TYPES.APPLICABILITY_REQUEST,
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

function buildStructureSignature(text = "") {
  const normalized = normalizeText(text);
  if (!normalized) return "";
  const tokens = normalized.split(" ").filter(Boolean);
  const buckets = tokens.map((token) => {
    if (/^\d+$/.test(token)) return "<num>";
    if (token.length <= 3) return token;
    return token.slice(0, 3);
  });
  return buckets.join(" ");
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

function collectPromptSignals(hcpPrompt = "") {
  const text = String(hcpPrompt || "");
  const normalized = normalizeText(text);
  const signals = {
    instruction: new Set(),
    cue: new Set(),
    constraint: new Set(),
  };

  if (/\b(keep it brief|be brief|keep this brief|concise|short answer|in 30 seconds|one sentence)\b/i.test(text)) {
    signals.constraint.add("concision");
    signals.instruction.add("format:concise");
  }
  if (/\b(time is limited|limited time|rushed|quickly|in the next minute|before my next patient|time pressure)\b/i.test(text)) {
    signals.constraint.add("time_pressure");
    signals.cue.add("pace:rushed");
  }
  if (/\b(clinically meaningful|clinical relevance|anchor on clinically meaningful evidence|evidence first)\b/i.test(text)) {
    signals.constraint.add("clinical_priority");
    signals.instruction.add("anchor:clinical_first");
  }
  if (/\b(practice relevant|practice-relevant|for our practice|for this clinic|in our setting|applicable to my patients)\b/i.test(text)) {
    signals.constraint.add("practice_relevance");
    signals.instruction.add("anchor:practice_relevance");
  }
  if (/\b(stop|done|not productive|take care|patients waiting|need to get back to patients)\b/i.test(normalized)) {
    signals.cue.add("terminal");
  }

  return {
    instruction: [...signals.instruction].sort(),
    cue: [...signals.cue].sort(),
    constraint: [...signals.constraint].sort(),
  };
}

function hasSignalDelta(previous = [], next = []) {
  const previousSet = new Set(previous);
  const nextSet = new Set(next);
  for (const value of nextSet) {
    if (!previousSet.has(value)) return true;
  }
  for (const value of previousSet) {
    if (!nextSet.has(value)) return true;
  }
  return false;
}

function repAddressesPromptSignals(repMessage = "", promptSignals = {}) {
  const rep = String(repMessage || "").toLowerCase();
  const constraints = Array.isArray(promptSignals.constraint) ? promptSignals.constraint : [];
  if (!constraints.length) return true;

  const coverage = {
    concision: rep.split(/\s+/).filter(Boolean).length <= 55,
    time_pressure: /\b(now|today|this week|immediate|immediately|first step|quick|within)\b/.test(rep),
    clinical_priority: /\b(clinically meaningful|clinical|endpoint|outcome|study|trial|evidence|data)\b/.test(rep),
    practice_relevance: /\b(your clinic|your practice|your setting|for your patients|in this clinic|in your setting)\b/.test(rep),
  };

  return constraints.every((constraint) => coverage[constraint] ?? true);
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
      demandSatisfied: true,
      lastPrompt: "",
      lastRepMessage: "",
      resolvedThisTurn: false,
      evasiveResponseDetected: false,
      longResponseClassified: false,
      staleAnswerBlocked: false,
      latestPromptSignals: {
        instruction: [],
        cue: [],
        constraint: [],
      },
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
  const hasApplicabilitySignal = /\b(apply|applies|applicable|relevant|for my (?:patients|clinic|practice|setting)|in our (?:clinic|setting|practice)|for our (?:patients|team|clinic)|in this (?:clinic|setting|practice))\b/i.test(text);
  const hasDirectQuestionSignal = /\?/.test(text) || /\b(what|which|how|when|where|who)\b/i.test(text);
  const hasSinglePointSignal = /\b(one|single)\s+(data point|metric|proof point|number|study point|evidence point|concrete point)\b/i.test(text);
  const hasOneStepSignal = /\b(one|single|first)\s+(step|thing|action)\b/i.test(text) || /\b(this week|this month|immediate|right now)\b/.test(text);

  const candidates = [];
  if (hasProofPointSignal) candidates.push(DEMAND_TYPES.PROOF_POINT_REQUEST);
  if (hasSinglePointSignal) candidates.push(DEMAND_TYPES.SINGLE_POINT_REQUIRED);
  if (hasEvidenceSignal) candidates.push(DEMAND_TYPES.EVIDENCE_REQUEST);
  if (hasOneStepSignal) candidates.push(DEMAND_TYPES.ONE_STEP_REQUIRED);
  if (needsConstraintReanchor || hasBlockingConstraints || hasOperationalSignal) candidates.push(DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED);
  if (hasApplicabilitySignal) candidates.push(DEMAND_TYPES.APPLICABILITY_REQUEST);
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
  const repeatedExplanationLoop = /\b(i just mentioned that|as i (just )?mentioned|as i said|like i said|already covered that|as noted earlier)\b/i.test(repLower);
  const longResponse = rep.length >= 320;

  const evasive = genericPrincipleOnly || vagueDeferral || unsupportedSummary || parroting || pivotAway || repeatedExplanationLoop;

  return {
    evasive,
    genericPrincipleOnly,
    vagueDeferral,
    unsupportedSummary,
    parroting,
    pivotAway,
    repeatedExplanationLoop,
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
  const hasContextTie = /\b(your (?:clinic|patients|team|setting|workflow|practice)|in your (?:clinic|setting|practice)|for your (?:patients|team|clinic)|in this (?:clinic|setting|practice)|for this (?:clinic|setting|practice))\b/.test(rep);
  const acknowledgesLimitation = /\b(i don'?t have|i can'?t confirm|unknown right now|limitation|not available yet|what we can do now)\b/.test(rep);
  const respondsToQuestion = overlapRatio(rep, hcpPrompt) >= 0.35;
  const touchesConcern = concern ? rep.includes(concern) : true;

  if (demandType === DEMAND_TYPES.PROOF_POINT_REQUEST) {
    return (hasEvidence && /\b(\d+|percent|%|rate|threshold)\b/.test(rep) && respondsToQuestion)
      || (acknowledgesLimitation && hasSpecificAction);
  }


  if (demandType === DEMAND_TYPES.SINGLE_POINT_REQUIRED) {
    return (hasEvidence && /\b(\d+|percent|%|rate|threshold|number|metric)\b/.test(rep) && respondsToQuestion)
      || (acknowledgesLimitation && hasSpecificAction);
  }

  if (demandType === DEMAND_TYPES.ONE_STEP_REQUIRED) {
    return hasSpecificAction && (hasPracticalAnchor || respondsToQuestion || hasContextTie);
  }
  if (demandType === DEMAND_TYPES.EVIDENCE_REQUEST) {
    return (hasEvidence && (respondsToQuestion || hasPracticalAnchor || hasSpecificAction))
      || (acknowledgesLimitation && hasSpecificAction);
  }

  if (demandType === DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED) {
    return (hasSpecificAction && hasPracticalAnchor && touchesConcern)
      || (acknowledgesLimitation && hasPracticalAnchor);
  }

  if (demandType === DEMAND_TYPES.APPLICABILITY_REQUEST) {
    return (hasContextTie && (hasSpecificAction || hasEvidence || hasPracticalAnchor))
      || (acknowledgesLimitation && hasContextTie && hasSpecificAction);
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
  scenarioFamily = "",
  unresolvedTurns = 1,
  seed = "",
  avoidLine = "",
} = {}) {
  const family = normalizeText(scenarioFamily);
  const concernSource = String(activeConcern || "workflow").toLowerCase();
  const concernHasCrossFamilyLexicon = (
    family && !/hiv|prep/.test(family) && /\b(hiv|prep|pre exposure)\b/.test(concernSource)
  );
  const concern = concernHasCrossFamilyLexicon ? "workflow" : concernSource;
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
        `I still need one concrete evidence point for ${concern}. Keep it specific or state the limitation and immediate next step.`,
      ],
      stage4: [
        `We are still unresolved on evidence for ${concern}. If you cannot give one concrete data point now, it is hard to continue this discussion.`,
        `This remains unresolved on evidence for ${concern}. Without one specific data point now, I do not see a reason to keep moving forward.`,
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
      stage4: [
        `I still do not have a usable proof point. Without one concrete metric now, I cannot move this conversation forward.`,
      ],
    },
    [DEMAND_TYPES.SINGLE_POINT_REQUIRED]: {
      stage1: [
        `I still need one single concrete point—one number or one metric tied to the decision.`,
        `Keep this to one proof point only, with measurable detail.`,
      ],
      stage2: [
        `Still unresolved: one metric only, and what it changes in practice.`,
        `Narrow this further: one number and one practical implication.`,
      ],
      stage3: [
        `Final clarification: one decision-level number only, or state the limitation and immediate fallback.`,
      ],
      stage4: [
        `I still do not have one usable point. Without one concrete number now, we should pause.`,
      ],
    },
    [DEMAND_TYPES.ONE_STEP_REQUIRED]: {
      stage1: [
        `I still need one practical step we can execute this week.`,
        `Give one concrete action for this month with owner and timing.`,
      ],
      stage2: [
        `That is still broad. Give one immediate operational step only.`,
        `Narrow to one action we can run now with clear ownership.`,
      ],
      stage3: [
        `Final clarification: one practical step only, or state the limit and immediate fallback.`,
      ],
      stage4: [
        `This is still unresolved on practical action. Without one concrete step now, we should stop here.`,
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
      stage4: [
        `You still have not answered directly. If you cannot give one specific action now, it is hard to see how this applies.`,
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
      stage4: [
        `This remains unresolved operationally. Without one feasible step that fits staffing and capacity now, I am ready to disengage.`,
      ],
    },
    [DEMAND_TYPES.APPLICABILITY_REQUEST]: {
      stage1: [
        `That stays general. Give one concrete example of how this applies in my setting.`,
        `I still need one specific way this applies to our clinic context before we move on.`,
      ],
      stage2: [
        `You are still general—what is one context-specific step for our practice right now?`,
        `Narrow this to one practical example for our patient mix and workflow.`,
      ],
      stage3: [
        `I need a direct applicability answer now: one concrete step for this setting, or a clear limitation plus fallback.`,
        `Give one specific application for this setting now, or clearly state the limitation and immediate fallback step.`,
      ],
      stage4: [
        `I still cannot see applicability to this setting. Without one concrete example now, I do not see value in continuing.`,
        `We are still not at applicability for this setting. If you cannot provide one concrete example now, I am ready to end here.`,
      ],
    },
  };

  const bundles = demandMessages[demandType] || demandMessages[DEMAND_TYPES.DIRECT_ANSWER_REQUIRED];
  const stageKey = unresolvedTurns >= 4 ? "stage4" : unresolvedTurns >= 3 ? "stage3" : unresolvedTurns >= 2 ? "stage2" : "stage1";
  const pool = bundles[stageKey];
  const idx = deterministicIndex(`${demandType}:${concern}:${stageKey}:${seed}`, pool.length);
  const normalizedAvoid = normalizeText(avoidLine);
  let selected = pool[idx];
  if (normalizedAvoid && pool.length > 1 && normalizeText(selected) === normalizedAvoid) {
    selected = pool[(idx + 1) % pool.length];
  }
  const lineHasCrossFamilyLexicon = family && !/hiv|prep/.test(family) && /\b(hiv|prep|pre exposure)\b/i.test(selected);
  if (lineHasCrossFamilyLexicon) {
    return "Keep this focused on the current clinic context and provide one concrete next step.";
  }
  return selected;
}

export function buildDemandHoldDirective({
  demandType,
  activeConcern = "workflow",
  scenarioFamily = "",
  unresolvedTurns = 1,
  seed = "",
  avoidLine = "",
} = {}) {
  const stage = unresolvedTurns >= 4 ? 4 : unresolvedTurns >= 3 ? 3 : unresolvedTurns >= 2 ? 2 : 1;
  return {
    stage,
    line: buildDemandHoldMessage({ demandType, activeConcern, scenarioFamily, unresolvedTurns, seed, avoidLine }),
    impatientTone: stage >= 3,
    disengagementTrajectory: stage >= 4,
  };
}

export function updateInterventionSessionState(previousState, {
  turnNumber,
  alignmentScore,
  concernFlowOutcome,
  hcpPrompt = "",
  repMessage = "",
  activeConcern = "",
  scenarioFamily = "",
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
  const latestPromptSignals = collectPromptSignals(hcpPrompt);
  const priorPromptSignals = prior?.activeDemand?.latestPromptSignals || { instruction: [], cue: [], constraint: [] };
  const instructionShifted = hasSignalDelta(priorPromptSignals.instruction, latestPromptSignals.instruction);
  const cueShifted = hasSignalDelta(priorPromptSignals.cue, latestPromptSignals.cue);
  const constraintShifted = hasSignalDelta(priorPromptSignals.constraint, latestPromptSignals.constraint);
  const demandTypeChanged = Boolean(prior?.activeDemand?.type && demandType && prior.activeDemand.type !== demandType);
  const materiallyDifferentPrompt = overlapRatio(hcpPrompt, prior?.activeDemand?.lastPrompt || "") < 0.45;
  const nearIdenticalRepReuse = overlapRatio(repMessage, prior?.activeDemand?.lastRepMessage || "") >= 0.82;
  const structuralReuse = (
    buildStructureSignature(repMessage)
    && buildStructureSignature(repMessage) === buildStructureSignature(prior?.activeDemand?.lastRepMessage || "")
  );
  const missingNewestRequirement = !repAddressesPromptSignals(repMessage, latestPromptSignals);
  const promptShifted = instructionShifted || cueShifted || constraintShifted || materiallyDifferentPrompt;
  const reusePatternDetected = nearIdenticalRepReuse || structuralReuse || evasiveSignals.repeatedExplanationLoop;
  const staleAnswerBlocked = reusePatternDetected && (
    demandTypeChanged
    || promptShifted
    || missingNewestRequirement
  );
  const demandSatisfied = demandType
    ? (staleAnswerBlocked
      ? false
      : isDemandSatisfied({ demandType, repMessage, hcpPrompt, activeConcern }))
    : true;
  const unresolvedDemand = Boolean(demandType) && (!demandSatisfied || evasiveSignals.evasive);

  const priorUnresolvedTurns = prior?.activeDemand?.isActive && prior?.activeDemand?.type === demandType
    ? Number(prior?.activeDemand?.unresolvedTurns || 0)
    : 0;

  const activeDemand = {
    type: demandType,
    isActive: unresolvedDemand,
    unresolvedTurns: unresolvedDemand ? priorUnresolvedTurns + 1 : 0,
    demandSatisfied,
    lastPrompt: hcpPrompt,
    lastRepMessage: repMessage,
    resolvedThisTurn: Boolean(demandType) && !unresolvedDemand,
    evasiveResponseDetected: unresolvedDemand && evasiveSignals.evasive,
    longResponseClassified: Boolean(demandType) && evasiveSignals.longResponse,
    staleAnswerBlocked,
    latestPromptSignals,
    scenarioFamily: normalizeText(scenarioFamily),
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
