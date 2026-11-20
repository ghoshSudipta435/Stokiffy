/**
 * Stage A — Quick Screening domain types.
 * Mirrors DOMAIN_MODEL_SPEC.md Section 4.1.
 * 
 * Policy-neutral types for Stage A input and data availability.
 * Investment screening thresholds and verdict logic are DEFERRED (pending D-A1, D-01..D-05).
 */

import type { DataProvenance, ISODateString, Sector } from './base.js';

/**
 * Financial metric with value and provenance.
 * Uses nullable value to preserve missing data without coercion to zero.
 */
export interface FinancialMetric {
  value: number | null;
  provenance: DataProvenance;
}

/**
 * Stage A financial metrics — all nullable to preserve missing-value semantics.
 * Mirrors the raw financial statement line items needed for Stage A screening.
 * Investment calculations (ratios, CAGR, etc.) are DEFERRED pending D-A1.
 */
export interface StageAFinancials {
  // Income statement
  revenue: FinancialMetric;
  netProfit: FinancialMetric;
  operatingProfit: FinancialMetric;
  
  // Balance sheet
  totalAssets: FinancialMetric;
  totalLiabilities: FinancialMetric;
  totalEquity: FinancialMetric;
  totalDebt: FinancialMetric;
  currentAssets: FinancialMetric;
  currentLiabilities: FinancialMetric;
  
  // Derived metrics (computed from above, nullable if inputs missing)
  interestExpense: FinancialMetric;
  ebit: FinancialMetric;
  eps: FinancialMetric;
  peRatio: FinancialMetric;
  industryPeRatio: FinancialMetric;
  
  // Profitability ratios
  roa: { latestFy: FinancialMetric; avg5y: FinancialMetric };
  industryRoaMin: FinancialMetric;
  roe: { latestFy: FinancialMetric; avg5y: FinancialMetric };
  roce: { latestFy: FinancialMetric; avg5y: FinancialMetric };
  
  // Margin
  opm: { latestFy: FinancialMetric; avg5y: FinancialMetric };
  industryOpmMin: FinancialMetric;
}

/**
 * Data availability report for Stage A financial metrics.
 * Tracks which metrics are present, missing, or have quality issues.
 * Does NOT make pass/fail decisions — that is policy (D-A1, D-03).
 */
export interface StageADataAvailability {
  totalMetrics: number;
  presentMetrics: number;
  missingMetrics: number;
  incompleteMetrics: string[]; // field paths with missing values
  qualityWarnings: string[];   // data quality issues (stale, inconsistent, etc.)
  coverageRatio: number;       // present / total (0.0 to 1.0)
}

/**
 * Stage A input payload — policy-neutral data container.
 * Contains raw financial metrics and provenance, no screening logic.
 */
export interface StageAInput {
  companyId: string;
  asOfDate: ISODateString;
  financials: StageAFinancials;
  sector: Sector;
  dataAvailability: StageADataAvailability;
}

/**
 * Stage A execution status — neutral, no investment verdict.
 * Investment verdict logic is DEFERRED pending D-A1, D-01..D-05.
 */
export type StageAExecutionStatus = 
  | 'NOT_IMPLEMENTED'
  | 'NOT_EVALUATED'
  | 'DATA_INSUFFICIENT'
  | 'AWAITING_POLICY';

/**
 * Stage A output — data availability report only.
 * No score, no verdict, no pass/fail. Those require policy decisions.
 */
export interface StageAOutput {
  stage: 'A';
  companyId: string;
  asOfDate: ISODateString;
  sector: Sector;
  status: StageAExecutionStatus;
  dataAvailability: StageADataAvailability;
  executedAt: ISODateString;
  ruleSetVersion: string;
  message: string;
}

/**
 * Creates a default "not implemented" Stage A output.
 * Used as the neutral execution boundary until policy decisions are made.
 */
export function createNotImplementedOutput(input: StageAInput): StageAOutput {
  return {
    stage: 'A',
    companyId: input.companyId,
    asOfDate: input.asOfDate,
    sector: input.sector,
    status: 'NOT_IMPLEMENTED',
    dataAvailability: input.dataAvailability,
    executedAt: new Date().toISOString(),
    ruleSetVersion: 'stage-a-v1.0',
    message: 'Stage A execution not implemented. Investment screening thresholds and verdict logic are pending user decisions (D-A1, D-01..D-05).',
  };
}
