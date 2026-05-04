import { ALL_SCENARIOS } from "../src/lib/scenarioCatalog.js";
import {
  addPersonaSpecificAnchor,
  buildScenarioRouting,
  detectTopicLanes,
  enforceJourneyStageFit,
  enforcePressureFit,
  enforceScenarioTopicLane,
  summarizeRoutingAlignment,
} from "../src/lib/scenarioRouting";
import { buildDeterministicQaRepReply } from "../src/lib/qaRepProxy.js";
import { validateTurnAgainstScenarioState } from "../src/lib/qaTwinAudit.js";

type TestResult = { name: string; passed: boolean; error?: string };
const results: TestResult[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
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

function getScenarioByTitle(title: string) {
  const scenario = ALL_SCENARIOS.find((item) => String(item?.title || "").toLowerCase() === title.toLowerCase());
  if (!scenario) throw new Error(`Scenario not found: ${title}`);
  return scenario;
}

const gatekeeper = getScenarioByTitle("The Gatekeeper Filter");
const clinical = getScenarioByTitle("The Data That Doesn't Land");
const access = getScenarioByTitle("The Formulary Firewall");
const workflow = getScenarioByTitle("The Workflow Bottleneck");
const safety = getScenarioByTitle("The Unexpected Safety Flag");

test("Initial Access routing blocks prior-auth drift", () => {
  const routing = buildScenarioRouting(gatekeeper);
  const repaired = enforceScenarioTopicLane({
    draft_hcp_response: "Which prior auth step is driving callbacks right now?",
    scenario_routing: routing,
    rep_message: "Can I share why this is relevant?",
    hcp_state: "closed",
  });

  assert(repaired.changed, "expected repair for disallowed prior-auth lane in initial access");
  const lanes = detectTopicLanes(repaired.text);
  assert(!lanes.includes("prior_auth"), "prior-auth lane should be removed after repair");
  assert(!/prior auth|prior authorization|workflow|staff|callback/i.test(repaired.text), "initial access reply must not leak workflow/prior-auth language");
  assert(/minute|relevan|why/i.test(repaired.text), "initial access reply should keep relevance or time-gating language");
});

test("Clinical Value routing stays clinical/evidence and blocks workflow drift", () => {
  const routing = buildScenarioRouting(clinical);
  const repaired = enforceScenarioTopicLane({
    draft_hcp_response: "How does this change workflow and callbacks for staff?",
    scenario_routing: routing,
    rep_message: "Let's discuss the trial subgroup data.",
    hcp_state: "neutral",
  });

  const lanes = detectTopicLanes(repaired.text);
  assert(!lanes.includes("workflow_implementation"), "workflow lane should be blocked in clinical-value scenario");
  assert(!/workflow|staff|callback|prior auth|formulary/i.test(repaired.text), "clinical value line must not leak access/workflow terms");
});

test("Access routing keeps access lanes active", () => {
  const routing = buildScenarioRouting(access);
  const summary = summarizeRoutingAlignment({
    text: "If this is non-preferred, what is the prior auth path and what would move review?",
    scenarioRouting: routing,
  });

  assert(summary.matched_topic_lanes.includes("access_formulary") || summary.matched_topic_lanes.includes("prior_auth"), "expected access lane match");
  assert(summary.prohibited_topic_detected.length === 0, "access lane should not be flagged as prohibited");
  assert(!summary.matched_topic_lanes.includes("clinical_value"), "access/formulary test should minimize clinical drift");
});

test("Workflow scenario allows workflow language and QA does not falsely flag lane", () => {
  const routing = buildScenarioRouting(workflow);
  const validation = validateTurnAgainstScenarioState({
    turn: { speaker: "hcp", text: "If this adds another step for my staff, it will break the workflow." },
    scenario: workflow,
    scenarioRouting: routing,
    detectedJourneyStage: "adoption_implementation",
    detectedPressures: ["operationally_constrained"],
    tone: "neutral",
  });

  const hasLaneMismatch = validation.failures.some((failure: any) =>
    failure.type === "journey_stage_mismatch" && Array.isArray(failure.prohibited_topic_detected) && failure.prohibited_topic_detected.length > 0,
  );
  assert(!hasLaneMismatch, "workflow lane should not be prohibited for workflow scenario");
});

test("Safety scenario keeps safety language", () => {
  const routing = buildScenarioRouting(safety);
  const stage = enforceJourneyStageFit({
    draft_hcp_response: "I need a clearer answer on that hepatic signal before I move further.",
    journey_stage: safety.journeyStage,
    scenario_routing: routing,
    hcp_state: "neutral",
  });

  assert(!stage.changed, "safety-aligned line should pass without repair");
});

test("Time constrained pressure enforces concise expression", () => {
  const routing = buildScenarioRouting(gatekeeper);
  const constrained = enforcePressureFit({
    draft_hcp_response: "Can you walk me through every operational element here and also explain what happens after authorization and then how the committee thinks about this and what the full workflow looks like?",
    interaction_pressure: ["time_constrained"],
    scenario_routing: routing,
  });

  const questionCount = (constrained.text.match(/\?/g) || []).length;
  assert(questionCount <= 1, "time constrained output must have max one question");
  assert(/minute|short version|quick/i.test(constrained.text), "time constrained output should carry time pressure signal");
});

test("Persona anchor is added when line lacks any practical anchor", () => {
  const routing = buildScenarioRouting(clinical);
  const anchored = addPersonaSpecificAnchor({
    draft_hcp_response: "That still feels broad",
    scenario_routing: routing,
  });

  assert(anchored.changed, "expected anchor insertion");
  assert(/patients|decision|practice/i.test(anchored.text), "anchored line should include practical anchor");
});

test("QA scripted fallback avoids stale workflow phrase in non-access scenario", () => {
  const turns = [{ speaker: "hcp", text: "What data point would actually change treatment choice for my renal patients?" }];
  const reply = buildDeterministicQaRepReply({ scenario: clinical, turns, draft: "" });
  assert(!/fewer rework touchpoints|first submission is complete|one complete pass|callback cleanup step/i.test(reply.text), "stale workflow fallback phrase leaked");
});

test("Repetition guard blocks stale fallback phrases across scenarios", () => {
  const clinicalReply = buildDeterministicQaRepReply({
    scenario: clinical,
    turns: [{ speaker: "hcp", text: "Give me one proof point that changes treatment choice." }],
    draft: "",
  });
  const accessReply = buildDeterministicQaRepReply({
    scenario: access,
    turns: [{ speaker: "hcp", text: "If this is non-preferred, what would change the access path?" }],
    draft: "",
  });

  const blocked = /fewer rework touchpoints|first submission is complete|callback cleanup step/i;
  assert(!blocked.test(clinicalReply.text), "clinical scenario leaked stale fallback phrase");
  assert(!blocked.test(accessReply.text), "access scenario leaked stale fallback phrase");
});

test("Hard enforcement rewrites disallowed topic terms", () => {
  const routing = buildScenarioRouting(clinical);
  const repaired = enforceScenarioTopicLane({
    draft_hcp_response: "This adds prior auth work and callback burden for staff.",
    scenario_routing: routing,
    rep_message: "Let's focus on subgroup evidence.",
    hcp_state: "skeptical",
  });

  assert(repaired.changed, "expected hard enforcement to rewrite or repair disallowed terms");
  assert(repaired.violation_detected === true, "violation_detected should be true when disallowed terms appear");
  assert(repaired.action === "rewritten", "disallowed lane enforcement should mark rewritten action");
  assert(Array.isArray(repaired.detected_terms) && repaired.detected_terms.length > 0, "detected terms should be logged");
  assert(!/prior auth|callback|staff|workflow/i.test(repaired.text), "rewritten output must remove blocked terms");
});

const passed = results.filter((result) => result.passed).length;
const total = results.length;

console.log(`\nScenario routing guardrails: ${passed}/${total} passed`);
if (passed !== total) process.exit(1);
