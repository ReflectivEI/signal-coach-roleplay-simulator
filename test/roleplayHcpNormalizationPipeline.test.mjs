import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const rolePlayChatSource = fs.readFileSync(new URL("../src/components/roleplay/RolePlayChat.jsx", import.meta.url), "utf8");

test("RolePlayChat routes final HCP dialogue through deterministic punctuation contract before storing", () => {
  assert.match(
    rolePlayChatSource,
    /const acceptedDialogueBeforeFinalContract = nextHcpDialogue;[\s\S]*nextHcpDialogue = applyDeterministicPunctuationContract\(acceptedDialogueBeforeFinalContract\);/
  );
});

test("RolePlayChat deterministic punctuation contract uses normalizeHcpDialoguePunctuation", () => {
  assert.match(
    rolePlayChatSource,
    /function applyDeterministicPunctuationContract\(text\)\s*{\s*return normalizeHcpDialoguePunctuation\(String\(text \|\| ""\)\.trim\(\)\)\.trim\(\);\s*}/
  );
});
