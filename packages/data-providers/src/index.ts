/**
 * @stock-assistant/data-providers — Public exports
 *
 * Provider-neutral interfaces for market and financial data ingestion.
 * Phase 1A: Interfaces, CSV adapter, and mock provider only.
 * No production provider is selected or integrated.
 */

export type {
  FinancialDataResult,
  FinancialDataError,
} from './interfaces/financial-provider.js';
export type {
  MarketDataResult,
  MarketDataError,
  MarketDataProvider as MarketDataProviderType,
  MarketDataResult as MarketDataResultType,
  MarketDataError as MarketDataErrorType,
} from './interfaces/market-data-provider.js';

// CSV
export { CSVParser } from './csv/parser.js';
export {
  mapToFinancialStatement,
  mapToShareholdingPoint,
  mapToCorporateAction,
  mapToStageAInput,
} from './csv/mapper.js';
export {
  validateFinancialRow,
  validateShareholdingRow,
  validatePriceRow,
} from './csv/validator.js';
export {
  OHLCVParser,
  parseOHLCVCSV,
  type ParsedOHLCVBar,
  type OHLCVRowError,
  type OHLCVParseResult,
} from './csv/ohlcv-parser.js';

// External providers
export {
  MockFinancialStatementProvider,
  MockMarketDataProvider,
} from './external/mock-provider.js';
export {
  YahooFinanceMarketDataProvider,
  toYahooSymbol,
  type YahooSearchResultItem,
  type YahooQuoteResult,
  type YahooHistoricalBarsResult,
} from './external/yahoo-finance-provider.js';
