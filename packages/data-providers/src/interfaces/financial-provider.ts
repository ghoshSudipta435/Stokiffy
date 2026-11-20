/**
 * Provider-neutral interfaces for financial statement data ingestion.
 * Supports future manual/CSV-first ingestion and external licensed API adapters.
 * No production provider is selected or integrated in Phase 1A.
 */

import type {
  FinancialStatement,
  ShareholdingPoint,
  CorporateAction,
  DataProvenance,
} from '@stock-assistant/contracts';

/**
 * Result of a financial data fetch operation.
 */
export interface FinancialDataResult {
  symbol: string;
  statements: FinancialStatement[];
  shareholdings: ShareholdingPoint[];
  corporateActions: CorporateAction[];
  provenance: Record<string, DataProvenance>;
  fetchedAt: string;
  errors: FinancialDataError[];
}

/**
 * Error details from a financial data fetch.
 */
export interface FinancialDataError {
  field: string;
  message: string;
  recoverable: boolean;
}

/**
 * Provider interface for financial statement data.
 * Implementations are isolated in packages/data-providers/src/external/.
 */
export interface FinancialStatementProvider {
  readonly providerName: string;
  readonly supportsRealTime: boolean;

  /**
   * Fetch financial statements for a symbol across multiple periods.
   */
  fetchFinancials(
    symbol: string,
    periods: number
  ): Promise<FinancialDataResult>;

  /**
   * Fetch the latest financial statement for a symbol.
   */
  fetchLatestFinancials(symbol: string): Promise<FinancialDataResult>;

  /**
   * Check if the provider is available and configured.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get the last successful fetch timestamp for a symbol.
   */
  getLastFetched(symbol: string): Promise<string | null>;
}
