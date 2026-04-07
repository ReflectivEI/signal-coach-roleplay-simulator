import test from 'node:test';
import assert from 'node:assert/strict';

import { extractScenarioOwnedOpeningTurn } from '../src/components/roleplay/openingTurnAuthority.js';
import { buildHcpReactionContract } from '../src/components/roleplay/hcpReactionIntegrity.js';

test('extractScenarioOwnedOpeningTurn parses cue and dialogue from scenario opening scene', () => {
  const openingTurn = extractScenarioOwnedOpeningTurn({
    openingScene: "Michael leans back in his chair, arms crossed but with an open expression. 'I'm always interested in better outcomes for my patients. What data do you have on long-term durability?'",
  });

  assert.equal(
    openingTurn.cueText,
    'Michael leans back in his chair, arms crossed but with an open expression'
  );
  assert.equal(
    openingTurn.dialogueText,
    "I'm always interested in better outcomes for my patients. What data do you have on long-term durability?"
  );
});

test('first-turn reaction contract uses scenario-owned opening beat instead of collapsed generic blocker family', () => {
  const scenarios = [
    {
      id: 'michael_case',
      openingScene: "Michael checks upcoming follow-up slots and signals for one implementable monitoring step. 'I'm always interested in better outcomes for my patients. What data do you have on long-term durability?'",
      hcpStateModel: { startingState: 'skeptical', allowedTransitions: {}, prohibitedTransitions: [] },
      sceneSetup: { timePressure: 'medium', currentClinicalOperationalContext: 'Stable HIV optimization decisions', openingCueSet: ['checks_follow_up_slots'] },
      hcpProfile: { baselineCommunicationStyle: 'data-driven', baselineOpennessResistance: 'skeptical', knownConstraints: [] },
    },
    {
      id: 'jennifer_case',
      openingScene: "Jennifer highlights screening fields on a form, then asks with careful, practical focus. 'My patients keep asking about the long-acting injectable, and I want to make sure I'm doing this right. How do I screen appropriately before starting it?'",
      hcpStateModel: { startingState: 'skeptical', allowedTransitions: {}, prohibitedTransitions: [] },
      sceneSetup: { timePressure: 'medium', currentClinicalOperationalContext: 'Long-acting HIV candidate screening', openingCueSet: ['highlights_screening_fields'] },
      hcpProfile: { baselineCommunicationStyle: 'careful_practical', baselineOpennessResistance: 'uncertain', knownConstraints: [] },
    },
    {
      id: 'lisa_case',
      openingScene: "Lisa taps a follow-up list on the desk, then turns back with a practical, time-aware expression. 'We're short-staffed, and I need systems that won't overwhelm my team. What operational change would actually help?'",
      hcpStateModel: { startingState: 'time_pressed', allowedTransitions: {}, prohibitedTransitions: [] },
      sceneSetup: { timePressure: 'high', currentClinicalOperationalContext: 'Short-staffed oncology pathway operations', openingCueSet: ['taps_follow_up_list'] },
      hcpProfile: { baselineCommunicationStyle: 'practical_direct', baselineOpennessResistance: 'skeptical', knownConstraints: ['staffing'] },
    },
    {
      id: 'david_case',
      openingScene: "David checks upcoming follow-up slots and signals for one implementable monitoring step. 'Another refill gap. What is the first onboarding change that would prevent this from happening again?'",
      hcpStateModel: { startingState: 'frustrated', allowedTransitions: {}, prohibitedTransitions: [] },
      sceneSetup: { timePressure: 'medium', currentClinicalOperationalContext: 'Oral oncolytic onboarding and refill-gap prevention', openingCueSet: ['checks_follow_up_slots'] },
      hcpProfile: { baselineCommunicationStyle: 'process_focused', baselineOpennessResistance: 'skeptical', knownConstraints: ['workflow'] },
    },
  ];

  const repMessage = "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.";

  const outputs = scenarios.map((scenario) => buildHcpReactionContract({
    scenario,
    turnNumber: 1,
    hcpState: 'neutral',
    cueText: 'Generic cue',
    dialogueText: 'That is interesting, but my biggest issue is prior auth delays, not outcomes.',
    activeConcern: 'workflow',
    alignment: { score: 1, misalignments: ['miss'], rubricAlignmentFlags: [] },
    concernFlowOutcome: 'missed',
    repMessage,
  }));

  const dialogueSet = new Set(outputs.map((output) => output.selectedDialogueText));
  assert.equal(dialogueSet.size, 4);
  assert.ok(outputs.every((output) => output.enforcementTrace.openingTurnSource === 'scenario_opening_scene'));
  assert.ok(outputs.every((output) => !/prior auth delays, not outcomes/i.test(output.selectedDialogueText)));
});
