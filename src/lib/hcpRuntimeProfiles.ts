/**
 * HCP Runtime Profiles
 * ====================
 * A lightweight standalone port of the strongest V2 idea:
 * make HCP temperament, directness, warmth, patience, and brevity
 * explicit runtime concepts instead of leaving them implicit in prompts.
 */

import { deriveConcernFamily } from "./hcpTurnDirectives";
import { deriveFamilyTemperamentControls } from "./hcpFamilyProfiles";

export interface HcpRuntimeProfile {
  concernFamily: "evidence" | "workflow" | "access" | "hesitation" | "adoption_caution" | "screening" | "time" | "general";
  familyKey: string;
  warmth: "guarded" | "professional" | "measured" | "open";
  directness: "high" | "medium" | "low";
  brevity: "tight" | "concise" | "moderate";
  patienceThreshold: "low" | "medium" | "high";
  responseMode: "directive" | "clarifying" | "exploratory" | "closing";
  toneNotes: string[];
  familyNotes: string[];
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
  const concernFamily = deriveConcernFamily(scenario) as HcpRuntimeProfile["concernFamily"];
  const familyControls = deriveFamilyTemperamentControls(scenario);
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
  if (familyControls.warmthBias < 0 && warmth === "open") warmth = "measured";
  else if (familyControls.warmthBias < 0 && warmth === "measured") warmth = "professional";
  else if (familyControls.warmthBias < 0 && warmth === "professional") warmth = "guarded";
  else if (familyControls.warmthBias > 0 && warmth === "guarded") warmth = "professional";
  else if (familyControls.warmthBias > 0 && warmth === "professional") warmth = "measured";

  let directness: HcpRuntimeProfile["directness"] = highPressure ? "high" : "medium";
  if (persona.includes("skeptical") || concernFamily === "evidence" || concernFamily === "access") directness = "high";
  if (concernFamily === "hesitation" && !highPressure) directness = "medium";
  if (concernFamily === "adoption_caution" && !highPressure) directness = "medium";
  if (warmth === "open" && !highPressure) directness = "medium";
  if (familyControls.directnessBias > 0 && directness === "medium") directness = "high";
  else if (familyControls.directnessBias < 0 && directness === "high") directness = "medium";

  let brevity: HcpRuntimeProfile["brevity"] = highPressure ? "tight" : "concise";
  if (warmth === "open" && !highPressure) brevity = "moderate";
  if (familyControls.brevityBias > 0 && brevity === "moderate") brevity = "concise";
  else if (familyControls.brevityBias > 0 && brevity === "concise") brevity = "tight";
  else if (familyControls.brevityBias < 0 && brevity === "tight") brevity = "concise";
  else if (familyControls.brevityBias < 0 && brevity === "concise") brevity = "moderate";

  let patienceThreshold: HcpRuntimeProfile["patienceThreshold"] = highPressure ? "low" : "medium";
  if (warmth === "open" && !highPressure) patienceThreshold = "high";
  if (familyControls.patienceBias > 0 && patienceThreshold === "low") patienceThreshold = "medium";
  else if (familyControls.patienceBias > 0 && patienceThreshold === "medium") patienceThreshold = "high";
  else if (familyControls.patienceBias < 0 && patienceThreshold === "high") patienceThreshold = "medium";
  else if (familyControls.patienceBias < 0 && patienceThreshold === "medium") patienceThreshold = "low";

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
          : concernFamily === "hesitation"
            ? "Hold on the specific condition that would make one next step feel safe and concrete."
          : concernFamily === "adoption_caution"
            ? "Hold on first-mover risk, peer precedent, and what low-risk step would make action feel safe."
          : concernFamily === "screening"
            ? "Hold on the patient-selection boundary and what rule would actually be usable."
            : "Keep the current concern narrow and concrete.",
  ];

  return {
    concernFamily,
    familyKey: familyControls.familyKey,
    warmth,
    directness,
    brevity,
    patienceThreshold,
    responseMode,
    toneNotes,
    familyNotes: familyControls.notes,
  };
}

export function buildRuntimeProfilePrompt(profile: HcpRuntimeProfile): string {
  return [
    `RUNTIME HCP PROFILE:`,
    `- Concern family: ${profile.concernFamily}`,
    `- Scenario family: ${profile.familyKey}`,
    `- Warmth: ${profile.warmth}`,
    `- Directness: ${profile.directness}`,
    `- Brevity: ${profile.brevity}`,
    `- Patience threshold: ${profile.patienceThreshold}`,
    `- Response mode: ${profile.responseMode}`,
    ...profile.toneNotes.map((note) => `- ${note}`),
    ...profile.familyNotes.map((note) => `- ${note}`),
  ].join("\n");
}
