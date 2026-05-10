import test from "node:test";
import assert from "node:assert/strict";

import { shouldAllowDemandHoldOverride } from "../src/components/roleplay/demandHoldContinuity.js";
import { DEMAND_TYPES } from "../src/components/roleplay/interventionEngineV2.js";

test("stale operational hold does not overwrite an evidence-demand shift", () => {
  const allowHold = shouldAllowDemandHoldOverride({
    activeDemandType: DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED,
    candidateHcpDialogue: "Before we continue, give me one specific evidence point with a measurable threshold.",
  });

  assert.equal(allowHold, false);
});

test("same-family operational demand still allows hold override", () => {
  const allowHold = shouldAllowDemandHoldOverride({
    activeDemandType: DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED,
    candidateHcpDialogue: "Keep this practical: what is one workflow-fit step we can run this week without adding burden?",
  });

  assert.equal(allowHold, true);
});

test("continuity gate remains demand-shape based without scenario coupling", () => {
  const withScenarioLabel = shouldAllowDemandHoldOverride({
    activeDemandType: DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED,
    candidateHcpDialogue: "[Scenario: onc_pa_gu_oral_onc_tminus7] I need one decision-level data point with a threshold.",
  });
  const withoutScenarioLabel = shouldAllowDemandHoldOverride({
    activeDemandType: DEMAND_TYPES.OPERATIONAL_REANCHOR_REQUIRED,
    candidateHcpDialogue: "I need one decision-level data point with a threshold.",
  });

  assert.equal(withScenarioLabel, false);
  assert.equal(withoutScenarioLabel, false);
});
