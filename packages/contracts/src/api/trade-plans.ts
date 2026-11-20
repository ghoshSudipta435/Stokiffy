/**
 * Trade plan API request/response contracts.
 * Mirrors API_ARCHITECTURE.md Section 4.7.
 */

import { z } from 'zod';
import { ApiResponseSchema } from './common.js';

export const CreateTradePlanRequestSchema = z.object({
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
}).refine(
  (data) => data.stopPrice < data.entryPrice,
  {
    message: 'Stop price must be lower than entry price',
    path: ['stopPrice'],
  }
);
export type CreateTradePlanRequest = z.infer<typeof CreateTradePlanRequestSchema>;

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
