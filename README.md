# Signal Coach Core

Standalone Role Play Simulator built as an independent frontend plus dedicated backend worker.

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create worker secrets and local frontend config:

```bash
cp .dev.vars.example .dev.vars
printf "VITE_ROLEPLAY_WORKER_URL=http://127.0.0.1:8787\n" > .env.local
```

3. Run the dedicated Cloudflare Worker:

```bash
npm run worker:dev
```

4. In a second terminal, run the frontend:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

5. Build for production:

```bash
npm run build
```

## Runtime model

- Built-in scenarios come from the local SOT catalog in the frontend.
- Custom scenarios are persisted through the worker and cached locally as a fallback.
- Completed simulator sessions are persisted through the worker.
- HCP generation, coaching support, and structured review generation run through the worker.
- The worker lives in `worker/src/index.js` and exposes `/health`, `/api/llm/invoke`, `/api/scenarios`, and `/api/roleplay/sessions`.

## Important

This app is intentionally standalone and can be integrated later as a separate subsystem once stabilized.
