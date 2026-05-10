#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "docs/governance/runtime-vnext/MASTER_RUNTIME_VNEXT.md",
  "docs/governance/runtime-vnext/GOVERNANCE_CHARTER.md",
  "docs/governance/runtime-vnext/registries/protected-surface-registry.yaml",
  "docs/governance/runtime-vnext/registries/ontology-baseline-registry.yaml",
  "docs/governance/runtime-vnext/registries/explainability-baseline-registry.yaml",
  "docs/governance/runtime-vnext/registries/dependency-registry.yaml",
  "docs/governance/runtime-vnext/registries/protected-path-registry.yaml",
  "docs/governance/runtime-vnext/checkpoints/checkpoint-constitution-g0-g7.md",
  "docs/governance/runtime-vnext/frameworks/drift-detection-framework.md",
  "docs/governance/runtime-vnext/frameworks/rollback-governance-framework.md",
  "docs/governance/runtime-vnext/frameworks/pilot-governance-constitution.md",
  "docs/governance/runtime-vnext/frameworks/no-go-doctrine.md",
  "docs/governance/runtime-vnext/qa-twin/qa-twin-calibration-framework.md",
  "docs/governance/runtime-vnext/qa-twin/no-deploy-validation-pass.md",
];

const requiredTerms = [
  "HCP Predictive Builder + Adaptive RPS",
  "Protected Surface",
  "Governance Freeze",
  "Constitutional Escalation",
  "NO-GO",
];

const prohibitedInDocs = ["deploy production", "full rollout", "broad rollout"];

function walkFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

let failed = false;

for (const rel of requiredFiles) {
  const full = path.join(root, rel);
  if (!existsSync(full)) {
    console.error(`MISSING: ${rel}`);
    failed = true;
  }
}

const docRoot = path.join(root, "docs/governance/runtime-vnext");
if (existsSync(docRoot)) {
  const files = walkFiles(docRoot).filter((f) => /\.(md|ya?ml)$/i.test(f));
  const corpus = files.map((f) => readFileSync(f, "utf8")).join("\n");
  for (const term of requiredTerms) {
    if (!corpus.includes(term)) {
      console.error(`MISSING TERM: "${term}"`);
      failed = true;
    }
  }
  for (const bad of prohibitedInDocs) {
    if (corpus.toLowerCase().includes(bad)) {
      console.error(`PROHIBITED PHRASE FOUND: "${bad}"`);
      failed = true;
    }
  }
}

if (failed) {
  console.error("NO-DEPLOY GOVERNANCE VALIDATION: FAIL");
  process.exit(1);
}

console.log("NO-DEPLOY GOVERNANCE VALIDATION: PASS");
