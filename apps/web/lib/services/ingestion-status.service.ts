import fs from 'node:fs';
import path from 'node:path';
import { resolveJobsDir } from '../storage/path-resolver';
import {
  mergeJobSidecarRecord,
  sanitizeSidecarJobId,
  withJobSidecarLock,
  writeJsonAtomically,
  type SidecarJobStatus,
  type SidecarLockOptions,
  type SidecarRecordBase,
} from '../storage/sidecar-store';
import { logger } from '../logger';

export type IngestionJobStatus = SidecarJobStatus;

export interface RowValidationError {
  rowNumber: number;
  column: string;
  value?: string;
  message: string;
}

export interface IngestionJobRecord extends SidecarRecordBase {
  jobId: string;
  storageKey: string;
  fileName: string;
  fileSizeBytes: number;
  sha256Hash: string;
  userId: string;
  fileType: string;
  status: IngestionJobStatus;
  queue: string;
  enqueuedAt: string;
  updatedAt: string;
  completedAt?: string;
  message?: string;
  processedCount?: number;
  validRowCount?: number;
  warningsCount?: number;
  errorsSummary?: RowValidationError[];
  failureCategory?: string;
  error?: string;
}

const REUSABLE_STATUSES: ReadonlySet<IngestionJobStatus> = new Set([
  'QUEUED',
  'PROCESSING',
  'VALIDATING',
  'COMPLETED',
]);

export class IngestionStatusService {
  private readonly jobsDirectory: string;
  private readonly memoryStore = new Map<string, IngestionJobRecord>();
  private readonly lockOptions?: SidecarLockOptions;

  constructor(jobsDirectory?: string, lockOptions?: SidecarLockOptions) {
    this.jobsDirectory = resolveJobsDir(jobsDirectory);
    this.lockOptions = lockOptions;
  }

  public getJobsDirectory(): string {
    return this.jobsDirectory;
  }

  private getJobFilePath(jobId: string): string {
    const safeJobId = sanitizeSidecarJobId(jobId);
    return path.join(this.jobsDirectory, `${safeJobId}.json`);
  }

  public async createJob(record: IngestionJobRecord): Promise<IngestionJobRecord> {
    this.memoryStore.set(record.jobId, record);
    try {
      await withJobSidecarLock(
        this.jobsDirectory,
        record.jobId,
        async () => {
          const filePath = this.getJobFilePath(record.jobId);
          await writeJsonAtomically(filePath, record);
        },
        this.lockOptions
      );
    } catch (err: unknown) {
      logger.warn(
        'Failed to persist job sidecar file during createJob',
        { jobId: record.jobId },
        err
      );
    }
    return record;
  }

  /**
   * Concurrency-safe, atomic status update:
   * - Acquires a per-job cross-process POSIX lock.
   * - Reads the latest persisted state from disk inside the lock.
   * - Enforces terminal-state immutability and metadata preservation.
   * - Persists atomically via temp file + fsync + rename.
   */
  public async updateJobStatus(
    jobId: string,
    updates: Partial<Omit<IngestionJobRecord, 'jobId' | 'userId'>>
  ): Promise<IngestionJobRecord | null> {
    return withJobSidecarLock(
      this.jobsDirectory,
      jobId,
      async () => {
        const filePath = this.getJobFilePath(jobId);
        let existing: IngestionJobRecord | null = null;

        if (fs.existsSync(filePath)) {
          const raw = await fs.promises.readFile(filePath, 'utf-8');
          existing = JSON.parse(raw) as IngestionJobRecord;
        } else {
          existing = this.memoryStore.get(jobId) ?? null;
        }

        if (!existing) {
          return null;
        }

        const { record: merged, ignoredStaleTransition, reason } = mergeJobSidecarRecord(
          existing,
          updates
        );

        if (ignoredStaleTransition) {
          logger.warn(reason || 'Ignored stale status transition on job sidecar', {
            jobId,
            currentStatus: existing.status,
            attemptedStatus: updates.status,
          });
          this.memoryStore.set(jobId, merged);
          return merged;
        }

        await writeJsonAtomically(filePath, merged);
        this.memoryStore.set(jobId, merged);
        return merged;
      },
      this.lockOptions
    );
  }

  /**
   * Disk-first read so cross-process worker updates (QUEUED -> PROCESSING -> COMPLETED/FAILED)
   * are immediately visible without restarting the web process.
   */
  public async getJobById(jobId: string): Promise<IngestionJobRecord | null> {
    const filePath = this.getJobFilePath(jobId);

    if (fs.existsSync(filePath)) {
      try {
        const raw = await fs.promises.readFile(filePath, 'utf-8');
        const record: IngestionJobRecord = JSON.parse(raw);
        this.memoryStore.set(jobId, record);
        return record;
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException)?.code;
        if (code === 'ENOENT') {
          return this.memoryStore.get(jobId) ?? null;
        }
        logger.error('Failed to read or parse job status sidecar file', { jobId }, err);
        throw new Error(
          `JOB_STATUS_READ_ERROR: Unable to read persisted status for job "${jobId}".`
        );
      }
    }

    return this.memoryStore.get(jobId) ?? null;
  }

  public async getJobForUser(jobId: string, userId: string): Promise<IngestionJobRecord | null> {
    const job = await this.getJobById(jobId);
    if (!job) {
      return null;
    }
    if (job.userId !== userId) {
      return null; // Enforce strict tenant isolation: no cross-user job visibility
    }
    return job;
  }

  /**
   * Scoped deduplication check: Synchronizes with latest persisted sidecar state on disk
   * before evaluating reusable active or completed jobs for the authenticated user.
   */
  public async findReusableJobForUser(
    userId: string,
    sha256Hash: string
  ): Promise<IngestionJobRecord | null> {
    // 1. Refresh from disk first so worker transitions (e.g., QUEUED -> FAILED or COMPLETED)
    //    take precedence over stale in-memory cache entries.
    if (fs.existsSync(this.jobsDirectory)) {
      let files: string[];
      try {
        files = await fs.promises.readdir(this.jobsDirectory);
      } catch (err: unknown) {
        logger.error('Failed to scan jobs directory during deduplication check', { userId }, err);
        throw new Error('JOB_STATUS_READ_ERROR: Unable to scan job status directory.');
      }

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const raw = await fs.promises.readFile(path.join(this.jobsDirectory, file), 'utf-8');
          const job: IngestionJobRecord = JSON.parse(raw);
          this.memoryStore.set(job.jobId, job);
        } catch (err: unknown) {
          logger.warn(
            'Skipping unreadable job sidecar file during deduplication scan',
            { file },
            err
          );
        }
      }
    }

    // 2. Evaluate latest synchronized records scoped strictly to userId
    for (const job of this.memoryStore.values()) {
      if (
        job.userId === userId &&
        job.sha256Hash === sha256Hash &&
        REUSABLE_STATUSES.has(job.status)
      ) {
        return job;
      }
    }

    return null;
  }
}

export const defaultIngestionStatusService = new IngestionStatusService();
