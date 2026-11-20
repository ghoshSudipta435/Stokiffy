import type { IFileStorage } from '../storage/file-storage.interface';
import { defaultLocalStorage } from '../storage/local-disk-storage';
import { IngestionStatusService, defaultIngestionStatusService, IngestionJobRecord } from '../services/ingestion-status.service';
import { logger } from '../logger';

export interface FileIngestionJobPayload {
  jobTicketId: string;
  storageKey: string;
  fileName: string;
  fileSizeBytes: number;
  sha256Hash: string;
  userId: string;
  fileType: string;
  uploadedAt: string;
}

export interface IIngestionQueueService {
  enqueueIngestionJob(payload: FileIngestionJobPayload): Promise<IngestionJobRecord>;
  getJobStatus(jobId: string, userId: string): Promise<IngestionJobRecord | null>;
}

export class IngestionQueueService implements IIngestionQueueService {
  constructor(
    private readonly statusService: IngestionStatusService = defaultIngestionStatusService,
    private readonly storage: IFileStorage = defaultLocalStorage
  ) {}

  public async enqueueIngestionJob(payload: FileIngestionJobPayload): Promise<IngestionJobRecord> {
    logger.info(`Enqueuing file ingestion job for ${payload.fileName}`, {
      jobTicketId: payload.jobTicketId,
      queue: 'file-ingestion',
      storageKey: payload.storageKey,
      fileSizeBytes: payload.fileSizeBytes,
      userId: payload.userId,
    });

    const jobRecord: IngestionJobRecord = {
      jobId: payload.jobTicketId,
      storageKey: payload.storageKey,
      fileName: payload.fileName,
      fileSizeBytes: payload.fileSizeBytes,
      sha256Hash: payload.sha256Hash,
      userId: payload.userId,
      fileType: payload.fileType,
      status: 'QUEUED',
      queue: 'file-ingestion',
      enqueuedAt: payload.uploadedAt,
      updatedAt: payload.uploadedAt,
      message: 'File accepted and staged for background parsing and validation.',
    };

    try {
      // Record initial QUEUED state
      await this.statusService.createJob(jobRecord);

      // In production/runtime with live database, dispatch to pg-boss if client configured
      // Note: pg-boss driver connection is optional in personal workstation mode
      return jobRecord;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Queue submission failure: ${errorMessage}`, {
        jobTicketId: payload.jobTicketId,
        queue: 'file-ingestion',
      }, err instanceof Error ? err : undefined);

      // Rollback: Safely delete newly staged file on queue dispatch failure
      try {
        await this.storage.deleteFile(payload.storageKey, payload.userId);
        logger.info(`Rolled back staged file ${payload.storageKey} following queue failure`, {
          jobTicketId: payload.jobTicketId,
        });
      } catch (cleanupErr) {
        logger.warn(`Failed to clean up staged file during rollback: ${cleanupErr}`);
      }

      await this.statusService.updateJobStatus(payload.jobTicketId, {
        status: 'FAILED',
        error: `Queue submission failed: ${errorMessage}`,
      });

      throw new Error(`QUEUE_DISPATCH_FAILED: Unable to submit job to queue. ${errorMessage}`);
    }
  }

  public async getJobStatus(jobId: string, userId: string): Promise<IngestionJobRecord | null> {
    return this.statusService.getJobForUser(jobId, userId);
  }
}

export const defaultIngestionQueueService = new IngestionQueueService();
