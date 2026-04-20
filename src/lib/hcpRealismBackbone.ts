import { HcpRuntimeProfile } from "./hcpRuntimeProfiles";
import { HcpTurnDirectiveSet } from "./hcpTurnDirectives";
import { buildRealismSpecNotes, getRealismExampleBank } from "./hcpRealismMemory";

function normalizeText(value = ""): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeOpeningSceneLine(openingScene = ""): string {
  return normalizeText(openingScene)
    .replace(/\s+—\s+/g, ", ")
    .replace(/\[[^\]]+\]/g, "that option")
    .replace(/\s+,/g, ",")
    .replace(/\s+\./g, ".")
    .replace(/\s+\?/g, "?");
}

function applyGlobalOpeningSpeechCadence(
  text: string,
  turn: HcpTurnDirectiveSet,
  profile: HcpRuntimeProfile,
): string {
  let output = normalizeOpeningSceneLine(text);
  const anchorType = detectOpeningAnchorType(text);

  output = output
      .replace(/\bWhat type of patient are you seeing the best results in\b/i, "Which patients are you seeing the best results in")
      .replace(/\bI don't have the staff infrastructure that a bigger practice would have\b/i, "I don't have the staff support a bigger practice would have")
      .replace(/\bI don't know what I can do about that, is there even a process\b/i, "I don't know what I can actually do about that. Is there even a process")
      .replace(/\bWhat are others in my area doing\b/i, "What are others around here doing")
      .replace(/\bI just haven't had one come through that fits perfectly yet\b/i, "I just haven't had the right patient come through yet")
      .replace(/\bWalk me through that\b/i, "How are you thinking about that")
      .replace(/\bWalk me through\.\b/i, "How are you thinking about that?");

  if (turn.concernFamily === "time" && profile.directness === "high") {
    output = output
      .replace(/\bOK, I have a few minutes\b/i, "Okay, I've got a few minutes")
      .replace(/\bI'll be honest, I'm not usually a fan of these visits, but here we are\b/i, "I'll be honest, I'm not usually a fan of these visits, so let's keep this useful")
      .replace(/\bthat's the only reason I said yes\b/i, "that's why I said yes");
  }

  if (anchorType === "case_discussion") {
    output = output
      .replace(/\bDr\. Patel said I should talk to you\b/i, "Dr. Patel said I should talk with you")
      .replace(/\bbut honestly, I thought this was going to be a case discussion\b/i, "but I honestly thought this was going to be a case discussion")
      .replace(/\bI don't usually meet with reps\b/i, "I don't usually take rep visits");
  }

  if (anchorType === "staff_gatekeeping") {
    output = output
      .replace(/\bMy office manager said you'd been trying to get in\b/i, "My office manager said you've been trying to get in")
      .replace(/\bI'll be honest, I'm not usually a fan of these visits, but here we are\b/i, "I'll be honest, I'm not usually a fan of these visits, so let's keep this useful");
  }

  if (anchorType === "priority_mismatch") {
    output = output
      .replace(/\bI've heard the efficacy story\b/i, "You've already given me the efficacy story")
      .replace(/\bThat's not the question for me\b/i, "That's not really my question");
  }

  if (anchorType === "status_quo") {
    output = output
      .replace(/\bHonestly, my patients do pretty well\b/i, "Honestly, my patients are doing pretty well")
      .replace(/\bI haven't had a reason to change anything in a while\b/i, "I haven't had much reason to change anything");
  }

  if (anchorType === "workflow") {
    output = output
      .replace(/\bBut we'd need someone to manage the monitoring\b/i, "But we'd still need someone to manage the monitoring");
  }

  if (anchorType === "hesitation") {
    output = output
      .replace(/\bI've been meaning to try it with the right patient\b/i, "I've been meaning to try it");
  }

  if (anchorType === "committee_deferral") {
    output = output
      .replace(/\bI'll bring it up at the next P&T meeting, that's probably in six weeks\b/i, "I'll bring it up at the next P&T meeting. That's probably six weeks out");
  }

  return output;
}

export type OpeningAnchorType =
  | "prior_auth"
  | "case_discussion"
  | "staff_gatekeeping"
  | "priority_mismatch"
  | "status_quo"
  | "screening"
  | "formulary"
  | "guideline"
  | "cost_value"
  | "safety_flag"
  | "competitive_loyalty"
  | "committee_deferral"
  | "split_decision"
  | "adoption"
  | "hesitation"
  | "workflow"
  | "general";

export function detectOpeningAnchorType(openingScene = ""): OpeningAnchorType {
  const text = normalizeText(openingScene).toLowerCase();
  if (/prior auth reduction|prior auth|authorization/i.test(text)) return "prior_auth";
  if (/case discussion|don't usually meet with reps/i.test(text)) return "case_discussion";
  if (/office manager said|trying to get in|not usually a fan of these visits|agreed to a brief meeting/i.test(text)) return "staff_gatekeeping";
  if (/efficacy story|can't stay on therapy|that's not the question for me/i.test(text)) return "priority_mismatch";
  if (/patients do pretty well|haven't had a reason to change|need something different/i.test(text)) return "status_quo";
  if (/best results in|what type of patient|patient criteria|right patient/i.test(text)) return "screening";
  if (/bring it up at the next p&t meeting|probably in six weeks|ultimately a formulary decision/i.test(text)) return "committee_deferral";
  if (/wanted to sit in on this one|going back and forth|sort it out/i.test(text)) return "split_decision";
  if (/formulary|non-preferred|p&t/i.test(text)) return "formulary";
  if (/follow the .* guidelines|what am i missing/i.test(text)) return "guideline";
  if (/does the outcome justify|what we'd spend|cost/i.test(text)) return "cost_value";
  if (/hepatic signal|medical team seen this|presented a case/i.test(text)) return "safety_flag";
  if (/patients do well on it|not interested in switching|been using .* for three years/i.test(text)) return "competitive_loyalty";
  if (/not ready to be the first|what are others doing|others in my area/i.test(text)) return "adoption";
  if (/haven't had one come through|fits perfectly|right patient/i.test(text)) return "hesitation";
  if (/manage the monitoring|staff infrastructure|workflow/i.test(text)) return "workflow";
  return "general";
}

function hasConcreteAnchor(text = "", anchorType: OpeningAnchorType): boolean {
  const value = normalizeText(text).toLowerCase();
  switch (anchorType) {
    case "prior_auth":
      return /\bprior auth|authorization|approval\b/i.test(value);
    case "case_discussion":
      return /\bcase discussion|dr\.? patel|reps?\b/i.test(value);
    case "staff_gatekeeping":
      return /\boffice manager|trying to get in|fan of these visits|few minutes\b/i.test(value);
    case "priority_mismatch":
      return /\befficacy story|can't stay on therapy|question for me\b/i.test(value);
    case "status_quo":
      return /\bpatients do pretty well|reason to change|need something different\b/i.test(value);
    case "screening":
      return /\bwhat type of patient|which patients|best results|patient criteria|right patient\b/i.test(value);
    case "formulary":
      return /\bformulary|non-preferred|p&t\b/i.test(value);
    case "guideline":
      return /\bguidelines|what am i missing\b/i.test(value);
    case "cost_value":
      return /\boutcome justify|what we'd spend|cost\b/i.test(value);
    case "safety_flag":
      return /\bhepatic signal|medical team|presented a case\b/i.test(value);
    case "competitive_loyalty":
      return /\bpatients do well on it|not interested in switching|been using\b/i.test(value);
    case "committee_deferral":
      return /\bp&t meeting|six weeks|formulary decision\b/i.test(value);
    case "split_decision":
      return /\bdr\. chen|going back and forth|sort it out\b/i.test(value);
    case "adoption":
      return /\bothers doing|first one|my area|peer\b/i.test(value);
    case "hesitation":
      return /\bright patient|fits|fit perfectly|next step\b/i.test(value);
    case "workflow":
      return /\bmonitoring|staff|workflow|infrastructure\b/i.test(value);
    default:
      return value.length > 0;
  }
}

function buildOpeningAnchorReply(anchorType: OpeningAnchorType, openingScene = ""): string | null {
  const lower = normalizeText(openingScene).toLowerCase();
  switch (anchorType) {
    case "prior_auth":
      return "My MA said this was about prior auth reduction. I've only got a couple minutes, so tell me what you can actually do to make that easier on my staff.";
    case "case_discussion":
      return "Dr. Patel said I should talk with you, but I thought this was going to be a case discussion. I don't usually take rep visits, so tell me why this is worth the time.";
    case "staff_gatekeeping":
      return "My office manager said you've been trying to get in. I've got a few minutes, so tell me why I should make time for this.";
    case "priority_mismatch":
      return "You've already given me the efficacy story. That's not really my question. I need to know what happens to the patients who can't stay on therapy.";
    case "status_quo":
      return "My patients are doing pretty well as things are. If you think I need to change something, tell me what gap you're seeing that I'm not.";
    case "screening":
      return "I haven't really defined that yet. Which patients are you actually seeing the best results in?";
    case "formulary":
      return "I'd like to use it, but formulary is still the issue. Tell me what the actual process is here.";
    case "guideline":
      return "I follow the guidelines. Until I see where this fits, I'm not changing what I do.";
    case "cost_value":
      return "The efficacy isn't really my question. I need to know whether the outcome justifies the cost for the patients who'd actually use it.";
    case "safety_flag":
      return "I heard a case about a possible hepatic signal. Before we go further, I need to know what your team has seen.";
    case "competitive_loyalty":
      return "My patients do well on what I'm already using. If this is supposed to change that, tell me what actually matters for them.";
    case "committee_deferral":
      return "I'm supportive, but this still goes through P&T. If you want this to move, tell me what I can actually do before that meeting.";
    case "split_decision":
      return "Dr. Chen and I are not aligned on this yet. If you're going to help, help us get specific about where the disagreement actually is.";
    case "adoption":
      return "The data isn't my problem. I need to know what others around here are actually doing before I go first.";
    case "hesitation":
      return "I still need to know what the right patient actually looks like before this turns into a real next step.";
    case "workflow":
      return "Clinically, I can see it. The problem is who actually owns the extra monitoring step in a practice like mine.";
    default:
      if (/few minutes|next patient|make it quick/.test(lower)) {
        return "I've only got a minute, so give me the short version of why this matters right now.";
      }
      return null;
  }
}

function deterministicPick<T>(items: T[], seed = ""): T {
  if (!items.length) throw new Error("deterministicPick requires at least one item");
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return items[(hash >>> 0) % items.length];
}

export function buildGlobalFirstTurnCue({
  scenario,
  concernFamily,
  profile,
}: {
  scenario: any;
  concernFamily: string;
  profile?: { directness?: string };
}): string | null {
  const title = normalizeText(scenario?.title || "scenario");
  const openingScene = normalizeText(scenario?.openingScene || "");
  const visualScene = normalizeText(scenario?.visualScene || "");
  const journeyStage = String(scenario?.journeyStage || "").toLowerCase();
  const pressures = Array.isArray(scenario?.interactionPressure) ? scenario.interactionPressure : [];
  const anchorType = detectOpeningAnchorType(openingScene);

  if (journeyStage === "initial_access") {
    if (concernFamily === "time" || pressures.includes("time_constrained") || anchorType === "prior_auth") {
      return deterministicPick([
        "The HCP checks the next patient slot, then looks back expecting the short version.",
        "The HCP glances toward the next room and comes back with time clearly tight.",
        "The HCP looks at the schedule, then back with only a small window left for this.",
      ], `${title}|initial_access|time`);
    }

    if (anchorType === "case_discussion" || /referral|case discussion|dr\. patel/i.test(openingScene)) {
      return deterministicPick([
        "The HCP looks up from the referral note and holds eye contact without softening.",
        "The HCP gives you a brief, measured look, the referral warmth clearly gone.",
        "The HCP studies you for a beat, expression measured and not especially welcoming.",
      ], `${title}|initial_access|case_discussion`);
    }

    if (anchorType === "staff_gatekeeping") {
      return deterministicPick([
        "The HCP looks back like this meeting still has to justify taking up a slot in the day.",
        "The HCP checks the schedule once, then gives you a look that says this still has to earn its place.",
        "The HCP keeps one eye on the clinic flow and looks back without giving the meeting much room yet.",
      ], `${title}|initial_access|staff_gatekeeping`);
    }

    if (anchorType === "split_decision") {
      return deterministicPick([
        "The HCP looks back like this is already a two-person decision that still is not settled.",
        "The HCP keeps the room open, but only in the way people do when an internal disagreement is already in play.",
        "The HCP looks back like they want help sorting the disagreement, not a generic pitch.",
      ], `${title}|initial_access|split_decision`);
    }

    if (pressures.includes("skeptical_resistant") || profile?.directness === "high") {
      return deterministicPick([
        "The HCP studies you for a beat, expression measured and clearly guarded.",
        "The HCP gives you a brief, exacting look and leaves no room for small talk.",
      ], `${title}|initial_access|guarded`);
    }
  }

  if (journeyStage === "discovery" || concernFamily === "screening") {
    if (anchorType === "priority_mismatch") {
      return deterministicPick([
        "The HCP keeps the chart open, expression tightening around the patients who fall off therapy.",
        "The HCP leaves the notes open and looks back like the real issue is what happens when patients do not stay on treatment.",
        "The HCP keeps the case notes in view, attention fixed on the patients who do not make it through therapy.",
      ], `${title}|discovery|priority_mismatch`);
    }

    if (anchorType === "status_quo") {
      return deterministicPick([
        "The HCP looks back with the posture of someone who does not feel a compelling need to change course.",
        "The HCP keeps the chart open and looks back like the current approach is still working well enough.",
        "The HCP stays measured, current routine clearly still the baseline they trust.",
      ], `${title}|discovery|status_quo`);
    }

    return deterministicPick([
      "The HCP keeps the chart open and leans slightly toward the patient list.",
      "The HCP leaves the case notes open, attention settling around which patients really fit.",
      "The HCP keeps the patient list in view and looks back as if the selection boundary matters most.",
    ], `${title}|discovery|screening`);
  }

  if (journeyStage === "clinical_value" || concernFamily === "evidence") {
    if (anchorType === "split_decision") {
      return deterministicPick([
        "The HCP looks back like this conversation already has another decision-maker in the room, even if they are not here yet.",
        "The HCP keeps the notes open and looks back like the real question is whether you can help settle an internal split.",
        "The HCP leaves the discussion open, but only in the way people do when a second opinion still has to be reconciled.",
      ], `${title}|clinical_value|split_decision`);
    }

    if (anchorType === "safety_flag") {
      return deterministicPick([
        "The HCP keeps the conference note open and looks back with the unresolved signal still front and center.",
        "The HCP leaves the case summary open and looks back like the safety question needs a real answer first.",
        "The HCP keeps one hand on the conference note, attention fixed on the hepatic signal they just raised.",
      ], `${title}|clinical_value|safety`);
    }

    if (anchorType === "competitive_loyalty") {
      return deterministicPick([
        "The HCP keeps a steady look on you, expression closed around the fact that the current choice is working.",
        "The HCP looks back with the posture of someone who does not see a reason to switch yet.",
        "The HCP holds eye contact without softening, current practice clearly still the benchmark.",
      ], `${title}|clinical_value|competitive`);
    }

    if (anchorType === "guideline") {
      return deterministicPick([
        "The HCP keeps the guideline printout in view and looks back with a measured, exacting expression.",
        "The HCP leaves the guideline note open and looks back like the burden is on you to show where this fits.",
        "The HCP keeps one hand on the guideline summary, attention fixed on whether this belongs there at all.",
      ], `${title}|clinical_value|guideline`);
    }

    if (anchorType === "cost_value") {
      return deterministicPick([
        "The HCP keeps the value question front and center, expression narrowing around what the outcome is actually worth.",
        "The HCP looks back like the clinical case is not enough unless the cost-value tradeoff holds up.",
        "The HCP keeps the notes open and looks back with the cost-value question still unresolved.",
      ], `${title}|clinical_value|cost`);
    }

    return deterministicPick([
      "The HCP keeps the study printout open, attention narrowing around the proof point.",
      "The HCP leaves the trial page open and looks back with a more exacting expression.",
      "The HCP keeps one hand on the marked-up data page, waiting for a concrete answer.",
    ], `${title}|clinical_value|evidence`);
  }

  if (concernFamily === "adoption_caution") {
    return deterministicPick([
      "The HCP keeps the protocol note open and looks back like the clinical case is real, but the decision still is not.",
      "The HCP leaves the group notes open and looks back with interest that still stops short of action.",
      "The HCP keeps the notes in view and looks back like they are weighing first-mover risk, not the data itself.",
    ], `${title}|close|adoption_caution`);
  }

  if (concernFamily === "hesitation") {
    return deterministicPick([
      "The HCP keeps the patient list in view and looks back like agreement still has not turned into action.",
      "The HCP leaves the notes open and looks back as if the right patient question is still doing all the work.",
      "The HCP keeps the chart open and stays measured, still waiting for something concrete enough to act on.",
    ], `${title}|close|hesitation`);
  }

  if (journeyStage === "adoption_implementation" || concernFamily === "workflow") {
    return deterministicPick([
      "The HCP keeps the workflow notes open, posture tightening around who would manage the extra step.",
      "The HCP leaves the clinic notes open and looks back with the staff question still front and center.",
      "The HCP keeps one hand on the monitoring note, attention fixed on what this adds for the team.",
    ], `${title}|adoption|workflow`);
  }

  if (journeyStage === "access_formulary" || concernFamily === "access") {
    if (anchorType === "committee_deferral") {
      return deterministicPick([
        "The HCP leaves the committee pathway in view and looks back like support is real, but still deferred.",
        "The HCP looks back like this still has to survive a committee step before it becomes real.",
        "The HCP keeps the decision at arm's length, attention fixed on what can actually move before P&T.",
      ], `${title}|access|committee_deferral`);
    }

    return deterministicPick([
      "The HCP keeps the formulary note open, attention fixed on what actually changes the access step.",
      "The HCP leaves the coverage note in view and looks back with the process question still unresolved.",
      "The HCP keeps the access paperwork under one hand, waiting for something practical.",
    ], `${title}|access`);
  }

  if (journeyStage === "commitment_close") {
    return deterministicPick([
      "The HCP keeps the patient list in view and looks back without moving closer to a decision.",
      "The HCP leaves the notes open and stays measured, still waiting for a concrete next step.",
      "The HCP looks back with guarded openness, not yet ready to turn agreement into action.",
    ], `${title}|close|${concernFamily}`);
  }

  if (/door|doorway|hallway|next patient|schedule|clock/i.test(visualScene)) {
    return deterministicPick([
      "The HCP glances once toward the doorway, then back without opening much space.",
      "The HCP checks the room behind you, then returns attention with a measured expression.",
    ], `${title}|visual|door`);
  }

  return deterministicPick([
    "The HCP gives you a brief, measured look and waits for you to explain why you're here.",
    "The HCP looks back with professional reserve, leaving the burden on you to make this relevant.",
  ], `${title}|general`);
}

function buildGlobalFirstTurnUtterance({
  scenario,
  turn,
  profile,
}: {
  scenario: any;
  turn: HcpTurnDirectiveSet;
  profile: HcpRuntimeProfile;
}): string | null {
  const openingScene = normalizeOpeningSceneLine(scenario?.openingScene || "");
  if (!openingScene) return null;

  let output = applyGlobalOpeningSpeechCadence(openingScene, turn, profile);

  if (turn.concernFamily === "time" && profile.directness === "high") {
    output = output
      .replace(/\bthat'?s the only reason i said yes\b/i, "that's why I said yes")
      .replace(/\bi've got four minutes before my next patient\b/i, "I've got four minutes before my next patient")
      .replace(/\bi have a few minutes\b/i, "I've got a few minutes");
  }

  if (turn.concernFamily === "screening") {
    output = output
      .replace(/\bhonestly, /i, "")
      .replace(/\bi haven't thought much about it\b/i, "I haven't really defined that yet")
      .replace(/\bwhich patients are you seeing the best results in\b/i, "Which patients are you actually seeing the best results in");
  }

  if (turn.concernFamily === "adoption_caution") {
    output = output
      .replace(/\bi think the data is compelling\b/i, "I think the data is compelling")
      .replace(/\bwhat are people in my area actually doing\b/i, "What are people in my area actually doing");
  }

  if (turn.concernFamily === "hesitation") {
    output = output
      .replace(/\byes, /i, "")
      .replace(/\bi've been meaning to try it with the right patient\b/i, "I've been meaning to try it")
      .replace(/\bi just haven't had one come through that fits perfectly yet\b/i, "I just haven't had the right patient come through yet");
  }

  if (turn.concernFamily === "workflow") {
    output = output
      .replace(/\bclinically, i'm on board\b/i, "Clinically, I'm on board")
      .replace(/\bwe'd need someone to manage the monitoring\b/i, "We'd still need someone to manage the monitoring");
  }

  if (turn.concernFamily === "access") {
    output = output
      .replace(/\bi'd actually like to use this\b/i, "I'd like to use this")
      .replace(/\bi don't know what i can do about that — is there even a process\b/i, "I don't know what I can actually do about that. Is there even a process")
      .replace(/\bi'll bring it up at the next p&t meeting, that's probably in six weeks\b/i, "I'll bring it up at the next P&T meeting. That's probably six weeks out");
  }

  return output;
}

export function buildRealismBackbonePrompt({
  scenario,
  turn,
  profile,
  hcpTurnCount,
}: {
  scenario: any;
  turn: HcpTurnDirectiveSet;
  profile: HcpRuntimeProfile;
  hcpTurnCount: number;
}): string {
  const firstTurn = hcpTurnCount === 0;
  const openingAnchorType = detectOpeningAnchorType(scenario?.openingScene || "");
  const lines = [
    "SOURCE-BACKED REALISM BACKBONE:",
    "- Use plain, spoken clinician language rather than polished explanatory language.",
    "- Keep workflow and access language concrete: staff, forms, callbacks, approval steps, handoffs, scheduling, delays, who owns the next step.",
    "- Under time pressure, ask for one specific point and compress the room for the rep.",
    "- In discovery, ask practical patient-criteria questions instead of drifting into broad product talk.",
    "- In adoption caution, focus on first-mover risk, peer precedent, and low-risk next steps.",
  ];
  const realismSpecNotes = buildRealismSpecNotes({
    scenario,
    turn,
    profile,
    hcpTurnCount,
  });
  const realismExamples = getRealismExampleBank({
    scenario,
    turn,
    profile,
  });

  if (turn.concernFamily === "workflow" || turn.concernFamily === "access") {
    lines.push("- Do not use abstract burden phrasing alone; name the concrete step, owner, or delay.");
  }
  if (openingAnchorType === "cost_value") {
    lines.push("- In cost-value conversations, stay specific about total cost per patient, added testing or monitoring, and what would justify the spend.");
    lines.push("- Do not fall back to generic 'value' language once the discussion tightens. Keep the HCP anchored to budget, formulary, or total-cost thresholds.");
  }

  if (firstTurn) {
    lines.push("- First HCP turn must preserve the defining reason this meeting happened.");
    lines.push("- On the first HCP turn, start from the scenario's authored opening setup in spoken form before adding any extra compression.");
    if (openingAnchorType === "prior_auth") {
      lines.push("- Preserve the prior-authorization anchor explicitly on the first turn.");
    }
    if (openingAnchorType === "case_discussion") {
      lines.push("- Preserve the referral/case-discussion mismatch explicitly on the first turn.");
    }
    if (openingAnchorType === "staff_gatekeeping") {
      lines.push("- Preserve the staff-gatekept access context explicitly on the first turn.");
    }
    if (openingAnchorType === "screening") {
      lines.push("- Preserve the patient-selection question explicitly on the first turn.");
    }
    if (openingAnchorType === "adoption") {
      lines.push("- Preserve the peer-precedent / first-mover hesitation explicitly on the first turn.");
    }
    if (openingAnchorType === "hesitation") {
      lines.push("- Preserve the 'right patient' hesitation explicitly on the first turn.");
    }
    if (openingAnchorType === "formulary") {
      lines.push("- Preserve the process/formulary blocker explicitly on the first turn.");
    }
    if (openingAnchorType === "workflow") {
      lines.push("- Preserve the concrete staff/monitoring ownership issue explicitly on the first turn.");
    }
    if (openingAnchorType === "cost_value") {
      lines.push("- Preserve the cost-value threshold explicitly on the first turn.");
    }
  }

  if (profile.directness === "high") {
    lines.push("- This HCP should sound direct, compressed, and task-focused, not conversationally generous.");
  }

  if (realismSpecNotes.length) {
    lines.push("APPROVED REALISM SPECS:");
    realismSpecNotes.forEach((note) => lines.push(`- ${note}`));
  }

  if (realismExamples.length) {
    lines.push("APPROVED SPOKEN CADENCE EXAMPLES (style reference only — do not copy verbatim unless naturally appropriate):");
    realismExamples.forEach((example) => lines.push(`- "${example}"`));
  }

  return lines.join("\n");
}

export function enforceSourceBackedRealismSurface({
  hcpReply,
  scenario,
  turn,
  profile,
  hcpTurnCount,
}: {
  hcpReply: string;
  scenario: any;
  turn: HcpTurnDirectiveSet;
  profile: HcpRuntimeProfile;
  hcpTurnCount: number;
}): string {
  let output = normalizeText(hcpReply);
  if (!output) return "";

  const firstTurn = hcpTurnCount === 0;
  const openingScene = normalizeText(scenario?.openingScene || "");
  const anchorType = detectOpeningAnchorType(openingScene);

  if (firstTurn) {
    const firstTurnUtterance = buildGlobalFirstTurnUtterance({
      scenario,
      turn,
      profile,
    });
    if (firstTurnUtterance) {
      return firstTurnUtterance;
    }
  }

  if (firstTurn && !hasConcreteAnchor(output, anchorType)) {
    const anchored = buildOpeningAnchorReply(anchorType, openingScene);
    if (anchored) output = anchored;
  }

  if (
    (turn.concernFamily === "workflow" || turn.concernFamily === "access") &&
    /\bburden\b/i.test(output) &&
    !/\bstaff|step|form|approval|callback|handoff|delay|team\b/i.test(output)
  ) {
    output = output.replace(/\bburden\b/gi, "extra step for staff");
  }

  if (
    turn.concernFamily === "time" &&
    profile.directness === "high" &&
    !/\bget to the point|short version|give me the short version|30 seconds|one practical point\b/i.test(output)
  ) {
    output = `${output.replace(/[.?!]+$/, "")}. Give me the short version.`;
  }

  return output;
}
