/**
 * Valuation API request/response contracts.
 * Mirrors API_ARCHITECTURE.md Section 4.6.
 */

import { z } from 'zod';
import { ApiResponseSchema } from './common.js';

export const ValuationRequestSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  marketPrice: z.number().positive(),
  normalisedEPS: z.number().optional(),
  targetPE: z.number().positive().optional(),
  wacc: z.number().positive().optional(),
  terminalGrowth: z.number().optional(),
  horizon: z.number().int().positive().optional(),
});
export type ValuationRequest = z.infer<typeof ValuationRequestSchema>;

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
