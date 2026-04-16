import { invokeWorkerText } from "./../services/workerClient.js";

const DIRECT_ANSWER_TRIGGER = /show me data|need data|moderate renal impairment|renal impairment|multiple comorbidit|subgroup|excluded patient|real-world fit|workflow|what changes|what gets added|what staff|what does that add|what's the point|bottom line|operational|guideline|what am i missing|cost savings|justify the cost|readmissions|metrics|prior auth|prior authorization|specific outcomes|what outcomes|own patient population|my own population/i;
const INITIAL_ACCESS_DIRECT_ASK_PATTERN = /what'?s this about|what is this about|why are we talking|why are you here|make this quick|can you make this quick|short version|few minutes|what do you need from me|what's the relevance|what is the relevance/i;
const EXPECTATION_MISMATCH_PATTERN = /dr\.|patel|case discussion|case consult|referral|thought this was|was going to be|was supposed to be/i;
const ACCESS_PROCESS_DEMAND_PATTERN = /formulary|committee|review process|step therapy|non-preferred|what would move|what would change|take back|carry forward|prior auth|prior authorization|what staff|what gets added|what step/i;
const WORKFLOW_DEMAND_PATTERN = /workflow|staff|monitoring|follow-up|what happens next|who picks that up|who owns that|extra step|what does that add/i;
const WORKFLOW_REDISCOVERY_PATTERN = /what's a typical day|how do you currently|where do you think we could make the biggest impact|fit into your existing workflow|what part of the follow-up|what part of the monitoring|what would actually land on your team/i;
const BROAD_DISCOVERY_PATTERN = /\?|^can you\b|^could you\b|^would you\b|help me understand|elaborate on|tell me more about|what specific/i;
const ABSTRACT_QA_LANGUAGE_PATTERN = /critical consideration|significant limitation|primary concern|specific patient population|discussion should focus|treatment landscape|clinical outcomes|align with your concerns|economic concerns|consideration in treatment decisions/i;
const OVER_EXPLANATORY_PATTERN = /would be|which can be|ensure they'?re on track|minimal disruption|incorporated into your existing workflow|in order to|would likely be|that would help/i;

function getLastHcpText(turns = []) {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (turns[i]?.speaker === "hcp" && typeof turns[i]?.text === "string") {
      return turns[i].text.trim();
    }
  }
  return "";
}

function getActiveConcernText(turns = [], scenario = {}) {
  return getLastHcpText(turns) || String(scenario?.openingScene || "").trim();
}

function getLastRepText(turns = []) {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (turns[i]?.speaker === "rep" && typeof turns[i]?.text === "string") {
      return turns[i].text.trim();
    }
  }
  return "";
}

function extractIssueLabel(text = "") {
  const normalized = String(text).toLowerCase();
  if (/renal impairment|renal function/.test(normalized)) return "renal impairment";
  if (/guideline/.test(normalized)) return "guideline fit";
  if (/cost savings|readmissions|expenditure|economic|cost-effectiveness|justify the cost|cost justification|metrics|specific outcomes|what outcomes|worth the spend/.test(normalized)) return "cost impact";
  if (/subgroup|patient population|excluded/.test(normalized)) return "patient-fit gap";
  if (/workflow|staff|added step|operational|prior auth|prior authorization/.test(normalized)) return "workflow burden";
  return "the gap you're pointing to";
}

function shouldUseDeterministicEvidenceFitRewrite({ scenario, turns, currentBehaviorState, currentJourneyState, draft }) {
  const activeConcernText = getActiveConcernText(turns, scenario);
  const familyText = `${scenario?.journeyStage || ""} ${currentBehaviorState || ""} ${currentJourneyState || ""} ${(scenario?.interactionPressure || []).join(" ")}`;
  const isClinicalSkepticism = /clinical_value|skeptical|clinical_evaluation/i.test(familyText);
  const repeatedConcern = hasRepeatedObjection(turns);
  const directDemand = DIRECT_ANSWER_TRIGGER.test(activeConcernText);
  const firstRepTurn = turns.filter((turn) => turn?.speaker === "rep").length === 0;
  const issueLabel = extractIssueLabel(activeConcernText);
  const draftTooLoose = BROAD_DISCOVERY_PATTERN.test(String(draft || "").trim()) || ABSTRACT_QA_LANGUAGE_PATTERN.test(String(draft || "").trim());
  const highValueIssue = issueLabel === "guideline fit" || issueLabel === "cost impact" || issueLabel === "renal impairment";
  if (!isClinicalSkepticism) {
    return false;
  }

  if (firstRepTurn && highValueIssue) {
    return true;
  }

  return (repeatedConcern || directDemand) && draftTooLoose;
}

