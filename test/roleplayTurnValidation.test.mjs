import test from 'node:test';
import assert from 'node:assert/strict';

import { validateRoleplayRepTurn } from '../src/lib/roleplay/roleplayTurnValidation.js';

test('shared roleplay turn validation blocks repeated non-responsive latest-ask turns before generation', () => {
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: "We're drowning in prior-auth paperwork. Can you help with that?",
    repMessage: "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.",
    previousRepMessages: [
      "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.",
      "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.",
      "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.",
    ],
  });

  assert.equal(validation.valid, false);
  assert.equal(validation.invalid, true);
  assert.equal(validation.softInvalid, false);
  assert.equal(validation.hardInvalid, true);
  assert.equal(validation.blockHcpGeneration, true);
  assert.equal(validation.blockScoring, true);
  assert.equal(validation.blockStateAdvance, true);
  assert.equal(validation.latestAskProgression.status, 'repeated_missed_close');
  assert.equal(validation.latestAskProgression.family, 'workflow');
  assert.equal(validation.coaching.escalationLabel, 'Turn blocked');
  assert.match(validation.coaching.suggestion, /what they just asked/i);
  assert.deepEqual(
    validation.telemetryEvents.map((event) => event.eventType),
    ['invalid_turn_blocked', 'repeated_non_answer_blocked', 'latest_ask_ignored', 'non_adaptive_repetition_detected'],
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
  assert.equal(validation.softInvalid, false);
  assert.equal(validation.hardInvalid, false);
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
  assert.equal(validation.softInvalid, true);
  assert.equal(validation.hardInvalid, false);
  assert.equal(validation.latestAskProgression.status, 'missed');
  assert.deepEqual(validation.telemetryEvents.map((event) => event.eventType), ['soft_invalid_turn_allowed', 'latest_ask_ignored']);
  assert.equal(validation.telemetryEvents[0].payload.blockHcpGeneration, false);
  assert.equal(validation.telemetryEvents[0].payload.softInvalid, true);
  assert.equal(validation.telemetryEvents[0].payload.hardInvalid, false);
  assert.deepEqual(validation.telemetryEvents[0].payload.reasonCodes, ['soft_invalid_turn_allowed', 'latest_ask_ignored']);
});

test('shared roleplay turn validation marks coherent early misses as soft invalid without blocking generation', () => {
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'What proof point changes the decision for stable HIV patients?',
    repMessage: "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.",
    previousRepMessages: [],
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.invalid, false);
  assert.equal(validation.softInvalid, true);
  assert.equal(validation.hardInvalid, false);
  assert.equal(validation.blockHcpGeneration, false);
  assert.equal(validation.blockScoring, false);
  assert.equal(validation.blockStateAdvance, false);
  assert.equal(validation.latestAskProgression.status, 'missed');
  assert.ok(validation.telemetryEvents[0].payload.reasonCodes.includes('soft_invalid_turn_allowed'));
  assert.ok(validation.telemetryEvents[0].payload.reasonCodes.includes('latest_ask_ignored'));
});

test('shared roleplay turn validation detects first non-adaptive repeat without blocking generation', () => {
  const repeatedOpener = "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.";
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'What is the first practical workflow step here?',
    repMessage: repeatedOpener,
    previousRepMessages: [],
    allPreviousRepMessages: [repeatedOpener],
    previousHcpAsks: ['What proof point changes the decision for stable HIV patients?'],
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.softInvalid, true);
  assert.equal(validation.hardInvalid, false);
  assert.equal(validation.blockHcpGeneration, false);
  assert.equal(validation.nonAdaptiveRepetition.detected, true);
  assert.equal(validation.nonAdaptiveRepetition.repeatCount, 1);
  assert.equal(validation.nonAdaptiveRepetition.stage, 'soft_coach');
  assert.equal(validation.coaching.escalationLabel, 'Adaptation note');
  assert.match(validation.coaching.suggestion, /what they just asked/i);
  assert.ok(validation.telemetryEvents.some((event) => event.eventType === 'non_adaptive_repetition_detected'));
});

