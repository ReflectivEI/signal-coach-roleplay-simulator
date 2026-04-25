import fs from 'node:fs';
import path from 'node:path';
import { ALL_SCENARIOS } from '../../src/lib/scenarioCatalog.js';
import { buildTranscriptAudit } from '../../src/lib/qaTwinAudit.js';

const dir = path.resolve('.tmp/behavior-check');
const files = fs.readdirSync(dir).filter((name) => /^run-\d+\.log$/.test(name)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
const results = [];
for (const file of files) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8');
  const match = raw.match(/JSON_SUMMARY_START\n([\s\S]*?)\nJSON_SUMMARY_END/);
  if (!match) {
    results.push({ file, error: 'missing_json_summary' });
    continue;
  }
  const parsed = JSON.parse(match[1]);
  const entry = parsed.results?.[0];
  const scenario = ALL_SCENARIOS.find((item) => item.title === entry.title);
  const turns = (entry.transcript || []).map((turn, index) => ({
    id: `${file}-${index}`,
    speaker: turn.speaker,
    text: turn.text,
    concept: turn.concept || null,
    cues: turn.cue ? [{ label: turn.cue, description: turn.cueDescription || '' }] : [],
    nudge: turn.nudge ? { guidance: turn.nudge } : null,
  }));
  const personaKey = parsed.personaKey;
  const audit = buildTranscriptAudit({ scenario, turns, personaKey });
  const failures = [...new Set(audit.failures.map((item) => item.type))].sort();
  results.push({
    file,
    title: entry.title,
    personaKey,
    transcript: entry.transcript,
    failures,
  });
}
const counts = {};
for (const result of results) {
  for (const failure of result.failures || []) counts[failure] = (counts[failure] || 0) + 1;
}
console.log(JSON.stringify({ results, counts }, null, 2));
