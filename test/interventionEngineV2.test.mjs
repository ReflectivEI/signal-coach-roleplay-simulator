import test from "node:test";
import assert from "node:assert/strict";

import {
  DEMAND_TYPES,
  INTERVENTION_DECISIONS,
  buildDemandHoldDirective,
  buildDemandHoldMessage,
  classifyDemandType,
  createInitialInterventionSessionState,
  detectEvasiveRepResponse,
  updateInterventionSessionState,
} from "../src/components/roleplay/interventionEngineV2.js";

test("evidence_request remains active until rep provides concrete supporting answer", () => {
  let state = createInitialInterventionSessionState();

  state = updateInterventionSessionState(state, {
    turnNumber: 1,
    hcpPrompt: "What evidence supports this recommendation in practice?",
    repMessage: "This is generally important for outcomes.",
    activeConcern: "workflow",
  });

  assert.equal(state.activeDemand.type, DEMAND_TYPES.EVIDENCE_REQUEST);
  assert.equal(state.activeDemand.isActive, true);
  assert.equal(state.lastDecision, INTERVENTION_DECISIONS.REQUIRE_EVIDENCE_ANCHOR);

  state = updateInterventionSessionState(state, {
    turnNumber: 2,
    hcpPrompt: "What evidence supports this recommendation in practice?",
    repMessage: "In a published trial, adherence improved by 14% and we can apply the same step in your clinic workflow this week.",
    activeConcern: "workflow",
  });

  assert.equal(state.activeDemand.isActive, false);
  assert.equal(state.activeDemand.resolvedThisTurn, true);
});

test("proof_point_request does not resolve on generic principle or paraphrase", () => {
  let state = createInitialInterventionSessionState();

  state = updateInterventionSessionState(state, {
    turnNumber: 3,
    hcpPrompt: "Give me one proof point with a concrete metric.",
    repMessage: "A strong principle is to focus on value and alignment.",
  });

  assert.equal(state.activeDemand.type, DEMAND_TYPES.PROOF_POINT_REQUEST);
  assert.equal(state.activeDemand.isActive, true);

  state = updateInterventionSessionState(state, {
    turnNumber: 4,
    hcpPrompt: "Give me one proof point with a concrete metric.",
    repMessage: "You want one proof point with a concrete metric.",
  });

  assert.equal(state.activeDemand.type, DEMAND_TYPES.PROOF_POINT_REQUEST);
  assert.equal(state.activeDemand.isActive, true);
  assert.equal(state.activeDemand.evasiveResponseDetected, true);
});

test("direct unanswered question remains active until directly answered", () => {
  let state = createInitialInterventionSessionState();

  state = updateInterventionSessionState(state, {
    turnNumber: 5,
    hcpPrompt: "What is the first step we should run this week?",
    repMessage: "We can follow up later with more details.",
    activeConcern: "workflow",
  });

  assert.equal(state.activeDemand.type, DEMAND_TYPES.DIRECT_ANSWER_REQUIRED);
  assert.equal(state.activeDemand.isActive, true);

  state = updateInterventionSessionState(state, {
    turnNumber: 6,
    hcpPrompt: "What is the first step we should run this week?",
    repMessage: "First step: assign one owner to a same-day checklist and review completion by Friday.",
    activeConcern: "workflow",
  });

  assert.equal(state.activeDemand.isActive, false);
});

test("operational_reanchor_required remains active until operationally addressed", () => {
  let state = createInitialInterventionSessionState();

  state = updateInterventionSessionState(state, {
    turnNumber: 7,
    hcpPrompt: "How does this fit our staffing and workflow constraints?",
    repMessage: "The broader value is compelling across settings.",
    hasBlockingConstraints: true,
    needsConstraintReanchor: true,
    activeConcern: "workflow",
  });

  assert.equal(state.activeDemand.type, DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED);
  assert.equal(state.activeDemand.isActive, true);

  state = updateInterventionSessionState(state, {
    turnNumber: 8,
    hcpPrompt: "How does this fit our staffing and workflow constraints?",
    repMessage: "Use one existing MA to run the intake step, then hand off to RN in the same workflow block this week.",
    hasBlockingConstraints: true,
    needsConstraintReanchor: true,
    activeConcern: "workflow",
  });

  assert.equal(state.activeDemand.isActive, false);
});

