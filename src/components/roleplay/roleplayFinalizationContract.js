import { normalizeMessage } from '../../lib/messageNormalization';
import { normalizeTone } from '../../lib/conversationToneNormalization';

function hardNormalize(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

export function finalizeRoleplayMessage(text = '', { mode = 'storage' } = {}) {
  const normalized = normalizeTone(normalizeMessage(hardNormalize(text)));

  if (mode === 'display') {
    return normalized;
  }

  return normalized;
}
