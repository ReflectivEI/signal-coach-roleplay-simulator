import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { evaluateOpeningBeatConsistency } from '../src/components/roleplay/openingBeatContract.js';

const fixtures = JSON.parse(fs.readFileSync(new URL('./fixtures/opening-beat-golden-fixtures.json', import.meta.url), 'utf8'));

test('golden fixtures preserve concern family and tone from opening scene to first HCP turn', () => {
  fixtures.forEach((fixture) => {
    const result = evaluateOpeningBeatConsistency(fixture);
    assert.equal(result.sceneConcern, fixture.expectedConcern, `${fixture.id}: opening concern mismatch`);
    assert.equal(result.turnConcern, fixture.expectedConcern, `${fixture.id}: first-turn concern mismatch`);
    assert.equal(result.sceneTone, fixture.expectedTone, `${fixture.id}: opening tone mismatch`);
    assert.equal(result.turnTone, fixture.expectedTone, `${fixture.id}: first-turn tone mismatch`);
    assert.equal(result.consistentConcernFamily, true, `${fixture.id}: concern family drift`);
    assert.equal(result.consistentTone, true, `${fixture.id}: tone drift`);
  });
});
