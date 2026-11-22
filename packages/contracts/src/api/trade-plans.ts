/**
 * Trade plan API request/response contracts.
 * Mirrors API_ARCHITECTURE.md Section 4.7 and PORTFOLIO_RISK_AND_EXIT_SPEC.md (Stage F).
 */

import { z } from 'zod';
import { ApiResponseSchema } from './common.js';
import { RedFlagSchema } from '../models/index.js';

// Risk check types
export const RiskCheckTypeSchema = z.enum([
  'risk_budget',
  'stock_concentration',
  'sector_concentration',
  'liquidity',
  'cash',
  'risk_reward',
  'stop_below_entry',
]);
export type RiskCheckType = z.infer<typeof RiskCheckTypeSchema>;

// Individual risk check result
export const RiskCheckResultSchema = z.object({
  check: RiskCheckTypeSchema,
  passed: z.boolean(),
  actualValue: z.number(),
  limit: z.number(),
  message: z.string(),
});
export type RiskCheckResult = z.infer<typeof RiskCheckResultSchema>;

// Override record for audit trail
export const OverrideRecordSchema = z.object({
  flagId: z.string(),
  reason: z.string(),
  overriddenBy: z.string(),
  overriddenAt: z.string(),
  beforeState: z.record(z.string(), z.unknown()).default({}),
  afterState: z.record(z.string(), z.unknown()).default({}),
});
export type OverrideRecord = z.infer<typeof OverrideRecordSchema>;

// Position sizing calculation breakdown
export const PositionSizingResultSchema = z.object({
  rawQuantity: z.number(),
  adjustedQuantity: z.number(),
  positionSize: z.number(),
  entryPriceEst: z.number(),
  riskBudget: z.number(),
  riskPerShare: z.number(),
  plannedPositionValue: z.number(),
  plannedLossAtStop: z.number(),
  actualRiskPct: z.number(),
  postTradeStockExposurePct: z.number(),
  postTradeSectorExposurePct: z.number(),
  cashRemaining: z.number(),
  estimatedFees: z.number(),
  limitingFactor: z.enum([
    'risk_budget',
    'lot_size',
    'liquidity',
    'cash',
    'stock_cap',
    'sector_cap',
    'requested_quantity',
    'invalid_inputs',
  ]),
});
export type PositionSizingResult = z.infer<typeof PositionSizingResultSchema>;

// Full TradePlan domain schema
export const TradePlanFullSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  symbol: z.string(),
  thesis: z.string(),
  expectedHoldingPeriod: z.string(),
  entryRationale: z.string(),
  entryZone: z.object({ low: z.number(), high: z.number() }),
  stopLoss: z.number(),
  targets: z.array(z.number()),
  positionSize: z.number(),
  entryPriceEst: z.number(),
  riskBudget: z.number(),
  plannedLossAtStop: z.number(),
  portfolioExposurePct: z.number(),
  sectorExposurePct: z.number(),
  cashRemaining: z.number(),
  riskChecks: z.array(RiskCheckResultSchema),
  blocked: z.boolean(),
  overrides: z.array(OverrideRecordSchema),
  status: z.enum(['draft', 'ready', 'executed', 'cancelled', 'expired']),
  ruleSetVersion: z.string(),
  valuationMaxBuyPrice: z.number(),
  technicalSetupId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  executedAt: z.string().optional(),
  executedPrice: z.number().optional(),
  executedQuantity: z.number().optional(),
});
export type TradePlanFull = z.infer<typeof TradePlanFullSchema>;

// Create trade plan request
export const CreateTradePlanRequestSchema = z
  .object({
    companyId: z.string().min(1, 'Company ID is required'),
    entryPrice: z
      .number()
      .positive('Entry price must be greater than zero')
      .finite(),
    stopPrice: z
      .number()
      .positive('Stop price must be greater than zero')
      .finite(),
    riskPercentage: z.number().optional(),
    thesis: z
      .string()
      .min(20, 'Thesis must contain at least 20 characters of evidence')
      .max(5000),
    invalidationCondition: z
      .string()
      .min(10, 'Invalidation trigger is required')
      .max(2000),
    expectedHoldingPeriod: z.string().optional(),
    entryRationale: z.string().optional(),
    targets: z.array(z.number().positive()).optional(),
    requestedQuantity: z.number().int().positive().optional(),
  })
  .refine((data) => data.stopPrice < data.entryPrice, {
    message: 'Stop price must be lower than entry price',
    path: ['stopPrice'],
  });
export type CreateTradePlanRequest = z.infer<typeof CreateTradePlanRequestSchema>;

