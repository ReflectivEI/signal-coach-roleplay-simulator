import test from 'node:test';
import assert from 'node:assert/strict';

import { listRoleplaySessions, persistRoleplaySession } from '../src/lib/roleplaySessionStore.js';

test('roleplay session store falls back to memory when KV binding is absent', async () => {
  const result = await persistRoleplaySession({ id: 'session-memory-1', scenarioId: 'abc', turns: [{ turnNumber: 1 }] }, {});
  assert.equal(result.durable, false);
  const listed = await listRoleplaySessions({});
  assert.equal(listed.durable, false);
  assert.ok(listed.sessions.some((session) => session.id === 'session-memory-1'));
});
