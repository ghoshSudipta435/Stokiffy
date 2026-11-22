import { QUEUES, type QueueName, type JobExecutionResult, type JobExecutionContext } from './types.js';
import { handleProcessFileIngestion } from './handlers/process-csv-import.js';
import { handleSystemMaintenance } from './handlers/system-maintenance.js';
import { handleTechnicalDataQualityAudit } from './handlers/daily-data-quality-audit.js';
import { handleEvaluatePortfolioAlerts } from './handlers/evaluate-portfolio-alerts.js';
import { handleBatchRescoreCompanies } from './handlers/batch-rescore-companies.js';

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
  [QUEUES.PORTFOLIO_ALERTS]: {
    queueName: QUEUES.PORTFOLIO_ALERTS,
    concurrency: 1,
    retryLimit: 2,
    retryDelaySeconds: 30,
    retryBackoff: true,
    handler: handleEvaluatePortfolioAlerts,
  },
  [QUEUES.BATCH_RESCORE]: {
    queueName: QUEUES.BATCH_RESCORE,
    concurrency: 1,
    retryLimit: 2,
    retryDelaySeconds: 30,
    retryBackoff: true,
    handler: handleBatchRescoreCompanies,
  },
};
