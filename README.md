# Signal Coach Core

Standalone Role Play Simulator frontend built from the Base44 behavioral SOT and wired to a dedicated backend worker.

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
- Custom scenarios are stored in browser local storage.
- HCP generation, coaching support, and structured review generation run through the worker.
- The worker lives in `worker/src/index.js` and exposes `/health` and `/api/llm/invoke`.

## Important

This app is intentionally standalone.

- No Base44 SDK
- No Base44 auth
- No Base44 entities/functions
- No dependency on the enterprise platform

Once this simulator is stable on its own, it can be integrated into the enterprise site as a separate proven subsystem.
