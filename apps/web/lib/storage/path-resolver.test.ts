import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  findMonorepoRoot,
  resolveSharedStorageDir,
  resolveJobsDir,
  resolveStagingDir,
} from './path-resolver';
import { parseEnv } from '../env';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('ISS-04 Web Deterministic Shared Path Resolution & Startup Validation', () => {
  let tempRoot: string;
  let webDir: string;
  let workerDir: string;
  let regularFilePath: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stokiffy-web-paths-'));
    fs.writeFileSync(path.join(tempRoot, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n', 'utf-8');
    webDir = path.join(tempRoot, 'apps', 'web');
    workerDir = path.join(tempRoot, 'apps', 'worker');
    fs.mkdirSync(webDir, { recursive: true });
    fs.mkdirSync(workerDir, { recursive: true });
    regularFilePath = path.join(tempRoot, 'existing-file.csv');
    fs.writeFileSync(regularFilePath, 'Symbol,Revenue\nTCS,100\n', 'utf-8');
  });

  afterEach(() => {
    if (fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('resolves identical canonical JOBS_DIR and STAGING_DIR from repo root, apps/web, and apps/worker', () => {
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

  it('resolves relative overrides deterministically against monorepo root', () => {
    const webResolved = resolveSharedStorageDir({
      envValue: 'tmp/custom-staging',
      envName: 'STAGING_DIR',
      defaultSubdir: 'storage/staged',
      cwd: webDir,
    });
    const rootResolved = resolveSharedStorageDir({
      envValue: 'tmp/custom-staging',
      envName: 'STAGING_DIR',
      defaultSubdir: 'storage/staged',
      cwd: tempRoot,
    });

    expect(webResolved).toBe(path.join(tempRoot, 'tmp', 'custom-staging'));
    expect(webResolved).toBe(rootResolved);
  });

  it('fails fast on empty, whitespace-only, null-byte, and existing regular-file overrides', () => {
    expect(() =>
      resolveSharedStorageDir({
        envValue: '',
        envName: 'JOBS_DIR',
        defaultSubdir: 'storage/jobs',
        cwd: webDir,
      })
    ).toThrow(/CONFIG_VALIDATION_ERROR/);

    expect(() =>
      resolveSharedStorageDir({
        envValue: '   ',
        envName: 'STAGING_DIR',
        defaultSubdir: 'storage/staged',
        cwd: webDir,
      })
    ).toThrow(/CONFIG_VALIDATION_ERROR/);

    expect(() =>
      resolveSharedStorageDir({
        envValue: '/tmp/invalid\0dir',
        envName: 'JOBS_DIR',
        defaultSubdir: 'storage/jobs',
        cwd: webDir,
      })
    ).toThrow(/null byte/i);

    expect(() =>
      resolveSharedStorageDir({
        envValue: regularFilePath,
        envName: 'STAGING_DIR',
        defaultSubdir: 'storage/staged',
        cwd: webDir,
      })
    ).toThrow(/non-directory/i);
  });

  it('validates JOBS_DIR and STAGING_DIR at web startup via parseEnv()', () => {
    const valid = parseEnv({ NODE_ENV: 'test' }, webDir);
    expect(valid.JOBS_DIR).toBe(path.join(tempRoot, 'storage', 'jobs'));
    expect(valid.STAGING_DIR).toBe(path.join(tempRoot, 'storage', 'staged'));

    expect(() => parseEnv({ NODE_ENV: 'test', JOBS_DIR: '' }, webDir)).toThrow(
      /Stokiffy Config Error/
    );
    expect(() => parseEnv({ NODE_ENV: 'test', JOBS_DIR: '/tmp/null\0byte' }, webDir)).toThrow(
      /Stokiffy Config Error/
    );
    expect(() => parseEnv({ NODE_ENV: 'test', STAGING_DIR: regularFilePath }, webDir)).toThrow(
      /Stokiffy Config Error/
    );
  });

  it('produces identical default paths for web and worker in the real Stokiffy workspace', () => {
    const repoRoot = findMonorepoRoot(process.cwd());
    expect(repoRoot).not.toBeNull();

    const webJobs = resolveJobsDir(undefined, path.join(repoRoot!, 'apps', 'web'));
    const workerJobs = resolveJobsDir(undefined, path.join(repoRoot!, 'apps', 'worker'));
    const rootJobs = resolveJobsDir(undefined, repoRoot!);
    expect(webJobs).toBe(workerJobs);
    expect(webJobs).toBe(rootJobs);

    const webStaging = resolveStagingDir(undefined, path.join(repoRoot!, 'apps', 'web'));
    const workerStaging = resolveStagingDir(undefined, path.join(repoRoot!, 'apps', 'worker'));
    const rootStaging = resolveStagingDir(undefined, repoRoot!);
    expect(webStaging).toBe(workerStaging);
    expect(webStaging).toBe(rootStaging);
  });
});
