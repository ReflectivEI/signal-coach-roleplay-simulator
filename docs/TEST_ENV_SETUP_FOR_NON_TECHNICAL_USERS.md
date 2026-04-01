# Test Environment Setup (Non-Technical)

This guide helps you run a safe local test environment before merging changes.

## What you need installed
- Node.js 20+
- npm

## One-time setup
1. Open Terminal
2. Go to the project folder
3. Run:

```bash
npm install
```

## Start test environment (one command)
Run:

```bash
npm run testenv:start
```

This starts:
- local frontend (Vite) on `http://localhost:4173`
- local Worker API

Open this in your browser:
- `http://localhost:4173/RolePlaySimulator`
- optional V2 preview: `http://localhost:4173/RolePlaySimulatorV2?rpv2_backend=1`

To stop everything, press `Ctrl + C`.

## Run deterministic checks before merge
In a new Terminal tab/window, run:

```bash
npm run testenv:check
npm run build
```

## Merge recommendation
- ✅ If simulator behavior looks correct and tests/build pass, then merge.
- ❌ If any loop/drift remains, do not merge yet.
