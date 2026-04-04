import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSafeReferenceLeadIn,
  buildSafeRepReferencePhrase,
  validateReferencePhrase,
} from "../src/components/roleplay/hcpReferenceSafety.js";

test("does not produce malformed 'You mentioned ...' from noisy rep text", () => {
  const rep = "completely agree come first most and and and with";
  const leadIn = buildSafeReferenceLeadIn(rep, "I hear your concern.");
  assert.equal(leadIn, "I hear your concern.");
  assert.ok(!/You mentioned completely agree come first/i.test(leadIn));
});

test("builds clean references from distinct structured rep signals", () => {
  const evidenceRef = buildSafeRepReferencePhrase("I hear you. The published data and outcomes support this.");
  const workflowRef = buildSafeRepReferencePhrase("I understand the concern. We need workflow fit with limited staff.");
  const nextStepRef = buildSafeRepReferencePhrase("First step is to assign one owner and start this week.");

  assert.equal(validateReferencePhrase(evidenceRef), true);
  assert.equal(validateReferencePhrase(workflowRef), true);
  assert.equal(validateReferencePhrase(nextStepRef), true);
  assert.match(evidenceRef, /^You mentioned /);
});

test("fallback behavior is used when safe reference extraction fails", () => {
  const leadIn = buildSafeReferenceLeadIn("uh uh uh and the for with", "I hear your concern.");
  assert.equal(leadIn, "I hear your concern.");
});
