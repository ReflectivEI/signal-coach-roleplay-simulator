import fs from "node:fs";

const d = JSON.parse(fs.readFileSync("/tmp/rps_validation_output.json", "utf8"));

const turns = d.turns.map((t) => ({
  turn: t.turn,
  temperature: t.temperature,
  rep_input: t.rep_input,
  hcp_response: t.hcp_response,
  cue_signal: t.cue_signal,
  voice_metadata: t.voice_metadata,
  voice_behavior_adaptation: t.evaluation.voice_behavior_adaptation,
  evaluation_summary: {
    overall_score: t.evaluation.overall_score,
    key_strength: (t.evaluation.observed_strengths || [])[0] || null,
    key_gap: (t.evaluation.missed_cues || [])[0] || null,
    hcp_progression: t.evaluation.outcome_analysis?.hcp_progression,
    conversation_advanced: t.evaluation.outcome_analysis?.conversation_advanced,
  },
  metric_scores: t.evaluation.metric_scores,
  hcp_brain_alignment: t.evaluation.hcp_brain_alignment,
  outcome_analysis: t.evaluation.outcome_analysis,
  delivery_impact_on_hcp: t.evaluation.delivery_impact_on_hcp,
  coaching_feedback: t.evaluation.coaching_feedback,
  delivery_coaching: t.evaluation.delivery_coaching,
  conversation_memory: t.evaluation.conversation_memory,
}));

const scores = turns.map((t) => Number(t.evaluation_summary.overall_score || 0));
const resistanceTrend = turns.map((t) => t.conversation_memory?.resistance_trend || null);
const trustTrend = turns.map((t) => t.conversation_memory?.trust_trend || null);
const reactions = turns.map((t) => t.voice_behavior_adaptation?.hcp_reaction_modifier || null);
const qualitySatisfied = turns.map((t) => t.hcp_brain_alignment?.quality_test_satisfied ?? null);

const genericHcp = turns
  .filter((t) => /tell me more about your product|how is this different|i'?m skeptical|can you provide evidence|this seems interesting/i.test(String(t.hcp_response || "")))
  .map((t) => t.turn);

const missingFieldTurns = turns
  .filter(
    (t) =>
      !t.metric_scores ||
      !t.hcp_brain_alignment ||
      !t.outcome_analysis ||
      !t.delivery_impact_on_hcp ||
      !t.coaching_feedback ||
      !t.delivery_coaching,
  )
  .map((t) => t.turn);

const out = {
  scenario_summary: d.scenario_summary,
  turns,
  conversation_stats: {
    score_series: scores,
    score_avg: Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)),
    score_min: Math.min(...scores),
    score_max: Math.max(...scores),
    resistance_trend_series: resistanceTrend,
    trust_trend_series: trustTrend,
    reaction_series: reactions,
    quality_test_satisfied_series: qualitySatisfied,
    final_memory: d.final_memory,
  },
  failure_scan: {
    generic_hcp_turns: genericHcp,
    missing_field_turns: missingFieldTurns,
  },
};

console.log(JSON.stringify(out, null, 2));
