/**
 * Stage D — Valuation domain types.
 * Mirrors DOMAIN_MODEL_SPEC.md Section 4.4 and VALUATION_ENGINE_SPEC.md.
 */

import type { DataProvenance, ISODateString, RedFlag } from './base.js';
import type { ScoringRuleResult, StageScore } from './scoring.js';

export type ValuationMethod = 'PE' | 'PEG' | 'PB' | 'DCF';
export type Applicability = 'suitable' | 'limited' | 'unsuitable';
export type Confidence = 'high' | 'medium' | 'low';

export interface ValuationMethodResult {
  method: ValuationMethod;
  fairValue: number;
  assumptions: Record<string, unknown>;
  applicability: Applicability;
  confidence: Confidence;
  explanation: string;
  asOfDate: ISODateString;
  scenarios?: { bear: number; base: number; bull: number } | undefined;
  sensitivity?: Record<string, number[]> | undefined;
  flags: RedFlag[];
}

export interface StageDFinancials {
  eps: {
    reported: number;
    normalised?: number | undefined;
    forecast?: number | undefined;
  };
  bookValuePerShare: number;
  fcf: number[];
  netDebt: number;
  sharesOutstanding: number;
  industryPeRatio: number;
  growthRate?: {
    historical: number;
    forward?: number | undefined;
  } | undefined;
  dcfInputs?: {
    horizon: number;
    revenueGrowth?: number[] | undefined;
    operatingMargin?: number[] | undefined;
    taxRate?: number | undefined;
    reinvestmentRate?: number | undefined;
    wacc: number;
    terminalGrowth: number;
    projectedFcf?: number[] | undefined;
  } | undefined;
}

export interface StageDInput {
  companyId: string;
  asOfDate: ISODateString;
  marketPrice: number;
  financials: StageDFinancials;
  sector: string;
  businessModel: string;
  dataProvenance?: DataProvenance | undefined;
  dataSnapshotId?: string | undefined;
  selectedFairPE?: number | undefined;
  selectedFairPB?: number | undefined;
  assumedExitPE?: number | undefined;
  pegGrowthChoice?: 'historical' | 'forward' | 'custom' | undefined;
  customGrowthRate?: number | undefined;
  marginOfSafety?: number | undefined;
  primaryMethodOverride?: ValuationMethod | undefined;
}

export interface StageDOutput extends StageScore {
  stage: 'D';
  companyId?: string | undefined;
  asOfDate?: ISODateString | undefined;
  executedAt?: ISODateString | undefined;
  message?: string | undefined;
  methods: ValuationMethodResult[];
  primaryMethod: ValuationMethod;
  selectedFairValue: number;
  valuationRange: { low: number; high: number };
  maxBuyPrice: number;
  marginOfSafetyPct: number;
  buyReady: boolean;
  gatePassed: boolean;
  canProceedToStageE: boolean;
  overallConfidence: Confidence;
  valuationWarnings: RedFlag[];
  flags: RedFlag[];
  ruleResults: ScoringRuleResult[];
}
