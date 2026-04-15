import { invokeWorkerText } from "./../services/workerClient.js";

const DIRECT_ANSWER_TRIGGER = /show me data|need data|moderate renal impairment|renal impairment|multiple comorbidit|subgroup|excluded patient|real-world fit|workflow|what changes|what gets added|what staff|what does that add|what's the point|bottom line|operational|guideline|what am i missing|cost savings|justify the cost|readmissions|metrics|prior auth|prior authorization|specific outcomes|what outcomes|own patient population|my own population/i;
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
  const passiveMaybeSignal = /right patient|ideal patient|meaning to try it|haven't had one|not ready yet|committee|bring it up|process/.test(activeConcernText);

  return isCommitmentStage && repTurns >= 1 && (repeatedConcern || passiveMaybeSignal) && stillProfiling;
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
      return "When you say 'the right patient,' what would that patient need to look like for you to feel comfortable trying this? If we can define that clearly, we can make the next step much more concrete.";
    }
    return "It sounds like the blocker isn't interest, it's defining what 'the right patient' means in your practice. Would you be open to picking one patient type you'd actually consider over the next few weeks so we can make this concrete?";
  }

  if (/committee|bring it up|process/.test(activeConcernText)) {
    return "It sounds like the issue isn't whether you support it, it's what part of the process you can actually own next. What's the most concrete step you could realistically take from your seat this month?";
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
