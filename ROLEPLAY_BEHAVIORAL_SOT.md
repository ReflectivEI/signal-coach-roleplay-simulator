# Role Play Behavioral SOT

This repository treats the scenario catalog, taxonomy, HCP profile structure, mapping logic, and simulator behavior as the behavioral source of truth for the standalone role play simulator.

Behavioral invariants:

- The simulator owns the canonical built-in scenario catalog in [src/lib/scenarioCatalog.js](/Users/anthonyabdelmalak/Desktop/New%20Folder%20With%20Items/signal-coach-core/src/lib/scenarioCatalog.js:1).
- Frontend state and UX live in the React app under `src/`.
- Runtime generation, persistence, and external model access live in the Cloudflare Worker under `worker/`.
- Custom scenarios and completed sessions persist through worker endpoints, with local fallback only for resilience.

Runtime ownership:

- Scenario catalog rendering and filtering: `src/pages/Home.jsx`, `src/pages/ScenarioLibrary.jsx`
- Active simulator loop: `src/pages/Simulator.jsx`
- QA automation harness: `src/pages/QATwin.jsx`
- Worker-backed storage and generation client: `src/services/workerClient.js`
- Dedicated backend worker: `worker/src/index.js`

This repository is intended to remain deployment-independent from any external low-code platform runtime. Only the standalone app and its worker are authoritative here.
