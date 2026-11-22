/**
 * Unit tests for apps/web/lib/services/stage-b-runner.ts
 *
 * Verifies:
 * 1. DB-to-StageBInput mapping (including null preservation without zero-coercion)
 * 2. End-to-end execution of scoreStageB for a passing company
 * 3. End-to-end execution of scoreStageB for a hard-stop failing company
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runStageBForCompany } from './stage-b-runner';
import type { StageBRunnerResult } from './stage-b-runner';

vi.mock('@stock-assistant/db', () => ({
  prisma: {
    company: { findFirst: vi.fn() },
    financialStatement: { findMany: vi.fn() },
    shareholding: { findMany: vi.fn() },
  },
}));

import { prisma } from '@stock-assistant/db';

const mockCompanyFindFirst = vi.mocked(prisma.company.findFirst) as any;
const mockFinancialStatementFindMany = vi.mocked(prisma.financialStatement.findMany) as any;
const mockShareholdingFindMany = vi.mocked(prisma.shareholding.findMany) as any;

const baseCompany = {
  id: 'comp-tcs',
  symbol: 'TCS',
  name: 'Tata Consultancy Services Ltd.',
  sector: 'Information Technology',
  userId: 'owner_user_01',
};

function resetMocks() {
  mockCompanyFindFirst.mockReset();
  mockFinancialStatementFindMany.mockReset();
  mockShareholdingFindMany.mockReset();

  mockCompanyFindFirst.mockResolvedValue(baseCompany as any);
}

const annualStatements = [
  {
    fiscalYear: 'FY2024',
    reportedPeriod: 'FY2024',
    periodType: 'Annual',
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
  },
  {
    fiscalYear: 'FY2023',
    reportedPeriod: 'FY2023',
    periodType: 'Annual',
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
  },
  {
    fiscalYear: 'FY2022',
    reportedPeriod: 'FY2022',
    periodType: 'Annual',
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
  },
  {
    fiscalYear: 'FY2021',
    reportedPeriod: 'FY2021',
    periodType: 'Annual',
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
  },
  {
    fiscalYear: 'FY2020',
    reportedPeriod: 'FY2020',
    periodType: 'Annual',
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
  },
];

const quarterlyStatements = [
  { fiscalYear: 'Q1 FY2024', reportedPeriod: 'Q1 FY2024', periodType: 'Quarterly', revenue: 155000, operatingProfit: 38000 },
  { fiscalYear: 'Q2 FY2024', reportedPeriod: 'Q2 FY2024', periodType: 'Quarterly', revenue: 158000, operatingProfit: 39000 },
  { fiscalYear: 'Q3 FY2024', reportedPeriod: 'Q3 FY2024', periodType: 'Quarterly', revenue: 162000, operatingProfit: 40000 },
  { fiscalYear: 'Q4 FY2024', reportedPeriod: 'Q4 FY2024', periodType: 'Quarterly', revenue: 165000, operatingProfit: 41000 },
  { fiscalYear: 'Q1 FY2025', reportedPeriod: 'Q1 FY2025', periodType: 'Quarterly', revenue: 170000, operatingProfit: 42000 },
  { fiscalYear: 'Q2 FY2025', reportedPeriod: 'Q2 FY2025', periodType: 'Quarterly', revenue: 175000, operatingProfit: 43000 },
  { fiscalYear: 'Q3 FY2025', reportedPeriod: 'Q3 FY2025', periodType: 'Quarterly', revenue: 180000, operatingProfit: 44000 },
  { fiscalYear: 'Q4 FY2025', reportedPeriod: 'Q4 FY2025', periodType: 'Quarterly', revenue: 185000, operatingProfit: 45000 },
];

const shareholdings = [
  { period: 'FY2024', promoterPct: 71.8, fiiPct: 13.0, diiPct: 9.5, publicPct: 5.7, promoterPledgePct: null },
  { period: 'FY2023', promoterPct: 72.0, fiiPct: 12.5, diiPct: 9.8, publicPct: 5.7, promoterPledgePct: null },
  { period: 'FY2022', promoterPct: 72.1, fiiPct: 12.0, diiPct: 10.0, publicPct: 5.9, promoterPledgePct: null },
];

describe('stage-b-runner', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('DB-to-StageBInput mapping', () => {
    it('maps annual + quarterly financial statements and shareholdings into StageBInput', async () => {
      // Mock: return only annual statements for annual query, quarterly for quarterly
      mockFinancialStatementFindMany.mockImplementation((args: any) => {
        const where = args?.where ?? {};
        if (where.periodType === 'Quarterly') {
          return Promise.resolve(quarterlyStatements as any);
        }
        return Promise.resolve(annualStatements as any);
      });
      mockShareholdingFindMany.mockResolvedValue(shareholdings as any);

      const result = await runStageBForCompany({
        userId: 'owner_user_01',
        symbol: 'TCS',
      }) as StageBRunnerResult;

      expect(result.company.symbol).toBe('TCS');

      const annual = result.input.annual;
      expect(annual.length).toBe(5);
      // annual[0] is now FY2020 (oldest first, chronological)
      expect(annual[0]!.sales).toBe(456000);
      expect(annual[0]!.netProfit).toBe(78000);
      expect(annual[4]!.sales).toBe(612000); // FY2024 is last
      expect(annual[4]!.netProfit).toBe(138000);
      expect(annual[4]!.opm).toBeCloseTo(148000 / 612000, 4);
      expect(annual[4]!.netMargin).toBeCloseTo(138000 / 612000, 4);
      expect(annual[4]!.roce).toBeCloseTo(148400 / (285000 - 95000), 4);
      expect(annual[4]!.reserves).toBe(190000);
      expect(annual[4]!.borrowings).toBe(8000);

      const quarterly = result.input.quarterly;
      expect(quarterly.length).toBe(8);

      const sh = result.input.shareholding;
      expect(sh.length).toBe(3);
      // sh[0] is FY2022 (oldest first, chronological), sh[2] is FY2024
      expect(sh[2]!.promoterPct).toBe(71.8);
      expect(sh[2]!.publicPct).toBe(5.7);
    });

    it('preserves null values without zero-coercion for missing metrics', async () => {
      const statementsWithNulls = annualStatements.map((s, i) => ({
        ...s,
        netProfit: i === 0 ? null : s.netProfit,
        totalEquity: i === 0 ? null : s.totalEquity,
        ebit: i === 0 ? null : s.ebit,
      }));

      mockFinancialStatementFindMany.mockImplementation((args: any) => {
        const where = args?.where ?? {};
        if (where.periodType === 'Quarterly') {
          return Promise.resolve([] as any);
        }
        return Promise.resolve(statementsWithNulls as any);
      });
      mockShareholdingFindMany.mockResolvedValue([] as any);

      const result = await runStageBForCompany({
        userId: 'owner_user_01',
        symbol: 'TCS',
      }) as StageBRunnerResult;

      const annual = result.input.annual;
      // FY2024 (index 0 in original, now index 4 after reversal) has nulls
      expect(annual[4]!.netProfit).toBeNull();
      expect(annual[4]!.reserves).toBeNull();

      // ROCE cannot be computed without equity → null
      expect(annual[4]!.roce).toBeNull();
      expect(annual[4]!.netMargin).toBeNull();
    });

    it('runs successfully for a bank-sector company', async () => {
      mockCompanyFindFirst.mockResolvedValue({ ...baseCompany, symbol: 'HDFCBANK', sector: 'Financial Services' } as any);
      mockFinancialStatementFindMany.mockImplementation((args: any) => {
        const where = args?.where ?? {};
        if (where.periodType === 'Quarterly') {
          return Promise.resolve(quarterlyStatements as any);
        }
        return Promise.resolve(annualStatements as any);
      });
      mockShareholdingFindMany.mockResolvedValue(shareholdings as any);

      const result = await runStageBForCompany({
        userId: 'owner_user_01',
        symbol: 'HDFCBANK',
      }) as StageBRunnerResult;

      expect(result.company.symbol).toBe('HDFCBANK');
      expect(result.output.verdict).toBeDefined();
    });
  });

  describe('End-to-end scoreStageB execution', () => {
    it('passes a strong non-financial company (TCS)', async () => {
      // Annual query first, then quarterly query
      mockFinancialStatementFindMany
        .mockResolvedValueOnce(annualStatements as any)
        .mockResolvedValueOnce(quarterlyStatements as any);
      mockShareholdingFindMany.mockResolvedValue(shareholdings as any);

      const result = await runStageBForCompany({
        userId: 'owner_user_01',
        symbol: 'TCS',
      }) as StageBRunnerResult;

      expect(result.output.gatePassed).toBe(true);
      expect(result.output.canProceedToStageC).toBe(true);
      expect(result.output.hardStops.length).toBe(0);
      expect(result.output.totalPoints).toBeGreaterThanOrEqual(result.output.minPassScore ?? 0);
      expect(result.output.verdictBand).toBeDefined();
    });

    it('fails a company with hard stops (negative sales growth)', async () => {
      const decliningStatements = annualStatements.map((s, i) => ({
        ...s,
        revenue: i === 0 ? 400000 : s.revenue, // FY2024 revenue lower than FY2023
        netProfit: i === 0 ? 50000 : s.netProfit,
      }));

      mockFinancialStatementFindMany.mockImplementation((args: any) => {
        const where = args?.where ?? {};
        if (where.periodType === 'Quarterly') {
          return Promise.resolve(quarterlyStatements as any);
        }
        return Promise.resolve(decliningStatements as any);
      });
      mockShareholdingFindMany.mockResolvedValue(shareholdings as any);

      const result = await runStageBForCompany({
        userId: 'owner_user_01',
        symbol: 'TCS',
      }) as StageBRunnerResult;

      expect(result.output.verdict).toBe('FAIL');
      expect(result.output.gatePassed).toBe(false);
      expect(result.output.canProceedToStageC).toBe(false);
      expect(result.output.hardStops.length).toBeGreaterThan(0);

      const hardStopMessages = result.output.hardStops.map((f) => f.message);
      const hasGrowthFlag = hardStopMessages.some((m) => m.toLowerCase().includes('growth') || m.toLowerCase().includes('sales'));
      expect(hasGrowthFlag).toBe(true);
    });
  });
});
