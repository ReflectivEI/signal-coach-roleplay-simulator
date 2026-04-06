# Role Play Simulator Baseline Audit: PR #515 vs #516 vs #517-era current

Date: 2026-04-06 (UTC)

## Scope and compared revisions

- **PR #515 baseline**: merge commit `8a63081`.
- **PR #516 baseline**: merge commit `93988d3`.
- **PR #517 merge state**: merge commit `339c5b9`.
- **Current branch HEAD** (used as “current state”): `776dee9` (contains PR #517 plus PR #518 fix commit `f1c112b`).

## What was measured

1. Regression/stability signals from deterministic snapshot tests.
2. Deterministic replay behavior (repeat-run equality tests).
3. Realism/coherence checks from reaction contract tests.
4. Code-level contract health for escalation presentation wiring.

## Commands used

```bash
git worktree add --detach /tmp/rp_audit/8a63081 8a63081
git worktree add --detach /tmp/rp_audit/93988d3 93988d3
git worktree add --detach /tmp/rp_audit/339c5b9 339c5b9
git worktree add --detach /tmp/rp_audit/776dee9 776dee9

# Per revision, targeted tests:
node --test test/scenarioDomainIntegrity.test.mjs
node --test test/escalationDecisionGoldenSnapshot.test.mjs
node --test test/hcpEnforcementEscalationStyleVariation.test.mjs
node --loader ./test/jsx-loader.mjs --test test/hcpReactionIntegrity.test.mjs
```

## Findings matrix

| Dimension | PR #515 (`8a63081`) | PR #516 (`93988d3`) | PR #517 merge (`339c5b9`) | Current (`776dee9`) |
|---|---|---|---|---|
| `scenarioDomainIntegrity` | pass | pass | pass | pass |
| Escalation golden snapshot | n/a (test not present) | **pass** | **fail** | **fail** |
| Escalation style variation contract | n/a (test not present) | **pass** | **fail** (missing export) | **fail** (missing export) |
| HCP reaction integrity suite | **13/13 pass** | **13/13 pass** | **5/17 pass** (hard runtime wiring break) | **16/17 pass** (1 realism assertion still failing) |
| Deterministic replay (within snapshot suite) | n/a | pass | pass | pass |

### Critical regression notes

- PR #517 merge commit (`339c5b9`) used `STAGE_DIRECTIVE_MAP` in `applyEscalationPresentation` while only `STAGE_DIRECTIVE_TEMPLATE_MAP` existed, creating a runtime `ReferenceError` path during reaction contract construction.
- Current HEAD (`776dee9`) fixed that identifier path (`STAGE_DIRECTIVE_TEMPLATE_MAP`) via post-PR #517 fix, restoring most reaction tests.
- Current HEAD still diverges from the golden escalation decision snapshot and still fails the style-variation test import contract.
- Current HEAD also fails one realism calibration assertion because the selected cue became a generic “focused ask” cue instead of operationally grounded cue language expected by test.

## Interpretation by objective

### 1) Stability (change safety + regression surface)

- **Best: PR #516**. It keeps all tested contracts green, including newly added seed-matrix and style-variation contract checks.
- PR #515 is stable but has less explicit guardrail coverage for style/presentation drift.
- PR #517-era current is improved from raw #517 merge but still has unresolved regression signals.

### 2) Determinism (same inputs => same outputs)

- PR #516 and current both retain deterministic replay behavior in repeated-run checks.
- However, current breaks exact golden snapshot equivalence for escalation matrix, indicating deterministic-but-shifted behavior (predictable yet no longer baseline-consistent).
- For baseline locking, PR #516 is stronger because deterministic behavior is also snapshot-aligned.

### 3) Realism (domain-grounded, clinically plausible friction)

- PR #515 and #516 pass their reaction integrity coverage.
- Current adds richer realism calibration checks but still fails one cue realism expectation (operational specificity), suggesting occasional generic cue regression.
- Net: current has potentially richer realism architecture, but PR #516 is the safer **production baseline** until current’s realism and style-contract regressions are resolved.

## Recommendation

**Use PR #516 (`93988d3`) as the baseline** for now.

Why:
1. Highest combined score across stability + deterministic lock + realism contract coverage.
2. No runtime escalation-presenter wiring regression.
3. Passes golden escalation seed-matrix snapshot and style-variation contract tests.
4. PR #515 is safer than current but less complete; current is closest to future target but still not baseline-grade because two contract areas remain red.

## Suggested gate before promoting current over #516

1. Restore style variation export/test contract consistency (`assertTemplateEquivalence` path).
2. Reconcile escalation decision matrix: either restore pre-drift behavior or intentionally re-baseline with explicit approval.
3. Resolve realism calibration cue specificity regression (operationally grounded cue language for high-time-pressure workflow contexts).
4. Require full green on the targeted suites above before baseline switch.
