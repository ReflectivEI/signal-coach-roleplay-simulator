import assert from "node:assert/strict";
import { buildQaRepTurnTrace, enforceRepAnswerFirstContract } from "../src/lib/qaRepProxy.js";

const baseScenario = {
  title: "QA Persona Separation",
  journeyStage: "clinical_value",
  interactionPressure: ["skeptical_resistant"],
  objective: "Answer evidence-fit questions without flattening persona behavior.",
};

function runNonDirectSolutionSeekingSeparation() {
  const turns = [
    { speaker: "hcp", text: "What does your product do for patients like mine?" },
  ];
  const workerDraft = "The concrete difference is one subgroup proof point that would change treatment choice for the renal-impaired patient you raised.";

  const strong = enforceRepAnswerFirstContract({
    scenario: baseScenario,
    turns,
    draft: { text: workerDraft, concept: null },
    personaKey: "strong_rep",
    turnIndex: 0,
  });
  const mediocre = enforceRepAnswerFirstContract({
    scenario: baseScenario,
    turns,
    draft: { text: workerDraft, concept: null },
    personaKey: "mediocre_rep",
    turnIndex: 0,
  });
  const weak = enforceRepAnswerFirstContract({
    scenario: baseScenario,
    turns,
    draft: { text: workerDraft, concept: null },
    personaKey: "weak_rep",
    turnIndex: 0,
  });

  assert.notEqual(strong.text, mediocre.text, "Expected strong and mediocre outputs to stay distinct for non-direct solution-seeking turns");
  assert.notEqual(strong.text, weak.text, "Expected strong and weak outputs to stay distinct for non-direct solution-seeking turns");
  assert.notEqual(mediocre.text, weak.text, "Expected mediocre and weak outputs to stay distinct for non-direct solution-seeking turns");
}

function runTraceShapeValidation() {
  const turns = [
    { speaker: "hcp", text: "What does your product do for patients like mine?" },
  ];
  const finalReply = enforceRepAnswerFirstContract({
    scenario: baseScenario,
    turns,
    draft: { text: "The main difference is the broader clinical value this could create across appropriate patients overall.", concept: null },
    personaKey: "weak_rep",
    turnIndex: 0,
  });
  const trace = buildQaRepTurnTrace({
    scenario: baseScenario,
    turns,
    personaKey: "weak_rep",
    repGenerationSource: "worker_mock_placeholder",
    generatedRepText: finalReply.text,
  });

  assert.deepEqual(
    Object.keys(trace),
    ["personaKey", "repGenerationSource", "directAskDetected", "repStrategy", "answerQuality", "loopRisk", "generatedRepText"],
    "Expected stable QA trace keys",
  );
  assert.equal(trace.personaKey, "weak_rep");
  assert.equal(trace.repGenerationSource, "worker_mock_placeholder");
  assert.equal(trace.directAskDetected, false);
  assert.equal(trace.repStrategy, "generic_pitch");
}

runNonDirectSolutionSeekingSeparation();
runTraceShapeValidation();

console.log("qa-persona-separation: focused validation tests passed");