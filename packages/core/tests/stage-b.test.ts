/**
 * Stage B (Deep Trend Analysis) Vitest Unit Tests
 *
 * Verifies:
 * 1. Trend classifier functions:
 *    - classifyQuarterlySalesYoY (consistent, fluctuating, flat, declining)
 *    - classifyQuarterlyOpmYoY (increasing, occasional rise, constant, few declines, falling)
 *    - classifyAnnual5YSeries (consistently up, flat periods, dip, flat, declining)
 *    - classifyNetProfitAndMargin (rising, constant margin, fluctuating margin, margin falling, profit falling)
 *    - classifyReservesVsBorrowings (reserves up/borrowings down, flat, up/up, adverse)
 *    - classifyCfoTrend & forensic PAT divergence check
 *    - classifyDebtorDays (falling, constant, fluctuating, rising, >120 hard stop, >50% rise hard stop)
 *    - classifyRoceTrend (rising, maintained high >= 15%, fluctuating, falling hard stop)
 *    - classifyShareholdingPattern (accumulation, public >= 50% hard stop, institutional exit hard stop)
 * 2. Stage B Engine Execution (scoreStageB):
 *    - Perfect 10.0 / 10 run with all positive trends
 *    - Hard Stop blocking gate progression even with high score (e.g. 9.0 / 10)
 *    - Minimum pass gate (>= 6.5 passes, < 6.5 fails)
 *    - Verdict bands (Exceptional >= 8.5, Excellent 7.5-8.49, Good 6.5-7.49, Avoid < 6.5)
 *    - Missing data handling (never coerces null to 0, emits DATA_QUALITY_WARNING)
 *    - Mathematical and property invariants (0 <= points <= maxPoints, totalPoints <= maxPossibleScore)
 *    - Full explainability contract
 */

import { describe, it, expect } from 'vitest';
import {
  scoreStageB,
  classifyQuarterlySalesYoY,
  classifyQuarterlyOpmYoY,
  classifyAnnual5YSeries,
  classifyNetProfitAndMargin,
  classifyReservesVsBorrowings,
  classifyCfoTrend,
  classifyDebtorDays,
  classifyRoceTrend,
  classifyShareholdingPattern,
  type StageBInput,
  type QuarterlyPoint,
  type AnnualPoint,
  type ShareholdingPoint,
} from '../src/index.js';

