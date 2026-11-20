/**
 * Stage D — Valuation domain types.
 * Mirrors DOMAIN_MODEL_SPEC.md Section 4.4.
 */

import type { DataProvenance, ISODateString, RedFlag } from './base.js';

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
  scenarios?: { bear: number; base: number; bull: number };
  sensitivity?: Record<string, number[]>;
  flags: RedFlag[];
}

export interface StageDFinancials {
  eps: { reported: number; normalised?: number; forecast?: number };
  bookValuePerShare: number;
  fcf: number[];
  netDebt: number;
  sharesOutstanding: number;
  industryPeRatio: number;
  growthRate?: { historical: number; forward?: number };
  dcfInputs?: {
    horizon: number;
    revenueGrowth: number[];
    operatingMargin: number[];
    taxRate: number;
    reinvestmentRate: number;
    wacc: number;
    terminalGrowth: number;
  };
}

export interface StageDInput {
  companyId: string;
  asOfDate: ISODateString;
  marketPrice: number;
  financials: StageDFinancials;
  sector: string;
  businessModel: string;
  dataProvenance: DataProvenance;
}

export interface StageDOutput {
  stage: 'D';
  methods: ValuationMethodResult[];
  primaryMethod: ValuationMethod;
  valuationRange: { low: number; high: number };
  maxBuyPrice: number;
  marginOfSafetyPct: number;
  buyReady: boolean;
  valuationWarnings: RedFlag[];
  calculatedAt: ISODateString;
  ruleSetVersion: string;
  dataSnapshotId: string;
}
