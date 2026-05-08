# First Role Play Simulator Architecture Audit

## Purpose

This document records the first live architecture audit of the Role Play Simulator against the Runtime Contract and File Ownership Map.

Its purpose is to identify the current runtime authority path, concrete boundary violations, generic fallback risk, and the safest first implementation targets.

## Audit Scope

Files reviewed in this pass:

- `src/components/roleplay/RolePlayChat.jsx`
- `src/components/roleplay/hcpSimulationEngine.jsx`
- `src/components/roleplay/turnContractController.js`
- `src/components/roleplay/cueSelector.js`
- `src/components/roleplay/operationalConstraintGuardrails.js`
- `src/components/roleplay/alignmentEngine.jsx`
- `src/lib/scenarioNormalization.js`
- `src/components/roleplay/hcpDialogueEngine.jsx`
- `src/components/roleplay/CoachingOverlay.jsx`
- `src/components/roleplay/inlineCoachingCalibration.js`
- `src/components/roleplay/CapabilityFeedbackPanel.jsx`

## Executive Finding

The simulator already contains meaningful deterministic state logic, strong scenario governance, and strong REP-side scoring structure.

The main architectural problem is not absence of sophistication. The main problem is split authority:

- HCP state logic exists
- validation and guardrail logic exists
- scoring logic exists
- coaching logic exists
- UI orchestration exists
- prompt-built dialogue still exists

These layers are not yet cleanly separated. The HCP is still produced by a hybrid system rather than one fully unified HCP brain.

## Live Runtime Authority Path

Current runtime authority is effectively:

1. Scenario and governance constraints are normalized through `src/lib/scenarioNormalization.js`
2. HCP state, cue memory, temperature, severity, and prompt framing are built in `src/components/roleplay/hcpSimulationEngine.jsx`
3. Turn-contract and operational guardrails can intervene through:
   - `src/components/roleplay/turnContractController.js`
   - `src/components/roleplay/operationalConstraintGuardrails.js`
   - additional integrity helpers imported into `RolePlayChat.jsx`
4. `src/components/roleplay/RolePlayChat.jsx` acts as the orchestration choke point and coordinates runtime, guardrails, scoring, and end-session generation
5. REP scoring is computed downstream in `src/components/roleplay/alignmentEngine.jsx`
6. Coaching and feedback layers interpret the session downstream, but still depend on mixed orchestration in `RolePlayChat.jsx`

This means the system does not yet have one isolated runtime authority for HCP turn production.

## Confirmed Boundary Violations

### 1. `RolePlayChat.jsx` is a mixed-authority orchestration file

`src/components/roleplay/RolePlayChat.jsx` currently mixes:

- runtime orchestration
- HCP integrity checks
- constraint handling
- cue/dialogue validation
- scoring invocation
- coaching trigger logic
- session feedback generation
- presentation rendering

This violates the target architecture because one file is acting as both orchestrator and presenter while also touching downstream interpretation.

### 2. `hcpSimulationEngine.jsx` is deterministic in state but still prompt-mediated in dialogue

`src/components/roleplay/hcpSimulationEngine.jsx` deterministically derives:

- structural state
- temperature
- severity
- cue memory
- interaction mode
- semantic progression

But it still outputs a prompt through `buildHCPDialoguePrompt()` and `buildTurnSimulationBundle()`.

That means the HCP brain is not yet fully code-owned end-to-end. State is deterministic, but spoken behavior is still mediated through prompt construction.

### 3. `cueSelector.js` contains prohibited generic fallback cues

`src/components/roleplay/cueSelector.js` currently falls back to generic cues such as:

- `The HCP pauses, clearly expecting something more useful.`
- `The HCP glances at the clock, patience thinning.`
- `The HCP shifts posture slightly, less engaged.`
- `The HCP waits with clipped attention for one practical answer.`

This is a direct violation of the Runtime Contract rule forbidding generic global fallback behavior.

### 4. `operationalConstraintGuardrails.js` can emit generic concern-family fallback responses

