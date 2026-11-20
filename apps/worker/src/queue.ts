import type PgBoss from 'pg-boss';
import type { Job } from 'pg-boss';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { JOB_REGISTRY, type JobDefinition } from './jobs/registry.js';
import {
  isRetriesExhausted,
  isRetryableJobResult,
  type JobExecutionContext,
  type JobExecutionResult,
  type QueueName,
} from './jobs/types.js';

export class QueueManager {
  private boss: PgBoss | null = null;
  private isRunning = false;

  constructor(bossInstance?: PgBoss) {
    // Driver instantiated in start() to prevent import-time side effects unless injected for testing
    if (bossInstance) {
      this.boss = bossInstance;
    }
  }

  public async start(maxRetries = 5, initialDelayMs = 1000): Promise<void> {
    if (this.isRunning) return;

    if (!this.boss) {
      try {
        const { default: PgBossClass } = await import('pg-boss');
        this.boss = new PgBossClass({
          connectionString: env.DATABASE_URL,
          archiveCompletedAfterSeconds: 7 * 24 * 3600, // 7 days retention
          deleteAfterDays: 14,
          retentionMinutes: 14 * 24 * 60,
        });

        this.boss.on('error', (err: Error) => {
          logger.error(`[PG-BOSS ERROR] ${err.message}`, err);
        });
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(`Failed to load pg-boss queue driver: ${error.message}`, error);
        throw error;
      }
    }

    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        attempt++;
        logger.info(`Starting PgBoss queue manager (attempt ${attempt}/${maxRetries})...`);
        await this.boss.start();
        this.isRunning = true;
        logger.info('PgBoss queue engine successfully connected and started.');
        break;
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.warn(
          `Failed to connect PgBoss on attempt ${attempt}: ${error.message}. Retrying in ${initialDelayMs * attempt}ms...`
        );
        if (attempt >= maxRetries) {
          logger.error('Exhausted maximum database connection retries for queue daemon.', error);
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, initialDelayMs * attempt));
      }
    }

    // Register job workers
    await this.registerWorkers();
  }

  /**
   * Executes a single pg-boss job with centralized failure classification:
   * - Success -> returns result (pg-boss marks job completed).
   * - Permanent non-retryable failure -> cancels job in pg-boss (terminal cancelled, 0 retries,
   *   never falsely marked completed) and returns only after cancellation succeeds.
   * - Retryable or unknown failure -> throws so pg-boss applies bounded retry/backoff or marks failed
   *   once retries are exhausted.
   */
  public async processJob(
    queueName: QueueName,
    def: JobDefinition,
    job: Job<unknown>
  ): Promise<JobExecutionResult> {
    const jobLogger = logger.forJob(job.id, queueName);
    const context: JobExecutionContext = {
      retryCount: job.retryCount ?? 0,
      retryLimit: job.retryLimit ?? def.retryLimit,
    };

    jobLogger.info(`Processing job ${job.id} from queue '${queueName}'`, {
      retryCount: context.retryCount,
      retryLimit: context.retryLimit,
    });

    let result: JobExecutionResult;
    try {
      result = await def.handler(job.id, job.data, context);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      const exhausted = isRetriesExhausted(context);
      jobLogger.error(
        exhausted
          ? `Job ${job.id} threw unhandled exception and exhausted retries (${context.retryCount}/${context.retryLimit}): ${error.message}`
          : `Job ${job.id} threw unhandled exception (attempt ${(context.retryCount ?? 0) + 1}/${(context.retryLimit ?? 0) + 1}): ${error.message}`,
        {
          failureCategory: 'UNHANDLED_EXCEPTION',
          retryable: true,
          retryCount: context.retryCount,
          retryLimit: context.retryLimit,
          exhausted,
        },
        error
      );
      throw error;
    }

    if (result.success) {
      jobLogger.info(`Job ${job.id} successfully finished in ${result.durationMs}ms`);
      return result;
    }

    const retryable = isRetryableJobResult(result);

    if (!retryable) {
      jobLogger.warn(
        `Job ${job.id} failed permanently (${result.failureCategory ?? 'NON_RETRYABLE'}): ${result.error || 'Non-retryable failure'}. Cancelling in pg-boss to prevent retries.`,
        {
          failureCategory: result.failureCategory,
          retryable: false,
          retryCount: context.retryCount,
          retryLimit: context.retryLimit,
        }
      );

      if (!this.boss) {
        const initErr = new Error(
          `Cannot cancel permanent failure for job ${job.id}: pg-boss instance is not initialized.`
        );
        jobLogger.error(
          initErr.message,
          {
            failureCategory: result.failureCategory,
            retryable: false,
            retryCount: context.retryCount,
            retryLimit: context.retryLimit,
          },
          initErr
        );
        throw initErr;
      }

      try {
        // pg-boss@10.4.2: cancel() transitions active -> cancelled (terminal, 0 retries),
        // and subsequent complete() affects 0 rows (WHERE state = 'active').
        await this.boss.cancel(queueName, job.id);
      } catch (cancelErr: unknown) {
        const error = cancelErr instanceof Error ? cancelErr : new Error(String(cancelErr));
        jobLogger.error(
          `Job ${job.id} failed to cancel in pg-boss after permanent failure: ${error.message}`,
          {
            failureCategory: result.failureCategory,
            retryable: false,
            retryCount: context.retryCount,
            retryLimit: context.retryLimit,
          },
          error
        );
        throw error;
      }
      return result;
    }

    const exhausted = isRetriesExhausted(context);
    const retryError = new Error(result.error || 'Job handler indicated retryable failure');
    jobLogger.error(
      exhausted
        ? `Job ${job.id} exhausted retries (${context.retryCount}/${context.retryLimit}) with error: ${retryError.message}`
        : `Job ${job.id} encountered retryable failure (attempt ${(context.retryCount ?? 0) + 1}/${(context.retryLimit ?? 0) + 1}): ${retryError.message}`,
      {
        failureCategory: result.failureCategory,
        retryable: true,
        retryCount: context.retryCount,
        retryLimit: context.retryLimit,
        exhausted,
      },
      retryError
    );

    throw retryError;
  }

  private async registerWorkers(): Promise<void> {
    if (!this.boss) return;

    for (const [queueName, def] of Object.entries(JOB_REGISTRY) as Array<[QueueName, JobDefinition]>) {
      logger.info(`Registering ${def.concurrency} worker(s) for queue '${queueName}' (pg-boss v10 batchSize=1, includeMetadata=true)`);

      for (let workerIdx = 0; workerIdx < def.concurrency; workerIdx++) {
        await this.boss.work(
          queueName,
          {
            batchSize: 1,
            includeMetadata: true,
            pollingIntervalSeconds: env.WORKER_POLL_INTERVAL_SECONDS,
          },
          async (jobs: Job<unknown>[]) => {
            for (const job of jobs) {
              await this.processJob(queueName, def, job);
            }
          }
        );
      }
    }
  }

  public async enqueue<T extends object>(
    queueName: QueueName,
    data: T,
    options?: { retryLimit?: number; startAfter?: number | string | Date }
  ): Promise<string | null> {
    if (!this.boss || !this.isRunning) {
      throw new Error('Queue manager is not running. Cannot enqueue job.');
    }
    const def = JOB_REGISTRY[queueName];
    const jobId = await this.boss.send(queueName, data, {
      retryLimit: options?.retryLimit ?? def?.retryLimit ?? 3,
      retryDelay: def?.retryDelaySeconds ?? 10,
      retryBackoff: def?.retryBackoff ?? true,
      startAfter: options?.startAfter,
    });
    logger.info(`Enqueued job ${jobId} to queue '${queueName}'`);
    return jobId;
  }

  public async stop(timeoutMs = 10000): Promise<void> {
    if (!this.boss || !this.isRunning) return;
    logger.info(`Draining in-flight jobs and shutting down PgBoss (timeout ${timeoutMs}ms)...`);
    try {
      await this.boss.stop({ graceful: true, timeout: timeoutMs });
      this.isRunning = false;
      logger.info('PgBoss queue engine cleanly stopped.');
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error(`Error during PgBoss shutdown: ${error.message}`, error);
    }
  }

  public getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning };
  }
}

export const queueManager = new QueueManager();
