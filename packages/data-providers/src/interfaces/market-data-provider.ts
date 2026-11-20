/**
 * Provider-neutral interfaces for market data (OHLCV price bars) ingestion.
 * Supports future manual/CSV-first ingestion and external licensed API adapters.
 * No production provider is selected or integrated in Phase 1A.
 */

import type { PriceBar, CorporateAction, DataProvenance } from '@stock-assistant/contracts';

/**
 * Result of a market data fetch operation.
 */
export interface MarketDataResult {
  symbol: string;
  priceBars: PriceBar[];
  corporateActions: CorporateAction[];
  provenance: Record<string, DataProvenance>;
  fetchedAt: string;
  errors: MarketDataError[];
}

/**
 * Error details from a market data fetch.
 */
export interface MarketDataError {
  field: string;
  message: string;
  recoverable: boolean;
}

/**
 * Provider interface for market data (OHLCV price bars).
 * Implementations are isolated in packages/data-providers/src/external/.
 */
export interface MarketDataProvider {
  readonly providerName: string;
  readonly supportsRealTime: boolean;

  /**
   * Fetch historical price bars for a symbol over a number of days.
   */
  fetchPriceHistory(
    symbol: string,
    days: number
  ): Promise<MarketDataResult>;

  /**
   * Fetch corporate actions for a symbol from a given date.
   */
  fetchCorporateActions(
    symbol: string,
    from: Date
  ): Promise<MarketDataResult>;

  /**
   * Check if the provider is available and configured.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get the last successful fetch timestamp for a symbol.
   */
  getLastFetched(symbol: string): Promise<string | null>;
}