test('shared roleplay turn validation escalates second non-adaptive repeat coaching without blocking', () => {
  const repeatedOpener = "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.";
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'What is the first practical workflow step here?',
    repMessage: repeatedOpener,
    previousRepMessages: [],
    allPreviousRepMessages: [repeatedOpener, repeatedOpener],
    previousHcpAsks: [
      'What proof point changes the decision for stable HIV patients?',
      'What would my team do differently first?',
    ],
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.softInvalid, true);
  assert.equal(validation.hardInvalid, false);
  assert.equal(validation.nonAdaptiveRepetition.repeatCount, 2);
  assert.equal(validation.nonAdaptiveRepetition.stage, 'escalated_soft_coach');
  assert.equal(validation.coaching.severity, 'medium');
});

test('shared roleplay turn validation hard-blocks third non-adaptive repeat', () => {
  const repeatedOpener = "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.";
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'What is the first practical workflow step here?',
    repMessage: repeatedOpener,
    previousRepMessages: [],
    allPreviousRepMessages: [repeatedOpener, repeatedOpener, repeatedOpener],
    previousHcpAsks: [
      'What proof point changes the decision for stable HIV patients?',
      'What would my team do differently first?',
      'What is one concrete step my team can run?',
    ],
  });

  assert.equal(validation.valid, false);
  assert.equal(validation.softInvalid, false);
  assert.equal(validation.hardInvalid, true);
  assert.equal(validation.blockHcpGeneration, true);
  assert.equal(validation.nonAdaptiveRepetition.detected, true);
  assert.equal(validation.nonAdaptiveRepetition.repeatCount, 3);
  assert.equal(validation.nonAdaptiveRepetition.stage, 'hard_block');
  assert.equal(validation.coaching.escalationLabel, 'Turn blocked');
  assert.ok(validation.telemetryEvents.some((event) => event.eventType === 'non_adaptive_repetition_detected'));
});

test('shared roleplay turn validation does not treat legitimate paraphrasing as non-adaptive repetition', () => {
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'What is the first practical workflow step here?',
    repMessage: 'To build on that, start a nurse-owned workflow checklist this week so the team knows the first handoff.',
    previousRepMessages: [],
    allPreviousRepMessages: ['Start a workflow checklist this week.'],
    previousHcpAsks: ['What is the first practical workflow step here?'],
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.hardInvalid, false);
  assert.equal(validation.nonAdaptiveRepetition.detected, false);
});

test('shared roleplay turn validation flags bullet-style rep notes as non-conversational soft invalid', () => {
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'How does this apply to long-term durability for stable HIV patients?',
    repMessage: '- Durability and convenience benefits\n- Stable suppressed patients\n- Quarterly review',
    previousRepMessages: [],
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.softInvalid, true);
  assert.equal(validation.hardInvalid, false);
  assert.equal(validation.blockHcpGeneration, false);
  assert.equal(validation.nonConversationalInput.detected, true);
  assert.equal(validation.nonConversationalInput.stage, 'soft_coach');
  assert.match(validation.coaching.tip, /notes, not a conversation/i);
  assert.match(validation.coaching.suggestion, /complete sentence/i);
  assert.match(validation.coaching.suggestion, /Try saying it as/i);
  assert.ok(validation.telemetryEvents.some((event) => event.eventType === 'non_conversational_input_detected'));
});

test('shared roleplay turn validation flags note heading plus action tail as non-conversational', () => {
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'How does this change the decision for stable HIV patients?',
    repMessage: 'Durability and convenience benefits. Define clear optimization criteria and implement quarterly review.',
    previousRepMessages: [],
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.softInvalid, true);
  assert.equal(validation.nonConversationalInput.detected, true);
  assert.deepEqual(validation.nonConversationalInput.reasons, ['note_heading_with_action_tail']);
  assert.match(validation.nonConversationalInput.spokenRewriteSuggestion, /defining clear optimization criteria and implementing quarterly review/i);
  assert.match(validation.coaching.suggestion, /Respond in a complete sentence/i);
});

