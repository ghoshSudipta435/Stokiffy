/**
 * Stage F (Buy Plan, Position Sizing & Portfolio Risk Controls) Deterministic Engine
 *
 * Implements:
 * 1. Configurable risk limits (Risk/trade 1%, Single-stock 10%, Sector 30%, RR >= 1.5, ADV <= 5%)
 * 2. Position sizing calculation with decimal.js and ordered downward adjustments:
 *    rawQuantity -> lotSize -> liquidityCap -> availableCash -> stockCap -> sectorCap
 * 3. Portfolio risk checks (7 checks) and red flag emissions (HARD_STOP & CONDITIONAL_WARNING)
 * 4. Auditable overrides validation (min 50 chars reason, preserves flags with status: OVERRIDDEN)
 * 5. Trade plan generation with status transition ('draft' vs 'ready') and non-guarantee disclaimer
 *
 * Pure function: StageFInput -> StageFOutput. Zero external dependencies.
 */

import Decimal from 'decimal.js';
import type { DataProvenance, RedFlag } from '../types/base.js';
import type { ScoringRuleResult } from '../types/scoring.js';
import type {
  OverrideRecord,
  PortfolioSnapshot,
  PositionSizingResult,
  RiskCheckResult,
  StageFInput,
  StageFOutput,
  TradePlan,
  TradePlanStatus,
} from '../types/stage-f.js';

function roundNum(val: number | Decimal, places: number): number {
  const d = val instanceof Decimal ? val : new Decimal(val);
  return d.toDecimalPlaces(places).toNumber();
}

export interface StageFConfig {
  ruleSetVersion?: string | undefined;
  defaultRiskPerTradePct?: number | undefined;
  defaultMaxStockExposurePct?: number | undefined;
  defaultMaxSectorExposurePct?: number | undefined;
  defaultMinRiskReward?: number | undefined;
  defaultMaxPositionPctOfADV?: number | undefined;
  defaultLotSize?: number | undefined;
  defaultCashBufferPct?: number | undefined;
  defaultEstimatedFeesPct?: number | undefined;
  defaultSlippagePct?: number | undefined;
}

export const DEFAULT_RULE_SET_VERSION = 'stage-f-v1.0';
export const DEFAULT_RISK_PER_TRADE_PCT = 0.01; // 1%
export const DEFAULT_MAX_STOCK_EXPOSURE_PCT = 0.10; // 10%
export const DEFAULT_MAX_SECTOR_EXPOSURE_PCT = 0.30; // 30%
export const DEFAULT_MIN_RISK_REWARD = 1.5;
export const DEFAULT_MAX_POSITION_PCT_OF_ADV = 0.05; // 5% of ADV
export const DEFAULT_LOT_SIZE = 1;
export const MIN_OVERRIDE_REASON_LENGTH = 50;

export const DISCLAIMER_STOP_LOSS_NON_GUARANTEE =
  'Stop-loss orders do not guarantee execution at the exact stop price due to market gaps, overnight closures, or liquidity deficits. The system calculates planned loss at stop; actual loss may differ.';

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
    id: `flag_f_${params.companyId}_${params.flagKey}_${flagIdCounter}`,
    flagKey: params.flagKey,
    stage: 'F',
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

  if (params.ruleKey !== undefined) {
    flag.ruleKey = params.ruleKey;
  }
  if (params.expectedValue !== undefined) {
    flag.expectedValue = params.expectedValue;
  }

  return flag;
}

export interface CalculatePositionSizingParams {
  portfolioValue: number;
  availableCash: number;
  entryPrice: number;
  stopPrice: number;
  riskPerTradePct: number;
  maxStockExposurePct: number;
  maxSectorExposurePct: number;
  existingStockValue: number;
  existingSectorValue: number;
  lotSize?: number | undefined;
  avgDailyVolume?: number | undefined;
  maxPositionPctOfADV?: number | undefined;
  cashBufferPct?: number | undefined;
  estimatedFeesPct?: number | undefined;
  slippagePct?: number | undefined;
  requestedQuantity?: number | undefined;
}

/**
 * Calculates deterministic position sizing using Decimal.js.
 * Follows downward adjustment order:
 * rawQuantity -> lotSize -> liquidityCap -> availableCash -> stockCap -> sectorCap
 */
