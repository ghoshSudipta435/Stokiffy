/**
 * IngestionJob repository — durable ingestion-job data access.
 * Enforces row-level ownership (userId) on all queries.
 * Provides lease-based claiming, progress tracking, and idempotent job reuse.
 */

import { PrismaClient } from '@prisma/client';
import type { IngestionJob } from '@prisma/client';

/**
 * Reusable job statuses — these statuses allow re-upload of the same file.
 * Failed jobs are excluded so a user can re-upload after failure.
 */
export const REUSABLE_STATUSES = [
  'QUEUED',
  'PROCESSING',
  'VALIDATING',
  'COMPLETED',
] as const;

export type ReusableStatus = (typeof REUSABLE_STATUSES)[number];

/**
 * Terminal statuses — once reached, no further state transitions allowed.
 */
export const TERMINAL_STATUSES = ['COMPLETED', 'FAILED'] as const;

export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

/**
 * Error thrown when attempting to claim a job already leased by another worker.
 */
export class JobLeaseConflictError extends Error {
  constructor(public readonly jobId: string, public readonly currentLeaseToken: string | null) {
    super(`Job ${jobId} is already leased by another worker`);
    this.name = 'JobLeaseConflictError';
  }
}

/**
 * Error thrown when a stale lease token is used for an update.
 */
export class StaleLeaseError extends Error {
  constructor(public readonly jobId: string, public readonly expectedToken: string, public readonly actualToken: string | null) {
    super(`Stale lease token for job ${jobId}: expected ${expectedToken}, got ${actualToken}`);
    this.name = 'StaleLeaseError';
  }
}

/**
 * Error thrown when attempting an invalid status transition.
 */
export class InvalidStatusTransitionError extends Error {
  constructor(public readonly jobId: string, public readonly from: string, public readonly to: string) {
    super(`Invalid status transition for job ${jobId}: ${from} -> ${to}`);
    this.name = 'InvalidStatusTransitionError';
  }
}

/**
 * Error thrown when attempting to modify a terminal-state job.
 */
export class TerminalStateError extends Error {
  constructor(public readonly jobId: string, public readonly status: string) {
    super(`Job ${jobId} is in terminal state ${status} and cannot be modified`);
    this.name = 'TerminalStateError';
  }
}

