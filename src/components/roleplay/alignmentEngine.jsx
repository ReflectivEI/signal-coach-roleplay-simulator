/**
 * Signal–Response Alignment Engine v3
 *
 * CANONICAL IMPLEMENTATION — based on Signal Intelligence™ SOT rubric.
 *
 * Scores 8 capabilities, each with their canonical sub-metrics as defined in the SOT:
 *   1. Signal Awareness        → Contextual Relevance + Forward Value
 *   2. Signal Interpretation   → Accuracy of Interpretation + Responsiveness of Action
 *   3. Value Connection        → Customer Relevance Alignment + Outcome Translation
 *   4. Customer Engagement     → Customer Verbal Participation + Responsiveness to Cues + Momentum Continuity + Signal Amplification
 *   5. Objection Navigation    → Non-Defensive Response + Constructive Engagement
 *   6. Conversation Management → Directional Clarity + Adaptive Steering
 *   7. Adaptive Response       → Situational Responsiveness + Approach Adjustment Quality
 *   8. Commitment Generation   → Next-Step Clarity + Customer Ownership
 *
 * Signal–Response Alignment Rubric (5 derived checks):
 *   1. Concern/Sensitivity Signal Detected
 *   2. Objection Signal Detected
 *   3. Engagement Drop or Shift Detected
 *   4. Value Framing Without Signal Support
 *   5. Readiness Signal Detected
 *
 * GUARDRAILS:
 *   - Scores reflect OBSERVABLE BEHAVIOR ONLY
 *   - No intent inference, no emotion scoring, no outcome bias
 *   - 3 = effective / acceptable (NOT average)
 *   - Single behavior maps to ONE primary capability (no double-counting)
 *   - metricsVersion: 'SI-v2-locked-2026'
 */

import { SIGNAL_CAPABILITIES } from './signalIntelligenceSOT';
import { CANONICAL_METRICS_VERSION, validateMetricResults } from '@/lib/signal-intelligence-schema';
import { detectMetricDrift, logScoringExecution, validateMetricIntegrity } from '@/lib/scoringDiagnostics';

// ─── METRIC DEFINITIONS (canonical, from SOT) ──────────────────────────────────
export const METRIC_DEFINITIONS = SIGNAL_CAPABILITIES.map(c => ({
  id: c.id,
  label: c.label,
  sublabel: c.measurement,
  description: c.canonicalQuestion,
  color: c.color,
  coreMetrics: c.coreMetrics,
  coaching: c.coaching,
  canonical: c.canonical,
}));

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function wordCount(text) { return text.trim().split(/\s+/).filter(Boolean).length; }
function questionCount(text) { return (text.match(/\?/g) || []).length; }

/**
 * Detect observable behavioral patterns in rep message.
 * Each key corresponds to a specific, observable behavioral signal.
 */
