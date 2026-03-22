export type ManagerInsightsRequest = {
  repId?: string;
  territoryId?: string;
  metrics: {
    sessionsCompleted: number;
    trainingModulesCompleted: number;
    avgEQScore: number;
    recentPerformanceTrend: "up" | "down" | "flat";
    salesPerformance: number;
    territoryPerformance?: number;
  };
  behavioralSignals: {
    signalAwareness?: number;
    signalInterpretation?: number;
    valueConnection?: number;
    objectionHandling?: number;
  };
  timeframe: "30d" | "60d" | "90d";
};

export type ManagerInsightsResponse = {
  summary: string;
  keyDrivers: string[];
  risks: string[];
  recommendations: {
    action: string;
    rationale: string;
    expectedImpact: string;
  }[];
  predictiveOutlook: {
    performanceTrend: "likely_improve" | "at_risk" | "stable";
    confidence: number;
    reasoning: string;
  };
};
