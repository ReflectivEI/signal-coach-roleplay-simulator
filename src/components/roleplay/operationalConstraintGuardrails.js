const OPERATIONAL_CONSTRAINT_PATTERNS = {
  staffing: /\b(staffing|short-staffed|staff shortage|understaffed|team capacity|nurse shortage|ma shortage|coverage gap)\b/i,
  workflow: /\b(workflow|operational|implementation|process|steps|clinic flow|handoff process)\b/i,
  capacity: /\b(capacity|bandwidth|burden|workload|overwhelmed|buried|limited resources)\b/i,
  prior_auth: /\b(prior auth|prior authorization|authorization|pa denial|appeal|payer paperwork)\b/i,
  scheduling: /\b(schedule|scheduling|calendar|slot|appointment|booked|back-to-back|time window)\b/i,
  handoff: /\b(handoff|hand-off|transition of care|care transition|routing step|ownership handoff)\b/i,
  callback: /\b(callback|call back|follow-up call|follow up call|return call)\b/i,
  throughput: /\b(throughput|volume|patient flow|queue|backlog|turnaround|wait time)\b/i,
  time: /\b(time|minutes|today|this week|deadline|urgent|rush|limited time)\b/i,
  access: /\b(access|prior auth|authorization|coverage|payer|insurance|formular|cost|reimbursement|paperwork)\b/i,
  policy: /\b(policy|protocol|guideline|committee|pathway|institution|restriction)\b/i,
  screening: /\b(screening|eligibility|candidacy|contraindication|resistance|monitoring)\b/i,
  evidence: /\b(evidence|study|trial|endpoint|head-to-head|methodology|duration|confidence interval|data|proof)\b/i,
};

export const OPERATIONAL_CONSTRAINT_TYPES = Object.freeze(Object.keys(OPERATIONAL_CONSTRAINT_PATTERNS));

export function extractConstraintCandidatesFromText(text = "") {
  const value = String(text || "").trim();
  if (!value) return [];

  const sentences = value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const candidates = [];
  sentences.forEach((sentence) => {
    OPERATIONAL_CONSTRAINT_TYPES.forEach((type) => {
      if (OPERATIONAL_CONSTRAINT_PATTERNS[type].test(sentence)) {
        candidates.push({
          constraintType: type,
          snippet: sentence.slice(0, 180),
        });
      }
    });
  });

  return candidates;
}

// Backward-compatible alias used by existing runtime bundles/helpers.
export function detectOperationalConstraintTypes(text = "") {
  return [...new Set(extractConstraintCandidatesFromText(text).map((item) => item.constraintType))];
}

export function buildConstraintGrounding({ scenarioText = "", dialogueTurns = [] } = {}) {
  const scenarioCandidates = extractConstraintCandidatesFromText(scenarioText);
  const dialogueCandidates = (Array.isArray(dialogueTurns) ? dialogueTurns : [])
    .flatMap((turnText) => extractConstraintCandidatesFromText(turnText));

  const scenarioTypes = new Set(scenarioCandidates.map((item) => item.constraintType));
  const dialogueTypes = new Set(dialogueCandidates.map((item) => item.constraintType));
  const groundedTypes = new Set([...scenarioTypes, ...dialogueTypes]);

  return {
    groundedTypes,
    scenarioTypes,
    dialogueTypes,
    scenarioCandidates,
    dialogueCandidates,
  };
}

function normalizeTypeSet(value = []) {
  return new Set(Array.isArray(value) ? value.filter(Boolean) : []);
}

