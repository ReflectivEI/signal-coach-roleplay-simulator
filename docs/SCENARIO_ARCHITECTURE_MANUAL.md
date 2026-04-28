# Signal Coach Role Play Simulator

## Comprehensive Architecture and Mapping Manual

## 1. Purpose and Scope

This manual explains how the simulator is architected end to end, including:

- How scenario cards are mapped and filtered
- Where Preview Brief content comes from
- How built-in and custom scenarios flow into runtime
- How deterministic scoring and session feedback are produced
- How behavior is extracted from turn-by-turn exchanges
- How Predictive HCP Builder works and differs from scenario cards
- How Build Your Own Scenario feeds the AI workflow
- How realism and deterministic guardrails work together

Primary implementation anchors:

- `src/pages/Home.jsx`
- `src/components/home/ScenarioCard.jsx`
- `src/components/home/ScenarioDetailModal.jsx`
- `src/components/home/ScenarioFilters.jsx`
- `src/lib/scenarioCatalog.js`
- `src/lib/scenarioStorage.js`
- `src/pages/Simulator.jsx`
- `src/lib/hcpResponseGenerator.ts`
- `src/lib/simulatorEngine.ts`
- `src/lib/capabilityEvaluation.ts`
- `src/lib/sessionReview.ts`
- `src/components/simulator/SessionSummaryModal.jsx`
- `src/pages/PredictiveBuilder.jsx`
- `src/lib/predictiveBuilderModel.js`
- `src/pages/ScenarioBuilder.jsx`

## 2. High-Level System Architecture

The platform is composed of four functional planes:

1. Scenario Authoring and Storage Plane

- Built-in scenarios are defined in `src/lib/scenarioCatalog.js`.
- Custom scenarios are created in `src/pages/ScenarioBuilder.jsx` and persisted through `src/lib/scenarioStorage.js` (worker-first, local fallback).

1. Scenario Discovery and Selection Plane

- Scenario grid page in `src/pages/Home.jsx`.
- Six dropdown filters in `src/components/home/ScenarioFilters.jsx`.
- Scenario cards in `src/components/home/ScenarioCard.jsx`.
- Preview Brief modal in `src/components/home/ScenarioDetailModal.jsx`.

1. Runtime Simulation and Realism Plane

- Session orchestration in `src/pages/Simulator.jsx`.
- HCP response generation and realism controls in `src/lib/hcpResponseGenerator.ts` and related realism modules.
- Volatility and interaction-state logic in `src/lib/simulatorEngine.ts`.

1. Evaluation and Feedback Plane

- Deterministic capability signal evaluation in `src/lib/capabilityEvaluation.ts`.
- Structured review generation in `src/lib/sessionReview.ts`.
- Five-section feedback rendering in `src/components/simulator/SessionSummaryModal.jsx`.

## 3. Scenario Card and Grid Architecture

### 3.1 Card Content and Actions

Each scenario card:

- Shows title and computed difficulty badge
- Provides `Preview Brief` action
- Provides `Start Scenario` action
- Omits redundant explanatory body copy per card (now consolidated above the grid)

Current UI behavior is implemented in `src/components/home/ScenarioCard.jsx`.

### 3.2 Single Guidance Placement Above Grid

The single explanatory message above the grid now communicates usage once:

- Open Preview Brief from cards
- Start roleplay from cards
- Predictive Builder remains optional

Implemented in `src/pages/Home.jsx`.

### 3.3 Uniform Card Layout

Card height and spacing were tightened to improve visual consistency in mixed-title grids:

- Reduced card min-height
- Removed per-card explanatory text block
- Preserved stable title and action zones

Implemented in `src/components/home/ScenarioCard.jsx`.

## 4. Six-Dimension Scenario Mapping Model

The scenario grid uses six top filters:

1. diseaseState
2. specialty
3. hcpType
4. influenceDriver
5. journeyStage
6. interactionPressure

### 4.1 Deterministic Mapping for Built-In Scenarios

All built-in scenarios are now explicitly mapped to all six dimensions through `scenario.gridMapping` in `src/lib/scenarioCatalog.js`.

`scenario.gridMapping` contains:

- `diseaseState`
- `specialty`
- `hcpType`
- `influenceDriver`
- `journeyStage`
- `interactionPressure`

This removes ambiguity and prevents text-heuristic drift for built-ins.

### 4.2 Filter Resolution Logic

`applyScenarioFilters` in `src/components/home/ScenarioFilters.jsx` now resolves with precedence:

1. Explicit `scenario.gridMapping` values
2. Predictive seed disease fallback for diseaseState
3. Legacy text heuristics fallback for scenarios without explicit mapping (primarily legacy/custom compatibility)

