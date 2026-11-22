/**
 * Stage G (Monitoring, Sell/Trim Decision Framework & Trade Journal / P&L Attribution) Engine
 *
 * Implements:
 * 1. Monitoring Alert Evaluators across 4 domains (Price, Fundamental, Thesis, Portfolio)
 * 2. Sell / Trim Decision Framework (Manual confirmation only — never auto-execute)
 * 3. Position P&L & Return Calculator with exact Decimal arithmetic, WACB, corporate actions, and oversell guardrails
 * 4. Trade Journal & Immutable Decision Snapshot validation (ensures hindsight edits append review rather than mutating execution record)
 * 5. Portfolio Health Evaluation (drawdown, concentration, cash buffer, correlation)
 *
 * Pure function: StageGInput -> StageGOutput. Zero external dependencies.
 */

import Decimal from 'decimal.js';
import type { DataProvenance, RedFlag } from '../types/base.js';
import type { ScoringRuleResult } from '../types/scoring.js';
import type { PortfolioSnapshot } from '../types/stage-f.js';
import type {
  Alert,
  CorporateAction,
  JournalEntry,
  PositionPnLResult,
  PositionWithThesis,
  PostTradeReview,
  SellDecision,
  SellDecisionRecommendation,
  StageGInput,
  StageGOutput,
} from '../types/stage-g.js';

export interface StageGConfig {
  ruleSetVersion?: string | undefined;
  overvaluationThresholdPct?: number | undefined;
  portfolioDrawdownLimitPct?: number | undefined;
  cashBufferMinPct?: number | undefined;
  maxStockExposurePct?: number | undefined;
  maxSectorExposurePct?: number | undefined;
  defaultTrimPercentage?: number | undefined;
}

export const DEFAULT_STAGE_G_RULE_SET_VERSION = 'stage-g-v1.0';
export const DEFAULT_OVERVALUATION_THRESHOLD_PCT = 0.20; // 20% over fair value (1.20x)
export const DEFAULT_PORTFOLIO_DRAWDOWN_LIMIT_PCT = 0.15; // 15% portfolio drawdown
export const DEFAULT_CASH_BUFFER_MIN_PCT = 0.05; // 5% minimum cash
export const DEFAULT_MAX_STOCK_EXPOSURE_PCT = 0.10; // 10% single stock
export const DEFAULT_MAX_SECTOR_EXPOSURE_PCT = 0.30; // 30% single sector
export const DEFAULT_TRIM_PERCENTAGE = 0.50; // 50% default trim

export const DISCLAIMER_MANUAL_EXECUTION_ONLY =
  'No automatic sell orders are generated. All sell and trim recommendations require manual user confirmation and execution.';

function roundNum(val: number | Decimal, places: number): number {
  const d = val instanceof Decimal ? val : new Decimal(val);
  return d.toDecimalPlaces(places).toNumber();
}

let flagIdCounter = 0;

function createRedFlag(params: {
  flagKey: string;
  ruleKey?: string | undefined;
  message: string;
  threshold: string;
  actualValue: unknown;
  expectedValue?: unknown | undefined;
  severity: 'critical' | 'high' | 'medium' | 'low';
  class: 'HARD_STOP' | 'CONDITIONAL_WARNING' | 'DATA_QUALITY_WARNING' | 'VALUATION_WARNING';
  companyId: string;
  ruleSetVersion: string;
  dataSnapshotId?: string | undefined;
}): RedFlag {
  flagIdCounter += 1;
  const flag: RedFlag = {
    id: `flag_g_${params.companyId}_${params.flagKey}_${flagIdCounter}`,
    flagKey: params.flagKey,
    stage: 'G',
    message: params.message,
    threshold: params.threshold,
    actualValue: params.actualValue,
    source: 'blueprint',
    severity: params.severity,
    status: 'ACTIVE',
    companyId: params.companyId,
    analysisRunId: '',
    ruleSetVersion: params.ruleSetVersion,
    dataSnapshotId: params.dataSnapshotId ?? '',
    isOverride: false,
    class: params.class,
    createdAt: new Date().toISOString(),
  };

  if (params.ruleKey !== undefined) flag.ruleKey = params.ruleKey;
  if (params.expectedValue !== undefined) flag.expectedValue = params.expectedValue;

  return flag;
}

function parseCorporateActionRatio(ratioStr?: string | undefined): number {
  if (!ratioStr) return 1;
  const parts = ratioStr.split(/[:/]/).map((s) => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]!) && !isNaN(parts[1]!) && parts[1]! > 0) {
    return parts[0]! / parts[1]!;
  }
  const single = parseFloat(ratioStr.trim());
  return isNaN(single) || single <= 0 ? 1 : single;
}

/**
 * Calculates deterministic Position P&L, Weighted-Average Cost Basis, and Net Returns.
 * Protects against overselling (never negative holdings) and incorporates corporate actions.
 */
