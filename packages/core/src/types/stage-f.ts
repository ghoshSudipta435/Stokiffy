/**
 * Stage F — Trade Plan domain types.
 * Mirrors DOMAIN_MODEL_SPEC.md Section 4.6.
 */

import type { DataProvenance, ISODateString, RedFlag } from './base.js';
import type { ScoringRuleResult, StageScore } from './scoring.js';

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
  executedAt?: ISODateString | undefined;
  executedPrice?: number | undefined;
  executedQuantity?: number | undefined;
}

export interface StageFInput {
  companyId: string;
  symbol?: string | undefined;
  sector?: string | undefined;
  tradePlanDraft?: Partial<TradePlan> | undefined;
  portfolio: PortfolioSnapshot;
  riskConfig?: {
    riskPerTradePct?: number | undefined;
    maxStockExposurePct?: number | undefined;
    maxSectorExposurePct?: number | undefined;
    minRiskReward?: number | undefined;
    maxPositionPctOfADV?: number | undefined;
    lotSize?: number | undefined;
    cashBufferPct?: number | undefined;
    estimatedFeesPct?: number | undefined;
    slippagePct?: number | undefined;
  } | undefined;
  valuationMaxBuyPrice?: number | undefined;
  technicalSetup?: {
    id?: string | undefined;
    pattern?: {
      name: string;
      detectedAt: ISODateString;
      timeframe: 'daily' | 'weekly';
      candles?: any[] | undefined;
      confirmation: boolean;
      context?: any | undefined;
      qualityScore?: number | undefined;
    } | undefined;
    entryZone: { low: number; high: number };
    invalidationLevel?: number | undefined;
    stopLoss: number;
    targets: number[];
    riskReward?: number | undefined;
    inBuyZone?: boolean | undefined;
    contextScore?: number | undefined;
  } | undefined;
  avgDailyVolume?: number | undefined;
  requestedQuantity?: number | undefined;
  overrides?: OverrideRecord[] | undefined;
  asOfDate?: ISODateString | undefined;
  dataSnapshotId?: string | undefined;
  createdBy?: string | undefined;
  dataProvenance?: DataProvenance | undefined;
}

export interface PositionSizingResult {
  rawQuantity: number;
  adjustedQuantity: number;
  positionSize: number;
  entryPriceEst: number;
  riskBudget: number;
  riskPerShare: number;
  plannedPositionValue: number;
  plannedLossAtStop: number;
  actualRiskPct: number;
  postTradeStockExposurePct: number;
  postTradeSectorExposurePct: number;
  cashRemaining: number;
  estimatedFees: number;
  limitingFactor: 'risk_budget' | 'lot_size' | 'liquidity' | 'cash' | 'stock_cap' | 'sector_cap' | 'requested_quantity' | 'invalid_inputs';
}

export interface StageFOutput extends StageScore {
  stage: 'F';
  companyId?: string | undefined;
  symbol?: string | undefined;
  tradePlan: TradePlan;
  positionSizing: PositionSizingResult;
  riskChecks: RiskCheckResult[];
  blocked: boolean;
  gatePassed: boolean;
  canProceedToStageG: boolean;
  canApprovePlan: boolean;
  disclaimer: string;
  flags: RedFlag[];
  ruleResults: ScoringRuleResult[];
}
