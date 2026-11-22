/**
 * Core entity DTO schemas using Zod.
 * Mirrors FOLDER_STRUCTURE.md Section 2.3 models.
 */

import { z } from 'zod';
import {
  DataQualitySchema,
  AdjustmentStatusSchema,
  PeriodTypeSchema,
  CorporateActionTypeSchema,
  FlagSeveritySchema,
  FlagStatusSchema,
  FlagClassSchema,
} from '../enums/index.js';

// Common reusable schemas
export const CompanyIdSchema = z.string().min(1, 'Company ID is required');
export const UserIdSchema = z.string().min(1, 'User ID is required');
export const SymbolSchema = z.string().min(1, 'Symbol is required');
export const ISINSchema = z.string().optional();
export const CUID2Schema = z
  .string()
  .cuid2('Invalid CUID2 identifier');

// Currency and unit
export const CurrencySchema = z.literal('INR');
export const UnitSchema = z.enum([
  'CRORE',
  'LAKH',
  'MILLION',
  'RAW',
  'PERCENTAGE',
  'RATIO',
]);

// Data provenance
export const DataProvenanceSchema = z.object({
  source: z.string().min(1, 'Data source is required'),
  fetchedAt: z.string().datetime('Invalid ISO 8601 datetime'),
  reportedPeriod: z.string().min(1, 'Reported period is required'),
  currency: CurrencySchema,
  unit: UnitSchema,
  adjustmentStatus: AdjustmentStatusSchema,
  quality: DataQualitySchema,
  isMissing: z.boolean(),
  sourceDocumentRef: z.string().optional(),
});
export type DataProvenance = z.infer<typeof DataProvenanceSchema>;

// Financial statement line item
export const FinancialLineItemSchema = z.object({
  value: z.number().finite().nullable(),
  provenance: DataProvenanceSchema,
});
export type FinancialLineItem = z.infer<typeof FinancialLineItemSchema>;

// Company profile
export const CompanySchema = z.object({
  id: CUID2Schema,
  symbol: SymbolSchema,
  name: z.string().min(1, 'Company name is required'),
  isin: ISINSchema,
  sector: z.enum([
    'non-financial',
    'bank',
    'nbfc',
    'insurance',
    'other-financial',
  ]),
  exchange: z.enum(['NSE', 'BSE', 'NSE_BSE']),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Company = z.infer<typeof CompanySchema>;

// Financial statement period
export const FinancialStatementSchema = z.object({
  id: CUID2Schema,
  companyId: CompanyIdSchema,
  periodType: PeriodTypeSchema,
  fiscalYear: z.string().min(1, 'Fiscal year is required'),
  fiscalQuarter: z.string().optional(),
  revenue: FinancialLineItemSchema,
  netProfit: FinancialLineItemSchema,
  operatingProfit: FinancialLineItemSchema,
  totalAssets: FinancialLineItemSchema,
  totalLiabilities: FinancialLineItemSchema,
  totalEquity: FinancialLineItemSchema,
  totalDebt: FinancialLineItemSchema,
  currentAssets: FinancialLineItemSchema,
  currentLiabilities: FinancialLineItemSchema,
  interestExpense: FinancialLineItemSchema,
  ebit: FinancialLineItemSchema,
  eps: FinancialLineItemSchema,
  depreciationAmortization: FinancialLineItemSchema,
  capitalExpenditure: FinancialLineItemSchema,
  changeInWorkingCapital: FinancialLineItemSchema,
  fcf: FinancialLineItemSchema,
  dividendPerShare: FinancialLineItemSchema.optional(),
  sharesOutstanding: FinancialLineItemSchema.optional(),
  bookValuePerShare: FinancialLineItemSchema.optional(),
  promoterPledgePct: FinancialLineItemSchema.optional(),
  relatedPartyTxn: FinancialLineItemSchema.optional(),
  auditorQualification: z
    .enum(['unqualified', 'qualified', 'adverse', 'disclaimer'])
    .optional(),
  createdAt: z.string().datetime(),
});
export type FinancialStatement = z.infer<typeof FinancialStatementSchema>;

// Price bar (OHLCV)
export const PriceBarSchema = z.object({
  id: CUID2Schema,
  companyId: CompanyIdSchema,
  date: z.string().datetime('Invalid ISO 8601 datetime'),
  open: z.number().positive('Open price must be positive'),
  high: z.number().positive('High price must be positive'),
  low: z.number().positive('Low price must be positive'),
  close: z.number().positive('Close price must be positive'),
  volume: z.number().nonnegative('Volume must be non-negative'),
  adjusted: z.boolean().default(false),
  corporateActionType: z
    .enum(['dividend', 'split', 'bonus', 'rights', 'buyback'])
    .optional(),
  createdAt: z.string().datetime(),
});
export type PriceBar = z.infer<typeof PriceBarSchema>;

// Corporate action
export const CorporateActionSchema = z.object({
  id: CUID2Schema,
  companyId: CompanyIdSchema,
  type: CorporateActionTypeSchema,
  date: z.string().datetime('Invalid ISO 8601 datetime'),
  ratio: z.string().optional(),
  amount: z.number().nonnegative().optional(),
  createdAt: z.string().datetime(),
});
export type CorporateAction = z.infer<typeof CorporateActionSchema>;

// Shareholding point
export const ShareholdingPointSchema = z.object({
  id: CUID2Schema,
  companyId: CompanyIdSchema,
  period: z.string().min(1, 'Period is required'),
  promoterPct: z.number().min(0).max(100),
  fiiPct: z.number().min(0).max(100),
  diiPct: z.number().min(0).max(100),
  publicPct: z.number().min(0).max(100),
  promoterPledgePct: z.number().min(0).max(100).optional(),
  dataQuality: DataQualitySchema,
  createdAt: z.string().datetime(),
});
export type ShareholdingPoint = z.infer<typeof ShareholdingPointSchema>;

// Red flag
export const RedFlagSchema = z.object({
  id: z.string(),
  flagKey: z.string(),
  stage: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']),
  ruleKey: z.string().optional(),
  message: z.string(),
  threshold: z.string(),
  actualValue: z.unknown(),
  expectedValue: z.unknown().optional(),
  source: z.enum([
    'handwritten-notes',
    'blueprint',
    'engineering-default',
    'user-configured',
  ]),
  severity: FlagSeveritySchema,
  status: FlagStatusSchema,
  class: FlagClassSchema,
  companyId: z.string(),
  analysisRunId: z.string().optional(),
  ruleSetVersion: z.string(),
  dataSnapshotId: z.string().optional(),
  isOverride: z.boolean().default(false),
  createdAt: z.string().datetime(),
  acknowledgedAt: z.string().datetime().optional(),
  acknowledgedBy: z.string().optional(),
  overriddenAt: z.string().datetime().optional(),
  overriddenBy: z.string().optional(),
  overrideReason: z.string().optional(),
});
export type RedFlag = z.infer<typeof RedFlagSchema>;
