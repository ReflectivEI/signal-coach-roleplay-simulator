# Locked Baseline

Date: 2026-05-09

Locked baseline commit:
`f59eca69aac94533388a5b8df706855b73dc8644`

Branch at lock time:
`fix/rps-ai-coach-persona-authority`

Frontend baseline:
`https://rps.reflectiv-ai.com/`

Backend worker baseline:
`https://reflectivai-rps-api.tonyabdelmalak.workers.dev`

Purpose:
- This file replaces a git tag that could not be created from the current execution environment because `.git/refs/tags` was not writable.
- All further debugging and fixes for the live-worker-aligned RPS must be made against this baseline only.
- No drift to the pilot worktree or older external-redirect branches is allowed.