function shouldUseDeterministicCommitmentRewrite({ scenario, turns, draft }) {
  const stageText = `${scenario?.journeyStage || ""} ${scenario?.journeyState || ""}`.toLowerCase();
  const isCommitmentStage = /commitment_close|adoption_commitment|access_formulary/.test(stageText);
  if (!isCommitmentStage) {
    return false;
  }

  const activeConcernText = getActiveConcernText(turns, scenario).toLowerCase();
  const repeatedConcern = hasRepeatedObjection(turns);
  const repTurns = turns.filter((turn) => turn?.speaker === "rep").length;
  const draftText = String(draft || "").toLowerCase();

  const stillProfiling =
    /what specific patient|describe the specific|what would need to happen|better understand what you're looking for|ideal patient profile|patient profile|good fit|perfect fit|minimum criteria|example of a patient profile|what would that patient need to look like/.test(draftText) ||
    (draftText.includes("?") && /patient|fit|profile|criteria/.test(draftText));
  const passiveMaybeSignal = /right patient|ideal patient|meaning to try it|haven't had one|not ready yet|committee|bring it up|process|need more data|still not convinced|not the right fit|perfect fit/.test(activeConcernText);
  const workflowDeferralDrift =
    /show you a simpler prior auth process|reduce that burden on your staff|bare minimum reduction in prior auth steps|worthwhile for your staff|simplifies it enough|extra step for my staff|prior auth process|one thing that needs to fit with your existing workflow|fits with what you're doing now/.test(draftText);
  const workflowDeferralSignal = /prior auth|staff|workflow|extra step|burden/.test(activeConcernText);
  const accessWorkflowExplorationDrift =
    /what's the biggest|what specifically made it tough|can you walk me through|walk me through what you know|how many prior auths|what specific data point|what specifically|what part of the process|what would change the formulary|what would need to fit|understand what specific steps|what do you think is involved/.test(draftText);
  const accessWorkflowSignal =
    /prior auth|staff|workflow|extra step|burden|formulary|non-preferred|review process|process|committee|p&t|approved|patient outcomes|reconsidered|concrete/.test(activeConcernText);
  const lateEnoughForAction = repTurns >= 1;

  return isCommitmentStage && (
    ((repeatedConcern || passiveMaybeSignal) && stillProfiling) ||
    ((repeatedConcern || workflowDeferralSignal) && workflowDeferralDrift) ||
    (lateEnoughForAction && accessWorkflowSignal && accessWorkflowExplorationDrift)
  );
}

function shouldUseDeterministicFamilyAnswerRewrite({ scenario, turns, draft }) {
  const stage = String(scenario?.journeyStage || "").toLowerCase();
  const activeConcernText = getActiveConcernText(turns, scenario);
  const repeatedConcern = hasRepeatedObjection(turns);
  const draftText = String(draft || "").trim();
  const draftTooLoose = BROAD_DISCOVERY_PATTERN.test(draftText) || ABSTRACT_QA_LANGUAGE_PATTERN.test(draftText);

  if (stage === "initial_access") {
    return (INITIAL_ACCESS_DIRECT_ASK_PATTERN.test(activeConcernText) || repeatedConcern) && draftTooLoose;
  }

  if (stage === "access_formulary") {
    return (ACCESS_PROCESS_DEMAND_PATTERN.test(activeConcernText) || repeatedConcern) && draftTooLoose;
  }

  if (stage === "adoption_implementation") {
    return (WORKFLOW_DEMAND_PATTERN.test(activeConcernText) || repeatedConcern) && (draftTooLoose || WORKFLOW_REDISCOVERY_PATTERN.test(draftText));
  }

  return false;
}

