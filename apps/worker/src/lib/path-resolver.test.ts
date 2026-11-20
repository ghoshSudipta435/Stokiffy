import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  findMonorepoRoot,
  resolveSharedStorageDir,
  resolveJobsDir,
  resolveStagingDir,
} from './path-resolver.js';
import { parseEnv } from '../config/env.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('ISS-04 Worker Deterministic Shared Path Resolution & Startup Validation', () => {
  let tempRoot: string;
  let webDir: string;
  let workerDir: string;
  let regularFilePath: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stokiffy-worker-paths-'));
    fs.writeFileSync(path.join(tempRoot, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n', 'utf-8');
    webDir = path.join(tempRoot, 'apps', 'web');
    workerDir = path.join(tempRoot, 'apps', 'worker');
    fs.mkdirSync(webDir, { recursive: true });
    fs.mkdirSync(workerDir, { recursive: true });
    regularFilePath = path.join(tempRoot, 'not-a-dir.txt');
    fs.writeFileSync(regularFilePath, 'file-content', 'utf-8');
  });

  afterEach(() => {
    if (fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('discovers monorepo root identically from repo root, apps/web, and apps/worker', () => {
    expect(findMonorepoRoot(tempRoot)).toBe(tempRoot);
    expect(findMonorepoRoot(webDir)).toBe(tempRoot);
    expect(findMonorepoRoot(workerDir)).toBe(tempRoot);
  });

  it('resolves identical canonical JOBS_DIR and STAGING_DIR from all three launch contexts', () => {
    const expectedJobs = path.join(tempRoot, 'storage', 'jobs');
    const expectedStaging = path.join(tempRoot, 'storage', 'staged');

    for (const cwd of [tempRoot, webDir, workerDir]) {
      expect(
        resolveSharedStorageDir({
          envName: 'JOBS_DIR',
          defaultSubdir: 'storage/jobs',
          cwd,
        })
      ).toBe(expectedJobs);

      expect(
        resolveSharedStorageDir({
          envName: 'STAGING_DIR',
          defaultSubdir: 'storage/staged',
          cwd,
        })
      ).toBe(expectedStaging);
    }
  });

  it('resolves relative overrides deterministically against monorepo root regardless of cwd', () => {
    const fromRoot = resolveSharedStorageDir({
      envValue: './custom/jobs',
      envName: 'JOBS_DIR',
      defaultSubdir: 'storage/jobs',
      cwd: tempRoot,
    });
    const fromWorker = resolveSharedStorageDir({
      envValue: './custom/jobs',
      envName: 'JOBS_DIR',
      defaultSubdir: 'storage/jobs',
      cwd: workerDir,
    });

    expect(fromRoot).toBe(path.join(tempRoot, 'custom', 'jobs'));
    expect(fromWorker).toBe(fromRoot);
  });

  it('fails fast on empty, whitespace-only, null-byte, and existing regular-file overrides', () => {
    expect(() =>
      resolveSharedStorageDir({
        envValue: '',
        envName: 'JOBS_DIR',
        defaultSubdir: 'storage/jobs',
        cwd: workerDir,
      })
    ).toThrow(/CONFIG_VALIDATION_ERROR/);

    expect(() =>
      resolveSharedStorageDir({
        envValue: '   \t  ',
        envName: 'JOBS_DIR',
        defaultSubdir: 'storage/jobs',
        cwd: workerDir,
      })
    ).toThrow(/CONFIG_VALIDATION_ERROR/);

    expect(() =>
      resolveSharedStorageDir({
        envValue: '/tmp/bad\0path',
        envName: 'STAGING_DIR',
        defaultSubdir: 'storage/staged',
        cwd: workerDir,
      })
    ).toThrow(/null byte/i);

    expect(() =>
      resolveSharedStorageDir({
        envValue: regularFilePath,
        envName: 'JOBS_DIR',
        defaultSubdir: 'storage/jobs',
        cwd: workerDir,
      })
    ).toThrow(/non-directory/i);
  });

  it('validates JOBS_DIR and STAGING_DIR at worker startup via parseEnv()', () => {
    const valid = parseEnv({ NODE_ENV: 'test' }, workerDir);
    expect(valid.JOBS_DIR).toBe(path.join(tempRoot, 'storage', 'jobs'));
    expect(valid.STAGING_DIR).toBe(path.join(tempRoot, 'storage', 'staged'));

    expect(() => parseEnv({ NODE_ENV: 'test', JOBS_DIR: '   ' }, workerDir)).toThrow(
      /Worker environment validation failed/
    );
    expect(() => parseEnv({ NODE_ENV: 'test', STAGING_DIR: regularFilePath }, workerDir)).toThrow(
      /Worker environment validation failed/
    );
  });

  it('resolves Stokiffy repo root consistently via resolveJobsDir and resolveStagingDir', () => {
    const repoRoot = findMonorepoRoot(process.cwd());
    expect(repoRoot).not.toBeNull();
    expect(resolveJobsDir(undefined, path.join(repoRoot!, 'apps', 'worker'))).toBe(
      path.join(repoRoot!, 'storage', 'jobs')
    );
    expect(resolveStagingDir(undefined, path.join(repoRoot!, 'apps', 'worker'))).toBe(
      path.join(repoRoot!, 'storage', 'staged')
    );
  });
});
