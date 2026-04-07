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

export function isExplicitOperationalBlockerPrompt(text = "") {
  const value = String(text || "");
  if (!value.trim()) return false;
  const hasBlockerSignal = /\b(blocker|unresolved|cannot move|can't move|stuck|before i can proceed|until this is resolved)\b/i.test(value);
  if (!hasBlockerSignal) return false;
  return /\b(workflow|operational|staff|capacity|prior auth|authorization|handoff|process|constraint)\b/i.test(value);
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

function extractScenarioBoundConstraintSentence({ scenarioContext = "", concern = "" } = {}) {
  const sentences = String(scenarioContext || "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length === 0) return "";

  const preferredPattern = OPERATIONAL_CONSTRAINT_PATTERNS[concern] || null;
  if (preferredPattern) {
    const preferred = sentences.find((sentence) => preferredPattern.test(sentence));
    if (preferred) return preferred;
  }

  const anyGroundedConstraint = sentences.find((sentence) => (
    OPERATIONAL_CONSTRAINT_TYPES.some((type) => OPERATIONAL_CONSTRAINT_PATTERNS[type].test(sentence))
  ));

  return anyGroundedConstraint || "";
}

const CONCERN_SAFE_REGENERATED_RESPONSE = Object.freeze({
  access: "Keep this tied to the specific access step we can act on now.",
  prior_auth: "Keep this tied to the prior-authorization step that changes what happens next.",
  monitoring: "Keep this tied to the monitoring step we can use before the next follow-up.",
  screening: "Keep this tied to patient-selection criteria we can apply consistently.",
  staffing: "Keep this tied to the staffing constraint and what my team can realistically absorb.",
  workflow: "Keep this tied to the workflow step we can implement without adding burden.",
  evidence: "Keep this tied to the one evidence point that changes the clinical decision.",
  policy: "Keep this tied to the policy or pathway constraint in front of us.",
  capacity: "Keep this tied to capacity and what can realistically fit into clinic flow.",
  scheduling: "Keep this tied to the scheduling step that prevents delay.",
  handoff: "Keep this tied to the handoff point where ownership needs to be clearer.",
  callback: "Keep this tied to the callback step that closes the follow-up gap.",
  throughput: "Keep this tied to throughput and the bottleneck slowing patient flow.",
  time: "Keep this to the one point that is useful in the time we have.",
});

function normalizeConcernForFallback(concern = "") {
  const value = String(concern || "").trim().toLowerCase();
  if (CONCERN_SAFE_REGENERATED_RESPONSE[value]) return value;
  if (/screen|candidate|candidacy|eligib|resistance/.test(value)) return "screening";
  if (/prior|auth|payer|coverage|access/.test(value)) return "prior_auth";
  if (/monitor|follow/.test(value)) return "monitoring";
  if (/staff/.test(value)) return "staffing";
  if (/workflow|operation|implementation|process/.test(value)) return "workflow";
  if (/evidence|data|study|trial/.test(value)) return "evidence";
  return "workflow";
}

function buildConcernSafeFallback({ concern = "", scenarioContext = "" } = {}) {
  const normalizedConcern = normalizeConcernForFallback(concern);
  const context = String(scenarioContext || "");
  if (/screen|candidate|candidacy|eligib|resistance/i.test(context)) {
    return CONCERN_SAFE_REGENERATED_RESPONSE.screening;
  }
  return CONCERN_SAFE_REGENERATED_RESPONSE[normalizedConcern] || CONCERN_SAFE_REGENERATED_RESPONSE.workflow;
}

function normalizeFactSurface(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/[-_/]+/g, " ")
    .replace(/[^a-z0-9.%\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractScenarioFactAnchors(text = "") {
  const value = String(text || "");
  if (!value.trim()) return [];

  const anchors = new Set();
  const patterns = [
    /\b\d+(?:\.\d+)?\s*(?:%|percent|percentage points?|years?|months?|weeks?|days?|hours?|minutes?|patients?|cases?|sites?|centers?|visits?)\b/gi,
    /\b\d+(?:\.\d+)?[-\s]*(?:year|month|week|day|hour|minute|patient|case|site|center|visit)\b/gi,
    /\b\d[\d,]*\s*(?:in|\/)\s*\d[\d,]*\b/gi,
  ];

  patterns.forEach((pattern) => {
    for (const match of value.matchAll(pattern)) {
      const anchor = normalizeFactSurface(match[0]);
      if (anchor) anchors.add(anchor);
    }
  });

  return [...anchors];
}

export function detectRepClarificationRequest(repMessage = "") {
  const value = String(repMessage || "").trim();
  if (!value) return false;

  const tokens = value.toLowerCase().split(/\s+/).filter(Boolean);
  const explicitClarification = /\b(what do you mean|what are you talking about|why are you telling me|why did you mention|can you clarify|could you clarify|clarify that|explain that|how so|unclear|i do not follow|i don't follow)\b/i.test(value);
  if (explicitClarification) return true;

  const shortQuestion = /\?\s*$/.test(value) && tokens.length <= 8;
  const ellipticalQuestion = shortQuestion && (
    /^(what|why|how|which|where|who)\b/i.test(value)
    || /\b(what|why|how)\?\s*$/i.test(value)
  );
  const proposalLikeQuestion = /\b(can we|could we|would you|should we|can i|could i|would it|do you want|would it help)\b/i.test(value);

  return Boolean(ellipticalQuestion && !proposalLikeQuestion);
}

export function detectUnsupportedScenarioFactIntroduction({
  draftText = "",
  scenarioContext = "",
  visibleContext = "",
} = {}) {
  const draft = normalizeFactSurface(draftText);
  const visible = normalizeFactSurface(visibleContext);
  const anchors = extractScenarioFactAnchors(scenarioContext);

  const introducedAnchors = anchors.filter((anchor) => (
    anchor
    && draft.includes(anchor)
    && !visible.includes(anchor)
  ));

  return {
    valid: introducedAnchors.length === 0,
    introducedAnchors,
    rejectionReason: introducedAnchors.length > 0 ? "unsupported_scenario_fact_introduction" : null,
  };
}

export function buildScenarioFactSafeClarification({
  previousHcpLine = "",
  activeConcern = "workflow",
} = {}) {
  const previous = String(previousHcpLine || "").toLowerCase();
  const concern = normalizeConcernForFallback(activeConcern);

  if (/\b(diagnos|symptom|presentation|workup|red flag)/.test(previous)) {
    return "I mean the clinical picture is not specific enough yet, so I need one practical way to decide who should move into the diagnostic workup.";
  }

  if (concern === "screening") {
    return "I mean the patient-selection criteria need to be clear enough for us to apply consistently.";
  }

  if (concern === "evidence") {
    return "I mean the evidence point needs to connect directly to the decision in front of me.";
  }

  if (concern === "prior_auth" || concern === "access") {
    return "I mean the access step needs to be specific enough to change what happens next.";
  }

  if (concern === "monitoring") {
    return "I mean the monitoring step needs to be concrete enough for the next follow-up.";
  }

  if (concern === "staffing") {
    return "I mean the recommendation needs to fit what my team can realistically absorb.";
  }

  return "I mean the last point needs to be translated into one specific next step for this scenario.";
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
  scenarioBoundFallbackResponse = "",
} = {}) {
  const fallback = String(fallbackResponse || "").trim();
  const scenarioBoundFallback = String(scenarioBoundFallbackResponse || "").trim();
  const containsConstraint = extractConstraintCandidatesFromText(fallback).length > 0;
  const warmPrefix = includeWarmth ? "Good to see you. " : "";

  if (scenarioBoundFallback) return `${warmPrefix}${scenarioBoundFallback}`.trim();
  if (fallback && !containsConstraint) return fallback;

  const scenarioBoundSentence = extractScenarioBoundConstraintSentence({
    scenarioContext,
    concern,
  });
  if (scenarioBoundSentence) {
    const concernSafeFallback = buildConcernSafeFallback({ concern, scenarioContext });
    const scenarioSentenceIsGeneric = /remain unclear|constraint|unresolved/i.test(scenarioBoundSentence);
    return `${warmPrefix}${scenarioSentenceIsGeneric ? concernSafeFallback : scenarioBoundSentence}`.trim();
  }

  return `${warmPrefix}${buildConcernSafeFallback({ concern, scenarioContext })}`.trim();
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
  holdAtBoundary = false,
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
      mode: holdAtBoundary ? "boundary" : "close",
      nextBoundaryLevel: holdAtBoundary ? "constrained" : "closing",
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
    mode: holdAtBoundary ? "boundary" : "close",
    nextBoundaryLevel: holdAtBoundary ? "constrained" : "closing",
    nextRequirementRestatedCount: restatedCount,
  };
}

export function buildLateTurnConstraintResponse({
  concern = "workflow",
  mode = "restate_once",
  includeConstraintSignal = false,
  seed = "",
  progressionStage = 0,
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
    const stageOffset = Number.isFinite(progressionStage) ? Math.max(0, Math.trunc(progressionStage)) : 0;
    const startIndex = Math.abs(
      [...`${seed}:${concern}:${modeLabel}:${includeConstraintSignal ? "time" : "focus"}:${stageOffset}`]
        .reduce((acc, char) => acc + char.charCodeAt(0), 0),
    ) % pool.length;
    return pool[startIndex].replace("{{requirement}}", unmetRequirement);
  };

  const intro = pickVariant(introPool, "intro");

  if (mode === "close") {
    return `${intro} ${pickVariant(closePool, "close")}`.trim();
  }

  if (mode === "boundary") {
    return `${intro} ${pickVariant(boundaryPool, "boundary")}`.trim();
  }

  return `${intro} ${pickVariant(restatePool, "restate")}`.trim();
}
