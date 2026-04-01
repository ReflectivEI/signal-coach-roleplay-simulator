# Role Play Simulator — Root Cause Diagnosis and Rebuild Decision (2026-04-01)

## Executive decision

**Recommendation: Rebuild on a new branch/standalone page (`RolePlaySimulatorV2`) and freeze current page to maintenance-only.**

Do **not** keep iterating with micro-patches on the current orchestration path as the primary strategy.

## What is the real root cause?

This is not a single bug. It is an architectural coupling failure.

### 1) One turn is being rewritten by multiple layers
The same HCP turn is generated, then repeatedly mutated by many rule paths:
- scenario fallback constructors (`buildFollowUpScenarioFallback`, `buildNonRepeatingScenarioFallback`)
- state/terminal policies
- repetition fallback
- late-turn forced response
- constraint draft guardrails + regeneration

Because these stages run sequentially, whichever stage runs last can override scenario-specific intent.

Evidence in code:
- Multiple fallback builders and deterministic cue pools in one file. (`RolePlayChat.jsx` lines 2874–3058)
- Late-turn forced response can overwrite dialogue. (`RolePlayChat.jsx` lines 3667–3676)
- Draft-violation guardrail can overwrite again. (`RolePlayChat.jsx` lines 3694–3725)

### 2) Constraint guardrail intent leaks into normal conversational generation
Even after opening-turn gating, late-turn constraint machinery still dominates many later turns and produces repetitive operationally constrained replies when triggered.

Evidence:
- late-turn selection and forced responses are tightly wired in primary generation flow. (`RolePlayChat.jsx` lines 3618–3676)

### 3) Concern abstraction is too coarse for scenario fidelity
`detectPrimaryConcern(...)` maps rich scenario context to a small concern set, and many branches converge to workflow/access style prompts.
This causes “different scenario, similar output” drift under common rep openings.

Evidence:
- first-turn global concern pools include broad classes and workflow default. (`RolePlayChat.jsx` lines 2997–3025)

### 4) Monolithic orchestrator increases regression blast radius
`RolePlayChat.jsx` contains policy, generation, guardrails, logging, scoring hooks, and UI glue in one execution path. Small edits create nonlinear behavior changes.

Evidence:
- orchestration+generation+guardrails in single file/flow. (`RolePlayChat.jsx` lines 2860–3778)

## Why screenshot behavior still feels inconsistent

Your screenshots show valid deterministic behavior but inconsistent conversational realism.
That happens because deterministic selection is now stable, but the generation pipeline is still over-constrained and multi-overwrite.

In short:
- **Deterministic != coherent.**
- You stabilized randomness but not architecture.

## Should you keep patching this path?

**No (as primary path).**
Keep current simulator for hotfixes only.

## Rebuild plan (recommended)

## Branch / page
- New branch: `roleplay-v2-rebuild`
- New standalone page: `RolePlaySimulatorV2` (route behind feature flag)
- Keep existing page live until parity gates pass.

## V2 architecture (strict)

1. **Single response planner output per turn**
   - planner returns one immutable `TurnPlan` object:
     - `nextDialogue`
     - `nextCue`
     - `nextState`
     - `constraintDecision`
   - downstream layers render only; no further text rewrites.

2. **One cue authority**
   - V2 frontend cue engine authoritative OR worker cues authoritative (choose one and lock).

3. **Guardrails as validators, not text authors**
   - guardrails may reject/accept a draft and request replanning,
   - but should not append independent canned text in-line multiple times.

4. **Scenario DSL**
   - introduce canonical schema with explicit:
    - state transitions
    - cue library
     - metric applicability
     - evidence requirements
   - avoid free-form scenario effects in orchestration code.

5. **Golden fixtures before rollout**
   - 15–20 scenario fixtures, each with:
     - same opening test
     - expected state/cue/dialogue class
     - expected metric activation
   - CI fails if outputs drift.

## Migration gates (must pass)

- Gate 1: identical deterministic replay for fixed seeds.
- Gate 2: no generic fallback collapse under shared rep openings.
- Gate 3: opening-turn + turn-2 realism checks across all scenario families.
- Gate 4: side-by-side human eval against current page (>=90% preference).

## What to do now (next 72 hours)

1. Freeze current `RolePlayChat.jsx` except crash fixes.
2. Create `RolePlaySimulatorV2` standalone route.
3. Implement minimal V2 turn planner with immutable `TurnPlan`.
4. Port 7 example scenarios first, then all scenario families.
5. Add CI fixture harness before broad migration.

## Merge guidance for current branch

- Merge only crash/stability patches.
- Do not merge additional behavior-shaping micro-prompts into v1 unless blocking production incidents.