function createHealthyStageBInput(): StageBInput {
  return {
    companyId: 'TEST_TITAN',
    asOfDate: '2024-03-31T00:00:00.000Z',
    quarterly: [
      { period: 'FY2022-Q1', salesYoY: 12.0, opmYoY: 1.2 },
      { period: 'FY2022-Q2', salesYoY: 14.0, opmYoY: 1.0 },
      { period: 'FY2022-Q3', salesYoY: 15.0, opmYoY: 0.8 },
      { period: 'FY2022-Q4', salesYoY: 11.0, opmYoY: 1.5 },
      { period: 'FY2023-Q1', salesYoY: 16.0, opmYoY: 0.9 },
      { period: 'FY2023-Q2', salesYoY: 13.0, opmYoY: 1.1 },
      { period: 'FY2023-Q3', salesYoY: 17.0, opmYoY: 1.4 },
      { period: 'FY2023-Q4', salesYoY: 18.0, opmYoY: 1.3 },
    ],
    annual: [
      {
        period: 'FY2020',
        sales: 20000,
        opm: 10.0,
        netProfit: 1500,
        netMargin: 7.5,
        reserves: 6000,
        borrowings: 3000,
        cfo: 1600,
        pat: 1500,
        debtorDays: 25,
        roce: 22.0,
      },
      {
        period: 'FY2021',
        sales: 22000,
        opm: 10.5,
        netProfit: 1750,
        netMargin: 7.95,
        reserves: 7200,
        borrowings: 2800,
        cfo: 1800,
        pat: 1750,
        debtorDays: 24,
        roce: 23.5,
      },
      {
        period: 'FY2022',
        sales: 25000,
        opm: 11.0,
        netProfit: 2100,
        netMargin: 8.4,
        reserves: 8800,
        borrowings: 2500,
        cfo: 2200,
        pat: 2100,
        debtorDays: 22,
        roce: 25.0,
      },
      {
        period: 'FY2023',
        sales: 29000,
        opm: 11.8,
        netProfit: 2600,
        netMargin: 8.96,
        reserves: 10500,
        borrowings: 2200,
        cfo: 2700,
        pat: 2600,
        debtorDays: 20,
        roce: 27.2,
      },
      {
        period: 'FY2024',
        sales: 34000,
        opm: 12.5,
        netProfit: 3200,
        netMargin: 9.41,
        reserves: 12800,
        borrowings: 1800,
        cfo: 3300,
        pat: 3200,
        debtorDays: 18,
        roce: 29.5,
      },
    ],
    shareholding: [
      { period: 'FY2022-Q1', promoterPct: 52.0, fiiPct: 18.0, diiPct: 10.0, publicPct: 20.0 },
      { period: 'FY2022-Q2', promoterPct: 52.2, fiiPct: 18.1, diiPct: 10.1, publicPct: 19.6 },
      { period: 'FY2022-Q3', promoterPct: 52.3, fiiPct: 18.3, diiPct: 10.2, publicPct: 19.2 },
      { period: 'FY2022-Q4', promoterPct: 52.5, fiiPct: 18.4, diiPct: 10.3, publicPct: 18.8 },
      { period: 'FY2023-Q1', promoterPct: 52.6, fiiPct: 18.6, diiPct: 10.4, publicPct: 18.4 },
      { period: 'FY2023-Q2', promoterPct: 52.8, fiiPct: 18.7, diiPct: 10.5, publicPct: 18.0 },
      { period: 'FY2023-Q3', promoterPct: 53.0, fiiPct: 18.9, diiPct: 10.6, publicPct: 17.5 },
      { period: 'FY2023-Q4', promoterPct: 53.8, fiiPct: 19.6, diiPct: 11.2, publicPct: 15.4 },
    ],
  };
}

