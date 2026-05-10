const fs = require('fs');

const p = process.argv[2];
if (!p) {
    console.error('Missing file path');
    process.exit(1);
}
const t = fs.readFileSync(p, 'utf8');
const m = t.match(/JSON_SUMMARY_START\n([\s\S]*?)\nJSON_SUMMARY_END/);
if (!m) {
    console.log(`NO_SUMMARY | ${p}`);
    process.exit(0);
}

const j = JSON.parse(m[1]);
const r = (j.results && j.results[0]) || {};
const assertions = r.assertions || {};
const assertionEntries = Array.isArray(assertions)
    ? assertions
    : Object.entries(assertions).map(([id, value]) => ({ id, pass: value === true }));
const failures = r.failures || (r.qaAudit && r.qaAudit.failures) || [];

const count = (type) => failures.filter((x) => x.failure_type === type || x.type === type).length;

console.log([
    r.title || '',
    r.persona || j.personaKey || '',
    r.verdict || (r.qaAudit && r.qaAudit.verdict) || '',
    `${assertionEntries.filter((a) => a.pass).length}/${assertionEntries.length}`,
    `stag=${count('conversation_stagnation')}`,
    `cont=${count('continuity_break')}`,
    `qobl=${count('question_obligation_failure')}`,
    `runtime=${r.system_runtime_status || 'PASS'}`,
    `banned=${(r.runtime_banned_phrase_findings || []).length}`,
    `gen=${r.generator_version || ''}`,
].join(' | '));
