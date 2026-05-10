import {
  buildEndSessionFeedbackPrompt,
  buildCoachingFeedbackMarkdown,
  parseStructuredFeedback,
} from "./sessionFeedbackFormatter";

export function buildEndSessionFeedbackRequest({
  feedbackSot = "",
  baselineId = "",
  baselinePath = "",
  capabilitySummary = "",
  positives = [],
  misalignments = [],
  rubricFlags = [],
  scenarioTitle = "",
  hcpType = "",
  difficulty = "",
  historyText = "",
  maxTokens = 900,
  temperature = 0.2,
} = {}) {
  return {
    prompt: buildEndSessionFeedbackPrompt({
      feedbackSot,
      baselineId,
      baselinePath,
      capabilitySummary,
      positives,
      misalignments,
      rubricFlags,
      scenarioTitle,
      hcpType,
      difficulty,
      historyText,
    }),
    max_tokens: maxTokens,
    temperature,
  };
}

export function formatEndSessionFeedbackMarkdown({
  rawContent = "",
  runtimeScenarioContract,
  enforceFeedbackEvidenceRules = (value) => value,
} = {}) {
  const parsed = parseStructuredFeedback(rawContent);
  const markdown = buildCoachingFeedbackMarkdown(parsed);
  return enforceFeedbackEvidenceRules(markdown, runtimeScenarioContract);
}
