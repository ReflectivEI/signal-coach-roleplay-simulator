import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTone } from "../src/lib/conversationToneNormalization.js";

test("normalizeTone preserves lexical content while normalizing casing", () => {
  const input = "first, I can help. This first option supports your workflow.";
  const output = normalizeTone(input);
  assert.equal(
    output,
    "First, I can help. This first option supports your workflow."
  );
});

test("normalizeTone preserves semantic words mid-sentence", () => {
  const input = "I absolutely agree this is the first practical option.";
  const output = normalizeTone(input);
  assert.equal(output, "I absolutely agree this is the first practical option.");
});

test("normalizeTone smooths punctuation spacing without lexical replacement", () => {
  const input = "Absolutely,  this update will give you confidence .";
  const output = normalizeTone(input);
  assert.equal(output, "Absolutely, this update will give you confidence.");
});