function buildDeterministicFamilyAnswerReply({ scenario, turns }) {
  const stage = String(scenario?.journeyStage || "").toLowerCase();
  const activeConcernText = getActiveConcernText(turns, scenario).toLowerCase();
  const repTurns = turns.filter((turn) => turn?.speaker === "rep").length;

  if (stage === "initial_access") {
    if (EXPECTATION_MISMATCH_PATTERN.test(activeConcernText)) {
      if (repTurns >= 2) {
        return "You're right, this did not land like the case discussion you expected. I only want to see whether one practical issue is worth your time, and if it is not, we can stop there.";
      }
      return "You're right, this did not land like the case discussion you expected. I only wanted to see whether one practical issue is slowing care enough to matter in your clinic.";
    }
    if (/what'?s this about|what is this about|why are you here|why are we talking/.test(activeConcernText)) {
      if (repTurns >= 2) {
        return "This is still about whether one practical barrier is slowing care enough to matter in your clinic. If there is one, which step would you want fixed first?";
      }
      return "This is about whether one practical barrier is slowing care enough to be worth your time. If there is one, where does it hit your team first?";
    }
    if (/make this quick|short version|few minutes|patient waiting|brief/.test(activeConcernText)) {
      if (repTurns >= 2) {
        return "The short version is I'm trying to pin down one barrier worth solving, not pitch at you. Which step is still costing your team the most time right now?";
      }
      return "The short version is I'm trying to see whether one access or workflow step is getting in the way of care. If it is, which step is costing your team the most time right now?";
    }
    return "This is about whether there's one practical issue worth solving in your clinic, not a broad product discussion. If there is, where does it show up first?";
  }

  if (stage === "access_formulary") {
    if (/formulary|committee|review process|take back|carry forward|non-preferred|step therapy/.test(activeConcernText)) {
      if (repTurns >= 2) {
        return "It sounds like the real question now is what would be concrete enough to carry into that review, not another general value point. What one item would actually make it easier for you to move this forward internally?";
      }
      return "It sounds like the real issue is what would be concrete enough to move a formulary conversation, not another general value story. What one item would actually be worth taking back to that review?";
    }
    if (repTurns >= 2) {
      return "It sounds like the blocker is still the access step itself, not the clinical rationale. What one process condition would have to change before you'd move this forward?";
    }
    return "It sounds like the blocker is the access step itself, not whether the therapy works on paper. Which part of that process is stopping movement right now?";
  }

  if (stage === "adoption_implementation") {
    if (/staff|workflow|monitoring|follow-up|what happens next|who picks that up|who owns that/.test(activeConcernText)) {
      if (repTurns >= 2) {
        return "It sounds like staff burden is still the only real blocker here. What one workflow condition would have to be true before you'd try this with one patient?";
      }
      if (repTurns >= 1) {
        return "It sounds like the real issue is whether this creates another staff handoff, not whether the idea makes sense. Which step would actually force a new handoff in your workflow?";
      }
      return "It sounds like the real issue is whether this creates another staff handoff, not whether the idea makes sense. Where would that extra step actually land first for your team?";
    }
    return "It sounds like the main question is whether this is workable in practice, not whether the idea makes sense. What step would create the most friction for your team right now?";
  }

  return "Let me keep this on the one practical issue that matters here. Where does it start to break down for your team now?";
}

function buildDeterministicEvidenceFitReply({ scenario, turns }) {
  const activeConcernText = getActiveConcernText(turns, scenario);
  const issueLabel = extractIssueLabel(activeConcernText);

  if (issueLabel === "renal impairment") {
    return "You're right that the trial doesn't answer the renal impairment question cleanly for the patients you see. Before I try to bridge that gap, where does renal function change the decision most in your real patients?";
  }

  if (issueLabel === "guideline fit") {
    if (/own patient population|my patient population|not just some study/.test(activeConcernText.toLowerCase())) {
      return "You're saying the guideline story still doesn't match the patients you actually treat. Which patient type falls outside the guideline cleanly enough that you stop and reconsider the usual approach?";
    }

    return "You're saying the evidence may be interesting, but it still doesn't clear the guideline bar you use in practice. What would you need to see before this feels usable in a real patient decision?";
  }

  if (issueLabel === "cost impact") {
    if (/specific outcomes|what outcomes/.test(activeConcernText.toLowerCase())) {
      return "You're asking which outcomes would actually justify the spend, not for a generic value claim. Which outcome carries the most weight for you when you decide whether a therapy is worth adding?";
    }

    return "You're not asking for a general value story, you're asking what changes on cost and readmissions in the patients you manage. Which cost measure carries the most weight when you decide whether a therapy earns its place?";
  }

  if (issueLabel === "patient-fit gap") {
    if (/own patient population|my patient population|not just some study/.test(activeConcernText.toLowerCase())) {
      return "You're saying the study still doesn't reflect the patients who force you off the usual guideline path. Which patient type is most likely to make you pause and rethink the standard approach?";
    }

    return "You're saying the study population doesn't match the patients driving your decisions. Which patients are missing from the evidence as you look at it?";
  }

  if (issueLabel === "workflow burden") {
    return "You're pointing to the extra work this creates for the team, not just whether the therapy works on paper. Where do the prior auth steps start to break down in your workflow now?";
  }

  return `You're pointing to a real evidence-fit gap, not a surface objection. Where does ${issueLabel} show up most in the patients or decisions you're making now?`;
}

