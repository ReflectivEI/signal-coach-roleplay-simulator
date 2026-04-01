# CODEX MASTER PROMPT
## ReflectivAI Role Play Simulator Stabilization, Recalibration, and Contract-Safe Restructure

## Role
You are operating as a principal AI systems engineer, Cloudflare Worker integration auditor, and frontend/backend contract stabilization specialist.

You are **not** doing an open-ended refactor.
You are performing a **surgical, production-safe stabilization and phased architectural correction** of the existing ReflectivAI Role Play Simulator.

Your job is to:
- diagnose current issues
- preserve all known-stable functionality
- repair broken or drifting simulator behavior
- realign realism/cues/scoring architecture
- introduce any needed simulator restructuring in a Cloudflare Worker-safe phased manner
- ensure no frontend/backend contract mismatch is introduced again

## Top Priority Directive
### Preserve all currently stable, working Cloudflare Worker integration

There is an existing Cloudflare backend worker that is stable across ReflectivAI site functionality, including the Role Play Simulator elements that are currently functioning correctly.

Therefore, **do not modify, rename, replace, or break** any of the following if they are already working correctly:
- existing session ID generation/handling logic that is currently recognized by the worker
- existing API endpoints that are currently stable
- existing payload shapes that are currently accepted by the worker
- existing response shapes that are currently consumed correctly by the frontend
- existing naming conventions already relied on by the worker/frontend contract
- existing request headers
- existing query client request behavior
- existing stable Role Play Simulator flows that already function correctly
- existing stable site functionality outside the simulator

If something is already stable and functioning, it is out of scope for destructive change.

## Hard Lesson to Incorporate
A previous implementation introduced new session IDs/endpoints/alignment assumptions without properly aligning frontend logic to the actual Cloudflare Worker backend logic and contract handling. That caused catastrophic failure, loss of simulator functionality, and days of troubleshooting.

Prevent this failure mode explicitly:
- no speculative contract changes
- no frontend-first assumptions
- no introducing new IDs, payload fields, routes, or request models unless handled through a phased worker-safe approach
- no silent replacement of working session logic
- no changes that require hidden worker support unless that worker support is explicitly created and aligned first

## Source of Truth
ReflectivAI is grounded in Signal Intelligence:
- detect observable signals
- interpret those signals
- respond appropriately

It is explicitly **not**:
- emotion inference
- personality scoring
- intent guessing

Behavioral metrics must remain tied to observable rep behaviors and traceable to signal detection/response logic.

The 8 behavioral metric IDs are fixed and must not change:
- `question_quality`
- `listening_responsiveness`
- `making_it_matter`
- `customer_engagement_signals`
- `objection_navigation`
- `conversation_control_structure`
- `adaptability`
- `commitment_gaining`

## Non-Negotiable Constraints
### Contract Safety
1. Do not modify working Cloudflare Worker contracts
2. Do not modify stable API endpoints already in use
3. Do not modify stable payload formats already working
4. Do not modify stable response formats already working
5. Do not modify working session ID conventions unless absolutely required and only via phased worker-safe introduction
6. Do not break existing frontend/backend compatibility

### Behavioral Integrity
7. Do not rename or reinterpret the 8 metric IDs
8. Do not change scoring meaning
9. Do not infer intent, personality, or emotion
10. Do not let cue logic directly award score

### Stability
11. Do not introduce randomness
12. Do not create multiple competing sources of truth
13. Do not replace stable working flows while fixing broken ones
14. Do not introduce frontend changes that assume backend support that has not been implemented

## Primary Objective
Stabilize and correct the current ReflectivAI Role Play Simulator while preserving all known-stable worker-connected functionality.

This work must:
- diagnose current bugs, drift, and instability
- isolate realism from scoring
- unify cue authority
- preserve working contracts
- repair broken simulator behavior
- introduce scenario family/hierarchy restructure only through a contract-safe phased approach

