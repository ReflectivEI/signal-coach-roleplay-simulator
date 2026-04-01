# Stability Protection Map + Change Classification Matrix (Pre-Implementation)

Date: 2026-03-31 (UTC)
Scope: ReflectivAI Role Play Simulator + Worker contract surfaces
Constraint: Audit-only. No code changes.

## Part 1 — Stability Protection Map

### A) Session Management (Critical)

Session ID Source:
- Frontend role-play session ID is generated client-side in `RolePlayChat` via `useRef` with `session_${Date.now()}_${Math.floor(Math.random() * 1000)}`.
- Worker auth session token is generated server-side via `createSessionToken()` (`session_${Date.now()}_${random}`) and is unrelated to role-play `sid`.

Session ID Storage:
- Role-play `sid` is only in component memory (`sessionIdRef.current`) and not persisted to localStorage/sessionStorage/cookie.
- Auth session token is stored in an HttpOnly cookie (`session`) set by worker login response.
- Login/auth UI state is stored separately via `localStorage.login_email` in frontend auth context.

Session ID Propagation:
- Role-play `sid` is propagated only into deterministic simulation internals (e.g., `buildHCPProfile`) and never sent to worker in roleplay flow.
- Worker session token propagates via browser cookie with `credentials: include` when requested (example: navigation logging).

Worker Recognition Mechanism:
- Worker recognizes auth session via cookie lookup (`getCookieValue(request, "session")`) and `sessions` map membership.
- Worker does not consume frontend role-play `sid` in `/api/llm/invoke` for roleplay dialogue/feedback.

Reset Behavior:
- Role-play session resets by unmount/remount of `RolePlayChat`; a new in-memory `sid` is created each mount.
- Worker auth reset occurs via `/api/auth/logout`, deleting session map entry and expiring cookie.

Stability Assessment:
- **Risk** (dual, unlinked session systems: frontend roleplay `sid` vs worker auth session cookie).

---

### B) API Endpoints (Critical) — Currently used by Role Play Simulator path

Endpoint: `/api/llm/invoke`
Method: `POST`
Payload Shape:
- Dialogue generation: `{ prompt, max_tokens: 220, temperature: 0, roleplay: true }`
- End-session feedback: `{ prompt, max_tokens: 900, temperature: 0.2 }`
Response Shape:
- Worker returns `{ response, model, usage }` on success; may return error payloads with HTTP 503/500.
Used By (file/component):
- `src/components/roleplay/RolePlayChat.jsx` (dialogue + end feedback)
Worker Dependency: Yes
Stability: **Partial** (works with fallback, but response parsing assumptions are broad)

Endpoint: `/api/logs/user` (indirect app-level dependency during authenticated navigation)
Method: `POST`
Payload Shape:
- `{ page: pageName }` from navigation tracker
Response Shape:
- `{ success, logId, timestamp }`
Used By (file/component):
- `src/lib/NavigationTracker.jsx` (not roleplay turn loop itself)
Worker Dependency: Yes
Stability: **Stable** for low-stakes logging; auth optional in worker handler.

Not currently used in active role-play loop despite existing worker routes:
- `/api/roleplay/sessions` (GET/POST)
- `/api/scenarios` (GET/POST/PUT/DELETE)
- `/api/auth/*` for simulator session lifecycle
Stability: **Unknown for roleplay integration** (defined server-side but not wired into simulator flow).

---

### C) Payload Contracts

Endpoint: `/api/llm/invoke`
Required Fields:
- Worker requires: `prompt`
Optional Fields:
- `response_json_schema`, `max_tokens`, `temperature`, `roleplay`, `provider`, `model`
Frontend Assumptions:
- RolePlayChat assumes at least one of `response|text|content` exists in body when `res.ok`.
- RolePlayChat assumes plain text with first-line usable for dialogue.
Risk Level: **High** (frontend tolerant but contract is weakly typed and multi-shape).

Endpoint: `/api/logs/user`
Required Fields:
- None strictly required by worker.
Optional Fields:
- Any body fields are accepted and spread into log entry.
Frontend Assumptions:
- Assumes fire-and-forget behavior; ignores failures.
Risk Level: **Low** for stability, **Medium** for data quality.

---

### D) Response Contracts

Endpoint: `/api/llm/invoke`
Guaranteed Fields:
- On successful normal path: `response`, `model`, `usage`.
Optional Fields:
- In error/degraded paths: `error`, `details`, `status`, `provider`, `isDevelopment`.
Inconsistent Fields:
- Frontend reads fallback keys `text` and `content`, but worker primarily emits `response`.
Frontend Dependencies:
- Dialogue flow uses first line from `(data.response || data.text || data.content || '')`.
- Feedback flow expects text split by `[SECTION_END]`, then regex fallback.
Normalization Logic Present: **Yes** (frontend fallback extraction/parsing and default text fallback)
Risk Level: **High**

