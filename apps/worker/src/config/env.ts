import { z } from 'zod';
import { resolveSharedStorageDir } from '../lib/path-resolver.js';

// Load .env if present using Node.js native env loader
try {
  if (typeof (process as unknown as { loadEnvFile?: () => void }).loadEnvFile === 'function') {
    (process as unknown as { loadEnvFile: () => void }).loadEnvFile();
  }
} catch {
  // Ignore missing .env file in environments where variables are passed directly
}

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection URL'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
  WORKER_POLL_INTERVAL_SECONDS: z.coerce.number().int().min(1).max(60).default(2),
  WORKER_DRAIN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  JOBS_DIR: z.string().optional(),
  STAGING_DIR: z.string().optional(),
});

export type WorkerEnv = Omit<z.infer<typeof envSchema>, 'JOBS_DIR' | 'STAGING_DIR'> & {
  JOBS_DIR: string;
  STAGING_DIR: string;
};

export function parseEnv(
  sourceEnv: Record<string, string | undefined> = process.env,
  cwd?: string
): WorkerEnv {
  const result = envSchema.safeParse({
    DATABASE_URL: sourceEnv.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/stokiffy',
    NODE_ENV: sourceEnv.NODE_ENV,
    WORKER_CONCURRENCY: sourceEnv.WORKER_CONCURRENCY,
    WORKER_POLL_INTERVAL_SECONDS: sourceEnv.WORKER_POLL_INTERVAL_SECONDS,
    WORKER_DRAIN_TIMEOUT_MS: sourceEnv.WORKER_DRAIN_TIMEOUT_MS,
    LOG_LEVEL: sourceEnv.LOG_LEVEL,
    JOBS_DIR: sourceEnv.JOBS_DIR,
    STAGING_DIR: sourceEnv.STAGING_DIR,
  });

  if (!result.success) {
    const errorDetails = result.error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
    console.error(`[WORKER_CONFIG_ERROR] Invalid worker environment configuration:\n${errorDetails}`);
    throw new Error('Worker environment validation failed');
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
    console.error(`[WORKER_CONFIG_ERROR] Invalid worker storage configuration: ${message}`);
    throw new Error(`Worker environment validation failed: ${message}`);
  }

  return {
    ...result.data,
    JOBS_DIR: resolvedJobsDir,
    STAGING_DIR: resolvedStagingDir,
  };
}

export const env = parseEnv();
