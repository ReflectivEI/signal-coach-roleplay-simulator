import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLatestAskProgressionDialogue,
  classifyLatestAskProgression,
} from '../src/components/roleplay/latestAskProgression.js';

const TRANSCRIPT_CASES = [
  {
    name: 'workflow step without owner progresses to ownership gap',
    latestHcpAsk: 'I need this grounded in our actual workflow. Start with the first step and who would own it.',
    repTurns: [
      'Of course. To start, standardize NP-led education and toxicity call-tree. Add AE one-pager to pathway handouts.',
      'You just asked me that. I said - Of course. To start, standardize NP-led education and toxicity call-tree. Add AE one-pager to pathway handouts.',
    ],
    expectedStatuses: ['owner_progress', 'repeated_owner_progress'],
    expectedFinal: /I heard the owner and the action\. What is the first handoff/i,
  },
  {
    name: 'vague owner is partial progress but not accepted as complete',
    latestHcpAsk: 'Start with the first step and who would own it.',
    repTurns: [
      'Standardize patient education and implement toxicity monitoring. Someone on your staff would own it but I would support them.',
    ],
    expectedStatuses: ['vague_owner_progress'],
    expectedFinal: /owner is still too vague\. Which role owns the first step/i,
  },
  {
    name: 'ownership deflection produces realistic role request instead of loop',
    latestHcpAsk: 'Who on my team would own the first step?',
    repTurns: [
      "I can't tell you who on your staff would own it. I would support them but that's your decision.",
    ],
    expectedStatuses: ['ownership_deflected'],
    expectedFinal: /you may not know my staffing model.*role you usually see owning/i,
  },
  {
    name: 'explicit owner advances to handoff instead of repeating ask',
    latestHcpAsk: 'Start with the first step and who would own it.',
    repTurns: [
      'Have the NP lead patient education and use the toxicity call-tree during the first follow-up.',
    ],
    expectedStatuses: ['owner_progress'],
    expectedFinal: /first handoff they would run this week/i,
  },
  {
    name: 'latest workflow step ask recognizes a concrete process change',
    latestHcpAsk: 'What is the smallest workflow change you would recommend first?',
    repTurns: [
      'Standardize patient education and add toxicity monitoring to the pathway checklist.',
      'Again, standardize patient education and add toxicity monitoring to the pathway checklist.',
    ],
    expectedStatuses: ['workflow_progress', 'repeated_workflow_progress'],
    expectedFinal: /I heard that workflow step.*who starts it, and when/i,
  },
];

const DISALLOWED_LOOP_PHRASES = /I'm not hearing the workflow piece yet|Start with one practical workflow step my team could actually use|If this is actionable, make it concrete: what is the first step my staff would own|I hear you, but with our staffing, give me one practical step/i;

function replayCase(fixture) {
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

test('transcript replay harness: latest ask progression prevents workflow loops', () => {
  for (const fixture of TRANSCRIPT_CASES) {
    const replay = replayCase(fixture);
    assert.deepEqual(replay.statuses, fixture.expectedStatuses, `${fixture.name}: statuses should classify latest-ask progress`);
    assert.match(replay.dialogues.at(-1), fixture.expectedFinal, `${fixture.name}: final HCP dialogue should progress to the remaining gap`);

    for (const dialogue of replay.dialogues) {
      assert.ok(dialogue, `${fixture.name}: progression gate should produce dialogue`);
      assert.doesNotMatch(dialogue, DISALLOWED_LOOP_PHRASES, `${fixture.name}: should not reuse generic workflow loop language`);
      assert.ok((dialogue.match(/\?/g) || []).length <= 1, `${fixture.name}: should ask at most one question: ${dialogue}`);
    }
  }
});
