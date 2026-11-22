/**
 * Stage G — Monitoring & Exit domain types.
 * Mirrors DOMAIN_MODEL_SPEC.md Section 4.7.
 */

import type { DataProvenance, ISODateString, RedFlag } from './base.js';
import type { ScoringRuleResult, StageScore } from './scoring.js';
import type { PortfolioSnapshot, Position } from './stage-f.js';

export type AlertType =
  | 'price-entry-zone'
  | 'price-target'
  | 'price-stop'
  | 'price-fair-value'
  | 'price-overvalued'
  | 'fundamental-results'
  | 'fundamental-deterioration'
  | 'fundamental-governance'
  | 'thesis-broken'
  | 'thesis-risk'
  | 'portfolio-concentration'
  | 'portfolio-drawdown'
  | 'portfolio-correlation';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  companyId?: string | undefined;
  symbol?: string | undefined;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  triggeredAt: ISODateString;
  acknowledgedAt?: ISODateString | undefined;
  acknowledgedBy?: string | undefined;
  data: Record<string, unknown>;
  relatedTradePlanId?: string | undefined;
}

export type WorkflowAction = 'HOLD' | 'REVIEW_REQUIRED' | 'TRIM_CANDIDATE' | 'EXIT_CANDIDATE';

export interface SellDecision {
  id: string;
  companyId: string;
  symbol?: string | undefined;
  tradePlanId: string;
  trigger: AlertType;
  decision: 'sell' | 'trim' | 'hold';
  recommendedAction?: WorkflowAction | undefined;
  reason: string;
  quantity?: number | undefined;
  price?: number | undefined;
  decidedAt: ISODateString;
  decidedBy: string;
  originalThesisSnapshot: string;
  portfolioSnapshot: PortfolioSnapshot;
}

export type TradeAction = 'buy' | 'trim' | 'sell';

export interface CorporateAction {
  type: 'dividend' | 'split' | 'bonus' | 'rights' | 'buyback';
  date: ISODateString;
  ratio?: string | undefined;
  amount?: number | undefined;
}

export interface PostTradeReview {
  rulesWorked: string[];
  assumptionsFailed: string[];
  executionQuality: 'good' | 'fair' | 'poor';
  slippage: number;
  behaviouralNotes: string;
  lesson: string;
  reviewedAt: ISODateString;
  reviewedBy: string;
}

export interface JournalEntry {
  id: string;
  tradePlanId: string;
  symbol?: string | undefined;
  companyId?: string | undefined;
  date: ISODateString;
  action: TradeAction;
  quantity: number;
  price: number;
  fees: number;
  taxes: number;
  reason: string;
  ruleTriggers: string[];
  portfolioContext: PortfolioSnapshot;
  realisedPnl?: number | undefined;
  unrealisedPnl?: number | undefined;
  returnPct?: number | undefined;
  corporateActions: CorporateAction[];
  review?: PostTradeReview | undefined;
}

export interface PositionWithThesis extends Position {
  thesis: string;
  stopLoss: number;
  targets: number[];
  entryDate: ISODateString;
  daysHeld: number;
  unrealisedReturnPct: number;
  alertCount: number;
  fairValue?: number | undefined;
  maxBuyPrice?: number | undefined;
  tradePlanId?: string | undefined;
  thesisStatus?: 'intact' | 'weakened' | 'broken' | undefined;
  brokenAssumptions?: string[] | undefined;
}

export interface PositionPnLResult {
  symbol: string;
  companyId?: string | undefined;
  totalQuantity: number;
  totalInvestedCapital: number;
  weightedAvgCostBasis: number;
  currentPrice: number;
  currentMarketValue: number;
  realisedPnl: number;
  unrealisedPnl: number;
  totalFees: number;
  totalTaxes: number;
  totalDividends: number;
  netPnl: number;
  netReturnPct: number;
  tradeCount: number;
  isClosed: boolean;
  violations?: string[] | undefined;
}

export interface SellDecisionRecommendation {
  decision: 'sell' | 'trim' | 'hold';
  recommendedAction: WorkflowAction;
  trigger: AlertType;
  reason: string;
  suggestedQuantity?: number | undefined;
  suggestedPrice?: number | undefined;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  requiresManualConfirmation: true;
}

export interface StageGInput {
  portfolio: PortfolioSnapshot;
  alerts?: Alert[] | undefined;
  openPositions?: PositionWithThesis[] | undefined;
  tradeHistory?: JournalEntry[] | undefined;
  currentPrices?: Record<string, number> | undefined;
  drawdownLimitPct?: number | undefined;
  cashBufferMinPct?: number | undefined;
  maxStockExposurePct?: number | undefined;
  maxSectorExposurePct?: number | undefined;
  asOfDate?: ISODateString | undefined;
  dataSnapshotId?: string | undefined;
  dataProvenance?: DataProvenance | undefined;
}

export interface StageGOutput extends StageScore {
  stage: 'G';
  activeAlerts: Alert[];
  pendingReviews: SellDecision[];
  journalEntries: JournalEntry[];
  portfolioHealth: {
    concentrationOk: boolean;
    drawdownOk: boolean;
    cashBufferOk: boolean;
    correlationRisk: 'low' | 'medium' | 'high';
    currentDrawdownPct: number;
    cashPct: number;
  };
  openPositions: PositionWithThesis[];
  pnlSummary?: Record<string, PositionPnLResult> | undefined;
  calculatedAt: ISODateString;
  ruleSetVersion: string;
  flags: RedFlag[];
  ruleResults: ScoringRuleResult[];
}
