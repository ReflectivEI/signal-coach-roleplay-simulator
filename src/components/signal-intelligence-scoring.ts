/**
 * Signal Intelligence Behavioral Metrics Scoring (SI-v2-locked-2026-02-11)
 * Deterministic, observable-behavior-only, no ML, no intent inference.
 */

import { METRICS_SPEC, METRICS_VERSION, type BehavioralMetricId } from './signal-intelligence-metrics-spec';

export type Turn = { speaker: 'rep' | 'customer'; text: string };
export type Transcript = Turn[];

export type ComponentResult = {
  name: string;
  score: number | null;
  applicable: boolean;
  weight: number | null;
  rationale?: string;
};

export type MetricResult = {
  id: BehavioralMetricId;
  metric: string;
  capability: string;
  components: ComponentResult[];
  overall_score: number | null;
  not_applicable?: boolean;
  metricsVersion: string;
};

// ─── ROUNDING (SI-v2 canonical) ───
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─── TEXT PROCESSING ───
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this',
  'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their'
]);

export function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z]+/).filter(t => t.length > 2 && !STOPWORDS.has(t));
}

export function overlap(tokens1: string[], tokens2: string[]): number {
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  const intersection = [...set1].filter(t => set2.has(t));
  return intersection.length / Math.max(set1.size, set2.size);
}

export function containsAny(text: string, phrases: string[]): boolean {
  const lower = text.toLowerCase();
  return phrases.some(p => lower.includes(p.toLowerCase()));
}

export function countOccurrences(text: string, phrases: string[]): number {
  const lower = text.toLowerCase();
  return phrases.filter(p => lower.includes(p.toLowerCase())).length;
}

export function isQuestion(text: string): boolean {
  return text.trim().endsWith('?');
}

// ─── COMPONENT SCORERS ───

function scoreContextualRelevance(transcript: Transcript): ComponentResult {
  const repQuestions = transcript.filter(t => t.speaker === 'rep' && isQuestion(t.text));
  const Q = repQuestions.length;
  if (Q === 0) return { name: 'contextual_relevance', score: null, applicable: false, weight: 0.5 };

  const goalKeywords = ['need', 'goal', 'concern', 'challenge', 'priority', 'trying', 'want', 'issue', 'barrier', 'struggling'];
  const goalTokens = new Set<string>();
  transcript.filter(t => t.speaker === 'customer').forEach(turn => {
    const tokens = tokenize(turn.text);
    tokens.forEach((token, idx) => {
      if (goalKeywords.includes(token) && idx + 1 < tokens.length) goalTokens.add(tokens[idx + 1]);
    });
  });

  const bridgingPhrases = ['you mentioned', 'when you said', 'earlier you noted', 'based on what you said'];
  let G = 0;
  repQuestions.forEach(q => {
    if (overlap(tokenize(q.text), [...goalTokens]) > 0 || containsAny(q.text, bridgingPhrases)) G++;
  });

  const ratio = G / Q;
  const score = ratio >= 0.60 ? 5 : ratio >= 0.45 ? 4 : ratio >= 0.30 ? 3 : ratio >= 0.15 ? 2 : 1;
  return { name: 'contextual_relevance', score: round1(score), applicable: true, weight: 0.5, rationale: `${G}/${Q}` };
}

function scoreForwardValue(transcript: Transcript): ComponentResult {
  const repQuestions = transcript.filter(t => t.speaker === 'rep' && isQuestion(t.text));
  const Q = repQuestions.length;
  if (Q === 0) return { name: 'forward_value', score: null, applicable: false, weight: 0.5 };

  const forwardPhrases = ['how are you currently', 'what would success look like', 'what would need to change', 'how would that impact', 'what would make you comfortable', 'what would it take', 'if we could', 'how do you see', 'what happens next', 'why', 'how'];
  let F = 0;
  repQuestions.forEach(q => { if (containsAny(q.text, forwardPhrases)) F++; });

  const ratio = F / Q;
  const score = ratio >= 0.70 ? 5 : ratio >= 0.55 ? 4 : ratio >= 0.40 ? 3 : ratio >= 0.25 ? 2 : 1;
  return { name: 'forward_value', score: round1(score), applicable: true, weight: 0.5, rationale: `${F}/${Q}` };
}

