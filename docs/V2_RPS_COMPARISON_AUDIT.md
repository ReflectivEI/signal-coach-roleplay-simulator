# V2 vs Standalone RPS Audit

Date: April 15, 2026

## Scope

This audit compares:

- legacy V2 RPS runtime in `reflectiv-rps`
- current standalone RPS in `signal-coach-core`

The comparison is focused on:

- mapping integrity
- dialogue quality
- realism
- cue/dialogue alignment
- evaluation quality
- scenario coverage
- architecture
- stability and operational readiness

## Files Reviewed

### Legacy V2

- `src/lib/roleplay/hcpCueStateAlignment.js`
- `src/lib/roleplay/conversationalRealismEngine.js`
- `src/lib/roleplay/dialogueGrammar.js`
- `src/lib/roleplay/conversationIntelligence.js`
- `src/lib/roleplay/roleplayTurnValidation.js`
- `src/lib/roleplay-runtime-v2/alignmentEngine.js`
- `src/lib/roleplay-runtime-v2/runtimeStateMachine.js`
- `src/lib/roleplay-runtime-v2/responseSurface.js`
- `src/lib/roleplay-runtime-v2/feedbackScoring.js`
- `src/pages/RolePlaySimulatorV2.jsx`
- `src/pages/RolePlaySession.jsx`

### Standalone

- `src/lib/scenarioCatalog.js`
- `src/lib/openingSceneEngine.ts`
- `src/lib/hcpCueGenerator.ts`
- `src/lib/hcpResponseGenerator.ts`
- `src/lib/hcpBehaviorPrediction.ts`
- `src/lib/hcpStateEngine.ts`
- `src/lib/capabilityEvaluation.ts`
- `src/lib/sessionReview.ts`
- `src/pages/Simulator.jsx`
- `src/pages/QATwin.jsx`
- `scripts/qa-matrix.ts`
- `scripts/audit-scenarios.ts`

## Executive Summary

Short version:

- **V2 is stronger in runtime realism discipline and stateful cue/dialogue alignment logic.**
- **Standalone is stronger in deployment architecture, maintainability, auditability, and product isolation.**
- **V2 feels more behaviorally opinionated.**
- **Standalone is more operationally viable and easier to harden into a production subsystem.**

Final verdict:

- If the question is "which version is easier to grow safely into an enterprise product?" the answer is **standalone**.
- If the question is "which version currently contains the more mature realism and alignment logic?" the answer is **V2**.
- The best path is **not** to revert to V2, but to **port the strongest V2 runtime ideas into the standalone architecture**.

## Category-by-Category Comparison

### 1. Mapping Integrity

#### V2

Pros:

- More explicit runtime-stage semantics.
- Concern-family mapping is deeply embedded across:
  - cue alignment
  - response surface
  - phase progression
  - coaching logic
- Better stage-aware narrowing behavior.
- Stronger distinction between:
  - evidence
  - workflow
  - access
  - screening

Cons:

- Mapping is spread across many files and custom heuristics.
- Architecture is harder to trace end-to-end.
- There is more hidden coupling between validation, realism, alignment, and response shaping.
- Harder to expose safely as a maintainable product subsystem.

#### Standalone

Pros:

- Cleaner scenario schema.
- Clearer source-of-truth scenario registry.
- Cleaner family structure.
- Easier to audit and reason about.
- Better separation between:
  - scenario catalog
  - opening scene
  - runtime generation
  - evaluation
  - review
  - worker contract

Cons:

- Mapping is cleaner, but less behaviorally mature.
- Some family-level realism shaping still lives too much in prompt instructions instead of explicit runtime configuration.
- The access/formulary family is too thin with only one built-in scenario.

Verdict:

- **V2 wins on runtime mapping richness.**
- **Standalone wins on structural clarity.**

### 2. Dialogue Quality

#### V2

Pros:

- Stronger grammar and sentence-integrity safeguards.
- Better spoken-shape handling in the runtime pipeline.
- More explicit anti-note and anti-fragment logic.
- Better specialty/journey/persona text shaping in `responseSurface.js`.

Cons:

- Some V2 language surfaces are still visibly system-authored.
- Some cue language in V2 is too interpretive or internally narrated.
- Some V2 output can feel over-engineered rather than naturally spoken.

#### Standalone

Pros:

- Stronger direct use of modern prompt guardrails for spoken realism.
- Better recent hardening against chatbot phrases.
- Better current pressure to keep HCP lines short and context-aware.

