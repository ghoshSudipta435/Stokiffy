/**
 * Monitoring, Alerts, Exit Decisions & Journaling API contracts.
 * Mirrors API_ARCHITECTURE.md Section 4.8 and PORTFOLIO_RISK_AND_EXIT_SPEC.md (Stage G).
 */

import { z } from 'zod';
import { ApiResponseSchema, PaginationQuerySchema } from './common.js';
import { RedFlagSchema } from '../models/index.js';

// Alert types
export const AlertTypeSchema = z.enum([
  'price-entry-zone',
  'price-target',
  'price-stop',
  'price-fair-value',
  'price-overvalued',
  'fundamental-results',
  'fundamental-deterioration',
  'fundamental-governance',
  'thesis-broken',
  'thesis-risk',
  'portfolio-concentration',
  'portfolio-drawdown',
  'portfolio-correlation',
]);
export type AlertType = z.infer<typeof AlertTypeSchema>;

// Individual Alert DTO
export const AlertSchema = z.object({
  id: z.string(),
  companyId: z.string().optional(),
  symbol: z.string().optional(),
  type: AlertTypeSchema,
  severity: z.enum(['info', 'warning', 'critical']),
  message: z.string(),
  triggeredAt: z.string().datetime(),
  acknowledgedAt: z.string().datetime().nullable().optional(),
  acknowledgedBy: z.string().nullable().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
  relatedTradePlanId: z.string().nullable().optional(),
});
export type Alert = z.infer<typeof AlertSchema>;

// Acknowledge alert request
export const AcknowledgeAlertRequestSchema = z.object({
  alertId: z.string().min(1, 'Alert ID is required'),
  acknowledgedBy: z.string().min(1, 'Acknowledged by identifier is required'),
  notes: z.string().optional(),
});
export type AcknowledgeAlertRequest = z.infer<typeof AcknowledgeAlertRequestSchema>;

// List alerts query
export const ListAlertsQuerySchema = PaginationQuerySchema.extend({
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  acknowledged: z.boolean().optional(),
  companyId: z.string().optional(),
  symbol: z.string().optional(),
  type: AlertTypeSchema.optional(),
});
export type ListAlertsQuery = z.infer<typeof ListAlertsQuerySchema>;

// Corporate Action record for journal
export const CorporateActionRecordSchema = z.object({
  type: z.enum(['dividend', 'split', 'bonus', 'rights', 'buyback']),
  date: z.string(),
  ratio: z.string().optional(),
  amount: z.number().optional(),
});
export type CorporateActionRecord = z.infer<typeof CorporateActionRecordSchema>;

// Post trade review
export const PostTradeReviewSchema = z.object({
  rulesWorked: z.array(z.string()),
  assumptionsFailed: z.array(z.string()),
  executionQuality: z.enum(['good', 'fair', 'poor']),
  slippage: z.number(),
  behaviouralNotes: z.string(),
  lesson: z.string(),
  reviewedAt: z.string().datetime(),
  reviewedBy: z.string().min(1, 'Reviewer is required'),
});
export type PostTradeReview = z.infer<typeof PostTradeReviewSchema>;

