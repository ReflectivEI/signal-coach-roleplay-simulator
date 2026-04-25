import fs from "node:fs";
import path from "node:path";
import { buildTranscriptAudit } from "../../src/lib/qaTwinAudit.js";
import { ALL_SCENARIOS } from "../../src/lib/scenarioCatalog.js";

const dir = path.resolve(".tmp/gold-readout");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".log")).sort();

for (const file of files) {
  const raw = fs.readFileSync(path.join(dir, file), "utf8");
  const start = raw.indexOf("JSON_SUMMARY_START");
  const end = raw.indexOf("JSON_SUMMARY_END");
  if (start === -1 || end === -1) {
    console.log(JSON.stringify({ file, complete: false }));
    continue;
  }
  const obj = JSON.parse(raw.slice(start + "JSON_SUMMARY_START".length, end).trim());
  const result = obj.results[0];
  const scenario = ALL_SCENARIOS.find((s) => s.title === result.title);
  const turns = (result.transcript || []).map((t: any, idx: number) => ({
    id: String(idx + 1),
    speaker: t.speaker,
    text: t.text,
    concept: t.concept || null,
  }));
  const audit = buildTranscriptAudit({
    scenario,
    turns,
    personaKey: obj.personaKey,
  });
  console.log(JSON.stringify({
    title: result.title,
    scenarioId: scenario?.id,
    persona: obj.personaKey,
    verdict: audit.verdict,
    failures: audit.failures.map((f: any) => f.type),
    fallbackCount: (raw.match(/REP_FALLBACK_USED/g) || []).length,
    repConcepts: turns.filter((t: any) => t.speaker === "rep").map((t: any) => t.concept),
    transcript: turns.map((t: any) => `${String(t.speaker || "").toUpperCase()}: ${t.text}`),
  }));
}
