import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRoleplayScenarioExecutionContract,
  validateRoleplayScenarioExecutionContract,
} from '../src/lib/roleplay/scenarioExecutionContract.js';

const continuityScenario = {
  id: 'card-formulary',
  title: 'Cardiology Formulary Review',
  description: 'Present to the P&T committee for formulary inclusion',
  category: 'Cardiology',
  specialty: 'Cardiology',
  hcp_category: 'Non-Prescribing Influencer',
  influence_driver: 'Evidence-Based',
  stakeholder: 'Hospital P&T Committee - 8 members including pharmacists, physicians, and administrators',
  difficulty: 'advanced',
  objective: 'Gain preferred formulary status for your heart failure medication',
  context: 'The hospital is cost-conscious but values clinical outcomes.',
  openingScene: "The P&T committee members are reviewing budget reports. The pharmacy director looks up. 'We have three formulary requests today. You have 20 minutes.'",
  hcpMood: 'cost-conscious, analytical',
  challenges: ['Price premium over existing options', 'Need pharmacoeconomic justification'],
  keyMessages: ['Reduction in hospitalizations', 'Total cost of care savings'],
};

test('scenario execution contract derives deterministic Manager-View-style state from existing scenario fields', () => {
  const contract = buildRoleplayScenarioExecutionContract(continuityScenario);
  const validation = validateRoleplayScenarioExecutionContract(contract);

  assert.equal(validation.valid, true);
  assert.equal(contract.scenarioIdentity.scenarioId, 'card-formulary');
  assert.equal(contract.managerIntegration.scenarioFamily, 'cardiology_gdmt');
  assert.equal(contract.hcpPersona.personaPrimary, 'administrator_economic_buyer');
  assert.equal(contract.openingState.primaryConcernFamily, 'evidence');
  assert.equal(contract.activeAsk.concernFamily, 'evidence');
  assert.equal(contract.repEvaluationTargets.firstTurnMustAddress, 'opening_context_or_plausible_continuity');
});

test('scenario execution contract promotes narrative actionable asks over opening dialogue', () => {
  const contract = buildRoleplayScenarioExecutionContract({
    id: 'covid_workflow_timing',
    title: 'COVID Antiviral Workflow Timing',
    category: 'COVID-19',
    specialty: 'Family Medicine',
    stakeholder: 'Maria Lopez, NP - Primary Care Clinic',
    context: 'Clinic wants antiviral eligibility handled earlier without adding staff burden.',
    openingScene: "Maria points to a clinic workflow map and asks for one concrete step that will not add burden. 'We're seeing too many patients on day 4 or 5. By then, it's almost too late for antivirals.'",
    challenges: ['Late patient callbacks', 'Workflow burden', 'Antiviral timing window'],
    keyMessages: ['Triage callback checklist', 'Earlier eligibility screening'],
  });

  assert.equal(contract.activeAsk.source, 'narrative_context');
  assert.match(contract.activeAsk.askText, /one concrete step/i);
  assert.equal(contract.activeAsk.concernFamily, 'workflow');
  assert.equal(contract.openingState.askStrength, 'hard_explicit_ask');
  assert.equal(contract.repEvaluationTargets.firstTurnMustAddress, 'active_opening_ask');
});

test('scenario execution contract is deterministic for repeated construction', () => {
  const first = buildRoleplayScenarioExecutionContract(continuityScenario);
  const second = buildRoleplayScenarioExecutionContract(continuityScenario);

  assert.deepEqual(first, second);
});
