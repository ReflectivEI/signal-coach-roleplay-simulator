import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCanonicalScenarioSpec,
  validateCanonicalScenarioSpec,
} from '../src/lib/roleplay-v2/scenarioCanonicalContract.js';

test('canonical scenario spec validates with deterministic enums and ordered sections', () => {
  const spec = createCanonicalScenarioSpec();
  const result = validateCanonicalScenarioSpec(spec);
  assert.equal(result.valid, true, result.issues.join('; '));
});

test('validator rejects invalid enum and missing section', () => {
  const spec = createCanonicalScenarioSpec({
    trainingIntent: {
      metricApplicability: { question_quality: 'sometimes' },
    },
  });
  delete spec.feedbackContract;
  const result = validateCanonicalScenarioSpec(spec);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.includes('invalid metric applicability')));
  assert.ok(result.issues.some((issue) => issue.includes('missing section: feedbackContract')));
});

test('validator accepts enforcement criteria ranges and rejects out-of-range modifiers', () => {
  const validSpec = createCanonicalScenarioSpec({
    enforcementCriteria: {
      baselineForgiveness: 0.55,
      baselinePrecisionDemand: 0.7,
      baselineEvidenceStrictness: 0.72,
      baselineWorkflowStrictness: 0.6,
      baselineEscalationSensitivity: 0.65,
      timePressureEscalationModifier: 0.3,
      engagementSlackModifier: 0.2,
      skepticismEscalationModifier: 0.25,
    },
  });

  const validResult = validateCanonicalScenarioSpec(validSpec);
  assert.equal(validResult.valid, true, validResult.issues.join('; '));

  const invalidSpec = createCanonicalScenarioSpec({
    sceneSetup: {
      ...createCanonicalScenarioSpec().sceneSetup,
      enforcementCriteria: {
        timePressureEscalationModifier: 1.5,
      },
    },
  });
  const invalidResult = validateCanonicalScenarioSpec(invalidSpec);
  assert.equal(invalidResult.valid, false);
  assert.ok(invalidResult.issues.some((issue) => issue.includes('sceneSetup.enforcementCriteria.timePressureEscalationModifier')));
});

test('validator accepts domain integrity policy and rejects malformed domain arrays', () => {
  const validSpec = createCanonicalScenarioSpec({
    domainIntegrity: {
      primaryScenarioDomain: 'oncology',
      allowedDomains: ['oncology', 'operational_workflow'],
      allowedContextFamilies: ['operational_workflow', 'evidence_review'],
      disallowedCrossDomainFamilies: ['hiv', 'cardiology'],
    },
  });
  const validResult = validateCanonicalScenarioSpec(validSpec);
  assert.equal(validResult.valid, true, validResult.issues.join('; '));

  const invalidSpec = createCanonicalScenarioSpec({
    hcpProfile: {
      ...createCanonicalScenarioSpec().hcpProfile,
      domainIntegrity: {
        allowedDomains: ['oncology', ''],
      },
    },
  });
  const invalidResult = validateCanonicalScenarioSpec(invalidSpec);
  assert.equal(invalidResult.valid, false);
  assert.ok(invalidResult.issues.some((issue) => issue.includes('hcpProfile.domainIntegrity.allowedDomains')));
});
