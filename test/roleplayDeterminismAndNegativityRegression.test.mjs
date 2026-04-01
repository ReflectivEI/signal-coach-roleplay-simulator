import test from 'node:test';
import assert from 'node:assert/strict';

import { recalibrateHcpDialogueAndCue } from '../src/components/roleplay/hcpDialogueEngine.jsx';
import { deriveInitialState } from '../src/components/roleplay/hcpSimulationEngine.jsx';

test('hcp dialogue cue selection is deterministic for identical scenario/session/turn/question', () => {
  const input = {
    question: 'Can you walk me through candidacy criteria this week?',
    currentTab: 'General',
    scenario: {
      id: 'prep-access-01',
      title: 'PrEP operational adoption',
      hcp: { name: 'Dr. Adams', personality: { name: 'Direct' } },
    },
    sessionId: 'session_abc123',
    turnNumber: 3,
    state: 'neutral',
    severity: 0,
    history: [],
  };

  const first = recalibrateHcpDialogueAndCue(input);
  const second = recalibrateHcpDialogueAndCue(input);

  assert.equal(first.cueBefore, second.cueBefore);
  assert.equal(first.hcpDialogueBefore, second.hcpDialogueBefore);
});

test('hcp dialogue cue seed changes when session id changes', () => {
  const baseInput = {
    question: 'How does this affect workflow this month?',
    currentTab: 'General',
    scenario: {
      id: 'workflow-01',
      title: 'Workflow calibration',
      hcp: { name: 'Dr. Rivera', personality: { name: 'Skeptical' } },
    },
    turnNumber: 2,
    state: 'neutral',
    severity: 1,
    history: [],
  };

  const a = recalibrateHcpDialogueAndCue({ ...baseInput, sessionId: 'session_A' });
  const b = recalibrateHcpDialogueAndCue({ ...baseInput, sessionId: 'session_B' });

  assert.notEqual(a.cueBefore, b.cueBefore);
});

test('deriveInitialState does not mark neutral scenarios as resistant from generic challenge wording', () => {
  const scenario = {
    title: 'Routine follow-up discussion',
    description: 'Key challenges include scheduling and staffing logistics.',
    details: 'General educational check-in focused on process clarity.',
    hcp_category: 'Primary Care',
    influence_driver: 'Consistency',
  };

  assert.equal(deriveInitialState(scenario), 'neutral');
});

test('deriveInitialState still detects explicit resistance language', () => {
  const scenario = {
    title: 'Skeptical physician on new protocol',
    description: 'HCP is unconvinced and not interested in current evidence.',
    details: 'Frequent pushback during prior meetings.',
    hcp_category: 'Oncology',
    influence_driver: 'Evidence threshold',
  };

  assert.equal(deriveInitialState(scenario), 'resistant');
});
