#!/usr/bin/env node

import { normalizeMessage } from "../src/lib/messageNormalization.js";

const SCENARIO_FAMILY_LEXICAL_PACKS = Object.freeze({
  hiv_prep: ["prep", "prior auth", "coverage", "adherence", "screening", "resistance", "back-and-forth", "resubmission"],
  oncology_access: ["regimen", "line of therapy", "biomarker", "pathway", "prior auth", "reimbursement", "denial", "infusion"],
  cardiometabolic: ["step therapy", "formulary", "coverage", "adherence", "refill", "prior auth", "care coordination"],
  general_access: ["prior auth", "approval", "paperwork", "workflow", "staff burden", "clinic flow", "resubmission"],
});

const TERMINAL_CLOSE_POLICY_MATRIX = Object.freeze({
  engaged: { missed: "probe", overpivot: "probe", aligned: "continue", neutral: "continue" },
  constrained: { missed: "probe", overpivot: "probe", aligned: "continue", neutral: "continue" },
  impatient: { missed: "probe", overpivot: "probe", aligned: "continue", neutral: "continue" },
  disengaging: { missed: "close", overpivot: "close", aligned: "probe", neutral: "probe" },
  disengaged: { missed: "close", overpivot: "close", aligned: "close", neutral: "close" },
});

function hasWorkflowOperationalLanguage(text = "") {
  return /\b(prior auth|prior authorization|approval|approvals|paperwork|workflow|resubmission|resubmissions|bottleneck|back-and-forth|back and forth|staff burden|clinic flow|implementation|feasibility|team load)\b/i.test(String(text || ""));
}

function hasEvidencePivotLanguage(text = "") {
  return /\b(jama|study|trial|data|outcomes|efficacy|disease progression|adoption|publication|findings)\b/i.test(String(text || ""));
}

function detectScenarioFamily(scenarioText = "") {
  const value = String(scenarioText || "").toLowerCase();
  if (/\bprep|hiv|sti|cabotegravir|long-acting\b/.test(value)) return "hiv_prep";
  if (/\boncology|tumor|metastatic|biomarker|chemo|immunotherapy\b/.test(value)) return "oncology_access";
  if (/\bcardio|heart|lipid|diabetes|a1c|glp-1|hypertension\b/.test(value)) return "cardiometabolic";
  return "general_access";
}

function hasScenarioOperationalLexicalMatch(text = "", scenarioFamily = "general_access") {
  const value = String(text || "").toLowerCase();
  const pack = SCENARIO_FAMILY_LEXICAL_PACKS[scenarioFamily] || SCENARIO_FAMILY_LEXICAL_PACKS.general_access;
  return pack.some((token) => value.includes(token));
}

function isOperationalFalsePositiveContext(text = "") {
  const value = String(text || "").toLowerCase();
  return /\b(data workflow|workflow analysis of study|publication workflow|research workflow|trial operations)\b/.test(value);
}

function classifyConcernFlowOutcome({ activeConcern = "workflow", repMessage = "", priorRepMessage = "", scenarioFamily = "general_access" } = {}) {
  const concernIsOperational = activeConcern === "workflow" || activeConcern === "access" || activeConcern === "time";
  if (!concernIsOperational) return "neutral";

  const repOperational = (hasWorkflowOperationalLanguage(repMessage) || hasScenarioOperationalLexicalMatch(repMessage, scenarioFamily))
    && !isOperationalFalsePositiveContext(repMessage);
  const repEvidence = hasEvidencePivotLanguage(repMessage);
  const priorOperational = (hasWorkflowOperationalLanguage(priorRepMessage) || hasScenarioOperationalLexicalMatch(priorRepMessage, scenarioFamily))
    && !isOperationalFalsePositiveContext(priorRepMessage);

  if (repEvidence && !repOperational && priorOperational) return "overpivot";
  if (repEvidence && !repOperational) return "missed";
  if (repOperational) return "aligned";
  return "neutral";
}

