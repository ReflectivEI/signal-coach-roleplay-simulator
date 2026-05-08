#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { enrichScenarioWithTaxonomy } from '../src/lib/roleplay-v2/scenarioTaxonomy.js';

const [, , inputPathArg, outputPathArg] = process.argv;

if (!inputPathArg) {
  console.error('Usage: node scripts/backfill-roleplay-metadata-envelope.mjs <input.json> [output.json]');
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), inputPathArg);
const outputPath = outputPathArg
  ? path.resolve(process.cwd(), outputPathArg)
  : inputPath.replace(/\.json$/i, '.metadata-backfill.json');

const raw = fs.readFileSync(inputPath, 'utf8');
const parsed = JSON.parse(raw);
const scenarios = Array.isArray(parsed) ? parsed : parsed.scenarios;

if (!Array.isArray(scenarios)) {
  console.error('Input must be an array or an object with a "scenarios" array.');
  process.exit(1);
}

const enriched = scenarios.map((scenario) => {
  const withMetadata = enrichScenarioWithTaxonomy(scenario);
  return {
    ...scenario,
    metadataEnvelope: withMetadata.metadataEnvelope,
    metadataReviewStatus: 'requires_human_review',
  };
});

fs.writeFileSync(outputPath, `${JSON.stringify(enriched, null, 2)}\n`, 'utf8');
console.log(`Wrote ${enriched.length} scenarios with metadata envelopes to ${outputPath}`);
console.log('Next step: perform human review and set metadataReviewStatus to approved/rejected.');
