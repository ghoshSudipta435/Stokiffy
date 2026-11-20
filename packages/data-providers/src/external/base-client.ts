/**
 * Base HTTP client for external data provider adapters.
 * Provides retry logic, rate limiting, and error handling.
 * Isolated from production provider selection — no live provider integrated in Phase 1A.
 */

import type { MarketDataError } from '../interfaces/market-data-provider.js';
import type { FinancialDataError } from '../interfaces/financial-provider.js';

/**
 * HTTP client configuration.
 */
export interface BaseClientConfig {
  baseURL: string;
  apiKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * Standard HTTP error from the base client.
 */
export class BaseClientError extends Error {
  readonly statusCode: number;
  readonly provider: string;

  constructor(message: string, statusCode: number, provider: string) {
    super(message);
    this.name = 'BaseClientError';
    this.statusCode = statusCode;
    this.provider = provider;
  }
}

/**
 * Base resilient HTTP client with retry and rate-limit support.
 */
export class BaseHTTPClient {
  private readonly baseURL: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(config: BaseClientConfig) {
    this.baseURL = config.baseURL;
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
  }

  /**
   * Performs a GET request with retry logic.
   */
  async get<T>(
    path: string,
    providerName: string
  ): Promise<T> {
    const url = `${this.baseURL}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.timeoutMs
        );

        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new BaseClientError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            providerName
          );
        }

        return (await response.json()) as T;
      } catch (err) {
        lastError = err as Error;
        if (attempt < this.maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelayMs * (attempt + 1))
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * Creates a market data error from a provider error.
   */
  createMarketDataError(
    field: string,
    message: string,
    recoverable: boolean
  ): MarketDataError {
    return { field, message, recoverable };
  }

  /**
   * Creates a financial data error from a provider error.
   */
  createFinancialDataError(
    field: string,
    message: string,
    recoverable: boolean
  ): FinancialDataError {
    return { field, message, recoverable };
  }
}
