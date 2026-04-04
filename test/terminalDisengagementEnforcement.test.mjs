import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SOURCE = fs.readFileSync(new URL("../src/components/roleplay/RolePlayChat.jsx", import.meta.url), "utf8");

test("terminal disengagement phrases are recognized as closure signals", () => {
  assert.match(SOURCE, /i need to get back to patients/);
  assert.match(SOURCE, /this isn\'?t productive|this is not productive/);
  assert.match(SOURCE, /take care/);
});

test("terminal intent forces disengaged state with respectful close fallback", () => {
  assert.match(SOURCE, /if \(isTerminalDisengagementIntent\(nextHcpDialogue\)\) \{[\s\S]*nextHcpState = "disengaged";[\s\S]*nextHcpDialogue = terminalCloseFallback;[\s\S]*\}/);
});

test("session ends after terminal close and does not continue argument loops", () => {
  assert.match(SOURCE, /const shouldEndSessionAfterTurn = overrideExit/);
  assert.match(SOURCE, /\(nextHcpState === "disengaged" && isTerminalClosureDialogue\(nextHcpDialogue\)\)/);
  assert.match(SOURCE, /\(!blockClose && terminalPolicyAction === "close"\)/);
  assert.match(SOURCE, /sessionControllerRef\.current\.state = SessionState\.ENDED;/);
});
