// Global HCP cue generation instructions — injected into the LLM prompt.
// CRITICAL: Cues must describe OBSERVABLE, PHYSICAL behavior a rep would see in the room.
// They are NOT category labels, internal states, or system classifications.

export const HCP_CUE_INSTRUCTIONS = `HCP CUES (2-3 observable behavioral signals the rep would physically notice in the room):
- label: what a person would physically observe (4-7 words max) — e.g. "glances at watch twice", "leans back, arms crossed", "tone flattens mid-sentence", "picks up pen, poised to write", "cuts eye contact briefly"
- description: one sentence of context on what this cue means for the rep's next move
- CRITICAL: cues must describe VISIBLE, OBSERVABLE human behavior — NOT category labels or internal states
- WRONG examples: "time pressure", "skeptical resistant", "HCP is indicating urgency", "shows operational constraints", "HCP's current concerns"
- RIGHT examples: "checks phone screen mid-conversation", "shifts weight, glances toward door", "voice quickens, shorter answers", "leans forward when trial data mentioned", "pauses, taps pen on desk"
- Source: behavior_state, interaction_pressure, journey_state, or conversation_shift`;