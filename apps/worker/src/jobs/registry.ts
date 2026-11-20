import { QUEUES, type QueueName, type JobExecutionResult, type JobExecutionContext } from './types.js';
import { handleProcessFileIngestion } from './handlers/process-csv-import.js';
import { handleSystemMaintenance } from './handlers/system-maintenance.js';
import { handleTechnicalDataQualityAudit } from './handlers/daily-data-quality-audit.js';

export interface JobDefinition {
  queueName: QueueName;
  concurrency: number;
  retryLimit: number;
  retryDelaySeconds: number;
  retryBackoff: boolean;
  handler: (jobId: string, payload: unknown, context?: JobExecutionContext) => Promise<JobExecutionResult>;
}

export const JOB_REGISTRY: Record<QueueName, JobDefinition> = {
  [QUEUES.FILE_INGESTION]: {
    queueName: QUEUES.FILE_INGESTION,
    concurrency: 2,
    retryLimit: 3,
    retryDelaySeconds: 10,
    retryBackoff: true,
    handler: handleProcessFileIngestion,
  },
  [QUEUES.SYSTEM_MAINTENANCE]: {
    queueName: QUEUES.SYSTEM_MAINTENANCE,
    concurrency: 3,
    retryLimit: 2,
    retryDelaySeconds: 30,
    retryBackoff: false,
    handler: handleSystemMaintenance,
  },
  [QUEUES.NIGHTLY_AUDIT]: {
    queueName: QUEUES.NIGHTLY_AUDIT,
    concurrency: 1,
    retryLimit: 2,
    retryDelaySeconds: 60,
    retryBackoff: true,
    handler: handleTechnicalDataQualityAudit,
  },
};
