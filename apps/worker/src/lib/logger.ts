export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface WorkerLogPayload {
  timestamp: string;
  service: 'worker';
  level: LogLevel;
  message: string;
  jobId?: string;
  jobName?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  error?: string;
  stack?: string;
}

export class WorkerLogger {
  private service = 'worker' as const;
  private jobId?: string;
  private jobName?: string;

  constructor(jobId?: string, jobName?: string) {
    this.jobId = jobId;
    this.jobName = jobName;
  }

  public forJob(jobId: string, jobName: string): WorkerLogger {
    return new WorkerLogger(jobId, jobName);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>, err?: Error): void {
    const payload: WorkerLogPayload = {
      timestamp: new Date().toISOString(),
      service: this.service,
      level,
      message,
      jobId: this.jobId,
      jobName: this.jobName,
      metadata: meta,
      error: err ? err.message : undefined,
      stack: err ? err.stack : undefined,
    };

    const output = JSON.stringify(payload);
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  public error(message: string, metaOrError?: Record<string, unknown> | Error, errorObj?: Error): void {
    if (metaOrError instanceof Error) {
      this.log('error', message, undefined, metaOrError);
    } else {
      this.log('error', message, metaOrError, errorObj);
    }
  }
}

export const logger = new WorkerLogger();
