import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHcpDialoguePunctuation } from "../src/components/roleplay/hcpSimulationEngine.jsx";

test("normalizeHcpDialoguePunctuation keeps declarative 'what we' statements as statements", () => {
  const input = "What we do in our clinic is review adherence first";
  const output = normalizeHcpDialoguePunctuation(input);
  assert.equal(output, "What we do in our clinic is review adherence first.");
});

test("normalizeHcpDialoguePunctuation preserves direct questions", () => {
  const input = "What should we change first";
  const output = normalizeHcpDialoguePunctuation(input);
  assert.equal(output, "What should we change first?");
});

test("normalizeHcpDialoguePunctuation keeps declarative 'how we' statements as statements", () => {
  const input = "How we onboard patients today is fairly manual";
  const output = normalizeHcpDialoguePunctuation(input);
  assert.equal(output, "How we onboard patients today is fairly manual.");
});

test("normalizeHcpDialoguePunctuation splits run-on question clause", () => {
  const input = "I'm familiar with the data, what specific outcome would change your decision";
  const output = normalizeHcpDialoguePunctuation(input);
  assert.equal(output, "I'm familiar with the data. What specific outcome would change your decision?");
});

test("normalizeHcpDialoguePunctuation handles multi-clause punctuation without semantic rewrite", () => {
  const input = "We're short-staffed today, can you give one practical next step, and keep it brief";
  const output = normalizeHcpDialoguePunctuation(input);
  assert.equal(output, "We're short-staffed today. Can you give one practical next step, and keep it brief?");
});

test("normalizeHcpDialoguePunctuation repairs malformed opener fragments", () => {
  const input = "On great question I think this could work in our clinic";
  const output = normalizeHcpDialoguePunctuation(input);
  assert.equal(output, "That is a great question, I think this could work in our clinic.");
});

test("normalizeHcpDialoguePunctuation strips dangling first-sentence conjunction prefixes", () => {
  const input = "And I think we should start with one pilot workflow";
  const output = normalizeHcpDialoguePunctuation(input);
  assert.equal(output, "I think we should start with one pilot workflow.");
});

test("normalizeHcpDialoguePunctuation strips dangling 'So' prefix without changing intent", () => {
  const input = "So the key action is assigning one owner today";
  const output = normalizeHcpDialoguePunctuation(input);
  assert.equal(output, "The key action is assigning one owner today.");
});
