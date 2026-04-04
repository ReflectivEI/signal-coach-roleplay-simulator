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

test("normalizeHcpDialoguePunctuation repairs all-caps output while preserving key acronyms", () => {
  const input = "I AM REVIEWING THIS WITH THE HCP TEAM IN OUR EHR";
  const output = normalizeHcpDialoguePunctuation(input);
  assert.equal(output, "I am reviewing this with the HCP team in our EHR.");
});

test("normalizeHcpDialoguePunctuation preserves malformed-opener cleanup without forcing question intent", () => {
  const input = ", and what we do in clinic is keep follow-up tight";
  const output = normalizeHcpDialoguePunctuation(input);
  assert.equal(output, "And what we do in clinic is keep follow-up tight.");
});

test("normalizeHcpDialoguePunctuation adds spacing for sentence joins safely", () => {
  const input = "we reviewed adherence.Today we need one operational step";
  const output = normalizeHcpDialoguePunctuation(input);
  assert.equal(output, "We reviewed adherence. Today we need one operational step.");
});

test("normalizeHcpDialoguePunctuation merges standalone 'which' dependent fragments", () => {
  const input = "I'm doing well, thank you. However, I'd like to discuss our GDMT numbers. Which aren't where they should be";
  const output = normalizeHcpDialoguePunctuation(input);
  assert.equal(output, "I'm doing well, thank you. However, I'd like to discuss our GDMT numbers, which aren't where they should be.");
});

test("normalizeHcpDialoguePunctuation merges standalone 'because' fragments when incomplete", () => {
  const input = "We cannot change protocol today. Because staffing is still constrained";
  const output = normalizeHcpDialoguePunctuation(input);
  assert.equal(output, "We cannot change protocol today, because staffing is still constrained.");
});

test("normalizeHcpDialoguePunctuation keeps complete 'because' clauses as standalone sentences", () => {
  const input = "Because we are short-staffed today, we need one practical next step";
  const output = normalizeHcpDialoguePunctuation(input);
  assert.equal(output, "Because we are short-staffed today, we need one practical next step.");
});

test("normalizeHcpDialoguePunctuation corrects malformed 'On great question' openers", () => {
  const input = "On great question I think we should prioritize adherence";
  const output = normalizeHcpDialoguePunctuation(input);
  assert.equal(output, "Great question, I think we should prioritize adherence.");
});

test("normalizeHcpDialoguePunctuation is deterministic for repeated runs", () => {
  const input = "I'M LOOKING AT THE DATA, which endpoint would matter most";
  const first = normalizeHcpDialoguePunctuation(input);
  const second = normalizeHcpDialoguePunctuation(input);
  assert.equal(first, second);
});

test("normalizeHcpDialoguePunctuation is idempotent on normalized output", () => {
  const input = "I'm doing well, thank you. However, I'd like to discuss our GDMT numbers. Which aren't where they should be";
  const first = normalizeHcpDialoguePunctuation(input);
  const second = normalizeHcpDialoguePunctuation(first);
  assert.equal(second, first);
});
