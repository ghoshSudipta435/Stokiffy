import { env } from './env';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_PRIORITIES: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
};

export interface LogContext {
  requestId?: string;
  userId?: string;
  companyId?: string;
  stage?: string;
  route?: string;
  durationMs?: number;
  [key: string]: unknown;
}

export class StructuredLogger {
  private minLevelPriority: number;
  private defaultContext?: LogContext;

  constructor(defaultContext?: LogContext) {
    const configuredLevel = (env.LOG_LEVEL || 'info') as LogLevel;
    this.minLevelPriority = LOG_LEVEL_PRIORITIES[configuredLevel] ?? 30;
    this.defaultContext = defaultContext;
  }

  withRequestId(requestId: string): StructuredLogger {
    return new StructuredLogger({
      ...this.defaultContext,
      requestId,
    });
  }

  private shouldLog(level: LogLevel): boolean {
    return (LOG_LEVEL_PRIORITIES[level] ?? 0) >= this.minLevelPriority;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext, err?: unknown): string {
    const entry = {
      timestamp: new Date().toISOString(),
      service: 'web',
      environment: env.NODE_ENV,
      level,
      message,
      ...this.defaultContext,
      ...context,
      ...(err instanceof Error ? {
        error: {
          name: err.name,
          message: err.message,
          stack: env.NODE_ENV === 'development' ? err.stack : undefined,
        },
      } : err ? { error: err } : {}),
    };
    return JSON.stringify(entry);
  }

  trace(message: string, context?: LogContext): void {
    if (this.shouldLog('trace')) {
      console.trace(this.formatMessage('trace', message, context));
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, context));
    }
  }

  warn(message: string, context?: LogContext, err?: unknown): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context, err));
    }
  }

  error(message: string, context?: LogContext, err?: unknown): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, context, err));
    }
  }
}

export const logger = new StructuredLogger();
