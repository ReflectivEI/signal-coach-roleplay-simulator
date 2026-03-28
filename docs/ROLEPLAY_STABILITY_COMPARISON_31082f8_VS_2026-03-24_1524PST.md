# Roleplay Stability Comparison: `31082f8` vs 2026-03-24 ~3:24 PM PST snapshot

## Timestamp resolution (exact)
Requested baseline: **"3/24/26 at around 3:24 PM PST"**.

Git history shows:
- `11d124d` at **2026-03-24 14:04:45 -0700** (2:04:45 PM PDT/PST offset in repo metadata)
- next commit after that is `bdb408d` at **2026-03-24 15:44:27 -0700**

Therefore, at **~3:24 PM local repo time on 2026-03-24**, the repository state in effect was **`11d124d`**.

## Compared versions
- **Candidate A**: `31082f8` (`Generalize direct-question scoring calibration rules`)
- **Candidate B**: `11d124d` (effective repo state at ~3:24 PM on 2026-03-24)

## Roleplay-only evidence

### 1) Roleplay test/guardrail surface

| Capability | `11d124d` (~3:24 PM) | `31082f8` |
|---|---:|---:|
| `test:roleplay-harness` script | ✅ | ❌ |
| `test:roleplay:runtime` script | ❌ | ✅ |
| `test:constraints` script | ❌ | ✅ |
| `test:annotations` script | ❌ | ✅ |
| `test:stabilization` aggregate script | ❌ | ✅ |
| `test/roleplayRuntimePaths.integration.test.mjs` | ❌ | ✅ |
| `test/operationalConstraintGuardrails.test.mjs` | ❌ | ✅ |
| `test/annotationUtils.test.mjs` | ❌ | ✅ |
| `src/components/roleplay/operationalConstraintGuardrails.js` | ❌ | ✅ |

Interpretation: `31082f8` has materially broader, roleplay-specific deterministic/guardrail regression coverage and enforcement surface.

### 2) Roleplay delta size (`11d124d -> 31082f8`)
Major roleplay code and test changes were introduced between these points:
- `RolePlayChat.jsx`: **682 additions / 211 deletions**
- `alignmentEngine.jsx`: **80 additions / 3 deletions**
- `operationalConstraintGuardrails.js`: **126 additions** (new)
- new roleplay integration/unit tests and freeze-equivalence checks
- older `scripts/roleplay-replay-harness.mjs` removed; replaced by deterministic runtime + stabilization suite model

Interpretation: `31082f8` is not a tiny tweak over the 3/24 ~3:24 PM snapshot; it is a substantial hardening evolution.

### 3) Executed checks

#### On `11d124d`
- `npm run -s test:roleplay-harness` ✅
  - Output indicates replay harness passes for 3 archetypes + closure fixture.

#### On `31082f8`
- `npm run -s test:roleplay:runtime` ✅ (4/4)
- `npm run -s test:stabilization` ✅
  - constraints tests pass
  - annotation tests pass
  - runtime path integration tests pass
  - freeze-equivalence verification passes

Interpretation: both points pass their available checks, but `31082f8` demonstrates stability across a much wider roleplay validation surface.

## Recommendation
If your decision criterion is **best version to use and iterate from for roleplay stability + controlled evolution**, use:

## ✅ Recommended base: `31082f8`

Why:
1. It retains target behavior calibration intent while adding direct-question scoring calibration explicitly.
2. It includes deterministic runtime regression, constraint guardrails, annotation safety tests, and freeze-equivalence verification that the 3/24 ~3:24 PM snapshot does not have.
3. It provides a stronger safety net for future iteration (less risk of silent fallback drift).

When to pick `11d124d` instead:
- Only if you need to reproduce the exact pre-hardening conversational feel from that timestamp for forensic replay; not as the primary forward-iteration baseline.
