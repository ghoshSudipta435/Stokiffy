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
  MetricGrowthInput,
  StageAFinancials,
  StageADataAvailability,
  StageAInput,
  StageAOutput,
  StageAExecutionStatus,
  StageAVerdictBand,
} from './types/stage-a.js';
export { createNotImplementedOutput } from './types/stage-a.js';

// Stage A scoring engine
export { scoreStageA } from './engine/stage-a.js';
export type { StageAConfig } from './engine/stage-a.js';

// Industry benchmarks
export {
  DEFAULT_INDUSTRY_BENCHMARKS,
  findIndustryBenchmark,
} from './config/benchmarks.js';
export type { IndustryBenchmark } from './config/benchmarks.js';

// Stage B types
export type {
  QuarterlyPoint,
  AnnualPoint,
  ShareholdingPoint,
  TrendClassification,
  StageBInput,
  StageBRuleResult,
  StageBOutput,
  StageBVerdictBand,
} from './types/stage-b.js';

// Stage B scoring engine & trend classifiers
export { scoreStageB } from './engine/stage-b.js';
export type { StageBConfig } from './engine/stage-b.js';
export {
  classifyQuarterlySalesYoY,
  classifyQuarterlyOpmYoY,
  classifyAnnual5YSeries,
  classifyNetProfitAndMargin,
  classifyReservesVsBorrowings,
  classifyCfoTrend,
  classifyDebtorDays,
  classifyRoceTrend,
  classifyShareholdingPattern,
} from './engine/trend-classifier.js';
export type {
  TrendAnalysisResult,
  ShareholdingAnalysisResult,
} from './engine/trend-classifier.js';

// Stage C types
export type {
  BusinessModelCategory,
  MoatType,
  StageCVerdictBand,
  EvidenceItem,
  BusinessModelAnswer,
  MoatTestResult,
  StageCRuleResult,
  StageCInput,
  StageCOutput,
} from './types/stage-c.js';

// Stage C scoring engine
export {
  scoreStageC,
  assessStageC,
  CATEGORY_RELEVANT_METRICS,
  MOAT_TYPE_DESCRIPTIONS,
} from './engine/stage-c.js';
export type { StageCConfig } from './engine/stage-c.js';

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

// Stage D valuation engine
export {
  scoreStageD,
  valueStageD,
  evaluateStageD,
  calculatePeValuation,
  calculatePegValuation,
  calculatePbValuation,
  calculateDcfValuation,
  selectPrimaryValuationMethod,
  DCF_EDUCATIONAL_LABEL,
} from './engine/stage-d.js';
export type { StageDConfig } from './engine/stage-d.js';

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

// Stage E technical analysis engine & indicators
export {
  scoreStageE,
  analyzeStageE,
  evaluateStageE,
} from './engine/stage-e.js';
export type { StageEConfig } from './engine/stage-e.js';
export {
  calculateSma,
  calculateAtr,
  calculateAvgVolume,
  findKeyLevels,
  analyzeTechnicalContext,
} from './engine/technical-indicators.js';
export {
  detectBullishEngulfing,
  detectHammer,
  detectInvertedHammer,
  detectMorningStar,
  detectDragonflyDoji,
  detectThreeWhiteSoldiers,
  detectBearishEngulfing,
  detectEveningStar,
  detectShootingStar,
  detectAllCandlestickPatterns,
} from './engine/candlestick-patterns.js';

// Stage F types
export type {
  Position,
  PortfolioSnapshot,
  RiskCheckType,
  RiskCheckResult,
  OverrideRecord,
  TradePlanStatus,
  TradePlan,
  PositionSizingResult,
  StageFInput,
  StageFOutput,
} from './types/stage-f.js';

// Stage F buy plan & portfolio risk engine
export {
  scoreStageF,
  planStageF,
  evaluateStageF,
  buildTradePlan,
  calculatePositionSizing,
  evaluateRiskChecks,
  DISCLAIMER_STOP_LOSS_NON_GUARANTEE,
  DEFAULT_RULE_SET_VERSION as STAGE_F_DEFAULT_RULE_SET_VERSION,
  DEFAULT_RISK_PER_TRADE_PCT,
  DEFAULT_MAX_STOCK_EXPOSURE_PCT,
  DEFAULT_MAX_SECTOR_EXPOSURE_PCT,
  DEFAULT_MIN_RISK_REWARD as STAGE_F_DEFAULT_MIN_RISK_REWARD,
  DEFAULT_MAX_POSITION_PCT_OF_ADV,
  DEFAULT_LOT_SIZE,
  MIN_OVERRIDE_REASON_LENGTH,
} from './engine/stage-f.js';
export type {
  StageFConfig,
  CalculatePositionSizingParams,
  EvaluateRiskChecksParams,
  RiskChecksEvaluationResult,
} from './engine/stage-f.js';

// Stage G types
export type {
  AlertType,
  AlertSeverity,
  Alert,
  WorkflowAction,
  SellDecision,
  TradeAction,
  CorporateAction,
  PostTradeReview,
  JournalEntry,
  PositionWithThesis,
  PositionPnLResult,
  SellDecisionRecommendation,
  StageGInput,
  StageGOutput,
} from './types/stage-g.js';

// Stage G monitoring & exit engine
export {
  scoreStageG,
  evaluateStageG,
  monitorStageG,
  monitorPosition,
  calculatePositionPnL,
  evaluateAlerts,
  evaluateSellDecision,
  validateJournalEntryImmutability,
  validatePostTradeReview,
  DEFAULT_STAGE_G_RULE_SET_VERSION,
  DEFAULT_OVERVALUATION_THRESHOLD_PCT,
  DEFAULT_PORTFOLIO_DRAWDOWN_LIMIT_PCT,
  DEFAULT_CASH_BUFFER_MIN_PCT,
  DEFAULT_TRIM_PERCENTAGE,
  DISCLAIMER_MANUAL_EXECUTION_ONLY,
} from './engine/stage-g.js';
export type {
  StageGConfig,
  EvaluateAlertsParams,
  EvaluateSellDecisionParams,
  PositionMonitoringResult,
} from './engine/stage-g.js';

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
