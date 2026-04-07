import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyConversationalRealism,
  compressByState,
  detectOverpackedSentence,
  enforceTerminalCompression,
  humanizeClinicalReferences,
  reduceFormalMetaLabeling,
  validateCueDialogueLockstep,
  varyPressurePhrasing,
} from '../src/lib/roleplay/conversationalRealismEngine.js';

test('conversational realism keeps neutral evidence asks natural while preserving detail', () => {
  const result = applyConversationalRealism({
    text: 'Before we discuss new data, can you specifically address how the treatment options you mentioned last week impact the long-term durability for my stable patients, which was my primary concern?',
    concernFamily: 'evidence',
    cueCategory: 'neutral_attentive',
    engagementTier: 'engaged',
  });

  assert.match(result.text, /durability/i);
  assert.match(result.text, /stable patients/i);
  assert.doesNotMatch(result.text, /treatment options you mentioned last week/i);
  assert.equal(result.metadata.cueCategory, 'neutral_attentive');
});

test('conversational realism compresses focused evidence asks under pressure', () => {
  const result = applyConversationalRealism({
    text: 'Before we discuss new data, can you specifically address how the treatment options you mentioned last week impact the long-term durability for my stable patients, which was my primary concern?',
    concernFamily: 'evidence',
    cueCategory: 'focused_narrowing',
    engagementTier: 'constrained',
    interactionMode: 'directive',
  });

  assert.equal(result.text, 'Before we move on, can you tie that to durability for my stable patients?');
  assert.doesNotMatch(result.text, /primary concern/i);
  assert.equal(result.metadata.lockstep.aligned, true);
});

test('conversational realism makes workflow hard escalation shorter and directive', () => {
  const result = applyConversationalRealism({
    text: 'I can stay with this if we make it concrete. What is the first step my staff would own?',
    concernFamily: 'workflow',
    cueCategory: 'hard_escalation',
    engagementTier: 'disengaging',
    interactionMode: 'closing',
  });

  assert.equal(result.text, 'I can stay with this if we make it concrete. What would my staff own first?');
  assert.doesNotMatch(result.text, /^Then give me one step/i);
  assert.equal(result.metadata.lockstep.aligned, true);
  assert.ok(result.text.split(/\s+/).length <= 16);
});

test('conversational realism preserves access and screening ask clarity', () => {
  assert.equal(
    applyConversationalRealism({
      text: 'Given the access delays. What is one workable step?',
      concernFamily: 'access',
      cueCategory: 'time_constrained',
      timePressure: true,
    }).text,
    'Given the access delays, what is one workable step?'
  );

  assert.equal(
    applyConversationalRealism({
      text: 'From a screening perspective. How would I identify the right patients?',
      concernFamily: 'screening',
      cueCategory: 'focused_narrowing',
    }).text,
    'From a screening perspective, how would I identify the right patients?'
  );
});

test('conversational realism compresses terminal exits without adding a new ask', () => {
  const result = applyConversationalRealism({
    text: 'I need to pause here if we cannot get to the workflow answer.',
    concernFamily: 'workflow',
    cueCategory: 'terminal_exit',
    terminalBehavior: true,
  });

  assert.equal(result.text, 'I need to pause here.');
  assert.doesNotMatch(result.text, /\?/);
  assert.equal(result.metadata.lockstep.aligned, true);
});

test('conversational realism hard-compresses formal terminal evidence expansion', () => {
  const result = applyConversationalRealism({
    text: 'To directly address your follow-up on outcomes data. Can you specifically elaborate on how that data supports the long-term durability of treatment regimens for my stable patients?',
    concernFamily: 'evidence',
    cueCategory: 'terminal_exit',
    engagementTier: 'disengaging',
    interactionMode: 'closing',
    semanticStage: 'closing',
    terminalBehavior: true,
  });

  assert.equal(result.text, "I'm about to move on. How does that affect durability for stable patients?");
  assert.doesNotMatch(result.text, /To directly address|specifically elaborate|treatment regimens/i);
  assert.ok(result.text.split(/\s+/).length <= 13);
  assert.equal(result.metadata.lockstep.aligned, true);
  assert.equal(result.metadata.terminalCompressionApplied, true);
});