Endpoint: `/api/logs/user`
Guaranteed Fields:
- `success`, `logId`, `timestamp`.
Optional Fields:
- None required by frontend.
Inconsistent Fields:
- N/A for caller (result is ignored).
Frontend Dependencies:
- None critical.
Normalization Logic Present: **No** (not needed)
Risk Level: **Low**

---

### E) Working Role Play Flows (Protected)

Flow: Scenario selection
Description: User selects from static in-memory scenario catalog and launches chat modal.
Components Involved: `RolePlaySimulator.jsx`, `EnterpriseScenarioCard.jsx`, `ScenarioCard.jsx`
Backend Dependency: No
Stability: **Stable**

Flow: Session start (simulator runtime)
Description: Turn-0 state initializes in client with deterministic profile build using local `sid`.
Components Involved: `RolePlayChat.jsx`, `hcpSimulationEngine.jsx`
Backend Dependency: No (except later LLM calls)
Stability: **Stable/Partial** (stable locally; depends on later API for generated dialogue)

Flow: Conversation loop
Description: Rep/HCP turn alternation, deterministic state transitions, cue generation, safeguards.
Components Involved: `RolePlayChat.jsx`, alignment/state helpers
Backend Dependency: Yes (LLM endpoint for HCP response text unless fallback path used)
Stability: **Partial**

Flow: Response submission
Description: User message processed with queue + in-flight guards, next turn synthesized.
Components Involved: `RolePlayChat.jsx`
Backend Dependency: Partial
Stability: **Partial**

Flow: Feedback generation
Description: End-session prompt sent to `/api/llm/invoke`, parsed into 4 sections with fallbacks.
Components Involved: `RolePlayChat.jsx`
Backend Dependency: Yes
Stability: **Partial** (parsing resilient but contract not strict)

Flow: Signal panel updates
Description: Alignment metrics and coaching cues rendered from turn state.
Components Involved: `RolePlayChat.jsx`, `alignmentEngine.jsx`, roleplay panels
Backend Dependency: No direct worker dependency
Stability: **Stable/Partial** (stable rendering; quality depends on upstream turn data)

---

### F) Naming + Identifier Dependencies

Identifier: `sessionId` (frontend roleplay sid)
Used In: `RolePlayChat.jsx`, simulation engines
Dependency Type: Deterministic cue/state seed
Stability Risk: **High** if renamed or reformatted without synchronized seed usage

Identifier: worker `session` cookie token
Used In: `worker.js` auth handlers, `/api/logs/user` user attribution
Dependency Type: auth/session identity
Stability Risk: **Medium** (currently decoupled from roleplay runtime)

Identifier: `scenario.id` / `scenarioId`
Used In: scenario selection and worker roleplay session payload model (if used)
Dependency Type: scenario identity mapping
Stability Risk: **Medium** (multiple scenario sources; static vs worker custom)

Identifier: Alignment metric IDs (e.g., `responsiveness_to_cues` etc.)
Used In: alignment computations, live metrics, feedback summaries
Dependency Type: metric map keys
Stability Risk: **High** if key drift occurs

Identifier: payload keys (`prompt`, `max_tokens`, `temperature`, `roleplay`)
Used In: `/api/llm/invoke` contract
Dependency Type: frontend/backend request compatibility
Stability Risk: **Critical** for `prompt`; **Medium** for optional fields

---

## Part 2 — Architectural Risk Diagnosis

### A) Cue Pipelines

Source: Worker-returned cues
Function/File: N/A in roleplay loop (worker returns text; no explicit cue object contract)
Input: prompt only
Output: free-form text response
Conflicts With: frontend deterministic cue system that separately synthesizes cue text
Risk Level: **Medium** (dual semantic sources)

Source: Frontend deterministic profile cue
Function/File: `buildHCPProfile` from `hcpSimulationEngine.jsx` called in `RolePlayChat.jsx`
Input: `sessionId`, `turnNumber`, structural state, temperature, severity
Output: `lockedCue` (+ state bundle)
Conflicts With: post-generation contextual cue overwrite in chat loop
Risk Level: **Medium**

Source: Frontend contextual cue override
Function/File: `RolePlayChat.jsx` (contextual cue generation block)
Input: generated HCP dialogue + recent cues + tier + scenario context
Output: `cueBefore` for next turn
Conflicts With: base/locked cue and deterministic guarantees
Risk Level: **High**

Source: Additional cue engines present in repo
Function/File: `hcpStateEngine.jsx`, `hcpDialogueEngine.jsx` (alternative cue logic)
Input/Output: alternative cue selection heuristics
Conflicts With: unclear single source of truth if multiple engines are reintroduced/wired
Risk Level: **High** (architectural drift risk)

