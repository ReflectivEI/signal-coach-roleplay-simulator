# Comprehensive Audit: Roleplay Simulator Engine & Signal-Response Alignment System

**Date:** March 7, 2026  
**Auditor:** AI Code Analysis  
**Status:** PRODUCTION SYSTEM REVIEW  
**Scope:** hcpSimulationEngine, hcpStateEngine, alignmentEngine, RolePlayChat orchestration

---

## EXECUTIVE SUMMARY

The ReflectivAI roleplay simulator is **well-architected, deterministic, and pedagogically sound**. The system successfully implements a sophisticated behavioral state machine for HCP simulation with a comprehensive 8-capability alignment scoring rubric.

**Key Strengths:**

- ✅ **Fully deterministic** (no randomness) — reproducible, fair scoring
- ✅ **Immutable HCP profiles** — cue and dialogue guaranteed to match state
- ✅ **Observable behavior focus** — scores what reps can see and control
- ✅ **Robust state transitions** — multi-factor escalation/de-escalation logic
- ✅ **Clear separation of concerns** — state engine, alignment engine, simulation engine, orchestration

**Critical Areas Requiring Attention:**

- ⚠️ **Regex pattern detection** — false positives in some scoring conditions
- ⚠️ **Wind-up vs. escalation logic** — severity escalation calculation could be clearer
- ⚠️ **Pattern validation** — some regex patterns overlap and could trigger unintentionally
- ⚠️ **Temperature vs. state coupling** — escalation sequencing needs documentation
- 🔴 **Multiple questions heuristic** — `qc > 2` may be too strict; legitimate multi-part questions penalized

---

## PART 1: ARCHITECTURE OVERVIEW

### System Design Pattern

The system implements a **deterministic behavioral simulation** with three tightly integrated layers:

```text
┌─────────────────────────────────────────────────────┐
│        RolePlayChat (Orchestration Layer)           │
│  - Manages message flow and turn sequencing         │
│  - Triggers state/temp/severity transitions         │
│  - Invokes LLM with locked profile constraints      │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼──────────┐  ┌──────▼──────────┐
│  State Engine    │  │ Alignment       │
│  (State/Temp)    │  │ Engine (Scoring)│
│                  │  │                 │
│ - Transitions    │  │ - 8 Capabilities│
│ - Cues           │  │ - Pattern      │
│ - Directives     │  │   Detection    │
└──────────────────┘  └─────────────────┘
        │                     │
        └──────────┬──────────┘
                   │
┌──────────────────▼──────────────────┐
│  Simulation Engine (Profile Locking) │
│  - Builds immutable HCP profile      │
│  - Constructs LLM system prompt      │
│  - Locks cue/state/dialogue together │
└─────────────────────────────────────┘
```text

### Deterministic Guarantees

**No `Math.random()` anywhere** — all selection uses deterministic hashing:

```js
// From hcpSimulationEngine.jsx:
function hashInt(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Cue selection always uses: sessionId + turnNumber + state + severity
export function selectCue(sessionId, turnNumber, hcpState, severity = 0) {
  const seed = hashInt(`${sessionId}:${turnNumber}:${hcpState}:${severity}`);
  return tier[seed % tier.length];
}
```text

✅ **Impact:** Every turn is completely reproducible. Same session ID + turn = same cue, same HCP state, same dialogue constraints.

---

## PART 2: STATE ENGINE AUDIT

### Structural State Management

**7-state ladder** (ordinal escalation):

```text
neutral (0) → engaged (1) → time-pressured (2) → resistant (3) 
            → boundary-setting (4) → irritated (5) → disengaging (6)
```text

**Transition Logic:**

