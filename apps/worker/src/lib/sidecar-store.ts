import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type SidecarJobStatus = 'QUEUED' | 'PROCESSING' | 'VALIDATING' | 'COMPLETED' | 'FAILED';

export interface SidecarRecordBase {
  jobId: string;
  storageKey: string;
  fileName: string;
  fileSizeBytes: number;
  sha256Hash: string;
  userId: string;
  fileType: string;
  status: SidecarJobStatus;
  queue: string;
  enqueuedAt: string;
  updatedAt: string;
  completedAt?: string;
  message?: string;
  processedCount?: number;
  validRowCount?: number;
  warningsCount?: number;
  errorsSummary?: Array<{
    rowNumber: number;
    column: string;
    value?: string;
    message: string;
  }>;
  failureCategory?: string;
  error?: string;
  [key: string]: unknown;
}

export interface SidecarLockOptions {
  /** Maximum time to wait for a contended per-job lock (default: 5000ms) */
  lockTimeoutMs?: number;
  /** Minimum age before checking if a lock's owning PID is dead (default: 100ms) */
  staleCheckGraceMs?: number;
  /** Initial retry delay in ms when lock is contended (default: 5ms) */
  initialRetryDelayMs?: number;
  /** Maximum retry delay in ms when lock is contended (default: 25ms) */
  maxRetryDelayMs?: number;
}

interface LockFilePayload {
  pid: number;
  token: string;
  acquiredAt: number;
}

const TERMINAL_STATUSES: ReadonlySet<string> = new Set(['COMPLETED', 'FAILED']);

