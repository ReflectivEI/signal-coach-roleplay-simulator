# Base44 Behavioral SOT Recovery

This document treats the Base44 app as the behavioral source of truth for the Role Play Simulator.

It does **not** treat the Base44 codebase as the target runtime architecture.

The rebuild rule is:

- Base44 defines what the simulator is.
- The worker contract defines how the rebuilt app runs.

## Non-Negotiable Principle

The Base44 app was the first version in months where the role play behaved correctly. That means the rebuild must preserve its:

- scenario architecture
- mapping logic
- HCP profile structure
- taxonomy and grouping model
- simulator flow
- state relationships
- coaching/review outputs

What must **not** be preserved:

- Base44 SDK usage
- Base44 auth/bootstrap
- Base44 entity persistence assumptions
- Base44 function invocation contract
- Base44 endpoint and payload assumptions

## Canonical SOT Files

These are the primary behavioral SOT files in the current Base44 snapshot:

- [src/pages/Home.jsx](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/pages/Home.jsx:1>)
  Defines the canonical scenario grid and the built-in simulator taxonomy.
- [src/pages/Simulator.jsx](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/pages/Simulator.jsx:1>)
  Defines the simulator session flow, state transitions, transcript handling, cue generation, feedback wiring, and end-session review flow.
- [src/pages/QATwin.jsx](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/pages/QATwin.jsx:1>)
  Defines the automated QA simulator expectations and assertions.
- [src/lib/conversationInit.ts](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/lib/conversationInit.ts:1>)
  Defines how conversation openings are framed and how rep-first vs HCP-first behavior is modeled.
- [src/lib/hcpResponseGenerator.ts](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/lib/hcpResponseGenerator.ts:1>)
  Defines the HCP-response behavioral prompt contract and signal payload expectation.
- [src/lib/sessionReview.ts](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/lib/sessionReview.ts:1>)
  Defines the post-session debrief shape and coaching output contract.
- [src/lib/hcpStateEngine.ts](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/lib/hcpStateEngine.ts:1>)
  Defines deterministic HCP openness/trajectory/risk prediction.
- [src/lib/simulatorEngine.ts](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/lib/simulatorEngine.ts:1>)
  Defines volatility logic, signal interpretation scaffolding, and session-review interfaces.
- [src/components/simulator/OpeningSceneBanner.jsx](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/components/simulator/OpeningSceneBanner.jsx:1>)
  Defines the opening-scene UX distinction between scene context and HCP dialogue.
- [src/components/simulator/MessageList.jsx](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/components/simulator/MessageList.jsx:1>)
  Defines transcript rendering, cue strips, and rep coaching-nudge placement.
- [src/components/simulator/SimulatorRightPanel.jsx](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/components/simulator/SimulatorRightPanel.jsx:1>)
  Defines the HCP-state / prediction / volatility / active-signals right rail.
- [src/components/simulator/SessionSummaryModal.jsx](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/components/simulator/SessionSummaryModal.jsx:1>)
  Defines the review/debrief presentation contract.

## Canonical Product Structure

The Base44 SOT app has these top-level pages in [src/App.jsx](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/App.jsx:1>):

- `/` -> Home / scenario grid
- `/simulator` -> standalone role-play simulator
- `/builder` -> scenario builder
- `/capabilities` -> 8 capability definitions
- `/qa` -> QA Twin
- `/admin` -> scenario management
- `/library` -> published scenario library

For the rebuild, the minimum critical path is:

1. Home / scenario grid
2. Simulator
3. Session review
4. QA Twin

Builder, Admin, and Library are secondary after the core simulator loop is stable.

## Canonical Scenario System

The current SOT in [src/pages/Home.jsx](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/pages/Home.jsx:1>) defines **19 canonical built-in scenarios**.

Each scenario carries these key fields:

- `title`
- `coreTension`
- `description`
- `stakeholder`
- `objective`
- `context`
- `openingScene`
- `visualScene`
- `journeyStage`
- `journeyState`
- `hcpRoleType`
- `decisionOrientation`
- `persona`
- `startingBehaviorState`
- `interactionPressure`
- `keyChallenges`
- `suggestedFocusCapabilities`
- `isBuiltIn`

### Canonical Journey Stages

