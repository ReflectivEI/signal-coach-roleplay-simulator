# Evidence Governance And Continuous Learning

## Governed Evidence Ingestion

The worker now exposes governed evidence endpoints:

- `GET /api/evidence/sources`
- `GET /api/evidence/records?domain=<disease>&limit=<n>`
- `POST /api/evidence/ingest`

Governance rules are implemented in [worker/src/evidenceGovernance.js](worker/src/evidenceGovernance.js):

- allowlisted-source validation against trusted guideline/journal/society domains
- per-record source credibility scoring
- publication recency scoring
- claim-strength scoring
- contradiction detection across records with the same disease/topic key

## Continuous Learning Memory Evaluation

Nightly and release-candidate metrics are evaluated by [scripts/continuous-learning-memory-eval.ts](scripts/continuous-learning-memory-eval.ts), using:

- confidence gate trend
- opener adaptation sweep trend
- cross-path parity trend
- persona-lane calibration trend
- QA run history risk/openness drift

Profile policy and weights live in [src/lib/continuousLearningProfile.json](src/lib/continuousLearningProfile.json).

Promotion is controlled:

- evaluate only: `npm run test:continuous-learning-eval`
- promote only on validated pass: `npm run continuous-learning:promote`

## Release Candidate Blocking Gates

Global blocking gate script:

- `npm run test:release-candidate-gates`

This includes:

- confidence gate
- opener adaptation sweep
- cross-path shared-vs-worker parity gate
- persona-lane specialty calibration gate
- continuous-learning memory evaluation

CI workflows:

- [release-candidate-gates.yml](.github/workflows/release-candidate-gates.yml)
- [nightly-continuous-learning.yml](.github/workflows/nightly-continuous-learning.yml)
