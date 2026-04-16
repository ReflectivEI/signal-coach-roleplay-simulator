/**
 * HCP Runtime Profiles
 * ====================
 * A lightweight standalone port of the strongest V2 idea:
 * make HCP temperament, directness, warmth, patience, and brevity
 * explicit runtime concepts instead of leaving them implicit in prompts.
 */

export interface HcpRuntimeProfile {
  concernFamily: "evidence" | "workflow" | "access" | "screening" | "time" | "general";
  warmth: "guarded" | "professional" | "measured" | "open";
  directness: "high" | "medium" | "low";
  brevity: "tight" | "concise" | "moderate";
  patienceThreshold: "low" | "medium" | "high";
  responseMode: "directive" | "clarifying" | "exploratory" | "closing";
  toneNotes: string[];
}

function deriveConcernFamily(scenario: any = {}): HcpRuntimeProfile["concernFamily"] {
  const text = [
    scenario.journeyStage,
    scenario.decisionOrientation,
    scenario.title,
    scenario.description,
    scenario.objective,
    ...(scenario.interactionPressure || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\b(access|coverage|copay|prior auth|formulary|payer|benefits)\b/.test(text)) return "access";
  if (/\b(workflow|staff|handoff|process|clinic|operational|implementation)\b/.test(text)) return "workflow";
  if (/\b(screen|screening|candidate|eligibility|identify|selection)\b/.test(text)) return "screening";
  if (/\b(evidence|trial|study|guideline|data|proof|subgroup|threshold)\b/.test(text)) return "evidence";
  if (/\b(time|minutes|schedule|patient waiting|quick|brief)\b/.test(text)) return "time";
  return "general";
}

export function deriveHcpRuntimeProfile({
  scenario,
  behaviorState,
  predictedBehaviorState,
}: {
  scenario: any;
  behaviorState: string;
  predictedBehaviorState?: string;
}): HcpRuntimeProfile {
  const concernFamily = deriveConcernFamily(scenario);
  const pressures = scenario?.interactionPressure || [];
  const persona = String(scenario?.persona || "").toLowerCase();
  const state = String(predictedBehaviorState || behaviorState || "").toLowerCase();

  const highPressure =
    pressures.includes("time_constrained") ||
    pressures.includes("operationally_constrained") ||
    pressures.includes("skeptical_resistant") ||
    pressures.includes("safety_concern") ||
    ["closed", "resistance", "frustration", "time_pressure"].includes(state);

  let warmth: HcpRuntimeProfile["warmth"] = "professional";
  if (["open", "openness", "curiosity"].includes(state) || persona.includes("curious")) warmth = "open";
  else if (state === "neutral") warmth = "measured";
  else if (highPressure || persona.includes("skeptical")) warmth = "guarded";

  let directness: HcpRuntimeProfile["directness"] = highPressure ? "high" : "medium";
  if (persona.includes("skeptical") || concernFamily === "evidence" || concernFamily === "access") directness = "high";
  if (warmth === "open" && !highPressure) directness = "medium";

  let brevity: HcpRuntimeProfile["brevity"] = highPressure ? "tight" : "concise";
  if (warmth === "open" && !highPressure) brevity = "moderate";

  let patienceThreshold: HcpRuntimeProfile["patienceThreshold"] = highPressure ? "low" : "medium";
  if (warmth === "open" && !highPressure) patienceThreshold = "high";

  let responseMode: HcpRuntimeProfile["responseMode"] = "clarifying";
  if (state === "terminal_exit") responseMode = "closing";
  else if (highPressure || directness === "high") responseMode = "directive";
  else if (warmth === "open") responseMode = "exploratory";

  const toneNotes = [
    directness === "high" ? "Use plain, direct clinician language." : "Keep the language professionally grounded.",
    brevity === "tight" ? "Keep the reply tight and clipped when pressure is active." : "Keep the reply concise and naturally spoken.",
    warmth === "guarded"
      ? "Do not sound rude, but do sound guarded and time-aware."
      : warmth === "open"
        ? "Allow some warmth, but keep it clinical and professional."
        : "Stay measured and professional rather than emotionally flat.",
    concernFamily === "evidence"
      ? "Hold on the decision-relevant proof point, not broad efficacy framing."
      : concernFamily === "workflow"
        ? "Hold on clinic practicality and who would actually do the work."
        : concernFamily === "access"
          ? "Hold on the access barrier and the specific step that slows care down."
          : concernFamily === "screening"
            ? "Hold on the patient-selection boundary and what rule would actually be usable."
            : "Keep the current concern narrow and concrete.",
  ];

  return {
    concernFamily,
    warmth,
    directness,
    brevity,
    patienceThreshold,
    responseMode,
    toneNotes,
  };
}

export function buildRuntimeProfilePrompt(profile: HcpRuntimeProfile): string {
  return [
    `RUNTIME HCP PROFILE:`,
    `- Concern family: ${profile.concernFamily}`,
    `- Warmth: ${profile.warmth}`,
    `- Directness: ${profile.directness}`,
    `- Brevity: ${profile.brevity}`,
    `- Patience threshold: ${profile.patienceThreshold}`,
    `- Response mode: ${profile.responseMode}`,
    ...profile.toneNotes.map((note) => `- ${note}`),
  ].join("\n");
}
