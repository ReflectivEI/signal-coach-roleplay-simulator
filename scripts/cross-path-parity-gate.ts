import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ALL_SCENARIOS } from "../src/lib/scenarioCatalog.js";
import { generateHcpResponse } from "../src/lib/hcpResponseGenerator";
import { requestRoleplayResponse } from "../src/services/workerClient.js";

type ParityCase = {
  scenarioId: string;
  scenarioTitle: string;
  openerId: string;
  pass: boolean;
  reason: string;
  sharedReply: string;
  workerReply: string;
  sharedTags: string[];
  workerTags: string[];
};

type ParityReport = {
  timestamp: string;
  workerUrl: string | null;
  threshold: number;
  scenarioCount: number;
  openerCount: number;
  caseCount: number;
  passCount: number;
  failCount: number;
  passRate: number;
  pass: boolean;
  failures: ParityCase[];
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const ARTIFACT_DIR = path.resolve(REPO_ROOT, "artifacts", "cross-path-parity");
const LATEST_PATH = path.resolve(ARTIFACT_DIR, "latest.json");
const TREND_PATH = path.resolve(ARTIFACT_DIR, "trend.ndjson");

const PASS_THRESHOLD = Number(process.env.RPS_PARITY_THRESHOLD || "0.8");
const MAX_SCENARIOS = Number(process.env.RPS_PARITY_MAX_SCENARIOS || "10");
const workerUrl = process.env.VITE_ROLEPLAY_WORKER_URL || process.env.RPS_WORKER_URL || null;

const OPENERS = [
  { id: "study", text: "Can we discuss the JAMA study and whether it changes decisions for your subgroup patients?" },
  { id: "access", text: "Can we focus on prior auth delays and where access breaks for your office workflow?" },
  { id: "safety", text: "Can we go over your main safety concern and what signal you still need to see?" },
];

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeScenario(scenario: any, index: number) {
  const parsedRealism = Number(
    scenario?.runtimeTemperature ?? scenario?.realism ?? scenario?.realismLevel ?? scenario?.realism_level,
  );
  const runtimeTemperature = Number.isInteger(parsedRealism)
    ? Math.max(1, Math.min(10, parsedRealism))
    : 6;

  return {
    ...scenario,
    id: scenario.id || `builtin-${slugify(scenario.title || `scenario-${index + 1}`)}`,
    runtimeTemperature,
  };
}

function inferTags(text: string): string[] {
  const value = String(text || "").toLowerCase();
  const tags = new Set<string>();

  if (/\b(study|trial|jama|evidence|guideline|data)\b/.test(value)) tags.add("evidence");
  if (/\b(prior auth|access|coverage|formulary|payer|approval)\b/.test(value)) tags.add("access");
  if (/\b(workflow|staff|office|callback|handoff|process)\b/.test(value)) tags.add("workflow");
  if (/\b(safety|risk|adverse|hepatic)\b/.test(value)) tags.add("safety");
  if (/\b(patient|patients|subgroup|fit)\b/.test(value)) tags.add("patient_fit");

  return Array.from(tags);
}

function hasAny(tags: string[], expected: string[]) {
  return expected.some((tag) => tags.includes(tag));
}

function buildExpectedTagFamily(openerText: string) {
  const expected = inferTags(openerText);
  const family = new Set<string>(expected);

  // Safety and evidence are treated as a governance-linked family in opener handling.
  if (expected.includes("safety")) {
    family.add("evidence");
    family.add("patient_fit");
  }
  if (expected.includes("access")) {
    family.add("workflow");
  }

  return Array.from(family);
}

function evaluateParity(sharedReply: string, workerReply: string, openerText: string) {
  const shared = String(sharedReply || "").trim();
  const worker = String(workerReply || "").trim();
  if (!shared || !worker) return { pass: false, reason: "empty_reply", sharedTags: [], workerTags: [] };

  const expectedTags = buildExpectedTagFamily(openerText);
  const sharedTags = inferTags(shared);
  const workerTags = inferTags(worker);

  if (expectedTags.length > 0) {
    const sharedAligned = hasAny(sharedTags, expectedTags);
    const workerAligned = hasAny(workerTags, expectedTags);
    if (!sharedAligned || !workerAligned) {
      return { pass: false, reason: "opener_alignment_mismatch", sharedTags, workerTags };
    }
  }

  return { pass: true, reason: "parity_ok", sharedTags, workerTags };
}

async function run() {
  const scenarios = ALL_SCENARIOS.map(normalizeScenario).slice(0, MAX_SCENARIOS > 0 ? MAX_SCENARIOS : undefined);
  const cases: ParityCase[] = [];

  for (const scenario of scenarios) {
    for (const opener of OPENERS) {
      const sessionId = `parity-${scenario.id}-${opener.id}`;
      const transcript = [
        {
          id: `${sessionId}-rep`,
          speaker: "rep",
          text: opener.text,
          timestamp: new Date().toISOString(),
          cues: [],
        },
      ];

      try {
        const shared = await generateHcpResponse(
          scenario,
          transcript as any,
          scenario.startingBehaviorState || "neutral",
          scenario.journeyStage || "early_discovery",
          true,
          opener.text,
          [],
          0,
          "stable" as any,
          260,
        );

        const worker = await requestRoleplayResponse({
          sessionId,
          repMessage: opener.text,
          scenarioContext: {
            title: scenario.title,
            stakeholder: scenario.stakeholder,
            objective: scenario.objective,
            persona: scenario.persona,
            journeyStage: scenario.journeyStage,
            interactionPressure: scenario.interactionPressure || [],
            startingBehaviorState: scenario.startingBehaviorState,
            currentBehaviorState: scenario.startingBehaviorState,
            runtimeTemperature: scenario.runtimeTemperature,
            openingScene: scenario.openingScene,
            description: scenario.description,
          },
          conversationState: {
            sessionId,
            scenarioId: scenario.id,
            scenarioTitle: scenario.title,
            currentBehaviorState: scenario.startingBehaviorState,
            currentJourneyState: scenario.journeyStage,
            turnCount: 0,
            signals: [],
            transcript,
            runtimeTemperature: scenario.runtimeTemperature,
          },
        });

        const evaluated = evaluateParity(shared.hcpReply, worker.hcpReply, opener.text);
        cases.push({
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          openerId: opener.id,
          pass: evaluated.pass,
          reason: evaluated.reason,
          sharedReply: shared.hcpReply,
          workerReply: worker.hcpReply,
          sharedTags: evaluated.sharedTags,
          workerTags: evaluated.workerTags,
        });
      } catch (error) {
        cases.push({
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          openerId: opener.id,
          pass: false,
          reason: error instanceof Error ? `runtime_error:${error.message}` : "runtime_error",
          sharedReply: "",
          workerReply: "",
          sharedTags: [],
          workerTags: [],
        });
      }
    }
  }

  const passCount = cases.filter((item) => item.pass).length;
  const failCount = cases.length - passCount;
  const passRate = cases.length ? passCount / cases.length : 0;

  const report: ParityReport = {
    timestamp: new Date().toISOString(),
    workerUrl,
    threshold: PASS_THRESHOLD,
    scenarioCount: scenarios.length,
    openerCount: OPENERS.length,
    caseCount: cases.length,
    passCount,
    failCount,
    passRate,
    pass: passRate >= PASS_THRESHOLD,
    failures: cases.filter((item) => !item.pass).slice(0, 80),
  };

  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  await fs.writeFile(LATEST_PATH, `${JSON.stringify(report, null, 2)}\n`);
  await fs.appendFile(TREND_PATH, `${JSON.stringify(report)}\n`);

  console.log(JSON.stringify({
    artifact: LATEST_PATH,
    pass: report.pass,
    passRate: Number((report.passRate * 100).toFixed(2)),
    threshold: Number((report.threshold * 100).toFixed(2)),
    caseCount: report.caseCount,
    failCount: report.failCount,
    workerUrl: report.workerUrl,
  }, null, 2));

  if (!report.pass) {
    process.exitCode = 1;
  }
}

run().catch(async (error) => {
  const fallback = {
    timestamp: new Date().toISOString(),
    pass: false,
    workerUrl,
    fatalError: error instanceof Error ? error.message : String(error),
  };
  await fs.mkdir(ARTIFACT_DIR, { recursive: true }).catch(() => {});
  await fs.writeFile(LATEST_PATH, `${JSON.stringify(fallback, null, 2)}\n`).catch(() => {});
  console.error(JSON.stringify(fallback, null, 2));
  process.exit(1);
});
