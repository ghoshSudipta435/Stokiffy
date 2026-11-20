/**
 * Stage G — Monitoring & Exit domain types.
 * Mirrors DOMAIN_MODEL_SPEC.md Section 4.7.
 */

import type { ISODateString } from './base.js';
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
  companyId?: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  triggeredAt: ISODateString;
  acknowledgedAt?: ISODateString;
  acknowledgedBy?: string;
  data: Record<string, unknown>;
  relatedTradePlanId?: string;
}

export interface SellDecision {
  id: string;
  companyId: string;
  tradePlanId: string;
  trigger: AlertType;
  decision: 'sell' | 'trim' | 'hold';
  reason: string;
  quantity?: number;
  price?: number;
  decidedAt: ISODateString;
  decidedBy: string;
  originalThesisSnapshot: string;
  portfolioSnapshot: PortfolioSnapshot;
}

export type TradeAction = 'buy' | 'trim' | 'sell';

export interface CorporateAction {
  type: 'dividend' | 'split' | 'bonus' | 'rights' | 'buyback';
  date: ISODateString;
  ratio?: string;
  amount?: number;
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
  date: ISODateString;
  action: TradeAction;
  quantity: number;
  price: number;
  fees: number;
  taxes: number;
  reason: string;
  ruleTriggers: string[];
  portfolioContext: PortfolioSnapshot;
  realisedPnl?: number;
  unrealisedPnl?: number;
  returnPct?: number;
  corporateActions: CorporateAction[];
  review?: PostTradeReview;
}

export interface PositionWithThesis extends Position {
  thesis: string;
  stopLoss: number;
  targets: number[];
  entryDate: ISODateString;
  daysHeld: number;
  unrealisedReturnPct: number;
  alertCount: number;
}

export interface StageGInput {
  portfolio: PortfolioSnapshot;
  alerts: Alert[];
  openPositions: PositionWithThesis[];
  tradeHistory: JournalEntry[];
}
export interface StageGOutput {
  stage: 'G';
  activeAlerts: Alert[];
  pendingReviews: SellDecision[];
  journalEntries: JournalEntry[];
  portfolioHealth: {
    concentrationOk: boolean;
    drawdownOk: boolean;
    cashBufferOk: boolean;
    correlationRisk: 'low' | 'medium' | 'high';
  };
  calculatedAt: ISODateString;
}
