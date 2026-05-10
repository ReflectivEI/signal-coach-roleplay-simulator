# Role Play Simulator Global Regression Review (Repo-Specific)

## 1. Repository map

### prompt assembly
- `src/components/roleplay/hcpSimulationEngine.jsx`
  - `buildHCPDialoguePrompt(...)` constructs the full HCP generation prompt, including role rules, realism rules, mode-shift instructions, and history injection.

### orchestration / turn manager
- `src/components/roleplay/RolePlayChat.jsx`
  - Main per-turn orchestration path that:
    - computes alignment on rep turn,
    - extracts operational constraints,
    - ranks response objective,
    - generates next HCP turn,
    - runs post-generation guardrails,
    - applies closure/end-session decisions.

### memory / state
- `src/components/roleplay/RolePlayChat.jsx`
  - `plannerStateSnapshot` stores active concern, active constraints, objective ranking metadata, unresolved concern counters, and loop-breaker context on each turn.
- `src/components/roleplay/operationalConstraintGuardrails.js`
  - constraint extraction, grounding, draft validation, and fallback helpers.

### response policy / mode selection
- `src/components/roleplay/RolePlayChat.jsx`
  - `rankResponseObjective(...)` scores candidate objectives (`close_or_limit_scope`, `answer_direct_constraint_question`, `reanchor_to_constraint`, `advance_with_constraint`, `continue_dialogue`) with constraint-aware boosts.
  - `determineTerminalPolicyAction(...)` selects close/probe/continue behavior from state and unresolved concern progression.

### evaluator / tests
- `src/components/roleplay/alignmentEngine.jsx`
  - `computeAlignment(...)` scores rep behavior and applies penalties for unanswered direct HCP questions.
- `test/roleplayRuntimePaths.integration.test.mjs`
  - deterministic runtime/scoring checks and a direct-question scoring fixture.
- `test/roleplayScenarioSmoke.test.mjs`
  - 10-scenario deterministic smoke loop.
- `test/operationalConstraintGuardrails.test.mjs`
  - unit tests for grounded/non-duplicate operational-constraint mention enforcement.

### scenario config / prompt content
- `src/pages/RolePlaySimulator.jsx`
  - scenario catalog used by simulator UI (demo set and metadata).
- `src/components/roleplay/scenarioPolicyProfiles.js`
  - scenario-family classification and policy overrides.

## 2. What this PR actually changes

Based on repo commit references and branch artifacts, the currently referenced PR scope is mainly:
- Scenario/demo set wiring updates in `RolePlaySimulator`.
- Addition of a deterministic 10-scenario smoke test.
- Documentation around commit references and stability audit.

This means the observed PR is primarily:
- **code changes**: scenario catalog / selection surface,
- **tests**: deterministic smoke coverage,
- **docs**: audit/reference notes,
- **not** a full new architecture layer for turn obligations.

## 3. Does the PR implement the global fix?

**Answer: partially.**

The repo contains meaningful improvements in constraint handling and objective ranking in core orchestration, but it does **not** yet implement a clear, explicit, platform-wide Turn Contract Controller with hard obligation ledgers and deterministic response-mode gating independent of prompt behavior.

Specifically:
- There is partial response-policy arbitration and operational-constraint tracking.
- There is **not** an explicit global obligation ledger for unanswered direct questions, unresolved objections by contract, accepted constraints, and closure preconditions as first-class machine state.
- Evaluator signals still function mainly as scoring/coaching artifacts, not hard pre-send gating with retry guarantees.

## 4. Evidence from the repo

- Prompt layering is centralized in `buildHCPDialoguePrompt(...)`, where scenario metadata, personality, locked state, rule lists, and conversation history are concatenated into one instruction stack. This can still produce instruction collisions because mode and realism directives are prompt-level, not enforced by a strict external controller.
- Objective ranking exists in `rankResponseObjective(...)` with explicit direct-question and constraint-aware scoring boosts.
- Planner/state snapshotting is present (`plannerStateSnapshot`) and includes active constraints, objective ranking, and unresolved concern counters.
- Post-generation constraint checks are present via `evaluateConstraintDraft(...)` and fallback repair paths.
- Closure handling exists via terminal policy action and session end flagging (`shouldEndSessionAfterTurn`, `SessionState.ENDED`).
- Evaluator (`computeAlignment`) penalizes non-answers to direct questions but does not itself enforce generation retries or hard fail-closed turn completion.

