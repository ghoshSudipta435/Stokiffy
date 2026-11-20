import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mergeJobSidecarRecord,
  withJobSidecarLock,
  writeJsonAtomically,
  type SidecarRecordBase,
} from './sidecar-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SIDECAR_STORE_TS_URL = pathToFileURL(path.resolve(__dirname, 'sidecar-store.ts')).href;

function makeBaseRecord(overrides: Partial<SidecarRecordBase> = {}): SidecarRecordBase {
  const now = new Date().toISOString();
  return {
    jobId: 'job_unit_01',
    storageKey: 'stage_00000000-0000-0000-0000-000000000001',
    fileName: 'sample.csv',
    fileSizeBytes: 256,
    sha256Hash: 'hash_unit_01',
    userId: 'tenant_unit',
    fileType: 'GENERIC_CSV',
    status: 'QUEUED',
    queue: 'file-ingestion',
    enqueuedAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('Cycle 2B-R3: Single-Host Sidecar Store (Locking, Atomic Writes, Transition Guards & Cross-Process Contention)', () => {
  let tempJobsDir: string;

  beforeEach(() => {
    tempJobsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stokiffy-sidecar-store-'));
  });

  afterEach(() => {
    fs.rmSync(tempJobsDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('releases the per-job lock reliably when the critical section throws an exception', async () => {
    await expect(
      withJobSidecarLock(tempJobsDir, 'job_throw_01', async () => {
        throw new Error('BOOM_INSIDE_CRITICAL_SECTION');
      })
    ).rejects.toThrow('BOOM_INSIDE_CRITICAL_SECTION');

    // Lockfile must be cleaned up immediately
    const locksAfterFailure = fs.readdirSync(tempJobsDir).filter((f) => f.endsWith('.lock'));
    expect(locksAfterFailure).toHaveLength(0);

    // Subsequent caller acquires immediately without blocking
    const nextResult = await withJobSidecarLock(
      tempJobsDir,
      'job_throw_01',
      async () => 'acquired-after-throw',
      { lockTimeoutMs: 250 }
    );
    expect(nextResult).toBe('acquired-after-throw');
  });

  it('uses per-job locks so an unrelated job is never blocked by a held lock', async () => {
    let releaseAlpha!: () => void;
    const alphaGate = new Promise<void>((resolve) => {
      releaseAlpha = resolve;
    });
    let alphaEntered!: () => void;
    const alphaStarted = new Promise<void>((resolve) => {
      alphaEntered = resolve;
    });

    const alphaPromise = withJobSidecarLock(tempJobsDir, 'job_alpha', async () => {
      alphaEntered();
      await alphaGate;
      return 'alpha-done';
    });

    await alphaStarted;

    // Unrelated job_beta must complete immediately while job_alpha holds its lock
    const betaResult = await withJobSidecarLock(
      tempJobsDir,
      'job_beta',
      async () => 'beta-done',
      { lockTimeoutMs: 250 }
    );
    expect(betaResult).toBe('beta-done');

    releaseAlpha();
    expect(await alphaPromise).toBe('alpha-done');
    expect(fs.readdirSync(tempJobsDir).filter((f) => f.endsWith('.lock'))).toHaveLength(0);
  });

  it('cleans up temporary files and preserves target JSON if atomic rename fails', async () => {
    const targetPath = path.join(tempJobsDir, 'job_atomic_fail.json');
    const originalRecord = makeBaseRecord({ jobId: 'job_atomic_fail', status: 'PROCESSING' });
    await writeJsonAtomically(targetPath, originalRecord);

    const renameSpy = vi
      .spyOn(fs.promises, 'rename')
      .mockRejectedValueOnce(new Error('SIMULATED_RENAME_FAILURE'));

    try {
      await expect(
        writeJsonAtomically(targetPath, { ...originalRecord, status: 'COMPLETED' })
      ).rejects.toThrow('SIMULATED_RENAME_FAILURE');
    } finally {
      renameSpy.mockRestore();
    }

    // Original JSON must remain intact and valid
    const persisted = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
    expect(persisted.status).toBe('PROCESSING');

    // No orphaned .tmp files remain
    const leftovers = fs.readdirSync(tempJobsDir).filter((f) => f.endsWith('.tmp'));
    expect(leftovers).toHaveLength(0);
  });

  it('never breaks a lock held by a live local PID and times out deterministically', async () => {
    const lockPath = path.join(tempJobsDir, '.job_live_lock.lock');
    const oldTime = new Date(Date.now() - 10_000);
    fs.writeFileSync(
      lockPath,
      JSON.stringify({ pid: process.pid, token: 'live-owner-token', acquiredAt: oldTime.getTime() }),
      'utf-8'
    );
    fs.utimesSync(lockPath, oldTime, oldTime);

    await expect(
      withJobSidecarLock(
        tempJobsDir,
        'job_live_lock',
        async () => 'should-not-run',
        { lockTimeoutMs: 120, staleCheckGraceMs: 10, initialRetryDelayMs: 5, maxRetryDelayMs: 15 }
      )
    ).rejects.toThrow(/SIDECAR_LOCK_TIMEOUT/);

    // Live lock must still exist untouched with original owner token
    const stillPresent = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
    expect(stillPresent.pid).toBe(process.pid);
    expect(stillPresent.token).toBe('live-owner-token');
  });

  it('safely reclaims a stale lock belonging to a definitively dead local PID (ESRCH)', async () => {
    // Spawn a short-lived process and wait for exit to obtain a definitively dead PID
    const exited = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
    const deadPid = exited.pid!;
    expect(deadPid).toBeGreaterThan(0);

    // Confirm OS reports ESRCH for this PID
    let isDead = false;
    try {
      process.kill(deadPid, 0);
    } catch (err: unknown) {
      isDead = (err as NodeJS.ErrnoException)?.code === 'ESRCH';
    }
    expect(isDead).toBe(true);

    const lockPath = path.join(tempJobsDir, '.job_dead_lock.lock');
    const oldTime = new Date(Date.now() - 5_000);
    fs.writeFileSync(
      lockPath,
      JSON.stringify({ pid: deadPid, token: 'dead-owner-token', acquiredAt: oldTime.getTime() }),
      'utf-8'
    );
    fs.utimesSync(lockPath, oldTime, oldTime);

    const result = await withJobSidecarLock(
      tempJobsDir,
      'job_dead_lock',
      async () => 'reclaimed-dead-lock',
      { lockTimeoutMs: 1000, staleCheckGraceMs: 20 }
    );
    expect(result).toBe('reclaimed-dead-lock');

    // No lock or reclaim artifacts remain
    const leftovers = fs
      .readdirSync(tempJobsDir)
      .filter((f) => f.includes('.lock') || f.includes('.reclaim'));
    expect(leftovers).toHaveLength(0);
  });

  it('enforces mergeJobSidecarRecord terminal immutability and non-regression rules', () => {
    const base = makeBaseRecord({ status: 'PROCESSING', message: 'Running' });

    // Prevent regression to QUEUED
    const backToQueued = mergeJobSidecarRecord(base, { status: 'QUEUED', message: 'Stale enqueue' });
    expect(backToQueued.ignoredStaleTransition).toBe(true);
    expect(backToQueued.record.status).toBe('PROCESSING');

    // Legitimate transition PROCESSING -> VALIDATING -> PROCESSING -> COMPLETED
    const validating = mergeJobSidecarRecord(base, { status: 'VALIDATING', message: 'Checking' });
    expect(validating.ignoredStaleTransition).toBe(false);
    expect(validating.record.status).toBe('VALIDATING');

    const retryProcessing = mergeJobSidecarRecord(validating.record, {
      status: 'PROCESSING',
      message: 'Retry 2',
    });
    expect(retryProcessing.ignoredStaleTransition).toBe(false);
    expect(retryProcessing.record.status).toBe('PROCESSING');

    const completed = mergeJobSidecarRecord(retryProcessing.record, {
      status: 'COMPLETED',
      processedCount: 15,
      validRowCount: 15,
      completedAt: '2026-11-18T14:40:00.000Z',
    });
    expect(completed.ignoredStaleTransition).toBe(false);
    expect(completed.record.status).toBe('COMPLETED');
    expect(completed.record.processedCount).toBe(15);

    // Terminal COMPLETED cannot regress to PROCESSING, FAILED, or accept metadata-only error mutation
    const regressToProc = mergeJobSidecarRecord(completed.record, {
      status: 'PROCESSING',
      message: 'Late stale pulse',
    });
    expect(regressToProc.ignoredStaleTransition).toBe(true);
    expect(regressToProc.record.status).toBe('COMPLETED');
    expect(regressToProc.record.processedCount).toBe(15);

    const flipToFailed = mergeJobSidecarRecord(completed.record, {
      status: 'FAILED',
      error: 'Late error',
    });
    expect(flipToFailed.ignoredStaleTransition).toBe(true);
    expect(flipToFailed.record.status).toBe('COMPLETED');
    expect(flipToFailed.record.error).toBeUndefined();
  });

  it('prevents torn JSON and lost updates across two independent OS processes contending on the exact same sidecar', async () => {
    const jobId = 'job_xproc_01';
    const targetPath = path.join(tempJobsDir, `${jobId}.json`);
    const unrelatedPath = path.join(tempJobsDir, 'job_xproc_unrelated.json');
    const barrierPath = path.join(tempJobsDir, 'start.barrier');
    const completedAt = '2026-11-18T14:45:00.000Z';

    const initialRecord = makeBaseRecord({
      jobId,
      userId: 'tenant_xproc',
      status: 'QUEUED',
    });
    const unrelatedRecord = makeBaseRecord({
      jobId: 'job_xproc_unrelated',
      userId: 'tenant_other_xproc',
      status: 'QUEUED',
      message: 'Must remain untouched',
    });

    await writeJsonAtomically(targetPath, initialRecord);
    await writeJsonAtomically(unrelatedPath, unrelatedRecord);
    const unrelatedSnapshotBefore = fs.readFileSync(unrelatedPath, 'utf-8');

    // Child process script using the real sidecar-store module via Node native TypeScript execution
    const childScript = `
      import fs from 'node:fs';
      import path from 'node:path';
      import {
        withJobSidecarLock,
        mergeJobSidecarRecord,
        writeJsonAtomically,
      } from ${JSON.stringify(SIDECAR_STORE_TS_URL)};

      const jobsDir = process.env.TEST_JOBS_DIR;
      const jobId = process.env.TEST_JOB_ID;
      const role = process.env.TEST_ROLE;
      const barrierPath = process.env.TEST_BARRIER_PATH;
      const completedAt = process.env.TEST_COMPLETED_AT;
      const targetPath = path.join(jobsDir, jobId + '.json');

      // Wait for synchronized start barrier so both OS processes contend simultaneously
      while (!fs.existsSync(barrierPath)) {
        await new Promise((r) => setTimeout(r, 5));
      }

      const iterations = 20;
      for (let i = 0; i < iterations; i++) {
        let updates;
        if (role === 'worker') {
          if (i === 10) {
            updates = {
              status: 'COMPLETED',
              message: 'Worker finished cleanly on iteration 10',
              processedCount: 42,
              validRowCount: 42,
              warningsCount: 0,
              completedAt,
            };
          } else if (i % 2 === 0) {
            updates = {
              status: 'PROCESSING',
              message: ('Worker long payload ' + i + ' ').repeat(25),
            };
          } else {
            updates = {
              status: 'VALIDATING',
              message: 'Short ' + i,
            };
          }
        } else {
          // Competing OS process (simulating web or overlapping worker process)
          if (i % 3 === 0) {
            updates = {
              status: 'PROCESSING',
              message: ('Web contender payload ' + i + ' ').repeat(18),
            };
          } else if (i % 3 === 1) {
            updates = {
              status: 'VALIDATING',
              message: 'Web validate ' + i,
            };
          } else {
            updates = {
              status: 'QUEUED',
              message: 'Stale queue event ' + i,
            };
          }
        }

        await withJobSidecarLock(jobsDir, jobId, async () => {
          const raw = await fs.promises.readFile(targetPath, 'utf-8');
          const existing = JSON.parse(raw);
          const merged = mergeJobSidecarRecord(existing, updates);
          if (!merged.ignoredStaleTransition) {
            await writeJsonAtomically(targetPath, merged.record);
          }
        });
      }
    `;

    const spawnContender = (role: 'worker' | 'web') =>
      new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ['--experimental-strip-types', '--input-type=module', '-e', childScript],
          {
            env: {
              ...process.env,
              TEST_JOBS_DIR: tempJobsDir,
              TEST_JOB_ID: jobId,
              TEST_ROLE: role,
              TEST_BARRIER_PATH: barrierPath,
              TEST_COMPLETED_AT: completedAt,
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          }
        );

        let stderr = '';
        child.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
        });
        child.on('error', reject);
        child.on('close', (code) => resolve({ code, stderr }));
      });

    const procA = spawnContender('worker');
    const procB = spawnContender('web');

    // Give both OS processes a brief moment to boot and reach the barrier, then release together
    await new Promise((r) => setTimeout(r, 150));
    fs.writeFileSync(barrierPath, 'GO', 'utf-8');

    // Concurrently poll-read the sidecar from the parent OS process throughout contention
    // to verify readers NEVER observe torn/partial JSON during atomic renames.
    let done = false;
    let successfulReads = 0;
    const parseErrors: string[] = [];

    const readerLoop = (async () => {
      while (!done) {
        try {
          const raw = fs.readFileSync(targetPath, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed.jobId !== jobId) {
            parseErrors.push(`Unexpected jobId: ${parsed.jobId}`);
          }
          successfulReads += 1;
        } catch (err: unknown) {
          parseErrors.push(err instanceof Error ? err.message : String(err));
        }
        await new Promise((r) => setTimeout(r, 2));
      }
    })();

    const [resA, resB] = await Promise.all([procA, procB]);
    done = true;
    await readerLoop;

    // Remove test barrier file before checking leftover store artifacts
    fs.unlinkSync(barrierPath);

    expect(resA.code, `Worker contender stderr:\n${resA.stderr}`).toBe(0);
    expect(resB.code, `Web contender stderr:\n${resB.stderr}`).toBe(0);
    expect(successfulReads).toBeGreaterThan(0);
    expect(parseErrors).toEqual([]);

    // Final sidecar JSON must be valid and preserve COMPLETED + full metadata
    const finalRecord = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
    expect(finalRecord.status).toBe('COMPLETED');
    expect(finalRecord.userId).toBe('tenant_xproc');
    expect(finalRecord.processedCount).toBe(42);
    expect(finalRecord.validRowCount).toBe(42);
    expect(finalRecord.warningsCount).toBe(0);
    expect(finalRecord.completedAt).toBe(completedAt);

    // Unrelated sidecar untouched
    expect(fs.readFileSync(unrelatedPath, 'utf-8')).toBe(unrelatedSnapshotBefore);

    // Zero leftover lock, reclaim, or temp files
    const leftovers = fs
      .readdirSync(tempJobsDir)
      .filter((f) => f.endsWith('.tmp') || f.endsWith('.lock') || f.includes('.reclaim'));
    expect(leftovers).toHaveLength(0);
  }, 20_000);
});
