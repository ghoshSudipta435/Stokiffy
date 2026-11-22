/**
 * @stock-assistant/contracts — Public exports
 *
 * Shared Zod validation schemas, DTOs, and API contracts.
 * Independent of frontend and database implementations.
 */

// Enums
export {
  SectorSchema,
  StageVerdictSchema,
  FlagClassSchema,
  FlagSeveritySchema,
  FlagStatusSchema,
  PeriodTypeSchema,
  DataQualitySchema,
  AdjustmentStatusSchema,
  ValuationMethodSchema,
  TradePlanStatusSchema,
  AlertSeveritySchema,
  CorporateActionTypeSchema,
  enumSchemas,
} from './enums/index.js';
export type {
  Sector,
  StageVerdict,
  FlagClass,
  FlagSeverity,
  FlagStatus,
  PeriodType,
  DataQuality,
  AdjustmentStatus,
  ValuationMethod,
  TradePlanStatus,
  AlertSeverity,
  CorporateActionType,
} from './enums/index.js';

// Models
export {
  CompanyIdSchema,
  UserIdSchema,
  SymbolSchema,
  ISINSchema,
  CUID2Schema,
  CurrencySchema,
  UnitSchema,
  DataProvenanceSchema,
  FinancialLineItemSchema,
  CompanySchema,
  FinancialStatementSchema,
  PriceBarSchema,
  CorporateActionSchema,
  ShareholdingPointSchema,
  RedFlagSchema,
} from './models/index.js';
export type {
  DataProvenance,
  FinancialLineItem,
  Company,
  FinancialStatement,
  PriceBar,
  CorporateAction,
  ShareholdingPoint,
  RedFlag,
} from './models/index.js';

// API common
export {
  RequestMetaSchema,
  ErrorDetailSchema,
  ErrorBodySchema,
  ApiResponseSchema,
  ErrorResponseSchema,
  PaginationQuerySchema,
  PaginatedApiResponseSchema,
  HttpErrorCode,
} from './api/common.js';
export type {
  RequestMeta,
  ErrorDetail,
  ErrorBody,
  ApiResponse,
  ErrorResponse,
  PaginationQuery,
  PaginatedApiResponse,
} from './api/common.js';

// API companies
export {
  ListCompaniesQuerySchema,
  CompanyResponseSchema,
  ListCompaniesResponseSchema,
  CompanyFinancialsResponseSchema,
  CompanyPricesResponseSchema,
  CompanyShareholdingResponseSchema,
} from './api/companies.js';
export type {
  ListCompaniesQuery,
  CompanyResponse,
  ListCompaniesResponse,
  CompanyFinancialsResponse,
  CompanyPricesResponse,
  CompanyShareholdingResponse,
} from './api/companies.js';

// API analyses
export {
  RunStageARequestSchema,
  RunStageBRequestSchema,
  FlagOverrideRequestSchema,
  FlagAcknowledgeRequestSchema,
  AnalysisRunResponseSchema,
  // Stage A contracts
  FinancialMetricSchema,
  StageAFinancialsSchema,
  StageADataAvailabilitySchema,
  StageAInputSchema,
  StageAOutputSchema,
  StageAExecutionStatusSchema,
} from './api/analyses.js';
export type {
  RunStageARequest,
  RunStageBRequest,
  FlagOverrideRequest,
  FlagAcknowledgeRequest,
  AnalysisRunResponse,
  // Stage A types
  FinancialMetric,
  StageAFinancials,
  StageADataAvailability,
  StageAInput,
  StageAOutput,
  StageAExecutionStatus,
} from './api/analyses.js';

// API watchlists
export {
  WatchlistItemSchema,
  WatchlistSchema,
  CreateWatchlistRequestSchema,
  UpdateWatchlistRequestSchema,
  AddWatchlistItemRequestSchema,
  UpdateWatchlistItemRequestSchema,
  WatchlistResponseSchema,
  ListWatchlistsResponseSchema,
  WatchlistItemResponseSchema,
  WatchlistComparisonItemSchema,
  WatchlistComparisonResponseSchema,
} from './api/watchlists.js';
export type {
  WatchlistItem,
  Watchlist,
  CreateWatchlistRequest,
  UpdateWatchlistRequest,
  AddWatchlistItemRequest,
  UpdateWatchlistItemRequest,
  WatchlistResponse,
  ListWatchlistsResponse,
  WatchlistItemResponse,
  WatchlistComparisonItem,
  WatchlistComparisonResponse,
} from './api/watchlists.js';

