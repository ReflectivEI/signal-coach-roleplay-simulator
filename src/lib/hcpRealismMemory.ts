import type { HcpRuntimeProfile } from "./hcpRuntimeProfiles";
import type { HcpTurnDirectiveSet } from "./hcpTurnDirectives";

type RealismExample = {
  family: string;
  phase: string;
  directness?: "high" | "medium" | "low";
  pressure?: string;
  example: string;
};

const APPROVED_SPOKEN_EXAMPLES: RealismExample[] = [
  {
    family: "time",
    phase: "initial_access",
    directness: "high",
    pressure: "time_constrained",
    example: "Look, I've got four minutes before my next patient. My MA said you had something about prior auth reduction, that's why I said yes.",
  },
  {
    family: "general",
    phase: "initial_access",
    directness: "medium",
    example: "Dr. Patel said I should talk with you, but I honestly thought this was going to be a case discussion. I don't usually take rep visits.",
  },
  {
    family: "time",
    phase: "initial_access",
    directness: "high",
    pressure: "operationally_constrained",
    example: "Okay, I've got a few minutes. My office manager said you've been trying to get in. Keep it useful and get to the point.",
  },
  {
    family: "screening",
    phase: "discovery",
    example: "I haven't really defined that yet. Which patients are you actually seeing the best results in?",
  },
  {
    family: "screening",
    phase: "discovery",
    directness: "high",
    example: "You've already given me the efficacy story. That's not really my question. The question is what happens to patients who can't stay on therapy.",
  },
  {
    family: "general",
    phase: "discovery",
    example: "Honestly, my patients are doing pretty well. I haven't had much reason to change anything. What would make you think I need something different?",
  },
  {
    family: "evidence",
    phase: "clinical_value",
    directness: "high",
    example: "The hazard ratio looks good on paper, but the patient population in that trial doesn't reflect what I see. They excluded anyone with moderate renal impairment.",
  },
  {
    family: "evidence",
    phase: "clinical_value",
    directness: "high",
    example: "I follow the ACC guidelines. Until this shows up there, I'm not changing what I'm doing. What am I missing?",
  },
  {
    family: "evidence",
    phase: "clinical_value",
    example: "The efficacy data is fine. For the patients who would actually use this, does the outcome justify what we'd spend? How do you justify the cost?",
  },
  {
    family: "evidence",
    phase: "clinical_value",
    directness: "high",
    example: "If you can't give me a clear total cost per patient, I still don't have enough information to evaluate its value.",
  },
  {
    family: "evidence",
    phase: "clinical_value",
    directness: "high",
    pressure: "operationally_constrained",
    example: "Don't give me another efficacy point. I need the total cost picture, including any testing or monitoring this adds.",
  },
  {
    family: "evidence",
    phase: "clinical_value",
    directness: "high",
    example: "If the cost side is unclear, I still don't have enough information to evaluate its value.",
  },
  {
    family: "access",
    phase: "objection_resolution",
    directness: "high",
    example: "If this still needs prior auth, tell me what actually changes for my staff. We do not have spare bandwidth.",
  },
  {
    family: "evidence",
    phase: "objection_resolution",
    directness: "high",
    example: "I was at AAN last month and someone presented a case, hepatic signal, possibly related to your product. Has your medical team seen this?",
  },
  {
    family: "evidence",
    phase: "objection_resolution",
    example: "I've been using that option for three years. My patients do well on it. Unless you can show me something that matters to them specifically, I'm not interested in switching.",
  },
  {
    family: "adoption_caution",
    phase: "implementation_commitment",
    example: "I think the data is compelling. I'm just not ready to be the first one in my group to change protocols. What are others around here doing?",
  },
  {
    family: "workflow",
    phase: "implementation_commitment",
    example: "Clinically, I can see it. But someone still has to own the monitoring, and I do not have extra staff sitting around.",
  },
  {
    family: "evidence",
    phase: "implementation_commitment",
    example: "I tried it with one patient and had a rough experience. I'm not ready to start anyone else until I understand what happened. Can you help me think through this?",
  },
  {
    family: "access",
    phase: "access_resolution",
    example: "I'd like to use this, but our formulary team flagged it as non-preferred. What can I actually do from my side to move it?",
  },
  {
    family: "hesitation",
    phase: "close",
    example: "I've been meaning to try it. I just haven't had the right patient come through yet.",
  },
  {
    family: "access",
    phase: "close",
    example: "I'm supportive, you know that. But this is ultimately a formulary decision. I'll bring it up at the next P&T meeting. That's probably six weeks out.",
  },
  {
    family: "evidence",
    phase: "close",
    example: "Actually, Dr. Chen wanted to sit in on this one. We've been going back and forth on whether to add this to our toolkit. Maybe you can help us sort it out.",
  },
];

