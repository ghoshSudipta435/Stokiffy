import { describe, expect, it } from 'vitest';
import {
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
} from '../src/index.js';
import type {
  Alert,
  JournalEntry,
  PortfolioSnapshot,
  PositionWithThesis,
  PostTradeReview,
  StageGInput,
} from '../src/types/index.js';

describe('Stage G — Monitoring, Sell/Trim Decision Framework & Trade Journal / P&L Attribution', () => {
  const basePortfolio: PortfolioSnapshot = {
    totalValue: 1_000_000,
    cash: 200_000,
    positions: [
      {
        symbol: 'TCS',
        companyId: 'comp_tcs',
        quantity: 100,
        avgPrice: 3000,
        currentPrice: 3200,
        marketValue: 320_000,
        sector: 'Information Technology',
        unrealisedPnl: 20_000,
        unrealisedPnlPct: 0.0667,
      },
    ],
    sectorExposure: {
      'Information Technology': 320_000,
    },
    asOfDate: '2026-11-20T00:00:00.000Z',
  };

  const basePositionWithThesis: PositionWithThesis = {
    symbol: 'TCS',
    companyId: 'comp_tcs',
    quantity: 100,
    avgPrice: 3000,
    currentPrice: 3200,
    marketValue: 320_000,
    sector: 'Information Technology',
    unrealisedPnl: 20_000,
    unrealisedPnlPct: 0.0667,
    thesis: 'Leading IT services enterprise with industry-best 26% operating margin and strong balance sheet.',
    stopLoss: 2800,
    targets: [3500, 3800],
    fairValue: 3400,
    maxBuyPrice: 3100,
    entryDate: '2026-09-01T00:00:00.000Z',
    daysHeld: 80,
    unrealisedReturnPct: 0.0667,
    alertCount: 0,
    tradePlanId: 'tp_tcs_001',
    thesisStatus: 'intact',
  };

  describe('1. Monitoring Alert Evaluators (4 Domains)', () => {
    it('detects price stop breach with critical severity', () => {
      const alerts = evaluateAlerts({
        positions: [basePositionWithThesis],
        portfolio: basePortfolio,
        currentPrices: { TCS: 2750 }, // below stopLoss 2800
      });

      const stopAlert = alerts.find((a) => a.type === 'price-stop');
      expect(stopAlert).toBeDefined();
      expect(stopAlert?.severity).toBe('critical');
      expect(stopAlert?.message).toContain('Stop-loss invalidation breach');
      expect(stopAlert?.data['currentPrice']).toBe(2750);
    });

    it('detects target price reached with warning severity', () => {
      const alerts = evaluateAlerts({
        positions: [basePositionWithThesis],
        portfolio: basePortfolio,
        currentPrices: { TCS: 3550 }, // above target 3500
      });

      const targetAlert = alerts.find((a) => a.type === 'price-target');
      expect(targetAlert).toBeDefined();
      expect(targetAlert?.severity).toBe('warning');
      expect(targetAlert?.message).toContain('Target 1 reached');
    });

    it('detects estimated fair value reached', () => {
      const alerts = evaluateAlerts({
        positions: [basePositionWithThesis],
        portfolio: basePortfolio,
        currentPrices: { TCS: 3420 }, // above fairValue 3400
      });

      const fairAlert = alerts.find((a) => a.type === 'price-fair-value');
      expect(fairAlert).toBeDefined();
      expect(fairAlert?.message).toContain('Estimated fair value reached');
    });

    it('detects material overvaluation (>= 120% of fair value)', () => {
      // Fair value = 3400. 120% = 4080.
      const alerts = evaluateAlerts({
        positions: [basePositionWithThesis],
        portfolio: basePortfolio,
        currentPrices: { TCS: 4150 },
      });

      const overvalAlert = alerts.find((a) => a.type === 'price-overvalued');
      expect(overvalAlert).toBeDefined();
      expect(overvalAlert?.severity).toBe('warning');
      expect(overvalAlert?.message).toContain('materially exceeds fair value');
    });

    it('detects price in entry zone', () => {
      // maxBuyPrice = 3100. Current price = 3050.
      const alerts = evaluateAlerts({
        positions: [basePositionWithThesis],
        portfolio: basePortfolio,
        currentPrices: { TCS: 3050 },
      });

      const entryAlert = alerts.find((a) => a.type === 'price-entry-zone');
      expect(entryAlert).toBeDefined();
      expect(entryAlert?.severity).toBe('info');
    });

    it('detects fundamental deterioration and governance alerts', () => {
      const alerts = evaluateAlerts({
        positions: [basePositionWithThesis],
        portfolio: basePortfolio,
        fundamentalContext: {
          TCS: {
            roceDropPct: 0.06, // 6% drop
            cfoVsPatRatio: 0.40, // weak cash conversion
            debtorDaysIncrease: 35, // rising debtor days
            pledgeIncreasePct: 0.05, // governance red flag
          },
        },
      });

      const fundDetAlert = alerts.find((a) => a.type === 'fundamental-deterioration');
      expect(fundDetAlert).toBeDefined();
      expect(fundDetAlert?.message).toContain('Fundamental deterioration detected');

      const govAlert = alerts.find((a) => a.type === 'fundamental-governance');
      expect(govAlert).toBeDefined();
      expect(govAlert?.severity).toBe('critical');
    });

    it('detects broken thesis with critical severity', () => {
      const alerts = evaluateAlerts({
        positions: [basePositionWithThesis],
        portfolio: basePortfolio,
        thesisContext: {
          TCS: {
            status: 'broken',
            brokenAssumptions: ['Operating margin collapsed below 18%', 'Lost top banking anchor customer'],
          },
        },
      });

      const thesisAlert = alerts.find((a) => a.type === 'thesis-broken');
      expect(thesisAlert).toBeDefined();
      expect(thesisAlert?.severity).toBe('critical');
      expect(thesisAlert?.message).toContain('Original investment thesis broken');
    });

    it('detects portfolio-level concentration, drawdown, and cash buffer alerts', () => {
      const highExpPortfolio: PortfolioSnapshot = {
        totalValue: 1_000_000,
        cash: 30_000, // 3% cash (below 5% buffer)
        positions: [
          {
            symbol: 'TCS',
            companyId: 'comp_tcs',
            quantity: 50,
            avgPrice: 3000,
            currentPrice: 3500,
            marketValue: 175_000, // 17.5% > 10% stock cap
            sector: 'Information Technology',
            unrealisedPnl: 25_000,
            unrealisedPnlPct: 0.1667,
          },
        ],
        sectorExposure: {
          'Information Technology': 350_000, // 35% > 30% sector cap
        },
        asOfDate: '2026-11-20T00:00:00.000Z',
      };

      const alerts = evaluateAlerts({
        positions: [],
        portfolio: highExpPortfolio,
        portfolioPeakValue: 1_250_000, // 20% drawdown (1,000,000 vs 1,250,000)
      });

      const stockConcAlert = alerts.find((a) => a.type === 'portfolio-concentration' && a.symbol === 'TCS');
      expect(stockConcAlert).toBeDefined();

      const secConcAlert = alerts.find((a) => a.type === 'portfolio-concentration' && a.message.includes('Information Technology'));
      expect(secConcAlert).toBeDefined();

      const cashAlert = alerts.find((a) => a.type === 'portfolio-drawdown' && a.message.includes('Cash buffer low'));
      expect(cashAlert).toBeDefined();

      const ddAlert = alerts.find((a) => a.type === 'portfolio-drawdown' && a.severity === 'critical');
      expect(ddAlert).toBeDefined();
      expect(ddAlert?.message).toContain('drawdown breach');
    });
  });

  describe('2. Sell / Trim Decision Framework (Manual Confirmation Only)', () => {
    it('recommends EXIT_CANDIDATE when thesis is broken and enforces manual confirmation', () => {
      const alerts: Alert[] = [
        {
          id: 'a1',
          type: 'thesis-broken',
          severity: 'critical',
          message: 'Core moat broken.',
          triggeredAt: '2026-11-20T00:00:00.000Z',
          data: {},
        },
      ];

      const rec = evaluateSellDecision({
        alerts,
        position: basePositionWithThesis,
        portfolio: basePortfolio,
      });

      expect(rec.decision).toBe('sell');
      expect(rec.recommendedAction).toBe('EXIT_CANDIDATE');
      expect(rec.priority).toBe('CRITICAL');
      expect(rec.suggestedQuantity).toBe(100);
      expect(rec.requiresManualConfirmation).toBe(true);
    });

    it('recommends EXIT_CANDIDATE when stop loss is breached', () => {
      const alerts: Alert[] = [
        {
          id: 'a2',
          type: 'price-stop',
          severity: 'critical',
          message: 'Stop hit.',
          triggeredAt: '2026-11-20T00:00:00.000Z',
          data: {},
        },
      ];

      const rec = evaluateSellDecision({
        alerts,
        position: basePositionWithThesis,
        portfolio: basePortfolio,
      });

      expect(rec.decision).toBe('sell');
      expect(rec.recommendedAction).toBe('EXIT_CANDIDATE');
      expect(rec.priority).toBe('CRITICAL');
      expect(rec.requiresManualConfirmation).toBe(true);
    });

    it('recommends REVIEW_REQUIRED (hold) on critical fundamental red flags without auto-selling', () => {
      const alerts: Alert[] = [
        {
          id: 'a3',
          type: 'fundamental-deterioration',
          severity: 'critical',
          message: 'Audit disclaimer received.',
          triggeredAt: '2026-11-20T00:00:00.000Z',
          data: {},
        },
      ];

      const rec = evaluateSellDecision({
        alerts,
        position: basePositionWithThesis,
        portfolio: basePortfolio,
      });

      expect(rec.decision).toBe('hold');
      expect(rec.recommendedAction).toBe('REVIEW_REQUIRED');
      expect(rec.priority).toBe('HIGH');
      expect(rec.requiresManualConfirmation).toBe(true);
    });

    it('recommends TRIM_CANDIDATE (50% default) when price is overvalued or target reached', () => {
      const alerts: Alert[] = [
        {
          id: 'a4',
          type: 'price-overvalued',
          severity: 'warning',
          message: 'Price > 120% fair value.',
          triggeredAt: '2026-11-20T00:00:00.000Z',
          data: {},
        },
      ];

      const rec = evaluateSellDecision({
        alerts,
        position: basePositionWithThesis,
        portfolio: basePortfolio,
      });

      expect(rec.decision).toBe('trim');
      expect(rec.recommendedAction).toBe('TRIM_CANDIDATE');
      expect(rec.suggestedQuantity).toBe(50); // 50% of 100
      expect(rec.requiresManualConfirmation).toBe(true);
    });

    it('recommends HOLD for healthy positions operating within normal bounds', () => {
      const rec = evaluateSellDecision({
        alerts: [],
        position: basePositionWithThesis,
        portfolio: basePortfolio,
      });

      expect(rec.decision).toBe('hold');
      expect(rec.recommendedAction).toBe('HOLD');
      expect(rec.priority).toBe('LOW');
      expect(rec.requiresManualConfirmation).toBe(true);
    });
  });

  describe('3. Position P&L & Return Calculator (Decimal.js)', () => {
    it('calculates weighted-average cost basis across multiple buys', () => {
      const transactions: JournalEntry[] = [
        {
          id: 'tx1',
          tradePlanId: 'tp1',
          symbol: 'TCS',
          date: '2026-01-10T00:00:00.000Z',
          action: 'buy',
          quantity: 100,
          price: 1000,
          fees: 20,
          taxes: 5,
          reason: 'Initial allocation',
          ruleTriggers: [],
          portfolioContext: basePortfolio,
          corporateActions: [],
        },
        {
          id: 'tx2',
          tradePlanId: 'tp1',
          symbol: 'TCS',
          date: '2026-02-10T00:00:00.000Z',
          action: 'buy',
          quantity: 100,
          price: 1200,
          fees: 20,
          taxes: 5,
          reason: 'Pyramid add on breakout',
          ruleTriggers: [],
          portfolioContext: basePortfolio,
          corporateActions: [],
        },
      ];

      // Total invested = (100,000 + 25) + (120,000 + 25) = 220,050.
      // Total shares = 200. WACB = 220,050 / 200 = 1100.25.
      const pnl = calculatePositionPnL(transactions, 1300, 'TCS');

      expect(pnl.totalQuantity).toBe(200);
      expect(pnl.totalInvestedCapital).toBe(220_050);
      expect(pnl.weightedAvgCostBasis).toBe(1100.25);
      expect(pnl.currentMarketValue).toBe(260_000);
      expect(pnl.unrealisedPnl).toBe(39_950);
      expect(pnl.realisedPnl).toBe(0);
      expect(pnl.isClosed).toBe(false);
      expect(pnl.netReturnPct).toBe(0.1815); // 39,950 / 220,050
    });

    it('calculates realised P&L on partial trims while retaining cost basis for remaining shares', () => {
      const transactions: JournalEntry[] = [
        {
          id: 'tx1',
          tradePlanId: 'tp1',
          symbol: 'TCS',
          date: '2026-01-10T00:00:00.000Z',
          action: 'buy',
          quantity: 200,
          price: 1000,
          fees: 50,
          taxes: 10,
          reason: 'Initial buy',
          ruleTriggers: [],
          portfolioContext: basePortfolio,
          corporateActions: [],
        },
        {
          id: 'tx2',
          tradePlanId: 'tp1',
          symbol: 'TCS',
          date: '2026-03-15T00:00:00.000Z',
          action: 'trim',
          quantity: 100,
          price: 1500,
          fees: 50,
          taxes: 20,
          reason: 'Trim at fair value',
          ruleTriggers: [],
          portfolioContext: basePortfolio,
          corporateActions: [],
        },
      ];

      // Buy: 200 * 1000 + 60 = 200,060 -> WACB = 1000.30.
      // Trim: Sold 100 @ 1500 = 150,000 gross. Net = 150,000 - 70 = 149,930.
      // Cost of sold: 100 * 1000.30 = 100,030. Realised gain = 149,930 - 100,030 = 49,900.
      const pnl = calculatePositionPnL(transactions, 1600, 'TCS');

      expect(pnl.totalQuantity).toBe(100);
      expect(pnl.weightedAvgCostBasis).toBe(1000.30);
      expect(pnl.realisedPnl).toBe(49_900);
      expect(pnl.currentMarketValue).toBe(160_000);
      expect(pnl.unrealisedPnl).toBe(59_970); // 160,000 - 100,030
      expect(pnl.netPnl).toBe(109_870); // 49,900 + 59,970
      expect(pnl.isClosed).toBe(false);
    });

    it('handles full exit, marking position closed with 0 remaining shares and 0 unrealised P&L', () => {
      const transactions: JournalEntry[] = [
        {
          id: 'tx1',
          tradePlanId: 'tp1',
          symbol: 'TCS',
          date: '2026-01-10T00:00:00.000Z',
          action: 'buy',
          quantity: 100,
          price: 1000,
          fees: 20,
          taxes: 5,
          reason: 'Initial buy',
          ruleTriggers: [],
          portfolioContext: basePortfolio,
          corporateActions: [],
        },
        {
          id: 'tx2',
          tradePlanId: 'tp1',
          symbol: 'TCS',
          date: '2026-04-10T00:00:00.000Z',
          action: 'sell',
          quantity: 100,
          price: 1200,
          fees: 20,
          taxes: 10,
          reason: 'Stop loss hit',
          ruleTriggers: [],
          portfolioContext: basePortfolio,
          corporateActions: [],
        },
      ];

      const pnl = calculatePositionPnL(transactions, 1200, 'TCS');

      expect(pnl.totalQuantity).toBe(0);
      expect(pnl.currentMarketValue).toBe(0);
      expect(pnl.unrealisedPnl).toBe(0);
      expect(pnl.isClosed).toBe(true);
      expect(pnl.realisedPnl).toBeGreaterThan(0);
    });

    it('tracks dividends separately and includes them in realised return', () => {
      const transactions: JournalEntry[] = [
        {
          id: 'tx1',
          tradePlanId: 'tp1',
          symbol: 'TCS',
          date: '2026-01-10T00:00:00.000Z',
          action: 'buy',
          quantity: 100,
          price: 1000,
          fees: 0,
          taxes: 0,
          reason: 'Initial buy',
          ruleTriggers: [],
          portfolioContext: basePortfolio,
          corporateActions: [
            {
              type: 'dividend',
              date: '2026-02-15T00:00:00.000Z',
              amount: 25, // 25 per share * 100 = 2500
            },
          ],
        },
      ];

      const pnl = calculatePositionPnL(transactions, 1000, 'TCS');

      expect(pnl.totalDividends).toBe(2500);
      expect(pnl.realisedPnl).toBe(2500);
      expect(pnl.netPnl).toBe(2500); // 2500 div + 0 cap gain
    });

    it('adjusts position quantity and cost basis on stock splits and bonuses', () => {
      const transactions: JournalEntry[] = [
        {
          id: 'tx1',
          tradePlanId: 'tp1',
          symbol: 'TCS',
          date: '2026-01-10T00:00:00.000Z',
          action: 'buy',
          quantity: 100,
          price: 1000,
          fees: 0,
          taxes: 0,
          reason: 'Initial buy',
          ruleTriggers: [],
          portfolioContext: basePortfolio,
          corporateActions: [
            {
              type: 'split',
              date: '2026-02-01T00:00:00.000Z',
              ratio: '2:1', // 2 for 1
            },
          ],
        },
      ];

      // 100 shares split 2:1 -> 200 shares. Total cost 100,000 -> WACB = 500.
      const pnl = calculatePositionPnL(transactions, 600, 'TCS');

      expect(pnl.totalQuantity).toBe(200);
      expect(pnl.weightedAvgCostBasis).toBe(500);
      expect(pnl.currentMarketValue).toBe(120_000);
      expect(pnl.unrealisedPnl).toBe(20_000);
    });

    it('protects against overselling by clamping quantity and recording violation without producing negative holdings', () => {
      const transactions: JournalEntry[] = [
        {
          id: 'tx1',
          tradePlanId: 'tp1',
          symbol: 'TCS',
          date: '2026-01-10T00:00:00.000Z',
          action: 'buy',
          quantity: 50,
          price: 1000,
          fees: 0,
          taxes: 0,
          reason: 'Initial buy',
          ruleTriggers: [],
          portfolioContext: basePortfolio,
          corporateActions: [],
        },
        {
          id: 'tx2',
          tradePlanId: 'tp1',
          symbol: 'TCS',
          date: '2026-02-10T00:00:00.000Z',
          action: 'sell',
          quantity: 80, // tried to sell 80 shares when only 50 held!
          price: 1100,
          fees: 0,
          taxes: 0,
          reason: 'Oversell error',
          ruleTriggers: [],
          portfolioContext: basePortfolio,
          corporateActions: [],
        },
      ];

      const pnl = calculatePositionPnL(transactions, 1100, 'TCS');

      expect(pnl.totalQuantity).toBe(0); // clamped, NEVER negative
      expect(pnl.isClosed).toBe(true);
      expect(pnl.violations).toBeDefined();
      expect(pnl.violations?.[0]).toContain('Oversell detected');
    });
  });

  describe('4. Trade Journal & Immutable Decision Snapshot Validation', () => {
    const originalEntry: JournalEntry = {
      id: 'j_001',
      tradePlanId: 'tp_001',
      date: '2026-01-10T00:00:00.000Z',
      action: 'buy',
      quantity: 100,
      price: 1000,
      fees: 20,
      taxes: 5,
      reason: 'Original thesis: strong order book growth and margin expansion.',
      ruleTriggers: ['STAGE_E_BULLISH_ENGULFING'],
      portfolioContext: basePortfolio,
      corporateActions: [],
    };

    it('rejects hindsight edits to original execution price, quantity, or entry rationale', () => {
      const modifiedEntry: JournalEntry = {
        ...originalEntry,
        reason: 'Rewritten with hindsight: I bought because I saw momentum.',
      };

      const result = validateJournalEntryImmutability(originalEntry, modifiedEntry);

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('original entry rationale cannot be edited in hindsight'))).toBe(true);
    });

    it('accepts appending a PostTradeReview without modifying the original execution snapshot', () => {
      const postReview: PostTradeReview = {
        rulesWorked: ['Technical support held', 'Valuation safety band'],
        assumptionsFailed: ['Guidance cut unexpectedly in Q3'],
        executionQuality: 'good',
        slippage: 0.5,
        behaviouralNotes: 'Remained patient and adhered to stop loss.',
        lesson: 'Always inspect customer concentration before position sizing.',
        reviewedAt: '2026-11-20T00:00:00.000Z',
        reviewedBy: 'investor_alex',
      };

      const entryWithReview: JournalEntry = {
        ...originalEntry,
        review: postReview,
      };

      const result = validateJournalEntryImmutability(originalEntry, entryWithReview);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);

      const reviewValidation = validatePostTradeReview(postReview);
      expect(reviewValidation.valid).toBe(true);
      expect(reviewValidation.missingFields).toHaveLength(0);
    });

    it('validates incomplete post-trade reviews and detects missing required review fields', () => {
      const incompleteReview: Partial<PostTradeReview> = {
        rulesWorked: ['Technical support held'],
        // missing lesson, reviewedBy
      };

      const validation = validatePostTradeReview(incompleteReview);

      expect(validation.valid).toBe(false);
      expect(validation.missingFields).toContain('lesson');
      expect(validation.missingFields).toContain('reviewedBy');
    });
  });

  describe('5. Stage G Monitoring Engine Execution & Invariants', () => {
    it('executes full Stage G evaluation and generates portfolio health and rule results', () => {
      const input: StageGInput = {
        portfolio: basePortfolio,
        openPositions: [basePositionWithThesis],
        currentPrices: { TCS: 3200 },
      };

      const output = scoreStageG(input);

      expect(output.stage).toBe('G');
      expect(output.portfolioHealth.concentrationOk).toBe(false); // 32% IT sector > 30%
      expect(output.portfolioHealth.drawdownOk).toBe(true);
      expect(output.portfolioHealth.cashBufferOk).toBe(true);
      expect(output.ruleResults).toHaveLength(7);
      expect(output.verdict).toBe('CONDITIONAL');
    });

    it('emits HARD_STOP and sets FAIL verdict when critical drawdown or broken thesis occurs', () => {
      const input: StageGInput = {
        portfolio: basePortfolio,
        openPositions: [
          {
            ...basePositionWithThesis,
            thesisStatus: 'broken',
            brokenAssumptions: ['Lost key banking client'],
          },
        ],
        currentPrices: { TCS: 2700 }, // stop loss breached
      };

      const output = scoreStageG(input);

      expect(output.verdict).toBe('FAIL');
      expect(output.hardStops.length).toBeGreaterThan(0);
      expect(output.hardStops.some((f) => f.flagKey === 'STAGE_G_THESIS_BROKEN')).toBe(true);
      expect(output.hardStops.some((f) => f.flagKey === 'STAGE_G_STOP_LOSS_BREACH')).toBe(true);
      expect(output.pendingReviews.length).toBeGreaterThan(0);
      expect(output.pendingReviews[0]?.decision).toBe('sell');
    });

    it('guarantees identical outputs across aliases (scoreStageG, evaluateStageG, monitorStageG)', () => {
      const input: StageGInput = {
        portfolio: basePortfolio,
        openPositions: [basePositionWithThesis],
        currentPrices: { TCS: 3200 },
      };

      const out1 = scoreStageG(input);
      const out2 = evaluateStageG(input);
      const out3 = monitorStageG(input);

      expect(out1.verdict).toBe(out2.verdict);
      expect(out2.verdict).toBe(out3.verdict);
      expect(out1.totalPoints).toBe(out3.totalPoints);
    });

    it('evaluates single position monitoring with monitorPosition helper', () => {
      const result = monitorPosition({
        position: basePositionWithThesis,
        portfolio: basePortfolio,
        currentPrice: 4200, // overvalued
      });

      expect(result.symbol).toBe('TCS');
      expect(result.alerts.some((a) => a.type === 'price-overvalued')).toBe(true);
      expect(result.recommendation.decision).toBe('trim');
      expect(result.recommendation.recommendedAction).toBe('TRIM_CANDIDATE');
    });

    it('preserves the manual execution disclaimer and exports configuration constants', () => {
      expect(DISCLAIMER_MANUAL_EXECUTION_ONLY).toContain('No automatic sell orders are generated');
      expect(DEFAULT_STAGE_G_RULE_SET_VERSION).toBe('stage-g-v1.0');
      expect(DEFAULT_OVERVALUATION_THRESHOLD_PCT).toBe(0.20);
      expect(DEFAULT_PORTFOLIO_DRAWDOWN_LIMIT_PCT).toBe(0.15);
      expect(DEFAULT_CASH_BUFFER_MIN_PCT).toBe(0.05);
      expect(DEFAULT_TRIM_PERCENTAGE).toBe(0.50);
    });
  });
});
