# RPS Architecture Map

Date: April 15, 2026

## Purpose

This document maps how the standalone Role Play Simulator is wired today:

- where scenario structure lives
- how the simulator runtime consumes that structure
- where HCP tone, temperature, and response length are shaped
- where cues are generated
- where rep evaluation is computed
- where predictive and review layers come from

It is meant to be the practical "where does the dial live?" map.

## System Layers

### 1. Scenario Source Of Truth

Primary file:

- `src/lib/scenarioCatalog.js`

This is the built-in scenario registry and the main product SOT for:

- title
- core tension
- description
- stakeholder
- objective
- context
- opening scene
- journey stage
- journey state
- HCP role type
- decision orientation
- persona
- starting behavior state
- interaction pressures
- key challenges
- suggested focus capabilities

This is the highest-leverage place to adjust:

- scenario family coverage
- group distribution
- role mix
- stage mix
- pressure mix
- focus-capability mapping

### 2. Opening Scene Engine

Primary file:

- `src/lib/openingSceneEngine.ts`

This layer deterministically generates the observational opening scene from:

- `journeyStage`
- `startingBehaviorState`
- `decisionOrientation`
- `interactionPressure`

The opening scene formula is fixed:

1. HCP observable action
2. HCP interpersonal signal
3. environmental cue

This layer sets the initial realism envelope.

If opening-scene realism drifts, this is one of the first places to inspect.

### 3. Conversation Initialization

Primary file:

- `src/lib/conversationInit.ts`

This layer establishes:

- rep-first start
- initial behavior state
- initial guidance
- initial runtime assumptions

This is where the simulator ensures the HCP does not speak first and the rep owns the first move.

### 4. HCP Runtime Engine

Primary file:

- `src/lib/hcpResponseGenerator.ts`

This is the main HCP generation engine.

Inputs:

- scenario structure
- transcript history
- current HCP behavior state
- current journey state
- behavior signals
- predictive state
- volatility profile

Outputs:

- HCP reply
- next behavior state
- next journey state
- active cues
- behavior signals
- coaching nudge
- volatility state

This file currently contains the strongest direct control over:

- spoken realism
- context consistency
- directness
- response length
- pressure behavior

### 5. HCP Cue Engine

Primary file:

- `src/lib/hcpCueGenerator.ts`

This layer deterministically resolves observable HCP cues from:

- HCP reply text
- HCP behavior state
- interaction pressures
- scenario context

It maps through:

- `CueCategory`
- `ConcernFamily`
- deterministic cue pools

This is the primary file for cue/dialogue alignment.

If cues feel:

- repetitive
- non-observable
- not state-aligned
- too generic
- too hardcoded

this is the first file to refine.

### 6. Predictive Layer

Primary files:

- `src/lib/hcpStateEngine.ts`
- `src/lib/hcpBehaviorPrediction.ts`

These are related but not identical.

`hcpStateEngine.ts`

- computes openness trajectory
- converts signal history into:
  - `closed | neutral | open`
  - `improving | stalled | declining`
  - risk level
  - next likely behavior

`hcpBehaviorPrediction.ts`

- converts capability/evaluation patterns into predicted HCP behavior tendencies
- maps missed or effective capability behavior into:
  - resistance shifts
  - engagement shifts
  - likely objection persistence
  - predictive drivers

This is where the predictive layer is actually computed.

### 7. Rep Evaluation Engine

Primary file:

- `src/lib/capabilityEvaluation.ts`

This is the deterministic evaluator for the 8 Signal Intelligence capabilities.

It consumes `BehaviorSignals` and produces:

- `effective`
- `developing`
- `missed`

across:

- question_quality
- listening_responsiveness
- making_it_matter
- customer_engagement_signals
- objection_navigation
- conversation_control_structure
- adaptability
- commitment_gaining

This is the main rep-side measurement engine and should remain deterministic.

### 8. Session Review Engine

Primary file:

- `src/lib/sessionReview.ts`

This layer turns:

- transcript
- behavior signals
- state history
- volatility events
- deterministic capability assessments

into the end-of-session review structure.

This is where:

- forensic rationale
- 5-section feedback
- capability-by-capability analysis
- next actions

are assembled.

### 9. QA Twin / Audit Layer

Primary files:

