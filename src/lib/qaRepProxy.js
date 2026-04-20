import { invokeWorkerText } from "./../services/workerClient.js";

const DIRECT_ANSWER_TRIGGER = /show me data|need data|specific data|evidence|moderate renal impairment|renal impairment|renal dosing|egfr|multiple comorbidit|subgroup|excluded patient|real-world fit|workflow|what changes|what gets added|what staff|what does that add|what's the point|bottom line|operational|guideline|what am i missing|cost savings|justify the cost|readmissions|metrics|prior auth|prior authorization|specific outcomes|what outcomes|own patient population|my own population|what exactly|exact guideline language|one proof point|one key point|what specifically changes|what caused|what step gets added|biomarker|threshold|analysis|comorbidit/i;
const INITIAL_ACCESS_DIRECT_ASK_PATTERN = /what'?s this about|what is this about|why are we talking|why are you here|make this quick|can you make this quick|short version|few minutes|what do you need from me|what'?s the one thing you need to know|one thing you need to know|what's the relevance|what is the relevance|relevant to my practice|relevant to my clinic|what makes this relevant|what sets your product apart|what's the one thing that could slow care|one thing that could slow care|what specific barrier|what barrier are you looking for|what makes you think|what specific access step|what specific change/i;
const EXPECTATION_MISMATCH_PATTERN = /dr\.|patel|case discussion|case consult|referral|thought this was|was going to be|was supposed to be/i;
const INITIAL_ACCESS_OPERATIONAL_HELP_PATTERN = /prior auth|prior authorization|streamline|staff|workflow|paperwork|callbacks|extra step|operational/i;
const INITIAL_ACCESS_REDISCOVERY_PATTERN = /want to make sure i understand|help me understand|what'?s specifically frustrating|what is specifically frustrating|what'?s frustrating|what is frustrating|walk me through the workflow|where does it break|what part slows you down/i;
const ACCESS_PROCESS_DEMAND_PATTERN = /formulary|committee|review process|step therapy|non-preferred|what would move|what would change|take back|carry forward|prior auth|prior authorization|what staff|what gets added|what step/i;
const WORKFLOW_DEMAND_PATTERN = /workflow|staff|monitoring|follow-up|what happens next|who picks that up|who owns that|extra step|what does that add/i;
const WORKFLOW_REDISCOVERY_PATTERN = /what's a typical day|how do you currently|where do you think we could make the biggest impact|fit into your existing workflow|what part of the follow-up|what part of the monitoring|what would actually land on your team/i;
const CLOSE_PROOF_POINT_PATTERN = /proof point|concrete outcome|single data point|patient outcome|concrete|metric|what changes my patient outcome|what changes for my patients|changes practice|specific analysis|what analysis/i;
const DISCOVERY_DIRECT_ASK_PATTERN = /what patient characteristics|what patient type|which patients|good fit|ideal patient profile|define a good fit|what are you using to define|who are you actually talking about|what kind of patient|relevant to my patients|relevance to my patients|what makes you think your treatment is relevant|non-responders|not responding to current therapy|responding to current therapy|what specifically would change|patients i'm actually struggling with|not just theoretically eligible|patient profile that would make me switch|make me switch|specific patient subgroup|what subgroup|which subgroup|subgroup would actually benefit|specific subgroup|clinical gain|what benefit|what's distinct|what makes it distinct|what specific outcome would change|what outcome would change|change my treatment approach|what makes this patient different|this patient would be any different|change this patient'?s treatment|make me change this patient'?s treatment/i;
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

function normalizeForMatch(text = "") {
  return String(text || "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractIssueLabel(text = "") {
  const normalized = String(text).toLowerCase();
  if (/renal impairment|renal function|\brenal\b|kidney/.test(normalized)) return "renal impairment";
  if (/guideline/.test(normalized)) return "guideline fit";
  if (/cost savings|readmissions|expenditure|economic|cost-effectiveness|justify the cost|cost justification|metrics|specific outcomes|what outcomes|worth the spend/.test(normalized)) return "cost impact";
  if (/subgroup|patient population|excluded/.test(normalized)) return "patient-fit gap";
  if (/workflow|staff|added step|operational|prior auth|prior authorization/.test(normalized)) return "workflow burden";
  return "the gap you're pointing to";
}

function deriveProofPointCategory({ scenario, activeConcernText = "", turns = [] }) {
  const text = [
    activeConcernText,
    scenario?.objective,
    scenario?.description,
    scenario?.context,
    getLastRepText(turns),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/hospital|readmission|admission|er|ed\b|acute|discharge/.test(text)) {
    return "keeping the right patient out of the hospital";
  }
  if (/symptom|flare|control|exacerbation|disease activity|quality of life/.test(text)) {
    return "a patient-level symptom or flare reduction you would actually notice";
  }
  if (/prior auth|workflow|staff|handoff|approval|access|paperwork|callback/.test(text)) {
    return "one operational change that clearly cuts staff work or speeds approval";
  }
  if (/guideline|treatment choice|switch|decision|line of therapy|selection|subgroup/.test(text)) {
    return "one proof point that would actually change treatment choice for a real patient";
  }
  if (/screen|screening|eligible|candidate|identify/.test(text)) {
    return "one sign that helps you identify the right patient earlier";
  }
  return "one outcome you can tie to a real patient decision";
}

function deriveInitialAccessBarrier(scenario = {}, activeConcernText = "") {
  const text = [
    activeConcernText,
    scenario?.objective,
    scenario?.description,
    scenario?.context,
    scenario?.openingScene,
    ...(scenario?.interactionPressure || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/prior auth|prior authorization|coverage|access|formulary|approval/.test(text)) {
    return "prior auth work and approval delays";
  }
  if (/staff|workflow|handoff|callback|operational|follow-up/.test(text)) {
    return "the staff handoff that slows the start of care";
  }
  if (/screen|screening|identify|candidate|selection/.test(text)) {
    return "missing the right patient early enough to act";
  }
  return "the point in the workflow where staff gets pulled into rework before care can move forward";
}

function deriveInitialAccessOperationalChange(scenario = {}, activeConcernText = "") {
  const barrier = deriveInitialAccessBarrier(scenario, activeConcernText);

  if (/prior auth|approval|coverage|access/.test(barrier)) {
    return "a shorter approval path, fewer callbacks, and one cleaner handoff before staff has to chase the case again";
  }
  if (/staff handoff|workflow|handoff|callback/.test(barrier)) {
    return "one cleaner handoff, fewer back-and-forth steps, and less staff rework before the patient can move forward";
  }
  if (/patient early enough|identify/.test(barrier)) {
    return "a faster way to flag the right patient before the visit turns into another missed opportunity";
  }

  return "one cleaner operational step so the case does not bounce back through the office twice";
}

function deriveGuidelineDirectAnswer(activeConcernText = "") {
  const text = String(activeConcernText || "").toLowerCase();
  if (/exact guideline language|guideline update|guideline recommendation/.test(text)) {
    return "There is not one clean line of guideline language that changes practice on its own here";
  }
  if (/dose-adjust|dose adjustment|dose reduction|adjustment/.test(text)) {
    return "The clinical implication is whether the reduced dose still gives enough disease control to justify staying on treatment in the renal-impaired patient, instead of trading away too much benefit just to make dosing possible";
  }
  if (/renal impairment|renal function/.test(text)) {
    return "The trial still does not answer the renal question cleanly for the patients you are thinking about";
  }
  if (/subgroup|patient population|excluded|own patient population|my patient population/.test(text)) {
    return "The subgroup that matters is the harder-to-treat patient who still is not controlled on the standard path and whose renal burden, comorbidity load, or treatment complexity makes you question whether the usual evidence still applies cleanly";
  }
  if (/cost|readmission|hospitalization|value|outcomes/.test(text)) {
    return "The value story is still too broad unless it changes a real patient or utilization decision for you";
  }
  return "The evidence is still not specific enough to clear the decision bar you use in practice";
}

function deriveImplementationConcreteAnswer(activeConcernText = "", scenario = {}) {
  const text = [activeConcernText, scenario?.objective, scenario?.description, scenario?.context]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/who owns|who picks that up|staff member/.test(text)) {
    return "The step usually lands on the MA or prior auth support, which only helps if it removes a handoff instead of adding one";
  }
  if (/what happens next|what step gets added|extra step|what does that add/.test(text)) {
    return "The only next step worth discussing is the one that replaces rework, not another loose task for staff";
  }
  if (/monitoring|follow-up/.test(text)) {
    return "The practical test is whether follow-up stays inside the current workflow instead of creating a new staff touchpoint";
  }
  return "The practical value has to be one cleaner workflow step, not another task the team has to absorb";
}

function deriveDiscoveryPatientFitAnswer(activeConcernText = "", scenario = {}) {
  const text = [activeConcernText, scenario?.objective, scenario?.description, scenario?.context]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/what specific patient need|what patient need|what unmet need|need you'?re not already covering/.test(text)) {
    return "The fit would have to be the patient whose current disease burden or treatment gap still leaves a real unmet need, not someone who is already doing well enough on the current path";
  }
  if (/clinical gain|what benefit|what'?s distinct|what makes it distinct/.test(text)) {
    return "The gain would have to be a clearer clinical improvement in the patients who are still not doing well enough on the current path, not just a different option that sounds interesting on paper";
  }
  if (/what makes this patient different|this patient would be any different|change this patient'?s treatment|make me change this patient'?s treatment/.test(text)) {
    return "The difference would have to be a patient whose current response is still not good enough that a clearer clinical gain would justify changing treatment, not someone who looks only marginally different on paper";
  }
  if (/non-responders|not responding to current therapy|responding to current therapy/.test(text)) {
    return "The fit would have to be the patient who is still not responding well enough on the current path and where a change in treatment would have to produce a clearer clinical gain, not just a theoretical alternative";
  }
  if (/what specifically would change|what would change/.test(text)) {
    return "The fit would have to be the patient where a treatment change would lead to a clearer clinical improvement you would actually notice, not just another option that sounds reasonable on paper";
  }
  if (/what specific patient characteristic|what patient characteristic|which characteristic|what characteristic/.test(text)) {
    return "The fit would have to be the patient whose clinical profile gives you a reason to change course, not someone who is only broadly eligible on paper";
  }
  if (/renal|comorbid|excluded|subgroup/.test(text)) {
    return "The fit would have to be the patient who still sits inside the evidence base, not the one whose renal or comorbidity profile pushes them outside it";
  }
  if (/screen|identify|candidate|selection/.test(text)) {
    return "The fit would have to be the patient whose chart gives you a concrete reason to act now, not someone you have to stretch to justify";
  }
  if (/workflow|access|prior auth/.test(text)) {
    return "The fit would have to be the patient where the added workflow is still realistic for the office to carry";
  }
  if (/early career|newer attending|building prescribing patterns|curious and open to guidance/.test(text)) {
    return "The fit would have to be the patient who is still not doing well enough on the current path and gives you a real reason to change treatment, not someone who is merely eligible in theory";
  }

  return "The fit would have to be the patient who actually matches the evidence and gives you a reason to change treatment, not just someone who is broadly eligible on paper";
}

