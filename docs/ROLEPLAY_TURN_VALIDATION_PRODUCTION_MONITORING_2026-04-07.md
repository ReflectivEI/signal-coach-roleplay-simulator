# Roleplay Turn Validation Production Monitoring Plan

Date: 2026-04-07

Scope: centralized roleplay turn validation, latest-ask progression, repetition blocking, coaching enforcement, and worker-boundary validation.

This plan assumes the current source of truth is:

- `src/lib/roleplay/roleplayTurnValidation.js`
- `src/components/roleplay/latestAskProgression.js`
- `src/components/roleplay/RolePlayChat.jsx`
- `src/worker.js`
- `test/roleplayTurnValidation.test.mjs`
- `test/roleplayWorkerValidationBoundary.test.mjs`

## 1. Production Monitoring Plan

The validation layer emits structured turn events from the shared validator. These should be treated as the primary production signal for whether the simulator is enforcing conversational progress without over-blocking valid rep behavior.

Required dashboard dimensions:

- `entryPoint`: `RolePlayChat`, `worker:/api/llm/invoke`, or any future API/client path.
- `scenarioId`: scenario identifier or title fallback.
- `turnNumber`: roleplay turn index.
- `family`: `workflow`, `screening`, `evidence`, `access`, or `general`.
- `status`: latest-ask progression status, for example `missed`, `repeated_missed`, `repeated_missed_close`, `workflow_progress`, `evidence_progress`.
- `reasonCodes`: stable validation reason codes.
- `blockHcpGeneration`, `blockScoring`, `blockStateAdvance`: enforcement flags.
- `repeatedRepCount`: count of similar recent rep responses.
- `loopChallenge`: whether the rep challenged repetition, for example “you already asked.”
- `coachingRequirementType` and `coachingRequirementMet`.
- `latestHcpAskFingerprint` and `repMessageFingerprint`: hashed fingerprints only, not raw transcript content.

Do not add raw rep message text or raw HCP dialogue to validation telemetry by default. Use fingerprints to cluster cases, then review transcripts through a controlled debug/audit workflow when needed.

## 2. Recommended Metrics And Dashboards

Core dashboard metrics:

- Block rate: `invalid_turn_blocked / all validation events`.
- Repeated non-answer block rate: `repeated_non_answer_blocked / all validation events`.
- Latest ask ignored rate: `latest_ask_ignored / all validation events`.
- Coaching requirement failure rate: `coaching_requirement_not_met / turns with coachingRequirementType`.
- Valid progression rate: `valid_turn_progressed / all validation events`.
- Close-stage block rate: `status = repeated_missed_close / all validation events`.
- Worker enforcement rate: events where `entryPoint = worker:/api/llm/invoke`.
- Missing-contract rate: `ROLEPLAY_TURN_VALIDATION_REQUIRED / roleplay worker invocations`.

Recommended breakdowns:

- By scenario and scenario family.
- By HCP type or persona category when available.
- By challenge family: `workflow`, `screening`, `evidence`, `access`, `general`.
- By turn bucket: turns `1-2`, `3-5`, `6-10`, `11+`.
- By entry point: UI vs worker/API/alternate client.
- By repeated response count.

Initial review thresholds:

- Alert if `invalid_turn_blocked` exceeds 20% of turns for one scenario family over a meaningful sample, unless that scenario is intentionally remediation-heavy.
- Alert if `latest_ask_ignored` exceeds 35% for a scenario, because the opening/HCP ask may be unclear or too strict.
- Alert if `repeated_non_answer_blocked` exceeds 10% for a scenario, because either the rep prompt UX is failing or the classifier is too narrow.
- Alert if `coaching_requirement_not_met` exceeds 40% for one coaching behavior, because the coaching instruction may not be actionable.
- Alert immediately if `ROLEPLAY_TURN_VALIDATION_REQUIRED` appears from a production worker roleplay path; that means a client or future endpoint is bypassing the validation contract.
- Alert if `valid_turn_progressed` falls below 55% in normal usage, because over-blocking or unclear HCP asks may be likely.

These thresholds are starting points for monitoring, not automatic tuning rules.

## 3. False-Positive / False-Negative Review Plan

Likely false positives, where valid turns may be blocked incorrectly:

- Very concise but correct answers, for example “Start benefits verification now.”
- Valid paraphrases that omit expected vocabulary but clearly address the HCP ask.
- Rep answers that satisfy coaching indirectly, for example reflecting the constraint without using explicit “I hear you” language.
- Repeated wording that adds meaningful new content, such as adding the owner, timing, patient segment, or first handoff.
- Scenario-specific terminology not yet in the concern-family classifier, for example local workflow terms, specialty role names, or payer-process terms.

Detection method:

- Review high-frequency blocked fingerprints grouped by `family`, `status`, and `scenarioId`.
- Sample blocked turns where `repeatedRepCount` is `1` and `status = repeated_missed`; these are most likely to contain borderline valid paraphrases.
- Compare blocked-turn fingerprints against subsequent user correction. If the next turn is accepted with minor wording changes, the original may have been an over-block.

Likely false negatives, where invalid turns may still pass:

- Generic openers that contain enough domain words to look relevant, for example “outcomes data” against an evidence ask.
- Evidence answers that mention “patients” but do not explain what changes in practice.
- Workflow answers that say “process” or “workflow” without naming an action, owner, timing, or next step.
- Access answers that mention “PA” or “coverage” but do not specify a bottleneck-reducing step.
- Screening answers that mention “criteria” but do not specify a checkpoint, review action, or candidacy decision.