test("vague deferral and pivot language are classified as evasive", () => {
  const evasive = detectEvasiveRepResponse({
    hcpPrompt: "What metric proves this works?",
    repMessage: "Anyway, we can circle back next time and follow up later.",
  });

  assert.equal(evasive.evasive, true);
  assert.equal(evasive.vagueDeferral, true);
  assert.equal(evasive.pivotAway, true);
});

test("demand hold messages are generic and deterministic across scenario families", () => {
  const families = ["oncology", "cardiometabolic", "infectious disease", "general medicine"];
  const outputs = families.map((family) => buildDemandHoldMessage({
    demandType: DEMAND_TYPES.EVIDENCE_REQUEST,
    activeConcern: family,
    unresolvedTurns: 2,
    seed: `seed:${family}`,
  }));

  outputs.forEach((message) => {
    assert.equal(typeof message, "string");
    assert.ok(message.length > 20);
    assert.ok(!/scenario\s*=|therapy\s*=|patient population/i.test(message));
  });
});

test("same-demand hold message varies and does not repeat back-to-back", () => {
  const first = buildDemandHoldMessage({
    demandType: DEMAND_TYPES.EVIDENCE_REQUEST,
    activeConcern: "workflow",
    unresolvedTurns: 1,
    seed: "turn-1",
  });
  const second = buildDemandHoldMessage({
    demandType: DEMAND_TYPES.EVIDENCE_REQUEST,
    activeConcern: "workflow",
    unresolvedTurns: 2,
    seed: "turn-2",
    avoidLine: first,
  });

  assert.notEqual(first, second);
});

test("long rep response is still classified for active demand and remains unresolved when evasive", () => {
  const longRep = `${"This is generally important and strategic for outcomes. ".repeat(20)} We can circle back later.`;
  const state = updateInterventionSessionState(createInitialInterventionSessionState(), {
    turnNumber: 11,
    hcpPrompt: "What direct proof point supports this?",
    repMessage: longRep,
    activeConcern: "workflow",
  });

  assert.equal(state.activeDemand.type, DEMAND_TYPES.PROOF_POINT_REQUEST);
  assert.equal(state.activeDemand.isActive, true);
  assert.equal(state.activeDemand.longResponseClassified, true);
});

test("stale turn number is ignored and cannot recycle prior-message progression", () => {
  const start = updateInterventionSessionState(createInitialInterventionSessionState(), {
    turnNumber: 12,
    hcpPrompt: "What evidence supports this?",
    repMessage: "General principles apply.",
    activeConcern: "workflow",
  });
  const stale = updateInterventionSessionState(start, {
    turnNumber: 12,
    hcpPrompt: "What evidence supports this?",
    repMessage: "Different text that should be ignored as stale.",
    activeConcern: "workflow",
  });

  assert.deepEqual(stale, start);
});

test("progression stage tightens unresolved demand wording over repeated misses", () => {
  const stage1 = buildDemandHoldMessage({
    demandType: DEMAND_TYPES.DIRECT_ANSWER_REQUIRED,
    activeConcern: "workflow",
    unresolvedTurns: 1,
    seed: "progression",
  });
  const stage2 = buildDemandHoldMessage({
    demandType: DEMAND_TYPES.DIRECT_ANSWER_REQUIRED,
    activeConcern: "workflow",
    unresolvedTurns: 2,
    seed: "progression",
    avoidLine: stage1,
  });
  const stage3 = buildDemandHoldMessage({
    demandType: DEMAND_TYPES.DIRECT_ANSWER_REQUIRED,
    activeConcern: "workflow",
    unresolvedTurns: 3,
    seed: "progression",
    avoidLine: stage2,
  });

  assert.notEqual(stage1, stage2);
  assert.notEqual(stage2, stage3);
  assert.match(stage3.toLowerCase(), /final|last pass|final clarification/);
});

test("demand classifier maps reusable conversational patterns", () => {
  assert.equal(
    classifyDemandType({ hcpPrompt: "What proof point should change my decision?" }),
    DEMAND_TYPES.PROOF_POINT_REQUEST,
  );
  assert.equal(
    classifyDemandType({ hcpPrompt: "What evidence supports this?" }),
    DEMAND_TYPES.EVIDENCE_REQUEST,
  );
  assert.equal(
    classifyDemandType({ hcpPrompt: "How does this fit our workflow?", hasBlockingConstraints: true }),
    DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED,
  );
  assert.equal(
    classifyDemandType({ hcpPrompt: "What should we do first?" }),
    DEMAND_TYPES.DIRECT_ANSWER_REQUIRED,
  );
  assert.equal(
    classifyDemandType({ hcpPrompt: "How does this apply in our clinic setting?" }),
    DEMAND_TYPES.APPLICABILITY_REQUEST,
  );
});

