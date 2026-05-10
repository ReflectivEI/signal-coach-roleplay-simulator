// @ts-nocheck

export const ENABLE_INFERENCE_LAYER = false;

export const INFERENCE_CONFIDENCE_THRESHOLD = 0.35;

export function createInitialRepInferenceState() {
  return {
    signalAwareness: 0,
    signalInterpretation: 0,
    objectionNavigation: 0,
    valueCommunication: 0,
    conversationControl: 0,
    confidence: 0,
    turnCount: 0,
    lastInfluence: 'none',
    lastAppliedTurn: -99,
  };
}

export function getRecentRepTurns(conversationHistory = []) {
  return conversationHistory
    .filter((turn) => turn?.repMessage)
    .map((turn) => String(turn.repMessage || '').trim())
    .filter(Boolean)
    .slice(-5);
}

function evaluateTurnSignals(repTurn = '') {
  const message = String(repTurn || '').toLowerCase();

  const genericFollowUp = /\b(anything else|any questions|just checking in|circling back|following up|let me know)\b/.test(message);
  const acknowledgesConcern = /\b(i hear|i understand|you mentioned|you said|i see your concern)\b/.test(message);
  const offTopicPivot = /\b(anyway|separately|switching gears|on another note|different topic)\b/.test(message);
  const deflectionLanguage = /\b(don't worry|trust me|it should be fine|it'll work out|we can get back to that)\b/.test(message);
  const objectionTerms = /\b(concern|barrier|hesitation|resistance|not convinced|objection)\b/.test(message);
  const featureOnly = /\b(feature|mechanism|formulation|delivery|once-daily|long-acting)\b/.test(message);
  const valueLink = /\b(patient|workflow|clinic|practice|time|access|adherence|outcome)\b/.test(message);
  const scatteredQuestioning = (message.match(/\?/g) || []).length >= 2 && !/\b(next step|priority|most important|biggest barrier)\b/.test(message);

  return {
    signalAwareness: genericFollowUp ? 1 : 0,
    signalInterpretation: acknowledgesConcern && offTopicPivot ? 1 : 0,
    objectionNavigation: (objectionTerms && deflectionLanguage) || (!objectionTerms && /\bwe can discuss later\b/.test(message)) ? 1 : 0,
    valueCommunication: featureOnly && !valueLink ? 1 : 0,
    conversationControl: scatteredQuestioning || /\bnot sure where to start|let's talk about everything\b/.test(message) ? 1 : 0,
  };
}

export function inferRepBehaviorSignals(recentRepTurns = []) {
  return recentRepTurns.reduce(
    (acc, repTurn) => {
      const signal = evaluateTurnSignals(repTurn);
      return {
        signalAwareness: acc.signalAwareness + signal.signalAwareness,
        signalInterpretation: acc.signalInterpretation + signal.signalInterpretation,
        objectionNavigation: acc.objectionNavigation + signal.objectionNavigation,
        valueCommunication: acc.valueCommunication + signal.valueCommunication,
        conversationControl: acc.conversationControl + signal.conversationControl,
      };
    },
    {
      signalAwareness: 0,
      signalInterpretation: 0,
      objectionNavigation: 0,
      valueCommunication: 0,
      conversationControl: 0,
    }
  );
}

export function updateRepInferenceState(prevState, recentRepTurns = []) {
  const prior = prevState || createInitialRepInferenceState();
  const detectedSignals = inferRepBehaviorSignals(recentRepTurns);
  const decay = 0.85;
  const turnCount = recentRepTurns.length;

  const nextState = {
    ...prior,
    signalAwareness: prior.signalAwareness * decay + detectedSignals.signalAwareness,
    signalInterpretation: prior.signalInterpretation * decay + detectedSignals.signalInterpretation,
    objectionNavigation: prior.objectionNavigation * decay + detectedSignals.objectionNavigation,
    valueCommunication: prior.valueCommunication * decay + detectedSignals.valueCommunication,
    conversationControl: prior.conversationControl * decay + detectedSignals.conversationControl,
    turnCount,
  };

  const confidenceBase = turnCount >= 3 ? (turnCount - 2) / 3 : 0;
  nextState.confidence = Math.max(0, Math.min(1, confidenceBase));

  return nextState;
}

export function selectInferenceInfluence(repInferenceState, _scenarioContext = {}, lastInfluence = 'none') {
  if (!repInferenceState || repInferenceState.turnCount < 3) {
    return { type: 'none', strength: 'low' };
  }

  if ((repInferenceState.confidence || 0) < INFERENCE_CONFIDENCE_THRESHOLD) {
    return { type: 'none', strength: 'low' };
  }

  const candidates = [];
  if (repInferenceState.objectionNavigation >= 1.5) candidates.push('evidence');
  if (repInferenceState.valueCommunication >= 1.5) candidates.push('relevance');
  if (repInferenceState.signalAwareness >= 1.5) candidates.push('hesitation');
  if (repInferenceState.conversationControl >= 1.5) candidates.push('workflow');
  if (repInferenceState.signalInterpretation >= 1.5) candidates.push('relevance');

  const distinct = [...new Set(candidates)];
  if (distinct.length < 1) return { type: 'none', strength: 'low' };

  const rotated = distinct.find((item) => item !== lastInfluence) || 'none';
  if (rotated === 'none') return { type: 'none', strength: 'low' };

  return { type: rotated, strength: 'low' };
}

const SAFE_MODIFIERS = {
  relevance: 'How does that apply to the patients I\'m currently seeing?',
  evidence: 'What evidence supports that approach?',
  workflow: 'How would that fit into my current workflow?',
  hesitation: 'I\'m still figuring out how that fits for me.',
};

function hasExistingChallenge(baseResponse = '') {
  const value = String(baseResponse || '').toLowerCase();
  return /\b(what evidence|how would that fit|how does that apply|not convinced|concern|barrier|workflow)\b/.test(value);
}

export function applyInferenceBias({
  baseResponse,
  influence,
  lastInfluence,
  turnCount,
  lastAppliedTurn,
}) {
  const response = String(baseResponse || '').trim();
  if (!response) return response;

  if (!influence || influence.type === 'none') return response;
  if (influence.type === lastInfluence) return response;
  if ((turnCount - (lastAppliedTurn ?? -99)) < 2) return response;
  if (turnCount % 3 !== 0) return response;
  if (hasExistingChallenge(response)) return response;

  const modifier = SAFE_MODIFIERS[influence.type];
  if (!modifier) return response;

  return `${response} ${modifier}`.trim();
}
