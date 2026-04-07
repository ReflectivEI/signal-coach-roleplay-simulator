import { classifyLatestAskProgression } from "../../components/roleplay/latestAskProgression.js";

const VALIDATION_VERSION = "roleplay_turn_validation_v1";

function normalizeForFingerprint(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTextFingerprint(value = "") {
  const normalized = normalizeForFingerprint(value);
  if (!normalized) return null;
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return `fnv1a_${hash.toString(16).padStart(8, "0")}`;
}

export function buildInvalidTurnCoaching(latestAskProgression = {}) {
  const family = latestAskProgression.family || "general";
  const labelByFamily = {
    workflow: "Answer the workflow ask",
    screening: "Answer the screening ask",
    evidence: "Answer the evidence ask",
    access: "Answer the access ask",
    general: "Answer the HCP ask",
  };
  const suggestionByFamily = {
    workflow: "Give one concrete workflow step tied to the HCP's constraint before introducing anything new.",
    screening: "Name the first screening or candidacy checkpoint you would use before moving forward.",
    evidence: "Give the decision-relevant evidence point the HCP asked for before adding context.",
    access: "Give the first access or prior-auth step that reduces the bottleneck before adding context.",
    general: "Answer the HCP's latest question directly before moving forward.",
  };

  return {
    shouldShow: true,
    label: labelByFamily[family] || labelByFamily.general,
    tip: "That turn repeated prior language without answering the HCP's latest ask, so it was not advanced.",
    suggestion: suggestionByFamily[family] || suggestionByFamily.general,
    severity: latestAskProgression.status === "repeated_missed_close" ? "high" : "medium",
    escalationLabel: "Turn blocked",
  };
}

export function shouldBlockRepTurnForLatestAsk(latestAskProgression = {}) {
  return ["repeated_missed", "repeated_missed_close"].includes(latestAskProgression.status);
}

function buildReasonCodes({ invalid, latestAskProgression = {}, coachingRequirementMet = true } = {}) {
  const reasonCodes = [];
  if (invalid) reasonCodes.push("invalid_turn_blocked");
  if (["repeated_missed", "repeated_missed_close"].includes(latestAskProgression.status)) {
    reasonCodes.push("repeated_non_answer_blocked");
  }
  if (["missed", "repeated_missed", "repeated_missed_close"].includes(latestAskProgression.status)) {
    reasonCodes.push("latest_ask_ignored");
  }
  if (!coachingRequirementMet) reasonCodes.push("coaching_requirement_not_met");
  if (!invalid && !reasonCodes.includes("latest_ask_ignored")) reasonCodes.push("valid_turn_progressed");
  return reasonCodes;
}

export function buildTurnValidationTelemetryEvents({
  latestAskProgression = {},
  invalid = false,
  latestHcpAsk = "",
  repMessage = "",
  previousRepMessages = [],
  coachingRequirement = null,
  coachingRequirementMet = true,
} = {}) {
  const reasonCodes = buildReasonCodes({ invalid, latestAskProgression, coachingRequirementMet });
  const basePayload = {
    validationVersion: VALIDATION_VERSION,
    status: latestAskProgression.status || "none",
    family: latestAskProgression.family || "general",
    reasonCodes,
    blockHcpGeneration: invalid,
    blockScoring: invalid,
    blockStateAdvance: invalid,
    repeatedRepCount: latestAskProgression.repeatedRepCount || 0,
    loopChallenge: Boolean(latestAskProgression.loopChallenge),
    coachingRequirementType: coachingRequirement?.behavior || null,
    coachingRequirementMet: Boolean(coachingRequirementMet),
    latestHcpAskFingerprint: buildTextFingerprint(latestHcpAsk),
    repMessageFingerprint: buildTextFingerprint(repMessage),
    previousRepCount: Array.isArray(previousRepMessages) ? previousRepMessages.length : 0,
  };

  if (invalid) {
    const events = [{ eventType: "invalid_turn_blocked", payload: basePayload }];
    if (reasonCodes.includes("repeated_non_answer_blocked")) {
      events.push({ eventType: "repeated_non_answer_blocked", payload: basePayload });
    }
    if (reasonCodes.includes("latest_ask_ignored")) {
      events.push({ eventType: "latest_ask_ignored", payload: basePayload });
    }
    if (reasonCodes.includes("coaching_requirement_not_met")) {
      events.push({ eventType: "coaching_requirement_not_met", payload: basePayload });
    }
    return events;
  }

  if (reasonCodes.includes("latest_ask_ignored")) {
    return [{ eventType: "latest_ask_ignored", payload: basePayload }];
  }

  return [{ eventType: "valid_turn_progressed", payload: basePayload }];
}

export function validateRoleplayRepTurn({
  latestHcpAsk = "",
  repMessage = "",
  previousRepMessages = [],
  coachingRequirement = null,
  coachingRequirementMet = true,
} = {}) {
  const latestAskProgression = classifyLatestAskProgression({
    latestHcpAsk,
    repMessage,
    previousRepMessages,
  });
  const invalid = shouldBlockRepTurnForLatestAsk(latestAskProgression) || Boolean(coachingRequirement && !coachingRequirementMet);
  const telemetryEvents = buildTurnValidationTelemetryEvents({
    latestAskProgression,
    invalid,
    latestHcpAsk,
    repMessage,
    previousRepMessages,
    coachingRequirement,
    coachingRequirementMet,
  });

  return {
    valid: !invalid,
    invalid,
    blockHcpGeneration: invalid,
    blockScoring: invalid,
    blockStateAdvance: invalid,
    latestAskProgression,
    coaching: invalid ? buildInvalidTurnCoaching(latestAskProgression) : null,
    telemetryEvents,
  };
}
