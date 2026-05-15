# Signal Coach Core SOT Calibration

Date: 2026-05-14

## Engineering Source of Truth

The engineering SOT for Role Play Simulator work is:

- Repo: `/Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core`
- Branch: `fix/rps-ai-coach-persona-authority`
- Commit: `c908d02`
- Commit message: `Route local RPS through dev worker fallback`

## What This Means

- This local branch is the only approved baseline for further iteration and testing.
- `https://rps.reflectiv-ai.com/simulator` is **not** the SOT.
- Production may be compared against this branch, but production behavior is not authoritative over this branch.

## Local Runtime Targets

- Frontend: `http://127.0.0.1:5174`
- Worker: `http://127.0.0.1:8787`

## Current Local Status

- Frontend routing is calibrated to the local worker in dev.
- Raw provider failures no longer hard-break local testing.
- Local runtime can run in degraded fallback mode when provider credentials are missing or invalid.

## Current Blocking Condition For Full End-To-End Validation

The local worker still requires valid provider credentials for full behavioral certification:

- `GROQ_API_KEY`
- `GROQ_API_KEY_SB_2`
- `GROQ_API_KEY_SB_3`
- `GROQ_API_KEY_SB_4`
- `GROQ_API_KEY_SB_5`

Without valid local secrets, the simulator is only calibrated as a **code/runtime SOT**, not yet a **fully certified behavioral SOT**.

## Operational Rule

Until a newer local commit is intentionally promoted, all fixes, testing, and comparisons must anchor to:

- Branch: `fix/rps-ai-coach-persona-authority`
- Commit: `c908d02`

