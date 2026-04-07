import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractActionableAskFromNarrative,
  resolveActiveHcpAskState,
} from '../src/lib/roleplay/activeHcpAskState.js';
import { buildHcpReactionContract } from '../src/components/roleplay/hcpReactionIntegrity.js';

test('active HCP ask state extracts actionable asks from narrative context', () => {
  const ask = extractActionableAskFromNarrative('Maria points to a clinic workflow map and asks for one concrete step that will not add burden.');
  assert.equal(ask, 'one concrete step that will not add burden');
});

test('active HCP ask priority promotes narrative ask over opening scene', () => {
  const state = resolveActiveHcpAskState({
    narrativeContext: 'Maria points to a clinic workflow map and asks for one concrete step that will not add burden.',
    openingContext: "We're seeing too many patients on day 4 or 5. By then, it's almost too late for antivirals.",
    fallbackConcern: 'workflow',
  });

  assert.equal(state.source, 'narrative_context');
  assert.equal(state.askText, 'one concrete step that will not add burden');
  assert.equal(state.concernFamily, 'workflow');
});

test('active HCP ask priority lets explicit live HCP dialogue override prior narrative ask', () => {
  const state = resolveActiveHcpAskState({
    explicitHcpDialogue: 'What is the first workflow step my team would own this week?',
    narrativeContext: 'Maria points to a clinic workflow map and asks for one concrete step that will not add burden.',
    openingContext: 'Too many patients are appearing on day 4 or 5.',
    fallbackConcern: 'workflow',
  });

  assert.equal(state.source, 'explicit_hcp_dialogue');
  assert.match(state.askText, /first workflow step/i);
});

test('active HCP ask state falls back to opening scene only when no stronger ask exists', () => {
  const state = resolveActiveHcpAskState({
    openingContext: 'We have three formulary requests today. You have 20 minutes.',
    fallbackConcern: 'evidence',
  });

  assert.equal(state.source, 'opening_scene');
  assert.match(state.askText, /formulary requests/i);
});

test('active HCP ask state freezes on terminal state', () => {
  const state = resolveActiveHcpAskState({
    explicitHcpDialogue: 'What is the first workflow step?',
    terminal: true,
  });

  assert.equal(state.source, 'terminal');
  assert.equal(state.askText, '');
  assert.equal(state.frozen, true);
});

test('reaction contract does not replay scenario opening dialogue after opening is consumed', () => {
  const scenario = {
    id: 'opening_consumed_maria',
    openingScene: "Maria is reviewing a patient callback list, looking frustrated. 'We're seeing too many patients on day 4 or 5. By then, it's almost too late for antivirals.'",
  };
  const contract = buildHcpReactionContract({
    scenario,
    turnNumber: 1,
    hcpState: 'neutral',
    cueText: 'Maria points to a clinic workflow map and asks for one concrete step that will not add burden.',
    dialogueText: 'Right now, the practical workflow issue is the priority. What is one step we could implement without adding burden?',
    activeConcern: 'workflow',
    concernFlowOutcome: 'missed',
    alignment: { score: 2, misalignments: ['missed_opening_context'], rubricAlignmentFlags: [] },
    repMessage: "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.",
    openingTurnConsumed: true,
  });

  assert.match(contract.selectedDialogueText, /workflow|step|burden/i);
  assert.doesNotMatch(contract.selectedDialogueText, /day 4 or 5|too late for antivirals/i);
});
