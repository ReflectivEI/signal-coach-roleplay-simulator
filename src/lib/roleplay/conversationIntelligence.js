import { RUNTIME_METRIC_IDS } from "../roleplay-v2/metricIdAdapter.js";

export const CONVERSATION_INTELLIGENCE_VERSION = "roleplay_conversation_intelligence_v1";

const RELIABILITY_THRESHOLDS = Object.freeze({
  high: 0.75,
  moderate: 0.6,
});

const CONCERN_FAMILY_BY_CAPABILITY = Object.freeze({
  workflow: "conversation_management",
  evidence: "value_connection",
  access: "objection_navigation",
  screening: "signal_interpretation",
  general: "signal_interpretation",
});

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "and", "are", "because", "been", "before", "being", "can",
  "could", "did", "does", "for", "from", "have", "here", "how", "into", "just", "last", "like",
  "more", "need", "not", "our", "out", "over", "said", "say", "that", "the", "their", "them",
  "there", "this", "those", "through", "time", "today", "turn", "want", "was", "we", "what",
  "when", "where", "which", "with", "would", "you", "your",
]);

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeMeaningful(value = "") {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function computeTokenOverlap(a = "", b = "") {
  const aTokens = new Set(tokenizeMeaningful(a));
  const bTokens = new Set(tokenizeMeaningful(b));
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) overlap += 1;
  });
  return overlap / Math.max(aTokens.size, bTokens.size);
}

function detectConcernFamily({ activeHcpAskState = null, scenarioExecutionContract = null, validationOutput = {}, latestHcpAsk = "" } = {}) {
  const text = String(latestHcpAsk || "").toLowerCase();
  const validationFamily = validationOutput?.latestAskProgression?.family;
  if (validationFamily && validationFamily !== "general") return validationFamily;
  if (/\b(screen|screening|candidacy|candidate|eligib|criteria|resistance|adherence|long[-\s]?acting|injectable)\b/.test(text)) return "screening";
  if (/\b(access|coverage|payer|prior[-\s]?auth|authorization|copay|afford|hub|enrollment|benefits)\b/.test(text)) return "access";
  if (/\b(evidence|data|study|trial|outcome|proof|durability|formulary|p&t|decision)\b/.test(text)) return "evidence";
  if (/\b(workflow|staff|team|step|process|clinic flow|handoff|monitoring|implementation|practical)\b/.test(text)) return "workflow";
  const explicitFamily = activeHcpAskState?.concernFamily || scenarioExecutionContract?.activeAsk?.concernFamily;
  if (explicitFamily && explicitFamily !== "general") return explicitFamily;
  return explicitFamily || "general";
}

function detectSpecificity(repMessage = "") {
  const text = String(repMessage || "").toLowerCase();
  if (/\b(first|one|specific|concrete|checklist|protocol|owner|own|nurse|np|pharmacist|coordinator|medical assistant|front desk|this week|today|quarterly|before|after|day[-\s]?\d+|t[-\s]?\d+)\b/.test(text)) return "high";
  if (/\b(step|process|team|staff|workflow|data|evidence|patients?|support|review|start|use|apply|focus)\b/.test(text)) return "moderate";
  return "low";
}

function detectPracticality(repMessage = "") {
  const text = String(repMessage || "").toLowerCase();
  if (/\b(start|assign|own|owned|run|pilot|implement|standardize|standardise|check|verify|route|submit|schedule|review|use|build|track|first step would be)\b/.test(text)
    && /\b(step|workflow|team|staff|checklist|protocol|owner|coordinator|nurse|np|pharmacist|process|handoff|this week|today)\b/.test(text)) {
    return "high";
  }
  if (/\b(practical|workflow|step|process|team|staff|implement|start)\b/.test(text)) return "moderate";
  return "low";
}

function detectEvidenceLinkage(repMessage = "") {
  const text = String(repMessage || "").toLowerCase();
  const evidence = /\b(data|evidence|study|trial|outcome|endpoint|durability|efficacy|safety|real[-\s]?world|proof)\b/.test(text);
  const decision = /\b(shows|supports|changes|matters|applies|relevant|decision|practice|because|therefore|so|means)\b/.test(text);
  if (evidence && decision) return "high";
  if (evidence) return "moderate";
  return "low";
}

function detectWorkflowLinkage(repMessage = "") {
  const text = String(repMessage || "").toLowerCase();
  const workflow = /\b(workflow|clinic flow|team|staff|process|handoff|checklist|protocol|monitoring|owner|own|nurse|np|coordinator)\b/.test(text);
  const action = /\b(start|assign|own|run|pilot|implement|standardize|standardise|use|route|schedule|track|review)\b/.test(text);
  if (workflow && action) return "high";
  if (workflow) return "moderate";
  return "low";
}