Missing versus diagnosis target:
- No explicit standalone Turn Contract Controller module/class appears in repo.
- No explicit unresolved-question ledger with lifecycle states (open/answered/deferred/closed) appears as dedicated state model.
- No explicit closure eligibility contract object appears (current logic is inferred from heuristics and state flags in turn flow).
- No evaluator-driven hard gating/retry contract appears as a guaranteed mechanism.

## 5. Root-cause coverage assessment

- **prompt arbitration**: **partially covered**
- **turn obligation enforcement**: **partially covered**
- **state tracking**: **partially covered**
- **response-mode selection**: **partially covered**
- **closure gating**: **partially covered**
- **evaluator alignment**: **partially covered**
- **cross-scenario regression prevention**: **partially covered**

## 6. Highest-risk gaps before merge

1. Response-mode arbitration is still largely heuristic/prompt-mediated rather than contract-driven, so regressions can reappear when prompt ordering or scenario cues shift.
2. There is no explicit unanswered-question ledger contract, making “answer-vs-probe” compliance hard to guarantee globally.
3. Evaluator penalties do not appear to be hard-wired into retry gating for every critical obligation miss.
4. Current closure gating still mixes multiple heuristics; explicit closure preconditions are not encoded as auditable contract checks.

## 7. Test coverage assessment

Existing tests are valuable but not sufficient for global-fix proof:
- Determinism and bounded-score/state behavior are covered.
- Constraint mention guardrails are covered at unit level.
- Direct-question scoring penalties are covered.

Still missing for platform-level proof:
- Contract tests that fail if a direct question remains unanswered while mode selects probe/redirect.
- Multi-turn obligation lifecycle tests (open -> answered -> closed) across unrelated scenario families.
- Closure-precondition tests validating no early close and guaranteed close when preconditions are met.
- Evaluator-triggered repair/retry tests proving hard enforcement rather than advisory scoring.

## 8. Merge recommendation

**Recommendation: request changes before merge.**

Reason: good partial progress and stronger diagnosis alignment than previous prompt-only changes, but still insufficient as a verified global architecture fix for obligation arbitration + state contract enforcement.

## 9. Required changes before merge

1. Add explicit turn-obligation data model and lifecycle handling in orchestration path (`RolePlayChat.jsx` or extracted controller module).
2. Add deterministic response-mode gate that cannot select probe/close while required direct-answer obligations remain open.
3. Add closure eligibility contract object and enforce preconditions before `terminalPolicyAction === "close"` can finalize session.
4. Wire evaluator critical misses to a mandatory bounded retry/repair pass prior to finalizing a turn.
5. Add cross-scenario regression tests for obligation completion and closure contracts (extend `test/roleplayRuntimePaths.integration.test.mjs` and add dedicated obligation-flow suites).

## 10. Minimal follow-up PR plan

1. Extract objective arbitration + obligation checks from `RolePlayChat.jsx` into a dedicated controller module (e.g., `src/components/roleplay/turnContractController.js`).
2. Introduce state schema additions on `plannerStateSnapshot`:
   - `unansweredDirectQuestions[]`
   - `unresolvedObjections[]`
   - `acceptedOperationalConstraints[]`
   - `closureEligibility`
3. Add pre-generation gate: if `unansweredDirectQuestions.length > 0`, force `responseMode = answer`.
4. Add post-generation validator + single retry for critical contract misses.
5. Add tests:
   - unit tests for controller decision table,
   - integration tests for multi-turn obligation closure,
   - regression matrix fixtures spanning at least 4 scenario families.

## 11. Executive summary

The repository now includes meaningful partial mechanisms (constraint extraction, objective ranking, guardrails, and deterministic smoke checks), but it still lacks an explicit obligation-contract controller that deterministically governs answer/probe/close decisions across scenarios. This is a good diagnosis direction with incomplete implementation; merge should be blocked until obligation lifecycle enforcement and cross-scenario contract tests are added.