test("applicability demand remains active until the answer is tied to HCP context", () => {
  let state = createInitialInterventionSessionState();
  state = updateInterventionSessionState(state, {
    turnNumber: 21,
    hcpPrompt: "How does this apply in our clinic setting?",
    repMessage: "This is broadly useful in many practices.",
    activeConcern: "workflow",
  });
  assert.equal(state.activeDemand.type, DEMAND_TYPES.APPLICABILITY_REQUEST);
  assert.equal(state.activeDemand.isActive, true);

  state = updateInterventionSessionState(state, {
    turnNumber: 22,
    hcpPrompt: "How does this apply in our clinic setting?",
    repMessage: "In your clinic, start with one intake checklist owned by the MA team this week.",
    activeConcern: "workflow",
  });
  assert.equal(state.activeDemand.isActive, false);
});

test("demand hold escalation reaches impatience then disengagement trajectory after repeated misses", () => {
  const stage3 = buildDemandHoldDirective({
    demandType: DEMAND_TYPES.EVIDENCE_REQUEST,
    unresolvedTurns: 3,
    activeConcern: "workflow",
    seed: "stage-3",
  });
  const stage4 = buildDemandHoldDirective({
    demandType: DEMAND_TYPES.EVIDENCE_REQUEST,
    unresolvedTurns: 4,
    activeConcern: "workflow",
    seed: "stage-4",
    avoidLine: stage3.line,
  });

  assert.equal(stage3.impatientTone, true);
  assert.equal(stage3.disengagementTrajectory, false);
  assert.equal(stage4.disengagementTrajectory, true);
  assert.match(stage4.line.toLowerCase(), /hard to continue|cannot move this conversation forward|disengage|do not see value|keep moving forward/);
});

test("demand hold behavior is deterministic and reusable across scenario types", () => {
  const scenarioFamilies = ["cardiology", "oncology"];
  const outputs = scenarioFamilies.map((family) => buildDemandHoldDirective({
    demandType: DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED,
    activeConcern: family,
    unresolvedTurns: 2,
    seed: "stable-seed",
  }));

  outputs.forEach((directive) => {
    assert.equal(typeof directive.line, "string");
    assert.equal(directive.stage, 2);
    assert.equal(directive.disengagementTrajectory, false);
    assert.ok(directive.line.length > 20);
  });
});

test("unresolved applicability demand is not bypassed by generic progression signals", () => {
  const state = updateInterventionSessionState(createInitialInterventionSessionState(), {
    turnNumber: 30,
    hcpPrompt: "How does this apply in our clinic setting?",
    repMessage: "This is relevant across many environments and should help broadly.",
    alignmentScore: 4.5,
    concernFlowOutcome: "aligned",
    activeConcern: "workflow",
    hasBlockingConstraints: false,
    needsConstraintReanchor: false,
  });

  assert.equal(state.activeDemand.type, DEMAND_TYPES.APPLICABILITY_REQUEST);
  assert.equal(state.activeDemand.isActive, true);
  assert.equal(state.activeDemand.demandSatisfied, false);
});

test("same unresolved-demand input sequence yields identical deterministic hold outputs", () => {
  const runSequence = () => {
    let state = createInitialInterventionSessionState();
    const holdLines = [];
    for (let i = 1; i <= 4; i += 1) {
      state = updateInterventionSessionState(state, {
        turnNumber: i,
        hcpPrompt: "How does this apply in our clinic setting?",
        repMessage: "This is generally relevant and important.",
        activeConcern: "workflow",
      });
      const directive = buildDemandHoldDirective({
        demandType: state.activeDemand.type,
        activeConcern: "workflow",
        unresolvedTurns: state.activeDemand.unresolvedTurns,
        seed: `stable-sequence:${i}`,
      });
      holdLines.push({ stage: directive.stage, line: directive.line });
    }
    return holdLines;
  };

  assert.deepEqual(runSequence(), runSequence());
});

