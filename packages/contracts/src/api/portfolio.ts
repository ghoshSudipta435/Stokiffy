/**
 * Portfolio API request/response contracts.
 * Mirrors API_ARCHITECTURE.md Section 4.8.
 */

import { z } from 'zod';
import { ApiResponseSchema } from './common.js';

export const PortfolioSummaryResponseSchema = ApiResponseSchema(
  z.object({
    totalValue: z.number().nonnegative(),
    cash: z.number().nonnegative(),
    positionsCount: z.number().int().nonnegative(),
    sectorExposure: z.record(z.string(), z.number()),
    unrealisedPnl: z.number(),
    unrealisedPnlPct: z.number(),
    cashBufferPct: z.number(),
  })
);
export type PortfolioSummaryResponse = z.infer<
  typeof PortfolioSummaryResponseSchema
>;

export const PositionResponseSchema = ApiResponseSchema(
  z.object({
    symbol: z.string(),
    companyId: z.string(),
    quantity: z.number().positive(),
    avgPrice: z.number().positive(),
    currentPrice: z.number().positive(),
    marketValue: z.number().positive(),
    sector: z.string(),
    unrealisedPnl: z.number(),
    unrealisedPnlPct: z.number(),
  })
);
export type PositionResponse = z.infer<typeof PositionResponseSchema>;

export const TransactionRequestSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  action: z.enum(['buy', 'trim', 'sell']),
  quantity: z.number().positive(),
  price: z.number().positive(),
  fees: z.number().nonnegative().default(0),
  taxes: z.number().nonnegative().default(0),
  reason: z.string().min(1, 'Reason is required'),
  idempotencyKey: z.string().uuid('Idempotency key must be a valid UUID'),
});
export type TransactionRequest = z.infer<typeof TransactionRequestSchema>;
