import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTone } from "../src/lib/conversationToneNormalization.js";

test("normalizeTone only rewrites leading transitional fillers", () => {
  const input = "First, I can help. This first option supports your workflow.";
  const output = normalizeTone(input);
  assert.equal(
    output,
    "Before we go further, I can help. This first option supports your workflow."
  );
});

test("normalizeTone preserves semantic words mid-sentence", () => {
  const input = "I absolutely agree this is the first practical option.";
  const output = normalizeTone(input);
  assert.equal(output, "I absolutely agree this is the first practical option.");
});

test("normalizeTone trims leading absolutely and smooths spacing", () => {
  const input = "Absolutely,  this update will give you confidence .";
  const output = normalizeTone(input);
  assert.equal(output, "This update can support prescribing confidence.");
});
