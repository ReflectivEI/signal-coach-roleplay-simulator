# RolePlay V2 Source-of-Truth Standard (2026-04-01)

This standard is the canonical control plane for V2 rebuild calibration and drift prevention.

## Access link for V2 preview
- Local dev URL: `http://localhost:5173/RolePlaySimulatorV2`
- Backend preview mode enabled with query: `http://localhost:5173/RolePlaySimulatorV2?rpv2_backend=1`
- Env-based enablement: set `VITE_ROLEPLAY_V2_BACKEND_ENABLED=true`

## Non-negotiable source-of-truth commitments
1. Signal Intelligence remains behavior-based and observable only.
2. No emotion or intent inference in scoring or feedback.
3. Rep-side only evaluation: HCP outputs are inputs/signals, never direct score credit.
4. Deterministic HCP cue + dialogue alignment through explicit state transitions and trigger conditions.
5. Single central evaluator for scoring/feedback policy; scenario files declare facts/rules only.

## Canonical scenario contract
All scenarios must instantiate one canonical shape in this exact top-level order:
1. `scenarioIdentity`
2. `trainingIntent`
3. `hcpProfile`
4. `sceneSetup`
5. `hcpStateModel`
6. `deterministicCueLibrary`
7. `dialogueResponseRules`
8. `metricEvidenceMap`
9. `feedbackContract`
10. `testFixtures`

## Layered architecture (must remain separated)
- **Layer 1: Scenario Definition** — declarative facts, rules, cues, metric applicability.
- **Layer 2: HCP State Engine** — deterministic state/cue/dialogue-band transitions.
- **Layer 3: Rep Evidence Extractor** — rep utterance evidence tags only.
- **Layer 4: Scoring/Feedback Engine** — centralized score/rationale/coaching generation.

## Integrity controls
- Metric applicability matrix per scenario (active/conditional/suppressed behavior context).
- Cue/evidence/score separability enforced.
- State transitions must be table-driven with explicit trigger classes.
- Feedback language must cite observed cues/utterance patterns and avoid inferred motive/emotion.
- Golden fixture regression required (strong/weak rep examples, expected HCP reaction, expected metric activation/evidence/score band).

## Implementation reference
- Canonical schema + enums + validator: `src/lib/roleplay-v2/scenarioCanonicalContract.js`
- Contract tests: `test/roleplayV2ScenarioCanonicalContract.test.mjs`