This ensures deterministic behavior for canonical content while preserving backward compatibility.

### 4.3 Why Dropdowns Remain

The six dropdowns are intentional and still valid because they provide:

- Controlled navigation through canonical scenario dimensions
- Fast segmentation of training cases by clinical and behavioral attributes
- Consistent bridge to Predictive Builder dimensions

## 5. Where Preview Brief Content Comes From

Preview Brief content is derived directly from scenario objects loaded via `scenarioStorage`:

- Built-in source: `src/lib/scenarioCatalog.js`
- Custom source: `src/lib/scenarioStorage.js` (worker/local persisted scenarios)

The modal in `src/components/home/ScenarioDetailModal.jsx` reads scenario fields such as:

- `title`
- `coreTension`
- `objective`
- `context`
- `openingScene`
- `keyChallenges`
- `suggestedFocusCapabilities`

No separate shadow brief store is required for standard scenario brief display.

## 6. How Structure and Mapping Were Designed

The architecture intentionally separates:

- Canonical scenario semantics (scenario object fields)
- Grid discoverability semantics (six-dimension filter mapping)
- Runtime behavior semantics (journey, pressure, persona, volatility)

Design intent:

- Scenario data defines training truth.
- Grid mapping defines discoverability and indexing.
- Runtime engines define dynamic behavior and coaching consequences.

This separation allows UI or indexing changes without changing scoring definitions.

## 7. Runtime Flow: From Scenario Launch to Session End

When a user starts a scenario:

1. `src/pages/Simulator.jsx` loads the scenario by ID from `scenarioStorage`.
2. Opening context and conversation initialization are prepared.
3. Rep message is captured per turn.
4. HCP response is generated by runtime/worker path with realism guardrails.
5. Behavior signals are extracted each rep turn.
6. Volatility profile and prediction are updated.
7. On `End & Get Feedback`, review generation runs and summary modal opens.

## 8. Evaluation and Feedback Architecture

### 8.1 Deterministic Behavior Extraction

The simulator tracks rep-turn behavior signals (question type, response alignment, objection handling posture, engagement/control patterns, commitment attempts).

Signal data structures and volatility mechanics are in `src/lib/simulatorEngine.ts`.

### 8.2 Deterministic Capability Engine

`runCapabilityEvaluationEngine` (in `src/lib/capabilityEvaluation.ts`) maps observed behavior signals to the 8 canonical capability levels:

- effective
- developing
- missed

This deterministic layer is the baseline evaluation truth.

### 8.3 LLM Review with Deterministic Constraints

`generateSessionReview` in `src/lib/sessionReview.ts` generates narrative coaching output, but with strict contract rules:

- Must not contradict deterministic capability pre-assessment
- Must remain transcript-grounded
- Must provide evidence-linked causality
- Must preserve rep-only evaluation framing

### 8.4 Five-Section Feedback Format

Rendered in `src/components/simulator/SessionSummaryModal.jsx`:

1. Brief Rationale
2. Capabilities Done Well
3. Capabilities to Develop
4. Signal-Response Alignment
5. Specific Action Items

The modal also includes per-capability deep analysis rows with structured evidence.

### 8.5 Scoring Model in UI

UI rollup score is derived from level mapping:

- effective = 5
- developing = 3
- missed = 1

Defined in `SessionSummaryModal.jsx` as `LEVEL_TO_SCORE`.

This score is presentation-level and does not replace capability evidence.

## 9. How AI Extracts Behaviors Turn by Turn

Turn-by-turn extraction follows this sequence:

1. Rep utterance captured
2. Runtime classification infers behavior signals
3. Signals are appended to session signal history
4. Volatility computation checks escalation/recovery
5. Prediction engine updates likely next HCP behavior
6. End-session review consumes transcript + signal history + state trajectory

Result: behavior extraction is not a post-hoc single-pass summary; it is accumulated stateful inference across the exchange.

## 10. Predictive HCP Builder: Purpose and Workflow

### 10.1 What It Does

Predictive HCP Builder (`src/pages/PredictiveBuilder.jsx`) creates a profile from six selections:

- diseaseState
- hcpType
- journeyStage
- interactionPressure
- influenceDriver
- behaviorArchetype

It produces:

- Deterministic predictive profile card sections (from `src/lib/predictiveBuilderModel.js`)
- Optional AI specialist synthesis overlay (when worker is online)
- Optional test HCP response simulation

### 10.2 How It Differs from Scenario Cards

Scenario cards:

- represent concrete authored training cases
- include full roleplay scenario context
- are used to launch sessions

Predictive Builder:

- is a profile synthesis workspace
- models likely clinician behavior before/without selecting one canonical scenario
- supports prep and hypothesis testing

