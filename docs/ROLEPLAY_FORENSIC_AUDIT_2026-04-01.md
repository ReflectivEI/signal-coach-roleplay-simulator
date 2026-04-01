# ROLE PLAY SIMULATOR AUDIT REPORT

## 0. Executive Summary
The current Role Play Simulator stack is **mostly stable for demo usage** and shows strong intentional alignment to Signal Intelligence source-of-truth constructs in the scoring layer, but it carries **architecture-level realism fragility** in runtime generation because many layered transforms and fallback rewrites can overwrite each other after the initial LLM draft. The biggest risk is not a single bug; it is cumulative instruction-and-postprocessing collision inside `RolePlayChat` where generation, normalization, re-anchoring, anti-repeat, continuity repair, constraint guardrails, and realism transforms all mutate the same one-line output in sequence. This explains why “realism polish” edits often improve one failure mode and regress grammar/flow/behavioral coherence elsewhere.
- Confidence level in stability: **84%**
- Confidence level in source-of-truth alignment: **90%**
- Confidence level in demo readiness: **86%**
- Confidence level in enterprise production readiness: **68%**
- Overall verdict: **Conditionally Stable**

## 1. Audit Scope
- Repo/relevant branches reviewed:
  - Local checked-out repository at `/workspace/reflectiv-AIv4`.
  - Primary runtime paths reviewed for Role Play: UI scenario selection (`RolePlaySimulator`), chat runtime (`RolePlayChat`), simulation/state engines (`hcpSimulationEngine`, `alignmentEngine`), guardrails, scoring aggregation, worker API routes, v2 contracts/scaffold, and roleplay tests.
- Assumptions:
  - Production behavior is represented by current source and worker code.
  - Cloudflare Worker in `src/worker.js` is deployed backend for `/api/llm/invoke` and `/api/roleplay/sessions`.
- Limitations:
  - I cannot confirm external model/provider runtime behavior beyond code intent.
  - I cannot confirm production env var settings, API key setup, or live Cloudflare deployment routing from code alone.
  - I cannot confirm if older legacy roleplay modules are fully unused in deployed UI.
- What was and was not verifiable:
  - **Verified**: source-level runtime flow, contracts, tests, route wiring, scoring anchors, postprocessing chain.
  - **Not fully verifiable**: live latency/retry behavior, real provider model drift, production data persistence guarantees.

## 2. Source-of-Truth Alignment Check
- Canonical Signal Intelligence framework alignment:
  - **Verified**: canonical capability objects and governance are centralized in `signalIntelligenceSOT` and imported by alignment logic and feedback prompt scaffolding.
  - **Verified**: alignment engine explicitly defines 8-capability mapping and “observable behavior only / no intent inference” guardrails.
- Behavioral metric alignment:
  - **Verified**: session scoring aggregation uses capability-level evaluated/triggered evidence checks and averages by capability.
  - **Strong inference**: terminology mostly aligned, but there is naming drift risk between canonical measurement labels and some v2 scaffold labels (e.g., `making_it_matter` appears in v2 canonical scenario scaffold while v1 scoring source uses capability IDs rooted in `signal_*` and `value_connection`).
- Any drift risks:
  - **Medium risk**: v2 scaffold contract introduces alternate enum vocab and metric labels not identical to v1 runtime IDs.
  - **Low risk** (current): v2 is feature-scaffolded and does not replace v1 main runtime.
- Any renamed / duplicated / mismapped concepts:
  - **Verified duplication risk**: multiple evaluative/contract systems coexist (`alignmentEngine`, `turnContractController`, v2 contracts) with partial overlap.

## 3. Full File Map: Everything That Touches Role Play Simulator

