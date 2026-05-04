import {
  buildTranscriptAudit,
  detectDialogueContinuityBreak,
  detectQuestionObligationFailure,
  validatePersonaFit,
  validateTurnAgainstScenarioState,
} from "../src/lib/qaTwinAudit.js";

type TestResult = { name: string; passed: boolean; error?: string };

const results: TestResult[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    results.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: message });
    console.error(`FAIL ${name}: ${message}`);
  }
}

test("time-constrained pressure drift is flagged", () => {
  const state = validateTurnAgainstScenarioState({
    turn: { speaker: "hcp", text: "Sure, I can go through all of that in detail." },
    scenario: { interactionPressure: ["time_constrained"], journeyStage: "initial_access" },
    detectedJourneyStage: "initial_access",
    detectedPressures: [],
    tone: "neutral",
  });

  assert(
    state.failures.some((failure: any) => failure.type === "interaction_pressure_mismatch"),
    "expected interaction pressure mismatch",
  );
});

test("initial-access gatekeeping remains allowed", () => {
  const audit = buildTranscriptAudit({
    scenario: {
      journeyStage: "initial_access",
      interactionPressure: ["time_constrained"],
      persona: "community clinician",
    },
    turns: [
      { speaker: "rep", text: "Thanks for taking a minute. I can keep this focused." },
      { speaker: "hcp", text: "I've only got a minute. What's this about?" },
    ],
    personaKey: "calibration",
  });

  const hardFailure = (audit.failures || []).find((failure: any) =>
    ["continuity_break", "question_obligation_failure", "conversation_stagnation"].includes(failure.type),
  );

  assert(!hardFailure, "gatekeeping opener should not create hard continuity failures");
});

test("workflow plausibility catches missing operational anchor", () => {
  const state = validateTurnAgainstScenarioState({
    turn: { speaker: "hcp", text: "I am broadly unconvinced by the positioning." },
    scenario: {
      interactionPressure: ["operationally_constrained"],
      journeyStage: "objection_handling",
    },
    detectedJourneyStage: "objection_handling",
    detectedPressures: ["skeptical_resistant"],
    tone: "skeptical",
  });

  assert(
    state.failures.some((failure: any) => failure.type === "workflow_implausible"),
    "expected workflow implausibility",
  );
});

test("persona-fit catches abstract ungrounded HCP line", () => {
  const fit = validatePersonaFit({
    turn: { text: "The treatment landscape remains conceptually complex." },
    scenario: { persona: "community-based clinician" },
    humanCadence: { grounded: false },
    decisionDriven: false,
    personaCadence: false,
  });

  assert(fit.pass === false, "expected persona-fit failure");
  assert(fit.type === "poor_persona_fit" || fit.type === "poor_specialty_fit", "unexpected persona failure type");
});

test("question obligation allows answer-first then narrow question", () => {
  const failure = detectQuestionObligationFailure({
    previousTurn: { speaker: "hcp", text: "What specifically changes for my staff?" },
    currentTurn: {
      speaker: "rep",
      text: "The first change is fewer callback loops for your staff, so requests do not reopen. Which part of that loop is heaviest right now?",
    },
  });

  assert(!failure, "answer-first with narrow follow-up should not fail");
});

test("question obligation fails on pure question deflection", () => {
  const failure = detectQuestionObligationFailure({
    previousTurn: { speaker: "hcp", text: "What specifically changes for my staff?" },
    currentTurn: { speaker: "rep", text: "Where is the biggest problem right now?" },
  });

  assert(Boolean(failure), "expected obligation failure");
  assert(failure?.type === "question_obligation_failure", "unexpected failure type");
});

test("repetition detection ignores repeated question when forward progress exists", () => {
  const continuity = detectDialogueContinuityBreak({
    previousTurn: { speaker: "hcp", text: "What changes in workflow?" },
    currentTurn: {
      speaker: "rep",
      text: "The change is fewer callback loops for staff. Which callback step is still slowing things down?",
      concept: "workflow_callback",
    },
    scenario: {},
    turnNumber: 4,
    allTurns: [
      { speaker: "rep", text: "Which callback step is slowing things down?", concept: "workflow_callback" },
      { speaker: "hcp", text: "Mostly missing info and repeat callbacks." },
      { speaker: "rep", text: "The change is fewer callback loops for staff. Which callback step is still slowing things down?", concept: "workflow_callback" },
    ],
  });

  const loop = continuity.failures.find((failure: any) => failure.type === "repetition_or_looping");
  assert(!loop, "forward-progress answer should avoid repetition failure");
});

test("repetition detection flags repeated discovery loop without progress", () => {
  const continuity = detectDialogueContinuityBreak({
    previousTurn: { speaker: "hcp", text: "What changes in workflow?" },
    currentTurn: {
      speaker: "rep",
      text: "Which workflow step is still the biggest roadblock?",
      concept: "workflow_roadblock",
    },
    scenario: {},
    turnNumber: 4,
    allTurns: [
      { speaker: "rep", text: "Which workflow step is still the biggest roadblock?", concept: "workflow_roadblock" },
      { speaker: "hcp", text: "I need an actual answer." },
      { speaker: "rep", text: "Which workflow step is still the biggest roadblock?", concept: "workflow_roadblock" },
    ],
  });

  const loop = continuity.failures.find((failure: any) => failure.type === "repetition_or_looping");
  assert(Boolean(loop), "expected repetition loop failure");
});

test("audit output includes severity and evidence details", () => {
  const audit = buildTranscriptAudit({
    scenario: {
      journeyStage: "objection_handling",
      interactionPressure: ["skeptical_resistant"],
      persona: "community clinician",
    },
    turns: [
      { speaker: "hcp", text: "Not interested. Why should I change?" },
      { speaker: "rep", text: "Can you elaborate on what concerns you the most?" },
      { speaker: "hcp", text: "I already told you. What specifically changes for staff?" },
      { speaker: "rep", text: "Where is the biggest roadblock right now?" },
    ],
    personaKey: "calibration",
  });

  assert(typeof audit.severityCounts === "object", "severityCounts missing");
  assert(typeof audit.rootCauseClassification === "object", "rootCauseClassification missing");

  const firstFailure = (audit.failures || [])[0];
  assert(Boolean(firstFailure?.severity), "failure severity missing");
  assert(Boolean(firstFailure?.evidenceDetails), "failure evidenceDetails missing");
});

const passed = results.filter((result) => result.passed).length;
const total = results.length;

console.log(`\nQA realism calibration: ${passed}/${total} passed`);

if (passed !== total) {
  process.exit(1);
}