// API rule sets & benchmarks
export {
  IndustryBenchmarkSchema,
  RiskLimitsSchema,
  RuleSetSchema,
  UpsertRuleSetDraftRequestSchema,
  PublishRuleSetRequestSchema,
  BenchmarkItemInputSchema,
  UpdateBenchmarksRequestSchema,
  UpdateRiskLimitsRequestSchema,
  RuleSetResponseSchema,
  ListRuleSetsResponseSchema,
  BenchmarksResponseSchema,
} from './api/rule-sets.js';
export type {
  IndustryBenchmark,
  RiskLimits,
  RuleSet,
  UpsertRuleSetDraftRequest,
  PublishRuleSetRequest,
  BenchmarkItemInput,
  UpdateBenchmarksRequest,
  UpdateRiskLimitsRequest,
  RuleSetResponse,
  ListRuleSetsResponse,
  BenchmarksResponse,
} from './api/rule-sets.js';

// API trade plans & Stage F
export {
  RiskCheckTypeSchema,
  RiskCheckResultSchema,
  OverrideRecordSchema,
  PositionSizingResultSchema,
  TradePlanFullSchema,
  CreateTradePlanRequestSchema,
  UpdateTradePlanRequestSchema,
  TradePlanOverrideRequestSchema,
  StageFInputSchema,
  StageFOutputSchema,
  TradePlanResponseSchema,
  StageFResponseSchema,
  ListTradePlansResponseSchema,
} from './api/trade-plans.js';
export type {
  RiskCheckType,
  RiskCheckResult,
  OverrideRecord,
  PositionSizingResult,
  TradePlanFull,
  CreateTradePlanRequest,
  UpdateTradePlanRequest,
  TradePlanOverrideRequest,
  StageFInput,
  StageFOutput,
  TradePlanResponse,
  StageFResponse,
  ListTradePlansResponse,
} from './api/trade-plans.js';

// API portfolio
export {
  PortfolioSummaryResponseSchema,
  PositionResponseSchema,
  TransactionRequestSchema,
} from './api/portfolio.js';
export type {
  PortfolioSummaryResponse,
  PositionResponse,
  TransactionRequest,
} from './api/portfolio.js';

// API valuations & Stage D
export {
  StageDFinancialsSchema,
  ValuationMethodResultSchema,
  StageDInputSchema,
  ValuationRequestSchema,
  StageDOutputSchema,
  StageDResponseSchema,
  ValuationResponseSchema,
} from './api/valuations.js';
export type {
  StageDFinancials,
  ValuationMethodResult,
  StageDInput,
  ValuationRequest,
  StageDOutput,
  StageDResponse,
  ValuationResponse,
} from './api/valuations.js';

// API monitoring & Stage G
export {
  AlertTypeSchema,
  AlertSchema,
  AcknowledgeAlertRequestSchema,
  ListAlertsQuerySchema,
  CorporateActionRecordSchema,
  PostTradeReviewSchema,
  JournalEntrySchema,
  CreateJournalEntryRequestSchema,
  AppendJournalReviewRequestSchema,
  SellDecisionSchema,
  StageGInputSchema,
  StageGOutputSchema,
  AlertResponseSchema,
  AlertsResponseSchema,
  JournalEntryResponseSchema,
  JournalEntriesResponseSchema,
  StageGResponseSchema,
} from './api/monitoring.js';
export type {
  AlertType,
  Alert,
  AcknowledgeAlertRequest,
  ListAlertsQuery,
  CorporateActionRecord,
  PostTradeReview,
  JournalEntry,
  CreateJournalEntryRequest,
  AppendJournalReviewRequest,
  SellDecision,
  StageGInput,
  StageGOutput,
  AlertResponse,
  AlertsResponse,
  JournalEntryResponse,
  JournalEntriesResponse,
  StageGResponse,
} from './api/monitoring.js';

// API ingestion
export {
  IngestionJobStatusSchema,
  IngestionFailureCategorySchema,
  RowValidationErrorSchema,
  IngestionProgressSchema,
  CreateIngestionJobInputSchema,
  IngestionJobUploadResponseSchema,
  IngestionJobResponseSchema,
  IngestionProgressUpdateSchema,
  IngestionCompletionPayloadSchema,
  IngestionFailureRetryPayloadSchema,
  IngestionClaimLeasePayloadSchema,
  IngestionLeaseRenewPayloadSchema,
} from './api/ingestion.js';
export type {
  IngestionJobStatus,
  IngestionFailureCategory,
  RowValidationError,
  IngestionProgress,
  CreateIngestionJobInput,
  IngestionJobUploadResponse,
  IngestionJobResponse,
  IngestionProgressUpdate,
  IngestionCompletionPayload,
  IngestionFailureRetryPayload,
  IngestionClaimLeasePayload,
  IngestionLeaseRenewPayload,
} from './api/ingestion.js';
