import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { queueManager } from './queue.js';
import { setupGracefulShutdown } from './lifecycle.js';

async function main() {
  logger.info('====================================================');
  logger.info('  STOKIFFY BACKGROUND WORKER DAEMON');
  logger.info(`  Environment: ${env.NODE_ENV}`);
  logger.info(`  Concurrency: ${env.WORKER_CONCURRENCY}`);
  logger.info(`  Drain Timeout: ${env.WORKER_DRAIN_TIMEOUT_MS}ms`);
  logger.info('====================================================');

  // 1. Setup process lifecycle signal listeners
  setupGracefulShutdown();

  // 2. Start pg-boss queue manager and workers
  try {
    await queueManager.start();
    logger.info('Worker daemon running. Waiting for jobs...');
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(`Failed to start worker daemon: ${error.message}`, error);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error('[FATAL WORKER STARTUP ERROR]', error);
  process.exit(1);
});
