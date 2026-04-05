import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateScenarioDomainIntegrity,
  buildRequiredDomainReanchorStatement,
  enforceDomainReanchorInDialogue,
} from '../src/components/roleplay/scenarioDomainIntegrity.js';

test('cross-domain contamination deterministically requires explicit re-anchor statement', () => {
  const domainAssessment = evaluateScenarioDomainIntegrity({
    scenario: {
      domainIntegrity: {
        primaryScenarioDomain: 'oncology',
        allowedDomains: ['oncology', 'operational_workflow'],
        allowedContextFamilies: ['operational_workflow', 'evidence_review'],
        disallowedCrossDomainFamilies: ['hiv'],
      },
    },
    activeConcern: 'workflow',
    cueText: 'The HCP asks about oncology workflow.',
    dialogueText: 'What changes in oncology workflow this week?',
    repMessage: 'For HIV cabotegravir screening, I would prioritize resistance profiling first.',
  });

  assert.equal(domainAssessment.contextContamination, true);
  assert.equal(domainAssessment.repDomainStatus, 'cross_domain_contamination');

  const statement = buildRequiredDomainReanchorStatement({ domainAssessment, activeConcern: 'workflow' });
  assert.match(statement.toLowerCase(), /not the context i am asking about/);
  assert.match(statement.toLowerCase(), /stay focused on oncology/);

  const enforced = enforceDomainReanchorInDialogue({
    dialogueText: 'I still need one practical workflow answer.',
    domainAssessment,
    activeConcern: 'workflow',
  });

  assert.match(enforced.toLowerCase(), /not the context i am asking about/);
  assert.match(enforced.toLowerCase(), /i am asking about workflow, not hiv/);
});

test('in-domain responses do not inject forced re-anchor text', () => {
  const domainAssessment = evaluateScenarioDomainIntegrity({
    scenario: {
      domainIntegrity: {
        primaryScenarioDomain: 'oncology',
        allowedDomains: ['oncology', 'operational_workflow'],
        allowedContextFamilies: ['operational_workflow'],
        disallowedCrossDomainFamilies: ['hiv'],
      },
    },
    activeConcern: 'workflow',
    cueText: 'The HCP asks about infusion staffing.',
    dialogueText: 'What changes in oncology workflow this week?',
    repMessage: 'In oncology infusion workflow, one staffing huddle can reduce delays.',
  });

  const enforced = enforceDomainReanchorInDialogue({
    dialogueText: 'I still need one practical workflow answer.',
    domainAssessment,
    activeConcern: 'workflow',
  });

  assert.equal(domainAssessment.contextContamination, false);
  assert.equal(enforced, 'I still need one practical workflow answer.');
});
