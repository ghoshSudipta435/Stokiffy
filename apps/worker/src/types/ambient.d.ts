declare module 'pg-boss' {
  export interface Job<T = unknown> {
    id: string;
    name: string;
    data: T;
    expireInSeconds?: number;
    retryLimit?: number;
    retryCount?: number;
    retryDelay?: number;
    retryBackoff?: boolean;
  }

  export interface WorkOptions {
    batchSize?: number;
    includeMetadata?: boolean;
    priority?: boolean;
    pollingIntervalSeconds?: number;
  }

  export interface SendOptions {
    retryLimit?: number;
    retryDelay?: number;
    retryBackoff?: boolean;
    startAfter?: number | string | Date;
  }

  export interface ScheduleOptions {
    tz?: string;
  }

  export default class PgBoss {
    constructor(options?: {
      connectionString?: string;
      archiveCompletedAfterSeconds?: number;
      deleteAfterDays?: number;
      retentionMinutes?: number;
    });
    start(): Promise<PgBoss>;
    stop(options?: { graceful?: boolean; timeout?: number }): Promise<void>;
    send(name: string, data: object, options?: SendOptions): Promise<string | null>;
    work<T = unknown>(name: string, options: WorkOptions, handler: (jobs: Job<T>[]) => Promise<void>): Promise<string>;
    cancel(name: string, id: string | string[]): Promise<void>;
    complete(name: string, id: string | string[], data?: object): Promise<void>;
    fail(name: string, id: string | string[], data?: object): Promise<void>;
    schedule(name: string, cron: string, data: object, options?: ScheduleOptions): Promise<void>;
    on(event: string, handler: (error: Error) => void): void;
  }
}

declare module 'dotenv' {
  export function config(options?: object): { parsed?: Record<string, string>; error?: Error };
}

declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
  interface Process {
    env: ProcessEnv;
    uptime(): number;
    exit(code?: number): never;
    on(event: string, listener: (...args: any[]) => void): this;
  }
}

declare const process: NodeJS.Process;