function buildDeterministicCommitmentReply({ scenario, turns }) {
  const activeConcernText = getActiveConcernText(turns, scenario).toLowerCase();
  const repTurns = turns.filter((turn) => turn?.speaker === "rep").length;

  if (/right patient|ideal patient|meaning to try it|haven't had one/.test(activeConcernText)) {
    if (repTurns <= 1) {
      return "It sounds like the hesitation isn't interest, it's not wanting to force a fit that doesn't hold up in your real patients. If someone came close over the next couple of weeks, would you be open to flagging that chart so we can pressure-test it together?";
    }
    return "It sounds like the blocker isn't interest, it's getting from theory to one real patient you'd actually act on. Would you be open to choosing one patient type you'd realistically consider next so the follow-up is concrete instead of open-ended?";
  }

  if (/need more data|still not convinced|not the right fit|perfect fit/.test(activeConcernText)) {
    return "It sounds like the hesitation is still active, even if the interest is there. Would you be open to naming the one evidence gap that has to get resolved before this moves from 'maybe' to a real next step?";
  }

  if (/proof point|concrete outcome|single data point|patient outcome|concrete/i.test(activeConcernText)) {
    return "It sounds like this only moves if the proof point changes something you can actually see in a patient, not just on a slide. Would a concrete shift in symptoms, hospital use, or treatment choice be the kind of threshold you'd actually act on?";
  }

  if (/formulary|non-preferred|review process|reconsidered|concrete|take back to the formulary team|exact steps/.test(activeConcernText)) {
    if (repTurns <= 1) {
      return "It sounds like the blocker isn't interest, it's needing something concrete to move the formulary conversation. If I gave you one specific item to bring back, what would make it useful enough to carry forward internally?";
    }
    return "It sounds like the path is clear enough to define a real next step now. Would you be open to agreeing on the one concrete item you can bring to the next formulary discussion so this actually moves?";
  }

  if (/committee|bring it up|process/.test(activeConcernText)) {
    return "It sounds like the issue isn't support, it's what you can actually own before the committee meets. What's one concrete step you could take this month so this doesn't just sit until the next meeting?";
  }

  if (/prior auth|staff|workflow|extra step|burden/.test(activeConcernText)) {
    if (repTurns <= 1) {
      return "It sounds like the blocker isn't interest, it's not wanting to hand your staff one more loose end. Before this goes any further, what's the one workflow condition that would have to be true for you to feel comfortable moving one case forward?";
    }
    return "It sounds like staff burden is still the real stop sign here. Would you be open to naming the one workflow requirement that has to be met before you'd take one concrete next step from your side?";
  }

  return "It sounds like the conversation is close to alignment, but the next step still isn't defined. Would you be open to naming the smallest concrete action that would move this forward from here?";
}

function hasRepeatedObjection(turns = []) {
  const hcpTurns = turns.filter((turn) => turn?.speaker === "hcp" && typeof turn?.text === "string");
  if (hcpTurns.length < 2) {
    return false;
  }

  const last = hcpTurns[hcpTurns.length - 1].text.toLowerCase();
  const prev = hcpTurns[hcpTurns.length - 2].text.toLowerCase();

  if (last === prev) {
    return true;
  }

  const sharedSignals = ["renal impairment", "subgroup", "comorbid", "workflow", "data", "real-world"];
  return sharedSignals.some((signal) => last.includes(signal) && prev.includes(signal));
}

function needsAnswerFirstRevision({ scenario, turns, currentBehaviorState, currentJourneyState, draft }) {
  const activeConcernText = getActiveConcernText(turns, scenario);
  if (!activeConcernText) {
    return false;
  }

  const pressureText = `${(scenario?.interactionPressure || []).join(" ")} ${currentBehaviorState || ""} ${currentJourneyState || ""}`;
  const pressured = /time|operational|skeptical|closed|resistant|clinical_value|objection/i.test(pressureText);
  const directDemand = DIRECT_ANSWER_TRIGGER.test(activeConcernText) || hasRepeatedObjection(turns);
  const draftTooDiscoveryLed = BROAD_DISCOVERY_PATTERN.test((draft || "").trim());

  return pressured && directDemand && draftTooDiscoveryLed;
}