export function calculatePositionSizing(params: CalculatePositionSizingParams): PositionSizingResult {
  const {
    portfolioValue,
    availableCash,
    entryPrice,
    stopPrice,
    riskPerTradePct,
    maxStockExposurePct,
    maxSectorExposurePct,
    existingStockValue,
    existingSectorValue,
    lotSize = DEFAULT_LOT_SIZE,
    avgDailyVolume,
    maxPositionPctOfADV = DEFAULT_MAX_POSITION_PCT_OF_ADV,
    cashBufferPct = 0,
    estimatedFeesPct = 0,
    slippagePct = 0,
    requestedQuantity,
  } = params;

  // Validate non-positive or invalid price inputs
  if (portfolioValue <= 0 || entryPrice <= 0 || stopPrice <= 0 || stopPrice >= entryPrice) {
    return {
      rawQuantity: 0,
      adjustedQuantity: 0,
      positionSize: 0,
      entryPriceEst: entryPrice > 0 ? entryPrice : 0,
      riskBudget: portfolioValue > 0 ? roundNum(new Decimal(portfolioValue).mul(riskPerTradePct), 2) : 0,
      riskPerShare: 0,
      plannedPositionValue: 0,
      plannedLossAtStop: 0,
      actualRiskPct: 0,
      postTradeStockExposurePct: portfolioValue > 0 ? roundNum(new Decimal(existingStockValue).div(portfolioValue), 4) : 0,
      postTradeSectorExposurePct: portfolioValue > 0 ? roundNum(new Decimal(existingSectorValue).div(portfolioValue), 4) : 0,
      cashRemaining: availableCash,
      estimatedFees: 0,
      limitingFactor: 'invalid_inputs',
    };
  }

  const dPortfolio = new Decimal(portfolioValue);
  const dCash = new Decimal(availableCash);
  const dEntry = new Decimal(entryPrice);
  const dStop = new Decimal(stopPrice);
  const dLot = new Decimal(Math.max(1, Math.floor(lotSize)));
  const dRiskPct = new Decimal(riskPerTradePct);
  const dStockCapPct = new Decimal(maxStockExposurePct);
  const dSectorCapPct = new Decimal(maxSectorExposurePct);
  const dSlippagePct = new Decimal(slippagePct);
  const dFeePct = new Decimal(estimatedFeesPct);
  const dCashBufferPct = new Decimal(cashBufferPct);

  // Effective prices including slippage and per-share fees
  const effectiveEntry = dEntry.mul(new Decimal(1).plus(dSlippagePct));
  const feePerShare = dEntry.mul(dFeePct);
  const riskPerShare = effectiveEntry.minus(dStop).plus(feePerShare);

  if (riskPerShare.lte(0)) {
    return {
      rawQuantity: 0,
      adjustedQuantity: 0,
      positionSize: 0,
      entryPriceEst: entryPrice,
      riskBudget: roundNum(dPortfolio.mul(dRiskPct), 2),
      riskPerShare: 0,
      plannedPositionValue: 0,
      plannedLossAtStop: 0,
      actualRiskPct: 0,
      postTradeStockExposurePct: roundNum(new Decimal(existingStockValue).div(dPortfolio), 4),
      postTradeSectorExposurePct: roundNum(new Decimal(existingSectorValue).div(dPortfolio), 4),
      cashRemaining: availableCash,
      estimatedFees: 0,
      limitingFactor: 'invalid_inputs',
    };
  }

  const riskBudget = dPortfolio.mul(dRiskPct);
  const rawQuantity = riskBudget.div(riskPerShare).floor();

  let finalPositionSize: number;
  let adjustedQuantity: number;
  let limitingFactor: PositionSizingResult['limitingFactor'] = 'risk_budget';

  if (requestedQuantity !== undefined && requestedQuantity > 0) {
    // Explicit manual quantity testing
    finalPositionSize = Math.max(0, Math.floor(requestedQuantity));
    limitingFactor = 'requested_quantity';
    adjustedQuantity = rawQuantity.div(dLot).floor().mul(dLot).toNumber();
  } else {
    // Automatic sizing hierarchy
    let currentQty = rawQuantity;

    // 1. Lot size adjustment
    const qtyAfterLot = currentQty.div(dLot).floor().mul(dLot);
    if (!qtyAfterLot.equals(currentQty)) {
      limitingFactor = 'lot_size';
    }
    currentQty = qtyAfterLot;

    // 2. Liquidity cap (5% of ADV by default)
    if (avgDailyVolume !== undefined && avgDailyVolume > 0) {
      const dAdv = new Decimal(avgDailyVolume);
      const dAdvPct = new Decimal(maxPositionPctOfADV);
      const maxAdvQty = dAdv.mul(dAdvPct).div(dLot).floor().mul(dLot);
      if (maxAdvQty.lt(currentQty)) {
        currentQty = maxAdvQty;
        limitingFactor = 'liquidity';
      }
    }

    // 3. Cash available cap
    const usableCash = Decimal.max(0, dCash.mul(new Decimal(1).minus(dCashBufferPct)));
    const totalCostPerShare = effectiveEntry.plus(feePerShare);
    if (totalCostPerShare.gt(0)) {
      const maxCashQty = usableCash.div(totalCostPerShare).div(dLot).floor().mul(dLot);
      if (maxCashQty.lt(currentQty)) {
        currentQty = maxCashQty;
        limitingFactor = 'cash';
      }
    } else {
      currentQty = new Decimal(0);
    }

    // 4. Single-stock concentration cap (10% by default)
    const maxStockValue = dPortfolio.mul(dStockCapPct);
    const dExistingStock = new Decimal(existingStockValue);
    const remainingStockValue = Decimal.max(0, maxStockValue.minus(dExistingStock));
    const maxStockQty = remainingStockValue.div(effectiveEntry).div(dLot).floor().mul(dLot);
    if (maxStockQty.lt(currentQty)) {
      currentQty = maxStockQty;
      limitingFactor = 'stock_cap';
    }

    // 5. Sector concentration cap (30% by default)
    const maxSectorValue = dPortfolio.mul(dSectorCapPct);
    const dExistingSector = new Decimal(existingSectorValue);
    const remainingSectorValue = Decimal.max(0, maxSectorValue.minus(dExistingSector));
    const maxSectorQty = remainingSectorValue.div(effectiveEntry).div(dLot).floor().mul(dLot);
    if (maxSectorQty.lt(currentQty)) {
      currentQty = maxSectorQty;
      limitingFactor = 'sector_cap';
    }

    finalPositionSize = Decimal.max(0, currentQty).toNumber();
    adjustedQuantity = finalPositionSize;
  }

  // Calculate post-trade exposure and impact metrics
  const dFinalQty = new Decimal(finalPositionSize);
  const plannedPositionValue = dFinalQty.mul(dEntry);
  const estimatedFees = dFinalQty.mul(feePerShare);
  const totalCost = plannedPositionValue.plus(estimatedFees);
  const plannedLossAtStop = dFinalQty.mul(riskPerShare);
  const actualRiskPct = dPortfolio.gt(0) ? plannedLossAtStop.div(dPortfolio).toNumber() : 0;
  const postTradeStockValue = new Decimal(existingStockValue).plus(plannedPositionValue);
  const postTradeStockExposurePct = dPortfolio.gt(0) ? postTradeStockValue.div(dPortfolio).toNumber() : 0;
  const postTradeSectorValue = new Decimal(existingSectorValue).plus(plannedPositionValue);
  const postTradeSectorExposurePct = dPortfolio.gt(0) ? postTradeSectorValue.div(dPortfolio).toNumber() : 0;
  const cashRemaining = dCash.minus(totalCost).toNumber();

  return {
    rawQuantity: rawQuantity.toNumber(),
    adjustedQuantity,
    positionSize: finalPositionSize,
    entryPriceEst: roundNum(entryPrice, 2),
    riskBudget: roundNum(riskBudget, 2),
    riskPerShare: roundNum(riskPerShare, 2),
    plannedPositionValue: roundNum(plannedPositionValue, 2),
    plannedLossAtStop: roundNum(plannedLossAtStop, 2),
    actualRiskPct: roundNum(actualRiskPct, 4),
    postTradeStockExposurePct: roundNum(postTradeStockExposurePct, 4),
    postTradeSectorExposurePct: roundNum(postTradeSectorExposurePct, 4),
    cashRemaining: roundNum(cashRemaining, 2),
    estimatedFees: roundNum(estimatedFees, 2),
    limitingFactor,
  };
}

