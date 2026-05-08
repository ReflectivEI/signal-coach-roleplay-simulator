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
  detectRepClarificationRequest,
  detectUnsupportedScenarioFactIntroduction,
  buildScenarioFactSafeClarification,
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

test('scenario-specific implementation terms are treated as workflow grounding', () => {
  const grounding = buildConstraintGrounding({
    scenarioText: 'Staffing limitations for AE management. Need standardized NP-led education and toxicity call-tree within pathway workflow.',
    dialogueTurns: [],
  });

  assert.ok(grounding.groundedTypes.has('workflow'));

  const result = detectConstraintDraftViolations({
    draftText: 'Standardize patient education and implement toxicity monitoring with an AE one-pager and call-tree.',
    groundedTypes: [...grounding.groundedTypes],
    alreadySurfacedTypes: [],
  });

  assert.equal(result.valid, true);
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
  assert.match(firstReply, /time constraint|limited time window|time is limited|stay focused/i);
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


test('late-turn guardrails vary by deterministic progression stage', () => {
  const closeA = buildLateTurnConstraintResponse({
    concern: 'evidence',
    mode: 'close',
    includeConstraintSignal: true,
    seed: 'turn-sequence',
    progressionStage: 1,
  });

  const closeB = buildLateTurnConstraintResponse({
    concern: 'evidence',
    mode: 'close',
    includeConstraintSignal: true,
    seed: 'turn-sequence',
    progressionStage: 2,
  });

  assert.notEqual(closeA, closeB);
  assert.match(closeA, /evidence relevant to my practice/i);
  assert.match(closeB, /pause|revisit/i);
});

test('late-turn close output is deterministic for identical seed + stage', () => {
  const closeA = buildLateTurnConstraintResponse({
    concern: 'evidence',
    mode: 'close',
    includeConstraintSignal: true,
    seed: 'deterministic-check',
    progressionStage: 2,
  });
  const closeB = buildLateTurnConstraintResponse({
    concern: 'evidence',
    mode: 'close',
    includeConstraintSignal: true,
    seed: 'deterministic-check',
    progressionStage: 2,
  });

  assert.equal(closeA, closeB);
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

test('engaged evidence-seeking request holds late-turn policy at boundary instead of close', () => {
  const decision = selectLateTurnConstraintResponseMode({
    hasActiveConstraint: true,
    hasActiveRequirement: true,
    inLateTurnState: true,
    requirementAddressed: false,
    boundaryLevel: 'closing',
    requirementRestatedCount: 2,
    holdAtBoundary: true,
  });

  assert.equal(decision.forced, true);
  assert.equal(decision.mode, 'boundary');
  assert.equal(decision.nextBoundaryLevel, 'constrained');
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

test('opening fallback only says "thanks for asking" when rep asked wellbeing', () => {
  const rolePlayChatSource = fs.readFileSync(
    new URL('../src/components/roleplay/RolePlayChat.jsx', import.meta.url),
    'utf8',
  );

  assert.match(
    rolePlayChatSource,
    /const wellbeingCheckSignals = .*how are you.*how was your weekend/s,
    'expected explicit wellbeing-check detector for opening turns',
  );

  assert.match(
    rolePlayChatSource,
    /repAskedWellbeing \? "I'm doing well, thanks for asking\." : ""/,
    'expected opening fallback to avoid social-assumption text when wellbeing was not asked',
  );
});

test('late-turn close loop breaker forces terminal disengage in sustained closing boundary', () => {
  const rolePlayChatSource = fs.readFileSync(
    new URL('../src/components/roleplay/RolePlayChat.jsx', import.meta.url),
    'utf8',
  );

  assert.match(rolePlayChatSource, /lateTurnConstraintDecision\.mode === "close"/);
  assert.match(rolePlayChatSource, /priorLateTurnConstraintState\.boundaryLevel === "closing"/);
  assert.match(rolePlayChatSource, /nextHcpState = "disengaged";/);
});

test('global anti-repeat path uses AI regeneration before deterministic fallback', () => {
  const rolePlayChatSource = fs.readFileSync(
    new URL('../src/components/roleplay/RolePlayChat.jsx', import.meta.url),
    'utf8',
  );

  assert.match(rolePlayChatSource, /Rewrite the HCP line to avoid repeated phrasing while keeping meaning consistent/);
  assert.ok(rolePlayChatSource.includes("fetch('/api/llm/invoke'"));
  assert.match(rolePlayChatSource, /ROLEPLAY_ANTI_REPEAT_REGEN_FAILED/);
});

test('fallback recovery path attempts AI-driven continuity before deterministic template fallback', () => {
  const rolePlayChatSource = fs.readFileSync(
    new URL('../src/components/roleplay/RolePlayChat.jsx', import.meta.url),
    'utf8',
  );

  assert.match(rolePlayChatSource, /usedDeterministicFallback && !forceTerminalDisengagement/);
  assert.match(rolePlayChatSource, /Respond directly to the rep's last message/);
  assert.match(rolePlayChatSource, /Do not drift to unrelated topics/);
  assert.match(rolePlayChatSource, /ROLEPLAY_AI_FALLBACK_RECOVERY_FAILED/);
});

test('continuity repair enforces strict rep-to-hcp topical response before finalizing dialogue', () => {
  const rolePlayChatSource = fs.readFileSync(
    new URL('../src/components/roleplay/RolePlayChat.jsx', import.meta.url),
    'utf8',
  );

  assert.match(rolePlayChatSource, /function evaluateRepToHcpContinuity/);
  assert.match(rolePlayChatSource, /continuity\.needsRepair/);
  assert.match(rolePlayChatSource, /If rep addressed an evidence\/study question, react to that directly before redirecting/);
  assert.match(rolePlayChatSource, /ROLEPLAY_CONTINUITY_REPAIR_FAILED/);
});

test('single rewrite authority enforces anti-repeat or continuity repair per turn', () => {
  const rolePlayChatSource = fs.readFileSync(
    new URL('../src/components/roleplay/RolePlayChat.jsx', import.meta.url),
    'utf8',
  );

  assert.match(rolePlayChatSource, /const rewriteAuthority =/);
  assert.match(rolePlayChatSource, /repetitiveCandidate \? "anti_repeat" : continuity\.needsRepair \? "continuity_repair" : "none"/);
  assert.match(rolePlayChatSource, /if \(rewriteAuthority === "anti_repeat"\)/);
  assert.match(rolePlayChatSource, /else if \(rewriteAuthority === "continuity_repair"\)/);
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

  const retiredGenericLine = 'Help me understand the most clinically relevant takeaway for my patients.';
  const outputs = fixtures.map((fixture) => {
    const result = buildConstraintSafeRegeneratedResponse({
      fallbackResponse: 'workflow and staffing constraints remain unresolved.',
      concern: fixture.concern,
    });
    return { ...fixture, result };
  });

  outputs.forEach(({ scenarioId, result }) => {
    assert.ok(result && result.length > 12, `expected non-empty fallback for ${scenarioId}`);
    assert.notEqual(result, retiredGenericLine, `should not collapse to retired generic line for ${scenarioId}`);
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
  const retiredGenericLine = 'Help me understand the most clinically relevant takeaway for my patients.';
  const outputs = OPERATIONAL_CONSTRAINT_TYPES.map((concern) => ({
    concern,
    result: buildConstraintSafeRegeneratedResponse({
      concern,
      scenarioContext: `Scenario context mentions ${concern} constraints in clinic operations.`,
    }),
  }));

  outputs.forEach(({ concern, result }) => {
    assert.ok(result && result.length > 12, `expected non-empty context-aware fallback for constraint ${concern}`);
    assert.notEqual(result, retiredGenericLine, `should not collapse to retired generic line for constraint ${concern}`);
  });
});

test('opening turn does not get overridden by late-turn constraint draft guardrail', () => {
  const rolePlayChatSource = fs.readFileSync(
    new URL('../src/components/roleplay/RolePlayChat.jsx', import.meta.url),
    'utf8',
  );

  assert.match(
    rolePlayChatSource,
    /const shouldApplyConstraintDraftGuardrail = respondingToTurn\?\.turnNumber > 0;/,
  );
});

test('hidden scenario authoring facts cannot leak into later HCP dialogue before they are visible', () => {
  const result = detectUnsupportedScenarioFactIntroduction({
    scenarioContext: 'The condition affects 1 in 50,000 patients. Average time to diagnosis is 5 years.',
    visibleContext: 'The HCP said the diagnosis remains elusive. The rep asked for clarification.',
    draftText: 'Average time to diagnosis is 5 years, so I need you to address urgency.',
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.introducedAnchors, ['5 years']);
  assert.equal(result.rejectionReason, 'unsupported_scenario_fact_introduction');
});

test('scenario fact guard allows facts already visible in the conversation', () => {
  const result = detectUnsupportedScenarioFactIntroduction({
    scenarioContext: 'The condition affects 1 in 50,000 patients. Average time to diagnosis is 5 years.',
    visibleContext: 'The HCP already said average time to diagnosis is 5 years.',
    draftText: 'The 5 years point is why I need the workflow to be specific.',
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.introducedAnchors, []);
});

test('rep clarification detection is behavioral and not tied to one scenario phrase', () => {
  assert.equal(detectRepClarificationRequest('Elusive how?'), true);
  assert.equal(detectRepClarificationRequest('What are you talking about?'), true);
  assert.equal(detectRepClarificationRequest('Can we discuss the workup and academic skepticism?'), false);
});

test('clarification fallback references visible prior HCP thread instead of hidden authoring facts', () => {
  const result = buildScenarioFactSafeClarification({
    previousHcpLine: "I've seen a few patients with similar presentations, but the diagnosis remains elusive. What brings you here?",
    activeConcern: 'workflow',
  });

  assert.match(result, /clinical picture|diagnostic workup/i);
  assert.doesNotMatch(result, /5 years|1 in 50,000/i);
});

test('live repair prompts use visible scenario grounding instead of full authoring context', () => {
  const rolePlayChatSource = fs.readFileSync(
    new URL('../src/components/roleplay/RolePlayChat.jsx', import.meta.url),
    'utf8',
  );

  assert.match(rolePlayChatSource, /const visibleScenarioGroundingText = \[/);
  assert.match(rolePlayChatSource, /const hiddenAuthoringContextText = \[/);
  assert.match(rolePlayChatSource, /Visible scenario grounding: \$\{visibleScenarioGroundingText\}/);
  assert.match(rolePlayChatSource, /detectUnsupportedScenarioFactIntroduction/);
  assert.match(rolePlayChatSource, /ROLEPLAY_HIDDEN_FACT_GUARD/);
});
