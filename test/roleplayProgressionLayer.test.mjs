import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SOURCE = fs.readFileSync(new URL("../src/components/roleplay/RolePlayChat.jsx", import.meta.url), "utf8");

test("roleplay runtime adds functionally_resolved progression overlay without replacing existing satisfaction states", () => {
  assert.match(SOURCE, /satisfaction:\s*constraint\.satisfaction \|\| "not_satisfied"/);
  assert.match(SOURCE, /functionallyResolved:\s*Boolean\(constraint\.functionallyResolved \|\| constraint\.satisfaction === "functionally_resolved"\)/);
  assert.match(SOURCE, /satisfaction:\s*functionallyResolved \? "functionally_resolved" : satisfaction/);
});

test("roleplay runtime prevents reopening functionally resolved constraints unless materially different signal appears", () => {
  assert.match(SOURCE, /priorFunctionallyResolvedByType/);
  assert.match(SOURCE, /confidenceShift >= 0\.25/);
  assert.match(SOURCE, /extractHcpConstraints\(nextHcpDialogue\)\.filter/);
});

test("loop policy call receives additive progression signals", () => {
  assert.match(SOURCE, /resolveConstraintLoopAction\(\{[\s\S]*hasFunctionalResolution,[\s\S]*diminishingReturnsDetected,[\s\S]*\}\)/);
});
