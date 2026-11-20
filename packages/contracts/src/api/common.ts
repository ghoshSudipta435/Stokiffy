/**
 * Uniform API response and error envelopes.
 * Mirrors API_ARCHITECTURE.md Section 3.
 */

import { z } from 'zod';

/**
 * Request metadata included in every API envelope.
 */
export const RequestMetaSchema = z.object({
  requestId: z.string(),
  timestamp: z.string().datetime(),
  version: z.string().default('1.0.0'),
});
export type RequestMeta = z.infer<typeof RequestMetaSchema>;

/**
 * Error detail item for field-level validation errors.
 */
export const ErrorDetailSchema = z.object({
  field: z.string(),
  value: z.unknown().optional(),
  threshold: z.unknown().optional(),
  message: z.string(),
});
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;

/**
 * Error envelope body (RFC 7807 compliant).
 */
export const ErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.array(ErrorDetailSchema).default([]),
  requestId: z.string(),
  timestamp: z.string().datetime(),
});
export type ErrorBody = z.infer<typeof ErrorBodySchema>;

/**
 * Success envelope for single data responses.
 */
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: RequestMetaSchema,
  });
export type ApiResponse<T> = {
  success: true;
  data: T;
  meta: RequestMeta;
};

/**
 * Error envelope for failed responses.
 */
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: ErrorBodySchema,
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Pagination cursor parameters.
 */
export const PaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Paginated success envelope.
 */
export const PaginatedApiResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T
) =>
  z.object({
    success: z.literal(true),
    data: z.array(dataSchema),
    pagination: z.object({
      cursor: z.string().optional(),
      limit: z.number().int().positive(),
      hasMore: z.boolean(),
      totalCount: z.number().int().nonnegative(),
    }),
    meta: RequestMetaSchema,
  });
export type PaginatedApiResponse<T> = {
  success: true;
  data: T[];
  pagination: {
    cursor: string | undefined;
    limit: number;
    hasMore: boolean;
    totalCount: number;
  };
  meta: RequestMeta;
};

/**
 * Standard HTTP error codes.
 */
export const HttpErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;