test('terminal compression keeps pressured asks short by concern family', () => {
  assert.equal(
    enforceTerminalCompression({
      text: 'To address your workflow follow-up. Can you specifically elaborate on how this would support the operational implications for my staff?',
      concernFamily: 'workflow',
      cueCategory: 'terminal_exit',
    }),
    "I'm about to move on, but make it practical. What would my team do first?"
  );
});

test('conversational realism preserves rich framing for generic pressured workflow asks', () => {
  assert.equal(
    applyConversationalRealism({
      text: 'What is the first practical workflow step here?',
      concernFamily: 'workflow',
      cueCategory: 'hard_escalation',
      interactionMode: 'directive',
    }).text,
    'I can stay with this if we make it concrete. What would my team do first?'
  );

  assert.equal(
    applyConversationalRealism({
      text: 'Keep it to one workflow step we could use here.',
      concernFamily: 'workflow',
      cueCategory: 'terminal_exit',
      terminalBehavior: true,
    }).text,
    "I'm about to move on, but make it practical. What would my team do first?"
  );
});

test('conversational realism preserves concise evidence framing under time pressure', () => {
  assert.equal(
    applyConversationalRealism({
      text: 'Given the time, what is the one decision-relevant evidence point?',
      concernFamily: 'evidence',
      cueCategory: 'time_constrained',
      timePressure: true,
    }).text,
    'Given the time, what evidence point changes the decision?'
  );

  assert.equal(
    applyConversationalRealism({
      text: 'Given the time, what is the one decision-relevant evidence point?',
      concernFamily: 'evidence',
      cueCategory: 'terminal_exit',
      terminalBehavior: true,
    }).text,
    "I'm about to move on. What evidence point changes the decision?"
  );
});

test('conversational realism reports cue-dialogue lockstep mismatches', () => {
  assert.deepEqual(
    validateCueDialogueLockstep({ cueCategory: 'hard_escalation', finalText: 'I can stay with this if we make it concrete.' }).mismatchReasons,
    ['hard_escalation_with_soft_framing']
  );
  assert.deepEqual(
    validateCueDialogueLockstep({ cueCategory: 'terminal_exit', finalText: 'What data should we discuss next?' }).mismatchReasons,
    ['terminal_cue_without_terminal_dialogue']
  );
});

test('conversational realism exposes deterministic phrase-family anti-repetition metadata', () => {
  const first = varyPressurePhrasing({
    text: 'Can you tie that to durability for my stable patients?',
    concernFamily: 'evidence',
    recentHcpTurns: [
      'What proof point changes the decision?',
      'Can you connect last week’s data to durability for my stable patients?',
    ],
    cueCategory: 'hard_escalation',
  });
  const second = varyPressurePhrasing({
    text: 'Can you tie that to durability for my stable patients?',
    concernFamily: 'evidence',
    recentHcpTurns: [
      'What proof point changes the decision?',
      'Can you connect last week’s data to durability for my stable patients?',
    ],
    cueCategory: 'hard_escalation',
  });

  assert.equal(first.phraseFamily, 'evidenceAsk');
  assert.equal(first.repeatedFamilyCount, 2);
  assert.deepEqual(second, first);
});

test('conversational realism helpers remain deterministic and bounded', () => {
  assert.equal(
    humanizeClinicalReferences({ text: 'Can you explain the operational implications for my staff?' }),
    'Can you explain what my staff would actually do?'
  );
  assert.equal(
    reduceFormalMetaLabeling({ text: 'How does this affect durability, which was my primary concern?' }),
    'How does this affect durability?'
  );
  assert.equal(detectOverpackedSentence({ text: 'Can you tie that to durability?' }).overpacked, false);
  assert.equal(
    compressByState({ text: 'I need to pause here if we cannot get to the workflow answer.', cueCategory: 'terminal_exit', concernFamily: 'workflow' }),
    'I need to pause here.'
  );
});
