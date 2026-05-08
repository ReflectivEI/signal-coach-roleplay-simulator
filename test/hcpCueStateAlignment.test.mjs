import test from 'node:test';
import assert from 'node:assert/strict';

import {
  detectInternalNarrationLeak,
  deriveHcpCueState,
  reviseCueForObservableBehavior,
  selectStateAlignedHcpCue,
} from '../src/lib/roleplay/hcpCueStateAlignment.js';

const evidenceAsk = 'What proof point changes the decision for my stable HIV patients?';
const workflowAsk = 'What is the first practical workflow step here?';

test('neutral state derives an attentive cue tied to the active concern family', () => {
  const aligned = selectStateAlignedHcpCue({
    preferStateDerived: true,
    activeHcpAsk: evidenceAsk,
    concernFamily: 'evidence',
    hcpState: 'engaged',
    decayTier: 'engaged',
    dialogueText: 'Before we discuss further, can you address how the data applies to durability?',
    scenarioId: 'michael_hiv',
    turnNumber: 1,
  });

  assert.equal(aligned.cueCategory, 'neutral_attentive');
  assert.equal(aligned.concernFamily, 'evidence');
  assert.match(aligned.cueText, /chart|data|decision/i);
  assert.doesNotMatch(aligned.cueText, /door|ending|exchange is over/i);
  assert.equal(detectInternalNarrationLeak(aligned.cueText), false);
});

test('repeated non-adaptation derives increasing impatience cues without becoming terminal early', () => {
  const aligned = selectStateAlignedHcpCue({
    existingCueText: 'The HCP keeps steady eye contact, attentive and professionally receptive.',
    preferStateDerived: true,
    activeHcpAsk: workflowAsk,
    concernFamily: 'workflow',
    hcpState: 'engaged',
    decayTier: 'constrained',
    dialogueText: 'I hear you, but I need this brought back to workflow: what is the first practical step here?',
    conversationIntelligenceState: {
      turnInterpretation: { progression: 'non_adaptive', valid: 'softInvalid', concernFamily: 'workflow' },
      adaptationSignals: { repeated_without_adapting: true },
    },
    scenarioId: 'workflow_repeat',
    turnNumber: 2,
  });

  assert.equal(aligned.cueCategory, 'non_adaptive_impatience');
  assert.equal(aligned.terminalCue, false);
  assert.match(aligned.cueText, /clinic list|setup pass|less patient/i);
  assert.doesNotMatch(aligned.cueText, /receptive|relaxed|warm/i);
  assert.equal(detectInternalNarrationLeak(aligned.cueText), false);
});

test('hard escalation cues do not preserve soft body-language descriptors', () => {
  const aligned = selectStateAlignedHcpCue({
    existingCueText: 'The HCP listens with a warm, receptive expression.',
    preferStateDerived: true,
    activeHcpAsk: evidenceAsk,
    concernFamily: 'evidence',
    hcpState: 'boundary-setting',
    decayTier: 'impatient',
    dialogueText: 'Give me the proof point, not the setup: what should change in practice?',
    conversationIntelligenceState: {
      turnInterpretation: { progression: 'stalled', valid: 'hardInvalid', concernFamily: 'evidence' },
      adaptationSignals: { repeated_without_adapting: true },
    },
    validationOutput: { hardInvalid: true },
    scenarioId: 'evidence_hard_escalation',
    turnNumber: 4,
  });

  assert.equal(aligned.cueCategory, 'hard_escalation');
  assert.equal(aligned.replacedExistingCue, true);
  assert.match(aligned.cueText, /chart|clipped|detour/i);
  assert.doesNotMatch(aligned.cueText, /warm|receptive|relaxed|open/i);
  assert.equal(detectInternalNarrationLeak(aligned.cueText), false);
});

test('explicit time pressure derives time-constrained cues ahead of generic narrowing', () => {
  const aligned = selectStateAlignedHcpCue({
    preferStateDerived: true,
    activeHcpAsk: evidenceAsk,
    concernFamily: 'evidence',
    hcpState: 'engaged',
    decayTier: 'constrained',
    timePressure: true,
    dialogueText: 'We have 20 minutes, so give me the single proof point that changes this decision.',
    scenarioId: 'evidence_time_pressure',
    turnNumber: 1,
  });

  assert.equal(aligned.cueCategory, 'time_constrained');
  assert.match(aligned.cueText, /schedule|chart|concise point/i);
  assert.doesNotMatch(aligned.cueText, /door|ending|exchange is over/i);
  assert.equal(detectInternalNarrationLeak(aligned.cueText), false);
});

test('terminal state derives exit cues aligned with terminal dialogue or imminent exit', () => {
  const aligned = selectStateAlignedHcpCue({
    existingCueText: 'The HCP stays attentive, waiting for the response to connect.',
    preferStateDerived: true,
    activeHcpAsk: workflowAsk,
    concernFamily: 'workflow',
    hcpState: 'disengaged',
    decayTier: 'disengaging',
    terminal: true,
    dialogueText: 'I need to pause here and get back to clinic.',
    scenarioId: 'workflow_terminal',
    turnNumber: 5,
  });

  assert.equal(aligned.cueCategory, 'terminal_exit');
  assert.equal(aligned.terminalCue, true);
  assert.match(aligned.cueText, /turns back|door|gathers/i);
  assert.equal(detectInternalNarrationLeak(aligned.cueText), false);
});

test('cue narration leak guard rewrites internal ask labels into observable behavior', () => {
  const cue = reviseCueForObservableBehavior({
    cueText: 'The HCP checks the schedule briefly, then returns to the evidence ask for one decision-relevant point.',
    cueCategory: 'time_constrained',
    concernFamily: 'evidence',
  });

  assert.equal(detectInternalNarrationLeak(cue), false);
  assert.match(cue, /schedule|chart/i);
  assert.doesNotMatch(cue, /returns to the evidence ask|decision-relevant point/i);
});

test('cue derivation is deterministic for the same state inputs', () => {
  const input = {
    preferStateDerived: true,
    activeHcpAsk: 'What is one access step that avoids prior authorization delays?',
    concernFamily: 'access',
    hcpState: 'engaged',
    decayTier: 'constrained',
    timePressure: true,
    dialogueText: 'I get where you are going, but what is the access step my team can use this week?',
    scenarioId: 'access_determinism',
    turnNumber: 3,
  };

  const first = selectStateAlignedHcpCue(input);
  const second = selectStateAlignedHcpCue(input);

  assert.deepEqual(first, second);
});

test('deriveHcpCueState exposes the cue state model for audit payloads', () => {
  const state = deriveHcpCueState({
    activeHcpAsk: workflowAsk,
    concernFamily: 'workflow',
    hcpState: 'engaged',
    decayTier: 'engaged',
    dialogueText: 'What is the first practical step here?',
  });

  assert.equal(state.version, 'hcp_cue_state_alignment_v1');
  assert.equal(state.cueCategory, 'neutral_attentive');
  assert.equal(state.concernFamily, 'workflow');
  assert.equal(state.stateSignals.terminal, false);
});
