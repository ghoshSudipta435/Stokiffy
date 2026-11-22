import { describe, expect, it } from 'vitest';
import {
  scoreStageF,
  planStageF,
  evaluateStageF,
  buildTradePlan,
  calculatePositionSizing,
  evaluateRiskChecks,
  DISCLAIMER_STOP_LOSS_NON_GUARANTEE,
  DEFAULT_RISK_PER_TRADE_PCT,
  DEFAULT_MAX_STOCK_EXPOSURE_PCT,
  DEFAULT_MAX_SECTOR_EXPOSURE_PCT,
  STAGE_F_DEFAULT_MIN_RISK_REWARD,
  DEFAULT_MAX_POSITION_PCT_OF_ADV,
  DEFAULT_LOT_SIZE,
  MIN_OVERRIDE_REASON_LENGTH,
} from '../src/index.js';
import type {
  PortfolioSnapshot,
  StageFInput,
  TradePlanDraft,
} from '../src/types/stage-f.js';

describe('Stage F — Buy Plan, Position Sizing & Portfolio Risk Controls', () => {
  const basePortfolio: PortfolioSnapshot = {
    totalValue: 1_000_000, // 10 Lakhs
    cash: 250_000, // 2.5 Lakhs
    positions: [
      {
        symbol: 'INFY',
        companyId: 'comp_infy',
        quantity: 50,
        avgPrice: 1400,
        currentPrice: 1500,
        marketValue: 75_000,
        sector: 'Information Technology',
        unrealisedPnl: 5000,
        unrealisedPnlPct: 0.0714,
      },
    ],
    sectorExposure: {
      'Information Technology': 75_000,
    },
    asOfDate: '2026-11-20T00:00:00.000Z',
  };

  const validTechnicalSetup = {
    id: 'setup_tcs_breakout',
    pattern: {
      name: 'Bullish Engulfing',
      detectedAt: '2026-11-20T00:00:00.000Z',
      timeframe: 'daily' as const,
      confirmation: true,
      qualityScore: 85,
    },
    entryZone: { low: 495, high: 505 },
    stopLoss: 450,
    targets: [600, 680],
    riskReward: 2.0,
    inBuyZone: true,
    contextScore: 80,
  };

  const validDraft = {
    id: 'plan_tcs_001',
    symbol: 'TCS',
    thesis: 'Market leader in IT services with sustained 25%+ operating margins and aggressive AI pipeline conversion.',
    expectedHoldingPeriod: '12-24 months',
    entryRationale: 'Confirmed bullish engulfing at major 200 SMA support with favorable valuation below fair value.',
    entryZone: { low: 495, high: 505 },
    entryPriceEst: 500,
    stopLoss: 450,
    targets: [600, 680],
    valuationMaxBuyPrice: 550,
  };

  describe('1. Position Sizing Math & Downward Adjustment Hierarchy', () => {
    it('calculates exact raw quantity based on risk budget (1% of 10L = 10,000, risk/share = 50 -> 200 shares)', () => {
      const sizing = calculatePositionSizing({
        portfolioValue: 1_000_000,
        availableCash: 300_000,
        entryPrice: 500,
        stopPrice: 450,
        riskPerTradePct: 0.01,
        maxStockExposurePct: 0.15,
        maxSectorExposurePct: 0.35,
        existingStockValue: 0,
        existingSectorValue: 0,
        lotSize: 1,
      });

      expect(sizing.rawQuantity).toBe(200);
      expect(sizing.adjustedQuantity).toBe(200);
      expect(sizing.positionSize).toBe(200);
      expect(sizing.riskBudget).toBe(10_000);
      expect(sizing.riskPerShare).toBe(50);
      expect(sizing.plannedPositionValue).toBe(100_000);
      expect(sizing.plannedLossAtStop).toBe(10_000);
      expect(sizing.actualRiskPct).toBe(0.01);
      expect(sizing.postTradeStockExposurePct).toBe(0.10);
      expect(sizing.cashRemaining).toBe(200_000);
      expect(sizing.limitingFactor).toBe('risk_budget');
    });

    it('rounds down to nearest lot size', () => {
      // 10,000 / 45 = 222.22 -> raw 222 shares. With lotSize = 25 -> 200 shares.
      const sizing = calculatePositionSizing({
        portfolioValue: 1_000_000,
        availableCash: 300_000,
        entryPrice: 495,
        stopPrice: 450,
        riskPerTradePct: 0.01,
        maxStockExposurePct: 0.15,
        maxSectorExposurePct: 0.35,
        existingStockValue: 0,
        existingSectorValue: 0,
        lotSize: 25,
      });

      expect(sizing.rawQuantity).toBe(222);
      expect(sizing.positionSize).toBe(200);
      expect(sizing.positionSize % 25).toBe(0);
      expect(sizing.limitingFactor).toBe('lot_size');
    });

    it('caps position size by liquidity limit (5% of ADV)', () => {
      // Raw = 200 shares. But ADV = 2,000, 5% of ADV = 100 shares.
      const sizing = calculatePositionSizing({
        portfolioValue: 1_000_000,
        availableCash: 300_000,
        entryPrice: 500,
        stopPrice: 450,
        riskPerTradePct: 0.01,
        maxStockExposurePct: 0.15,
        maxSectorExposurePct: 0.35,
        existingStockValue: 0,
        existingSectorValue: 0,
        lotSize: 1,
        avgDailyVolume: 2_000,
        maxPositionPctOfADV: 0.05,
      });

      expect(sizing.rawQuantity).toBe(200);
      expect(sizing.positionSize).toBe(100);
      expect(sizing.limitingFactor).toBe('liquidity');
    });

    it('caps position size by available cash', () => {
      // Raw = 200 shares (requires 100,000). But available cash = 45,000 -> max 90 shares.
      const sizing = calculatePositionSizing({
        portfolioValue: 1_000_000,
        availableCash: 45_000,
        entryPrice: 500,
        stopPrice: 450,
        riskPerTradePct: 0.01,
        maxStockExposurePct: 0.15,
        maxSectorExposurePct: 0.35,
        existingStockValue: 0,
        existingSectorValue: 0,
        lotSize: 1,
      });

      expect(sizing.rawQuantity).toBe(200);
      expect(sizing.positionSize).toBe(90);
      expect(sizing.cashRemaining).toBe(0);
      expect(sizing.limitingFactor).toBe('cash');
    });

    it('caps position size by single-stock concentration cap (accounting for existing holding)', () => {
      // Max stock cap = 10% (100,000). Existing holding = 60,000. Remaining allowed = 40,000.
      // Raw = 200 shares (100,000). But stock cap allows only 40,000 / 500 = 80 shares.
      const sizing = calculatePositionSizing({
        portfolioValue: 1_000_000,
        availableCash: 300_000,
        entryPrice: 500,
        stopPrice: 450,
        riskPerTradePct: 0.01,
        maxStockExposurePct: 0.10,
        maxSectorExposurePct: 0.35,
        existingStockValue: 60_000,
        existingSectorValue: 60_000,
        lotSize: 1,
      });

      expect(sizing.rawQuantity).toBe(200);
      expect(sizing.positionSize).toBe(80);
      expect(sizing.postTradeStockExposurePct).toBe(0.10); // exactly 10%
      expect(sizing.limitingFactor).toBe('stock_cap');
    });

    it('caps position size by sector concentration cap (accounting for existing sector exposure)', () => {
      // Max sector cap = 30% (300,000). Existing sector = 260,000. Remaining allowed = 40,000.
      // Raw = 200 shares (100,000). But sector cap allows only 40,000 / 500 = 80 shares.
      const sizing = calculatePositionSizing({
        portfolioValue: 1_000_000,
        availableCash: 300_000,
        entryPrice: 500,
        stopPrice: 450,
        riskPerTradePct: 0.01,
        maxStockExposurePct: 0.15,
        maxSectorExposurePct: 0.30,
        existingStockValue: 0,
        existingSectorValue: 260_000,
        lotSize: 1,
      });

      expect(sizing.rawQuantity).toBe(200);
      expect(sizing.positionSize).toBe(80);
      expect(sizing.postTradeSectorExposurePct).toBe(0.30); // exactly 30%
      expect(sizing.limitingFactor).toBe('sector_cap');
    });

    it('incorporates fees, slippage, and cash buffer in sizing', () => {
      const sizing = calculatePositionSizing({
        portfolioValue: 1_000_000,
        availableCash: 100_000,
        entryPrice: 500,
        stopPrice: 450,
        riskPerTradePct: 0.01,
        maxStockExposurePct: 0.15,
        maxSectorExposurePct: 0.35,
        existingStockValue: 0,
        existingSectorValue: 0,
        lotSize: 1,
        slippagePct: 0.005, // 0.5% slippage
        estimatedFeesPct: 0.002, // 0.2% fees
        cashBufferPct: 0.10, // 10% cash buffer
      });

      expect(sizing.positionSize).toBeGreaterThan(0);
      expect(sizing.estimatedFees).toBeGreaterThan(0);
      expect(sizing.cashRemaining).toBeGreaterThanOrEqual(10_000); // respects buffer
    });

    it('returns zero position size for invalid pricing or non-positive portfolio value', () => {
      const invalidStop = calculatePositionSizing({
        portfolioValue: 1_000_000,
        availableCash: 100_000,
        entryPrice: 500,
        stopPrice: 550, // invalid: stop above entry
        riskPerTradePct: 0.01,
        maxStockExposurePct: 0.10,
        maxSectorExposurePct: 0.30,
        existingStockValue: 0,
        existingSectorValue: 0,
      });
      expect(invalidStop.positionSize).toBe(0);
      expect(invalidStop.limitingFactor).toBe('invalid_inputs');

      const invalidPortfolio = calculatePositionSizing({
        portfolioValue: 0,
        availableCash: 100_000,
        entryPrice: 500,
        stopPrice: 450,
        riskPerTradePct: 0.01,
        maxStockExposurePct: 0.10,
        maxSectorExposurePct: 0.30,
        existingStockValue: 0,
        existingSectorValue: 0,
      });
      expect(invalidPortfolio.positionSize).toBe(0);
      expect(invalidPortfolio.limitingFactor).toBe('invalid_inputs');
    });
  });

  describe('2. Portfolio Risk Checks & Guardrails', () => {
    it('passes all 7 checks on a compliant trade plan and transitions status to ready', () => {
      const input: StageFInput = {
        companyId: 'comp_tcs',
        symbol: 'TCS',
        sector: 'Information Technology',
        portfolio: basePortfolio,
        tradePlanDraft: validDraft,
        technicalSetup: validTechnicalSetup,
        avgDailyVolume: 50_000,
      };

      const output = scoreStageF(input);

      expect(output.blocked).toBe(false);
      expect(output.gatePassed).toBe(true);
      expect(output.canApprovePlan).toBe(true);
      expect(output.canProceedToStageG).toBe(true);
      expect(output.tradePlan.status).toBe('ready');
      expect(output.verdict).toBe('PASS');
      expect(output.riskChecks).toHaveLength(7);
      expect(output.riskChecks.every((c) => c.passed)).toBe(true);
      expect(output.hardStops).toHaveLength(0);
    });

    it('emits HARD_STOP: STAGE_F_INVALID_STOP_LOSS when stop >= entry and sets positionSize = 0', () => {
      const input: StageFInput = {
        companyId: 'comp_tcs',
        symbol: 'TCS',
        portfolio: basePortfolio,
        tradePlanDraft: {
          ...validDraft,
          entryPriceEst: 500,
          stopLoss: 520, // stop above entry!
        },
      };

      const output = scoreStageF(input);

      expect(output.blocked).toBe(true);
      expect(output.gatePassed).toBe(false);
      expect(output.tradePlan.status).toBe('draft');
      expect(output.tradePlan.positionSize).toBe(0);
      const stopCheck = output.riskChecks.find((c) => c.check === 'stop_below_entry');
      expect(stopCheck?.passed).toBe(false);
      expect(output.hardStops.some((f) => f.flagKey === 'STAGE_F_INVALID_STOP_LOSS')).toBe(true);
    });

    it('emits HARD_STOP: STAGE_F_RISK_BUDGET_EXCEEDED when requested quantity risks more than budget', () => {
      // 1% budget = 10,000. Risk/share = 50. Requesting 500 shares = 25,000 risk (2.5% of 10L).
      const input: StageFInput = {
        companyId: 'comp_tcs',
        symbol: 'TCS',
        portfolio: basePortfolio,
        tradePlanDraft: validDraft,
        requestedQuantity: 500,
      };

      const output = scoreStageF(input);

      expect(output.blocked).toBe(true);
      expect(output.gatePassed).toBe(false);
      const riskCheck = output.riskChecks.find((c) => c.check === 'risk_budget');
      expect(riskCheck?.passed).toBe(false);
      expect(output.hardStops.some((f) => f.flagKey === 'STAGE_F_RISK_BUDGET_EXCEEDED')).toBe(true);
    });

    it('emits HARD_STOP: STAGE_F_STOCK_CAP_EXCEEDED when requested quantity breaches 10% stock cap', () => {
      // Portfolio = 10L. 10% cap = 100k. Requesting 300 shares @ 500 = 150k (15% exposure).
      const input: StageFInput = {
        companyId: 'comp_tcs',
        symbol: 'TCS',
        portfolio: basePortfolio,
        tradePlanDraft: validDraft,
        requestedQuantity: 300,
      };

      const output = scoreStageF(input);

      expect(output.blocked).toBe(true);
      const stockCheck = output.riskChecks.find((c) => c.check === 'stock_concentration');
      expect(stockCheck?.passed).toBe(false);
      expect(output.hardStops.some((f) => f.flagKey === 'STAGE_F_STOCK_CAP_EXCEEDED')).toBe(true);
    });

    it('emits HARD_STOP: STAGE_F_SECTOR_CAP_EXCEEDED when trade pushes sector exposure beyond 30%', () => {
      // Existing IT exposure = 250,000 (25%). Cap = 300,000 (30%).
      // Planning 200 shares @ 500 = 100,000 new exposure -> total 350,000 (35%).
      const highSectorPortfolio: PortfolioSnapshot = {
        ...basePortfolio,
        sectorExposure: {
          'Information Technology': 250_000,
        },
      };

      const input: StageFInput = {
        companyId: 'comp_tcs',
        symbol: 'TCS',
        sector: 'Information Technology',
        portfolio: highSectorPortfolio,
        tradePlanDraft: validDraft,
        requestedQuantity: 200,
      };

      const output = scoreStageF(input);

      expect(output.blocked).toBe(true);
      const sectorCheck = output.riskChecks.find((c) => c.check === 'sector_concentration');
      expect(sectorCheck?.passed).toBe(false);
      expect(output.hardStops.some((f) => f.flagKey === 'STAGE_F_SECTOR_CAP_EXCEEDED')).toBe(true);
    });

    it('emits HARD_STOP: STAGE_F_INSUFFICIENT_CASH when trade requires more cash than available', () => {
      const lowCashPortfolio: PortfolioSnapshot = {
        ...basePortfolio,
        cash: 20_000, // only 20k cash
      };

      const input: StageFInput = {
        companyId: 'comp_tcs',
        symbol: 'TCS',
        portfolio: lowCashPortfolio,
        tradePlanDraft: validDraft,
        requestedQuantity: 100, // requires 50k cash
      };

      const output = scoreStageF(input);

      expect(output.blocked).toBe(true);
      const cashCheck = output.riskChecks.find((c) => c.check === 'cash');
      expect(cashCheck?.passed).toBe(false);
      expect(output.hardStops.some((f) => f.flagKey === 'STAGE_F_INSUFFICIENT_CASH')).toBe(true);
    });

    it('emits CONDITIONAL_WARNING: STAGE_F_LIQUIDITY_WARNING when position exceeds 5% of ADV', () => {
      // ADV = 1,000 -> 5% = 50 shares. Sizing = 100 shares.
      const input: StageFInput = {
        companyId: 'comp_tcs',
        symbol: 'TCS',
        portfolio: basePortfolio,
        tradePlanDraft: validDraft,
        avgDailyVolume: 1_000,
        requestedQuantity: 100,
      };

      const output = scoreStageF(input);

      const liquidityCheck = output.riskChecks.find((c) => c.check === 'liquidity');
      expect(liquidityCheck?.passed).toBe(false);
      expect(output.conditionalWarnings.some((f) => f.flagKey === 'STAGE_F_LIQUIDITY_WARNING')).toBe(true);
    });

    it('emits HARD_STOP: STAGE_F_RISK_REWARD_BELOW_MINIMUM when RR < 1.5', () => {
      // Entry = 500, Stop = 450 (Risk = 50). Target 1 = 550 (Reward = 50). RR = 1.0 < 1.5.
      const input: StageFInput = {
        companyId: 'comp_tcs',
        symbol: 'TCS',
        portfolio: basePortfolio,
        tradePlanDraft: {
          ...validDraft,
          entryPriceEst: 500,
          stopLoss: 450,
          targets: [550],
        },
      };

      const output = scoreStageF(input);

      expect(output.blocked).toBe(true);
      const rrCheck = output.riskChecks.find((c) => c.check === 'risk_reward');
      expect(rrCheck?.passed).toBe(false);
      expect(output.hardStops.some((f) => f.flagKey === 'STAGE_F_RISK_REWARD_BELOW_MINIMUM')).toBe(true);
    });

    it('emits DATA_QUALITY_WARNING: STAGE_F_PLAN_INCOMPLETE when thesis or rationale are missing', () => {
      const input: StageFInput = {
        companyId: 'comp_tcs',
        symbol: 'TCS',
        portfolio: basePortfolio,
        tradePlanDraft: {
          ...validDraft,
          thesis: '', // missing!
          entryRationale: '', // missing!
        },
      };

      const output = scoreStageF(input);

      expect(output.dataQualityWarnings.some((f) => f.flagKey === 'STAGE_F_PLAN_INCOMPLETE')).toBe(true);
      expect(output.verdict).toBe('INCOMPLETE');
    });

    it('emits VALUATION_WARNING: STAGE_F_ENTRY_ABOVE_MAX_BUY_PRICE when entry exceeds valuation ceiling', () => {
      const input: StageFInput = {
        companyId: 'comp_tcs',
        symbol: 'TCS',
        portfolio: basePortfolio,
        tradePlanDraft: {
          ...validDraft,
          entryPriceEst: 600,
          valuationMaxBuyPrice: 550, // ceiling exceeded!
          stopLoss: 520,
          targets: [750],
        },
      };

      const output = scoreStageF(input);

      expect(output.valuationWarnings.some((f) => f.flagKey === 'STAGE_F_ENTRY_ABOVE_MAX_BUY_PRICE')).toBe(true);
    });
  });

  describe('3. Auditable Override Mechanism', () => {
    it('accepts valid override (>= 50 chars), unlocks blocked plan, and preserves flag as OVERRIDDEN', () => {
      // Cause stock concentration breach with 200 shares @ 500 = 100k + 75k existing = 175k (17.5% > 10% cap)
      const input: StageFInput = {
        companyId: 'comp_infy',
        symbol: 'INFY',
        portfolio: basePortfolio,
        tradePlanDraft: {
          ...validDraft,
          symbol: 'INFY',
          entryPriceEst: 500,
          stopLoss: 450,
          targets: [600],
        },
        requestedQuantity: 200,
        overrides: [
          {
            flagId: 'STAGE_F_STOCK_CAP_EXCEEDED',
            reason: 'High conviction blue-chip turnaround with strong earnings acceleration and board approval for core strategic expansion.', // 124 chars
            overriddenBy: 'portfolio_manager_42',
            overriddenAt: '2026-11-20T12:00:00.000Z',
            beforeState: {},
            afterState: {},
          },
        ],
      };

      const output = scoreStageF(input);

      // Plan must now be UNLOCKED
      expect(output.blocked).toBe(false);
      expect(output.gatePassed).toBe(true);
      expect(output.canApprovePlan).toBe(true);
      expect(output.tradePlan.status).toBe('ready');

      // Flag must still exist but with status: OVERRIDDEN
      const overriddenFlag = output.flags.find((f) => f.flagKey === 'STAGE_F_STOCK_CAP_EXCEEDED');
      expect(overriddenFlag).toBeDefined();
      expect(overriddenFlag?.status).toBe('OVERRIDDEN');
      expect(overriddenFlag?.isOverride).toBe(true);
      expect(overriddenFlag?.overrideReason).toContain('High conviction blue-chip');
      expect(overriddenFlag?.overriddenBy).toBe('portfolio_manager_42');

      // Valid overrides recorded in trade plan
      expect(output.tradePlan.overrides).toHaveLength(1);
      expect(output.tradePlan.overrides[0]!.flagId).toBe('STAGE_F_STOCK_CAP_EXCEEDED');
    });

    it('rejects override if reason is under 50 characters and keeps plan blocked', () => {
      const input: StageFInput = {
        companyId: 'comp_infy',
        symbol: 'INFY',
        portfolio: basePortfolio,
        tradePlanDraft: {
          ...validDraft,
          symbol: 'INFY',
          entryPriceEst: 500,
          stopLoss: 450,
          targets: [600],
        },
        requestedQuantity: 200,
        overrides: [
          {
            flagId: 'STAGE_F_STOCK_CAP_EXCEEDED',
            reason: 'Manager override requested by client.', // 37 chars (< 50)
            overriddenBy: 'analyst_1',
            overriddenAt: '2026-11-20T12:00:00.000Z',
            beforeState: {},
            afterState: {},
          },
        ],
      };

      const output = scoreStageF(input);

      // Still BLOCKED
      expect(output.blocked).toBe(true);
      expect(output.gatePassed).toBe(false);
      expect(output.tradePlan.status).toBe('draft');

      // Flag remains ACTIVE
      const stockFlag = output.flags.find((f) => f.flagKey === 'STAGE_F_STOCK_CAP_EXCEEDED');
      expect(stockFlag?.status).toBe('ACTIVE');

      // Emits warning about short override reason
      expect(output.dataQualityWarnings.some((f) => f.flagKey === 'STAGE_F_OVERRIDE_REASON_TOO_SHORT')).toBe(true);
    });
  });

  describe('4. Invariants, Aliases & Disclaimers', () => {
    it('always includes the mandatory stop-loss execution non-guarantee disclaimer', () => {
      const input: StageFInput = {
        companyId: 'comp_tcs',
        symbol: 'TCS',
        portfolio: basePortfolio,
        tradePlanDraft: validDraft,
      };

      const output = scoreStageF(input);

      expect(output.disclaimer).toBe(DISCLAIMER_STOP_LOSS_NON_GUARANTEE);
      expect(output.disclaimer).toContain('Stop-loss orders do not guarantee execution');
    });

    it('guarantees identical outputs across aliases (scoreStageF, planStageF, evaluateStageF, buildTradePlan)', () => {
      const input: StageFInput = {
        companyId: 'comp_tcs',
        symbol: 'TCS',
        portfolio: basePortfolio,
        tradePlanDraft: validDraft,
      };

      const out1 = scoreStageF(input);
      const out2 = planStageF(input);
      const out3 = evaluateStageF(input);
      const out4 = buildTradePlan(input);

      expect(out1.positionSizing.positionSize).toBe(out2.positionSizing.positionSize);
      expect(out2.positionSizing.positionSize).toBe(out3.positionSizing.positionSize);
      expect(out3.positionSizing.positionSize).toBe(out4.positionSizing.positionSize);
      expect(out1.tradePlan.status).toBe(out4.tradePlan.status);
    });

    it('preserves mathematical invariants: non-negative sizing and exact cash accounting', () => {
      const input: StageFInput = {
        companyId: 'comp_tcs',
        symbol: 'TCS',
        portfolio: basePortfolio,
        tradePlanDraft: validDraft,
      };

      const output = scoreStageF(input);
      const sizing = output.positionSizing;

      expect(sizing.positionSize).toBeGreaterThanOrEqual(0);
      expect(sizing.cashRemaining).toBeGreaterThanOrEqual(0);
      expect(sizing.cashRemaining).toBe(
        basePortfolio.cash - (sizing.plannedPositionValue + sizing.estimatedFees)
      );
    });

    it('exports all standard defaults and threshold constants', () => {
      expect(DEFAULT_RISK_PER_TRADE_PCT).toBe(0.01);
      expect(DEFAULT_MAX_STOCK_EXPOSURE_PCT).toBe(0.10);
      expect(DEFAULT_MAX_SECTOR_EXPOSURE_PCT).toBe(0.30);
      expect(STAGE_F_DEFAULT_MIN_RISK_REWARD).toBe(1.5);
      expect(DEFAULT_MAX_POSITION_PCT_OF_ADV).toBe(0.05);
      expect(DEFAULT_LOT_SIZE).toBe(1);
      expect(MIN_OVERRIDE_REASON_LENGTH).toBe(50);
    });
  });
});
