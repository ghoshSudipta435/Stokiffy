/**
 * Mock provider for development and testing.
 * Returns deterministic synthetic data without any external dependency.
 * Supports synthetic fixtures for development and tests.
 */

import type {
  FinancialStatementProvider,
  FinancialDataResult,
  FinancialDataError,
} from '../interfaces/financial-provider.js';
import type {
  MarketDataProvider,
  MarketDataResult,
  MarketDataError,
} from '../interfaces/market-data-provider.js';
import type {
  FinancialStatement,
  PriceBar,
  DataProvenance,
} from '@stock-assistant/contracts';

const MOCK_SYMBOLS = ['TCS', 'HUL', 'RELIANCE', 'INFY', 'HDFCBANK'];

function createProvenance(source: string): DataProvenance {
  return {
    source,
    fetchedAt: new Date().toISOString(),
    reportedPeriod: 'FY2024',
    currency: 'INR',
    unit: 'CRORE',
    adjustmentStatus: 'reported',
    quality: 'verified',
    isMissing: false,
  };
}

function makeFinancialStatement(
  symbol: string,
  overrides: Partial<FinancialStatement> = {}
): FinancialStatement {
  return {
    id: `mock-fs-${symbol}-${Date.now()}`,
    companyId: symbol,
    periodType: 'Annual',
    fiscalYear: 'FY2024',
    revenue: { value: 10000, provenance: createProvenance('mock') },
    netProfit: { value: 2000, provenance: createProvenance('mock') },
    operatingProfit: { value: 2500, provenance: createProvenance('mock') },
    totalAssets: { value: 50000, provenance: createProvenance('mock') },
    totalLiabilities: { value: 20000, provenance: createProvenance('mock') },
    totalEquity: { value: 30000, provenance: createProvenance('mock') },
    totalDebt: { value: 5000, provenance: createProvenance('mock') },
    currentAssets: { value: 15000, provenance: createProvenance('mock') },
    currentLiabilities: { value: 10000, provenance: createProvenance('mock') },
    interestExpense: { value: 500, provenance: createProvenance('mock') },
    ebit: { value: 3000, provenance: createProvenance('mock') },
    eps: { value: 50, provenance: createProvenance('mock') },
    depreciationAmortization: { value: 1000, provenance: createProvenance('mock') },
    capitalExpenditure: { value: 2000, provenance: createProvenance('mock') },
    changeInWorkingCapital: { value: 500, provenance: createProvenance('mock') },
    fcf: { value: 1500, provenance: createProvenance('mock') },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makePriceBar(
  symbol: string,
  date: string,
  overrides: Partial<PriceBar> = {}
): PriceBar {
  return {
    id: `mock-pb-${symbol}-${date}`,
    companyId: symbol,
    date,
    open: 100,
    high: 105,
    low: 99,
    close: 103,
    volume: 1000000,
    adjusted: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock financial statement provider — returns synthetic data.
 */
export class MockFinancialStatementProvider
  implements FinancialStatementProvider
{
  readonly providerName = 'mock';
  readonly supportsRealTime = false;

  async fetchFinancials(
    symbol: string,
    periods: number
  ): Promise<FinancialDataResult> {
    const statements: FinancialStatement[] = [];
    const errors: FinancialDataError[] = [];

    if (!MOCK_SYMBOLS.includes(symbol)) {
      errors.push({
        field: 'symbol',
        message: `Symbol ${symbol} not found in mock data`,
        recoverable: false,
      });
      return {
        symbol,
        statements,
        shareholdings: [],
        corporateActions: [],
        provenance: {},
        fetchedAt: new Date().toISOString(),
        errors,
      };
    }

    for (let i = 0; i < periods; i++) {
      const year = 2024 - i;
      statements.push(
        makeFinancialStatement(symbol, {
          fiscalYear: `FY${year}`,
          revenue: {
            value: 10000 + i * 500,
            provenance: createProvenance('mock'),
          },
        })
      );
    }

    return {
      symbol,
      statements,
      shareholdings: [
        {
          id: `mock-sh-${symbol}`,
          companyId: symbol,
          period: 'FY2024',
          promoterPct: 55,
          fiiPct: 20,
          diiPct: 15,
          publicPct: 10,
          dataQuality: 'verified',
          createdAt: new Date().toISOString(),
        },
      ],
      corporateActions: [],
      provenance: {},
      fetchedAt: new Date().toISOString(),
      errors,
    };
  }

  async fetchLatestFinancials(symbol: string): Promise<FinancialDataResult> {
    return this.fetchFinancials(symbol, 1);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getLastFetched(_symbol: string): Promise<string | null> {
    return new Date().toISOString();
  }
}

/**
 * Mock market data provider — returns synthetic OHLCV data.
 */
export class MockMarketDataProvider implements MarketDataProvider {
  readonly providerName = 'mock';
  readonly supportsRealTime = false;

  async fetchPriceHistory(
    symbol: string,
    days: number
  ): Promise<MarketDataResult> {
    const priceBars: PriceBar[] = [];
    const errors: MarketDataError[] = [];

    if (!MOCK_SYMBOLS.includes(symbol)) {
      errors.push({
        field: 'symbol',
        message: `Symbol ${symbol} not found in mock data`,
        recoverable: false,
      });
      return {
        symbol,
        priceBars,
        corporateActions: [],
        provenance: {},
        fetchedAt: new Date().toISOString(),
        errors,
      };
    }

    const basePrice = 100;
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const close = basePrice + (days - i) * 0.5;
      priceBars.push(
        makePriceBar(symbol, date.toISOString(), {
          open: close - 1,
          high: close + 2,
          low: close - 2,
          close,
          volume: 1000000 + i * 10000,
        })
      );
    }

    return {
      symbol,
      priceBars,
      corporateActions: [],
      provenance: {},
      fetchedAt: new Date().toISOString(),
      errors,
    };
  }

  async fetchCorporateActions(
    _symbol: string,
    _from: Date
  ): Promise<MarketDataResult> {
    return {
      symbol: _symbol,
      priceBars: [],
      corporateActions: [],
      provenance: {},
      fetchedAt: new Date().toISOString(),
      errors: [],
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getLastFetched(_symbol: string): Promise<string | null> {
    return new Date().toISOString();
  }
}
