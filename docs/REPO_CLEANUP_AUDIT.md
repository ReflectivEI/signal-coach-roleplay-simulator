# Repo Cleanup Audit

Date: April 15, 2026

## Scope

This audit focused on two questions:

1. Is the standalone simulator still coupled to Base44 at runtime?
2. Which leftover files are active runtime dependencies versus stale or template baggage?

## Base44 Runtime Divorce Status

Runtime divorce is clean.

Confirmed removed or absent from active runtime:

- Base44 SDK imports
- Base44 auth/bootstrap paths
- Base44 entity/function runtime calls
- Base44 worker endpoints
- Base44 app title/branding residue in app shell

Active runtime now uses:

- Frontend app in `src/`
- Dedicated Cloudflare Worker in `worker/src/index.js`
- Frontend worker adapter in `src/services/workerClient.js`
- Built-in simulator catalog in `src/lib/scenarioCatalog.js`

## Safe Removals Completed

Removed because they were not referenced by the runtime and increased confusion:

- `src/components/UserNotRegisteredError.jsx`
- `src/components/simulator/BehaviorSignalsPanel.jsx`
- `src/components/simulator/CoachingNudgeBanner.jsx`
- `src/components/simulator/HcpSignalsPanel.jsx`
- `src/lib/query-client.js`
- `src/lib/simulatorCueInstructions.ts`
- `src/utils/index.ts`
- local `.DS_Store` artifacts

Also simplified:

- `src/App.jsx` no longer wraps the app in an unused React Query provider
- `src/lib/simulatorEngine.ts` no longer carries misleading stubbed runtime exports

## Active Runtime Files To Keep

These are part of the current simulator path and should be treated as production-bearing:

- `src/pages/Home.jsx`
- `src/pages/Simulator.jsx`
- `src/pages/ScenarioBuilder.jsx`
- `src/pages/QATwin.jsx`
- `src/pages/AdminDashboard.jsx`
- `src/pages/ScenarioLibrary.jsx`
- `src/lib/scenarioCatalog.js`
- `src/lib/scenarioStorage.js`
- `src/lib/conversationInit.ts`
- `src/lib/hcpResponseGenerator.ts`
- `src/lib/hcpCueGenerator.ts`
- `src/lib/hcpBehaviorPrediction.ts`
- `src/lib/hcpStateEngine.ts`
- `src/lib/capabilityEvaluation.ts`
- `src/lib/sessionReview.ts`
- `src/lib/openingSceneEngine.ts`
- `src/services/workerClient.js`
- `worker/src/index.js`

## Keep For Now, But Review Later

These are not current blockers, but they add noise and should be reviewed after the simulator is behavior-stable:

- `src/components/ui/*`
  - Many of these are generic template/shadcn-style components not used by the simulator.
  - They are not Base44 coupling.
  - They can be pruned in a later dependency-reduction pass.
- `src/components/layout/EnterpriseBanner.jsx`
  - Used by the Scenario Builder.
  - Functionally safe, but naming is enterprise-site flavored and may be renamed later.
- `package.json`
  - Still contains many template-era dependencies not needed by the current simulator runtime.
  - Safe to reduce later once feature wiring and QA hardening are complete.

## Open Cleanup Risks

These are not stale files, but they are areas where cleanup must be careful:

- `src/components/simulator/SessionSummaryModal.jsx`
  - Contains compatibility handling for multiple review object shapes.
  - This is a legacy-contract cleanup target, not dead code.
- `src/lib/scenarioStorage.js`
  - Worker-first with local fallback.
  - Good for resilience, but should eventually be governed by one stricter persistence contract.
- `src/index.css`
  - Pulls Google Fonts at runtime.
  - Not a Base44 dependency, but still an external runtime dependency.

## Current Recommendation

The repo is safe to continue hardening as the standalone simulator.

Next cleanup should be behavior-led, not cosmetic:

1. Harden simulator determinism and cue/dialogue alignment.
2. Unify review and QA contracts.
3. Tighten scenario-builder-to-simulator mapping validation.
4. Reduce unused template dependencies only after behavior is locked.