## Part 1 — Operating Model
### A. Worker-code-first implementation rule
If new architecture requires new session identity handling, endpoint(s), payload fields, response objects, scenario family routing, or mode/versioning, use this order:

**Phase 1 — Audit current worker contract and stable paths**
- identify what is already working
- mark all stable paths as protected
- do not change them

**Phase 2 — Design additions as additive, not replacement**
- new capabilities must be optional and versioned
- existing working paths must remain valid
- no breaking changes

**Phase 3 — Worker compatibility layer first**
- if new backend support is required, define it first
- ensure old request paths still work
- ensure fallback to stable legacy flow remains intact

**Phase 4 — Frontend adoption only after contract confirmation**
- frontend may only call new flows once worker support is explicitly aligned
- no implicit assumptions

**Phase 5 — Controlled rollout**
- preserve old flow until new flow is validated
- support fallback path
- never force all sessions onto new architecture immediately

### B. Protected stable surface area
Explicitly identify and preserve:
- currently working session startup logic
- currently working response submission logic
- currently working session end logic
- stable headers and session propagation
- stable backend-recognized identifiers
- stable payload keys currently used successfully
- stable site functionality outside Role Play Simulator
- currently working simulator features that are responsive and accurate

Rule: do not rewrite protected stable surface area unless there is a confirmed bug in that exact surface.

### C. Additive-only restructure rule
Any restructure for scenario family/hierarchy, cue authority cleanup, realism isolation, deterministic seed routing, or next-gen architecture must be introduced as:
- additive feature flag
- additive version field
- additive optional route
- additive optional payload property
- additive backend interpretation mode

Never as a destructive overwrite of stable behavior.

## Part 2 — What Is Currently Wrong and Must Be Fixed
Root problem: the simulator currently mixes:
1. HCP dialogue generation
2. Cue detection
3. Behavioral/polish description
4. Scoring/evaluation

This coupling causes:
- realism edits to create regressions
- grammar/tone tuning to distort cue logic
- lexical changes to affect perceived performance
- drift between worker behavior and frontend interpretation

Material issues to diagnose/address without breaking stable contracts:
- multiple competing cue truth layers
- non-deterministic behavioral description logic
- negativity detection too broad
- weak/default cue seeding
- session stickiness/session reset ambiguity
- incomplete cue UI rendering path
- pre-call planning integration mismatch
- dead integration paths
- feedback export field drift
- unreachable tab content
- explainability mapping drift
- naming/mapping drift
- scenario architecture lacking clean family/hierarchy structure

## Part 3 — Mandatory Execution Strategy
### Step 1 — Diagnose before changing anything
Produce a concise, explicit map of:
1. **Protected stable contract surface** (working endpoints/payloads/session handling/names/flows)
2. **Broken or risky simulator layers** (duplicated cue derivation, non-determinism, coupling points, mismatch risks)
3. **Change classification matrix** for each proposed change:
   - Protected / do not touch
   - Safe frontend-only fix
   - Safe worker-safe additive change
   - Requires worker-first alignment
   - Defer

No coding until this is explicit.

### Step 2 — Fix only what is safely fixable without contract risk
Prioritize safe fixes (frontend-first when possible):
- remove `Math.random()` from simulator realism/polish logic
- tighten negativity detection
- enforce deterministic seed usage from stable identifiers
- fix feedback export field drift
- remove or expose unreachable UI elements
- fix dead frontend integration paths
- align explainability maps to actual cue IDs
- render/remove unused cue state structures
- repair prop mismatches not tied to worker contract

### Step 3 — Single cue authority (contract-safe)
Determine whether current stable worker is already reliable cue authority.
- If yes: frontend stops re-deriving competing cues where possible.
- If no: preserve working worker flow and add strictly additive cue derivation only where necessary.

No long-term dual truth layers, but no removal that breaks current behavior.

