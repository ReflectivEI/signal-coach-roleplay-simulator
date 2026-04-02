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

  return `## 2) Capabilities Done Well

${safeStrengths}

## 3) Capabilities to Develop

${safeImprovements}

## 4) Signal–Response Alignment

${safePatterns}

## 5) Specific Action Items

${safeActions}`;
}
