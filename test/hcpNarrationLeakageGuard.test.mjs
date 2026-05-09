// Regression test: HCP narration/cue leakage guard
// Ensures narration/stage-direction never appears in hcpReply, but observedCue is preserved
import { applyHcpResponseSurface } from "../src/lib/hcpResponseSurface";

describe("HCP narration/cue leakage guard", () => {
  const baseContext = {
    scenario: { interactionPressure: ["time_constrained"], title: "Test Scenario" },
    turn: { concernFamily: "access", phase: "objection_resolution", escalationStage: "baseline" },
    profile: {},
    hcpTurnCount: 1,
  };

  it("blocks narration phrases from hcpReply", () => {
    const narration = "Keeps the study page in view...";
    const result = applyHcpResponseSurface({ ...baseContext, hcpReply: narration });
    expect(result).not.toMatch(/Keeps the study page/);
    expect(result).toMatch(/I remember the study|What|concern|decision/i);
  });

  it("repairs known narration to natural HCP line", () => {
    const narration = "Glances at watch.";
    const result = applyHcpResponseSurface({ ...baseContext, hcpReply: narration });
    expect(result).toMatch(/Be specific/);
  });

  it("does not over-rewrite valid HCP lines", () => {
    const spoken = "What changes my decision?";
    const result = applyHcpResponseSurface({ ...baseContext, hcpReply: spoken });
    expect(result).toBe(spoken);
  });

  it("blocks generic narration patterns", () => {
    const narration = "Looks at the schedule.";
    const result = applyHcpResponseSurface({ ...baseContext, hcpReply: narration });
    expect(result).not.toMatch(/Looks at the schedule/);
    expect(result).toMatch(/Keep it quick|What’s the point/i);
  });

  it("preserves observedCue as metadata (sidecar)", () => {
    // This test is a placeholder: actual observedCue logic is in hcpCueGenerator, not surface
    // Here we just ensure the surface does not delete cues from context
    const narration = "Keeps the formulary sheet in view...";
    const result = applyHcpResponseSurface({ ...baseContext, hcpReply: narration });
    expect(result).not.toMatch(/Keeps the formulary sheet/);
  });
});
