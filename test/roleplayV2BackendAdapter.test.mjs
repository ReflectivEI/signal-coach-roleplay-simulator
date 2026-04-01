import test from 'node:test';
import assert from 'node:assert/strict';

import { createRolePlayV2BackendConfig } from '../src/lib/roleplay-v2/backendAdapter.js';

test('backend config disabled by default', () => {
  const cfg = createRolePlayV2BackendConfig({ env: {}, search: '' });
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.previewOnly, true);
});

test('backend config can be enabled by env or query', () => {
  const envCfg = createRolePlayV2BackendConfig({ env: { VITE_ROLEPLAY_V2_BACKEND_ENABLED: 'true' }, search: '' });
  assert.equal(envCfg.enabled, true);

  const queryCfg = createRolePlayV2BackendConfig({ env: {}, search: '?rpv2_backend=1' });
  assert.equal(queryCfg.enabled, true);
});
