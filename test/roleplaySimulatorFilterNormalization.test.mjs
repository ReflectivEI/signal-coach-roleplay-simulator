import test from 'node:test';
import assert from 'node:assert/strict';

import { ALL_SCENARIOS } from '../src/lib/roleplay-v2/scenarioCatalog.js';
import { enrichScenarioWithTaxonomy } from '../src/lib/roleplay-v2/scenarioTaxonomy.js';
import { normalizeScenarioDropdownControls } from '../src/lib/roleplay-v2/scenarioControlNormalization.js';

function buildScenarioCatalogWithNormalizedControls() {
  return ALL_SCENARIOS.map((scenario) => {
    const enriched = enrichScenarioWithTaxonomy(scenario);
    const normalizedControls = normalizeScenarioDropdownControls(enriched, enriched.taxonomy);
    return {
      ...enriched,
      normalizedControls,
    };
  });
}

function filterScenarios(scenarios, filters) {
  const {
    diseaseStateFilter = 'All Disease States',
    specialtyFilter = 'All Specialties',
    hcpCategoryFilter = 'All HCP Types',
    influenceDriverFilter = 'All Influence Drivers',
    journeyStageFilter = 'All Journey Stages',
    interactionPressureFilter = 'All Interaction Pressures',
  } = filters;

  return scenarios.filter((scenario) => {
    const controls = scenario.normalizedControls || {};
    const dsMatch = diseaseStateFilter === 'All Disease States' || controls.diseaseState === diseaseStateFilter;
    const specMatch = specialtyFilter === 'All Specialties' || controls.specialty === specialtyFilter;
    const hcpMatch = hcpCategoryFilter === 'All HCP Types' || controls.hcpCategory === hcpCategoryFilter;
    const infMatch = influenceDriverFilter === 'All Influence Drivers' || controls.influenceDriver === influenceDriverFilter;
    const stageMatch = journeyStageFilter === 'All Journey Stages' || controls.journeyStage === journeyStageFilter;
    const pressureMatch = interactionPressureFilter === 'All Interaction Pressures' || controls.interactionPressure === interactionPressureFilter;
    return dsMatch && specMatch && hcpMatch && infMatch && stageMatch && pressureMatch;
  });
}

test('simulator catalog attaches canonical normalized controls deterministically for all scenarios', () => {
  const first = buildScenarioCatalogWithNormalizedControls();
  const second = buildScenarioCatalogWithNormalizedControls();

  assert.equal(first.length, ALL_SCENARIOS.length);
  assert.equal(second.length, ALL_SCENARIOS.length);

  first.forEach((scenario, index) => {
    const controls = scenario.normalizedControls;
    const controlsAgain = second[index].normalizedControls;
    assert.ok(controls);
    assert.deepEqual(controls, controlsAgain);
    assert.equal(typeof controls.diseaseState, 'string');
    assert.equal(typeof controls.specialty, 'string');
    assert.equal(typeof controls.hcpCategory, 'string');
    assert.equal(typeof controls.influenceDriver, 'string');
    assert.equal(typeof controls.journeyStage, 'string');
    assert.equal(typeof controls.interactionPressure, 'string');
  });
});

test('journeyStage and interactionPressure follow taxonomy override/inference through normalized controls', () => {
  const catalog = buildScenarioCatalogWithNormalizedControls();

  for (const scenario of catalog) {
    assert.equal(scenario.normalizedControls.journeyStage, scenario.taxonomy.journeyStage);
    assert.equal(scenario.normalizedControls.interactionPressure, scenario.taxonomy.interactionPressure);
  }
});

test('valid in-catalog filter queries return stable results via normalized control path', () => {
  const catalog = buildScenarioCatalogWithNormalizedControls();
  const oncologySet = filterScenarios(catalog, {
    diseaseStateFilter: 'Oncology',
    specialtyFilter: 'Medical Oncology',
  });

  assert.ok(oncologySet.length > 0);
  oncologySet.forEach((scenario) => {
    assert.equal(scenario.normalizedControls.diseaseState, 'Oncology');
    assert.equal(scenario.normalizedControls.specialty, 'Medical Oncology');
  });

  const stagePressureSet = filterScenarios(catalog, {
    journeyStageFilter: 'adoption_implementation',
    interactionPressureFilter: 'operationally_blocked',
  });

  assert.ok(stagePressureSet.length > 0);
  stagePressureSet.forEach((scenario) => {
    assert.equal(scenario.normalizedControls.journeyStage, 'adoption_implementation');
    assert.equal(scenario.normalizedControls.interactionPressure, 'operationally_blocked');
  });
});

test('fallback/default normalization path stays stable for malformed source values', () => {
  const malformed = {
    id: 'malformed_runtime_filter',
    category: 'Unknown Area',
    specialty: 'Unknown Specialty',
    hcp_category: 'Unknown HCP',
    influence_driver: 'Unknown Driver',
    context: 'No recognizable deterministic cues.',
    objective: 'Have a conversation.',
  };

  const enriched = enrichScenarioWithTaxonomy(malformed);
  const normalizedControls = normalizeScenarioDropdownControls(enriched, enriched.taxonomy);

  assert.equal(normalizedControls.diseaseState, 'All Disease States');
  assert.equal(normalizedControls.specialty, 'All Specialties');
  assert.equal(normalizedControls.hcpCategory, 'All HCP Types');
  assert.equal(normalizedControls.influenceDriver, 'All Influence Drivers');
  assert.equal(typeof normalizedControls.journeyStage, 'string');
  assert.equal(typeof normalizedControls.interactionPressure, 'string');

  const matches = filterScenarios([{ ...enriched, normalizedControls }], {
    diseaseStateFilter: 'All Disease States',
    specialtyFilter: 'All Specialties',
    hcpCategoryFilter: 'All HCP Types',
    influenceDriverFilter: 'All Influence Drivers',
    journeyStageFilter: 'All Journey Stages',
    interactionPressureFilter: 'All Interaction Pressures',
  });

  assert.equal(matches.length, 1);
});
