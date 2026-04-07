import test from 'node:test';
import assert from 'node:assert/strict';

import {
  detectDialogueBoundaryIssues,
  formatHcpSentence,
  normalizeDialogueSentenceBoundaries,
  normalizeHcpSpokenRealism,
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

test('detectDialogueBoundaryIssues reports sentence-boundary defects and ignores valid joins', () => {
  assert.deepEqual(detectDialogueBoundaryIssues('We reviewed endpoints, we need one action now.'), ['comma_splice']);
  assert.deepEqual(detectDialogueBoundaryIssues('Because we reviewed endpoints, we can proceed.'), []);
});
