import test from 'node:test';
import assert from 'node:assert/strict';

import {
  detectDialogueBoundaryIssues,
  normalizeDialogueSentenceBoundaries,
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

test('detectDialogueBoundaryIssues reports sentence-boundary defects and ignores valid joins', () => {
  assert.deepEqual(detectDialogueBoundaryIssues('We reviewed endpoints, we need one action now.'), ['comma_splice']);
  assert.deepEqual(detectDialogueBoundaryIssues('Because we reviewed endpoints, we can proceed.'), []);
});
