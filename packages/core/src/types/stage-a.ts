/**
 * Stage A — Quick Screening domain types.
 * Mirrors DOMAIN_MODEL_SPEC.md Section 4.1 and STAGE_A_SCORING_SPEC.md.
 */

import type { DataProvenance, ISODateString, Sector } from './base.js';
import type { StageScore } from './scoring.js';

/**
 * Financial metric with value and provenance.
 * Uses nullable value to preserve missing data without coercion to zero.
 */
export interface FinancialMetric {
  value: number | null;
  provenance: DataProvenance;
}

/**
 * Historical growth or multi-year metric container.
 */
export interface MetricGrowthInput {
  latestFy?: FinancialMetric | number | null;
  priorFy?: FinancialMetric | number | null;
  fy5yAgo?: FinancialMetric | number | null;
  cagr5y?: FinancialMetric | number | null;
  latestYoY?: FinancialMetric | number | null;
}

/**
 * Stage A financial metrics — supports FinancialMetric objects,
 * raw numeric values, and optional multi-year historical growth inputs.
 */
export interface StageAFinancials {
  // Income statement
  revenue?: FinancialMetric | MetricGrowthInput | number | null;
  netProfit?: FinancialMetric | MetricGrowthInput | number | null;
  operatingProfit?: FinancialMetric | MetricGrowthInput | number | null;
  
  // Balance sheet
  totalAssets?: FinancialMetric | number | null;
  totalLiabilities?: FinancialMetric | number | null;
  totalEquity?: FinancialMetric | number | null;
  totalDebt?: FinancialMetric | number | null;
  currentAssets?: FinancialMetric | number | null;
  currentLiabilities?: FinancialMetric | number | null;
  
  // Derived metrics (computed from above, nullable if inputs missing)
  interestExpense?: FinancialMetric | number | null;
  ebit?: FinancialMetric | number | null;
  eps?: FinancialMetric | number | null;
  peRatio?: FinancialMetric | number | null;
  industryPeRatio?: FinancialMetric | number | null;
  
  // Profitability ratios
  roa?: { latestFy?: FinancialMetric | number | null; avg5y?: FinancialMetric | number | null };
  industryRoaMin?: FinancialMetric | number | null;
  roe?: { latestFy?: FinancialMetric | number | null; avg5y?: FinancialMetric | number | null };
  roce?: { latestFy?: FinancialMetric | number | null; avg5y?: FinancialMetric | number | null };
  
  // Margin
  opm?: { latestFy?: FinancialMetric | number | null; avg5y?: FinancialMetric | number | null };
  industryOpmMin?: FinancialMetric | number | null;

  // Growth / historical metric extensions
  sales?: MetricGrowthInput;
  profit?: MetricGrowthInput;
  salesGrowth?: MetricGrowthInput;
  profitGrowth?: MetricGrowthInput;
  revenueGrowth?: MetricGrowthInput;
  netProfitGrowth?: MetricGrowthInput;
}

/**
 * Data availability report for Stage A financial metrics.
 * Tracks which metrics are present, missing, or have quality issues.
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
 * Stage A input payload.
 */
export interface StageAInput {
  companyId: string;
  asOfDate: ISODateString;
  financials: StageAFinancials;
  sector: Sector;
  industry?: string | undefined;
  dataAvailability?: StageADataAvailability | undefined;
  dataProvenance?: Record<string, DataProvenance> | undefined;
  dataSnapshotId?: string | undefined;
}

/**
 * Stage A execution status.
 */
export type StageAExecutionStatus = 
  | 'NOT_IMPLEMENTED'
  | 'NOT_EVALUATED'
  | 'DATA_INSUFFICIENT'
  | 'AWAITING_POLICY'
  | 'COMPLETED';

/**
 * Verdict bands for Stage A.
 */
export type StageAVerdictBand = 'EXCEPTIONAL' | 'EXCELLENT' | 'GOOD' | 'AVOID';

/**
 * Stage A output — unified scoring, rule breakdowns, red flags, and gate assessment.
 */
export interface StageAOutput extends StageScore {
  stage: 'A';
  companyId?: string | undefined;
  asOfDate?: ISODateString | undefined;
  sector: Sector;
  status?: StageAExecutionStatus | undefined;
  dataAvailability?: StageADataAvailability | undefined;
  executedAt?: ISODateString | undefined;
  ruleSetVersion: string;
  message?: string | undefined;

  // Stage A specific evaluation outputs
  maxPossibleScore: number;
  minPassScore: number;
  bankVariant: boolean;
  verdictBand?: StageAVerdictBand | undefined;
  gatePassed?: boolean | undefined;
  canProceedToStageB?: boolean | undefined;
  unsuitableRules?: string[] | undefined;
}

/**
 * Creates a default "not implemented" Stage A output fallback.
 */
export function createNotImplementedOutput(input: StageAInput): StageAOutput {
  const isBank = input.sector === 'bank' || input.sector === 'nbfc';
  const maxScore = isBank ? 9 : 10;
  const minPass = isBank ? 5.5 : 6.5;

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
    totalPoints: 0,
    maxPoints: maxScore,
    maxPossibleScore: maxScore,
    minPassScore: minPass,
    bankVariant: isBank,
    ruleResults: [],
    verdict: 'INCOMPLETE',
    verdictBand: 'AVOID',
    hardStops: [],
    conditionalWarnings: [],
    dataQualityWarnings: [],
    valuationWarnings: [],
    calculatedAt: new Date().toISOString(),
    dataSnapshotId: input.dataSnapshotId ?? '',
    gatePassed: false,
    canProceedToStageB: false,
    unsuitableRules: isBank ? ['currentRatio', 'interestCoverage'] : [],
  };
}
