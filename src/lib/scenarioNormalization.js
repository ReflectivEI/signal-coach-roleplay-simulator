const SECTION_ALIASES = {
  openingScene: ["Initial Greeting from the HCP", "Initial Greeting", "Opening Scene", "Scene"],
  hcp: ["HCP Background and Context", "HCP Background", "HCP", "Stakeholder", "HCP Persona", "Context"],
  objective: ["Success Criteria", "Objective", "Best Approach and Expected Outcome", "Expected Outcome"],
  tacticalFocus: ["Potential Objections or Resistance Points", "Objections", "Key Challenges", "Challenges"],
};

function stripMarkdown(value = "") {
  return String(value)
    .replace(/\r\n/g, "\n")
    .replace(/```[\w-]*\n?|\n?```/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^[\t ]*[-*]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeRegex(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSection(text, labels) {
  const source = stripMarkdown(text);
  if (!source) return "";

  for (const label of labels) {
    const laterLabels = Object.values(SECTION_ALIASES)
      .flat()
      .filter((candidate) => candidate !== label)
      .map((candidate) => escapeRegex(candidate))
      .join("|");

    const pattern = new RegExp(
      `(?:^|\\n)${escapeRegex(label)}:\\s*([\\s\\S]*?)(?=\\n(?:${laterLabels}):|$)`,
      "i"
    );
    const match = source.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return "";
}

function splitIntoBullets(value, maxItems = 3) {
  const normalized = stripMarkdown(value)
    .replace(/\n+/g, "\n")
    .trim();

  if (!normalized) return [];

  const bulletCandidates = normalized
    .split(/\n|•|\u2022|;|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((item) => item.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);

  const unique = [];
  for (const item of bulletCandidates) {
    const cleaned = truncateLine(item);
    if (!cleaned) continue;
    if (!unique.some((existing) => existing.toLowerCase() === cleaned.toLowerCase())) {
      unique.push(cleaned);
    }
    if (unique.length >= maxItems) break;
  }

  return unique;
}

function truncateLine(value, maxWords = 18) {
  const cleaned = stripMarkdown(value)
    .replace(/\s+/g, " ")
    .replace(/^[:\-–]+\s*/, "")
    .trim();

  if (!cleaned) return "";

  const words = cleaned.split(" ");
  if (words.length <= maxWords) return cleaned;
  return `${words.slice(0, maxWords).join(" ")}…`;
}

function buildTags({ specialty, disease_state, hcp_category, influence_driver }) {
  return [specialty, disease_state, hcp_category, influence_driver]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 4);
}

function mapCategory(diseaseState = "") {
  const value = String(diseaseState || "").trim();
  if (!value) return "Rare Disease";
  if (/prep|hiv/i.test(value)) return "HIV / PrEP";
  if (/vaccine|immunization/i.test(value)) return "Vaccines";
  return value;
}

export function normalizeGeneratedScenario({
  title,
  content,
  description,
  specialty,
  disease_state,
  hcp_category,
  influence_driver,
  difficulty,
  focus_capabilities,
}) {
  const sourceText = [content, description].filter(Boolean).join("\n\n");
  const openingScene = truncateLine(extractSection(sourceText, SECTION_ALIASES.openingScene), 28);
  const hcpSection = extractSection(sourceText, SECTION_ALIASES.hcp);
  const objectiveSection = extractSection(sourceText, SECTION_ALIASES.objective);
  const tacticalSection = extractSection(sourceText, SECTION_ALIASES.tacticalFocus);

  const objective = splitIntoBullets(objectiveSection, 3);
  const tacticalFocus = splitIntoBullets(tacticalSection, 3);
  const hcpSummary = truncateLine(hcpSection || description || content, 24);
  const descriptionSummary = truncateLine(
    objective[0] || tacticalFocus[0] || hcpSummary || "Scenario generated in Scenario Builder.",
    18
  );

  return {
    title: stripMarkdown(title) || "Generated Scenario",
    tags: buildTags({ specialty, disease_state, hcp_category, influence_driver }),
    openingScene: openingScene || "Preview the HCP’s setting and opening beat before starting.",
    hcp: hcpSummary || "Profile details are not available for this HCP.",
    objective: objective.length > 0 ? objective : ["Guide the discussion toward a clear next step."],
    tacticalFocus: tacticalFocus.length > 0 ? tacticalFocus : ["Surface resistance early and respond with relevant value."],
    difficulty: difficulty || "intermediate",
    description: descriptionSummary,
    specialty,
    disease_state,
    hcp_category,
    influence_driver,
    focus_capabilities: Array.isArray(focus_capabilities) ? focus_capabilities : [],
    sourceText: stripMarkdown(sourceText),
  };
}

export function buildSimulatorScenarioFromNormalized(normalized) {
  const scenarioId = `builder_${Date.now()}`;
  return {
    id: scenarioId,
    title: normalized.title,
    description: normalized.description,
    category: mapCategory(normalized.disease_state),
    specialty: normalized.specialty,
    hcp_category: normalized.hcp_category,
    influence_driver: normalized.influence_driver,
    stakeholder: normalized.hcp,
    difficulty: normalized.difficulty,
    objective: normalized.objective,
    challenges: normalized.tacticalFocus,
    openingScene: normalized.openingScene,
    opening_scene: normalized.openingScene,
    hcp: normalized.hcp,
    focus_capabilities: normalized.focus_capabilities,
    context: normalized.hcp,
    tags: normalized.tags,
    state: "Ready for Simulation",
    source: "scenario-builder",
    normalized: true,
  };
}

export function getScenarioStatusLabel(scenario) {
  return scenario?.state || "Draft";
}
