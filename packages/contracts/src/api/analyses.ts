/**
 * Analysis API request/response contracts.
 * Mirrors API_ARCHITECTURE.md Section 4.4.
 * 
 * Stage A contracts are policy-neutral — no investment verdicts or thresholds.
 */

import { z } from 'zod';
import { ApiResponseSchema } from './common.js';
import { DataProvenanceSchema } from '../models/index.js';

// Financial metric with nullable value and provenance
export const FinancialMetricSchema = z.object({
  value: z.number().finite().nullable(),
  provenance: DataProvenanceSchema,
});
export type FinancialMetric = z.infer<typeof FinancialMetricSchema>;

// Stage A financials - all metrics nullable to preserve missing data
export const StageAFinancialsSchema = z.object({
  // Income statement
  revenue: FinancialMetricSchema,
  netProfit: FinancialMetricSchema,
  operatingProfit: FinancialMetricSchema,
  
  // Balance sheet
  totalAssets: FinancialMetricSchema,
  totalLiabilities: FinancialMetricSchema,
  totalEquity: FinancialMetricSchema,
  totalDebt: FinancialMetricSchema,
  currentAssets: FinancialMetricSchema,
  currentLiabilities: FinancialMetricSchema,
  
  // Derived metrics
  interestExpense: FinancialMetricSchema,
  ebit: FinancialMetricSchema,
  eps: FinancialMetricSchema,
  peRatio: FinancialMetricSchema,
  industryPeRatio: FinancialMetricSchema,
  
  // Profitability ratios
  roa: z.object({
    latestFy: FinancialMetricSchema,
    avg5y: FinancialMetricSchema,
  }),
  industryRoaMin: FinancialMetricSchema,
  roe: z.object({
    latestFy: FinancialMetricSchema,
    avg5y: FinancialMetricSchema,
  }),
  roce: z.object({
    latestFy: FinancialMetricSchema,
    avg5y: FinancialMetricSchema,
  }),
  
  // Margin
  opm: z.object({
    latestFy: FinancialMetricSchema,
    avg5y: FinancialMetricSchema,
  }),
  industryOpmMin: FinancialMetricSchema,
});
export type StageAFinancials = z.infer<typeof StageAFinancialsSchema>;

// Data availability report
export const StageADataAvailabilitySchema = z.object({
  totalMetrics: z.number().int().nonnegative(),
  presentMetrics: z.number().int().nonnegative(),
  missingMetrics: z.number().int().nonnegative(),
  incompleteMetrics: z.array(z.string()),
  qualityWarnings: z.array(z.string()),
  coverageRatio: z.number().min(0).max(1),
});
export type StageADataAvailability = z.infer<typeof StageADataAvailabilitySchema>;

// Stage A input payload
export const StageAInputSchema = z.object({
  companyId: z.string().min(1),
  asOfDate: z.string().datetime(),
  financials: StageAFinancialsSchema,
  sector: z.enum(['non-financial', 'bank', 'nbfc', 'insurance', 'other-financial']),
  dataAvailability: StageADataAvailabilitySchema,
});
export type StageAInput = z.infer<typeof StageAInputSchema>;

// Stage A execution status
export const StageAExecutionStatusSchema = z.enum([
  'NOT_IMPLEMENTED',
  'NOT_EVALUATED',
  'DATA_INSUFFICIENT',
  'AWAITING_POLICY',
]);
export type StageAExecutionStatus = z.infer<typeof StageAExecutionStatusSchema>;

// Stage A output - data availability only, no verdict
export const StageAOutputSchema = z.object({
  stage: z.literal('A'),
  companyId: z.string(),
  asOfDate: z.string().datetime(),
  sector: z.enum(['non-financial', 'bank', 'nbfc', 'insurance', 'other-financial']),
  status: StageAExecutionStatusSchema,
  dataAvailability: StageADataAvailabilitySchema,
  executedAt: z.string().datetime(),
  ruleSetVersion: z.string(),
  message: z.string(),
});
export type StageAOutput = z.infer<typeof StageAOutputSchema>;

// Run Stage A request (legacy - kept for compatibility)
export const RunStageARequestSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  ruleSetVersion: z.string().default('stage-a-v1.0'),
  forceRecompute: z.boolean().default(false),
});
export type RunStageARequest = z.infer<typeof RunStageARequestSchema>;

// Run Stage B request
export const RunStageBRequestSchema = z.object({
  analysisId: z.string().min(1, 'Analysis ID is required'),
  ruleSetVersion: z.string().default('stage-b-v1.0'),
  forceRecompute: z.boolean().default(false),
});
export type RunStageBRequest = z.infer<typeof RunStageBRequestSchema>;

// Flag override request
export const FlagOverrideRequestSchema = z.object({
  flagId: z.string().min(1, 'Flag ID is required'),
  reason: z.string().optional(),
  approvedBy: z.string().min(1, 'Approved by is required'),
});
export type FlagOverrideRequest = z.infer<typeof FlagOverrideRequestSchema>;

// Flag acknowledge request
export const FlagAcknowledgeRequestSchema = z.object({
  flagId: z.string().min(1, 'Flag ID is required'),
  reason: z.string().optional(),
  approvedBy: z.string().min(1, 'Acknowledged by is required'),
});
export type FlagAcknowledgeRequest = z.infer<typeof FlagAcknowledgeRequestSchema>;

// Analysis run response
export const AnalysisRunResponseSchema = ApiResponseSchema(
  z.object({
    id: z.string(),
    companyId: z.string(),
    stage: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']),
    score: z.number().min(0),
    maxScore: z.number().min(0),
    verdict: z.enum(['PASS', 'FAIL', 'CONDITIONAL', 'INCOMPLETE']),
    hardStops: z.array(z.any()),
    conditionalWarnings: z.array(z.any()),
    dataQualityWarnings: z.array(z.any()),
    valuationWarnings: z.array(z.any()),
    calculatedAt: z.string().datetime(),
    ruleSetVersion: z.string(),
  })
);
export type AnalysisRunResponse = z.infer<typeof AnalysisRunResponseSchema>;
