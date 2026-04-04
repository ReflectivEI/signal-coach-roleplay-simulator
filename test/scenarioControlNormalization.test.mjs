import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SIX_DROPDOWN_CONTROLS,
  normalizeScenarioDropdownControls,
  inferJourneyAndPressureFromSignals,
  deriveScenarioFamily,
  INTERACTION_SKILL_BY_PRESSURE,
} from '../src/lib/roleplay-v2/scenarioControlNormalization.js';
import { classifyScenarioTaxonomy } from '../src/lib/roleplay-v2/scenarioTaxonomy.js';
import { deriveScenarioMetadataEnvelope } from '../src/lib/roleplay-v2/scenarioMetadataEnvelope.js';

test('canonical 6-dropdown normalization is deterministic and complete', () => {
  const scenario = {
    id: 'custom_det_1',
    category: 'Oncology',
    specialty: 'Medical Oncology',
    hcp_category: 'Prescriber / Treater',
    influence_driver: 'Evidence-Based',
    context: 'Time pressure with workflow burden, staffing strain, and prior-auth barriers.',
    objective: 'Give one practical next step with supporting evidence this week.',
  };

  const taxonomy = classifyScenarioTaxonomy(scenario);
  const first = normalizeScenarioDropdownControls(scenario, taxonomy);
  const second = normalizeScenarioDropdownControls(scenario, taxonomy);

  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys(first).slice(0, 6), SIX_DROPDOWN_CONTROLS);
});

test('equivalent semantics across scenario families normalize to same journey/pressure and runtime skill mapping', () => {
  const base = {
    specialty: 'Internal Medicine',
    hcp_category: 'Prescriber / Treater',
    influence_driver: 'Patient-Centered',
    context: 'Clinic is short-staffed with workflow burden and prior-auth delays.',
    objective: 'Align one practical next step this week.',
  };
  const hiv = { ...base, id: 'hiv_equiv', category: 'HIV / PrEP' };
  const cardio = { ...base, id: 'cardio_equiv', category: 'Cardiology' };

  const hivTaxonomy = classifyScenarioTaxonomy(hiv);
  const cardioTaxonomy = classifyScenarioTaxonomy(cardio);

  assert.equal(hivTaxonomy.interactionPressure, cardioTaxonomy.interactionPressure);
  assert.equal(hivTaxonomy.journeyStage, cardioTaxonomy.journeyStage);

  const hivEnvelope = deriveScenarioMetadataEnvelope(hiv, hivTaxonomy);
  const cardioEnvelope = deriveScenarioMetadataEnvelope(cardio, cardioTaxonomy);

  assert.equal(hivEnvelope.interaction_skill, cardioEnvelope.interaction_skill);
  assert.equal(hivEnvelope.interaction_skill, INTERACTION_SKILL_BY_PRESSURE[hivTaxonomy.interactionPressure]);
});

test('family-specific distinctions remain intentional after normalization', () => {
  assert.equal(deriveScenarioFamily({ category: 'HIV / PrEP' }), 'hiv_prep');
  assert.equal(deriveScenarioFamily({ category: 'Oncology' }), 'oncology_io');
  assert.notEqual(
    deriveScenarioFamily({ category: 'HIV / PrEP' }),
    deriveScenarioFamily({ category: 'Oncology' }),
  );
});

test('equivalent realism pressure cues yield consistent normalization across families', () => {
  const oncologySignals = inferJourneyAndPressureFromSignals({
    category: 'Oncology',
    context: 'We have limited time, need stronger evidence, and staffing/workflow constraints.',
    objective: 'What is the first step this week?',
  });
  const vaccinesSignals = inferJourneyAndPressureFromSignals({
    category: 'Vaccines',
    context: 'We have limited time, need stronger evidence, and staffing/workflow constraints.',
    objective: 'What is the first step this week?',
  });

  assert.equal(oncologySignals.journeyStage, vaccinesSignals.journeyStage);
  assert.equal(oncologySignals.interactionPressure, vaccinesSignals.interactionPressure);
});
