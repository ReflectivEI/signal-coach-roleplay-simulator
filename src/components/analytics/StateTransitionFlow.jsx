import React, { useMemo, useState } from "react";
import { GitBranch, Info } from "lucide-react";

// State definitions — canonical order matches HCP State Ladder
const HCP_STATES = [
  'neutral',
  'engaged',
  'time-pressured',
  'resistant',
  'boundary-setting',
  'irritated',
  'disengaging',
];

const STATE_META = {
  'neutral':          { label: 'Neutral',          color: '#94a3b8', bg: '#f1f5f9', text: '#475569' },
  'engaged':          { label: 'Engaged',           color: '#14b8a6', bg: '#f0fdfa', text: '#0f766e' },
  'time-pressured':   { label: 'Time-Pressured',    color: '#f59e0b', bg: '#fffbeb', text: '#b45309' },
  'resistant':        { label: 'Resistant',         color: '#f97316', bg: '#fff7ed', text: '#c2410c' },
  'boundary-setting': { label: 'Boundary-Setting',  color: '#ef4444', bg: '#fef2f2', text: '#b91c1c' },
  'irritated':        { label: 'Irritated',         color: '#dc2626', bg: '#fef2f2', text: '#991b1b' },
  'disengaging':      { label: 'Disengaging',       color: '#6b7280', bg: '#f9fafb', text: '#374151' },
};

// Alignment score color
function alignmentColor(score) {
  if (!score || score === 0) return '#d1d5db';
  if (score >= 4) return '#22c55e';
  if (score >= 3) return '#f59e0b';
  return '#ef4444';
}

function alignmentLabel(score) {
  if (!score || score === 0) return '—';
  if (score >= 4) return 'Strong';
  if (score >= 3) return 'Adequate';
  return 'Weak';
}

/**
 * Parse state transitions from a session's messages array + alignment data embedded in session.
 * We re-derive transitions by scanning message content for state signals.
 * 
 * The RolePlaySession stores messages as flat [{role, content}] pairs.
 * We extract transitions by looking for state metadata stored in session or
 * by extracting state pattern tokens from the message sequence.
 *
 * For sessions that have alignment scores stored in feedback text, we parse them.
 */
function extractTransitions(sessions) {
  const transitionMap = {}; // "from→to" → { count, alignmentScores[] }

  sessions.forEach(session => {
    if (!session.feedback) return;

    // Extract per-turn alignment data from feedback text
    // Pattern: "Turn N: HCP State=STATE | Alignment Score=N/5"
    const turnPattern = /Turn\s+(\d+):\s+HCP State=([a-z-]+)\s*\|\s*Alignment Score=(\d(?:\.\d)?)/gi;
    const turns = [];
    let match;
    while ((match = turnPattern.exec(session.feedback)) !== null) {
      turns.push({
        turn: parseInt(match[1]),
        state: match[2].toLowerCase().trim(),
        alignmentScore: parseFloat(match[3]),
      });
    }

    // Build transitions from sequential turn states
    for (let i = 0; i < turns.length - 1; i++) {
      const from = turns[i].state;
      const to = turns[i + 1].state;
      if (!HCP_STATES.includes(from) || !HCP_STATES.includes(to)) continue;
      const key = `${from}→${to}`;
      if (!transitionMap[key]) transitionMap[key] = { from, to, count: 0, alignmentScores: [] };
      transitionMap[key].count++;
      if (turns[i + 1].alignmentScore > 0) {
        transitionMap[key].alignmentScores.push(turns[i + 1].alignmentScore);
      }
    }
  });

  return Object.values(transitionMap).map(t => ({
    ...t,
    avgAlignment: t.alignmentScores.length > 0
      ? Math.round(t.alignmentScores.reduce((a, b) => a + b, 0) / t.alignmentScores.length * 10) / 10
      : null,
  })).sort((a, b) => b.count - a.count);
}

