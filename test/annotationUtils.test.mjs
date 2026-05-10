import test from "node:test";
import assert from "node:assert/strict";

import { buildAnnotationMap, FALLBACK_CAP_STYLE, getCapabilityStyle } from "../src/components/roleplay/annotationUtils.js";

test("buildAnnotationMap normalizes unknown capability and invalid entries", () => {
  const parsed = [
    { index: 1, capability: "signal_awareness", type: "strength", note: "Good opener" },
    { index: 2, capability: "not_a_real_cap", type: "strength", note: "Unknown cap from model" },
    { index: -1, capability: "signal_awareness", type: "strength", note: "Invalid index" },
    { index: "3", capability: "signal_awareness", type: "bad_type", note: "" },
  ];

  const result = buildAnnotationMap(parsed, ["signal_awareness"]);

  assert.equal(result[1].capability, "signal_awareness");
  assert.equal(result[2].capability, "unknown");
  assert.equal(result[3].type, "concern");
  assert.equal(result[3].note, "Signal detected");
  assert.equal(result[-1], undefined);
});

test("getCapabilityStyle returns fallback for unknown capability", () => {
  const colors = {
    signal_awareness: {
      bg: "bg-teal-100",
      border: "border-teal-300",
      text: "text-teal-800",
      label: "Signal Awareness",
      dot: "bg-teal-400",
    },
  };

  assert.deepEqual(getCapabilityStyle("signal_awareness", colors), colors.signal_awareness);
  assert.deepEqual(getCapabilityStyle("unknown", colors), FALLBACK_CAP_STYLE);
  assert.deepEqual(getCapabilityStyle(undefined, colors), FALLBACK_CAP_STYLE);
});
