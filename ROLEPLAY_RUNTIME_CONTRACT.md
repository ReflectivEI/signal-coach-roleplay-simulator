# Role Play Simulator Runtime Contract

## 1. Purpose

This contract defines the authoritative runtime rules for the ReflectivAI Role Play Simulator. Its purpose is to ensure the simulator remains deterministic, scenario-bound, behavior-first, and enterprise-stable while preserving realism, causality, scoring integrity, coaching credibility, and manager trust.

## 2. Canonical System Statement

The Role Play Simulator is a protected system for realistic, high-stakes professional practice. It evaluates the human REP's observable behavior in response to a deterministic, scenario-bound HCP. The HCP is system-driven and never evaluated. AI supports simulation, visibility, evaluation, and coaching, but does not replace human decision making.

## 3. Canonical Invariants

The following rules are non-negotiable:

1. The REP is the human trainee and the only entity being evaluated, scored, coached, or rated.
2. The HCP is deterministic, scenario-bound, system-driven, and never evaluated.
3. REP scoring must reflect observable REP behavior relative to:
   - HCP spoken dialogue
   - HCP cues
   - HCP state
   - scenario context
   - turn-by-turn continuity
4. Cue, dialogue, state, and scenario context must remain synchronized.
5. The 8 Behavioral Metrics are canonical and authoritative.
6. Capabilities must remain conceptually distinct, even when a single interaction provides evidence relevant to multiple capabilities.
7. No metric may infer intent, personality, private emotion, or downstream outcome.
8. The simulator must preserve professional trust, credibility, and continued HCP access in the relational sense.
9. Determinism must preserve realism, not replace it with generic consistency.
10. No global generic fallback behavior is allowed.

## 4. Runtime Authority Hierarchy

The simulator runtime must operate in this order of authority:

1. Scenario Contract Layer
2. HCP Brain Layer
3. Validation Layer
4. Scoring / Observation Layer
5. Coaching / Interpretation Layer
6. Presentation Layer

No lower layer may silently override or co-author a higher layer's truth.

## 5. Layer Definitions

### 5.1 Scenario Contract Layer

Defines the legal world of the scenario. It owns:

- HCP identity
- care setting
- opening scene
- scenario pressure profile
- valid concern families
- realistic constraints
- escalation boundaries
- first-turn realism rules
- allowed/forbidden scenario behaviors

It does not generate live HCP behavior directly.

### 5.2 HCP Brain Layer

This is the sole author of HCP turn behavior. It owns:

- active concern
- active constraint
- HCP state
- temperature
- severity
- memory
- continuity thread
- trust/openness/resistance trajectory
- response mode
- turn objective
- closure eligibility
- cue output
- spoken dialogue output

It must produce the next HCP turn from scenario context, prior memory, current state, and REP input.

### 5.3 Validation Layer

Checks whether the HCP output is valid. It may:

- reject invalid outputs
- repair outputs within the same scenario/state/concern contract
- enforce no-repeat and continuity rules
- enforce anti-drift rules
- enforce closure rules
- enforce cue/dialogue alignment

It may not replace invalid output with generic or cross-scenario fallback behavior.

### 5.4 Scoring / Observation Layer

Observes the interaction after runtime truth exists. It owns:

- REP scoring
- canonical Behavioral Metrics evaluation
- alignment rubric derivation
- session scoring
- evidence extraction
- manager-facing analytic derivation

It must never author or steer HCP behavior.

### 5.5 Coaching / Interpretation Layer

Interprets the session after runtime and scoring are established. It owns:

- inline coaching
- end-session feedback
- AI coaching handoff
- manager interpretation
- predictive coaching outputs

It must remain downstream of runtime and scoring truth.

### 5.6 Presentation Layer

Displays simulator outputs. It owns:

- chat rendering
- panels
- overlays
- tabs
- transcript views
- manager-facing presentation

It must not alter simulator behavior or scoring semantics.

## 6. HCP Brain Operating Rules

### 6.1 Single-Authority Rule

The HCP Brain is the only layer allowed to determine what the HCP does next.

### 6.2 Scenario-Bound Rule

Every HCP response must remain grounded in:

- scenario contract
- HCP role
- opening scene
- valid concern families
- current state
- prior turn memory

### 6.3 Causality Rule

Every HCP turn must be visibly downstream of the REP's immediately prior behavior. The simulator must preserve the learning loop:

- REP acts
- HCP interprets that action in context
- HCP state updates
- HCP next response reflects that update

### 6.4 Memory Rule

The HCP Brain must preserve disciplined memory of:

- active unresolved concerns
- answered vs unanswered questions
- prior misses
- prior repairs
- continuity thread
- repeated content
- closure progression

It must not accumulate unbounded narrative sprawl.

### 6.5 Output Synchronization Rule

Cue and spoken dialogue must be emitted from the same state snapshot and must not contradict each other.

### 6.6 Realism Rule

The HCP must feel:

- professionally credible
- context-aware
- memory-consistent
- constraint-aware
- agenda-bearing
- difficult in believable ways

## 7. REP Scoring Rules

1. REP scoring is downstream of runtime truth.
2. The HCP is never scored.
3. Scoring must evaluate observable REP behavior relative to the synchronized HCP signal surface.
4. The 8 Behavioral Metrics must remain canonical.
5. `3` means effective / acceptable.
6. Scoring must not depend on browser-local or session-mutating artifacts that break determinism.
7. A single conversational moment may provide evidence for multiple capabilities, but metric definitions must remain distinct.

## 8. Coaching Rules

1. Coaching must explain what happened in the interaction.
2. Coaching must not rewrite or substitute for runtime truth.
3. Coaching messages must remain traceable to observed interaction evidence.
4. Coaching must not change scoring semantics.
5. Coaching must not influence HCP runtime behavior.

## 9. Manager View Rules

1. Manager outputs must derive from canonical runtime and scoring truth.
2. Manager interpretation must be explainable and traceable.
3. Predictive and developmental insights must not contradict the lived simulation experience.
4. Manager analytics must not rely on unstable or non-canonical simulator behaviors.

## 10. Prohibited Patterns

The following are prohibited:

1. Generic global fallback dialogue
2. Generic global fallback cues
3. Scenario-specific hacks used to solve global runtime failures
4. Prompt-side compensation for missing architecture
5. Scoring-driven HCP behavior changes
6. Coaching-driven HCP behavior changes
7. UI-driven HCP behavior changes
8. Legacy path bypasses that silently override deterministic authority
9. Cue/dialogue/state contradictions
10. First-turn unrealistic escalation not grounded in scenario contract

## 11. Deterministic Realism Standard

Determinism in this simulator means:

- same scenario + same state + same REP input produces the same HCP result
- different scenarios do not collapse into the same generic result
- variation remains scenario-bound and realistic
- consistency does not come at the expense of believable professional behavior

## 12. Change Control Rules

Any simulator-related change must declare:

- layer classification
- exact files allowed to change
- exact files that must not change
- whether it affects HCP runtime directly or indirectly
- whether it is global or scenario-specific
- regression risks
- validation plan

If a change increases fragmentation, weakens causality, or introduces generic behavior, it must be rejected or redesigned.

## 13. Protected System Rule

The Role Play Simulator is a protected system. Any change touching HCP runtime, scoring, coaching derivation, or scenario behavior must be reviewed against this contract before implementation and again before merge.

## 14. Acceptance Standard

A simulator change is acceptable only if it makes the system:

- more coherent
- more deterministic
- more scenario-bound
- more causally believable
- more scoring-consistent
- more explainable for reps and managers

Not merely more polished.
