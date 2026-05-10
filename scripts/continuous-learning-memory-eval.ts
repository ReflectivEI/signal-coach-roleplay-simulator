import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import continuousLearningProfile from "../src/lib/continuousLearningProfile.json";

type MetricsSnapshot = {
  confidenceGate: number;
  openerAdaptation: number;
  highRiskLowOpennessRatio: number;
  personaLanePassRate: number;
  crossPathParity: number;
};

type EvaluationReport = {
  timestamp: string;
  promoted: boolean;
  pass: boolean;
  score: number;
  metrics: MetricsSnapshot;
  policy: Record<string, number>;
  weights: Record<string, number>;
  failures: string[];
  outputProfilePath: string;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const ARTIFACT_DIR = path.resolve(REPO_ROOT, "artifacts", "continuous-learning");
const LATEST_PATH = path.resolve(ARTIFACT_DIR, "latest.json");
const TREND_PATH = path.resolve(ARTIFACT_DIR, "trend.ndjson");
const PROMOTED_PROFILE_PATH = path.resolve(REPO_ROOT, "src/lib/continuousLearningProfile.json");

const CONFIDENCE_TREND_PATH = path.resolve(REPO_ROOT, "artifacts/confidence-gate/trend.ndjson");
const CONFIDENCE_LATEST_PATH = path.resolve(REPO_ROOT, "artifacts/confidence-gate/latest.json");
const OPENER_TREND_PATH = path.resolve(REPO_ROOT, "artifacts/opener-adaptation-sweep/trend.ndjson");
const OPENER_LATEST_PATH = path.resolve(REPO_ROOT, "artifacts/opener-adaptation-sweep/latest.json");
const PARITY_TREND_PATH = path.resolve(REPO_ROOT, "artifacts/cross-path-parity/trend.ndjson");
const PARITY_LATEST_PATH = path.resolve(REPO_ROOT, "artifacts/cross-path-parity/latest.json");
const PERSONA_TREND_PATH = path.resolve(REPO_ROOT, "artifacts/persona-lane-calibration/trend.ndjson");
const PERSONA_LATEST_PATH = path.resolve(REPO_ROOT, "artifacts/persona-lane-calibration/latest.json");
const QA_HISTORY_PATH = path.resolve(REPO_ROOT, "artifacts/qa-matrix/run-history.json");

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function readNdjson(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function readJsonArray(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readJsonObject(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function tail<T>(values: T[], count: number): T[] {
  if (!Array.isArray(values)) return [];
  return values.slice(Math.max(0, values.length - count));
}

async function computeMetrics(): Promise<MetricsSnapshot> {
  const confidenceLatest = await readJsonObject(CONFIDENCE_LATEST_PATH);
  const openerLatest = await readJsonObject(OPENER_LATEST_PATH);
  const parityLatest = await readJsonObject(PARITY_LATEST_PATH);
  const personaLatest = await readJsonObject(PERSONA_LATEST_PATH);

  const confidenceTrend = tail(await readNdjson(CONFIDENCE_TREND_PATH), 7);
  const openerTrend = tail(await readNdjson(OPENER_TREND_PATH), 7);
  const parityTrend = tail(await readNdjson(PARITY_TREND_PATH), 7);
  const personaTrend = tail(await readNdjson(PERSONA_TREND_PATH), 7);
  const qaHistory = tail(await readJsonArray(QA_HISTORY_PATH), 80);

  const confidenceGate = Number(
    confidenceLatest?.weightedScore ?? mean(confidenceTrend.map((item: any) => Number(item?.weightedScore ?? 0)))
  );
  const openerAdaptation = Number(
    openerLatest?.passRate ?? mean(openerTrend.map((item: any) => Number(item?.passRate ?? 0)))
  );
  const crossPathParity = Number(
    parityLatest?.passRate ?? mean(parityTrend.map((item: any) => Number(item?.passRate ?? 0)))
  );
  const personaLanePassRate = Number(
    personaLatest?.passRate ?? mean(personaTrend.map((item: any) => Number(item?.passRate ?? 0)))
  );

  const highRiskLowOpennessCount = qaHistory.filter((item: any) =>
    String(item?.riskLevel || "").toLowerCase() === "high" && Number(item?.opennessScore || 0) <= 2
  ).length;
  const highRiskLowOpennessRatio = qaHistory.length > 0
    ? highRiskLowOpennessCount / qaHistory.length
    : 0;

  return {
    confidenceGate,
    openerAdaptation,
    highRiskLowOpennessRatio,
    personaLanePassRate,
    crossPathParity,
  };
}

function buildScore(metrics: MetricsSnapshot, weights: Record<string, number>) {
  const normalizedRisk = Math.max(0, 1 - metrics.highRiskLowOpennessRatio);
  const weighted =
    (metrics.confidenceGate * (weights.confidence || 0)) +
    (metrics.openerAdaptation * (weights.openerAdaptation || 0)) +
    (normalizedRisk * (weights.highRiskLowOpenness || 0)) +
    (metrics.personaLanePassRate * (weights.personaLane || 0)) +
    (metrics.crossPathParity * (weights.crossPathParity || 0));
  return Number(weighted.toFixed(4));
}

function evaluateAgainstPolicy(metrics: MetricsSnapshot, policy: Record<string, number>) {
  const failures: string[] = [];

  if (metrics.confidenceGate < Number(policy.minConfidenceGate || 0)) {
    failures.push("confidence_gate_below_policy");
  }
  if (metrics.openerAdaptation < Number(policy.minOpenerAdaptation || 0)) {
    failures.push("opener_adaptation_below_policy");
  }
  if (metrics.highRiskLowOpennessRatio > Number(policy.maxHighRiskLowOpennessRatio || 1)) {
    failures.push("high_risk_low_openness_ratio_above_policy");
  }
  if (metrics.personaLanePassRate < Number(policy.minPersonaLanePassRate || 0)) {
    failures.push("persona_lane_pass_rate_below_policy");
  }
  if (metrics.crossPathParity < Number(policy.minCrossPathParity || 0)) {
    failures.push("cross_path_parity_below_policy");
  }

  return failures;
}

async function run() {
  const promote = process.argv.includes("--promote");
  const policy = (continuousLearningProfile as any)?.policy || {};
  const weights = (continuousLearningProfile as any)?.weights || {};

  const metrics = await computeMetrics();
  const failures = evaluateAgainstPolicy(metrics, policy);
  const score = buildScore(metrics, weights);
  const pass = failures.length === 0;

  let promoted = false;
  if (promote && pass) {
    const nextProfile = {
      ...(continuousLearningProfile as any),
      updatedAt: new Date().toISOString(),
      runtimeSnapshot: {
        confidenceGate: Number(metrics.confidenceGate.toFixed(4)),
        openerAdaptation: Number(metrics.openerAdaptation.toFixed(4)),
        highRiskLowOpennessRatio: Number(metrics.highRiskLowOpennessRatio.toFixed(4)),
        personaLanePassRate: Number(metrics.personaLanePassRate.toFixed(4)),
        crossPathParity: Number(metrics.crossPathParity.toFixed(4)),
        score,
      },
    };
    await fs.writeFile(PROMOTED_PROFILE_PATH, `${JSON.stringify(nextProfile, null, 2)}\n`);
    promoted = true;
  }

  const report: EvaluationReport = {
    timestamp: new Date().toISOString(),
    promoted,
    pass,
    score,
    metrics,
    policy,
    weights,
    failures,
    outputProfilePath: PROMOTED_PROFILE_PATH,
  };

  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  await fs.writeFile(LATEST_PATH, `${JSON.stringify(report, null, 2)}\n`);
  await fs.appendFile(TREND_PATH, `${JSON.stringify(report)}\n`);

  console.log(JSON.stringify({
    artifact: LATEST_PATH,
    pass,
    promoted,
    score,
    failures,
  }, null, 2));

  if (!pass) {
    process.exitCode = 1;
  }
}

run().catch(async (error) => {
  const fallback = {
    timestamp: new Date().toISOString(),
    pass: false,
    promoted: false,
    fatalError: error instanceof Error ? error.message : String(error),
  };
  await fs.mkdir(ARTIFACT_DIR, { recursive: true }).catch(() => {});
  await fs.writeFile(LATEST_PATH, `${JSON.stringify(fallback, null, 2)}\n`).catch(() => {});
  console.error(JSON.stringify(fallback, null, 2));
  process.exit(1);
});
