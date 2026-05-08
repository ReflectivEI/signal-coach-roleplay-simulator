export type BehavioralMetricKey =
  | "signalAwareness"
  | "signalInterpretation"
  | "adaptability"
  | "objectionHandling"
  | "valueCommunication"
  | "commitmentGeneration"
  | "emotionalAttunement"
  | "conversationControl";

export type RepMetricProfile = {
  score: number;
  trend: "up" | "down" | "flat";
  sessionsObserved: number;
};

export type RepData = {
  id: string;
  name: string;
  specialty: string;
  territory: string;
  status: "active" | "needs_attention" | "inactive";
  sessionsCompleted30d: number;
  coachingModulesCompleted: number;
  practiceStreakDays: number;
  salesPerformance: number;
  salesTrend: "up" | "down" | "flat";
  behavioralMetrics: Record<BehavioralMetricKey, RepMetricProfile>;
  strongestCapability: BehavioralMetricKey;
  improvementPriority: BehavioralMetricKey;
  overallScore: number;
  recentCoachingActivity: {
    coachingSessions30d: number;
    managerReviews30d: number;
    lastCoachingDate: string;
  };
  scenarioMix: Record<string, number>;
  trainingTypeMix: Record<string, number>;
  lastPracticeDate: string;
  engagementConsistency: number;
  observationDepth: number;
  territoryContext: {
    marketTrend: "up" | "down" | "flat";
    accessComplexity: number;
    payerPressure: number;
    accountComplexity: number;
  };
};

export type RepDerivedMetrics = {
  strongestCapability: BehavioralMetricKey;
  improvementPriority: BehavioralMetricKey;
  behavioralVariance: number;
  engagementScore: number;
  readinessScore: number;
  coachingResponsivenessScore?: number;
  engagementStabilityScore: number;
  conversionProxyScore: number;
  territoryPressureScore: number;
  salesRiskScore: number;
  dataConfidenceIndex: number;
  confidenceScore: number;
  predictiveConfidence?: number;
  calibration?: {
    hasHistory: boolean;
    interventionEffectivenessScore: number;
    targetCapabilitySuccessRate: number;
    predictiveConfidence: number;
    coachingEffectivenessLabel: string;
    mostResponsiveCapability?: {
      capabilityId: string;
      capabilityLabel: string;
    } | null;
    lowResponseCapability?: {
      capabilityId: string;
      capabilityLabel: string;
    } | null;
    reliability?: {
      deterministicConfidence: number;
      originalCalibratedConfidence: number;
      repSampleSize: number;
      capabilitySampleSize: number;
      consistencyScore: number;
      consistencyLabel: string | null;
      lowConfidenceSample: boolean;
      sampleLabel: string | null;
      confidenceExplanation: string;
      weightingExplanation: string;
      crossRepSignal: string | null;
      targetCapabilityLabel: string | null;
    };
  };
};

export type TerritoryData = {
  territory: string;
  avgPerformance: number;
  avgEngagement: number;
  trend: "up" | "down" | "flat";
  riskLevel: "low" | "moderate" | "high";
  avgBehavioralMetrics: Record<BehavioralMetricKey, number>;
  mostCommonCapabilityGap: BehavioralMetricKey | null;
  topPerformingBehaviorPattern: BehavioralMetricKey[];
  territoryVolatility: number;
  atRiskRepCount: number;
  lowPerformerConcentration: number;
  highPerformerConcentration: number;
  coachingOpportunityClusters: string[];
  repIds: string[];
  aggregationWeights: Record<string, number>;
};

export type ManagerInsightsRequest = {
  repId?: string;
  territoryId?: string;
  repData?: RepData & { evidence?: Record<string, unknown> };
  territoryData: TerritoryData;
  derivedMetrics?: RepDerivedMetrics;
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
