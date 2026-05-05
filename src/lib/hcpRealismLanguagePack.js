import { requireRealismContract } from "@/lib/scenarioInputResolver";

function normalizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function deterministicScore(seed = "") {
  return Array.from(String(seed || "")).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function deterministicPick(items = [], seed = "") {
  if (!Array.isArray(items) || !items.length) return null;
  return items[deterministicScore(seed) % items.length];
}

function unique(items = []) {
  return Array.from(new Set((items || []).filter(Boolean).map((item) => normalizeText(item))));
}

function buildExampleMatrix(openers = [], responses = []) {
  const examples = [];
  for (const opener of openers) {
    for (const response of responses) {
      const combined = normalizeText(`${opener} ${response}`);
      if (combined && !examples.includes(combined)) {
        examples.push(combined);
      }
    }
  }
  return examples.slice(0, 36);
}

const JOURNEY_STAGE_SEEDS = {
  initial_access: {
    openers: [
      "I've got a few minutes before my next patient.",
      "I'm listening, but I'm between visits right now.",
      "Okay, but I need the short version.",
      "I can give you a minute here.",
      "If this lands on my office, I need to know that up front.",
      "I don't have time for a long setup.",
    ],
    responses: [
      "What are you here to cover?",
      "If this is about prior auth, that's been one of the bigger headaches for my staff.",
      "If you're here about access, that's usually where this gets stuck for us.",
      "Tell me the practical reason I should make time for this.",
      "Keep it focused and get to the point.",
      "Start with the part that's actually relevant to my office.",
    ],
  },
  early_discovery: {
    openers: [
      "That's fair, but the bottleneck isn't always where people think it is.",
      "The problem usually starts after the visit.",
      "I'm not sure I'd call it one issue.",
      "If you're asking where it breaks down, it isn't always the same place.",
      "The issue isn't always clinical.",
      "What I see in clinic and what the staff runs into after that are not always the same thing.",
    ],
    responses: [
      "It's usually documentation and follow-up that stack up on us.",
      "A few smaller delays keep piling on top of each other.",
      "That depends on the patient and the payer.",
      "The friction tends to show up once the office tries to move the case.",
      "It usually looks simple at the visit, then gets messy once the paperwork starts.",
      "That's the part I usually need people to understand first.",
    ],
  },
  clinical_value: {
    openers: [
      "The data matters, but I need to know which patient this actually changes.",
      "I don't need the whole study.",
      "That sounds interesting, but I'm trying to decide whether it changes anything real.",
      "I'm not against the data.",
      "If this doesn't change who I'd treat or when I'd treat, then it's hard to use.",
      "Tell me where this actually changes the treatment decision in the room.",
    ],
    responses: [
      "Tell me what applies to my patients.",
      "What's the one finding that should make me reconsider what I'm doing now?",
      "Is this a meaningful clinical difference or just a statistical one?",
      "I need the part that changes practice, not the part that looks good on a slide.",
      "If the patient in front of me wouldn't be managed differently, then the rest is hard to use.",
      "Show me what this changes in real care.",
    ],
  },
  objection_handling: {
    openers: [
      "We've heard similar claims before.",
      "That may be true, but it doesn't solve the problem I'm dealing with.",
      "I'm not pushing back to be difficult.",
      "That answer is still a little too high-level for me.",
      "I'm not arguing the point.",
      "If you want me to rethink this, you need to get more concrete than that.",
    ],
    responses: [
      "I need you to be specific.",
      "Tell me what's actually different here.",
      "What would actually change in my office?",
      "I need the practical answer, not the headline.",
      "That still sounds like the broad version of the story.",
      "If this doesn't solve the part that's been getting in the way, then we're in the same place.",
    ],
  },
  access_formulary: {
    openers: [
      "The issue isn't whether I like it.",
      "If it's non-preferred, my staff is going to hit a wall.",
      "Prior auth is where good intentions go to die sometimes.",
      "The access piece is usually where the plan falls apart for us.",
      "If the payer step is still a mess, I need the honest version of that.",
      "I don't need the sales version of access.",
    ],
    responses: [
      "It's whether patients can actually get it.",
      "Tell me what support exists before my team spends another hour on paperwork.",
      "If access is still a fight, I need to know that up front.",
      "This only matters if the office can actually get people through the process.",
      "I need the office version of what happens next.",
      "If this stays stuck at formulary, then the rest of the conversation is academic.",
    ],
  },
  adoption_implementation: {
    openers: [
      "Who does what after I decide to use it?",
      "What changes for my MA on Monday morning?",
      "I don't want another process that sounds simple but lands on my staff.",
      "Implementation is usually where these things get harder than they sound.",
      "If this adds work after the visit, that's where I need clarity.",
      "I can see the idea.",
    ],
    responses: [
      "Walk me through the actual handoff.",
      "Where does this fit into what we already do?",
      "If I say yes to this, I need to know who owns the next step.",
      "Tell me where this actually lives in the day-to-day workflow.",
      "I just need to know how it works in the office.",
      "Don't make my staff discover the hard part after the fact.",
    ],
  },
  commitment_close: {
    openers: [
      "I'm not committing today.",
      "Send me the one-page version.",
      "If you can show me the workflow piece clearly, I'll take another look.",
      "I'd need my staff to weigh in before I say yes.",
      "I'm not closing the door.",
      "If you want me to keep this moving, make the next step easy to act on.",
    ],
    responses: [
      "I'll look at something concise.",
      "Make sure it answers the access question.",
      "Give me the practical next step, not the full deck.",
      "I need the next step to feel workable.",
      "If this moves forward, it has to be on a realistic path.",
      "Don't make it bigger than it needs to be.",
    ],
  },
};

const INTERACTION_PRESSURE_SEEDS = {
  time_constrained: {
    openers: [
      "I've got about two minutes.",
      "Give me the short version.",
      "I'm not going to sit through a long setup.",
      "I'm between patients right now.",
      "Keep this tight for me.",
      "Start with the one thing that matters here.",
    ],
    responses: [
      "What's the point you need me to hear?",
      "Be specific.",
      "I need the practical point first.",
      "Use the minute well.",
      "Don't make me dig for the real point.",
      "If this matters, I should hear it quickly.",
    ],
  },
  operationally_constrained: {
    openers: [
      "My staff is already stretched.",
      "That sounds like it adds steps unless you can show me otherwise.",
      "If this lands on my MA, it's going to be a problem.",
      "The office doesn't have room for another manual step right now.",
      "If this creates one more callback, we'll feel it.",
      "My question is where the work actually goes.",
    ],
    responses: [
      "Where does the work actually come out of the process?",
      "I need to understand the office workflow impact.",
      "Tell me who picks this up once it leaves the room.",
      "If the office has to absorb this, then I need the honest version of that.",
      "Don't tell me it is simple if my staff is still doing the cleanup.",
      "I need to know what step drops off, not just what sounds better.",
    ],
  },
  skeptical_resistant: {
    openers: [
      "I've heard versions of this before.",
      "That sounds good, but I'm not convinced yet.",
      "I'm not saying no, but I'm not there yet.",
      "I've seen this story before.",
      "I'm not going to move on this just because it sounds promising.",
      "You're going to have to earn the next step here.",
    ],
    responses: [
      "What's different this time?",
      "You're going to have to be more specific than that.",
      "Tell me what really changes.",
      "That still sounds like the broad version of the pitch.",
      "I need you to close the gap between the claim and the reality.",
      "Don't give me the smooth version. Give me the real one.",
    ],
  },
  competitive_bias: {
    openers: [
      "We're pretty comfortable with what we use now.",
      "Our current process isn't perfect, but we know how it works.",
      "I'd need a strong reason to disrupt what we're doing.",
      "Changing the workflow is not a small ask for us.",
      "I'm not looking to swap out something familiar without a real advantage.",
      "We already know where our current approach breaks down.",
    ],
    responses: [
      "Why would I switch from something my team already understands?",
      "What makes this worth changing?",
      "If I'm moving away from what we're already doing, the reason has to be clear.",
      "You need a stronger reason than new if you want me to change this.",
      "Show me the part that is materially better, not just newer.",
      "I need a reason that survives once the rep leaves the room.",
    ],
  },
  safety_concern: {
    openers: [
      "Before we talk access, I need to understand the safety piece.",
      "I don't want surprises after starting someone.",
      "If there is a safety tradeoff, I need that in plain language.",
      "The safety question is the first thing I need settled.",
      "I need the safety answer before I get pulled into the rest of the conversation.",
      "Tell me who you would be careful with here.",
    ],
    responses: [
      "What should I be watching for?",
      "Is there anything that would make you hesitate in certain patients?",
      "Which patients are not a good fit?",
      "Talk to me about where you would slow down or think twice.",
      "What would make you pause before using this?",
      "I need the version you would actually say to a colleague.",
    ],
  },
  access_barrier: {
    openers: [
      "The access piece is usually where this falls apart.",
      "If patients can't get it, the rest doesn't matter.",
      "My concern is whether this creates more back-and-forth.",
      "If this still gets stuck at approval, I need to know that now.",
      "This doesn't help much if the patient can't get through the payer step.",
      "I need the honest version of what access really looks like.",
    ],
    responses: [
      "How often are offices actually getting this approved?",
      "What happens when it gets denied?",
      "If this is still getting denied, the office feels that immediately.",
      "Talk to me about what happens when the straightforward case isn't so straightforward.",
      "I need to know where the process usually stalls out.",
      "If access is still a fight, the office has to plan for that.",
    ],
  },
  curious_uncertain: {
    openers: [
      "I'm open to hearing it, but I need it grounded.",
      "I haven't formed an opinion yet.",
      "I'm not opposed, I just need to understand it better.",
      "I'm listening, but I need it anchored to something real.",
      "I'm open, just not fully there yet.",
      "I can stay with this if it gets more concrete.",
    ],
    responses: [
      "That's interesting. What's the practical takeaway?",
      "Show me where this fits.",
      "Help me understand where this changes the day-to-day decision.",
      "Give me the version that would matter in practice.",
      "I just need the part that actually lands in the room.",
      "I don't need the polished version. I need the usable one.",
    ],
  },
  commitment_pressure: {
    openers: [
      "I'm not ready to decide today.",
      "I need a cleaner next step.",
      "I'd need to see how this works operationally first.",
      "Let's not jump to a decision before the access piece is clear.",
      "I don't want to overcommit before I see how this lands in practice.",
      "The next step has to be small enough to actually happen.",
    ],
    responses: [
      "What would you want me to do after this conversation?",
      "If we're moving toward a next step, I need it to feel realistic.",
      "I'm not closing the door. I just need this to be more concrete.",
      "Tell me the next move in a way my office could actually use.",
      "The next step has to survive once the visit is over.",
      "Make the ask small enough that it could actually happen next week.",
    ],
  },
};

export const HCP_REALISM_LANGUAGE_PACK = {
  journeyStage: Object.fromEntries(
    Object.entries(JOURNEY_STAGE_SEEDS).map(([key, value]) => [key, buildExampleMatrix(value.openers, value.responses)])
  ),
  interactionPressure: Object.fromEntries(
    Object.entries(INTERACTION_PRESSURE_SEEDS).map(([key, value]) => [key, buildExampleMatrix(value.openers, value.responses)])
  ),
};

export const JOURNEY_STAGE_LANGUAGE = HCP_REALISM_LANGUAGE_PACK.journeyStage;
export const INTERACTION_PRESSURE_LANGUAGE = HCP_REALISM_LANGUAGE_PACK.interactionPressure;

const TOPIC_LANGUAGE = {
  prior_auth: [
    "Yes, prior auth has definitely been one of the bigger headaches for the office lately.",
    "If you're here about prior auth, that's where we keep losing time.",
    "Prior auth has been a mess for the team lately.",
    "That prior auth piece has been the part my staff keeps feeling.",
    "If this is about prior auth burden, that's a real issue for us.",
    "Prior auth is usually where the day starts slipping for the office.",
  ],
  access: [
    "Yes, access has been where this keeps getting stuck for us.",
    "If you're talking about access, that's still the hard part.",
    "The access piece has been the bigger problem on our side.",
    "If this is about getting patients through the process, that's where we keep running into trouble.",
    "Access has been the part that stalls out for us.",
    "If this is about coverage or formulary, that's still very much the issue.",
  ],
  workflow: [
    "Yes, workflow has been one of the bigger pressure points for the office.",
    "If this is about workflow, that's where my staff feels it most.",
    "The workflow side is still the part that's causing the most drag for us.",
    "If you're asking about office burden, that's definitely part of the problem.",
    "Workflow is where this usually stops being simple for us.",
    "That workflow piece is what keeps coming back up in the office.",
  ],
  study: [
    "Yes, that study follow-up has still been in the back of my mind.",
    "If this is about the data, I need the practical version of it.",
    "The study question is still there for me. I just need it grounded.",
    "If you're following up on the data, that's fair. I haven't had time to go back through it.",
    "The evidence piece is still worth talking about if it changes something real.",
    "If this is about the study, I need the part that actually applies to my patients.",
  ],
  safety: [
    "Yes, safety is one of the first things I need to get clear on.",
    "If this is about safety, that's the part I need answered cleanly.",
    "The safety question is still the one I need to settle first.",
    "If you're here about safety, let's start there.",
    "Safety is where I need the most clarity before anything else.",
    "If this is a safety conversation, I need the plain version first.",
  ],
  patient_fit: [
    "Yes, figuring out the right patient is still one of the harder parts here.",
    "If this is about patient fit, that's still not fully clear for me.",
    "The patient-selection piece is still one of the main questions for us.",
    "If you're asking where this fits, the right patient is the real issue.",
    "Patient fit is still the part I need to get tighter on.",
    "If this is about who actually makes sense for it, that's where I still have questions.",
  ],
  general: [
    "Yes, that's still one of the issues on our side.",
    "If this is about the main issue here, that's still been a sticking point for us.",
    "That's still one of the more practical problems on our end.",
    "If you're getting into the real-world part of this, that's where things get harder.",
    "That issue has definitely been coming up on our side.",
    "If this is the practical piece, then yes, that's still part of the problem.",
  ],
};

const FORBIDDEN_PATTERNS = [
  /\bi appreciate you sharing that\b/gi,
  /\bthat is an important consideration\b/gi,
  /\bcan you provide more information\b/gi,
  /\bfrom a workflow perspective\b/gi,
  /\bthis is a significant burden\b/gi,
  /\bi would be interested in learning more\b/gi,
  /\blet'?s explore that further\b/gi,
  /\bthat is helpful, but\b/gi,
  /\bfrom an access standpoint\b/gi,
];

function splitSentences(text = "") {
  return normalizeText(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function joinSentences(sentences = []) {
  return normalizeText((sentences || []).filter(Boolean).join(" "));
}

function inferTopicFromText(text = "") {
  const normalized = normalizeText(text).toLowerCase();
  if (/prior auth|prior authorization|paperwork|approval|coverage/.test(normalized)) return "prior_auth";
  if (/formulary|non-preferred|access|payer|committee|coverage/.test(normalized)) return "access";
  if (/workflow|staff|handoff|callback|process|office|ma\b|medical assistant/.test(normalized)) return "workflow";
  if (/study|trial|data|guideline|evidence|readout/.test(normalized)) return "study";
  if (/safety|tolerability|adverse|watch for|hesitate/.test(normalized)) return "safety";
  if (/patient fit|right patient|which patients|subgroup|profile/.test(normalized)) return "patient_fit";
  return "";
}

export function inferHcpScenarioTopic(scenario = {}, repMessage = "") {
  return (
    inferTopicFromText(repMessage) ||
    inferTopicFromText(`${scenario?.objective || ""} ${scenario?.openingScene || ""} ${scenario?.description || ""} ${(scenario?.interactionPressure || []).join(" ")}`) ||
    "general"
  );
}

function stageExamples(journeyStage = "") {
  return JOURNEY_STAGE_LANGUAGE[journeyStage] || JOURNEY_STAGE_LANGUAGE.initial_access;
}

function pressureExamples(interactionPressures = []) {
  return unique(
    (Array.isArray(interactionPressures) ? interactionPressures : [])
      .flatMap((pressure) => INTERACTION_PRESSURE_LANGUAGE[pressure] || [])
  );
}

function topicExamples(topic = "") {
  return TOPIC_LANGUAGE[topic] || TOPIC_LANGUAGE.general;
}

function buildCompositeExamples({
  journeyStage = "initial_access",
  interactionPressures = [],
  scenarioTopic = "general",
}) {
  const stage = stageExamples(journeyStage);
  const pressures = pressureExamples(interactionPressures);
  const topic = topicExamples(scenarioTopic);
  const composites = [];

  for (let index = 0; index < Math.min(stage.length, 6); index += 1) {
    const stageLine = stage[index];
    const topicLine = topic[index % topic.length];
    const pressureLine = pressures.length ? pressures[index % pressures.length] : "";
    composites.push(joinSentences([topicLine, pressureLine || stageLine]));
    composites.push(joinSentences([stageLine, pressureLine]));
  }

  return unique(composites);
}

export function pickHcpRealismExamples({
  scenario = {},
  journeyStage = "",
  interactionPressures = [],
  behaviorState = "",
  scenarioTopic = "",
  repIntentType = "",
  hcpTurnCount = 0,
  repMessage = "",
} = {}) {
  const resolvedJourney = journeyStage || scenario?.journeyStage || "initial_access";
  const resolvedPressures = Array.isArray(interactionPressures) && interactionPressures.length
    ? interactionPressures
    : Array.isArray(scenario?.interactionPressure)
      ? scenario.interactionPressure
      : [];
  const resolvedTopic = scenarioTopic || inferHcpScenarioTopic(scenario, repMessage);
  const seed = [
    scenario?.id || scenario?.title || "scenario",
    resolvedJourney,
    resolvedPressures.join("|"),
    behaviorState,
    repIntentType,
    hcpTurnCount,
    resolvedTopic,
  ].join("|");

  const pools = [
    topicExamples(resolvedTopic),
    stageExamples(resolvedJourney),
    pressureExamples(resolvedPressures),
    buildCompositeExamples({
      journeyStage: resolvedJourney,
      interactionPressures: resolvedPressures,
      scenarioTopic: resolvedTopic,
    }),
  ];

  const examples = [];
  pools.forEach((pool, poolIndex) => {
    if (!pool.length) return;
    for (let index = 0; index < Math.min(pool.length, 2); index += 1) {
      const picked = deterministicPick(pool, `${seed}|${poolIndex}|${index}`);
      if (picked && !examples.includes(picked)) {
        examples.push(picked);
      }
    }
  });

  if (hcpTurnCount > 0) {
    return examples.filter((example) => !/^If this is about\b/i.test(example)).slice(0, 8);
  }

  return examples.slice(0, 8);
}

export function buildHcpRealismNotes({
  journeyStage = "",
  interactionPressures = [],
  scenarioTopic = "",
  repIntentType = "",
  hcpTurnCount = 0,
} = {}) {
  const notes = [
    "The HCP is speaking out loud in a real office, not writing polished feedback.",
    "Keep the language spoken, compressed, and grounded in workflow, staff, patients, or access realities when relevant.",
    "Avoid corporate transitions, reflective coaching language, and broad summary phrases.",
  ];

  if (hcpTurnCount <= 0) {
    notes.push("On the first HCP response, acknowledge what the rep actually said instead of sounding like a reset line.");
  }
  if ((interactionPressures || []).includes("time_constrained")) {
    notes.push("Under time pressure, stay brief and direct without turning rude or mechanical.");
  }
  if ((interactionPressures || []).includes("operationally_constrained")) {
    notes.push("When operational pressure is active, name the staff task, callback, paperwork, handoff, or next step directly.");
  }
  if (journeyStage === "clinical_value") {
    notes.push("In clinical value discussions, make the clinical threshold or patient-fit question explicit instead of summarizing the study.");
  }
  if (journeyStage === "access_formulary") {
    notes.push("In access/formulary discussions, sound process-aware and realistic about approval friction.");
  }
  if (repIntentType === "follow_up") {
    notes.push("When the rep is following up, do not revert to first-time proxy framing.");
  }
  if (scenarioTopic && scenarioTopic !== "general") {
    notes.push(`Keep the first response explicitly anchored to ${scenarioTopic.replace(/_/g, " ")} when it is part of the rep opener or scenario setup.`);
  }

  return notes;
}

function resolveRealismLevel(context = {}) {
  const scenario = context?.scenario || {};
  const level = requireRealismContract(
    context?.realismLevel ?? scenario?.runtimeTemperature,
    "hcp realism context",
  );
  if (level <= 3) return { level, tier: "low" };
  if (level >= 8) return { level, tier: "high" };
  return { level, tier: "mid" };
}

/**
 * Enforce HARD DISCRETE tier-based behavioral branching.
 * Each tier has distinct response structure, not just wording swaps.
 * This ensures clear behavioral differentiation between 2/5/9.
 */
function enforceRealismTierTone(sentences = [], { tier = "mid", interactionPressures = [] } = {}) {
  const list = [...(sentences || [])].filter(Boolean);
  if (!list.length) return list;

  let first = list[0];
  const constrained = (interactionPressures || []).includes("time_constrained");

  // ─── LOW TIER (1–3): Cooperative, direct, minimal friction ─────────────────────
  if (tier === "low") {
    // LOW tier: Accept framing, answer directly, minimal pushback
    // Strip all resistance language completely
    first = normalizeText(first)
      .replace(/\bI'?m not convinced\b|\bnot convinced\b/gi, "I can work with this")
      .replace(/\bwon't move\b/gi, "could move")
      .replace(/\bdoesn'?t move\b/gi, "could move")
      .replace(/\bprove\b/gi, "show")
      .replace(/\bI need you to\b/gi, "Help me")
      .replace(/\bThat still\b/gi, "That's")
      .replace(/\bI'm skeptical\b|\bI'm guarded\b/gi, "I'm open");

    // LOW: Always start with open/cooperative signal
    if (!/\bI'?m open|I can work with|I can listen|I'm willing|practically|let me test|let me see/i.test(first)) {
      first = `I'm open to this if it stays practical. ${first.replace(/^I'?m open to this if it stays practical[.,]? ?/i, "").replace(/[.?!]+$/g, "")}.`;
    }

    // LOW: Make second sentence even more cooperative if exists
    if (list[1]) {
      list[1] = normalizeText(list[1])
        .replace(/\bneed something more specific\b/gi, "need one concrete example")
        .replace(/\bnot convinced\b/gi, "willing to look")
        .replace(/\bprove\b/gi, "show")
        .replace(/\bI'd need\b/gi, "Give me")
        .replace(/\breject\b/gi, "question");

      // LOW: Ensure second sentence expresses willingness to test/try
      if (!/\btest|try|see|look|willing|work/i.test(list[1])) {
        list[1] = `Give me one concrete example and I can test it in practice.`;
      }
    }

    // LOW: Add positive closing if response is short
    if (list.length === 1 && first.length < 100) {
      first = `${first} Let me see how this works in practice.`;
    }
  }

  // ─── MID TIER (4–6): Selective skepticism, requires clarity ──────────────────────
  else if (tier === "mid") {
    // MID: Balanced skepticism, not automatic rejection
    // Replace extreme resistance with qualified interest
    first = normalizeText(first)
      .replace(/\bI'?m open to this if it stays practical\b/gi, "I can listen, but this needs to be specific")
      .replace(/\bI'm not convinced yet\b/gi, "I'm skeptical, but I'm listening")
      .replace(/\bwon't move\b/gi, "could move if")
      .replace(/\bcompletely reject\b/gi, "push back on")
      .replace(/\bprove it\b/gi, "make the case")
      .replace(/\byou need to convince me\b/gi, "I need specificity");

    // MID: Require evidence but not harshly
    if (!/\bI can listen|I can work with|skeptical but|specific|concrete|evidence|data/i.test(first)) {
      first = `I can listen, but this needs to be specific for my practice. ${first.replace(/^I can listen[.,]? ?/i, "").replace(/[.?!]+$/g, "")}.`;
    }

    // MID: Second sentence should challenge assumptions, not accept
    if (list[1]) {
      list[1] = normalizeText(list[1])
        .replace(/\bI'm open\b/gi, "I'm questioning")
        .replace(/\bI can work with this\b/gi, "I need specificity")
        .replace(/\bGive me one concrete example\b/gi, "But what about...")
        .replace(/\bI'm willing\b/gi, "I need evidence that");

      // MID: Ensure second sentence introduces a challenge or condition
      if (!/\bbut|require|evidence|specific|condition|assume|depend/i.test(list[1])) {
        list[1] = `But I need to understand how this changes what I'm already doing.`;
      }
    }
  }

  // ─── HIGH TIER (7–10): Strong resistance, demands specificity ────────────────────
  else if (tier === "high") {
    // HIGH: Strong resistance, interrupt weak logic, demand specificity
    // Replace all softening language with sharp pushback
    first = normalizeText(first)
      .replace(/\bI'?m open\b/gi, "I'm not convinced")
      .replace(/\bI can listen\b/gi, "I'm not convinced")
      .replace(/\bcould move\b/gi, "won't move")
      .replace(/\bI'm skeptical but listening\b/gi, "I'm skeptical and doubt this works")
      .replace(/\bI need specificity\b/gi, "You need to prove this")
      .replace(/\bI'm questioning\b/gi, "I'm rejecting the premise");

    // HIGH: Always start with clear resistance signal
    if (!/\bI'?m not convinced|won't move|prove|reject|demand|direct answer|specific|interrupt/i.test(first)) {
      first = `I'm not convinced yet. ${first.replace(/^I'?m not convinced[.,]? ?/i, "").replace(/[.?!]+$/g, "")}.`;
    }

    // HIGH: Time pressure adds urgency/interruption
    if (constrained && !/\bminute|time|brief|short|now|immediately/i.test(first)) {
      first = `${first} I don't have time for the long version.`;
    }

    // HIGH: Force second sentence as strong demand or deflection
    if (!list[1]) {
      list[1] = constrained
        ? "Give me the direct answer or I'm done here."
        : "You need to make a compelling case, and I don't see it yet.";
    } else {
      list[1] = normalizeText(list[1])
        .replace(/\bI can\b/gi, "You need to")
        .replace(/\bGive me\b/gi, "Prove to me")
        .replace(/\bI'm willing\b/gi, "I will not");

      // Ensure second sentence sounds like escalating demand
      if (!/\bprove|demand|reject|won't|not|direct answer|specific/i.test(list[1])) {
        list[1] = `Without specificity, this conversation is done.`;
      }
    }
  }

  list[0] = normalizeText(first);
  return list;
}

function buildTopicAcknowledgment({
  topic = "general",
  interactionPressures = [],
  behaviorState = "",
  repMentionedTopic = false,
  hasPriorContextSignal = false,
}) {
  const lowerBehavior = normalizeText(behaviorState).toLowerCase();
  const constrained = (interactionPressures || []).includes("time_constrained");
  const skeptical = (interactionPressures || []).includes("skeptical_resistant") || /closed|skeptical|guarded|resistance/.test(lowerBehavior);
  const pool = topicExamples(topic);
  let line = deterministicPick(pool, `${topic}|${interactionPressures.join("|")}|${behaviorState}|${repMentionedTopic}|${hasPriorContextSignal}`) || TOPIC_LANGUAGE.general[0];

  if (!repMentionedTopic && /^Yes,/i.test(line)) {
    line = line.replace(/^Yes,\s*/i, "If this is about ");
  }

  if (repMentionedTopic && /^If this is about\b/i.test(line)) {
    line = line.replace(/^If this is about [^,]+,\s*/i, "Yes, ");
  }

  if (constrained && !/\bminute|short version|few minutes|practical\b/i.test(line)) {
    line = joinSentences([line, skeptical ? "Keep it focused for me." : "Give me the practical version."]);
  }

  return line;
}

function topicIsAcknowledged(firstSentence = "", topic = "") {
  const normalized = normalizeText(firstSentence).toLowerCase();
  if (!topic || topic === "general") return normalized.length > 0;
  if (topic === "prior_auth") return /\bprior auth|authorization|approval\b/i.test(normalized);
  if (topic === "access") return /\baccess|formulary|coverage|payer|approval\b/i.test(normalized);
  if (topic === "workflow") return /\bworkflow|staff|office|callback|handoff|process|ma\b/i.test(normalized);
  if (topic === "study") return /\bstudy|trial|data|evidence|guideline\b/i.test(normalized);
  if (topic === "safety") return /\bsafety|watch for|hesitate|fit\b/i.test(normalized);
  if (topic === "patient_fit") return /\bpatient|subgroup|fit|profile\b/i.test(normalized);
  return normalized.length > 0;
}

function cleanAssistantPhrasing(sentence = "") {
  let output = normalizeText(sentence);
  output = output
    .replace(/\bI appreciate you sharing that\b/gi, "Okay, but be specific")
    .replace(/\bThat is an important consideration\b/gi, "That's part of the issue")
    .replace(/\bCan you provide more information\b/gi, "Can you be more specific")
    .replace(/\bFrom a workflow perspective\b/gi, "In the office")
    .replace(/\bThis is a significant burden\b/gi, "That's been a real headache")
    .replace(/\bI would be interested in learning more\b/gi, "I'm open to hearing more")
    .replace(/\bLet'?s explore that further\b/gi, "Go a step further")
    .replace(/\bThat is helpful, but\b/gi, "That's helpful, but")
    .replace(/\bFrom an access standpoint\b/gi, "On the access side");
  return output;
}

export function validateHcpHumanRealism(text = "", context = {}) {
  let output = normalizeText(text);
  const issues = [];
  if (!output) return { text: output, issues };

  const {
    scenario = {},
    repMessage = "",
    interactionPressures = [],
    behaviorState = "",
    turnCount = 0,
    hasPriorContextSignal = false,
  } = context;
  const realism = resolveRealismLevel(context);

  const topic = inferHcpScenarioTopic(scenario, repMessage);
  const repMentionedTopic = Boolean(repMessage && inferTopicFromText(repMessage) === topic);
  let sentences = splitSentences(output).map((sentence) => cleanAssistantPhrasing(sentence));

  if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(output))) {
    issues.push("chatbot_phrasing");
  }

  if (sentences[0]) {
    const firstSentence = sentences[0];
    const hasProxyReset =
      /\bmy ma said\b|\bmy office manager said\b|\bsomeone told me\b|\byou(?:'ve| have) been trying to get in\b|\byou(?:'ve| have) been trying to reach me\b/i.test(firstSentence);

    if (hasProxyReset && (hasPriorContextSignal || repMentionedTopic)) {
      sentences[0] = buildTopicAcknowledgment({
        topic,
        interactionPressures,
        behaviorState,
        repMentionedTopic,
        hasPriorContextSignal,
      });
      issues.push("proxy_reset");
    } else if (turnCount <= 0 && !topicIsAcknowledged(firstSentence, topic)) {
      sentences[0] = buildTopicAcknowledgment({
        topic,
        interactionPressures,
        behaviorState,
        repMentionedTopic,
        hasPriorContextSignal,
      });
      issues.push("topic_misalignment");
    }
  }

  if ((interactionPressures || []).includes("time_constrained") && sentences[0] && sentences[0].length > 150) {
    sentences[0] = sentences[0]
      .replace(/\bI can give you more context if needed\b/gi, "")
      .replace(/\bI would want to discuss this in detail\b/gi, "Keep it focused for me")
      .trim();
    issues.push("overwritten");
  }

  const tiered = enforceRealismTierTone(sentences, {
    tier: realism.tier,
    interactionPressures,
  });
  if (joinSentences(tiered) !== joinSentences(sentences)) {
    issues.push(`realism_tier_${realism.tier}`);
    sentences = tiered;
  }

  output = joinSentences(sentences);
  if (output && !/[.?!]$/.test(output)) {
    output = `${output}.`;
  }

  return { text: output, issues: unique(issues) };
}
