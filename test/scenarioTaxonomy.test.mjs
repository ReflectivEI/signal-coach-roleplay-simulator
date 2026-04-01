import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyScenarioTaxonomy, enrichScenarioWithTaxonomy } from '../src/lib/roleplay-v2/scenarioTaxonomy.js';

test('classifyScenarioTaxonomy maps workflow + staffing scenarios to adoption/operational pressure', () => {
  const taxonomy = classifyScenarioTaxonomy({
    title: 'Pathway-Driven Care with Staffing Constraints',
    context: 'Short-staffed clinic with workflow burden and pathway documentation friction.',
    objective: 'Implement standing protocol and onboarding checklist.',
    hcp_category: 'Prescriber / Treater',
    specialty: 'Infectious Diseases',
    difficulty: 'advanced',
  });

  assert.equal(taxonomy.journeyStage, 'adoption_implementation');
  assert.equal(taxonomy.interactionPressure, 'operationally_blocked');
});

test('enrichScenarioWithTaxonomy preserves existing scenario fields', () => {
  const scenario = { id: 's1', title: 'Clinical value review', difficulty: 'intermediate' };
  const enriched = enrichScenarioWithTaxonomy(scenario);

  assert.equal(enriched.id, 's1');
  assert.ok(enriched.taxonomy?.journeyStage);
  assert.ok(enriched.metadataEnvelope?.family);
  assert.ok(enriched.metadataEnvelope?.chapter_stage);
});
