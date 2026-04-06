# Role Play Simulator Architecture Audit Task Template

## Purpose

This template is the first execution artifact for protected simulator work. It is intended for the initial architecture audit branch and for future high-scope simulator tasks.

## Task Title

Role Play Simulator Architecture Audit

## Layer Classification

Architecture

## Business Goal

Reduce simulator fragmentation by identifying the current runtime authority path, boundary violations, legacy paths, and deterministic realism risks before implementation changes begin.

## Protected System Notice

This task touches the Role Play Simulator, which is a protected architecture area.

## Canonical Invariants

- The REP is the human trainee and the only evaluated entity.
- The HCP is deterministic, scenario-bound, system-driven, and never evaluated.
- Preserve cue/dialogue/state synchronization.
- Preserve scenario-bound realism and turn-by-turn causality.
- Preserve canonical Behavioral Metrics semantics.
- Do not introduce generic global fallback behavior.
- Do not introduce scenario-specific hacks for behavior that should generalize globally.
- Do not allow scoring, coaching, or UI layers to co-author HCP behavior.

## Allowed Scope

- Architecture documentation
- File ownership confirmation
- Runtime authority tracing
- Identification of boundary violations
- Identification of legacy/default vs deterministic path splits
- Identification of generic fallback insertion points

## Do Not Touch

- Scenario content
- Coaching copy
- End-session feedback wording
- Manager view behavior
- Predictive preparation logic
- UI styling unrelated to architecture mapping
- Canonical scoring semantics

## Requested Change

Audit the current role play implementation against the Runtime Contract and File Ownership Map, then document:

1. The live HCP turn-authority path
2. Where HCP behavior is currently co-authored by multiple layers
3. Where `RolePlayChat.jsx` violates clean layer boundaries
4. Where legacy/default and deterministic/flawless paths diverge
5. Where generic fallback risk exists
6. Which files should be first-priority refactor targets

## Non-Goals

- No broad code refactor
- No scoring redesign
- No coaching redesign
- No scenario rewrites
- No runtime behavior changes unless explicitly approved in a follow-up task

## Stop Conditions

- If the audit requires speculative fixes rather than architecture tracing, stop and document the gap.
- If a proposed solution depends on generic fallback behavior, reject it.
- If a proposed solution only fixes one scenario rather than a global runtime issue, reject it.
- If the work expands into scoring or coaching redesign, stop and split the task.

## Success Criteria

- The current HCP authority path is documented clearly.
- Boundary violations are listed clearly.
- Legacy and deterministic path divergence points are listed clearly.
- Generic fallback risks are listed clearly.
- The first refactor targets are prioritized.

## Validation

- Findings are traceable back to the Runtime Contract.
- Findings are traceable back to the File Ownership Map.
- No unrelated simulator behavior is modified as part of the audit.
