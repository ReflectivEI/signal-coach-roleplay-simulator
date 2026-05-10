// smoke-dialogue-realism.test.ts
// Fun smoke test: 6-8 exchanges, 3-4 random scenarios, realism check
import { ALL_SCENARIOS } from "../src/lib/scenarioCatalog.js";
import { buildScenarioContract } from "../worker/rps/engine.js";
import { evaluateRepResponse } from "../worker/rps/engine.js";

function getRandomElements(arr, n) {
  const result = [];
  const taken = new Set();
  while (result.length < n && taken.size < arr.length) {
    const idx = Math.floor(Math.random() * arr.length);
    if (!taken.has(idx)) {
      result.push(arr[idx]);
      taken.add(idx);
    }
  }
  return result;
}

const scenarios = getRandomElements(ALL_SCENARIOS, 4);

scenarios.forEach((scenario, i) => {
  console.log(`\n--- Scenario ${i + 1}: ${scenario.title} ---`);
  const contract = buildScenarioContract({ ...scenario });
  let memory = { resistance_trend: "stable", trust_trend: "neutral" };
  let lastRep = "";
  let lastHcp = scenario.openingScene;
  for (let turn = 1; turn <= 8; ++turn) {
    // Simulate a rep response (for fun, echo HCP with a cue-aligned question)
    lastRep = `I hear: "${lastHcp}". What matters most about that for your practice?`;
    const evalResult = evaluateRepResponse({
      repResponseTranscript: lastRep,
      cueSignal: contract.cue_signal,
      repSelectedTemperature: 6,
      scenarioContext: contract,
      conversationMemory: memory,
    });
    memory = evalResult.conversation_memory;
    // Simulate HCP reply (for fun, escalate or de-escalate based on resistance)
    lastHcp = memory.resistance_trend === "rising"
      ? "I'm not sure this is relevant."
      : "That actually could help, but...";
    console.log(`Turn ${turn}:`);
    console.log(`  Rep: ${lastRep}`);
    console.log(`  HCP: ${lastHcp}`);
    console.log(`  [Score: ${evalResult.overall_score}, Resistance: ${memory.resistance_trend}]`);
  }
});