| Trigger | Escalation | Condition |
| --------- | ----------- | ----------- |
| Profanity/insults (f\*\*k, stupid, idiot, bad doctor) | +2 | Always |
| Authority challenge, demand, self-sabotage | +1 | Always |
| Pressure/repetition (why won't you, come on) | +1 | Only if temp ∈ {stressed, irritated} |
| De-escalation (I understand, fair point) | -1 | Always |

✅ **Strengths:**

- Multiple escalation vectors (hard +2, medium +1, soft +1 with condition)
- De-escalation always available
- State ladder prevents "jumping" (e.g., neutral→irritated in one turn)

⚠️ **Issue 1: Soft Escalation Condition is Uneven**

```js
// From hcpSimulationEngine.jsx (line ~240-250)
const softEscalate = /.../.test(msg);
const tempIsHot = currentTemperature === 'stressed' || currentTemperature === 'irritated';
if (softEscalate && tempIsHot) return HCP_STATES[Math.min(idx + 1, ...)];
```text

**Problem:** Pressure language like "you need to" or "immediately" only escalates if temperature is already hot. This means in a neutral/cold conversation, a rep can repeatedly use demanding language without escalating the HCP state until temperature rises first.

**Example scenario:**

1. Rep: "You should really consider this" (pressure language)
2. HCP: Responds in `stressed` temperature
3. Rep: "You need to commit now" (hard pressure again)
4. **Result:** No additional state escalation since we're still in the same temperature tier

**Recommendation:** Soft escalate +1 should work always on second violation, tracked per turn or globally.

⚠️ **Issue 2: Self-Sabotage Escalation Lacks Context**

```javascript
// Line ~260
const selfSabotage = /\bi don.t (actually |really )?know\b|.../.test(msg);
if (selfSabotage) return HCP_STATES[Math.min(idx + 1, HCP_STATES.length - 1)];
```

**Problem:** A rep saying "I don't actually know the exact number" gets treated the same as "I made that up" — both trigger +1 escalation. The first is honest and humbling; the second is devastating.

**Recommendation:** Distinguish between:

- Honest uncertainty ("I don't actually know the mechanism") → no escalation
- Fabrication admission ("I made that up") → hard escalate +2

### Temperature vs. Severity

**Temperature:** Emotional tone (positive → neutral → stressed → irritated)  
**Severity:** Escalation memory (0=mild, 1=moderate, 2=strong) — selects HCP cue tier

**Current relationship:**

- Temperature and state transition independently
- Severity is computed from alignment + state transitions
- Temperature feeds into HCP dialogue prompt but doesn't directly escalate state

✅ **Strengths:** Clean separation. Temperature doesn't artificially escalate state.

⚠️ **Issue 3: Temperature Escalation Timing**

From RolePlayChat.jsx (line ~180):

```javascript
// Temperature escalates for NEXT turn if HCP disagreed in current turn
if (respondingToTurn.hcpDisagreed) {
  const escalatedIndex = escalateForDisagreement(...);
  nextTemp = TEMPERATURES[clampedIndex];
}
```

**Problem:** HCP disagreement is detected at the **END** of a turn, but temperature escalation applies to the **NEXT** turn. This 1-turn delay may cause:

- Rep doesn't perceive temperature escalation immediately
- Rep's next message is scored against old temperature
- Feeling of "slow responsibility learning"

**Current behavior is pedagogically sound**, but document this lag clearly in coaching overlays.

### Initial State Derivation

```javascript
export function deriveInitialState(scenario) {
  const text = [scenario.title, scenario.description, scenario.details, ...].join(' ').toLowerCase();
  if (/frustrat|overwhelm|busy|rush|...pressed/.test(text)) return 'time-pressured';
  if (/resist|skeptic|doubt|...challenge/.test(text)) return 'resistant';
  if (/hostile|angry|irritat|dismiss/.test(text)) return 'irritated';
  if (/engag|curio|interest|open|recept/.test(text)) return 'engaged';
  return 'neutral';
}
```

✅ **Good:** Scenario metadata drives initial state deterministically.

⚠️ **Issue 4: Keyword Overlap in Regex Patterns**

Example: "I'm resistant to change, but I'm interested in learning more"

- Matches `/resist/` → returns 'resistant'
- Never reaches check for `/interest/`

**Recommendation:** Use first-match-wins is correct, but document ordering assumptions. Consider keyword precedence if tied.

---

## PART 3: ALIGNMENT ENGINE AUDIT

### Scoring Architecture

**8 Capabilities** with **16 sub-metrics** scored deterministically:

| Capability | Sub-Metrics | Scoring |
| ----------- | ------------ | --------- |
| Signal Awareness | Contextual Relevance, Forward Value | avg(CR, FV) |
| Signal Interpretation | Accuracy, Responsiveness | avg(Acc, Resp) |
| Value Connection | Relevance Alignment, Outcome Translation | avg(RA, OT) |
| Customer Engagement | Participation, Cue Response, Momentum, Amplification | avg(P, CR, M, A) |
| Objection Navigation | Non-Defensive, Constructive | avg(ND, C) [if applicable] |
| Conversation Management | Directional Clarity, Adaptive Steering | avg(DC, AS) |
| Adaptive Response | Situational Responsiveness, Adjustment Quality | avg(SR, AQ) |
| Commitment Generation | Next Steps, Customer Ownership | avg(NS, CO) |

**Overall Score:** `avg(all 8 capability scores)` clamped to [1, 5]

✅ **Strengths:**

- Equal weighting prevents gaming (no high-score shortcuts)
- Sub-metrics are concrete and observable
- Asymmetric scoring (e.g., Objection Nav only scored if `hcpState ∈ {resistant, boundary-setting}`)
- Penalties for aggressive/dismissive behavior affect all metrics

⚠️ **Issue 5: Pattern Detection False Positives**

**Problem 1 — "providesEvidence" is too broad:**

```javascript
providesEvidence:
  /\b(data|study|trial|evidence|research|clinical|shows that|demonstrated|published)\b/.test(lc),
```

**False positive case:** Rep says "I understand your clinical skepticism, but here are my data points..."

- Matches `/research/` in "research-backed"
- Triggers `providesEvidence = true`
- Even though it's in a de-escalating context

**Impact:** Can artificially lower Value Connection score in resistant states where evidence without acknowledgment is penalized.

**Recommendation:** Improve pattern to require subject-verb structure: `/(study|trial|data|evidence).*?show(s|ed)?/` instead of loose keyword match.

**Problem 2 — "pitchesTooEarly" false positives:**

```javascript
pitchesTooEarly:
  /\b(our product|our drug|clinical data shows|evidence shows|...)\b/.test(lc) 
  && !/(you mentioned|you said|your concern|based on|given your)/.test(lc),
```

**False positive case:** Rep says "Our research team published findings, given your interest in the disease state..."

- Matches `/our|clinical data/`
- Then checks negative lookahead for `/given your/`
- But the negative lookahead is case-sensitive? No, lc applies first.
- **Actually OK here.**

**But another false positive:** Rep says "Our product works by..." in response to "How does it work?"

- Not actually pitching too early (was asked directly)
- Still triggers penalty

**Recommendation:** Add context that question was asked directly, or track turn context.

⚠️ **Issue 6: "multipleQuestions" threshold at `qc > 2`**

```javascript
multipleQuestions: qc > 2,  // 3+ questions = penalty
singleQuestion: qc === 1,
```

**Problem:** A rep asking "What are your main concerns about efficacy and safety, and how would you want to address them?" is 3 questions grammatically but ONE coherent question.

**Current penalty:** Contextual Relevance -1, Momentum Continuity -2 if in non-engaged state.

**Impact:** Legitimate discovery questions get penalized.

**Recommendation:** Should be `qc > 3` or require question clustering analysis (group related questions).

⚠️ **Issue 7: Severity Independence from Alignment**

```javascript
// From hcpSimulationEngine.jsx (line ~270)
export function transitionSeverity(currentSeverity, alignment, prevState, nextState) {
  if (escalated && lowAlignment) sev = Math.min(sev + 1, 2);
  else if (escalated) sev = Math.min(sev + 1, 2);   // ← Both branches increase
  if (deEscalated && goodAlignment) sev = Math.max(sev - 1, 0);
  return sev;
}
```

**Problem:** Severity always increases on escalation regardless of alignment score. If rep gets low alignment score (1/5), state escalates, AND severity escalates, it compounds the penalty.

**Current outcome:** Rep gets hit twice — lower score + harsher HCP cues next turn.

**This is intentional pedagogically** (teaches consequences), but the logic should be clear:

- State escalates based on message content
- Severity escalates based on communication quality (alignment)

✅ **Actually reasonable**, but document this dual-escalation clearly.

⚠️ **Issue 8: HCP Disagreement Escalation Timing**

From RolePlayChat.jsx (line ~175):

```javascript
// HCP disagreed in turn we just responded to
if (respondingToTurn.hcpDisagreed) {
  // Escalate temperature for NEXT turn
  nextTemp = TEMPERATURES[escalatedIndex];
}
```

**Flow:**

1. Rep responds to HCP
2. HCP generates dialogue (may disagree)
3. Disagreement detected
4. Temperature escalates for **next** turn's HCP response
5. Rep sees cooler HCP in next turn

**Problem:** Rep is responding to the HCP's new (cooler) temperature, but the rep's message was scored against the old (warmer) temperature. This 1-turn lag means:

- Rep can't immediately see consequence of causing disagreement
- Next turn's alignment scoring uses old temperature baseline

**Example:**

1. Rep: "But clinical data shows..." (challenging)
2. HCP (warm): "I appreciate your evidence. Does your company support ongoing training?"
   - Contains mild disagreement ("Does your company support...")
3. **Temperature escalates** for next turn
4. Rep responds to HCP question
5. Rep's response scored against old temperature (from turn 1), not new (turn 3)
6. Rep sees HCP cool off **after** responding

**Recommendation:** Document this 1-turn lag in coaching UI. Consider flagging it: "Your message caused disagreement—next response will be cooler."

### Signal-Response Alignment Rubric

**5 derived checks** (not scored, but flagged if violated):

```javascript
export function computeAlignmentRubric(hcpState, p) {
  const rubricMisalignments = [];

  if (concernDetected && !p.acknowledgesConcern && !p.paraphrasesHcp) {
    rubricMisalignments.push('Concern was raised but not acknowledged...');
  }
  if (engagementDrop && !p.deEscalates && !p.isBrief && p.continuesMonologue) {
    rubricMisalignments.push('Engagement decreased after your response...');
  }
  // ... 3 more rubric checks
}
```

✅ **Good:** These are concrete behavioral signals, not inferences.

⚠️ **Issue 9: Rubric Checks Could Be False Negatives**

**Example:** Rep does de-escalate AND offers next step, but engagement still drops.

Current logic:

```javascript
if (engagementDrop && !p.deEscalates && !p.isBrief && p.continuesMonologue) {
  // Only flagged if ALL conditions true
}
```

**Problem:** If rep de-escalates but is still long-winded, the rubric flag won't fire even though HCP may still be disengaging due to length.

**Recommendation:** Flag should trigger on engagement drop + too long, regardless of de-escalation status:

```javascript
if (engagementDrop && p.isLong) {
  rubricMisalignments.push('Engagement decreased—consider shorter response.');
}
```

---

## PART 4: SIMULATION ENGINE AUDIT

### HCP Profile Locking

**Immutable guarantee:**

```javascript
export function buildHCPProfile({ sessionId, turnNumber, structuralState, temperature, severity }) {
  const lockedCue = selectCue(sessionId, turnNumber, structuralState, severity);
  const toneDirectives = getToneDirectives(structuralState, temperature);

  return Object.freeze({
    structuralState,
    temperature,
    severity,
    turnNumber,
    lockedCue,
    toneDirectives,
  });
}
```

✅ **Excellent:** `Object.freeze()` prevents mutation.

✅ **System prompt** includes the locked cue and constraints, guaranteeing dialogue alignment.

⚠️ **Issue 10: Cue Bank Coverage**

**CUE_BANK** has 7 states × 3 severity tiers × 4 cues = **84 unique cues**.

With **deterministic hashing**, same (session, turn, state, severity) always returns same cue.

**Problem:** Cues are locked **per turn**, meaning the same HCP profile could repeat if:

- Session continues to 100+ turns
- Hash collisions occur
- New scenarios reuse session IDs

**Current mitigation:** Cues are descriptive and state-locked (won't contradict), even if repeated.

**But:** Variety matters for immersion. In long sessions (20+ turns), repetition becomes obvious.

**Recommendation:** Expand CUE_BANK to 6+ cues per tier, or introduce turn-number rotation to increase variety.

### Dialogue Prompt Construction

**System prompt is 800+ lines** — very detailed constraints:

```
EMOTIONAL EXPRESSION RULE:
Your EMOTIONAL STATE is ALREADY COMMUNICATED through the physical cue shown above.
DO NOT verbally express emotions like disappointment, frustration, or irritation in your dialogue.
Instead, your emotional state manifests as BEHAVIORAL changes...

QUESTION FLOW (CRITICAL - STRICTLY ENFORCED):
⚠️ Ask ONLY 1 QUESTION per turn — real HCPs don't interrogate, they converse
```

✅ **Strengths:**

- Clear separation: cue = body language, dialogue = words only
- Explicitly forbids meta-commentary ("I'm disappointed")
- Enforces single-question-per-turn discipline
- Multiple examples of right/wrong dialogue

⚠️ **Issue 11: LLM Instruction Clarity**

**Instruction for time-pressured state:**

```
TONE DIRECTIVE: Be extremely brief. You are busy. Reference time explicitly — 
a patient, a schedule, your pager. 1-2 sentences MAX. Do not elaborate.
```

**Problem:** "Reference time explicitly" is vague. LLM may generate:

- ✅ "I have a patient waiting—what's the bottom line?"
- ❌ "It's 2:30 PM and I have limited time."
- ❌ "I only have 3 minutes." (too literal, breaks immersion)

**Recommendation:** Provide examples:

```
EXAMPLES:
✓ "My patient is waiting. What specifically can you help with?"
✓ "I'm heading into clinic. Can we focus on the key points?"
✗ "It's 2:45 PM and I only have 180 seconds."
```

⚠️ **Issue 12: Opening Message Rules**

```javascript
// From the prompt, isOpening = true case:
if (!isOpening) { // ...history-based response }
else {
  // Opening rules explicitly state: "DO NOT ask the rep any questions"
  // But also: "React to the rep's arrival"
}
```

**Problem:** "React to arrival" is vague. LLM may generate:

- ✅ "Oh, hey. I was just reviewing the patient chart."
- ❌ "I'm tired today. Just so you know."
- ❌ "Hi, come in." (too passive)

**Recommendation:** Provide opening examples:

```
OPENING EXAMPLES (match the physical cue):
For "time-pressured" with "busy" cue:
✓ "I'm between patients. What's on your mind?"

For "resistant" with "skeptical" cue:
✓ "I'm skeptical of new products, but I'm listening."
```

### Punctuation Normalization

```javascript
export function normalizeHcpDialoguePunctuation(dialogue) {
  const questionStarterPattern = /^(Who|What|When|Where|Why|How|Is|Are|...)\b/i;
  // ...
  const isQuestion = questionStarterPattern.test(withoutEndPunct);
  if (isQuestion) return `${withoutEndPunct}?`;
  if (/[?.!]$/.test(sentence)) return sentence;
  return `${withoutEndPunct}.`;
}
```

✅ **Good:** Catches common LLM errors (statements punctuated as "?" or vice versa).

✅ **Word-starter heuristic** is solid (Who/What usually indicate questions).

⚠️ **Issue 13: Edge Case — Rhetorical Questions**

**Input:** "Don't you agree with this approach"

**Processing:**

- Starts with "Don't" → not in pattern
- Doesn't match question starters
- Treated as statement: "Don't you agree with this approach**.**"

**Problem:** Ends with period, but is clearly a rhetorical question.

**Impact:** Changes sentence meaning. Coaching UI reads it as statement when it's actually a (mildly aggressive) question.

**Recommendation:** Add negation starters to pattern:

```javascript
const questionStarterPattern = /^(Who|What|...|Don't|Doesn't|Can't|Shouldn't|Won't|Isn't|Aren't|Doesn't)\b/i;
```

---

## PART 5: ORCHESTRATION (RolePlayChat) AUDIT

### Turn Flow Sequence

**Correct order of operations in hcpSendMessage():**

```
1. Get previous HCP state/temp/severity
2. SCORE rep message against previous state ← (aligned to what rep saw)
3. Transition state based on content
4. Transition temperature based on content  
5. Transition severity based on alignment + state change
6. BUILD NEXT HCP PROFILE (locked state/temp/sev/cue)
7. DETECT HCP DISAGREEMENT in just-generated dialogue
8. ESCALATE TEMPERATURE for next turn if disagreed
9. Lock rep's message + alignment score
10. Return turn data
```

✅ **Excellent ordering.** Alignment scoring happens BEFORE emotional escalation, ensuring rep is scored fairly against what they observed.

⚠️ **Issue 14: State Transition Lacks Memo**

```javascript
const nextHcpState = transitionState(prevState, repMessage, prevTemp);
```

**Problem:** No record of WHY state transitioned. Coaching UI can only show:

- "State changed from neutral to irritated"
- But NOT: "Because you used demanding language + temperature was already stressed"

**Recommendation:** Return transition reason:

```javascript
function transitionState(currentState, repMessage, currentTemperature) {
  // ...
  return { state: newState, reason: 'Hard escalate — profanity detected' };
}
```

Then coaching UI can explain: "Your language escalated the HCP from X to Y because: [reason]"

⚠️ **Issue 15: HCP Dialogue Fallback is Vague**

```javascript
let nextHcpDialogue = "I see. Let me consider that."; // default

try {
  const res = await fetch('/api/llm/invoke', { ... });
  if (res.ok) {
    nextHcpDialogue = (data.response || data.text || data.content || '');
    // Strip stage directions
    nextHcpDialogue = nextHcpDialogue.replace(/\*[^*]*\*/g, '').trim();
  }
} catch (err) {
  console.error('HCP dialogue generation error:', err);
  // Falls through to default
}
```

**Problem:** If LLM fails or times out, fallback dialogue is always the same. Users won't notice the failure (appears as normal HCP response).

**Recommendation:**

```javascript
const generationResult = { dialogue: nextHcpDialogue, source: 'default' };

try {
  const res = await fetch('...', { timeout: 25000 });
  if (res.ok) {
    generationResult.dialogue = processedDialogue;
    generationResult.source = 'llm';
  } else {
    console.warn(`LLM returned ${res.status}`);
  }
} catch (err) {
  console.error('LLM timeout or error:', err);
}

// Later: if (generationResult.source === 'default') { logEvent('llm_failure'); }
```

---

## PART 6: STRENGTHS SUMMARY

| Aspect | Rating | Evidence |
| -------- | -------- | ---------- |
| **Determinism** | ✅ ✅ ✅ | No `Math.random()`, full reproducibility |
| **State Design** | ✅ ✅ ✅ | 7-state ladder, ordinal escalation sensible |
| **Alignment Scoring** | ✅ ✅ | 8 capabilities, clear sub-metrics, observable behaviors |
| **Profile Immutability** | ✅ ✅ ✅ | `Object.freeze()`, locked cue/dialogue |
| **Pattern Detection** | ✅ ✅ | Comprehensive regex, addresses major behaviors |
| **Prompt Quality** | ✅ ✅ | Detailed constraints, clear examples (mostly) |
| **Separation of Concerns** | ✅ ✅ ✅ | Engine responsibilities clear |
| **Pedagogical Design** | ✅ ✅ | Consequences flow logically from behavior |

---

## PART 7: CRITICAL ISSUES BY SEVERITY

### 🔴 HIGH SEVERITY

#### Issue #1: Soft Escalation Only Works When Temp is Hot

**File:** `hcpSimulationEngine.jsx`, line ~250

**Problem:**

```javascript
const softEscalate = /\bjust do it\b|\bwhy won.t you\b|.../;
const tempIsHot = currentTemperature === 'stressed' || currentTemperature === 'irritated';
if (softEscalate && tempIsHot) return ...+1;
```

Rep can repeat demanding language indefinitely without escalating state if temperature is neutral/positive.

**Fix:**

```javascript
// Soft escalate +1 ALWAYS on second occurrence within session
if (softEscalate) {
  // Track cumulative violations
  const recentSoftEscalations = turns.slice(-3).filter(t => 
    /just do it|why won't you/.test(t.repMessage.toLowerCase())
  ).length;
  if (recentSoftEscalations >= 2) {
    return HCP_STATES[Math.min(idx + 1, HCP_STATES.length - 1)];
  }
}
```

**Impact:** Currently allows reps to repeat pressure tactics without consequences. Should escalate state.

---

### 🟡 MEDIUM SEVERITY

#### Issue #2: "multipleQuestions" Threshold Too Low

**File:** `alignmentEngine.jsx`, line ~158

**Problem:**

```javascript
multipleQuestions: qc > 2,  // Penalizes 3+ questions
```

Example: "What are your main concerns about safety, efficacy, and implementation timeline?" = 3 questions grammatically, 1 ask logically. Gets penalized for Contextual Relevance -1.

**Fix:**

```javascript
// Better heuristic: count by interrogative punctuation + lack of conjunctions
const hasConjunctions = /\b(and|or|but|while|if)\b/i.test(msg);
const multipleDisconnected = qc > 3 && !hasConjunctions;
// OR: cluster questions by sentence. Multiple sentences with separate questions = multiple asks
const sentences = msg.split(/[.!?]+/);
const sentenceQuestions = sentences.map(s => (s.match(/\?/g) || []).length);
const multipleQuestions = sentenceQuestions.filter(q => q > 0).length > 1;
```

**Impact:** Currently penalizes legitimate discovery questions in neutral/engaged states.

---

#### Issue #3: Regex False Positives in "providesEvidence"

**File:** `alignmentEngine.jsx`, line ~110

**Problem:**

```javascript
providesEvidence: /\b(data|study|trial|clinical|evidence|research|...)\b/.test(lc)
```

Triggers on "I understand your clinical concerns" or "I appreciate your research approach" — not actually providing evidence.

**Fix:**

```javascript
providesEvidence: /((?:study|trial|data|evidence|research)\s*(?:shows?|demonstrated|indicates?|suggests))/i.test(msg),
```

Requires evidence keyword to be connected to a main verb (shows, demonstrated, indicates).

---

#### Issue #4: Self-Sabotage Pattern Too Broad

**File:** `hcpSimulationEngine.jsx`, line ~260

**Problem:**

```javascript
const selfSabotage = /\bi don.t (actually |really )?know\b|.../.test(msg);
if (selfSabotage) return HCP_STATES[Math.min(idx + 1, HCP_STATES.length - 1)];
```

"I don't actually know the mechanism" (honest) == "I made that up" (fabrication). Both escalate state.

**Fix:**

```javascript
const honestUncertainty = /\bi don.?t actually know|i.?m not sure|i.?d need to check/i;
const obviousFabrication = /\bi made (it|that|this) up\b|i fabricated|that.?s false|i lied/i;

if (obviousFabrication.test(msg)) {
  // Hard escalate +2: serious credibility damage
  return HCP_STATES[Math.min(idx + 2, HCP_STATES.length - 1)];
}
if (honestUncertainty.test(msg) && !obviousFabrication.test(msg)) {
  // No escalation: acknowledgment of limits is good
  return currentState;
}
```

---

### 🟢 LOW SEVERITY

#### Issue #5: Cue Repetition in Long Sessions

**File:** `hcpSimulationEngine.jsx`, CUE_BANK

**Problem:** After 84+ turns (7 states × 3 severity × 4 cues), cues repeat. Players notice.

**Fix:** Expand cues to 8+ per tier, or track previously-used cues and rotate.

---

#### Issue #6: Missing Transition Reason Logging

**File:** `RolePlayChat.jsx`, line ~165

**Problem:** State changes aren't explained to user.

**Fix:** Return transition reason from `transitionState()`.

---

#### Issue #7: LLM Failure Not Transparent

**File:** `RolePlayChat.jsx`, line ~228

**Problem:** Fallback dialogue doesn't indicate LLM failure.

**Fix:** Log `source: 'default'` in turn data, flag in UI if needed.

---

## PART 8: RECOMMENDATIONS

### Immediate ( Refactor in Next Sprint)

1. **Fix soft escalation logic** — demand language should escalate state after second occurrence, regardless of temperature.
2. **Fix multipleQuestions threshold** — change from `qc > 2` to properly detect disconnected questions.
3. **Improve providesEvidence regex** — require evidence keyword to be paired with verification verb.
4. **Distinguish self-sabotage** — honest uncertainty ≠ fabrication.

### Short-term (1-2 Sprints)

1. **Add transition reason logging** — explain to user WHY state/temp changed.
2. **Enhance opening message examples** — provide specific dialogue examples for each state.
3. **Fix rubric false negatives** — flag engagement drop + length, separate from de-escalation success.
4. **Add rhetorical question detection** — improve punctuation normalization.

### Medium-term (Next Quarter)

1. **Expand cue variety** — add 2-4 more cues per severity tier to reduce repetition in long sessions.
2. **Implement transition tracking** — log which transition rule fired for analytics/debugging.
3. **Add LLM failure monitoring** — detect and log when dialogue generation fails silently.
4. **Create transition documentation** — publish clear rules for state/temp escalation as coaching material.

### Strategic (Long-term)

1. **Consider multi-state transitions** — allow occasional state "jumps" on extreme behavior (e.g., severe insult → disengaging immediately).
2. **Add scenario difficulty tuning** — let Scenario Builders set escalation sensitivity per HCP type.
3. **Implement peer comparison mode** — show how other reps handled same scenario (fairness check).

---

## PART 9: VALIDATION CHECKLIST

Use this checklist when deploying changes:

- [ ] All regex patterns tested against 10+ variations (uppercase, contractions, typos)
- [ ] State transitions verified for full ladder (0→6, not jumping)
- [ ] Alignment scores clamped to [1,5] in all paths
- [ ] HCP profile immutable with `Object.freeze()`
- [ ] Cue/dialogue/state always locked together
- [ ] No `Math.random()` anywhere
- [ ] Session reproducibility verified (same session ID = same dialogue)
- [ ] Temperature/severity escalation tested end-to-end
- [ ] Coaching overlay flags verified against alignment rubric
- [ ] LLM prompt reviewed for clarity and example completeness

---

## PART 10: CONCLUSION

The ReflectivAI roleplay simulator is **production-ready** with **excellent pedagogical design**. The system is deterministic, fair, and learner-appropriate. The 8-capability alignment framework is comprehensive and observable-behavior-focused.

**Address Issues #1-4 before next major release** to prevent gaming and fix false positives. The remaining issues are refinements that improve UX and clarity without affecting core functionality.

**Overall Assessment:** ⭐⭐⭐⭐ (4/5)  

- Deduct 1 star for regex false positives and soft escalation context-dependency
- Excellent architecture and pedagogical design
- Minor improvements needed for edge cases and transparency

---

**Audit completed:** March 7, 2026
