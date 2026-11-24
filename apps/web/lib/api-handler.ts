import './env';
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from './logger';
import { createErrorResponse } from './api-response';
import type { ErrorDetail } from '../types/api';

export type RouteHandlerContext = {
  params?: Record<string, string | string[]>;
};

export type RouteHandlerFn = (
  req: NextRequest,
  context: { requestId: string; params: Record<string, string | string[]> }
) => Promise<NextResponse>;

/**
 * Standardized API Route Handler Wrapper
 * - Extracts or generates x-request-id
 * - Records latency
 * - Logs request lifecycle with structured JSON
 * - Catches ZodError and standardizes to VALIDATION_FAILED (400)
 * - Catches unhandled errors and maps to INTERNAL_SERVER_ERROR (500)
 */
export function apiHandler(handler: RouteHandlerFn) {
  return async (req: NextRequest, context?: RouteHandlerContext): Promise<NextResponse> => {
    const startTime = performance.now();
    const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
    const params = context?.params || {};

    const reqLogger = logger.withRequestId(requestId);
    reqLogger.info(`Incoming ${req.method} ${req.nextUrl.pathname}`, {
      method: req.method,
      path: req.nextUrl.pathname,
      query: Object.fromEntries(req.nextUrl.searchParams.entries()),
    });

    try {
      const response = await handler(req, { requestId, params });
      const durationMs = Math.round(performance.now() - startTime);

      reqLogger.info(`Completed ${req.method} ${req.nextUrl.pathname} with ${response.status}`, {
        method: req.method,
        path: req.nextUrl.pathname,
        status: response.status,
        durationMs,
      });

      // Ensure X-Request-Id header is present on outgoing response
      response.headers.set('X-Request-Id', requestId);
      return response;
    } catch (err: unknown) {
      const durationMs = Math.round(performance.now() - startTime);

      if (err instanceof ZodError) {
        const details: ErrorDetail[] = (err as ZodError).errors.map((e: { path: (string | number)[]; message: string }) => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        reqLogger.warn(`Validation failed on ${req.method} ${req.nextUrl.pathname}`, {
          durationMs,
          errors: details,
        });

        return createErrorResponse(
          'VALIDATION_FAILED',
          'Request validation failed',
          400,
          requestId,
          details
        );
      }

      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      const stack = err instanceof Error ? err.stack : undefined;

      reqLogger.error(`Unhandled error on ${req.method} ${req.nextUrl.pathname}: ${errorMessage}`, {
        durationMs,
        error: errorMessage,
        stack,
      });

      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        'An unexpected internal server error occurred',
        500,
        requestId
      );
    }
  };
}
