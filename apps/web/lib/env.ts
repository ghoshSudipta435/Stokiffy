import { z } from 'zod';
import { resolveSharedStorageDir } from './storage/path-resolver';

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