export async function maybeReviseStrongRepReply({
  scenario,
  turns,
  currentBehaviorState,
  currentJourneyState,
  draft,
}) {
  if (shouldUseDeterministicFamilyAnswerRewrite({
    scenario,
    turns,
    draft,
  })) {
    return buildDeterministicFamilyAnswerReply({ scenario, turns });
  }

  if (shouldUseDeterministicCommitmentRewrite({
    scenario,
    turns,
    draft,
  })) {
    return buildDeterministicCommitmentReply({ scenario, turns });
  }

  if (shouldUseDeterministicEvidenceFitRewrite({
    scenario,
    turns,
    currentBehaviorState,
    currentJourneyState,
    draft,
  })) {
    return buildDeterministicEvidenceFitReply({ scenario, turns });
  }

  if (!needsAnswerFirstRevision({
    scenario,
    turns,
    currentBehaviorState,
    currentJourneyState,
    draft,
  })) {
    return draft;
  }

  const lastHcpText = getActiveConcernText(turns, scenario);
  const revisionPrompt = `
You are revising a pharma rep QA proxy reply inside a role-play simulation.

SCENARIO: ${scenario?.title || ""}
OBJECTIVE: ${scenario?.objective || ""}
CURRENT BEHAVIOR STATE: ${currentBehaviorState || ""}
CURRENT JOURNEY STATE: ${currentJourneyState || ""}
LAST HCP MESSAGE: ${lastHcpText}
KEY CHALLENGES: ${Array.isArray(scenario?.keyChallenges) ? scenario.keyChallenges.join(" | ") : "none"}

CURRENT DRAFT:
${draft}

Revise the draft so it behaves like a strong rep in a pressured clinical-value or objection exchange.

Rules:
- Keep it to 1-2 sentences.
- Start with a direct declarative answer that names the exact issue the HCP raised.
- Use concrete clinician-facing language, not abstract summary language.
- Do not lead with a question.
- Do not use broad discovery phrases like "help me understand," "can you elaborate," or "what specific aspects."
- If you include a second sentence, it must be a narrow next step or clarifier, not a broad discovery question.
- If the scenario's key challenge says exploring the concern is more credible than defending the data, do not rebut with a new claim; acknowledge the limitation and narrow the discussion to the exact patient-fit issue.
- Do not introduce rescue claims about efficacy, pharmacokinetics, or workflow support unless the HCP explicitly asked for that evidence.
- Do not add product hype or vague empathy wrappers.

Return ONLY the revised rep reply as plain text.`;

  const revised = await invokeWorkerText({
    prompt: revisionPrompt,
    max_tokens: 140,
    temperature: 0.1,
  });

  return String(revised || draft).trim();
}

export function maybeEnforceFamilyAnswerReply({
  scenario,
  turns,
  draft,
}) {
  if (shouldUseDeterministicFamilyAnswerRewrite({
    scenario,
    turns,
    draft,
  })) {
    return buildDeterministicFamilyAnswerReply({ scenario, turns });
  }

  return draft;
}

function needsConcreteLanguageRevision({ scenario, draft }) {
  const familyText = `${scenario?.journeyStage || ""} ${(scenario?.interactionPressure || []).join(" ")}`;
  const clinicalValueLike = /clinical_value|skeptical|evidence|access_barrier|operational/i.test(familyText);
  if (!clinicalValueLike) {
    return false;
  }

  return ABSTRACT_QA_LANGUAGE_PATTERN.test(String(draft || "").trim());
}

