import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveHcpCueState,
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
  assert.match(aligned.cueText, /evidence|data|proof point/i);
  assert.doesNotMatch(aligned.cueText, /door|ending|exchange is over/i);
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
  assert.match(aligned.cueText, /not adapt|not helping|repeated setup|practical ask/i);
  assert.doesNotMatch(aligned.cueText, /receptive|relaxed|warm/i);
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
  assert.match(aligned.cueText, /clipped attention|less willing|direct answer|proof-point/i);
  assert.doesNotMatch(aligned.cueText, /warm|receptive|relaxed|open/i);
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
  assert.match(aligned.cueText, /turns back|door|ending/i);
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
