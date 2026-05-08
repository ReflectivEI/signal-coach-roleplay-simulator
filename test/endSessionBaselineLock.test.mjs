import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { computeAlignment, END_SESSION_EVALUATION_BASELINE } from '../src/components/roleplay/alignmentEngine.jsx';

const CHAT_SOURCE = fs.readFileSync(new URL('../src/components/roleplay/RolePlayChat.jsx', import.meta.url), 'utf8');

test('end-session baseline contract is explicitly locked to SI-v2 baseline identifier', () => {
  assert.equal(END_SESSION_EVALUATION_BASELINE.id, 'SI-v2-locked-2026-02-11');
  assert.equal(END_SESSION_EVALUATION_BASELINE.path, 'end_session_end_get_feedback');
  assert.match(CHAT_SOURCE, /BASELINE EVALUATION CONTRACT:/);
  assert.match(CHAT_SOURCE, /Baseline ID: \$\{END_SESSION_EVALUATION_BASELINE\.id\}/);
});

test('baseline alignment outputs remain unchanged for validated calibration fixtures', () => {
  const resistantFixture = computeAlignment(
    'resistant',
    "That's a fair concern about workflow burden — we can start with one MA checklist this week.",
    {
      cueText: 'HCP signals workflow burden and resistance.',
      hcpUtterance: 'This adds burden. How would this fit our workflow?',
    },
    'neutral',
    'engaged',
  );

  const timeFixture = computeAlignment(
    'time-pressured',
    "You're right to raise that. I will keep this brief: one practical step is to assign intake screening to the MA today.",
    {
      cueText: 'HCP says they only have a minute.',
      hcpUtterance: 'Can you be brief and practical?',
    },
    'neutral',
    'engaged',
  );

  assert.equal(resistantFixture.score, 3);
  assert.equal(resistantFixture.alignmentClassification, 'partially_aligned');
  assert.equal(resistantFixture.metrics.signal_interpretation.score, 5);

  assert.equal(timeFixture.score, 4);
  assert.equal(timeFixture.alignmentClassification, 'partially_aligned');
  assert.equal(timeFixture.metrics.adaptive_response.score, 5);
  assert.equal(timeFixture.metrics.conversation_management.score, 4);
});
