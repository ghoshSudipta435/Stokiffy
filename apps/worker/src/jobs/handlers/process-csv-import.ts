import { ZodError } from 'zod';
import {
  isRetriesExhausted,
  processFileIngestionPayloadSchema,
  type JobExecutionContext,
  type JobExecutionResult,
  type ProcessFileIngestionPayload,
} from '../types.js';
import { logger } from '../../lib/logger.js';
import {
  CSVIngestionService,
  defaultCSVIngestionService,
} from '../services/csv-ingestion.service.js';

/**
 * Handler for asynchronous file ingestion staging.
 * Strictly separates deterministic payload validation errors (ZodError -> INVALID_PAYLOAD)
 * from unexpected runtime/infrastructure errors (RETRYABLE_INFRA_ERROR).
 */
export async function handleProcessFileIngestion(
  jobId: string,
  rawPayload: unknown,
  context?: JobExecutionContext,
  ingestionService: CSVIngestionService = defaultCSVIngestionService
): Promise<JobExecutionResult> {
  const startTime = performance.now();
  const jobLogger = logger.forJob(jobId, 'file-ingestion');

  // 1. Validate payload schema strictly at the handler boundary
  let payload: ProcessFileIngestionPayload;
  try {
    payload = processFileIngestionPayloadSchema.parse(rawPayload);
  } catch (err: unknown) {
    const durationMs = Math.round(performance.now() - startTime);
    const errorMessage =
      err instanceof ZodError
        ? `Invalid job payload: ${err.errors.map((e) => `${e.path.join('.') || 'payload'}: ${e.message}`).join('; ')}`
        : 'Invalid job payload format';

    jobLogger.error(`Deterministic payload validation failed: ${errorMessage}`);

    // If a ticket ID can be safely extracted, record terminal FAILED state
    if (
      rawPayload &&
      typeof rawPayload === 'object' &&
      'jobTicketId' in rawPayload &&
      typeof (rawPayload as { jobTicketId?: unknown }).jobTicketId === 'string'
    ) {
      const ticketId = (rawPayload as { jobTicketId: string }).jobTicketId;
      await ingestionService.syncJobStatus(ticketId, 'FAILED', {
        failureCategory: 'INVALID_PAYLOAD',
        error: errorMessage,
      });
    }

    return {
      success: false,
      jobId,
      phase: 'PROCESSING',
      failureCategory: 'INVALID_PAYLOAD',
      retryable: false,
      durationMs,
      error: errorMessage,
    };
  }

  // 2. Execute ingestion service; unexpected thrown errors default to bounded retry
  try {
    const result = await ingestionService.processImport(payload, context);
    return {
      ...result,
      jobId, // Ensure returned jobId matches the worker job identifier
    };
  } catch (err: unknown) {
    const durationMs = Math.round(performance.now() - startTime);
    const errorMessage = err instanceof Error ? err.message : 'Unexpected ingestion runtime error';
    jobLogger.error(
      `Unexpected ingestion execution error (retryable): ${errorMessage}`,
      err instanceof Error ? err : undefined
    );

    if (isRetriesExhausted(context)) {
      await ingestionService.syncJobStatus(payload.jobTicketId, 'FAILED', {
        failureCategory: 'RETRYABLE_INFRA_ERROR',
        error: `Unexpected ingestion failure after retries exhausted: ${errorMessage}`,
      });
    } else {
      await ingestionService.syncJobStatus(payload.jobTicketId, 'PROCESSING', {
        message: `Transient execution error on attempt ${(context?.retryCount ?? 0) + 1}; scheduled for retry.`,
      });
    }

    return {
      success: false,
      jobId,
      phase: 'PROCESSING',
      failureCategory: 'RETRYABLE_INFRA_ERROR',
      retryable: true,
      durationMs,
      error: errorMessage,
    };
  }
}
