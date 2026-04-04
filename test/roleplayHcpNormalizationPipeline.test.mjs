import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const rolePlayChatSource = fs.readFileSync(new URL("../src/components/roleplay/RolePlayChat.jsx", import.meta.url), "utf8");

test("RolePlayChat protects final HCP render boundary from internal control text before punctuation contract", () => {
  assert.match(
    rolePlayChatSource,
    /const acceptedDialogueBeforeFinalContract = isInternalControlText\(nextHcpDialogue\)\s*\?\s*buildSafeDemandHoldDialogue\(nextHcpDialogue, activeConcern\)\s*:\s*nextHcpDialogue;[\s\S]*nextHcpDialogue = applyDeterministicPunctuationContract\(acceptedDialogueBeforeFinalContract\);/
  );
  assert.match(
    rolePlayChatSource,
    /nextTurn\.hcpDialogueBefore = nextHcpDialogue;/
  );
});

test("RolePlayChat deterministic punctuation contract uses normalizeHcpDialoguePunctuation", () => {
  assert.match(
    rolePlayChatSource,
    /function applyDeterministicPunctuationContract\(text\)\s*{\s*return normalizeHcpDialoguePunctuation\(String\(text \|\| ""\)\.trim\(\)\)\.trim\(\);\s*}/
  );
});

test("internal control/planner templates are explicitly recognized as non-renderable text", () => {
  assert.match(rolePlayChatSource, /const INTERNAL_CONTROL_TEXT_PATTERNS = \[/);
  assert.match(rolePlayChatSource, /\/\\bre-anchor to\\b\/i/);
  assert.match(rolePlayChatSource, /\/\\bnarrow to\\b\/i/);
  assert.match(rolePlayChatSource, /\/\\bfinal clarification\\b\/i/);
  assert.match(rolePlayChatSource, /\/\\boperational constraint\\b\/i/);
  assert.match(rolePlayChatSource, /function isInternalControlText\(text = ""\)/);
});

test("safe demand-hold rendering remains shared and shape-based across evidence/operational/applicability patterns", () => {
  assert.match(rolePlayChatSource, /function buildSafeDemandHoldDialogue\(text = "", activeConcern = "workflow"\)/);
  assert.match(rolePlayChatSource, /\\b\(evidence\|data point\|study\|metric\|proof point\|decision-level\)\\b/);
  assert.match(rolePlayChatSource, /\\b\(operational\|workflow\|staff\|capacity\|burden\|feasible\)\\b/);
  assert.match(rolePlayChatSource, /\\b\(apply\|applicability\|applicable\|setting\|practice\|clinic\|patient mix\)\\b/);
});

test("demand-hold runtime constraints persist while only final surface dialogue is transformed", () => {
  assert.match(rolePlayChatSource, /nextHcpDialogue = holdDirective\.line;/);
  assert.match(rolePlayChatSource, /demandHoldStage = holdDirective\.stage;/);
  assert.match(rolePlayChatSource, /demandHoldOverrodeProgression = true;/);
  assert.match(rolePlayChatSource, /unresolvedDemandTurns: activeDemand\?\.unresolvedTurns \|\| 0,/);
  assert.match(rolePlayChatSource, /demandHoldStage,/);
});