- `src/pages/QATwin.jsx`
- `scripts/qa-matrix.ts`
- `scripts/audit-scenarios.ts`
- `src/lib/qaRepProxy.js`

This is the testing and proxy harness.

It is not the simulator engine, but it is critical because it reveals whether:

- mapping holds under stress
- realism holds across turns
- evaluator quality is believable
- strong vs weak rep behavior separates correctly

## Scenario Mapping Model

Each scenario is effectively mapped through these primary structural dimensions:

1. `journeyStage`
2. `journeyState`
3. `hcpRoleType`
4. `decisionOrientation`
5. `persona`
6. `startingBehaviorState`
7. `interactionPressure[]`
8. `suggestedFocusCapabilities[]`

Those fields then feed different subsystems:

- opening scene
- runtime realism
- cue generation
- predictive layer
- evaluation emphasis
- QA expectations

## Where To Adjust HCP Tone, Temperament, And Length

This is the direct answer to "where do I turn the dial?"

### A. Tone / Spoken Realism

Primary file:

- `src/lib/hcpResponseGenerator.ts`

Current tone control lives in:

- prompt rules under `SPOKEN REALISM GUARDRAILS`
- `needsSpokenStyleRewrite()`
- `rewriteForSpokenStyle()`
- `needsContextConsistencyRewrite()`
- `rewriteForContextConsistency()`

If the HCP is:

- too polished
- too chatbot-like
- too casual
- too socially warm under pressure

this is the main file to calibrate.

### B. Temperament / Resistance / Pressure Posture

Primary files:

- `src/lib/hcpBehaviorPrediction.ts`
- `src/lib/hcpStateEngine.ts`
- `src/lib/scenarioCatalog.js`

Temperament is shaped by:

- persona modifiers
- interaction pressure modifiers
- starting behavior state
- ongoing signal-derived prediction

If you want a specific HCP group to be:

- firmer
- warmer
- harder to move
- easier to open

the current system uses persona + pressure + starting behavior state as the main levers.

### C. Length Of Dialogue

Primary file:

- `src/lib/hcpResponseGenerator.ts`

Current length constraints are enforced in the prompt:

- high pressure: under ~30 spoken words
- lower pressure: under ~45 spoken words
- 1–2 sentences max

If response length needs to be dialed up or down globally, this file is the right place.

### D. Cue Style

Primary file:

- `src/lib/hcpCueGenerator.ts`

If you want cues to be:

- shorter
- more physical
- less literary
- more varied
- more specific to concern family

this is where to refine the pools and normalization rules.

## Current Grouping / Family Structure

The standalone simulator currently groups built-in scenarios into:

1. `initial_access`
2. `early_discovery`
3. `clinical_value`
4. `objection_handling`
5. `adoption_implementation`
6. `access_formulary`
7. `commitment_close`

Current count by family:

- initial_access: 3
- early_discovery: 3
- clinical_value: 3
- objection_handling: 3
- adoption_implementation: 3
- access_formulary: 1
- commitment_close: 3

Important structural note:

- `access_formulary` is underrepresented relative to the others
- this creates some asymmetry in both product coverage and QA pressure testing

## Current Strengths

The standalone architecture is strongest in:

- clear scenario registry
- deterministic opening-scene structure
- explicit worker-backed deployment model
- deterministic rep evaluation
- QA and audit tooling inside the repo
- a cleaner separation of product/runtime/persistence than the legacy paths

## Current Structural Weaknesses

The standalone architecture is still weaker in:

- HCP realism coherence compared with the strongest V2 logic
- cue non-repetition constraints
- stage-to-close compression under pressure
- clearly exposed temperament/tone configuration layer
- explicit family-level control surfaces for "warmth", "directness", and "brevity"

## Practical Recommendations

1. Keep `scenarioCatalog.js` as the canonical scenario SOT.
2. Keep `openingSceneEngine.ts` formula-driven and deterministic.
3. Strengthen `hcpCueGenerator.ts` into a stricter no-repeat, no-leak, state-consistent layer.
4. Split HCP temperament controls into a more explicit config surface rather than burying them only in prompts.
5. Add family-level tone profiles:
   - warmth
   - directness
   - brevity
   - patience threshold
6. Expand `access_formulary` coverage to match the other scenario families.
