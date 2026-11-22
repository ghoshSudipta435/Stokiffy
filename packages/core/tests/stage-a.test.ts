/**
 * Stage A (Quick Screening) Vitest Unit Tests
 *
 * Verifies:
 * 1. Default industry benchmarks registry & lookup heuristics.
 * 2. 10 Scoring checks with boundary thresholds:
 *    - Sales Growth (YoY/CAGR, acceleration, negative growth hard stops, derived history).
 *    - Profit Growth (YoY/CAGR, acceleration, negative growth hard stops).
 *    - OPM (1Y & 5Y vs industry lower benchmark, margin expansion, missing benchmark).
 *    - ROE (>=20%, 10-20%, 1Y > 5Y, <10% hard stop).
 *    - ROCE (>=20%, 10-20%, 1Y > 5Y, <10% hard stop).
 *    - Debt/Equity (<0.5, 0.5-1.25, >1.25 hard stop, negative equity hard stop, bank exclusion).
 *    - Current Ratio (>2, 1-2, <1 hard stop, bank unsuitable warning).
 *    - Interest Coverage (>10, 5-10, 3-5, <3 hard stop, debt-free, bank unsuitable warning).
 *    - P/E vs Industry (0.8-2.0, 2.0-2.5, 2.5-3.0, <0.8 value trap, >3.0 hard stop, EPS <= 0 N/M).
 *    - ROA (>= industry min, 1Y > 5Y, missing benchmark).
 * 3. Bank / NBFC 9-point mode (D/E excluded, CR/IC flagged as unsuitable without hard stop, /9 verdict bands).
 * 4. Missing/null input protections (never coerced to 0 or treated as a pass; emits DATA_QUALITY_WARNING).
 * 5. Hard stop gate enforcement (any hard stop blocks stage progression regardless of total score).
 * 6. Mathematical and property invariants (non-negative points, points <= maxPoints, totalPoints <= maxPossibleScore).
 * 7. Explainability contracts (detailed explanations, inputs, and provenance).
 */

import { describe, it, expect } from 'vitest';
import {
  scoreStageA,
  findIndustryBenchmark,
  DEFAULT_INDUSTRY_BENCHMARKS,
  type StageAInput,
  type StageAFinancials,
} from '../src/index.js';

/**
 * Helper to build a standard healthy non-financial test input (e.g. IT Services).
 */
function createHealthyITInput(overrides?: Partial<StageAFinancials>): StageAInput {
  return {
    companyId: 'TEST_INFY',
    asOfDate: '2024-03-31T00:00:00.000Z',
    sector: 'non-financial',
    industry: 'IT services',
    financials: {
      revenue: 150000,
      netProfit: 25000,
      operatingProfit: 36000,
      totalAssets: 100000,
      totalLiabilities: 30000,
      totalEquity: 70000,
      totalDebt: 5000,
      currentAssets: 50000,
      currentLiabilities: 20000,
      interestExpense: 200,
      ebit: 35000,
      eps: 60,
      peRatio: 25,
      salesGrowth: {
        latestYoY: 12.5,
        cagr5y: 10.0,
      },
      profitGrowth: {
        latestYoY: 15.0,
        cagr5y: 11.0,
      },
      opm: {
        latestFy: 24.0,
        avg5y: 23.0,
      },
      roe: {
        latestFy: 28.0,
        avg5y: 25.0,
      },
      roce: {
        latestFy: 32.0,
        avg5y: 29.0,
      },
      roa: {
        latestFy: 22.0,
        avg5y: 21.0,
      },
      ...overrides,
    },
  };
}

/**
 * Helper to build a standard healthy Bank test input.
 */
function createHealthyBankInput(overrides?: Partial<StageAFinancials>): StageAInput {
  return {
    companyId: 'TEST_HDFC',
    asOfDate: '2024-03-31T00:00:00.000Z',
    sector: 'bank',
    industry: 'Banks',
    financials: {
      revenue: 150000,
      netProfit: 25000,
      operatingProfit: 36000,
      totalAssets: 1500000,
      totalLiabilities: 1350000,
      totalEquity: 150000,
      totalDebt: 1200000,
      currentAssets: 50000,
      currentLiabilities: 20000,
      interestExpense: 200,
      ebit: 35000,
      eps: 60,
      peRatio: 18, // 18 / 15 = 1.2x -> 1.0 pt
      salesGrowth: {
        latestYoY: 12.5,
        cagr5y: 10.0,
      },
      profitGrowth: {
        latestYoY: 15.0,
        cagr5y: 11.0,
      },
      opm: {
        latestFy: 24.0,
        avg5y: 23.0,
      },
      industryOpmMin: 20.0,
      roe: {
        latestFy: 22.0,
        avg5y: 20.0,
      },
      roce: {
        latestFy: 24.0,
        avg5y: 21.0,
      },
      roa: {
        latestFy: 1.2,
        avg5y: 1.0,
      },
      ...overrides,
    },
  };
}

