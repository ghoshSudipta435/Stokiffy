/**
 * @stock-assistant/core — Public exports
 *
 * Pure TypeScript domain foundation for the Stokiffy investment engine.
 * Zero dependencies on React, Next.js, Prisma, or database drivers.
 *
 * Phase 1A: Domain primitives, types, and engine interfaces only.
 * No investment scoring or financial policy implementations.
 */

// Common primitives
export {
  safeDecimal,
  toDecimal,
  toCurrency,
  toRatio,
  toPercentage,
  toCagr,
  toShareQuantity,
  safeDivide,
  safeMultiply,
  safeAdd,
  safeSubtract,
  roundDecimal,
  decimalsEqual,
  isPositive,
  isNonNegative,
  DECIMAL_PRECISION,
} from './common/decimal.js';

// Domain errors
export {
  DomainError,
  MissingDataError,
  DivisionByZeroError,
  OutOfRangeError,
  InvalidRuleSetError,
  DeterminismError,
  isDomainError,
  extractErrorContext,
} from './common/errors.js';

// Base types
export type {
  ISODateString,
  Currency,
  Unit,
  AdjustmentStatus,
  DataQuality,
  EvidenceTag,
  Sector,
  StageId,
  DataProvenance,
  RedFlagBase,
  RedFlag,
  RedFlagLifecycle,
} from './types/base.js';

// Scoring types
export type { ScoringRuleResult, StageScore } from './types/scoring.js';

// Snapshot types
export type { AnalysisSnapshot, DataSnapshot } from './types/snapshot.js';

// Stage A types
export type {
  FinancialMetric,
  StageAFinancials,
  StageADataAvailability,
  StageAInput,
  StageAOutput,
  StageAExecutionStatus,
} from './types/stage-a.js';
export { createNotImplementedOutput } from './types/stage-a.js';

// Stage B types
export type {
  QuarterlyPoint,
  AnnualPoint,
  ShareholdingPoint,
  TrendClassification,
  StageBInput,
  StageBRuleResult,
  StageBOutput,
} from './types/stage-b.js';

// Stage C types
export type {
  EvidenceItem,
  BusinessModelAnswer,
  MoatTestResult,
  StageCInput,
  StageCOutput,
} from './types/stage-c.js';

// Stage D types
export type {
  ValuationMethod,
  Applicability,
  Confidence,
  ValuationMethodResult,
  StageDFinancials,
  StageDInput,
  StageDOutput,
} from './types/stage-d.js';

// Stage E types
export type {
  PatternName,
  OhlcvBar,
  CandlestickPattern,
  PatternContext,
  TechnicalSetup,
  StageEInput,
  StageEOutput,
} from './types/stage-e.js';

// Stage F types
export type {
  Position,
  PortfolioSnapshot,
  RiskCheckType,
  RiskCheckResult,
  OverrideRecord,
  TradePlanStatus,
  TradePlan,
  StageFInput,
  StageFOutput,
} from './types/stage-f.js';

// Stage G types
export type {
  AlertType,
  AlertSeverity,
  Alert,
  SellDecision,
  TradeAction,
  CorporateAction,
  PostTradeReview,
  JournalEntry,
  PositionWithThesis,
  StageGInput,
  StageGOutput,
} from './types/stage-g.js';

// Engine interfaces
export type {
  OverrideRecord as EngineOverrideRecord,
  StageGateResult,
  OverrideRequest,
  AcknowledgmentRequest,
  ScoringEngine,
  FlagEngine,
} from './engine/interfaces.js';
export { EngineNotImplementedError } from './engine/interfaces.js';
