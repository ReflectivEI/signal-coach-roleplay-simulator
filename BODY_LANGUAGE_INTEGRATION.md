# Body Language Integration System — Complete Implementation

## Overview

The Role Play Simulator now generates context-aware body language descriptions that:

- **Match what the HCP says** — Body language descriptions align with the dialogue
- **Respond to question quality** — Cues change based on whether the rep asks pushy, redundant, or poorly-thought-out questions
- **Provide observable coaching signals** — Specific facial expressions, postures, and gestures that help reps recognize emotional states and adjust their approach

## System Architecture

### Component 1: Enhanced Cue Bank (`hcpStateEngine.jsx`)

Location: `src/components/roleplay/hcpStateEngine.jsx` (lines 130-207)

**What it contains:**

- 6-8 detailed body language cues per HCP state
- Observable details: facial expressions, eye contact, posture, gestures, environmental actions
- State-specific cue variations for different emotional intensities

**Example cues:**

```javascript
'time-pressured': [
  "leg bounces with restlessness, eyes on the clock",
  "shoulders raised with tension, checking watch repeatedly",
  "leaning back in chair, brief eye contact while glancing at door"
]

'irritated': [
  "jaw visibly clenches, eyes roll briefly",
  "response delivered while turning away slightly",
  "brief eye contact with sharp, direct gaze"
]

'engaged': [
  "leaning forward with genuine interest, maintaining eye contact",
  "nodding as rep speaks, taking notes",
  "relaxed posture with open body language"
]
```text

### Component 2: Question Quality Analyzer (`hcpStateEngine.jsx`)

Location: `src/components/roleplay/hcpStateEngine.jsx` (lines 213-240)

**Function:** `analyzeQuestionQuality(repMessage, conversationHistory)`

**Detects:**

- **Pushy language**: "now", "immediately", "just do it"
- **Redundancy**: Repeating questions from previous turns
- **Poorly thought-out**: Vague or incomplete suggestions
- **Demanding**: Commands like "Tell me", "Give me", "Prove"

**Returns:**

```javascript
{
  pushy: boolean,
  redundant: boolean,
  poorlyThoughtOut: boolean,
  demanding: boolean
}
```

### Component 3: Contextual Cue Generator (`hcpStateEngine.jsx`)

Location: `src/components/roleplay/hcpStateEngine.jsx` (lines 243-306)

**Function:** `generateContextualCue(sessionId, turnNumber, hcpState, hcpDialogue, repMessage, conversationHistory)`

**Process:**

1. Analyzes HCP dialogue for business keywords if time-pressured
2. Analyzes question quality if HCP is in resistant/irritated state
3. Selects appropriate cues from enhanced CUE_BANK
4. Falls back to base cue if no context indicators

**Returns:** A single contextual body language description that matches the dialogue and question quality

### Component 4: RolePlayChat Integration

Location: `src/components/roleplay/RolePlayChat.jsx` (lines 252-263)

**Integration flow:**

```javascript
// After HCP dialogue is generated (line 235)
const contextualCue = generateContextualCue(
  sid,                    // Session ID for deterministic selection
  nextTurnNumber,         // Turn number
  nextHcpState,           // HCP's emotional state
  nextHcpDialogue,        // What the HCP just said
  repMessage,             // What the rep just asked
  prevTurns               // Conversation history
);

// Use contextual cue instead of static profile cue (line 275)
const nextTurn = {
  ...
  cueBefore: contextualCue,  // Contextual, not base cue
  hcpDialogueBefore: nextHcpDialogue,
  ...
};
```

### Component 5: System Prompt Enhancement

Location: `src/components/roleplay/hcpSimulationEngine.jsx` (lines 499-516)

**New directive:** DIALOGUE-BODY LANGUAGE ALIGNMENT

**Purpose:** Instructs LLM to ensure dialogue matches physical cues

**Key instruction:**
> "Your physical cue describes your observable body language... Your DIALOGUE MUST BE CONGRUENT with this physical expression."

**Examples provided to LLM:**

- If cue shows "frazzled, checking watch" → dialogue references being busy
- If cue shows "jaw clenching, irritated" → dialogue is clipped, brief, direct
- If cue shows "leaning forward, engaged" → dialogue shows genuine curiosity
- If cue shows "arms crossed, resistant" → dialogue expresses skepticism
- If cue shows "turning away, withdrawing" → dialogue signals conversation is ending

