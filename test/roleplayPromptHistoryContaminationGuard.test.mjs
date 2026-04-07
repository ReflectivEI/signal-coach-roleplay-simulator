import test from "node:test";
import assert from "node:assert/strict";

import { buildHCPDialoguePrompt, buildHCPProfile } from "../src/components/roleplay/hcpSimulationEngine.jsx";

const SCENARIO = {
  title: "Runtime contamination guard scenario",
  description: "Busy clinic with operational pressure.",
  opening_scene: "The HCP is reviewing charts between patients.",
  hcp_category: "Primary Care",
  specialty: "Internal Medicine",
  disease_state: "General",
};

const PROFILE = buildHCPProfile({
  sessionId: "contamination-guard-test-session",
  turnNumber: 2,
  structuralState: "engaged",
  temperature: "neutral",
  severity: 0,
});

test("buildHCPDialoguePrompt excludes debug/test-summary contamination from conversation history", () => {
  const historyText = [
    "Sales Rep: Could we start with one workflow step for this week?",
    "HCP: Give me one practical action we can run immediately.",
    "HCP: Root cause: REP ignored testing output and patch notes.",
    "Sales Rep: SESSION SCORING DATA says we passed tests.",
    "HCP: REALISM_REPLAY_HARNESS_METRICS debug log shows mismatch.",
  ].join("\n");

  const prompt = buildHCPDialoguePrompt({
    scenario: SCENARIO,
    hcpProfile: PROFILE,
    historyText,
    isOpening: false,
  });

  assert.match(prompt, /Sales Rep: Could we start with one workflow step/i);
  assert.match(prompt, /HCP: Give me one practical action/i);
  assert.doesNotMatch(prompt, /root cause|testing output|SESSION SCORING DATA|REALISM_REPLAY_HARNESS_METRICS/i);
});

test("buildHCPDialoguePrompt preserves normal rep/HCP dialogue turns", () => {
  const historyText = [
    "Sales Rep: We can pilot a checklist at intake.",
    "HCP: What metric would show it is helping within two weeks?",
    "Sales Rep: We can track same-day completion and prior-auth turnaround.",
  ].join("\n");

  const prompt = buildHCPDialoguePrompt({
    scenario: SCENARIO,
    hcpProfile: PROFILE,
    historyText,
    isOpening: false,
  });

  assert.match(prompt, /Sales Rep: We can pilot a checklist at intake\./i);
  assert.match(prompt, /HCP: What metric would show it is helping/i);
  assert.match(prompt, /Sales Rep: We can track same-day completion/i);
});

test("active live route chain remains wired to prompt-context assembly", () => {
  const prompt = buildHCPDialoguePrompt({
    scenario: SCENARIO,
    hcpProfile: PROFILE,
    historyText: "Sales Rep: I'd like to focus on one concrete next step.\nHCP: Keep it practical.",
    isOpening: false,
  });

  assert.match(prompt, /SCENARIO: "Runtime contamination guard scenario"/);
  assert.match(prompt, /CONVERSATION HISTORY:/);
  assert.match(prompt, /Sales Rep: I'd like to focus on one concrete next step\./i);
});

test("buildHCPDialoguePrompt uses runtime-visible scenario context instead of hidden authoring facts", () => {
  const prompt = buildHCPDialoguePrompt({
    scenario: {
      ...SCENARIO,
      description: "Visible clinic setup about an elusive diagnosis.",
      context: "Hidden authoring fact: Average time to diagnosis is 5 years.",
      visibleScenarioContext: "Visible clinic setup about an elusive diagnosis and a time-limited chart review.",
    },
    hcpProfile: PROFILE,
    historyText: "Sales Rep: Elusive how?",
    isOpening: false,
  });

  assert.match(prompt, /Visible clinic setup about an elusive diagnosis/i);
  assert.doesNotMatch(prompt, /Average time to diagnosis is 5 years/i);
  assert.match(prompt, /raw authoring\/background context as non-speakable/i);
});
