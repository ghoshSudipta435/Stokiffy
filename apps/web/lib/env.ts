import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { resolveSharedStorageDir } from './storage/path-resolver';

function loadEnvFile(envPath: string): void {
  if (!fs.existsSync(envPath)) return;
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  } catch {
    // Ignore read errors
  }
}

/**
 * Initializes environment variables for local development by searching
 * for the monorepo root `.env` / `.env.local` files if not already present.
 */
export function initEnv(): void {
  // If DATABASE_URL is already defined in environment (e.g. in CI or on Vercel), do nothing
  if (process.env.DATABASE_URL && process.env.ALLOW_PERSONAL_DEV_AUTH !== undefined) {
    return;
  }

  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(process.cwd(), '../..'),
  ];

  for (const dir of candidates) {
    const envPath = path.join(dir, '.env');
    if (fs.existsSync(envPath)) {
      loadEnvFile(path.join(dir, '.env.local'));
      loadEnvFile(envPath);
      break;
    }
  }
}

// Run immediately on module import
initEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Base URLs
  NEXTAUTH_URL: z.string().url().default('http://localhost:3000'),
  NEXTAUTH_SECRET: z.string().min(16).default('stokiffy-default-dev-secret-do-not-use-in-production-1234'),

  // Database connection (PostgreSQL via PgBouncer or direct)
  DATABASE_URL: z.string().default('postgresql://stokiffy:stokiffy_dev@localhost:5432/stokiffy_dev?schema=public'),

  // API prefix
  API_V1_PREFIX: z.string().default('/api/v1'),

  // Logging configuration
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),

  // Personal mode single-user enforcement flag
  PERSONAL_MODE: z.string().transform((v: string) => v === 'true').default('true'),
  ALLOW_PERSONAL_DEV_AUTH: z.string().default('true'),

  // Shared local staging & job status directories (optional explicit overrides)
  JOBS_DIR: z.string().optional(),
  STAGING_DIR: z.string().optional(),
});

export type Env = Omit<z.infer<typeof envSchema>, 'JOBS_DIR' | 'STAGING_DIR'> & {
  JOBS_DIR: string;
  STAGING_DIR: string;
};

export function parseEnv(sourceEnv: Record<string, string | undefined> = process.env, cwd?: string): Env {
  const result = envSchema.safeParse(sourceEnv);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err: { path: (string | number)[]; message: string }) => `${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`[Stokiffy Config Error] Environment variable validation failed:\n${errorDetails}`);
  }

  let resolvedJobsDir: string;
  let resolvedStagingDir: string;
  try {
    resolvedJobsDir = resolveSharedStorageDir({
      envValue: result.data.JOBS_DIR,
      envName: 'JOBS_DIR',
      defaultSubdir: 'storage/jobs',
      cwd,
    });
    resolvedStagingDir = resolveSharedStorageDir({
      envValue: result.data.STAGING_DIR,
      envName: 'STAGING_DIR',
      defaultSubdir: 'storage/staged',
      cwd,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[Stokiffy Config Error] Environment variable validation failed:\n${message}`);
  }

  return {
    ...result.data,
    JOBS_DIR: resolvedJobsDir,
    STAGING_DIR: resolvedStagingDir,
  };
}

export const env = parseEnv();
