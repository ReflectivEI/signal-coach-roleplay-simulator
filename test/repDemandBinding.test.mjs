import test from "node:test";
import assert from "node:assert/strict";

import { enforceRepDemandBinding } from "../src/components/roleplay/repDemandBinding.js";

test("narrowing enforcement converts broad answer into a single concrete step", () => {
  const result = enforceRepDemandBinding({
    repMessage: "There are several strategies we can consider, including education, data review, and workflow discussions.",
    previousRepMessage: "We can optimize in many ways.",
    unresolvedDemandActive: true,
    activeDemandType: "direct_answer_required",
    hcpPrompt: "Give me one step we can run this week.",
    activeConcern: "workflow",
  });

  assert.equal(result.constrained, true);
  assert.match(result.repMessage.toLowerCase(), /first step:/);
  assert.ok(!/option 1|option 2|either|\n\s*[-*•]/i.test(result.repMessage));
});

test("anti-reuse blocks near-identical broad rep answer when demand remains unresolved", () => {
  const result = enforceRepDemandBinding({
    repMessage: "We should align the team and revisit this next week.",
    previousRepMessage: "We should align the team and revisit this next week.",
    unresolvedDemandActive: true,
    activeDemandType: "operational_reanchor_required",
    hcpPrompt: "How does this fit my staffing workflow right now?",
    activeConcern: "workflow",
  });

  assert.equal(result.constrained, true);
  assert.equal(result.reason, "blocked_reuse");
});

test("demand binding keeps unconstrained reply only when it directly answers active demand", () => {
  const result = enforceRepDemandBinding({
    repMessage: "First step: assign one MA owner for a same-day checklist handoff in your workflow this week.",
    previousRepMessage: "Start by framing value.",
    unresolvedDemandActive: true,
    activeDemandType: "operational_reanchor_required",
    hcpPrompt: "I need one concrete workflow step, not a broad answer.",
    activeConcern: "workflow",
  });

  assert.equal(result.constrained, false);
  assert.equal(result.repMessage.startsWith("First step:"), true);
});

test("shape-based constrained outputs cover workflow, evidence, operational, and access", () => {
  const shapes = [
    { activeConcern: "workflow", prompt: "Give me one step for workflow." },
    { activeConcern: "evidence", prompt: "Give me one evidence point with one step." },
    { activeConcern: "workflow", type: "operational_reanchor_required", prompt: "How does this fit staffing and workflow?" },
    { activeConcern: "access", prompt: "What is one step for payer access and coverage?" },
  ];

  const outputs = shapes.map((shape, index) => enforceRepDemandBinding({
    repMessage: "This is broadly helpful across contexts.",
    previousRepMessage: `prior broad answer ${index}`,
    unresolvedDemandActive: true,
    activeDemandType: shape.type || "direct_answer_required",
    hcpPrompt: shape.prompt,
    activeConcern: shape.activeConcern,
  }));

  outputs.forEach((output) => {
    assert.equal(output.constrained, true);
    assert.match(output.repMessage.toLowerCase(), /first step:/);
  });

  assert.deepEqual(outputs.map((output) => output.shape), ["workflow", "evidence", "operational", "access"]);
});