export function detectConstraintDraftViolations({
  draftText = "",
  groundedTypes = [],
  alreadySurfacedTypes = [],
  newlyRaisedTypes = [],
  revisitRequested = false,
  changedConstraint = false,
  clarificationNeeded = false,
} = {}) {
  const draftCandidates = extractConstraintCandidatesFromText(draftText);
  const draftTypes = [...new Set(draftCandidates.map((item) => item.constraintType))];
  const grounded = normalizeTypeSet(groundedTypes);
  const surfaced = normalizeTypeSet(alreadySurfacedTypes);
  const newlyRaised = normalizeTypeSet(newlyRaisedTypes);

  const ungroundedTypes = draftTypes.filter((type) => !grounded.has(type));

  const duplicateTypes = draftTypes.filter((type) => {
    if (!surfaced.has(type)) return false;
    if (newlyRaised.has(type)) return false;
    if (revisitRequested || changedConstraint || clarificationNeeded) return false;
    return true;
  });

  return {
    valid: ungroundedTypes.length === 0 && duplicateTypes.length === 0,
    ungroundedTypes,
    duplicateTypes,
    draftCandidates,
    draftTypes,
    rejectionReason:
      ungroundedTypes.length > 0
        ? "ungrounded_constraint_injection"
        : duplicateTypes.length > 0
          ? "duplicate_constraint_restatement"
          : null,
  };
}

export function buildConstraintSafeRegeneratedResponse({
  fallbackResponse = "",
  concern = "evidence",
  includeWarmth = false,
  scenarioContext = "",
} = {}) {
  const fallback = String(fallbackResponse || "").trim();
  const containsConstraint = extractConstraintCandidatesFromText(fallback).length > 0;
  if (fallback && !containsConstraint) return fallback;

  const neutralByConcern = {
    evidence: "I still need clinically meaningful evidence before I would change practice.",
    screening: "I need clearer patient-selection criteria before I can move forward.",
    access: "I need to understand the patient access implications more clearly before deciding.",
    prior_auth: "I need one practical step that works within our prior-authorization burden before deciding.",
    workflow: "I need one concrete workflow step we can run this week without adding burden.",
    staffing: "I need a recommendation that fits our current staffing limits before we proceed.",
    capacity: "I need a step that reduces capacity strain, not one that adds workload.",
    scheduling: "I need this translated into a scheduling-safe step we can actually execute.",
    handoff: "I need a clear handoff step so ownership is unambiguous in our clinic flow.",
    throughput: "I need an action that improves throughput without disrupting care flow.",
    callback: "I need a realistic follow-up callback step we can sustain operationally.",
    monitoring: "I need a monitoring step we can implement without creating extra burden.",
    time: "I can only process one concrete clinical takeaway right now.",
    policy: "I need this aligned with our current protocol before I can proceed.",
  };

  const context = String(scenarioContext || "").toLowerCase();
  const inferContextFallback = () => {
    if (/\b(screening|candidacy|eligibility|criteria|resistance|cab)\b/.test(context)) return neutralByConcern.screening;
    if (/\b(monitoring|follow-up|durability|methodology|study duration)\b/.test(context)) return neutralByConcern.monitoring;
    if (/\b(prior auth|authorization|coverage|payer|access)\b/.test(context)) return neutralByConcern.access;
    if (/\b(staffing|short-staffed|capacity|throughput|pathway|workflow)\b/.test(context)) return neutralByConcern.staffing;
    return neutralByConcern.workflow;
  };

  const baseResponse = neutralByConcern[concern] || inferContextFallback();
  if (!includeWarmth) return baseResponse;

  const warmPrefix = "Good to see you. ";

  return `${warmPrefix}${baseResponse}`;
}

const LATE_TURN_REQUIREMENT_BY_CONCERN = {
  workflow: "a concrete workflow step that is practical this week",
  access: "a practical access step that works with prior-auth realities",
  evidence: "clinically meaningful evidence relevant to my practice",
  time: "one concise point that is immediately useful",
  policy: "a pathway-aligned next step that fits current policy",
  screening: "clear candidacy criteria I can apply in clinic",
};