function scoreAccuracyOfInterpretation(transcript: Transcript): ComponentResult {
  const paraphrasePhrases = ["what i'm hearing", "so you're saying", 'if i understand', 'it sounds like'];
  let count = 0;
  transcript.filter(t => t.speaker === 'rep').forEach((t, idx) => {
    if (containsAny(t.text, paraphrasePhrases)) count++;
  });
  const score = count === 0 ? 1 : count === 1 ? 3 : 5;
  return { name: 'accuracy_of_interpretation', score: round1(score), applicable: true, weight: 0.5 };
}

function scoreResponsivenessOfAction(transcript: Transcript): ComponentResult {
  const pivotPhrases = ['based on that', 'let me adjust', 'in light of', 'given what you said'];
  let count = 0;
  transcript.filter(t => t.speaker === 'rep').forEach(t => { if (containsAny(t.text, pivotPhrases)) count++; });
  const score = count === 0 ? 1 : count === 1 ? 3 : 5;
  return { name: 'responsiveness_of_action', score: round1(score), applicable: true, weight: 0.5 };
}

function scoreCustomerRelevanceAlignment(transcript: Transcript): ComponentResult {
  const linkingPhrases = ['for your patients', 'in your practice', 'given your population'];
  let count = 0;
  transcript.filter(t => t.speaker === 'rep').forEach(t => { count += countOccurrences(t.text, linkingPhrases); });
  const score = count === 0 ? 1 : count === 1 ? 3 : 5;
  return { name: 'customer_relevance_alignment', score: round1(score), applicable: true, weight: 0.5 };
}

function scoreOutcomeTranslation(transcript: Transcript): ComponentResult {
  const translationPhrases = ['this means', 'the impact would be', 'the result is'];
  let count = 0;
  transcript.filter(t => t.speaker === 'rep').forEach(t => { count += countOccurrences(t.text, translationPhrases); });
  const score = count === 0 ? 1 : count === 1 ? 3 : 5;
  return { name: 'outcome_translation', score: round1(score), applicable: true, weight: 0.5 };
}

function scoreCustomerVerbalParticipation(transcript: Transcript): ComponentResult {
  const customerWords = transcript.filter(t => t.speaker === 'customer').reduce((s, t) => s + t.text.split(/\s+/).length, 0);
  const totalWords = transcript.reduce((s, t) => s + t.text.split(/\s+/).length, 0);
  if (totalWords === 0) return { name: 'customer_verbal_participation_ratio', score: null, applicable: false, weight: null };
  
  const ratio = customerWords / totalWords;
  const score = (ratio >= 0.35 && ratio <= 0.55) ? 5 : (ratio >= 0.20) ? 3 : 1;
  return { name: 'customer_verbal_participation_ratio', score: round1(score), applicable: true, weight: null };
}

function scoreResponsivenessToCustomerCues(transcript: Transcript): ComponentResult {
  let count = 0;
  transcript.forEach((t, idx) => {
    if (t.speaker === 'rep' && idx > 0 && transcript[idx - 1].speaker === 'customer') {
      if (overlap(tokenize(t.text), tokenize(transcript[idx - 1].text)) > 0.15) count++;
    }
  });
  const score = count === 0 ? 1 : count <= 2 ? 3 : 5;
  return { name: 'responsiveness_to_customer_cues', score: round1(score), applicable: true, weight: null };
}