test('shared roleplay turn validation escalates repeated note-style input to hard invalid', () => {
  const noteInput = 'Reluctance to optimize stable patients. Durability and convenience benefits. Quarterly review.';
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'What proof point changes your decision for these patients?',
    repMessage: noteInput,
    previousRepMessages: [],
    allPreviousRepMessages: [noteInput],
  });

  assert.equal(validation.valid, false);
  assert.equal(validation.softInvalid, false);
  assert.equal(validation.hardInvalid, true);
  assert.equal(validation.blockHcpGeneration, true);
  assert.equal(validation.blockScoring, true);
  assert.equal(validation.blockStateAdvance, true);
  assert.equal(validation.nonConversationalInput.detected, true);
  assert.equal(validation.nonConversationalInput.stage, 'hard_block');
  assert.match(validation.nonConversationalInput.spokenRewriteSuggestion, /Try saying it as/i);
  assert.equal(validation.coaching.escalationLabel, 'Turn blocked');
  assert.ok(validation.telemetryEvents.some((event) => event.eventType === 'non_conversational_input_detected'));
});

test('shared roleplay turn validation does not flag proper spoken sentences or short spoken acknowledgements as note fragments', () => {
  const spoken = validateRoleplayRepTurn({
    latestHcpAsk: 'What is the first workflow step?',
    repMessage: 'The first step would be a nurse-owned checklist before the refill window.',
    previousRepMessages: [],
  });
  const shortAcknowledgement = validateRoleplayRepTurn({
    latestHcpAsk: 'Can you keep this focused?',
    repMessage: 'Absolutely.',
    previousRepMessages: [],
  });

  assert.equal(spoken.nonConversationalInput.detected, false);
  assert.equal(spoken.valid, true);
  assert.equal(shortAcknowledgement.nonConversationalInput.detected, false);
  assert.equal(shortAcknowledgement.hardInvalid, false);
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

test('shared roleplay turn validation treats applied durability questions as evidence asks', () => {
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'Before we discuss further, can you specifically address how the data you shared last week applies to the long-term durability of treatments for my stable HIV patients?',
    repMessage: "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.",
    previousRepMessages: [],
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.softInvalid, true);
  assert.equal(validation.hardInvalid, false);
  assert.equal(validation.latestAskProgression.status, 'missed');
  assert.equal(validation.latestAskProgression.family, 'evidence');
});

test('shared roleplay turn validation treats relevant check-back questions as valid clarification', () => {
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'We are seeing patients on day 4 or 5, and it is almost too late for antivirals. What is one practical workflow step we can use without adding burden?',
    repMessage: 'Understood — before we go further, what matters most in your decision here: durability, workflow burden, or access?',
    previousRepMessages: [],
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.softInvalid, false);
  assert.equal(validation.hardInvalid, false);
  assert.equal(validation.latestAskProgression.status, 'workflow_clarification');
  assert.equal(validation.latestAskProgression.clarificationRequest, true);
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
  assert.equal(validation.softInvalid, false);
  assert.equal(validation.hardInvalid, true);
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
  assert.equal(validation.softInvalid, false);
  assert.equal(validation.hardInvalid, true);
  assert.equal(validation.blockHcpGeneration, true);
  assert.equal(validation.latestAskProgression.status, 'repeated_missed_close');
  assert.equal(validation.latestAskProgression.family, 'evidence');
  assert.deepEqual(
    validation.telemetryEvents.map((event) => event.eventType),
    ['invalid_turn_blocked', 'repeated_non_answer_blocked', 'latest_ask_ignored', 'non_adaptive_repetition_detected'],
  );
});

