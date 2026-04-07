import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { extractScenarioOwnedOpeningTurn } from "../src/components/roleplay/openingTurnAuthority.js";
import { buildHCPDialoguePrompt, buildHCPProfile, buildTurnSimulationBundle } from "../src/components/roleplay/hcpSimulationEngine.jsx";
import { buildHcpReactionContract } from "../src/components/roleplay/hcpReactionIntegrity.js";

const OPENING_SCENARIOS = [
  {
    id: "michael_case",
    title: "Monitoring Follow-Up",
    openingScene: `Michael checks upcoming follow-up slots and signals for one implementable monitoring step. "I can give you a minute, but keep this tied to the monitoring step we can actually use this week."`,
    sceneSetup: {
      openingLine: "I can give you a minute, but keep this tied to the monitoring step we can actually use this week.",
      timePressure: "medium",
      currentClinicalOperationalContext: "Monitoring workflow follow-up slots",
      openingCueSet: ["checks_follow_up_slots"],
    },
    hcpStateModel: { startingState: "time_pressed", allowedTransitions: {}, prohibitedTransitions: [] },
    hcpProfile: { baselineCommunicationStyle: "process_focused", baselineOpennessResistance: "skeptical", knownConstraints: ["workflow"] },
  },
  {
    id: "jennifer_case",
    title: "Screening Readiness",
    openingScene: `Jennifer highlights screening fields on a form, then asks with careful, practical focus. "Before we talk outcomes, I need to know how you would screen the right patients for this."`,
    sceneSetup: {
      openingLine: "Before we talk outcomes, I need to know how you would screen the right patients for this.",
      timePressure: "medium",
      currentClinicalOperationalContext: "Long-acting HIV candidate screening",
      openingCueSet: ["highlights_screening_fields"],
    },
    hcpStateModel: { startingState: "skeptical", allowedTransitions: {}, prohibitedTransitions: [] },
    hcpProfile: { baselineCommunicationStyle: "careful_practical", baselineOpennessResistance: "uncertain", knownConstraints: [] },
  },
  {
    id: "lisa_case",
    title: "Refill Gap Follow-Up",
    openingScene: `Lisa taps a follow-up list on the desk, then turns back with a practical, time-aware expression. "If this is about follow-up, start with the one refill gap you think we can close first."`,
    sceneSetup: {
      openingLine: "If this is about follow-up, start with the one refill gap you think we can close first.",
      timePressure: "high",
      currentClinicalOperationalContext: "Refill gap follow-up workflow",
      openingCueSet: ["taps_follow_up_list"],
    },
    hcpStateModel: { startingState: "time_pressed", allowedTransitions: {}, prohibitedTransitions: [] },
    hcpProfile: { baselineCommunicationStyle: "practical_direct", baselineOpennessResistance: "skeptical", knownConstraints: ["follow_up_workflow"] },
  },
];

const profile = buildHCPProfile({
  sessionId: "opening-authority",
  turnNumber: 1,
  structuralState: "time-pressured",
  temperature: "stressed",
  severity: 1,
});

test("scenario-owned opening parser extracts cue and dialogue from declared opening beat", () => {
  const opening = extractScenarioOwnedOpeningTurn(OPENING_SCENARIOS[0]);

  assert.match(opening.cueText, /Michael checks upcoming follow-up slots/i);
  assert.equal(opening.dialogueText, "I can give you a minute, but keep this tied to the monitoring step we can actually use this week.");
  assert.equal(opening.source, "scenario_opening_scene");
});

test("scenario-owned opening parser handles contractions and multiple quoted dialogue fragments", () => {
  const opening = extractScenarioOwnedOpeningTurn({
    id: "multi_quote_contraction_case",
    openingScene: "Dr. Patel glances at her watch as you enter. She's between patients, typing notes rapidly. 'I have about 10 minutes,' she says without looking up. 'What's this about?'",
  });

  assert.match(opening.cueText, /Dr\. Patel glances at her watch/i);
  assert.match(opening.cueText, /She's between patients, typing notes rapidly/i);
  assert.doesNotMatch(opening.cueText, /^S between/i);
  assert.equal(opening.dialogueText, "I have about 10 minutes. What's this about?");
  assert.doesNotMatch(opening.dialogueText, /she says|typing notes|between patients/i);
});

test("opening prompt carries deterministic scenario-owned authority marker", () => {
  const prompt = buildHCPDialoguePrompt({
    scenario: OPENING_SCENARIOS[0],
    hcpProfile: profile,
    historyText: "",
    isOpening: true,
  });

  assert.match(prompt, /ROLEPLAY_OPENING_TURN_AUTHORITY: scenario_owned/);
  assert.match(prompt, /ROLEPLAY_OPENING_DIALOGUE_EXACT: I can give you a minute/);
  assert.match(prompt, /OPENING TURN CONTRACT/);
  assert.doesNotMatch(prompt, /That is interesting, but my biggest issue is prior auth delays, not outcomes/);
});

test("turn simulation bundle exposes scenario-owned opening cue and dialogue", () => {
  const bundle = buildTurnSimulationBundle({
    sessionId: "opening-bundle",
    turnNumber: 1,
    scenario: OPENING_SCENARIOS[1],
    repMessage: "Hi, I'd like to follow up on outcomes data.",
    history: [],
    historyText: "",
    isOpening: true,
  });

  assert.equal(bundle.openingTurnAuthority, true);
  assert.match(bundle.cue, /Jennifer highlights screening fields/i);
  assert.match(bundle.openingDialogue, /screen the right patients/i);
  assert.match(bundle.prompt, /ROLEPLAY_OPENING_TURN_AUTHORITY: scenario_owned/);
});

test("first-turn reaction contract uses scenario-owned opening beat instead of collapsed generic blocker family", () => {
  const contracts = OPENING_SCENARIOS.map((scenario) => buildHcpReactionContract({
    scenario,
    turnNumber: 1,
    hcpState: "neutral",
    cueText: "Generic cue.",
    dialogueText: "That is interesting, but my biggest issue is prior auth delays, not outcomes.",
    activeConcern: "workflow",
    concernFlowOutcome: "missed",
    alignment: { score: 1, misalignments: ["missed_opening"], rubricAlignmentFlags: [] },
    repMessage: "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.",
  }));

  const dialogues = contracts.map((contract) => contract.selectedDialogueText);
  assert.equal(new Set(dialogues).size, OPENING_SCENARIOS.length);
  assert.ok(contracts.every((contract) => contract.enforcementTrace.openingTurnSource === "scenario_opening_scene"));
  for (const dialogue of dialogues) {
    assert.doesNotMatch(dialogue, /prior auth delays, not outcomes/i);
    assert.doesNotMatch(dialogue, /^keep this to one|^stay with one|^please tie this/i);
  }
});

test("worker source short-circuits roleplay opening authority before provider invocation", () => {
  const workerSource = fs.readFileSync(new URL("../src/worker.js", import.meta.url), "utf8");
  const providerIndex = workerSource.indexOf("const requestedProvider = body?.provider");
  const authorityIndex = workerSource.indexOf("const roleplayOpeningAuthority = roleplay ? extractRoleplayOpeningAuthority(prompt) : null");

  assert.ok(authorityIndex > 0, "worker should inspect deterministic opening authority");
  assert.ok(providerIndex > authorityIndex, "opening authority must bypass provider selection and LLM calls");
  assert.match(workerSource, /model: "deterministic_opening_turn"/);
});
