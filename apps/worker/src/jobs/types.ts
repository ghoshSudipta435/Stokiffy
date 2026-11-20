import { z } from 'zod';

export const QUEUES = {
  FILE_INGESTION: 'file-ingestion',
  SYSTEM_MAINTENANCE: 'system-maintenance',
  NIGHTLY_AUDIT: 'nightly-audit',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export type IngestionPhase = 'QUEUED' | 'PROCESSING' | 'VALIDATING' | 'COMPLETED';

export type IngestionFailureCategory =
  | 'INVALID_PAYLOAD'
  | 'MISSING_STAGED_FILE'
  | 'CSV_PARSE_ERROR'
  | 'ROW_VALIDATION_ERROR'
  | 'PERSISTENCE_ERROR'
  | 'RETRYABLE_INFRA_ERROR';

export const NON_RETRYABLE_FAILURE_CATEGORIES: ReadonlySet<IngestionFailureCategory> = new Set([
  'INVALID_PAYLOAD',
  'MISSING_STAGED_FILE',
  'CSV_PARSE_ERROR',
  'ROW_VALIDATION_ERROR',
]);

export const RETRYABLE_FAILURE_CATEGORIES: ReadonlySet<IngestionFailureCategory> = new Set([
  'PERSISTENCE_ERROR',
  'RETRYABLE_INFRA_ERROR',
]);

export interface RowValidationError {
  rowNumber: number;
  column: string;
  value?: string;
  message: string;
}

export interface JobExecutionContext {
  retryCount?: number;
  retryLimit?: number;
}

// 1. Generic File Ingestion Payload Schema (Provider-neutral staging)
export const processFileIngestionPayloadSchema = z.object({
  jobTicketId: z.string(),
  storageKey: z.string().optional(),
  fileType: z.string().default('GENERIC_CSV'),
  fileName: z.string(),
  fileSizeBytes: z.number().int().positive(),
  sha256Hash: z.string().optional(),
  userId: z.string().optional(),
  uploadedAt: z.string().optional(),
  sourceUri: z.string().optional(),
  uploadedBy: z.string().default('owner_user_01'),
});

export type ProcessFileIngestionPayload = z.infer<typeof processFileIngestionPayloadSchema>;

// 2. Technical System Maintenance Payload Schema (No financial alerts or stop losses)
export const systemMaintenancePayloadSchema = z.object({
  taskName: z.string(),
  runTimestamp: z.string(),
  checkQueueHealth: z.boolean().default(true),
});

export type SystemMaintenancePayload = z.infer<typeof systemMaintenancePayloadSchema>;

// 3. Technical Data Quality Audit Payload Schema (Snapshot integrity verification)
export const technicalDataQualityAuditPayloadSchema = z.object({
  date: z.string(),
  verifySnapshotIntegrity: z.boolean().default(true),
  checkStaleSnapshots: z.boolean().default(true),
});

export type TechnicalDataQualityAuditPayload = z.infer<typeof technicalDataQualityAuditPayloadSchema>;

export interface JobExecutionResult {
  success: boolean;
  jobId: string;
  phase?: IngestionPhase;
  failureCategory?: IngestionFailureCategory;
  /** Explicit retryability signal; takes precedence over category defaults when set. */
  retryable?: boolean;
  processedCount?: number;
  validRowCount?: number;
  warningsCount?: number;
  durationMs: number;
  error?: string;
  errorsSummary?: RowValidationError[];
  metadata?: Record<string, unknown>;
}

/**
 * Centralized failure retryability classifier (single source of truth).
 * - Explicit `result.retryable` takes precedence.
 * - Known deterministic categories return `false`.
 * - Known retryable categories and unclassified/unknown failures default to `true` (bounded retry).
 */
export function isRetryableJobResult(result: JobExecutionResult): boolean {
  if (result.success) {
    return false;
  }
  if (typeof result.retryable === 'boolean') {
    return result.retryable;
  }
  if (result.failureCategory && NON_RETRYABLE_FAILURE_CATEGORIES.has(result.failureCategory)) {
    return false;
  }
  return true;
}

/**
 * Returns true if pg-boss retry attempts are exhausted (or no retry metadata is present).
 * Verified against pg-boss@10.4.2 plans.js: retry_count starts at 0 on Attempt 1 and
 * transitions to failed when retry_count >= retry_limit.
 */
export function isRetriesExhausted(context?: JobExecutionContext): boolean {
  if (context?.retryCount === undefined || context?.retryLimit === undefined) {
    return true;
  }
  return context.retryCount >= context.retryLimit;
}

const TRANSIENT_FS_CODES = new Set([
  'EAGAIN',
  'EBUSY',
  'EMFILE',
  'ENFILE',
  'EIO',
  'ETIMEDOUT',
  'ECONNRESET',
  'EPIPE',
]);

const DETERMINISTIC_STORAGE_PREFIXES = [
  'FILE_NOT_FOUND',
  'INVALID_STORAGE_KEY',
  'INVALID_USER_ID',
  'ACCESS_DENIED',
  'SECURITY_VIOLATION',
];

export function isTransientFilesystemError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return typeof code === 'string' && TRANSIENT_FS_CODES.has(code);
}

export function isDeterministicStorageError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  if (code === 'ENOENT') {
    return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  return DETERMINISTIC_STORAGE_PREFIXES.some((prefix) => message.startsWith(prefix));
}

const TRANSIENT_DB_CODES = new Set([
  // PostgreSQL SQLSTATE transient codes
  '40001', // serialization_failure
  '40P01', // deadlock_detected
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
  '53300', // too_many_connections
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  // Prisma transient client/engine error codes
  'P1001', // Can't reach database server
  'P1002', // Database server timed out
  'P1008', // Operations timed out
  'P1017', // Server closed the connection
  'P2024', // Timed out fetching connection from pool
  'P2034', // Transaction failed due to write conflict or deadlock
  // Network/socket transient codes
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
]);

export function isTransientPersistenceError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  if (typeof code === 'string' && TRANSIENT_DB_CODES.has(code)) {
    return true;
  }
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    message.includes('serialization') ||
    message.includes('deadlock') ||
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('pool')
  );
}