export class IngestionJobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ------------------------------------------------------------------
  // Create / reuse
  // ------------------------------------------------------------------

  /**
   * Creates a new ingestion job, or reuses an existing reusable job
   * for the same user + sha256Hash combination.
   *
   * Concurrency-safe: if two callers race to create the same reusable job,
   * the database partial unique index on (userId, sha256Hash) WHERE
   * status IN (QUEUED, PROCESSING, VALIDATING, COMPLETED) guarantees only
   * one succeeds. The loser recovers in a fresh transaction (never inside
   * an aborted PostgreSQL transaction).
   */
  async createOrReuseJob(data: {
    userId: string;
    storageProvider?: string;
    storageKey: string;
    originalFilename?: string;
    fileSizeBytes?: number;
    mimeType?: string;
    sha256Hash?: string;
    retryLimit?: number;
  }): Promise<{ job: IngestionJob; created: boolean }> {
    const reusableStatuses = REUSABLE_STATUSES as unknown as string[];

    // Fast path: check for an existing reusable job
    const existing = await this.prisma.ingestionJob.findFirst({
      where: {
        userId: data.userId,
        ...(data.sha256Hash !== undefined ? { sha256Hash: data.sha256Hash } : {}),
        status: { in: reusableStatuses },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return { job: existing, created: false };
    }

    // Slow path: create new job. If a P2002 unique conflict occurs due to
    // a concurrent creation, recover in a fresh transaction.
    try {
      const job = await this.prisma.ingestionJob.create({
        data: {
          userId: data.userId,
          status: 'QUEUED',
          storageProvider: data.storageProvider ?? 'local',
          storageKey: data.storageKey,
          ...(data.originalFilename !== undefined ? { originalFilename: data.originalFilename } : {}),
          ...(data.fileSizeBytes !== undefined ? { fileSizeBytes: data.fileSizeBytes } : {}),
          ...(data.mimeType !== undefined ? { mimeType: data.mimeType } : {}),
          ...(data.sha256Hash !== undefined ? { sha256Hash: data.sha256Hash } : {}),
          attemptCount: 0,
          retryLimit: data.retryLimit ?? 3,
          objectDeleted: false,
        },
      });
      return { job, created: true };
    } catch (err) {
      const prismaErr = err as { code?: string; meta?: unknown };
      if (prismaErr.code === 'P2002') {
        // Unique conflict on partial index — a concurrent caller created the
        // same reusable job. Recover in a fresh transaction (not inside the
        // aborted one) by fetching the existing job.
        const recovered = await this.prisma.ingestionJob.findFirst({
          where: {
            userId: data.userId,
            ...(data.sha256Hash !== undefined ? { sha256Hash: data.sha256Hash } : {}),
            status: { in: reusableStatuses },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (recovered) {
          return { job: recovered, created: false };
        }
        // If no reusable job found despite P2002, rethrow
        throw err;
      }
      throw err;
    }
  }

  // ------------------------------------------------------------------
  // Read
  // ------------------------------------------------------------------

  /**
   * Finds a job by ID, tenant-scoped to the given userId.
   * Returns null if the job does not exist or belongs to another user.
   */
  async findByIdForUser(jobId: string, userId: string): Promise<IngestionJob | null> {
    return this.prisma.ingestionJob.findFirst({
      where: { id: jobId, userId },
    });
  }

  /**
   * Finds a reusable job for the given user + sha256Hash combination.
   * Only returns jobs in QUEUED, PROCESSING, VALIDATING, or COMPLETED status.
   * Failed jobs are excluded so re-upload after failure is allowed.
   */
  async findReusableByUserAndHash(userId: string, sha256Hash: string): Promise<IngestionJob | null> {
    return this.prisma.ingestionJob.findFirst({
      where: {
        userId,
        ...(sha256Hash !== undefined ? { sha256Hash } : {}),
        status: { in: REUSABLE_STATUSES as unknown as string[] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ------------------------------------------------------------------
  // Claim / lease
  // ------------------------------------------------------------------

  /**
   * Atomically claims a job for processing by a worker.
   * Uses a conditional update with fencing: only transitions QUEUED -> PROCESSING
   * if no lease is currently held or the lease has expired.
   *
   * @param jobId - The job ID to claim
   * @param leaseOwner - Identifier of the claiming worker
   * @param leaseToken - Opaque token for lease fencing on subsequent updates
   * @param leaseExpiresAt - Lease expiration timestamp
   * @returns The claimed job, or null if already claimed by another active worker
   */
  async claimJob(
    jobId: string,
    leaseOwner: string,
    leaseToken: string,
    leaseExpiresAt: Date
  ): Promise<IngestionJob | null> {
    const now = new Date();

    const updated = await this.prisma.ingestionJob.updateMany({
      where: {
        id: jobId,
        status: 'QUEUED',
        OR: [
          { leaseExpiresAt: null },
          { leaseExpiresAt: { lt: now } },
        ],
      },
      data: {
        status: 'PROCESSING',
        leaseOwner,
        leaseToken,
        leaseExpiresAt,
        lastHeartbeatAt: now,
        startedAt: now,
        attemptCount: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return this.prisma.ingestionJob.findUnique({ where: { id: jobId } });
  }

  /**
   * Renews a lease, verifying the current lease token.
   * Only succeeds if the job is in PROCESSING status and the lease token matches.
   */
  async renewLease(
    jobId: string,
    leaseToken: string,
    leaseExpiresAt: Date
  ): Promise<IngestionJob | null> {
    const updated = await this.prisma.ingestionJob.updateMany({
      where: {
        id: jobId,
        status: 'PROCESSING',
        leaseToken,
      },
      data: {
        leaseExpiresAt,
        lastHeartbeatAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return this.prisma.ingestionJob.findUnique({ where: { id: jobId } });
  }

  // ------------------------------------------------------------------
  // Progress
  // ------------------------------------------------------------------

  /**
   * Updates progress counters with monotonic validation.
   * Prevents decreasing counters where the domain requires monotonic progress.
   * Fenced by job ID, lease token, and permitted status (PROCESSING or VALIDATING).
   */
  async updateProgress(
    jobId: string,
    leaseToken: string,
    data: {
      processedRows?: number;
      acceptedRows?: number;
      rejectedRows?: number;
      totalRows?: number;
    }
  ): Promise<IngestionJob | null> {
    const job = await this.prisma.ingestionJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return null;
    }

    // Fence: only allow progress updates on active (non-terminal) statuses
    if (!['PROCESSING', 'VALIDATING'].includes(job.status)) {
      throw new InvalidStatusTransitionError(job.id, job.status, 'PROGRESS_UPDATE');
    }

    // Fence: verify lease token
    if (job.leaseToken !== leaseToken) {
      throw new StaleLeaseError(job.id, job.leaseToken ?? '', leaseToken);
    }

    // Monotonic validation: prevent decreasing counters
    const nextProcessed = data.processedRows ?? job.processedRows;
    const nextAccepted = data.acceptedRows ?? job.acceptedRows;
    const nextRejected = data.rejectedRows ?? job.rejectedRows;
    const nextTotal = data.totalRows ?? job.totalRows;

    if (nextProcessed < job.processedRows) {
      throw new Error(`processedRows cannot decrease: ${job.processedRows} -> ${nextProcessed}`);
    }
    if (nextAccepted < job.acceptedRows) {
      throw new Error(`acceptedRows cannot decrease: ${job.acceptedRows} -> ${nextAccepted}`);
    }
    if (nextRejected < job.rejectedRows) {
      throw new Error(`rejectedRows cannot decrease: ${job.rejectedRows} -> ${nextRejected}`);
    }
    if (nextTotal !== null && nextTotal !== undefined && job.totalRows !== null && nextTotal < job.totalRows) {
      throw new Error(`totalRows cannot decrease: ${job.totalRows} -> ${nextTotal}`);
    }

    const updated = await this.prisma.ingestionJob.update({
      where: { id: jobId },
      data: {
        processedRows: nextProcessed,
        acceptedRows: nextAccepted,
        rejectedRows: nextRejected,
        totalRows: nextTotal,
        lastHeartbeatAt: new Date(),
      },
    });

    return updated;
  }

  // ------------------------------------------------------------------
  // Completion / failure
  // ------------------------------------------------------------------

  /**
   * Marks a job as completed. Terminal state — cannot be overwritten.
   * Fenced by job ID, lease token, and PROCESSING/VALIDATING status.
   */
  async markCompleted(
    jobId: string,
    leaseToken: string,
    data?: { processedRows?: number; acceptedRows?: number; rejectedRows?: number; totalRows?: number }
  ): Promise<IngestionJob | null> {
    const job = await this.prisma.ingestionJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return null;
    }

    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      throw new TerminalStateError(job.id, job.status);
    }

    if (!['PROCESSING', 'VALIDATING'].includes(job.status)) {
      throw new InvalidStatusTransitionError(job.id, job.status, 'COMPLETED');
    }

    if (job.leaseToken !== leaseToken) {
      throw new StaleLeaseError(job.id, job.leaseToken ?? '', leaseToken);
    }

    const now = new Date();
    return this.prisma.ingestionJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        processedRows: data?.processedRows ?? job.processedRows,
        acceptedRows: data?.acceptedRows ?? job.acceptedRows,
        rejectedRows: data?.rejectedRows ?? job.rejectedRows,
        totalRows: data?.totalRows ?? job.totalRows,
        lastHeartbeatAt: now,
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
  }

  /**
   * Marks a job as failed, or schedules a retry if attempts remain.
   * If retryLimit not exhausted: status -> QUEUED, nextRetryAt set.
   * If retryLimit exhausted: status -> FAILED (terminal).
   * Fenced by job ID, lease token, and PROCESSING/VALIDATING status.
   */
  async markFailedOrRetry(
    jobId: string,
    leaseToken: string,
    data: {
      failureCategory: string;
      errorSummary?: string;
      nextRetryAt?: Date;
    }
  ): Promise<IngestionJob | null> {
    const job = await this.prisma.ingestionJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return null;
    }

    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      throw new TerminalStateError(job.id, job.status);
    }

    if (!['PROCESSING', 'VALIDATING'].includes(job.status)) {
      throw new InvalidStatusTransitionError(job.id, job.status, 'FAILED_OR_RETRY');
    }

    if (job.leaseToken !== leaseToken) {
      throw new StaleLeaseError(job.id, job.leaseToken ?? '', leaseToken);
    }

    const now = new Date();
    const nextAttempt = job.attemptCount + 1;
    const retryExhausted = nextAttempt >= job.retryLimit;

    return this.prisma.ingestionJob.update({
      where: { id: jobId },
      data: {
        status: retryExhausted ? 'FAILED' : 'QUEUED',
        failureCategory: data.failureCategory,
        ...(data.errorSummary !== undefined ? { errorSummary: data.errorSummary } : {}),
        attemptCount: nextAttempt,
        nextRetryAt: retryExhausted ? null : (data.nextRetryAt ?? null),
        failedAt: retryExhausted ? now : null,
        completedAt: retryExhausted ? now : null,
        lastHeartbeatAt: now,
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
  }

  /**
   * Fails a queued job without a lease (e.g., deterministic validation failure
   * before a worker claims it). Fenced to QUEUED status only.
   */
  async failQueuedJob(
    jobId: string,
    data: { failureCategory: string; errorSummary?: string }
  ): Promise<IngestionJob | null> {
    const job = await this.prisma.ingestionJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return null;
    }

    if (job.status !== 'QUEUED') {
      throw new InvalidStatusTransitionError(job.id, job.status, 'FAILED');
    }

    return this.prisma.ingestionJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        failureCategory: data.failureCategory,
        ...(data.errorSummary !== undefined ? { errorSummary: data.errorSummary } : {}),
        failedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }

  // ------------------------------------------------------------------
  // Lease recovery
  // ------------------------------------------------------------------

  /**
   * Recovers expired leases by resetting QUEUED-eligible jobs back to QUEUED
   * status with cleared lease fields. Safe under concurrent execution because
   * each update is atomic and only touches jobs with expired leases.
   *
   * Returns the number of jobs recovered.
   */
  async recoverExpiredLeases(): Promise<number> {
    const now = new Date();

    const result = await this.prisma.ingestionJob.updateMany({
      where: {
        status: 'PROCESSING',
        OR: [
          { leaseExpiresAt: null },
          { leaseExpiresAt: { lt: now } },
        ],
      },
      data: {
        status: 'QUEUED',
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
        lastHeartbeatAt: now,
        attemptCount: { increment: 1 },
      },
    });

    return result.count;
  }

  // ------------------------------------------------------------------
  // Object cleanup
  // ------------------------------------------------------------------

  /**
   * Marks a job's staged object as deleted.
   * Fenced by job ID — no lease required since cleanup can be triggered
   * independently of worker processing.
   */
  async markStagedObjectDeleted(jobId: string): Promise<IngestionJob | null> {
    const job = await this.prisma.ingestionJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return null;
    }

    return this.prisma.ingestionJob.update({
      where: { id: jobId },
      data: {
        objectDeleted: true,
        objectDeletedAt: new Date(),
      },
    });
  }

  /**
   * Finds jobs with pending object cleanup (objectDeleted = false) that
     are in terminal states and past their retention expiry, or have been
     completed/failed for some time. Used by a later sweeper to clean up
     staged objects.
   */
  async findPendingObjectCleanup(olderThan: Date): Promise<IngestionJob[]> {
    return this.prisma.ingestionJob.findMany({
      where: {
        objectDeleted: false,
        status: { in: ['COMPLETED', 'FAILED'] },
        OR: [
          { retentionExpiresAt: { lt: olderThan } },
          { completedAt: { lt: olderThan } },
          { failedAt: { lt: olderThan } },
        ],
      },
      orderBy: { updatedAt: 'asc' },
    });
  }
}
