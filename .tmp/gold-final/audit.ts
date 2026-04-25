import fs from 'node:fs';
import path from 'node:path';
import { buildTranscriptAudit } from '../../src/lib/qaTwinAudit.js';
import { ALL_SCENARIOS } from '../../src/lib/scenarioCatalog.js';
const dir = path.resolve('.tmp/gold-final');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.log')).sort();
for (const file of files) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8');
  const start = raw.indexOf('JSON_SUMMARY_START');
  const end = raw.indexOf('JSON_SUMMARY_END');
  const obj = JSON.parse(raw.slice(start + 'JSON_SUMMARY_START'.length, end).trim());
  const result = obj.results[0];
  const scenario = ALL_SCENARIOS.find((s) => s.title === result.title);
  const turns = (result.transcript || []).map((t: any, idx: number) => ({ id: String(idx + 1), speaker: t.speaker, text: t.text, concept: t.concept || null }));
  const audit = buildTranscriptAudit({ scenario, turns, personaKey: obj.personaKey });
  console.log(JSON.stringify({ title: result.title, persona: obj.personaKey, verdict: audit.verdict, failures: audit.failures.map((f: any) => f.type) }));
}
