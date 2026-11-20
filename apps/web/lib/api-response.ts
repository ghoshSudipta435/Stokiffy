import { NextResponse } from 'next/server';
import type { 
  ApiResponse, 
  PaginatedApiResponse, 
  ApiErrorResponse, 
  ApiErrorCode, 
  PaginationMeta, 
  ErrorDetail 
} from '../types/api';

const API_VERSION = '1.0.0';

export function createSuccessResponse<T>(
  data: T,
  requestId: string,
  status = 200
): NextResponse<ApiResponse<T>> {
  const body: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      version: API_VERSION,
    },
  };
  return NextResponse.json(body, { 
    status,
    headers: {
      'X-Request-Id': requestId,
      'Content-Type': 'application/json',
    },
  });
}

export function createPaginatedResponse<T>(
  data: T[],
  pagination: PaginationMeta,
  requestId: string,
  status = 200
): NextResponse<PaginatedApiResponse<T>> {
  const body: PaginatedApiResponse<T> = {
    success: true,
    data,
    pagination,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      version: API_VERSION,
    },
  };
  return NextResponse.json(body, {
    status,
    headers: {
      'X-Request-Id': requestId,
      'Content-Type': 'application/json',
    },
  });
}

export function createErrorResponse(
  code: ApiErrorCode,
  message: string,
  status: number,
  requestId: string,
  details?: ErrorDetail[]
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      details,
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
  return NextResponse.json(body, {
    status,
    headers: {
      'X-Request-Id': requestId,
      'Content-Type': 'application/json',
    },
  });
}
