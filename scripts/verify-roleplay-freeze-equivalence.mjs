import { readFile } from "node:fs/promises";

const checks = [];

function recordCheck(name, pass, detail) {
  checks.push({ name, pass, detail });
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const freezeDoc = await readFile(new URL("../docs/FREEZE_roleplay-stable-rep-eval-2026-03-17.md", import.meta.url), "utf8");
const roleplayChat = await readFile(new URL("../src/components/roleplay/RolePlayChat.jsx", import.meta.url), "utf8");
const alignmentEngine = await readFile(new URL("../src/components/roleplay/alignmentEngine.jsx", import.meta.url), "utf8");
const hcpEngine = await readFile(new URL("../src/components/roleplay/hcpSimulationEngine.jsx", import.meta.url), "utf8");

recordCheck(
  "freeze doc declares REP-only + deterministic + 8-metric invariants",
  freezeDoc.includes("Only REP is evaluated")
    && freezeDoc.includes("Role play must remain deterministic")
    && freezeDoc.includes("8 metrics remain unchanged"),
  "Baseline invariants found in freeze reference document",
);

recordCheck(
  "alignment engine still defines 8 core metric ids",
  [
    "signal_awareness",
    "signal_interpretation",
    "value_connection",
    "customer_engagement",
    "objection_navigation",
    "conversation_management",
    "adaptive_response",
    "commitment_generation",
  ].every((metric) => alignmentEngine.includes(`${metric}:`)),
  "All expected rubric metric identifiers located",
);

recordCheck(
  "alignment computation occurs before state transition in runtime orchestration",
  roleplayChat.indexOf("computeAlignment(") >= 0
    && roleplayChat.indexOf("transitionState(") >= 0
    && roleplayChat.indexOf("computeAlignment(") < roleplayChat.indexOf("transitionState("),
  "Ordering in RolePlayChat keeps scoring against visible prior state",
);

recordCheck(
  "core roleplay engines avoid Math.random",
  !stripComments(alignmentEngine).includes("Math.random(")
    && !stripComments(hcpEngine).includes("Math.random("),
  "Deterministic-selection guarantee preserved in core scoring/state engines",
);

const failed = checks.filter((c) => !c.pass);
for (const check of checks) {
  const marker = check.pass ? "PASS" : "FAIL";
  console.log(`[${marker}] ${check.name} — ${check.detail}`);
}

if (failed.length > 0) {
  console.error(`\nFreeze-equivalence verification failed: ${failed.length} checks failed.`);
  process.exit(1);
}

console.log("\nFreeze-equivalence verification passed.");