export function selectLateTurnConstraintResponseMode({
  hasActiveConstraint = false,
  hasActiveRequirement = false,
  inLateTurnState = false,
  requirementAddressed = true,
  boundaryLevel = "normal",
  requirementRestatedCount = 0,
} = {}) {
  const level = boundaryLevel === "closing" ? "closing" : boundaryLevel === "constrained" ? "constrained" : "normal";
  const restatedCount = Number.isFinite(requirementRestatedCount)
    ? Math.max(0, requirementRestatedCount)
    : 0;
  const hasAnchors = Boolean(hasActiveConstraint || hasActiveRequirement);

  if (!hasAnchors || !inLateTurnState || requirementAddressed) {
    return {
      forced: false,
      mode: null,
      nextBoundaryLevel: level,
      nextRequirementRestatedCount: restatedCount,
    };
  }

  if (level === "closing") {
    return {
      forced: true,
      mode: "close",
      nextBoundaryLevel: "closing",
      nextRequirementRestatedCount: restatedCount,
    };
  }

  if (restatedCount < 1) {
    return {
      forced: true,
      mode: "restate_once",
      nextBoundaryLevel: level === "normal" ? "constrained" : level,
      nextRequirementRestatedCount: restatedCount + 1,
    };
  }

  if (level === "normal") {
    return {
      forced: true,
      mode: "boundary",
      nextBoundaryLevel: "constrained",
      nextRequirementRestatedCount: restatedCount,
    };
  }

  return {
    forced: true,
    mode: "close",
    nextBoundaryLevel: "closing",
    nextRequirementRestatedCount: restatedCount,
  };
}

export function buildLateTurnConstraintResponse({
  concern = "workflow",
  mode = "restate_once",
  includeConstraintSignal = false,
  seed = "",
  recentResponses = [],
} = {}) {
  const unmetRequirement = LATE_TURN_REQUIREMENT_BY_CONCERN[concern] || LATE_TURN_REQUIREMENT_BY_CONCERN.workflow;
  const introPool = includeConstraintSignal
    ? [
      "Given the time constraint,",
      "Given the limited time window,",
      "Because time is limited,",
    ]
    : [
      "To stay focused,",
      "So we keep this practical,",
      "To keep this productive,",
    ];

  const closePool = [
    "I need {{requirement}}. If that is not available now, we can pause here.",
    "I need {{requirement}} before we continue; otherwise let's pause here for now.",
    "I need {{requirement}}. If we cannot do that now, we'll pause and revisit later.",
  ];

  const boundaryPool = [
    "please stick to {{requirement}} before we continue.",
    "let's stay on {{requirement}} so we can move this forward.",
    "please anchor on {{requirement}} before adding anything else.",
  ];

  const restatePool = [
    "I still need {{requirement}}.",
    "I still need {{requirement}} before we move on.",
    "I still need {{requirement}} to keep this actionable.",
  ];

  const pickVariant = (pool, modeLabel) => {
    const normalizedRecent = (Array.isArray(recentResponses) ? recentResponses : [])
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean)
      .slice(-3);
    const startIndex = Math.abs(
      [...`${seed}:${concern}:${modeLabel}:${includeConstraintSignal ? "time" : "focus"}`]
        .reduce((acc, char) => acc + char.charCodeAt(0), 0),
    ) % pool.length;

    for (let i = 0; i < pool.length; i += 1) {
      const candidate = pool[(startIndex + i) % pool.length].replace("{{requirement}}", unmetRequirement);
      const normalized = candidate.toLowerCase();
      if (!normalizedRecent.includes(normalized)) return candidate;
    }

    return pool[startIndex].replace("{{requirement}}", unmetRequirement);
  };

  const intro = pickVariant(introPool, "intro");

  if (mode === "close") {
    return `${intro} ${pickVariant(closePool, "close")}`;
  }

  if (mode === "boundary") {
    return `${intro} ${pickVariant(boundaryPool, "boundary")}`;
  }

  return `${intro} ${pickVariant(restatePool, "restate")}`;
}
