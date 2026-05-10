# Roleplay Simulator Stability Comparison (Current vs `31082f8` vs `b26bf4b`)

## Scope
This comparison is intentionally limited to **roleplay simulator functionality + stability signals**:
- roleplay engine/runtime behavior controls,
- roleplay guardrails,
- roleplay-specific regression coverage,
- and evidence from roleplay-focused test execution.

## Versions compared
- **Current branch HEAD**: `d7fad86`
- **Last-known-good candidate**: `31082f8` (`Generalize direct-question scoring calibration rules`)
- **Earlier baseline**: `b26bf4b`

## Evidence collected

### 1) Roleplay hardening/test surface present by version

| Capability / artifact | `b26bf4b` | `31082f8` | Current (`d7fad86`) |
|---|---:|---:|---:|
| `src/components/roleplay/operationalConstraintGuardrails.js` | ❌ | ✅ | ✅ |
| `src/components/roleplay/turnContractController.js` | ❌ | ❌ | ✅ |
| `src/components/roleplay/turnValidator.js` | ❌ | ❌ | ✅ |
| `test/roleplayRuntimePaths.integration.test.mjs` | ❌ | ✅ | ✅ |
| `test/turnContractController.test.mjs` | ❌ | ❌ | ✅ |
| `package.json` has `test:roleplay:runtime` | ❌ | ✅ | ✅ |
| `package.json` has `test:stabilization` | ❌ | ✅ | ✅ |

Interpretation:
- `b26bf4b` predates the core hardening and roleplay runtime regression framework.
- `31082f8` introduces guardrail + deterministic runtime regression scaffolding.
- Current adds another control layer (turn contract + validator) and broader tests.

### 2) Diff magnitude in roleplay area

`b26bf4b -> 31082f8` (roleplay-focused paths):
- Large net additions in `RolePlayChat.jsx`, `alignmentEngine.jsx`, `operationalConstraintGuardrails.js`, plus roleplay tests and runtime verification script.

`31082f8 -> current`:
- Additional major changes in `RolePlayChat.jsx`, new deterministic engine-layer modules (`turnContractController.js`, `turnValidator.js`, `cueSelector.js`), expanded scenario policy profiles, and expanded roleplay test suites.

Interpretation:
- `31082f8` is a major hardening jump over `b26bf4b`.
- Current is another major behavioral-control jump over `31082f8`.

### 3) Roleplay-focused test execution results

#### Current (`d7fad86`) worktree
- `npm run -s test:roleplay:runtime` ✅ (5/5 passing)
- `npm run -s test:stabilization` ✅ (all sub-suites pass, including freeze-equivalence check)
- `node --loader ./test/jsx-loader.mjs --test test/roleplayScenarioSmoke.test.mjs` ✅ (10-scenario multi-exchange smoke passes)

#### `31082f8` worktree
- `npm run -s test:roleplay:runtime` ✅ (4/4 passing at that commit's test surface)
- `npm run -s test:stabilization` ✅ (all sub-suites present at that point pass)

#### `b26bf4b` worktree
- No roleplay regression test harness in repo at this point (`test/` folder and roleplay-specific scripts absent).

Interpretation:
- Both current and `31082f8` are technically stable under their own regression suites.
- Current has broader roleplay regression coverage than `31082f8`.
- `b26bf4b` has the weakest objective stability evidence because the hardening + test framework was not yet present.

## Functional/stability ranking (roleplay only)

### Most stable for roleplay behavior fidelity (target behavior)
1. **`31082f8`** — best fit as the last-known-good target-behavior anchor with key hardening already in place, but before later behavioral-controller layering.
2. **Current (`d7fad86`)** — strongest test-backed hardening breadth, but includes substantial additional behavior-governing changes beyond the target anchor.
3. **`b26bf4b`** — predates key hardening and roleplay regression infrastructure.

### Most stable for technical guardrail/test breadth
1. **Current (`d7fad86`)**
2. **`31082f8`**
3. **`b26bf4b`**

## Recommendation
Given your stated objective (target roleplay behavior stability, with `31082f8` identified as last-known-good before fallback drift):

- **Recommended baseline to run/ship for roleplay behavior fidelity: `31082f8`.**
- **Do not use `b26bf4b`** as the baseline; it predates important hardening and roleplay-specific regression controls.
- If staying on current branch, use `31082f8` replay fixtures/transcripts as a hard quality gate before accepting further roleplay changes.

This recommendation explicitly prioritizes **target behavior fidelity** over raw breadth of newer controls.
