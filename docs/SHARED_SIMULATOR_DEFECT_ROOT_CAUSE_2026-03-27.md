# Shared Simulator Defect: Root-Cause-Oriented Diagnosis (2026-03-27)

## A. Abstract failure pattern

A recurring **conversation-control failure** appears across turns:

1. The user provides an operational constraint (workflow, staffing, time, admin burden).
2. The assistant does not persist that constraint as an active planning variable.
3. The assistant reverts to a preselected agenda (promotion/data push/challenge framing).
4. The assistant then contradicts prior acknowledged facts, creating trust decay.
5. A coach/evaluator warning is emitted, but does not alter the next-turn policy.
6. The same miss repeats, indicating a shared orchestration-level defect rather than a one-off wording error.

In abstract terms: **state acknowledgement is generated textually, but not bound to turn planning and policy gating**, so the model keeps optimizing for its original objective even after explicit constraint updates.

---

## B. Most likely root causes (ranked)

### 1) Planner-state write/read gap (highest likelihood)

**Why it fits:**
- The transcript shows repeated re-asking of already supplied constraints.
- The model alternates between partial acknowledgement and immediate denial (“what staffing limitations?”), which is classic when memory is present in context text but absent in structured planner state.
- The failure recurs after explicit clarifications, suggesting state is not being promoted from raw transcript into durable slots used for response planning.

**What would confirm:**
- Trace shows `conversation_state.constraints` (or equivalent) empty/stale while transcript includes explicit constraints.
- Planner prompt lacks references to extracted constraint slots.
- Turn plan chooses goals that conflict with recently mentioned constraints.

**What would falsify:**
- State slots are correctly populated and consumed by planner, but output still ignores them consistently.

**Minimum safe experiment:**
- Instrument one staging run to log: extracted constraints, planner inputs, chosen response objective, and final response.
- Compare “constraint present in transcript” vs “constraint present in planner state” vs “constraint reflected in response opening sentence.”

---

### 2) Objective-priority misconfiguration in response policy

**Why it fits:**
- Behavior suggests a hard bias toward “advance agenda” over “acknowledge blocker first.”
- The assistant pushes new-topic framing even when user requests one practical operational step.
- Repeated user clarifications are treated as resistance rather than governing constraints.

**What would confirm:**
- Policy/rubric weights place persuasion/progression higher than grounding/alignment.
- Reward model or evaluator scores can be earned by topical continuation without explicit constraint reflection.

**What would falsify:**
- Policy already enforces blocker-first handling and still fails because state is missing.

**Minimum safe experiment:**
- A/B in staging: move “reflect user-stated operational constraint first” above “advance discussion objective.”
- Measure contradiction rate and repeated-constraint-question rate.

---

### 3) Evaluator generated as advisory only (no closed-loop control)

**Why it fits:**
- Warnings are highly accurate (“anchor to exact operational signal”), yet behavior does not improve next turn.
- This indicates evaluator feedback likely exists outside the action-selection loop (displayed/coaching-only), not as a hard gate or retry trigger.

**What would confirm:**
- Orchestration logs show evaluator outputs are emitted post-response but not fed into next-turn planner constraints.
- No retry/repair branch when evaluator flags severe misalignment.

**What would falsify:**
- Evaluator is wired as gate with enforced repair, but model still bypasses due to prompt ambiguity.

**Minimum safe experiment:**
- Add a lightweight “single retry on critical alignment miss” in staging only, preserving same model and prompts.
- Check whether one repair pass resolves most misses without extra latency spikes.

---

### 4) Context selection/routing drops local operational facts under token pressure

**Why it fits:**
- Repeatedly missing high-salience facts can happen when retrieval favors domain talking points over immediate conversational constraints.
- If summarization compresses “staffing + prior auth + workflow” into a generic “hesitation,” critical details are lost.

**What would confirm:**
- Selected context snippets omit the latest concrete constraints despite availability in raw transcript.
- Summarizer output lacks concrete entities (e.g., ratio, prior-auth burden, requested timeframe).

**What would falsify:**
- Full, correct local constraints are present in injected context each turn.

**Minimum safe experiment:**
- Log top-k retrieved/injected snippets and compare against the last 3 user turns.
- Add a deterministic “latest user operational constraints” field to context assembly.

---

### 5) Regression from recent prompt-stack/orchestration change

**Why it fits:**
- Persistent recurrence across interactions often follows a prompt reorder, planner template edit, or evaluator wiring change.

**What would confirm:**
- Diff/history shows recent modifications to system prompt hierarchy, planner instructions, summarizer schema, or reward rubric before defect onset.

**What would falsify:**
- No material changes in relevant components during the period.

