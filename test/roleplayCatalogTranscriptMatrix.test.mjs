import test from 'node:test';
import assert from 'node:assert/strict';

import { ALL_SCENARIOS } from '../src/lib/roleplay-v2/scenarioCatalog.js';
import {
  buildLatestAskProgressionDialogue,
  classifyLatestAskProgression,
} from '../src/components/roleplay/latestAskProgression.js';

const FAMILY_FIXTURES = Object.freeze({
  screening: {
    latestHcpAsk: 'How would I identify the right patients and confirm screening requirements in a standard visit?',
    repTurns: [
      'Align on candidacy and monitoring criteria, then use a consistent screening checkpoint before starting therapy.',
      'Again, align on candidacy and monitoring criteria, then use a consistent screening checkpoint before starting therapy.',
    ],
    expectedStatuses: ['screening_progress', 'repeated_screening_progress'],
    expectedFinal: /screening framework.*checkpoint/i,
  },
  evidence: {
    latestHcpAsk: 'What evidence would justify changing practice for the patients I am seeing?',
    repTurns: [
      'The clinical data show a meaningful outcome improvement in the relevant patient group, so the decision is whether to prioritize those patients first.',
      'Again, the clinical data show a meaningful outcome improvement in the relevant patient group, so the decision is whether to prioritize those patients first.',
    ],
    expectedStatuses: ['evidence_progress', 'repeated_evidence_progress'],
    expectedFinal: /evidence point.*practice/i,
  },
  access: {
    latestHcpAsk: 'How would this reduce access, coverage, or prior-auth burden for my team this week?',
    repTurns: [
      'Start the benefits investigation earlier and route prior-auth templates through the hub before the bottleneck appears.',
      'Again, start the benefits investigation earlier and route prior-auth templates through the hub before the bottleneck appears.',
    ],
    expectedStatuses: ['access_progress', 'repeated_access_progress'],
    expectedFinal: /access step.*reduce rework/i,
  },
  workflow: {
    latestHcpAsk: 'What is the smallest workflow change you would recommend first, and who would own it?',
    repTurns: [
      'Standardize patient education and add toxicity monitoring to the pathway checklist.',
      'Again, standardize patient education and add toxicity monitoring to the pathway checklist.',
    ],
    expectedStatuses: ['missing_owner', 'repeated_missing_owner'],
    expectedFinal: /process change.*ownership|missing piece is ownership/i,
  },
});

function scenarioFamily(scenario = {}) {
  const text = [
    scenario.id,
    scenario.title,
    scenario.context,
    scenario.description,
    ...(Array.isArray(scenario.challenges) ? scenario.challenges : []),
  ].join(' ').toLowerCase();

  if (/cabotegravir|screening|candidacy|candidate|resistance|adherence|diagnostic|diagnosis|patient selection|rare/.test(text)) return 'screening';
  if (/payer|prior[-\s]?auth|authorization|coverage|reimbursement|copay|hub|enrollment|access|formulary|step-therapy/.test(text)) return 'access';
  if (/evidence|data|study|trial|published|p&t|committee|cost-conscious|pharmacoeconomic|kol|peer-reviewed|skeptic/.test(text)) return 'evidence';
  return 'workflow';
}

function replayFixture(fixture) {
  const previousRepMessages = [];
  const statuses = [];
  const dialogues = [];

  for (const repMessage of fixture.repTurns) {
    const progression = classifyLatestAskProgression({
      latestHcpAsk: fixture.latestHcpAsk,
      repMessage,
      previousRepMessages,
    });
    const dialogue = buildLatestAskProgressionDialogue(progression);
    statuses.push(progression.status);
    dialogues.push(dialogue);
    previousRepMessages.push(repMessage);
  }

  return { statuses, dialogues };
}

test('catalog transcript matrix: all active scenarios map to a latest-ask progression family', () => {
  assert.equal(ALL_SCENARIOS.length, 19, 'catalog replay should cover all current roleplay scenarios');

  const coverage = new Map();
  for (const scenario of ALL_SCENARIOS) {
    const family = scenarioFamily(scenario);
    coverage.set(family, (coverage.get(family) || 0) + 1);
    const fixture = FAMILY_FIXTURES[family];
    const replay = replayFixture(fixture);

    assert.deepEqual(replay.statuses, fixture.expectedStatuses, `${scenario.id}: ${family} statuses should progress from partial answer to repeated-answer handling`);
    assert.match(replay.dialogues.at(-1), fixture.expectedFinal, `${scenario.id}: ${family} final line should advance to the remaining gap`);
    for (const dialogue of replay.dialogues) {
      assert.ok(dialogue, `${scenario.id}: ${family} should produce HCP dialogue`);
      assert.ok((dialogue.match(/\?/g) || []).length <= 1, `${scenario.id}: ${family} should ask at most one question: ${dialogue}`);
      assert.doesNotMatch(dialogue, /I'm not hearing|give me one practical step|before we move forward|current scenario|workflow decisions|what my team can operationalize/i, `${scenario.id}: ${family} should not use generic loop/rubric language: ${dialogue}`);
    }
  }

  for (const family of Object.keys(FAMILY_FIXTURES)) {
    assert.ok(coverage.get(family) > 0, `catalog should include at least one ${family} scenario`);
  }
});