test("demand switch from evidence/applicability to monitoring/workflow updates active demand and blocks stale answer reuse", () => {
  let state = createInitialInterventionSessionState();
  state = updateInterventionSessionState(state, {
    turnNumber: 40,
    hcpPrompt: "What evidence supports this recommendation in our setting?",
    repMessage: "This is generally important for outcomes.",
    activeConcern: "workflow",
    scenarioFamily: "oncology_io",
  });
  assert.equal(state.activeDemand.type, DEMAND_TYPES.EVIDENCE_REQUEST);
  assert.equal(state.activeDemand.isActive, true);

  state = updateInterventionSessionState(state, {
    turnNumber: 41,
    hcpPrompt: "How do we monitor this week and fit it into staffing workflow?",
    repMessage: "This is generally important for outcomes.",
    activeConcern: "workflow",
    scenarioFamily: "oncology_io",
    hasBlockingConstraints: true,
    needsConstraintReanchor: true,
  });

  assert.equal(state.activeDemand.type, DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED);
  assert.equal(state.activeDemand.isActive, true);
  assert.equal(state.activeDemand.staleAnswerBlocked, true);
});

test("near-identical rep answer can resolve only when downstream ask is semantically aligned", () => {
  let state = createInitialInterventionSessionState();
  state = updateInterventionSessionState(state, {
    turnNumber: 42,
    hcpPrompt: "How does this apply in our clinic setting?",
    repMessage: "In your clinic, start with one intake checklist owned by the MA team this week.",
    activeConcern: "workflow",
    scenarioFamily: "oncology_io",
  });
  assert.equal(state.activeDemand.type, DEMAND_TYPES.APPLICABILITY_REQUEST);
  assert.equal(state.activeDemand.isActive, false);

  state = updateInterventionSessionState(state, {
    turnNumber: 43,
    hcpPrompt: "How does this apply in our practice setting?",
    repMessage: "In your clinic, start with one intake checklist owned by the MA team this week.",
    activeConcern: "workflow",
    scenarioFamily: "oncology_io",
  });
  assert.equal(state.activeDemand.type, DEMAND_TYPES.APPLICABILITY_REQUEST);
  assert.equal(state.activeDemand.isActive, false);
  assert.equal(state.activeDemand.staleAnswerBlocked, false);
});

test("same demand with new constraint invalidates reused answer", () => {
  let state = createInitialInterventionSessionState();
  state = updateInterventionSessionState(state, {
    turnNumber: 44,
    hcpPrompt: "What evidence supports this recommendation for our clinic?",
    repMessage: "A phase 3 trial showed improved progression-free survival.",
    activeConcern: "workflow",
    scenarioFamily: "oncology_io",
  });
  assert.equal(state.activeDemand.type, DEMAND_TYPES.EVIDENCE_REQUEST);

  state = updateInterventionSessionState(state, {
    turnNumber: 45,
    hcpPrompt: "Same evidence question, but keep it concise and anchor on clinically meaningful evidence first.",
    repMessage: "A phase 3 trial showed improved progression-free survival.",
    activeConcern: "workflow",
    scenarioFamily: "oncology_io",
  });

  assert.equal(state.activeDemand.type, DEMAND_TYPES.EVIDENCE_REQUEST);
  assert.equal(state.activeDemand.staleAnswerBlocked, true);
  assert.equal(state.activeDemand.isActive, true);
});

test("repeated long-form answer is blocked when latest cue adds time/relevance/concision constraints", () => {
  let state = createInitialInterventionSessionState();
  const repeatedLongForm = "The trial program had broad enrollment and several analyses across endpoints, and while there are many nuances in subgroup interpretation, the publication provides details that can be reviewed for context across treatment pathways and operational planning needs in many systems.";
  state = updateInterventionSessionState(state, {
    turnNumber: 46,
    hcpPrompt: "How does this apply in our setting?",
    repMessage: repeatedLongForm,
    activeConcern: "workflow",
    scenarioFamily: "oncology_io",
  });

  state = updateInterventionSessionState(state, {
    turnNumber: 47,
    hcpPrompt: "I only have a minute—keep this concise and practice relevant.",
    repMessage: repeatedLongForm,
    activeConcern: "workflow",
    scenarioFamily: "oncology_io",
  });

  assert.equal(state.activeDemand.type, DEMAND_TYPES.APPLICABILITY_REQUEST);
  assert.equal(state.activeDemand.staleAnswerBlocked, true);
  assert.equal(state.activeDemand.isActive, true);
});

