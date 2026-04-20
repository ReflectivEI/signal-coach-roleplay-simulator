# Current Canonical SOT For Standalone

This memo is the enforceable source of truth for the Standalone Role Play Simulator.

It is aligned to:
- `SINGLE SOURCE OF TRUTH 2.2.26`
- the current live-site product direction
- the current Standalone simulator architecture

This memo separates what is locked from what is derived so realism work, UI polish, and implementation upgrades do not drift into framework or scoring changes.

## Locked

### Signal Intelligence
- Signal Intelligence is a `behavior-based capability framework`.
- AI supports visibility, practice, and coaching.
- AI does not replace human judgment, agency, or accountability.
- The system must not infer intent, personality, emotion, or diagnosis.

### Ethical Boundary
- `If a response would feel inappropriate if the roles were reversed, it is outside the Signal Intelligence boundary.`

### Signal Definition
- A signal is an `observable cue or change in an interaction` that indicates what matters, what is shifting, or what requires a decision in the moment.

### Canonical Capability Order
1. `Signal Awareness` -> `Question Quality`
2. `Signal Interpretation` -> `Listening & Responsiveness`
3. `Customer Engagement Monitoring` -> `Customer Engagement Cues`
4. `Value Connection` -> `Value Framing`
5. `Objection Navigation` -> `Objection Handling`
6. `Conversation Management` -> `Conversation Control & Structure`
7. `Adaptive Response` -> `Adaptability`
8. `Commitment Generation` -> `Commitment Gaining`

### Rep-Side Evaluation Rule
- The rep is the only scored entity.
- The HCP is the deterministic simulation counterpart.
- HCP turns may provide evidence for rep evaluation, but the HCP is not being scored.

### Scoring Integrity Rules
- Evaluation is based on `observable rep behavior`.
- Outcomes do not override behavioral evidence.
- Style preference does not override behavioral evidence.
- One observable behavior should map to one primary capability when possible.
- Signal–Response Alignment is a `derived layer`, not a ninth capability.

### Canonical Metric Labels
- `Question Quality`
- `Listening & Responsiveness`
- `Customer Engagement Cues`
- `Value Framing`
- `Objection Handling`
- `Conversation Control & Structure`
- `Adaptability`
- `Commitment Gaining`

## Derived

These are allowed, but they must remain subordinate to the Locked section.

### Runtime / Simulation Layers
- scenario-family mapping
- stage-aware capability interpretation
- HCP realism backbone
- HCP cue generation
- engagement decay
- interaction-mode shifts
- semantic progression
- terminal behavior / wrap-up pressure
- anti-repetition safeguards
- transcript-grounded session review generation

### Realism Principles
- cue/dialogue alignment
- scenario-context persistence
- selective cooperation
- measured friction
- conditioned responsiveness
- no forced linearity
- tone safety
- no metric skew

### Product Surface
- `Live Chat`
- `Annotated Transcript`
- `End & Get Feedback`
- structured post-session sections grounded in the actual transcript

## Deprecated

Do not use these as authoritative references for Standalone.

- old V2 RPS behavior as a framework source
- old V2 file structure or prompt wording
- sample dialogues as canonical truth
- any wording that implies the product evaluates people rather than observable rep behavior
- any wording that implies HCP-side scoring
- any terminology drift that replaces canonical metric labels with non-canonical display labels

Legacy helper phrasing may still appear in coaching copy, but it does not override canonical names.

Examples:
- `Making It Matter` is helper phrasing, not the canonical metric label
- `Customer Engagement Signals` is legacy wording, not the canonical metric label

## Implementation Guardrails

### Must Not Change Without Explicit SOT Approval
- capability definitions
- capability order
- metric ownership
- rep-only evaluation model
- observable-behavior scoring principle
- ethical boundary
- signal definition

### Allowed Implementation Work
- improve HCP realism
- improve cue specificity
- improve transcript-grounded feedback quality
- improve terminology consistency
- harden regression coverage
- improve late-turn specificity by domain, stage, and pressure

### Prohibited Drift
- realism patches that alter scoring logic
- realism patches that alter capability definitions
- scenario-specific hardcoded behavior used as the primary strategy
- generic fallback language that erases domain, pressure, or concern specificity
- any change that causes cue and dialogue to diverge

### Naming Standard
- Capability name stays canonical.
- Metric name stays canonical.
- Helper phrasing may support coaching copy, but the canonical metric label remains the source of truth.

Current examples:
- Capability: `Value Connection`
- Metric: `Value Framing`
- Helper phrasing allowed: `Making It Matter`

- Capability: `Customer Engagement Monitoring`
- Metric: `Customer Engagement Cues`
- Legacy wording to phase out: `Customer Engagement Signals`

### Standalone Baseline
- `5173` is the current primary candidate baseline.
- Future work should focus on realism polish, terminology consistency, and regression protection.
- Future work should not reopen the architecture, family mapping, scoring math, or rep-only evaluation model unless the SOT itself changes.
