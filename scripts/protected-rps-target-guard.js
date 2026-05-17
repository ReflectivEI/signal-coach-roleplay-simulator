/**
 * Hard guardrail: this repo must not deploy to retired or unrelated RPS targets.
 *
 * Forbidden legacy targets:
 * - Worker: reflectivai-rps-api
 * - Domain: reflectivai-rps-api.tonyabdelmalak.workers.dev
 *
 * This script is intentionally strict. If this repository is still wired to the
 * retired API Worker, deploy commands must fail until the repo is repointed to
 * signal-coach-roleplay-simulator.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const commandName = process.argv[2] || "deploy";

const FORBIDDEN = {
  workerNames: ["reflectivai-rps-api"],
  pagesNames: [],
  hostnames: [
    "reflectivai-rps-api.tonyabdelmalak.workers.dev",
  ],
};

const COLORS = {
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};

function readIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function parseTomlName(content) {
  const match = String(content || "").match(/^name\s*=\s*"([^"]+)"/m);
  return match?.[1] || "";
}

function findProtectedHostHits(...contents) {
  const joined = contents.join("\n");
  return FORBIDDEN.hostnames.filter((hostname) => joined.includes(hostname));
}

const wranglerToml = readIfExists(path.join(ROOT, "wrangler.toml"));
const wranglerPagesToml = readIfExists(path.join(ROOT, "wrangler.pages.toml"));
const packageJson = readIfExists(path.join(ROOT, "package.json"));
const deployGuard = readIfExists(path.join(ROOT, "scripts", "deploy-guard.js"));

const workerName = parseTomlName(wranglerToml);
const pagesName = parseTomlName(wranglerPagesToml);
const forbiddenWorker = FORBIDDEN.workerNames.includes(workerName);
const forbiddenPages = FORBIDDEN.pagesNames.includes(pagesName);
const forbiddenHostHits = findProtectedHostHits(wranglerToml, wranglerPagesToml, packageJson, deployGuard);

if (forbiddenWorker || forbiddenPages || forbiddenHostHits.length) {
  console.error(`\n${COLORS.bold}${COLORS.red}DEPLOY BLOCKED: RETIRED RPS TARGET DETECTED${COLORS.reset}`);
  console.error(`${COLORS.yellow}This repository must deploy to signal-coach-roleplay-simulator, not the retired API Worker.${COLORS.reset}`);
  console.error(`${COLORS.yellow}Blocked command: ${commandName}${COLORS.reset}`);
  if (forbiddenWorker) {
    console.error(`${COLORS.yellow}- Retired worker target detected in wrangler.toml: ${workerName}${COLORS.reset}`);
  }
  if (forbiddenPages) {
    console.error(`${COLORS.yellow}- Retired Pages target detected in wrangler.pages.toml: ${pagesName}${COLORS.reset}`);
  }
  if (forbiddenHostHits.length) {
    console.error(`${COLORS.yellow}- Retired host references detected: ${forbiddenHostHits.join(", ")}${COLORS.reset}`);
  }
  console.error(`${COLORS.yellow}Repoint this repo to signal-coach-roleplay-simulator before enabling any deploy command.${COLORS.reset}\n`);
  process.exit(1);
}

process.exit(0);