| File path | Type | Purpose | Impact | Risk | Notes |
|---|---|---|---|---|---|
| `src/pages/RolePlaySimulator.jsx` | UI page | Scenario library, taxonomy-enriched filtering, scenario launch surface | Direct | Medium | Large static scenario set + filter UX; does not run turn engine itself |
| `src/components/roleplay/EnterpriseScenarioCard.jsx` | UI component | Scenario detail expansion + opening scene typed preview | Direct | Low | Stable display layer |
| `src/components/roleplay/ScenarioCard.jsx` | UI/runtime launcher | Opens `RolePlayChat` portal/session | Direct | Medium | Entry point to simulator conversation runtime |
| `src/components/roleplay/RolePlayChat.jsx` | Core runtime | Turn orchestration, prompt assembly, state transitions, cue generation, guardrails, coaching, feedback generation | Direct | **High** | Single large file with many mutating layers; primary realism regression surface |
| `src/components/roleplay/hcpSimulationEngine.jsx` | Engine | Deterministic state/temperature/severity/cues, token heuristics | Direct | Medium | Strong deterministic logic, but regex-heavy heuristics |
| `src/components/roleplay/hcpDialogueEngine.jsx` | Engine/data | Legacy scenario/personality cue/dialogue recalibration utilities | Indirect | Medium | Appears legacy/demo-oriented; may create confusion vs v1 engine |
| `src/components/roleplay/alignmentEngine.jsx` | Scoring engine | 8-capability behavioral scoring and rubric flags | Direct | Low | Strong SOT-oriented constraints |
| `src/components/roleplay/signalIntelligenceSOT.jsx` | Canonical config | Capability definitions, metrics, governance language | Direct | Low | Primary source-of-truth anchor |
| `src/components/roleplay/sessionScoreAggregation.js` | Utility | Session roll-up from per-turn metrics | Direct | Low | Clean include/exclude logic |
| `src/components/roleplay/operationalConstraintGuardrails.js` | Guardrail utility | Constraint extraction/grounding/violation checks + late-turn response templates | Direct | Medium | Powerful but can over-constrain natural fluency |
| `src/components/roleplay/transformSafetyHarness.js` | Guardrail utility | Accept/reject transformed dialogue based on grammar/intent/question/constraint checks | Direct | Medium | Protective but can force fallback churn |
| `src/lib/messageNormalization.js` | Text normalization | Grammar/punctuation cleanup | Direct | Medium | Can alter lexical content in subtle ways |
| `src/lib/conversationToneNormalization.js` | Text normalization | whitespace/punctuation/casing normalization | Direct | Low | Minimal lexical intervention |
| `src/components/roleplay/behavioralInferenceLayer.js` | Runtime modifier | Optional bias/inference influence on HCP response | Direct | Medium | Additional layer in generation pipeline |
| `src/components/roleplay/constraintLoopPolicy.js` | Runtime policy | Loop-break decisions for repeated constraint blocks | Direct | Medium | May trade realism for deterministic closure |
| `src/components/roleplay/turnContractController.js` | Contract helper | Direct question extraction + response mode selection | Indirect | Medium | Appears currently unused in runtime (dead-path risk) |
| `src/lib/roleplay-v2/backendAdapter.js` | v2 adapter | Feature-flag backend preview for v2 turn plan | Indirect | Low | Preview path only |
| `src/lib/roleplay-v2/turnPlanContract.js` | v2 contract | Immutable turn-plan schema + validation | Indirect | Low | Strong contract discipline |
| `src/lib/roleplay-v2/scenarioTaxonomy.js` | Taxonomy | Heuristic stage/persona/pressure/compliance classification | Direct (catalog) | Medium | Useful grouping but regex heuristic drift risk |
| `src/lib/roleplay-v2/scenarioCanonicalContract.js` | v2 canonical scaffold | Canonical scenario section ordering/enums | Indirect | Medium | Valuable for governance but not v1 runtime authority |
| `src/lib/scenarioNormalization.js` | Builder utility | Normalizes generated scenarios into simulator schema | Indirect | Medium | Can truncate semantic nuance |
| `src/pages/RolePlaySimulatorSafe.jsx` | Safety wrapper | Error boundary around simulator route | Direct | Low | Good crash containment |
| `src/pages/RolePlaySimulatorV2.jsx` | Scaffold page | v2 contract/backend preview playground | Indirect | Low | Explicitly non-invasive to v1 |
| `src/worker.js` | Backend worker | `/api/llm/invoke`, roleplay session save/get, auth/api routing | Direct | Medium | In-memory storage + generic LLM invoke semantics |
| `test/*.mjs` (roleplay files) | Tests | Runtime determinism, constraints, punctuation, contracts, taxonomy | Indirect | Low | Broad coverage; one freeze check currently failing |

## 4. Runtime Flow Breakdown
1. **Scenario selection**
   - User filters and selects scenario in `RolePlaySimulator`; taxonomy is added via `enrichScenarioWithTaxonomy` for filtering facets.
