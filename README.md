# ReflectivAI App

## Overview

This repository contains the ReflectivAI frontend and the Cloudflare Worker-backed runtime used in local development and deployment.

## Local development

1. Install dependencies: `npm install`
2. Start the frontend: `npm run dev`
3. (Optional) Start the worker API locally: `npm run worker:dev`

The Vite development server runs at <http://localhost:5173>.

## Build and validation

- `npm run build` builds the frontend into `dist/client`
- `npm run verify:build-output` verifies the expected deployable artifact exists
- `npm run ci:build` runs the build plus artifact verification
- `npm run lint` runs ESLint
- `npm run typecheck` runs TypeScript checks via `tsc -p ./jsconfig.json`

## CI/CD

GitHub Actions now separates validation from deployment:

- `.github/workflows/validate.yml` builds and verifies deployable output on pushes to `main` and on pull requests, while reporting lint/typecheck findings as advisory job summary output
- `.github/workflows/deploy-pages.yml` builds and deploys the verified `dist/client` output to Cloudflare Pages

This keeps deployment aligned with the Vite output directory and avoids deploying the wrong folder.

## Deployment notes

- Vite is configured to emit the production build into `dist/client`
- Cloudflare Pages deployments should target `dist/client`
- The Cloudflare Worker entrypoint remains `src/worker.js`; these CI/CD changes do not modify Worker request handling

## Proxy environment note

If you see `npm warn Unknown env config "http-proxy"`, run npm commands with legacy proxy env vars unset (npm v10 deprecates that key format):

```bash
env -u npm_config_http_proxy -u npm_config_https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy npm run dev
```

Use the same `env -u ...` prefix for `npm run build`, `npm run ci:build`, and `npm run lint` when needed.

## Roleplay realism harness flags (default OFF)

These optional Vite flags add a no-default-impact safety harness for future realism transforms:

- `VITE_ENABLE_REALISM_TRANSFORM_HARNESS=true` enables a transform guard that can reject transformed dialogue and fall back to the original dialogue when integrity checks fail.
- `VITE_ENABLE_REALISM_REPLAY_METRICS=true` enables developer-console replay metrics for transform analysis (repetition ratio, question continuity, concern anchoring persistence, context carryover accuracy).

When both flags are unset (default), runtime behavior is unchanged.
