/**
 * Handler for evaluate-portfolio-alerts background job.
 * Executes automated portfolio & watchlist alert evaluation with deduplication and audit logging.
 */

import {
  evaluatePortfolioAlertsPayloadSchema,
  type EvaluatePortfolioAlertsPayload,
  type JobExecutionResult,
  type JobExecutionContext,
  isTransientPersistenceError,
} from '../types.js';
import { logger } from '../../lib/logger.js';
import { alertEvaluationService } from '../services/alert-evaluation.service.js';

export async function handleEvaluatePortfolioAlerts(
  jobId: string,
  rawPayload: unknown,
  context?: JobExecutionContext
): Promise<JobExecutionResult> {
  const startTime = performance.now();
  const jobLogger = logger.forJob(jobId, 'evaluate-portfolio-alerts');

  try {
    const parseResult = evaluatePortfolioAlertsPayloadSchema.safeParse(rawPayload ?? {});
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

    const payload: EvaluatePortfolioAlertsPayload = parseResult.data;
    jobLogger.info('Starting portfolio and watchlist alert evaluation', {
      userId: payload.userId ?? 'ALL_USERS',
      includeWatchlists: payload.includeWatchlists,
    });

    const result = await alertEvaluationService.evaluate(payload, jobLogger);
    const durationMs = Math.round(performance.now() - startTime);

    jobLogger.info(
      `Alert evaluation completed in ${durationMs}ms: evaluated ${result.totalPositionsEvaluated} position(s), created ${result.totalNewAlertsCreated} alert(s), skipped ${result.totalSkippedDuplicates} duplicate(s)`
    );

    return {
      success: true,
      jobId,
      processedCount: result.totalPositionsEvaluated,
      warningsCount: result.totalNewAlertsCreated,
      durationMs,
      metadata: {
        totalUsers: result.totalUsers,
        totalPositionsEvaluated: result.totalPositionsEvaluated,
        totalNewAlertsCreated: result.totalNewAlertsCreated,
        totalSkippedDuplicates: result.totalSkippedDuplicates,
        createdAlertIds: result.createdAlertIds,
      },
    };
  } catch (err: unknown) {
    const durationMs = Math.round(performance.now() - startTime);
    const errorMessage = err instanceof Error ? err.message : String(err);
    const retryable = isTransientPersistenceError(err);

    jobLogger.error(
      `Alert evaluation job ${jobId} failed: ${errorMessage}`,
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
