# Role Play Simulator File Ownership Map

## 1. Purpose

This document maps the current Role Play Simulator codebase into runtime ownership zones so implementation work can proceed without scope drift, accidental regressions, or layer confusion.

This map is architectural first, not cosmetic. It exists to answer:

- which files define simulator truth
- which files observe simulator truth
- which files present simulator truth
- which files are protected
- which files are legacy or retirement candidates
- which files require special caution before any edit

## 2. Ownership Zones

The simulator should be classified into these zones:

1. Scenario Contract Layer
2. HCP Brain Layer
3. Validation / Guardrail Layer
4. Scoring / Observation Layer
5. Coaching / Interpretation Layer
6. Presentation Layer
7. Legacy / Unknown / Retirement Candidates

## 3. File Classification

Below is the first-draft ownership map based on the current audit.

## 3.1 Scenario Contract Layer

### Primary files

- `ROLEPLAY_SOT.md`
- `src/lib/scenarioNormalization.js`
- `src/components/roleplay/hcpDialogueEngine.jsx`

### Ownership

This layer owns:

- scenario normalization
- scenario metadata interpretation
- opening scene structure
- HCP category / role context
- scenario-bound constraints
- feedback contract boundaries
- metric applicability gating rules tied to scenario contract

### Status

- `ROLEPLAY_SOT.md` -> `Protected Core`
- `src/lib/scenarioNormalization.js` -> `Protected Core`
- `src/components/roleplay/hcpDialogueEngine.jsx` -> `Legacy / Candidate for Retirement or Containment`

### Notes

`hcpDialogueEngine.jsx` looks especially risky because it appears to contain older, broader scenario/personality scaffolding that may not align with the target HCP brain model. It should not be casually edited without first determining whether it is still active in the main simulator path.

## 3.2 HCP Brain Layer

### Primary files

- `src/components/roleplay/hcpSimulationEngine.jsx`
- `src/components/roleplay/turnContractController.js`
- `src/components/roleplay/cueSelector.js`

### Secondary related files

- `src/components/roleplay/RolePlayChat.jsx`

### Ownership

This layer owns:

- HCP structural state
- HCP temperature and severity
- deterministic state transitions
- memory and continuity
- turn objective / response mode
- cue selection
- closure logic
- deterministic profile generation
- HCP prompt/response authority path
- turn contract logic

### Status

- `src/components/roleplay/hcpSimulationEngine.jsx` -> `Protected Core`
- `src/components/roleplay/turnContractController.js` -> `Protected Core`
- `src/components/roleplay/cueSelector.js` -> `Protected Core`
- `src/components/roleplay/RolePlayChat.jsx` -> `Protected Core`, but also `Boundary Violation Risk`

### Notes

`RolePlayChat.jsx` appears to be doing too much and likely mixes:

- runtime orchestration
- UI
- scoring invocation
- guardrails
- feedback generation

It is probably the single biggest boundary-risk file in the simulator and should be treated as a protected orchestration file until responsibilities are split more cleanly.

## 3.3 Validation / Guardrail Layer

### Primary files

- `src/components/roleplay/turnValidator.js`
- `src/components/roleplay/operationalConstraintGuardrails.js`

### Secondary likely-related files referenced in runtime

- `src/components/roleplay/transformSafetyHarness`
- `src/components/roleplay/constraintLoopPolicy`
- `src/components/roleplay/interventionEngineV2`
- `src/components/roleplay/hardDemandPriorityLock`
- `src/components/roleplay/hcpReactionIntegrity`
- `src/components/roleplay/scenarioDomainIntegrity`
- `src/components/roleplay/operationalRealismEnforcer`
- `src/components/roleplay/hcpReferenceSafety`
- `src/components/roleplay/demandHoldContinuity`

### Ownership

This layer owns:

- turn validity checks
- contract repair and retry
- operational constraint grounding
- anti-drift enforcement
- realism preservation constraints
- closure safety
- scenario/domain integrity enforcement

### Status

- `src/components/roleplay/turnValidator.js` -> `Protected Core`
- `src/components/roleplay/operationalConstraintGuardrails.js` -> `Protected Core`
- all secondary files above -> `Protected Core`, `Needs Audit`

### Notes

These files are essential, but also high risk. They may be doing too much compensatory work because the HCP brain is not yet unified enough. They should be treated as stabilizers, not independent authors of behavior.

## 3.4 Scoring / Observation Layer

### Primary files

- `src/components/roleplay/alignmentEngine.jsx`
- `src/components/roleplay/signalIntelligenceSOT.jsx`
- `src/components/roleplay/sessionScoreAggregation.js`

### Secondary related files

- `src/components/roleplay/inlineCoachingCalibration.js`

### Ownership

This layer owns:

- canonical Behavioral Metrics definitions
- capability structure
- observable score computation
- alignment rubric
- metric aggregation
- score versioning / score integrity

### Status

- `src/components/roleplay/alignmentEngine.jsx` -> `Protected Scoring`
- `src/components/roleplay/signalIntelligenceSOT.jsx` -> `Protected Scoring`
- `src/components/roleplay/sessionScoreAggregation.js` -> `Protected Scoring`
- `src/components/roleplay/inlineCoachingCalibration.js` -> `Downstream Interpretation`, but `Scoring-Adjacent`

