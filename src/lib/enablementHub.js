export const ENABLEMENT_HUB_SPOKES = [
  {
    id: 'performance',
    title: 'Performance Analytics',
    page: 'PerformanceAnalytics',
    label: 'Insight hub',
    summary: 'Individual intelligence hub for behavior trends, content effectiveness, and AI recommendations.',
  },
  {
    id: 'manager',
    title: 'Manager View',
    page: 'ManagerView',
    label: 'Team intervention hub',
    summary: 'Manager-facing layer for intervention queues, adoption risk, and territory alignment.',
  },
  {
    id: 'learning',
    title: 'Learning Paths',
    page: 'LearningPaths',
    label: 'Remediation hub',
    summary: 'Capability-specific remediation plans, learning sequences, and next-best actions.',
  },
  {
    id: 'reports',
    title: 'Data and Reports',
    page: 'DataReports',
    label: 'Leadership / export hub',
    summary: 'Executive summaries, exports, and high-level reporting narratives for leadership.',
  },
];

export const ENTERPRISE_SAMPLE_CONFIG = {
  sessions: 248,
  reps: 36,
  managers: 6,
  scenarios: 18,
  modules: 24,
  timeWindow: 'rolling 90 days',
};

export function getConfidenceLabel(sampleSize) {
  if (sampleSize >= 200) return 'Enterprise confidence';
  if (sampleSize >= 100) return 'High confidence';
  if (sampleSize >= 40) return 'Moderate confidence';
  return 'Directional';
}

export function getCoverageBand(value) {
  if (value >= 85) return { label: 'Strong', tone: 'text-teal-700 bg-teal-50 border-teal-200' };
  if (value >= 70) return { label: 'Watch', tone: 'text-amber-700 bg-amber-50 border-amber-200' };
  return { label: 'Gap', tone: 'text-rose-700 bg-rose-50 border-rose-200' };
}

export function getAdoptionBand(value) {
  if (value >= 80) return 'Healthy';
  if (value >= 60) return 'Mixed';
  return 'At Risk';
}