In short: cards are case-driven; builder is profile-driven.

### 10.3 How Six Selections Map in Builder

`buildPredictiveProfile(selection)` in `src/lib/predictiveBuilderModel.js` combines:

- Disease intelligence blocks
- HCP type drivers
- Journey-stage priorities/failure modes
- Pressure signal pattern
- Influence lens
- Archetype profile

It returns structured sections used by the UI card.

## 11. Build Your Own Scenario and AI Mapping

### 11.1 Build Your Own Card

The Build Your Own entry card in the grid routes to Scenario Builder (`src/pages/ScenarioBuilder.jsx`).

### 11.2 Scenario Builder Workflow

Scenario Builder supports:

- Manual entry of canonical fields
- AI-assisted canonical formatting (`generateWithAI`)
- Validation of predictive seed completeness
- Save through `createCustomScenario`

### 11.3 Predictive Seed and Correct Mapping

Custom scenarios can include `predictiveSeed` with all six required fields:

- diseaseState
- hcpType
- journeyStage
- interactionPressure
- influenceDriver
- behaviorArchetype

Validation is enforced by `validatePredictiveSeed` in `ScenarioBuilder.jsx`.

This enables downstream AI/runtime services to map custom scenarios consistently.

### 11.4 Runtime Consumption of Seed

At session init, `Simulator.jsx` resolves a seed (`buildPredictiveSeedFromScenario`) and uses runtime predictive services:

- `buildPredictivePromptContext`
- `buildPredictiveRuntimeLens`

This informs HCP generation context and keeps custom scenarios aligned with the same predictive architecture.

## 12. Deterministic Layer vs Realism Layer

### 12.1 Deterministic Layer Responsibilities

- Capability-level behavioral evaluation
- Volatility/event classification
- State trajectory computation
- Filter mappings for canonical scenario discoverability

### 12.2 Realism Layer Responsibilities

- Human-like HCP phrasing and cadence
- Pressure-sensitive response shaping
- Context retention and anti-generic behavior
- First-turn quality and non-triviality guardrails

### 12.3 Why This Split Matters

The split prevents realism polish from mutating scoring truth.

- Realism can improve voice quality and plausibility.
- Deterministic scoring remains anchored to observable rep behavior.

This is directly aligned with SOT constraints in `docs/CURRENT_CANONICAL_SOT_STANDALONE.md`.

## 13. References and Source-of-Truth Alignment

Primary SOT references:

- `docs/CURRENT_CANONICAL_SOT_STANDALONE.md`
- `docs/SIMULATOR_ARCHITECTURE.md`
- `docs/RPS_ARCHITECTURE_MAP.md`

Key alignment rules enforced by code and audits:

- Rep-only evaluation model
- Canonical capability model retained
- Five-section feedback format present
- Built-in scenarios mapped deterministically to six grid dimensions

## 14. Audit and Verification Artifacts

### 14.1 Scenario Schema Audit

Command:

- `npm run audit:scenarios`

Validates:

- Scenario field validity
- Journey/family distribution
- Canonical field set compliance

### 14.2 Architecture Alignment Audit

Command:

- `npm run audit:architecture`

Validates:

- Six-dimension grid mapping exists for every built-in scenario
- Concern family and capability profile coverage
- Five-section feedback labels exist in UI
- Session review contract sections exist
- Rep-only scoring rule exists in SOT

### 14.3 Confidence Gate

Command:

- `npm run confidence:gate`

Validates core realism/consistency gates for runtime response behavior.

## 15. Practical Usage Guidance

### 15.1 Scenario Grid Usage

1. Use six filters to narrow by training context.
2. Open Preview Brief to read scenario tension, objective, and context.
3. Start scenario and run roleplay.
4. End session and review five-section feedback.

### 15.2 Predictive Builder Usage

1. Select all six profile dimensions.
2. Review deterministic profile card (and AI synthesis when available).
3. Use test-response panel to probe likely HCP reactions.
4. Translate learnings into roleplay opening strategy.

### 15.3 Build Your Own Usage

1. Create scenario manually or use AI formatter.
2. Fill realism variables and key challenges.
3. Provide full predictive seed for strongest mapping alignment.
4. Save and run through standard simulator pipeline.

## 16. Current State Summary

Current architecture now provides:

- Cleaner, non-redundant scenario card UI
- Deterministic six-dimension built-in scenario mapping
- Verified five-section feedback pipeline
- Deterministic + AI-constrained review model
- Predictive Builder and custom scenario workflows that feed runtime mapping coherently

This state supports consistent training UX, robust filtering, and SOT-aligned evaluation behavior.
