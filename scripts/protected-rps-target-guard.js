/**
 * Hard guardrail: this repo must not deploy to the protected RPS targets.
 *
 * Protected targets:
 * - Worker: reflectivai-rps-api
 * - Pages: signal-coach-roleplay-simulator
 * - Domains: rps.reflectiv-ai.com, signal-coach-roleplay-simulator.pages.dev,
 *   reflectivai-rps-api.tonyabdelmalak.workers.dev
 *
 * This script is intentionally strict. If this repository is still wired to any
 * protected target, deploy commands must fail until the repo is repointed.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const commandName = process.argv[2] || "deploy";

const PROTECTED = {
  workerNames: ["reflectivai-rps-api"],
  pagesNames: ["signal-coach-roleplay-simulator"],
  hostnames: [
    "rps.reflectiv-ai.com",
    "signal-coach-roleplay-simulator.pages.dev",
    "backup-predictive-builder-v1.signal-coach-roleplay-simulator.pages.dev",
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
  return PROTECTED.hostnames.filter((hostname) => joined.includes(hostname));
}

const wranglerToml = readIfExists(path.join(ROOT, "wrangler.toml"));
const wranglerPagesToml = readIfExists(path.join(ROOT, "wrangler.pages.toml"));
const packageJson = readIfExists(path.join(ROOT, "package.json"));
const deployGuard = readIfExists(path.join(ROOT, "scripts", "deploy-guard.js"));

const workerName = parseTomlName(wranglerToml);
const pagesName = parseTomlName(wranglerPagesToml);
const protectedWorker = PROTECTED.workerNames.includes(workerName);
const protectedPages = PROTECTED.pagesNames.includes(pagesName);
const protectedHostHits = findProtectedHostHits(wranglerToml, wranglerPagesToml, packageJson, deployGuard);

if (protectedWorker || protectedPages || protectedHostHits.length) {
  console.error(`\n${COLORS.bold}${COLORS.red}DEPLOY BLOCKED: PROTECTED RPS TARGETS DETECTED${COLORS.reset}`);
  console.error(`${COLORS.yellow}This repository is forbidden from modifying the protected RPS surfaces.${COLORS.reset}`);
  console.error(`${COLORS.yellow}Blocked command: ${commandName}${COLORS.reset}`);
  if (protectedWorker) {
    console.error(`${COLORS.yellow}- Protected worker target detected in wrangler.toml: ${workerName}${COLORS.reset}`);
  }
  if (protectedPages) {
    console.error(`${COLORS.yellow}- Protected Pages target detected in wrangler.pages.toml: ${pagesName}${COLORS.reset}`);
  }
  if (protectedHostHits.length) {
    console.error(`${COLORS.yellow}- Protected host references detected: ${protectedHostHits.join(", ")}${COLORS.reset}`);
  }
  console.error(`${COLORS.yellow}Repoint this repo to non-protected targets before enabling any deploy command.${COLORS.reset}\n`);
  process.exit(1);
}

process.exit(0);