function detectToneAlignment(repMessage = "", latestHcpAsk = "") {
  const rep = String(repMessage || "").toLowerCase();
  const ask = String(latestHcpAsk || "").toLowerCase();
  if (/\b(hello\??|you tell|what decision|rephrase|i don'?t understand|i do not understand)\b/.test(rep)) return "low";
  if (/\b(i hear|understood|sounds like|you'?re focused|you are focused|that makes sense|given your|in your clinic)\b/.test(rep)) return "high";
  if (/\b(time|minutes|busy|short|practical|concrete|workflow)\b/.test(ask) && /\b(brief|focused|practical|concrete|one|first|workflow)\b/.test(rep)) return "high";
  return "moderate";
}

function hasGenericSetupLanguage(repMessage = "") {
  return /\b(last conversation|shared with you last week|high risk patients|i'?m here to discuss)\b/i.test(String(repMessage || ""));
}

function hasClarifyingMove(repMessage = "", latestHcpAsk = "") {
  const rep = String(repMessage || "");
  if (!rep.includes("?")) return false;
  return /\b(do you mean|are you asking|should i focus|would it help|is your priority|are you looking for|to make sure|what matters most|before we go further)\b/i.test(rep)
    || computeTokenOverlap(rep, latestHcpAsk) >= 0.18;
}

function hasAcknowledgement(repMessage = "", latestHcpAsk = "") {
  const rep = String(repMessage || "");
  if (/\b(i hear|understood|sounds like|you'?re saying|you are saying|i understand|that makes sense|given your|given the|your concern|your constraint)\b/i.test(rep)) return true;
  return computeTokenOverlap(rep, latestHcpAsk) >= 0.22;
}

function statusIndicatesProgress(status = "") {
  return (/progress$/.test(status) && !/missing/.test(status)) || /_clarification$/.test(status);
}

function statusIndicatesPartial(status = "") {
  return ["missing_owner", "repeated_missing_owner", "vague_owner_progress", "ownership_deflected"].includes(status);
}

function deriveProgression({ validationOutput = {}, communicationQualities = {} } = {}) {
  const status = validationOutput?.latestAskProgression?.status || validationOutput?.openingContextProgression?.status || "none";
  if (validationOutput?.nonConversationalInput?.detected) return "non_conversational";
  if (validationOutput?.nonAdaptiveRepetition?.detected) return "non_adaptive";
  if (validationOutput?.hardInvalid) return validationOutput?.openingContextProgression?.evasive ? "evasive" : "stalled";
  if (statusIndicatesProgress(status)) return "progress";
  if (statusIndicatesPartial(status) || status === "partially_responsive") return "partial";
  if (validationOutput?.softInvalid || ["missed", "repeated_missed", "repeated_missed_close", "non_responsive"].includes(status)) return "stalled";
  if (communicationQualities.specificity === "high" || communicationQualities.practicality === "high") return "partial";
  return "partial";
}

function chooseCoachingPriority({ progression, concernFamily, adaptationSignals, communicationQualities, validationOutput = {} } = {}) {
  if (validationOutput?.nonConversationalInput?.detected) {
    return {
      issue: "spoken_response_format",
      capability: "conversation_management",
      severity: validationOutput?.hardInvalid ? "high" : "medium",
      reason: "The response reads like notes rather than spoken dialogue.",
      nextAction: "Respond in a complete sentence as you would say it to the HCP.",
      shouldShow: true,
    };
  }
  if (validationOutput?.nonAdaptiveRepetition?.detected || adaptationSignals.repeated_without_adapting) {
    return {
      issue: "adaptation",
      capability: "adaptive_response",
      severity: validationOutput?.hardInvalid ? "high" : validationOutput?.nonAdaptiveRepetition?.stage === "escalated_soft_coach" ? "medium" : "low",
      reason: "The rep repeated prior language without adapting to the current HCP ask.",
      nextAction: "Adjust the response to the HCP's newest question before continuing the original point.",
      shouldShow: true,
    };
  }
  if (!adaptationSignals.addressed_active_ask) {
    if (adaptationSignals.stayed_in_setup_language) {
      return {
        issue: "adaptation",
        capability: "adaptive_response",
        severity: validationOutput?.hardInvalid ? "high" : "medium",
        reason: "The response stayed in setup language instead of adapting to the HCP's active ask.",
        nextAction: concernFamily === "evidence"
          ? "Adapt the opener into the proof point that changes the HCP's decision."
          : concernFamily === "workflow"
            ? "Adapt the opener into one practical workflow step the HCP can use."
            : "Adapt the opener to answer what the HCP just asked.",
        shouldShow: Boolean(validationOutput?.softInvalid || validationOutput?.hardInvalid),
      };
    }
    if (concernFamily === "evidence" && communicationQualities.evidence_linkage !== "high") {
      return {
        issue: "evidence_translation",
        capability: "value_connection",
        severity: validationOutput?.hardInvalid ? "high" : "medium",
        reason: "The response mentions evidence but does not connect it to the HCP's decision.",
        nextAction: "State the proof point and why it changes the decision in this setting.",
        shouldShow: Boolean(validationOutput?.softInvalid || validationOutput?.hardInvalid),
      };
    }
    return {
      issue: "interpretation",
      capability: "signal_interpretation",
      severity: validationOutput?.hardInvalid ? "high" : "medium",
      reason: "The response did not resolve the active HCP ask.",
      nextAction: "Answer the HCP's latest question directly, then add context if needed.",
      shouldShow: Boolean(validationOutput?.softInvalid || validationOutput?.hardInvalid),
    };
  }
  if (progression !== "progress" && concernFamily === "workflow" && communicationQualities.practicality !== "high") {
    return {
      issue: "specificity",
      capability: "conversation_management",
      severity: "medium",
      reason: "The workflow answer needs a more concrete operational step.",
      nextAction: "Name the first step and who would own it.",
      shouldShow: true,
    };
  }
  if (concernFamily === "evidence" && communicationQualities.evidence_linkage !== "high") {
    return {
      issue: "evidence_translation",
      capability: "value_connection",
      severity: "medium",
      reason: "The evidence was not clearly connected to the HCP's decision.",
      nextAction: "State the proof point and why it changes the decision in this setting.",
      shouldShow: true,
    };
  }
  if (!adaptationSignals.acknowledged_hcp_concern && progression !== "progress") {
    return {
      issue: "awareness",
      capability: "signal_awareness",
      severity: "low",
      reason: "The response could acknowledge the HCP's concern more clearly.",
      nextAction: "Briefly reflect the concern before answering.",
      shouldShow: true,
    };
  }
  return {
    issue: "maintain_progress",
    capability: CONCERN_FAMILY_BY_CAPABILITY[concernFamily] || "signal_interpretation",
    severity: "low",
    reason: "The response is sufficiently aligned to keep the conversation moving.",
    nextAction: "Continue with the active ask and keep the next step concrete.",
    shouldShow: false,
  };
}

function buildCapabilityMapping({ concernFamily, progression, adaptationSignals, coachingPriority } = {}) {
  const capabilitySignals = Object.fromEntries(RUNTIME_METRIC_IDS.map((id) => [id, "not_observed"]));
  capabilitySignals.signal_awareness = adaptationSignals.acknowledged_hcp_concern ? "strength" : "gap";
  capabilitySignals.signal_interpretation = adaptationSignals.addressed_active_ask ? "strength" : "gap";
  capabilitySignals.adaptive_response = adaptationSignals.repeated_without_adapting ? "gap" : adaptationSignals.adapted_to_new_constraint ? "strength" : "mixed";
  capabilitySignals.conversation_management = adaptationSignals.answered_concretely ? "strength" : "mixed";
  capabilitySignals.value_connection = concernFamily === "evidence" ? (progression === "progress" ? "strength" : "gap") : "not_observed";
  capabilitySignals.objection_navigation = concernFamily === "access" ? (progression === "progress" ? "strength" : "mixed") : "not_observed";
  capabilitySignals.customer_engagement = adaptationSignals.acknowledged_hcp_concern ? "strength" : "mixed";
  capabilitySignals.commitment_generation = adaptationSignals.answered_concretely ? "mixed" : "not_observed";

  if (adaptationSignals.non_conversational_input) {
    capabilitySignals.signal_interpretation = "gap";
    capabilitySignals.conversation_management = "gap";
    capabilitySignals.customer_engagement = "gap";
  }

  const primaryCapability = coachingPriority?.capability || CONCERN_FAMILY_BY_CAPABILITY[concernFamily] || "signal_interpretation";
  const supportingCapabilities = [
    CONCERN_FAMILY_BY_CAPABILITY[concernFamily],
    adaptationSignals.repeated_without_adapting ? "adaptive_response" : null,
    adaptationSignals.non_conversational_input ? "conversation_management" : null,
    adaptationSignals.acknowledged_hcp_concern ? "signal_awareness" : null,
    adaptationSignals.answered_concretely ? "conversation_management" : null,
  ].filter(Boolean);

  return {
    ontology: "manager_view_runtime_capabilities_v1",
    primaryCapability,
    supportingCapabilities: [...new Set(supportingCapabilities)],
    capabilitySignals,
  };
}

function deriveReliability({ validationOutput = {}, activeAskText = "", adaptationSignals = {}, communicationQualities = {} } = {}) {
  const deterministicEvidence = [];
  const heuristicSignals = [];
  let score = 0.58;

  if (validationOutput?.latestAskProgression?.status && validationOutput.latestAskProgression.status !== "none") {
    score += 0.14;
    deterministicEvidence.push("latest_ask_progression_status");
  }
  if (validationOutput?.openingContextProgression?.status) {
    score += 0.08;
    deterministicEvidence.push("opening_context_progression_status");
  }
  if (validationOutput?.nonAdaptiveRepetition?.detected) {
    score += 0.12;
    deterministicEvidence.push("non_adaptive_repetition_detected");
  }
  if (validationOutput?.nonConversationalInput?.detected) {
    score += 0.12;
    deterministicEvidence.push("non_conversational_input_detected");
  }
  if (activeAskText) {
    score += 0.06;
    deterministicEvidence.push("active_ask_present");
  }
  if (adaptationSignals.answered_concretely || adaptationSignals.clarified_before_advancing) {
    score += 0.04;
    heuristicSignals.push("concrete_or_clarifying_language");
  }
  if (communicationQualities.tone_alignment === "low") {
    score -= 0.08;
    heuristicSignals.push("low_tone_alignment");
  }
  if (!activeAskText && !validationOutput?.latestAskProgression?.status) {
    score -= 0.18;
    heuristicSignals.push("weak_ask_anchor");
  }

  const confidenceScore = Math.max(0.35, Math.min(0.92, Number(score.toFixed(2))));
  const band = confidenceScore >= RELIABILITY_THRESHOLDS.high
    ? "high"
    : confidenceScore >= RELIABILITY_THRESHOLDS.moderate
      ? "moderate"
      : "low";

  return {
    confidenceScore,
    band,
    deterministicEvidence,
    heuristicSignals,
    guardrail: "conversation_intelligence_never_overrides_validation_or_active_ask_state",
  };
}

function buildCoachingMessage(coachingPriority = {}) {
  if (!coachingPriority?.shouldShow) return null;
  const labelByIssue = {
    adaptation: "Adapt to the HCP's response",
    interpretation: "Answer the active ask",
    specificity: "Make it concrete",
    evidence_translation: "Connect evidence to the decision",
    awareness: "Acknowledge the concern",
    spoken_response_format: "Use spoken language",
  };
  return {
    shouldShow: true,
    label: labelByIssue[coachingPriority.issue] || "Refine the response",
    tip: coachingPriority.reason,
    suggestion: coachingPriority.nextAction,
    severity: coachingPriority.severity || "low",
    escalationLabel: "Conversation intelligence",
  };
}

export function deriveConversationIntelligenceState({
  scenarioExecutionContract = null,
  activeHcpAskState = null,
  latestHcpAsk = "",
  repMessage = "",
  validationOutput = {},
  coachingRequirement = null,
  recentTurnHistory = [],
  turnNumber = null,
} = {}) {
  const activeAskText = latestHcpAsk || activeHcpAskState?.askText || scenarioExecutionContract?.activeAsk?.askText || "";
  const concernFamily = detectConcernFamily({ activeHcpAskState, scenarioExecutionContract, validationOutput, latestHcpAsk: activeAskText || latestHcpAsk });
  const latestStatus = validationOutput?.latestAskProgression?.status || "none";
  const communicationQualities = {
    specificity: detectSpecificity(repMessage),
    relevance: statusIndicatesProgress(latestStatus) ? "high" : validationOutput?.softInvalid ? "low" : computeTokenOverlap(repMessage, activeAskText) >= 0.18 ? "moderate" : "low",
    practicality: detectPracticality(repMessage),
    evidence_linkage: detectEvidenceLinkage(repMessage),
    workflow_linkage: detectWorkflowLinkage(repMessage),
    tone_alignment: detectToneAlignment(repMessage, activeAskText),
  };
  const addressedActiveAsk = statusIndicatesProgress(latestStatus) || statusIndicatesPartial(latestStatus) || validationOutput?.openingContextProgression?.status === "responsive";
  const adaptationSignals = {
    acknowledged_hcp_concern: hasAcknowledgement(repMessage, activeAskText),
    addressed_active_ask: Boolean(addressedActiveAsk),
    adapted_to_new_constraint: Boolean(addressedActiveAsk && !validationOutput?.nonAdaptiveRepetition?.detected),
    repeated_without_adapting: Boolean(validationOutput?.nonAdaptiveRepetition?.detected),
    non_conversational_input: Boolean(validationOutput?.nonConversationalInput?.detected),
    stayed_in_setup_language: hasGenericSetupLanguage(repMessage) && !addressedActiveAsk,
    clarified_before_advancing: hasClarifyingMove(repMessage, activeAskText),
    answered_concretely: communicationQualities.specificity === "high" || communicationQualities.practicality === "high",
  };
  const progression = deriveProgression({ validationOutput, communicationQualities });
  const validationStatus = validationOutput?.hardInvalid
    ? "hardInvalid"
    : validationOutput?.softInvalid
      ? "softInvalid"
      : "valid";
  const coachingPriority = chooseCoachingPriority({ progression, concernFamily, adaptationSignals, communicationQualities, validationOutput });
  const capabilityMapping = buildCapabilityMapping({ concernFamily, progression, adaptationSignals, coachingPriority });
  const reliability = deriveReliability({ validationOutput, activeAskText, adaptationSignals, communicationQualities });

  return {
    version: CONVERSATION_INTELLIGENCE_VERSION,
    turnNumber,
    turnInterpretation: {
      valid: validationStatus,
      progression,
      latestAskStatus: latestStatus,
      openingContextStatus: validationOutput?.openingContextProgression?.status || null,
      concernFamily,
      askStrength: activeHcpAskState?.strength || scenarioExecutionContract?.activeAsk?.strength || scenarioExecutionContract?.openingState?.askStrength || null,
    },
    adaptationSignals,
    communicationQualities,
    capabilityMapping,
    coachingPriority,
    coachingMessage: buildCoachingMessage(coachingPriority),
    reliability,
    managerIntegration: {
      scenarioFamily: scenarioExecutionContract?.managerIntegration?.scenarioFamily || null,
      interactionSkill: scenarioExecutionContract?.managerIntegration?.interactionSkill || null,
      analyticsKey: capabilityMapping.primaryCapability,
    },
    sourceDependencies: {
      validationVersion: validationOutput?.telemetryEvents?.[0]?.payload?.validationVersion || null,
      contractVersion: scenarioExecutionContract?.contractVersion || null,
      recentTurnCount: Array.isArray(recentTurnHistory) ? recentTurnHistory.length : 0,
      coachingRequirementType: coachingRequirement?.behavior || null,
    },
  };
}

export function buildConversationIntelligenceTelemetryEvent(conversationIntelligenceState = {}, context = {}) {
  return {
    eventType: "conversation_intelligence_derived",
    payload: {
      version: conversationIntelligenceState?.version || CONVERSATION_INTELLIGENCE_VERSION,
      turnNumber: conversationIntelligenceState?.turnNumber ?? context.turnNumber ?? null,
      validationStatus: conversationIntelligenceState?.turnInterpretation?.valid || null,
      progression: conversationIntelligenceState?.turnInterpretation?.progression || null,
      concernFamily: conversationIntelligenceState?.turnInterpretation?.concernFamily || null,
      latestAskStatus: conversationIntelligenceState?.turnInterpretation?.latestAskStatus || null,
      repeatedWithoutAdapting: Boolean(conversationIntelligenceState?.adaptationSignals?.repeated_without_adapting),
      nonConversationalInput: Boolean(conversationIntelligenceState?.adaptationSignals?.non_conversational_input),
      addressedActiveAsk: Boolean(conversationIntelligenceState?.adaptationSignals?.addressed_active_ask),
      acknowledgedHcpConcern: Boolean(conversationIntelligenceState?.adaptationSignals?.acknowledged_hcp_concern),
      answeredConcretely: Boolean(conversationIntelligenceState?.adaptationSignals?.answered_concretely),
      coachingIssue: conversationIntelligenceState?.coachingPriority?.issue || null,
      coachingCapability: conversationIntelligenceState?.coachingPriority?.capability || null,
      reliabilityBand: conversationIntelligenceState?.reliability?.band || null,
      confidenceScore: conversationIntelligenceState?.reliability?.confidenceScore ?? null,
      primaryCapability: conversationIntelligenceState?.capabilityMapping?.primaryCapability || null,
      entryPoint: context.entryPoint || null,
      scenarioId: context.scenarioId || null,
      sessionId: context.sessionId || null,
    },
  };
}
