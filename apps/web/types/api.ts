/**
 * Core API response envelopes and error types
 * Aligns with docs/architecture/API_ARCHITECTURE.md Section 3
 */

export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  version: string;
}

export interface PaginationMeta {
  cursor?: string | null;
  limit: number;
  hasMore: boolean;
  totalCount?: number;
}

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta: ResponseMeta;
}

export interface PaginatedApiResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
  meta: ResponseMeta;
}

export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RESOURCE_NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'RATE_LIMITED'
  | 'INTERNAL_SERVER_ERROR';

export interface ErrorDetail {
  field?: string;
  value?: unknown;
  threshold?: unknown;
  message: string;
}

export interface ApiErrorPayload {
  code: ApiErrorCode;
  message: string;
  details?: ErrorDetail[];
  requestId: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
}