function scoreMomentumContinuity(transcript: Transcript): ComponentResult {
  let jumps = 0;
  for (let i = 1; i < transcript.length; i++) {
    if (overlap(tokenize(transcript[i - 1].text), tokenize(transcript[i].text)) < 0.10) jumps++;
  }
  const jumpRate = jumps / (transcript.length - 1);
  const score = jumpRate <= 0.20 ? 5 : jumpRate <= 0.40 ? 3 : 1;
  return { name: 'momentum_continuity', score: round1(score), applicable: true, weight: null };
}

function scoreCustomerSignalAmplification(transcript: Transcript): ComponentResult {
  let count = 0;
  transcript.forEach((t, idx) => {
    if (t.speaker === 'rep' && idx > 0 && transcript[idx - 1].speaker === 'customer') {
      const repWords = t.text.split(/\s+/).length;
      const custWords = transcript[idx - 1].text.split(/\s+/).length;
      if (repWords > custWords && overlap(tokenize(t.text), tokenize(transcript[idx - 1].text)) > 0.20) count++;
    }
  });
  const score = count === 0 ? 1 : count === 1 ? 3 : 5;
  return { name: 'customer_signal_amplification', score: round1(score), applicable: true, weight: null };
}

function scoreNonDefensiveResponse(transcript: Transcript): ComponentResult {
  const ackPhrases = ['i understand your concern', "that's fair", 'i hear you', 'that makes sense'];
  let count = 0;
  transcript.filter(t => t.speaker === 'rep').forEach(t => { count += countOccurrences(t.text, ackPhrases); });
  const score = count === 0 ? 1 : count === 1 ? 3 : 5;
  return { name: 'non_defensive_response', score: round1(score), applicable: true, weight: 0.5 };
}

function scoreConstructiveEngagement(transcript: Transcript): ComponentResult {
  const objKeywords = ['concern', 'worried', 'hesitant', 'problem', 'issue', 'not sure', "don't", "can't", "won't"];
  let followUpCount = 0;
  transcript.forEach((t, idx) => {
    if (t.speaker === 'customer' && containsAny(t.text, objKeywords)) {
      const nextRep = transcript.slice(idx + 1).find(x => x.speaker === 'rep');
      if (nextRep && isQuestion(nextRep.text)) followUpCount++;
    }
  });
  const score = followUpCount === 0 ? 1 : followUpCount === 1 ? 3 : 5;
  return { name: 'constructive_engagement', score: round1(score), applicable: true, weight: 0.5 };
}

function scoreDirectionalClarity(transcript: Transcript): ComponentResult {
  const markers = ['first', 'next', 'to summarize', 'let me', 'so'];
  let count = 0;
  transcript.filter(t => t.speaker === 'rep').forEach(t => { count += countOccurrences(t.text, markers); });
  const score = count === 0 ? 1 : count === 1 ? 3 : 5;
  return { name: 'directional_clarity', score: round1(score), applicable: true, weight: 0.3333 };
}

function scoreAdaptiveSteering(transcript: Transcript): ComponentResult {
  const phrases = ['let me', "let's", 'how about', 'what if'];
  let count = 0;
  transcript.filter(t => t.speaker === 'rep').forEach(t => { count += countOccurrences(t.text, phrases); });
  const score = count === 0 ? 1 : count === 1 ? 3 : 5;
  return { name: 'adaptive_steering', score: round1(score), applicable: true, weight: 0.3333 };
}

function scorePurposefulClosure(transcript: Transcript): ComponentResult {
  const phrases = ['to summarize', 'in summary', "so what we've covered", 'to recap'];
  let count = 0;
  transcript.filter(t => t.speaker === 'rep').forEach(t => { count += countOccurrences(t.text, phrases); });
  const score = count === 0 ? 1 : count === 1 ? 3 : 5;
  return { name: 'purposeful_closure', score: round1(score), applicable: true, weight: 0.3334 };
}

