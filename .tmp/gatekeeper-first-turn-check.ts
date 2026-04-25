import { ALL_SCENARIOS } from './src/lib/scenarioCatalog.js';
import { generateHcpResponse } from './src/lib/hcpResponseGenerator';

const scenario = ALL_SCENARIOS.find((s: any) => s.id === 'builtin-the-gatekeeper-filter' || s.title === 'The Gatekeeper Filter');
if (!scenario) {
  throw new Error('Scenario not found');
}

const transcript = [
  {
    id: 'rep-1',
    speaker: 'rep',
    text: 'hi dr how are you? can we speak?',
    timestamp: new Date().toISOString(),
    cues: [],
  },
];

const result = await generateHcpResponse(
  scenario,
  transcript as any,
  scenario.startingBehaviorState || 'neutral',
  scenario.journeyStage,
  true,
  'hi dr how are you? can we speak?',
  [],
  0,
  'stable' as any,
  260,
);

console.log(JSON.stringify({
  title: scenario.title,
  reply: result.hcpReply,
  cue: result.activeCues?.[0]?.label || null,
  nextBehaviorState: result.nextBehaviorState,
}, null, 2));
