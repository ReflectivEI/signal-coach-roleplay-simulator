import test from "node:test";
import assert from "node:assert/strict";

import { computeAlignment } from "../src/components/roleplay/alignmentEngine.jsx";
import {
  deriveInitialState,
  deriveInitialTemperature,
  transitionSeverity,
  transitionState,
  transitionTemperature,
} from "../src/components/roleplay/hcpSimulationEngine.jsx";
import { enrichScenarioWithTaxonomy, SCENARIO_TAXONOMY_OVERRIDES } from "../src/lib/roleplay-v2/scenarioTaxonomy.js";
import { validateScenarioMetadataEnvelope } from "../src/lib/roleplay-v2/scenarioMetadataEnvelope.js";
import { ALL_SCENARIOS as ALL_19_SCENARIOS } from "../src/lib/roleplay-v2/scenarioCatalog.js";

const MESSAGE_LIBRARY = Object.freeze([
  "Given your constraints, what single barrier would you solve first this week?",
  "Can we align on one measurable outcome for the next 30 days before we change process?",
  "Would a small pilot in one subset reduce risk while still proving value quickly?",
  "What concern is highest today: safety, access, workflow, or confidence in evidence?",
  "If we document owner and deadline, could this become a repeatable protocol for the team?",
  "Where are handoffs currently failing and what data would build confidence to adjust?",
  "If we keep the scope narrow now, can we revisit scale after one checkpoint review?",
  "Could we agree on one immediate next step and one follow-up milestone to de-risk execution?",
]);

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

test("enterprise randomized smoke: all 19 scenarios keep deterministic runtime contracts", () => {
  assert.equal(ALL_19_SCENARIOS.length, 19, "must smoke test all 19 simulator scenarios");
  assert.equal(Object.keys(SCENARIO_TAXONOMY_OVERRIDES).length, 19, "taxonomy override map should stay complete");

  const seeds = [7, 23, 97];
  for (const scenario of ALL_19_SCENARIOS) {
    const enriched = enrichScenarioWithTaxonomy(scenario);
    assert.ok(enriched.taxonomy?.journeyStage, `${scenario.id}: journey stage should be set`);
    assert.ok(enriched.taxonomy?.interactionPressure, `${scenario.id}: interaction pressure should be set`);
    const metadataValidation = validateScenarioMetadataEnvelope(enriched.metadataEnvelope);
    assert.equal(metadataValidation.valid, true, `${scenario.id}: metadata envelope should validate`);

    for (const seed of seeds) {
      const rand = mulberry32(seed);
      let state = deriveInitialState(enriched);
      let temperature = deriveInitialTemperature(state);
      let severity = 0;

      for (let turn = 0; turn < 14; turn += 1) {
        const msg = MESSAGE_LIBRARY[Math.floor(rand() * MESSAGE_LIBRARY.length)];
        const hcpUtterance = `${enriched.title}. ${enriched.description}. ${enriched.taxonomy.journeyStage}.`;

        const alignmentA = computeAlignment(state, msg, { hcpUtterance }, temperature, state);
        const alignmentB = computeAlignment(state, msg, { hcpUtterance }, temperature, state);
        assert.equal(alignmentA.score, alignmentB.score, `${scenario.id}/seed-${seed}/turn-${turn}: score deterministic`);
        assert.deepEqual(alignmentA.metrics, alignmentB.metrics, `${scenario.id}/seed-${seed}/turn-${turn}: metrics deterministic`);
        assert.ok(alignmentA.score >= 1 && alignmentA.score <= 5, `${scenario.id}/seed-${seed}/turn-${turn}: score in range`);

        const nextState = transitionState(state, msg, temperature);
        const nextTemp = transitionTemperature(temperature, msg);
        const nextSeverity = transitionSeverity(severity, alignmentA, state, nextState);
        assert.ok(nextSeverity >= 0 && nextSeverity <= 2, `${scenario.id}/seed-${seed}/turn-${turn}: severity in range`);

        state = nextState;
        temperature = nextTemp;
        severity = nextSeverity;
      }
    }
  }
});
