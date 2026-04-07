import test from 'node:test';
import assert from 'node:assert/strict';

import { validateRoleplayRepTurn } from '../src/lib/roleplay/roleplayTurnValidation.js';

test('shared roleplay turn validation blocks repeated non-responsive latest-ask turns before generation', () => {
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: "We're drowning in prior-auth paperwork. Can you help with that?",
    repMessage: "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.",
    previousRepMessages: [
      "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.",
    ],
  });

  assert.equal(validation.valid, false);
  assert.equal(validation.invalid, true);
  assert.equal(validation.blockHcpGeneration, true);
  assert.equal(validation.blockScoring, true);
  assert.equal(validation.blockStateAdvance, true);
  assert.equal(validation.latestAskProgression.status, 'repeated_missed');
  assert.equal(validation.latestAskProgression.family, 'workflow');
  assert.equal(validation.coaching.escalationLabel, 'Turn blocked');
  assert.match(validation.coaching.suggestion, /workflow step/i);
  assert.deepEqual(
    validation.telemetryEvents.map((event) => event.eventType),
    ['invalid_turn_blocked', 'repeated_non_answer_blocked', 'latest_ask_ignored'],
  );
  assert.equal(validation.telemetryEvents[0].payload.blockHcpGeneration, true);
  assert.match(validation.telemetryEvents[0].payload.repMessageFingerprint, /^fnv1a_[a-f0-9]{8}$/);
  assert.doesNotMatch(JSON.stringify(validation.telemetryEvents), /high risk patients/i);
});

test('shared roleplay turn validation allows concrete progress through the same interface', () => {
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: "We're drowning in prior-auth paperwork. Can you help with that?",
    repMessage: 'Start benefits verification before the refill window, with the care coordinator owning the checklist.',
    previousRepMessages: [
      "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.",
    ],
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.invalid, false);
  assert.equal(validation.blockHcpGeneration, false);
  assert.equal(validation.blockScoring, false);
  assert.equal(validation.blockStateAdvance, false);
  assert.equal(validation.coaching, null);
  assert.deepEqual(validation.telemetryEvents.map((event) => event.eventType), ['valid_turn_progressed']);
  assert.equal(validation.telemetryEvents[0].payload.blockHcpGeneration, false);
});

test('shared roleplay turn validation emits latest-ask ignored telemetry before repeated blocking', () => {
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'What is the first workflow step my team would own?',
    repMessage: 'The outcomes data are strong.',
    previousRepMessages: [],
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.latestAskProgression.status, 'missed');
  assert.deepEqual(validation.telemetryEvents.map((event) => event.eventType), ['latest_ask_ignored']);
  assert.equal(validation.telemetryEvents[0].payload.blockHcpGeneration, false);
  assert.deepEqual(validation.telemetryEvents[0].payload.reasonCodes, ['latest_ask_ignored']);
});

test('shared roleplay turn validation allows valid paraphrases that answer the latest ask', () => {
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'Can you give me one workflow step that would reduce the PA burden?',
    repMessage: 'We could pilot an earlier benefits-verification checklist so the coordinator starts the PA before the refill window.',
    previousRepMessages: [
      'One option is to move benefits verification earlier in the refill process.',
    ],
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.latestAskProgression.status, 'workflow_progress');
});

test('shared roleplay turn validation allows concise but correct answers', () => {
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'What is the first access step that reduces the bottleneck?',
    repMessage: 'Start benefits verification now.',
    previousRepMessages: [],
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.latestAskProgression.status, 'access_progress');
});

test('shared roleplay turn validation does not block repeated wording when meaningful owner content is added', () => {
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'Who on my team owns the first workflow step this week?',
    repMessage: 'Standardize patient education and toxicity monitoring, with the NP owning the first handoff.',
    previousRepMessages: [
      'Standardize patient education and toxicity monitoring.',
    ],
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.latestAskProgression.status, 'owner_progress');
});

test('shared roleplay turn validation blocks unmet coaching requirements before progression', () => {
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'What is the first workflow step your recommendation changes this week?',
    repMessage: 'The outcomes data are strong.',
    previousRepMessages: [],
    coachingRequirement: { behavior: 'answer_concretely', target: 'latest_hcp_question' },
    coachingRequirementMet: false,
  });

  assert.equal(validation.valid, false);
  assert.equal(validation.blockHcpGeneration, true);
  assert.ok(validation.telemetryEvents.some((event) => event.eventType === 'coaching_requirement_not_met'));
});

test('shared roleplay turn validation allows indirectly satisfied coaching requirements', () => {
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'How would this fit our staffing constraints?',
    repMessage: 'If I understand the constraint, you need this to run without adding staff, so I would start with a nurse-owned checklist in the existing follow-up call.',
    previousRepMessages: [],
    coachingRequirement: { behavior: 'reflect', target: 'latest_hcp_constraint' },
    coachingRequirementMet: true,
  });

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.telemetryEvents.map((event) => event.eventType), ['valid_turn_progressed']);
});

test('shared roleplay turn validation gates only the latest HCP ask, not an older ask', () => {
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'What evidence point would change your decision for these patients?',
    repMessage: 'The study showed fewer refill gaps in patients like this, so I would use that outcome to support changing the pathway.',
    previousRepMessages: [
      'We could pilot an earlier benefits-verification checklist so the coordinator starts the PA before the refill window.',
    ],
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.latestAskProgression.status, 'evidence_progress');
});

test('shared roleplay turn validation blocks repeated generic opener against evidence practice-change ask', () => {
  const repeatedOpener = "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.";
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'I heard the evidence point. Now tie it to the decision in front of me: what should change in practice?',
    repMessage: repeatedOpener,
    previousRepMessages: [repeatedOpener, repeatedOpener, repeatedOpener],
  });

  assert.equal(validation.valid, false);
  assert.equal(validation.invalid, true);
  assert.equal(validation.blockHcpGeneration, true);
  assert.equal(validation.latestAskProgression.status, 'repeated_missed_close');
  assert.equal(validation.latestAskProgression.family, 'evidence');
  assert.deepEqual(
    validation.telemetryEvents.map((event) => event.eventType),
    ['invalid_turn_blocked', 'repeated_non_answer_blocked', 'latest_ask_ignored'],
  );
});
