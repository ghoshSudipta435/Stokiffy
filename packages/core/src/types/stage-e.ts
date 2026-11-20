/**
 * Stage E — Technical Analysis domain types.
 * Mirrors DOMAIN_MODEL_SPEC.md Section 4.5.
 */

import type { DataProvenance, ISODateString, RedFlag } from './base.js';

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
  confirmationCandle?: OhlcvBar;
  context: PatternContext;
  qualityScore: number;
}

export interface PatternContext {
  trend: 'uptrend' | 'downtrend' | 'sideways';
  trendDuration: number;
  supportLevel?: number;
  resistanceLevel?: number;
  distanceToSupportPct?: number;
  distanceToResistancePct?: number;
  volumeSpike: boolean;
  volumeTrend: 'increasing' | 'decreasing' | 'flat';
  nearMovingAverage?: '20' | '50' | '200';
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
}

export interface StageEInput {
  companyId: string;
  asOfDate: ISODateString;
  adjustedOhlcvDaily: OhlcvBar[];
  adjustedOhlcvWeekly: OhlcvBar[];
  valuationMaxBuyPrice: number;
  dataProvenance: DataProvenance;
}

export interface StageEOutput {
  stage: 'E';
  setups: TechnicalSetup[];
  eligible: boolean;
  bestSetup?: TechnicalSetup;
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
  };
  flags: RedFlag[];
  calculatedAt: ISODateString;
  ruleSetVersion: string;
}
