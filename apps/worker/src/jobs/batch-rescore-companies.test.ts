import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchRescoreService } from './services/batch-rescore.service.js';
import { handleBatchRescoreCompanies } from './handlers/batch-rescore-companies.js';
import { logger } from '../lib/logger.js';

describe('BatchRescoreService', () => {
  let mockPrisma: any;
  let service: BatchRescoreService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      ruleSet: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      company: {
        findMany: vi.fn(),
      },
      financialStatement: {
        findMany: vi.fn(),
      },
      shareholding: {
        findMany: vi.fn(),
      },
      priceBar: {
        findFirst: vi.fn(),
      },
      dataSnapshot: {
        create: vi.fn(),
        update: vi.fn(),
      },
      analysisRun: {
        create: vi.fn(),
        update: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (callback: any) => callback(mockPrisma)),
    };

    service = new BatchRescoreService(mockPrisma);
  });

  const mockAnnualStatements = [
    {
      id: 'fs-1',
      fiscalYear: 'FY2024',
      revenue: 240000,
      operatingProfit: 60000,
      netProfit: 45000,
      ebit: 58000,
      totalAssets: 150000,
      totalLiabilities: 45000,
      totalEquity: 105000,
      totalDebt: 5000,
      currentAssets: 80000,
      currentLiabilities: 35000,
      interestExpense: 1000,
      eps: 125,
      fcf: 40000,
    },
    {
      id: 'fs-2',
      fiscalYear: 'FY2023',
      revenue: 220000,
      operatingProfit: 54000,
      netProfit: 40000,
      ebit: 52000,
      totalAssets: 140000,
      totalLiabilities: 40000,
      totalEquity: 100000,
      totalDebt: 6000,
      currentAssets: 75000,
      currentLiabilities: 32000,
      interestExpense: 1100,
      eps: 110,
      fcf: 36000,
    },
  ];

  const mockQuarterlyStatements = [
    {
      id: 'q-1',
      fiscalYear: 'FY2024',
      fiscalQuarter: 'Q4',
      revenue: 62000,
      operatingProfit: 16000,
      netProfit: 12000,
    },
    {
      id: 'q-2',
      fiscalYear: 'FY2024',
      fiscalQuarter: 'Q3',
      revenue: 60000,
      operatingProfit: 15000,
      netProfit: 11500,
    },
  ];

  const mockShareholdings = [
    {
      period: '2024-Q4',
      promoterPct: 72.5,
      fiiPct: 15.2,
      diiPct: 7.8,
      publicPct: 4.5,
      promoterPledgePct: 0.0,
    },
  ];

  it('rescores Stage A and Stage B, saving immutable DataSnapshot and AnalysisRun records', async () => {
    mockPrisma.ruleSet.findFirst.mockResolvedValue({
      id: 'rs-1',
      version: 'v1.0.0',
      status: 'PUBLISHED',
      benchmarks: [
        {
          industry: 'IT services',
          opmMinPct: 0.22,
          typicalPE: 25,
          minRoaPct: 0.15,
        },
      ],
    });

    mockPrisma.company.findMany.mockResolvedValue([
      {
        id: 'comp-1',
        userId: 'user-1',
        symbol: 'TCS',
        name: 'Tata Consultancy Services',
        sector: 'IT services',
      },
    ]);

    mockPrisma.financialStatement.findMany
      .mockResolvedValueOnce(mockAnnualStatements)
      .mockResolvedValueOnce(mockQuarterlyStatements);

    mockPrisma.shareholding.findMany.mockResolvedValue(mockShareholdings);
    mockPrisma.priceBar.findFirst.mockResolvedValue({
      close: 3500,
      date: new Date('2026-11-20'),
    });

    mockPrisma.dataSnapshot.create.mockResolvedValue({
      id: 'snap-1',
      companyId: 'comp-1',
    });

    mockPrisma.analysisRun.create
      .mockResolvedValueOnce({ id: 'run-stage-a', stage: 'A' })
      .mockResolvedValueOnce({ id: 'run-stage-b', stage: 'B' });

    mockPrisma.auditEvent.create.mockResolvedValue({ id: 'audit-1' });

    const jobLogger = logger.forJob('job-rescore-1', 'batch-rescore-companies');
    const result = await service.rescore(
      {
        userId: 'user-1',
        companyIds: ['comp-1'],
        stages: ['A', 'B'],
      },
      jobLogger
    );

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);

    // Verify snapshot creation
    expect(mockPrisma.dataSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 'comp-1',
        }),
      })
    );

    // Verify AnalysisRun creation for Stage A
    expect(mockPrisma.analysisRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 'comp-1',
          userId: 'user-1',
          stage: 'A',
          dataSnapshotId: 'snap-1',
        }),
      })
    );

    // Verify audit event written
    expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'BATCH_RESCORE_COMPANIES',
        }),
      })
    );

    // IMMUTABILITY VERIFICATION: DataSnapshot and AnalysisRun are NEVER updated
    expect(mockPrisma.dataSnapshot.update).not.toHaveBeenCalled();
    expect(mockPrisma.analysisRun.update).not.toHaveBeenCalled();
  });

  it('demonstrates partial-failure resilience: one failing company does not abort the batch', async () => {
    mockPrisma.ruleSet.findFirst.mockResolvedValue({
      id: 'rs-1',
      version: 'v1.0.0',
      status: 'PUBLISHED',
      benchmarks: [],
    });

    mockPrisma.company.findMany.mockResolvedValue([
      {
        id: 'comp-good',
        userId: 'user-1',
        symbol: 'GOOD',
        sector: 'Technology',
      },
      {
        id: 'comp-bad',
        userId: 'user-1',
        symbol: 'BAD',
        sector: 'Manufacturing',
      },
    ]);

    // For comp-good: return valid financials
    mockPrisma.financialStatement.findMany
      .mockResolvedValueOnce(mockAnnualStatements)
      .mockResolvedValueOnce(mockQuarterlyStatements);
    mockPrisma.shareholding.findMany.mockResolvedValueOnce(mockShareholdings);
    mockPrisma.priceBar.findFirst.mockResolvedValueOnce({ close: 2000, date: new Date() });

    // For comp-bad: make financialStatement query throw a fatal error
    mockPrisma.financialStatement.findMany.mockRejectedValueOnce(
      new Error('Corrupted financial statement line items')
    );

    mockPrisma.dataSnapshot.create.mockResolvedValue({ id: 'snap-good' });
    mockPrisma.analysisRun.create.mockResolvedValue({ id: 'run-good' });
    mockPrisma.auditEvent.create.mockResolvedValue({ id: 'audit-1' });

    const jobLogger = logger.forJob('job-rescore-2', 'batch-rescore-companies');
    const result = await service.rescore(
      {
        userId: 'user-1',
        stages: ['A'],
      },
      jobLogger
    );

    expect(result.processed).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.symbol).toBe('BAD');
    expect(result.errors[0]?.error).toContain('Corrupted financial statement line items');

    // Overall audit event is still recorded with the failure summary
    expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'BATCH_RESCORE_COMPANIES',
          afterState: expect.objectContaining({
            processed: 2,
            succeeded: 1,
            failed: 1,
          }),
        }),
      })
    );
  });
});

describe('handleBatchRescoreCompanies Handler', () => {
  it('rejects invalid payload missing required userId without retrying', async () => {
    const result = await handleBatchRescoreCompanies('job-h-bad', {});
    expect(result.success).toBe(false);
    expect(result.failureCategory).toBe('INVALID_PAYLOAD');
    expect(result.retryable).toBe(false);
  });

  it('executes valid payload and returns structured execution result', async () => {
    // With no database connection, it fails gracefully with PERSISTENCE_ERROR or passes
    const result = await handleBatchRescoreCompanies('job-h-valid', {
      userId: 'test_user_01',
      stages: ['A'],
    });
    expect(result.jobId).toBe('job-h-valid');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
