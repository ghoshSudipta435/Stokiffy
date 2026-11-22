/**
 * Valuation API request/response contracts.
 * Mirrors API_ARCHITECTURE.md Section 4.6 and VALUATION_ENGINE_SPEC.md (Stage D).
 */

import { z } from 'zod';
import { ApiResponseSchema } from './common.js';
import { DataProvenanceSchema, RedFlagSchema } from '../models/index.js';

// Stage D Financials schema
export const StageDFinancialsSchema = z.object({
  eps: z.object({
    reported: z.number(),
    normalised: z.number().optional(),
    forecast: z.number().optional(),
  }),
  bookValuePerShare: z.number(),
  fcf: z.array(z.number()),
  netDebt: z.number(),
  sharesOutstanding: z.number().positive(),
  industryPeRatio: z.number().positive(),
  growthRate: z
    .object({
      historical: z.number(),
      forward: z.number().optional(),
    })
    .optional(),
  dcfInputs: z
    .object({
      horizon: z.number().int().positive(),
      revenueGrowth: z.array(z.number()).optional(),
      operatingMargin: z.array(z.number()).optional(),
      taxRate: z.number().optional(),
      reinvestmentRate: z.number().optional(),
      wacc: z.number().positive(),
      terminalGrowth: z.number(),
      projectedFcf: z.array(z.number()).optional(),
    })
    .optional(),
});
export type StageDFinancials = z.infer<typeof StageDFinancialsSchema>;

// Valuation method individual result
export const ValuationMethodResultSchema = z.object({
  method: z.enum(['PE', 'PEG', 'PB', 'DCF']),
  fairValue: z.number(),
  assumptions: z.record(z.string(), z.unknown()),
  applicability: z.enum(['suitable', 'limited', 'unsuitable']),
  confidence: z.enum(['high', 'medium', 'low']),
  explanation: z.string(),
  asOfDate: z.string(),
  scenarios: z
    .object({
      bear: z.number(),
      base: z.number(),
      bull: z.number(),
    })
    .optional(),
  sensitivity: z.record(z.string(), z.array(z.number())).optional(),
  flags: z.array(RedFlagSchema),
});
export type ValuationMethodResult = z.infer<typeof ValuationMethodResultSchema>;

// Input payload for Stage D Valuation
export const StageDInputSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  asOfDate: z.string(),
  marketPrice: z.number().positive(),
  financials: StageDFinancialsSchema,
  sector: z.string(),
  businessModel: z.string(),
  dataProvenance: DataProvenanceSchema.optional(),
  dataSnapshotId: z.string().optional(),
  selectedFairPE: z.number().positive().optional(),
  selectedFairPB: z.number().positive().optional(),
  assumedExitPE: z.number().positive().optional(),
  pegGrowthChoice: z.enum(['historical', 'forward', 'custom']).optional(),
  customGrowthRate: z.number().optional(),
  marginOfSafety: z.number().min(0).max(1).optional(),
  primaryMethodOverride: z.enum(['PE', 'PEG', 'PB', 'DCF']).optional(),
});
export type StageDInput = z.infer<typeof StageDInputSchema>;

// Standard valuation request (supports lightweight and full Stage D inputs)
export const ValuationRequestSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  marketPrice: z.number().positive(),
  normalisedEPS: z.number().optional(),
  targetPE: z.number().positive().optional(),
  wacc: z.number().positive().optional(),
  terminalGrowth: z.number().optional(),
  horizon: z.number().int().positive().optional(),
  financials: StageDFinancialsSchema.optional(),
  sector: z.string().optional(),
  businessModel: z.string().optional(),
  selectedFairPE: z.number().positive().optional(),
  selectedFairPB: z.number().positive().optional(),
  assumedExitPE: z.number().positive().optional(),
  pegGrowthChoice: z.enum(['historical', 'forward', 'custom']).optional(),
  customGrowthRate: z.number().optional(),
  marginOfSafety: z.number().min(0).max(1).optional(),
  primaryMethodOverride: z.enum(['PE', 'PEG', 'PB', 'DCF']).optional(),
});
export type ValuationRequest = z.infer<typeof ValuationRequestSchema>;

// Complete Stage D valuation engine output
export const StageDOutputSchema = z.object({
  stage: z.literal('D'),
  companyId: z.string().optional(),
  asOfDate: z.string().optional(),
  executedAt: z.string().optional(),
  message: z.string().optional(),
  score: z.number(),
  maxScore: z.number(),
  verdict: z.string(),
  methods: z.array(ValuationMethodResultSchema),
  primaryMethod: z.enum(['PE', 'PEG', 'PB', 'DCF']),
  selectedFairValue: z.number(),
  valuationRange: z.object({
    low: z.number(),
    high: z.number(),
  }),
  maxBuyPrice: z.number(),
  marginOfSafetyPct: z.number(),
  buyReady: z.boolean(),
  gatePassed: z.boolean(),
  canProceedToStageE: z.boolean(),
  overallConfidence: z.enum(['high', 'medium', 'low']),
  valuationWarnings: z.array(RedFlagSchema),
  flags: z.array(RedFlagSchema),
  ruleResults: z.array(z.any()),
});
export type StageDOutput = z.infer<typeof StageDOutputSchema>;

// Stage D response DTO
export const StageDResponseSchema = ApiResponseSchema(StageDOutputSchema);
export type StageDResponse = z.infer<typeof StageDResponseSchema>;

// Lightweight valuation response (legacy compatibility)
export const ValuationResponseSchema = ApiResponseSchema(
  z.object({
    primaryMethod: z.enum(['PE', 'PEG', 'PB', 'DCF']),
    fairValue: z.number().positive(),
    valuationRange: z.object({
      low: z.number().positive(),
      high: z.number().positive(),
    }),
    confidence: z.enum(['high', 'medium', 'low']),
    valuationWarnings: z.array(z.any()),
    calculatedAt: z.string().datetime(),
  })
);
export type ValuationResponse = z.infer<typeof ValuationResponseSchema>;
