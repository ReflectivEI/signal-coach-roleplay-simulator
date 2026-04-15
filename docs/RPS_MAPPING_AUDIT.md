# RPS Mapping Audit

Date: April 15, 2026

## Goal

Verify that the standalone Role Play Simulator is structurally aligned across:

- scenario architecture
- journey stages
- HCP role and persona mapping
- decision orientation
- interaction pressures
- opening scene logic
- cue logic
- simulator runtime behavior
- review/evaluation flow

This audit is focused on system alignment, not cosmetic UI review.

## Current Structural State

### Scenario Taxonomy

The built-in scenario registry is structurally consistent.

Validated by script:

- `scripts/audit-scenarios.ts`
- runnable via `npm run audit:scenarios`

Current built-in family counts in code:

- `initial_access`: 3
- `discovery`: 3
- `clinical_value`: 3
- `objection_handling`: 3
- `adoption_implementation`: 3
- `access_formulary`: 1
- `commitment_close`: 3

Total built-in scenarios currently in code:

- `19`

All enum mappings currently validate with no broken values:

- journey stage
- journey state
- HCP role type
- decision orientation
- persona
- starting behavior state
- interaction pressure
- suggested focus capabilities

### Opening Scene Mapping

The opening scene engine is structurally aligned with the SOT pattern:

1. observable HCP action
2. HCP signal
3. environmental cue

Runtime source:

- `src/lib/openingSceneEngine.ts`

This now correctly maps:

- journey stage -> focal object/activity
- starting behavior state -> interpersonal signal
- decision orientation -> visible support object
- interaction pressure -> environmental interruption or pressure cue

### Cue Mapping

The HCP cue path was previously misaligned.

Before fix:

- the HCP generation response already returned `hcpCue`
- runtime ignored it
- a separate fallback cue generator replaced it
- cue descriptions were blank

After fix:

- the HCP-generated cue is now used if it passes observed-signal validation
- deterministic cue generation remains as fallback
- cue descriptions are now populated from behavior/pressure state
- abstract/internal label language is rejected in cue text

Files:

- `src/lib/hcpResponseGenerator.ts`
- `src/lib/hcpCueGenerator.ts`
- `src/components/simulator/MessageList.jsx`

## Current Global Alignment Findings

### What is aligned

1. The scenario schema itself is coherent.
2. The family/journey-stage structure is coherent.
3. The opening scene system is now close to the intended observational SOT.
4. The cue path is materially better aligned than before.
5. Rep-side capability evaluation remains rooted in the 8 canonical Signal Intelligence capabilities.

### What is still weak

1. Strong-rep conversations in high-pressure scenarios still over-index on discovery instead of conversion.
   - Example: `The Gatekeeper Filter`
   - The HCP is time-constrained and wants relevance fast.
   - The strong-rep proxy still asks long exploratory questions rather than tightening the exchange.

2. The HCP is now more coherent, but the simulator still needs stronger cause-and-effect compression in pressure scenarios.
   - The HCP behavior responds plausibly.
   - The rep-side “best move” still needs harder guidance toward economy, not just inquiry.

3. Full-session QA at scale is still constrained by Groq TPM limits.
   - This is a provider limit, not a simulator architecture issue.
   - The QA harness now falls back deterministically during audit runs so we can keep validating structure and behavior.

## Behavioral QA Signals Seen So Far

### Positive

- `The Data That Doesn't Land` with a strong-rep proxy:
  - stable HCP continuity
  - cue coverage present
  - coherent skepticism
  - no malformed replies

- `The Gatekeeper Filter` with a weak-rep proxy:
  - volatility spikes correctly
  - capability misses correctly broaden
  - HCP exits toward time-protection behavior

### Current concern

- `The Gatekeeper Filter` with a strong-rep proxy:
  - still produces volatility
  - still trends toward missed/diminished performance on:
    - objection navigation
    - conversation control & structure
    - commitment gaining
  - indicates the “strong rep” path is still not enterprise-grade under pressure
  - this is currently a QA proxy quality issue more than an HCP realism drift issue

## Naturalness Hardening Result

The simulator had a specific realism issue where HCP lines slipped into abstract burden/workload phrasing.

Example of prior problem:

- “significant burden”
- “workload”
- “what burden would they absorb”

Global fix now added:

- abstract burden markers trigger a final spoken-naturalness rewrite pass
- rewrite is scenario-bound and deterministic in intent
- no phrase bank or hardcoded response templates were added

File:

- `src/lib/hcpResponseGenerator.ts`

## Open Reconciliation Item

User guidance indicates the desired main-grid count is:

- `18 scenarios + 1 Build Your Own card = 19 visible cards`

Current standalone codebase contains:

- `19 built-in scenarios`, plus the separate Build Your Own card

This does not block runtime hardening, but it should be reconciled before the final product-completion pass.

## Next Hardening Priorities

1. Tighten high-pressure causality so strong-rep behavior produces clearer positive movement.
2. Reduce over-inquiry in time-constrained scenarios.
3. Improve final-review and QA parity once provider limits are less restrictive.
4. Reconcile expected card count vs current built-in scenario catalog.
