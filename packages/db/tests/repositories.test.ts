/**
 * Repository boundary tests for @stock-assistant/db
 * Verifies repository classes can be instantiated with a mocked Prisma client
 * without requiring a live database connection.
 */

import { describe, it, expect, vi } from 'vitest';
import { CompanyRepository } from '../src/repositories/company-repository.js';
import { FinancialsRepository } from '../src/repositories/financials-repository.js';
import { AnalysisRepository } from '../src/repositories/analysis-repository.js';
import {
  IngestionJobRepository,
  JobLeaseConflictError,
  StaleLeaseError,
  InvalidStatusTransitionError,
  TerminalStateError,
  REUSABLE_STATUSES,
  TERMINAL_STATUSES,
} from '../src/repositories/ingestion-job-repository.js';
import { runInTransaction } from '../src/utils/transaction.js';

// Mock Prisma client
const mockPrisma = {
  company: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  financialStatement: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  analysisRun: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  ingestionJob: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(async (callback: any) => callback(mockPrisma)),
} as any;

describe('Repository boundary tests', () => {
  describe('CompanyRepository', () => {
    it('can be instantiated with a mock Prisma client', () => {
      const repo = new CompanyRepository(mockPrisma);
      expect(repo).toBeInstanceOf(CompanyRepository);
    });

    it('findById calls prisma with userId filter', async () => {
      const repo = new CompanyRepository(mockPrisma);
      mockPrisma.company.findFirst.mockResolvedValue(null);
      await repo.findById('test-id', 'user-1');
      expect(mockPrisma.company.findFirst).toHaveBeenCalledWith({
        where: { id: 'test-id', userId: 'user-1' },
      });
    });
  });

  describe('FinancialsRepository', () => {
    it('can be instantiated with a mock Prisma client', () => {
      const repo = new FinancialsRepository(mockPrisma);
      expect(repo).toBeInstanceOf(FinancialsRepository);
    });

    it('create passes null financial fields through without coercion', async () => {
      const repo = new FinancialsRepository(mockPrisma);
      mockPrisma.financialStatement.create.mockResolvedValue({
        id: 'fs-1',
        companyId: 'company-1',
        periodType: 'Annual',
        fiscalYear: 'FY2024',
        fiscalQuarter: null,
        revenue: null,
        netProfit: null,
        operatingProfit: null,
        totalAssets: null,
        totalLiabilities: null,
        totalEquity: null,
        totalDebt: null,
        currentAssets: null,
        currentLiabilities: null,
        interestExpense: null,
        ebit: null,
        eps: null,
        depreciationAmortization: null,
        capitalExpenditure: null,
        changeInWorkingCapital: null,
        fcf: null,
      });

      await repo.create({
        company: { connect: { id: 'company-1' } },
        periodType: 'Annual',
        fiscalYear: 'FY2024',
        fiscalQuarter: null,
        revenue: null,
        netProfit: null,
        operatingProfit: null,
        totalAssets: null,
        totalLiabilities: null,
        totalEquity: null,
        totalDebt: null,
        currentAssets: null,
        currentLiabilities: null,
        interestExpense: null,
        ebit: null,
        eps: null,
        depreciationAmortization: null,
        capitalExpenditure: null,
        changeInWorkingCapital: null,
        fcf: null,
      });

      expect(mockPrisma.financialStatement.create).toHaveBeenCalledWith({
        data: {
          company: { connect: { id: 'company-1' } },
          periodType: 'Annual',
          fiscalYear: 'FY2024',
          fiscalQuarter: null,
          revenue: null,
          netProfit: null,
          operatingProfit: null,
          totalAssets: null,
          totalLiabilities: null,
          totalEquity: null,
          totalDebt: null,
          currentAssets: null,
          currentLiabilities: null,
          interestExpense: null,
          ebit: null,
          eps: null,
          depreciationAmortization: null,
          capitalExpenditure: null,
          changeInWorkingCapital: null,
          fcf: null,
        },
      });
    });

    it('create passes fully populated financial fields', async () => {
      const repo = new FinancialsRepository(mockPrisma);
      mockPrisma.financialStatement.create.mockResolvedValue({
        id: 'fs-1',
        companyId: 'company-1',
        periodType: 'Annual',
        fiscalYear: 'FY2024',
        fiscalQuarter: null,
        revenue: '1000.00',
        netProfit: '200.00',
        operatingProfit: '300.00',
        totalAssets: '5000.00',
        totalLiabilities: '3000.00',
        totalEquity: '2000.00',
        totalDebt: '1000.00',
        currentAssets: '1500.00',
        currentLiabilities: '800.00',
        interestExpense: '50.00',
        ebit: '350.00',
        eps: '10.50',
        depreciationAmortization: '100.00',
        capitalExpenditure: '200.00',
        changeInWorkingCapital: '50.00',
        fcf: '100.00',
      });

      await repo.create({
        company: { connect: { id: 'company-1' } },
        periodType: 'Annual',
        fiscalYear: 'FY2024',
        fiscalQuarter: null,
        revenue: '1000.00',
        netProfit: '200.00',
        operatingProfit: '300.00',
        totalAssets: '5000.00',
        totalLiabilities: '3000.00',
        totalEquity: '2000.00',
        totalDebt: '1000.00',
        currentAssets: '1500.00',
        currentLiabilities: '800.00',
        interestExpense: '50.00',
        ebit: '350.00',
        eps: '10.50',
        depreciationAmortization: '100.00',
        capitalExpenditure: '200.00',
        changeInWorkingCapital: '50.00',
        fcf: '100.00',
      });

      expect(mockPrisma.financialStatement.create).toHaveBeenCalledWith({
        data: {
          company: { connect: { id: 'company-1' } },
          periodType: 'Annual',
          fiscalYear: 'FY2024',
          fiscalQuarter: null,
          revenue: '1000.00',
          netProfit: '200.00',
          operatingProfit: '300.00',
          totalAssets: '5000.00',
          totalLiabilities: '3000.00',
          totalEquity: '2000.00',
          totalDebt: '1000.00',
          currentAssets: '1500.00',
          currentLiabilities: '800.00',
          interestExpense: '50.00',
          ebit: '350.00',
          eps: '10.50',
          depreciationAmortization: '100.00',
          capitalExpenditure: '200.00',
          changeInWorkingCapital: '50.00',
          fcf: '100.00',
        },
      });
    });

    it('findByCompanyAndPeriod enforces tenant ownership', async () => {
      const repo = new FinancialsRepository(mockPrisma);
      mockPrisma.financialStatement.findFirst.mockResolvedValue(null);

      await repo.findByCompanyAndPeriod(
        'company-1',
        'user-1',
        'Annual',
        'FY2024',
        null
      );

      expect(mockPrisma.financialStatement.findFirst).toHaveBeenCalledWith({
        where: {
          companyId: 'company-1',
          company: { userId: 'user-1' },
          periodType: 'Annual',
          fiscalYear: 'FY2024',
        },
        orderBy: { fetchedAt: 'desc' },
      });
    });

    it('findByCompanyAndPeriod includes fiscalQuarter when provided', async () => {
      const repo = new FinancialsRepository(mockPrisma);
      mockPrisma.financialStatement.findFirst.mockResolvedValue(null);

      await repo.findByCompanyAndPeriod(
        'company-1',
        'user-1',
        'Quarterly',
        'FY2024',
        'Q1'
      );

      expect(mockPrisma.financialStatement.findFirst).toHaveBeenCalledWith({
        where: {
          companyId: 'company-1',
          company: { userId: 'user-1' },
          periodType: 'Quarterly',
          fiscalYear: 'FY2024',
          fiscalQuarter: 'Q1',
        },
        orderBy: { fetchedAt: 'desc' },
      });
    });

    it('findLatestByCompany orders by reportedPeriod desc', async () => {
      const repo = new FinancialsRepository(mockPrisma);
      mockPrisma.financialStatement.findFirst.mockResolvedValue(null);
      await repo.findLatestByCompany('company-1', 'user-1');
      expect(mockPrisma.financialStatement.findFirst).toHaveBeenCalledWith({
        where: {
          companyId: 'company-1',
          company: { userId: 'user-1' },
        },
        orderBy: { reportedPeriod: 'desc', fetchedAt: 'desc' },
      });
    });
  });

  describe('AnalysisRepository', () => {
    it('can be instantiated with a mock Prisma client', () => {
      const repo = new AnalysisRepository(mockPrisma);
      expect(repo).toBeInstanceOf(AnalysisRepository);
    });
  });

  describe('Transaction utility', () => {
    it('executes callback within transaction', async () => {
      const result = await runInTransaction(mockPrisma, async (tx) => {
        return 'success';
      });
      expect(result).toBe('success');
    });
  });

  describe('IngestionJobRepository', () => {
    it('can be instantiated with a mock Prisma client', () => {
      const repo = new IngestionJobRepository(mockPrisma);
      expect(repo).toBeInstanceOf(IngestionJobRepository);
    });

    it('createOrReuseJob creates a new job when none exists', async () => {
      const repo = new IngestionJobRepository(mockPrisma);
      const now = new Date().toISOString();
      mockPrisma.ingestionJob.findFirst.mockResolvedValue(null);
      mockPrisma.ingestionJob.create.mockResolvedValue({
        id: 'job-1',
        userId: 'user-1',
        status: 'QUEUED',
        storageKey: 'stage_abc',
        sha256Hash: 'abc123',
        attemptCount: 0,
        retryLimit: 3,
        createdAt: now,
        updatedAt: now,
      } as any);

      const result = await repo.createOrReuseJob({
        userId: 'user-1',
        storageKey: 'stage_abc',
        sha256Hash: 'abc123',
      });

      expect(result.created).toBe(true);
      expect(result.job.userId).toBe('user-1');
      expect(result.job.status).toBe('QUEUED');
      expect(mockPrisma.ingestionJob.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          status: 'QUEUED',
          storageProvider: 'local',
          storageKey: 'stage_abc',
          originalFilename: undefined,
          fileSizeBytes: undefined,
          mimeType: undefined,
          sha256Hash: 'abc123',
          attemptCount: 0,
          retryLimit: 3,
          objectDeleted: false,
        },
      });
    });

    it('createOrReuseJob reuses an existing reusable job', async () => {
      const repo = new IngestionJobRepository(mockPrisma);
      const now = new Date().toISOString();
      const existing = {
        id: 'job-1',
        userId: 'user-1',
        status: 'COMPLETED',
        storageKey: 'stage_abc',
        sha256Hash: 'abc123',
        attemptCount: 1,
        retryLimit: 3,
        createdAt: now,
        updatedAt: now,
      } as any;
      mockPrisma.ingestionJob.findFirst.mockResolvedValue(existing);

      const result = await repo.createOrReuseJob({
        userId: 'user-1',
        storageKey: 'stage_abc',
        sha256Hash: 'abc123',
      });

      expect(result.created).toBe(false);
      expect(result.job.id).toBe('job-1');
      expect(mockPrisma.ingestionJob.create).not.toHaveBeenCalled();
    });

    it('findByIdForUser is tenant-scoped', async () => {
      const repo = new IngestionJobRepository(mockPrisma);
      mockPrisma.ingestionJob.findFirst.mockResolvedValue(null);

      await repo.findByIdForUser('job-1', 'user-1');

      expect(mockPrisma.ingestionJob.findFirst).toHaveBeenCalledWith({
        where: { id: 'job-1', userId: 'user-1' },
      });
    });

    it('findReusableByUserAndHash returns null for failed jobs', async () => {
      const repo = new IngestionJobRepository(mockPrisma);
      mockPrisma.ingestionJob.findFirst.mockResolvedValue(null);

      const result = await repo.findReusableByUserAndHash('user-1', 'abc123');

      expect(result).toBeNull();
      expect(mockPrisma.ingestionJob.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          sha256Hash: 'abc123',
          status: { in: ['QUEUED', 'PROCESSING', 'VALIDATING', 'COMPLETED'] },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('claimJob atomically claims a QUEUED job', async () => {
      const repo = new IngestionJobRepository(mockPrisma);
      const now = new Date();
      const expiresAt = new Date(Date.now() + 300000);
      const claimed = {
        id: 'job-1',
        userId: 'user-1',
        status: 'PROCESSING',
        leaseOwner: 'worker-1',
        leaseToken: 'token-abc',
        leaseExpiresAt: expiresAt,
        attemptCount: 1,
      } as any;
      mockPrisma.ingestionJob.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.ingestionJob.findUnique.mockResolvedValue(claimed);

      const result = await repo.claimJob('job-1', 'worker-1', 'token-abc', expiresAt);

      expect(result).not.toBeNull();
      expect(mockPrisma.ingestionJob.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'job-1',
          status: 'QUEUED',
          OR: [
            { leaseExpiresAt: null },
            { leaseExpiresAt: { lt: now } },
          ],
        },
        data: {
          status: 'PROCESSING',
          leaseOwner: 'worker-1',
          leaseToken: 'token-abc',
          leaseExpiresAt: expiresAt,
          lastHeartbeatAt: now,
          startedAt: now,
          attemptCount: { increment: 1 },
        },
      });
    });

    it('claimJob returns null when job already claimed', async () => {
      const repo = new IngestionJobRepository(mockPrisma);
      const now = new Date();
      const expiresAt = new Date(Date.now() + 300000);
      mockPrisma.ingestionJob.updateMany.mockResolvedValue({ count: 0 });

      const result = await repo.claimJob('job-1', 'worker-1', 'token-abc', expiresAt);

      expect(result).toBeNull();
    });

    it('renewLease verifies lease token', async () => {
      const repo = new IngestionJobRepository(mockPrisma);
      const expiresAt = new Date(Date.now() + 300000);
      const renewed = {
        id: 'job-1',
        status: 'PROCESSING',
        leaseToken: 'token-abc',
      } as any;
      mockPrisma.ingestionJob.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.ingestionJob.findUnique.mockResolvedValue(renewed);

      const result = await repo.renewLease('job-1', 'token-abc', expiresAt);

      expect(result).not.toBeNull();
      expect(mockPrisma.ingestionJob.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'job-1',
          status: 'PROCESSING',
          leaseToken: 'token-abc',
        },
        data: {
          leaseExpiresAt: expiresAt,
          lastHeartbeatAt: expect.any(Date),
        },
      });
    });

    it('renewLease returns null for wrong lease token', async () => {
      const repo = new IngestionJobRepository(mockPrisma);
      mockPrisma.ingestionJob.updateMany.mockResolvedValue({ count: 0 });

      const result = await repo.renewLease('job-1', 'wrong-token', new Date());

      expect(result).toBeNull();
    });

    it('updateProgress enforces monotonic counters', async () => {
      const repo = new IngestionJobRepository(mockPrisma);
      const existing = {
        id: 'job-1',
        status: 'PROCESSING',
        leaseToken: 'token-abc',
        processedRows: 100,
        acceptedRows: 80,
        rejectedRows: 20,
        totalRows: 200,
      } as any;
      mockPrisma.ingestionJob.findUnique.mockResolvedValue(existing);
      mockPrisma.ingestionJob.update.mockResolvedValue({ ...existing, processedRows: 150 } as any);

      const result = await repo.updateProgress('job-1', 'token-abc', {
        processedRows: 150,
        acceptedRows: 90,
      });

      expect(result?.processedRows).toBe(150);
      expect(result?.acceptedRows).toBe(90);
    });

    it('updateProgress rejects decreasing counters', async () => {
      const repo = new IngestionJobRepository(mockPrisma);
      const existing = {
        id: 'job-1',
        status: 'PROCESSING',
        leaseToken: 'token-abc',
        processedRows: 100,
        acceptedRows: 80,
        rejectedRows: 20,
      } as any;
      mockPrisma.ingestionJob.findUnique.mockResolvedValue(existing);

      await expect(
        repo.updateProgress('job-1', 'token-abc', { processedRows: 50 })
      ).rejects.toThrow(/processedRows cannot decrease/);
    });

    it('updateProgress rejects stale lease token', async () => {
      const repo = new IngestionJobRepository(mockPrisma);
      const existing = {
        id: 'job-1',
        status: 'PROCESSING',
        leaseToken: 'token-abc',
        processedRows: 100,
        acceptedRows: 80,
        rejectedRows: 20,
      } as any;
      mockPrisma.ingestionJob.findUnique.mockResolvedValue(existing);

      await expect(
        repo.updateProgress('job-1', 'wrong-token', { processedRows: 150 })
      ).rejects.toThrow(StaleLeaseError);
    });

    it('markCompleted transitions to terminal state', async () => {
      const repo = new IngestionJobRepository(mockPrisma);
      const existing = {
        id: 'job-1',
        status: 'PROCESSING',
        leaseToken: 'token-abc',
        processedRows: 100,
        acceptedRows: 80,
        rejectedRows: 20,
      } as any;
      const completed = { ...existing, status: 'COMPLETED' } as any;
      mockPrisma.ingestionJob.findUnique.mockResolvedValue(existing);
      mockPrisma.ingestionJob.update.mockResolvedValue(completed);

      const result = await repo.markCompleted('job-1', 'token-abc');

      expect(result?.status).toBe('COMPLETED');
      expect(mockPrisma.ingestionJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          leaseOwner: null,
          leaseToken: null,
          leaseExpiresAt: null,
        }),
      });
    });

    it('markCompleted rejects terminal state', async () => {
      const repo = new IngestionJobRepository(mockPrisma);
      const existing = {
        id: 'job-1',
        status: 'FAILED',
        leaseToken: 'token-abc',
      } as any;
      mockPrisma.ingestionJob.findUnique.mockResolvedValue(existing);

      await expect(
        repo.markCompleted('job-1', 'token-abc')
      ).rejects.toThrow(TerminalStateError);
    });

    it('markFailedOrRetry schedules retry when attempts remain', async () => {
      const repo = new IngestionJobRepository(mockPrisma);
      const existing = {
        id: 'job-1',
        status: 'PROCESSING',
        leaseToken: 'token-abc',
        attemptCount: 0,
        retryLimit: 3,
      } as any;
      const retried = { ...existing, status: 'QUEUED', attemptCount: 1 } as any;
      mockPrisma.ingestionJob.findUnique.mockResolvedValue(existing);
      mockPrisma.ingestionJob.update.mockResolvedValue(retried);

      const nextRetry = new Date(Date.now() + 60000);
      const result = await repo.markFailedOrRetry('job-1', 'token-abc', {
        failureCategory: 'PERSISTENCE_ERROR',
        nextRetryAt: nextRetry,
      });

      expect(result?.status).toBe('QUEUED');
      expect(result?.attemptCount).toBe(1);
    });

    it('markFailedOrRetry marks FAILED when retry exhausted', async () => {
      const repo = new IngestionJobRepository(mockPrisma);
      const existing = {
        id: 'job-1',
        status: 'PROCESSING',
        leaseToken: 'token-abc',
        attemptCount: 2,
        retryLimit: 3,
      } as any;
      const failed = { ...existing, status: 'FAILED', attemptCount: 3 } as any;
      mockPrisma.ingestionJob.findUnique.mockResolvedValue(existing);
      mockPrisma.ingestionJob.update.mockResolvedValue(failed);

      const result = await repo.markFailedOrRetry('job-1', 'token-abc', {
        failureCategory: 'ROW_VALIDATION_ERROR',
      });

      expect(result?.status).toBe('FAILED');
      expect(result?.attemptCount).toBe(3);
    });

    it('recoverExpiredLeases resets expired PROCESSING jobs', async () => {
      const repo = new IngestionJobRepository(mockPrisma);
      mockPrisma.ingestionJob.updateMany.mockResolvedValue({ count: 2 });

      const count = await repo.recoverExpiredLeases();

      expect(count).toBe(2);
      expect(mockPrisma.ingestionJob.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'PROCESSING',
          OR: [
            { leaseExpiresAt: null },
            { leaseExpiresAt: { lt: expect.any(Date) } },
          ],
        },
        data: {
          status: 'QUEUED',
          leaseOwner: null,
          leaseToken: null,
          leaseExpiresAt: null,
          lastHeartbeatAt: expect.any(Date),
          attemptCount: { increment: 1 },
        },
      });
    });

    it('markStagedObjectDeleted marks object as deleted', async () => {
      const repo = new IngestionJobRepository(mockPrisma);
      const existing = { id: 'job-1', objectDeleted: false } as any;
      const updated = { ...existing, objectDeleted: true } as any;
      mockPrisma.ingestionJob.findUnique.mockResolvedValue(existing);
      mockPrisma.ingestionJob.update.mockResolvedValue(updated);

      const result = await repo.markStagedObjectDeleted('job-1');

      expect(result?.objectDeleted).toBe(true);
    });

    it('findPendingObjectCleanup finds jobs pending cleanup', async () => {
      const repo = new IngestionJobRepository(mockPrisma);
      const olderThan = new Date();
      mockPrisma.ingestionJob.findMany.mockResolvedValue([]);

      const result = await repo.findPendingObjectCleanup(olderThan);

      expect(result).toEqual([]);
      expect(mockPrisma.ingestionJob.findMany).toHaveBeenCalledWith({
        where: {
          objectDeleted: false,
          status: { in: ['COMPLETED', 'FAILED'] },
          OR: [
            { retentionExpiresAt: { lt: olderThan } },
            { completedAt: { lt: olderThan } },
            { failedAt: { lt: olderThan } },
          ],
        },
        orderBy: { updatedAt: 'asc' },
      });
    });
  });
});