function deriveCommitmentDirectAnswer(activeConcernText = "", proofPointCategory = "") {
  const text = String(activeConcernText || "").toLowerCase();
  if (/single metric|what one metric|what metric|single data point|what data point|concrete proof point|single proof point/.test(text)) {
    if (/hospital|readmission|admission|er\b|ed\b/.test(text)) {
      return "The single metric would be a hospitalization or readmission reduction large enough that you would actually change who you treat or how urgently you move, not just a broad utilization headline";
    }
    return "The single proof point would be one patient-level outcome you would actually use to change treatment choice, not a general positive trend from the slide deck";
  }
  if (/hospital|readmission|admission|er\b|ed\b/.test(text)) {
    return "The proof point has to be a hospitalization change large enough to alter what you would do for a real patient";
  }
  if (/guideline|treatment choice|decision|line of therapy|selection/.test(text)) {
    return "The proof point has to change a treatment decision you would actually make, not just add one more favorable line to a slide";
  }
  if (/symptom|flare|control|quality of life/.test(text)) {
    return "The proof point has to show a patient-level change you would actually notice in follow-up";
  }
  if (/workflow|prior auth|staff|access|formulary/.test(text)) {
    return "The proof point has to remove a real operational barrier, not just sound directionally helpful";
  }
  return `The proof point has to change something you would actually use in practice, ideally ${proofPointCategory}`;
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
    return (
      INITIAL_ACCESS_DIRECT_ASK_PATTERN.test(activeConcernText) ||
      EXPECTATION_MISMATCH_PATTERN.test(activeConcernText) ||
      INITIAL_ACCESS_OPERATIONAL_HELP_PATTERN.test(activeConcernText) ||
      repeatedConcern
    ) && (draftTooLoose || /\?$/.test(draftText) || INITIAL_ACCESS_REDISCOVERY_PATTERN.test(draftText));
  }

  if (stage === "access_formulary") {
    return (ACCESS_PROCESS_DEMAND_PATTERN.test(activeConcernText) || repeatedConcern) && draftTooLoose;
  }

  if (stage === "adoption_implementation") {
    return (WORKFLOW_DEMAND_PATTERN.test(activeConcernText) || repeatedConcern) && (draftTooLoose || WORKFLOW_REDISCOVERY_PATTERN.test(draftText));
  }

  if (stage === "discovery") {
    return (DISCOVERY_DIRECT_ASK_PATTERN.test(activeConcernText) || repeatedConcern) && (draftTooLoose || /\?$/.test(draftText));
  }

  return false;
}