2. **Scene initialization**
   - `ScenarioCard` opens `RolePlayChat`; session seed is initialized and turn scaffolding begins in effect hooks.
3. **HCP cue/signal handling**
   - Base deterministic cue/state profile built from `buildHCPProfile` + state engine.
   - Runtime can replace cues with scenario-aligned contextual cues and no-repeat safeguards.
4. **HCP state engine**
   - Rep message is scored first; then deterministic transition functions compute next state/temperature/severity.
   - Low-value/poor-turn detectors can force escalation/disengagement.
5. **Rep interaction handling**
   - Strict turn alternation guard prevents duplicate rep turns.
   - Alignment computed against locked prior state and visible cue/hcp utterance.
6. **AI prompt assembly + generation**
   - Prompt includes HCP profile + engagement decay directives + scenario/history context.
   - `/api/llm/invoke` called with `roleplay: true` and temperature 0.
7. **Coach tip logic**
   - `shouldTriggerCoaching` runs after scoring to optionally surface in-turn coaching overlay.
8. **Scoring/evaluation**
   - `computeAlignment` outputs 8-capability metrics + rubric flags per turn.
   - Session summary can aggregate latest/evaluated metrics for end feedback.
9. **Final feedback analysis**
   - End-session “Generate Sections 2-5” builds a structured prompt embedding FEEDBACK_SOT and transcript, then calls `/api/llm/invoke`.
10. **Worker/API roundtrips**
   - Worker proxies model call to OpenAI/Groq using system-only message when `roleplay: true`.
   - Session payload optionally persisted via `/api/roleplay/sessions` (in-memory array).
11. **UI rendering**
   - Conversation, cue paneling, coaching overlays, transcript annotations, and hidden live metrics panel update as turns append.

## 5. Stability Audit Findings

### 5A. Confirmed stable / correct
1. **8-capability scoring scaffold is explicit and observable-behavior constrained**
   - Root cause: deliberate SOT + alignment engine guardrails.
   - Impact: strong conceptual integrity.
   - Safe to fix now: N/A.
   - Action: retain as locked canonical layer.

2. **Deterministic design intent is strong in core roleplay path**
   - Hash-based cue selection, deterministic state progression, temperature=0 generation, loop policies.
   - Action: preserve deterministic controls; avoid random sampling changes.

3. **Broad automated test coverage exists for roleplay contracts/constraints/runtime**
   - Many targeted tests pass in current repo.

### 5B. Low-risk issues
1. **In-memory roleplay session persistence in worker**
   - Affected: worker roleplay sessions handler.
   - Root cause: demo-mode storage strategy (`rolePlaySessions` array).
   - Impact: no durable enterprise persistence, restart loss.
   - Safe now: yes.
   - Action: add durable storage adapter behind same response contract.

2. **Legacy/duplicate roleplay modules can confuse maintainers**
   - Affected: `hcpDialogueEngine`, `turnContractController`.
   - Root cause: coexistence of older helpers and newer runtime path.
   - Impact: accidental edits to non-authoritative files.
   - Safe now: yes (documentation + ownership labels).
   - Action: declare authoritative runtime files and mark legacy helpers clearly.

### 5C. Medium-risk issues
1. **Freeze-equivalence verification currently failing one check**
   - Affected: operational-constraint extraction invariants.
   - Root cause: expected invariant mismatch in current code vs freeze reference script.
   - Impact: regression-detection signal already red.
   - Safe now: yes, with tests.
   - Action: reconcile freeze script expectation vs implementation and lock with explicit test fixture.

2. **V1 vs V2 vocabulary divergence**
   - Affected: v2 canonical contract/scaffold naming.
   - Root cause: parallel architecture evolution.
   - Impact: future drift if v2 merges without strict mapping.
   - Safe now: yes with mapping tests.
   - Action: add compatibility map and forbid unmapped metric IDs during promotion.

### 5D. High-risk issues
1. **Primary realism regression risk: multi-layer output mutation chain in `RolePlayChat`**
   - Affected: generation + postprocessing + guardrails + anti-repeat + continuity repair + realism transforms.
   - Root cause: many sequential writers to `nextHcpDialogue` with overlapping objectives.
   - Impact: grammar/punctuation/behavior coherence regressions when tuning any layer.
   - Safe now: **No** (not as broad refactor).
   - Action: isolate a single “authoritative finalization pipeline” with stage-logging and strict precedence rules before making realism edits.

