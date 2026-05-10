# Coaching Evidence And RPS Grounding

This note records the external evidence and internal architecture references used to strengthen shared AI coaching prompts across ReflectivAI surfaces.

## External Evidence

### Communication quality and understanding checks
- Agency for Healthcare Research and Quality. Health Literacy Universal Precautions Toolkit, 3rd Edition: Use the Teach-Back Method: Tool 5. Updated 2024.
  - Why it matters: supports chunk-and-check, non-shaming understanding checks, and reteaching when the message was not clearly received.

### Shared decision making and collaborative planning
- National Institute for Health and Care Excellence. Shared decision making (NG197). Published June 17, 2021.
  - Why it matters: supports agenda-setting, aligning options to what matters to the HCP, clear next-step planning, and documenting what was agreed.

### Decision-making under changing evidence
- Evans NJ. A method, framework, and tutorial for efficiently simulating models of decision-making. Behavior Research Methods. 2019;51(5):2390-2404. doi:10.3758/s13428-019-01219-z.
  - Why it matters: reinforces modeling behavior as changing evidence accumulation rather than static script playback.

### Replication-linked switching and active-state behavior
- Devlin R, Marques CA, Prorocic M, et al. Mapping replication dynamics in Trypanosoma brucei reveals a link with telomere transcription and antigenic variation. eLife. 2016;5:e12765. doi:10.7554/eLife.12765.
  - Why it matters: supports the idea that the active state behaves differently from inactive alternatives and that system behavior should be described as state-sensitive rather than fixed.

## Internal Architecture Anchors

### Standalone source of truth
- signal-coach-core/docs/CURRENT_CANONICAL_SOT_STANDALONE.md
  - Use for: canonical capability ownership, rep-only evaluation, ethical boundary, and naming constraints.

### Runtime architecture map
- signal-coach-core/docs/RPS_ARCHITECTURE_MAP.md
  - Use for: describing the Predictive Builder as the active behavioral brain and the surrounding system engine as the governing runtime contract.

## Global Prompting Rules Added
- User-facing coaching should default to narrative, behavior-level evaluation rather than numeric score language.
- Predictive Builder should be described as adapting to changing evidence, observable cues, and pressure shifts.
- The standalone system engine / canonical SOT should remain the governing source of truth for definitions and architecture.
- Coaching should end with a concrete next move, shared next step, or review point whenever appropriate.