function scoreSituationalResponsiveness(transcript: Transcript): ComponentResult {
  const phrases = ["let's take a different approach", 'given that', 'in that case', 'based on that'];
  let count = 0;
  transcript.filter(t => t.speaker === 'rep').forEach(t => { count += countOccurrences(t.text, phrases); });
  const score = count === 0 ? 1 : count === 1 ? 3 : 5;
  return { name: 'situational_responsiveness', score: round1(score), applicable: true, weight: 0.5 };
}

function scoreApproachAdjustmentQuality(transcript: Transcript): ComponentResult {
  const phrases = ['let me try', 'another way', 'differently', 'adjust'];
  let count = 0;
  transcript.filter(t => t.speaker === 'rep').forEach(t => { count += countOccurrences(t.text, phrases); });
  const score = count === 0 ? 1 : count === 1 ? 3 : 5;
  return { name: 'approach_adjustment_quality', score: round1(score), applicable: true, weight: 0.5 };
}

function scoreNextStepClarity(transcript: Transcript): ComponentResult {
  const phrases = ['would you be open', 'can we schedule', 'what would be the next step', 'next step', 'follow up'];
  let count = 0;
  transcript.filter(t => t.speaker === 'rep').forEach(t => { count += countOccurrences(t.text, phrases); });
  const score = count === 0 ? 1 : count === 1 ? 3 : 5;
  return { name: 'next_step_clarity', score: round1(score), applicable: true, weight: 0.5 };
}

function scoreCustomerOwnership(transcript: Transcript): ComponentResult {
  const phrases = ['would you', 'can you', 'will you', 'are you willing'];
  let count = 0;
  transcript.filter(t => t.speaker === 'rep').forEach(t => { count += countOccurrences(t.text, phrases); });
  const score = count === 0 ? 1 : count === 1 ? 3 : 5;
  return { name: 'customer_ownership', score: round1(score), applicable: true, weight: 0.5 };
}

// ─── SCORER MAP ───
const SCORERS: Record<string, (t: Transcript) => ComponentResult> = {
  contextual_relevance: scoreContextualRelevance,
  forward_value: scoreForwardValue,
  accuracy_of_interpretation: scoreAccuracyOfInterpretation,
  responsiveness_of_action: scoreResponsivenessOfAction,
  customer_relevance_alignment: scoreCustomerRelevanceAlignment,
  outcome_translation: scoreOutcomeTranslation,
  customer_verbal_participation_ratio: scoreCustomerVerbalParticipation,
  responsiveness_to_customer_cues: scoreResponsivenessToCustomerCues,
  momentum_continuity: scoreMomentumContinuity,
  customer_signal_amplification: scoreCustomerSignalAmplification,
  non_defensive_response: scoreNonDefensiveResponse,
  constructive_engagement: scoreConstructiveEngagement,
  directional_clarity: scoreDirectionalClarity,
  adaptive_steering: scoreAdaptiveSteering,
  purposeful_closure: scorePurposefulClosure,
  situational_responsiveness: scoreSituationalResponsiveness,
  approach_adjustment_quality: scoreApproachAdjustmentQuality,
  next_step_clarity: scoreNextStepClarity,
  customer_ownership: scoreCustomerOwnership
};

// ─── AGGREGATION ───
function averageApplicable(components: ComponentResult[]): number | null {
  const applicable = components.filter(c => c.applicable && c.score !== null);
  return applicable.length === 0 ? null : round1(applicable.reduce((a, c) => a + (c.score || 0), 0) / applicable.length);
}

export function scoreAllMetrics(transcript: Transcript): MetricResult[] {
  return METRICS_SPEC.map(spec => {
    const components: ComponentResult[] = spec.components.map(comp => {
      const scorer = SCORERS[comp.name];
      return scorer ? scorer(transcript) : { name: comp.name, score: null, applicable: false, weight: comp.weight };
    });

    const overall_score = averageApplicable(components);
    return {
      id: spec.id as BehavioralMetricId,
      metric: spec.metric,
      capability: spec.capability,
      components,
      overall_score,
      not_applicable: overall_score === null,
      metricsVersion: METRICS_VERSION
    };
  });
}