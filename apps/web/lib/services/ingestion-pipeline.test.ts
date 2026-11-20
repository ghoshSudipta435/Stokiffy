import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileStagingService } from './file-staging.service';
import { FileHashService } from './file-hash.service';
import { IngestionStatusService } from './ingestion-status.service';
import { IngestionQueueService } from '../queue/ingestion-queue.service';
import { LocalDiskStorageService } from '../storage/local-disk-storage';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Ingestion Pipeline & Staging Validation', () => {
  let tempStorageDir: string;
  let tempJobsDir: string;
  let storage: LocalDiskStorageService;
  let statusService: IngestionStatusService;
  let stagingService: FileStagingService;
  let queueService: IngestionQueueService;

  beforeEach(() => {
    tempStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stokiffy-test-storage-'));
    tempJobsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stokiffy-test-jobs-'));
    storage = new LocalDiskStorageService(tempStorageDir);
    statusService = new IngestionStatusService(tempJobsDir);
    stagingService = new FileStagingService(storage, statusService);
    queueService = new IngestionQueueService(statusService, storage);
  });

  afterEach(() => {
    if (fs.existsSync(tempStorageDir)) {
      fs.rmSync(tempStorageDir, { recursive: true, force: true });
    }
    if (fs.existsSync(tempJobsDir)) {
      fs.rmSync(tempJobsDir, { recursive: true, force: true });
    }
  });

  describe('File Validation', () => {
    it('accepts valid CSV file content and metadata', () => {
      const buffer = Buffer.from('Symbol,Revenue,Net Profit\nTCS,10000,2000\n');
      const result = stagingService.validateFile(buffer, 'tcs.csv', 'text/csv');
      expect(result.valid).toBe(true);
    });

    it('rejects empty file', () => {
      const emptyBuffer = Buffer.alloc(0);
      const result = stagingService.validateFile(emptyBuffer, 'empty.csv', 'text/csv');
      expect(result.valid).toBe(false);
      expect(result.field).toBe('file');
      expect(result.error).toMatch(/empty/i);
    });

    it('rejects file exceeding 25 MB limit', () => {
      // 26 MB buffer simulation
      const oversizedBuffer = { length: 26 * 1024 * 1024 } as unknown as Buffer;
      const result = stagingService.validateFile(oversizedBuffer, 'huge.csv', 'text/csv');
      expect(result.valid).toBe(false);
      expect(result.field).toBe('size');
      expect(result.error).toMatch(/25MB/);
    });

    it('rejects non-csv file extension', () => {
      const buffer = Buffer.from('Symbol,Revenue\nTCS,1000\n');
      const result = stagingService.validateFile(buffer, 'document.pdf', 'text/csv');
      expect(result.valid).toBe(false);
      expect(result.field).toBe('fileName');
      expect(result.error).toMatch(/\.csv/i);
    });

    it('rejects unsupported MIME types', () => {
      const buffer = Buffer.from('Symbol,Revenue\nTCS,1000\n');
      const result = stagingService.validateFile(buffer, 'data.csv', 'application/pdf');
      expect(result.valid).toBe(false);
      expect(result.field).toBe('mimeType');
      expect(result.error).toMatch(/Unsupported MIME type/);
    });

    it('rejects binary files containing null bytes', () => {
      const binaryBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x00, 0x2c, 0x00]);
      const result = stagingService.validateFile(binaryBuffer, 'fake.csv', 'text/csv');
      expect(result.valid).toBe(false);
      expect(result.field).toBe('file');
      expect(result.error).toMatch(/Null bytes/i);
    });

    it('rejects plain text files lacking CSV delimiters', () => {
      const textBuffer = Buffer.from('This is a plain text file without any delimiters');
      const result = stagingService.validateFile(textBuffer, 'nodot.csv', 'text/csv');
      expect(result.valid).toBe(false);
      expect(result.field).toBe('file');
      expect(result.error).toMatch(/delimiters/i);
    });
  });

  describe('SHA-256 Deduplication & Staging Lifecycle', () => {
    it('computes deterministic SHA-256 content hashes', () => {
      const content = Buffer.from('Symbol,Revenue\nTCS,1000\n');
      const hash1 = FileHashService.computeSha256(content);
      const hash2 = FileHashService.computeSha256(content);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('stages new files when no duplicate exists', async () => {
      const content = Buffer.from('Symbol,Revenue\nTCS,1000\n');
      const result = await stagingService.stageFile(content, 'tcs.csv', 'text/csv', 'user_123');

      expect(result.isDuplicate).toBe(false);
      expect(result.stagedFile).toBeDefined();
      expect(result.stagedFile?.originalFileName).toBe('tcs.csv');
      expect(result.stagedFile?.userId).toBe('user_123');
    });

    it('detects duplicate file for the same user and returns reusable job', async () => {
      const content = Buffer.from('Symbol,Revenue\nTCS,1000\n');
      const first = await stagingService.stageFile(content, 'tcs.csv', 'text/csv', 'user_123');
      expect(first.isDuplicate).toBe(false);

      // Create an active queued job for this file
      await statusService.createJob({
        jobId: 'job_test_dup',
        storageKey: first.stagedFile!.storageKey,
        fileName: 'tcs.csv',
        fileSizeBytes: content.length,
        sha256Hash: first.sha256Hash,
        userId: 'user_123',
        fileType: 'GENERIC_CSV',
        status: 'QUEUED',
        queue: 'file-ingestion',
        enqueuedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Second upload of identical content by the same user
      const second = await stagingService.stageFile(content, 'tcs_copy.csv', 'text/csv', 'user_123');
      expect(second.isDuplicate).toBe(true);
      expect(second.existingJob?.jobId).toBe('job_test_dup');
      expect(second.existingJob?.status).toBe('QUEUED');
    });

    it('does NOT treat failed jobs as usable duplicates', async () => {
      const content = Buffer.from('Symbol,Revenue\nTCS,1000\n');
      const first = await stagingService.stageFile(content, 'tcs.csv', 'text/csv', 'user_123');

      // Create a FAILED job for this content
      await statusService.createJob({
        jobId: 'job_test_failed',
        storageKey: first.stagedFile!.storageKey,
        fileName: 'tcs.csv',
        fileSizeBytes: content.length,
        sha256Hash: first.sha256Hash,
        userId: 'user_123',
        fileType: 'GENERIC_CSV',
        status: 'FAILED',
        queue: 'file-ingestion',
        enqueuedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        error: 'Simulated failure',
      });

      // Subsequent upload should NOT be considered duplicate and should stage fresh
      const second = await stagingService.stageFile(content, 'tcs.csv', 'text/csv', 'user_123');
      expect(second.isDuplicate).toBe(false);
      expect(second.stagedFile).toBeDefined();
    });

    it('strictly isolates deduplication across different users (no cross-user sharing)', async () => {
      const content = Buffer.from('Symbol,Revenue\nTCS,1000\n');
      const user1Result = await stagingService.stageFile(content, 'tcs.csv', 'text/csv', 'user_1');

      await statusService.createJob({
        jobId: 'job_user_1',
        storageKey: user1Result.stagedFile!.storageKey,
        fileName: 'tcs.csv',
        fileSizeBytes: content.length,
        sha256Hash: user1Result.sha256Hash,
        userId: 'user_1',
        fileType: 'GENERIC_CSV',
        status: 'QUEUED',
        queue: 'file-ingestion',
        enqueuedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // User 2 uploads the exact same file
      const user2Result = await stagingService.stageFile(content, 'tcs.csv', 'text/csv', 'user_2');
      expect(user2Result.isDuplicate).toBe(false);
      expect(user2Result.stagedFile?.userId).toBe('user_2');
      expect(user2Result.stagedFile?.storageKey).not.toBe(user1Result.stagedFile?.storageKey);
    });
  });

  describe('Queue Dispatch & Rollback', () => {
    it('creates job record with QUEUED status on dispatch', async () => {
      const payload = {
        jobTicketId: 'job_ticket_001',
        storageKey: 'stage_00000000-0000-0000-0000-000000000001',
        fileName: 'report.csv',
        fileSizeBytes: 1024,
        sha256Hash: 'hash_abc',
        userId: 'user_123',
        fileType: 'GENERIC_CSV',
        uploadedAt: new Date().toISOString(),
      };

      const record = await queueService.enqueueIngestionJob(payload);
      expect(record.jobId).toBe('job_ticket_001');
      expect(record.status).toBe('QUEUED');
      expect(record.queue).toBe('file-ingestion');

      const queried = await queueService.getJobStatus('job_ticket_001', 'user_123');
      expect(queried?.jobId).toBe('job_ticket_001');
    });

    it('rolls back newly staged file when queue dispatch encounters failure', async () => {
      const content = Buffer.from('Symbol,Revenue\nTCS,1000\n');
      const staged = await storage.saveFile(content, {
        originalFileName: 'test.csv',
        mimeType: 'text/csv',
        userId: 'user_123',
        sha256Hash: 'hash_xyz',
      });

      expect(await storage.exists(staged.storageKey, 'user_123')).toBe(true);

      // Fault injection: mock statusService.createJob to simulate failure
      const failingStatusService = new IngestionStatusService(tempJobsDir);
      failingStatusService.createJob = async () => {
        throw new Error('Database connection pool exhausted');
      };

      const faultyQueue = new IngestionQueueService(failingStatusService, storage);

      await expect(
        faultyQueue.enqueueIngestionJob({
          jobTicketId: 'job_rollback_test',
          storageKey: staged.storageKey,
          fileName: 'test.csv',
          fileSizeBytes: content.length,
          sha256Hash: 'hash_xyz',
          userId: 'user_123',
          fileType: 'GENERIC_CSV',
          uploadedAt: new Date().toISOString(),
        })
      ).rejects.toThrow(/QUEUE_DISPATCH_FAILED/);

      // Verify staged file was rolled back and deleted
      expect(await storage.exists(staged.storageKey, 'user_123')).toBe(false);
    });
  });

  describe('Job Status API & Security', () => {
    it('provides job status with row-level error summary', async () => {
      await statusService.createJob({
        jobId: 'job_with_errors',
        storageKey: 'stage_00000000-0000-0000-0000-000000000002',
        fileName: 'invalid.csv',
        fileSizeBytes: 2048,
        sha256Hash: 'hash_err',
        userId: 'user_123',
        fileType: 'GENERIC_CSV',
        status: 'VALIDATING',
        queue: 'file-ingestion',
        enqueuedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        processedCount: 10,
        validRowCount: 8,
        warningsCount: 2,
        errorsSummary: [
          { rowNumber: 3, column: 'revenue', value: '-500', message: 'revenue should be non-negative' },
          { rowNumber: 7, column: 'symbol', value: undefined, message: 'Symbol is required' },
        ],
      });

      const job = await statusService.getJobForUser('job_with_errors', 'user_123');
      expect(job).toBeDefined();
      expect(job?.status).toBe('VALIDATING');
      expect(job?.processedCount).toBe(10);
      expect(job?.errorsSummary).toHaveLength(2);
      expect(job?.errorsSummary?.[0]?.column).toBe('revenue');
    });

    it('enforces tenant scoping (cross-user access returns null)', async () => {
      await statusService.createJob({
        jobId: 'job_secret',
        storageKey: 'stage_00000000-0000-0000-0000-000000000003',
        fileName: 'secret.csv',
        fileSizeBytes: 100,
        sha256Hash: 'hash_sec',
        userId: 'victim_user',
        fileType: 'GENERIC_CSV',
        status: 'COMPLETED',
        queue: 'file-ingestion',
        enqueuedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Attacker queries victim's job
      const result = await statusService.getJobForUser('job_secret', 'attacker_user');
      expect(result).toBeNull();
    });
  });

  describe('ISS-04 Cross-Process Status Freshness (Disk-First Reads)', () => {
    it('reflects worker disk updates immediately without restarting web process', async () => {
      // 1. Web creates QUEUED job (cached in memoryStore)
      const created = await statusService.createJob({
        jobId: 'job_cross_proc_01',
        storageKey: 'stage_00000000-0000-0000-0000-000000000011',
        fileName: 'fresh.csv',
        fileSizeBytes: 512,
        sha256Hash: 'hash_fresh_01',
        userId: 'user_123',
        fileType: 'GENERIC_CSV',
        status: 'QUEUED',
        queue: 'file-ingestion',
        enqueuedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      expect((await statusService.getJobForUser('job_cross_proc_01', 'user_123'))?.status).toBe('QUEUED');

      // 2. Simulate separate worker process updating the sidecar JSON on disk to COMPLETED
      const sidecarPath = path.join(tempJobsDir, 'job_cross_proc_01.json');
      fs.writeFileSync(
        sidecarPath,
        JSON.stringify(
          {
            ...created,
            status: 'COMPLETED',
            processedCount: 5,
            validRowCount: 5,
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          null,
          2
        ),
        'utf-8'
      );

      // 3. Same web IngestionStatusService instance MUST read fresh COMPLETED state from disk
      const fresh = await statusService.getJobForUser('job_cross_proc_01', 'user_123');
      expect(fresh?.status).toBe('COMPLETED');
      expect(fresh?.processedCount).toBe(5);
      expect(fresh?.validRowCount).toBe(5);
    });

    it('lets disk FAILED state override stale memory QUEUED state during deduplication', async () => {
      // 1. Web creates QUEUED job (cached in memoryStore)
      const created = await statusService.createJob({
        jobId: 'job_stale_dedup',
        storageKey: 'stage_00000000-0000-0000-0000-000000000012',
        fileName: 'retry.csv',
        fileSizeBytes: 256,
        sha256Hash: 'hash_stale_dedup',
        userId: 'user_123',
        fileType: 'GENERIC_CSV',
        status: 'QUEUED',
        queue: 'file-ingestion',
        enqueuedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Initially reusable while QUEUED
      expect((await statusService.findReusableJobForUser('user_123', 'hash_stale_dedup'))?.jobId).toBe(
        'job_stale_dedup'
      );

      // 2. Worker updates disk sidecar to FAILED
      const sidecarPath = path.join(tempJobsDir, 'job_stale_dedup.json');
      fs.writeFileSync(
        sidecarPath,
        JSON.stringify({ ...created, status: 'FAILED', error: 'Validation failed' }, null, 2),
        'utf-8'
      );

      // 3. Disk state MUST override stale memoryStore QUEUED so user can re-upload
      const reusableAfterFail = await statusService.findReusableJobForUser('user_123', 'hash_stale_dedup');
      expect(reusableAfterFail).toBeNull();
    });

    it('enforces tenant isolation strictly during disk-first reads', async () => {
      const sidecarPath = path.join(tempJobsDir, 'job_disk_tenant.json');
      fs.writeFileSync(
        sidecarPath,
        JSON.stringify({
          jobId: 'job_disk_tenant',
          storageKey: 'stage_00000000-0000-0000-0000-000000000013',
          fileName: 'private.csv',
          fileSizeBytes: 128,
          sha256Hash: 'hash_private_disk',
          userId: 'tenant_a',
          fileType: 'GENERIC_CSV',
          status: 'COMPLETED',
          queue: 'file-ingestion',
          enqueuedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        'utf-8'
      );

      expect(await statusService.getJobForUser('job_disk_tenant', 'tenant_b')).toBeNull();
      expect(await statusService.findReusableJobForUser('tenant_b', 'hash_private_disk')).toBeNull();
      expect((await statusService.getJobForUser('job_disk_tenant', 'tenant_a'))?.status).toBe('COMPLETED');
    });

    it('handles missing sidecar cleanly and surfaces corrupt sidecar read errors deliberately', async () => {
      // Missing sidecar -> explicit null
      expect(await statusService.getJobById('job_does_not_exist')).toBeNull();

      // Corrupt sidecar JSON -> throws explicit JOB_STATUS_READ_ERROR (not silently hidden)
      const corruptPath = path.join(tempJobsDir, 'job_corrupt_json.json');
      fs.writeFileSync(corruptPath, '{invalid-json', 'utf-8');
      await expect(statusService.getJobById('job_corrupt_json')).rejects.toThrow(/JOB_STATUS_READ_ERROR/);
    });
  });

  describe('Cycle 2B-R3: Single-Host Sidecar Concurrency Remediation (Web Status Service)', () => {
    it('isolates concurrent updates across distinct tenant jobs and leaves unrelated sidecars untouched', async () => {
      await statusService.createJob({
        jobId: 'job_web_conc_a',
        storageKey: 'stage_00000000-0000-0000-0000-000000000021',
        fileName: 'conc_a.csv',
        fileSizeBytes: 128,
        sha256Hash: 'hash_web_conc_a',
        userId: 'tenant_owner',
        fileType: 'GENERIC_CSV',
        status: 'QUEUED',
        queue: 'file-ingestion',
        enqueuedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await statusService.createJob({
        jobId: 'job_web_conc_b',
        storageKey: 'stage_00000000-0000-0000-0000-000000000022',
        fileName: 'conc_b.csv',
        fileSizeBytes: 128,
        sha256Hash: 'hash_web_conc_b',
        userId: 'tenant_other',
        fileType: 'GENERIC_CSV',
        status: 'QUEUED',
        queue: 'file-ingestion',
        enqueuedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const unrelated = await statusService.createJob({
        jobId: 'job_web_unrelated',
        storageKey: 'stage_00000000-0000-0000-0000-000000000024',
        fileName: 'other.csv',
        fileSizeBytes: 64,
        sha256Hash: 'hash_web_unrelated',
        userId: 'tenant_third',
        fileType: 'GENERIC_CSV',
        status: 'QUEUED',
        queue: 'file-ingestion',
        enqueuedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await Promise.all([
        statusService.updateJobStatus('job_web_conc_a', { status: 'PROCESSING', message: 'Step A' }),
        statusService.updateJobStatus('job_web_conc_b', { status: 'VALIDATING', message: 'Step B' }),
      ]);

      // Both targets remain parseable and strictly tenant-scoped
      const viewA = await statusService.getJobForUser('job_web_conc_a', 'tenant_owner');
      const viewB = await statusService.getJobForUser('job_web_conc_b', 'tenant_other');
      expect(viewA?.status).toBe('PROCESSING');
      expect(viewB?.status).toBe('VALIDATING');
      expect(await statusService.getJobForUser('job_web_conc_a', 'tenant_other')).toBeNull();
      expect(await statusService.getJobForUser('job_web_conc_b', 'tenant_owner')).toBeNull();

      // Unrelated job sidecar remains intact
      const unrelatedView = await statusService.getJobForUser('job_web_unrelated', 'tenant_third');
      expect(unrelatedView).toEqual(unrelated);

      // No stray lock or temp files
      const leftoverArtifacts = fs
        .readdirSync(tempJobsDir)
        .filter((f) => f.endsWith('.tmp') || f.endsWith('.lock'));
      expect(leftoverArtifacts).toHaveLength(0);
    });

    it('prevents torn JSON writes and preserves COMPLETED metadata under heavy same-job Promise.all contention', async () => {
      const completedAt = '2026-11-18T14:30:00.000Z';
      await statusService.createJob({
        jobId: 'job_web_heavy_01',
        storageKey: 'stage_00000000-0000-0000-0000-000000000025',
        fileName: 'heavy.csv',
        fileSizeBytes: 512,
        sha256Hash: 'hash_web_heavy_01',
        userId: 'tenant_owner',
        fileType: 'GENERIC_CSV',
        status: 'QUEUED',
        queue: 'file-ingestion',
        enqueuedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await Promise.all([
        statusService.updateJobStatus('job_web_heavy_01', {
          status: 'PROCESSING',
          message: 'Pass 1 '.repeat(30),
        }),
        statusService.updateJobStatus('job_web_heavy_01', {
          status: 'VALIDATING',
          message: 'Validating rows',
        }),
        statusService.updateJobStatus('job_web_heavy_01', {
          status: 'COMPLETED',
          message: 'Completed cleanly',
          processedCount: 25,
          validRowCount: 25,
          warningsCount: 1,
          completedAt,
        }),
        statusService.updateJobStatus('job_web_heavy_01', {
          status: 'PROCESSING',
          message: 'Late worker retry pulse',
        }),
        statusService.updateJobStatus('job_web_heavy_01', {
          status: 'VALIDATING',
          message: 'Late validation pulse '.repeat(15),
        }),
        statusService.updateJobStatus('job_web_heavy_01', {
          status: 'QUEUED',
          message: 'Late queue reset',
        }),
      ]);

      // Disk JSON must be valid and strictly preserve COMPLETED + metadata
      const raw = fs.readFileSync(path.join(tempJobsDir, 'job_web_heavy_01.json'), 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.status).toBe('COMPLETED');
      expect(parsed.userId).toBe('tenant_owner');
      expect(parsed.processedCount).toBe(25);
      expect(parsed.validRowCount).toBe(25);
      expect(parsed.warningsCount).toBe(1);
      expect(parsed.completedAt).toBe(completedAt);

      const viaApi = await statusService.getJobForUser('job_web_heavy_01', 'tenant_owner');
      expect(viaApi?.status).toBe('COMPLETED');
      expect(viaApi?.processedCount).toBe(25);

      const leftoverArtifacts = fs
        .readdirSync(tempJobsDir)
        .filter((f) => f.endsWith('.tmp') || f.endsWith('.lock'));
      expect(leftoverArtifacts).toHaveLength(0);
    });

    it('serializes interleaved read-modify-write on the same job without blocking unrelated jobs and blocks COMPLETED regression', async () => {
      const completedAt = '2026-11-18T14:35:00.000Z';
      await statusService.createJob({
        jobId: 'job_web_race_1',
        storageKey: 'stage_00000000-0000-0000-0000-000000000023',
        fileName: 'race.csv',
        fileSizeBytes: 256,
        sha256Hash: 'hash_web_race_1',
        userId: 'tenant_owner',
        fileType: 'GENERIC_CSV',
        status: 'QUEUED',
        queue: 'file-ingestion',
        enqueuedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await statusService.createJob({
        jobId: 'job_web_unblocked_1',
        storageKey: 'stage_00000000-0000-0000-0000-000000000026',
        fileName: 'unblocked.csv',
        fileSizeBytes: 128,
        sha256Hash: 'hash_web_unblocked_1',
        userId: 'tenant_other',
        fileType: 'GENERIC_CSV',
        status: 'QUEUED',
        queue: 'file-ingestion',
        enqueuedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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

      let readCount = 0;
      const readSpy = vi.spyOn(fs.promises, 'readFile').mockImplementation((async (
        filePath: any,
        options?: any
      ) => {
        const content = await originalReadFile(filePath, options);
        if (String(filePath).endsWith('job_web_race_1.json')) {
          readCount += 1;
          if (readCount === 1) {
            firstReadEntered();
            await firstReadGate;
          }
        }
        return content;
      }) as typeof fs.promises.readFile);

      try {
        // 1. Start COMPLETED update and pause inside lock after reading QUEUED
        const completedUpdate = statusService.updateJobStatus('job_web_race_1', {
          status: 'COMPLETED',
          processedCount: 12,
          validRowCount: 12,
          completedAt,
        });
        await firstReadStarted;

        // 2. While job_web_race_1 is locked, an unrelated job MUST proceed without blocking
        const unblockedResult = await statusService.updateJobStatus('job_web_unblocked_1', {
          status: 'PROCESSING',
          message: 'Independent job progressed while job_web_race_1 was locked',
        });
        expect(unblockedResult?.status).toBe('PROCESSING');

        // 3. Queue a stale PROCESSING update on job_web_race_1 while COMPLETED holds the lock
        let staleSettledBeforeRelease = false;
        const staleUpdate = statusService
          .updateJobStatus('job_web_race_1', {
            status: 'PROCESSING',
            message: 'Stale processing write',
          })
          .then((res) => {
            staleSettledBeforeRelease = true;
            return res;
          });

        await new Promise((r) => setTimeout(r, 30));
        expect(staleSettledBeforeRelease).toBe(false);

        // 4. Release lock -> COMPLETED commits first, then stale PROCESSING is rejected by terminal guard
        releaseFirstRead();
        await Promise.all([completedUpdate, staleUpdate]);

        const finalRecord = await statusService.getJobForUser('job_web_race_1', 'tenant_owner');
        expect(finalRecord?.userId).toBe('tenant_owner');
        expect(finalRecord?.status).toBe('COMPLETED');
        expect(finalRecord?.processedCount).toBe(12);
        expect(finalRecord?.validRowCount).toBe(12);
        expect(finalRecord?.completedAt).toBe(completedAt);
      } finally {
        readSpy.mockRestore();
      }
    });

    it('prevents committed FAILED state from regressing and preserves error metadata', async () => {
      await statusService.createJob({
        jobId: 'job_web_failed_imm',
        storageKey: 'stage_00000000-0000-0000-0000-000000000027',
        fileName: 'broken.csv',
        fileSizeBytes: 128,
        sha256Hash: 'hash_web_failed_imm',
        userId: 'tenant_owner',
        fileType: 'GENERIC_CSV',
        status: 'QUEUED',
        queue: 'file-ingestion',
        enqueuedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await statusService.updateJobStatus('job_web_failed_imm', {
        status: 'FAILED',
        message: 'Permanent validation failure',
        error: 'MISSING_REQUIRED_COLUMN',
        failureCategory: 'PERMANENT',
      });

      await statusService.updateJobStatus('job_web_failed_imm', {
        status: 'PROCESSING',
        message: 'Stale retry overwrite',
      });

      await statusService.updateJobStatus('job_web_failed_imm', {
        status: 'COMPLETED',
        processedCount: 99,
      });

      const finalRecord = await statusService.getJobForUser('job_web_failed_imm', 'tenant_owner');
      expect(finalRecord?.status).toBe('FAILED');
      expect(finalRecord?.error).toBe('MISSING_REQUIRED_COLUMN');
      expect(finalRecord?.failureCategory).toBe('PERMANENT');
      expect(finalRecord?.processedCount).toBeUndefined();
    });

    it('preserves legitimate retry and processing transitions (QUEUED -> PROCESSING -> VALIDATING -> PROCESSING -> COMPLETED)', async () => {
      await statusService.createJob({
        jobId: 'job_web_retry_flow',
        storageKey: 'stage_00000000-0000-0000-0000-000000000028',
        fileName: 'retry.csv',
        fileSizeBytes: 256,
        sha256Hash: 'hash_web_retry_flow',
        userId: 'tenant_owner',
        fileType: 'GENERIC_CSV',
        status: 'QUEUED',
        queue: 'file-ingestion',
        enqueuedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect((await statusService.updateJobStatus('job_web_retry_flow', { status: 'PROCESSING', message: 'Attempt 1' }))?.status).toBe('PROCESSING');
      expect((await statusService.updateJobStatus('job_web_retry_flow', { status: 'VALIDATING', message: 'Validating 1' }))?.status).toBe('VALIDATING');
      expect((await statusService.updateJobStatus('job_web_retry_flow', { status: 'PROCESSING', message: 'Attempt 2' }))?.status).toBe('PROCESSING');
      // Backward regression to QUEUED should be ignored
      expect((await statusService.updateJobStatus('job_web_retry_flow', { status: 'QUEUED', message: 'Stale queue' }))?.status).toBe('PROCESSING');

      const completed = await statusService.updateJobStatus('job_web_retry_flow', {
        status: 'COMPLETED',
        processedCount: 8,
        validRowCount: 8,
      });
      expect(completed?.status).toBe('COMPLETED');
      expect(completed?.processedCount).toBe(8);
      expect(completed?.completedAt).toBeTruthy();
      expect(completed?.userId).toBe('tenant_owner');
    });
  });
});


