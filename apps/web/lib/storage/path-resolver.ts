import fs from 'node:fs';
import path from 'node:path';

export type SharedStorageEnvName = 'JOBS_DIR' | 'STAGING_DIR';
export type SharedStorageSubdir = 'storage/jobs' | 'storage/staged';

const MAX_ROOT_WALK_DEPTH = 10;

/**
 * Walks upward from startDir looking for the monorepo workspace marker (pnpm-workspace.yaml).
 * Returns the canonical monorepo root path, or null if not found.
 */
export function findMonorepoRoot(startDir: string = process.cwd()): string | null {
  let current = path.resolve(startDir);

  for (let depth = 0; depth <= MAX_ROOT_WALK_DEPTH; depth++) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return null;
}

/**
 * Validates and resolves an explicit directory path override.
 * Fails fast on empty/whitespace-only values, null bytes, or paths pointing to regular files.
 */
export function validateDirectoryPath(rawPath: string, label: string, baseDir: string): string {
  if (rawPath.includes('\0')) {
    throw new Error(`CONFIG_VALIDATION_ERROR: ${label} contains illegal null byte.`);
  }

  const trimmed = rawPath.trim();
  if (trimmed.length === 0) {
    throw new Error(`CONFIG_VALIDATION_ERROR: ${label} cannot be empty or whitespace-only.`);
  }

  const resolved = path.isAbsolute(trimmed) ? path.resolve(trimmed) : path.resolve(baseDir, trimmed);

  if (fs.existsSync(resolved)) {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      throw new Error(
        `CONFIG_VALIDATION_ERROR: ${label} points to an existing non-directory file; expected a directory.`
      );
    }
  }

  return resolved;
}

export interface ResolveSharedDirOptions {
  explicitDir?: string;
  envValue?: string;
  envName: SharedStorageEnvName;
  defaultSubdir: SharedStorageSubdir;
  cwd?: string;
}

/**
 * Deterministic shared directory resolution for web and worker.
 *
 * Precedence:
 * 1. Explicit constructor override (`explicitDir`) — validated strictly.
 * 2. Explicit environment variable (`envValue`) — validated strictly (fails fast if invalid).
 * 3. Canonical default: `<monorepoRoot>/<defaultSubdir>` when `pnpm-workspace.yaml` is found,
 *    otherwise deterministic fallback `<cwd>/<defaultSubdir>`.
 */
export function resolveSharedStorageDir(options: ResolveSharedDirOptions): string {
  const effectiveCwd = path.resolve(options.cwd ?? process.cwd());
  const baseDir = findMonorepoRoot(effectiveCwd) ?? effectiveCwd;

  if (options.explicitDir !== undefined) {
    return validateDirectoryPath(options.explicitDir, options.envName, baseDir);
  }

  if (options.envValue !== undefined) {
    return validateDirectoryPath(options.envValue, options.envName, baseDir);
  }

  return path.resolve(baseDir, options.defaultSubdir);
}

export function resolveJobsDir(explicitDir?: string, cwd?: string): string {
  return resolveSharedStorageDir({
    explicitDir,
    envValue: process.env.JOBS_DIR,
    envName: 'JOBS_DIR',
    defaultSubdir: 'storage/jobs',
    cwd,
  });
}

export function resolveStagingDir(explicitDir?: string, cwd?: string): string {
  return resolveSharedStorageDir({
    explicitDir,
    envValue: process.env.STAGING_DIR,
    envName: 'STAGING_DIR',
    defaultSubdir: 'storage/staged',
    cwd,
  });
}
