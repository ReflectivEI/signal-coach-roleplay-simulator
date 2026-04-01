import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveScenarioMetadataEnvelope,
  validateScenarioMetadataEnvelope,
} from '../src/lib/roleplay-v2/scenarioMetadataEnvelope.js';

import { classifyScenarioTaxonomy } from '../src/lib/roleplay-v2/scenarioTaxonomy.js';

test('authoritative id map produces stable metadata envelope for known scenario', () => {
  const scenario = {
    id: 'onc_md_io_adc_pathways',
    title: 'ADC Integration with IO Backbone',
    difficulty: 'advanced',
    context: 'P&T scrutiny and pathway constraints.',
  };

  const taxonomy = classifyScenarioTaxonomy(scenario);
  const envelope = deriveScenarioMetadataEnvelope(scenario, taxonomy);

  assert.equal(envelope.family, 'oncology_io');
  assert.equal(envelope.chapter_stage, 'clinical_value_detailing');
  assert.equal(envelope.persona_primary, 'skeptical_specialist');
  assert.equal(envelope.interaction_skill, 'formulary_procurement');
  assert.equal(envelope.difficulty_level, 'advanced');
  assert.equal(envelope.metadata_source, 'authoritative_id_map');
  assert.equal(validateScenarioMetadataEnvelope(envelope).valid, true);
});

test('embedded metadata envelope is preserved when valid', () => {
  const scenario = {
    id: 'custom_1',
    difficulty: 'intermediate',
    metadataEnvelope: {
      family: 'hiv_prep',
      chapter_stage: 'discovery_needs_assessment',
      persona_primary: 'busy_prescriber',
      interaction_skill: 'workflow_implementation',
      difficulty_level: 'intermediate',
      compliance_mode: 'access_discussion',
    },
  };

  const envelope = deriveScenarioMetadataEnvelope(scenario, {});
  assert.equal(envelope.metadata_source, 'scenario_embedded');
  assert.equal(validateScenarioMetadataEnvelope(envelope).valid, true);
});
