/**
 * Signal Intelligence Behavioral Metrics Specification (SI-v2-locked-2026)
 * 
 * Canonical metric definitions. All metrics scale 1.0–5.0, 1 decimal precision.
 * 3.0 = effective baseline. No ML, no intent inference, observable behavior only.
 */

export const METRICS_VERSION = 'SI-v2-locked-2026';

export const METRICS_SPEC = [
  {
    id: 'question_quality',
    metric: 'Question Quality',
    capability: 'Signal Awareness',
    optional: false,
    components: [
      { name: 'contextual_relevance', description: 'Questions reference customer goals/context', weight: 0.5 },
      { name: 'forward_value', description: 'Questions move toward decision/action', weight: 0.5 },
    ],
    score_formula: 'average_of_components',
  },
  {
    id: 'listening_responsiveness',
    metric: 'Listening & Responsiveness',
    capability: 'Signal Interpretation',
    optional: false,
    components: [
      { name: 'accuracy_of_interpretation', description: 'Paraphrasing and understanding', weight: 0.5 },
      { name: 'responsiveness_of_action', description: 'Behavioral adjustment based on input', weight: 0.5 },
    ],
    score_formula: 'average_of_components',
  },
  {
    id: 'making_it_matter',
    metric: 'Making It Matter',
    capability: 'Value Connection',
    optional: false,
    components: [
      { name: 'customer_relevance_alignment', description: 'Value linked to customer context', weight: 0.5 },
      { name: 'outcome_translation', description: 'Features translated to outcomes', weight: 0.5 },
    ],
    optional_components: [
      { name: 'decision_orientation', description: 'Outcome clarity (optional)', weight: null },
    ],
    score_formula: 'average_of_components_plus_optional_if_activated',
  },
  {
    id: 'customer_engagement_cues_cues',
    metric: 'Customer Engagement Cues',
    capability: 'Customer Engagement Monitoring',
    optional: false,
    components: [
      { name: 'customer_verbal_participation_ratio', description: 'Customer airtime %', weight: null },
      { name: 'responsiveness_to_customer_cues', description: 'Direct references to prior turn', weight: null },
      { name: 'momentum_continuity', description: 'Topic continuity flow', weight: null },
      { name: 'customer_signal_amplification', description: 'Rep expands on customer idea', weight: null },
    ],
    score_formula: 'RECOMMEND_AVERAGE_OF_FOUR',
  },
  {
    id: 'objection_handling',
    metric: 'Objection Handling',
    capability: 'Objection Navigation',
    optional: false,
    components: [
      { name: 'non_defensive_response', description: 'Acknowledgment-first approach', weight: 0.5 },
      { name: 'constructive_engagement', description: 'Exploration before reframing', weight: 0.5 },
    ],
    optional_components: [
      { name: 'resolution_clarity', description: 'Explicit next step (optional)', weight: null },
    ],
    score_formula: 'average_of_core_metrics_plus_optional_if_activated',
  },
  {
    id: 'conversation_control',
    metric: 'Conversation Control & Structure',
    capability: 'Conversation Management',
    optional: false,
    components: [
      { name: 'directional_clarity', description: 'Direction signaling', weight: 0.3333 },
      { name: 'adaptive_steering', description: 'Proposal and pivot', weight: 0.3333 },
      { name: 'purposeful_closure', description: 'Summary and next step', weight: 0.3334 },
    ],
    score_formula: 'average_of_components',
  },
  {
    id: 'adaptability',
    metric: 'Adaptability',
    capability: 'Adaptive Response',
    optional: false,
    components: [
      { name: 'situational_responsiveness', description: 'Recognition of changed context', weight: 0.5 },
      { name: 'approach_adjustment_quality', description: 'Quality of behavioral shift', weight: 0.5 },
    ],
    optional_components: [
      { name: 'continuity_preservation', description: 'Coherence during shift (optional)', weight: null },
    ],
    score_formula: 'average_of_core_metrics_plus_optional_if_activated',
  },
  {
    id: 'commitment_gaining',
    metric: 'Commitment Gaining',
    capability: 'Commitment Generation',
    optional: false,
    components: [
      { name: 'next_step_clarity', description: 'Explicit agreed next action', weight: 0.5 },
      { name: 'customer_ownership', description: 'Customer-language commitment', weight: 0.5 },
    ],
    optional_components: [
      { name: 'commitment_strength', description: 'Confidence of follow-through (optional)', weight: null },
    ],
    score_formula: 'average_of_core_metrics_plus_optional_if_activated',
  },
];