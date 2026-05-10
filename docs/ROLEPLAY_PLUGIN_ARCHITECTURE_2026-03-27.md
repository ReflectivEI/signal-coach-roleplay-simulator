# Role Play Simulator Plugin Architecture (ReflectivAI)

_Date: March 27, 2026_

## 1) Why this architecture fits the current repo

The current platform is a React SPA with a page-level Role Play Simulator route (`RolePlaySimulator`) and an in-repo simulator engine/component stack (`RolePlayChat`, `hcpSimulationEngine`, `alignmentEngine`, etc.), while Cloudflare Worker endpoints provide auth/session and app settings. This makes a **host + plugin-runtime** model the cleanest migration path: keep host responsibilities in the main app and isolate simulator logic behind a strict contract.

Current anchors:
- Host routing/page shell already exists (`src/pages/RolePlaySimulator.jsx`, `src/pages.config.js`).
- Simulator engine is modular but tightly coupled inside `src/components/roleplay/*`.
- Backend worker already has tenant/app feature and session primitives (`src/worker.js`).

## 2) Target architecture (concrete)

Use a **Micro-frontend Plugin Surface + Workflow Callback Contract**.

### 2.1 Ownership boundary

**Host owns**
- Auth/session and tenant resolution.
- Navigation and page shell.
- Scenario persistence, assignment, and reporting stores.
- Enterprise policy controls, audit logs, and analytics sink.

**Roleplay plugin owns**
- Turn engine and persona state transitions.
- Transcript interpretation + behavioral signal extraction.
- Scoring/alignment evaluation.
- Turn-level coaching hints and final session feedback object.

**Shared contract**
- Scenario payload schema.
- Session start/turn/end event protocol.
- Score/evaluation schema.
- Capability/version negotiation.

## 3) Runtime topology

```text
React Host App
  ├─ Plugin Registry (manifest + capability checks)
  ├─ Plugin Loader (dynamic import or remote entry)
  ├─ Simulator Host Adapter (normalizes host data -> plugin contract)
  ├─ Telemetry Bridge (captures plugin events -> analytics/audit)
  └─ RolePlaySimulator Page
        └─ <PluginSlot pluginId="roleplay.simulator" />

Plugin (roleplay-simulator)
  ├─ UI Module (chat, voice controls, metrics panel)
  ├─ Turn Engine
  ├─ Scoring Engine
  └─ Contract Adapters (strict schema validation)

Cloudflare Worker API
  ├─ session/auth endpoints
  ├─ scenario/session persistence endpoints
  ├─ plugin capability + allowlist endpoint
  └─ analytics ingestion endpoint
```

## 4) Plugin contract (v1)

Define a versioned contract namespace:
- `contract`: `reflectiv.roleplay.v1`
- `pluginId`: `roleplay.simulator.core`

### 4.1 Scenario input schema

```ts
interface RoleplayScenarioV1 {
  id: string;
  title: string;
  category: string;
  specialty?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  objective: string;
  context: string;
  openingScene: string;
  persona: {
    name: string;
    role: string;
    mood?: string;
    influenceDriver?: string;
  };
  challenges: string[];
  keyMessages: string[];
  policyProfile?: string; // maps to host policy guardrails
  metadata?: Record<string, unknown>;
}
```

### 4.2 Session state handoff

```ts
interface RoleplaySessionStartV1 {
  tenantId: string;
  userId: string;
  sessionId: string;
  scenario: RoleplayScenarioV1;
  priorTranscript?: TranscriptTurnV1[];
  locale?: string;
  featureFlags?: string[];
}

interface TranscriptTurnV1 {
  turnIndex: number;
  actor: 'rep' | 'hcp' | 'system';
  text: string;
  timestamp: string; // ISO 8601
  tags?: string[];
}
```

### 4.3 Event callbacks (host-facing)

```ts
type RoleplayPluginEventV1 =
  | { type: 'session.started'; payload: { sessionId: string; pluginVersion: string } }
  | { type: 'turn.completed'; payload: { sessionId: string; turnIndex: number; deltaScore?: number } }
  | { type: 'score.updated'; payload: { sessionId: string; capabilityScores: Record<string, number> } }
  | { type: 'feedback.generated'; payload: { sessionId: string; recommendations: string[] } }
  | { type: 'session.ended'; payload: SessionEvaluationV1 }
  | { type: 'error'; payload: { sessionId: string; code: string; message: string; recoverable: boolean } };
```

### 4.4 Final evaluation object

```ts
interface SessionEvaluationV1 {
  sessionId: string;
  completedAt: string;
  outcome: 'pass' | 'needs_coaching' | 'incomplete';
  overallScore: number;
  capabilityScores: Record<string, number>;
  evidence: Array<{
    capability: string;
    turnIndex: number;
    observation: string;
  }>;
  coachingPlan: {
    priorities: string[];
    nextBestActions: string[];
  };
  transcript: TranscriptTurnV1[];
}
```

## 5) Plugin loading and isolation

### 5.1 Manifest