test("repeated answer structure is blocked when latest instruction is ignored", () => {
  let state = createInitialInterventionSessionState();
  state = updateInterventionSessionState(state, {
    turnNumber: 48,
    hcpPrompt: "Give one evidence point for our clinic workflow.",
    repMessage: "The trial included broad enrollment and showed outcomes with subgroup nuances for implementation planning.",
    activeConcern: "workflow",
    scenarioFamily: "oncology_io",
  });

  state = updateInterventionSessionState(state, {
    turnNumber: 49,
    hcpPrompt: "Keep it concise and practice relevant for this week.",
    repMessage: "The trial had broad enrollment and showed outcomes with subgroup nuances for workflow planning.",
    activeConcern: "workflow",
    scenarioFamily: "oncology_io",
  });

  assert.equal(state.activeDemand.staleAnswerBlocked, true);
  assert.equal(state.activeDemand.isActive, true);
});

test("generic fallback loop language is blocked as evasive stale reuse", () => {
  let state = createInitialInterventionSessionState();
  state = updateInterventionSessionState(state, {
    turnNumber: 50,
    hcpPrompt: "How is this applicable in our setting?",
    repMessage: "In your clinic, start with one intake checklist this week.",
    activeConcern: "workflow",
    scenarioFamily: "oncology_io",
  });

  state = updateInterventionSessionState(state, {
    turnNumber: 51,
    hcpPrompt: "I need this concise and practical right now—how does that apply in our clinic?",
    repMessage: "I just mentioned that already, and as I said the guidance remains generally important.",
    activeConcern: "workflow",
    scenarioFamily: "oncology_io",
  });

  assert.equal(state.activeDemand.staleAnswerBlocked, true);
  assert.equal(state.activeDemand.evasiveResponseDetected, true);
  assert.equal(state.activeDemand.isActive, true);
});

test("cross-domain lexical contamination in concern is safely bounded to current scenario family", () => {
  const line = buildDemandHoldMessage({
    demandType: DEMAND_TYPES.APPLICABILITY_REQUEST,
    activeConcern: "PrEP patients workflow",
    scenarioFamily: "oncology_io",
    unresolvedTurns: 2,
    seed: "cross-domain",
  });

  assert.doesNotMatch(line, /prep|hiv|pre exposure/i);
  assert.match(line.toLowerCase(), /workflow|setting|clinic|current clinic context/);
});

test("pure mirroring response is flagged as non-answer and blocked from progression", () => {
  const state = updateInterventionSessionState(createInitialInterventionSessionState(), {
    turnNumber: 60,
    hcpPrompt: "What is the first operational step we can run this week?",
    repMessage: "What is the first operational step we can run this week?",
    activeConcern: "workflow",
  });

  assert.equal(state.activeDemand.type, DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED);
  assert.equal(state.activeDemand.isActive, true);
  assert.equal(state.activeDemand.evasiveResponseDetected, true);
  assert.equal(state.lastDecision, INTERVENTION_DECISIONS.REQUIRE_REANCHOR_TO_CONSTRAINT);
});

test("paraphrase without new information is flagged as insufficient", () => {
  const state = updateInterventionSessionState(createInitialInterventionSessionState(), {
    turnNumber: 61,
    hcpPrompt: "What is the first operational step we can run this week?",
    repMessage: "You are asking what operational step you can run this week.",
    activeConcern: "workflow",
  });

  assert.equal(state.activeDemand.isActive, true);
  assert.equal(state.activeDemand.demandSatisfied, false);
  assert.equal(state.activeDemand.evasiveResponseDetected, true);
});

test("reflection followed by a substantive answer is allowed and resolves demand", () => {
  const state = updateInterventionSessionState(createInitialInterventionSessionState(), {
    turnNumber: 62,
    hcpPrompt: "What is the first operational step we can run this week?",
    repMessage: "I hear your concern. First step: assign one MA owner to run the intake checklist in your workflow today and review completion by Friday.",
    activeConcern: "workflow",
  });

  assert.equal(state.activeDemand.isActive, false);
  assert.equal(state.activeDemand.demandSatisfied, true);
  assert.equal(state.activeDemand.evasiveResponseDetected, false);
});
