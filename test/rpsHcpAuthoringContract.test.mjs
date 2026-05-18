import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workerSource = fs.readFileSync(
  new URL("../worker/index.ts", import.meta.url),
  "utf8",
);

const simulatorSource = fs.readFileSync(
  new URL("../src/pages/Simulator.jsx", import.meta.url),
  "utf8",
);

const apiSource = fs.readFileSync(
  new URL("../src/features/rps/api.js", import.meta.url),
  "utf8",
);

test("RPS HCP authoring route is dedicated to Predictive Builder Test HCP Response contract", () => {
  assert.match(workerSource, /function buildPredictiveBuilderHcpVoiceResult/);
  assert.match(workerSource, /This is the global RPS HCP voice contract/);
  assert.match(workerSource, /mirrors the Predictive Builder "Test HCP Response" baseline/);
  assert.match(workerSource, /At neutral realism 5\/10, sound professional, thoughtful, calm/);
  assert.match(workerSource, /predictive_hcp_response_source:\s*"predictive_builder_test_hcp_response"/);
  assert.match(apiSource, /request\("\/api\/rps\/predictive-hcp-response"/);
  assert.match(simulatorSource, /predictiveSource !== "predictive_builder_test_hcp_response"/);
});

test("RPS HCP authoring contract blocks evaluator and right-panel contamination", () => {
  const authoringFunction = workerSource.slice(
    workerSource.indexOf("async function authorPredictiveHcpResponse"),
    workerSource.indexOf("async function buildPredictiveBuilderHcpVoiceResult"),
  );

  assert.match(authoringFunction, /right-panel recommendations.*hidden context only/);
  assert.match(authoringFunction, /They must never become the HCP's spoken voice/);
  assert.match(authoringFunction, /Do not copy REP-evaluation, right-panel recommendation, coaching, state-machine, or fallback text/);
  assert.doesNotMatch(authoringFunction, /Preferred shape examples/);
  assert.doesNotMatch(authoringFunction, /Evidence is the issue\. I need/);
  assert.doesNotMatch(authoringFunction, /That still does not tell me/);
});

test("deterministic HCP fallback phrase authoring is disabled in predictive route", () => {
  assert.doesNotMatch(workerSource, /function buildScenarioSpecificFallbackLine/);
  assert.match(workerSource, /Deterministic HCP fallback authoring is disabled by contract/);
  assert.match(workerSource, /predictive_builder_hcp_authoring_failed/);
});

test("predictive HCP route normalizes punctuation before returning authoritative dialogue", () => {
  assert.match(workerSource, /function enforceWorkerHcpPunctuation/);
  assert.match(workerSource, /questionStarterPattern/);
  assert.match(workerSource, /looksIndependent/);
  assert.match(workerSource, /enforceWorkerHcpPunctuation\(naturalizePredictiveHcpLine\(value\)\)/);
});

test("predictive HCP route rejects unsupported invented specificity", () => {
  assert.match(workerSource, /function hasUnsupportedSpecificity/);
  assert.match(workerSource, /Do not invent patient subgroups, disease subtypes, endpoints, outcomes/);
  assert.match(workerSource, /Regenerate without unsupported specificity/);
  assert.match(workerSource, /supportedSpecificityText/);
});
