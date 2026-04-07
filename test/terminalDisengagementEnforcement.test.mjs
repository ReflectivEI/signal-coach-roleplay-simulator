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

test("terminal close dialogue cannot append a new follow-up question", () => {
  assert.match(SOURCE, /function stripFollowUpAfterTerminalClose/);
  assert.match(SOURCE, /nextHcpDialogue = stripFollowUpAfterTerminalClose\(nextHcpDialogue\);/);
  assert.match(SOURCE, /const includeAsk = false;/);
});

test("study-methodology fallback is gated away from workflow and access turns", () => {
  assert.match(SOURCE, /const studyQuestionAllowed = mentionsStudy/);
  assert.match(SOURCE, /!\(activeConcern === "workflow" \|\| activeConcern === "access"/);
  assert.match(SOURCE, /study-reanchor/);
});

test("HCP dialogue strips simulator meta-discourse before final turn output", () => {
  assert.match(SOURCE, /function stripSimulatorMetaDialogue/);
  assert.match(SOURCE, /previous question/);
  assert.match(SOURCE, /to get back on track/);
  assert.match(SOURCE, /nextHcpDialogue = stripSimulatorMetaDialogue\(nextHcpDialogue\);/);
});