function deterministicPick<T>(items: T[], seed = ""): T | null {
  if (!items.length) return null;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return items[(hash >>> 0) % items.length];
}

export function getRealismExampleBank({
  scenario,
  turn,
  profile,
}: {
  scenario: any;
  turn: HcpTurnDirectiveSet;
  profile: HcpRuntimeProfile;
}): string[] {
  const title = String(scenario?.title || "scenario");
  const phase = String(turn.phase || "");
  const family = String(turn.concernFamily || profile.concernFamily || "general");
  const directness = profile.directness;
  const pressures = Array.isArray(scenario?.interactionPressure) ? scenario.interactionPressure : [];

  const specificMatches = APPROVED_SPOKEN_EXAMPLES.filter((entry) =>
    entry.family === family &&
    entry.phase === phase &&
    (!entry.directness || entry.directness === directness) &&
    (!entry.pressure || pressures.includes(entry.pressure))
  );
  const phaseMatches = APPROVED_SPOKEN_EXAMPLES.filter((entry) =>
    entry.family === family &&
    entry.phase === phase &&
    (!entry.directness || entry.directness === directness)
  );
  const familyMatches = APPROVED_SPOKEN_EXAMPLES.filter((entry) =>
    entry.family === family &&
    (!entry.directness || entry.directness === directness)
  );
  const fallbackMatches = APPROVED_SPOKEN_EXAMPLES.filter((entry) =>
    entry.family === family || entry.phase === phase
  );

  const primaryPool = specificMatches.length
    ? specificMatches
    : phaseMatches.length
      ? phaseMatches
      : familyMatches.length
        ? familyMatches
        : fallbackMatches;

  const first = deterministicPick(primaryPool, `${title}|${family}|${phase}|primary`);
  const secondPool = primaryPool.filter((entry) => entry !== first);
  const second = deterministicPick(secondPool, `${title}|${family}|${phase}|secondary`);

  return [first?.example, second?.example].filter(Boolean) as string[];
}

export function buildRealismSpecNotes({
  scenario,
  turn,
  profile,
  hcpTurnCount,
}: {
  scenario: any;
  turn: HcpTurnDirectiveSet;
  profile: HcpRuntimeProfile;
  hcpTurnCount: number;
}): string[] {
  const notes: string[] = [];
  const firstTurn = hcpTurnCount === 0;
  const pressures = Array.isArray(scenario?.interactionPressure) ? scenario.interactionPressure : [];

  if (firstTurn) {
    notes.push("On the first HCP turn, preserve the meeting reason, constraint, and concrete ask in spoken form.");
    notes.push("A good first-turn line should sound like a clinician deciding whether this conversation is worth the next minute.");
    notes.push("Do not end a question with a vague closer if the actual ask is still unclear. The HCP's ask has to be understandable on its own.");
  }

  notes.push("Every HCP question must stand alone semantically. Do not ask to reduce, change, fix, improve, or help with something unless the object is explicitly named.");
  notes.push("Avoid comma splices in spoken dialogue. If two independent thoughts are present, split them into separate sentences.");

  if (profile.directness === "high") {
    notes.push("When directness is high, prefer clipped sentences over balanced, polished explanations.");
    notes.push("Do not over-explain. State the blocker, then the practical condition or question.");
  }

  if (profile.brevity === "tight") {
    notes.push("Tight-brevity lines should sound compressed, but never chopped or robotic.");
  }

  if (pressures.includes("time_constrained")) {
    notes.push("Under time pressure, mention the time box, patient flow, or schedule pressure explicitly.");
  }

  if (pressures.includes("operationally_constrained")) {
    notes.push("Under operational pressure, name the staff task, handoff, approval step, callback, or monitoring burden directly.");
  }

  if (turn.concernFamily === "evidence") {
    notes.push("Evidence-focused HCPs should sound threshold-aware and specific about why the proof does or does not fit their patients.");
    notes.push("If the HCP is asking a follow-up, make the decision question explicit instead of relying on a vague closer.");
  }
  if (turn.concernFamily === "screening") {
    notes.push("Discovery lines should sound like the HCP is clarifying patient boundaries, not asking generic product questions.");
  }
  if (turn.concernFamily === "access") {
    notes.push("Access lines should sound procedural and practical, not theoretical or abstract.");
  }
  if (turn.concernFamily === "workflow") {
    notes.push("Workflow lines should name who would do the work and what exact extra step gets added.");
  }
  if (turn.concernFamily === "hesitation") {
    notes.push("Hesitation lines should sound like passive agreement that has not yet become action.");
  }
  if (turn.concernFamily === "adoption_caution") {
    notes.push("Adoption-caution lines should focus on first-mover risk, peer precedent, and low-risk next steps.");
  }

  return notes;
}
