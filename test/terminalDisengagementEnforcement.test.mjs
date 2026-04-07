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

test("terminal close disables continued rep input in the live chat form", () => {
  assert.match(SOURCE, /function hasTerminalClosedTurn/);
  assert.match(SOURCE, /const conversationTerminalClosed = hasTerminalClosedTurn\(turns\)/);
  assert.match(SOURCE, /if \(hasTerminalClosedTurn\(turns\)\) \{[\s\S]*controller\.state = SessionState\.ENDED;[\s\S]*return;[\s\S]*\}/);
  assert.match(SOURCE, /if \(isLoading \|\| isEnding \|\| conversationTerminalClosed\) return;/);
  assert.match(SOURCE, /disabled=\{isLoading \|\| isEnding \|\| conversationTerminalClosed\}/);
  assert.match(SOURCE, /disabled=\{isLoading \|\| isEnding \|\| conversationTerminalClosed \|\| \(!sanitizeUserMessage\(input\) && !interim\)\}/);
});

test("final HCP dialogue cannot repeat recent asks or echo the rep message", () => {
  assert.match(SOURCE, /function isRepeatedFinalDialogue/);
  assert.match(SOURCE, /function isRepEchoInHcpDialogue/);
  assert.doesNotMatch(SOURCE, /love to follow up on our last conversation/i);
  assert.match(SOURCE, /final-repeat-repair/);
  assert.match(SOURCE, /isRepeatedFinalDialogue\(nextHcpDialogue, recentHcpDialogues\)/);
  assert.match(SOURCE, /isRepEchoInHcpDialogue\(\{ dialogue: nextHcpDialogue, repMessage \}\)/);
});

test("repair dialogue uses conversational continuity instead of bare rubric questions", () => {
  assert.match(SOURCE, /I'm not hearing the workflow piece yet/);
  assert.match(SOURCE, /Candidacy is still the question for me/);
  assert.doesNotMatch(SOURCE, /"What is the single workflow adjustment that saves my team time right away\?"/);
  assert.doesNotMatch(SOURCE, /"What is one step that fits our current protocol and can be implemented quickly\?"/);
  assert.doesNotMatch(SOURCE, /"How would I identify the right patients in my current panel during a standard visit\?"/);
});

test("cue variety treats semantically similar closeout cues as repeat risk", () => {
  assert.match(SOURCE, /calculateTokenOverlapRatio\(safeCue, priorCue\) >= 0\.62/);
  assert.match(SOURCE, /calculateSemanticSimilarity\(safeCue, priorCue\) >= 0\.66/);
  assert.doesNotMatch(SOURCE, /gathers the chart with minimal expression/);
  assert.match(SOURCE, /leaves space for one useful, concrete answer/);
});

test("scenario-specific workflow answers count as operational alignment", () => {
  assert.match(SOURCE, /standardi\[sz\]e\|training\|education\|monitoring\|call-\?tree\|one-\?pager\|pathway/);
  assert.match(SOURCE, /toxicity monitoring/);
  assert.doesNotMatch(SOURCE, /return "Just give me one practical step\.";/);
  assert.match(SOURCE, /I hear you, but with our staffing, give me one practical step we could actually run/);
});
