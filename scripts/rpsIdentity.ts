import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_LOCAL_REPO_PATH = "/Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core";
export const EXPECTED_GITHUB_REPO = "ReflectivEI/signal-coach-roleplay-simulator";
export const EXPECTED_PACKAGE_NAME = "signal-coach-roleplay-simulator";
export const EXPECTED_WORKER_NAME = "reflectivai-rps-api";
export const EXPECTED_LOCAL_FRONTEND = "http://127.0.0.1:5173";
export const EXPECTED_LOCAL_WORKER = "http://127.0.0.1:8787";
export const EXPECTED_PRODUCTION_WORKER_URL = "https://reflectivai-rps-api.tonyabdelmalak.workers.dev";
export const DISALLOWED_TARGETS = [
  "dev_projects_full-build2",
  "relateiq-cloudflare-api",
  "standalone-rps-worker",
];

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

function includesValue(value = "", expected = "") {
  return String(value || "").includes(expected);
}

async function readText(filePath: string) {
  return fs.readFile(filePath, "utf8");
}

export async function verifyRpsIdentity() {
  const failures: string[] = [];
  const warnings: string[] = [];

  if (REPO_ROOT !== EXPECTED_LOCAL_REPO_PATH) {
    failures.push(`Wrong repo path: expected ${EXPECTED_LOCAL_REPO_PATH} but found ${REPO_ROOT}`);
  }

  const packageJsonPath = path.resolve(REPO_ROOT, "package.json");
  const packageLockPath = path.resolve(REPO_ROOT, "package-lock.json");
  const envLocalPath = path.resolve(REPO_ROOT, ".env.local");
  const readmePath = path.resolve(REPO_ROOT, "README.md");
  const viteConfigPath = path.resolve(REPO_ROOT, "vite.config.js");
  const workerClientPath = path.resolve(REPO_ROOT, "src/services/workerClient.js");
  const wranglerPath = path.resolve(REPO_ROOT, "wrangler.toml");
  const wranglerPagesPath = path.resolve(REPO_ROOT, "wrangler.pages.toml");

  const packageJson = JSON.parse(await readText(packageJsonPath));
  const packageLock = JSON.parse(await readText(packageLockPath));
  const envLocal = await readText(envLocalPath);
  const readme = await readText(readmePath);
  const viteConfig = await readText(viteConfigPath);
  const workerClient = await readText(workerClientPath);
  const wranglerToml = await readText(wranglerPath);
  const wranglerPagesToml = await readText(wranglerPagesPath);

  if (packageJson.name !== EXPECTED_PACKAGE_NAME) {
    failures.push(`Wrong package name in package.json: expected ${EXPECTED_PACKAGE_NAME} but found ${packageJson.name}`);
  }
  if (packageLock.name !== EXPECTED_PACKAGE_NAME || packageLock.packages?.[""]?.name !== EXPECTED_PACKAGE_NAME) {
    failures.push("package-lock.json package identity does not match the locked repo identity");
  }

  if (!includesValue(envLocal, `VITE_ROLEPLAY_WORKER_URL=${EXPECTED_LOCAL_WORKER}`)) {
    failures.push(`.env.local must point to ${EXPECTED_LOCAL_WORKER}`);
  }

  if (!includesValue(viteConfig, EXPECTED_LOCAL_WORKER) || !includesValue(workerClient, EXPECTED_LOCAL_WORKER)) {
    failures.push(`Local worker URL must be locked to ${EXPECTED_LOCAL_WORKER} in active runtime config`);
  }

  if (!includesValue(wranglerToml, `name = "${EXPECTED_WORKER_NAME}"`)) {
    failures.push(`wrangler.toml must declare worker name ${EXPECTED_WORKER_NAME}`);
  }

  if (!includesValue(wranglerPagesToml, `name = "${EXPECTED_PACKAGE_NAME}"`)) {
    failures.push(`wrangler.pages.toml must declare Pages project ${EXPECTED_PACKAGE_NAME}`);
  }

  if (!includesValue(readme, EXPECTED_LOCAL_FRONTEND)) {
    failures.push(`README must document local frontend ${EXPECTED_LOCAL_FRONTEND}`);
  }
  if (!includesValue(readme, EXPECTED_LOCAL_WORKER)) {
    failures.push(`README must document local worker ${EXPECTED_LOCAL_WORKER}`);
  }
  if (!includesValue(readme, EXPECTED_PRODUCTION_WORKER_URL)) {
    failures.push(`README must document production worker ${EXPECTED_PRODUCTION_WORKER_URL}`);
  }
  if (!includesValue(readme, EXPECTED_GITHUB_REPO)) {
    warnings.push(`README does not mention GitHub repo ${EXPECTED_GITHUB_REPO}`);
  }

  const scanTargets = [
    { label: "package.json", content: await readText(packageJsonPath) },
    { label: "package-lock.json", content: await readText(packageLockPath) },
    { label: ".env.local", content: envLocal },
    { label: "README.md", content: readme },
    { label: "vite.config.js", content: viteConfig },
    { label: "src/services/workerClient.js", content: workerClient },
    { label: "scripts/predeploy-verify.ts", content: await readText(path.resolve(REPO_ROOT, "scripts/predeploy-verify.ts")) },
  ];

  for (const target of scanTargets) {
    for (const bad of DISALLOWED_TARGETS) {
      if (includesValue(target.content, bad)) {
        failures.push(`Disallowed target reference found in ${target.label}: ${bad}`);
      }
    }
  }

  return {
    pass: failures.length === 0,
    repoRoot: REPO_ROOT,
    failures,
    warnings,
    expected: {
      repoPath: EXPECTED_LOCAL_REPO_PATH,
      githubRepo: EXPECTED_GITHUB_REPO,
      packageName: EXPECTED_PACKAGE_NAME,
      workerName: EXPECTED_WORKER_NAME,
      localFrontend: EXPECTED_LOCAL_FRONTEND,
      localWorker: EXPECTED_LOCAL_WORKER,
      productionWorkerUrl: EXPECTED_PRODUCTION_WORKER_URL,
    },
  };
}