describe('Stage B Scoring Engine', () => {
  // ==========================================================================
  // 1. Trend Classifiers
  // ==========================================================================
  describe('Trend Classifiers Unit Logic', () => {
    describe('classifyQuarterlySalesYoY', () => {
      it('awards 1.0 pt when all 8 quarters are positive', () => {
        const res = classifyQuarterlySalesYoY([10, 12, 14, 8, 9, 11, 15, 13]);
        expect(res.points).toBe(1.0);
        expect(res.trend).toBe('consistently_rising');
        expect(res.isHardStop).toBe(false);
      });

      it('awards 0.75 pt + conditional warning when positive >= 6 and negative <= 1', () => {
        const res = classifyQuarterlySalesYoY([10, 12, -2, 8, 9, 11, 15, 13]);
        expect(res.points).toBe(0.75);
        expect(res.trend).toBe('rising_with_fluctuations');
        expect(res.isConditional).toBe(true);
        expect(res.conditionalFlag).toBe('STAGE_B_Q_SALES_FLUCTUATING');
      });

      it('triggers HARD STOP when adverse / flat (more than 1 negative or flat)', () => {
        const res = classifyQuarterlySalesYoY([10, -2, -3, 8, 9, 11, 15, 13]);
        expect(res.points).toBe(0.0);
        expect(res.isHardStop).toBe(true);
        expect(res.hardStopFlag).toBe('STAGE_B_Q_SALES_TREND_FAIL');
      });
    });

    describe('classifyQuarterlyOpmYoY', () => {
      it('awards 1.0 pt when all quarters OPM YoY are positive', () => {
        const res = classifyQuarterlyOpmYoY([1.2, 0.8, 0.5, 1.1, 0.9, 0.4, 0.7, 1.0]);
        expect(res.points).toBe(1.0);
        expect(res.trend).toBe('consistently_rising');
      });

      it('awards 0.75 pt when mostly constant with occasional rise', () => {
        const res = classifyQuarterlyOpmYoY([1.2, 0.8, 0.5, 1.1, 0.9, 0.0, -0.2, 0.0]);
        expect(res.points).toBe(0.75);
        expect(res.trend).toBe('mostly_constant_occasional_rise');
      });

      it('awards 0.5 pt when constant (all changes within ±1.0%)', () => {
        const res = classifyQuarterlyOpmYoY([0.2, -0.3, 0.4, -0.1, 0.3, -0.2, 0.1, -0.4]);
        expect(res.points).toBe(0.5);
        expect(res.trend).toBe('constant');
      });

      it('awards 0.25 pt + conditional when mostly constant with a few declines', () => {
        const res = classifyQuarterlyOpmYoY([1.5, -1.2, 1.1, -1.5, 1.3, 0.0, 0.5, 0.8]);
        expect(res.points).toBe(0.25);
        expect(res.trend).toBe('mostly_constant_few_declines');
        expect(res.isConditional).toBe(true);
      });

      it('triggers HARD STOP when consistently falling', () => {
        const res = classifyQuarterlyOpmYoY([-1.2, -0.8, -1.5, -2.1, -0.9, -1.4, -0.7, -1.0]);
        expect(res.points).toBe(0.0);
        expect(res.isHardStop).toBe(true);
        expect(res.hardStopFlag).toBe('STAGE_B_Q_OPM_TREND_FAIL');
      });
    });

    describe('classifyAnnual5YSeries (Sales & OPM)', () => {
      it('awards 1.0 pt for consistently up transitions', () => {
        const res = classifyAnnual5YSeries([100, 120, 140, 160, 190], 'Sales 5Y', 'FLAG_FAIL');
        expect(res.points).toBe(1.0);
        expect(res.trend).toBe('consistently_rising');
      });

      it('awards 0.75 pt for up with flat periods (0 declines)', () => {
        const res = classifyAnnual5YSeries([100, 120, 120, 150, 180], 'Sales 5Y', 'FLAG_FAIL');
        expect(res.points).toBe(0.75);
        expect(res.trend).toBe('up_with_flat_periods');
      });

      it('awards 0.5 pt for up with a single dip and recovery', () => {
        const res = classifyAnnual5YSeries([100, 120, 110, 150, 180], 'Sales 5Y', 'FLAG_FAIL');
        expect(res.points).toBe(0.5);
        expect(res.trend).toBe('up_with_dip');
      });

      it('awards 0.25 pt for flat series (within ±5%)', () => {
        const res = classifyAnnual5YSeries([100, 101, 99, 101, 100], 'Sales 5Y', 'FLAG_FAIL');
        expect(res.points).toBe(0.25);
        expect(res.trend).toBe('flat');
      });

      it('triggers HARD STOP for net declining series', () => {
        const res = classifyAnnual5YSeries([100, 110, 95, 85, 75], 'Sales 5Y', 'FLAG_FAIL');
        expect(res.points).toBe(0.0);
        expect(res.isHardStop).toBe(true);
        expect(res.hardStopFlag).toBe('FLAG_FAIL');
      });
    });

    describe('classifyNetProfitAndMargin', () => {
      it('awards 1.0 pt when profit and margin both rise', () => {
        const res = classifyNetProfitAndMargin([100, 120, 140, 160, 200], [8.0, 8.5, 9.0, 9.2, 10.0]);
        expect(res.points).toBe(1.0);
        expect(res.trend).toBe('consistently_rising');
      });

      it('awards 0.75 pt when profit rises and margin is constant', () => {
        const res = classifyNetProfitAndMargin([100, 120, 140, 160, 200], [8.0, 8.1, 7.9, 8.2, 8.1]);
        expect(res.points).toBe(0.75);
        expect(res.trend).toBe('constant');
      });

      it('triggers HARD STOP when profit rises but margin falls', () => {
        const res = classifyNetProfitAndMargin([100, 120, 140, 160, 200], [10.0, 9.0, 8.0, 7.5, 6.5]);
        expect(res.points).toBe(0.0);
        expect(res.isHardStop).toBe(true);
        expect(res.hardStopFlag).toBe('STAGE_B_NET_PROFIT_TREND_FAIL');
      });

      it('triggers HARD STOP when profit falls', () => {
        const res = classifyNetProfitAndMargin([100, 90, 80, 75, 65], [8.0, 8.5, 9.0, 9.5, 10.0]);
        expect(res.points).toBe(0.0);
        expect(res.isHardStop).toBe(true);
      });
    });

    describe('classifyReservesVsBorrowings', () => {
      it('awards 1.0 pt for Reserves Up and Borrowings Down', () => {
        const res = classifyReservesVsBorrowings([1000, 1200, 1500, 1800, 2200], [500, 450, 400, 350, 200]);
        expect(res.points).toBe(1.0);
      });

      it('awards 0.75 pt for Reserves Up and Borrowings Flat', () => {
        const res = classifyReservesVsBorrowings([1000, 1200, 1500, 1800, 2200], [500, 510, 495, 505, 502]);
        expect(res.points).toBe(0.75);
      });

      it('awards 0.5 pt for both Reserves and Borrowings Up', () => {
        const res = classifyReservesVsBorrowings([1000, 1200, 1500, 1800, 2200], [500, 600, 700, 800, 900]);
        expect(res.points).toBe(0.5);
      });

      it('triggers HARD STOP for adverse pattern (Reserves Down)', () => {
        const res = classifyReservesVsBorrowings([1000, 900, 800, 700, 600], [500, 600, 700, 800, 900]);
        expect(res.points).toBe(0.0);
        expect(res.isHardStop).toBe(true);
        expect(res.hardStopFlag).toBe('STAGE_B_RESERVES_BORROWINGS_FAIL');
      });
    });

    describe('classifyCfoTrend & Forensic PAT Divergence', () => {
      it('awards 1.0 pt when CFO and margin are rising', () => {
        const cfos = [100, 120, 140, 160, 200];
        const revenues = [1000, 1100, 1200, 1300, 1400];
        const pats = [90, 110, 130, 150, 180];
        const res = classifyCfoTrend(cfos, revenues, pats);
        expect(res.points).toBe(1.0);
        expect(res.isForensicWarning).toBe(false);
      });

      it('emits STAGE_B_CFO_PAT_DIVERGENCE warning when cumulative CFO lags PAT significantly', () => {
        const cfos = [40, 50, 45, 55, 60]; // sum = 250
        const revenues = [1000, 1100, 1200, 1300, 1400];
        const pats = [100, 110, 120, 130, 150]; // sum = 610
        const res = classifyCfoTrend(cfos, revenues, pats);
        expect(res.isForensicWarning).toBe(true);
        expect(res.forensicFlag).toBe('STAGE_B_CFO_PAT_DIVERGENCE');
      });
    });

    describe('classifyDebtorDays', () => {
      it('awards 1.0 pt when debtor days are consistently falling', () => {
        const res = classifyDebtorDays([60, 55, 50, 45, 40]);
        expect(res.points).toBe(1.0);
        expect(res.trend).toBe('consistently_falling');
      });

      it('awards 0.75 pt when debtor days are almost constant', () => {
        const res = classifyDebtorDays([40, 41, 39, 40, 41]);
        expect(res.points).toBe(0.75);
      });

      it('triggers HARD STOP if latest debtor days > 120', () => {
        const res = classifyDebtorDays([100, 105, 110, 115, 125]);
        expect(res.points).toBe(0.0);
        expect(res.isHardStop).toBe(true);
        expect(res.hardStopFlag).toBe('STAGE_B_DEBTOR_DAYS_HIGH');
      });

      it('triggers HARD STOP if debtor days rose > 50% over 5 years', () => {
        const res = classifyDebtorDays([50, 60, 65, 75, 80]); // rose 60%
        expect(res.points).toBe(0.0);
        expect(res.isHardStop).toBe(true);
        expect(res.hardStopFlag).toBe('STAGE_B_DEBTOR_DAYS_HIGH');
      });
    });

    describe('classifyRoceTrend', () => {
      it('awards 1.0 pt when ROCE is consistently rising', () => {
        const res = classifyRoceTrend([18, 20, 22, 24, 27]);
        expect(res.points).toBe(1.0);
      });

      it('awards 0.75 pt when ROCE is maintained at high level (>=15% and within ±1.0%)', () => {
        const res = classifyRoceTrend([22.5, 23.0, 22.0, 23.2, 22.8]);
        expect(res.points).toBe(0.75);
        expect(res.trend).toBe('maintained_high');
      });

      it('triggers HARD STOP when ROCE is falling', () => {
        const res = classifyRoceTrend([25, 23, 21, 19, 16]);
        expect(res.points).toBe(0.0);
        expect(res.isHardStop).toBe(true);
        expect(res.hardStopFlag).toBe('STAGE_B_ROCE_TREND_FALLING');
      });
    });

    describe('classifyShareholdingPattern', () => {
      it('awards 1.0 pt for ideal accumulation: Promoter Up, FII+DII Up, Public Down', () => {
        const points: ShareholdingPoint[] = [
          { period: 'Q1', promoterPct: 50.0, fiiPct: 20.0, diiPct: 10.0, publicPct: 20.0 },
          { period: 'Q2', promoterPct: 51.0, fiiPct: 20.5, diiPct: 10.5, publicPct: 18.0 },
        ];
        const res = classifyShareholdingPattern(points);
        expect(res.points).toBe(1.0);
        expect(res.hardFlags).toHaveLength(0);
      });

      it('triggers HARD STOP when public rises while promoter & institutional holdings fall', () => {
        const points: ShareholdingPoint[] = [
          { period: 'Q1', promoterPct: 52.0, fiiPct: 20.0, diiPct: 10.0, publicPct: 18.0 },
          { period: 'Q2', promoterPct: 50.5, fiiPct: 19.0, diiPct: 9.5, publicPct: 21.0 },
        ];
        const res = classifyShareholdingPattern(points);
        expect(res.points).toBe(0.0);
        expect(res.hardFlags).toContain('STAGE_B_SHAREHOLDING_PUBLIC_RISE_INST_FALL');
      });

      it('triggers HARD STOP when public holding >= 50%', () => {
        const points: ShareholdingPoint[] = [
          { period: 'Q1', promoterPct: 30.0, fiiPct: 10.0, diiPct: 9.0, publicPct: 51.0 },
          { period: 'Q2', promoterPct: 30.5, fiiPct: 10.5, diiPct: 9.0, publicPct: 50.0 },
        ];
        const res = classifyShareholdingPattern(points);
        expect(res.hardFlags).toContain('STAGE_B_PUBLIC_HOLDING_GE_50');
      });
    });
  });

  // ==========================================================================
  // 2. Complete Stage B Scoring Engine (scoreStageB)
  // ==========================================================================
  describe('Full scoreStageB Execution', () => {
    it('scores a perfect 10.0 / 10 for a high-quality compounder', () => {
      const input = createHealthyStageBInput();
      const output = scoreStageB(input);

      expect(output.stage).toBe('B');
      expect(output.totalPoints).toBe(10.0);
      expect(output.maxPoints).toBe(10.0);
      expect(output.maxPossibleScore).toBe(10.0);
      expect(output.minPassScore).toBe(6.5);
      expect(output.verdictBand).toBe('EXCEPTIONAL');
      expect(output.verdict).toBe('PASS');
      expect(output.gatePassed).toBe(true);
      expect(output.canProceedToStageC).toBe(true);
      expect(output.hardStops).toHaveLength(0);
      expect(output.ruleResults).toHaveLength(10);
    });

    it('enforces HARD STOP gate: a single hard stop blocks progression even if total score is 9.0', () => {
      const input = createHealthyStageBInput();
      // Introduce declining sales 5Y
      input.annual[4]!.sales = 15000; // < 20000 5Y ago -> Hard Stop
      const output = scoreStageB(input);

      expect(output.totalPoints).toBe(9.0);
      expect(output.verdictBand).toBe('EXCEPTIONAL');
      expect(output.hardStops.length).toBeGreaterThan(0);
      expect(output.hardStops.some(f => f.flagKey === 'STAGE_B_5Y_SALES_DECLINING')).toBe(true);
      expect(output.gatePassed).toBe(false);
      expect(output.canProceedToStageC).toBe(false);
      expect(output.verdict).toBe('FAIL');
      expect(output.message).toContain('BLOCKED by 1 HARD STOP red flag(s)');
    });

    it('fails gate if score is below minPassScore (e.g. 6.0 < 6.5) even with no hard stops', () => {
      const input = createHealthyStageBInput();
      // Drop scores across rules without triggering hard stops:
      // Q-Sales: fluctuating -> 0.75 (-0.25)
      input.quarterly[2]!.salesYoY = -1.0;
      // Q-OPM: constant -> 0.5 (-0.5)
      for (const q of input.quarterly) q.opmYoY = 0.0;
      // 5Y Sales: flat (20000 -> 20000) -> 0.25 (-0.75)
      input.annual[4]!.sales = 20000;
      // 5Y OPM: dip -> 0.5 (-0.5)
      input.annual[2]!.opm = 9.5;
      // Reserves/Borrowings: both up -> 0.5 (-0.5)
      input.annual[4]!.borrowings = 3500;
      // Debtor days: constant -> 0.75 (-0.25)
      input.annual[4]!.debtorDays = 25;
      // ROCE: rising with fluctuations -> 0.5 (-0.5)
      input.annual[2]!.roce = 21.0;
      // Shareholding: promoter flat, public flat -> 0.25 (-0.75)
      input.shareholding[7]!.promoterPct = 53.0; // flat promoter
      input.shareholding[7]!.publicPct = 17.5; // flat public

      const output = scoreStageB(input);
      expect(output.totalPoints).toBe(6.0);
      expect(output.totalPoints).toBeLessThan(6.5);
      expect(output.hardStops).toHaveLength(0);
      expect(output.gatePassed).toBe(false);
      expect(output.canProceedToStageC).toBe(false);
      expect(output.verdict).toBe('FAIL');
      expect(output.verdictBand).toBe('AVOID');
    });

    it('classifies verdict bands correctly (Exceptional, Excellent, Good, Avoid)', () => {
      const base = createHealthyStageBInput();

      // 10.0 -> EXCEPTIONAL
      expect(scoreStageB(base).verdictBand).toBe('EXCEPTIONAL');

      // 8.0 -> EXCELLENT
      const excellentInput = createHealthyStageBInput();
      excellentInput.annual[2]!.sales = 21000; // dip -> 0.5 (-0.5)
      excellentInput.annual[2]!.opm = 9.5; // dip -> 0.5 (-0.5)
      excellentInput.annual[4]!.borrowings = 3500; // both up -> 0.5 (-0.5)
      excellentInput.annual[4]!.debtorDays = 25; // constant -> 0.75 (-0.25)
      excellentInput.annual[4]!.roce = 22.5; // maintained -> 0.75 (-0.25)
      const excellent = scoreStageB(excellentInput);
      expect(excellent.totalPoints).toBe(8.0);
      expect(excellent.verdictBand).toBe('EXCELLENT');
      expect(excellent.gatePassed).toBe(true);

      // 7.0 -> GOOD
      const goodInput = createHealthyStageBInput();
      goodInput.annual[2]!.sales = 21000; // -0.5
      goodInput.annual[2]!.opm = 9.5; // -0.5
      goodInput.annual[4]!.borrowings = 3500; // -0.5
      goodInput.annual[4]!.debtorDays = 25; // -0.25
      goodInput.annual[4]!.roce = 22.5; // -0.25
      goodInput.quarterly[2]!.salesYoY = -1.0; // -0.25
      for (const q of goodInput.quarterly) q.opmYoY = 0.0; // -0.5 (constant OPM)
      goodInput.shareholding[7]!.promoterPct = 53.0; // -0.5 (promoter flat)
      const good = scoreStageB(goodInput);
      expect(good.totalPoints).toBe(6.75);
      expect(good.verdictBand).toBe('GOOD');
      expect(good.gatePassed).toBe(true);
    });

    it('protects against missing data and never coerces null to 0', () => {
      const emptyInput: StageBInput = {
        companyId: 'EMPTY',
        asOfDate: '2024-03-31T00:00:00.000Z',
        quarterly: [],
        annual: [],
        shareholding: [],
      };
      const output = scoreStageB(emptyInput);

      expect(output.totalPoints).toBe(0);
      expect(output.gatePassed).toBe(false);
      expect(output.verdict).toBe('FAIL');
      expect(output.dataQualityWarnings.length).toBeGreaterThanOrEqual(5);

      for (const r of output.ruleResults) {
        expect(r.points).toBe(0);
        expect(r.explanation).toMatch(/missing|empty|insufficient/i);
      }
    });

    it('verifies mathematical invariants: points >= 0, points <= maxPoints, totalPoints <= maxPossibleScore', () => {
      const inputs = [
        createHealthyStageBInput(),
        {
          companyId: 'TEST_INV',
          asOfDate: '2024-03-31T00:00:00.000Z',
          quarterly: [],
          annual: [],
          shareholding: [],
        },
      ];

      for (const inp of inputs) {
        const out = scoreStageB(inp);
        expect(out.totalPoints).toBeGreaterThanOrEqual(0);
        expect(out.totalPoints).toBeLessThanOrEqual(out.maxPossibleScore ?? 10);

        for (const rule of out.ruleResults) {
          expect(rule.points).toBeGreaterThanOrEqual(0);
          expect(rule.points).toBeLessThanOrEqual(rule.maxPoints);
        }
      }
    });

    it('returns explainability, analysis summaries, and provenance on every rule', () => {
      const output = scoreStageB(createHealthyStageBInput());

      expect(output.quarterlyAnalysis.salesTrend).toBe('consistently_rising');
      expect(output.quarterlyAnalysis.opmTrend).toBe('consistently_rising');
      expect(output.annualAnalysis.sales5yTrend).toBe('consistently_rising');
      expect(output.annualAnalysis.debtorDaysTrend).toBe('consistently_falling');
      expect(output.annualAnalysis.roceTrend).toBe('consistently_rising');
      expect(output.shareholdingAnalysis.latestPattern.promoter).toBe('up');
      expect(output.shareholdingAnalysis.latestPattern.public).toBe('down');

      for (const r of output.ruleResults) {
        expect(r.ruleKey).toBeTruthy();
        expect(r.explanation).toBeTruthy();
        expect(r.explanation.length).toBeGreaterThan(10);
        expect(r.dataQuality).toBeDefined();
        expect(r.inputs).toBeDefined();
        expect(r.ruleSetVersion).toBe('stage-b-v1.0');
      }
    });
  });
});
