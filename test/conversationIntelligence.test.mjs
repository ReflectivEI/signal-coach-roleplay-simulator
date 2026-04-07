import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildConversationIntelligenceTelemetryEvent,
  deriveConversationIntelligenceState,
} from '../src/lib/roleplay/conversationIntelligence.js';
import { buildRoleplayScenarioExecutionContract } from '../src/lib/roleplay/scenarioExecutionContract.js';
import { validateRoleplayRepTurn } from '../src/lib/roleplay/roleplayTurnValidation.js';

const workflowScenario = {
  id: 'workflow_ci_smoke',
  title: 'Workflow Optimization Smoke',
  description: 'A time-pressured clinician needs a practical clinic-flow recommendation.',
  objective: 'Define one practical workflow step and owner.',
  stakeholder: 'Michael Chen, PA-C',
  specialty: 'Academic HIV Center',
  openingScene: "Michael taps a follow-up list on the desk. 'What is the first practical workflow step here?'",
  challenges: ['Competing clinical priorities', 'Workflow uncertainty'],
};

const evidenceScenario = {
  id: 'evidence_ci_smoke',
  title: 'Evidence Translation Smoke',
  description: 'A committee member asks what proof point changes the decision.',
  objective: 'Connect evidence to the formulary decision.',
  stakeholder: 'Hospital P&T Committee',
  specialty: 'Formulary Review',
  openingScene: "The committee chair looks up. 'What proof point changes the decision?'",
  challenges: ['Budget pressure', 'Evidence scrutiny'],
};

test('conversation intelligence classifies non-adaptive repetition without owning validation', () => {
  const repeatedOpener = "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.";
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'What is the first practical workflow step here?',
    repMessage: repeatedOpener,
    previousRepMessages: [],
    allPreviousRepMessages: [repeatedOpener],
    previousHcpAsks: ['What proof point changes the decision for stable HIV patients?'],
  });
  const contract = buildRoleplayScenarioExecutionContract(workflowScenario);
  const intelligence = deriveConversationIntelligenceState({
    scenarioExecutionContract: contract,
    latestHcpAsk: 'What is the first practical workflow step here?',
    repMessage: repeatedOpener,
    validationOutput: validation,
    turnNumber: 2,
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.softInvalid, true);
  assert.equal(intelligence.turnInterpretation.valid, 'softInvalid');
  assert.equal(intelligence.turnInterpretation.progression, 'non_adaptive');
  assert.equal(intelligence.adaptationSignals.repeated_without_adapting, true);
  assert.equal(intelligence.capabilityMapping.primaryCapability, 'adaptive_response');
  assert.equal(intelligence.coachingPriority.issue, 'adaptation');
  assert.equal(intelligence.coachingMessage.label, "Adapt to the HCP's response");
  assert.equal(intelligence.reliability.band, 'high');
});

test('conversation intelligence marks concrete workflow answer as progress', () => {
  const repMessage = 'Start a nurse-owned checklist this week so the team reviews stable patients before the refill window.';
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'What is the first practical workflow step here?',
    repMessage,
    previousRepMessages: [],
  });
  const intelligence = deriveConversationIntelligenceState({
    scenarioExecutionContract: buildRoleplayScenarioExecutionContract(workflowScenario),
    latestHcpAsk: 'What is the first practical workflow step here?',
    repMessage,
    validationOutput: validation,
    turnNumber: 1,
  });

  assert.equal(validation.valid, true);
  assert.equal(intelligence.turnInterpretation.progression, 'progress');
  assert.equal(intelligence.turnInterpretation.concernFamily, 'workflow');
  assert.equal(intelligence.adaptationSignals.addressed_active_ask, true);
  assert.equal(intelligence.adaptationSignals.answered_concretely, true);
  assert.equal(intelligence.communicationQualities.practicality, 'high');
  assert.equal(intelligence.capabilityMapping.capabilitySignals.conversation_management, 'strength');
  assert.equal(intelligence.coachingPriority.shouldShow, false);
});

test('conversation intelligence does not let an evidence opening contract override a live workflow ask', () => {
  const repMessage = 'Start a nurse-owned checklist this week so stable patients are reviewed before the refill window.';
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'What is the first practical workflow step here?',
    repMessage,
    previousRepMessages: [],
  });
  const mixedContract = buildRoleplayScenarioExecutionContract(evidenceScenario);
  const intelligence = deriveConversationIntelligenceState({
    scenarioExecutionContract: mixedContract,
    latestHcpAsk: 'What is the first practical workflow step here?',
    repMessage,
    validationOutput: validation,
    turnNumber: 3,
  });

  assert.equal(mixedContract.activeAsk.concernFamily, 'evidence');
  assert.equal(validation.latestAskProgression.status, 'workflow_progress');
  assert.equal(intelligence.turnInterpretation.concernFamily, 'workflow');
  assert.equal(intelligence.communicationQualities.practicality, 'high');
  assert.equal(intelligence.coachingPriority.shouldShow, false);
  assert.equal(intelligence.capabilityMapping.primaryCapability, 'conversation_management');
});

test('conversation intelligence treats relevant check-backs as progress without over-coaching', () => {
  const repMessage = 'Understood — before we go further, what matters most in your decision here: durability, workflow burden, or access?';
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'We are seeing patients on day 4 or 5, and it is almost too late for antivirals. What is one practical workflow step we can use without adding burden?',
    repMessage,
    previousRepMessages: [],
  });
  const intelligence = deriveConversationIntelligenceState({
    scenarioExecutionContract: buildRoleplayScenarioExecutionContract(workflowScenario),
    latestHcpAsk: 'We are seeing patients on day 4 or 5, and it is almost too late for antivirals. What is one practical workflow step we can use without adding burden?',
    repMessage,
    validationOutput: validation,
    turnNumber: 1,
  });

  assert.equal(validation.softInvalid, false);
  assert.equal(validation.latestAskProgression.status, 'workflow_clarification');
  assert.equal(intelligence.turnInterpretation.progression, 'progress');
  assert.equal(intelligence.adaptationSignals.clarified_before_advancing, true);
  assert.equal(intelligence.coachingPriority.shouldShow, false);
});

