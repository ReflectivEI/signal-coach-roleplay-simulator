/**
 * Deprecated: scoring is canonicalized in roleplay/alignmentEngine.
 * This module remains as a compatibility shim.
 */

import { METRICS_VERSION } from './signal-intelligence-metrics-spec';

export { METRICS_VERSION };

export function round1(n) {
  const factor = Math.pow(10, 1);
  return Math.round((n + Number.EPSILON) * factor) / factor;
}

export function scoreAllMetrics() {
  throw new Error('scoreAllMetrics is deprecated. Use computeAlignment from ./roleplay/alignmentEngine.');
}