Note: named functions requested (`detectObservableCues`, `selectDynamicCues`, `generateHCPBehavioralDescription`) are not found under current roleplay component tree; likely historical/renamed pipeline references.

---

### B) Realism vs Scoring Coupling

Layer Interaction: Dialogue -> cue -> alignment perception
Where Occurs: Dialogue generated via `/api/llm/invoke`; cue then generated/overridden in frontend; alignment + coaching derived from turn object
Impact: If cue/dialogue drift, perceived scoring credibility degrades.
Severity: **High**

Layer Interaction: Misalignments/positives -> end-session coaching text
Where Occurs: `RolePlayChat` end-session prompt assembly
Impact: Feedback quality tied to deterministic alignment summary and transcript extraction quality.
Severity: **Medium**

---

### C) Non-Determinism

Location: `RolePlayChat.jsx` session ID creation
Type: `Math.random`
Impact: session seed variability across mounts
Severity: **Medium**

Location: `RolePlayChat.jsx` terminal statement include-ask toggle
Type: `Math.random() < 0.45`
Impact: response variance for same inputs
Severity: **Medium**

Location: `RolePlayChat.jsx` terminal decision continuation gate
Type: `Math.random() < continueProbability`
Impact: branching variance in late-turn behavior
Severity: **High**

Location: `worker.js` token/log IDs
Type: `Math.random`
Impact: non-deterministic IDs only; generally acceptable
Severity: **Low**

---

### D) Session Risk

Issue: Frontend roleplay session identity not persisted
Cause: `sid` only in component ref
Impact: no resumability; potential confusion vs worker session model
Severity: **Medium**

Issue: Dual session domains (auth cookie vs roleplay sid)
Cause: separate mechanisms with same conceptual naming
Impact: high risk of future contract mismatch if engineering assumes one canonical session ID
Severity: **Critical**

Issue: stale auth/session expectations
Cause: frontend demo auth via localStorage while worker auth uses cookie sessions
Impact: inconsistent identity/log attribution behavior
Severity: **High**

---

### E) Frontend/Backend Mismatch Risks

Mismatch: Frontend roleplay loop does not use worker roleplay session endpoints
Where: `RolePlayChat` uses only `/api/llm/invoke`
Impact: roleplay persistence endpoints can drift unnoticed
Severity: **High**

Mismatch: Frontend response parsing allows `response|text|content`, worker primarily returns `response`
Where: `RolePlayChat` response extraction
Impact: weakly defined contract masks drift until edge failures
Severity: **High**

Mismatch: Frontend demo auth state (localStorage) vs worker auth cookie/session map
Where: `AuthContext.jsx` + `Login.jsx` vs `worker.js`
Impact: assumptions about identity/session lifecycle can fail across routes/features
Severity: **High**

Mismatch: Existing but unwired worker `/api/roleplay/sessions` schema includes `scenarioId/sessionData/turns/...`; frontend roleplay does not POST this
Where: `worker.js` handler vs roleplay UI
Impact: backend contract can change without simulator detecting breakage
Severity: **Medium**

---

## Part 3 — Change Classification Matrix

Change: Preserve current local turn-state + deterministic engines as baseline
Description: Keep active roleplay turn processing and cue safeguards intact while auditing contract boundaries.

Classification:
- **Protected (Do Not Touch)**

Touches:
- Session ID: No
- Endpoint: No
- Payload: No
- Response Shape: No

Risk Level:
- Medium

Failure Mode if Done Incorrectly:
- Regression of currently working conversation flow.

Recommended Approach:
- Defer modifications until contract hardening plan finalized.

---

Change: Document canonical `/api/llm/invoke` response contract (`response` primary)
Description: Formalize response field expectations and frontend fallback policy without changing runtime behavior first.

Classification:
- **Additive (Worker-Safe)**

Touches:
- Session ID: No
- Endpoint: No
- Payload: No
- Response Shape: Yes (documentation/schema guard only)

Risk Level:
- High

Failure Mode if Done Incorrectly:
- Hidden parsing breakage when worker returns variant shape.

Recommended Approach:
- Additive + versioned contract note, maintain fallback parsing until both sides aligned.

---

Change: Introduce explicit frontend normalization boundary for `/api/llm/invoke`
Description: Centralize extraction/validation from worker response before roleplay logic consumes text.

Classification:
- **Safe Frontend Fix**

Touches:
- Session ID: No
- Endpoint: No
- Payload: No
- Response Shape: No (consumption only)

Risk Level:
- Medium

Failure Mode if Done Incorrectly:
- Empty/invalid dialogue or feedback rendering.

Recommended Approach:
- Frontend-only wrapper with backward-compatible fallback.

