import { deriveConcernFamily, deriveScenarioDomain } from "./hcpTurnDirectives";

/**
 * HCP Dialogue Directives
 * =======================
 * Safe extraction from the V2 response-surface approach:
 * scenario/domain/persona/concern-family specific dialogue guidance.
 */

export function buildDialogueDirectivePrompt(scenario: any = {}, behaviorState = "", predictedBehaviorState = ""): string {
  const domain = deriveScenarioDomain(scenario);
  const concernFamily = deriveConcernFamily(scenario);
  const pressures = scenario.interactionPressure || [];
  const state = String(predictedBehaviorState || behaviorState || "").toLowerCase();

  const domainDirective =
    domain === "oncology"
      ? "In oncology-style exchanges, keep the HCP analytical, threshold-aware, and exacting about subgroup fit or decision relevance."
      : domain === "cardiology"
        ? "In cardiology-style exchanges, keep the HCP practical about discharge flow, implementation burden, and what changes in routine care."
        : domain === "internal_medicine"
          ? "In internal-medicine-style exchanges, keep the HCP pragmatic, time-aware, and focused on what changes for a real patient or for clinic flow today."
        : domain === "hiv"
          ? "In HIV-style exchanges, keep the HCP focused on clinic flow, callbacks, refill gaps, and who owns the next practical step."
            : domain === "rare"
              ? "In rare-disease-style exchanges, keep the HCP focused on identification triggers, screening boundaries, and practical workup relevance."
              : "Keep the HCP grounded in the specific practice reality of the scenario rather than in generic product discussion.";

  const concernDirective =
    concernFamily === "evidence"
      ? "When the concern family is evidence, the HCP should ask for the proof point, threshold, subgroup fit, or decision-relevant implication."
        : concernFamily === "workflow"
          ? "When the concern family is workflow, the HCP should press on who does the work, what step gets added, and where clinic flow slows down."
        : concernFamily === "access"
          ? "When the concern family is access, the HCP should stay on the specific barrier, delay, handoff, or coverage step that blocks care."
            : concernFamily === "screening"
              ? "When the concern family is screening, the HCP should stay on patient boundaries, candidacy, or what would actually identify the right patient."
              : concernFamily === "time"
                ? "When the concern family is time, the HCP should compress the exchange and demand the short version, not broaden the conversation."
            : "Keep the HCP on one concrete concern instead of broadening the discussion.";

  const pressureDirective =
    pressures.includes("time_constrained")
      ? "Because time pressure is active, the HCP should sound brief, clipped, and economy-driven, not rude or theatrical."
      : pressures.includes("skeptical_resistant")
        ? "Because skepticism is active, the HCP should sound measured, exacting, and unconvinced until the rep earns movement."
        : pressures.includes("operationally_constrained")
          ? "Because operational pressure is active, the HCP should sound practical and burden-aware, not theoretically curious."
          : "Keep the HCP pressure aligned to the scenario rather than neutral by default.";

  const stateDirective =
    ["closed", "resistance", "frustration", "time_pressure"].includes(state)
      ? "Do not let the HCP sound socially open, chatty, or emotionally loose in this state."
      : ["open", "openness", "curiosity"].includes(state)
        ? "The HCP may allow more space, but should still sound clinically focused and professionally bounded."
        : "Keep the HCP measured and attentive without flattening the personality.";

  const exampleLine =
    concernFamily === "evidence" && domain === "oncology"
      ? 'Example tone: "That still feels broad. What changes treatment choice in practice?"'
      : concernFamily === "access" && domain === "cardiology"
        ? 'Example tone: "If this changes discharge, tell me what changes before the patient leaves."'
      : concernFamily === "workflow" && domain === "hiv"
        ? 'Example tone: "My staff is already buried. Who owns the first step if this goes forward?"'
      : concernFamily === "screening"
        ? 'Example tone: "Tell me which patient you actually mean, because broad eligibility does not help me."'
      : concernFamily === "time"
        ? 'Example tone: "I only have a minute. Give me the short version."'
      : 'Example tone: "Keep it practical. What changes for me in the room?"';

  return [
    "SCENARIO-BOUND DIALOGUE DIRECTIVES:",
    `- Domain: ${domain}`,
    `- Concern family: ${concernFamily}`,
    `- ${domainDirective}`,
    `- ${concernDirective}`,
    `- ${pressureDirective}`,
    `- ${stateDirective}`,
    `- ${exampleLine}`,
  ].join("\n");
}