2. **Prompt layering conflict between system prompt intent and downstream deterministic rewrites**
   - Root cause: one-line LLM output frequently overwritten by hardcoded templates/guardrails.
   - Impact: edits to prompt appear ineffective or unstable.
   - Safe now: with testing only.
   - Action: preserve current behavior but instrument per-stage overwrite reasons and acceptance rates first.

## 6. Functionality Breakdown
- Full functional capabilities:
  - Scenario browsing/filtering by disease/specialty/HCP/influence/taxonomy dimensions.
  - Opening-scene preview and runtime chat simulation.
  - Deterministic HCP state, cue, and pressure progression.
  - In-turn coaching overlays tied to misalignment signals.
  - Turn-level capability scoring and end-session synthesized narrative feedback.
- Signal Intelligence integration:
  - Canonical capabilities/definitions injected through SOT object.
  - Feedback prompt includes explicit anti-drift guardrail language.
- Behavioral metric integration:
  - Per-turn alignment metrics + misalignment flags computed in `alignmentEngine`.
  - Session aggregation includes evaluated/triggered gating.
- HCP cues/body language/signals determination and display:
  - Base deterministic cue from profile/state; then scenario-aware cue synthesis + anti-repeat and contradiction checks.
- Opening scene influence:
  - Opening scene text influences first-turn fallback prompt, scenario keyword extraction, taxonomy signals, and concern detection.
- End-session analysis assembly:
  - Transcript + capability summaries + positives/misalignments + SOT block sent to LLM for 4 fixed sections.
- Deterministic vs probabilistic:
  - Mostly deterministic runtime policy and generation settings; non-determinism still possible from external model/provider behavior or fallback branching frequency.
- Explainable vs opaque:
  - Explainable: alignment metrics, state transitions, explicit guardrail conditions.
  - Less explainable: compounded post-generation rewrite interactions and provider model behavior.

## 7. Realism Polish Tuning Problem: Root Cause Analysis
- What exactly is causing regression?
  - **Primary cause (Verified):** multiple interacting post-generation layers mutate the same HCP line (`nextHcpDialogue`) after initial model output, often with conflicting goals (constraint strictness, anti-repeat, continuity, realism calibration, tone normalization, compression, variety enforcement).
  - **Secondary cause (Strong inference):** tuning one stage changes downstream branch activation frequency, producing emergent regressions.
- Root cause class:
  - Prompt-level: yes.
  - Architecture-level: **yes (primary)**.
  - Content-level: yes (scenario/fallback template quality influences output).
  - State-level: yes (late-turn forced modes).
  - Worker-level: moderate (system-only message semantics for roleplay).
  - UI-level: low direct causal role.
- One or multiple causes?
  - **Multiple interacting causes** with architecture-level interaction dominant.
- Evidence supporting diagnosis:
  - Repeated reassignment of `nextHcpDialogue` across LLM output, fallback recovery, reanchor logic, compression/variety, anti-repeat regeneration, continuity repair, constraint violation replacement, and realism transform harness.
  - Existing freeze-equivalence check failure indicates contract stability pressure already present.
- What should NOT be changed?
  - Do **not** alter canonical capability IDs/definitions/scoring intent.
  - Do **not** remove deterministic safeguards wholesale.
  - Do **not** replace alignment rubric with latent sentiment/personality scoring.
- Lowest-risk fix path (if sufficiently certain):
  1. Add stage-by-stage telemetry counters (which stage overwrote output and why).
  2. Freeze precedence order and ensure one “final writer” function.
  3. Introduce AB test harness on existing fixture set before modifying any prompts.

## 8. Scenario Architecture Review
### Current strengths
- Rich scenario corpus across therapeutic areas and stakeholder contexts.
- Existing taxonomy utility already supports stage/persona/pressure/compliance dimensions.
- Opening scenes and constraints are operationally grounded.

### Current gaps
- Scenario family/group/chapter hierarchy is implicit rather than strongly typed.
- Difficulty progression is present but not explicitly chapterized by skill arc.
- Some scenario attributes are heuristic-inferred rather than authoritatively declared.

