import type { ApiResponse, PaginatedApiResponse, ApiErrorResponse, ApiErrorCode } from '../types/api';

export class ApiClientError extends Error {
  public code: ApiErrorCode;
  public status: number;
  public details?: unknown;
  public requestId?: string;

  constructor(message: string, code: ApiErrorCode, status: number, details?: unknown, requestId?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  const headers = new Headers(options.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  if (!response.ok) {
    if (isJson) {
      const errorJson = (await response.json()) as ApiErrorResponse;
      throw new ApiClientError(
        errorJson.error?.message || 'Request failed',
        errorJson.error?.code || 'INTERNAL_SERVER_ERROR',
        response.status,
        errorJson.error?.details,
        errorJson.error?.requestId
      );
    }
    throw new ApiClientError(
      `HTTP Error ${response.status}: ${response.statusText}`,
      'INTERNAL_SERVER_ERROR',
      response.status
    );
  }

  if (isJson) {
    return (await response.json()) as T;
  }

  return (await response.text()) as unknown as T;
}

export const apiClient = {
  get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return request<ApiResponse<T>>(endpoint, { ...options, method: 'GET' });
  },

  getPaginated<T>(endpoint: string, options?: RequestInit): Promise<PaginatedApiResponse<T>> {
    return request<PaginatedApiResponse<T>>(endpoint, { ...options, method: 'GET' });
  },

  post<T, B = unknown>(endpoint: string, body?: B, options?: RequestInit): Promise<ApiResponse<T>> {
    return request<ApiResponse<T>>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  },

  put<T, B = unknown>(endpoint: string, body?: B, options?: RequestInit): Promise<ApiResponse<T>> {
    return request<ApiResponse<T>>(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  },

  delete<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return request<ApiResponse<T>>(endpoint, { ...options, method: 'DELETE' });
  },
};
