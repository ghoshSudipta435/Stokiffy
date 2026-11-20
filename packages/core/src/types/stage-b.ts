/**
 * Stage B — Deep Trend Analysis domain types.
 * Mirrors DOMAIN_MODEL_SPEC.md Section 4.2.
 */

import type { DataProvenance, ISODateString } from './base.js';
import type { ScoringRuleResult, StageScore } from './scoring.js';

export interface QuarterlyPoint {
  period: string;
  salesYoY: number;
  opmYoY: number;
  dataQuality: DataProvenance;
}

export interface AnnualPoint {
  period: string;
  sales: number;
  opm: number;
  netProfit: number;
  netMargin: number;
  reserves: number;
  borrowings: number;
  cfo: number;
  pat: number;
  debtorDays: number;
  roce: number;
  dataQuality: DataProvenance;
}

export interface ShareholdingPoint {
  period: string;
  promoterPct: number;
  fiiPct: number;
  diiPct: number;
  publicPct: number;
  promoterPledgePct?: number;
  dataQuality: DataProvenance;
}

export type TrendClassification =
  | 'consistently_rising'
  | 'rising_with_fluctuations'
  | 'mostly_constant_occasional_rise'
  | 'constant'
  | 'mostly_constant_few_declines'
  | 'consistently_falling'
  | 'up_with_flat_periods'
  | 'up_with_dip'
  | 'flat'
  | 'declining'
  | 'maintained_high'
  | 'rising_fluctuating';

export interface StageBInput {
  companyId: string;
  asOfDate: ISODateString;
  quarterly: QuarterlyPoint[];
  annual: AnnualPoint[];
  shareholding: ShareholdingPoint[];
  dataProvenance: DataProvenance;
}

export interface StageBRuleResult extends ScoringRuleResult {
  trendClassification?: TrendClassification;
  supportingData?: {
    periodCount: number;
    positivePeriods: number;
    negativePeriods: number;
    flatPeriods: number;
  };
}

export interface StageBOutput extends StageScore {
  stage: 'B';
  ruleResults: StageBRuleResult[];
  quarterlyAnalysis: {
    salesTrend: TrendClassification;
    opmTrend: TrendClassification;
  };
  annualAnalysis: {
    sales5yTrend: TrendClassification;
    opm5yTrend: TrendClassification;
    netProfitTrend: TrendClassification;
    reservesBorrowingsTrend: TrendClassification;
    cfoTrend: TrendClassification;
    debtorDaysTrend: TrendClassification;
    roceTrend: TrendClassification;
  };
  shareholdingAnalysis: {
    latestPattern: {
      promoter: 'up' | 'down' | 'flat';
      fiiDii: 'up' | 'down' | 'flat';
      public: 'up' | 'down' | 'flat';
    };
    score: number;
    hardFlags: string[];
  };
  forensicFlags: string[];
}
