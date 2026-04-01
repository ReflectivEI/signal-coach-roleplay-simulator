import test from "node:test";
import assert from "node:assert/strict";

import { classifyScenarioTaxonomy, enrichScenarioWithTaxonomy } from "../src/lib/roleplay-v2/scenarioTaxonomy.js";
import { deriveScenarioMetadataEnvelope, validateScenarioMetadataEnvelope } from "../src/lib/roleplay-v2/scenarioMetadataEnvelope.js";
import { deriveInitialState, deriveInitialTemperature, transitionSeverity, transitionState, transitionTemperature } from "../src/components/roleplay/hcpSimulationEngine.jsx";
import { computeAlignment } from "../src/components/roleplay/alignmentEngine.jsx";

const CUSTOM_SCENARIOS = Object.freeze([
  {
    id: "custom_pa_oncology_blocked",
    title: "Oncology access friction with overloaded staff",
    description: "Clinic PA team is overloaded and skeptical of new operational burden.",
    hcp_category: "Prescriber / Treater",
    influence_driver: "Risk-Averse",
    difficulty: "intermediate",
  },
  {
    id: "custom_virtual_kol",
    title: "Virtual KOL scientific follow-up",
    description: "Short virtual follow-up call requiring concise evidence exchange.",
    hcp_category: "KOL / Thought Leader",
    influence_driver: "Evidence-Based",
    difficulty: "advanced",
  },
  {
    title: "No-id custom generated scenario",
    description: "Generated scenario without canonical id should still be bounded and deterministic.",
    hcp_category: "Non-Prescribing Influencer",
    influence_driver: "Patient-Centered",
    difficulty: "beginner",
  },
]);

test("custom/generated scenarios preserve deterministic and bounded contracts", () => {
  for (const scenario of CUSTOM_SCENARIOS) {
    const taxonomyA = classifyScenarioTaxonomy(scenario);
    const taxonomyB = classifyScenarioTaxonomy(scenario);
    assert.deepEqual(taxonomyA, taxonomyB, "taxonomy classification should be deterministic");

    const envelope = deriveScenarioMetadataEnvelope(scenario, taxonomyA);
    assert.equal(validateScenarioMetadataEnvelope(envelope).valid, true, "metadata envelope must stay valid");

    const enriched = enrichScenarioWithTaxonomy(scenario);
    let state = deriveInitialState(enriched);
    let temperature = deriveInitialTemperature(state);
    let severity = 0;

    for (let i = 0; i < 8; i += 1) {
      const rep = `Turn ${i + 1}: Can we define one owner and one next step that fits workflow constraints?`;
      const hcpUtterance = `${enriched.title || "Custom"} ${enriched.description || ""}`;
      const alignmentA = computeAlignment(state, rep, { hcpUtterance }, temperature, state);
      const alignmentB = computeAlignment(state, rep, { hcpUtterance }, temperature, state);
      assert.equal(alignmentA.score, alignmentB.score, "alignment score should stay deterministic");
      assert.ok(alignmentA.score >= 1 && alignmentA.score <= 5, "alignment score should stay bounded");

      const nextState = transitionState(state, rep, temperature);
      const nextTemperature = transitionTemperature(temperature, rep);
      const nextSeverity = transitionSeverity(severity, alignmentA, state, nextState);
      assert.ok(nextSeverity >= 0 && nextSeverity <= 2, "severity should stay bounded");

      state = nextState;
      temperature = nextTemperature;
      severity = nextSeverity;
    }
  }
});