Add a host-side registry manifest (JSON or TS) with:
- `pluginId`
- `contractVersion`
- `entry` (local bundle path or remote URL)
- `permissions` (e.g., `microphone`, `network:llm`, `analytics:emit`)
- `integrity` hash/signature
- `allowedTenants`

### 5.2 Isolation mode

Default to **in-process module federation style** for low-latency UX.
For high-risk tenants, support **iframe sandbox mode** with the same contract over `postMessage`.

### 5.3 Capability negotiation

On load:
1. Host sends `hello` with supported contracts.
2. Plugin responds with `accept` + feature flags.
3. Host either continues, applies compatibility shim, or blocks load.

## 6) Security, auth, and tenant scoping

- Host injects short-lived session token scoped to `tenantId`, `userId`, `sessionId`, and `pluginId`.
- Plugin never receives raw platform-wide credentials.
- Worker validates token claims on every simulator persistence/analytics call.
- Enforce allowlist of plugins per tenant via Worker endpoint.
- Audit all plugin lifecycle events (`loaded`, `started`, `ended`, `errored`).

## 7) Analytics/telemetry contract

Emit standardized events:
- `plugin_load_ms`
- `turn_latency_ms`
- `score_update_count`
- `session_duration_ms`
- `contract_validation_error_count`

Each event must include:
- `tenantId`, `userId`, `sessionId`, `pluginId`, `pluginVersion`, `contractVersion`, timestamp.

## 8) Mapping to this repo (implementation plan)

### Phase 1 — Non-breaking host adapter (1–2 sprints)

1. Create a host adapter around existing `src/components/roleplay/*` to conform to `reflectiv.roleplay.v1`.
2. Add `PluginSlot` to `RolePlaySimulator` page and route all simulator rendering through it.
3. Keep existing engines local; treat them as the first plugin implementation (`roleplay.simulator.core`).

### Phase 2 — Worker contract endpoints (1 sprint)

Add endpoints in `src/worker.js`:
- `GET /api/plugins/manifest`
- `POST /api/roleplay/session/start`
- `POST /api/roleplay/session/event`
- `POST /api/roleplay/session/end`

### Phase 3 — External plugin readiness (2 sprints)

1. Support remote plugin entry + integrity verification.
2. Add iframe sandbox execution mode.
3. Add contract validator (Zod/JSON Schema) on host ingress and worker ingress.

### Phase 4 — Workflow engine integration (optional)

Expose simulator as callable workflow action:
- Input: scenario + learner state
- Output: `SessionEvaluationV1` + artifacts
- Enables assignment/remediation loops from manager/coaching modules.

## 9) Recommended initial file additions (for future PR)

- `src/plugins/contracts/roleplay.v1.ts` — shared interfaces + validators
- `src/plugins/registry.ts` — plugin manifest + loader
- `src/plugins/PluginSlot.jsx` — mount and lifecycle handling
- `src/plugins/hostAdapters/roleplayCoreAdapter.ts` — wraps current simulator
- `src/lib/telemetry/pluginTelemetry.ts` — normalized event emitter
- `src/worker.js` — plugin manifest and session event endpoints

## 10) Compatibility and versioning policy

- Use semver for contract versions.
- Host supports current major + one previous major.
- Plugin must declare exact tested host API range.
- Breaking schema changes require new major (`reflectiv.roleplay.v2`).

## 11) Concrete MVP acceptance criteria

- Host can start/stop a simulator session via `PluginSlot`.
- Plugin emits turn + scoring events that persist through Worker.
- Final evaluation object is stored and visible in analytics/reporting path.
- Contract validation failures are surfaced as non-fatal user-visible errors.
- Tenant can enable/disable plugin by policy without redeploy.

---


## 12) Is this easier/more logical than the current structure?

Short answer: **more logical long-term, slightly harder short-term**.

### Compared to current structure

| Dimension | Current in-repo structure | Plugin-contract structure |
|---|---|---|
| Initial complexity | Lower (single code path) | Higher (contract, loader, validation) |
| Change safety | Lower (cross-cutting edits in app + simulator internals) | Higher (strict boundaries + versioning) |
| Multi-team velocity | Lower (tight coupling) | Higher (host and plugin can evolve independently) |
| Tenant-specific controls | Moderate | High (allowlist, manifest permissions, scoped enablement) |
| External simulator support | Weak | Strong (remote entry / iframe mode) |
| Long-term maintainability | Moderate | High |

### Practical interpretation for this repo

- If your goal is **ship one simulator fast**, current structure is simpler.
- If your goal is **support multiple simulators, safer upgrades, and tenant-level governance**, this plugin structure is more logical.
- The phased plan keeps risk down by wrapping the existing simulator first, so you get architecture benefits without a rewrite.

## Short answer to your question

Yes—this repo is a strong fit for pluginizing role play via a **contract-first plugin slot**. Start by wrapping the existing simulator as the first-party plugin, then progressively add manifest loading, worker-backed event persistence, and (optionally) sandboxed remote plugins.
