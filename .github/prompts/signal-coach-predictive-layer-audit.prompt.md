---
name: Signal Coach Predictive Layer Audit
description: "Audit and refine Signal Coach predictive behavior, cue/dialogue alignment, and rep-only evaluation integrity."
argument-hint: "Describe the predictive-state issue, scenario, transcript behavior, or engine file to inspect"
agent: "Signal Coach Conversational Architect"
---
Audit and, if needed, refine the Signal Coach predictive behavior layer so it stays deterministic, realistic, and aligned with the simulator's runtime contract.

Task input:
${input}

Requirements:
- Start from the controlling predictive surface: `src/lib/hcpBehaviorPrediction.ts`, `src/lib/hcpStateEngine.ts`, `src/lib/hcpCueGenerator.ts`, `src/lib/hcpResponseGenerator.ts`, `src/lib/conversationInit.ts`, `src/lib/capabilityEvaluation.ts`, or the scenario mapping layer.
- Verify that predicted next behavior, HCP dialogue, observable cues, and review language all point to the same practical interaction reality.
- Keep predictive behavior deterministic and grounded in observable rep behavior, scenario context, journey stage, behavior state, and interaction pressure.
- Preserve rep-side only evaluation and keep all scoring grounded in the eight canonical behavior metrics.
- Improve natural dialogue and predictive realism through signal-driven rules, transcript evidence, context persistence, and regression-safe refinements rather than hidden learning or uncontrolled memory.
- Flag any metric drift, HCP-side scoring drift, cue/dialogue mismatch, generic fallback language, or prediction logic that overweights outcome bias or style preference.
- Run the narrowest available validation after edits.

Output:
- Outcome
- Findings or Changes
- Risks
- Grounding
- Validation
- Next step
