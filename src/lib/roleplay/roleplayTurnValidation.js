import { classifyLatestAskProgression } from "../../components/roleplay/latestAskProgression.js";

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

export function validateRoleplayRepTurn({ latestHcpAsk = "", repMessage = "", previousRepMessages = [] } = {}) {
  const latestAskProgression = classifyLatestAskProgression({
    latestHcpAsk,
    repMessage,
    previousRepMessages,
  });
  const invalid = shouldBlockRepTurnForLatestAsk(latestAskProgression);

  return {
    valid: !invalid,
    invalid,
    blockHcpGeneration: invalid,
    blockScoring: invalid,
    blockStateAdvance: invalid,
    latestAskProgression,
    coaching: invalid ? buildInvalidTurnCoaching(latestAskProgression) : null,
  };
}