---

Change: Wire roleplay session persistence (`/api/roleplay/sessions`) into simulator
Description: Persist start/turn/end session artifacts to worker endpoint.

Classification:
- **Requires Worker Change First**

Touches:
- Session ID: Yes
- Endpoint: Yes
- Payload: Yes
- Response Shape: Yes

Risk Level:
- Critical

Failure Mode if Done Incorrectly:
- Reintroduction of catastrophic session mismatch/payload drift.

Recommended Approach:
- Worker-first: define versioned start/turn/end contract + frontend adapter rollout.

---

Change: Unify auth session + roleplay session identity model
Description: Define authoritative session identity relationship and propagation rules.

Classification:
- **Requires Worker Change First**

Touches:
- Session ID: Yes
- Endpoint: Potentially
- Payload: Yes
- Response Shape: Yes

Risk Level:
- Critical

Failure Mode if Done Incorrectly:
- Cross-session bleed, stale references, unauthorized/session-not-found errors.

Recommended Approach:
- Worker-first contract design; add mapping layer before migration.

---

Change: Remove non-deterministic branches from roleplay turn logic
Description: Replace `Math.random` gates in turn-generation path with deterministic seeded selection.

Classification:
- **Safe Frontend Fix**

Touches:
- Session ID: Yes (seed usage)
- Endpoint: No
- Payload: No
- Response Shape: No

Risk Level:
- Medium

Failure Mode if Done Incorrectly:
- Behavioral repetitiveness or unintended state lock.

Recommended Approach:
- Frontend-only deterministic utility; preserve current behavior distribution envelope.

---

Change: Migrate scenario catalog from static frontend to worker `/api/scenarios`
Description: Replace in-file scenario source with backend CRUD path.

Classification:
- **Requires Worker Change First** (unless read-only additive mirror)

Touches:
- Session ID: No
- Endpoint: Yes
- Payload: Yes
- Response Shape: Yes

Risk Level:
- High

Failure Mode if Done Incorrectly:
- Scenario selection/start breakage and schema mismatch.

Recommended Approach:
- Versioned rollout with dual-read fallback (static + API) before full cutover.

---

Change: Refactor or merge multiple cue engines across files
Description: Consolidate cue pipeline logic spread across chat/state/simulation modules.

Classification:
- **Defer**

Touches:
- Session ID: Yes
- Endpoint: No
- Payload: No
- Response Shape: No

Risk Level:
- High

Failure Mode if Done Incorrectly:
- Cue-dialogue mismatch, scoring trust degradation.

Recommended Approach:
- Defer until contract hardening and regression harness expansion.

---

Change: Keep `/api/llm/invoke` payload key names (`prompt`, `roleplay`, etc.) unchanged
Description: Protect known-working request format while stabilization phase is active.

Classification:
- **Protected (Do Not Touch)**

Touches:
- Session ID: No
- Endpoint: No
- Payload: Yes
- Response Shape: No

Risk Level:
- Critical

Failure Mode if Done Incorrectly:
- Immediate worker rejection or semantic drift.

Recommended Approach:
- Freeze keys during stabilization; only additive optional keys under version gate.

---

## Part 4 — No-Go Zones

Category: Session logic — `RolePlayChat` `sessionIdRef` lifecycle + turn queue/state guardrails
Reason: Core flow stability currently depends on these controls.
Impact if Changed: race conditions, duplicate turns, cue/state desync.

Category: Endpoint — `/api/llm/invoke` route and method
Reason: Only worker endpoint directly used by roleplay runtime.
Impact if Changed: simulator cannot generate dialogue/feedback.

Category: Payload fields — `prompt` (required), current optional keys used in runtime
Reason: Worker handler expects `prompt`; roleplay relies on `roleplay` behavior.
Impact if Changed: 400 errors or different message-role semantics.

Category: Response fields — `response` from `/api/llm/invoke`
Reason: Frontend parsing anchored on this field (with fragile fallbacks).
Impact if Changed: blank/failed dialogue and feedback parse errors.

Category: Alignment metric IDs consumed by UI and scoring summaries
Reason: key-based lookups drive live panels and feedback context.
Impact if Changed: missing metrics, incorrect coaching signal mapping.

---

## Part 5 — Execution Readiness Summary

Protected Surface Confirmed: **Yes**
Frontend-Safe Fixes Identified: **Yes**
Worker-Dependent Changes Identified: **Yes**
High-Risk Changes Deferred: **Yes**

Overall Risk Level:
- **High** (because session model duality + weak explicit contract boundary)

Ready for Implementation Phase:
- **Yes, conditionally** — only for Protected + Safe Frontend Fix + Additive changes that do not alter worker contract semantics. Worker-dependent items require explicit contract-first design and versioned rollout before coding.