function detectRepCloseIntent(text = "") {
  const sample = String(text || "").toLowerCase();
  const hardPattern = /\b(bye|goodbye|i need to leave|i have to go|i must leave|i need to run|time to go|i have another patient|i'm stepping out)\b/;
  const softPattern = /\b(wrap up|i'll leave it there|appreciate your time|happy to reconnect|follow up later|we can revisit|i don’t want to take more of your time|i know your schedule is tight|let’s reconnect)\b/;
  if (hardPattern.test(sample)) return "hard";
  if (softPattern.test(sample)) return "soft";
  return "none";
}

function determineTerminalPolicyAction({ hcpState = "engaged", concernFlowOutcome = "neutral", unresolvedConcernTurns = 0 } = {}) {
  const statePolicy = TERMINAL_CLOSE_POLICY_MATRIX[hcpState] || TERMINAL_CLOSE_POLICY_MATRIX.engaged;
  if (hcpState === "impatient" && unresolvedConcernTurns >= 5 && (concernFlowOutcome === "missed" || concernFlowOutcome === "overpivot")) {
    return "close";
  }
  return statePolicy[concernFlowOutcome] || "continue";
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runArchetypeFixtures() {
  const scenarioFamily = detectScenarioFamily("hiv prep prior auth workflow");

  const scenario1Rep = [
    "The study showed significant improvement in adherence and outcomes.",
    "One key finding was reduced disease progression by nearly 30%.",
    "That is why this data matters for treatment decisions.",
  ];
  const scenario1Outcomes = scenario1Rep.map((rep, i) =>
    classifyConcernFlowOutcome({
      activeConcern: "workflow",
      repMessage: rep,
      priorRepMessage: scenario1Rep[Math.max(0, i - 1)] || "",
      scenarioFamily,
    })
  );
  assert(scenario1Outcomes.filter((v) => v === "missed" || v === "overpivot").length >= 2, "Scenario 1 should show repeated misses/overpivots.");

  const scenario2Rep = [
    "I know prior auth has been slowing things down and want to focus on that.",
    "Structured workflows reduce prior auth back-and-forth and resubmissions.",
    "The goal is reducing repeat work without adding burden.",
  ];
  const scenario2Outcomes = scenario2Rep.map((rep, i) =>
    classifyConcernFlowOutcome({
      activeConcern: "workflow",
      repMessage: rep,
      priorRepMessage: scenario2Rep[Math.max(0, i - 1)] || "",
      scenarioFamily,
    })
  );
  assert(scenario2Outcomes.filter((v) => v === "aligned").length >= 2, "Scenario 2 should remain mostly aligned.");
  assert(!scenario2Outcomes.some((v) => v === "missed" || v === "overpivot"), "Scenario 2 should not overpivot.");

  const scenario3Rep = [
    "Some clinics reduce delays by tightening submission workflow upfront.",
    "A new JAMA study shows improved outcomes with earlier use.",
    "The data is compelling and driving adoption.",
    "Understood, those submission workflows can help with prior auth.",
  ];
  const scenario3Outcomes = scenario3Rep.map((rep, i) =>
    classifyConcernFlowOutcome({
      activeConcern: "workflow",
      repMessage: rep,
      priorRepMessage: scenario3Rep[Math.max(0, i - 1)] || "",
      scenarioFamily,
    })
  );
  assert(scenario3Outcomes[0] === "aligned", "Scenario 3 should start aligned.");
  assert(scenario3Outcomes[1] === "overpivot" || scenario3Outcomes[1] === "missed", "Scenario 3 should overpivot on second turn.");
  assert(scenario3Outcomes[3] === "aligned", "Scenario 3 should recover to aligned.");
}

function runClosureFixture() {
  const closeIntent = detectRepCloseIntent("I appreciate your time today and I'll wrap up here.");
  assert(closeIntent === "soft", "Closure fixture should detect soft close intent.");

  const action = determineTerminalPolicyAction({
    hcpState: "disengaging",
    concernFlowOutcome: "overpivot",
    unresolvedConcernTurns: 5,
  });
  assert(action === "close", "Terminal close policy should close under prolonged disengaging overpivot.");
}

function runNormalizationFixture() {
  const normalized = normalizeMessage("submission is complete the Before we go further, time and avoids rework");
  assert(!/before we go further/i.test(normalized), "Normalization should strip malformed 'Before we go further' artifact.");
}

function runMalformedSentenceFixture() {
  const hasMalformedQuestionStem = (text = "") =>
    /\bhow should we (?:the|this|that|these|those)\b/i.test(String(text || "").trim());

  const malformedPatterns = [
    "How should we the study's findings on faster initiation?",
    "How should we this approach for our clinic?",
  ];
  malformedPatterns.forEach((line) => {
    assert(hasMalformedQuestionStem(line), "Malformed fixture should detect broken 'How should we …' stems.");
  });

  const validPatterns = [
    "How should we apply the study's findings on faster initiation?",
    "How should we interpret these findings for clinic workflow?",
  ];
  validPatterns.forEach((line) => {
    assert(!hasMalformedQuestionStem(line), "Malformed fixture should not flag valid stems.");
  });
}

function runConcernResolutionFixture() {
  const extractOperationalFocusSlots = (text = "") => {
    const value = String(text || "").toLowerCase();
    const slots = new Set();
    if (/\b(ehr|emr|chart|order set|smart phrase|smartphrase|template|note workflow|system integration)\b/.test(value)) slots.add("integration");
    if (/\b(train|training|onboard|education|staff capability|role assignment|owner)\b/.test(value)) slots.add("training");
    if (/\b(time cost|time|seconds|minutes|visit flow|throughput|slow|workload|burden)\b/.test(value)) slots.add("time_cost");
    if (/\b(handoff|step|process|prescribing|documentation|checklist|prior auth|coverage|reimbursement|payer)\b/.test(value)) slots.add("workflow_step");
    return slots;
  };
  const doesRepResolveLatestOperationalAsk = ({ repMessage = "", lastHcpDialogue = "" } = {}) => {
    const required = extractOperationalFocusSlots(lastHcpDialogue);
    if (!required.size) return true;
    const repSlots = extractOperationalFocusSlots(repMessage);
    if (!repSlots.size) return false;
    let matched = 0;
    required.forEach((slot) => {
      if (repSlots.has(slot)) matched += 1;
    });
    return matched >= Math.max(1, Math.ceil(required.size * 0.5));
  };

  const hcpAsk = "How would this confirmation process work in our current EHR system, and would it require additional staff training?";
  const nonAnswer = "From your perspective, does reducing downstream rework feel like it would make a difference day-to-day?";
  const validAnswer = "We can use an EHR smart phrase at prescribing and give staff a brief 10-minute training huddle.";

  assert(!doesRepResolveLatestOperationalAsk({ repMessage: nonAnswer, lastHcpDialogue: hcpAsk }), "Concern fixture should flag unanswered EHR/training ask.");
  assert(doesRepResolveLatestOperationalAsk({ repMessage: validAnswer, lastHcpDialogue: hcpAsk }), "Concern fixture should pass when EHR/training ask is addressed.");
}

function main() {
  runArchetypeFixtures();
  runClosureFixture();
  runNormalizationFixture();
  runMalformedSentenceFixture();
  runConcernResolutionFixture();
  // eslint-disable-next-line no-console
  console.log("Roleplay replay harness passed: archetypes + closure + malformed sentence + concern resolution fixtures.");
}

main();
