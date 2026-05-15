# Standalone RPS Deployment Boundary and Main Site Link Audit

Date: 2026-05-15

## Dedicated Standalone RPS Targets

- GitHub repository: `ReflectivEI/signal-coach-roleplay-simulator`
- Cloudflare Worker: `reflectivai-rps-api`
- Worker URL: `https://reflectivai-rps-api.tonyabdelmalak.workers.dev`
- Cloudflare Pages project: `signal-coach-roleplay-simulator`
- Pages URL: `https://signal-coach-roleplay-simulator.pages.dev`
- Custom RPS domain: `https://rps.reflectiv-ai.com`

These targets are dedicated to the standalone Role Play Simulator and must not
be deployed from the main site repository.

## Main Site Targets

- GitHub repository: `ReflectivEI/reflectiv-AIv4`
- Cloudflare Worker: `reflect-ai-now`
- Cloudflare Pages project: `reflect-ai-now`
- Main domain: `https://reflectiv-ai.com`

The main site should link or redirect users into the standalone RPS. It must not
deploy the standalone RPS Worker or bundle the RPS Worker into `reflect-ai-now`.

## Protection Added In This Repo

- `.github/workflows/deploy-standalone-rps.yml`
  - Deploys only `reflectivai-rps-api` and `signal-coach-roleplay-simulator`.
  - Uses `standalone-rps-production` as the GitHub deployment environment.
  - Verifies the live Worker `/health` endpoint after deploy.
  - Verifies the live Worker `/api/llm/invoke` endpoint after deploy so stale or
    invalid provider secrets cannot pass on health alone.
  - Verifies the live Pages shell after deploy.
- `scripts/assert-rps-deploy-targets.mjs`
  - Fails if the workflow is not running in
    `ReflectivEI/signal-coach-roleplay-simulator`.
  - Fails if `wrangler.toml` does not target `reflectivai-rps-api`.
  - Fails if `wrangler.pages.toml` does not target
    `signal-coach-roleplay-simulator`.
  - Fails if deploy workflow/config text references forbidden main-site targets
    such as `reflect-ai-now`, `reflectiv-AIv4`, or `reflectiv-ai.com/*`.
- `.github/workflows/validate.yml`
  - Runs `npm run check:rps-deploy-targets` before the build gate.

## Main Site RPS Link Audit

Read-only audit path:
`/Users/anthonyabdelmalak/Desktop/reflectiv-AIv4`

Command used:

```bash
rg -n "Role Play|RolePlay|role play|role-play|Practice in Role Play|Role Play Simulator|RolePlaySimulator|rps\\.reflectiv-ai\\.com|signal-coach-roleplay-simulator|/rps|/RolePlaySimulator" src .github package.json wrangler*.toml --glob '!node_modules' --glob '!dist'
```

Actionable main-site RPS navigation references found:

- `src/Layout.jsx`
- `src/pages/Dashboard.jsx`
- `src/components/analytics/SessionAnalytics.jsx`
- `src/components/analytics/AIActionableInsights.jsx`
- `src/pages/Frameworks.jsx`
- `src/pages/CustomizationIntegration.tsx`
- `src/pages/LearningPaths.jsx`
- `src/pages/RolePlaySimulatorQA.jsx`
- `src/pages/ScenarioBuilder.jsx`
- `src/pages/CoachingModules.jsx`
- `src/pages/AICoach.jsx`
- `src/pages.config.js`

The dominant pattern is `createPageUrl("RolePlaySimulator")` or page metadata
with `page: "RolePlaySimulator"`. To avoid brittle manual rewrites across every
button, card, pill, generated recommendation, and notification, the main site
should enforce the standalone RPS handoff centrally:

1. Keep `reflectiv-AIv4` deployed only to `reflect-ai-now`.
2. Add a main-site deploy guard that fails if the main-site repo references
   `reflectivai-rps-api` or `signal-coach-roleplay-simulator` in deploy config.
3. Make the main-site `RolePlaySimulator` route immediately redirect to
   `https://rps.reflectiv-ai.com/`.
4. Optionally make `createPageUrl("RolePlaySimulator")` return a central
   handoff route such as `/RolePlaySimulator`, with the route performing the
   external redirect. This keeps existing 35+ UI references aligned without
   introducing React Router external-link inconsistencies.

## Current Status

- Standalone RPS repo workflow protection is implemented here.
- The main-site repo was audited read-only because its local checkout has
  unrelated uncommitted changes.
- Main-site link rewiring should be made in `ReflectivEI/reflectiv-AIv4` as a
  separate commit, preserving its existing `reflect-ai-now` Worker/Page targets.
