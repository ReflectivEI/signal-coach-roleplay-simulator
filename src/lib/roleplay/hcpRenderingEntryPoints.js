export const HCP_RENDERING_ENTRY_POINTS = Object.freeze([
  Object.freeze({
    id: 'RolePlayChat.finalConversationalRealism',
    file: 'src/components/roleplay/RolePlayChat.jsx',
    liveRuntime: true,
    classification: 'contract-bound/state-driven/scenario-bound',
    requires: Object.freeze(['scenarioExecutionContract', 'activeAskState', 'validHcpRealismState']),
  }),
  Object.freeze({
    id: 'hcpSimulationEngine.buildHCPDialoguePrompt',
    file: 'src/components/roleplay/hcpSimulationEngine.jsx',
    liveRuntime: false,
    classification: 'upstream prompt construction / not final live rendering',
    requires: Object.freeze(['final RolePlayChat renderer before storage']),
  }),
  Object.freeze({
    id: 'hcpReactionIntegrity.buildHcpReactionContract',
    file: 'src/components/roleplay/hcpReactionIntegrity.js',
    liveRuntime: false,
    classification: 'reaction contract selection envelope / not final live rendering',
    requires: Object.freeze(['final RolePlayChat renderer before storage']),
  }),
  Object.freeze({
    id: 'dialogueGrammar.normalizeHcpSpokenRealism',
    file: 'src/lib/roleplay/dialogueGrammar.js',
    liveRuntime: false,
    classification: 'post-processing grammar utility only',
    requires: Object.freeze(['no response routing', 'no response selection']),
  }),
  Object.freeze({
    id: 'structuredScenarioLeakGuard.repairStructuredScenarioContentLeak',
    file: 'src/lib/roleplay/structuredScenarioLeakGuard.js',
    liveRuntime: false,
    classification: 'post-processing purity utility only',
    requires: Object.freeze(['no response routing', 'no response selection']),
  }),
]);

export function validateHcpRenderingEntryPointAudit(entryPoints = HCP_RENDERING_ENTRY_POINTS) {
  const issues = [];
  for (const entry of entryPoints) {
    if (!entry.id) issues.push('missing_entry_id');
    if (!entry.file) issues.push(`${entry.id}:missing_file`);
    if (!entry.classification) issues.push(`${entry.id}:missing_classification`);
    if (entry.liveRuntime && entry.classification !== 'contract-bound/state-driven/scenario-bound') {
      issues.push(`${entry.id}:live_runtime_not_contract_bound`);
    }
    if (entry.liveRuntime) {
      const required = new Set(entry.requires || []);
      for (const requirement of ['scenarioExecutionContract', 'activeAskState', 'validHcpRealismState']) {
        if (!required.has(requirement)) issues.push(`${entry.id}:missing_${requirement}`);
      }
    }
  }
  return {
    valid: issues.length === 0,
    issues,
    liveRuntimeEntryCount: entryPoints.filter((entry) => entry.liveRuntime).length,
  };
}
