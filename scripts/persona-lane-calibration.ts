import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ALL_SCENARIOS } from "../src/lib/scenarioCatalog.js";
import { generateHcpResponse } from "../src/lib/hcpResponseGenerator";
import { buildDeterministicQaRepReply, enforceRepAnswerFirstContract } from "../src/lib/qaRepProxy.js";
import { buildTranscriptAudit } from "../src/lib/qaTwinAudit.js";

type LaneThreshold = {
  realismMin: number;
  continuityMin: number;
  pressureFitMin: number;
};

type LaneResult = {
  lane: string;
  scenarioId: string;
  scenarioTitle: string;
  realismRate: number;
  continuityRate: number;
  pressureFitRate: number;
  threshold: LaneThreshold;
  pass: boolean;
  failures: string[];
};

type CalibrationReport = {
  timestamp: string;
  thresholdType: string;
  laneCount: number;
  passCount: number;
  failCount: number;
  passRate: number;
  pass: boolean;
  lanes: LaneResult[];
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const ARTIFACT_DIR = path.resolve(REPO_ROOT, "artifacts", "persona-lane-calibration");
const LATEST_PATH = path.resolve(ARTIFACT_DIR, "latest.json");
const TREND_PATH = path.resolve(ARTIFACT_DIR, "trend.ndjson");

const MAX_TURNS = Number(process.env.RPS_PERSONA_CAL_MAX_TURNS || "4");
const GLOBAL_PASS_THRESHOLD = Number(process.env.RPS_PERSONA_CAL_PASS_THRESHOLD || "0.9");

const LANE_CONFIG: Array<{ lane: string; matcher: RegExp; threshold: LaneThreshold }> = [
  { lane: "primary-care", matcher: /primary care/i, threshold: { realismMin: 0.4, continuityMin: 0.35, pressureFitMin: 0.55 } },
  { lane: "cardiology", matcher: /cardio/i, threshold: { realismMin: 0.4, continuityMin: 0.35, pressureFitMin: 0.55 } },
  { lane: "endocrinology", matcher: /endocrin/i, threshold: { realismMin: 0.4, continuityMin: 0.35, pressureFitMin: 0.55 } },
  { lane: "pulmonology", matcher: /pulmon/i, threshold: { realismMin: 0.4, continuityMin: 0.35, pressureFitMin: 0.55 } },
  { lane: "neurology", matcher: /neuro|aan/i, threshold: { realismMin: 0.4, continuityMin: 0.35, pressureFitMin: 0.55 } },
];

const LANE_SCENARIO_OVERRIDES: Record<string, string> = {
  "primary-care": "builtin-the-assumed-priority",
  "cardiology": "builtin-the-protocol-lock",
  endocrinology: "builtin-the-assumed-priority",
  pulmonology: "builtin-the-protocol-lock",
  neurology: "builtin-the-unexpected-safety-flag",
};

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

function findLaneScenario(laneConfig: { lane: string; matcher: RegExp }, scenarios: any[]) {
  const overrideId = LANE_SCENARIO_OVERRIDES[laneConfig.lane];
  if (overrideId) {
    const override = scenarios.find((item) => String(item?.id) === overrideId);
    if (override) return override;
  }

  return scenarios.find((item) =>
    laneConfig.matcher.test(String(item?.context || "")) ||
    laneConfig.matcher.test(String(item?.title || "")) ||
    laneConfig.matcher.test(String(item?.objective || ""))
  ) || null;
}

function computeRates(audit: any) {
  const failures = Array.isArray(audit?.failures) ? audit.failures : [];
  const failureTypes = failures.map((entry: any) => String(entry?.type || "").toLowerCase());
  const turnCount = Math.max(1, Number(audit?.transcript?.length || 0));

  const realismFails = failureTypes.filter((type) =>
    ["chatbot_phrasing", "over_written", "poor_persona_fit", "poor_specialty_fit", "abrupt_rudeness_without_basis"].includes(type)
  ).length;
  const continuityFails = failureTypes.filter((type) =>
    ["continuity_break", "conversation_stagnation", "repetition_or_looping", "question_obligation_failure"].includes(type)
  ).length;
  const pressureFails = failureTypes.filter((type) =>
    ["interaction_pressure_mismatch", "journey_stage_mismatch", "workflow_implausible", "access_implausible"].includes(type)
  ).length;

  const realismRate = Number((1 - (realismFails / turnCount)).toFixed(3));
  const continuityRate = Number((1 - (continuityFails / turnCount)).toFixed(3));
  const pressureFitRate = Number((1 - (pressureFails / turnCount)).toFixed(3));

  return {
    realismRate: Math.max(0, Math.min(1, realismRate)),
    continuityRate: Math.max(0, Math.min(1, continuityRate)),
    pressureFitRate: Math.max(0, Math.min(1, pressureFitRate)),
  };
}

async function runLaneSimulation(scenario: any) {
  const turns: Array<{ speaker: string; text: string }> = [];
  const transcript: any[] = [];
  let currentBehaviorState = scenario.startingBehaviorState || "neutral";
  let currentJourneyState = scenario.journeyStage || "early_discovery";

  for (let index = 0; index < MAX_TURNS; index += 1) {
    const repDraft = buildDeterministicQaRepReply({
      scenario,
      turns,
      draft: "",
      personaKey: "strong_rep",
      turnIndex: index,
    });
    const repReply = enforceRepAnswerFirstContract({
      scenario,
      turns,
      draft: repDraft,
      personaKey: "strong_rep",
      turnIndex: index,
    });

    turns.push({ speaker: "rep", text: repReply.text });
    transcript.push({
      id: `${scenario.id}-rep-${index + 1}`,
      speaker: "rep",
      text: repReply.text,
      timestamp: new Date().toISOString(),
      cues: [],
    });

    const hcp = await generateHcpResponse(
      scenario,
      transcript as any,
      currentBehaviorState,
      currentJourneyState,
      false,
      repReply.text,
      [],
      index,
      "stable" as any,
      260,
    );

    turns.push({ speaker: "hcp", text: hcp.hcpReply });
    transcript.push({
      id: `${scenario.id}-hcp-${index + 1}`,
      speaker: "hcp",
      text: hcp.hcpReply,
      timestamp: new Date().toISOString(),
      cues: hcp.activeCues || [],
    });

    currentBehaviorState = hcp.nextBehaviorState || currentBehaviorState;
    currentJourneyState = hcp.nextJourneyState || currentJourneyState;
  }

  return buildTranscriptAudit({
    scenario,
    turns,
    personaKey: "strong_rep",
  });
}

async function run() {
  const scenarios = ALL_SCENARIOS.map(normalizeScenario);
  const laneResults: LaneResult[] = [];

  for (const laneConfig of LANE_CONFIG) {
    const scenario = findLaneScenario(laneConfig, scenarios);
    if (!scenario) {
      laneResults.push({
        lane: laneConfig.lane,
        scenarioId: "missing",
        scenarioTitle: "No matched scenario",
        realismRate: 0,
        continuityRate: 0,
        pressureFitRate: 0,
        threshold: laneConfig.threshold,
        pass: false,
        failures: ["missing_lane_scenario"],
      });
      continue;
    }

    const audit = await runLaneSimulation(scenario);
    const rates = computeRates(audit);
    const failures: string[] = [];
    if (rates.realismRate < laneConfig.threshold.realismMin) failures.push("realism_below_threshold");
    if (rates.continuityRate < laneConfig.threshold.continuityMin) failures.push("continuity_below_threshold");
    if (rates.pressureFitRate < laneConfig.threshold.pressureFitMin) failures.push("pressure_fit_below_threshold");

    laneResults.push({
      lane: laneConfig.lane,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      realismRate: rates.realismRate,
      continuityRate: rates.continuityRate,
      pressureFitRate: rates.pressureFitRate,
      threshold: laneConfig.threshold,
      pass: failures.length === 0,
      failures,
    });
  }

  const passCount = laneResults.filter((item) => item.pass).length;
  const failCount = laneResults.length - passCount;
  const passRate = laneResults.length ? passCount / laneResults.length : 0;

  const report: CalibrationReport = {
    timestamp: new Date().toISOString(),
    thresholdType: "persona_lane_per_specialty",
    laneCount: laneResults.length,
    passCount,
    failCount,
    passRate,
    pass: passRate >= GLOBAL_PASS_THRESHOLD,
    lanes: laneResults,
  };

  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  await fs.writeFile(LATEST_PATH, `${JSON.stringify(report, null, 2)}\n`);
  await fs.appendFile(TREND_PATH, `${JSON.stringify(report)}\n`);

  console.log(JSON.stringify({
    artifact: LATEST_PATH,
    pass: report.pass,
    passRate: Number((report.passRate * 100).toFixed(2)),
    laneCount: report.laneCount,
    failCount: report.failCount,
  }, null, 2));

  if (!report.pass) {
    process.exitCode = 1;
  }
}

run().catch(async (error) => {
  const fallback = {
    timestamp: new Date().toISOString(),
    pass: false,
    fatalError: error instanceof Error ? error.message : String(error),
  };
  await fs.mkdir(ARTIFACT_DIR, { recursive: true }).catch(() => {});
  await fs.writeFile(LATEST_PATH, `${JSON.stringify(fallback, null, 2)}\n`).catch(() => {});
  console.error(JSON.stringify(fallback, null, 2));
  process.exit(1);
});
