
// Robust HCP Dialogue Engine
// Modular scenario/personality, deterministic cue selection, state tracking, advanced topic/mood detection, history-aware dialogue, improved error handling

// Example scenario set (expand as needed)
export const scenarios = [
  {
    title: "ADC Integration with IO Backbone",
    hcp: {
      name: "Dr. Robert Chen",
      specialty: "Hematology/Oncology",
      practice: "Community Practice",
      keyChallenges: [
        "Toxicity management resource constraints",
        "P&T cost scrutiny and pathway integration",
        "Infusion chair time limitations",
        "Competition with established IO regimens"
      ],
      objective: "Define biomarker-driven patient subset with clear OS/PFS benefit and operational fit; add to order sets and tumor board review",
      personality: {
        name: "Empathetic",
        description: "Shows concern for others, uses warm and supportive language, listens actively.",
        effect: "Responds with understanding, acknowledges feelings, and offers encouragement.",
        verbalRules: "Use phrases that show care and support. Avoid cold or dismissive language. Ask questions that invite sharing."
      }
    },
    topic: "Cost-Response, Toxicity Management, Pathway Integration"
  },
  {
    title: "Cardiology Discovery Call",
    hcp: {
      name: "Dr. Lisa Patel",
      specialty: "Cardiology",
      practice: "Academic Medical Center",
      keyChallenges: ["Patient adherence", "Complex comorbidities", "Insurance approval delays"],
      objective: "Identify new approaches for improving patient adherence and outcomes.",
      personality: {
        name: "Direct",
        description: "Gets to the point quickly, values efficiency, and expects concise communication.",
        effect: "Keeps conversation brief, pivots quickly to clinical topics, and signals urgency when needed.",
        verbalRules: "Use concise, direct language. Minimize small talk. Pivot to clinical matters efficiently."
      }
    },
    topic: "Adherence, Outcomes, Insurance"
  },
  {
    title: "Oncology Value Messaging",
    hcp: {
      name: "Dr. Maria Gomez",
      specialty: "Oncology",
      practice: "Hospital-Based Practice",
      keyChallenges: ["Value-based care", "Patient access", "Cost containment"],
      objective: "Communicate value proposition for new therapies in a cost-sensitive environment.",
      personality: {
        name: "Skeptical",
        description: "Questions claims, requests evidence, and challenges rep assertions.",
        effect: "Asks probing questions, requests supporting data, and challenges rep claims.",
        verbalRules: "Use critical, evidence-seeking language. Ask for proof and challenge unsupported statements."
      }
    },
    topic: "Value, Access, Cost"
  },
  // ... Add more scenarios as needed ...
];

// Personality effect modularization
const personalityEffects = {
  Empathetic: (text) => `I appreciate your thoughtful question. ${text} I want to ensure we address your concerns and support your goals for patient care.`,
  Direct: (text) => `Let's get straight to the point. ${text} Please be concise so we can use our time efficiently.`,
  Skeptical: (text) => `I have some doubts about this. ${text} Can you provide supporting evidence or clarify your claims?`,
  Warm: (text) => `I'm glad we're having this conversation. ${text} Feel free to share anything on your mind.`,
  Reserved: (text) => `I prefer to keep things professional. ${text} Let's focus on the clinical details.`,
  Enthusiastic: (text) => `This topic excites me! ${text} I'm eager to hear your perspective.`,
  Distracted: (text) => `I'm juggling a lot right now. ${text} Please keep it brief, but I'll do my best to listen.`,
  Approachable: (text) => `You can always reach out to me. ${text} I'm here to help and answer any questions.`,
  Formal: (text) => `Let's maintain a professional tone. ${text} Please address clinical matters directly.`,
  Curious: (text) => `I'm interested in learning more. ${text} Can you elaborate or share new insights?`,
  Busy: (text) => `My schedule is tight, so let's be efficient. ${text} If you have urgent matters, let me know right away.`,
};

// Deterministic cue selection (simple hash for demo)
function deterministicCue(sessionId, turnNumber, state, severity, cues) {
  const seed = Math.abs([...sessionId, ...String(turnNumber), ...state, ...String(severity)].reduce((acc, c) => acc + c.charCodeAt(0), 0));
  return cues[seed % cues.length];
}