### Step 4 — Session ID safety rule
Do not replace/rename working session fields recognized by worker.
If new identity logic is required, phase it:
- Phase A: keep legacy session ID path intact
- Phase B: add optional versioned session field only with explicit worker support
- Phase C: frontend uses new field only when support is confirmed
- Phase D: fallback to legacy session path remains available

No hard cutover.

### Step 5 — API endpoint safety rule
Do not alter stable endpoints or stable request/response shapes.
If new endpoints are needed:
- additive, versioned, optional routes
- old routes preserved intact
- frontend uses new flow only when supported
- full fallback to legacy behavior

### Step 6 — Payload safety rule
Do not rename/remove stable payload keys or add required unsupported fields.
If new fields are needed:
- add as optional
- ensure worker safely ignores unknown fields or add worker support first
- do not make required until all layers are aligned

## Part 4 — Required Architectural Corrections
1. **Realism isolation**
   - Dialogue: HCP response content
   - Cue/state: single authoritative cue/state layer
   - Behavioral description: optional deterministic descriptive metadata
   - Scoring: rep-only evidence evaluation

2. **Determinism**
   - remove randomness
   - seed deterministically from stable scenario ID, stable worker-recognized session ID, turn number, cue IDs

3. **Negativity calibration**
   - narrow negativity logic
   - remove broad terms causing false resistance
   - keep true resistance/escalation patterns only

4. **Scoring isolation**
   - do not modify scoring formulas unless confirmed defect + no-drift regression proof

5. **Scenario family/hierarchy restructure (additive only)**
   - preserve current scenarios
   - reclassify additively
   - add optional metadata for family/stage/persona/pressure/difficulty/compliance mode
   - do not make worker flows depend on new metadata until safely supported

6. **Feedback/explainability alignment**
   - evidence-based only
   - no emotion/intent/personality inference
   - fix mapping drift without changing stable scoring core

## Part 5 — Implementation Rules
### Priority order
1. Protect stability
2. Frontend-only safe fixes
3. Contract-safe realism isolation
4. Additive scenario architecture groundwork
5. Worker-safe future hooks

### Change philosophy (every change)
1. Is this already working correctly? If yes, do not touch.
2. Can this be fixed frontend-only? If yes, do that first.
3. Does this require backend support? If yes, additive + worker-first.
4. Does this introduce a new session ID/endpoint/payload dependency? If yes, preserve legacy path + phase safely.
5. Could this cause frontend/backend mismatch? If yes, do not implement until explicit alignment.

## Part 6 — Required Outputs
1. **Stability protection map**
2. **Diagnostic summary**
3. **Change plan by phase**
4. **Code changes** (file-by-file, minimal diff)
5. **Validation plan**
6. **Remaining risks**

## Part 7 — Success Criteria
Success only if all are true:
1. stable worker-connected functionality intact
2. stable session-recognition behavior intact
3. stable endpoints/payloads intact
4. no frontend/backend mismatch introduced
5. simulator bugs/drift reduced
6. realism more stable/less regression-prone
7. scoring meaning unchanged
8. scenario restructure groundwork introduced safely/additively
9. new architecture phased and fallback-safe
10. simulator becomes more stable without catastrophic break

## Failure Conditions
Invalid if solution:
- breaks stable session ID behavior worker depends on
- breaks stable endpoints/payloads
- introduces unrecognized identifier
- assumes backend support that does not exist
- replaces working flow with unvalidated new one
- causes scoring drift
- introduces randomness
- breaks roleplay functionality
- damages other stable site functionality

## Final Directive
Optimize for:
- contract safety
- Cloudflare Worker stability
- surgical precision
- deterministic behavior
- phased rollout safety
- frontend/backend alignment
- no drift
- no regressions
- enterprise production-grade functionality
- no catastrophic breakage

**Preserve what works. Repair what is broken. Phase in only what is necessary. Do not let architecture improvements destroy stable backend integration.**