- `initial_access`
- `discovery`
- `clinical_value`
- `objection_handling`
- `adoption_implementation`
- `access_formulary`
- `commitment_close`

### Canonical Journey States

- `early_discovery`
- `clinical_evaluation`
- `objection_phase`
- `access_formulary`
- `adoption_commitment`

### Canonical HCP Role Types

- `treating_clinician`
- `influencer`
- `thought_leader`

### Canonical Decision Orientations

- `patient_centric`
- `evidence_driven`
- `risk_averse`
- `guideline_anchored`

### Canonical Personas

- `time_constrained_community_doctor`
- `skeptical_specialist`
- `curious_uncertain_adopter`
- `cost_focused_decision_maker`

### Canonical Interaction Pressures

- `time_constrained`
- `operationally_constrained`
- `skeptical_resistant`
- `competitive_bias`
- `safety_concern`
- `access_barrier`
- `curious_uncertain`

## Canonical Scenario Inventory

Verified from the SOT file:

1. The Gatekeeper Filter
2. The Warm Intro That Turns Cold
3. The No-Show Follow-Up
4. The Undefined Patient Profile
5. The Assumed Priority
6. The Protocol Lock
7. The Data That Doesn't Land
8. The Guideline Anchor
9. The Cost-Effectiveness Filter
10. The Prior Auth Reflex
11. The Unexpected Safety Flag
12. The Competitive Defender
13. The Reluctant Early Adopter
14. The Workflow Bottleneck
15. The Reversal After First Patient
16. The Formulary Firewall
17. The Perpetual Maybe
18. The Handoff Risk
19. The Split Decision

## Behavioral Mapping That Must Be Preserved

These relationships are part of the SOT and cannot be casually changed during the rebuild.

### 1. Scenario -> persona -> starting behavior -> pressure bundle

Each scenario is not just content. It is a behavioral configuration.

Example dimensions encoded together:

- `persona`
- `startingBehaviorState`
- `interactionPressure`
- `decisionOrientation`
- `journeyStage`
- `journeyState`

If these are remapped loosely, the role play will stop behaving like the Base44 version.

### 2. Opening scene vs HCP dialogue are separate concepts

Per [src/components/simulator/OpeningSceneBanner.jsx](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/components/simulator/OpeningSceneBanner.jsx:1>):

- `visualScene` is environmental context for the rep
- `openingScene` is scenario-authored HCP spoken setup
- transcript dialogue is separate and must not be conflated with scene context

This separation is important. Earlier broken versions likely collapsed these into one thing.

### 3. Rep-first behavior matters

In [src/lib/conversationInit.ts](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/lib/conversationInit.ts:1>), the current logic forces `rep_initiated` as the default start type.

That means the rebuilt simulator must deliberately choose whether:

- HCP opens first
- rep opens first

and not accidentally let this drift through backend assumptions.

### 4. HCP output is more than text

Per [src/lib/hcpResponseGenerator.ts](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/lib/hcpResponseGenerator.ts:1>), each turn is expected to produce:

- `hcpReply`
- `nextBehaviorState`
- `nextJourneyState`
- `behaviorSignals`
- optional `coachingNudge`
- `activeCues`
- `volatilityState`

Even if the new worker contract differs, the rebuilt frontend must still recover this behavioral surface somehow.

### 5. Right-rail state is part of the simulator, not decoration

Per [src/components/simulator/SimulatorRightPanel.jsx](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/components/simulator/SimulatorRightPanel.jsx:1>), the simulator is expected to surface:

- current journey state
- current behavior state
- active interaction pressures
- openness prediction
- trajectory
- risk level
- volatility profile
- curveball state
- active signals/cues

This is part of the operating model, not optional polish.

### 6. Review output is deeply structured

Per [src/lib/sessionReview.ts](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/lib/sessionReview.ts:1>) and [src/components/simulator/SessionSummaryModal.jsx](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/components/simulator/SessionSummaryModal.jsx:1>), the end-state review is not just a score or summary.

The review model includes:

- `briefRationale`
- `didWell`
- `biggestGap`
- `nextAdjustment`
- `capabilityInsights[]`
- `volatilityEvents[]`
- `signalResponseAlignment[]`
- `overallSummary[]`
- `strengthsProse[]`
- `developProse[]`
- `actionPlanProse[]`
- `strengths[]`
- `improvementAreas[]`
- `missedOpportunities[]`
- `suggestedReframes[]`
- `overallGuidance[]`

