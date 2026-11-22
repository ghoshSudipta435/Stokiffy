/**
 * Handler for batch-rescore-companies background job.
 * Executes batch Stage A/B rescoring, immutable snapshotting, and transaction persistence.
 */

import {
  batchRescoreCompaniesPayloadSchema,
  type BatchRescoreCompaniesPayload,
  type JobExecutionResult,
  type JobExecutionContext,
  isTransientPersistenceError,
} from '../types.js';
import { logger } from '../../lib/logger.js';
import { batchRescoreService } from '../services/batch-rescore.service.js';

export async function handleBatchRescoreCompanies(
  jobId: string,
  rawPayload: unknown,
  context?: JobExecutionContext
): Promise<JobExecutionResult> {
  const startTime = performance.now();
  const jobLogger = logger.forJob(jobId, 'batch-rescore-companies');

  try {
    const parseResult = batchRescoreCompaniesPayloadSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      const durationMs = Math.round(performance.now() - startTime);
      const errorMsg = `Invalid payload: ${parseResult.error.message}`;
      jobLogger.warn(`Payload validation failed for job ${jobId}: ${errorMsg}`);
      return {
        success: false,
        jobId,
        durationMs,
        failureCategory: 'INVALID_PAYLOAD',
        retryable: false,
        error: errorMsg,
      };
    }

    const payload: BatchRescoreCompaniesPayload = parseResult.data;
    jobLogger.info('Starting batch rescoring job', {
      userId: payload.userId,
      companyIdsCount: payload.companyIds?.length ?? 'ALL',
      ruleSetVersion: payload.ruleSetVersion ?? 'ACTIVE_PUBLISHED',
      stages: payload.stages,
    });

    const result = await batchRescoreService.rescore(payload, jobLogger);
    const durationMs = Math.round(performance.now() - startTime);

    jobLogger.info(
      `Batch rescoring completed in ${durationMs}ms: ${result.succeeded} succeeded, ${result.failed} failed out of ${result.processed} company/companies`
    );

    return {
      success: true,
      jobId,
      processedCount: result.processed,
      warningsCount: result.failed,
      durationMs,
      metadata: {
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        errors: result.errors,
      },
    };
  } catch (err: unknown) {
    const durationMs = Math.round(performance.now() - startTime);
    const errorMessage = err instanceof Error ? err.message : String(err);
    const retryable = isTransientPersistenceError(err);

    jobLogger.error(
      `Batch rescore job ${jobId} failed: ${errorMessage}`,
      {
        retryable,
        retryCount: context?.retryCount,
        retryLimit: context?.retryLimit,
      },
      err instanceof Error ? err : undefined
    );

    return {
      success: false,
      jobId,
      durationMs,
      failureCategory: retryable ? 'PERSISTENCE_ERROR' : 'RETRYABLE_INFRA_ERROR',
      retryable,
      error: errorMessage,
    };
  }
}