function buildDeterministicFamilyAnswerReply({ scenario, turns }) {
  const stage = String(scenario?.journeyStage || "").toLowerCase();
  const activeConcernText = normalizeForMatch(getActiveConcernText(turns, scenario));
  const repTurns = turns.filter((turn) => turn?.speaker === "rep").length;
  const initialAccessBarrier = deriveInitialAccessBarrier(scenario, activeConcernText);
  const initialAccessChange = deriveInitialAccessOperationalChange(scenario, activeConcernText);

  if (stage === "initial_access") {
    if (/what makes you think .* is (still )?the issue here|why do you think .* is our problem|what makes you think .* is our problem|what makes you think staff handoff is still the issue here|what makes you think staff handoff is our problem/.test(activeConcernText)) {
      return `The reason to test ${initialAccessBarrier} first is that it is often the point where staff gets pulled into extra callbacks, rework, or handoffs before care can move forward. If that is not happening in your clinic, then I am on the wrong issue.`;
    }
    if (repTurns <= 1 && /what'?s the one thing you need from me|what do you need from me|what'?s the one thing i should know|one thing i should know|what'?s the one thing that could slow care|one thing that could slow care/.test(activeConcernText)) {
      return `The one thing to know is whether ${initialAccessBarrier} is the step slowing care in your clinic. If it is not, then this is not worth your time.`;
    }
    if (/what'?s the one thing that could slow care|one thing that could slow care|what'?s the one thing slowing care|what thing could slow care/.test(activeConcernText)) {
      return `The one thing that usually slows care is ${initialAccessBarrier}. If that is not the bottleneck in your clinic, then this is not worth another minute.`;
    }
    if (/what'?s the one thing you need from me|what do you need from me|what'?s the one thing you need to know|one thing you need to know/.test(activeConcernText)) {
      return `The one thing I need to know is whether ${initialAccessBarrier} is still slowing care in your clinic. If it is not, we can stop there.`;
    }
    if (/what'?s the one step that saves me time|what will actually save me time|one step that makes a difference in my workflow|one thing that'?s going to make a difference in my workflow|what step will actually save me time|still not seeing the time savings|time savings here/.test(activeConcernText)) {
      return `The one step that should save time is ${initialAccessChange}. If it does not reduce that handoff or callback burden in your clinic, then it is not worth another minute.`;
    }
    if (/relevant to my practice|relevant to my clinic|what makes this relevant|what sets your product apart/.test(activeConcernText)) {
      return `What makes this relevant is whether it leads to ${initialAccessChange}. If it does not change that in your clinic, then it is not different enough to matter.`;
    }
    if (INITIAL_ACCESS_OPERATIONAL_HELP_PATTERN.test(activeConcernText)) {
      if (repTurns >= 2) {
        return `Then the practical value has to be operational, not promotional. The concrete change would have to be ${initialAccessChange}.`;
      }
      return `Then the only reason to keep talking is if this helps with the prior auth work itself, not if it adds to it. The concrete value would have to be ${initialAccessChange}.`;
    }
    if (EXPECTATION_MISMATCH_PATTERN.test(activeConcernText)) {
      if (repTurns >= 2) {
        return "You're right, this did not land like the case discussion you expected. The only reason I'm here is to see whether one practical barrier is getting in the way of care, and if it is not, we can stop there.";
      }
      return "You're right, this did not land like the case discussion you expected. The only reason I'm here is to see whether one practical barrier is slowing care enough to matter in your clinic.";
    }
    if (/what specific barrier|what barrier are you looking for|what makes you think/.test(activeConcernText)) {
      if (repTurns >= 2) {
        return `The barrier I'm pressure-testing is ${initialAccessBarrier}. If that is not the issue in your clinic, I'll stop there instead of forcing this wider.`;
      }
      return `The barrier I'm pressure-testing is ${initialAccessBarrier}, because that is the kind of bottleneck that can quietly slow care before anyone means for it to.`;
    }
    if (/what specific access step|what specific change/.test(activeConcernText)) {
      return `The specific change would have to be ${initialAccessChange}. If it does not do that, it is not worth another minute of your time.`;
    }
    if (/what step gets added|what gets added|what changes for my staff|what changes for staff|what changes for me in the room/.test(activeConcernText)) {
      return `The only reason this matters is if it leads to ${initialAccessChange}. If it adds another step instead of doing that, it is not useful.`;
    }
    if (/what'?s this about|what is this about|why are you here|why are we talking/.test(activeConcernText)) {
      if (repTurns >= 2) {
        return `This is still about whether ${initialAccessBarrier} is slowing care enough to matter in your clinic. If that is not the issue here, we can stop there.`;
      }
      return `This is about whether ${initialAccessBarrier} is slowing care enough to be worth your time. If that is not actually happening here, this is not worth another minute.`;
    }
    if (/make this quick|short version|few minutes|patient waiting|brief/.test(activeConcernText)) {
      if (repTurns >= 2) {
        return `The short version is I'm trying to see whether ${initialAccessBarrier} is the thing slowing care, not pitch at you. If it is not, we can stop right there.`;
      }
      return `The short version is I'm trying to see whether ${initialAccessBarrier} is getting in the way of care. If it is not, this should end quickly.`;
    }
    return `This is about whether ${initialAccessBarrier} is worth solving in your clinic, not a broad product discussion.`;
  }

  if (stage === "access_formulary") {
    if (/what('?s| is) the one concrete thing|one concrete thing|exact formulary takeaway|what can i take back|what should i take back|committee-facing|proof item|what concrete item|what exactly do i bring back/.test(activeConcernText)) {
      return "The concrete thing to take back is one committee-facing summary that shows which patient group changes, what outcome improves in that group, and why that makes the current restriction harder to defend.";
    }
    if (/formulary|committee|review process|take back|carry forward|non-preferred|step therapy/.test(activeConcernText)) {
      if (repTurns >= 2) {
        return "The only useful next move is a concrete formulary takeaway: one committee-facing summary of the specific patient group, the clinical outcome that improved, and the reason that would justify revisiting the restriction.";
      }
      return "The real issue is not another value story. The thing worth taking back is one committee-facing proof item that names the patient group, the outcome that changed, and why that should change the formulary discussion.";
    }
    if (repTurns >= 2) {
      return "The blocker is still the access step itself, not the clinical rationale. If this moves at all, it has to change one real process condition first.";
    }
    return "The blocker is the access step itself, not whether the therapy works on paper. The only useful discussion now is which part of that process is stopping movement.";
  }

  if (stage === "adoption_implementation") {
    if (/staff|workflow|monitoring|follow-up|what happens next|who picks that up|who owns that/.test(activeConcernText)) {
      if (repTurns >= 2) {
        return `${deriveImplementationConcreteAnswer(activeConcernText, scenario)}. If that does not hold, this is still a workflow problem.`;
      }
      if (repTurns >= 1) {
        return `${deriveImplementationConcreteAnswer(activeConcernText, scenario)}. The real question is whether it removes a handoff or creates one.`;
      }
      return `${deriveImplementationConcreteAnswer(activeConcernText, scenario)}. If that lands on the team as extra work, it is still the wrong fit.`;
    }
    return "The main question is whether this is workable in practice, not whether the idea makes sense. The only thing worth testing is whether it reduces the staff burden instead of widening it.";
  }

  if (stage === "discovery") {
    if (/what specific clinical profile would make me change course|what specific clinical profile makes you think i'?d change course|what clinical profile would make me switch, not just any patient|what clinical profile would make me switch|clinical profile makes you think i'd change course/.test(activeConcernText)) {
      return "The clinical profile would have to be the patient who is still not controlled well enough on the current treatment and whose disease burden or treatment response is poor enough that staying on the same path no longer makes clinical sense.";
    }
    if (/what specific patient issues are you trying to address|what specific issues are you trying to fix|what should i care about right now|what issues are you trying to fix that i should care about|what specific issues are you trying to address/.test(activeConcernText)) {
      return "The issue to care about is the patient who is still not meeting goals on the current path and where staying put no longer makes clinical sense because the current approach is not controlling the problem well enough.";
    }
    if (/what makes this patient distinct enough to change course|what specific treatment challenges make a patient distinct enough to change course|what specific patient factor makes them distinct enough|what'?s the one thing that would make me change course for a patient|what one thing would make me change course for a patient|what patient factor would make me change course/.test(activeConcernText)) {
      return "The thing that should make you change course is a patient who is still not doing well enough on the current treatment because the current path is no longer controlling the problem well enough to justify staying with it.";
    }
    if (repTurns <= 1 && /what makes you think your treatment is relevant to my patients|what makes you think this is relevant to my patients|why is this relevant to my patients/.test(activeConcernText)) {
      return "The patient would have to be someone who is still not doing well enough on the current path that a change in treatment would be worth considering, not someone who is only technically eligible.";
    }
    if (/what specific outcome would make me change course|what specific outcome would change|what outcome would change|change my treatment approach|what clinical gain would matter|what benefit would make me switch|what'?s the specific outcome that would make me change course|what specific clinical gain|what benefit would actually make me switch/.test(activeConcernText)) {
      return "The outcome would have to be a clear enough clinical gain in the patients who are still not doing well on the current path that it would justify changing treatment, not just add another theoretical option.";
    }
    if (DISCOVERY_DIRECT_ASK_PATTERN.test(activeConcernText)) {
      if (repTurns >= 2) {
        return `${deriveDiscoveryPatientFitAnswer(activeConcernText, scenario)}. If the evidence cannot isolate that kind of patient clearly enough to change your decision, then it is still too broad to be useful.`;
      }
      return `${deriveDiscoveryPatientFitAnswer(activeConcernText, scenario)}. The real test is whether that patient is distinct enough that you would actually change course instead of staying on the current path.`;
    }
    return "The first useful step is getting specific about which patient actually creates the decision, not staying broad.";
  }

  return "Let me keep this on the one practical issue that matters here. The only thing worth testing is where the current workflow still breaks down.";
}

function buildDeterministicEvidenceFitReply({ scenario, turns }) {
  const activeConcernText = getActiveConcernText(turns, scenario);
  const issueLabel = extractIssueLabel(activeConcernText);
  const lowerConcern = normalizeForMatch(activeConcernText);
  const repTurns = turns.filter((turn) => turn?.speaker === "rep").length;
  const hcpTurns = turns.filter((turn) => turn?.speaker === "hcp").length;
  const scenarioEvidenceText = normalizeForMatch([
    scenario?.objective,
    scenario?.description,
    scenario?.context,
    scenario?.openingScene,
    ...(scenario?.keyChallenges || []),
    ...(scenario?.interactionPressure || []),
  ].filter(Boolean).join(" "));

  if (hcpTurns === 0 && repTurns === 0) {
    if (/renal|kidney|egfr|gfr|dose adjustment|dose reduction|moderate renal impairment/.test(scenarioEvidenceText)) {
      return "The issue is whether the renal-impaired patient still keeps enough benefit after dose adjustment to justify treatment, because the current study does not answer that cleanly for the patients you actually manage.";
    }
    if (/guideline|subgroup|comorbid|generalizable|patient population/.test(scenarioEvidenceText)) {
      return "The issue is whether the subgroup behind the data actually matches the more complex patients who drive treatment decisions in your practice, because if it does not, the evidence still does not justify changing course.";
    }
    if (/cost|readmission|hospitalization|value|outcomes/.test(scenarioEvidenceText)) {
      return "The issue is whether the data changes a real patient or utilization decision in practice, because without that, the value story still does not justify changing what you do now.";
    }
  }

  if (/timeline|earliest|when can.*subgroup|when will.*subgroup|concrete timeline|concrete plans/.test(lowerConcern) && /subgroup|renal|kidney/.test(lowerConcern)) {
    return "I do not have a committed subgroup-results date I can defend today. The strongest concrete answer I can give is that the next step has to be starting the dedicated renal subgroup analysis now and only revisiting the decision once that stratified efficacy and safety readout is actually available.";
  }

  if (/prior auth workflow|prior authorization workflow|workflow for this medication|prior auth process/.test(lowerConcern)) {
    return "The workflow only matters if the renal-adjusted patient still has enough expected benefit to justify pushing through prior auth at all. If the evidence still does not tell you that, the workflow argument does not rescue the decision.";
  }

  if (/plan to study renal impairment|close the renal evidence gap|knowledge gap on renal safety|through your clinical trials or post-marketing studies|plan for studying renal impairment/.test(lowerConcern)) {
    return "The plan would have to be a dedicated renal-impairment cohort or follow-up analysis that tracks dose adjustment, renal safety, and retained clinical benefit in the patients who were excluded or underrepresented in the original study. Until that reads out, the interim position is that the current dataset still leaves the renal decision open.";
  }

  if (/timeline for those dosing adjustment studies|timeline for dosing adjustment studies|interim plan for dosing adjustments|what's the interim plan for dosing adjustments|what is the interim plan for dosing adjustments|what's the timeline for those dosing adjustment studies|timeline for renal studies|timeline for the renal studies/.test(lowerConcern)) {
    return "The near-term plan would have to be a renal-specific follow-up cohort with predefined dose-adjustment and renal-safety endpoints. Until that reads out, the interim position is that the current dataset is not strong enough to treat the renal-impaired patient as if the question is settled.";
  }

  if (/plan for dosing adjustments in renal-impaired patients|dosing adjustments in renal-impaired patients|how will you handle dosing adjustments in renal-impaired patients/.test(lowerConcern)) {
    return "The credible plan would be a renal-specific dosing program with predefined adjustment rules, renal-safety tracking, and retained-benefit readouts. Until that dataset is in hand, the current evidence does not give you a clean renal-adjusted dosing answer.";
  }

  if (/actual reduction in adverse events|what'?s the actual reduction in adverse events|reduction in adverse events with that dose adjustment|actual adverse-event reduction/.test(lowerConcern)) {
    return "That exact renal-specific adverse-event reduction is not established cleanly in the current dataset. That is still part of the evidence gap, because you do not have a renal-adjusted safety readout strong enough to anchor treatment choice.";
  }

  if (/what'?s the actual renal benefit|what is the actual renal benefit|actual benefit for my moderate renal impairment patients|actual benefit for my renal patients|benefit for my moderate renal impairment patients|benefit for my renal patients/.test(lowerConcern)) {
    if (repTurns >= 4) {
      return "I cannot responsibly tell you there is a proven renal-specific benefit for the moderate renal-impairment patients you actually manage. Until there is a renal subgroup readout after dose adjustment, I would not present this as practice-changing for that population.";
    }
    return "The actual renal benefit is still not proven cleanly enough in the moderate renal-impairment subgroup, because the study does not give a renal-specific efficacy readout after dose adjustment that tells you how much benefit remains for the patients you actually manage.";
  }

  if (/what'?s the threshold for dose adjustment in moderate renal impairment|what'?s the dosing adjustment for moderate renal impairment|threshold for dose adjustment in moderate renal impairment|actual renal impairment threshold that triggers a dose adjustment|how do you define the renal impairment threshold that triggers a dose adjustment|renal impairment threshold that triggers a dose adjustment/.test(lowerConcern)) {
    return "That threshold is still not defined cleanly in the current dataset. The study supports dose reduction in moderate renal impairment, but it does not give a validated renal cutoff that tells you exactly when the adjusted dose still preserves enough benefit to justify treatment.";
  }

  if (/what subgroup data do you have|subgroup data for patients with moderate renal impairment|subgroup analysis for moderate renal impairment|moderate renal impairment subgroup analysis|show me the renal function subgroup analysis|renal function subgroup analysis|show me the actual numbers for moderate renal impairment|actual numbers for moderate renal impairment|actual numbers for my patient population|numbers for my patient population|what numbers do you have for my patient population|show me actual numbers, not just claims|closest renal-specific data|closest renal specific data|closest renal-specific outcome|closest renal specific outcome/.test(lowerConcern)) {
    if (repTurns >= 4) {
      return "You're right to hold on the moderate renal subgroup. We still do not have renal-specific subgroup numbers for the patients you are focused on, so I cannot tell you this is proven for that subgroup yet, and the responsible position today is not to over-apply the broader dataset to your renal patients.";
    }
    return "You're right to ask for the subgroup data directly. We do not have a renal-specific subgroup readout with numbers strong enough for the moderate renal-impairment patients you are talking about, so I cannot tell you this is established for that subgroup today. The next credible step would have to be a dedicated renal subgroup analysis or follow-up cohort, because until that exists the evidence still does not clear the bar for your patient population.";
  }

  if (/exacerbations in severe asthmatics|severe asthmatics|severe asthma subgroup|severe asthma data|exacerbation data/.test(lowerConcern)) {
    return "You're right to ask for the severe-asthma outcome data directly. We do not have a subgroup analysis clean enough to tell you how much exacerbation reduction holds in the severe asthmatics driving your decision, so I cannot present that as established today. The next credible step would have to be a dedicated subgroup analysis or follow-up dataset that isolates those patients and reports the exacerbation outcome cleanly.";
  }

  if (/that subgroup is exactly who i'm worried about|that subgroup is still my concern|that subgroup analysis is exactly what i need to see|that subgroup analysis is still my priority|that subgroup analysis is still missing|that subgroup analysis is crucial|still waiting on that subgroup analysis|still waiting for that subgroup analysis|what's the data on those subgroups|what is the data on those subgroups|data on those subgroups|i need subgroup data to move forward|still no subgroup data|subgroup data i need|still need to see more robust subgroup analysis|robust subgroup analysis|more detailed breakdown of the patient subsets|detailed breakdown of the patient subsets|more detailed breakdown of the patient populations|detailed breakdown of the patient populations|specific insights i need|i'm still missing the specific insights i need|i need that subgroup analysis to make a decision|i still need that subgroup analysis|i still need that subgroup analysis to make a decision|that still doesn't give me the subgroup analysis i need|still no subgroup analysis for my patients|still unclear on renal subgroup benefits|still waiting for subgroup data on moderate renal impairment/.test(lowerConcern)) {
    if (/i need subgroup data to move forward|still no subgroup data|subgroup data i need|specific insights i need|i'm still missing the specific insights i need|particular population i see in my practice|i need that subgroup analysis to make a decision|i still need that subgroup analysis|i still need that subgroup analysis to make a decision|that still doesn't give me the subgroup analysis i need|still no subgroup analysis for my patients|still waiting for that subgroup analysis|still unclear on renal subgroup benefits|still waiting for subgroup data on moderate renal impairment/.test(lowerConcern)) {
      if (/specific insights i need|i'm still missing the specific insights i need|particular population i see in my practice/.test(lowerConcern)) {
        return "The specific insight still missing for your population is a renal-specific subgroup readout showing whether the dose-adjusted patients with moderate renal impairment keep enough benefit and acceptable renal safety to justify treatment. Until that subgroup readout exists, I cannot tell you the evidence applies cleanly to the population you actually manage.";
      }
      return "You're right not to move forward without that subgroup readout. The honest answer is that you should not move forward for the moderate renal-impairment subgroup until that renal-specific subgroup analysis exists, because without it I cannot tell you the current dataset is strong enough to support a treatment change for those patients.";
    }
    return "You're right that the subgroup analysis is still the open issue. We do not have a renal-specific subgroup analysis with stratified efficacy and safety for the moderate renal-impairment patients you are focused on, so until that readout exists I cannot tell you this is established for the patients driving your decision.";
  }

  if (/show me the pooled dataset|pooled dataset|show me the actual numbers for that pooled dataset|actual numbers for that pooled dataset|show me the numbers now|show me the numbers, now/.test(lowerConcern)) {
    return "I can show you the broader pooled dataset, but it still would not answer the moderate renal-impairment question cleanly because it is not a renal-specific subgroup analysis with stratified efficacy and safety. That is why the pooled data still falls short for the patients you are focused on.";
  }

  if (/what'?s the data look like for that specific subgroup|what'?s the closest subgroup you have to moderate renal impairment|closest subgroup you have to moderate renal impairment|closest real-world data you have to moderate renal impairment|closest real-world outcome for moderate renal impairment|closest real-world outcome/.test(lowerConcern)) {
    if (repTurns >= 4) {
      return "The closest data still is not close enough for me to tell you this is established in moderate renal impairment. Without a renal-specific subgroup or real-world renal outcome set after dose adjustment, I would not ask you to treat that subgroup as if the evidence question were settled.";
    }
    return "The closest thing we have is a broader subgroup or pooled dataset, but not a renal-specific moderate impairment analysis with stratified efficacy and safety. That is exactly why the evidence still does not answer the renal question cleanly enough for the patients you are describing.";
  }

  if (/what'?s the plan to address it|what'?s the plan to get that subgroup data|plan to get that subgroup data|what'?s the plan to get that subgroup analysis|what'?s the plan for getting that subgroup analysis|what'?s the plan to get that renal subgroup analysis|what'?s the plan for getting that renal subgroup analysis|what'?s the plan to get that subgroup analysis to me|what'?s the plan to get that subgroup analysis done within the next quarter|plan to get that subgroup analysis|plan for getting that subgroup analysis|plan to get that renal subgroup analysis|plan for getting that renal subgroup analysis|plan to get that subgroup analysis to me|plan to get that subgroup analysis done within the next quarter|what'?s the plan to get renal-specific data for my patients|plan to get renal-specific data for my patients|what'?s the plan to get that renal data|plan to get that renal data|still my concern, what'?s the plan to address it|plan to address the subgroup|still doesn't answer my renal question|still does not answer my renal question/.test(lowerConcern)) {
    return "You're right that without renal-specific data the decision is still open. The only credible plan is a dedicated renal-impairment subgroup analysis or follow-up cohort that reports stratified efficacy, renal safety, and retained benefit after dose adjustment in the moderate renal-impairment patients you actually manage. Until that analysis exists, I would not treat the current dataset as decision-level evidence for your renal patients.";
  }

  if (/what'?s the timeline for it|what'?s the timeline for the subgroup analysis|what'?s the timeline for that subgroup analysis|what'?s the timeline for that dedicated renal subgroup analysis|what'?s the earliest i can expect that subgroup analysis|what'?s the earliest i can expect to see that renal subgroup analysis|what'?s the earliest i can expect concrete subgroup results|what'?s the earliest you can get that subgroup analysis started|what'?s the earliest i can expect concrete subgroup data|earliest i can expect that subgroup analysis|i need that subgroup analysis now, not later|need that subgroup analysis now|how soon can i expect that subgroup analysis|when will that subgroup analysis be available|when will those subgroup results be available|when can i anticipate seeing the detailed breakdown|when can i expect subgroup results|when can i expect those subgroup results|when can we expect those renal subgroup results|concrete plans for when we can expect those renal subgroup results|concrete plans for when we can expect subgroup results|you still haven't given me a timeline|i need a timeline for that subgroup analysis now|i need a timeline now|peer-reviewed journal|peer reviewed journal|within the next quarter|how do you intend to address the knowledge gap on subgroup outcomes|knowledge gap on subgroup outcomes/.test(lowerConcern)) {
    if (repTurns >= 5) {
      return "You're right to press on the timetable. I do not have a committed subgroup-results date I can defend today, and I do not want to invent one. The strongest concrete answer I can give is that the next step has to be starting the dedicated renal subgroup analysis now and only revisiting the decision once that stratified efficacy and safety readout is actually available.";
    }
    return "There is not a subgroup-analysis readout you can use today. The earliest credible next step is to start a dedicated renal-impairment subgroup analysis or follow-up cohort with stratified efficacy, renal safety, and retained-benefit endpoints, then revisit the decision once that subgroup readout is actually in hand.";
  }

  if (/how this applies to my patients with renal issues|accounts? for renal impairment|accounts? for the potential risks in patients with compromised renal function|how does your data account for renal impairment|how does your data account for renal function|moderate renal impairment|moderate kidney function impairment|renal implications.*patient population|renal implications that are most relevant to my patient population/.test(lowerConcern)) {
    if (/still doesn't tell me how this applies to my patients with renal issues|still doesn't address my patients with renal issues|still doesn't apply to my renal patients|doesn't apply to my renal patients|that still doesn't help my patients with moderate renal impairment|that's not enough for my patients with moderate renal impairment|that's still not enough for my patients|still not enough for my patients with renal issues|doesn't address my moderate renal impairment|moderate renal impairment concern|renal patients|kidney disease are a significant portion of my practice|compromised renal function|my renal patients have unique challenges/.test(lowerConcern)) {
      if (repTurns >= 4) {
        return "You're right that the renal question is still unresolved for your patients. At this point the defensible clinical position is that the renal-impaired subgroup is still not proven well enough to treat as if the question were settled. Until the study shows renal-specific subgroup numbers, threshold data, or real-world renal outcomes after dose adjustment, the evidence still does not support treating that subgroup as clearly de-risked.";
      }
      if (repTurns >= 3) {
        return "You're right that the remaining gap is not the general rationale. It is the missing subgroup readout in the moderate renal-impairment patients you actually treat, and until that subgroup is isolated, the data still does not apply cleanly enough to your renal patients.";
      }
      return "You're right to ask how this applies to your actual renal patients. The applicability gap is that the study still does not isolate the moderate renal-impairment patients you actually treat, so it leaves open whether the benefit still justifies treatment once dosing is adjusted for that subgroup.";
    }
    if (/that still doesn't give me the renal data i need|still no renal data/.test(lowerConcern)) {
      return "You're right that the missing renal dataset is the blocker now. Without renal-specific subgroup numbers or real-world renal outcomes after dose adjustment, I cannot tell you this is decision-level evidence for the patients you actually manage. The only credible next step is the dedicated renal subgroup analysis.";
    }
    if (/still no renal data, so i'm not convinced|still no clear renal data, so i'm not convinced|i need concrete subgroup results, not promises|i remain skeptical without seeing any outcomes related to kidney function/.test(lowerConcern)) {
      return "You're right to hold the line there. Without renal-specific subgroup numbers, threshold data, or outcomes tied to kidney function after dose adjustment, the defensible clinical position is still not to treat the renal-impaired subgroup as proven enough to change practice.";
    }
    if (repTurns >= 4) {
      return "You're right that the missing renal dataset is the blocker now. We still do not have the renal-specific numbers or real-world renal readout you would need for the moderate renal-impairment patients you actually manage, which is why the evidence still does not clear your bar.";
    }
    if (repTurns >= 3) {
      return "You're right that the missing threshold and subgroup readout are the real blockers now. We still do not have a validated renal threshold or subgroup readout that tells you where the benefit clearly holds up after dose adjustment in moderate renal impairment, which is why the evidence still feels incomplete for your patients.";
    }
    return "You're right that it still does not apply cleanly enough to your renal-impaired patients, because the study does not prove how much benefit remains once dosing is adjusted for the people you actually treat.";
  }

  if (/what specific data do you have that changes my current approach|what specific data justifies deviating from current guidelines|what specific data justifies deviating from the established treatment guidelines|what specific data do you have to change my practice|what specific evidence do you have that changes my current practice/.test(lowerConcern)) {
    return "The data that would change practice is the subgroup analysis in the harder-to-treat patients who were still not controlled on the standard path, because that is the part of the study that could justify a different treatment decision instead of just supporting the usual guideline path.";
  }

  if (/real-world renal data|what real-world renal data do you have|what renal data do you have for patients like mine|renal data do you have that's relevant to my patients/.test(lowerConcern)) {
    if (repTurns >= 4) {
      return "The remaining missing piece is a renal-specific real-world dataset showing how the moderate renal-impairment patient actually does after dose adjustment in practice. Until that dataset exists, I cannot tell you this changes care confidently for those patients, and I would not present it that way.";
    }
    return "We do not have a clean real-world renal dataset that tells you how the renal-impaired patient performs after dose adjustment in practice. That missing renal-specific readout is still the reason the evidence does not clear your decision bar.";
  }

  if (/specific egfr threshold|egfr threshold|gfr threshold|threshold where dose reduction still justifies treatment|what'?s the e?gfr threshold|what'?s the gfr threshold|exact threshold for switching treatments|what'?s the actual renal impairment threshold where this still works|at what level of kidney function does the efficacy.*drop off|what'?s the exact gfr threshold where efficacy drops off|where efficacy drops off/.test(lowerConcern)) {
    return "That threshold is exactly the problem: the study supports dose reduction in moderate renal impairment, but it does not give a clean eGFR cutoff where you can say the lower dose still preserves enough benefit to justify treatment for every patient.";
  }

  if (/what specific comorbidities did the study account for|what comorbidities did this study account for|what comorbidities were included|what comorbidities were represented/.test(lowerConcern)) {
    return "It reflects the cleaner patients better than the higher-burden patients with layered renal disease, cardiovascular burden, and multi-comorbidity that usually make the treatment choice difficult in practice. That is why the results still feel incomplete for the patients you are thinking about.";
  }

  if (/how the patient population.*reflects the complexity i see in my own practice|reflect the complexity i see in my own practice|how does the study population reflect the complexity i see in practice|generalizable/.test(lowerConcern)) {
    return "It does not reflect that complexity cleanly enough yet, because the study population still looks closer to the cleaner trial patient than to the renal-burdened, multi-comorbid patient who actually forces the harder treatment decision in practice.";
  }

  if (/what('?s| is) the specific subgroup|what specific subgroup|what subgroup data|specific subgroup data|which subgroup|what specific patient subgroup|what subgroup does this data actually apply to|what subgroup does this data apply to/.test(lowerConcern)) {
    return "The subgroup that would matter is the patient who still is not controlled on the standard path and whose renal burden, comorbidity load, or treatment complexity makes you question whether the usual evidence still applies cleanly. If the data does not isolate that subgroup, it still does not change treatment choice.";
  }

  if (/actual efficacy in renal-impaired patients|efficacy in renal-impaired patients|how does that dosing adjustment impact efficacy|what actual efficacy/.test(lowerConcern)) {
    if (repTurns >= 4) {
      return "I cannot give you a renal-specific efficacy claim after dose adjustment that would justify changing practice today. The study does not provide a clean enough renal readout for that, so the honest position is that the efficacy question in those patients is still open.";
    }
    return "That is still part of the evidence gap: the study does not give a clean renal-specific efficacy readout after dose adjustment that is strong enough to tell you exactly how much benefit remains in those patients.";
  }

  if (/how does that subgroup analysis account for renal function|how does renal function impact treatment in your study|what'?s the actual impact on my patients'? renal function|actual impact on my patients'? renal function|renal dosing adjustment|what'?s the dosing adjustment for renal impairment|actual dose adjustment for renal impairment|what'?s the actual dose adjustment for moderate renal impairment|what is the actual dose adjustment for moderate renal impairment|actual dose adjustment for moderate renal impairment/.test(lowerConcern)) {
    if (/what'?s the actual dose adjustment for moderate renal impairment|what is the actual dose adjustment for moderate renal impairment|actual dose adjustment for moderate renal impairment/.test(lowerConcern)) {
      return "The dose adjustment is to reduce the starting dose by 50% in moderate renal impairment, but the unresolved issue is whether that reduced dose still preserves enough benefit to justify treatment for the renal-impaired patient you actually see.";
    }
    if (repTurns >= 4) {
      return "The actual renal impact is still not resolved cleanly enough for me to tell you the lower dose preserves enough benefit in the moderate renal-impairment patient. That is why I would not present the renal-adjusted regimen as a settled practice answer yet.";
    }
    return "The renal issue is that the study supports a lower starting dose in moderate renal impairment, but it still does not tell you clearly enough whether the reduced dose preserves enough control to justify treating that patient rather than staying on the current path.";
  }

  if (/dose-adjust|dose adjustment|dose reduction|adjustment/.test(lowerConcern)) {
    return "You're asking whether the dose reduction still leaves enough benefit to justify treatment in the renal-impaired patient you actually see. If the lower dose protects tolerability but weakens control too much, it does not change the decision in your favor.";
  }

  if (/what specific patient outcome improvement|what specific outcome improvement|tangible benefit|patient outcomes compared to what i'm currently using|what'?s the exact threshold that changes treatment|what'?s the exact egfr threshold for that subgroup|renal threshold that changes treatment|what'?s the exact renal threshold where i need to switch treatment|what'?s the exact renal threshold where i need to switch treatments|what'?s the specific renal threshold that changes my treatment choice|what'?s the exact threshold that changes my treatment decision|at what specific point does the data suggest i should switch|dose adjustment for renal impairment/.test(lowerConcern)) {
    if (repTurns >= 3) {
      return "There is not a validated renal threshold or outcome cutoff in this dataset that tells you exactly when the benefit still justifies treatment in the higher-risk renal patient. That is the unanswered piece blocking a real treatment decision.";
    }
    return "The outcome would have to change something you would actually notice in the patient, not just move a broad study average. If it does not change treatment choice or follow-up for the patient in front of you, it is still too soft.";
  }

  if (issueLabel === "renal impairment") {
    if (repTurns >= 5) {
      return "You're right to keep pressing on the missing renal evidence. At this point the responsible clinical position is not to claim decision-level renal evidence that the dataset does not actually provide. Until there are renal-specific subgroup numbers, threshold data, or real-world outcomes after dose adjustment, I would not represent the moderate renal-impairment subgroup as clearly cleared for treatment change.";
    }
    if (repTurns >= 4) {
      return "At this point the clinically defensible position is that the renal-impaired subgroup is still not proven well enough to treat as if the question were closed. Without renal-specific subgroup numbers, threshold data, or real-world outcomes after dose adjustment, the evidence still does not clear that subgroup for practice.";
    }
    if (repTurns >= 3) {
      return "The real renal gap now is that you still do not have a subgroup readout or threshold that tells you where the benefit clearly holds up after dose adjustment in the patient with moderate renal impairment.";
    }
    return "It still does not tell you clearly enough whether the renal-impaired patient keeps enough benefit after dose adjustment to justify treatment in practice. Until that is clearer, the evidence still feels incomplete for the patients you actually worry about.";
  }

  if (issueLabel === "guideline fit") {
    if (/own patient population|my patient population|not just some study/.test(activeConcernText.toLowerCase())) {
      return `${deriveGuidelineDirectAnswer(activeConcernText)}. The gap is still the patients you actually treat, not the headline version of the evidence.`;
    }

    return `The evidence only matters if it isolates the harder-to-treat patient who actually pulls you off the usual guideline path. ${deriveGuidelineDirectAnswer(activeConcernText)}.`;
  }

  if (issueLabel === "cost impact") {
    if (/specific outcomes|what outcomes/.test(activeConcernText.toLowerCase())) {
      return "You're asking which outcomes would actually justify the spend, not for a generic value claim. The answer has to be one outcome that changes whether the therapy earns a place in practice.";
    }

    return "You're not asking for a general value story, you're asking what changes on cost and readmissions in the patients you manage. If it does not move that real value equation, it is still not enough.";
  }

  if (issueLabel === "patient-fit gap") {
    if (/own patient population|my patient population|not just some study/.test(activeConcernText.toLowerCase())) {
      return "You're saying the study still doesn't reflect the patients who force you off the usual guideline path. The problem is still patient fit, not lack of interest in the data.";
    }

    return "You're saying the study population does not match the patients driving your decisions. If the missing patients are the ones that change treatment choice, the evidence is still incomplete.";
  }

  if (issueLabel === "workflow burden") {
    return "You're pointing to the extra work this creates for the team, not just whether the therapy works on paper. If the workflow still breaks in the same place, the idea is still too burdensome.";
  }

  return `You're pointing to a real evidence-fit gap, not a surface objection. If ${issueLabel} still blocks a real patient decision, the evidence is still not ready for practice.`;
}

function buildDeterministicCommitmentReply({ scenario, turns }) {
  const activeConcernText = normalizeForMatch(getActiveConcernText(turns, scenario));
  const repTurns = turns.filter((turn) => turn?.speaker === "rep").length;
  const hcpTurns = turns.filter((turn) => turn?.speaker === "hcp").length;
  const proofPointCategory = deriveProofPointCategory({ scenario, activeConcernText, turns });
  const hospitalFocused = /hospital|readmission|admission|ed\b|er\b/.test(activeConcernText);
  const treatmentChoiceFocused = /treatment choice|decision|switch|line of therapy|selection/.test(activeConcernText);
  const symptomFocused = /symptom|flare|control|quality of life/.test(activeConcernText);
  const specificMetricAsk = /specific hospitalization rate|what one metric|what metric|what reduction|how much of a reduction|what number/.test(activeConcernText);
  const concreteProofAsk =
    /make the proof point concrete|show me what changes practice|if you can make the proof point concrete|if that's the proof point|show me the subgroup|if you can make the proof point concrete, i can stay with|i can stay with|what one piece of evidence would be sufficient to shift|what would actually alter treatment approach|what would actually alter our current approach|more compelling reason to alter my treatment approach|one key metric|piece of evidence that would drive|show me the subgroup and the single data point|what single data point would change that|what single metric changes treatment choice|one metric that would demonstrate a significant enough reduction in complications|specific, compelling metric|one number|what'?s the one number|what one number/.test(
      activeConcernText,
    );

  if (hcpTurns === 0 && (hospitalFocused || /hospital|change treatment choice/.test(proofPointCategory) || specificMetricAsk || concreteProofAsk)) {
    return "The proof point has to be concrete from the start: a subgroup analysis in the patients still landing in the hospital on the current path, showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions. If the data cannot clear that bar, it still does not change treatment choice.";
  }

  if (/what'?s the one metric that proves this changes my practice|what single data point would change that|what'?s the actual reduction for my high-risk patients|specific, compelling metric|specific compelling metric/.test(activeConcernText)) {
    return "The single metric would have to be a subgroup analysis showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up in the high-risk patients still landing in the hospital on the current path. If the analysis cannot show that, there is still no practice-changing proof point.";
  }

  if (concreteProofAsk) {
    if (repTurns >= 7) {
      return "The single data point would have to be the subgroup analysis itself showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up in the patients still landing in the hospital on the current path. That is the one piece of evidence that would justify changing treatment instead of just continuing the discussion. If the analysis cannot show that, there is no practice-changing proof point.";
    }
    if (repTurns >= 5 || hasRepeatedObjection(turns)) {
      return "The exact metric would have to be a subgroup analysis in the patients still landing in the hospital on the current path showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up. That is the point where the result stops being interesting and starts changing practice. If that threshold is not there, there is no reason to change treatment.";
    }
    if (repTurns >= 3) {
      return "The proof point has to tighten to one metric: a subgroup analysis in the patients still landing in the hospital on the current path, showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions. Anything softer than that is unlikely to change treatment choice. Is that the bar you would use to change practice?";
    }
    return "The concrete proof point would have to be one subgroup analysis in the patients still landing in the hospital on the current path, showing a hospitalization or readmission reduction strong enough to change treatment choice for that subgroup.";
  }

  if (/actual reduction.*high-risk patients|tangible benefit for my most vulnerable patients|most vulnerable patients|high-risk patients/.test(activeConcernText)) {
    return "For the high-risk subgroup, the concrete metric would still have to be roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up in the patients still landing in the hospital on the current path. If the subgroup analysis cannot show that level of benefit in those high-risk patients, there is still no reason to change treatment.";
  }

  if (/right patient|ideal patient|meaning to try it|haven't had one/.test(activeConcernText)) {
    if (repTurns <= 1) {
      return "It sounds like the hesitation isn't interest, it's not wanting to force a fit that doesn't hold up in your real patients. If someone came close over the next couple of weeks, would you be open to flagging that chart so we can pressure-test it together?";
    }
    return "It sounds like the blocker isn't interest, it's getting from theory to one real patient you'd actually act on. Would you be open to choosing one patient type you'd realistically consider next so the follow-up is concrete instead of open-ended?";
  }

  if (/proof point|concrete outcome|single data point|patient outcome|concrete/i.test(activeConcernText)) {
    if (/what one piece of evidence would be sufficient to shift|what would actually alter treatment approach|what would actually alter our current approach|more compelling reason to alter my treatment approach|one key metric|piece of evidence that would drive/.test(activeConcernText)) {
      return "The one piece of evidence that would justify changing treatment is a subgroup analysis in the patients still landing in the hospital on the current path, showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up. That is the point where the data starts changing treatment choice instead of just extending the discussion.";
    }

    if (/what makes that 15% threshold meaningful|what makes you think 15% reduction is enough|why is 15% enough|why is that threshold enough/.test(activeConcernText)) {
      return "That 15% to 20% threshold matters only if it comes from the subgroup still landing in the hospital on the current path, because at that level the reduction is large enough to change who you escalate, who you keep on the current path, and whether the result is strong enough to alter treatment in practice.";
    }

    if (/exact practice-changing reduction threshold|exact reduction threshold|exact hospitalization threshold|exact readmission threshold|hospitalization\/readmission threshold standard|threshold standard|reduction numbers/.test(activeConcernText)) {
      if (repTurns >= 5) {
        return "A practice-changing standard would usually mean the subgroup analysis itself shows roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up in the patients you would actually treat, because that is the threshold where the number starts to justify changing treatment instead of just sounding encouraging.";
      }
      return "A practice-changing standard would usually need to look like roughly a 15% to 20% relative reduction in hospitalizations or readmissions in the subgroup you actually treat, not just a small directional improvement.";
    }

    if (/what'?s the exact reduction threshold|what reduction would change treatment choice/.test(activeConcernText)) {
      if (repTurns >= 5) {
        return "The threshold would have to be shown inside the subgroup analysis itself: roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up in the patients still failing on the current path, because that is the level where the result starts to justify changing treatment choice.";
      }
      return "The threshold would have to look more like a sustained 15% to 20% relative reduction in hospitalizations or readmissions in the subgroup you would actually treat, not a small change that never alters treatment choice.";
    }

    if (/one number|specific, compelling metric|specific compelling metric|what'?s the one number|what one number/.test(activeConcernText)) {
      return "The one number would have to look like roughly a 15% to 20% relative reduction in hospitalizations or readmissions in the subgroup you would actually treat, because that is the kind of change that can realistically shift treatment choice.";
    }

    if (/still too soft|not concrete enough|more definitive metric|what one piece|what'?s the one piece/.test(activeConcernText)) {
      return "Then the one piece would have to be a subgroup analysis limited to the patients still landing in the hospital on the current path, showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up. If it cannot show that, it still does not change practice.";
    }

    if (/specific analysis|what analysis demonstrates|what analysis shows|show me the analysis/.test(activeConcernText)) {
      return "The analysis would have to isolate the patients still landing in the hospital on the current path and show a hospitalization or readmission reduction large enough to change treatment choice for that subgroup, not just the pooled study population.";
    }

    if (/specific population|my specific population|patients like the ones i'm reviewing|applied to my specific population|applies to my specific population|toughest patients/.test(activeConcernText)) {
      return "Then the one piece has to be the subgroup analysis in the patients still landing in the hospital on the current path, showing roughly a 15% to 20% relative reduction over follow-up in the patients who actually look like the ones you are reviewing. If it cannot show that in your population, it still does not change practice.";
    }

    if (/show me the subgroup and the single data point|what single data point would change that|what single metric changes treatment choice|one metric that would demonstrate a significant enough reduction in complications|significant enough reduction in complications|one key metric|piece of evidence that would drive|what would actually alter our current approach|what specifically would alter our current approach/.test(activeConcernText)) {
      if (repTurns >= 7) {
        return "The exact metric would be the subgroup analysis showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up in the patients still failing on the current path, because that is the piece of evidence that would actually justify changing treatment instead of just keeping the discussion alive.";
      }
      if (repTurns >= 6) {
        return "Then the subgroup analysis itself has to show roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up in the patients still failing on the current path, because that is the one number that starts to justify treating that subgroup differently in practice. Anything less still sounds interesting without changing treatment choice.";
      }
      if (repTurns >= 5 || hasRepeatedObjection(turns)) {
        return "Then the one metric has to be tied to the subgroup analysis itself: a roughly 15% to 20% relative reduction in hospitalizations or readmissions over follow-up in the patients still landing in the hospital on the current path, because that is the number that would justify changing treatment for that subgroup.";
      }
      if (repTurns >= 4) {
        return "The one piece would have to be a subgroup analysis limited to the patients still landing in the hospital on the current path, showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up. If it cannot show that, it still does not change practice.";
      }
      if (repTurns >= 2) {
        return "The single data point would have to look like roughly a 15% to 20% relative reduction in hospitalizations or readmissions in the subgroup still landing in the hospital on the current path, because that is the kind of number that can actually change treatment choice.";
      }
      return "The subgroup would be the patients who are still landing in the hospital or coming back despite the current path, and the single data point would be a hospitalization or readmission reduction large enough that you would actually treat that subgroup differently.";
    }

    if (specificMetricAsk && hospitalFocused) {
      if (repTurns >= 4) {
        return "The one piece would have to be the subgroup analysis itself, showing roughly a 15% to 20% relative reduction in hospitalizations or readmissions over follow-up in the patients still being hospitalized on the current path. Without that analysis, there is no one number strong enough to change practice.";
      }
      if (repTurns <= 2) {
        return "The one metric would have to be a hospitalization or readmission reduction large enough that you would actually intervene differently for the patient in front of you, not a utilization number that never changes treatment choice.";
      }
      return "The one data point would have to be a hospitalization or readmission reduction you would actually trust enough to change treatment choice for a real patient, not a broad number that never changes what you do.";
    }

    if (hospitalFocused) {
      if (repTurns <= 1) {
        return "Then the proof point would have to be a hospitalization or readmission signal in the patients you actually manage, not a broad headline from a slide. If that signal would not change who you treat or how urgently you act, it is not enough.";
      }
      return "Then the proof point would have to be a hospitalization or readmission signal you would actually use in practice, not a pooled efficacy claim. If it would not change treatment choice for the patient in front of you, it is still too soft.";
    }

    if (treatmentChoiceFocused) {
      return "Then the proof point has to show a real change in treatment choice for a patient you would otherwise manage differently. If it does not move that decision, it is still not concrete enough.";
    }

    if (symptomFocused) {
      return "Then the proof point has to show a symptom or flare change you would actually notice in the patient, not just a statistical win on paper. If it would not change follow-up or treatment choice, it is still not enough.";
    }

    if (repTurns <= 1) {
      return `${deriveCommitmentDirectAnswer(activeConcernText, proofPointCategory)}. The most useful place to start would be ${proofPointCategory}.`;
    }
    return `${deriveCommitmentDirectAnswer(activeConcernText, proofPointCategory)}. If we keep this concrete, the proof point should be ${proofPointCategory}, because that is what would actually justify a next step.`;
  }

  if (/need more data|still not convinced|not the right fit|perfect fit/.test(activeConcernText)) {
    return "It sounds like the hesitation is still active, even if the interest is there. Would you be open to naming the one evidence gap that has to get resolved before this moves from 'maybe' to a real next step?";
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
  const stageText = `${scenario?.journeyStage || ""} ${scenario?.journeyState || ""}`.toLowerCase();
  const activeConcernText = normalizeForMatch(getActiveConcernText(turns, scenario));
  const repeatedConcern = hasRepeatedObjection(turns);

  if (
    /clinical_value|clinical_evaluation/.test(stageText) &&
    /renal|kidney|egfr|gfr|dose adjustment|dose reduction|subgroup|numbers for my patient population|real-world renal data|moderate renal impairment|threshold|closest renal-specific data|closest renal-specific outcome/.test(activeConcernText)
  ) {
    return buildDeterministicEvidenceFitReply({ scenario, turns });
  }

  if (
    /commitment_close|adoption_commitment/.test(stageText) &&
    (CLOSE_PROOF_POINT_PATTERN.test(activeConcernText) || repeatedConcern)
  ) {
    return buildDeterministicCommitmentReply({ scenario, turns });
  }

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
  const stageText = `${scenario?.journeyStage || ""} ${scenario?.journeyState || ""}`.toLowerCase();
  const activeConcernText = normalizeForMatch(getActiveConcernText(turns, scenario));

  if (/commitment_close|adoption_commitment/.test(stageText) && CLOSE_PROOF_POINT_PATTERN.test(activeConcernText)) {
    return buildDeterministicCommitmentReply({ scenario, turns });
  }

  if (
    /clinical_value|clinical_evaluation/.test(stageText) &&
    (DIRECT_ANSWER_TRIGGER.test(activeConcernText) ||
      /renal|kidney|egfr|gfr|dose adjustment|dose reduction|subgroup|numbers for my patient population|real-world renal data|moderate renal impairment|threshold|closest renal-specific data|closest renal-specific outcome/.test(activeConcernText))
  ) {
    return buildDeterministicEvidenceFitReply({ scenario, turns });
  }

  if (shouldUseDeterministicFamilyAnswerRewrite({
    scenario,
    turns,
    draft,
  })) {
    return buildDeterministicFamilyAnswerReply({ scenario, turns });
  }

  return draft;
}

export function maybeApplyHardFamilyAnswerReply({
  scenario,
  turns,
  draft,
}) {
  const stageText = `${scenario?.journeyStage || ""} ${scenario?.journeyState || ""}`.toLowerCase();
  const activeConcernText = normalizeForMatch(getActiveConcernText(turns, scenario));

  if (/clinical_value|clinical_evaluation/.test(stageText)) {
    if (/what specific subgroup does this data apply to|what subgroup does this data actually apply to/.test(activeConcernText)) {
      return "The subgroup that matters is the harder-to-treat patient who is still not controlled on the standard path and whose renal burden or comorbidity load makes you question whether the usual evidence still applies cleanly.";
    }
    if (/how this applies to my patients with renal issues|how does your data account for renal impairment|how does your data account for renal function/.test(activeConcernText)) {
      return "It does not apply cleanly enough yet, because the study still leaves unanswered how much benefit remains once you adjust dosing for the renal-impaired patients you actually treat.";
    }
    if (/real-world renal data|what real-world renal data do you have|what renal data do you have for patients like mine|renal data do you have that's relevant to my patients|what subgroup data do you have|subgroup data for patients with moderate renal impairment|subgroup analysis for moderate renal impairment|moderate renal impairment subgroup analysis|that subgroup analysis is crucial|what'?s the plan for getting that renal subgroup analysis|what'?s the plan to get that renal subgroup analysis|what'?s the plan for getting that subgroup analysis|what'?s the plan to get that subgroup analysis|what'?s the plan to get that subgroup analysis to me|what'?s the plan to get that subgroup analysis done within the next quarter|what'?s the timeline for that renal subgroup analysis|what'?s the timeline for that subgroup analysis|what'?s the earliest i can expect that subgroup analysis|when can i anticipate seeing the detailed breakdown|when can i expect subgroup results|when can i expect those subgroup results|i need that subgroup analysis to make a decision|peer-reviewed journal|peer reviewed journal|actual numbers for my patient population|numbers for my patient population|what numbers do you have for my patient population|what'?s the exact threshold that changes treatment|what'?s the exact egfr threshold for that subgroup|renal threshold that changes treatment|what'?s the exact renal threshold where i need to switch treatments|what'?s the specific renal threshold that changes my treatment choice|at what specific point does the data suggest i should switch/.test(activeConcernText)) {
      return buildDeterministicEvidenceFitReply({ scenario, turns });
    }
    if (/what'?s the actual dose adjustment for a patient with moderate renal impairment|what'?s the exact dose for moderate renal impairment|how does dosing adjust for renal impairment/.test(activeConcernText)) {
      return "The study supports reducing the dose in moderate renal impairment, but it still does not give a renal-specific evidence package strong enough to tell you that the adjusted dose clearly preserves enough benefit to change practice.";
    }
    if (/timeline for those dosing adjustment studies|timeline for dosing adjustment studies|interim plan for dosing adjustments|what's the interim plan for dosing adjustments|what is the interim plan for dosing adjustments|what's the timeline for those dosing adjustment studies|timeline for renal studies|timeline for the renal studies/.test(activeConcernText)) {
      return "The only credible plan is a renal-specific follow-up cohort with predefined dosing, renal-safety, and retained-benefit endpoints. Until that reads out, the interim position is that the current dataset does not settle the renal decision.";
    }
    if (/plan for dosing adjustments in renal-impaired patients|dosing adjustments in renal-impaired patients|how will you handle dosing adjustments in renal-impaired patients|actual reduction in adverse events|what'?s the actual reduction in adverse events|reduction in adverse events with that dose adjustment/.test(activeConcernText)) {
      return buildDeterministicEvidenceFitReply({ scenario, turns });
    }
    if (/what specific comorbidities did this study account for|what comorbidities did this study account for, exactly|how the patient population in this study reflects the complexity i see in my own practice|reflects the complexity i see in my own practice/.test(activeConcernText)) {
      return "That is still the weakness in the evidence: it does not cleanly represent the higher-complexity patients with layered renal burden and comorbidities who drive your real treatment decisions, so the study population still feels cleaner than the patients you actually manage.";
    }
    if (/what'?s the exact renal threshold where i need to switch treatments|what'?s the specific renal threshold that changes my treatment choice|what'?s the renal threshold that changes treatment|gfr below 30|exact gfr threshold/.test(activeConcernText)) {
      return "There is not a validated renal threshold in this dataset that tells you exactly when to switch. That is the gap: the study does not give a clean GFR cutoff where you can say the evidence still supports treatment in the higher-risk renal patient.";
    }
    if (
      /how this applies to my patients with renal issues|accounts? for renal impairment|accounts? for the potential risks in patients with compromised renal function|how does your data account for renal impairment|what specific evidence do you have that changes my current practice|what specific data do you have that changes my current approach|what specific data justifies deviating from current guidelines|what specific subgroup does this data apply to|plan to study renal impairment|knowledge gap on renal safety|what comorbidities did the study account for|reflects the complexity i see in my own practice|generalizable|exact gfr threshold|exact threshold for switching treatments/.test(
        activeConcernText,
      )
    ) {
      return buildDeterministicEvidenceFitReply({ scenario, turns });
    }
  }

  if (/commitment_close|adoption_commitment/.test(stageText)) {
    if (/what'?s the exact reduction threshold|what reduction would change treatment choice|what'?s the smallest reduction that would make a difference|what'?s the threshold for that reduction to change treatment choice/.test(activeConcernText)) {
      return "A practice-changing threshold would usually need to look like roughly a 15% to 20% relative reduction in hospitalizations or readmissions in the subgroup you would actually treat, not just a directional benefit that never changes the decision.";
    }
    if (/one number|specific, compelling metric|specific compelling metric|what'?s the one number|what one number/.test(activeConcernText)) {
      return "The one number would have to be roughly a 15% to 20% relative reduction in hospitalizations or readmissions in the subgroup you would actually treat, because that is the kind of change that can realistically alter treatment choice.";
    }
    if (/still too soft|not concrete enough|more definitive metric|what one piece|what'?s the one piece/.test(activeConcernText)) {
      return buildDeterministicCommitmentReply({ scenario, turns });
    }
    if (
      /if you can make the proof point concrete|show me what changes practice|show me the subgroup and the single data point|what single data point would change that|what single metric changes treatment choice|what's the exact reduction threshold|what reduction would change treatment choice|show me the specific analysis|what analysis demonstrates|exact practice-changing reduction threshold|exact hospitalization threshold|exact readmission threshold|threshold standard|one number|specific, compelling metric|specific compelling metric/.test(
        activeConcernText,
      )
    ) {
      return buildDeterministicCommitmentReply({ scenario, turns });
    }
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
  const stageText = `${scenario?.journeyStage || ""} ${scenario?.journeyState || ""}`.toLowerCase();
  const activeConcernText = normalizeForMatch(getActiveConcernText(turns, scenario));

  if (
    /clinical_value|clinical_evaluation/.test(stageText) &&
    /renal|kidney|egfr|gfr|dose adjustment|dose reduction|subgroup data|real-world renal data|numbers for my patient population|threshold|closest renal-specific data|closest renal-specific outcome/.test(activeConcernText)
  ) {
    return buildDeterministicEvidenceFitReply({ scenario, turns });
  }

  if (
    /commitment_close|adoption_commitment/.test(stageText) &&
    (CLOSE_PROOF_POINT_PATTERN.test(activeConcernText) || /one number|single data point|specific, compelling metric|what one piece|still too soft|not concrete enough/.test(activeConcernText))
  ) {
    return buildDeterministicCommitmentReply({ scenario, turns });
  }

  const lastRepText = getLastRepText(turns);
  if (!lastRepText || lastRepText !== String(draft || "").trim()) {
    return draft;
  }

  const originalConcernText = getActiveConcernText(turns, scenario);
  const revisionPrompt = `
You are revising a pharma rep QA proxy reply because it repeats the exact same sentence the rep already used on the prior turn.

SCENARIO: ${scenario?.title || ""}
CURRENT BEHAVIOR STATE: ${currentBehaviorState || ""}
CURRENT JOURNEY STATE: ${currentJourneyState || ""}
ACTIVE HCP CONCERN: ${originalConcernText}
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
