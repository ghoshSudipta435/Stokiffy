import { describe, it, expect, vi } from 'vitest';
import {
  processFileIngestionPayloadSchema,
  systemMaintenancePayloadSchema,
  technicalDataQualityAuditPayloadSchema,
  isRetryableJobResult,
  isRetriesExhausted,
  QUEUES,
  type JobExecutionResult,
} from './jobs/types.js';
import { JOB_REGISTRY, type JobDefinition } from './jobs/registry.js';
import { QueueManager } from './queue.js';
import { handleProcessFileIngestion } from './jobs/handlers/process-csv-import.js';
import { handleSystemMaintenance } from './jobs/handlers/system-maintenance.js';
import { handleTechnicalDataQualityAudit } from './jobs/handlers/daily-data-quality-audit.js';

describe('Worker Jobs & Policy-Neutral Schema Validation', () => {
  it('validates generic file ingestion payload correctly', () => {
    const valid = {
      jobTicketId: 'ticket_123',
      fileType: 'GENERIC_CSV',
      fileName: 'financial_data.csv',
      fileSizeBytes: 1024,
      uploadedBy: 'owner_user_01',
    };
    const parsed = processFileIngestionPayloadSchema.parse(valid);
    expect(parsed.fileName).toBe('financial_data.csv');
    expect(parsed.fileType).toBe('GENERIC_CSV');

    const invalid = {
      jobTicketId: 'ticket_123',
      fileSizeBytes: -1, // invalid negative size
    };
    expect(() => processFileIngestionPayloadSchema.parse(invalid)).toThrow();
  });

  it('validates technical system maintenance payload without financial stop losses', () => {
    const valid = {
      taskName: 'daily-queue-health-check',
      runTimestamp: '2026-11-16T12:00:00.000Z',
      checkQueueHealth: true,
    };
    const parsed = systemMaintenancePayloadSchema.parse(valid);
    expect(parsed.taskName).toBe('daily-queue-health-check');
    expect(parsed.checkQueueHealth).toBe(true);
  });

  it('validates technical snapshot integrity audit payload', () => {
    const valid = {
      date: '2026-11-16',
      verifySnapshotIntegrity: true,
      checkStaleSnapshots: true,
    };
    const parsed = technicalDataQualityAuditPayloadSchema.parse(valid);
    expect(parsed.date).toBe('2026-11-16');
    expect(parsed.verifySnapshotIntegrity).toBe(true);
  });

  it('ensures all registered queues have valid definitions and handlers', () => {
    const queueKeys = Object.values(QUEUES);
    for (const q of queueKeys) {
      const def = JOB_REGISTRY[q];
      expect(def).toBeDefined();
      expect(def.concurrency).toBeGreaterThan(0);
      expect(def.retryLimit).toBeGreaterThan(0);
      expect(typeof def.handler).toBe('function');
    }
  });

  it('executes handleProcessFileIngestion with valid payload and returns success', async () => {
    const validPayload = {
      jobTicketId: 't_01',
      fileType: 'GENERIC_CSV',
      fileName: 'staged_data.csv',
      fileSizeBytes: 2048,
    };
    const result = await handleProcessFileIngestion('job_mock_1', validPayload);
    expect(result.success).toBe(true);
    expect(result.jobId).toBe('job_mock_1');
    expect(result.processedCount).toBe(1);
  });

  it('executes handleSystemMaintenance with valid payload and returns success', async () => {
    const validPayload = {
      taskName: 'health-check',
      runTimestamp: new Date().toISOString(),
    };
    const result = await handleSystemMaintenance('job_mock_2', validPayload);
    expect(result.success).toBe(true);
    expect(result.jobId).toBe('job_mock_2');
    expect(result.processedCount).toBe(1);
  });

  it('executes handleTechnicalDataQualityAudit with valid payload and returns success', async () => {
    const validPayload = {
      date: '2026-11-16',
    };
    const result = await handleTechnicalDataQualityAudit('job_mock_3', validPayload);
    expect(result.success).toBe(true);
    expect(result.jobId).toBe('job_mock_3');
    expect(result.processedCount).toBe(1);
  });
});

