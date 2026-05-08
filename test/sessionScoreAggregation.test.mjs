import test from "node:test";
import assert from "node:assert/strict";

import { computeSessionOverallScoreFromTurns } from "../src/components/roleplay/sessionScoreAggregation.js";

test("computeSessionOverallScoreFromTurns averages only active evaluated metrics", () => {
  const turns = [
    {
      alignment: {
        metrics: {
          signal_awareness: { score: 4, isEvaluated: true, isTriggered: true },
          signal_interpretation: { score: 1, isEvaluated: false, isTriggered: true },
          value_connection: { score: 5, isEvaluated: true, isTriggered: false },
          customer_engagement: { score: 3, isEvaluated: true, isTriggered: true },
        },
      },
    },
    {
      alignment: {
        metrics: {
          signal_awareness: { score: 2, isEvaluated: true, isTriggered: true },
          customer_engagement: { score: 5, isEvaluated: true, isTriggered: true },
        },
      },
    },
  ];

  const overall = computeSessionOverallScoreFromTurns(turns, [
    "signal_awareness",
    "signal_interpretation",
    "value_connection",
    "customer_engagement",
  ]);

  // signal_awareness avg = (4+2)/2 = 3
  // customer_engagement avg = (3+5)/2 = 4
  // overall = (3 + 4) / 2 = 3.5
  assert.equal(overall, 3.5);
});

