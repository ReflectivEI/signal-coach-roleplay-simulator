import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compressHcpDialogueForState,
  dedupeRepeatedHcpAsks,
  detectClauseStitchFailure,
  detectDialogueBoundaryIssues,
  formatHcpSentence,
  normalizeDialogueSentenceBoundaries,
  normalizeHcpSpokenRealism,
  reviseForSentenceIntegrity,
} from '../src/lib/roleplay/dialogueGrammar.js';

test('normalizeDialogueSentenceBoundaries repairs comma splice between independent clauses', () => {
  const input = 'We reviewed the endpoint definitions, we need one practical next step today';
  const output = normalizeDialogueSentenceBoundaries(input);
  assert.equal(output, 'We reviewed the endpoint definitions. We need one practical next step today.');
});

test('normalizeDialogueSentenceBoundaries repairs weak question join', () => {
  const input = "I'm familiar with that trial, what outcome would change your decision";
  const output = normalizeDialogueSentenceBoundaries(input);
  assert.equal(output, "I'm familiar with that trial. What outcome would change your decision?");
});

test('normalizeDialogueSentenceBoundaries preserves valid dependent-clause commas', () => {
  const input = 'Because we are short-staffed today, we need one operational step';
  const output = normalizeDialogueSentenceBoundaries(input);
  assert.equal(output, 'Because we are short-staffed today, we need one operational step.');
});

test('normalizeDialogueSentenceBoundaries keeps natural contractions, interruptions, and fragments', () => {
  const input = "I hear you, and I'm not against it—just not today";
  const output = normalizeDialogueSentenceBoundaries(input);
  assert.equal(output, "I hear you, and I'm not against it—just not today.");
});

test('normalizeDialogueSentenceBoundaries handles jargon-heavy dialogue without lexical rewrite', () => {
  const input = 'Our GDMT adherence is drifting, the EHR handoff still misses PA flags';
  const output = normalizeDialogueSentenceBoundaries(input);
  assert.equal(output, 'Our GDMT adherence is drifting. The EHR handoff still misses PA flags.');
});

test('normalizeDialogueSentenceBoundaries joins dependent prefaces into natural questions', () => {
  const input = 'Before we discuss further. Can you specifically address how the data applies to long-term durability?';
  const output = normalizeDialogueSentenceBoundaries(input);
  assert.equal(output, 'Before we discuss further, can you specifically address how the data applies to long-term durability?');
  assert.doesNotMatch(output, /Before we discuss further\.\s+Can/i);
});

test('normalizeDialogueSentenceBoundaries repairs generalized fragment-to-question stitching', () => {
  assert.equal(
    normalizeDialogueSentenceBoundaries('Given the time pressure. What is the smallest workflow change?'),
    'Given the time pressure, what is the smallest workflow change?'
  );
  assert.equal(
    normalizeDialogueSentenceBoundaries('From a workflow perspective. How would the team start?'),
    'From a workflow perspective, how would the team start?'
  );
  assert.equal(
    normalizeDialogueSentenceBoundaries('I want to make sure I understand. How does this change the decision?'),
    'I want to make sure I understand, how does this change the decision?'
  );
});

test('formatHcpSentence composes preface plus ask deterministically without changing intent', () => {
  const first = formatHcpSentence({
    preface: 'Before we discuss further.',
    ask: 'Can you address the durability point?',
  });
  const second = formatHcpSentence({
    preface: 'Before we discuss further.',
    ask: 'Can you address the durability point?',
  });
  assert.equal(first, 'Before we discuss further, can you address the durability point?');
  assert.equal(second, first);
});

test('normalizeHcpSpokenRealism converts formal recall questions into shorter spoken HCP flow', () => {
  assert.equal(
    normalizeHcpSpokenRealism('Before we discuss further. Can you specifically address how the data you shared last week applies to the long-term durability of treatments for my stable HIV patients?'),
    'Before we go further, can you tie that data back to long-term durability for my stable HIV patients?'
  );
  assert.equal(
    normalizeHcpSpokenRealism('Before we discuss new data, can you specifically address how the treatment options you mentioned last week would impact the workflow for my stable, suppressed patients?'),
    'Before we get into new data, can you walk me through how that would actually change my workflow for stable patients?'
  );
});

test('dedupeRepeatedHcpAsks removes repeated patient subgroup decision asks', () => {
  const input = 'What specific patient subgroup would see a change in treatment choice with this. Which patient subgroup does that affect first, and what decision changes. Which patient subgroup does that affect first, and what decision changes?';
  const output = normalizeHcpSpokenRealism(input);

  assert.equal(
    output,
    'What specific patient subgroup would see a change in treatment choice with this?'
  );
  assert.equal(
    (output.match(/patient subgroup/gi) || []).length,
    1,
    'only one patient-subgroup ask should remain'
  );
});