Detection method:

- Review `valid_turn_progressed` events with repeated fingerprints or high `loopChallenge` rates.
- Review cases where the next HCP line still asks for the same missing element after a valid event.
- Track repeated `latestHcpAskFingerprint` with multiple `valid_turn_progressed` events but no later terminal/advance status.
- Add regression tests for every confirmed false negative before tuning the classifier.

## 4. Safe Tuning Strategy

Current default repetition threshold is `0.84` token-overlap similarity inside `latestAskProgression.js`. Keep this stable until telemetry shows a reproducible issue across multiple scenarios.

What can be made configurable later:

- Repetition similarity threshold, default `0.84`.
- Recent rep history window, currently last `3` for repeated detection and last `5` for repeated count.
- Repeated close threshold, currently `repeatedRepCount >= 3`.
- Concern-family term maps for `workflow`, `screening`, `evidence`, and `access`.
- Coaching behavior verification rules once coaching requirements are more fully structured.

Safe tuning rules:

- Prefer classifier-specific additions over global threshold changes.
- Do not lower the repetition threshold globally to fix one scenario.
- Do not broaden evidence/decision terms with generic words like `patients` unless paired with a real decision/action connector.
- Add a regression test before every classifier expansion.
- If a term belongs to multiple families, require a second confirming signal before classifying it as progress.
- Treat worker-boundary validation as non-optional; never add a bypass flag for production roleplay generation.

## 5. Review Workflow

Weekly production review for early stabilization:

1. Review dashboard totals for block rate, latest-ask ignored rate, and valid progression rate.
2. Identify the top 10 scenario/family pairs by `invalid_turn_blocked` and `latest_ask_ignored`.
3. Sample clustered fingerprints rather than individual raw transcripts first.
4. Pull controlled transcripts only for fingerprint clusters with high frequency or user-reported friction.
5. Classify each reviewed case as true positive, false positive, false negative, or unclear.
6. For every false positive or false negative, add a targeted test in `test/roleplayTurnValidation.test.mjs` or a scenario-family fixture in `test/roleplayCatalogTranscriptMatrix.test.mjs`.
7. Only then update classifier terms or thresholds.

Trigger a classifier improvement when:

- Three or more reviewed examples show the same valid phrase being blocked.
- A domain-specific term repeatedly appears in corrected accepted turns.
- The same invalid generic phrase repeatedly passes as progress.
- A specific scenario family has high `valid_turn_progressed` but still loops in transcript review.

Trigger threshold review when:

- False positives and false negatives are not tied to specific vocabulary or scenario family.
- A broad set of paraphrases are misclassified across multiple families.
- Repeated-turn clustering shows the `0.84` threshold is consistently too high or too low across varied user language.

Trigger new regression coverage when:

- A live issue reaches production.
- A classifier term is added or removed.
- A new roleplay provider call is added.
- A new roleplay entry point is added.
- A new coaching requirement behavior is introduced.

## 6. Ongoing Regression Maintenance Plan

Minimum suite before merging roleplay validation changes:

- `npm run test:roleplay:transcripts`
- `node --loader ./test/jsx-loader.mjs --test test/terminalDisengagementEnforcement.test.mjs`
- `npm run test:stabilization`
- `npm run build`

Regression areas that must remain covered:

- Latest-ask gating: `test/roleplayTurnValidation.test.mjs`.
- Repetition blocking: `test/roleplayTranscriptReplayHarness.test.mjs` and `test/roleplayTurnValidation.test.mjs`.
- Catalog-family behavior: `test/roleplayCatalogTranscriptMatrix.test.mjs`.
- Coaching enforcement: `test/roleplayTurnValidation.test.mjs`.
- Worker-boundary enforcement: `test/roleplayWorkerValidationBoundary.test.mjs`.
- Terminal close behavior: `test/terminalDisengagementEnforcement.test.mjs`.
- Long-session behavioral stability: `test/longSessionRoleplaySmoke.test.mjs` through `npm run test:roleplay:behavioral`.

Required invariant for future roleplay entry points:

```text
roleplay turn request
→ validateRoleplayRepTurn(...)
→ if invalid: return blocked-turn contract, no scoring, no state mutation, no prompt/provider call
→ if valid: proceed
```

## 7. Remaining Operational Risks In Priority Order

1. Future entry point bypass: a new roleplay endpoint or alternate client could be added without `validateRoleplayRepTurn`. Mitigation: keep `test/roleplayWorkerValidationBoundary.test.mjs` updated and require validation at every roleplay provider gateway.
2. Classifier false negatives from generic domain words: broad terms like `data`, `patients`, `workflow`, and `criteria` can create accidental progress if not paired with action/decision terms. Mitigation: require paired evidence/action signals and add tests for every observed loophole.
3. Classifier false positives for concise expert language: real reps may answer briefly. Mitigation: review blocked fingerprints and preserve concise-answer tests.
4. Coaching enforcement is still partially externalized: the shared validator supports `coachingRequirement`, but future work should pass structured coaching requirements for all coaching prompt types. Mitigation: add behavior-specific tests before expanding enforcement.
5. Telemetry currently uses session/browser and worker console patterns, not a durable analytics warehouse by itself. Mitigation: route `roleplay-simulator-telemetry` and worker `[RoleplayTurnValidation]` events into production observability when that pipeline is available.
6. Scenario-family mapping remains heuristic. Mitigation: complete canonical scenario metadata migration and prefer explicit scenario family tags over prose inference.
