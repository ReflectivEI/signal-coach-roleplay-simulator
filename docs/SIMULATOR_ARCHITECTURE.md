# Simulator Architecture

Date: April 15, 2026

## Product Purpose

This standalone product is a role-play simulator for pharma sales coaching.

It is built around one core principle:

- The HCP simulation must feel realistic, layered, and context-aware.
- The rep is the only party being evaluated.
- Rep evaluation is grounded in the 8 Signal Intelligence capabilities and their associated behavioral metrics.

## Runtime Architecture

### Frontend

The frontend is a Vite/React SPA.

Primary runtime pages:

- `src/pages/Home.jsx`
  - Main scenario grid
  - 6 dropdown filter system
  - Launch point into the simulator
- `src/pages/Simulator.jsx`
  - Live role-play experience
  - Transcript lane
  - Right-side predictive panel
  - Turn-by-turn coaching
  - End-of-session review
- `src/pages/ScenarioBuilder.jsx`
  - Custom scenario generation and authoring
- `src/pages/QATwin.jsx`
  - Automated human-proxy testing harness
- `src/pages/AdminDashboard.jsx`
  - Custom scenario visibility and lifecycle controls
- `src/pages/ScenarioLibrary.jsx`
  - Published scenario browsing surface
- `src/pages/Capabilities.jsx`
  - Reference explanation of the 8 capabilities

### Backend

The backend is a dedicated Cloudflare Worker:

- `worker/src/index.js`

Current worker responsibilities:

- health reporting
- LLM invocation
- custom scenario persistence
- completed session persistence
- session retrieval and update/delete lifecycle support

### Frontend/Backend Contract Layer

The browser only talks to the worker through:

- `src/services/workerClient.js`

Current endpoints:

- `GET /health`
- `POST /api/llm/invoke`
- `GET/POST/PUT/DELETE /api/scenarios`
- `GET/POST/PUT/DELETE /api/roleplay/sessions`

## Source of Truth Layers

### Behavioral SOT

The simulator behavior is grounded in:

- `ROLEPLAY_BEHAVIORAL_SOT.md`
- `src/lib/scenarioCatalog.js`
- `src/lib/signalIntelligence.ts`

### Built-In Scenario SOT

Built-in scenarios live in:

- `src/lib/scenarioCatalog.js`

This is the canonical built-in scenario registry for the standalone simulator.

### Persistence SOT

Persistence flows through:

- `src/lib/scenarioStorage.js`

Behavior:

- built-ins are app-owned
- custom scenarios are worker-backed with local fallback
- completed sessions are worker-backed
- worker persistence now normalizes session shape, limits transcript and signal payload size, and prevents malformed session blobs from becoming stored state

## Scenario Families

The 19 canonical built-in scenarios are grouped by journey family because each family tests a different rep capability mix and a different HCP interaction shape.

Families:

1. Initial Access
   - Tests first-contact framing, relevance earning, time-pressure handling
2. Discovery
   - Tests whether the rep can uncover what actually matters instead of pitching
3. Clinical Value
   - Tests translation of data into HCP-relevant value
4. Objection Handling
   - Tests resistance navigation without defensiveness
5. Adoption & Implementation
   - Tests movement from interest to practical readiness
6. Access & Formulary
   - Tests value and navigation under access/system constraints
7. Commitment & Close
   - Tests whether the rep can convert progress into a real next step

This grouping matters because the QA system should validate patterns at the family level, not only scenario-by-scenario.

## The 6 Scenario Grid Dropdowns

The grid uses 6 filters on the main simulator page through:

- `src/components/home/ScenarioFilters.jsx`

They are not decorative. They are the front-end expression of the simulator taxonomy.

1. `diseaseState`
   - Helps reps find scenarios by clinical domain language and disease context.
2. `specialty`
   - Separates specialist, primary care, hospital, and academic/KOL contexts.
3. `hcpType`
   - Distinguishes treating clinician vs influencer vs thought leader.
4. `influenceDriver`
   - Encodes the HCP’s decision orientation:
     patient-centric, evidence-driven, risk-averse, guideline-anchored.
5. `journeyStage`
   - Maps directly to the scenario family and commercial conversation stage.