export interface EvaluateRiskChecksParams {
  companyId: string;
  symbol: string;
  sector: string;
  portfolio: PortfolioSnapshot;
  positionSizing: PositionSizingResult;
  entryPrice: number;
  stopPrice: number;
  targets: number[];
  riskPerTradePct: number;
  maxStockExposurePct: number;
  maxSectorExposurePct: number;
  minRiskReward: number;
  maxPositionPctOfADV?: number | undefined;
  avgDailyVolume?: number | undefined;
  ruleSetVersion: string;
}

export interface RiskChecksEvaluationResult {
  riskChecks: RiskCheckResult[];
  hardStops: RedFlag[];
  conditionalWarnings: RedFlag[];
}

/**
 * Evaluates the 7 core risk checks and guardrails deterministically.
 */
export function evaluateRiskChecks(params: EvaluateRiskChecksParams): RiskChecksEvaluationResult {
  const {
    companyId,
    sector,
    portfolio,
    positionSizing,
    entryPrice,
    stopPrice,
    targets,
    riskPerTradePct,
    maxStockExposurePct,
    maxSectorExposurePct,
    minRiskReward,
    maxPositionPctOfADV = DEFAULT_MAX_POSITION_PCT_OF_ADV,
    avgDailyVolume,
    ruleSetVersion,
  } = params;

  const riskChecks: RiskCheckResult[] = [];
  const hardStops: RedFlag[] = [];
  const conditionalWarnings: RedFlag[] = [];

  // Check 1: Stop loss strictly below entry price
  const isStopBelowEntry = stopPrice > 0 && entryPrice > 0 && stopPrice < entryPrice;
  riskChecks.push({
    check: 'stop_below_entry',
    passed: isStopBelowEntry,
    actualValue: stopPrice,
    limit: entryPrice,
    message: isStopBelowEntry
      ? `Stop loss (₹${stopPrice}) is valid and strictly below entry price (₹${entryPrice}).`
      : `Stop loss (₹${stopPrice}) must be strictly positive and strictly below entry price (₹${entryPrice}).`,
  });
  if (!isStopBelowEntry) {
    hardStops.push(
      createRedFlag({
        flagKey: 'STAGE_F_INVALID_STOP_LOSS',
        ruleKey: 'STAGE_F_STOP_BELOW_ENTRY',
        message: `Stop loss price (₹${stopPrice}) must be strictly less than entry price (₹${entryPrice}).`,
        threshold: `< ${entryPrice}`,
        actualValue: stopPrice,
        severity: 'critical',
        class: 'HARD_STOP',
        companyId,
        ruleSetVersion,
      })
    );
  }

  // Check 2: Trade risk budget limit (1% default)
  // Use small tolerance (0.00001) for float rounding
  const riskBudgetPassed = Decimal(positionSizing.actualRiskPct).lte(Decimal(riskPerTradePct).plus(0.00001));
  riskChecks.push({
    check: 'risk_budget',
    passed: riskBudgetPassed,
    actualValue: positionSizing.actualRiskPct,
    limit: riskPerTradePct,
    message: riskBudgetPassed
      ? `Trade risk of ${(positionSizing.actualRiskPct * 100).toFixed(2)}% is within max risk budget of ${(riskPerTradePct * 100).toFixed(2)}%.`
      : `Trade risk of ${(positionSizing.actualRiskPct * 100).toFixed(2)}% exceeds max risk budget of ${(riskPerTradePct * 100).toFixed(2)}%.`,
  });
  if (!riskBudgetPassed) {
    hardStops.push(
      createRedFlag({
        flagKey: 'STAGE_F_RISK_BUDGET_EXCEEDED',
        ruleKey: 'STAGE_F_RISK_BUDGET',
        message: `Planned trade risk of ${(positionSizing.actualRiskPct * 100).toFixed(2)}% exceeds maximum trade risk budget of ${(riskPerTradePct * 100).toFixed(2)}%.`,
        threshold: `<= ${(riskPerTradePct * 100).toFixed(2)}%`,
        actualValue: `${(positionSizing.actualRiskPct * 100).toFixed(2)}%`,
        severity: 'high',
        class: 'HARD_STOP',
        companyId,
        ruleSetVersion,
      })
    );
  }

  // Check 3: Single-stock concentration cap (10% default)
  const stockCapPassed = Decimal(positionSizing.postTradeStockExposurePct).lte(Decimal(maxStockExposurePct).plus(0.00001));
  riskChecks.push({
    check: 'stock_concentration',
    passed: stockCapPassed,
    actualValue: positionSizing.postTradeStockExposurePct,
    limit: maxStockExposurePct,
    message: stockCapPassed
      ? `Post-trade stock exposure of ${(positionSizing.postTradeStockExposurePct * 100).toFixed(2)}% is within max limit of ${(maxStockExposurePct * 100).toFixed(2)}%.`
      : `Post-trade stock exposure of ${(positionSizing.postTradeStockExposurePct * 100).toFixed(2)}% exceeds max single-stock cap of ${(maxStockExposurePct * 100).toFixed(2)}%.`,
  });
  if (!stockCapPassed) {
    hardStops.push(
      createRedFlag({
        flagKey: 'STAGE_F_STOCK_CAP_EXCEEDED',
        ruleKey: 'STAGE_F_STOCK_CONCENTRATION',
        message: `Post-trade single stock exposure of ${(positionSizing.postTradeStockExposurePct * 100).toFixed(2)}% exceeds maximum single-stock cap of ${(maxStockExposurePct * 100).toFixed(2)}%.`,
        threshold: `<= ${(maxStockExposurePct * 100).toFixed(2)}%`,
        actualValue: `${(positionSizing.postTradeStockExposurePct * 100).toFixed(2)}%`,
        severity: 'high',
        class: 'HARD_STOP',
        companyId,
        ruleSetVersion,
      })
    );
  }

  // Check 4: Sector concentration cap (30% default)
  const sectorCapPassed = Decimal(positionSizing.postTradeSectorExposurePct).lte(Decimal(maxSectorExposurePct).plus(0.00001));
  riskChecks.push({
    check: 'sector_concentration',
    passed: sectorCapPassed,
    actualValue: positionSizing.postTradeSectorExposurePct,
    limit: maxSectorExposurePct,
    message: sectorCapPassed
      ? `Post-trade sector exposure for "${sector}" of ${(positionSizing.postTradeSectorExposurePct * 100).toFixed(2)}% is within max limit of ${(maxSectorExposurePct * 100).toFixed(2)}%.`
      : `Post-trade sector exposure for "${sector}" of ${(positionSizing.postTradeSectorExposurePct * 100).toFixed(2)}% exceeds max sector cap of ${(maxSectorExposurePct * 100).toFixed(2)}%.`,
  });
  if (!sectorCapPassed) {
    hardStops.push(
      createRedFlag({
        flagKey: 'STAGE_F_SECTOR_CAP_EXCEEDED',
        ruleKey: 'STAGE_F_SECTOR_CONCENTRATION',
        message: `Post-trade sector exposure for "${sector}" of ${(positionSizing.postTradeSectorExposurePct * 100).toFixed(2)}% exceeds maximum sector cap of ${(maxSectorExposurePct * 100).toFixed(2)}%.`,
        threshold: `<= ${(maxSectorExposurePct * 100).toFixed(2)}%`,
        actualValue: `${(positionSizing.postTradeSectorExposurePct * 100).toFixed(2)}%`,
        severity: 'high',
        class: 'HARD_STOP',
        companyId,
        ruleSetVersion,
      })
    );
  }

  // Check 5: Cash availability
  const totalRequiredCash = Decimal(positionSizing.plannedPositionValue).plus(positionSizing.estimatedFees);
  const cashPassed = totalRequiredCash.lte(Decimal(portfolio.cash));
  riskChecks.push({
    check: 'cash',
    passed: cashPassed,
    actualValue: totalRequiredCash.toNumber(),
    limit: portfolio.cash,
    message: cashPassed
      ? `Required trade capital of ₹${totalRequiredCash.toFixed(2)} is available in cash (₹${portfolio.cash.toFixed(2)}).`
      : `Required trade capital of ₹${totalRequiredCash.toFixed(2)} exceeds available cash of ₹${portfolio.cash.toFixed(2)}.`,
  });
  if (!cashPassed) {
    hardStops.push(
      createRedFlag({
        flagKey: 'STAGE_F_INSUFFICIENT_CASH',
        ruleKey: 'STAGE_F_CASH',
        message: `Planned trade capital requirement of ₹${totalRequiredCash.toFixed(2)} exceeds available cash of ₹${portfolio.cash.toFixed(2)}.`,
        threshold: `<= ₹${portfolio.cash.toFixed(2)}`,
        actualValue: `₹${totalRequiredCash.toFixed(2)}`,
        severity: 'critical',
        class: 'HARD_STOP',
        companyId,
        ruleSetVersion,
      })
    );
  }

  // Check 6: Liquidity (<= 5% of ADV)
  if (avgDailyVolume !== undefined && avgDailyVolume > 0) {
    const advLimit = Decimal(avgDailyVolume).mul(maxPositionPctOfADV).toNumber();
    const liquidityPassed = positionSizing.positionSize <= advLimit;
    riskChecks.push({
      check: 'liquidity',
      passed: liquidityPassed,
      actualValue: positionSizing.positionSize,
      limit: advLimit,
      message: liquidityPassed
        ? `Position size of ${positionSizing.positionSize} shares is within 5% ADV limit (${advLimit.toFixed(0)} shares).`
        : `Position size of ${positionSizing.positionSize} shares exceeds 5% of average daily volume (${advLimit.toFixed(0)} shares).`,
    });
    if (!liquidityPassed) {
      conditionalWarnings.push(
        createRedFlag({
          flagKey: 'STAGE_F_LIQUIDITY_WARNING',
          ruleKey: 'STAGE_F_LIQUIDITY',
          message: `Position size of ${positionSizing.positionSize} shares exceeds 5% of average daily volume (${advLimit.toFixed(0)} shares).`,
          threshold: `<= ${advLimit.toFixed(0)} shares`,
          actualValue: positionSizing.positionSize,
          severity: 'medium',
          class: 'CONDITIONAL_WARNING',
          companyId,
          ruleSetVersion,
        })
      );
    }
  } else {
    riskChecks.push({
      check: 'liquidity',
      passed: true,
      actualValue: positionSizing.positionSize,
      limit: 0,
      message: 'ADV not provided; liquidity check bypassed.',
    });
  }

  // Check 7: Risk / Reward ratio (target 1 vs entry vs stop)
  const target1 = targets.length > 0 ? targets[0]! : 0;
  if (target1 > entryPrice && entryPrice > stopPrice) {
    const rewardPerShare = Decimal(target1).minus(entryPrice);
    const riskAmt = Decimal(entryPrice).minus(stopPrice);
    const rr = rewardPerShare.div(riskAmt).toNumber();
    const rrPassed = Decimal(rr).gte(Decimal(minRiskReward).minus(0.00001));

    riskChecks.push({
      check: 'risk_reward',
      passed: rrPassed,
      actualValue: roundNum(rr, 2),
      limit: minRiskReward,
      message: rrPassed
        ? `Risk/reward ratio of ${rr.toFixed(2)}:1 meets or exceeds minimum requirement of ${minRiskReward.toFixed(2)}:1.`
        : `Risk/reward ratio of ${rr.toFixed(2)}:1 is below minimum requirement of ${minRiskReward.toFixed(2)}:1.`,
    });

    if (!rrPassed) {
      hardStops.push(
        createRedFlag({
          flagKey: 'STAGE_F_RISK_REWARD_BELOW_MINIMUM',
          ruleKey: 'STAGE_F_RISK_REWARD',
          message: `Risk/reward ratio of ${rr.toFixed(2)}:1 is below minimum requirement of ${minRiskReward.toFixed(2)}:1.`,
          threshold: `>= ${minRiskReward.toFixed(2)}:1`,
          actualValue: `${rr.toFixed(2)}:1`,
          severity: 'medium',
          class: 'HARD_STOP',
          companyId,
          ruleSetVersion,
        })
      );
    }
  } else {
    riskChecks.push({
      check: 'risk_reward',
      passed: false,
      actualValue: 0,
      limit: minRiskReward,
      message: `Target 1 (₹${target1}) does not provide valid reward above entry price (₹${entryPrice}).`,
    });
    hardStops.push(
      createRedFlag({
        flagKey: 'STAGE_F_RISK_REWARD_BELOW_MINIMUM',
        ruleKey: 'STAGE_F_RISK_REWARD',
        message: `Target 1 (₹${target1}) does not provide valid reward above entry price (₹${entryPrice}).`,
        threshold: `> ₹${entryPrice}`,
        actualValue: `₹${target1}`,
        severity: 'high',
        class: 'HARD_STOP',
        companyId,
        ruleSetVersion,
      })
    );
  }

  return {
    riskChecks,
    hardStops,
    conditionalWarnings,
  };
}