Cons:

- Still more dependent on prompt quality than V2.
- Still too vulnerable to drift if guardrails are not reinforced.
- Spoken realism is improving, but is not yet as systematically shaped as V2's response-surface stack.

Verdict:

- **V2 wins today on dialogue-shaping discipline.**
- **Standalone has the cleaner base to surpass it once the shaping logic is ported properly.**

### 3. Realism

#### V2

Pros:

- More explicit realism state machine.
- Better pressure-state transitions.
- Better use of operational, evidence, and workflow narrowing.
- Better sense of "this HCP has a behavioral lane and stays in it."

Cons:

- Can still feel mechanically constrained if over-applied.
- Some realism layers are hard to tune because they are distributed across many runtime files.

#### Standalone

Pros:

- Better opening-scene SOT alignment.
- Cleaner rep-first flow.
- Cleaner scenario-family taxonomy.
- Strong recent improvements in high-pressure realism.

Cons:

- Still behind V2 in full behavioral coherence.
- Still needs stronger cause-and-effect compression.
- Still needs more explicit family-level temperament controls.

Verdict:

- **V2 is currently stronger on realism discipline.**

### 4. HCP Cue / Dialogue Alignment

#### V2

Pros:

- `hcpCueStateAlignment.js` is more mature than the original standalone cue path.
- Concern-family + cue-category alignment is stronger.
- Better terminal / escalation / narrowing states.

Cons:

- Many V2 cue lines are not ideal final cue text for the current product because some are more interpretive than observable.
- V2 cue logic is stronger than V2 cue wording.

#### Standalone

Pros:

- The cue engine has already been upgraded toward the stronger V2 approach.
- Current cue pools are more observable and more product-ready stylistically.

Cons:

- Still missing stricter non-repetition memory.
- Still needs tighter deterministic rotation and stronger recent-cue avoidance.
- Still needs harder punctuation/format normalization enforcement.

Verdict:

- **V2 wins on logic maturity.**
- **Standalone is closer to the desired final cue style, but not yet fully hardened.**

### 5. Evaluation Quality

#### V2

Pros:

- Stronger alignment scoring and turn-validation ideas.
- Better granularity around progression, partial progress, and adaptation failure.

Cons:

- V2 capability naming is different from the current 8-capability standalone contract.
- V2 evaluation logic is less cleanly isolated for the current product.

#### Standalone

Pros:

- Cleaner deterministic 8-capability evaluator.
- Cleaner final-review contract.
- Better product alignment with Signal Intelligence capability naming.
- Cleaner integration with the review modal and QA tooling.

Cons:

- Deterministic evaluator still needs more nuance in some edge cases.
- Some strong/weak split logic still depends on QA proxy quality.

Verdict:

- **Standalone wins on product-ready evaluation architecture.**
- **V2 wins on some nuanced alignment heuristics worth borrowing.**

### 6. Scenario Variety / Coverage

#### V2

Pros:

- Scenario taxonomy appears richer in some runtime-aware ways.
- Better explicit use of taxonomy inside the runtime path.

Cons:

- Harder to trace and maintain.
- Less cleanly surfaced as a product registry.

#### Standalone

Pros:

- Cleaner built-in catalog.
- Cleaner family grouping.
- Better visible product taxonomy.

Cons:

- Family distribution imbalance:
  - `access_formulary` has only 1 built-in scenario
- User guidance indicates the visible-card count may still need reconciliation.

Verdict:

- **Standalone wins on catalog clarity.**
- **V2 wins on runtime taxonomy exploitation.**

### 7. Stability / Operational Readiness

#### V2

Pros:

- Stronger internal behavior stack in some places.

Cons:

- Higher complexity.
- Higher coupling.
- Harder to deploy and isolate safely.
- Higher contamination risk with adjacent platform logic.

#### Standalone

Pros:

- Dedicated Cloudflare Worker
- dedicated Pages deployment
- dedicated repo
- cleaner worker/client boundary
- built-in QA scripts
- audit script
- product isolation from enterprise-site instability

Cons:

- Still mid-hardening on realism and cue constraints.

Verdict:

- **Standalone wins clearly on operational stability and long-term maintainability.**

## Final Comparative Scorecard

