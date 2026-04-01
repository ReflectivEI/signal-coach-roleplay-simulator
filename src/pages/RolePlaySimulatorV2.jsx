import React, { useMemo, useState } from 'react';
import { buildTurnPlan, validateTurnPlan } from '@/lib/roleplay-v2/turnPlanContract';
import { createRolePlayV2BackendConfig, startV2Session, respondV2Turn } from '@/lib/roleplay-v2/backendAdapter';

export default function RolePlaySimulatorV2() {
  const backendConfig = useMemo(
    () => createRolePlayV2BackendConfig({
      env: import.meta.env,
      search: typeof window !== 'undefined' ? window.location.search : '',
    }),
    []
  );
  const [sessionId, setSessionId] = useState('');
  const [repMessage, setRepMessage] = useState('There is a new JAMA study I am eager to share with you. Do you have a few minutes?');
  const [backendPlan, setBackendPlan] = useState(null);
  const [backendError, setBackendError] = useState('');

  const samplePlan = useMemo(() => buildTurnPlan({
    turnNumber: 1,
    nextDialogue: 'I have a minute—what single workflow step should we prioritize first?',
    nextCue: 'The HCP glances at the clinic schedule, then refocuses for a concise operational recommendation.',
    nextState: 'time-pressured',
    constraintDecision: {
      mode: 'restate_once',
      reason: 'workflow_constraint_active',
      blocking: false,
    },
    metadata: {
      scenarioId: 'roleplay_v2_scaffold',
      concern: 'workflow',
      source: 'roleplay_v2_scaffold',
    },
  }), []);

  const validation = useMemo(() => validateTurnPlan(samplePlan), [samplePlan]);
  const backendValidation = useMemo(() => validateTurnPlan(backendPlan || samplePlan), [backendPlan, samplePlan]);

  const handleStartPreviewSession = async () => {
    setBackendError('');
    try {
      const session = await startV2Session({
        scenarioId: 'roleplay_v2_preview',
        scenarioSummary: 'RolePlay V2 preview scenario: context-aware workflow and access constraints.',
      });
      setSessionId(session.sessionId);
    } catch (error) {
      setBackendError(error.message || 'Failed to start preview session.');
    }
  };

  const handleSendPreviewTurn = async () => {
    if (!sessionId) return;
    setBackendError('');
    try {
      const plan = await respondV2Turn({
        sessionId,
        scenarioSummary: 'RolePlay V2 preview scenario: context-aware workflow and access constraints.',
        repMessage,
        turnNumber: 1,
      });
      setBackendPlan(plan);
    } catch (error) {
      setBackendError(error.message || 'Failed to generate backend plan.');
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">RolePlay Simulator V2 (Scaffold)</h1>
      <p className="text-sm text-slate-600">
        This standalone route scaffolds the immutable TurnPlan contract for V2 rebuild without touching current v1 simulator behavior.
      </p>
      <p className="text-xs text-slate-500">
        Access link: <code>/RolePlaySimulatorV2</code> (enable backend preview with <code>?rpv2_backend=1</code>).
      </p>
      <div className="rounded border p-4 bg-slate-50">
        <h2 className="font-medium mb-2">TurnPlan validation</h2>
        <p className={validation.valid ? 'text-green-700' : 'text-red-700'}>
          {validation.valid ? 'valid' : `invalid: ${validation.issues.join(', ')}`}
        </p>
      </div>
      <div className="rounded border p-4 bg-white space-y-3">
        <h2 className="font-medium">Backend adapter preview (feature-flagged)</h2>
        <p className="text-xs text-slate-600">
          Enabled: <strong>{backendConfig.enabled ? 'yes' : 'no'}</strong> — preview only: <strong>{backendConfig.previewOnly ? 'yes' : 'no'}</strong>
        </p>
        <p className="text-xs text-slate-500">
          Enable with <code>VITE_ROLEPLAY_V2_BACKEND_ENABLED=true</code> or query param <code>?rpv2_backend=1</code>.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleStartPreviewSession}
            disabled={!backendConfig.enabled}
            className="px-3 py-1.5 rounded bg-slate-900 text-white disabled:opacity-50"
          >
            Start preview session
          </button>
          <button
            type="button"
            onClick={handleSendPreviewTurn}
            disabled={!backendConfig.enabled || !sessionId}
            className="px-3 py-1.5 rounded bg-teal-700 text-white disabled:opacity-50"
          >
            Send one turn
          </button>
        </div>
        <input
          className="w-full border rounded px-2 py-1 text-sm"
          value={repMessage}
          onChange={(e) => setRepMessage(e.target.value)}
          disabled={!backendConfig.enabled}
        />
        {sessionId && <p className="text-xs text-slate-600">session: {sessionId}</p>}
        {backendError && <p className="text-xs text-red-600">{backendError}</p>}
        {backendPlan && (
          <p className={backendValidation.valid ? 'text-xs text-green-700' : 'text-xs text-red-700'}>
            backend plan {backendValidation.valid ? 'valid' : `invalid: ${backendValidation.issues.join(', ')}`}
          </p>
        )}
      </div>
      <pre className="rounded border p-4 bg-black text-green-300 text-xs overflow-auto">
        {JSON.stringify(backendPlan || samplePlan, null, 2)}
      </pre>
    </div>
  );
}