test('dedupeRepeatedHcpAsks preserves distinct HCP pressure while removing duplicate intent', () => {
  const output = dedupeRepeatedHcpAsks(
    "I'm still not clear how this changes treatment for my patients. Which patient subgroup does that affect first, and what decision changes? Which patient subgroup does that affect first, and what decision changes?"
  );

  assert.equal(
    output,
    "I'm still not clear how this changes treatment for my patients. Which patient subgroup does that affect first, and what decision changes?"
  );
});

test('dedupeRepeatedHcpAsks removes patient profile endpoint decision plus subgroup follow-up stacking', () => {
  const output = normalizeHcpSpokenRealism(
    'Narrow this to the patient profile, the endpoint, and the decision I would actually change. Which patient subgroup does that affect first, and what decision changes?'
  );

  assert.equal(
    output,
    'Narrow this to the patient profile, the endpoint, and the decision I would actually change.'
  );
  assert.doesNotMatch(output, /Which patient subgroup does that affect first/i);
});

test('compressHcpDialogueForState shortens evidence asks as pressure increases while preserving durability ask', () => {
  const input = 'Before we discuss new data, can you specifically address how the treatment options you mentioned last week impact the long-term durability for my stable patients, which was my primary concern?';
  const neutral = compressHcpDialogueForState(input, { cueCategory: 'neutral_attentive', concernFamily: 'evidence' });
  const focused = compressHcpDialogueForState(input, { cueCategory: 'focused_narrowing', concernFamily: 'evidence' });
  const hard = compressHcpDialogueForState(input, { cueCategory: 'hard_escalation', concernFamily: 'evidence' });

  assert.equal(neutral, 'Before we get into new data, can you tie that to durability for my stable patients, which was my primary concern?');
  assert.equal(focused, 'Before we get into new data, can you tie that to durability for my stable patients?');
  assert.equal(hard, 'Can you tie that to durability for my stable patients?');
  assert.ok(hard.split(/\s+/).length < focused.split(/\s+/).length);
  assert.match(hard, /durability/i);
});

test('compressHcpDialogueForState makes workflow escalation more direct without dropping ownership ask', () => {
  const input = 'I can stay with this if we make it concrete. What is the first step my staff would own?';
  assert.equal(
    compressHcpDialogueForState(input, { cueCategory: 'focused_narrowing', concernFamily: 'workflow' }),
    'Okay, make it concrete. What would my staff do first?'
  );
  assert.equal(
    compressHcpDialogueForState(input, { cueCategory: 'hard_escalation', concernFamily: 'workflow' }),
    'I can stay with this if we make it concrete. What would my staff own first?'
  );
});

test('compressHcpDialogueForState keeps access and screening asks intact while normalizing sentence flow', () => {
  assert.equal(
    compressHcpDialogueForState('Given the access delays. What is one workable step?', { cueCategory: 'time_constrained', concernFamily: 'access' }),
    'Given the access delays, what is one workable step?'
  );
  assert.equal(
    compressHcpDialogueForState('From a screening perspective. How would I identify the right patients?', { cueCategory: 'focused_narrowing', concernFamily: 'screening' }),
    'From a screening perspective, how would I identify the right patients?'
  );
});

test('compressHcpDialogueForState keeps terminal exits short without adding a new ask', () => {
  const output = compressHcpDialogueForState('I need to pause here if we cannot get to the workflow answer.', { cueCategory: 'terminal_exit', concernFamily: 'workflow' });
  assert.equal(output, 'I need to pause here.');
  assert.doesNotMatch(output, /\?/);
});

test('detectDialogueBoundaryIssues reports sentence-boundary defects and ignores valid joins', () => {
  assert.deepEqual(detectDialogueBoundaryIssues('We reviewed endpoints, we need one action now.'), ['comma_splice']);
  assert.deepEqual(detectDialogueBoundaryIssues('Because we reviewed endpoints, we can proceed.'), []);
});

test('sentence integrity repair fixes dependent burden clause stitching without changing intent', () => {
  assert.deepEqual(
    detectClauseStitchFailure('Stable patients are not a quick switch; if we changed course. What extra lift would nurses or staff carry afterward?'),
    ['semicolon_if_clause_split_before_question', 'conditional_clause_split_before_question', 'unsafe_semicolon_dependent_split'],
  );
  assert.equal(
    normalizeHcpSpokenRealism('before I ask staff to shift stable-patient follow-up. What burden would they absorb over the coming weeks?'),
    'Before I ask staff to shift stable-patient follow-up, what burden would they absorb over the coming weeks?',
  );
  assert.equal(
    reviseForSentenceIntegrity('Stable patients are not a quick switch; if we changed course. What extra lift would nurses or staff carry afterward?'),
    'Stable patients are not a quick switch; if we changed course, what extra lift would nurses or staff carry afterward?',
  );
});
