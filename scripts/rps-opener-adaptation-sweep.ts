import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ALL_SCENARIOS } from "../src/lib/scenarioCatalog.js";
import { generateHcpResponse } from "../src/lib/hcpResponseGenerator";

type SweepCaseResult = {
  scenarioId: string;
  scenarioTitle: string;
  openerId: string;
  opener: string;
  pass: boolean;
  reason: string;
  reply: string;
  cue: string | null;
  overlapTags: string[];
  expectedTags: string[];
};

type SweepReport = {
  timestamp: string;
  workerUrl: string | null;
  scenariosEvaluated: number;
  openersEvaluated: number;
  casesEvaluated: number;
  passCount: number;
  failCount: number;
  passRate: number;
  threshold: number;
  pass: boolean;
  failures: SweepCaseResult[];
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const ARTIFACT_DIR = path.resolve(REPO_ROOT, "artifacts", "opener-adaptation-sweep");
const LATEST_PATH = path.resolve(ARTIFACT_DIR, "latest.json");
const TREND_PATH = path.resolve(ARTIFACT_DIR, "trend.ndjson");

const PASS_THRESHOLD = Number(process.env.RPS_ADAPTATION_PASS_THRESHOLD || "0.92");
const MAX_SCENARIOS = Number(process.env.RPS_ADAPTATION_MAX_SCENARIOS || "12");
const workerUrl = process.env.VITE_ROLEPLAY_WORKER_URL || process.env.RPS_WORKER_URL || null;

type OpenerFixture = { id: string; text: string; expectedTags: string[] };

const OPENERS: OpenerFixture[] = [
  {
    id: "study_followup",
    text: "Hi Dr, can we discuss the JAMA study I dropped off last week and what it changes for your patients?",
    expectedTags: ["study", "evidence"],
  },
  {
    id: "access_pressure",
    text: "Can we talk about the prior auth delays your staff has been handling and where access is getting stuck?",
    expectedTags: ["access", "workflow"],
  },
  {
    id: "patient_fit",
    text: "Could we review which patient subgroup in your clinic is the right fit for this approach?",
    expectedTags: ["patient_fit"],
  },
  {
    id: "workflow_friction",
    text: "I want to focus on the exact workflow step causing callback loops for your office team.",
    expectedTags: ["workflow", "access"],
  },
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
  const lower = String(text || "").toLowerCase();
  const tags = new Set<string>();

  if (/\b(study|trial|jama|paper|data|evidence|guideline)\b/.test(lower)) {
    tags.add("study");
    tags.add("evidence");
  }
  if (/\b(prior auth|prior authorization|coverage|formulary|payer|approval|access)\b/.test(lower)) {
    tags.add("access");
  }
  if (/\b(workflow|staff|office|callback|process|handoff|queue)\b/.test(lower)) {
    tags.add("workflow");
  }
  if (/\b(patient|patients|subgroup|fit|profile|who fits|which patients)\b/.test(lower)) {
    tags.add("patient_fit");
  }

  return Array.from(tags);
}

function hasResetDrift(reply: string): boolean {
  return /\b(why are you here|what'?s this about|what is this about|what do you need from me)\b/i.test(reply);
}

function evaluateCase({ opener, reply }: { opener: OpenerFixture; reply: string }) {
  const replyText = String(reply || "").trim();
  if (!replyText) {
    return { pass: false, reason: "empty_reply", overlapTags: [] as string[] };
  }

  const expectedTags = opener.expectedTags.length ? opener.expectedTags : inferTags(opener.text);
  const replyTags = inferTags(replyText);
  const overlapTags = expectedTags.filter((tag) => replyTags.includes(tag));

  if (expectedTags.length > 0 && overlapTags.length === 0) {
    return { pass: false, reason: "missing_topic_alignment", overlapTags };
  }

  if (/\b(follow up|last week|dropped off|we discussed|earlier)\b/i.test(opener.text) && hasResetDrift(replyText)) {
    return { pass: false, reason: "premise_reset_drift", overlapTags };
  }

  return { pass: true, reason: "aligned", overlapTags };
}

async function runSweep() {
  const scenarios = ALL_SCENARIOS.map(normalizeScenario).slice(0, MAX_SCENARIOS > 0 ? MAX_SCENARIOS : undefined);
  const results: SweepCaseResult[] = [];

  for (const scenario of scenarios) {
    for (const opener of OPENERS) {
      const transcript = [
        {
          id: `${scenario.id}-${opener.id}`,
          speaker: "rep",
          text: opener.text,
          timestamp: new Date().toISOString(),
          cues: [],
        },
      ];

      try {
        const generated = await generateHcpResponse(
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

        const reply = String(generated?.hcpReply || "");
        const cue = generated?.activeCues?.[0]?.label || null;
        const evaluated = evaluateCase({ opener, reply });

        results.push({
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          openerId: opener.id,
          opener: opener.text,
          pass: evaluated.pass,
          reason: evaluated.reason,
          reply,
          cue,
          overlapTags: evaluated.overlapTags,
          expectedTags: opener.expectedTags,
        });
      } catch (error) {
        results.push({
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          openerId: opener.id,
          opener: opener.text,
          pass: false,
          reason: error instanceof Error ? `generation_error:${error.message}` : "generation_error",
          reply: "",
          cue: null,
          overlapTags: [],
          expectedTags: opener.expectedTags,
        });
      }
    }
  }

  const passCount = results.filter((result) => result.pass).length;
  const failCount = results.length - passCount;
  const passRate = results.length === 0 ? 0 : passCount / results.length;

  const report: SweepReport = {
    timestamp: new Date().toISOString(),
    workerUrl,
    scenariosEvaluated: scenarios.length,
    openersEvaluated: OPENERS.length,
    casesEvaluated: results.length,
    passCount,
    failCount,
    passRate,
    threshold: PASS_THRESHOLD,
    pass: passRate >= PASS_THRESHOLD,
    failures: results.filter((result) => !result.pass).slice(0, 80),
  };

  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  await fs.writeFile(LATEST_PATH, `${JSON.stringify(report, null, 2)}\n`);
  await fs.appendFile(TREND_PATH, `${JSON.stringify(report)}\n`);

  console.log(JSON.stringify({
    artifact: LATEST_PATH,
    pass: report.pass,
    passRate: Number((report.passRate * 100).toFixed(2)),
    threshold: Number((report.threshold * 100).toFixed(2)),
    scenariosEvaluated: report.scenariosEvaluated,
    openersEvaluated: report.openersEvaluated,
    casesEvaluated: report.casesEvaluated,
    failCount: report.failCount,
    workerUrl: report.workerUrl,
  }, null, 2));

  if (!report.pass) {
    process.exitCode = 1;
  }
}

runSweep().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  const fallback = {
    timestamp: new Date().toISOString(),
    workerUrl,
    pass: false,
    fatalError: message,
  };

  await fs.mkdir(ARTIFACT_DIR, { recursive: true }).catch(() => {});
  await fs.writeFile(LATEST_PATH, `${JSON.stringify(fallback, null, 2)}\n`).catch(() => {});

  console.error(JSON.stringify(fallback, null, 2));
  process.exit(1);
});