// Journal entry DTO
export const JournalEntrySchema = z.object({
  id: z.string(),
  tradePlanId: z.string(),
  symbol: z.string().optional(),
  companyId: z.string().optional(),
  date: z.string(),
  action: z.enum(['buy', 'trim', 'sell']),
  quantity: z.number(),
  price: z.number(),
  fees: z.number(),
  taxes: z.number(),
  reason: z.string(),
  ruleTriggers: z.array(z.string()).default([]),
  portfolioContext: z.record(z.string(), z.unknown()).default({}),
  realisedPnl: z.number().nullable().optional(),
  unrealisedPnl: z.number().nullable().optional(),
  returnPct: z.number().nullable().optional(),
  corporateActions: z.array(CorporateActionRecordSchema).default([]),
  review: PostTradeReviewSchema.nullable().optional(),
  createdAt: z.string().datetime(),
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

// Create journal entry request
export const CreateJournalEntryRequestSchema = z.object({
  tradePlanId: z.string().min(1, 'Trade plan ID is required'),
  symbol: z.string().optional(),
  companyId: z.string().optional(),
  date: z.string(),
  action: z.enum(['buy', 'trim', 'sell']),
  quantity: z.number().positive('Quantity must be greater than zero'),
  price: z.number().positive('Price must be greater than zero'),
  fees: z.number().nonnegative().default(0),
  taxes: z.number().nonnegative().default(0),
  reason: z.string().min(5, 'Reason must contain at least 5 characters'),
  ruleTriggers: z.array(z.string()).optional(),
  portfolioContext: z.record(z.string(), z.unknown()).optional(),
  corporateActions: z.array(CorporateActionRecordSchema).optional(),
});
export type CreateJournalEntryRequest = z.infer<typeof CreateJournalEntryRequestSchema>;

// Append review request (immutable journal: only review fields are updated)
export const AppendJournalReviewRequestSchema = z.object({
  review: PostTradeReviewSchema,
});
export type AppendJournalReviewRequest = z.infer<typeof AppendJournalReviewRequestSchema>;

// Sell Decision Recommendation / Audit
export const SellDecisionSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  symbol: z.string().optional(),
  tradePlanId: z.string(),
  trigger: AlertTypeSchema,
  decision: z.enum(['sell', 'trim', 'hold']),
  recommendedAction: z.enum(['HOLD', 'REVIEW_REQUIRED', 'TRIM_CANDIDATE', 'EXIT_CANDIDATE']).optional(),
  reason: z.string(),
  quantity: z.number().optional(),
  price: z.number().optional(),
  decidedAt: z.string(),
  decidedBy: z.string(),
  originalThesisSnapshot: z.string().optional(),
});
export type SellDecision = z.infer<typeof SellDecisionSchema>;

// Stage G input payload
export const StageGInputSchema = z.object({
  portfolio: z.object({
    totalValue: z.number().positive(),
    cash: z.number().nonnegative(),
    positions: z.array(z.any()),
    sectorExposure: z.record(z.string(), z.number()),
    asOfDate: z.string(),
  }),
  alerts: z.array(AlertSchema).optional(),
  openPositions: z.array(z.any()).optional(),
  tradeHistory: z.array(JournalEntrySchema).optional(),
  currentPrices: z.record(z.string(), z.number()).optional(),
  drawdownLimitPct: z.number().optional(),
  cashBufferMinPct: z.number().optional(),
  maxStockExposurePct: z.number().optional(),
  maxSectorExposurePct: z.number().optional(),
});
export type StageGInput = z.infer<typeof StageGInputSchema>;

// Stage G output payload
export const StageGOutputSchema = z.object({
  stage: z.literal('G'),
  activeAlerts: z.array(AlertSchema),
  pendingReviews: z.array(SellDecisionSchema),
  journalEntries: z.array(JournalEntrySchema),
  portfolioHealth: z.object({
    concentrationOk: z.boolean(),
    drawdownOk: z.boolean(),
    cashBufferOk: z.boolean(),
    correlationRisk: z.enum(['low', 'medium', 'high']),
    currentDrawdownPct: z.number(),
    cashPct: z.number(),
  }),
  openPositions: z.array(z.any()),
  pnlSummary: z.record(z.string(), z.any()).optional(),
  calculatedAt: z.string(),
  ruleSetVersion: z.string(),
  score: z.number(),
  maxScore: z.number(),
  verdict: z.string(),
  flags: z.array(RedFlagSchema),
  ruleResults: z.array(z.any()),
});
export type StageGOutput = z.infer<typeof StageGOutputSchema>;

// Response DTOs
export const AlertResponseSchema = ApiResponseSchema(AlertSchema);
export type AlertResponse = z.infer<typeof AlertResponseSchema>;

export const AlertsResponseSchema = ApiResponseSchema(z.array(AlertSchema));
export type AlertsResponse = z.infer<typeof AlertsResponseSchema>;

export const JournalEntryResponseSchema = ApiResponseSchema(JournalEntrySchema);
export type JournalEntryResponse = z.infer<typeof JournalEntryResponseSchema>;

export const JournalEntriesResponseSchema = ApiResponseSchema(z.array(JournalEntrySchema));
export type JournalEntriesResponse = z.infer<typeof JournalEntriesResponseSchema>;

export const StageGResponseSchema = ApiResponseSchema(StageGOutputSchema);
export type StageGResponse = z.infer<typeof StageGResponseSchema>;
