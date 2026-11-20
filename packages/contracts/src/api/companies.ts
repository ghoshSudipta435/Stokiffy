/**
 * Companies API request/response contracts.
 * Mirrors API_ARCHITECTURE.md Section 4.2.
 */

import { z } from 'zod';
import {
  CompanySchema,
  PriceBarSchema,
  ShareholdingPointSchema,
  FinancialStatementSchema,
} from '../models/index.js';
import { PaginationQuerySchema, ApiResponseSchema, PaginatedApiResponseSchema } from './common.js';

// List companies query
export const ListCompaniesQuerySchema = PaginationQuerySchema.extend({
  sector: z
    .enum(['non-financial', 'bank', 'nbfc', 'insurance', 'other-financial'])
    .optional(),
  exchange: z.enum(['NSE', 'BSE', 'NSE_BSE']).optional(),
});
export type ListCompaniesQuery = z.infer<typeof ListCompaniesQuerySchema>;

// Company profile response
export const CompanyResponseSchema = ApiResponseSchema(CompanySchema);
export type CompanyResponse = z.infer<typeof CompanyResponseSchema>;

// List companies response
export const ListCompaniesResponseSchema = PaginatedApiResponseSchema(
  CompanySchema
);
export type ListCompaniesResponse = z.infer<typeof ListCompaniesResponseSchema>;

// Financials response
export const CompanyFinancialsResponseSchema = ApiResponseSchema(
  z.array(FinancialStatementSchema)
);
export type CompanyFinancialsResponse = z.infer<
  typeof CompanyFinancialsResponseSchema
>;

// Prices response
export const CompanyPricesResponseSchema = ApiResponseSchema(
  z.array(PriceBarSchema)
);
export type CompanyPricesResponse = z.infer<typeof CompanyPricesResponseSchema>;

// Shareholding response
export const CompanyShareholdingResponseSchema = ApiResponseSchema(
  z.array(ShareholdingPointSchema)
);
export type CompanyShareholdingResponse = z.infer<
  typeof CompanyShareholdingResponseSchema
>;
