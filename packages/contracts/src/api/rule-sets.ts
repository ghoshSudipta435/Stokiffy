/**
 * Rule Sets and Industry Benchmarks API contracts.
 * Supports configurable risk limits, benchmark tuning, and rule set versioning.
 */

import { z } from 'zod';
import { ApiResponseSchema } from './common.js';

// Industry Benchmark
export const IndustryBenchmarkSchema = z.object({
  id: z.string().optional(),
  ruleSetId: z.string().optional(),
  industry: z.string().min(1, 'Industry name is required'),
  opmMinPct: z.number().nullable().optional(),
  opmMaxPct: z.number().nullable().optional(),
  typicalPE: z.number().nullable().optional(),
  minRoaPct: z.number().nullable().optional(),
  sourceNote: z.string().nullable().optional(),
  minOperatingMargin: z.number().nullable().optional(),
  maxOperatingMargin: z.number().nullable().optional(),
  benchmarkPe: z.number().nullable().optional(),
  minRoa: z.number().nullable().optional(),
  minRoce: z.number().nullable().optional(),
  maxDebtToEquity: z.number().nullable().optional(),
  minCurrentRatio: z.number().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type IndustryBenchmark = z.infer<typeof IndustryBenchmarkSchema>;

// Configurable Risk Limits (Stage F defaults)
export const RiskLimitsSchema = z.object({
  riskBudgetPerTradePct: z.number().positive().max(100).default(1.0),
  maxStockExposurePct: z.number().positive().max(100).default(10.0),
  maxSectorExposurePct: z.number().positive().max(100).default(25.0),
  minRiskReward: z.number().positive().default(2.0),
  maxPositionPctOfADV: z.number().positive().max(100).default(10.0),
  lotSize: z.number().int().positive().default(1),
  cashBufferPct: z.number().nonnegative().max(100).default(5.0),
  estimatedFeesPct: z.number().nonnegative().max(10).default(0.1),
  slippagePct: z.number().nonnegative().max(10).default(0.2),
});
export type RiskLimits = z.infer<typeof RiskLimitsSchema>;

// Full RuleSet
export const RuleSetSchema = z.object({
  id: z.string(),
  version: z.string().min(1, 'Version is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']),
  rules: z.record(z.string(), z.unknown()).default({}),
  riskLimits: RiskLimitsSchema.optional(),
  benchmarks: z.array(IndustryBenchmarkSchema).optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  publishedBy: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type RuleSet = z.infer<typeof RuleSetSchema>;

// Upsert draft request
export const UpsertRuleSetDraftRequestSchema = z.object({
  version: z.string().min(1, 'Version is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  rules: z.record(z.string(), z.unknown()).optional(),
  riskLimits: RiskLimitsSchema.partial().optional(),
});
export type UpsertRuleSetDraftRequest = z.infer<typeof UpsertRuleSetDraftRequestSchema>;

// Publish rule set request
export const PublishRuleSetRequestSchema = z.object({
  version: z.string().min(1, 'Version is required'),
  publishedBy: z.string().min(1, 'Publisher identifier is required'),
});
export type PublishRuleSetRequest = z.infer<typeof PublishRuleSetRequestSchema>;

// Benchmark update payload
export const BenchmarkItemInputSchema = IndustryBenchmarkSchema.omit({
  id: true,
  ruleSetId: true,
  createdAt: true,
  updatedAt: true,
});
export type BenchmarkItemInput = z.infer<typeof BenchmarkItemInputSchema>;

export const UpdateBenchmarksRequestSchema = z.object({
  benchmarks: z.array(BenchmarkItemInputSchema).min(1, 'At least one benchmark is required'),
});
export type UpdateBenchmarksRequest = z.infer<typeof UpdateBenchmarksRequestSchema>;

// Update risk limits request
export const UpdateRiskLimitsRequestSchema = RiskLimitsSchema.partial();
export type UpdateRiskLimitsRequest = z.infer<typeof UpdateRiskLimitsRequestSchema>;

// Responses
export const RuleSetResponseSchema = ApiResponseSchema(RuleSetSchema);
export type RuleSetResponse = z.infer<typeof RuleSetResponseSchema>;

export const ListRuleSetsResponseSchema = ApiResponseSchema(z.array(RuleSetSchema));
export type ListRuleSetsResponse = z.infer<typeof ListRuleSetsResponseSchema>;

export const BenchmarksResponseSchema = ApiResponseSchema(z.array(IndustryBenchmarkSchema));
export type BenchmarksResponse = z.infer<typeof BenchmarksResponseSchema>;