If the rebuilt app cannot produce this exact depth at first, the intermediate adapter must explicitly define what is temporarily stubbed vs preserved.

## Canonical Simulator Flow

Derived from [src/pages/Simulator.jsx](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/pages/Simulator.jsx:1>):

1. Resolve scenario by ID
2. Normalize or generate `visualScene` if missing
3. Initialize conversation state
4. Create session record
5. Optionally inject opening HCP turn
6. Seed initial observable cues
7. Accept rep message
8. Optionally generate real-time coaching feedback for rep turn
9. Generate HCP response
10. Attach coaching nudge to the triggering rep turn
11. Update cues, signals, volatility, prediction, and session state
12. On end-session:
    - compute state history
    - compute volatility events
    - generate session review
    - persist end-state
    - display summary modal

That flow is the behavioral SOT loop.

## QA Twin SOT

Per [src/pages/QATwin.jsx](</Users/anthonyabdelmalak/Desktop/New Folder With Items/signal-coach-core/src/pages/QATwin.jsx:1>), the QA Twin is designed to validate the simulator against persona-driven runs.

Current QA personas:

- `strong_rep`
- `mediocre_rep`
- `weak_rep`

Current QA assertions include:

- HCP responds to every rep turn
- behavior signals populate every turn
- volatility triggers when appropriate
- review returns all 8 capability insights
- no empty/malformed HCP replies
- coaching nudges appear
- deterministic capability evaluation completes
- capability levels are not all defaulted

This means the rebuilt simulator needs a QA surface early, not as a final nice-to-have.

## What Is SOT vs What Is Replaceable

### SOT

- scenario catalog and taxonomy
- 19 canonical scenarios
- persona and pressure mappings
- simulator page flow
- transcript behavior
- cue/nudge placement
- right rail model
- session review structure
- QA assertions

### Replaceable

- Base44 persistence layer
- Base44 auth
- Base44 SDK
- Base44 function calls
- Base44 endpoints
- Base44 entity CRUD contract

## Worker Gap Reality

The Base44 app is **not compatible** with the existing worker contract by default.

Known reason categories:

- different payload shape
- different endpoint model
- different session assumptions
- different response schema
- different ownership of state derivation
- different assumptions around scenario storage and retrieval

So the rebuild must use an explicit adapter layer.

## Required Rebuild Artifacts

Before more implementation, the rebuild should define these artifacts explicitly:

### 1. Frontend Domain Schema

Canonical types for:

- Scenario
- Session
- TranscriptTurn
- BehaviorSignals
- CoachingNudge
- VolatilityState
- SessionReview
- HcpPrediction

### 2. Worker Adapter Contract

For each simulator action, define:

- endpoint
- request payload
- response payload
- frontend-derived fallback fields
- error strategy

Minimum actions:

- health
- realtime feedback
- HCP turn generation
- session review generation

### 3. Mapping Contract

A written mapping from Base44 SOT concepts to rebuilt frontend concepts:

- scenario fields
- persona fields
- state fields
- prediction fields
- review fields

### 4. Preservation Test Matrix

For at least a subset of canonical scenarios, verify:

- same scenario taxonomy
- same opening-scene behavior
- same transcript layout
- same cue placement
- same right-rail semantics
- same review sections

## Rebuild Order

The safest order is:

1. Extract canonical scenario schema and scenario catalog into local code
2. Build a clean worker adapter for the current contract
3. Rebuild simulator state model around the worker adapter
4. Restore transcript UX
5. Restore right rail
6. Restore session review
7. Restore QA Twin
8. Restore builder/admin only after core simulator is stable

## Immediate Recommendation

Do **not** continue treating this as a code migration from Base44.

Treat it as:

- forensic extraction of the correct behavioral product
- followed by a clean rebuild against the worker contract

The rebuild should be judged by one standard:

Does the simulator behave like the Base44 SOT?

Not:

Does it compile?
Does it hit an endpoint?
Does it roughly look similar?

## Current Status

As of this recovery pass:

- the Base44 behavioral SOT has been identified
- the 19 canonical scenarios have been verified from disk
- the critical simulator, QA, and review files have been identified
- the next correct implementation step is to create a contract-first rebuild around these preserved behaviors

