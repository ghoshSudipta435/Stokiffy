/**
 * Shared domain enums as Zod schemas and TypeScript types.
 * Mirrors FOLDER_STRUCTURE.md Section 2.3.
 */

import { z } from 'zod';

/**
 * Sector classification for Indian listed equities.
 */
export const SectorSchema = z.enum([
  'non-financial',
  'bank',
  'nbfc',
  'insurance',
  'other-financial',
]);
export type Sector = z.infer<typeof SectorSchema>;

/**
 * Stage verdict values.
 */
export const StageVerdictSchema = z.enum([
  'Exceptional',
  'Excellent',
  'Good',
  'Avoid',
]);
export type StageVerdict = z.infer<typeof StageVerdictSchema>;

/**
 * Red flag class values.
 */
export const FlagClassSchema = z.enum([
  'HARD_STOP',
  'CONDITIONAL_WARNING',
  'DATA_QUALITY_WARNING',
  'VALUATION_WARNING',
]);
export type FlagClass = z.infer<typeof FlagClassSchema>;

/**
 * Flag severity values.
 */
export const FlagSeveritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
]);
export type FlagSeverity = z.infer<typeof FlagSeveritySchema>;

/**
 * Flag status lifecycle values.
 */
export const FlagStatusSchema = z.enum([
  'ACTIVE',
  'ACKNOWLEDGED',
  'OVERRIDDEN',
  'RESOLVED',
  'EXPIRED',
]);
export type FlagStatus = z.infer<typeof FlagStatusSchema>;

/**
 * Period type for financial statements.
 */
export const PeriodTypeSchema = z.enum(['Annual', 'Quarterly', 'TTM']);
export type PeriodType = z.infer<typeof PeriodTypeSchema>;

/**
 * Data quality values.
 */
export const DataQualitySchema = z.enum([
  'verified',
  'unverified',
  'stale',
  'missing',
  'inconsistent',
]);
export type DataQuality = z.infer<typeof DataQualitySchema>;

/**
 * Adjustment status values.
 */
export const AdjustmentStatusSchema = z.enum([
  'reported',
  'restated',
  'estimated',
  'manual',
]);
export type AdjustmentStatus = z.infer<typeof AdjustmentStatusSchema>;

/**
 * Valuation method values.
 */
export const ValuationMethodSchema = z.enum(['PE', 'PEG', 'PB', 'DCF']);
export type ValuationMethod = z.infer<typeof ValuationMethodSchema>;

/**
 * Trade plan status values.
 */
export const TradePlanStatusSchema = z.enum([
  'draft',
  'ready',
  'executed',
  'cancelled',
  'expired',
]);
export type TradePlanStatus = z.infer<typeof TradePlanStatusSchema>;

/**
 * Alert severity values.
 */
export const AlertSeveritySchema = z.enum(['info', 'warning', 'critical']);
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;

/**
 * Corporate action types.
 */
export const CorporateActionTypeSchema = z.enum([
  'dividend',
  'split',
  'bonus',
  'rights',
  'buyback',
]);
export type CorporateActionType = z.infer<typeof CorporateActionTypeSchema>;

/**
 * All enum schemas exported together.
 */
export const enumSchemas = {
  Sector: SectorSchema,
  StageVerdict: StageVerdictSchema,
  FlagClass: FlagClassSchema,
  FlagSeverity: FlagSeveritySchema,
  FlagStatus: FlagStatusSchema,
  PeriodType: PeriodTypeSchema,
  DataQuality: DataQualitySchema,
  AdjustmentStatus: AdjustmentStatusSchema,
  ValuationMethod: ValuationMethodSchema,
  TradePlanStatus: TradePlanStatusSchema,
  AlertSeverity: AlertSeveritySchema,
  CorporateActionType: CorporateActionTypeSchema,
} as const;
