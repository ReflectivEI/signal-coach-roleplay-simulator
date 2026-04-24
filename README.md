# Signal Coach Roleplay Simulator

Standalone Role Play Simulator built as an independent frontend plus dedicated backend worker.

GitHub repo:
`ReflectivEI/signal-coach-roleplay-simulator`

Production worker target:
`https://reflectivai-rps-api.tonyabdelmalak.workers.dev`

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create worker secrets:

```bash
cp .dev.vars.example .dev.vars
```

3. Run the dedicated Cloudflare Worker:

```bash
npm run worker:dev
```

Local worker target:
`http://127.0.0.1:8787`

4. In a second terminal, run the frontend:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Local frontend target:
`http://127.0.0.1:5173`

5. Build for production:

```bash
npm run build
```

## Runtime model

- Built-in scenarios come from the local SOT catalog in the frontend.
- Custom scenarios are persisted through the worker and cached locally as a fallback.
- Completed simulator sessions are persisted through the worker.
- HCP generation, coaching support, and structured review generation run through the worker.
- The worker lives in `worker/src/index.js` and exposes `/health`, `/api/llm/invoke`, `/api/scenarios`, `/api/roleplay/sessions`, `/api/roleplay/start`, and `/api/roleplay/respond`.

## Important

This app is intentionally standalone and can be integrated later as a separate subsystem once stabilized.