describe('Stage A Scoring Engine', () => {
  // ==========================================================================
  // 1. Industry Benchmarks Registry & Normalization
  // ==========================================================================
  describe('Industry Benchmarks', () => {
    it('defines required industry benchmarks correctly', () => {
      expect(DEFAULT_INDUSTRY_BENCHMARKS['it-services']).toEqual({
        industry: 'IT services',
        opmMin: 22,
        opmMax: 28,
        peMedian: 20,
        minRoa: 20,
      });

      expect(DEFAULT_INDUSTRY_BENCHMARKS['pharma']).toEqual({
        industry: 'Pharma',
        opmMin: 25,
        opmMax: 35,
        peMedian: 25,
      });

      expect(DEFAULT_INDUSTRY_BENCHMARKS['fmcg']).toEqual({
        industry: 'FMCG',
        opmMin: 18,
        opmMax: 25,
        peMedian: 30,
        minRoa: 15,
      });

      expect(DEFAULT_INDUSTRY_BENCHMARKS['paints']).toEqual({
        industry: 'Paints',
        opmMin: 18,
        opmMax: 28,
        peMedian: 30,
      });

      expect(DEFAULT_INDUSTRY_BENCHMARKS['automobiles']).toEqual({
        industry: 'Automobiles',
        opmMin: 8,
        opmMax: 12,
        peMedian: 15,
      });

      expect(DEFAULT_INDUSTRY_BENCHMARKS['retail']).toEqual({
        industry: 'Retail',
        opmMin: 5,
        opmMax: 8,
      });

      expect(DEFAULT_INDUSTRY_BENCHMARKS['steel-metals']).toEqual({
        industry: 'Steel & metals',
        opmMin: 8,
        opmMax: 15,
      });

      expect(DEFAULT_INDUSTRY_BENCHMARKS['banks']).toEqual({
        industry: 'Banks',
        peMedian: 15,
        minRoa: 0.8,
      });

      expect(DEFAULT_INDUSTRY_BENCHMARKS['commodities']).toEqual({
        industry: 'Commodities',
        peMedian: 8,
      });

      expect(DEFAULT_INDUSTRY_BENCHMARKS['manufacturing']).toEqual({
        industry: 'Manufacturing',
        minRoa: 8,
      });

      expect(DEFAULT_INDUSTRY_BENCHMARKS['capital-intensive']).toEqual({
        industry: 'Capital intensive',
        minRoa: 5,
      });
    });

    it('finds benchmarks through case-insensitive and alias lookups', () => {
      expect(findIndustryBenchmark('IT services')?.industry).toBe('IT services');
      expect(findIndustryBenchmark('it-services')?.industry).toBe('IT services');
      expect(findIndustryBenchmark('Software Services')?.industry).toBe('IT services');
      expect(findIndustryBenchmark('Information Technology')?.industry).toBe('IT services');
      expect(findIndustryBenchmark('PHARMA')?.industry).toBe('Pharma');
      expect(findIndustryBenchmark('Pharmaceuticals & Drugs')?.industry).toBe('Pharma');
      expect(findIndustryBenchmark('FMCG - Household Products')?.industry).toBe('FMCG');
      expect(findIndustryBenchmark('Automobile & Auto Ancillary')?.industry).toBe('Automobiles');
      expect(findIndustryBenchmark('Bank')?.industry).toBe('Banks');
      expect(findIndustryBenchmark('NBFC Lending')?.industry).toBe('Banks');
      expect(findIndustryBenchmark('Steel & metals')?.industry).toBe('Steel & metals');
      expect(findIndustryBenchmark('Mining & Commodities')?.industry).toBe('Commodities');
      expect(findIndustryBenchmark('Industrial Manufacturing')?.industry).toBe('Manufacturing');
      expect(findIndustryBenchmark('Power & Infrastructure')?.industry).toBe('Capital intensive');
      expect(findIndustryBenchmark('Unknown Sector XYZ')).toBeNull();
      expect(findIndustryBenchmark(null)).toBeNull();
      expect(findIndustryBenchmark(undefined)).toBeNull();
    });
  });

  // ==========================================================================
  // 2. Rule 1: Sales Growth
  // ==========================================================================
  describe('Rule 1: Sales Growth', () => {
    it('awards 1.0 pt when YoY > 0, CAGR > 0, and YoY > CAGR', () => {
      const input = createHealthyITInput({
        salesGrowth: { latestYoY: 15.0, cagr5y: 10.0 },
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'salesGrowth');
      expect(rule?.points).toBe(1.0);
      expect(rule?.maxPoints).toBe(1.0);
      expect(output.hardStops).toHaveLength(0);
    });

    it('awards 0.5 pt when YoY > 0, CAGR > 0, but YoY <= CAGR (growth deceleration)', () => {
      const input = createHealthyITInput({
        salesGrowth: { latestYoY: 8.0, cagr5y: 12.0 },
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'salesGrowth');
      expect(rule?.points).toBe(0.5);
      expect(output.hardStops).toHaveLength(0);
    });

    it('awards 0.0 pts when growth is flat (0.0)', () => {
      const input = createHealthyITInput({
        salesGrowth: { latestYoY: 0, cagr5y: 0 },
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'salesGrowth');
      expect(rule?.points).toBe(0.0);
      expect(output.hardStops).toHaveLength(0);
    });

    it('triggers a HARD STOP when latest YoY is negative', () => {
      const input = createHealthyITInput({
        salesGrowth: { latestYoY: -3.5, cagr5y: 10.0 },
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'salesGrowth');
      expect(rule?.points).toBe(0.0);
      expect(output.hardStops.some(f => f.flagKey === 'STAGE_A_SALES_GROWTH_NEGATIVE')).toBe(true);
      expect(output.gatePassed).toBe(false);
      expect(output.canProceedToStageB).toBe(false);
      expect(output.verdict).toBe('FAIL');
    });

    it('triggers a HARD STOP when 5Y CAGR is negative', () => {
      const input = createHealthyITInput({
        salesGrowth: { latestYoY: 5.0, cagr5y: -2.0 },
      });
      const output = scoreStageA(input);
      expect(output.hardStops.some(f => f.flagKey === 'STAGE_A_SALES_GROWTH_NEGATIVE')).toBe(true);
      expect(output.gatePassed).toBe(false);
      expect(output.verdict).toBe('FAIL');
    });

    it('computes YoY and 5Y CAGR from raw multi-year revenue if explicit growth is missing', () => {
      // 5Y CAGR: (1000 / 620.92)^(1/5) - 1 ≈ 10%
      // YoY: (1000 - 900) / 900 = +11.11%
      const input = createHealthyITInput({
        salesGrowth: undefined,
        sales: {
          latestFy: 1000,
          priorFy: 900,
          fy5yAgo: 620.92,
        },
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'salesGrowth');
      expect(rule?.points).toBe(1.0); // YoY (~11.11%) > CAGR (~10.0%)
    });
  });

  // ==========================================================================
  // 3. Rule 2: Profit Growth
  // ==========================================================================
  describe('Rule 2: Profit Growth', () => {
    it('awards 1.0 pt when YoY > 0, CAGR > 0, and YoY > CAGR', () => {
      const input = createHealthyITInput({
        profitGrowth: { latestYoY: 20.0, cagr5y: 12.0 },
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'profitGrowth');
      expect(rule?.points).toBe(1.0);
    });

    it('awards 0.5 pt when YoY > 0 and CAGR > 0, but YoY <= CAGR', () => {
      const input = createHealthyITInput({
        profitGrowth: { latestYoY: 10.0, cagr5y: 14.0 },
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'profitGrowth');
      expect(rule?.points).toBe(0.5);
    });

    it('triggers a HARD STOP when latest FY profit growth is negative', () => {
      const input = createHealthyITInput({
        profitGrowth: { latestYoY: -5.0, cagr5y: 10.0 },
      });
      const output = scoreStageA(input);
      expect(output.hardStops.some(f => f.flagKey === 'STAGE_A_PROFIT_GROWTH_NEGATIVE')).toBe(true);
      expect(output.gatePassed).toBe(false);
      expect(output.verdict).toBe('FAIL');
    });

    it('triggers a HARD STOP when 5Y profit CAGR is negative', () => {
      const input = createHealthyITInput({
        profitGrowth: { latestYoY: 10.0, cagr5y: -1.5 },
      });
      const output = scoreStageA(input);
      expect(output.hardStops.some(f => f.flagKey === 'STAGE_A_PROFIT_GROWTH_NEGATIVE')).toBe(true);
      expect(output.gatePassed).toBe(false);
      expect(output.verdict).toBe('FAIL');
    });
  });

  // ==========================================================================
  // 4. Rule 3: Operating Profit Margin (OPM)
  // ==========================================================================
  describe('Rule 3: Operating Profit Margin (OPM)', () => {
    it('awards 1.0 pt when 1Y and 5Y OPM >= benchmark and 1Y > 5Y (expansion)', () => {
      const input = createHealthyITInput({
        opm: { latestFy: 26.0, avg5y: 23.0 },
        industryOpmMin: 22.0,
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'opm');
      expect(rule?.points).toBe(1.0);
    });

    it('awards 0.5 pt when 1Y and 5Y OPM >= benchmark but 1Y <= 5Y', () => {
      const input = createHealthyITInput({
        opm: { latestFy: 23.0, avg5y: 25.0 },
        industryOpmMin: 22.0,
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'opm');
      expect(rule?.points).toBe(0.5);
    });

    it('awards 0.0 pts when 1Y OPM is below industry benchmark', () => {
      const input = createHealthyITInput({
        opm: { latestFy: 18.0, avg5y: 23.0 },
        industryOpmMin: 22.0,
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'opm');
      expect(rule?.points).toBe(0.0);
    });

    it('emits STAGE_A_BENCHMARK_MISSING and marks unscored if benchmark is missing', () => {
      const input = createHealthyITInput({
        opm: { latestFy: 25.0, avg5y: 23.0 },
        industryOpmMin: null,
      });
      input.industry = 'UnregisteredSector';
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'opm');
      expect(rule?.points).toBe(0.0);
      expect(output.dataQualityWarnings.some(w => w.flagKey === 'STAGE_A_BENCHMARK_MISSING')).toBe(true);
    });

    it('handles decimal ratio inputs (0.24 normalized to 24%) seamlessly', () => {
      const input = createHealthyITInput({
        opm: { latestFy: 0.26, avg5y: 0.23 },
        industryOpmMin: 22.0,
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'opm');
      expect(rule?.points).toBe(1.0);
    });
  });

  // ==========================================================================
  // 5. Rule 4: Return on Equity (ROE)
  // ==========================================================================
  describe('Rule 4: Return on Equity (ROE)', () => {
    it('awards 1.0 pt when ROE >= 20% and 1Y > 5Y avg', () => {
      const input = createHealthyITInput({
        roe: { latestFy: 25.0, avg5y: 22.0 },
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'roe');
      expect(rule?.points).toBe(1.0);
      expect(output.hardStops).toHaveLength(0);
    });

    it('awards 0.5 pt when ROE >= 20% but 1Y <= 5Y avg', () => {
      const input = createHealthyITInput({
        roe: { latestFy: 22.0, avg5y: 25.0 },
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'roe');
      expect(rule?.points).toBe(0.5);
    });

    it('awards 0.75 pt when ROE is 15% (10% to <20% -> 0.25) and 1Y > 5Y (12%) -> +0.5', () => {
      const input = createHealthyITInput({
        roe: { latestFy: 15.0, avg5y: 12.0 },
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'roe');
      expect(rule?.points).toBe(0.75);
    });

    it('awards 0.25 pt when ROE is 15% and 1Y <= 5Y (18%)', () => {
      const input = createHealthyITInput({
        roe: { latestFy: 15.0, avg5y: 18.0 },
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'roe');
      expect(rule?.points).toBe(0.25);
    });

    it('triggers a HARD STOP when ROE is below 10%', () => {
      const input = createHealthyITInput({
        roe: { latestFy: 8.5, avg5y: 12.0 },
      });
      const output = scoreStageA(input);
      expect(output.hardStops.some(f => f.flagKey === 'STAGE_A_ROE_BELOW_10')).toBe(true);
      expect(output.gatePassed).toBe(false);
      expect(output.verdict).toBe('FAIL');
    });
  });

  // ==========================================================================
  // 6. Rule 5: Return on Capital Employed (ROCE)
  // ==========================================================================
  describe('Rule 5: Return on Capital Employed (ROCE)', () => {
    it('awards 1.0 pt when ROCE >= 20% and 1Y > 5Y avg', () => {
      const input = createHealthyITInput({
        roce: { latestFy: 30.0, avg5y: 24.0 },
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'roce');
      expect(rule?.points).toBe(1.0);
    });

    it('awards 0.75 pt when ROCE is 18% (10-20% band) and 1Y > 5Y (14%)', () => {
      const input = createHealthyITInput({
        roce: { latestFy: 18.0, avg5y: 14.0 },
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'roce');
      expect(rule?.points).toBe(0.75);
    });

    it('triggers a HARD STOP when ROCE is below 10%', () => {
      const input = createHealthyITInput({
        roce: { latestFy: 6.0, avg5y: 9.0 },
      });
      const output = scoreStageA(input);
      expect(output.hardStops.some(f => f.flagKey === 'STAGE_A_ROCE_BELOW_10')).toBe(true);
      expect(output.gatePassed).toBe(false);
      expect(output.verdict).toBe('FAIL');
    });
  });

  // ==========================================================================
  // 7. Rule 6: Debt to Equity Ratio
  // ==========================================================================
  describe('Rule 6: Debt to Equity Ratio', () => {
    it('awards 1.0 pt when D/E < 0.5', () => {
      const input = createHealthyITInput({
        totalDebt: 2000,
        totalEquity: 10000, // D/E = 0.2
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'debtToEquity');
      expect(rule?.points).toBe(1.0);
    });

    it('awards 0.5 pt when D/E is between 0.5 and 1.25', () => {
      const input = createHealthyITInput({
        totalDebt: 8000,
        totalEquity: 10000, // D/E = 0.8
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'debtToEquity');
      expect(rule?.points).toBe(0.5);
    });

    it('triggers a HARD STOP when D/E > 1.25 for a non-financial company', () => {
      const input = createHealthyITInput({
        totalDebt: 15000,
        totalEquity: 10000, // D/E = 1.5
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'debtToEquity');
      expect(rule?.points).toBe(0.0);
      expect(output.hardStops.some(f => f.flagKey === 'STAGE_A_DEBT_EQUITY_HIGH')).toBe(true);
      expect(output.gatePassed).toBe(false);
      expect(output.verdict).toBe('FAIL');
    });

    it('triggers a HARD STOP when total equity is negative or zero', () => {
      const input = createHealthyITInput({
        totalDebt: 5000,
        totalEquity: -100,
      });
      const output = scoreStageA(input);
      expect(output.hardStops.some(f => f.flagKey === 'STAGE_A_NEGATIVE_EQUITY')).toBe(true);
      expect(output.gatePassed).toBe(false);
      expect(output.verdict).toBe('FAIL');
    });

    it('excludes Debt/Equity check for Bank/NBFC sector (points = 0, maxPoints = 0)', () => {
      const input = createHealthyITInput({
        totalDebt: 500000,
        totalEquity: 50000, // D/E = 10 (typical for bank leverage)
      });
      input.sector = 'bank';
      input.industry = 'Banks';
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'debtToEquity');
      expect(rule?.points).toBe(0);
      expect(rule?.maxPoints).toBe(0);
      expect(output.hardStops.some(f => f.flagKey === 'STAGE_A_DEBT_EQUITY_HIGH')).toBe(false);
    });
  });

  // ==========================================================================
  // 8. Rule 7: Current Ratio
  // ==========================================================================
  describe('Rule 7: Current Ratio', () => {
    it('awards 1.0 pt when Current Ratio > 2.0', () => {
      const input = createHealthyITInput({
        currentAssets: 50000,
        currentLiabilities: 20000, // CR = 2.5
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'currentRatio');
      expect(rule?.points).toBe(1.0);
    });

    it('awards 0.5 pt when Current Ratio is between 1.0 and 2.0', () => {
      const input = createHealthyITInput({
        currentAssets: 30000,
        currentLiabilities: 20000, // CR = 1.5
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'currentRatio');
      expect(rule?.points).toBe(0.5);
    });

    it('triggers a HARD STOP when Current Ratio < 1.0 for non-financial companies', () => {
      const input = createHealthyITInput({
        currentAssets: 15000,
        currentLiabilities: 20000, // CR = 0.75
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'currentRatio');
      expect(rule?.points).toBe(0.0);
      expect(output.hardStops.some(f => f.flagKey === 'STAGE_A_CURRENT_RATIO_LOW')).toBe(true);
      expect(output.gatePassed).toBe(false);
      expect(output.verdict).toBe('FAIL');
    });

    it('marks as UNSUITABLE_FOR_SECTOR conditional warning instead of hard stop for Banks/NBFCs', () => {
      const input = createHealthyITInput({
        currentAssets: 10000,
        currentLiabilities: 20000, // CR = 0.5
      });
      input.sector = 'bank';
      input.industry = 'Banks';
      const output = scoreStageA(input);
      expect(output.hardStops.some(f => f.flagKey === 'STAGE_A_CURRENT_RATIO_LOW')).toBe(false);
      expect(
        output.conditionalWarnings.some(w => w.flagKey === 'STAGE_A_CURRENT_RATIO_UNSUITABLE_FOR_SECTOR')
      ).toBe(true);
      expect(output.unsuitableRules).toContain('currentRatio');
    });
  });

  // ==========================================================================
  // 9. Rule 8: Interest Coverage Ratio
  // ==========================================================================
  describe('Rule 8: Interest Coverage Ratio', () => {
    it('awards 1.0 pt when Interest Coverage > 10', () => {
      const input = createHealthyITInput({
        ebit: 15000,
        interestExpense: 1000, // IC = 15
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'interestCoverage');
      expect(rule?.points).toBe(1.0);
    });

    it('awards 0.5 pt when Interest Coverage is 5 to 10', () => {
      const input = createHealthyITInput({
        ebit: 7000,
        interestExpense: 1000, // IC = 7
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'interestCoverage');
      expect(rule?.points).toBe(0.5);
    });

    it('awards 0.25 pt when Interest Coverage is 3 to 5', () => {
      const input = createHealthyITInput({
        ebit: 4000,
        interestExpense: 1000, // IC = 4
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'interestCoverage');
      expect(rule?.points).toBe(0.25);
    });

    it('awards 1.0 pt for debt-free company with zero interest expense and positive EBIT', () => {
      const input = createHealthyITInput({
        ebit: 10000,
        interestExpense: 0,
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'interestCoverage');
      expect(rule?.points).toBe(1.0);
    });

    it('triggers a HARD STOP when Interest Coverage < 3 for non-financial companies', () => {
      const input = createHealthyITInput({
        ebit: 2000,
        interestExpense: 1000, // IC = 2
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'interestCoverage');
      expect(rule?.points).toBe(0.0);
      expect(output.hardStops.some(f => f.flagKey === 'STAGE_A_INT_COVERAGE_LOW')).toBe(true);
      expect(output.gatePassed).toBe(false);
      expect(output.verdict).toBe('FAIL');
    });

    it('marks as UNSUITABLE_FOR_SECTOR conditional warning instead of hard stop for Banks/NBFCs', () => {
      const input = createHealthyITInput({
        ebit: 1000,
        interestExpense: 2000, // IC = 0.5
      });
      input.sector = 'nbfc';
      input.industry = 'NBFC';
      const output = scoreStageA(input);
      expect(output.hardStops.some(f => f.flagKey === 'STAGE_A_INT_COVERAGE_LOW')).toBe(false);
      expect(
        output.conditionalWarnings.some(w => w.flagKey === 'STAGE_A_INT_COVERAGE_UNSUITABLE_FOR_SECTOR')
      ).toBe(true);
      expect(output.unsuitableRules).toContain('interestCoverage');
    });
  });

  // ==========================================================================
  // 10. Rule 9: P/E vs Industry Ratio
  // ==========================================================================
  describe('Rule 9: P/E vs Industry Ratio', () => {
    it('awards 1.0 pt when x is between 0.8 and 2.0 (fair value band)', () => {
      const input = createHealthyITInput({
        peRatio: 25,
        industryPeRatio: 20, // x = 1.25
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'peVsIndustry');
      expect(rule?.points).toBe(1.0);
      expect(output.conditionalWarnings).toHaveLength(0);
      expect(output.hardStops).toHaveLength(0);
    });

    it('awards 0.5 pt when 2.0 < x <= 2.5', () => {
      const input = createHealthyITInput({
        peRatio: 46,
        industryPeRatio: 20, // x = 2.3
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'peVsIndustry');
      expect(rule?.points).toBe(0.5);
    });

    it('awards 0.25 pt when 2.5 < x <= 3.0', () => {
      const input = createHealthyITInput({
        peRatio: 56,
        industryPeRatio: 20, // x = 2.8
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'peVsIndustry');
      expect(rule?.points).toBe(0.25);
    });

    it('awards 1.0 pt AND raises CONDITIONAL_WARNING for value-trap review when x < 0.8', () => {
      const input = createHealthyITInput({
        peRatio: 12,
        industryPeRatio: 20, // x = 0.6
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'peVsIndustry');
      expect(rule?.points).toBe(1.0);
      expect(
        output.conditionalWarnings.some(w => w.flagKey === 'STAGE_A_PE_VS_INDUSTRY_LOW_VALUE_TRAP')
      ).toBe(true);
      expect(output.verdict).toBe('CONDITIONAL');
    });

    it('triggers a HARD STOP when x > 3.0 (extreme valuation risk)', () => {
      const input = createHealthyITInput({
        peRatio: 75,
        industryPeRatio: 20, // x = 3.75
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'peVsIndustry');
      expect(rule?.points).toBe(0.0);
      expect(output.hardStops.some(f => f.flagKey === 'STAGE_A_PE_VS_INDUSTRY_HIGH')).toBe(true);
      expect(output.gatePassed).toBe(false);
      expect(output.verdict).toBe('FAIL');
    });

    it('treats negative or zero EPS as N/M (0 points, not a pass)', () => {
      const input = createHealthyITInput({
        eps: -5,
        peRatio: -15,
        industryPeRatio: 20,
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'peVsIndustry');
      expect(rule?.points).toBe(0.0);
      expect(output.dataQualityWarnings.some(w => w.flagKey === 'STAGE_A_PE_NOT_MEASURABLE')).toBe(true);
    });
  });

  // ==========================================================================
  // 11. Rule 10: Return on Assets (ROA)
  // ==========================================================================
  describe('Rule 10: Return on Assets (ROA)', () => {
    it('awards 1.0 pt when ROA >= industry minimum (0.5) and 1Y > 5Y (0.5)', () => {
      const input = createHealthyITInput({
        roa: { latestFy: 22.0, avg5y: 20.5 },
        industryRoaMin: 20.0,
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'roa');
      expect(rule?.points).toBe(1.0);
    });

    it('awards 0.5 pt when ROA >= industry min but 1Y <= 5Y', () => {
      const input = createHealthyITInput({
        roa: { latestFy: 21.0, avg5y: 23.0 },
        industryRoaMin: 20.0,
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'roa');
      expect(rule?.points).toBe(0.5);
    });

    it('awards 0.5 pt when ROA < industry min but 1Y > 5Y', () => {
      const input = createHealthyITInput({
        roa: { latestFy: 18.0, avg5y: 16.0 },
        industryRoaMin: 20.0,
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'roa');
      expect(rule?.points).toBe(0.5);
    });

    it('awards 0.0 pts when ROA < industry min and 1Y <= 5Y', () => {
      const input = createHealthyITInput({
        roa: { latestFy: 15.0, avg5y: 17.0 },
        industryRoaMin: 20.0,
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'roa');
      expect(rule?.points).toBe(0.0);
    });

    it('evaluates Banks with 0.8% ROA benchmark accurately', () => {
      const input = createHealthyBankInput({
        roa: { latestFy: 1.2, avg5y: 1.0 },
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'roa');
      expect(rule?.points).toBe(1.0); // 1.2% >= 0.8% (+0.5) and 1.2% > 1.0% (+0.5)
    });
  });

  // ==========================================================================
  // 12. Missing / Null Data Protection
  // ==========================================================================
  describe('Missing & Null Data Protection', () => {
    it('never coerces null or undefined metrics to zero or passes them silently', () => {
      const input: StageAInput = {
        companyId: 'EMPTY_CORP',
        asOfDate: '2024-03-31T00:00:00.000Z',
        sector: 'non-financial',
        financials: {},
      };
      const output = scoreStageA(input);

      expect(output.totalPoints).toBe(0);
      expect(output.verdict).toBe('FAIL');
      expect(output.gatePassed).toBe(false);
      expect(output.canProceedToStageB).toBe(false);

      // Verify each rule recorded a DATA_QUALITY_WARNING
      for (const rule of output.ruleResults) {
        expect(rule.points).toBe(0);
        expect(rule.explanation).toMatch(/missing|incomplete|unscored/i);
      }
      expect(output.dataQualityWarnings.length).toBeGreaterThanOrEqual(8);
    });

    it('handles object FinancialMetric null values without coercion', () => {
      const input = createHealthyITInput({
        totalDebt: { value: null, provenance: { source: 'test', fetchedAt: '', reportedPeriod: '', currency: 'INR', unit: 'RAW', adjustmentStatus: 'reported', quality: 'missing', isMissing: true } },
        totalEquity: { value: null, provenance: { source: 'test', fetchedAt: '', reportedPeriod: '', currency: 'INR', unit: 'RAW', adjustmentStatus: 'reported', quality: 'missing', isMissing: true } },
      });
      const output = scoreStageA(input);
      const rule = output.ruleResults.find(r => r.ruleKey === 'debtToEquity');
      expect(rule?.points).toBe(0.0);
      expect(output.dataQualityWarnings.some(w => w.flagKey === 'STAGE_A_DEBT_EQUITY_DATA_MISSING')).toBe(true);
    });
  });

  // ==========================================================================
  // 13. Verdict Bands and Gate Enforcement
  // ==========================================================================
  describe('Verdict Bands & Gate Enforcement', () => {
    it('classifies Non-Financial scoring bands correctly', () => {
      // 10.0 / 10 -> EXCEPTIONAL
      const perfect = scoreStageA(createHealthyITInput());
      expect(perfect.totalPoints).toBe(10.0);
      expect(perfect.verdictBand).toBe('EXCEPTIONAL');
      expect(perfect.gatePassed).toBe(true);
      expect(perfect.verdict).toBe('PASS');

      // 8.0 / 10 -> EXCELLENT (between 7.5 and <8.5)
      const excellentInput = createHealthyITInput({
        salesGrowth: { latestYoY: 8.0, cagr5y: 10.0 }, // 0.5 (-0.5)
        profitGrowth: { latestYoY: 8.0, cagr5y: 10.0 }, // 0.5 (-0.5)
        peRatio: 45, // x = 2.25 -> 0.5 (-0.5)
        currentAssets: 30000,
        currentLiabilities: 20000, // CR = 1.5 -> 0.5 (-0.5)
      });
      const excellent = scoreStageA(excellentInput);
      expect(excellent.totalPoints).toBe(8.0);
      expect(excellent.verdictBand).toBe('EXCELLENT');
      expect(excellent.gatePassed).toBe(true);
      expect(excellent.verdict).toBe('PASS');

      // 7.0 / 10 -> GOOD (between 6.5 and <7.5)
      const goodInput = createHealthyITInput({
        salesGrowth: { latestYoY: 8.0, cagr5y: 10.0 }, // 0.5 (-0.5)
        profitGrowth: { latestYoY: 8.0, cagr5y: 10.0 }, // 0.5 (-0.5)
        peRatio: 45, // 0.5 (-0.5)
        currentAssets: 30000,
        currentLiabilities: 20000, // 0.5 (-0.5)
        totalDebt: 8000,
        totalEquity: 10000, // D/E = 0.8 -> 0.5 (-0.5)
        interestExpense: 1000,
        ebit: 7000, // IC = 7 -> 0.5 (-0.5)
      });
      const good = scoreStageA(goodInput);
      expect(good.totalPoints).toBe(7.0);
      expect(good.verdictBand).toBe('GOOD');
      expect(good.gatePassed).toBe(true);
      expect(good.verdict).toBe('PASS');

      // < 6.5 -> AVOID
      const avoidInput = createHealthyITInput({
        salesGrowth: { latestYoY: 8.0, cagr5y: 10.0 }, // 0.5 (-0.5)
        profitGrowth: { latestYoY: 8.0, cagr5y: 10.0 }, // 0.5 (-0.5)
        peRatio: 45, // 0.5 (-0.5)
        currentAssets: 30000,
        currentLiabilities: 20000, // 0.5 (-0.5)
        totalDebt: 8000,
        totalEquity: 10000, // 0.5 (-0.5)
        interestExpense: 1000,
        ebit: 7000, // 0.5 (-0.5)
        opm: { latestFy: 23.0, avg5y: 25.0 }, // 0.5 (-0.5)
        roe: { latestFy: 22.0, avg5y: 25.0 }, // 0.5 (-0.5)
      });
      const avoid = scoreStageA(avoidInput);
      expect(avoid.totalPoints).toBe(6.0);
      expect(avoid.verdictBand).toBe('AVOID');
      expect(avoid.gatePassed).toBe(false);
      expect(avoid.verdict).toBe('FAIL');
    });

    it('classifies Bank/NBFC scoring bands (/9) correctly', () => {
      const bankBase = createHealthyBankInput();

      // 9.0 / 9 -> EXCEPTIONAL (>= 7.5)
      const exceptionalBank = scoreStageA(bankBase);
      expect(exceptionalBank.totalPoints).toBe(9.0);
      expect(exceptionalBank.maxPoints).toBe(9.0);
      expect(exceptionalBank.verdictBand).toBe('EXCEPTIONAL');
      expect(exceptionalBank.gatePassed).toBe(true);

      // 7.0 / 9 -> EXCELLENT (6.5 to <7.5)
      const excellentBank = scoreStageA({
        ...bankBase,
        financials: {
          ...bankBase.financials,
          salesGrowth: { latestYoY: 8.0, cagr5y: 10.0 }, // -0.5
          profitGrowth: { latestYoY: 8.0, cagr5y: 10.0 }, // -0.5
          peRatio: 33, // x = 2.2 -> -0.5
          currentAssets: 30000,
          currentLiabilities: 20000, // -0.5
        },
      });
      expect(excellentBank.totalPoints).toBe(7.0);
      expect(excellentBank.verdictBand).toBe('EXCELLENT');
      expect(excellentBank.gatePassed).toBe(true);

      // 6.0 / 9 -> GOOD (5.5 to <6.5)
      const goodBank = scoreStageA({
        ...bankBase,
        financials: {
          ...bankBase.financials,
          salesGrowth: { latestYoY: 8.0, cagr5y: 10.0 }, // -0.5
          profitGrowth: { latestYoY: 8.0, cagr5y: 10.0 }, // -0.5
          peRatio: 33, // -0.5
          currentAssets: 30000,
          currentLiabilities: 20000, // -0.5
          interestExpense: 1000,
          ebit: 7000, // -0.5
          roa: { latestFy: 1.2, avg5y: 1.5 }, // -0.5
        },
      });
      expect(goodBank.totalPoints).toBe(6.0);
      expect(goodBank.verdictBand).toBe('GOOD');
      expect(goodBank.gatePassed).toBe(true);

      // < 5.5 / 9 -> AVOID
      const avoidBank = scoreStageA({
        ...bankBase,
        financials: {
          ...bankBase.financials,
          salesGrowth: { latestYoY: 8.0, cagr5y: 10.0 }, // -0.5
          profitGrowth: { latestYoY: 8.0, cagr5y: 10.0 }, // -0.5
          peRatio: 33, // -0.5
          currentAssets: 30000,
          currentLiabilities: 20000, // -0.5
          interestExpense: 1000,
          ebit: 7000, // -0.5
          roa: { latestFy: 1.2, avg5y: 1.5 }, // -0.5
          opm: { latestFy: 23.0, avg5y: 25.0 }, // -0.5
          roe: { latestFy: 22.0, avg5y: 25.0 }, // -0.5
        },
      });
      expect(avoidBank.totalPoints).toBe(5.0);
      expect(avoidBank.verdictBand).toBe('AVOID');
      expect(avoidBank.gatePassed).toBe(false);
      expect(avoidBank.verdict).toBe('FAIL');
    });

    it('enforces HARD STOP gate: a single hard stop blocks progression even if score is high', () => {
      // 9.0 out of 10 points awarded across 9 rules, but 1 rule triggers a hard stop (e.g. D/E > 1.25)
      const input = createHealthyITInput({
        totalDebt: 20000,
        totalEquity: 10000, // D/E = 2.0 -> Hard Stop!
      });
      const output = scoreStageA(input);

      expect(output.totalPoints).toBe(9.0);
      expect(output.verdictBand).toBe('EXCEPTIONAL');
      expect(output.hardStops.length).toBeGreaterThan(0);
      expect(output.gatePassed).toBe(false);
      expect(output.canProceedToStageB).toBe(false);
      expect(output.verdict).toBe('FAIL');
      expect(output.message).toContain('BLOCKED by 1 HARD STOP red flag(s)');
    });
  });

  // ==========================================================================
  // 14. Explainability and Property Invariants
  // ==========================================================================
  describe('Explainability and Invariants', () => {
    it('populates explainability fields for every rule result', () => {
      const output = scoreStageA(createHealthyITInput());

      expect(output.ruleResults).toHaveLength(10);
      for (const rule of output.ruleResults) {
        expect(rule.ruleKey).toBeTruthy();
        expect(typeof rule.points).toBe('number');
        expect(typeof rule.maxPoints).toBe('number');
        expect(typeof rule.explanation).toBe('string');
        expect(rule.explanation.length).toBeGreaterThan(10);
        expect(rule.inputs).toBeDefined();
        expect(rule.dataQuality).toBeDefined();
        expect(rule.ruleSetVersion).toBe('stage-a-v1.0');
      }
    });

    it('satisfies mathematical invariants: 0 <= points <= maxPoints and totalPoints <= maxPossibleScore', () => {
      const testCases: StageAInput[] = [
        createHealthyITInput(),
        createHealthyITInput({ totalDebt: 0, totalEquity: 1000 }),
        createHealthyITInput({ peRatio: 5, eps: 50 }),
        createHealthyITInput({ salesGrowth: { latestYoY: -10, cagr5y: -5 } }),
        {
          companyId: 'TEST_INV',
          asOfDate: '2024-03-31T00:00:00.000Z',
          sector: 'bank',
          financials: {},
        },
      ];

      for (const testInput of testCases) {
        const out = scoreStageA(testInput);
        expect(out.totalPoints).toBeGreaterThanOrEqual(0);
        expect(out.totalPoints).toBeLessThanOrEqual(out.maxPossibleScore);

        for (const rule of out.ruleResults) {
          expect(rule.points).toBeGreaterThanOrEqual(0);
          expect(rule.points).toBeLessThanOrEqual(rule.maxPoints);
        }
      }
    });
  });
});
