/**
 * Unit tests for apps/web/lib/services/stage-c-runner.ts
 *
 * Verifies:
 * 1. DB-to-StageCInput mapping (including null preservation in ROE history)
 * 2. End-to-end execution of scoreStageC for a passing moat assessment
 * 3. End-to-end execution of scoreStageC for a hard-stop failing company (copyable business)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runStageCForCompany } from './stage-c-runner';
import type { StageCRunnerResult } from './stage-c-runner';

vi.mock('@stock-assistant/db', () => ({
  prisma: {
    company: { findFirst: vi.fn() },
    financialStatement: { findMany: vi.fn() },
  },
}));

import { prisma } from '@stock-assistant/db';

const mockCompanyFindFirst = vi.mocked(prisma.company.findFirst);
const mockFinancialStatementFindMany = vi.mocked(prisma.financialStatement.findMany);

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
  mockCompanyFindFirst.mockResolvedValue(baseCompany as any);
}

const baseBusinessModel = [
  {
    questionId: 'value-creation',
    answer: 'The company creates value by providing IT services to global enterprises.',
    confidence: 'high',
    tags: ['verified-fact'],
    evidence: [
      {
        description: 'Revenue from global enterprise clients',
        source: 'Annual Report FY2024',
        sourceType: 'filing',
        relevance: 'direct',
      },
    ],
  },
  {
    questionId: 'value-capture',
    answer: 'The company captures value through long-term contracts and high switching costs.',
    confidence: 'high',
    tags: ['verified-fact'],
    evidence: [
      {
        description: 'Multi-year client contracts with lock-in periods',
        source: 'Annual Report FY2024',
        sourceType: 'filing',
        relevance: 'direct',
      },
    ],
  },
  {
    questionId: 'scalability',
    answer: 'The business scales by adding new clients and delivery centers with low marginal cost.',
    confidence: 'high',
    tags: ['verified-fact'],
    evidence: [
      {
        description: 'Revenue growth with stable employee growth',
        source: 'Annual Reports',
        sourceType: 'filing',
        relevance: 'direct',
      },
    ],
  },
];

const baseMoatTests = [
  {
    testId: 1,
    answer: 'no',
    confidence: 'high',
    rationale: 'Proprietary client relationships and domain expertise are difficult to replicate.',
    evidence: [
      {
        description: 'Top-5 client relationships spanning 10+ years',
        source: 'Annual Report FY2024',
        sourceType: 'filing',
        relevance: 'direct',
      },
    ],
  },
  {
    testId: 2,
    answer: 'yes',
    confidence: 'high',
    rationale: 'Brand and scale moat has persisted for 20+ years.',
    evidence: [
      {
        description: '20+ years of consistent market leadership',
        source: 'Industry Report',
        sourceType: 'analyst-report',
        relevance: 'direct',
      },
    ],
  },
  {
    testId: 3,
    answer: 'yes',
    confidence: 'high',
    rationale: 'ROE has been consistently above 20% for the last decade.',
    evidence: [
      {
        description: '10Y ROE history from financial statements',
        source: 'Annual Reports',
        sourceType: 'filing',
        relevance: 'direct',
      },
    ],
  },
  {
    testId: 4,
    answer: 'yes',
    confidence: 'medium',
    rationale: 'Pricing power demonstrated through annual price increases.',
    evidence: [
      {
        description: 'Annual bill rate increases passed to clients',
        source: 'Management Transcript',
        sourceType: 'transcript',
        relevance: 'supporting',
      },
    ],
  },
  {
    testId: 5,
    answer: 'yes',
    confidence: 'medium',
    rationale: 'Stable market share in the Indian IT services market.',
    evidence: [
      {
        description: 'Market share data from industry reports',
        source: 'Industry Report',
        sourceType: 'analyst-report',
        relevance: 'contextual',
      },
    ],
  },
];

describe('stage-c-runner', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('DB-to-StageCInput mapping', () => {
    it('maps business model answers, moat types, moat tests, and ROE history into StageCInput', async () => {
      const roeStatements = [
        { fiscalYear: 'FY2024', reportedPeriod: 'FY2024', periodType: 'Annual', netProfit: 138000, totalEquity: 190000 },
        { fiscalYear: 'FY2023', reportedPeriod: 'FY2023', periodType: 'Annual', netProfit: 102000, totalEquity: 182000 },
      ];
      mockFinancialStatementFindMany.mockResolvedValue(roeStatements as any);

      const result = await runStageCForCompany({
        userId: 'owner_user_01',
        symbol: 'TCS',
        businessModel: baseBusinessModel as any,
        businessModelCategory: 'SUBSCRIPTION',
        moatTypes: ['BRAND', 'SWITCHING_COST'],
        moatTests: baseMoatTests as any,
        includeROEHistory: true,
      }) as StageCRunnerResult;

      expect(result.company.symbol).toBe('TCS');
      expect(result.input.businessModelCategory).toBe('SUBSCRIPTION');
      expect(result.input.moatTypes).toEqual(['BRAND', 'SWITCHING_COST']);
      expect(result.input.moatTests.length).toBe(5);
      expect(result.input.roeHistory10y?.length).toBe(2);
      // ROE = netProfit/totalEquity
      expect(result.input.roeHistory10y?.[0]).toBeCloseTo(138000 / 190000, 4);
    });

    it('preserves null values in ROE history without zero-coercion', async () => {
      const statementsWithNulls = [
        { fiscalYear: 'FY2024', reportedPeriod: 'FY2024', periodType: 'Annual', netProfit: null, totalEquity: 190000 },
        { fiscalYear: 'FY2023', reportedPeriod: 'FY2023', periodType: 'Annual', netProfit: 102000, totalEquity: null },
      ];
      mockFinancialStatementFindMany.mockResolvedValue(statementsWithNulls as any);

      const result = await runStageCForCompany({
        userId: 'owner_user_01',
        symbol: 'TCS',
        businessModel: baseBusinessModel as any,
        moatTests: baseMoatTests as any,
        includeROEHistory: true,
      }) as StageCRunnerResult;

      // Nulls preserved as null, NOT coerced to 0
      expect(result.input.roeHistory10y?.[0]).toBeNull();
      expect(result.input.roeHistory10y?.[1]).toBeNull();
    });
  });

  describe('End-to-end scoreStageC execution', () => {
    it('passes a strong moat assessment (TCS)', async () => {
      mockFinancialStatementFindMany.mockResolvedValue([] as any);

      const result = await runStageCForCompany({
        userId: 'owner_user_01',
        symbol: 'TCS',
        businessModel: baseBusinessModel as any,
        businessModelCategory: 'SUBSCRIPTION',
        moatTypes: ['BRAND', 'SWITCHING_COST'],
        moatTests: baseMoatTests as any,
        includeROEHistory: false,
      }) as StageCRunnerResult;

      expect(result.output.gatePassed).toBe(true);
      expect(result.output.canProceedToStageD).toBe(true);
      expect(result.output.moatPass).toBe(true);
      expect(result.output.hardStops.length).toBe(0);
      expect(result.output.moatScore).toBeGreaterThanOrEqual(result.output.minPassScore);
      expect(result.output.verdictBand).toBeDefined();
    });

    it('fails a copyable business with hard stop (Test 1 = yes)', async () => {
      const copyableTests = baseMoatTests.map((t) =>
        t.testId === 1 ? { ...t, answer: 'yes' } : t
      );

      mockFinancialStatementFindMany.mockResolvedValue([] as any);

      const result = await runStageCForCompany({
        userId: 'owner_user_01',
        symbol: 'TCS',
        businessModel: baseBusinessModel as any,
        moatTests: copyableTests as any,
        includeROEHistory: false,
      }) as StageCRunnerResult;
      expect(result.output.verdict).toBe('FAIL');
      expect(result.output.gatePassed).toBe(false);
      expect(result.output.canProceedToStageD).toBe(false);
      expect(result.output.hardStops.length).toBeGreaterThan(0);

      const hardStopMessages = result.output.hardStops.map((f) => f.message);
      const hasCopyableFlag = hardStopMessages.some((m) => m.toLowerCase().includes('copyable'));
      expect(hasCopyableFlag).toBe(true);
    });
  });
});
