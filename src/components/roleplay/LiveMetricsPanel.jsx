/**
 * LiveMetricsPanel — right-panel behavioral metric scores per turn.
 * Matches the screenshot layout: full panel, 2-col grid, turn counter, overall score.
 */
import React from "react";
import { METRIC_DEFINITIONS } from "./alignmentEngine";
import { CheckCircle, AlertTriangle } from "lucide-react";

function ScoreBar({ score }) {
  const pct = Math.max(5, ((score - 1) / 4) * 100);
  const barColor = score >= 4 ? '#22c55e' : score <= 2 ? '#ef4444' : '#39ACAC';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <span className={`text-xs font-bold w-4 text-right ${score >= 4 ? 'text-green-600' : score <= 2 ? 'text-red-500' : 'text-gray-700'}`}>
        {score}
      </span>
    </div>
  );
}

export default function LiveMetricsPanel({ turns, scenario }) {
  const scoredTurns = turns.filter(t => t.alignment?.metrics);

  if (scoredTurns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: "#e6f7f7" }}>
          <CheckCircle className="w-6 h-6" style={{ color: "#39ACAC" }} />
        </div>
        <p className="text-xs font-semibold text-gray-600">Waiting for first exchange</p>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed">Scores will appear here after you send your first message</p>
      </div>
    );
  }

  const latestTurn = scoredTurns[scoredTurns.length - 1];
  const metrics = latestTurn.alignment.metrics;
  const overallScore = latestTurn.alignment.score;
  const turnNum = scoredTurns.length;

  
return (
    <div className="p-4 space-y-4">
      {/* Turn + Overall header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-gray-800">Live Behavioral Metrics</span>
          {latestTurn.alignment.metricsVersion && (
            <span className="text-[10px] text-gray-500">{latestTurn.alignment.metricsVersion}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Turn {turnNum}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            overallScore >= 4 ? 'bg-green-100 text-green-700' :
            overallScore <= 2 ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            Overall: {overallScore}/5
          </span>
        </div>
      </div>

      {/* 1×8 stacked metrics list */}
      <div className="flex flex-col gap-3">
        {METRIC_DEFINITIONS.map(def => {
          const metricData = metrics[def.id];
          const score = metricData?.score ?? 3;
          const hasMisalignment = metricData?.misalignments?.length > 0;
          const hasPositive = !hasMisalignment && metricData?.positives?.length > 0;
          return (
            <div key={def.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700 leading-tight">{def.label}</span>
              </div>
              <ScoreBar score={score} />
              {hasMisalignment && (
                <p className="text-xs leading-tight flex items-start gap-0.5 truncate" title={metricData.misalignments[0]}>
                  <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-red-500 truncate">{metricData.misalignments[0]}</span>
                </p>
              )}
              {hasPositive && (
                <p className="text-xs text-green-600 leading-tight flex items-start gap-0.5 truncate" title={metricData.positives[0]}>
                  <CheckCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span className="truncate">{metricData.positives[0]}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Scenario Objectives & Key Challenges */}
      {scenario && scenario.hcp && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          {scenario.hcp.objective && (
            <div className="mb-2">
              <span className="text-xs font-bold text-gray-800">Scenario Objectives</span>
              <p className="text-xs text-gray-700 mt-1">{scenario.hcp.objective}</p>
            </div>
          )}
          {scenario.hcp.keyChallenges && scenario.hcp.keyChallenges.length > 0 && (
            <div>
              <span className="text-xs font-bold text-gray-800">Key Challenges</span>
              <ul className="text-xs text-gray-700 mt-1 list-disc pl-4">
                {scenario.hcp.keyChallenges.map((challenge, idx) => (
                  <li key={idx}>{challenge}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}