export function sanitizeSidecarJobId(jobId: string): string {
  return jobId.replace(/[^a-zA-Z0-9_-]/g, '');
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    // EPERM means process exists but belongs to another user; ESRCH means process does not exist.
    return code === 'EPERM';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely checks whether a lockfile belongs to a definitively dead local process (ESRCH)
 * after a grace period, and reclaims it atomically via rename+unlink.
 * Never breaks a lock held by a live process.
 */
async function tryReclaimDeadProcessLock(
  lockPath: string,
  staleCheckGraceMs: number
): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(lockPath);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs < staleCheckGraceMs) {
      return false;
    }

    const raw = await fs.promises.readFile(lockPath, 'utf-8');
    if (!raw.trim()) {
      return false;
    }

    const parsed = JSON.parse(raw) as Partial<LockFilePayload>;
    if (typeof parsed.pid !== 'number' || typeof parsed.token !== 'string') {
      return false;
    }

    // Never break a lock while its owning process is alive
    if (isProcessAlive(parsed.pid)) {
      return false;
    }

    // Atomic claim of the dead lock via rename so two contenders cannot unlink a newly acquired lock
    const reclaimPath = `${lockPath}.reclaim.${process.pid}.${crypto.randomUUID()}`;
    try {
      await fs.promises.rename(lockPath, reclaimPath);
    } catch {
      return false;
    }

    try {
      await fs.promises.unlink(reclaimPath);
    } catch {
      // Ignore cleanup error on reclaimed file
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Acquires an exclusive, per-job cross-process POSIX lockfile (`O_CREAT | O_EXCL`)
 * in the same directory as the job sidecar, executes `fn`, and releases the lock
 * reliably in `finally`.
 */
export async function withJobSidecarLock<T>(
  jobsDirectory: string,
  jobId: string,
  fn: () => Promise<T>,
  options: SidecarLockOptions = {}
): Promise<T> {
  const safeJobId = sanitizeSidecarJobId(jobId);
  if (!safeJobId) {
    throw new Error('INVALID_JOB_ID: Cannot acquire sidecar lock for empty or invalid jobId.');
  }

  if (!fs.existsSync(jobsDirectory)) {
    fs.mkdirSync(jobsDirectory, { recursive: true, mode: 0o700 });
  }

  const lockTimeoutMs = options.lockTimeoutMs ?? 5000;
  const staleCheckGraceMs = options.staleCheckGraceMs ?? 100;
  const initialRetryDelayMs = options.initialRetryDelayMs ?? 5;
  const maxRetryDelayMs = options.maxRetryDelayMs ?? 25;

  const lockPath = path.join(jobsDirectory, `.${safeJobId}.lock`);
  const token = crypto.randomUUID();
  const deadline = Date.now() + lockTimeoutMs;
  let retryDelayMs = initialRetryDelayMs;
  let acquired = false;

  while (!acquired) {
    try {
      const handle = await fs.promises.open(lockPath, 'wx', 0o600);
      try {
        const payload: LockFilePayload = {
          pid: process.pid,
          token,
          acquiredAt: Date.now(),
        };
        await handle.writeFile(JSON.stringify(payload), 'utf-8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      acquired = true;
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== 'EEXIST') {
        throw err;
      }

      // Attempt safe reclamation ONLY if owning PID is definitively dead
      const reclaimed = await tryReclaimDeadProcessLock(lockPath, staleCheckGraceMs);
      if (reclaimed) {
        continue;
      }

      if (Date.now() >= deadline) {
        throw new Error(
          `SIDECAR_LOCK_TIMEOUT: Timed out after ${lockTimeoutMs}ms waiting for per-job lock "${safeJobId}".`
        );
      }

      // Bounded jittered sleep to avoid lockstep contention
      const jitter = Math.floor(Math.random() * 4);
      await sleep(Math.min(retryDelayMs + jitter, maxRetryDelayMs));
      retryDelayMs = Math.min(retryDelayMs * 2, maxRetryDelayMs);
    }
  }

  try {
    return await fn();
  } finally {
    // Owner-verified lock release
    try {
      const raw = await fs.promises.readFile(lockPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<LockFilePayload>;
      if (parsed.token === token) {
        await fs.promises.unlink(lockPath);
      }
    } catch (releaseErr: unknown) {
      const code = (releaseErr as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT') {
        // Fallback unlink if lockfile exists and couldn't be parsed, only if we acquired it
        try {
          await fs.promises.unlink(lockPath);
        } catch {
          // Ignore cleanup errors during unlock
        }
      }
    }
  }
}

/**
 * Writes JSON atomically using a unique temporary file in the same directory,
 * fsync + close before rename(2), and guaranteed temp-file cleanup on failure.
 */
export async function writeJsonAtomically(targetPath: string, data: unknown): Promise<void> {
  const dir = path.dirname(targetPath);
  const baseName = path.basename(targetPath, '.json');

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const tempPath = path.join(dir, `.${baseName}.${process.pid}.${crypto.randomUUID()}.tmp`);
  const serialized = JSON.stringify(data, null, 2);

  let handle: fs.promises.FileHandle | null = null;
  let renamed = false;

  try {
    handle = await fs.promises.open(tempPath, 'wx', 0o600);
    await handle.writeFile(serialized, 'utf-8');
    await handle.sync();
    await handle.close();
    handle = null;

    await fs.promises.rename(tempPath, targetPath);
    renamed = true;
  } finally {
    if (handle) {
      try {
        await handle.close();
      } catch {
        // Ignore close error during failure cleanup
      }
    }
    if (!renamed) {
      try {
        await fs.promises.unlink(tempPath);
      } catch {
        // Ignore ENOENT if temp file was never created
      }
    }
  }
}

export interface MergeSidecarResult<T extends SidecarRecordBase> {
  record: T;
  ignoredStaleTransition: boolean;
  reason?: string;
}

/**
 * Merges a status/metadata update onto the latest persisted sidecar record while enforcing:
 * 1. Terminal state immutability: COMPLETED and FAILED never regress to non-terminal states
 *    (and COMPLETED cannot flip to FAILED, nor FAILED to COMPLETED).
 * 2. Non-regression back to QUEUED once PROCESSING or VALIDATING has begun.
 * 3. Metadata preservation: undefined incoming fields never clobber persisted metadata;
 *    immutable identity fields (jobId, userId, storageKey, sha256Hash, enqueuedAt, etc.) are preserved.
 */
export function mergeJobSidecarRecord<T extends SidecarRecordBase>(
  existing: T,
  updates: Partial<Omit<T, 'jobId' | 'userId'>>
): MergeSidecarResult<T> {
  const incomingStatus = updates.status;

  // Rule 1: Terminal states (COMPLETED, FAILED) are strictly immutable once committed
  if (TERMINAL_STATUSES.has(existing.status)) {
    const targetDesc = incomingStatus ?? '(metadata-only update)';
    return {
      record: existing,
      ignoredStaleTransition: true,
      reason: `Ignored update "${targetDesc}" against committed terminal state "${existing.status}"`,
    };
  }

  // Rule 2: Prevent regressing from PROCESSING/VALIDATING back to QUEUED
  if (
    incomingStatus === 'QUEUED' &&
    (existing.status === 'PROCESSING' || existing.status === 'VALIDATING')
  ) {
    return {
      record: existing,
      ignoredStaleTransition: true,
      reason: `Ignored backward transition from "${existing.status}" to "QUEUED"`,
    };
  }

  // Rule 3: Merge only defined fields onto the latest persisted record (preserve existing metadata)
  const merged: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (
      key === 'jobId' ||
      key === 'userId' ||
      key === 'storageKey' ||
      key === 'sha256Hash' ||
      key === 'enqueuedAt'
    ) {
      continue;
    }
    merged[key] = value;
  }

  const nowIso = new Date().toISOString();
  merged.updatedAt = nowIso;
  if (merged.status === 'COMPLETED' && !merged.completedAt) {
    merged.completedAt = nowIso;
  }

  return {
    record: merged as T,
    ignoredStaleTransition: false,
  };
}
