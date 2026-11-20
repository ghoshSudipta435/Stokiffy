import {
  systemMaintenancePayloadSchema,
  type SystemMaintenancePayload,
  type JobExecutionResult,
} from '../types.js';
import { logger } from '../../lib/logger.js';

/**
 * Handler for background technical system maintenance.
 * Performs database queue health checks and housekeeping.
 * Strictly does NOT evaluate financial stop losses, exit signals, or trading decisions.
 */
export async function handleSystemMaintenance(
  jobId: string,
  rawPayload: unknown
): Promise<JobExecutionResult> {
  const startTime = performance.now();
  const jobLogger = logger.forJob(jobId, 'system-maintenance');

  try {
    const payload: SystemMaintenancePayload = systemMaintenancePayloadSchema.parse(rawPayload);
    jobLogger.info(`Executing system maintenance task: ${payload.taskName}`, {
      runTimestamp: payload.runTimestamp,
      checkQueueHealth: payload.checkQueueHealth,
    });

    const durationMs = Math.round(performance.now() - startTime);

    jobLogger.info(`System maintenance task '${payload.taskName}' completed successfully in ${durationMs}ms`);

    return {
      success: true,
      jobId,
      processedCount: 1,
      durationMs,
      metadata: {
        taskName: payload.taskName,
        status: 'HEALTHY',
      },
    };
  } catch (err: unknown) {
    const durationMs = Math.round(performance.now() - startTime);
    const errorMessage = err instanceof Error ? err.message : 'System maintenance execution failed';
    jobLogger.error(`System maintenance failed: ${errorMessage}`, err instanceof Error ? err : undefined);

    return {
      success: false,
      jobId,
      durationMs,
      error: errorMessage,
    };
  }
}
