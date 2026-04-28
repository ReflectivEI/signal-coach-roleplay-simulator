import crypto from "node:crypto";
import { ALL_SCENARIOS } from "../src/lib/scenarioCatalog.js";

type Scenario = any;

function normalizeScenario(s: Scenario, i: number) {
  const slug = String(s.title || `scenario-${i + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return { ...s, id: s.id || `builtin-${slug}` };
}

async function post(path: string, body: any) {
  const res = await fetch(`http://127.0.0.1:5173${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  let json: any = null;
  try {
    json = txt ? JSON.parse(txt) : null;
  } catch {
    json = { raw: txt };
  }
  return { ok: res.ok, status: res.status, json };
}

const BAD_PATTERNS = [
  /changes what happens in my clinic/i,
  /give me one point that would change/i,
  /one point that changes/i,
  /tell me one thing that would change how i manage access or treatment/i,
  /practical point that would change how i (?:manage|make)/i,
  /^you'?re following up on (?:that|the) study/i,
  /\.\s*but\b/,
  /^i remember that study\.?$/i,
  /^i remember the study you dropped off\.?$/i,
  /not where it breaks for us/i,
  /[.?!]\s+[a-z]/,
  /you left here last week,/i,
];

const REP_OPEN = "hi dr how are you? can we speak about the study i dropped off last week?";

async function runScenarioFirstTurn(scenario: any) {
  const sessionId = crypto.randomUUID();
  const currentBehaviorState = scenario.startingBehaviorState || "neutral";
  const currentJourneyState = scenario.journeyStage || "early_discovery";

  const scenarioContext = {
    title: scenario.title || "",
    stakeholder: scenario.stakeholder || "",
    objective: scenario.objective || "",
    persona: scenario.persona || "",
    journeyStage: scenario.journeyStage || null,
    interactionPressure: Array.isArray(scenario.interactionPressure) ? scenario.interactionPressure : [],
    startingBehaviorState: currentBehaviorState,
    currentBehaviorState,
    currentJourneyState,
    turnCount: 0,
    volatilityProfile: "stable",
  };

  const conversationState = {
    sessionId,
    scenarioId: scenario.id,
    scenarioTitle: scenario.title || "",
    currentBehaviorState,
    currentJourneyState,
    turnCount: 0,
    volatilityProfile: "stable",
    signals: [],
  };

  const start = await post("/api/roleplay/start", {
    sessionId,
    scenarioContext,
    conversationState,
  });

  if (!start.ok) {
    return {
      scenarioId: scenario.id,
      title: scenario.title,
      ok: false,
      error: `start ${start.status}`,
      hcpReply: "",
      badHits: ["start_failed"],
    };
  }

  const respond = await post("/api/roleplay/respond", {
    sessionId,
    repMessage: REP_OPEN,
    scenarioContext,
    conversationState,
  });

  const hcpReply = String(respond.json?.hcpReply || "").trim();
  const badHits = BAD_PATTERNS.filter((re) => re.test(hcpReply)).map((re) => re.toString());

  return {
    scenarioId: scenario.id,
    title: scenario.title,
    ok: respond.ok && hcpReply.length > 0 && badHits.length === 0,
    error: respond.ok ? null : `respond ${respond.status}`,
    hcpReply,
    badHits,
  };
}

async function main() {
  const scenarios = ALL_SCENARIOS.map(normalizeScenario);
  const selected = scenarios.slice(0, 12);

  const results = [];
  for (const scenario of selected) {
    const result = await runScenarioFirstTurn(scenario);
    results.push(result);
  }

  const failed = results.filter((r) => !r.ok);
  const summary = {
    checked: results.length,
    failed: failed.length,
    passRate: `${Math.round(((results.length - failed.length) / results.length) * 100)}%`,
  };

  console.log(JSON.stringify({ summary, failed, sample: results.slice(0, 6) }, null, 2));
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