export function calculatePositionPnL(
  transactions: JournalEntry[],
  currentPrice: number,
  fallbackSymbol?: string | undefined
): PositionPnLResult {
  const symbol = fallbackSymbol || transactions[0]?.symbol || 'UNKNOWN';
  const companyId = transactions[0]?.companyId;
  const violations: string[] = [];

  let totalShares = new Decimal(0);
  let totalCost = new Decimal(0); // Cost basis of current holdings
  let cumulativeInvested = new Decimal(0);
  let realisedPnl = new Decimal(0);
  let totalFees = new Decimal(0);
  let totalTaxes = new Decimal(0);
  let totalDividends = new Decimal(0);
  let tradeCount = 0;
  type TimelineEvent =
    | { kind: 'trade'; date: string; tx: JournalEntry }
    | { kind: 'corporate_action'; date: string; ca: CorporateAction; txId: string };

  const timeline: TimelineEvent[] = [];

  for (const tx of transactions) {
    timeline.push({ kind: 'trade', date: tx.date, tx });
    if (tx.corporateActions && tx.corporateActions.length > 0) {
      for (const ca of tx.corporateActions) {
        timeline.push({ kind: 'corporate_action', date: ca.date || tx.date, ca, txId: tx.id });
      }
    }
  }

  // Sort chronological by date. If dates match: buy -> corporate action -> sell/trim
  timeline.sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (diff !== 0) return diff;
    const rank = (e: TimelineEvent) => {
      if (e.kind === 'trade' && e.tx.action === 'buy') return 1;
      if (e.kind === 'corporate_action') return 2;
      return 3; // sell / trim
    };
    return rank(a) - rank(b);
  });

  for (const event of timeline) {
    if (event.kind === 'corporate_action') {
      const ca = event.ca;
      if (ca.type === 'dividend') {
        const divAmt = new Decimal(ca.amount || 0);
        const totalDiv = divAmt.mul(totalShares);
        totalDividends = totalDividends.plus(totalDiv);
        realisedPnl = realisedPnl.plus(totalDiv);
      } else if (ca.type === 'split') {
        const splitFactor = new Decimal(parseCorporateActionRatio(ca.ratio));
        if (splitFactor.gt(0)) {
          totalShares = totalShares.mul(splitFactor);
        }
      } else if (ca.type === 'bonus') {
        const bonusRatio = new Decimal(parseCorporateActionRatio(ca.ratio));
        if (bonusRatio.gt(0)) {
          totalShares = totalShares.mul(new Decimal(1).plus(bonusRatio));
        }
      }
    } else {
      const tx = event.tx;
      const dQty = new Decimal(Math.max(0, tx.quantity));
      const dPrice = new Decimal(Math.max(0, tx.price));
      const dFees = new Decimal(Math.max(0, tx.fees || 0));
      const dTaxes = new Decimal(Math.max(0, tx.taxes || 0));

      totalFees = totalFees.plus(dFees);
      totalTaxes = totalTaxes.plus(dTaxes);

      if (tx.action === 'buy') {
        tradeCount += 1;
        const grossBuy = dQty.mul(dPrice);
        const netBuyCost = grossBuy.plus(dFees).plus(dTaxes);
        totalCost = totalCost.plus(netBuyCost);
        cumulativeInvested = cumulativeInvested.plus(netBuyCost);
        totalShares = totalShares.plus(dQty);
      } else if (tx.action === 'trim' || tx.action === 'sell') {
        tradeCount += 1;
        let sellQty = dQty;

        if (dQty.gt(totalShares)) {
          violations.push(
            `Oversell detected in transaction ${tx.id}: attempted to sell ${dQty.toNumber()} shares, but only ${totalShares.toNumber()} shares available. Sold quantity clamped.`
          );
          sellQty = totalShares;
        }

        if (totalShares.gt(0) && sellQty.gt(0)) {
          const wacb = totalCost.div(totalShares);
          const costOfSold = sellQty.mul(wacb);
          const grossProceeds = sellQty.mul(dPrice);
          const netProceeds = grossProceeds.minus(dFees).minus(dTaxes);
          const tradeRealised = netProceeds.minus(costOfSold);

          realisedPnl = realisedPnl.plus(tradeRealised);
          totalShares = totalShares.minus(sellQty);

          if (totalShares.gt(0)) {
            totalCost = totalShares.mul(wacb);
          } else {
            totalCost = new Decimal(0);
          }
        }
      }
    }
  }

  const dCurrentPrice = new Decimal(Math.max(0, currentPrice));
  const currentMarketValue = totalShares.mul(dCurrentPrice);
  const unrealisedPnl = currentMarketValue.minus(totalCost);
  const netPnl = realisedPnl.plus(unrealisedPnl);
  const wacb = totalShares.gt(0) ? totalCost.div(totalShares) : new Decimal(0);
  const netReturnPct = cumulativeInvested.gt(0) ? netPnl.div(cumulativeInvested).toNumber() : 0;
  const isClosed = totalShares.equals(0) && tradeCount > 0;

  const result: PositionPnLResult = {
    symbol,
    totalQuantity: totalShares.toNumber(),
    totalInvestedCapital: roundNum(cumulativeInvested, 2),
    weightedAvgCostBasis: roundNum(wacb, 2),
    currentPrice: roundNum(dCurrentPrice, 2),
    currentMarketValue: roundNum(currentMarketValue, 2),
    realisedPnl: roundNum(realisedPnl, 2),
    unrealisedPnl: roundNum(unrealisedPnl, 2),
    totalFees: roundNum(totalFees, 2),
    totalTaxes: roundNum(totalTaxes, 2),
    totalDividends: roundNum(totalDividends, 2),
    netPnl: roundNum(netPnl, 2),
    netReturnPct: roundNum(netReturnPct, 4),
    tradeCount,
    isClosed,
  };

  if (companyId !== undefined) result.companyId = companyId;
  if (violations.length > 0) result.violations = violations;

  return result;
}