## Data Flow

```
1. Rep sends message
   ↓
2. Alignment scored, state transitioned, profile built
   ↓
3. HCP dialogue generated with locked state + temperature
   (LLM receives body language cue to align with)
   ↓
4. POST-DIALOGUE: generateContextualCue() called
   - Analyzes question quality
   - Analyzes dialogue for time-pressure indicators
   - Selects matching body language from CUE_BANK
   ↓
5. Contextual cue stored in turn object
   ↓
6. UI renders: CUES BEFORE → HCP DIALOGUE
   (Rep sees body language, then interprets dialogue)
   ↓
7. Rep observes consistency and adjusts approach
```

## UI Display

**Location:** `RolePlayChat.jsx` (lines 720-725)

**Rendering:**

```jsx
{turn.cueBefore && (
  <div className="flex justify-start pl-1">
    <p className={`max-w-[85%] text-xs italic leading-relaxed px-3 py-1.5 rounded-lg border ${stateColors[turn.hcpStateBefore]}`}>
      {turn.cueBefore}  {/* Now uses contextual cue */}
    </p>
  </div>
)}
{turn.hcpDialogueBefore && (
  <div className="flex justify-start">
    <div className="w-8 h-8 rounded-full bg-slate-200...">HCP</div>
    <div className="...">
      {turn.hcpDialogueBefore}  {/* Aligned with cue above */}
    </div>
  </div>
)}
```

**Visual presentation:**

- Body language appears in smaller, italic text above HCP message
- Color-coded by state (engaged = teal, others = slate)
- Appears BEFORE dialogue so rep can observe then interpret words

## Example Scenarios

### Scenario 1: Rep asks pushy, redundant question

**Input:**

- Rep: "Just tell me now — what are the key clinical outcomes?"
- Previous turn: "What were the clinical outcomes?"
- HCP state: resistant

**System behavior:**

1. `analyzeQuestionQuality()` detects: pushy=true, redundant=true
2. HCP says: "I already mentioned the outcomes in my last response. I need to be direct here — that approach won't work with me."
3. `generateContextualCue()` selects irritated cue: "jaw clenches, eyes roll briefly"
4. **Display:**
   - 💬 *Jaw clenches, eyes roll briefly*
   - **HCP:** "I already mentioned the outcomes in my last response. I need to be direct here — that approach won't work with me."

**Rep insight:** The eye roll + clipped tone shows frustration with repetition; needs better listening.

### Scenario 2: HCP is time-pressured, mentions being busy

**Input:**

- Rep: "When would be a good time to discuss the new data?"
- HCP state: time-pressured
- HCP says: "Look, I'm swamped today. I've got another patient in five minutes."

**System behavior:**

1. HCP dialogue contains "swamped" and "five minutes"
2. `generateContextualCue()` analyzes dialogue for urgency signals
3. Selects time-pressured cue: "leg bouncing with restlessness, glancing repeatedly at watch"
4. **Display:**
   - 💬 *Leg bouncing with restlessness, glancing repeatedly at watch*
   - **HCP:** "Look, I'm swamped today. I've got another patient in five minutes."

**Rep insight:** The body language matches the time pressure message; need to be brief and respectful of time.

### Scenario 3: Well-thought-out question to engaged HCP

**Input:**

- Rep: "I noticed your clinic uses XYZ protocol. How has that been working in practice?"
- HCP state: engaged
- Question quality: normal (not pushy, not redundant)

**System behavior:**

1. `analyzeQuestionQuality()` detects no issues (thoughtful question)
2. HCP says: "Great question. We've actually seen good outcomes with it. The approach has really streamlined our patient flow."
3. `generateContextualCue()` selects engaged cue: "leaning forward with genuine interest, maintaining eye contact"
4. **Display:**
   - 💬 *Leaning forward with genuine interest, maintaining eye contact*
   - **HCP:** "Great question. We've actually seen good outcomes with it. The approach has really streamlined our patient flow."

**Rep insight:** Positive body language + openness shows receptiveness; rep's thoughtful approach is working.

## Files Modified

### 1. `hcpStateEngine.jsx`

- **Enhanced CUE_BANK** (lines 130-207): Expanded from 4 to 6-8 cues per state with detailed, contextual descriptions
- **analyzeQuestionQuality()** (lines 213-240): New function to detect question quality issues
- **generateContextualCue()** (lines 243-306): New function to generate context-aware body language
- **selectCue() signature** (line 308): Updated to accept optional context parameters for backward compatibility

