import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  OPERATIONAL_CONSTRAINT_TYPES,
  buildConstraintGrounding,
  detectConstraintDraftViolations,
  selectLateTurnConstraintResponseMode,
  buildLateTurnConstraintResponse,
  buildConstraintSafeRegeneratedResponse,
} from '../src/components/roleplay/operationalConstraintGuardrails.js';

test('no scenario constraint present -> no staffing/workflow injection allowed', () => {
  const grounding = buildConstraintGrounding({
    scenarioText: 'Discuss phase 3 efficacy and safety outcomes.',
    dialogueTurns: ['Can you explain the endpoint hierarchy?'],
  });

  const result = detectConstraintDraftViolations({
    draftText: 'We are short-staffed so this is hard to adopt.',
    groundedTypes: [...grounding.groundedTypes],
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.ungroundedTypes, ['staffing']);
});

test('scenario constraint present -> mention allowed once only', () => {
  const grounding = buildConstraintGrounding({
    scenarioText: 'Clinic workflow is currently constrained by referral routing.',
    dialogueTurns: [],
  });

  const firstMention = detectConstraintDraftViolations({
    draftText: 'The workflow constraint is still my main concern.',
    groundedTypes: [...grounding.groundedTypes],
    alreadySurfacedTypes: [],
  });

  assert.equal(firstMention.valid, true);

  const secondMention = detectConstraintDraftViolations({
    draftText: 'I still need this to fit into workflow.',
    groundedTypes: [...grounding.groundedTypes],
    alreadySurfacedTypes: ['workflow'],
  });

  assert.equal(secondMention.valid, false);
  assert.deepEqual(secondMention.duplicateTypes, ['workflow']);
});

test('repeated paraphrase of same known constraint -> blocked', () => {
  const result = detectConstraintDraftViolations({
    draftText: 'Bandwidth is limited, so this still feels burdensome.',
    groundedTypes: ['capacity'],
    alreadySurfacedTypes: ['capacity'],
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.duplicateTypes, ['capacity']);
});

test('explicit user revisit request -> allowed reference', () => {
  const result = detectConstraintDraftViolations({
    draftText: 'On workflow, the process still looks unclear.',
    groundedTypes: ['workflow'],
    alreadySurfacedTypes: ['workflow'],
    revisitRequested: true,
  });

  assert.equal(result.valid, true);
});

test('changed constraint -> allowed updated mention', () => {
  const result = detectConstraintDraftViolations({
    draftText: 'Scheduling is the blocker right now.',
    groundedTypes: ['workflow', 'scheduling'],
    alreadySurfacedTypes: ['workflow'],
    newlyRaisedTypes: ['scheduling'],
    changedConstraint: true,
  });

  assert.equal(result.valid, true);
});

test('late-turn missed requirement -> constrained restate then escalation without objection broadening', () => {
  const firstDecision = selectLateTurnConstraintResponseMode({
    hasActiveConstraint: true,
    hasActiveRequirement: true,
    inLateTurnState: true,
    requirementAddressed: false,
    boundaryLevel: 'constrained',
    requirementRestatedCount: 0,
  });

  assert.equal(firstDecision.forced, true);
  assert.equal(firstDecision.mode, 'restate_once');

  const firstReply = buildLateTurnConstraintResponse({
    concern: 'evidence',
    mode: firstDecision.mode,
    includeConstraintSignal: true,
  });
  const firstSentenceCount = (firstReply.match(/[.!?]+/g) || []).length;
  assert.ok(firstSentenceCount >= 1 && firstSentenceCount <= 2);
  assert.match(firstReply, /time constraint|stay focused/i);
  assert.match(firstReply, /clinically meaningful evidence/i);
  assert.doesNotMatch(firstReply, /new concern|different issue|let.?s debate/i);

  const secondDecision = selectLateTurnConstraintResponseMode({
    hasActiveConstraint: true,
    hasActiveRequirement: true,
    inLateTurnState: true,
    requirementAddressed: false,
    boundaryLevel: firstDecision.nextBoundaryLevel,
    requirementRestatedCount: firstDecision.nextRequirementRestatedCount,
  });
  assert.equal(secondDecision.forced, true);
  assert.ok(secondDecision.mode === 'boundary' || secondDecision.mode === 'close');
});

test('late-turn addressed requirement concisely -> no forced closure path', () => {
  const decision = selectLateTurnConstraintResponseMode({
    hasActiveConstraint: true,
    hasActiveRequirement: true,
    inLateTurnState: true,
    requirementAddressed: true,
    boundaryLevel: 'constrained',
    requirementRestatedCount: 1,
  });

  assert.equal(decision.forced, false);
  assert.equal(decision.mode, null);
  assert.equal(decision.nextBoundaryLevel, 'constrained');
  assert.equal(decision.nextRequirementRestatedCount, 1);
});

test('stale-request guard prevents late-turn state mutation from older request', () => {
  const rolePlayChatSource = fs.readFileSync(
    new URL('../src/components/roleplay/RolePlayChat.jsx', import.meta.url),
    'utf8',
  );

  const assignmentIndex = rolePlayChatSource.indexOf('lateTurnConstraintStateRef.current = nextLateTurnConstraintState;');
  const staleGuardIndex = rolePlayChatSource.indexOf(
    'if (requestId !== activeRequestIdRef.current || !sessionControllerRef.current.isActive) {',
  );
  assert.ok(staleGuardIndex !== -1 && assignmentIndex !== -1, 'expected stale guard and late-turn state assignment');
  assert.ok(staleGuardIndex < assignmentIndex, 'stale guard should run before late-turn state mutation');

  const commitIfActive = ({ requestId, activeRequestId, sessionActive, nextState, currentState }) => {
    if (requestId !== activeRequestId || !sessionActive) {
      return currentState;
    }
    return nextState;
  };

  const initialState = {
    activeConstraint: null,
    activeRequirement: null,
    boundaryLevel: 'normal',
    requirementRestatedCount: 0,
  };
  const stateFromTurnA = {
    activeConstraint: 'time',
    activeRequirement: 'evidence',
    boundaryLevel: 'constrained',
    requirementRestatedCount: 1,
  };
  const stateFromTurnB = {
    activeConstraint: 'workflow',
    activeRequirement: 'workflow',
    boundaryLevel: 'closing',
    requirementRestatedCount: 2,
  };

  let activeRequestId = 2; // Turn B has superseded turn A.
  let lateTurnState = initialState;

  // Turn A resolves late -> must not mutate.
  lateTurnState = commitIfActive({
    requestId: 1,
    activeRequestId,
    sessionActive: true,
    nextState: stateFromTurnA,
    currentState: lateTurnState,
  });
  assert.deepEqual(lateTurnState, initialState);

  // Turn B resolves with current request id -> should mutate.
  lateTurnState = commitIfActive({
    requestId: 2,
    activeRequestId,
    sessionActive: true,
    nextState: stateFromTurnB,
    currentState: lateTurnState,
  });
  assert.deepEqual(lateTurnState, stateFromTurnB);

  // Session deactivated -> no further mutation.
  activeRequestId = 3;
  lateTurnState = commitIfActive({
    requestId: 3,
    activeRequestId,
    sessionActive: false,
    nextState: stateFromTurnA,
    currentState: lateTurnState,
  });
  assert.deepEqual(lateTurnState, stateFromTurnB);
});

test('7-scenario fallback fixture: guardrail regeneration stays context-aware and avoids generic collapse', () => {
  const fixtures = [
    { scenarioId: 'hiv_prevention_gap', concern: 'access' },
    { scenarioId: 'prep_access_barriers', concern: 'prior_auth' },
    { scenarioId: 'treatment_optimization_stable_hiv', concern: 'monitoring' },
    { scenarioId: 'cabotegravir_interest_without_screening', concern: 'screening' },
    { scenarioId: 'adc_integration_io_backbone', concern: 'access' },
    { scenarioId: 'pathway_driven_staffing_constraints', concern: 'staffing' },
    { scenarioId: 'oral_oncolytic_onboarding', concern: 'workflow' },
  ];

  const genericLegacyLine = 'Help me understand the most clinically relevant takeaway for my patients.';
  const outputs = fixtures.map((fixture) => {
    const result = buildConstraintSafeRegeneratedResponse({
      fallbackResponse: 'workflow and staffing constraints remain unresolved.',
      concern: fixture.concern,
    });
    return { ...fixture, result };
  });

  outputs.forEach(({ scenarioId, result }) => {
    assert.ok(result && result.length > 12, `expected non-empty fallback for ${scenarioId}`);
    assert.notEqual(result, genericLegacyLine, `should not collapse to legacy generic line for ${scenarioId}`);
  });

  const uniqueOutputs = new Set(outputs.map((item) => item.result));
  assert.ok(uniqueOutputs.size >= 5, 'expected diverse concern-aware fallback outputs across 7 fixtures');
});

test('warmth option prepends HCP-side warm opener while preserving scenario-context pivot', () => {
  const result = buildConstraintSafeRegeneratedResponse({
    concern: 'unknown_concern',
    includeWarmth: true,
    scenarioContext: 'CAB screening and candidacy criteria remain unclear.',
  });

  assert.match(result, /^Good to see you\./);
  assert.match(result, /patient-selection criteria/i);
});

test('global context-aware coverage: every operational constraint type resolves via scenario context without generic collapse', () => {
  const genericLegacyLine = 'Help me understand the most clinically relevant takeaway for my patients.';
  const outputs = OPERATIONAL_CONSTRAINT_TYPES.map((concern) => ({
    concern,
    result: buildConstraintSafeRegeneratedResponse({
      concern,
      scenarioContext: `Scenario context mentions ${concern} constraints in clinic operations.`,
    }),
  }));

  outputs.forEach(({ concern, result }) => {
    assert.ok(result && result.length > 12, `expected non-empty context-aware fallback for constraint ${concern}`);
    assert.notEqual(result, genericLegacyLine, `should not collapse to legacy generic line for constraint ${concern}`);
  });
});