`src/components/roleplay/operationalConstraintGuardrails.js` currently generates neutral concern-family responses such as:

- evidence fallback
- workflow fallback
- staffing fallback
- access fallback

These are safer than random drift, but they are still generic concern-family responses, not scenario-bound HCP-specific outputs.

This violates the intended realism standard when used as a substitute for scenario-grounded dialogue.

### 5. `turnContractController.js` is underpowered versus the target contract model

`src/components/roleplay/turnContractController.js` currently selects among:

- `close`
- `answer`
- `repair`
- fallback `probe`

This is narrower than the intended HCP response-control model and does not cleanly represent the stronger contract vocabulary discussed in the architecture work.

This is not yet the worst realism problem, but it is a clear refactor target.

### 6. `alignmentEngine.jsx` remains scoring-pure in intent, but not fully deterministic in implementation

`src/components/roleplay/alignmentEngine.jsx` preserves REP-only evaluation and strong Signal Intelligence structure.

However:

- it still uses browser session storage in parts of alignment computation
- the canonical capability ordering in code still reflects older ordering in which Value Connection appears before Customer Engagement Monitoring

This creates determinism and canonical-alignment risks in the scoring layer.

## Generic Fallback Risk Points

The first confirmed generic fallback insertion points are:

1. `src/components/roleplay/cueSelector.js`
2. `src/components/roleplay/operationalConstraintGuardrails.js`

These should be treated as the first runtime hardening targets because they create visible realism drift without requiring a full architecture rewrite.

## Legacy / Suspicious Paths

### `src/components/roleplay/hcpDialogueEngine.jsx`

This file appears to contain older scenario/personality scaffolding and broader demo-style dialogue logic.

It should be treated as:

- legacy until proven otherwise
- a retirement or containment candidate
- unsafe for casual edits

## Priority Refactor Targets

### Priority 1

- `src/components/roleplay/cueSelector.js`
- `src/components/roleplay/operationalConstraintGuardrails.js`

Reason:
These files inject generic behavior into the HCP experience and are the clearest first violations of the Runtime Contract.

### Priority 2

- `src/components/roleplay/turnContractController.js`

Reason:
The turn controller should become a stronger expression of HCP runtime authority and response-mode logic.

### Priority 3

- `src/components/roleplay/RolePlayChat.jsx`

Reason:
This is the main orchestration bottleneck and the main layer-boundary violation file, but it should not be rewritten first without reducing lower-level genericity and clarifying authority boundaries.

### Priority 4

- `src/components/roleplay/hcpSimulationEngine.jsx`

Reason:
This is the center of the future HCP brain, but it should be hardened after the clearest helper-level runtime leaks are reduced.

### Priority 5

- `src/components/roleplay/alignmentEngine.jsx`

Reason:
Important scoring integrity work remains here, but it should follow HCP runtime isolation rather than precede it.

## Safest First Implementation Move

The safest first implementation move is:

1. remove generic fallback cues from `src/components/roleplay/cueSelector.js`
2. require cue fallback behavior to remain scenario-bound or locked-cue-bound

This is the clearest low-risk change because it:

- directly improves realism integrity
- does not require major orchestration changes
- does not alter canonical scoring
- reduces one of the most visible contract violations

## What Not To Touch Yet

Do not touch yet:

- broad `RolePlayChat.jsx` decomposition
- end-session coaching redesign
- manager-view derivation logic
- predictive prep logic
- broad scoring refactor
- scenario content rewrites

## Next Recommended Sequence

1. Eliminate generic cue fallback behavior
2. Reduce generic concern-family fallback behavior in guardrails
3. Strengthen turn-contract response modes
4. Trace and isolate HCP turn authorship inside `RolePlayChat.jsx`
5. Harden scoring determinism and canonical ordering

## Bottom Line

The simulator does not need random polishing first.

It needs the first visible runtime leaks sealed in this order:

- generic cue leakage
- generic guardrail fallback leakage
- weak turn-authority control
- orchestration boundary cleanup

That is the safest path to making the HCP feel more coherent without destabilizing the rest of the platform.
