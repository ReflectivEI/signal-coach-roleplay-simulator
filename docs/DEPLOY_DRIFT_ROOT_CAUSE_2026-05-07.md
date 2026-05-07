# Deploy Drift Root Cause (2026-05-07)

## What Was Confirmed

- Legacy 6-control Adaptive RPS UI is present in commit `d878c6f`.
- Commit `d878c6f` is still referenced by:
  - tag `RPS_STABLE_V1`
  - remote branch `origin/rps-stable-freeze-v1`
- Correct 3-control + realism-lever Adaptive RPS UI is present from commit `4291206` onward, including:
  - `4291206`
  - `e782e2b`
  - `e0bc42c`

## Signature Check Used

Good (required):
- `hcpType: ""`
- `stage: ""`
- `challenge: ""`
- `REALISM_LEVEL_LABELS`

Bad (forbidden):
- `hcp_profile: ""`
- `journey_stage: ""`
- `access_barrier_context: ""`
- `rep_objective: ""`

## Root Cause

Deployment drift came from selecting/deploying legacy commit lines (and/or legacy stable refs) instead of staying pinned to the latest 3-control + realism-lever commit line.

## Correct Version Line to Deploy

Deploy from commits that include the good signatures above and exclude all forbidden signatures.

Recommended baseline floor commit:
- `4291206`

Current validated local tip in this repo:
- `e0bc42c`

## Guard Added

A hard signature gate has been added to:
- `scripts/check-rps-ux-guardrails.mjs`

This gate now fails build/deploy checks if Adaptive RPS regresses to the legacy 6-control schema.