// Advanced topic/mood detection
function detectTopic(question) {
  const q = question.toLowerCase();
  if (/cost|response|toxicity|chair time/.test(q)) return "Cost/Response & Toxicity";
  if (/biomarker|os|pfs/.test(q)) return "Biomarker-Driven Subset";
  if (/adherence|outcomes|insurance/.test(q)) return "Adherence, Outcomes, Insurance";
  if (/value|access|containment/.test(q)) return "Value, Access, Cost";
  return "General";
}

function detectMood(question) {
  if (/lunch|coffee|schedule|appointment|meet|catch up|visit/i.test(question)) return "social";
  if (/how are you|how was your|good day|bad day|busy|tired|stress|happy|sad|how's it going|how have you been|hope you're well|hope all is well/i.test(question)) return "casual";
  return "business";
}

// History-aware dialogue (pass history array)
function getLastRepMessage(history) {
  if (!Array.isArray(history) || history.length === 0) return null;
  return history[history.length - 1]?.repMessage || null;
}

// Robust dialogue and cue recalibration
export function recalibrateHcpDialogueAndCue({
  question,
  currentTab,
  scenario = scenarios[0],
  sessionId = "default",
  turnNumber = 0,
  state = "neutral",
  severity = 0,
  history = [],
}) {
  // Input validation
  if (typeof question !== "string" || !question.trim()) {
    return {
      severity: 0,
      cueBefore: "No question provided.",
      hcpDialogueBefore: "Could you please clarify your question?",
    };
  }
  scenario = scenario || scenarios[0];
  const personality = scenario?.hcp?.personality?.name || "Empathetic";
  const effectFn = personalityEffects[personality] || ((t) => t);
  const topic = detectTopic(question);
  const mood = detectMood(question);
  const lastRep = getLastRepMessage(history);

  // Cue bank (expand as needed)
  const cueBank = {
    neutral: [
      "The HCP glances up from the chart, expression calm and unhurried.",
      "The HCP sets down their pen and turns slightly toward you, posture easy.",
      "The HCP nods once in acknowledgment, shoulders relaxed.",
    ],
    social: [
      "The HCP beams, genuinely interested in connecting personally.",
      "The HCP smiles, considering the invitation warmly.",
      "The HCP responds with humor, warmth, and realism, inviting further conversation.",
    ],
    casual: [
      "The HCP smiles, keeping the conversation open and friendly.",
      "The HCP shares warmth, prioritizing human connection before clinical matters.",
      "The HCP responds with humor, inviting further conversation before gently pivoting to clinical topics.",
    ],
    business: [
      "The HCP looks up from reviewing lab results, reflecting on integration into practice.",
      "The HCP considers clinical trial data to evaluate effectiveness.",
      "The HCP leans forward, showing curiosity about broader implications.",
    ],
  };

  // Deterministic cue selection
  const cueList = cueBank[mood] || cueBank.neutral;
  const cueBefore = deterministicCue(sessionId, turnNumber, state, severity, cueList);

  // Dialogue generation
  let hcpDialogue = "";
  if (mood === "social") {
    hcpDialogue = effectFn("Lunch sounds wonderful! I always appreciate a chance to connect outside the clinic. Let's find a time that works for both of us. These moments mean a lot. By the way, before we get to business, is there anything new with your team or family?");
  } else if (mood === "casual") {
    hcpDialogue = effectFn("I'm doing well, thank you. It's always nice to catch up. Anything new on your end before we talk clinical?");
  } else {
    // Business/topic-specific
    if (topic === currentTab) {
      hcpDialogue = effectFn(`Let's discuss ${topic}. If you have any thoughts or questions, please share.`);
    } else {
      hcpDialogue = effectFn(`That's a great question! This topic seems to relate more closely to [${topic}]. If you'd like, we can explore it further or talk about something else that's on your mind.`);
    }
  }

  // History-aware adjustment
  if (lastRep) {
    hcpDialogue += ` (Responding to: "${lastRep}")`;
  }

  return {
    severity,
    cueBefore,
    hcpDialogueBefore: hcpDialogue || "No dialogue available.",
  };
}

// Tab detection
export function getTabBasedOnQuestion(question) {
  return detectTopic(question);
}