function detectPatterns(msg) {
  const lc = msg.toLowerCase();
  const wc = wordCount(msg);
  const qc = questionCount(msg);

  return {
    // ── Signal Awareness patterns ──────────────────────────────────────────
    asksContextualQuestion:
      /\b(you mentioned|you said|based on what you('ve| have) shared|following up on|building on that|given what you|since you|you brought up)\b/.test(lc) && qc >= 1,
    asksForwardQuestion:
      /\b(what would|how would|what if|what are your|how do you|what has been|what's your|what concerns|what matters|tell me more|could you share|what are you seeing|in your experience|what's driving)\b/.test(lc) && qc >= 1,
    asksDiscovery:
      /\b(what's your|how do you|what are you|what has been|in your practice|your patients|your experience|what matters|what concerns|what are you seeing|tell me about)\b/.test(lc),
    buildsOnHcp:
      /\b(you mentioned|you said|your point|following up on|tell me more|could you elaborate|building on|that's interesting|based on what you|given your)\b/.test(lc),
    hasQuestion: qc >= 1,
    multipleQuestions: qc > 2,
    singleQuestion: qc === 1,

    // ── Signal Interpretation patterns ──────────────────────────────────────
    paraphrasesHcp:
      /\b(so what you('re| are) saying|if i('m| am) hearing you|it sounds like|what i('m| am) hearing|you('re| are) indicating|you've expressed|your concern is|what you need)\b/.test(lc),
    acknowledgesConcern:
      /\b(i understand|i hear|fair point|makes sense|i see where|you('re| are) right|valid concern|i appreciate|your concern|i respect that|thank you for|that('s| is) a fair|i take that point|i recognize|i hear the concern)\b/.test(lc),
    respondsToState:
      /\b(given that|because you|since you|addressing your|in response to|that's why|to address|for that reason|with that in mind)\b/.test(lc),

    // ── Value Connection patterns ──────────────────────────────────────────
    referencesHcpPriority:
      /\b(your patients|your practice|your workflow|your concern|your goal|your challenge|based on what matters to you|for your setting|in your case)\b/.test(lc),
    translatesOutcome:
      /\b(what this means|so this means|the impact|for your patients this|which means|this translates to|the result is|which translates|what that means for you|so for you)\b/.test(lc),
    pitchesTooEarly:
      /\b(our product|our drug|clinical data shows|evidence shows|studies show|proven to|data shows|we offer|i want to tell you about|let me tell you about)\b/.test(lc) && !/(you mentioned|you said|your concern|based on|given your)/.test(lc),
    providesEvidence:
      /\b(data|study|trial|evidence|research|clinical|shows that|demonstrated|published)\b/.test(lc),

    // ── Customer Engagement patterns ──────────────────────────────────────
    amplifiesSignal:
      /\b(you mentioned|you said|building on|following on|tell me more about that|expanding on|that's interesting because|given what you said)\b/.test(lc),
    continuesMonologue: wc > 80 && !/(you mentioned|you said|\?|i hear|i understand)/.test(lc),
    continues_after_disengagement:
      /\b(also|one more thing|and another|speaking of|by the way|and then|additionally|furthermore|in addition)\b/.test(lc),

    // ── Objection Navigation patterns ──────────────────────────────────────
    exploresObjection:
      /\b(help me understand|tell me more about|what specifically|can you share more|what's behind that|why is that a concern|what would help|what would make)\b/.test(lc),
    overridesObjection:
      /\b(but you should|but the data|you('re| are) wrong|that('s| is) not true|in fact, no|actually no|you have to|that('s| is) incorrect)\b/.test(lc),
    repeatedClaim:
      /\b(as i said|like i mentioned|i already|i('ve| have) told you|again,|still,|like i said|as i mentioned)\b/.test(lc),
    defends: /\b(i was just|i only meant|that('s| is) not what i|you misunderstood|it('s| is) not my fault)\b/.test(lc),

    // ── Conversation Management patterns ──────────────────────────────────
    signalsPurpose:
      /\b(i('d| would) like to|the reason i('m| am)|my goal today|i wanted to|one thing i('d| would)|the focus of|what i('d| would) like to explore|can we look at|let('s| us) talk about)\b/.test(lc),
    offersNextStep:
      /\b(follow up|send you|next time|schedule|when works|convenient for you|send over|can i|i('ll| will) get you|let me send|i can share|i('ll| will) follow up)\b/.test(lc),
    gracefulClose:
      /\b(thank you for your time|appreciate your time|i('ll| will) follow up|enjoy the rest|speak soon|i know you('re| are) busy)\b/.test(lc),

    // ── Adaptive Response patterns ──────────────────────────────────────
    acknowledguesTime:
      /\b(your time|brief|quick|just one|one thing|i won('t| will not) keep you|i see you('re| are) busy|busy|pressed for time|i know you('re| are)|i won't take long)\b/.test(lc),
    deEscalates:
      /\b(i understand|i appreciate|fair point|makes sense|i hear you|no pressure|whenever works|thank you for your time|my apologies|i('m| am) sorry|i can follow up|i hear the concern)\b/.test(lc),
    reducedAsk:
      /\b(just one|briefly|when you('re| are) ready|no pressure|if you('re| are) open|would you be open to|at your convenience|whenever is good)\b/.test(lc),

    // ── Commitment Generation patterns ──────────────────────────────────
    specifiesNextStep:
      /\b(i('ll| will) (send|share|schedule|follow up|get you|bring|coordinate|connect)|let me (send|share|schedule|follow up)|can we (schedule|set up|plan|agree)|would you be open to (a|an|meeting|call|review))\b/.test(lc),
    invitesCommitment:
      /\b(would you be open|would it be helpful|does that work|what do you think|how does that sound|would that be useful|would you like)\b/.test(lc),
    demandLanguage:
      /\b(you need to|you should|you must|immediately|just do it|i need you to|you have to)\b/.test(lc),
    pressureLanguage:
      /\b(you should really|you need to consider|don('t| not) miss|don('t| not) pass up|you have to|you can('t| not) ignore)\b/.test(lc),

    // ── Universal / cross-cutting ──────────────────────────────────────
    isAggressive:
      /\bf\*+\b|f\*ck|fuck|shit|ass\b|\bstupid\b|\bidiot\b|\bincompetent\b|\byou don('t| not) know\b|\bbad doctor\b|\bi demand\b|\bcancel all\b|\bwhy are you being\b/.test(lc),
    isDismissive:
      /\b(whatever|not important|move on|doesn('t| 't) matter|i don('t| 't) know the.*findings|not a real study)\b/.test(lc),

    // Length indicators
    wc,
    isBrief: wc < 30,
    isVeryBrief: wc < 15,
    isLong: wc > 60,
    isVeryLong: wc > 100,
    singleAsk: qc <= 1,
  };
}

// ─── SCORING HELPERS ───────────────────────────────────────────────────────────
function roundHalfUp(value, decimals = 1) {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
function avg(...scores) {
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  return roundHalfUp(mean, 1);
}
function clamp(v) { return Math.max(1, Math.min(5, roundHalfUp(v, 1))); }

// ─── 1. SIGNAL AWARENESS — Question Quality ────────────────────────────────────
function scoreSignalAwareness(hcpState, temperature, p) {
  const positives = [];
  const misalignments = [];

  let contextualRelevance = 3;
  if (p.asksContextualQuestion) {
    contextualRelevance = 4;
    positives.push('Question reflected current conversation context (Contextual Relevance ↑)');
  }
  if (p.buildsOnHcp) {
    contextualRelevance = Math.min(contextualRelevance + 1, 5);
    positives.push('Question built directly on HCP signal (Contextual Relevance ↑)');
  }
  if ((hcpState === 'irritated' || hcpState === 'disengaging') && p.asksDiscovery && !p.deEscalates) {
    contextualRelevance = 2;
    misalignments.push('Discovery question used when HCP was withdrawing — not contextually appropriate');
  }
  if (hcpState === 'time-pressured' && p.multipleQuestions) {
    contextualRelevance = Math.max(contextualRelevance - 1, 1);
    misalignments.push('Multiple questions used under time pressure — not contextually appropriate');
  }

  let forwardValue = 3;
  if (p.asksForwardQuestion) {
    forwardValue = 4;
    positives.push('Question opened productive dialogue (Forward Value ↑)');
  }
  if (p.asksDiscovery && hcpState === 'engaged') {
    forwardValue = Math.min(forwardValue + 1, 5);
    positives.push('Discovery question deepened engaged conversation (Forward Value ↑)');
  }
  if (!p.hasQuestion && p.pitchesTooEarly) {
    forwardValue = 2;
    misalignments.push('Value asserted without a question — conversation not moved forward');
  }
  if (hcpState === 'neutral' && p.pitchesTooEarly && !p.asksDiscovery) {
    forwardValue = 1;
    misalignments.push('Moved to pitch before establishing context — no forward value');
  }

  const score = clamp(avg(contextualRelevance, forwardValue));
  return {
    score,
    subScores: { contextual_relevance: clamp(contextualRelevance), forward_value: clamp(forwardValue) },
    positives,
    misalignments,
  };
}

// ─── 2. SIGNAL INTERPRETATION — Listening & Responsiveness ────────────────────
function scoreSignalInterpretation(hcpState, temperature, p) {
  const positives = [];
  const misalignments = [];

  let accuracy = 3;
  if (p.paraphrasesHcp) {
    accuracy = 4;
    positives.push('Paraphrased or summarized HCP input accurately (Accuracy ↑)');
  }
  if (p.acknowledgesConcern && (hcpState === 'resistant' || hcpState === 'boundary-setting')) {
    accuracy = 5;
    positives.push('Precisely reflected resistance signal with acknowledgment (Accuracy ↑)');
  }
  if ((hcpState === 'resistant' || hcpState === 'boundary-setting') && !p.acknowledgesConcern && !p.paraphrasesHcp) {
    accuracy = 2;
    misalignments.push('Resistance signal not reflected in response — concern not acknowledged');
  }
  if ((hcpState === 'irritated' || hcpState === 'disengaging') && !p.deEscalates && !p.acknowledgesConcern) {
    accuracy = Math.max(accuracy - 1, 1);
    misalignments.push('Disengagement/irritation signal not accurately interpreted');
  }
  if (p.isDismissive) {
    accuracy = 1;
    misalignments.push('Dismissive language indicates misread of HCP input');
  }

  let responsiveness = 3;
  if (p.acknowledgesConcern && p.respondsToState) {
    responsiveness = 5;
    positives.push('Response directly and fluently addressed HCP input (Responsiveness ↑)');
  } else if (p.acknowledgesConcern || p.paraphrasesHcp) {
    responsiveness = 4;
    positives.push('Response aligned with what HCP communicated (Responsiveness ↑)');
  }
  if ((hcpState === 'resistant' || hcpState === 'boundary-setting') && p.overridesObjection) {
    responsiveness = 1;
    misalignments.push('Response countered resistance instead of addressing it — unresponsive to signal');
  }
  if (p.repeatedClaim) {
    responsiveness = Math.max(responsiveness - 1, 1);
    misalignments.push('Repeated earlier claim without adapting to what HCP said');
  }
  if (hcpState === 'engaged' && p.buildsOnHcp) {
    responsiveness = Math.min(responsiveness + 1, 5);
    positives.push('Built on engaged HCP signal — strong responsiveness');
  }

  const score = clamp(avg(accuracy, responsiveness));
  return {
    score,
    subScores: { accuracy_of_interpretation: clamp(accuracy), responsiveness_of_action: clamp(responsiveness) },
    positives,
    misalignments,
  };
}

// ─── 3. VALUE CONNECTION — Value Framing ──────────────────────────────────────
function scoreValueConnection(hcpState, temperature, p) {
  const positives = [];
  const misalignments = [];

  let relevanceAlignment = 3;
  if (p.referencesHcpPriority && p.providesEvidence) {
    relevanceAlignment = 4;
    positives.push('Value tied to HCP-specific priorities (Customer Relevance Alignment ↑)');
  }
  if (hcpState === 'engaged' && p.providesEvidence && p.buildsOnHcp) {
    relevanceAlignment = 5;
    positives.push('Value precisely tailored to active HCP interest (Customer Relevance Alignment ↑)');
  }
  if (hcpState === 'neutral' && p.pitchesTooEarly && !p.asksDiscovery) {
    relevanceAlignment = 1;
    misalignments.push('Value asserted before HCP priorities were established — generic framing');
  }
  if ((hcpState === 'irritated' || hcpState === 'disengaging') && p.providesEvidence && !p.deEscalates) {
    relevanceAlignment = 2;
    misalignments.push('Value messaging deployed when HCP was withdrawing — wrong context');
  }
  if (hcpState === 'resistant' && p.providesEvidence && !p.acknowledgesConcern) {
    relevanceAlignment = 2;
    misalignments.push('Evidence offered before addressing resistance — landed as defense not value');
  }
  if (p.pressureLanguage) {
    relevanceAlignment = Math.max(relevanceAlignment - 1, 1);
    misalignments.push('Pressure language undermines value relevance');
  }

  let outcomeTranslation = 3;
  if (p.translatesOutcome) {
    outcomeTranslation = 4;
    positives.push('"So what this means for you" language present (Outcome Translation ↑)');
  }
  if (p.translatesOutcome && p.referencesHcpPriority) {
    outcomeTranslation = 5;
    positives.push('Compelling situation-specific outcome translation (Outcome Translation ↑)');
  }
  if (p.providesEvidence && !p.translatesOutcome && !p.referencesHcpPriority) {
    outcomeTranslation = 2;
    misalignments.push('Information presented without explaining why it matters to this HCP');
  }
  if (!p.providesEvidence && !p.translatesOutcome && p.pitchesTooEarly) {
    outcomeTranslation = 1;
    misalignments.push('No outcome explained — information pushed without impact framing');
  }

  const score = clamp(avg(relevanceAlignment, outcomeTranslation));
  return {
    score,
    subScores: { customer_relevance_alignment: clamp(relevanceAlignment), outcome_translation: clamp(outcomeTranslation) },
    positives,
    misalignments,
  };
}

// ─── 4. CUSTOMER ENGAGEMENT MONITORING — Engagement Cues ──────────────────────
function scoreCustomerEngagement(hcpState, temperature, p) {
  const positives = [];
  const misalignments = [];

  const participationByState = {
    'neutral': 3, 'engaged': 4, 'time-pressured': 2,
    'resistant': 2, 'boundary-setting': 1, 'irritated': 1, 'disengaging': 1,
  };
  const customerParticipation = participationByState[hcpState] ?? 3;

  let responsivenessToCues = 3;
  if (hcpState === 'engaged' && p.buildsOnHcp) {
    responsivenessToCues = 5;
    positives.push('Detected and leveraged engaged state — anticipatory responsiveness (Cues ↑)');
  } else if (hcpState === 'engaged' && p.amplifiesSignal) {
    responsivenessToCues = 4;
    positives.push('Responded promptly to engaged HCP cue (Cues ↑)');
  } else if (hcpState === 'engaged' && !p.buildsOnHcp && p.isLong) {
    responsivenessToCues = 2;
    misalignments.push('HCP engaged but rep did not build on signal — cue missed');
  }
  if ((hcpState === 'irritated' || hcpState === 'disengaging') && p.continues_after_disengagement) {
    responsivenessToCues = 1;
    misalignments.push('Engagement drop ignored — continued content after disengagement signal');
  }
  if ((hcpState === 'irritated' || hcpState === 'disengaging') && p.deEscalates) {
    responsivenessToCues = 4;
    positives.push('Adapted promptly to disengagement signal (Cues ↑)');
  }
  if (hcpState === 'disengaging' && p.deEscalates && p.offersNextStep) {
    responsivenessToCues = 5;
    positives.push('Anticipated disengagement and pivoted to clean close (Cues ↑)');
  }
  if (temperature === 'irritated' && !p.deEscalates && !p.isBrief) {
    responsivenessToCues = Math.max(responsivenessToCues - 1, 1);
    misalignments.push('Irritated temperature cue not responded to — approach unchanged');
  }

  let momentumContinuity = 3;
  if (p.buildsOnHcp && p.singleAsk) {
    momentumContinuity = 4;
    positives.push('Smooth conversational continuity maintained (Momentum ↑)');
  }
  if (p.multipleQuestions && hcpState !== 'engaged') {
    momentumContinuity = 2;
    misalignments.push('Multiple questions disrupted conversational flow (Momentum ↓)');
  }
  if (p.isAggressive) {
    momentumContinuity = 1;
    misalignments.push('Aggressive language fragmented conversational momentum');
  }

  let signalAmplification = 3;
  if (p.amplifiesSignal && p.buildsOnHcp) {
    signalAmplification = 5;
    positives.push('Actively amplified HCP signal — richer dialogue enabled (Amplification ↑)');
  } else if (p.amplifiesSignal || p.buildsOnHcp) {
    signalAmplification = 4;
    positives.push('Built on HCP input to deepen engagement (Amplification ↑)');
  }
  if ((hcpState === 'irritated' || hcpState === 'disengaging') && p.continuesMonologue) {
    signalAmplification = 1;
    misalignments.push('Customer input ignored or redirected — no signal amplification');
  }
  if (p.isDismissive) {
    signalAmplification = 1;
    misalignments.push('Dismissive language blocked signal amplification');
  }

  const score = clamp(avg(customerParticipation, responsivenessToCues, momentumContinuity, signalAmplification));
  return {
    score,
    subScores: {
      customer_verbal_participation: clamp(customerParticipation),
      responsiveness_to_cues: clamp(responsivenessToCues),
      momentum_continuity: clamp(momentumContinuity),
      signal_amplification: clamp(signalAmplification),
    },
    positives,
    misalignments,
  };
}

// ─── 5. OBJECTION NAVIGATION — Objection Handling ─────────────────────────────
function scoreObjectionNavigation(hcpState, temperature, p) {
  const positives = [];
  const misalignments = [];

  if (hcpState !== 'resistant' && hcpState !== 'boundary-setting') {
    return {
      score: 3,
      subScores: { non_defensive_response: 3, constructive_engagement: 3 },
      positives: [],
      misalignments: [],
      notApplicable: true,
    };
  }

  let nonDefensive = 3;
  if (p.acknowledgesConcern && !p.defends && !p.overridesObjection) {
    nonDefensive = 4;
    positives.push('Remained open and composed when resistance appeared (Non-Defensive ↑)');
  }
  if (p.exploresObjection && !p.defends) {
    nonDefensive = 5;
    positives.push('Created psychological safety around the objection (Non-Defensive ↑)');
  }
  if (p.overridesObjection || p.defends) {
    nonDefensive = 1;
    misalignments.push('Defensive or dismissive response to resistance — objection overridden');
  }
  if (p.isAggressive) {
    nonDefensive = 1;
    misalignments.push('Aggressive language when facing resistance — defensiveness detected');
  }
  if (p.repeatedClaim && !p.acknowledgesConcern) {
    nonDefensive = 2;
    misalignments.push('Repeated claim under resistance — mild defensiveness without acknowledgment');
  }

  let constructiveEngagement = 3;
  if (p.exploresObjection) {
    constructiveEngagement = 4;
    positives.push('Explored objection to understand its basis before reframing (Constructive ↑)');
  }
  if (p.exploresObjection && p.acknowledgesConcern && p.reducedAsk) {
    constructiveEngagement = 5;
    positives.push('Skillfully navigated objection — deepened understanding and adjusted approach (Constructive ↑)');
  }
  if (!p.acknowledgesConcern && !p.exploresObjection) {
    constructiveEngagement = 2;
    misalignments.push('Objection acknowledged but not explored — premature reframe');
  }
  if (p.overridesObjection) {
    constructiveEngagement = 1;
    misalignments.push('Objection countered immediately without exploration — shuts down dialogue');
  }
  if (hcpState === 'boundary-setting' && !p.reducedAsk && !p.acknowledgesConcern) {
    constructiveEngagement = Math.max(constructiveEngagement - 1, 1);
    misalignments.push('Firm boundary not acknowledged or adjusted to — scope not reduced');
  }

  const score = clamp(avg(nonDefensive, constructiveEngagement));
  return {
    score,
    subScores: { non_defensive_response: clamp(nonDefensive), constructive_engagement: clamp(constructiveEngagement) },
    positives,
    misalignments,
  };
}

// ─── 6. CONVERSATION MANAGEMENT — Control & Structure ─────────────────────────
function scoreConversationManagement(hcpState, temperature, p) {
  const positives = [];
  const misalignments = [];

  let directionalClarity = 3;
  if (p.signalsPurpose && p.singleAsk) {
    directionalClarity = 4;
    positives.push('Clear sense of purpose and flow signaled (Directional Clarity ↑)');
  }
  if (p.signalsPurpose && p.singleAsk && p.gracefulClose) {
    directionalClarity = 5;
    positives.push('Consistently established and maintained conversational direction (Directional Clarity ↑)');
  }
  if (p.multipleQuestions && !p.signalsPurpose) {
    directionalClarity = 2;
    misalignments.push('Multiple asks without clear framing — direction unclear');
  }
  if (p.isAggressive) {
    directionalClarity = 1;
    misalignments.push('Aggressive language destroyed conversational direction');
  }
  if (hcpState === 'time-pressured' && !p.acknowledguesTime && !p.isBrief) {
    directionalClarity = 2;
    misalignments.push('Time constraint not acknowledged — structure not adapted to context');
  }

  let adaptiveSteering = 3;
  if (hcpState === 'time-pressured' && p.isBrief && p.singleAsk) {
    adaptiveSteering = 4;
    positives.push('Structure adapted to time pressure — brief and focused (Adaptive Steering ↑)');
    if (p.acknowledguesTime) {
      adaptiveSteering = 5;
      positives.push('Seamlessly balanced structure and adaptability under time pressure (Adaptive Steering ↑)');
    }
  }
  if ((hcpState === 'irritated' || hcpState === 'disengaging') && p.isVeryBrief) {
    adaptiveSteering = 4;
    positives.push('Structure flexed appropriately to disengagement — brevity maintained coherence (Adaptive Steering ↑)');
  }
  if ((hcpState === 'irritated' || hcpState === 'disengaging') && p.isLong) {
    adaptiveSteering = 1;
    misalignments.push('Long response when structure required brevity — rigidity under disengagement');
  }
  if (p.continues_after_disengagement && (hcpState === 'disengaging' || hcpState === 'irritated')) {
    adaptiveSteering = 1;
    misalignments.push('Continued introducing content when conversation needed to close — no adaptive steering');
  }
  if (hcpState === 'resistant' && p.acknowledgesConcern && p.reducedAsk) {
    adaptiveSteering = 4;
    positives.push('Structure flexed to resistance — scope reduced and concern honored (Adaptive Steering ↑)');
  }
  if (hcpState === 'time-pressured' && p.multipleQuestions) {
    adaptiveSteering = Math.max(adaptiveSteering - 1, 1);
    misalignments.push('Multiple asks used when single-ask discipline was required by time constraint');
  }

  const score = clamp(avg(directionalClarity, adaptiveSteering));
  return {
    score,
    subScores: { directional_clarity: clamp(directionalClarity), adaptive_steering: clamp(adaptiveSteering) },
    positives,
    misalignments,
  };
}

// ─── 7. ADAPTIVE RESPONSE — Adaptability ──────────────────────────────────────
function scoreAdaptiveResponse(hcpState, temperature, p, prevHcpState) {
  const positives = [];
  const misalignments = [];

  let situationalResponsiveness = 3;
  if (hcpState === 'time-pressured' && p.isBrief && p.acknowledguesTime) {
    situationalResponsiveness = 5;
    positives.push('Anticipated and adapted to time-pressure signal immediately (Situational ↑)');
  } else if (hcpState === 'time-pressured' && p.isBrief) {
    situationalResponsiveness = 4;
    positives.push('Adjusted promptly to time-pressure — shortened approach (Situational ↑)');
  } else if (hcpState === 'time-pressured' && !p.isBrief) {
    situationalResponsiveness = 1;
    misalignments.push('Did not adjust despite clear time-pressure signal — continued at same length');
  }
  if ((hcpState === 'irritated' || hcpState === 'disengaging') && p.deEscalates) {
    situationalResponsiveness = 5;
    positives.push('Adapted to disengagement/irritation with de-escalation behavior (Situational ↑)');
  }
  if ((hcpState === 'irritated' || hcpState === 'disengaging') && !p.deEscalates && !p.isBrief) {
    situationalResponsiveness = 1;
    misalignments.push('Did not adapt to disengagement/irritation — continued unchanged');
  }
  if ((hcpState === 'resistant' || hcpState === 'boundary-setting') && p.reducedAsk && p.acknowledgesConcern) {
    situationalResponsiveness = 4;
    positives.push('Adjusted approach to resistance — reduced ask and acknowledged (Situational ↑)');
  }
  if (hcpState === 'resistant' && p.repeatedClaim) {
    situationalResponsiveness = 1;
    misalignments.push('Repeated same approach under resistance — no situational adjustment detected');
  }
  if (temperature === 'irritated' && !p.deEscalates && !p.isBrief) {
    situationalResponsiveness = Math.max(situationalResponsiveness - 1, 1);
    misalignments.push('Emotional temperature visibly irritated but no adaptation in tone or length');
  }

  let adjustmentQuality = 3;
  if (hcpState === 'time-pressured' && p.isBrief && p.singleAsk && p.acknowledguesTime) {
    adjustmentQuality = 5;
    positives.push('Adjustment highly effective — brief, single ask, time acknowledged (Quality ↑)');
  } else if (hcpState === 'time-pressured' && p.isBrief && p.singleAsk) {
    adjustmentQuality = 4;
    positives.push('Adjustment clearly improved interaction — brevity and focus matched context (Quality ↑)');
  }
  if ((hcpState === 'irritated' || hcpState === 'disengaging') && p.deEscalates && p.offersNextStep) {
    adjustmentQuality = 5;
    positives.push('Adjustment maximally effective — de-escalated and offered clean exit (Quality ↑)');
  } else if ((hcpState === 'irritated' || hcpState === 'disengaging') && p.deEscalates) {
    adjustmentQuality = 4;
    positives.push('Adjustment effective — de-escalation matched disengagement signal (Quality ↑)');
  }
  if ((hcpState === 'irritated' || hcpState === 'disengaging') && p.continues_after_disengagement) {
    adjustmentQuality = 1;
    misalignments.push('Adjustment inappropriate — escalated when de-escalation was required');
  }
  if (p.defends && (hcpState === 'resistant' || hcpState === 'boundary-setting')) {
    adjustmentQuality = 1;
    misalignments.push('Adjustment disruptive — defensive response when openness was required');
  }
  if (p.isAggressive) {
    adjustmentQuality = 1;
    misalignments.push('Adjustment quality critically low — aggressive behavior is counterproductive');
  }

  const score = clamp(avg(situationalResponsiveness, adjustmentQuality));
  return {
    score,
    subScores: {
      situational_responsiveness: clamp(situationalResponsiveness),
      approach_adjustment_quality: clamp(adjustmentQuality),
    },
    positives,
    misalignments,
  };
}

// ─── 8. COMMITMENT GENERATION — Commitment Gaining ────────────────────────────
function scoreCommitmentGeneration(hcpState, temperature, p) {
  const positives = [];
  const misalignments = [];

  const receptiveState = hcpState === 'engaged' || hcpState === 'neutral';
  const closingState = hcpState === 'disengaging' || hcpState === 'time-pressured';
  const blockedState = hcpState === 'irritated' || hcpState === 'boundary-setting';

  let nextStepClarity = 3;
  if (p.specifiesNextStep && (receptiveState || closingState)) {
    nextStepClarity = 4;
    positives.push('Specific next action clearly stated (Next-Step Clarity ↑)');
  }
  if (p.specifiesNextStep && p.gracefulClose && closingState) {
    nextStepClarity = 5;
    positives.push('Explicit, concrete next step secured at close (Next-Step Clarity ↑)');
  }
  if (!p.offersNextStep && !p.specifiesNextStep && closingState) {
    nextStepClarity = 2;
    misalignments.push('Closing moment reached but no next step identified');
  }

  let customerOwnership = 3;
  if (p.invitesCommitment && !p.demandLanguage) {
    customerOwnership = 4;
    positives.push('Next step invited rather than imposed — customer ownership supported (Ownership ↑)');
  }
  if (p.invitesCommitment && p.specifiesNextStep && !p.demandLanguage && receptiveState) {
    customerOwnership = 5;
    positives.push('Customer proactively positioned to own next action (Ownership ↑)');
  }
  if (p.demandLanguage) {
    customerOwnership = 1;
    misalignments.push('Demand language used — commitment imposed, not owned by customer');
  }
  if (p.pressureLanguage) {
    customerOwnership = Math.max(customerOwnership - 1, 1);
    misalignments.push('Pressure language undermines voluntary commitment');
  }
  if (blockedState && p.offersNextStep) {
    customerOwnership = 2;
    misalignments.push('Commitment attempted when HCP was not in a receptive state — passive agreement at best');
  }

  const score = clamp(avg(nextStepClarity, customerOwnership));
  return {
    score,
    subScores: { next_step_clarity: clamp(nextStepClarity), customer_ownership: clamp(customerOwnership) },
    positives,
    misalignments,
  };
}

// ─── SIGNAL–RESPONSE ALIGNMENT RUBRIC (5 derived checks) ──────────────────────
function computeAlignmentRubric(hcpState, p) {
  const rubricMisalignments = [];

  const concernDetected = hcpState === 'resistant' || hcpState === 'boundary-setting';
  if (concernDetected && !p.acknowledgesConcern && !p.paraphrasesHcp) {
    rubricMisalignments.push(
      'A concern was raised, but it wasn\'t acknowledged before the conversation moved forward. This may reduce trust.'
    );
  }
  if (concernDetected && p.overridesObjection) {
    rubricMisalignments.push(
      'The objection was addressed before it was explored, which may limit credibility.'
    );
  }
  const engagementDrop = hcpState === 'disengaging' || hcpState === 'irritated';
  if (engagementDrop && !p.deEscalates && !p.isBrief && p.continuesMonologue) {
    rubricMisalignments.push(
      'Engagement decreased after your response, but the approach did not adjust. This may affect access.'
    );
  }
  const noSignalSupport = hcpState === 'neutral' && p.pitchesTooEarly && !p.asksDiscovery && !p.buildsOnHcp;
  if (noSignalSupport) {
    rubricMisalignments.push(
      'Value was introduced before customer priorities were established, which may feel misaligned.'
    );
  }
  const readinessSignal = hcpState === 'engaged' && !p.invitesCommitment && !p.offersNextStep && !p.specifiesNextStep;
  if (readinessSignal && !p.hasQuestion) {
    rubricMisalignments.push(
      'A readiness signal appeared, but next steps were not aligned, which may slow momentum.'
    );
  }

  return rubricMisalignments;
}

// ─── MAIN EXPORT ───────────────────────────────────────────────────────────────
/**
 * computeAlignment
 *
 * @param {string} hcpState     - Structural state visible to rep BEFORE speaking
 * @param {string} repMessage   - The rep's submitted message
 * @param {*}      _unused      - Legacy param (ignored)
 * @param {string} temperature  - Emotional temperature at that moment
 * @param {string} prevHcpState - Previous turn's state (for adaptive scoring)
 * @returns alignment object
 */
export function computeAlignment(hcpState, repMessage, _unused, temperature = 'neutral', prevHcpState = null) {
  const startTs = (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now();
  const p = detectPatterns(repMessage);
  // Robust misalignment: track repeated/aggressive responses
  let repeatedAggressive = false;
  let repeatedMisalignment = false;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    let lastAggressive = window.sessionStorage.getItem('lastAggressive') === 'true';
    let lastMisalignments = window.sessionStorage.getItem('lastMisalignments') || '';
    repeatedAggressive = lastAggressive && p.isAggressive;
    repeatedMisalignment = lastMisalignments === repMessage;
    window.sessionStorage.setItem('lastAggressive', p.isAggressive ? 'true' : 'false');
    window.sessionStorage.setItem('lastMisalignments', repMessage);
  }

  const STATE_LABELS = {
    'neutral': 'Neutral State',
    'engaged': 'Engaged State',
    'time-pressured': 'Time Constraint Active',
    'resistant': 'Resistance / Objection',
    'boundary-setting': 'Firm Boundary',
    'irritated': 'Irritated / Negative',
    'disengaging': 'Disengaging',
  };

  const STATE_DESCRIPTIONS = {
    'neutral': 'Standard interaction. Rep should establish context and HCP priorities before value framing.',
    'engaged': 'HCP is actively participating. Rep should build on momentum, deepen dialogue, and align on next steps.',
    'time-pressured': 'HCP is time-constrained. Be brief, single ask, explicitly acknowledge the constraint.',
    'resistant': 'HCP is guarded. Acknowledge concern first, explore before reframing.',
    'boundary-setting': 'HCP has set a firm limit. Honor it explicitly, reduce scope, do not push.',
    'irritated': 'HCP is irritated. De-escalate and minimize ask immediately.',
    'disengaging': 'HCP is leaving. Close cleanly with one concrete next step or graceful release.',
  };

  const metricResults = {
    question_quality:         scoreSignalAwareness(hcpState, temperature, p),
    listening_responsiveness:    scoreSignalInterpretation(hcpState, temperature, p),
    making_it_matter:         scoreValueConnection(hcpState, temperature, p),
    customer_engagement_cues_cues:      scoreCustomerEngagement(hcpState, temperature, p),
    objection_handling:     scoreObjectionNavigation(hcpState, temperature, p),
    conversation_control:  scoreConversationManagement(hcpState, temperature, p),
    adaptability:        scoreAdaptiveResponse(hcpState, temperature, p, prevHcpState),
    commitment_gaining:    scoreCommitmentGeneration(hcpState, temperature, p),
  };

  const globalMisalignments = [];
  let universalPenalty = 0;
  if (p.isAggressive) {
    universalPenalty = -99; // Force minimum score
    globalMisalignments.push('Aggressive or profane language used — damages all capability scores');
    if (repeatedAggressive) {
      universalPenalty -= 2;
      globalMisalignments.push('Repeated aggressive language — session at risk of termination.');
    }
  }
  if (p.isDismissive) {
    universalPenalty -= 1;
    globalMisalignments.push('Dismissive language used — ignores HCP signal across all dimensions');
  }
  if (repeatedMisalignment) {
    universalPenalty -= 2;
    globalMisalignments.push('Repeated misaligned response — scores further reduced.');
  }

  const rubricMisalignments = computeAlignmentRubric(hcpState, p);

  const metricScores = Object.values(metricResults).map(m => m.score);
  const rawAvg = metricScores.reduce((a, b) => a + b, 0) / metricScores.length;
  const overallScore = p.isAggressive || repeatedAggressive ? 1 : Math.max(1, Math.min(5, roundHalfUp(rawAvg + universalPenalty, 1)));

  const allPositives = [];
  const allMisalignments = [...globalMisalignments];
  Object.values(metricResults).forEach(m => {
    allPositives.push(...m.positives);
    allMisalignments.push(...m.misalignments);
  });
  allMisalignments.push(...rubricMisalignments);

  const metricsList = Object.entries(metricResults).map(([id, metric]) => ({
    id,
    score: metric.score,
    components: metric.subScores || {},
    metricsVersion: CANONICAL_METRICS_VERSION,
  }));
  validateMetricResults(metricsList);

  if (import.meta.env.DEV) {
    validateMetricIntegrity(metricsList);
    detectMetricDrift(metricsList);
    const endTs = (typeof performance !== 'undefined' && typeof performance.now === 'function')
      ? performance.now()
      : Date.now();
    const durationMs = endTs - startTs;
    const metadata = _unused && typeof _unused === 'object' ? _unused : {};
    logScoringExecution({
      scenarioId: metadata.scenarioId,
      turnIndex: metadata.turnIndex,
      metricsVersion: CANONICAL_METRICS_VERSION,
      metricResults: metricsList,
      durationMs,
    });
  }

  Object.values(metricResults).forEach((metric) => {
    metric.metricsVersion = CANONICAL_METRICS_VERSION;
  });

  return {
    score: overallScore,
    metricsVersion: CANONICAL_METRICS_VERSION,
    metrics: metricResults,
    ruleLabel: STATE_LABELS[hcpState] || 'Unknown State',
    ruleDescription: STATE_DESCRIPTIONS[hcpState] || '',
    positives: [...new Set(allPositives)],
    misalignments: [...new Set(allMisalignments)],
    rubricAlignmentFlags: rubricMisalignments,
    guardrail: 'Signal–Response Alignment evaluates observable behavioral adaptation — not empathy, intent, emotion, or personality.',
  };
}
