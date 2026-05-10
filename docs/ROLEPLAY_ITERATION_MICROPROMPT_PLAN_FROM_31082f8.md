# Roleplay iteration plan from `31082f8` using safe Codex micro-prompts

## Baseline commit timestamp (requested)
Roleplay baseline commit: **`31082f8`**
- Commit date/time: **2026-03-26 21:32:51 -0700**
- ISO timestamp: **2026-03-26T21:32:51-07:00**
- Subject: `Generalize direct-question scoring calibration rules`

## Base-reset procedure
Use `31082f8` as the clean base before iteration:

1. Create a safety tag before rollback:
   - `git tag pre-roleplay-rollback-$(date +%Y%m%d-%H%M%S)`
2. Move roleplay branch to `31082f8` baseline:
   - `git reset --hard 31082f8`
3. Re-run baseline checks immediately:
   - `npm run -s test:roleplay:runtime`
   - `npm run -s test:stabilization`

## Safe Codex micro-prompt operating rules
For each iteration, keep prompts constrained and atomic:

- **One behavior objective per prompt** (no mixed objectives).
- **File scope capped** (1-3 files max).
- **Require tests in same prompt** (must run roleplay tests before completion).
- **No refactor-only passes** unless tied to a failing roleplay assertion.
- **No cross-module policy rewrites** without first adding/adjusting fixtures.
- **Hard stop condition**: if result changes more than one scenario family unexpectedly, revert and split into smaller prompts.

## Iteration sequence (recommended)

### Iteration 0 — Lock baseline and fixtures
**Goal:** freeze current known-good behavior at `31082f8`.

**Micro-prompt 0A (safe):**
> On top of commit `31082f8`, add/verify deterministic fixtures for the top 5 observed roleplay paths without changing runtime logic. Modify only test fixtures and tests. Run `npm run -s test:roleplay:runtime` and `npm run -s test:stabilization`.

**Exit criteria:**
- All baseline tests pass.
- Fixtures capture desired roleplay signatures (including direct-question handling).

---

### Iteration 1 — Import only low-risk bugfixes (no policy expansions)
**Goal:** cherry-pick narrowly scoped fixes that reduce runtime failures without altering dialogue policy envelope.

**Candidate low-risk fixes to evaluate first:**
- import/runtime crash fixes,
- missing constant/recovery wiring fixes,
- deterministic flow guard fixes that do not alter scoring rubric definitions.

**Micro-prompt 1A (safe):**
> Starting from `31082f8`, apply only the smallest patch needed to fix [specific runtime defect] in roleplay execution. Do not change scoring heuristics or scenario routing policies. Touch at most 2 files. Add/adjust one regression test reproducing the defect. Run `npm run -s test:roleplay:runtime` and relevant unit tests.

**Exit criteria:**
- Target defect fixed.
- No fixture drift in baseline scenario outputs.

---

### Iteration 2 — Guardrail hardening, one guardrail at a time
**Goal:** improve robustness while minimizing behavior drift.

**Micro-prompt 2A (safe):**
> Implement exactly one guardrail improvement for [named failure mode] in roleplay. Restrict edits to guardrail module + one test file. Do not modify dialogue generation templates. Add a failing test first, then fix it. Run `npm run -s test:constraints` and `npm run -s test:stabilization`.

**Exit criteria:**
- New guardrail tests pass.
- No regressions in runtime fixtures.

---

### Iteration 3 — Direct-question calibration refinements
**Goal:** preserve `31082f8` strength while making targeted calibration refinements if needed.

**Micro-prompt 3A (safe):**
> Tune direct-question handling for [single misclassification case]. Limit changes to alignment/runtime calibration logic and one fixture file. Do not alter unrelated capability scoring. Demonstrate before/after on the target fixture and run full roleplay stabilization tests.

**Exit criteria:**
- Only target case changes.
- Non-target fixture outputs remain stable.

---

### Iteration 4 — Optional UI/runtime wiring updates behind flags
**Goal:** avoid broad behavior changes by gating optional enhancements.

**Micro-prompt 4A (safe):**
> Add [named enhancement] behind a disabled-by-default feature flag. No behavior changes when the flag is off. Add one test asserting flag-off equivalence with baseline behavior.

**Exit criteria:**
- Flag-off parity confirmed.
- Enhancement isolated and reversible.

## PR gating checklist per iteration
Every iteration PR should include:

1. Scope statement (exact files touched + why).
2. New/updated failing test that drove the change.
3. Test evidence:
   - `npm run -s test:roleplay:runtime`
   - `npm run -s test:stabilization`
4. Drift statement against baseline fixtures.
5. Rollback note (single commit revert path).

## Final recommendation
For **roleplay stability + controlled forward development**, revert to and iterate from **`31082f8`**.
Use the micro-prompt sequence above to re-introduce improvements safely, with test-gated, one-objective-at-a-time changes.
