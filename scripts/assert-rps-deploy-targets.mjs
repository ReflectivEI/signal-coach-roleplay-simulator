import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const EXPECTED = {
  githubRepository: "ReflectivEI/signal-coach-roleplay-simulator",
  workerName: "signal-coach-roleplay-simulator",
  pagesProject: "signal-coach-roleplay-simulator",
  workerUrl: "https://signal-coach-roleplay-simulator.tonyabdelmalak.workers.dev",
  pagesUrl: "https://signal-coach-roleplay-simulator.pages.dev",
  customDomain: "https://rps.reflectiv-ai.com",
};

const FORBIDDEN = [
  "reflect-ai-now",
  "reflectiv-AIv4",
  "reflectiv-ai.com/*",
  "CLOUDFLARE_WORKER_NAME: reflect-ai-now",
  "CLOUDFLARE_PAGES_PROJECT: reflect-ai-now",
];

function read(filePath) {
  try {
    return fs.readFileSync(path.join(ROOT, filePath), "utf8");
  } catch {
    return "";
  }
}

function parseTomlName(content) {
  return String(content || "").match(/^name\s*=\s*"([^"]+)"/m)?.[1] || "";
}

function fail(message) {
  console.error(`RPS deploy target check failed: ${message}`);
  process.exitCode = 1;
}

const githubRepository = process.env.GITHUB_REPOSITORY || "";
if (githubRepository && githubRepository !== EXPECTED.githubRepository) {
  fail(`GITHUB_REPOSITORY is ${githubRepository}; expected ${EXPECTED.githubRepository}.`);
}

const wranglerWorker = read("wrangler.toml");
const wranglerPages = read("wrangler.pages.toml");
const workerClient = read("src/services/workerClient.js");
const featureApi = read("src/features/rps/api.js");
const workflows = fs.existsSync(path.join(ROOT, ".github", "workflows"))
  ? fs.readdirSync(path.join(ROOT, ".github", "workflows"))
      .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
      .map((file) => read(path.join(".github", "workflows", file)))
      .join("\n")
  : "";

const workerName = parseTomlName(wranglerWorker);
const pagesName = parseTomlName(wranglerPages);

if (workerName !== EXPECTED.workerName) {
  fail(`wrangler.toml name is ${workerName || "<missing>"}; expected ${EXPECTED.workerName}.`);
}

if (pagesName !== EXPECTED.pagesProject) {
  fail(`wrangler.pages.toml name is ${pagesName || "<missing>"}; expected ${EXPECTED.pagesProject}.`);
}

for (const source of [workerClient, featureApi]) {
  if (!source.includes(EXPECTED.workerUrl)) {
    fail(`frontend runtime is missing dedicated worker URL ${EXPECTED.workerUrl}.`);
    break;
  }
}

const deploymentText = [wranglerWorker, wranglerPages, workflows].join("\n");
for (const forbidden of FORBIDDEN) {
  if (deploymentText.includes(forbidden)) {
    fail(`standalone RPS deploy config references forbidden main-site target: ${forbidden}`);
  }
}

if (!process.exitCode) {
  console.log("RPS deploy target check passed.");
  console.log(`GitHub repo: ${EXPECTED.githubRepository}`);
  console.log(`Worker: ${EXPECTED.workerName}`);
  console.log(`Pages: ${EXPECTED.pagesProject}`);
  console.log(`Worker URL: ${EXPECTED.workerUrl}`);
  console.log(`Pages URL: ${EXPECTED.pagesUrl}`);
  console.log(`Custom domain: ${EXPECTED.customDomain}`);
}
