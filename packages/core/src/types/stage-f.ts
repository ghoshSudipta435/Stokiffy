/**
 * Stage F — Trade Plan domain types.
 * Mirrors DOMAIN_MODEL_SPEC.md Section 4.6.
 */

import type { ISODateString } from './base.js';

export interface Position {
  symbol: string;
  companyId: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  sector: string;
  unrealisedPnl: number;
  unrealisedPnlPct: number;
}

export interface PortfolioSnapshot {
  totalValue: number;
  cash: number;
  positions: Position[];
  sectorExposure: Record<string, number>;
  asOfDate: ISODateString;
}

export type RiskCheckType =
  | 'risk_budget'
  | 'stock_concentration'
  | 'sector_concentration'
  | 'liquidity'
  | 'cash'
  | 'risk_reward'
  | 'stop_below_entry';

export interface RiskCheckResult {
  check: RiskCheckType;
  passed: boolean;
  actualValue: number;
  limit: number;
  message: string;
}

export interface OverrideRecord {
  flagId: string;
  reason: string;
  overriddenBy: string;
  overriddenAt: ISODateString;
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
}

export type TradePlanStatus = 'draft' | 'ready' | 'executed' | 'cancelled' | 'expired';

export interface TradePlan {
  id: string;
  companyId: string;
  symbol: string;
  thesis: string;
  expectedHoldingPeriod: string;
  entryRationale: string;
  entryZone: { low: number; high: number };
  stopLoss: number;
  targets: number[];
  positionSize: number;
  entryPriceEst: number;
  riskBudget: number;
  plannedLossAtStop: number;
  portfolioExposurePct: number;
  sectorExposurePct: number;
  cashRemaining: number;
  riskChecks: RiskCheckResult[];
  blocked: boolean;
  overrides: OverrideRecord[];
  status: TradePlanStatus;
  ruleSetVersion: string;
  valuationMaxBuyPrice: number;
  technicalSetupId: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdBy: string;
  executedAt?: ISODateString;
  executedPrice?: number;
  executedQuantity?: number;
}

export interface StageFInput {
  companyId: string;
  tradePlanDraft: Partial<TradePlan>;
  portfolio: PortfolioSnapshot;
  riskConfig: {
    riskPerTradePct: number;
    maxStockExposurePct: number;
    maxSectorExposurePct: number;
    minRiskReward: number;
    maxPositionPctOfADV: number;
  };
  valuationMaxBuyPrice: number;
  technicalSetup: {
    pattern: {
      name: string;
      detectedAt: ISODateString;
      timeframe: 'daily' | 'weekly';
      candles: any[];
      confirmation: boolean;
      context: any;
      qualityScore: number;
    };
    entryZone: { low: number; high: number };
    invalidationLevel: number;
    stopLoss: number;
    targets: number[];
    riskReward: number;
    inBuyZone: boolean;
    contextScore: number;
  };
}

export interface StageFOutput {
  stage: 'F';
  tradePlan: TradePlan;
  riskChecks: RiskCheckResult[];
  blocked: boolean;
  calculatedAt: ISODateString;
  ruleSetVersion: string;
}
