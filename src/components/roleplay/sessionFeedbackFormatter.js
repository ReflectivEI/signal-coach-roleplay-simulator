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

const FEEDBACK_SECTION_DEFS = [
  {
    key: "primaryDiagnosisText",
    heading: "1) Primary Diagnosis",
    prompt: "PRIMARY DIAGNOSIS (name the main observable interaction breakdown or success driver; tie it to the HCP's actual response)",
    fallback: "No primary diagnosis was generated. Review the transcript and identify the strongest observable interaction driver before coaching.",
    patterns: [
      /^SECTION\s+1:\s+PRIMARY\s+DIAGNOSIS[^\n]*\n?/i,
      /^PRIMARY\s+DIAGNOSIS\s*[:—]*\s*\n?/i,
    ],
  },
  {
    key: "failureHierarchyText",
    heading: "2) Failure Hierarchy",
    prompt: "FAILURE HIERARCHY (rank the primary failure driver, secondary effects, and the capability state affected)",
    fallback: "No failure hierarchy was generated. Anchor coaching to the primary capability gap and any secondary effects visible in the conversation.",
    patterns: [
      /^SECTION\s+2:\s+FAILURE\s+HIERARCHY[^\n]*\n?/i,
      /^FAILURE\s+HIERARCHY\s*[:—]*\s*\n?/i,
    ],
  },
  {
    key: "interactionConsequenceText",
    heading: "3) Interaction Consequence",
    prompt: "INTERACTION CONSEQUENCE (explain what the rep behavior caused the HCP to do next, using the transcript)",
    fallback: "No interaction consequence was generated. Describe how the HCP response narrowed, resisted, opened, or stalled after the rep move.",
    patterns: [
      /^SECTION\s+3:\s+INTERACTION\s+CONSEQUENCE[^\n]*\n?/i,
      /^INTERACTION\s+CONSEQUENCE\s*[:—]*\s*\n?/i,
    ],
  },
  {
    key: "whatWentWellText",
    heading: "4) What You Did Well",
    prompt: "WHAT YOU DID WELL (only include behaviors that actually helped the exchange; if nothing changed trajectory, say that clearly)",
    fallback: "No meaningful strength changed the interaction trajectory in this exchange.",
    patterns: [
      /^SECTION\s+4:\s+WHAT\s+YOU\s+DID\s+WELL[^\n]*\n?/i,
      /^WHAT\s+YOU\s+DID\s+WELL\s*[:—]*\s*\n?/i,
      /^STRENGTHS?\s*[:—]*\s*\n?/i,
    ],
  },
  {
    key: "limitsText",
    heading: "5) What Limited the Interaction",
    prompt: "WHAT LIMITED THE INTERACTION (specific observable behaviors that reduced credibility, relevance, momentum, or commitment)",
    fallback: "No limitation detail was generated. Focus on whether the rep addressed the HCP's exact barrier before advancing the message.",
    patterns: [
      /^SECTION\s+5:\s+WHAT\s+LIMITED\s+THE\s+INTERACTION[^\n]*\n?/i,
      /^WHAT\s+LIMITED\s+THE\s+INTERACTION\s*[:—]*\s*\n?/i,
      /^IMPROVE[A-Z]*\s*[:—]*\s*\n?/i,
    ],
  },
  {
    key: "hcpTestingText",
    heading: "6) What the HCP Was Testing",
    prompt: "WHAT THE HCP WAS TESTING (infer only from scenario context and HCP dialogue: evidence fit, workflow burden, formulary/access, patient relevance, or credibility)",
    fallback: "No HCP test was generated. Use the HCP's spoken resistance and scenario pressures to identify what they were validating.",
    patterns: [
      /^SECTION\s+6:\s+WHAT\s+THE\s+HCP\s+WAS\s+TESTING[^\n]*\n?/i,
      /^WHAT\s+THE\s+HCP\s+WAS\s+TESTING\s*[:—]*\s*\n?/i,
    ],
  },
  {
    key: "coachingDirectionText",
    heading: "7) Coaching Direction",
    prompt: "COACHING DIRECTION (give the next best rep move and one example phrase grounded in the actual HCP concern)",
    fallback: "Answer the HCP's exact barrier first, then ask one narrow follow-up tied to workflow, access, evidence, or patient fit.",
    patterns: [
      /^SECTION\s+7:\s+COACHING\s+DIRECTION[^\n]*\n?/i,
      /^COACHING\s+DIRECTION\s*[:—]*\s*\n?/i,
      /^ACTION[A-Z]*\s*[:—]*\s*\n?/i,
    ],
  },
  {
    key: "evidenceReferencesText",
    heading: "8) Evidence / References",
    prompt: "EVIDENCE / REFERENCES (quote or precisely paraphrase transcript evidence; include scenario/evidence references only if provided; do not invent studies)",
    fallback: "Conversation evidence was available in the transcript; no external evidence references were provided for this feedback pass.",
    patterns: [
      /^SECTION\s+8:\s+EVIDENCE\s*\/\s*REFERENCES[^\n]*\n?/i,
      /^EVIDENCE\s*\/\s*REFERENCES\s*[:—]*\s*\n?/i,
      /^EVIDENCE\s+AND\s+REFERENCES\s*[:—]*\s*\n?/i,
    ],
  },
];

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

