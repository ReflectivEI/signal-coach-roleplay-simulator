import { getScenarioPolicyProfile } from "./scenarioPolicyProfiles.js";

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

export function extractConstraintCandidatesFromText(text = "", { scenarioFamily = "general_access" } = {}) {
  const value = String(text || "").trim();
  if (!value) return [];

  const sentences = value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const profile = getScenarioPolicyProfile(scenarioFamily);
  const familyAliases = profile?.constraintAliases || {};

  const candidates = [];
  sentences.forEach((sentence) => {
    const normalized = sentence.toLowerCase();
    OPERATIONAL_CONSTRAINT_TYPES.forEach((type) => {
      const aliasTokens = Array.isArray(familyAliases[type]) ? familyAliases[type] : [];
      const aliasMatch = aliasTokens.some((token) => normalized.includes(String(token).toLowerCase()));
      if (OPERATIONAL_CONSTRAINT_PATTERNS[type].test(sentence) || aliasMatch) {
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
export function detectOperationalConstraintTypes(text = "", { scenarioFamily = "general_access" } = {}) {
  return [...new Set(extractConstraintCandidatesFromText(text, { scenarioFamily }).map((item) => item.constraintType))];
}

export function buildConstraintGrounding({ scenarioText = "", dialogueTurns = [], scenarioFamily = "general_access" } = {}) {
  const scenarioCandidates = extractConstraintCandidatesFromText(scenarioText, { scenarioFamily });
  const dialogueCandidates = (Array.isArray(dialogueTurns) ? dialogueTurns : [])
    .flatMap((turnText) => extractConstraintCandidatesFromText(turnText, { scenarioFamily }));

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


const EMPTY_CONSTRAINT_VIOLATION = Object.freeze({
  valid: true,
  ungroundedTypes: [],
  duplicateTypes: [],
  draftCandidates: [],
  draftTypes: [],
  rejectionReason: null,
});

export function createDefaultConstraintViolation() {
  return {
    ...EMPTY_CONSTRAINT_VIOLATION,
    ungroundedTypes: [],
    duplicateTypes: [],
    draftCandidates: [],
    draftTypes: [],
  };
}

export function shouldEnforceConstraintGuardrails({
  transcriptConstraintPresent = false,
  normalizedActiveConstraints = [],
} = {}) {
  return Boolean(
    transcriptConstraintPresent
    || (Array.isArray(normalizedActiveConstraints) && normalizedActiveConstraints.length > 0)
  );
}

export function evaluateConstraintDraft({
  enforceGuardrails = false,
  draftText = "",
  groundedTypes = [],
  alreadySurfacedTypes = [],
  newlyRaisedTypes = [],
  revisitRequested = false,
  changedConstraint = false,
  clarificationNeeded = false,
  scenarioFamily = "general_access",
} = {}) {
  if (!enforceGuardrails) return createDefaultConstraintViolation();

  return detectConstraintDraftViolations({
    draftText,
    groundedTypes,
    alreadySurfacedTypes,
    newlyRaisedTypes,
    revisitRequested,
    changedConstraint,
    clarificationNeeded,
    scenarioFamily,
  });
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
  scenarioFamily = "general_access",
} = {}) {
  const draftCandidates = extractConstraintCandidatesFromText(draftText, { scenarioFamily });
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
} = {}) {
  const fallback = String(fallbackResponse || "").trim();
  const containsConstraint = extractConstraintCandidatesFromText(fallback).length > 0;
  if (fallback && !containsConstraint) return fallback;

  const neutralByConcern = {
    evidence: "I still need clinically meaningful evidence before I would change practice.",
    screening: "I need clearer patient-selection criteria before I can move forward.",
    access: "I need to understand the patient access implications more clearly before deciding.",
    time: "I can only process one concrete clinical takeaway right now.",
    policy: "I need this aligned with our current protocol before I can proceed.",
  };

  return neutralByConcern[concern] || "Help me understand the most clinically relevant takeaway for my patients.";
}

function normalizeDialogueSignature(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deterministicIndex(seed = "", length = 1) {
  if (!length || length <= 1) return 0;
  const source = String(seed || "constraint-violation-fallback");
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash * 31) + source.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % length;
}

export function buildConstraintViolationFallback({
  concern = "evidence",
  recentDialogues = [],
  seed = "",
} = {}) {
  const fallbackByConcern = {
    evidence: [
      "Help me understand the most clinically relevant takeaway for my patients.",
      "I still need clinically meaningful evidence before I would change practice.",
      "Give me one concrete clinical outcome that would change treatment decisions for stable patients.",
    ],
    screening: [
      "I need one clear patient-selection takeaway I can apply in practice.",
      "What single screening implication should change my next decision?",
    ],
    access: [
      "Give me one patient-impact takeaway that justifies discussing access changes.",
      "What is the one access-relevant clinical implication I should prioritize first?",
    ],
    time: [
      "I only need one clinical takeaway I can act on immediately.",
      "In one line, what patient-level outcome matters most right now?",
    ],
    policy: [
      "Give me one clinically relevant point that could fit our current protocol.",
      "What single patient-outcome takeaway should I evaluate against our protocol?",
    ],
  };

  const pool = fallbackByConcern[concern] || fallbackByConcern.evidence;
  const normalizedRecent = (Array.isArray(recentDialogues) ? recentDialogues : [])
    .map((line) => normalizeDialogueSignature(line))
    .filter(Boolean);
  const start = deterministicIndex(`${seed}:${concern}`, pool.length);

  for (let i = 0; i < pool.length; i += 1) {
    const candidate = pool[(start + i) % pool.length];
    if (!normalizedRecent.includes(normalizeDialogueSignature(candidate))) {
      return candidate;
    }
  }

  return pool[start];
}