/**
 * Evaluates Stage F Buy Plan, Position Sizing & Portfolio Risk Controls.
 * Deterministic pure function: StageFInput -> StageFOutput.
 */
export function scoreStageF(input: StageFInput, config?: StageFConfig): StageFOutput {
  const ruleSetVersion = config?.ruleSetVersion ?? DEFAULT_RULE_SET_VERSION;
  const companyId = input.companyId;

  const defaultProv: DataProvenance = input.dataProvenance ?? {
    source: 'portfolio-risk-engine',
    fetchedAt: input.asOfDate || new Date().toISOString(),
    reportedPeriod: 'PORTFOLIO_RISK',
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

  // Extract risk configuration
  const riskPerTradePct = input.riskConfig?.riskPerTradePct ?? config?.defaultRiskPerTradePct ?? DEFAULT_RISK_PER_TRADE_PCT;
  const maxStockExposurePct = input.riskConfig?.maxStockExposurePct ?? config?.defaultMaxStockExposurePct ?? DEFAULT_MAX_STOCK_EXPOSURE_PCT;
  const maxSectorExposurePct = input.riskConfig?.maxSectorExposurePct ?? config?.defaultMaxSectorExposurePct ?? DEFAULT_MAX_SECTOR_EXPOSURE_PCT;
  const minRiskReward = input.riskConfig?.minRiskReward ?? config?.defaultMinRiskReward ?? DEFAULT_MIN_RISK_REWARD;
  const maxPositionPctOfADV = input.riskConfig?.maxPositionPctOfADV ?? config?.defaultMaxPositionPctOfADV ?? DEFAULT_MAX_POSITION_PCT_OF_ADV;
  const lotSize = input.riskConfig?.lotSize ?? config?.defaultLotSize ?? DEFAULT_LOT_SIZE;
  const cashBufferPct = input.riskConfig?.cashBufferPct ?? config?.defaultCashBufferPct ?? 0;
  const estimatedFeesPct = input.riskConfig?.estimatedFeesPct ?? config?.defaultEstimatedFeesPct ?? 0;
  const slippagePct = input.riskConfig?.slippagePct ?? config?.defaultSlippagePct ?? 0;

  // Extract symbol & sector
  const draft = input.tradePlanDraft;
  const symbol = input.symbol || draft?.symbol || 'UNKNOWN';

  // Find existing holding in portfolio
  const existingPosition = input.portfolio.positions.find(
    (p) => p.symbol.toUpperCase() === symbol.toUpperCase() || (p.companyId && p.companyId === companyId)
  );
  const existingStockValue = existingPosition ? existingPosition.marketValue : 0;

  const sector =
    input.sector ||
    existingPosition?.sector ||
    'General';

  // Calculate existing sector market value
  let existingSectorValue = 0;
  if (input.portfolio.sectorExposure && input.portfolio.sectorExposure[sector] !== undefined) {
    existingSectorValue = input.portfolio.sectorExposure[sector]!;
  } else if (input.portfolio.positions.length > 0) {
    existingSectorValue = input.portfolio.positions
      .filter((p) => p.sector.toLowerCase() === sector.toLowerCase())
      .reduce((acc, p) => acc + p.marketValue, 0);
  }

  // Extract entry zone, entry price estimate, stop loss, targets
  const entryZone = draft?.entryZone ?? input.technicalSetup?.entryZone ?? { low: 0, high: 0 };
  let entryPriceEst = draft?.entryPriceEst ?? 0;
  if (entryPriceEst <= 0) {
    if (entryZone.low > 0 && entryZone.high > 0) {
      entryPriceEst = new Decimal(entryZone.low).plus(entryZone.high).div(2).toNumber();
    } else if (entryZone.high > 0) {
      entryPriceEst = entryZone.high;
    } else if (entryZone.low > 0) {
      entryPriceEst = entryZone.low;
    }
  }

  const stopLoss =
    draft?.stopLoss ??
    input.technicalSetup?.stopLoss ??
    input.technicalSetup?.invalidationLevel ??
    0;

  const targets = draft?.targets ?? input.technicalSetup?.targets ?? [];
  const thesis = draft?.thesis ?? '';
  const expectedHoldingPeriod = draft?.expectedHoldingPeriod ?? '6-18 months';
  const entryRationale = draft?.entryRationale ?? '';
  const valuationMaxBuyPrice = input.valuationMaxBuyPrice ?? draft?.valuationMaxBuyPrice ?? 0;
  const technicalSetupId = draft?.technicalSetupId ?? input.technicalSetup?.id ?? '';

  // Validate portfolio value
  if (input.portfolio.totalValue <= 0) {
    hardStops.push(
      createRedFlag({
        flagKey: 'STAGE_F_INVALID_PORTFOLIO_VALUE',
        ruleKey: 'STAGE_F_PORTFOLIO_VALUE',
        message: `Portfolio value must be strictly positive (got ₹${input.portfolio.totalValue}).`,
        threshold: '> 0',
        actualValue: input.portfolio.totalValue,
        severity: 'critical',
        class: 'HARD_STOP',
        companyId,
        ruleSetVersion,
      })
    );
  }

  // Validate entry price
  if (entryPriceEst <= 0) {
    hardStops.push(
      createRedFlag({
        flagKey: 'STAGE_F_INVALID_ENTRY_PRICE',
        ruleKey: 'STAGE_F_ENTRY_PRICE',
        message: `Entry price estimate must be strictly positive (got ₹${entryPriceEst}).`,
        threshold: '> 0',
        actualValue: entryPriceEst,
        severity: 'critical',
        class: 'HARD_STOP',
        companyId,
        ruleSetVersion,
      })
    );
  }

  // Check plan completeness
  const missingPlanFields: string[] = [];
  if (!thesis.trim()) missingPlanFields.push('thesis');
  if (!entryRationale.trim()) missingPlanFields.push('entryRationale');
  if (stopLoss <= 0) missingPlanFields.push('stopLoss');
  if (targets.length === 0) missingPlanFields.push('targets');

  if (missingPlanFields.length > 0) {
    dataQualityWarnings.push(
      createRedFlag({
        flagKey: 'STAGE_F_PLAN_INCOMPLETE',
        ruleKey: 'STAGE_F_COMPLETENESS',
        message: `Trade plan is incomplete. Missing required fields: ${missingPlanFields.join(', ')}.`,
        threshold: 'All core thesis/setup fields present',
        actualValue: missingPlanFields,
        severity: 'medium',
        class: 'DATA_QUALITY_WARNING',
        companyId,
        ruleSetVersion,
      })
    );
  }

  // Check valuation ceiling (valuationMaxBuyPrice)
  if (valuationMaxBuyPrice > 0 && entryPriceEst > valuationMaxBuyPrice) {
    valuationWarnings.push(
      createRedFlag({
        flagKey: 'STAGE_F_ENTRY_ABOVE_MAX_BUY_PRICE',
        ruleKey: 'STAGE_F_VALUATION_CEILING',
        message: `Entry price estimate (₹${entryPriceEst.toFixed(2)}) exceeds valuation maximum buy price (₹${valuationMaxBuyPrice.toFixed(2)}).`,
        threshold: `<= ₹${valuationMaxBuyPrice.toFixed(2)}`,
        actualValue: `₹${entryPriceEst.toFixed(2)}`,
        severity: 'medium',
        class: 'VALUATION_WARNING',
        companyId,
        ruleSetVersion,
      })
    );
  }

  // Compute position sizing
  const sizing = calculatePositionSizing({
    portfolioValue: input.portfolio.totalValue,
    availableCash: input.portfolio.cash,
    entryPrice: entryPriceEst,
    stopPrice: stopLoss,
    riskPerTradePct,
    maxStockExposurePct,
    maxSectorExposurePct,
    existingStockValue,
    existingSectorValue,
    lotSize,
    avgDailyVolume: input.avgDailyVolume,
    maxPositionPctOfADV,
    cashBufferPct,
    estimatedFeesPct,
    slippagePct,
    requestedQuantity: input.requestedQuantity ?? draft?.positionSize,
  });

  // Evaluate the 7 core risk checks
  const riskEvaluation = evaluateRiskChecks({
    companyId,
    symbol,
    sector,
    portfolio: input.portfolio,
    positionSizing: sizing,
    entryPrice: entryPriceEst,
    stopPrice: stopLoss,
    targets,
    riskPerTradePct,
    maxStockExposurePct,
    maxSectorExposurePct,
    minRiskReward,
    maxPositionPctOfADV,
    avgDailyVolume: input.avgDailyVolume,
    ruleSetVersion,
  });

  // Merge flags
  hardStops.push(...riskEvaluation.hardStops);
  conditionalWarnings.push(...riskEvaluation.conditionalWarnings);

  // Process overrides
  const candidateOverrides = [
    ...(input.overrides ?? []),
    ...(draft?.overrides ?? []),
  ];

  const validOverrides: OverrideRecord[] = [];

  for (const flag of hardStops) {
    const override = candidateOverrides.find(
      (o) =>
        o.flagId === flag.id ||
        o.flagId === flag.flagKey ||
        (flag.ruleKey !== undefined && o.flagId === flag.ruleKey) ||
        o.flagId.toLowerCase() === flag.flagKey.toLowerCase()
    );

    if (override) {
      const trimmedReason = override.reason ? override.reason.trim() : '';
      if (trimmedReason.length >= MIN_OVERRIDE_REASON_LENGTH) {
        flag.status = 'OVERRIDDEN';
        flag.isOverride = true;
        flag.overrideReason = trimmedReason;
        flag.overriddenBy = override.overriddenBy || 'authorized_user';
        flag.overriddenAt = override.overriddenAt || new Date().toISOString();

        validOverrides.push({
          flagId: flag.flagKey,
          reason: trimmedReason,
          overriddenBy: flag.overriddenBy,
          overriddenAt: flag.overriddenAt,
          beforeState: override.beforeState ?? {
            postTradeStockExposurePct: sizing.postTradeStockExposurePct,
            postTradeSectorExposurePct: sizing.postTradeSectorExposurePct,
            actualRiskPct: sizing.actualRiskPct,
          },
          afterState: override.afterState ?? {
            postTradeStockExposurePct: sizing.postTradeStockExposurePct,
            postTradeSectorExposurePct: sizing.postTradeSectorExposurePct,
            actualRiskPct: sizing.actualRiskPct,
          },
        });
      } else {
        dataQualityWarnings.push(
          createRedFlag({
            flagKey: 'STAGE_F_OVERRIDE_REASON_TOO_SHORT',
            ruleKey: 'STAGE_F_OVERRIDE_AUDIT',
            message: `Override for flag "${flag.flagKey}" rejected: reason must be at least ${MIN_OVERRIDE_REASON_LENGTH} characters (got ${trimmedReason.length}).`,
            threshold: `>= ${MIN_OVERRIDE_REASON_LENGTH} chars`,
            actualValue: trimmedReason.length,
            severity: 'medium',
            class: 'DATA_QUALITY_WARNING',
            companyId,
            ruleSetVersion,
          })
        );
      }
    }
  }

  // Determine stage gate and plan status
  const hasActiveHardStops = hardStops.some((f) => f.status === 'ACTIVE');
  const isBlocked = hasActiveHardStops || sizing.positionSize <= 0;
  const gatePassed = !hasActiveHardStops && sizing.positionSize > 0;
  const canApprovePlan = gatePassed;
  const canProceedToStageG = gatePassed;

  let planStatus: TradePlanStatus;
  if (isBlocked) {
    planStatus = 'draft';
  } else if (draft?.status === 'executed') {
    planStatus = 'executed';
  } else if (draft?.status === 'cancelled') {
    planStatus = 'cancelled';
  } else if (draft?.status === 'expired') {
    planStatus = 'expired';
  } else {
    planStatus = 'ready';
  }

  // Construct complete TradePlan object
  const tradePlan: TradePlan = {
    id: draft?.id ?? `tp_${companyId}_${Date.now()}`,
    companyId,
    symbol,
    thesis,
    expectedHoldingPeriod,
    entryRationale,
    entryZone: { low: entryZone.low, high: entryZone.high },
    stopLoss,
    targets,
    positionSize: sizing.positionSize,
    entryPriceEst: sizing.entryPriceEst,
    riskBudget: sizing.riskBudget,
    plannedLossAtStop: sizing.plannedLossAtStop,
    portfolioExposurePct: sizing.postTradeStockExposurePct,
    sectorExposurePct: sizing.postTradeSectorExposurePct,
    cashRemaining: sizing.cashRemaining,
    riskChecks: riskEvaluation.riskChecks,
    blocked: isBlocked,
    overrides: validOverrides,
    status: planStatus,
    ruleSetVersion,
    valuationMaxBuyPrice,
    technicalSetupId,
    createdAt: draft?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: input.createdBy ?? draft?.createdBy ?? 'system',
  };

  if (draft?.executedAt !== undefined) tradePlan.executedAt = draft.executedAt;
  if (draft?.executedPrice !== undefined) tradePlan.executedPrice = draft.executedPrice;
  if (draft?.executedQuantity !== undefined) tradePlan.executedQuantity = draft.executedQuantity;

  // Construct scoring rule results for the 7 checks
  const allFlags = [...hardStops, ...conditionalWarnings, ...dataQualityWarnings, ...valuationWarnings];

  const ruleResults: ScoringRuleResult[] = riskEvaluation.riskChecks.map((check) => {
    const checkRuleKey = `STAGE_F_${check.check.toUpperCase()}`;
    const associatedFlags = allFlags.filter(
      (f) =>
        f.ruleKey === checkRuleKey ||
        f.flagKey.toUpperCase().includes(check.check.toUpperCase())
    );

    return {
      ruleKey: checkRuleKey,
      points: check.passed ? 1 : 0,
      maxPoints: 1,
      inputs: {
        check: check.check,
        actualValue: check.actualValue,
        limit: check.limit,
      },
      explanation: check.message,
      redFlags: associatedFlags,
      dataQuality: defaultProv,
      ruleSetVersion,
    };
  });

  const totalPoints = ruleResults.reduce((acc, r) => acc + r.points, 0);
  const maxPoints = ruleResults.length;

  let verdict: 'PASS' | 'FAIL' | 'CONDITIONAL' | 'INCOMPLETE';
  if (hasActiveHardStops || sizing.positionSize <= 0) {
    verdict = 'FAIL';
  } else if (missingPlanFields.length > 0) {
    verdict = 'INCOMPLETE';
  } else if (conditionalWarnings.length > 0 || valuationWarnings.length > 0) {
    verdict = 'CONDITIONAL';
  } else {
    verdict = 'PASS';
  }

  return {
    stage: 'F',
    companyId,
    symbol,
    tradePlan,
    positionSizing: sizing,
    riskChecks: riskEvaluation.riskChecks,
    blocked: isBlocked,
    gatePassed,
    canProceedToStageG,
    canApprovePlan,
    disclaimer: DISCLAIMER_STOP_LOSS_NON_GUARANTEE,
    flags: allFlags,
    ruleResults,
    totalPoints,
    maxPoints,
    verdict,
    hardStops,
    conditionalWarnings,
    dataQualityWarnings,
    valuationWarnings,
    calculatedAt: new Date().toISOString(),
    ruleSetVersion,
    dataSnapshotId: input.dataSnapshotId ?? '',
  };
}

// Aliases matching ScoringEngine and domain terminology
export const planStageF = scoreStageF;
export const evaluateStageF = scoreStageF;
export const buildTradePlan = scoreStageF;
