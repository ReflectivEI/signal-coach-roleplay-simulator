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

const MULTITURN_FAMILY_FIXTURES = Object.freeze({
  screening: {
    latestHcpAsk: 'How would I identify the right patients and confirm screening requirements in a standard visit?',
    turns: [
      { rep: 'Yes, let us discuss that.', expectedStatus: 'missed', expectedDialogue: /^$/ },
      { rep: 'Align on candidacy and monitoring criteria before starting therapy.', expectedStatus: 'screening_progress', expectedDialogue: /right screening focus.*checkpoint/i },
      { rep: 'Again, align on candidacy and monitoring criteria before starting therapy.', expectedStatus: 'repeated_screening_progress', expectedDialogue: /heard the screening framework.*checkpoint/i },
    ],
  },
  evidence: {
    latestHcpAsk: 'What evidence would justify changing practice for the patients I am seeing?',
    turns: [
      { rep: 'This matters broadly.', expectedStatus: 'missed', expectedDialogue: /^$/ },
      { rep: 'The study data show a meaningful outcome improvement for patients like yours.', expectedStatus: 'evidence_progress', expectedDialogue: /evidence is relevant.*decision/i },
      { rep: 'Again, the study data show a meaningful outcome improvement for patients like yours.', expectedStatus: 'repeated_evidence_progress', expectedDialogue: /heard the evidence point.*practice/i },
    ],
  },
  access: {
    latestHcpAsk: 'How would this reduce access, coverage, or prior-auth burden for my team this week?',
    turns: [
      { rep: 'We can follow up later.', expectedStatus: 'missed', expectedDialogue: /^$/ },
      { rep: 'Start benefits investigation earlier and route prior-auth templates through the hub.', expectedStatus: 'access_progress', expectedDialogue: /access step is relevant.*bottleneck/i },
      { rep: 'Again, start benefits investigation earlier and route prior-auth templates through the hub.', expectedStatus: 'repeated_access_progress', expectedDialogue: /heard the access step.*reduce rework/i },
    ],
  },
  workflow: {
    latestHcpAsk: 'What is the smallest workflow change you would recommend first, and who would own it?',
    turns: [
      { rep: 'We should discuss workflow.', expectedStatus: 'missed', expectedDialogue: /^$/ },
      { rep: 'Standardize patient education and add toxicity monitoring to the pathway checklist.', expectedStatus: 'missing_owner', expectedDialogue: /closer.*who owns/i },
      { rep: 'Again, standardize patient education and add toxicity monitoring to the pathway checklist.', expectedStatus: 'repeated_missing_owner', expectedDialogue: /heard the process change.*ownership/i },
      { rep: 'The NP should lead education and own the toxicity monitoring checklist at first follow-up.', expectedStatus: 'owner_progress', expectedDialogue: /more useful.*first handoff/i },
    ],
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

test('catalog transcript matrix: every scenario family progresses through miss, partial answer, repeat, and recovery paths', () => {
  const familiesSeen = new Set(ALL_SCENARIOS.map((scenario) => scenarioFamily(scenario)));
  for (const family of familiesSeen) {
    const fixture = MULTITURN_FAMILY_FIXTURES[family];
    assert.ok(fixture, `${family}: should have a multi-turn fixture`);

    const previousRepMessages = [];
    const seenDialogues = [];
    for (const [index, step] of fixture.turns.entries()) {
      const progression = classifyLatestAskProgression({
        latestHcpAsk: fixture.latestHcpAsk,
        repMessage: step.rep,
        previousRepMessages,
      });
      const dialogue = buildLatestAskProgressionDialogue(progression);

      assert.equal(progression.status, step.expectedStatus, `${family}/turn-${index + 1}: progression status should match`);
      assert.match(dialogue, step.expectedDialogue, `${family}/turn-${index + 1}: dialogue should match progression status`);
      assert.ok((dialogue.match(/\?/g) || []).length <= 1, `${family}/turn-${index + 1}: HCP should ask at most one question: ${dialogue}`);
      assert.doesNotMatch(dialogue, /current scenario|workflow decisions|what my team can operationalize|before we move forward/i, `${family}/turn-${index + 1}: should not leak rubric language: ${dialogue}`);

      if (dialogue) {
        const normalized = dialogue.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        assert.ok(!seenDialogues.includes(normalized), `${family}/turn-${index + 1}: should not repeat identical HCP dialogue`);
        seenDialogues.push(normalized);
      }
      previousRepMessages.push(step.rep);
    }
  }
});