describe('ISS-03 Queue Retry Classification & pg-boss Integration', () => {
  const createMockBoss = () => ({
    start: vi.fn(async () => ({})),
    stop: vi.fn(async () => undefined),
    send: vi.fn(async () => 'pg_job_1'),
    work: vi.fn(async () => 'worker_1'),
    cancel: vi.fn(async () => undefined),
    complete: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
    schedule: vi.fn(async () => undefined),
    on: vi.fn(),
  });

  describe('isRetryableJobResult (Centralized Classifier)', () => {
    it('classifies deterministic categories as non-retryable', () => {
      const permanentCategories = [
        'INVALID_PAYLOAD',
        'MISSING_STAGED_FILE',
        'CSV_PARSE_ERROR',
        'ROW_VALIDATION_ERROR',
      ] as const;

      for (const failureCategory of permanentCategories) {
        const result: JobExecutionResult = {
          success: false,
          jobId: 'j_1',
          failureCategory,
          durationMs: 1,
          error: 'Deterministic failure',
        };
        expect(isRetryableJobResult(result)).toBe(false);
      }
    });

    it('classifies retryable and unknown categories as retryable by default', () => {
      expect(
        isRetryableJobResult({
          success: false,
          jobId: 'j_1',
          failureCategory: 'PERSISTENCE_ERROR',
          durationMs: 1,
        })
      ).toBe(true);

      expect(
        isRetryableJobResult({
          success: false,
          jobId: 'j_2',
          failureCategory: 'RETRYABLE_INFRA_ERROR',
          durationMs: 1,
        })
      ).toBe(true);

      // Unknown / unclassified failure defaults to bounded retry
      expect(
        isRetryableJobResult({
          success: false,
          jobId: 'j_3',
          durationMs: 1,
          error: 'Unexpected failure without category',
        })
      ).toBe(true);
    });

    it('gives explicit result.retryable precedence over category defaults', () => {
      expect(
        isRetryableJobResult({
          success: false,
          jobId: 'j_1',
          failureCategory: 'PERSISTENCE_ERROR',
          retryable: false,
          durationMs: 1,
        })
      ).toBe(false);

      expect(
        isRetryableJobResult({
          success: false,
          jobId: 'j_2',
          failureCategory: 'MISSING_STAGED_FILE',
          retryable: true,
          durationMs: 1,
        })
      ).toBe(true);
    });

    it('evaluates retry exhaustion accurately against pg-boss retryCount/retryLimit', () => {
      expect(isRetriesExhausted({ retryCount: 0, retryLimit: 3 })).toBe(false);
      expect(isRetriesExhausted({ retryCount: 2, retryLimit: 3 })).toBe(false);
      expect(isRetriesExhausted({ retryCount: 3, retryLimit: 3 })).toBe(true);
      expect(isRetriesExhausted(undefined)).toBe(true);
    });
  });

  describe('QueueManager.processJob', () => {
    it('cancels invalid queue payload in pg-boss without retrying or falsely completing', async () => {
      const mockBoss = createMockBoss();
      const qm = new QueueManager(mockBoss as any);

      const def: JobDefinition = {
        ...JOB_REGISTRY[QUEUES.FILE_INGESTION],
        handler: handleProcessFileIngestion,
      };

      const result = await qm.processJob(QUEUES.FILE_INGESTION, def, {
        id: 'pg_invalid_1',
        name: QUEUES.FILE_INGESTION,
        data: { fileSizeBytes: -10 }, // invalid payload
        retryCount: 0,
        retryLimit: 3,
      });

      expect(result.success).toBe(false);
      expect(result.failureCategory).toBe('INVALID_PAYLOAD');
      expect(result.retryable).toBe(false);
      expect(mockBoss.cancel).toHaveBeenCalledTimes(1);
      expect(mockBoss.cancel).toHaveBeenCalledWith(QUEUES.FILE_INGESTION, 'pg_invalid_1');
    });

    it('cancels permanent CSV_PARSE_ERROR, ROW_VALIDATION_ERROR, and MISSING_STAGED_FILE without retrying', async () => {
      const categories = ['CSV_PARSE_ERROR', 'ROW_VALIDATION_ERROR', 'MISSING_STAGED_FILE'] as const;

      for (const category of categories) {
        const mockBoss = createMockBoss();
        const qm = new QueueManager(mockBoss as any);

        const def: JobDefinition = {
          queueName: QUEUES.FILE_INGESTION,
          concurrency: 1,
          retryLimit: 3,
          retryDelaySeconds: 10,
          retryBackoff: true,
          handler: vi.fn(async (jobId) => ({
            success: false,
            jobId,
            failureCategory: category,
            retryable: false,
            durationMs: 2,
            error: `Permanent ${category}`,
          })),
        };

        const result = await qm.processJob(QUEUES.FILE_INGESTION, def, {
          id: `pg_${category}`,
          name: QUEUES.FILE_INGESTION,
          data: {},
          retryCount: 0,
          retryLimit: 3,
        });

        expect(result.success).toBe(false);
        expect(mockBoss.cancel).toHaveBeenCalledWith(QUEUES.FILE_INGESTION, `pg_${category}`);
      }
    });

    it('never marks a permanent failure completed if boss.cancel() fails', async () => {
      const mockBoss = createMockBoss();
      mockBoss.cancel.mockRejectedValue(new Error('pg-boss cancel DB error'));
      const qm = new QueueManager(mockBoss as any);

      const def: JobDefinition = {
        queueName: QUEUES.FILE_INGESTION,
        concurrency: 1,
        retryLimit: 3,
        retryDelaySeconds: 10,
        retryBackoff: true,
        handler: vi.fn(async (jobId) => ({
          success: false,
          jobId,
          failureCategory: 'ROW_VALIDATION_ERROR',
          retryable: false,
          durationMs: 1,
          error: 'Bad rows',
        })),
      };

      await expect(
        qm.processJob(QUEUES.FILE_INGESTION, def, {
          id: 'pg_cancel_fail',
          name: QUEUES.FILE_INGESTION,
          data: {},
          retryCount: 0,
          retryLimit: 3,
        })
      ).rejects.toThrow(/pg-boss cancel DB error/);
    });

    it('throws on retryable PERSISTENCE_ERROR and RETRYABLE_INFRA_ERROR so pg-boss retries with backoff', async () => {
      for (const category of ['PERSISTENCE_ERROR', 'RETRYABLE_INFRA_ERROR'] as const) {
        const mockBoss = createMockBoss();
        const qm = new QueueManager(mockBoss as any);

        const def: JobDefinition = {
          queueName: QUEUES.FILE_INGESTION,
          concurrency: 1,
          retryLimit: 3,
          retryDelaySeconds: 10,
          retryBackoff: true,
          handler: vi.fn(async (jobId) => ({
            success: false,
            jobId,
            failureCategory: category,
            retryable: true,
            durationMs: 5,
            error: `Transient ${category}`,
          })),
        };

        await expect(
          qm.processJob(QUEUES.FILE_INGESTION, def, {
            id: `pg_${category}`,
            name: QUEUES.FILE_INGESTION,
            data: {},
            retryCount: 0,
            retryLimit: 3,
          })
        ).rejects.toThrow(`Transient ${category}`);

        expect(mockBoss.cancel).not.toHaveBeenCalled();
      }
    });

    it('throws on unknown/unclassified failure results (bounded retry default)', async () => {
      const mockBoss = createMockBoss();
      const qm = new QueueManager(mockBoss as any);

      const def: JobDefinition = {
        queueName: QUEUES.FILE_INGESTION,
        concurrency: 1,
        retryLimit: 3,
        retryDelaySeconds: 10,
        retryBackoff: true,
        handler: vi.fn(async (jobId) => ({
          success: false,
          jobId,
          durationMs: 3,
          error: 'Unknown error without category',
        })),
      };

      await expect(
        qm.processJob(QUEUES.FILE_INGESTION, def, {
          id: 'pg_unknown',
          name: QUEUES.FILE_INGESTION,
          data: {},
          retryCount: 0,
          retryLimit: 3,
        })
      ).rejects.toThrow(/Unknown error without category/);

      expect(mockBoss.cancel).not.toHaveBeenCalled();
    });

    it('registers workers using pg-boss v10 options (batchSize=1, includeMetadata=true)', async () => {
      const mockBoss = createMockBoss();
      const qm = new QueueManager(mockBoss as any);
      await qm.start();

      // Total workers = sum of concurrencies in JOB_REGISTRY
      const expectedWorkers = Object.values(JOB_REGISTRY).reduce((sum, def) => sum + def.concurrency, 0);
      expect(mockBoss.work).toHaveBeenCalledTimes(expectedWorkers);
      const firstCallOptions = mockBoss.work.mock.calls[0]?.[1];
      expect(firstCallOptions).toMatchObject({
        batchSize: 1,
        includeMetadata: true,
      });
      expect(firstCallOptions).not.toHaveProperty('teamSize');
      expect(firstCallOptions).not.toHaveProperty('teamConcurrency');
    });
  });

  describe('Cycle 2B-R2: OBS-LOG-01 Single Failure Log & OBS-TEST-01 Direct Handler Exceptions', () => {
    it('OBS-LOG-01: emits exactly one structured error log for a retryable failure attempt', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        const mockBoss = createMockBoss();
        const qm = new QueueManager(mockBoss as any);

        const def: JobDefinition = {
          queueName: QUEUES.FILE_INGESTION,
          concurrency: 1,
          retryLimit: 3,
          retryDelaySeconds: 10,
          retryBackoff: true,
          handler: vi.fn(async (jobId) => ({
            success: false,
            jobId,
            failureCategory: 'PERSISTENCE_ERROR',
            retryable: true,
            durationMs: 4,
            error: 'Connection pool timeout',
          })),
        };

        await expect(
          qm.processJob(QUEUES.FILE_INGESTION, def, {
            id: 'pg_single_log_1',
            name: QUEUES.FILE_INGESTION,
            data: { secretToken: 'must-not-be-logged' },
            retryCount: 1,
            retryLimit: 3,
          })
        ).rejects.toThrow(/Connection pool timeout/);

        expect(errorSpy).toHaveBeenCalledTimes(1);
        const logged = JSON.parse(String(errorSpy.mock.calls[0]?.[0]));
        expect(logged.level).toBe('error');
        expect(logged.jobId).toBe('pg_single_log_1');
        expect(logged.jobName).toBe(QUEUES.FILE_INGESTION);
        expect(logged.metadata).toEqual({
          failureCategory: 'PERSISTENCE_ERROR',
          retryable: true,
          retryCount: 1,
          retryLimit: 3,
          exhausted: false,
        });
        expect(logged.error).toBe('Connection pool timeout');
        expect(typeof logged.stack).toBe('string');
        expect(JSON.stringify(logged)).not.toContain('must-not-be-logged');
        expect(mockBoss.cancel).not.toHaveBeenCalled();
      } finally {
        errorSpy.mockRestore();
      }
    });

    it('OBS-TEST-01: propagates direct unhandled handler exception for bounded retry with single structured log', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        const mockBoss = createMockBoss();
        const qm = new QueueManager(mockBoss as any);
        const originalError = new TypeError('Unexpected null dereference in handler');

        const def: JobDefinition = {
          queueName: QUEUES.FILE_INGESTION,
          concurrency: 1,
          retryLimit: 3,
          retryDelaySeconds: 10,
          retryBackoff: true,
          handler: vi.fn(async () => {
            throw originalError;
          }),
        };

        let caught: unknown;
        try {
          await qm.processJob(QUEUES.FILE_INGESTION, def, {
            id: 'pg_unhandled_1',
            name: QUEUES.FILE_INGESTION,
            data: { jobTicketId: 'ticket_unhandled' },
            retryCount: 0,
            retryLimit: 3,
          });
        } catch (err) {
          caught = err;
        }

        // Original error identity and context preserved; never falsely resolves as completed
        expect(caught).toBe(originalError);
        expect(mockBoss.cancel).not.toHaveBeenCalled();
        expect(mockBoss.complete).not.toHaveBeenCalled();

        // Single authoritative error log
        expect(errorSpy).toHaveBeenCalledTimes(1);
        const logged = JSON.parse(String(errorSpy.mock.calls[0]?.[0]));
        expect(logged.jobId).toBe('pg_unhandled_1');
        expect(logged.jobName).toBe(QUEUES.FILE_INGESTION);
        expect(logged.error).toBe('Unexpected null dereference in handler');
        expect(logged.stack).toContain('TypeError');
        expect(logged.metadata).toEqual({
          failureCategory: 'UNHANDLED_EXCEPTION',
          retryable: true,
          retryCount: 0,
          retryLimit: 3,
          exhausted: false,
        });
      } finally {
        errorSpy.mockRestore();
      }
    });

    it('OBS-TEST-01: logs exhausted=true once when unhandled handler exception hits retryLimit', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        const mockBoss = createMockBoss();
        const qm = new QueueManager(mockBoss as any);
        const boom = new Error('Persistent runtime crash');

        const def: JobDefinition = {
          queueName: QUEUES.FILE_INGESTION,
          concurrency: 1,
          retryLimit: 3,
          retryDelaySeconds: 10,
          retryBackoff: true,
          handler: vi.fn(async () => {
            throw boom;
          }),
        };

        await expect(
          qm.processJob(QUEUES.FILE_INGESTION, def, {
            id: 'pg_unhandled_exhausted',
            name: QUEUES.FILE_INGESTION,
            data: {},
            retryCount: 3,
            retryLimit: 3,
          })
        ).rejects.toBe(boom);

        expect(errorSpy).toHaveBeenCalledTimes(1);
        const logged = JSON.parse(String(errorSpy.mock.calls[0]?.[0]));
        expect(logged.metadata.exhausted).toBe(true);
        expect(logged.metadata.retryCount).toBe(3);
        expect(logged.metadata.retryLimit).toBe(3);
        expect(mockBoss.cancel).not.toHaveBeenCalled();
      } finally {
        errorSpy.mockRestore();
      }
    });

    it('OBS-LOG-01 regression: emits zero error logs on successful permanent cancel, and single error log if cancel throws', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        // Case 1: Successful cancellation of deterministic failure -> 1 warn, 0 error
        const okBoss = createMockBoss();
        const okQm = new QueueManager(okBoss as any);
        const permDef: JobDefinition = {
          queueName: QUEUES.FILE_INGESTION,
          concurrency: 1,
          retryLimit: 3,
          retryDelaySeconds: 10,
          retryBackoff: true,
          handler: vi.fn(async (jobId) => ({
            success: false,
            jobId,
            failureCategory: 'ROW_VALIDATION_ERROR',
            retryable: false,
            durationMs: 2,
            error: 'All rows invalid',
          })),
        };

        const res = await okQm.processJob(QUEUES.FILE_INGESTION, permDef, {
          id: 'pg_perm_ok',
          name: QUEUES.FILE_INGESTION,
          data: {},
          retryCount: 0,
          retryLimit: 3,
        });
        expect(res.success).toBe(false);
        expect(okBoss.cancel).toHaveBeenCalledWith(QUEUES.FILE_INGESTION, 'pg_perm_ok');
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledTimes(0);

        // Case 2: Cancel throws -> 1 error log and exception propagates safely
        const failBoss = createMockBoss();
        failBoss.cancel.mockRejectedValue(new Error('cancel transport error'));
        const failQm = new QueueManager(failBoss as any);

        await expect(
          failQm.processJob(QUEUES.FILE_INGESTION, permDef, {
            id: 'pg_perm_cancel_err',
            name: QUEUES.FILE_INGESTION,
            data: {},
            retryCount: 0,
            retryLimit: 3,
          })
        ).rejects.toThrow(/cancel transport error/);
        expect(errorSpy).toHaveBeenCalledTimes(1);
      } finally {
        errorSpy.mockRestore();
        warnSpy.mockRestore();
      }
    });
  });
});