Respond with PLAIN TEXT (no markdown, no special formatting). Provide exactly 8 sections separated by the exact delimiter "[SECTION_END]":
SECTION 1: ${FEEDBACK_SECTION_DEFS[0].prompt}
[SECTION_END]
SECTION 2: ${FEEDBACK_SECTION_DEFS[1].prompt}
[SECTION_END]
SECTION 3: ${FEEDBACK_SECTION_DEFS[2].prompt}
[SECTION_END]
SECTION 4: ${FEEDBACK_SECTION_DEFS[3].prompt}
[SECTION_END]
SECTION 5: ${FEEDBACK_SECTION_DEFS[4].prompt}
[SECTION_END]
SECTION 6: ${FEEDBACK_SECTION_DEFS[5].prompt}
[SECTION_END]
SECTION 7: ${FEEDBACK_SECTION_DEFS[6].prompt}
[SECTION_END]
SECTION 8: ${FEEDBACK_SECTION_DEFS[7].prompt}
[SECTION_END]
CRITICAL RULES:
- Do NOT include numeric scores
- Each section is plain text (no markdown, no bullet points in the response text)
- Separate sections with EXACTLY "[SECTION_END]"
- All feedback must be observable and specific
- Dialogue examples must come from the conversation transcript, not invented sample dialogue
- Evidence / References must not invent source names, studies, or data not present in the scenario, transcript, or feedback context`;
}

export function parseStructuredFeedback(rawContent = "") {
  const normalizedRaw = safeText(rawContent);
  if (!normalizedRaw) {
    return Object.fromEntries(FEEDBACK_SECTION_DEFS.map((section) => [section.key, ""]));
  }

  let sections = normalizedRaw
    .split("[SECTION_END]")
    .map((section) => section.trim())
    .filter(Boolean);

  if (sections.length < 8 || sections.some((section) => section.length < 20)) {
    const sectionMatches = FEEDBACK_SECTION_DEFS.map((section, index) => {
      const label = section.heading.replace(/^\d+\)\s*/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const nextLabels = FEEDBACK_SECTION_DEFS.slice(index + 1)
        .map((next) => next.heading.replace(/^\d+\)\s*/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
      const stop = nextLabels ? `(?=(?:SECTION\\s+\\d+:\\s*(?:${nextLabels})|${nextLabels}|\\[SECTION_END\\]|$))` : "(?=$)";
      const match = normalizedRaw.match(new RegExp(`(?:SECTION\\s+${index + 1}:\\s*)?${label}[:\\s—-]*\\n+([\\s\\S]*?)${stop}`, "i"));
      return match?.[1] || "";
    });

    if (sectionMatches.some(Boolean)) {
      sections = sectionMatches;
    } else {
      const strengthsMatch = normalizedRaw.match(/(?:STRENGTHS?|Done Well|Strong|Positive)[:\s]*\n+([\s\S]*?)(?=(?:IMPROVE|Develop|Weakness|Gap|SECTION)|$)/i);
      const improvementsMatch = normalizedRaw.match(/(?:IMPROVE|Develop|Focus|Weakness|Gap)[:\s]*\n+([\s\S]*?)(?=(?:PATTERN|Align|SECTION|ACTION)|$)/i);
      const patternsMatch = normalizedRaw.match(/(?:PATTERN|Align|Signal|Response)[:\s]*\n+([\s\S]*?)(?=(?:ACTION|SECTION|$))/i);
      const actionsMatch = normalizedRaw.match(/(?:ACTION|Item|Behavioral Change|Next)[:\s]*\n+([\s\S]*?)$/i);

      sections = [
        normalizedRaw,
        "",
        patternsMatch?.[1] || "",
        strengthsMatch?.[1] || "",
        improvementsMatch?.[1] || "",
        "",
        actionsMatch?.[1] || "",
        "",
      ];
    }
  }

  if (sections.length < 8 || sections.every((section) => !section || section.length < 15)) {
    sections = [normalizedRaw, "", "", ""];
  }

  return Object.fromEntries(
    FEEDBACK_SECTION_DEFS.map((section, index) => [
      section.key,
      stripSectionHeader(sections[index] || "", section.patterns),
    ]),
  );
}

export function buildCoachingFeedbackMarkdown({
  primaryDiagnosisText = "",
  failureHierarchyText = "",
  interactionConsequenceText = "",
  whatWentWellText = "",
  limitsText = "",
  hcpTestingText = "",
  coachingDirectionText = "",
  evidenceReferencesText = "",
} = {}) {
  const values = {
    primaryDiagnosisText,
    failureHierarchyText,
    interactionConsequenceText,
    whatWentWellText,
    limitsText,
    hcpTestingText,
    coachingDirectionText,
    evidenceReferencesText,
  };

  return FEEDBACK_SECTION_DEFS
    .map((section) => `## ${section.heading}\n\n${safeText(values[section.key]) || section.fallback}`)
    .join("\n\n");
}
