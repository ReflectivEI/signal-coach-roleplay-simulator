# Role Play Simulator Stabilization — Next Safest Step (2026-04-01)

## Direct answer: are Worker and Pages both necessary?

Short answer: **not for a single production domain path**.

- If `reflectiv-ai.com` is routed through a Cloudflare Worker that serves the site bundle, that Worker path is sufficient for production runtime.
- Cloudflare Pages can still be useful for preview/staging, but it should not be treated as a second production source unless releases are SHA-locked.

## Why this drift happened

The current topology allows two independent deploy paths:
1. Worker deploy path (domain-routed runtime)
2. Pages deploy path (separate artifact + timestamp)

Without a release gate requiring same commit SHA and same asset fingerprint, these paths can drift and produce inconsistent behavior.

## Single safest next move

Create an **isolation branch** that does only three deterministic realism fixes while preserving contracts:

1. Remove non-deterministic description selection (`Math.random`) from HCP behavioral description paths.
2. Narrow negativity detection to explicit resistance/escalation patterns only.
3. Enforce true per-session cue seeding (`scenarioId + sessionId + turnNumber`) with no default fallback seed.

Do not change:
- worker contract shapes
- API paths
- the 8 behavioral metric IDs
- scoring formulas

## Release stabilization policy (must-have)

1. **Production source of truth**: Worker deploy for `reflectiv-ai.com`.
2. Pages is preview-only unless explicitly promoted.
3. Add a release gate requiring:
   - same git SHA in Worker and Pages metadata,
   - same app build identifier displayed in UI diagnostics,
   - smoke pass on Role Play Simulator start/respond/end.
4. Block release if any check fails.

## Prompt 1 — Codex execution prompt (contract-preserving)

```text
ROLE
You are a principal engineer performing surgical stabilization of Role Play Simulator.

GOAL
Stabilize realism behavior without changing scoring integrity or worker contract.

NON-NEGOTIABLES
- Keep 8 metric IDs unchanged:
  question_quality, listening_responsiveness, making_it_matter,
  customer_engagement_signals, objection_navigation,
  conversation_control_structure, adaptability, commitment_gaining.
- Do not change /api request or response contracts.
- No randomness in cue or behavioral-description selection.
- Do not alter scoring formulas.

REQUIRED CHANGES (ONLY THESE)
1) Remove Math.random usage in HCP behavioral description selection.
   Replace with deterministic seed:
   hash(scenarioId + sessionId + turnNumber + cueIds)

2) Tighten negativity detection:
   Remove generic triggers (no/not/why/busy/problem).
   Keep explicit resistance/pushback/refusal language only.

3) Ensure cue manager receives true session seed:
   pass scenarioId + sessionId to cue selection.
   remove default seed fallback behavior.

4) Keep HCP dialogue authoritative:
   behavioral description must be metadata, not rewritten dialogue.

5) Add regression tests:
   - same transcript + same seed => same cues/description
   - non-hostile phrases do not trigger negative bias
   - roleplay start/respond/end smoke test passes

OUTPUT
- Minimal diff
- Contract unchanged
- Test proof
- Risk notes
```

## Prompt 2 — Enterprise architecture prompt (future-state)

```text
Design a deterministic enterprise Role Play Simulator using a canonical Scenario DSL and 4-layer architecture.

MANDATORY ARCHITECTURE
Layer 1: Scenario DSL (declarative only)
- scenario identity, training intent, hcp profile, scene setup,
  state model, cue library, dialogue rules,
  metric applicability matrix, feedback contract, test fixtures.
- no scoring formulas in scenario files.

Layer 2: HCP State Engine
- deterministic transitions only
- explicit trigger tables
- no free-form LLM state transitions

Layer 3: Rep Evidence Extractor
- observable behavior evidence only
- no intent/emotion/personality inference

Layer 4: Scoring & Feedback Engine
- single source of truth
- scenario-agnostic formulas
- apply scenario metric-applicability flags only

GOVERNANCE RULES
- cue is input, not score
- deterministic seeding for all variation
- strict feedback evidence policy
- scenario semantic versioning
- mandatory regression fixtures per scenario

OUTPUTS REQUIRED
1) Typed DSL schema + enums + validation rules
2) End-to-end data flow/state transition design
3) Determinism and replay strategy
4) Regression harness design and CI gates
5) Migration plan from current model with zero contract break
```

## Operational checklist for next deploy

- [ ] Confirm production route ownership (`reflectiv-ai.com` via Worker).
- [ ] Add build SHA + build time to a diagnostics endpoint/UI footer.
- [ ] Run deterministic cue replay tests.
- [ ] Run roleplay start/respond/end smoke.
- [ ] Deploy Worker artifact.
- [ ] Verify domain now serves expected SHA.
- [ ] Keep Pages as preview unless promoted with same SHA gate.
