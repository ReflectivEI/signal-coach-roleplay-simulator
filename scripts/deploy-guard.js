/**
 * DEPLOY GUARD — signal-coach-core (PRODUCTION)
 *
 * Runs before every `deploy:full`. Validates that:
 *  1. wrangler.toml worker name is exactly "reflectivai-rps-api" (no -staging suffix)
 *  2. wrangler.pages.toml pages name is exactly "signal-coach-roleplay-simulator"
 *  3. package.json name is "signal-coach-core"
 *  4. DEPLOY_TO_PRODUCTION=true env var is set (explicit intent gate)
 *
 * Blocks deployment on ANY failure.
 * To deploy production: DEPLOY_TO_PRODUCTION=true npm run deploy:full
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const EXPECTED = {
  workerName: "reflectivai-rps-api",
  pagesName: "signal-coach-roleplay-simulator",
  packageName: "signal-coach-core",
};

const COLORS = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};

function pass(msg) {
  console.log(`${COLORS.green}  ✅ ${msg}${COLORS.reset}`);
}
function fail(msg) {
  console.error(`${COLORS.red}  ❌ ${msg}${COLORS.reset}`);
}

console.log(
  `\n${COLORS.bold}${COLORS.red}╔════════════════════════════════════════════════╗${COLORS.reset}`
);
console.log(
  `${COLORS.bold}${COLORS.red}║   DEPLOY GUARD — ⚠️  PRODUCTION ENVIRONMENT    ║${COLORS.reset}`
);
console.log(
  `${COLORS.bold}${COLORS.red}╚════════════════════════════════════════════════╝${COLORS.reset}\n`
);

let failures = 0;

// ── 0. Explicit intent gate ─────────────────────────────────────────────────
if (process.env.DEPLOY_TO_PRODUCTION !== "true") {
  console.error(
    `${COLORS.bold}${COLORS.red}  ❌ PRODUCTION DEPLOY REQUIRES EXPLICIT INTENT${COLORS.reset}\n`
  );
  console.error(
    `${COLORS.yellow}     Run with: DEPLOY_TO_PRODUCTION=true npm run deploy:full${COLORS.reset}`
  );
  console.error(
    `${COLORS.yellow}     This prevents accidental `npm run deploy:full` from deploying to PRODUCTION.${COLORS.reset}\n`
  );
  process.exit(1);
}

// ── 1. Check wrangler.toml worker name ──────────────────────────────────────
try {
  const wranglerContent = fs.readFileSync(path.join(ROOT, "wrangler.toml"), "utf8");
  const match = wranglerContent.match(/^name\s*=\s*"([^"]+)"/m);
  if (!match) {
    fail("wrangler.toml: could not parse worker name");
    failures++;
  } else if (match[1] !== EXPECTED.workerName) {
    fail(
      `wrangler.toml worker name is "${match[1]}" — expected "${EXPECTED.workerName}"\n` +
        `         STOP: this would deploy the Worker to the WRONG target.`
    );
    failures++;
  } else if (match[1].includes("staging")) {
    fail(
      `wrangler.toml worker name "${match[1]}" contains "staging".\n` +
        `         STOP: you are in the staging repo. This is the production guard.`
    );
    failures++;
  } else {
    pass(`wrangler.toml worker name: ${match[1]}`);
  }
} catch (e) {
  fail(`Could not read wrangler.toml: ${e.message}`);
  failures++;
}

// ── 2. Check wrangler.pages.toml pages name ─────────────────────────────────
try {
  const pagesContent = fs.readFileSync(path.join(ROOT, "wrangler.pages.toml"), "utf8");
  const match = pagesContent.match(/^name\s*=\s*"([^"]+)"/m);
  if (!match) {
    fail("wrangler.pages.toml: could not parse pages project name");
    failures++;
  } else if (match[1] !== EXPECTED.pagesName) {
    fail(
      `wrangler.pages.toml pages name is "${match[1]}" — expected "${EXPECTED.pagesName}"\n` +
        `         STOP: this would deploy the Frontend to the WRONG Pages project.`
    );
    failures++;
  } else if (match[1].includes("staging")) {
    fail(
      `wrangler.pages.toml pages name "${match[1]}" contains "staging".\n` +
        `         STOP: you are in the staging repo. This is the production guard.`
    );
    failures++;
  } else {
    pass(`wrangler.pages.toml pages name: ${match[1]}`);
  }
} catch (e) {
  fail(`Could not read wrangler.pages.toml: ${e.message}`);
  failures++;
}

// ── 3. Verify package.json identity ─────────────────────────────────────────
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  if (pkg.name !== EXPECTED.packageName) {
    fail(
      `package.json name is "${pkg.name}" — expected "${EXPECTED.packageName}"\n` +
        `         STOP: you may be running this guard from the wrong repository.`
    );
    failures++;
  } else {
    pass(`package.json identity: ${pkg.name}`);
  }
} catch (e) {
  fail(`Could not read package.json: ${e.message}`);
  failures++;
}

// ── 4. Verify .deploy-target label ─────────────────────────────────────────
const deployTargetPath = path.join(ROOT, ".deploy-target");
if (fs.existsSync(deployTargetPath)) {
  const label = fs.readFileSync(deployTargetPath, "utf8").trim();
  if (!label.includes("production")) {
    fail(
      `.deploy-target says "${label}" — expected "production".\n` +
        `         STOP: environment label mismatch. Wrong repo?`
    );
    failures++;
  } else {
    pass(`.deploy-target: ${label}`);
  }
}

// ── Result ──────────────────────────────────────────────────────────────────
console.log("");
if (failures > 0) {
  console.error(
    `${COLORS.bold}${COLORS.red}╔════════════════════════════════════════════════╗${COLORS.reset}`
  );
  console.error(
    `${COLORS.bold}${COLORS.red}║   DEPLOY BLOCKED — ${failures} check(s) failed              ║${COLORS.reset}`
  );
  console.error(
    `${COLORS.bold}${COLORS.red}╚════════════════════════════════════════════════╝${COLORS.reset}\n`
  );
  process.exit(1);
} else {
  console.log(
    `${COLORS.bold}${COLORS.red}╔════════════════════════════════════════════════╗${COLORS.reset}`
  );
  console.log(
    `${COLORS.bold}${COLORS.red}║   DEPLOY GUARD PASSED — targeting PRODUCTION   ║${COLORS.reset}`
  );
  console.log(
    `${COLORS.bold}${COLORS.red}║   Worker : reflectivai-rps-api                  ║${COLORS.reset}`
  );
  console.log(
    `${COLORS.bold}${COLORS.red}║   Pages  : signal-coach-roleplay-simulator      ║${COLORS.reset}`
  );
  console.log(
    `${COLORS.bold}${COLORS.red}╚════════════════════════════════════════════════╝${COLORS.reset}\n`
  );
  process.exit(0);
}