// ─── Flow Diagram (custom SVG Sankey-style) ─────────────────────────────────
function FlowDiagram({ transitions }) {
  const [hovered, setHovered] = useState(null);

  // Only show states that appear in transitions
  const activeStates = useMemo(() => {
    const set = new Set();
    transitions.forEach(t => { set.add(t.from); set.add(t.to); });
    return HCP_STATES.filter(s => set.has(s));
  }, [transitions]);

  if (activeStates.length === 0) return (
    <div className="text-center py-10 text-xs text-gray-400 italic">
      No transition data available yet. Complete role-play sessions to populate this view.
    </div>
  );

  const maxCount = Math.max(...transitions.map(t => t.count), 1);

  // Layout: two columns — "from" states left, "to" states right
  // States are arranged vertically by ladder order
  const COL_LEFT = 60;
  const COL_RIGHT = 340;
  const ROW_H = 48;
  const NODE_W = 120;
  const NODE_H = 30;
  const SVG_W = 500;
  const SVG_H = Math.max(activeStates.length * ROW_H + 40, 200);

  // Assign y position per state (ladder order)
  const stateY = {};
  activeStates.forEach((s, i) => {
    stateY[s] = 20 + i * ROW_H;
  });

  // Build edge list
  const edges = transitions.slice(0, 12).map(t => {
    const fromY = stateY[t.from];
    const toY = stateY[t.to];
    if (fromY === undefined || toY === undefined) return null;
    const strokeW = Math.max(1.5, (t.count / maxCount) * 8);
    const isSelf = t.from === t.to;
    return { ...t, fromY, toY, strokeW, isSelf };
  }).filter(Boolean);

  const fromOffset = {};
  const toOffset = {};
  activeStates.forEach(s => { fromOffset[s] = 0; toOffset[s] = 0; });

  return (
    <div className="overflow-x-auto">
      <svg width={SVG_W} height={SVG_H} className="block mx-auto">
        {/* Edges */}
        {edges.map((e, i) => {
          const x1 = COL_LEFT + NODE_W;
          const x2 = COL_RIGHT;
          const y1 = e.fromY + NODE_H / 2 + (fromOffset[e.from] || 0);
          const y2 = e.toY + NODE_H / 2 + (toOffset[e.to] || 0);
          fromOffset[e.from] = (fromOffset[e.from] || 0) + e.strokeW + 1;
          toOffset[e.to] = (toOffset[e.to] || 0) + e.strokeW + 1;

          const cx = (x1 + x2) / 2;
          const isEscalation = HCP_STATES.indexOf(e.to) > HCP_STATES.indexOf(e.from);
          const strokeColor = e.avgAlignment !== null ? alignmentColor(e.avgAlignment) : (isEscalation ? '#f97316' : '#14b8a6');
          const isHovered = hovered === i;
          const path = e.isSelf
            ? `M ${x1},${y1} C ${x1 + 40},${y1 - 30} ${x2 - 40},${y2 - 30} ${x2},${y2}`
            : `M ${x1},${y1} C ${cx},${y1} ${cx},${y2} ${x2},${y2}`;

          return (
            <g key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            >
              <path
                d={path}
                fill="none"
                stroke={strokeColor}
                strokeWidth={e.strokeW}
                strokeOpacity={isHovered ? 1 : 0.55}
                strokeLinecap="round"
              />
              {/* Midpoint badge */}
              <circle
                cx={cx}
                cy={(y1 + y2) / 2}
                r={isHovered ? 10 : 7}
                fill={strokeColor}
                opacity={isHovered ? 1 : 0.7}
              />
              <text
                x={cx}
                y={(y1 + y2) / 2 + 4}
                textAnchor="middle"
                fontSize={9}
                fill="white"
                fontWeight="bold"
              >
                {e.count}
              </text>
              {/* Hover tooltip */}
              {isHovered && (
                <g>
                  <rect x={cx - 65} y={(y1 + y2) / 2 - 44} width={130} height={38} rx={6} fill="white" stroke={strokeColor} strokeWidth={1} filter="url(#shadow)" />
                  <text x={cx} y={(y1 + y2) / 2 - 28} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#1f2937">
                    {STATE_META[e.from]?.label} → {STATE_META[e.to]?.label}
                  </text>
                  <text x={cx} y={(y1 + y2) / 2 - 16} textAnchor="middle" fontSize={8.5} fill="#6b7280">
                    {e.count}x · Align: {e.avgAlignment !== null ? `${e.avgAlignment}/5 (${alignmentLabel(e.avgAlignment)})` : '—'}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Left nodes (from) */}
        {activeStates.map(s => {
          const meta = STATE_META[s] || { label: s, color: '#94a3b8', bg: '#f9fafb', text: '#374151' };
          const y = stateY[s];
          return (
            <g key={`left-${s}`}>
              <rect x={COL_LEFT} y={y} width={NODE_W} height={NODE_H} rx={6}
                fill={meta.bg} stroke={meta.color} strokeWidth={1.5} />
              <text x={COL_LEFT + NODE_W / 2} y={y + NODE_H / 2 + 4}
                textAnchor="middle" fontSize={9.5} fontWeight="600" fill={meta.text}>
                {meta.label}
              </text>
            </g>
          );
        })}

        {/* Right nodes (to) */}
        {activeStates.map(s => {
          const meta = STATE_META[s] || { label: s, color: '#94a3b8', bg: '#f9fafb', text: '#374151' };
          const y = stateY[s];
          return (
            <g key={`right-${s}`}>
              <rect x={COL_RIGHT} y={y} width={NODE_W} height={NODE_H} rx={6}
                fill={meta.bg} stroke={meta.color} strokeWidth={1.5} />
              <text x={COL_RIGHT + NODE_W / 2} y={y + NODE_H / 2 + 4}
                textAnchor="middle" fontSize={9.5} fontWeight="600" fill={meta.text}>
                {meta.label}
              </text>
            </g>
          );
        })}

        {/* Column labels */}
        <text x={COL_LEFT + NODE_W / 2} y={14} textAnchor="middle" fontSize={9} fill="#9ca3af" fontWeight="600">FROM STATE</text>
        <text x={COL_RIGHT + NODE_W / 2} y={14} textAnchor="middle" fontSize={9} fill="#9ca3af" fontWeight="600">TO STATE</text>

        <defs>
          <filter id="shadow">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#00000020" />
          </filter>
        </defs>
      </svg>
    </div>
  );
}

// ─── Transition Table ────────────────────────────────────────────────────────
function TransitionTable({ transitions }) {
  if (transitions.length === 0) return null;
  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 px-2 text-gray-500 font-semibold">From State</th>
            <th className="text-left py-2 px-2 text-gray-500 font-semibold">To State</th>
            <th className="text-center py-2 px-2 text-gray-500 font-semibold">Count</th>
            <th className="text-center py-2 px-2 text-gray-500 font-semibold">Direction</th>
            <th className="text-center py-2 px-2 text-gray-500 font-semibold">Avg Alignment</th>
            <th className="text-left py-2 px-2 text-gray-500 font-semibold">Alignment Signal</th>
          </tr>
        </thead>
        <tbody>
          {transitions.slice(0, 10).map((t, i) => {
            const fromIdx = HCP_STATES.indexOf(t.from);
            const toIdx = HCP_STATES.indexOf(t.to);
            const isEscalation = toIdx > fromIdx;
            const isSame = toIdx === fromIdx;
            return (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-1.5 px-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: STATE_META[t.from]?.bg, color: STATE_META[t.from]?.text }}>
                    {STATE_META[t.from]?.label || t.from}
                  </span>
                </td>
                <td className="py-1.5 px-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: STATE_META[t.to]?.bg, color: STATE_META[t.to]?.text }}>
                    {STATE_META[t.to]?.label || t.to}
                  </span>
                </td>
                <td className="py-1.5 px-2 text-center font-bold text-gray-700">{t.count}</td>
                <td className="py-1.5 px-2 text-center">
                  {isSame ? <span className="text-gray-400">— Held</span>
                    : isEscalation
                      ? <span className="text-orange-500 font-medium">↑ Escalation</span>
                      : <span className="text-teal-600 font-medium">↓ De-escalation</span>}
                </td>
                <td className="py-1.5 px-2 text-center">
                  {t.avgAlignment !== null
                    ? <span className="font-semibold" style={{ color: alignmentColor(t.avgAlignment) }}>{t.avgAlignment}/5</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="py-1.5 px-2">
                  {t.avgAlignment !== null
                    ? <span style={{ color: alignmentColor(t.avgAlignment) }}>{alignmentLabel(t.avgAlignment)} adaptation</span>
                    : <span className="text-gray-400 italic">No data</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export default function StateTransitionFlow({ sessions }) {
  const transitions = useMemo(() => extractTransitions(sessions), [sessions]);

  const escalations = transitions.filter(t => HCP_STATES.indexOf(t.to) > HCP_STATES.indexOf(t.from));
  const deEscalations = transitions.filter(t => HCP_STATES.indexOf(t.to) < HCP_STATES.indexOf(t.from));
  const holds = transitions.filter(t => t.from === t.to);

  const totalTransitions = transitions.reduce((s, t) => s + t.count, 0);
  const escalationRate = totalTransitions > 0
    ? Math.round(escalations.reduce((s, t) => s + t.count, 0) / totalTransitions * 100)
    : 0;
  const deEscalationRate = totalTransitions > 0
    ? Math.round(deEscalations.reduce((s, t) => s + t.count, 0) / totalTransitions * 100)
    : 0;

  // Worst escalation path
  const worstEscalation = escalations.sort((a, b) => b.count - a.count)[0];

  return (
    <div className="bg-white border border-teal-100 rounded-xl p-5 space-y-4 hover:shadow-lg hover:shadow-teal-100/30 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GitBranch className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-800">State Transition Patterns</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Flow of HCP state changes across sessions. Edge width = frequency. Edge color = avg Signal–Response Alignment score during that transition.
          </p>
        </div>
        <div className="flex-shrink-0">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded inline-block bg-teal-400" />De-escalation</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded inline-block bg-orange-400" />Escalation</span>
          </div>
          <div className="flex items-center gap-3 text-xs mt-1.5">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block bg-green-400" />Strong align (≥4)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block bg-yellow-400" />Adequate (3)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block bg-red-400" />Weak (&lt;3)</span>
          </div>
        </div>
      </div>

      {/* Mini stats */}
      {totalTransitions > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-3 text-center hover:shadow-md hover:shadow-blue-100/30 transition-all">
            <div className="text-lg font-bold text-blue-700">{escalationRate}%</div>
            <div className="text-xs text-blue-600">Escalation Rate</div>
          </div>
          <div className="bg-teal-50/50 border border-teal-200 rounded-lg p-3 text-center hover:shadow-md hover:shadow-teal-100/30 transition-all">
            <div className="text-lg font-bold text-teal-700">{deEscalationRate}%</div>
            <div className="text-xs text-teal-600">De-escalation Rate</div>
          </div>
          <div className="bg-slate-50/50 border border-slate-200 rounded-lg p-3 text-center hover:shadow-md hover:shadow-slate-100/30 transition-all">
            <div className="text-lg font-bold text-slate-700">{totalTransitions}</div>
            <div className="text-xs text-slate-600">Total Transitions</div>
          </div>
        </div>
      )}

      {/* Worst escalation path callout */}
      {worstEscalation && (
        <div className="flex items-start gap-2 bg-blue-50/50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-800">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Most common escalation: <strong>{STATE_META[worstEscalation.from]?.label}</strong> → <strong>{STATE_META[worstEscalation.to]?.label}</strong> ({worstEscalation.count}× observed
            {worstEscalation.avgAlignment !== null ? `, avg alignment ${worstEscalation.avgAlignment}/5` : ''}).{' '}
            {worstEscalation.avgAlignment !== null && worstEscalation.avgAlignment < 3
              ? 'Reps consistently failed to adapt during this transition. Review constraint acknowledgment and pacing behaviors.'
              : 'Review scenario context to identify rep behaviors preceding this escalation.'}
          </span>
        </div>
      )}

      {/* Flow diagram */}
      <FlowDiagram transitions={transitions} />

      {/* Table */}
      <TransitionTable transitions={transitions} />

      {/* Guardrail */}
      <p className="text-xs text-slate-400 italic border-t border-slate-100 pt-3">
        Alignment overlay evaluates observable behavioral adaptation only. Does not assess empathy, intent, emotional intelligence, or personality traits.
      </p>
    </div>
  );
}