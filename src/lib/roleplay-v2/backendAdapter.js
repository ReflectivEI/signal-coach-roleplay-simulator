import { buildTurnPlan, validateTurnPlan } from './turnPlanContract.js';

/**
 * @typedef {Object.<string, string | boolean | undefined>} RuntimeEnv
 */

/**
 * @param {{ env?: RuntimeEnv, search?: string }} [options]
 */
export function createRolePlayV2BackendConfig({ env = {}, search = '' } = {}) {
  const envEnabled = String(env.VITE_ROLEPLAY_V2_BACKEND_ENABLED || '').toLowerCase() === 'true';
  const forcePreview = String(env.VITE_ROLEPLAY_V2_PREVIEW_ONLY || '').toLowerCase() !== 'false';
  const params = new URLSearchParams(search || '');
  const queryEnabled = params.get('rpv2_backend') === '1';
  const enabled = envEnabled || queryEnabled;
  return {
    enabled,
    previewOnly: forcePreview,
  };
}

function makeHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: makeHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`V2 backend request failed (${response.status}): ${text}`);
  }
  return response.json();
}

function extractInvokeText(payload) {
  const source = payload?.response ?? payload?.text ?? payload?.content ?? '';
  if (typeof source === 'string') return source.trim();
  if (Array.isArray(source)) return source.map((item) => String(item || '')).join(' ').trim();
  if (source && typeof source === 'object') {
    if (typeof source.text === 'string') return source.text.trim();
    try { return JSON.stringify(source); } catch { return String(source); }
  }
  return String(source || '').trim();
}

function extractPlanFromInvokeText(text = '', fallback = {}) {
  const match = text.match(/\{[\s\S]*\}$/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      return buildTurnPlan({
        ...fallback,
        nextDialogue: parsed.nextDialogue || fallback.nextDialogue,
        nextCue: parsed.nextCue || fallback.nextCue,
        nextState: parsed.nextState || fallback.nextState,
        constraintDecision: parsed.constraintDecision || fallback.constraintDecision,
        metadata: {
          ...(fallback.metadata || {}),
          ...(parsed.metadata || {}),
          source: 'v2_backend_llm',
        },
      });
    } catch {
      // noop fallback below
    }
  }
  return buildTurnPlan(fallback);
}

export async function startV2Session({ scenarioId = 'v2', scenarioSummary = '' } = {}) {
  const sessionId = `rpv2_${Date.now()}`;
  await postJson('/api/roleplay/sessions', {
    id: sessionId,
    scenarioId,
    sessionData: { mode: 'v2_preview', scenarioSummary },
    turns: [],
  });
  return { sessionId };
}

/**
 * @param {{ sessionId?: string, scenarioSummary?: string, repMessage?: string, turnNumber?: number }} [params]
 */
export async function respondV2Turn({ sessionId, scenarioSummary = '', repMessage = '', turnNumber = 1 } = {}) {
  const fallback = {
    turnNumber,
    nextDialogue: 'I can give you one focused minute—what single practical issue should we solve first?',
    nextCue: 'The HCP keeps a practical posture and asks for a concise, scenario-relevant next step.',
    nextState: 'neutral',
    constraintDecision: { mode: 'none', reason: '', blocking: false },
    metadata: { scenarioId: scenarioSummary.slice(0, 80), concern: '', source: 'v2_backend_fallback' },
  };

  const prompt = [
    'Return ONLY JSON with keys: nextDialogue, nextCue, nextState, constraintDecision, metadata.',
    `Scenario: ${scenarioSummary}`,
    `Rep message: ${repMessage}`,
    'Rules: concise, context-aware, observable behavior only, no markdown.',
  ].join('\n');

  let plan = buildTurnPlan(fallback);
  try {
    const invoke = await postJson('/api/llm/invoke', { prompt });
    const text = extractInvokeText(invoke);
    plan = extractPlanFromInvokeText(text, fallback);
  } catch {
    // keep fallback plan
  }

  const validation = validateTurnPlan(plan);
  if (!validation.valid) {
    plan = buildTurnPlan(fallback);
  }

  await postJson('/api/roleplay/sessions', {
    id: sessionId,
    scenarioId: scenarioSummary.slice(0, 80) || 'v2',
    turns: [{ turnNumber, repMessage, plan }],
    sessionData: { mode: 'v2_preview' },
  });

  return plan;
}
