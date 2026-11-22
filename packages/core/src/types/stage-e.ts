/**
 * Stage E — Technical Analysis domain types.
 * Mirrors DOMAIN_MODEL_SPEC.md Section 4.5 and TECHNICAL_ANALYSIS_SPEC.md.
 */

import type { DataProvenance, ISODateString, RedFlag } from './base.js';
import type { ScoringRuleResult, StageScore } from './scoring.js';

export type PatternName =
  | 'bullish-engulfing'
  | 'hammer'
  | 'inverted-hammer'
  | 'morning-star'
  | 'dragonfly-doji'
  | 'three-white-soldiers'
  | 'bearish-engulfing'
  | 'evening-star'
  | 'shooting-star';

export interface OhlcvBar {
  date: ISODateString;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjusted: boolean;
}

export interface CandlestickPattern {
  name: PatternName;
  detectedAt: ISODateString;
  timeframe: 'daily' | 'weekly';
  candles: OhlcvBar[];
  confirmation: boolean;
  confirmationCandle?: OhlcvBar | undefined;
  context: PatternContext;
  qualityScore: number;
  explanation?: string | undefined;
}

export interface PatternContext {
  trend: 'uptrend' | 'downtrend' | 'sideways';
  trendDuration: number;
  supportLevel?: number | undefined;
  resistanceLevel?: number | undefined;
  distanceToSupportPct?: number | undefined;
  distanceToResistancePct?: number | undefined;
  volumeSpike: boolean;
  volumeTrend: 'increasing' | 'decreasing' | 'flat';
  nearMovingAverage?: '20' | '50' | '200' | undefined;
  maTrend: 'rising' | 'falling' | 'flat';
  atr: number;
  gapRisk: 'low' | 'medium' | 'high';
}

export interface TechnicalSetup {
  pattern: CandlestickPattern;
  entryZone: { low: number; high: number };
  invalidationLevel: number;
  stopLoss: number;
  targets: number[];
  riskReward: number;
  inBuyZone: boolean;
  contextScore: number;
  setupQuality: 'A+' | 'A' | 'B' | 'C';
}

export interface StageEInput {
  companyId: string;
  asOfDate: ISODateString;
  adjustedOhlcvDaily: OhlcvBar[];
  adjustedOhlcvWeekly?: OhlcvBar[] | undefined;
  valuationMaxBuyPrice?: number | undefined;
  selectedFairValue?: number | undefined;
  dataProvenance?: DataProvenance | undefined;
  dataSnapshotId?: string | undefined;
  minRiskReward?: number | undefined;
  buyZoneTolerancePct?: number | undefined;
}

export interface StageEOutput extends StageScore {
  stage: 'E';
  companyId?: string | undefined;
  asOfDate?: ISODateString | undefined;
  executedAt?: ISODateString | undefined;
  message?: string | undefined;
  setups: TechnicalSetup[];
  eligible: boolean;
  gatePassed: boolean;
  canProceedToStageF: boolean;
  bestSetup?: TechnicalSetup | undefined;
  priceData: {
    currentPrice: number;
    maxBuyPrice: number;
    inBuyZone: boolean;
    distanceToMaxBuyPct: number;
  };
  technicalContext: {
    dailyTrend: 'uptrend' | 'downtrend' | 'sideways';
    weeklyTrend: 'uptrend' | 'downtrend' | 'sideways';
    keyLevels: { support: number[]; resistance: number[] };
    volumeProfile: 'bullish' | 'bearish' | 'neutral';
    rsVsBenchmark: 'outperforming' | 'underperforming' | 'inline';
    sma20?: number | undefined;
    sma50?: number | undefined;
    sma200?: number | undefined;
    atr14: number;
    volumeRatio: number;
  };
  flags: RedFlag[];
  ruleResults: ScoringRuleResult[];
}