// Update trade plan request
export const UpdateTradePlanRequestSchema = z.object({
  status: z.enum(['draft', 'ready', 'executed', 'cancelled', 'expired']).optional(),
  thesis: z.string().min(20).max(5000).optional(),
  invalidationCondition: z.string().min(10).max(2000).optional(),
  entryPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  executedPrice: z.number().positive().optional(),
  executedQuantity: z.number().int().positive().optional(),
  executedAt: z.string().datetime().optional(),
  overrides: z.array(OverrideRecordSchema).optional(),
});
export type UpdateTradePlanRequest = z.infer<typeof UpdateTradePlanRequestSchema>;

// Trade plan override request
export const TradePlanOverrideRequestSchema = z.object({
  flagId: z.string().min(1, 'Flag ID is required'),
  reason: z.string().min(10, 'Override reason must be at least 10 characters'),
  overriddenBy: z.string().min(1, 'Overridden by is required'),
  beforeState: z.record(z.string(), z.unknown()).optional(),
  afterState: z.record(z.string(), z.unknown()).optional(),
});
export type TradePlanOverrideRequest = z.infer<typeof TradePlanOverrideRequestSchema>;

// Stage F input payload
export const StageFInputSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  symbol: z.string().optional(),
  sector: z.string().optional(),
  tradePlanDraft: z.record(z.string(), z.unknown()).optional(),
  portfolio: z.object({
    totalValue: z.number().positive(),
    cash: z.number().nonnegative(),
    positions: z.array(z.any()),
    sectorExposure: z.record(z.string(), z.number()),
    asOfDate: z.string(),
  }),
  riskConfig: z
    .object({
      riskPerTradePct: z.number().positive().optional(),
      maxStockExposurePct: z.number().positive().optional(),
      maxSectorExposurePct: z.number().positive().optional(),
      minRiskReward: z.number().positive().optional(),
      maxPositionPctOfADV: z.number().positive().optional(),
      lotSize: z.number().int().positive().optional(),
      cashBufferPct: z.number().nonnegative().optional(),
      estimatedFeesPct: z.number().nonnegative().optional(),
      slippagePct: z.number().nonnegative().optional(),
    })
    .optional(),
  valuationMaxBuyPrice: z.number().positive().optional(),
  technicalSetup: z
    .object({
      id: z.string().optional(),
      entryZone: z.object({ low: z.number(), high: z.number() }),
      stopLoss: z.number(),
      targets: z.array(z.number()),
      riskReward: z.number().optional(),
      inBuyZone: z.boolean().optional(),
    })
    .optional(),
  avgDailyVolume: z.number().positive().optional(),
  requestedQuantity: z.number().int().positive().optional(),
  overrides: z.array(OverrideRecordSchema).optional(),
});
export type StageFInput = z.infer<typeof StageFInputSchema>;

// Stage F output payload
export const StageFOutputSchema = z.object({
  stage: z.literal('F'),
  companyId: z.string().optional(),
  symbol: z.string().optional(),
  tradePlan: TradePlanFullSchema,
  positionSizing: PositionSizingResultSchema,
  riskChecks: z.array(RiskCheckResultSchema),
  blocked: z.boolean(),
  gatePassed: z.boolean(),
  canProceedToStageG: z.boolean(),
  canApprovePlan: z.boolean(),
  disclaimer: z.string(),
  score: z.number(),
  maxScore: z.number(),
  verdict: z.string(),
  flags: z.array(RedFlagSchema),
  ruleResults: z.array(z.any()),
});
export type StageFOutput = z.infer<typeof StageFOutputSchema>;

// Response DTOs
export const TradePlanResponseSchema = ApiResponseSchema(
  z.object({
    id: z.string(),
    companyId: z.string(),
    symbol: z.string(),
    thesis: z.string(),
    status: z.enum(['draft', 'ready', 'executed', 'cancelled', 'expired']),
    positionSize: z.number().positive(),
    riskBudget: z.number().positive(),
    portfolioExposurePct: z.number(),
    sectorExposurePct: z.number(),
    createdAt: z.string().datetime(),
    ruleSetVersion: z.string(),
  })
);
export type TradePlanResponse = z.infer<typeof TradePlanResponseSchema>;

export const StageFResponseSchema = ApiResponseSchema(StageFOutputSchema);
export type StageFResponse = z.infer<typeof StageFResponseSchema>;

export const ListTradePlansResponseSchema = ApiResponseSchema(z.array(TradePlanFullSchema));
export type ListTradePlansResponse = z.infer<typeof ListTradePlansResponseSchema>;
