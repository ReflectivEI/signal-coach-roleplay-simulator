# RPS Realism Regression Lock Set

This lock set defines the behaviors that must remain stable as Standalone realism continues to improve.

These are not scoring rules. They are regression-protection targets for deterministic HCP cue/dialogue behavior.

## Locked Targets

### Cost-Focused Economic Evaluation
- HCP stays anchored to total cost, patient applicability, and value threshold.
- Late-turn pushback must remain cost-specific, not generic `value` language.
- The HCP should sound like a cost-focused decision-maker, not a generic skeptic.

### Skeptical Specialist Discovery
- HCP preserves expectation mismatch, applicability pressure, and evidence threshold.
- Mid-turn skepticism should become more specific, not merely harsher.
- Cue and dialogue must remain aligned as resistance tightens.

### Workflow Burden
- HCP keeps returning to the concrete staff step, owner, handoff, or monitoring burden.
- Workflow concern must not collapse into vague `burden` or generic practicality language.
- Late-turn pushback must stay operational.

### Access Barrier
- HCP keeps the conversation process-bound: coverage, formulary, approval, committee, or access step.
- Access/formulary scenarios must not drift into generic objection or evidence talk.
- Cue text must stay grounded in paperwork, process notes, or constrained administrative posture.

### Time-Pressured Gatekeeping
- HCP compresses naturally without becoming rude.
- Cue should carry more of the time pressure than the spoken line alone.
- First-turn and late-turn replies must stay short, usable, and specific.

## Global Invariants

- No scenario-specific hardcoded behavior as the primary realism strategy.
- No cue/dialogue mismatch.
- No repetitive objection loops.
- No collapse back into generic chatbot phrasing.
- No drift away from canonical metric labels in the live product surface.
- No realism patch may alter scoring logic or rep-only evaluation.

## Audit Use

Any realism pass should be checked against this lock set before release or deploy-candidate promotion.
