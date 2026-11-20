/**
 * Shared ingestion-job API contracts.
 * Mirrors API_ARCHITECTURE.md Section 4.6.
 *
 * Independent of Prisma model types. No raw storage credentials,
 * internal filesystem paths, stack traces, or sensitive internal details.
 */

import { z } from 'zod';
import { UserIdSchema } from '../models/index.js';

/**
 * Ingestion job status lifecycle values.
 * QUEUED -> PROCESSING -> VALIDATING -> COMPLETED (terminal)
 * QUEUED/PROCESSING/VALIDATING -> FAILED (terminal)
 * Failed jobs allow re-upload; completed jobs are reusable for dedup.
 */
export const IngestionJobStatusSchema = z.enum([
  'QUEUED',
  'PROCESSING',
  'VALIDATING',
  'COMPLETED',
  'FAILED',
]);
export type IngestionJobStatus = z.infer<typeof IngestionJobStatusSchema>;

/**
 * Failure category values for ingestion jobs.
 */
export const IngestionFailureCategorySchema = z.enum([
  'MISSING_STAGED_FILE',
  'CSV_PARSE_ERROR',
  'ROW_VALIDATION_ERROR',
  'INVALID_PAYLOAD',
  'PERSISTENCE_ERROR',
  'RETRYABLE_INFRA_ERROR',
  'STORAGE_ERROR',
  'UNKNOWN_ERROR',
]);
export type IngestionFailureCategory = z.infer<typeof IngestionFailureCategorySchema>;

/**
 * Row-level validation error for CSV ingestion.
 * Bounded to prevent unbounded error data exposure.
 */
export const RowValidationErrorSchema = z.object({
  rowNumber: z.number().int().positive('Row number must be positive'),
  field: z.string().min(1).max(100, 'Field name must be 1-100 characters'),
  value: z.unknown().optional(),
  message: z.string().min(1).max(500, 'Error message must be 1-500 characters'),
});
export type RowValidationError = z.infer<typeof RowValidationErrorSchema>;

/**
 * Progress counters for ingestion jobs.
 * All counters are nonnegative integers.
 */
export const IngestionProgressSchema = z.object({
  processedRows: z.number().int().nonnegative('Processed rows must be non-negative'),
  acceptedRows: z.number().int().nonnegative('Accepted rows must be non-negative'),
  rejectedRows: z.number().int().nonnegative('Rejected rows must be non-negative'),
  totalRows: z.number().int().nonnegative('Total rows must be non-negative').optional(),
});
export type IngestionProgress = z.infer<typeof IngestionProgressSchema>;

/**
 * Job creation input for ingestion.
 */
export const CreateIngestionJobInputSchema = z.object({
  userId: UserIdSchema,
  storageProvider: z.enum(['local', 's3', 'gcs']).default('local'),
  storageKey: z.string().min(1).max(500, 'Storage key must be 1-500 characters'),
  originalFilename: z.string().min(1).max(255, 'Filename must be 1-255 characters').optional(),
  fileSizeBytes: z.number().int().nonnegative('File size must be non-negative').optional(),
  mimeType: z.string().max(100, 'MIME type must be max 100 characters').optional(),
  sha256Hash: z
    .string()
    .length(64, 'SHA-256 hash must be 64 hex characters')
    .regex(/^[0-9a-fA-F]{64}$/, 'SHA-256 hash must be valid hex')
    .optional(),
  retryLimit: z.number().int().min(1).max(10, 'Retry limit must be 1-10').default(3),
});
export type CreateIngestionJobInput = z.infer<typeof CreateIngestionJobInputSchema>;

/**
 * Upload response — returned after a CSV upload is accepted.
 * Does not expose internal filesystem paths or storage credentials.
 */
export const IngestionJobUploadResponseSchema = z.object({
  jobId: z.string().min(1),
  status: IngestionJobStatusSchema,
  sha256Hash: z.string().optional(),
  message: z.string(),
});
export type IngestionJobUploadResponse = z.infer<typeof IngestionJobUploadResponseSchema>;

/**
 * Job response DTO — safe for API consumption.
 * Bounded strings, no sensitive internals.
 */