test('conversation intelligence identifies evidence setup without decision linkage', () => {
  const repMessage = 'The outcomes data are strong and I wanted to follow up on what we reviewed last week.';
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'What proof point changes the decision?',
    repMessage,
    previousRepMessages: [],
  });
  const intelligence = deriveConversationIntelligenceState({
    scenarioExecutionContract: buildRoleplayScenarioExecutionContract(evidenceScenario),
    latestHcpAsk: 'What proof point changes the decision?',
    repMessage,
    validationOutput: validation,
    turnNumber: 1,
  });

  assert.equal(validation.softInvalid, true);
  assert.equal(intelligence.turnInterpretation.progression, 'stalled');
  assert.equal(intelligence.turnInterpretation.concernFamily, 'evidence');
  assert.equal(intelligence.communicationQualities.evidence_linkage, 'moderate');
  assert.equal(intelligence.adaptationSignals.addressed_active_ask, false);
  assert.equal(intelligence.coachingPriority.issue, 'evidence_translation');
  assert.equal(intelligence.capabilityMapping.primaryCapability, 'value_connection');
});

test('conversation intelligence labels canned but professional missed openers as adaptation gaps', () => {
  const repMessage = "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.";
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'What is one practical workflow step we can use without adding burden?',
    repMessage,
    previousRepMessages: [],
  });
  const intelligence = deriveConversationIntelligenceState({
    scenarioExecutionContract: buildRoleplayScenarioExecutionContract(workflowScenario),
    latestHcpAsk: 'What is one practical workflow step we can use without adding burden?',
    repMessage,
    validationOutput: validation,
    turnNumber: 1,
  });

  assert.equal(validation.softInvalid, true);
  assert.equal(intelligence.adaptationSignals.stayed_in_setup_language, true);
  assert.equal(intelligence.coachingPriority.issue, 'adaptation');
  assert.equal(intelligence.coachingPriority.capability, 'adaptive_response');
  assert.match(intelligence.coachingPriority.nextAction, /workflow step/i);
});

test('conversation intelligence prioritizes the current live HCP ask over broader scenario contract family', () => {
  const repMessage = "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.";
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'What proof point changes the decision for my stable HIV patients?',
    repMessage,
    previousRepMessages: [],
  });
  const contract = buildRoleplayScenarioExecutionContract({
    id: 'mixed_contract_family',
    title: 'Mixed Scenario Family',
    description: 'A workflow-heavy scenario later narrows to an evidence decision.',
    openingScene: "Michael asks for one workflow step.",
    challenges: ['Workflow burden', 'Competing clinical priorities'],
  });
  const intelligence = deriveConversationIntelligenceState({
    scenarioExecutionContract: contract,
    latestHcpAsk: 'What proof point changes the decision for my stable HIV patients?',
    repMessage,
    validationOutput: validation,
    turnNumber: 2,
  });

  assert.equal(contract.activeAsk.concernFamily, 'workflow');
  assert.equal(intelligence.turnInterpretation.concernFamily, 'evidence');
  assert.equal(intelligence.coachingPriority.capability, 'adaptive_response');
});

test('conversation intelligence detects clarifying moves as structured adaptation signals', () => {
  const repMessage = 'To make sure I answer the right question, are you asking which durability endpoint matters most for your decision?';
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'What proof point changes the decision?',
    repMessage,
    previousRepMessages: [],
  });
  const intelligence = deriveConversationIntelligenceState({
    scenarioExecutionContract: buildRoleplayScenarioExecutionContract(evidenceScenario),
    latestHcpAsk: 'What proof point changes the decision?',
    repMessage,
    validationOutput: validation,
    turnNumber: 1,
  });

  assert.equal(intelligence.adaptationSignals.clarified_before_advancing, true);
  assert.equal(intelligence.adaptationSignals.repeated_without_adapting, false);
  assert.equal(intelligence.communicationQualities.tone_alignment, 'moderate');
  assert.ok(['moderate', 'high'].includes(intelligence.reliability.band));
});

test('conversation intelligence telemetry is structured and transcript-safe', () => {
  const repMessage = 'Start a nurse-owned checklist this week.';
  const validation = validateRoleplayRepTurn({
    latestHcpAsk: 'What is the first practical workflow step here?',
    repMessage,
    previousRepMessages: [],
  });
  const intelligence = deriveConversationIntelligenceState({
    scenarioExecutionContract: buildRoleplayScenarioExecutionContract(workflowScenario),
    latestHcpAsk: 'What is the first practical workflow step here?',
    repMessage,
    validationOutput: validation,
    turnNumber: 1,
  });
  const event = buildConversationIntelligenceTelemetryEvent(intelligence, {
    entryPoint: 'test',
    scenarioId: 'workflow_ci_smoke',
    sessionId: 'session_123',
  });

  assert.equal(event.eventType, 'conversation_intelligence_derived');
  assert.equal(event.payload.primaryCapability, intelligence.capabilityMapping.primaryCapability);
  assert.equal(event.payload.scenarioId, 'workflow_ci_smoke');
  assert.doesNotMatch(JSON.stringify(event), /nurse-owned checklist/i);
  assert.doesNotMatch(JSON.stringify(event), /first practical workflow step/i);
});