test('shared roleplay turn validation passes context-aware first turns against opening scene', () => {
  const validation = validateRoleplayRepTurn({
    firstTurnOpeningContext: 'The P&T committee members are reviewing budget reports. We have three formulary requests today. You have 20 minutes.',
    repMessage: 'Understood. Given the time, I will keep this focused on the one outcomes point most relevant to formulary review.',
    previousRepMessages: [],
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.invalid, false);
  assert.equal(validation.openingContextProgression.status, 'responsive');
  assert.equal(validation.openingContextProgression.family, 'evidence');
  assert.equal(validation.coaching, null);
});

test('shared roleplay turn validation allows partially responsive first turns with lightweight coaching', () => {
  const validation = validateRoleplayRepTurn({
    firstTurnOpeningContext: 'The P&T committee members are reviewing budget reports. We have three formulary requests today. You have 20 minutes.',
    repMessage: 'Thanks for your time. I will focus on the formulary evidence.',
    previousRepMessages: [],
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.invalid, false);
  assert.equal(validation.openingContextProgression.status, 'partially_responsive');
  assert.equal(validation.coaching.escalationLabel, 'First-turn context note');
  assert.match(validation.coaching.suggestion, /opening|formulary|evidence|time/i);
});

test('shared roleplay turn validation soft-coaches generic first-turn openers against context-only openings', () => {
  const validation = validateRoleplayRepTurn({
    firstTurnOpeningContext: 'The P&T committee members are reviewing budget reports. We have three formulary requests today. You have 20 minutes.',
    repMessage: "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.",
    previousRepMessages: [],
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.invalid, false);
  assert.equal(validation.softInvalid, true);
  assert.equal(validation.hardInvalid, false);
  assert.equal(validation.blockHcpGeneration, false);
  assert.equal(validation.blockScoring, false);
  assert.equal(validation.blockStateAdvance, false);
  assert.equal(validation.openingContextProgression.status, 'partially_responsive');
  assert.equal(validation.openingContextProgression.askStrength, 'soft_implied_ask');
  assert.equal(validation.coaching.escalationLabel, 'First-turn context note');
  assert.ok(validation.telemetryEvents[0].payload.reasonCodes.includes('first_turn_opening_context_partial'));
  assert.doesNotMatch(JSON.stringify(validation.telemetryEvents), /formulary requests/i);
});

test('shared roleplay turn validation blocks generic first-turn openers against hard explicit opening asks', () => {
  const validation = validateRoleplayRepTurn({
    firstTurnOpeningContext: 'Give me one concrete workflow step my team could use without adding burden.',
    repMessage: "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.",
    previousRepMessages: [],
  });

  assert.equal(validation.valid, false);
  assert.equal(validation.invalid, true);
  assert.equal(validation.softInvalid, false);
  assert.equal(validation.hardInvalid, true);
  assert.equal(validation.blockHcpGeneration, true);
  assert.equal(validation.blockScoring, true);
  assert.equal(validation.blockStateAdvance, true);
  assert.equal(validation.openingContextProgression.status, 'non_responsive');
  assert.equal(validation.openingContextProgression.askStrength, 'hard_explicit_ask');
  assert.equal(validation.coaching.escalationLabel, 'Turn blocked');
  assert.ok(validation.telemetryEvents[0].payload.reasonCodes.includes('first_turn_opening_context_ignored'));
  assert.doesNotMatch(JSON.stringify(validation.telemetryEvents), /high risk patients/i);
});

test('shared roleplay turn validation blocks nonsense first-turn input before live progression', () => {
  const validation = validateRoleplayRepTurn({
    firstTurnOpeningContext: 'The HCP is short-staffed and asks for one practical workflow step.',
    repMessage: 'Hello?',
    previousRepMessages: [],
  });

  assert.equal(validation.valid, false);
  assert.equal(validation.softInvalid, false);
  assert.equal(validation.hardInvalid, true);
  assert.equal(validation.latestAskProgression.status, 'none');
  assert.equal(validation.openingContextProgression.status, 'non_responsive');
  assert.equal(validation.blockHcpGeneration, true);
});

test('shared roleplay turn validation transitions to normal latest-ask behavior after first turn', () => {
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'What is the first workflow step my team would own?',
    firstTurnOpeningContext: '',
    repMessage: 'Start a nurse-owned checklist in the existing follow-up call.',
    previousRepMessages: [],
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.openingContextProgression, null);
  assert.equal(validation.latestAskProgression.status, 'owner_progress');
});
