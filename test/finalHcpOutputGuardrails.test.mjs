import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  hasControlDirectiveLeak,
  sanitizeFinalHcpDialogueSurface,
} from "../src/components/roleplay/finalHcpOutputGuardrails.js";

test("final output guard detects control/meta directive prefixes", () => {
  assert.equal(hasControlDirectiveLeak("Re-anchor to the operational constraint and give one feasible step."), true);
  assert.equal(hasControlDirectiveLeak("Narrow to one operationally feasible action tied to staffing."), true);
  assert.equal(hasControlDirectiveLeak("Final clarification: provide one decision-level evidence point."), true);
  assert.equal(hasControlDirectiveLeak("I still need one practical next step for this clinic."), false);
});

test("final output guard rewrites leaked directive text to safe natural HCP dialogue", () => {
  const result = sanitizeFinalHcpDialogueSurface({
    dialogue: "Final clarification: provide one decision-level evidence point.",
    activeConcern: "evidence",
    fallbackDialogue: "I still need one concrete evidence point tied to this setting before we move forward.",
  });

  assert.equal(result.applied, true);
  assert.equal(result.reason, "control_directive_guard");
  assert.equal(hasControlDirectiveLeak(result.dialogue), false);
  assert.match(result.dialogue, /evidence point/i);
});

test("RolePlayChat applies final output guard before storing next HCP dialogue", () => {
  const source = fs.readFileSync(new URL("../src/components/roleplay/RolePlayChat.jsx", import.meta.url), "utf8");
  const guardIndex = source.indexOf("sanitizeFinalHcpDialogueSurface({");
  const storeIndex = source.indexOf("nextTurn.hcpDialogueBefore = nextHcpDialogue;");
  assert.ok(guardIndex !== -1, "expected final surface guard invocation");
  assert.ok(storeIndex !== -1, "expected final HCP storage assignment");
  assert.ok(guardIndex < storeIndex, "guard must run before final HCP dialogue is stored/rendered");
});
