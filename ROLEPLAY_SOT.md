# ROLEPLAY_SOT — Role Play Simulator Source of Truth

This document is extracted from the deterministic runtime implementation that is enabled only when `flawlessMode` is active, and is authoritative for behavior alignment in Flawless mode.

## 1) Turn State (Session/Turn Contract State)

### 1.1 Per-turn computed state
For each rep turn, runtime computes and stores:
- `activeConcern` and normalized active constraints.
- `concernFlowOutcome` (`aligned`, `missed`, `overpivot`, etc.).
- `unresolvedConcernTurns` and loop-breaker budget.
- Objective ranking and selected deterministic response objective.
- Turn contract state snapshot:
  - `unansweredDirectQuestions`
  - `unresolvedObjections`
  - `acceptedOperationalConstraints`
  - `closureEligibility` (`eligible`, `reasons[]`)

### 1.2 Turn contract controller
Response mode is code-selected (not prompt-decided):
1. `close` if closure eligibility is true.
2. `answer` if unanswered direct questions exist.
3. `reanchor` when unresolved objections exist and concern flow was missed/overpivot.
4. `advance` when unresolved objections exist.
5. fallback mode otherwise.

Controller emits deterministic obligations:
- `answer`: answer unanswered question first; do not lead with a new question.
- `reanchor`: explicitly re-anchor to active constraint.
- `advance`: propose one low-burden next step.
- `close`: closure statement; no new open questions.

## 2) HCP State

### 2.1 Structural state ladder
Canonical states:
- `neutral`
- `engaged`
- `time-pressured`
- `resistant`
- `boundary-setting`
- `irritated`
- `disengaged`

### 2.2 Emotional temperature ladder
Independent temperature axis:
- `positive`
- `neutral`
- `stressed`
- `irritated`

### 2.3 Severity band
Severity range is clamped to `[0,2]` and transitions from:
- boundary violations/pushy behavior
- state escalation with low alignment
- de-escalation with strong alignment and empathy

### 2.4 Transition model
State and temperature transitions are deterministic and regex-signal driven:
- Hard/medium/soft escalation patterns (e.g., disrespect, pushy framing, boundary breaches).
- De-escalation patterns (acknowledgment, empathy, time respect).
- Weighted state transition memory plus time-pressure accumulation with turn count.

## 3) Cue Selection Rules

Cue selection must be deterministic and context-grounded:
1. Generate candidate cue from the same grounded context as dialogue/state.
2. If terminal-decision mode, select from terminal decision cue bank.
3. Enforce anti-repetition on a 20-turn rolling window.
4. On repeat collision, deterministically rotate through fallback pool.
5. Preserve alignment between cue, HCP state, and generated dialogue.

The `cueSelector` engine is the only selector for final cue assignment and no-repeat enforcement.

## 4) Scoring and Alignment

### 4.1 Capability scoring
Alignment engine scores the canonical 8 capabilities from `signalIntelligenceSOT`.
- Output includes metric-level scores and session-level aggregate score.
- Scoring is deterministic for identical inputs.

### 4.2 Engagement/quality scoring
Runtime computes:
- engagement score/level
- emotional valence
- stance
- reaction trigger
- conversational momentum
- time pressure

Conversation quality and detected rep behaviors influence state weighting and transition pressure.

## 5) Closure Rules

Closure is gated by deterministic conditions only.

### 5.1 Closure eligibility triggers
Closure reasons may include:
- explicit exit intent
- terminal decision mode
- hard loop breaker
- exceeded unresolved concern loop budget

### 5.2 Forced closure/disengagement
When state becomes `disengaged` with repeated poor-value turns, runtime may force terminal close line selection deterministically.

### 5.3 Closure output constraints
In closure mode:
- response mode is `close`
- output should not open new questions
- cue and dialogue both reflect conversation termination

## 6) Guardrails

### 6.1 Operational constraint guardrails
Runtime extracts and validates operational constraints and can replace unsafe drift with deterministic grounded fallback responses.

### 6.2 Turn validation guardrails
`turnValidator` enforces post-generation checks:
- turn contract validity (`answer` mode cannot return question-only output)
- deterministic repair/retry path when invalid

### 6.3 Non-repetition and drift guardrails
- 20-turn cue anti-repetition window.
- dialogue/cue variety checks.
- scenario grounding checks to prevent off-context short generic outputs.

### 6.4 Safety and professionalism
Tone normalization + text hardening keep language professional, non-hostile, and punctuation-stable.

## 7) Implementation Anchors
Primary implementation files:
- `src/components/roleplay/RolePlayChat.jsx`
- `src/components/roleplay/hcpSimulationEngine.jsx`
- `src/components/roleplay/alignmentEngine.jsx`
- `src/components/roleplay/turnContractController.js`
- `src/components/roleplay/cueSelector.js`
- `src/components/roleplay/turnValidator.js`
- `src/components/roleplay/operationalConstraintGuardrails.js`

## 8) Version Matrix (Regular vs Flawless)

### Regular RolePlaySimulator (default path)
- `flawlessMode` is `false`.
- Uses the legacy runtime branches in `RolePlayChat` for prompt contract guidance,
  validation/repair flow, and cue selection fallback.
- Intended for continuity with existing behavior and backward compatibility.

### RolePlaySimulatorFlawless (deterministic path)
- `flawlessMode` is set to `true` from the entry boundary and propagated through scenario cards.
- Activates deterministic engine layers in `RolePlayChat`:
  - `buildTurnContractController`
  - `validateTurnWithRetry`
  - `selectContextualCue` / `enforceNoRecentCueRepeat`
- Intended for strict deterministic enforcement of obligations, cue no-repeat policy, and closure rules.