### Recommended future-state structure
- Preserve current scenario objects but add **non-breaking metadata envelope**:
  - `family` (e.g., HIV_PrEP, Oncology_IO, CV_GDMT)
  - `chapter_stage` (prospecting/discovery/value/objection/adoption/close)
  - `persona_primary` (skeptical specialist / busy prescriber / admin buyer / nurse user)
  - `interaction_skill` (objection, transition interruption, virtual/hybrid, competitive threat, safety concern, formulary/procurement, no-time physician)
  - `difficulty_level` (foundational → intermediate → advanced)
  - `compliance_mode` (on-label/access/safety/virtual constraints)

### Migration path that avoids drift and regression
1. Add metadata via additive schema only (no runtime logic change).
2. Backfill metadata with deterministic scripts + human review.
3. Use metadata only for filtering/order in UI first.
4. Gate any scoring/prompt dependence on metadata behind explicit contract tests.

## 9. Enterprise Readiness Assessment
- Demo readiness verdict: **Conditional Yes**
- Enterprise readiness verdict: **Conditional / Not yet**
- Blockers:
  1. Output mutation chain complexity causing realism regressions.
  2. Non-durable backend session persistence.
  3. Failing freeze-equivalence invariant check.
- Required improvements:
  - Pipeline observability and deterministic finalization contract.
  - Durable session storage + audit trail persistence.
  - Regression gate that asserts grammar/continuity/constraint coherence together.
- Nice-to-have improvements:
  - Legacy module deprecation map.
  - Structured scenario authoring/validation tooling.
- Must validate before production launch:
  - Replay determinism across fixture suite.
  - Prompt/guardrail collision rate under load.
  - End-to-end frontend/backend contract conformance in deployed worker environment.

## 10. Safe Action Plan
### Safe now
1. Add per-stage mutation telemetry in `RolePlayChat` (no behavior change).
2. Document authoritative runtime files vs legacy helpers.
3. Add durable storage abstraction behind `/api/roleplay/sessions` response contract.

### Safe with testing
1. Consolidate message postprocessing into explicit ordered pipeline with single finalizer.
2. Add contract tests ensuring no stage can silently drop question/constraint continuity.
3. Enforce v1/v2 metric-id compatibility map in CI.

### Do not implement yet
1. Large prompt rewrite without mutation telemetry baseline (**HIGH RISK**).
2. Replacing deterministic guardrails with probabilistic style generation (**HIGH RISK**).
3. Renaming or collapsing canonical Signal Intelligence capabilities/metrics (**HIGH RISK / source-of-truth drift**).

## 11. Stable and Accurate Features Summary
- Stable:
  - Canonical 8-capability scoring structure and guardrail intent.
  - Deterministic state transition primitives and many regression tests.
  - Scenario catalog filtering and launch UX.
- Functional:
  - End-to-end roleplay turn loop, cue generation, coaching overlays, end-session feedback generation.
- Accurate alignment:
  - Observable behavior framing and anti-intent-inference stance are explicitly encoded.
- Alignment to AI logic/flow:
  - Worker integration is coherent; roleplay prompts sent as system instructions in roleplay mode.
- Alignment to scoring expectations:
  - Session aggregation and per-turn metrics are consistent with capability framework intent.

## 12. Final Verdict
- Confidence percentages:
  - Stability: **84%**
  - Source-of-truth alignment: **90%**
  - Demo readiness: **86%**
  - Enterprise production readiness: **68%**
- Reasons:
  - High confidence in canonical scoring structure and deterministic foundations.
  - Lower confidence from architecture complexity in dialogue finalization and persistence model.
- Top 3 actions to reach enterprise-grade production confidence:
  1. Instrument and freeze output-mutation pipeline precedence.
  2. Resolve freeze-equivalence failing invariant and strengthen regression gates.
  3. Replace in-memory roleplay persistence with durable auditable storage.
- Explicit realism issue statement:
  - **Yes, the realism issue can be fixed without behavioral regression**, but only if fixes are done as a staged, telemetry-first pipeline hardening effort that preserves canonical scoring constructs and deterministic guardrails while reducing multi-writer collisions.

---

### Certainty Legend Used
- **Verified finding**: directly confirmed in code/tests.
- **Strong inference**: highly likely from architecture/code paths but not directly runtime-observed in production.
- **Hypothesis**: plausible but unconfirmed.
- **Unknown / cannot confirm**: unavailable from code alone.
