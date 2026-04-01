const MEMORY_SESSIONS = [];
const KV_PREFIX = 'roleplay_session:';

function nowIso() {
  return new Date().toISOString();
}

function normalizeSessionPayload(body = {}) {
  const timestamp = nowIso();
  return {
    id: body.id || Date.now().toString(),
    scenarioId: body.scenarioId,
    sessionData: body.sessionData || {},
    turns: body.turns || [],
    feedback: body.feedback || '',
    scores: body.scores || {},
    transcript: body.transcript || '',
    createdAt: body.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

function getKvBinding(env = {}) {
  const binding = env?.ROLEPLAY_SESSIONS_KV;
  return (binding && typeof binding.get === 'function' && typeof binding.put === 'function') ? binding : null;
}

export async function persistRoleplaySession(body = {}, env = {}) {
  const session = normalizeSessionPayload(body);
  const kv = getKvBinding(env);

  if (!kv) {
    const existingIndex = MEMORY_SESSIONS.findIndex((entry) => entry.id === session.id);
    if (existingIndex >= 0) {
      MEMORY_SESSIONS[existingIndex] = { ...MEMORY_SESSIONS[existingIndex], ...session };
    } else {
      MEMORY_SESSIONS.push(session);
    }
    return { session, durable: false, provider: 'memory_fallback' };
  }

  await kv.put(`${KV_PREFIX}${session.id}`, JSON.stringify(session));
  return { session, durable: true, provider: 'cloudflare_kv' };
}

export async function listRoleplaySessions(env = {}) {
  const kv = getKvBinding(env);
  if (!kv) return { sessions: [...MEMORY_SESSIONS], durable: false, provider: 'memory_fallback' };

  const listed = await kv.list({ prefix: KV_PREFIX, limit: 1000 });
  const sessions = await Promise.all(
    (listed?.keys || []).map(async (keyMeta) => {
      const raw = await kv.get(keyMeta.name, 'text');
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })
  );

  return {
    sessions: sessions.filter(Boolean).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))),
    durable: true,
    provider: 'cloudflare_kv',
  };
}
