import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SOURCE = fs.readFileSync(new URL("../src/components/roleplay/RolePlayChat.jsx", import.meta.url), "utf8");
const LATEST_ASK_PROGRESSION_SOURCE = fs.readFileSync(new URL("../src/components/roleplay/latestAskProgression.js", import.meta.url), "utf8");
const SHARED_TURN_VALIDATION_SOURCE = fs.readFileSync(new URL("../src/lib/roleplay/roleplayTurnValidation.js", import.meta.url), "utf8");

test("terminal disengagement phrases are recognized as closure signals", () => {
  assert.match(SOURCE, /i need to get back to patients/);
  assert.match(SOURCE, /i need to get back to clinic/);
  assert.match(SOURCE, /i need to pause here/);
  assert.match(SOURCE, /stop here for now/);
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

test("final HCP dialogue repairs consumed opening-scene replay", () => {
  assert.match(SOURCE, /detectOpeningSceneDialogueReplay/);
  assert.match(SOURCE, /opening_scene_dialogue_replay_repaired/);
  assert.match(SOURCE, /openingReplayCheck\.replayed/);
  assert.match(SOURCE, /!isFirstHcpResponse/);
});

test("HCP dialogue surface hardening repairs malformed preference fragments", () => {
  assert.match(SOURCE, /function hardenTextSurface/);
  assert.match(SOURCE, /I\(\?:'d\| would\) like\) on/);
  assert.match(SOURCE, /\$1 guidance on/);
  assert.match(SOURCE, /I\(\?:'d\| would\) like\) about/);
  assert.match(SOURCE, /\$1 to talk about/);
  assert.match(SOURCE, /I\(\?:'d\| would\) like\) for\\s\+\(guidance\|clarity\|detail\|details\|help\)/);
  assert.match(SOURCE, /I want\) on/);
  assert.match(SOURCE, /I want\) about\\s\+/);
  assert.match(SOURCE, /I want\) for\\s\+\(guidance\|clarity\|detail\|details\|help\)/);
  assert.match(SOURCE, /one\\b\|two\\b\|three\\b/);
});

test("terminal close disables continued rep input in the live chat form", () => {
  assert.match(SOURCE, /function hasTerminalClosedTurn/);
  assert.match(SOURCE, /function isTerminalDisengagementCue/);
  assert.match(SOURCE, /const conversationTerminalClosed = hasTerminalClosedTurn\(turns\)/);
  assert.match(SOURCE, /if \(hasTerminalClosedTurn\(turns\)\) \{[\s\S]*controller\.state = SessionState\.ENDED;[\s\S]*return;[\s\S]*\}/);
  assert.match(SOURCE, /isTerminalDisengagementCue\(contextualCue\)/);
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
  assert.match(SOURCE, /I hear the context, but in my clinic this comes down to workflow/);
  assert.match(SOURCE, /Candidacy is still the question for me/);
  assert.match(SOURCE, /Before we discuss new data/);
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

test("screening plan acknowledgments produce operational follow-up instead of repeated practical-steps prompt", () => {
  assert.match(SOURCE, /function hasScenarioAlignedScreeningPlan/);
  assert.match(SOURCE, /That is the right focus\. Help me make it operational/);
  assert.match(SOURCE, /I need the screening approach to be concrete/);
  assert.doesNotMatch(SOURCE, /Before we move forward, what practical steps would you recommend/);
});

test("workflow implementation answers progress to ownership clarification instead of repeating practical-step demand", () => {
  assert.match(SOURCE, /function buildWorkflowProgressionFollowUp/);
  assert.match(SOURCE, /function hasVagueOperationalOwner/);
  assert.match(SOURCE, /function hasExplicitOperationalOwner/);
  assert.match(SOURCE, /Which role owns the first step/);
  assert.match(SOURCE, /What is the first handoff they would own this week/);
});

test("surface hardening prevents capitalized question words after comma joins", () => {
  assert.match(SOURCE, /,\\s\+\(Who\|What\|How\|Which/);
  assert.match(SOURCE, /word\.toLowerCase\(\)/);
});

test("latest HCP ask progression gate prevents workflow ownership loops", () => {
  assert.match(LATEST_ASK_PROGRESSION_SOURCE, /function classifyLatestAskProgression/);
  assert.match(LATEST_ASK_PROGRESSION_SOURCE, /function buildLatestAskProgressionDialogue/);
  assert.match(SHARED_TURN_VALIDATION_SOURCE, /function shouldBlockRepTurnForLatestAsk/);
  assert.match(SHARED_TURN_VALIDATION_SOURCE, /function validateRoleplayRepTurn/);
  assert.match(SHARED_TURN_VALIDATION_SOURCE, /blockHcpGeneration: invalid/);
  assert.match(SHARED_TURN_VALIDATION_SOURCE, /blockScoring: invalid/);
  assert.match(SHARED_TURN_VALIDATION_SOURCE, /blockStateAdvance: invalid/);
  assert.match(SHARED_TURN_VALIDATION_SOURCE, /buildTurnValidationTelemetryEvents/);
  assert.match(SHARED_TURN_VALIDATION_SOURCE, /invalid_turn_blocked/);
  assert.match(SHARED_TURN_VALIDATION_SOURCE, /valid_turn_progressed/);
  assert.match(SOURCE, /const preTurnValidation = validateRoleplayRepTurn/);
  assert.match(SOURCE, /if \(preTurnValidation\.invalid\)/);
  assert.match(SOURCE, /setCoachingTip\(preTurnValidation\.coaching\)/);
  assert.match(SOURCE, /recordTurnValidationTelemetry\(preTurnValidation/);
  assert.match(SOURCE, /rep_turn_blocked_for_latest_ask/);
  assert.match(LATEST_ASK_PROGRESSION_SOURCE, /latestHcpAskRequiresOwner/);
  assert.match(LATEST_ASK_PROGRESSION_SOURCE, /hasOwnershipDeflection/);
  assert.match(LATEST_ASK_PROGRESSION_SOURCE, /I heard the process change\. The missing piece is ownership/);
  assert.match(LATEST_ASK_PROGRESSION_SOURCE, /Fair, you may not know my staffing model/);
  assert.match(SOURCE, /const latestAskBoundDialogue = buildLatestAskProgressionDialogue\(latestAskProgression\)/);
  assert.match(SOURCE, /&& !latestAskBoundDialogue[\s\S]*\) \{/);
});