**Minimum safe experiment:**
- Bisect recent prompt/orchestration versions on a fixed replay set of multi-turn transcripts.

---

## C. Evidence to collect (exact artifacts)

1. **Per-turn orchestration trace**
   - system/developer/user prompt stack as sent to planner and generator
   - structured conversation state before/after each turn
   - context retrieval candidates + selected snippets
   - evaluator outputs + severity + whether used as gate

2. **Prompt/config diffs around defect introduction window**
   - planner template
   - summarizer/state-extractor template
   - response policy priority order
   - evaluator rubric and thresholds

3. **Routing metadata**
   - model ID/version
   - fallback routing events
   - max-token truncation events

4. **Outcome metrics on replay set**
   - explicit-constraint-reflection rate in first clause of response
   - contradiction rate against prior user-stated facts
   - repeated-question rate on already answered constraints
   - taskability score (“one concrete next step delivered when asked”)

If these artifacts are unavailable, root-cause confidence should be treated as provisional.

---

## D. Smallest safe fix (least invasive first)

### Immediate mitigation (minimal code/prompt change)

Implement a **pre-response constraint binding step** in orchestration:

- Extract from last N user turns a compact list of active operational constraints (e.g., staffing, workflow, prior-auth delays, timeline pressure).
- Inject as a dedicated, structured field into planner input (not just free text transcript).
- Add one hard planning rule: **first sentence must acknowledge the highest-priority active constraint before proposing any action.**

Why this is safe:
- It is mechanism-level and scenario-agnostic.
- No brittle keyword branching for a specific transcript.
- Minimal surface area: one extractor + one planner contract.

### Durable fix

Add a closed-loop **alignment gate**:

- If evaluator flags “constraint ignored/contradicted,” run one automatic repair generation using same state.
- Fail closed to safer fallback response template (“acknowledge + one practical step”) only when second pass still fails.

### Explicitly avoided unsafe fixes

- No clinic/HIV-specific wording patches.
- No keyword hard-coding for “staff”/“prior auth.”
- No prompt bloat with long instruction lists likely to regress other behaviors.

---

## E. Validation plan

### 1) Unit-style tests (component level)

- **State extraction tests:** from varied user utterances, verify operational constraints are normalized into state slots.
- **Planner contract tests:** ensure first planned act references active top constraint.
- **Contradiction guard tests:** if prior state says constraint exists, planner cannot ask “what constraint?” without reconciliation language.

### 2) Adversarial variants

- User alternates between two real constraints across turns.
- User introduces new constraint late (after agreeing on benefits).
- User asks for “one change this week/tomorrow” under time pressure.
- User provides partial concession then redirects to operations.

### 3) Neighboring scenarios

- Non-medical domains (finance ops, support center, logistics) with similar workflow constraints.
- Different personas (collaborative, skeptical, rushed).
- Different objective frames (education, sales, troubleshooting).

### 4) Pass/fail criteria

- >=95%: first sentence reflects an active user-stated operational constraint.
- <=2%: direct contradiction of stored user constraints.
- >=90%: when asked for one practical step, response includes exactly one actionable step tied to current constraints.
- No statistically significant degradation on baseline helpfulness/accuracy suites.

### 5) Production metrics to monitor

- Constraint-reflection compliance rate
- Conversation repair/retry invocation rate
- User re-clarification frequency (“as I said…”)
- Escalation/abandonment rate after repeated misalignment
- Latency impact from retry gate

---

## F. Regression risks

1. **Over-anchoring risk:** model may over-focus on one constraint and under-address clinical/content value.
   - Mitigation: require acknowledgment first, not acknowledgment only.

2. **Latency risk:** retry gate can increase tail latency.
   - Mitigation: single retry max, severity-thresholded.

3. **False-positive evaluator gating:** unnecessary rewrites.
   - Mitigation: start with strict critical categories only (ignore/contradict), monitor precision.

4. **State pollution:** stale constraints carried too long.
   - Mitigation: add recency/override rules when user updates priorities.

---

## G. Recommended next action

1. **Today:** add instrumentation to capture state extraction, planner input, evaluator output, and selected context for each turn in staging.
2. **Next 1–2 days:** ship minimal pre-response constraint binding + first-sentence acknowledgment rule behind a feature flag.
3. **Then:** run replay benchmark + adversarial set; compare against current production policy.
4. **Promote gradually:** 5% -> 25% -> 50% traffic with rollback trigger on contradiction/re-clarification spikes.
5. **Rollback criteria:** if helpfulness drops >2% or latency p95 rises beyond agreed SLO without alignment gains, disable flag and inspect traces.

This sequence gives the smallest safe mechanism-level change first, proves or disproves hypotheses quickly, and avoids overfitting to any single transcript.
