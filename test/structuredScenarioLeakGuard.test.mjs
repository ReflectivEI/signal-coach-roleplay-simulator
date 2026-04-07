import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectScenarioMetadataLeakAnchors,
  detectStructuredScenarioContentLeak,
} from '../src/lib/roleplay/structuredScenarioLeakGuard.js';

test('structured scenario leak guard detects objective persona and challenge metadata clusters', () => {
  const scenario = {
    stakeholder: 'David Park, PA-C - GU Oncology Practice',
    objective: 'Adopt T-7 onboarding with early hub enrollment, benefits check, and day-10 toxicity tele-visit',
    hcpMood: 'frustrated, process-focused',
    specialty: 'Medical Oncology',
    challenges: [
      'Fragmented onboarding process',
      'Late hub enrollment timing',
      'Day-25-30 refill gaps',
      'Inconsistent toxicity monitoring',
    ],
  };

  const result = detectStructuredScenarioContentLeak({
    scenario,
    dialogueText: "Start with one practical workflow step my team could actually use. There has to be a better way to handle this. ' Adopt T-7 onboarding with early hub enrollment, benefits check, and day-10 toxicity tele-visit frustrated, process-focused David Park, PA-C - GU Oncology Practice Medical Oncology Fragmented onboarding process Late hub enrollment timing Day-25-30 refill gaps Inconsistent toxicity monitoring.",
  });

  assert.equal(result.leaked, true);
  assert.ok(result.anchorHits.length >= 2);
  assert.equal(result.descriptorLeak, true);
});

test('structured scenario leak guard detects metadata leakage across a different scenario shape', () => {
  const scenario = {
    hcpName: 'Jennifer Nguyen, NP',
    tacticalFocus: 'Align candidacy screening with resistance review before long-acting injectable start',
    hcp_category: 'Advanced Practice Provider',
    disease_state: 'HIV Prevention',
    keyMessages: [
      'Confirm prior virologic failure history',
      'Review resistance data before initiation',
    ],
    suggestedPhrasing: [
      'Use a screening checkpoint before initiating cabotegravir.',
    ],
  };

  const result = detectStructuredScenarioContentLeak({
    scenario,
    dialogueText: 'Keep this to one screening point. Align candidacy screening with resistance review before long-acting injectable start Jennifer Nguyen, NP Advanced Practice Provider HIV Prevention Confirm prior virologic failure history Review resistance data before initiation.',
  });

  assert.equal(result.leaked, true);
  assert.ok(result.anchorHits.some((hit) => /candidacy screening/i.test(hit)));
});

test('structured scenario leak guard does not block natural clinician dialogue using scenario concepts', () => {
  const scenario = {
    stakeholder: 'David Park, PA-C - GU Oncology Practice',
    objective: 'Adopt T-7 onboarding with early hub enrollment, benefits check, and day-10 toxicity tele-visit',
    challenges: [
      'Fragmented onboarding process',
      'Late hub enrollment timing',
      'Day-25-30 refill gaps',
      'Inconsistent toxicity monitoring',
    ],
  };

  const result = detectStructuredScenarioContentLeak({
    scenario,
    dialogueText: 'The refill gap is the issue for me, so start with the one handoff your team would change first.',
  });

  assert.equal(result.leaked, false);
});

test('structured scenario leak guard collects internal metadata anchors without schema changes', () => {
  const anchors = collectScenarioMetadataLeakAnchors({
    objective: 'Reduce prior-auth delays with a one-step benefits verification handoff',
    challenges: ['Unclear owner for the first access step'],
  });

  assert.ok(anchors.some((anchor) => /benefits verification/i.test(anchor.raw)));
  assert.ok(anchors.some((anchor) => /unclear owner/i.test(anchor.raw)));
});
