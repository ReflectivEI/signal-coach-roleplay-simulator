# Roleplay Turn Validation Source Of Truth

Date: 2026-04-07

## 1. Current Architecture

Roleplay turn validation is centralized in `src/lib/roleplay/roleplayTurnValidation.js`. It wraps latest-ask progression classification from `src/components/roleplay/latestAskProgression.js` and returns explicit progression/blocking flags. The live UI path in `src/components/roleplay/RolePlayChat.jsx` calls the shared validator before scoring, state mutation, prompt construction, or HCP generation. The Cloudflare worker boundary in `src/worker.js` also enforces the same validator for non-opening `roleplay: true` LLM invocations.

## 2. Enforcement Points

- UI: `RolePlayChat.jsx` validates rep turns before scoring/state/prompt/HCP generation.
- Worker: `/api/llm/invoke` requires `roleplayTurnValidation` for non-opening roleplay requests before provider selection or provider fetch.
- Opening exception: deterministic scenario-owned opening turns bypass validation because no rep turn exists yet.
- Future roleplay entry points must call `validateRoleplayRepTurn(...)` before any scoring, state mutation, prompt construction, or provider invocation.

## 3. Validation Rules

The validator evaluates the rep turn against the latest HCP ask, previous rep messages, and optional coaching requirement.

Return contract:

```js
{
  valid,
  invalid,
  blockHcpGeneration,
  blockScoring,
  blockStateAdvance,
  latestAskProgression,
  coaching,
  telemetryEvents
}
```

Invalid turns must not generate an HCP response, score as normal progression, or advance dialogue state. Repeated non-answers are blocked. Valid concise answers, valid paraphrases, and repeated wording with meaningful new content must remain allowed.

## 4. Telemetry Events

Events emitted by the shared validation layer:

- `invalid_turn_blocked`
- `repeated_non_answer_blocked`
- `latest_ask_ignored`
- `coaching_requirement_not_met`
- `valid_turn_progressed`

Payloads use stable reason codes and hashed fingerprints for HCP ask / rep message. Do not add raw transcript text to telemetry by default.

## 5. Regression Suite

Minimum validation-related checks:

- `npm run test:roleplay:transcripts`
- `node --loader ./test/jsx-loader.mjs --test test/terminalDisengagementEnforcement.test.mjs`
- `npm run test:stabilization`
- `npm run build`

Key files:

- `test/roleplayTurnValidation.test.mjs`
- `test/roleplayTranscriptReplayHarness.test.mjs`
- `test/roleplayCatalogTranscriptMatrix.test.mjs`
- `test/roleplayWorkerValidationBoundary.test.mjs`
- `test/terminalDisengagementEnforcement.test.mjs`

## 6. Production Monitoring Rules

Review weekly by scenario, concern family, entry point, status, and fingerprints.

Watch most closely:

- high `invalid_turn_blocked` rate: possible over-blocking or weak scenario/HCP ask clarity
- high `latest_ask_ignored` rate: reps may not understand what to answer
- high `repeated_non_answer_blocked` rate: loop prevention is working, but UX/coaching may need review
- `valid_turn_progressed` followed by repeated HCP asks: possible false negative
- any `ROLEPLAY_TURN_VALIDATION_REQUIRED`: entry point is bypassing the validation contract

Add a regression test before changing classifier terms or thresholds.

## 7. Non-Negotiable Constraints

- Validation is the authority; prompts cannot override it.
- Invalid turns must not generate HCP dialogue.
- Invalid turns must not advance dialogue or scoring state as progress.
- No scenario-by-scenario patches for global validation behavior.
- Do not weaken the hard gate to fix one phrase.
- Preserve deterministic, scenario-bound, realism-first behavior.
- No raw transcript content in validation telemetry by default.

## 8. Remaining Known Risks

- Future entry-point bypass if a new roleplay API/client path does not call the shared validator.
- False negatives from broad domain words such as `data`, `patients`, `workflow`, or `criteria` if not paired with action/decision signals.
- False positives for concise expert answers if scenario-specific terminology is missing from classifier maps.
- Coaching enforcement is only as strong as the structured coaching requirement passed into the validator.
- Scenario-family mapping is still partly heuristic until canonical scenario metadata is fully explicit.
