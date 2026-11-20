/**
 * Zod validation tests for ingestion job contracts.
 * Verifies ingestion contract schemas validate correctly.
 */

import { describe, it, expect } from 'vitest';
import {
  IngestionJobStatusSchema,
  IngestionFailureCategorySchema,
  RowValidationErrorSchema,
  IngestionProgressSchema,
  CreateIngestionJobInputSchema,
  IngestionJobUploadResponseSchema,
  IngestionJobResponseSchema,
  IngestionProgressUpdateSchema,
  IngestionCompletionPayloadSchema,
  IngestionFailureRetryPayloadSchema,
  IngestionClaimLeasePayloadSchema,
  IngestionLeaseRenewPayloadSchema,
} from '../src/index.js';

describe('Ingestion job contract schemas', () => {
  describe('IngestionJobStatusSchema', () => {
    it('accepts all valid status values', () => {
      const statuses = ['QUEUED', 'PROCESSING', 'VALIDATING', 'COMPLETED', 'FAILED'];
      for (const status of statuses) {
        const result = IngestionJobStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid status values', () => {
      const result = IngestionJobStatusSchema.safeParse('UNKNOWN');
      expect(result.success).toBe(false);
    });
  });

  describe('IngestionFailureCategorySchema', () => {
    it('accepts all valid failure categories', () => {
      const categories = [
        'MISSING_STAGED_FILE',
        'CSV_PARSE_ERROR',
        'ROW_VALIDATION_ERROR',
        'INVALID_PAYLOAD',
        'PERSISTENCE_ERROR',
        'RETRYABLE_INFRA_ERROR',
        'STORAGE_ERROR',
        'UNKNOWN_ERROR',
      ];
      for (const category of categories) {
        const result = IngestionFailureCategorySchema.safeParse(category);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('RowValidationErrorSchema', () => {
    it('validates a complete row validation error', () => {
      const result = RowValidationErrorSchema.safeParse({
        rowNumber: 5,
        field: 'revenue',
        value: 'invalid',
        message: 'Revenue must be a valid number',
      });
      expect(result.success).toBe(true);
    });

    it('rejects rowNumber 0', () => {
      const result = RowValidationErrorSchema.safeParse({
        rowNumber: 0,
        field: 'revenue',
        message: 'Invalid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects overly long field names', () => {
      const result = RowValidationErrorSchema.safeParse({
        rowNumber: 1,
        field: 'x'.repeat(101),
        message: 'Invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('IngestionProgressSchema', () => {
    it('validates nonnegative counters', () => {
      const result = IngestionProgressSchema.safeParse({
        processedRows: 100,
        acceptedRows: 80,
        rejectedRows: 20,
        totalRows: 200,
      });
      expect(result.success).toBe(true);
    });

    it('rejects negative counters', () => {
      const result = IngestionProgressSchema.safeParse({
        processedRows: -1,
        acceptedRows: 0,
        rejectedRows: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CreateIngestionJobInputSchema', () => {
    it('validates a complete job creation input', () => {
      const result = CreateIngestionJobInputSchema.safeParse({
        userId: 'user-1',
        storageProvider: 'local',
        storageKey: 'stage_abc123',
        originalFilename: 'data.csv',
        fileSizeBytes: 1024,
        mimeType: 'text/csv',
        sha256Hash: 'a'.repeat(64),
        retryLimit: 3,
      });
      expect(result.success).toBe(true);
    });

    it('applies default storageProvider', () => {
      const result = CreateIngestionJobInputSchema.safeParse({
        userId: 'user-1',
        storageKey: 'stage_abc123',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.storageProvider).toBe('local');
      }
    });

    it('applies default retryLimit', () => {
      const result = CreateIngestionJobInputSchema.safeParse({
        userId: 'user-1',
        storageKey: 'stage_abc123',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.retryLimit).toBe(3);
      }
    });

    it('rejects invalid SHA-256 hash', () => {
      const result = CreateIngestionJobInputSchema.safeParse({
        userId: 'user-1',
        storageKey: 'stage_abc123',
        sha256Hash: 'not-a-valid-hash',
      });
      expect(result.success).toBe(false);
    });

    it('rejects retryLimit above 10', () => {
      const result = CreateIngestionJobInputSchema.safeParse({
        userId: 'user-1',
        storageKey: 'stage_abc123',
        retryLimit: 15,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('IngestionJobUploadResponseSchema', () => {
    it('validates a complete upload response', () => {
      const result = IngestionJobUploadResponseSchema.safeParse({
        jobId: 'job-1',
        status: 'QUEUED',
        sha256Hash: 'a'.repeat(64),
        message: 'File uploaded and job created',
      });
      expect(result.success).toBe(true);
    });

    it('accepts missing sha256Hash', () => {
      const result = IngestionJobUploadResponseSchema.safeParse({
        jobId: 'job-1',
        status: 'QUEUED',
        message: 'File uploaded',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('IngestionJobResponseSchema', () => {
    it('validates a complete job response DTO', () => {
      const now = '2026-11-19T10:00:00Z';
      const result = IngestionJobResponseSchema.safeParse({
        id: 'job-1',
        userId: 'user-1',
        status: 'COMPLETED',
        storageProvider: 'local',
        originalFilename: 'data.csv',
        fileSizeBytes: 1024,
        mimeType: 'text/csv',
        sha256Hash: 'a'.repeat(64),
        attemptCount: 1,
        retryLimit: 3,
        processedRows: 100,
        acceptedRows: 80,
        rejectedRows: 20,
        totalRows: 200,
        objectDeleted: true,
        createdAt: now,
        updatedAt: now,
        startedAt: now,
        completedAt: now,
      });
      expect(result.success).toBe(true);
    });

    it('rejects negative attemptCount', () => {
      const result = IngestionJobResponseSchema.safeParse({
        id: 'job-1',
        userId: 'user-1',
        status: 'QUEUED',
        storageProvider: 'local',
        attemptCount: -1,
        retryLimit: 3,
        processedRows: 0,
        acceptedRows: 0,
        rejectedRows: 0,
        objectDeleted: false,
        createdAt: '2026-11-19T10:00:00Z',
        updatedAt: '2026-11-19T10:00:00Z',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('IngestionProgressUpdateSchema', () => {
    it('validates progress update', () => {
      const result = IngestionProgressUpdateSchema.safeParse({
        jobId: 'job-1',
        processedRows: 50,
        acceptedRows: 40,
        rejectedRows: 10,
      });
      expect(result.success).toBe(true);
    });

    it('allows partial progress updates', () => {
      const result = IngestionProgressUpdateSchema.safeParse({
        jobId: 'job-1',
        processedRows: 10,
      });
      expect(result.success).toBe(true);
    });

    it('rejects negative processedRows', () => {
      const result = IngestionProgressUpdateSchema.safeParse({
        jobId: 'job-1',
        processedRows: -5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('IngestionCompletionPayloadSchema', () => {
    it('validates a completion payload', () => {
      const result = IngestionCompletionPayloadSchema.safeParse({
        jobId: 'job-1',
        processedRows: 100,
        acceptedRows: 80,
        rejectedRows: 20,
        totalRows: 200,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('IngestionFailureRetryPayloadSchema', () => {
    it('validates a failure retry payload', () => {
      const result = IngestionFailureRetryPayloadSchema.safeParse({
        jobId: 'job-1',
        failureCategory: 'PERSISTENCE_ERROR',
        errorSummary: 'Database connection timeout',
        nextRetryAt: '2026-11-19T10:05:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('rejects overly long error summary', () => {
      const result = IngestionFailureRetryPayloadSchema.safeParse({
        jobId: 'job-1',
        failureCategory: 'UNKNOWN_ERROR',
        errorSummary: 'x'.repeat(1001),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('IngestionClaimLeasePayloadSchema', () => {
    it('validates a claim lease payload', () => {
      const result = IngestionClaimLeasePayloadSchema.safeParse({
        jobId: 'job-1',
        leaseOwner: 'worker-1',
        leaseToken: 'token-abc123',
        leaseExpiresAt: '2026-11-19T10:05:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('rejects overly long lease owner', () => {
      const result = IngestionClaimLeasePayloadSchema.safeParse({
        jobId: 'job-1',
        leaseOwner: 'x'.repeat(101),
        leaseToken: 'token',
        leaseExpiresAt: '2026-11-19T10:05:00Z',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('IngestionLeaseRenewPayloadSchema', () => {
    it('validates a lease renew payload', () => {
      const result = IngestionLeaseRenewPayloadSchema.safeParse({
        jobId: 'job-1',
        leaseToken: 'token-abc123',
        leaseExpiresAt: '2026-11-19T10:05:00Z',
      });
      expect(result.success).toBe(true);
    });
  });
});