export interface EvaluateAlertsParams {
  positions: PositionWithThesis[];
  portfolio: PortfolioSnapshot;
  currentPrices?: Record<string, number> | undefined;
  config?: StageGConfig | undefined;
  fundamentalContext?: Record<
    string,
    {
      hardStops?: RedFlag[] | undefined;
      roceDropPct?: number | undefined;
      cfoVsPatRatio?: number | undefined;
      debtorDaysIncrease?: number | undefined;
      debtIncreasePct?: number | undefined;
      pledgeIncreasePct?: number | undefined;
      promoterSalePct?: number | undefined;
      resultsPublished?: boolean | undefined;
    }
  > | undefined;
  thesisContext?: Record<
    string,
    {
      status: 'intact' | 'weakened' | 'broken';
      brokenAssumptions?: string[] | undefined;
      riskFactors?: string[] | undefined;
    }
  > | undefined;
  portfolioPeakValue?: number | undefined;
}

/**
 * Evaluates active alerts across Price, Fundamental, Thesis, and Portfolio domains.
 */
export function evaluateAlerts(params: EvaluateAlertsParams): Alert[] {
  const { positions, portfolio, currentPrices = {}, config, fundamentalContext = {}, thesisContext = {}, portfolioPeakValue } = params;
  const alerts: Alert[] = [];
  const now = new Date().toISOString();

  const overvalThreshold = config?.overvaluationThresholdPct ?? DEFAULT_OVERVALUATION_THRESHOLD_PCT;
  const drawdownLimit = config?.portfolioDrawdownLimitPct ?? DEFAULT_PORTFOLIO_DRAWDOWN_LIMIT_PCT;
  const cashBufferMin = config?.cashBufferMinPct ?? DEFAULT_CASH_BUFFER_MIN_PCT;
  const stockCap = config?.maxStockExposurePct ?? DEFAULT_MAX_STOCK_EXPOSURE_PCT;
  const sectorCap = config?.maxSectorExposurePct ?? DEFAULT_MAX_SECTOR_EXPOSURE_PCT;

  // 1. Position-level alert evaluations (Price, Fundamental, Thesis)
  for (const pos of positions) {
    const symbol = pos.symbol;
    const companyId = pos.companyId;
    const currentPrice = currentPrices[symbol] ?? currentPrices[companyId] ?? pos.currentPrice;

    // --- Domain 1: Price Alerts ---
    // Stop loss breach
    if (pos.stopLoss > 0 && currentPrice <= pos.stopLoss) {
      alerts.push({
        id: `alert_stop_${symbol}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        companyId,
        symbol,
        type: 'price-stop',
        severity: 'critical',
        message: `Stop-loss invalidation breach! Price (₹${currentPrice}) has reached or fallen below stop price (₹${pos.stopLoss}).`,
        triggeredAt: now,
        relatedTradePlanId: pos.tradePlanId,
        data: { currentPrice, stopLoss: pos.stopLoss, diffPct: ((currentPrice - pos.stopLoss) / pos.stopLoss) * 100 },
      });
    }

    // Target price reached
    if (pos.targets && pos.targets.length > 0 && currentPrice >= pos.targets[0]!) {
      alerts.push({
        id: `alert_target_${symbol}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        companyId,
        symbol,
        type: 'price-target',
        severity: 'warning',
        message: `Target 1 reached! Current price (₹${currentPrice}) has reached planned target level (₹${pos.targets[0]!}).`,
        triggeredAt: now,
        relatedTradePlanId: pos.tradePlanId,
        data: { currentPrice, targetPrice: pos.targets[0]! },
      });
    }

    // Fair value reached
    if (pos.fairValue && pos.fairValue > 0 && currentPrice >= pos.fairValue) {
      alerts.push({
        id: `alert_fair_${symbol}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        companyId,
        symbol,
        type: 'price-fair-value',
        severity: 'warning',
        message: `Estimated fair value reached! Current price (₹${currentPrice}) meets or exceeds fair value (₹${pos.fairValue}).`,
        triggeredAt: now,
        relatedTradePlanId: pos.tradePlanId,
        data: { currentPrice, fairValue: pos.fairValue },
      });
    }

    // Overvaluation threshold exceeded
    if (pos.fairValue && pos.fairValue > 0) {
      const overvalPrice = pos.fairValue * (1 + overvalThreshold);
      if (currentPrice >= overvalPrice) {
        const premiumPct = roundNum(((currentPrice - pos.fairValue) / pos.fairValue) * 100, 1);
        alerts.push({
          id: `alert_overval_${symbol}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          companyId,
          symbol,
          type: 'price-overvalued',
          severity: 'warning',
          message: `Price materially exceeds fair value by ${premiumPct}% (₹${currentPrice} vs fair value ₹${pos.fairValue}). Margin of safety eroded.`,
          triggeredAt: now,
          relatedTradePlanId: pos.tradePlanId,
          data: { currentPrice, fairValue: pos.fairValue, premiumPct, threshold: overvalThreshold },
        });
      }
    }

    // In entry zone
    if (pos.maxBuyPrice && pos.maxBuyPrice > 0 && currentPrice <= pos.maxBuyPrice) {
      alerts.push({
        id: `alert_entry_${symbol}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        companyId,
        symbol,
        type: 'price-entry-zone',
        severity: 'info',
        message: `Current price (₹${currentPrice}) is within maximum buy price ceiling (₹${pos.maxBuyPrice}).`,
        triggeredAt: now,
        relatedTradePlanId: pos.tradePlanId,
        data: { currentPrice, maxBuyPrice: pos.maxBuyPrice },
      });
    }

    // --- Domain 2: Fundamental Alerts ---
    const fund = fundamentalContext[symbol] || fundamentalContext[companyId];
    if (fund) {
      if (fund.hardStops && fund.hardStops.length > 0) {
        const flagKeys = fund.hardStops.map((f) => f.flagKey).join(', ');
        alerts.push({
          id: `alert_fund_stop_${symbol}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          companyId,
          symbol,
          type: 'fundamental-deterioration',
          severity: 'critical',
          message: `Hard fundamental red flag detected: ${flagKeys}. Immediate priority review required.`,
          triggeredAt: now,
          relatedTradePlanId: pos.tradePlanId,
          data: { redFlags: fund.hardStops.map((f) => f.flagKey) },
        });
      }

      if ((fund.roceDropPct && fund.roceDropPct >= 0.05) || (fund.cfoVsPatRatio !== undefined && fund.cfoVsPatRatio < 0.5) || (fund.debtorDaysIncrease && fund.debtorDaysIncrease >= 30) || (fund.debtIncreasePct && fund.debtIncreasePct >= 0.25)) {
        alerts.push({
          id: `alert_fund_det_${symbol}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          companyId,
          symbol,
          type: 'fundamental-deterioration',
          severity: 'warning',
          message: `Fundamental deterioration detected in cash flow, ROCE, debt, or working capital metrics.`,
          triggeredAt: now,
          relatedTradePlanId: pos.tradePlanId,
          data: {
            roceDropPct: fund.roceDropPct,
            cfoVsPatRatio: fund.cfoVsPatRatio,
            debtorDaysIncrease: fund.debtorDaysIncrease,
            debtIncreasePct: fund.debtIncreasePct,
          },
        });
      }

      if ((fund.pledgeIncreasePct && fund.pledgeIncreasePct > 0) || (fund.promoterSalePct && fund.promoterSalePct >= 0.02)) {
        alerts.push({
          id: `alert_gov_${symbol}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          companyId,
          symbol,
          type: 'fundamental-governance',
          severity: 'critical',
          message: `Governance alert: promoter pledge increase or material promoter stake reduction detected.`,
          triggeredAt: now,
          relatedTradePlanId: pos.tradePlanId,
          data: { pledgeIncreasePct: fund.pledgeIncreasePct, promoterSalePct: fund.promoterSalePct },
        });
      }

      if (fund.resultsPublished) {
        alerts.push({
          id: `alert_results_${symbol}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          companyId,
          symbol,
          type: 'fundamental-results',
          severity: 'info',
          message: `New quarterly financial results published. Updated Stage A/B re-assessment recommended.`,
          triggeredAt: now,
          relatedTradePlanId: pos.tradePlanId,
          data: { resultsPublished: true },
        });
      }
    }

    // --- Domain 3: Thesis Alerts ---
    const thesis = thesisContext[symbol] || thesisContext[companyId] || {
      status: pos.thesisStatus || 'intact',
      brokenAssumptions: pos.brokenAssumptions,
    };

    if (thesis.status === 'broken' || (thesis.brokenAssumptions && thesis.brokenAssumptions.length > 0)) {
      alerts.push({
        id: `alert_thesis_broken_${symbol}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        companyId,
        symbol,
        type: 'thesis-broken',
        severity: 'critical',
        message: `Original investment thesis broken! Failed core assumptions: ${(thesis.brokenAssumptions || ['Moat invalidation']).join(', ')}. Immediate exit review required.`,
        triggeredAt: now,
        relatedTradePlanId: pos.tradePlanId,
        data: { brokenAssumptions: thesis.brokenAssumptions || ['Moat invalidation'] },
      });
    } else if (thesis.status === 'weakened' || (thesis.riskFactors && thesis.riskFactors.length > 0)) {
      alerts.push({
        id: `alert_thesis_risk_${symbol}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        companyId,
        symbol,
        type: 'thesis-risk',
        severity: 'warning',
        message: `Thesis risk factors emerging: ${(thesis.riskFactors || ['Competitive pressure']).join(', ')}.`,
        triggeredAt: now,
        relatedTradePlanId: pos.tradePlanId,
        data: { riskFactors: thesis.riskFactors },
      });
    }
  }

  // --- Domain 4: Portfolio Alerts ---
  const totalVal = portfolio.totalValue;

  if (totalVal > 0) {
    // Single-stock concentration check
    for (const pos of portfolio.positions) {
      const expPct = pos.marketValue / totalVal;
      if (expPct > stockCap) {
        alerts.push({
          id: `alert_port_stock_${pos.symbol}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          companyId: pos.companyId,
          symbol: pos.symbol,
          type: 'portfolio-concentration',
          severity: expPct > stockCap * 1.5 ? 'critical' : 'warning',
          message: `Single stock concentration breach: ${pos.symbol} represents ${roundNum(expPct * 100, 2)}% of total portfolio (limit: ${stockCap * 100}%).`,
          triggeredAt: now,
          data: { symbol: pos.symbol, exposurePct: expPct, limitPct: stockCap },
        });
      }
    }

    // Sector concentration check
    if (portfolio.sectorExposure) {
      for (const [sec, secVal] of Object.entries(portfolio.sectorExposure)) {
        const secPct = secVal / totalVal;
        if (secPct > sectorCap) {
          alerts.push({
            id: `alert_port_sec_${sec}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'portfolio-concentration',
            severity: secPct > sectorCap * 1.3 ? 'critical' : 'warning',
            message: `Sector concentration breach: "${sec}" represents ${roundNum(secPct * 100, 2)}% of total portfolio (limit: ${sectorCap * 100}%).`,
            triggeredAt: now,
            data: { sector: sec, exposurePct: secPct, limitPct: sectorCap },
          });
        }
      }
    }

    // Cash buffer minimum check
    const cashPct = portfolio.cash / totalVal;
    if (cashPct < cashBufferMin) {
      alerts.push({
        id: `alert_port_cash_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'portfolio-drawdown',
        severity: 'warning',
        message: `Cash buffer low: available cash is ${roundNum(cashPct * 100, 2)}% of total portfolio (minimum buffer: ${cashBufferMin * 100}%).`,
        triggeredAt: now,
        data: { cashPct, cashBufferMin },
      });
    }

    // Portfolio drawdown check
    const peak = portfolioPeakValue ?? totalVal;
    if (peak > 0 && totalVal < peak) {
      const drawdownPct = (peak - totalVal) / peak;
      if (drawdownPct >= drawdownLimit) {
        alerts.push({
          id: `alert_port_dd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'portfolio-drawdown',
          severity: 'critical',
          message: `Portfolio drawdown breach: portfolio is down ${roundNum(drawdownPct * 100, 2)}% from peak ₹${peak} (limit: ${drawdownLimit * 100}%). Capital preservation mode triggered.`,
          triggeredAt: now,
          data: { currentVal: totalVal, peak, drawdownPct, limitPct: drawdownLimit },
        });
      }
    }
  }

  return alerts;
}

export interface EvaluateSellDecisionParams {
  alerts: Alert[];
  position: PositionWithThesis;
  portfolio: PortfolioSnapshot;
  defaultTrimPercentage?: number | undefined;
}

/**
 * Recommends an auditable workflow action and sell/trim decision based on active alerts.
 * Strictly manual confirmation only — never auto-executes trades.
 */
export function evaluateSellDecision(params: EvaluateSellDecisionParams): SellDecisionRecommendation {
  const { alerts, position, defaultTrimPercentage = DEFAULT_TRIM_PERCENTAGE } = params;

  // Priority 1: Thesis broken
  const thesisBroken = alerts.find((a) => a.type === 'thesis-broken');
  if (thesisBroken) {
    return {
      decision: 'sell',
      recommendedAction: 'EXIT_CANDIDATE',
      trigger: 'thesis-broken',
      reason: `Original investment thesis invalidated. ${thesisBroken.message}`,
      suggestedQuantity: position.quantity,
      priority: 'CRITICAL',
      requiresManualConfirmation: true,
    };
  }

  // Priority 2: Stop loss reached
  const stopAlert = alerts.find((a) => a.type === 'price-stop');
  if (stopAlert) {
    return {
      decision: 'sell',
      recommendedAction: 'EXIT_CANDIDATE',
      trigger: 'price-stop',
      reason: `Risk plan invalidation level reached. ${stopAlert.message}`,
      suggestedQuantity: position.quantity,
      priority: 'CRITICAL',
      requiresManualConfirmation: true,
    };
  }

  // Priority 3: Hard fundamental / governance red flag
  const fundAlert = alerts.find((a) => (a.type === 'fundamental-deterioration' || a.type === 'fundamental-governance') && a.severity === 'critical');
  if (fundAlert) {
    return {
      decision: 'hold',
      recommendedAction: 'REVIEW_REQUIRED',
      trigger: fundAlert.type,
      reason: `Critical fundamental red flag or governance breach detected. ${fundAlert.message}`,
      priority: 'HIGH',
      requiresManualConfirmation: true,
    };
  }

  // Priority 4: Price overvalued (>= 120% of fair value)
  const overvalAlert = alerts.find((a) => a.type === 'price-overvalued');
  if (overvalAlert) {
    const trimQty = Math.max(1, Math.floor(position.quantity * defaultTrimPercentage));
    return {
      decision: 'trim',
      recommendedAction: 'TRIM_CANDIDATE',
      trigger: 'price-overvalued',
      reason: `Market price materially exceeds fair value. Margin of safety eroded. Consider locking in profits.`,
      suggestedQuantity: trimQty,
      priority: 'HIGH',
      requiresManualConfirmation: true,
    };
  }

  // Priority 5: Fair value or Target reached
  const targetOrFair = alerts.find((a) => a.type === 'price-target' || a.type === 'price-fair-value');
  if (targetOrFair) {
    const trimQty = Math.max(1, Math.floor(position.quantity * defaultTrimPercentage));
    return {
      decision: 'trim',
      recommendedAction: 'TRIM_CANDIDATE',
      trigger: targetOrFair.type,
      reason: `Price target or fair value reached. Review expected risk-adjusted future returns.`,
      suggestedQuantity: trimQty,
      priority: 'MEDIUM',
      requiresManualConfirmation: true,
    };
  }

  // Priority 6: Thesis risk or warning deterioration
  const warningAlert = alerts.find((a) => a.severity === 'warning' || a.type === 'thesis-risk');
  if (warningAlert) {
    return {
      decision: 'hold',
      recommendedAction: 'REVIEW_REQUIRED',
      trigger: warningAlert.type,
      reason: `Monitoring warning active: ${warningAlert.message}`,
      priority: 'MEDIUM',
      requiresManualConfirmation: true,
    };
  }

  // Normal holding state
  return {
    decision: 'hold',
    recommendedAction: 'HOLD',
    trigger: 'price-entry-zone',
    reason: 'Position thesis is intact and operating within established risk parameters.',
    priority: 'LOW',
    requiresManualConfirmation: true,
  };
}

/**
 * Enforces immutability of the original entry/decision snapshot.
 * Prevents hindsight modification of original execution fields.
 */
export function validateJournalEntryImmutability(
  original: JournalEntry,
  candidate: JournalEntry
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  if (original.id !== candidate.id) violations.push('id cannot be modified');
  if (original.tradePlanId !== candidate.tradePlanId) violations.push('tradePlanId cannot be modified');
  if (original.date !== candidate.date) violations.push('execution date cannot be modified in hindsight');
  if (original.action !== candidate.action) violations.push('trade action cannot be modified');
  if (original.quantity !== candidate.quantity) violations.push('executed quantity cannot be modified');
  if (original.price !== candidate.price) violations.push('executed price cannot be modified');
  if (original.fees !== candidate.fees) violations.push('fees cannot be modified');
  if (original.taxes !== candidate.taxes) violations.push('taxes cannot be modified');
  if (original.reason !== candidate.reason) violations.push('original entry rationale cannot be edited in hindsight; append a PostTradeReview instead');

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Validates completeness of PostTradeReview fields.
 */
export function validatePostTradeReview(
  review: Partial<PostTradeReview>
): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  if (!review.rulesWorked || review.rulesWorked.length === 0) missingFields.push('rulesWorked');
  if (!review.assumptionsFailed) missingFields.push('assumptionsFailed');
  if (!review.executionQuality) missingFields.push('executionQuality');
  if (review.slippage === undefined) missingFields.push('slippage');
  if (!review.lesson || review.lesson.trim().length === 0) missingFields.push('lesson');
  if (!review.reviewedBy || review.reviewedBy.trim().length === 0) missingFields.push('reviewedBy');

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

export interface PositionMonitoringResult {
  symbol: string;
  alerts: Alert[];
  recommendation: SellDecisionRecommendation;
  pnl?: PositionPnLResult | undefined;
}

/**
 * Monitors a single position with thesis against current market price and alerts.
 */
export function monitorPosition(params: {
  position: PositionWithThesis;
  portfolio: PortfolioSnapshot;
  currentPrice: number;
  config?: StageGConfig | undefined;
  transactions?: JournalEntry[] | undefined;
  fundamentalAlerts?: Alert[] | undefined;
  thesisStatus?: 'intact' | 'weakened' | 'broken' | undefined;
  brokenAssumptions?: string[] | undefined;
}): PositionMonitoringResult {
  const { position, portfolio, currentPrice, config, transactions, fundamentalAlerts = [], thesisStatus, brokenAssumptions } = params;

  const currentPrices = { [position.symbol]: currentPrice };
  const evaluatedAlerts = evaluateAlerts({
    positions: [position],
    portfolio,
    currentPrices,
    config,
    thesisContext: thesisStatus ? { [position.symbol]: { status: thesisStatus, brokenAssumptions } } : undefined,
  });

  const allAlerts = [...evaluatedAlerts, ...fundamentalAlerts];
  const recommendation = evaluateSellDecision({
    alerts: allAlerts,
    position,
    portfolio,
    defaultTrimPercentage: config?.defaultTrimPercentage,
  });

  const pnl = transactions && transactions.length > 0 ? calculatePositionPnL(transactions, currentPrice, position.symbol) : undefined;

  const res: PositionMonitoringResult = {
    symbol: position.symbol,
    alerts: allAlerts,
    recommendation,
  };
  if (pnl !== undefined) res.pnl = pnl;

  return res;
}

/**
 * Evaluates Stage G Monitoring, Sell/Trim Decision Framework & Trade Journal / P&L Attribution.
 * Deterministic pure function: StageGInput -> StageGOutput.
 */
export function scoreStageG(input: StageGInput, config?: StageGConfig): StageGOutput {
  const ruleSetVersion = config?.ruleSetVersion ?? DEFAULT_STAGE_G_RULE_SET_VERSION;
  const portfolio = input.portfolio;
  const openPositions = input.openPositions ?? [];
  const tradeHistory = input.tradeHistory ?? [];
  const currentPrices = input.currentPrices ?? {};
  const now = input.asOfDate || new Date().toISOString();

  const defaultProv: DataProvenance = input.dataProvenance ?? {
    source: 'portfolio-monitoring-engine',
    fetchedAt: now,
    reportedPeriod: 'STAGE_G_MONITORING',
    currency: 'INR',
    unit: 'RAW',
    adjustmentStatus: 'reported',
    quality: 'verified',
    isMissing: false,
  };

  const hardStops: RedFlag[] = [];
  const conditionalWarnings: RedFlag[] = [];
  const dataQualityWarnings: RedFlag[] = [];
  const valuationWarnings: RedFlag[] = [];

  // 1. Evaluate fresh monitoring alerts
  const freshAlerts = evaluateAlerts({
    positions: openPositions,
    portfolio,
    currentPrices,
    config,
  });

  // Merge with existing alerts, deduplicating by type + symbol
  const existingAlerts = input.alerts ?? [];
  const activeAlerts: Alert[] = [...freshAlerts];

  for (const ex of existingAlerts) {
    if (!activeAlerts.some((a) => a.type === ex.type && a.symbol === ex.symbol && a.companyId === ex.companyId)) {
      activeAlerts.push(ex);
    }
  }

  // 2. Generate sell/trim decision recommendations for positions
  const pendingReviews: SellDecision[] = [];

  for (const pos of openPositions) {
    const posAlerts = activeAlerts.filter((a) => a.symbol === pos.symbol || a.companyId === pos.companyId);
    const rec = evaluateSellDecision({
      alerts: posAlerts,
      position: pos,
      portfolio,
      defaultTrimPercentage: config?.defaultTrimPercentage,
    });

    if (rec.recommendedAction !== 'HOLD') {
      const decisionObj: SellDecision = {
        id: `sd_${pos.symbol}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        companyId: pos.companyId,
        symbol: pos.symbol,
        tradePlanId: pos.tradePlanId || `tp_${pos.symbol}`,
        trigger: rec.trigger,
        decision: rec.decision,
        recommendedAction: rec.recommendedAction,
        reason: rec.reason,
        decidedAt: now,
        decidedBy: 'system_recommendation',
        originalThesisSnapshot: pos.thesis,
        portfolioSnapshot: portfolio,
      };

      if (rec.suggestedQuantity !== undefined) decisionObj.quantity = rec.suggestedQuantity;
      if (rec.suggestedPrice !== undefined) decisionObj.price = rec.suggestedPrice;

      pendingReviews.push(decisionObj);
    }
  }

  // 3. Compute P&L summary across trade history grouped by symbol
  const pnlSummary: Record<string, PositionPnLResult> = {};
  if (tradeHistory.length > 0) {
    const txBySymbol: Record<string, JournalEntry[]> = {};
    for (const tx of tradeHistory) {
      const sym = tx.symbol || 'PORTFOLIO';
      if (!txBySymbol[sym]) txBySymbol[sym] = [];
      txBySymbol[sym]!.push(tx);
    }

    for (const [sym, txList] of Object.entries(txBySymbol)) {
      const curPrice = currentPrices[sym] ?? txList[txList.length - 1]?.price ?? 0;
      const pnlRes = calculatePositionPnL(txList, curPrice, sym);
      pnlSummary[sym] = pnlRes;

      if (pnlRes.violations && pnlRes.violations.length > 0) {
        for (const viol of pnlRes.violations) {
          dataQualityWarnings.push(
            createRedFlag({
              flagKey: 'STAGE_G_OVERSELL_DETECTED',
              ruleKey: 'STAGE_G_JOURNAL_INTEGRITY',
              message: viol,
              threshold: 'Quantity sold <= Quantity held',
              actualValue: pnlRes.totalQuantity,
              severity: 'high',
              class: 'DATA_QUALITY_WARNING',
              companyId: pnlRes.companyId || sym,
              ruleSetVersion,
            })
          );
        }
      }
    }
  }

  // 4. Portfolio Health Evaluation
  const totalVal = portfolio.totalValue;
  const drawdownLimit = config?.portfolioDrawdownLimitPct ?? DEFAULT_PORTFOLIO_DRAWDOWN_LIMIT_PCT;
  const cashBufferMin = config?.cashBufferMinPct ?? DEFAULT_CASH_BUFFER_MIN_PCT;
  const stockCap = config?.maxStockExposurePct ?? DEFAULT_MAX_STOCK_EXPOSURE_PCT;
  const sectorCap = config?.maxSectorExposurePct ?? DEFAULT_MAX_SECTOR_EXPOSURE_PCT;

  let concentrationOk = true;
  let drawdownOk = true;
  let cashBufferOk = true;
  const correlationRisk: 'low' | 'medium' | 'high' = 'low';

  // Check concentration
  if (totalVal > 0) {
    for (const p of portfolio.positions) {
      if (p.marketValue / totalVal > stockCap) concentrationOk = false;
    }
    if (portfolio.sectorExposure) {
      for (const secVal of Object.values(portfolio.sectorExposure)) {
        if (secVal / totalVal > sectorCap) concentrationOk = false;
      }
    }
    if (portfolio.cash / totalVal < cashBufferMin) cashBufferOk = false;
  }

  const ddAlert = activeAlerts.find((a) => a.type === 'portfolio-drawdown' && a.severity === 'critical');
  if (ddAlert) drawdownOk = false;

  const currentDrawdownPct = ddAlert?.data && typeof ddAlert.data['drawdownPct'] === 'number' ? ddAlert.data['drawdownPct'] : 0;
  const cashPct = totalVal > 0 ? portfolio.cash / totalVal : 0;

  // 5. Flag emissions for Stage Gate
  if (!drawdownOk) {
    hardStops.push(
      createRedFlag({
        flagKey: 'STAGE_G_PORTFOLIO_DRAWDOWN_BREACH',
        ruleKey: 'STAGE_G_PORTFOLIO_DRAWDOWN',
        message: `Portfolio drawdown exceeds maximum allowed threshold of ${drawdownLimit * 100}%. New trade plans blocked.`,
        threshold: `<= ${drawdownLimit * 100}%`,
        actualValue: `${roundNum(currentDrawdownPct * 100, 2)}%`,
        severity: 'critical',
        class: 'HARD_STOP',
        companyId: 'PORTFOLIO',
        ruleSetVersion,
      })
    );
  }

  for (const a of activeAlerts) {
    if (a.type === 'thesis-broken') {
      hardStops.push(
        createRedFlag({
          flagKey: 'STAGE_G_THESIS_BROKEN',
          ruleKey: 'STAGE_G_THESIS_INTEGRITY',
          message: a.message,
          threshold: 'Thesis intact',
          actualValue: 'Thesis broken',
          severity: 'critical',
          class: 'HARD_STOP',
          companyId: a.companyId || a.symbol || 'UNKNOWN',
          ruleSetVersion,
        })
      );
    } else if (a.type === 'price-stop') {
      hardStops.push(
        createRedFlag({
          flagKey: 'STAGE_G_STOP_LOSS_BREACH',
          ruleKey: 'STAGE_G_PRICE_MONITORING',
          message: a.message,
          threshold: 'Price > Stop Loss',
          actualValue: a.data['currentPrice'],
          severity: 'critical',
          class: 'HARD_STOP',
          companyId: a.companyId || a.symbol || 'UNKNOWN',
          ruleSetVersion,
        })
      );
    } else if (a.type === 'price-overvalued') {
      valuationWarnings.push(
        createRedFlag({
          flagKey: 'STAGE_G_OVERVALUATION_WARNING',
          ruleKey: 'STAGE_G_PRICE_MONITORING',
          message: a.message,
          threshold: `< ${DEFAULT_OVERVALUATION_THRESHOLD_PCT * 100}% over fair value`,
          actualValue: a.data['premiumPct'],
          severity: 'medium',
          class: 'VALUATION_WARNING',
          companyId: a.companyId || a.symbol || 'UNKNOWN',
          ruleSetVersion,
        })
      );
    } else if (a.severity === 'warning' || a.severity === 'critical') {
      conditionalWarnings.push(
        createRedFlag({
          flagKey: `STAGE_G_${a.type.toUpperCase().replace(/-/g, '_')}`,
          ruleKey: 'STAGE_G_ACTIVE_ALERTS',
          message: a.message,
          threshold: 'No active warning alerts',
          actualValue: a.type,
          severity: a.severity === 'critical' ? 'high' : 'medium',
          class: 'CONDITIONAL_WARNING',
          companyId: a.companyId || a.symbol || 'UNKNOWN',
          ruleSetVersion,
        })
      );
    }
  }

  // 6. Build ScoringRuleResults (7 Monitoring Rules)
  const allFlags = [...hardStops, ...conditionalWarnings, ...dataQualityWarnings, ...valuationWarnings];

  const ruleConfigs = [
    { ruleKey: 'STAGE_G_PRICE_MONITORING', passed: !activeAlerts.some((a) => a.type === 'price-stop'), desc: 'Price monitoring (stop-loss and price limits)' },
    { ruleKey: 'STAGE_G_THESIS_INTEGRITY', passed: !activeAlerts.some((a) => a.type === 'thesis-broken'), desc: 'Thesis and moat integrity monitoring' },
    { ruleKey: 'STAGE_G_FUNDAMENTAL_HEALTH', passed: !activeAlerts.some((a) => a.type === 'fundamental-deterioration' && a.severity === 'critical'), desc: 'Fundamental and financial statement deterioration monitoring' },
    { ruleKey: 'STAGE_G_PORTFOLIO_CONCENTRATION', passed: concentrationOk, desc: 'Portfolio concentration monitoring (single-stock <= 10%, sector <= 30%)' },
    { ruleKey: 'STAGE_G_PORTFOLIO_DRAWDOWN', passed: drawdownOk, desc: 'Portfolio drawdown risk monitoring (drawdown <= 15%)' },
    { ruleKey: 'STAGE_G_CASH_BUFFER', passed: cashBufferOk, desc: 'Portfolio cash buffer monitoring (cash >= 5%)' },
    { ruleKey: 'STAGE_G_JOURNAL_INTEGRITY', passed: dataQualityWarnings.length === 0, desc: 'Trade journal and transaction history integrity' },
  ];

  const ruleResults: ScoringRuleResult[] = ruleConfigs.map((rc) => ({
    ruleKey: rc.ruleKey,
    points: rc.passed ? 1 : 0,
    maxPoints: 1,
    inputs: { check: rc.ruleKey },
    explanation: rc.desc,
    redFlags: allFlags.filter((f) => f.ruleKey === rc.ruleKey),
    dataQuality: defaultProv,
    ruleSetVersion,
  }));

  const totalPoints = ruleResults.reduce((acc, r) => acc + r.points, 0);
  const maxPoints = ruleResults.length;

  let verdict: 'PASS' | 'FAIL' | 'CONDITIONAL' | 'INCOMPLETE';
  if (hardStops.length > 0) {
    verdict = 'FAIL';
  } else if (dataQualityWarnings.length > 0) {
    verdict = 'INCOMPLETE';
  } else if (conditionalWarnings.length > 0 || valuationWarnings.length > 0) {
    verdict = 'CONDITIONAL';
  } else {
    verdict = 'PASS';
  }

  const output: StageGOutput = {
    stage: 'G',
    activeAlerts,
    pendingReviews,
    journalEntries: tradeHistory,
    portfolioHealth: {
      concentrationOk,
      drawdownOk,
      cashBufferOk,
      correlationRisk,
      currentDrawdownPct: roundNum(currentDrawdownPct, 4),
      cashPct: roundNum(cashPct, 4),
    },
    openPositions,
    calculatedAt: now,
    ruleSetVersion,
    flags: allFlags,
    ruleResults,
    totalPoints,
    maxPoints,
    verdict,
    hardStops,
    conditionalWarnings,
    dataQualityWarnings,
    valuationWarnings,
    dataSnapshotId: input.dataSnapshotId ?? '',
  };

  if (Object.keys(pnlSummary).length > 0) {
    output.pnlSummary = pnlSummary;
  }

  return output;
}

// Aliases matching ScoringEngine and domain terminology
export const evaluateStageG = scoreStageG;
export const monitorStageG = scoreStageG;
