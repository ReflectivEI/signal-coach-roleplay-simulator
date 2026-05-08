# Role Play Simulator Freeze — 2026-03-17

## Frozen Systems
- Backend contract (Cloudflare worker + API routes)
- RolePlayChat flow
- hcpSimulationEngine
- alignmentEngine scoring
- signal intelligence metric structure
- End & Get Feedback generation

## Invariants
- Only REP is evaluated
- HCP is never evaluated
- HCP provides cues/context only
- 8 metrics remain unchanged
- Evaluation must remain transcript-grounded and specific
- Role play must remain deterministic and scenario-aware

## Forbidden Changes
- Scoring logic modifications
- Evaluation prompt changes
- Role attribution changes
- Backend contract changes
- Scenario determinism changes

## Safe Zones
- UI-only text labels
- visual styling
- non-functional display wrappers

## Tag Reference
roleplay-stable-rep-eval-freeze-2026-03-17
