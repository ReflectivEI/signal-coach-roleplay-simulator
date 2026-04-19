# Deploy Sync Protocol

## Source of Truth
- `main` in this repo is the only deployable source of truth.
- `http://127.0.0.1:5173` is local UI testing only.
- `https://reflectivai-rps-api.tonyabdelmalak.workers.dev` is backend only.
- `https://signal-coach-roleplay-simulator.pages.dev` is public frontend only.

## Rules
1. No production/frontend behavior should be validated from localhost alone.
2. Worker-only changes must be deployed with `npm run worker:deploy`.
3. Frontend-only changes must be deployed with `npm run frontend:deploy`.
4. When UI and runtime both changed, always use `npm run deploy:full`.
5. Before any public test request, confirm:
   - current git commit
   - worker health
   - Pages deployment URL

## Test Order
1. Localhost for fast UI iteration.
2. `npm run build` and `npm run typecheck`.
3. Deploy worker if runtime changed.
4. Deploy frontend if UI changed.
5. Test the public Pages URL against the deployed worker.

## Canonical URLs
- Local UI: `http://127.0.0.1:5173`
- Public UI: `https://signal-coach-roleplay-simulator.pages.dev`
- Worker API: `https://reflectivai-rps-api.tonyabdelmalak.workers.dev`
