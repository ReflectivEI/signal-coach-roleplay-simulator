# Role Play Simulator — Dependency Map (Flawless Mode)

## Scope
Entry point traced from `src/pages/RolePlaySimulatorFlawless.jsx` through direct and transitive local imports, with deterministic engine enforcement active only under `flawlessMode`.

## Dependency Graph (directed)
- `src/pages/RolePlaySimulatorFlawless.jsx` → `src/pages/RolePlaySimulator.jsx`
- `src/pages/RolePlaySimulator.jsx` → `src/utils/index.ts`, `src/components/roleplay/EnterpriseScenarioCard.jsx`, `src/components/ui/select.jsx`, `src/components/ui/input.jsx`
- `src/components/roleplay/EnterpriseScenarioCard.jsx` → `src/components/roleplay/ScenarioCard.jsx`
- `src/components/roleplay/ScenarioCard.jsx` → `src/lib/utils.js`, `src/components/roleplay/RolePlayChat.jsx`, `src/components/roleplay/difficultyStyles.js`
- `src/components/roleplay/RolePlayChat.jsx` →
  - UI: `src/components/ui/button.jsx`, `src/components/ui/input.jsx`
  - Core roleplay engines: `src/components/roleplay/hcpSimulationEngine.jsx`, `src/components/roleplay/hcpDialogueEngine.jsx`, `src/components/roleplay/alignmentEngine.jsx`, `src/components/roleplay/signalIntelligenceSOT.jsx`
  - Runtime control layers: `src/components/roleplay/operationalConstraintGuardrails.js`, `src/components/roleplay/turnContractController.js`, `src/components/roleplay/cueSelector.js`, `src/components/roleplay/turnValidator.js`
  - Behavioral shaping: `src/components/roleplay/scenarioPolicyProfiles.js`, `src/components/roleplay/behavioralInferenceLayer.js`, `src/components/roleplay/transformSafetyHarness.js`, `src/components/roleplay/difficultyStyles.js`
  - Transcript/feedback: `src/components/roleplay/CapabilityFeedbackPanel.jsx`, `src/components/roleplay/AnnotatedTranscript.jsx`, `src/components/roleplay/annotationUtils.js`, `src/components/roleplay/CoachingOverlay.jsx`, `src/components/roleplay/LiveMetricsPanel.jsx`
  - Voice and text normalization: `src/components/roleplay/useVoice.jsx`, `src/components/roleplay/VoiceControls.jsx`, `src/lib/messageNormalization.js`, `src/lib/conversationToneNormalization.js`
  - URL helpers: `src/utils/index.ts`
- `src/components/roleplay/hcpSimulationEngine.jsx` → `src/components/roleplay/hcpDialogueEngine.jsx`
- `src/components/roleplay/alignmentEngine.jsx` → `src/components/roleplay/signalIntelligenceSOT.jsx`
- `src/components/roleplay/operationalConstraintGuardrails.js` → `src/components/roleplay/scenarioPolicyProfiles.js`
- Shared UI utils:
  - `src/components/ui/button.jsx` → `src/lib/utils.js`
  - `src/components/ui/input.jsx` → `src/lib/utils.js`
  - `src/components/ui/select.jsx` → `src/lib/utils.js`

## File Responsibilities
- `src/pages/RolePlaySimulatorFlawless.jsx`: Resilience boundary; hard crash isolation and retry shell.
- `src/pages/RolePlaySimulator.jsx`: Scenario catalog, filters, simulator page orchestration.
- `src/components/roleplay/EnterpriseScenarioCard.jsx`: Card-level scenario display + launch wiring.
- `src/components/roleplay/ScenarioCard.jsx`: Scenario preview + handoff into active roleplay session.
- `src/components/roleplay/RolePlayChat.jsx`: Main runtime orchestrator for turn loop, state transitions, LLM invocation, deterministic post-processing, and session transcript.
- `src/components/roleplay/hcpSimulationEngine.jsx`: Deterministic HCP state machine (state, temperature, severity, scoring, cue banks, transition memory).
- `src/components/roleplay/hcpDialogueEngine.jsx`: Scenario/HCP definitions and baseline cue-dialogue recalibration helpers.
- `src/components/roleplay/alignmentEngine.jsx`: Turn-level capability scoring and qualitative rubric evaluation.
- `src/components/roleplay/signalIntelligenceSOT.jsx`: Canonical capability taxonomy + governance constraints.
- `src/components/roleplay/operationalConstraintGuardrails.js`: Constraint extraction/evaluation and grounded response-safe fallbacks.
- `src/components/roleplay/turnContractController.js`: Deterministic turn obligations (unanswered questions, objections, closure eligibility, response mode/objective).
- `src/components/roleplay/cueSelector.js`: Deterministic cue selection with context alignment and anti-repetition window enforcement.
- `src/components/roleplay/turnValidator.js`: Post-generation validation/retry wrapper around turn contract checks.
- `src/components/roleplay/scenarioPolicyProfiles.js`: Family classification and policy overrides used in runtime gating.
- `src/components/roleplay/behavioralInferenceLayer.js`: Optional inference-based style nudges with bounded influence.
- `src/components/roleplay/transformSafetyHarness.js`: Safety harness for realism rewrites.
- `src/components/roleplay/CapabilityFeedbackPanel.jsx`: Session capability diagnostics rendering.
- `src/components/roleplay/AnnotatedTranscript.jsx`: Transcript annotation display.
- `src/components/roleplay/annotationUtils.js`: Annotation parsing/normalization utilities.
- `src/components/roleplay/CoachingOverlay.jsx`: Real-time coaching intervention triggers.
- `src/components/roleplay/LiveMetricsPanel.jsx`: Runtime metric surface.
- `src/components/roleplay/useVoice.jsx`, `src/components/roleplay/VoiceControls.jsx`: Voice capture/control for rep inputs.
- `src/lib/messageNormalization.js`, `src/lib/conversationToneNormalization.js`: Message hardening and tone normalization.
- `src/components/ui/button.jsx`, `src/components/ui/input.jsx`, `src/components/ui/select.jsx`, `src/lib/utils.js`, `src/utils/index.ts`: Shared UI primitives + utility helpers used by simulator pages/components.