export const IngestionJobResponseSchema = z.object({
  id: z.string().min(1),
  userId: UserIdSchema,
  status: IngestionJobStatusSchema,
  failureCategory: IngestionFailureCategorySchema.optional(),
  storageProvider: z.string(),
  originalFilename: z.string().optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  mimeType: z.string().optional(),
  sha256Hash: z.string().optional(),
  attemptCount: z.number().int().nonnegative(),
  retryLimit: z.number().int().nonnegative(),
  nextRetryAt: z.string().datetime().optional(),
  processedRows: z.number().int().nonnegative(),
  acceptedRows: z.number().int().nonnegative(),
  rejectedRows: z.number().int().nonnegative(),
  totalRows: z.number().int().nonnegative().optional(),
  errorSummary: z.string().max(1000, 'Error summary must be max 1000 characters').optional(),
  objectDeleted: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  failedAt: z.string().datetime().optional(),
});
export type IngestionJobResponse = z.infer<typeof IngestionJobResponseSchema>;

/**
 * Progress update payload for ingestion jobs.
 */
export const IngestionProgressUpdateSchema = z.object({
  jobId: z.string().min(1),
  processedRows: z.number().int().nonnegative().optional(),
  acceptedRows: z.number().int().nonnegative().optional(),
  rejectedRows: z.number().int().nonnegative().optional(),
  totalRows: z.number().int().nonnegative().optional(),
});
export type IngestionProgressUpdate = z.infer<typeof IngestionProgressUpdateSchema>;

/**
 * Completion payload for ingestion jobs.
 */
export const IngestionCompletionPayloadSchema = z.object({
  jobId: z.string().min(1),
  processedRows: z.number().int().nonnegative().optional(),
  acceptedRows: z.number().int().nonnegative().optional(),
  rejectedRows: z.number().int().nonnegative().optional(),
  totalRows: z.number().int().nonnegative().optional(),
});
export type IngestionCompletionPayload = z.infer<typeof IngestionCompletionPayloadSchema>;

/**
 * Failure / retry payload for ingestion jobs.
 */
export const IngestionFailureRetryPayloadSchema = z.object({
  jobId: z.string().min(1),
  failureCategory: IngestionFailureCategorySchema,
  errorSummary: z.string().max(1000, 'Error summary must be max 1000 characters').optional(),
  nextRetryAt: z.string().datetime().optional(),
});
export type IngestionFailureRetryPayload = z.infer<typeof IngestionFailureRetryPayloadSchema>;

/**
 * Claim / lease payload for claiming an ingestion job.
 */
export const IngestionClaimLeasePayloadSchema = z.object({
  jobId: z.string().min(1),
  leaseOwner: z.string().min(1).max(100, 'Lease owner must be 1-100 characters'),
  leaseToken: z.string().min(1).max(255, 'Lease token must be 1-255 characters'),
  leaseExpiresAt: z.string().datetime(),
});
export type IngestionClaimLeasePayload = z.infer<typeof IngestionClaimLeasePayloadSchema>;

/**
 * Lease renewal payload.
 */
export const IngestionLeaseRenewPayloadSchema = z.object({
  jobId: z.string().min(1),
  leaseToken: z.string().min(1).max(255, 'Lease token must be 1-255 characters'),
  leaseExpiresAt: z.string().datetime(),
});
export type IngestionLeaseRenewPayload = z.infer<typeof IngestionLeaseRenewPayloadSchema>;

/**
 * All ingestion job schemas exported together.
 */
export const ingestionJobSchemas = {
  IngestionJobStatus: IngestionJobStatusSchema,
  IngestionFailureCategory: IngestionFailureCategorySchema,
  RowValidationError: RowValidationErrorSchema,
  IngestionProgress: IngestionProgressSchema,
  CreateIngestionJobInput: CreateIngestionJobInputSchema,
  IngestionJobUploadResponse: IngestionJobUploadResponseSchema,
  IngestionJobResponse: IngestionJobResponseSchema,
  IngestionProgressUpdate: IngestionProgressUpdateSchema,
  IngestionCompletionPayload: IngestionCompletionPayloadSchema,
  IngestionFailureRetryPayload: IngestionFailureRetryPayloadSchema,
  IngestionClaimLeasePayload: IngestionClaimLeasePayloadSchema,
  IngestionLeaseRenewPayload: IngestionLeaseRenewPayloadSchema,
} as const;
