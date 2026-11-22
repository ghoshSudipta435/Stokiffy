import type PgBoss from 'pg-boss';
import { QUEUES } from './jobs/types.js';
import { logger } from './lib/logger.js';

export interface ScheduledJobDef {
  name: string;
  queue: string;
  cron: string;
  description: string;
  payload: () => object;
}

/**
 * Recurring Technical & Strategy Schedules
 */
export const RECURRING_SCHEDULES: ScheduledJobDef[] = [
  {
    name: 'scheduled-system-maintenance',
    queue: QUEUES.SYSTEM_MAINTENANCE,
    // Daily at 06:00 UTC
    cron: '0 6 * * *',
    description: 'Technical queue maintenance and connection health verification',
    payload: () => ({
      taskName: 'daily-queue-health-check',
      runTimestamp: new Date().toISOString(),
      checkQueueHealth: true,
    }),
  },
  {
    name: 'nightly-snapshot-integrity-audit',
    queue: QUEUES.NIGHTLY_AUDIT,
    // 23:30 IST (18:00 UTC) every day
    cron: '0 18 * * *',
    description: 'Technical verification of database financial snapshot integrity',
    payload: () => ({
      date: new Date().toISOString().split('T')[0],
      verifySnapshotIntegrity: true,
      checkStaleSnapshots: true,
    }),
  },
  {
    name: 'periodic-portfolio-alert-evaluation',
    queue: QUEUES.PORTFOLIO_ALERTS,
    // 16:00 IST (10:30 UTC) Monday through Friday (post-market close)
    cron: '30 10 * * 1-5',
    description: 'Post-market portfolio holdings and active watchlist alert evaluation',
    payload: () => ({
      includeWatchlists: true,
      asOfDate: new Date().toISOString(),
    }),
  },
];

export async function setupRecurringSchedules(boss: PgBoss): Promise<void> {
  for (const schedule of RECURRING_SCHEDULES) {
    try {
      logger.info(`Configuring recurring cron schedule: '${schedule.name}' [${schedule.cron}]`);
      await boss.schedule(schedule.queue, schedule.cron, schedule.payload(), {
        tz: 'UTC',
      });
      logger.info(`Scheduled '${schedule.name}' on cron '${schedule.cron}'`);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.warn(`Could not register schedule '${schedule.name}': ${error.message}`);
    }
  }
}
