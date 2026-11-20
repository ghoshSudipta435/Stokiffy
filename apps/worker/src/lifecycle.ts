import { logger } from './lib/logger.js';
import { queueManager } from './queue.js';
import { env } from './config/env.js';

let isShuttingDown = false;

export function setupGracefulShutdown(): void {
  const handleSignal = async (signal: string) => {
    if (isShuttingDown) {
      logger.warn(`Received ${signal} while already shutting down. Forcing exit.`);
      process.exit(1);
    }
    isShuttingDown = true;
    logger.info(`Received ${signal}. Starting graceful shutdown of worker daemon...`);

    const shutdownTimeout = setTimeout(() => {
      logger.error(`Graceful shutdown timed out after ${env.WORKER_DRAIN_TIMEOUT_MS}ms. Forcing exit.`);
      process.exit(1);
    }, env.WORKER_DRAIN_TIMEOUT_MS);

    try {
      await queueManager.stop(env.WORKER_DRAIN_TIMEOUT_MS);
      clearTimeout(shutdownTimeout);
      logger.info('Worker daemon gracefully terminated.');
      process.exit(0);
    } catch (err: unknown) {
      clearTimeout(shutdownTimeout);
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error(`Error during graceful shutdown: ${error.message}`, error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));

  process.on('uncaughtException', (err: Error) => {
    logger.error(`Uncaught exception in worker process: ${err.message}`, err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error(`Unhandled promise rejection in worker: ${error.message}`, error);
  });
}