6. `interactionPressure`
   - Represents constraints that shape realism and HCP resistance:
     time, workflow, skepticism, access, safety, competitive bias, uncertainty.

These six dimensions matter because the predictive layer and the scenario architecture rely on them as the main structural inputs to realism.

## Core Simulation Flow

### 1. Scenario Load

`src/pages/Simulator.jsx` loads a scenario from `scenarioStorage`, then ensures an opening scene exists using:

- `src/lib/openingSceneEngine.ts`

### 2. Conversation Initialization

`src/lib/conversationInit.ts` establishes:

- rep-first opening sequence
- initial behavior state
- opening guidance for the rep
- initial volatility profile

### 3. Rep Turn

The rep provides the human input.

Optional turn-level coaching is generated through:

- `generateRealtimeFeedback()` in `src/services/workerClient.js`

### 4. HCP Response Generation

`src/lib/hcpResponseGenerator.ts` is the main runtime engine.

It combines:

- scenario definition
- transcript history
- current HCP state
- deterministic capability rules
- predictive HCP behavior layer
- volatility layer

Outputs:

- HCP reply
- next behavior state
- next journey state
- behavior signals
- coaching nudge
- volatility state

### 5. Cue Layer

Observable HCP cues are generated through:

- `src/lib/hcpCueGenerator.ts`

This layer is meant to ensure that what the rep sees matches the HCP’s state and spoken behavior.

### 6. Predictive Right Rail

The right rail is driven by:

- `src/lib/hcpStateEngine.ts`
- `src/lib/hcpBehaviorPrediction.ts`
- `src/components/simulator/SimulatorRightPanel.jsx`

This layer predicts:

- likely HCP openness trajectory
- risk level
- next likely behavior
- capability-driven behavior drivers

### 7. End-of-Session Review

The final review is generated through:

- `src/lib/sessionReview.ts`

It is designed to produce:

- brief rationale
- what the rep did well
- biggest cross-capability gap
- next adjustment
- full 8-capability analysis
- signal-response alignment
- volatility review
- action-oriented guidance

## QA And Audit Workflow

The standalone repo now has repeatable audit entry points:

- `npm run audit:scenarios`
  - validates built-in scenario taxonomy and family counts
- `npx vite-node scripts/qa-matrix.ts weak_rep 2 "The Gatekeeper Filter"`
  - runs a targeted worker-backed QA Twin proxy session for one scenario

The QA matrix exists to validate global behavior patterns, not scenario-specific hacks. It should be used to confirm:

- cue/dialogue alignment
- HCP pressure continuity
- capability coverage
- review coverage
- volatility behavior

## Signal Intelligence Evaluation Model

The rep is evaluated through 8 canonical capabilities defined in:

- `src/lib/signalIntelligence.ts`

The deterministic evaluation engine lives in:

- `src/lib/capabilityEvaluation.ts`

Capability list:

1. Question Quality
2. Listening & Responsiveness
3. Customer Engagement Cues
4. Value Framing
5. Objection Handling
6. Conversation Control & Structure
7. Adaptability
8. Commitment Gaining

The HCP is not scored. The HCP is the simulation environment.

## Mapping Model

Every built-in scenario maps these core fields:

- `journeyStage`
- `journeyState`
- `hcpRoleType`
- `decisionOrientation`
- `persona`
- `startingBehaviorState`
- `interactionPressure`
- `keyChallenges`
- `suggestedFocusCapabilities`

This mapping is important because:

- `journeyStage` shapes the family and expected rep objective
- `journeyState` shapes conversation phase
- `persona` shapes tone and resistance style
- `decisionOrientation` shapes what matters to the HCP
- `startingBehaviorState` shapes the initial openness posture
- `interactionPressure` shapes realism constraints and volatility sensitivity
- `suggestedFocusCapabilities` identify the most relevant rep behaviors for that scenario

## Current Hardening Priorities

The next global hardening pass should focus on:

1. cue/dialogue alignment
2. long-session drift and loop resistance
3. deterministic and consistent capability evaluation
4. QA Twin parity with full session review contract
5. builder-to-simulator schema validation
6. stronger worker-backed persistence and contract discipline