| Category | Stronger Version | Why |
|---|---|---|
| Mapping richness | V2 | Deeper runtime-stage and concern-family logic |
| Structural clarity | Standalone | Cleaner SOT and product architecture |
| Dialogue shaping | V2 | More explicit grammar / spoken-shape enforcement |
| Realism discipline | V2 | Stronger behavioral state handling |
| Cue logic maturity | V2 | Better state-aware cue alignment logic |
| Cue wording style | Standalone | More observable and product-ready phrasing |
| Evaluation architecture | Standalone | Cleaner deterministic 8-capability model |
| Deployment / stability | Standalone | Cleaner repo + worker + Pages isolation |
| QA / audit tooling | Standalone | Better built-in scripts and product-facing audit structure |

## Which Version Is Stronger Overall?

### If "stronger" means:

`more behaviorally mature at the simulation core`

Then:

- **V2 is stronger today**

because its realism stack, cue-alignment logic, and runtime shaping are more developed.

### If "stronger" means:

`more robust, maintainable, stable, and ready to grow safely`

Then:

- **Standalone is stronger today**

because its architecture is far cleaner and much less dangerous to evolve.

## Final Recommendation

Do not go backward to V2 as the product runtime.

Instead:

- keep the standalone repo, worker, and deployment model
- selectively port the best V2 logic into the standalone runtime

That is the highest-leverage path.

## Findings That Should Be Refined In Standalone

1. Add stricter cue memory and non-repetition.
2. Create explicit family-level tone profiles instead of burying everything in prompts.
3. Port more V2-style phase progression and concern-family response shaping.
4. Strengthen close-stage compression and smallest-next-step logic.
5. Expand `access_formulary` family coverage.
6. Make persona / pressure modifiers more explicit and configurable.
7. Reduce reliance on prompt-only realism shaping where deterministic control is better.

## 4–8 Week Implementation Plan

### Weeks 1–2: Runtime Integrity

Goals:

- lock cue integrity
- tighten realism determinism
- expose clearer configuration levers

Work:

1. Harden cue system
   - no immediate repetition
   - recent-cue memory
   - punctuation/capitalization normalization
   - stronger concern-family + cue-category routing

2. Add family-level HCP tone profiles
   - warmth
   - directness
   - brevity
   - patience threshold

3. Port key V2 runtime ideas into standalone
   - phase progression
   - concern-family narrowing
   - adaptive impatience / repeated-miss logic

### Weeks 3–4: Realism and Causality

Goals:

- make HCP feel more human
- improve cause-and-effect

Work:

1. Strengthen HCP response shaping by:
   - family
   - journey stage
   - persona
   - pressure combination

2. Create deterministic "cause-and-effect guardrails"
   - repeated misses produce tighter or harder HCP moves
   - good adaptation produces warmer or more specific HCP openings

3. Expand QA matrix
   - family-based regression runs
   - 4–6 turn comparison scenarios

### Weeks 5–6: Evaluation and Review Quality

Goals:

- tighten evaluator fidelity
- improve debrief trust

Work:

1. Port select V2 alignment heuristics into standalone evaluation
2. Refine weak/developing/effective separation
3. Improve end-of-session handling for sparse or short runs
4. Add explicit "Not Observed (N/O)" handling consistently across all review sections

### Weeks 7–8: Content and Product Completion

Goals:

- balance coverage
- raise enterprise readiness

Work:

1. Expand `access_formulary` scenario family
2. Reconcile visible-card count expectation
3. Create documented temperament controls for future tuning
4. Run broader QA Twin sweeps across every family
5. Freeze the standalone RPS contract for enterprise integration

## Suggested Structural Adjustments

### Scenario Groups

Recommended:

- keep current family structure
- expand `access_formulary`
- consider splitting `commitment_close` into:
  - close-readiness
  - next-step ownership
  only if future coverage justifies it

### Tone / Temperature Adjustments

Recommended:

- do not let `time_constrained` imply `rude`
- separate:
  - pressure
  - skepticism
  - hostility
- make warmth a distinct dimension from openness

### Architecture Adjustments

Recommended:

1. Keep standalone frontend + worker split.
2. Add explicit runtime config for:
   - family tone
   - cue variability
   - brevity budget
   - escalation threshold
3. Keep the evaluation engine deterministic.
4. Continue using QA Twin as the main regression harness.

## Bottom Line

The strongest path is:

- **standalone architecture**
- **V2-informed runtime intelligence**

That combination is the best route to an enterprise-grade RPS that is:

- behaviorally credible
- operationally stable
- maintainable
- extensible
- safe to integrate back into the larger platform later