export async function maybeConcreteifyStrongRepReply({
  scenario,
  turns,
  currentBehaviorState,
  currentJourneyState,
  draft,
}) {
  if (!needsConcreteLanguageRevision({ scenario, draft })) {
    return draft;
  }

  const activeConcernText = getActiveConcernText(turns, scenario);
  const revisionPrompt = `
You are revising a pharma rep QA proxy reply so it sounds concrete, specific, and spoken, not abstract.

SCENARIO: ${scenario?.title || ""}
OBJECTIVE: ${scenario?.objective || ""}
CURRENT BEHAVIOR STATE: ${currentBehaviorState || ""}
CURRENT JOURNEY STATE: ${currentJourneyState || ""}
ACTIVE HCP CONCERN: ${activeConcernText}
KEY CHALLENGES: ${Array.isArray(scenario?.keyChallenges) ? scenario.keyChallenges.join(" | ") : "none"}

CURRENT DRAFT:
${draft}

Revise the draft with these rules:
- Keep it to 1-2 sentences.
- Use concrete patient-fit, workflow, or evidence-gap language.
- Name the exact issue instead of using abstract summary phrases.
- Ban phrases like "critical consideration," "significant limitation," "primary concern," "specific patient population," "treatment landscape," or "our discussion should focus."
- Make it sound like a real rep speaking to a clinician in the moment.
- If the scenario key challenges say exploring is more credible than defending, do not add a rescue claim.
- Do not add hype, broad discovery, or abstract framing.

Return ONLY the revised rep reply as plain text.`;

  const revised = await invokeWorkerText({
    prompt: revisionPrompt,
    max_tokens: 140,
    temperature: 0.1,
  });

  return String(revised || draft).trim();
}

export async function maybeDeRepeatStrongRepReply({
  scenario,
  turns,
  currentBehaviorState,
  currentJourneyState,
  draft,
}) {
  const lastRepText = getLastRepText(turns);
  if (!lastRepText || lastRepText !== String(draft || "").trim()) {
    return draft;
  }

  const activeConcernText = getActiveConcernText(turns, scenario);
  const revisionPrompt = `
You are revising a pharma rep QA proxy reply because it repeats the exact same sentence the rep already used on the prior turn.

SCENARIO: ${scenario?.title || ""}
CURRENT BEHAVIOR STATE: ${currentBehaviorState || ""}
CURRENT JOURNEY STATE: ${currentJourneyState || ""}
ACTIVE HCP CONCERN: ${activeConcernText}
PREVIOUS REP LINE: ${lastRepText}

Revise the new reply with these rules:
- Keep it to 1-2 sentences.
- Do not repeat the previous rep line.
- Stay in the same strategy lane: specific, grounded, clinician-facing.
- Move the conversation one step forward with a narrower clarifier, practical implication, or next-step question.
- Do not become more abstract, more generic, or more salesy.

Return ONLY the revised rep reply as plain text.`;

  const revised = await invokeWorkerText({
    prompt: revisionPrompt,
    max_tokens: 120,
    temperature: 0.1,
  });

  return String(revised || draft).trim();
}

export async function maybeTightenSpokenRepReply({
  scenario,
  turns,
  currentBehaviorState,
  currentJourneyState,
  draft,
}) {
  const activeConcernText = getActiveConcernText(turns, scenario);
  const isPressureContext = /clinical_value|skeptical|operational|access_barrier|workflow/i.test(
    `${scenario?.journeyStage || ""} ${(scenario?.interactionPressure || []).join(" ")} ${currentBehaviorState || ""} ${currentJourneyState || ""}`
  );
  if (!isPressureContext) {
    return draft;
  }

  const wordCount = String(draft || "").trim().split(/\s+/).filter(Boolean).length;
  const needsTightening = OVER_EXPLANATORY_PATTERN.test(String(draft || "").trim()) || wordCount > 28;
  if (!needsTightening) {
    return draft;
  }

  const revisionPrompt = `
You are tightening one pharma rep QA proxy line so it sounds more spoken and less explanatory.

SCENARIO: ${scenario?.title || ""}
CURRENT BEHAVIOR STATE: ${currentBehaviorState || ""}
CURRENT JOURNEY STATE: ${currentJourneyState || ""}
ACTIVE HCP CONCERN: ${activeConcernText}

CURRENT DRAFT:
${draft}

Rules:
- Keep the same core meaning.
- Make it shorter, sharper, and more spoken.
- Do not sound like a slide deck, workflow memo, or polished explanation.
- Prefer one concrete answer and, if needed, one short follow-up.
- Remove phrases like "would be", "which can be", "ensure they're on track", "minimal disruption", or similar consultant phrasing.
- Keep it clinician-facing and realistic.

Return ONLY the revised rep reply as plain text.`;

  const revised = await invokeWorkerText({
    prompt: revisionPrompt,
    max_tokens: 120,
    temperature: 0.1,
  });

  return String(revised || draft).trim();
}
