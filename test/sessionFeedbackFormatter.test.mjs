import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCoachingFeedbackMarkdown,
  parseStructuredFeedback,
} from '../src/components/roleplay/sessionFeedbackFormatter.js';

test('parseStructuredFeedback reads delimiter-based sections deterministically', () => {
  const raw = `SECTION 1: STRENGTHS\nStrong opening question.\n[SECTION_END]\nSECTION 2: IMPROVEMENTS\nTighten close.\n[SECTION_END]\nSECTION 3: PATTERNS\nAdjusted to HCP signals.\n[SECTION_END]\nSECTION 4: ACTION ITEMS\nUse one explicit next step.\n[SECTION_END]`;

  const parsed = parseStructuredFeedback(raw);
  assert.equal(parsed.strengthsText, 'Strong opening question.');
  assert.equal(parsed.improvementsText, 'Tighten close.');
  assert.equal(parsed.patternsText, 'Adjusted to HCP signals.');
  assert.equal(parsed.actionText, 'Use one explicit next step.');
});

test('parseStructuredFeedback fallback keeps raw content when sections are malformed', () => {
  const raw = 'General coaching response without section delimiters.';
  const parsed = parseStructuredFeedback(raw);

  assert.equal(parsed.strengthsText, raw);
  assert.equal(parsed.improvementsText, '');
  assert.equal(parsed.patternsText, '');
  assert.equal(parsed.actionText, '');
});

test('buildCoachingFeedbackMarkdown provides stable fallback copy for missing sections', () => {
  const markdown = buildCoachingFeedbackMarkdown({
    strengthsText: '',
    improvementsText: '',
    patternsText: '',
    actionText: '',
  });

  assert.match(markdown, /## 2\) Capabilities Done Well/);
  assert.match(markdown, /## 3\) Capabilities to Develop/);
  assert.match(markdown, /## 4\) Signal–Response Alignment/);
  assert.match(markdown, /## 5\) Specific Action Items/);
});
