/**
 * Unit tests for apps/web/lib/services/stage-a-runner.ts
 *
 * Verifies:
 * 1. DB-to-StageAInput mapping (including null preservation without zero-coercion)
 * 2. End-to-end execution of scoreStageA for passing non-financial companies
 * 3. End-to-end execution of scoreStageA for hard-stop failing companies
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@stock-assistant/db', () => ({
  prisma: {
    company: { findFirst: vi.fn() },
    financialStatement: { findMany: vi.fn() },
    priceBar: { findFirst: vi.fn() },
  },
}));

import { runStageAForCompany } from './stage-a-runner';
import type { StageARunnerResult } from './stage-a-runner';
import { prisma } from '@stock-assistant/db';

const mockCompanyFindFirst = vi.mocked(prisma.company.findFirst);
const mockFinancialStatementFindMany = vi.mocked(prisma.financialStatement.findMany);
const mockPriceBarFindFirst = vi.mocked(prisma.priceBar.findFirst);

const baseCompany = {
  id: 'comp-tcs',
  symbol: 'TCS',
  name: 'Tata Consultancy Services Ltd.',
  sector: 'Information Technology',
  userId: 'owner_user_01',
};

const baseStatements = [
  {
    fiscalYear: 'FY2024',
    reportedPeriod: 'FY2024',
    revenue: 612000,
    netProfit: 138000,
    operatingProfit: 148000,
    totalAssets: 285000,
    totalLiabilities: 95000,
    totalEquity: 190000,
    totalDebt: 8000,
    currentAssets: 140000,
    currentLiabilities: 60000,
    interestExpense: 400,
    ebit: 148400,
    eps: 370,
  },
  {
    fiscalYear: 'FY2023',
    reportedPeriod: 'FY2023',
    revenue: 560000,
    netProfit: 102000,
    operatingProfit: 118000,
    totalAssets: 275000,
    totalLiabilities: 93000,
    totalEquity: 182000,
    totalDebt: 6000,
    currentAssets: 135000,
    currentLiabilities: 75000,
    interestExpense: 380,
    ebit: 118380,
    eps: 265,
  },
  {
    fiscalYear: 'FY2022',
    reportedPeriod: 'FY2022',
    revenue: 510000,
    netProfit: 91000,
    operatingProfit: 106000,
    totalAssets: 262000,
    totalLiabilities: 90000,
    totalEquity: 172000,
    totalDebt: 5000,
    currentAssets: 125000,
    currentLiabilities: 70000,
    interestExpense: 420,
    ebit: 106420,
    eps: 235,
  },
  {
    fiscalYear: 'FY2021',
    reportedPeriod: 'FY2021',
    revenue: 482000,
    netProfit: 84000,
    operatingProfit: 98000,
    totalAssets: 252000,
    totalLiabilities: 88000,
    totalEquity: 164000,
    totalDebt: 5500,
    currentAssets: 118000,
    currentLiabilities: 68000,
    interestExpense: 450,
    ebit: 98450,
    eps: 218,
  },
  {
    fiscalYear: 'FY2020',
    reportedPeriod: 'FY2020',
    revenue: 456000,
    netProfit: 78000,
    operatingProfit: 92000,
    totalAssets: 240000,
    totalLiabilities: 85000,
    totalEquity: 155000,
    totalDebt: 6000,
    currentAssets: 110000,
    currentLiabilities: 65000,
    interestExpense: 500,
    ebit: 92500,
    eps: 205,
  },
];

function resetMocks() {
  mockCompanyFindFirst.mockReset();
  mockFinancialStatementFindMany.mockReset();
  mockPriceBarFindFirst.mockReset();

  mockCompanyFindFirst.mockResolvedValue(baseCompany as any);
  mockPriceBarFindFirst.mockResolvedValue({
    id: 'pb-tcs',
    companyId: 'comp-tcs',
    date: '2024-03-31',
    close: 3700,
  } as any);
}

describe('stage-a-runner', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('DB-to-StageAInput mapping', () => {
    it('maps financial statements to StageAInput preserving structure', async () => {
      mockFinancialStatementFindMany.mockResolvedValue(baseStatements as any);

      const result = await runStageAForCompany({
        userId: 'owner_user_01',
        symbol: 'TCS',
      }) as StageARunnerResult;

      expect(result.company.symbol).toBe('TCS');
      expect(result.company.sector).toBe('Information Technology');

      const f = result.input.financials;
      expect(f.revenue).toMatchObject({ value: 612000 });
      expect(f.netProfit).toMatchObject({ value: 138000 });
      expect(f.totalEquity).toMatchObject({ value: 190000 });
      expect(f.totalDebt).toMatchObject({ value: 8000 });

      // Ratios computed from raw values
      expect((f.roe?.latestFy as { value: number } | null)?.value).toBeCloseTo(138000 / 190000);
      expect((f.roce?.latestFy as { value: number } | null)?.value).toBeCloseTo(148400 / (285000 - 60000));
      expect((f.opm?.latestFy as { value: number } | null)?.value).toBeCloseTo(148000 / 612000);

      // Growth inputs carry latest/prior/5y-ago
      expect((f.sales?.latestFy as { value: number } | null)?.value).toBe(612000);
      expect((f.sales?.priorFy as { value: number } | null)?.value).toBe(560000);
      expect((f.sales?.fy5yAgo as { value: number } | null)?.value).toBe(456000);

      // Provenance tracked
      expect((f.revenue as { provenance: { source: string; reportedPeriod: string } } | null)?.provenance.source).toBe('postgresql');
      expect((f.revenue as { provenance: { reportedPeriod: string } } | null)?.provenance.reportedPeriod).toBe('FY2024');
    });

    it('preserves null values without zero-coercion for missing metrics', async () => {
      const statementsWithNulls = baseStatements.map((s, i) => ({
        ...s,
        netProfit: i === 0 ? null : s.netProfit,
        totalEquity: i === 0 ? null : s.totalEquity,
        ebit: i === 0 ? null : s.ebit,
      }));

      mockFinancialStatementFindMany.mockResolvedValue(statementsWithNulls as any);
      mockPriceBarFindFirst.mockResolvedValue(null);

      const result = await runStageAForCompany({
        userId: 'owner_user_01',
        symbol: 'TCS',
      }) as StageARunnerResult;

      const f = result.input.financials;

      // Nulls preserved as null, NOT coerced to 0
      const np = f.netProfit as { value: number | null; provenance: { isMissing: boolean; quality: string } } | null;
      expect(np?.value).toBeNull();
      expect(np?.provenance.isMissing).toBe(true);
      expect(np?.provenance.quality).toBe('missing');

      const eq = f.totalEquity as { value: number | null; provenance: { isMissing: boolean; quality: string } } | null;
      expect(eq?.value).toBeNull();
      expect(eq?.provenance.isMissing).toBe(true);

      // ROE cannot be computed without equity → null
      expect((f.roe?.latestFy as { value: number | null } | null)?.value).toBeNull();

      // PeRatio cannot be computed without price bar → null
      expect((f.peRatio as { value: number | null } | null)?.value).toBeNull();
    });

    it('detects bank sector and maps to bankVariant', async () => {
      mockCompanyFindFirst.mockResolvedValue({ ...baseCompany, symbol: 'HDFCBANK', sector: 'Financial Services' } as any);
      mockFinancialStatementFindMany.mockResolvedValue(baseStatements as any);

      const result = await runStageAForCompany({
        userId: 'owner_user_01',
        symbol: 'HDFCBANK',
      }) as StageARunnerResult;

      expect(result.input.sector).toBe('bank');
      expect(result.output.bankVariant).toBe(true);
      expect(result.output.maxPossibleScore).toBe(9);
    });

    it('detects non-financial sector and maps to non-financial', async () => {
      mockFinancialStatementFindMany.mockResolvedValue(baseStatements as any);

      const result = await runStageAForCompany({
        userId: 'owner_user_01',
        symbol: 'TCS',
      }) as StageARunnerResult;

      expect(result.input.sector).toBe('non-financial');
      expect(result.output.bankVariant).toBe(false);
      expect(result.output.maxPossibleScore).toBe(10);
    });
  });

  describe('End-to-end scoreStageA execution', () => {
    it('passes a strong non-financial company (TCS)', async () => {
      mockFinancialStatementFindMany.mockResolvedValue(baseStatements as any);

      const result = await runStageAForCompany({
        userId: 'owner_user_01',
        symbol: 'TCS',
      }) as StageARunnerResult;

      // TCS has strong financials; gate should pass even if a conditional
      // warning (e.g., P/E vs industry) makes the verdict "CONDITIONAL".
      expect(result.output.gatePassed).toBe(true);
      expect(result.output.canProceedToStageB).toBe(true);
      expect(result.output.hardStops.length).toBe(0);
      expect(result.output.totalPoints).toBeGreaterThanOrEqual(result.output.minPassScore);
      expect(result.output.verdictBand).toBeDefined();
    });

    it('fails a distressed bank company with hard stops (YESBANK)', async () => {
      const yesbankCompany = {
        id: 'comp-yesbank',
        symbol: 'YESBANK',
        name: 'Yes Bank Ltd.',
        sector: 'Financial Services',
        userId: 'owner_user_01',
      };

      const yesbankStatements = [
        {
          fiscalYear: 'FY2024',
          reportedPeriod: 'FY2024',
          revenue: 90000,
          netProfit: 4000,
          operatingProfit: 15000,
          totalAssets: 200000,
          totalLiabilities: 120000,
          totalEquity: 80000,
          totalDebt: 150000,
          currentAssets: 50000,
          currentLiabilities: 80000,
          interestExpense: 14000,
          ebit: 18000,
          eps: 4,
        },
        {
          fiscalYear: 'FY2023',
          reportedPeriod: 'FY2023',
          revenue: 92000,
          netProfit: 3000,
          operatingProfit: 15000,
          totalAssets: 200000,
          totalLiabilities: 122000,
          totalEquity: 78000,
          totalDebt: 145000,
          currentAssets: 48000,
          currentLiabilities: 82000,
          interestExpense: 14000,
          ebit: 16000,
          eps: 3,
        },
        {
          fiscalYear: 'FY2022',
          reportedPeriod: 'FY2022',
          revenue: 98000,
          netProfit: 6000,
          operatingProfit: 20000,
          totalAssets: 200000,
          totalLiabilities: 125000,
          totalEquity: 75000,
          totalDebt: 135000,
          currentAssets: 50000,
          currentLiabilities: 78000,
          interestExpense: 13500,
          ebit: 21000,
          eps: 6,
        },
        {
          fiscalYear: 'FY2021',
          reportedPeriod: 'FY2021',
          revenue: 105000,
          netProfit: 12000,
          operatingProfit: 25000,
          totalAssets: 205000,
          totalLiabilities: 132000,
          totalEquity: 73000,
          totalDebt: 130000,
          currentAssets: 52000,
          currentLiabilities: 75000,
          interestExpense: 13000,
          ebit: 25000,
          eps: 12,
        },
        {
          fiscalYear: 'FY2020',
          reportedPeriod: 'FY2020',
          revenue: 110000,
          netProfit: 18000,
          operatingProfit: 30000,
          totalAssets: 210000,
          totalLiabilities: 130000,
          totalEquity: 80000,
          totalDebt: 120000,
          currentAssets: 55000,
          currentLiabilities: 70000,
          interestExpense: 12000,
          ebit: 30000,
          eps: 18,
        },
      ];

      mockCompanyFindFirst.mockResolvedValue(yesbankCompany as any);
      mockFinancialStatementFindMany.mockResolvedValue(yesbankStatements as any);

      const result = await runStageAForCompany({
        userId: 'owner_user_01',
        symbol: 'YESBANK',
      }) as StageARunnerResult;

      expect(result.input.sector).toBe('bank');
      expect(result.output.verdict).toBe('FAIL');
      expect(result.output.gatePassed).toBe(false);
      expect(result.output.canProceedToStageB).toBe(false);
      expect(result.output.hardStops.length).toBeGreaterThan(0);

      const hardStopMessages = result.output.hardStops.map((f) => f.message);
      const hasDebtOrRoeFlag = hardStopMessages.some(
        (m) => m.toLowerCase().includes('debt') || m.toLowerCase().includes('equity') || m.toLowerCase().includes('roe')
      );
      expect(hasDebtOrRoeFlag).toBe(true);

      const hardStopRules = result.output.ruleResults.filter(
        (r) => r.redFlags.some((f) => f.class === 'HARD_STOP')
      );
      expect(hardStopRules.length).toBeGreaterThan(0);
    });
  });
});
