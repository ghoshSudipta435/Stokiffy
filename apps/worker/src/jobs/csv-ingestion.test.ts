import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CSVIngestionService } from './services/csv-ingestion.service.js';
import { handleProcessFileIngestion } from './handlers/process-csv-import.js';
import { WorkerStorageService } from '../lib/storage.js';
import { processFileIngestionPayloadSchema } from './types.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Worker CSV Ingestion & Processing Pipeline', () => {
  let tempDir: string;
  let tempJobsDir: string;
  let storage: WorkerStorageService;
  let mockPrisma: any;
  let service: CSVIngestionService;

  const writeJobSidecar = (jobId: string, overrides: Record<string, unknown> = {}) => {
    const record = {
      jobId,
      storageKey: 'stage_00000000-0000-0000-0000-000000000000',
      fileName: 'test.csv',
      fileSizeBytes: 100,
      sha256Hash: 'hash_test',
      userId: 'user_owner_01',
      fileType: 'GENERIC_CSV',
      status: 'QUEUED',
      queue: 'file-ingestion',
      enqueuedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
    fs.writeFileSync(path.join(tempJobsDir, `${jobId}.json`), JSON.stringify(record, null, 2), 'utf-8');
    return record;
  };

  const readJobSidecar = (jobId: string) => {
    return JSON.parse(fs.readFileSync(path.join(tempJobsDir, `${jobId}.json`), 'utf-8'));
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stokiffy-worker-test-'));
    tempJobsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stokiffy-worker-jobs-'));
    storage = new WorkerStorageService(tempDir);

    // Mock Prisma Client matching repository boundary contract
    mockPrisma = {
      company: {
        create: vi.fn(async ({ data }: any) => ({
          id: 'comp_test_1',
          userId: data.user.connect.id,
          symbol: data.symbol,
          name: data.name,
          sector: data.sector,
          exchange: data.exchange,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        findFirst: vi.fn(),
      },
      financialStatement: {
        create: vi.fn(async ({ data }: any) => ({
          id: 'stmt_test_1',
          companyId: 'comp_test_1',
          ...data,
          createdAt: new Date(),
        })),
        findFirst: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(async ({ data }: any) => ({
          id: 'audit_test_1',
          ...data,
          createdAt: new Date(),
        })),
      },
      $transaction: vi.fn(async (callback: any) => callback(mockPrisma)),
    };

    service = new CSVIngestionService(storage, mockPrisma, tempJobsDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    if (fs.existsSync(tempJobsDir)) {
      fs.rmSync(tempJobsDir, { recursive: true, force: true });
    }
  });

  describe('Payload Validation', () => {
    it('accepts valid processFileIngestionPayload with all fields', () => {
      const valid = {
        jobTicketId: 'ticket_001',
        storageKey: 'stage_00000000-0000-0000-0000-000000000001',
        fileName: 'tcs_fy24.csv',
        fileSizeBytes: 2048,
        sha256Hash: 'hash_abc',
        userId: 'user_123',
        fileType: 'GENERIC_CSV',
      };
      const parsed = processFileIngestionPayloadSchema.parse(valid);
      expect(parsed.jobTicketId).toBe('ticket_001');
      expect(parsed.storageKey).toBe('stage_00000000-0000-0000-0000-000000000001');
    });

    it('rejects invalid payload with negative file size', () => {
      const invalid = {
        jobTicketId: 'ticket_001',
        fileName: 'tcs.csv',
        fileSizeBytes: -50,
      };
      expect(() => processFileIngestionPayloadSchema.parse(invalid)).toThrow();
    });

    it('classifies unexpected ingestion service exceptions as RETRYABLE_INFRA_ERROR, not INVALID_PAYLOAD', async () => {
      const crashingService = new CSVIngestionService(storage, mockPrisma, tempJobsDir);
      vi.spyOn(crashingService, 'processImport').mockRejectedValue(new Error('Unexpected worker crash'));

      const validPayload = {
        jobTicketId: 'ticket_crash_01',
        fileName: 'tcs.csv',
        fileSizeBytes: 100,
        fileType: 'GENERIC_CSV',
        uploadedBy: 'user_owner_01',
      };

      const result = await handleProcessFileIngestion(
        'pg_crash_1',
        validPayload,
        { retryCount: 0, retryLimit: 3 },
        crashingService
      );

      expect(result.success).toBe(false);
      expect(result.failureCategory).toBe('RETRYABLE_INFRA_ERROR');
      expect(result.retryable).toBe(true);
    });
  });

  describe('CSV File Processing & Error Scenarios', () => {
    it('fails with MISSING_STAGED_FILE (non-retryable) when staged file does not exist on disk', async () => {
      writeJobSidecar('ticket_missing');
      const payload = {
        jobTicketId: 'ticket_missing',
        storageKey: 'stage_00000000-0000-0000-0000-000000000099',
        fileName: 'missing.csv',
        fileSizeBytes: 100,
        userId: 'user_123',
        fileType: 'GENERIC_CSV',
        uploadedBy: 'user_123',
      };

      const result = await service.processImport(payload, { retryCount: 0, retryLimit: 3 });
      expect(result.success).toBe(false);
      expect(result.failureCategory).toBe('MISSING_STAGED_FILE');
      expect(result.retryable).toBe(false);
      expect(result.error).toMatch(/FILE_NOT_FOUND/);
      expect(readJobSidecar('ticket_missing').status).toBe('FAILED');
    });

    it('processes valid CSV, maps financial statements, persists to DB and deletes staged file', async () => {
      const storageKey = 'stage_11111111-1111-1111-1111-111111111111';
      const userId = 'user_owner_01';
      const csvData = `Symbol,Revenue,Net Profit,Operating Profit,Total Assets,Total Liabilities,Total Equity,Total Debt,Current Assets,Current Liabilities,Interest Expense,EBIT,EPS,Reported Period
TCS,240000,45000,55000,150000,50000,100000,0,80000,40000,1000,60000,125.5,FY2024
INFY,150000,26000,35000,110000,30000,80000,0,60000,25000,800,38000,65.2,FY2024`;

      writeJobSidecar('job_ingest_01', { storageKey, userId });

      // Save staged file and metadata
      fs.writeFileSync(path.join(tempDir, `${storageKey}.data`), csvData, 'utf-8');
      fs.writeFileSync(
        path.join(tempDir, `${storageKey}.meta.json`),
        JSON.stringify({
          storageKey,
          originalFileName: 'it_companies.csv',
          fileSizeBytes: Buffer.byteLength(csvData),
          sha256Hash: 'hash_val',
          userId,
        })
      );

      // Company not found -> will create
      mockPrisma.company.findFirst.mockResolvedValue(null);
      // Statement not found -> will create
      mockPrisma.financialStatement.findFirst.mockResolvedValue(null);

      const result = await service.processImport({
        jobTicketId: 'job_ingest_01',
        storageKey,
        fileName: 'it_companies.csv',
        fileSizeBytes: Buffer.byteLength(csvData),
        sha256Hash: 'hash_val',
        userId,
        fileType: 'GENERIC_CSV',
        uploadedBy: userId,
      });

      expect(result.success).toBe(true);
      expect(result.phase).toBe('COMPLETED');
      expect(result.processedCount).toBe(2);
      expect(result.validRowCount).toBe(2);

      // Verify DB transaction was executed
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.company.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.financialStatement.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.auditEvent.create).toHaveBeenCalledTimes(2);

      // Verify sidecar reached COMPLETED
      expect(readJobSidecar('job_ingest_01').status).toBe('COMPLETED');

      // Verify staged file was cleaned up on successful completion
      expect(fs.existsSync(path.join(tempDir, `${storageKey}.data`))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, `${storageKey}.meta.json`))).toBe(false);
    });

    it('preserves null values without zero-coercion for missing financial metrics (regression test)', async () => {
      const storageKey = 'stage_22222222-2222-2222-2222-222222222222';
      const userId = 'user_owner_01';
      // Missing Total Debt, Current Liabilities, and cash-flow fields
      const csvData = `Symbol,Revenue,Net Profit,Total Debt,Current Liabilities,Reported Period
HUL,60000,10000,,,FY2024`;

      fs.writeFileSync(path.join(tempDir, `${storageKey}.data`), csvData, 'utf-8');
      fs.writeFileSync(
        path.join(tempDir, `${storageKey}.meta.json`),
        JSON.stringify({ storageKey, originalFileName: 'hul.csv', userId })
      );

      mockPrisma.company.findFirst.mockResolvedValue(null);
      mockPrisma.financialStatement.findFirst.mockResolvedValue(null);

      const result = await service.processImport({
        jobTicketId: 'job_null_test',
        storageKey,
        fileName: 'hul.csv',
        fileSizeBytes: Buffer.byteLength(csvData),
        sha256Hash: 'hash_val',
        userId,
        fileType: 'GENERIC_CSV',
        uploadedBy: userId,
      });

      expect(result.success).toBe(true);
      expect(result.validRowCount).toBe(1);

      // Regression assertion: missing metrics MUST be null, NEVER coerced to 0
      const createdStatementArg = mockPrisma.financialStatement.create.mock.calls[0]?.[0]?.data;
      expect(createdStatementArg.revenue).toBe(60000);
      expect(createdStatementArg.netProfit).toBe(10000);
      expect(createdStatementArg.totalDebt).toBeNull();
      expect(createdStatementArg.currentLiabilities).toBeNull();
      expect(createdStatementArg.depreciationAmortization).toBeNull();
      expect(createdStatementArg.fcf).toBeNull();
      expect(createdStatementArg.isMissing).toBe(true);
      expect(createdStatementArg.quality).toBe('missing');
    });

    it('classifies malformed CSV (<2 rows) as non-retryable CSV_PARSE_ERROR', async () => {
      const storageKey = 'stage_31313131-3131-3131-3131-313131313131';
      const userId = 'user_owner_01';
      const csvData = `Symbol,Revenue,Net Profit,Reported Period\n`;

      writeJobSidecar('job_malformed_csv', { storageKey, userId });
      fs.writeFileSync(path.join(tempDir, `${storageKey}.data`), csvData, 'utf-8');
      fs.writeFileSync(
        path.join(tempDir, `${storageKey}.meta.json`),
        JSON.stringify({ storageKey, originalFileName: 'header_only.csv', userId })
      );

      const result = await service.processImport(
        {
          jobTicketId: 'job_malformed_csv',
          storageKey,
          fileName: 'header_only.csv',
          fileSizeBytes: Buffer.byteLength(csvData),
          sha256Hash: 'hash_header_only',
          userId,
          fileType: 'GENERIC_CSV',
          uploadedBy: userId,
        },
        { retryCount: 0, retryLimit: 3 }
      );

      expect(result.success).toBe(false);
      expect(result.failureCategory).toBe('CSV_PARSE_ERROR');
      expect(result.retryable).toBe(false);
      expect(readJobSidecar('job_malformed_csv').status).toBe('FAILED');
    });

    it('captures row-level errors and returns non-retryable failure when all rows are invalid', async () => {
      const storageKey = 'stage_33333333-3333-3333-3333-333333333333';
      const userId = 'user_owner_01';
      // Invalid revenue (negative) and invalid period format
      const csvData = `Symbol,Revenue,Net Profit,Reported Period
TCS,-5000,1000,INVALID_PERIOD`;

      writeJobSidecar('job_bad_rows', { storageKey, userId });
      fs.writeFileSync(path.join(tempDir, `${storageKey}.data`), csvData, 'utf-8');
      fs.writeFileSync(
        path.join(tempDir, `${storageKey}.meta.json`),
        JSON.stringify({ storageKey, originalFileName: 'bad.csv', userId })
      );

      const result = await service.processImport(
        {
          jobTicketId: 'job_bad_rows',
          storageKey,
          fileName: 'bad.csv',
          fileSizeBytes: Buffer.byteLength(csvData),
          sha256Hash: 'hash_bad',
          userId,
          fileType: 'GENERIC_CSV',
          uploadedBy: userId,
        },
        { retryCount: 0, retryLimit: 3 }
      );

      expect(result.success).toBe(false);
      expect(result.failureCategory).toBe('ROW_VALIDATION_ERROR');
      expect(result.retryable).toBe(false);
      expect(result.errorsSummary).toBeDefined();
      expect(result.errorsSummary!.length).toBeGreaterThan(0);
      expect(result.errorsSummary![0]?.message).toMatch(/non-negative/);
      expect(readJobSidecar('job_bad_rows').status).toBe('FAILED');
    });

    it('is idempotent on retry: skips creating duplicate statements if already present', async () => {
      const storageKey = 'stage_44444444-4444-4444-4444-444444444444';
      const userId = 'user_owner_01';
      const csvData = `Symbol,Revenue,Net Profit,Reported Period\nRELIANCE,900000,70000,FY2024\n`;

      fs.writeFileSync(path.join(tempDir, `${storageKey}.data`), csvData, 'utf-8');
      fs.writeFileSync(
        path.join(tempDir, `${storageKey}.meta.json`),
        JSON.stringify({ storageKey, originalFileName: 'ril.csv', userId })
      );

      // Existing company and existing statement found
      mockPrisma.company.findFirst.mockResolvedValue({ id: 'comp_existing', symbol: 'RELIANCE', userId });
      mockPrisma.financialStatement.findFirst.mockResolvedValue({
        id: 'stmt_existing',
        periodType: 'Annual',
        fiscalYear: 'FY2024',
      });

      const result = await service.processImport({
        jobTicketId: 'job_retry_idempotent',
        storageKey,
        fileName: 'ril.csv',
        fileSizeBytes: Buffer.byteLength(csvData),
        sha256Hash: 'hash_ril',
        userId,
        fileType: 'GENERIC_CSV',
        uploadedBy: userId,
      });

      expect(result.success).toBe(true);
      // Statement creation was skipped
      expect(mockPrisma.financialStatement.create).not.toHaveBeenCalled();
      // Company creation was skipped
      expect(mockPrisma.company.create).not.toHaveBeenCalled();
    });

    it('classifies transient filesystem errors (EAGAIN/EMFILE) as RETRYABLE_INFRA_ERROR and keeps non-terminal status on intermediate attempt', async () => {
      const storageKey = 'stage_66666666-6666-6666-6666-666666666666';
      const userId = 'user_owner_01';
      writeJobSidecar('job_fs_transient', { storageKey, userId });

      const transientErr = Object.assign(new Error('Too many open files'), { code: 'EMFILE' });
      vi.spyOn(storage, 'getFileContent').mockRejectedValue(transientErr);

      const result = await service.processImport(
        {
          jobTicketId: 'job_fs_transient',
          storageKey,
          fileName: 'tcs.csv',
          fileSizeBytes: 100,
          sha256Hash: 'hash_fs',
          userId,
          fileType: 'GENERIC_CSV',
          uploadedBy: userId,
        },
        { retryCount: 0, retryLimit: 3 }
      );

      expect(result.success).toBe(false);
      expect(result.failureCategory).toBe('RETRYABLE_INFRA_ERROR');
      expect(result.retryable).toBe(true);
      // Intermediate attempt MUST NOT write terminal FAILED
      expect(readJobSidecar('job_fs_transient').status).toBe('PROCESSING');
    });

    it('retains staged file and keeps non-terminal PROCESSING status on intermediate DB connection/serialization failure', async () => {
      const storageKey = 'stage_55555555-5555-5555-5555-555555555555';
      const userId = 'user_owner_01';
      const csvData = `Symbol,Revenue,Net Profit,Reported Period\nWIPRO,80000,12000,FY2024\n`;

      writeJobSidecar('job_tx_intermediate', { storageKey, userId });
      fs.writeFileSync(path.join(tempDir, `${storageKey}.data`), csvData, 'utf-8');
      fs.writeFileSync(
        path.join(tempDir, `${storageKey}.meta.json`),
        JSON.stringify({ storageKey, originalFileName: 'wipro.csv', userId })
      );

      // Simulate PostgreSQL serialization failure (SQLSTATE 40001) on Attempt 1 (retryCount=0, retryLimit=3)
      const serErr = Object.assign(new Error('Serialization failure in PostgreSQL'), { code: '40001' });
      mockPrisma.$transaction.mockRejectedValue(serErr);

      const result = await service.processImport(
        {
          jobTicketId: 'job_tx_intermediate',
          storageKey,
          fileName: 'wipro.csv',
          fileSizeBytes: Buffer.byteLength(csvData),
          sha256Hash: 'hash_wipro',
          userId,
          fileType: 'GENERIC_CSV',
          uploadedBy: userId,
        },
        { retryCount: 0, retryLimit: 3 }
      );

      expect(result.success).toBe(false);
      expect(result.failureCategory).toBe('PERSISTENCE_ERROR');
      expect(result.retryable).toBe(true);
      expect(result.error).toMatch(/Serialization failure/);

      // Staged file MUST BE RETAINED for retry
      expect(fs.existsSync(path.join(tempDir, `${storageKey}.data`))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, `${storageKey}.meta.json`))).toBe(true);

      // Crucial ISS-03 check: intermediate retry MUST NOT show terminal FAILED
      expect(readJobSidecar('job_tx_intermediate').status).toBe('PROCESSING');
    });

    it('writes terminal FAILED status upon retry exhaustion for DB connection failure', async () => {
      const storageKey = 'stage_77777777-7777-7777-7777-777777777777';
      const userId = 'user_owner_01';
      const csvData = `Symbol,Revenue,Net Profit,Reported Period\nWIPRO,80000,12000,FY2024\n`;

      writeJobSidecar('job_tx_exhausted', { storageKey, userId });
      fs.writeFileSync(path.join(tempDir, `${storageKey}.data`), csvData, 'utf-8');
      fs.writeFileSync(
        path.join(tempDir, `${storageKey}.meta.json`),
        JSON.stringify({ storageKey, originalFileName: 'wipro.csv', userId })
      );

      // Simulate Prisma P1001 DB unreachable on final attempt (retryCount=3, retryLimit=3)
      const connErr = Object.assign(new Error("Can't reach database server"), { code: 'P1001' });
      mockPrisma.$transaction.mockRejectedValue(connErr);

      const result = await service.processImport(
        {
          jobTicketId: 'job_tx_exhausted',
          storageKey,
          fileName: 'wipro.csv',
          fileSizeBytes: Buffer.byteLength(csvData),
          sha256Hash: 'hash_wipro_2',
          userId,
          fileType: 'GENERIC_CSV',
          uploadedBy: userId,
        },
        { retryCount: 3, retryLimit: 3 }
      );

      expect(result.success).toBe(false);
      expect(result.failureCategory).toBe('PERSISTENCE_ERROR');
      expect(result.retryable).toBe(true);

      // Final attempt MUST persist terminal FAILED status with error details
      const sidecar = readJobSidecar('job_tx_exhausted');
      expect(sidecar.status).toBe('FAILED');
      expect(sidecar.failureCategory).toBe('PERSISTENCE_ERROR');
      expect(sidecar.error).toMatch(/Can't reach database server/);
    });

    it('logs explicit warning and returns false when job sidecar is missing during syncJobStatus', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const synced = await service.syncJobStatus('nonexistent_ticket_999', 'PROCESSING');
      expect(synced).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('Cycle 2B-R3: Single-Host Sidecar Concurrency Remediation (Worker)', () => {
    it('isolates concurrent updates across distinct job tickets and preserves parseable JSON and tenant ownership', async () => {
      writeJobSidecar('job_concurrent_a', { userId: 'user_owner_01', status: 'QUEUED' });
      writeJobSidecar('job_concurrent_b', { userId: 'user_other_02', status: 'QUEUED' });
      const untouchedPeer = writeJobSidecar('job_unrelated_peer', {
        userId: 'user_other_03',
        status: 'QUEUED',
      });

      const [resA, resB] = await Promise.all([
        service.syncJobStatus('job_concurrent_a', 'PROCESSING', { message: 'Tenant 1 processing' }),
        service.syncJobStatus('job_concurrent_b', 'VALIDATING', { message: 'Tenant 2 validating' }),
      ]);

      expect(resA).toBe(true);
      expect(resB).toBe(true);

      const finalA = readJobSidecar('job_concurrent_a');
      const finalB = readJobSidecar('job_concurrent_b');
      expect(finalA.status).toBe('PROCESSING');
      expect(finalA.userId).toBe('user_owner_01');
      expect(finalB.status).toBe('VALIDATING');
      expect(finalB.userId).toBe('user_other_02');
      expect(readJobSidecar('job_unrelated_peer')).toEqual(untouchedPeer);
    });

    it('prevents torn/corrupted JSON and metadata loss under heavy concurrent same-job updates', async () => {
      writeJobSidecar('job_same_target', { userId: 'user_owner_01', status: 'QUEUED' });

      // 12 concurrent updates of widely varying lengths on the exact same job ticket
      const results = await Promise.all([
        service.syncJobStatus('job_same_target', 'PROCESSING', { message: 'short' }),
        service.syncJobStatus('job_same_target', 'VALIDATING', {
          message: 'a much longer validation message '.repeat(15),
          processedCount: 10,
        }),
        service.syncJobStatus('job_same_target', 'PROCESSING', { message: 'retry 1' }),
        service.syncJobStatus('job_same_target', 'VALIDATING', { validRowCount: 9 }),
        service.syncJobStatus('job_same_target', 'COMPLETED', {
          processedCount: 10,
          validRowCount: 9,
          warningsCount: 1,
          message: 'finalized',
        }),
        service.syncJobStatus('job_same_target', 'PROCESSING', { message: 'late stale write 1' }),
        service.syncJobStatus('job_same_target', 'VALIDATING', { message: 'late stale write 2' }),
        service.syncJobStatus('job_same_target', 'PROCESSING', { message: 'late stale write 3' }),
      ]);

      expect(results.every((r) => r === true)).toBe(true);

      // Must remain valid parseable JSON, terminal COMPLETED must not regress, metadata preserved
      const finalState = readJobSidecar('job_same_target');
      expect(finalState.userId).toBe('user_owner_01');
      expect(finalState.status).toBe('COMPLETED');
      expect(finalState.processedCount).toBe(10);
      expect(finalState.validRowCount).toBe(9);
      expect(finalState.warningsCount).toBe(1);
      expect(finalState.completedAt).toBeDefined();

      // Zero leftover .tmp or .lock files
      const entries = fs.readdirSync(tempJobsDir);
      expect(entries.filter((f) => f.endsWith('.tmp') || f.endsWith('.lock'))).toEqual([]);
    });

    it('serializes interleaved read-modify-write via per-job lock and prevents COMPLETED from regressing to PROCESSING', async () => {
      writeJobSidecar('job_race_01', { userId: 'user_owner_01', status: 'QUEUED' });
      const unrelatedInitial = writeJobSidecar('job_race_unrelated', {
        userId: 'user_other_99',
        status: 'QUEUED',
      });

      const originalReadFile = fs.promises.readFile.bind(fs.promises);
      let releaseFirstRead!: () => void;
      const firstReadGate = new Promise<void>((resolve) => {
        releaseFirstRead = resolve;
      });
      let firstReadEntered!: () => void;
      const firstReadStarted = new Promise<void>((resolve) => {
        firstReadEntered = resolve;
      });

      let readCallCount = 0;
      const readSpy = vi.spyOn(fs.promises, 'readFile').mockImplementation((async (
        filePath: any,
        options?: any
      ) => {
        const content = await originalReadFile(filePath, options);
        if (String(filePath).endsWith('job_race_01.json')) {
          readCallCount += 1;
          if (readCallCount === 1) {
            firstReadEntered();
            await firstReadGate;
          }
        }
        return content;
      }) as typeof fs.promises.readFile);

      try {
        // 1. Start Update A (PROCESSING) and pause it while it holds the per-job lock
        const updateA = service.syncJobStatus('job_race_01', 'PROCESSING', {
          message: 'Older processing write',
        });
        await firstReadStarted;

        // 2. Start Update B (COMPLETED) concurrently — must wait on Update A's per-job lock
        let updateBCompleted = false;
        const updateB = service
          .syncJobStatus('job_race_01', 'COMPLETED', {
            processedCount: 5,
            validRowCount: 5,
            message: 'Newer completed write',
          })
          .then((res) => {
            updateBCompleted = true;
            return res;
          });

        // Unrelated job MUST NOT be blocked by job_race_01's lock!
        const unrelatedUpdated = await service.syncJobStatus('job_race_unrelated', 'PROCESSING', {
          message: 'Independent job progressed',
        });
        expect(unrelatedUpdated).toBe(true);
        expect(updateBCompleted).toBe(false); // Update B is still serialized behind Update A

        // 3. Release Update A -> Update A finishes PROCESSING, then Update B runs COMPLETED
        releaseFirstRead();
        const [resA, resB] = await Promise.all([updateA, updateB]);
        expect(resA).toBe(true);
        expect(resB).toBe(true);

        // 4. Subsequent late PROCESSING write AFTER COMPLETED must NOT regress terminal state
        const lateRes = await service.syncJobStatus('job_race_01', 'PROCESSING', {
          message: 'Late stale regression attempt',
        });
        expect(lateRes).toBe(true);

        const finalState = readJobSidecar('job_race_01');
        expect(finalState.userId).toBe('user_owner_01');
        expect(finalState.status).toBe('COMPLETED');
        expect(finalState.processedCount).toBe(5);
        expect(finalState.validRowCount).toBe(5);
        expect(finalState.completedAt).toBeDefined();
        expect(readJobSidecar('job_race_unrelated').userId).toBe(unrelatedInitial.userId);
        expect(readJobSidecar('job_race_unrelated').status).toBe('PROCESSING');
      } finally {
        readSpy.mockRestore();
      }
    });

    it('prevents committed FAILED state from regressing to PROCESSING and preserves error metadata', async () => {
      writeJobSidecar('job_failed_immutable', { userId: 'user_owner_01', status: 'PROCESSING' });

      await service.syncJobStatus('job_failed_immutable', 'FAILED', {
        failureCategory: 'ROW_VALIDATION_ERROR',
        error: 'All rows invalid',
        errorsSummary: [{ rowNumber: 1, column: 'revenue', value: '-10', message: 'must be >= 0' }],
      });

      // Attempt late regression to PROCESSING / VALIDATING / COMPLETED
      await service.syncJobStatus('job_failed_immutable', 'PROCESSING', { message: 'stale retry' });
      await service.syncJobStatus('job_failed_immutable', 'VALIDATING', { message: 'stale validating' });

      const finalState = readJobSidecar('job_failed_immutable');
      expect(finalState.status).toBe('FAILED');
      expect(finalState.failureCategory).toBe('ROW_VALIDATION_ERROR');
      expect(finalState.error).toBe('All rows invalid');
      expect(finalState.errorsSummary).toHaveLength(1);
    });

    it('preserves legitimate retry and processing transitions (QUEUED -> PROCESSING -> VALIDATING -> PROCESSING -> COMPLETED)', async () => {
      writeJobSidecar('job_retry_lifecycle', { userId: 'user_owner_01', status: 'QUEUED' });

      await service.syncJobStatus('job_retry_lifecycle', 'PROCESSING', { message: 'Attempt 1' });
      expect(readJobSidecar('job_retry_lifecycle').status).toBe('PROCESSING');

      await service.syncJobStatus('job_retry_lifecycle', 'VALIDATING', { processedCount: 3 });
      expect(readJobSidecar('job_retry_lifecycle').status).toBe('VALIDATING');

      // Legitimate retry back to PROCESSING (non-terminal -> non-terminal)
      await service.syncJobStatus('job_retry_lifecycle', 'PROCESSING', { message: 'Attempt 2 retry' });
      const retrying = readJobSidecar('job_retry_lifecycle');
      expect(retrying.status).toBe('PROCESSING');
      expect(retrying.processedCount).toBe(3); // Preserves existing metadata

      await service.syncJobStatus('job_retry_lifecycle', 'COMPLETED', { validRowCount: 3 });
      const done = readJobSidecar('job_retry_lifecycle');
      expect(done.status).toBe('COMPLETED');
      expect(done.processedCount).toBe(3);
      expect(done.validRowCount).toBe(3);
      expect(done.completedAt).toBeDefined();
    });
  });
});


