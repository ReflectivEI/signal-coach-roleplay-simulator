---
name: Signal Coach Realism Hardening
description: "Harden Signal Coach runtime realism, mapping, and context-aware HCP/REP dialogue without breaking SOT or rep-only evaluation."
argument-hint: "Describe the realism issue, target layer, scenario family, or runtime file to refine"
agent: "Signal Coach Conversational Architect"
---
Refine the Signal Coach roleplay simulator for stronger realism, more natural context-aware dialogue, and tighter runtime alignment.

Task input:
${input}

Requirements:
- Start from the most controlling runtime layer for the requested issue: scenario mapping, opening-scene engine, conversation initialization, HCP response generation, cue generation, predictive behavior engine, state engine, or capability evaluation engine.
- Keep the simulator grounded in the canonical SOT, Signal Intelligence framework, and the eight canonical behavior metrics.
- Preserve rep-side only evaluation. HCP turns may provide evidence, cues, and predictive state, but the HCP must not become the scored entity.
- Improve realism through context retention, selective cooperation, measured friction, objection specificity, stage-aware pressure, and natural HCP/REP dialogue flow.
- Treat HCP cue/dialogue alignment as a hard requirement.
- Avoid scenario-specific hardcoding when a reusable runtime refinement is available.
- Do not change scoring logic, capability ownership, canonical metric labels, or other locked SOT boundaries unless the task explicitly asks for that.
- Update docs only if the code change would otherwise leave the architecture map, mapping guidance, or canonical SOT stale.

Output:
- Outcome
- Changes
- Risks
- Grounding
- Validation
- Next step
