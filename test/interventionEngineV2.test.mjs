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
  assert.match(stage4.line.toLowerCase(), /hard to continue|cannot move this conversation forward|disengage|do not see value/);
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
