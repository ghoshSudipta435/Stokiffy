/**
 * Stage B — Deep Trend Analysis domain types.
 * Mirrors DOMAIN_MODEL_SPEC.md Section 4.2 and STAGE_B_SCORING_SPEC.md.
 */

import type { DataProvenance, ISODateString } from './base.js';
import type { ScoringRuleResult, StageScore } from './scoring.js';

export interface QuarterlyPoint {
  period: string;
  salesYoY: number | null;
  opmYoY: number | null;
  dataQuality?: DataProvenance | undefined;
}

export interface AnnualPoint {
  period: string;
  sales: number | null;
  opm: number | null;
  netProfit: number | null;
  netMargin?: number | null | undefined;
  reserves?: number | null | undefined;
  borrowings?: number | null | undefined;
  cfo?: number | null | undefined;
  pat?: number | null | undefined;
  debtorDays?: number | null | undefined;
  roce?: number | null | undefined;
  dataQuality?: DataProvenance | undefined;
}

export interface ShareholdingPoint {
  period: string;
  promoterPct: number | null;
  fiiPct: number | null;
  diiPct: number | null;
  publicPct: number | null;
  promoterPledgePct?: number | null | undefined;
  dataQuality?: DataProvenance | undefined;
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
  dataProvenance?: DataProvenance | undefined;
  dataSnapshotId?: string | undefined;
}

export interface StageBRuleResult extends ScoringRuleResult {
  trendClassification?: TrendClassification | undefined;
  supportingData?: {
    periodCount: number;
    positivePeriods: number;
    negativePeriods: number;
    flatPeriods: number;
  } | undefined;
}

export type StageBVerdictBand = 'EXCEPTIONAL' | 'EXCELLENT' | 'GOOD' | 'AVOID';

export interface StageBOutput extends StageScore {
  stage: 'B';
  companyId?: string | undefined;
  asOfDate?: ISODateString | undefined;
  executedAt?: ISODateString | undefined;
  message?: string | undefined;
  maxPossibleScore?: number | undefined;
  minPassScore?: number | undefined;
  gatePassed?: boolean | undefined;
  canProceedToStageC?: boolean | undefined;
  verdictBand?: StageBVerdictBand | undefined;
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