### Notes

`alignmentEngine.jsx` is one of the most important files in the whole system. It should only be edited with explicit scoring-scope intent. It also appears to have determinism risks due to session-local behavior and should be audited carefully in later phases.

## 3.5 Coaching / Interpretation Layer

### Primary files

- `src/components/roleplay/CoachingOverlay.jsx`
- `src/components/roleplay/inlineCoachingCalibration.js`
- `src/components/roleplay/CapabilityFeedbackPanel.jsx`

### Secondary related files

- final evaluation and session feedback formatting files referenced by `RolePlayChat.jsx`

### Ownership

This layer owns:

- inline coaching presentation
- coaching message selection
- coaching copy refinement
- capability narrative explanation
- end-session interpretation and user-facing explanation

### Status

- `src/components/roleplay/CoachingOverlay.jsx` -> `Downstream Interpretation`
- `src/components/roleplay/inlineCoachingCalibration.js` -> `Downstream Interpretation`
- `src/components/roleplay/CapabilityFeedbackPanel.jsx` -> `Downstream Interpretation`
- session feedback formatter path -> `Downstream Interpretation`, `Needs Audit`

### Notes

This layer is allowed to explain the interaction, but must not mutate the interaction truth or scoring semantics. It is especially vulnerable to bad Codex prompts because coaching improvements often accidentally spill into runtime and evaluation logic.

## 3.6 Presentation Layer

### Primary files

- `src/components/roleplay/RolePlayChat.jsx`
- `src/components/roleplay/LiveMetricsPanel`
- `src/components/roleplay/AnnotatedTranscript`
- visual support files for role play panels and styles

### Ownership

This layer owns:

- chat rendering
- panel display
- tabs
- transcript view
- user-visible simulator layout
- manager-facing or rep-facing presentation components

### Status

- `src/components/roleplay/RolePlayChat.jsx` -> mixed-use file; currently `Protected Core` and `Presentation Boundary Risk`
- pure panel/transcript display files -> `Presentation Only`, unless they compute behavior

### Notes

Because `RolePlayChat.jsx` mixes orchestration and presentation, it is currently not a clean Presentation Layer file. It should eventually be decomposed, but until then it must be treated as a protected boundary file.

## 3.7 Legacy / Unknown / Retirement Candidates

### Current candidates

- `src/components/roleplay/hcpDialogueEngine.jsx`
- any legacy/default-path logic in `RolePlayChat.jsx`
- any code path that still depends on non-canonical metric naming or older capability ordering
- any branch-specific or scenario-specific fallback logic discovered later
- any `flawlessMode` split-path behavior that bypasses canonical authority

### Ownership

These are not trusted as canonical until confirmed.

### Status

- `Legacy / Candidate for Retirement`
- `Needs Explicit Audit Before Edit`

## 4. File Status Legend

Use these labels going forward:

- `Protected Core`
  - touches HCP runtime truth, scenario contract truth, or validation authority
- `Protected Scoring`
  - touches canonical REP evaluation logic
- `Downstream Interpretation`
  - derives explanation, coaching, or narrative from established truth
- `Presentation Only`
  - displays outputs without altering logic
- `Legacy / Candidate for Retirement`
  - older, overlapping, or suspicious logic not yet confirmed as canonical
- `Needs Audit`
  - file is architecturally important but not yet fully mapped

## 5. Do-Not-Touch Rules By Zone

### Protected Core

Do not touch unless the task is explicitly:

- HCP Runtime
- Architecture
- Validation / Guardrail hardening

### Protected Scoring

Do not touch unless the task is explicitly:

- Scoring Integrity
- Canonical Metrics Alignment
- Panel Score Consistency

### Downstream Interpretation

May be edited for explanation or coaching clarity only if:

- runtime truth is not altered
- scoring semantics are not altered
- deterministic behavior is not altered

### Presentation Only

May be edited for UI/UX only if:

- data meaning is unchanged
- scoring outputs are unchanged
- simulator behavior is unchanged

### Legacy / Candidate for Retirement

Do not casually edit. Audit first.

## 6. Immediate Next Actions Based On This Map

1. Use it together with the Runtime Contract as the basis for:
   - protected branch scoping
   - future Codex prompts
   - PR review
2. Open the first architecture branch:
   - `sim-architecture/runtime-contract-lock`
3. First implementation task:
   - confirm the ownership map against the live code
   - identify exact boundary violations in `RolePlayChat.jsx`
   - identify exact legacy/default vs deterministic split points
   - identify exact generic fallback insertion points

## 7. Practical Summary

The highest-risk files right now are:

- `src/components/roleplay/RolePlayChat.jsx`
- `src/components/roleplay/hcpSimulationEngine.jsx`
- `src/components/roleplay/turnContractController.js`
- `src/components/roleplay/cueSelector.js`
- `src/components/roleplay/alignmentEngine.jsx`
- `src/components/roleplay/operationalConstraintGuardrails.js`

Those files should be treated like protected infrastructure.

The most suspicious legacy file right now is:

- `src/components/roleplay/hcpDialogueEngine.jsx`

The most likely orchestration bottleneck is:

- `src/components/roleplay/RolePlayChat.jsx`

The most important scoring authority file is:

- `src/components/roleplay/alignmentEngine.jsx`
