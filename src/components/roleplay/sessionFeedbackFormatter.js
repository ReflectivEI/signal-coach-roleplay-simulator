function safeText(value = "") {
  return String(value || "").trim();
}

function stripSectionHeader(text = "", patterns = []) {
  let value = safeText(text);
  patterns.forEach((pattern) => {
    value = value.replace(pattern, "");
  });
  return value.trim();
}

export function buildEndSessionFeedbackPrompt({
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
} = {}) {
  const positivesSection = Array.isArray(positives) && positives.length > 0
    ? positives.slice(0, 10).map((item) => `• ${safeText(item)}`).join("\n")
    : "• None detected";

  const misalignmentsSection = Array.isArray(misalignments) && misalignments.length > 0
    ? misalignments.slice(0, 10).map((item) => `• ${safeText(item)}`).join("\n")
    : "• None detected";

  const rubricSection = Array.isArray(rubricFlags) && rubricFlags.length > 0
    ? `\nRUBRIC ALIGNMENT FLAGS:\n${rubricFlags.map((item) => `• ${safeText(item)}`).join("\n")}`
    : "";

  return `You are a skilled sales coach analyzing a roleplay simulation session. Ground ALL feedback in observable behavior only — never infer intent, emotion, or personality traits.
${safeText(feedbackSot)}

BASELINE EVALUATION CONTRACT:
- Baseline ID: ${safeText(baselineId)}
- Baseline Path: ${safeText(baselinePath)}
- Treat this end-of-session path as the canonical reference for final evaluation behavior.

SESSION SCORING DATA (deterministic, turn-by-turn):
Deterministic session alignment summary (non-numeric): use only the qualitative findings below
${safeText(capabilitySummary)}

POSITIVES OBSERVED (turn-by-turn):
${positivesSection}
MISALIGNMENTS OBSERVED (turn-by-turn):
${misalignmentsSection}${rubricSection}

Session Context:
Scenario: ${safeText(scenarioTitle)}
HCP Type: ${safeText(hcpType)}
Difficulty: ${safeText(difficulty)}

Conversation Transcript:
${safeText(historyText)}

Respond with PLAIN TEXT (no markdown, no special formatting). Provide exactly 4 sections separated by the exact delimiter "[SECTION_END]":
SECTION 1: STRENGTHS (observable behaviors showing strong capability performance)
[SECTION_END]
SECTION 2: IMPROVEMENTS (specific capability gaps and areas to develop)
[SECTION_END]
SECTION 3: PATTERNS (notable signal-response alignment patterns and behaviors)
[SECTION_END]
SECTION 4: ACTION ITEMS (2-3 specific behavioral changes for next session)
[SECTION_END]
CRITICAL RULES:
- Do NOT include numeric scores
- Each section is plain text (no markdown, no bullet points in the response text)
- Separate sections with EXACTLY "[SECTION_END]"
- All feedback must be observable and specific`;
}

export function parseStructuredFeedback(rawContent = "") {
  const normalizedRaw = safeText(rawContent);
  if (!normalizedRaw) {
    return {
      strengthsText: "",
      improvementsText: "",
      patternsText: "",
      actionText: "",
    };
  }

  let sections = normalizedRaw
    .split("[SECTION_END]")
    .map((section) => section.trim())
    .filter(Boolean);

  if (sections.length < 4 || sections.some((section) => section.length < 20)) {
    const strengthsMatch = normalizedRaw.match(/(?:STRENGTHS?|Done Well|Strong|Positive)[:\s]*\n+([\s\S]*?)(?=(?:IMPROVE|Develop|Weakness|Gap|SECTION)|$)/i);
    const improvementsMatch = normalizedRaw.match(/(?:IMPROVE|Develop|Focus|Weakness|Gap)[:\s]*\n+([\s\S]*?)(?=(?:PATTERN|Align|SECTION|ACTION)|$)/i);
    const patternsMatch = normalizedRaw.match(/(?:PATTERN|Align|Signal|Response)[:\s]*\n+([\s\S]*?)(?=(?:ACTION|SECTION|$))/i);
    const actionsMatch = normalizedRaw.match(/(?:ACTION|Item|Behavioral Change|Next)[:\s]*\n+([\s\S]*?)$/i);

    sections = [
      strengthsMatch?.[1] || "",
      improvementsMatch?.[1] || "",
      patternsMatch?.[1] || "",
      actionsMatch?.[1] || "",
    ];
  }

  if (sections.length < 4 || sections.every((section) => !section || section.length < 15)) {
    sections = [normalizedRaw, "", "", ""];
  }

  const strengthsText = stripSectionHeader(sections[0], [
    /^SECTION\s+1:\s+STRENGTHS\s*\n?/i,
    /^STRENGTHS?\s*[:—]*\s*\n?/i,
  ]);
  const improvementsText = stripSectionHeader(sections[1], [
    /^SECTION\s+2:\s+IMPROVEMENTS\s*\n?/i,
    /^IMPROVE[A-Z]*\s*[:—]*\s*\n?/i,
  ]);
  const patternsText = stripSectionHeader(sections[2], [
    /^SECTION\s+3:\s+PATTERNS\s*\n?/i,
    /^PATTERN[A-Z]*\s*[:—]*\s*\n?/i,
  ]);
  const actionText = stripSectionHeader(sections[3], [
    /^SECTION\s+4:\s+ACTION\s+ITEMS\s*\n?/i,
    /^ACTION[A-Z]*\s*[:—]*\s*\n?/i,
  ]);

  return {
    strengthsText,
    improvementsText,
    patternsText,
    actionText,
  };
}

export function buildCoachingFeedbackMarkdown({
  strengthsText = "",
  improvementsText = "",
  patternsText = "",
  actionText = "",
} = {}) {
  const safeStrengths = safeText(strengthsText) || "The HCP demonstrated solid engagement and appropriate questioning throughout the conversation.";
  const safeImprovements = safeText(improvementsText) || "Continue developing the ability to connect signals to specific clinical or practice outcomes.";
  const safePatterns = safeText(patternsText) || "The HCP showed responsive engagement, adapting questions based on the sales rep's input.";
  const safeActions = safeText(actionText) || "Focus on: (1) Deeper exploration of the HCP's current workflow, (2) Connecting study findings to practice impact, (3) Addressing objections with research-backed evidence.";

  return `## 2) Capabilities Done Well\n\n${safeStrengths}\n\n## 3) Capabilities to Develop\n\n${safeImprovements}\n\n## 4) Signal–Response Alignment\n\n${safePatterns}\n\n## 5) Specific Action Items\n\n${safeActions}`;
}
