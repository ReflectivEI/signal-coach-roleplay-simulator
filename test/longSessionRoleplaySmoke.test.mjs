import test from 'node:test';
import assert from 'node:assert/strict';

import { ALL_SCENARIOS } from '../src/lib/roleplay-v2/scenarioCatalog.js';
import { buildHcpReactionContract } from '../src/components/roleplay/hcpReactionIntegrity.js';

const WEAK_REP_TURNS = [
  "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.",
  'Plenty.',
  'What do you want to talk about?',
  'Sure.',
  "Hi, I'd love to follow up on our last conversation regarding your high risk patients and the outcomes data I shared with you last week.",
  'Can you explain what you mean?',
  'Ok.',
  'What are you asking me to do?',
];

function inferConcern(scenario = {}) {
  const text = `${scenario.context || ''} ${(scenario.challenges || []).join(' ')}`.toLowerCase();
  if (/screen|candidate|selection/.test(text)) return 'screening';
  if (/evidence|data|trial|durability|p&t|formulary/.test(text)) return 'evidence';
  if (/access|prior|auth|coverage|payer/.test(text)) return 'access';
  return 'workflow';
}

function sentenceCount(text = '') {
  return (String(text || '').match(/[^.!?]+[.!?]/g) || []).length || 1;
}

function normalizedLead(text = '') {
  return String(text || '').trim().split(/[.!?]/)[0].toLowerCase();
}

test('long-session smoke: repeated weak rep turns do not produce stacked or rubric-like HCP dialogue', () => {
  const scenarios = ALL_SCENARIOS.slice(0, 10);

  for (const scenario of scenarios) {
    let priorEnforcementTrace = null;
    const leads = [];

    for (let index = 0; index < WEAK_REP_TURNS.length; index += 1) {
      const activeConcern = inferConcern(scenario);
      const contract = buildHcpReactionContract({
        scenario,
        turnNumber: index + 1,
        hcpState: index > 4 ? 'impatient' : 'time_pressed',
        cueText: '',
        dialogueText: '',
        activeConcern,
        repMessage: WEAK_REP_TURNS[index],
        alignment: { score: index === 0 ? 1.5 : 1, misalignments: ['miss'], rubricAlignmentFlags: ['cue_miss'] },
        concernFlowOutcome: 'missed',
        priorEnforcementTrace,
        hardDemandState: { hardDemandPriorityLock: true, hardDemandUnresolved: true, activeHardDemand: 'operational_fit' },
      });

      const dialogue = contract.selectedDialogueText;
      assert.ok(dialogue.length > 0, `${scenario.id} turn ${index + 1} produced empty dialogue`);
      const maxSentences = index === 0 ? 3 : 2;
      assert.ok(sentenceCount(dialogue) <= maxSentences, `${scenario.id} turn ${index + 1} stacked too many sentences: ${dialogue}`);
      assert.ok((dialogue.match(/\?/g) || []).length <= 1, `${scenario.id} turn ${index + 1} asked too many questions: ${dialogue}`);
      assert.doesNotMatch(dialogue, /Give one exact|non-specific|workflow decisions|evidence judgment|current scenario|Take care|this isn't productive|what my team can operationalize|practical implementation detail/i, `${scenario.id} turn ${index + 1} leaked rubric-like phrasing: ${dialogue}`);
      assert.doesNotMatch(dialogue, /I can keep going[\s\S]*\?/, `${scenario.id} turn ${index + 1} stacked conditional pressure with a second question: ${dialogue}`);
      assert.doesNotMatch(dialogue, /Let's keep this[^.]*\.\s+\S/i, `${scenario.id} turn ${index + 1} stacked keep-this pressure with a tail: ${dialogue}`);

      leads.push(normalizedLead(dialogue));
      const recentLeads = leads.slice(-4);
      assert.ok(new Set(recentLeads).size >= Math.min(2, recentLeads.length), `${scenario.id} repeated the same HCP lead too tightly: ${recentLeads.join(' | ')}`);
      priorEnforcementTrace = contract.enforcementTrace;
    }
  }
});