### 2. `hcpSimulationEngine.jsx`

- **System prompt enhancement** (lines 499-516): Added DIALOGUE-BODY LANGUAGE ALIGNMENT directive
- Instructs LLM to ensure dialogue matches physical cues
- Provides concrete examples of alignment
- Emphasizes coaching effectiveness through consistency

### 3. `RolePlayChat.jsx`

- **Import enhancement** (line 19): Added `generateContextualCue` import
- **Dialogue flow integration** (lines 252-263): After HCP dialogue generation, calls `generateContextualCue()` with full context
- **Cue replacement** (line 275): Uses `contextualCue` instead of `nextProfile.lockedCue`
- **UI already supported cue display** (lines 720-725): Body language rendered before dialogue

## Commits

1. **6b88414**: "Enhance Role Play Simulator body language: Match HCP expressions to dialogue + detect pushy/redundant questions"
   - Enhanced CUE_BANK with detailed descriptions
   - Added analyzeQuestionQuality() and generateContextualCue() functions

2. **8cd9c46**: "Integrate contextual cue generation into RolePlayChat dialogue flow"
   - Imported generateContextualCue into RolePlayChat.jsx
   - Integrated call after dialogue generation
   - Uses contextual cue instead of base cue

3. **b8a729e**: "Add dialogue-body language alignment directive to HCP system prompt"
   - Added DIALOGUE-BODY LANGUAGE ALIGNMENT section
   - Provided examples for LLM to follow
   - Emphasized consistency importance

## Testing Checklist

- [ ] Body language descriptions appear before HCP dialogue in chat
- [ ] Frazzled/rushed cues display when HCP says "busy"
- [ ] Irritation cues display for pushy/redundant questions
- [ ] Engaged cues display for thoughtful questions
- [ ] Cue colors match state (teal=engaged, slate=other)
- [ ] Dialogue matches body language tone (e.g., frustration + clipped speech)
- [ ] Multiple turns show varying cues based on question quality
- [ ] System falls back to base cues for edge cases
- [ ] No console errors related to contextual cue generation
- [ ] Build completes without cue-related errors

## Performance Considerations

**Deterministic selection:** `generateContextualCue()` uses deterministic hashing (sessionId + turnNumber) as fallback, not randomness. Ensures reproducible coaching moments even with multiple identical questions.

**No additional API calls:** Contextual cue generation is entirely local (no external API). Uses only the dialogue already generated by the LLM.

**Minimal overhead:** CUE_BANK selection is O(1) lookup. Dialogue analysis uses simple regex patterns.

## Pedagogical Value

The body language integration serves three key coaching functions:

1. **Observable signal detection**: Reps learn to read actual HCP cues (jaw tightening, eye rolling, checking watch) rather than just hearing words.

2. **Consistency detection**: When body language and dialogue align, it teaches reps that people are congruent. When misaligned (if rep encounters it in real life), it's a red flag.

3. **Emotional state recognition**: Repeated exposure to the same emotional states + body language combinations trains reps to recognize and respond to HCP emotional states in real conversations.

## Future Enhancement Opportunities

1. **Dynamic cue intensity**: Scale cue intensity based on severity or temperature escalation
2. **Facial expression synthesis**: Add actual 3D character model with matching facial expressions
3. **Gesture playback**: Animate body language descriptions with timed gesture support
4. **Cultural variation**: Adapt cues based on HCP culture/background (eye contact norms, personal space)
5. **Rep emotional state**: Show rep's own body language in response to HCP state/dialogue
6. **Analytics integration**: Track which body language patterns correlate with high alignment scores

## Summary

The body language integration transforms the Role Play Simulator from a dialog-only coaching tool into a multi-modal realistic practice environment. Reps now see what an actual HCP looks like alongside what they say, enabling more authentic skill development in reading emotional cues and adjusting sales approach accordingly.

Body language is now:

- ✅ Context-aware (matches dialogue and question quality)
- ✅ Observable (specific facial expressions, postures, gestures)
- ✅ Aligned (LLM instructed to match dialogue to cues)
- ✅ Integrated (displayed before relevant dialogue in chat)
- ✅ Responsive (changes based on rep's question quality)
